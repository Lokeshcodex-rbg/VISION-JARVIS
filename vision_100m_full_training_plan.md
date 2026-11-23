# VISION 100M — MASTER FOUNDATION MODEL TRAINING & ENGINEERING PLAN

## Complete Architecture Specifications, Multi-Stage Corpus Expansion, Optimization Dynamics & Benchmark Governance

**Official AI Identity:** **ONE VISION** (Foundation Model Brain) · **ONE JARVIS** (Unified Assistant)  
**Workspace:** `D:\Jarvis`  
**Git Branch:** `stark-frontier-capabilities`  
**Head Commit:** `240cbbc`  
**Architecture Specification:** `vision-scale-100m` (98,258,258 Trainable Parameters)  
**Execution Objective:** Transition from local CPU diagnostic verification to full foundation model pretraining  

---

## 1. CORE ARCHITECTURAL INVARIANT: ONE VISION · ONE JARVIS

The core identity of the system is strictly preserved across all phases of training:

1. **ONE VISION:** A single foundation model architecture serving as the intelligence engine.
2. **ONE JARVIS:** The unified assistant interface orchestrating Windows desktop automation, live web search, phone calling, and persistent user memory.
3. **No Fragmentation:** There are no competing model variants or separate production assistants. Checkpoints (`vision-100m-foundation`, `vision-100m-recovered`, `vision-100m-stage1-foundation`) are strictly version-controlled internal research snapshots.
4. **Transparent Production Routing:** Gemini remains the production primary until VISION satisfies all independently verified acceptance criteria.

---

## 2. FOUNDATION MODEL ARCHITECTURE SPECIFICATION

The 98.26M architecture balances depth, representational width, and memory footprint:

| Dimension / Component | Specification | Technical Rationale |
| :--- | :--- | :--- |
| **Total Trainable Parameters** | **98,258,258** (~100M) | Verified mathematically via parameter census. |
| **Language Transformer Parameters** | **94,394,112** (96.07%) | Core language, coding, reasoning, and math engine. |
| **Vision ViT Encoder Parameters** | **3,194,444** (3.25%) | 4-layer Vision Transformer (patch size 8, dim 256). |
| **Audio Classifier Parameters** | **669,702** (0.68%) | Audio feature projection and intent routing. |
| **Transformer Decoder Layers** | **14 Layers** | Balanced depth for deep contextual reasoning. |
| **Hidden Dimension ($d_{\text{model}}$)** | **768** | Standard width enabling stable representation learning. |
| **Query Attention Heads ($n_{\text{heads}}$)** | **12 Heads** | Multi-head attention ($d_{\text{head}} = 64$). |
| **Key/Value Heads ($n_{\text{kv\_heads}}$)** | **4 Heads (GQA)** | Grouped-Query Attention reducing KV cache memory by 3x. |
| **Feed-Forward Dimension ($d_{\text{ff}}$)** | **2,048 (SwiGLU)** | Gated SwiGLU activation for superior nonlinear capacity. |
| **Maximum Context Window** | **2,048 Tokens** | Positional support up to 2K tokens via RoPE ($\theta=10,000$). |
| **Normalization Layer** | **RMSNorm ($\epsilon=10^{-5}$)** | Root Mean Square Layer Normalization for stability. |
| **Weight Tying** | `lm_head.weight is tok_emb.weight` | Embeddings and output projection tied (saves 6.29M params). |
| **Vocabulary Size** | **8,192 BPE Tokens** | JarvisBPE tokenizer (subwords across EN, Code, HI, Hinglish). |
| **Residual Initialization** | $\sigma = 0.02 / \sqrt{2 \times 14} \approx 0.00378$ | Prevents variance growth in deep residual streams. |

---

## 3. STAGED CORPUS EXPANSION ROADMAP

The existing local corpus reservoir on `D:\Jarvis\data\corpus_raw` comprises **26 verified repositories totaling 6.36 GB of compressed parquet data (~1.5B+ tokens)**:

```text
================================================================================
STAGED EXPANSION MILESTONES:
- Stage A:  50,000,000 Measured Usable Tokens  (Curated Core Foundation)
- Stage B: 100,000,000 Measured Usable Tokens  (Expanded Multi-Turn Instruction)
- Stage C: 250,000,000 Measured Usable Tokens  (Full Code & Academic Ingestion)
- Stage D: 500,000,000 Measured Usable Tokens  (Comprehensive Multilingual Reservoir)
- Stage E: 1,000,000,000+ Measured Usable Tokens (Chinchilla Semi-Optimal Foundation)
================================================================================
```

### Domain Balance Targets (Stage A - 50M Tokens)

- **Mathematics & Derivations (28.0% / 14M Tokens):** FineMath 4+, NuminaMath CoT, Orca Math 200k, GSM8k.
- **Programming & Software Engineering (22.0% / 11M Tokens):** Magicoder OSS/Evol, CommitPackFT (SWE, C, TS, SQL), SC2 Python Exec.
- **Science & Technical Reasoning (22.0% / 11M Tokens):** Cosmopedia (OpenStax, KhanAcademy, Wikihow), WebInstruct STEM.
- **Multilingual Hindi & Hinglish (16.0% / 8M Tokens):** Sangraha Hindi, Sangraha Hinglish, CognitiveLab Hindi Instruct.
- **General Language & Tool Calling (12.0% / 6M Tokens):** FineWeb-Edu sample slice, Glaive Function Calling v2, Hermes Function Calling v1.

---

## 4. DATASET QUALITY, DECONTAMINATION & GOVERNANCE

Every sample admitted into the VISION training pipeline must satisfy strict quality protocols:

1. **Permissive Licensing Provenance:** Allowlist restricted to Apache-2.0, MIT, ODC-By-1.0, and CC-BY-4.0. No proprietary or commercial restricted data.
2. **Deterministic Deduplication:** SHA-256 hashing for exact duplicates combined with 32-permutation MinHash LSH at 0.85 Jaccard threshold.
3. **Decontamination Seal:** Zero prompt overlap with sealed test probes in `vision_independent_validation_dataset.jsonl` (verified 0/240 prompt leakage).
4. **Token Length Management:** Default pretraining sequence length set to **256 tokens**, capturing over 75% of complete responses without truncation.
5. **Prompt-to-Response Accounting:** Target prompt-to-response token ratio bounded between 0.35 and 0.45, ensuring over 70% of consumed tokens are useful target response tokens.

---

## 5. TRAINING PIPELINE & OPTIMIZATION MECHANICS

The pretraining engine enforces the remediated learning mechanics established during the forensic audit:

### Mathematical Next-Token Masking

```text
Sequence Layout:
X = [<bos>, <user>, inst_0, ..., inst_M, </user>, <assistant>, resp_0, ..., resp_N, </assistant>, <eos>]
Y = [ <user>, inst_0, ..., inst_M, </user>, <assistant>, resp_0, ..., resp_N, </assistant>, <eos>, <pad> ]
```

- Let $i = \text{asst\_pos}$ such that $X[i] = \text{<assistant>}$.
- Masking rule: `for k in range(asst_pos): Y[k] = pad_id`.
- The transition target $Y[i] = \text{resp}_0$ (first response token) is **preserved**, ensuring non-zero gradient flow on the prompt-to-response transition.
- All tokens after $\text{resp}_N$ (`</assistant>`, `<eos>`) remain active, teaching the model proper stopping criteria.

### Optimization Hyperparameters

- **Optimizer:** AdamW ($\beta_1=0.9, \beta_2=0.95, \epsilon=10^{-8}$, weight decay 0.01).
- **Learning Rate Schedule:** Warmup for 10% of steps to peak $2.5 \times 10^{-4}$, followed by cosine decay to $2.5 \times 10^{-5}$.
- **Gradient Clipping:** Maximum global norm 1.0.
- **Effective Batch Size:** 16 sequences ($2 \text{ micro-batch} \times 8 \text{ accumulation steps} \times 256 \text{ tokens} = 4,096 \text{ tokens per update}$).

---

## 6. HARDWARE REQUIREMENTS & COMPUTE EXECUTION STRATEGY

### Local Hardware Reality (Intel Core i5-1335U, 7.69 GB RAM, No CUDA)

- **Local Throughput:** Measured empirically at **12.9 to 82.0 tokens/second**.
- **Memory Footprint:** 1.82 GB active working set (comfortably fits in 7.69 GB host RAM).
- **Local Constraint:** Training 10.6M tokens locally requires **228.4 hours (~9.5 days)** of continuous CPU pinning. Training 50M tokens requires **1,076 hours (~45 days)**.
- **Local Role:** Diagnostic runs, pipeline verification, data curation, and short staged pilots.

### Accelerated Compute Strategy (GPU Cluster Cloud)

- **Single NVIDIA RTX 4090 (24 GB):** Ingests 10.6M tokens in **11.8 minutes** ($0.49 USD compute cost); 50M tokens in **55.6 minutes** ($2.32 USD).
- **8x NVIDIA H100 Cluster:** Ingests 10.6M tokens in **29.5 seconds** ($0.25 USD); 100M tokens in **4.6 minutes** ($2.32 USD); 1B tokens in **46.3 minutes** ($23.15 USD).
- **Financial Governance:** Paid cloud compute will **never be initiated without explicit user approval**.

---

## 7. STAGE 2 SUPERVISED FINE-TUNING & PREFERENCE OPTIMIZATION

Following pretraining convergence:

1. **Supervised Fine-Tuning (SFT):**
   - High-density instruction tuning across 13,653 curated multi-domain demonstrations.
   - Reduced learning rate ($1.0 \times 10^{-5}$) with 15% pretraining replay buffer to prevent catastrophic forgetting.
2. **Direct Preference Optimization (DPO):**
   - 17 verified preference pairs targeting format adherence, negative constraints, PID control theory, SQL precision, and calibrated refusal on future events.
   - Applied strictly as a post-SFT refinement, not as a substitute for pretraining.

---

## 8. INDEPENDENT ACCEPTANCE GATES & PRODUCTION CRITERIA

Before VISION 100M is promoted to production primary in JARVIS, it must satisfy all 6 independent criteria:

1. **Zero Degenerate Collapse:** Shannon output entropy $\ge 6.5$; unique vocabulary count $\ge 250$ in greedy decoding.
2. **Validated Benchmark Superiority:** Independent 240-probe score exceeding the 13.33M calibrated baseline (**> 10.00%**, $\ge 25/240$).
3. **Multi-Domain Competence:** Non-zero scores across mathematics, Python programming, formal reasoning, and multilingual comprehension.
4. **Zero Capability Regression:** Strict zero-regression guarantee on previously functional skills.
5. **Inference Latency & Health:** Mean latency $\le 800\text{ ms}$ per probe; 100% finite weights (0 NaNs, 0 Infs).
6. **Provenance & Integrity:** Checkpoint SHA-256 verified and reproducible.
