"""
GENERATE CHECKPOINT REGISTRY (ml_foundation/generate_checkpoint_registry.py)
Audits and registers all existing and historical checkpoints with SHA-256 hashes,
parameter counts, and configuration metadata.
"""

import os
import sys
import json
import hashlib
import torch

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer

CHECKPOINTS_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints")

def compute_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def build_registry():
    registry = {}
    for entry in sorted(os.listdir(CHECKPOINTS_DIR)):
        entry_path = os.path.join(CHECKPOINTS_DIR, entry)
        if not os.path.isdir(entry_path):
            continue

        weights_file = os.path.join(entry_path, "weights.pt")
        config_file = os.path.join(entry_path, "config.json")

        if not os.path.exists(weights_file):
            continue

        sha256 = compute_sha256(weights_file)
        size_bytes = os.path.getsize(weights_file)

        cfg_dict = {}
        total_params = None
        if os.path.exists(config_file):
            try:
                with open(config_file, "r") as f:
                    cfg_dict = json.load(f)
                cfg = JarvisConfig.from_dict(cfg_dict)
                model = JarvisUnifiedTransformer(cfg)
                total_params = sum(p.numel() for p in model.parameters())
            except Exception as e:
                pass

        if total_params is None:
            try:
                state_dict = torch.load(weights_file, map_location="cpu")
                total_params = sum(t.numel() for t in state_dict.values())
            except Exception:
                total_params = 0

        registry[entry] = {
            "name": entry,
            "weights_path": os.path.relpath(weights_file, REPO_ROOT).replace("\\", "/"),
            "sha256": sha256,
            "size_bytes": size_bytes,
            "size_mb": round(size_bytes / (1024 * 1024), 2),
            "total_parameters": total_params,
            "parameter_label": f"{total_params/1e6:.2f}M" if total_params else "unknown",
            "config": {
                "d_model": cfg_dict.get("d_model"),
                "n_layers": cfg_dict.get("n_layers"),
                "n_heads": cfg_dict.get("n_heads"),
                "vocab_size": cfg_dict.get("vocab_size"),
                "max_seq_len": cfg_dict.get("max_seq_len")
            }
        }

    output_path = os.path.join(REPO_ROOT, "VISION_CHECKPOINT_REGISTRY.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)
    print(f"Registered {len(registry)} checkpoints into {output_path}")

if __name__ == "__main__":
    build_registry()
