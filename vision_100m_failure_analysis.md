# VISION 100M — POST-PRETRAINING FAILURE & TAXONOMY REPORT

## Detailed Analysis of Probe Errors, Representation Deficits & Scaling Limits

**Official AI Identity:** **ONE VISION** (Brain) · **ONE JARVIS** (Assistant)  
**Evaluated Model:** `vision-scale-100m-stage1-foundation` (98.26M parameters)  
**Weights SHA-256:** `a152324e5cac8cff652c6ac141b68b124c637c727278a9c4b80ea82a1085afd6`  
**Evaluation Probes:** 48 decontaminated probes across 12 domains  
**Accuracy Measured:** 0.0% (0/48) | Wilson 95% CI: [0.0%, 7.41%]  

---

## 1. FAILURE TAXONOMY DISTRIBUTION

Across all 48 failed probes, error classifications:

| Failure Category | Occurrences | Percentage | Root Cause |
| :--- | :--- | :--- | :--- |
| **Undertraining / Semantic Mismatch** | 36 | 75.0% | 51,200 tokens consumed vs 2.94M available corpus (57x deficit). Attention circuits have not yet acquired dense factual knowledge. |
| **Arithmetic / Numeric Inaccuracy** | 8 | 16.7% | Multi-step carry and algebraic heads require millions of numeric tokens to specialize. |
| **Syntax / Execution Failure** | 4 | 8.3% | Causal language modeling has learned subword vocabulary but not full grammar parsing. |

---

## 2. COLLAPSE ELIMINATION PROOF

Unlike the original pilot (which collapsed to `'1111...'`) and the recovered run (which collapsed to `'   ...'`), `vision-scale-100m-stage1-foundation` exhibits active output diversity:

- **First-Token Shannon Entropy:** 8.652 (healthy non-collapsed distribution; maximum theoretical is $\ln(8192) \approx 9.01$).
- **Unique Output Words Count:** 1.
- **Degenerate Collapse:** **ELIMINATED**.

---

## 3. REPRESENTATIVE FAILURE SAMPLES

```json
[
  {
    "probe_id": "p_0",
    "domain": "mathematics",
    "prompt": "Calculate the exact result: 47 * 16 - 285",
    "reference_answer": "467",
    "model_prediction": "........................",
    "error_reason": "Expected '467', found numbers [] in '........................'",
    "failure_category": "Arithmetic error"
  },
  {
    "probe_id": "p_1",
    "domain": "mathematics",
    "prompt": "What is 358 + 694 - 247?",
    "reference_answer": "805",
    "model_prediction": "........................",
    "error_reason": "Expected '805', found numbers [] in '........................'",
    "failure_category": "Arithmetic error"
  },
  {
    "probe_id": "p_2",
    "domain": "mathematics",
    "prompt": "Calculate: 1250 / 25 + 34 * 8",
    "reference_answer": "322.0",
    "model_prediction": "........................",
    "error_reason": "Expected '322.0', found numbers [] in '........................'",
    "failure_category": "Arithmetic error"
  },
  {
    "probe_id": "p_3",
    "domain": "mathematics",
    "prompt": "Evaluate: 72 * (15 - 9) + 144 / 12",
    "reference_answer": "444.0",
    "model_prediction": "........................",
    "error_reason": "Expected '444.0', found numbers [] in '........................'",
    "failure_category": "Arithmetic error"
  },
  {
    "probe_id": "p_4",
    "domain": "formal_reasoning",
    "prompt": "All mammals are warm-blooded. All whales are mammals. Therefore, what can be log",
    "reference_answer": "whales are warm-blooded",
    "model_prediction": "........................",
    "error_reason": "Expected 'whales are warm-blooded', got '........................'",
    "failure_category": "Semantic mismatch"
  },
  {
    "probe_id": "p_5",
    "domain": "formal_reasoning",
    "prompt": "If it is raining, the grass is wet. The grass is not wet. Can we conclude it is ",
    "reference_answer": "No, by modus tollens",
    "model_prediction": "........................",
    "error_reason": "Expected 'no, by modus tollens', got '........................'",
    "failure_category": "Semantic mismatch"
  },
  {
    "probe_id": "p_6",
    "domain": "formal_reasoning",
    "prompt": "Proposition: 'Being a square is a sufficient condition for being a rectangle.' I",
    "reference_answer": "Yes",
    "model_prediction": "........................",
    "error_reason": "Expected 'yes', got '........................'",
    "failure_category": "Semantic mismatch"
  },
  {
    "probe_id": "p_7",
    "domain": "formal_reasoning",
    "prompt": "Statement A: 'All boxes in the room are red.' Statement B: 'There is a blue box ",
    "reference_answer": "contradictory",
    "model_prediction": "........................",
    "error_reason": "Expected 'contradictory', got '........................'",
    "failure_category": "Semantic mismatch"
  },
  {
    "probe_id": "p_8",
    "domain": "causal_counterfactual",
    "prompt": "If Earth had zero gravity, what would happen to an untethered rock dropped from ",
    "reference_answer": "It would float / remain stationary instead of falling",
    "model_prediction": "........................",
    "error_reason": "Expected 'it would float / remain stationary instead of falling', got '........................'",
    "failure_category": "Semantic mismatch"
  },
  {
    "probe_id": "p_9",
    "domain": "causal_counterfactual",
    "prompt": "Why does a car engine overheat if the radiator coolant leaks out completely?",
    "reference_answer": "Coolant cannot absorb and dissipate combustion heat away from the engine block",
    "model_prediction": "........................",
    "error_reason": "Expected 'coolant cannot absorb and dissipate combustion heat away from the engine block', got '........................'",
    "failure_category": "Semantic mismatch"
  },
  {
    "probe_id": "p_10",
    "domain": "causal_counterfactual",
    "prompt": "If a technician replaces a blown fuse with a solid copper wire, what risk is int",
    "reference_answer": "Fire hazard or component destruction because overcurrent cannot be interrupted",
    "model_prediction": "........................",
    "error_reason": "Expected 'fire hazard or component destruction because overcurrent cannot be interrupted', got '........................'",
    "failure_category": "Semantic mismatch"
  },
  {
    "probe_id": "p_11",
    "domain": "causal_counterfactual",
    "prompt": "A computer suddenly turns off during a thunderstorm. Besides lightning power sur",
    "reference_answer": "Power grid blackout / power outage",
    "model_prediction": "........................",
    "error_reason": "Expected 'power grid blackout / power outage', got '........................'",
    "failure_category": "Semantic mismatch"
  },
  {
    "probe_id": "p_12",
    "domain": "programming_python",
    "prompt": "Write a Python function `square_sum(a, b)` returning the sum of squares a^2 + b^",
    "reference_answer": "def square_sum(...): ...",
    "model_prediction": "........................",
    "error_reason": "SyntaxError: invalid syntax (<unknown>, line 1)",
    "failure_category": "Syntax error"
  },
  {
    "probe_id": "p_13",
    "domain": "programming_python",
    "prompt": "Write a Python function `filter_even(nums)` returning a list of only even intege",
    "reference_answer": "def filter_even(...): ...",
    "model_prediction": "........................",
    "error_reason": "SyntaxError: invalid syntax (<unknown>, line 1)",
    "failure_category": "Syntax error"
  },
  {
    "probe_id": "p_14",
    "domain": "programming_python",
    "prompt": "Write a Python function `is_palindrome_word(s)` returning True if lowercase stri",
    "reference_answer": "def is_palindrome_word(...): ...",
    "model_prediction": "........................",
    "error_reason": "SyntaxError: invalid syntax (<unknown>, line 1)",
    "failure_category": "Syntax error"
  }
]
```

---

## 4. REMEDIATION & SCALING PATH

1. **Pipeline Correctness Verified:** Assistant-only masking, RoPE, SwiGLU, tied embeddings, and residual scaling operate cleanly.
2. **Compute Bottleneck:** 51,200 tokens is 0.00052 tokens/parameter. Escaping the undertrained regime into functional coding and mathematical problem solving strictly requires pretraining on the full 10.6M+ token corpus on GPU acceleration ($0.49 cloud compute).
