"""
VISION AI — Bounded Self-Correction & Empirical Verification Engine
ml_foundation/bounded_self_correction.py

Part VIII: Tool Intelligence & Autonomous Execution (§35 - Self-Correction)

Core Principles:
1. Controlled iterative verification:
   - Step 1: Produce an answer, code snippet, or tool-call JSON.
   - Step 2: Validate using independent empirical checks (tests, calculations, schemas).
   - Step 3: Detect precise errors from test feedback.
   - Step 4: Retry or revise within strictly bounded limits (max_attempts = 3).
   - Step 5: Record execution trajectory and audit logs.
   - Step 6: Return an honest completion status (VERIFIED_SUCCESS, BOUNDED_EXHAUSTED, SAFETY_BLOCKED).
2. Never ask the model to merely declare itself correct — ground truth verification only.
"""

from __future__ import annotations
import os
import sys
import time
import json
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Any, Optional, Tuple, Callable

sys.path.insert(0, os.path.abspath("."))

from ml_foundation.verifiable_reward_engine import VerifiableRewardEngine

@dataclass
class CorrectionAttempt:
    iteration: int
    candidate: str
    verified: bool
    reward: float
    error_feedback: str
    timestamp: float = field(default_factory=time.time)

@dataclass
class CorrectionTrajectory:
    task_id: str
    domain: str
    max_attempts: int
    attempts_used: int
    initial_candidate: str
    final_candidate: str
    verified: bool
    status: str  # VERIFIED_SUCCESS, BOUNDED_EXHAUSTED, SAFETY_BLOCKED
    attempts: List[CorrectionAttempt] = field(default_factory=list)
    total_latency_ms: float = 0.0


class BoundedSelfCorrectionEngine:
    """
    Coordinates empirical verification and iterative self-correction loops
    under strict resource bounds.
    """

    def __init__(self, max_attempts: int = 3, verifier: Optional[VerifiableRewardEngine] = None):
        self.max_attempts = max_attempts
        self.verifier = verifier or VerifiableRewardEngine()
        self.history: List[CorrectionTrajectory] = []

    def execute_code_correction_loop(
        self,
        task_id: str,
        initial_code: str,
        test_assertions: List[str],
        fix_generator: Callable[[str, str], str],
        timeout_sec: float = 4.0
    ) -> CorrectionTrajectory:
        """
        Executes bounded iterative repair on a Python function using real sandbox execution.
        """
        t0 = time.perf_counter()
        attempts: List[CorrectionAttempt] = []
        current_code = initial_code
        is_verified = False
        final_status = "BOUNDED_EXHAUSTED"

        for i in range(1, self.max_attempts + 1):
            res = self.verifier.verify_code_sandbox(
                current_code,
                test_assertions=test_assertions,
                timeout_sec=timeout_sec
            ) if hasattr(self.verifier, 'verify_code_sandbox') else self.verifier.verify_python_code(
                current_code,
                test_assertions=test_assertions,
                timeout_sec=timeout_sec
            )

            passed = res.get("verified", False)
            reward = res.get("reward", 0.0)
            feedback = res.get("stderr") or res.get("reason", "Verification passed" if passed else "Failed assertions")

            attempt = CorrectionAttempt(
                iteration=i,
                candidate=current_code,
                verified=passed,
                reward=reward,
                error_feedback=feedback
            )
            attempts.append(attempt)

            if passed:
                is_verified = True
                final_status = "VERIFIED_SUCCESS"
                break

            # If not passed and attempts remain, synthesize revision
            if i < self.max_attempts:
                # Call fix generator with error feedback
                revised_code = fix_generator(current_code, feedback)
                if revised_code.strip() == current_code.strip():
                    feedback += " [DIAGNOSTIC: Generator produced identical output; avoiding cycle]"
                current_code = revised_code

        latency = (time.perf_counter() - t0) * 1000.0
        trajectory = CorrectionTrajectory(
            task_id=task_id,
            domain="python_code",
            max_attempts=self.max_attempts,
            attempts_used=len(attempts),
            initial_candidate=initial_code,
            final_candidate=current_code,
            verified=is_verified,
            status=final_status,
            attempts=attempts,
            total_latency_ms=round(latency, 2)
        )
        self.history.append(trajectory)
        return trajectory

    def execute_json_schema_correction_loop(
        self,
        task_id: str,
        initial_json_str: str,
        required_keys: List[str],
        type_constraints: Optional[Dict[str, str]],
        fix_generator: Callable[[str, str], str]
    ) -> CorrectionTrajectory:
        """
        Executes bounded repair on structured tool call JSON strings.
        """
        t0 = time.perf_counter()
        attempts: List[CorrectionAttempt] = []
        current_text = initial_json_str
        is_verified = False
        final_status = "BOUNDED_EXHAUSTED"

        for i in range(1, self.max_attempts + 1):
            res = self.verifier.verify_json_schema(
                current_text,
                required_keys=required_keys,
                type_constraints=type_constraints
            )

            passed = res.get("verified", False)
            reward = res.get("reward", 0.0)
            feedback = res.get("reason", "Verification passed" if passed else "Schema mismatch")

            attempt = CorrectionAttempt(
                iteration=i,
                candidate=current_text,
                verified=passed,
                reward=reward,
                error_feedback=feedback
            )
            attempts.append(attempt)

            if passed:
                is_verified = True
                final_status = "VERIFIED_SUCCESS"
                break

            if i < self.max_attempts:
                current_text = fix_generator(current_text, feedback)

        latency = (time.perf_counter() - t0) * 1000.0
        trajectory = CorrectionTrajectory(
            task_id=task_id,
            domain="tool_json",
            max_attempts=self.max_attempts,
            attempts_used=len(attempts),
            initial_candidate=initial_json_str,
            final_candidate=current_text,
            verified=is_verified,
            status=final_status,
            attempts=attempts,
            total_latency_ms=round(latency, 2)
        )
        self.history.append(trajectory)
        return trajectory

    def execute_math_correction_loop(
        self,
        task_id: str,
        initial_answer: str,
        expected_numeric: float,
        fix_generator: Callable[[str, str], str],
        tolerance: float = 1e-4
    ) -> CorrectionTrajectory:
        """
        Executes bounded repair on mathematical problem reasoning.
        """
        t0 = time.perf_counter()
        attempts: List[CorrectionAttempt] = []
        current_text = initial_answer
        is_verified = False
        final_status = "BOUNDED_EXHAUSTED"

        for i in range(1, self.max_attempts + 1):
            res = self.verifier.verify_mathematics(
                current_text,
                expected_answer=expected_numeric,
                tolerance=tolerance
            )

            passed = res.get("verified", False)
            reward = res.get("reward", 0.0)
            feedback = res.get("reason", "Verification passed" if passed else f"Error: {res.get('error', 0.0)}")

            attempt = CorrectionAttempt(
                iteration=i,
                candidate=current_text,
                verified=passed,
                reward=reward,
                error_feedback=feedback
            )
            attempts.append(attempt)

            if passed:
                is_verified = True
                final_status = "VERIFIED_SUCCESS"
                break

            if i < self.max_attempts:
                current_text = fix_generator(current_text, feedback)

        latency = (time.perf_counter() - t0) * 1000.0
        trajectory = CorrectionTrajectory(
            task_id=task_id,
            domain="math_reasoning",
            max_attempts=self.max_attempts,
            attempts_used=len(attempts),
            initial_candidate=initial_answer,
            final_candidate=current_text,
            verified=is_verified,
            status=final_status,
            attempts=attempts,
            total_latency_ms=round(latency, 2)
        )
        self.history.append(trajectory)
        return trajectory


# ---------------------------------------------------------------------------
# Benchmark & Validation Suite
# ---------------------------------------------------------------------------

def run_bounded_self_correction_benchmark() -> Dict[str, Any]:
    print("=" * 80)
    print("VISION BOUNDED SELF-CORRECTION & EMPIRICAL VERIFICATION BENCHMARK")
    print("=" * 80)

    engine = BoundedSelfCorrectionEngine(max_attempts=3)

    # 1. Code Self-Correction Test Case:
    # Initial buggy implementation (off-by-one or syntax bug), fix on iteration 2
    buggy_code = """
def sum_evens(nums):
    total = 0
    for n in nums:
        if n % 2 == 1:  # Bug: adding odds instead of evens
            total += n
    return total
"""
    code_assertions = [
        "sum_evens([1, 2, 3, 4, 5, 6]) == 12",
        "sum_evens([1, 3, 5]) == 0",
        "sum_evens([2, 4, 8]) == 14",
    ]

    def mock_code_fixer(code: str, feedback: str) -> str:
        # Repairs condition based on feedback
        return code.replace("n % 2 == 1", "n % 2 == 0")

    print("\n--- Executing Python Code Self-Correction Loop ---")
    code_traj = engine.execute_code_correction_loop(
        task_id="code_task_01",
        initial_code=buggy_code,
        test_assertions=code_assertions,
        fix_generator=mock_code_fixer
    )
    print(f"Task: {code_traj.task_id} | Status: {code_traj.status} | Attempts: {code_traj.attempts_used} | Latency: {code_traj.total_latency_ms} ms")
    assert code_traj.status == "VERIFIED_SUCCESS"
    assert code_traj.attempts_used == 2

    # 2. JSON Tool-Call Self-Correction Test Case:
    # Initial malformed JSON with missing required key 'unit'
    malformed_json = '{"tool": "get_weather", "location": "Tokyo"}'
    required_keys = ["tool", "location", "unit"]

    def mock_json_fixer(raw: str, feedback: str) -> str:
        data = json.loads(raw)
        data["unit"] = "celsius"
        return json.dumps(data)

    print("\n--- Executing Tool JSON Schema Self-Correction Loop ---")
    json_traj = engine.execute_json_schema_correction_loop(
        task_id="json_task_01",
        initial_json_str=malformed_json,
        required_keys=required_keys,
        type_constraints={"tool": "str", "location": "str", "unit": "str"},
        fix_generator=mock_json_fixer
    )
    print(f"Task: {json_traj.task_id} | Status: {json_traj.status} | Attempts: {json_traj.attempts_used} | Latency: {json_traj.total_latency_ms} ms")
    assert json_traj.status == "VERIFIED_SUCCESS"
    assert json_traj.attempts_used == 2

    # 3. Math Reasoning Self-Correction Test Case:
    # Initial calculation missed a term, corrected on attempt 2
    buggy_math = "Step 1: 5 * 8 = 40. Step 2: add 3 to get 43. Final answer is 43."
    target_answer = 45.0  # correct answer was 40 + 5 = 45

    def mock_math_fixer(text: str, feedback: str) -> str:
        return "Step 1: 5 * 8 = 40. Step 2: add 5 to get 45. Therefore the final answer is \\boxed{45}."

    print("\n--- Executing Math Reasoning Self-Correction Loop ---")
    math_traj = engine.execute_math_correction_loop(
        task_id="math_task_01",
        initial_answer=buggy_math,
        expected_numeric=target_answer,
        fix_generator=mock_math_fixer
    )
    print(f"Task: {math_traj.task_id} | Status: {math_traj.status} | Attempts: {math_traj.attempts_used} | Latency: {math_traj.total_latency_ms} ms")
    assert math_traj.status == "VERIFIED_SUCCESS"
    assert math_traj.attempts_used == 2

    # 4. Irreparable Task (Bounded Exhaustion Test Case):
    def broken_fixer(code: str, feedback: str) -> str:
        return "def bad(): pass"

    print("\n--- Executing Bounded Exhaustion Limit Test Case ---")
    exhaust_traj = engine.execute_code_correction_loop(
        task_id="code_irreparable",
        initial_code="def broken(): raise RuntimeError()",
        test_assertions=["broken() == 42"],
        fix_generator=broken_fixer
    )
    print(f"Task: {exhaust_traj.task_id} | Status: {exhaust_traj.status} | Attempts: {exhaust_traj.attempts_used} | Verified: {exhaust_traj.verified}")
    assert exhaust_traj.status == "BOUNDED_EXHAUSTED"
    assert exhaust_traj.attempts_used == 3
    assert not exhaust_traj.verified

    report = {
        "timestamp": time.time(),
        "total_tasks_evaluated": 4,
        "verified_successes": 3,
        "bounded_exhaustions": 1,
        "success_rate": 0.75,
        "trajectories": [
            {
                "task_id": t.task_id,
                "domain": t.domain,
                "status": t.status,
                "attempts_used": t.attempts_used,
                "verified": t.verified,
                "total_latency_ms": t.total_latency_ms
            }
            for t in engine.history
        ]
    }

    report_path = "data/learning/self_correction_benchmark_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nAll Self-Correction benchmarks PASSED. Report saved to: {report_path}")
    return report

if __name__ == "__main__":
    run_bounded_self_correction_benchmark()
