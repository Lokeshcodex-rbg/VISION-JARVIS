"""
VISION — MADE BY LOKESH | Scalable 4-Stage Multimodal Neural Training Pipeline (`ml_foundation/trainer.py`)
Supports:
  - Stage 1: Causal Pretraining via streaming memmap `.bin` token shards
  - Stage 2: Supervised Instruction Fine-Tuning (SFT with prompt loss masking + validation + early stopping)
  - Stage 3: Multimodal Vision + Audio + Text Replay Fusion
  - Stage 4: Direct Preference Optimization (DPO alignment)
  - Full deterministic checkpoint resumption (model, all stage optimizers, scheduler, scaler, RNGs, data cursors)
  - Overfitting & loss-instability detection, BF16/FP16 AMP, SDPA attention, and DDP scaffold
"""

from __future__ import annotations

import copy
import datetime
import hashlib
import json
import math
import os
import random
import signal
import statistics
import threading
import time
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image
import torch
import torch.distributed as dist
import torch.nn.functional as F

from ml_foundation.audio_data import load_audio_feature_tensor
from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.dataset_builder import build_unified_datasets
from ml_foundation.model import (
    JarvisConfig,
    JarvisUnifiedTransformer,
    MODEL_SCALE_PRESETS,
    architecture_tradeoff_summary,
)
from ml_foundation.tokenizer import JarvisBPE


def _cosine_lr_multiplier(step: int, warmup_steps: int, total_steps: int) -> float:
    if total_steps <= 1:
        return 1.0
    if step < warmup_steps and warmup_steps > 0:
        return max(0.1, float(step + 1) / float(warmup_steps))
    progress = min(1.0, max(0.0, float(step - warmup_steps) / float(max(1, total_steps - warmup_steps))))
    return 0.1 + 0.9 * 0.5 * (1.0 + math.cos(math.pi * progress))


def load_image_tensor(image_path: str, image_size: int = 64) -> torch.Tensor:
    img = Image.open(image_path).convert("RGB").resize((image_size, image_size))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return torch.from_numpy(arr).permute(2, 0, 1)


def _read_jsonl(path: str) -> List[Dict[str, object]]:
    rows: List[Dict[str, object]] = []
    if not os.path.exists(path):
        return rows
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _pack_sequences(token_lists: List[List[int]], block_size: int) -> List[List[int]]:
    stream: List[int] = []
    for seq in token_lists:
        if len(seq) >= 2:
            stream.extend(seq)
    if not stream:
        return []
    chunks: List[List[int]] = []
    for start in range(0, len(stream), block_size):
        chunk = stream[start : start + block_size]
        if len(chunk) >= 8:
            chunks.append(chunk)
    return chunks if chunks else [stream[:block_size]]


def _pad_batch(
    sequences: List[List[int]],
    pad_id: int,
    max_len: int,
    label_mask_prefixes: Optional[List[int]] = None,
) -> Tuple[torch.Tensor, torch.Tensor]:
    truncated = [s[:max_len] for s in sequences]
    width = max(2, max(len(s) for s in truncated))
    bsz = len(truncated)
    input_ids = torch.full((bsz, width), pad_id, dtype=torch.long)
    labels = torch.full((bsz, width), -100, dtype=torch.long)
    for i, seq in enumerate(truncated):
        n = len(seq)
        input_ids[i, :n] = torch.tensor(seq, dtype=torch.long)
        labels[i, :n] = torch.tensor(seq, dtype=torch.long)
        if label_mask_prefixes is not None:
            pref = min(n, label_mask_prefixes[i])
            labels[i, :pref] = -100
    return input_ids, labels


def _sequence_log_prob(
    model: JarvisUnifiedTransformer,
    prompt_ids: List[int],
    full_ids: List[int],
    max_len: int,
) -> torch.Tensor:
    device = next(model.parameters()).device
    seq = full_ids[:max_len]
    inp = torch.tensor([seq], dtype=torch.long, device=device)
    out = model(inp)
    logits = out["logits"][0, :-1, :]
    targets = inp[0, 1:]
    log_probs = F.log_softmax(logits, dim=-1)
    token_lp = log_probs.gather(1, targets.unsqueeze(1)).squeeze(1)
    start_idx = max(0, min(len(prompt_ids) - 1, token_lp.size(0) - 1))
    return token_lp[start_idx:].sum()


# ---------------------------------------------------------------------------
# Streaming Binary Memmap Shards (Stage 1 Scalability)
# ---------------------------------------------------------------------------

def write_token_shards(token_docs: List[List[int]], shard_dir: str, prefix: str = "pretrain") -> Dict[str, object]:
    """Serialize packed token stream to contiguous uint32 `.bin` memmap shard + `.meta.json`."""
    os.makedirs(shard_dir, exist_ok=True)
    bin_path = os.path.join(shard_dir, f"{prefix}_tokens.bin")
    meta_path = os.path.join(shard_dir, f"{prefix}_meta.json")
    flat: List[int] = []
    for doc in token_docs:
        if len(doc) >= 2:
            flat.extend(int(t) for t in doc)
    arr = np.asarray(flat, dtype=np.uint32)
    arr.tofile(bin_path)
    meta = {
        "prefix": prefix,
        "dtype": "uint32",
        "total_tokens": int(arr.size),
        "doc_count": len(token_docs),
        "bin_path": bin_path,
        "sha256": hashlib.sha256(arr.tobytes()).hexdigest(),
    }
    with open(meta_path, "w", encoding="utf-8") as mf:
        json.dump(meta, mf, indent=2)
    return meta


def _deterministic_coprime_stride(num_items: int, seed_prime: int = 2654435761) -> int:
    """Return a deterministic stride coprime to `num_items` for full-corpus pseudo-random traversal."""
    if num_items <= 4:
        return 1
    cand = (seed_prime % (num_items - 1)) + 1
    while math.gcd(cand, num_items) != 1:
        cand = (cand + 1) % num_items or 1
    return cand


class StreamingMemmapBatcher:
    """Deterministic cursor-based reader over uint32 memmap token shards."""

    def __init__(
        self,
        bin_path: str,
        total_tokens: int,
        seq_len: int,
        rank: int = 0,
        world_size: int = 1,
        shuffle_windows: bool = True,
    ) -> None:
        self.bin_path = bin_path
        self.total_tokens = int(total_tokens)
        self.seq_len = max(8, int(seq_len))
        self.rank = max(0, int(rank))
        self.world_size = max(1, int(world_size))
        self.mmap = np.memmap(bin_path, dtype=np.uint32, mode="r", shape=(self.total_tokens,)) if self.total_tokens > 0 else None
        self.stride = max(1, self.seq_len // 2)
        self.num_windows = max(1, (max(0, self.total_tokens - self.seq_len) // self.stride) + 1)
        self.window_mult = _deterministic_coprime_stride(self.num_windows) if shuffle_windows else 1

    def next_batch(self, cursor: int, batch_size: int, pad_id: int) -> Tuple[torch.Tensor, torch.Tensor, int]:
        if self.mmap is None or self.total_tokens < 4:
            raise ValueError("Empty memmap token shard")
        eff_len = min(self.seq_len, self.total_tokens)
        seqs: List[List[int]] = []
        cur = int(cursor)
        for _ in range(batch_size):
            raw_idx = cur * self.world_size + self.rank
            win_idx = (raw_idx * self.window_mult) % self.num_windows
            start = (win_idx * self.stride) % max(1, self.total_tokens - eff_len + 1)
            chunk = self.mmap[start : start + eff_len].astype(np.int64).tolist()
            if len(chunk) < eff_len:
                chunk.extend([pad_id] * (eff_len - len(chunk)))
            seqs.append(chunk)
            cur += 1
        inp = torch.tensor(seqs, dtype=torch.long)
        lbl = inp.clone()
        lbl[lbl == pad_id] = -100
        return inp, lbl, cur

    def close(self) -> None:
        if self.mmap is not None:
            try:
                mm = getattr(self.mmap, "_mmap", None)
                if mm is not None:
                    mm.close()
            except Exception:
                pass
            self.mmap = None

    def __del__(self) -> None:
        self.close()


class StreamingSFTMemmapBatcher:
    """Memory-mapped reader over packed Stage-2 SFT `(inputs.bin uint32, labels.bin int32)` fixed-width blocks."""

    def __init__(
        self,
        inp_path: str,
        lbl_path: str,
        num_blocks: int,
        block_size: int,
        rank: int = 0,
        world_size: int = 1,
        shuffle_blocks: bool = True,
        pad_id: int = 0,
    ) -> None:
        self.inp_path = inp_path
        self.lbl_path = lbl_path
        self.num_blocks = max(1, int(num_blocks))
        self.block_size = max(8, int(block_size))
        self.rank = max(0, int(rank))
        self.world_size = max(1, int(world_size))
        self.pad_id = int(pad_id)
        self.inp_mmap = np.memmap(inp_path, dtype=np.uint32, mode="r", shape=(self.num_blocks, self.block_size))
        self.lbl_mmap = np.memmap(lbl_path, dtype=np.int32, mode="r", shape=(self.num_blocks, self.block_size))
        self.block_mult = _deterministic_coprime_stride(self.num_blocks, 2246822519) if shuffle_blocks else 1

    def next_batch(self, cursor: int, batch_size: int, max_seq_len: Optional[int] = None) -> Tuple[torch.Tensor, torch.Tensor, int]:
        eff_w = min(self.block_size, int(max_seq_len)) if max_seq_len else self.block_size
        inps: List[np.ndarray] = []
        lbls: List[np.ndarray] = []
        cur = int(cursor)
        for _ in range(batch_size):
            raw_idx = cur * self.world_size + self.rank
            blk_idx = (raw_idx * self.block_mult) % self.num_blocks
            inps.append(np.asarray(self.inp_mmap[blk_idx, :eff_w], dtype=np.int64))
            lbls.append(np.asarray(self.lbl_mmap[blk_idx, :eff_w], dtype=np.int64))
            cur += 1
        inp_arr = np.stack(inps, axis=0)
        lbl_arr = np.stack(lbls, axis=0)
        active = (inp_arr != self.pad_id) | (lbl_arr != -100)
        if active.any():
            last_col = int(np.where(active.any(axis=0))[0][-1]) + 1
            trim_w = min(eff_w, max(16, ((last_col + 7) // 8) * 8))
            inp_arr = inp_arr[:, :trim_w]
            lbl_arr = lbl_arr[:, :trim_w]
        return torch.from_numpy(inp_arr), torch.from_numpy(lbl_arr), cur

    def close(self) -> None:
        for attr in ("inp_mmap", "lbl_mmap"):
            arr = getattr(self, attr, None)
            if arr is not None:
                try:
                    mm = getattr(arr, "_mmap", None)
                    if mm is not None:
                        mm.close()
                except Exception:
                    pass
                setattr(self, attr, None)

    def __del__(self) -> None:
        self.close()


# ---------------------------------------------------------------------------
# Resource, Memory & Cost Planning Utility (Pre-training Gate)
# ---------------------------------------------------------------------------

def estimate_training_resources(
    preset: str = "jarvis-v0.8-research-52m",
    vocab_size: int = 32768,
    overtrain_multiplier: float = 40.0,
) -> Dict[str, object]:
    """Compute exact parameter count, VRAM/RAM needs, dataset size, runtime & hardware cost BEFORE training."""
    preset_cfg = MODEL_SCALE_PRESETS.get(preset, MODEL_SCALE_PRESETS["jarvis-v0.8-research-52m"])
    cfg = JarvisConfig(
        model_name=preset,
        vocab_size=vocab_size,
        audio_feature_dim=32,
        **preset_cfg,
    )
    cfg.validate()
    with torch.device("meta"):
        meta_model = JarvisUnifiedTransformer(cfg)
    params = meta_model.parameter_count()
    total_p = params["total_parameters"]
    lang_p = params["language_parameters"]
    head_dim = cfg.d_model // cfg.n_heads
    kv_bytes_per_tok_bf16 = 2 * 2 * cfg.n_layers * cfg.n_kv_heads * head_dim

    chinchilla_toks = 20 * lang_p
    target_toks = int(overtrain_multiplier * lang_p)
    flops_chin = 6.0 * lang_p * chinchilla_toks
    flops_target = 6.0 * lang_p * target_toks

    # Memory footprint breakdown: bf16 weights (2B) + fp32 master (4B) + fp32 Adam m,v (8B) + grads (4B) = ~18B/param
    static_adamw_bf16_gb = round((total_p * 18) / (1024 ** 3), 3)
    weights_fp32_gb = round((total_p * 4) / (1024 ** 3), 3)
    weights_bf16_gb = round((total_p * 2) / (1024 ** 3), 3)
    # Approximate activation memory for microbatch=4, seq=cfg.max_seq_len with gradient checkpointing
    est_act_gb = round((4 * cfg.max_seq_len * cfg.d_model * cfg.n_layers * 10 * 2) / (1024 ** 3), 3)

    # Throughput models: H100 (989 TFLOPS bf16 @ 45% MFU), A100 (312 TFLOPS @ 40% MFU), RTX 4090 (165 TFLOPS bf16 @ 40% MFU)
    h100_hrs = flops_target / (989e12 * 0.45 * 3600.0)
    a100_hrs = flops_target / (312e12 * 0.40 * 3600.0)
    rtx4090_hrs = flops_target / (165e12 * 0.40 * 3600.0)
    # Local CPU observed baseline scaled from 6.2M (1,780 tok/s) inversely by param ratio (~200 tok/s for 52M)
    est_cpu_tok_per_s = max(25.0, 1780.0 * (4.95e6 / max(1.0, float(lang_p))))
    local_cpu_hours = target_toks / (est_cpu_tok_per_s * 3600.0)

    return {
        "preset": preset,
        "config": cfg.to_dict(),
        "config_internally_consistent": True,
        "parameters": params,
        "memory_gb": {
            "weights_fp32_gb": weights_fp32_gb,
            "weights_bf16_gb": weights_bf16_gb,
            "adamw_bf16_static_states_gb": static_adamw_bf16_gb,
            "est_activations_micro4_gb": est_act_gb,
            "recommended_min_gpu_vram_gb": math.ceil((static_adamw_bf16_gb + est_act_gb) * 1.35),
            "kv_cache_mb_full_ctx_bf16": round((kv_bytes_per_tok_bf16 * cfg.max_seq_len) / (1024 ** 2), 2),
        },
        "dataset_plan": {
            "chinchilla_20x_tokens": chinchilla_toks,
            "target_overtrain_multiplier": overtrain_multiplier,
            "target_training_tokens": target_toks,
            "approx_raw_utf8_text_gb": round((target_toks * 4.0) / (1024 ** 3), 2),
        },
        "time_and_cost_estimates": {
            "local_cpu_host": {
                "cuda_available": torch.cuda.is_available(),
                "est_tok_per_sec": round(est_cpu_tok_per_s, 1),
                "est_hours_for_target_tokens": round(local_cpu_hours, 1),
                "practical_for_full_run": bool(local_cpu_hours <= 12.0),
            },
            "rtx_4090_single": {
                "est_hours": round(rtx4090_hrs, 2),
                "est_usd_at_0_45_hr": round(rtx4090_hrs * 0.45, 2),
            },
            "a100_80gb_single": {
                "est_hours": round(a100_hrs, 2),
                "est_usd_at_1_40_hr": round(a100_hrs * 1.40, 2),
            },
            "h100_80gb_single": {
                "est_hours": round(h100_hrs, 2),
                "est_usd_at_2_50_hr": round(h100_hrs * 2.50, 2),
            },
        },
    }


def _capture_rng_state(device: torch.device) -> Dict[str, object]:
    state: Dict[str, object] = {
        "torch_rng": torch.get_rng_state(),
        "np_rng": np.random.get_state(),
        "py_rng": random.getstate(),
    }
    if device.type == "cuda" and torch.cuda.is_available():
        state["cuda_rng"] = torch.cuda.get_rng_state_all()
    return state


def _restore_rng_state(state: Dict[str, object], device: torch.device) -> None:
    if "torch_rng" in state and state["torch_rng"] is not None:
        rng_t = state["torch_rng"]
        if isinstance(rng_t, torch.Tensor):
            torch.set_rng_state(rng_t.cpu())
    if "np_rng" in state and state["np_rng"] is not None:
        np.random.set_state(state["np_rng"])
    if "py_rng" in state and state["py_rng"] is not None:
        random.setstate(state["py_rng"])
    if device.type == "cuda" and torch.cuda.is_available() and state.get("cuda_rng"):
        torch.cuda.set_rng_state_all(state["cuda_rng"])


def _select_amp_dtype(dtype_arg: str, device: torch.device) -> Tuple[Optional[torch.dtype], bool]:
    req = str(dtype_arg or "auto").lower()
    if req == "fp32":
        return None, False
    if device.type == "cuda" and torch.cuda.is_available():
        bf16_ok = bool(getattr(torch.cuda, "is_bf16_supported", lambda: False)())
        if req in ("auto", "bf16") and bf16_ok:
            return torch.bfloat16, True
        return torch.float16, True
    if device.type == "cpu":
        # Non-AVX512 x86 CPUs emulate BF16 in software (>100x slower than FP32 on i5-1335U);
        # keep auto on CPU in fast FP32 unless explicitly requested via dtype="bf16".
        cpu_bf16_ok = bool(hasattr(torch, "cpu") and getattr(torch.cpu, "is_bf16_supported", lambda: False)())
        if req == "bf16" and cpu_bf16_ok:
            return torch.bfloat16, True
    return None, False


def _evaluate_sft_val(
    model: JarvisUnifiedTransformer,
    val_encoded: List[Tuple[List[int], int]],
    pad_id: int,
    max_seq_len: int,
    device: torch.device,
    amp_dtype: Optional[torch.dtype],
) -> Optional[float]:
    if not val_encoded:
        return None
    was_training = model.training
    model.eval()
    losses: List[float] = []
    with torch.no_grad():
        for start in range(0, len(val_encoded), 16):
            chunk = val_encoded[start : start + 16]
            inp, lbl = _pad_batch([x[0] for x in chunk], pad_id, max_seq_len, [x[1] for x in chunk])
            inp, lbl = inp.to(device), lbl.to(device)
            with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=amp_dtype is not None):
                out = model(inp, labels=lbl)
            if out["lm_loss"] is not None and torch.isfinite(out["lm_loss"]):
                losses.append(float(out["lm_loss"].item()))
    if was_training:
        model.train()
    return float(sum(losses) / len(losses)) if losses else None


def _evaluate_sft_val_memmap(
    model: JarvisUnifiedTransformer,
    val_batcher: StreamingSFTMemmapBatcher,
    max_seq_len: int,
    device: torch.device,
    amp_dtype: Optional[torch.dtype],
    max_blocks: int = 32,
) -> Optional[float]:
    n_eval = min(val_batcher.num_blocks, int(max_blocks))
    if n_eval <= 0:
        return None
    was_training = model.training
    model.eval()
    losses: List[float] = []
    with torch.no_grad():
        cur = 0
        while cur < n_eval:
            take = min(4, n_eval - cur)
            inp, lbl, cur = val_batcher.next_batch(cur, take, max_seq_len=max_seq_len)
            inp, lbl = inp.to(device), lbl.to(device)
            with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=amp_dtype is not None):
                out = model(inp, labels=lbl)
            if out["lm_loss"] is not None and torch.isfinite(out["lm_loss"]):
                losses.append(float(out["lm_loss"].item()))
    if was_training:
        model.train()
    return float(sum(losses) / len(losses)) if losses else None


def _make_optimizer(params, lr: float, weight_decay: float, optimizer_type: str = "adamw", named_params=None):
    kind = str(optimizer_type or "adamw").strip().lower()
    if named_params is not None:
        decay_params = []
        no_decay_params = []
        for name, p in named_params:
            if not p.requires_grad:
                continue
            lname = name.lower()
            if p.ndim < 2 or "norm" in lname or "bias" in lname or "tok_emb" in lname or "lm_head" in lname:
                no_decay_params.append(p)
            else:
                decay_params.append(p)
        param_groups = [
            {"params": decay_params, "weight_decay": float(weight_decay)},
            {"params": no_decay_params, "weight_decay": 0.0},
        ]
        param_groups = [g for g in param_groups if g["params"]]
    else:
        param_groups = params
    if kind == "adafactor" and hasattr(torch.optim, "Adafactor"):
        return torch.optim.Adafactor(param_groups, lr=lr, weight_decay=weight_decay)
    return torch.optim.AdamW(param_groups, lr=lr, weight_decay=weight_decay, betas=(0.9, 0.95))


def _atomic_torch_save(obj: object, target_path: str) -> None:
    tmp_path = f"{target_path}.tmp_{os.getpid()}"
    torch.save(obj, tmp_path)
    os.replace(tmp_path, target_path)


def run_training_pipeline(
    repo_root: str,
    version_tag: str = "jarvis-v0.8.0",
    preset: str = "jarvis-nano-multimodal",
    vocab_size: int = 2048,
    pretrain_steps: int = 55,
    sft_steps: int = 80,
    vision_steps: int = 120,
    dpo_steps: int = 16,
    lr: float = 2e-3,
    grad_accum_steps: int = 2,
    resume_from: Optional[str] = None,
    seed: int = 42,
    dtype: str = "auto",
    eval_interval: Optional[int] = None,
    early_stopping: bool = True,
    early_stop_patience: int = 3,
    allow_large_cpu: bool = False,
    stop_after_stage: Optional[str] = None,
    stop_after_step: Optional[int] = None,
    dataset_override_dir: Optional[str] = None,
    optimizer_type: str = "adamw",
    seq_len: Optional[int] = None,
    micro_batch_size: Optional[int] = None,
    gradient_checkpointing: bool = False,
    threads: Optional[int] = None,
    external_shard_dir: Optional[str] = None,
    checkpoint_every_steps: int = 25,
    max_commit_mb: Optional[float] = None,
    cancel_flag_path: Optional[str] = None,
    low_ram_mode: Optional[bool] = None,
    pretrain_shard_prefix: Optional[str] = None,
    sft_shard_prefix: Optional[str] = None,
    freeze_lm_for_multimodal: bool = False,
    qk_norm: bool = False,
) -> Dict[str, object]:
    """Run reproducible, resumable 4-stage neural training pipeline."""
    torch.manual_seed(seed)
    np.random.seed(seed)
    random.seed(seed)

    # Distributed scaffold (explicitly tracks whether actual multi-GPU hardware executed)
    world_size = int(os.environ.get("WORLD_SIZE", "1"))
    rank = int(os.environ.get("RANK", "0"))
    local_rank = int(os.environ.get("LOCAL_RANK", "0"))
    ddp_active = False
    if world_size > 1 and not dist.is_initialized():
        backend = "nccl" if torch.cuda.is_available() else "gloo"
        dist.init_process_group(backend=backend, world_size=world_size, rank=rank)
        ddp_active = True

    if torch.cuda.is_available():
        device = torch.device(f"cuda:{local_rank}" if world_size > 1 else "cuda")
    else:
        device = torch.device("cpu")
    amp_dtype, use_amp = _select_amp_dtype(dtype, device)
    use_grad_scaler = bool(device.type == "cuda" and amp_dtype == torch.float16)

    preset_cfg = MODEL_SCALE_PRESETS.get(preset, MODEL_SCALE_PRESETS["jarvis-nano-multimodal"])
    resource_plan = estimate_training_resources(preset=preset, vocab_size=vocab_size)
    tot_p = resource_plan["parameters"]["total_parameters"]
    opt_lower = str(optimizer_type or "adamw").strip().lower()
    if (
        device.type == "cpu"
        and not allow_large_cpu
        and stop_after_step is None
        and (tot_p >= 40_000_000 or (tot_p >= 20_000_000 and opt_lower != "adafactor"))
    ):
        return {
            "success": False,
            "blocked_by_cpu_guardrail": True,
            "error": (
                f"Preset '{preset}' has {resource_plan['parameters']['total_parameters']:,} parameters, which is impractical "
                f"for full multi-stage CPU training (~{resource_plan['time_and_cost_estimates']['local_cpu_host']['est_hours_for_target_tokens']}h). "
                "Approve GPU execution or pass allow_large_cpu / micro smoke-step options."
            ),
            "resource_plan": resource_plan,
        }

    base_neural_dir = os.path.join(repo_root, "data", "neural_models")
    dataset_dir = dataset_override_dir or os.path.join(base_neural_dir, "datasets", version_tag)
    ckpt_dir = os.path.join(base_neural_dir, "checkpoints", version_tag)
    os.makedirs(ckpt_dir, exist_ok=True)

    train_t0 = time.perf_counter()
    target_img_size = int(preset_cfg.get("image_size", 64))
    cached_manifest_path = os.path.join(dataset_dir, "dataset_manifest.json")
    if dataset_override_dir and os.path.exists(cached_manifest_path):
        with open(cached_manifest_path, "r", encoding="utf-8") as mf:
            ds_manifest = json.load(mf)
        ds_manifest["manifest_path"] = cached_manifest_path
        ds_manifest["dataset_cached"] = True
    else:
        ds_manifest = build_unified_datasets(repo_root, dataset_dir, vision_per_class=24, audio_per_class=16, image_size=target_img_size)
    pretrain_rows = _read_jsonl(ds_manifest["paths"]["pretrain"])
    sft_train_rows = _read_jsonl(ds_manifest["paths"]["sft_train"])
    sft_val_rows = _read_jsonl(ds_manifest["paths"]["sft_val"])
    sft_test_rows = _read_jsonl(ds_manifest["paths"]["sft_test"])
    dpo_rows = _read_jsonl(ds_manifest["paths"]["dpo"])
    mm_rows = _read_jsonl(ds_manifest["paths"]["multimodal"])
    mm_train = [r for r in mm_rows if r.get("split") == "train"]
    audio_rows = _read_jsonl(ds_manifest["paths"]["multimodal_audio"])
    audio_train = [r for r in audio_rows if r.get("split") == "train"]

    # 2. Lossless v2 Tokenizer (resume checkpoint OR external shard tokenizer OR fresh BPE)
    if resume_from and os.path.exists(os.path.join(resume_from, "tokenizer.json")):
        tokenizer = JarvisBPE.load(resume_from)
        tok_path = tokenizer.save(ckpt_dir)
        tok_stats = {
            "vocab_size": tokenizer.vocab_size,
            "special_tokens": len(tokenizer.special_tokens),
            "merges_learned": len(tokenizer.merges),
            "pretokenize_mode": getattr(tokenizer, "pretokenize_mode", "legacy"),
            "format_version": getattr(tokenizer, "format_version", "1.1.0"),
            "vocab_sha256": tokenizer.vocab_sha256,
        }
    elif external_shard_dir and os.path.exists(os.path.join(external_shard_dir, "tokenizer.json")):
        tokenizer = JarvisBPE.load(external_shard_dir)
        tok_path = tokenizer.save(ckpt_dir)
        tok_stats = {
            "vocab_size": tokenizer.vocab_size,
            "special_tokens": len(tokenizer.special_tokens),
            "merges_learned": len(tokenizer.merges),
            "pretokenize_mode": getattr(tokenizer, "pretokenize_mode", "byte_bpe_v2"),
            "format_version": getattr(tokenizer, "format_version", "2.0.0"),
            "vocab_sha256": tokenizer.vocab_sha256,
        }
    else:
        tokenizer_corpus = (
            [str(r["text"]) for r in pretrain_rows]
            + [f"{r['instruction']} {r['response']}" for r in sft_train_rows]
            + [f"{r['prompt']} {r['chosen']} {r['rejected']}" for r in dpo_rows]
            + [f"{r['instruction']} {r['response']}" for r in mm_train]
            + [f"{r['instruction']} {r['response']}" for r in audio_train]
        )
        tokenizer = JarvisBPE(pretokenize_mode="byte_bpe_v2")
        tok_stats = tokenizer.train(tokenizer_corpus, target_vocab_size=vocab_size, min_frequency=2)
        tok_path = tokenizer.save(ckpt_dir)

    def format_sft(instr: str, resp: str) -> Tuple[List[int], int]:
        prompt_ids = tokenizer.encode(f"<bos><user>{instr}</user><assistant>")
        resp_ids = tokenizer.encode(f"{resp}<eos>")
        return prompt_ids + resp_ids, len(prompt_ids)

    # Prefer pre-tokenized Stage-1/2 external shard if present so huge corpora stay zero-RAM
    ext_pretrain_loaded = False
    shard_meta: Dict[str, object] = {}
    if external_shard_dir and os.path.isdir(external_shard_dir):
        pre_cands = [pretrain_shard_prefix, "pretrain", "train"] if pretrain_shard_prefix else ["pretrain", "train"]
        for cand_prefix in pre_cands:
            cand_meta = os.path.join(external_shard_dir, f"{cand_prefix}_meta.json")
            cand_bin = os.path.join(external_shard_dir, f"{cand_prefix}_tokens.bin")
            if os.path.exists(cand_meta) and os.path.exists(cand_bin):
                with open(cand_meta, "r", encoding="utf-8") as mf:
                    ext_m = json.load(mf)
                shard_meta = {
                    **ext_m,
                    "bin_path": cand_bin,
                    "total_tokens": int(ext_m.get("total_tokens") or ext_m.get("tokens") or (os.path.getsize(cand_bin) // 4)),
                }
                ext_pretrain_loaded = True
                break

    if ext_pretrain_loaded:
        pretrain_tok_total = int(shard_meta["total_tokens"])
        raw_chars_total = int(shard_meta.get("raw_chars_total") or (pretrain_tok_total * 4))
    else:
        raw_pretrain_docs = [tokenizer.encode(str(r["text"]), add_bos=True, add_eos=True) for r in pretrain_rows if len(str(r.get("text", ""))) > 8]
        shard_meta = write_token_shards(raw_pretrain_docs, os.path.join(dataset_dir, "shards"), prefix="pretrain")
        pretrain_tok_total = int(shard_meta["total_tokens"])
        raw_chars_total = sum(len(str(r.get("text", ""))) for r in pretrain_rows)

    # Prefer pre-tokenized SFT memmap shards if provided inside external_shard_dir
    sft_memmap_batcher: Optional[StreamingSFTMemmapBatcher] = None
    sft_val_memmap_batcher: Optional[StreamingSFTMemmapBatcher] = None
    eff_sft_prefix = "sft_train" if (not sft_shard_prefix or sft_shard_prefix == "sft") else sft_shard_prefix
    ext_sft_meta_path = os.path.join(external_shard_dir, "sft_meta.json") if external_shard_dir else ""
    if external_shard_dir and os.path.exists(ext_sft_meta_path):
        with open(ext_sft_meta_path, "r", encoding="utf-8") as smf:
            ext_sft_meta = json.load(smf)
        tr_inp_p = os.path.join(external_shard_dir, f"{eff_sft_prefix}_inp.bin")
        tr_lbl_p = os.path.join(external_shard_dir, f"{eff_sft_prefix}_lbl.bin")
        blk_w = int(ext_sft_meta.get("block_size", 256))
        prefix_key_map = {
            "sft_train": ("train_blocks", "train_tokens"),
            "stage4_math_code": ("stage4_blocks", "stage4_tokens"),
            "stage5_tool_json": ("stage5_blocks", "stage5_tokens"),
            "stage5b_balanced": ("stage5b_blocks", "stage5b_tokens"),
            "sft_packed": ("sft_packed_blocks", "sft_packed_tokens"),
            "s4_packed": ("s4_packed_blocks", "s4_packed_tokens"),
            "stage4_consolidate": ("stage4_consolidate_blocks", "stage4_consolidate_tokens"),
        }
        meta_blk_key, meta_tok_key = prefix_key_map.get(eff_sft_prefix, (f"{eff_sft_prefix}_blocks", f"{eff_sft_prefix}_tokens"))
        file_blocks = (os.path.getsize(tr_inp_p) // max(4, 4 * blk_w)) if os.path.exists(tr_inp_p) else 0
        n_tr_blocks = int(ext_sft_meta.get(meta_blk_key, 0))
        if n_tr_blocks <= 0 or (file_blocks > 0 and n_tr_blocks != file_blocks):
            n_tr_blocks = file_blocks
        if os.path.exists(tr_inp_p) and os.path.exists(tr_lbl_p) and n_tr_blocks > 0:
            sft_memmap_batcher = StreamingSFTMemmapBatcher(
                tr_inp_p,
                tr_lbl_p,
                num_blocks=n_tr_blocks,
                block_size=blk_w,
                rank=rank,
                world_size=world_size,
                pad_id=tokenizer.pad_id,
            )
            sft_train_tok_total = int(ext_sft_meta.get(meta_tok_key, n_tr_blocks * blk_w))
            sft_encoded = []
        else:
            sft_encoded = [format_sft(str(r["instruction"]), str(r["response"])) for r in sft_train_rows]
            sft_train_tok_total = sum(len(x[0]) for x in sft_encoded)
        val_inp_p = os.path.join(external_shard_dir, "sft_val_inp.bin")
        val_lbl_p = os.path.join(external_shard_dir, "sft_val_lbl.bin")
        if os.path.exists(val_inp_p) and os.path.exists(val_lbl_p) and int(ext_sft_meta.get("val_blocks", 0)) > 0:
            sft_val_memmap_batcher = StreamingSFTMemmapBatcher(
                val_inp_p,
                val_lbl_p,
                num_blocks=int(ext_sft_meta["val_blocks"]),
                block_size=int(ext_sft_meta["block_size"]),
                shuffle_blocks=False,
                pad_id=tokenizer.pad_id,
            )
    else:
        sft_encoded = [format_sft(str(r["instruction"]), str(r["response"])) for r in sft_train_rows]
        sft_train_tok_total = sum(len(x[0]) for x in sft_encoded)

    val_encoded = [format_sft(str(r["instruction"]), str(r["response"])) for r in sft_val_rows[:256]]
    sft_val_tok_total = int(ext_sft_meta.get("val_tokens", sum(len(x[0]) for x in val_encoded))) if (external_shard_dir and os.path.exists(ext_sft_meta_path)) else sum(len(x[0]) for x in val_encoded)
    sft_test_tok_total = sum(len(format_sft(str(r["instruction"]), str(r["response"]))[0]) for r in sft_test_rows[:256])
    dataset_token_stats = {
        "pretrain_tokens": pretrain_tok_total,
        "sft_train_tokens": sft_train_tok_total,
        "sft_val_tokens": sft_val_tok_total,
        "sft_test_tokens": sft_test_tok_total,
        "total_tokens": pretrain_tok_total + sft_train_tok_total + sft_val_tok_total + sft_test_tok_total,
        "pretrain_bytes_per_token": round(raw_chars_total / max(1, pretrain_tok_total), 3),
        "memmap_shard_path": shard_meta["bin_path"],
        "memmap_shard_sha256": shard_meta.get("sha256", ""),
        "external_shard_used": ext_pretrain_loaded or (sft_memmap_batcher is not None),
        "external_sft_memmap": sft_memmap_batcher is not None,
    }

    # 3. Model, Optimizers & Scaler Initialization
    if threads is not None and int(threads) > 0 and device.type == "cpu":
        torch.set_num_threads(int(threads))
    eff_opt_type = str(optimizer_type or "adamw").strip().lower()
    if eff_opt_type not in ("adamw", "adafactor"):
        eff_opt_type = "adamw"

    cfg_kwargs = {k: v for k, v in preset_cfg.items() if k != "image_size"}
    if qk_norm:
        cfg_kwargs["qk_norm"] = True
    cfg = JarvisConfig(
        model_name=preset,
        version=version_tag,
        vocab_size=tokenizer.vocab_size,
        audio_feature_dim=32,
        image_size=target_img_size,
        gradient_checkpointing=bool(gradient_checkpointing),
        **cfg_kwargs,
    )
    raw_model = JarvisUnifiedTransformer(cfg).to(device)
    model = torch.nn.parallel.DistributedDataParallel(raw_model, device_ids=[local_rank] if device.type == "cuda" else None) if ddp_active else raw_model
    unwrapped = model.module if hasattr(model, "module") else model
    param_counts = unwrapped.parameter_count()

    # Adafactor applies RMS-normalized parameter updates (`d=1.0`); do not artificially halve explicit Adafactor LR.
    eff_lr = lr if eff_opt_type == "adafactor" else lr * (0.55 if cfg.d_model >= 256 else 1.0)
    accum = max(1, int(grad_accum_steps))
    total_lm_opt_steps = max(1, (pretrain_steps + sft_steps + accum - 1) // accum)
    warmup_opt_steps = max(2, total_lm_opt_steps // 10)

    main_optimizer = _make_optimizer(
        None, lr=eff_lr, weight_decay=0.02, optimizer_type=eff_opt_type, named_params=unwrapped.named_parameters()
    )
    main_scheduler = torch.optim.lr_scheduler.LambdaLR(
        main_optimizer, lr_lambda=lambda st: _cosine_lr_multiplier(st, warmup_opt_steps, total_lm_opt_steps)
    )
    vis_lr = min(7e-4, max(4e-4, eff_lr)) if getattr(cfg, "vision_layers", 2) >= 3 else max(2e-3, eff_lr * 2.0)
    vision_optimizer = torch.optim.AdamW(unwrapped.vision_encoder.parameters(), lr=vis_lr, weight_decay=0.01)
    audio_optimizer = (
        torch.optim.AdamW(unwrapped.audio_encoder.parameters(), lr=max(2e-3, eff_lr * 2.0), weight_decay=0.01)
        if unwrapped.audio_encoder is not None
        else None
    )
    stage3_joint_lr = (eff_lr * 0.45) if eff_opt_type == "adafactor" else min(8e-4, eff_lr * 0.7)
    dpo_lr = min(4.0e-5, eff_lr * 0.045)
    stage3_joint_optimizer = _make_optimizer(
        None, lr=stage3_joint_lr, weight_decay=0.02, optimizer_type=eff_opt_type, named_params=unwrapped.named_parameters()
    )
    dpo_optimizer = _make_optimizer(
        None, lr=dpo_lr, weight_decay=0.02, optimizer_type=eff_opt_type, named_params=unwrapped.named_parameters()
    )
    scaler = torch.amp.GradScaler("cuda", enabled=use_grad_scaler)

    # Full Training Progress State
    resumed_weights_loaded = False
    resumed_state_loaded = False
    completed_stage_order = ["stage1_pretrain", "stage2_sft", "stage3_multimodal", "stage4_dpo", "completed"]
    resume_meta = {
        "stage": "stage1_pretrain",
        "stage_step": 0,
        "global_step": 0,
        "data_cursors": {"stage1": 0, "stage2": 0, "stage3_mm": 0, "stage3_aud": 0, "stage4": 0},
        "tokens_processed": 0,
        "best_val_loss": float("inf"),
        "best_model_state_dict": None,
        "no_improve_evals": 0,
        "overfitting_detected": False,
        "early_stopped": False,
        "unstable_loss_detected": False,
        "stage1_losses": [],
        "stage2_losses": [],
        "stage3_losses": [],
        "stage3_vision_losses": [],
        "stage3_audio_losses": [],
        "stage4_dpo_losses": [],
        "val_history": [],
    }

    if resume_from and os.path.exists(os.path.join(resume_from, "weights.pt")):
        prior_w = torch.load(os.path.join(resume_from, "weights.pt"), map_location=device, weights_only=True)
        if prior_w.get("config", {}).get("vocab_size") == cfg.vocab_size and prior_w.get("config", {}).get("d_model") == cfg.d_model:
            unwrapped.load_state_dict(prior_w.get("model_state_dict", {}), strict=False)
            resumed_weights_loaded = True

    state_file = os.path.join(resume_from, "training_state.pt") if resume_from else None
    if resumed_weights_loaded and state_file and os.path.exists(state_file):
        try:
            # weights_only=False required because Python/NumPy RNG state tuples exist alongside tensor dicts
            st_ckpt = torch.load(state_file, map_location=device, weights_only=False)
            saved_stage = str(st_ckpt.get("stage", "completed"))
            # Restore optimizer/scheduler/RNG/cursor only when resuming mid-run;
            # completed stage checkpoints initialize a fresh optimizer + warmup cosine schedule for the next stage.
            if saved_stage != "completed":
                if "optimizers" in st_ckpt:
                    opts = st_ckpt["optimizers"]
                    if "main_optimizer" in opts:
                        main_optimizer.load_state_dict(opts["main_optimizer"])
                    if "main_scheduler" in opts and opts["main_scheduler"]:
                        main_scheduler.load_state_dict(opts["main_scheduler"])
                    if "vision_optimizer" in opts:
                        vision_optimizer.load_state_dict(opts["vision_optimizer"])
                    if audio_optimizer is not None and opts.get("audio_optimizer"):
                        audio_optimizer.load_state_dict(opts["audio_optimizer"])
                    if "stage3_joint_optimizer" in opts:
                        stage3_joint_optimizer.load_state_dict(opts["stage3_joint_optimizer"])
                    if "dpo_optimizer" in opts:
                        dpo_optimizer.load_state_dict(opts["dpo_optimizer"])
                elif "optimizer_state_dict" in st_ckpt:
                    main_optimizer.load_state_dict(st_ckpt["optimizer_state_dict"])
                    if "scheduler_state_dict" in st_ckpt:
                        main_scheduler.load_state_dict(st_ckpt["scheduler_state_dict"])
                if st_ckpt.get("scaler_state_dict") and use_grad_scaler:
                    scaler.load_state_dict(st_ckpt["scaler_state_dict"])

                resume_meta["stage"] = saved_stage
                resume_meta["stage_step"] = int(st_ckpt.get("stage_step", 0))
                resume_meta["global_step"] = int(st_ckpt.get("global_step", 0))
                if "data_cursors" in st_ckpt:
                    resume_meta["data_cursors"].update(st_ckpt["data_cursors"])
                resume_meta["tokens_processed"] = int(st_ckpt.get("tokens_processed", 0))
                resume_meta["best_val_loss"] = float(st_ckpt.get("best_val_loss", float("inf")))
                resume_meta["best_model_state_dict"] = st_ckpt.get("best_model_state_dict")
                resume_meta["no_improve_evals"] = int(st_ckpt.get("no_improve_evals", 0))
                resume_meta["overfitting_detected"] = bool(st_ckpt.get("overfitting_detected", False))
                resume_meta["early_stopped"] = bool(st_ckpt.get("early_stopped", False))
                resume_meta["unstable_loss_detected"] = bool(st_ckpt.get("unstable_loss_detected", False))
                hist = st_ckpt.get("loss_history") or {}
                for k in ("stage1_losses", "stage2_losses", "stage3_losses", "stage3_vision_losses", "stage3_audio_losses", "stage4_dpo_losses"):
                    if isinstance(hist.get(k), list):
                        resume_meta[k] = list(hist[k])
                if isinstance(st_ckpt.get("val_history"), list):
                    resume_meta["val_history"] = list(st_ckpt["val_history"])
                if isinstance(st_ckpt.get("rng_state"), dict):
                    _restore_rng_state(st_ckpt["rng_state"], device)
                resumed_state_loaded = True
            else:
                resumed_state_loaded = False
        except Exception:
            resumed_state_loaded = False

    use_low_ram = bool(low_ram_mode) if low_ram_mode is not None else (device.type == "cpu" and cfg.d_model >= 320)

    def _current_commit_mb() -> float:
        if os.name != "nt":
            return _get_process_rss_mb()
        try:
            import ctypes
            from ctypes import wintypes
            class _PMC(ctypes.Structure):
                _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD),
                            ("PeakWorkingSetSize", ctypes.c_size_t), ("WorkingSetSize", ctypes.c_size_t),
                            ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t),
                            ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t), ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                            ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t),
                            ("PrivateUsage", ctypes.c_size_t)]
            k32 = ctypes.WinDLL("kernel32", use_last_error=True)
            psapi = ctypes.WinDLL("psapi", use_last_error=True)
            k32.GetCurrentProcess.restype = wintypes.HANDLE
            psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD]
            psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
            c = _PMC(); c.cb = ctypes.sizeof(c)
            if psapi.GetProcessMemoryInfo(k32.GetCurrentProcess(), ctypes.byref(c), c.cb):
                return float(c.PagefileUsage) / (1024 ** 2)
        except Exception:
            pass
        return _get_process_rss_mb()

    sig_abort: Dict[str, Optional[str]] = {"reason": None}
    _prev_sig_handlers: Dict[int, object] = {}
    if threading.current_thread() is threading.main_thread():
        def _handle_stop_sig(signum, _frame):
            sig_abort["reason"] = f"SIGNAL_{signum}_GRACEFUL_STOP"
        for _s in (signal.SIGINT, getattr(signal, "SIGTERM", signal.SIGINT)):
            try:
                _prev_sig_handlers[_s] = signal.getsignal(_s)
                signal.signal(_s, _handle_stop_sig)
            except Exception:
                pass

    def _should_abort_run() -> Optional[str]:
        if sig_abort["reason"]:
            return sig_abort["reason"]
        if cancel_flag_path and os.path.exists(cancel_flag_path):
            return "CANCEL_FLAG_DETECTED"
        if max_commit_mb is not None and float(max_commit_mb) > 0:
            cur_c = _current_commit_mb()
            if cur_c > float(max_commit_mb):
                return f"COMMIT_CEILING_EXCEEDED:{cur_c:.1f}MB>{float(max_commit_mb):.1f}MB"
        return None

    def _save_full_checkpoint(current_stage: str, stage_step: int) -> None:
        if ddp_active and rank != 0:
            return
        w_path = os.path.join(ckpt_dir, "weights.pt")
        s_path = os.path.join(ckpt_dir, "training_state.pt")
        _atomic_torch_save({"model_state_dict": unwrapped.state_dict(), "config": cfg.to_dict()}, w_path)
        _atomic_torch_save(
            {
                "stage": current_stage,
                "stage_step": stage_step,
                "global_step": resume_meta["global_step"],
                "data_cursors": resume_meta["data_cursors"],
                "tokens_processed": resume_meta["tokens_processed"],
                "best_val_loss": resume_meta["best_val_loss"],
                "best_model_state_dict": None if use_low_ram else resume_meta["best_model_state_dict"],
                "no_improve_evals": resume_meta["no_improve_evals"],
                "overfitting_detected": resume_meta["overfitting_detected"],
                "early_stopped": resume_meta["early_stopped"],
                "unstable_loss_detected": resume_meta["unstable_loss_detected"],
                "aborted_reason": resume_meta.get("aborted_reason"),
                "rng_state": _capture_rng_state(device),
                "scaler_state_dict": scaler.state_dict() if use_grad_scaler else None,
                "optimizers": {
                    "optimizer_type": eff_opt_type,
                    "main_optimizer": main_optimizer.state_dict(),
                    "main_scheduler": main_scheduler.state_dict(),
                    "vision_optimizer": vision_optimizer.state_dict(),
                    "audio_optimizer": audio_optimizer.state_dict() if audio_optimizer is not None else None,
                    "stage3_joint_optimizer": stage3_joint_optimizer.state_dict(),
                    "dpo_optimizer": dpo_optimizer.state_dict(),
                },
                "loss_history": {
                    "stage1_losses": resume_meta["stage1_losses"],
                    "stage2_losses": resume_meta["stage2_losses"],
                    "stage3_losses": resume_meta["stage3_losses"],
                    "stage3_vision_losses": resume_meta["stage3_vision_losses"],
                    "stage3_audio_losses": resume_meta["stage3_audio_losses"],
                    "stage4_dpo_losses": resume_meta["stage4_dpo_losses"],
                },
                "val_history": resume_meta["val_history"],
                "steps_completed": {
                    "pretrain_steps": len(resume_meta["stage1_losses"]),
                    "sft_steps": len(resume_meta["stage2_losses"]),
                    "vision_steps": len(resume_meta["stage3_losses"]),
                    "dpo_steps": len(resume_meta["stage4_dpo_losses"]),
                },
            },
            s_path,
        )

    def _check_stability(loss_val: float, history: List[float]) -> None:
        if not math.isfinite(loss_val):
            resume_meta["unstable_loss_detected"] = True
            return
        if len(history) >= 6:
            med = statistics.median(history[-6:])
            if med > 0.1 and loss_val > med * 3.5:
                resume_meta["unstable_loss_detected"] = True

    def _record_val_check(stage_name: str, step_idx: int, train_losses: List[float]) -> bool:
        """Evaluate held-out SFT val loss, track generalization gap, and trigger early stopping on overfitting."""
        vloss = (
            _evaluate_sft_val_memmap(unwrapped, sft_val_memmap_batcher, cfg.max_seq_len, device, amp_dtype)
            if sft_val_memmap_batcher is not None
            else _evaluate_sft_val(unwrapped, val_encoded, tokenizer.pad_id, cfg.max_seq_len, device, amp_dtype)
        )
        if vloss is None:
            return False
        t_ema = float(sum(train_losses[-5:]) / max(1, len(train_losses[-5:]))) if train_losses else vloss
        gap = round(vloss - t_ema, 4)
        resume_meta["val_history"].append({
            "stage": stage_name,
            "step": step_idx,
            "val_loss": round(vloss, 4),
            "train_loss_recent": round(t_ema, 4),
            "generalization_gap": gap,
        })
        if vloss + 1e-4 < resume_meta["best_val_loss"]:
            resume_meta["best_val_loss"] = vloss
            if use_low_ram:
                _atomic_torch_save({"model_state_dict": unwrapped.state_dict(), "config": cfg.to_dict()}, os.path.join(ckpt_dir, "best_weights.pt"))
            else:
                resume_meta["best_model_state_dict"] = {k: v.detach().cpu().clone() for k, v in unwrapped.state_dict().items()}
            resume_meta["no_improve_evals"] = 0
            return False

        resume_meta["no_improve_evals"] += 1
        train_dropping = len(train_losses) >= 6 and (sum(train_losses[-3:]) / 3.0) < (sum(train_losses[-6:-3]) / 3.0)
        if train_dropping and (vloss - resume_meta["best_val_loss"]) > 0.04 and resume_meta["no_improve_evals"] >= 2:
            resume_meta["overfitting_detected"] = True
        if early_stopping and resume_meta["no_improve_evals"] >= max(2, early_stop_patience):
            resume_meta["early_stopped"] = True
            return True
        return False

    def _sample_curve(vals: List[float], max_points: int = 12) -> List[Dict[str, float]]:
        if not vals:
            return []
        stride = max(1, len(vals) // max_points)
        pts = [{"step": i + 1, "loss": round(vals[i], 4)} for i in range(0, len(vals), stride)]
        if pts[-1]["step"] != len(vals):
            pts.append({"step": len(vals), "loss": round(vals[-1], 4)})
        return pts

    cur_stage_idx = completed_stage_order.index(resume_meta["stage"]) if resume_meta["stage"] in completed_stage_order else 0
    if resumed_state_loaded:
        if len(resume_meta["stage1_losses"]) < pretrain_steps and cur_stage_idx > 0:
            cur_stage_idx = 0
            resume_meta["stage"] = "stage1_pretrain"
            resume_meta["stage_step"] = len(resume_meta["stage1_losses"])
        elif len(resume_meta["stage2_losses"]) < sft_steps and cur_stage_idx > 1:
            cur_stage_idx = 1
            resume_meta["stage"] = "stage2_sft"
            resume_meta["stage_step"] = len(resume_meta["stage2_losses"])
        elif len(resume_meta["stage3_losses"]) < vision_steps and cur_stage_idx > 2:
            cur_stage_idx = 2
            resume_meta["stage"] = "stage3_multimodal"
            resume_meta["stage_step"] = len(resume_meta["stage3_losses"])
        elif len(resume_meta["stage4_dpo_losses"]) < dpo_steps and cur_stage_idx > 3:
            cur_stage_idx = 3
            resume_meta["stage"] = "stage4_dpo"
            resume_meta["stage_step"] = len(resume_meta["stage4_dpo_losses"])

    # ---- STAGE 1: STREAMING MEMMAP CAUSAL PRETRAINING ----
    model.train()
    pack_len = min(cfg.max_seq_len, int(seq_len) if seq_len is not None else 224)
    default_bsz = min(6, max(2, pretrain_tok_total // max(1, pack_len)))
    if cfg.d_model >= 320 and micro_batch_size is None:
        default_bsz = min(default_bsz, 2)
    batch_size = max(1, int(micro_batch_size)) if micro_batch_size is not None else default_bsz
    stream_batcher = StreamingMemmapBatcher(
        bin_path=str(shard_meta["bin_path"]),
        total_tokens=pretrain_tok_total,
        seq_len=pack_len,
        rank=rank,
        world_size=world_size,
    )
    ev_every_s1 = eval_interval or max(10, pretrain_steps // 4)
    halted_early = False

    if cur_stage_idx == 0:
        start_step = resume_meta["stage_step"] if resumed_state_loaded else 0
        main_optimizer.zero_grad()
        for step in range(start_step, pretrain_steps):
            inp, lbl, next_cur = stream_batcher.next_batch(resume_meta["data_cursors"]["stage1"], batch_size, tokenizer.pad_id)
            resume_meta["data_cursors"]["stage1"] = next_cur
            resume_meta["tokens_processed"] += int((inp != tokenizer.pad_id).sum().item())
            inp, lbl = inp.to(device), lbl.to(device)
            with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp):
                out = model(inp, labels=lbl)
                loss = out["loss"] / float(accum)
            if use_grad_scaler:
                scaler.scale(loss).backward()
            else:
                loss.backward()
            raw_l = float(out["loss"].item())
            resume_meta["stage1_losses"].append(raw_l)
            _check_stability(raw_l, resume_meta["stage1_losses"])
            if (step + 1) % accum == 0 or (step + 1) == pretrain_steps:
                if use_grad_scaler:
                    scaler.unscale_(main_optimizer)
                torch.nn.utils.clip_grad_norm_(unwrapped.parameters(), 1.0)
                if use_grad_scaler:
                    scaler.step(main_optimizer)
                    scaler.update()
                else:
                    main_optimizer.step()
                main_scheduler.step()
                main_optimizer.zero_grad()
            resume_meta["global_step"] += 1
            resume_meta["stage_step"] = step + 1
            if (step + 1) % ev_every_s1 == 0 or (step + 1) == pretrain_steps:
                _record_val_check("stage1_pretrain", step + 1, resume_meta["stage1_losses"])
            abort_msg = _should_abort_run()
            if abort_msg:
                resume_meta["aborted_reason"] = abort_msg
                _save_full_checkpoint("stage1_pretrain", step + 1)
                halted_early = True
                break
            if checkpoint_every_steps and checkpoint_every_steps > 0 and (step + 1) % int(checkpoint_every_steps) == 0:
                _save_full_checkpoint("stage1_pretrain", step + 1)
            if stop_after_stage == "stage1_pretrain" and stop_after_step is not None and (step + 1) >= stop_after_step:
                _save_full_checkpoint("stage1_pretrain", step + 1)
                halted_early = True
                break
        if not halted_early:
            cur_stage_idx = 1
            resume_meta["stage"] = "stage2_sft"
            resume_meta["stage_step"] = 0
            if stop_after_stage == "stage1_pretrain":
                _save_full_checkpoint("stage2_sft", 0)
                halted_early = True
    stream_batcher.close()

    # ---- STAGE 2: SFT WITH PROMPT MASKING, VALIDATION & EARLY STOPPING ----
    if not halted_early and cur_stage_idx <= 1:
        start_step = resume_meta["stage_step"] if (resumed_state_loaded and cur_stage_idx == 1) else 0
        if micro_batch_size is not None:
            sft_bs = max(1, int(micro_batch_size))
        elif sft_memmap_batcher is not None:
            sft_bs = 2
        else:
            sft_bs = min(8, max(2, len(sft_encoded)))
        ev_every_s2 = eval_interval or max(8, sft_steps // 5)
        main_optimizer.zero_grad()
        for step in range(start_step, sft_steps):
            cur = resume_meta["data_cursors"]["stage2"]
            if sft_memmap_batcher is not None:
                inp, lbl, next_cur = sft_memmap_batcher.next_batch(cur, sft_bs, max_seq_len=pack_len)
                resume_meta["data_cursors"]["stage2"] = next_cur
            else:
                chosen_idxs = [((cur + k) * world_size + rank) % len(sft_encoded) for k in range(sft_bs)]
                resume_meta["data_cursors"]["stage2"] = cur + sft_bs
                seqs = [sft_encoded[i][0] for i in chosen_idxs]
                prefs = [sft_encoded[i][1] for i in chosen_idxs]
                inp, lbl = _pad_batch(seqs, tokenizer.pad_id, cfg.max_seq_len, label_mask_prefixes=prefs)
            resume_meta["tokens_processed"] += int((inp != tokenizer.pad_id).sum().item())
            inp, lbl = inp.to(device), lbl.to(device)
            with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp):
                out = model(inp, labels=lbl)
                loss = out["loss"] / float(accum)
            if use_grad_scaler:
                scaler.scale(loss).backward()
            else:
                loss.backward()
            raw_l = float(out["loss"].item())
            resume_meta["stage2_losses"].append(raw_l)
            _check_stability(raw_l, resume_meta["stage2_losses"])
            if (step + 1) % accum == 0 or (step + 1) == sft_steps:
                if use_grad_scaler:
                    scaler.unscale_(main_optimizer)
                torch.nn.utils.clip_grad_norm_(unwrapped.parameters(), 1.0)
                if use_grad_scaler:
                    scaler.step(main_optimizer)
                    scaler.update()
                else:
                    main_optimizer.step()
                main_scheduler.step()
                main_optimizer.zero_grad()
            resume_meta["global_step"] += 1
            resume_meta["stage_step"] = step + 1
            if (step + 1) % ev_every_s2 == 0 or (step + 1) == sft_steps:
                should_stop = _record_val_check("stage2_sft", step + 1, resume_meta["stage2_losses"])
                if should_stop:
                    best_file = os.path.join(ckpt_dir, "best_weights.pt")
                    if use_low_ram and os.path.exists(best_file):
                        unwrapped.load_state_dict(torch.load(best_file, map_location=device, weights_only=True)["model_state_dict"], strict=True)
                    elif resume_meta["best_model_state_dict"] is not None:
                        unwrapped.load_state_dict(
                            {k: v.to(device) for k, v in resume_meta["best_model_state_dict"].items()}, strict=True
                        )
                    break
            abort_msg = _should_abort_run()
            if abort_msg:
                resume_meta["aborted_reason"] = abort_msg
                _save_full_checkpoint("stage2_sft", step + 1)
                halted_early = True
                break
            if checkpoint_every_steps and checkpoint_every_steps > 0 and (step + 1) % int(checkpoint_every_steps) == 0:
                _save_full_checkpoint("stage2_sft", step + 1)
            if stop_after_stage == "stage2_sft" and stop_after_step is not None and (step + 1) >= stop_after_step:
                _save_full_checkpoint("stage2_sft", step + 1)
                halted_early = True
                break
        if not halted_early:
            cur_stage_idx = 2
            resume_meta["stage"] = "stage3_multimodal"
            resume_meta["stage_step"] = 0

    # ---- STAGE 3: MULTIMODAL VISION + AUDIO + SFT REPLAY ----
    if not halted_early and cur_stage_idx <= 2 and vision_steps > 0 and mm_train:
        mm_cached = [
            (*format_sft(str(r["instruction"]), str(r["response"])), load_image_tensor(str(r["image_path"]), cfg.image_size), int(r["category_id"]), list(r["bbox"]))
            for r in mm_train
        ]
        audio_cached = [
            (*format_sft(str(r["instruction"]), str(r["response"])), load_audio_feature_tensor(str(r["audio_path"]), feature_dim=cfg.audio_feature_dim).squeeze(0), int(r["category_id"]))
            for r in audio_train
        ]
        mm_rng = random.Random(int(seed) + 101)
        mm_rng.shuffle(mm_cached)
        mm_rng.shuffle(audio_cached)
        mm_bs = min(12, max(2, len(mm_cached)))
        aud_bs = min(12, max(2, len(audio_cached))) if audio_cached else 0
        # Keep LM weights completely isolated during multimodal training when requested
        if freeze_lm_for_multimodal:
            vis_warmup_steps = vision_steps
            for p_name, p_val in unwrapped.named_parameters():
                if not (p_name.startswith("vision_encoder.") or p_name.startswith("audio_encoder.")):
                    p_val.requires_grad_(False)
        else:
            vis_warmup_steps = max(10, int(vision_steps * 0.72))
        start_step = resume_meta["stage_step"] if (resumed_state_loaded and cur_stage_idx == 2) else 0

        for step in range(start_step, vision_steps):
            c_mm = resume_meta["data_cursors"]["stage3_mm"]
            idxs = [(c_mm + k) % len(mm_cached) for k in range(mm_bs)]
            resume_meta["data_cursors"]["stage3_mm"] = c_mm + mm_bs

            seqs = [mm_cached[i][0] for i in idxs]
            prefs = [mm_cached[i][1] for i in idxs]
            imgs = torch.stack([mm_cached[i][2] for i in idxs], dim=0).to(device)
            v_lbls = torch.tensor([mm_cached[i][3] for i in idxs], dtype=torch.long, device=device)
            bboxes = torch.tensor([mm_cached[i][4] for i in idxs], dtype=torch.float32, device=device)
            inp, lbl = _pad_batch(seqs, tokenizer.pad_id, max(16, cfg.max_seq_len - 5), label_mask_prefixes=prefs)
            inp, lbl = inp.to(device), lbl.to(device)

            if step < vis_warmup_steps:
                vision_optimizer.zero_grad()
                with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp):
                    out = model(inp, images=imgs, labels=lbl, vision_labels=v_lbls, bbox_targets=bboxes)
                    v_loss = 1.5 * out["vision_loss"] + 0.25 * out["lm_loss"]
                v_loss.backward()
                torch.nn.utils.clip_grad_norm_(unwrapped.vision_encoder.parameters(), 1.0)
                vision_optimizer.step()
                resume_meta["stage3_losses"].append(float(v_loss.item()))

                if audio_optimizer is not None and audio_cached:
                    c_au = resume_meta["data_cursors"]["stage3_aud"]
                    a_idxs = [(c_au + k) % len(audio_cached) for k in range(aud_bs)]
                    resume_meta["data_cursors"]["stage3_aud"] = c_au + aud_bs
                    auds = torch.stack([audio_cached[i][2] for i in a_idxs], dim=0).to(device)
                    a_lbls = torch.tensor([audio_cached[i][3] for i in a_idxs], dtype=torch.long, device=device)
                    a_inp, a_lbl = _pad_batch([audio_cached[i][0] for i in a_idxs], tokenizer.pad_id, max(16, cfg.max_seq_len - 2), [audio_cached[i][1] for i in a_idxs])
                    a_inp, a_lbl = a_inp.to(device), a_lbl.to(device)
                    audio_optimizer.zero_grad()
                    a_out = model(a_inp, audio_features=auds, labels=a_lbl, audio_labels=a_lbls)
                    a_loss = a_out["audio_loss"] + 0.35 * a_out["lm_loss"]
                    a_loss.backward()
                    torch.nn.utils.clip_grad_norm_(unwrapped.audio_encoder.parameters(), 1.0)
                    audio_optimizer.step()
                    if a_out["audio_loss"] is not None:
                        resume_meta["stage3_audio_losses"].append(float(a_out["audio_loss"].item()))
            else:
                stage3_joint_optimizer.zero_grad()
                with torch.amp.autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp):
                    out = model(inp, images=imgs, labels=lbl, vision_labels=v_lbls, bbox_targets=bboxes)
                    loss = 0.25 * out["lm_loss"] + 2.2 * out["vision_loss"]
                    if audio_cached and unwrapped.audio_encoder is not None:
                        c_au = resume_meta["data_cursors"]["stage3_aud"]
                        a_idxs = [(c_au + k) % len(audio_cached) for k in range(aud_bs)]
                        resume_meta["data_cursors"]["stage3_aud"] = c_au + aud_bs
                        auds = torch.stack([audio_cached[i][2] for i in a_idxs], dim=0).to(device)
                        a_lbls = torch.tensor([audio_cached[i][3] for i in a_idxs], dtype=torch.long, device=device)
                        a_inp, a_lbl = _pad_batch([audio_cached[i][0] for i in a_idxs], tokenizer.pad_id, max(16, cfg.max_seq_len - 2), [audio_cached[i][1] for i in a_idxs])
                        a_out = model(a_inp.to(device), audio_features=auds, labels=a_lbl.to(device), audio_labels=a_lbls)
                        loss = loss + 0.15 * a_out["lm_loss"] + 1.2 * a_out["audio_loss"]
                        if a_out["audio_loss"] is not None:
                            resume_meta["stage3_audio_losses"].append(float(a_out["audio_loss"].item()))
                    if sft_memmap_batcher is not None:
                        r_inp, r_lbl, _ = sft_memmap_batcher.next_batch(step * 2, 2, max_seq_len=pack_len)
                        resume_meta["tokens_processed"] += int((r_inp != tokenizer.pad_id).sum().item())
                        r_out = model(r_inp.to(device), labels=r_lbl.to(device))
                        loss = loss + 1.5 * r_out["lm_loss"]
                    elif sft_encoded:
                        r_idxs = [(step * 8 + k) % len(sft_encoded) for k in range(min(8, len(sft_encoded)))]
                        r_inp, r_lbl = _pad_batch([sft_encoded[i][0] for i in r_idxs], tokenizer.pad_id, cfg.max_seq_len, [sft_encoded[i][1] for i in r_idxs])
                        resume_meta["tokens_processed"] += int((r_inp != tokenizer.pad_id).sum().item())
                        r_out = model(r_inp.to(device), labels=r_lbl.to(device))
                        loss = loss + 1.5 * r_out["lm_loss"]
                loss.backward()
                torch.nn.utils.clip_grad_norm_(unwrapped.parameters(), 1.0)
                stage3_joint_optimizer.step()
                resume_meta["stage3_losses"].append(float(loss.item()))

            if out["vision_loss"] is not None:
                resume_meta["stage3_vision_losses"].append(float(out["vision_loss"].item()))
            resume_meta["global_step"] += 1
            resume_meta["stage_step"] = step + 1
            abort_msg = _should_abort_run()
            if abort_msg:
                resume_meta["aborted_reason"] = abort_msg
                _save_full_checkpoint("stage3_multimodal", step + 1)
                halted_early = True
                break
        if not halted_early:
            if freeze_lm_for_multimodal:
                for p_val in unwrapped.parameters():
                    p_val.requires_grad_(True)
            cur_stage_idx = 3
            resume_meta["stage"] = "stage4_dpo"
            resume_meta["stage_step"] = 0

    # ---- STAGE 4: DPO ALIGNMENT WITH SFT REPLAY ----
    if not halted_early and cur_stage_idx <= 3 and dpo_steps > 0 and dpo_rows:
        ref_model = copy.deepcopy(unwrapped).to(device)
        ref_model.eval()
        for p in ref_model.parameters():
            p.requires_grad_(False)
        dpo_encoded = []
        for r in dpo_rows:
            p_ids = tokenizer.encode(f"<bos><user>{r['prompt']}</user><assistant>")
            c_ids = p_ids + tokenizer.encode(f"{r['chosen']}<eos>")
            r_ids = p_ids + tokenizer.encode(f"{r['rejected']}<eos>")
            dpo_encoded.append((p_ids, c_ids, r_ids))

        beta = 1.2
        model.train()
        start_step = resume_meta["stage_step"] if (resumed_state_loaded and cur_stage_idx == 3) else 0
        for step in range(start_step, dpo_steps):
            c_dpo = resume_meta["data_cursors"]["stage4"]
            p_ids, c_ids, r_ids = dpo_encoded[c_dpo % len(dpo_encoded)]
            resume_meta["data_cursors"]["stage4"] = c_dpo + 1

            len_c = max(1, min(len(c_ids), cfg.max_seq_len) - len(p_ids))
            len_r = max(1, min(len(r_ids), cfg.max_seq_len) - len(p_ids))
            pi_chosen = _sequence_log_prob(unwrapped, p_ids, c_ids, cfg.max_seq_len) / float(len_c)
            pi_rejected = _sequence_log_prob(unwrapped, p_ids, r_ids, cfg.max_seq_len) / float(len_r)
            with torch.no_grad():
                ref_chosen = _sequence_log_prob(ref_model, p_ids, c_ids, cfg.max_seq_len) / float(len_c)
                ref_rejected = _sequence_log_prob(ref_model, p_ids, r_ids, cfg.max_seq_len) / float(len_r)
            logits_diff = beta * ((pi_chosen - ref_chosen) - (pi_rejected - ref_rejected))
            c_inp, c_lbl = _pad_batch([c_ids], tokenizer.pad_id, cfg.max_seq_len, [len(p_ids)])
            sft_anchor = model(c_inp.to(device), labels=c_lbl.to(device))["lm_loss"]
            dpo_loss = -F.logsigmoid(logits_diff) + 0.8 * sft_anchor
            if sft_memmap_batcher is not None:
                r_inp, r_lbl, _ = sft_memmap_batcher.next_batch(step * 2, 2, max_seq_len=pack_len)
                dpo_loss = dpo_loss + 1.2 * model(r_inp.to(device), labels=r_lbl.to(device))["lm_loss"]
            elif sft_encoded:
                r_idxs = [(step * 4 + k) % len(sft_encoded) for k in range(min(4, len(sft_encoded)))]
                r_inp, r_lbl = _pad_batch([sft_encoded[i][0] for i in r_idxs], tokenizer.pad_id, cfg.max_seq_len, [sft_encoded[i][1] for i in r_idxs])
                dpo_loss = dpo_loss + 1.2 * model(r_inp.to(device), labels=r_lbl.to(device))["lm_loss"]
            dpo_optimizer.zero_grad()
            dpo_loss.backward()
            torch.nn.utils.clip_grad_norm_(unwrapped.parameters(), 0.5)
            dpo_optimizer.step()
            resume_meta["stage4_dpo_losses"].append(float(dpo_loss.item()))
            resume_meta["global_step"] += 1
            resume_meta["stage_step"] = step + 1
            abort_msg = _should_abort_run()
            if abort_msg:
                resume_meta["aborted_reason"] = abort_msg
                _save_full_checkpoint("stage4_dpo", step + 1)
                halted_early = True
                break

    final_val_loss = (
        _evaluate_sft_val_memmap(unwrapped, sft_val_memmap_batcher, cfg.max_seq_len, device, amp_dtype)
        if sft_val_memmap_batcher is not None
        else _evaluate_sft_val(unwrapped, val_encoded, tokenizer.pad_id, cfg.max_seq_len, device, amp_dtype)
    )
    if sft_memmap_batcher is not None:
        sft_memmap_batcher.close()
    if sft_val_memmap_batcher is not None:
        sft_val_memmap_batcher.close()
    if final_val_loss is None:
        final_val_loss = float(resume_meta["stage2_losses"][-1]) if resume_meta["stage2_losses"] else float(resume_meta["stage1_losses"][-1])

    train_elapsed_s = max(1e-3, time.perf_counter() - train_t0)
    final_stage_tag = resume_meta["stage"] if halted_early else "completed"
    final_stage_step = resume_meta["stage_step"] if halted_early else 0
    _save_full_checkpoint(final_stage_tag, final_stage_step)

    weights_path = os.path.join(ckpt_dir, "weights.pt")
    state_path = os.path.join(ckpt_dir, "training_state.pt")
    with open(weights_path, "rb") as wf:
        weights_sha256 = hashlib.sha256(wf.read()).hexdigest()
    cfg_path = os.path.join(ckpt_dir, "config.json")
    with open(cfg_path, "w", encoding="utf-8") as cf:
        json.dump(cfg.to_dict(), cf, indent=2)

    report = {
        "success": True,
        "version": version_tag,
        "halted_at_stage": final_stage_tag if halted_early else None,
        "architecture": "JarvisUnifiedTransformer(SDPA) + JarvisVisionPatchEncoder + JarvisAudioFeatureEncoder",
        "architecture_tradeoffs": architecture_tradeoff_summary(cfg),
        "preset": preset,
        "parameters": param_counts,
        "tokenizer": tok_stats,
        "dataset_manifest": ds_manifest["manifest_path"],
        "dataset_counts": ds_manifest["counts"],
        "dataset_tokens": dataset_token_stats,
        "corpus_provenance": ds_manifest.get("corpus_provenance", {}),
        "dataset_audit": ds_manifest.get("data_processing_audit", {}),
        "training_config": {
            "optimizer_type": eff_opt_type,
            "gradient_checkpointing": bool(cfg.gradient_checkpointing),
            "low_ram_mode": use_low_ram,
            "threads": int(threads) if threads is not None else torch.get_num_threads(),
            "aborted_reason": resume_meta.get("aborted_reason"),
            "checkpoint_every_steps": int(checkpoint_every_steps),
            "dataset_cached": bool(ds_manifest.get("dataset_cached", False)),
            "device": str(device),
            "mixed_precision_amp": use_amp,
            "amp_dtype": str(amp_dtype) if amp_dtype is not None else "float32",
            "sdpa_attention": bool(cfg.use_sdpa),
            "streaming_memmap_shards": True,
            "grad_accum_steps": accum,
            "lr_schedule": "linear_warmup_plus_cosine_decay",
            "early_stopping_enabled": early_stopping,
            "distributed_world_size": world_size,
            "distributed_tested_on_multi_gpu": bool(world_size > 1 and torch.cuda.device_count() > 1),
            "resumed_from_checkpoint": resume_from if resumed_weights_loaded else None,
            "resumed_full_training_state": resumed_state_loaded,
            "pretrain_shard_prefix": pretrain_shard_prefix or "pretrain",
            "sft_shard_prefix": eff_sft_prefix,
        },
        "training_diagnostics": {
            "overfitting_detected": resume_meta["overfitting_detected"],
            "early_stopped": resume_meta["early_stopped"],
            "unstable_loss_detected": resume_meta["unstable_loss_detected"],
            "best_val_loss": round(resume_meta["best_val_loss"], 4) if math.isfinite(resume_meta["best_val_loss"]) else None,
            "val_history": resume_meta["val_history"],
        },
        "throughput_and_memory": {
            "training_wall_time_s": round(train_elapsed_s, 2),
            "tokens_processed": resume_meta["tokens_processed"],
            "effective_tokens_per_sec": round(resume_meta["tokens_processed"] / train_elapsed_s, 1),
            "process_rss_mb": _get_process_rss_mb(),
        },
        "artifacts": {
            "checkpoint_dir": ckpt_dir,
            "weights_path": weights_path,
            "training_state_path": state_path,
            "weights_bytes": os.path.getsize(weights_path),
            "weights_sha256": weights_sha256,
            "config_path": cfg_path,
            "tokenizer_path": tok_path,
        },
        "loss_curves": {
            "stage1_pretrain": _sample_curve(resume_meta["stage1_losses"]),
            "stage2_sft": _sample_curve(resume_meta["stage2_losses"]),
            "stage3_vision": _sample_curve(resume_meta["stage3_vision_losses"]),
            "stage3_audio": _sample_curve(resume_meta["stage3_audio_losses"]),
            "stage4_dpo": _sample_curve(resume_meta["stage4_dpo_losses"]),
        },
        "training_metrics": {
            "stage1_pretrain_initial_loss": round(resume_meta["stage1_losses"][0], 4) if resume_meta["stage1_losses"] else None,
            "stage1_pretrain_final_loss": round(resume_meta["stage1_losses"][-1], 4) if resume_meta["stage1_losses"] else None,
            "stage2_sft_initial_loss": round(resume_meta["stage2_losses"][0], 4) if resume_meta["stage2_losses"] else None,
            "stage2_sft_final_loss": round(resume_meta["stage2_losses"][-1], 4) if resume_meta["stage2_losses"] else None,
            "stage3_vision_initial_loss": round(resume_meta["stage3_vision_losses"][0], 4) if resume_meta["stage3_vision_losses"] else None,
            "stage3_vision_final_loss": round(resume_meta["stage3_vision_losses"][-1], 4) if resume_meta["stage3_vision_losses"] else None,
            "stage3_audio_initial_loss": round(resume_meta["stage3_audio_losses"][0], 4) if resume_meta["stage3_audio_losses"] else None,
            "stage3_audio_final_loss": round(resume_meta["stage3_audio_losses"][-1], 4) if resume_meta["stage3_audio_losses"] else None,
            "stage4_dpo_initial_loss": round(resume_meta["stage4_dpo_losses"][0], 4) if resume_meta["stage4_dpo_losses"] else None,
            "stage4_dpo_final_loss": round(resume_meta["stage4_dpo_losses"][-1], 4) if resume_meta["stage4_dpo_losses"] else None,
            "sft_val_loss": round(final_val_loss, 4),
            "sft_val_perplexity": round(math.exp(min(12.0, final_val_loss)), 2),
        },
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    for _s, _h in _prev_sig_handlers.items():
        try:
            signal.signal(_s, _h)
        except Exception:
            pass
    report_path = os.path.join(ckpt_dir, "training_report.json")
    with open(report_path, "w", encoding="utf-8") as rf:
        json.dump(report, rf, indent=2)
    return report
