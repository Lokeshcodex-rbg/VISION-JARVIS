import ctypes
from ctypes import wintypes
import time
import os
from PIL import ImageGrab

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
shcore = ctypes.windll.shcore

try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    user32.SetProcessDPIAware()

h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
user32.SetThreadDesktop(h_default)

class STARTUPINFO(ctypes.Structure):
    _fields_ = [
        ('cb', wintypes.DWORD), ('lpReserved', wintypes.LPWSTR), ('lpDesktop', wintypes.LPWSTR),
        ('lpTitle', wintypes.LPWSTR), ('dwX', wintypes.DWORD), ('dwY', wintypes.DWORD),
        ('dwXSize', wintypes.DWORD), ('dwYSize', wintypes.DWORD), ('dwXCountChars', wintypes.DWORD),
        ('dwYCountChars', wintypes.DWORD), ('dwFillAttribute', wintypes.DWORD), ('dwFlags', wintypes.DWORD),
        ('wShowWindow', wintypes.WORD), ('cbReserved2', wintypes.WORD), ('lpReserved2', ctypes.c_char_p),
        ('hStdInput', wintypes.HANDLE), ('hStdOutput', wintypes.HANDLE), ('hStdError', wintypes.HANDLE)
    ]

class PROCESS_INFORMATION(ctypes.Structure):
    _fields_ = [('hProcess', wintypes.HANDLE), ('hThread', wintypes.HANDLE), ('dwProcessId', wintypes.DWORD), ('dwThreadId', wintypes.DWORD)]

clean_env = os.environ.copy()
for k in list(clean_env.keys()):
    if 'ELECTRON' in k or 'VSCODE' in k:
        del clean_env[k]
env_str = ""
for k, v in clean_env.items():
    env_str += f"{k}={v}\0"
env_str += "\0"
env_buf = ctypes.create_unicode_buffer(env_str)

CREATE_UNICODE_ENVIRONMENT = 0x00000400

desk_buf = ctypes.create_unicode_buffer('WinSta0\\Default')
si = STARTUPINFO()
si.cb = ctypes.sizeof(STARTUPINFO)
si.lpDesktop = ctypes.cast(desk_buf, wintypes.LPWSTR)
si.dwFlags = 1
si.wShowWindow = 1
pi = PROCESS_INFORMATION()

vs_exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')
data_dir = os.path.expanduser(r'~\.vscode-standalone')
cmd = f'"{vs_exe}" --user-data-dir "{data_dir}" --new-window'
print(f"Launching VS Code with standalone data dir: {cmd}")

res = kernel32.CreateProcessW(
    None,
    cmd,
    None,
    None,
    False,
    CREATE_UNICODE_ENVIRONMENT,
    ctypes.byref(env_buf),
    None,
    ctypes.byref(si),
    ctypes.byref(pi)
)
print(f"CreateProcessW: {res}, PID: {pi.dwProcessId}")
kernel32.CloseHandle(pi.hThread)
kernel32.CloseHandle(pi.hProcess)

for i in range(10):
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
            rect = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            w = rect.right - rect.left
            h = rect.bottom - rect.top
            p = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
            if w > 300 and h > 200 and 'Chrome_WidgetWin_1' in cname:
                if 'Antigravity' not in title and 'Chrome' not in title and 'WhatsApp' not in title:
                    found.append((hwnd, title, cname, p.value, (rect.left, rect.top, rect.right, rect.bottom)))
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)
    if found:
        hwnd, title, cname, pid_val, rect = found[0]
        print(f"\nFOUND STANDALONE VS CODE WINDOW! HWND {hwnd}: '{title}' [{cname}] PID {pid_val} Rect {rect}")
        user32.ShowWindow(hwnd, 9)
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.5)
        shot_path = os.path.join(os.getcwd(), 'reports', 'evidence', 'evidence_launch_visual_studio_code.png')
        img = ImageGrab.grab(rect)
        img.save(shot_path)
        print(f"Captured screenshot evidence: {shot_path} ({img.size})")
        break
    else:
        print(f"Sec {i+1}: Waiting for standalone VS Code window...")
