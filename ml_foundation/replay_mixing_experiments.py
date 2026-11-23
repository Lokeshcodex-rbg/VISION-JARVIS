"""
VISION — Replay-Buffered Continued Pretraining & Catastrophic Forgetting Recovery
ml_foundation/replay_mixing_experiments.py

Executes controlled replay mixing experiments across:
- Candidate A: 70% General Replay / 30% Reasoning Curriculum
- Candidate B: 50% General Replay / 50% Reasoning Curriculum
- Candidate C: 80% General Replay / 20% Reasoning Curriculum

Strict Experimental Controls:
- Base Architecture: 13,332,498 params (v1.4 Calibrated Base)
- Tokenizer: JarvisBPE (8,192 vocab)
- Conservative Learning Rate: 1.2e-5 (<= 1.5e-5 mandate) with warmup & cosine decay
- Fixed Training Budget: 80 optimization steps per candidate
- Sequence Length: 256 tokens, micro-batch 2, gradient accumulation 4 (effective batch 8)
- Zero Contamination: 100% verified against all 104 V14/V13 evaluation canaries
- Evaluation: Identical 64-probe held-out evaluation via ml_foundation/v14_evaluator.py
"""

from __future__ import annotations

import copy
import datetime
import hashlib
import json
import math
import os
import random
import sys
import time
from typing import Dict, List, Optional, Tuple, Any

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

import torch
torch.set_num_threads(4)
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.v14_evaluator import V14_BENCHMARK_CANARIES, run_v14_evaluation
from ml_foundation.v13_evaluator import V13_BENCHMARK_CANARIES
from ml_foundation.nextgen_reasoning_pretraining import build_reasoning_curriculum, assert_clean_held_out


def get_file_sha256(path: str) -> str:
    if not os.path.exists(path):
        return "MISSING"
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


# =========================================================================
# 1. REPLAY CORPUS LOADER & AUDITOR
# =========================================================================

def load_audited_replay_samples(
    corpus_jsonl: str = "data/neural_models/datasets/expanded_corpus/train.jsonl",
    max_samples: int = 500,
    seed: int = 42
) -> List[Dict[str, str]]:
    print(f"[Audit] Loading replay samples from {corpus_jsonl}...")
    rng = random.Random(seed)
    all_canaries = V14_BENCHMARK_CANARIES + V13_BENCHMARK_CANARIES
    lowered_canaries = [c.lower().strip() for c in all_canaries if c.strip()]

    domain_buckets: Dict[str, List[Dict[str, str]]] = {
        "hindi_devanagari": [],
        "hinglish_dialog": [],
        "general_language_academic": [],
        "tool_use_dialogue": [],
        "coding_python": [],
        "coding_polyglot": []
    }

    total_read = 0
    with open(corpus_jsonl, "r", encoding="utf-8") as f:
        for line in f:
            total_read += 1
            item = json.loads(line)
            dom = item.get("domain", "")
            if dom not in domain_buckets:
                continue

            inst = str(item.get("instruction", "")).strip()
            resp = str(item.get("response", "")).strip()
            if not inst or not resp:
                continue

            # Check canary cleanliness
            full_text = (inst + " " + resp).lower()
            if any(c in full_text for c in lowered_canaries):
                continue

            domain_buckets[dom].append({
                "instruction": inst,
                "response": resp,
                "domain": dom,
                "source": item.get("source", "expanded_corpus")
            })

    # Sample equally across domains to prevent single-domain bias
    samples_per_domain = max_samples // len(domain_buckets)
    replay_pool: List[Dict[str, str]] = []
    print("[Audit] Replay pool domain breakdown:")
    for dom, items in domain_buckets.items():
        rng.shuffle(items)
        selected = items[:samples_per_domain]
        replay_pool.extend(selected)
        print(f"  - {dom:28s}: {len(selected)} samples (Available: {len(items)})")

    rng.shuffle(replay_pool)
    print(f"[Audit] Total clean replay samples assembled: {len(replay_pool)}")
    return replay_pool


# =========================================================================
# 2. DATASET MIXER & DATASET CLASS
# =========================================================================

class ReplayDataset(Dataset):
    def __init__(self, items: List[Dict[str, str]], tokenizer: JarvisBPE, max_seq_len: int = 256):
        self.samples = []
        bos_id = tokenizer.bos_id if hasattr(tokenizer, "bos_id") else 1
        eos_id = tokenizer.eos_id if hasattr(tokenizer, "eos_id") else 2

        for item in items:
            text = f"<user>\n{item['instruction']}\n</user>\n<assistant>\n{item['response']}\n</assistant>"
            token_ids = [bos_id] + tokenizer.encode(text) + [eos_id]

            if len(token_ids) > max_seq_len:
                token_ids = token_ids[:max_seq_len]

            input_ids = token_ids[:-1]
            label_ids = token_ids[1:]

            pad_len = (max_seq_len - 1) - len(input_ids)
            if pad_len > 0:
                input_ids = input_ids + [0] * pad_len
                label_ids = label_ids + [-100] * pad_len

            self.samples.append((
                torch.tensor(input_ids, dtype=torch.long),
                torch.tensor(label_ids, dtype=torch.long)
            ))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        return self.samples[idx]


def build_mixed_dataset(
    replay_pool: List[Dict[str, str]],
    reasoning_pool: List[Dict[str, str]],
    replay_ratio: float,
    total_size: int = 350,
    seed: int = 42
) -> List[Dict[str, str]]:
    rng = random.Random(seed)
    n_replay = int(total_size * replay_ratio)
    n_reasoning = total_size - n_replay

    # Sample with replacement if pool size is smaller than requested quota
    selected_replay = [rng.choice(replay_pool) for _ in range(n_replay)]
    selected_reasoning = [rng.choice(reasoning_pool) for _ in range(n_reasoning)]

    mixed = selected_replay + selected_reasoning
    rng.shuffle(mixed)
    return mixed


# =========================================================================
# 3. CONTROLLED TRAINING LOOP
# =========================================================================

def train_candidate(
    candidate_name: str,
    mixed_items: List[Dict[str, str]],
    base_checkpoint: str,
    out_checkpoint: str,
    tokenizer: JarvisBPE,
    config: JarvisConfig,
    total_steps: int = 80,
    peak_lr: float = 1.2e-5,
    min_lr: float = 1.2e-6,
    warmup_steps: int = 10,
    batch_size: int = 2,
    grad_accum_steps: int = 4,
) -> Dict[str, Any]:
    print(f"\n{'='*75}")
    print(f"TRAINING {candidate_name.upper()} (Target: {out_checkpoint})")
    print(f"{'='*75}")

    # Fresh copy of model from base checkpoint
    model, _ = JarvisUnifiedTransformer.load_pretrained(base_checkpoint, device="cpu", strict=False)
    model.train()

    # Split train / validation
    val_count = max(4, int(len(mixed_items) * 0.10))
    train_items = mixed_items[val_count:]
    val_items = mixed_items[:val_count]

    train_ds = ReplayDataset(train_items, tokenizer, max_seq_len=256)
    val_ds = ReplayDataset(val_items, tokenizer, max_seq_len=256)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, drop_last=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=peak_lr,
        betas=(0.90, 0.98),
        weight_decay=0.05,
        eps=1e-8,
    )

    def get_lr(step_idx: int) -> float:
        if step_idx < warmup_steps:
            return min_lr + (peak_lr - min_lr) * (step_idx + 1) / max(1, warmup_steps)
        prog = (step_idx - warmup_steps) / max(1, total_steps - warmup_steps)
        return min_lr + 0.5 * (peak_lr - min_lr) * (1.0 + math.cos(math.pi * prog))

    # Initial Val Loss
    model.eval()
    init_val_losses = []
    with torch.no_grad():
        for vb_in, vb_tgt in val_loader:
            out = model(vb_in, labels=vb_tgt)
            if out["lm_loss"] is not None:
                init_val_losses.append(float(out["lm_loss"].item()))
    init_val_loss = sum(init_val_losses) / max(1, len(init_val_losses))
    print(f"[{candidate_name}] Initial Val Loss: {init_val_loss:.4f} (PPL: {math.exp(min(12, init_val_loss)):.2f})")
    model.train()

    step = 0
    accum_loss = 0.0
    recent_losses: List[float] = []
    start_time = time.time()
    train_iter = iter(train_loader)
    optimizer.zero_grad()

    while step < total_steps:
        try:
            b_in, b_tgt = next(train_iter)
        except StopIteration:
            train_iter = iter(train_loader)
            b_in, b_tgt = next(train_iter)

        out = model(b_in, labels=b_tgt)
        loss = out["lm_loss"]
        if loss is None or torch.isnan(loss) or torch.isinf(loss):
            continue

        loss_scaled = loss / grad_accum_steps
        loss_scaled.backward()
        accum_loss += float(loss.item())

        if (step + 1) % grad_accum_steps == 0 or (step + 1) == total_steps:
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            curr_lr = get_lr(step)
            for pg in optimizer.param_groups:
                pg["lr"] = curr_lr
            optimizer.step()
            optimizer.zero_grad()

            mean_l = accum_loss / grad_accum_steps
            recent_losses.append(mean_l)
            accum_loss = 0.0

            if len(recent_losses) > 15:
                recent_losses.pop(0)

            if step % 20 == 0 or step == total_steps - 1:
                avg_l = sum(recent_losses) / len(recent_losses)
                elapsed = time.time() - start_time
                st_per_s = (step + 1) / max(1e-3, elapsed)
                print(f"  Step {step:2d}/{total_steps} | Loss: {mean_l:.4f} (Avg: {avg_l:.4f}) | LR: {curr_lr:.2e} | Speed: {st_per_s:.2f} st/s")

        step += 1

    duration = time.time() - start_time

    # Final Val Loss
    model.eval()
    final_val_losses = []
    with torch.no_grad():
        for vb_in, vb_tgt in val_loader:
            out = model(vb_in, labels=vb_tgt)
            if out["lm_loss"] is not None:
                final_val_losses.append(float(out["lm_loss"].item()))
    final_val_loss = sum(final_val_losses) / max(1, len(final_val_losses))
    final_val_ppl = math.exp(min(12, final_val_loss))

    print(f"[{candidate_name}] Finished in {duration:.2f}s | Val Loss: {init_val_loss:.4f} -> {final_val_loss:.4f} (PPL: {final_val_ppl:.2f})")

    # Save Candidate Checkpoint
    os.makedirs(out_checkpoint, exist_ok=True)
    out_weights = os.path.join(out_checkpoint, "weights.pt")
    out_config = os.path.join(out_checkpoint, "config.json")

    cand_cfg = copy.deepcopy(config.to_dict())
    cand_cfg["version"] = candidate_name

    save_dict = {
        "model_state_dict": model.state_dict(),
        "config": cand_cfg,
        "candidate_meta": {
            "name": candidate_name,
            "base_checkpoint": base_checkpoint,
            "steps": total_steps,
            "peak_lr": peak_lr,
            "final_val_loss": round(final_val_loss, 4),
            "final_val_ppl": round(final_val_ppl, 2),
            "duration_s": round(duration, 2),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
    }
    torch.save(save_dict, out_weights)
    with open(out_config, "w", encoding="utf-8") as f:
        json.dump(cand_cfg, f, indent=2)
    tokenizer.save(out_checkpoint)

    sha = get_file_sha256(out_weights)
    print(f"[{candidate_name}] Saved checkpoint to {out_checkpoint} (SHA-256: {sha})")

    return {
        "name": candidate_name,
        "checkpoint_dir": out_checkpoint,
        "weights_sha256": sha,
        "initial_val_loss": round(init_val_loss, 4),
        "final_val_loss": round(final_val_loss, 4),
        "final_val_ppl": round(final_val_ppl, 2),
        "duration_s": round(duration, 2),
        "steps": total_steps,
        "peak_lr": peak_lr,
    }


# =========================================================================
# 4. MASTER EXPERIMENT ORCHESTRATOR
# =========================================================================

def run_all_mixing_experiments() -> Dict[str, Any]:
    print("=" * 80)
    print("STARTING REPLAY-BUFFERED CONTINUED PRETRAINING & RECOVERY EXPERIMENTS")
    print("=" * 80)

    base_checkpoint = "data/neural_models/checkpoints/vision-v1.4-calibrated-local"
    assert os.path.exists(base_checkpoint), f"Base checkpoint not found at {base_checkpoint}"

    # Verify Base Checkpoint SHA-256
    base_sha = get_file_sha256(os.path.join(base_checkpoint, "weights.pt"))
    print(f"\n[Integrity] Base Checkpoint SHA-256: {base_sha}")
    assert base_sha == "5575077916210c168e462b27deed5a1c08101b05aad94f7809b188a579a4caea", "Base checkpoint was modified!"

    tok = JarvisBPE.load(base_checkpoint)
    with open(os.path.join(base_checkpoint, "config.json"), "r", encoding="utf-8") as f:
        cfg = JarvisConfig(**json.load(f))

    # 1. Load Datasets
    print("\n[Step 1] Loading and Auditing Component Datasets...")
    replay_pool = load_audited_replay_samples(max_samples=400, seed=42)
    reasoning_pool = build_reasoning_curriculum(seed=2026)

    # Contamination Check on Combined Pools
    all_canaries = V14_BENCHMARK_CANARIES + V13_BENCHMARK_CANARIES
    assert_clean_held_out(replay_pool, all_canaries)
    assert_clean_held_out(reasoning_pool, all_canaries)
    print(f"[Canary Check] Passed! Zero leaks across all {len(all_canaries)} evaluation canaries.")

    # 2. Candidate Specifications
    candidate_specs = [
        {
            "name": "vision-v1.4-replay-cand-a",
            "label": "Candidate A (70% Replay / 30% Reasoning)",
            "replay_ratio": 0.70,
            "dir": "data/neural_models/checkpoints/vision-v1.4-replay-cand-a"
        },
        {
            "name": "vision-v1.4-replay-cand-b",
            "label": "Candidate B (50% Replay / 50% Reasoning)",
            "replay_ratio": 0.50,
            "dir": "data/neural_models/checkpoints/vision-v1.4-replay-cand-b"
        },
        {
            "name": "vision-v1.4-replay-cand-c",
            "label": "Candidate C (80% Replay / 20% Reasoning)",
            "replay_ratio": 0.80,
            "dir": "data/neural_models/checkpoints/vision-v1.4-replay-cand-c"
        }
    ]

    training_results = []
    eval_results = {}

    # 3. Train Candidates
    print("\n[Step 2] Executing Controlled Candidate Training (Conservative LR = 1.2e-5)...")
    for spec in candidate_specs:
        mixed_data = build_mixed_dataset(
            replay_pool=replay_pool,
            reasoning_pool=reasoning_pool,
            replay_ratio=spec["replay_ratio"],
            total_size=350,
            seed=42
        )
        print(f"\nAssembled dataset for {spec['label']}: {len(mixed_data)} samples.")

        t_res = train_candidate(
            candidate_name=spec["name"],
            mixed_items=mixed_data,
            base_checkpoint=base_checkpoint,
            out_checkpoint=spec["dir"],
            tokenizer=tok,
            config=cfg,
            total_steps=80,
            peak_lr=1.2e-5,
            min_lr=1.2e-6,
            warmup_steps=10,
            batch_size=2,
            grad_accum_steps=4
        )
        training_results.append(t_res)

    # 4. Evaluate Baseline and All Candidates on 64-Probe Benchmark
    print("\n" + "=" * 80)
    print("[Step 3] Executing Independent 64-Probe Held-Out Benchmark Across All Models...")
    print("=" * 80)

    # Baseline v1.4
    print("\nEvaluating Baseline: vision-v1.4-calibrated-local...")
    base_eval = run_v14_evaluation(
        checkpoint_dir=base_checkpoint,
        quiet=True
    )
    eval_results["baseline_v14"] = base_eval
    print(f"  -> Baseline Score: {base_eval['passed_probes']}/{base_eval['total_probes']} ({base_eval['overall_pass_rate']}%)")

    # Rejected Candidate (for comparison)
    rejected_dir = "data/neural_models/checkpoints/vision-v1.4-reasoning-candidate"
    if os.path.exists(rejected_dir):
        print("\nEvaluating Prior Rejected Candidate: vision-v1.4-reasoning-candidate...")
        rej_eval = run_v14_evaluation(checkpoint_dir=rejected_dir, quiet=True)
        eval_results["rejected_reasoning_candidate"] = rej_eval
        print(f"  -> Rejected Reasoning Score: {rej_eval['passed_probes']}/{rej_eval['total_probes']} ({rej_eval['overall_pass_rate']}%)")

    # Evaluate Each Replay Candidate
    for spec in candidate_specs:
        print(f"\nEvaluating {spec['label']} ({spec['dir']})...")
        c_eval = run_v14_evaluation(checkpoint_dir=spec["dir"], quiet=True)
        eval_results[spec["name"]] = c_eval
        print(f"  -> {spec['name']} Score: {c_eval['passed_probes']}/{c_eval['total_probes']} ({c_eval['overall_pass_rate']}%)")

    # 5. Synthesize Comparative Matrix
    print("\n" + "=" * 80)
    print("FINAL HEAD-TO-HEAD BENCHMARK MATRIX")
    print("=" * 80)
    categories = list(base_eval["category_pass_rates"].keys())
    
    print(f"{'Category':32s} | {'Base v1.4':9s} | {'Rejected':9s} | {'Cand A (70/30)':14s} | {'Cand B (50/50)':14s} | {'Cand C (80/20)':14s}")
    print("-" * 105)
    for cat in categories:
        b_p = base_eval["category_pass_rates"].get(cat, 0.0)
        r_p = eval_results.get("rejected_reasoning_candidate", {}).get("category_pass_rates", {}).get(cat, 0.0)
        a_p = eval_results.get("vision-v1.4-replay-cand-a", {}).get("category_pass_rates", {}).get(cat, 0.0)
        b_val = eval_results.get("vision-v1.4-replay-cand-b", {}).get("category_pass_rates", {}).get(cat, 0.0)
        c_p = eval_results.get("vision-v1.4-replay-cand-c", {}).get("category_pass_rates", {}).get(cat, 0.0)
        print(f"{cat:32s} | {b_p:8.1f}% | {r_p:8.1f}% | {a_p:13.1f}% | {b_val:13.1f}% | {c_p:13.1f}%")

    print("-" * 105)
    print(f"{'TOTAL PASSED':32s} | {base_eval['passed_probes']:2d}/64      | {eval_results.get('rejected_reasoning_candidate',{}).get('passed_probes',0):2d}/64      | {eval_results.get('vision-v1.4-replay-cand-a',{}).get('passed_probes',0):2d}/64           | {eval_results.get('vision-v1.4-replay-cand-b',{}).get('passed_probes',0):2d}/64           | {eval_results.get('vision-v1.4-replay-cand-c',{}).get('passed_probes',0):2d}/64")
    print(f"{'ACCURACY':32s} | {base_eval['overall_pass_rate']:8.1f}% | {eval_results.get('rejected_reasoning_candidate',{}).get('overall_pass_rate',0):8.1f}% | {eval_results.get('vision-v1.4-replay-cand-a',{}).get('overall_pass_rate',0):13.1f}% | {eval_results.get('vision-v1.4-replay-cand-b',{}).get('overall_pass_rate',0):13.1f}% | {eval_results.get('vision-v1.4-replay-cand-c',{}).get('overall_pass_rate',0):13.1f}%")

    # 6. Save Complete Report
    final_report = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "baseline_v14_sha256": base_sha,
        "training_results": training_results,
        "evaluation_summary": {
            "baseline_v14": {
                "passed": base_eval["passed_probes"],
                "total": base_eval["total_probes"],
                "accuracy_pct": base_eval["overall_pass_rate"],
                "categories": base_eval["category_pass_rates"]
            },
            "rejected_reasoning_candidate": {
                "passed": eval_results.get("rejected_reasoning_candidate", {}).get("passed_probes", 0),
                "total": 64,
                "accuracy_pct": eval_results.get("rejected_reasoning_candidate", {}).get("overall_pass_rate", 0),
                "categories": eval_results.get("rejected_reasoning_candidate", {}).get("category_pass_rates", {})
            },
            "candidate_a_70_30": {
                "passed": eval_results.get("vision-v1.4-replay-cand-a", {}).get("passed_probes", 0),
                "total": 64,
                "accuracy_pct": eval_results.get("vision-v1.4-replay-cand-a", {}).get("overall_pass_rate", 0),
                "categories": eval_results.get("vision-v1.4-replay-cand-a", {}).get("category_pass_rates", {})
            },
            "candidate_b_50_50": {
                "passed": eval_results.get("vision-v1.4-replay-cand-b", {}).get("passed_probes", 0),
                "total": 64,
                "accuracy_pct": eval_results.get("vision-v1.4-replay-cand-b", {}).get("overall_pass_rate", 0),
                "categories": eval_results.get("vision-v1.4-replay-cand-b", {}).get("category_pass_rates", {})
            },
            "candidate_c_80_20": {
                "passed": eval_results.get("vision-v1.4-replay-cand-c", {}).get("passed_probes", 0),
                "total": 64,
                "accuracy_pct": eval_results.get("vision-v1.4-replay-cand-c", {}).get("overall_pass_rate", 0),
                "categories": eval_results.get("vision-v1.4-replay-cand-c", {}).get("category_pass_rates", {})
            }
        }
    }

    report_path = "data/learning/replay_mixing_experiments_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(final_report, f, indent=2)

    print(f"\n[Done] Full experiment results saved to: {report_path}")
    return final_report


if __name__ == "__main__":
    run_all_mixing_experiments()
