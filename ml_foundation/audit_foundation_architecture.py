"""
VISION — Next-Generation Foundation Model Architecture & Tokenizer Audit
ml_foundation/audit_foundation_architecture.py
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
from typing import Dict, List, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE


def audit_architecture_parameters() -> Dict[str, object]:
    print("=" * 80)
    print("PHASE 1: COMPLETE ARCHITECTURE AUDIT")
    print("=" * 80)

    # 1. Inspect 13.33M Reference
    ckpt_13m = "data/neural_models/checkpoints/vision-v1.4-calibrated-local"
    model_13m, cfg_13m = JarvisUnifiedTransformer.load_pretrained(ckpt_13m, device="cpu", strict=False)
    p_13m = model_13m.parameter_count()

    breakdown_13m = {"embedding": 0, "attention": 0, "mlp": 0, "norm": 0, "vision": 0, "audio": 0, "head": 0}
    tensor_shapes_13m = {}

    for name, param in model_13m.named_parameters():
        n = param.numel()
        tensor_shapes_13m[name] = list(param.shape)
        if "tok_emb" in name:
            breakdown_13m["embedding"] += n
        elif "attn" in name:
            breakdown_13m["attention"] += n
        elif "mlp" in name:
            breakdown_13m["mlp"] += n
        elif "norm" in name:
            breakdown_13m["norm"] += n
        elif "vision" in name:
            breakdown_13m["vision"] += n
        elif "audio" in name:
            breakdown_13m["audio"] += n
        elif "lm_head" in name:
            breakdown_13m["head"] += n

    print(f"13.33M Reference Total Parameters: {p_13m['total_parameters']:,}")
    print(f"  - Language Parameters:          {p_13m['language_parameters']:,}")
    print(f"  - Vision Encoder Parameters:    {p_13m['vision_parameters']:,}")
    print(f"  - Audio Encoder Parameters:     {p_13m['audio_parameters']:,}")
    print("Module Breakdown:")
    for k, v in breakdown_13m.items():
        pct = (v / p_13m['total_parameters']) * 100.0
        print(f"  - {k:14s}: {v:10,d} ({pct:6.2f}%)")

    print("\n13.33M Configuration Details:")
    print(f"  - d_model:       {cfg_13m.d_model}")
    print(f"  - n_layers:      {cfg_13m.n_layers}")
    print(f"  - n_heads:       {cfg_13m.n_heads} (Query heads)")
    print(f"  - n_kv_heads:    {cfg_13m.n_kv_heads} (KV heads, GQA ratio: {cfg_13m.n_heads // cfg_13m.n_kv_heads}x)")
    print(f"  - head_dim:      {cfg_13m.d_model // cfg_13m.n_heads}")
    print(f"  - d_ff:          {cfg_13m.d_ff} (SwiGLU intermediate dimension)")
    print(f"  - vocab_size:    {cfg_13m.vocab_size}")
    print(f"  - max_seq_len:   {cfg_13m.max_seq_len}")
    print(f"  - tie_weights:   {cfg_13m.tie_word_embeddings}")
    print(f"  - qk_norm:       {cfg_13m.qk_norm}")
    print(f"  - rope_theta:    {cfg_13m.rope_theta}")

    # 2. Candidate Architecture Scaling Model (Theoretical & Actual)
    # Define scaling candidates:
    # Tier 1: 13.33M (Reference)
    # Tier 2: 26.78M (v1.5: d_model=512, n_layers=8, n_heads=8, n_kv_heads=4, d_ff=1408)
    # Tier 3: 45.2M  (d_model=640, n_layers=12, n_heads=10, n_kv_heads=5, d_ff=1792)
    # Tier 4: 85.6M  (d_model=896, n_layers=16, n_heads=14, n_kv_heads=7, d_ff=2560)
    tiers = [
        {"name": "VISION-v1.4 (Reference)", "d_model": 320, "n_layers": 8, "n_heads": 8, "n_kv": 4, "d_ff": 896, "vocab": 8192},
        {"name": "VISION-v1.5 (26.8M)",      "d_model": 512, "n_layers": 8, "n_heads": 8, "n_kv": 4, "d_ff": 1408, "vocab": 8192},
        {"name": "VISION-v1.6 (45.2M)",      "d_model": 640, "n_layers": 12, "n_heads": 10, "n_kv": 5, "d_ff": 1792, "vocab": 8192},
        {"name": "VISION-v2.0 (85.6M)",      "d_model": 896, "n_layers": 16, "n_heads": 14, "n_kv": 7, "d_ff": 2560, "vocab": 8192},
    ]

    print("\n" + "=" * 80)
    print("PHASE 4: ARCHITECTURE SCALING CANDIDATE SPECS & RESOURCE PROJECTIONS")
    print("=" * 80)
    print(f"{'Tier Name':24s} | {'Params':9s} | {'Weight MB':9s} | {'AdamW MB':9s} | {'Train RAM':10s} | {'Est Step/s':10s}")
    print("-" * 84)

    tier_results = []
    for t in tiers:
        d = t["d_model"]
        l = t["n_layers"]
        h = t["n_heads"]
        kv = t["n_kv"]
        ff = t["d_ff"]
        v = t["vocab"]
        hd = d // h

        # Calculate exact parameter counts:
        # Embedding: v * d (tied with output head)
        emb_p = v * d
        # Per layer attention:
        # q_proj: d * (h * hd) = d * d
        # k_proj: d * (kv * hd)
        # v_proj: d * (kv * hd)
        # o_proj: (h * hd) * d = d * d
        q_p = d * d
        k_p = d * (kv * hd)
        v_p = d * (kv * hd)
        o_p = d * d
        attn_per_layer = q_p + k_p + v_p + o_p + (2 * hd if cfg_13m.qk_norm else 0)

        # Per layer MLP (SwiGLU has gate_proj, up_proj, down_proj):
        # gate: d * ff
        # up: d * ff
        # down: ff * d
        mlp_per_layer = 3 * (d * ff)

        # Per layer RMSNorms:
        # attn_norm: d, mlp_norm: d
        norm_per_layer = 2 * d

        total_layer_p = (attn_per_layer + mlp_per_layer + norm_per_layer) * l
        final_norm_p = d
        multimodal_p = p_13m["vision_parameters"] + p_13m["audio_parameters"]

        total_p = emb_p + total_layer_p + final_norm_p + multimodal_p

        weight_mb = (total_p * 4) / (1024 * 1024)
        adamw_mb = weight_mb * 2  # 1st and 2nd moment fp32
        train_ram_mb = weight_mb + adamw_mb + 250.0  # activations + buffers

        # CPU step throughput estimates based on 13.33M baseline (1.95 st/s on 4 threads)
        est_step_s = 1.95 * (13.33e6 / total_p)

        print(f"{t['name']:24s} | {total_p/1e6:7.2f}M | {weight_mb:7.1f}MB | {adamw_mb:7.1f}MB | {train_ram_mb:8.1f}MB | {est_step_s:8.2f} st/s")
        tier_results.append({
            "tier": t["name"],
            "total_params": total_p,
            "weight_mb": round(weight_mb, 2),
            "adamw_mb": round(adamw_mb, 2),
            "train_ram_mb": round(train_ram_mb, 2),
            "est_step_per_sec": round(est_step_s, 2),
        })

    return {
        "reference_13m": {
            "total_params": p_13m["total_parameters"],
            "breakdown": breakdown_13m,
            "config": cfg_13m.to_dict(),
        },
        "scaling_tiers": tier_results,
    }


def audit_tokenizer_efficiency() -> Dict[str, object]:
    print("\n" + "=" * 80)
    print("PHASE 2: TOKENIZER & LANGUAGE REPRESENTATION AUDIT")
    print("=" * 80)

    tok_path = "data/neural_models/checkpoints/vision-v1.4-calibrated-local"
    tok = JarvisBPE.load(tok_path)

    print(f"Vocabulary Size: {len(tok.vocab):,} tokens")
    print(f"Special Tokens:  BOS={tok.bos_id}, EOS={tok.eos_id}, UNK={tok.unk_id}")

    # Test suites across 7 domains to measure token efficiency (tokens per word / compression ratio)
    test_corpora = {
        "English Academic": (
            "Transformer architectures rely on multi-head scaled dot-product attention and feed-forward layers "
            "to model sequential dependencies across arbitrary context windows without recurrent connections."
        ),
        "Devanagari Hindi": (
            "कृत्रिम बुद्धिमत्ता और मशीन लर्निंग आधुनिक कंप्यूटर विज्ञान के अत्यंत महत्वपूर्ण क्षेत्र हैं।"
        ),
        "Hinglish Dialogue": (
            "Mujhe Python mein ek function likhna hai jo prime numbers accurately check karta ho."
        ),
        "Python Code": (
            "def calculate_fibonacci(n: int) -> int:\n    if n <= 1:\n        return n\n    return calculate_fibonacci(n - 1) + calculate_fibonacci(n - 2)"
        ),
        "Java Code": (
            "public static int smallerNumber(int a, int b) {\n    return a < b ? a : b;\n}"
        ),
        "JavaScript Code": (
            "function filterEvenNumbers(arr) {\n    return arr.filter(x => x % 2 === 0);\n}"
        ),
        "Mathematical Notation": (
            "Ek = 0.5 * m * v^2; 42 * 15 - 130 = 500; 7 * x - 21 = 49; 3/4 + 1/2 = 1.25"
        ),
    }

    efficiency_results = {}
    print(f"{'Domain':24s} | {'Chars':6s} | {'Words':6s} | {'Tokens':7s} | {'Tok/Word':9s} | {'Fidelity':8s}")
    print("-" * 72)

    for domain, text in test_corpora.items():
        words = len(text.split())
        chars = len(text)
        token_ids = tok.encode(text)
        num_tokens = len(token_ids)
        tok_per_word = num_tokens / max(1, words)

        # Test Round-Trip Fidelity
        decoded = tok.decode(token_ids, skip_special_tokens=True)
        # Normalize whitespace for fidelity check
        clean_orig = " ".join(text.split())
        clean_dec = " ".join(decoded.split())
        is_faithful = clean_orig == clean_dec

        print(f"{domain:24s} | {chars:6d} | {words:6d} | {num_tokens:7d} | {tok_per_word:9.2f} | {'PERFECT' if is_faithful else 'MISMATCH'}")
        efficiency_results[domain] = {
            "chars": chars,
            "words": words,
            "tokens": num_tokens,
            "tokens_per_word": round(tok_per_word, 2),
            "fidelity": is_faithful,
        }

    # Digit Tokenization Analysis (Why multi-digit arithmetic fails)
    print("\nDigit Tokenization Analysis:")
    sample_numbers = ["7", "42", "130", "500", "287", "145", "450", "12345"]
    for num in sample_numbers:
        encoded = tok.encode(num)
        tok_repr = [tok.id_to_token.get(tid, str(tid)) for tid in encoded]
        print(f"  - Number '{num:<5s}': {len(encoded)} token(s) -> {tok_repr}")

    return efficiency_results


if __name__ == "__main__":
    arch_res = audit_architecture_parameters()
    tok_res = audit_tokenizer_efficiency()

    out_file = "data/learning/foundation_upgrade_audit.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"architecture": arch_res, "tokenizer": tok_res}, f, indent=2)
    print(f"\n[Done] Complete audit saved to {out_file}")
