import os
import glob
import re
import subprocess

def fix_file_manually(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        print(f"Cannot read {filepath}: {e}")
        return False

    original = content
    
    # 1. Fix fenced code blocks with missing language (MD040)
    # Replace ```\n with ```text\n when it is an opening fence
    lines = content.split('\n')
    in_code = False
    new_lines = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('```'):
            if not in_code:
                in_code = True
                if stripped == '```':
                    line = line.replace('```', '```text')
            else:
                in_code = False
        new_lines.append(line)
    content = '\n'.join(new_lines)

    # 2. Fix trailing punctuation in headings (MD026): e.g. "### Header:" -> "### Header"
    lines = content.split('\n')
    new_lines = []
    in_code = False
    for line in lines:
        if line.strip().startswith('```'):
            in_code = not in_code
        if not in_code and re.match(r'^(#{1,6}\s+.*?)[:!.]\s*$', line):
            line = re.sub(r'[:!.]\s*$', '', line)
        new_lines.append(line)
    content = '\n'.join(new_lines)

    # 3. Fix Setext heading underlines like "===================" being treated as headings (MD003 / MD025)
    # Often in text blocks or banners
    lines = content.split('\n')
    new_lines = []
    in_code = False
    for i, line in enumerate(lines):
        if line.strip().startswith('```'):
            in_code = not in_code
        if not in_code and re.match(r'^[=\-]{10,}$', line.strip()):
            # If the preceding line is text and not empty, it could turn into a setext heading
            if i > 0 and new_lines and new_lines[-1].strip() and not new_lines[-1].strip().startswith('#'):
                # insert a blank line or make it a horizontal rule or block
                pass
        new_lines.append(line)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    workspace_md = glob.glob('*.md') + glob.glob('reports/*.md')
    brain_dir = 'C:/Users/upadh/.gemini/antigravity/brain/88baef9f-4cb3-4a0b-a1a9-59c49a68c438'
    brain_md = glob.glob(f'{brain_dir}/*.md')
    
    all_files = workspace_md + brain_md
    print(f"Total files to process: {len(all_files)}")

    for f in all_files:
        fix_file_manually(f)

    # Run markdownlint-cli --fix in batches
    batch_size = 15
    for i in range(0, len(all_files), batch_size):
        batch = all_files[i:i+batch_size]
        quoted = ' '.join(f'"{f}"' for f in batch)
        cmd = f'npx markdownlint-cli --fix -c .markdownlint.json {quoted}'
        subprocess.run(cmd, shell=True, capture_output=True)

    print("Fixes applied. Verifying remaining errors...")
    
    # Check remaining errors
    remaining = {}
    for f in all_files:
        res = subprocess.run(f'npx markdownlint-cli -c .markdownlint.json "{f}"', shell=True, capture_output=True, text=True)
        err_lines = [l for l in res.stderr.splitlines() if l.strip()]
        if err_lines:
            remaining[f] = len(err_lines)
            
    print(f"\nRemaining files with errors ({len(remaining)}):")
    for k, v in sorted(remaining.items(), key=lambda x: -x[1])[:20]:
        print(f"  {k}: {v} errors")

if __name__ == '__main__':
    main()
