"""
VISION — MADE BY LOKESH | Maximum Local PC Scaling & Progressive Training Ladder (`ml_foundation/local_ladder.py`)

Tailored strictly to measured local host constraints (no hypothetical GPU or cloud assumptions):
  1. Live Hardware & Memory-Pressure Audit (CPU topology, RAM/commit headroom, GPU/UMA, NVMe space, CPU BF16 trap).
  2. Automatic Safe Tier Selection (Smoke -> Local-10M -> Local-25M -> gated Local-52M-Adafactor).
  3. Bounded, Decontaminated Multi-Domain Dataset Preparation + Token Counting (Python, JS, Java, SWE,
     Mathematics, Multistep Logic, Engineering/Robotics, Hindi Devanagari, Hinglish, Structured JSON & Tool Use).
  4. Progressive Local Training Ladder with Commit Ceiling Guardrails, Atomic Resumable Checkpoints,
     and Honest Generated-Answer Evaluation per Stage.
"""

from __future__ import annotations

import datetime
import json
import os
import platform
import subprocess
import time
import urllib.parse
import urllib.request
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import torch

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.dataset_builder import build_unified_datasets
from ml_foundation.evaluator import evaluate_checkpoint
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer, MODEL_SCALE_PRESETS
from ml_foundation.readiness_planner import StreamingCorpusIngestor
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.trainer import _read_jsonl, run_training_pipeline


LOCAL_LADDER_TIERS: Dict[str, Dict[str, object]] = {
    "smoke": {
        "preset": "jarvis-nano-multimodal",
        "vocab_size": 1536,
        "optimizer_type": "adafactor",
        "seq_len": 192,
        "micro_batch_size": 2,
        "grad_accum_steps": 2,
        "gradient_checkpointing": False,
        "min_free_commit_mb": 700.0,
        "default_steps": {"pretrain": 30, "sft": 40, "vision": 30, "dpo": 12},
        "purpose": "Pipeline sanity, deterministic resume, and baseline generation check",
    },
    "tier1_10m": {
        "preset": "jarvis-local-10m",
        "vocab_size": 4096,
        "optimizer_type": "adafactor",
        "seq_len": 256,
        "micro_batch_size": 1,
        "grad_accum_steps": 4,
        "gradient_checkpointing": False,
        "min_free_commit_mb": 1150.0,
        "default_steps": {"pretrain": 80, "sft": 100, "vision": 40, "dpo": 20},
        "purpose": "Fast high-iteration local foundation model (~11-13M total, ~770 tok/s, ~870 MB commit)",
    },
    "tier2_25m": {
        "preset": "jarvis-local-25m",
        "vocab_size": 4096,
        "optimizer_type": "adafactor",
        "seq_len": 256,
        "micro_batch_size": 1,
        "grad_accum_steps": 6,
        "gradient_checkpointing": True,
        "min_free_commit_mb": 1450.0,
        "default_steps": {"pretrain": 80, "sft": 100, "vision": 40, "dpo": 20},
        "purpose": "Maximum practical local capacity sweet spot (~26-29M total, ~1011 MB commit, ~355-449 tok/s)",
    },
    "tier3_52m_heavy": {
        "preset": "jarvis-v0.8-research-52m",
        "vocab_size": 8192,
        "optimizer_type": "adafactor",
        "seq_len": 192,
        "micro_batch_size": 1,
        "grad_accum_steps": 8,
        "gradient_checkpointing": True,
        "min_free_commit_mb": 2200.0,
        "default_steps": {"pretrain": 40, "sft": 50, "vision": 20, "dpo": 10},
        "purpose": "Gated upper experimental ceiling on 8GB host (~56M w/ Adafactor + grad_ckpt, requires >=2.2GB free commit)",
    },
}


def _windows_os_mem_snapshot() -> Dict[str, object]:
    if os.name != "nt":
        return {"platform": platform.system(), "free_ram_mb": None, "free_commit_mb": None}
    ps = (
        "$os=Get-CimInstance Win32_OperatingSystem;"
        "$cpu=Get-CimInstance Win32_Processor | Select-Object -First 1 Name,NumberOfCores,NumberOfLogicalProcessors;"
        "$gpu=Get-CimInstance Win32_VideoController | Select-Object -First 1 Name,DriverVersion;"
        "$disks=Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object { \"$($_.DeviceID)|$([math]::Round($_.FreeSpace/1GB,2))/$([math]::Round($_.Size/1GB,2))GB\" };"
        "[pscustomobject]@{"
        "total_ram_mb=[math]::Round($os.TotalVisibleMemorySize/1024,1);"
        "free_ram_mb=[math]::Round($os.FreePhysicalMemory/1024,1);"
        "total_commit_mb=[math]::Round($os.TotalVirtualMemorySize/1024,1);"
        "free_commit_mb=[math]::Round($os.FreeVirtualMemory/1024,1);"
        "cpu_name=$cpu.Name;physical_cores=$cpu.NumberOfCores;logical_cores=$cpu.NumberOfLogicalProcessors;"
        "gpu_name=$gpu.Name;gpu_driver=$gpu.DriverVersion;volumes=($disks -join ',')"
        "} | ConvertTo-Json -Compress"
    )
    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return json.loads(proc.stdout.strip())
    except Exception:
        pass
    return {"platform": "Windows", "free_ram_mb": None, "free_commit_mb": None}


def audit_local_hardware(repo_root: str) -> Dict[str, object]:
    """Inspect real host hardware, memory pressure, backend support, disk space, and checkpoint sizes."""
    snap = _windows_os_mem_snapshot()
    ckpt_root = os.path.join(repo_root, "data", "neural_models", "checkpoints")
    existing_ckpts: Dict[str, Dict[str, object]] = {}
    if os.path.isdir(ckpt_root):
        for name in sorted(os.listdir(ckpt_root)):
            cdir = os.path.join(ckpt_root, name)
            wfile = os.path.join(cdir, "weights.pt")
            if os.path.isdir(cdir) and os.path.exists(wfile):
                tot_bytes = sum(
                    os.path.getsize(os.path.join(cdir, fn))
                    for fn in os.listdir(cdir)
                    if os.path.isfile(os.path.join(cdir, fn))
                )
                existing_ckpts[name] = {
                    "weights_mb": round(os.path.getsize(wfile) / (1024 ** 2), 3),
                    "total_dir_mb": round(tot_bytes / (1024 ** 2), 3),
                }

    cpu_bf16_reported = bool(hasattr(torch, "cpu") and getattr(torch.cpu, "is_bf16_supported", lambda: False)())
    recommended_threads = max(2, min(8, (os.cpu_count() or 4) - 4)) if (os.cpu_count() or 4) >= 8 else max(2, (os.cpu_count() or 4) // 2)
    return {
        "os": platform.platform(),
        "python": platform.python_version(),
        "torch": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "xpu_available": bool(hasattr(torch, "xpu") and torch.xpu.is_available()),
        "cpu_bf16_reported": cpu_bf16_reported,
        "recommended_cpu_dtype": "fp32",
        "recommended_cpu_threads": recommended_threads,
        "process_rss_mb": round(_get_process_rss_mb(), 2),
        "host_snapshot": snap,
        "existing_checkpoints": existing_ckpts,
    }


def select_local_training_ladder(hw_audit: Optional[Dict[str, object]] = None, repo_root: Optional[str] = None) -> Dict[str, object]:
    """Automatically select feasible local model tiers based on actual free commit/RAM headroom."""
    audit = hw_audit or audit_local_hardware(repo_root or os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    snap = audit.get("host_snapshot") or {}
    free_commit_mb = float(snap.get("free_commit_mb") or 2000.0)
    free_ram_mb = float(snap.get("free_ram_mb") or 700.0)

    selected: List[Dict[str, object]] = []
    skipped: List[Dict[str, object]] = []

    for tier_name, spec in LOCAL_LADDER_TIERS.items():
        preset = str(spec["preset"])
        vocab_sz = int(spec["vocab_size"])
        p_cfg = MODEL_SCALE_PRESETS[preset]
        cfg = JarvisConfig(model_name=preset, version=tier_name, vocab_size=vocab_sz, audio_feature_dim=32, **p_cfg)
        with torch.device("meta"):
            pcount = JarvisUnifiedTransformer(cfg).parameter_count()

        min_commit = float(spec["min_free_commit_mb"])
        if free_commit_mb >= min_commit:
            selected.append({
                "tier": tier_name,
                "preset": preset,
                "vocab_size": vocab_sz,
                "parameters": pcount,
                "optimizer_type": spec["optimizer_type"],
                "seq_len": spec["seq_len"],
                "micro_batch_size": spec["micro_batch_size"],
                "grad_accum_steps": spec["grad_accum_steps"],
                "gradient_checkpointing": spec["gradient_checkpointing"],
                "purpose": spec["purpose"],
                "eligible": True,
            })
        else:
            skipped.append({
                "tier": tier_name,
                "preset": preset,
                "parameters": pcount,
                "eligible": False,
                "reason": f"Requires >= {min_commit:.0f} MB free virtual commit headroom; currently {free_commit_mb:.0f} MB free.",
            })

    # Always explain why 75M+ / 125M / 1B are excluded on CPU-only 8GB host
    skipped.append({
        "tier": "large_75m_to_1b",
        "preset": "jarvis-core-125m / jarvis-core-1b",
        "eligible": False,
        "reason": "Chinchilla token budget (~1.5B-20B tokens) exceeds local CPU throughput (~127 tok/s or less = months/years) and exceeds 8GB physical RAM.",
    })

    return {
        "host_free_ram_mb": free_ram_mb,
        "host_free_commit_mb": free_commit_mb,
        "recommended_threads": audit.get("recommended_cpu_threads", 6),
        "selected_tiers": selected,
        "skipped_tiers": skipped,
    }


def _stream_hf_pilot_rows(max_per_dataset: int = 20) -> Iterable[Dict[str, object]]:
    """Optional bounded public HF rows API fetcher (never downloads full corpora; fails gracefully if offline)."""
    sources = [
        ("AI-MO/NuminaMath-CoT", "default", "train", "Apache-2.0", "public", "mathematics", ("problem", "solution")),
        ("OpenAssistant/oasst2", "default", "train", "Apache-2.0", "curated", "language", ("text",)),
    ]
    for repo_id, config, split, lic, origin, dom, cols in sources:
        url = (
            "https://datasets-server.huggingface.co/rows?"
            + urllib.parse.urlencode({"dataset": repo_id, "config": config, "split": split, "offset": 0, "length": max_per_dataset})
        )
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "VISION-Local-Pilot/1.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            for item in data.get("rows", []):
                row = item.get("row") or {}
                parts = [str(row.get(c, "")).strip() for c in cols if row.get(c)]
                txt = "\n".join(p for p in parts if p)
                if len(txt) >= 32:
                    yield {
                        "text": txt[:2000],
                        "license": lic,
                        "origin_class": origin,
                        "domain": dom,
                        "source": repo_id,
                        "template_family": f"hf_pilot_{repo_id.replace('/', '_')}_{item.get('row_idx', 0)}",
                    }
        except Exception:
            continue


def prepare_bounded_local_dataset(
    repo_root: str,
    dataset_dir: str,
    tokenizer_vocab_size: int = 4096,
    ingest_hf_pilot: bool = False,
    max_hf_rows_per_source: int = 20,
) -> Dict[str, object]:
    """Build or reuse cached, decontaminated multi-domain dataset and measure exact tokenized counts."""
    os.makedirs(dataset_dir, exist_ok=True)
    manifest_file = os.path.join(dataset_dir, "dataset_manifest.json")
    if os.path.exists(manifest_file):
        with open(manifest_file, "r", encoding="utf-8") as mf:
            manifest = json.load(mf)
        cached = True
    else:
        manifest = build_unified_datasets(repo_root, dataset_dir, vision_per_class=24, audio_per_class=16, image_size=96)
        cached = False

    pretrain_rows = _read_jsonl(manifest["paths"]["pretrain"])
    sft_train_rows = _read_jsonl(manifest["paths"]["sft_train"])
    sft_val_rows = _read_jsonl(manifest["paths"]["sft_val"])
    sft_test_rows = _read_jsonl(manifest["paths"]["sft_test"])

    tok = JarvisBPE(pretokenize_mode="byte_bpe_v2")
    corpus_texts = [str(r.get("text", "")) for r in pretrain_rows] + [
        f"<bos><user>{r.get('instruction', '')}</user><assistant>{r.get('response', '')}<eos>"
        for r in sft_train_rows
    ]
    tok.train(corpus_texts, target_vocab_size=tokenizer_vocab_size, min_frequency=2)

    external_shard_report = None
    shard_dir = os.path.join(dataset_dir, "hf_pilot_shards")
    if ingest_hf_pilot:
        ingestor = StreamingCorpusIngestor(tok, shard_dir, min_quality=0.45, near_dup_threshold=0.72)
        pilot_records = list(_stream_hf_pilot_rows(max_per_dataset=max_hf_rows_per_source))
        for idx, rec in enumerate(pretrain_rows):
            pilot_records.append({
                "text": rec["text"],
                "license": rec.get("license", "Original-Curated"),
                "origin_class": "curated",
                "domain": rec.get("domain", "general"),
                "template_family": rec.get("template_family") or f"local_pre_{idx}",
            })
        external_shard_report = ingestor.ingest_stream(iter(pilot_records))

    pretrain_tokens = sum(len(tok.encode(str(r.get("text", "")), add_bos=True, add_eos=True)) for r in pretrain_rows)
    sft_train_tokens = sum(
        len(tok.encode(f"<bos><user>{r.get('instruction', '')}</user><assistant>{r.get('response', '')}<eos>"))
        for r in sft_train_rows
    )
    sft_val_tokens = sum(
        len(tok.encode(f"<bos><user>{r.get('instruction', '')}</user><assistant>{r.get('response', '')}<eos>"))
        for r in sft_val_rows
    )
    sft_test_tokens = sum(
        len(tok.encode(f"<bos><user>{r.get('instruction', '')}</user><assistant>{r.get('response', '')}<eos>"))
        for r in sft_test_rows
    )

    return {
        "dataset_dir": dataset_dir,
        "cached": cached,
        "vocab_size": tok.vocab_size,
        "counts": manifest["counts"],
        "domain_counts": manifest["domain_counts"],
        "license_counts": manifest["license_counts"],
        "data_processing_audit": manifest["data_processing_audit"],
        "exact_token_counts": {
            "pretrain_tokens": pretrain_tokens,
            "sft_train_tokens": sft_train_tokens,
            "sft_val_tokens": sft_val_tokens,
            "sft_test_tokens": sft_test_tokens,
            "total_local_tokens": pretrain_tokens + sft_train_tokens + sft_val_tokens + sft_test_tokens,
        },
        "external_shard_report": external_shard_report,
    }


def run_progressive_local_ladder(
    repo_root: str,
    run_tag: Optional[str] = None,
    tiers: Sequence[str] = ("smoke", "tier1_10m"),
    steps_scale: float = 1.0,
    max_total_minutes: float = 25.0,
    threads: Optional[int] = None,
    dataset_dir: Optional[str] = None,
    ingest_hf_pilot: bool = False,
) -> Dict[str, object]:
    """
    Execute hardware-aware progressive local training ladder (e.g. smoke -> tier1_10m -> tier2_25m),
    preserving all prior checkpoints, enforcing commit safety ceilings, and running held-out eval per tier.
    """
    t_start = time.perf_counter()
    hw_audit = audit_local_hardware(repo_root)
    selection = select_local_training_ladder(hw_audit, repo_root=repo_root)
    eff_threads = int(threads or selection["recommended_threads"])
    tag = str(run_tag or datetime.datetime.now().strftime("%Y%m%d_%H%M%S")).replace(" ", "_")

    shared_ds = dataset_dir or os.path.join(repo_root, "data", "neural_models", "datasets", "local-ladder-shared")
    ds_prep = prepare_bounded_local_dataset(repo_root, shared_ds, tokenizer_vocab_size=4096, ingest_hf_pilot=ingest_hf_pilot)

    eligible_map = {t["tier"]: t for t in selection["selected_tiers"]}
    results: List[Dict[str, object]] = []
    prev_eval: Optional[Dict[str, object]] = None
    halted_reason: Optional[str] = None

    # Reserve at least 450 MB Windows virtual commit headroom above baseline
    free_commit_now = float((hw_audit.get("host_snapshot") or {}).get("free_commit_mb") or 2000.0)
    max_commit_mb = round(max(950.0, _get_process_rss_mb() + max(450.0, free_commit_now - 450.0)), 1)

    for idx, tier_name in enumerate(tiers):
        elapsed_min = (time.perf_counter() - t_start) / 60.0
        if elapsed_min >= max_total_minutes:
            halted_reason = f"TIME_BUDGET_REACHED:{elapsed_min:.2f}m>={max_total_minutes}m"
            break
        if tier_name not in LOCAL_LADDER_TIERS:
            results.append({"tier": tier_name, "success": False, "skipped": True, "reason": "Unknown tier"})
            continue
        if tier_name not in eligible_map:
            results.append({"tier": tier_name, "success": False, "skipped": True, "reason": "Insufficient local free commit headroom"})
            halted_reason = f"RESOURCE_GATE_SKIPPED:{tier_name}"
            break

        spec = LOCAL_LADDER_TIERS[tier_name]
        st = spec["default_steps"]
        p_steps = max(4, int(round(st["pretrain"] * steps_scale)))
        s_steps = max(4, int(round(st["sft"] * steps_scale)))
        v_steps = max(0, int(round(st["vision"] * steps_scale)))
        d_steps = max(0, int(round(st["dpo"] * steps_scale)))

        version_tag = f"vision-local-{tier_name}-{tag}"
        train_res = run_training_pipeline(
            repo_root=repo_root,
            version_tag=version_tag,
            preset=str(spec["preset"]),
            vocab_size=int(spec["vocab_size"]),
            pretrain_steps=p_steps,
            sft_steps=s_steps,
            vision_steps=v_steps,
            dpo_steps=d_steps,
            grad_accum_steps=int(spec["grad_accum_steps"]),
            dtype="fp32",
            early_stopping=True,
            early_stop_patience=4,
            seed=42 + idx * 17,
            allow_large_cpu=False,
            dataset_override_dir=shared_ds,
            optimizer_type=str(spec["optimizer_type"]),
            seq_len=int(spec["seq_len"]),
            micro_batch_size=int(spec["micro_batch_size"]),
            gradient_checkpointing=bool(spec["gradient_checkpointing"]),
            threads=eff_threads,
            checkpoint_every_steps=max(10, p_steps // 2),
            max_commit_mb=max_commit_mb,
            low_ram_mode=True,
        )

        if not train_res.get("success"):
            results.append({"tier": tier_name, "version": version_tag, "success": False, "training": train_res})
            halted_reason = f"TRAIN_FAILED:{tier_name}:{train_res.get('error', 'unknown')}"
            break

        ckpt_dir = train_res["artifacts"]["checkpoint_dir"]
        eval_res = evaluate_checkpoint(repo_root, ckpt_dir, dataset_dir=shared_ds, previous_eval=prev_eval)
        prev_eval = eval_res if eval_res.get("success") else prev_eval

        tier_entry = {
            "tier": tier_name,
            "version": version_tag,
            "preset": spec["preset"],
            "success": True,
            "parameters": train_res["parameters"],
            "training_config": train_res["training_config"],
            "training_metrics": train_res["training_metrics"],
            "evaluation": {
                "composite_score": eval_res.get("composite_score"),
                "metrics": eval_res.get("metrics"),
                "experimental_promotion_eligible": eval_res.get("experimental_promotion_eligible"),
                "production_primary_eligible": eval_res.get("production_primary_eligible"),
                "sample_outputs": (eval_res.get("per_example_results") or [])[:6],
            },
            "artifacts": train_res["artifacts"],
        }
        results.append(tier_entry)

        if train_res["training_metrics"].get("unstable_loss_detected"):
            halted_reason = f"UNSTABLE_LOSS:{tier_name}"
            break
        if train_res["training_config"].get("aborted_reason"):
            halted_reason = f"RESOURCE_OR_CANCEL:{train_res['training_config']['aborted_reason']}"
            break

    ladder_report = {
        "success": len(results) > 0 and all(r.get("success", False) for r in results if not r.get("skipped")),
        "brand": "VISION — MADE BY LOKESH | Powered by JARVIS",
        "hardware_audit": hw_audit,
        "tier_selection": selection,
        "dataset_summary": ds_prep,
        "threads_used": eff_threads,
        "max_commit_mb_ceiling": max_commit_mb,
        "halted_reason": halted_reason,
        "total_duration_s": round(time.perf_counter() - t_start, 2),
        "tiers_executed": results,
        "production_primary_replaced": False,
    }
    out_path = os.path.join(repo_root, "data", "neural_models", f"local_ladder_report_{tag}.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(ladder_report, f, indent=2)
    ladder_report["report_path"] = out_path
    return ladder_report
