"""
VISION Lawful Preference Dataset Builder for DPO & Reinforcement Learning
ml_foundation/preference_dataset.py

Constructs and verifies multi-dimensional preference dataset covering:
1. Mathematics & Calculation (correct step-by-step deduction vs arithmetic error)
2. Python & Polyglot Coding (correct syntax, logic, and tests vs syntax/logic bugs)
3. Instruction Following & Negative Constraints (honoring constraints vs ignoring constraints)
4. Logic & Deductive Reasoning (valid syllogism vs fallacious reasoning)
5. Science, Robotics & Units (physically grounded dimensional units vs wrong units)
6. Hallucination & Calibrated Uncertainty (admitting unknown facts vs making up claims)
7. Tool Calling & Structured JSON (strict schema adherence vs malformed JSON)
8. Multi-turn Conversational Memory (preserving entity state vs forgetting context)

Saves clean train/val splits to data/neural_models/datasets/preference_dpo/
"""

from __future__ import annotations

import json
import os
import random
import sys
from typing import Any, Dict, List, Tuple

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


PREFERENCE_PAIRS_CURATED: List[Dict[str, Any]] = [
    # -------------------------------------------------------------
    # 1. Mathematics & Calculation
    # -------------------------------------------------------------
    {
        "domain": "mathematics_calculation",
        "prompt": "Solve the equation: 3x - 7 = 14. Show the step-by-step calculation.",
        "chosen": "To solve 3x - 7 = 14:\n1. Add 7 to both sides: 3x = 14 + 7 = 21.\n2. Divide both sides by 3: x = 21 / 3 = 7.\nThe solution is x = 7.",
        "rejected": "To solve 3x - 7 = 14, subtract 7 from both sides to get 3x = 7. Then divide by 3, so x = 7/3.",
        "rationale": "Chosen performs correct algebraic operations; rejected incorrectly subtracts 7 instead of adding."
    },
    {
        "domain": "mathematics_calculation",
        "prompt": "What is 15% of 240?",
        "chosen": "15% of 240 can be calculated as:\n10% of 240 = 24\n5% of 240 = 12\n15% = 24 + 12 = 36.\nTherefore, 15% of 240 is 36.",
        "rejected": "15% of 240 is 240 * 0.15 = 48 because 15 times 3 is 48.",
        "rationale": "Chosen is mathematically accurate (36); rejected states 48 with nonsensical arithmetic."
    },
    {
        "domain": "mathematics_calculation",
        "prompt": "Find the area of a circle with radius 5 cm. Express in terms of pi and decimal approximation.",
        "chosen": "The area of a circle is A = pi * r^2. With r = 5 cm:\nA = pi * 5^2 = 25*pi cm^2.\nUsing pi approx 3.14159, A approx 78.54 cm^2.",
        "rejected": "The area is 2 * pi * r = 2 * pi * 5 = 10*pi approx 31.4 cm^2.",
        "rationale": "Chosen correctly uses the area formula pi*r^2; rejected confuses circumference (2*pi*r) with area."
    },

    # -------------------------------------------------------------
    # 2. Python & Polyglot Coding
    # -------------------------------------------------------------
    {
        "domain": "coding_python",
        "prompt": "Write a Python function to check whether a given string is a palindrome.",
        "chosen": "def is_palindrome(s: str) -> bool:\n    clean = ''.join(c.lower() for c in s if c.isalnum())\n    return clean == clean[::-1]",
        "rejected": "def is_palindrome(s):\n    for i in range(len(s)):\n        if s[i] == s[len(s)]:\n            return True\n    return False",
        "rationale": "Chosen handles alphanumeric filtering and case sensitivity cleanly; rejected throws IndexError and has flawed logic."
    },
    {
        "domain": "coding_python",
        "prompt": "Write a Python function that computes the factorial of non-negative integer n iteratively.",
        "chosen": "def factorial(n: int) -> int:\n    if n < 0:\n        raise ValueError('Factorial is not defined for negative numbers.')\n    result = 1\n    for i in range(2, n + 1):\n        result *= i\n    return result",
        "rejected": "def factorial(n):\n    result = 0\n    for i in range(n):\n        result = result * i\n    return result",
        "rationale": "Chosen initializes result to 1 and iterates properly; rejected initializes to 0 leading to product always 0."
    },
    {
        "domain": "coding_polyglot",
        "prompt": "Write a SQL query to find the department with the highest average salary from an 'employees' table.",
        "chosen": "SELECT department_id, AVG(salary) AS avg_salary\nFROM employees\nGROUP BY department_id\nORDER BY avg_salary DESC\nLIMIT 1;",
        "rejected": "SELECT department_id, salary FROM employees WHERE salary = MAX(salary);",
        "rationale": "Chosen uses correct GROUP BY and aggregate ordering; rejected uses invalid WHERE salary = MAX(salary) syntax."
    },

    # -------------------------------------------------------------
    # 3. Instruction Following & Negative Constraints
    # -------------------------------------------------------------
    {
        "domain": "instruction_following",
        "prompt": "Summarize what photosynthesis is in exactly two sentences. Do NOT use the word 'plant' or 'plants'.",
        "chosen": "Vegetation and autotrophic organisms convert solar energy into chemical energy stored within glucose molecules. During this biochemical process, carbon dioxide and water are absorbed while vital oxygen gas is released into the atmosphere.",
        "rejected": "Plants use sunlight to make food from carbon dioxide and water. This process allows plants to grow and produce oxygen for living creatures.",
        "rationale": "Chosen adheres strictly to the two-sentence constraint and honors the negative constraint (never uses 'plant' or 'plants'); rejected violates the negative constraint twice."
    },
    {
        "domain": "instruction_following",
        "prompt": "Provide three prime numbers between 20 and 40. Output ONLY the numbers separated by commas, nothing else.",
        "chosen": "23, 29, 31",
        "rejected": "Sure, here are three prime numbers between 20 and 40 for you: 23, 29, and 31.",
        "rationale": "Chosen follows format constraint strictly without conversational preamble; rejected includes unsolicited conversational filler."
    },

    # -------------------------------------------------------------
    # 4. Logic & Deductive Reasoning
    # -------------------------------------------------------------
    {
        "domain": "logical_reasoning",
        "prompt": "Premise 1: All mammals are warm-blooded.\nPremise 2: All dolphins are mammals.\nQuestion: Can we deduce that dolphins are warm-blooded?",
        "chosen": "Yes, by deductive syllogism (Barbara). Since all dolphins belong to the set of mammals, and all mammals possess warm-bloodedness, all dolphins are necessarily warm-blooded.",
        "rejected": "No, because dolphins live in cold oceans so they might be cold-blooded like sharks.",
        "rationale": "Chosen applies valid formal deductive logic; rejected commits an empirical fallacy ignoring the premises."
    },
    {
        "domain": "logical_reasoning",
        "prompt": "If it rains, the grass gets wet. The grass is wet. Does this prove it rained?",
        "chosen": "No, this is the logical fallacy of affirming the consequent (P -> Q, Q does not imply P). The grass could be wet due to sprinklers, dew, or someone washing a car.",
        "rejected": "Yes, because if it rains the grass gets wet, so wet grass proves rain.",
        "rationale": "Chosen identifies the classical fallacy of affirming the consequent; rejected makes the fallacious inference."
    },

    # -------------------------------------------------------------
    # 5. Science, Robotics & Units
    # -------------------------------------------------------------
    {
        "domain": "science_robotics",
        "prompt": "What are the three gains in a PID controller and what does each term do?",
        "chosen": "A PID controller computes an error value e(t) and applies three correction terms:\n1. Proportional (Kp): Reacts to the current error magnitude.\n2. Integral (Ki): Accumulates past errors over time to eliminate steady-state offset.\n3. Derivative (Kd): Predicts future error based on rate of change to dampen oscillations.",
        "rejected": "PID stands for Position, Inertia, and Distance. It measures how far the robot moved and stops it when it reaches the destination.",
        "rationale": "Chosen accurately defines Proportional-Integral-Derivative control theory; rejected fabricates incorrect terms."
    },
    {
        "domain": "science_robotics",
        "prompt": "Calculate the force required to accelerate a 1200 kg vehicle at 2.5 m/s^2. Include proper SI units.",
        "chosen": "Using Newton's Second Law of Motion (F = m * a):\nF = 1200 kg * 2.5 m/s^2 = 3000 N (Newtons).",
        "rejected": "The force is 1200 / 2.5 = 480 Joules.",
        "rationale": "Chosen correctly calculates 3000 N with dimensional consistency; rejected divides instead of multiplying and uses energy units (Joules) for force."
    },

    # -------------------------------------------------------------
    # 6. Hallucination & Calibrated Uncertainty
    # -------------------------------------------------------------
    {
        "domain": "hallucination_calibration",
        "prompt": "What was the exact battery capacity of Julius Caesar's smartphone?",
        "chosen": "Julius Caesar lived in ancient Rome (100 BC - 44 BC), thousands of years before the invention of electricity and smartphones. Therefore, he did not possess a smartphone.",
        "rejected": "Julius Caesar used an iPhone with a 3,110 mAh lithium-ion battery during the Gallic Wars to coordinate his legions.",
        "rationale": "Chosen rejects the false anachronistic presupposition honestly; rejected hallucinates historical absurdities."
    },
    {
        "domain": "hallucination_calibration",
        "prompt": "Who won the FIFA Men's World Cup in the year 2046?",
        "chosen": "The year 2046 is far in the future, so the 2046 FIFA Men's World Cup has not yet taken place and its winner is currently unknown.",
        "rejected": "Brazil won the 2046 World Cup by defeating France 3-2 in extra time in Tokyo.",
        "rationale": "Chosen exhibits calibrated uncertainty regarding future events; rejected fabricates fictional future facts."
    },

    # -------------------------------------------------------------
    # 7. Tool Calling & Structured JSON
    # -------------------------------------------------------------
    {
        "domain": "tool_calling_json",
        "prompt": "The user says: 'Check the weather forecast for New Delhi for the next 3 days.' Return a valid tool call in JSON format.",
        "chosen": '{\n  "tool": "get_weather_forecast",\n  "arguments": {\n    "location": "New Delhi",\n    "days": 3,\n    "units": "celsius"\n  }\n}',
        "rejected": "I will call the weather tool now for New Delhi and check the days for you: tool=weather location='New Delhi'",
        "rationale": "Chosen returns clean, valid, parsable JSON adhering to function-calling conventions; rejected outputs unstructured pseudocode."
    },
    {
        "domain": "tool_calling_json",
        "prompt": "Generate a tool call to read the first 50 lines of file 'server/aiProviderAdapter.js'.",
        "chosen": '{\n  "tool": "read_file",\n  "arguments": {\n    "Path": "server/aiProviderAdapter.js",\n    "StartLine": 1,\n    "EndLine": 50\n  }\n}',
        "rejected": '{\n  "tool": "read_file",\n  "path": "server/aiProviderAdapter.js"\n}',
        "rationale": "Chosen satisfies the line bounds constraint (StartLine: 1, EndLine: 50); rejected omits line numbers."
    },

    # -------------------------------------------------------------
    # 8. Multi-Turn Conversational Memory
    # -------------------------------------------------------------
    {
        "domain": "conversation_memory",
        "prompt": "Conversation history:\nUser: My favorite programming language is Rust, and I work on ESP32 microcontrollers.\nAssistant: That's a great combination! Embedded Rust on ESP32 is very powerful.\nUser: What was the language I mentioned, and what hardware do I work on?",
        "chosen": "You mentioned that your favorite programming language is Rust, and you work on ESP32 microcontrollers.",
        "rejected": "You mentioned Python and Arduino.",
        "rationale": "Chosen accurately recalls entities from the conversation history; rejected hallucinates incorrect entities."
    }
]


def build_preference_dataset(
    out_dir: str = r"D:\Jarvis\data\neural_models\datasets\preference_dpo",
    seed: int = 42
) -> Dict[str, Any]:
    """Generates, validates, and partitions the lawful preference dataset."""
    random.seed(seed)
    os.makedirs(out_dir, exist_ok=True)

    # Validate non-emptiness and field integrity
    validated: List[Dict[str, Any]] = []
    for item in PREFERENCE_PAIRS_CURATED:
        assert item.get("prompt"), "Missing prompt"
        assert item.get("chosen"), "Missing chosen response"
        assert item.get("rejected"), "Missing rejected response"
        assert item.get("domain"), "Missing domain"
        assert item["chosen"] != item["rejected"], "Chosen and rejected cannot be identical"

        record = {
            "prompt": item["prompt"].strip(),
            "chosen": item["chosen"].strip(),
            "rejected": item["rejected"].strip(),
            "domain": item["domain"].strip(),
            "rationale": item.get("rationale", "").strip(),
            "prompt_length_chars": len(item["prompt"]),
            "chosen_length_chars": len(item["chosen"]),
            "rejected_length_chars": len(item["rejected"]),
            "source": "vision_curated_preference_v1.0"
        }
        validated.append(record)

    # Shuffle
    random.shuffle(validated)

    # Split 80/20 train/val
    split_idx = int(len(validated) * 0.80)
    train_data = validated[:split_idx]
    val_data = validated[split_idx:]

    train_path = os.path.join(out_dir, "train.jsonl")
    val_path = os.path.join(out_dir, "val.jsonl")

    with open(train_path, "w", encoding="utf-8") as f:
        for item in train_data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    with open(val_path, "w", encoding="utf-8") as f:
        for item in val_data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    domain_counts: Dict[str, int] = {}
    for item in validated:
        d = item["domain"]
        domain_counts[d] = domain_counts.get(d, 0) + 1

    manifest = {
        "version": "vision-dpo-preference-v1.0",
        "created_at": "2026-11-19T06:30:00Z",
        "total_pairs": len(validated),
        "train_pairs": len(train_data),
        "val_pairs": len(val_data),
        "domain_distribution": domain_counts,
        "files": {
            "train": train_path,
            "val": val_path
        }
    }

    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Preference dataset generated: {len(validated)} pairs ({len(train_data)} train / {len(val_data)} val)")
    print(f"Manifest written to: {manifest_path}")
    return manifest


if __name__ == "__main__":
    build_preference_dataset()
