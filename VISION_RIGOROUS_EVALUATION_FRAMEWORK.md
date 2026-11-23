# VISION — Rigorous Evaluation Framework & Scoring Specification

## Executive Summary

To permanently eliminate false positives and evaluation illusions, this framework establishes the **Standardized Native Capability Verification Protocol** for all present and future VISION foundation model checkpoints.

Under this protocol:

- **Syntax is Not Correctness**: AST validity or code compilation confirms grammatical syntax only. A program passes **only** if it executes correctly against hidden unit tests.
- **Contradictions Disqualify Mathematics**: Generating an expected number by stating an invalid intermediate equality (e.g., asserting $(10 \times 100)/100 = 100$ or $(2+2)=4=24$) is disqualified as an invalid mathematical proof.
- **Unanchored Substring Matches are Rejected**: Extracted answers must be word-bounded or equation-isolated (`The answer is X`). Substring containment (such as `"5"` within `"15"`) is scored as a failure.
- **Native Evaluation Only**: 0 external models (Gemini), 0 RAG, 0 SymPy or Python tool execution during inference. External code execution is used solely by the evaluator to grade the model's generated output.

---

## 1. Domain-Specific Verification Protocols

### 1.1 Programming & Code Generation

A generated code snippet must pass through a 4-tier evaluation pipeline:

```text
+-------------------------------------------------------------------------------------------------------------+
|                                    4-TIER CODE VERIFICATION PIPELINE                                        |
+-------+-------------------------+-----------------------------------------+---------------------------------+
| Tier  | Metric Stage            | Evaluation Method                       | Rejection Criteria              |
+-------+-------------------------+-----------------------------------------+---------------------------------+
| Tier 1| Syntax Parsing (AST)    | ast.parse(code)                         | SyntaxError, invalid tokens     |
| Tier 2| Signature Verification  | Inspect function name & argument count  | Missing target function name    |
| Tier 3| Placeholder Rejection   | Detect dummy bodies (return 0, pass)    | Constant return without compute |
| Tier 4| Functional Unit Testing | Execute in sandbox with hidden test cases| AssertionError, Timeout, Error  |
+-------+-------------------------+-----------------------------------------+---------------------------------+
```

#### Metrics Reported

Every programming benchmark reports four distinct, uncombined metrics:

1. `syntax_accuracy_pct`: Share of probes generating parseable code.
2. `compilation_accuracy_pct`: Share of probes compiling without linker/runtime syntax exceptions.
3. `functional_accuracy_pct`: Share of probes passing at least one baseline test case.
4. `hidden_test_accuracy_pct`: Share of probes passing 100% of hidden edge-case assertions.

---

### 1.2 Mathematics & Numerical Reasoning

Mathematical verification enforces deductive consistency:

1. **Answer Extraction**: The evaluator extracts the final candidate numerical answer using boundary-anchored patterns (`The answer is <X>`, `#### <X>`, or final equality `= <X>`).
2. **Intermediate Calculation Audit**:
   - The generation is parsed for all intermediate equality assertions ($A = B$).
   - If an assertion evaluates to a numerical contradiction (e.g., $12 - 11 = 11$, or $10 \times 1 = 100$), the probe is marked as **CONTRADICTORY_DERIVATION** and scored as 0.0.
3. **Symbolic Normalization**: Fractions ($3/4$), percentages ($75\%$), and decimals ($0.75$) are normalized to exact mathematical equivalents before scoring.

---

### 1.3 Natural Language, Translation & Multi-Turn Context

1. **Hinglish & Hindi Translation**:
   - Evaluated against reference semantic intent using exact key-entity alignment and BLEU/ROUGE thresholding with semantic verification.
   - Rejects defaulting to English memorized templates.
2. **Multi-Turn Context Tracking**:
   - Tests memory recall from earlier dialogue turns.
   - Candidate entity must be correctly attributed to the specific queried variable without premise distortion.

---

## 2. Benchmark Suite Registry & Cryptographic Invariants

All benchmark files are immutable and cryptographically registered:

```text
+-------------------------------------------------------------------------------------------------------------+
|                                  CRYPTOGRAPHIC BENCHMARK SUITE REGISTRY                                     |
+-------------------+---------------------------------------------+-------------+-----------------------------+
| Suite ID          | Benchmark File Path                         | Probe Count | SHA-256 Hash                |
+-------------------+---------------------------------------------+-------------+-----------------------------+
| BENCH-500-FRESH   | vision_fresh_validation_dataset_500.jsonl   | 500 probes  | 909ee1e97aef054bd2d531a4... |
| BENCH-100-PRIV    | vision_stage4_private_eval_100.jsonl        | 100 probes  | 3499426f8dcfc96cf7b78996... |
| BENCH-100-GEN     | vision_stage4_generalization_suite_100.jsonl| 100 probes  | 59528fc90c5a526c5999f817... |
| BENCH-200-TRF     | vision_independent_transfer_test_200.jsonl  | 200 probes  | c0405fb6e2419d15052c7090... |
| BENCH-1500-EXP    | vision_expanded_validation_dataset_1500.json| 1,500 probes| 161e38b330364f9b88e174b8... |
+-------------------+---------------------------------------------+-------------+-----------------------------+
```

### Invariant Rules

- Benchmark files must never be added to training or fine-tuning datasets.
- Probes are versioned with fixed answer keys.
- Every evaluation run records the exact model SHA-256, inference parameters ($T=0.0, r_p=1.0$), and full raw outputs.
