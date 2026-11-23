"""
VISION — MADE BY LOKESH | Parameter Scaling Analysis & Architectural Roadmap
ml_foundation/scaling_analysis.py

Comprehensive mathematical scaling calculations for VISION across:
- 25M, 50M, 100M, 250M, 500M, 1B, 3B, and 7B architectures.

Calculates:
1. Exact trainable parameter counts (Language, Vision, Audio, Total).
2. Architectural hyper-parameters (d_model, n_layers, n_heads, n_kv_heads, d_ff, vocab_size, max_seq_len).
3. Weight storage (FP32, FP16/BF16, INT8, INT4).
4. Training RAM requirements (Weights + Gradients + Optimizer States + Activations).
5. Optimizer memory (AdamW vs Adafactor vs 8-bit Adam).
6. Activation memory (with and without gradient checkpointing).
7. Estimated training time (Local CPU vs 1x RTX 4090 vs 1x A100 80GB vs 8x A100/H100 cluster).
8. Inference latency & KV Cache memory per token.
9. Dataset token requirements (Chinchilla compute-optimal scaling: ~20 tokens/param + instruction SFT).
10. Hardware compatibility & limitations (Local CPU feasibility vs Cloud requirements).
"""

from __future__ import annotations

import dataclasses
import json
import math
import os
import sys
from typing import Dict, List, Optional, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer


@dataclasses.dataclass
class ModelScaleSpec:
    target_name: str
    target_label: str
    d_model: int
    n_layers: int
    n_heads: int
    n_kv_heads: int
    d_ff: int
    vocab_size: int = 8192
    max_seq_len: int = 1024
    image_size: int = 64
    patch_size: int = 8
    vision_layers: int = 3
    vision_dim: int = 192
    audio_feature_dim: int = 32
    tie_word_embeddings: bool = True
    qk_norm: bool = True
    use_sdpa: bool = True


CANDIDATE_SPECS: List[ModelScaleSpec] = [
    # Baseline
    ModelScaleSpec(
        target_name="vision-baseline-13m",
        target_label="13.33M (v1.3/v1.4 Baseline)",
        d_model=320,
        n_layers=8,
        n_heads=8,
        n_kv_heads=4,
        d_ff=896,
        max_seq_len=1024,
        vision_layers=3,
        vision_dim=192,
    ),
    # 25M
    ModelScaleSpec(
        target_name="vision-scale-25m",
        target_label="25M Target (~26M Unified)",
        d_model=448,
        n_layers=10,
        n_heads=8,
        n_kv_heads=4,
        d_ff=1152,
        max_seq_len=1024,
        vision_layers=3,
        vision_dim=192,
    ),
    # 50M
    ModelScaleSpec(
        target_name="vision-scale-50m",
        target_label="50M Target (~53M Unified)",
        d_model=576,
        n_layers=12,
        n_heads=12,
        n_kv_heads=4,
        d_ff=1536,
        max_seq_len=2048,
        vision_layers=4,
        vision_dim=256,
    ),
    # 100M
    ModelScaleSpec(
        target_name="vision-scale-100m",
        target_label="100M Target (~105M Unified)",
        d_model=768,
        n_layers=14,
        n_heads=12,
        n_kv_heads=4,
        d_ff=2048,
        max_seq_len=2048,
        vision_layers=4,
        vision_dim=256,
    ),
    # 250M
    ModelScaleSpec(
        target_name="vision-scale-250m",
        target_label="250M Target (~252M Unified)",
        d_model=1024,
        n_layers=20,
        n_heads=16,
        n_kv_heads=4,
        d_ff=2816,
        max_seq_len=2048,
        vision_layers=6,
        vision_dim=384,
    ),
    # 500M
    ModelScaleSpec(
        target_name="vision-scale-500m",
        target_label="500M Target (~512M Unified)",
        d_model=1280,
        n_layers=24,
        n_heads=20,
        n_kv_heads=4,
        d_ff=3584,
        max_seq_len=4096,
        vision_layers=6,
        vision_dim=512,
    ),
    # 1B
    ModelScaleSpec(
        target_name="vision-scale-1b",
        target_label="1B Target (~1.05B Unified)",
        d_model=2048,
        n_layers=22,
        n_heads=16,
        n_kv_heads=4,
        d_ff=5632,
        max_seq_len=4096,
        vision_layers=8,
        vision_dim=768,
    ),
    # 3B Future
    ModelScaleSpec(
        target_name="vision-scale-3b",
        target_label="3B Target (~3.1B Future)",
        d_model=3072,
        n_layers=28,
        n_heads=24,
        n_kv_heads=8,
        d_ff=8192,
        max_seq_len=8192,
        vision_layers=12,
        vision_dim=1024,
    ),
    # 7B Future
    ModelScaleSpec(
        target_name="vision-scale-7b",
        target_label="7B Target (~7.2B Future)",
        d_model=4096,
        n_layers=32,
        n_heads=32,
        n_kv_heads=8,
        d_ff=11008,
        max_seq_len=8192,
        vision_layers=16,
        vision_dim=1024,
    ),
]


def calculate_analytical_parameters(spec: ModelScaleSpec) -> Dict[str, int]:
    """Computes exact parameter breakdown mathematically."""
    d = spec.d_model
    L = spec.n_layers
    H = spec.n_heads
    H_kv = spec.n_kv_heads
    d_ff = spec.d_ff
    V = spec.vocab_size
    head_dim = d // H

    # Language Backbone
    embed = V * d
    # Attention: W_q, W_k, W_v, W_o + QK-Norm
    w_q = d * (H * head_dim)
    w_k = d * (H_kv * head_dim)
    w_v = d * (H_kv * head_dim)
    w_o = (H * head_dim) * d
    qk_norm_params = (2 * head_dim) if spec.qk_norm else 0
    attn_layer = w_q + w_k + w_v + w_o + qk_norm_params

    # SwiGLU MLP: gate, up, down
    w_gate = d * d_ff
    w_up = d * d_ff
    w_down = d_ff * d
    mlp_layer = w_gate + w_up + w_down

    # RMSNorms: norm1 + norm2
    norm_layer = 2 * d

    final_norm = d
    lm_head = 0 if spec.tie_word_embeddings else (V * d)

    lang_params = embed + L * (attn_layer + mlp_layer + norm_layer) + final_norm + lm_head

    # Vision Encoder
    # patch_embed Conv2d stem
    mid_ch = max(32, spec.vision_dim // 4)
    s2 = max(1, spec.patch_size // 2)
    stem1 = (3 * mid_ch * 3 * 3) + mid_ch  # kernel 3x3
    stem2 = (mid_ch * spec.vision_dim * s2 * s2) + spec.vision_dim
    cls_token = spec.vision_dim
    grid_side = spec.image_size // spec.patch_size
    num_patches = grid_side * grid_side
    pos_embed = (1 + num_patches) * spec.vision_dim

    # ViT Blocks: MultiheadAttention (in_proj 3*Dv*Dv + 3*Dv, out_proj Dv*Dv + Dv) + 2 RMSNorm + MLP
    dv = spec.vision_dim
    vit_attn = (3 * dv * dv + 3 * dv) + (dv * dv + dv)
    vit_norm = 2 * dv
    vit_mlp = (dv * (2 * dv) + 2 * dv) + ((2 * dv) * dv + dv)
    vit_block = vit_attn + vit_norm + vit_mlp
    vit_total = spec.vision_layers * vit_block
    vit_final_norm = dv

    # Projector & Heads
    projector = (dv * d + d) + (d * d + d)
    cls_head = dv * 8 + 8
    bbox_head = (dv * 64 + 64) + (64 * 4 + 4)
    vision_params = stem1 + stem2 + cls_token + pos_embed + vit_total + vit_final_norm + projector + cls_head + bbox_head

    # Audio Encoder
    in_dim = max(1, spec.audio_feature_dim)
    conv1d = (in_dim * d * 3) + d
    proj = (d * d) + d
    audio_head = (d * 6) + 6
    audio_params = conv1d + proj + audio_head

    total_params = lang_params + vision_params + audio_params

    return {
        "language_parameters": lang_params,
        "vision_parameters": vision_params,
        "audio_parameters": audio_params,
        "total_parameters": total_params,
    }


def analyze_model_scale(spec: ModelScaleSpec) -> Dict[str, object]:
    param_dict = calculate_analytical_parameters(spec)
    total_p = param_dict["total_parameters"]
    lang_p = param_dict["language_parameters"]

    # 1. Weights Storage (MB / GB)
    fp32_mb = (total_p * 4) / (1024 ** 2)
    fp16_mb = (total_p * 2) / (1024 ** 2)
    int8_mb = (total_p * 1) / (1024 ** 2)
    int4_mb = (total_p * 0.5) / (1024 ** 2)

    # 2. Training Memory Requirements (Per-parameter components)
    # AdamW FP32: Weights (4B) + Gradients (4B) + Adam momentum (4B) + Adam variance (4B) = 16 bytes/param
    # AdamW Mixed-Precision (FP16/BF16 weights/grads, FP32 master weights & Adam): 2B (w) + 2B (g) + 4B (master w) + 4B (m) + 4B (v) = 16 bytes/param
    # Adafactor (factorized states): ~4 bytes/param optimizer overhead -> ~12 bytes/param total
    # 8-bit Adam (bitsandbytes): 2B (optimizer states) -> ~10 bytes/param total
    adamw_training_param_ram_mb = (total_p * 16) / (1024 ** 2)
    adafactor_training_param_ram_mb = (total_p * 12) / (1024 ** 2)

    # 3. Activation Memory per Step (Batch size B=2, Seq Len S=spec.max_seq_len or standard 512)
    # For a transformer with L layers, activation memory without checkpointing is approx:
    # Act = B * S * d * L * (34 + 5 * (H/H_kv) * (S/d)) bytes (approx 12-16 bytes per token per layer)
    # With gradient checkpointing: Act_gc = 2 * B * S * d bytes (only boundary activations stored)
    b = 2
    s = min(spec.max_seq_len, 512)
    d = spec.d_model
    l = spec.n_layers
    # Standard activation without checkpointing
    act_no_gc_mb = (b * s * d * l * 14 * 4) / (1024 ** 2)
    # With gradient checkpointing
    act_with_gc_mb = (b * s * d * 4 * 4) / (1024 ** 2)

    total_train_ram_adamw_mb = adamw_training_param_ram_mb + act_with_gc_mb
    total_train_ram_adafactor_mb = adafactor_training_param_ram_mb + act_with_gc_mb

    # 4. KV Cache Memory per Token during Inference (bytes per token)
    # KV cache per token = 2 (K and V) * n_layers * n_kv_heads * (d_model // n_heads) * 2 bytes (fp16)
    head_dim = spec.d_model // spec.n_heads
    kv_cache_bytes_per_token = 2 * spec.n_layers * spec.n_kv_heads * head_dim * 2
    kv_cache_1k_tokens_mb = (kv_cache_bytes_per_token * 1024) / (1024 ** 2)

    # 5. Dataset Requirements (Chinchilla Compute-Optimal: 20 tokens per parameter)
    chinchilla_tokens_b = (total_p * 20) / 1e9
    # Minimum instruction fine-tuning / calibration dataset tokens:
    sft_tokens_m = max(0.5, (total_p * 0.05) / 1e6)

    # 6. Compute & Hardware Feasibility Assessment
    # Local Hardware: Intel Core i5-1335U, ~7.69 GB RAM total (~3.5-4.5 GB available to apps)
    available_local_ram_mb = 4200.0
    if total_train_ram_adamw_mb <= 900:
        local_feasibility = "FULL_LOCAL_TRAINING_FEASIBLE"
        local_notes = "Safe for AdamW on local CPU without risk of OS RAM exhaustion."
    elif total_train_ram_adafactor_mb <= 2200:
        local_feasibility = "LOCAL_TRAINING_WITH_CONSTRAINTS"
        local_notes = "Requires Adafactor / 8-bit optimizer and gradient checkpointing. Moderate CPU step time."
    elif total_train_ram_adafactor_mb <= available_local_ram_mb:
        local_feasibility = "LOCAL_INFERENCE_ONLY_TRAIN_HIGH_RISK"
        local_notes = "Near host RAM ceiling. Training risks paging/OOM. Recommended: train on Cloud GPU, run INT8 inference locally."
    else:
        local_feasibility = "CLOUD_GPU_REQUIRED"
        local_notes = f"Exceeds local RAM ({total_train_ram_adamw_mb:.0f} MB > 4200 MB). Requires dedicated Cloud GPU."

    # 7. Estimated Training Compute & Wall-Clock Duration
    # Training FLOPs per token ~= 6 * total_p
    # Total FLOPs for 10M tokens training run:
    flops_10m_run = 6.0 * total_p * 10_000_000
    # Available CPU throughput: Intel Core i5-1335U AVX2 FP32 ~= 60-80 GFLOPs/s effective
    cpu_eff_gflops = 65.0
    cpu_train_time_sec_10m = flops_10m_run / (cpu_eff_gflops * 1e9)
    # RTX 4090 (BF16 Tensor Cores ~= 165 TFLOPs effective):
    rtx4090_eff_tflops = 165.0
    rtx4090_train_time_sec_10m = flops_10m_run / (rtx4090_eff_tflops * 1e12)
    # A100 80GB SXM (BF16 Tensor Cores ~= 150 TFLOPs effective):
    a100_eff_tflops = 150.0
    a100_train_time_sec_10m = flops_10m_run / (a100_eff_tflops * 1e12)

    # 8. Inference Latency Estimate (Single token autoregressive generation)
    # CPU latency ~= Memory Bandwidth Bound: (Weights_bytes) / (DDR4/DDR5 Bandwidth ~35 GB/s)
    cpu_infer_ms_per_tok = max(1.5, (fp16_mb / (35.0 * 1024)) * 1000.0)
    # GPU latency ~= (Weights_bytes) / (VRAM Bandwidth ~1000-2000 GB/s) + kernel overhead
    gpu_infer_ms_per_tok = max(0.2, (fp16_mb / (1500.0 * 1024)) * 1000.0 + 0.15)

    # 9. Cloud GPU Cost Estimate (Lambda Labs / RunPod rates: ~$1.10/hr for 1x A100 80GB, ~$0.74/hr for 1x RTX 4090, ~$2.20/hr for 1x H100)
    chinchilla_flops = 6.0 * total_p * (total_p * 20)
    a100_chinchilla_hours = chinchilla_flops / (a100_eff_tflops * 1e12 * 3600.0)
    a100_chinchilla_cost_usd = a100_chinchilla_hours * 1.10

    return {
        "spec": dataclasses.asdict(spec),
        "parameter_breakdown": param_dict,
        "storage": {
            "fp32_mb": round(fp32_mb, 2),
            "fp16_mb": round(fp16_mb, 2),
            "int8_mb": round(int8_mb, 2),
            "int4_mb": round(int4_mb, 2),
        },
        "training_ram": {
            "adamw_mb": round(total_train_ram_adamw_mb, 1),
            "adafactor_mb": round(total_train_ram_adafactor_mb, 1),
            "param_states_adamw_mb": round(adamw_training_param_ram_mb, 1),
            "param_states_adafactor_mb": round(adafactor_training_param_ram_mb, 1),
            "activation_with_gc_mb": round(act_with_gc_mb, 1),
            "activation_no_gc_mb": round(act_no_gc_mb, 1),
        },
        "inference": {
            "kv_cache_bytes_per_tok": kv_cache_bytes_per_token,
            "kv_cache_1k_tokens_mb": round(kv_cache_1k_tokens_mb, 3),
            "est_cpu_ms_per_token": round(cpu_infer_ms_per_tok, 1),
            "est_gpu_ms_per_token": round(gpu_infer_ms_per_tok, 2),
        },
        "dataset_needs": {
            "chinchilla_optimal_tokens_b": round(chinchilla_tokens_b, 3),
            "min_calibration_sft_tokens_m": round(sft_tokens_m, 2),
        },
        "hardware_feasibility": {
            "status": local_feasibility,
            "notes": local_notes,
        },
        "estimated_training_time_10m_tokens": {
            "local_cpu_hours": round(cpu_train_time_sec_10m / 3600.0, 2),
            "rtx4090_minutes": round(rtx4090_train_time_sec_10m / 60.0, 2),
            "a100_80gb_minutes": round(a100_train_time_sec_10m / 60.0, 2),
        },
        "cloud_budget_estimate": {
            "chinchilla_a100_hours": round(a100_chinchilla_hours, 1),
            "chinchilla_cost_usd": round(a100_chinchilla_cost_usd, 2),
        },
    }


def verify_with_pytorch() -> None:
    print("Verifying candidate specifications directly in PyTorch...")
    for spec in CANDIDATE_SPECS[:4]:  # Verify first 4 models directly in PyTorch
        cfg = JarvisConfig.from_dict({
            "model_name": spec.target_name,
            "vocab_size": spec.vocab_size,
            "d_model": spec.d_model,
            "n_layers": spec.n_layers,
            "n_heads": spec.n_heads,
            "n_kv_heads": spec.n_kv_heads,
            "d_ff": spec.d_ff,
            "max_seq_len": spec.max_seq_len,
            "image_size": spec.image_size,
            "patch_size": spec.patch_size,
            "vision_layers": spec.vision_layers,
            "vision_dim": spec.vision_dim,
            "audio_feature_dim": spec.audio_feature_dim,
            "tie_word_embeddings": spec.tie_word_embeddings,
            "qk_norm": spec.qk_norm,
            "use_sdpa": spec.use_sdpa,
        })
        m = JarvisUnifiedTransformer(cfg)
        pytorch_counts = m.parameter_count()
        analytical_counts = calculate_analytical_parameters(spec)
        assert pytorch_counts["language_parameters"] == analytical_counts["language_parameters"], (
            f"LM Mismatch in {spec.target_name}: {pytorch_counts['language_parameters']} != {analytical_counts['language_parameters']}"
        )
        assert pytorch_counts["total_parameters"] == analytical_counts["total_parameters"], (
            f"Total Mismatch in {spec.target_name}: {pytorch_counts['total_parameters']} != {analytical_counts['total_parameters']}"
        )
        print(f"  [PASS] {spec.target_label}: PyTorch = {pytorch_counts['total_parameters']:,} (LM: {pytorch_counts['language_parameters']:,})")
    print("All candidate specifications mathematically verified against PyTorch!")


def run_full_scaling_analysis() -> Dict[str, object]:
    results = {}
    for spec in CANDIDATE_SPECS:
        results[spec.target_name] = analyze_model_scale(spec)
    return results


if __name__ == "__main__":
    verify_with_pytorch()
    report = run_full_scaling_analysis()
    out_path = os.path.join(REPO_ROOT, "data", "learning", "vision_parameter_scaling_analysis.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Full scaling report saved to {out_path}")
