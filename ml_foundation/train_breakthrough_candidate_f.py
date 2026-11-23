"""
VISION AI — Breakthrough Candidate F Pretraining Engine
ml_foundation/train_breakthrough_candidate_f.py

Executes controlled continued pretraining from vision-v1.4-calibrated-local
using the decontaminated 576-pair Breakthrough Training Corpus:
- Multi-step carry arithmetic & structured algebra (130 pairs)
- In-context signature binding for Python, Java, JS (150 pairs)
- Verifiable premise-rule-conclusion formal logic (96 pairs)
- Balanced 8-domain replay buffer (200 pairs)

Saves new checkpoint to:
data/neural_models/checkpoints/vision-v1.4-breakthrough-cand-f/
"""

import os
import sys
import json
import time
import math
import shutil
import hashlib
import datetime
from typing import Dict, Any, List

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.benchmark_hardware import _get_process_rss_mb

BASE_CKPT = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-calibrated-local")
OUT_CKPT = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-breakthrough-cand-f")
CORPUS_FILE = os.path.join(REPO_ROOT, "data", "learning", "breakthrough_training_corpus.json")
MANIFEST_FILE = os.path.join(REPO_ROOT, "data", "learning", "vision_reasoning_training_manifest.json")

class BreakthroughDataset(Dataset):
    def __init__(self, json_file: str, tokenizer: JarvisBPE, max_seq_len: int = 160):
        with open(json_file, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
            
        self.samples = []
        pad_id = tokenizer.pad_id
        
        for item in raw_data:
            p = item["prompt"]
            r = item["response"]
            text = f"<bos><user>{p}</user><assistant>{r}</assistant><eos>"
            tok_ids = tokenizer.encode(text)
            if len(tok_ids) > max_seq_len:
                tok_ids = tok_ids[:max_seq_len]
            else:
                tok_ids = tok_ids + [pad_id] * (max_seq_len - len(tok_ids))
            self.samples.append(torch.tensor(tok_ids, dtype=torch.long))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return self.samples[idx]

def compute_sha256(filepath: str) -> str:
    if not os.path.exists(filepath): return "NOT_FOUND"
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536): h.update(chunk)
    return h.hexdigest()

def main():
    print("=" * 80)
    print("VISION AI — CANDIDATE F BREAKTHROUGH CONTINUED PRETRAINING")
    print("=" * 80)
    
    torch.set_num_threads(2)
    print("Thread configuration: 2 threads (Optimal P-core affinity)")
    
    # 1. Verify baseline hash
    base_weights = os.path.join(BASE_CKPT, "weights.pt")
    base_sha = compute_sha256(base_weights)
    print(f"Base Checkpoint: {BASE_CKPT}")
    print(f"Base SHA-256:    {base_sha}")
    assert base_sha == "5575077916210c168e462b27deed5a1c08101b05aad94f7809b188a579a4caea", "Base hash mismatch!"
    
    # 2. Load tokenizer and model
    tokenizer = JarvisBPE.load(BASE_CKPT)
    model, cfg = JarvisUnifiedTransformer.load_pretrained(BASE_CKPT, device="cpu", strict=False)
    model.train()
    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    # 3. Load dataset
    ds = BreakthroughDataset(CORPUS_FILE, tokenizer, max_seq_len=160)
    loader = DataLoader(ds, batch_size=2, shuffle=True, drop_last=True)
    print(f"Training corpus: {len(ds)} sequences | Batch size: 2 | Accumulation: 8 (Eff batch: 16)")
    
    # 4. Optimizer & scheduler
    peak_lr = 1.0e-5
    min_lr = 1.0e-6
    total_steps = 120
    optimizer = torch.optim.AdamW(model.parameters(), lr=peak_lr, betas=(0.9, 0.95), eps=1e-8, weight_decay=0.1)
    
    def get_lr(step):
        if step < 10:
            return peak_lr * (step + 1) / 10.0
        prog = (step - 10) / max(1, total_steps - 10)
        return min_lr + 0.5 * (peak_lr - min_lr) * (1.0 + math.cos(math.pi * prog))
        
    loss_fn = nn.CrossEntropyLoss(ignore_index=tokenizer.pad_id)
    
    # 5. Training loop
    t0 = time.perf_counter()
    step = 0
    accum_loss = 0.0
    optimizer.zero_grad()
    
    step_history = []
    
    print("\nStarting optimization loop...")
    while step < total_steps:
        for batch in loader:
            lr = get_lr(step)
            for param_group in optimizer.param_groups:
                param_group['lr'] = lr
                
            inputs = batch[:, :-1]
            targets = batch[:, 1:]
            
            out = model(inputs)
            logits = out['logits'] if isinstance(out, dict) else out
            loss = loss_fn(logits.reshape(-1, logits.size(-1)), targets.reshape(-1))
            loss = loss / 8.0 # gradient accumulation
            loss.backward()
            accum_loss += loss.item() * 8.0
            
            if (step + 1) % 8 == 0 or (step + 1) == total_steps:
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                optimizer.zero_grad()
                
            step += 1
            if step % 20 == 0 or step == total_steps:
                cur_loss = round(accum_loss / step, 4)
                cur_ppl = round(math.exp(min(20.0, cur_loss)), 2)
                elapsed = round(time.perf_counter() - t0, 1)
                print(f"  Step {step:3d}/{total_steps} | LR: {lr:.2e} | Loss: {cur_loss:.4f} | PPL: {cur_ppl:.2f} | Elapsed: {elapsed}s")
                step_history.append({"step": step, "lr": lr, "loss": cur_loss, "ppl": cur_ppl})
                
            if step >= total_steps:
                break
                
    total_time_s = round(time.perf_counter() - t0, 2)
    print(f"\nOptimization complete in {total_time_s}s.")
    
    # 6. Save new checkpoint Candidate F
    os.makedirs(OUT_CKPT, exist_ok=True)
    out_weights_path = os.path.join(OUT_CKPT, "weights.pt")
    torch.save(model.state_dict(), out_weights_path)
    
    # Copy tokenizer files & config
    for fname in ["tokenizer.json", "vocab.json", "merges.txt", "config.json"]:
        src = os.path.join(BASE_CKPT, fname)
        dst = os.path.join(OUT_CKPT, fname)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            
    cand_f_sha = compute_sha256(out_weights_path)
    print(f"\n[OK] Checkpoint Candidate F saved to: {OUT_CKPT}")
    print(f"     Weights SHA-256: {cand_f_sha}")
    
    # 7. Write training manifest
    manifest = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "candidate": "vision-v1.4-breakthrough-cand-f",
        "base_model": "vision-v1.4-calibrated-local",
        "base_sha256": base_sha,
        "cand_f_sha256": cand_f_sha,
        "corpus_file": CORPUS_FILE,
        "corpus_samples": len(ds),
        "steps": total_steps,
        "peak_lr": peak_lr,
        "batch_size_effective": 16,
        "duration_seconds": total_time_s,
        "final_loss": step_history[-1]["loss"] if step_history else None,
        "final_ppl": step_history[-1]["ppl"] if step_history else None,
        "step_history": step_history
    }
    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"     Training manifest saved to: {MANIFEST_FILE}")

if __name__ == "__main__":
    main()
