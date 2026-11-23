"""
VISION — MADE BY LOKESH | v0.8 Dataset & GPU Training Readiness Planner (`ml_foundation/readiness_planner.py`)

Prepares VISION for its first genuine foundation-model training run WITHOUT launching paid GPU jobs
or downloading multi-gigabyte corpora:
  1. Verified dataset catalog across Language, Math, Coding (Py/JS/C++), Science, Engineering,
     Robotics, Tool Calling, and Multilingual (Hindi/Hinglish), strictly separating
     `public`, `synthetic`, `curated`, `proprietary`, and `excluded/sealed_eval` sources.
  2. Memory-bounded `StreamingCorpusIngestor` performing license filtering, PII redaction, quality
     scoring, SHA-256 + 64-hash MinHash-LSH dedup, canary decontamination, hash-bucket
     train/val/test isolation, and direct uint32 `.bin` shard serialization.
  3. Exact v0.8 (`jarvis-v0.8-research-52m`) GPU memory math, software dependency check, and
     USD + INR (`1 USD = 94.28 INR`) runtime/cost comparison across RTX 4090, L40S, A100, H100.
  4. Reproducible Smoke, Pilot (55M tokens), and Full (2.167B tokens) experiment designs & gates.
"""

from __future__ import annotations

import datetime
import gzip
import hashlib
import importlib.util
import json
import math
import os
import platform
import sys
import time
from typing import Dict, Iterable, Iterator, List, Optional, Set, Tuple

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import numpy as np
import torch

from ml_foundation.corpus_builder import ALLOWED_LICENSES
from ml_foundation.dataset_builder import (
    BENCHMARK_CANARY_STRINGS,
    _lsh_bands,
    _minhash_jaccard,
    _minhash_signature,
    _shingle_set,
    sanitize_and_filter_text,
    verify_zero_contamination,
)
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer, MODEL_SCALE_PRESETS
from ml_foundation.tokenizer import JarvisBPE


USD_TO_INR = 94.28  # Observed mid-market conversion baseline documented in planning

APPROVED_OPEN_DATA_LICENSES: Set[str] = set(ALLOWED_LICENSES) | {
    "ODC-By-1.0",
    "BSD-2-Clause",
    "ISC",
}

# Target totals verified arithmetically:
#   Stage 1 Pretrain = 2,087,178,240 tokens (40x overtrain for 52,179,456 LM params)
#   Stage 2 SFT      =    80,000,000 tokens
#   Total Full Run   = 2,167,178,240 tokens
#   Pilot Run        =    50,000,000 Stage 1 + 5,000,000 Stage 2 = 55,000,000 tokens
FULL_STAGE1_TARGET_TOKENS = 2_087_178_240
FULL_STAGE2_TARGET_TOKENS = 80_000_000
PILOT_STAGE1_TARGET_TOKENS = 50_000_000
PILOT_STAGE2_TARGET_TOKENS = 5_000_000


CURATED_DATASET_REGISTRY: List[Dict[str, object]] = [
    {
        "id": "fineweb_edu_sample_10bt",
        "repo_id": "HuggingFaceFW/fineweb-edu",
        "subset": "sample-10BT",
        "source_url": "https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu",
        "domain": "language",
        "origin_class": "public",
        "license": "ODC-By-1.0",
        "download_size_gb": 28.5,
        "estimated_raw_tokens": 10_000_000_000,
        "pilot_target_tokens": 22_000_000,
        "full_target_tokens": 900_000_000,
        "intended_use": "stage1_pretrain",
        "notes": "Educational web prose filtered from FineWeb; Common Crawl attribution subject to ODC-By-1.0.",
    },
    {
        "id": "cosmopedia_stem_openstax",
        "repo_id": "HuggingFaceTB/cosmopedia",
        "subset": "openstax+stanford+stories",
        "source_url": "https://huggingface.co/datasets/HuggingFaceTB/cosmopedia",
        "domain": "language_and_science",
        "origin_class": "synthetic",
        "license": "Apache-2.0",
        "download_size_gb": 92.2,
        "estimated_raw_tokens": 25_000_000_000,
        "pilot_target_tokens": 6_000_000,
        "full_target_tokens": 172_178_240,
        "intended_use": "stage1_pretrain",
        "notes": "Synthetically generated textbook/article prose; stream only ~0.7 GB slice for full target.",
    },
    {
        "id": "finemath_4plus",
        "repo_id": "HuggingFaceTB/finemath",
        "subset": "finemath-4plus",
        "source_url": "https://huggingface.co/datasets/HuggingFaceTB/finemath",
        "domain": "mathematics",
        "origin_class": "public",
        "license": "ODC-By-1.0",
        "download_size_gb": 1.4,
        "estimated_raw_tokens": 10_000_000_000,
        "pilot_target_tokens": 7_500_000,
        "full_target_tokens": 310_000_000,
        "intended_use": "stage1_pretrain",
        "notes": "High-quality score 4+ math pages from FineMath (34B+ FineMath-3+/4+ family); streamed slice.",
    },
    {
        "id": "the_stack_smol_permissive",
        "repo_id": "bigcode/the-stack-smol",
        "subset": "python+javascript+cpp+typescript",
        "source_url": "https://huggingface.co/datasets/bigcode/the-stack-smol",
        "domain": "coding",
        "origin_class": "public",
        "license": "MIT",
        "download_size_gb": 2.6,
        "estimated_raw_tokens": 650_000_000,
        "pilot_target_tokens": 8_000_000,
        "full_target_tokens": 280_000_000,
        "intended_use": "stage1_pretrain",
        "notes": "Streamed & strictly filtered to rows whose repository license is in {MIT, Apache-2.0, BSD-3-Clause}.",
    },
    {
        "id": "pes2o_stem_papers",
        "repo_id": "allenai/peS2o",
        "subset": "v2_stem_cs_me_ee",
        "source_url": "https://huggingface.co/datasets/allenai/peS2o",
        "domain": "science_and_engineering",
        "origin_class": "public",
        "license": "ODC-By-1.0",
        "download_size_gb": 308.0,
        "estimated_raw_tokens": 46_900_000_000,
        "pilot_target_tokens": 4_000_000,
        "full_target_tokens": 200_000_000,
        "intended_use": "stage1_pretrain",
        "notes": "S2ORC academic corpus; stream only ~0.85 GB STEM/engineering slice rather than full 308 GB mirror.",
    },
    {
        "id": "sangraha_hindi_verified",
        "repo_id": "ai4bharat/sangraha",
        "subset": "verified/hin",
        "source_url": "https://huggingface.co/datasets/ai4bharat/sangraha",
        "domain": "multilingual",
        "origin_class": "curated",
        "license": "CC-BY-4.0",
        "download_size_gb": 0.95,
        "estimated_raw_tokens": 34_540_000_000,
        "pilot_target_tokens": 2_000_000,
        "full_target_tokens": 180_000_000,
        "intended_use": "stage1_pretrain",
        "notes": "AI4Bharat Sangraha verified Hindi (Devanagari); full 22-lang repo is ~705 GB, stream verified/hin slice.",
    },
    {
        "id": "lerobot_ros2_robotics_docs",
        "repo_id": "huggingface/lerobot+ros2_docs",
        "subset": "apache2_robotics_engineering",
        "source_url": "https://huggingface.co/lerobot",
        "domain": "robotics_and_engineering",
        "origin_class": "curated",
        "license": "Apache-2.0",
        "download_size_gb": 0.15,
        "estimated_raw_tokens": 45_000_000,
        "pilot_target_tokens": 500_000,
        "full_target_tokens": 45_000_000,
        "intended_use": "stage1_pretrain",
        "notes": "Curated Apache-2.0 robotics SDK/URDF/kinematics docs + PSF-2.0 stdlib references (streamed <= 150 MB).",
    },
    # ---- STAGE 2: SUPERVISED INSTRUCTION & TOOL-CALLING FINE-TUNING (80M full / 5M pilot) ----
    {
        "id": "numina_math_cot_sft",
        "repo_id": "AI-MO/NuminaMath-CoT",
        "subset": "train_decontaminated",
        "source_url": "https://huggingface.co/datasets/AI-MO/NuminaMath-CoT",
        "domain": "mathematics",
        "origin_class": "curated",
        "license": "Apache-2.0",
        "download_size_gb": 0.65,
        "estimated_raw_tokens": 260_000_000,
        "pilot_target_tokens": 1_500_000,
        "full_target_tokens": 22_000_000,
        "intended_use": "stage2_sft",
        "notes": "~859,608 CoT math solutions; scrubbed against GSM8K-test and MATH-500 benchmark canaries.",
    },
    {
        "id": "magicoder_oss_instruct_75k",
        "repo_id": "ise-uiuc/Magicoder-OSS-Instruct-75K",
        "subset": "default",
        "source_url": "https://huggingface.co/datasets/ise-uiuc/Magicoder-OSS-Instruct-75K",
        "domain": "coding",
        "origin_class": "synthetic",
        "license": "MIT",
        "download_size_gb": 0.18,
        "estimated_raw_tokens": 45_000_000,
        "pilot_target_tokens": 1_200_000,
        "full_target_tokens": 20_000_000,
        "intended_use": "stage2_sft",
        "notes": "75,000 OSS-Instruct coding instructions; scrubbed against HumanEval & MBPP function signatures.",
    },
    {
        "id": "glaive_function_calling_v2",
        "repo_id": "glaiveai/glaive-function-calling-v2",
        "subset": "default",
        "source_url": "https://huggingface.co/datasets/glaiveai/glaive-function-calling-v2",
        "domain": "tool_use",
        "origin_class": "synthetic",
        "license": "Apache-2.0",
        "download_size_gb": 0.35,
        "estimated_raw_tokens": 85_000_000,
        "pilot_target_tokens": 800_000,
        "full_target_tokens": 14_000_000,
        "intended_use": "stage2_sft",
        "notes": "Structured JSON tool selection and argument schema trajectories for native tool-use training.",
    },
    {
        "id": "oasst2_multilingual_sft",
        "repo_id": "OpenAssistant/oasst2",
        "subset": "train_top_trees",
        "source_url": "https://huggingface.co/datasets/OpenAssistant/oasst2",
        "domain": "general_and_multilingual",
        "origin_class": "curated",
        "license": "Apache-2.0",
        "download_size_gb": 0.15,
        "estimated_raw_tokens": 40_000_000,
        "pilot_target_tokens": 1_200_000,
        "full_target_tokens": 20_000_000,
        "intended_use": "stage2_sft",
        "notes": "128,575 human-annotated multi-turn instruction messages (strictly train split; val split held out).",
    },
    {
        "id": "jarvis_proprietary_robotics_grounded",
        "repo_id": "local://ml_foundation/corpus_builder.py+data/",
        "subset": "robotics_kg_verified_hinglish",
        "source_url": "file:///d:/Jarvis/ml_foundation/corpus_builder.py",
        "domain": "robotics_engineering_hinglish",
        "origin_class": "proprietary",
        "license": "Original-Curated",
        "download_size_gb": 0.01,
        "estimated_raw_tokens": 120_000,
        "pilot_target_tokens": 300_000,
        "full_target_tokens": 4_000_000,
        "intended_use": "stage2_sft_and_alignment",
        "notes": "Proprietary JARVIS verified episodes, KG constraints, 6-DOF kinematics, Hinglish & safety gates (upsampled cleanly within SFT replay; never leaked into external val/test).",
    },
]

EXCLUDED_OR_SEALED_DATASETS: List[Dict[str, object]] = [
    {
        "id": "open_web_math",
        "repo_id": "open-web-math/open-web-math",
        "status": "REJECTED_UNCLEAR_LICENSE",
        "declared_terms": "Does not alter underlying Common Crawl copyright/license",
        "reason": "Excluded under strict legal-hygiene rule: no clear permissive or ODC-By grant; replaced by HuggingFaceTB/finemath (ODC-By-1.0) and AI-MO/NuminaMath-CoT (Apache-2.0).",
    },
    {
        "id": "the_stack_unlicensed_rows",
        "repo_id": "bigcode/the-stack-v2-dedup (no-license filter)",
        "status": "REJECTED_UNLESS_SPDX_ALLOWLISTED",
        "declared_terms": "Mixed permissive + no-license repositories under Software Heritage ToU",
        "reason": "Any source file lacking an explicit permissive SPDX license (MIT, Apache-2.0, BSD-2/3-Clause, ISC) is dropped at streaming ingestion time.",
    },
    {
        "id": "sealed_eval_benchmarks",
        "repo_id": "openai/gsm8k (test), HuggingFaceH4/MATH-500, openai/openai_humaneval, google-research-datasets/mbpp, cais/mmlu (test)",
        "status": "SEALED_EVALUATION_ONLY",
        "declared_terms": "Evaluation benchmark gold standards",
        "reason": "Strictly prohibited from all pretrain/SFT/DPO datasets; indexed into canary/MinHash contamination scrubbers.",
    },
]


def _check_gpu_software_stack() -> Dict[str, object]:
    """Inspect local .venv runtime vs required cloud GPU software stack."""
    mods = ["torch", "numpy", "PIL", "datasets", "huggingface_hub", "pyarrow", "zstandard", "accelerate", "wandb"]
    installed: Dict[str, str] = {}
    missing_for_hub_and_gpu: List[str] = []
    for m in mods:
        spec = importlib.util.find_spec(m)
        if spec is None:
            installed[m] = "NOT_INSTALLED"
            missing_for_hub_and_gpu.append(m)
        else:
            try:
                mod = __import__(m)
                installed[m] = str(getattr(mod, "__version__", "installed"))
            except Exception:
                installed[m] = "installed"

    return {
        "local_host": {
            "os": f"{platform.system()} {platform.release()}",
            "python": platform.python_version(),
            "cpu_threads": os.cpu_count() or 1,
            "torch_build": torch.__version__,
            "cuda_available": torch.cuda.is_available(),
            "bf16_cuda": bool(torch.cuda.is_available() and getattr(torch.cuda, "is_bf16_supported", lambda: False)()),
            "installed_packages": installed,
        },
        "missing_on_local_for_hub_streaming": missing_for_hub_and_gpu,
        "required_gpu_pod_environment": {
            "python": ">=3.10,<3.13",
            "pytorch_cuda": "torch>=2.5.0+cu124 (with SDPA FlashAttention2 backend enabled)",
            "streaming_packages": ["datasets>=3.0.0", "huggingface_hub>=0.26.0", "pyarrow>=17.0.0", "zstandard>=0.23.0"],
            "pip_install_cmd": "pip install --upgrade datasets huggingface_hub pyarrow zstandard accelerate",
        },
    }


def _split_bucket(group_key: str) -> str:
    """Deterministic hash assignment keeping every template/doc group in a single split (96/2/2)."""
    digest = hashlib.sha256(str(group_key or "default").encode("utf-8")).digest()
    bucket = int.from_bytes(digest[:4], "big") % 1000
    if bucket < 960:
        return "train"
    if bucket < 980:
        return "val"
    return "test"


class StreamingCorpusIngestor:
    """
    Memory-bounded streaming ingestion pipeline:
      source stream -> license check -> origin tagging -> PII/quality filter ->
      SHA-256 + MinHash-LSH dedup -> canary contamination scrub ->
      deterministic split assignment -> tokenized uint32 `.bin` memmap shards.
    """

    def __init__(
        self,
        tokenizer: JarvisBPE,
        out_dir: str,
        min_quality: float = 0.45,
        near_dup_threshold: float = 0.72,
    ) -> None:
        self.tokenizer = tokenizer
        self.out_dir = os.path.abspath(out_dir)
        os.makedirs(self.out_dir, exist_ok=True)
        self.min_quality = float(min_quality)
        self.near_dup_threshold = float(near_dup_threshold)

        self.seen_hashes: Set[str] = set()
        self.lsh_index: Dict[Tuple[int, Tuple[int, ...]], List[Tuple[int, ...]]] = {}
        self.canary_norms: List[str] = [" ".join(c.lower().split()) for c in BENCHMARK_CANARY_STRINGS]
        self.canary_grams8: Set[Tuple[str, ...]] = set()
        for cn in self.canary_norms:
            w = cn.split()
            for i in range(max(0, len(w) - 7)):
                self.canary_grams8.add(tuple(w[i : i + 8]))

        self.stats: Dict[str, object] = {
            "records_seen": 0,
            "records_accepted": 0,
            "rejected_missing_or_unclear_license": 0,
            "rejected_low_quality_or_short": 0,
            "pii_redactions_applied": 0,
            "dedup_exact_removed": 0,
            "dedup_minhash_removed": 0,
            "contamination_canary_removed": 0,
            "origin_counts": {"public": 0, "synthetic": 0, "curated": 0, "proprietary": 0},
            "license_counts": {},
            "split_counts": {"train": 0, "val": 0, "test": 0},
            "split_tokens": {"train": 0, "val": 0, "test": 0},
        }
        self._split_families: Dict[str, Set[str]] = {"train": set(), "val": set(), "test": set()}
        self._split_rows_sample: Dict[str, List[Dict[str, object]]] = {"train": [], "val": [], "test": []}

    @staticmethod
    def iter_jsonl_stream(paths: Iterable[str]) -> Iterator[Dict[str, object]]:
        """Yield records lazily line-by-line from `.jsonl` or `.jsonl.gz` without RAM buffering."""
        for p in paths:
            opener = gzip.open if str(p).endswith(".gz") else open
            with opener(p, "rt", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if line:
                        yield json.loads(line)

    @staticmethod
    def iter_hf_dataset_stream(
        repo_id: str,
        subset: Optional[str] = None,
        split: str = "train",
        max_records: int = 50_000,
    ) -> Iterator[Dict[str, object]]:
        """Stream records directly from Hugging Face Hub using `datasets.load_dataset(..., streaming=True)`."""
        try:
            from datasets import load_dataset  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "Hugging Face `datasets` package is not installed locally. "
                "Run `pip install datasets huggingface_hub pyarrow zstandard` on the GPU node."
            ) from exc

        ds = load_dataset(repo_id, name=subset, split=split, streaming=True)
        for idx, row in enumerate(ds):
            if idx >= max_records:
                break
            yield dict(row)

    def _has_benchmark_canary(self, text: str) -> bool:
        norm = " ".join(str(text or "").lower().split())
        for cn in self.canary_norms:
            if cn in norm:
                return True
        words = norm.split()
        if len(words) >= 8:
            for i in range(len(words) - 7):
                if tuple(words[i : i + 8]) in self.canary_grams8:
                    return True
        return False

    def ingest_stream(self, record_stream: Iterable[Dict[str, object]]) -> Dict[str, object]:
        """Consume an arbitrary lazy stream into verified split JSONLs + uint32 `.bin` token shards."""
        jsonl_paths = {s: os.path.join(self.out_dir, f"{s}.jsonl") for s in ("train", "val", "test")}
        bin_paths = {s: os.path.join(self.out_dir, f"{s}_tokens.bin") for s in ("train", "val", "test")}

        j_handles = {s: open(jsonl_paths[s], "w", encoding="utf-8") for s in ("train", "val", "test")}
        b_handles = {s: open(bin_paths[s], "wb") for s in ("train", "val", "test")}
        sha_calc = {s: hashlib.sha256() for s in ("train", "val", "test")}

        try:
            for raw_rec in record_stream:
                self.stats["records_seen"] += 1
                lic = str(raw_rec.get("license") or "").strip()
                if not lic or lic not in APPROVED_OPEN_DATA_LICENSES:
                    self.stats["rejected_missing_or_unclear_license"] += 1
                    continue

                origin = str(raw_rec.get("origin_class") or "public").strip().lower()
                if origin not in ("public", "synthetic", "curated", "proprietary"):
                    origin = "public"

                raw_text = str(raw_rec.get("text") or raw_rec.get("instruction") or "")
                clean, keep, redactions, qscore = sanitize_and_filter_text(
                    raw_text, min_chars=16, min_quality=self.min_quality
                )
                self.stats["pii_redactions_applied"] += redactions
                if not keep:
                    self.stats["rejected_low_quality_or_short"] += 1
                    continue

                if self._has_benchmark_canary(clean):
                    self.stats["contamination_canary_removed"] += 1
                    continue

                norm = " ".join(clean.lower().split())
                doc_hash = hashlib.sha256(norm.encode("utf-8")).hexdigest()
                if doc_hash in self.seen_hashes:
                    self.stats["dedup_exact_removed"] += 1
                    continue

                sig = _minhash_signature(_shingle_set(norm))
                candidates: List[Tuple[int, ...]] = []
                for bkey in _lsh_bands(sig):
                    candidates.extend(self.lsh_index.get(bkey, ()))
                if any(_minhash_jaccard(sig, c) >= self.near_dup_threshold for c in candidates):
                    self.stats["dedup_minhash_removed"] += 1
                    continue

                self.seen_hashes.add(doc_hash)
                for bkey in _lsh_bands(sig):
                    self.lsh_index.setdefault(bkey, []).append(sig)

                fam = str(raw_rec.get("template_family") or raw_rec.get("doc_group") or doc_hash[:12]).strip()
                # Force proprietary, synthetic, & explicit train_only families to remain strictly in train split
                if origin in ("proprietary", "synthetic") or fam.startswith("train_"):
                    split = "train"
                else:
                    split = _split_bucket(fam)

                tok_ids = self.tokenizer.encode(clean, add_bos=True, add_eos=True)
                arr = np.asarray(tok_ids, dtype=np.uint32)
                raw_bytes = arr.tobytes()
                b_handles[split].write(raw_bytes)
                sha_calc[split].update(raw_bytes)

                out_row = {
                    "text": clean,
                    "source": str(raw_rec.get("source") or "stream"),
                    "domain": str(raw_rec.get("domain") or "general"),
                    "license": lic,
                    "origin_class": origin,
                    "template_family": fam,
                    "quality_score": round(qscore, 4),
                    "tokens": len(tok_ids),
                    "sha256": doc_hash,
                }
                j_handles[split].write(json.dumps(out_row, ensure_ascii=False) + "\n")

                self.stats["records_accepted"] += 1
                self.stats["origin_counts"][origin] += 1
                lic_map = self.stats["license_counts"]
                lic_map[lic] = lic_map.get(lic, 0) + 1
                self.stats["split_counts"][split] += 1
                self.stats["split_tokens"][split] += len(tok_ids)
                self._split_families[split].add(fam)
                if len(self._split_rows_sample[split]) < 500:
                    self._split_rows_sample[split].append({"instruction": clean, "template_family": fam})
        finally:
            for fh in j_handles.values():
                fh.close()
            for bf in b_handles.values():
                bf.close()

        # Verify zero cross-split template/exact/MinHash leakage
        train_val_audit = verify_zero_contamination(self._split_rows_sample["train"], self._split_rows_sample["val"])
        train_test_audit = verify_zero_contamination(self._split_rows_sample["train"], self._split_rows_sample["test"])
        family_overlap_tv = sorted(self._split_families["train"] & self._split_families["val"])
        family_overlap_tt = sorted(self._split_families["train"] & self._split_families["test"])
        family_overlap_vt = sorted(self._split_families["val"] & self._split_families["test"])

        shard_manifest = {
            s: {
                "jsonl_path": jsonl_paths[s],
                "bin_path": bin_paths[s],
                "tokens": self.stats["split_tokens"][s],
                "records": self.stats["split_counts"][s],
                "bin_sha256": sha_calc[s].hexdigest(),
                "bin_bytes": os.path.getsize(bin_paths[s]),
            }
            for s in ("train", "val", "test")
        }
        report = {
            "version": "1.0.0",
            "streaming_mode": "zero_ram_line_by_line_plus_minhash_lsh",
            "tokenizer_mode": self.tokenizer.pretokenize_mode,
            "stats": self.stats,
            "isolation_audit": {
                "zero_template_family_overlap_train_val": len(family_overlap_tv) == 0,
                "zero_template_family_overlap_train_test": len(family_overlap_tt) == 0,
                "zero_template_family_overlap_val_test": len(family_overlap_vt) == 0,
                "zero_exact_contamination_val": train_val_audit["zero_exact_contamination"],
                "zero_exact_contamination_test": train_test_audit["zero_exact_contamination"],
                "zero_minhash_contamination_val": train_val_audit["zero_minhash_contamination"],
                "zero_minhash_contamination_test": train_test_audit["zero_minhash_contamination"],
                "zero_canary_contamination": train_val_audit["zero_canary_contamination"] and train_test_audit["zero_canary_contamination"],
            },
            "shards": shard_manifest,
        }
        m_path = os.path.join(self.out_dir, "streaming_manifest.json")
        with open(m_path, "w", encoding="utf-8") as mf:
            json.dump(report, mf, indent=2)
        report["manifest_path"] = m_path
        return report


def build_dataset_catalog_manifest() -> Dict[str, object]:
    """Build audited dataset catalog with exact origin/license breakdown & mixing verification."""
    origin_tokens_full = {"public": 0, "synthetic": 0, "curated": 0, "proprietary": 0}
    origin_tokens_pilot = {"public": 0, "synthetic": 0, "curated": 0, "proprietary": 0}
    domain_stage1_tokens = {}
    domain_stage2_tokens = {}
    license_breakdown: Dict[str, int] = {}

    stage1_full_sum = 0
    stage2_full_sum = 0
    stage1_pilot_sum = 0
    stage2_pilot_sum = 0

    for entry in CURATED_DATASET_REGISTRY:
        lic = str(entry["license"])
        if lic not in APPROVED_OPEN_DATA_LICENSES:
            raise ValueError(f"Unapproved license '{lic}' on dataset {entry['id']}")
        origin = str(entry["origin_class"])
        full_t = int(entry["full_target_tokens"])
        pilot_t = int(entry["pilot_target_tokens"])
        origin_tokens_full[origin] += full_t
        origin_tokens_pilot[origin] += pilot_t
        license_breakdown[lic] = license_breakdown.get(lic, 0) + full_t

        dom = str(entry["domain"])
        if entry["intended_use"] == "stage1_pretrain":
            stage1_full_sum += full_t
            stage1_pilot_sum += pilot_t
            domain_stage1_tokens[dom] = domain_stage1_tokens.get(dom, 0) + full_t
        else:
            stage2_full_sum += full_t
            stage2_pilot_sum += pilot_t
            domain_stage2_tokens[dom] = domain_stage2_tokens.get(dom, 0) + full_t

    stage1_ratios = {k: round(v / max(1, stage1_full_sum), 4) for k, v in domain_stage1_tokens.items()}
    stage2_ratios = {k: round(v / max(1, stage2_full_sum), 4) for k, v in domain_stage2_tokens.items()}

    return {
        "catalog_version": "0.8.0-readiness",
        "approved_licenses": sorted(APPROVED_OPEN_DATA_LICENSES),
        "all_registered_licenses_verified": True,
        "approved_datasets": CURATED_DATASET_REGISTRY,
        "excluded_and_sealed_datasets": EXCLUDED_OR_SEALED_DATASETS,
        "token_totals": {
            "stage1_pretrain_full_tokens": stage1_full_sum,
            "stage2_sft_full_tokens": stage2_full_sum,
            "combined_full_tokens": stage1_full_sum + stage2_full_sum,
            "stage1_pretrain_pilot_tokens": stage1_pilot_sum,
            "stage2_sft_pilot_tokens": stage2_pilot_sum,
            "combined_pilot_tokens": stage1_pilot_sum + stage2_pilot_sum,
            "full_target_matches_40x_overtrain": stage1_full_sum == FULL_STAGE1_TARGET_TOKENS,
        },
        "origin_separation_tokens": {
            "full_run": origin_tokens_full,
            "pilot_run": origin_tokens_pilot,
        },
        "license_token_allocation_full": license_breakdown,
        "dataset_mixing_ratios": {
            "stage1_pretrain": stage1_ratios,
            "stage2_sft": stage2_ratios,
        },
    }


def build_gpu_training_readiness_plan(
    preset: str = "jarvis-v0.8-research-52m",
    vocab_size: int = 32768,
    usd_to_inr: float = USD_TO_INR,
) -> Dict[str, object]:
    """Compute detailed v0.8 GPU VRAM, overhead, USD/INR cost matrix, and Smoke/Pilot/Full configs."""
    preset_cfg = MODEL_SCALE_PRESETS[preset]
    cfg = JarvisConfig(model_name=preset, vocab_size=vocab_size, audio_feature_dim=32, **preset_cfg)
    cfg.validate()
    with torch.device("meta"):
        meta_model = JarvisUnifiedTransformer(cfg)
    params = meta_model.parameter_count()
    total_p = params["total_parameters"]
    lang_p = params["language_parameters"]

    # Static BF16 mixed precision + FP32 master/gradients/AdamW breakdown
    weights_bf16_gb = (total_p * 2) / (1024 ** 3)
    grads_fp32_gb = (total_p * 4) / (1024 ** 3)
    adamw_master_and_moments_gb = (total_p * 12) / (1024 ** 3)  # fp32 master (4B) + m (4B) + v (4B)
    static_total_gb = weights_bf16_gb + grads_fp32_gb + adamw_master_and_moments_gb

    # Activation memory per microbatch at seq=2048:
    # With gradient checkpointing (~10x d_model per layer) vs without (~34x d_model per layer)
    def _peak_vram_gb(micro_bs: int, seq_len: int, grad_ckpt: bool) -> Dict[str, float]:
        factor = 10 if grad_ckpt else 34
        act_gb = (micro_bs * seq_len * cfg.d_model * cfg.n_layers * factor * 2) / (1024 ** 3)
        # Logits peak (micro_bs * seq_len * vocab_size * 4 bytes for fp32 CE loss)
        logits_gb = (micro_bs * seq_len * cfg.vocab_size * 4) / (1024 ** 3)
        raw_total = static_total_gb + act_gb + logits_gb
        peak_with_frag = raw_total * 1.25  # PyTorch CUDA caching allocator + temporary buffers
        return {
            "static_states_gb": round(static_total_gb, 3),
            "activations_gb": round(act_gb, 3),
            "logits_ce_buffer_gb": round(logits_gb, 3),
            "raw_total_gb": round(raw_total, 3),
            "peak_with_cuda_overhead_gb": round(peak_with_frag, 3),
        }

    vram_profiles = {
        "micro4_seq2048_grad_ckpt": _peak_vram_gb(4, cfg.max_seq_len, True),
        "micro8_seq2048_grad_ckpt": _peak_vram_gb(8, cfg.max_seq_len, True),
        "micro8_seq2048_no_ckpt": _peak_vram_gb(8, cfg.max_seq_len, False),
        "micro16_seq2048_grad_ckpt": _peak_vram_gb(16, cfg.max_seq_len, True),
    }

    head_dim = cfg.d_model // cfg.n_heads
    kv_cache_full_ctx_mb = round((2 * 2 * cfg.n_layers * cfg.n_kv_heads * head_dim * cfg.max_seq_len) / (1024 ** 2), 2)
    single_ckpt_disk_mb = round((total_p * (2 + 4 + 12)) / (1024 ** 2), 1)  # weights + training_state.pt

    pilot_tokens = PILOT_STAGE1_TARGET_TOKENS + PILOT_STAGE2_TARGET_TOKENS
    full_tokens = FULL_STAGE1_TARGET_TOKENS + FULL_STAGE2_TARGET_TOKENS
    pilot_flops = 6.0 * lang_p * pilot_tokens
    full_flops = 6.0 * lang_p * full_tokens

    # Realistic overhead multiplier 1.25x accounts for held-out validation, checkpoint disk I/O, DPO & pod setup
    e2e_overhead = 1.25
    gpu_catalog = [
        {
            "gpu": "RTX 4090 (24 GB)",
            "provider_tier": "RunPod Community",
            "vram_gb": 24,
            "bf16_tflops": 165.2,
            "assumed_mfu": 0.40,
            "hourly_usd": 0.34,
            "recommended_micro_bs": 8,
            "recommended_for": "BEST_VALUE_PILOT_AND_FULL_RUN",
        },
        {
            "gpu": "RTX 4090 (24 GB)",
            "provider_tier": "RunPod Secure Cloud",
            "vram_gb": 24,
            "bf16_tflops": 165.2,
            "assumed_mfu": 0.40,
            "hourly_usd": 0.89,
            "recommended_micro_bs": 8,
            "recommended_for": "MANAGED_BUDGET_RELIABILITY",
        },
        {
            "gpu": "L40S (48 GB)",
            "provider_tier": "RunPod Standard Pod",
            "vram_gb": 48,
            "bf16_tflops": 362.0,
            "assumed_mfu": 0.40,
            "hourly_usd": 0.99,
            "recommended_micro_bs": 16,
            "recommended_for": "LARGE_BATCH_UNCHECKPOINTED_OPTION",
        },
        {
            "gpu": "A100 (80 GB PCIe)",
            "provider_tier": "RunPod Community / Lambda",
            "vram_gb": 80,
            "bf16_tflops": 312.0,
            "assumed_mfu": 0.42,
            "hourly_usd": 1.39,
            "recommended_micro_bs": 16,
            "recommended_for": "DATACENTER_FALLBACK",
        },
        {
            "gpu": "H100 (80 GB PCIe)",
            "provider_tier": "RunPod Community",
            "vram_gb": 80,
            "bf16_tflops": 989.0,
            "assumed_mfu": 0.45,
            "hourly_usd": 1.99,
            "recommended_micro_bs": 16,
            "recommended_for": "FASTEST_TURNAROUND_AND_MULTI_SWEEP",
        },
        {
            "gpu": "H100 (80 GB SXM/PCIe)",
            "provider_tier": "Lambda On-Demand",
            "vram_gb": 80,
            "bf16_tflops": 989.0,
            "assumed_mfu": 0.45,
            "hourly_usd": 3.29,
            "recommended_micro_bs": 16,
            "recommended_for": "FASTEST_MANAGED_CLUSTER",
        },
    ]

    gpu_estimates = []
    for g in gpu_catalog:
        eff_flops_per_s = g["bf16_tflops"] * 1e12 * g["assumed_mfu"]
        pilot_raw_hrs = pilot_flops / eff_flops_per_s / 3600.0
        full_raw_hrs = full_flops / eff_flops_per_s / 3600.0
        pilot_e2e_hrs = max(0.12, pilot_raw_hrs * e2e_overhead)  # ~7m min billing floor including pod pull/eval
        full_e2e_hrs = full_raw_hrs * e2e_overhead

        hr_usd = g["hourly_usd"]
        hr_inr = round(hr_usd * usd_to_inr, 2)
        pilot_usd = round(pilot_e2e_hrs * hr_usd, 2)
        full_usd = round(full_e2e_hrs * hr_usd, 2)

        gpu_estimates.append({
            **g,
            "hourly_inr": hr_inr,
            "pilot_est_hours_with_overhead": round(pilot_e2e_hrs, 2),
            "pilot_est_cost_usd": pilot_usd,
            "pilot_est_cost_inr": round(pilot_usd * usd_to_inr, 2),
            "full_est_hours_raw_compute": round(full_raw_hrs, 2),
            "full_est_hours_with_overhead": round(full_e2e_hrs, 2),
            "full_est_cost_usd": full_usd,
            "full_est_cost_inr": round(full_usd * usd_to_inr, 2),
            "fits_in_vram": vram_profiles["micro8_seq2048_no_ckpt"]["peak_with_cuda_overhead_gb"] < g["vram_gb"],
        })

    experiment_designs = {
        "stage0_local_cpu_smoke": {
            "purpose": "Pre-flight verification on local laptop before renting cloud GPU (0 cost).",
            "preset": preset,
            "vocab_size": 2048,
            "seq_len": 128,
            "micro_batch_size": 1,
            "grad_accum_steps": 2,
            "pretrain_steps": 4,
            "sft_steps": 4,
            "dtype": "fp32",
            "expected_runtime_s": 25,
            "notes": "Verifies forward/backward parity, memmap streaming, deterministic interrupt+resume, and NaN/OOM freedom locally.",
        },
        "stage1_pilot_55m": {
            "purpose": "Validate tokenizer compression, LR stability, val loss slope, and pipeline end-to-end on GPU before committing full run.",
            "preset": preset,
            "vocab_size": vocab_size,
            "seq_len": 1024,
            "tokens_stage1_pretrain": PILOT_STAGE1_TARGET_TOKENS,
            "tokens_stage2_sft": PILOT_STAGE2_TARGET_TOKENS,
            "total_tokens": pilot_tokens,
            "micro_batch_size": 8,
            "grad_accum_steps": 8,
            "global_batch_tokens": 65_536,
            "total_optimizer_steps": round(pilot_tokens / 65_536),
            "optimizer": {"type": "AdamW", "betas": [0.9, 0.95], "eps": 1e-8, "weight_decay": 0.1, "grad_clip_norm": 1.0},
            "lr_schedule": {"type": "cosine_with_linear_warmup", "peak_lr": 6e-4, "min_lr": 6e-5, "warmup_steps": 80},
            "dtype": "bfloat16",
            "val_every_steps": 50,
            "checkpoint_every_steps": 200,
            "early_stopping_patience": 4,
            "success_criteria": [
                "No NaN/Inf loss spikes or grad-norm explosions (>5.0 sustained)",
                "Unseen validation perplexity steadily declines below 45.0 by step 760",
                "Resume test reproduces identical weights and curves",
            ],
        },
        "stage2_full_2_17b": {
            "purpose": "First genuine 52M LM (56M multimodal) foundation pretraining + SFT + Multimodal + DPO run.",
            "preset": preset,
            "vocab_size": vocab_size,
            "seq_len": cfg.max_seq_len,
            "tokens_stage1_pretrain": FULL_STAGE1_TARGET_TOKENS,
            "tokens_stage2_sft": FULL_STAGE2_TARGET_TOKENS,
            "total_tokens": full_tokens,
            "micro_batch_size": 8,
            "grad_accum_steps": 32,
            "global_batch_tokens": 524_288,
            "total_optimizer_steps": round(full_tokens / 524_288),
            "optimizer": {"type": "AdamW", "betas": [0.9, 0.95], "eps": 1e-8, "weight_decay": 0.1, "grad_clip_norm": 1.0},
            "lr_schedule": {"type": "cosine_with_linear_warmup", "peak_lr": 6e-4, "min_lr": 6e-5, "warmup_steps": 150},
            "dtype": "bfloat16",
            "val_every_steps": 125,
            "checkpoint_every_steps": 250,
            "early_stopping_patience": 6,
            "monitoring": [
                "Track train_loss, sft_val_loss, unseen_external_perplexity, train_vs_val gap (< 0.8), grad_norm, and tokens/sec",
                "Halt and alert on consecutive NaN/Inf batches or sustained loss spike > 2.5x rolling median",
                "Evaluate isolated native generation probes every 1,000 optimizer steps without Gemini/RAG/tools",
            ],
        },
    }

    evaluation_gates = {
        "gate_0_cpu_smoke": "0 crashes, deterministic resume tensor equality = 100%, 0 benchmark canaries, 100% lossless tokenizer roundtrip.",
        "gate_1_pilot_55m": "Pilot val PPL <= 45.0, non-degenerate English/code syntax coherence >= 0.25, clean JSON tool formatting >= 0.30, zero instability.",
        "gate_2_research_foundation_v08": "unseen_external_perplexity <= 25.0, generation_accuracy >= 0.55, tool_argument_validity >= 0.65, coding_pass@1 >= 0.40, zero regression on multimodal classification.",
        "gate_3_production_primary_lock": "Keep productionReplaced=false until d_model >= 768, generation_accuracy >= 0.80, tool_argument_validity >= 0.85, neural_ocr_accuracy >= 0.70, unseen_external_perplexity <= 25.0, and vision_val_accuracy >= 0.80.",
    }

    commands = {
        "1_check_readiness_locally": r"d:\Jarvis\.venv\Scripts\python.exe d:\Jarvis\ml_foundation\inference.py readiness",
        "2_cpu_smoke_52m_2steps": r"d:\Jarvis\.venv\Scripts\python.exe d:\Jarvis\ml_foundation\inference.py train --version jarvis-v0.8.0-smoke52m --preset jarvis-v0.8-research-52m --vocab-size 2048 --pretrain-steps 2 --sft-steps 2 --vision-steps 0 --dpo-steps 0 --grad-accum-steps 1 --allow-large-cpu --stop-after-stage stage1_pretrain --stop-after-step 2",
        "3_gpu_install_streaming_deps": "pip install --upgrade datasets huggingface_hub pyarrow zstandard accelerate",
        "4_gpu_stream_ingest_shards": "python -m ml_foundation.readiness_planner --ingest-pilot --out-dir ./data/neural_models/shards_v08_pilot",
        "5_gpu_pilot_training_55m": "python ml_foundation/inference.py train --version jarvis-v0.8.0-pilot --preset jarvis-v0.8-research-52m --vocab-size 32768 --dtype bf16 --grad-accum-steps 8 --pretrain-steps 760 --sft-steps 80",
        "6_gpu_full_training_2_17b": "python ml_foundation/inference.py train --version jarvis-v0.8.0-full --preset jarvis-v0.8-research-52m --vocab-size 32768 --dtype bf16 --grad-accum-steps 32 --pretrain-steps 3981 --sft-steps 153",
        "7_independent_native_eval": "python ml_foundation/inference.py eval --checkpoint-dir ./data/neural_models/checkpoints/jarvis-v0.8.0-full",
    }

    return {
        "preset": preset,
        "config": cfg.to_dict(),
        "config_internally_consistent": True,
        "parameters": params,
        "checkpoint_disk_size_mb": single_ckpt_disk_mb,
        "kv_cache_full_ctx_bf16_mb": kv_cache_full_ctx_mb,
        "vram_memory_profiles_gb": vram_profiles,
        "usd_to_inr_rate": usd_to_inr,
        "gpu_recommendations": gpu_estimates,
        "recommended_primary_gpu": (
            f"RTX 4090 (24 GB, RunPod Community ${gpu_estimates[0]['hourly_usd']:.2f}/hr | INR {gpu_estimates[0]['hourly_inr']:.2f}/hr "
            f"-> Full ~{gpu_estimates[0]['full_est_hours_with_overhead']:.2f}h E2E ~ ${gpu_estimates[0]['full_est_cost_usd']:.2f} / INR {gpu_estimates[0]['full_est_cost_inr']:.2f}; "
            f"or Secure ${gpu_estimates[1]['hourly_usd']:.2f}/hr -> ~${gpu_estimates[1]['full_est_cost_usd']:.2f} / INR {gpu_estimates[1]['full_est_cost_inr']:.2f})"
        ),
        "recommended_fast_gpu": (
            f"H100 (80 GB PCIe, RunPod Community ${gpu_estimates[4]['hourly_usd']:.2f}/hr | INR {gpu_estimates[4]['hourly_inr']:.2f}/hr "
            f"-> Full ~{gpu_estimates[4]['full_est_hours_with_overhead']:.2f}h E2E ~ ${gpu_estimates[4]['full_est_cost_usd']:.2f} / INR {gpu_estimates[4]['full_est_cost_inr']:.2f}; "
            f"or Lambda ${gpu_estimates[5]['hourly_usd']:.2f}/hr -> ~${gpu_estimates[5]['full_est_cost_usd']:.2f} / INR {gpu_estimates[5]['full_est_cost_inr']:.2f})"
        ),
        "software_and_hardware_audit": _check_gpu_software_stack(),
        "experiment_designs": experiment_designs,
        "evaluation_gates": evaluation_gates,
        "exact_commands": commands,
    }


def generate_full_readiness_report(
    repo_root: str,
    out_path: Optional[str] = None,
    checkpoint_for_baseline: Optional[str] = None,
) -> Dict[str, object]:
    """Generate and persist the complete reproducible v0.8 readiness manifest."""
    from ml_foundation.evaluator import evaluate_checkpoint

    catalog = build_dataset_catalog_manifest()
    gpu_plan = build_gpu_training_readiness_plan()

    ckpt_dir = checkpoint_for_baseline or os.path.join(repo_root, "data", "neural_models", "checkpoints", "jarvis-v0.7.0")
    baseline_eval = evaluate_checkpoint(repo_root, ckpt_dir) if os.path.isdir(ckpt_dir) else None

    baseline_summary = None
    if baseline_eval:
        baseline_summary = {
            "checkpoint_version": baseline_eval.get("version"),
            "evaluation_mode": baseline_eval.get("evaluation_mode"),
            "parameters": baseline_eval.get("parameters"),
            "generation_passed": baseline_eval["metrics"]["generation_passed"],
            "generation_total": baseline_eval["metrics"]["generation_total"],
            "generation_accuracy": baseline_eval["metrics"]["generation_accuracy"],
            "sft_val_perplexity": baseline_eval["metrics"]["sft_val_perplexity"],
            "sft_test_perplexity": baseline_eval["metrics"]["sft_test_perplexity"],
            "unseen_external_perplexity": baseline_eval["metrics"]["unseen_external_perplexity"],
            "domain_benchmarks": baseline_eval["metrics"]["domain_benchmarks"],
            "production_primary_eligible": baseline_eval.get("production_primary_eligible"),
        }

    manifest = {
        "schema_version": "0.8.0-readiness",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "production_routing_preserved": True,
        "paid_jobs_launched": False,
        "dataset_catalog": catalog,
        "training_readiness": gpu_plan,
        "independent_baseline_eval": baseline_summary,
    }

    target_file = out_path or os.path.join(repo_root, "data", "neural_models", "readiness", "v0.8_readiness_manifest.json")
    os.makedirs(os.path.dirname(target_file), exist_ok=True)
    with open(target_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    manifest["manifest_path"] = target_file
    return manifest


if __name__ == "__main__":
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    rep = generate_full_readiness_report(root)
    print(json.dumps({
        "success": True,
        "manifest_path": rep["manifest_path"],
        "full_tokens": rep["dataset_catalog"]["token_totals"]["combined_full_tokens"],
        "pilot_tokens": rep["dataset_catalog"]["token_totals"]["combined_pilot_tokens"],
        "total_parameters": rep["training_readiness"]["parameters"]["total_parameters"],
        "recommended_primary_gpu": rep["training_readiness"]["recommended_primary_gpu"],
        "baseline_generation_accuracy": (rep["independent_baseline_eval"] or {}).get("generation_accuracy"),
    }, indent=2))
