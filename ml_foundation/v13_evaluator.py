"""
VISION v1.3 — Cognitive Intelligence & Autonomy Evaluator
ml_foundation/v13_evaluator.py

48-probe held-out benchmark across 8 distinct cognitive categories:
1. Reasoning: multi-step logic, counterfactuals, causality, relational ordering (6 probes)
2. Mathematics: arithmetic, linear equations, percentages, rates, geometry, physics (6 probes)
3. Coding Python: pure function synthesis, AST validation + live Python exec testing (6 probes)
4. Coding JavaScript: function synthesis + Node.js VM execution testing (6 probes)
5. Coding Java: static method synthesis, signature and algorithmic logic verification (6 probes)
6. Memory & Dialogue Context: pronoun resolution, constraint retention, state tracking (6 probes)
7. Multilingual: English, Devanagari Hindi, Hinglish technical explanations (6 probes)
8. Tool Intelligence: tool selection, JSON argument extraction, error recovery (6 probes)

ZERO CONTAMINATION POLICY:
None of the 48 probes or their canonical canaries may appear in the training shards.
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
from typing import Callable, Dict, List, Optional, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
import torch.nn.functional as F

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE


# Canonical canaries that must never appear in any training data
V13_BENCHMARK_CANARIES: List[str] = [
    "some roses fade quickly",
    "match was struck in a sealed container",
    "coolant leaked",
    "alice is taller than bob",
    "no reptiles have fur",
    "ice cream sales and drowning rates",
    "35 * 12 - 70",
    "5*x - 15 = 45",
    "discounted by 20%",
    "60 km/h for 2.5 hours",
    "rectangle with length 8 meters and width 3.5",
    "potential energy in joules of a 2 kg mass at a height of 5",
    "sum_two",
    "is_odd",
    "find_max",
    "reverse_string",
    "count_evens",
    "square_num",
    "addnumbers",
    "isnegative",
    "doublearray",
    "findlongestword",
    "greetuser",
    "filterodds",
    "minoftwo",
    "makegreeting",
    "circlearea",
    "alice gave a book to bob because he requested it",
    "favorite programming language",
    "actually i moved to bengaluru",
    "project apollo has budget $50,000",
    "box a has an apple",
    "capital of france",
    "database transaction is in one sentence",
    "api gateway do",
    "रैम (ram) का क्या काम",
    "इंटरनेट क्या है",
    "api rate limiting kya hoti hai",
    "git kyun use karte hain",
    "set computer volume to 40%",
]


def _strip_thoughts(text: str) -> str:
    cleaned = re.sub(r"<thought>[\s\S]*?</thought>", " ", str(text or ""))
    cleaned = re.sub(r"<\|think\|>[\s\S]*?<\|/think\|>", " ", cleaned)
    return cleaned.strip()


def _verify_numeric(pred_text: str, expected_val: float, tol: float = 0.05) -> Tuple[bool, str]:
    cleaned = _strip_thoughts(pred_text)
    raw_nums = re.findall(r"[-+]?(?:\d*\.\d+|\d+)", cleaned)
    if not raw_nums:
        return False, f"No numeric token found in response: '{pred_text[:80]}'"
    for tok in reversed(raw_nums):
        try:
            val = float(tok)
            if abs(val - expected_val) <= max(tol, 1e-4 * abs(expected_val)):
                return True, ""
        except ValueError:
            continue
    return False, f"Extracted numbers {raw_nums} did not match expected {expected_val} (+/- {tol})"


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
        return False, f"AST missing required function definition 'def {fn_name}(...)'"

    full_exec = f"{code_body}\n\n{assert_script}\n"
    local_env: Dict[str, object] = {}
    try:
        exec(full_exec, {"__builtins__": __builtins__}, local_env)
        return True, ""
    except AssertionError as ae:
        return False, f"Assertion failed: {ae}"
    except Exception as e:
        return False, f"Runtime error during assertion: {e}"


def _verify_javascript_code(pred_text: str, fn_name: str, assert_js: str) -> Tuple[bool, str]:
    raw = _strip_thoughts(pred_text)
    fence_match = re.search(r"```(?:javascript|js)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    code_body = fence_match.group(1).strip() if fence_match else raw.strip()

    if fn_name not in code_body:
        return False, f"Missing function '{fn_name}' in generated JS"

    script = f"{code_body}\n\n{assert_js}\nconsole.log('PASS_V13_JS');\n"
    try:
        proc = subprocess.run(
            ["node", "-e", script],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.returncode == 0 and "PASS_V13_JS" in proc.stdout:
            return True, ""
        err_msg = (proc.stderr or proc.stdout).strip().split("\n")[-1]
        return False, f"Node.js execution failed: {err_msg}"
    except Exception as e:
        return False, f"Subprocess node error: {e}"


def _verify_java_code(pred_text: str, method_name: str, required_tokens: Tuple[str, ...]) -> Tuple[bool, str]:
    raw = _strip_thoughts(pred_text)
    fence_match = re.search(r"```(?:java)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    code_body = fence_match.group(1).strip() if fence_match else raw.strip()

    if method_name not in code_body:
        return False, f"Missing Java method '{method_name}'"
    for tok in required_tokens:
        if tok not in code_body:
            return False, f"Missing required Java token '{tok}' in method '{method_name}'"
    return True, ""


def _verify_language_coherence(pred_text: str, min_words: int, required_any: Tuple[str, ...]) -> Tuple[bool, str]:
    cleaned = _strip_thoughts(pred_text)
    words = [w for w in re.split(r"\s+", cleaned) if w]
    if len(words) < min_words:
        return False, f"Response too short ({len(words)} < {min_words} words): '{cleaned}'"
    low = cleaned.lower()
    matched = [stem for stem in required_any if stem.lower() in low]
    if not matched:
        return False, f"None of required concepts {required_any} present in: '{cleaned[:120]}'"
    return True, ""


def _extract_tool_json(pred_text: str) -> Optional[Dict[str, object]]:
    cleaned = _strip_thoughts(pred_text)
    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", cleaned, re.IGNORECASE)
    cand = fence.group(1) if fence else cleaned
    cand = cand.strip()
    match = re.search(r"\{[\s\S]*\}", cand)
    if not match:
        return None
    raw_json = match.group(0)
    for sanitizer in [
        lambda s: s,
        lambda s: re.sub(r",\s*([\}\]])", r"\1", s),
        lambda s: re.sub(r"'([^']*)'", r'"\1"', s),
    ]:
        try:
            return json.loads(sanitizer(raw_json))
        except Exception:
            continue
    return None


def run_v13_evaluation(
    checkpoint_dir: str,
    quiet: bool = False,
) -> Dict[str, object]:
    weights_path = os.path.join(checkpoint_dir, "weights.pt")
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Missing weights.pt at {weights_path}")

    ckpt = torch.load(weights_path, map_location="cpu", weights_only=True)
    cfg = JarvisConfig.from_dict(ckpt["config"])
    tokenizer = JarvisBPE.load(checkpoint_dir)
    model = JarvisUnifiedTransformer(cfg)
    model.load_state_dict(ckpt["model_state_dict"], strict=False)
    model.eval()

    stop_tok_ids = [tokenizer.vocab["</assistant>"]] if "</assistant>" in tokenizer.vocab else None

    # Track latencies and RSS
    latencies_ms: List[float] = []
    initial_rss = _get_process_rss_mb()

    # Domain buckets: 8 categories, 6 probes each = 48 probes
    categories = [
        "reasoning",
        "mathematics",
        "coding_python",
        "coding_javascript",
        "coding_java",
        "memory_dialogue",
        "multilingual",
        "tool_intelligence",
    ]
    domain_buckets: Dict[str, List[float]] = {cat: [] for cat in categories}
    per_example_results: List[Dict[str, object]] = []

    def _eval_probe(
        pid: str,
        category: str,
        prompt: str,
        expected: str,
        verifier: Callable[[str], Tuple[bool, str]],
        max_new_tokens: int = 64,
        temperature: float = 0.02,
        is_deterministic: bool = True,
    ) -> bool:
        formatted = f"<bos><user>{prompt}</user><assistant>"
        p_ids = tokenizer.encode(formatted)

        t0 = time.perf_counter()
        with torch.no_grad():
            out_ids = model.generate(
                torch.tensor([p_ids], dtype=torch.long),
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                repetition_penalty=1.05,
                no_repeat_ngram_size=4,
                eos_id=tokenizer.eos_id,
                stop_token_ids=stop_tok_ids,
            )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        latencies_ms.append(elapsed_ms)

        gen_ids = out_ids[len(p_ids) :]
        gen_text = tokenizer.decode(gen_ids, skip_special_tokens=True).strip()

        passed, reason = verifier(gen_text)
        score = 1.0 if passed else 0.0
        domain_buckets[category].append(score)

        per_example_results.append({
            "id": pid,
            "category": category,
            "prompt": prompt,
            "expected": expected,
            "generated": gen_text,
            "passed": passed,
            "failure_reason": reason if not passed else "",
            "latency_ms": round(elapsed_ms, 2),
            "is_deterministic": is_deterministic,
        })
        if not quiet:
            status = "PASS" if passed else "FAIL"
            print(f"[{status}] {pid:<16} ({category:<18}) - {reason or 'OK'}")
        return passed

    # =========================================================================
    # 1. REASONING (6 probes)
    # =========================================================================
    _eval_probe(
        "reas_01", "reasoning",
        "If all roses are flowers, and some flowers fade quickly, does it necessarily follow that some roses fade quickly? Answer yes or no and explain.",
        "Must answer 'no' (syllogistic fallacy / undistributed middle)",
        lambda g: (
            (True, "")
            if (re.search(r"\bno\b", g.lower()) and not re.search(r"\byes\b", g.lower()))
            else (False, f"Expected clear 'no' answer to invalid syllogism, got: {g[:80]}")
        ),
        is_deterministic=True,
    )
    _eval_probe(
        "reas_02", "reasoning",
        "A match was struck in a sealed container without oxygen. Did it catch fire? Answer yes or no and explain.",
        "Must answer 'no' (combustion requires oxygen)",
        lambda g: (
            (True, "")
            if (re.search(r"\bno\b", g.lower()) and ("oxygen" in g.lower() or "combust" in g.lower() or "burn" in g.lower() or "fire" in g.lower()))
            else (False, f"Expected 'no' with combustion explanation, got: {g[:80]}")
        ),
        is_deterministic=True,
    )
    _eval_probe(
        "reas_03", "reasoning",
        "A car engine overheats because the coolant leaked. If the radiator fan is replaced, will the coolant leak be resolved? Answer yes or no.",
        "Must answer 'no' (replacing fan does not fix leak)",
        lambda g: (
            (True, "")
            if (re.search(r"\bno\b", g.lower()) and not re.search(r"\byes\b", g.lower()))
            else (False, f"Expected 'no', got: {g[:80]}")
        ),
        is_deterministic=True,
    )
    _eval_probe(
        "reas_04", "reasoning",
        "Alice is taller than Bob. Charlie is shorter than Bob. Who is the tallest among Alice, Bob, and Charlie?",
        "Alice",
        lambda g: (
            (True, "")
            if ("alice" in g.lower() and "charlie" not in g.lower().split("alice")[0])
            else (False, f"Expected Alice as tallest, got: {g[:80]}")
        ),
        is_deterministic=True,
    )
    _eval_probe(
        "reas_05", "reasoning",
        "No reptiles have fur. All snakes are reptiles. Do any snakes have fur? Answer yes or no.",
        "No",
        lambda g: (
            (True, "")
            if (re.search(r"\bno\b", g.lower()) and not re.search(r"\byes\b", g.lower()))
            else (False, f"Expected 'no', got: {g[:80]}")
        ),
        is_deterministic=True,
    )
    _eval_probe(
        "reas_06", "reasoning",
        "Ice cream sales and drowning rates both increase in summer. Does eating ice cream cause drowning? Answer yes or no.",
        "No (correlation is not causation)",
        lambda g: (
            (True, "")
            if (re.search(r"\bno\b", g.lower()) and not re.search(r"\byes\b", g.lower()))
            else (False, f"Expected 'no', got: {g[:80]}")
        ),
        is_deterministic=True,
    )

    # =========================================================================
    # 2. MATHEMATICS (6 probes)
    # =========================================================================
    _eval_probe(
        "math_01", "mathematics",
        "Calculate 35 * 12 - 70.",
        "350",
        lambda g: _verify_numeric(g, 350.0),
        is_deterministic=True,
    )
    _eval_probe(
        "math_02", "mathematics",
        "Solve the linear equation 5*x - 15 = 45 for x.",
        "x = 12",
        lambda g: _verify_numeric(g, 12.0),
        is_deterministic=True,
    )
    _eval_probe(
        "math_03", "mathematics",
        "An item costs $80 and is discounted by 20%. What is the final price in dollars?",
        "64",
        lambda g: _verify_numeric(g, 64.0),
        is_deterministic=True,
    )
    _eval_probe(
        "math_04", "mathematics",
        "A car drives at 60 km/h for 2.5 hours. How many kilometers did it travel?",
        "150 km",
        lambda g: _verify_numeric(g, 150.0),
        is_deterministic=True,
    )
    _eval_probe(
        "math_05", "mathematics",
        "What is the area in square meters of a rectangle with length 8 meters and width 3.5 meters?",
        "28 square meters",
        lambda g: _verify_numeric(g, 28.0),
        is_deterministic=True,
    )
    _eval_probe(
        "math_06", "mathematics",
        "What is the potential energy in Joules of a 2 kg mass at a height of 5 meters? Use g = 9.8 m/s^2.",
        "98 J",
        lambda g: _verify_numeric(g, 98.0),
        is_deterministic=True,
    )

    # =========================================================================
    # 3. CODING PYTHON (6 probes)
    # =========================================================================
    _eval_probe(
        "code_py_01", "coding_python",
        "Write a Python function sum_two(a, b) returning a + b.",
        "def sum_two(a, b): return a + b",
        lambda g: _verify_python_code(g, "sum_two", "assert sum_two(10, 25) == 35 and sum_two(-3, 7) == 4"),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_py_02", "coding_python",
        "Write a Python function is_odd(n) returning True if n is odd else False.",
        "def is_odd(n): return n % 2 != 0",
        lambda g: _verify_python_code(g, "is_odd", "assert is_odd(7) is True and is_odd(4) is False"),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_py_03", "coding_python",
        "Write a Python function find_max(numbers) returning the maximum value in a list.",
        "def find_max(numbers): return max(numbers)",
        lambda g: _verify_python_code(g, "find_max", "assert find_max([3, 9, 2, 8]) == 9 and find_max([-5, -1]) == -1"),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_py_04", "coding_python",
        "Write a Python function reverse_string(s) returning the reversed string.",
        "def reverse_string(s): return s[::-1]",
        lambda g: _verify_python_code(g, "reverse_string", "assert reverse_string('hello') == 'olleh' and reverse_string('') == ''"),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_py_05", "coding_python",
        "Write a Python function count_evens(nums) returning the count of even integers in the list.",
        "def count_evens(nums): return sum(1 for x in nums if x % 2 == 0)",
        lambda g: _verify_python_code(g, "count_evens", "assert count_evens([1, 2, 3, 4, 6]) == 3 and count_evens([1, 3]) == 0"),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_py_06", "coding_python",
        "Write a Python function square_num(x) returning x multiplied by itself.",
        "def square_num(x): return x * x",
        lambda g: _verify_python_code(g, "square_num", "assert square_num(9) == 81 and square_num(-4) == 16"),
        max_new_tokens=64,
        is_deterministic=True,
    )

    # =========================================================================
    # 4. CODING JAVASCRIPT (6 probes)
    # =========================================================================
    _eval_probe(
        "code_js_01", "coding_javascript",
        "Write a JavaScript function addNumbers(a, b) returning a + b.",
        "function addNumbers(a, b) { return a + b; }",
        lambda g: _verify_javascript_code(g, "addNumbers", "if (addNumbers(14, 28) !== 42 || addNumbers(-5, 5) !== 0) throw new Error('fail');"),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_js_02", "coding_javascript",
        "Write a JavaScript function isNegative(n) returning true if n < 0 else false.",
        "function isNegative(n) { return n < 0; }",
        lambda g: _verify_javascript_code(g, "isNegative", "if (!isNegative(-5) || isNegative(5) || isNegative(0)) throw new Error('fail');"),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_js_03", "coding_javascript",
        "Write a JavaScript function doubleArray(arr) returning a new array with each element multiplied by 2.",
        "function doubleArray(arr) { return arr.map(x => x * 2); }",
        lambda g: _verify_javascript_code(g, "doubleArray", "if (JSON.stringify(doubleArray([1, 2, 3])) !== JSON.stringify([2, 4, 6])) throw new Error('fail');"),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_js_04", "coding_javascript",
        "Write a JavaScript function greetUser(name) returning 'Hello, ' + name + '!'.",
        "function greetUser(name) { return 'Hello, ' + name + '!'; }",
        lambda g: _verify_javascript_code(g, "greetUser", "if (greetUser('Lokesh') !== 'Hello, Lokesh!') throw new Error('fail');"),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_js_05", "coding_javascript",
        "Write a JavaScript function filterOdds(nums) returning only odd numbers from the array.",
        "function filterOdds(nums) { return nums.filter(x => x % 2 !== 0); }",
        lambda g: _verify_javascript_code(g, "filterOdds", "if (JSON.stringify(filterOdds([1, 2, 3, 4, 5])) !== JSON.stringify([1, 3, 5])) throw new Error('fail');"),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_js_06", "coding_javascript",
        "Write a JavaScript function findMaxVal(a, b) returning the larger of two numbers.",
        "function findMaxVal(a, b) { return a > b ? a : b; }",
        lambda g: _verify_javascript_code(g, "findMaxVal", "if (findMaxVal(10, 20) !== 20 || findMaxVal(7, -3) !== 7) throw new Error('fail');"),
        max_new_tokens=64,
        is_deterministic=True,
    )

    # =========================================================================
    # 5. CODING JAVA (6 probes)
    # =========================================================================
    _eval_probe(
        "code_java_01", "coding_java",
        "Write a Java static method minOfTwo(int a, int b) returning the smaller integer.",
        "static int minOfTwo(int a, int b)",
        lambda g: (
            _verify_java_code(g, "minOfTwo", ("int a", "int b"))
            if any(op in g for op in (">", "<", "Math.min"))
            else (False, "Missing comparison logic in minOfTwo")
        ),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_java_02", "coding_java",
        "Write a Java static method isEven(int n) returning boolean true if n is even.",
        "static boolean isEven(int n)",
        lambda g: _verify_java_code(g, "isEven", ("int n", "% 2")),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_java_03", "coding_java",
        "Write a Java static method multiply(int a, int b) returning their product.",
        "static int multiply(int a, int b)",
        lambda g: _verify_java_code(g, "multiply", ("int a", "int b", "*")),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_java_04", "coding_java",
        "Write a Java static method makeGreeting(String name) returning 'Hello ' + name.",
        "static String makeGreeting(String name)",
        lambda g: _verify_java_code(g, "makeGreeting", ("String name", "Hello")),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_java_05", "coding_java",
        "Write a Java static method circleArea(double radius) returning the area using Math.PI.",
        "static double circleArea(double radius)",
        lambda g: _verify_java_code(g, "circleArea", ("double radius", "Math.PI")),
        max_new_tokens=64,
        is_deterministic=True,
    )
    _eval_probe(
        "code_java_06", "coding_java",
        "Write a Java static method isPositive(int n) returning true when n is strictly greater than 0.",
        "static boolean isPositive(int n)",
        lambda g: _verify_java_code(g, "isPositive", ("int n", "> 0")),
        max_new_tokens=64,
        is_deterministic=True,
    )

    # =========================================================================
    # 6. MEMORY & DIALOGUE CONTEXT (6 probes)
    # =========================================================================
    _eval_probe(
        "mem_01", "memory_dialogue",
        "Alice gave a book to Bob because he requested it. Who requested the book?",
        "Bob",
        lambda g: ((True, "") if ("bob" in g.lower() and "alice" not in g.lower()) else (False, f"Expected 'Bob', got: {g[:80]}")),
        is_deterministic=True,
    )
    _eval_probe(
        "mem_02", "memory_dialogue",
        "User: My name is Lokesh and my favorite programming language is Python.\nAssistant: Understood.\nUser: What is my favorite programming language?",
        "Python",
        lambda g: ((True, "") if "python" in g.lower() else (False, f"Expected Python, got: {g[:80]}")),
        is_deterministic=True,
    )
    _eval_probe(
        "mem_03", "memory_dialogue",
        "User: I currently live in Mumbai.\nAssistant: Noted.\nUser: Actually I moved to Bengaluru yesterday.\nAssistant: Updated.\nUser: Which city do I live in now?",
        "Bengaluru",
        lambda g: ((True, "") if "bengaluru" in g.lower() or "bangalore" in g.lower() else (False, f"Expected Bengaluru, got: {g[:80]}")),
        is_deterministic=True,
    )
    _eval_probe(
        "mem_04", "memory_dialogue",
        "Project Apollo has budget $50,000. Project Artemis has budget $80,000. Which project has a higher budget?",
        "Artemis",
        lambda g: ((True, "") if ("artemis" in g.lower() and "apollo" not in g.lower().split("artemis")[0]) else (False, f"Expected Artemis, got: {g[:80]}")),
        is_deterministic=True,
    )
    _eval_probe(
        "mem_05", "memory_dialogue",
        "Turn 1: Box A has an apple.\nTurn 2: Move the apple from Box A to Box B.\nTurn 3: Where is the apple located now?",
        "Box B",
        lambda g: ((True, "") if ("box b" in g.lower() or "b" in g.lower()) else (False, f"Expected Box B, got: {g[:80]}")),
        is_deterministic=True,
    )
    _eval_probe(
        "mem_06", "memory_dialogue",
        "Answer in exactly one word: What is the capital of France?",
        "Paris (1 word constraint)",
        lambda g: (
            (True, "")
            if ("paris" in g.lower() and len(re.sub(r"[^\w\s]", "", g).split()) <= 2)
            else (False, f"Expected 'Paris' in <=2 words, got: '{g}'")
        ),
        is_deterministic=True,
    )

    # =========================================================================
    # 7. MULTILINGUAL (6 probes)
    # =========================================================================
    _eval_probe(
        "lang_01", "multilingual",
        "Explain what a database transaction is in one clear English sentence.",
        "Coherent explanation mentioning ACID / unit of work / atomic operations",
        lambda g: _verify_language_coherence(g, min_words=6, required_any=("unit", "atom", "operat", "acid", "commit", "datab", "consist")),
        is_deterministic=False,
    )
    _eval_probe(
        "lang_02", "multilingual",
        "What does an API gateway do in a microservices architecture?",
        "Coherent explanation mentioning routing / proxy / traffic / authentication",
        lambda g: _verify_language_coherence(g, min_words=6, required_any=("rout", "request", "traffic", "auth", "proxy", "gate", "service")),
        is_deterministic=False,
    )
    _eval_probe(
        "lang_03", "multilingual",
        "हिंदी में समझाएं कि कंप्यूटर में रैम (RAM) का क्या काम होता है?",
        "Coherent Hindi explanation in Devanagari script",
        lambda g: (
            _verify_language_coherence(g, min_words=6, required_any=("मेमोरी", "डेटा", "स्टोर", "स्पीड", "अस्थायी", "तेज", "काम"))
            if re.search(r"[\u0900-\u097F]{3,}", g)
            else (False, "Expected Devanagari Hindi script in response")
        ),
        is_deterministic=False,
    )
    _eval_probe(
        "lang_04", "multilingual",
        "हिंदी में बताएं कि इंटरनेट क्या है?",
        "Coherent Hindi definition of the internet in Devanagari script",
        lambda g: (
            _verify_language_coherence(g, min_words=6, required_any=("नेटवर्क", "कंप्यूटर", "सूचना", "कनेक्ट", "जाल", "विश्व"))
            if re.search(r"[\u0900-\u097F]{3,}", g)
            else (False, "Expected Devanagari Hindi script in response")
        ),
        is_deterministic=False,
    )
    _eval_probe(
        "lang_05", "multilingual",
        "Hinglish mein samjhayein ki API rate limiting kya hoti hai?",
        "Coherent Hinglish explanation of rate limiting",
        lambda g: _verify_language_coherence(g, min_words=6, required_any=("request", "limit", "server", "traffic", "block", "api", "overload", "rate")),
        is_deterministic=False,
    )
    _eval_probe(
        "lang_06", "multilingual",
        "Hinglish mein batayein ki code version control ke liye Git kyun use karte hain?",
        "Coherent Hinglish explanation of Git version control",
        lambda g: _verify_language_coherence(g, min_words=6, required_any=("track", "code", "history", "branch", "team", "change", "commit", "version")),
        is_deterministic=False,
    )

    # =========================================================================
    # 8. TOOL INTELLIGENCE (6 probes)
    # =========================================================================
    tool_menu_1 = "Available tools: [open_desktop_app(app_name), check_system_storage()]. User asks: Open Visual Studio Code."
    _eval_probe(
        "tool_01", "tool_intelligence",
        tool_menu_1,
        "Select open_desktop_app",
        lambda g: ((True, "") if "open_desktop_app" in g else (False, "Expected tool name open_desktop_app")),
        is_deterministic=True,
    )
    _eval_probe(
        "tool_02", "tool_intelligence",
        tool_menu_1,
        'JSON {"tool": "open_desktop_app", "arguments": {"app_name": "vscode"}}',
        lambda g: (
            (True, "")
            if (
                isinstance((obj := _extract_tool_json(g)), dict)
                and obj.get("tool") == "open_desktop_app"
                and isinstance(obj.get("arguments"), dict)
                and any(k in str(obj["arguments"].get("app_name", "")).lower() for k in ("vscode", "code", "visual studio"))
            )
            else (False, f"Invalid tool JSON or missing arguments.app_name: {g[:80]}")
        ),
        max_new_tokens=80,
        is_deterministic=True,
    )
    tool_menu_2 = "Available tools: [stage_whatsapp_message(contact, text), get_current_time()]. User asks: What time is it right now?"
    _eval_probe(
        "tool_03", "tool_intelligence",
        tool_menu_2,
        "Select get_current_time",
        lambda g: ((True, "") if "get_current_time" in g else (False, "Expected tool name get_current_time")),
        is_deterministic=True,
    )
    tool_menu_3 = "Available tools: [stage_whatsapp_message(contact, text)]. User asks: Send WhatsApp message to Alice saying Meeting at 5pm."
    _eval_probe(
        "tool_04", "tool_intelligence",
        tool_menu_3,
        'JSON {"tool": "stage_whatsapp_message", "arguments": {"contact": "Alice", "text": "Meeting at 5pm"}}',
        lambda g: (
            (True, "")
            if (
                isinstance((obj := _extract_tool_json(g)), dict)
                and obj.get("tool") == "stage_whatsapp_message"
                and isinstance(obj.get("arguments"), dict)
                and "alice" in str(obj["arguments"].get("contact", "")).lower()
                and "5pm" in str(obj["arguments"].get("text", "")).lower().replace(" ", "")
            )
            else (False, f"Invalid tool JSON or missing contact/text: {g[:80]}")
        ),
        max_new_tokens=80,
        is_deterministic=True,
    )
    _eval_probe(
        "tool_05", "tool_intelligence",
        "Tool read_file failed with FileNotFoundError: data/config.json does not exist. What should JARVIS do next to handle this error safely?",
        "Error recovery explanation mentioning verify path / fallback / check directory",
        lambda g: _verify_language_coherence(g, min_words=5, required_any=("check", "create", "search", "verify", "path", "fallback", "default", "directory", "exist", "handle")),
        is_deterministic=False,
    )
    tool_menu_4 = "Available tools: [set_system_volume(level_percent)]. User asks: Set computer volume to 40%."
    _eval_probe(
        "tool_06", "tool_intelligence",
        tool_menu_4,
        'JSON {"tool": "set_system_volume", "arguments": {"level_percent": 40}}',
        lambda g: (
            (True, "")
            if (
                isinstance((obj := _extract_tool_json(g)), dict)
                and obj.get("tool") == "set_system_volume"
                and isinstance(obj.get("arguments"), dict)
                and str(obj["arguments"].get("level_percent", "")) == "40"
            )
            else (False, f"Invalid volume JSON or level_percent != 40: {g[:80]}")
        ),
        is_deterministic=True,
    )

    # -------------------------------------------------------------------------
    # Aggregate Metrics
    # -------------------------------------------------------------------------
    final_rss = _get_process_rss_mb()
    sorted_latencies = sorted(latencies_ms)
    p50_latency = sorted_latencies[len(sorted_latencies) // 2] if sorted_latencies else 0.0
    p95_idx = int(0.95 * len(sorted_latencies))
    p95_latency = sorted_latencies[min(p95_idx, len(sorted_latencies) - 1)] if sorted_latencies else 0.0

    category_scores: Dict[str, float] = {}
    for cat in categories:
        scores = domain_buckets[cat]
        category_scores[cat] = round(sum(scores) / len(scores), 4) if scores else 0.0

    all_passed = [p["passed"] for p in per_example_results]
    overall_pass_rate = round(sum(1 for p in all_passed if p) / len(all_passed), 4) if all_passed else 0.0

    deterministic_results = [p for p in per_example_results if p.get("is_deterministic", False)]
    det_pass_rate = (
        round(sum(1 for p in deterministic_results if p["passed"]) / len(deterministic_results), 4)
        if deterministic_results else 0.0
    )

    open_ended_results = [p for p in per_example_results if not p.get("is_deterministic", False)]
    open_pass_rate = (
        round(sum(1 for p in open_ended_results if p["passed"]) / len(open_ended_results), 4)
        if open_ended_results else 0.0
    )

    report: Dict[str, object] = {
        "benchmark_name": "VISION_v1.3_Cognitive_Intelligence_48_Probe_Suite",
        "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "checkpoint_evaluated": os.path.basename(os.path.normpath(checkpoint_dir)),
        "parameter_count": model.parameter_count(),
        "total_probes": len(per_example_results),
        "overall_pass_rate": overall_pass_rate,
        "deterministic_exact_accuracy": det_pass_rate,
        "open_ended_qualitative_accuracy": open_pass_rate,
        "category_pass_rates": category_scores,
        "performance": {
            "p50_latency_ms": round(p50_latency, 2),
            "p95_latency_ms": round(p95_latency, 2),
            "avg_latency_ms": round(sum(latencies_ms) / len(latencies_ms), 2) if latencies_ms else 0.0,
            "memory_rss_mb": round(final_rss, 2),
        },
        "per_example_results": per_example_results,
    }
    return report


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="VISION v1.3 Cognitive Evaluator")
    parser.add_argument("--checkpoint", type=str, required=True, help="Path to checkpoint directory")
    parser.add_argument("--output", type=str, default="", help="Path to save report JSON")
    parser.add_argument("--quiet", action="store_true", help="Suppress per-probe logs")
    args = parser.parse_args()

    print(f"=== Evaluating {args.checkpoint} on VISION v1.3 48-Probe Benchmark ===")
    rep = run_v13_evaluation(args.checkpoint, quiet=args.quiet)
    print("\n--- Summary ---")
    print(f"Overall Pass Rate: {rep['overall_pass_rate'] * 100:.1f}% ({int(rep['overall_pass_rate'] * rep['total_probes'])}/{rep['total_probes']})")
    print(f"Deterministic Accuracy: {rep['deterministic_exact_accuracy'] * 100:.1f}%")
    print(f"Open-Ended Accuracy: {rep['open_ended_qualitative_accuracy'] * 100:.1f}%")
    print("Category Pass Rates:")
    for cat, rate in rep["category_pass_rates"].items():
        print(f"  - {cat:<20}: {rate * 100:.1f}%")
    print(f"P50 Latency: {rep['performance']['p50_latency_ms']} ms | RSS: {rep['performance']['memory_rss_mb']} MB")

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(rep, f, indent=2)
        print(f"Saved evaluation report to {args.output}")


if __name__ == "__main__":
    main()
