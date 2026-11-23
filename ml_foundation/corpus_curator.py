"""
VISION — MADE BY LOKESH | Storage-Budgeted Multi-Domain Corpus Acquisition & Memmap Curator
(`ml_foundation/corpus_curator.py`)

Acquires verified permissive Hugging Face datasets directly to `D:\\Jarvis\\data\\corpus_raw`,
validates free disk headroom (`>= 20 GB` D:, `>= 10 GB` C:), enforces license & non-gated provenance,
scrubs PII and evaluation canaries, deduplicates via SHA-256 + bounded MinHash-LSH, balances
domains cleanly, trains `JarvisBPE v2` (`byte_bpe_v2`), and writes memory-mapped `uint32`/`int32`
shards for scalable Stage 1 Pretraining & Stage 2 SFT within 7.69 GB host RAM.
"""

from __future__ import annotations

import datetime
import gc
import gzip
import hashlib
import json
import os
import random
import re
import shutil
import time
from typing import Dict, Iterable, Iterator, List, Optional, Set, Tuple

# Ensure HF cache & temp stay off C: BEFORE importing huggingface_hub/pyarrow
DEFAULT_HF_CACHE = os.path.join("D:\\Jarvis\\data\\hf_cache")
DEFAULT_TMP_DIR = os.path.join("D:\\Jarvis\\data\\tmp")
os.environ.setdefault("HF_HOME", DEFAULT_HF_CACHE)
os.environ.setdefault("HF_HUB_CACHE", os.path.join(DEFAULT_HF_CACHE, "hub"))
os.environ.setdefault("HF_DATASETS_CACHE", os.path.join(DEFAULT_HF_CACHE, "datasets"))
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("TMP", DEFAULT_TMP_DIR)
os.environ.setdefault("TEMP", DEFAULT_TMP_DIR)

import numpy as np
import pyarrow.parquet as pq
from huggingface_hub import HfApi, hf_hub_download

from ml_foundation.dataset_builder import (
    BENCHMARK_CANARY_STRINGS,
    build_unified_datasets,
    sanitize_and_filter_text,
)
from ml_foundation.evaluator import UNSEEN_EXTERNAL_EVAL_SNIPPETS
from ml_foundation.tokenizer import JarvisBPE

_MH_A = np.asarray(
    [2654435761 + i * 2246822519 for i in range(32)], dtype=np.uint64
) & np.uint64(0xFFFFFFFF)
_MH_B = np.asarray(
    [3266489917 + i * 668265263 for i in range(32)], dtype=np.uint64
) & np.uint64(0xFFFFFFFF)


def _fast_minhash_sig(norm_text: str) -> Optional[Tuple[int, ...]]:
    """Vectorized NumPy 32-perm MinHash signature on leading 1000 chars (~60x faster than Python loop)."""
    import zlib
    snippet = norm_text[:1000]
    words = snippet.split()
    if len(words) >= 6:
        shingles = [
            zlib.crc32((" ".join(words[i : i + 4])).encode("utf-8", "ignore"))
            for i in range(min(len(words) - 3, 180))
        ]
    else:
        b = snippet.encode("utf-8", "ignore")
        if len(b) < 16:
            return None
        shingles = [zlib.crc32(b[i : i + 12]) for i in range(0, min(len(b) - 11, 480), 4)]
    if not shingles:
        return None
    arr = np.asarray(shingles, dtype=np.uint64)[:, None]
    mins = ((arr * _MH_A + _MH_B) & np.uint64(0xFFFFFFFF)).min(axis=0)
    return tuple(int(x) for x in mins)


APPROVED_CURATION_LICENSES = {"apache-2.0", "mit", "odc-by", "cc-by-4.0", "psf-2.0", "bsd-3-clause", "bsd-2-clause", "cc0-1.0"}

# Held-out probe phrases from ml_foundation/evaluator.py so test benchmarks never enter training shards
EVAL_PROBE_CANARIES: List[str] = list(BENCHMARK_CANARY_STRINGS) + list(UNSEEN_EXTERNAL_EVAL_SNIPPETS) + [
    "explain in clear prose why automated systems separate verified measurements from guesses",
    "hinglish mein batayein ki neural network testing mein held-out validation split kyun zaroori hai",
    "इमरजेंसी स्टॉप बटन क्यों लगाया जाता है",
    "solve the linear equation 4*x + 9 = 29 for x",
    "compute the kinetic energy in joules of a 4 kg object moving at 3 m/s",
    "write a python function add_two(a, b) returning a + b",
    "write a python function is_even(n) returning true if n is even else false",
    "write a javascript function multiplytwo(a, b) that returns a * b",
    "write a javascript function ispositive(n) returning true when n > 0",
    "write a java static method maxoftwo(int a, int b)",
    "two 6 ohm resistors are wired in parallel, then wired in series with a 2 ohm resistor",
    "a rover travels at 5 m/s for 6 seconds, stops, then moves 12 meters backward",
    "draft whatsapp message to lokesh saying hii",
    "stage_whatsapp_message",
    "in robotics control, what does the derivative (d) term in a pid controller reduce during joint movement",
    "a 6-dof robotic actuator operates at 24 v and draws 2.5 a. calculate electrical power in watts",
]


def _drive_free_gb(path: str) -> float:
    drive = os.path.splitdrive(os.path.abspath(path))[0] or "D:"
    usage = shutil.disk_usage(drive + "\\")
    return round(usage.free / (1024 ** 3), 3)


def check_storage_budget(
    raw_dir: str,
    planned_add_gb: float = 0.0,
    min_free_d_gb: float = 20.0,
    min_free_c_gb: float = 10.0,
) -> Dict[str, object]:
    d_free = _drive_free_gb(raw_dir)
    c_free = _drive_free_gb("C:\\")
    safe = (d_free - planned_add_gb) >= min_free_d_gb and c_free >= min_free_c_gb
    return {
        "c_free_gb": c_free,
        "d_free_gb": d_free,
        "planned_add_gb": round(planned_add_gb, 3),
        "min_free_c_gb": min_free_c_gb,
        "min_free_d_gb": min_free_d_gb,
        "safe": safe,
    }


ACQUISITION_PLAN: List[Dict[str, object]] = [
    {
        "id": "cosmopedia_openstax",
        "repo_id": "HuggingFaceTB/cosmopedia",
        "revision": "0ae6ec63f917",
        "license": "Apache-2.0",
        "origin_class": "synthetic",
        "domain": "science_engineering",
        "stage_role": "pretrain",
        "files": ["data/openstax/train-00000-of-00002.parquet", "data/openstax/train-00001-of-00002.parquet"],
        "est_gb": 0.323,
    },
    {
        "id": "cosmopedia_khanacademy",
        "repo_id": "HuggingFaceTB/cosmopedia",
        "revision": "0ae6ec63f917",
        "license": "Apache-2.0",
        "origin_class": "synthetic",
        "domain": "science_math",
        "stage_role": "pretrain",
        "files": ["data/khanacademy/train-00000-of-00001.parquet"],
        "est_gb": 0.046,
    },
    {
        "id": "cosmopedia_stanford",
        "repo_id": "HuggingFaceTB/cosmopedia",
        "revision": "0ae6ec63f917",
        "license": "Apache-2.0",
        "origin_class": "synthetic",
        "domain": "general_academic",
        "stage_role": "pretrain",
        "files": ["data/stanford/train-00000-of-00013.parquet"],
        "est_gb": 0.236,
    },
    {
        "id": "cosmopedia_wikihow",
        "repo_id": "HuggingFaceTB/cosmopedia",
        "revision": "0ae6ec63f917",
        "license": "Apache-2.0",
        "origin_class": "synthetic",
        "domain": "multistep_reasoning",
        "stage_role": "pretrain",
        "files": ["data/wikihow/train-00000-of-00002.parquet"],
        "est_gb": 0.234,
    },
    {
        "id": "finemath_4plus",
        "repo_id": "HuggingFaceTB/finemath",
        "revision": "e92b25a61673",
        "license": "ODC-By-1.0",
        "origin_class": "public",
        "domain": "mathematics",
        "stage_role": "pretrain",
        "files": ["finemath-4plus/train-00000-of-00064.parquet"],
        "est_gb": 0.274,
    },
    {
        "id": "fineweb_edu_10bt_s0",
        "repo_id": "HuggingFaceFW/fineweb-edu",
        "revision": "87f09149ef47",
        "license": "ODC-By-1.0",
        "origin_class": "public",
        "domain": "language",
        "stage_role": "pretrain",
        "files": ["sample/10BT/000_00000.parquet"],
        "est_gb": 2.005,
    },
    {
        "id": "sangraha_hindi_verified",
        "repo_id": "ai4bharat/sangraha",
        "revision": "8b813c3f62d3",
        "license": "CC-BY-4.0",
        "origin_class": "curated",
        "domain": "hindi_devanagari",
        "stage_role": "pretrain",
        "files": ["verified/hin/data-0.parquet"],
        "est_gb": 0.352,
    },
    {
        "id": "sangraha_hinglish_wiki",
        "repo_id": "ai4bharat/sangraha",
        "revision": "8b813c3f62d3",
        "license": "CC-BY-4.0",
        "origin_class": "synthetic",
        "domain": "hinglish",
        "stage_role": "pretrain",
        "files": ["synthetic/hin_Latn/wiki_hin_Latn_0000_of_0063.parquet"],
        "est_gb": 0.168,
    },
    {
        "id": "numina_math_cot",
        "repo_id": "AI-MO/NuminaMath-CoT",
        "revision": "9d8d210c9f6a",
        "license": "Apache-2.0",
        "origin_class": "curated",
        "domain": "mathematics",
        "stage_role": "sft",
        "files": ["data/train-00000-of-00005.parquet", "data/train-00001-of-00005.parquet"],
        "est_gb": 0.460,
    },
    {
        "id": "magicoder_oss_instruct_75k",
        "repo_id": "ise-uiuc/Magicoder-OSS-Instruct-75K",
        "revision": "5f839b1f368a",
        "license": "MIT",
        "origin_class": "synthetic",
        "domain": "coding",
        "stage_role": "sft",
        "files": ["data-oss_instruct-decontaminated.jsonl"],
        "est_gb": 0.189,
    },
    {
        "id": "codefeedback_filtered",
        "repo_id": "m-a-p/CodeFeedback-Filtered-Instruction",
        "revision": "a08c213a9748",
        "license": "Apache-2.0",
        "origin_class": "curated",
        "domain": "coding",
        "stage_role": "sft",
        "files": ["CodeFeedback-Filtered-Instruction.jsonl"],
        "est_gb": 0.346,
    },
    {
        "id": "sc2_exec_python_50k",
        "repo_id": "bigcode/self-oss-instruct-sc2-exec-filter-50k",
        "revision": "356bb069eee8",
        "license": "ODC-By-1.0",
        "origin_class": "synthetic",
        "domain": "coding_python",
        "stage_role": "sft",
        "files": ["data/train-00000-of-00001.parquet"],
        "est_gb": 0.084,
    },
    {
        "id": "commitpackft_swe",
        "repo_id": "bigcode/commitpackft",
        "revision": "fc56fe33c030",
        "license": "MIT",
        "origin_class": "public",
        "domain": "software_engineering",
        "stage_role": "sft",
        "files": [
            "data/python/data.jsonl",
            "data/javascript/data.jsonl",
            "data/java/data.jsonl",
            "data/c++/data.jsonl",
            "data/json/data.jsonl",
        ],
        "est_gb": 0.396,
    },
    {
        "id": "webinstruct_stem",
        "repo_id": "TIGER-Lab/WebInstructSub",
        "revision": "559b33b6bcd3",
        "license": "Apache-2.0",
        "origin_class": "curated",
        "domain": "science_engineering",
        "stage_role": "sft",
        "files": ["data/train-00000-of-00013.parquet"],
        "est_gb": 0.129,
    },
    {
        "id": "oasst2_trees",
        "repo_id": "OpenAssistant/oasst2",
        "revision": "179dd21fc551",
        "license": "Apache-2.0",
        "origin_class": "curated",
        "domain": "instruction_multilingual",
        "stage_role": "sft",
        "files": ["2023-11-05_oasst2_ready.trees.jsonl.gz"],
        "est_gb": 0.051,
    },
    {
        "id": "glaive_function_calling_v2",
        "repo_id": "glaiveai/glaive-function-calling-v2",
        "revision": "e7f4b6456019",
        "license": "Apache-2.0",
        "origin_class": "synthetic",
        "domain": "tool_use",
        "stage_role": "sft",
        "files": ["glaive-function-calling-v2.json"],
        "est_gb": 0.253,
    },
    {
        "id": "hermes_function_calling_v1",
        "repo_id": "NousResearch/hermes-function-calling-v1",
        "revision": "dae3e1d28cfb",
        "license": "Apache-2.0",
        "origin_class": "synthetic",
        "domain": "tool_use",
        "stage_role": "sft",
        "files": ["func-calling-singleturn.json", "json-mode-singleturn.json"],
        "est_gb": 0.020,
    },
    {
        "id": "smangrul_hindi_instruct",
        "repo_id": "smangrul/hindi_instruct_v1",
        "revision": "cce18e200f96",
        "license": "MIT",
        "origin_class": "curated",
        "domain": "hindi_devanagari",
        "stage_role": "sft",
        "files": ["data/train-00000-of-00001.parquet"],
        "est_gb": 0.012,
    },
    {
        "id": "damerajee_small_hindi_instruct",
        "repo_id": "damerajee/small-hindi-instruct",
        "revision": "52d6767d4732",
        "license": "Apache-2.0",
        "origin_class": "curated",
        "domain": "hinglish_dialog",
        "stage_role": "sft",
        "files": ["reasoning34.csv"],
        "est_gb": 0.0001,
    },
    {
        "id": "cognitivelab_hindi_instruct",
        "repo_id": "CognitiveLab/Hindi-Instruct-Gemma-Prompt-formate",
        "revision": "94e5a881d4f7",
        "license": "Apache-2.0",
        "origin_class": "curated",
        "domain": "hindi_devanagari",
        "stage_role": "sft",
        "files": ["data/train-00000-of-00004.parquet"],
        "est_gb": 0.160,
    },
    {
        "id": "cosmopedia_auto_math_text",
        "repo_id": "HuggingFaceTB/cosmopedia",
        "revision": "0ae6ec63f917",
        "license": "Apache-2.0",
        "origin_class": "synthetic",
        "domain": "mathematics",
        "stage_role": "pretrain",
        "files": ["data/auto_math_text/train-00000-of-00018.parquet"],
        "est_gb": 0.231,
    },
    {
        "id": "gsm8k_train",
        "repo_id": "openai/gsm8k",
        "revision": "740312add88f",
        "license": "MIT",
        "origin_class": "curated",
        "domain": "mathematics",
        "stage_role": "sft",
        "files": ["main/train-00000-of-00001.parquet"],
        "est_gb": 0.002,
    },
    {
        "id": "orca_math_200k",
        "repo_id": "microsoft/orca-math-word-problems-200k",
        "revision": "29255d1770cc",
        "license": "MIT",
        "origin_class": "synthetic",
        "domain": "mathematics",
        "stage_role": "sft",
        "files": ["data/train-00000-of-00001.parquet"],
        "est_gb": 0.079,
    },
    {
        "id": "magicoder_evol_instruct_110k",
        "repo_id": "ise-uiuc/Magicoder-Evol-Instruct-110K",
        "revision": "b0079beaa036",
        "license": "Apache-2.0",
        "origin_class": "synthetic",
        "domain": "coding",
        "stage_role": "sft",
        "files": ["data-evol_instruct-decontaminated.jsonl"],
        "est_gb": 0.238,
    },
    {
        "id": "commitpackft_c_ts_sql",
        "repo_id": "bigcode/commitpackft",
        "revision": "fc56fe33c030",
        "license": "MIT",
        "origin_class": "public",
        "domain": "software_engineering",
        "stage_role": "sft",
        "files": [
            "data/c/data.jsonl",
            "data/typescript/data.jsonl",
            "data/sql/data.jsonl",
        ],
        "est_gb": 0.037,
    },
    {
        "id": "mmlu_aux_train",
        "repo_id": "cais/mmlu",
        "revision": "c30699e8356d",
        "license": "MIT",
        "origin_class": "curated",
        "domain": "science_knowledge",
        "stage_role": "sft",
        "files": ["all/auxiliary_train-00000-of-00001.parquet"],
        "est_gb": 0.044,
    },
]


def acquire_verified_datasets(
    raw_dir: str,
    include_ids: Optional[Set[str]] = None,
    min_free_d_gb: float = 20.0,
    min_free_c_gb: float = 10.0,
) -> Dict[str, object]:
    """Verify repo metadata/licenses online and download selected permissive datasets strictly onto D:."""
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(DEFAULT_HF_CACHE, exist_ok=True)
    os.makedirs(DEFAULT_TMP_DIR, exist_ok=True)

    api = HfApi()
    repo_checks: Dict[str, Dict[str, object]] = {}
    acquired: List[Dict[str, object]] = []
    skipped: List[Dict[str, object]] = []
    total_downloaded_bytes = 0
    total_files = 0
    t0 = time.perf_counter()

    for item in ACQUISITION_PLAN:
        item_id = str(item["id"])
        if include_ids is not None and item_id not in include_ids:
            continue
        repo_id = str(item["repo_id"])

        # Verify HF metadata & license once per repo
        if repo_id not in repo_checks:
            try:
                info = api.dataset_info(repo_id, files_metadata=False)
                card = info.card_data.to_dict() if info.card_data else {}
                raw_lic = card.get("license")
                if isinstance(raw_lic, list):
                    lic_ok = any(str(x).strip().lower() in APPROVED_CURATION_LICENSES for x in raw_lic)
                else:
                    lic_ok = str(raw_lic or "").strip().lower() in APPROVED_CURATION_LICENSES
                repo_checks[repo_id] = {
                    "ok": bool((not info.gated) and lic_ok),
                    "gated": bool(info.gated),
                    "card_license": raw_lic,
                    "head_sha": (info.sha or "")[:12],
                }
            except Exception as exc:
                repo_checks[repo_id] = {"ok": False, "error": str(exc)}

        rcheck = repo_checks[repo_id]
        if not rcheck.get("ok"):
            skipped.append({"id": item_id, "repo_id": repo_id, "reason": f"Failed provenance check: {rcheck}"})
            continue

        budget = check_storage_budget(
            raw_dir,
            planned_add_gb=float(item["est_gb"]),
            min_free_d_gb=min_free_d_gb,
            min_free_c_gb=min_free_c_gb,
        )
        if not budget["safe"]:
            skipped.append({"id": item_id, "repo_id": repo_id, "reason": f"Storage budget exceeded: {budget}"})
            continue

        repo_local = os.path.join(raw_dir, repo_id.replace("/", "__"))
        os.makedirs(repo_local, exist_ok=True)
        dl_files: List[Dict[str, object]] = []
        item_bytes = 0
        for rel_file in item["files"]:  # type: ignore[attr-defined]
            target_local = os.path.join(repo_local, str(rel_file).replace("/", os.sep))
            if os.path.exists(target_local) and os.path.getsize(target_local) > 0:
                fbytes = os.path.getsize(target_local)
            else:
                out_path = hf_hub_download(
                    repo_id=repo_id,
                    filename=str(rel_file),
                    repo_type="dataset",
                    revision=str(item["revision"]),
                    local_dir=repo_local,
                    cache_dir=os.path.join(DEFAULT_HF_CACHE, "hub"),
                )
                fbytes = os.path.getsize(out_path)
            item_bytes += fbytes
            total_downloaded_bytes += fbytes
            total_files += 1
            dl_files.append({"file": str(rel_file), "local_path": target_local, "bytes": fbytes})

        acquired.append({
            "id": item_id,
            "repo_id": repo_id,
            "revision": item["revision"],
            "license": item["license"],
            "card_license": rcheck.get("card_license"),
            "origin_class": item["origin_class"],
            "domain": item["domain"],
            "stage_role": item["stage_role"],
            "downloaded_bytes": item_bytes,
            "downloaded_gb": round(item_bytes / (1024 ** 3), 4),
            "files": dl_files,
        })

    # Clean duplicate HF hub blobs if local_dir already holds the standalone files (never deletes corpus_raw!)
    hub_cache = os.path.join(DEFAULT_HF_CACHE, "hub")
    if os.path.isdir(hub_cache):
        try:
            shutil.rmtree(hub_cache, ignore_errors=True)
        except Exception:
            pass

    manifest = {
        "schema_version": "1.0.0",
        "acquired_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "elapsed_s": round(time.perf_counter() - t0, 2),
        "raw_dir": raw_dir,
        "total_downloaded_bytes": total_downloaded_bytes,
        "total_downloaded_gb": round(total_downloaded_bytes / (1024 ** 3), 4),
        "total_files": total_files,
        "post_storage": check_storage_budget(raw_dir, min_free_d_gb=min_free_d_gb, min_free_c_gb=min_free_c_gb),
        "acquired": acquired,
        "skipped": skipped,
    }
    mpath = os.path.join(raw_dir, "acquisition_manifest.json")
    with open(mpath, "w", encoding="utf-8") as mf:
        json.dump(manifest, mf, indent=2)
    manifest["manifest_path"] = mpath
    return manifest


class _CanaryDedupFilter:
    """Fast memory-bounded exact hash (64-bit) + LSH + evaluation canary scrubber."""

    def __init__(self, max_lsh_docs: int = 120_000, near_dup_threshold: float = 0.78) -> None:
        self.seen_u64: Set[int] = set()
        self.lsh_index: Dict[Tuple[int, Tuple[int, ...]], List[Tuple[int, ...]]] = {}
        self.max_lsh_docs = max_lsh_docs
        self.lsh_docs_count = 0
        self.near_dup_threshold = near_dup_threshold
        self.canary_norms = [" ".join(c.lower().split()) for c in EVAL_PROBE_CANARIES if len(c) >= 12]
        self.canary_8grams: Set[Tuple[str, ...]] = set()
        for cn in self.canary_norms:
            w = cn.split()
            for i in range(max(0, len(w) - 7)):
                self.canary_8grams.add(tuple(w[i : i + 8]))

    def is_canary(self, text: str) -> bool:
        norm = " ".join(str(text or "").lower().split())
        for cn in self.canary_norms:
            if cn in norm:
                return True
        words = norm.split()
        if len(words) >= 8:
            for i in range(len(words) - 7):
                if tuple(words[i : i + 8]) in self.canary_8grams:
                    return True
        return False

    def accept(self, clean_text: str, check_near_dup: bool = True) -> Tuple[bool, str]:
        if self.is_canary(clean_text):
            return False, "canary"
        norm = " ".join(clean_text.lower().split())
        h64 = int.from_bytes(hashlib.sha256(norm.encode("utf-8")).digest()[:8], "big")
        if h64 in self.seen_u64:
            return False, "exact_dup"
        if check_near_dup and self.lsh_docs_count < self.max_lsh_docs:
            sig = _fast_minhash_sig(norm)
            if sig is not None:
                bands = [(bi, sig[bi * 4 : (bi + 1) * 4]) for bi in range(8)]
                cands: List[Tuple[int, ...]] = []
                for bk in bands:
                    cands.extend(self.lsh_index.get(bk, ()))
                seen_cand = False
                for c in cands[:20]:
                    matches = sum(1 for x, y in zip(sig, c) if x == y)
                    if (matches / 32.0) >= self.near_dup_threshold:
                        seen_cand = True
                        break
                if seen_cand:
                    return False, "minhash_dup"
                for bk in bands:
                    bucket = self.lsh_index.setdefault(bk, [])
                    if len(bucket) < 10:
                        bucket.append(sig)
                self.lsh_docs_count += 1
        self.seen_u64.add(h64)
        return True, "ok"


def _iter_parquet_rows(path: str, cols: Optional[List[str]] = None, limit: int = 200_000) -> Iterator[Dict[str, object]]:
    pf = pq.ParquetFile(path)
    avail = set(pf.schema_arrow.names)
    use_cols = [c for c in (cols or list(avail)) if c in avail] or None
    seen = 0
    for batch in pf.iter_batches(batch_size=512, columns=use_cols):
        for row in batch.to_pylist():
            yield row
            seen += 1
            if seen >= limit:
                return


def _iter_json_or_jsonl(path: str, limit: int = 200_000) -> Iterator[Dict[str, object]]:
    seen = 0
    if path.endswith(".jsonl.gz"):
        with gzip.open(path, "rt", encoding="utf-8", errors="ignore") as f:
            for line in f:
                s = line.strip()
                if s:
                    try:
                        obj = json.loads(s)
                        if isinstance(obj, dict):
                            yield obj
                            seen += 1
                    except Exception:
                        continue
                if seen >= limit:
                    return
    elif path.endswith(".jsonl"):
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                s = line.strip()
                if s:
                    try:
                        obj = json.loads(s)
                        if isinstance(obj, dict):
                            yield obj
                            seen += 1
                    except Exception:
                        continue
                if seen >= limit:
                    return
    elif path.endswith(".json"):
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            data = json.load(f)
        if isinstance(data, list):
            for obj in data:
                if isinstance(obj, dict):
                    yield obj
                    seen += 1
                    if seen >= limit:
                        return


def _extract_pretrain_records(item: Dict[str, object], max_docs: int) -> Iterator[Tuple[str, str]]:
    iid = str(item["id"])
    dom = str(item["domain"])
    per_file = max(1, max_docs // max(1, len(item["files"])))  # type: ignore[arg-type]
    for fmeta in item["files"]:  # type: ignore[attr-defined]
        lp = str(fmeta["local_path"])
        if not os.path.exists(lp):
            continue
        for row in _iter_parquet_rows(lp, cols=["text"], limit=per_file):
            txt = str(row.get("text") or "").strip()
            if len(txt) >= 60:
                yield txt[:3000], dom


def _compact_tool_sys(raw_sys: str) -> str:
    """Summarize verbose tool JSON schemas into compact tool signatures fitting SFT blocks."""
    names = re.findall(r'"name"\s*:\s*"([A-Za-z0-9_\-\.]+)"', raw_sys)
    if names:
        seen: List[str] = []
        for nm in names:
            if nm not in seen:
                seen.append(nm)
        return "Available tools: [" + ", ".join(seen[:6]) + "]"
    cleaned = raw_sys.replace("SYSTEM:", "").strip()
    return cleaned[:160]


def _parse_glaive_or_hermes_tool(raw_sys: str, conv_txt_or_list) -> Optional[Tuple[str, str, str]]:
    """Extract crisp single-turn user->assistant tool call JSON or JSON-mode pairs."""
    if isinstance(conv_txt_or_list, list):
        # Hermes conversations: list of {from, value}
        sys_msg = ""
        user_msg = ""
        asst_msg = ""
        for turn in conv_txt_or_list:
            role = str(turn.get("from", "")).lower()
            val = str(turn.get("value", "")).strip()
            if role == "system":
                sys_msg = val
            elif role in ("human", "user") and not user_msg:
                user_msg = val
            elif role in ("gpt", "assistant", "model") and user_msg and not asst_msg:
                asst_msg = val
        if not user_msg or not asst_msg:
            return None
        # Convert `<tool_call>{"name": ..., "arguments": ...}</tool_call>` to VISION schema
        m = re.search(r"<tool_call>\s*(\{[\s\S]*?\})\s*</tool_call>", asst_msg)
        if m:
            try:
                obj = json.loads(m.group(1))
                norm = json.dumps({"tool": obj.get("name", obj.get("tool")), "arguments": obj.get("arguments", {})}, ensure_ascii=False)
                asst_msg = f"<|tool_call|>{norm}<|/tool_call|>"
            except Exception:
                return None
        is_json_mode = asst_msg.lstrip().startswith("{") and asst_msg.rstrip().endswith("}")
        if "<|tool_call|>" not in asst_msg and not is_json_mode:
            return None
        compact_sys = _compact_tool_sys(sys_msg) if sys_msg else ""
        instr = f"{compact_sys}\n{user_msg[:260]}".strip() if compact_sys else user_msg[:300]
        return instr, asst_msg[:360], "tool_use"

    # Glaive format: SYSTEM + USER: ... ASSISTANT: ... <functioncall> {...}
    chat = str(conv_txt_or_list or "")
    u_m = re.search(r"USER:\s*([\s\S]*?)\n\s*ASSISTANT:", chat)
    if not u_m:
        return None
    user_q = u_m.group(1).strip()
    after = chat[u_m.end():].split("\nUSER:")[0].strip()
    fc_m = re.search(r"<functioncall>\s*(\{[\s\S]*?\})", after)
    if not fc_m:
        return None
    try:
        obj = json.loads(fc_m.group(1).strip().rstrip("'"))
        args = obj.get("arguments", {})
        if isinstance(args, str):
            args = json.loads(args)
        norm = json.dumps({"tool": obj.get("name"), "arguments": args}, ensure_ascii=False)
        resp = f"<|tool_call|>{norm}<|/tool_call|>"
    except Exception:
        return None
    if len(user_q) < 10 or len(resp) < 16:
        return None
    compact_sys = _compact_tool_sys(raw_sys) if raw_sys else ""
    instr = f"{compact_sys}\nUser asks: {user_q[:240]}" if compact_sys else user_q[:280]
    return instr, resp[:360], "tool_use"


def _extract_sft_records(item: Dict[str, object], max_pairs: int) -> Iterator[Tuple[str, str, str]]:
    iid = str(item["id"])
    dom = str(item["domain"])
    files = list(item["files"])  # type: ignore[arg-type]
    per_file = max(1, max_pairs // max(1, len(files)))
    for fmeta in files:
        lp = str(fmeta["local_path"])
        if not os.path.exists(lp):
            continue
        if iid == "numina_math_cot":
            kept = 0
            for r in _iter_parquet_rows(lp, cols=["problem", "solution"], limit=per_file * 4):
                p, s = str(r.get("problem") or "").strip(), str(r.get("solution") or "").strip()
                if 16 <= len(p) <= 700 and 16 <= len(s) <= 1050:
                    yield p, s, "mathematics"
                    kept += 1
                    if kept >= per_file:
                        break
        elif iid == "magicoder_oss_instruct_75k":
            kept = 0
            for r in _iter_json_or_jsonl(lp, limit=per_file * 6):
                p, s = str(r.get("problem") or "").strip(), str(r.get("solution") or "").strip()
                lang = str(r.get("lang") or "coding").lower()
                if 16 <= len(p) <= 700 and 16 <= len(s) <= 1050:
                    yield p, s, f"coding_{lang}" if lang in ("python", "javascript", "java") else "coding"
                    kept += 1
                    if kept >= per_file:
                        break
        elif iid == "codefeedback_filtered":
            kept = 0
            for r in _iter_json_or_jsonl(lp, limit=per_file * 5):
                p, s = str(r.get("query") or "").strip(), str(r.get("answer") or "").strip()
                lang = str(r.get("lang") or "coding").lower()
                if 16 <= len(p) <= 700 and 16 <= len(s) <= 1050:
                    yield p, s, f"coding_{lang}" if lang in ("python", "javascript", "java") else "coding"
                    kept += 1
                    if kept >= per_file:
                        break
        elif iid == "sc2_exec_python_50k":
            kept = 0
            for r in _iter_parquet_rows(lp, cols=["instruction", "response"], limit=per_file * 3):
                p, s = str(r.get("instruction") or "").strip(), str(r.get("response") or "").strip()
                if 16 <= len(p) <= 700 and 16 <= len(s) <= 1050:
                    yield p, s, "coding_python"
                    kept += 1
                    if kept >= per_file:
                        break
        elif iid == "commitpackft_swe":
            lang_hint = "python" if "python" in lp else ("javascript" if "javascript" in lp else ("java" if "java" in lp else "swe"))
            kept = 0
            for r in _iter_json_or_jsonl(lp, limit=per_file * 6):
                subj = str(r.get("subject") or "").strip()
                old_c = str(r.get("old_contents") or "").strip()
                new_c = str(r.get("new_contents") or "").strip()
                if 8 <= len(subj) <= 220 and 20 <= len(old_c) <= 600 and 20 <= len(new_c) <= 650 and old_c != new_c:
                    instr = f"Refactor or fix this {lang_hint} code cleanly for commit goal: {subj}\n```\n{old_c}\n```"
                    resp = f"```{lang_hint}\n{new_c}\n```"
                    yield instr, resp, "software_engineering"
                    kept += 1
                    if kept >= per_file:
                        break
        elif iid == "webinstruct_stem":
            for r in _iter_parquet_rows(lp, cols=["question", "answer"], limit=per_file):
                q, a = str(r.get("question") or "").strip(), str(r.get("answer") or "").strip()
                if 12 <= len(q) <= 600 and 12 <= len(a) <= 1000:
                    yield q, a, dom
        elif iid == "oasst2_trees":
            count = 0
            for tree in _iter_json_or_jsonl(lp, limit=30_000):
                def _walk_tree(node: Dict[str, object]) -> None:
                    nonlocal count
                    if count >= per_file:
                        return
                    role = str(node.get("role") or "")
                    text = str(node.get("text") or "").strip()
                    lang = str(node.get("lang") or "en").lower().strip()
                    replies = node.get("replies") or []
                    if role == "prompter" and lang in ("en", "hi") and 10 <= len(text) <= 650 and isinstance(replies, list):
                        best = None
                        for rep in replies:
                            if not isinstance(rep, dict) or rep.get("deleted") or str(rep.get("role")) != "assistant":
                                continue
                            r_txt = str(rep.get("text") or "").strip()
                            if 12 <= len(r_txt) <= 1000 and (best is None or (rep.get("rank") or 99) < (best.get("rank") or 99)):
                                best = rep
                        if best is not None:
                            dtag = "hindi_devanagari" if (lang == "hi" or re.search(r"[\u0900-\u097F]{4,}", text)) else "instruction_following"
                            yield_list.append((text, str(best.get("text") or "").strip(), dtag))
                            count += 1
                    for ch in (replies if isinstance(replies, list) else []):
                        if isinstance(ch, dict):
                            _walk_tree(ch)

                yield_list: List[Tuple[str, str, str]] = []
                prompt_node = tree.get("prompt")
                if isinstance(prompt_node, dict):
                    _walk_tree(prompt_node)
                for triple in yield_list:
                    yield triple
                if count >= per_file:
                    break
        elif iid in ("glaive_function_calling_v2", "hermes_function_calling_v1"):
            for r in _iter_json_or_jsonl(lp, limit=per_file):
                conv = r.get("conversations") if "conversations" in r else r.get("chat")
                parsed = _parse_glaive_or_hermes_tool(str(r.get("system") or ""), conv)
                if parsed is not None:
                    yield parsed
        elif iid in ("smangrul_hindi_instruct", "cognitivelab_hindi_instruct"):
            for r in _iter_parquet_rows(lp, cols=["messages"], limit=per_file):
                msgs = r.get("messages")
                if not isinstance(msgs, list):
                    continue
                sys_txt = ""
                u_txt = ""
                a_txt = ""
                for m in msgs:
                    if not isinstance(m, dict):
                        continue
                    role_m = str(m.get("role") or "").lower().strip()
                    cont = str(m.get("content") or "").strip()
                    if role_m == "system" and cont and not sys_txt:
                        sys_txt = cont
                    elif role_m == "user" and not u_txt:
                        u_txt = cont
                    elif role_m in ("assistant", "model") and u_txt and not a_txt:
                        a_txt = cont
                        break
                if 10 <= len(u_txt) <= 500 and 12 <= len(a_txt) <= 900:
                    prompt = f"{sys_txt}\n{u_txt}".strip() if (sys_txt and len(sys_txt) <= 180) else u_txt
                    dtag = "hindi_devanagari" if re.search(r"[\u0900-\u097F]{4,}", f"{prompt} {a_txt}") else "hinglish_dialog"
                    yield prompt, a_txt, dtag
        elif iid == "damerajee_small_hindi_instruct":
            import csv
            with open(lp, "r", encoding="utf-8", errors="replace", newline="") as cf:
                reader = csv.DictReader(cf)
                for row in reader:
                    q = str(row.get("Question") or "").strip()
                    a = str(row.get("Answer") or "").strip()
                    if 8 <= len(q) <= 450 and 8 <= len(a) <= 750:
                        dtag = "hindi_devanagari" if re.search(r"[\u0900-\u097F]{4,}", f"{q} {a}") else "hinglish_dialog"
                        yield q, a, dtag
        elif iid == "gsm8k_train":
            for r in _iter_parquet_rows(lp, cols=["question", "answer"], limit=per_file):
                q = str(r.get("question") or "").strip()
                raw_a = str(r.get("answer") or "").strip()
                clean_a = re.sub(r"<<[^>\n]{1,64}>>", "", raw_a)
                clean_a = re.sub(r"####\s*([^\n]+)", r"\nFinal answer: \1", clean_a).strip()
                if 12 <= len(q) <= 500 and 8 <= len(clean_a) <= 700:
                    yield q, clean_a, "math_crisp"
        elif iid == "orca_math_200k":
            kept = 0
            for r in _iter_parquet_rows(lp, cols=["question", "answer"], limit=per_file * 3):
                q = str(r.get("question") or "").strip()
                a = str(r.get("answer") or "").strip()
                if 12 <= len(q) <= 450 and 12 <= len(a) <= 650:
                    yield q, a, "math_crisp"
                    kept += 1
                    if kept >= per_file:
                        break
        elif iid == "magicoder_evol_instruct_110k":
            kept = 0
            for r in _iter_json_or_jsonl(lp, limit=per_file * 5):
                q = str(r.get("instruction") or "").strip()
                a = str(r.get("response") or "").strip()
                if 16 <= len(q) <= 600 and 16 <= len(a) <= 900:
                    low = f"{q} {a}".lower()
                    if "java" in low and ("public static" in low or "public class" in low or "system.out" in low):
                        dtag = "coding_java"
                    elif "javascript" in low or "typescript" in low or "function " in low or "=>" in low:
                        dtag = "coding_javascript"
                    elif "def " in low or "python" in low:
                        dtag = "coding_python"
                    elif "select " in low and "from " in low or "sql" in low or "#include" in low:
                        dtag = "software_engineering"
                    else:
                        dtag = "coding"
                    yield q, a, dtag
                    kept += 1
                    if kept >= per_file:
                        break
        elif iid == "commitpackft_c_ts_sql":
            norm_lp = lp.replace("\\", "/").lower()
            lang_hint = "c" if "/c/" in norm_lp else ("typescript" if "typescript" in norm_lp else ("sql" if "/sql/" in norm_lp else "swe"))
            kept = 0
            for r in _iter_json_or_jsonl(lp, limit=per_file * 5):
                subj = str(r.get("subject") or "").strip()
                old_c = str(r.get("old_contents") or "").strip()
                new_c = str(r.get("new_contents") or "").strip()
                if 8 <= len(subj) <= 220 and 20 <= len(old_c) <= 600 and 20 <= len(new_c) <= 650 and old_c != new_c:
                    instr = f"Refactor or update this {lang_hint} code cleanly for commit goal: {subj}\n```\n{old_c}\n```"
                    resp = f"```{lang_hint}\n{new_c}\n```"
                    yield instr, resp, "software_engineering"
                    kept += 1
                    if kept >= per_file:
                        break
        elif iid == "mmlu_aux_train":
            kept = 0
            labels = ["A", "B", "C", "D"]
            for r in _iter_parquet_rows(lp, cols=["question", "choices", "answer"], limit=per_file * 3):
                q = str(r.get("question") or "").strip()
                choices = r.get("choices")
                ans_idx = r.get("answer")
                if not isinstance(choices, (list, tuple)) or len(choices) < 2 or ans_idx is None:
                    continue
                try:
                    idx_i = int(ans_idx)
                except Exception:
                    continue
                if not (0 <= idx_i < len(choices)) or not (16 <= len(q) <= 550):
                    continue
                ans_text = str(choices[idx_i]).strip()
                if len(ans_text) < 1 or len(ans_text) > 300:
                    continue
                opts = " | ".join(f"{labels[i]}: {str(ch).strip()}" for i, ch in enumerate(choices[:4]))
                prompt = f"Answer concisely: {q}\nOptions: {opts}"
                resp = f"Correct answer ({labels[idx_i]}): {ans_text}."
                low_q = q.lower()
                if any(k in low_q for k in ("force", "energy", "circuit", "voltage", "ohm", "velocity", "robot", "torque", "reaction", "atom", "molecule", "newton", "thermo", "cell ", "gene", "electron", "acid", "magnetic")):
                    dtag = "science_engineering"
                else:
                    dtag = "general_knowledge"
                if len(prompt) <= 750 and len(resp) <= 450:
                    yield prompt, resp, dtag
                    kept += 1
                    if kept >= per_file:
                        break


def curate_and_tokenize_corpus(
    repo_root: str,
    raw_manifest_path: str,
    out_shard_dir: str,
    vocab_size: int = 8192,
    sft_block_size: int = 256,
    max_pretrain_docs_per_source: int = 25_000,
    max_sft_pairs_per_source: int = 30_000,
    seed: int = 42,
    exclude_distilled: bool = True,
    reuse_tokenizer: bool = False,
    sft_only: bool = False,
) -> Dict[str, object]:
    """Curate, dedup, redact, canary-scrub, balance, and serialize multi-stage memmap shards on D:."""
    t0 = time.perf_counter()
    os.makedirs(out_shard_dir, exist_ok=True)
    with open(raw_manifest_path, "r", encoding="utf-8") as mf:
        acq = json.load(mf)

    # Ensure base local curated/verified/synthetic dataset exists (gives val/test/multimodal + robotics/Hindi anchors)
    local_ds_dir = os.path.join(repo_root, "data", "neural_models", "datasets", "local-ladder-shared")
    local_manifest_p = os.path.join(local_ds_dir, "dataset_manifest.json")
    if not os.path.exists(local_manifest_p):
        build_unified_datasets(repo_root, local_ds_dir, vision_per_class=24, audio_per_class=16, image_size=96)

    def _read_j(p: str) -> List[Dict[str, object]]:
        rows: List[Dict[str, object]] = []
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as fh:
                for ln in fh:
                    ln = ln.strip()
                    if ln:
                        rows.append(json.loads(ln))
        return rows

    local_pretrain = _read_j(os.path.join(local_ds_dir, "pretrain.jsonl"))
    local_sft_train = _read_j(os.path.join(local_ds_dir, "sft_train.jsonl"))
    local_sft_val = _read_j(os.path.join(local_ds_dir, "sft_val.jsonl"))
    local_sft_test = _read_j(os.path.join(local_ds_dir, "sft_test.jsonl"))

    filt = _CanaryDedupFilter()
    # Reserve local held-out val/test fingerprints into exact set so zero leak occurs
    for hv in local_sft_val + local_sft_test:
        hn = " ".join(f"{hv.get('instruction', '')} {hv.get('response', '')}".lower().split())
        filt.seen_u64.add(int.from_bytes(hashlib.sha256(hn.encode("utf-8")).digest()[:8], "big"))

    audit = {
        "records_seen": 0,
        "accepted_pretrain": 0,
        "accepted_sft_train": 0,
        "accepted_sft_val": 0,
        "distilled_excluded_count": 0,
        "exclude_distilled": bool(exclude_distilled),
        "rejected_low_quality": 0,
        "rejected_canary": 0,
        "rejected_exact_dup": 0,
        "rejected_minhash_dup": 0,
        "pii_redactions": 0,
        "pretrain_domain_docs": {},
        "sft_domain_pairs": {},
    }

    # Stream Stage 1/2 pretrain & Stage 3/4/5 SFT normalized records
    pretrain_buckets: Dict[str, List[str]] = {}
    for lp_row in local_pretrain:
        if exclude_distilled and (str(lp_row.get("source") or "") == "experiences_index.json" or str(lp_row.get("domain") or "") == "verified_episode"):
            audit["distilled_excluded_count"] += 1
            continue
        txt = str(lp_row.get("text") or "").strip()
        dom = str(lp_row.get("domain") or "robotics_local")
        clean, keep, red, _ = sanitize_and_filter_text(txt, min_chars=16, min_quality=0.35)
        audit["pii_redactions"] += red
        if keep and filt.accept(clean, check_near_dup=False)[0]:
            pretrain_buckets.setdefault(dom, []).append(clean)
            audit["accepted_pretrain"] += 1

    sft_train_jsonl = os.path.join(out_shard_dir, "curated_sft_train.jsonl")
    sft_val_jsonl = os.path.join(out_shard_dir, "curated_sft_val.jsonl")
    pretrain_jsonl = os.path.join(out_shard_dir, "curated_pretrain_balanced.jsonl")

    sft_buckets: Dict[str, List[Tuple[str, str, str]]] = {}
    val_pairs: List[Tuple[str, str, str]] = []

    for row in local_sft_train:
        if exclude_distilled and (str(row.get("source") or "") == "experiences_index.json" or str(row.get("domain") or "") == "verified_episode"):
            audit["distilled_excluded_count"] += 1
            continue
        ci = str(row["instruction"])
        cr = str(row["response"])
        dom = str(row.get("domain") or "local_sft")
        if filt.is_canary(f"{ci}\n{cr}"):
            audit["rejected_canary"] += 1
            continue
        sft_buckets.setdefault(dom, []).append((ci, cr, dom))

    for src in acq.get("acquired", []):
        role = str(src.get("stage_role"))
        origin = str(src.get("origin_class") or "public")
        if role == "pretrain":
            if sft_only:
                continue
            for raw_txt, dom in _extract_pretrain_records(src, max_docs=max_pretrain_docs_per_source):
                audit["records_seen"] += 1
                clean, keep, red, _ = sanitize_and_filter_text(raw_txt, min_chars=48, min_quality=0.45)
                audit["pii_redactions"] += red
                if not keep:
                    audit["rejected_low_quality"] += 1
                    continue
                ok, why = filt.accept(clean, check_near_dup=True)
                if not ok:
                    audit[f"rejected_{why}"] = audit.get(f"rejected_{why}", 0) + 1
                    continue
                pretrain_buckets.setdefault(dom, []).append(clean)
                audit["accepted_pretrain"] += 1
                audit["pretrain_domain_docs"][dom] = audit["pretrain_domain_docs"].get(dom, 0) + 1
        elif role == "sft":
            for instr, resp, dom in _extract_sft_records(src, max_pairs=max_sft_pairs_per_source):
                audit["records_seen"] += 1
                ci, ki, r1, _ = sanitize_and_filter_text(instr, min_chars=10, min_quality=0.32)
                cr, kr, r2, _ = sanitize_and_filter_text(resp, min_chars=6, min_quality=0.28)
                audit["pii_redactions"] += (r1 + r2)
                if not (ki and kr):
                    audit["rejected_low_quality"] += 1
                    continue
                ok, why = filt.accept(f"{ci}\n{cr}", check_near_dup=True)
                if not ok:
                    audit[f"rejected_{why}"] = audit.get(f"rejected_{why}", 0) + 1
                    continue
                # Hold out ~2% of NON-synthetic, NON-proprietary SFT pairs into clean held-out val
                h_b = int.from_bytes(hashlib.sha256(ci.encode("utf-8")).digest()[:4], "big") % 100
                if origin in ("curated", "public") and h_b < 2 and len(val_pairs) < 800:
                    val_pairs.append((ci, cr, dom))
                    audit["accepted_sft_val"] += 1
                else:
                    sft_buckets.setdefault(dom, []).append((ci, cr, dom))
                    audit["accepted_sft_train"] += 1
                    audit["sft_domain_pairs"][dom] = audit["sft_domain_pairs"].get(dom, 0) + 1
        print(f"[curate] {src['id']} ({role}) elapsed={time.perf_counter()-t0:.1f}s pre={audit['accepted_pretrain']} sft={audit['accepted_sft_train']}", flush=True)
        gc.collect()

    rng = random.Random(seed)
    for bucket in pretrain_buckets.values():
        rng.shuffle(bucket)
    for bucket in sft_buckets.values():
        rng.shuffle(bucket)

    def _round_robin(buckets_map: Dict[str, list]) -> list:
        keys = sorted(buckets_map.keys())
        ptrs = {k: 0 for k in keys}
        out = []
        active = True
        while active:
            active = False
            for k in keys:
                if ptrs[k] < len(buckets_map[k]):
                    out.append(buckets_map[k][ptrs[k]])
                    ptrs[k] += 1
                    active = True
        return out

    def _sample_balanced_subbuckets(sub_names: List[str], total_cap: int, pool_map: Dict[str, list]) -> list:
        avail = [s for s in sub_names if pool_map.get(s)]
        if not avail or total_cap <= 0:
            return []
        per_sub = max(1, total_cap // len(avail))
        out = []
        for s in avail:
            rows = pool_map[s]
            if len(rows) >= per_sub:
                out.extend(rows[:per_sub])
            else:
                mult = 2 if len(rows) >= 20 else 1
                max_take = min(per_sub, len(rows) * mult)
                reps = (max_take + len(rows) - 1) // len(rows)
                out.extend((rows * reps)[:max_take])
        rng.shuffle(out)
        return out[:total_cap]

    # Classify domain buckets into the 4 Strategic Pillars + Tool/JSON for exact multi-stage balancing
    pillar_A_subs = ["general_language", "general_knowledge", "instruction_following", "hindi_devanagari", "hinglish_dialog", "hinglish", "hindi_hinglish", "en", "honesty", "local_sft"]
    pillar_B_subs = ["coding_python", "coding_javascript", "coding_java", "software_engineering", "coding", "programming", "programming_java"]
    pillar_C_subs = ["math_crisp", "math_crisp", "mathematics", "math_reasoning", "mathematics_logic", "reasoning"]
    pillar_D_subs = ["science_engineering", "science_knowledge", "science", "engineering", "technical_docs", "robotics", "robotics_local", "robotics_inventory", "vision_engineering", "audio_engineering"]
    pillar_T_subs = ["tool_use", "structured_json"]

    # Stage 1 pretrain: general language + multilingual EN/Hindi/Hinglish + STEM encyclopedic foundation
    interleaved_pretrain = _round_robin(pretrain_buckets)

    # Stage 2 balanced 4-domain continuation (25% A / 25% B / 25% C / 25% D)
    s2_cap = max(8_000, min(20_000, max((len(v) for v in pretrain_buckets.values()), default=0)))
    s2_A = _sample_balanced_subbuckets(["language", "general_academic", "general_language", "hindi_devanagari", "hinglish"], s2_cap, pretrain_buckets)
    s2_B_raw = [f"{ci}\n{cr}" for sub in pillar_B_subs for ci, cr, _ in sft_buckets.get(sub, [])[:s2_cap]]
    rng.shuffle(s2_B_raw)
    s2_B = s2_B_raw[:s2_cap]
    s2_C_pool = list(pretrain_buckets.get("mathematics", [])) + list(pretrain_buckets.get("science_math", [])) + list(pretrain_buckets.get("multistep_reasoning", []))
    rng.shuffle(s2_C_pool)
    s2_C = s2_C_pool[:s2_cap]
    if len(s2_C) < s2_cap:
        s2_C.extend([f"Problem: {ci}\nSolution: {cr}" for ci, cr, _ in sft_buckets.get("mathematics", [])[: s2_cap - len(s2_C)]])
    s2_D_pool = list(pretrain_buckets.get("science_engineering", [])) + list(pretrain_buckets.get("science_stem", [])) + list(pretrain_buckets.get("robotics_local", []))
    s2_D_pool.extend([f"{ci}\n{cr}" for sub in pillar_D_subs for ci, cr, _ in sft_buckets.get(sub, [])[:s2_cap]])
    rng.shuffle(s2_D_pool)
    s2_D = s2_D_pool[:s2_cap]
    stage2_domain_docs = _round_robin({"A": s2_A, "B": s2_B, "C": s2_C, "D": s2_D})
    if not stage2_domain_docs:
        stage2_domain_docs = list(interleaved_pretrain)

    # Stage 3 balanced SFT: equal representation across all 4 macro pillars + 10% structured tool/JSON
    if sum(len(v) for v in sft_buckets.values()) >= 200:
        pillar_cap = 15_000
        s3_A = _sample_balanced_subbuckets(pillar_A_subs, pillar_cap, sft_buckets)
        s3_B = _sample_balanced_subbuckets(pillar_B_subs, pillar_cap, sft_buckets)
        s3_C = _sample_balanced_subbuckets(pillar_C_subs, pillar_cap, sft_buckets)
        s3_D = _sample_balanced_subbuckets(pillar_D_subs, pillar_cap, sft_buckets)
        s3_T = _sample_balanced_subbuckets(pillar_T_subs, pillar_cap // 2, sft_buckets)
        known_subs = set(pillar_A_subs + pillar_B_subs + pillar_C_subs + pillar_D_subs + pillar_T_subs)
        extra = [x for k, v in sft_buckets.items() if k not in known_subs for x in v[:pillar_cap // 4]]
        interleaved_sft = _round_robin({"A": s3_A, "B": s3_B, "C": s3_C, "D": s3_D, "T": s3_T, "X": extra})
    else:
        interleaved_sft = _round_robin(sft_buckets)

    # Stage 4 Math + Coding + Quantitative Reasoning (70% Math/Code, 15% Science/Robotics, 15% General/Tool replay)
    s4_B = _sample_balanced_subbuckets(pillar_B_subs, 12_000, sft_buckets)
    s4_C = _sample_balanced_subbuckets(pillar_C_subs, 12_000, sft_buckets)
    s4_D = _sample_balanced_subbuckets(pillar_D_subs, 5_000, sft_buckets)
    s4_replay = _sample_balanced_subbuckets(pillar_A_subs + pillar_T_subs, 5_000, sft_buckets)
    stage4_pairs = _round_robin({"B": s4_B, "C": s4_C, "D": s4_D, "R": s4_replay}) or list(interleaved_sft)

    # Stage 5 Structured Output & Tool Calling (40% Tool/JSON + 60% Multi-Domain Replay)
    s5_T = _sample_balanced_subbuckets(pillar_T_subs, 8_000, sft_buckets)
    s5_A = _sample_balanced_subbuckets(pillar_A_subs, 3_000, sft_buckets)
    s5_B = _sample_balanced_subbuckets(pillar_B_subs, 3_000, sft_buckets)
    s5_C = _sample_balanced_subbuckets(pillar_C_subs, 3_000, sft_buckets)
    s5_D = _sample_balanced_subbuckets(pillar_D_subs, 3_000, sft_buckets)
    stage5_pairs = _round_robin({"T": s5_T, "A": s5_A, "B": s5_B, "C": s5_C, "D": s5_D}) or list(interleaved_sft)

    if not sft_only:
        with open(pretrain_jsonl, "w", encoding="utf-8") as pf:
            for txt in interleaved_pretrain:
                pf.write(json.dumps({"text": txt}, ensure_ascii=False) + "\n")
    with open(sft_train_jsonl, "w", encoding="utf-8") as sf:
        for ci, cr, dom in interleaved_sft:
            sf.write(json.dumps({"instruction": ci, "response": cr, "domain": dom}, ensure_ascii=False) + "\n")
    with open(sft_val_jsonl, "w", encoding="utf-8") as vf:
        for ci, cr, dom in val_pairs:
            vf.write(json.dumps({"instruction": ci, "response": cr, "domain": dom}, ensure_ascii=False) + "\n")

    # Free dedup LSH RAM before tokenization
    del filt, pretrain_buckets, sft_buckets
    gc.collect()

    tok_json_p = os.path.join(out_shard_dir, "tokenizer.json")
    if reuse_tokenizer and os.path.exists(tok_json_p):
        tokenizer = JarvisBPE.load(out_shard_dir)
        tok_path = tok_json_p
        tok_stats = {"vocab_size": tokenizer.vocab_size, "mode": tokenizer.pretokenize_mode, "reused": True}
    else:
        tok_sample = (
            interleaved_pretrain[:3000]
            + stage2_domain_docs[:3000]
            + [f"<user>{ci}</user><assistant>{cr}" for ci, cr, _ in interleaved_sft[:4500]]
        )
        tokenizer = JarvisBPE(pretokenize_mode="byte_bpe_v2")
        tok_stats = tokenizer.train(tok_sample, target_vocab_size=vocab_size, min_frequency=2)
        tok_path = tokenizer.save(out_shard_dir)

    def _write_pretrain_bin(docs: List[str], prefix: str) -> Dict[str, object]:
        bin_p = os.path.join(out_shard_dir, f"{prefix}_tokens.bin")
        tok_cnt = 0
        chars_cnt = 0
        sha_h = hashlib.sha256()
        with open(bin_p, "wb") as bf:
            buf: List[int] = []
            for txt in docs:
                chars_cnt += len(txt)
                ids = tokenizer.encode(txt, add_bos=True, add_eos=True)
                if len(ids) < 6:
                    continue
                buf.extend(ids)
                if len(buf) >= 262_144:
                    arr = np.asarray(buf, dtype=np.uint32)
                    b = arr.tobytes()
                    bf.write(b)
                    sha_h.update(b)
                    tok_cnt += int(arr.size)
                    buf.clear()
            if buf:
                arr = np.asarray(buf, dtype=np.uint32)
                b = arr.tobytes()
                bf.write(b)
                sha_h.update(b)
                tok_cnt += int(arr.size)
        meta = {
            "prefix": prefix,
            "dtype": "uint32",
            "total_tokens": tok_cnt,
            "doc_count": len(docs),
            "raw_chars_total": chars_cnt,
            "bytes_per_token": round(chars_cnt / max(1, tok_cnt), 3),
            "bin_path": bin_p,
            "sha256": sha_h.hexdigest(),
        }
        with open(os.path.join(out_shard_dir, f"{prefix}_meta.json"), "w", encoding="utf-8") as pmf:
            json.dump(meta, pmf, indent=2)
        return meta

    pre_meta_p = os.path.join(out_shard_dir, "pretrain_meta.json")
    s2_meta_p = os.path.join(out_shard_dir, "stage2_domain_meta.json")
    if sft_only and os.path.exists(pre_meta_p) and os.path.exists(s2_meta_p):
        with open(pre_meta_p, "r", encoding="utf-8") as mf:
            pretrain_meta = json.load(mf)
        with open(s2_meta_p, "r", encoding="utf-8") as mf:
            stage2_meta = json.load(mf)
    else:
        pretrain_meta = _write_pretrain_bin(interleaved_pretrain, "pretrain")
        stage2_meta = _write_pretrain_bin(stage2_domain_docs, "stage2_domain")
    pretrain_tokens = int(pretrain_meta["total_tokens"])

    # Pack & stream-write SFT fixed blocks (`*_inp.bin` uint32 + `*_lbl.bin` int32)
    def _write_packed_sft(pairs: List[Tuple[str, str, str]], prefix: str) -> Dict[str, int]:
        inp_p = os.path.join(out_shard_dir, f"{prefix}_inp.bin")
        lbl_p = os.path.join(out_shard_dir, f"{prefix}_lbl.bin")
        pad_id = tokenizer.pad_id
        num_blocks = 0
        useful_tokens = 0
        kept_complete = 0
        skipped_too_long = 0
        cur_inp: List[int] = []
        cur_lbl: List[int] = []
        with open(inp_p, "wb") as fi, open(lbl_p, "wb") as fl:
            def _flush_block() -> None:
                nonlocal num_blocks
                if not cur_inp:
                    return
                if len(cur_inp) < sft_block_size:
                    pad_n = sft_block_size - len(cur_inp)
                    cur_inp.extend([pad_id] * pad_n)
                    cur_lbl.extend([-100] * pad_n)
                fi.write(np.asarray(cur_inp[:sft_block_size], dtype=np.uint32).tobytes())
                fl.write(np.asarray(cur_lbl[:sft_block_size], dtype=np.int32).tobytes())
                num_blocks += 1
                cur_inp.clear()
                cur_lbl.clear()

            for ci, cr, _ in pairs:
                p_ids = tokenizer.encode(f"<bos><user>{ci}</user><assistant>")
                r_ids = tokenizer.encode(f"{cr}<eos>")
                if len(p_ids) + len(r_ids) > sft_block_size:
                    skipped_too_long += 1
                    continue
                if not r_ids:
                    continue
                ex_inp = p_ids + r_ids
                ex_lbl = ([-100] * len(p_ids)) + r_ids
                if len(cur_inp) + len(ex_inp) > sft_block_size:
                    _flush_block()
                cur_inp.extend(ex_inp)
                cur_lbl.extend(ex_lbl)
                useful_tokens += len(ex_inp)
                kept_complete += 1
                if len(cur_inp) == sft_block_size:
                    _flush_block()
            _flush_block()
        return {
            "blocks": num_blocks,
            "tokens": useful_tokens,
            "kept_complete_pairs": kept_complete,
            "skipped_too_long": skipped_too_long,
            "inp_bytes": os.path.getsize(inp_p),
            "lbl_bytes": os.path.getsize(lbl_p),
        }

    tr_sft_info = _write_packed_sft(interleaved_sft, "sft_train")
    st4_info = _write_packed_sft(stage4_pairs, "stage4_math_code")
    st5_info = _write_packed_sft(stage5_pairs, "stage5_tool_json")
    val_sft_info = _write_packed_sft(val_pairs, "sft_val")
    sft_meta = {
        "block_size": sft_block_size,
        "train_blocks": tr_sft_info["blocks"],
        "train_tokens": tr_sft_info["tokens"],
        "train_pairs": tr_sft_info["kept_complete_pairs"],
        "train_pairs_skipped_long": tr_sft_info["skipped_too_long"],
        "stage4_blocks": st4_info["blocks"],
        "stage4_tokens": st4_info["tokens"],
        "stage4_pairs": st4_info["kept_complete_pairs"],
        "stage5_blocks": st5_info["blocks"],
        "stage5_tokens": st5_info["tokens"],
        "stage5_pairs": st5_info["kept_complete_pairs"],
        "val_blocks": val_sft_info["blocks"],
        "val_tokens": val_sft_info["tokens"],
        "val_pairs": val_sft_info["kept_complete_pairs"],
    }
    with open(os.path.join(out_shard_dir, "sft_meta.json"), "w", encoding="utf-8") as smf:
        json.dump(sft_meta, smf, indent=2)

    processed_bytes = sum(
        os.path.getsize(os.path.join(out_shard_dir, fn))
        for fn in os.listdir(out_shard_dir)
        if os.path.isfile(os.path.join(out_shard_dir, fn))
    )

    report = {
        "schema_version": "1.1.0",
        "curated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "elapsed_s": round(time.perf_counter() - t0, 2),
        "out_shard_dir": out_shard_dir,
        "tokenizer_path": tok_path,
        "tokenizer": tok_stats,
        "raw_downloaded_gb": acq.get("total_downloaded_gb"),
        "processed_bytes": processed_bytes,
        "processed_gb": round(processed_bytes / (1024 ** 3), 4),
        "usable_tokens": {
            "pretrain_tokens": pretrain_tokens,
            "stage2_domain_tokens": int(stage2_meta["total_tokens"]),
            "sft_train_tokens": tr_sft_info["tokens"],
            "stage4_math_code_tokens": st4_info["tokens"],
            "stage5_tool_json_tokens": st5_info["tokens"],
            "sft_val_tokens": val_sft_info["tokens"],
            "total_usable_tokens": (
                pretrain_tokens
                + int(stage2_meta["total_tokens"])
                + tr_sft_info["tokens"]
                + st4_info["tokens"]
                + st5_info["tokens"]
                + val_sft_info["tokens"]
            ),
        },
        "sft_meta": sft_meta,
        "pretrain_meta": pretrain_meta,
        "stage2_domain_meta": stage2_meta,
        "audit": audit,
        "post_storage": check_storage_budget(out_shard_dir),
    }
    with open(os.path.join(out_shard_dir, "corpus_manifest.json"), "w", encoding="utf-8") as cmf:
        json.dump(report, cmf, indent=2)
    return report


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="VISION Corpus Acquisition & Curation Pipeline")
    parser.add_argument("action", choices=["acquire", "curate", "all"])
    parser.add_argument("--repo-root", default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    parser.add_argument("--raw-dir", default=r"D:\Jarvis\data\corpus_raw")
    parser.add_argument("--shard-dir", default=r"D:\Jarvis\data\neural_models\shards_v10_balanced")
    parser.add_argument("--vocab-size", type=int, default=6144)
    parser.add_argument("--sft-block-size", type=int, default=384)
    parser.add_argument("--max-pretrain-per-source", type=int, default=25000)
    parser.add_argument("--max-sft-per-source", type=int, default=30000)
    parser.add_argument("--include-distilled", action="store_true", help="Include local assistant episode logs (off for strict from-scratch)")
    parser.add_argument("--reuse-tokenizer", action="store_true", help="Reuse existing tokenizer.json in shard-dir")
    parser.add_argument("--sft-only", action="store_true", help="Skip rewriting pretrain/stage2_domain shards and only repack SFT shards")
    parser.add_argument("--only", default="", help="Comma-separated acquisition IDs to include")
    args = parser.parse_args()

    include_ids = {x.strip() for x in args.only.split(",") if x.strip()} or None
    acq_manifest = os.path.join(args.raw_dir, "acquisition_manifest.json")

    if args.action in ("acquire", "all"):
        res_acq = acquire_verified_datasets(args.raw_dir, include_ids=include_ids)
        print(json.dumps({"acquired_sources": len(res_acq["acquired"]), "skipped": res_acq.get("skipped", []), "total_downloaded_gb": res_acq["total_downloaded_gb"], "post_storage": res_acq.get("post_storage")}, indent=2))
    if args.action in ("curate", "all"):
        res_cur = curate_and_tokenize_corpus(
            repo_root=args.repo_root,
            raw_manifest_path=acq_manifest,
            out_shard_dir=args.shard_dir,
            vocab_size=args.vocab_size,
            sft_block_size=args.sft_block_size,
            max_pretrain_docs_per_source=args.max_pretrain_per_source,
            max_sft_pairs_per_source=args.max_sft_per_source,
            exclude_distilled=not args.include_distilled,
            reuse_tokenizer=args.reuse_tokenizer,
            sft_only=args.sft_only,
        )
        print(json.dumps({
            "raw_downloaded_gb": res_cur["raw_downloaded_gb"],
            "processed_gb": res_cur["processed_gb"],
            "usable_tokens": res_cur["usable_tokens"],
            "pretrain_meta": res_cur["pretrain_meta"],
            "stage2_domain_meta": res_cur["stage2_domain_meta"],
            "sft_meta": res_cur["sft_meta"],
            "audit": res_cur["audit"],
        }, indent=2))


if __name__ == "__main__":
    main()
