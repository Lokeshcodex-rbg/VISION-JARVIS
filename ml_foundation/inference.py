"""
VISION — MADE BY LOKESH | Owned Foundation Model Serving & CLI Bridge (`ml_foundation/inference.py`)
Loads a verified PyTorch checkpoint + JarvisBPE tokenizer and runs:
  - Text generation
  - Native multimodal Vision + Prompt inference (category prediction, bbox localization, response)
  - Train / Evaluate actions callable cleanly from Node.js (`neuralBrainService.js`)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Callable, Dict, Optional

# Ensure repo root is on sys.path when invoked from anywhere
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
import torch.nn.functional as F

from ml_foundation.audio_data import AUDIO_CATEGORIES, load_audio_feature_tensor
from ml_foundation.benchmark_hardware import benchmark_presets
from ml_foundation.dataset_builder import build_unified_datasets
from ml_foundation.evaluator import evaluate_checkpoint
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer, VISUAL_CATEGORIES
from ml_foundation.readiness_planner import generate_full_readiness_report
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.local_ladder import audit_local_hardware, run_progressive_local_ladder, select_local_training_ladder
from ml_foundation.trainer import estimate_training_resources, load_image_tensor, run_training_pipeline


def _load_bundle(checkpoint_dir: str):
    tokenizer = JarvisBPE.load(checkpoint_dir)
    model, cfg = JarvisUnifiedTransformer.load_pretrained(checkpoint_dir, device="cpu", strict=False)
    return model, tokenizer, cfg


def run_infer_on_bundle(
    model: JarvisUnifiedTransformer,
    tokenizer: JarvisBPE,
    cfg: JarvisConfig,
    prompt: str,
    image_path: Optional[str] = None,
    audio_path: Optional[str] = None,
    max_new_tokens: int = 48,
    temperature: float = 0.05,
    cancel_check: Optional[Callable[[], bool]] = None,
) -> Dict[str, object]:
    """Run multimodal inference using an already-loaded model, tokenizer, and config."""
    t0 = time.perf_counter()

    img_tensor = None
    vision_analysis = None
    if image_path and os.path.exists(image_path):
        img_tensor = load_image_tensor(image_path, cfg.image_size).unsqueeze(0)
        with torch.no_grad():
            v_out = model.vision_encoder(img_tensor)
            probs = F.softmax(v_out["class_logits"][0], dim=-1)
            conf, cls_idx = torch.max(probs, dim=-1)
            bbox = [round(float(v), 4) for v in v_out["bbox_pred"][0].tolist()]
            top_vals, top_idxs = torch.topk(probs, k=min(3, len(VISUAL_CATEGORIES)))
            vision_analysis = {
                "predicted_category": VISUAL_CATEGORIES[int(cls_idx.item())],
                "confidence": round(float(conf.item()), 4),
                "normalized_bbox_cx_cy_w_h": bbox,
                "top_predictions": [
                    {"category": VISUAL_CATEGORIES[int(i.item())], "probability": round(float(v.item()), 4)}
                    for v, i in zip(top_vals, top_idxs)
                ],
                "embedding_dim": int(v_out["visual_embedding"].shape[-1]),
            }

    audio_tensor = None
    audio_analysis = None
    if audio_path and os.path.exists(audio_path) and model.audio_encoder is not None and cfg.audio_feature_dim > 0:
        audio_tensor = load_audio_feature_tensor(audio_path, feature_dim=cfg.audio_feature_dim)
        with torch.no_grad():
            a_out = model.audio_encoder.forward_dict(audio_tensor)
            a_probs = F.softmax(a_out["audio_logits"][0], dim=-1)
            a_conf, a_cls_idx = torch.max(a_probs, dim=-1)
            a_top_vals, a_top_idxs = torch.topk(a_probs, k=min(3, len(AUDIO_CATEGORIES)))
            audio_analysis = {
                "predicted_category": AUDIO_CATEGORIES[int(a_cls_idx.item())],
                "confidence": round(float(a_conf.item()), 4),
                "top_predictions": [
                    {"category": AUDIO_CATEGORIES[int(i.item())], "probability": round(float(v.item()), 4)}
                    for v, i in zip(a_top_vals, a_top_idxs)
                ],
                "feature_dim": int(cfg.audio_feature_dim),
            }

    if cancel_check and cancel_check():
        return {
            "success": False,
            "cancelled": True,
            "error": "INFERENCE_CANCELLED",
            "model": cfg.model_name,
            "version": cfg.version,
            "parameters": model.parameter_count(),
            "prompt": prompt,
            "completion": "",
            "generated_tokens": 0,
            "vision_analysis": vision_analysis,
            "audio_analysis": audio_analysis,
            "latency_ms": round((time.perf_counter() - t0) * 1000.0, 2),
        }

    prefix_tags = f"{'<vision> ' if img_tensor is not None else ''}{'<audio> ' if audio_tensor is not None else ''}"
    formatted = f"<bos><user>{prefix_tags}{prompt}</user><assistant>"
    prompt_ids = tokenizer.encode(formatted)
    stop_tok_ids = [tokenizer.vocab["</assistant>"]] if "</assistant>" in tokenizer.vocab else None
    eff_rep_penalty = 1.0 if float(temperature) <= 0.1 else 1.08
    out_ids = model.generate(
        torch.tensor([prompt_ids], dtype=torch.long),
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        repetition_penalty=eff_rep_penalty,
        no_repeat_ngram_size=4,
        eos_id=tokenizer.eos_id,
        images=img_tensor,
        audio_features=audio_tensor,
        stop_token_ids=stop_tok_ids,
        cancel_check=cancel_check,
    )
    was_cancelled = bool(cancel_check and cancel_check())
    completion_ids = out_ids[len(prompt_ids) :]
    decoded = tokenizer.decode(completion_ids, skip_special_tokens=True).strip()

    return {
        "success": not was_cancelled,
        "cancelled": was_cancelled,
        "model": cfg.model_name,
        "version": cfg.version,
        "parameters": model.parameter_count(),
        "prompt": prompt,
        "completion": decoded,
        "generated_tokens": len(completion_ids),
        "vision_analysis": vision_analysis,
        "audio_analysis": audio_analysis,
        "latency_ms": round((time.perf_counter() - t0) * 1000.0, 2),
    }


def infer(
    checkpoint_dir: str,
    prompt: str,
    image_path: Optional[str] = None,
    audio_path: Optional[str] = None,
    max_new_tokens: int = 48,
    temperature: float = 0.05,
    cancel_check: Optional[Callable[[], bool]] = None,
) -> Dict[str, object]:
    model, tokenizer, cfg = _load_bundle(checkpoint_dir)
    return run_infer_on_bundle(
        model,
        tokenizer,
        cfg,
        prompt=prompt,
        image_path=image_path,
        audio_path=audio_path,
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        cancel_check=cancel_check,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="JARVIS Owned Multimodal Neural Foundation CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_train = sub.add_parser("train")
    p_train.add_argument("--version", default="jarvis-v0.8.0")
    p_train.add_argument("--preset", default="jarvis-nano-multimodal")
    p_train.add_argument("--vocab-size", type=int, default=2048)
    p_train.add_argument("--pretrain-steps", type=int, default=55)
    p_train.add_argument("--sft-steps", type=int, default=80)
    p_train.add_argument("--vision-steps", type=int, default=110)
    p_train.add_argument("--dpo-steps", type=int, default=12)
    p_train.add_argument("--grad-accum-steps", type=int, default=2)
    p_train.add_argument("--resume-from", default="")
    p_train.add_argument("--dtype", default="auto")
    p_train.add_argument("--optimizer", default="adamw", choices=["adamw", "adafactor"])
    p_train.add_argument("--seq-len", type=int, default=None)
    p_train.add_argument("--micro-batch-size", type=int, default=None)
    p_train.add_argument("--gradient-checkpointing", action="store_true")
    p_train.add_argument("--threads", type=int, default=None)
    p_train.add_argument("--shard-dir", default=None)
    p_train.add_argument("--checkpoint-every-steps", type=int, default=25)
    p_train.add_argument("--max-commit-mb", type=float, default=None)
    p_train.add_argument("--no-early-stopping", action="store_true")
    p_train.add_argument("--early-stop-patience", type=int, default=3)
    p_train.add_argument("--allow-large-cpu", action="store_true")
    p_train.add_argument("--stop-after-stage", default="")
    p_train.add_argument("--stop-after-step", type=int, default=0)
    p_train.add_argument("--freeze-lm-for-multimodal", action="store_true")

    p_plan = sub.add_parser("plan")
    p_plan.add_argument("--preset", default="jarvis-v0.8-research-52m")
    p_plan.add_argument("--vocab-size", type=int, default=32768)
    p_plan.add_argument("--overtrain-multiplier", type=float, default=40.0)

    p_ready = sub.add_parser("readiness")
    p_ready.add_argument("--checkpoint-dir", default="")
    p_ready.add_argument("--out-path", default="")

    p_eval = sub.add_parser("eval")
    p_eval.add_argument("--checkpoint-dir", required=True)
    p_eval.add_argument("--prev-eval-json", default="")

    p_inf = sub.add_parser("infer")
    p_inf.add_argument("--checkpoint-dir", required=True)
    p_inf.add_argument("--prompt", required=True)
    p_inf.add_argument("--image-path", default="")
    p_inf.add_argument("--audio-path", default="")
    p_inf.add_argument("--max-tokens", type=int, default=48)
    p_inf.add_argument("--temperature", type=float, default=0.05)

    p_dist = sub.add_parser("distill")
    p_dist.add_argument("--version", default="distilled-latest")

    p_bench = sub.add_parser("benchmark")
    p_bench.add_argument("--vocab-size", type=int, default=2048)
    p_bench.add_argument("--seq-len", type=int, default=128)

    sub.add_parser("local-audit")
    p_lad = sub.add_parser("local-ladder")
    p_lad.add_argument("--tiers", default="smoke,tier1_10m")
    p_lad.add_argument("--steps-scale", type=float, default=1.0)
    p_lad.add_argument("--max-minutes", type=float, default=25.0)
    p_lad.add_argument("--threads", type=int, default=None)
    p_lad.add_argument("--run-tag", default=None)
    p_lad.add_argument("--ingest-hf-pilot", action="store_true")

    args = parser.parse_args()
    if args.cmd == "train":
        res = run_training_pipeline(
            REPO_ROOT,
            version_tag=args.version,
            preset=args.preset,
            vocab_size=args.vocab_size,
            pretrain_steps=args.pretrain_steps,
            sft_steps=args.sft_steps,
            vision_steps=args.vision_steps,
            dpo_steps=args.dpo_steps,
            grad_accum_steps=args.grad_accum_steps,
            resume_from=args.resume_from or None,
            dtype=args.dtype,
            early_stopping=not args.no_early_stopping,
            early_stop_patience=args.early_stop_patience,
            allow_large_cpu=args.allow_large_cpu,
            stop_after_stage=args.stop_after_stage or None,
            stop_after_step=args.stop_after_step or None,
            optimizer_type=args.optimizer,
            seq_len=args.seq_len,
            micro_batch_size=args.micro_batch_size,
            gradient_checkpointing=args.gradient_checkpointing,
            threads=args.threads,
            external_shard_dir=args.shard_dir,
            checkpoint_every_steps=args.checkpoint_every_steps,
            max_commit_mb=args.max_commit_mb,
            freeze_lm_for_multimodal=args.freeze_lm_for_multimodal,
        )
        print(json.dumps(res))
    elif args.cmd == "plan":
        res = estimate_training_resources(
            preset=args.preset,
            vocab_size=args.vocab_size,
            overtrain_multiplier=args.overtrain_multiplier,
        )
        print(json.dumps(res))
    elif args.cmd == "readiness":
        res = generate_full_readiness_report(
            REPO_ROOT,
            out_path=args.out_path or None,
            checkpoint_for_baseline=args.checkpoint_dir or None,
        )
        print(json.dumps(res))
    elif args.cmd == "eval":
        prev = json.loads(args.prev_eval_json) if args.prev_eval_json else None
        res = evaluate_checkpoint(REPO_ROOT, args.checkpoint_dir, previous_eval=prev)
        print(json.dumps(res))
    elif args.cmd == "infer":
        res = infer(
            args.checkpoint_dir,
            args.prompt,
            image_path=args.image_path or None,
            audio_path=args.audio_path or None,
            max_new_tokens=args.max_tokens,
            temperature=args.temperature,
        )
        print(json.dumps(res))
    elif args.cmd == "distill":
        out_dir = os.path.join(REPO_ROOT, "data", "neural_models", "datasets", args.version)
        manifest = build_unified_datasets(REPO_ROOT, out_dir, vision_per_class=24, audio_per_class=16)
        print(json.dumps({"success": True, **manifest}))
    elif args.cmd == "benchmark":
        res = benchmark_presets(vocab_size=args.vocab_size, seq_len=args.seq_len)
        print(json.dumps(res))
    elif args.cmd == "local-audit":
        hw = audit_local_hardware(REPO_ROOT)
        sel = select_local_training_ladder(hw, repo_root=REPO_ROOT)
        res = {"success": True, "hardware_audit": hw, "tier_selection": sel}
        print(json.dumps(res))
    elif args.cmd == "local-ladder":
        tiers = [t.strip() for t in str(args.tiers).split(",") if t.strip()]
        res = run_progressive_local_ladder(
            REPO_ROOT,
            run_tag=args.run_tag,
            tiers=tiers,
            steps_scale=args.steps_scale,
            max_total_minutes=args.max_minutes,
            threads=args.threads,
            ingest_hf_pilot=args.ingest_hf_pilot,
        )
        print(json.dumps(res))


if __name__ == "__main__":
    main()
