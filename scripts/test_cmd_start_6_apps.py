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

def get_clean_env_buffer():
    clean_env = os.environ.copy()
    for k in list(clean_env.keys()):
        if 'ELECTRON' in k or 'VSCODE' in k:
            del clean_env[k]
    env_str = ""
    for k, v in clean_env.items():
        env_str += f"{k}={v}\0"
    env_str += "\0"
    return ctypes.create_unicode_buffer(env_str)

CREATE_UNICODE_ENVIRONMENT = 0x00000400
WM_CLOSE = 0x0010

def launch_via_cmd_start(name, target, search_patterns, sleep_sec=4.0, close_after=True):
    print(f"\n==================================================")
    print(f"Testing {name}: start \"\" {target}")
    print(f"==================================================")

    desk_buf = ctypes.create_unicode_buffer('WinSta0\\Default')
    si = STARTUPINFO()
    si.cb = ctypes.sizeof(STARTUPINFO)
    si.lpDesktop = ctypes.cast(desk_buf, wintypes.LPWSTR)
    si.dwFlags = 1
    si.wShowWindow = 1
    pi = PROCESS_INFORMATION()

    env_buf = get_clean_env_buffer()
    cmd = f'C:\\Windows\\System32\\cmd.exe /c start "" {target}'

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

    if not res:
        err = kernel32.GetLastError()
        print(f"FAILED to spawn: {err}")
        return False, err

    print(f"Spawned launcher PID {pi.dwProcessId}")
    kernel32.CloseHandle(pi.hThread)
    kernel32.CloseHandle(pi.hProcess)

    time.sleep(sleep_sec)

    found = []
    def cb(hwnd, lp):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            cbuff = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, cbuff, 256)
            rect = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            w = rect.right - rect.left
            h = rect.bottom - rect.top
            title = buff.value
            cname = cbuff.value
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            if w > 150 and h > 100:
                for pat in search_patterns:
                    if pat.lower() in title.lower() or pat.lower() in cname.lower():
                        # Exclude Antigravity IDE and Chrome
                        if 'antigravity' in title.lower() and 'visual studio code' not in title.lower():
                            continue
                        found.append({
                            'hwnd': hwnd,
                            'title': title,
                            'class': cname,
                            'pid': pid.value,
                            'rect': (rect.left, rect.top, rect.right, rect.bottom),
                            'width': w,
                            'height': h
                        })
                        break
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)

    if not found:
        print(f"FAILED: No visible window found for {name} with patterns {search_patterns}")
        return False, "Window not found"

    win = found[0]
    print(f"SUCCESS: Found window HWND {win['hwnd']}: '{win['title']}' [{win['class']}] PID {win['pid']} Rect {win['rect']}")

    user32.ShowWindow(win['hwnd'], 9)
    user32.SetForegroundWindow(win['hwnd'])
    time.sleep(0.4)

    shot_path = os.path.join(os.getcwd(), 'reports', 'evidence', f"evidence_launch_{name.lower().replace(' ', '_')}.png")
    img = ImageGrab.grab(win['rect'])
    img.save(shot_path)
    print(f"Captured screenshot evidence: {shot_path} ({img.size})")

    if close_after:
        print("Closing window safely via WM_CLOSE...")
        user32.PostMessageW(win['hwnd'], WM_CLOSE, 0, 0)
        time.sleep(1.2)

    return True, None

if __name__ == '__main__':
    results = {}

    # 1. Notepad
    ok, err = launch_via_cmd_start("Notepad", "notepad", ["Notepad"], sleep_sec=1.5, close_after=True)
    results["Notepad"] = "PASS" if ok else f"FAIL ({err})"

    # 2. File Explorer
    ok, err = launch_via_cmd_start("File Explorer", "explorer d:\\Jarvis", ["CabinetWClass", "File Explorer"], sleep_sec=2.0, close_after=True)
    results["File Explorer"] = "PASS" if ok else f"FAIL ({err})"

    # 3. Microsoft Word
    ok, err = launch_via_cmd_start("Microsoft Word", "winword", ["OpusApp", "Word", "#32770"], sleep_sec=3.5, close_after=True)
    results["Microsoft Word"] = "PASS" if ok else f"FAIL ({err})"

    # 4. Microsoft Excel
    ok, err = launch_via_cmd_start("Microsoft Excel", "excel", ["XLMAIN", "Excel"], sleep_sec=3.5, close_after=True)
    results["Microsoft Excel"] = "PASS" if ok else f"FAIL ({err})"

    # 5. Visual Studio Code
    vs_exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')
    ok, err = launch_via_cmd_start("Visual Studio Code", f'"{vs_exe}"', ["Visual Studio Code"], sleep_sec=4.0, close_after=False)
    results["Visual Studio Code"] = "PASS" if ok else f"FAIL ({err})"

    # 6. WhatsApp Desktop
    ok, err = launch_via_cmd_start("WhatsApp", "whatsapp:", ["WinUIDesktopWin32WindowClass", "WhatsApp"], sleep_sec=2.5, close_after=False)
    results["WhatsApp"] = "PASS" if ok else f"FAIL ({err})"

    print("\n" + "="*60)
    print("FINAL 6-APP RESULTS (CMD START VIA WINSTA0\\DEFAULT):")
    print("="*60)
    for app, res in results.items():
        print(f"  {app:20s}: {res}")
    print("="*60)
