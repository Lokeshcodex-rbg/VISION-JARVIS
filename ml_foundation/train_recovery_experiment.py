"""
VISION RECOVERY TRAINING EXPERIMENT (ml_foundation/train_recovery_experiment.py)

Executes controlled recovery training on the 13.33M model:
- Initialized from vision-13m-curriculum-breakthrough
- Trained on vision_25m_balanced dataset for 150 optimizer steps
- Effective batch size = 32 (batch_size=16, grad_accum_steps=2)
- CosineAnnealingLR with 15 steps linear warmup
- Tracks step-by-step training loss, validation loss, grad norm, LR,
  parameter update ratio (||Δθ|| / ||θ||), non-padding target tokens,
  tokens/sec, and memory footprint (RSS MB).
- Periodically evaluates independent transfer benchmark (step 0, 50, 100, 150)
  to track transfer dynamics.
- Saves checkpoint to data/neural_models/checkpoints/vision-13m-recovery-experiment/
- Emits VISION_RECOVERY_TRAINING_TELEMETRY.json and VISION_RECOVERY_BENCHMARK_RESULTS.json
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
from torch.utils.data import DataLoader

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.train_controlled_comparison import BalancedStreamDataset, custom_collate
from ml_foundation.evaluate_independent_transfer import evaluate_checkpoint

DATA_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "datasets", "vision_25m_balanced")
TRAIN_FILE = os.path.join(DATA_DIR, "train.jsonl")
VAL_FILE = os.path.join(DATA_DIR, "val.jsonl")
TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")
CHECKPOINTS_BASE = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints")
TRANSFER_TEST_FILE = os.path.join(REPO_ROOT, "vision_independent_transfer_test_200.jsonl")

def compute_sha256(filepath: str) -> str:
    if not os.path.exists(filepath):
        return "NOT_FOUND"
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def evaluate_val_loss(model: nn.Module, val_loader: DataLoader, max_batches: int = 15) -> float:
    model.eval()
    total_loss = 0.0
    total_tokens = 0
    pad_id = 0
    with torch.no_grad():
        for i, (inputs, targets, n_tgt) in enumerate(val_loader):
            if i >= max_batches:
                break
            out = model(inputs)
            logits = out["logits"]
            loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), targets.reshape(-1), ignore_index=pad_id, reduction="sum")
            total_loss += loss.item()
            total_tokens += n_tgt
    model.train()
    return total_loss / max(total_tokens, 1)

def run_recovery_training(
    max_steps: int = 150,
    batch_size: int = 16,
    grad_accum_steps: int = 2,
    lr_max: float = 3e-4,
    lr_min: float = 3e-5,
    warmup_steps: int = 15
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    print("========================================================")
    print("STARTING VISION RECOVERY TRAINING EXPERIMENT (13.33M)")
    print(f"Max Steps: {max_steps} | Effective Batch: {batch_size * grad_accum_steps}")
    print("========================================================")

    tokenizer = JarvisBPE.load(TOKENIZER_DIR)
    init_dir = os.path.join(CHECKPOINTS_BASE, "vision-13m-curriculum-breakthrough")
    out_dir = os.path.join(CHECKPOINTS_BASE, "vision-13m-recovery-experiment")
    os.makedirs(out_dir, exist_ok=True)

    with open(os.path.join(init_dir, "config.json"), "r") as f:
        cfg = JarvisConfig.from_dict(json.load(f))

    model = JarvisUnifiedTransformer(cfg)
    weights_file = os.path.join(init_dir, "weights.pt")
    print(f"[INIT] Loading weights from {weights_file}")
    model.load_state_dict(torch.load(weights_file, map_location="cpu"), strict=False)
    model.train()

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Model parameters: {total_params:,} ({total_params/1e6:.2f}M)")

    # Load streaming dataset
    train_dataset = BalancedStreamDataset(TRAIN_FILE, tokenizer, max_seq_len=128, max_samples=12000)
    val_dataset = BalancedStreamDataset(VAL_FILE, tokenizer, max_seq_len=128, max_samples=1000)
    print(f"Loaded train samples: {len(train_dataset):,}, val samples: {len(val_dataset):,}")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, collate_fn=custom_collate, drop_last=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, collate_fn=custom_collate)

    # Separate parameters for weight decay
    decay_params = [p for n, p in model.named_parameters() if p.requires_grad and p.ndim > 1 and not n.endswith(".bias")]
    nodecay_params = [p for n, p in model.named_parameters() if p.requires_grad and (p.ndim <= 1 or n.endswith(".bias"))]

    optimizer = torch.optim.AdamW([
        {"params": decay_params, "weight_decay": 0.01},
        {"params": nodecay_params, "weight_decay": 0.0}
    ], lr=lr_max, betas=(0.9, 0.95))

    def get_lr(step_idx: int) -> float:
        if step_idx < warmup_steps:
            return lr_min + (lr_max - lr_min) * (step_idx + 1) / warmup_steps
        progress = (step_idx - warmup_steps) / max(1, max_steps - warmup_steps)
        return lr_min + 0.5 * (lr_max - lr_min) * (1.0 + math.cos(math.pi * progress))

    step = 0
    cumulative_tokens = 0
    cumulative_target_tokens = 0
    telemetry_steps = []
    benchmark_history = []
    pad_id = tokenizer.pad_id

    # Baseline evaluation
    init_val_loss = evaluate_val_loss(model, val_loader)
    print(f"[STEP 0] Baseline Validation Loss: {init_val_loss:.4f}")

    # Evaluate baseline transfer benchmark (step 0)
    temp_ckpt_dir = os.path.join(out_dir, "step_000")
    os.makedirs(temp_ckpt_dir, exist_ok=True)
    torch.save(model.state_dict(), os.path.join(temp_ckpt_dir, "weights.pt"))
    with open(os.path.join(temp_ckpt_dir, "config.json"), "w") as f:
        json.dump(cfg.to_dict(), f)
    
    print("[EVAL] Running transfer benchmark at Step 0...")
    eval_0 = evaluate_checkpoint(temp_ckpt_dir, TRANSFER_TEST_FILE, max_probes=200)
    benchmark_history.append({
        "step": 0,
        "accuracy_pct": eval_0["overall_accuracy_pct"],
        "passed_probes": eval_0["passed_probes"],
        "total_probes": eval_0["total_probes"],
        "wilson_ci": [eval_0["wilson_95_ci_lower_pct"], eval_0["wilson_95_ci_upper_pct"]],
        "domain_breakdown": eval_0["domain_breakdown"]
    })

    start_train_time = time.time()
    data_iter = iter(train_loader)

    while step < max_steps:
        # Snapshot weights for parameter update magnitude
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
                inputs, targets, n_tgt = next(data_iter)
            except StopIteration:
                data_iter = iter(train_loader)
                inputs, targets, n_tgt = next(data_iter)

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

        # Compute parameter update magnitude (||Δθ|| / ||θ||)
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

        # Periodic validation loss (every 25 steps)
        curr_val_loss = None
        if step % 25 == 0 or step == max_steps:
            curr_val_loss = round(evaluate_val_loss(model, val_loader), 4)

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

        val_str = f" | Val Loss: {curr_val_loss:.4f}" if curr_val_loss is not None else ""
        print(f"Step {step:3d}/{max_steps} | Loss: {accum_loss:.4f}{val_str} | GradNorm: {grad_norm:.3f} | LR: {curr_lr:.2e} | ||Δθ||/||θ||: {mean_update_ratio:.5f} | TPS: {tps:5.0f} | RSS: {rss_mb:.1f} MB")

        # Periodic transfer benchmark evaluation at step 50, 100, 150
        if step in (50, 100, 150):
            step_ckpt_dir = os.path.join(out_dir, f"step_{step:03d}")
            os.makedirs(step_ckpt_dir, exist_ok=True)
            torch.save(model.state_dict(), os.path.join(step_ckpt_dir, "weights.pt"))
            with open(os.path.join(step_ckpt_dir, "config.json"), "w") as f:
                json.dump(cfg.to_dict(), f)

            print(f"\n[BENCHMARK] Evaluating independent transfer at step {step}...")
            step_eval = evaluate_checkpoint(step_ckpt_dir, TRANSFER_TEST_FILE, max_probes=200)
            benchmark_history.append({
                "step": step,
                "accuracy_pct": step_eval["overall_accuracy_pct"],
                "passed_probes": step_eval["passed_probes"],
                "total_probes": step_eval["total_probes"],
                "wilson_ci": [step_eval["wilson_95_ci_lower_pct"], step_eval["wilson_95_ci_upper_pct"]],
                "domain_breakdown": step_eval["domain_breakdown"]
            })
            model.train()

    total_wall_clock = time.time() - start_train_time
    final_weights_path = os.path.join(out_dir, "weights.pt")
    torch.save(model.state_dict(), final_weights_path)
    final_sha = compute_sha256(final_weights_path)
    with open(os.path.join(out_dir, "config.json"), "w") as f:
        json.dump(cfg.to_dict(), f, indent=2)

    meta = {
        "model_name": "vision-13m-recovery-experiment",
        "total_parameters": total_params,
        "trainable_parameters": trainable_params,
        "total_steps": max_steps,
        "cumulative_tokens": cumulative_tokens,
        "cumulative_target_tokens": cumulative_target_tokens,
        "total_wall_clock_time_sec": round(total_wall_clock, 2),
        "overall_tokens_per_sec": round(cumulative_tokens / max(total_wall_clock, 1), 1),
        "final_weights_sha256": final_sha,
        "final_train_loss": telemetry_steps[-1]["train_loss"],
        "final_val_loss": telemetry_steps[-1]["val_loss"],
        "hardware": "13th Gen Intel Core i5-1335U (12 logical CPUs, local execution, $0.00 cloud cost)"
    }
    with open(os.path.join(out_dir, "metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)

    telemetry_doc = {
        "metadata": meta,
        "telemetry_steps": telemetry_steps
    }

    benchmark_doc = {
        "model": "vision-13m-recovery-experiment",
        "benchmark": "vision_independent_transfer_test_200.jsonl",
        "total_probes": 200,
        "evaluation_progression": benchmark_history,
        "final_checkpoint_sha256": final_sha
    }

    return telemetry_doc, benchmark_doc

if __name__ == "__main__":
    telem, bench = run_recovery_training(max_steps=150, batch_size=16, grad_accum_steps=2)
    
    telem_file = os.path.join(REPO_ROOT, "VISION_RECOVERY_TRAINING_TELEMETRY.json")
    bench_file = os.path.join(REPO_ROOT, "VISION_RECOVERY_BENCHMARK_RESULTS.json")

    with open(telem_file, "w") as f:
        json.dump(telem, f, indent=2)
    with open(bench_file, "w") as f:
        json.dump(bench, f, indent=2)

    print(f"\n[COMPLETE] Telemetry saved to {telem_file}")
    print(f"[COMPLETE] Benchmark results saved to {bench_file}")
