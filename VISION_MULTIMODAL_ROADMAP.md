# VISION — Multimodal Architecture & Staged Integration Roadmap

## Executive Summary

This roadmap establishes the phased engineering strategy for integrating image and audio understanding into VISION.

Following our core directive: **we do not claim multimodal capability simply because vision or audio modules exist in the codebase**. Multimodal development is strictly decoupled from the text foundation model to prevent multi-task gradient interference during initial representation learning.

```text
+-------------------------------------------------------------------------------------------------------------+
|                                    4-PHASE MULTIMODAL INTEGRATION ROADMAP                                   |
+-------+-------------------------+-----------------------------------------+---------------------------------+
| Phase | Focus Milestone         | Architectural Architecture              | Gating Requirement              |
+-------+-------------------------+-----------------------------------------+---------------------------------+
| Ph-1  | Pure Text Foundation    | Standalone Text Transformer (d=768, L14)| Benchmark Functional Acc > 25%  |
| Ph-2  | Visual Token Projection | Vision Patch Encoder + 2-layer MLP Proj | Text Foundation Model Frozen    |
| Ph-3  | Acoustic Token Projector| Spectral Mel-Filterbank Conformer Proj  | Visual Alignment Verified       |
| Ph-4  | Joint Multimodal SFT    | Interleaved Token Stream Training       | Unimodal Invariants Maintained  |
+-------+-------------------------+-----------------------------------------+---------------------------------+
```

---

## 1. Why Multimodal Co-Training Failed in Early Checkpoints

In early VISION checkpoints (including the 13.33M model):

- The `JarvisVisionPatchEncoder` (1.23M parameters) and `JarvisAudioFeatureEncoder` (0.14M parameters) were instantiated directly inside `JarvisUnifiedTransformer`.
- During text pretraining, visual prefix tokens were unconditioned or fed dummy zeros.
- Gradients from multimodal classification heads periodically disrupted the shared transformer layer norms, creating gradient noise without teaching the model genuine cross-modal representations.

**Architectural Principle**: **Language First**. A multimodal model cannot reason about visual diagrams or transcribe acoustic speech if its language foundation cannot perform basic reasoning or generate coherent syntax.

---

## 2. Phase-by-Phase Integration Specifications

### Phase 1: Text Foundation Convergence (Current Gating Milestone)

- **Objective**: Establish native text capability on English, Hindi, Hinglish, mathematics, and Python.
- **Model State**: Pure text transformer ($d_{\text{model}}=768$, 14 layers, 16k vocab, 99.31M parameters).
- **Exit Gate**: The text model must achieve $\ge 25.0\%$ functional accuracy on unseen benchmark probes before Phase 2 commences.

---

### Phase 2: Visual Understanding & Projection

- **Vision Backbone**: Native Vision Patch Transformer (patch size 8x8 or 14x14) or SigLIP-B/16 visual encoder.
- **Multimodal Projector**: A 2-layer GELU MLP projecting visual feature vectors ($D_v$) into the transformer's token space ($d_{\text{model}} = 768$).
- **Training Protocol**:
  1. **Stage 2A (Projector Warmup)**: Freeze both the Vision Encoder and the Text Foundation Model. Train only the 2-layer MLP projector on 5M image-caption pairs (CC3M / ShareGPT4V).
  2. **Stage 2B (Visual Instruction Tuning)**: Unfreeze the transformer blocks and fine-tune on visual question answering (VQA), chart reading, and OCR tasks.

---

### Phase 3: Audio Understanding & Speech Interaction

- **Audio Backbone**: 8-layer Conformer acoustic encoder processing 80-channel log mel-filterbank features.
- **Audio Projector**: 1D temporal downsampler (stride 4) with linear projection to $d_{\text{model}}$.
- **Training Protocol**:
  1. Train acoustic alignment on speech recognition (ASR) pairs across English, Hindi, and Hinglish.
  2. Maintain separate evaluation suites for audio transcription and spoken instruction comprehension.

---

### Phase 4: Unified Multimodal Serving

- **Unified Context**: Interleaved token stream using structural delimiters:

  ```text
  <bos><user><vision>[5 visual tokens]</vision> Explain this circuit diagram.</user><assistant>
  ```

- **Evaluation Independence**: Multimodal benchmark metrics (e.g., ChartQA, DocVQA, Speech-Eval) must be reported on dedicated suites, completely distinct from the core text foundation benchmarks.
