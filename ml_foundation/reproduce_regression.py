"""
VISION v1.5 Regression Reproduction & Head-to-Head Comparative Benchmark
ml_foundation/reproduce_regression.py

Runs the identical 64-probe held-out benchmark side-by-side on:
- VISION v1.4 (vision-v1.4-calibrated-local, 13.33M)
- VISION v1.5 (vision-v1.5-25m-local, 26.78M)

Ensures exact parity across:
- Prompts and test harness
- Temperature (0.02), repetition penalty (1.05), no_repeat_ngram_size (4)
- Tokenizer (JarvisBPE, 8192 vocab)
- Live verification functions (Python AST/exec, JS Node VM, Java regex/parse, Math exact, Reasoning)
- Saves full per-question outputs and failure taxonomy to data/learning/regression_reproduction_report.json
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Dict, Any, List

import torch

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.v14_evaluator import run_v14_evaluation


def reproduce_regression() -> Dict[str, Any]:
    torch.set_num_threads(4)
    v14_ckpt = "data/neural_models/checkpoints/vision-v1.4-calibrated-local"
    v15_ckpt = "data/neural_models/checkpoints/vision-v1.5-25m-local"

    print("\n=======================================================")
    print("STEP 1: EVALUATING VISION v1.4 (13.33M BASELINE)")
    print("=======================================================")
    t0_14 = time.perf_counter()
    res_14 = run_v14_evaluation(v14_ckpt, quiet=False)
    time_14 = time.perf_counter() - t0_14

    print("\n=======================================================")
    print("STEP 2: EVALUATING VISION v1.5 (26.78M REGRESSION)")
    print("=======================================================")
    t0_15 = time.perf_counter()
    res_15 = run_v14_evaluation(v15_ckpt, quiet=False)
    time_15 = time.perf_counter() - t0_15

    # Align per-probe results
    probes_14 = {r["id"]: r for r in res_14["per_example_results"]}
    probes_15 = {r["id"]: r for r in res_15["per_example_results"]}

    head_to_head: List[Dict[str, Any]] = []
    regression_cases: List[Dict[str, Any]] = []
    recovery_targets: List[str] = []

    failure_taxonomy_counts: Dict[str, int] = {
        "syntax_collapse_or_gibberish": 0,
        "arithmetic_calculation_error": 0,
        "logic_reasoning_error": 0,
        "code_signature_or_exec_failure": 0,
        "missing_entity_or_concept": 0,
        "other": 0
    }

    for pid in probes_14:
        p14 = probes_14[pid]
        p15 = probes_15.get(pid, {})

        passed_14 = p14["passed"]
        passed_15 = p15.get("passed", False)

        # Classify v1.5 failure reason if it failed
        tax_category = None
        if not passed_15:
            reason = p15.get("failure_reason", "")
            gen = p15.get("generated", "")
            if len(gen.strip()) < 5 or any(k in gen.lower() for k in ["???", "###", "...", "... ..."]):
                tax_category = "syntax_collapse_or_gibberish"
            elif "arithmetic" in p15.get("category", "") or "math" in p15.get("category", ""):
                tax_category = "arithmetic_calculation_error"
            elif "reasoning" in p15.get("category", ""):
                tax_category = "logic_reasoning_error"
            elif "coding" in p15.get("category", ""):
                tax_category = "code_signature_or_exec_failure"
            else:
                tax_category = "missing_entity_or_concept"
            failure_taxonomy_counts[tax_category] += 1

        entry = {
            "pid": pid,
            "category": p14["category"],
            "prompt": p14["prompt"],
            "expected": p14["expected"],
            "v14": {
                "generated": p14["generated"],
                "passed": passed_14,
                "failure_reason": p14["failure_reason"],
                "latency_ms": p14["latency_ms"],
            },
            "v15": {
                "generated": p15.get("generated", ""),
                "passed": passed_15,
                "failure_reason": p15.get("failure_reason", ""),
                "latency_ms": p15.get("latency_ms", 0.0),
                "failure_taxonomy": tax_category
            },
            "status": "BOTH_PASS" if (passed_14 and passed_15) else (
                "REGRESSION" if (passed_14 and not passed_15) else (
                    "V15_IMPROVEMENT" if (not passed_14 and passed_15) else "BOTH_FAIL"
                )
            )
        }
        head_to_head.append(entry)

        if entry["status"] == "REGRESSION":
            regression_cases.append(entry)
            recovery_targets.append(pid)

    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": {
            "v14": {
                "params": 13332498,
                "total_probes": res_14["total_probes"],
                "passed": res_14["passed_probes"],
                "pass_rate_pct": res_14["overall_pass_rate"],
                "p50_latency_ms": res_14["p50_latency_ms"],
                "eval_duration_sec": round(time_14, 2),
                "category_pass_rates": res_14["category_pass_rates"]
            },
            "v15": {
                "params": 26785394,
                "total_probes": res_15["total_probes"],
                "passed": res_15["passed_probes"],
                "pass_rate_pct": res_15["overall_pass_rate"],
                "p50_latency_ms": res_15["p50_latency_ms"],
                "eval_duration_sec": round(time_15, 2),
                "category_pass_rates": res_15["category_pass_rates"]
            },
            "delta": {
                "param_multiplier": round(26785394 / 13332498, 2),
                "score_drop": round(res_15["overall_pass_rate"] - res_14["overall_pass_rate"], 2),
                "latency_slowdown_factor": round(res_15["p50_latency_ms"] / max(res_14["p50_latency_ms"], 1.0), 2),
                "regressed_probe_count": len(regression_cases),
                "both_passed_count": sum(1 for e in head_to_head if e["status"] == "BOTH_PASS"),
                "both_failed_count": sum(1 for e in head_to_head if e["status"] == "BOTH_FAIL"),
                "v15_improved_count": sum(1 for e in head_to_head if e["status"] == "V15_IMPROVEMENT"),
            },
            "v15_failure_taxonomy": failure_taxonomy_counts
        },
        "head_to_head": head_to_head,
    }

    print("\n=======================================================")
    print("HEAD-TO-HEAD REGRESSION SUMMARY:")
    print("=======================================================")
    print(f"VISION v1.4 (13.3M): {res_14['passed_probes']}/{res_14['total_probes']} ({res_14['overall_pass_rate']}%) | P50: {res_14['p50_latency_ms']:.1f} ms")
    print(f"VISION v1.5 (26.8M): {res_15['passed_probes']}/{res_15['total_probes']} ({res_15['overall_pass_rate']}%) | P50: {res_15['p50_latency_ms']:.1f} ms")
    print(f"Net Score Delta:     {report['summary']['delta']['score_drop']}% ({res_14['passed_probes']} -> {res_15['passed_probes']})")
    print(f"Latency Slowdown:    {report['summary']['delta']['latency_slowdown_factor']}x")
    print(f"Regressed Probes:    {len(regression_cases)} probes passed in v1.4 but failed in v1.5")
    print(f"Both Passed:         {report['summary']['delta']['both_passed_count']}")
    print(f"V15 Only Passed:     {report['summary']['delta']['v15_improved_count']}")
    print(f"Failure Taxonomy in v1.5:")
    for k, v in failure_taxonomy_counts.items():
        print(f"  - {k:<32}: {v} failures")

    out_path = "data/learning/regression_reproduction_report.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nFull reproduction logs saved to {out_path}")

    return report


if __name__ == "__main__":
    reproduce_regression()
