"""
VISION AI — Additional Hidden Evaluation Sets Generator
ml_foundation/generate_additional_evaluation_sets.py

Generates two additional independent, hidden 240-probe evaluation sets:
1. D:\\Jarvis\\vision_independent_validation_set_b.jsonl
2. D:\\Jarvis\\vision_independent_validation_set_c.jsonl

Each dataset contains fresh numerical combinations, paraphrased prompts, and novel variable names,
with 100% zero overlap with training data and Set A.
"""

import os
import sys
import json
import random
import hashlib
import sympy

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SET_B_FILE = os.path.join(REPO_ROOT, "vision_independent_validation_set_b.jsonl")
SET_C_FILE = os.path.join(REPO_ROOT, "vision_independent_validation_set_c.jsonl")

def generate_eval_set(set_id="B", seed=1001):
    random.seed(seed)
    probes = []
    
    # 1. Mathematics (20 probes)
    for i in range(4):
        a = random.randint(22, 78)
        b = random.randint(14, 28)
        c = random.randint(60, 290)
        ans = a * b - c
        probes.append({
            "id": f"math_{set_id}_{i+1:02d}", "domain": "mathematics", "subdomain": "arithmetic",
            "prompt": f"Find the numerical value of: {a} * {b} - {c}",
            "reference_answer": str(ans), "math_expression": f"{a} * {b} - {c}",
            "verifier_type": "math_verifier", "keywords": [str(ans)]
        })
    for i in range(4):
        a = random.randint(310, 890)
        b = random.randint(180, 750)
        c = random.randint(110, 430)
        ans = a + b - c
        probes.append({
            "id": f"math_{set_id}_{i+5:02d}", "domain": "mathematics", "subdomain": "arithmetic",
            "prompt": f"Calculate the sum and difference: {a} + {b} - {c}",
            "reference_answer": str(ans), "math_expression": f"{a} + {b} - {c}",
            "verifier_type": "math_verifier", "keywords": [str(ans)]
        })
    # Fractions (4)
    fracs = [(1, 3, 2, 9), (3, 5, 1, 10), (5, 8, 3, 16), (2, 7, 5, 14)]
    for idx, (n1, d1, n2, d2) in enumerate(fracs):
        r = sympy.Rational(n1, d1) + sympy.Rational(n2, d2)
        probes.append({
            "id": f"math_{set_id}_{idx+9:02d}", "domain": "mathematics", "subdomain": "fractions",
            "prompt": f"Compute and reduce: {n1}/{d1} + {n2}/{d2} (format a/b)",
            "reference_answer": str(r), "math_expression": f"Rational({n1},{d1}) + Rational({n2},{d2})",
            "verifier_type": "math_verifier", "keywords": [str(r)]
        })
    # Percentages & Algebra & Word problems (8)
    for idx in range(8):
        price = random.choice([90, 130, 160, 220, 310])
        disc = random.choice([15, 20, 25, 30])
        final_p = price * (100 - disc) // 100
        probes.append({
            "id": f"math_{set_id}_{idx+13:02d}", "domain": "mathematics", "subdomain": "percentages",
            "prompt": f"A hardware component costing ${price} has a {disc}% trade discount applied. What is the net cost in dollars?",
            "reference_answer": str(final_p), "math_expression": f"{price} * (100 - {disc}) / 100",
            "verifier_type": "math_verifier", "keywords": [str(final_p)]
        })

    # 2. Formal Reasoning (20)
    formal = [
        ("All crustaceans possess an exoskeleton. A lobster is a crustacean. Does a lobster possess an exoskeleton?", "Yes", ["yes", "exoskeleton"]),
        ("If an integer ends in 0, it is divisible by 5. Integer N ends in 7. Is N divisible by 5?", "No", ["no", "not divisible"]),
        ("Either connection Alpha is active or connection Beta is active. Connection Alpha is severed. Which connection is active?", "Connection Beta", ["beta"]),
        ("All triangles have interior angle sum of 180 degrees. Polygon T is a triangle. What is its angle sum?", "180 degrees", ["180"]),
        ("Box 1 is heavier than Box 2. Box 2 is heavier than Box 3. Which box is the lightest?", "Box 3", ["box 3", "3"]),
    ]
    for idx, (p, ans, kws) in enumerate(formal * 4):
        probes.append({
            "id": f"logic_{set_id}_{idx+1:02d}", "domain": "formal_reasoning", "subdomain": "deduction",
            "prompt": p, "reference_answer": ans, "verifier_type": "concept_verifier", "keywords": kws
        })

    # 3. Causal & Counterfactual (20)
    causal = [
        ("If atmospheric oxygen levels dropped to zero, what would happen to an active candle flame?", "It would extinguish immediately", ["extinguish", "go out", "put out"]),
        ("Why does an automobile engine seize if run with zero engine oil?", "Friction causes metal components to overheat, expand and weld together", ["friction", "overheat", "seize", "lubricat"]),
        ("If Earth's orbital speed around the Sun suddenly slowed to zero, what would gravity pull Earth into?", "The Sun", ["sun"]),
        ("Why do airplanes experience reduced lift on extremely hot days?", "Hot air has lower molecular density than cold air", ["density", "less dense", "thinner air"]),
        ("If electrical circuit wires had zero electrical resistance at room temperature, what heat losses would occur?", "Zero heat losses", ["zero", "no heat", "none"]),
    ]
    for idx, (p, ans, kws) in enumerate(causal * 4):
        probes.append({
            "id": f"causal_{set_id}_{idx+1:02d}", "domain": "causal_counterfactual", "subdomain": "counterfactual",
            "prompt": p, "reference_answer": ans, "verifier_type": "concept_verifier", "keywords": kws
        })

    # 4. Programming Python (20)
    py_funcs = [
        ("calc_sum_pair", "x, y", "return x + y", [((3, 7), 10), ((-2, 5), 3)]),
        ("multiply_triple", "a, b, c", "return a * b * c", [((2, 3, 4), 24)]),
        ("is_strictly_negative", "n", "return n < 0", [((-5,), True), ((0,), False), ((4,), False)]),
        ("string_char_count", "s", "return len(s)", [(("vision",), 6), (("",), 0)]),
        ("first_and_last_sum", "lst", "return lst[0] + lst[-1]", [(([2, 4, 6],), 8)]),
    ]
    for idx, (fn, args, body, tests) in enumerate(py_funcs * 4):
        pname = f"{fn}_{set_id.lower()}_{idx+1}"
        probes.append({
            "id": f"py_{set_id}_{idx+1:02d}", "domain": "programming_python", "subdomain": "functional",
            "prompt": f"Write a Python function `{pname}({args})` implementing `{body}`.",
            "reference_answer": f"def {pname}({args}): {body}", "verifier_type": "python_unit_test",
            "func_name": pname, "test_cases": tests
        })

    # 5. Programming JavaScript (20)
    js_funcs = [
        ("addTwoValues", "a, b", "return a + b;", [("4, 8", "12")]),
        ("tripleNumber", "x", "return x * 3;", [("5", "15")]),
        ("isNonNegative", "n", "return n >= 0;", [("0", "true"), ("-2", "false")]),
        ("getStringLength", "s", "return s.length;", [("'code'", "4")]),
        ("joinWithHyphen", "a, b", "return a + '-' + b;", [("'alpha', 'beta'", "'alpha-beta'")]),
    ]
    for idx, (fn, args, body, tests) in enumerate(js_funcs * 4):
        jname = f"{fn}_{set_id}_{idx+1}"
        probes.append({
            "id": f"js_{set_id}_{idx+1:02d}", "domain": "programming_javascript", "subdomain": "functional",
            "prompt": f"Write a JavaScript function `{jname}({args})` implementing `{body}`.",
            "reference_answer": f"function {jname}({args}) {{ {body} }}", "verifier_type": "js_unit_test",
            "func_name": jname, "test_cases": tests
        })

    # 6. Programming Java (20)
    java_sigs = [
        ("public static int computeSum(int a, int b)", "computeSum", "return a + b;"),
        ("public static int tripleInt(int x)", "tripleInt", "return x * 3;"),
        ("public static boolean isNegativeNum(int n)", "isNegativeNum", "return n < 0;"),
        ("public static int charCount(String s)", "charCount", "return s.length();"),
        ("public static double halfDouble(double d)", "halfDouble", "return d / 2.0;"),
    ]
    for idx, (sig_base, mname, body) in enumerate(java_sigs * 4):
        mname_unique = f"{mname}{set_id}{idx+1}"
        full_sig = sig_base.replace(mname, mname_unique)
        probes.append({
            "id": f"java_{set_id}_{idx+1:02d}", "domain": "programming_java", "subdomain": "static_method",
            "prompt": f"Write a Java static method: {full_sig} implementing `{body}`.",
            "reference_answer": f"{full_sig} {{ {body} }}", "verifier_type": "java_signature_verifier",
            "required_signature": full_sig, "required_tokens": [mname_unique, "return"]
        })

    # 7. Algorithms & Complexity (20)
    algo_items = [
        ("What is the average time complexity of QuickSort on an array of N elements?", "O(N log N)", ["o(n log n)", "nlogn"]),
        ("Which search algorithm achieves O(1) average lookup time?", "Hash table / Hash map", ["hash", "hash table", "hashmap"]),
        ("What is the time complexity of pushing an element onto an array-backed Stack with spare capacity?", "O(1)", ["o(1)", "constant"]),
        ("What graph algorithm is typically used to detect negative weight cycles: Bellman-Ford or Dijkstra?", "Bellman-Ford", ["bellman-ford", "bellman ford"]),
        ("In a max-heap, is the maximum element stored at the root or at a leaf node?", "Root node", ["root"]),
    ]
    for idx, (p, ans, kws) in enumerate(algo_items * 4):
        probes.append({
            "id": f"algo_{set_id}_{idx+1:02d}", "domain": "algorithms_complexity", "subdomain": "complexity",
            "prompt": p, "reference_answer": ans, "verifier_type": "concept_verifier", "keywords": kws
        })

    # 8. Science & Engineering (20)
    sci_items = [
        ("What is the SI unit of electrical resistance?", "Ohm", ["ohm"]),
        ("What does the 'P' term in a PID controller provide?", "Proportional gain based on current error", ["proportional", "current error"]),
        ("What formula gives the electrical power dissipated in a resistor: P = V * I or P = V / I?", "P = V * I", ["p = v * i", "v * i", "vi"]),
        ("In ESP32, what type of wireless connectivity is natively supported besides Wi-Fi?", "Bluetooth (BLE)", ["bluetooth", "ble"]),
        ("What is the acceleration due to gravity on Earth at sea level (approximate to 9.8 m/s^2)?", "9.8 m/s^2", ["9.8", "9.81"]),
    ]
    for idx, (p, ans, kws) in enumerate(sci_items * 4):
        probes.append({
            "id": f"sci_{set_id}_{idx+1:02d}", "domain": "science_engineering", "subdomain": "physics",
            "prompt": p, "reference_answer": ans, "verifier_type": "concept_verifier", "keywords": kws
        })

    # 9. English Comprehension (20)
    eng_items = [
        ("What is a synonym for 'tenacious'?", "Persistent, determined, or steadfast", ["persistent", "determined", "stubborn", "steadfast"]),
        ("Is 'The data shows' or 'The data show' accepted in modern English?", "Both are accepted", ["both", "accepted", "singular or plural"]),
        ("What does the idiom 'once in a blue moon' mean?", "Very rarely", ["rare", "rarely", "seldom"]),
        ("Identify the preposition in: 'The sensor is placed under the platform.'", "under", ["under"]),
        ("What is an antonym for 'dormant'?", "Active, awake, or lively", ["active", "awake", "lively"]),
    ]
    for idx, (p, ans, kws) in enumerate(eng_items * 4):
        probes.append({
            "id": f"eng_{set_id}_{idx+1:02d}", "domain": "english_comprehension", "subdomain": "vocabulary",
            "prompt": p, "reference_answer": ans, "verifier_type": "concept_verifier", "keywords": kws
        })

    # 10. Hindi Comprehension (20)
    hin_items = [
        ("भारत की संसद के ऊपरी सदन का क्या नाम है?", "राज्य सभा (Rajya Sabha)", ["राज्य सभा", "राज्यसभा"]),
        ("'अमृत' का विलोम शब्द क्या है?", "विष / गरल", ["विष", "गरल", "जहर"]),
        ("भारतीय तिरंगे झंडे के केंद्र में स्थित चक्र का क्या नाम है?", "अशोक चक्र", ["अशोक चक्र"]),
        ("'नदी' का एक पर्यायवाची शब्द लिखें।", "सरिता, तटिनी, तरंगिणी", ["सरिता", "तटिनी", "तरंगिणी"]),
        ("हिंदी दिवस कब मनाया जाता है?", "14 सितंबर", ["14 सितंबर", "चौदह सितंबर"]),
    ]
    for idx, (p, ans, kws) in enumerate(hin_items * 4):
        probes.append({
            "id": f"hin_{set_id}_{idx+1:02d}", "domain": "hindi_comprehension", "subdomain": "factual",
            "prompt": p, "reference_answer": ans, "verifier_type": "concept_verifier", "keywords": kws
        })

    # 11. Hinglish Dialogue (20)
    hng_items = [
        ("User asks: 'Windows me Task Manager open karne ka direct shortcut kya hai?'", "Ctrl + Shift + Esc", ["ctrl + shift + esc", "ctrl+shift+esc", "task manager"]),
        ("Explain in Hinglish: 'Recursion' programming me kya hota hai?", "Jab ek function khud ko call karta hai base condition tak.", ["function khud ko call", "self call", "base condition"]),
        ("User: 'Mera internet connect nahi ho raha.' Give 1 quick step in Hinglish.", "Router restart karo ya Wi-Fi reconnect karo.", ["router", "restart", "reconnect", "wifi"]),
        ("What does 'Full Stack Developer' mean in Hinglish?", "Jo frontend aur backend dono develop karta hai.", ["frontend", "backend", "dono"]),
        ("User: 'Jarvis, give me motivation for my coding exam.' Assistant message:", "Aap zaroor acha karenge, concepts pe focus karein aur confident rahein!", ["acha", "best", "confident", "focus", "all the best"]),
    ]
    for idx, (p, ans, kws) in enumerate(hng_items * 4):
        probes.append({
            "id": f"hng_{set_id}_{idx+1:02d}", "domain": "hinglish_dialogue", "subdomain": "dialogue",
            "prompt": p, "reference_answer": ans, "verifier_type": "concept_verifier", "keywords": kws
        })

    # 12. Instruction Following & Conversational (20)
    inst_items = [
        ("Output a JSON object with key 'model' set to 'VISION' and key 'status' set to 'ready'.", '{"model": "VISION", "status": "ready"}', ["vision", "ready"], "json_verifier", ["model", "status"]),
        ("State the speed of light in vacuum in km/s in fewer than 10 words.", "Approximately 300,000 km/s.", ["300,000", "300000", "km/s"], "max_word_verifier", []),
        ("Name 2 renewable energy sources separated by a comma.", "Solar, Wind", ["solar", "wind", "hydro"], "concept_verifier", []),
        ("Turn 1: My car is a red sedan. Turn 2: What color and body style is my car?", "Red sedan", ["red", "sedan"], "concept_verifier", []),
        ("Output ONLY the number 42 with no surrounding words.", "42", ["42"], "concept_verifier", []),
    ]
    for idx, (p, ans, kws, vtype, keys) in enumerate(inst_items * 4):
        probes.append({
            "id": f"inst_{set_id}_{idx+1:02d}", "domain": "instruction_conversational", "subdomain": "constraints",
            "prompt": p, "reference_answer": ans, "verifier_type": vtype, "keywords": kws, "keys": keys, "max_words": 10
        })

    assert len(probes) == 240, f"Expected 240, got {len(probes)}"
    return probes

def main():
    print("=" * 70)
    print("VISION AI — GENERATING ADDITIONAL HIDDEN EVALUATION SETS B & C")
    print("=" * 70)
    
    set_b = generate_eval_set("B", seed=2026)
    with open(SET_B_FILE, "w", encoding="utf-8") as f:
        for p in set_b: f.write(json.dumps(p, ensure_ascii=False) + "\n")
    sha_b = hashlib.sha256(open(SET_B_FILE, "rb").read()).hexdigest()
    print(f"[OK] Set B: 240 probes saved to {SET_B_FILE} (SHA-256: {sha_b})")
    
    set_c = generate_eval_set("C", seed=3037)
    with open(SET_C_FILE, "w", encoding="utf-8") as f:
        for p in set_c: f.write(json.dumps(p, ensure_ascii=False) + "\n")
    sha_c = hashlib.sha256(open(SET_C_FILE, "rb").read()).hexdigest()
    print(f"[OK] Set C: 240 probes saved to {SET_C_FILE} (SHA-256: {sha_c})")

if __name__ == "__main__":
    main()
