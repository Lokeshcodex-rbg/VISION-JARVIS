# VISION — Compute Feasibility & Hardware Scaling Analysis

## Executive Summary

This report establishes the computational feasibility, memory requirements, and hardware scaling boundaries for training the VISION Foundation Model.

Following our strict directive: **the local Intel laptop must not be treated as a suitable device for billion-token foundation pretraining**. Local resources are strictly reserved for data curation, tokenizer training, unit tests, and lightweight evaluation.

```text
+-------------------------------------------------------------------------------------------------------------+
|                                    COMPUTE PROFILE ACROSS MODEL SCALES                                      |
+-------+--------------------+--------------+---------------+-------------------+-----------------------------+
| Scale | Model Parameters   | Training Data| FLOPs (6*N*D) | Local CPU Time    | 8x A100 GPU Cluster Time    |
+-------+--------------------+--------------+---------------+-------------------+-----------------------------+
| 30M   | 30.55M Parameters  | 600M Tokens  | 1.10e17 FLOPs | 34.7 Days (200 t/s)| 3.7 Hours (45k t/s)        |
| 100M  | 99.31M Parameters  | 2.0B Tokens  | 1.19e18 FLOPs | 115.7 Days        | 4.6 Hours (120k t/s)        |
| 250M  | 257.60M Parameters | 5.0B Tokens  | 7.73e18 FLOPs | 289.4 Days        | 7.3 Hours (190k t/s on 16x) |
| 500M  | 501.22M Parameters | 10.0B Tokens | 3.01e19 FLOPs | 578.7 Days        | 14.6 Hours (190k t/s on 16x)|
| 1B    | 1,135.28M Params   | 20.0B Tokens | 1.36e20 FLOPs | 1,157.4 Days      | 29.8 Hours (380k t/s on 32x)|
+-------+--------------------+--------------+---------------+-------------------+-----------------------------+
```

---

## 1. Local Hardware Limits & Role Definition

### Verified Local Hardware (Re-Audited)

- **CPU**: 13th Gen Intel Core i5-1335U (10 cores: 2 P-cores, 8 E-cores; 12 logical processors).
- **RAM**: 7.69 GB visible physical RAM (~892 MB available).
- **GPU**: Intel Iris Xe Integrated Graphics (2.15 GB shared adapter memory, No CUDA).
- **Storage**: D: Drive (195.31 GB total, 61.57 GB free).
- **Measured CPU Throughput**: 180 to 220 tokens per second on 13M models at batch size 16.

### Local Compute Boundary

At 200 tokens/sec, processing 2.0 Billion tokens on the local CPU requires:
$$\frac{2,000,000,000 \text{ tokens}}{200 \text{ tokens/sec}} = 10,000,000 \text{ seconds} \approx \mathbf{115.7 \text{ continuous days}}.$$

Attempting billion-token foundation model pretraining on an Intel ultrabook CPU would throttle thermal envelopes, exhaust the 892 MB available physical RAM, cause paging thrashing, and take nearly four months for a single run.

**Approved Local Operations**:

- Raw corpus downloading, schema parsing, and MinHash deduplication.
- Tokenizer training (BPE vocabulary creation).
- Checkpoint tensor auditing, SHA-256 verification, and parameter accounting.
- Deterministic inference and test execution against benchmark suites.
- Micro-model smoke testing ($\le 500\text{K}$ tokens).

---

## 2. Memory Architecture & Distributed Sharding (100M Scale)

For the 99.31M parameter core foundation model, memory consumption is calculated across training states:

```text
+-------------------------------------------------------------------------------------------------------------+
|                                99.31M MODEL DISTRIBUTED MEMORY ALLOCATION                                   |
+------------------------------------+--------------------------+-----------------------+---------------------+
| Memory State Component             | Precision / Multiplier   | Full Model (1 GPU)    | Sharded FSDP (8 GPUs|
+------------------------------------+--------------------------+-----------------------+---------------------+
| Model Weights                      | BF16 (2 bytes / param)   | 198.6 MB              | 24.8 MB             |
| Gradients                          | BF16 (2 bytes / param)   | 198.6 MB              | 24.8 MB             |
| AdamW FP32 Master Weights          | FP32 (4 bytes / param)   | 397.2 MB              | 49.7 MB             |
| AdamW 1st Moment Buffer            | FP32 (4 bytes / param)   | 397.2 MB              | 49.7 MB             |
| AdamW 2nd Moment Buffer            | FP32 (4 bytes / param)   | 397.2 MB              | 49.7 MB             |
+------------------------------------+--------------------------+-----------------------+---------------------+
| TOTAL STATIC OPTIMIZER FOOTPRINT   | 16 bytes / param         | 1,588.8 MB (1.59 GB)  | 198.6 MB / GPU      |
| Dynamic Activations (SeqLen 2048)  | Gradient Checkpointing   | ~4.5 GB / GPU         | ~4.5 GB / GPU       |
+------------------------------------+--------------------------+-----------------------+---------------------+
| PEAK VRAM PER GPU AT BATCH SIZE 16 | -                        | ~6.1 GB VRAM          | ~4.8 GB VRAM        |
+------------------------------------+--------------------------+-----------------------+---------------------+
```

**Memory Verdict**: The 99.31M model fits comfortably within consumer GPUs (e.g., 16GB RTX 4080 / 24GB RTX 4090) and requires a tiny fraction of an enterprise A100/H100 80GB GPU.
