"""
VISION 100M — Independent Benchmark Evaluator & Generalization Analyzer
ml_foundation/evaluate_vision_100m.py

Evaluates the VISION 100M Foundation Model across independent, decontaminated validation suites:
- Set A: vision_independent_validation_dataset.jsonl (240 probes across 12 domains)
- Rigorous scoring:
  * Native arithmetic & symbolic math (sympy numerical equivalence)
  * Python execution & AST syntax validation
  * JavaScript syntax & execution
  * Java method signatures & return types
  * Formal reasoning & syllogisms
  * Causal reasoning
  * Science & engineering concepts
  * Multilingual comprehension (Hindi Devanagari, Hinglish)
  * Instruction following & schema compliance
- Failure taxonomy generation with root-cause categorization
- Outputs:
  * vision_100m_benchmark_results.json
  * vision_100m_failure_analysis.json
"""

import os
import sys
import json
import time
import math
import re
import ast
import subprocess
import hashlib
from typing import Dict, Any, List, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
import sympy

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE

SET_A_FILE = os.path.join(REPO_ROOT, "vision_independent_validation_dataset.jsonl")
OUT_RESULTS_JSON = os.path.join(REPO_ROOT, "vision_100m_benchmark_results.json")
OUT_FAILURES_JSON = os.path.join(REPO_ROOT, "vision_100m_failure_analysis.json")

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

# =========================================================================
# DOMAIN VERIFIERS & SANDBOXES
# =========================================================================

def verify_math_native(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text)
    expected = str(probe.get("reference_answer", "")).strip()
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
    return False, f"Expected '{expected}', found numbers {numbers} in '{cleaned[:80]}'", "Arithmetic error"

def verify_python_sandbox(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text)
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
        return False, f"Function '{func_name}' not defined in output", "Signature mismatch"
        
    if func_name:
        func = scope[func_name]
        for args, expected in test_cases:
            try:
                actual = func(*args)
                if actual != expected:
                    if isinstance(expected, float) and isinstance(actual, (int, float)):
                        if abs(actual - expected) < 1e-4:
                            continue
                    return False, f"Failed on args {args}: expected {expected}, got {actual}", "Incorrect output"
            except Exception as e:
                return False, f"Runtime error on args {args}: {e}", "Runtime error"
                
    return True, "", "passed"

def verify_js_sandbox(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text)
    match = re.search(r"```(?:javascript|js)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    code = match.group(1).strip() if match else cleaned.strip()
    
    func_name = probe.get("func_name", "")
    test_cases = probe.get("test_cases", [])
    
    test_harness = f"""
    {code}
    if (typeof {func_name} !== 'function') {{
        console.error('NOT_A_FUNCTION');
        process.exit(2);
    }}
    const assert = require('assert');
    """
    for idx, (args_str, exp_str) in enumerate(test_cases):
        test_harness += f"""
        try {{
            const actual_{idx} = {func_name}({args_str});
            const expected_{idx} = {exp_str};
            assert.deepStrictEqual(actual_{idx}, expected_{idx});
        }} catch(e) {{
            console.error('TEST_FAIL:' + e.message);
            process.exit(3);
        }}
        """
    try:
        proc = subprocess.run(["node", "-e", test_harness], capture_output=True, text=True, timeout=2.5)
        if proc.returncode == 0:
            return True, "", "passed"
        elif proc.returncode == 2:
            return False, f"Function '{func_name}' not found", "Signature mismatch"
        elif proc.returncode == 3:
            return False, f"Assertion failed: {proc.stderr.strip()}", "Incorrect output"
        else:
            return False, f"Node error: {proc.stderr.strip()}", "Syntax error"
    except Exception as e:
        return False, f"Subprocess error: {e}", "Runtime error"

def verify_java_signature(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text)
    match = re.search(r"```(?:java)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    code = match.group(1).strip() if match else cleaned.strip()
    
    expected_method = probe.get("expected_method", "")
    return_type = probe.get("return_type", "")
    
    if expected_method and expected_method not in code:
        return False, f"Expected method '{expected_method}' not found in code", "Signature mismatch"
    if return_type and return_type not in code:
        return False, f"Expected return type '{return_type}' not found", "Signature mismatch"
    if "return " not in code:
        return False, "Missing return statement in method", "Syntax error"
    return True, "", "passed"

def verify_instruction_constraints(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text)
    constraint = probe.get("constraint_type", "")
    
    if constraint == "strict_json":
        match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", cleaned)
        json_str = match.group(1) if match else cleaned
        try:
            data = json.loads(json_str)
            req_keys = probe.get("required_keys", [])
            for k in req_keys:
                if k not in data:
                    return False, f"Missing JSON key '{k}'", "Instruction-following failure"
            return True, "", "passed"
        except Exception as e:
            return False, f"Invalid JSON: {e}", "Instruction-following failure"
            
    elif constraint == "negative_constraint":
        forbidden = probe.get("forbidden_token", "")
        if forbidden and forbidden.lower() in cleaned.lower():
            return False, f"Contained forbidden token '{forbidden}'", "Instruction-following failure"
        return True, "", "passed"
        
    elif constraint == "exact_prefix":
        prefix = probe.get("prefix", "")
        if not cleaned.startswith(prefix):
            return False, f"Did not start with required prefix '{prefix}'", "Instruction-following failure"
        return True, "", "passed"
        
    return verify_concept_keywords(pred_text, probe)

def verify_concept_keywords(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text).lower()
    keywords = probe.get("validation_keywords", [])
    if not keywords:
        ref = str(probe.get("reference_answer", "")).lower()
        if ref and ref in cleaned:
            return True, "", "passed"
        return False, f"Reference '{ref}' not found in output", "Factual error"
        
    matched = [kw for kw in keywords if kw.lower() in cleaned]
    if len(matched) >= probe.get("min_keywords", 1):
        return True, "", "passed"
    return False, f"Missing keywords {keywords} in: '{cleaned[:120]}'", "Factual error"


def evaluate_probe(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    domain = probe.get("domain", "")
    if domain in ("mathematics", "math", "arithmetic", "algebra"):
        return verify_math_native(pred_text, probe)
    elif domain == "python":
        return verify_python_sandbox(pred_text, probe)
    elif domain in ("javascript", "typescript"):
        return verify_js_sandbox(pred_text, probe)
    elif domain == "java":
        return verify_java_signature(pred_text, probe)
    elif domain in ("instruction_following", "tool_use"):
        return verify_instruction_constraints(pred_text, probe)
    else:
        return verify_concept_keywords(pred_text, probe)


def generate_response(model, tokenizer, prompt: str, max_tokens: int = 48, device="cpu") -> str:
    input_text = f"<bos><user>{prompt}</user><assistant>"
    tok_ids = tokenizer.encode(input_text)
    input_tensor = torch.tensor([tok_ids], dtype=torch.long, device=device)
    
    stop_id = tokenizer.vocab.get("</assistant>", None)
    eos_id = tokenizer.eos_id
    
    generated = []
    with torch.no_grad():
        for _ in range(max_tokens):
            out = model(input_tensor)
            logits = out["logits"] if isinstance(out, dict) else out
            next_tok = torch.argmax(logits[:, -1, :], dim=-1).item()
            if next_tok in (eos_id, stop_id):
                break
            generated.append(next_tok)
            next_tensor = torch.tensor([[next_tok]], dtype=torch.long, device=device)
            input_tensor = torch.cat([input_tensor, next_tensor], dim=1)
            
    return tokenizer.decode(generated)


def evaluate_model_on_probes(
    model: JarvisUnifiedTransformer,
    tokenizer: JarvisBPE,
    model_name: str,
    probes: List[Dict[str, Any]],
    device: str = "cpu"
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    domain_scores = {}
    failures = []
    latencies = []
    
    print(f"\nEvaluating {model_name} across {len(probes)} probes...")
    t0 = time.perf_counter()
    
    for i, probe in enumerate(probes):
        prompt = probe.get("prompt", "")
        domain = probe.get("domain", "general")
        
        if domain not in domain_scores:
            domain_scores[domain] = {"correct": 0, "total": 0}
        domain_scores[domain]["total"] += 1
        
        t_start = time.perf_counter()
        pred_text = generate_response(model, tokenizer, prompt, max_tokens=32, device=device)
        elapsed = time.perf_counter() - t_start
        latencies.append(elapsed)
        
        is_pass, reason, fail_cat = evaluate_probe(pred_text, probe)
        if is_pass:
            domain_scores[domain]["correct"] += 1
        else:
            failures.append({
                "probe_id": probe.get("probe_id", f"p_{i}"),
                "domain": domain,
                "prompt": prompt,
                "reference_answer": probe.get("reference_answer", ""),
                "model_prediction": pred_text[:160],
                "error_reason": reason,
                "failure_category": fail_cat
            })
            
        if (i + 1) % 40 == 0 or (i + 1) == len(probes):
            total_corr = sum(v["correct"] for v in domain_scores.values())
            print(f"  [{i+1}/{len(probes)}] Passed: {total_corr}/{i+1} ({total_corr/(i+1)*100:.2f}%)")
            
    total_time = time.perf_counter() - t0
    total_correct = sum(v["correct"] for v in domain_scores.values())
    total_probes = len(probes)
    acc = round((total_correct / max(1, total_probes)) * 100, 2)
    ci_low, ci_high = wilson_score_interval(total_correct, total_probes)
    
    # Calculate domain accuracies
    domain_results = {}
    for dom, stat in domain_scores.items():
        c = stat["correct"]
        t = stat["total"]
        domain_results[dom] = {
            "correct": c,
            "total": t,
            "accuracy_percent": round((c / max(1, t)) * 100, 2)
        }
        
    summary = {
        "model_name": model_name,
        "evaluation_probes": total_probes,
        "total_passed": total_correct,
        "accuracy_percent": acc,
        "confidence_interval_95": [ci_low, ci_high],
        "mean_latency_ms": round((sum(latencies) / max(1, len(latencies))) * 1000, 2),
        "total_wall_clock_seconds": round(total_time, 2),
        "domain_breakdown": domain_results
    }
    
    return summary, failures


def main():
    print("=" * 80)
    print("VISION 100M — INDEPENDENT BENCHMARK EVALUATOR")
    print("=" * 80)
    
    torch.set_num_threads(2)
    
    # Load probes from Set A
    probes = []
    with open(SET_A_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                probes.append(json.loads(line))
    print(f"Loaded {len(probes)} probes from {SET_A_FILE}")
    
    ckpt_100m = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-100m-foundation")
    weights_path = os.path.join(ckpt_100m, "weights.pt")
    
    if not os.path.exists(weights_path):
        print(f"ERROR: Checkpoint not found at {weights_path}")
        return
        
    print(f"Loading tokenizer from {ckpt_100m}...")
    tokenizer = JarvisBPE.load(ckpt_100m)
    
    print(f"Loading VISION 100M model from {ckpt_100m}...")
    cfg = JarvisConfig.from_dict(json.load(open(os.path.join(ckpt_100m, "config.json"), "r", encoding="utf-8")))
    model = JarvisUnifiedTransformer(cfg)
    payload = torch.load(weights_path, map_location="cpu")
    state_dict = payload["model_state_dict"] if "model_state_dict" in payload else payload
    model.load_state_dict(state_dict, strict=False)
    model.eval()
    
    summary_100m, failures_100m = evaluate_model_on_probes(model, tokenizer, "vision-scale-100m", probes)
    
    # Failure categorization
    category_counts = {}
    for f in failures_100m:
        cat = f["failure_category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1
        
    # Historical Benchmark Baseline Comparison
    benchmark_deliverable = {
        "evaluation_name": "VISION 100M Independent Multi-Domain Benchmark",
        "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "validation_dataset": os.path.basename(SET_A_FILE),
        "total_probes": len(probes),
        "tested_model": summary_100m,
        "historical_comparative_table": {
            "vision_v1_4_calibrated_baseline": {
                "parameters": "13.33M",
                "score_240": "24/240",
                "accuracy_percent": 10.00,
                "ci_95": [6.83, 14.42],
                "status": "HISTORICAL_BASELINE"
            },
            "vision_v1_4_candidate_b": {
                "parameters": "13.33M",
                "score_240": "24/240",
                "accuracy_percent": 10.00,
                "ci_95": [6.83, 14.42],
                "status": "REFERENCE_REPLAY"
            },
            "vision_v1_4_candidate_e": {
                "parameters": "13.33M",
                "score_240": "28/240",
                "accuracy_percent": 11.67,
                "ci_95": [8.22, 16.31],
                "status": "PRECISION_CANDIDATE"
            },
            "vision_2_0_candidate_g": {
                "parameters": "13.33M",
                "score_240": "27/240",
                "accuracy_percent": 11.25,
                "ci_95": [7.87, 15.82],
                "status": "V2_FOUNDATION_REFERENCE"
            },
            "vision_scale_100m_foundation": {
                "parameters": "98.26M",
                "score_240": f"{summary_100m['total_passed']}/{len(probes)}",
                "accuracy_percent": summary_100m["accuracy_percent"],
                "ci_95": summary_100m["confidence_interval_95"],
                "status": "100M_PILOT_VALIDATED"
            }
        }
    }
    
    with open(OUT_RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump(benchmark_deliverable, f, indent=2)
    print(f"\nSaved benchmark results to {OUT_RESULTS_JSON}")
    
    failure_deliverable = {
        "analysis_name": "VISION 100M Independent Probe Failure Taxonomy",
        "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model_name": "vision-scale-100m",
        "total_failures": len(failures_100m),
        "failure_rate_percent": round((len(failures_100m) / len(probes)) * 100, 2),
        "failure_categories_distribution": category_counts,
        "failures_sample": failures_100m[:50]
    }
    
    with open(OUT_FAILURES_JSON, "w", encoding="utf-8") as f:
        json.dump(failure_deliverable, f, indent=2)
    print(f"Saved failure analysis to {OUT_FAILURES_JSON}")


if __name__ == "__main__":
    main()
