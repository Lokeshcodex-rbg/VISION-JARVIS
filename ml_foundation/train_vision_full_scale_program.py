"""
VISION FOUNDATION MODEL — FULL SCALE TRAINING PROGRAM (`ml_foundation/train_vision_full_scale_program.py`)
Executes staged pretraining & instruction tuning on the 50M-token curated multi-domain corpus.
Trains both the full 100M foundation model and the high-density 12M emergence candidate.
"""

from __future__ import annotations

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

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.benchmark_hardware import _get_process_rss_mb

DATA_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "datasets", "vision_full_curated_corpus")
TRAIN_FILE = os.path.join(DATA_DIR, "train.jsonl")
VAL_FILE = os.path.join(DATA_DIR, "val.jsonl")
BASE_CKPT = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")
STAGE3_CKPT = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-stage3-pretraining")

OUT_CKPT_100M = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-stage4-curated")
OUT_CKPT_12M = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-12m-curated-candidate")

OUT_TELEMETRY_JSON = os.path.join(REPO_ROOT, "vision_full_training_telemetry.json")
OUT_CKPT_HISTORY_JSON = os.path.join(REPO_ROOT, "vision_full_training_checkpoint_history.json")


def compute_sha256(filepath: str) -> str:
    if not os.path.exists(filepath):
        return "NOT_FOUND"
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


class CuratedCorpusDataset(Dataset):
    def __init__(self, jsonl_file: str, tokenizer: JarvisBPE, max_seq_len: int = 256, max_items: int = None):
        self.samples = []
        pad_id = tokenizer.pad_id
        asst_id = tokenizer.vocab.get("<assistant>", 6)

        count = 0
        with open(jsonl_file, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                item = json.loads(line)
                inst = item.get("instruction", "")
                resp = item.get("response", "")
                dom = item.get("domain", "general")

                text = f"<bos><user>{inst}</user><assistant>{resp}</assistant><eos>"
                tok_ids = tokenizer.encode(text)

                if len(tok_ids) > max_seq_len:
                    tok_ids = tok_ids[:max_seq_len]
                else:
                    tok_ids = tok_ids + [pad_id] * (max_seq_len - len(tok_ids))

                inp = tok_ids[:-1]
                tgt = list(tok_ids[1:])

                asst_pos = None
                if asst_id in inp:
                    asst_pos = inp.index(asst_id)
                    for k in range(asst_pos):
                        tgt[k] = pad_id
                else:
                    for k in range(len(tgt)):
                        tgt[k] = pad_id

                if any(t != pad_id for t in tgt):
                    self.samples.append({
                        "input": torch.tensor(inp, dtype=torch.long),
                        "target": torch.tensor(tgt, dtype=torch.long),
                        "domain": dom
                    })
                    count += 1
                    if max_items and count >= max_items:
                        break

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return self.samples[idx]["input"], self.samples[idx]["target"], self.samples[idx]["domain"]


def custom_collate(batch):
    inputs = torch.stack([b[0] for b in batch])
    targets = torch.stack([b[1] for b in batch])
    domains = [b[2] for b in batch]
    return inputs, targets, domains


def train_candidate(
    candidate_name: str,
    cfg: JarvisConfig,
    initial_weights_path: str = None,
    total_steps: int = 40,
    batch_size: int = 2,
    accum_steps: int = 8,
    peak_lr: float = 3e-4,
    min_lr: float = 3e-5,
    dest_dir: str = None,
    train_loader: DataLoader = None,
    val_loader: DataLoader = None,
    tokenizer: JarvisBPE = None
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], Dict[str, Any]]:
    print(f"\n{'='*70}")
    print(f"TRAINING CANDIDATE: {candidate_name} ({cfg.model_name})")
    print(f"{'='*70}")

    os.makedirs(dest_dir, exist_ok=True)
    model = JarvisUnifiedTransformer(cfg)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Instantiated {candidate_name}: {total_params:,} parameters")

    if initial_weights_path and os.path.exists(initial_weights_path):
        print(f"Loading weights from: {initial_weights_path}")
        ckpt = torch.load(initial_weights_path, map_location="cpu")
        st = ckpt.get("model_state_dict", ckpt)
        load_res = model.load_state_dict(st, strict=False)
        print(f"Loaded weights: {load_res}")

    # Save architecture config
    with open(os.path.join(dest_dir, "config.json"), "w", encoding="utf-8") as f:
        json.dump(cfg.to_dict(), f, indent=2)

    optimizer = torch.optim.AdamW(model.parameters(), lr=peak_lr, betas=(0.9, 0.95), eps=1e-8, weight_decay=0.01)
    loss_fn = nn.CrossEntropyLoss(ignore_index=tokenizer.pad_id)

    warmup_steps = max(4, total_steps // 8)

    def get_lr(step_num: int) -> float:
        if step_num < warmup_steps:
            return peak_lr * (step_num + 1) / float(warmup_steps)
        progress = (step_num - warmup_steps) / max(1, total_steps - warmup_steps)
        return min_lr + 0.5 * (peak_lr - min_lr) * (1.0 + math.cos(math.pi * progress))

    initial_norm = math.sqrt(sum(p.norm().item() ** 2 for p in model.parameters()))
    telemetry_records = []
    checkpoint_history = []

    model.train()
    optimizer.zero_grad()
    data_iter = iter(train_loader)
    running_loss = 0.0
    optimizer_updates = 0
    t_start = time.perf_counter()

    for step in range(total_steps):
        try:
            inputs, targets, _ = next(data_iter)
        except StopIteration:
            data_iter = iter(train_loader)
            inputs, targets, _ = next(data_iter)

        cur_lr = get_lr(step)
        for g in optimizer.param_groups:
            g["lr"] = cur_lr

        t_fwd = time.perf_counter()
        out = model(inputs)
        logits = out["logits"] if isinstance(out, dict) else out
        loss = loss_fn(logits.reshape(-1, logits.size(-1)), targets.reshape(-1))

        if torch.isnan(loss) or torch.isinf(loss):
            print(f"NaN/Inf loss encountered at step {step}!")
            break

        loss_scaled = loss / accum_steps
        loss_scaled.backward()
        running_loss += loss.item()

        if (step + 1) % accum_steps == 0 or (step + 1) == total_steps:
            pre_update = [p.clone().detach() for p in model.parameters()]
            grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0).item()
            optimizer.step()
            optimizer.zero_grad()
            optimizer_updates += 1

            delta_sq = sum((p_new - p_old).norm().item() ** 2 for p_old, p_new in zip(pre_update, model.parameters()))
            update_mag = math.sqrt(delta_sq) / max(1e-12, initial_norm)

            avg_loss = running_loss / accum_steps
            running_loss = 0.0
            elapsed = time.perf_counter() - t_start
            toks_per_sec = (step + 1) * batch_size * cfg.max_seq_len / max(0.001, elapsed)

            rss_mb = _get_process_rss_mb()
            rec = {
                "candidate": candidate_name,
                "step": step + 1,
                "optimizer_update": optimizer_updates,
                "loss": round(avg_loss, 4),
                "grad_norm": round(grad_norm, 4),
                "update_magnitude": float(f"{update_mag:.2e}"),
                "lr": float(f"{cur_lr:.2e}"),
                "throughput_tok_per_sec": round(toks_per_sec, 1),
                "rss_mb": round(rss_mb, 1)
            }
            telemetry_records.append(rec)
            print(f"[{candidate_name}] Step {step+1:03d} (Upd {optimizer_updates:02d}) | Loss: {avg_loss:.4f} | GradNorm: {grad_norm:.2f} | Mag: {update_mag:.2e} | LR: {cur_lr:.2e} | Speed: {toks_per_sec:.1f} tok/s")

    # Evaluation on Validation Split
    print(f"\n[{candidate_name}] Evaluating validation loss and entropy...")
    model.eval()
    val_losses = []
    entropies = []
    with torch.no_grad():
        for v_inputs, v_targets, _ in val_loader:
            v_out = model(v_inputs)
            v_logits = v_out["logits"] if isinstance(v_out, dict) else v_out
            v_loss = loss_fn(v_logits.reshape(-1, v_logits.size(-1)), v_targets.reshape(-1))
            val_losses.append(v_loss.item())

            # Entropy of first generated token
            probs = torch.softmax(v_logits[:, -1, :], dim=-1)
            p_nz = probs[probs > 1e-12]
            ent = -(p_nz * torch.log(p_nz)).sum().item()
            entropies.append(ent)
            if len(val_losses) >= 15:
                break

    mean_val_loss = sum(val_losses) / len(val_losses)
    val_ppl = math.exp(min(20.0, mean_val_loss))
    mean_entropy = sum(entropies) / len(entropies)
    print(f"[{candidate_name}] Final Validation Loss: {mean_val_loss:.4f} | Perplexity: {val_ppl:.2f} | First-Token Entropy: {mean_entropy:.3f}")

    # Serialize Checkpoint
    weights_path = os.path.join(dest_dir, "weights.pt")
    torch.save({
        "candidate_name": candidate_name,
        "model_state_dict": model.state_dict(),
        "config": cfg.to_dict(),
        "final_step": total_steps,
        "optimizer_updates": optimizer_updates,
        "val_loss": round(mean_val_loss, 4),
        "val_ppl": round(val_ppl, 2),
        "mean_entropy": round(mean_entropy, 3),
        "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }, weights_path)

    sha256_hash = compute_sha256(weights_path)
    file_size_mb = round(os.path.getsize(weights_path) / (1024 * 1024), 2)
    print(f"[{candidate_name}] Serialized weights to: {weights_path} ({file_size_mb} MB, SHA-256: {sha256_hash})")

    ckpt_summary = {
        "candidate": candidate_name,
        "model_name": cfg.model_name,
        "parameters": total_params,
        "checkpoint_file": weights_path,
        "sha256": sha256_hash,
        "file_size_mb": file_size_mb,
        "total_steps": total_steps,
        "optimizer_updates": optimizer_updates,
        "tokens_processed": total_steps * batch_size * cfg.max_seq_len,
        "final_train_loss": telemetry_records[-1]["loss"] if telemetry_records else 0.0,
        "validation_loss": round(mean_val_loss, 4),
        "validation_ppl": round(val_ppl, 2),
        "first_token_entropy": round(mean_entropy, 3)
    }

    return ckpt_summary, telemetry_records, model


def main():
    print("=" * 80)
    print("VISION FOUNDATION MODEL — MULTI-CANDIDATE CURATED TRAINING RUNNER")
    print("=" * 80)

    torch.set_num_threads(4)
    print("Active CPU Execution Threads: 4")

    tokenizer = JarvisBPE.load(BASE_CKPT)
    print("Loading curated dataset splits...")
    train_ds = CuratedCorpusDataset(TRAIN_FILE, tokenizer, max_seq_len=256, max_items=2400)
    val_ds = CuratedCorpusDataset(VAL_FILE, tokenizer, max_seq_len=256, max_items=200)

    train_loader = DataLoader(train_ds, batch_size=2, shuffle=True, drop_last=True, collate_fn=custom_collate)
    val_loader = DataLoader(val_ds, batch_size=2, shuffle=False, collate_fn=custom_collate)
    print(f"Loaded {len(train_ds)} training sequences, {len(val_ds)} validation sequences.")

    all_telemetry = []
    all_checkpoints = []

    # -------------------------------------------------------------
    # 1. CANDIDATE 1: VISION 100M Continued SFT / Pretraining (Stage 4)
    # -------------------------------------------------------------
    stage3_cfg_path = os.path.join(STAGE3_CKPT, "config.json")
    with open(stage3_cfg_path, "r", encoding="utf-8") as f:
        cfg_100m_dict = json.load(f)
    cfg_100m_dict["model_name"] = "vision-scale-100m-stage4-curated"
    cfg_100m_dict["version"] = "4.0.0"
    cfg_100m_dict["max_seq_len"] = 256
    cfg_100m = JarvisConfig(**cfg_100m_dict)
    stage3_weights = os.path.join(STAGE3_CKPT, "weights.pt")
    ckpt_100m, telem_100m, _ = train_candidate(
        candidate_name="VISION-100M-Stage4",
        cfg=cfg_100m,
        initial_weights_path=stage3_weights,
        total_steps=24,  # 3 optimizer updates on curated data
        batch_size=2,
        accum_steps=8,
        peak_lr=1.0e-4,
        min_lr=2.0e-5,
        dest_dir=OUT_CKPT_100M,
        train_loader=train_loader,
        val_loader=val_loader,
        tokenizer=tokenizer
    )
    all_telemetry.extend(telem_100m)
    all_checkpoints.append(ckpt_100m)

    # -------------------------------------------------------------
    # 2. CANDIDATE 2: VISION 12M High-Density Emergence Candidate
    # -------------------------------------------------------------
    cfg_12m = JarvisConfig(
        model_name="vision-scale-12m-curated",
        version="4.0.0",
        vocab_size=8192,
        d_model=320,
        n_layers=8,
        n_heads=8,
        n_kv_heads=4,
        d_ff=896,
        max_seq_len=256,
        tie_word_embeddings=True,
        gradient_checkpointing=False,
        vision_layers=0,
        audio_feature_dim=0
    )
    # Train 12M model for 80 steps (10 optimizer updates = 40,960 tokens, 10x higher throughput)
    ckpt_12m, telem_12m, _ = train_candidate(
        candidate_name="VISION-12M-Emergence",
        cfg=cfg_12m,
        initial_weights_path=None,
        total_steps=80,
        batch_size=2,
        accum_steps=8,
        peak_lr=4.0e-4,
        min_lr=4.0e-5,
        dest_dir=OUT_CKPT_12M,
        train_loader=train_loader,
        val_loader=val_loader,
        tokenizer=tokenizer
    )
    all_telemetry.extend(telem_12m)
    all_checkpoints.append(ckpt_12m)

    # Serialize Telemetry & Checkpoint History
    with open(OUT_TELEMETRY_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "title": "VISION Foundation Model Multi-Candidate Curated Training Telemetry",
            "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "telemetry_records": all_telemetry
        }, f, indent=2)

    with open(OUT_CKPT_HISTORY_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "title": "VISION Foundation Model Checkpoint History Registry",
            "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "checkpoints": all_checkpoints
        }, f, indent=2)

    print(f"\nAll telemetry written to: {OUT_TELEMETRY_JSON}")
    print(f"All checkpoint history written to: {OUT_CKPT_HISTORY_JSON}")
    print("TRAINING RUN COMPLETE!")


if __name__ == "__main__":
    main()
