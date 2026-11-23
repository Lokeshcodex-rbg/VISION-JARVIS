# VISION — Complete Checkpoint Integrity Audit & Forensics

## Executive Summary

A comprehensive forensics audit of **163 neural checkpoint files across 71 directories** in `data/neural_models/checkpoints/` was executed using direct PyTorch state dictionary inspection, SHA-256 cryptographic verification, and module parameter shape accounting.

```text
+-------------------------------------------------------------------------------------------------------------+
|                                    KEY CHECKPOINT FORENSIC AUDIT SUMMARY                                    |
+------------------------------------+----------------+-------------------+-----------------+-----------------+
| Checkpoint Name                    | Weights File   | File Size (Bytes) | Checkpoint Sum  | Tied In-Memory  |
+------------------------------------+----------------+-------------------+-----------------+-----------------+
| vision-13m-stage4-relational (S250)| weights.pt     | 53,382,369        | 15,953,938      | 13,332,498      |
| vision-13m-stage4-relational/s100  | weights.pt     | 53,381,345        | 15,953,938      | 13,332,498      |
| vision-pretraining-validation-13m  | weights.pt     | 53,382,368        | 15,953,938      | 13,332,498      |
| vision-v1.4-calibrated-local       | weights.pt     | 53,382,241        | 15,953,938      | 13,332,498      |
| vision-v1.4-replay-cand-b          | weights.pt     | 53,382,305        | 15,953,938      | 13,332,498      |
| vision-100m-foundation             | weights.pt     | 393,104,321       | 104,549,714     | 98,258,258      |
| vision-100m-recovered              | weights.pt     | 393,104,385       | 104,549,714     | 98,258,258      |
| vision-100m-stage3-pretraining     | weights.pt     | 393,104,385       | 104,549,714     | 98,258,258      |
| vision-25m-compact-foundation      | weights.pt     | 111,087,573       | 31,429,138      | 27,759,122      |
| vision-v1.5-25m-local              | weights.pt     | 107,201,397       | 30,455,410      | 26,785,394      |
+------------------------------------+----------------+-------------------+-----------------+-----------------+
```

---

## 1. Forensic Discovery: Checkpoint Weights vs. In-Memory Parameters

Our direct inspection revealed why historical reports contained discrepancies:

1. **State Dict Dual Storage**: In PyTorch, when `tie_word_embeddings = True`, `model.lm_head.weight` references the exact same tensor storage as `model.tok_emb.weight`. However, when calling `model.state_dict()`, PyTorch serializes **both keys** (`tok_emb.weight` and `lm_head.weight`) into `weights.pt`.
2. **The 13.33M Reconciliation**:
   - Total parameters in `state_dict` tensor sum: **15,953,938**.
   - Tied token embedding weight deduplication ($8,192 \times 320$): $-2,621,440$.
   - Actual unique parameters in memory: **13,332,498** (~**13.33M**).
   - This 13.33M includes $1,230,412$ parameters from the native `JarvisVisionPatchEncoder` and $135,686$ parameters from `JarvisAudioFeatureEncoder`. Pure text transformer weights total **11,966,400** parameters.
3. **The 98.26M Reconciliation**:
   - Total parameters in `state_dict` tensor sum: **104,549,714**.
   - Tied token embedding weight deduplication ($8,192 \times 768$): $-6,291,456$.
   - Actual unique parameters in memory: **98,258,258** (~**98.26M**).
   - This 98.26M includes $3,194,444$ vision encoder parameters and $669,702$ audio encoder parameters. Pure text transformer weights total **94,394,112** parameters.

---

## 2. Granular Inventory of Key Target Checkpoints

### 2.1 VISION 13M Relational Series

- **`vision-13m-stage4-relational` (Final Step 250)**:
  - Exact Path: `data/neural_models/checkpoints/vision-13m-stage4-relational/weights.pt`
  - SHA-256: `d87af873f50897f86d4eeded3aacbe0cf2995d17e26213d6039086cc1089c66c`
  - File Size: 53,382,369 bytes (50.91 MB)
  - Tensor Count: 144 tensors
  - Architecture: $d_{\text{model}}=320, \text{layers}=8, \text{heads}=8, \text{kv\_heads}=4, d_{\text{ff}}=896, \text{vocab}=8,192$
  - Model Loadability: Successfully loaded into `JarvisUnifiedTransformer(cfg)` with 0 tensor errors.
- **`vision-13m-stage4-relational/step_100` (Midpoint)**:
  - Exact Path: `data/neural_models/checkpoints/vision-13m-stage4-relational/step_100/weights.pt`
  - SHA-256: `454dd74dea570c406aff768f00dc94f3aa8f44f4c37a319cad07ad38570c9f06`
  - File Size: 53,381,345 bytes
  - Tensor Count: 144 tensors
- **`vision-pretraining-validation-13m` (Step 0 Reference)**:
  - Exact Path: `data/neural_models/checkpoints/vision-pretraining-validation-13m/weights.pt`
  - SHA-256: `4f85bdeddd360cb986d01ce008378a053aca653941f41defaec9f1cddbdb3379`
  - File Size: 53,382,368 bytes

### 2.2 Historical Reference Models

- **`vision-v1.4-calibrated-local`**:
  - Exact Path: `data/neural_models/checkpoints/vision-v1.4-calibrated-local/weights.pt`
  - SHA-256: `5575077916210c169213137976e10db362ce55b8aa8cf2432884a29a43a0e6e7`
  - File Size: 53,382,241 bytes
  - Architecture: Identical $d=320, L=8, \text{vocab}=8,192$ weights.
- **`vision-v1.4-replay-cand-b`**:
  - Exact Path: `data/neural_models/checkpoints/vision-v1.4-replay-cand-b/weights.pt`
  - SHA-256: `2fee4c30f579ed1a0aa0b9809971bc39feaa45037ae6cb806497f5f922ae42ff`
  - File Size: 53,382,305 bytes

### 2.3 VISION 100M Foundation Series

- **`vision-100m-foundation`**:
  - Exact Path: `data/neural_models/checkpoints/vision-100m-foundation/weights.pt`
  - SHA-256: `8ce96183089b73e16b9cbbeea65588523c9285093740e53a9925232fb53cb1c1`
  - File Size: 393,104,321 bytes (374.90 MB)
  - Tensor Count: 192 tensors
  - Architecture: $d_{\text{model}}=768, \text{layers}=14, \text{heads}=12, \text{kv\_heads}=4, d_{\text{ff}}=2,048, \text{vocab}=8,192$
  - Checkpoint Sum: 104,549,714 parameters | Tied Unique: 98,258,258 parameters.
- **`vision-100m-recovered`**:
  - Exact Path: `data/neural_models/checkpoints/vision-100m-recovered/weights.pt`
  - SHA-256: `b658f67743a9fa3f9c6395ec6be18a09cfaf719c8f2ba578ee19e34e568bb9e6`
  - File Size: 393,104,385 bytes
- **`vision-100m-stage3-pretraining`**:
  - Exact Path: `data/neural_models/checkpoints/vision-100m-stage3-pretraining/weights.pt`
  - SHA-256: `a937a4e69d05e2c56a298db57a840e6c507c3be12111d408ebc4c1a51159fa65`
  - File Size: 393,104,385 bytes

---

## 3. Checkpoint Loadability & Verification Matrix

Every audited checkpoint was tested for loadability using `ml_foundation/model.py`.

```text
+------------------------------------+--------------------------+---------------------+-------------------+
| Checkpoint Identifier              | Target Class             | PyTorch Strict Load | Load Status       |
+------------------------------------+--------------------------+---------------------+-------------------+
| vision-13m-stage4-relational       | JarvisUnifiedTransformer | True (with tied lm) | PASS (Zero Error) |
| vision-13m-stage4-relational/s100  | JarvisUnifiedTransformer | True (with tied lm) | PASS (Zero Error) |
| vision-pretraining-validation-13m  | JarvisUnifiedTransformer | True (with tied lm) | PASS (Zero Error) |
| vision-v1.4-calibrated-local       | JarvisUnifiedTransformer | True (with tied lm) | PASS (Zero Error) |
| vision-100m-foundation             | JarvisUnifiedTransformer | True (with tied lm) | PASS (Zero Error) |
| vision-100m-recovered              | JarvisUnifiedTransformer | True (with tied lm) | PASS (Zero Error) |
| vision-25m-compact-foundation      | JarvisUnifiedTransformer | True (with tied lm) | PASS (Zero Error) |
+------------------------------------+--------------------------+---------------------+-------------------+
```

Full details for all 163 checkpoints are cataloged in `VISION_COMPLETE_CHECKPOINT_INVENTORY.json`.
