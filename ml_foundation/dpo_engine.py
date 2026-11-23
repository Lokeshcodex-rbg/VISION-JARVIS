"""
VISION Direct Preference Optimization (DPO) Training Engine
ml_foundation/dpo_engine.py

Mathematical implementation of Direct Preference Optimization (Rafailov et al., 2023):
L_DPO(theta; pi_ref) = -E_{(x, y_w, y_l)} [ log sigma( beta * log(pi_theta(y_w|x) / pi_ref(y_w|x))
                                                      - beta * log(pi_theta(y_l|x) / pi_ref(y_l|x)) ) ]

Features:
1. Frozen Reference Model vs. Trainable Policy Model
2. Response-Only Sequence Log-Probability Computation (prompt tokens masked out with -100)
3. Implicit Reward Calculation: r_hat(x, y) = beta * (log pi_theta(y|x) - log pi_ref(y|x))
4. Dynamic Preference Accuracy Monitoring: P(r_w > r_l)
5. KL Divergence and Implicit Reward Margin Tracking
6. Resumable Checkpoint Management and Hardware Constraints (4 threads, memory safety)
"""

from __future__ import annotations

import argparse
import datetime
import json
import math
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE


class PreferenceDataset(Dataset):
    """Dataset for Direct Preference Optimization (DPO)."""

    def __init__(
        self,
        jsonl_file: str,
        tokenizer: JarvisBPE,
        max_seq_len: int = 256
    ) -> None:
        self.samples: List[Dict[str, torch.Tensor]] = []
        pad_id = tokenizer.pad_id

        with open(jsonl_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                item = json.loads(line)
                prompt = item["prompt"]
                chosen = item["chosen"]
                rejected = item["rejected"]

                prompt_str = f"<bos><user>{prompt}</user><assistant>"
                chosen_str = f"{chosen}</assistant><eos>"
                rejected_str = f"{rejected}</assistant><eos>"

                p_ids = tokenizer.encode(prompt_str, add_bos=False, add_eos=False)
                c_ids = tokenizer.encode(chosen_str, add_bos=False, add_eos=False)
                r_ids = tokenizer.encode(rejected_str, add_bos=False, add_eos=False)

                # Truncate if necessary
                if len(p_ids) + len(c_ids) > max_seq_len:
                    c_ids = c_ids[:max_seq_len - len(p_ids)]
                if len(p_ids) + len(r_ids) > max_seq_len:
                    r_ids = r_ids[:max_seq_len - len(p_ids)]

                # Build Chosen Tensors
                c_total = p_ids + c_ids
                c_inp = torch.full((max_seq_len,), pad_id, dtype=torch.long)
                c_lbl = torch.full((max_seq_len,), -100, dtype=torch.long)
                c_inp[:len(c_total)] = torch.tensor(c_total, dtype=torch.long)
                c_lbl[len(p_ids):len(c_total)] = torch.tensor(c_ids, dtype=torch.long)

                # Build Rejected Tensors
                r_total = p_ids + r_ids
                r_inp = torch.full((max_seq_len,), pad_id, dtype=torch.long)
                r_lbl = torch.full((max_seq_len,), -100, dtype=torch.long)
                r_inp[:len(r_total)] = torch.tensor(r_total, dtype=torch.long)
                r_lbl[len(p_ids):len(r_total)] = torch.tensor(r_ids, dtype=torch.long)

                self.samples.append({
                    "chosen_input": c_inp,
                    "chosen_labels": c_lbl,
                    "rejected_input": r_inp,
                    "rejected_labels": r_lbl,
                    "domain": item.get("domain", "general")
                })

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        return self.samples[idx]


def compute_sequence_log_probs(
    model: JarvisUnifiedTransformer,
    input_ids: torch.Tensor,
    labels: torch.Tensor
) -> torch.Tensor:
    """
    Computes sum of log-probabilities for response tokens (where labels != -100).
    Input shape: (batch_size, seq_len)
    Returns: (batch_size,) sequence log probabilities
    """
    out = model(input_ids=input_ids)
    logits = out["logits"]

    # Shift logits and labels for causal next-token prediction
    shift_logits = logits[:, :-1, :].contiguous()
    shift_labels = labels[:, 1:].contiguous()

    # Mask of valid response tokens
    loss_mask = (shift_labels != -100)

    # Compute log-softmax
    log_probs = F.log_softmax(shift_logits, dim=-1)

    # Replace -100 in labels with 0 for gather, then mask out
    safe_labels = shift_labels.clone()
    safe_labels[~loss_mask] = 0

    per_token_logps = log_probs.gather(dim=-1, index=safe_labels.unsqueeze(-1)).squeeze(-1)
    per_token_logps = per_token_logps * loss_mask

    # Sum across sequence length
    seq_logps = per_token_logps.sum(dim=-1)
    return seq_logps


def dpo_loss_step(
    policy_model: JarvisUnifiedTransformer,
    ref_model: JarvisUnifiedTransformer,
    batch: Dict[str, torch.Tensor],
    beta: float = 0.10,
    device: str = "cpu"
) -> Tuple[torch.Tensor, Dict[str, float]]:
    """Computes DPO loss, implicit rewards, and preference accuracy."""
    c_in = batch["chosen_input"].to(device)
    c_lbl = batch["chosen_labels"].to(device)
    r_in = batch["rejected_input"].to(device)
    r_lbl = batch["rejected_labels"].to(device)

    # 1. Policy model forward pass
    pi_c_logps = compute_sequence_log_probs(policy_model, c_in, c_lbl)
    pi_r_logps = compute_sequence_log_probs(policy_model, r_in, r_lbl)

    # 2. Reference model forward pass (no gradient)
    with torch.no_grad():
        ref_c_logps = compute_sequence_log_probs(ref_model, c_in, c_lbl)
        ref_r_logps = compute_sequence_log_probs(ref_model, r_in, r_lbl)

    # 3. Log-ratio computation: log(pi / ref)
    pi_ref_ratio_c = pi_c_logps - ref_c_logps
    pi_ref_ratio_r = pi_r_logps - ref_r_logps

    # 4. Implicit rewards
    r_chosen = beta * pi_ref_ratio_c
    r_rejected = beta * pi_ref_ratio_r
    reward_margin = r_chosen - r_rejected

    # 5. DPO Loss: -log sigma(beta * [log(pi_w/ref_w) - log(pi_l/ref_l)])
    losses = -F.logsigmoid(reward_margin)
    loss = losses.mean()

    # 6. Evaluation metrics
    with torch.no_grad():
        accuracy = (r_chosen > r_rejected).float().mean().item()
        mean_margin = reward_margin.mean().item()
        mean_r_chosen = r_chosen.mean().item()
        mean_r_rejected = r_rejected.mean().item()
        approx_kl = 0.5 * (pi_ref_ratio_c.mean() + pi_ref_ratio_r.mean()).item()

    metrics = {
        "loss": round(loss.item(), 4),
        "reward_margin": round(mean_margin, 4),
        "preference_accuracy": round(accuracy * 100.0, 2),
        "r_chosen": round(mean_r_chosen, 4),
        "r_rejected": round(mean_r_rejected, 4),
        "approx_kl": round(approx_kl, 4)
    }
    return loss, metrics


def run_dpo_training(
    dataset_dir: str = r"D:\Jarvis\data\neural_models\datasets\preference_dpo",
    base_checkpoint_dir: str = r"D:\Jarvis\data\neural_models\checkpoints\vision-v1.4-calibrated-local",
    out_checkpoint_dir: str = r"D:\Jarvis\data\neural_models\checkpoints\vision-v1.4-dpo-preference",
    total_steps: int = 20,
    batch_size: int = 2,
    lr: float = 5.0e-6,
    beta: float = 0.10,
    seed: int = 42
) -> Dict[str, Any]:
    torch.set_num_threads(4)
    torch.manual_seed(seed)
    start_time = time.time()

    print("=" * 80)
    print("VISION DIRECT PREFERENCE OPTIMIZATION (DPO) HARNESS")
    print(f"Base Checkpoint:   {base_checkpoint_dir}")
    print(f"Output Checkpoint: {out_checkpoint_dir}")
    print(f"DPO Beta:          {beta} | Peak LR: {lr:.2e} | Steps: {total_steps}")
    print("=" * 80)

    tok = JarvisBPE.load(base_checkpoint_dir)
    train_file = os.path.join(dataset_dir, "train.jsonl")
    val_file = os.path.join(dataset_dir, "val.jsonl")

    train_ds = PreferenceDataset(train_file, tok, max_seq_len=256)
    val_ds = PreferenceDataset(val_file, tok, max_seq_len=256)
    print(f"Loaded Preference Datasets: Train = {len(train_ds)} pairs | Val = {len(val_ds)} pairs")

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    train_iter = iter(train_loader)

    # 1. Load Policy and Reference Models
    print("\n--- Loading Policy and Frozen Reference Models ---")
    policy_model, cfg = JarvisUnifiedTransformer.load_pretrained(base_checkpoint_dir, device="cpu", strict=False)
    policy_model.train()

    ref_model, _ = JarvisUnifiedTransformer.load_pretrained(base_checkpoint_dir, device="cpu", strict=False)
    ref_model.eval()
    for p in ref_model.parameters():
        p.requires_grad = False

    # 2. Setup AdamW Optimizer
    optimizer = torch.optim.AdamW(policy_model.parameters(), lr=lr, weight_decay=0.01)

    # 3. Initial Validation Baseline
    print("\nEvaluating Initial Preference Baseline on Validation Set...")
    init_acc_list = []
    init_margins = []
    for val_batch in val_loader:
        _, val_metrics = dpo_loss_step(policy_model, ref_model, val_batch, beta=beta)
        init_acc_list.append(val_metrics["preference_accuracy"])
        init_margins.append(val_metrics["reward_margin"])
    init_val_acc = sum(init_acc_list) / max(1, len(init_acc_list))
    init_val_margin = sum(init_margins) / max(1, len(init_margins))
    print(f"Initial Validation: Accuracy = {init_val_acc:.1f}% | Implicit Margin = {init_val_margin:.4f}")

    # 4. DPO Training Loop
    print(f"\n--- Commencing DPO Policy Alignment (Steps 1 -> {total_steps}) ---")
    step_history: List[Dict[str, Any]] = []

    for step in range(total_steps):
        t0 = time.perf_counter()
        optimizer.zero_grad()

        try:
            batch = next(train_iter)
        except StopIteration:
            train_iter = iter(train_loader)
            batch = next(train_iter)

        loss, metrics = dpo_loss_step(policy_model, ref_model, batch, beta=beta)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(policy_model.parameters(), max_norm=1.0)
        optimizer.step()

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        metrics["step"] = step + 1
        metrics["step_ms"] = round(elapsed_ms, 1)
        metrics["rss_mb"] = round(_get_process_rss_mb(), 1)
        step_history.append(metrics)

        if (step + 1) % 5 == 0 or step == 0 or step == total_steps - 1:
            print(f"Step {step+1:>2}/{total_steps} | Loss: {metrics['loss']:.4f} | Margin: {metrics['reward_margin']:>6.4f} | Acc: {metrics['preference_accuracy']:>5.1f}% | KL: {metrics['approx_kl']:.4f} | RSS: {metrics['rss_mb']} MB")

    # 5. Final Validation Evaluation
    print("\n--- Evaluating Final Aligned Policy on Validation Set ---")
    final_acc_list = []
    final_margins = []
    for val_batch in val_loader:
        _, val_metrics = dpo_loss_step(policy_model, ref_model, val_batch, beta=beta)
        final_acc_list.append(val_metrics["preference_accuracy"])
        final_margins.append(val_metrics["reward_margin"])
    final_val_acc = sum(final_acc_list) / max(1, len(final_acc_list))
    final_val_margin = sum(final_margins) / max(1, len(final_margins))
    print(f"Final Validation: Accuracy = {final_val_acc:.1f}% | Implicit Margin = {final_val_margin:.4f}")

    # 6. Save DPO Checkpoint & Metadata
    os.makedirs(out_checkpoint_dir, exist_ok=True)
    meta = {
        "model_name": cfg.model_name,
        "version": "vision-v1.4-dpo-preference",
        "alignment_type": "Direct Preference Optimization (DPO)",
        "dpo_beta": beta,
        "total_dpo_steps": total_steps,
        "initial_val_acc": round(init_val_acc, 2),
        "final_val_acc": round(final_val_acc, 2),
        "final_reward_margin": round(final_val_margin, 4),
        "saved_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_parameters": policy_model.parameter_count()["total_parameters"]
    }

    # Save weights
    torch.save({
        "config": cfg.to_dict(),
        "model_state_dict": policy_model.state_dict(),
        "metadata": meta
    }, os.path.join(out_checkpoint_dir, "weights.pt"))

    with open(os.path.join(out_checkpoint_dir, "config.json"), "w", encoding="utf-8") as f:
        json.dump(cfg.to_dict(), f, indent=2)

    with open(os.path.join(out_checkpoint_dir, "model_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    tok.save(out_checkpoint_dir)
    print(f"DPO Checkpoint saved to: {out_checkpoint_dir}")

    total_time = time.time() - start_time
    report = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "algorithm": "Direct Preference Optimization (DPO)",
        "hyperparameters": {
            "beta": beta,
            "lr": lr,
            "total_steps": total_steps,
            "batch_size": batch_size
        },
        "initial_metrics": {
            "val_accuracy": round(init_val_acc, 2),
            "val_margin": round(init_val_margin, 4)
        },
        "final_metrics": {
            "val_accuracy": round(final_val_acc, 2),
            "val_margin": round(final_val_margin, 4),
            "train_loss": step_history[-1]["loss"],
            "train_accuracy": step_history[-1]["preference_accuracy"],
            "train_margin": step_history[-1]["reward_margin"]
        },
        "step_history": step_history,
        "duration_sec": round(total_time, 2)
    }

    rep_path = os.path.join(REPO_ROOT, "data", "learning", "dpo_training_report.json")
    with open(rep_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Report saved to: {rep_path}")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VISION DPO Engine")
    parser.add_argument("--steps", type=int, default=15)
    parser.add_argument("--beta", type=float, default=0.10)
    parser.add_argument("--lr", type=float, default=5.0e-6)
    parser.add_argument("--out", type=str, default=r"D:\Jarvis\data\neural_models\checkpoints\vision-v1.4-dpo-preference")
    args = parser.parse_args()

    run_dpo_training(total_steps=args.steps, beta=args.beta, lr=args.lr, out_checkpoint_dir=args.out)
