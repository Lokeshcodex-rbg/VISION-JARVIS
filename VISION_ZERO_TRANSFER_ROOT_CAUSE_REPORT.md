# VISION Zero-Transfer Root-Cause Forensic Report

## Executive Summary

During the controlled empirical scaling benchmark across model architectures (13.33M, 27.76M, and 98.26M parameters) and historical checkpoints (`vision-v1.4` and `vision-2.0-candidate-g`), all five evaluated checkpoints registered **0/200 (0.0% accuracy)** on the independent transfer benchmark (`vision_independent_transfer_test_200.jsonl`).

This report provides the exhaustive root-cause diagnosis. The forensic investigation confirms that the 0/200 result is **not an evaluator bug**—the evaluator verifier achieves 100.0% accuracy on positive controls and 0.0% on negative controls. Rather, the complete transfer failure is the compounded result of:
1. **Severe Undertraining in Scaling Runs**: The 25M model was initialized randomly and trained for only 50 optimizer steps (1,600 samples, ~200k tokens); the 100M model was trained for only 25 steps.
2. **Template Overfitting & Format Mismatch**: Historical checkpoints (`v1.4`, `Candidate G`) overfitted to narrow synthetic templates and suffered immediate unigram collapse when exposed to natural phrased transfer probes.
3. **Inference Chat-Template Boundary Collapse**: The prompt ending `<assistant>` caused greedy decoders to predict Token ID 6 (`<assistant>`), which stripped to an empty string under standard token decoding.
4. **Context Length Truncation (128 Tokens)**: Over 89.01% of dataset samples were truncated, removing the supervisory signal from multi-step reasoning trajectories.

---

## 1. Forensic Audit of the Evaluator

To isolate whether the evaluation harness contributed to the zero score, `verify_probe()` was subjected to four empirical controls:

| Control Test | Input Tested | Result | Assessment |
|:---|:---|:---:|:---|
| **Positive Control A** | Exact expected answer string | 200/200 (100.0%) | Zero false negatives. Valid answers are accurately recognized. |
| **Positive Control B** | Natural language conversational wrapper | 200/200 (100.0%) | Resilient to natural prose prefixes and Markdown blocks. |
| **Negative Control A** | Out-of-domain random nonsense | 0/200 (0.0%) | Zero false positives. Strict domain boundaries maintained. |
| **Negative Control B** | Uniform numeric anchor ('0') | 0/200 (0.0%) | Numeric verifier does not over-match degenerate digits. |

The evaluation logic itself is mathematically and logically sound. However, token-level inspection at the prompt interface revealed a critical boundary interaction:

```python
# Evaluator prompt format:
formatted_prompt = f"<bos><user>{prompt}</user><assistant>"
```

In `JarvisBPE`, Token ID 6 is `<assistant>`. For `vision-v1.4` and `Candidate G`, the model assigned top-1 logit probability to Token 6 immediately after `<assistant>`. Because `tokenizer.decode()` has `skip_special_tokens=True` by default, generating Token 6 resulted in an empty string (`""`), triggering `EMPTY_GENERATION` failures.

---

## 2. Root Cause Analysis Across Core Dimensions

### Dimension 1: Severe Undertraining of Scaling Models

In the scaling comparison experiment:
- **27.76M Model (`vision-25m-compact-foundation`)**:
  - Initialized from **random weights**.
  - Trained for **50 optimizer updates** (batch size 16, gradient accumulation 2 = 32 sequences/step = 1,600 samples).
  - Out of 23.57M tokens in the balanced dataset, the model was exposed to only ~200,000 tokens (0.85% of the dataset).
  - Training loss began at 9.38 and only descended to 8.42. The model had not learned basic English vocabulary or grammar, let alone multi-step problem solving.
- **98.26M Model (`vision-100m-scaling-experiment`)**:
  - Initialized from `vision-100m-stage4-curated`.
  - Trained for **25 optimizer updates** (800 samples, ~100,000 tokens).
  - Mode collapse occurred, with the model repeatedly generating newline characters (`\n\n\n`) and numbers (`22220000`).

### Dimension 2: Narrow Template Memorization in Historical Checkpoints

Historical checkpoints (`vision-v1.4`, `Candidate G`, and `13m-curriculum-breakthrough`) were evaluated on the independent transfer benchmark:
- During curriculum training, arithmetic was trained with rigid synthetic prefixes:
  `"Perform the multi-step arithmetic computation: {a} * {b} - {c}"`
  with responses formatted as:
  `"Step 1: Compute product...\nFinal Answer: {ans}"`
- The independent transfer test set formulated prompts naturally:
  `"Compute the exact value of (7 + 10) - 7."`
- The models exhibited **zero generalization across syntactical variations**. Instead of computing the arithmetic, the models emitted repetitive unigram loops (`domdomdom...` or `circ circ circ...`).

### Dimension 3: Sequence Length Truncation at 128 Tokens

- The balanced dataset has a mean sample length of **263.1 BPE tokens** (median 256, p90 422).
- At `max_seq_len = 128`, **89.01% of all samples were truncated**.
- For multi-step reasoning and polyglot code examples, the final answer and concluding code logic were truncated, leaving only the partial preamble during training.
- Consequently, supervised target loss was computed on incomplete sentence fragments rather than cohesive conclusions.

### Dimension 4: Document vs. Instruction Sample Mixing

- Pillar 1 (General Language & Science) was formatted as raw pretraining documents (`<bos>{doc_text}<eos>`) without `<user>` or `<assistant>` tags.
- In these samples, no assistant masking was applied, and loss was computed across all tokens.
- When mixed into tiny 50-step runs, the model alternated between unmasked causal pretraining and masked instruction tuning, causing gradient interference before either task could stabilize.

---

## 3. Systematic Diagnostic Summary of Checkpoints

| Checkpoint | Parameters | Training Exposure | Top-1 Predicted Token | Output Behavior | Primary Failure Mode |
|:---|:---:|:---:|:---:|:---|:---|
| `vision-v1.4-calibrated-local` | 13.33M | Curriculum Baseline | `<assistant>` (ID 6) | `domdomdomdomCaseCase...` | Special token repeat & degenerate loop |
| `vision-2.0-candidate-g` | 13.33M | Curriculum Baseline | `<assistant>` (ID 6) | `circ circ circ circ thing...` | Special token repeat & degenerate loop |
| `vision-13m-scaling-experiment` | 13.33M | 50 steps (1,600 samples) | `To` (ID 1039) | `To the the the the number...` | Repetitive n-gram loop |
| `vision-25m-compact-foundation` | 27.76M | 50 steps (scratch) | `The` (ID 433) | `The 1. \n\n # \n\n 2. ...` | Random init undertrained collapse |
| `vision-100m-scaling-experiment` | 98.26M | 25 steps | `\n` (ID 33) | `\n\n\n#\n\n22220000...` | Mode collapse & newline spam |

---

## 4. Remediation and Recovery Roadmap

To overcome the zero-transfer barrier and establish authentic capabilities:

1. **Repaired Generation Engine**:
   - Apply `repetition_penalty = 1.05` and `no_repeat_ngram_size = 4` to prevent degenerate unigram collapse.
   - Configure stop tokens on `</assistant>` and `<eos>` to ensure prompt-aligned termination.
2. **Substantial Recovery Training Run**:
   - Select the 13.33M architecture (`vision-13m-curriculum-breakthrough`) as the primary viable candidate for CPU execution.
   - Execute **150 optimizer updates** on the balanced dataset (4,800 sequences, >600k tokens).
   - Implement Cosine Annealing with linear warmup (15 steps) and explicit weight decay exclusion for 1D parameters.
3. **Continuous Transfer Tracking**:
   - Evaluate on the 200-probe independent transfer benchmark at steps 0, 50, 100, and 150 to observe whether transfer capability emerges or requires architectural adaptations.
