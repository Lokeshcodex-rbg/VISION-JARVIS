"""
VISION Latency Profiling & CPU Inference Optimization Engine
ml_foundation/profile_latency.py

Profiles CPU latency across:
1. v1.4 (13.3M) vs v1.5 (26.8M) FP32 baseline
2. PyTorch CPU thread counts: 1, 2, 4, 6, 8 threads
3. Dynamic INT8 quantization (torch.ao.quantization.quantize_dynamic)
4. Attention kernel (SDPA vs Eager)
5. Time to First Token (TTFT) and Sustained Generation Throughput (tokens/sec)
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Dict, Any, List

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE


def benchmark_model(
    model: torch.nn.Module,
    tokenizer: JarvisBPE,
    prompt: str = "Explain the operating principle of a stepper motor in robotics.",
    num_warmup: int = 2,
    num_runs: int = 5,
    max_new_tokens: int = 40,
) -> Dict[str, float]:
    input_ids = tokenizer.encode(f"<bos><user>{prompt}</user><assistant>")
    x = torch.tensor([input_ids], dtype=torch.long)

    # Warmup
    with torch.no_grad():
        for _ in range(num_warmup):
            _ = model.generate(x, max_new_tokens=10, temperature=0.0)

    ttft_list = []
    total_time_list = []
    toks_per_sec_list = []

    with torch.no_grad():
        for _ in range(num_runs):
            # Measure TTFT (generating 1 token)
            t0 = time.perf_counter()
            _ = model.generate(x, max_new_tokens=1, temperature=0.0)
            ttft_ms = (time.perf_counter() - t0) * 1000.0
            ttft_list.append(ttft_ms)

            # Measure full generation
            t1 = time.perf_counter()
            out_ids = model.generate(x, max_new_tokens=max_new_tokens, temperature=0.0)
            elapsed_sec = time.perf_counter() - t1
            new_tokens = len(out_ids) - len(input_ids)
            toks_per_sec = new_tokens / max(elapsed_sec, 1e-5)

            total_time_list.append(elapsed_sec * 1000.0)
            toks_per_sec_list.append(toks_per_sec)

    ttft_list.sort()
    total_time_list.sort()
    toks_per_sec_list.sort()

    return {
        "ttft_p50_ms": round(ttft_list[len(ttft_list) // 2], 2),
        "total_p50_ms": round(total_time_list[len(total_time_list) // 2], 2),
        "tokens_per_sec": round(toks_per_sec_list[len(toks_per_sec_list) // 2], 2),
        "tokens_generated": max_new_tokens
    }


def run_latency_profiling() -> Dict[str, Any]:
    v14_dir = "data/neural_models/checkpoints/vision-v1.4-calibrated-local"
    v15_dir = "data/neural_models/checkpoints/vision-v1.5-25m-local"

    tok = JarvisBPE.load(v14_dir)
    results = {}

    print("\n=======================================================")
    print("PROFILING 1: THREAD SCALING ON CPU (v1.5 25M FP32)")
    print("=======================================================")
    thread_sweep = [1, 2, 4, 6, 8]
    thread_results = {}
    m15, _ = JarvisUnifiedTransformer.load_pretrained(v15_dir, device="cpu", strict=False)
    m15.eval()

    best_thread = 4
    best_time = float("inf")

    for th in thread_sweep:
        torch.set_num_threads(th)
        bm = benchmark_model(m15, tok, num_warmup=1, num_runs=3, max_new_tokens=30)
        thread_results[f"threads_{th}"] = bm
        print(f"  Threads = {th:>2}: TTFT = {bm['ttft_p50_ms']:>6.1f} ms | Total (30 tok) = {bm['total_p50_ms']:>6.1f} ms | {bm['tokens_per_sec']:>5.2f} tok/s")
        if bm["total_p50_ms"] < best_time:
            best_time = bm["total_p50_ms"]
            best_thread = th

    print(f"  >>> Optimal CPU thread setting: {best_thread} threads (Latency: {best_time:.1f} ms) <<<")
    results["thread_scaling_v15"] = thread_results
    results["optimal_threads"] = best_thread

    # Use optimal threads for head-to-head comparison
    torch.set_num_threads(best_thread)

    print("\n=======================================================")
    print(f"PROFILING 2: HEAD-TO-HEAD FP32 BASELINE ({best_thread} threads)")
    print("=======================================================")
    m14, _ = JarvisUnifiedTransformer.load_pretrained(v14_dir, device="cpu", strict=False)
    m14.eval()

    bm_14_fp32 = benchmark_model(m14, tok, num_warmup=2, num_runs=5, max_new_tokens=40)
    print(f"  VISION v1.4 (13.3M FP32): TTFT = {bm_14_fp32['ttft_p50_ms']:>6.1f} ms | Total (40 tok) = {bm_14_fp32['total_p50_ms']:>6.1f} ms | {bm_14_fp32['tokens_per_sec']:>5.2f} tok/s")

    bm_15_fp32 = benchmark_model(m15, tok, num_warmup=2, num_runs=5, max_new_tokens=40)
    print(f"  VISION v1.5 (26.8M FP32): TTFT = {bm_15_fp32['ttft_p50_ms']:>6.1f} ms | Total (40 tok) = {bm_15_fp32['total_p50_ms']:>6.1f} ms | {bm_15_fp32['tokens_per_sec']:>5.2f} tok/s")

    results["v14_fp32"] = bm_14_fp32
    results["v15_fp32"] = bm_15_fp32

    print("\n=======================================================")
    print("PROFILING 3: DYNAMIC INT8 QUANTIZATION")
    print("=======================================================")
    print("  Quantizing v1.4 to INT8...")
    m14_int8 = m14.quantize_dynamic_int8()
    bm_14_int8 = benchmark_model(m14_int8, tok, num_warmup=2, num_runs=5, max_new_tokens=40)
    print(f"  VISION v1.4 (INT8):       TTFT = {bm_14_int8['ttft_p50_ms']:>6.1f} ms | Total (40 tok) = {bm_14_int8['total_p50_ms']:>6.1f} ms | {bm_14_int8['tokens_per_sec']:>5.2f} tok/s")

    print("  Quantizing v1.5 to INT8...")
    m15_int8 = m15.quantize_dynamic_int8()
    bm_15_int8 = benchmark_model(m15_int8, tok, num_warmup=2, num_runs=5, max_new_tokens=40)
    print(f"  VISION v1.5 (INT8):       TTFT = {bm_15_int8['ttft_p50_ms']:>6.1f} ms | Total (40 tok) = {bm_15_int8['total_p50_ms']:>6.1f} ms | {bm_15_int8['tokens_per_sec']:>5.2f} tok/s")

    results["v14_int8"] = bm_14_int8
    results["v15_int8"] = bm_15_int8

    speedup_15 = bm_15_fp32["total_p50_ms"] / max(bm_15_int8["total_p50_ms"], 1.0)
    print(f"\n  >>> INT8 Speedup on 25M model: {speedup_15:.2f}x faster ({bm_15_fp32['total_p50_ms']:.1f} ms -> {bm_15_int8['total_p50_ms']:.1f} ms) <<<")

    out_file = "data/learning/latency_profiling_report.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nProfiling report saved to {out_file}")

    return results


if __name__ == "__main__":
    run_latency_profiling()
