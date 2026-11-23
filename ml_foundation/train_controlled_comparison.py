"""
VISION CONTROLLED ARCHITECTURE & SCALING BENCHMARK
(`ml_foundation/train_controlled_comparison.py`)

Conducts rigorous, controlled empirical comparison across model scales:
- 13.33M model (vision-13m-curriculum-breakthrough)
- 27.76M model (vision-25m-compact-foundation)
- 98.26M model (vision-100m-stage4-curated)

Trained on the balanced, decontaminated 25M-token dataset (vision_25m_balanced)
with exact tracking of:
- Step-by-step training and validation loss
- Gradient norms and parameter update magnitudes (||Δθ|| / ||θ||)
- Non-padding supervised target tokens vs total tokens
- Wall-clock throughput (tok/sec) and memory footprint (RSS MB)
- Periodic checkpoint generation and integrity hashing
"""

from __future__ import annotations

import argparse
import copy
import dataclasses
import hashlib
import json
import math
import os
import sys
import time
from typing import Any, Dict, List, Tuple

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE

DATA_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "datasets", "vision_25m_balanced")
TRAIN_FILE = os.path.join(DATA_DIR, "train.jsonl")
VAL_FILE = os.path.join(DATA_DIR, "val.jsonl")
TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")
CHECKPOINTS_BASE = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints")


def compute_sha256(filepath: str) -> str:
    if not os.path.exists(filepath):
        return "NOT_FOUND"
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


class BalancedStreamDataset(Dataset):
    """Memory-efficient streaming dataset that parses JSONL on the fly."""
    def __init__(self, jsonl_file: str, tokenizer: JarvisBPE, max_seq_len: int = 128, max_samples: int = 10000):
        self.samples = []
        pad_id = tokenizer.pad_id
        asst_id = tokenizer.vocab.get("<assistant>", 6)

        count = 0
        if not os.path.exists(jsonl_file):
            print(f"[WARN] File not found: {jsonl_file}")
            return

        with open(jsonl_file, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                item = json.loads(line)
                text = item.get("text", "")
                if not text:
                    inst = item.get("instruction", "")
                    resp = item.get("response", "")
                    if inst:
                        text = f"<bos><user>{inst}</user><assistant>{resp}</assistant><eos>"
                    else:
                        text = f"<bos>{resp}<eos>"

                tok_ids = tokenizer.encode(text)
                if len(tok_ids) > max_seq_len:
                    tok_ids = tok_ids[:max_seq_len]
                else:
                    tok_ids = tok_ids + [pad_id] * (max_seq_len - len(tok_ids))

                inp = tok_ids[:-1]
                tgt = list(tok_ids[1:])

                # Assistant masking if prompt exists
                if asst_id in inp:
                    asst_pos = inp.index(asst_id)
                    for k in range(asst_pos):
                        tgt[k] = pad_id

                # Count non-padding target tokens
                n_targets = sum(1 for t in tgt if t != pad_id)
                if n_targets > 0:
                    self.samples.append({
                        "input": torch.tensor(inp, dtype=torch.long),
                        "target": torch.tensor(tgt, dtype=torch.long),
                        "pillar": item.get("pillar", "general"),
                        "n_targets": n_targets
                    })
                    count += 1
                    if count >= max_samples:
                        break

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return self.samples[idx]["input"], self.samples[idx]["target"], self.samples[idx]["n_targets"]


def custom_collate(batch):
    inputs = torch.stack([b[0] for b in batch])
    targets = torch.stack([b[1] for b in batch])
    target_counts = [b[2] for b in batch]
    return inputs, targets, sum(target_counts)


def get_model_and_config(model_tier: str, tokenizer: JarvisBPE) -> Tuple[JarvisUnifiedTransformer, JarvisConfig, str]:
    if model_tier == "13m":
        init_dir = os.path.join(CHECKPOINTS_BASE, "vision-13m-curriculum-breakthrough")
        out_dir = os.path.join(CHECKPOINTS_BASE, "vision-13m-scaling-experiment")
        if os.path.exists(os.path.join(init_dir, "config.json")):
            with open(os.path.join(init_dir, "config.json"), "r") as f:
                cfg = JarvisConfig.from_dict(json.load(f))
        else:
            cfg = JarvisConfig(vocab_size=tokenizer.vocab_size, d_model=256, n_layers=8, n_heads=8, n_kv_heads=4, d_ff=768, max_seq_len=128, tie_word_embeddings=True)
        model = JarvisUnifiedTransformer(cfg)
        weights_file = os.path.join(init_dir, "weights.pt")
        if os.path.exists(weights_file):
            print(f"[LOAD] Loading initial 13M weights from {weights_file}")
            model.load_state_dict(torch.load(weights_file, map_location="cpu"), strict=False)

    elif model_tier == "25m":
        out_dir = os.path.join(CHECKPOINTS_BASE, "vision-25m-compact-foundation")
        cfg = JarvisConfig(
            vocab_size=tokenizer.vocab_size,
            d_model=448,
            n_layers=10,
            n_heads=8,
            n_kv_heads=4,
            d_ff=1280,
            max_seq_len=128,
            dropout=0.05,
            tie_word_embeddings=True
        )
        cfg.validate()
        model = JarvisUnifiedTransformer(cfg)
        init_dir = os.path.join(CHECKPOINTS_BASE, "vision-25m-compact-foundation-init")
        if os.path.exists(os.path.join(init_dir, "weights.pt")):
            model.load_state_dict(torch.load(os.path.join(init_dir, "weights.pt"), map_location="cpu"), strict=False)

    elif model_tier == "100m":
        init_dir = os.path.join(CHECKPOINTS_BASE, "vision-100m-stage4-curated")
        out_dir = os.path.join(CHECKPOINTS_BASE, "vision-100m-scaling-experiment")
        if os.path.exists(os.path.join(init_dir, "config.json")):
            with open(os.path.join(init_dir, "config.json"), "r") as f:
                cfg = JarvisConfig.from_dict(json.load(f))
        else:
            cfg = JarvisConfig(vocab_size=tokenizer.vocab_size, d_model=768, n_layers=14, n_heads=12, n_kv_heads=4, d_ff=2048, max_seq_len=128, tie_word_embeddings=True)
        model = JarvisUnifiedTransformer(cfg)
        weights_file = os.path.join(init_dir, "weights.pt")
        if os.path.exists(weights_file):
            print(f"[LOAD] Loading initial 100M weights from {weights_file}")
            model.load_state_dict(torch.load(weights_file, map_location="cpu"), strict=False)
    else:
        raise ValueError(f"Unknown model_tier: {model_tier}")

    os.makedirs(out_dir, exist_ok=True)
    return model, cfg, out_dir


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


import torch.nn.functional as F

def train_model(
    model_tier: str,
    max_steps: int = 150,
    batch_size: int = 16,
    grad_accum_steps: int = 2,
    lr_max: float = 3e-4,
    lr_min: float = 3e-5,
    warmup_steps: int = 15
) -> Dict[str, Any]:
    print(f"\n========================================================")
    print(f"STARTING CONTROLLED TRAINING BENCHMARK: {model_tier.upper()}")
    print(f"========================================================")

    tokenizer = JarvisBPE.load(TOKENIZER_DIR)
    model, cfg, out_dir = get_model_and_config(model_tier, tokenizer)
    model.train()

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Model parameters: Total={total_params:,} ({total_params/1e6:.2f}M), Trainable={trainable_params:,}")

    # Load datasets
    train_dataset = BalancedStreamDataset(TRAIN_FILE, tokenizer, max_seq_len=128, max_samples=8000)
    val_dataset = BalancedStreamDataset(VAL_FILE, tokenizer, max_seq_len=128, max_samples=1000)
    print(f"Loaded train samples: {len(train_dataset):,}, val samples: {len(val_dataset):,}")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, collate_fn=custom_collate, drop_last=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, collate_fn=custom_collate)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr_max, betas=(0.9, 0.95), weight_decay=0.01)

    step = 0
    cumulative_tokens = 0
    cumulative_target_tokens = 0
    telemetry_steps = []
    checkpoint_history = []
    pad_id = tokenizer.pad_id

    # Baseline val loss
    init_val_loss = evaluate_val_loss(model, val_loader)
    print(f"[STEP 0] Baseline Validation Loss: {init_val_loss:.4f}")

    start_train_time = time.time()
    data_iter = iter(train_loader)

    while step < max_steps:
        # Save snapshot of parameters before update to compute update ratio
        prev_params = {n: p.detach().clone() for n, p in model.named_parameters() if p.requires_grad and p.ndim > 1}

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

        # LR schedule: linear warmup + cosine decay
        if step < warmup_steps:
            current_lr = lr_min + (lr_max - lr_min) * (step + 1) / warmup_steps
        else:
            progress = (step - warmup_steps) / max(1, max_steps - warmup_steps)
            current_lr = lr_min + 0.5 * (lr_max - lr_min) * (1.0 + math.cos(math.pi * progress))

        for param_group in optimizer.param_groups:
            param_group["lr"] = current_lr

        grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0).item()
        optimizer.step()

        # Compute parameter update magnitude: ||Δθ|| / ||θ||
        delta_norm_sq = 0.0
        param_norm_sq = 0.0
        for n, p in model.named_parameters():
            if n in prev_params:
                diff = p.detach() - prev_params[n]
                delta_norm_sq += (diff ** 2).sum().item()
                param_norm_sq += (prev_params[n] ** 2).sum().item()
        update_ratio = math.sqrt(delta_norm_sq) / max(math.sqrt(param_norm_sq), 1e-12)

        step_dt = time.time() - step_t0
        tok_s = step_tokens / max(step_dt, 1e-6)

        step += 1
        cumulative_tokens += step_tokens
        cumulative_target_tokens += step_target_tokens

        # Validation check every 25 steps
        cur_val_loss = None
        if step % 25 == 0 or step == max_steps:
            cur_val_loss = evaluate_val_loss(model, val_loader)

        rss = _get_process_rss_mb()

        telemetry_entry = {
            "step": step,
            "train_loss": round(accum_loss, 4),
            "val_loss": round(cur_val_loss, 4) if cur_val_loss is not None else None,
            "grad_norm": round(grad_norm, 4),
            "lr": round(current_lr, 7),
            "update_ratio": round(update_ratio, 6),
            "step_tokens": step_tokens,
            "step_target_tokens": step_target_tokens,
            "cumulative_tokens": cumulative_tokens,
            "cumulative_target_tokens": cumulative_target_tokens,
            "tok_per_sec": round(tok_s, 1),
            "rss_mb": round(rss, 1)
        }
        telemetry_steps.append(telemetry_entry)

        if step % 10 == 0 or step == max_steps:
            val_str = f" | Val Loss: {cur_val_loss:.4f}" if cur_val_loss is not None else ""
            print(f"Step {step:3d}/{max_steps} | Loss: {accum_loss:.4f}{val_str} | GradNorm: {grad_norm:.3f} | "
                  f"Δθ/θ: {update_ratio:.2e} | Speed: {tok_s:5.0f} t/s | RSS: {rss:.0f}MB")

        # Periodic checkpointing
        if step % 25 == 0 or step == max_steps:
            ckpt_path = os.path.join(out_dir, f"weights_step_{step}.pt")
            torch.save(model.state_dict(), ckpt_path)
            # Also save latest weights.pt
            torch.save(model.state_dict(), os.path.join(out_dir, "weights.pt"))
            with open(os.path.join(out_dir, "config.json"), "w") as f:
                json.dump(cfg.to_dict(), f, indent=2)

            ckpt_sha = compute_sha256(ckpt_path)
            checkpoint_history.append({
                "step": step,
                "file": f"weights_step_{step}.pt",
                "sha256": ckpt_sha,
                "train_loss": round(accum_loss, 4),
                "val_loss": round(cur_val_loss if cur_val_loss is not None else accum_loss, 4),
                "cumulative_tokens": cumulative_tokens,
                "cumulative_target_tokens": cumulative_target_tokens
            })

    total_time = time.time() - start_train_time
    final_val_loss = evaluate_val_loss(model, val_loader)

    result = {
        "model_tier": model_tier,
        "total_parameters": total_params,
        "trainable_parameters": trainable_params,
        "total_steps": step,
        "effective_batch_size_seq": batch_size * grad_accum_steps,
        "total_tokens": cumulative_tokens,
        "total_target_tokens": cumulative_target_tokens,
        "training_duration_s": round(total_time, 2),
        "overall_tokens_per_sec": round(cumulative_tokens / max(total_time, 1), 1),
        "initial_val_loss": round(init_val_loss, 4),
        "final_val_loss": round(final_val_loss, 4),
        "val_loss_delta": round(final_val_loss - init_val_loss, 4),
        "checkpoints": checkpoint_history,
        "telemetry": telemetry_steps
    }

    report_path = os.path.join(REPO_ROOT, f"vision_scaling_experiment_{model_tier}_telemetry.json")
    with open(report_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\n[DONE] Experiment for {model_tier.upper()} completed in {total_time:.1f}s.")
    print(f"Initial Val Loss: {init_val_loss:.4f} -> Final Val Loss: {final_val_loss:.4f} (Delta: {final_val_loss - init_val_loss:+.4f})")
    print(f"Results written to: {report_path}")

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tier", choices=["13m", "25m", "100m", "all"], default="25m")
    parser.add_argument("--steps", type=int, default=150)
    args = parser.parse_args()

    if args.tier == "all":
        results = {}
        for t in ["13m", "25m", "100m"]:
            results[t] = train_model(t, max_steps=args.steps)
        master_out = os.path.join(REPO_ROOT, "vision_controlled_comparison_all_tiers.json")
        with open(master_out, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\n[MASTER DONE] All tiers finished and saved to {master_out}")
    else:
        train_model(args.tier, max_steps=args.steps)


if __name__ == "__main__":
    main()
