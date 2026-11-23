"""
11-DISCIPLINE CAPABILITY DIAGNOSTIC HARNESS (ml_foundation/diagnose_11_capabilities.py)

Evaluates VISION foundation models across 11 distinct cognitive capabilities:
1. Basic Arithmetic
2. Unseen Mathematics
3. Python Function Generation
4. Java Programming
5. JavaScript Programming
6. English Comprehension
7. Hindi (Devanagari)
8. Hinglish Dialogue
9. Formal Deductive Reasoning
10. Strict Instruction Following
11. Context Retention
"""

import os
import sys
import json
import time
from typing import Dict, Any, List

import torch

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.rigorous_evaluator import rigorous_verify_probe

TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")
SFT_CKPT = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-13m-sft-aligned")
PRETRAIN_CKPT = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-pretraining-validation-13m")

PROBES = [
    # 1. Basic Arithmetic
    {
        "id": "DIAG-01-ARITH",
        "discipline": "basic_arithmetic",
        "prompt": "What is 15 + 27?",
        "expected_answer": "42",
        "verification_type": "exact_math"
    },
    {
        "id": "DIAG-02-ARITH",
        "discipline": "basic_arithmetic",
        "prompt": "Compute 50 - 18.",
        "expected_answer": "32",
        "verification_type": "exact_math"
    },
    # 2. Unseen Mathematics
    {
        "id": "DIAG-03-MATH",
        "discipline": "unseen_mathematics",
        "prompt": "If a rectangle has length 8 and width 6, compute its area.",
        "expected_answer": "48",
        "verification_type": "exact_math"
    },
    {
        "id": "DIAG-04-MATH",
        "discipline": "unseen_mathematics",
        "prompt": "Solve for x: x + 9 = 20.",
        "expected_answer": "11",
        "verification_type": "exact_math"
    },
    # 3. Python Function Generation
    {
        "id": "DIAG-05-PY",
        "discipline": "python_programming",
        "prompt": "Write a Python function is_even(n) that returns True if n is even, else False.",
        "expected_answer": "def is_even(n):\n    return n % 2 == 0",
        "expected_keywords": ["def", "is_even", "return"],
        "verification_type": "code_syntax"
    },
    # 4. Java Programming
    {
        "id": "DIAG-06-JAVA",
        "discipline": "java_programming",
        "prompt": "Write a Java method public static int max(int a, int b) that returns the larger number.",
        "expected_answer": "public static int max(int a, int b) { return (a > b) ? a : b; }",
        "expected_keywords": ["public", "static", "int", "max", "return"],
        "verification_type": "keyword_match"
    },
    # 5. JavaScript Programming
    {
        "id": "DIAG-07-JS",
        "discipline": "javascript_programming",
        "prompt": "Write a JavaScript function greet(name) that returns 'Hello, ' + name.",
        "expected_answer": "function greet(name) { return 'Hello, ' + name; }",
        "expected_keywords": ["function", "greet", "return"],
        "verification_type": "keyword_match"
    },
    # 6. English Comprehension
    {
        "id": "DIAG-08-EN",
        "discipline": "english_comprehension",
        "prompt": "Passage: The sun rises in the east and sets in the west.\nQuestion: Where does the sun set?",
        "expected_answer": "west",
        "expected_keywords": ["west"],
        "verification_type": "keyword_match"
    },
    # 7. Hindi (Devanagari)
    {
        "id": "DIAG-09-HIN",
        "discipline": "hindi_comprehension",
        "prompt": "'जल ही जीवन है' का अंग्रेजी में अनुवाद क्या है?",
        "expected_answer": "Water is life",
        "expected_keywords": ["water", "life"],
        "verification_type": "keyword_match"
    },
    # 8. Hinglish Dialogue
    {
        "id": "DIAG-10-HING",
        "discipline": "hinglish_dialogue",
        "prompt": "Kya model production ke liye ready hai?",
        "expected_answer": "Jab tak benchmark pass threshold achieve na ho, model ko experimental rakha jayega.",
        "expected_keywords": ["model", "experimental"],
        "verification_type": "keyword_match"
    },
    # 9. Formal Reasoning
    {
        "id": "DIAG-11-LOGIC",
        "discipline": "formal_reasoning",
        "prompt": "Premise 1: All humans are mortal.\nPremise 2: Socrates is human.\nConclusion: Is Socrates mortal? (Answer Yes or No)",
        "expected_answer": "Yes",
        "verification_type": "categorical"
    },
    # 10. Instruction Following
    {
        "id": "DIAG-12-INST",
        "discipline": "instruction_following",
        "prompt": "Output only the uppercase word 'STARK' and nothing else.",
        "expected_answer": "STARK",
        "verification_type": "exact_match"
    },
    # 11. Context Retention
    {
        "id": "DIAG-13-CTX",
        "discipline": "context_retention",
        "prompt": "Remember this passkey: BLUE-42. What is the passkey?",
        "expected_answer": "BLUE-42",
        "expected_keywords": ["BLUE-42"],
        "verification_type": "keyword_match"
    }
]

def run_diagnostics():
    print("========================================================")
    print("RUNNING 11-DISCIPLINE CAPABILITY DIAGNOSTIC")
    print("========================================================")

    tokenizer = JarvisBPE.load(TOKENIZER_DIR)
    with open(os.path.join(SFT_CKPT, "config.json")) as f:
        cfg = JarvisConfig.from_dict(json.load(f))
    cfg.max_seq_len = 256

    model = JarvisUnifiedTransformer(cfg)
    model.load_state_dict(torch.load(os.path.join(SFT_CKPT, "weights.pt"), map_location="cpu"))
    model.eval()

    results = []
    discipline_summary = {}

    for p in PROBES:
        disc = p["discipline"]
        if disc not in discipline_summary:
            discipline_summary[disc] = {"total": 0, "passed": 0, "failure_modes": []}
        discipline_summary[disc]["total"] += 1

        prompt = f"<bos><user>{p['prompt']}</user><assistant>"
        inp = tokenizer.encode(prompt)
        x = torch.tensor([inp], dtype=torch.long)

        # Uncalibrated greedy
        with torch.no_grad():
            out_ids_uncal = model.generate(x, max_new_tokens=48, temperature=0.0, repetition_penalty=1.0)
        gen_uncal = tokenizer.decode(out_ids_uncal[len(inp):], skip_special_tokens=True).strip()
        passed_uncal, reason_uncal, ext_uncal = rigorous_verify_probe(p, gen_uncal)

        # Calibrated
        with torch.no_grad():
            out_ids_cal = model.generate(x, max_new_tokens=48, temperature=0.01, repetition_penalty=1.15, no_repeat_ngram_size=4)
        gen_cal = tokenizer.decode(out_ids_cal[len(inp):], skip_special_tokens=True).strip()
        passed_cal, reason_cal, ext_cal = rigorous_verify_probe(p, gen_cal)

        # Classify primary failure mode
        failure_mode = "NONE (PASSED)"
        if not (passed_uncal or passed_cal):
            if not gen_uncal.strip():
                failure_mode = "EMPTY_OUTPUT"
            elif len(set(gen_uncal.split())) < 3:
                failure_mode = "UNIGRAM_REPETITION_TRAP"
            elif disc in ("basic_arithmetic", "unseen_mathematics") and ext_uncal is not None:
                failure_mode = "INCORRECT_CALCULATION"
            elif disc in ("python_programming", "java_programming", "javascript_programming"):
                failure_mode = "CODE_SYNTAX_OR_STRUCTURE_FAILURE"
            elif disc in ("formal_reasoning",):
                failure_mode = "LOGICAL_DEDUCTION_FAILURE"
            elif disc in ("hindi_comprehension", "hinglish_dialogue"):
                failure_mode = "MULTILINGUAL_TOKENIZATION_DISTORTION"
            elif disc in ("instruction_following", "context_retention"):
                failure_mode = "INSTRUCTION_FORMAT_NONCOMPLIANCE"
            else:
                failure_mode = "LANGUAGE_MODELING_UNDERFIT"

            discipline_summary[disc]["failure_modes"].append(failure_mode)
        else:
            discipline_summary[disc]["passed"] += 1

        results.append({
            "probe_id": p["id"],
            "discipline": disc,
            "prompt": p["prompt"],
            "expected": p["expected_answer"],
            "uncalibrated_output": gen_uncal,
            "uncalibrated_passed": passed_uncal,
            "uncalibrated_reason": reason_uncal,
            "calibrated_output": gen_cal,
            "calibrated_passed": passed_cal,
            "calibrated_reason": reason_cal,
            "primary_failure_mode": failure_mode
        })

        print(f"[{p['id']}] {disc:25s} | Passed: Uncal={passed_uncal}, Cal={passed_cal} | Mode: {failure_mode}")
        print(f"   Prompt: {repr(p['prompt'][:45])}")
        print(f"   Gen (Uncal): {repr(gen_uncal[:55])}")
        print(f"   Gen (Cal):   {repr(gen_cal[:55])}")

    out_file = os.path.join(REPO_ROOT, "VISION_STAGE3_CAPABILITY_DIAGNOSIS.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({
            "model_evaluated": "vision-13m-sft-aligned",
            "evaluator": "ml_foundation/rigorous_evaluator.py",
            "discipline_summary": discipline_summary,
            "probes": results
        }, f, indent=2)

    print("\n========================================================")
    print("CAPABILITY DIAGNOSTIC COMPLETE")
    print(f"Output saved to: {out_file}")
    print("========================================================")

if __name__ == "__main__":
    run_diagnostics()
