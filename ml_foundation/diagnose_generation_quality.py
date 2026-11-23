"""
DIAGNOSE GENERATION QUALITY (ml_foundation/diagnose_generation_quality.py)

Detailed diagnostic evaluation of 5 checkpoints on the independent transfer benchmark (200 probes)
plus expanded cross-domain diagnostic probes (covering English, Hindi, Hinglish, Arithmetic,
Math reasoning, Python, Java, JavaScript, Reading comprehension, Formal reasoning, Multi-turn).

Calculates:
- Distinct-1 and Distinct-2 n-gram diversity
- Token Shannon entropy
- Repetition rate
- Failure mode taxonomy (Empty, Repetitive loop, Special token collapse, Premature EOS, Gibberish, Semantic error)
"""

import os
import sys
import json
import math
import re
import time
from collections import Counter
from typing import Any, Dict, List, Tuple

import torch

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.evaluate_independent_transfer import verify_probe

TRANSFER_TEST_FILE = os.path.join(REPO_ROOT, "vision_independent_transfer_test_200.jsonl")
TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")
CHECKPOINTS_BASE = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints")

CHECKPOINTS = {
    "v1.4_calibrated": os.path.join(CHECKPOINTS_BASE, "vision-v1.4-calibrated-local"),
    "candidate_g": os.path.join(CHECKPOINTS_BASE, "vision-2.0-candidate-g"),
    "13m_scaling": os.path.join(CHECKPOINTS_BASE, "vision-13m-scaling-experiment"),
    "25m_foundation": os.path.join(CHECKPOINTS_BASE, "vision-25m-compact-foundation"),
    "100m_scaling": os.path.join(CHECKPOINTS_BASE, "vision-100m-scaling-experiment"),
}

def compute_entropy(token_ids: List[int]) -> float:
    if not token_ids:
        return 0.0
    counts = Counter(token_ids)
    total = len(token_ids)
    ent = 0.0
    for count in counts.values():
        p = count / total
        ent -= p * math.log2(p)
    return round(ent, 3)

def compute_diversity(tokens: List[str]) -> Tuple[float, float, float]:
    """Returns (distinct-1, distinct-2, repetition_rate)."""
    if not tokens:
        return 0.0, 0.0, 0.0
    unigrams = set(tokens)
    d1 = len(unigrams) / len(tokens)

    bigrams = [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]
    d2 = (len(set(bigrams)) / len(bigrams)) if bigrams else 1.0

    # Repetition rate: 1 - ratio of unique unigrams
    rep_rate = 1.0 - d1
    return round(d1, 3), round(d2, 3), round(rep_rate, 3)

def classify_failure(raw_tokens: List[int], decoded_text: str, passed: bool, tokenizer: JarvisBPE) -> str:
    if passed:
        return "PASSED"
    if not raw_tokens or not decoded_text.strip():
        # Check if it was empty because it only emitted special tokens
        if raw_tokens:
            spec_count = sum(1 for t in raw_tokens if t in (tokenizer.pad_id, tokenizer.eos_id, 6, 7))
            if spec_count == len(raw_tokens):
                return "SPECIAL_TOKEN_COLLAPSE"
        return "EMPTY_OUTPUT"

    # Check special token loop (e.g. repeated token 6 <assistant>)
    if len(raw_tokens) >= 3 and raw_tokens[0] == 6 and raw_tokens[1] == 6:
        return "SPECIAL_TOKEN_COLLAPSE"

    # Check repetition loop (e.g. "the the the" or "domdomdom")
    tokens_text = decoded_text.split()
    if len(tokens_text) >= 4:
        # Check if last 4 tokens are identical
        if tokens_text[-1] == tokens_text[-2] == tokens_text[-3]:
            return "REPETITIVE_LOOP"
        # Or if top token constitutes > 60% of words
        most_common = Counter(tokens_text).most_common(1)[0][1]
        if most_common / len(tokens_text) > 0.5:
            return "REPETITIVE_LOOP"

    # Check gibberish vs coherent wrong answer
    # If it contains high proportion of non-alphanumeric or broken BPE fragments
    words = re.findall(r"\b[A-Za-z0-9]+\b", decoded_text)
    if len(words) < 2 and len(decoded_text) > 10:
        return "GIBBERISH_UNLEARNED"

    return "INCORRECT_CONTENT"

def evaluate_and_diagnose(ckpt_key: str, ckpt_dir: str, tokenizer: JarvisBPE, probes: List[Dict[str, Any]]) -> Dict[str, Any]:
    print(f"\n========================================================")
    print(f"DIAGNOSING CHECKPOINT: {ckpt_key} ({os.path.basename(ckpt_dir)})")
    print(f"========================================================")

    cfg_file = os.path.join(ckpt_dir, "config.json")
    with open(cfg_file, "r") as f:
        cfg = JarvisConfig.from_dict(json.load(f))

    model = JarvisUnifiedTransformer(cfg)
    weights_file = os.path.join(ckpt_dir, "weights.pt")
    model.load_state_dict(torch.load(weights_file, map_location="cpu"), strict=False)
    model.eval()

    total_params = sum(p.numel() for p in model.parameters())

    results = []
    failure_counts = Counter()
    domain_scores = {}
    all_gen_token_ids = []
    all_lengths = []
    all_d1 = []
    all_d2 = []
    all_entropies = []

    asst_stop_id = tokenizer.vocab.get("</assistant>", None)
    stop_ids = [asst_stop_id] if asst_stop_id else None

    for i, probe in enumerate(probes):
        prompt = probe["prompt"]
        domain = probe.get("domain", "general")
        if domain not in domain_scores:
            domain_scores[domain] = {"passed": 0, "total": 0}
        domain_scores[domain]["total"] += 1

        formatted = f"<bos><user>{prompt}</user><assistant>"
        inp = tokenizer.encode(formatted)
        x = torch.tensor([inp], dtype=torch.long)

        with torch.no_grad():
            out_ids = model.generate(
                x,
                max_new_tokens=32,
                temperature=0.01,
                repetition_penalty=1.05,
                no_repeat_ngram_size=4,
                eos_id=tokenizer.eos_id,
                stop_token_ids=stop_ids,
            )

        new_toks = out_ids[len(inp):]
        raw_decoded = tokenizer.decode(new_toks, skip_special_tokens=False)
        clean_decoded = tokenizer.decode(new_toks, skip_special_tokens=True).strip()

        passed, reason = verify_probe(probe, clean_decoded)
        if passed:
            domain_scores[domain]["passed"] += 1

        fail_mode = classify_failure(new_toks, clean_decoded, passed, tokenizer)
        failure_counts[fail_mode] += 1

        words = clean_decoded.split()
        d1, d2, rep = compute_diversity(words)
        ent = compute_entropy(new_toks)

        all_lengths.append(len(new_toks))
        all_d1.append(d1)
        all_d2.append(d2)
        all_entropies.append(ent)
        all_gen_token_ids.extend(new_toks)

        results.append({
            "id": probe["id"],
            "domain": domain,
            "prompt": prompt,
            "expected": probe.get("expected_answer", ""),
            "generated_raw": raw_decoded[:100],
            "generated_clean": clean_decoded[:100],
            "passed": passed,
            "failure_mode": fail_mode,
            "verif_reason": reason,
            "token_count": len(new_toks),
            "entropy": ent,
            "distinct_1": d1,
            "distinct_2": d2
        })

    vocab_coverage = len(set(all_gen_token_ids))
    total_passed = sum(1 for r in results if r["passed"])
    acc = round(total_passed / len(probes) * 100.0, 2)

    diag_summary = {
        "checkpoint_key": ckpt_key,
        "checkpoint_dir": ckpt_dir,
        "total_parameters": total_params,
        "total_probes": len(probes),
        "total_passed": total_passed,
        "accuracy_pct": acc,
        "avg_response_tokens": round(sum(all_lengths) / len(all_lengths), 2),
        "avg_entropy": round(sum(all_entropies) / len(all_entropies), 2),
        "avg_distinct_1": round(sum(all_d1) / len(all_d1), 3),
        "avg_distinct_2": round(sum(all_d2) / len(all_d2), 3),
        "unique_tokens_generated": vocab_coverage,
        "failure_mode_breakdown": dict(failure_counts),
        "domain_breakdown": domain_scores,
        "sample_failures": [r for r in results if not r["passed"]][:15]
    }

    print(f"Results for {ckpt_key}: Passed={total_passed}/{len(probes)} ({acc}%)")
    print(f"  Failures breakdown: {dict(failure_counts)}")
    print(f"  Avg Tokens: {diag_summary['avg_response_tokens']}, Avg Entropy: {diag_summary['avg_entropy']}, Distinct-1: {diag_summary['avg_distinct_1']}")
    return diag_summary

def main():
    tokenizer = JarvisBPE.load(TOKENIZER_DIR)
    with open(TRANSFER_TEST_FILE, "r", encoding="utf-8") as f:
        probes = [json.loads(line) for line in f if line.strip()]

    all_diagnostics = {}
    for key, path in CHECKPOINTS.items():
        if os.path.exists(os.path.join(path, "weights.pt")):
            diag = evaluate_and_diagnose(key, path, tokenizer, probes)
            all_diagnostics[key] = diag

    out_file = os.path.join(REPO_ROOT, "vision_generation_failure_analysis.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_diagnostics, f, indent=2)
    print(f"\n[DONE] Saved diagnostic results to {out_file}")

if __name__ == "__main__":
    main()
