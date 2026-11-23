"""
STARK AI — Verified Win32 Interactive Desktop Launcher
Launches processes directly onto 'WinSta0\\Default' interactive user desktop.
"""

import sys
import os
import time
import ctypes
from ctypes import wintypes
from PIL import ImageGrab

kernel32 = ctypes.windll.kernel32
user32 = ctypes.windll.user32
shcore = ctypes.windll.shcore

try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    user32.SetProcessDPIAware()

DESKTOP_ALL = 0x01FF
h_default = user32.OpenDesktopW('Default', 0, False, DESKTOP_ALL)
if h_default:
    user32.SetThreadDesktop(h_default)

class STARTUPINFO(ctypes.Structure):
    _fields_ = [
        ('cb', wintypes.DWORD),
        ('lpReserved', wintypes.LPWSTR),
        ('lpDesktop', wintypes.LPWSTR),
        ('lpTitle', wintypes.LPWSTR),
        ('dwX', wintypes.DWORD),
        ('dwY', wintypes.DWORD),
        ('dwXSize', wintypes.DWORD),
        ('dwYSize', wintypes.DWORD),
        ('dwXCountChars', wintypes.DWORD),
        ('dwYCountChars', wintypes.DWORD),
        ('dwFillAttribute', wintypes.DWORD),
        ('dwFlags', wintypes.DWORD),
        ('wShowWindow', wintypes.WORD),
        ('cbReserved2', wintypes.WORD),
        ('lpReserved2', ctypes.c_char_p),
        ('hStdInput', wintypes.HANDLE),
        ('hStdOutput', wintypes.HANDLE),
        ('hStdError', wintypes.HANDLE),
    ]

class PROCESS_INFORMATION(ctypes.Structure):
    _fields_ = [
        ('hProcess', wintypes.HANDLE),
        ('hThread', wintypes.HANDLE),
        ('dwProcessId', wintypes.DWORD),
        ('dwThreadId', wintypes.DWORD),
    ]

EVIDENCE_DIR = os.path.join(os.getcwd(), 'reports', 'evidence')
os.makedirs(EVIDENCE_DIR, exist_ok=True)
WM_CLOSE = 0x0010

def launch_on_interactive_desktop(cmd_line, app_dir=None):
    desk_buf = ctypes.create_unicode_buffer('WinSta0\\Default')
    si = STARTUPINFO()
    si.cb = ctypes.sizeof(STARTUPINFO)
    si.lpDesktop = ctypes.cast(desk_buf, wintypes.LPWSTR)
    si.dwFlags = 1 # STARTF_USESHOWWINDOW
    si.wShowWindow = 1 # SW_SHOWNORMAL

    pi = PROCESS_INFORMATION()

    res = kernel32.CreateProcessW(
        None,
        cmd_line,
        None,
        None,
        False,
        0,
        None,
        app_dir,
        ctypes.byref(si),
        ctypes.byref(pi)
    )

    if not res:
        err = kernel32.GetLastError()
        return False, None, f"CreateProcessW failed with error {err}"

    kernel32.CloseHandle(pi.hThread)
    kernel32.CloseHandle(pi.hProcess)
    return True, pi.dwProcessId, None

def find_windows_on_default(class_name=None, title_substring=None):
    found = []
    def enum_cb(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        if w < 120 or h < 80:
            return True

        length = user32.GetWindowTextLengthW(hwnd)
        title = ""
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value

        cbuff = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cbuff, 256)
        cname = cbuff.value

        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

        match = True
        if class_name and class_name.lower() not in cname.lower():
            match = False
        if title_substring and title_substring.lower() not in title.lower():
            match = False

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
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(enum_cb), 0)
    return found

def test_app(name, cmd, class_name, title_sub, sleep_sec=3.5, close_after=True):
    print(f"\n==================================================")
    print(f"Testing {name}: {cmd}")
    print(f"==================================================")

    # 1. Launch on interactive desktop
    success, pid, err = launch_on_interactive_desktop(cmd)
    if not success:
        print(f"FAILED to launch {name}: {err}")
        return False, err

    print(f"Launched on WinSta0\\Default with PID {pid}")
    time.sleep(sleep_sec)

    # 2. Verify window on interactive desktop
    windows = find_windows_on_default(class_name=class_name, title_substring=title_sub)
    if not windows:
        print(f"FAILED: No visible window found on Default desktop for {name} (class={class_name}, title={title_sub})")
        return False, "Window not found on Default desktop"

    win = windows[0]
    print(f"SUCCESS: Found visible window HWND {win['hwnd']} | Title: '{win['title']}' | Class: '{win['class']}' | PID: {win['pid']} | Rect: {win['rect']}")

    # 3. Bring to foreground and focus
    user32.ShowWindow(win['hwnd'], 9) # SW_RESTORE
    user32.SetForegroundWindow(win['hwnd'])
    time.sleep(0.4)

    # 4. Capture screenshot evidence
    shot_name = f"evidence_launch_{name.lower().replace(' ', '_')}.png"
    shot_path = os.path.join(EVIDENCE_DIR, shot_name)
    img = ImageGrab.grab(win['rect'])
    img.save(shot_path)
    print(f"Captured screenshot evidence: {shot_path} ({img.size})")

    # 5. Safe close if requested
    if close_after:
        print(f"Sending safe WM_CLOSE to HWND {win['hwnd']}...")
        user32.PostMessageW(win['hwnd'], WM_CLOSE, 0, 0)
        time.sleep(1.2)
        # Verify exited or closing
        after_windows = find_windows_on_default(class_name=class_name, title_substring=title_sub)
        still_there = any(w['hwnd'] == win['hwnd'] for w in after_windows)
        print(f"Window closed verified: {not still_there}")

    return True, None

if __name__ == '__main__':
    all_results = {}

    # 1. Windows Notepad
    ok, err = test_app('Notepad', r'C:\Windows\System32\notepad.exe', 'Notepad', '', sleep_sec=1.5, close_after=True)
    all_results['Notepad'] = {'status': 'PASS' if ok else 'FAIL', 'error': err}

    # 2. File Explorer
    ok, err = test_app('File Explorer', r'C:\Windows\explorer.exe d:\Jarvis', 'CabinetWClass', '', sleep_sec=2.0, close_after=True)
    all_results['File Explorer'] = {'status': 'PASS' if ok else 'FAIL', 'error': err}

    # 3. Microsoft Word
    ok, err = test_app('Microsoft Word', r'"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE"', 'OpusApp', '', sleep_sec=3.5, close_after=True)
    all_results['Microsoft Word'] = {'status': 'PASS' if ok else 'FAIL', 'error': err}

    # 4. Microsoft Excel
    ok, err = test_app('Microsoft Excel', r'"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE"', 'XLMAIN', '', sleep_sec=3.5, close_after=True)
    all_results['Microsoft Excel'] = {'status': 'PASS' if ok else 'FAIL', 'error': err}

    # 5. Visual Studio Code
    vs_exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')
    ok, err = test_app('Visual Studio Code', f'"{vs_exe}"', 'Chrome_WidgetWin_1', 'Visual Studio Code', sleep_sec=3.5, close_after=False)
    all_results['Visual Studio Code'] = {'status': 'PASS' if ok else 'FAIL', 'error': err}

    # 6. WhatsApp Desktop
    ok, err = test_app('WhatsApp', r'C:\Windows\System32\cmd.exe /c start whatsapp:', 'WinUIDesktopWin32WindowClass', 'WhatsApp', sleep_sec=2.5, close_after=False)
    all_results['WhatsApp'] = {'status': 'PASS' if ok else 'FAIL', 'error': err}

    print("\n" + "="*60)
    print("FINAL 6-APP VERIFICATION SUMMARY:")
    print("="*60)
    for name, res in all_results.items():
        err_str = f" ({res['error']})" if res['error'] else ""
        print(f"  {name:20s}: {res['status']}{err_str}")
    print("="*60)
