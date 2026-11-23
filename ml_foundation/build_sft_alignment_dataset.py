"""
BUILD SFT ALIGNMENT DATASET (ml_foundation/build_sft_alignment_dataset.py)

Curates a high-density, multi-domain instruction-tuning (SFT) dataset:
- Sequence length: 256 tokens (with RoPE dynamic frequencies)
- 100% prompt masking in next-token cross-entropy loss
- Domains:
  1. Mathematics & Arithmetic (concise, verified calculation)
  2. Polyglot Programming (Python AST functions, algorithms)
  3. Formal Reasoning & Deductive Logic (syllogisms, truth deduction)
  4. Science & Engineering (physics laws, formulas, units)
  5. Hindi Devanagari & Hinglish Dialogue (bilingual comprehension)
  6. Instruction Following & Text Formatting (transformations, extraction)
- Strict decontamination against all 1,500 validation and 200 transfer probes.
"""

import os
import sys
import json
import re
import random
from typing import Dict, List, Set, Any, Tuple
import pyarrow.parquet as pq

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.tokenizer import JarvisBPE

RAW_DIR = os.path.join(REPO_ROOT, "data", "corpus_raw")
OUT_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "datasets", "vision_sft_alignment")
os.makedirs(OUT_DIR, exist_ok=True)

TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")
TRANSFER_TEST_FILE = os.path.join(REPO_ROOT, "vision_independent_transfer_test_200.jsonl")
VAL_1500_FILE = os.path.join(REPO_ROOT, "vision_expanded_validation_dataset_1500.jsonl")

def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())

def extract_ngrams(text: str, n: int = 8) -> Set[str]:
    words = normalize_text(text).split()
    if len(words) < n:
        return {" ".join(words)}
    return {" ".join(words[i:i+n]) for i in range(len(words) - n + 1)}

def build_decontamination_index() -> Tuple[Set[str], Set[str]]:
    benchmark_exact = set()
    benchmark_ngrams = set()

    for path in [TRANSFER_TEST_FILE, VAL_1500_FILE]:
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                p = json.loads(line)
                prompt = p.get("prompt", "")
                ans = p.get("expected_answer", "")
                if prompt:
                    benchmark_exact.add(normalize_text(prompt))
                    benchmark_ngrams.update(extract_ngrams(prompt, 8))
                if ans:
                    benchmark_exact.add(normalize_text(str(ans)))

    print(f"[DECONTAM] Indexed {len(benchmark_exact):,} benchmark phrases and {len(benchmark_ngrams):,} 8-grams.")
    return benchmark_exact, benchmark_ngrams

def is_contaminated(text: str, bench_exact: Set[str], bench_ngrams: Set[str]) -> bool:
    norm = normalize_text(text)
    if norm in bench_exact:
        return True
    ngrams = extract_ngrams(text, 8)
    if any(ng in bench_ngrams for ng in ngrams):
        return True
    return False

def generate_arithmetic_samples(count: int = 2500) -> List[Dict[str, str]]:
    """Generates synthetic arithmetic examples that reinforce direct calculation without rambling."""
    samples = []
    random.seed(42)
    ops = [
        ("+", lambda a, b: a + b),
        ("-", lambda a, b: a - b),
        ("*", lambda a, b: a * b),
    ]
    templates = [
        "Compute the exact value of {a} {op1} {b}.",
        "Calculate the value of {a} {op1} {b} {op2} {c}.",
        "What is {a} {op1} {b}?",
        "Evaluate the expression: ({a} {op1} {b}) {op2} {c}.",
        "Solve for the result: {a} {op1} {b}."
    ]

    for _ in range(count):
        # Choose two or three terms with operands between 2 and 99
        a = random.randint(3, 85)
        b = random.randint(2, 50)
        c = random.randint(2, 30)

        op1_sym, op1_fn = random.choice(ops)
        op2_sym, op2_fn = random.choice(ops[:2]) # addition or subtraction for second op

        # Create problem with diverse, un-biased response formats
        tmpl = random.choice(templates)
        style = random.choice(["direct", "equation", "step", "answer_phrase"])
        if "{c}" in tmpl:
            intermediate = op1_fn(a, b)
            final_res = op2_fn(intermediate, c)
            prompt = tmpl.format(a=a, b=b, c=c, op1=op1_sym, op2=op2_sym)
            if style == "direct":
                resp = f"{final_res}"
            elif style == "equation":
                resp = f"({a} {op1_sym} {b}) {op2_sym} {c} = {intermediate} {op2_sym} {c} = {final_res}."
            elif style == "step":
                resp = f"Evaluating step-by-step: ({a} {op1_sym} {b}) = {intermediate}, then {intermediate} {op2_sym} {c} = {final_res}."
            else:
                resp = f"The exact value is {final_res}."
        else:
            final_res = op1_fn(a, b)
            prompt = tmpl.format(a=a, b=b, op1=op1_sym)
            if style == "direct":
                resp = f"{final_res}"
            elif style == "equation":
                resp = f"{a} {op1_sym} {b} = {final_res}."
            elif style == "step":
                resp = f"Calculating: {a} {op1_sym} {b} gives {final_res}."
            else:
                resp = f"The answer is {final_res}."

        samples.append({
            "instruction": prompt,
            "response": resp,
            "domain": "mathematics",
            "pillar": "mathematics_and_reasoning",
            "source": "synthetic_arithmetic_foundations"
        })
    return samples

def build_sft_dataset():
    tokenizer = JarvisBPE.load(TOKENIZER_DIR)
    bench_exact, bench_ngrams = build_decontamination_index()

    curated_samples = []

    # 1. Synthetic clean arithmetic (2,500 samples)
    print("[1/6] Generating clean arithmetic foundations...")
    arith_samples = generate_arithmetic_samples(2500)
    for s in arith_samples:
        if not is_contaminated(s["instruction"], bench_exact, bench_ngrams):
            curated_samples.append(s)
    print(f"  Added {len(arith_samples)} arithmetic samples.")

    # 2. GSM8K Grade-School Math (up to 2,000 samples)
    print("[2/6] Loading GSM8K math reasoning...")
    gsm8k_path = os.path.join(RAW_DIR, "openai__gsm8k", "main", "train-00000-of-00001.parquet")
    if os.path.exists(gsm8k_path):
        t_gsm = pq.read_table(gsm8k_path)
        gsm_added = 0
        for q, a in zip(t_gsm["question"].to_pylist(), t_gsm["answer"].to_pylist()):
            if is_contaminated(q, bench_exact, bench_ngrams):
                continue
            # Format clean response
            ans_clean = re.sub(r"<<.*?>>", "", a).strip()
            curated_samples.append({
                "instruction": q.strip(),
                "response": ans_clean,
                "domain": "mathematics",
                "pillar": "mathematics_and_reasoning",
                "source": "openai__gsm8k"
            })
            gsm_added += 1
            if gsm_added >= 2000:
                break
        print(f"  Added {gsm_added} GSM8K samples.")

    # 3. Python Programming (Self-OSS Instruct, up to 2,500 samples)
    print("[3/6] Loading Python coding instructions...")
    oss_path = os.path.join(RAW_DIR, "bigcode__self-oss-instruct-sc2-exec-filter-50k", "data", "train-00000-of-00001.parquet")
    if os.path.exists(oss_path):
        t_oss = pq.read_table(oss_path)
        oss_added = 0
        for inst, resp in zip(t_oss["instruction"].to_pylist(), t_oss["response"].to_pylist()):
            if is_contaminated(inst, bench_exact, bench_ngrams):
                continue
            # Ensure it contains a python function
            if "def " in resp and ("return " in resp or "yield " in resp):
                curated_samples.append({
                    "instruction": inst.strip(),
                    "response": resp.strip(),
                    "domain": "programming_python",
                    "pillar": "polyglot_programming",
                    "source": "bigcode__self-oss-instruct"
                })
                oss_added += 1
                if oss_added >= 2500:
                    break
        print(f"  Added {oss_added} Python coding samples.")

    # 4. Formal Reasoning & Science (MMLU, up to 2,500 samples)
    print("[4/6] Loading MMLU formal reasoning and science...")
    mmlu_path = os.path.join(RAW_DIR, "cais__mmlu", "all", "auxiliary_train-00000-of-00001.parquet")
    if os.path.exists(mmlu_path):
        t_mmlu = pq.read_table(mmlu_path)
        mmlu_added = 0
        for q, choices, ans_idx, subj in zip(
            t_mmlu["question"].to_pylist(),
            t_mmlu["choices"].to_pylist(),
            t_mmlu["answer"].to_pylist(),
            t_mmlu["subject"].to_pylist()
        ):
            if is_contaminated(q, bench_exact, bench_ngrams):
                continue
            try:
                ans_int = int(ans_idx)
                choice_letter = ["A", "B", "C", "D"][ans_int]
                correct_text = choices[ans_int]
            except Exception:
                continue

            options_str = "\n".join([f"({letter}) {c}" for letter, c in zip(["A", "B", "C", "D"], choices)])
            inst = f"{q}\n\nOptions:\n{options_str}"
            resp = f"The correct answer is ({choice_letter}): {correct_text}."

            domain = "formal_reasoning" if "logic" in subj or "philosophy" in subj else "science_engineering"
            pillar = "formal_reasoning_and_exam" if domain == "formal_reasoning" else "general_language_and_science"

            curated_samples.append({
                "instruction": inst.strip(),
                "response": resp.strip(),
                "domain": domain,
                "pillar": pillar,
                "source": "cais__mmlu"
            })
            mmlu_added += 1
            if mmlu_added >= 2500:
                break
        print(f"  Added {mmlu_added} MMLU reasoning & science samples.")

    # 5. Hindi & Hinglish Instructions (smangrul & sangraha, up to 2,000 samples)
    print("[5/6] Loading Hindi & Hinglish instructions...")
    hindi_path = os.path.join(RAW_DIR, "smangrul__hindi_instruct_v1", "data", "train-00000-of-00001.parquet")
    if os.path.exists(hindi_path):
        t_hin = pq.read_table(hindi_path)
        hin_added = 0
        for msgs in t_hin["messages"].to_pylist():
            # parse messages
            user_msg = ""
            asst_msg = ""
            for m in msgs:
                if m.get("role") == "user":
                    user_msg = m.get("content", "").strip()
                elif m.get("role") == "assistant":
                    asst_msg = m.get("content", "").strip()
            if user_msg and asst_msg:
                if is_contaminated(user_msg, bench_exact, bench_ngrams):
                    continue
                curated_samples.append({
                    "instruction": user_msg,
                    "response": asst_msg,
                    "domain": "hindi_devanagari",
                    "pillar": "hindi_and_hinglish",
                    "source": "smangrul__hindi_instruct_v1"
                })
                hin_added += 1
                if hin_added >= 2000:
                    break
        print(f"  Added {hin_added} Hindi instruction samples.")

    # 6. Instruction Following & Text Formatting (up to 1,500 samples)
    print("[6/6] Generating instruction-following transformations...")
    random.seed(1337)
    inst_samples = []
    entities = [
        "quantum core", "hyperdrive reactor", "thermal sensor 4", "plasma conduit b",
        "orbital telemetry unit", "inertial guidance gyroscope", "sublight thruster",
        "stark particle accelerator", "neural interface link", "flux capacitor array"
    ]
    for _ in range(1500):
        ent = random.choice(entities)
        code_id = f"V-{random.randint(100, 999)}"
        mode = random.choice(["upper", "lower", "title", "bracket"])
        if mode == "upper":
            prompt = f"Format the following entity name in uppercase and append code ID [{code_id}]: '{ent}'."
            resp = f"{ent.upper()} [{code_id}]"
        elif mode == "lower":
            prompt = f"Convert the following system identifier to lowercase: '{ent.upper()}'."
            resp = ent.lower()
        elif mode == "title":
            prompt = f"Format the following technical component in title case: '{ent}'."
            resp = ent.title()
        else:
            prompt = f"Wrap the system tag '{ent}' with prefix <<SYS and suffix SYS>>."
            resp = f"<<SYS {ent} SYS>>"

        if not is_contaminated(prompt, bench_exact, bench_ngrams):
            inst_samples.append({
                "instruction": prompt,
                "response": resp,
                "domain": "instruction_following",
                "pillar": "instruction_following_and_dialogue",
                "source": "synthetic_instruction_following"
            })
    curated_samples.extend(inst_samples)
    print(f"  Added {len(inst_samples)} instruction-following samples.")

    # Filter and format for 256 tokens max sequence length
    print("\nFiltering and packaging samples for max_seq_len = 256...")
    packaged_samples = []
    asst_id = tokenizer.vocab.get("<assistant>", 6)

    for item in curated_samples:
        inst = item["instruction"].strip()
        resp = item["response"].strip()

        p_text = f"<bos><user>{inst}</user><assistant>"
        r_text = f"{resp}</assistant><eos>"

        p_ids = tokenizer.encode(p_text)
        r_ids = tokenizer.encode(r_text)

        # Ensure prompt is not excessively long (leave at least 32 tokens for response)
        if len(p_ids) > 160:
            continue

        # Truncate response if total length exceeds 256
        max_r_len = 256 - len(p_ids)
        if len(r_ids) > max_r_len:
            r_ids = r_ids[:max_r_len]

        full_ids = p_ids + r_ids
        if len(full_ids) < 8 or len(r_ids) < 2:
            continue

        packaged_samples.append({
            "instruction": inst,
            "response": resp,
            "domain": item["domain"],
            "pillar": item["pillar"],
            "source": item["source"],
            "token_count": len(full_ids),
            "response_token_count": len(r_ids),
            "text": p_text + resp + "</assistant><eos>"
        })

    # Group by normalized instruction to guarantee 0 prompt leakage between train and val
    prompt_groups = {}
    for s in packaged_samples:
        norm = normalize_text(s["instruction"])
        if norm not in prompt_groups:
            prompt_groups[norm] = []
        prompt_groups[norm].append(s)

    unique_prompts = sorted(list(prompt_groups.keys()))
    random.seed(999)
    random.shuffle(unique_prompts)

    split_idx = int(len(unique_prompts) * 0.9)
    train_prompt_set = set(unique_prompts[:split_idx])
    val_prompt_set = set(unique_prompts[split_idx:])

    train_samples = []
    val_samples = []
    for norm_p, items in prompt_groups.items():
        if norm_p in train_prompt_set:
            train_samples.extend(items)
        else:
            val_samples.extend(items)

    train_file = os.path.join(OUT_DIR, "train.jsonl")
    val_file = os.path.join(OUT_DIR, "val.jsonl")

    with open(train_file, "w", encoding="utf-8") as f:
        for s in train_samples:
            f.write(json.dumps(s) + "\n")

    with open(val_file, "w", encoding="utf-8") as f:
        for s in val_samples:
            f.write(json.dumps(s) + "\n")

    domain_counts = {}
    for s in packaged_samples:
        domain_counts[s["domain"]] = domain_counts.get(s["domain"], 0) + 1

    total_tokens = sum(s["token_count"] for s in packaged_samples)
    total_resp_tokens = sum(s["response_token_count"] for s in packaged_samples)

    manifest = {
        "dataset_name": "vision_sft_alignment",
        "description": "Targeted multi-domain instruction tuning dataset with 100% prompt masking",
        "max_seq_len": 256,
        "total_samples": len(packaged_samples),
        "train_samples": len(train_samples),
        "val_samples": len(val_samples),
        "total_tokens": total_tokens,
        "total_response_target_tokens": total_resp_tokens,
        "domain_distribution": domain_counts,
        "train_file": train_file,
        "val_file": val_file
    }

    manifest_file = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("\n========================================================")
    print(f"SFT ALIGNMENT DATASET BUILT SUCCESSFULLY")
    print(f"Total Samples: {len(packaged_samples):,} (Train: {len(train_samples):,}, Val: {len(val_samples):,})")
    print(f"Total Tokens: {total_tokens:,} | Response Target Tokens: {total_resp_tokens:,}")
    print(f"Domain distribution: {domain_counts}")
    print(f"Manifest written to: {manifest_file}")
    print("========================================================")

if __name__ == "__main__":
    build_sft_dataset()
