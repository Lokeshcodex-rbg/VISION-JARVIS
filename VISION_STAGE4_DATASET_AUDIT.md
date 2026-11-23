# VISION Stage 4 — Training Corpus & Template Memorization Audit

## Executive Summary

Following the Stage 3 finding that the 13.33M model exhibited template mode collapse (defaulting to `{A} = {B}.\nThe answer is {C}.` and `The correct answer is 1.`), this audit examines the structural composition of the previous training corpora (`vision_sft_alignment` and `vision_stage3_curriculum`).

The objective is to identify and eradicate the data-level root causes of template memorization, predictable answer positions, contradictory equations, and superficial synthetic variations, establishing the requirements for a verified relational curriculum.

```text
+---------------------------------------------------------------------------------------------------+
|                                CORPUS STRUCTURAL DEFECT AUDIT SUMMARY                             |
+------------------------------+-------------------------+-------------------------+----------------+
| Metric                       | Stage 2 SFT Alignment   | Stage 3 Curriculum      | Defect Level   |
+------------------------------+-------------------------+-------------------------+----------------+
| Total Samples                | 10,665                  | 10,435                  | -              |
| Synthetic Ratio              | 34.10% (3,637 samples)  | 32.56% (3,398 samples)  | High           |
| Unique Question Templates    | ~42 distinct skeletons  | ~68 distinct skeletons  | Severe Poverty |
| Top 5 Question Dominance     | 857 samples (8.03%)     | 636 samples (6.09%)     | Repetitive     |
| Top 3 Answer Dominance       | 1,152 samples (10.80%)  | 1,111 samples (10.65%)  | Mode Collapse  |
| Contradictory Statements     | 40 detected             | 45 detected             | Corruptive     |
| Multiple-Choice Entropy      | N/A (0 MC in SFT)       | 1.38 nats (Balanced)    | Controlled     |
+------------------------------+-------------------------+-------------------------+----------------+
```

---

## 1. Audit of Repetitive Question Templates

### 1.1 Structural Repetition in Synthetic Arithmetic

In both Stage 2 and Stage 3 datasets, the synthetic arithmetic component was generated from a tiny set of hard-coded string templates:

```text
Top Repetitive Question Skeletons (Stage 3):
1. "Calculate {NUM} - {NUM}."          (129 occurrences, 1.24%)
2. "Calculate {NUM} + {NUM}."          (129 occurrences, 1.24%)
3. "What is {NUM} * {NUM}?"            (129 occurrences, 1.24%)
4. "What is {NUM} - {NUM}?"            (125 occurrences, 1.20%)
5. "Compute the value of {NUM} * {NUM}." (124 occurrences, 1.19%)
6. "Evaluate: {NUM} - {NUM}."          (117 occurrences, 1.12%)
7. "What is {NUM} + {NUM}?"            (114 occurrences, 1.09%)
```

Across 2,500 arithmetic samples, only 7 primary question patterns were used. While operand numbers varied randomly ($a \in [4, 95], b \in [2, 60]$), the syntactic structure was static.

### 1.2 Cognitive Impact on the Transformer Model

For an attention mechanism in an 8-layer, 320-hidden-dimension network:

- The token representations for `Calculate`, `What is`, and `Compute the value of` quickly become saturated with positional shortcuts.
- Instead of learning a general relational function $f(a, b, \text{op}) \to c$, the self-attention heads learn that token position 2 is operand $A$, token position 4 is operand $B$, and the output must begin with an equation token sequence.
- When an unseen prompt arrives formatted as `Compute the exact value of (7 + 10) - 7.`, the model fails because it has never generalized the operator semantics outside the rigid positional slots.

---

## 2. Audit of Repetitive Answer Templates

### 2.1 Output Mode Collapse

The distribution of response prefixes across all 10,435 samples in Stage 3 reveals severe structural clustering:

```text
Dominant Response Prefixes:
1. Bare Number: "{NUM}"                          (557 samples, 5.34%)
2. Declared Number: "The answer is {NUM}."       (311 samples, 2.98%)
3. Declared Value: "The value is {NUM}."         (243 samples, 2.33%)
4. Equation Statement: "{NUM} + {NUM} = {NUM}"   (143 samples, 1.37%)
5. Equation Statement: "{NUM} * {NUM} = {NUM}"   (121 samples, 1.16%)
6. Python Fence: "```python"                     (121 samples, 1.16%)
7. Verbal Equation: "{NUM} * {NUM} evaluates to" (107 samples, 1.03%)
```

Over 10% of all assistant responses in the dataset begin with either a bare number or `The answer is...`.

### 2.2 Mechanism of Hallucinated Premise Loops

During decoding on `vision-13m-sft-aligned`, the model frequently outputted:

```text
10 = 2.
The answer is 3.
```

The audit reveals exactly where this behavior originated:

- In `build_sft_alignment_dataset.py`, style `"step"` and `"equation"` emitted patterns like:
  `({a} {op1} {b}) = {intermediate}, then {intermediate} {op2} {c} = {final_res}.`
- When truncated to 256 tokens or poorly supervised, the network learned the bigram pattern `{NUM} = {NUM}` followed by `\nThe answer is {NUM}`.
- Because the network had not learned arithmetic addition tables, it filled the `{NUM}` slots with high-frequency unigram numbers from its vocabulary.

---

## 3. Analysis of Contradictory Answers & Label Inconsistencies

### 3.1 Contradictory Equalities in Corpus

The audit detected 45 instances in Stage 3 and 40 in Stage 2 of contradictory equality statements ($N_1 = N_2$ where $N_1 \neq N_2$ without intermediate operators):

- **Source 1: GSM8K conversational annotations**: In step-by-step reasoning texts from web sources, informal shorthand frequently used `=` to denote assignment or association rather than mathematical equality (e.g., `Let cost = 5, total = 10`, or `Step 1 = 15`).
- **Source 2: Multi-equation chaining**: Expressions such as `10 + 5 = 15 * 2 = 30` (where $10 + 5 \neq 30$, but the writer meant $(10 + 5) \times 2 = 30$) taught the transformer that equality is non-transitive and arbitrary.

### 3.2 Label Verification Mandate for Stage 4

For all mathematical and algorithmic data in Stage 4:

- Every mathematical problem must be generated alongside an independent deterministic Python evaluator that computes the ground truth.
- Chained equalities (`A = B = C` where $A \neq C$) are strictly prohibited. Every step must be an independent, syntactically and semantically valid equation.
- Every Python function must be validated via Python's `ast.parse` module to guarantee syntactic correctness before inclusion.

---

## 4. Multiple-Choice Position Distribution Audit

In Stage 2, multiple-choice examples were absent, leading to total incoherence when presented with multiple-choice probes. In Stage 3, cais/mmlu examples were integrated with de-biased styles.

The audit confirms that multiple-choice answer distribution in Stage 3 was balanced:

- Choice (A): 170 samples (25.56%)
- Choice (B): 174 samples (26.17%)
- Choice (C): 162 samples (24.36%)
- Choice (D): 159 samples (23.91%)

However, the multiple-choice questions suffered from **format brittleness**: when asked to answer a multiple-choice question without the exact prefix `Options:\n(A)...`, the model failed to recognize the options.

---

## 5. Requirements for the Stage 4 Relational Curriculum

To break out of the zero-transfer plateau, Stage 4 requires a fundamental shift from surface template repetition to relational curriculum design:

1. **Relational Problem Generation**:
   - Instead of 7 static templates with varying numbers, construct 50+ diverse semantic formulations per mathematical concept (word problems, geometric contexts, inventory calculations, fractional parts, unit conversions, algebraic equations).
2. **Structural Partitioning (Zero Structural Leakage)**:
   - Partitioning must group problems by **problem structure hash**, not merely exact prompt string. Numerical variations of the same underlying generator must reside entirely within `train` or entirely within `val`.
3. **Multi-Step Deductive Chain-of-Thought**:
   - Answers must not leap immediately to `{NUM}`. They must state the governing formula or rule, substitute the values, compute the intermediate step, and state the final result.
4. **Polyglot & Multi-Domain Breadth**:
   - Python AST functions with unit test assertions.
   - Java class methods with strict type signatures.
   - JavaScript functional expressions.
   - SQL queries with relational schemas.
   - Deductive syllogisms and causal physical reasoning.
   - Bilingual English and Hindi technical instructions.
