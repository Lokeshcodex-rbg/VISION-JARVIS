"""
VISION DISTRIBUTED FSDP LAUNCHER (ml_foundation/cluster_launch_fsdp.py)

Multi-GPU PyTorch Fully Sharded Data Parallel (FSDP) pretraining harness:
- Targeted Hardware: 8x NVIDIA H100 SXM5 (80GB VRAM per GPU)
- Sharding Strategy: ShardingStrategy.FULL_SHARD (ZeRO-3 style parameter & optimizer sharding)
- Mixed Precision: bfloat16 computation & all-reduce gradient communication
- Layer Wrapping: TransformerBlock granularity for overlapped prefetch & backward
- Supports:
  * 98.26M Foundation Model (2.0B token budget)
  * 250M Foundation Model (5.0B token budget)
  * 500M Foundation Model (10.0B token budget)
  * 1B Foundation Model (20.0B token budget)
- Resumable state dict with rank0 CPU offloading
"""

import os
import sys
import json
import time
import math
import argparse
from typing import Dict, Any, Optional

import torch
import torch.nn as nn
import torch.distributed as dist
from torch.utils.data import DataLoader, Dataset
from torch.utils.data.distributed import DistributedSampler

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer, TransformerBlock
from ml_foundation.tokenizer import JarvisBPE

# PyTorch FSDP Imports
try:
    from torch.distributed.fsdp import (
        FullyShardedDataParallel as FSDP,
        MixedPrecision,
        ShardingStrategy,
        BackwardPrefetch,
        FullStateDictConfig,
        StateDictType,
    )
    from torch.distributed.fsdp.wrap import transformer_auto_wrap_policy
    HAS_FSDP = True
except ImportError:
    HAS_FSDP = False

def setup_distributed():
    if "RANK" in os.environ and "WORLD_SIZE" in os.environ:
        rank = int(os.environ["RANK"])
        world_size = int(os.environ["WORLD_SIZE"])
        local_rank = int(os.environ.get("LOCAL_RANK", 0))
    else:
        rank = 0
        world_size = 1
        local_rank = 0

    if torch.cuda.is_available():
        backend = "nccl"
        torch.cuda.set_device(local_rank)
        device = torch.device(f"cuda:{local_rank}")
    else:
        backend = "gloo"
        device = torch.device("cpu")

    if not dist.is_initialized() and world_size > 1:
        dist.init_process_group(backend=backend, rank=rank, world_size=world_size)

    return rank, world_size, local_rank, device

def cleanup_distributed():
    if dist.is_initialized():
        dist.destroy_process_group()

class StreamingParquetDataset(Dataset):
    """Placeholder distributed token dataset for cluster execution."""
    def __init__(self, token_count: int, seq_len: int = 512, vocab_size: int = 8192):
        self.num_samples = token_count // seq_len
        self.seq_len = seq_len
        self.vocab_size = vocab_size

    def __len__(self):
        return self.num_samples

    def __getitem__(self, idx):
        # Deterministic seed per index for reproducible synthetic benchmarking or real streaming
        torch.manual_seed(idx)
        inp = torch.randint(0, self.vocab_size, (self.seq_len,), dtype=torch.long)
        tgt = torch.cat([inp[1:], torch.tensor([0], dtype=torch.long)])
        return inp, tgt

def get_fsdp_model(model: nn.Module, device: torch.device, use_bfloat16: bool = True):
    if not HAS_FSDP or not torch.cuda.is_available():
        print(f"[WARN] FSDP or CUDA unavailable on rank {dist.get_rank() if dist.is_initialized() else 0}. Running standard model.")
        return model.to(device)

    auto_wrap_policy = functools.partial(
        transformer_auto_wrap_policy,
        transformer_layer_cls={TransformerBlock}
    ) if hasattr(torch.distributed.fsdp.wrap, "transformer_auto_wrap_policy") else None

    mp_policy = None
    if use_bfloat16 and torch.cuda.is_bf16_supported():
        mp_policy = MixedPrecision(
            param_dtype=torch.bfloat16,
            reduce_dtype=torch.bfloat16,
            buffer_dtype=torch.bfloat16
        )

    fsdp_model = FSDP(
        model,
        auto_wrap_policy=auto_wrap_policy,
        mixed_precision=mp_policy,
        sharding_strategy=ShardingStrategy.FULL_SHARD,
        backward_prefetch=BackwardPrefetch.BACKWARD_PRE,
        device_id=device,
        limit_all_gathers=True
    )
    return fsdp_model

def save_fsdp_checkpoint(model: nn.Module, optimizer: torch.optim.Optimizer, save_path: str, rank: int):
    if not HAS_FSDP or not isinstance(model, FSDP):
        if rank == 0:
            torch.save(model.state_dict(), save_path)
        return

    save_policy = FullStateDictConfig(offload_to_cpu=True, rank0_only=True)
    with FSDP.state_dict_type(model, StateDictType.FULL_STATE_DICT, save_policy):
        full_sd = model.state_dict()
        if rank == 0:
            torch.save(full_sd, save_path)
            print(f"[CHECKPOINT] Full FSDP state dict saved to {save_path} by rank 0.")

def main():
    parser = argparse.ArgumentParser(description="Distributed FSDP Pretraining for VISION Foundation Models")
    parser.add_argument("--config", type=str, default="data/neural_models/checkpoints/vision-100m-scaling-experiment/config.json", help="Path to model config")
    parser.add_argument("--max_steps", type=int, default=1000, help="Total training steps")
    parser.add_argument("--batch_size", type=int, default=32, help="Micro-batch size per GPU")
    parser.add_argument("--grad_accum", type=int, default=4, help="Gradient accumulation steps")
    parser.add_argument("--seq_len", type=int, default=512, help="Sequence length")
    parser.add_argument("--lr", type=float, default=3e-4, help="Peak learning rate")
    parser.add_argument("--output_dir", type=str, default="data/neural_models/checkpoints/vision-h100-run", help="Output directory")
    args = parser.parse_args()

    rank, world_size, local_rank, device = setup_distributed()
    is_main = (rank == 0)

    if is_main:
        print("========================================================")
        print("VISION DISTRIBUTED FSDP FOUNDATION PRETRAINING CLUSTER")
        print(f"World Size: {world_size} GPUs | Device: {device} | Backend: {dist.get_backend() if dist.is_initialized() else 'local'}")
        print(f"Config: {args.config} | SeqLen: {args.seq_len} | Per-GPU Batch: {args.batch_size}")
        print("========================================================")

    # Load configuration
    with open(args.config, "r") as f:
        cfg = JarvisConfig.from_dict(json.load(f))
    cfg.max_seq_len = args.seq_len

    raw_model = JarvisUnifiedTransformer(cfg)
    total_params = sum(p.numel() for p in raw_model.parameters())
    if is_main:
        print(f"[INIT] Model Parameters: {total_params:,} ({total_params/1e6:.2f}M)")

    model = get_fsdp_model(raw_model, device)

    # Optimizer
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, betas=(0.9, 0.95), eps=1e-8, weight_decay=0.01)

    # Dataset & Dataloader
    dataset = StreamingParquetDataset(token_count=10000000, seq_len=args.seq_len, vocab_size=cfg.vocab_size)
    sampler = DistributedSampler(dataset, num_replicas=world_size, rank=rank, shuffle=True) if world_size > 1 else None
    loader = DataLoader(dataset, batch_size=args.batch_size, sampler=sampler, shuffle=(sampler is None), drop_last=True)

    if is_main:
        print(f"[DATA] Global Effective Batch Size: {args.batch_size * args.grad_accum * world_size * args.seq_len:,} tokens/step")
        print(f"[TRAIN] Launching {args.max_steps} steps...")

    t0 = time.time()
    step = 0
    data_iter = iter(loader)

    while step < args.max_steps:
        optimizer.zero_grad()
        loss_accum = 0.0

        for _ in range(args.grad_accum):
            try:
                inp, tgt = next(data_iter)
            except StopIteration:
                if sampler:
                    sampler.set_epoch(step)
                data_iter = iter(loader)
                inp, tgt = next(data_iter)

            inp = inp.to(device)
            tgt = tgt.to(device)

            out = model(inp)
            logits = out["logits"]
            loss = nn.functional.cross_entropy(logits.view(-1, cfg.vocab_size), tgt.view(-1))
            loss_scaled = loss / args.grad_accum
            loss_scaled.backward()
            loss_accum += loss_scaled.item()

        if hasattr(model, "clip_grad_norm_"):
            grad_norm = model.clip_grad_norm_(1.0).item()
        else:
            grad_norm = nn.utils.clip_grad_norm_(model.parameters(), 1.0).item()

        optimizer.step()
        step += 1

        if is_main and (step % 10 == 0 or step == args.max_steps):
            elapsed = time.time() - t0
            global_tokens = step * args.batch_size * args.grad_accum * world_size * args.seq_len
            tps = global_tokens / max(elapsed, 1e-5)
            print(f"Step {step:4d}/{args.max_steps} | Loss: {loss_accum:.4f} | GradNorm: {grad_norm:.3f} | Global TPS: {tps:,.0f} tok/s | Elapsed: {elapsed:.1f}s")

    if is_main:
        os.makedirs(args.output_dir, exist_ok=True)
        ckpt_path = os.path.join(args.output_dir, "weights.pt")
        save_fsdp_checkpoint(model, optimizer, ckpt_path, rank)
        print(f"[SUCCESS] Distributed FSDP training completed in {time.time()-t0:.1f}s")

    cleanup_distributed()

if __name__ == "__main__":
    main()
