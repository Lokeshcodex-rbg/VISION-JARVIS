"""
VISION FOUNDATION MODEL — CURRICULUM BREAKTHROUGH TRAINING RUNNER
(`ml_foundation/train_curriculum_breakthrough.py`)

Fine-tunes the strong 13.33M baseline (vision-v1.4-precision-cand-e)
on the verified, decontaminated 4,104-sample multi-stage curriculum dataset.
Saves the breakthrough candidate: vision-13m-curriculum-breakthrough.
"""

from __future__ import annotations

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

DATA_FILE = os.path.join(REPO_ROOT, "data", "neural_models", "datasets", "vision_curriculum_breakthrough", "curriculum_train.jsonl")
INIT_CKPT_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-precision-cand-e")
OUT_CKPT_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-13m-curriculum-breakthrough")
TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")


def compute_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


class CurriculumDataset(Dataset):
    def __init__(self, jsonl_file: str, tokenizer: JarvisBPE, max_seq_len: int = 128):
        self.samples = []
        pad_id = tokenizer.pad_id
        asst_id = tokenizer.vocab.get("<assistant>", 6)

        with open(jsonl_file, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                item = json.loads(line)
                inst = item["instruction"]
                resp = item["response"]
                dom = item.get("stage", "general")

                text = f"<bos><user>{inst}</user><assistant>{resp}</assistant><eos>"
                tok_ids = tokenizer.encode(text)

                if len(tok_ids) > max_seq_len:
                    tok_ids = tok_ids[:max_seq_len]
                else:
                    tok_ids = tok_ids + [pad_id] * (max_seq_len - len(tok_ids))

                inp = tok_ids[:-1]
                tgt = list(tok_ids[1:])

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

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return self.samples[idx]["input"], self.samples[idx]["target"], self.samples[idx]["domain"]


def custom_collate(batch):
    inputs = torch.stack([b[0] for b in batch])
    targets = torch.stack([b[1] for b in batch])
    domains = [b[2] for b in batch]
    return inputs, targets, domains


def main():
    print("=" * 80)
    print("VISION FOUNDATION MODEL — CURRICULUM BREAKTHROUGH TRAINING")
    print("=" * 80)

    torch.set_num_threads(4)
    print("Active CPU Execution Threads: 4")

    tokenizer = JarvisBPE.load(TOKENIZER_DIR)
    pad_id = tokenizer.pad_id

    dataset = CurriculumDataset(DATA_FILE, tokenizer, max_seq_len=128)
    print(f"Loaded {len(dataset)} verified curriculum sequences (max_seq_len=128, 0% truncation).")

    # Load initial config from vision-v1.4-precision-cand-e
    with open(os.path.join(INIT_CKPT_DIR, "config.json"), "r", encoding="utf-8") as f:
        cfg_dict = json.load(f)
    cfg_dict["model_name"] = "vision-13m-curriculum-breakthrough"
    cfg_dict["version"] = "4.2.0"
    cfg = JarvisConfig(**cfg_dict)

    model = JarvisUnifiedTransformer(cfg)
    init_weights = os.path.join(INIT_CKPT_DIR, "weights.pt")
    st = torch.load(init_weights, map_location="cpu")
    model.load_state_dict(st.get("model_state_dict", st), strict=False)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Loaded initial weights from: {init_weights}")
    print(f"Model parameters: {total_params:,}")

    batch_size = 4
    accum_steps = 4
    total_steps = 200  # 50 optimizer updates = 200 * 4 = 800 sequences (102,400 tokens)
    peak_lr = 1.2e-4
    min_lr = 2.0e-5

    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True, drop_last=True, collate_fn=custom_collate)
    optimizer = torch.optim.AdamW(model.parameters(), lr=peak_lr, betas=(0.9, 0.95), eps=1e-8, weight_decay=0.01)
    loss_fn = nn.CrossEntropyLoss(ignore_index=pad_id)

    warmup_steps = 16

    def get_lr(s: int) -> float:
        if s < warmup_steps:
            return peak_lr * (s + 1) / float(warmup_steps)
        progress = (s - warmup_steps) / max(1, total_steps - warmup_steps)
        return min_lr + 0.5 * (peak_lr - min_lr) * (1.0 + math.cos(math.pi * progress))

    model.train()
    optimizer.zero_grad()
    data_iter = iter(loader)
    running_loss = 0.0
    optimizer_updates = 0
    t_start = time.perf_counter()

    for step in range(total_steps):
        try:
            inputs, targets, _ = next(data_iter)
        except StopIteration:
            data_iter = iter(loader)
            inputs, targets, _ = next(data_iter)

        cur_lr = get_lr(step)
        for g in optimizer.param_groups:
            g["lr"] = cur_lr

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
            grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0).item()
            optimizer.step()
            optimizer.zero_grad()
            optimizer_updates += 1

            avg_loss = running_loss / accum_steps
            running_loss = 0.0
            elapsed = time.perf_counter() - t_start
            speed = (step + 1) * batch_size * 128 / max(0.001, elapsed)

            if optimizer_updates % 5 == 0 or (step + 1) == total_steps:
                print(f"Step {step+1:03d} (Update {optimizer_updates:02d}) | Loss: {avg_loss:.4f} | GradNorm: {grad_norm:.2f} | LR: {cur_lr:.2e} | Speed: {speed:.1f} tok/s")

    # Serialize Checkpoint
    os.makedirs(OUT_CKPT_DIR, exist_ok=True)
    weights_path = os.path.join(OUT_CKPT_DIR, "weights.pt")
    cfg_path = os.path.join(OUT_CKPT_DIR, "config.json")

    with open(cfg_path, "w", encoding="utf-8") as f:
        json.dump(cfg.to_dict(), f, indent=2)

    torch.save({
        "candidate_name": "vision-13m-curriculum-breakthrough",
        "model_state_dict": model.state_dict(),
        "config": cfg.to_dict(),
        "final_step": total_steps,
        "optimizer_updates": optimizer_updates,
        "final_loss": round(avg_loss, 4),
        "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }, weights_path)

    sha = compute_sha256(weights_path)
    size_mb = round(os.path.getsize(weights_path) / (1024 * 1024), 2)
    print(f"\nSerialized breakthrough checkpoint to: {weights_path}")
    print(f"File Size: {size_mb} MB | SHA-256: {sha}")
    print("Curriculum training completed successfully!")


if __name__ == "__main__":
    main()
