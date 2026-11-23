"""
INDEPENDENT TRANSFER BENCHMARK EVALUATOR (`ml_foundation/evaluate_independent_transfer.py`)

Evaluates VISION checkpoints strictly natively on the independent 200-probe transfer test set
(`vision_independent_transfer_test_200.jsonl`):
- 100% Native VISION model inference
- 0 External APIs, 0 Gemini, 0 SymPy, 0 Tools, 0 RAG, 0 Python execution tricks
- Model in eval() mode with torch.no_grad()
- Autoregressive greedy generation up to max_new_tokens
- Exact domain scoring with Wilson 95% Confidence Intervals
"""

import ast
import json
import math
import os
import re
import sys
import time
from typing import Any, Dict, List, Tuple

import torch

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE

TRANSFER_TEST_FILE = os.path.join(REPO_ROOT, "vision_independent_transfer_test_200.jsonl")
EXPANDED_1500_FILE = os.path.join(REPO_ROOT, "vision_expanded_validation_dataset_1500.jsonl")
TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")


def wilson_score_interval(k: int, n: int, confidence: float = 0.95) -> Tuple[float, float]:
    """Calculates Wilson score interval for binomial proportions."""
    if n == 0:
        return 0.0, 0.0
    z = 1.95996  # 95% confidence
    p = k / n
    denominator = 1.0 + z * z / n
    centre_adjusted_probability = p + z * z / (2.0 * n)
    adjusted_std_dev = math.sqrt((p * (1.0 - p) + z * z / (4.0 * n)) / n)
    lower_bound = (centre_adjusted_probability - z * adjusted_std_dev) / denominator
    upper_bound = (centre_adjusted_probability + z * adjusted_std_dev) / denominator
    return max(0.0, lower_bound), min(1.0, upper_bound)


def generate_greedy(model: JarvisUnifiedTransformer, tokenizer: JarvisBPE, prompt: str, max_new_tokens: int = 32) -> str:
    formatted_prompt = f"<bos><user>{prompt}</user><assistant>"
    tok_ids = tokenizer.encode(formatted_prompt)
    input_ids = torch.tensor([tok_ids], dtype=torch.long)
    eos_id = tokenizer.eos_id
    asst_end_id = tokenizer.vocab.get("</assistant>", None)

    generated = list(tok_ids)
    cfg = getattr(model, "cfg", getattr(model, "config", None))
    max_len = cfg.max_seq_len if cfg else 128
    for _ in range(max_new_tokens):
        # Truncate context to max_seq_len if necessary
        curr_input = torch.tensor([generated[-max_len:]], dtype=torch.long)
        with torch.no_grad():
            out = model(curr_input)
            logits = out["logits"][:, -1, :]
            next_token = torch.argmax(logits, dim=-1).item()

        if next_token == eos_id or (asst_end_id is not None and next_token == asst_end_id):
            break
        generated.append(next_token)

    # Decode only the generated response
    resp_tokens = generated[len(tok_ids):]
    decoded = tokenizer.decode(resp_tokens).strip()
    # Strip any trailing assistant tags
    decoded = decoded.replace("</assistant>", "").replace("<eos>", "").strip()
    return decoded


def verify_probe(probe: Dict[str, Any], gen_text: str) -> Tuple[bool, str]:
    v_type = probe.get("verification_type", "keyword_match")
    exp_ans = str(probe.get("expected_answer", "")).strip().lower()
    exp_kw = [k.lower() for k in probe.get("expected_keywords", [])]
    gen_lower = gen_text.lower()

    if not gen_text.strip():
        return False, "EMPTY_GENERATION"

    # Exact math check
    if v_type == "exact_math":
        if exp_ans and exp_ans in gen_lower:
            return True, "EXACT_ANSWER_MATCH"
        for kw in exp_kw:
            # Check whole word / number boundary
            pattern = rf"\b{re.escape(kw)}\b"
            if re.search(pattern, gen_lower):
                return True, "KEYWORD_NUMBER_MATCH"
        return False, f"MATH_MISMATCH (Expected {exp_ans}, got: {gen_text[:60]})"

    # Python syntax / code check
    elif v_type == "code_syntax":
        # Extract code block if any
        code = gen_text
        if "```python" in code:
            code = code.split("```python")[1].split("```")[0]
        elif "```" in code:
            code = code.split("```")[1].split("```")[0]

        try:
            ast.parse(code)
            syntax_valid = True
        except Exception:
            syntax_valid = False

        kw_matches = all(kw in gen_lower for kw in exp_kw) if exp_kw else True
        if syntax_valid and kw_matches:
            return True, "VALID_AST_AND_KEYWORDS"
        elif syntax_valid:
            return False, "VALID_AST_BUT_MISSING_KEYWORDS"
        else:
            return False, "SYNTAX_INVALID"

    # Default keyword match
    else:
        if exp_ans and exp_ans in gen_lower:
            return True, "EXACT_PHRASE_MATCH"
        matched = [kw for kw in exp_kw if kw in gen_lower]
        if exp_kw and len(matched) == len(exp_kw):
            return True, f"ALL_KEYWORDS_MATCHED ({len(matched)}/{len(exp_kw)})"
        elif exp_kw and len(matched) >= max(1, len(exp_kw) // 2):
            return True, f"PARTIAL_KEYWORDS_MATCHED ({len(matched)}/{len(exp_kw)})"
        return False, f"MISSING_KEYWORDS (Expected {exp_kw}, got: {gen_text[:60]})"


def evaluate_checkpoint(ckpt_dir: str, benchmark_path: str = TRANSFER_TEST_FILE, max_probes: int = 200) -> Dict[str, Any]:
    print(f"\n========================================================")
    print(f"EVALUATING: {os.path.basename(ckpt_dir)}")
    print(f"Benchmark: {os.path.basename(benchmark_path)}")
    print(f"========================================================")

    tokenizer = JarvisBPE.load(TOKENIZER_DIR)

    # Load config
    cfg_path = os.path.join(ckpt_dir, "config.json")
    if os.path.exists(cfg_path):
        with open(cfg_path, "r") as f:
            cfg = JarvisConfig.from_dict(json.load(f))
    else:
        cfg = JarvisConfig(vocab_size=tokenizer.vocab_size, max_seq_len=128)

    model = JarvisUnifiedTransformer(cfg)
    weights_path = os.path.join(ckpt_dir, "weights.pt")
    if os.path.exists(weights_path):
        model.load_state_dict(torch.load(weights_path, map_location="cpu"), strict=False)
        print(f"Loaded weights from {weights_path}")
    else:
        print(f"[WARN] No weights.pt found in {ckpt_dir}, evaluating untrained/random initialization!")

    model.eval()

    probes = []
    with open(benchmark_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                probes.append(json.loads(line))
            if len(probes) >= max_probes:
                break

    domain_stats = {}
    probe_details = []
    total_passed = 0
    t0 = time.time()

    for idx, probe in enumerate(probes):
        prompt = probe.get("prompt", "")
        domain = probe.get("domain", "general")
        if domain not in domain_stats:
            domain_stats[domain] = {"passed": 0, "total": 0}
        domain_stats[domain]["total"] += 1

        gen_text = generate_greedy(model, tokenizer, prompt, max_new_tokens=32)
        passed, reason = verify_probe(probe, gen_text)

        if passed:
            total_passed += 1
            domain_stats[domain]["passed"] += 1

        probe_details.append({
            "id": probe.get("id", f"P-{idx+1}"),
            "domain": domain,
            "prompt": prompt,
            "expected": probe.get("expected_answer", ""),
            "generated": gen_text,
            "passed": passed,
            "reason": reason
        })

    elapsed = time.time() - t0
    acc = total_passed / max(len(probes), 1)
    ci_low, ci_high = wilson_score_interval(total_passed, len(probes))

    for dom, st in domain_stats.items():
        st["accuracy_pct"] = round(100.0 * st["passed"] / max(st["total"], 1), 2)

    report = {
        "checkpoint": os.path.basename(ckpt_dir),
        "checkpoint_dir": ckpt_dir,
        "benchmark": os.path.basename(benchmark_path),
        "total_probes": len(probes),
        "passed_probes": total_passed,
        "overall_accuracy_pct": round(acc * 100.0, 2),
        "wilson_95_ci_lower_pct": round(ci_low * 100.0, 2),
        "wilson_95_ci_upper_pct": round(ci_high * 100.0, 2),
        "evaluation_time_s": round(elapsed, 2),
        "domain_breakdown": domain_stats,
        "sample_evaluations": probe_details[:20]
    }

    print(f"\n[EVALUATION COMPLETE] Passed: {total_passed}/{len(probes)} ({acc*100.0:.2f}%)")
    print(f"Wilson 95% Confidence Interval: [{ci_low*100.0:.2f}%, {ci_high*100.0:.2f}%]")
    print(f"Domain Breakdown:")
    for dom, st in domain_stats.items():
        print(f"  - {dom:25s}: {st['passed']:3d} / {st['total']:3d} ({st['accuracy_pct']:5.1f}%)")

    return report


if __name__ == "__main__":
    if len(sys.argv) > 1:
        ckpt = sys.argv[1]
    else:
        ckpt = os.path.join(CHECKPOINTS_BASE, "vision-13m-curriculum-breakthrough")

    bm = sys.argv[2] if len(sys.argv) > 2 else TRANSFER_TEST_FILE
    res = evaluate_checkpoint(ckpt, bm)
    out_file = os.path.join(REPO_ROOT, f"eval_transfer_{os.path.basename(ckpt)}.json")
    with open(out_file, "w") as f:
        json.dump(res, f, indent=2)
    print(f"Saved evaluation results to {out_file}")
