import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import json
import time
import torch
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.evaluate_independent_transfer import verify_probe, wilson_score_interval

tokenizer = JarvisBPE.load("data/neural_models/checkpoints/vision-v1.4-replay-cand-b")
ckpt_dir = "data/neural_models/checkpoints/vision-pretraining-validation-13m"
with open(f"{ckpt_dir}/config.json") as f:
    cfg = JarvisConfig.from_dict(json.load(f))

model = JarvisUnifiedTransformer(cfg)
model.load_state_dict(torch.load(f"{ckpt_dir}/weights.pt", map_location="cpu"))
model.eval()

with open("vision_independent_transfer_test_200.jsonl") as f:
    probes = [json.loads(l) for l in f]

domain_stats = {}
passed_count = 0
results = []
t0 = time.time()

for p in probes:
    dom = p.get("domain", "general")
    if dom not in domain_stats:
        domain_stats[dom] = {"passed": 0, "total": 0}
    domain_stats[dom]["total"] += 1

    prompt = f"<bos><user>{p['prompt']}</user><assistant>"
    inp = tokenizer.encode(prompt)
    x = torch.tensor([inp], dtype=torch.long)

    with torch.no_grad():
        out_ids = model.generate(
            x,
            max_new_tokens=48,
            temperature=0.01,
            repetition_penalty=1.15,
            no_repeat_ngram_size=4,
            eos_id=tokenizer.eos_id,
            stop_token_ids=[tokenizer.vocab["</assistant>"]] if "</assistant>" in tokenizer.vocab else None
        )
    gen_tokens = out_ids[len(inp):]
    decoded = tokenizer.decode(gen_tokens, skip_special_tokens=True).strip()
    passed, reason = verify_probe(p, decoded)
    if passed:
        passed_count += 1
        domain_stats[dom]["passed"] += 1

    results.append({
        "id": p["id"],
        "domain": dom,
        "prompt": p["prompt"],
        "expected": p.get("expected_answer"),
        "generated": decoded,
        "passed": passed,
        "reason": reason
    })

elapsed = time.time() - t0
acc = passed_count / len(probes)
ci_low, ci_high = wilson_score_interval(passed_count, len(probes))

for d, st in domain_stats.items():
    st["accuracy_pct"] = round(st["passed"] / st["total"] * 100.0, 2)

summary = {
    "model": "vision-pretraining-validation-13m",
    "decoding": "calibrated (repetition_penalty=1.15, no_repeat_ngram_size=4)",
    "total_probes": len(probes),
    "passed_probes": passed_count,
    "overall_accuracy_pct": round(acc * 100.0, 2),
    "wilson_95_ci": [round(ci_low * 100.0, 2), round(ci_high * 100.0, 2)],
    "elapsed_time_s": round(elapsed, 2),
    "domain_breakdown": domain_stats,
    "sample_passes": [r for r in results if r["passed"]],
    "sample_failures": [r for r in results if not r["passed"]][:10]
}

out_file = "vision_calibrated_benchmark_results.json"
with open(out_file, "w") as f:
    json.dump(summary, f, indent=2)

print(f"Evaluation complete in {elapsed:.1f}s")
print(f"Passed: {passed_count}/{len(probes)} ({acc*100.0:.2f}%)")
print(f"Wilson 95% CI: [{ci_low*100.0:.2f}%, {ci_high*100.0:.2f}%]")
print("Domain breakdown:")
for d, st in domain_stats.items():
    print(f"  - {d:25s}: {st['passed']}/{st['total']} ({st['accuracy_pct']}%)")
if summary["sample_passes"]:
    print(f"\nSample passes ({len(summary['sample_passes'])}):")
    for sp in summary["sample_passes"][:5]:
        print(f"  [{sp['id']}] '{sp['prompt']}' -> '{sp['generated'][:60]}' (Expected: '{sp['expected']}')")
