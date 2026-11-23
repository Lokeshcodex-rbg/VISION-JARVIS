"""
UPDATE STAGE 4 CHECKPOINT REGISTRY (scripts/update_stage4_checkpoint_registry.py)

Compiles and preserves all historical and Stage 4 checkpoints into:
- VISION_STAGE4_CHECKPOINT_REGISTRY.json
- Preserves all 70 previous checkpoints and appends Stage 4 checkpoints with SHA-256 hashes.
"""

import os
import sys
import json
import hashlib

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREV_REGISTRY = os.path.join(REPO_ROOT, "VISION_CHECKPOINT_REGISTRY.json")
OUT_REGISTRY = os.path.join(REPO_ROOT, "VISION_STAGE4_CHECKPOINT_REGISTRY.json")
STAGE4_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-13m-stage4-relational")

def compute_sha256(filepath: str) -> str:
    if not os.path.exists(filepath):
        return "NOT_FOUND"
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def main():
    if os.path.exists(PREV_REGISTRY):
        with open(PREV_REGISTRY, "r", encoding="utf-8") as f:
            registry = json.load(f)
    else:
        registry = {}

    # Stage 4 checkpoints to register
    stage4_entries = [
        {
            "name": "vision-13m-stage4-relational-step050",
            "weights_path": "data/neural_models/checkpoints/vision-13m-stage4-relational/step_050/weights.pt",
            "full_path": os.path.join(STAGE4_DIR, "step_050", "weights.pt"),
            "step": 50,
            "total_parameters": 13332498,
            "parameter_label": "13.33M",
            "config": {
                "d_model": 320,
                "n_layers": 8,
                "n_heads": 8,
                "vocab_size": 8192,
                "max_seq_len": 256
            }
        },
        {
            "name": "vision-13m-stage4-relational-step100",
            "weights_path": "data/neural_models/checkpoints/vision-13m-stage4-relational/step_100/weights.pt",
            "full_path": os.path.join(STAGE4_DIR, "step_100", "weights.pt"),
            "step": 100,
            "total_parameters": 13332498,
            "parameter_label": "13.33M",
            "config": {
                "d_model": 320,
                "n_layers": 8,
                "n_heads": 8,
                "vocab_size": 8192,
                "max_seq_len": 256
            }
        },
        {
            "name": "vision-13m-stage4-relational-step150",
            "weights_path": "data/neural_models/checkpoints/vision-13m-stage4-relational/step_150/weights.pt",
            "full_path": os.path.join(STAGE4_DIR, "step_150", "weights.pt"),
            "step": 150,
            "total_parameters": 13332498,
            "parameter_label": "13.33M",
            "config": {
                "d_model": 320,
                "n_layers": 8,
                "n_heads": 8,
                "vocab_size": 8192,
                "max_seq_len": 256
            }
        },
        {
            "name": "vision-13m-stage4-relational-step200",
            "weights_path": "data/neural_models/checkpoints/vision-13m-stage4-relational/step_200/weights.pt",
            "full_path": os.path.join(STAGE4_DIR, "step_200", "weights.pt"),
            "step": 200,
            "total_parameters": 13332498,
            "parameter_label": "13.33M",
            "config": {
                "d_model": 320,
                "n_layers": 8,
                "n_heads": 8,
                "vocab_size": 8192,
                "max_seq_len": 256
            }
        },
        {
            "name": "vision-13m-stage4-relational-step250",
            "weights_path": "data/neural_models/checkpoints/vision-13m-stage4-relational/step_250/weights.pt",
            "full_path": os.path.join(STAGE4_DIR, "step_250", "weights.pt"),
            "step": 250,
            "total_parameters": 13332498,
            "parameter_label": "13.33M",
            "config": {
                "d_model": 320,
                "n_layers": 8,
                "n_heads": 8,
                "vocab_size": 8192,
                "max_seq_len": 256
            }
        },
        {
            "name": "vision-13m-stage4-relational",
            "weights_path": "data/neural_models/checkpoints/vision-13m-stage4-relational/weights.pt",
            "full_path": os.path.join(STAGE4_DIR, "weights.pt"),
            "step": 250,
            "total_parameters": 13332498,
            "parameter_label": "13.33M",
            "config": {
                "d_model": 320,
                "n_layers": 8,
                "n_heads": 8,
                "vocab_size": 8192,
                "max_seq_len": 256
            }
        }
    ]

    added = 0
    for e in stage4_entries:
        f_path = e.pop("full_path")
        if os.path.exists(f_path):
            sha = compute_sha256(f_path)
            size_bytes = os.path.getsize(f_path)
            e["sha256"] = sha
            e["size_bytes"] = size_bytes
            e["size_mb"] = round(size_bytes / (1024 * 1024), 2)
            registry[e["name"]] = e
            added += 1

    with open(OUT_REGISTRY, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)

    with open(PREV_REGISTRY, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)

    print(f"Updated registry with {added} Stage 4 checkpoints. Total registered: {len(registry)}")

if __name__ == "__main__":
    main()
