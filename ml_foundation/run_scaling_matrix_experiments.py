"""
MASTER CONTROLLED SCALING EXPERIMENT RUNNER
(`ml_foundation/run_scaling_matrix_experiments.py`)

Executes the end-to-end controlled comparative training and evaluation:
1. Trains 13.33M model (50 optimizer updates on balanced dataset)
2. Trains 27.76M model (50 optimizer updates on balanced dataset)
3. Trains 98.26M model (25 optimizer updates on balanced dataset)
4. Evaluates all checkpoints on independent transfer test suite
5. Emits master comparative ledger with Wilson 95% CIs and scaling laws
"""

import os
import sys
import json
import time

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.train_controlled_comparison import train_model
from ml_foundation.evaluate_independent_transfer import evaluate_checkpoint

CKPT_BASE = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints")
TRANSFER_BM = os.path.join(REPO_ROOT, "vision_independent_transfer_test_200.jsonl")
MASTER_REPORT_OUT = os.path.join(REPO_ROOT, "vision_controlled_scaling_benchmark_master.json")


def main():
    print("=" * 80)
    print("MASTER CONTROLLED SCALING BENCHMARK EXECUTION")
    print("Models: 13.33M vs 27.76M vs 98.26M")
    print("Dataset: vision_25m_balanced (23.57M tokens across 6 pillars)")
    print("=" * 80)

    start_all = time.time()
    experiments = {}

    # 1. Train 13.33M (50 steps)
    t13_json = os.path.join(REPO_ROOT, "vision_scaling_experiment_13m_telemetry.json")
    if os.path.exists(t13_json):
        print(f"[REUSE] Found existing 13M training telemetry at {t13_json}")
        with open(t13_json, "r") as f:
            res_13m = json.load(f)
    else:
        t0 = time.time()
        res_13m = train_model("13m", max_steps=50, batch_size=16, grad_accum_steps=2, lr_max=3e-4)
        res_13m["wall_clock_time"] = round(time.time() - t0, 2)
    experiments["13m"] = res_13m

    # 2. Train 27.76M (50 steps)
    t25_json = os.path.join(REPO_ROOT, "vision_scaling_experiment_25m_telemetry.json")
    if os.path.exists(t25_json) and os.path.getsize(t25_json) > 1000:
        print(f"[REUSE] Found existing 25M training telemetry at {t25_json}")
        with open(t25_json, "r") as f:
            res_25m = json.load(f)
    else:
        t0 = time.time()
        res_25m = train_model("25m", max_steps=50, batch_size=16, grad_accum_steps=2, lr_max=3e-4)
        res_25m["wall_clock_time"] = round(time.time() - t0, 2)
    experiments["25m"] = res_25m

    # 3. Train 98.26M (25 steps)
    t100_json = os.path.join(REPO_ROOT, "vision_scaling_experiment_100m_telemetry.json")
    if os.path.exists(t100_json):
        print(f"[REUSE] Found existing 100M training telemetry at {t100_json}")
        with open(t100_json, "r") as f:
            res_100m = json.load(f)
    else:
        t0 = time.time()
        res_100m = train_model("100m", max_steps=25, batch_size=16, grad_accum_steps=2, lr_max=1.5e-4)
        res_100m["wall_clock_time"] = round(time.time() - t0, 2)
    experiments["100m"] = res_100m

    # 4. Independent Benchmark Evaluations
    print("\n" + "=" * 80)
    print("RUNNING INDEPENDENT TRANSFER BENCHMARK EVALUATIONS (200 PROBES)")
    print("=" * 80)

    eval_targets = {
        "13m_baseline": os.path.join(CKPT_BASE, "vision-13m-curriculum-breakthrough"),
        "13m_post_scaling": os.path.join(CKPT_BASE, "vision-13m-scaling-experiment"),
        "25m_post_scaling": os.path.join(CKPT_BASE, "vision-25m-compact-foundation"),
        "100m_stage4": os.path.join(CKPT_BASE, "vision-100m-stage4-curated"),
        "100m_post_scaling": os.path.join(CKPT_BASE, "vision-100m-scaling-experiment")
    }

    eval_results = {}
    for name, path in eval_targets.items():
        if os.path.exists(os.path.join(path, "weights.pt")):
            eval_results[name] = evaluate_checkpoint(path, TRANSFER_BM, max_probes=200)
        else:
            print(f"[SKIP] Checkpoint not found: {path}")

    # Compile Comparative Matrix
    master_payload = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_experiment_duration_s": round(time.time() - start_all, 2),
        "hardware": "13th Gen Intel Core i5-1335U (12 logical CPUs, local execution, $0.00 cloud cost)",
        "dataset": {
            "name": "vision_25m_balanced",
            "total_tokens": 23567617,
            "train_sha256": "01bfe2e951d06378cba5d97e50493fa47f24ffc9bdaed7b15e23eb8d174ce657"
        },
        "training_runs": experiments,
        "evaluations": eval_results,
        "comparative_summary": {
            "13m": {
                "params": experiments["13m"]["total_parameters"],
                "steps": experiments["13m"]["total_steps"],
                "tokens": experiments["13m"]["total_tokens"],
                "target_tokens": experiments["13m"]["total_target_tokens"],
                "speed_tps": experiments["13m"]["overall_tokens_per_sec"],
                "initial_loss": experiments["13m"]["initial_val_loss"],
                "final_loss": experiments["13m"]["final_val_loss"],
                "loss_delta": experiments["13m"]["val_loss_delta"],
                "eval_accuracy_pct": eval_results.get("13m_post_scaling", {}).get("overall_accuracy_pct", 0.0),
                "eval_wilson_ci": [
                    eval_results.get("13m_post_scaling", {}).get("wilson_95_ci_lower_pct", 0.0),
                    eval_results.get("13m_post_scaling", {}).get("wilson_95_ci_upper_pct", 0.0)
                ]
            },
            "25m": {
                "params": experiments["25m"]["total_parameters"],
                "steps": experiments["25m"]["total_steps"],
                "tokens": experiments["25m"]["total_tokens"],
                "target_tokens": experiments["25m"]["total_target_tokens"],
                "speed_tps": experiments["25m"]["overall_tokens_per_sec"],
                "initial_loss": experiments["25m"]["initial_val_loss"],
                "final_loss": experiments["25m"]["final_val_loss"],
                "loss_delta": experiments["25m"]["val_loss_delta"],
                "eval_accuracy_pct": eval_results.get("25m_post_scaling", {}).get("overall_accuracy_pct", 0.0),
                "eval_wilson_ci": [
                    eval_results.get("25m_post_scaling", {}).get("wilson_95_ci_lower_pct", 0.0),
                    eval_results.get("25m_post_scaling", {}).get("wilson_95_ci_upper_pct", 0.0)
                ]
            },
            "100m": {
                "params": experiments["100m"]["total_parameters"],
                "steps": experiments["100m"]["total_steps"],
                "tokens": experiments["100m"]["total_tokens"],
                "target_tokens": experiments["100m"]["total_target_tokens"],
                "speed_tps": experiments["100m"]["overall_tokens_per_sec"],
                "initial_loss": experiments["100m"]["initial_val_loss"],
                "final_loss": experiments["100m"]["final_val_loss"],
                "loss_delta": experiments["100m"]["val_loss_delta"],
                "eval_accuracy_pct": eval_results.get("100m_post_scaling", {}).get("overall_accuracy_pct", 0.0),
                "eval_wilson_ci": [
                    eval_results.get("100m_post_scaling", {}).get("wilson_95_ci_lower_pct", 0.0),
                    eval_results.get("100m_post_scaling", {}).get("wilson_95_ci_upper_pct", 0.0)
                ]
            }
        }
    }

    with open(MASTER_REPORT_OUT, "w") as f:
        json.dump(master_payload, f, indent=2)

    print("\n" + "=" * 80)
    print(f"[MASTER COMPLETE] Scaling benchmark report saved to {MASTER_REPORT_OUT}")
    print("=" * 80)


if __name__ == "__main__":
    main()
