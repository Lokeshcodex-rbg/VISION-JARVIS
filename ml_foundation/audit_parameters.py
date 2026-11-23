"""
VISION Parameter Calculation & Tensor Audit
ml_foundation/audit_parameters.py

Comprehensive tensor-by-tensor parameter verification for:
- VISION v1.4 (jarvis-local-10m / 13.33M)
- VISION v1.5 (vision-scale-25m / 26.78M)

Inspects every named parameter tensor, compares with analytical formula,
checks weight tying, and reports exact parameter count without hand-waving.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Dict, Any, List

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer


def audit_checkpoint(checkpoint_dir: str) -> Dict[str, Any]:
    print(f"\n{'='*70}")
    print(f"AUDITING CHECKPOINT: {checkpoint_dir}")
    print(f"{'='*70}")

    with open(os.path.join(checkpoint_dir, "config.json"), "r", encoding="utf-8") as f:
        cfg_dict = json.load(f)

    cfg = JarvisConfig(**cfg_dict)
    model, _ = JarvisUnifiedTransformer.load_pretrained(checkpoint_dir, device="cpu", strict=False)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)

    # Check weight tying
    is_tied = False
    if hasattr(model, "lm_head") and hasattr(model, "tok_emb"):
        is_tied = (model.lm_head.weight is model.tok_emb.weight)
    
    print(f"Config: d_model={cfg.d_model}, n_layers={cfg.n_layers}, n_heads={cfg.n_heads}, n_kv_heads={cfg.n_kv_heads}, d_ff={cfg.d_ff}, vocab_size={cfg.vocab_size}")
    print(f"Vision: dim={cfg.vision_dim}, layers={cfg.vision_layers}, patch={cfg.patch_size}, img={cfg.image_size}")
    print(f"Audio: feat_dim={cfg.audio_feature_dim}")
    print(f"Weight Tying (lm_head.weight is tok_emb.weight): {is_tied}")
    print(f"Total PyTorch Parameters: {total_params:,}")
    print(f"Trainable Parameters:     {trainable_params:,}")

    # Detailed Categorization
    categories: Dict[str, List[Dict[str, Any]]] = {
        "token_embeddings": [],
        "attention_projections": [],
        "attention_qk_norm": [],
        "swiglu_mlp": [],
        "layer_norms": [],
        "final_norm": [],
        "lm_head": [],
        "vision_encoder": [],
        "audio_encoder": [],
        "other": []
    }

    tensor_details = []
    for name, param in model.named_parameters():
        info = {
            "name": name,
            "shape": list(param.shape),
            "numel": param.numel(),
            "dtype": str(param.dtype),
            "requires_grad": param.requires_grad
        }
        tensor_details.append(info)

        if name == "tok_emb.weight":
            categories["token_embeddings"].append(info)
        elif name.startswith("vision_encoder."):
            categories["vision_encoder"].append(info)
        elif name.startswith("audio_encoder."):
            categories["audio_encoder"].append(info)
        elif name == "norm_f.weight":
            categories["final_norm"].append(info)
        elif name == "lm_head.weight":
            categories["lm_head"].append(info)
        elif name.startswith("blocks."):
            if "attn.q_proj" in name or "attn.k_proj" in name or "attn.v_proj" in name or "attn.o_proj" in name:
                categories["attention_projections"].append(info)
            elif "attn.q_norm" in name or "attn.k_norm" in name:
                categories["attention_qk_norm"].append(info)
            elif "mlp.gate_proj" in name or "mlp.up_proj" in name or "mlp.down_proj" in name:
                categories["swiglu_mlp"].append(info)
            elif "norm1" in name or "norm2" in name:
                categories["layer_norms"].append(info)
            else:
                categories["other"].append(info)
        else:
            categories["other"].append(info)

    # Category summaries
    cat_summary = {}
    print("\n--- Parameter Distribution by Subsystem ---")
    for cat_name, items in categories.items():
        total_cat = sum(item["numel"] for item in items)
        cat_summary[cat_name] = {
            "count": len(items),
            "total_params": total_cat,
            "pct_of_total": round(total_cat / total_params * 100, 2)
        }
        print(f"  {cat_name:<24}: {total_cat:>12,} params ({cat_summary[cat_name]['pct_of_total']:>6.2f}%) across {len(items):>2} tensors")

    # Analytical verification
    V = cfg.vocab_size
    D = cfg.d_model
    L = cfg.n_layers
    H = cfg.n_heads
    H_kv = cfg.n_kv_heads
    D_head = D // H
    D_ff = cfg.d_ff

    # Analytical formulas:
    # 1. Token Embeddings: V * D
    analytical_emb = V * D
    # 2. Attention Projections: L * (D*D + 2*(D*H_kv*D_head) + D*D)
    analytical_attn_w = L * (D * D + 2 * (D * H_kv * D_head) + D * D)
    # 3. QK-Norm: per layer q_norm(D_head) + k_norm(D_head) = 2 * D_head
    analytical_attn_norm = L * (2 * D_head) if cfg.qk_norm else 0
    # 4. SwiGLU: L * (3 * D * D_ff)
    analytical_swiglu = L * (3 * D * D_ff)
    # 5. Layer Norms: L * 2 * D
    analytical_layer_norms = L * (2 * D)
    # 6. Final RMSNorm: D
    analytical_final_norm = D
    # 7. LM Head: 0 if tied, V*D if untied
    analytical_lm_head = 0 if cfg.tie_word_embeddings else V * D

    # Actual PyTorch counts for multimodal components
    actual_vis = sum(item["numel"] for item in categories["vision_encoder"])
    actual_audio = sum(item["numel"] for item in categories["audio_encoder"])

    analytical_text_total = analytical_emb + analytical_attn_w + analytical_attn_norm + analytical_swiglu + analytical_layer_norms + analytical_final_norm + analytical_lm_head
    analytical_total = analytical_text_total + actual_vis + actual_audio

    print("\n--- Analytical Formula Reconciliation ---")
    print(f"  1. Token Embeddings [V * D = {V} * {D}]:                           {analytical_emb:>12,}")
    print(f"  2. Attention Projections [L * (Q + 2*KV + Out)]:                   {analytical_attn_w:>12,}")
    print(f"     Per Layer Q ({D}*{D}) + Out ({D}*{D}):                          {2 * D * D:>12,}")
    print(f"     Per Layer K+V (2 * {D} * {H_kv * D_head}):                      {2 * D * H_kv * D_head:>12,}")
    print(f"  3. QK-Norm Projections [L * 2 * D_head = {L} * 2 * {D_head}]:          {analytical_attn_norm:>12,}")
    print(f"  4. SwiGLU Projections [L * 3 * D * D_ff = {L} * 3 * {D} * {D_ff}]:   {analytical_swiglu:>12,}")
    print(f"  5. Layer RMSNorms [L * 2 * D = {L} * 2 * {D}]:                      {analytical_layer_norms:>12,}")
    print(f"  6. Final RMSNorm [D = {D}]:                                        {analytical_final_norm:>12,}")
    print(f"  7. LM Head (Tied to tok_emb: {cfg.tie_word_embeddings}):           {analytical_lm_head:>12,}")
    print(f"  --------------------------------------------------------------------")
    print(f"  Subtotal Language Transformer Backbone:                            {analytical_text_total:>12,}")
    print(f"  8. Vision Multimodal Encoder (ViT-3L + Projector + Cls/Bbox):      {actual_vis:>12,}")
    print(f"  9. Audio Multimodal Encoder (Conv1d + Projector + Head):           {actual_audio:>12,}")
    print(f"  ====================================================================")
    print(f"  Analytical Formula Total:                                          {analytical_total:>12,}")
    print(f"  PyTorch Named Parameters Total:                                    {total_params:>12,}")
    print(f"  Discrepancy (PyTorch - Analytical):                                {total_params - analytical_total:>12,}")

    assert total_params == analytical_total, f"Analytical parameter mismatch: {total_params} vs {analytical_total}"
    print("  >>> VERIFIED: 100% Exact Analytical Match (Discrepancy = 0) <<<")

    return {
        "checkpoint_dir": checkpoint_dir,
        "config": cfg_dict,
        "total_params": total_params,
        "trainable_params": trainable_params,
        "is_tied": is_tied,
        "category_summary": cat_summary,
        "analytical_total": analytical_total,
        "discrepancy": total_params - analytical_total,
        "tensors": tensor_details
    }


if __name__ == "__main__":
    v14_dir = "data/neural_models/checkpoints/vision-v1.4-calibrated-local"
    v15_dir = "data/neural_models/checkpoints/vision-v1.5-25m-local"

    res_14 = audit_checkpoint(v14_dir)
    res_15 = audit_checkpoint(v15_dir)

    out_file = "data/learning/parameter_audit_report.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"v14": res_14, "v15": res_15}, f, indent=2)
    print(f"\nAudit complete. Saved to {out_file}")
