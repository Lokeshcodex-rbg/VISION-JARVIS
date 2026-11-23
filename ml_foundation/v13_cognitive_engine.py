"""
VISION v1.3 — Cognitive Intelligence & Autonomy Engine
ml_foundation/v13_cognitive_engine.py

Core Intelligence Upgrades:
1. Native <thought> ... </thought> chain-of-thought reasoning for multi-step math, logic, and synthesis.
2. In-context function identifier copying across Python, JavaScript, and Java.
3. In-context tool calling with valid JSON argument formatting and error recovery.
4. Robust conversational memory grounding and pronoun/constraint resolution.
5. Multilingual fluency across English, Devanagari Hindi, and Hinglish.
6. Strict elimination of spurious code snippets in prose / reasoning queries.
7. Zero contamination verification against V13_BENCHMARK_CANARIES.
"""

from __future__ import annotations

import copy
import datetime
import json
import math
import os
import random
import re
import sys
import time
from typing import Dict, List, Optional, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

import torch
torch.set_num_threads(6)
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.v13_evaluator import V13_BENCHMARK_CANARIES


def assert_clean_held_out(items: List[Dict[str, str]], canaries: List[str]) -> None:
    lowered = [c.lower().strip() for c in canaries if c.strip()]
    for idx, item in enumerate(items):
        full = (item["instruction"] + " " + item["response"]).lower()
        for c in lowered:
            if c in full:
                raise ValueError(
                    f"CONTAMINATION ERROR at index #{idx} in domain '{item.get('domain')}': "
                    f"Canary '{c}' found in text:\n{full[:200]}"
                )


def build_v13_cognitive_dataset(seed: int = 1337) -> List[Dict[str, str]]:
    rng = random.Random(seed)
    items: List[Dict[str, str]] = []

    # =========================================================================
    # 1. REASONING: Logic, Causality, Counterfactuals, Relational (Prose, NO CODE)
    # =========================================================================
    logic_templates = [
        # Undistributed middle / invalid syllogisms -> No
        ("If all cats are mammals, and some mammals swim, does it necessarily follow that all cats swim?",
         "<thought>All cats are mammals, but the subset of mammals that swim might not overlap with cats. Therefore, it does not necessarily follow.</thought>No, it does not necessarily follow. While all cats are mammals, only some mammals swim, and cats may not be in that group."),
        ("If all birds lay eggs, and some reptiles lay eggs, does it follow that all birds are reptiles?",
         "<thought>Both birds and some reptiles share the property of egg-laying, but this does not imply birds are reptiles.</thought>No, it does not follow. Sharing a common characteristic does not make birds reptiles."),
        ("All squares are rectangles. Some rectangles are red. Does it necessarily follow that all squares are red?",
         "<thought>The property of being red applies only to some rectangles, not necessarily all squares.</thought>No, it does not follow. Only some rectangles are red, so squares may or may not be red."),
        ("If every engineer knows math, and some doctors know math, does it mean all doctors are engineers?",
         "<thought>Knowing math is a shared skill, but that does not equate doctors with engineers.</thought>No, it does not mean all doctors are engineers."),

        # Valid transitive syllogisms -> Yes
        ("All humans are mortal. Socrates is a human. Is Socrates mortal?",
         "<thought>By universal instantiation from 'All humans are mortal', Socrates being human implies Socrates is mortal.</thought>Yes, Socrates is mortal."),
        ("All triangles have three sides. Shape X is a triangle. Does Shape X have three sides?",
         "<thought>All triangles definitionally have three sides, so Shape X must have three sides.</thought>Yes, Shape X has three sides."),

        # Counterfactual & Causality -> No
        ("An electric bulb has a broken tungsten filament. If you flip the wall switch on, will the bulb illuminate?",
         "<thought>An electric circuit requires a continuous conductive path. A broken filament breaks the circuit.</thought>No, the bulb will not illuminate because the broken filament opens the circuit, preventing electrical current from flowing."),
        ("A smartphone battery is completely drained to 0%. If you press the power button without plugging it in, will it boot up?",
         "<thought>Without stored electrochemical energy, the processor and display cannot initialize.</thought>No, the phone will not turn on because the battery has no electrical charge."),
        ("The car runs out of fuel on the highway. If you change the tire, will the engine start and run?",
         "<thought>The engine stopped due to lack of fuel. Changing a tire does not add fuel to the engine.</thought>No, changing a tire does not provide fuel, so the engine still cannot run."),
        ("A water pipe has a crack and leaks. If you repaint the wall behind it, will the leak stop?",
         "<thought>Repainting the wall is a cosmetic change that does not seal the cracked pipe.</thought>No, painting the wall does not fix the crack in the water pipe."),

        # Relational ordering
        ("David is faster than Ethan. Frank is slower than Ethan. Who is the fastest among David, Ethan, and Frank?",
         "<thought>David > Ethan and Ethan > Frank implies David > Ethan > Frank. Thus David is the fastest.</thought>David is the fastest."),
        ("Box 1 is heavier than Box 2. Box 3 is lighter than Box 2. Which box is the heaviest?",
         "<thought>Box 1 > Box 2 > Box 3. Therefore Box 1 is the heaviest.</thought>Box 1 is the heaviest."),
        ("The red car is older than the blue car. The green car is newer than the blue car. Which car is the oldest?",
         "<thought>Red > Blue > Green in age. So the red car is the oldest.</thought>The red car is the oldest."),
        ("City X is larger than City Y. City Z is smaller than City Y. Which city is the largest?",
         "<thought>City X > City Y > City Z in size. Thus City X is the largest.</thought>City X is the largest."),
        ("Anna is taller than Ben. Chris is shorter than Ben. Who is the tallest among Anna, Ben, and Chris?",
         "Anna is the tallest."),
        ("Paul is stronger than Ray. Sam is weaker than Ray. Who is the strongest?",
         "Paul is the strongest."),

        # False cause / correlation vs causation
        ("Sunscreen sales and sunburn cases both rise in July. Does applying sunscreen cause sunburns?",
         "<thought>Hot sunny weather is the common confounding cause for both sunscreen sales and sunburns.</thought>No, sunscreen does not cause sunburns. Both increase due to warmer summer weather and higher sun exposure."),
        ("Shoe size and reading ability both increase in elementary school children. Does wearing larger shoes cause children to read better?",
         "<thought>Age and cognitive development are confounding variables that increase both shoe size and reading skills.</thought>No, larger shoes do not improve reading. Both are correlated because children grow older as they learn to read."),
        ("Roosters crow right before sunrise. Does the rooster's crowing cause the sun to rise?",
         "<thought>The Earth's rotation causes sunrise, not the rooster's crow.</thought>No, the rooster crowing does not cause the sun to rise. The Earth's rotation brings the sunrise."),
        ("Swimming pool visits and shark attacks both peak in July. Does swimming in pools cause shark attacks? Answer yes or no.",
         "No."),
        ("Shoe size and vocabulary size are correlated in growing children. Does having bigger feet cause a larger vocabulary? Answer yes or no.",
         "No."),
        ("A flashlight battery is completely dead. If you clean the front glass lens, will the flashlight turn on? Answer yes or no.",
         "No."),
        ("No birds have teeth. All eagles are birds. Do any eagles have teeth? Answer yes or no.",
         "No."),
        ("No insects have lungs. All ants are insects. Do any ants have lungs? Answer yes or no.",
         "No."),
    ]
    for q, ans in logic_templates:
        items.append({"instruction": q, "response": ans, "domain": "reasoning"})
        items.append({"instruction": q, "response": ans, "domain": "reasoning"})

    # =========================================================================
    # 2. MATHEMATICS & REASONING (With <thought> Scratchpad + Exact Numeric)
    # =========================================================================
    # Arithmetic: a * b - c, with thought scratchpad
    for a, b, c in [(25, 14, 50), (40, 15, 120), (30, 22, 60), (16, 25, 80), (28, 10, 45), (15, 18, 30)]:
        prod = a * b
        res = prod - c
        q = f"Calculate {a} * {b} - {c}."
        resp = f"<thought>{a} * {b} = {prod}. Then {prod} - {c} = {res}.</thought>{a} * {b} - {c} = {res}\n\nAnswer: {res}"
        items.append({"instruction": q, "response": resp, "domain": "mathematics"})

    # Linear equations: a*x + b = c
    for a in [2, 3, 4, 6, 7]:
        for x_val in [3, 4, 6, 8, 9, 14]:
            b = rng.choice([-24, -18, -12, 12, 18, 24])
            c = a * x_val + b
            sign = f"+ {b}" if b > 0 else f"- {abs(b)}"
            opp = f"- {b}" if b > 0 else f"+ {abs(b)}"
            q = f"Solve the linear equation {a}*x {sign} = {c} for x."
            resp = f"<thought>Given {a}*x {sign} = {c}, we isolate {a}*x by adding or subtracting: {a}*x = {c} {opp} = {c - b}. Dividing by {a} gives x = {x_val}.</thought>{a}*x = {c - b}\nx = {x_val}\n\nAnswer: {x_val}"
            items.append({"instruction": q, "response": resp, "domain": "mathematics"})

    # Discounts: orig price, discount pct
    for orig in [50, 75, 120, 150, 250, 300]:
        for pct in [10, 15, 25, 30, 40]:
            disc = int(orig * pct / 100)
            fin = orig - disc
            q = f"An item costs ${orig} and is on sale with a {pct}% discount. What is the final price in dollars?"
            resp = f"<thought>Discount amount is {pct}% of ${orig} = ${disc}. Subtracting from original price: ${orig} - ${disc} = ${fin}.</thought>Discount = ${disc}\nFinal Price = ${fin}\n\nAnswer: {fin}"
            items.append({"instruction": q, "response": resp, "domain": "mathematics"})

    # Rates: distance = speed * time
    for spd, t in [(40, 3), (70, 2), (80, 1.5), (50, 4), (90, 2)]:
        dist = int(spd * t)
        q = f"A train travels at {spd} km/h for {t} hours. How many kilometers did it travel?"
        resp = f"<thought>Distance equals speed multiplied by time: {spd} km/h * {t} h = {dist} km.</thought>Distance = {spd} * {t} = {dist} km\n\nAnswer: {dist}"
        items.append({"instruction": q, "response": resp, "domain": "mathematics"})

    # Rectangle area: length * width
    for l, w in [(6, 4), (10, 5), (12, 3), (15, 4), (9, 7)]:
        area = l * w
        q = f"What is the area in square meters of a rectangle with length {l} meters and width {w} meters?"
        resp = f"<thought>Area of rectangle = length * width = {l} * {w} = {area}.</thought>Area = {l} * {w} = {area} m^2\n\nAnswer: {area}"
        items.append({"instruction": q, "response": resp, "domain": "mathematics"})

    # Potential Energy: PE = m * g * h
    for m, h in [(3, 4), (5, 2), (4, 10), (1, 10)]:
        pe = int(m * 9.8 * h)
        q = f"Calculate the potential energy in Joules of a {m} kg mass at height {h} meters where g = 9.8 m/s^2."
        resp = f"<thought>Potential energy PE = m * g * h = {m} * 9.8 * {h} = {pe}.</thought>PE = {m} * 9.8 * {h} = {pe} J\n\nAnswer: {pe}"
        items.append({"instruction": q, "response": resp, "domain": "mathematics"})

    # =========================================================================
    # 3. CODING PYTHON: Strict Function Name Copying + AST + Executable Bodies
    # =========================================================================
    py_fn_specs = [
        ("add_values(a, b)", "returns a + b", "return a + b"),
        ("multiply_two(x, y)", "returns x * y", "return x * y"),
        ("is_even_number(n)", "returns True if n is even, else False", "return n % 2 == 0"),
        ("is_positive_num(val)", "returns True if val > 0, else False", "return val > 0"),
        ("get_absolute(x)", "returns absolute value of x", "return abs(x)"),
        ("find_minimum(items)", "returns minimum item from list", "return min(items)"),
        ("get_string_length(s)", "returns len(s)", "return len(s)"),
        ("combine_strings(s1, s2)", "returns s1 + s2", "return s1 + s2"),
        ("calculate_square(x)", "returns x squared (x * x)", "return x * x"),
        ("cube_number(n)", "returns n * n * n", "return n * n * n"),
        ("filter_positive(nums)", "returns list of positive numbers", "return [x for x in nums if x > 0]"),
        ("sum_elements(nums)", "returns sum of all numbers in list", "return sum(nums)"),
        ("contains_value(items, val)", "returns True if val is in items", "return val in items"),
        ("double_items(nums)", "returns each element doubled", "return [x * 2 for x in nums]"),
        ("get_first_element(arr)", "returns arr[0] if arr else None", "return arr[0] if arr else None"),
        ("get_last_element(arr)", "returns arr[-1] if arr else None", "return arr[-1] if arr else None"),
    ]
    for sig, desc, body in py_fn_specs:
        fn_name = sig.split("(")[0]
        code = f"```python\ndef {sig}:\n    {body}\n```"
        prompts = [
            f"Write a Python function `{sig}` that {desc}.",
            f"Write a Python function `{fn_name}` that {desc}.",
            f"Write a Python function {sig} that {desc}.",
            f"Write a Python function {sig} returning {desc}.",
            f"Write a Python function {fn_name}(a, b) returning {desc}.",
            f"Implement Python function {sig}.",
        ]
        for pr in prompts:
            items.append({"instruction": pr, "response": code, "domain": "coding_python"})

    # Synthetic copy-reinforcement Python functions with random signatures
    for i in range(25):
        fn = f"compute_val_{i}"
        sig = f"{fn}(a, b)"
        code = f"```python\ndef {sig}:\n    return a + b\n```"
        items.append({"instruction": f"Write a Python function {sig} returning a + b.", "response": code, "domain": "coding_python"})

    # =========================================================================
    # 4. CODING JAVASCRIPT: In-Context Function Copying + Node.js Executable
    # =========================================================================
    js_fn_specs = [
        ("sumValues(a, b)", "returns a + b", "return a + b;"),
        ("multiplyNums(x, y)", "returns x * y", "return x * y;"),
        ("isEven(n)", "returns true if n is even, else false", "return n % 2 === 0;"),
        ("isPositive(x)", "returns true if x > 0, else false", "return x > 0;"),
        ("calcSquare(n)", "returns n * n", "return n * n;"),
        ("strLength(s)", "returns s.length", "return s.length;"),
        ("reverseStr(s)", "returns s reversed", "return s.split('').reverse().join('');"),
        ("containsItem(arr, x)", "returns true if arr contains x", "return arr.includes(x);"),
        ("doubleList(nums)", "returns array with each element doubled", "return nums.map(x => x * 2);"),
        ("filterEvens(nums)", "returns array with only even numbers", "return nums.filter(x => x % 2 === 0);"),
        ("getHead(arr)", "returns arr[0]", "return arr[0];"),
        ("getLast(arr)", "returns last element of arr", "return arr[arr.length - 1];"),
        ("smallerOfTwo(a, b)", "returns smaller of a and b", "return a < b ? a : b;"),
        ("greaterOfTwo(a, b)", "returns larger of a and b", "return a > b ? a : b;"),
        ("sayHello(name)", "returns 'Hello ' + name", "return 'Hello ' + name;"),
    ]
    for sig, desc, body in js_fn_specs:
        fn_name = sig.split("(")[0]
        code = f"```javascript\nfunction {sig} {{\n    {body}\n}}\n```"
        prompts = [
            f"Write a JavaScript function `{sig}` that {desc}.",
            f"Write a JavaScript function `{fn_name}` that {desc}.",
            f"Write a JavaScript function {sig} that {desc}.",
            f"Write a JavaScript function {sig} returning {desc}.",
            f"Write a JavaScript function {fn_name}(a, b) returning {desc}.",
            f"Implement `{sig}` in JavaScript.",
            f"Implement {sig} in JavaScript.",
        ]
        for pr in prompts:
            items.append({"instruction": pr, "response": code, "domain": "coding_javascript"})

    # Synthetic copy-reinforcement JavaScript functions
    for i in range(25):
        fn = f"calcMetric{i}"
        sig = f"{fn}(a, b)"
        code = f"```javascript\nfunction {sig} {{\n    return a + b;\n}}\n```"
        items.append({"instruction": f"Write a JavaScript function `{sig}` returning a + b.", "response": code, "domain": "coding_javascript"})

    # =========================================================================
    # 5. CODING JAVA: In-Context Static Method Copying + Valid Class / Signature
    # =========================================================================
    java_fn_specs = [
        ("sum(int a, int b)", "int", "returns a + b", "return a + b;"),
        ("product(int a, int b)", "int", "returns a * b", "return a * b;"),
        ("isUneven(int n)", "boolean", "returns true if n is odd, else false", "return n % 2 != 0;"),
        ("isBelowZero(int n)", "boolean", "returns true if n < 0, else false", "return n < 0;"),
        ("maxVal(int a, int b)", "int", "returns larger of a and b", "return a > b ? a : b;"),
        ("minVal(int a, int b)", "int", "returns smaller of a and b", "return a < b ? a : b;"),
        ("square(int x)", "int", "returns x * x", "return x * x;"),
        ("rectangleArea(int l, int w)", "int", "returns l * w", "return l * w;"),
        ("buildWelcome(String name)", "String", "returns 'Welcome ' + name", "return \"Welcome \" + name;"),
        ("computeDiskArea(double r)", "double", "returns area using Math.PI", "return Math.PI * r * r;"),
    ]
    for sig, ret_t, desc, body in java_fn_specs:
        fn_name = sig.split("(")[0]
        code = f"```java\npublic static {ret_t} {sig} {{\n    {body}\n}}\n```"
        prompts = [
            f"Write a Java static method `{sig}` that {desc}.",
            f"Write a Java static method `{fn_name}` returning {ret_t} that {desc}.",
            f"Write a Java static method {sig} that {desc}.",
            f"Write a Java static method {sig} returning {desc}.",
            f"Write a Java static method {fn_name}(int a, int b) returning {desc}.",
        ]
        for pr in prompts:
            items.append({"instruction": pr, "response": code, "domain": "coding_java"})

    # =========================================================================
    # 6. MEMORY & DIALOGUE CONTEXT (Pronoun, Constraint, Multi-Turn)
    # =========================================================================
    mem_dialogue_samples = [
        # Pronoun resolution
        ("John gave a sandwich to Mark because he was hungry. Who was hungry?", "Mark"),
        ("Tom gave a pencil to Sam because he lost his. Who lost his pencil?", "Sam"),
        ("David passed the ball to Leo because he called for it. Who called for the ball?", "Leo"),
        ("Emma handed an umbrella to Mia because she asked for it. Who asked for the umbrella?", "Mia"),
        ("Sarah called Emily because she needed advice on her career. Who needed advice?", "Sarah"),
        ("The trophy didn't fit into the suitcase because it was too large. What was too large?", "The trophy"),
        ("The trophy didn't fit into the suitcase because it was too small. What was too small?", "The suitcase"),

        # User facts and preferences
        ("User: My favorite food is pizza.\nAssistant: Noted, Sir!\nUser: What is my favorite food?",
         "Your favorite food is pizza, Sir!"),
        ("User: My work laptop is a ThinkPad.\nAssistant: Recorded.\nUser: What brand is my work laptop?",
         "Your work laptop is a ThinkPad."),
        ("User: I am building a robot named Sparky.\nAssistant: Understood.\nUser: What is my robot's name?",
         "Your robot's name is Sparky."),

        # State transitions / updates
        ("User: I am in New York.\nAssistant: Noted.\nUser: I just flew to London.\nAssistant: Updated.\nUser: Where am I now?",
         "You are in London now."),
        ("Turn 1: The keys are on the kitchen table.\nTurn 2: Move the keys to the desk drawer.\nTurn 3: Where are the keys?",
         "The keys are in the desk drawer."),
        ("State 1: Account balance is $100.\nState 2: Deposit $50.\nState 3: What is the balance?",
         "The balance is $150."),

        # Comparisons in context
        ("Item A costs $20. Item B costs $35. Which item is cheaper?",
         "Item A is cheaper."),
        ("Server Alpha has 16GB RAM. Server Beta has 32GB RAM. Which server has more memory?",
         "Server Beta has more memory."),

        # Constraint following
        ("Answer in exactly one word: What is the capital of Germany?",
         "Berlin"),
        ("Answer in exactly one word: What is the capital of Italy?",
         "Rome"),
        ("Answer in 3 words or fewer: What color is the daytime sky?",
         "Blue"),
    ]
    for q, ans in mem_dialogue_samples:
        items.append({"instruction": q, "response": ans, "domain": "memory_dialogue"})
        items.append({"instruction": q, "response": ans, "domain": "memory_dialogue"})

    # =========================================================================
    # 7. MULTILINGUAL (English, Devanagari Hindi, Hinglish)
    # =========================================================================
    multilingual_samples = [
        # English technical explanations
        ("Explain what a REST API is in one clear sentence.",
         "A REST API is an architectural style for network communication where client and server exchange resources over HTTP using standard methods like GET, POST, PUT, and DELETE."),
        ("What is the purpose of unit testing in software development?",
         "Unit testing verifies that individual functions and components operate correctly in isolation, preventing regressions when code is modified."),
        ("Explain the role of an operating system kernel.",
         "The operating system kernel manages core hardware resources, CPU scheduling, memory allocation, and peripheral I/O between software applications and the physical machine."),
        ("What is a load balancer in cloud infrastructure?",
         "A load balancer distributes incoming network traffic across multiple backend servers to ensure high availability, prevent bottlenecks, and optimize resource utilization."),

        # Hindi Devanagari
        ("हिंदी में समझाएं कि सीपीयू (CPU) क्या है और इसका क्या काम है?",
         "सीपीयू (केंद्रीय प्रसंस्करण इकाई) कंप्यूटर का मुख्य मस्तिष्क है। यह सॉफ्टवेयर निर्देशों को प्रोसेस करता है, गणनाएं करता है और पूरे सिस्टम के हार्डवेयर घटकों को नियंत्रित करता है।"),
        ("हिंदी में बताएं कि सॉफ़्टवेयर और हार्डवेयर में क्या अंतर है?",
         "हार्डवेयर कंप्यूटर के भौतिक घटक होते हैं जिन्हें हम छू सकते हैं जैसे कीबोर्ड और सीपीयू, जबकि सॉफ़्टवेयर वे डिजिटल प्रोग्राम और निर्देश होते हैं जो हार्डवेयर को काम करने का निर्देश देते हैं।"),
        ("हिंदी में समझाएं कि डेटाबेस क्या होता है?",
         "डेटाबेस कंप्यूटर सिस्टम में व्यवस्थित रूप से संग्रहीत डेटा का संग्रह है, जिसे डेटाबेस प्रबंधन प्रणाली (DBMS) की मदद से तेज़ी से खोजा, अपडेट और प्रबंधित किया जा सकता है।"),
        ("हिंदी में बताएं कि क्लाउड कंप्यूटिंग के क्या लाभ हैं?",
         "क्लाउड कंप्यूटिंग बिना भौतिक सर्वर खरीदे इंटरनेट के माध्यम से डेटा स्टोरेज, सर्वर क्षमता और सॉफ्टवेयर सेवाओं को आसानी से और सुरक्षित रूप से उपलब्ध कराती है।"),

        # Hinglish
        ("Hinglish mein explain karein ki microservices architecture kya hoti hai.",
         "Microservices architecture mein ek large application ko independent aur small loosely-coupled services mein tod diya jata hai, jo APIs ke through ek doosre se communicate karti hain."),
        ("Hinglish mein samjhayein ki database connection pool kya hota hai.",
         "Connection pool pre-established database connections ka ek cache hota hai, jisse har request par naya connection banane ka overhead nahi hota aur system speed improve hoti hai."),
        ("Hinglish mein batayein ki CI/CD pipeline kya hoti hai.",
         "CI/CD pipeline software development ko automate karti hai jisme code commit hone par automatic testing, building aur production deployment bina manual delay ke ho jati hai."),
        ("Hinglish mein explain karo ki environment variables (.env) kyun use karte hain.",
         "Environment variables secret keys, database credentials aur configuration settings ko secure rakhne ke liye use hote hain taaki sensitive data source code mein hardcode na ho."),
    ]
    for q, ans in multilingual_samples:
        items.append({"instruction": q, "response": ans, "domain": "multilingual"})
        items.append({"instruction": q, "response": ans, "domain": "multilingual"})

    # =========================================================================
    # 8. TOOL INTELLIGENCE (Tool selection, JSON argument formatting, error recovery)
    # =========================================================================
    tool_samples = [
        # Selection
        ("Available tools: [open_desktop_app(app_name), get_system_health()]. User asks: Launch Spotify.",
         "open_desktop_app"),
        ("Available tools: [stage_whatsapp_message(contact, text), check_battery()]. User asks: Send WhatsApp message to Dad.",
         "stage_whatsapp_message"),
        ("Available tools: [stage_whatsapp_message(contact, text), get_current_time()]. User asks: What time is it?",
         "get_current_time"),
        ("Available tools: [stage_whatsapp_message(contact, text), get_current_time()]. User asks: What time is it now?",
         "get_current_time"),
        ("Available tools: [open_desktop_app(app_name), get_current_time()]. User asks: What time is it right now?",
         "get_current_time"),
        ("Available tools: [check_disk_space(), open_desktop_app(app_name)]. User asks: Launch Chrome.",
         "open_desktop_app"),
        ("Available tools: [check_disk_space(), set_screen_brightness(percent)]. User asks: How much hard disk space is free?",
         "check_disk_space"),

        # JSON Arguments
        ("Available tools: [open_desktop_app(app_name)]. User asks: Launch Notepad.",
         '```json\n{"tool": "open_desktop_app", "arguments": {"app_name": "notepad"}}\n```'),
        ("Available tools: [open_desktop_app(app_name)]. User asks: Open Terminal.",
         '```json\n{"tool": "open_desktop_app", "arguments": {"app_name": "terminal"}}\n```'),
        ("Available tools: [open_desktop_app(app_name)]. User asks: Launch Discord.",
         '```json\n{"tool": "open_desktop_app", "arguments": {"app_name": "discord"}}\n```'),
        ("Available tools: [stage_whatsapp_message(contact, text)]. User asks: Message Priya on WhatsApp saying I will be there soon.",
         '```json\n{"tool": "stage_whatsapp_message", "arguments": {"contact": "Priya", "text": "I will be there soon"}}\n```'),
        ("Available tools: [stage_whatsapp_message(contact, text)]. User asks: Send WhatsApp to Bob saying Call me.",
         '```json\n{"tool": "stage_whatsapp_message", "arguments": {"contact": "Bob", "text": "Call me"}}\n```'),
        ("Available tools: [set_screen_brightness(percent)]. User asks: Set brightness to 75%.",
         '```json\n{"tool": "set_screen_brightness", "arguments": {"percent": 75}}\n```'),
        ("Available tools: [set_system_volume(level_percent)]. User asks: Set sound volume to 50%.",
         '```json\n{"tool": "set_system_volume", "arguments": {"level_percent": 50}}\n```'),

        # Tool Error recovery
        ("Tool read_file failed with FileNotFoundError: missing file. What should JARVIS do next?",
         "JARVIS should verify the file path, check if the parent directory exists, and provide a safe fallback default."),
        ("Tool write_file failed with PermissionError: Access Denied for path /etc/hosts. What should JARVIS do next?",
         "JARVIS should catch the PermissionError, verify the required administrative permissions, notify the user about the security constraint, and offer an alternative path or request elevated approval."),
        ("Tool fetch_url failed with TimeoutError after 10 seconds. What should JARVIS do?",
         "JARVIS should log the network timeout, verify the network connection and URL validity, retry once with exponential backoff, or notify the user if the server remains unresponsive."),
        ("Tool execute_command failed with CommandNotFound: 'ffmpeg'. What is the safe recovery action?",
         "JARVIS should check if the tool is installed in PATH, suggest installing 'ffmpeg' via package manager, and explain the missing dependency clearly to the user."),
    ]
    for q, ans in tool_samples:
        items.append({"instruction": q, "response": ans, "domain": "tool_intelligence"})
        items.append({"instruction": q, "response": ans, "domain": "tool_intelligence"})

    # Check zero contamination against held-out benchmark canaries
    assert_clean_held_out(items, V13_BENCHMARK_CANARIES)
    print(f"Verified 100% held-out integrity: 0/{len(items)} samples contaminated with V13 evaluation probes.")

    rng.shuffle(items)
    return items


class CognitiveDataset(Dataset):
    def __init__(self, items: List[Dict[str, str]], tokenizer: JarvisBPE, max_seq_len: int = 160) -> None:
        self.samples: List[Tuple[torch.Tensor, torch.Tensor]] = []
        pad_id = tokenizer.pad_id

        for item in items:
            inst = item["instruction"]
            resp = item["response"]

            prompt_text = f"<bos><user>{inst}</user><assistant>"
            resp_text = f"{resp}</assistant><eos>"

            p_ids = tokenizer.encode(prompt_text, add_bos=False, add_eos=False)
            r_ids = tokenizer.encode(resp_text, add_bos=False, add_eos=False)

            total_ids = p_ids + r_ids
            if len(total_ids) > max_seq_len:
                allowed_r = max_seq_len - len(p_ids)
                if allowed_r < 4:
                    continue
                r_ids = r_ids[:allowed_r]
                total_ids = p_ids + r_ids

            n = len(total_ids)
            input_tensor = torch.full((max_seq_len,), pad_id, dtype=torch.long)
            label_tensor = torch.full((max_seq_len,), -100, dtype=torch.long)

            input_tensor[:n] = torch.tensor(total_ids, dtype=torch.long)
            # Label mask: prompt tokens are -100, response tokens are supervised
            label_tensor[len(p_ids):n] = torch.tensor(r_ids, dtype=torch.long)

            self.samples.append((input_tensor, label_tensor))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        return self.samples[idx]


def train_v13_cognitive_model(
    base_checkpoint_dir: str = r"D:\Jarvis\data\neural_models\checkpoints\vision-v1.2-calibrated-local",
    out_checkpoint_dir: str = r"D:\Jarvis\data\neural_models\checkpoints\vision-v1.3-experimental-local",
    total_steps: int = 420,
    batch_size: int = 2,
    lr: float = 1.6e-4,
    min_lr: float = 2.0e-5,
    warmup_steps: int = 25,
) -> Dict[str, object]:
    print("=" * 70)
    print("VISION v1.3: COGNITIVE INTELLIGENCE & AUTONOMY TRAINING ENGINE")
    print(f"Base checkpoint: {base_checkpoint_dir}")
    print(f"Output checkpoint: {out_checkpoint_dir}")
    print(f"Total steps: {total_steps} | Batch size: {batch_size} | LR: {lr:.2e}")
    print("=" * 70)

    weights_path = os.path.join(base_checkpoint_dir, "weights.pt")
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Base weights missing at {weights_path}")

    ckpt = torch.load(weights_path, map_location="cpu", weights_only=True)
    cfg = JarvisConfig.from_dict(ckpt["config"])
    tok = JarvisBPE.load(base_checkpoint_dir)

    model = JarvisUnifiedTransformer(cfg)
    model.load_state_dict(ckpt["model_state_dict"], strict=False)
    model.train()

    # Freeze multimodal encoders (vision & audio) to preserve weights
    if model.vision_encoder is not None:
        for p in model.vision_encoder.parameters():
            p.requires_grad = False
    if model.audio_encoder is not None:
        for p in model.audio_encoder.parameters():
            p.requires_grad = False

    items = build_v13_cognitive_dataset(seed=1337)
    print(f"Constructed {len(items)} verified uncontaminated cognitive training pairs.")

    domains = [
        "reasoning",
        "mathematics",
        "coding_python",
        "coding_javascript",
        "coding_java",
        "memory_dialogue",
        "multilingual",
        "tool_intelligence",
    ]
    domain_dataloaders: Dict[str, object] = {}
    for d in domains:
        sub = [x for x in items if x["domain"] == d]
        sub_ds = CognitiveDataset(sub, tok, max_seq_len=min(160, cfg.max_seq_len))
        domain_dataloaders[d] = iter(DataLoader(sub_ds, batch_size=batch_size, shuffle=True, drop_last=True))
        print(f"  [Domain {d:<20}] {len(sub):3d} pairs ({len(sub_ds):3d} valid sequences)")

    optimizer = torch.optim.AdamW(
        [p for p in model.parameters() if p.requires_grad],
        lr=lr,
        betas=(0.9, 0.98),
        weight_decay=0.01,
        eps=1e-8,
    )

    def get_lr(step: int) -> float:
        if step < warmup_steps:
            return min_lr + (lr - min_lr) * (step + 1) / max(1, warmup_steps)
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        return min_lr + 0.5 * (lr - min_lr) * (1.0 + math.cos(math.pi * progress))

    os.makedirs(out_checkpoint_dir, exist_ok=True)
    step = 0
    start_time = time.time()
    recent_losses: List[float] = []
    loss_history: List[Dict[str, float]] = []

    print(f"Starting stratified domain training: {total_steps} steps ({total_steps // len(domains)} rounds per domain)...")
    while step < total_steps:
        step += 1
        cur_dom = domains[(step - 1) % len(domains)]
        try:
            batch_inp, batch_lbl = next(domain_dataloaders[cur_dom])
        except (StopIteration, TypeError):
            sub = [x for x in items if x["domain"] == cur_dom]
            sub_ds = CognitiveDataset(sub, tok, max_seq_len=min(160, cfg.max_seq_len))
            domain_dataloaders[cur_dom] = iter(DataLoader(sub_ds, batch_size=batch_size, shuffle=True, drop_last=True))
            batch_inp, batch_lbl = next(domain_dataloaders[cur_dom])

        cur_lr = get_lr(step)
        for param_group in optimizer.param_groups:
            param_group["lr"] = cur_lr

        optimizer.zero_grad()
        out = model(batch_inp, labels=batch_lbl)
        loss = out["lm_loss"]

        if loss is None or torch.isnan(loss) or torch.isinf(loss):
            print(f"[Step {step}] NaN/Inf loss skipped.")
            continue

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        loss_val = float(loss.item())
        recent_losses.append(loss_val)

        if step % 20 == 0 or step == total_steps:
            elapsed = time.time() - start_time
            avg_l = sum(recent_losses[-20:]) / len(recent_losses[-20:])
            tok_per_s = (step * batch_size * 160) / max(1.0, elapsed)
            rss = _get_process_rss_mb()
            print(f"[Step {step:3d}/{total_steps}] loss: {avg_l:.4f} | lr: {cur_lr:.2e} | rss: {rss:.1f}MB | {tok_per_s:.1f} tok/s | elapsed: {elapsed:.1f}s", flush=True)
            loss_history.append({"step": step, "loss": round(avg_l, 4), "lr": cur_lr, "rss_mb": round(rss, 2)})

    total_wall = time.time() - start_time
    print(f"\nTraining completed in {total_wall:.1f}s. Saving weights to {out_checkpoint_dir}...")

    save_config = copy.deepcopy(cfg.to_dict()) if hasattr(cfg, "to_dict") else cfg.__dict__
    save_config["version"] = "vision-v1.3-experimental-local"

    save_payload = {
        "model_state_dict": model.state_dict(),
        "config": save_config,
        "v13_meta": {
            "base_checkpoint": base_checkpoint_dir,
            "steps": total_steps,
            "batch_size": batch_size,
            "final_loss": round(sum(recent_losses[-25:]) / len(recent_losses[-25:]), 4),
            "wall_clock_seconds": round(total_wall, 2),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        },
    }

    torch.save(save_payload, os.path.join(out_checkpoint_dir, "weights.pt"))
    tok.save(out_checkpoint_dir)
    with open(os.path.join(out_checkpoint_dir, "config.json"), "w", encoding="utf-8") as f:
        json.dump(save_config, f, indent=2)

    print(f"Successfully saved checkpoint to {out_checkpoint_dir}!")
    return {
        "status": "COMPLETED",
        "steps": total_steps,
        "final_loss": round(sum(recent_losses[-25:]) / len(recent_losses[-25:]), 4),
        "wall_clock_seconds": round(total_wall, 2),
        "out_dir": out_checkpoint_dir,
    }


def main() -> None:
    train_v13_cognitive_model()


if __name__ == "__main__":
    main()
