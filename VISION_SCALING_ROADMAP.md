# VISION — Empirical Foundation Scaling Roadmap & Capability Gates

## Executive Summary

This roadmap establishes the staged scaling milestones for advancing the **VISION Foundation Model** across empirical parameter and dataset thresholds, moving from micro-model prototyping to billion-parameter foundation scale.

Following our core directive: **we do not train models simultaneously; every scaling step must be verified with measurable capability improvements on unseen benchmarks before advancing to the next parameter tier**.

```text
+-------------------------------------------------------------------------------------------------------------+
|                                    STAGED FOUNDATION MODEL SCALING ROADMAP                                  |
+-------+--------------------+--------------+---------------+-------------------+-----------------------------+
| Stage | Model Tier         | Target Params| Token Target  | Target Perplexity | Capability Exit Gate        |
+-------+--------------------+--------------+---------------+-------------------+-----------------------------+
| S-1   | 30M Micro-Baseline | 30.55M       | 600M Tokens   | PPL < 15.2 nats   | > 15% Unseen Math/Code Pass |
| S-2   | 50M Compact Scale  | 53.64M       | 1.0B Tokens   | PPL < 13.0 nats   | > 20% Unseen Math/Code Pass |
| S-3   | 100M Core Scale    | 99.31M       | 2.0B Tokens   | PPL < 11.2 nats   | > 30% Unseen Math/Code Pass |
| S-4   | 250M Scale Up      | 257.60M      | 5.0B Tokens   | PPL < 9.5 nats    | > 45% Unseen Math/Code Pass |
| S-5   | 500M Advanced      | 501.22M      | 10.0B Tokens  | PPL < 8.2 nats    | > 55% Unseen Math/Code Pass |
| S-6   | 1B Frontier Scale  | 1,135.28M    | 20.0B Tokens  | PPL < 7.0 nats    | > 65% Unseen Math/Code Pass |
+-------+--------------------+--------------+---------------+-------------------+-----------------------------+
```

---

## 1. Staged Execution Milestones

### Milestone 1: The 30M Reference Pilot (Stage S-1)

- **Objective**: Establish whether moving from $d=320$ to $d=512$ with standardized $d_k=64$ and 16,384 vocabulary solves the arithmetic routing failure on 600M tokens.
- **Local vs Cloud**: Can run as an overnight small-batch verification experiment or on a single GPU instance.
- **Gating Metric**: Must achieve at least 15% functional accuracy on unseen math and Python unit tests (breaking the 0.0% ceiling of the 13M model).

### Milestone 2: The 100M Foundation Pretraining (Stage S-3)

- **Objective**: Pretrain the core 99.31M parameter architecture ($d_{\text{model}}=768, L=14, \text{vocab}=16,384$) on the full 2.0 Billion token curated dataset.
- **Hardware Architecture**: 8x NVIDIA A100-80GB FSDP cluster.
- **Gating Metric**:
  1. Validation cross-entropy loss $< 2.40$ nats (Perplexity $< 11.0$).
  2. Unseen benchmark functional accuracy $\ge 30.0\%$ prior to SFT.
  3. Zero AST dummy function generation (`def find_x(x): return 0` completely replaced by functional logic).

### Milestone 3: Post-Pretraining Alignment (SFT & DPO)

- **Objective**: Align the pretrained 100M foundation model with multi-turn instruction following, polyglot coding, and Devanagari translation.
- **Gating Metric**: Native benchmark accuracy exceeds 50.0% without assistance from external tools or APIs.

### Milestone 4: Advance to 250M / 500M Parameters

- Only after Stage S-3 satisfies all exit gates will dataset expansion to 5B+ tokens and model scaling to 257.6M parameters be authorized.

---

## 2. Invariant Rules of Scaling

1. **No Skip-Scaling**: Never jump to 500M or 1B parameters if the 100M model fails to demonstrate verified learning on unseen held-out problems.
2. **Exposure Accounting**: Actual optimizer updates and tokens consumed must be recorded per step. Dataset size on disk must never be cited as model exposure.
3. **No Benchmark Shortcuts**: Evaluation must use independent unit tests and contradiction disqualification.
