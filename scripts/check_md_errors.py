import glob
import subprocess

brain_dir = 'C:/Users/upadh/.gemini/antigravity/brain/88baef9f-4cb3-4a0b-a1a9-59c49a68c438'
files = glob.glob('*.md') + glob.glob(f'{brain_dir}/*.md')

for f in files:
    res = subprocess.run(f'npx markdownlint-cli "{f}"', shell=True, capture_output=True, text=True)
    lines = [l for l in res.stderr.splitlines() if l.strip()]
    if lines:
        if len(lines) in [20, 15, 8, 43] or 'final_report' in f or 'architecture_report' in f or 'recovery' in f:
            print(f"{f} -> {len(lines)} errors")
