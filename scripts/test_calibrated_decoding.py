import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import json
import torch
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.evaluate_independent_transfer import verify_probe

tokenizer = JarvisBPE.load("data/neural_models/checkpoints/vision-v1.4-replay-cand-b")
ckpt_dir = "data/neural_models/checkpoints/vision-pretraining-validation-13m"
with open(f"{ckpt_dir}/config.json") as f:
    cfg = JarvisConfig.from_dict(json.load(f))

model = JarvisUnifiedTransformer(cfg)
model.load_state_dict(torch.load(f"{ckpt_dir}/weights.pt", map_location="cpu"))
model.eval()

with open("vision_independent_transfer_test_200.jsonl") as f:
    probes = [json.loads(l) for l in f]

for i in [0, 1, 40, 80, 110, 140]:
    p = probes[i]
    prompt = f"<bos><user>{p['prompt']}</user><assistant>"
    inp = tokenizer.encode(prompt)
    x = torch.tensor([inp], dtype=torch.long)
    
    with torch.no_grad():
        out_ids = model.generate(
            x,
            max_new_tokens=48,
            temperature=0.01,
            repetition_penalty=1.15,
            no_repeat_ngram_size=4,
            eos_id=tokenizer.eos_id,
            stop_token_ids=[tokenizer.vocab["</assistant>"]] if "</assistant>" in tokenizer.vocab else None
        )
    gen_tokens = out_ids[len(inp):]
    decoded = tokenizer.decode(gen_tokens, skip_special_tokens=True).strip()
    passed, reason = verify_probe(p, decoded)
    print(f"=== Probe {p['id']} ({p['domain']}) ===")
    print("PROMPT:   ", p['prompt'])
    print("EXPECTED: ", p['expected_answer'])
    print("DECODED:  ", repr(decoded))
    print(f"PASSED:   {passed} ({reason})\n")
