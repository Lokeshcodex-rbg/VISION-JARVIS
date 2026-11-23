"""
STAGE 2: TARGETED MULTI-DOMAIN SFT ALIGNMENT (ml_foundation/train_sft_alignment.py)

Executes instruction-tuning alignment on vision-pretraining-validation-13m:
- Sequence length: 256 tokens (double the previous 128 context)
- 100% prompt masking (loss computed strictly on assistant response)
- Dataset: data/neural_models/datasets/vision_sft_alignment/
- Effective batch size: 16 sequences (batch_size=8, grad_accum=2)
- Learning rate: 5e-5 with warmup and cosine decay
- Periodic evaluation on 200-probe independent transfer benchmark with calibrated decoding
- Atomic checkpointing and SHA-256 recording
"""

import os
import sys
import json
import time
import math
import hashlib
from typing import Dict, List, Any, Tuple
from collections import Counter

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.evaluate_independent_transfer import verify_probe, wilson_score_interval

DATA_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "datasets", "vision_sft_alignment")
TRAIN_FILE = os.path.join(DATA_DIR, "train.jsonl")
VAL_FILE = os.path.join(DATA_DIR, "val.jsonl")
TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")
INIT_CKPT_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-pretraining-validation-13m")
OUT_CKPT_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-13m-sft-aligned")
TRANSFER_TEST_FILE = os.path.join(REPO_ROOT, "vision_independent_transfer_test_200.jsonl")

os.makedirs(OUT_CKPT_DIR, exist_ok=True)

def compute_sha256(filepath: str) -> str:
    if not os.path.exists(filepath):
        return "NOT_FOUND"
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

class SFTInMemoryDataset(Dataset):
    def __init__(self, jsonl_file: str, tokenizer: JarvisBPE, max_seq_len: int = 256):
        self.samples = []
        pad_id = tokenizer.pad_id

        if not os.path.exists(jsonl_file):
            print(f"[WARN] File not found: {jsonl_file}")
            return

        with open(jsonl_file, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                item = json.loads(line)
                inst = item["instruction"].strip()
                resp = item["response"].strip()

                p_text = f"<bos><user>{inst}</user><assistant>"
                r_text = f"{resp}</assistant><eos>"

                p_ids = tokenizer.encode(p_text)
                r_ids = tokenizer.encode(r_text)

                if len(p_ids) > 160:
                    continue

                max_r_len = max_seq_len - len(p_ids)
                if len(r_ids) > max_r_len:
                    r_ids = r_ids[:max_r_len]

                full_ids = p_ids + r_ids
                if len(full_ids) < 8 or len(r_ids) < 2:
                    continue

                # Pad to max_seq_len
                padded = full_ids + [pad_id] * (max_seq_len - len(full_ids))
                inp = padded[:-1]
                tgt = list(padded[1:])

                # Exact SFT masking: mask all tokens up to len(p_ids) - 2
                # len(p_ids) - 1 is <assistant> predicting first response token
                for k in range(len(p_ids) - 1):
                    tgt[k] = pad_id

                # Mask padding tokens
                for k in range(len(full_ids) - 1, len(tgt)):
                    tgt[k] = pad_id

                n_targets = sum(1 for t in tgt if t != pad_id)
                if n_targets > 0:
                    self.samples.append({
                        "input": torch.tensor(inp, dtype=torch.long),
                        "target": torch.tensor(tgt, dtype=torch.long),
                        "n_targets": n_targets,
                        "domain": item.get("domain", "general")
                    })

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        s = self.samples[idx]
        return s["input"], s["target"], s["n_targets"], s["domain"]

def sft_collate(batch):
    inputs = torch.stack([b[0] for b in batch])
    targets = torch.stack([b[1] for b in batch])
    n_targets = sum(b[2] for b in batch)
    domains = [b[3] for b in batch]
    return inputs, targets, n_targets, domains

def evaluate_val_loss(model: nn.Module, val_dataset: SFTInMemoryDataset, batch_size: int = 8, max_batches: int = 20) -> float:
    model.eval()
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, collate_fn=sft_collate)
    total_loss = 0.0
    total_tokens = 0
    pad_id = 0

    with torch.no_grad():
        for i, (inputs, targets, n_tgt, _) in enumerate(val_loader):
            if i >= max_batches:
                break
            out = model(inputs)
            logits = out["logits"]
            loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), targets.reshape(-1), ignore_index=pad_id, reduction="sum")
            total_loss += loss.item()
            total_tokens += n_tgt

    model.train()
    return round(total_loss / max(total_tokens, 1), 4)

def evaluate_transfer_benchmark(model: nn.Module, tokenizer: JarvisBPE, probes: List[Dict[str, Any]]) -> Dict[str, Any]:
    model.eval()
    domain_stats = {}
    passed_count = 0
    results = []
    t0 = time.time()

    stop_ids = [tokenizer.vocab["</assistant>"]] if "</assistant>" in tokenizer.vocab else None

    for p in probes:
        dom = p.get("domain", "general")
        if dom not in domain_stats:
            domain_stats[dom] = {"passed": 0, "total": 0}
        domain_stats[dom]["total"] += 1

        prompt = f"<bos><user>{p['prompt']}</user><assistant>"
        inp = tokenizer.encode(prompt)
        x = torch.tensor([inp], dtype=torch.long)

        with torch.no_grad():
            out_ids = model.generate(
                x,
                max_new_tokens=48,
                temperature=0.01,
                repetition_penalty=1.15,
                no_repeat_ngram_size=4,
                eos_id=tokenizer.eos_id,
                stop_token_ids=stop_ids
            )
        gen_tokens = out_ids[len(inp):]
        decoded = tokenizer.decode(gen_tokens, skip_special_tokens=True).strip()
        passed, reason = verify_probe(p, decoded)
        if passed:
            passed_count += 1
            domain_stats[dom]["passed"] += 1

        results.append({
            "id": p["id"],
            "domain": dom,
            "prompt": p["prompt"],
            "expected": p.get("expected_answer"),
            "generated": decoded,
            "passed": passed,
            "reason": reason
        })

    model.train()
    elapsed = time.time() - t0
    acc = passed_count / max(len(probes), 1)
    ci_low, ci_high = wilson_score_interval(passed_count, len(probes))

    for d, st in domain_stats.items():
        st["accuracy_pct"] = round(st["passed"] / st["total"] * 100.0, 2)

    return {
        "total_probes": len(probes),
        "passed_probes": passed_count,
        "overall_accuracy_pct": round(acc * 100.0, 2),
        "wilson_95_ci": [round(ci_low * 100.0, 2), round(ci_high * 100.0, 2)],
        "elapsed_time_s": round(elapsed, 2),
        "domain_breakdown": domain_stats,
        "sample_passes": [r for r in results if r["passed"]],
        "sample_failures": [r for r in results if not r["passed"]][:5]
    }

def run_sft_alignment(
    max_steps: int = 100,
    batch_size: int = 8,
    grad_accum_steps: int = 2,
    lr_max: float = 5e-5,
    lr_min: float = 1e-5,
    warmup_steps: int = 15,
    max_seq_len: int = 256,
    eval_every: int = 50
):
    print("========================================================")
    print("VISION STAGE 2: TARGETED MULTI-DOMAIN SFT ALIGNMENT")
    print(f"Max Steps: {max_steps} | Effective Batch: {batch_size * grad_accum_steps} (SeqLen={max_seq_len})")
    print("========================================================")

    tokenizer = JarvisBPE.load(TOKENIZER_DIR)

    # Verify initial checkpoint
    init_weights = os.path.join(INIT_CKPT_DIR, "weights.pt")
    init_sha = compute_sha256(init_weights)
    print(f"[INIT] Loading baseline checkpoint: {init_weights}")
    print(f"[INIT] Baseline SHA-256: {init_sha}")

    with open(os.path.join(INIT_CKPT_DIR, "config.json"), "r") as f:
        cfg = JarvisConfig.from_dict(json.load(f))
    cfg.max_seq_len = max_seq_len

    model = JarvisUnifiedTransformer(cfg)
    model.load_state_dict(torch.load(init_weights, map_location="cpu"), strict=False)
    model.train()

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {total_params:,} ({total_params/1e6:.2f}M)")

    # Load SFT datasets
    print("[DATA] Loading SFT datasets into memory...")
    t0_data = time.time()
    train_dataset = SFTInMemoryDataset(TRAIN_FILE, tokenizer, max_seq_len=max_seq_len)
    val_dataset = SFTInMemoryDataset(VAL_FILE, tokenizer, max_seq_len=max_seq_len)
    print(f"[DATA] Loaded {len(train_dataset):,} train samples, {len(val_dataset):,} val samples in {time.time()-t0_data:.2f}s")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, collate_fn=sft_collate, drop_last=True)

    # Load transfer test probes
    with open(TRANSFER_TEST_FILE, "r", encoding="utf-8") as f:
        probes = [json.loads(l) for l in f if l.strip()]
    print(f"[BENCHMARK] Loaded {len(probes)} transfer test probes.")

    # Param decay setup
    decay_params = [p for n, p in model.named_parameters() if p.requires_grad and p.ndim > 1 and not n.endswith(".bias")]
    nodecay_params = [p for n, p in model.named_parameters() if p.requires_grad and (p.ndim <= 1 or n.endswith(".bias"))]

    optimizer = torch.optim.AdamW([
        {"params": decay_params, "weight_decay": 0.01},
        {"params": nodecay_params, "weight_decay": 0.0}
    ], lr=lr_max, betas=(0.9, 0.95), eps=1e-8)

    def get_lr(step_idx: int) -> float:
        if step_idx < warmup_steps:
            return lr_min + (lr_max - lr_min) * (step_idx + 1) / warmup_steps
        progress = (step_idx - warmup_steps) / max(1, max_steps - warmup_steps)
        return lr_min + 0.5 * (lr_max - lr_min) * (1.0 + math.cos(math.pi * progress))

    # Baseline evaluation at step 0
    print("\n[STEP 0] Running baseline validation loss and transfer benchmark...")
    init_val_loss = evaluate_val_loss(model, val_dataset)
    init_bench = evaluate_transfer_benchmark(model, tokenizer, probes)
    print(f"[STEP 0] Val Loss: {init_val_loss:.4f} | Transfer Benchmark: {init_bench['passed_probes']}/{init_bench['total_probes']} ({init_bench['overall_accuracy_pct']}%)")
    for d, st in init_bench["domain_breakdown"].items():
        print(f"  - {d:25s}: {st['passed']}/{st['total']} ({st['accuracy_pct']}%)")

    step = 0
    cumulative_tokens = 0
    cumulative_target_tokens = 0
    telemetry_steps = []
    benchmark_history = [{
        "step": 0,
        "val_loss": init_val_loss,
        "benchmark": init_bench
    }]

    data_iter = iter(train_loader)
    pad_id = tokenizer.pad_id

    print("\n========================================================")
    print(f"STARTING SFT TRAINING (1 to {max_steps} STEPS)")
    print("========================================================")

    start_train_time = time.time()

    while step < max_steps:
        prev_params = {n: p.detach().clone() for n, p in model.named_parameters() if p.requires_grad and p.ndim > 1}

        curr_lr = get_lr(step)
        for pg in optimizer.param_groups:
            pg["lr"] = curr_lr

        optimizer.zero_grad()
        accum_loss = 0.0
        step_tokens = 0
        step_target_tokens = 0

        step_t0 = time.time()
        for micro in range(grad_accum_steps):
            try:
                inputs, targets, n_tgt, _ = next(data_iter)
            except StopIteration:
                data_iter = iter(train_loader)
                inputs, targets, n_tgt, _ = next(data_iter)

            out = model(inputs)
            logits = out["logits"]
            loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), targets.reshape(-1), ignore_index=pad_id)
            loss_scaled = loss / grad_accum_steps
            loss_scaled.backward()

            accum_loss += loss.item() / grad_accum_steps
            step_tokens += inputs.numel()
            step_target_tokens += n_tgt

        grad_norm = nn.utils.clip_grad_norm_(model.parameters(), 1.0).item()
        optimizer.step()
        step_time = max(time.time() - step_t0, 1e-4)
        tps = step_tokens / step_time

        update_ratios = []
        for n, p in model.named_parameters():
            if n in prev_params:
                delta = (p.detach() - prev_params[n]).norm(2).item()
                orig = prev_params[n].norm(2).item()
                update_ratios.append(delta / (orig + 1e-9))
        mean_update_ratio = sum(update_ratios) / max(len(update_ratios), 1)

        cumulative_tokens += step_tokens
        cumulative_target_tokens += step_target_tokens
        step += 1

        curr_val_loss = None
        if step % 20 == 0 or step == max_steps:
            curr_val_loss = evaluate_val_loss(model, val_dataset)

        rss_mb = round(_get_process_rss_mb(), 2)

        entry = {
            "step": step,
            "train_loss": round(accum_loss, 4),
            "val_loss": curr_val_loss,
            "learning_rate": round(curr_lr, 7),
            "grad_norm": round(grad_norm, 4),
            "param_update_ratio": round(mean_update_ratio, 6),
            "step_tokens": step_tokens,
            "step_target_tokens": step_target_tokens,
            "cumulative_tokens": cumulative_tokens,
            "cumulative_target_tokens": cumulative_target_tokens,
            "tokens_per_sec": round(tps, 1),
            "rss_mb": rss_mb
        }
        telemetry_steps.append(entry)

        val_str = f" | Val: {curr_val_loss:.4f}" if curr_val_loss is not None else ""
        print(f"Step {step:3d}/{max_steps} | Loss: {accum_loss:.4f}{val_str} | GradNorm: {grad_norm:.3f} | LR: {curr_lr:.2e} | ||Δθ||/||θ||: {mean_update_ratio:.5f} | TPS: {tps:5.0f} | RAM: {rss_mb:.1f} MB")

        # Periodic benchmark evaluation
        if step % eval_every == 0 or step == max_steps:
            step_ckpt = os.path.join(OUT_CKPT_DIR, f"step_{step:03d}")
            os.makedirs(step_ckpt, exist_ok=True)
            torch.save(model.state_dict(), os.path.join(step_ckpt, "weights.pt"))
            with open(os.path.join(step_ckpt, "config.json"), "w") as f:
                json.dump(cfg.to_dict(), f, indent=2)

            print(f"\n[BENCHMARK @ STEP {step}] Running calibrated transfer test...")
            bench_res = evaluate_transfer_benchmark(model, tokenizer, probes)
            benchmark_history.append({
                "step": step,
                "val_loss": curr_val_loss,
                "benchmark": bench_res
            })
            print(f"[BENCHMARK @ STEP {step}] Score: {bench_res['passed_probes']}/{bench_res['total_probes']} ({bench_res['overall_accuracy_pct']}%) | CI: {bench_res['wilson_95_ci']}")
            for d, st in bench_res["domain_breakdown"].items():
                print(f"  - {d:25s}: {st['passed']}/{st['total']} ({st['accuracy_pct']}%)")
            if bench_res["sample_passes"]:
                print(f"  Sample passes ({len(bench_res['sample_passes'])}):")
                for sp in bench_res["sample_passes"][:5]:
                    print(f"    [{sp['id']}] '{sp['prompt'][:45]}' -> '{sp['generated'][:45]}' (Exp: '{sp['expected']}')")
            print("--------------------------------------------------------\n")

    total_train_time = time.time() - start_train_time
    print(f"\n[DONE] SFT Training completed in {total_train_time:.1f}s ({total_train_time/60:.2f} min)")

    # Save final weights and config
    final_weights = os.path.join(OUT_CKPT_DIR, "weights.pt")
    torch.save(model.state_dict(), final_weights)
    with open(os.path.join(OUT_CKPT_DIR, "config.json"), "w") as f:
        json.dump(cfg.to_dict(), f, indent=2)

    final_sha = compute_sha256(final_weights)
    print(f"[SAVE] Final SFT checkpoint saved: {final_weights}")
    print(f"[SAVE] Final SHA-256: {final_sha}")

    # Emit telemetry & benchmark json
    telemetry_file = os.path.join(REPO_ROOT, "VISION_SFT_ALIGNMENT_TELEMETRY.json")
    with open(telemetry_file, "w") as f:
        json.dump({
            "model_name": "vision-13m-sft-aligned",
            "base_checkpoint": init_weights,
            "base_sha256": init_sha,
            "final_checkpoint": final_weights,
            "final_sha256": final_sha,
            "max_seq_len": max_seq_len,
            "total_steps": max_steps,
            "total_tokens_consumed": cumulative_tokens,
            "total_target_tokens_supervised": cumulative_target_tokens,
            "training_duration_s": round(total_train_time, 2),
            "telemetry_steps": telemetry_steps
        }, f, indent=2)

    benchmark_file = os.path.join(REPO_ROOT, "VISION_SFT_ALIGNMENT_BENCHMARK.json")
    with open(benchmark_file, "w") as f:
        json.dump({
            "model_name": "vision-13m-sft-aligned",
            "benchmark_suite": "vision_independent_transfer_test_200.jsonl",
            "decoding_method": "calibrated (repetition_penalty=1.15, no_repeat_ngram_size=4)",
            "benchmark_history": benchmark_history
        }, f, indent=2)

    print(f"[EMIT] Telemetry: {telemetry_file}")
    print(f"[EMIT] Benchmark: {benchmark_file}")
    print("========================================================")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run SFT Alignment Training")
    parser.add_argument("--max_steps", type=int, default=120, help="Maximum optimizer steps")
    parser.add_argument("--batch_size", type=int, default=8, help="Per-device micro-batch size")
    parser.add_argument("--grad_accum_steps", type=int, default=2, help="Gradient accumulation steps")
    parser.add_argument("--lr_max", type=float, default=5e-5, help="Peak learning rate")
    parser.add_argument("--eval_every", type=int, default=40, help="Evaluation interval")
    parser.add_argument("--max_seq_len", type=int, default=256, help="Maximum sequence length")
    args = parser.parse_args()

    run_sft_alignment(
        max_steps=args.max_steps,
        batch_size=args.batch_size,
        grad_accum_steps=args.grad_accum_steps,
        lr_max=args.lr_max,
        max_seq_len=args.max_seq_len,
        eval_every=args.eval_every
    )

