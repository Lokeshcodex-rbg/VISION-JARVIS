"""
VISION — MADE BY LOKESH | Hardware Throughput, Memory & Scaling Benchmarker (`ml_foundation/benchmark_hardware.py`)
Empirically measures forward+backward tokens/sec, peak memory footprint, and KV-cache
decoding speedup across configurable model presets without guessing or fabricating metrics.
"""

from __future__ import annotations

import os
import time
from typing import Dict, List

import torch

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer, MODEL_SCALE_PRESETS


def _get_process_rss_mb() -> float:
    """Reads current process RSS memory in MB on Windows/POSIX safely."""
    try:
        import ctypes
        from ctypes import wintypes

        class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        kernel32.K32GetProcessMemoryInfo.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(PROCESS_MEMORY_COUNTERS),
            wintypes.DWORD,
        ]
        kernel32.K32GetProcessMemoryInfo.restype = wintypes.BOOL

        counters = PROCESS_MEMORY_COUNTERS()
        counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
        hproc = kernel32.GetCurrentProcess()
        if kernel32.K32GetProcessMemoryInfo(hproc, ctypes.byref(counters), counters.cb):
            return round(counters.WorkingSetSize / (1024 * 1024), 2)
    except Exception:
        pass
    try:
        import resource
        return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0, 2)
    except Exception:
        return 0.0


def benchmark_presets(vocab_size: int = 2048, seq_len: int = 128, batch_size: int = 2) -> Dict[str, object]:
    """Benchmarks actual host CPU/CUDA throughput on executable presets and computes scaling bounds."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    cuda_avail = torch.cuda.is_available()
    cpu_threads = torch.get_num_threads()
    measured: List[Dict[str, object]] = []

    for preset_name in ("jarvis-nano-multimodal", "jarvis-micro-multimodal"):
        preset_cfg = MODEL_SCALE_PRESETS[preset_name]
        cfg = JarvisConfig(
            model_name=preset_name,
            version="benchmark",
            vocab_size=vocab_size,
            audio_feature_dim=32,
            **preset_cfg,
        )
        model = JarvisUnifiedTransformer(cfg).to(device)
        pcount = model.parameter_count()
        opt = torch.optim.AdamW(model.parameters(), lr=1e-3)

        eff_seq = min(seq_len, cfg.max_seq_len)
        x = torch.randint(0, vocab_size, (batch_size, eff_seq), device=device)

        # Warmup 1 step
        model.train()
        out = model(x, labels=x)
        out["loss"].backward()
        opt.step()
        opt.zero_grad()

        # Timed 3 forward+backward steps
        t0 = time.perf_counter()
        n_steps = 3
        for _ in range(n_steps):
            out = model(x, labels=x)
            out["loss"].backward()
            opt.step()
            opt.zero_grad()
        elapsed = max(1e-6, time.perf_counter() - t0)
        tokens_processed = batch_size * eff_seq * n_steps
        train_tok_s = tokens_processed / elapsed

        # KV-cache vs uncached autoregressive generation timing (16 tokens)
        prompt = torch.randint(0, vocab_size, (1, 32), device=device)
        t_nocache = time.perf_counter()
        model.generate(prompt, max_new_tokens=16, temperature=0.01, use_kv_cache=False)
        ms_nocache = (time.perf_counter() - t_nocache) * 1000.0

        t_cache = time.perf_counter()
        model.generate(prompt, max_new_tokens=16, temperature=0.01, use_kv_cache=True)
        ms_cache = (time.perf_counter() - t_cache) * 1000.0

        fp32_weights_mb = round((pcount["total_parameters"] * 4) / (1024 * 1024), 2)
        adam_state_mb = round(fp32_weights_mb * 4.0, 2)  # weights + grads + Adam m, v

        measured.append({
            "preset": preset_name,
            "parameters": pcount,
            "max_seq_len": cfg.max_seq_len,
            "fp32_weights_mb": fp32_weights_mb,
            "estimated_training_state_mb": adam_state_mb,
            "measured_train_tokens_per_sec": round(train_tok_s, 1),
            "measured_ms_per_step": round((elapsed / n_steps) * 1000.0, 2),
            "gen_16tok_nocache_ms": round(ms_nocache, 2),
            "gen_16tok_kvcache_ms": round(ms_cache, 2),
            "kv_cache_speedup": round(ms_nocache / max(1e-3, ms_cache), 2),
        })

    # Analytic resource estimates for GPU-tier presets
    scaling_projections = []
    for preset_name in ("jarvis-small-research", "jarvis-core-125m", "jarvis-core-1b"):
        pc = MODEL_SCALE_PRESETS[preset_name]
        # Approximate parameter formula for GQA SwiGLU decoder + vision encoder
        d = pc["d_model"]
        nl = pc["n_layers"]
        dff = pc["d_ff"]
        kv_d = (d // pc["n_heads"]) * pc["n_kv_heads"]
        attn_p = 2 * d * d + 2 * d * kv_d
        mlp_p = 3 * d * dff
        emb_p = vocab_size * d
        approx_params = emb_p + nl * (attn_p + mlp_p + 2 * d) + (pc["vision_dim"] ** 2) * pc["vision_layers"] * 4
        fp32_mb = round((approx_params * 4) / (1024 * 1024), 1)
        bf16_train_gb = round((approx_params * 16) / (1024 ** 3), 2)  # bf16 params+grads + fp32 master/Adam
        scaling_projections.append({
            "preset": preset_name,
            "approx_parameters": int(approx_params),
            "max_seq_len": pc["max_seq_len"],
            "fp32_weights_mb": fp32_mb,
            "min_gpu_vram_gb_bf16_adam": bf16_train_gb,
            "feasible_on_current_host": cuda_avail or approx_params < 30_000_000,
        })

    return {
        "success": True,
        "host": {
            "device": str(device),
            "cuda_available": cuda_avail,
            "cpu_threads": cpu_threads,
            "process_rss_mb": _get_process_rss_mb(),
            "torch_version": torch.__version__,
        },
        "measured_presets": measured,
        "scaling_projections": scaling_projections,
    }
