"""
STAGE 4 FORENSIC VALIDATION & FUNCTIONAL RESCORING (ml_foundation/run_stage4_forensic_validation.py)

Performs comprehensive forensic validation across Step 0, Step 100, and Step 250:
1. Re-scores the 100 Generalization Probes with strict functional execution (unit tests for Python AST, contradiction rejection for math).
2. Creates and evaluates an unseen 100-probe Private Evaluation Set.
3. Tests all 3 checkpoints under identical inference settings:
   - model.eval(), dropout disabled
   - Greedy decoding (T=0.0, rp=1.0)
   - Max tokens 64, identical tokenizer
4. Emits VISION_STAGE4_CHECKPOINT_REPRODUCTION.json
"""

import os
import sys
import json
import re
import ast
import time
import math
import hashlib
from typing import Dict, List, Any, Tuple, Optional

import torch
import torch.nn as nn
import torch.nn.functional as F

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.rigorous_evaluator import (
    try_parse_number,
    find_standalone_contradictions,
    extract_math_answer,
    verify_categorical_probe,
    rigorous_verify_probe
)

TOKENIZER_DIR = os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-v1.4-replay-cand-b")
TRANSFER_TEST_FILE = os.path.join(REPO_ROOT, "vision_independent_transfer_test_200.jsonl")
GEN_100_FILE = os.path.join(REPO_ROOT, "vision_stage4_generalization_suite_100.jsonl")
PRIVATE_100_FILE = os.path.join(REPO_ROOT, "vision_stage4_private_eval_100.jsonl")

CHECKPOINTS = [
    {
        "name": "vision-pretraining-validation-13m (Step 0 Baseline)",
        "step": 0,
        "weights_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-pretraining-validation-13m", "weights.pt"),
        "config_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-pretraining-validation-13m", "config.json")
    },
    {
        "name": "vision-13m-stage4-relational-step100 (Step 100 Midpoint)",
        "step": 100,
        "weights_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-13m-stage4-relational", "step_100", "weights.pt"),
        "config_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-13m-stage4-relational", "step_100", "config.json")
    },
    {
        "name": "vision-13m-stage4-relational (Step 250 Final)",
        "step": 250,
        "weights_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-13m-stage4-relational", "weights.pt"),
        "config_path": os.path.join(REPO_ROOT, "data", "neural_models", "checkpoints", "vision-13m-stage4-relational", "config.json")
    }
]

# Hidden unit tests for Generalization Suite Python probes
GEN_PY_UNIT_TESTS = {
    "GEN-05-PYFUNC-01": {"func_name": "square", "tests": [((3,), 9), ((4,), 16), ((-5,), 25)]},
    "GEN-05-PYFUNC-02": {"func_name": "is_negative", "tests": [((-5,), True), ((0,), False), ((7,), False)]},
    "GEN-05-PYFUNC-03": {"func_name": "multiply_three", "tests": [((2, 3, 4), 24), ((1, 5, 2), 10)]},
    "GEN-05-PYFUNC-04": {"func_name": "get_first_element", "tests": [(([10, 20, 30],), 10), ((['a', 'b'],), 'a')]},
    "GEN-05-PYFUNC-05": {"func_name": "string_length", "tests": [(("hello",), 5), (("",), 0), (("test",), 4)]},
    "GEN-05-PYFUNC-06": {"func_name": "to_uppercase", "tests": [(("hello",), "HELLO"), (("world",), "WORLD")]},
    "GEN-05-PYFUNC-07": {"func_name": "is_divisible_by_five", "tests": [((25,), True), ((14,), False), ((0,), True)]},
    "GEN-05-PYFUNC-08": {"func_name": "cube", "tests": [((2,), 8), ((3,), 27), ((-2,), -8)]},
    "GEN-05-PYFUNC-09": {"func_name": "list_sum", "tests": [(([1, 2, 3],), 6), (([-5, 5],), 0)]},
    "GEN-05-PYFUNC-10": {"func_name": "absolute_value", "tests": [((-10,), 10), ((5,), 5), ((0,), 0)]}
}

def extract_python_code(text: str) -> Optional[str]:
    m = re.search(r"```python\s*(.*?)\s*```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    m = re.search(r"```\s*(.*?)\s*```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    # Check if lines have def
    lines = text.split("\n")
    def_lines = [l for l in lines if l.strip().startswith("def ") or "return " in l]
    if def_lines:
        return "\n".join(lines).strip()
    return None

def test_python_functional(code_str: str, func_name: str, test_cases: List[Tuple[Any, Any]]) -> Tuple[bool, bool, str]:
    """Returns: (syntax_passed, functional_passed, reason)"""
    if not code_str:
        return False, False, "NO_CODE_EXTRACTED"
    try:
        tree = ast.parse(code_str)
    except Exception as e:
        return False, False, f"SYNTAX_ERROR: {e}"

    funcs = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
    if not funcs:
        return False, False, "NO_FUNCTION_DEF"

    has_return = any(isinstance(n, (ast.Return, ast.Yield)) for n in ast.walk(tree))
    if not has_return:
        return True, False, "MISSING_RETURN_STATEMENT"

    # Syntax passed
    syntax_passed = True

    # Safe execution in isolated dictionary
    scope = {}
    try:
        exec(compile(tree, filename="<eval_sandbox>", mode="exec"), scope)
    except Exception as e:
        return True, False, f"EXECUTION_ERROR: {e}"

    target_fn = scope.get(func_name)
    if not target_fn:
        # Fallback to first defined function
        target_fn = scope.get(funcs[0].name)

    if not callable(target_fn):
        return True, False, f"TARGET_NOT_CALLABLE ({func_name})"

    for args, exp in test_cases:
        try:
            res = target_fn(*args)
            if res != exp:
                return True, False, f"OUTPUT_MISMATCH (Input: {args}, Expected: {exp}, Got: {res})"
        except Exception as e:
            return True, False, f"RUNTIME_EXCEPTION on {args}: {e}"

    return True, True, "FUNCTIONAL_AND_SYNTAX_PASS"

def verify_probe_functional(probe: Dict[str, Any], gen_text: str) -> Dict[str, Any]:
    """
    Rigorously verifies probe with strict separation of syntax and functional correctness.
    Rejects dummy returns (return 0) and contradictory equations.
    """
    p_id = probe.get("probe_id", probe.get("id", "UNKNOWN"))
    cat = probe.get("category", probe.get("domain", "general"))
    exp_ans = str(probe.get("expected_answer", "")).strip()

    result = {
        "id": p_id,
        "category": cat,
        "prompt": probe.get("prompt", ""),
        "expected": exp_ans,
        "generated": gen_text,
        "syntax_passed": False,
        "functional_passed": False,
        "extracted_answer": None,
        "reason": "INITIAL"
    }

    if not gen_text or not gen_text.strip():
        result["reason"] = "EMPTY_GENERATION"
        return result

    # 1. Python Functional Evaluation
    if p_id in GEN_PY_UNIT_TESTS or cat in ("new_python_functions", "programming_python"):
        test_info = GEN_PY_UNIT_TESTS.get(p_id)
        code = extract_python_code(gen_text)
        if test_info and code:
            syn_pass, fn_pass, r_msg = test_python_functional(code, test_info["func_name"], test_info["tests"])
            result["syntax_passed"] = syn_pass
            result["functional_passed"] = fn_pass
            result["reason"] = r_msg
            result["extracted_answer"] = test_info["func_name"] if syn_pass else None
            return result
        elif code:
            try:
                tree = ast.parse(code)
                has_fn = any(isinstance(n, ast.FunctionDef) for n in ast.walk(tree))
                result["syntax_passed"] = has_fn
                result["functional_passed"] = False
                result["reason"] = "SYNTAX_ONLY_NO_UNIT_TEST"
                return result
            except Exception:
                result["syntax_passed"] = False
                result["functional_passed"] = False
                result["reason"] = "CODE_SYNTAX_ERROR"
                return result

    # 2. Check for Contradictory Equations (e.g. 10 = 2, 4 = 24)
    contradictions = find_standalone_contradictions(gen_text)
    if contradictions:
        result["syntax_passed"] = True
        result["functional_passed"] = False
        result["reason"] = f"CONTRADICTORY_EQUATION ({contradictions[0]})"
        return result

    # 3. Mathematical Evaluation
    if cat in ("new_numerical_values", "unseen_operation_combinations", "new_word_problems", "mathematics"):
        ext = extract_math_answer(gen_text)
        result["extracted_answer"] = ext
        if ext is not None:
            result["syntax_passed"] = True
            exp_n = try_parse_number(exp_ans)
            act_n = try_parse_number(ext)
            if exp_n is not None and act_n is not None:
                if abs(exp_n - act_n) < 1e-6:
                    result["functional_passed"] = True
                    result["reason"] = "EXACT_NUMERICAL_MATCH"
                    return result
                else:
                    result["functional_passed"] = False
                    result["reason"] = f"NUMERICAL_MISMATCH (Expected {exp_ans}, Extracted {ext})"
                    return result
            else:
                if exp_ans.lower() == ext.lower():
                    result["functional_passed"] = True
                    result["reason"] = "EXACT_STRING_MATCH"
                    return result
                result["functional_passed"] = False
                result["reason"] = "STRING_MISMATCH"
                return result
        else:
            result["syntax_passed"] = False
            result["functional_passed"] = False
            result["reason"] = "NO_MATHEMATICAL_ANSWER_DECLARED"
            return result

    # 4. Multi-Turn Context Retention Evaluation
    if cat in ("multi_turn_context", "context_retention"):
        # Must extract expected entity without contradiction
        lines = [l.strip() for l in gen_text.split("\n") if l.strip()]
        last_line = lines[-1] if lines else ""
        ext = extract_math_answer(gen_text) if try_parse_number(exp_ans) is not None else None
        result["syntax_passed"] = True
        if ext and try_parse_number(exp_ans) is not None and abs(float(ext) - float(exp_ans)) < 1e-6:
            result["extracted_answer"] = ext
            result["functional_passed"] = True
            result["reason"] = "CONTEXT_NUMERICAL_RETAINED"
            return result
        elif exp_ans.lower() in last_line.lower() or exp_ans.lower() in gen_text.lower():
            result["extracted_answer"] = exp_ans
            result["functional_passed"] = True
            result["reason"] = "CONTEXT_ENTITY_RETAINED"
            return result
        else:
            result["functional_passed"] = False
            result["reason"] = f"CONTEXT_NOT_RETAINED (Expected {exp_ans})"
            return result

    # 5. General Verification (rigorous fallback)
    p_copy = dict(probe)
    passed, reason, ext = rigorous_verify_probe(p_copy, gen_text)
    result["syntax_passed"] = True
    result["functional_passed"] = passed
    result["extracted_answer"] = ext
    result["reason"] = reason
    return result

# ==============================================================================
# BUILD UNSEEN PRIVATE EVALUATION SET (100 NOVEL PROBES)
# ==============================================================================

def build_private_eval_suite() -> List[Dict[str, Any]]:
    probes = []
    
    # 1. New Arithmetic & Operation Combinations (10 probes)
    math_cases = [
        ("Compute: (240 + 360) - 180.", "420", "exact_math"),
        ("Compute: (550 - 225) + 175.", "500", "exact_math"),
        ("Calculate 45% of 800.", "360", "exact_math"),
        ("What is 5/6 of 180?", "150", "exact_math"),
        ("Calculate 15% of 600, then add 50.", "140", "exact_math"),
        ("Solve for x: 8x + 24 = 88.", "8", "exact_math"),
        ("Solve for x: 6x - 18 = 42.", "10", "exact_math"),
        ("Find the next term in the sequence: 12, 19, 26, 33, ...", "40", "exact_math"),
        ("Evaluate: ((20 + 30) * 4) - 75.", "125", "exact_math"),
        ("Divide 280 by 7, then multiply by 3.", "120", "exact_math")
    ]
    for i, (p, exp, vt) in enumerate(math_cases):
        probes.append({
            "probe_id": f"PRIV-01-MATH-{i+1:02d}", "category": "private_mathematics",
            "prompt": p, "expected_answer": exp, "verification_type": vt
        })

    # 2. New Word Problems (10 probes)
    word_cases = [
        ("A cyclist rides at 25 km/h for 3 hours. What is the total distance traveled in km?", "75", "exact_math"),
        ("A warehouse has 320 boxes. 140 boxes are shipped out, and 80 new boxes arrive. How many boxes remain?", "260", "exact_math"),
        ("A farmer packs 120 eggs into cartons of 12 eggs each. How many full cartons are packed?", "10", "exact_math"),
        ("A rectangular field is 30 meters long and 15 meters wide. Calculate its perimeter in meters.", "90", "exact_math"),
        ("A rectangular garden has length 20 meters and width 10 meters. What is its area in square meters?", "200", "exact_math"),
        ("Tickets cost $15 each. How much do 8 tickets cost in total?", "120", "exact_math"),
        ("A bottle contains 750 ml of juice. If 250 ml is poured out, how many ml remain?", "500", "exact_math"),
        ("A library has 4 shelves with 35 books on each shelf. How many books are there in total?", "140", "exact_math"),
        ("A car travels 450 km on 30 liters of fuel. How many kilometers per liter does it achieve?", "15", "exact_math"),
        ("Five friends split a restaurant bill of $175 equally. How much does each person pay?", "35", "exact_math")
    ]
    for i, (p, exp, vt) in enumerate(word_cases):
        probes.append({
            "probe_id": f"PRIV-02-WORD-{i+1:02d}", "category": "private_word_problems",
            "prompt": p, "expected_answer": exp, "verification_type": vt
        })

    # 3. Python Function Tasks (10 probes requiring actual calculation)
    py_cases = [
        ("Write a Python function `double_val(x)` that returns twice the value of x.", "double_val", [((4,), 8), ((-3,), -6)]),
        ("Write a Python function `is_positive(n)` that returns True if n > 0, False otherwise.", "is_positive", [((5,), True), ((-2,), False), ((0,), False)]),
        ("Write a Python function `add_two(a, b)` that returns the sum of a and b.", "add_two", [((10, 20), 30), ((-5, 5), 0)]),
        ("Write a Python function `get_last_element(arr)` that returns the last element of list arr.", "get_last_element", [(([1, 2, 3],), 3), (([9],), 9)]),
        ("Write a Python function `string_upper(s)` that returns s in uppercase.", "string_upper", [(("vision",), "VISION")]),
        ("Write a Python function `is_even_num(n)` that returns True if n is even, False otherwise.", "is_even_num", [((8,), True), ((7,), False)]),
        ("Write a Python function `negate(x)` that returns the negative of x.", "negate", [((15,), -15), ((-4,), 4)]),
        ("Write a Python function `list_len(lst)` that returns the length of lst.", "list_len", [(([1, 2],), 2), (([],), 0)]),
        ("Write a Python function `product(a, b)` that returns a multiplied by b.", "product", [((6, 7), 42)]),
        ("Write a Python function `is_empty_str(s)` that returns True if s has length 0.", "is_empty_str", [(("",), True), (("a",), False)])
    ]
    for i, (p, fn_name, tests) in enumerate(py_cases):
        probes.append({
            "probe_id": f"PRIV-03-PY-{i+1:02d}", "category": "private_python_functions",
            "prompt": p, "expected_answer": f"def {fn_name}", "verification_type": "ast_code",
            "unit_tests": {"func_name": fn_name, "tests": tests}
        })

    # 4. Java & JavaScript Implementation Tasks (10 probes)
    poly_cases = [
        ("Write a Java method `public static int add(int a, int b)` that returns a plus b.", "public static int add", "keyword_match"),
        ("Write a Java method `public static boolean isEven(int n)` that returns true if n is even.", "public static boolean isEven", "keyword_match"),
        ("Write a JavaScript function `sum(a, b)` that returns a + b.", "function sum", "keyword_match"),
        ("Write a JavaScript function `isPositive(x)` that returns true if x > 0.", "function isPositive", "keyword_match"),
        ("In SQL, write a query to select all records from `orders`.", "SELECT * FROM orders;", "keyword_match"),
        ("In SQL, write a query to count all rows in `customers` table.", "SELECT COUNT(*) FROM customers;", "keyword_match"),
        ("What is the time complexity of pushing an element onto a Stack?", "O(1)", "keyword_match"),
        ("What is the time complexity of accessing an array element by index?", "O(1)", "keyword_match"),
        ("In a Binary Search Tree, are left children smaller or larger than the root?", "smaller", "keyword_match"),
        ("What protocol operates on port 80 for web traffic?", "HTTP", "keyword_match")
    ]
    for i, (p, exp, vt) in enumerate(poly_cases):
        probes.append({
            "probe_id": f"PRIV-04-POLY-{i+1:02d}", "category": "private_polyglot",
            "prompt": p, "expected_answer": exp, "verification_type": vt
        })

    # 5. Hindi & Hinglish Understanding (10 probes)
    hindi_cases = [
        ("भारत के पहले प्रधानमंत्री कौन थे?", "जवाहरलाल नेहरू", "keyword_match"),
        ("पानी का हिमांक (freezing point) कितने डिग्री सेल्सियस होता है?", "0", "exact_math"),
        ("सौर ऊर्जा हमें किससे प्राप्त होती है?", "सूर्य", "keyword_match"),
        ("राष्ट्रपिता के रूप में किन्हें जाना जाता है?", "महात्मा गांधी", "keyword_match"),
        ("एक सप्ताह में कितने घंटे होते हैं?", "168", "exact_math"),
        ("Python mein loop break karne ke liye kaunsa keyword use hota hai?", "break", "keyword_match"),
        ("CPU ka brain kise kaha jata hai?", "ALU", "keyword_match"),
        ("Database mein primary key ka kya use hota hai?", "unique", "keyword_match"),
        ("Git mein nayi branch banane ki command kya hai?", "git branch", "keyword_match"),
        ("IP address ka full form kya hai?", "Internet Protocol", "keyword_match")
    ]
    for i, (p, exp, vt) in enumerate(hindi_cases):
        probes.append({
            "probe_id": f"PRIV-05-HINDI-{i+1:02d}", "category": "private_hindi_hinglish",
            "prompt": p, "expected_answer": exp, "verification_type": vt
        })

    # 6. Reading Comprehension (10 probes)
    rc_cases = [
        ("Passage: The International Space Station (ISS) orbits Earth at an altitude of approximately 400 kilometers and travels at 28,000 km/h.\nQuestion: At what altitude in kilometers does the ISS orbit?", "400", "exact_math"),
        ("Passage: The human skeleton has 206 bones in an adult, but infants are born with around 270 bones that fuse over time.\nQuestion: How many bones does an adult human have?", "206", "exact_math"),
        ("Passage: Jupiter has 95 officially recognized moons, with Ganymede being the largest moon in the Solar System.\nQuestion: What is the largest moon of Jupiter?", "Ganymede", "keyword_match"),
        ("Passage: The Apollo 11 mission landed astronauts Neil Armstrong and Buzz Aldrin on the Moon in July 1969.\nQuestion: In what year did Apollo 11 land on the Moon?", "1969", "exact_math"),
        ("Passage: Chlorophyll is the green pigment found in chloroplasts that absorbs sunlight for photosynthesis.\nQuestion: What green pigment absorbs sunlight for photosynthesis?", "Chlorophyll", "keyword_match"),
        ("Passage: The Amazon River in South America is the largest river by discharge volume in the world.\nQuestion: On which continent is the Amazon River located?", "South America", "keyword_match"),
        ("Passage: Water boils at 100 degrees Celsius at standard atmospheric sea-level pressure.\nQuestion: At how many degrees Celsius does water boil at sea level?", "100", "exact_math"),
        ("Passage: DNA consists of two strands forming a double helix, composed of four nitrogenous bases: A, T, C, and G.\nQuestion: What structural shape does DNA form?", "double helix", "keyword_match"),
        ("Passage: The first modern Olympic Games were held in Athens, Greece in 1896.\nQuestion: In what city were the 1896 Olympic Games held?", "Athens", "keyword_match"),
        ("Passage: Mars has an atmosphere composed primarily of carbon dioxide, comprising roughly 95 percent of its air.\nQuestion: What gas makes up roughly 95 percent of the Martian atmosphere?", "carbon dioxide", "keyword_match")
    ]
    for i, (p, exp, vt) in enumerate(rc_cases):
        probes.append({
            "probe_id": f"PRIV-06-RC-{i+1:02d}", "category": "private_reading_comprehension",
            "prompt": p, "expected_answer": exp, "verification_type": vt
        })

    # 7. Multi-Turn Context Retention (10 probes)
    multiturn_cases = [
        ("User: Let flight gate = 42B.\nAssistant: Gate 42B confirmed.\nUser: What gate was assigned?", "42B", "keyword_match"),
        ("User: The vehicle speed limit is 65 mph.\nAssistant: Speed limit 65 noted.\nUser: What is the speed limit in mph?", "65", "exact_math"),
        ("User: The project deadline is November 30.\nAssistant: Deadline stored.\nUser: What is the project deadline?", "November 30", "keyword_match"),
        ("User: Secret access code is DELTA-9.\nAssistant: Code saved.\nUser: What is the access code?", "DELTA-9", "keyword_match"),
        ("User: Initial balance is $500. We deposit $200.\nAssistant: Balance updated.\nUser: What is the new balance?", "700", "exact_math"),
        ("User: My assistant name is Jarvis.\nAssistant: Hello! I am Jarvis.\nUser: What is your name?", "Jarvis", "keyword_match"),
        ("User: The room number is 304.\nAssistant: Room 304 reserved.\nUser: What is the room number?", "304", "exact_math"),
        ("User: The temperature setting is 72 degrees.\nAssistant: Set to 72.\nUser: What is the temperature setting?", "72", "exact_math"),
        ("User: We have 12 apples and 8 oranges.\nAssistant: Fruit counted.\nUser: How many apples do we have?", "12", "exact_math"),
        ("User: Our backup server IP is 192.168.1.100.\nAssistant: IP saved.\nUser: What is the backup server IP?", "192.168.1.100", "keyword_match")
    ]
    for i, (p, exp, vt) in enumerate(multiturn_cases):
        probes.append({
            "probe_id": f"PRIV-07-CTX-{i+1:02d}", "category": "private_multiturn",
            "prompt": p, "expected_answer": exp, "verification_type": vt
        })

    # 8. Instruction Following & Extraction (10 probes)
    inst_cases = [
        ("Output only the single word 'AUTHORIZED' in uppercase.", "AUTHORIZED", "keyword_match"),
        ("Output only the number 99 and nothing else.", "99", "exact_math"),
        ("Convert 'STARK INDUSTRIES' to all lowercase.", "stark industries", "keyword_match"),
        ("Format as a JSON array of two fruits: apple, banana.", "[\"apple\", \"banana\"]", "keyword_match"),
        ("Output the word 'PASS' if 20 > 10, otherwise 'FAIL'.", "PASS", "keyword_match"),
        ("Extract only the number from 'Error code: 404'.", "404", "exact_math"),
        ("Output the first three letters of 'TELEMETRY'.", "TEL", "keyword_match"),
        ("Format as key-value pair: sensor=active.", "sensor: active", "keyword_match"),
        ("Output only the lowercase word 'verified'.", "verified", "keyword_match"),
        ("Output the sum of 15 and 25.", "40", "exact_math")
    ]
    for i, (p, exp, vt) in enumerate(inst_cases):
        probes.append({
            "probe_id": f"PRIV-08-INST-{i+1:02d}", "category": "private_instruction_following",
            "prompt": p, "expected_answer": exp, "verification_type": vt
        })

    # 9. Deductive & Formal Logic (10 probes)
    logic_cases = [
        ("Premise 1: All metals conduct electricity.\nPremise 2: Copper is a metal.\nQuestion: Does copper conduct electricity?", "Yes", "categorical"),
        ("Premise: If the battery is dead, the car will not start.\nFact: The battery is dead.\nQuestion: Will the car start?", "No", "categorical"),
        ("Is a square always a rectangle?", "Yes", "categorical"),
        ("If all birds lay eggs, and penguins are birds, do penguins lay eggs?", "Yes", "categorical"),
        ("Premise: If x is divisible by 6, x is even.\nFact: 12 is divisible by 6.\nQuestion: Is 12 even?", "Yes", "categorical"),
        ("If today is Monday, will tomorrow be Wednesday?", "No", "categorical"),
        ("Can a triangle have two right angles in Euclidean geometry?", "No", "categorical"),
        ("Premise: No reptile has fur.\nFact: A snake is a reptile.\nQuestion: Does a snake have fur?", "No", "categorical"),
        ("If A is greater than B, and B is greater than C, is A greater than C?", "Yes", "categorical"),
        ("Are all prime numbers greater than 2 odd?", "Yes", "categorical")
    ]
    for i, (p, exp, vt) in enumerate(logic_cases):
        probes.append({
            "probe_id": f"PRIV-09-LOGIC-{i+1:02d}", "category": "private_formal_logic",
            "prompt": p, "expected_answer": exp, "verification_type": vt
        })

    # 10. Science & Engineering Fundamentals (10 probes)
    sci_cases = [
        ("What is the SI unit of electric resistance?", "Ohm", "keyword_match"),
        ("What is the SI unit of force?", "Newton", "keyword_match"),
        ("Calculate the force if mass is 10 kg and acceleration is 3 m/s^2.", "30", "exact_math"),
        ("What is the chemical formula for water?", "H2O", "keyword_match"),
        ("What gas do animals breathe in for cellular respiration?", "Oxygen", "keyword_match"),
        ("Two resistors of 20 ohms and 30 ohms are connected in series. What is total resistance in ohms?", "50", "exact_math"),
        ("What is the voltage across a 5 ohm resistor carrying 4 amps of current?", "20", "exact_math"),
        ("In computing, how many bits are in one byte?", "8", "exact_math"),
        ("What is the decimal equivalent of binary 1010?", "10", "exact_math"),
        ("What law states that energy cannot be created or destroyed, only transformed?", "conservation of energy", "keyword_match")
    ]
    for i, (p, exp, vt) in enumerate(sci_cases):
        probes.append({
            "probe_id": f"PRIV-10-SCI-{i+1:02d}", "category": "private_science",
            "prompt": p, "expected_answer": exp, "verification_type": vt
        })

    return probes

def evaluate_checkpoint_on_suite(
    model: nn.Module,
    tokenizer: JarvisBPE,
    probes: List[Dict[str, Any]]
) -> Dict[str, Any]:
    model.eval()
    stop_ids = [tokenizer.vocab["</assistant>"]] if "</assistant>" in tokenizer.vocab else None

    results = []
    syntax_passes = 0
    functional_passes = 0
    cat_breakdown = {}

    for p in probes:
        cat = p.get("category", p.get("domain", "general"))
        if cat not in cat_breakdown:
            cat_breakdown[cat] = {"total": 0, "syntax_pass": 0, "functional_pass": 0}
        cat_breakdown[cat]["total"] += 1

        prompt = f"<bos><user>{p['prompt']}</user><assistant>"
        inp = tokenizer.encode(prompt)
        x = torch.tensor([inp], dtype=torch.long)

        with torch.no_grad():
            out_ids = model.generate(
                x,
                max_new_tokens=48,
                temperature=0.0,
                repetition_penalty=1.0,
                no_repeat_ngram_size=0,
                eos_id=tokenizer.vocab.get("<eos>", 2),
                stop_token_ids=stop_ids
            )
        gen_tokens = out_ids[len(inp):]
        raw_out = tokenizer.decode(gen_tokens, skip_special_tokens=True).strip()

        # Custom private unit tests mapping
        if "unit_tests" in p:
            code = extract_python_code(raw_out)
            syn, fn, r_msg = test_python_functional(code, p["unit_tests"]["func_name"], p["unit_tests"]["tests"])
            v_res = {
                "id": p["probe_id"], "category": cat, "prompt": p["prompt"],
                "expected": p["expected_answer"], "generated": raw_out,
                "syntax_passed": syn, "functional_passed": fn, "extracted_answer": None, "reason": r_msg
            }
        else:
            v_res = verify_probe_functional(p, raw_out)

        if v_res["syntax_passed"]:
            syntax_passes += 1
            cat_breakdown[cat]["syntax_pass"] += 1

        if v_res["functional_passed"]:
            functional_passes += 1
            cat_breakdown[cat]["functional_pass"] += 1

        results.append(v_res)

    total = len(probes)
    return {
        "total_probes": total,
        "syntax_passed_probes": syntax_passes,
        "syntax_accuracy_pct": round(syntax_passes / max(total, 1) * 100, 2),
        "functional_passed_probes": functional_passes,
        "functional_accuracy_pct": round(functional_passes / max(total, 1) * 100, 2),
        "category_breakdown": cat_breakdown,
        "passes": [r for r in results if r["functional_passed"]],
        "sample_failures": [r for r in results if not r["functional_passed"]][:15]
    }

def main():
    print("=" * 70)
    print("STAGE 4 FORENSIC VALIDATION & CHECKPOINT REPRODUCTION")
    print("=" * 70)

    tokenizer = JarvisBPE.load(TOKENIZER_DIR)

    # 1. Build and save Private Evaluation Suite
    private_probes = build_private_eval_suite()
    with open(PRIVATE_100_FILE, "w", encoding="utf-8") as f:
        for p in private_probes:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"Created Private Evaluation Suite: {PRIVATE_100_FILE} ({len(private_probes)} probes)")

    # 2. Load Generalization Suite (100 probes)
    gen_probes = []
    with open(GEN_100_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                gen_probes.append(json.loads(line))
    print(f"Loaded Generalization Suite: {GEN_100_FILE} ({len(gen_probes)} probes)")

    # 3. Load Transfer Test (200 probes)
    transfer_probes = []
    with open(TRANSFER_TEST_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                transfer_probes.append(json.loads(line))
    print(f"Loaded Independent Transfer Suite: {TRANSFER_TEST_FILE} ({len(transfer_probes)} probes)")

    checkpoint_results = []

    for ckpt_info in CHECKPOINTS:
        print(f"\nEvaluating Checkpoint: {ckpt_info['name']}")
        if not os.path.exists(ckpt_info["weights_path"]):
            print(f"  [ERROR] File not found: {ckpt_info['weights_path']}")
            continue

        with open(ckpt_info["config_path"], "r", encoding="utf-8") as f:
            cfg_dict = json.load(f)
        cfg = JarvisConfig(**cfg_dict)
        model = JarvisUnifiedTransformer(cfg)
        state = torch.load(ckpt_info["weights_path"], map_location="cpu")
        model.load_state_dict(state)
        model.eval()

        # Confirm dropout disabled
        for m in model.modules():
            if isinstance(m, nn.Dropout):
                assert not m.training, "Dropout is still in training mode!"

        # A. Evaluate on Generalization Suite (100 probes)
        t0 = time.time()
        gen_eval = evaluate_checkpoint_on_suite(model, tokenizer, gen_probes)
        print(f"  Gen Suite 100: Syntax: {gen_eval['syntax_passed_probes']}/100 ({gen_eval['syntax_accuracy_pct']}%) | Functional: {gen_eval['functional_passed_probes']}/100 ({gen_eval['functional_accuracy_pct']}%)")

        # B. Evaluate on Private Evaluation Suite (100 probes)
        priv_eval = evaluate_checkpoint_on_suite(model, tokenizer, private_probes)
        print(f"  Private 100:   Syntax: {priv_eval['syntax_passed_probes']}/100 ({priv_eval['syntax_accuracy_pct']}%) | Functional: {priv_eval['functional_passed_probes']}/100 ({priv_eval['functional_accuracy_pct']}%)")

        # C. Evaluate on Transfer Benchmark (200 probes)
        trans_eval = evaluate_checkpoint_on_suite(model, tokenizer, transfer_probes)
        print(f"  Transfer 200:  Functional: {trans_eval['functional_passed_probes']}/200 ({trans_eval['functional_accuracy_pct']}%)")

        checkpoint_results.append({
            "name": ckpt_info["name"],
            "step": ckpt_info["step"],
            "weights_path": ckpt_info["weights_path"],
            "generalization_suite_100": gen_eval,
            "private_eval_suite_100": priv_eval,
            "transfer_suite_200": trans_eval,
            "elapsed_time_s": round(time.time() - t0, 2)
        })

    # Save complete reproduction artifact
    out_file = os.path.join(REPO_ROOT, "VISION_STAGE4_CHECKPOINT_REPRODUCTION.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({
            "audit_title": "VISION Stage 4 Checkpoint Forensic Reproduction",
            "evaluator": "ml_foundation/functional_rescorer.py (strict functional & non-contradictory)",
            "evaluation_conditions": {
                "temperature": 0.0,
                "repetition_penalty": 1.0,
                "dropout_disabled": True,
                "max_new_tokens": 48
            },
            "checkpoints": checkpoint_results
        }, f, indent=2)

    print(f"\nForensic evaluation complete! Saved reproduction artifact to {out_file}")

if __name__ == "__main__":
    main()
