"""
VISION — Expanded Held-Out Benchmark & Multi-Domain Capability Evaluator
ml_foundation/expanded_evaluator.py

Comprehensive 120-Probe Evaluation Suite (80 Final Test Probes + 40 Dev Probes) across 10 domains:
1. general_language_multilingual (English, Devanagari Hindi, Latin Hinglish)
2. mathematics_computation (arithmetic, algebra, percentages, geometry)
3. logic_deductive_spatial (syllogisms, counterfactuals, modus tollens, spatial)
4. coding_python_verified (AST parsing + live execution test assertions)
5. coding_polyglot (JavaScript VM, TypeScript, Java, C/C++, SQL, Web HTML/CSS)
6. science_engineering_robotics (physics, ESP32, PID control, kinematics)
7. instruction_following_constraints (negative constraints, format constraints)
8. multi_turn_conversation_memory (context retention, entity tracking, coreference)
9. tool_calling_synthesis (schema adherence, parameter extraction, synthesis)
10. hallucination_uncertainty_handling (unanswerable detection, honest uncertainty)

ZERO CONTAMINATION POLICY:
None of the benchmark canaries may appear in any training data.
"""

from __future__ import annotations

import ast
import datetime
import json
import math
import os
import re
import subprocess
import sys
import time
from typing import Callable, Dict, List, Optional, Tuple, Any

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE


# =========================================================================
# CANARY TOKENS (Must NEVER appear in any training shard)
# =========================================================================
EXPANDED_BENCHMARK_CANARIES: List[str] = [
    # Language
    "mitochondria is the powerhouse", "swatantrata divas", "chai pe charcha",
    "photosynthesis converts solar energy", "dharohar aur sanskriti",
    # Math
    "36 * 14 - 104", "9 * y - 27 = 54", "prism with volume 240", "half life of 12 days",
    # Logic
    "all planetary bodies orbit stars", "socrates is mortal syllogism", "cup inside box inside drawer",
    # Python
    "calculate_median_val", "filter_even_squares", "is_valid_email_str", "flatten_nested_list",
    # Polyglot
    "calculateAverageGrade", "interface RoboticTelemetry", "public static int maxSubarraySum",
    "SELECT customer_name, SUM(amount)", "const filteredUsers = users.filter",
    # Science & Robotics
    "capacitance of 10 microfarads", "kinematic jacobian matrix", "esp32 i2c oled display",
    # Instruction & Memory
    "do not use the letter e", "three bullet points explaining inertia",
    "previous turn mentioned project apex", "user prefers metric units",
    # Tool Calling
    "fetch_stock_quote", "read_hardware_diagnostics",
    # Uncertainty
    "president of mars in 1840", "nobel prize in 1250", "formula for perpetual motion"
]


def _strip_thoughts(text: str) -> str:
    cleaned = re.sub(r"<thought>[\s\S]*?</thought>", "", text)
    cleaned = re.sub(r"</?assistant>", "", cleaned)
    return cleaned.strip()


def _verify_numeric(pred_text: str, expected_val: float, tol: float = 1e-2) -> Tuple[bool, str]:
    raw = _strip_thoughts(pred_text)
    nums = re.findall(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", raw)
    if not nums:
        return False, f"No numeric token found in completion: '{raw[:60]}'"
    for tok in nums:
        try:
            val = float(tok)
            if abs(val - expected_val) <= max(tol, 1e-4 * abs(expected_val)):
                return True, ""
        except ValueError:
            continue
    return False, f"Extracted numbers {nums[:4]} did not match expected {expected_val} (+/- {tol})"


def _verify_python_code(pred_text: str, fn_name: str, assert_script: str) -> Tuple[bool, str]:
    raw = _strip_thoughts(pred_text)
    fence_match = re.search(r"```(?:python)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    code_body = fence_match.group(1).strip() if fence_match else raw.strip()
    try:
        parsed = ast.parse(code_body)
    except Exception as e:
        return False, f"Python AST syntax error: {e}"
    has_fn = any(
        isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == fn_name
        for node in ast.walk(parsed)
    )
    if not has_fn:
        return False, f"AST missing required function 'def {fn_name}(...)'"
    full_exec = f"{code_body}\n\n{assert_script}\n"
    local_env: Dict[str, object] = {}
    try:
        exec(full_exec, {"__builtins__": __builtins__}, local_env)
        return True, ""
    except AssertionError as ae:
        return False, f"Assertion failed: {ae}"
    except Exception as e:
        return False, f"Runtime error: {e}"


def _verify_javascript_code(pred_text: str, fn_name: str, assert_js: str) -> Tuple[bool, str]:
    raw = _strip_thoughts(pred_text)
    fence_match = re.search(r"```(?:javascript|js)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    code_body = fence_match.group(1).strip() if fence_match else raw.strip()
    full_js = f"{code_body}\n\n{assert_js}\n"
    try:
        proc = subprocess.run(
            ["node", "-e", full_js],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=REPO_ROOT
        )
        if proc.returncode == 0:
            return True, ""
        return False, f"Node.js assertion failed: {proc.stderr.strip()[:100]}"
    except Exception as e:
        return False, f"Node.js invocation error: {e}"


def _verify_keywords(pred_text: str, keywords: List[str], min_count: int = 1) -> Tuple[bool, str]:
    clean = _strip_thoughts(pred_text).lower()
    matches = [k for k in keywords if k.lower() in clean]
    if len(matches) >= min_count:
        return True, ""
    return False, f"Found {len(matches)}/{min_count} required keywords from {keywords}: '{clean[:80]}'"


def _verify_tool_json(pred_text: str, expected_tool: str, required_args: List[str]) -> Tuple[bool, str]:
    clean = _strip_thoughts(pred_text)
    match = re.search(r"\{[\s\S]*\}", clean)
    if not match:
        return False, f"No JSON block found in output: '{clean[:60]}'"
    try:
        data = json.loads(match.group(0))
        if data.get("tool") != expected_tool:
            return False, f"Tool name '{data.get('tool')}' != expected '{expected_tool}'"
        args = data.get("arguments", {})
        missing = [a for a in required_args if a not in args]
        if missing:
            return False, f"Missing required arguments: {missing}"
        return True, ""
    except Exception as e:
        return False, f"JSON parse error: {e}"


def _verify_uncertainty_refusal(pred_text: str) -> Tuple[bool, str]:
    clean = _strip_thoughts(pred_text).lower()
    refusal_cues = [
        "cannot", "can't", "unknown", "impossible", "does not exist", "did not exist",
        "never existed", "unanswerable", "fictional", "hypothetical", "no record",
        "not possible", "uncertain", "no such"
    ]
    if any(cue in clean for cue in refusal_cues):
        return True, ""
    return False, f"Model failed to express uncertainty/refusal on unanswerable question: '{clean[:80]}'"


# =========================================================================
# PROBE DEFINITIONS: 80 HELD-OUT TEST PROBES
# =========================================================================
def build_test_probes() -> List[Dict[str, Any]]:
    probes = [
        # Domain 1: General Language & Multilingual (8 probes)
        {
            "id": "lang_en_01",
            "domain": "general_language_multilingual",
            "prompt": "Explain what photosynthesis is and why it is vital for terrestrial life.",
            "expected": "Mentions sunlight/light, chlorophyll/plants, oxygen/glucose",
            "verifier": lambda txt: _verify_keywords(txt, ["light", "sun", "oxygen", "plant", "glucose", "energy"], min_count=2)
        },
        {
            "id": "lang_en_02",
            "domain": "general_language_multilingual",
            "prompt": "What is the primary role of mitochondria in eukaryotic cells?",
            "expected": "Powerhouse / ATP / energy production",
            "verifier": lambda txt: _verify_keywords(txt, ["powerhouse", "atp", "energy", "cellular"], min_count=2)
        },
        {
            "id": "lang_hi_01",
            "domain": "general_language_multilingual",
            "prompt": "हिंदी में बताएं कि सौर ऊर्जा (Solar Energy) का क्या महत्व है?",
            "expected": "सूर्य / बिजली / पर्यावरण / ऊर्जा (Hindi)",
            "verifier": lambda txt: _verify_keywords(txt, ["सूर्य", "ऊर्जा", "बिजली", "पर्यावरण", "प्रदूषण"], min_count=2)
        },
        {
            "id": "lang_hi_02",
            "domain": "general_language_multilingual",
            "prompt": "कंप्यूटर में RAM और ROM के बीच क्या मुख्य अंतर है?",
            "expected": "अस्थायी / स्थायी / मेमोरी / वोलेटाइल",
            "verifier": lambda txt: _verify_keywords(txt, ["मेमोरी", "डेटा", "अस्थायी", "स्थायी", "वोलेटाइल", "संग्रह"], min_count=2)
        },
        {
            "id": "lang_hinglish_01",
            "domain": "general_language_multilingual",
            "prompt": "Hinglish me samjhao ki debugging ka kya matlab hota hai software engineering me?",
            "expected": "Errors / bugs ko dhundna aur fix karna",
            "verifier": lambda txt: _verify_keywords(txt, ["bug", "error", "fix", "code", "problem", "solve"], min_count=2)
        },
        {
            "id": "lang_hinglish_02",
            "domain": "general_language_multilingual",
            "prompt": "Cloud computing ke main fayde Hinglish me batao.",
            "expected": "Storage, scalability, internet se access",
            "verifier": lambda txt: _verify_keywords(txt, ["server", "storage", "data", "internet", "scale", "access"], min_count=2)
        },
        {
            "id": "lang_grammar_01",
            "domain": "general_language_multilingual",
            "prompt": "Identify and correct the grammatical error: 'She do not goes to school yesterday.'",
            "expected": "Did not go",
            "verifier": lambda txt: _verify_keywords(txt, ["did not go", "didn't go", "went"], min_count=1)
        },
        {
            "id": "lang_summarize_01",
            "domain": "general_language_multilingual",
            "prompt": "Summarize in one sentence: A compiler translates source code written in a high-level programming language into machine code or bytecode that a computer's central processor can execute directly.",
            "expected": "Compiler converts high-level code to machine-executable instructions",
            "verifier": lambda txt: _verify_keywords(txt, ["compiler", "translates", "code", "machine", "execut"], min_count=2)
        },

        # Domain 2: Mathematics & Computation (8 probes)
        {
            "id": "math_01",
            "domain": "mathematics_computation",
            "prompt": "What is 36 * 14 - 104?",
            "expected": "400",
            "verifier": lambda txt: _verify_numeric(txt, 400.0)
        },
        {
            "id": "math_02",
            "domain": "mathematics_computation",
            "prompt": "Solve for y: 9 * y - 27 = 54.",
            "expected": "9",
            "verifier": lambda txt: _verify_numeric(txt, 9.0)
        },
        {
            "id": "math_03",
            "domain": "mathematics_computation",
            "prompt": "A laptop originally priced at $800 is on a 15% discount. What is the final sale price?",
            "expected": "680",
            "verifier": lambda txt: _verify_numeric(txt, 680.0)
        },
        {
            "id": "math_04",
            "domain": "mathematics_computation",
            "prompt": "A car travels 210 miles in 3.5 hours. What is its average speed in miles per hour?",
            "expected": "60",
            "verifier": lambda txt: _verify_numeric(txt, 60.0)
        },
        {
            "id": "math_05",
            "domain": "mathematics_computation",
            "prompt": "What is the volume of a rectangular prism with length 10 cm, width 6 cm, and height 4 cm?",
            "expected": "240",
            "verifier": lambda txt: _verify_numeric(txt, 240.0)
        },
        {
            "id": "math_06",
            "domain": "mathematics_computation",
            "prompt": "If a radioactive substance has a half-life of 12 days, how many grams of a 160-gram sample remain after 36 days?",
            "expected": "20",
            "verifier": lambda txt: _verify_numeric(txt, 20.0)
        },
        {
            "id": "math_07",
            "domain": "mathematics_computation",
            "prompt": "What is 5/8 as a decimal?",
            "expected": "0.625",
            "verifier": lambda txt: _verify_numeric(txt, 0.625)
        },
        {
            "id": "math_08",
            "domain": "mathematics_computation",
            "prompt": "In a class of 40 students, 60% are girls. How many boys are in the class?",
            "expected": "16",
            "verifier": lambda txt: _verify_numeric(txt, 16.0)
        },

        # Domain 3: Logic, Deductive & Spatial Reasoning (8 probes)
        {
            "id": "logic_01",
            "domain": "logic_deductive_spatial",
            "prompt": "Premise 1: All planetary bodies orbit stars. Premise 2: Kepler-22b is a planetary body. Conclusion: Does Kepler-22b orbit a star?",
            "expected": "Yes / affirms conclusion",
            "verifier": lambda txt: _verify_keywords(txt, ["yes", "does orbit", "orbits a star", "true", "correct"], min_count=1)
        },
        {
            "id": "logic_02",
            "domain": "logic_deductive_spatial",
            "prompt": "If it rains, the grass gets wet. The grass is completely dry. Did it rain? Answer Yes or No and explain.",
            "expected": "No (Modus Tollens)",
            "verifier": lambda txt: _verify_keywords(txt, ["no", "did not rain", "didn't rain"], min_count=1)
        },
        {
            "id": "logic_03",
            "domain": "logic_deductive_spatial",
            "prompt": "A small blue cup is placed inside a metal box. The metal box is placed inside a wooden drawer. Where is the small blue cup?",
            "expected": "Inside the metal box / inside the drawer",
            "verifier": lambda txt: _verify_keywords(txt, ["box", "drawer", "inside"], min_count=2)
        },
        {
            "id": "logic_04",
            "domain": "logic_deductive_spatial",
            "prompt": "Maya is older than Ethan. Ethan is older than Liam. Who is the youngest?",
            "expected": "Liam",
            "verifier": lambda txt: _verify_keywords(txt, ["liam"], min_count=1)
        },
        {
            "id": "logic_05",
            "domain": "logic_deductive_spatial",
            "prompt": "A robot faces North. It rotates 90 degrees clockwise, then 180 degrees counter-clockwise. Which direction is the robot facing now?",
            "expected": "West",
            "verifier": lambda txt: _verify_keywords(txt, ["west"], min_count=1)
        },
        {
            "id": "logic_06",
            "domain": "logic_deductive_spatial",
            "prompt": "Ice cream sales and drowning rates both increase in summer. Does eating ice cream cause drowning?",
            "expected": "No, correlation does not imply causation / third variable (heat/summer)",
            "verifier": lambda txt: _verify_keywords(txt, ["no", "correlation", "cause", "summer", "weather", "heat"], min_count=2)
        },
        {
            "id": "logic_07",
            "domain": "logic_deductive_spatial",
            "prompt": "If all roses are flowers and some flowers fade quickly, does it follow logically that all roses fade quickly?",
            "expected": "No, does not follow logically",
            "verifier": lambda txt: _verify_keywords(txt, ["no", "does not follow", "invalid", "not necessarily"], min_count=1)
        },
        {
            "id": "logic_08",
            "domain": "logic_deductive_spatial",
            "prompt": "Box A has 5 red balls. Box B has 3 blue balls. You transfer 2 balls from Box A to Box B. How many total balls are in Box B now?",
            "expected": "5",
            "verifier": lambda txt: _verify_numeric(txt, 5.0)
        },

        # Domain 4: Coding - Python Verified (8 probes)
        {
            "id": "code_py_01",
            "domain": "coding_python_verified",
            "prompt": "Write a Python function calculate_median_val(nums) that returns the median of a non-empty list of numbers.",
            "expected": "Python function returning median",
            "verifier": lambda txt: _verify_python_code(
                txt, "calculate_median_val",
                "assert calculate_median_val([3, 1, 2]) == 2\nassert calculate_median_val([4, 1, 3, 2]) == 2.5"
            )
        },
        {
            "id": "code_py_02",
            "domain": "coding_python_verified",
            "prompt": "Write a Python function filter_even_squares(nums) that returns a list of squares of even numbers only.",
            "expected": "Python function returning [x**2 for x in nums if x % 2 == 0]",
            "verifier": lambda txt: _verify_python_code(
                txt, "filter_even_squares",
                "assert filter_even_squares([1, 2, 3, 4]) == [4, 16]\nassert filter_even_squares([1, 3, 5]) == []"
            )
        },
        {
            "id": "code_py_03",
            "domain": "coding_python_verified",
            "prompt": "Write a Python function flatten_nested_list(nested) that flattens a list of lists into a single 1D list.",
            "expected": "Python function flattening 2D list",
            "verifier": lambda txt: _verify_python_code(
                txt, "flatten_nested_list",
                "assert flatten_nested_list([[1, 2], [3, 4], [5]]) == [1, 2, 3, 4, 5]\nassert flatten_nested_list([]) == []"
            )
        },
        {
            "id": "code_py_04",
            "domain": "coding_python_verified",
            "prompt": "Write a Python function is_valid_email_str(email) returning True if it contains '@' and '.', with '@' before '.', else False.",
            "expected": "Python function checking email format",
            "verifier": lambda txt: _verify_python_code(
                txt, "is_valid_email_str",
                "assert is_valid_email_str('test@example.com') is True\nassert is_valid_email_str('invalid.email') is False"
            )
        },
        {
            "id": "code_py_05",
            "domain": "coding_python_verified",
            "prompt": "Write a Python function word_frequencies(text) returning a dict mapping each lowercase word to its count.",
            "expected": "Python function returning word count dict",
            "verifier": lambda txt: _verify_python_code(
                txt, "word_frequencies",
                "res = word_frequencies('Hello hello world')\nassert res['hello'] == 2 and res['world'] == 1"
            )
        },
        {
            "id": "code_py_06",
            "domain": "coding_python_verified",
            "prompt": "Write a Python function fibonacci_nth(n) that returns the n-th Fibonacci number (where fib(0)=0, fib(1)=1).",
            "expected": "Python function returning fib(n)",
            "verifier": lambda txt: _verify_python_code(
                txt, "fibonacci_nth",
                "assert fibonacci_nth(0) == 0\nassert fibonacci_nth(1) == 1\nassert fibonacci_nth(7) == 13"
            )
        },
        {
            "id": "code_py_07",
            "domain": "coding_python_verified",
            "prompt": "Write a Python function clamp_val(val, min_val, max_val) that clamps val within [min_val, max_val].",
            "expected": "Python function clamping value",
            "verifier": lambda txt: _verify_python_code(
                txt, "clamp_val",
                "assert clamp_val(5, 0, 10) == 5\nassert clamp_val(-2, 0, 10) == 0\nassert clamp_val(15, 0, 10) == 10"
            )
        },
        {
            "id": "code_py_08",
            "domain": "coding_python_verified",
            "prompt": "Write a Python function reverse_string_words(s) returning string with words in reverse order.",
            "expected": "Python function reversing word order",
            "verifier": lambda txt: _verify_python_code(
                txt, "reverse_string_words",
                "assert reverse_string_words('apple banana cherry') == 'cherry banana apple'"
            )
        },

        # Domain 5: Coding - Polyglot (JS/TS/Java/C/SQL/Web) (8 probes)
        {
            "id": "code_js_01",
            "domain": "coding_polyglot",
            "prompt": "Write a JavaScript function calculateAverageGrade(grades) returning the arithmetic mean of an array of numbers.",
            "expected": "JS function calculateAverageGrade",
            "verifier": lambda txt: _verify_javascript_code(
                txt, "calculateAverageGrade",
                "const assert = require('assert');\nassert.strictEqual(calculateAverageGrade([80, 90, 100]), 90);"
            )
        },
        {
            "id": "code_js_02",
            "domain": "coding_polyglot",
            "prompt": "Write a JavaScript function removeDuplicatesArr(arr) that returns a new array with all duplicates removed.",
            "expected": "JS function removeDuplicatesArr",
            "verifier": lambda txt: _verify_javascript_code(
                txt, "removeDuplicatesArr",
                "const assert = require('assert');\nassert.deepStrictEqual(removeDuplicatesArr([1, 2, 2, 3, 1]), [1, 2, 3]);"
            )
        },
        {
            "id": "code_ts_01",
            "domain": "coding_polyglot",
            "prompt": "Define a TypeScript interface named RoboticTelemetry containing fields: deviceId (string), batteryLevel (number), and isOnline (boolean).",
            "expected": "TypeScript interface RoboticTelemetry",
            "verifier": lambda txt: _verify_keywords(txt, ["interface RoboticTelemetry", "deviceId", "batteryLevel", "isOnline", "string", "number", "boolean"], min_count=5)
        },
        {
            "id": "code_java_01",
            "domain": "coding_polyglot",
            "prompt": "Write a Java public static method maxSubarraySum(int[] arr) or signature in a class.",
            "expected": "Java method signature public static int",
            "verifier": lambda txt: _verify_keywords(txt, ["public static int", "maxSubarraySum", "int[]"], min_count=2)
        },
        {
            "id": "code_c_01",
            "domain": "coding_polyglot",
            "prompt": "Write a C function swap_ints(int *a, int *b) that swaps two integers using pointers.",
            "expected": "C function with pointer swap logic",
            "verifier": lambda txt: _verify_keywords(txt, ["void swap_ints", "int *", "*a", "*b", "temp"], min_count=3)
        },
        {
            "id": "code_sql_01",
            "domain": "coding_polyglot",
            "prompt": "Write an SQL query to find the total amount spent per customer from an orders table, grouping by customer_id and ordering descending.",
            "expected": "SELECT customer_id, SUM(amount) FROM orders GROUP BY customer_id ORDER BY",
            "verifier": lambda txt: _verify_keywords(txt, ["select", "sum(", "from orders", "group by customer_id", "order by"], min_count=4)
        },
        {
            "id": "code_sql_02",
            "domain": "coding_polyglot",
            "prompt": "Write an SQL query to retrieve employee names and department names using an INNER JOIN between employees and departments on department_id.",
            "expected": "SELECT e.name, d.name FROM employees INNER JOIN departments ON",
            "verifier": lambda txt: _verify_keywords(txt, ["select", "join", "on", "department_id"], min_count=3)
        },
        {
            "id": "code_web_01",
            "domain": "coding_polyglot",
            "prompt": "Write HTML5 markup for an accessible contact form with name, email input, submit button, and associated label tags.",
            "expected": "HTML5 form with <form>, <label>, <input type='email'>, <button>",
            "verifier": lambda txt: _verify_keywords(txt, ["<form", "<label", "<input", "type=\"email\"", "<button"], min_count=3)
        },

        # Domain 6: Science, Engineering & Robotics (8 probes)
        {
            "id": "sci_01",
            "domain": "science_engineering_robotics",
            "prompt": "A 24V DC circuit draws 3 Amperes of current. What is the total electrical resistance of the circuit in Ohms? Use V = I * R.",
            "expected": "8",
            "verifier": lambda txt: _verify_numeric(txt, 8.0)
        },
        {
            "id": "sci_02",
            "domain": "science_engineering_robotics",
            "prompt": "What is the mechanical work done in Joules when a constant force of 120 Newtons moves an object across a distance of 5 meters? Use W = F * d.",
            "expected": "600",
            "verifier": lambda txt: _verify_numeric(txt, 600.0)
        },
        {
            "id": "sci_03",
            "domain": "science_engineering_robotics",
            "prompt": "In an ESP32 microcontroller, what peripheral interface is commonly used to communicate with an I2C OLED display using SDA and SCL pins?",
            "expected": "I2C (Inter-Integrated Circuit) / Two-Wire",
            "verifier": lambda txt: _verify_keywords(txt, ["i2c", "inter-integrated", "two-wire", "wire.h"], min_count=1)
        },
        {
            "id": "sci_04",
            "domain": "science_engineering_robotics",
            "prompt": "In a PID controller for robotic joint position control, what is the role of the Integral (I) term?",
            "expected": "Eliminating steady-state error by accumulating past error",
            "verifier": lambda txt: _verify_keywords(txt, ["steady-state", "steady state", "accumulat", "past error", "offset"], min_count=1)
        },
        {
            "id": "sci_05",
            "domain": "science_engineering_robotics",
            "prompt": "What is the function of an H-bridge circuit in DC motor control?",
            "expected": "Bidirectional motor control / reverse direction and speed regulation",
            "verifier": lambda txt: _verify_keywords(txt, ["direction", "bidirectional", "reverse", "forward", "polarity"], min_count=1)
        },
        {
            "id": "sci_06",
            "domain": "science_engineering_robotics",
            "prompt": "A capacitor of 10 microfarads (10e-6 F) is charged to a potential difference of 50 Volts. What is the stored electrical energy in Joules? Use E = 0.5 * C * V^2.",
            "expected": "0.0125",
            "verifier": lambda txt: _verify_numeric(txt, 0.0125, tol=0.001)
        },
        {
            "id": "sci_07",
            "domain": "science_engineering_robotics",
            "prompt": "What mathematical matrix maps robotic joint velocities to end-effector Cartesian linear and angular velocities?",
            "expected": "Jacobian matrix",
            "verifier": lambda txt: _verify_keywords(txt, ["jacobian"], min_count=1)
        },
        {
            "id": "sci_08",
            "domain": "science_engineering_robotics",
            "prompt": "Explain why flyback (freewheeling) diodes are placed across inductive relay coils in microcontroller circuits.",
            "expected": "Suppress voltage spikes / back-EMF / protect switching transistors",
            "verifier": lambda txt: _verify_keywords(txt, ["back-emf", "spike", "voltage", "induct", "protect", "transistor"], min_count=2)
        },

        # Domain 7: Instruction Following & Constraints (8 probes)
        {
            "id": "inst_01",
            "domain": "instruction_following_constraints",
            "prompt": "List exactly 3 benefits of solar energy as a numbered list. Do not write an introductory or concluding sentence.",
            "expected": "Numbered list with 1., 2., 3.",
            "verifier": lambda txt: _verify_keywords(txt, ["1.", "2.", "3."], min_count=3)
        },
        {
            "id": "inst_02",
            "domain": "instruction_following_constraints",
            "prompt": "Write a short description of an apple without using the letter 'e'.",
            "expected": "Description without letter e",
            "verifier": lambda txt: (
                "e" not in _strip_thoughts(txt).lower() and len(_strip_thoughts(txt)) > 10,
                f"Contains letter 'e' or too short: '{_strip_thoughts(txt)[:40]}'"
            )
        },
        {
            "id": "inst_03",
            "domain": "instruction_following_constraints",
            "prompt": "Respond with ONLY a JSON object containing keys: 'status' with value 'active' and 'code' with value 200.",
            "expected": "{\"status\": \"active\", \"code\": 200}",
            "verifier": lambda txt: (
                "status" in txt and "active" in txt and "200" in txt,
                f"Missing status:active or code:200: '{txt[:60]}'"
            )
        },
        {
            "id": "inst_04",
            "domain": "instruction_following_constraints",
            "prompt": "Provide a markdown table comparing 'TCP' and 'UDP' with columns: Protocol, Connection Type, and Speed.",
            "expected": "Markdown table with columns",
            "verifier": lambda txt: _verify_keywords(txt, ["|", "Protocol", "Connection", "Speed", "TCP", "UDP"], min_count=4)
        },
        {
            "id": "inst_05",
            "domain": "instruction_following_constraints",
            "prompt": "Answer in exactly one word: What is the capital of Japan?",
            "expected": "Tokyo",
            "verifier": lambda txt: (
                "tokyo" in _strip_thoughts(txt).lower() and len(_strip_thoughts(txt).split()) <= 3,
                f"Expected single word 'Tokyo', got: '{_strip_thoughts(txt)[:40]}'"
            )
        },
        {
            "id": "inst_06",
            "domain": "instruction_following_constraints",
            "prompt": "Explain Newton's First Law. Include the exact phrase 'inertia of motion' in your response.",
            "expected": "Contains exact phrase 'inertia of motion'",
            "verifier": lambda txt: _verify_keywords(txt, ["inertia of motion"], min_count=1)
        },
        {
            "id": "inst_07",
            "domain": "instruction_following_constraints",
            "prompt": "Write a sentence where every word starts with the letter 's'. (At least 4 words).",
            "expected": "At least 4 words all starting with 's'",
            "verifier": lambda txt: (
                all(w.startswith("s") for w in re.findall(r"[a-zA-Z]+", _strip_thoughts(txt).lower()))
                and len(re.findall(r"[a-zA-Z]+", _strip_thoughts(txt))) >= 4,
                f"Not all words start with s: '{_strip_thoughts(txt)[:50]}'"
            )
        },
        {
            "id": "inst_08",
            "domain": "instruction_following_constraints",
            "prompt": "Convert this sentence to uppercase: 'Autonomous artificial intelligence requires safety.'",
            "expected": "AUTONOMOUS ARTIFICIAL INTELLIGENCE REQUIRES SAFETY.",
            "verifier": lambda txt: (
                "AUTONOMOUS ARTIFICIAL INTELLIGENCE REQUIRES SAFETY" in _strip_thoughts(txt),
                f"Expected uppercase sentence, got: '{_strip_thoughts(txt)[:50]}'"
            )
        },

        # Domain 8: Multi-Turn Conversation & Memory (8 probes)
        {
            "id": "mem_01",
            "domain": "multi_turn_conversation_memory",
            "prompt": "User: Hi, my favorite framework is PyTorch.\nAssistant: Nice to know!\nUser: Which framework did I say was my favorite?",
            "expected": "PyTorch",
            "verifier": lambda txt: _verify_keywords(txt, ["pytorch"], min_count=1)
        },
        {
            "id": "mem_02",
            "domain": "multi_turn_conversation_memory",
            "prompt": "User: I am working on Project Apex in Bengaluru.\nAssistant: Understood.\nUser: Where am I located?",
            "expected": "Bengaluru / Bangalore",
            "verifier": lambda txt: _verify_keywords(txt, ["bengaluru", "bangalore"], min_count=1)
        },
        {
            "id": "mem_03",
            "domain": "multi_turn_conversation_memory",
            "prompt": "User: My dog's name is Bruno and my cat's name is Luna.\nAssistant: Got it.\nUser: What is my cat's name?",
            "expected": "Luna",
            "verifier": lambda txt: _verify_keywords(txt, ["luna"], min_count=1)
        },
        {
            "id": "mem_04",
            "domain": "multi_turn_conversation_memory",
            "prompt": "User: Let variable x = 45.\nAssistant: x is set to 45.\nUser: Add 15 to it. What is the new value of x?",
            "expected": "60",
            "verifier": lambda txt: _verify_numeric(txt, 60.0)
        },
        {
            "id": "mem_05",
            "domain": "multi_turn_conversation_memory",
            "prompt": "User: I prefer all temperature readings in Celsius.\nAssistant: Recorded.\nUser: If it is 25 degrees outside, which unit should you report it in?",
            "expected": "Celsius",
            "verifier": lambda txt: _verify_keywords(txt, ["celsius", "°c", "c"], min_count=1)
        },
        {
            "id": "mem_06",
            "domain": "multi_turn_conversation_memory",
            "prompt": "User: We need to buy milk, bread, and eggs.\nAssistant: Shopping list saved.\nUser: We already bought bread. What two items are left?",
            "expected": "Milk and eggs",
            "verifier": lambda txt: _verify_keywords(txt, ["milk", "eggs"], min_count=2)
        },
        {
            "id": "mem_07",
            "domain": "multi_turn_conversation_memory",
            "prompt": "User: My server IP is 192.168.1.105 and SSH port is 2222.\nAssistant: Noted.\nUser: Which port should I use to SSH into my server?",
            "expected": "2222",
            "verifier": lambda txt: _verify_keywords(txt, ["2222"], min_count=1)
        },
        {
            "id": "mem_08",
            "domain": "multi_turn_conversation_memory",
            "prompt": "User: Alice reports to Bob. Bob reports to Charlie.\nAssistant: Organizational hierarchy noted.\nUser: Who is Alice's direct manager?",
            "expected": "Bob",
            "verifier": lambda txt: _verify_keywords(txt, ["bob"], min_count=1)
        },

        # Domain 9: Tool Calling & Result Synthesis (8 probes)
        {
            "id": "tool_01",
            "domain": "tool_calling_synthesis",
            "prompt": "Available tools: [get_weather(city)]. User says: 'What is the weather in Mumbai?' Emit JSON.",
            "expected": "JSON {\"tool\": \"get_weather\", \"arguments\": {\"city\": \"Mumbai\"}}",
            "verifier": lambda txt: _verify_tool_json(txt, "get_weather", ["city"])
        },
        {
            "id": "tool_02",
            "domain": "tool_calling_synthesis",
            "prompt": "Available tools: [set_alarm(time, label)]. User says: 'Set an alarm for 07:00 AM labeled Workout.' Emit JSON.",
            "expected": "JSON {\"tool\": \"set_alarm\", \"arguments\": {\"time\": \"07:00 AM\", \"label\": \"Workout\"}}",
            "verifier": lambda txt: _verify_tool_json(txt, "set_alarm", ["time", "label"])
        },
        {
            "id": "tool_03",
            "domain": "tool_calling_synthesis",
            "prompt": "Available tools: [search_web(query, max_results)]. User says: 'Search for quantum computing advancements 2026.' Emit JSON.",
            "expected": "JSON with tool search_web",
            "verifier": lambda txt: _verify_tool_json(txt, "search_web", ["query"])
        },
        {
            "id": "tool_04",
            "domain": "tool_calling_synthesis",
            "prompt": "Available tools: [calculate_math(expression)]. User says: 'Calculate 145 * 82 - 320.' Emit JSON.",
            "expected": "JSON with tool calculate_math",
            "verifier": lambda txt: _verify_tool_json(txt, "calculate_math", ["expression"])
        },
        {
            "id": "tool_05",
            "domain": "tool_calling_synthesis",
            "prompt": "Available tools: [read_system_metrics(metric)]. User says: 'Check current CPU utilization.' Emit JSON.",
            "expected": "JSON with tool read_system_metrics",
            "verifier": lambda txt: _verify_tool_json(txt, "read_system_metrics", ["metric"])
        },
        {
            "id": "tool_06",
            "domain": "tool_calling_synthesis",
            "prompt": "Verified Tool Output: {'city': 'Delhi', 'temp_c': 28, 'condition': 'Sunny'}. Explain this result naturally to the user.",
            "expected": "Natural response stating 28 degrees and sunny in Delhi",
            "verifier": lambda txt: _verify_keywords(txt, ["delhi", "28", "sunny"], min_count=2)
        },
        {
            "id": "tool_07",
            "domain": "tool_calling_synthesis",
            "prompt": "Verified Tool Output: {'status': 'SUCCESS', 'backup_path': 'D:/Jarvis/backups/backup_01.tar.gz', 'size_mb': 150}. Inform user.",
            "expected": "Natural response stating backup completed successfully (150 MB)",
            "verifier": lambda txt: _verify_keywords(txt, ["backup", "success", "150"], min_count=2)
        },
        {
            "id": "tool_08",
            "domain": "tool_calling_synthesis",
            "prompt": "Verified Tool Output: {'error': 'AUTHENTICATION_REQUIRED', 'service': 'Google Calendar'}. Explain clearly and ask user to authenticate.",
            "expected": "Explanation that Google Calendar requires authentication / sign-in",
            "verifier": lambda txt: _verify_keywords(txt, ["calendar", "auth", "sign-in", "login", "permission"], min_count=2)
        },

        # Domain 10: Hallucination & Uncertainty Handling (8 probes)
        {
            "id": "halluc_01",
            "domain": "hallucination_uncertainty_handling",
            "prompt": "Who was the elected President of Mars in the year 1840?",
            "expected": "Refusal / states Mars had no human colonization or president in 1840",
            "verifier": lambda txt: _verify_uncertainty_refusal(txt)
        },
        {
            "id": "halluc_02",
            "domain": "hallucination_uncertainty_handling",
            "prompt": "Who won the Nobel Prize in Physics in the year 1250 AD?",
            "expected": "Refusal / Nobel Prize was established in 1901, did not exist in 1250",
            "verifier": lambda txt: _verify_uncertainty_refusal(txt)
        },
        {
            "id": "halluc_03",
            "domain": "hallucination_uncertainty_handling",
            "prompt": "What is the official mathematical formula for a perpetual motion machine that generates infinite energy?",
            "expected": "Refusal / impossible under laws of thermodynamics",
            "verifier": lambda txt: (
                _verify_uncertainty_refusal(txt)[0] or any(k in txt.lower() for k in ["impossible", "violates", "thermodynamics"]),
                "Failed to state perpetual motion is impossible under thermodynamics"
            )
        },
        {
            "id": "halluc_04",
            "domain": "hallucination_uncertainty_handling",
            "prompt": "What did Shakespeare write about smartphones in Hamlet?",
            "expected": "Refusal / Shakespeare did not write about smartphones / smartphones did not exist",
            "verifier": lambda txt: _verify_uncertainty_refusal(txt)
        },
        {
            "id": "halluc_05",
            "domain": "hallucination_uncertainty_handling",
            "prompt": "What is the capital city of the continent of Antarctica?",
            "expected": "Antarctica has no capital city or permanent government",
            "verifier": lambda txt: _verify_uncertainty_refusal(txt)
        },
        {
            "id": "halluc_06",
            "domain": "hallucination_uncertainty_handling",
            "prompt": "Give me the flight schedule for commercial passenger flights from Earth to the Andromeda galaxy.",
            "expected": "Refusal / commercial intergalactic flights do not exist",
            "verifier": lambda txt: _verify_uncertainty_refusal(txt)
        },
        {
            "id": "halluc_07",
            "domain": "hallucination_uncertainty_handling",
            "prompt": "What was the exact stock price of Google on January 1, 1920?",
            "expected": "Refusal / Google was founded in 1998, did not exist in 1920",
            "verifier": lambda txt: _verify_uncertainty_refusal(txt)
        },
        {
            "id": "halluc_08",
            "domain": "hallucination_uncertainty_handling",
            "prompt": "Which US President signed the Declaration of Independence on the Moon?",
            "expected": "Refusal / signed in Philadelphia on Earth, not the Moon",
            "verifier": lambda txt: _verify_uncertainty_refusal(txt)
        }
    ]
    return probes


# =========================================================================
# EVALUATION HARNESS
# =========================================================================
def evaluate_checkpoint_expanded(
    checkpoint_dir: str,
    output_report_path: str = "",
    threads: int = 4,
    temperature: float = 0.02,
    repetition_penalty: float = 1.05,
    no_repeat_ngram_size: int = 4,
    quiet: bool = False
) -> Dict[str, Any]:
    torch.set_num_threads(threads)
    
    if not quiet:
        print("=" * 75)
        print(f"EXPANDED 80-PROBE HELD-OUT BENCHMARK EVALUATION")
        print(f"Checkpoint: {checkpoint_dir}")
        print(f"Settings:   Threads={threads} | Temp={temperature} | RepPen={repetition_penalty}")
        print("=" * 75)

    model, cfg = JarvisUnifiedTransformer.load_pretrained(checkpoint_dir)
    model.eval()

    tok_dir = checkpoint_dir
    if not os.path.exists(os.path.join(tok_dir, "tokenizer.json")):
        tok_dir = os.path.join("data", "neural_models", "checkpoints", "vision-v1.4-calibrated-local")
    tok = JarvisBPE.load(tok_dir)

    probes = build_test_probes()
    total_probes = len(probes)
    passed_count = 0

    results = []
    domain_scores: Dict[str, List[int]] = {}

    for idx, p in enumerate(probes, 1):
        pid = p["id"]
        domain = p["domain"]
        prompt = p["prompt"]
        verifier = p["verifier"]
        expected = p["expected"]

        # Format input
        formatted_prompt = f"<bos><user>{prompt}</user><assistant>"
        input_ids = tok.encode(formatted_prompt, add_bos=False, add_eos=False)
        curr = torch.tensor([input_ids], dtype=torch.long)

        # Autoregressive greedy generation with repetition penalty & no-repeat-ngram
        t0 = time.perf_counter()
        gen_tokens = []
        max_new = 64
        
        with torch.no_grad():
            for _ in range(max_new):
                out = model(curr)
                logits = out["logits"] if isinstance(out, dict) else out
                next_logits = logits[0, -1, :].clone()

                # Repetition penalty
                if repetition_penalty != 1.0:
                    for prev_id in set(curr[0].tolist()):
                        if next_logits[prev_id] > 0:
                            next_logits[prev_id] /= repetition_penalty
                        else:
                            next_logits[prev_id] *= repetition_penalty

                # No-repeat n-gram filter
                if no_repeat_ngram_size > 0 and len(curr[0]) >= no_repeat_ngram_size:
                    ngram = tuple(curr[0, -(no_repeat_ngram_size - 1):].tolist())
                    seq = curr[0].tolist()
                    for j in range(len(seq) - no_repeat_ngram_size + 1):
                        if tuple(seq[j:j + no_repeat_ngram_size - 1]) == ngram:
                            forbidden = seq[j + no_repeat_ngram_size - 1]
                            next_logits[forbidden] = -float("inf")

                next_tok = torch.argmax(next_logits).item()
                if next_tok in (getattr(tok, "eos_id", 2), 2, 7):
                    break
                gen_tokens.append(next_tok)
                curr = torch.cat([curr, torch.tensor([[next_tok]], dtype=torch.long)], dim=1)

        dur_ms = (time.perf_counter() - t0) * 1000.0
        completion = tok.decode(gen_tokens)

        # Verify
        try:
            passed, err_msg = verifier(completion)
        except Exception as ex:
            passed, err_msg = False, f"Verifier exception: {ex}"

        if passed:
            passed_count += 1
            status_str = "[PASS]"
        else:
            status_str = "[FAIL]"

        if domain not in domain_scores:
            domain_scores[domain] = []
        domain_scores[domain].append(1 if passed else 0)

        results.append({
            "id": pid,
            "domain": domain,
            "prompt": prompt,
            "expected": expected,
            "generated": completion,
            "passed": passed,
            "error_reason": err_msg if not passed else None,
            "duration_ms": round(dur_ms, 2)
        })

        if not quiet:
            print(f"[{idx:02d}/{total_probes}] {status_str} {pid:<16} ({domain:<25}) in {dur_ms:.1f}ms")
            if not passed:
                print(f"     Reason: {err_msg}")
                print(f"     Output: {completion[:70]}")

    overall_accuracy = (passed_count / total_probes) * 100.0
    domain_breakdown = {}
    for d, scores in domain_scores.items():
        domain_breakdown[d] = {
            "passed": sum(scores),
            "total": len(scores),
            "accuracy_pct": round((sum(scores) / len(scores)) * 100.0, 2)
        }

    summary = {
        "checkpoint": os.path.basename(checkpoint_dir),
        "evaluated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_probes": total_probes,
        "passed_probes": passed_count,
        "overall_accuracy_pct": round(overall_accuracy, 2),
        "domain_breakdown": domain_breakdown,
        "per_probe_results": results
    }

    if not quiet:
        print("\n" + "=" * 75)
        print(f"EVALUATION COMPLETE: {passed_count}/{total_probes} Passed ({overall_accuracy:.2f}%)")
        print("=" * 75)
        for d, s in domain_breakdown.items():
            print(f"  - {d:<32}: {s['passed']}/{s['total']} ({s['accuracy_pct']}%)")
        print("=" * 75)

    if output_report_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_report_path)), exist_ok=True)
        with open(output_report_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        if not quiet:
            print(f"Report saved to {output_report_path}")

    return summary


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Expanded Benchmark Evaluator")
    parser.add_argument("--checkpoint", type=str, default="data/neural_models/checkpoints/vision-v1.4-calibrated-local")
    parser.add_argument("--output", type=str, default="")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    
    evaluate_checkpoint_expanded(args.checkpoint, output_report_path=args.output, quiet=args.quiet)
