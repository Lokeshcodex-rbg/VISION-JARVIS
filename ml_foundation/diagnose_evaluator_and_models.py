"""
DIAGNOSE EVALUATOR AND MODELS (ml_foundation/diagnose_evaluator_and_models.py)
Systematically checks verifier controls and inspects generations of all checkpoints.
"""

import os
import sys
import json
import re
import ast
import torch

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.evaluate_independent_transfer import verify_probe

TRANSFER_TEST_FILE = os.path.join(REPO_ROOT, "vision_independent_transfer_test_200.jsonl")
TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")
CHECKPOINTS_BASE = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints")

def run_verifier_controls():
    print("==================================================")
    print("STEP 1: VERIFIER LOGIC CONTROL AUDIT")
    print("==================================================")
    with open(TRANSFER_TEST_FILE, "r", encoding="utf-8") as f:
        probes = [json.loads(line) for line in f]

    print(f"Total transfer test probes: {len(probes)}")

    # 1. Positive control: Feeding exact expected_answer
    pos_pass = 0
    pos_fails = []
    for p in probes:
        exp = p.get("expected_answer", "")
        ok, reason = verify_probe(p, exp)
        if ok:
            pos_pass += 1
        else:
            pos_fails.append((p["id"], p["domain"], p.get("verification_type"), exp, reason))

    print(f"Positive Control (exact expected_answer): {pos_pass}/{len(probes)} ({pos_pass/len(probes)*100:.1f}%)")
    if pos_fails:
        print(f"  [ALERT] {len(pos_fails)} probes failed positive control! First 5:")
        for pf in pos_fails[:5]:
            print(f"    - ID: {pf[0]}, Domain: {pf[1]}, VType: {pf[2]}, Exp: '{pf[3]}', Reason: {pf[4]}")

    # 1b. Positive control with conversational wrapper: "The answer is {expected_answer}."
    pos_wrap_pass = 0
    pos_wrap_fails = []
    for p in probes:
        exp = p.get("expected_answer", "")
        if p.get("verification_type") == "code_syntax":
            ans_text = f"```python\n{exp}\n```"
        else:
            ans_text = f"The answer is {exp}."
        ok, reason = verify_probe(p, ans_text)
        if ok:
            pos_wrap_pass += 1
        else:
            pos_wrap_fails.append((p["id"], p["domain"], p.get("verification_type"), exp, reason))

    print(f"Positive Control (wrapped answer): {pos_wrap_pass}/{len(probes)} ({pos_wrap_pass/len(probes)*100:.1f}%)")

    # 2. Negative control: Pure nonsense
    neg_pass = 0
    for p in probes:
        ok, reason = verify_probe(p, "xyz_nonsense_flubber_99999999")
        if ok:
            neg_pass += 1
    print(f"Negative Control (random nonsense): {neg_pass}/{len(probes)} passed (Expected 0)")

    # 2b. Negative control: Inverted answers / wrong numbers
    neg_wrong_pass = 0
    for p in probes:
        ok, reason = verify_probe(p, "0")
        if ok and p.get("expected_answer") != "0":
            neg_wrong_pass += 1
    print(f"Negative Control ('0' everywhere): {neg_wrong_pass}/{len(probes)} false positives")

    return pos_pass, len(probes), pos_fails

def inspect_model_generations(ckpt_names):
    print("\n==================================================")
    print("STEP 2: CHECKPOINT GENERATION INSPECTION (FIRST 10 PROBES)")
    print("==================================================")
    tokenizer = JarvisBPE.load(TOKENIZER_DIR)
    with open(TRANSFER_TEST_FILE, "r", encoding="utf-8") as f:
        sample_probes = [json.loads(f.readline()) for _ in range(10)]

    for name in ckpt_names:
        ckpt_dir = os.path.join(CHECKPOINTS_BASE, name)
        cfg_path = os.path.join(ckpt_dir, "config.json")
        weights_path = os.path.join(ckpt_dir, "weights.pt")

        if not os.path.exists(weights_path):
            print(f"Skip {name}: weights not found at {weights_path}")
            continue

        with open(cfg_path, "r") as f:
            cfg = JarvisConfig.from_dict(json.load(f))
        model = JarvisUnifiedTransformer(cfg)
        model.load_state_dict(torch.load(weights_path, map_location="cpu"), strict=False)
        model.eval()

        print(f"\n--- Checkpoint: {name} (Params: {sum(p.numel() for p in model.parameters()):,}) ---")
        for i, probe in enumerate(sample_probes[:5]):
            prompt = probe["prompt"]
            formatted = f"<bos><user>{prompt}</user><assistant>"
            inp = tokenizer.encode(formatted)
            x = torch.tensor([inp], dtype=torch.long)

            # Check raw forward logits at last prompt position
            with torch.no_grad():
                out = model(x)
                logits = out["logits"][0, -1, :]
                topk_probs, topk_ids = torch.topk(torch.softmax(logits, dim=-1), k=5)
                topk_tokens = [f"{tokenizer.id_to_token.get(idx.item(), '<unk>')}({idx.item()}:{topk_probs[j].item():.3f})" for j, idx in enumerate(topk_ids)]

            # Generate with standard model.generate
            with torch.no_grad():
                gen_ids = model.generate(
                    x,
                    max_new_tokens=32,
                    temperature=0.01,
                    repetition_penalty=1.05,
                    no_repeat_ngram_size=4,
                    eos_id=tokenizer.eos_id,
                    stop_token_ids=[tokenizer.vocab["</assistant>"]] if "</assistant>" in tokenizer.vocab else None
                )
            new_tokens = gen_ids[len(inp):]
            decoded_with_spec = tokenizer.decode(new_tokens, skip_special_tokens=False)
            decoded_clean = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

            print(f"  [Probe {probe['id']}]: '{prompt}'")
            print(f"    Expected: {probe.get('expected_answer')}")
            print(f"    Next-token top-5: {', '.join(topk_tokens)}")
            print(f"    Raw gen token IDs (first 10): {new_tokens[:10]}")
            print(f"    Decoded (raw): '{decoded_with_spec[:60]}'")
            print(f"    Decoded (clean): '{decoded_clean[:60]}'")

if __name__ == "__main__":
    pos_pass, total, pos_fails = run_verifier_controls()
    ckpts_to_test = [
        "vision-v1.4-calibrated-local",
        "vision-2.0-candidate-g",
        "vision-13m-curriculum-breakthrough",
        "vision-13m-scaling-experiment",
        "vision-25m-compact-foundation",
        "vision-100m-scaling-experiment"
    ]
    inspect_model_generations(ckpts_to_test)
