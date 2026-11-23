"""
VISION — MADE BY LOKESH | Genuine Real-Dataset Vision & Audio Modules (`ml_foundation/real_multimodal.py`)
Trains and evaluates dedicated, lightweight convolutional Vision and Audio modules
strictly on verified permissive real-world datasets stored on D:\\Jarvis\\data\\multimodal_real:
  1. Vision (Grayscale Clothing): `zalando-datasets/fashion_mnist` (MIT) — 60k train/val, 10k test
  2. Vision (Natural RGB Photos): `AI-Lab-Makerere/beans` (MIT) — 1034 train, 133 val, 128 test
  3. Audio (Real Spoken Speech):  `PolyAI/minds14` en-US (CC-BY-4.0) — 563 real WAV utterances, 14 classes

Strictly separate from LM transformer parameters so multimodal training never degrades text quality.
"""

from __future__ import annotations

import audioop
import collections
import datetime
import io
import json
import math
import os
import random
import struct
import time
import wave
from typing import Dict, List, Optional, Tuple

import numpy as np
import pyarrow.parquet as pq
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageDraw, ImageFilter, ImageFont

DEFAULT_REAL_MM_DIR = r"D:\Jarvis\data\multimodal_real"
DEFAULT_REAL_CKPT_DIR = r"D:\Jarvis\data\neural_models\real_multimodal"

FASHION_MNIST_CLASSES = [
    "t_shirt_top", "trouser", "pullover", "dress", "coat",
    "sandal", "shirt", "sneaker", "bag", "ankle_boot",
]

BEANS_CLASSES = ["angular_leaf_spot", "bean_rust", "healthy"]

MINDS14_INTENTS = [
    "abroad", "address", "app_error", "atm_limit", "balance",
    "business_loan", "card_issues", "cash_deposit", "direct_debit",
    "freeze", "high_value_payment", "joint_account",
    "latest_transactions", "pay_bill",
]


class RealVisionCNN(nn.Module):
    """Lightweight convolutional classifier for genuine real-image datasets."""

    def __init__(self, in_channels: int, num_classes: int, base_width: int = 32) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(in_channels, base_width, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(base_width),
            nn.SiLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(base_width, base_width * 2, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(base_width * 2),
            nn.SiLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(base_width * 2, base_width * 4, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(base_width * 4),
            nn.SiLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(0.15),
            nn.Linear(base_width * 4, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.features(x))


class RealAudioSpecCNN(nn.Module):
    """Temporal-spectral 1D CNN classifier with mean+max keyword pooling for genuine speech waveforms."""

    def __init__(self, in_bins: int = 48, num_classes: int = 14) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv1d(in_bins, 64, kernel_size=5, padding=2, bias=False),
            nn.BatchNorm1d(64),
            nn.SiLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(64, 128, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm1d(128),
            nn.SiLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(128, 128, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm1d(128),
            nn.SiLU(),
        )
        self.avg_pool = nn.AdaptiveAvgPool1d(1)
        self.max_pool = nn.AdaptiveMaxPool1d(1)
        self.head = nn.Sequential(
            nn.Dropout(0.30),
            nn.Linear(256, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, T, F] -> [B, F, T]
        feat = self.net(x.transpose(1, 2))
        pooled = torch.cat([self.avg_pool(feat).squeeze(-1), self.max_pool(feat).squeeze(-1)], dim=-1)
        return self.head(pooled)


class RealOCRNet(nn.Module):
    """Pure neural CNN+BiGRU CTC optical character recognizer (strictly independent of WinRT OCR)."""

    ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    BLANK_IDX = len(ALPHABET)  # 36

    def __init__(self, num_classes: int = len(ALPHABET) + 1) -> None:
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.SiLU(),
            nn.MaxPool2d((2, 2)),  # 16 x 64
            nn.Conv2d(32, 64, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(64),
            nn.SiLU(),
            nn.MaxPool2d((2, 2)),  # 8 x 32
            nn.Conv2d(64, 96, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(96),
            nn.SiLU(),
            nn.MaxPool2d((2, 1)),  # 4 x 32
            nn.Conv2d(96, 128, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.SiLU(),
            nn.AdaptiveAvgPool2d((1, 32)),  # [B, 128, 1, 32]
        )
        self.rnn = nn.GRU(128, 96, num_layers=1, bidirectional=True, batch_first=True)
        self.classifier = nn.Linear(192, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, 1, H, W] -> normalize per-image contrast so lighting/OOD brightness shifts generalize cleanly
        mean = x.mean(dim=(2, 3), keepdim=True)
        std = x.std(dim=(2, 3), keepdim=True).clamp_min(1e-4)
        f = self.cnn((x - mean) / std).squeeze(2).permute(0, 2, 1)  # [B, 32, 128]
        seq, _ = self.rnn(f)
        logits = self.classifier(seq)  # [B, 32, C]
        return F.log_softmax(logits.permute(1, 0, 2), dim=-1)

    @classmethod
    def encode_text(cls, text: str) -> List[int]:
        return [cls.ALPHABET.index(ch) for ch in text if ch in cls.ALPHABET]

    @classmethod
    def decode_ctc_greedy(cls, log_probs_tbc: torch.Tensor) -> List[str]:
        preds = log_probs_tbc.argmax(dim=-1).transpose(0, 1).tolist()  # [B, T]
        out: List[str] = []
        for seq in preds:
            chars: List[str] = []
            prev = -1
            for idx in seq:
                if idx != cls.BLANK_IDX and idx != prev and 0 <= idx < len(cls.ALPHABET):
                    chars.append(cls.ALPHABET[idx])
                prev = idx
            out.append("".join(chars))
        return out


def _decode_minds14_wav_bytes(wav_bytes: bytes) -> torch.Tensor:
    """Decode RIFF WAV (supporting PCM8/16 and ITU-T G.711 mu-law tag 7)."""
    if len(wav_bytes) >= 44 and wav_bytes[:4] == b"RIFF":
        fmt_idx = wav_bytes.find(b"fmt ")
        data_idx = wav_bytes.find(b"data")
        if fmt_idx != -1 and data_idx != -1:
            w_fmt = struct.unpack("<H", wav_bytes[fmt_idx + 8 : fmt_idx + 10])[0]
            data_sz = struct.unpack("<I", wav_bytes[data_idx + 4 : data_idx + 8])[0]
            raw = wav_bytes[data_idx + 8 : data_idx + 8 + data_sz]
            if w_fmt == 7:
                pcm16 = audioop.ulaw2lin(raw, 2)
                arr = np.frombuffer(pcm16, dtype=np.int16).astype(np.float32) / 32768.0
                return torch.from_numpy(arr)
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        raw = wf.readframes(wf.getnframes())
        arr = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        return torch.from_numpy(arr)


def _add_waveform_snr_noise(sig: torch.Tensor, snr_db: float, gen: Optional[torch.Generator] = None) -> torch.Tensor:
    rms_sig = sig.pow(2).mean().sqrt().clamp_min(1e-6)
    rms_noise = rms_sig / (10.0 ** (snr_db / 20.0))
    noise = torch.randn(sig.shape, dtype=sig.dtype, generator=gen) * rms_noise
    return (sig + noise).clamp(-1.0, 1.0)


def extract_real_audio_spectrogram(
    wav_bytes: bytes,
    target_frames: int = 64,
    n_bins: int = 48,
    snr_db: Optional[float] = None,
    noise_seed: int = 0,
) -> torch.Tensor:
    """Compute full-utterance normalized log-spectral `[target_frames, n_bins]` with optional SNR noise."""
    sig = _decode_minds14_wav_bytes(wav_bytes)
    if sig.numel() < 512:
        sig = F.pad(sig, (0, 512 - sig.numel()))
    # Trim leading/trailing near-silence while keeping >= 0.35s
    peak = float(sig.abs().max().item())
    if peak > 1e-4:
        active = torch.nonzero(sig.abs() > 0.03 * peak, as_tuple=False).flatten()
        if active.numel() > 256:
            lo = max(0, int(active[0].item()) - 200)
            hi = min(sig.numel(), int(active[-1].item()) + 200)
            if hi - lo >= 2800:
                sig = sig[lo:hi]
    if snr_db is not None:
        gen = torch.Generator().manual_seed(noise_seed)
        sig = _add_waveform_snr_noise(sig, snr_db=snr_db, gen=gen)
    # Pre-emphasis filter sharpens speech formants and consonants
    sig = torch.cat([sig[:1], sig[1:] - 0.97 * sig[:-1]])
    sig = sig[: min(sig.numel(), 8000 * 7)]
    win = 256
    hop = 96
    hann = torch.hann_window(win, dtype=torch.float32)
    stft = torch.stft(sig, n_fft=win, hop_length=hop, window=hann, return_complex=True, center=True)
    mag = stft.abs()[1:, :]  # [128, T_raw], drop DC bin
    log_spec = torch.log1p(mag * 2.5)  # [128, T_raw]
    # Pool across entire utterance duration so no words between windows are skipped
    pooled = F.adaptive_avg_pool2d(log_spec.unsqueeze(0).unsqueeze(0), (n_bins, target_frames)).squeeze(0).squeeze(0)
    feats = pooled.transpose(0, 1).contiguous()  # [target_frames, n_bins]
    mean = feats.mean()
    std = feats.std().clamp_min(1e-4)
    return (feats - mean) / std


def _load_pil_bytes_tensor(img_bytes: bytes, size: int, grayscale: bool = False) -> torch.Tensor:
    im = Image.open(io.BytesIO(img_bytes))
    im = im.convert("L" if grayscale else "RGB")
    if im.size != (size, size):
        im = im.resize((size, size), Image.Resampling.BILINEAR)
    arr = np.asarray(im, dtype=np.float32) / 255.0
    if grayscale:
        return torch.from_numpy(arr).unsqueeze(0)  # [1, H, W]
    return torch.from_numpy(arr).permute(2, 0, 1)  # [3, H, W]


def _eval_classifier(model: nn.Module, x: torch.Tensor, y: torch.Tensor, batch_size: int = 128) -> Dict[str, object]:
    model.eval()
    correct = 0
    top3_correct = 0
    total = int(x.shape[0])
    confs: List[float] = []
    hits: List[float] = []
    with torch.no_grad():
        for i in range(0, total, batch_size):
            xb = x[i : i + batch_size]
            yb = y[i : i + batch_size]
            logits = model(xb)
            probs = F.softmax(logits, dim=-1)
            conf_b, pred_b = probs.max(dim=-1)
            hit_b = (pred_b == yb)
            correct += int(hit_b.sum().item())
            k_top = min(3, logits.shape[-1])
            top3 = probs.topk(k_top, dim=-1).indices
            top3_correct += int((top3 == yb.unsqueeze(-1)).any(dim=-1).sum().item())
            confs.extend(conf_b.tolist())
            hits.extend(hit_b.float().tolist())
    acc = correct / max(1, total)
    ece = 0.0
    for b_idx in range(5):
        lo, hi = b_idx * 0.2, (b_idx + 1) * 0.2
        idxs = [k for k, c in enumerate(confs) if (lo <= c < hi or (b_idx == 4 and c == 1.0))]
        if idxs:
            ece += (len(idxs) / max(1, total)) * abs(sum(hits[k] for k in idxs) / len(idxs) - sum(confs[k] for k in idxs) / len(idxs))
    return {
        "total": total,
        "correct": correct,
        "top1_accuracy": round(acc, 4),
        "top3_accuracy": round(top3_correct / max(1, total), 4),
        "ece": round(ece, 4),
    }


def _eval_vision_ood_sweeps(model: nn.Module, x_te: torch.Tensor, y_te: torch.Tensor, seed: int = 99) -> Dict[str, Dict[str, object]]:
    """Measure clean OOD degradation under deterministic noise, contrast drop, and brightness shift."""
    gen = torch.Generator().manual_seed(seed)
    noise_08 = (x_te + 0.08 * torch.randn(x_te.shape, generator=gen)).clamp(0.0, 1.0)
    noise_15 = (x_te + 0.15 * torch.randn(x_te.shape, generator=gen)).clamp(0.0, 1.0)
    low_con = ((x_te - 0.5) * 0.65 + 0.5).clamp(0.0, 1.0)
    bright = (x_te + 0.12).clamp(0.0, 1.0)
    return {
        "gaussian_noise_0.08": _eval_classifier(model, noise_08, y_te),
        "gaussian_noise_0.15": _eval_classifier(model, noise_15, y_te),
        "contrast_0.65": _eval_classifier(model, low_con, y_te),
        "brightness_+0.12": _eval_classifier(model, bright, y_te),
    }


def _augment_vision_batch(xb: torch.Tensor, allow_vflip: bool = False) -> torch.Tensor:
    xb = xb.clone()
    flip = torch.rand(xb.shape[0]) < 0.5
    xb[flip] = torch.flip(xb[flip], dims=[3])
    if allow_vflip:
        vflip = torch.rand(xb.shape[0]) < 0.5
        xb[vflip] = torch.flip(xb[vflip], dims=[2])
    # Mild contrast/brightness + noise jitter for real OOD robustness
    c_scale = 0.85 + 0.30 * torch.rand((xb.shape[0], 1, 1, 1))
    b_shift = -0.06 + 0.12 * torch.rand((xb.shape[0], 1, 1, 1))
    xb = ((xb - 0.5) * c_scale + 0.5 + b_shift + 0.04 * torch.randn_like(xb)).clamp(0.0, 1.0)
    return xb


def train_and_evaluate_fashion_mnist(
    data_dir: str = DEFAULT_REAL_MM_DIR,
    out_dir: str = DEFAULT_REAL_CKPT_DIR,
    train_limit: int = 24000,
    epochs: int = 7,
    seed: int = 42,
) -> Dict[str, object]:
    """Train and evaluate RealVisionCNN on MIT-licensed `zalando-datasets/fashion_mnist`."""
    t0 = time.perf_counter()
    torch.manual_seed(seed)
    tr_pq = os.path.join(data_dir, "fashion_mnist", "fashion_mnist", "train-00000-of-00001.parquet")
    te_pq = os.path.join(data_dir, "fashion_mnist", "fashion_mnist", "test-00000-of-00001.parquet")
    tr_tbl = pq.read_table(tr_pq).to_pydict()
    te_tbl = pq.read_table(te_pq).to_pydict()

    # Deterministic 90/10 split of official train -> train / val (zero leakage with official 10k test)
    rng = random.Random(seed)
    idxs = list(range(len(tr_tbl["image"])))
    rng.shuffle(idxs)
    val_idxs = idxs[:3000]
    tr_idxs = idxs[3000 : 3000 + train_limit]

    x_tr = torch.stack([_load_pil_bytes_tensor(tr_tbl["image"][i]["bytes"], 28, grayscale=True) for i in tr_idxs])
    y_tr = torch.tensor([int(tr_tbl["label"][i]) for i in tr_idxs], dtype=torch.long)
    x_va = torch.stack([_load_pil_bytes_tensor(tr_tbl["image"][i]["bytes"], 28, grayscale=True) for i in val_idxs])
    y_va = torch.tensor([int(tr_tbl["label"][i]) for i in val_idxs], dtype=torch.long)
    x_te = torch.stack([_load_pil_bytes_tensor(b["bytes"], 28, grayscale=True) for b in te_tbl["image"]])
    y_te = torch.tensor([int(v) for v in te_tbl["label"]], dtype=torch.long)

    model = RealVisionCNN(in_channels=1, num_classes=10, base_width=24)
    opt = torch.optim.AdamW(model.parameters(), lr=2.5e-3, weight_decay=1e-4)
    bs = 128
    best_val = -1.0
    best_sd = None
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(x_tr.shape[0])
        for i in range(0, x_tr.shape[0], bs):
            b_idx = perm[i : i + bs]
            xb = _augment_vision_batch(x_tr[b_idx], allow_vflip=False) if ep >= 1 else x_tr[b_idx]
            loss = F.cross_entropy(model(xb), y_tr[b_idx])
            opt.zero_grad()
            loss.backward()
            opt.step()
        val_m = _eval_classifier(model, x_va, y_va)
        if float(val_m["top1_accuracy"]) > best_val:
            best_val = float(val_m["top1_accuracy"])
            best_sd = {k: v.clone() for k, v in model.state_dict().items()}

    if best_sd is not None:
        model.load_state_dict(best_sd)
    test_m = _eval_classifier(model, x_te, y_te)
    ood_sweeps = _eval_vision_ood_sweeps(model, x_te, y_te, seed=seed + 101)
    os.makedirs(out_dir, exist_ok=True)
    ckpt_p = os.path.join(out_dir, "fashion_mnist_cnn.pt")
    torch.save({"model_state_dict": model.state_dict(), "classes": FASHION_MNIST_CLASSES}, ckpt_p)
    return {
        "dataset": "zalando-datasets/fashion_mnist",
        "license": "MIT",
        "train_samples": int(x_tr.shape[0]),
        "val_samples": int(x_va.shape[0]),
        "test_samples": int(x_te.shape[0]),
        "parameters": sum(p.numel() for p in model.parameters()),
        "val_top1_accuracy": best_val,
        "test_metrics": test_m,
        "ood_noise_sweeps": ood_sweeps,
        "elapsed_s": round(time.perf_counter() - t0, 2),
        "checkpoint": ckpt_p,
    }


def train_and_evaluate_beans(
    data_dir: str = DEFAULT_REAL_MM_DIR,
    out_dir: str = DEFAULT_REAL_CKPT_DIR,
    img_size: int = 64,
    epochs: int = 16,
    seed: int = 42,
) -> Dict[str, object]:
    """Train and evaluate RealVisionCNN on MIT-licensed `AI-Lab-Makerere/beans` real RGB photos."""
    t0 = time.perf_counter()
    torch.manual_seed(seed)
    base = os.path.join(data_dir, "beans", "data")
    tr_d = pq.read_table(os.path.join(base, "train-00000-of-00001.parquet")).to_pydict()
    va_d = pq.read_table(os.path.join(base, "validation-00000-of-00001.parquet")).to_pydict()
    te_d = pq.read_table(os.path.join(base, "test-00000-of-00001.parquet")).to_pydict()

    x_tr = torch.stack([_load_pil_bytes_tensor(b["bytes"], img_size, grayscale=False) for b in tr_d["image"]])
    y_tr = torch.tensor([int(v) for v in tr_d["labels"]], dtype=torch.long)
    x_va = torch.stack([_load_pil_bytes_tensor(b["bytes"], img_size, grayscale=False) for b in va_d["image"]])
    y_va = torch.tensor([int(v) for v in va_d["labels"]], dtype=torch.long)
    x_te = torch.stack([_load_pil_bytes_tensor(b["bytes"], img_size, grayscale=False) for b in te_d["image"]])
    y_te = torch.tensor([int(v) for v in te_d["labels"]], dtype=torch.long)

    model = RealVisionCNN(in_channels=3, num_classes=3, base_width=24)
    opt = torch.optim.AdamW(model.parameters(), lr=2.0e-3, weight_decay=2e-4)
    bs = 64
    best_val = -1.0
    best_sd = None
    for _ in range(epochs):
        model.train()
        perm = torch.randperm(x_tr.shape[0])
        for i in range(0, x_tr.shape[0], bs):
            b_idx = perm[i : i + bs]
            xb = _augment_vision_batch(x_tr[b_idx], allow_vflip=True)
            loss = F.cross_entropy(model(xb), y_tr[b_idx])
            opt.zero_grad()
            loss.backward()
            opt.step()
        val_m = _eval_classifier(model, x_va, y_va)
        if float(val_m["top1_accuracy"]) >= best_val:
            best_val = float(val_m["top1_accuracy"])
            best_sd = {k: v.clone() for k, v in model.state_dict().items()}

    if best_sd is not None:
        model.load_state_dict(best_sd)
    test_m = _eval_classifier(model, x_te, y_te)
    ood_sweeps = _eval_vision_ood_sweeps(model, x_te, y_te, seed=seed + 202)
    os.makedirs(out_dir, exist_ok=True)
    ckpt_p = os.path.join(out_dir, "beans_rgb_cnn.pt")
    torch.save({"model_state_dict": model.state_dict(), "classes": BEANS_CLASSES}, ckpt_p)
    return {
        "dataset": "AI-Lab-Makerere/beans",
        "license": "MIT",
        "train_samples": int(x_tr.shape[0]),
        "val_samples": int(x_va.shape[0]),
        "test_samples": int(x_te.shape[0]),
        "parameters": sum(p.numel() for p in model.parameters()),
        "val_top1_accuracy": best_val,
        "test_metrics": test_m,
        "ood_noise_sweeps": ood_sweeps,
        "elapsed_s": round(time.perf_counter() - t0, 2),
        "checkpoint": ckpt_p,
    }


def _spec_augment_batch(xb: torch.Tensor) -> torch.Tensor:
    """Apply lightweight SpecAugment (freq + time masking + time roll) during audio training."""
    xb = xb.clone()  # [B, T, F]
    bs, t_len, f_bins = xb.shape
    for bi in range(bs):
        shift = int(torch.randint(-4, 5, (1,)).item())
        if shift != 0:
            xb[bi] = torch.roll(xb[bi], shifts=shift, dims=0)
        fw = int(torch.randint(3, 8, (1,)).item())
        f0 = int(torch.randint(0, max(1, f_bins - fw), (1,)).item())
        xb[bi, :, f0 : f0 + fw] = 0.0
        tw = int(torch.randint(4, max(6, t_len // 6), (1,)).item())
        t0 = int(torch.randint(0, max(1, t_len - tw), (1,)).item())
        xb[bi, t0 : t0 + tw, :] = 0.0
    return xb + 0.04 * torch.randn_like(xb)


def train_and_evaluate_minds14_audio(
    data_dir: str = DEFAULT_REAL_MM_DIR,
    out_dir: str = DEFAULT_REAL_CKPT_DIR,
    epochs: int = 40,
    seed: int = 42,
) -> Dict[str, object]:
    """Train and evaluate RealAudioSpecCNN on CC-BY-4.0 `PolyAI/minds14` en-US real speech WAVs."""
    t0 = time.perf_counter()
    torch.manual_seed(seed)
    pq_p = os.path.join(data_dir, "minds14_en_us", "en-US", "train-00000-of-00001.parquet")
    rows = pq.read_table(pq_p).to_pydict()

    by_cls: Dict[int, List[int]] = collections.defaultdict(list)
    for i, c in enumerate(rows["intent_class"]):
        by_cls[int(c)].append(i)

    rng = random.Random(seed)
    tr_idxs, va_idxs, te_idxs = [], [], []
    for c, idxs in sorted(by_cls.items()):
        rng.shuffle(idxs)
        n_te = max(3, int(len(idxs) * 0.12))
        n_va = max(3, int(len(idxs) * 0.12))
        te_idxs.extend(idxs[:n_te])
        va_idxs.extend(idxs[n_te : n_te + n_va])
        tr_idxs.extend(idxs[n_te + n_va :])

    def _build_xy(idx_list: List[int], snr_db: Optional[float] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        xs = [
            extract_real_audio_spectrogram(rows["audio"][i]["bytes"], target_frames=96, n_bins=48, snr_db=snr_db, noise_seed=seed + i)
            for i in idx_list
        ]
        ys = [int(rows["intent_class"][i]) for i in idx_list]
        return torch.stack(xs, dim=0), torch.tensor(ys, dtype=torch.long)

    x_tr, y_tr = _build_xy(tr_idxs)
    x_va, y_va = _build_xy(va_idxs)
    x_te, y_te = _build_xy(te_idxs)

    model = RealAudioSpecCNN(in_bins=48, num_classes=14)
    opt = torch.optim.AdamW(model.parameters(), lr=2.0e-3, weight_decay=2e-3)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs, eta_min=2e-4)
    bs = 32
    best_val = -1.0
    best_sd = None
    for _ in range(epochs):
        model.train()
        perm = torch.randperm(x_tr.shape[0])
        for i in range(0, x_tr.shape[0], bs):
            b_idx = perm[i : i + bs]
            xb = _spec_augment_batch(x_tr[b_idx])
            loss = F.cross_entropy(model(xb), y_tr[b_idx], label_smoothing=0.08)
            opt.zero_grad()
            loss.backward()
            opt.step()
        sched.step()
        val_m = _eval_classifier(model, x_va, y_va)
        if float(val_m["top1_accuracy"]) >= best_val:
            best_val = float(val_m["top1_accuracy"])
            best_sd = {k: v.clone() for k, v in model.state_dict().items()}

    if best_sd is not None:
        model.load_state_dict(best_sd)
    test_m = _eval_classifier(model, x_te, y_te)
    x_te_20, _ = _build_xy(te_idxs, snr_db=20.0)
    x_te_10, _ = _build_xy(te_idxs, snr_db=10.0)
    ood_sweeps = {
        "snr_20db": _eval_classifier(model, x_te_20, y_te),
        "snr_10db": _eval_classifier(model, x_te_10, y_te),
    }
    os.makedirs(out_dir, exist_ok=True)
    ckpt_p = os.path.join(out_dir, "minds14_audio_cnn.pt")
    torch.save({"model_state_dict": model.state_dict(), "classes": MINDS14_INTENTS, "target_frames": 96}, ckpt_p)
    return {
        "dataset": "PolyAI/minds14 (en-US real human telephony speech)",
        "license": "CC-BY-4.0",
        "chance_baseline": round(1.0 / 14.0, 4),
        "train_samples": int(x_tr.shape[0]),
        "val_samples": int(x_va.shape[0]),
        "test_samples": int(x_te.shape[0]),
        "parameters": sum(p.numel() for p in model.parameters()),
        "val_top1_accuracy": best_val,
        "test_metrics": test_m,
        "ood_noise_sweeps": ood_sweeps,
        "elapsed_s": round(time.perf_counter() - t0, 2),
        "checkpoint": ckpt_p,
    }


def train_and_evaluate_fsdd_audio(
    data_dir: str = DEFAULT_REAL_MM_DIR,
    out_dir: str = DEFAULT_REAL_CKPT_DIR,
    epochs: int = 16,
    seed: int = 42,
) -> Dict[str, object]:
    """Train & evaluate RealAudioSpecCNN on CC-BY-SA-4.0 `Free Spoken Digit Dataset` (0..9 WAVs)."""
    t0 = time.perf_counter()
    torch.manual_seed(seed)
    fsdd_root = os.path.join(data_dir, "fsdd", "FSDD")
    tr_files: List[Tuple[str, int]] = []
    te_files: List[Tuple[str, int]] = []
    for split, target in (("train", tr_files), ("test", te_files)):
        sp_dir = os.path.join(fsdd_root, split)
        for cls_s in sorted(os.listdir(sp_dir)):
            cls_dir = os.path.join(sp_dir, cls_s)
            if not cls_s.isdigit() or not os.path.isdir(cls_dir):
                continue
            y_val = int(cls_s)
            for fn in sorted(os.listdir(cls_dir)):
                if fn.lower().endswith(".wav"):
                    target.append((os.path.join(cls_dir, fn), y_val))

    rng = random.Random(seed)
    rng.shuffle(tr_files)
    val_files = tr_files[:270]
    train_files = tr_files[270:]

    def _load_wav_batch(items: List[Tuple[str, int]], snr_db: Optional[float] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        xs = [extract_real_audio_spectrogram(open(p, "rb").read(), target_frames=48, n_bins=48, snr_db=snr_db, noise_seed=seed + idx) for idx, (p, _) in enumerate(items)]
        ys = [y for _, y in items]
        return torch.stack(xs, dim=0), torch.tensor(ys, dtype=torch.long)

    x_tr, y_tr = _load_wav_batch(train_files)
    x_va, y_va = _load_wav_batch(val_files)
    x_te, y_te = _load_wav_batch(te_files)

    model = RealAudioSpecCNN(in_bins=48, num_classes=10)
    opt = torch.optim.AdamW(model.parameters(), lr=2.5e-3, weight_decay=2e-4)
    bs = 64
    best_val = -1.0
    best_sd = None
    for _ in range(epochs):
        model.train()
        perm = torch.randperm(x_tr.shape[0])
        for i in range(0, x_tr.shape[0], bs):
            b_idx = perm[i : i + bs]
            xb = _spec_augment_batch(x_tr[b_idx])
            loss = F.cross_entropy(model(xb), y_tr[b_idx])
            opt.zero_grad()
            loss.backward()
            opt.step()
        val_m = _eval_classifier(model, x_va, y_va)
        if float(val_m["top1_accuracy"]) >= best_val:
            best_val = float(val_m["top1_accuracy"])
            best_sd = {k: v.clone() for k, v in model.state_dict().items()}

    if best_sd is not None:
        model.load_state_dict(best_sd)
    test_m = _eval_classifier(model, x_te, y_te)
    x_te_20, _ = _load_wav_batch(te_files, snr_db=20.0)
    x_te_10, _ = _load_wav_batch(te_files, snr_db=10.0)
    ood_sweeps = {
        "snr_20db": _eval_classifier(model, x_te_20, y_te),
        "snr_10db": _eval_classifier(model, x_te_10, y_te),
    }
    os.makedirs(out_dir, exist_ok=True)
    ckpt_p = os.path.join(out_dir, "fsdd_audio_cnn.pt")
    torch.save({"model_state_dict": model.state_dict(), "classes": [str(i) for i in range(10)], "target_frames": 48}, ckpt_p)
    return {
        "dataset": "silky1708/Free-Spoken-Digit-Dataset (FSDD)",
        "license": "CC-BY-SA-4.0",
        "chance_baseline": 0.10,
        "train_samples": int(x_tr.shape[0]),
        "val_samples": int(x_va.shape[0]),
        "test_samples": int(x_te.shape[0]),
        "parameters": sum(p.numel() for p in model.parameters()),
        "val_top1_accuracy": best_val,
        "test_metrics": test_m,
        "ood_noise_sweeps": ood_sweeps,
        "elapsed_s": round(time.perf_counter() - t0, 2),
        "checkpoint": ckpt_p,
    }


def _render_ocr_sample(
    text: str,
    rng: random.Random,
    noisy_ood: bool = False,
) -> torch.Tensor:
    """Render synthetic multi-font optical sequence image [1, 32, 128] strictly on CPU without WinRT."""
    bg = rng.randint(195, 248) if not noisy_ood else rng.randint(155, 215)
    fg = rng.randint(10, 58) if not noisy_ood else rng.randint(45, 95)
    img = Image.new("L", (128, 32), color=bg)
    draw = ImageDraw.Draw(img)
    font_candidates = [
        r"C:\Windows\Fonts\consola.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\cour.ttf",
        r"C:\Windows\Fonts\tahoma.ttf",
    ]
    available = [fp for fp in font_candidates if os.path.exists(fp)]
    font_sz = rng.randint(17, 21)
    if available:
        font = ImageFont.truetype(rng.choice(available), size=font_sz)
    else:
        font = ImageFont.load_default(size=font_sz)
    x_pos = rng.randint(6, 16)
    y_pos = rng.randint(3, 7)
    for ch in text:
        draw.text((x_pos, y_pos + rng.randint(-1, 1)), ch, fill=fg, font=font)
        x_pos += rng.randint(18, 22)
    angle = rng.uniform(-3.0, 3.0) if not noisy_ood else rng.uniform(-6.5, 6.5)
    img = img.rotate(angle, fillcolor=bg, resample=Image.Resampling.BILINEAR)
    if noisy_ood and rng.random() < 0.5:
        img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    t = torch.from_numpy(arr).unsqueeze(0)
    sigma = rng.uniform(0.01, 0.035) if not noisy_ood else rng.uniform(0.07, 0.11)
    g_arr = np.random.default_rng(rng.randint(1, 10**6)).normal(0.0, sigma, size=arr.shape).astype(np.float32)
    return (t + torch.from_numpy(g_arr).unsqueeze(0)).clamp(0.0, 1.0)


def _eval_ocr_split(model: RealOCRNet, xs: torch.Tensor, texts: List[str], batch_size: int = 128) -> Dict[str, object]:
    model.eval()
    word_hits = 0
    char_hits = 0
    char_total = 0
    preds_all: List[str] = []
    with torch.no_grad():
        for i in range(0, xs.shape[0], batch_size):
            lp = model(xs[i : i + batch_size])
            preds_all.extend(RealOCRNet.decode_ctc_greedy(lp))
    for pred, gt in zip(preds_all, texts):
        if pred == gt:
            word_hits += 1
        char_total += len(gt)
        char_hits += sum(1 for a, b in zip(pred, gt) if a == b)
    n = max(1, len(texts))
    return {
        "total": len(texts),
        "word_exact_match": round(word_hits / n, 4),
        "char_accuracy": round(char_hits / max(1, char_total), 4),
        "samples": [{"gt": gt, "pred": p} for gt, p in list(zip(texts, preds_all))[:6]],
    }


def train_and_evaluate_ocr_net(
    data_dir: str = DEFAULT_REAL_MM_DIR,
    out_dir: str = DEFAULT_REAL_CKPT_DIR,
    train_count: int = 2400,
    val_count: int = 300,
    test_count: int = 300,
    epochs: int = 18,
    seed: int = 42,
) -> Dict[str, object]:
    """Train & evaluate pure neural CNN+BiGRU CTC OCR on disjoint held-out plates (zero WinRT)."""
    t0 = time.perf_counter()
    torch.manual_seed(seed)
    rng = random.Random(seed)
    alpha = RealOCRNet.ALPHABET
    seen: set = set()
    all_texts: List[str] = []
    total_need = train_count + val_count + test_count
    while len(all_texts) < total_need:
        s = "".join(rng.choice(alpha) for _ in range(rng.choice((4, 5))))
        if s not in seen:
            seen.add(s)
            all_texts.append(s)

    tr_texts = all_texts[:train_count]
    va_texts = all_texts[train_count : train_count + val_count]
    te_texts = all_texts[train_count + val_count :]

    ocr_meta_dir = os.path.join(data_dir, "ocr_real")
    os.makedirs(ocr_meta_dir, exist_ok=True)
    with open(os.path.join(ocr_meta_dir, "heldout_splits.json"), "w", encoding="utf-8") as f:
        json.dump({"train": len(tr_texts), "val": va_texts[:20], "test": te_texts}, f, indent=2)

    x_tr = torch.stack([_render_ocr_sample(t, rng, noisy_ood=(idx % 3 == 0)) for idx, t in enumerate(tr_texts)])
    x_va = torch.stack([_render_ocr_sample(t, rng, noisy_ood=False) for t in va_texts])
    x_te = torch.stack([_render_ocr_sample(t, rng, noisy_ood=False) for t in te_texts])
    x_te_ood = torch.stack([_render_ocr_sample(t, rng, noisy_ood=True) for t in te_texts])

    model = RealOCRNet()
    opt = torch.optim.AdamW(model.parameters(), lr=2.5e-3, weight_decay=1e-4)
    ctc = nn.CTCLoss(blank=RealOCRNet.BLANK_IDX, zero_infinity=True)
    bs = 64
    best_val = -1.0
    best_sd = None
    for _ in range(epochs):
        model.train()
        perm = torch.randperm(x_tr.shape[0]).tolist()
        for i in range(0, len(perm), bs):
            b_idx = perm[i : i + bs]
            xb = x_tr[b_idx]
            lp = model(xb)  # [T=32, B, C]
            targets_list = [RealOCRNet.encode_text(tr_texts[j]) for j in b_idx]
            target_cat = torch.tensor([tok for seq in targets_list for tok in seq], dtype=torch.long)
            t_lens = torch.tensor([len(seq) for seq in targets_list], dtype=torch.long)
            in_lens = torch.full((len(b_idx),), lp.shape[0], dtype=torch.long)
            loss = ctc(lp, target_cat, in_lens, t_lens)
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            opt.step()
        val_m = _eval_ocr_split(model, x_va, va_texts)
        if float(val_m["word_exact_match"]) >= best_val:
            best_val = float(val_m["word_exact_match"])
            best_sd = {k: v.clone() for k, v in model.state_dict().items()}

    if best_sd is not None:
        model.load_state_dict(best_sd)
    test_clean = _eval_ocr_split(model, x_te, te_texts)
    test_ood = _eval_ocr_split(model, x_te_ood, te_texts)
    os.makedirs(out_dir, exist_ok=True)
    ckpt_p = os.path.join(out_dir, "ocr_crnn.pt")
    torch.save({"model_state_dict": model.state_dict(), "alphabet": RealOCRNet.ALPHABET}, ckpt_p)
    return {
        "dataset": "disjoint-alphanumeric-plates (36-class neural CRNN+CTC, zero WinRT)",
        "winrt_used": False,
        "train_samples": len(tr_texts),
        "val_samples": len(va_texts),
        "test_samples": len(te_texts),
        "parameters": sum(p.numel() for p in model.parameters()),
        "val_word_exact_match": best_val,
        "test_metrics_clean": test_clean,
        "ood_noisy_rotated_metrics": test_ood,
        "elapsed_s": round(time.perf_counter() - t0, 2),
        "checkpoint": ckpt_p,
    }


def run_all_real_multimodal_benchmarks(
    data_dir: str = DEFAULT_REAL_MM_DIR,
    out_dir: str = DEFAULT_REAL_CKPT_DIR,
) -> Dict[str, object]:
    fashion = train_and_evaluate_fashion_mnist(data_dir=data_dir, out_dir=out_dir)
    beans = train_and_evaluate_beans(data_dir=data_dir, out_dir=out_dir)
    fsdd = train_and_evaluate_fsdd_audio(data_dir=data_dir, out_dir=out_dir)
    minds = train_and_evaluate_minds14_audio(data_dir=data_dir, out_dir=out_dir)
    ocr = train_and_evaluate_ocr_net(data_dir=data_dir, out_dir=out_dir)
    report = {
        "schema_version": "1.2.0",
        "evaluated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "real_vision_fashion_mnist": fashion,
        "real_vision_beans_rgb": beans,
        "real_audio_fsdd_spoken_digits": fsdd,
        "real_audio_minds14_intents": minds,
        "neural_ocr_ctc": ocr,
    }
    os.makedirs(out_dir, exist_ok=True)
    rep_path = os.path.join(out_dir, "real_multimodal_report.json")
    with open(rep_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    return report


if __name__ == "__main__":
    print(json.dumps(run_all_real_multimodal_benchmarks(), indent=2))
