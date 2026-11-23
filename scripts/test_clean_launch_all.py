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

def test_app_launch(name, cmd_line, search_title, search_class=None, close_after=True, sleep_sec=3.5):
    print(f"\n==================================================")
    print(f"Testing {name}: {cmd_line}")
    print(f"==================================================")

    desk_buf = ctypes.create_unicode_buffer('WinSta0\\Default')
    si = STARTUPINFO()
    si.cb = ctypes.sizeof(STARTUPINFO)
    si.lpDesktop = ctypes.cast(desk_buf, wintypes.LPWSTR)
    si.dwFlags = 1
    si.wShowWindow = 1
    pi = PROCESS_INFORMATION()

    env_buf = get_clean_env_buffer()

    res = kernel32.CreateProcessW(
        None,
        cmd_line,
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
        print(f"CreateProcessW FAILED: error {err}")
        return False, f"CreateProcessW failed ({err})"

    print(f"Spawned PID {pi.dwProcessId} onto WinSta0\\Default")
    kernel32.CloseHandle(pi.hThread)
    kernel32.CloseHandle(pi.hProcess)

    time.sleep(sleep_sec)

    # Search for visible window on Default desktop
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
            if w > 120 and h > 80:
                match = False
                if search_title and search_title.lower() in title.lower():
                    match = True
                if search_class and search_class.lower() == cname.lower():
                    match = True
                if match:
                    found.append({
                        'hwnd': hwnd,
                        'title': title,
                        'class': cname,
                        'pid': pid.value,
                        'rect': (rect.left, rect.top, rect.right, rect.bottom),
                        'width': w,
                        'height': h
                    })
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)

    if not found:
        print(f"FAILED: No visible window found matching title='{search_title}', class='{search_class}'")
        return False, "No visible window found"

    win = found[0]
    print(f"SUCCESS: Found window HWND {win['hwnd']}: '{win['title']}' [{win['class']}] PID {win['pid']} Rect {win['rect']}")

    # Bring to foreground and focus
    user32.ShowWindow(win['hwnd'], 9)
    user32.SetForegroundWindow(win['hwnd'])
    time.sleep(0.4)

    # Capture screenshot evidence
    shot_path = os.path.join(os.getcwd(), 'reports', 'evidence', f"evidence_launch_{name.lower().replace(' ', '_')}.png")
    img = ImageGrab.grab(win['rect'])
    img.save(shot_path)
    print(f"Captured screenshot evidence: {shot_path} ({img.size})")

    if close_after:
        print(f"Closing window safely via WM_CLOSE...")
        user32.PostMessageW(win['hwnd'], WM_CLOSE, 0, 0)
        time.sleep(1.0)

    return True, None

if __name__ == '__main__':
    results = {}

    # 1. Notepad
    ok, err = test_app_launch("Notepad", r"C:\Windows\System32\notepad.exe", "", "Notepad", close_after=True, sleep_sec=1.5)
    results["Notepad"] = "PASS" if ok else f"FAIL ({err})"

    # 2. File Explorer
    ok, err = test_app_launch("File Explorer", r"C:\Windows\explorer.exe d:\Jarvis", "Jarvis", "CabinetWClass", close_after=True, sleep_sec=2.0)
    results["File Explorer"] = "PASS" if ok else f"FAIL ({err})"

    # 3. Microsoft Word
    ok, err = test_app_launch("Microsoft Word", r'"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE" /q', "", "OpusApp", close_after=True, sleep_sec=3.5)
    results["Microsoft Word"] = "PASS" if ok else f"FAIL ({err})"

    # 4. Microsoft Excel
    ok, err = test_app_launch("Microsoft Excel", r'"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE" /e', "", "XLMAIN", close_after=True, sleep_sec=3.5)
    results["Microsoft Excel"] = "PASS" if ok else f"FAIL ({err})"

    # 5. Visual Studio Code
    vs_exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')
    ok, err = test_app_launch("Visual Studio Code", f'"{vs_exe}" --new-window', "Visual Studio Code", None, close_after=False, sleep_sec=4.0)
    results["Visual Studio Code"] = "PASS" if ok else f"FAIL ({err})"

    # 6. WhatsApp Desktop
    ok, err = test_app_launch("WhatsApp", r"C:\Windows\System32\cmd.exe /c start whatsapp:", "WhatsApp", "WinUIDesktopWin32WindowClass", close_after=False, sleep_sec=2.5)
    results["WhatsApp"] = "PASS" if ok else f"FAIL ({err})"

    print("\n" + "="*60)
    print("FINAL VERIFIED 6-APP RESULTS:")
    print("="*60)
    for app, res in results.items():
        print(f"  {app:20s}: {res}")
    print("="*60)
