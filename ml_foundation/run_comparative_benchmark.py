"""
Expanded Held-Out Comparative Benchmark Runner
ml_foundation/run_comparative_benchmark.py

Evaluates v1.4, v1.5 scratch, and v1.5 recovered side-by-side on all 80 expanded probes.
Saves:
- Full per-probe prompt, expected, generated, passed, error_reason
- Per-domain accuracy breakdown
- Comparative head-to-head delta analysis
- Output: data/learning/expanded_benchmark_report.json
"""

import json
import os
import sys
import time

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.expanded_evaluator import evaluate_checkpoint_expanded


def run_comparative_eval():
    ckpts = {
        "v14_calibrated": "data/neural_models/checkpoints/vision-v1.4-calibrated-local",
        "v15_scratch": "data/neural_models/checkpoints/vision-v1.5-25m-local",
        "v15_recovered": "data/neural_models/checkpoints/vision-v1.5-25m-recovered"
    }

    all_results = {}
    for name, path in ckpts.items():
        print(f"\n{'='*75}\nEVALUATING: {name} ({path})\n{'='*75}")
        rep = evaluate_checkpoint_expanded(path, quiet=False)
        all_results[name] = rep

    # Compile comparative delta
    v14_res = all_results["v14_calibrated"]
    v15_s_res = all_results["v15_scratch"]
    v15_r_res = all_results["v15_recovered"]

    comparative = {
        "summary": {
            "v14_calibrated": {
                "parameters": 13332498,
                "passed": v14_res["passed_probes"],
                "total": v14_res["total_probes"],
                "accuracy_pct": v14_res["overall_accuracy_pct"]
            },
            "v15_scratch": {
                "parameters": 26785394,
                "passed": v15_s_res["passed_probes"],
                "total": v15_s_res["total_probes"],
                "accuracy_pct": v15_s_res["overall_accuracy_pct"]
            },
            "v15_recovered": {
                "parameters": 26785394,
                "passed": v15_r_res["passed_probes"],
                "total": v15_r_res["total_probes"],
                "accuracy_pct": v15_r_res["overall_accuracy_pct"]
            }
        },
        "domain_comparison": {},
        "per_probe_head_to_head": []
    }

    domains = list(v14_res["domain_breakdown"].keys())
    for d in domains:
        comparative["domain_comparison"][d] = {
            "v14": v14_res["domain_breakdown"][d],
            "v15_scratch": v15_s_res["domain_breakdown"][d],
            "v15_recovered": v15_r_res["domain_breakdown"][d]
        }

    for p14, p15s, p15r in zip(v14_res["per_probe_results"], v15_s_res["per_probe_results"], v15_r_res["per_probe_results"]):
        comparative["per_probe_head_to_head"].append({
            "id": p14["id"],
            "domain": p14["domain"],
            "prompt": p14["prompt"],
            "expected": p14["expected"],
            "v14": {"passed": p14["passed"], "output": p14["generated"], "error": p14["error_reason"]},
            "v15_scratch": {"passed": p15s["passed"], "output": p15s["generated"], "error": p15s["error_reason"]},
            "v15_recovered": {"passed": p15r["passed"], "output": p15r["generated"], "error": p15r["error_reason"]}
        })

    out_file = os.path.join("data", "learning", "expanded_benchmark_report.json")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(comparative, f, indent=2)
    print(f"\nSaved expanded comparative benchmark report to {out_file}")
    return comparative


if __name__ == "__main__":
    run_comparative_eval()
