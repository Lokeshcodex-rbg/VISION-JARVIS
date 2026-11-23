"""
VISION — MADE BY LOKESH | Versioned Byte-Level BPE Tokenizer (`ml_foundation/tokenizer.py`)
Trains and executes a deterministic subword BPE vocabulary directly on JARVIS's
curated multimodal engineering, coding, and dialogue corpus.

Formats:
  - v2.0.0 (`pretokenize_mode="byte_bpe_v2"`): Lossless GPT-2 byte-to-unicode bijection over UTF-8,
    explicitly preserving underscores (`_`), code identifiers, JSON, paths, English, Hindi Devanagari
    (\u0900-\u097F), Hinglish, and arbitrary Unicode with 100% exact round-trips.
  - v1.x (`pretokenize_mode="legacy"` / `"gpt2_space"`): Read-only backwards compatibility preserved so
    historical checkpoints (`jarvis-v0.1.0` .. `jarvis-v0.7.0`) load identically.
"""

from __future__ import annotations

from collections import Counter
from functools import lru_cache
import hashlib
import json
import os
import re
from typing import Dict, List, Optional, Tuple


SPECIAL_TOKENS = [
    "<pad>",
    "<bos>",
    "<eos>",
    "<unk>",
    "<sys>",
    "<user>",
    "<assistant>",
    "</assistant>",
    "<thought>",
    "</thought>",
    "<tool>",
    "<obs>",
    "<vision>",
    "</vision>",
    "<audio>",
    "</audio>",
]

SPECIAL_TOKENS_V2 = SPECIAL_TOKENS + [
    "</sys>",
    "</user>",
    "</tool>",
    "<|tool_call|>",
    "<|/tool_call|>",
    "<|tool_result|>",
    "<|/tool_result|>",
]

# Every character is matched: contractions, identifiers w/ underscores, Devanagari words, 1-3 digit runs,
# punctuation/operator clusters, whitespace, plus a final catch-all [\\s\\S] so zero bytes are ever dropped.
_V2_PRETOKENIZE_RE = re.compile(
    r"'s|'t|'re|'ve|'m|'ll|'d"
    r"| ?[A-Za-z_][A-Za-z0-9_]*"
    r"| ?[\u0900-\u097F]+"
    r"| ?[0-9]{1,3}"
    r"| ?[^\sA-Za-z0-9_\u0900-\u097F]+"
    r"|\s+(?!\S)|\s+|[\s\S]",
    re.UNICODE,
)

# v2.1 Math-aware Byte-BPE pretokenizer: splits numbers into individual single digits [0-9]
# so base-10 arithmetic, multi-digit carrying, and equations generalize cleanly.
_V2_MATH_PRETOKENIZE_RE = re.compile(
    r"'s|'t|'re|'ve|'m|'ll|'d"
    r"| ?[A-Za-z_][A-Za-z0-9_]*"
    r"| ?[\u0900-\u097F]+"
    r"|[0-9]"
    r"| ?[^\sA-Za-z0-9_\u0900-\u097F]+"
    r"|\s+(?!\S)|\s+|[\s\S]",
    re.UNICODE,
)


@lru_cache(maxsize=1)
def _bytes_to_unicode() -> Dict[int, str]:
    """Bijective GPT-2 byte-to-unicode table mapping all 256 bytes to distinct printable Unicode chars."""
    bs = (
        list(range(ord("!"), ord("~") + 1))
        + list(range(ord("¡"), ord("¬") + 1))
        + list(range(ord("®"), ord("ÿ") + 1))
    )
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return {b: chr(c) for b, c in zip(bs, cs)}


@lru_cache(maxsize=1)
def _unicode_to_bytes() -> Dict[str, int]:
    return {v: k for k, v in _bytes_to_unicode().items()}


class JarvisBPE:
    """Versioned byte-level + subword BPE tokenizer for VISION (MADE BY LOKESH)."""

    def __init__(self, pretokenize_mode: str = "byte_bpe_v2", format_version: Optional[str] = None) -> None:
        self.pretokenize_mode: str = str(pretokenize_mode or "byte_bpe_v2")
        default_fmt = (
            "2.1.0"
            if self.pretokenize_mode == "byte_bpe_v2_math"
            else ("2.0.0" if self.pretokenize_mode == "byte_bpe_v2" else "1.1.0")
        )
        self.format_version: str = str(format_version or default_fmt)
        self.special_tokens: List[str] = (
            list(SPECIAL_TOKENS_V2)
            if self.pretokenize_mode in ("byte_bpe_v2", "byte_bpe_v2_math")
            else list(SPECIAL_TOKENS)
        )
        self.vocab: Dict[str, int] = {}
        self.id_to_token: Dict[int, str] = {}
        self.merges: List[Tuple[str, str]] = []
        self.bpe_ranks: Dict[Tuple[str, str], int] = {}
        self.vocab_sha256: Optional[str] = None
        self._bpe_cache: Dict[str, List[str]] = {}
        self._init_base_vocab()

    def _init_base_vocab(self) -> None:
        self.vocab = {}
        for tok in self.special_tokens:
            self.vocab[tok] = len(self.vocab)
        for byte_val in range(256):
            sym = self._byte_to_symbol(byte_val)
            if sym not in self.vocab:
                self.vocab[sym] = len(self.vocab)
        self._rebuild_inverse()

    def _byte_to_symbol(self, b: int) -> str:
        if self.pretokenize_mode in ("byte_bpe_v2", "byte_bpe_v2_math"):
            return _bytes_to_unicode()[b]
        # Legacy v1 symbol mapping (<0xNN> fallback) preserved for historical checkpoints
        if 33 <= b <= 126 and b not in (60, 62, 92):
            return chr(b)
        return f"<0x{b:02x}>"

    def _symbol_to_bytes(self, sym: str) -> bytes:
        if self.pretokenize_mode in ("byte_bpe_v2", "byte_bpe_v2_math"):
            u2b = _unicode_to_bytes()
            return bytes(u2b[c] for c in sym if c in u2b)
        if sym.startswith("<0x") and sym.endswith(">") and len(sym) == 6:
            return bytes([int(sym[3:5], 16)])
        return sym.encode("utf-8")

    def _rebuild_inverse(self) -> None:
        self.id_to_token = {idx: tok for tok, idx in self.vocab.items()}
        self.bpe_ranks = {pair: i for i, pair in enumerate(self.merges)}
        self._bpe_cache = {}
        self._special_set = set(self.special_tokens)
        ordered_specials = sorted(self.special_tokens, key=len, reverse=True)
        self._special_regex = re.compile("(" + "|".join(re.escape(s) for s in ordered_specials) + ")") if ordered_specials else None

    @property
    def vocab_size(self) -> int:
        return len(self.vocab)

    @property
    def pad_id(self) -> int:
        return self.vocab["<pad>"]

    @property
    def bos_id(self) -> int:
        return self.vocab["<bos>"]

    @property
    def eos_id(self) -> int:
        return self.vocab["<eos>"]

    @property
    def unk_id(self) -> int:
        return self.vocab["<unk>"]

    def _pretokenize(self, text: str) -> List[str]:
        if self.pretokenize_mode == "byte_bpe_v2_math":
            return _V2_MATH_PRETOKENIZE_RE.findall(text)
        if self.pretokenize_mode == "byte_bpe_v2":
            return _V2_PRETOKENIZE_RE.findall(text)
        if getattr(self, "pretokenize_mode", "legacy") == "gpt2_space":
            # Legacy v0.6/v0.7 regex preserved strictly for loading historical checkpoints
            return re.findall(r" ?[^\W\d_]+| ?\d+| ?[^\s\w]+|\s+", text, re.UNICODE)
        return re.findall(r"\s+|\w+|[^\w\s]", text, re.UNICODE)

    def _word_to_symbols(self, word: str) -> List[str]:
        return [self._byte_to_symbol(b) for b in word.encode("utf-8")]

    def train(self, texts: List[str], target_vocab_size: int = 2048, min_frequency: int = 2) -> Dict[str, object]:
        """Train BPE merge rules from scratch over input texts using incremental pair counts."""
        self._init_base_vocab()
        self.merges = []

        word_freqs: Counter[Tuple[str, ...]] = Counter()
        for doc in texts:
            if not doc:
                continue
            for piece in self._pretokenize(str(doc)):
                syms = tuple(self._word_to_symbols(piece))
                if syms:
                    word_freqs[syms] += 1

        max_merges = max(0, target_vocab_size - len(self.vocab))
        word_list: List[List[object]] = [[list(w), f] for w, f in word_freqs.items()]

        pair_counts: Counter[Tuple[str, str]] = Counter()
        for syms, freq in word_list:
            for i in range(len(syms) - 1):
                pair_counts[(syms[i], syms[i + 1])] += freq  # type: ignore[arg-type]

        special_set = set(self.special_tokens)
        for _ in range(max_merges):
            if not pair_counts:
                break

            best_pair: Optional[Tuple[str, str]] = None
            best_freq = 0
            for cand_pair, cand_freq in pair_counts.most_common():
                if cand_freq < min_frequency:
                    break
                merged_tok = cand_pair[0] + cand_pair[1]
                if merged_tok not in special_set and merged_tok not in self.vocab:
                    best_pair = cand_pair
                    best_freq = cand_freq
                    break

            if best_pair is None or best_freq < min_frequency:
                break

            p0, p1 = best_pair
            merged_tok = p0 + p1
            self.merges.append(best_pair)
            self.vocab[merged_tok] = len(self.vocab)

            for entry in word_list:
                syms = entry[0]  # type: ignore[assignment]
                freq = int(entry[1])  # type: ignore[arg-type]
                n = len(syms)
                if n < 2:
                    continue
                has_pair = any(syms[i] == p0 and syms[i + 1] == p1 for i in range(n - 1))
                if not has_pair:
                    continue

                for i in range(n - 1):
                    old_p = (syms[i], syms[i + 1])
                    pair_counts[old_p] -= freq
                    if pair_counts[old_p] <= 0:
                        del pair_counts[old_p]

                merged_syms: List[str] = []
                i = 0
                while i < n:
                    if i < n - 1 and syms[i] == p0 and syms[i + 1] == p1:
                        merged_syms.append(merged_tok)
                        i += 2
                    else:
                        merged_syms.append(syms[i])
                        i += 1
                entry[0] = merged_syms

                for i in range(len(merged_syms) - 1):
                    pair_counts[(merged_syms[i], merged_syms[i + 1])] += freq

        self._rebuild_inverse()
        self.vocab_sha256 = hashlib.sha256(
            json.dumps({"vocab": self.vocab, "merges": self.merges}, sort_keys=True).encode("utf-8")
        ).hexdigest()

        return {
            "vocab_size": self.vocab_size,
            "special_tokens": len(self.special_tokens),
            "merges_learned": len(self.merges),
            "pretokenize_mode": self.pretokenize_mode,
            "format_version": self.format_version,
            "vocab_sha256": self.vocab_sha256,
        }

    def _bpe_word(self, word: str) -> List[str]:
        cached = self._bpe_cache.get(word)
        if cached is not None:
            return cached
        syms = self._word_to_symbols(word)
        if len(syms) <= 1 or not self.bpe_ranks:
            if len(self._bpe_cache) < 50000:
                self._bpe_cache[word] = syms
            return syms

        while len(syms) > 1:
            pairs = [(syms[i], syms[i + 1]) for i in range(len(syms) - 1)]
            ranked = [(self.bpe_ranks[p], p) for p in pairs if p in self.bpe_ranks]
            if not ranked:
                break
            _, best_pair = min(ranked, key=lambda x: x[0])
            p0, p1 = best_pair
            merged = p0 + p1
            next_syms: List[str] = []
            i = 0
            while i < len(syms):
                if i < len(syms) - 1 and syms[i] == p0 and syms[i + 1] == p1:
                    next_syms.append(merged)
                    i += 2
                else:
                    next_syms.append(syms[i])
                    i += 1
            syms = next_syms
        if len(self._bpe_cache) < 50000:
            self._bpe_cache[word] = syms
        return syms

    def encode(self, text: str, add_bos: bool = False, add_eos: bool = False) -> List[int]:
        ids: List[int] = [self.bos_id] if add_bos else []
        raw_txt = str(text or "")
        segments = self._special_regex.split(raw_txt) if self._special_regex is not None else [raw_txt]
        special_set = self._special_set
        vocab = self.vocab
        unk_id = self.unk_id
        for seg in segments:
            if not seg:
                continue
            if seg in special_set and seg in vocab:
                ids.append(vocab[seg])
            else:
                for piece in self._pretokenize(seg):
                    for tok in self._bpe_word(piece):
                        ids.append(vocab.get(tok, unk_id))
        if add_eos:
            ids.append(self.eos_id)
        return ids

    def decode(self, token_ids: List[int], skip_special_tokens: bool = True) -> str:
        byte_chunks: List[bytes] = []
        text_parts: List[str] = []
        special_set = set(self.special_tokens)

        def flush_bytes() -> None:
            if byte_chunks:
                raw = b"".join(byte_chunks)
                text_parts.append(raw.decode("utf-8", errors="replace"))
                byte_chunks.clear()

        for tid in token_ids:
            tok = self.id_to_token.get(int(tid), "<unk>")
            if tok in special_set:
                flush_bytes()
                if not skip_special_tokens:
                    text_parts.append(tok)
                continue
            if self.pretokenize_mode in ("byte_bpe_v2", "byte_bpe_v2_math"):
                byte_chunks.append(self._symbol_to_bytes(tok))
            else:
                i = 0
                while i < len(tok):
                    if tok.startswith("<0x", i) and len(tok) >= i + 6 and tok[i + 5] == ">":
                        hex_part = tok[i : i + 6]
                        byte_chunks.append(self._symbol_to_bytes(hex_part))
                        i += 6
                    else:
                        byte_chunks.append(tok[i].encode("utf-8"))
                        i += 1
        flush_bytes()
        return "".join(text_parts)

    def verify_roundtrip(self, samples: List[str]) -> Dict[str, object]:
        """Verify 100% lossless round-trip encode->decode across test strings."""
        failures: List[Dict[str, object]] = []
        total_bytes = 0
        total_tokens = 0
        for s in samples:
            ids = self.encode(s, add_bos=False, add_eos=False)
            dec = self.decode(ids, skip_special_tokens=False)
            total_bytes += len(s.encode("utf-8"))
            total_tokens += len(ids)
            if dec != s:
                failures.append({"input": s[:120], "decoded": dec[:120]})
        return {
            "passed": len(failures) == 0,
            "total_samples": len(samples),
            "failed_count": len(failures),
            "bytes_per_token": round(total_bytes / max(1, total_tokens), 3),
            "failures": failures,
        }

    def save(self, directory: str) -> str:
        os.makedirs(directory, exist_ok=True)
        tok_path = os.path.join(directory, "tokenizer.json")
        payload = {
            "type": "JarvisBPE",
            "version": self.format_version,
            "pretokenize_mode": self.pretokenize_mode,
            "special_tokens": self.special_tokens,
            "vocab": self.vocab,
            "merges": [list(m) for m in self.merges],
            "vocab_sha256": self.vocab_sha256,
        }
        with open(tok_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        return tok_path

    @classmethod
    def load(cls, path_or_dir: str) -> "JarvisBPE":
        tok_path = (
            os.path.join(path_or_dir, "tokenizer.json")
            if os.path.isdir(path_or_dir)
            else path_or_dir
        )
        with open(tok_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        mode = str(data.get("pretokenize_mode", "legacy"))
        default_ver = "2.1.0" if mode == "byte_bpe_v2_math" else ("2.0.0" if mode == "byte_bpe_v2" else "1.1.0")
        fmt_ver = str(data.get("version", default_ver))
        inst = cls(pretokenize_mode=mode, format_version=fmt_ver)
        inst.special_tokens = list(data.get("special_tokens", SPECIAL_TOKENS))
        inst.vocab = {str(k): int(v) for k, v in data["vocab"].items()}
        inst.merges = [(str(m[0]), str(m[1])) for m in data.get("merges", [])]
        inst.vocab_sha256 = data.get("vocab_sha256")
        inst._rebuild_inverse()
        return inst
