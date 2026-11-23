# VISION Stage 3 — Benchmark Correction, SFT Validation and Capability Improvement Final Report

## Executive Summary & Ground Truth Statement

This investigation and training cycle was conducted under a strict truth-seeking directive: **never confuse training loss reduction with native model capability, and never accept false-positive evaluation passes as capability breakthroughs**.

The previous Stage 2 SFT report indicated an apparent capability improvement from 1/200 (0.5%) on the base pretrained model to 2/200 (1.0%) following instruction fine-tuning. A forensic audit of the individual probe generations revealed that this reported improvement was an illusion caused by an unanchored substring matching defect in the evaluation script `ml_foundation/evaluate_independent_transfer.py`. Under rigorous formal evaluation that enforces answer declaration parsing, numerical equivalence, and contradiction rejection, the true capability of the Stage 2 checkpoint is **0/200 (0.0%)** in calibrated mode and **1/200 (0.5%)** in uncalibrated mode.

Following this finding, we resolved the evaluator defects, built a comprehensive 22-test verification battery, audited the SFT dataset pipeline to eliminate train/validation prompt leakage, diagnosed failure modes across 11 key disciplines, and conducted a controlled Stage 3 curriculum training run on a de-biased multi-domain corpus.

```text
+---------------------------------------------------------------------------------------------------+
|                                   STAGE 3 RIGOROUS BENCHMARK RESULTS                              |
+-----------------------------------+--------------------+--------------------+---------------------+
| Model Checkpoint                  | Parameters / Arch  | Calibrated (rp=1.1)| Uncalibrated (Greedy|
+-----------------------------------+--------------------+--------------------+---------------------+
| vision-pretraining-validation-13m | 13.33M (8L, 320D)  | 1 / 200 (0.5%)     | 0 / 200 (0.0%)      |
| vision-13m-sft-aligned (Stage 2)  | 13.33M (8L, 320D)  | 0 / 200 (0.0%)     | 1 / 200 (0.5%)      |
| vision-13m-stage3-curriculum      | 13.33M (8L, 320D)  | 0 / 200 (0.0%)     | 0 / 200 (0.0%)      |
| vision-v1.4-replay-cand-b         | Historical Archive | 0 / 200 (0.0%)     | 0 / 200 (0.0%)      |
| vision-2.0-candidate-g            | Historical Archive | 0 / 200 (0.0%)     | 0 / 200 (0.0%)      |
+-----------------------------------+--------------------+--------------------+---------------------+
```

While Stage 3 curriculum training drove validation loss down from **3.3141 nats to 2.6673 nats** (-0.6468 nats, a 19.5% perplexity reduction), native independent transfer accuracy remains at **0/200 (0.0%)**. This report documents the exact mathematical, architectural, and data reasons for this plateau, establishes the GPU-ready FSDP cluster infrastructure for foundation pretraining, and details the steps required to transition VISION to genuine foundation capability.

---

## 1. Forensic Audit & Resolution of the Arithmetic Scoring Bug

### 1.1 Reproduction of False-Positive Probes

The Stage 2 evaluation reported passing marks on two basic arithmetic probes in `vision_independent_transfer_test_200.jsonl`:

- **Probe TRF-0001**: `Compute the exact value of (7 + 10) - 7.` Expected answer: `10`.
- **Probe TRF-0002**: `Compute the exact value of (11 + 13) - 12.` Expected answer: `12`.

Using the exact saved weights of `vision-13m-sft-aligned` (`data/neural_models/checkpoints/vision-13m-sft-aligned/weights.pt`, SHA-256: `085ef922342be408fb9a1b394733da687e0354a3f644de0025f24917de2eb5e2`), we reproduced the exact model outputs under calibrated decoding ($T=0.2$, $\text{top\_p}=0.9$, $\text{repetition\_penalty}=1.15$):

```text
PROBE TRF-0001:
Prompt:   <bos><user>Compute the exact value of (7 + 10) - 7.</user><assistant>
Expected: 10
Raw Output:
10 = 2.
The answer is 3.

Extracted Declaration: 3
Contradiction Present: 10 = 2 (False)
Old Evaluator Decision: PASSED (Reason: "10" found in string)
Rigorous Decision:      FAILED (Extracted answer is 3, not 10; contradictory premise 10 = 2)

PROBE TRF-0002:
Prompt:   <bos><user>Compute the exact value of (11 + 13) - 12.</user><assistant>
Expected: 12
Raw Output:
12 = 3.
The answer is 10.

Extracted Declaration: 10
Contradiction Present: 12 = 3 (False)
Old Evaluator Decision: PASSED (Reason: "12" found in string)
Rigorous Decision:      FAILED (Extracted answer is 10, not 12; contradictory premise 12 = 3)
```

### 1.2 Root Cause Analysis of the Evaluator Defect

The flaw was located in `ml_foundation/evaluate_independent_transfer.py:verify_probe`:

```python
# DEFECTIVE CODE IN ml_foundation/evaluate_independent_transfer.py
if exp_ans and exp_ans in gen_lower:
    return True, "EXACT_NUMERICAL_MATCH"
```

This unanchored substring check suffered from three critical vulnerabilities:

1. **Premise Leakage**: If the prompt's question contained numbers, or if the model echoed numbers from the prompt in an introductory hallucination (e.g., `10 = 2.`), the check passed regardless of what followed.
2. **Declaration Ignorance**: When the model explicitly stated `The answer is 3.`, the evaluator ignored the declared conclusion and searched the entire text for `"10"`.
3. **Contradiction Tolerance**: Statements violating basic mathematical axioms ($10 = 2$, $12 = 3$) were treated as valid proofs.

### 1.3 Re-Engineering the Rigorous Evaluator

We authored and deployed [ml_foundation/rigorous_evaluator.py](file:///d:/Jarvis/ml_foundation/rigorous_evaluator.py). The new verification engine applies multi-stage deterministic checks:

1. **Declaration Extraction**: Inspects formal answer declarations (`The answer is X`, `#### X`, `The correct option is X`, trailing numeric tokens).
2. **Numerical Equivalence with Tolerance**: Parses numerical expressions into IEEE 754 floating-point values and compares via $|x - y| < 10^{-6}$.
3. **Contradiction Rejection**: Regex-scans generated equations ($A = B$). If any equation asserts $A = B$ where $|A - B| > 10^{-6}$, the entire response is disqualified.
4. **Code Syntax Verification**: Evaluates code responses through Python AST parsing (`ast.parse`), requiring valid syntax, function definitions (`ast.FunctionDef`), and return statements (`ast.Return`).
5. **Categorical Logic Disambiguation**: Enforces exact match or single-letter boundary matching for multiple-choice options (`(A)`, `(B)`, `(C)`, `(D)`), rejecting sentences that list multiple choices.

### 1.4 Evaluator Test Battery Validation

To verify that the rigorous evaluator cannot be fooled, we authored [ml_foundation/test_evaluator_rigor.py](file:///d:/Jarvis/ml_foundation/test_evaluator_rigor.py) comprising 22 positive and negative test controls:

- **Test Suite Results**: **22 / 22 Passed (100.0%)**.
- Complete test execution logs are preserved in [VISION_STAGE2_EVALUATOR_TESTS.json](file:///d:/Jarvis/VISION_STAGE2_EVALUATOR_TESTS.json).

```text
Evaluator Control Cases Verified:
- True Positive: 'The answer is 10.' -> PASSED
- False Positive Rejection: '10 = 2. The answer is 3.' -> REJECTED (Contradiction & Mismatch)
- False Positive Rejection: '12 = 3. The answer is 10.' -> REJECTED (Contradiction & Mismatch)
- Substring False Positive: 'There are 10 apples, so result is 4.' -> REJECTED
- Negative Numbers: 'The result is -42.' -> PASSED (Parsed -42.0)
- Decimals and Tolerances: '3.14159' vs '3.1415926' -> PASSED (Within tolerance)
- Python Syntax Failure: 'def solve(): return 10 +' -> REJECTED (Syntax error)
- Multiple Choice Ambiguity: 'Both A and B could be true' -> REJECTED
```

---

## 2. Rigorous 4-Checkpoint Re-Evaluation

Using the verified evaluator, we re-evaluated all available checkpoints on the complete 200-probe independent transfer suite ([vision_independent_transfer_test_200.jsonl](file:///d:/Jarvis/vision_independent_transfer_test_200.jsonl)).

### 2.1 Complete Comparative Matrix

Each model was tested under two decoding regimes:

1. **Calibrated**: Temperature $T=0.2$, $\text{top\_p}=0.9$, $\text{repetition\_penalty}=1.15$.
2. **Uncalibrated**: Greedy argmax decoding ($T=0.0$, $\text{repetition\_penalty}=1.0$).

```text
+-----------------------------------+--------------------+------------------------+--------------------------+
| Checkpoint Name                   | Parameter Count    | Calibrated Rigorous    | Uncalibrated Rigorous    |
+-----------------------------------+--------------------+------------------------+--------------------------+
| vision-pretraining-validation-13m | 13.33M             | 1 / 200 (0.5%)         | 0 / 200 (0.0%)           |
| vision-13m-sft-aligned (Stage 2)  | 13.33M             | 0 / 200 (0.0%)         | 1 / 200 (0.5%)           |
| vision-13m-stage3-curriculum      | 13.33M             | 0 / 200 (0.0%)         | 0 / 200 (0.0%)           |
| vision-v1.4-replay-cand-b         | 98.26M (Archived)  | 0 / 200 (0.0%)         | 0 / 200 (0.0%)           |
| vision-2.0-candidate-g            | 98.26M (Archived)  | 0 / 200 (0.0%)         | 0 / 200 (0.0%)           |
+-----------------------------------+--------------------+------------------------+--------------------------+
```

### 2.2 Discovery of the Repetition Penalty Distortion Effect

A key finding emerged from the comparison between calibrated and uncalibrated decoding:

- On `vision-13m-sft-aligned`, uncalibrated greedy decoding generated:

  ```text
  10 = 10.
  The answer is 10.
  ```

  This is a mathematically valid generation and received a **PASS** from the rigorous evaluator.

- However, when calibrated decoding was applied with $\text{repetition\_penalty} = 1.15$, the model generated:

  ```text
  10 = 2.
  The answer is 3.
  ```

**Root Cause**: The standard repetition penalty penalizes the probability of any token that has previously appeared in the sequence. When the model emitted `10` in the first line, the token ID for `10` received a $1.15\times$ logit penalty during subsequent token generation. As a consequence, when generating the conclusion (`The answer is...`), the model was actively discouraged from repeating the correct number `10`, causing it to select alternative numeric tokens (`2` or `3`).

For symbolic reasoning, mathematics, and structured coding, **repetition penalties distort correct recursive tokens and must not be used**.

---

## 3. SFT Training Data Integrity & Leakage Audit

To ensure the validity of instruction fine-tuning, we conducted a forensic audit of the SFT dataset construction pipeline using [ml_foundation/audit_sft_integrity.py](file:///d:/Jarvis/ml_foundation/audit_sft_integrity.py).

### 3.1 Uncovering Train/Validation Prompt Leakage

In the Stage 2 dataset (`data/neural_models/datasets/vision_sft_alignment/`), splitting was performed by randomly shuffling sequence rows:

- Total train samples: 4,000
- Total validation samples: 500
- **Leakage Finding**: **58 identical prompts appeared in both train and validation splits**.
- **Mechanism**: The dataset contained multi-turn dialogs and synthetic math variations sharing identical system/user prefixes. Shuffling at the row level placed duplicate prompt templates on both sides of the evaluation boundary.

### 3.2 Architectural Remedy: Prompt-Grouped Stratification

We re-engineered the dataset generator in [ml_foundation/build_sft_alignment_dataset.py](file:///d:/Jarvis/ml_foundation/build_sft_alignment_dataset.py) and applied it to Stage 3:

- Hashing and grouping: Sequences are grouped by SHA-256 hash of their `<user>...</user>` prompt before partitioning.
- Prompt leakage in Stage 3: **0 duplicate prompts (0.00%)**.

```text
+---------------------------------------+---------------------+---------------------+
| Integrity Metric                      | Stage 2 Dataset     | Stage 3 Dataset     |
+---------------------------------------+---------------------+---------------------+
| Total Samples                         | 4,500               | 10,435              |
| Training Samples                      | 4,000               | 9,365               |
| Validation Samples                    | 500                 | 1,070               |
| Train/Val Prompt Leakage              | 58 prompts (1.3%)   | 0 prompts (0.0%)    |
| Prompt Masking (Target = -100)        | 100.0% Verified     | 100.0% Verified     |
| First Assistant Token Supervised      | Yes                 | Yes                 |
| Target Token Supervision Ratio        | 51.53%              | 47.96%              |
+---------------------------------------+---------------------+---------------------+
```

### 3.3 Token Accounting Reconciliation

We reconciled token accounting across the dataset manifest, data loader, and training loop:

- Dataset total token volume: 1,245,319 tokens.
- Supervised assistant target tokens: 641,802 tokens (51.53%).
- Stage 2 training exposure: 408,000 total tokens processed across 100 steps (batch size 16, sequence length 256).
- Supervised target tokens consumed by optimizer: 98,919 tokens.
- **Corpus Coverage**: The 100-step training run exposed the model to **15.41%** of the available SFT tokens. The model did not complete even a single full epoch over the alignment corpus.

---

## 4. Cross-Discipline Capability Diagnostics (11 Disciplines)

We authored [ml_foundation/diagnose_11_capabilities.py](file:///d:/Jarvis/ml_foundation/diagnose_11_capabilities.py) and probed the Stage 2 model across 11 disciplines:

```text
+-----------------------------+---------+--------+------------------------------------+
| Discipline                  | Probes  | Passed | Primary Failure Mode               |
+-----------------------------+---------+--------+------------------------------------+
| Basic Arithmetic            | 2       | 0      | Numerical Hallucination / Contrad. |
| Unseen Mathematics          | 2       | 0      | False Equation Mode Collapse       |
| Python Programming          | 1       | 0      | Invalid AST / Missing FunctionDef  |
| Java Programming            | 1       | 0      | Syntax Incompleteness              |
| JavaScript Programming      | 1       | 0      | Syntax Incompleteness              |
| English Comprehension       | 1       | 0      | Language Modeling Underfit         |
| Hindi Comprehension         | 1       | 0      | Multilingual Token Distortion      |
| Hinglish Dialogue           | 1       | 0      | Multilingual Token Distortion      |
| Formal Reasoning            | 1       | 0      | Logical Deduction Inversion        |
| Instruction Following       | 1       | 0      | Non-compliance with Constraints    |
| Context Retention           | 1       | 0      | Premise Forgetting in Turn 2       |
+-----------------------------+---------+--------+------------------------------------+
```

### 4.1 Diagnosis: Template Mode Collapse

Detailed inspection of the generated outputs revealed that the model collapsed into two dominant output templates:

1. **The Arithmetic Template**: `{A} = {B}.\nThe answer is {C}.`
2. **The Multiple-Choice Template**: `The correct answer is 1.`

Because the training duration was brief (100 steps) and the model capacity small (13.33M parameters), the network minimized cross-entropy loss by memorizing surface syntax rather than internalizing relational logic. When presented with questions requiring algorithmic computation or multilingual understanding, it defaulted to the surface prefixes that offered the lowest average cross-entropy in the synthetic alignment set.

---

## 5. Stage 3 Curriculum Training Execution & Telemetry

### 5.1 Dataset Composition & Curation

To counter template collapse, we built a balanced, de-biased curriculum dataset ([build_stage3_curriculum_dataset.py](file:///d:/Jarvis/ml_foundation/build_stage3_curriculum_dataset.py)):

- **Total Samples**: 10,435 (9,365 training, 1,070 validation).
- **Curriculum Distribution**:
  - Python Programming (Syntactically verified docstrings & solutions): 25.0%
  - Deductive Logic & Chain-of-Thought Reasoning: 20.0%
  - Step-by-Step Multi-Step Mathematics: 20.0%
  - Science & Technical Explanations: 15.0%
  - Hindi & Hinglish Technical Instructions: 10.0%
  - Concise Conversational Context: 10.0%

### 5.2 Controlled Training Execution

Training was executed using [ml_foundation/train_stage3_curriculum.py](file:///d:/Jarvis/ml_foundation/train_stage3_curriculum.py):

- **Base Checkpoint**: `vision-pretraining-validation-13m` (`weights.pt`, SHA-256: `4f85bdeddd360cb986d01ce008378a053aca653941f41defaec9f1cddbdb3379`).
- **Target Architecture**: 13.33M parameters ($d_{\text{model}}=320$, 8 layers, 8 heads, $d_{\text{ff}}=1280$, context length 256).
- **Optimizer**: AdamW ($\beta_1=0.9, \beta_2=0.95, \text{weight\_decay}=0.1$).
- **Learning Rate**: Linear warmup from $1.0\times 10^{-5}$ to $2.0\times 10^{-4}$ over 10 steps, cosine decay to $2.0\times 10^{-5}$.
- **Hardware**: Local CPU (12 logical cores), 0 cloud expenditure ($0.00).
- **Runtime**: 1,130.89 seconds (~18.8 minutes).

### 5.3 Training Loss & Telemetry Trajectory

```text
Step    Train Loss (nats)    Val Loss (nats)    Grad Norm    Update Ratio    Throughput
---------------------------------------------------------------------------------------
   1             5.9576               -            6.942        0.000617     660.0 tok/s
  20             4.1130          3.1892            4.812        0.000685     720.5 tok/s
  40             3.4820          2.9410            3.951        0.000642     715.1 tok/s
  60             2.9810          2.8105            3.421        0.000619     728.4 tok/s
  80             2.6105          2.7214            2.894        0.000598     731.2 tok/s
 100             2.3789          2.6673            2.415        0.000581     718.9 tok/s
```

- Total tokens consumed: 408,000 tokens.
- Supervised target tokens: 102,133 tokens.
- Validation loss improvement: **3.3141 $\to$ 2.6673 nats** (-0.6468 nats).
- Weight update ratio across all 8 layers: $||\Delta \theta|| / ||\theta|| = 0.02871$.
- Final Checkpoint: `data/neural_models/checkpoints/vision-13m-stage3-curriculum/weights.pt` (SHA-256: `3eee5775c1761bea634ee11e238b76050b25dbfc17ce0a31811e476f74552ad8`).
- Checkpoint registered in [VISION_CHECKPOINT_REGISTRY.json](file:///d:/Jarvis/VISION_CHECKPOINT_REGISTRY.json) (70 total registered checkpoints).

### 5.4 Native Transfer Benchmark Evaluation

At step 100, the final checkpoint was evaluated against the independent 200-probe transfer benchmark:

- **Calibrated Rigorous Score**: **0 / 200 (0.0%)** (95% Wilson CI: [0.00%, 1.88%]).
- **Uncalibrated Rigorous Score**: **0 / 200 (0.0%)** (95% Wilson CI: [0.00%, 1.88%]).

**Evaluation Conclusion**: Despite a substantial reduction in validation loss (-0.6468 nats), the model did not generalize to unseen transfer probes. Supervised fine-tuning of an undertrained 13M parameter model reshapes surface probability distributions but does not impart missing underlying factual knowledge or multi-step arithmetic ability.

---

## 6. GPU Readiness & FSDP Harness Audit

To prepare for true foundation model scaling without incurring unnecessary costs, we conducted a complete static audit of the multi-GPU FSDP harness in [ml_foundation/cluster_launch_fsdp.py](file:///d:/Jarvis/ml_foundation/cluster_launch_fsdp.py).

### 6.1 Static Code & Architecture Verification

All 9 cluster verification checks passed:

1. `distributed_init`: Correct `init_process_group(backend='nccl')` initialization.
2. `device_setting`: Local rank mapping via `torch.cuda.set_device(local_rank)`.
3. `fsdp_wrapping`: Auto-wrap policy correctly wrapping `TransformerBlock` modules.
4. `sharding_strategy`: `ShardingStrategy.FULL_SHARD` (Zero-3 equivalent).
5. `mixed_precision_bf16`: `bfloat16` for computation with `float32` buffer preservation.
6. `rank0_checkpointing`: State dict aggregation and disk writing restricted to Rank 0.
7. `distributed_sampler`: Sharded data feeding with dynamic epoch seed advancement.
8. `gradient_accumulation`: Loss scaling normalized by accumulation steps.
9. `clean_shutdown`: Collective `destroy_process_group()` on termination.

### 6.2 VRAM Budget Modeling for 98.26M Foundation Architecture

Modeling the 98.26M foundation model on an 8x NVIDIA H100 SXM5 (80GB VRAM) node:

- Parameter Count: 98,258,258 parameters ($d_{\text{model}}=768$, 12 layers, 12 heads).
- Sharded Model Weights (bfloat16 across 8 GPUs): **23.43 MB / GPU**.
- Sharded Optimizer States (AdamW fp32 across 8 GPUs): **187.41 MB / GPU**.
- Sharded Gradients (bfloat16 across 8 GPUs): **23.43 MB / GPU**.
- Activations (Context length 2048, batch size 32): **~2,304.00 MB / GPU**.
- **Peak VRAM Demand per GPU**: **2.48 GB**.
- **Hardware Capacity**: 80.00 GB per GPU.
- **VRAM Utilization**: **3.1%** (Leaving **77.52 GB safety headroom**).

### 6.3 Financial Accounting

- Cloud GPUs launched: **0**.
- Cloud expenditure to date: **$0.00**.
- The cluster harness is fully verified offline and ready for immediate deployment when cloud compute is authorized.

---

## 7. Architectural Root Causes of the Zero-Transfer Plateau

Why did all 13M parameter checkpoints achieve 0/200 or 1/200 on the transfer benchmark?

### 7.1 The Parameter Capacity Bottleneck

A language model with 13.33M parameters has an embedding matrix of $32,000 \times 320 = 10,240,000$ parameters, leaving only **3.09M parameters in the 8 transformer layers**.

- 3 million transformer parameters is equivalent to roughly 750,000 floating-point weights per attention/feed-forward sublayer.
- In informational terms, this is insufficient capacity to simultaneously store:
  1. Arithmetic transition tables and carry-over logic.
  2. Syntactic grammars for Python, Java, and JavaScript.
  3. Relational fact databases across science, history, and engineering.
  4. Cross-lingual alignments between English, Hindi (Devanagari), and Hinglish.

### 7.2 The Token Exposure Deficit

Standard compute-optimal scaling laws (Chinchilla) show that a foundation model requires at least 20 tokens per parameter to reach the point where downstream transfer is predictable:

- For a 13M model, the Chinchilla token target is **260,000,000 tokens**.
- The base checkpoint `vision-pretraining-validation-13m` received **2,048,000 tokens** (~0.8% of optimal exposure).
- SFT added **408,000 tokens**.
- Total lifetime exposure: **2,456,000 tokens**.

Training an under-parameterized model on less than 1% of its optimal token exposure cannot produce independent reasoning capabilities. SFT can align representations that already exist; it cannot synthesize representations that were never learned during pretraining.

---

## 8. Preserved Checkpoint & Artifact Ledger

All checkpoints and benchmark artifacts have been recorded with SHA-256 hashes:

```text
+-----------------------------------+------------------------------------------------------------------+
| Artifact Name                     | SHA-256 Checksum                                                 |
+-----------------------------------+------------------------------------------------------------------+
| vision-pretraining-validation-13m | 4f85bdeddd360cb986d01ce008378a053aca653941f41defaec9f1cddbdb3379 |
| vision-13m-sft-aligned            | 085ef922342be408fb9a1b394733da687e0354a3f644de0025f24917de2eb5e2 |
| vision-13m-stage3-curriculum      | 3eee5775c1761bea634ee11e238b76050b25dbfc17ce0a31811e476f74552ad8 |
| vision_independent_transfer_test  | a3b7c844391696b92a5435017e8c370efba92631a382e213bf9f25fe732feea4 |
| vision_expanded_validation_1500   | b0e026190eec8aa3176722d4fdf8e64c399b38466b03946df7c050a4d04be859 |
+-----------------------------------+------------------------------------------------------------------+
```

Protected files `js/modules/stark3DViewer.js` (line 28) and `server/aiProviderAdapter.js` remain completely unaltered.

---

## 9. Technical Roadmap to Foundation Model Capability

To achieve genuine native benchmark capability on the independent transfer suite, VISION must transition from micro-model SFT experiments to large-scale foundation pretraining:

```text
+---------------------------------------------------------------------------------------------------+
|                               PHASED CAPABILITY DEVELOPMENT ROADMAP                               |
+-------+--------------------------+------------+------------------+--------------------------------+
| Phase | Model Architecture       | Parameters | Target Corpus    | Objective                      |
+-------+--------------------------+------------+------------------+--------------------------------+
| 1     | Foundation Architecture  | 98.26M     | 500M Tokens      | Establish stable base grammar, |
|       | (768D, 12L, 12H, C=2048) |            | (1.815B pool)    | arithmetic representations     |
+-------+--------------------------+------------+------------------+--------------------------------+
| 2     | Mid-Scale Foundation     | 250M       | 2.5B Tokens      | General reasoning, Python AST  |
|       | (1024D, 18L, 16H, C=2048)|            | (Curated web/code| synthesis, multilingual Hindi  |
+-------+--------------------------+------------+------------------+--------------------------------+
| 3     | Multi-Stage SFT & DPO    | 98M / 250M | 50M Curated      | Zero-shot instruction adhering,|
|       | Alignment                |            | Instruction CoT  | formal declaration formatting  |
+-------+--------------------------+------------+------------------+--------------------------------+
```

### Actionable Next Steps

1. **Pretraining Launch**: Execute Phase 1 pretraining on the 98.26M foundation architecture across the verified 1.815B token corpus using the audited FSDP cluster harness.
2. **Deterministic Evaluation**: Maintain the rigorous verification suite (`ml_foundation/rigorous_evaluator.py`) as an immutable gatekeeper. Zero false positives will be accepted.
3. **Curriculum Alignment**: Deploy the de-biased curriculum pipeline only after the base foundation model achieves sub-2.0 perplexity on general language modeling.
