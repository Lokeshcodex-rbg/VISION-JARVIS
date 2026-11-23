# VISION STAGE 2 — EVALUATOR SCORING BUG AUDIT & FORENSIC RESOLUTION

## 1. Executive Summary

This audit establishes the root cause of the false-positive capability score reported in the VISION Stage 2 evaluation on the 200-probe independent transfer benchmark (`vision_independent_transfer_test_200.jsonl`).

The reported improvement from **1/200 (0.50%)** to **2/200 (1.00%)** on probes `TRF-0001` and `TRF-0002` was caused by a critical defect in the evaluator function `verify_probe` in `ml_foundation/evaluate_independent_transfer.py`. The evaluator relied on an unanchored substring check (`if exp_ans and exp_ans in gen_lower:`), allowing contradictory model hallucinations to pass simply because the expected numerical answer was echoed as part of a false equation.

Under strict, rigorous evaluation, both `TRF-0001` and `TRF-0002` are **REJECTED**, and the true capability score of `vision-13m-sft-aligned` on this benchmark is **0/200 (0.00%)**.

---

## 2. Forensic Reproduction of Probes TRF-0001 & TRF-0002

Both probes were re-executed against the saved Stage 2 checkpoint (`data/neural_models/checkpoints/vision-13m-sft-aligned/weights.pt`, SHA-256: `085ef922342be408fb9a1b394733da687e0354a3f644de0025f24917de2eb5e2`):

```text
=== PROBE TRF-0001 ===
Prompt:          Compute the exact value of (7 + 10) - 7.
Expected Answer: 10
Raw Output:      '10 = 2.\nThe answer is 3.'
Extracted Final: '3'
Buggy Verdict:   PASSED (EXACT_ANSWER_MATCH) [FALSE POSITIVE]
Rigorous Verdict: REJECTED (NUMERICAL_MISMATCH - Expected 10, Extracted 3)

=== PROBE TRF-0002 ===
Prompt:          Compute the exact value of (11 + 13) - 12.
Expected Answer: 12
Raw Output:      '12 = 3.\nThe answer is 10.'
Extracted Final: '10'
Buggy Verdict:   PASSED (EXACT_ANSWER_MATCH) [FALSE POSITIVE]
Rigorous Verdict: REJECTED (NUMERICAL_MISMATCH - Expected 12, Extracted 10)
```

### Forensic Analysis of Generated Text

In `TRF-0001`:

1. The model hallucinated the invalid mathematical assertion `10 = 2.`.
2. The model explicitly declared its final answer on the second line: `The answer is 3.`.
3. The true answer is $(7 + 10) - 7 = 10$. The model's answer of $3$ is mathematically incorrect.
4. The flawed evaluator checked whether the string `"10"` appeared anywhere in `'10 = 2.\nThe answer is 3.'`. Because `"10"` was present at index 0, it marked the probe as `EXACT_ANSWER_MATCH`.

In `TRF-0002`:

1. The model hallucinated the invalid mathematical assertion `12 = 3.`.
2. The model explicitly declared its final answer on the second line: `The answer is 10.`.
3. The true answer is $(11 + 13) - 12 = 12$. The model's answer of $10$ is mathematically incorrect.
4. The flawed evaluator checked whether `"12"` appeared anywhere in `'12 = 3.\nThe answer is 10.'`. Because `"12"` was present at index 0, it marked the probe as `EXACT_ANSWER_MATCH`.

---

## 3. Root Cause Code Audit

The defective function was located in `ml_foundation/evaluate_independent_transfer.py` at line 14:

```python
# DEFECTIVE IMPLEMENTATION
def verify_probe(probe: Dict[str, Any], gen_text: str) -> Tuple[bool, str]:
    v_type = probe.get("verification_type", "keyword_match")
    exp_ans = str(probe.get("expected_answer", "")).strip().lower()
    exp_kw = [k.lower() for k in probe.get("expected_keywords", [])]
    gen_lower = gen_text.lower()

    if not gen_text.strip():
        return False, "EMPTY_GENERATION"

    # Exact math check
    if v_type == "exact_math":
        if exp_ans and exp_ans in gen_lower:          # <-- FATAL DEFECT
            return True, "EXACT_ANSWER_MATCH"
        for kw in exp_kw:
            pattern = rf"\b{re.escape(kw)}\b"
            if re.search(pattern, gen_lower):         # <-- SECONDARY DEFECT
                return True, "KEYWORD_NUMBER_MATCH"
        return False, f"MATH_MISMATCH (Expected {exp_ans}, got: {gen_text[:60]})"
```

### Failure Mechanisms

1. **Unanchored Substring Inclusion (`exp_ans in gen_lower`)**:
   Matches any occurrence of the target number, even when used as a variable name (`x10`), an intermediate step, an irrelevant operand, or a contradictory falsehood (`10 = 2`).
2. **Ignored Explicit Declarations**:
   When the model explicitly states `The answer is 3.`, the evaluator completely ignored this definitive conclusion and instead searched the surrounding text for the question's expected number.
3. **Absence of Contradiction Detection**:
   Mathematical falsehoods of the form $A = B$ where $A \neq B$ were not flagged as hallucinations.

---

## 4. Re-Engineered Rigorous Evaluator (`ml_foundation/rigorous_evaluator.py`)

A replacement evaluation engine was developed adhering to formal verification standards:

### Core Verification Rules

1. **Answer Extraction Precedence**:
   - Searches for explicit declaration patterns: `(?:the\s+answer\s+is|final\s+answer|####|=)\s*([+-]?\d+(?:\.\d+)?(?:/\d+)?)`.
   - If an explicit answer declaration exists, **only that declared value** is extracted and verified.
   - If no declaration exists, the output must be a clean, single numerical value (or single value on the final line).
2. **Contradiction Detection**:
   - Flags and immediately rejects any contradictory arithmetic statements ($A = B$ where $A \neq B$).
3. **Numerical & Expression Normalization**:
   - Parses integers, floats, negative values, and fractions (`try_parse_number`).
   - Compares numerical values with floating-point tolerance ($|x_{\text{expected}} - x_{\text{actual}}| < 10^{-6}$).
4. **Code AST Verification (`verify_code_probe`)**:
   - Parses code via `ast.parse()`.
   - Requires valid function definitions (`ast.FunctionDef`) and non-empty `return` or `yield` statements.
5. **Categorical Logic Disambiguation (`verify_categorical_probe`)**:
   - Verifies unambiguous affirmative or negative conclusions, rejecting contradictory outputs (e.g., `Yes, but actually no`).

---

## 5. Verification Test Battery (`VISION_STAGE2_EVALUATOR_TESTS.json`)

The rigorous evaluator was subjected to a 22-test validation battery across 8 categories:

| Test Case Category | Total Tests | Passed | Success Rate | Behavior Verified |
| :--- | :--- | :--- | :--- | :--- |
| **Contradictory Arithmetic** | 3 | 3 | 100.0% | Rejects `10 = 2. The answer is 3.`, `12 = 3. The answer is 10.`, `10 = 25` |
| **Premise False Positives** | 1 | 1 | 100.0% | Rejects `We start with 10... The answer is 4.` |
| **Correct Answers** | 3 | 3 | 100.0% | Passes `10`, `The answer is 10.`, `= 10` |
| **Negative Values** | 2 | 2 | 100.0% | Passes `-15`, rejects `15` when `-15` expected |
| **Decimals & Fractions** | 3 | 3 | 100.0% | Matches `0.50` to `0.5`, `1/2` to `0.5`, `10.0` to `10` |
| **Multiple / Ambiguous Numbers** | 1 | 1 | 100.0% | Rejects `1.2 = 3, 10, 1, 15, 20` |
| **Empty / Malformed** | 3 | 3 | 100.0% | Rejects empty strings, whitespace, random punctuation |
| **Python Code AST** | 3 | 3 | 100.0% | Passes valid functions, rejects syntax errors and missing returns |
| **Categorical Logic** | 3 | 3 | 100.0% | Passes direct `Yes`, rejects `Yes, but actually no` and `yesterday` |
| **Total Test Battery** | **22** | **22** | **100.0%** | **All positive & negative controls verified** |

---

## 6. Conclusion and Remediation

1. The Stage 2 reported score of $2/200$ was an artifact of the substring evaluation bug.
2. The corrected Stage 2 score is **0/200 (0.00%)**.
3. All subsequent evaluations in this program are bound to `ml_foundation/rigorous_evaluator.py`. No model will be marked as passing any probe without meeting rigorous extraction and verification standards.
