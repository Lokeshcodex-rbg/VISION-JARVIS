"""
VISION — MADE BY LOKESH | Acoustic Dataset Synthesis & Spectral Feature Extraction (`ml_foundation/audio_data.py`)
Generates genuine 16-bit PCM WAV samples for 6 acoustic classes and computes windowed FFT
spectral feature tensors `[1, T_frames, F_bins]` using pure Python + PyTorch (`torch.fft.rfft`).
"""

from __future__ import annotations

import math
import os
import random
import struct
import wave
from typing import Dict, List

import torch


AUDIO_CATEGORIES: List[str] = [
    "speech_command",
    "wake_word_jarvis",
    "mechanical_hum",
    "alert_tone",
    "ambient_quiet",
    "music_harmonic",
]

AUDIO_DESCRIPTIONS: Dict[str, str] = {
    "speech_command": "Modulated vocal command cadence with mid-band speech formants and syllable envelope.",
    "wake_word_jarvis": "Two-syllable rising-then-falling wake-word contour matching JARVIS vocal signature.",
    "mechanical_hum": "Steady low-frequency rotational motor or fan hum with odd gear-mesh harmonics.",
    "alert_tone": "Pulsed narrowband high-Q warning tone or telemetry alert beacon.",
    "ambient_quiet": "Low-energy room noise floor with negligible narrowband tonal peaks.",
    "music_harmonic": "Sustained polyphonic triad chords and smooth harmonic overtones.",
}


def synthesize_audio_sample(
    category: str,
    seed: int,
    out_path: str,
    sample_rate: int = 8000,
    duration_s: float = 0.8,
) -> str:
    """Synthesizes a deterministic 16-bit mono PCM WAV file for an acoustic category."""
    if category not in AUDIO_CATEGORIES:
        raise ValueError(f"Unknown audio category: {category}")

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    rng = random.Random(seed)
    n_samples = int(sample_rate * duration_s)
    pcm = bytearray()

    # Randomized acoustic parameters within class distribution for real val/test generalization
    f_base = rng.uniform(135.0, 210.0)
    hum_freq = rng.uniform(62.0, 118.0)
    alert_freq = rng.uniform(860.0, 1180.0)
    chord_root = rng.uniform(240.0, 330.0)
    phase_jit = rng.uniform(0.0, math.tau)

    for i in range(n_samples):
        t = i / sample_rate
        noise = rng.uniform(-1.0, 1.0)
        val = 0.0

        if category == "speech_command":
            # 3 syllable amplitude envelope + shifting vocal formants (~520 Hz & ~1480 Hz)
            env = 0.35 + 0.65 * max(0.0, math.sin(2.0 * math.pi * 3.8 * t + phase_jit * 0.2))
            vib = 1.0 + 0.08 * math.sin(2.0 * math.pi * 5.2 * t)
            f0 = f_base * vib
            val = env * (
                0.42 * math.sin(math.tau * f0 * t)
                + 0.32 * math.sin(math.tau * (f0 * 3.1) * t)
                + 0.20 * math.sin(math.tau * 1450.0 * t)
                + 0.06 * noise
            )
        elif category == "wake_word_jarvis":
            # Distinct two-syllable glide: "JAR-" (0.04..0.34s rising) + "-VIS" (0.40..0.74s falling + shimmer)
            if 0.03 <= t <= 0.34:
                u = (t - 0.03) / 0.31
                freq = 175.0 + 105.0 * u
                env = math.sin(math.pi * u)
                val = env * (
                    0.50 * math.sin(math.tau * freq * t)
                    + 0.30 * math.sin(math.tau * (freq * 2.5) * t)
                )
            elif 0.40 <= t <= 0.74:
                u = (t - 0.40) / 0.34
                freq = 260.0 - 95.0 * u
                env = math.sin(math.pi * u)
                val = env * (
                    0.35 * math.sin(math.tau * freq * t)
                    + 0.40 * math.sin(math.tau * 2150.0 * t)
                    + 0.12 * noise
                )
            else:
                val = 0.015 * noise
        elif category == "mechanical_hum":
            ripple = 0.88 + 0.12 * math.sin(math.tau * 6.0 * t)
            val = ripple * (
                0.55 * math.sin(math.tau * hum_freq * t + phase_jit)
                + 0.28 * math.sin(math.tau * (hum_freq * 3.0) * t)
                + 0.14 * math.sin(math.tau * (hum_freq * 5.0) * t)
                + 0.04 * noise
            )
        elif category == "alert_tone":
            # Crisp 5 Hz gated square-burst high-Q dual-tone beacon
            gate = 1.0 if (int(t / 0.10) % 2 == 0) else 0.05
            val = gate * (
                0.52 * math.sin(math.tau * alert_freq * t)
                + 0.38 * math.sin(math.tau * (alert_freq * 2.0) * t)
            )
        elif category == "ambient_quiet":
            val = 0.018 * noise + 0.008 * math.sin(math.tau * 50.0 * t)
        elif category == "music_harmonic":
            # Smooth major triad (1, 5/4, 3/2, 2) with slow swell
            swell = 0.45 + 0.55 * math.sin(math.pi * min(1.0, t / duration_s))
            val = swell * (
                0.35 * math.sin(math.tau * chord_root * t)
                + 0.26 * math.sin(math.tau * (chord_root * 1.25) * t)
                + 0.24 * math.sin(math.tau * (chord_root * 1.50) * t)
                + 0.15 * math.sin(math.tau * (chord_root * 2.00) * t)
            )

        clamped = max(-0.98, min(0.98, val))
        sample_i16 = int(round(clamped * 32767.0))
        pcm.extend(struct.pack("<h", sample_i16))

    with wave.open(out_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(bytes(pcm))

    return out_path


def load_audio_feature_tensor(
    wav_path: str,
    target_frames: int = 16,
    feature_dim: int = 32,
) -> torch.Tensor:
    """Loads a WAV file and extracts a `[1, target_frames, feature_dim]` log-spectral tensor."""
    with wave.open(wav_path, "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if n_frames == 0:
        return torch.zeros((1, target_frames, feature_dim), dtype=torch.float32)

    if sampwidth == 2:
        count = len(raw) // 2
        samples_raw = struct.unpack(f"<{count}h", raw)
        waveform = torch.tensor(samples_raw, dtype=torch.float32) / 32768.0
    elif sampwidth == 1:
        samples_raw = struct.unpack(f"{len(raw)}B", raw)
        waveform = (torch.tensor(samples_raw, dtype=torch.float32) - 128.0) / 128.0
    else:
        raise ValueError(f"Unsupported WAV sample width: {sampwidth} bytes")

    if n_channels > 1:
        waveform = waveform.view(-1, n_channels).mean(dim=1)

    total_len = waveform.numel()
    frame_len = max(feature_dim * 2, total_len // target_frames)
    if total_len < frame_len:
        waveform = torch.nn.functional.pad(waveform, (0, frame_len - total_len))
        total_len = waveform.numel()

    window = torch.hann_window(frame_len, dtype=torch.float32)
    stride = max(1, (total_len - frame_len) // max(1, target_frames - 1))

    spectra: List[torch.Tensor] = []
    for f_idx in range(target_frames):
        start = min(f_idx * stride, total_len - frame_len)
        seg = waveform[start : start + frame_len] * window
        spec = torch.fft.rfft(seg).abs()
        # Exclude DC bin (idx 0) and pool remaining bins evenly into `feature_dim` bands
        ac_spec = spec[1:]
        if ac_spec.numel() < feature_dim:
            ac_spec = torch.nn.functional.pad(ac_spec, (0, feature_dim - ac_spec.numel()))
        # Adaptive average pool to exact feature_dim bins
        pooled = torch.nn.functional.adaptive_avg_pool1d(
            ac_spec.view(1, 1, -1), feature_dim
        ).view(feature_dim)
        # Log1p compression preserves low-energy ambient_quiet separation cleanly
        scaled = torch.log1p(pooled * 0.35)
        spectra.append(scaled)

    features = torch.stack(spectra, dim=0).unsqueeze(0)  # [1, target_frames, feature_dim]
    return features
