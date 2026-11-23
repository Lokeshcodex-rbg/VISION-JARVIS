import ctypes
from ctypes import wintypes
import time
import os
import subprocess

user32 = ctypes.windll.user32
h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
user32.SetThreadDesktop(h_default)

clean_env = os.environ.copy()
for k in list(clean_env.keys()):
    if 'ELECTRON' in k or 'VSCODE' in k:
        del clean_env[k]

vs_exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')

# Launch using subprocess with clean_env
proc = subprocess.Popen([vs_exe, r'd:\Jarvis'], env=clean_env)
print(f"Subprocess Popen PID: {proc.pid}")

for i in range(12):
    time.sleep(1.0)
    found = []
    def cb(hwnd, lp):
        if user32.IsWindowVisible(hwnd):
            cbuff = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, cbuff, 256)
            length = user32.GetWindowTextLengthW(hwnd)
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value
            cname = cbuff.value
            p = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
            if 'code' in title.lower() or 'jarvis' in title.lower() or 'chrome_widgetwin' in cname.lower():
                found.append((hwnd, title, cname, p.value))
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)
    print(f"Sec {i+1}: matching windows = {len(found)}")
    for w in found:
        print("  ", w)
    if any('visual studio code' in w[1].lower() for w in found):
        print("FOUND VISUAL STUDIO CODE!")
        break
