"""
VISION — MADE BY LOKESH | Quality-First Curriculum & Pedagogical Corpus Builder
Builds a clean, strictly balanced, low-entropy corpus (`shards_v11_quality`) on D:
from the already-verified permissive sources in `D:\\Jarvis\\data\\corpus_raw`.

Key fixes over v1.0:
  - Excludes noisy commit diffs (`commitpackft`), long Olympiad TeX proofs
    (`NuminaMath-CoT`), and broken Latinized Wikipedia stubs (`wiki_hin_Latn`).
  - Enforces strict length bounds so complete solutions + final answers fit
    inside `block_size=256` without losing the answer to truncation.
  - Enforces strict language purity & balanced quotas across Python, JavaScript,
    Java, and SWE/C/TS/SQL so Python never drowns JS or Java syntax.
  - Normalizes GSM8K `<<...>>` calculator annotations into crisp steps.
  - Compacts Hermes/Glaive tool-calling & strict-JSON tasks into exact
    `Available tools: [...]` + `{"tool": ..., "arguments": {...}}` format.
  - Filters strictly against `EVAL_PROBE_CANARIES` and rejects non-permissive
    or teacher-distilled local logs (`exclude_distilled=True`).
"""

from __future__ import annotations

import argparse
import csv
import datetime
import gzip
import hashlib
import json
import os
import random
import re
from typing import Dict, List, Optional, Tuple

import numpy as np
import pyarrow.parquet as pq

from ml_foundation.corpus_curator import EVAL_PROBE_CANARIES
from ml_foundation.tokenizer import JarvisBPE


def _clean_text(text: str) -> str:
    s = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def _stable_split(key_text: str, train_frac: float = 0.90, val_frac: float = 0.05) -> str:
    h = int(hashlib.blake2b(key_text.encode("utf-8", "ignore"), digest_size=4).hexdigest(), 16) / 0xFFFFFFFF
    if h < train_frac:
        return "train"
    if h < train_frac + val_frac:
        return "val"
    return "test"

DEFAULT_RAW_DIR = r"D:\Jarvis\data\corpus_raw"
DEFAULT_QUALITY_SHARD_DIR = r"D:\Jarvis\data\neural_models\shards_v11_quality"

EXTRA_STOP_NOISE = (
    "malraa",
    "sunaantly",
    "lvmik",
    "samudri ghonghe",
    "find_inventory_projects",
    "find_bot_ris",
    "fart_reail",
)

EXTRA_PROBE_GUARDS = (
    "add_two",
    "is_even",
    "multiplytwo",
    "ispositive",
    "maxoftwo",
    "4*x + 9 = 29",
    "4 kg object moving at 3 m/s",
    "stage_whatsapp_message",
    "open_desktop_app",
    "what planet orbits earth",
    "two 6 ohm resistors are wired in parallel",
    "boiling point of pure water at 1 atmosphere",
)


def _passes_canary_and_noise(text: str) -> bool:
    low = text.lower()
    if any(c in low for c in EVAL_PROBE_CANARIES):
        return False
    if any(c in low for c in EXTRA_PROBE_GUARDS):
        return False
    if any(n in low for n in EXTRA_STOP_NOISE):
        return False
    if "\ufffd" in text:
        return False
    # Reject URL/HTML/citation junk walls
    if low.count("http://") + low.count("https://") > 1:
        return False
    return True


def _devanagari_ratio(text: str) -> float:
    stripped = re.sub(r"[\s0-9.,!?;:\-()\'\"`/\\{}\[\]=+*_<>@#$%^&|~]+", "", text)
    if not stripped:
        return 0.0
    deva = sum(1 for ch in stripped if "\u0900" <= ch <= "\u097f")
    return deva / len(stripped)


def _trim_to_code_fence(text: str) -> str:
    """Keep concise explanation + first complete markdown code block so code fits block_size."""
    m = re.search(r"```[a-zA-Z0-9_+-]*\n[\s\S]*?```", text)
    if m:
        head = text[: m.start()].strip()
        if len(head) > 120:
            head = ""
        block = m.group(0).strip()
        return f"{head}\n\n{block}".strip() if head else block
    return text


def _ascii_alpha_ratio(text: str) -> float:
    if not text:
        return 0.0
    asc = sum(1 for ch in text if "a" <= ch.lower() <= "z" or ch.isdigit() or ch in " .,?!:;+-*/=(){}[]'\"\n_`")
    return asc / len(text)


def _clean_gsm8k_answer(ans: str) -> str:
    # Remove <<48/2=24>> calculator markup cleanly and normalize #### final marker
    cleaned = re.sub(r"<<[^>\n]{1,64}>>", "", ans)
    cleaned = re.sub(r"\n?####\s*", "\nAnswer: ", cleaned)
    return _clean_text(cleaned)


def _is_clean_crisp_sft(prompt: str, resp: str, allow_code: bool = True) -> bool:
    p_low = prompt.lower()
    r_low = resp.lower()
    if not _passes_canary_and_noise(prompt) or not _passes_canary_and_noise(resp):
        return False
    # Reject noisy #eq# asciimath notation from WebInstruct
    if "#" in resp and re.search(r"#[A-Za-z0-9_/*^+=\-\s]{2,40}#", resp):
        return False
    # Reject repeated character runs like Maxyyyyyyy or """"""""
    if re.search(r"(.)\1{7,}", resp):
        return False
    if not allow_code and "```" in resp:
        return False
    # Reject multi-language translation prompts that mix Python/JS/Java
    mentions = sum(1 for kw in ("python", "javascript", "java ") if kw in p_low or re.search(rf"\b{kw.strip()}\b", p_low))
    if mentions > 1:
        return False
    return True


def _detect_code_lang(prompt: str, resp: str) -> str:
    p_low = prompt.lower()
    r_low = resp.lower()
    # Reject cross-language prompts cleanly
    has_py = "python" in p_low or "```python" in r_low
    has_js = "javascript" in p_low or "```javascript" in r_low or "```js" in r_low
    has_java = bool(re.search(r"\bjava\b", p_low)) or "```java\n" in r_low or "```java\r" in r_low
    if int(has_py) + int(has_js) + int(has_java) > 1:
        return "other"
    if has_js and "def " not in resp and "public static void" not in resp and "console.log" not in r_low[:30]:
        if "function " in resp or "=>" in resp or "const " in resp:
            return "javascript"
    if has_java and not has_js and "def " not in resp and "console.log" not in r_low:
        if "public " in resp or "class " in resp or "static " in resp:
            return "java"
    if has_py and "def " in resp and "public static void" not in resp and "function " not in resp:
        return "python"
    if ("```sql" in r_low or re.search(r"\bsql\b", p_low)) and "select " in r_low and "def " not in resp:
        return "sql"
    if ("```c\n" in r_low or "```cpp" in r_low or " c++" in p_low) and ("#include" in resp or "int " in resp) and "def " not in resp:
        return "c_cpp"
    return "other"


def _normalize_tool_call_pair(
    user_q: str,
    call_json_str: str,
    rng: Optional[random.Random] = None,
) -> Optional[Tuple[str, str, str]]:
    """Canonicalize tool-calling examples to strict `[tool(arg)]` prompt + single JSON output."""
    try:
        raw_js = call_json_str.strip()
        # Handle Glaive escaping: {"name": "fn", "arguments": '{"k": "v"}'}
        raw_js = re.sub(r'"arguments"\s*:\s*\'(\{[^\']*\})\'', lambda mm: '"arguments": ' + json.dumps(mm.group(1)), raw_js)
        m = re.search(r"\{[\s\S]*\}", raw_js)
        if not m:
            return None
        obj = json.loads(m.group(0))
        if not isinstance(obj, dict):
            return None
        tname = obj.get("name") or obj.get("tool")
        targs = obj.get("arguments")
        if isinstance(targs, str):
            try:
                targs = json.loads(targs)
            except Exception:
                return None
        if not isinstance(tname, str) or not tname.strip() or not isinstance(targs, dict):
            return None
        tname = tname.strip()
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9_]{2,36}$", tname):
            return None
        if len(targs) > 4:
            return None
        arg_sig = ", ".join(list(targs.keys()))
        uq = _clean_text(user_q).replace("\n", " ").strip()
        if not (8 <= len(uq) <= 200):
            return None
        distractor_tools = [
            "search_knowledge(query)",
            "calculate_metric(expression)",
            "get_system_status()",
            "lookup_record(record_id)",
            "format_report(title)",
            "list_workspace_files(path)",
            "run_diagnostic(module)",
        ]
        dist = [d for d in distractor_tools if not d.startswith(tname + "(")]
        if rng is not None:
            rng.shuffle(dist)
        tool_list = [f"{tname}({arg_sig})"] + dist[: (2 if len(uq) < 120 else 1)]
        if rng is not None:
            rng.shuffle(tool_list)
        elif hash(tname) % 2 == 1 and len(tool_list) >= 2:
            tool_list[0], tool_list[1] = tool_list[1], tool_list[0]
        norm_prompt = f"Available tools: [{', '.join(tool_list)}]. User asks: {uq}"
        norm_resp = json.dumps({"tool": tname, "arguments": targs}, ensure_ascii=False)
        if len(norm_prompt) + len(norm_resp) > 480:
            return None
        return norm_prompt, norm_resp, tname
    except Exception:
        return None


def _collect_quality_pretrain_docs(raw_dir: str, seed: int = 42) -> Tuple[List[Dict[str, str]], Dict[str, int]]:
    """Collect ~1.8-2.2M tokens of low-entropy textbook/educational prose across 4 equal domains."""
    rng = random.Random(seed)
    docs_by_domain: Dict[str, List[Dict[str, str]]] = {
        "language_multilingual": [],
        "mathematics": [],
        "coding_swe": [],
        "science_robotics": [],
    }

    # 1a. English high-quality educational prose (FineWeb-Edu score>=4)
    fw_pq = os.path.join(raw_dir, "HuggingFaceFW__fineweb-edu", "sample", "10BT", "000_00000.parquet")
    if os.path.exists(fw_pq):
        pf = pq.ParquetFile(fw_pq)
        for batch in pf.iter_batches(batch_size=2048, columns=["text", "int_score", "token_count"]):
            d = batch.to_pydict()
            for txt, sc, tc in zip(d["text"], d["int_score"], d["token_count"]):
                if (sc or 0) < 4 or not (180 <= (tc or 0) <= 450):
                    continue
                t = _clean_text(str(txt))
                if not (350 <= len(t) <= 1800) or _ascii_alpha_ratio(t) < 0.94 or not _passes_canary_and_noise(t):
                    continue
                docs_by_domain["language_multilingual"].append({"text": t, "source": "fineweb_edu_4plus", "domain": "language_multilingual"})
                if len(docs_by_domain["language_multilingual"]) >= 900:
                    break
            if len(docs_by_domain["language_multilingual"]) >= 900:
                break

    # 1b. Clean Devanagari Hindi prose ONLY (strictly data-0.parquet, NEVER wiki_hin_Latn)
    hi_pq = os.path.join(raw_dir, "ai4bharat__sangraha", "verified", "hin", "data-0.parquet")
    if os.path.exists(hi_pq):
        pf = pq.ParquetFile(hi_pq)
        hi_docs: List[Dict[str, str]] = []
        for batch in pf.iter_batches(batch_size=2048, columns=["text"]):
            for txt in batch.to_pydict()["text"]:
                t = _clean_text(str(txt))
                if not (180 <= len(t) <= 1200) or _devanagari_ratio(t) < 0.65 or not _passes_canary_and_noise(t):
                    continue
                hi_docs.append({"text": t, "source": "sangraha_hin_deva", "domain": "language_multilingual"})
                if len(hi_docs) >= 380:
                    break
            if len(hi_docs) >= 380:
                break
        docs_by_domain["language_multilingual"].extend(hi_docs)

    # 1c. Clean Apache-2.0 Hinglish blocks
    hg_json = os.path.join(raw_dir, "findnitai__english-to-hinglish", "hinglish_upload_v1.json")
    if os.path.exists(hg_json):
        hg_lines: List[str] = []
        with open(hg_json, encoding="utf-8", errors="ignore") as f:
            for line in f:
                try:
                    obj = json.loads(line).get("translation", {})
                except Exception:
                    continue
                en_s = _clean_text(str(obj.get("en", "")))
                hg_s = _clean_text(str(obj.get("hi_ng", "")))
                if 20 <= len(en_s) <= 180 and 20 <= len(hg_s) <= 180 and _ascii_alpha_ratio(hg_s) > 0.90 and _passes_canary_and_noise(hg_s):
                    hg_lines.append(f"English: {en_s}\nHinglish: {hg_s}")
                if len(hg_lines) >= 900:
                    break
        for i in range(0, len(hg_lines) - 4, 5):
            docs_by_domain["language_multilingual"].append({
                "text": "\n".join(hg_lines[i : i + 5]),
                "source": "findnitai_hinglish",
                "domain": "language_multilingual",
            })

    # 2. Clean readable mathematics (FineMath 4+ short/medium clean explanations + Cosmopedia KhanAcademy)
    fm_pq = os.path.join(raw_dir, "HuggingFaceTB__finemath", "finemath-4plus", "train-00000-of-00064.parquet")
    if os.path.exists(fm_pq):
        pf = pq.ParquetFile(fm_pq)
        for batch in pf.iter_batches(batch_size=2048, columns=["text", "int_score", "token_count"]):
            d = batch.to_pydict()
            for txt, sc, tc in zip(d["text"], d["int_score"], d["token_count"]):
                if (sc or 0) < 4 or not (120 <= (tc or 0) <= 450):
                    continue
                t = _clean_text(str(txt))
                if not (250 <= len(t) <= 1650) or _ascii_alpha_ratio(t) < 0.92 or not _passes_canary_and_noise(t):
                    continue
                if t.count("\\frac") + t.count("\\begin") > 3:
                    continue
                docs_by_domain["mathematics"].append({"text": t, "source": "finemath_4plus", "domain": "mathematics"})
                if len(docs_by_domain["mathematics"]) >= 900:
                    break
            if len(docs_by_domain["mathematics"]) >= 900:
                break

    ka_pq = os.path.join(raw_dir, "HuggingFaceTB__cosmopedia", "data", "khanacademy", "train-00000-of-00001.parquet")
    if os.path.exists(ka_pq):
        pf = pq.ParquetFile(ka_pq)
        for batch in pf.iter_batches(batch_size=1024, columns=["text", "text_token_length"]):
            d = batch.to_pydict()
            for txt, tc in zip(d["text"], d["text_token_length"]):
                if not (140 <= (tc or 0) <= 520):
                    continue
                t = _clean_text(str(txt))
                if not (300 <= len(t) <= 1700) or not _passes_canary_and_noise(t):
                    continue
                docs_by_domain["mathematics"].append({"text": t, "source": "cosmopedia_khanacademy", "domain": "mathematics"})
                if len(docs_by_domain["mathematics"]) >= 1250:
                    break
            if len(docs_by_domain["mathematics"]) >= 1250:
                break

    # 3. Clean Coding & SWE prose/tutorials (clean code explanations across languages)
    code_sources = [
        os.path.join(raw_dir, "m-a-p__CodeFeedback-Filtered-Instruction", "CodeFeedback-Filtered-Instruction.jsonl"),
        os.path.join(raw_dir, "ise-uiuc__Magicoder-Evol-Instruct-110K", "data-evol_instruct-decontaminated.jsonl"),
    ]
    lang_pre_counts = {"python": 0, "javascript": 0, "java": 0, "sql": 0, "c_cpp": 0}
    lang_pre_caps = {"python": 420, "javascript": 320, "java": 240, "sql": 120, "c_cpp": 150}
    for fp in code_sources:
        if not os.path.exists(fp):
            continue
        with open(fp, encoding="utf-8", errors="ignore") as f:
            for line in f:
                if sum(lang_pre_counts.values()) >= sum(lang_pre_caps.values()):
                    break
                if len(line) > 2200:
                    continue
                try:
                    row = json.loads(line)
                except Exception:
                    continue
                if "messages" in row:
                    msgs = row["messages"]
                    u = next((m["content"] for m in msgs if m.get("role") == "user"), "")
                    a = next((m["content"] for m in msgs if m.get("role") == "assistant"), "")
                else:
                    u = str(row.get("instruction", ""))
                    a = str(row.get("response", ""))
                u, a = _clean_text(u), _clean_text(a)
                if not (25 <= len(u) <= 280 and 60 <= len(a) <= 950):
                    continue
                if not (_passes_canary_and_noise(u) and _passes_canary_and_noise(a)):
                    continue
                cl = _detect_code_lang(u, a)
                if cl not in lang_pre_caps or lang_pre_counts[cl] >= lang_pre_caps[cl]:
                    continue
                lang_pre_counts[cl] += 1
                docs_by_domain["coding_swe"].append({
                    "text": f"Task: {u}\nSolution:\n{a}",
                    "source": f"code_pretrain_{cl}",
                    "domain": "coding_swe",
                })

    # 4. Clean Science, Physics, Electronics, Robotics (OpenStax + Stanford STEM keywords)
    ox_pq = os.path.join(raw_dir, "HuggingFaceTB__cosmopedia", "data", "openstax", "train-00000-of-00002.parquet")
    if os.path.exists(ox_pq):
        pf = pq.ParquetFile(ox_pq)
        for batch in pf.iter_batches(batch_size=1024, columns=["text", "text_token_length"]):
            d = batch.to_pydict()
            for txt, tc in zip(d["text"], d["text_token_length"]):
                if not (160 <= (tc or 0) <= 520):
                    continue
                t = _clean_text(str(txt))
                if not (350 <= len(t) <= 1750) or not _passes_canary_and_noise(t):
                    continue
                docs_by_domain["science_robotics"].append({"text": t, "source": "cosmopedia_openstax", "domain": "science_robotics"})
                if len(docs_by_domain["science_robotics"]) >= 1250:
                    break
            if len(docs_by_domain["science_robotics"]) >= 1250:
                break

    # Equalize domain counts & interleave cleanly
    min_d = min(len(v) for v in docs_by_domain.values() if v)
    cap = min(1250, max(600, min_d))
    combined: List[Dict[str, str]] = []
    domain_stats: Dict[str, int] = {}
    for dom, items in docs_by_domain.items():
        rng.shuffle(items)
        sel = items[:cap]
        domain_stats[dom] = len(sel)
        combined.extend(sel)
    rng.shuffle(combined)
    return combined, domain_stats


def _collect_quality_sft_rows(raw_dir: str, seed: int = 42) -> Tuple[List[Dict[str, str]], Dict[str, int]]:
    """Collect ~8k-11k crisp, short/medium SFT pairs (<=240 tokens) balanced across all domains."""
    rng = random.Random(seed + 7)
    buckets: Dict[str, List[Dict[str, str]]] = {
        "english_general_swe": [],
        "hindi_devanagari": [],
        "hinglish": [],
        "math_gsm8k_orca": [],
        "coding_python": [],
        "coding_js": [],
        "coding_java": [],
        "coding_other": [],
        "science_engineering_robotics": [],
        "tool_calling_json": [],
    }

    tool_name_counts: Dict[str, int] = {}

    def _add(bucket: str, inst: str, resp: str, source: str, limit: int) -> bool:
        if len(buckets[bucket]) >= limit:
            return False
        inst = _clean_text(inst)
        resp = _clean_text(resp)
        if not (12 <= len(inst) <= 320 and 4 <= len(resp) <= 580):
            return False
        if not _is_clean_crisp_sft(inst, resp, allow_code=bucket.startswith("coding_")):
            return False
        if bucket == "coding_java" and "public class Main" in resp and sum(1 for x in buckets["coding_java"] if "public class Main" in x["response"]) >= 45:
            return False
        buckets[bucket].append({"instruction": inst, "response": resp, "source": source, "domain": bucket})
        return True

    # A. Hindi Devanagari (CognitiveLab + smangrul nested data/*.parquet with strict Devanagari ratio)
    hi_cog = os.path.join(raw_dir, "CognitiveLab__Hindi-Instruct-Gemma-Prompt-formate", "data", "train-00000-of-00004.parquet")
    if os.path.exists(hi_cog):
        pf = pq.ParquetFile(hi_cog)
        for batch in pf.iter_batches(batch_size=1024, columns=["messages"]):
            for msgs in batch.to_pydict()["messages"]:
                if not isinstance(msgs, list) or len(msgs) < 2:
                    continue
                u = next((m.get("content", "") for m in msgs if m.get("role") == "user"), "")
                a = next((m.get("content", "") for m in msgs if m.get("role") == "assistant"), "")
                if _devanagari_ratio(str(a)) >= 0.50 and len(str(a)) <= 460:
                    _add("hindi_devanagari", str(u), str(a), "cognitivelab_hindi", 700)

    hi_sm = os.path.join(raw_dir, "smangrul__hindi_instruct_v1", "data", "train-00000-of-00001.parquet")
    if os.path.exists(hi_sm):
        pf = pq.ParquetFile(hi_sm)
        for batch in pf.iter_batches(batch_size=1024, columns=["messages"]):
            for msgs in batch.to_pydict()["messages"]:
                if not isinstance(msgs, list):
                    continue
                u = next((m.get("content", "") for m in msgs if m.get("role") == "user"), "")
                a = next((m.get("content", "") for m in msgs if m.get("role") == "assistant"), "")
                if _devanagari_ratio(str(a)) >= 0.50 and len(str(a)) <= 460:
                    _add("hindi_devanagari", str(u), str(a), "smangrul_hindi", 1250)

    # B. Hinglish clean conversational & technical Q&A (damerajee + findnitai/english-to-hinglish Apache-2.0)
    hg_csv = os.path.join(raw_dir, "damerajee__small-hindi-instruct", "reasoning34.csv")
    if os.path.exists(hg_csv):
        with open(hg_csv, encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                q = str(row.get("Question", "")).strip()
                a = str(row.get("Answer", "")).strip()
                if q and a and _ascii_alpha_ratio(a) > 0.88 and len(a) <= 400:
                    _add("hinglish", f"Hinglish mein batayein: {q}", a, "damerajee_hinglish", 100)

    hg_json = os.path.join(raw_dir, "findnitai__english-to-hinglish", "hinglish_upload_v1.json")
    if os.path.exists(hg_json):
        with open(hg_json, encoding="utf-8", errors="ignore") as f:
            for line in f:
                if len(buckets["hinglish"]) >= 950:
                    break
                try:
                    obj = json.loads(line).get("translation", {})
                except Exception:
                    continue
                en_s = str(obj.get("en", "")).strip()
                hg_s = str(obj.get("hi_ng", "")).strip()
                if 20 <= len(en_s) <= 220 and 20 <= len(hg_s) <= 240 and _ascii_alpha_ratio(hg_s) > 0.88:
                    _add("hinglish", f"Hinglish mein likhein: {en_s}", hg_s, "findnitai_hinglish", 950)

    # C. Math & quantitative reasoning (GSM8K train + Orca-Math short crisp solutions)
    gsm_pq = os.path.join(raw_dir, "openai__gsm8k", "main", "train-00000-of-00001.parquet")
    if not os.path.exists(gsm_pq):
        for root_p, _, fns in os.walk(os.path.join(raw_dir, "openai__gsm8k")):
            for fn in fns:
                if "train" in fn and fn.endswith(".parquet"):
                    gsm_pq = os.path.join(root_p, fn)
                    break
    if os.path.exists(gsm_pq):
        pf = pq.ParquetFile(gsm_pq)
        for batch in pf.iter_batches(batch_size=1024, columns=["question", "answer"]):
            d = batch.to_pydict()
            for q, a in zip(d["question"], d["answer"]):
                _add("math_gsm8k_orca", q, _clean_gsm8k_answer(str(a)), "openai_gsm8k_train", 1200)

    orca_pq = os.path.join(raw_dir, "microsoft__orca-math-word-problems-200k", "data", "train-00000-of-00001.parquet")
    if not os.path.exists(orca_pq):
        for root_p, _, fns in os.walk(os.path.join(raw_dir, "microsoft__orca-math-word-problems-200k")):
            for fn in fns:
                if "train" in fn and fn.endswith(".parquet"):
                    orca_pq = os.path.join(root_p, fn)
                    break
    if os.path.exists(orca_pq):
        pf = pq.ParquetFile(orca_pq)
        for batch in pf.iter_batches(batch_size=2048, columns=["question", "answer"]):
            d = batch.to_pydict()
            for q, a in zip(d["question"], d["answer"]):
                if len(str(q)) <= 260 and len(str(a)) <= 460:
                    _add("math_gsm8k_orca", str(q), str(a), "orca_math", 2200)
            if len(buckets["math_gsm8k_orca"]) >= 2200:
                break

    # D. Language-balanced clean coding (Python <=950, JS >=750, Java >=450, SQL/C++ >=350)
    code_files = [
        os.path.join(raw_dir, "m-a-p__CodeFeedback-Filtered-Instruction", "CodeFeedback-Filtered-Instruction.jsonl"),
        os.path.join(raw_dir, "ise-uiuc__Magicoder-Evol-Instruct-110K", "data-evol_instruct-decontaminated.jsonl"),
        os.path.join(raw_dir, "ise-uiuc__Magicoder-OSS-Instruct-75K", "data-oss_instruct-decontaminated.jsonl"),
    ]
    for fp in code_files:
        if not os.path.exists(fp):
            continue
        src_tag = os.path.basename(os.path.dirname(fp))[:22]
        with open(fp, encoding="utf-8", errors="ignore") as f:
            for line in f:
                if (
                    len(buckets["coding_python"]) >= 950
                    and len(buckets["coding_js"]) >= 750
                    and len(buckets["coding_java"]) >= 450
                    and len(buckets["coding_other"]) >= 350
                ):
                    break
                if len(line) > 3500:
                    continue
                try:
                    row = json.loads(line)
                except Exception:
                    continue
                if "messages" in row:
                    msgs = row["messages"]
                    u = next((m["content"] for m in msgs if m.get("role") == "user"), "")
                    a = next((m["content"] for m in msgs if m.get("role") == "assistant"), "")
                else:
                    u = str(row.get("instruction", ""))
                    a = str(row.get("response", ""))
                cl = _detect_code_lang(u, a)
                a_clean = _trim_to_code_fence(a) if cl in ("javascript", "java", "python", "c_cpp", "sql") else a
                if cl == "python":
                    m_py = re.search(r"def\s+([a-z_][a-z0-9_]{2,28})\(([^)\n]{0,36})\)\s*:", a_clean)
                    if m_py and len(u) < 200 and len(buckets["coding_python"]) % 2 == 0:
                        u = f"Write a Python function {m_py.group(1)}({m_py.group(2).strip()}). {u}"
                    _add("coding_python", u, a_clean, src_tag, 950)
                elif cl == "javascript":
                    m_js = re.search(r"function\s+([a-zA-Z_][a-zA-Z0-9_]{2,28})\(([^)\n]{0,36})\)", a_clean)
                    if m_js and len(u) < 200 and len(buckets["coding_js"]) % 2 == 0:
                        u = f"Write a JavaScript function {m_js.group(1)}({m_js.group(2).strip()}). {u}"
                    _add("coding_js", u, a_clean, src_tag, 750)
                elif cl == "java":
                    m_jv = re.search(r"static\s+[a-zA-Z_<>\[\]]+\s+([a-zA-Z_][a-zA-Z0-9_]{2,28})\(([^)\n]{0,44})\)", a_clean)
                    if m_jv and len(u) < 200 and len(buckets["coding_java"]) % 2 == 0:
                        u = f"Write a Java static method {m_jv.group(1)}({m_jv.group(2).strip()}). {u}"
                    _add("coding_java", u, a_clean, src_tag, 450)
                elif cl in ("sql", "c_cpp"):
                    _add("coding_other", u, a_clean, src_tag, 350)

    self_pq = os.path.join(raw_dir, "bigcode__self-oss-instruct-sc2-exec-filter-50k", "data", "train-00000-of-00001.parquet")
    if os.path.exists(self_pq):
        pf = pq.ParquetFile(self_pq)
        for batch in pf.iter_batches(batch_size=1024, columns=["instruction", "response"]):
            d = batch.to_pydict()
            for u, a in zip(d["instruction"], d["response"]):
                cl = _detect_code_lang(str(u), str(a))
                a_clean = _trim_to_code_fence(str(a))
                if cl == "javascript":
                    _add("coding_js", str(u), a_clean, "self_oss_js", 850)
                elif cl == "java":
                    _add("coding_java", str(u), a_clean, "self_oss_java", 550)

    # E. Science, Engineering, Robotics, & General Knowledge from MMLU + WebInstructSub + OASST2
    mmlu_pq = None
    for root_p, _, fns in os.walk(os.path.join(raw_dir, "cais__mmlu")):
        for fn in fns:
            if fn.endswith(".parquet"):
                mmlu_pq = os.path.join(root_p, fn)
                break
    if mmlu_pq and os.path.exists(mmlu_pq):
        pf = pq.ParquetFile(mmlu_pq)
        for batch in pf.iter_batches(batch_size=1024, columns=["question", "choices", "answer", "subject"]):
            d = batch.to_pydict()
            for q, chs, ans_idx, subj in zip(d["question"], d["choices"], d["answer"], d["subject"]):
                if not isinstance(chs, list) or not (0 <= int(ans_idx) < len(chs)):
                    continue
                q_s = _clean_text(str(q))
                ans_s = _clean_text(str(chs[int(ans_idx)]))
                if not (20 <= len(q_s) <= 260 and 1 <= len(ans_s) <= 120):
                    continue
                low_q = (q_s + " " + str(subj)).lower()
                if any(k in low_q for k in ("physics", "circuit", "resistor", "ohm", "torque", "robot", "voltage", "current", "motor", "control", "kinematic", "thermodynamic", "energy", "engineering", "computer", "algorithm", "stack", "queue")):
                    _add("science_engineering_robotics", q_s, ans_s, "mmlu_stem", 900)
                else:
                    _add("english_general_swe", q_s, ans_s, "mmlu_gk", 700)
            if len(buckets["science_engineering_robotics"]) >= 900 and len(buckets["english_general_swe"]) >= 700:
                break

    wi_pq = os.path.join(raw_dir, "TIGER-Lab__WebInstructSub", "train.parquet")
    if not os.path.exists(wi_pq):
        for root_p, _, fns in os.walk(os.path.join(raw_dir, "TIGER-Lab__WebInstructSub")):
            for fn in fns:
                if fn.endswith(".parquet"):
                    wi_pq = os.path.join(root_p, fn)
                    break
    if os.path.exists(wi_pq):
        pf = pq.ParquetFile(wi_pq)
        for batch in pf.iter_batches(batch_size=2048, columns=["question", "answer"]):
            d = batch.to_pydict()
            for q, a in zip(d["question"], d["answer"]):
                qs, ans_s = str(q), str(a)
                if len(qs) > 260 or len(ans_s) > 460:
                    continue
                ql = qs.lower()
                if any(k in ql for k in ("ohm", "resistor", "circuit", "volt", "torque", "pid", "robot", "actuator", "kinemat", "watt", "joule", "physics", "velocity", "acceleration", "sensor")):
                    _add("science_engineering_robotics", qs, ans_s, "webinstruct_stem", 1700)
                elif any(k in ql for k in ("refactor", "regression test", "unit test", "software", "fifo", "lifo", "stack", "queue", "api", "git")):
                    _add("english_general_swe", qs, ans_s, "webinstruct_swe", 1150)
            if len(buckets["science_engineering_robotics"]) >= 1700:
                break

    oa_gz = os.path.join(raw_dir, "OpenAssistant__oasst2", "2023-11-05_oasst2_ready.trees.jsonl.gz")
    if os.path.exists(oa_gz):
        with gzip.open(oa_gz, "rt", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if len(buckets["english_general_swe"]) >= 1800:
                    break
                try:
                    tree = json.loads(line)
                    root = tree.get("prompt", {})
                    if root.get("lang") != "en":
                        continue
                    reps = root.get("replies", [])
                    if not reps:
                        continue
                    best_rep = reps[0]
                    if best_rep.get("lang") != "en":
                        continue
                    _add("english_general_swe", str(root.get("text", "")), str(best_rep.get("text", "")), "oasst2_en", 1800)
                except Exception:
                    continue

    # F. Tool calling + Strict JSON formatting (Hermes + Glaive directly parsed & normalized, per-tool capped <=4)
    hermes_fc = os.path.join(raw_dir, "NousResearch__hermes-function-calling-v1", "func-calling-singleturn.json")
    if os.path.exists(hermes_fc):
        try:
            data = json.load(open(hermes_fc, encoding="utf-8", errors="ignore"))
            for row in data:
                if len(buckets["tool_calling_json"]) >= 650:
                    break
                convs = row.get("conversations", [])
                uq = next((c.get("value", "") for c in convs if c.get("from") == "human"), "")
                gpt = next((c.get("value", "") for c in convs if c.get("from") == "gpt"), "")
                m_call = re.search(r"<tool_call>\s*(\{[\s\S]*?\})\s*</tool_call>", gpt)
                if m_call:
                    norm = _normalize_tool_call_pair(uq, m_call.group(1), rng=rng)
                    if norm and tool_name_counts.get(norm[2], 0) < 4:
                        if _add("tool_calling_json", norm[0], norm[1], "hermes_fc_norm", 650):
                            tool_name_counts[norm[2]] = tool_name_counts.get(norm[2], 0) + 1
        except Exception:
            pass

    hermes_jm = os.path.join(raw_dir, "NousResearch__hermes-function-calling-v1", "json-mode-singleturn.json")
    if os.path.exists(hermes_jm):
        try:
            data = json.load(open(hermes_jm, encoding="utf-8", errors="ignore"))
            for row in data:
                if len(buckets["tool_calling_json"]) >= 1050:
                    break
                convs = row.get("conversations", [])
                u = next((c.get("value", "") for c in convs if c.get("from") == "human"), "")
                a = next((c.get("value", "") for c in convs if c.get("from") == "gpt"), "")
                try:
                    obj = json.loads(a)
                except Exception:
                    continue
                if isinstance(obj, dict) and 1 <= len(obj) <= 4 and len(u) <= 220:
                    keys_s = ", ".join(list(obj.keys()))
                    inst = f"Reply strictly in valid JSON with keys ({keys_s}): {u}"
                    _add("tool_calling_json", inst, json.dumps(obj, ensure_ascii=False), "hermes_json_norm", 1050)
        except Exception:
            pass

    glaive_p = os.path.join(raw_dir, "glaiveai__glaive-function-calling-v2", "glaive-function-calling-v2.json")
    if os.path.exists(glaive_p):
        try:
            data = json.load(open(glaive_p, encoding="utf-8", errors="ignore"))
            for row in data:
                if len(buckets["tool_calling_json"]) >= 1750:
                    break
                chat = str(row.get("chat", ""))
                m = re.search(r"USER:\s*(.*?)\n+\s*ASSISTANT:\s*<functioncall>\s*(\{[^\n<]+\})", chat, re.DOTALL)
                if not m:
                    continue
                norm = _normalize_tool_call_pair(m.group(1), m.group(2), rng=rng)
                if norm and tool_name_counts.get(norm[2], 0) < 4:
                    if _add("tool_calling_json", norm[0], norm[1], "glaive_fc_norm", 1750):
                        tool_name_counts[norm[2]] = tool_name_counts.get(norm[2], 0) + 1
        except Exception:
            pass

    # Merge, deduplicate by normalized prompt, and sort reproducibly
    seen = set()
    rows: List[Dict[str, str]] = []
    bucket_counts: Dict[str, int] = {}
    for bname, items in buckets.items():
        rng.shuffle(items)
        kept = 0
        for it in items:
            key = hashlib.sha1(it["instruction"].lower().encode("utf-8")).hexdigest()
            if key in seen:
                continue
            seen.add(key)
            rows.append(it)
            kept += 1
        bucket_counts[bname] = kept
    rng.shuffle(rows)
    return rows, bucket_counts


def build_quality_shards(
    raw_dir: str = DEFAULT_RAW_DIR,
    shard_dir: str = DEFAULT_QUALITY_SHARD_DIR,
    vocab_size: int = 4096,
    block_size: int = 256,
    seed: int = 42,
) -> Dict[str, object]:
    os.makedirs(shard_dir, exist_ok=True)
    pre_docs, pre_stats = _collect_quality_pretrain_docs(raw_dir, seed=seed)
    sft_rows, sft_stats = _collect_quality_sft_rows(raw_dir, seed=seed)

    # Split SFT strictly by deterministic hash (90% train / 5% val / 5% test)
    sft_train: List[Dict[str, str]] = []
    sft_val: List[Dict[str, str]] = []
    sft_test: List[Dict[str, str]] = []
    for r in sft_rows:
        sp = _stable_split(r["instruction"] + "\n" + r["response"], train_frac=0.90, val_frac=0.05)
        if sp == "train":
            sft_train.append(r)
        elif sp == "val":
            sft_val.append(r)
        else:
            sft_test.append(r)

    pre_train = [d for d in pre_docs if _stable_split(d["text"][:160], train_frac=0.94, val_frac=0.03) == "train"]
    pre_val = [d for d in pre_docs if _stable_split(d["text"][:160], train_frac=0.94, val_frac=0.03) == "val"]

    # Train compact vocab=4096 byte_bpe_v2 tokenizer on a balanced 3,200-doc sample (or reuse existing)
    tok_json = os.path.join(shard_dir, "tokenizer.json")
    rng_tok = random.Random(seed)
    pre_sample = list(pre_train)
    sft_sample = [f"{r['instruction']}\n{r['response']}" for r in sft_train]
    rng_tok.shuffle(pre_sample)
    rng_tok.shuffle(sft_sample)
    tok_corpus = [d["text"] for d in pre_sample[:1300]] + sft_sample[:2200]
    tok = JarvisBPE(pretokenize_mode="byte_bpe_v2")
    tok_stats = tok.train(tok_corpus, target_vocab_size=vocab_size, min_frequency=3)
    tok.save(shard_dir)

    # Encode Stage 1 Pretrain (`pretrain_tokens.bin`) and Stage 2 Domain Pretrain (`stage2_domain_tokens.bin`)
    pre_tr_ids: List[int] = []
    raw_chars_total = 0
    for d in pre_train:
        raw_chars_total += len(d["text"])
        pre_tr_ids.extend(tok.encode(d["text"], add_bos=True, add_eos=True))
    pre_val_ids: List[int] = []
    for d in pre_val:
        pre_val_ids.extend(tok.encode(d["text"], add_bos=True, add_eos=True))

    pre_bin = os.path.join(shard_dir, "pretrain_tokens.bin")
    np.asarray(pre_tr_ids, dtype=np.uint32).tofile(pre_bin)
    np.asarray(pre_val_ids, dtype=np.uint32).tofile(os.path.join(shard_dir, "pretrain_val.bin"))
    with open(pre_bin, "rb") as bf:
        pre_sha = hashlib.sha256(bf.read()).hexdigest()
    with open(os.path.join(shard_dir, "pretrain_meta.json"), "w", encoding="utf-8") as f:
        json.dump({
            "prefix": "pretrain",
            "dtype": "uint32",
            "vocab_size": tok.vocab_size,
            "total_tokens": len(pre_tr_ids),
            "val_tokens": len(pre_val_ids),
            "doc_count": len(pre_train),
            "raw_chars_total": raw_chars_total,
            "bytes_per_token": round(raw_chars_total / max(1, len(pre_tr_ids)), 3),
            "bin_path": pre_bin,
            "sha256": pre_sha,
            "domain_docs": pre_stats,
        }, f, indent=2)

    # Stage 2 domain shard emphasizes technical math, coding, STEM, and clean Hindi/Hinglish
    dom_docs = [d for d in pre_train if d["domain"] in ("mathematics", "coding_swe", "science_robotics")] + [
        d for d in pre_train if d["domain"] == "language_multilingual"
    ][: max(200, len(pre_train) // 5)]
    dom_ids: List[int] = []
    dom_chars = 0
    for d in dom_docs:
        dom_chars += len(d["text"])
        dom_ids.extend(tok.encode(d["text"], add_bos=True, add_eos=True))
    dom_bin = os.path.join(shard_dir, "stage2_domain_tokens.bin")
    np.asarray(dom_ids, dtype=np.uint32).tofile(dom_bin)
    with open(dom_bin, "rb") as bf:
        dom_sha = hashlib.sha256(bf.read()).hexdigest()
    with open(os.path.join(shard_dir, "stage2_domain_meta.json"), "w", encoding="utf-8") as f:
        json.dump({
            "prefix": "stage2_domain",
            "dtype": "uint32",
            "vocab_size": tok.vocab_size,
            "total_tokens": len(dom_ids),
            "doc_count": len(dom_docs),
            "raw_chars_total": dom_chars,
            "bytes_per_token": round(dom_chars / max(1, len(dom_ids)), 3),
            "bin_path": dom_bin,
            "sha256": dom_sha,
        }, f, indent=2)

    # One clean Q&A pair per `block_size` row so every turn starts at RoPE position 0 with zero leakage!
    def _pack_sft_single_turn_blocks(items: List[Dict[str, str]]) -> Tuple[np.ndarray, np.ndarray, int, int]:
        inp_rows: List[List[int]] = []
        lbl_rows: List[List[int]] = []
        skipped_too_long = 0
        non_pad_tokens = 0
        for r in items:
            p_ids = tok.encode(f"<bos><user>{r['instruction']}</user><assistant>", add_bos=False, add_eos=False)
            r_ids = tok.encode(f"{r['response']}</assistant><eos>", add_bos=False, add_eos=False)
            seq = p_ids + r_ids
            if len(seq) > block_size:
                skipped_too_long += 1
                continue
            lbl = ([-100] * len(p_ids)) + r_ids
            pad_n = block_size - len(seq)
            inp_rows.append(seq + [tok.pad_id] * pad_n)
            lbl_rows.append(lbl + [-100] * pad_n)
            non_pad_tokens += len(seq)
        if not inp_rows:
            return np.zeros((0, block_size), dtype=np.uint32), np.zeros((0, block_size), dtype=np.int32), 0, skipped_too_long
        return (
            np.asarray(inp_rows, dtype=np.uint32),
            np.asarray(lbl_rows, dtype=np.int32),
            non_pad_tokens,
            skipped_too_long,
        )

    tr_inp, tr_lbl, tr_sft_toks, tr_skip = _pack_sft_single_turn_blocks(sft_train)
    va_inp, va_lbl, va_sft_toks, va_skip = _pack_sft_single_turn_blocks(sft_val)

    # Focused Stage 4: Math + Multi-Language Code + Science/Engineering/Robotics
    s4_rows = [r for r in sft_train if r["domain"] in ("math_gsm8k_orca", "coding_python", "coding_js", "coding_java", "coding_other", "science_engineering_robotics")]
    s4_inp, s4_lbl, s4_toks, _ = _pack_sft_single_turn_blocks(s4_rows)

    # Focused Stage 5: Tool/JSON + Hindi/Hinglish + Concise Replay of Math/Code/STEM
    s5_core = [r for r in sft_train if r["domain"] in ("tool_calling_json", "hindi_devanagari", "hinglish")]
    s5_replay = [r for r in s4_rows[: max(600, len(s5_core) // 2)]]
    s5_rows = s5_core + s5_replay
    random.Random(seed + 19).shuffle(s5_rows)
    s5_inp, s5_lbl, s5_toks, _ = _pack_sft_single_turn_blocks(s5_rows)

    tr_inp.tofile(os.path.join(shard_dir, "sft_train_inp.bin"))
    tr_lbl.tofile(os.path.join(shard_dir, "sft_train_lbl.bin"))
    va_inp.tofile(os.path.join(shard_dir, "sft_val_inp.bin"))
    va_lbl.tofile(os.path.join(shard_dir, "sft_val_lbl.bin"))
    s4_inp.tofile(os.path.join(shard_dir, "stage4_math_code_inp.bin"))
    s4_lbl.tofile(os.path.join(shard_dir, "stage4_math_code_lbl.bin"))
    s5_inp.tofile(os.path.join(shard_dir, "stage5_tool_json_inp.bin"))
    s5_lbl.tofile(os.path.join(shard_dir, "stage5_tool_json_lbl.bin"))

    with open(os.path.join(shard_dir, "sft_val_sample.jsonl"), "w", encoding="utf-8") as f:
        for r in sft_val[:200]:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    sft_meta = {
        "vocab_size": tok.vocab_size,
        "block_size": block_size,
        "train_blocks": int(tr_inp.shape[0]),
        "train_tokens": int(tr_sft_toks),
        "train_pairs": int(tr_inp.shape[0]),
        "train_pairs_skipped_long": int(tr_skip),
        "stage4_blocks": int(s4_inp.shape[0]),
        "stage4_tokens": int(s4_toks),
        "stage4_pairs": int(s4_inp.shape[0]),
        "stage5_blocks": int(s5_inp.shape[0]),
        "stage5_tokens": int(s5_toks),
        "stage5_pairs": int(s5_inp.shape[0]),
        "val_blocks": int(va_inp.shape[0]),
        "val_tokens": int(va_sft_toks),
        "val_pairs": int(va_inp.shape[0]),
        "test_rows": len(sft_test),
        "bucket_counts": sft_stats,
        "built_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    with open(os.path.join(shard_dir, "sft_meta.json"), "w", encoding="utf-8") as f:
        json.dump(sft_meta, f, indent=2)

    return {
        "shard_dir": shard_dir,
        "tokenizer": tok_stats,
        "pretrain_tokens": len(pre_tr_ids),
        "pretrain_val_tokens": len(pre_val_ids),
        "pretrain_domain_docs": pre_stats,
        "sft_meta": sft_meta,
    }


def refresh_stage4_stage5_shards(
    raw_dir: str = DEFAULT_RAW_DIR,
    shard_dir: str = DEFAULT_QUALITY_SHARD_DIR,
    block_size: int = 256,
    seed: int = 42,
) -> Dict[str, object]:
    """Rebuild stage4_math_code and stage5_tool_json memmap shards using existing tokenizer.json + sft_val."""
    tok = JarvisBPE.load(shard_dir)
    sft_rows, sft_stats = _collect_quality_sft_rows(raw_dir, seed=seed)
    sft_train = [
        r for r in sft_rows
        if _stable_split(r["instruction"] + "\n" + r["response"], train_frac=0.90, val_frac=0.05) == "train"
    ]

    def _pack(items: List[Dict[str, str]]) -> Tuple[np.ndarray, np.ndarray, int]:
        inp_rows: List[List[int]] = []
        lbl_rows: List[List[int]] = []
        non_pad = 0
        for r in items:
            p_ids = tok.encode(f"<bos><user>{r['instruction']}</user><assistant>", add_bos=False, add_eos=False)
            r_ids = tok.encode(f"{r['response']}</assistant><eos>", add_bos=False, add_eos=False)
            seq = p_ids + r_ids
            if len(seq) > block_size:
                continue
            lbl = ([-100] * len(p_ids)) + r_ids
            pad_n = block_size - len(seq)
            inp_rows.append(seq + [tok.pad_id] * pad_n)
            lbl_rows.append(lbl + [-100] * pad_n)
            non_pad += len(seq)
        return np.asarray(inp_rows, dtype=np.uint32), np.asarray(lbl_rows, dtype=np.int32), non_pad

    s4_rows = [
        r for r in sft_train
        if r["domain"] in ("math_gsm8k_orca", "coding_python", "coding_js", "coding_java", "coding_other", "science_engineering_robotics")
    ]
    eng_clean = [r for r in sft_train if r["domain"] == "english_general_swe"][:700]
    s4_all = s4_rows + eng_clean
    random.Random(seed + 13).shuffle(s4_all)
    s4_inp, s4_lbl, s4_toks = _pack(s4_all)

    s5_core = [r for r in sft_train if r["domain"] in ("tool_calling_json", "hindi_devanagari", "hinglish")]
    s5_replay = [r for r in s4_all[: max(900, int(len(s5_core) * 0.75))]]
    s5_all = s5_core + s5_replay
    random.Random(seed + 19).shuffle(s5_all)
    s5_inp, s5_lbl, s5_toks = _pack(s5_all)

    # Equal-balance final consolidation mix across all domains (general + math + py/js/java + stem + tools + hindi/hinglish)
    by_dom: Dict[str, List[Dict[str, str]]] = {}
    for r in sft_train:
        by_dom.setdefault(r["domain"], []).append(r)
    dom_caps = {
        "english_general_swe": 700,
        "math_gsm8k_orca": 850,
        "coding_python": 400,
        "coding_js": 340,
        "coding_java": 200,
        "science_engineering_robotics": 600,
        "tool_calling_json": 850,
        "hindi_devanagari": 550,
        "hinglish": 450,
    }
    s5b_all: List[Dict[str, str]] = []
    for dk, dlim in dom_caps.items():
        lst = list(by_dom.get(dk, []))
        random.Random(seed + 31).shuffle(lst)
        s5b_all.extend(lst[:dlim])
    random.Random(seed + 37).shuffle(s5b_all)
    s5b_inp, s5b_lbl, s5b_toks = _pack(s5b_all)

    s4_inp.tofile(os.path.join(shard_dir, "stage4_math_code_inp.bin"))
    s4_lbl.tofile(os.path.join(shard_dir, "stage4_math_code_lbl.bin"))
    s5_inp.tofile(os.path.join(shard_dir, "stage5_tool_json_inp.bin"))
    s5_lbl.tofile(os.path.join(shard_dir, "stage5_tool_json_lbl.bin"))
    s5b_inp.tofile(os.path.join(shard_dir, "stage5b_balanced_inp.bin"))
    s5b_lbl.tofile(os.path.join(shard_dir, "stage5b_balanced_lbl.bin"))

    meta_p = os.path.join(shard_dir, "sft_meta.json")
    sft_meta = json.load(open(meta_p, "r", encoding="utf-8")) if os.path.exists(meta_p) else {}
    sft_meta.update({
        "stage4_blocks": int(s4_inp.shape[0]),
        "stage4_tokens": int(s4_toks),
        "stage4_pairs": int(s4_inp.shape[0]),
        "stage5_blocks": int(s5_inp.shape[0]),
        "stage5_tokens": int(s5_toks),
        "stage5_pairs": int(s5_inp.shape[0]),
        "stage5b_blocks": int(s5b_inp.shape[0]),
        "stage5b_tokens": int(s5b_toks),
        "stage5b_pairs": int(s5b_inp.shape[0]),
        "refreshed_bucket_counts": sft_stats,
        "refreshed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    })
    with open(meta_p, "w", encoding="utf-8") as f:
        json.dump(sft_meta, f, indent=2)
    return sft_meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", default=DEFAULT_RAW_DIR)
    ap.add_argument("--shard-dir", default=DEFAULT_QUALITY_SHARD_DIR)
    ap.add_argument("--vocab-size", type=int, default=4096)
    ap.add_argument("--block-size", type=int, default=256)
    ap.add_argument("--refresh-s4-s5", action="store_true")
    args = ap.parse_args()
    if args.refresh_s4_s5:
        out = refresh_stage4_stage5_shards(
            raw_dir=args.raw_dir,
            shard_dir=args.shard_dir,
            block_size=args.block_size,
        )
    else:
        out = build_quality_shards(
            raw_dir=args.raw_dir,
            shard_dir=args.shard_dir,
            vocab_size=args.vocab_size,
            block_size=args.block_size,
        )
    print(json.dumps(out, indent=2))
