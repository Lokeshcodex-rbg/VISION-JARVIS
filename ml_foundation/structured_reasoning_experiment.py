"""
VISION — Structured Reasoning, Arithmetic Precision & Generalization Experiment
ml_foundation/structured_reasoning_experiment.py

Orchestrates:
1. Candidate B (`vision-v1.4-replay-cand-b`) as experimental initialization.
2. 50/50 Replay-buffered dataset with verifiable structured arithmetic, formal logic, and Java signature binding.
3. Zero-Contamination canary audit across all 104 canaries.
4. Controlled training of Candidate D (`vision-v1.4-structured-cand-d`).
5. Dual Evaluation:
   - Standard 64-probe held-out benchmark across 8 domains (v1.4 benchmark).
   - Novel 24-probe template-disjoint Anti-Memorization benchmark.
6. Saves detailed structured report to data/learning/structured_reasoning_experiment_report.json.
"""

from __future__ import annotations

import copy
import datetime
import hashlib
import json
import math
import os
import random
import re
import shutil
import sys
import time
from typing import Dict, List, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
torch.set_num_threads(4)
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.v14_evaluator import V14_BENCHMARK_CANARIES, run_v14_evaluation
from ml_foundation.v13_evaluator import V13_BENCHMARK_CANARIES
from ml_foundation.structured_reasoning_generator import (
    generate_math_curriculum,
    generate_logic_curriculum,
    generate_programming_curriculum,
    run_anti_memorization_evaluation,
    assert_clean_held_out,
)


def get_file_sha256(path: str) -> str:
    if not os.path.exists(path):
        return "MISSING"
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


# =========================================================================
# 1. REPLAY BUFFER LOADER
# =========================================================================

def load_replay_pool(
    corpus_jsonl: str,
    max_samples: int = 240,
    seed: int = 42
) -> List[Dict[str, str]]:
    rng = random.Random(seed)
    domain_buckets: Dict[str, List[Dict[str, str]]] = {
        "science_engineering": [],
        "hindi_devanagari": [],
        "hinglish_dialog": [],
        "general_language_academic": [],
        "tool_use_dialogue": [],
        "coding_python": [],
        "coding_polyglot": [],
        "mathematics_reasoning": []
    }

    lowered_canaries = [c.lower().strip() for c in (V14_BENCHMARK_CANARIES + V13_BENCHMARK_CANARIES) if len(c.strip()) >= 4]

    with open(corpus_jsonl, "r", encoding="utf-8") as f:
        for line in f:
            item = json.loads(line)
            dom = item.get("domain", "")
            if dom not in domain_buckets:
                continue

            inst = str(item.get("instruction", "")).strip()
            resp = str(item.get("response", "")).strip()
            if not inst or not resp:
                continue

            full_text = (inst + " " + resp).lower()
            if any(c in full_text for c in lowered_canaries):
                continue

            domain_buckets[dom].append({
                "instruction": inst,
                "response": resp,
                "domain": dom,
            })

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
# 2. DATASET MIXER & TORCH DATASET
# =========================================================================

class StructuredDataset(Dataset):
    def __init__(self, items: List[Dict[str, str]], tokenizer: JarvisBPE, max_seq_len: int = 256):
        self.samples = []
        bos_id = tokenizer.bos_id if hasattr(tokenizer, "bos_id") else 1
        eos_id = tokenizer.eos_id if hasattr(tokenizer, "eos_id") else 2

        for item in items:
            inst = item.get("instruction") or item.get("prompt", "")
            resp = item.get("response", "")
            text = f"<user>\n{inst}\n</user>\n<assistant>\n{resp}\n</assistant>"
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


# =========================================================================
# 3. TRAINING ENGINE
# =========================================================================

def train_structured_candidate(
    candidate_name: str,
    base_checkpoint: str,
    out_checkpoint: str,
    dataset_samples: List[Dict[str, str]],
    total_steps: int = 100,
    peak_lr: float = 1.0e-5,
    warmup_steps: int = 10,
    batch_size: int = 2,
    grad_accum_steps: int = 4,
    seed: int = 42,
) -> Dict[str, object]:
    torch.manual_seed(seed)
    random.seed(seed)
    torch.set_num_threads(4)

    print("\n" + "=" * 75)
    print(f"TRAINING {candidate_name.upper()} (Target: {out_checkpoint})")
    print("=" * 75)

    tokenizer = JarvisBPE.load(base_checkpoint)
    model, config = JarvisUnifiedTransformer.load_pretrained(base_checkpoint, device="cpu", strict=False)

    rng = random.Random(seed)
    shuffled = list(dataset_samples)
    rng.shuffle(shuffled)
    split_idx = int(len(shuffled) * 0.9)
    train_items = shuffled[:split_idx]
    val_items = shuffled[split_idx:]

    train_ds = StructuredDataset(train_items, tokenizer, max_seq_len=256)
    val_ds = StructuredDataset(val_items, tokenizer, max_seq_len=256)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=peak_lr,
        betas=(0.9, 0.98),
        eps=1e-8,
        weight_decay=0.01,
    )

    def get_lr(step_num: int) -> float:
        if step_num < warmup_steps:
            return peak_lr * (step_num + 1) / max(1, warmup_steps)
        progress = (step_num - warmup_steps) / max(1, total_steps - warmup_steps)
        min_lr = peak_lr * 0.1
        return min_lr + 0.5 * (peak_lr - min_lr) * (1.0 + math.cos(math.pi * progress))

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
# 4. MASTER EXPERIMENTAL RUNNER
# =========================================================================

def run_structured_reasoning_experiment():
    print("=" * 80)
    print("STARTING STRUCTURED REASONING, ARITHMETIC PRECISION & GENERALIZATION EXPERIMENT")
    print("=" * 80)

    base_checkpoint = "data/neural_models/checkpoints/vision-v1.4-calibrated-local"
    cand_b_checkpoint = "data/neural_models/checkpoints/vision-v1.4-replay-cand-b"
    corpus_jsonl = "data/neural_models/datasets/expanded_corpus/train.jsonl"

    base_sha = get_file_sha256(os.path.join(base_checkpoint, "weights.pt"))
    cand_b_sha = get_file_sha256(os.path.join(cand_b_checkpoint, "weights.pt"))
    print(f"[Integrity] Baseline v1.4 SHA-256:   {base_sha}")
    print(f"[Integrity] Candidate B SHA-256:     {cand_b_sha}")

    # 1. Assemble Replay Buffer (200 samples)
    replay_pool = load_replay_pool(corpus_jsonl, max_samples=200, seed=42)

    # 2. Assemble Structured Reasoning Curriculum (200 samples)
    print("\n[Step 1] Assembling Structured Verifiable Reasoning Curriculum...")
    math_samples = generate_math_curriculum(num_samples=120, seed=42)
    logic_samples = generate_logic_curriculum(num_samples=40, seed=43)
    prog_samples = generate_programming_curriculum(num_samples=40, seed=44)

    structured_pool = math_samples + logic_samples + prog_samples
    print(f"  - Verifiable Mathematics Samples:  {len(math_samples)}")
    print(f"  - Structured Formal Logic Samples: {len(logic_samples)}")
    print(f"  - Java & Polyglot Program Samples: {len(prog_samples)}")
    print(f"  Total Structured Pool:             {len(structured_pool)}")

    # Verify zero canary contamination across both pools
    all_combined = replay_pool + structured_pool
    print(f"\n[Canary Check] Verifying {len(all_combined)} total training samples across 104 canaries...")
    for s in all_combined:
        t_inst = s.get("instruction") or s.get("prompt", "")
        t_resp = s.get("response", "")
        assert_clean_held_out(t_inst, "training inst")
        assert_clean_held_out(t_resp, "training resp")
    print("[Canary Check] Passed! Zero leaks detected across all 104 evaluation canaries.")

    # 3. Train Candidate E (Initialized from Candidate B)
    out_dir_e = "data/neural_models/checkpoints/vision-v1.4-precision-cand-e"
    training_meta = train_structured_candidate(
        candidate_name="vision-v1.4-precision-cand-e",
        base_checkpoint=cand_b_checkpoint,
        out_checkpoint=out_dir_e,
        dataset_samples=all_combined,
        total_steps=120,
        peak_lr=1.0e-5,
        warmup_steps=12,
        batch_size=2,
        grad_accum_steps=4,
        seed=42,
    )

    # 4. Standard 64-Probe Held-Out Evaluation (Baseline vs Candidate B vs Candidate D vs Candidate E)
    print("\n" + "=" * 80)
    print("[Step 2] Executing Independent 64-Probe Held-Out Benchmark Across All Models...")
    print("=" * 80)

    print("\nEvaluating Baseline v1.4 (vision-v1.4-calibrated-local)...")
    eval_base = run_v14_evaluation(base_checkpoint, quiet=True)
    print(f"  -> Baseline v1.4 Score: {eval_base['passed_probes']}/{eval_base['total_probes']} ({eval_base['overall_pass_rate']}%)")

    print("\nEvaluating Candidate B (vision-v1.4-replay-cand-b)...")
    eval_cand_b = run_v14_evaluation(cand_b_checkpoint, quiet=True)
    print(f"  -> Candidate B Score: {eval_cand_b['passed_probes']}/{eval_cand_b['total_probes']} ({eval_cand_b['overall_pass_rate']}%)")

    out_dir_d = "data/neural_models/checkpoints/vision-v1.4-structured-cand-d"
    eval_cand_d = None
    if os.path.exists(out_dir_d):
        print("\nEvaluating Candidate D (vision-v1.4-structured-cand-d)...")
        eval_cand_d = run_v14_evaluation(out_dir_d, quiet=True)
        print(f"  -> Candidate D Score: {eval_cand_d['passed_probes']}/{eval_cand_d['total_probes']} ({eval_cand_d['overall_pass_rate']}%)")

    print("\nEvaluating Candidate E (vision-v1.4-precision-cand-e)...")
    eval_cand_e = run_v14_evaluation(out_dir_e, quiet=True)
    print(f"  -> Candidate E Score: {eval_cand_e['passed_probes']}/{eval_cand_e['total_probes']} ({eval_cand_e['overall_pass_rate']}%)")

    # 5. Template-Disjoint Anti-Memorization Benchmark Evaluation
    print("\n" + "=" * 80)
    print("[Step 3] Executing 24-Probe Template-Disjoint Anti-Memorization Benchmark...")
    print("=" * 80)

    tok_e = JarvisBPE.load(out_dir_e)
    m_base, _ = JarvisUnifiedTransformer.load_pretrained(base_checkpoint, device="cpu", strict=False)
    m_cand_b, _ = JarvisUnifiedTransformer.load_pretrained(cand_b_checkpoint, device="cpu", strict=False)
    m_cand_e, _ = JarvisUnifiedTransformer.load_pretrained(out_dir_e, device="cpu", strict=False)

    print("Running Anti-Memorization Evaluation on Baseline v1.4...")
    am_base = run_anti_memorization_evaluation(m_base, tok_e, quiet=True)
    print(f"  -> Baseline v1.4 AM Score: {am_base['passed_probes']}/{am_base['total_probes']} ({am_base['overall_pass_rate']}%)")

    print("Running Anti-Memorization Evaluation on Candidate B...")
    am_cand_b = run_anti_memorization_evaluation(m_cand_b, tok_e, quiet=True)
    print(f"  -> Candidate B AM Score: {am_cand_b['passed_probes']}/{am_cand_b['total_probes']} ({am_cand_b['overall_pass_rate']}%)")

    am_cand_d = None
    if os.path.exists(out_dir_d):
        m_cand_d, _ = JarvisUnifiedTransformer.load_pretrained(out_dir_d, device="cpu", strict=False)
        am_cand_d = run_anti_memorization_evaluation(m_cand_d, tok_e, quiet=True)
        print(f"  -> Candidate D AM Score: {am_cand_d['passed_probes']}/{am_cand_d['total_probes']} ({am_cand_d['overall_pass_rate']}%)")

    print("Running Anti-Memorization Evaluation on Candidate E...")
    am_cand_e = run_anti_memorization_evaluation(m_cand_e, tok_e, quiet=True)
    print(f"  -> Candidate E AM Score: {am_cand_e['passed_probes']}/{am_cand_e['total_probes']} ({am_cand_e['overall_pass_rate']}%)")

    # 6. Comparative Presentation Matrices
    print("\n" + "=" * 80)
    print("COMPARATIVE 64-PROBE HELD-OUT BENCHMARK MATRIX")
    print("=" * 80)
    print(f"{'Category':30s} | {'Base v1.4':9s} | {'Cand B':9s} | {'Cand D':9s} | {'Cand E (Precision)':19s}")
    print("-" * 88)
    for cat in eval_base["category_pass_rates"].keys():
        b_p = eval_base["category_pass_rates"].get(cat, 0.0)
        cb_p = eval_cand_b["category_pass_rates"].get(cat, 0.0)
        cd_p = eval_cand_d["category_pass_rates"].get(cat, 0.0) if eval_cand_d else 0.0
        ce_p = eval_cand_e["category_pass_rates"].get(cat, 0.0)
        print(f"{cat:30s} | {b_p:8.1f}% | {cb_p:8.1f}% | {cd_p:8.1f}% | {ce_p:18.1f}%")
    print("-" * 88)
    print(f"{'TOTAL PASSED':30s} | {eval_base['passed_probes']:2d}/64      | {eval_cand_b['passed_probes']:2d}/64      | {(eval_cand_d['passed_probes'] if eval_cand_d else 0):2d}/64      | {eval_cand_e['passed_probes']:2d}/64")
    print(f"{'ACCURACY':30s} | {eval_base['overall_pass_rate']:8.1f}% | {eval_cand_b['overall_pass_rate']:8.1f}% | {(eval_cand_d['overall_pass_rate'] if eval_cand_d else 0):8.1f}% | {eval_cand_e['overall_pass_rate']:18.1f}%")

    print("\n" + "=" * 80)
    print("COMPARATIVE 24-PROBE ANTI-MEMORIZATION MATRIX")
    print("=" * 80)
    print(f"{'Category':22s} | {'Base v1.4':9s} | {'Cand B':9s} | {'Cand D':9s} | {'Cand E (Precision)':19s}")
    print("-" * 80)
    for cat in ["am_math", "am_logic", "am_code"]:
        b_p = am_base["category_pass_rates"].get(cat, 0.0)
        cb_p = am_cand_b["category_pass_rates"].get(cat, 0.0)
        cd_p = am_cand_d["category_pass_rates"].get(cat, 0.0) if am_cand_d else 0.0
        ce_p = am_cand_e["category_pass_rates"].get(cat, 0.0)
        print(f"{cat:22s} | {b_p:8.1f}% | {cb_p:8.1f}% | {cd_p:8.1f}% | {ce_p:18.1f}%")
    print("-" * 80)
    print(f"{'TOTAL PASSED':22s} | {am_base['passed_probes']:2d}/24      | {am_cand_b['passed_probes']:2d}/24      | {(am_cand_d['passed_probes'] if am_cand_d else 0):2d}/24      | {am_cand_e['passed_probes']:2d}/24")
    print(f"{'ACCURACY':22s} | {am_base['overall_pass_rate']:8.1f}% | {am_cand_b['overall_pass_rate']:8.1f}% | {(am_cand_d['overall_pass_rate'] if am_cand_d else 0):8.1f}% | {am_cand_e['overall_pass_rate']:18.1f}%")

    # 7. Save Comprehensive Report
    report = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "baseline_v14_sha256": base_sha,
        "candidate_b_sha256": cand_b_sha,
        "candidate_e_training": training_meta,
        "eval_64_probes": {
            "baseline_v14": {
                "passed": eval_base["passed_probes"],
                "total": eval_base["total_probes"],
                "accuracy_pct": eval_base["overall_pass_rate"],
                "categories": eval_base["category_pass_rates"],
            },
            "candidate_b": {
                "passed": eval_cand_b["passed_probes"],
                "total": eval_cand_b["total_probes"],
                "accuracy_pct": eval_cand_b["overall_pass_rate"],
                "categories": eval_cand_b["category_pass_rates"],
            },
            "candidate_d": {
                "passed": eval_cand_d["passed_probes"] if eval_cand_d else 0,
                "total": 64,
                "accuracy_pct": eval_cand_d["overall_pass_rate"] if eval_cand_d else 0.0,
                "categories": eval_cand_d["category_pass_rates"] if eval_cand_d else {},
            },
            "candidate_e_precision": {
                "passed": eval_cand_e["passed_probes"],
                "total": eval_cand_e["total_probes"],
                "accuracy_pct": eval_cand_e["overall_pass_rate"],
                "categories": eval_cand_e["category_pass_rates"],
            },
        },
        "anti_memorization_24_probes": {
            "baseline_v14": {
                "passed": am_base["passed_probes"],
                "total": am_base["total_probes"],
                "accuracy_pct": am_base["overall_pass_rate"],
                "categories": am_base["category_pass_rates"],
            },
            "candidate_b": {
                "passed": am_cand_b["passed_probes"],
                "total": am_cand_b["total_probes"],
                "accuracy_pct": am_cand_b["overall_pass_rate"],
                "categories": am_cand_b["category_pass_rates"],
            },
            "candidate_d": {
                "passed": am_cand_d["passed_probes"] if am_cand_d else 0,
                "total": 24,
                "accuracy_pct": am_cand_d["overall_pass_rate"] if am_cand_d else 0.0,
                "categories": am_cand_d["category_pass_rates"] if am_cand_d else {},
            },
            "candidate_e_precision": {
                "passed": am_cand_e["passed_probes"],
                "total": am_cand_e["total_probes"],
                "accuracy_pct": am_cand_e["overall_pass_rate"],
                "categories": am_cand_e["category_pass_rates"],
            },
        },
    }

    report_path = "data/learning/structured_reasoning_experiment_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n[Done] Full experiment results saved to: {report_path}")
    return report

    report_path = "data/learning/structured_reasoning_experiment_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n[Done] Full experiment results saved to: {report_path}")
    return report


if __name__ == "__main__":
    run_structured_reasoning_experiment()
