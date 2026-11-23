"""
Fix markdown formatting in newly authored reports to satisfy markdownlint.
"""
import re

files_to_fix = [
    "VISION_DATASET_LICENSE_AND_PROVENANCE_AUDIT.md",
    "VISION_PRETRAINING_ARCHITECTURE_REPORT.md",
    "VISION_SCALING_COMPUTE_LEDGER.md",
    "VISION_FAILURE_ANALYSIS.md"
]

for fname in files_to_fix:
    with open(fname, "r", encoding="utf-8") as f:
        text = f.read()

    # 1. Fix table delimiter rows: replace e.g. |:---|:---:| with | :--- | :---: |
    def fix_delim_row(match):
        cells = match.group(0).strip().split('|')[1:-1]
        formatted = []
        for c in cells:
            c = c.strip()
            formatted.append(f" {c} ")
        return "|" + "|".join(formatted) + "|"

    text = re.sub(r"^\|(?::?-+:?\|)+$", fix_delim_row, text, flags=re.MULTILINE)

    # 2. Fix all other table rows to ensure space after and before pipe
    def fix_table_row(match):
        line = match.group(0)
        # Avoid math formulas or horizontal rules
        if not line.startswith("|") or not line.endswith("|"):
            return line
        cells = line.split("|")[1:-1]
        formatted = []
        for c in cells:
            stripped = c.strip()
            formatted.append(f" {stripped} ")
        return "|" + "|".join(formatted) + "|"

    lines = text.split("\n")
    fixed_lines = []
    for idx, line in enumerate(lines):
        # Check blank line before list
        if idx > 0 and (line.startswith("- ") or re.match(r"^\d+\.\s", line)):
            prev = fixed_lines[-1].strip()
            if prev and not prev.startswith("- ") and not re.match(r"^\d+\.\s", prev) and not prev.endswith(":"):
                fixed_lines.append("")
            elif prev.endswith(":"):
                fixed_lines.append("")
        if line.startswith("|") and line.endswith("|") and not re.match(r"^\|(?::?-+:?\|)+$", line):
            line = fix_table_row(re.match(r"^.*$", line))
        fixed_lines.append(line)

    text = "\n".join(fixed_lines)

    with open(fname, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Fixed {fname}")
