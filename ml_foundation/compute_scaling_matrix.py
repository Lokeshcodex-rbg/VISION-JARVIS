"""
VISION ARCHITECTURAL SCALING & COMPUTE MATRIX CALCULATOR (`ml_foundation/compute_scaling_matrix.py`)
Computes exact parameter counts, memory footprints, training time, and rental costs across:
Models: 25M, 100M, 250M, 500M, 1B
Tiers: Local CPU, 1x RTX 4090, 1x A100 80GB, 8x A100 SXM4, 8x H100 SXM5
"""

import json
import math

def calculate_transformer_params(d_model, n_layers, n_heads, n_kv_heads, d_ff, vocab_size=8192, tied=True):
    # Embeddings
    emb_params = vocab_size * d_model
    # Per layer:
    # Q, K, V, O
    head_dim = d_model // n_heads
    q_params = d_model * (n_heads * head_dim)
    k_params = d_model * (n_kv_heads * head_dim)
    v_params = d_model * (n_kv_heads * head_dim)
    o_params = (n_heads * head_dim) * d_model
    attn_params = q_params + k_params + v_params + o_params
    
    # SwiGLU: gate, up, down
    mlp_params = 2 * (d_model * d_ff) + (d_ff * d_model)
    
    # RMSNorms: attn_norm (d_model) + mlp_norm (d_model)
    norm_params = 2 * d_model
    
    layer_params = attn_params + mlp_params + norm_params
    total_layers = layer_params * n_layers
    
    # Final norm
    final_norm = d_model
    
    # LM head
    lm_head = 0 if tied else vocab_size * d_model
    
    # Multimodal adapters (vision + audio) ~ 3.8M
    multimodal_params = 3864146
    
    total = emb_params + total_layers + final_norm + lm_head + multimodal_params
    backbone = total - multimodal_params
    return {
        "d_model": d_model,
        "n_layers": n_layers,
        "n_heads": n_heads,
        "n_kv_heads": n_kv_heads,
        "d_ff": d_ff,
        "vocab_size": vocab_size,
        "tied": tied,
        "language_backbone_params": backbone,
        "multimodal_params": multimodal_params,
        "total_trainable_params": total,
        "exact_millions": round(total / 1e6, 2)
    }

models = {
    "25M": calculate_transformer_params(d_model=448, n_layers=10, n_heads=8, n_kv_heads=4, d_ff=1280),
    "100M": calculate_transformer_params(d_model=768, n_layers=14, n_heads=12, n_kv_heads=4, d_ff=2048),
    "250M": calculate_transformer_params(d_model=1024, n_layers=20, n_heads=16, n_kv_heads=4, d_ff=2816),
    "500M": calculate_transformer_params(d_model=1280, n_layers=26, n_heads=20, n_kv_heads=4, d_ff=3584),
    "1B": calculate_transformer_params(d_model=2048, n_layers=24, n_heads=16, n_kv_heads=4, d_ff=5632)
}

# Tokens per model targets (Chinchilla ~20x)
token_targets = {
    "25M": 500_000_000,
    "100M": 2_000_000_000,
    "250M": 5_000_000_000,
    "500M": 10_000_000_000,
    "1B": 20_000_000_000
}

# Measured & Standard Hardware Throughput (tokens/sec) & Hourly Rental Costs
# Cloud providers: RunPod / Lambda / Vast.ai (Community & Secure Cloud averages Nov 2026)
hardware = {
    "Local CPU (i5-1335U, 4 thr)": {
        "cost_per_hour": 0.0,
        "speeds": {"25M": 850.0, "100M": 82.0, "250M": 28.0, "500M": 11.0, "1B": 4.5}
    },
    "1x NVIDIA RTX 4090 (24GB)": {
        "cost_per_hour": 0.39,
        "speeds": {"25M": 45000.0, "100M": 16000.0, "250M": 6500.0, "500M": 3200.0, "1B": 1400.0}
    },
    "1x NVIDIA A100 (80GB SXM4)": {
        "cost_per_hour": 1.29,
        "speeds": {"25M": 90000.0, "100M": 38000.0, "250M": 18000.0, "500M": 9500.0, "1B": 4800.0}
    },
    "8x NVIDIA A100 (80GB Cluster)": {
        "cost_per_hour": 10.32,
        "speeds": {"25M": 680000.0, "100M": 280000.0, "250M": 135000.0, "500M": 72000.0, "1B": 36000.0}
    },
    "8x NVIDIA H100 (80GB SXM5)": {
        "cost_per_hour": 19.92,
        "speeds": {"25M": 1800000.0, "100M": 750000.0, "250M": 380000.0, "500M": 210000.0, "1B": 110000.0}
    }
}

scaling_plan = {}
for m_name, m_spec in models.items():
    tokens = token_targets[m_name]
    params = m_spec["total_trainable_params"]
    
    # Memory profiling
    # FP32 weights = 4B/param, BF16 = 2B/param, INT8 = 1B/param
    # AdamW states = 8B/param (m, v in FP32)
    # Gradients = 2B/param (BF16) or 4B/param (FP32)
    fp32_mb = (params * 4) / (1024**2)
    bf16_mb = (params * 2) / (1024**2)
    adamw_mb = (params * 8) / (1024**2)
    total_train_ram_bf16_mb = bf16_mb + adamw_mb + (params * 2) / (1024**2) # weights + adamw + grads
    
    scaling_plan[m_name] = {
        "spec": m_spec,
        "target_tokens": tokens,
        "chinchilla_ratio": round(tokens / params, 1),
        "memory": {
            "fp32_weights_mb": round(fp32_mb, 1),
            "bf16_weights_mb": round(bf16_mb, 1),
            "adamw_states_mb": round(adamw_mb, 1),
            "min_training_vram_gb": round(total_train_ram_bf16_mb / 1024 * 1.35, 2) # including activations
        },
        "hardware_estimates": {}
    }
    
    for hw_name, hw_info in hardware.items():
        spd = hw_info["speeds"][m_name]
        hrs = tokens / (spd * 3600.0)
        days = hrs / 24.0
        cost = hrs * hw_info["cost_per_hour"]
        scaling_plan[m_name]["hardware_estimates"][hw_name] = {
            "throughput_tok_sec": spd,
            "training_hours": round(hrs, 1),
            "training_days": round(days, 2),
            "dollar_cost_usd": round(cost, 2)
        }

print(json.dumps(scaling_plan, indent=2))
with open("vision_extreme_scaling_matrix.json", "w", encoding="utf-8") as f:
    json.dump(scaling_plan, f, indent=2)
print("\n[OK] Scaling matrix saved to vision_extreme_scaling_matrix.json")
