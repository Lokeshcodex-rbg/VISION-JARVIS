# VISION FOUNDATION MODEL — 25M BALANCED MULTI-DOMAIN DATASET REPORT

## 1. Executive Summary

This report documents the creation, packaging, and cryptographic verification of the balanced multi-domain pretraining dataset (`vision_25m_balanced`). Extracted directly from the audited 1.815B-token local raw corpus reservoir, this dataset provides a balanced curriculum across general reasoning, programming, mathematics, formal exams, multilingual conversation, and instruction adherence.

- **Dataset Identifier**: `vision_25m_balanced`
- **Total Measured BPE Tokens**: 23,567,617 tokens (~23.57 Million tokens).
- **Total Packaging Duration**: 810.6 seconds (13.5 minutes).
- **Total Record Count**: 89,583 samples.
- **Train Split**: 85,103 samples, 22,391,733 BPE tokens (95.01%), 164.69 MB.
- **Val Split**: 4,480 samples, 1,175,884 BPE tokens (4.99%), 8.63 MB.
- **Decontamination Status**: 100% decontaminated against 1,700 benchmark probes (9,957 exclusion substrings).

---

## 2. Pillar and Domain Composition

The dataset enforces balanced allocation across all 6 core intellectual pillars:

| Pillar Index | Pillar Name | Sample Count | Actual BPE Tokens | Target Allocation | Source Repositories |
| --- | --- | --- | --- | --- | --- |
| **Pillar 1** | General Language & Science | 19,583 | 5,000,130 | 5,000,000 | `HuggingFaceTB__cosmopedia`, `HuggingFaceFW__fineweb-edu` |
| **Pillar 2** | Mathematics & Step-by-Step Reasoning | 14,676 | 4,000,038 | 4,000,000 | `AI-MO__NuminaMath-CoT`, `HuggingFaceTB__finemath`, `microsoft__orca-math-word-problems-200k`, `openai__gsm8k` |
| **Pillar 3** | Polyglot Programming & CS | 14,413 | 5,000,220 | 5,000,000 | `ise-uiuc__Magicoder-Evol-Instruct-110K`, `ise-uiuc__Magicoder-OSS-Instruct-75K`, `m-a-p__CodeFeedback-Filtered-Instruction`, `bigcode__self-oss-instruct-sc2-exec-filter-50k` |
| **Pillar 4** | Hindi & Hinglish Dialogue | 6,331 | 1,567,167 | 3,000,000 | `ai4bharat__sangraha`, `CognitiveLab__Hindi-Instruct-Gemma-Prompt-formate`, `smangrul__hindi_instruct_v1` |
| **Pillar 5** | Formal Reasoning & Exam Knowledge | 13,641 | 3,000,047 | 3,000,000 | `cais__mmlu`, `TIGER-Lab__WebInstructSub` |
| **Pillar 6** | Instruction Following & Multi-turn | 20,939 | 5,000,015 | 5,000,000 | `TIGER-Lab__WebInstructSub` |
| **Total** | **All 6 Pillars** | **89,583** | **23,567,617** | **25,000,000** | **Audited Multi-Domain Corpus** |

---

## 3. Cryptographic Hashes and File Manifest

The dataset is frozen and immutable on the local filesystem:

- **Train File**: `D:\Jarvis\data\neural_models\datasets\vision_25m_balanced\train.jsonl`
  - SHA-256: `01bfe2e951d06378cba5d97e50493fa47f24ffc9bdaed7b15e23eb8d174ce657`
  - Byte Size: 164,690,874 bytes
- **Val File**: `D:\Jarvis\data\neural_models\datasets\vision_25m_balanced\val.jsonl`
  - SHA-256: `75dce36c1fbee070aab47bfe8fce2c68620002fc3f73a2fc8a560b6d3f446544`
  - Byte Size: 8,631,510 bytes
- **Manifest**: `D:\Jarvis\data\neural_models\datasets\vision_25m_balanced\manifest.json`

---

## 4. Assistant-Response Masking and Supervision Architecture

Every sample in `vision_25m_balanced` is structured with strict role separation:

1. **Instruction Format**:
   `<bos><user>{instruction}</user><assistant>{response}</assistant><eos>`
2. **Supervision Policy**:
   Target tokens up to the `<assistant>` delimiter are masked with the loss-ignore index (`pad_id = 0`). Only assistant-generated tokens receive gradient backpropagation, ensuring zero loss contamination from user prompts.
3. **Document Format**:
   Pretraining textbook and academic articles are framed as `<bos>{text}<eos>`, where standard causal next-token prediction supervises every token.

---

## 5. Technical Dataset Artifacts

- Manifest JSON: [manifest.json](file:///D:/Jarvis/data/neural_models/datasets/vision_25m_balanced/manifest.json)
- Packager Script: [package_25m_balanced_dataset.py](file:///D:/Jarvis/ml_foundation/package_25m_balanced_dataset.py)
- Training Partition: [train.jsonl](file:///D:/Jarvis/data/neural_models/datasets/vision_25m_balanced/train.jsonl)
- Validation Partition: [val.jsonl](file:///D:/Jarvis/data/neural_models/datasets/vision_25m_balanced/val.jsonl)
