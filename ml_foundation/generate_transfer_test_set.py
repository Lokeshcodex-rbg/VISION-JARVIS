"""
INDEPENDENT TRANSFER TEST SET GENERATOR (`ml_foundation/generate_transfer_test_set.py`)
Generates 200 completely novel transfer evaluation probes to test out-of-distribution concept transfer.
"""

import json
import hashlib
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FILE = os.path.join(REPO_ROOT, "vision_independent_transfer_test_200.jsonl")

def make_probe(pid, domain, subcat, prompt, expected, keywords, vtype):
    h = hashlib.sha256(f"{pid}:{prompt}:{expected}".encode("utf-8")).hexdigest()[:16]
    return {
        "id": f"TRF-{pid:04d}",
        "domain": domain,
        "subcategory": subcat,
        "prompt": prompt,
        "expected_answer": expected,
        "expected_keywords": keywords,
        "verification_type": vtype,
        "hash": h
    }

def main():
    probes = []
    pid = 1
    
    # 1. Novel Mathematics Transfer (40 probes) - 3-term arithmetic & algebraic systems
    for i in range(1, 21):
        x = i * 4 + 3
        y = i * 3 + 7
        z = (i * 5) % 11 + 2
        ans = x + y - z
        prompt = f"Compute the exact value of ({x} + {y}) - {z}."
        probes.append(make_probe(pid, "mathematics", "three_term_arithmetic", prompt, str(ans), [str(ans)], "exact_math"))
        pid += 1

    for i in range(1, 21):
        x = i * 6 + 5
        lhs = 3 * x - 14
        prompt = f"Solve for x: 3x - 14 = {lhs}"
        probes.append(make_probe(pid, "mathematics", "linear_equations", prompt, f"x = {x}", [str(x)], "exact_math"))
        pid += 1

    # 2. Novel Programming Transfer (40 probes) - distinct function names & logic
    py_prompts = [
        ("compute_kinetic_energy(mass, velocity)", "def compute_kinetic_energy(mass, velocity):\n    return 0.5 * mass * (velocity ** 2)", ["def compute_kinetic_energy", "0.5"]),
        ("filter_greater_than(numbers, threshold)", "def filter_greater_than(numbers, threshold):\n    return [n for n in numbers if n > threshold]", ["def filter_greater_than", "for n in numbers"]),
        ("is_power_of_two(n)", "def is_power_of_two(n):\n    return n > 0 and (n & (n - 1)) == 0", ["def is_power_of_two", "n & (n - 1)"]),
        ("concatenate_with_comma(items)", "def concatenate_with_comma(items):\n    return ', '.join(str(x) for x in items)", ["def concatenate_with_comma", "join"]),
        ("euclidean_distance_2d(x1, y1, x2, y2)", "def euclidean_distance_2d(x1, y1, x2, y2):\n    return ((x2 - x1)**2 + (y2 - y1)**2) ** 0.5", ["def euclidean_distance_2d", "0.5"])
    ]
    for fn, code, kws in py_prompts:
        probes.append(make_probe(pid, "programming_python", "scientific_funcs", f"Write a Python function {fn}.", code, kws, "ast_code"))
        pid += 1

    for i in range(1, 36):
        fn = f"apply_scaling_factor_{i}(val)"
        code = f"def apply_scaling_factor_{i}(val):\n    return val * {i * 3 + 1}"
        probes.append(make_probe(pid, "programming_python", "parametric_funcs", f"Write a Python function {fn}.", code, [f"def apply_scaling_factor_{i}", "return"], "ast_code"))
        pid += 1

    # 3. Novel Formal Reasoning Transfer (30 probes)
    entities = [
        ("exoplanets", "gravitational masses", "astronomical objects"),
        ("ferroelectric crystals", "dielectric materials", "solid condensates"),
        ("microservices", "distributed components", "network nodes"),
        ("asynchronous routines", "concurrency primitives", "execution threads"),
        ("polypeptide chains", "polymeric structures", "organic molecules"),
        ("superconductors", "zero-resistance channels", "quantum states")
    ]
    for a, b, c in entities:
        prompt = f"Premise 1: Every {a} is an instance of {b}. Premise 2: Every {b} is classified as {c}. Conclusion: Is every {a} a {c}?"
        probes.append(make_probe(pid, "formal_reasoning", "syllogism_transfer", prompt, "Yes", ["yes", "valid", "classified"], "semantic_match"))
        pid += 1
    while len([p for p in probes if p["domain"] == "formal_reasoning"]) < 30:
        k = len(probes)
        prompt = f"Given: Condition Alpha-{k} implies Beta-{k}. Beta-{k} is false. Is Alpha-{k} false?"
        probes.append(make_probe(pid, "formal_reasoning", "modus_tollens", prompt, "Yes", ["yes", "false"], "semantic_match"))
        pid += 1

    # 4. Novel Science & Physics Transfer (30 probes)
    sci_concepts = [
        ("Stefan-Boltzmann law for radiated power P of blackbody with area A and temperature T", "P = sigma * A * T^4", ["sigma", "T^4", "P ="]),
        ("Bernoulli equation along a streamline for pressure p, density rho, velocity v, and height h", "p + 0.5 * rho * v^2 + rho * g * h = constant", ["0.5 * rho * v^2", "rho * g * h"]),
        ("Coulomb's law for electrostatic force between charges q1, q2 at distance r", "F = k_e * |q1 * q2| / r^2", ["q1", "q2", "r^2"]),
        ("Capacitor charge Q in terms of capacitance C and voltage V", "Q = C * V", ["Q = CV", "C * V"]),
        ("Inductor voltage V_L in terms of inductance L and current rate di/dt", "V_L = L * (di/dt)", ["L * (di/dt)", "di/dt"])
    ]
    for name, form, kws in sci_concepts:
        probes.append(make_probe(pid, "science_engineering", "physics_laws", f"State the formula for {name}.", form, kws, "semantic_match"))
        pid += 1
    while len([p for p in probes if p["domain"] == "science_engineering"]) < 30:
        c_i = len(probes)
        probes.append(make_probe(pid, "science_engineering", "engineering_mechanics", f"What is the mechanical advantage of a lever with effort arm {c_i * 2} m and load arm 2 m?", f"{c_i}", [str(c_i)], "exact_math"))
        pid += 1

    # 5. Novel Hindi & Hinglish Transfer (40 probes)
    hindi_prompts = [
        ("जल ही जीवन का आधार है।", "Water is the basis of life.", ["water", "basis", "life"]),
        ("हवा में बहने वाली ऊर्जा को पवन ऊर्जा कहते हैं।", "Energy flowing in the wind is called wind energy.", ["wind", "energy"]),
        ("विज्ञान और तकनीक मानव विकास के लिए आवश्यक हैं।", "Science and technology are essential for human development.", ["science", "technology", "development"]),
        ("ईमानदारी सबसे अच्छी नीति है।", "Honesty is the best policy.", ["honesty", "policy"]),
        ("प्रकृति का संतुलन बनाए रखना हमारा कर्तव्य है।", "It is our duty to maintain the balance of nature.", ["duty", "balance", "nature"])
    ]
    for h_txt, en_trans, kws in hindi_prompts:
        probes.append(make_probe(pid, "hindi_comprehension", "translation", f"Translate to English: {h_txt}", en_trans, kws, "semantic_match"))
        pid += 1
    while len([p for p in probes if p["domain"] == "hindi_comprehension"]) < 20:
        h_idx = len(probes)
        probes.append(make_probe(pid, "hindi_comprehension", "grammar", f"वाक्य में क्रियापद बताएं: 'रोहन {h_idx} ने पत्र पढ़ा।'", "पढ़ा", ["पढ़ा"], "semantic_match"))
        pid += 1

    hinglish_prompts = [
        ("Kya hum is model ko production mein promote kar sakte hain?", "Jab tak benchmark pass threshold achieve na ho, model ko experimental rakha jayega.", ["benchmark", "experimental", "promote"]),
        ("Training ke dauran RAM usage kaise track karein?", "Task Manager ya PowerShell ke Get-Process command se memory RSS track kar sakte hain.", ["process", "memory", "track"]),
        ("Bhai loss decrease ho raha hai par benchmark fail kyu hua?", "Underfitting ya unigram collapse ki wajah se loss drop ho sakta hai bina reasoning seekhe.", ["underfitting", "reasoning", "loss"]),
        ("Safe restart ke liye kaunsa step follow karna chahiye?", "Pehle checkpoint save karein aur background processes ko safely terminate karein.", ["checkpoint", "save", "terminate"]),
        ("Data leakage prevent karne ke liye kya zaroori hai?", "Training data se test set ke sare prompts aur keywords ko strictly filter karna zaroori hai.", ["filter", "test", "leakage"])
    ]
    for q, a, kws in hinglish_prompts:
        probes.append(make_probe(pid, "hinglish_dialogue", "technical_chat", q, a, kws, "semantic_match"))
        pid += 1
    while len([p for p in probes if p["domain"] == "hinglish_dialogue"]) < 20:
        hg_idx = len(probes)
        probes.append(make_probe(pid, "hinglish_dialogue", "system_prompt", f"System {hg_idx} ka health check update kya hai?", f"System {hg_idx} normal parameters ke andar successfully operate kar raha hai.", ["normal", "operate", "health"], "semantic_match"))
        pid += 1

    # 6. Novel Instruction Following & Multi-turn Context (20 probes)
    for i in range(1, 21):
        prompt = f"Format the following entity name in uppercase and append code ID [V-{i:03d}]: 'sensor node {i}'."
        exp = f"SENSOR NODE {i} [V-{i:03d}]"
        probes.append(make_probe(pid, "instruction_following", "formatting", prompt, exp, [f"SENSOR NODE {i}", f"[V-{i:03d}]"], "semantic_match"))
        pid += 1

    print(f"Total transfer probes generated: {len(probes)}")
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        for p in probes:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    # Record SHA-256
    with open(OUT_FILE, "rb") as f:
        h = hashlib.sha256(f.read()).hexdigest()
    print(f"[OK] Transfer test set written to: {OUT_FILE} (SHA-256: {h})")

if __name__ == "__main__":
    main()
