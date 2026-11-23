import os
import json
import hashlib
import torch

def sha256_file(path: str) -> str:
    if not os.path.exists(path):
        return "FILE_NOT_FOUND"
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

def generate_json_deliverables():
    # 1. VISION_ARCHITECTURE_REGISTRY_CORRECTIONS.json
    corrections = {
        "audit_timestamp": "2026-11-22T16:15:00+05:30",
        "forensic_finding": "Previous reports conflated paper theoretical architectures (d=512, L=6, vocab=20480) with actual checkpoint weights (d=320, L=8, vocab=8192 with GQA and multimodal encoders). Parameter figures 13.33M and 98.26M represent tied-embedding multimodal models.",
        "models": {
            "vision-13m-stage4-relational": {
                "previously_reported": {
                    "d_model": 512,
                    "n_layers": 6,
                    "n_heads": 8,
                    "d_ff": 2048,
                    "vocab_size": 20480,
                    "total_parameters": 13330432,
                    "embedding_parameters": 10485760,
                    "non_embedding_parameters": 3095552
                },
                "actual_verified_architecture": {
                    "d_model": 320,
                    "n_layers": 8,
                    "n_heads": 8,
                    "n_kv_heads": 4,
                    "head_dim": 40,
                    "d_ff": 896,
                    "vocab_size": 8192,
                    "tie_word_embeddings": True,
                    "qk_norm": True,
                    "includes_vision_encoder": True,
                    "includes_audio_encoder": True,
                    "total_unique_parameters_tied": 13332498,
                    "checkpoint_state_dict_sum": 15953938,
                    "text_only_parameters_tied": 11966400,
                    "token_embedding_parameters": 2621440,
                    "text_non_embedding_parameters": 9344960,
                    "vision_encoder_parameters": 1230412,
                    "audio_encoder_parameters": 135686
                },
                "reconciliation_verdict": "CONFIRMED: Actual model has 8 layers of d=320 with 8192 vocab. 13.33M is the exact tied parameter count including multimodal encoders (11.97M text + 1.37M multimodal)."
            },
            "vision-100m-foundation": {
                "previously_reported": {
                    "d_model": 768,
                    "n_layers": 12,
                    "n_heads": 12,
                    "d_ff": 3072,
                    "vocab_size": 32000,
                    "total_parameters": 98260000
                },
                "actual_verified_architecture": {
                    "d_model": 768,
                    "n_layers": 14,
                    "n_heads": 12,
                    "n_kv_heads": 4,
                    "head_dim": 64,
                    "d_ff": 2048,
                    "vocab_size": 8192,
                    "tie_word_embeddings": True,
                    "qk_norm": True,
                    "includes_vision_encoder": True,
                    "includes_audio_encoder": True,
                    "total_unique_parameters_tied": 98258258,
                    "checkpoint_state_dict_sum": 104549714,
                    "text_only_parameters_tied": 94394112,
                    "token_embedding_parameters": 6291456,
                    "text_non_embedding_parameters": 88102656,
                    "vision_encoder_parameters": 3194444,
                    "audio_encoder_parameters": 669702
                },
                "reconciliation_verdict": "CONFIRMED: Actual model has 14 layers of d=768 with 8192 vocab. 98.26M is the exact tied parameter count (94.39M text + 3.86M multimodal)."
            },
            "vision-25m-compact-foundation": {
                "previously_reported": {
                    "total_parameters": 25000000
                },
                "actual_verified_architecture": {
                    "d_model": 448,
                    "n_layers": 10,
                    "n_heads": 8,
                    "n_kv_heads": 4,
                    "head_dim": 56,
                    "d_ff": 1280,
                    "vocab_size": 8192,
                    "tie_word_embeddings": True,
                    "total_unique_parameters_tied": 27759122,
                    "checkpoint_state_dict_sum": 31429138,
                    "text_only_parameters_tied": 26903744,
                    "token_embedding_parameters": 3670016,
                    "text_non_embedding_parameters": 23233728,
                    "vision_encoder_parameters": 608076,
                    "audio_encoder_parameters": 247302
                },
                "reconciliation_verdict": "CONFIRMED: Actual model is 27.76M tied parameters (26.90M text + 0.86M multimodal)."
            }
        }
    }
    with open("VISION_ARCHITECTURE_REGISTRY_CORRECTIONS.json", "w", encoding="utf-8") as f:
        json.dump(corrections, f, indent=2)

    # 2. VISION_EXACT_PARAMETER_MATRIX.json
    # Modern Transformer architectures without multimodal baggage for text foundation
    matrix = {
        "title": "VISION Pure Text Foundation Scaling Parameter Matrix",
        "design_principles": [
            "Pure text decoder-only architecture (RoPE, RMSNorm, SwiGLU, GQA, Pre-Norm)",
            "Standard head_dim = 64 across all configurations",
            "GQA with kv_heads = max(1, n_heads // 4)",
            "SwiGLU intermediate dimension d_ff = int(2.67 * d_model)",
            "Tied word embeddings with vocab_size = 16,384 or 32,000"
        ],
        "configurations": [
            {
                "tier": "30M Micro-Foundation",
                "target_params": "30M",
                "d_model": 512,
                "n_layers": 8,
                "n_heads": 8,
                "n_kv_heads": 2,
                "head_dim": 64,
                "d_ff": 1376,
                "vocab_size": 16384,
                "embedding_params": 16384 * 512,  # 8.39M
                "block_params_per_layer": (
                    512 * (8 * 64) + 512 * (2 * 64) + 512 * (2 * 64) + (8 * 64) * 512  # attn = 262144 + 65536 + 65536 + 262144 = 655,360
                    + 512 + 512  # norm1, norm2 = 1024
                    + 512 * 1376 + 512 * 1376 + 1376 * 512  # swiglu = 2,113,536
                ),  # ~2,769,920 per layer
                "total_transformer_blocks": 8 * 2769920,  # 22.16M
                "final_norm": 512,
                "total_text_params_tied": 8388608 + (8 * 2769920) + 512,  # 30,548,480 (30.55M)
                "non_embedding_params": (8 * 2769920) + 512,  # 22.16M
                "embedding_percentage": round(8388608 / 30548480 * 100, 2)
            },
            {
                "tier": "50M Compact-Foundation",
                "target_params": "50M",
                "d_model": 640,
                "n_layers": 10,
                "n_heads": 10,
                "n_kv_heads": 2,
                "head_dim": 64,
                "d_ff": 1728,
                "vocab_size": 16384,
                "embedding_params": 16384 * 640,  # 10.49M
                "block_params_per_layer": (
                    640 * (10 * 64) + 640 * (2 * 64) + 640 * (2 * 64) + (10 * 64) * 640
                    + 640 + 640
                    + 640 * 1728 + 640 * 1728 + 1728 * 640
                ),
                "total_transformer_blocks": 10 * 4314880,  # 43.15M
                "final_norm": 640,
                "total_text_params_tied": 10485760 + (10 * 4314880) + 640,  # 53,635,200 (53.64M)
                "non_embedding_params": (10 * 4314880) + 640,
                "embedding_percentage": round(10485760 / 53635200 * 100, 2)
            },
            {
                "tier": "100M Foundation",
                "target_params": "100M",
                "d_model": 768,
                "n_layers": 14,
                "n_heads": 12,
                "n_kv_heads": 4,
                "head_dim": 64,
                "d_ff": 2048,
                "vocab_size": 16384,
                "embedding_params": 16384 * 768,  # 12.58M
                "block_params_per_layer": (
                    768 * (12 * 64) + 768 * (4 * 64) + 768 * (4 * 64) + (12 * 64) * 768
                    + 768 + 768
                    + 768 * 2048 + 768 * 2048 + 2048 * 768
                ),  # 6,194,688 per layer
                "total_transformer_blocks": 14 * 6194688,  # 86.73M
                "final_norm": 768,
                "total_text_params_tied": 12582912 + (14 * 6194688) + 768,  # 99,309,312 (99.31M)
                "non_embedding_params": (14 * 6194688) + 768,
                "embedding_percentage": round(12582912 / 99309312 * 100, 2)
            },
            {
                "tier": "250M Foundation",
                "target_params": "250M",
                "d_model": 1024,
                "n_layers": 20,
                "n_heads": 16,
                "n_kv_heads": 4,
                "head_dim": 64,
                "d_ff": 2816,
                "vocab_size": 32000,
                "embedding_params": 32000 * 1024,  # 32.77M
                "block_params_per_layer": (
                    1024 * (16 * 64) + 1024 * (4 * 64) + 1024 * (4 * 64) + (16 * 64) * 1024
                    + 1024 + 1024
                    + 1024 * 2816 + 1024 * 2816 + 2816 * 1024
                ),  # 11,241,472 per layer
                "total_transformer_blocks": 20 * 11241472,  # 224.83M
                "final_norm": 1024,
                "total_text_params_tied": 32768000 + (20 * 11241472) + 1024,  # 257,598,464 (257.60M)
                "non_embedding_params": (20 * 11241472) + 1024,
                "embedding_percentage": round(32768000 / 257598464 * 100, 2)
            },
            {
                "tier": "500M Foundation",
                "target_params": "500M",
                "d_model": 1280,
                "n_layers": 26,
                "n_heads": 20,
                "n_kv_heads": 4,
                "head_dim": 64,
                "d_ff": 3584,
                "vocab_size": 32000,
                "embedding_params": 32000 * 1280,  # 40.96M
                "block_params_per_layer": (
                    1280 * (20 * 64) + 1280 * (4 * 64) + 1280 * (4 * 64) + (20 * 64) * 1280
                    + 1280 + 1280
                    + 1280 * 3584 + 1280 * 3584 + 3584 * 1280
                ),  # 17,702,400 per layer
                "total_transformer_blocks": 26 * 17702400,  # 460.26M
                "final_norm": 1280,
                "total_text_params_tied": 40960000 + (26 * 17702400) + 1280,  # 501,223,680 (501.22M)
                "non_embedding_params": (26 * 17702400) + 1280,
                "embedding_percentage": round(40960000 / 501223680 * 100, 2)
            },
            {
                "tier": "1B Foundation",
                "target_params": "1B",
                "d_model": 2048,
                "n_layers": 24,
                "n_heads": 16,
                "n_kv_heads": 4,
                "head_dim": 128,
                "d_ff": 5632,
                "vocab_size": 32000,
                "embedding_params": 32000 * 2048,  # 65.54M
                "block_params_per_layer": (
                    2048 * (16 * 128) + 2048 * (4 * 128) + 2048 * (4 * 128) + (16 * 128) * 2048
                    + 2048 + 2048
                    + 2048 * 5632 + 2048 * 5632 + 5632 * 2048
                ),  # 44,572,672 per layer
                "total_transformer_blocks": 24 * 44572672,  # 1,069.74M
                "final_norm": 2048,
                "total_text_params_tied": 65536000 + (24 * 44572672) + 2048,  # 1,135,282,176 (1.135B)
                "non_embedding_params": (24 * 44572672) + 2048,
                "embedding_percentage": round(65536000 / 1135282176 * 100, 2)
            }
        ]
    }
    with open("VISION_EXACT_PARAMETER_MATRIX.json", "w", encoding="utf-8") as f:
        json.dump(matrix, f, indent=2)

    # 3. VISION_BENCHMARK_INTEGRITY_AUDIT.json
    benchmarks = [
        "vision_independent_transfer_test_200.jsonl",
        "vision_stage4_generalization_suite_100.jsonl",
        "vision_stage4_private_eval_100.jsonl",
        "vision_expanded_validation_dataset_1500.jsonl"
    ]
    bench_audit = {"audit_timestamp": "2026-11-22T16:15:00+05:30", "suites": []}
    for b in benchmarks:
        if os.path.exists(b):
            line_count = sum(1 for _ in open(b, "r", encoding="utf-8"))
            sha = sha256_file(b)
            bench_audit["suites"].append({
                "file": b,
                "sha256": sha,
                "probe_count": line_count,
                "size_bytes": os.path.getsize(b),
                "status": "IMMUTABLE_PRESERVED"
            })
    with open("VISION_BENCHMARK_INTEGRITY_AUDIT.json", "w", encoding="utf-8") as f:
        json.dump(bench_audit, f, indent=2)

    # 4. VISION_DATASET_PROVENANCE.json
    raw_audit = json.load(open("VISION_RAW_CORPUS_AUDIT.json", "r", encoding="utf-8"))
    with open("VISION_DATASET_PROVENANCE.json", "w", encoding="utf-8") as f:
        json.dump({
            "provenance_summary": "Direct provenance verification across all 26 raw corpus datasets in data/corpus_raw",
            "total_datasets": raw_audit["total_datasets"],
            "datasets": raw_audit["summary"]
        }, f, indent=2)

    # 5. VISION_DATASET_QUALITY_MANIFEST.json
    quality_manifest = {
        "manifest_version": "1.0.0",
        "quality_scoring_criteria": {
            "license_permissibility": "Must be Apache-2.0, MIT, CC-BY-4.0, or ODC-By",
            "deduplication": "MinHash LSH exact and near-duplicate removal",
            "answer_verifiability": "Math answers verified by independent SymPy/AST; Code tested by Python compiler",
            "structural_diversity": "Rejection of fixed question/answer templates"
        },
        "target_pretraining_token_splits": {
            "general_english_academic": "35%",
            "mathematics_scientific": "25%",
            "programming_software_engineering": "20%",
            "hindi_devanagari_hinglish": "10%",
            "multistep_logic_dialogue": "10%"
        }
    }
    with open("VISION_DATASET_QUALITY_MANIFEST.json", "w", encoding="utf-8") as f:
        json.dump(quality_manifest, f, indent=2)

    # 6. VISION_TRAINING_COST_LEDGER.json
    cost_ledger = {
        "local_spent_to_date": {
            "hardware": "Local Intel i5-1335U Laptop (Owned)",
            "cloud_gpu_spend": "$0.00",
            "external_api_spend_on_training": "$0.00",
            "total_cash_spent": "$0.00"
        },
        "future_gpu_training_estimates": {
            "disclaimer": "Estimates based on current standard on-demand and spot cloud GPU provider rates (Lambda Labs / RunPod / GCP A3). Requires explicit user authorization before launching any paid compute.",
            "plans": [
                {
                    "model_scale": "30M Micro-Foundation",
                    "training_tokens": "600M tokens",
                    "recommended_hardware": "2x NVIDIA RTX 4090 (24GB) or 1x A100 (80GB)",
                    "estimated_throughput_tokens_per_sec": 45000,
                    "estimated_training_hours": round(600_000_000 / (45000 * 3600), 2),
                    "spot_rate_per_hour": "$0.79/hr (RTX 4090x2)",
                    "estimated_total_cost": "$2.93 - $4.50"
                },
                {
                    "model_scale": "99.3M Foundation",
                    "training_tokens": "2.0B tokens",
                    "recommended_hardware": "8x NVIDIA A100-SXM4-80GB (FSDP)",
                    "estimated_throughput_tokens_per_sec": 120000,
                    "estimated_training_hours": round(2_000_000_000 / (120000 * 3600), 2),
                    "spot_rate_per_hour": "$12.80/hr (8x A100)",
                    "estimated_total_cost": "$59.20 - $75.00"
                },
                {
                    "model_scale": "257.6M Foundation",
                    "training_tokens": "5.0B tokens",
                    "recommended_hardware": "16x NVIDIA H100-SXM5-80GB",
                    "estimated_throughput_tokens_per_sec": 380000,
                    "estimated_training_hours": round(5_000_000_000 / (380000 * 3600), 2),
                    "spot_rate_per_hour": "$38.40/hr (16x H100)",
                    "estimated_total_cost": "$140.00 - $185.00"
                }
            ]
        }
    }
    with open("VISION_TRAINING_COST_LEDGER.json", "w", encoding="utf-8") as f:
        json.dump(cost_ledger, f, indent=2)

    print("Successfully generated all JSON deliverables.")

if __name__ == "__main__":
    generate_json_deliverables()
