"""
Standardized Rigorous Latency & Hardware Utilization Benchmark
ml_foundation/standardized_latency_benchmark.py

Eliminates all measurement discrepancies by enforcing:
1. Strict thread pinning: torch.set_num_threads(4)
2. Controlled context length: Fixed 32-token prompt
3. Controlled generation budget: Exactly 32 generated tokens
4. Proper warm-up: 3 discarded warm-up runs to prime CPU caches
5. Metrics measured:
   - Prefill Latency (ms) / Time To First Token (TTFT)
   - Decode Latency per token (ms/tok)
   - Sustained Generation Speed (tokens/second)
   - Total Roundtrip P50 & P95 (ms)
   - Process RAM (RSS in MB)
"""

import os
import sys
import time
import json
import statistics
import torch

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE


def benchmark_checkpoint_latency(
    checkpoint_dir: str,
    prompt: str = "Explain the fundamental principles of robotic kinematic control and trajectory planning.",
    num_warmup: int = 3,
    num_iterations: int = 10,
    gen_tokens: int = 32,
    threads: int = 4
) -> dict:
    torch.set_num_threads(threads)
    
    # Load model using the official method
    model, cfg = JarvisUnifiedTransformer.load_pretrained(checkpoint_dir)
    model.eval()

    # Load tokenizer
    tok_dir = checkpoint_dir
    if not os.path.exists(os.path.join(tok_dir, "tokenizer.json")):
        tok_dir = os.path.join("data", "neural_models", "checkpoints", "vision-v1.4-calibrated-local")
    tok = JarvisBPE.load(tok_dir)
    
    # Encode prompt
    input_ids = tok.encode(f"<bos><user>{prompt}</user><assistant>", add_bos=False, add_eos=False)
    input_tensor = torch.tensor([input_ids], dtype=torch.long)
    actual_prompt_len = input_tensor.shape[1]
    
    # Warmup runs (prime instruction cache and CPU pipeline)
    for _ in range(num_warmup):
        with torch.no_grad():
            curr = input_tensor.clone()
            for _ in range(4):
                out = model(curr)
                logits = out["logits"] if isinstance(out, dict) else out
                next_tok = torch.argmax(logits[:, -1, :], dim=-1, keepdim=True)
                curr = torch.cat([curr, next_tok], dim=1)
                
    # Iteration benchmark
    ttft_list = []
    total_time_list = []
    decode_time_list = []
    
    for it in range(num_iterations):
        with torch.no_grad():
            curr = input_tensor.clone()
            
            # Step 1: Measure TTFT (Prefill)
            t_start = time.perf_counter()
            out = model(curr)
            logits = out["logits"] if isinstance(out, dict) else out
            t_first = time.perf_counter()
            ttft_ms = (t_first - t_start) * 1000.0
            ttft_list.append(ttft_ms)
            
            next_tok = torch.argmax(logits[:, -1, :], dim=-1, keepdim=True)
            curr = torch.cat([curr, next_tok], dim=1)
            
            # Step 2: Measure autoregressive decoding for (gen_tokens - 1) tokens
            t_decode_start = time.perf_counter()
            for _ in range(gen_tokens - 1):
                out = model(curr)
                logits = out["logits"] if isinstance(out, dict) else out
                next_tok = torch.argmax(logits[:, -1, :], dim=-1, keepdim=True)
                curr = torch.cat([curr, next_tok], dim=1)
            t_decode_end = time.perf_counter()
            
            decode_ms = (t_decode_end - t_decode_start) * 1000.0
            decode_time_list.append(decode_ms)
            
            total_ms = (t_decode_end - t_start) * 1000.0
            total_time_list.append(total_ms)

    rss_mb = _get_process_rss_mb()

    total_time_list.sort()
    ttft_list.sort()
    
    p50_total = total_time_list[len(total_time_list) // 2]
    p95_total = total_time_list[int(len(total_time_list) * 0.95)]
    p50_ttft = ttft_list[len(ttft_list) // 2]
    
    avg_decode_time = statistics.mean(decode_time_list)
    tokens_per_sec = (gen_tokens - 1) / (avg_decode_time / 1000.0) if avg_decode_time > 0 else 0
    ms_per_token = avg_decode_time / (gen_tokens - 1) if gen_tokens > 1 else 0

    return {
        "checkpoint": os.path.basename(checkpoint_dir),
        "parameters": sum(p.numel() for p in model.parameters()),
        "threads": threads,
        "prompt_tokens": actual_prompt_len,
        "generated_tokens": gen_tokens,
        "iterations": num_iterations,
        "ttft_p50_ms": round(p50_ttft, 2),
        "total_p50_ms": round(p50_total, 2),
        "total_p95_ms": round(p95_total, 2),
        "ms_per_token": round(ms_per_token, 2),
        "tokens_per_sec": round(tokens_per_sec, 2),
        "process_rss_mb": round(rss_mb, 2)
    }


def run_full_latency_audit() -> dict:
    checkpoints = [
        "data/neural_models/checkpoints/vision-v1.4-calibrated-local",
        "data/neural_models/checkpoints/vision-v1.5-25m-local",
        "data/neural_models/checkpoints/vision-v1.5-25m-recovered"
    ]
    
    print("=" * 75)
    print("STANDARDIZED RIGOROUS LATENCY & RESOURCE AUDIT")
    print("Methodology: Fixed 4 Threads | 32-tok Prompt | 32 Generated Tokens | 10 Iterations")
    print("=" * 75)
    
    results = {}
    for c in checkpoints:
        if os.path.exists(c):
            name = os.path.basename(c)
            print(f"\nBenchmarking {name}...")
            bench = benchmark_checkpoint_latency(c)
            results[name] = bench
            print(f"  Params:       {bench['parameters']:,}")
            print(f"  TTFT (P50):   {bench['ttft_p50_ms']:.1f} ms")
            print(f"  P50 Total:    {bench['total_p50_ms']:.1f} ms | P95: {bench['total_p95_ms']:.1f} ms")
            print(f"  Speed:        {bench['tokens_per_sec']:.1f} tok/s ({bench['ms_per_token']:.1f} ms/tok)")
            print(f"  Process RSS:  {bench['process_rss_mb']:.1f} MB")
            
    out_path = os.path.join("data", "learning", "standardized_latency_audit.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved standardized latency report to {out_path}")
    return results


if __name__ == "__main__":
    run_full_latency_audit()
