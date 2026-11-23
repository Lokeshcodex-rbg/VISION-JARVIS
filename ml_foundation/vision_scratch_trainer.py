"""
VISION — QUALITY-FIRST INDEPENDENT AI DEVELOPMENT FROM SCRATCH
ml_foundation/vision_scratch_trainer.py

Implements a 7-stage training pipeline starting from RANDOM WEIGHT INITIALIZATION:
  Stage A: High-quality language pretraining (General text unigram/bigram syntax grounding)
  Stage B: Balanced domain-specific pretraining (Equal distribution across 4 domains)
  Stage C: Supervised instruction tuning (Single-turn isolated QA with -100 prompt masking)
  Stage D: Mathematical & coding improvement (Exact function-name copying, arithmetic derivation)
  Stage E: Reasoning & problem-solving (Physics F=ma, Ohm's law, robotics kinematics & PID)
  Stage F: In-context tool-use & structured output (Selecting from Available tools: [...] with strict JSON)
  Stage G: Independent evaluation & verification (Strict held-out 32-probe suite)
"""

from __future__ import annotations

import copy
import datetime
import json
import math
import os
import random
import re
import sys
import time
from typing import Dict, List, Optional, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

torch.set_num_threads(6)

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.evaluator import evaluate_v12_extended_suite
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.v12_quality_calibration import generate_calibration_dataset, SingleTurnCalibrationDataset


def init_random_weights(model: nn.Module) -> None:
    """Initialize all model weights randomly from scratch using scaled Gaussian initialization."""
    with torch.no_grad():
        for name, p in model.named_parameters():
            if "weight" in name and p.dim() >= 2:
                nn.init.normal_(p, mean=0.0, std=0.02)
            elif "bias" in name:
                nn.init.zeros_(p)
            elif "norm" in name or "scale" in name:
                nn.init.ones_(p)


class MemmapPretrainBatcher:
    """Streams fixed-length contiguous token blocks from disk memmap."""

    def __init__(self, bin_path: str, seq_len: int = 256) -> None:
        self.bin_path = bin_path
        self.seq_len = seq_len
        self.tokens = np.memmap(bin_path, dtype=np.uint32, mode="r")
        self.total_tokens = len(self.tokens)
        self.cursor = 0

    def next_batch(self, batch_size: int) -> Tuple[torch.Tensor, torch.Tensor]:
        block_len = self.seq_len
        inp_list, lbl_list = [], []
        for _ in range(batch_size):
            if self.cursor + block_len + 1 >= self.total_tokens:
                self.cursor = 0
            chunk = self.tokens[self.cursor : self.cursor + block_len + 1].astype(np.int64)
            self.cursor += block_len
            inp = torch.tensor(chunk[:-1], dtype=torch.long)
            lbl = torch.tensor(chunk[1:], dtype=torch.long)
            inp_list.append(inp)
            lbl_list.append(lbl)
        return torch.stack(inp_list), torch.stack(lbl_list)


def run_scratch_training_pipeline(
    output_checkpoint_dir: str = r"D:\Jarvis\data\neural_models\checkpoints\vision-v1.2-scratch-local",
    pretrain_bin: str = r"D:\Jarvis\data\neural_models\shards_v12_quality\pretrain_tokens.bin",
    domain_bin: str = r"D:\Jarvis\data\neural_models\shards_v12_quality\stage2_domain_tokens.bin",
    tokenizer_path: str = r"D:\Jarvis\data\neural_models\shards_v12_quality\tokenizer.json",
    seq_len: int = 256,
    batch_size: int = 2,
    stage_steps: Dict[str, int] = None,
) -> Dict[str, object]:
    """Execute complete 7-stage training from random weights."""
    if stage_steps is None:
        stage_steps = {
            "stage_a_pretrain": 40,
            "stage_b_domain": 40,
            "stage_c_sft": 40,
            "stage_d_math_code": 40,
            "stage_e_reasoning_stem": 30,
            "stage_f_tools_json": 30,
        }

    print("=" * 75)
    print("VISION: QUALITY-FIRST INDEPENDENT AI TRAINING FROM SCRATCH")
    print(f"Destination checkpoint: {output_checkpoint_dir}")
    print(f"Pretrain bin: {pretrain_bin}")
    print(f"Stage steps: {stage_steps}")
    print("=" * 75, flush=True)

    # 1. Load Tokenizer & Configure Model Architecture
    tok = JarvisBPE.load_from_file(tokenizer_path) if hasattr(JarvisBPE, "load_from_file") else JarvisBPE.load(os.path.dirname(tokenizer_path))
    cfg = JarvisConfig.from_dict({
        "model_name": "vision-scratch-7m",
        "version": "vision-v1.2-scratch-local",
        "vocab_size": tok.vocab_size,
        "d_model": 256,
        "n_layers": 6,
        "n_heads": 8,
        "n_kv_heads": 4,
        "d_ff": 768,
        "max_seq_len": seq_len,
        "dropout": 0.05,
        "rope_theta": 10000.0,
        "image_size": 64,
        "patch_size": 8,
        "vision_layers": 3,
        "vision_dim": 192,
        "num_visual_classes": 8,
        "audio_feature_dim": 32,
        "num_audio_classes": 6,
        "tie_word_embeddings": True,
        "use_sdpa": True,
        "gradient_checkpointing": False,
        "qk_norm": True,
    })

    # Initialize with RANDOM weights
    print("[INIT] Instantiating model with RANDOM weights...", flush=True)
    model = JarvisUnifiedTransformer(cfg)
    init_random_weights(model)
    pc = model.parameter_count()
    print(f"[INIT] Parameters: Total={pc['total_parameters']:,} | Language={pc['language_parameters']:,} | Vision={pc['vision_parameters']:,} | Audio={pc['audio_parameters']:,}", flush=True)

    # Prepare datasets
    all_sft_items = generate_calibration_dataset(seed=42)
    sft_datasets = {
        "all": SingleTurnCalibrationDataset(all_sft_items, tok, max_seq_len=seq_len),
        "math_code": SingleTurnCalibrationDataset([x for x in all_sft_items if "math" in x["domain"] or "coding" in x["domain"]], tok, max_seq_len=seq_len),
        "reasoning_stem": SingleTurnCalibrationDataset([x for x in all_sft_items if "science" in x["domain"] or "math" in x["domain"] or "hindi" in x["domain"] or "hinglish" in x["domain"]], tok, max_seq_len=seq_len),
        "tools_json": SingleTurnCalibrationDataset([x for x in all_sft_items if x["domain"] == "tool_calling_json"], tok, max_seq_len=seq_len),
    }

    pretrain_batcher = MemmapPretrainBatcher(pretrain_bin, seq_len=seq_len)
    domain_batcher = MemmapPretrainBatcher(domain_bin if os.path.exists(domain_bin) else pretrain_bin, seq_len=seq_len)

    os.makedirs(output_checkpoint_dir, exist_ok=True)
    start_total_time = time.time()
    stage_metrics: Dict[str, Dict[str, object]] = {}

    # Define stage schedules
    stages = [
        ("stage_a_pretrain", "A: Language Pretraining", pretrain_batcher, 2.5e-4, 8.0e-5),
        ("stage_b_domain", "B: Balanced Domain Training", domain_batcher, 1.8e-4, 5.0e-5),
        ("stage_c_sft", "C: Supervised Instruction Tuning", sft_datasets["all"], 1.2e-4, 4.0e-5),
        ("stage_d_math_code", "D: Mathematical & Coding Tuning", sft_datasets["math_code"], 8.0e-5, 2.5e-5),
        ("stage_e_reasoning_stem", "E: Reasoning & Problem Solving", sft_datasets["reasoning_stem"], 6.0e-5, 2.0e-5),
        ("stage_f_tools_json", "F: Tool Calling & Strict JSON", sft_datasets["tools_json"], 4.5e-5, 1.5e-5),
    ]

    for stage_key, stage_name, data_source, max_lr, min_lr in stages:
        n_steps = stage_steps.get(stage_key, 30)
        print("-" * 75)
        print(f"[{stage_name}] Starting {n_steps} steps (max_lr={max_lr:.2e}, min_lr={min_lr:.2e})...", flush=True)

        optimizer = torch.optim.AdamW(
            [p for p in model.parameters() if p.requires_grad],
            lr=max_lr,
            betas=(0.9, 0.98),
            weight_decay=0.01,
            eps=1e-8,
        )

        stage_losses: List[float] = []
        t0 = time.time()
        dataloader_iter = None
        if isinstance(data_source, Dataset):
            dl = DataLoader(data_source, batch_size=batch_size, shuffle=True, drop_last=True)
            dataloader_iter = iter(dl)

        for s in range(1, n_steps + 1):
            # Cosine learning rate decay
            cur_lr = min_lr + 0.5 * (max_lr - min_lr) * (1.0 + math.cos(math.pi * (s - 1) / max(1, n_steps)))
            for pg in optimizer.param_groups:
                pg["lr"] = cur_lr

            # Fetch batch
            if isinstance(data_source, MemmapPretrainBatcher):
                b_inp, b_lbl = data_source.next_batch(batch_size)
            else:
                try:
                    b_inp, b_lbl = next(dataloader_iter)
                except (StopIteration, TypeError):
                    dataloader_iter = iter(dl)
                    b_inp, b_lbl = next(dataloader_iter)

            optimizer.zero_grad()
            out = model(b_inp, labels=b_lbl)
            loss = out["lm_loss"]

            if loss is not None and not torch.isnan(loss) and not torch.isinf(loss):
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                l_val = float(loss.item())
                stage_losses.append(l_val)

            if s % 10 == 0 or s == n_steps:
                elapsed = time.time() - t0
                avg_l = sum(stage_losses[-10:]) / max(1, len(stage_losses[-10:]))
                tok_s = (s * batch_size * seq_len) / max(0.1, elapsed)
                rss = _get_process_rss_mb()
                print(f"  Step {s:3d}/{n_steps:3d} | Loss: {avg_l:.4f} | LR: {cur_lr:.2e} | {tok_s:.1f} tok/s | RSS: {rss:.1f}MB", flush=True)

        stage_wall = time.time() - t0
        init_l = stage_losses[0] if stage_losses else 0.0
        final_l = sum(stage_losses[-5:]) / max(1, len(stage_losses[-5:]))
        stage_metrics[stage_key] = {
            "stage_name": stage_name,
            "steps": n_steps,
            "initial_loss": round(init_l, 4),
            "final_loss": round(final_l, 4),
            "wall_clock_seconds": round(stage_wall, 2),
            "tok_per_s": round((n_steps * batch_size * seq_len) / max(0.1, stage_wall), 1),
        }

    total_wall = time.time() - start_total_time
    print("=" * 75)
    print(f"ALL 6 TRAINING STAGES COMPLETED FROM SCRATCH IN {total_wall:.1f}s ({total_wall/60:.2f} min)!", flush=True)

    # Save upgraded checkpoint
    save_config = copy.deepcopy(cfg.to_dict()) if hasattr(cfg, "to_dict") else cfg.__dict__
    save_config["version"] = "vision-v1.2-scratch-local"

    save_payload = {
        "model_state_dict": model.state_dict(),
        "config": save_config,
        "stages": stage_metrics,
        "pipeline_meta": {
            "training_mode": "TRAINED_FROM_RANDOM_WEIGHTS_SCRATCH",
            "total_steps": sum(stage_steps.values()),
            "wall_clock_seconds": round(total_wall, 2),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        },
    }

    torch.save(save_payload, os.path.join(output_checkpoint_dir, "weights.pt"))
    tok.save(output_checkpoint_dir)
    with open(os.path.join(output_checkpoint_dir, "config.json"), "w", encoding="utf-8") as f:
        json.dump(save_config, f, indent=2)

    report_data = {
        "version": save_config.get("version"),
        "config": save_config,
        "stages": stage_metrics,
        "pipeline_meta": save_payload["pipeline_meta"],
    }
    with open(os.path.join(output_checkpoint_dir, "training_report.json"), "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    print(f"Saved weights to: {output_checkpoint_dir}", flush=True)

    # Stage G: Independent Evaluation
    print("=" * 75)
    print("STAGE G: RUNNING STRICT HELD-OUT v1.2 BENCHMARK (32 UNCONTAMINATED PROBES)...", flush=True)
    eval_res = evaluate_v12_extended_suite(output_checkpoint_dir)
    print(f"Evaluation passed: {eval_res.get('passed_probes')} / {eval_res.get('total_probes')} ({eval_res.get('accuracy', 0) * 100:.1f}%)", flush=True)
    print(f"Domain breakdown: {json.dumps(eval_res.get('domain_scores'), indent=2)}", flush=True)
    print("=" * 75, flush=True)

    report_data["extended_v12_eval"] = {
        "passed_probes": eval_res.get("passed_probes"),
        "total_probes": eval_res.get("total_probes"),
        "accuracy": eval_res.get("accuracy"),
        "domain_scores": eval_res.get("domain_scores"),
    }
    with open(os.path.join(output_checkpoint_dir, "evaluation_summary.json"), "w", encoding="utf-8") as f:
        json.dump(report_data["extended_v12_eval"], f, indent=2)

    with open(os.path.join(output_checkpoint_dir, "training_report.json"), "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    return report_data


if __name__ == "__main__":
    run_scratch_training_pipeline()
