"""
VISION Verifiable Reward Engine & Group Relative Advantage (GRPO) System
ml_foundation/verifiable_reward_engine.py

Implements:
1. Verifiable Mathematical Reward Functions (numeric equality, fractional equivalence, algebraic invariance)
2. Sandboxed Python Code Reward Functions (AST syntax parsing, isolated execution, unit-test verification)
3. Structured JSON Schema Reward Functions (valid JSON parsing, key existence, type verification)
4. Instruction Constraint Reward Functions (length limits, negative constraints, format adherence)
5. Group Relative Advantage Estimation (GRPO):
   A_i = (R_i - mean(R)) / (std(R) + epsilon)
6. Reward Hacking & Verbosity Bias Detector (tracks response inflation and degenerate repetitions)
"""

from __future__ import annotations

import ast
import datetime
import json
import math
import os
import re
import subprocess
import sys
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


class VerifiableRewardEngine:
    """Multi-domain verifiable outcome-based reward engine."""

    # -------------------------------------------------------------
    # 1. Mathematical Outcome Verification
    # -------------------------------------------------------------
    @staticmethod
    def verify_mathematics(completion: str, expected_answer: Any, tolerance: float = 1e-4) -> Dict[str, Any]:
        """Extracts numerical answer from completion and verifies mathematical correctness."""
        text = completion.strip()

        # Search for boxed answers, final lines, or "x = <num>", "= <num>"
        patterns = [
            r"\\boxed\{([^}]+)\}",
            r"(?:x\s*=\s*|answer\s*is\s*|is\s*equal\s*to\s*|result\s*:\s*)([-+]?\d+(?:\.\d+)?(?:/\d+)?)",
            r"[-+]?\d+(?:\.\d+)?(?:/\d+)?(?=[^\d/]*$)"  # Last number in text
        ]

        extracted = None
        for pat in patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                extracted = match.group(1) if match.groups() else match.group(0)
                break

        if not extracted:
            return {"verified": False, "reward": 0.0, "reason": "No numeric answer found in completion"}

        try:
            if "/" in extracted:
                num, denom = extracted.split("/")
                val = float(num) / float(denom)
            else:
                val = float(extracted)

            exp_val = float(expected_answer)
            is_correct = abs(val - exp_val) <= tolerance

            return {
                "verified": is_correct,
                "reward": 1.0 if is_correct else 0.0,
                "extracted_value": val,
                "expected_value": exp_val,
                "error": abs(val - exp_val)
            }
        except Exception as e:
            return {"verified": False, "reward": 0.0, "reason": f"Parsing error: {e}"}

    # -------------------------------------------------------------
    # 2. Sandboxed Python Code Verification
    # -------------------------------------------------------------
    @staticmethod
    def verify_python_code(
        completion: str,
        test_assertions: List[str],
        timeout_sec: float = 2.0
    ) -> Dict[str, Any]:
        """Parses AST and executes generated code in isolated subprocess with unit assertions."""
        # Extract code block if markdown formatted
        code_match = re.search(r"```python\s*(.*?)\s*```", completion, re.DOTALL)
        code = code_match.group(1) if code_match else completion

        # 1. Static AST parsing test
        try:
            ast.parse(code)
            ast_valid = True
        except SyntaxError as e:
            return {
                "verified": False,
                "reward": 0.0,
                "ast_valid": False,
                "reason": f"SyntaxError: {e.msg} at line {e.lineno}"
            }

        # 2. Security check against hazardous imports in generated snippet
        forbidden = ["os.system", "subprocess", "shutil.rmtree", "__import__('os')", "socket", "ctypes"]
        for bad in forbidden:
            if bad in code:
                return {
                    "verified": False,
                    "reward": -1.0,
                    "ast_valid": True,
                    "reason": f"Security violation: forbidden token '{bad}' detected"
                }

        # 3. Assemble execution harness with test assertions
        harness = code + "\n\n# --- AUTOMATED TEST HARNESS ---\n"
        for assertion in test_assertions:
            harness += f"assert {assertion}\n"

        # 4. Execute in isolated subprocess
        try:
            proc = subprocess.run(
                [sys.executable, "-c", harness],
                capture_output=True,
                text=True,
                timeout=timeout_sec
            )
            passed = (proc.returncode == 0)
            return {
                "verified": passed,
                "reward": 1.0 if passed else 0.0,
                "ast_valid": True,
                "exit_code": proc.returncode,
                "stdout": proc.stdout.strip(),
                "stderr": proc.stderr.strip()[:200] if not passed else ""
            }
        except subprocess.TimeoutExpired:
            return {
                "verified": False,
                "reward": 0.0,
                "ast_valid": True,
                "reason": f"Execution timed out (> {timeout_sec}s)"
            }
        except Exception as e:
            return {
                "verified": False,
                "reward": 0.0,
                "ast_valid": True,
                "reason": f"Execution error: {e}"
            }

    # -------------------------------------------------------------
    # 3. Structured JSON Schema Verification
    # -------------------------------------------------------------
    @staticmethod
    def verify_json_schema(
        completion: str,
        required_keys: List[str],
        type_constraints: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Verifies JSON validity, required keys, and data types."""
        # Extract JSON block if enclosed in ```json ... ```
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", completion, re.DOTALL)
        raw_json = json_match.group(1) if json_match else completion.strip()

        # Also search for bare JSON object {...}
        if not raw_json.startswith("{"):
            obj_match = re.search(r"\{.*\}", raw_json, re.DOTALL)
            if obj_match:
                raw_json = obj_match.group(0)

        try:
            data = json.loads(raw_json)
            if not isinstance(data, dict):
                return {"verified": False, "reward": 0.0, "reason": "Root JSON is not an object"}
        except Exception as e:
            return {"verified": False, "reward": 0.0, "reason": f"Malformed JSON: {e}"}

        # Check required keys
        missing = [k for k in required_keys if k not in data]
        if missing:
            return {
                "verified": False,
                "reward": 0.25,  # Partial reward for valid JSON syntax
                "missing_keys": missing,
                "reason": f"Missing required keys: {missing}"
            }

        # Check types if specified
        if type_constraints:
            for key, exp_type in type_constraints.items():
                val = data.get(key)
                if exp_type == "int" and not isinstance(val, int):
                    return {"verified": False, "reward": 0.5, "reason": f"Key '{key}' expected int, got {type(val)}"}
                elif exp_type == "str" and not isinstance(val, str):
                    return {"verified": False, "reward": 0.5, "reason": f"Key '{key}' expected str, got {type(val)}"}
                elif exp_type == "list" and not isinstance(val, list):
                    return {"verified": False, "reward": 0.5, "reason": f"Key '{key}' expected list, got {type(val)}"}

        return {"verified": True, "reward": 1.0, "parsed_data": data}

    # -------------------------------------------------------------
    # 4. Instruction Constraint Verification
    # -------------------------------------------------------------
    @staticmethod
    def verify_instruction_constraints(
        completion: str,
        forbidden_words: Optional[List[str]] = None,
        max_sentences: Optional[int] = None,
        max_words: Optional[int] = None
    ) -> Dict[str, Any]:
        """Verifies negative constraints and structural formatting rules."""
        text = completion.strip()
        violations: List[str] = []

        # Check forbidden words (negative constraint)
        if forbidden_words:
            for word in forbidden_words:
                if re.search(r"\b" + re.escape(word) + r"\b", text, re.IGNORECASE):
                    violations.append(f"Contains forbidden word: '{word}'")

        # Check max sentences
        if max_sentences is not None:
            sents = [s for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
            if len(sents) > max_sentences:
                violations.append(f"Sentence count ({len(sents)}) exceeds maximum ({max_sentences})")

        # Check max words
        if max_words is not None:
            words = text.split()
            if len(words) > max_words:
                violations.append(f"Word count ({len(words)}) exceeds maximum ({max_words})")

        passed = (len(violations) == 0)
        return {
            "verified": passed,
            "reward": 1.0 if passed else 0.0,
            "violations": violations
        }

    # -------------------------------------------------------------
    # 5. Group Relative Advantage Estimation (GRPO)
    # -------------------------------------------------------------
    @staticmethod
    def compute_group_relative_advantages(
        rewards: List[float],
        epsilon: float = 1e-6
    ) -> List[float]:
        """
        Computes normalized advantage estimates across a group of K candidate completions:
        A_i = (R_i - mean(R)) / (std(R) + epsilon)
        """
        if not rewards:
            return []
        if len(rewards) == 1:
            return [0.0]

        mean_r = sum(rewards) / len(rewards)
        variance = sum((r - mean_r) ** 2 for r in rewards) / len(rewards)
        std_r = math.sqrt(variance)

        advantages = [round((r - mean_r) / (std_r + epsilon), 4) for r in rewards]
        return advantages

    # -------------------------------------------------------------
    # 6. Reward Hacking & Verbosity Bias Detector
    # -------------------------------------------------------------
    @staticmethod
    def detect_reward_hacking(completions: List[str], rewards: List[float]) -> Dict[str, Any]:
        """Detects length inflation / verbosity hacking and repetitive degradation."""
        lengths = [len(c.split()) for c in completions]
        mean_len = sum(lengths) / max(1, len(lengths))

        # Check correlation between length and reward
        has_verbosity_bias = False
        if len(completions) >= 3:
            # Check if highest reward strictly corresponds to 3x longer length
            max_idx = rewards.index(max(rewards))
            if lengths[max_idx] > mean_len * 2.5:
                has_verbosity_bias = True

        # Check repetitive loop degradation (e.g. repeated 3-grams)
        repetitive_flags = []
        for c in completions:
            words = c.lower().split()
            if len(words) > 10:
                trigrams = [tuple(words[i:i + 3]) for i in range(len(words) - 2)]
                ratio = len(set(trigrams)) / max(1, len(trigrams))
                repetitive_flags.append(ratio < 0.60)
            else:
                repetitive_flags.append(False)

        return {
            "mean_word_length": round(mean_len, 1),
            "verbosity_bias_detected": has_verbosity_bias,
            "repetitive_collapse_detected": any(repetitive_flags)
        }


def run_verifiable_rewards_benchmark() -> Dict[str, Any]:
    """Evaluates verifiable reward engines across benchmark test cases."""
    engine = VerifiableRewardEngine()

    print("=" * 80)
    print("VISION VERIFIABLE REWARD & GRPO ADVANTAGE BENCHMARK")
    print("=" * 80)

    # 1. Math Verifier Tests
    math_tests = [
        ("The final answer is \\boxed{42}.", 42, True),
        ("Solving 3x - 7 = 14 gives x = 7.", 7, True),
        ("The area is 78.54 cm^2.", 78.54, True),
        ("The answer is 15.", 20, False)
    ]
    math_res = [engine.verify_mathematics(c, exp)["verified"] == exp_pass for c, exp, exp_pass in math_tests]
    math_pass_rate = sum(math_res) / len(math_res)
    print(f"Mathematical Reward Verifier: {math_pass_rate * 100:.1f}% accurate")

    # 2. Python Code Verifier Tests
    code_tests = [
        ("def add(a, b):\n    return a + b", ["add(2, 3) == 5", "add(-1, 1) == 0"], True),
        ("def is_even(n):\n    return n % 2 == 0", ["is_even(4) == True", "is_even(7) == False"], True),
        ("def broken(n):\n    return n * 0", ["broken(5) == 5"], False),
        ("def syntax_err(\n    return 1", ["True"], False)
    ]
    code_res = [engine.verify_python_code(c, t)["verified"] == exp_pass for c, t, exp_pass in code_tests]
    code_pass_rate = sum(code_res) / len(code_res)
    print(f"Sandboxed Code Reward Verifier: {code_pass_rate * 100:.1f}% accurate")

    # 3. JSON Schema Verifier Tests
    json_tests = [
        ('{"tool": "read_file", "arguments": {"path": "test.txt"}}', ["tool", "arguments"], True),
        ('{"tool": "execute"}', ["tool", "arguments"], False),
        ('Invalid non-json string', ["tool"], False)
    ]
    json_res = [engine.verify_json_schema(c, k)["verified"] == exp_pass for c, k, exp_pass in json_tests]
    json_pass_rate = sum(json_res) / len(json_res)
    print(f"JSON Schema Reward Verifier: {json_pass_rate * 100:.1f}% accurate")

    # 4. GRPO Group Relative Advantages
    candidate_rewards = [1.0, 0.0, 1.0, 0.5]
    advantages = engine.compute_group_relative_advantages(candidate_rewards)
    print(f"GRPO Advantages for {candidate_rewards}: {advantages}")
    assert advantages[0] > 0, "Top reward must have positive advantage"
    assert advantages[1] < 0, "Lowest reward must have negative advantage"

    summary = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "mathematical_verifier_accuracy": math_pass_rate,
        "code_sandbox_verifier_accuracy": code_pass_rate,
        "json_schema_verifier_accuracy": json_pass_rate,
        "grpo_advantage_estimation_verified": True,
        "test_advantages": advantages
    }

    out_file = os.path.join(REPO_ROOT, "data", "learning", "verifiable_rewards_report.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Report saved to: {out_file}")
    return summary


if __name__ == "__main__":
    run_verifiable_rewards_benchmark()
