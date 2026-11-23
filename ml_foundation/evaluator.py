"""
VISION — MADE BY LOKESH | Honest Generated-Answer Foundation Evaluator (`ml_foundation/evaluator.py`)

Evaluation Policy:
  1. Pure native PyTorch weights (`model.generate`, `vision_encoder`, `audio_encoder`).
     NEVER substitutes Gemini, OpenRouter, RAG, or deterministic engines for model scores.
  2. Zero ranking-only padding: domain scores measure actual generated-answer accuracy,
     Python AST + unit-test execution for coding, JSON parsing + argument validation for tooling,
     and numeric solution extraction for math/multi-step reasoning.
  3. Separates native neural OCR (`neural_ocr_*`) from external Windows WinRT sensor checks.
  4. Reports exact per-example `per_example_results` (`passed`, `prompt`, `expected`, `generated`, `failure_reason`).
"""

from __future__ import annotations

import ast
import datetime
import json
import math
import os
import re
import subprocess
import time
from typing import Callable, Dict, List, Optional, Tuple

import torch
import torch.nn.functional as F

from ml_foundation.audio_data import load_audio_feature_tensor
from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer, VISUAL_CATEGORIES
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.trainer import _pad_batch, _read_jsonl, _sequence_log_prob, load_image_tensor


UNSEEN_EXTERNAL_EVAL_SNIPPETS: List[str] = [
    "In structural mechanics, Euler buckling load scales inversely with the square of effective column length.",
    "def merge_sorted(a, b):\n    out = []\n    i = j = 0\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            out.append(a[i]); i += 1\n        else:\n            out.append(b[j]); j += 1\n    return out + a[i:] + b[j:]",
    "TCP congestion control adjusts cwnd dynamically based on round-trip acknowledgments and packet loss signals.",
    "During rotary positional embedding, paired dimensions rotate proportionally to token position index m times theta_i.",
]


def _run_win_ocr(repo_root: str, image_path: str) -> str:
    """External non-neural Windows WinRT OCR helper (kept strictly separate from neural weights)."""
    ps_script = os.path.join(repo_root, "server", "desktop", "windows_ocr.ps1")
    if not os.path.exists(ps_script) or not os.path.exists(image_path):
        return ""
    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps_script, "-ImagePath", image_path],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if proc.returncode != 0:
            return ""
        raw = proc.stdout.strip()
        if not raw:
            return ""
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return " ".join(str(x).strip() for x in parsed if str(x).strip())
        return str(parsed).strip()
    except Exception:
        return ""


def _char_similarity(pred: str, truth: str) -> float:
    a = " ".join(pred.upper().split())
    b = " ".join(truth.upper().split())
    if not b:
        return 1.0 if not a else 0.0
    if a == b:
        return 1.0
    matches = sum(1 for i, ch in enumerate(b) if i < len(a) and a[i] == ch)
    token_a = set(a.split())
    token_b = set(b.split())
    tok_jaccard = (len(token_a & token_b) / len(token_a | token_b)) if (token_a | token_b) else 0.0
    return round(0.5 * (matches / len(b)) + 0.5 * tok_jaccard, 4)


def _compute_bbox_iou(pred: List[float], tgt: List[float]) -> float:
    px0, py0 = pred[0] - pred[2] / 2.0, pred[1] - pred[3] / 2.0
    px1, py1 = pred[0] + pred[2] / 2.0, pred[1] + pred[3] / 2.0
    tx0, ty0 = tgt[0] - tgt[2] / 2.0, tgt[1] - tgt[3] / 2.0
    tx1, ty1 = tgt[0] + tgt[2] / 2.0, tgt[1] + tgt[3] / 2.0
    ix0, iy0 = max(px0, tx0), max(py0, ty0)
    ix1, iy1 = min(px1, tx1), min(py1, ty1)
    inter = max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)
    union = max(1e-6, (px1 - px0) * (py1 - py0) + (tx1 - tx0) * (ty1 - ty0) - inter)
    return inter / union


def _strip_thoughts(text: str) -> str:
    cleaned = re.sub(r"<thought>[\s\S]*?</thought>", " ", str(text or ""))
    cleaned = re.sub(r"<\|think\|>[\s\S]*?<\|/think\|>", " ", cleaned)
    return cleaned.strip()


def _verify_numeric(generated: str, expected_val: float, tol: float = 0.05) -> Tuple[bool, str]:
    ans = _strip_thoughts(generated)
    nums = re.findall(r"-?\d+(?:\.\d+)?", ans)
    if not nums:
        return False, "No numeric answer produced"
    # Extract the FINAL stated answer (never early scratchpad steps like `x = 5 + 8`):
    m_hash = re.findall(r"####\s*(-?\d+(?:\.\d+)?)", ans)
    m_box = re.findall(r"\\boxed\{\s*(-?\d+(?:\.\d+)?)\s*\}", ans)
    m_eq = re.findall(
        r"(?:final answer\s*(?:is|:)?|answer\s*(?:is|:)|result\s*(?:is|:)|[xX]\s*=|=)\s*(-?\d+(?:\.\d+)?)(?!\s*[+\-*/^])",
        ans,
        flags=re.IGNORECASE,
    )
    if m_hash:
        cand = float(m_hash[-1])
    elif m_box:
        cand = float(m_box[-1])
    elif m_eq:
        cand = float(m_eq[-1])
    else:
        last_line = ans.strip().splitlines()[-1] if ans.strip() else ""
        last_nums = re.findall(r"-?\d+(?:\.\d+)?", last_line)
        cand = float(last_nums[-1] if last_nums else nums[-1])
    if abs(cand - expected_val) <= tol:
        alpha_words = re.findall(r"[A-Za-z]{2,}", ans)
        if len(alpha_words) >= 14:
            alpha_uniq = len(set(w.lower() for w in alpha_words)) / len(alpha_words)
            if alpha_uniq < 0.28:
                return False, f"Degenerate repetitive prose around numeric answer (alpha_uniq={alpha_uniq:.2f})"
        return True, ""
    return False, f"Numeric mismatch: expected {expected_val}, got {cand}"


def _verify_python_code(generated: str, fn_name: str, assertions_code: str) -> Tuple[bool, str]:
    txt = str(generated or "")
    m = re.search(r"```(?:python)?\s*([\s\S]*?)```", txt)
    code_src = (m.group(1) if m else txt).strip()
    if f"def {fn_name}" not in code_src:
        return False, f"Missing `def {fn_name}` in generated output"
    try:
        ast.parse(code_src)
    except SyntaxError as exc:
        return False, f"SyntaxError: {exc.msg}"
    ns: Dict[str, object] = {}
    try:
        exec(compile(code_src, "<vision_eval>", "exec"), {"__builtins__": {"abs": abs, "len": len, "sum": sum, "range": range, "int": int, "float": float, "min": min, "max": max}}, ns)
        exec(compile(assertions_code, "<vision_assert>", "exec"), ns, ns)
        return True, ""
    except Exception as exc:
        return False, f"Runtime/Assertion failure: {exc}"


def _verify_javascript_code(generated: str, fn_name: str, assertions_js: str) -> Tuple[bool, str]:
    txt = str(generated or "")
    m = re.search(r"```(?:javascript|js)?\s*([\s\S]*?)```", txt)
    code_src = (m.group(1) if m else txt).strip()
    if f"function {fn_name}" not in code_src and f"{fn_name} =" not in code_src and f"{fn_name}=" not in code_src:
        return False, f"Missing JS function `{fn_name}` in generated output"
    script = f"const vm = require('vm'); const ctx = vm.createContext({{}}); vm.runInContext({json.dumps(code_src + '\n' + assertions_js)}, ctx, {{ timeout: 1000 }});"
    try:
        proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=4)
        if proc.returncode == 0:
            return True, ""
        return False, f"JS runtime/syntax error: {(proc.stderr or proc.stdout).strip()[:120]}"
    except Exception as exc:
        return False, f"JS verifier error: {exc}"


def _verify_java_code(generated: str, fn_name: str, required_tokens: Tuple[str, ...]) -> Tuple[bool, str]:
    txt = str(generated or "")
    m = re.search(r"```(?:java)?\s*([\s\S]*?)```", txt)
    code_src = (m.group(1) if m else txt).strip()
    if not re.search(rf"\b(?:int|long|boolean|double|String|void)\s+{re.escape(fn_name)}\s*\(", code_src):
        return False, f"Missing Java method signature for `{fn_name}`"
    if code_src.count("{") == 0 or code_src.count("{") != code_src.count("}"):
        return False, "Unbalanced Java curly braces"
    if "return" not in code_src:
        return False, "Missing return statement in Java method"
    for tok in required_tokens:
        if tok not in code_src:
            return False, f"Missing expected Java logic token `{tok}`"
    return True, ""


def _extract_tool_json(generated: str) -> Optional[Dict[str, object]]:
    txt = str(generated or "").strip()
    m_tag = re.search(r"<\|tool_call\|>([\s\S]*?)(?:<\|/tool_call\|>|$)", txt)
    candidate = m_tag.group(1).strip() if m_tag else txt
    m_brace = re.search(r"\{[\s\S]*\}", candidate)
    if not m_brace:
        return None
    try:
        parsed = json.loads(m_brace.group(0))
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def _verify_language_coherence(
    generated: str,
    min_words: int = 8,
    required_any: Optional[Tuple[str, ...]] = None,
    forbid_code: bool = True,
) -> Tuple[bool, str]:
    txt = _strip_thoughts(generated)
    if not txt:
        return False, "Empty response"
    if re.search(r"(.)\1{6,}", txt):
        return False, "Repeated character run detected"
    words = re.findall(r"[A-Za-z0-9\u0900-\u097F]+", txt)
    if len(words) < min_words:
        return False, f"Too short ({len(words)} < {min_words} words)"
    unique_ratio = len(set(w.lower() for w in words)) / len(words)
    if unique_ratio < 0.48:
        return False, f"Repetitive text (unique_ratio={unique_ratio:.2f})"
    low = txt.lower()
    if any(bad in txt for bad in ("STREAMTOOLVERIFIED", "Audio class", "Detected_")):
        return False, "Training artifact phrase hallucination"
    if low.startswith("audio ") or any(tok in low for tok in (" de la ", " el tión", " más,")):
        return False, "Cross-stage/language bleed artifact"
    if forbid_code and ("def " in low or "```python" in low or "```java" in low):
        return False, "Spurious code snippet emitted in prose response"
    if len(words) >= 12:
        trigrams = [tuple(w.lower() for w in words[i : i + 3]) for i in range(len(words) - 2)]
        most_common_tg = max((trigrams.count(t) for t in set(trigrams)), default=0)
        if most_common_tg >= 4:
            return False, f"N-gram repetition loop detected (count={most_common_tg})"
    if required_any:
        def _matches_req(req: str) -> bool:
            r_low = req.lower()
            if any("\u0900" <= ch <= "\u097F" for ch in r_low):
                return r_low in low
            return bool(re.search(rf"(?<![a-z0-9_]){re.escape(r_low)}", low))
        if not any(_matches_req(req) for req in required_any):
            return False, f"Off-topic response (missing domain terms from {required_any[:5]})"
    return True, ""


def evaluate_checkpoint(
    repo_root: str,
    checkpoint_dir: str,
    dataset_dir: Optional[str] = None,
    previous_eval: Optional[Dict[str, object]] = None,
) -> Dict[str, object]:
    """Run strictly isolated, generated-answer evaluation against a saved VISION checkpoint."""
    weights_path = os.path.join(checkpoint_dir, "weights.pt")
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Checkpoint weights not found: {weights_path}")

    ckpt = torch.load(weights_path, map_location="cpu", weights_only=True)
    cfg = JarvisConfig.from_dict(ckpt["config"])
    tokenizer = JarvisBPE.load(checkpoint_dir)
    model = JarvisUnifiedTransformer(cfg)
    model.load_state_dict(ckpt["model_state_dict"], strict=False)
    model.eval()

    version = cfg.version
    if not dataset_dir:
        cand = os.path.join(repo_root, "data", "neural_models", "datasets", version)
        dataset_dir = cand if os.path.isdir(cand) else os.path.join(repo_root, "data", "neural_models", "datasets", "distilled-test-audit")

    sft_val = _read_jsonl(os.path.join(dataset_dir, "sft_val.jsonl"))
    sft_test = _read_jsonl(os.path.join(dataset_dir, "sft_test.jsonl"))
    dpo_eval_path = os.path.join(dataset_dir, "dpo_eval.jsonl")
    dpo_train_path = os.path.join(dataset_dir, "dpo_pairs.jsonl")
    dpo_eval_is_disjoint = os.path.exists(dpo_eval_path)
    dpo_rows = _read_jsonl(dpo_eval_path) if dpo_eval_is_disjoint else _read_jsonl(dpo_train_path)
    mm_rows = _read_jsonl(os.path.join(dataset_dir, "multimodal_train_val.jsonl"))
    mm_val = [r for r in mm_rows if r.get("split") == "val"]
    mm_test = [r for r in mm_rows if r.get("split") == "test"]
    audio_rows = _read_jsonl(os.path.join(dataset_dir, "multimodal_audio.jsonl"))
    audio_eval_rows = [r for r in audio_rows if r.get("split") in ("val", "test")]

    def _eval_sft_split(rows: List[Dict[str, object]]) -> Optional[float]:
        if not rows:
            return None
        losses: List[float] = []
        with torch.no_grad():
            for start in range(0, len(rows), 16):
                chunk = rows[start : start + 16]
                seqs, prefs = [], []
                for r in chunk:
                    p_ids = tokenizer.encode(f"<bos><user>{r['instruction']}</user><assistant>")
                    r_ids = tokenizer.encode(f"{r['response']}<eos>")
                    seqs.append(p_ids + r_ids)
                    prefs.append(len(p_ids))
                inp, lbl = _pad_batch(seqs, tokenizer.pad_id, cfg.max_seq_len, prefs)
                out = model(inp, labels=lbl)
                if out["lm_loss"] is not None:
                    losses.append(float(out["lm_loss"].item()))
        return (sum(losses) / len(losses)) if losses else None

    def _eval_unseen_ppl() -> Tuple[float, float]:
        losses: List[float] = []
        with torch.no_grad():
            for snippet in UNSEEN_EXTERNAL_EVAL_SNIPPETS:
                ids = tokenizer.encode(snippet, add_bos=True, add_eos=True)
                if len(ids) < 4:
                    continue
                inp, lbl = _pad_batch([ids], tokenizer.pad_id, cfg.max_seq_len)
                out = model(inp, labels=lbl)
                if out["lm_loss"] is not None:
                    losses.append(float(out["lm_loss"].item()))
        mean_l = (sum(losses) / len(losses)) if losses else 10.0
        return mean_l, math.exp(min(12.0, mean_l))

    sft_val_loss = _eval_sft_split(sft_val)
    sft_test_loss = _eval_sft_split(sft_test) if sft_test else None
    sft_ppl = math.exp(min(12.0, sft_val_loss)) if sft_val_loss is not None else 999.0
    sft_test_ppl = math.exp(min(12.0, sft_test_loss)) if sft_test_loss is not None else None
    unseen_ext_loss, unseen_ext_ppl = _eval_unseen_ppl()

    # 2. Native Vision Classification, Localization & ECE
    vision_correct = 0
    vision_total = 0
    ious: List[float] = []
    vision_confs: List[float] = []
    vision_hits: List[float] = []
    vision_cat_stats: Dict[str, Dict[str, object]] = {}
    vision_eval_rows = mm_val + mm_test
    if vision_eval_rows:
        with torch.no_grad():
            for r in vision_eval_rows:
                img_t = load_image_tensor(str(r["image_path"]), cfg.image_size).unsqueeze(0)
                v_out = model.vision_encoder(img_t)
                probs = F.softmax(v_out["class_logits"][0], dim=-1)
                conf_val, pred_idx = torch.max(probs, dim=-1)
                pred_cls = int(pred_idx.item())
                hit = 1.0 if pred_cls == int(r["category_id"]) else 0.0
                vision_confs.append(float(conf_val.item()))
                vision_hits.append(hit)
                pred_bbox = [float(x) for x in v_out["bbox_pred"][0].tolist()]
                iou_val = _compute_bbox_iou(pred_bbox, list(r["bbox"]))
                if hit > 0:
                    vision_correct += 1
                ious.append(iou_val)
                vision_total += 1

                cat_name = str(r.get("category", VISUAL_CATEGORIES[int(r["category_id"])]))
                st = vision_cat_stats.setdefault(cat_name, {"correct": 0, "total": 0, "ious": []})
                st["total"] = int(st["total"]) + 1
                if hit > 0:
                    st["correct"] = int(st["correct"]) + 1
                st["ious"].append(iou_val)  # type: ignore[union-attr]

    vision_accuracy = (vision_correct / vision_total) if vision_total > 0 else 0.0
    mean_iou = (sum(ious) / len(ious)) if ious else 0.0
    vision_category_breakdown = {
        cat: {
            "correct": st["correct"],
            "total": st["total"],
            "accuracy": round(int(st["correct"]) / max(1, int(st["total"])), 4),
            "mean_iou": round(sum(st["ious"]) / max(1, len(st["ious"])), 4),  # type: ignore[arg-type]
        }
        for cat, st in vision_cat_stats.items()
    }

    ece = 0.0
    if vision_total > 0:
        for b_idx in range(5):
            lo, hi = b_idx * 0.2, (b_idx + 1) * 0.2
            idxs = [i for i, c in enumerate(vision_confs) if (lo <= c < hi or (b_idx == 4 and c == 1.0))]
            if idxs:
                acc_b = sum(vision_hits[i] for i in idxs) / len(idxs)
                conf_b = sum(vision_confs[i] for i in idxs) / len(idxs)
                ece += (len(idxs) / vision_total) * abs(acc_b - conf_b)

    # 2a. Strict Separation: Native Neural OCR vs External WinRT Sensor Check
    ocr_rows = _read_jsonl(os.path.join(dataset_dir, "ocr_spec_plates.jsonl"))
    ocr_eval_rows = [r for r in ocr_rows if r.get("split") in ("val", "test")]
    stop_tok_ids = [tokenizer.vocab[t] for t in ("</assistant>", "<eos>") if t in tokenizer.vocab]

    neural_ocr_exact = 0
    neural_ocr_char_scores: List[float] = []
    neural_ocr_samples: List[Dict[str, object]] = []
    winrt_exact = 0
    winrt_char_scores: List[float] = []
    winrt_samples: List[Dict[str, object]] = []

    for r in ocr_eval_rows:
        gt_text = str(r.get("ground_truth_text", "")).strip()
        img_path = str(r.get("image_path", ""))
        # Native neural readout WITHOUT WinRT
        if os.path.exists(img_path):
            img_t = load_image_tensor(img_path, cfg.image_size).unsqueeze(0)
            p_ids = tokenizer.encode("<bos><user><vision> Read the exact text on this specification plate.</user><assistant>")
            with torch.no_grad():
                out_ids = model.generate(torch.tensor([p_ids], dtype=torch.long), max_new_tokens=20, temperature=0.01, repetition_penalty=1.0, eos_id=tokenizer.eos_id, images=img_t, stop_token_ids=stop_tok_ids)
            neural_txt = tokenizer.decode(out_ids[len(p_ids) :], skip_special_tokens=True).strip()
        else:
            neural_txt = ""
        n_sim = _char_similarity(neural_txt, gt_text)
        n_exact = " ".join(neural_txt.upper().split()) == " ".join(gt_text.upper().split())
        if n_exact:
            neural_ocr_exact += 1
        neural_ocr_char_scores.append(n_sim)
        neural_ocr_samples.append({
            "id": r.get("id"), "split": r.get("split"), "ground_truth": gt_text,
            "neural_generated": neural_txt, "char_similarity": n_sim, "exact_match": n_exact,
        })

        # External OS WinRT Sensor OCR (non-neural)
        win_txt = _run_win_ocr(repo_root, img_path)
        w_sim = _char_similarity(win_txt, gt_text)
        w_exact = " ".join(win_txt.upper().split()) == " ".join(gt_text.upper().split())
        if w_exact:
            winrt_exact += 1
        winrt_char_scores.append(w_sim)
        winrt_samples.append({
            "id": r.get("id"), "split": r.get("split"), "ground_truth": gt_text,
            "recognized_by_winrt": win_txt, "char_similarity": w_sim, "exact_match": w_exact,
        })

    ocr_total = len(ocr_eval_rows)
    neural_ocr_acc = (neural_ocr_exact / ocr_total) if ocr_total > 0 else 0.0
    neural_ocr_char_acc = (sum(neural_ocr_char_scores) / ocr_total) if ocr_total > 0 else 0.0
    winrt_ocr_acc = (winrt_exact / ocr_total) if ocr_total > 0 else 0.0
    winrt_ocr_char_acc = (sum(winrt_char_scores) / ocr_total) if ocr_total > 0 else 0.0

    # 2b. Multimodal Acoustic Classification on Held-Out Synthetic WAVs
    audio_correct = 0
    audio_total = 0
    if audio_eval_rows and model.audio_encoder is not None and cfg.audio_feature_dim > 0:
        with torch.no_grad():
            for r in audio_eval_rows:
                apath = str(r.get("audio_path", ""))
                if not apath or not os.path.exists(apath):
                    continue
                aud_t = load_audio_feature_tensor(apath, feature_dim=cfg.audio_feature_dim)
                a_out = model.audio_encoder.forward_dict(aud_t)
                _, a_pred = torch.max(F.softmax(a_out["audio_logits"][0], dim=-1), dim=-1)
                if int(a_pred.item()) == int(r["category_id"]):
                    audio_correct += 1
                audio_total += 1
    audio_accuracy = (audio_correct / audio_total) if audio_total > 0 else 0.0

    # 3. Genuine Generated-Answer Evaluation Suite Across All Domains (NO RANKING SUBSTITUTION)
    per_example_results: List[Dict[str, object]] = []
    domain_buckets: Dict[str, List[float]] = {
        "language_generation": [],
        "hindi_devanagari": [],
        "hinglish": [],
        "mathematics": [],
        "coding": [],
        "coding_python": [],
        "coding_javascript": [],
        "coding_java": [],
        "software_engineering": [],
        "instruction_following": [],
        "multistep_reasoning": [],
        "general_knowledge": [],
        "engineering_knowledge": [],
        "robotics": [],
        "tool_selection": [],
        "tool_argument_validity": [],
    }

    def _run_gen_probe(
        probe_id: str,
        domain: str,
        prompt: str,
        expected_desc: str,
        verifier: Callable[[str], Tuple[bool, str]],
        max_toks: int = 48,
        image_tensor: Optional[torch.Tensor] = None,
    ) -> None:
        p_ids = tokenizer.encode(f"<bos><user>{prompt}</user><assistant>")
        with torch.no_grad():
            out_ids = model.generate(
                torch.tensor([p_ids], dtype=torch.long),
                max_new_tokens=max_toks,
                temperature=0.01,
                repetition_penalty=1.0,
                no_repeat_ngram_size=4,
                eos_id=tokenizer.eos_id,
                images=image_tensor,
                stop_token_ids=stop_tok_ids,
            )
        gen = tokenizer.decode(out_ids[len(p_ids) :], skip_special_tokens=True).strip()
        passed, reason = verifier(gen)
        if domain in domain_buckets:
            domain_buckets[domain].append(1.0 if passed else 0.0)
        per_example_results.append({
            "id": probe_id,
            "domain": domain,
            "prompt": prompt,
            "expected": expected_desc,
            "generated": gen,
            "passed": bool(passed),
            "failure_reason": "" if passed else reason,
        })

    # Language Generation, Hindi & Hinglish
    _run_gen_probe(
        "lang_01", "language_generation",
        "Explain in clear prose why automated systems separate verified measurements from guesses.",
        "Coherent explanation mentioning verified measurements vs guesses/accuracy/errors",
        lambda g: _verify_language_coherence(
            g,
            min_words=8,
            required_any=("measur", "verif", "guess", "accur", "error", "reliab", "data", "fact", "sensor", "evidence"),
        ),
    )
    _run_gen_probe(
        "lang_02", "hinglish",
        "Hinglish mein batayein ki neural network testing mein held-out validation split kyun zaroori hai?",
        "Coherent Hinglish explanation mentioning overfitting, generalization, or unseen data",
        lambda g: _verify_language_coherence(
            g,
            min_words=7,
            required_any=("overfit", "val", "split", "test", "general", "unseen", "train", "data", "model", "accur"),
        ),
    )
    _run_gen_probe(
        "lang_hindi_01", "hindi_devanagari",
        "हिंदी में समझाएं कि रोबोटिक्स सिस्टम में इमरजेंसी स्टॉप बटन क्यों लगाया जाता है?",
        "Coherent Devanagari safety explanation (>6 words, safety/stop meaning)",
        lambda g: (
            _verify_language_coherence(
                g,
                min_words=6,
                required_any=("सुरक्षा", "बचाव", "रोक", "बंद", "खतर", "आपात", "रोबोट", "मशीन", "दुर्घट", "नुकसान"),
            )
            if re.search(r"[\u0900-\u097F]{3,}", g)
            else (False, "Expected Devanagari Hindi script in response")
        ),
    )

    # Mathematics
    _run_gen_probe(
        "math_01", "mathematics",
        "Solve the linear equation 4*x + 9 = 29 for x.",
        "x = 5",
        lambda g: _verify_numeric(g, 5.0),
    )
    _run_gen_probe(
        "math_02", "mathematics",
        "Compute the kinetic energy in Joules of a 4 kg object moving at 3 m/s.",
        "18 J",
        lambda g: _verify_numeric(g, 18.0),
    )

    # Coding (Python AST/exec + JavaScript Node VM Verification)
    def _run_py_probe(pid: str, prompt: str, expected: str, fn_name: str, asserts: str) -> None:
        _run_gen_probe(pid, "coding", prompt, expected, lambda g: _verify_python_code(g, fn_name, asserts), max_toks=64)
        domain_buckets["coding_python"].append(domain_buckets["coding"][-1])

    def _run_js_probe(pid: str, prompt: str, expected: str, fn_name: str, asserts: str) -> None:
        _run_gen_probe(pid, "coding", prompt, expected, lambda g: _verify_javascript_code(g, fn_name, asserts), max_toks=64)
        domain_buckets["coding_javascript"].append(domain_buckets["coding"][-1])

    _run_py_probe(
        "code_py_01",
        "Write a Python function add_two(a, b) returning a + b.",
        "Valid Python def add_two(a, b) passing add_two(3, 5) == 8",
        "add_two",
        "assert add_two(3, 5) == 8 and add_two(-1, 4) == 3",
    )
    _run_py_probe(
        "code_py_02",
        "Write a Python function is_even(n) returning True if n is even else False.",
        "Valid Python def is_even(n) passing assertions",
        "is_even",
        "assert is_even(4) is True and is_even(7) is False",
    )
    _run_js_probe(
        "code_js_01",
        "Write a JavaScript function multiplyTwo(a, b) that returns a * b.",
        "Valid JS function multiplyTwo(a, b) passing assertions",
        "multiplyTwo",
        "if (multiplyTwo(6, 7) !== 42 || multiplyTwo(-2, 5) !== -10) throw new Error('fail');",
    )
    _run_js_probe(
        "code_js_02",
        "Write a JavaScript function isPositive(n) returning true when n > 0 else false.",
        "Valid JS function isPositive(n) passing assertions",
        "isPositive",
        "if (isPositive(3) !== true || isPositive(0) !== false || isPositive(-4) !== false) throw new Error('fail');",
    )
    _run_gen_probe(
        "code_java_01", "coding",
        "Write a Java static method maxOfTwo(int a, int b) returning the larger integer.",
        "Valid Java method maxOfTwo(int a, int b) returning larger value",
        lambda g: (
            _verify_java_code(g, "maxOfTwo", ("int a", "int b"))
            if any(op in g for op in (">", "<", "Math.max"))
            else (False, "Missing comparison logic (> / < / Math.max) in maxOfTwo")
        ),
        max_toks=64,
    )
    domain_buckets["coding_java"].append(domain_buckets["coding"][-1])
    _run_gen_probe(
        "swe_01", "software_engineering",
        "Why must regression tests run automatically after refactoring production backend code?",
        "Coherent explanation of catching regressions/bugs safely after refactoring",
        lambda g: _verify_language_coherence(
            g,
            min_words=7,
            required_any=("regress", "bug", "break", "refactor", "test", "chang", "reliab", "catch", "behav", "deploy", "safe"),
        ),
    )

    # Instruction Following
    _run_gen_probe(
        "inst_01", "instruction_following",
        'Reply strictly in valid JSON containing key "status" with value "ready".',
        'Valid JSON {"status": "ready"}',
        lambda g: ((True, "") if (isinstance(_extract_tool_json(g), dict) and _extract_tool_json(g).get("status") == "ready") else (False, "Did not output valid JSON with status=='ready'")),
    )
    _run_gen_probe(
        "inst_02", "instruction_following",
        "Answer in 5 words or fewer: What planet orbits Earth?",
        "Contains 'moon' in <= 5 words",
        lambda g: ((True, "") if ("moon" in g.lower() and 1 <= len(g.split()) <= 6) else (False, f"Expected <=5 word answer with 'moon', got: {g[:80]}")),
    )

    # Multi-step Reasoning
    _run_gen_probe(
        "multi_01", "multistep_reasoning",
        "Two 6 ohm resistors are wired in parallel, then wired in series with a 2 ohm resistor. Find total resistance in ohms.",
        "5 ohm (6||6 = 3, 3 + 2 = 5)",
        lambda g: _verify_numeric(g, 5.0),
    )
    _run_gen_probe(
        "multi_02", "multistep_reasoning",
        "A rover travels at 5 m/s for 6 seconds, stops, then moves 12 meters backward. What is net displacement in meters?",
        "18 meters",
        lambda g: _verify_numeric(g, 18.0),
    )

    # General Knowledge
    _run_gen_probe(
        "gk_01", "general_knowledge",
        "What is the boiling point of pure water at 1 atmosphere in degrees Celsius?",
        "100",
        lambda g: _verify_numeric(g, 100.0, tol=0.5),
    )
    _run_gen_probe(
        "gk_02", "general_knowledge",
        "Which data structure operates in First-In First-Out (FIFO) order: stack or queue?",
        "queue",
        lambda g: ((True, "") if ("queue" in g.lower() and "stack" not in g.lower()) else (False, "Did not unambiguously select 'queue'")),
    )

    # Technical, Engineering & Robotics Knowledge
    _run_gen_probe(
        "eng_01", "engineering_knowledge",
        "Using Ohm's law, calculate current in amperes when 24 V is applied across a 6 ohm resistor.",
        "4 A",
        lambda g: _verify_numeric(g, 4.0, tol=0.05),
    )
    _run_gen_probe(
        "eng_02", "engineering_knowledge",
        "A robotic joint has 2.0 N*m load torque. With a 1.5x safety factor, what minimum motor torque in N*m is required?",
        "3.0 N*m",
        lambda g: _verify_numeric(g, 3.0, tol=0.05),
    )
    _run_gen_probe(
        "rob_01", "robotics",
        "In robotics control, what does the derivative (D) term in a PID controller reduce during joint movement?",
        "Overshoot / oscillation / settling instability",
        lambda g: _verify_language_coherence(
            g,
            min_words=5,
            required_any=("overshoot", "oscillat", "damp", "stabil", "ring", "settling", "swing"),
        ),
    )
    _run_gen_probe(
        "rob_02", "robotics",
        "A 6-DOF robotic actuator operates at 24 V and draws 2.5 A. Calculate electrical power in watts.",
        "60 W",
        lambda g: _verify_numeric(g, 60.0, tol=0.5),
    )

    # Tool Selection & Tool Argument Validity
    tool_menu_prompt_1 = "Available tools: [open_desktop_app(app_name), stage_whatsapp_message(contact, text)]. User asks: Open VS Code."
    _run_gen_probe(
        "tool_sel_01", "tool_selection",
        tool_menu_prompt_1,
        "Select open_desktop_app",
        lambda g: ((True, "") if "open_desktop_app" in g else (False, "Expected tool name open_desktop_app")),
    )
    _run_gen_probe(
        "tool_arg_01", "tool_argument_validity",
        tool_menu_prompt_1,
        'JSON {"tool": "open_desktop_app", "arguments": {"app_name": "vscode"}}',
        lambda g: (
            (True, "")
            if (
                isinstance((obj := _extract_tool_json(g)), dict)
                and obj.get("tool") == "open_desktop_app"
                and isinstance(obj.get("arguments"), dict)
                and "vscode" in str(obj["arguments"].get("app_name", "")).lower()
            )
            else (False, f"Invalid tool JSON or missing arguments.app_name=='vscode': {g[:90]}")
        ),
    )

    tool_menu_prompt_2 = "Available tools: [stage_whatsapp_message(contact, text), get_system_health()]. User asks: Draft WhatsApp message to Lokesh saying Hii."
    _run_gen_probe(
        "tool_sel_02", "tool_selection",
        tool_menu_prompt_2,
        "Select stage_whatsapp_message",
        lambda g: ((True, "") if "stage_whatsapp_message" in g else (False, "Expected tool name stage_whatsapp_message")),
    )
    _run_gen_probe(
        "tool_arg_02", "tool_argument_validity",
        tool_menu_prompt_2,
        'JSON {"tool": "stage_whatsapp_message", "arguments": {"contact": "Lokesh", "text": "Hii"}}',
        lambda g: (
            (True, "")
            if (
                isinstance((obj := _extract_tool_json(g)), dict)
                and obj.get("tool") == "stage_whatsapp_message"
                and isinstance(obj.get("arguments"), dict)
                and "lokesh" in str(obj["arguments"].get("contact", "")).lower()
                and "hii" in str(obj["arguments"].get("text", "")).lower()
            )
            else (False, f"Invalid WhatsApp tool JSON/args: {g[:90]}")
        ),
    )

    # Image-conditioned Visual Generation Probe (honest generated check)
    vr_rows = mm_test if mm_test else mm_val
    vr_gen_score = 0.0
    if vr_rows:
        vr = vr_rows[0]
        vr_cat = str(vr.get("category", VISUAL_CATEGORIES[int(vr["category_id"])]))
        vr_img = load_image_tensor(str(vr["image_path"]), cfg.image_size).unsqueeze(0)
        p_vr = tokenizer.encode("<bos><user><vision> Classify visual component.</user><assistant>")
        with torch.no_grad():
            out_vr = model.generate(torch.tensor([p_vr], dtype=torch.long), max_new_tokens=20, temperature=0.01, repetition_penalty=1.0, eos_id=tokenizer.eos_id, images=vr_img, stop_token_ids=stop_tok_ids)
        vr_txt = tokenizer.decode(out_vr[len(p_vr) :], skip_special_tokens=True).strip()
        vr_passed = vr_cat.replace("_", " ") in vr_txt.lower().replace("_", " ")
        vr_gen_score = 1.0 if vr_passed else 0.0
        per_example_results.append({
            "id": "vis_gen_01", "domain": "visual_understanding",
            "prompt": f"<vision:{vr_cat}> Classify visual component.", "expected": vr_cat,
            "generated": vr_txt, "passed": vr_passed,
            "failure_reason": "" if vr_passed else f"Generated caption lacked category '{vr_cat}'",
        })

    domain_scores: Dict[str, float] = {
        k: round(sum(v) / len(v), 4) if v else 0.0
        for k, v in domain_buckets.items()
    }
    domain_scores["visual_understanding"] = round(0.5 * vision_accuracy + 0.5 * vr_gen_score, 4)
    domain_scores["audio_understanding"] = round(audio_accuracy, 4)
    domain_scores["science_engineering"] = round(
        0.5 * domain_scores["engineering_knowledge"] + 0.5 * domain_scores["robotics"], 4
    )
    # Compatibility keys grounded purely in true generation scores (NO ranking inflation)
    domain_scores["math_reasoning"] = domain_scores["mathematics"]
    domain_scores["multistep_planning"] = domain_scores["multistep_reasoning"]
    domain_scores["visual_reasoning"] = round(vr_gen_score, 4)
    domain_scores["tool_use"] = domain_scores["tool_argument_validity"]

    gen_passed_count = sum(1 for r in per_example_results if r["passed"])
    gen_total_count = len(per_example_results)
    generation_accuracy = round(gen_passed_count / max(1, gen_total_count), 4)

    # 4. Disjoint DPO Alignment Margin
    dpo_wins = 0
    dpo_margins: List[float] = []
    with torch.no_grad():
        for r in dpo_rows:
            p_ids = tokenizer.encode(f"<bos><user>{r['prompt']}</user><assistant>")
            c_ids = p_ids + tokenizer.encode(f"{r['chosen']}<eos>")
            rj_ids = p_ids + tokenizer.encode(f"{r['rejected']}<eos>")
            lp_c = float(_sequence_log_prob(model, p_ids, c_ids, cfg.max_seq_len).item())
            lp_r = float(_sequence_log_prob(model, p_ids, rj_ids, cfg.max_seq_len).item())
            lc = max(1, len(c_ids) - len(p_ids))
            lr_len = max(1, len(rj_ids) - len(p_ids))
            margin = (lp_c / lc) - (lp_r / lr_len)
            dpo_margins.append(margin)
            if margin > 0:
                dpo_wins += 1
    alignment_win_rate = (dpo_wins / len(dpo_rows)) if dpo_rows else 0.0

    # 5. Latency & KV-cache Speedup
    prompt_ids = tokenizer.encode("<bos><user>Compute 2 + 2</user><assistant>")
    p_tensor = torch.tensor([prompt_ids], dtype=torch.long)
    t0 = time.perf_counter()
    out_ids = model.generate(p_tensor, max_new_tokens=24, temperature=0.01, eos_id=tokenizer.eos_id, use_kv_cache=True)
    gen_ms = (time.perf_counter() - t0) * 1000.0
    ms_per_token = gen_ms / max(1, len(out_ids) - len(prompt_ids))

    t_nc = time.perf_counter()
    out_nc = model.generate(p_tensor, max_new_tokens=16, temperature=0.01, eos_id=tokenizer.eos_id, use_kv_cache=False)
    uncached_ms_per_token = ((time.perf_counter() - t_nc) * 1000.0) / max(1, len(out_nc) - len(prompt_ids))

    t_kv = time.perf_counter()
    out_kv = model.generate(p_tensor, max_new_tokens=16, temperature=0.01, eos_id=tokenizer.eos_id, use_kv_cache=True)
    kv_cache_ms_per_token = ((time.perf_counter() - t_kv) * 1000.0) / max(1, len(out_kv) - len(prompt_ids))
    kv_cache_speedup = uncached_ms_per_token / max(1e-3, kv_cache_ms_per_token)

    # Honest Native Neural Composite (weights true generated answers + unseen PPL + vision + alignment)
    ext_ppl_score = max(0.0, min(1.0, 1.0 - (min(unseen_ext_ppl, 150.0) - 1.0) / 149.0))
    composite_score = round(
        0.40 * generation_accuracy
        + 0.20 * ext_ppl_score
        + 0.15 * vision_accuracy
        + 0.10 * neural_ocr_acc
        + 0.15 * alignment_win_rate,
        4,
    )

    regression_detected = False
    comparison_vs_previous = None
    if previous_eval and isinstance(previous_eval, dict):
        prev_score = float(previous_eval.get("composite_score", 0.0))
        if composite_score + 0.03 < prev_score:
            regression_detected = True
        prev_metrics = previous_eval.get("metrics") or {}
        prev_params = (previous_eval.get("parameters") or {}).get("total_parameters")
        cur_params = model.parameter_count().get("total_parameters", 1)
        comparison_vs_previous = {
            "composite_delta": round(composite_score - prev_score, 4),
            "generation_accuracy_delta": round(generation_accuracy - float(prev_metrics.get("generation_accuracy", 0.0)), 4) if "generation_accuracy" in prev_metrics else None,
            "vision_acc_delta": round(vision_accuracy - float(prev_metrics.get("vision_val_accuracy", 0.0)), 4) if "vision_val_accuracy" in prev_metrics else None,
            "sft_val_ppl_delta": round(sft_ppl - float(prev_metrics.get("sft_val_perplexity", sft_ppl)), 2) if "sft_val_perplexity" in prev_metrics else None,
            "param_ratio": round(cur_params / max(1, int(prev_params)), 2) if prev_params else None,
        }

    experimental_gate_passed = (not regression_detected) and (vision_accuracy >= 0.65) and (alignment_win_rate >= 0.60)
    production_primary_eligible = bool(
        cfg.d_model >= 768
        and generation_accuracy >= 0.80
        and domain_scores["tool_argument_validity"] >= 0.85
        and neural_ocr_acc >= 0.70
        and unseen_ext_ppl <= 25.0
        and vision_accuracy >= 0.80
        and not regression_detected
    )

    result = {
        "success": True,
        "version": version,
        "checkpoint_dir": checkpoint_dir,
        "evaluation_mode": "NATIVE_GENERATION_ONLY_NO_GEMINI_NO_RAG_NO_TOOLS",
        "parameters": model.parameter_count(),
        "metrics": {
            "generation_passed": gen_passed_count,
            "generation_total": gen_total_count,
            "generation_accuracy": generation_accuracy,
            "sft_val_loss": round(sft_val_loss, 4) if sft_val_loss is not None else None,
            "sft_val_perplexity": round(sft_ppl, 2),
            "sft_test_loss": round(sft_test_loss, 4) if sft_test_loss is not None else None,
            "sft_test_perplexity": round(sft_test_ppl, 2) if sft_test_ppl is not None else None,
            "unseen_external_loss": round(unseen_ext_loss, 4),
            "unseen_external_perplexity": round(unseen_ext_ppl, 2),
            "vision_val_accuracy": round(vision_accuracy, 4),
            "vision_val_correct": vision_correct,
            "vision_val_total": vision_total,
            "vision_eval_distribution": "synthetic_64_or_128_pil_sprites",
            "vision_mean_iou": round(mean_iou, 4),
            "vision_category_breakdown": vision_category_breakdown,
            "neural_ocr_exact_matches": neural_ocr_exact,
            "neural_ocr_accuracy": round(neural_ocr_acc, 4),
            "neural_ocr_char_accuracy": round(neural_ocr_char_acc, 4),
            "neural_ocr_samples": neural_ocr_samples,
            # External OS sensor WinRT OCR kept explicitly labeled as non-neural for pipeline regression checks
            "ocr_backend": "external_winrt_sensor_non_neural",
            "ocr_exact_matches": winrt_exact,
            "ocr_total": ocr_total,
            "ocr_accuracy": round(winrt_ocr_acc, 4),
            "ocr_char_accuracy": round(winrt_ocr_char_acc, 4),
            "ocr_samples": winrt_samples,
            "audio_val_accuracy": round(audio_accuracy, 4),
            "audio_val_correct": audio_correct,
            "audio_val_total": audio_total,
            "audio_eval_distribution": "synthetic_pcm16_sine_waves_only",
            "expected_calibration_error_ece": round(ece, 4),
            "mean_vision_confidence": round(sum(vision_confs) / max(1, len(vision_confs)), 4),
            "alignment_eval_disjoint": dpo_eval_is_disjoint,
            "alignment_win_rate": round(alignment_win_rate, 4),
            "alignment_mean_margin": round(sum(dpo_margins) / max(1, len(dpo_margins)), 4),
            "domain_benchmarks": domain_scores,
            "inference_latency_ms": round(gen_ms, 2),
            "ms_per_token": round(ms_per_token, 2),
            "kv_cache_ms_per_token": round(kv_cache_ms_per_token, 2),
            "uncached_ms_per_token": round(uncached_ms_per_token, 2),
            "kv_cache_speedup": round(kv_cache_speedup, 2),
        },
        "per_example_results": per_example_results,
        "resource_requirements": {
            "weights_mb": round(os.path.getsize(weights_path) / (1024 * 1024), 2),
            "process_rss_mb": _get_process_rss_mb(),
            "cpu_threads": torch.get_num_threads(),
            "cuda_available": torch.cuda.is_available(),
        },
        "composite_score": composite_score,
        "regression_detected": regression_detected,
        "comparison_vs_previous": comparison_vs_previous,
        "experimental_promotion_eligible": experimental_gate_passed,
        "production_primary_eligible": production_primary_eligible,
        "production_gate_reason": (
            "Meets full native generation, coding, tool JSON, neural OCR, and perplexity promotion thresholds."
            if production_primary_eligible
            else (
                f"Remains staged below Gemini production primary router "
                f"(gen_acc={generation_accuracy:.2f}<0.80, unseen_ppl={unseen_ext_ppl:.1f}>25, d_model={cfg.d_model})."
            )
        ),
        "visual_categories": VISUAL_CATEGORIES,
        "evaluated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    eval_path = os.path.join(checkpoint_dir, "evaluation_report.json")
    with open(eval_path, "w", encoding="utf-8") as ef:
        json.dump(result, ef, indent=2)
    return result


V12_EXTENDED_PROBE_CANARIES: List[str] = [
    "gradient clipping prevents exploding gradients",
    "difference between tcp and udp",
    "base case in recursion",
    "अंतरिक्ष में गुरुत्वाकर्षण की भूमिका",
    "ओवरफिटिंग क्या होती है",
    "cpu aur gpu mein kya antar",
    "version control (git) developers",
    "square_diff",
    "sum_evens",
    "firstordefault",
    "countvowels",
    "absdiff",
    "isadult",
    "7*x - 5 = 30",
    "discounted by 25 percent",
    "45 km/h for 2 hours",
    "3 notebooks cost 27 dollars",
    "6 kg block accelerates at 4 m/s^2",
    "12 v battery drives a 3 a current",
    "forward kinematics and inverse kinematics",
    "adding salt to water lower its freezing point",
    "set_room_thermostat",
    "convert_currency",
    "schedule_alarm",
    "search_codebase",
    "compress_archive",
    "calculate_bmr",
]


def evaluate_v12_extended_suite(
    checkpoint_dir: str,
    out_path: Optional[str] = None,
) -> Dict[str, object]:
    """Strict held-out v1.2 benchmark (32 uncontaminated probes: exec Python/JS, exact math, STEM, Hindi/Hinglish, unseen tools)."""
    weights_path = os.path.join(checkpoint_dir, "weights.pt")
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Checkpoint weights not found in {checkpoint_dir}")
    ckpt = torch.load(weights_path, map_location="cpu", weights_only=True)
    cfg = JarvisConfig.from_dict(ckpt["config"])
    tokenizer = JarvisBPE.load(checkpoint_dir)
    model = JarvisUnifiedTransformer(cfg)
    model.load_state_dict(ckpt["model_state_dict"], strict=False)
    model.eval()
    stop_tok_ids = [tokenizer.vocab["</assistant>"]] if "</assistant>" in tokenizer.vocab else None

    def _verify_hindi_deva(g: str, req: Tuple[str, ...]) -> Tuple[bool, str]:
        ok, why = _verify_language_coherence(g, min_words=6, required_any=req)
        if not ok:
            return False, why
        deva_chars = len(re.findall(r"[\u0900-\u097F]", g))
        if deva_chars < 15:
            return False, f"Insufficient Devanagari script ({deva_chars} chars)"
        return True, ""

    def _verify_exact_tool(g: str, tool_name: str, expected_args: Dict[str, object]) -> Tuple[bool, str]:
        obj = _extract_tool_json(g)
        if not isinstance(obj, dict):
            return False, "No valid JSON tool call"
        if obj.get("tool") != tool_name:
            return False, f"Wrong tool: expected {tool_name}, got {obj.get('tool')}"
        args = obj.get("arguments")
        if not isinstance(args, dict):
            return False, "Missing arguments object"
        for k, v in expected_args.items():
            if k not in args:
                return False, f"Missing argument `{k}`"
            got = args[k]
            if isinstance(v, (int, float)):
                try:
                    if abs(float(got) - float(v)) > 1e-4:
                        return False, f"Arg `{k}` mismatch: expected {v}, got {got}"
                except Exception:
                    return False, f"Arg `{k}` non-numeric: {got}"
            else:
                if str(got).strip().lower() != str(v).strip().lower():
                    return False, f"Arg `{k}` mismatch: expected {v}, got {got}"
        return True, ""

    probes: List[Tuple[str, str, str, Callable[[str], Tuple[bool, str]], int]] = [
        # Language & Prose
        ("v12_lang_01", "language_generation", "Why does gradient clipping prevent exploding gradients during neural network training?",
         lambda g: _verify_language_coherence(g, 8, ("gradient", "norm", "step", "scale", "large", "stab", "explod")), 56),
        ("v12_lang_02", "language_generation", "Explain the main difference between TCP and UDP in computer networking.",
         lambda g: _verify_language_coherence(g, 8, ("tcp", "udp", "connect", "reliab", "packet", "order", "fast")), 56),
        ("v12_lang_03", "language_generation", "Why must a recursive function always include a base case?",
         lambda g: _verify_language_coherence(g, 7, ("stop", "terminat", "infinit", "stack", "overflow", "return", "condition")), 56),
        ("v12_lang_04", "language_generation", "Briefly explain why photosynthesis requires sunlight, carbon dioxide, and water.",
         lambda g: _verify_language_coherence(g, 8, ("light", "chlorophyll", "glucose", "sugar", "oxygen", "energy", "plant")), 56),
        # Hindi Devanagari & Hinglish
        ("v12_hin_01", "hindi_devanagari", "अंतरिक्ष में गुरुत्वाकर्षण की भूमिका संक्षेप में समझाएँ।",
         lambda g: _verify_hindi_deva(g, ("ग्रह", "बल", "आकर्ष", "कक्षा", "पृथ्वी", "सूर्य", "पिंड")), 64),
        ("v12_hin_02", "hindi_devanagari", "मशीन लर्निंग में ओवरफिटिंग क्या होती है और इसे कैसे रोकते हैं?",
         lambda g: _verify_hindi_deva(g, ("डेटा", "मॉडल", "ट्रेन", "याद", "नए", "वैलिडेशन", "नियमित", "अधिक")), 64),
        ("v12_hing_01", "hinglish", "Hinglish mein explain karo ki CPU aur GPU mein kya antar hota hai.",
         lambda g: _verify_language_coherence(g, 8, ("core", "parallel", "graphic", "task", "compute", "fast", "matrix")), 64),
        ("v12_hing_02", "hinglish", "Hinglish mein batayein ki version control (Git) developers ke liye kyun zaroori hai.",
         lambda g: _verify_language_coherence(g, 8, ("history", "track", "change", "branch", "team", "code", "commit", "backup")), 64),
        # Coding (Executed / Static Verified)
        ("v12_py_01", "coding_python", "Write a Python function `square_diff(a, b)` that returns a*a - b*b.",
         lambda g: _verify_python_code(g, "square_diff", "assert square_diff(5, 3) == 16 and square_diff(2, 2) == 0"), 56),
        ("v12_py_02", "coding_python", "Write a Python function `clamp(x, lo, hi)` that restricts x between lo and hi inclusive.",
         lambda g: _verify_python_code(g, "clamp", "assert clamp(5, 0, 10) == 5 and clamp(-2, 0, 10) == 0 and clamp(15, 0, 10) == 10"), 56),
        ("v12_py_03", "coding_python", "Write a Python function `sum_evens(nums)` returning the sum of even integers in a list.",
         lambda g: _verify_python_code(g, "sum_evens", "assert sum_evens([1, 2, 3, 4, 6]) == 12 and sum_evens([1, 3]) == 0"), 64),
        ("v12_js_01", "coding_javascript", "Write a JavaScript function `cube(n)` returning n * n * n.",
         lambda g: _verify_javascript_code(g, "cube", "if (cube(3) !== 27 || cube(-2) !== -8) throw new Error('fail');"), 56),
        ("v12_js_02", "coding_javascript", "Write a JavaScript function `firstOrDefault(arr, fallback)` returning arr[0] if arr is non-empty, else fallback.",
         lambda g: _verify_javascript_code(g, "firstOrDefault", "if (firstOrDefault([9, 1], 0) !== 9 || firstOrDefault([], 5) !== 5) throw new Error('fail');"), 64),
        ("v12_js_03", "coding_javascript", "Write a JavaScript function `countVowels(s)` returning the number of vowels in string s.",
         lambda g: _verify_javascript_code(g, "countVowels", "if (countVowels('Hello') !== 2 || countVowels('xyz') !== 0) throw new Error('fail');"), 64),
        ("v12_java_01", "coding_java", "Write a Java static method `absDiff(int a, int b)` returning the absolute difference.",
         lambda g: _verify_java_code(g, "absDiff", ("int", "return")), 64),
        ("v12_java_02", "coding_java", "Write a Java static method `isAdult(int age)` returning true if age >= 18.",
         lambda g: _verify_java_code(g, "isAdult", ("boolean", "18", "return")), 64),
        # Mathematics
        ("v12_math_01", "mathematics", "Solve 7*x - 5 = 30 for x.", lambda g: _verify_numeric(g, 5.0), 56),
        ("v12_math_02", "mathematics", "A jacket costs 80 dollars and is discounted by 25 percent. What is the final price in dollars?", lambda g: _verify_numeric(g, 60.0), 64),
        ("v12_math_03", "multistep_reasoning", "A train travels at 45 km/h for 2 hours and then 60 km/h for 1.5 hours. What is the total distance in km?", lambda g: _verify_numeric(g, 180.0), 72),
        ("v12_math_04", "mathematics", "Calculate 24 * 15 - 60.", lambda g: _verify_numeric(g, 300.0), 56),
        ("v12_math_05", "multistep_reasoning", "If 3 notebooks cost 27 dollars, how much do 7 notebooks cost in dollars?", lambda g: _verify_numeric(g, 63.0), 64),
        ("v12_math_06", "mathematics", "Find the area of a right triangle with base 14 cm and height 9 cm.", lambda g: _verify_numeric(g, 63.0), 64),
        # Science / Engineering / Robotics
        ("v12_stem_01", "engineering_knowledge", "A 6 kg block accelerates at 4 m/s^2. Calculate the net force in newtons.", lambda g: _verify_numeric(g, 24.0), 56),
        ("v12_stem_02", "engineering_knowledge", "A 12 V battery drives a 3 A current through a load. Calculate resistance in ohms.", lambda g: _verify_numeric(g, 4.0), 56),
        ("v12_stem_03", "robotics", "Explain the difference between forward kinematics and inverse kinematics in robotics.",
         lambda g: _verify_language_coherence(g, 8, ("joint", "angle", "end-effector", "position", "pose", "compute")), 64),
        ("v12_stem_04", "science_engineering", "Why does adding salt to water lower its freezing point?",
         lambda g: _verify_language_coherence(g, 8, ("ion", "ice", "crystal", "freezing", "disrupt", "colligative", "melt")), 64),
        # Tool Calling (Unseen tool names + distractors)
        ("v12_tool_01", "tool_argument_validity",
         "Available tools: [set_room_thermostat(room, celsius), toggle_light(room, state)]\nUser request: Set the bedroom thermostat to 22 degrees Celsius.\nReturn strict JSON.",
         lambda g: _verify_exact_tool(g, "set_room_thermostat", {"room": "bedroom", "celsius": 22}), 56),
        ("v12_tool_02", "tool_argument_validity",
         "Available tools: [get_stock_price(ticker), convert_currency(amount, from_currency, to_currency)]\nUser request: Convert 150 USD to INR.\nReturn strict JSON.",
         lambda g: _verify_exact_tool(g, "convert_currency", {"amount": 150, "from_currency": "USD", "to_currency": "INR"}), 56),
        ("v12_tool_03", "tool_argument_validity",
         "Available tools: [schedule_alarm(hour, minute, label), cancel_timer(timer_id)]\nUser request: Set an alarm for 6:30 labeled standup.\nReturn strict JSON.",
         lambda g: _verify_exact_tool(g, "schedule_alarm", {"hour": 6, "minute": 30, "label": "standup"}), 56),
        ("v12_tool_04", "tool_argument_validity",
         "Available tools: [git_commit(message), search_codebase(query, language)]\nUser request: Search python files for compute_torque.\nReturn strict JSON.",
         lambda g: _verify_exact_tool(g, "search_codebase", {"query": "compute_torque", "language": "python"}), 56),
        ("v12_tool_05", "tool_argument_validity",
         "Available tools: [compress_archive(source_dir, format), delete_path(target)]\nUser request: Compress folder logs into zip format.\nReturn strict JSON.",
         lambda g: _verify_exact_tool(g, "compress_archive", {"source_dir": "logs", "format": "zip"}), 56),
        ("v12_tool_06", "tool_argument_validity",
         "Available tools: [log_water(ml), calculate_bmr(weight_kg, height_cm, age_years)]\nUser request: Calculate BMR for weight 70 kg, height 175 cm, age 28.\nReturn strict JSON.",
         lambda g: _verify_exact_tool(g, "calculate_bmr", {"weight_kg": 70, "height_cm": 175, "age_years": 28}), 64),
    ]

    buckets: Dict[str, List[float]] = {}
    results: List[Dict[str, object]] = []
    for pid, dom, pr, ver, mtok in probes:
        p_ids = tokenizer.encode(f"<bos><user>{pr}</user><assistant>")
        with torch.no_grad():
            out_ids = model.generate(
                torch.tensor([p_ids], dtype=torch.long),
                max_new_tokens=mtok,
                temperature=0.01,
                repetition_penalty=1.0,
                no_repeat_ngram_size=4,
                eos_id=tokenizer.eos_id,
                stop_token_ids=stop_tok_ids,
            )
        gen = tokenizer.decode(out_ids[len(p_ids) :], skip_special_tokens=True).strip()
        ok, why = ver(gen)
        buckets.setdefault(dom, []).append(1.0 if ok else 0.0)
        results.append({
            "id": pid,
            "domain": dom,
            "generated": gen,
            "passed": bool(ok),
            "failure_reason": "" if ok else why,
        })

    passed = sum(1 for r in results if r["passed"])
    report = {
        "schema_version": "1.2.0",
        "checkpoint_dir": checkpoint_dir,
        "model_name": cfg.model_name,
        "version": cfg.version,
        "total_probes": len(results),
        "passed_probes": passed,
        "accuracy": round(passed / max(1, len(results)), 4),
        "domain_scores": {k: round(sum(v) / len(v), 4) for k, v in sorted(buckets.items())},
        "results": results,
        "evaluated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    target_out = out_path or os.path.join(checkpoint_dir, "extended_v12_eval.json")
    with open(target_out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    return report
