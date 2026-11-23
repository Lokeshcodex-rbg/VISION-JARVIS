# VISION Pretraining Architecture and Scaling Specification Report

## Executive Summary

This report establishes the technical architecture, mathematical formulations, attention mechanisms, scaling laws, and pretraining hyperparameters for the **VISION Billion-Token Foundation Model Program**.

VISION is designed as a sovereign, independently trained autoregressive foundation language model, engineered specifically for high parameter efficiency, numerical training stability, and zero-shot multi-domain generalization. The architecture unifies modern deep learning advancements:

- **Rotary Position Embeddings (RoPE)** with high-frequency scaling for long-context stability.
- **SwiGLU (Swish-Gated Linear Units)** for enhanced non-linear representation capacity.
- **Grouped-Query Attention (GQA)** for low memory footprint and high KV-cache efficiency.
- **Pre-Layer RMSNorm** for scale-invariant gradient propagation.
- **Tied Word Embeddings** between input token representations and the language model head.
- **Strict Separation of Pretraining and Supervised Tuning**: Unmasked causal next-token pretraining followed by masked instruction tuning, with zero literal `<think>` tags or hidden chain-of-thought tokens.

---

## 1. Five-Tier Parameter Scaling Matrix

The pretraining program defines five distinct architectural milestones based on Chinchilla compute-optimal planning targets (~20 training tokens per parameter):

| Tier Label | Exact Parameters | Hidden Dim ($d$) | Layers ($L$) | Query Heads | KV Heads | GQA Ratio | FFN Dim ($d_{ff}$) | Max Context | Token Target |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **27.76M** | 27,759,122 | 448 | 10 | 8 | 4 | 2:1 | 1,280 | 512 | **555M** |
| **98.26M** | 98,258,258 | 768 | 14 | 12 | 4 | 3:1 | 2,048 | 2,048 | **2.0B** |
| **250M** | 250,845,184 | 1,024 | 20 | 16 | 4 | 4:1 | 2,816 | 4,096 | **5.0B** |
| **500M** | 504,213,504 | 1,536 | 24 | 16 | 4 | 4:1 | 4,096 | 4,096 | **10.0B** |
| **1B** | 1,022,468,096 | 2,048 | 28 | 16 | 4 | 4:1 | 5,632 | 4,096 | **20.0B** |

---

## 2. Mathematical Formulations of Architectural Components

### 2.1 Rotary Position Embeddings (RoPE)

RoPE encodes absolute position through rotation in complex vector space, naturally preserving relative distances:

$$R_{\Theta, m}^d = \text{diag}\left(R_{\theta_1, m}, R_{\theta_2, m}, \dots, R_{\theta_{d/2}, m}\right)$$

Where for each 2D subvector pair:

$$R_{\theta_i, m} = \begin{pmatrix} \cos(m\theta_i) & -\sin(m\theta_i) \\ \sin(m\theta_i) & \cos(m\theta_i) \end{pmatrix}, \quad \theta_i = b^{-2(i-1)/d}$$

The base frequency $b$ is set to $10,000$ for contexts up to $2,048$ tokens, and scaled to $500,000$ for extended contexts up to $4,096$ tokens to prevent high-frequency phase cancellation.

### 2.2 SwiGLU Non-Linearity

Feed-forward sublayers replace standard GELU/ReLU activations with Swish-Gated Linear Units:

$$\text{SwiGLU}(x, W_{\text{gate}}, W_{\text{up}}, W_{\text{down}}) = \left( \text{SiLU}(x W_{\text{gate}}) \odot (x W_{\text{up}}) \right) W_{\text{down}}$$

Where:

- $\text{SiLU}(z) = z \cdot \sigma(z) = \frac{z}{1 + e^{-z}}$
- Intermediate dimension $d_{ff} \approx \frac{8}{3} d_{model}$ (dimensioned to the nearest multiple of 256 for tensor core alignment).

### 2.3 Pre-Layer RMSNorm

Layer normalization utilizes Root Mean Square Normalization to eliminate mean-centering overhead while preserving variance scaling:

$$\text{RMSNorm}(x) = \frac{x}{\text{RMS}(x)} \odot \gamma, \quad \text{RMS}(x) = \sqrt{\frac{1}{d} \sum_{i=1}^d x_i^2 + \epsilon}$$

With numerical stabilizer $\epsilon = 10^{-6}$.

### 2.4 Grouped-Query Attention (GQA)

To reduce KV-cache memory during autoregressive decoding while maintaining high multi-head query representation, query heads ($H_Q$) are grouped across a smaller number of key-value heads ($H_{KV}$):

$$\text{KV-Compression Ratio} = \frac{H_Q}{H_{KV}}$$

For the 27.76M tier, $H_Q=8, H_{KV}=4$ (2:1 ratio). For the 98.26M tier, $H_Q=12, H_{KV}=4$ (3:1 ratio). For the 250M, 500M, and 1B tiers, $H_Q=16, H_{KV}=4$ (4:1 ratio). This reduces the KV memory bandwidth requirement during inference by up to 75%.

---

## 3. Pretraining Methodology and Loss Formulation

### 3.1 Causal Shifted Next-Token Prediction

Given token sequence $X = [x_1, x_2, \dots, x_T]$, the model is optimized via cross-entropy loss over shifted targets:

$$\mathcal{L}_{\text{pretrain}}(\theta) = -\frac{1}{\sum_{t=1}^{T-1} \mathbb{I}(x_{t+1} \neq \text{pad})} \sum_{t=1}^{T-1} \log P_\theta(x_{t+1} \mid x_1, \dots, x_t) \cdot \mathbb{I}(x_{t+1} \neq \text{pad})$$

### 3.2 Strict Separation of Pretraining and Fine-Tuning

1. **Stage 1: Foundational Pretraining**:
   - The model learns from unmasked web text, textbooks, code repositories, and mathematical derivations formatted as `<bos>{document}<eos>`.
   - The entire document sequence is subject to next-token prediction loss.
2. **Stage 2: Supervised Instruction Tuning (SFT)**:
   - Applied only after the foundation model demonstrates stable syntactic, semantic, and mathematical representations.
   - Masking policy: User prompts and system delimiters are masked out (`target[k] = pad_id`), computing loss solely on assistant responses.

### 3.3 Verifiable Reasoning Policy (Zero `<think>` Tags)

VISION explicitly rejects literal `<think>` tags or hidden chain-of-thought tokens. All mathematical derivations, code executions, and scientific analyses must be structured in transparent, verifiable step-by-step prose and executable scripts.

---

## 4. Hyperparameter and Optimization Schedule

```text
Optimizer:                AdamW
Betas:                    (0.9, 0.95)
Epsilon:                  1e-8
Weight Decay:             0.01 (excluding 1D norms and biases)
Gradient Clipping:        1.0 (L2 norm)
Warmup Schedule:          Linear warmup (2,000 to 15,000 steps depending on tier)
Decay Schedule:           Cosine Annealing to 10% of peak learning rate
Precision:                bfloat16 with native mixed-precision scaling
```
