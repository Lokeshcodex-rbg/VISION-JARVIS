"""
BUILD PRETRAINING CONFIGURATION (ml_foundation/build_pretraining_configuration.py)
Validates architectural parameters and outputs VISION_PRETRAINING_CONFIGURATION.json.
"""

import os
import sys
import json
import torch

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer

SCALING_TIERS = {
    "27.76M": {
        "tier": "27.76M",
        "d_model": 448,
        "n_layers": 10,
        "n_heads": 8,
        "n_kv_heads": 4,
        "d_ff": 1280,
        "vocab_size": 8192,
        "max_seq_len": 512,
        "tie_word_embeddings": True,
        "dropout": 0.05,
        "token_target": 555_000_000,
        "chinchilla_ratio": 20.0,
        "learning_rate_max": 3.0e-4,
        "learning_rate_min": 3.0e-5,
        "warmup_steps": 2000,
        "weight_decay": 0.01,
        "grad_clip": 1.0,
        "role": "Validation Foundation Model & Local Edge Backbone"
    },
    "98.26M": {
        "tier": "98.26M",
        "d_model": 768,
        "n_layers": 14,
        "n_heads": 12,
        "n_kv_heads": 4,
        "d_ff": 2048,
        "vocab_size": 8192,
        "max_seq_len": 2048,
        "tie_word_embeddings": True,
        "dropout": 0.05,
        "token_target": 2_000_000_000,
        "chinchilla_ratio": 20.35,
        "learning_rate_max": 2.0e-4,
        "learning_rate_min": 2.0e-5,
        "warmup_steps": 5000,
        "weight_decay": 0.01,
        "grad_clip": 1.0,
        "role": "Core Foundation Model (Production Primary)"
    },
    "250M": {
        "tier": "250M",
        "d_model": 1024,
        "n_layers": 20,
        "n_heads": 16,
        "n_kv_heads": 4,
        "d_ff": 2816,
        "vocab_size": 8192,
        "max_seq_len": 4096,
        "tie_word_embeddings": True,
        "dropout": 0.05,
        "token_target": 5_000_000_000,
        "chinchilla_ratio": 19.93,
        "learning_rate_max": 1.5e-4,
        "learning_rate_min": 1.5e-5,
        "warmup_steps": 8000,
        "weight_decay": 0.01,
        "grad_clip": 1.0,
        "role": "Intermediate Scaling Frontier"
    },
    "500M": {
        "tier": "500M",
        "d_model": 1536,
        "n_layers": 24,
        "n_heads": 16,
        "n_kv_heads": 4,
        "d_ff": 4096,
        "vocab_size": 8192,
        "max_seq_len": 4096,
        "tie_word_embeddings": True,
        "dropout": 0.05,
        "token_target": 10_000_000_000,
        "chinchilla_ratio": 19.83,
        "learning_rate_max": 1.0e-4,
        "learning_rate_min": 1.0e-5,
        "warmup_steps": 12000,
        "weight_decay": 0.01,
        "grad_clip": 1.0,
        "role": "Scaled High-Capacity Foundation"
    },
    "1B": {
        "tier": "1B",
        "d_model": 2048,
        "n_layers": 28,
        "n_heads": 16,
        "n_kv_heads": 4,
        "d_ff": 5632,
        "vocab_size": 8192,
        "max_seq_len": 4096,
        "tie_word_embeddings": True,
        "dropout": 0.05,
        "token_target": 20_000_000_000,
        "chinchilla_ratio": 19.56,
        "learning_rate_max": 8.0e-5,
        "learning_rate_min": 8.0e-6,
        "warmup_steps": 15000,
        "weight_decay": 0.01,
        "grad_clip": 1.0,
        "role": "Flagship Sovereign Foundation Model"
    }
}

def verify_and_build_configs():
    print("==================================================")
    print("VERIFYING ARCHITECTURES AND PARAMETER COUNTS")
    print("==================================================")

    validated_tiers = {}
    for name, params in SCALING_TIERS.items():
        cfg = JarvisConfig(
            vocab_size=params["vocab_size"],
            d_model=params["d_model"],
            n_layers=params["n_layers"],
            n_heads=params["n_heads"],
            n_kv_heads=params["n_kv_heads"],
            d_ff=params["d_ff"],
            max_seq_len=params["max_seq_len"],
            dropout=params["dropout"],
            tie_word_embeddings=params["tie_word_embeddings"]
        )
        cfg.validate()
        model = JarvisUnifiedTransformer(cfg)
        exact_params = sum(p.numel() for p in model.parameters())
        trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)

        print(f"Tier {name:8s} -> Exact Params: {exact_params:,} ({exact_params/1e6:.2f}M) | Target Tokens: {params['token_target']:,}")
        
        info = dict(params)
        info["exact_total_parameters"] = exact_params
        info["exact_trainable_parameters"] = trainable_params
        info["architecture_summary"] = {
            "attention_mechanism": "Grouped-Query Attention (GQA)",
            "gqa_head_ratio": f"{params['n_heads'] // params['n_kv_heads']}:1",
            "activation_function": "SwiGLU",
            "normalization": "RMSNorm (pre-norm)",
            "positional_embeddings": "RoPE (Rotary Position Embeddings)",
            "weight_tying": params["tie_word_embeddings"],
            "hidden_dimension": params["d_model"],
            "intermediate_dimension": params["d_ff"],
            "layer_count": params["n_layers"]
        }
        validated_tiers[name] = info

    out_file = os.path.join(REPO_ROOT, "VISION_PRETRAINING_CONFIGURATION.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({
            "program": "VISION Billion-Token Pretraining Architecture & Hyperparameters",
            "timestamp": "2026-11-22T10:20:00Z",
            "scaling_ladder": validated_tiers,
            "pipeline_specifications": {
                "loss_function": "CrossEntropyLoss(ignore_index=pad_id, reduction='mean')",
                "optimizer": "AdamW(betas=(0.9, 0.95), eps=1e-8, weight_decay=0.01)",
                "learning_rate_schedule": "Linear Warmup followed by Cosine Annealing to lr_min",
                "gradient_clipping": "1.0 (L2 norm)",
                "mixed_precision": "bfloat16 on supported Ampere/Hopper GPUs, fp32 on CPU",
                "checkpointing": "Atomic write to tmp file with os.replace and SHA-256 verification",
                "reasoning_token_policy": "Verifiable mathematical steps and code only; NO literal <think> or hidden CoT"
            }
        }, f, indent=2)

    print(f"\nSaved configuration to {out_file}")

if __name__ == "__main__":
    verify_and_build_configs()
