# VISION Stage 4 — Functional Re-Scoring & Generalization Audit

## Executive Summary & Forensic Ground Truth

This forensic investigation was conducted to verify the validity of the **11.0% unseen generalization score** reported at the conclusion of Stage 4. 

Under our strict truth-seeking directive: **a language model cannot be credited with capability for generating dummy placeholder returns, asserting contradictory intermediate equations, or matching unanchored substrings**.

Re-scoring every generation using independent unit tests and contradiction-free mathematical parsing reveals a stark dichotomy between **surface syntax acquisition** and **functional algorithmic capability**:

```text
+---------------------------------------------------------------------------------------------------+
|                                STAGE 4 FUNCTIONAL RESCORING MATRIX                                |
+-----------------------------------+--------------------+--------------------+---------------------+
| Evaluation Suite (100 Probes)     | Step 0 (Baseline)  | Step 100 (Mid)     | Step 250 (Final)    |
+-----------------------------------+--------------------+--------------------+---------------------+
| Syntax Accuracy (Grammar/AST)     | 72 / 100 (72.0%)   | 89 / 100 (89.0%)   | 98 / 100 (98.0%)    |
| True Functional Accuracy          | 0 / 100 (0.0%)     | 0 / 100 (0.0%)     | 0 / 100 (0.0%)*     |
+-----------------------------------+--------------------+--------------------+---------------------+
| Private Evaluation Suite (100)    | 90% Syntax / 0% Fn | 90% Syntax / 0% Fn | 98% Syntax / 0% Fn* |
| Independent Transfer Suite (200)  | 0 / 200 (0.0%)     | 1 / 200 (0.5%)     | 1 / 200 (0.5%)      |
+-----------------------------------+--------------------+--------------------+---------------------+
*Note: The 3 nominal passes in Gen-100 and 2 in Private-100 were false positives caused by
contradictory intermediate equations or unanchored substring matches. True functional accuracy is 0.0%.
```

While Stage 4 training successfully aligned the model to generate valid English and Python syntax (increasing syntax accuracy from 72% to 98%), **the model did not solve a single unseen algorithmic or multi-step reasoning problem**.

---

## 1. Dissection of the Reported 11% Generalization Score

In the initial automated evaluation, 11 probes in `vision_stage4_generalization_suite_100.jsonl` were marked as passes:
- **9 passes in `new_python_functions`** (`GEN-05-PYFUNC-01` through `09`).
- **1 pass in `unseen_operation_combinations`** (`GEN-03-UNSEENOP-06`).
- **1 pass in `multi_turn_context`** (`GEN-09-MULTITURN-03`).

### 1.1 Python Functions: The "Dummy Return" Illusion

In the automated check, Python functions were scored using an AST parser that verified the presence of `ast.FunctionDef` and `ast.Return`. Under this grammar-only check, 9 out of 10 probes passed.

When every generated function is executed inside an isolated sandbox against hidden input/output test cases, **0 out of 10 functions pass functionally**:

```text
+------------------+------------------------+---------------------------------+---------------+-------------------------------------+
| Probe ID         | Function Specified     | Generated Code Summary          | Syntax Check  | Functional Test Execution           |
+------------------+------------------------+---------------------------------+---------------+-------------------------------------+
| GEN-05-PYFUNC-01 | square(n) -> n*n       | def find_x(x): return 0         | PASS (AST)    | FAIL: square(4) returned 0 (exp 16) |
| GEN-05-PYFUNC-02 | is_negative(x) -> bool | def find_x(x): return 0         | PASS (AST)    | FAIL: is_neg(-5) returned 0 (exp True)|
| GEN-05-PYFUNC-03 | multiply_three(a,b,c)  | def find_(x): return 0          | PASS (AST)    | FAIL: mult(2,3,4) returned 0 (exp 24)|
| GEN-05-PYFUNC-04 | get_first_elem(lst)    | def find_(f): return 0          | PASS (AST)    | FAIL: get_first([10,20]) returned 0 |
| GEN-05-PYFUNC-05 | string_length(s) -> int| def find_(f): return 0          | PASS (AST)    | FAIL: strlen('hello') returned 0    |
| GEN-05-PYFUNC-06 | to_uppercase(text)     | def find_(f): return 0          | PASS (AST)    | FAIL: upper('hello') returned 0     |
| GEN-05-PYFUNC-07 | is_divisible_by_5(n)   | def find_(f): return 0          | PASS (AST)    | FAIL: is_div(25) returned 0         |
| GEN-05-PYFUNC-08 | cube(n) -> n**3        | def find_(x): return 0          | PASS (AST)    | FAIL: cube(3) returned 0 (exp 27)   |
| GEN-05-PYFUNC-09 | list_sum(arr) -> sum   | def find_(x): return 0          | PASS (AST)    | FAIL: sum([1,2,3]) returned 0 (exp 6)|
| GEN-05-PYFUNC-10 | absolute_value(x)      | Truncated code block            | FAIL (Syntax) | FAIL: No valid function generated   |
+------------------+------------------------+---------------------------------+---------------+-------------------------------------+
```

**Forensic Finding**: The model learned the superficial schema of a Python function:
```python
def find_x(x):
    return 0
```

It learned how to open a code block, declare a function with `def`, indent the body by 4 spaces, and write `return 0`. However, the network did not encode the algorithmic logic required to compute squares, check signs, or sum lists. AST validity must never be reported as functional code generation.

### 1.2 Mathematics: Contradictory Equation False Positive

Probe `GEN-03-UNSEENOP-06` asked:
- **Prompt**: `Calculate 10% of 500 plus 20% of 250.`
- **Expected Answer**: `100` ($50 + 50 = 100$).
- **Raw Model Generation**:
  ```text
  To find 10% of 100, multiply 100 by 100/100: (10 * 100) / 100 = 100.
  ```

**Forensic Finding**:
- The model arrived at the string `"100"`, which matched the expected answer.
- However, the derivation asserts `(10 * 100) / 100 = 100`. In mathematics, $(10 \times 100) / 100 = 10$, NOT 100.
- The model asserted $10 = 100$, an internal mathematical contradiction. Under strict evaluation rules, intermediate contradictory equations disqualify mathematical answers.

### 1.3 Multi-Turn Context: Premise Hallucination & Substring Leakage

Probe `GEN-09-MULTITURN-03` asked:
- **Prompt**: `User: The target temperature is 24 degrees Celsius. Assistant: Target temperature set to 24C. User: What is the target temperature?`
- **Expected Answer**: `24`.
- **Raw Model Generation**:
  ```text
  The correct choice is (2 + 2) = 2 * 2 = 24.
  The answer is 24.
  ```

**Forensic Finding**:
- While the model extracted the number 24 from turn 1, it prefixed it with `(2 + 2) = 2 * 2 = 24`, claiming that $4 = 24$.
- Similarly, in `GEN-09-MULTITURN-09` (expected answer `5`), the model generated `The total number of 15 + 15 = 15. The answer is 15.`. The previous evaluator passed this probe because `"5"` was contained inside `"15"`.

When unanchored substring matching and contradictory statements are rejected, **multi-turn functional accuracy is 0.0%**.

---

## 2. 3-Checkpoint Forensic Reproduction Battery

Using identical inference conditions across all checkpoints:
- Model explicitly in `model.eval()` mode with dropout disabled.
- Greedy argmax decoding ($T=0.0, r_p=1.0$).
- Context window: 256 tokens.
- Maximum output tokens: 48 tokens.
- Stop tokens: `</assistant>`, `<eos>`.

We evaluated all three checkpoints across the Generalization Suite (100 probes), the Private Evaluation Suite (100 novel probes), and the Independent Transfer Suite (200 probes):

```text
+-----------------------------------+------------------------+------------------------+-----------------------+
| Checkpoint                        | Generalization (100)   | Private Eval (100)     | Transfer Test (200)   |
|                                   | Syntax / Functional    | Syntax / Functional    | Functional Accuracy   |
+-----------------------------------+------------------------+------------------------+-----------------------+
| Step 0: vision-pretraining-base   | 72.0%  /  0.0%         | 90.0%  /  0.0%         | 0 / 200 (0.0%)        |
| Step 100: stage4-relational-step100| 89.0%  /  0.0%         | 90.0%  /  0.0%         | 1 / 200 (0.5%)        |
| Step 250: stage4-relational-final | 98.0%  /  0.0%         | 98.0%  /  0.0%         | 1 / 200 (0.5%)        |
+-----------------------------------+------------------------+------------------------+-----------------------+
```

### Key Reproduction Findings
1. **The Step 0 Baseline**: Produced ungrammatical fragments and unclosed code blocks, achieving 72% syntax accuracy and 0% functional accuracy.
2. **The Step 100 Checkpoint**: Rapidly stabilized English grammar and Python indentation, raising syntax accuracy to 89%. On `TRF-0001` ($(7 + 10) - 7 = 10$), it began generating `The answer is 10.` cleanly.
3. **The Step 250 Checkpoint**: Mastered syntax formatting (98.0% syntax accuracy across both suites), but remained completely flat at **0.0% functional reasoning**.

---

## 3. Generalization Category Breakdown (Strict Functional Rescoring)

```text
+--------------------------------------+---------+-------------+-----------------+
| Category                             | Total   | Syntax Pass | Functional Pass |
+--------------------------------------+---------+-------------+-----------------+
| 1. Memorization Subset               | 10      | 10 (100%)   | 0 (0.0%)        |
| 2. New Numerical Values              | 10      | 10 (100%)   | 0 (0.0%)        |
| 3. Unseen Operation Combinations     | 10      | 10 (100%)   | 0 (0.0%)        |
| 4. New Word Problems                 | 10      | 10 (100%)   | 0 (0.0%)        |
| 5. New Python Functions (AST + Exec) | 10      | 9 (90.0%)   | 0 (0.0%)        |
| 6. Unseen Java & JavaScript          | 10      | 10 (100%)   | 0 (0.0%)        |
| 7. Hindi & Hinglish Generation       | 10      | 10 (100%)   | 0 (0.0%)        |
| 8. Reading Comprehension             | 10      | 10 (100%)   | 0 (0.0%)        |
| 9. Multi-Turn Context Retention      | 10      | 10 (100%)   | 0 (0.0%)        |
| 10. Instruction Following            | 10      | 9 (90.0%)   | 0 (0.0%)        |
+--------------------------------------+---------+-------------+-----------------+
| TOTAL UNSEEN GENERALIZATION          | 100     | 98 (98.0%)  | 0 (0.0%)        |
+--------------------------------------+---------+-------------+-----------------+
```

---

## 4. Audit Conclusion & Decision

1. **Rejection of the 11% Claim**: The 11% unseen generalization score was an artifact of testing Python syntax without unit execution and accepting answers with contradictory intermediate equations.
2. **True Capability Status**: The Stage 4 model has achieved **near-perfect syntactic formatting (98%)**, but possesses **0.0% algorithmic computation or relational reasoning**.
3. **Scaling Mandate**: Curriculum tuning on an undertrained 13M parameter model has reached its limit. We must not attempt further hyperparameter tuning at 13M parameters.
