"""
EVALUATOR RIGOR TEST SUITE (ml_foundation/test_evaluator_rigor.py)

Comprehensive positive and negative test battery verifying the rigorous evaluator:
1. Exact arithmetic matching (integers, negatives, decimals, fractions).
2. Rejection of answers mentioning the expected number in contradictory/unrelated context.
3. Contradictory statements (e.g. '10 = 2. The answer is 3.').
4. Multiple numbers and ambiguous outputs.
5. Code AST verification.
6. Categorical logic verification (Yes/No, Multiple Choice).
7. Empty and malformed strings.
"""

import os
import sys
import json
from typing import Dict, Any, List

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.rigorous_evaluator import rigorous_verify_probe

def run_evaluator_test_battery() -> Dict[str, Any]:
    test_cases = [
        # --- Group 1: The Specific Stage 2 Failure Cases (Must REJECT) ---
        {
            "name": "TRF-0001 Contradictory Hallucination (Must FAIL)",
            "probe": {"id": "TRF-0001", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "10 = 2.\nThe answer is 3.",
            "expected_pass": False,
            "category": "contradictory_arithmetic"
        },
        {
            "name": "TRF-0002 Contradictory Hallucination (Must FAIL)",
            "probe": {"id": "TRF-0002", "verification_type": "exact_math", "expected_answer": "12"},
            "generation": "12 = 3.\nThe answer is 10.",
            "expected_pass": False,
            "category": "contradictory_arithmetic"
        },
        {
            "name": "Correct number in question premise but wrong final answer (Must FAIL)",
            "probe": {"id": "MATH-001", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "We start with 10 items and remove 6. The answer is 4.",
            "expected_pass": False,
            "category": "incorrect_with_target_substring"
        },
        {
            "name": "Hallucinated equality equation (Must FAIL)",
            "probe": {"id": "MATH-002", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "10 = 25",
            "expected_pass": False,
            "category": "contradictory_arithmetic"
        },

        # --- Group 2: Valid Correct Answers (Must PASS) ---
        {
            "name": "Clean single number (Must PASS)",
            "probe": {"id": "MATH-003", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "10",
            "expected_pass": True,
            "category": "correct_answer"
        },
        {
            "name": "Explicit answer declaration (Must PASS)",
            "probe": {"id": "MATH-004", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "(7 + 10) - 7 = 17 - 7 = 10.\nThe answer is 10.",
            "expected_pass": True,
            "category": "correct_answer"
        },
        {
            "name": "Equals sign with number (Must PASS)",
            "probe": {"id": "MATH-005", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "= 10",
            "expected_pass": True,
            "category": "correct_answer"
        },

        # --- Group 3: Negative Values (Must PASS/FAIL appropriately) ---
        {
            "name": "Correct negative integer (Must PASS)",
            "probe": {"id": "MATH-006", "verification_type": "exact_math", "expected_answer": "-15"},
            "generation": "The answer is -15.",
            "expected_pass": True,
            "category": "negative_values"
        },
        {
            "name": "Wrong sign on negative number (Must FAIL)",
            "probe": {"id": "MATH-007", "verification_type": "exact_math", "expected_answer": "-15"},
            "generation": "The answer is 15.",
            "expected_pass": False,
            "category": "negative_values"
        },

        # --- Group 4: Decimal and Equivalent Expressions ---
        {
            "name": "Decimal equivalent matching (Must PASS)",
            "probe": {"id": "MATH-008", "verification_type": "exact_math", "expected_answer": "0.5"},
            "generation": "The answer is 0.50.",
            "expected_pass": True,
            "category": "decimal_values"
        },
        {
            "name": "Fraction equivalent to decimal (Must PASS)",
            "probe": {"id": "MATH-009", "verification_type": "exact_math", "expected_answer": "0.5"},
            "generation": "The answer is 1/2.",
            "expected_pass": True,
            "category": "equivalent_expressions"
        },
        {
            "name": "Integer equivalent to float (Must PASS)",
            "probe": {"id": "MATH-010", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "10.0",
            "expected_pass": True,
            "category": "equivalent_expressions"
        },

        # --- Group 5: Multiple and Ambiguous Numbers ---
        {
            "name": "Multiple numbers without answer declaration (Must FAIL)",
            "probe": {"id": "MATH-011", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "1.2 = 3, 10, 1, 15, 20",
            "expected_pass": False,
            "category": "multiple_numerical_values"
        },

        # --- Group 6: Empty and Malformed Outputs ---
        {
            "name": "Empty string (Must FAIL)",
            "probe": {"id": "MAL-001", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "",
            "expected_pass": False,
            "category": "empty_and_malformed"
        },
        {
            "name": "Whitespace only (Must FAIL)",
            "probe": {"id": "MAL-002", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "   \n\t  ",
            "expected_pass": False,
            "category": "empty_and_malformed"
        },
        {
            "name": "Random punctuation (Must FAIL)",
            "probe": {"id": "MAL-003", "verification_type": "exact_math", "expected_answer": "10"},
            "generation": "### .... ;;; -- ??",
            "expected_pass": False,
            "category": "empty_and_malformed"
        },

        # --- Group 7: Code AST Verification ---
        {
            "name": "Valid Python AST function (Must PASS)",
            "probe": {
                "id": "CODE-001",
                "verification_type": "code_syntax",
                "expected_answer": "def add(a, b):",
                "expected_keywords": ["add", "return"]
            },
            "generation": "```python\ndef add(a, b):\n    return a + b\n```",
            "expected_pass": True,
            "category": "code_ast"
        },
        {
            "name": "Invalid Python syntax (Must FAIL)",
            "probe": {
                "id": "CODE-002",
                "verification_type": "code_syntax",
                "expected_answer": "def add(a, b):",
                "expected_keywords": ["add", "return"]
            },
            "generation": "def add(a, b) return a + b", # missing colon
            "expected_pass": False,
            "category": "code_ast"
        },
        {
            "name": "Python function missing return (Must FAIL)",
            "probe": {
                "id": "CODE-003",
                "verification_type": "code_syntax",
                "expected_answer": "def add(a, b):",
                "expected_keywords": ["add"]
            },
            "generation": "def add(a, b):\n    pass",
            "expected_pass": False,
            "category": "code_ast"
        },

        # --- Group 8: Categorical Logic (Yes / No) ---
        {
            "name": "Direct affirmative logic (Must PASS)",
            "probe": {"id": "LOGIC-001", "verification_type": "categorical", "expected_answer": "Yes"},
            "generation": "Premise holds. Therefore, Yes.",
            "expected_pass": True,
            "category": "categorical_logic"
        },
        {
            "name": "Contradictory Yes and No (Must FAIL)",
            "probe": {"id": "LOGIC-002", "verification_type": "categorical", "expected_answer": "Yes"},
            "generation": "Yes, but actually no.",
            "expected_pass": False,
            "category": "categorical_logic"
        },
        {
            "name": "Substring false positive 'yesterday' (Must FAIL)",
            "probe": {"id": "LOGIC-003", "verification_type": "categorical", "expected_answer": "Yes"},
            "generation": "The event happened yesterday.",
            "expected_pass": False,
            "category": "categorical_logic"
        }
    ]

    results = []
    all_passed_expectations = True

    for tc in test_cases:
        passed, reason, extracted = rigorous_verify_probe(tc["probe"], tc["generation"])
        test_success = (passed == tc["expected_pass"])
        if not test_success:
            all_passed_expectations = False

        results.append({
            "test_name": tc["name"],
            "category": tc["category"],
            "expected_answer": tc["probe"].get("expected_answer"),
            "generation": tc["generation"],
            "evaluator_verdict": passed,
            "evaluator_reason": reason,
            "extracted_answer": extracted,
            "expected_evaluator_verdict": tc["expected_pass"],
            "test_status": "PASS" if test_success else "FAIL"
        })

    summary = {
        "total_tests": len(test_cases),
        "passed_tests": sum(1 for r in results if r["test_status"] == "PASS"),
        "failed_tests": sum(1 for r in results if r["test_status"] == "FAIL"),
        "all_expectations_met": all_passed_expectations,
        "results": results
    }

    out_file = os.path.join(REPO_ROOT, "VISION_STAGE2_EVALUATOR_TESTS.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("========================================================")
    print("EVALUATOR RIGOR TEST BATTERY COMPLETE")
    print(f"Results: {summary['passed_tests']}/{summary['total_tests']} tests passed ({summary['passed_tests']/summary['total_tests']*100:.1f}%)")
    print(f"All expectations met: {all_passed_expectations}")
    print(f"Output saved to: {out_file}")
    print("========================================================")

    for r in results:
        status_sym = "[OK]" if r["test_status"] == "PASS" else "[FAIL!]"
        print(f"{status_sym} {r['test_name']:55s} -> Verdict: {r['evaluator_verdict']} (Exp: {r['expected_evaluator_verdict']}) | Extracted: {repr(r['extracted_answer'])}")

    return summary

if __name__ == "__main__":
    run_evaluator_test_battery()
