"""
STAGE 4 CONTROLLED RELATIONAL TRAINING (ml_foundation/train_stage4_relational.py)

Executes Stage 4 controlled relational learning curriculum training:
- Starting checkpoint: vision-pretraining-validation-13m (clean 13.33M base)
- Dataset: vision_stage4_relational (verified mathematics, programming, language, science)
- Sequence length: 256 tokens
- 100% prompt masking in loss (target = pad_id on prompt tokens)
- Zero repetition penalty for symbolic evaluation
- Periodic checkpoints at step 50, 100, 150, 200, 250
- Emits VISION_STAGE4_TRAINING_TELEMETRY.json
"""

import os
import sys
import json
import time
import math
import hashlib
from typing import Dict, List, Any, Tuple

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
from ml_foundation.rigorous_evaluator import rigorous_verify_probe
from ml_foundation.evaluate_independent_transfer import wilson_score_interval
from ml_foundation.train_sft_alignment import SFTInMemoryDataset, sft_collate

DATA_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "datasets", "vision_stage4_relational")
TRAIN_FILE = os.path.join(DATA_DIR, "train.jsonl")
VAL_FILE = os.path.join(DATA_DIR, "val.jsonl")
TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")
INIT_CKPT_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-pretraining-validation-13m")
OUT_CKPT_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-13m-stage4-relational")
TRANSFER_TEST_FILE = os.path.join(REPO_ROOT, "vision_independent_transfer_test_200.jsonl")
GENERALIZATION_TEST_FILE = os.path.join(REPO_ROOT, "vision_stage4_generalization_suite_100.jsonl")

os.makedirs(OUT_CKPT_DIR, exist_ok=True)

def compute_sha256(filepath: str) -> str:
    if not os.path.exists(filepath):
        return "NOT_FOUND"
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def evaluate_val_loss(model: nn.Module, val_dataset: SFTInMemoryDataset, batch_size: int = 8, max_batches: int = 25) -> Tuple[float, Dict[str, float]]:
    model.eval()
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, collate_fn=sft_collate)
    total_loss = 0.0
    total_tokens = 0
    pad_id = 0

    domain_losses = {}
    domain_tokens = {}

    with torch.no_grad():
        for i, (inputs, targets, n_tgt, domains) in enumerate(val_loader):
            if i >= max_batches:
                break
            out = model(inputs)
            logits = out["logits"]
            loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), targets.reshape(-1), ignore_index=pad_id, reduction="sum")
            total_loss += loss.item()
            total_tokens += n_tgt

            # Track per-domain loss
            for j, (dom, item_tgt) in enumerate(zip(domains, targets)):
                if dom not in domain_losses:
                    domain_losses[dom] = 0.0
                    domain_tokens[dom] = 0
                item_tgt_mask = item_tgt != pad_id
                n_tok = item_tgt_mask.sum().item()
                if n_tok > 0:
                    item_logits = logits[j]
                    item_loss = F.cross_entropy(item_logits, item_tgt, ignore_index=pad_id, reduction="sum")
                    domain_losses[dom] += item_loss.item()
                    domain_tokens[dom] += n_tok

    model.train()
    overall = round(total_loss / max(total_tokens, 1), 4)
    per_dom = {d: round(domain_losses[d] / max(domain_tokens[d], 1), 4) for d in domain_losses}
    return overall, per_dom

def evaluate_probes(
    model: nn.Module,
    tokenizer: JarvisBPE,
    probes: List[Dict[str, Any]],
    id_key: str = "id"
) -> Dict[str, Any]:
    model.eval()
    domain_stats = {}
    passed_count = 0
    results = []
    t0 = time.time()

    stop_ids = [tokenizer.vocab["</assistant>"]] if "</assistant>" in tokenizer.vocab else None

    for p in probes:
        dom = p.get("domain", p.get("category", "general"))
        if dom not in domain_stats:
            domain_stats[dom] = {"passed": 0, "total": 0}
        domain_stats[dom]["total"] += 1

        prompt = f"<bos><user>{p['prompt']}</user><assistant>"
        inp = tokenizer.encode(prompt)
        inp_tensor = torch.tensor([inp], dtype=torch.long)

        p_probe = dict(p)
        if "verification_type" not in p_probe:
            eval_t = p_probe.get("eval_type", "keyword_match")
            if eval_t == "math":
                p_probe["verification_type"] = "exact_math"
            elif eval_t == "code_ast":
                p_probe["verification_type"] = "code_syntax"
            else:
                p_probe["verification_type"] = "keyword_match"

        with torch.no_grad():
            out_ids = model.generate(
                inp_tensor,
                max_new_tokens=48,
                temperature=0.0,
                repetition_penalty=1.0,
                no_repeat_ngram_size=0,
                eos_id=tokenizer.vocab.get("<eos>", 2),
                stop_token_ids=stop_ids
            )

        gen_tokens = out_ids[len(inp):]
        raw_out = tokenizer.decode(gen_tokens, skip_special_tokens=True).strip()

        # Rigorous verification
        passed, reason, extracted = rigorous_verify_probe(p_probe, raw_out)

        if passed:
            passed_count += 1
            domain_stats[dom]["passed"] += 1

        results.append({
            "id": p.get(id_key, p.get("probe_id", "UNKNOWN")),
            "domain": dom,
            "prompt": p["prompt"],
            "expected": str(p["expected_answer"]),
            "generated": raw_out,
            "extracted_answer": extracted,
            "passed": passed,
            "reason": reason
        })

    model.train()
    total = len(probes)
    acc = round(passed_count / max(total, 1) * 100, 2)
    ci = wilson_score_interval(passed_count, total)

    breakdown = {}
    for d, st in domain_stats.items():
        d_tot = st["total"]
        d_pas = st["passed"]
        breakdown[d] = {
            "passed": d_pas,
            "total": d_tot,
            "accuracy_pct": round(d_pas / max(d_tot, 1) * 100, 2)
        }

    return {
        "total_probes": total,
        "passed_probes": passed_count,
        "overall_accuracy_pct": acc,
        "wilson_95_ci": [ci[0], ci[1]],
        "elapsed_time_s": round(time.time() - t0, 2),
        "domain_breakdown": breakdown,
        "passes": [r for r in results if r["passed"]],
        "sample_failures": [r for r in results if not r["passed"]][:15]
    }

def main():
    print("=" * 70)
    print("STAGE 4: CONTROLLED RELATIONAL CURRICULUM TRAINING")
    print("=" * 70)

    # 1. Load Tokenizer & Config
    tokenizer = JarvisBPE.load(TOKENIZER_DIR)
    config_path = os.path.join(INIT_CKPT_DIR, "config.json")
    with open(config_path, "r", encoding="utf-8") as f:
        cfg_dict = json.load(f)
    cfg = JarvisConfig(**cfg_dict)

    # 2. Initialize Model
    model = JarvisUnifiedTransformer(cfg)
    base_weights_path = os.path.join(INIT_CKPT_DIR, "weights.pt")
    base_sha256 = compute_sha256(base_weights_path)
    state = torch.load(base_weights_path, map_location="cpu")
    model.load_state_dict(state)
    print(f"Loaded base model: {base_weights_path} (SHA-256: {base_sha256[:12]}...)")

    # 3. Load Datasets
    train_dataset = SFTInMemoryDataset(TRAIN_FILE, tokenizer, max_seq_len=256)
    val_dataset = SFTInMemoryDataset(VAL_FILE, tokenizer, max_seq_len=256)
    print(f"Loaded datasets: {len(train_dataset):,} train, {len(val_dataset):,} val")

    # 4. Load Evaluation Suites
    transfer_probes = []
    with open(TRANSFER_TEST_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                transfer_probes.append(json.loads(line))

    generalization_probes = []
    with open(GENERALIZATION_TEST_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                generalization_probes.append(json.loads(line))

    # 5. Training Setup
    batch_size = 16
    total_steps = 250
    lr_max = 2.0e-4
    lr_min = 2.0e-5
    warmup_steps = 20

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr_max, betas=(0.9, 0.95), weight_decay=0.1)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, collate_fn=sft_collate)

    # Step 0 Baseline
    print("\n--- Evaluating Baseline (Step 0) ---")
    val_loss_0, per_dom_0 = evaluate_val_loss(model, val_dataset)
    print(f"Step 0 Initial Validation Loss: {val_loss_0:.4f} nats")
    transfer_0 = evaluate_probes(model, tokenizer, transfer_probes, id_key="id")
    print(f"Step 0 Transfer Score: {transfer_0['passed_probes']}/{transfer_0['total_probes']} ({transfer_0['overall_accuracy_pct']}%)")
    gen_0 = evaluate_probes(model, tokenizer, generalization_probes, id_key="probe_id")
    print(f"Step 0 Generalization Score: {gen_0['passed_probes']}/{gen_0['total_probes']} ({gen_0['overall_accuracy_pct']}%)")

    telemetry_steps = []
    benchmark_history = [{
        "step": 0,
        "val_loss": val_loss_0,
        "per_domain_val_loss": per_dom_0,
        "transfer_benchmark": transfer_0,
        "generalization_suite": gen_0
    }]

    # Compute baseline parameter norm
    with torch.no_grad():
        initial_param_norm = math.sqrt(sum(p.norm().item() ** 2 for p in model.parameters()))

    step = 0
    epoch = 0
    t_start = time.time()
    cum_tokens = 0
    cum_target_tokens = 0

    print(f"\n--- Starting 250 Training Steps ---")
    while step < total_steps:
        epoch += 1
        for inputs, targets, n_tgt, domains in train_loader:
            step += 1
            if step > total_steps:
                break

            # LR Schedule (Warmup + Cosine)
            if step <= warmup_steps:
                lr = lr_max * (step / warmup_steps)
            else:
                progress = (step - warmup_steps) / max(total_steps - warmup_steps, 1)
                lr = lr_min + 0.5 * (lr_max - lr_min) * (1.0 + math.cos(math.pi * progress))

            for param_group in optimizer.param_groups:
                param_group["lr"] = lr

            t0 = time.time()
            optimizer.zero_grad()

            # Record pre-update weights for parameter update ratio
            pre_weights = [p.detach().clone() for p in model.parameters()]

            out = model(inputs)
            logits = out["logits"]
            loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), targets.reshape(-1), ignore_index=0, reduction="mean")
            loss.backward()

            grad_norm = nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0).item()
            optimizer.step()

            step_time = time.time() - t0
            step_tokens = inputs.size(0) * inputs.size(1)
            cum_tokens += step_tokens
            cum_target_tokens += n_tgt
            tok_per_sec = round(step_tokens / max(step_time, 1e-4), 1)

            # Parameter update magnitude ratio
            with torch.no_grad():
                diff_norm = math.sqrt(sum((p - p_pre).norm().item() ** 2 for p, p_pre in zip(model.parameters(), pre_weights)))
                param_ratio = round(diff_norm / initial_param_norm, 6)

            val_loss = None
            if step % 25 == 0 or step == total_steps:
                val_loss, per_dom_val = evaluate_val_loss(model, val_dataset)

            rss = _get_process_rss_mb()

            telemetry_steps.append({
                "step": step,
                "train_loss": round(loss.item(), 4),
                "val_loss": val_loss,
                "learning_rate": round(lr, 8),
                "grad_norm": round(grad_norm, 4),
                "param_update_ratio": param_ratio,
                "step_tokens": step_tokens,
                "step_target_tokens": n_tgt,
                "cumulative_tokens": cum_tokens,
                "cumulative_target_tokens": cum_target_tokens,
                "tokens_per_sec": tok_per_sec,
                "rss_mb": round(rss, 2)
            })

            if step % 25 == 0 or step == 1 or step == total_steps:
                val_str = f" | Val Loss: {val_loss:.4f}" if val_loss is not None else ""
                print(f"Step {step:03d}/{total_steps} | Train: {loss.item():.4f}{val_str} | Grad: {grad_norm:.2f} | Ratio: {param_ratio:.6f} | LR: {lr:.2e} | {tok_per_sec} tok/s")

            # Periodic checkpoint saving
            if step in [50, 100, 150, 200, 250]:
                step_dir = os.path.join(OUT_CKPT_DIR, f"step_{step:03d}")
                os.makedirs(step_dir, exist_ok=True)
                step_weights = os.path.join(step_dir, "weights.pt")
                torch.save(model.state_dict(), step_weights)
                with open(os.path.join(step_dir, "config.json"), "w", encoding="utf-8") as f:
                    json.dump(cfg_dict, f, indent=2)

                # Benchmark at step 100 and step 250
                if step in [100, 250]:
                    print(f"\n--- Evaluating Checkpoint at Step {step} ---")
                    step_val_loss, step_per_dom = evaluate_val_loss(model, val_dataset)
                    step_transfer = evaluate_probes(model, tokenizer, transfer_probes, id_key="id")
                    print(f"Step {step} Transfer Score: {step_transfer['passed_probes']}/{step_transfer['total_probes']} ({step_transfer['overall_accuracy_pct']}%)")
                    step_gen = evaluate_probes(model, tokenizer, generalization_probes, id_key="probe_id")
                    print(f"Step {step} Generalization Score: {step_gen['passed_probes']}/{step_gen['total_probes']} ({step_gen['overall_accuracy_pct']}%)")

                    benchmark_history.append({
                        "step": step,
                        "val_loss": step_val_loss,
                        "per_domain_val_loss": step_per_dom,
                        "transfer_benchmark": step_transfer,
                        "generalization_suite": step_gen
                    })

    # Save final model atomically
    final_weights_path = os.path.join(OUT_CKPT_DIR, "weights.pt")
    torch.save(model.state_dict(), final_weights_path)
    with open(os.path.join(OUT_CKPT_DIR, "config.json"), "w", encoding="utf-8") as f:
        json.dump(cfg_dict, f, indent=2)
    final_sha256 = compute_sha256(final_weights_path)
    print(f"\nSaved final Stage 4 checkpoint: {final_weights_path} (SHA-256: {final_sha256})")

    total_duration = round(time.time() - t_start, 2)

    # Telemetry JSON
    telemetry_doc = {
        "model_name": "vision-13m-stage4-relational",
        "base_checkpoint": base_weights_path,
        "base_sha256": base_sha256,
        "final_checkpoint": final_weights_path,
        "final_sha256": final_sha256,
        "max_seq_len": 256,
        "total_steps": total_steps,
        "total_tokens_consumed": cum_tokens,
        "total_target_tokens_supervised": cum_target_tokens,
        "training_duration_s": total_duration,
        "telemetry_steps": telemetry_steps
    }
    telemetry_file = os.path.join(REPO_ROOT, "VISION_STAGE4_TRAINING_TELEMETRY.json")
    with open(telemetry_file, "w", encoding="utf-8") as f:
        json.dump(telemetry_doc, f, indent=2)
    print(f"Saved training telemetry to {telemetry_file}")

    # Results JSON
    results_doc = {
        "model_name": "vision-13m-stage4-relational",
        "transfer_suite": TRANSFER_TEST_FILE,
        "generalization_suite": GENERALIZATION_TEST_FILE,
        "evaluator": "ml_foundation/rigorous_evaluator.py (formal verification)",
        "benchmark_history": benchmark_history
    }
    results_file = os.path.join(REPO_ROOT, "VISION_STAGE4_GENERALIZATION_RESULTS.json")
    with open(results_file, "w", encoding="utf-8") as f:
        json.dump(results_doc, f, indent=2)
    print(f"Saved generalization results to {results_file}")

if __name__ == "__main__":
    main()
