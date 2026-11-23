import sys
import os
sys.path.insert(0, os.path.abspath("."))
import json
import torch
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer

def count_module_params(m):
    return sum(p.numel() for p in m.parameters())

def audit_model_parameters(cfg_dict, ckpt_path=None):
    cfg = JarvisConfig.from_dict(cfg_dict)
    model = JarvisUnifiedTransformer(cfg)
    
    # 1. Component breakdown from instantiated model
    tok_emb = model.tok_emb.weight.numel()
    
    # Transformer blocks
    n_layers = len(model.blocks)
    block0 = model.blocks[0]
    
    # Attention
    q_p = block0.attn.q_proj.weight.numel()
    k_p = block0.attn.k_proj.weight.numel()
    v_p = block0.attn.v_proj.weight.numel()
    o_p = block0.attn.o_proj.weight.numel()
    attn_proj_total = (q_p + k_p + v_p + o_p) * n_layers
    
    q_norm_p = block0.attn.q_norm.weight.numel() if block0.attn.q_norm else 0
    k_norm_p = block0.attn.k_norm.weight.numel() if block0.attn.k_norm else 0
    attn_norm_total = (q_norm_p + k_norm_p) * n_layers
    
    norm1_p = block0.norm1.weight.numel() * n_layers
    norm2_p = block0.norm2.weight.numel() * n_layers
    
    # MLP (SwiGLU)
    gate_p = block0.mlp.gate_proj.weight.numel()
    up_p = block0.mlp.up_proj.weight.numel()
    down_p = block0.mlp.down_proj.weight.numel()
    mlp_total = (gate_p + up_p + down_p) * n_layers
    
    blocks_total = sum(count_module_params(b) for b in model.blocks)
    norm_f = model.norm_f.weight.numel()
    
    vis_total = count_module_params(model.vision_encoder) if model.vision_encoder else 0
    aud_total = count_module_params(model.audio_encoder) if model.audio_encoder else 0
    
    # LM Head
    lm_head_p = model.lm_head.weight.numel()
    
    # Model parameters as reported by PyTorch (accounts for shared/tied tensors)
    instantiated_unique_params = sum(p.numel() for p in model.parameters())
    
    # Model parameters if untied
    untied_total = tok_emb + blocks_total + norm_f + vis_total + aud_total + lm_head_p
    
    # Text-only parameters
    text_tied_params = tok_emb + blocks_total + norm_f
    text_untied_params = tok_emb + blocks_total + norm_f + lm_head_p
    text_non_emb_params = blocks_total + norm_f
    
    # 2. Compare against checkpoint if provided
    ckpt_tensor_sum = None
    ckpt_tensors = None
    if ckpt_path:
        sd = torch.load(ckpt_path, map_location="cpu", weights_only=False)
        state_dict = sd.get("model_state_dict", sd) if isinstance(sd, dict) else sd
        ckpt_tensor_sum = sum(v.numel() for v in state_dict.values() if isinstance(v, torch.Tensor))
        ckpt_tensors = len(state_dict)

    return {
        "config": cfg_dict,
        "d_model": cfg.d_model,
        "n_layers": cfg.n_layers,
        "n_heads": cfg.n_heads,
        "n_kv_heads": cfg.n_kv_heads,
        "d_ff": cfg.d_ff,
        "vocab_size": cfg.vocab_size,
        "tie_word_embeddings": cfg.tie_word_embeddings,
        "qk_norm": getattr(cfg, "qk_norm", False),
        "components": {
            "token_embedding": tok_emb,
            "attention_projections_all_layers": attn_proj_total,
            "attention_norms_all_layers": attn_norm_total,
            "layer_norms_all_layers": norm1_p + norm2_p,
            "swiglu_mlp_all_layers": mlp_total,
            "total_transformer_blocks": blocks_total,
            "final_norm": norm_f,
            "lm_head_weight": lm_head_p,
            "vision_encoder": vis_total,
            "audio_encoder": aud_total,
        },
        "totals": {
            "instantiated_unique_params (tied in memory)": instantiated_unique_params,
            "untied_total_params (saved in state_dict)": untied_total,
            "checkpoint_tensor_sum": ckpt_tensor_sum,
            "checkpoint_tensor_count": ckpt_tensors,
            "text_only_unique_params": text_tied_params,
            "text_only_non_embedding_params": text_non_emb_params,
            "embedding_fraction_of_text_model": tok_emb / text_tied_params,
            "embedding_fraction_of_total_model": tok_emb / instantiated_unique_params,
        }
    }

def main():
    ckpts = [
        ("vision-13m-stage4-relational", "data/neural_models/checkpoints/vision-13m-stage4-relational/weights.pt", "data/neural_models/checkpoints/vision-13m-stage4-relational/config.json"),
        ("vision-100m-foundation", "data/neural_models/checkpoints/vision-100m-foundation/weights.pt", "data/neural_models/checkpoints/vision-100m-foundation/config.json"),
        ("vision-25m-compact-foundation", "data/neural_models/checkpoints/vision-25m-compact-foundation/weights.pt", "data/neural_models/checkpoints/vision-25m-compact-foundation/config.json"),
        ("vision-v1.4-calibrated-local", "data/neural_models/checkpoints/vision-v1.4-calibrated-local/weights.pt", "data/neural_models/checkpoints/vision-v1.4-calibrated-local/config.json")
    ]
    
    results = {}
    for name, wpath, cpath in ckpts:
        cfg = json.load(open(cpath, "r", encoding="utf-8"))
        res = audit_model_parameters(cfg, wpath)
        results[name] = res
        print(f"=== {name} ===")
        print(f"d_model={res['d_model']}, layers={res['n_layers']}, heads={res['n_heads']}/{res['n_kv_heads']}, d_ff={res['d_ff']}, vocab={res['vocab_size']}")
        print(f"Tied in memory: {res['totals']['instantiated_unique_params (tied in memory)']:,}")
        print(f"State dict / Checkpoint tensor sum: {res['totals']['checkpoint_tensor_sum']:,}")
        print(f"Text-only unique params: {res['totals']['text_only_unique_params']:,}")
        print(f"Text-only non-emb params: {res['totals']['text_only_non_embedding_params']:,}")
        print(f"Vision encoder: {res['components']['vision_encoder']:,} | Audio encoder: {res['components']['audio_encoder']:,}")
        print(f"Embedding ratio: {res['totals']['embedding_fraction_of_text_model']*100:.2f}% (text) / {res['totals']['embedding_fraction_of_total_model']*100:.2f}% (total)")
        print()

    with open("VISION_PARAMETER_ACCOUNTING.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("Saved exact reconciliation to VISION_PARAMETER_ACCOUNTING.json")

if __name__ == "__main__":
    main()
