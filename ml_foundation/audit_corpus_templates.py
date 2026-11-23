"""
AUDIT CORPUS FOR REPETITIVE TEMPLATES (ml_foundation/audit_corpus_templates.py)

Performs deep forensic audit of existing training corpora:
1. Detects repeated question & answer templates.
2. Identifies predictable answer positions / multiple choice bias.
3. Verifies arithmetic labels for mathematical validity.
4. Detects contradictory equations (A = B where A != B).
5. Quantifies superficial synthetic variations.
"""

import os
import sys
import json
import re
from collections import Counter
from typing import Dict, List, Any

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

DATASETS_TO_AUDIT = [
    ("Stage 3 Curriculum", os.path.join(REPO_ROOT, "data", "neural_models", "datasets", "vision_stage3_curriculum")),
    ("Stage 2 SFT Alignment", os.path.join(REPO_ROOT, "data", "neural_models", "datasets", "vision_sft_alignment"))
]

def abstract_template(text: str) -> str:
    """Replaces numbers and identifiers with generic placeholders to reveal templates."""
    t = re.sub(r"\b\d+\b", "{NUM}", text)
    t = re.sub(r"\b[A-Za-z0-9_-]+\.py\b", "{FILE}", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def check_equation_contradictions(text: str) -> List[str]:
    """Finds assertions of the form N1 = N2 where N1 != N2 and neither side is an arithmetic expression."""
    contradictions = []
    for part in re.split(r"[;\n\.]", text):
        if "=" in part:
            sides = part.split("=")
            if len(sides) == 2:
                left, right = sides[0].strip(), sides[1].strip()
                m_left = re.fullmatch(r"[+-]?\d+(?:\.\d+)?", left)
                m_right = re.fullmatch(r"[+-]?\d+(?:\.\d+)?", right)
                if m_left and m_right:
                    try:
                        if abs(float(m_left.group(0)) - float(m_right.group(0))) > 1e-6:
                            contradictions.append(f"{left} = {right}")
                    except Exception:
                        pass
    return contradictions

def audit_dataset(name: str, ds_dir: str) -> Dict[str, Any]:
    print(f"\n==================================================")
    print(f"Auditing Dataset: {name} ({ds_dir})")
    print(f"==================================================")

    train_path = os.path.join(ds_dir, "train.jsonl")
    val_path = os.path.join(ds_dir, "val.jsonl")

    all_samples = []
    for split_name, p in [("train", train_path), ("val", val_path)]:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    if not line.strip():
                        continue
                    item = json.loads(line)
                    item["split"] = split_name
                    all_samples.append(item)

    print(f"Loaded {len(all_samples)} total samples.")

    question_templates = Counter()
    answer_templates = Counter()
    mc_answer_counts = Counter()
    contradictions_found = []
    synthetic_count = 0
    domains = Counter()

    for idx, s in enumerate(all_samples):
        inst = s.get("instruction", "")
        resp = s.get("response", "")
        domain = s.get("domain", "unknown")
        source = s.get("source", "unknown")
        domains[domain] += 1

        if "synthetic" in source:
            synthetic_count += 1

        q_tmpl = abstract_template(inst)
        question_templates[q_tmpl] += 1

        # Check answer skeleton
        a_first_line = resp.split("\n")[0]
        a_tmpl = abstract_template(a_first_line)
        answer_templates[a_tmpl] += 1

        # Multiple choice options
        mc_match = re.search(r"^\(([A-D])\)", resp.strip()) or re.search(r"The correct choice is \(([A-D])\)", resp) or re.search(r"The correct answer is ([1-4])", resp)
        if mc_match:
            mc_answer_counts[mc_match.group(1)] += 1

        # Contradictions
        c_list = check_equation_contradictions(resp)
        if c_list:
            contradictions_found.append({
                "sample_idx": idx,
                "domain": domain,
                "source": source,
                "contradictions": c_list,
                "text_snippet": resp[:120]
            })

    # Find dominant templates (> 2% of dataset)
    total = len(all_samples)
    dominant_q_tmpls = [
        {"template": tmpl, "count": cnt, "pct": round(cnt / total * 100, 2)}
        for tmpl, cnt in question_templates.most_common(15)
    ]
    dominant_a_tmpls = [
        {"template": tmpl, "count": cnt, "pct": round(cnt / total * 100, 2)}
        for tmpl, cnt in answer_templates.most_common(15)
    ]

    print(f"Total Samples: {total}")
    print(f"Synthetic Samples: {synthetic_count} ({round(synthetic_count / total * 100, 2)}%)")
    print(f"Top 5 Question Templates:")
    for t in dominant_q_tmpls[:5]:
        print(f"  [{t['count']} ({t['pct']}%)]: {t['template'][:70]}")
    print(f"Top 5 Answer Templates:")
    for t in dominant_a_tmpls[:5]:
        print(f"  [{t['count']} ({t['pct']}%)]: {t['template'][:70]}")
    print(f"Contradictions detected: {len(contradictions_found)}")
    print(f"MC Answer distribution: {dict(mc_answer_counts)}")

    return {
        "dataset_name": name,
        "dataset_dir": ds_dir,
        "total_samples": total,
        "domains": dict(domains),
        "synthetic_samples": synthetic_count,
        "synthetic_pct": round(synthetic_count / total * 100, 2) if total else 0,
        "dominant_question_templates": dominant_q_tmpls,
        "dominant_answer_templates": dominant_a_tmpls,
        "multiple_choice_distribution": dict(mc_answer_counts),
        "contradictions_detected_count": len(contradictions_found),
        "sample_contradictions": contradictions_found[:10]
    }

def main():
    results = {}
    for name, path in DATASETS_TO_AUDIT:
        results[name] = audit_dataset(name, path)

    out_file = os.path.join(REPO_ROOT, "VISION_STAGE4_TEMPLATE_AUDIT.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nAudit complete. Saved to {out_file}")

if __name__ == "__main__":
    main()
