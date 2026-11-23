import subprocess
import os

clean_env = os.environ.copy()
for k in list(clean_env.keys()):
    if 'ELECTRON' in k or 'VSCODE' in k:
        del clean_env[k]

vs_exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')
p = subprocess.run([vs_exe, '--verbose'], env=clean_env, capture_output=True, text=True, timeout=10)
print("Returncode:", p.returncode)
print("STDOUT:", p.stdout)
print("STDERR:", p.stderr)
