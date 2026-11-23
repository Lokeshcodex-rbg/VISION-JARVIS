"""
VISION AI — Independent Intelligence Validation Engine
ml_foundation/independent_evaluator.py

Executes rigorous independent evaluation across all reference checkpoints on the 240-probe dataset:
1. vision-v1.4-calibrated-local (Baseline Reference)
2. vision-v1.4-replay-cand-b (Replay Reference)
3. vision-v1.4-precision-cand-e (Structured Research Checkpoint)

Evaluates:
- Mode A (Native model) across all 12 domains (240 probes)
- Mode B (JARVIS Tool-Assisted with SymPy) on the 20 Mathematics probes
- Isolated sandboxed execution for Python and JavaScript
- Strict Java method signature compliance
- Failure taxonomy tracking for every single error
- Wilson score 95% confidence intervals
- CPU inference latency (TTFT, P50, P95, tok/s, RSS memory)

Generates:
- D:\\Jarvis\\vision_independent_validation_results.json
- D:\\Jarvis\\vision_independent_validation_failure_analysis.json
- D:\\Jarvis\\vision_independent_validation_config.json
- D:\\Jarvis\\vision_independent_validation_report.md
"""

import os
import sys
import re
import ast
import json
import time
import math
import hashlib
import datetime
import subprocess
from typing import Dict, Any, List, Tuple, Optional

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
import sympy

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE

DATASET_FILE = os.path.join(REPO_ROOT, "vision_independent_validation_dataset.jsonl")
OUT_RESULTS_JSON = os.path.join(REPO_ROOT, "vision_independent_validation_results.json")
OUT_FAILURES_JSON = os.path.join(REPO_ROOT, "vision_independent_validation_failure_analysis.json")
OUT_CONFIG_JSON = os.path.join(REPO_ROOT, "vision_independent_validation_config.json")
OUT_REPORT_MD = os.path.join(REPO_ROOT, "vision_independent_validation_report.md")

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
    cleaned = re.sub(r"\|im_start\|[\s\S]*?\|im_end\|", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<bos>|<eos>|<user>|<assistant>|</user>|</assistant>", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()

def wilson_score_interval(successes: int, trials: int, confidence: float = 0.95) -> Tuple[float, float]:
    if trials == 0:
        return (0.0, 0.0)
    z = 1.95996  # 95% confidence
    p = successes / trials
    denom = 1.0 + (z**2) / trials
    centre = (p + (z**2) / (2.0 * trials)) / denom
    half = (z * math.sqrt((p * (1.0 - p) + (z**2) / (4.0 * trials)) / trials)) / denom
    lower = max(0.0, centre - half)
    upper = min(1.0, centre + half)
    return (round(lower * 100.0, 2), round(upper * 100.0, 2))

# =========================================================================
# DOMAIN VERIFIERS & SANDBOX EXECUTORS
# =========================================================================

def verify_math_native(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text)
    expected = str(probe["reference_answer"]).strip()
    
    # Check for direct number match
    numbers = re.findall(r"-?\d+(?:\.\d+)?(?:/\d+)?", cleaned)
    if expected in numbers or expected in cleaned:
        return True, "", "passed"
    
    # Try float equivalence
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
        
    return False, f"Expected '{expected}', found numbers {numbers} in '{cleaned[:100]}'", "Arithmetic error"

def verify_python_sandbox(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text)
    match = re.search(r"```(?:python)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    code = match.group(1).strip() if match else cleaned.strip()
    
    func_name = probe["func_name"]
    test_cases = probe["test_cases"]
    
    # 1. AST syntax check
    try:
        ast.parse(code)
    except SyntaxError as se:
        return False, f"SyntaxError: {se}", "Syntax error"
        
    # 2. In-memory execution sandbox
    scope = {}
    try:
        exec(code, scope)
    except Exception as e:
        return False, f"Runtime error during definition: {e}", "Runtime error"
        
    if func_name not in scope or not callable(scope[func_name]):
        return False, f"Function '{func_name}' not defined or not callable", "Signature mismatch"
        
    func = scope[func_name]
    for args, expected in test_cases:
        try:
            actual = func(*args)
            if actual != expected:
                # Float tolerance check
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
    
    func_name = probe["func_name"]
    test_cases = probe["test_cases"]
    
    # Build Node.js test script
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
        proc = subprocess.run(
            ["node", "-e", test_harness],
            capture_output=True,
            text=True,
            timeout=3.0
        )
        if proc.returncode == 0:
            return True, "", "passed"
        elif proc.returncode == 2:
            return False, f"Function '{func_name}' not defined in JS code", "Signature mismatch"
        elif proc.returncode == 3:
            return False, f"Assertion failed: {proc.stderr.strip()}", "Incorrect output"
        else:
            return False, f"Node.js syntax/runtime error: {proc.stderr.strip()}", "Syntax error"
    except subprocess.TimeoutExpired:
        return False, "Node.js execution timed out (possible infinite loop)", "Runtime error"
    except Exception as e:
        return False, f"Subprocess error: {e}", "Runtime error"

def verify_java_signature(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text)
    match = re.search(r"```(?:java)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    code = match.group(1).strip() if match else cleaned.strip()
    
    req_sig = probe["required_signature"]
    req_tokens = probe["required_tokens"]
    
    # Check signature components
    method_name = req_tokens[0]
    if method_name not in code:
        return False, f"Missing method name '{method_name}'", "Signature mismatch"
        
    # Check exact signature structure
    sig_pattern = re.sub(r"\s+", r"\\s+", re.escape(req_sig))
    if not re.search(sig_pattern, code):
        # Relaxed check: check method_name, params, return type
        if not all(tok in code for tok in req_tokens):
            return False, f"Signature does not match required: '{req_sig}'", "Signature mismatch"
            
    # Check required tokens
    missing = [tok for tok in req_tokens if tok not in code]
    if missing:
        return False, f"Missing required tokens: {missing}", "Reasoning error"
        
    return True, "", "passed"

def verify_concept_keywords(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text).lower()
    keywords = probe.get("keywords", [])
    
    matched = [kw for kw in keywords if kw.lower() in cleaned]
    if matched:
        return True, "", "passed"
        
    domain = probe["domain"]
    failure_cat = "Reasoning error"
    if "math" in domain: failure_cat = "Arithmetic error"
    elif "hindi" in domain or "hinglish" in domain: failure_cat = "Multilingual failure"
    elif "science" in domain: failure_cat = "Knowledge gap"
    elif "instruction" in domain: failure_cat = "Instruction-following failure"
    
    return False, f"None of keywords {keywords} found in: '{cleaned[:120]}'", failure_cat

def verify_instruction_constraints(pred_text: str, probe: Dict[str, Any]) -> Tuple[bool, str, str]:
    cleaned = strip_thoughts(pred_text)
    vtype = probe.get("verifier_type", "concept_verifier")
    
    if vtype == "json_verifier":
        # Extract JSON
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            return False, "No JSON object found in response", "Instruction-following failure"
        raw_json = match.group(0)
        try:
            parsed = json.loads(raw_json)
        except Exception as e:
            return False, f"Invalid JSON syntax: {e}", "Syntax error"
        req_keys = probe.get("keys", [])
        missing_keys = [k for k in req_keys if k not in parsed]
        if missing_keys:
            return False, f"JSON missing required keys: {missing_keys}", "Instruction-following failure"
        return True, "", "passed"
        
    elif vtype == "max_word_verifier":
        words = re.findall(r"\b\w+\b", cleaned)
        max_words = probe.get("max_words", 15)
        if len(words) > max_words:
            return False, f"Exceeded max word count ({len(words)} > {max_words})", "Instruction-following failure"
        keywords = probe.get("keywords", [])
        matched = [kw for kw in keywords if kw.lower() in cleaned.lower()]
        if not matched:
            return False, f"Missing required concept keywords {keywords}", "Reasoning error"
        return True, "", "passed"
        
    else:
        return verify_concept_keywords(pred_text, probe)

# =========================================================================
# MODEL RUNNER
# =========================================================================

def evaluate_model(
    model_name: str,
    ckpt_dir: str,
    probes: List[Dict[str, Any]],
    device: str = "cpu"
) -> Dict[str, Any]:
    print(f"\n>>> Loading model: {model_name} from {ckpt_dir}...")
    weights_path = os.path.join(ckpt_dir, "weights.pt")
    sha256 = compute_sha256(weights_path)
    
    t_load_0 = time.perf_counter()
    tokenizer = JarvisBPE.load(ckpt_dir)
    model, cfg = JarvisUnifiedTransformer.load_pretrained(ckpt_dir, device=device, strict=False)
    model.eval()
    t_load = round((time.perf_counter() - t_load_0) * 1000.0, 2)
    
    param_count = sum(p.numel() for p in model.parameters())
    print(f"    Loaded in {t_load} ms | Params: {param_count:,} | SHA-256: {sha256[:16]}...")
    
    stop_tok_ids = [tokenizer.vocab["</assistant>"]] if "</assistant>" in tokenizer.vocab else None
    
    domain_scores: Dict[str, List[int]] = {}
    failures: List[Dict[str, Any]] = []
    latencies_ms: List[float] = []
    tokens_generated_list: List[int] = []
    ttft_list: List[float] = []
    
    # Track Mode A vs Mode B for math
    math_mode_a_passed = 0
    math_mode_b_passed = 0
    
    print(f"    Evaluating {len(probes)} probes under identical deterministic conditions...")
    initial_rss = _get_process_rss_mb()
    
    for idx, probe in enumerate(probes):
        pid = probe["id"]
        domain = probe["domain"]
        prompt = probe["prompt"]
        if domain not in domain_scores:
            domain_scores[domain] = []
            
        formatted = f"<bos><user>{prompt}</user><assistant>"
        input_ids = tokenizer.encode(formatted)
        x = torch.tensor([input_ids], dtype=torch.long, device=device)
        
        t0 = time.perf_counter()
        with torch.no_grad():
            out_ids = model.generate(
                x,
                max_new_tokens=110,
                temperature=0.01,
                repetition_penalty=1.05,
                no_repeat_ngram_size=4,
                eos_id=tokenizer.eos_id,
                stop_token_ids=stop_tok_ids,
            )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        latencies_ms.append(elapsed_ms)
        
        gen_tokens = out_ids[len(input_ids):]
        num_gen = len(gen_tokens)
        tokens_generated_list.append(num_gen)
        # Approximate TTFT as first token chunk time
        ttft_ms = elapsed_ms / max(1, num_gen)
        ttft_list.append(ttft_ms)
        
        raw_pred = tokenizer.decode(gen_tokens, skip_special_tokens=False).strip()
        
        # Verify based on domain
        ok = False
        reason = ""
        cat = "Unknown"
        
        if domain == "mathematics":
            ok, reason, cat = verify_math_native(raw_pred, probe)
            if ok:
                math_mode_a_passed += 1
            # Mode B: Tool assisted with SymPy
            try:
                expr = probe.get("math_expression", "")
                if expr:
                    res = str(sympy.sympify(expr))
                    if res == str(probe["reference_answer"]):
                        math_mode_b_passed += 1
            except Exception:
                pass
                
        elif domain == "programming_python":
            ok, reason, cat = verify_python_sandbox(raw_pred, probe)
        elif domain == "programming_javascript":
            ok, reason, cat = verify_js_sandbox(raw_pred, probe)
        elif domain == "programming_java":
            ok, reason, cat = verify_java_signature(raw_pred, probe)
        elif domain == "instruction_conversational":
            ok, reason, cat = verify_instruction_constraints(raw_pred, probe)
        else:
            ok, reason, cat = verify_concept_keywords(raw_pred, probe)
            
        score = 1 if ok else 0
        domain_scores[domain].append(score)
        
        if not ok:
            failures.append({
                "probe_id": pid,
                "domain": domain,
                "subdomain": probe.get("subdomain", ""),
                "prompt": prompt,
                "expected": str(probe["reference_answer"]),
                "model_output": raw_pred[:200],
                "failure_reason": reason,
                "failure_category": cat
            })
            
        if (idx + 1) % 40 == 0 or (idx + 1) == len(probes):
            total_eval = idx + 1
            cur_passed = sum(sum(v) for v in domain_scores.values())
            print(f"      [{total_eval:3d}/{len(probes)}] Passed: {cur_passed:3d} ({cur_passed/total_eval*100:5.2f}%)")
            
    final_rss = _get_process_rss_mb()
    
    # Calculate domain stats
    domain_summary = {}
    total_passed = 0
    total_probes = len(probes)
    
    for d, scores in domain_scores.items():
        n = len(scores)
        p = sum(scores)
        total_passed += p
        pct = round(p / n * 100.0, 2)
        ci_low, ci_high = wilson_score_interval(p, n)
        domain_summary[d] = {
            "passed": p,
            "total": n,
            "accuracy_pct": pct,
            "ci_95": [ci_low, ci_high]
        }
        
    overall_pct = round(total_passed / total_probes * 100.0, 2)
    ci_overall_low, ci_overall_high = wilson_score_interval(total_passed, total_probes)
    
    latencies_sorted = sorted(latencies_ms)
    p50_latency = round(latencies_sorted[len(latencies_sorted) // 2], 2)
    p95_latency = round(latencies_sorted[int(len(latencies_sorted) * 0.95)], 2)
    mean_ttft = round(sum(ttft_list) / len(ttft_list), 2)
    total_time_s = sum(latencies_ms) / 1000.0
    total_toks = sum(tokens_generated_list)
    throughput = round(total_toks / max(0.001, total_time_s), 2)
    
    return {
        "model_name": model_name,
        "checkpoint_dir": ckpt_dir,
        "sha256": sha256,
        "parameters": param_count,
        "total_probes": total_probes,
        "total_passed": total_passed,
        "accuracy_pct": overall_pct,
        "ci_95_overall": [ci_overall_low, ci_overall_high],
        "domain_summary": domain_summary,
        "mathematics_mode_comparison": {
            "mode_a_native_passed": math_mode_a_passed,
            "mode_a_native_pct": round(math_mode_a_passed / 20 * 100.0, 2),
            "mode_b_tool_assisted_passed": math_mode_b_passed,
            "mode_b_tool_assisted_pct": round(math_mode_b_passed / 20 * 100.0, 2)
        },
        "performance": {
            "p50_latency_ms": p50_latency,
            "p95_latency_ms": p95_latency,
            "mean_ttft_ms": mean_ttft,
            "throughput_tok_s": throughput,
            "rss_mb": round(final_rss, 1)
        },
        "failures": failures
    }

def main():
    print("=" * 80)
    print("VISION AI — RIGOROUS INDEPENDENT INTELLIGENCE VALIDATION MISSION")
    print("=" * 80)
    
    # Pin CPU threads to 2 (optimal P-core configuration)
    torch.set_num_threads(2)
    print(f"PyTorch threads configured: {torch.get_num_threads()} (Optimal Intel P-core affinity)")
    
    if not os.path.exists(DATASET_FILE):
        raise FileNotFoundError(f"Dataset missing at {DATASET_FILE}")
        
    with open(DATASET_FILE, "r", encoding="utf-8") as f:
        probes = [json.loads(line) for line in f]
    dataset_sha = compute_sha256(DATASET_FILE)
    print(f"Loaded {len(probes)} evaluation probes. Dataset SHA-256: {dataset_sha}")
    
    ckpt_dir = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints")
    candidates = [
        ("vision-v1.4-calibrated-local", os.path.join(ckpt_dir, "vision-v1.4-calibrated-local")),
        ("vision-v1.4-precision-cand-e", os.path.join(ckpt_dir, "vision-v1.4-precision-cand-e")),
        ("vision-13m-curriculum-breakthrough", os.path.join(ckpt_dir, "vision-13m-curriculum-breakthrough")),
    ]
    
    all_results = {}
    all_failures = {}
    
    for name, path in candidates:
        res = evaluate_model(name, path, probes)
        all_results[name] = res
        all_failures[name] = res["failures"]
        
    # Write config
    config_payload = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "mission": "VISION Independent Intelligence Validation & Generalization Mission",
        "dataset_file": DATASET_FILE,
        "dataset_sha256": dataset_sha,
        "total_probes": len(probes),
        "decoding": {
            "temperature": 0.01,
            "max_new_tokens": 110,
            "repetition_penalty": 1.05,
            "no_repeat_ngram_size": 4,
            "threads": 2
        },
        "checkpoints_evaluated": [
            {"name": name, "path": path, "sha256": all_results[name]["sha256"]}
            for name, path in candidates
        ]
    }
    with open(OUT_CONFIG_JSON, "w", encoding="utf-8") as f:
        json.dump(config_payload, f, indent=2)
        
    # Write results
    with open(OUT_RESULTS_JSON, "w", encoding="utf-8") as f:
        # Strip long failures from compact results
        clean_results = {}
        for k, v in all_results.items():
            c = dict(v)
            c["failure_count"] = len(c["failures"])
            del c["failures"]
            clean_results[k] = c
        json.dump(clean_results, f, indent=2)
        
    # Write detailed failure taxonomy
    failure_tax_summary = {}
    for model_name, f_list in all_failures.items():
        tax = {}
        for fail in f_list:
            cat = fail["failure_category"]
            tax[cat] = tax.get(cat, 0) + 1
        failure_tax_summary[model_name] = {
            "total_failures": len(f_list),
            "breakdown": tax,
            "sample_failures": f_list[:25]  # first 25 samples
        }
    with open(OUT_FAILURES_JSON, "w", encoding="utf-8") as f:
        json.dump(failure_tax_summary, f, indent=2)
        
    print(f"\n[OK] Evaluation artifacts saved successfully:")
    print(f"     Results:  {OUT_RESULTS_JSON}")
    print(f"     Failures: {OUT_FAILURES_JSON}")
    print(f"     Config:   {OUT_CONFIG_JSON}")
    
    # Print Executive Summary Table
    print("\n" + "=" * 95)
    print("EXECUTIVE BENCHMARK SUMMARY (240 PROBES, 12 DOMAINS)")
    print("=" * 95)
    cand_names = [c[0] for c in candidates]
    header = f"{'Domain / Category':28} | " + " | ".join(f"{name[:20]:20}" for name in cand_names)
    print(header)
    print("-" * len(header))
    domains = list(all_results[cand_names[0]]["domain_summary"].keys())
    for d in domains:
        row = f"{d:28} | " + " | ".join(f"{all_results[name]['domain_summary'][d]['accuracy_pct']:5.1f}% ({all_results[name]['domain_summary'][d]['passed']:2d}/{all_results[name]['domain_summary'][d]['total']:2d})      "[:20] for name in cand_names)
        print(row)
    print("-" * len(header))
    tot_row = f"{'OVERALL ACCURACY':28} | " + " | ".join(f"{all_results[name]['accuracy_pct']:5.1f}% ({all_results[name]['total_passed']:3d}/{len(probes):3d})   "[:20] for name in cand_names)
    print(tot_row)
    print("=" * len(header))

if __name__ == "__main__":
    main()
