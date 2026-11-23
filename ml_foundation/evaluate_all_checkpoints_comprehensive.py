"""
VISION 100M — Comparative Multi-Checkpoint Benchmark Evaluator
ml_foundation/evaluate_all_checkpoints_comprehensive.py

Evaluates and compares all 6 standing checkpoints under identical conditions:
1. vision-v1.4-calibrated-local (Production Fallback Reference, 13.35M)
2. vision-2.0-candidate-g (Standby Reference, 13.35M)
3. vision-100m-foundation (Original 100M Pilot, 98.26M)
4. vision-100m-recovered (Diagnosed Masking 100M, 98.26M)
5. vision-scale-100m-stage1-foundation (EXP-4 Starting Checkpoint, 98.26M)
6. vision-scale-100m-full-pretraining (New Full Pretraining Run, 98.26M)

Measures:
- Pass rate across 12 domains (Math, Python, JS, Java, Logic, Science, Hindi, Hinglish, Tools, etc.)
- Wilson 95% Confidence Intervals
- Mean first-token Shannon entropy
- Average response generation latency
- Output text diversity & unigram collapse detection

Saves:
- vision_100m_full_pretraining_benchmark.json
"""

import os
import sys
import json
import time
import math
import re
import ast
import hashlib
from collections import defaultdict
from typing import Dict, Any, List, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
import torch.nn as nn
import sympy

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE

SET_A_FILE = os.path.join(REPO_ROOT, "vision_independent_validation_dataset.jsonl")
OUT_BENCHMARK_JSON = os.path.join(REPO_ROOT, "vision_100m_stage3_benchmark.json")

CHECKPOINTS_TO_EVALUATE = [
    {
        "model_id": "vision-v1.4-calibrated-local",
        "display_name": "VISION v1.4 (Reference)",
        "weights_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-calibrated-local", "weights.pt"),
        "config_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-calibrated-local", "config.json"),
        "tokenizer_dir": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-calibrated-local")
    },
    {
        "model_id": "vision-2.0-candidate-g",
        "display_name": "VISION 2.0 Candidate G",
        "weights_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-2.0-candidate-g", "weights.pt"),
        "config_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-2.0-candidate-g", "config.json"),
        "tokenizer_dir": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-2.0-candidate-g")
    },
    {
        "model_id": "vision-100m-foundation",
        "display_name": "VISION 100M (Original Pilot)",
        "weights_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-foundation", "weights.pt"),
        "config_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-foundation", "config.json"),
        "tokenizer_dir": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-calibrated-local")
    },
    {
        "model_id": "vision-100m-recovered",
        "display_name": "VISION 100M (Recovered)",
        "weights_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-recovered", "weights.pt"),
        "config_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-recovered", "config.json"),
        "tokenizer_dir": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-calibrated-local")
    },
    {
        "model_id": "vision-scale-100m-stage1-foundation",
        "display_name": "VISION 100M (EXP-4 Stage 1)",
        "weights_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-stage1-foundation", "weights.pt"),
        "config_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-stage1-foundation", "config.json"),
        "tokenizer_dir": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-stage1-foundation")
    },
    {
        "model_id": "vision-scale-100m-full-pretraining",
        "display_name": "VISION 100M (Stage 2 Pretrained)",
        "weights_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-full-pretraining", "weights.pt"),
        "config_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-full-pretraining", "config.json"),
        "tokenizer_dir": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-full-pretraining")
    },
    {
        "model_id": "vision-scale-100m-stage3-pretraining",
        "display_name": "VISION 100M (Stage 3 Pretrained)",
        "weights_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-stage3-pretraining", "weights.pt"),
        "config_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-stage3-pretraining", "config.json"),
        "tokenizer_dir": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-stage3-pretraining")
    }
]


def compute_sha256(filepath: str) -> str:
    if not os.path.exists(filepath):
        return "NOT_FOUND"
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def strip_thoughts(text: str) -> str:
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"<thought>[\s\S]*?</thought>", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\|im_start\|[\s\S]*?\|im_end\|", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<bos>|<eos>|<user>|<assistant>|</user>|</assistant>", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def wilson_score_interval(successes: int, trials: int, confidence: float = 0.95) -> Tuple[float, float]:
    if trials == 0:
        return (0.0, 0.0)
    z = 1.95996
    p = successes / trials
    denom = 1.0 + (z**2) / trials
    centre = (p + (z**2) / (2.0 * trials)) / denom
    half = (z * math.sqrt((p * (1.0 - p) + (z**2) / (4.0 * trials)) / trials)) / denom
    return (round(max(0.0, centre - half) * 100.0, 2), round(min(1.0, centre + half) * 100.0, 2))


def evaluate_probe(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    domain = probe.get("domain", "general")
    cleaned = strip_thoughts(pred_text)
    expected = str(probe.get("reference_answer", "")).strip()

    if not cleaned:
        return False, "Empty output", "Empty generation"

    # Math evaluation
    if "math" in domain or domain in ("mathematics_arithmetic", "mathematics_fractions", "mathematics_algebra", "mathematics_reasoning"):
        numbers = re.findall(r"-?\d+(?:\.\d+)?(?:/\d+)?", cleaned)
        if expected in numbers or expected in cleaned:
            return True, "", "passed"
        try:
            exp_f = float(sympy.sympify(expected))
            for num in numbers:
                try:
                    if abs(float(sympy.sympify(num)) - exp_f) < 1e-4:
                        return True, "", "passed"
                except Exception:
                    continue
        except Exception:
            pass
        return False, f"Expected '{expected}', found {numbers}", "Arithmetic mismatch"

    # Python evaluation
    if domain in ("coding_python", "programming_python"):
        match = re.search(r"```(?:python)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
        code = match.group(1).strip() if match else cleaned.strip()
        func_name = probe.get("func_name", "")
        test_cases = probe.get("test_cases", [])
        try:
            ast.parse(code)
        except SyntaxError as se:
            return False, f"SyntaxError: {se}", "Syntax error"
        scope = {}
        try:
            exec(code, scope)
        except Exception as e:
            return False, f"Runtime error: {e}", "Runtime error"
        if func_name and (func_name not in scope or not callable(scope[func_name])):
            return False, f"Function '{func_name}' not defined", "Signature mismatch"
        if func_name:
            func = scope[func_name]
            for args, exp_val in test_cases:
                try:
                    act_val = func(*args)
                    if act_val != exp_val:
                        return False, f"Failed on {args}: expected {exp_val}, got {act_val}", "Logic error"
                except Exception as e:
                    return False, f"Error on {args}: {e}", "Execution error"
        return True, "", "passed"

    # General text / Hindi / Hinglish / Instructions
    clean_lower = cleaned.lower()
    exp_lower = expected.lower()
    if exp_lower in clean_lower:
        return True, "", "passed"
    kw_matches = sum(1 for kw in probe.get("keywords", []) if kw.lower() in clean_lower)
    if probe.get("keywords") and kw_matches == len(probe["keywords"]):
        return True, "", "passed"

    return False, f"Expected '{expected}', got '{cleaned[:60]}'", "Text mismatch"


def generate_response(model, tokenizer, prompt: str, max_new_tokens: int = 24) -> Tuple[str, float]:
    p_text = f"<bos><user>{prompt}</user><assistant>"
    toks = tokenizer.encode(p_text)
    cur_t = torch.tensor([toks], dtype=torch.long)

    first_entropy = 0.0
    with torch.no_grad():
        out = model(cur_t)
        first_lg = out["logits"][:, -1, :] if isinstance(out, dict) else out[:, -1, :]
        probs = torch.softmax(first_lg, dim=-1)
        p_nz = probs[probs > 1e-12]
        first_entropy = -(p_nz * torch.log(p_nz)).sum().item()

        gen_tokens = []
        for _ in range(max_new_tokens):
            o = model(cur_t)
            lg = o["logits"] if isinstance(o, dict) else o
            nxt = torch.argmax(lg[:, -1, :], dim=-1).item()
            if nxt in (tokenizer.eos_id, tokenizer.vocab.get("</assistant>", -1)):
                break
            gen_tokens.append(nxt)
            cur_t = torch.cat([cur_t, torch.tensor([[nxt]], dtype=torch.long)], dim=1)

    return tokenizer.decode(gen_tokens), first_entropy


def evaluate_single_checkpoint(entry: Dict[str, Any], probes: List[Dict[str, Any]]) -> Dict[str, Any]:
    model_id = entry["model_id"]
    display_name = entry["display_name"]
    w_path = entry["weights_path"]
    c_path = entry["config_path"]
    t_dir = entry["tokenizer_dir"]

    print(f"\n--- Evaluating Checkpoint: {display_name} ({model_id}) ---")
    if not os.path.exists(w_path):
        print(f"Weights file not found at: {w_path}. Skipping.")
        return {"model_id": model_id, "display_name": display_name, "status": "NOT_FOUND"}

    weights_sha = compute_sha256(w_path)
    weights_size_mb = round(os.path.getsize(w_path) / (1024 * 1024), 2)

    # Load config & model
    with open(c_path, "r", encoding="utf-8") as f:
        cfg_dict = json.load(f)
    cfg = JarvisConfig(**cfg_dict)
    model = JarvisUnifiedTransformer(cfg)

    ckpt_data = torch.load(w_path, map_location="cpu")
    s_dict = ckpt_data["model_state_dict"] if "model_state_dict" in ckpt_data else ckpt_data
    model.load_state_dict(s_dict, strict=False)
    model.eval()

    param_count = sum(p.numel() for p in model.parameters() if p.requires_grad)

    # Load tokenizer
    tokenizer = JarvisBPE.load(t_dir)

    domain_scores = defaultdict(lambda: {"correct": 0, "total": 0})
    entropies = []
    latencies = []
    sample_outputs = []
    unique_words = set()

    for i, probe in enumerate(probes):
        dom = probe.get("domain", "general")
        prompt = probe.get("prompt", "")
        domain_scores[dom]["total"] += 1

        t0 = time.perf_counter()
        pred_text, ent = generate_response(model, tokenizer, prompt, max_new_tokens=24)
        lat = time.perf_counter() - t0

        latencies.append(lat)
        entropies.append(ent)
        for w in pred_text.split():
            unique_words.add(w)

        is_pass, reason, fail_cat = evaluate_probe(pred_text, probe)
        if is_pass:
            domain_scores[dom]["correct"] += 1

        if i < 6:
            sample_outputs.append({
                "prompt": prompt[:60],
                "domain": dom,
                "entropy": round(ent, 3),
                "generated": pred_text[:80]
            })

    total_probes = len(probes)
    total_correct = sum(v["correct"] for v in domain_scores.values())
    acc_pct = round((total_correct / max(1, total_probes)) * 100.0, 2)
    ci_low, ci_high = wilson_score_interval(total_correct, total_probes)
    mean_ent = round(sum(entropies) / max(1, len(entropies)), 3)
    mean_lat_ms = round((sum(latencies) / max(1, len(latencies))) * 1000.0, 1)

    domain_breakdown = {}
    for dom, sc in domain_scores.items():
        domain_breakdown[dom] = {
            "correct": sc["correct"],
            "total": sc["total"],
            "accuracy_percent": round((sc["correct"] / max(1, sc["total"])) * 100.0, 2)
        }

    print(f"Result: {total_correct}/{total_probes} ({acc_pct}%) | Entropy: {mean_ent} | Mean Latency: {mean_lat_ms} ms")

    return {
        "model_id": model_id,
        "display_name": display_name,
        "weights_sha256": weights_sha,
        "file_size_mb": weights_size_mb,
        "trainable_parameters": param_count,
        "total_probes_evaluated": total_probes,
        "passed_probes": total_correct,
        "pass_rate_percent": acc_pct,
        "wilson_ci_95": [ci_low, ci_high],
        "mean_first_token_entropy": mean_ent,
        "mean_latency_ms": mean_lat_ms,
        "unique_output_words": len(unique_words),
        "domain_scores": domain_breakdown,
        "sample_outputs": sample_outputs,
        "status": "EVALUATED"
    }


def main():
    print("=" * 80)
    print("VISION 100M — COMPREHENSIVE MULTI-CHECKPOINT BENCHMARK")
    print("=" * 80)

    torch.set_num_threads(2)

    # Load 48 stratified probes across 12 domains
    probes_raw = []
    with open(SET_A_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                probes_raw.append(json.loads(line))

    domain_buckets = defaultdict(list)
    for p in probes_raw:
        dom = p.get("domain", "general")
        domain_buckets[dom].append(p)

    stratified_probes = []
    for dom, p_list in domain_buckets.items():
        stratified_probes.extend(p_list[:4])  # 4 probes per domain * 12 domains = 48 probes

    print(f"Loaded {len(stratified_probes)} stratified probes across {len(domain_buckets)} domains.")

    results = []
    for entry in CHECKPOINTS_TO_EVALUATE:
        res = evaluate_single_checkpoint(entry, stratified_probes)
        results.append(res)

    benchmark_summary = {
        "benchmark_title": "VISION 100M Multi-Checkpoint Comprehensive Independent Benchmark",
        "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_probes_per_checkpoint": len(stratified_probes),
        "domains_evaluated": list(domain_buckets.keys()),
        "checkpoints": results
    }

    with open(OUT_BENCHMARK_JSON, "w", encoding="utf-8") as f:
        json.dump(benchmark_summary, f, indent=2)
    print(f"\nSaved comprehensive benchmark report to: {OUT_BENCHMARK_JSON}")


if __name__ == "__main__":
    main()
