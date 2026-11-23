"""
RIGOROUS EVALUATOR (ml_foundation/rigorous_evaluator.py)

Production-grade, adversarial evaluation engine for language model capabilities:
- Replaces naive substring checking with semantic & numerical extraction.
- Rejects answers that mention expected numbers in unrelated or contradictory contexts.
- Handles integers, floats, fractions, negative numbers, and mathematical expressions.
- Robust code AST parsing and categorical deduction verification.
"""

import ast
import re
from fractions import Fraction
from typing import Dict, Any, Tuple, Optional, List

def normalize_math_str(s: str) -> str:
    """Normalizes mathematical strings for robust comparison."""
    if s is None:
        return ""
    s = s.strip()
    # Remove surrounding dollar signs, brackets, spaces
    s = re.sub(r"^\$+|\$+$", "", s).strip()
    s = re.sub(r"^[\\(\\[]+|[\\)\\]]+$", "", s).strip()
    s = s.replace(",", "")
    return s

def try_parse_number(s: str) -> Optional[float]:
    """Attempts to parse a string into a float, handling fractions."""
    s = normalize_math_str(s)
    if not s:
        return None
    # Fraction: e.g. "1/2", "-3/4"
    if "/" in s:
        parts = s.split("/")
        if len(parts) == 2:
            try:
                num = float(parts[0].strip())
                den = float(parts[1].strip())
                if den != 0:
                    return num / den
            except ValueError:
                pass
    try:
        return float(s)
    except ValueError:
        return None

def find_standalone_contradictions(text: str) -> List[str]:
    """
    Detects assertions of the form N1 = N2 where N1 != N2 and neither side is an arithmetic expression.
    E.g., catches '10 = 2', '12 = 3', but allows valid equations like '63 + 21 = 84'.
    """
    contradictions = []
    for part in re.split(r"[;\n\.]", text):
        if "=" in part:
            sides = part.split("=")
            if len(sides) == 2:
                left, right = sides[0].strip(), sides[1].strip()
                m_left = re.fullmatch(r"[+-]?\d+(?:\.\d+)?", left)
                m_right = re.fullmatch(r"[+-]?\d+(?:\.\d+)?", right)
                if m_left and m_right:
                    try:
                        if abs(float(m_left.group(0)) - float(m_right.group(0))) > 1e-6:
                            contradictions.append(f"{left} = {right}")
                    except Exception:
                        pass
    return contradictions

def extract_math_answer(gen_text: str) -> Optional[str]:
    """
    Extracts the definitive mathematical answer from model generation.
    Prioritizes explicit declarations over raw tokens, and rejects contradictory or rambling numbers.
    """
    if not gen_text or not gen_text.strip():
        return None

    text = gen_text.strip()

    # 1. Look for explicit answer declaration patterns (highest precedence)
    decl_patterns = [
        r"(?:the\s+answer\s+is\s*:?|answer\s*=\s*|####\s*|final\s+answer\s*:?)\s*([+-]?\d+(?:\.\d+)?(?:/\d+)?)",
        r"(?:therefore\s*,?\s*(?:the\s+value\s+is)?\s*:?)\s*([+-]?\d+(?:\.\d+)?(?:/\d+)?)",
        r"(?:result\s+is\s*:?|equals\s*:?)\s*([+-]?\d+(?:\.\d+)?(?:/\d+)?)",
        r"=\s*([+-]?\d+(?:\.\d+)?(?:/\d+)?)\s*(?:\.|$)"
    ]

    for pat in decl_patterns:
        matches = list(re.finditer(pat, text, re.IGNORECASE))
        if matches:
            # Use the last explicit declaration in the sequence
            return matches[-1].group(1).strip()

    # 2. Check if the entire generated text is just a clean number or simple expression
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if len(lines) == 1:
        line = lines[0]
        # E.g. "10", "-5", "3.14", "= 10", "10."
        m = re.fullmatch(r"(?:=\s*)?([+-]?\d+(?:\.\d+)?(?:/\d+)?)\.?", line)
        if m:
            return m.group(1).strip()

    # 3. Check the very last line if it consists of a single number
    if lines:
        last_line = lines[-1]
        m = re.fullmatch(r"(?:=\s*)?([+-]?\d+(?:\.\d+)?(?:/\d+)?)\.?", last_line)
        if m:
            return m.group(1).strip()

    # 4. If text contains equations with contradictory equality like "10 = 2", detect contradiction
    bad_eqs = find_standalone_contradictions(text)
    if bad_eqs:
        # Contradictory arithmetic hallucination
        return None

    # 5. Fallback: If only exactly one number exists in the entire text, extract it
    all_numbers = re.findall(r"(?<![a-zA-Z0-9_])([+-]?\d+(?:\.\d+)?)(?![a-zA-Z0-9_])", text)
    if len(all_numbers) == 1:
        return all_numbers[0].strip()

    # If multiple numbers exist without an explicit declaration, it is ambiguous/contradictory
    return None

def verify_math_probe(expected: str, gen_text: str) -> Tuple[bool, str, Optional[str]]:
    """
    Rigorously verifies mathematical answers.
    Returns: (passed, reason, extracted_answer)
    """
    if not gen_text or not gen_text.strip():
        return False, "EMPTY_GENERATION", None

    extracted = extract_math_answer(gen_text)
    if extracted is None:
        # Check if model has contradictory statements
        bad_eqs = find_standalone_contradictions(gen_text)
        if bad_eqs:
            return False, f"CONTRADICTORY_EQUATION ({bad_eqs[0]})", None
        return False, f"NO_DEFINITIVE_ANSWER_EXTRACTED (Text: {repr(gen_text[:60])})", None

    exp_num = try_parse_number(expected)
    act_num = try_parse_number(extracted)

    if exp_num is not None and act_num is not None:
        if abs(exp_num - act_num) < 1e-6:
            return True, "EXACT_NUMERICAL_MATCH", extracted
        else:
            return False, f"NUMERICAL_MISMATCH (Expected {expected}, Extracted {extracted})", extracted

    # String fallback if non-numeric
    if normalize_math_str(expected).lower() == normalize_math_str(extracted).lower():
        return True, "EXACT_STRING_MATCH", extracted

    return False, f"VALUE_MISMATCH (Expected {expected}, Extracted {extracted})", extracted

def verify_code_probe(expected: str, gen_text: str, expected_keywords: List[str] = None) -> Tuple[bool, str, Optional[str]]:
    """Rigorously verifies Python code generation via AST syntax tree parsing."""
    if not gen_text or not gen_text.strip():
        return False, "EMPTY_GENERATION", None

    code = gen_text
    if "```python" in code:
        code = code.split("```python")[1].split("```")[0]
    elif "```" in code:
        code = code.split("```")[1].split("```")[0]

    code = code.strip()
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"SYNTAX_INVALID ({e.msg})", code[:80]

    # Verify function definition exists
    func_defs = [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    if not func_defs:
        return False, "NO_FUNCTION_DEFINED", code[:80]

    # Check for return or yield
    has_return = any(isinstance(n, (ast.Return, ast.Yield, ast.YieldFrom)) for n in ast.walk(tree))
    if not has_return:
        return False, "FUNCTION_MISSING_RETURN", code[:80]

    # Check required keywords
    if expected_keywords:
        code_lower = code.lower()
        missing = [kw for kw in expected_keywords if kw.lower() not in code_lower]
        if missing:
            return False, f"MISSING_KEYWORDS ({missing})", code[:80]

    return True, "VALID_PYTHON_AST", func_defs[0].name

def verify_categorical_probe(expected: str, gen_text: str) -> Tuple[bool, str, Optional[str]]:
    """Rigorously verifies Yes/No or Multiple Choice logic probes."""
    if not gen_text or not gen_text.strip():
        return False, "EMPTY_GENERATION", None

    exp_clean = expected.strip().lower()
    text = gen_text.strip()
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # Extract declared conclusion
    # Check for "Therefore, Yes", "The answer is Yes", "Yes", etc.
    if exp_clean in ("yes", "no"):
        # Match whole word yes/no
        yes_matches = list(re.finditer(r"\byes\b", text, re.IGNORECASE))
        no_matches = list(re.finditer(r"\bno\b", text, re.IGNORECASE))

        # Check for conclusion line
        conclusion_match = None
        for l in reversed(lines):
            m_yes = bool(re.search(r"\byes\b", l, re.IGNORECASE))
            m_no = bool(re.search(r"\bno\b", l, re.IGNORECASE))
            if m_yes and not m_no:
                conclusion_match = "yes"
                break
            elif m_no and not m_yes:
                conclusion_match = "no"
                break
            elif m_yes and m_no:
                return False, "CONTRADICTORY_YES_NO", None

        if conclusion_match:
            if conclusion_match == exp_clean:
                return True, "EXACT_CATEGORICAL_MATCH", conclusion_match
            else:
                return False, f"CATEGORICAL_MISMATCH (Expected {exp_clean}, Got {conclusion_match})", conclusion_match

        # If both or neither
        if yes_matches and no_matches:
            return False, "CONTRADICTORY_YES_NO", None
        elif yes_matches and exp_clean == "yes":
            return True, "UNAMBIGUOUS_YES", "yes"
        elif no_matches and exp_clean == "no":
            return True, "UNAMBIGUOUS_NO", "no"
        else:
            return False, f"MISSING_CATEGORICAL_ANSWER (Expected {exp_clean})", None

    # Multiple choice (e.g. A, B, C, D)
    if re.fullmatch(r"[A-D]", expected.strip(), re.IGNORECASE):
        exp_letter = expected.strip().upper()
        # Look for "(A)", "Option A", "Answer: A"
        m = re.search(r"(?:answer\s+is\s*:?|option\s*:?|\()\s*([A-D])\s*\)?", text, re.IGNORECASE)
        if m:
            act_letter = m.group(1).upper()
            if act_letter == exp_letter:
                return True, "EXACT_CHOICE_MATCH", act_letter
            else:
                return False, f"CHOICE_MISMATCH (Expected {exp_letter}, Got {act_letter})", act_letter

    # Exact string match fallback
    if exp_clean == text.lower() or exp_clean == lines[-1].lower():
        return True, "EXACT_TEXT_MATCH", text[:60]

    return False, f"CATEGORICAL_MISMATCH (Expected {expected})", text[:60]

def rigorous_verify_probe(probe: Dict[str, Any], gen_text: str) -> Tuple[bool, str, Optional[str]]:
    """
    Master verification router dispatching to domain-specific rigorous verifiers.
    Returns: (passed: bool, reason: str, extracted_answer: Optional[str])
    """
    v_type = probe.get("verification_type", "keyword_match")
    exp_ans = str(probe.get("expected_answer", "")).strip()
    exp_kw = probe.get("expected_keywords", [])

    if not gen_text or not gen_text.strip():
        return False, "EMPTY_GENERATION", None

    if v_type in ("exact_math", "numerical"):
        return verify_math_probe(exp_ans, gen_text)

    elif v_type in ("code_syntax", "ast_code"):
        return verify_code_probe(exp_ans, gen_text, exp_kw)

    elif v_type in ("categorical", "boolean", "multiple_choice") or exp_ans.lower() in ("yes", "no"):
        return verify_categorical_probe(exp_ans, gen_text)

    # General phrase / formula / semantic match
    gen_lower = gen_text.lower().strip()
    exp_lower = exp_ans.lower().strip()

    # Check exact match or exact last line match
    lines = [l.strip().lower() for l in gen_text.split("\n") if l.strip()]
    if exp_lower == gen_lower or (lines and exp_lower == lines[-1]):
        return True, "EXACT_PHRASE_MATCH", exp_ans

    # Check for explicit answer declaration
    m = re.search(r"(?:answer\s+is\s*:?|####\s*|result\s+is\s*:?)\s*(.+?)(?:\.|$)", gen_text, re.IGNORECASE)
    if m:
        decl = m.group(1).strip().lower()
        # Only match if declaration equals expected or declaration fully contains expected phrase
        if exp_lower == decl or (len(exp_lower) >= 3 and exp_lower in decl):
            return True, "DECLARATION_PHRASE_MATCH", m.group(1).strip()

    # Check all keywords match with boundary matching
    if exp_kw:
        all_kw_matched = True
        for kw in exp_kw:
            pat = rf"(?:^|\b){re.escape(kw.lower())}(?:\b|$)"
            if not re.search(pat, gen_lower):
                all_kw_matched = False
                break
        if all_kw_matched:
            # If the model declared a contradictory short answer (e.g. 'The answer is 1.'), reject
            if m:
                decl = m.group(1).strip().lower()
                if len(decl) <= 5 and not any(decl == kw.lower() for kw in exp_kw):
                    return False, f"CONTRADICTORY_DECLARATION ({decl})", None
            return True, f"ALL_KEYWORDS_MATCHED ({len(exp_kw)}/{len(exp_kw)})", None

    return False, f"SEMANTIC_MISMATCH (Expected {exp_ans}, got {gen_text[:60]})", None
