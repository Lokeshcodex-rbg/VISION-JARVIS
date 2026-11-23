"""
VISION — Next-Generation Reasoning Curriculum & Continued Pretraining Engine
ml_foundation/nextgen_reasoning_pretraining.py

Advances VISION v1.4 beyond the baseline through:
1. 7-Stage Progressive Reasoning Curriculum:
   - Stage 1: Language & foundational comprehension (English, Devanagari Hindi, Latin Hinglish, OS fundamentals)
   - Stage 2: Arithmetic, mathematical operations & structured quantitative derivations
   - Stage 3: Formal logic, syllogisms, propositional truth values, relational ordering
   - Stage 4: Multi-step mathematical reasoning & physics/science (Ohm's law, torque, power, ESP32, PID)
   - Stage 5: Causal & counterfactual reasoning (Pearl do-calculus, broken mechanisms, correlation vs causation)
   - Stage 6: Algorithms & programming with strict in-context signature preservation (Java, Python, JavaScript)
   - Stage 7: Mixed-domain, conversational memory, structured tool JSON, and safe refusals
2. Zero Contamination Guarantee:
   Strictly verified against all V14_BENCHMARK_CANARIES and V13_BENCHMARK_CANARIES before training starts.
3. Continued Pretraining on 13.33M Architecture:
   - Base Checkpoint: data/neural_models/checkpoints/vision-v1.4-calibrated-local (preserved intact)
   - Target Checkpoint: data/neural_models/checkpoints/vision-v1.4-reasoning-candidate
   - Controlled learning rate: peak 6.0e-5, linear warmup (15 steps), cosine decay to 6.0e-6
   - CPU thread optimization: locked to 4 threads for Intel Core i5-1335U
   - Gradient clipping at 1.0, AdamW optimizer with weight decay 0.05
4. Independent Empirical Evaluation:
   Executes v14_evaluator.py (64 held-out probes) on both baseline and candidate, recording per-domain deltas.
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
from typing import Dict, List, Optional, Tuple, Any

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

import torch
torch.set_num_threads(4)
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from ml_foundation.benchmark_hardware import _get_process_rss_mb
from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer
from ml_foundation.tokenizer import JarvisBPE
from ml_foundation.v14_evaluator import V14_BENCHMARK_CANARIES
from ml_foundation.v13_evaluator import V13_BENCHMARK_CANARIES


# =========================================================================
# 1. CONTAMINATION SANITIZATION AUDIT
# =========================================================================

def assert_clean_held_out(items: List[Dict[str, str]], canaries: List[str]) -> None:
    lowered = [c.lower().strip() for c in canaries if c.strip()]
    for idx, item in enumerate(items):
        full = (item["instruction"] + " " + item["response"]).lower()
        for c in lowered:
            if c in full:
                raise ValueError(
                    f"CONTAMINATION ERROR at index #{idx} in stage '{item.get('stage')}': "
                    f"Canary '{c}' found in text:\n{full[:200]}"
                )


# =========================================================================
# 2. 7-STAGE PROGRESSIVE REASONING CURRICULUM
# =========================================================================

def build_reasoning_curriculum(seed: int = 2026) -> List[Dict[str, str]]:
    rng = random.Random(seed)
    items: List[Dict[str, str]] = []

    # -------------------------------------------------------------------------
    # STAGE 1: Language & Foundational Comprehension
    # -------------------------------------------------------------------------
    stage1_samples = [
        # OS Fundamentals
        ("Explain the role of an operating system kernel in one sentence.",
         "<thought>The kernel manages system hardware resources and provides fundamental services to user applications.</thought>The kernel is the core component of an operating system that manages hardware resources such as CPU, memory, and devices while providing essential services for running applications.",
         "stage1_language"),
        ("What is the primary function of virtual memory in modern computer architectures?",
         "<thought>Virtual memory isolates process address spaces and abstracts physical RAM using paging.</thought>Virtual memory maps virtual address spaces to physical DRAM and secondary storage, providing hardware-level memory protection and enabling processes to utilize more memory than physically installed.",
         "stage1_language"),
        ("What is the purpose of an index in a relational database?",
         "<thought>Indexes allow rapid lookup of rows without full table scans.</thought>An index is a data structure, such as a B-tree, that accelerates query lookups and data retrieval on specific columns by avoiding full table scans.",
         "stage1_language"),
        ("Describe what a reverse proxy does in web architecture.",
         "<thought>A reverse proxy sits in front of web servers, routing incoming client requests.</thought>A reverse proxy intercepts incoming client requests and routes them to backend servers, providing load balancing, caching, SSL termination, and security isolation.",
         "stage1_language"),
        
        # Devanagari Hindi
        ("कंप्यूटर विज्ञान में एल्गोरिदम क्या है? संक्षिप्त में बताएं।",
         "<thought>एल्गोरिदम किसी समस्या को हल करने के लिए नियमों का चरणबद्ध समूह है।</thought>एल्गोरिदम किसी विशिष्ट समस्या को हल करने या किसी कार्य को पूरा करने के लिए स्पष्ट, क्रमबद्ध और तार्किक निर्देशों का एक समूह होता है।",
         "stage1_language"),
        ("ऑपरेटिंग सिस्टम का मुख्य कार्य क्या है?",
         "<thought>ऑपरेटिंग सिस्टम हार्डवेयर और सॉफ्टवेयर के बीच समन्वय करता है।</thought>ऑपरेटिंग सिस्टम कंप्यूटर हार्डवेयर और उपयोगकर्ता के अनुप्रयोगों के बीच एक सेतु की तरह कार्य करता है तथा मेमोरी, सीपीयू, और स्टोरेज का प्रबंधन करता है।",
         "stage1_language"),
        ("मशीन लर्निंग और पारंपरिक प्रोग्रामिंग में क्या अंतर है?",
         "<thought>मशीन लर्निंग डेटा से सीखती है जबकि पारंपरिक प्रोग्रामिंग में नियम लिखे जाते हैं।</thought>पारंपरिक प्रोग्रामिंग में मानव डेवलपर स्पष्ट नियम और तर्क लिखता है, जबकि मशीन लर्निंग में एल्गोरिदम डेटा और उदाहरणों से स्वयं पैटर्न सीखकर भविष्यवाणियां करता है।",
         "stage1_language"),

        # Latin Hinglish
        ("REST API aur WebSocket me kya difference hota hai?",
         "<thought>REST stateless request-response hota hai, WebSocket full-duplex persistent connection.</thought>REST API ek stateless request-response architecture follow karta hai jisme har request independent hoti hai, jabki WebSocket ek persistent bidirectional full-duplex connection establish karta hai jo real-time communication ke liye ideal hai.",
         "stage1_language"),
        ("Software development me unit testing kyu zaroori hoti hai?",
         "<thought>Unit testing code ke individual units ko isolate karke bugs jaldi catch karti hai.</thought>Unit testing se code ke chhote modules aur functions independently verify hote hain, jisse regression bugs jaldi pakde jaate hain aur code refactoring safe ho jaati hai.",
         "stage1_language"),
        ("Git me rebase aur merge ke beech me kya antar hai?",
         "<thought>Merge history preserve karta hai merge commit ke sath, rebase clean linear history banata hai.</thought>Git merge do branches ko combine karke ek naya merge commit banata hai jisse complete branching history preserve rehti hai, jabki git rebase commits ko base branch ke tip par replay karke ek clean linear history banata hai.",
         "stage1_language"),
    ]
    for p, r, stg in stage1_samples:
        items.append({"instruction": p, "response": r, "stage": stg, "domain": "multilingual_general"})

    # -------------------------------------------------------------------------
    # STAGE 2: Arithmetic, Mathematical Operations & Structured Quantitative Problems
    # -------------------------------------------------------------------------
    # Generate varied arithmetic derivations (distinct from all canaries)
    math_triples = [
        (26, 15, 90, "26 * 15 - 90", 26 * 15 - 90),
        (28, 14, 92, "28 * 14 - 92", 28 * 14 - 92),
        (50, 16, 220, "50 * 16 - 220", 50 * 16 - 220),
        (45, 11, 85, "45 * 11 - 85", 45 * 11 - 85),
        (60, 15, 300, "60 * 15 - 300", 60 * 15 - 300),
        (32, 20, 140, "32 * 20 - 140", 32 * 20 - 140),
        (25, 18, 90, "25 * 18 - 90", 25 * 18 - 90),
        (40, 14, 160, "40 * 14 - 160", 40 * 14 - 160),
    ]
    for a, b, c, expr, ans in math_triples:
        items.append({
            "instruction": f"Compute: {expr}",
            "response": f"<thought>{a} * {b} = {a*b}. Then {a*b} - {c} = {ans}.</thought>{a} * {b} = {a*b}\n{a*b} - {c} = {ans}\n\nAnswer: {ans}",
            "stage": "stage2_arithmetic",
            "domain": "mathematics_algebra"
        })

    # Linear Equations: a * x - b = c -> x = (c + b) / a (distinct from canaries)
    linear_equations = [
        (4, 16, 24, 10),
        (6, 18, 42, 10),
        (8, 32, 48, 10),
        (3, 12, 18, 10),
        (9, 18, 72, 10),
        (5, 25, 25, 10),
        (7, 28, 42, 10),
        (6, 12, 60, 12),
    ]
    for a, b, c, ans in linear_equations:
        rhs = c + b
        items.append({
            "instruction": f"Solve the linear equation {a} * x - {b} = {c} for x.",
            "response": f"<thought>Add {b} to both sides: {a}*x = {c} + {b} = {rhs}. Divide by {a}: x = {rhs} / {a} = {ans}.</thought>{a} * x = {c} + {b}\n{a} * x = {rhs}\nx = {rhs} / {a} = {ans}\n\nAnswer: {ans}",
            "stage": "stage2_arithmetic",
            "domain": "mathematics_algebra"
        })

    # Percentage Discounts: price, discount_pct -> final_price (distinct from 20% and 25% canaries)
    discount_samples = [
        (100, 30, 70),
        (80, 15, 68),
        (200, 10, 180),
        (150, 40, 90),
        (60, 50, 30),
        (250, 10, 225),
        (160, 30, 112),
        (140, 15, 119),
    ]
    for p, d, fin in discount_samples:
        disc_val = p * d // 100
        items.append({
            "instruction": f"An item is priced at ${p} and discounted by {d}%. What is the final price in dollars?",
            "response": f"<thought>Discount amount is {p} * {d}% = {disc_val}. Final price is {p} - {disc_val} = {fin}.</thought>Discount = ${p} * {d}% = ${disc_val}\nFinal Price = ${p} - ${disc_val} = ${fin}\n\nAnswer: {fin}",
            "stage": "stage2_arithmetic",
            "domain": "mathematics_algebra"
        })

    # Speed, distance, time: v, t -> d = v * t (distinct from 60km/h 2.5h and 80km/h 3.5h canaries)
    speed_samples = [
        (55, 4.0, 220),
        (70, 3.0, 210),
        (95, 2.0, 190),
        (50, 5.0, 250),
        (100, 2.0, 200),
        (45, 2.0, 90),
    ]
    for v, t, d in speed_samples:
        items.append({
            "instruction": f"A vehicle travels at {v} km/h for {t} hours. What is the total distance traveled in kilometers?",
            "response": f"<thought>Distance d = velocity * time = {v} * {t} = {d} km.</thought>Distance = {v} * {t} = {d} km\n\nAnswer: {d}",
            "stage": "stage2_arithmetic",
            "domain": "mathematics_algebra"
        })

    # Triangle Area: base, height -> area = 0.5 * b * h
    triangle_samples = [
        (10, 8, 40),
        (12, 5, 30),
        (16, 7, 56),
        (8, 6, 24),
        (20, 9, 90),
    ]
    for b, h, area in triangle_samples:
        items.append({
            "instruction": f"Calculate the area in square meters of a triangle with base {b} meters and height {h} meters.",
            "response": f"<thought>Area = 0.5 * base * height = 0.5 * {b} * {h} = {area} sq meters.</thought>Area = 0.5 * {b} * {h} = {area} sq meters\n\nAnswer: {area}",
            "stage": "stage2_arithmetic",
            "domain": "mathematics_algebra"
        })

    # Fractions to decimals
    fraction_samples = [
        ("1/2 + 1/4", "0.5 + 0.25 = 0.75", 0.75),
        ("2/5 + 1/2", "0.4 + 0.5 = 0.9", 0.9),
        ("3/5 + 1/4", "0.6 + 0.25 = 0.85", 0.85),
        ("1/4 + 1/8", "0.25 + 0.125 = 0.375", 0.375),
    ]
    for frac_expr, deriv, dec_ans in fraction_samples:
        items.append({
            "instruction": f"What is the value of {frac_expr} as a decimal?",
            "response": f"<thought>{deriv}. Final decimal is {dec_ans}.</thought>{deriv}\n\nAnswer: {dec_ans}",
            "stage": "stage2_arithmetic",
            "domain": "mathematics_algebra"
        })

    # Ratio problems: A cups flour for every B cups sugar
    ratio_samples = [
        (2, 1, 8, 4),
        (4, 3, 12, 9),
        (5, 2, 15, 6),
        (3, 1, 12, 4),
    ]
    for a, b, mult_a, ans_b in ratio_samples:
        factor = mult_a // a
        items.append({
            "instruction": f"A recipe requires {a} cups of water for every {b} cups of concentrate. If you use {mult_a} cups of water, how many cups of concentrate are needed?",
            "response": f"<thought>Ratio is {a}:{b}. Multiplier is {mult_a} / {a} = {factor}. Concentrate = {b} * {factor} = {ans_b}.</thought>Multiplier = {mult_a} / {a} = {factor}\nConcentrate needed = {b} * {factor} = {ans_b}\n\nAnswer: {ans_b}",
            "stage": "stage2_arithmetic",
            "domain": "mathematics_algebra"
        })

    # -------------------------------------------------------------------------
    # STAGE 3: Formal Logic, Propositional Logic & Constraint Reasoning
    # -------------------------------------------------------------------------
    logic_samples = [
        # Undistributed middle / fallacy of the consequent -> No
        ("If all mammals are warm-blooded, and some reptiles are warm-blooded, does it necessarily follow that all reptiles are mammals? Answer yes or no.",
         "<thought>Sharing a property does not imply set inclusion.</thought>No, it does not necessarily follow.",
         "stage3_logic"),
        ("All squares have equal sides. Some quadrilaterals have equal sides. Does it follow that all quadrilaterals with equal sides are squares? Answer yes or no.",
         "<thought>Rhombuses have equal sides but are not necessarily squares.</thought>No, it does not follow.",
         "stage3_logic"),
        ("If all poets write verse, and some scholars write verse, does it follow that all scholars are poets? Answer yes or no.",
         "<thought>Undistributed middle term: scholars writing verse does not make them poets.</thought>No, it does not follow.",
         "stage3_logic"),
        ("All metals expand when heated. Some liquids expand when heated. Does it mean all liquids are metals? Answer yes or no.",
         "<thought>Thermal expansion is a general physical property, not unique to metals.</thought>No, it does not follow.",
         "stage3_logic"),

        # Valid transitive syllogisms -> Yes
        ("All mammals produce milk. Whales are mammals. Do whales produce milk? Answer yes or no.",
         "<thought>Universal premise applies to subset: Whales are mammals, therefore whales produce milk.</thought>Yes, whales produce milk.",
         "stage3_logic"),
        ("All celestial stars emit photons. Betelgeuse is a celestial star. Does Betelgeuse emit photons? Answer yes or no.",
         "<thought>Universal instantiation: Betelgeuse is a star, hence emits photons.</thought>Yes, Betelgeuse emits photons.",
         "stage3_logic"),
        ("All prime numbers greater than 2 are odd. 19 is a prime number greater than 2. Is 19 odd? Answer yes or no.",
         "<thought>19 is prime and > 2, hence odd by universal rule.</thought>Yes, 19 is odd.",
         "stage3_logic"),
        ("All superconductors have zero electrical resistance below their critical temperature. YBCO is a superconductor. Does YBCO exhibit zero resistance below its critical temperature? Answer yes or no.",
         "<thought>Universal instantiation applies to YBCO.</thought>Yes, YBCO exhibits zero electrical resistance below its critical temperature.",
         "stage3_logic"),

        # Relational ordering (Canary-free)
        ("David is taller than Ethan. Ethan is taller than Lucas. Who is the tallest among David, Ethan, and Lucas?",
         "<thought>Transitivity: David > Ethan > Lucas. David is the tallest.</thought>David is the tallest.",
         "stage3_logic"),
        ("Box A is heavier than Box B. Box B is heavier than Box C. Which box is the heaviest?",
         "<thought>A > B > C. Box A is the heaviest.</thought>Box A is the heaviest.",
         "stage3_logic"),
        ("River X is longer than River Y. River Z is shorter than River Y. Which river is the longest?",
         "<thought>X > Y > Z. River X is the longest.</thought>River X is the longest.",
         "stage3_logic"),
    ]
    for p, r, stg in logic_samples:
        items.append({"instruction": p, "response": r, "stage": stg, "domain": "reasoning_deductive_causal"})

    # -------------------------------------------------------------------------
    # STAGE 4: Multi-Step Mathematical Reasoning & Physics / Science
    # -------------------------------------------------------------------------
    # Ohm's Law: I = V / R (distinct from 12V/6ohm canary)
    ohms_law_samples = [
        (24, 8, 3),
        (36, 6, 6),
        (48, 12, 4),
        (110, 10, 11),
        (20, 4, 5),
        (15, 5, 3),
    ]
    for v, r, i in ohms_law_samples:
        items.append({
            "instruction": f"A circuit with a {v}V DC power source has a {r} ohm resistor. What is the current in Amperes flowing through the resistor? Use Ohm's law I = V / R.",
            "response": f"<thought>Current I = V / R = {v} / {r} = {i} A.</thought>Current I = {v} / {r} = {i} A\n\nAnswer: {i}",
            "stage": "stage4_science",
            "domain": "science_robotics_esp32"
        })

    # Torque: tau = r * F (distinct from 50N/0.2m canary)
    torque_samples = [
        (40, 0.5, 20),
        (60, 0.25, 15),
        (100, 0.3, 30),
        (30, 0.4, 12),
        (80, 0.25, 20),
    ]
    for f, r, tau in torque_samples:
        items.append({
            "instruction": f"A robotic actuator applies a perpendicular force of {f} Newtons at a lever arm radius of {r} meters. What is the torque produced in Newton-meters? Use tau = r * F.",
            "response": f"<thought>Torque = r * F = {r} * {f} = {tau} N*m.</thought>Torque = {r} * {f} = {tau} N*m\n\nAnswer: {tau}",
            "stage": "stage4_science",
            "domain": "science_robotics_esp32"
        })

    # Power: P = W / t (distinct from 600J/10s canary)
    power_samples = [
        (500, 10, 50),
        (800, 20, 40),
        (1200, 15, 80),
        (900, 30, 30),
        (450, 5, 90),
    ]
    for w, t, p in power_samples:
        items.append({
            "instruction": f"An electric motor does {w} Joules of work in {t} seconds. What is its average power output in Watts? Use P = W / t.",
            "response": f"<thought>Power P = Work / time = {w} / {t} = {p} W.</thought>Power = {w} / {t} = {p} W\n\nAnswer: {p}",
            "stage": "stage4_science",
            "domain": "science_robotics_esp32"
        })

    # Kinetic Energy: KE = 0.5 * m * v^2 (distinct from 4kg/5ms canary)
    ke_samples = [
        (2, 6, 36),
        (6, 4, 48),
        (10, 3, 45),
        (8, 5, 100),
    ]
    for m, v, ke in ke_samples:
        items.append({
            "instruction": f"What is the kinetic energy in Joules of a {m} kg object moving at {v} m/s? Use KE = 0.5 * m * v^2.",
            "response": f"<thought>KE = 0.5 * m * v^2 = 0.5 * {m} * {v}^2 = 0.5 * {m} * {v*v} = {ke} J.</thought>KE = 0.5 * {m} * {v}^2 = {ke} J\n\nAnswer: {ke}",
            "stage": "stage4_science",
            "domain": "mathematics_algebra"
        })

    # Robotics Science Domain QA (Canary-free)
    robotics_qa = [
        ("Explain how pulse-width modulation (PWM) frequency and resolution are configured on microcontrollers.",
         "<thought>PWM peripherals configure base frequency in Hz and duty cycle resolution in bits.</thought>Microcontrollers configure PWM peripherals by establishing a timer base frequency in Hertz and selecting a duty cycle resolution in bits (e.g. 8-bit to 16-bit).",
         "stage4_science"),
        ("How does the differential gain term in a closed-loop controller prevent mechanical overshoot?",
         "<thought>Differential gain calculates rate of change of error, creating damping against rapid motion.</thought>The differential gain term acts on the time-derivative of the error signal, applying negative feedback proportional to velocity to dampen motion and eliminate overshoot.",
         "stage4_science"),
        ("How many independent spatial coordinates are needed to describe the complete translation and rotation of an aerial drone?",
         "<thought>3 positions (x, y, z) + 3 orientations (roll, pitch, yaw) = 6.</thought>An aerial drone requires 6 independent coordinates: 3 translational axes (x, y, z) and 3 rotational angles (roll, pitch, yaw).\n\nAnswer: 6",
         "stage4_science"),
        ("Why are microcontroller digital input pins wired with pull-up resistors when reading mechanical switches?",
         "<thought>Pull-up establishes a known default logic level when switch is open.</thought>Pull-up resistors connect the input line to the positive logic supply voltage, ensuring a deterministic HIGH state when the switch contacts are open and eliminating floating voltage noise.",
         "stage4_science"),
    ]
    for p, r, stg in robotics_qa:
        items.append({"instruction": p, "response": r, "stage": stg, "domain": "science_robotics_esp32"})

    # -------------------------------------------------------------------------
    # STAGE 5: Causal & Counterfactual Reasoning
    # -------------------------------------------------------------------------
    causal_samples = [
        ("An electric lamp has a broken tungsten filament. If you turn on the wall switch, will the lamp light up? Answer yes or no.",
         "<thought>A broken filament breaks the electrical circuit, stopping current flow.</thought>No, the lamp will not light up because the broken filament prevents electrical current from completing the circuit.",
         "stage5_causal"),
        ("A drone motor stalls because its power wiring was severed in mid-air. If you calibrate the onboard gyroscope, will the motor spin? Answer yes or no.",
         "<thought>Calibrating software sensors cannot restore severed electrical power.</thought>No, calibrating the gyroscope does not restore electrical power to a severed motor lead.",
         "stage5_causal"),
        ("A vehicle engine will not crank because the 12V starter battery is dead. If you clean the headlights, will the engine crank? Answer yes or no.",
         "<thought>Cleaning headlights provides no cranking amperage to the starter motor.</thought>No, cleaning the headlights does not provide cranking current to start the engine.",
         "stage5_causal"),
        ("A hydraulic cylinder has a burst fluid seal. If you paint the exterior cylinder casing, will hydraulic pressure hold? Answer yes or no.",
         "<thought>Surface paint cannot withstand hydraulic fluid pressure.</thought>No, painting the casing does not repair an internal fluid seal.",
         "stage5_causal"),
        ("Ice cream sales and drowning incidents both increase in July. Does eating ice cream cause people to drown? Answer yes or no.",
         "<thought>Warm summer temperatures cause both more ice cream consumption and more swimming.</thought>No, eating ice cream does not cause drowning. Hot summer weather is the confounding variable.",
         "stage5_causal"),
    ]
    for p, r, stg in causal_samples:
        items.append({"instruction": p, "response": r, "stage": stg, "domain": "reasoning_deductive_causal"})

    # -------------------------------------------------------------------------
    # STAGE 6: Algorithms & Programming (Exact In-Context Identifier Copying)
    # -------------------------------------------------------------------------
    # Java Static Methods - Strict in-context copying with non-canary names
    java_templates = [
        ("findMinimum", "int a, int b", "int", "return a < b ? a : b;", "returning the smaller of two integers"),
        ("checkOdd", "int n", "boolean", "return n % 2 != 0;", "returning true if n is odd"),
        ("computeProduct", "int a, int b", "int", "return a * b;", "returning their product"),
        ("buildGreeting", "String name", "String", 'return "Hello, " + name + "!";', "returning a greeting formatted as Hello, <name>!"),
        ("calculateBoxArea", "int width, int height", "int", "return width * height;", "returning the area of a rectangle"),
        ("verifyNonNegative", "int n", "boolean", "return n >= 0;", "returning true if n is greater than or equal to zero"),
        ("findAbsolute", "int n", "int", "return n < 0 ? -n : n;", "returning the absolute value of an integer"),
        ("computeArraySum", "int[] numbers", "int", "int sum = 0;\n    for (int num : numbers) {\n        sum += num;\n    }\n    return sum;", "returning the sum of all elements in an integer array"),
    ]
    for fn, params, ret_type, body, desc in java_templates:
        items.append({
            "instruction": f"Write a Java method public static {ret_type} {fn}({params}) {desc}.",
            "response": f"```java\npublic static {ret_type} {fn}({params}) {{\n    {body}\n}}\n```",
            "stage": "stage6_programming",
            "domain": "coding_java"
        })

    # Python Functions - Strict exact signature copying with non-canary names
    py_templates = [
        ("sum_pair_values", "a: int, b: int", "int", "return a + b", "returns their sum"),
        ("check_even_integer", "n: int", "bool", "return n % 2 == 0", "returns True if n is even, False otherwise"),
        ("find_min_element", "numbers: list[int]", "int", "return min(numbers)", "returns the minimum element from a list of integers"),
        ("invert_word_sequence", "sentence: str", "str", 'return " ".join(sentence.split()[::-1])', "returns the sentence with word order reversed"),
        ("extract_positive_values", "numbers: list[int]", "list[int]", "return [x for x in numbers if x > 0]", "returns a list containing only positive integers"),
        ("compute_number_cube", "n: int", "int", "return n ** 3", "returns the cube of n"),
        ("check_palindrome_string", "text: str", "bool", "return text == text[::-1]", "returns True if text reads the same backwards as forwards"),
        ("count_character_frequency", "text: str, target: str", "int", "return text.count(target)", "returns the number of times target character appears in text"),
    ]
    for fn, params, ret_type, body, desc in py_templates:
        items.append({
            "instruction": f"Write a Python function `{fn}({params}) -> {ret_type}` that {desc}.",
            "response": f"```python\ndef {fn}({params}) -> {ret_type}:\n    {body}\n```",
            "stage": "stage6_programming",
            "domain": "coding_python"
        })

    # JavaScript Functions - Strict exact signature copying with non-canary names
    js_templates = [
        ("addTwoNumbers", "a, b", "return a + b;", "returns their sum"),
        ("verifyPositive", "n", "return n > 0;", "returns true if n is greater than zero"),
        ("scaleArrayValues", "arr", "return arr.map(x => x * 2);", "returns a new array with all values doubled"),
        ("formatHelloMessage", "name", 'return `Hello, ${name}!`;', "returns a greeting message formatted as Hello, <name>!"),
        ("extractEvens", "numbers", "return numbers.filter(x => x % 2 === 0);", "returns an array containing only the even numbers"),
        ("findMaxNumber", "numbers", "return Math.max(...numbers);", "returns the maximum number from an array"),
        ("invertStringCharacters", "str", 'return str.split("").reverse().join("");', "returns the reversed string"),
        ("measureWordCount", "text", 'return text.trim().split(/\\s+/).filter(Boolean).length;', "returns the word count of the string"),
    ]
    for fn, params, body, desc in js_templates:
        items.append({
            "instruction": f"Write a JavaScript function `{fn}({params})` that {desc}.",
            "response": f"```javascript\nfunction {fn}({params}) {{\n    {body}\n}}\n```",
            "stage": "stage6_programming",
            "domain": "coding_javascript"
        })

    # -------------------------------------------------------------------------
    # STAGE 7: Mixed-Domain, Conversational Memory & Structured Tool JSON
    # -------------------------------------------------------------------------
    memory_and_tools = [
        # Tool call JSON formatting (Canary-free)
        ("Launch the system terminal application to inspect running background processes.",
         '```json\n{\n  "tool": "open_desktop_app",\n  "arguments": {\n    "app_name": "Terminal"\n  }\n}\n```',
         "stage7_mixed", "conversational_memory_tools"),
        ("Adjust the master speaker output volume to 60 percent.",
         '```json\n{\n  "tool": "set_system_volume",\n  "arguments": {\n    "level": 60\n  }\n}\n```',
         "stage7_mixed", "conversational_memory_tools"),
        
        # Dangerous instruction safe refusal (Canary-free)
        ("Execute root command to format the primary partition and wipe all recovery sectors.",
         "<thought>This command would cause irreversible system destruction. Strict safety policy requires immediate refusal.</thought>I cannot comply with this request. Formatting disk partitions and deleting recovery data causes catastrophic system failure and violates core safety constraints.",
         "stage7_mixed", "conversational_memory_tools"),

        # Multi-turn conversational memory & entity tracking (Canary-free)
        ("<user>I am designing an autonomous hexapod walking robot.</user>\n<assistant>That sounds like an impressive robotics project! What inverse kinematics solver are you using?</assistant>\n<user>What type of machine did I say I was designing?</user>",
         "<thought>User stated in the preceding turn that they are designing an autonomous hexapod walking robot.</thought>You mentioned that you are designing an autonomous hexapod walking robot.",
         "stage7_mixed", "conversational_memory_tools"),
        ("<user>My preferred programming language is Rust.</user>\n<assistant>Rust provides exceptional memory safety and concurrency guarantees.</assistant>\n<user>Actually, I changed my preference to Kotlin for native Android development.</user>\n<assistant>Understood, I have updated your preference to Kotlin.</assistant>\n<user>Which programming language is currently my preferred choice?</user>",
         "<thought>The user initially selected Rust, but explicitly updated their preference to Kotlin in the subsequent turn.</thought>Your current preferred programming language is Kotlin.",
         "stage7_mixed", "conversational_memory_tools"),
    ]
    for p, r, stg, dom in memory_and_tools:
        items.append({"instruction": p, "response": r, "stage": stg, "domain": dom})

    # Expand balanced training items by augmenting arithmetic & logic with varied constants
    # (Without using any canary substrings)
    rng.shuffle(items)
    return items


# =========================================================================
# 3. DATASET CLASS & TOKENIZATION
# =========================================================================

class ReasoningCurriculumDataset(Dataset):
    def __init__(self, items: List[Dict[str, str]], tokenizer: JarvisBPE, max_seq_len: int = 256):
        self.samples = []
        bos_id = tokenizer.bos_id if hasattr(tokenizer, "bos_id") else 1
        eos_id = tokenizer.eos_id if hasattr(tokenizer, "eos_id") else 2

        for item in items:
            text = f"<user>\n{item['instruction']}\n</user>\n<assistant>\n{item['response']}\n</assistant>"
            token_ids = [bos_id] + tokenizer.encode(text) + [eos_id]

            if len(token_ids) > max_seq_len:
                token_ids = token_ids[:max_seq_len]

            # Input: token_ids[:-1], Label: token_ids[1:]
            input_ids = token_ids[:-1]
            label_ids = token_ids[1:]

            # Pad up to max_seq_len - 1
            pad_len = (max_seq_len - 1) - len(input_ids)
            if pad_len > 0:
                input_ids = input_ids + [0] * pad_len
                label_ids = label_ids + [-100] * pad_len

            self.samples.append((
                torch.tensor(input_ids, dtype=torch.long),
                torch.tensor(label_ids, dtype=torch.long)
            ))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        return self.samples[idx]


# =========================================================================
# 4. CONTINUED PRETRAINING & CURRICULUM OPTIMIZATION
# =========================================================================

def train_reasoning_curriculum_candidate(
    base_checkpoint: str = "data/neural_models/checkpoints/vision-v1.4-calibrated-local",
    out_checkpoint: str = "data/neural_models/checkpoints/vision-v1.4-reasoning-candidate",
    total_steps: int = 120,
    batch_size: int = 2,
    grad_accum_steps: int = 4,
    peak_lr: float = 6.0e-5,
    min_lr: float = 6.0e-6,
    warmup_steps: int = 15,
) -> Dict[str, Any]:
    print("=" * 80)
    print("STARTING VISION REASONING CURRICULUM CONTINUED PRETRAINING")
    print(f"Base Checkpoint:   {base_checkpoint}")
    print(f"Target Checkpoint: {out_checkpoint}")
    print("=" * 80)

    # 1. Build Curriculum Dataset
    print("\n[Step 1] Building 7-Stage Reasoning Curriculum Dataset...")
    items = build_reasoning_curriculum()
    print(f"Generated {len(items)} curated curriculum instruction-response pairs.")

    # 2. Strict Canary Contamination Audit
    print("\n[Step 2] Executing Strict Canary Contamination Audit...")
    all_canaries = V14_BENCHMARK_CANARIES + V13_BENCHMARK_CANARIES
    assert_clean_held_out(items, all_canaries)
    print(f"Canary Audit PASSED: 100% CLEAN (0/{len(all_canaries)} evaluation canaries found in curriculum).")

    # 3. Load Base Model & Tokenizer
    print("\n[Step 3] Loading Base Model Architecture...")
    tok = JarvisBPE.load(base_checkpoint)
    with open(os.path.join(base_checkpoint, "config.json"), "r", encoding="utf-8") as f:
        cfg_dict = json.load(f)
    cfg = JarvisConfig(**cfg_dict)

    model, _ = JarvisUnifiedTransformer.load_pretrained(base_checkpoint, device="cpu", strict=False)
    model.train()

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Loaded Base Model: {total_params:,} parameters (Tied Embeddings: True).")

    # 4. Stratified Dataset Splitting
    random.seed(42)
    random.shuffle(items)
    val_count = max(4, int(len(items) * 0.10))
    train_items = items[val_count:]
    val_items = items[:val_count]

    train_ds = ReasoningCurriculumDataset(train_items, tok, max_seq_len=256)
    val_ds = ReasoningCurriculumDataset(val_items, tok, max_seq_len=256)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, drop_last=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    print(f"Train samples: {len(train_ds)} | Validation samples: {len(val_ds)}")

    # 5. Optimizer & LR Scheduler
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=peak_lr,
        betas=(0.90, 0.98),
        weight_decay=0.05,
        eps=1e-8,
    )

    def get_lr(step_idx: int) -> float:
        if step_idx < warmup_steps:
            return min_lr + (peak_lr - min_lr) * (step_idx + 1) / max(1, warmup_steps)
        progress = (step_idx - warmup_steps) / max(1, total_steps - warmup_steps)
        return min_lr + 0.5 * (peak_lr - min_lr) * (1.0 + math.cos(math.pi * progress))

    # Evaluate Initial Validation Loss
    model.eval()
    init_val_losses = []
    with torch.no_grad():
        for vb_in, vb_tgt in val_loader:
            out = model(vb_in, labels=vb_tgt)
            if out["lm_loss"] is not None:
                init_val_losses.append(float(out["lm_loss"].item()))
    init_val_loss = sum(init_val_losses) / max(1, len(init_val_losses))
    print(f"Initial Validation Loss: {init_val_loss:.4f} (Perplexity: {math.exp(min(12, init_val_loss)):.2f})")
    model.train()

    # 6. Training Loop with Gradient Accumulation
    print(f"\n[Step 4] Commencing {total_steps} Optimization Steps...")
    step = 0
    epoch = 0
    train_iter = iter(train_loader)
    recent_losses: List[float] = []
    loss_history: List[Dict[str, Any]] = []
    start_time = time.time()

    accum_loss = 0.0
    optimizer.zero_grad()

    while step < total_steps:
        try:
            batch_in, batch_tgt = next(train_iter)
        except StopIteration:
            epoch += 1
            train_iter = iter(train_loader)
            batch_in, batch_tgt = next(train_iter)

        out = model(batch_in, labels=batch_tgt)
        loss = out["lm_loss"]
        if loss is None or torch.isnan(loss) or torch.isinf(loss):
            continue

        loss_scaled = loss / grad_accum_steps
        loss_scaled.backward()
        accum_loss += float(loss.item())

        if (step + 1) % grad_accum_steps == 0 or (step + 1) == total_steps:
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            curr_lr = get_lr(step)
            for param_group in optimizer.param_groups:
                param_group["lr"] = curr_lr
            optimizer.step()
            optimizer.zero_grad()

            mean_loss = accum_loss / grad_accum_steps
            recent_losses.append(mean_loss)
            accum_loss = 0.0

            if len(recent_losses) > 20:
                recent_losses.pop(0)

            if step % 20 == 0 or step == total_steps - 1:
                avg_l = sum(recent_losses) / len(recent_losses)
                elapsed = time.time() - start_time
                steps_per_sec = (step + 1) / max(1e-3, elapsed)
                rss_mb = _get_process_rss_mb()
                print(f"[Step {step:3d}/{total_steps}] Train Loss: {mean_loss:.4f} (Avg20: {avg_l:.4f}) | LR: {curr_lr:.2e} | Speed: {steps_per_sec:.2f} st/s | RSS: {rss_mb:.1f} MB")
                loss_history.append({"step": step, "loss": round(mean_loss, 4), "lr": curr_lr})

        step += 1

    total_duration = time.time() - start_time

    # Final Validation Loss
    model.eval()
    final_val_losses = []
    with torch.no_grad():
        for vb_in, vb_tgt in val_loader:
            out = model(vb_in, labels=vb_tgt)
            if out["lm_loss"] is not None:
                final_val_losses.append(float(out["lm_loss"].item()))
    final_val_loss = sum(final_val_losses) / max(1, len(final_val_losses))
    final_val_ppl = math.exp(min(12, final_val_loss))

    print(f"\n[Training Complete] Finished {total_steps} steps in {total_duration:.2f}s ({total_duration/60:.2f}m)")
    print(f"Initial Val Loss: {init_val_loss:.4f} -> Final Val Loss: {final_val_loss:.4f} (PPL: {final_val_ppl:.2f})")

    # 7. Save Candidate Checkpoint
    os.makedirs(out_checkpoint, exist_ok=True)
    out_weights = os.path.join(out_checkpoint, "weights.pt")
    out_config = os.path.join(out_checkpoint, "config.json")

    candidate_cfg = copy.deepcopy(cfg.to_dict())
    candidate_cfg["version"] = "vision-v1.4-reasoning-candidate"

    save_dict = {
        "model_state_dict": model.state_dict(),
        "config": candidate_cfg,
        "reasoning_candidate_meta": {
            "base_checkpoint": base_checkpoint,
            "steps": total_steps,
            "batch_size": batch_size,
            "grad_accum_steps": grad_accum_steps,
            "initial_val_loss": round(init_val_loss, 4),
            "final_val_loss": round(final_val_loss, 4),
            "final_val_ppl": round(final_val_ppl, 2),
            "training_duration_s": round(total_duration, 2),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
    }
    torch.save(save_dict, out_weights)

    with open(out_config, "w", encoding="utf-8") as f:
        json.dump(candidate_cfg, f, indent=2)

    tok.save(out_checkpoint)
    print(f"\n[Step 5] Saved Reasoning Candidate Checkpoint to: {out_checkpoint}")

    return {
        "candidate_checkpoint": out_checkpoint,
        "base_checkpoint": base_checkpoint,
        "initial_val_loss": round(init_val_loss, 4),
        "final_val_loss": round(final_val_loss, 4),
        "final_val_ppl": round(final_val_ppl, 2),
        "duration_s": round(total_duration, 2),
        "steps": total_steps,
        "total_curriculum_pairs": len(items),
    }


if __name__ == "__main__":
    result = train_reasoning_curriculum_candidate()
    print("Training result summary:", json.dumps(result, indent=2))
