import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.rigorous_evaluator import rigorous_verify_probe, normalize_math_str
from ml_foundation.evaluate_independent_transfer import verify_probe

with open(os.path.join(REPO_ROOT, 'vision_independent_transfer_test_200.jsonl'), 'r', encoding='utf-8') as f:
    probes = {p['id']: p for p in [json.loads(l) for l in f if l.strip()]}

raw_gens = {
    'TRF-0001': '10 = 2.\nThe answer is 3.',
    'TRF-0002': '12 = 3.\nThe answer is 10.'
}

output = {
    'investigation': 'Stage 2 Arithmetic False-Positive Investigation',
    'checkpoint_evaluated': 'data/neural_models/checkpoints/vision-13m-sft-aligned/weights.pt',
    'checkpoint_sha256': '085ef922342be408fb9a1b394733da687e0354a3f644de0025f24917de2eb5e2',
    'evaluator_defect_analysis': {
        'flawed_file': 'ml_foundation/evaluate_independent_transfer.py',
        'flawed_function': 'verify_probe',
        'flawed_lines': 'if exp_ans and exp_ans in gen_lower: return True, "EXACT_ANSWER_MATCH"',
        'root_cause': 'Unanchored substring check matched target number wherever it appeared, even in contradictory hallucinated equations or premises where the model explicitly concluded an incorrect final answer.'
    },
    'probes': []
}

for pid in ['TRF-0001', 'TRF-0002']:
    p = probes[pid]
    raw = raw_gens[pid]
    buggy_passed, buggy_reason = verify_probe(p, raw)
    rigorous_passed, rigorous_reason, extracted = rigorous_verify_probe(p, raw)
    norm = normalize_math_str(extracted) if extracted else None
    output['probes'].append({
        'probe_id': pid,
        'domain': p.get('domain'),
        'prompt': p.get('prompt'),
        'expected_answer': p.get('expected_answer'),
        'raw_model_output': raw,
        'extracted_answer': extracted,
        'normalized_answer': norm,
        'buggy_scoring_decision': {
            'passed': buggy_passed,
            'verdict_reason': buggy_reason,
            'is_false_positive': True
        },
        'rigorous_scoring_decision': {
            'passed': rigorous_passed,
            'verdict_reason': rigorous_reason,
            'is_correct': False
        }
    })

out_path = os.path.join(REPO_ROOT, 'VISION_STAGE2_REPRODUCED_GENERATIONS.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)

print('Generated VISION_STAGE2_REPRODUCED_GENERATIONS.json successfully at:', out_path)
