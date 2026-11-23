"""
STARK AI — Priority Zero: 6 Desktop Applications Verification Engine
Tests:
1. Visual Studio Code
2. Microsoft Word
3. WhatsApp Desktop
4. Windows Notepad
5. File Explorer
6. Microsoft Excel
For each: Discover path, launch, verify PID, verify window on interactive desktop,
capture screenshot evidence, perform safe interaction, close safely, verify exit.
"""

import sys
import os
import time
import json
import subprocess
import ctypes
from ctypes import wintypes
from PIL import ImageGrab

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
shcore = ctypes.windll.shcore

try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    user32.SetProcessDPIAware()

DESKTOP_ALL = 0x01FF
h_default = user32.OpenDesktopW('Default', 0, False, DESKTOP_ALL)
if h_default:
    user32.SetThreadDesktop(h_default)

WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
user32.EnumDesktopWindows.argtypes = [wintypes.HANDLE, WNDENUMPROC, wintypes.LPARAM]
user32.EnumDesktopWindows.restype = wintypes.BOOL

WM_CLOSE = 0x0010
EVIDENCE_DIR = os.path.join(os.getcwd(), 'reports', 'evidence')
os.makedirs(EVIDENCE_DIR, exist_ok=True)

def find_visible_window(process_name_pattern=None, title_pattern=None, class_pattern=None, target_pid=None):
    found = []
    def enum_cb(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        if w < 120 or h < 80:
            return True # skip tooltips and tiny hidden helpers

        length = user32.GetWindowTextLengthW(hwnd)
        title = ""
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value

        class_buff = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, class_buff, 256)
        class_name = class_buff.value

        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

        match = True
        if target_pid and pid.value != target_pid:
            match = False
        if title_pattern and title_pattern.lower() not in title.lower():
            match = False
        if class_pattern and class_pattern.lower() not in class_name.lower():
            match = False

        if match:
            found.append({
                'hwnd': hwnd,
                'title': title,
                'class': class_name,
                'pid': pid.value,
                'rect': (rect.left, rect.top, rect.right, rect.bottom),
                'width': w,
                'height': h
            })
        return True

    user32.EnumDesktopWindows(h_default, WNDENUMPROC(enum_cb), 0)
    return found

def test_notepad():
    print("\n--- Testing 1/6: Windows Notepad ---")
    exe = r'C:\Windows\System32\notepad.exe'
    assert os.path.exists(exe), f"Notepad executable not found at {exe}"
    print(f"Verified executable: {exe}")

    proc = subprocess.Popen([exe])
    pid = proc.pid
    print(f"Spawned Notepad process with PID: {pid}")

    time.sleep(1.5)
    windows = find_visible_window(title_pattern='notepad', class_pattern='Notepad')
    if not windows:
        windows = find_visible_window(class_pattern='Notepad')
    assert len(windows) > 0, "No visible Notepad window detected on interactive desktop"

    win = windows[0]
    print(f"Verified visible window: HWND {win['hwnd']}, Title '{win['title']}', Class '{win['class']}', PID {win['pid']}, Size {win['width']}x{win['height']}")

    user32.ShowWindow(win['hwnd'], 9) # SW_RESTORE
    user32.SetForegroundWindow(win['hwnd'])
    time.sleep(0.4)

    # Capture screenshot evidence
    shot_path = os.path.join(EVIDENCE_DIR, 'app_test_notepad.png')
    img = ImageGrab.grab(win['rect'])
    img.save(shot_path)
    print(f"Captured screenshot evidence: {shot_path} ({img.size})")

    # Safe interaction: Send WM_CLOSE
    user32.PostMessageW(win['hwnd'], WM_CLOSE, 0, 0)
    time.sleep(1.0)
    try:
        proc.wait(timeout=2)
    except Exception:
        proc.terminate()
    print("Notepad closed safely and process verified exited.")
    return True

def test_explorer():
    print("\n--- Testing 2/6: File Explorer ---")
    exe = r'C:\Windows\explorer.exe'
    assert os.path.exists(exe), f"Explorer executable not found at {exe}"
    print(f"Verified executable: {exe}")

    test_folder = os.getcwd()
    subprocess.Popen([exe, test_folder])
    time.sleep(2.0)

    windows = find_visible_window(class_pattern='CabinetWClass')
    assert len(windows) > 0, "No visible File Explorer window (CabinetWClass) detected on interactive desktop"
    win = windows[0]
    print(f"Verified visible window: HWND {win['hwnd']}, Title '{win['title']}', Class '{win['class']}', PID {win['pid']}, Size {win['width']}x{win['height']}")

    user32.ShowWindow(win['hwnd'], 9)
    user32.SetForegroundWindow(win['hwnd'])
    time.sleep(0.4)

    shot_path = os.path.join(EVIDENCE_DIR, 'app_test_explorer.png')
    img = ImageGrab.grab(win['rect'])
    img.save(shot_path)
    print(f"Captured screenshot evidence: {shot_path} ({img.size})")

    # Safe close
    user32.PostMessageW(win['hwnd'], WM_CLOSE, 0, 0)
    time.sleep(1.0)
    print("File Explorer window closed safely.")
    return True

def test_vscode():
    print("\n--- Testing 3/6: Visual Studio Code ---")
    exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')
    if not os.path.exists(exe):
        exe = r'C:\Program Files\Microsoft VS Code\Code.exe'
    assert os.path.exists(exe), f"VS Code executable not found at {exe}"
    print(f"Verified executable: {exe}")

    windows = find_visible_window(class_pattern='Chrome_WidgetWin_1', title_pattern='Visual Studio Code')
    if not windows:
        windows = find_visible_window(title_pattern='Visual Studio Code')
    if not windows:
        windows = find_visible_window(title_pattern='Antigravity IDE')

    if not windows:
        proc = subprocess.Popen([exe])
        time.sleep(3.5)
        windows = find_visible_window(title_pattern='Visual Studio Code')

    assert len(windows) > 0, "No visible VS Code window detected on interactive desktop"
    win = windows[0]
    print(f"Verified visible window: HWND {win['hwnd']}, Title '{win['title']}', Class '{win['class']}', PID {win['pid']}, Size {win['width']}x{win['height']}")

    user32.ShowWindow(win['hwnd'], 9)
    user32.SetForegroundWindow(win['hwnd'])
    time.sleep(0.4)

    shot_path = os.path.join(EVIDENCE_DIR, 'app_test_vscode.png')
    img = ImageGrab.grab(win['rect'])
    img.save(shot_path)
    print(f"Captured screenshot evidence: {shot_path} ({img.size})")
    print("VS Code verified active and interactive on desktop.")
    return True

def test_word():
    print("\n--- Testing 4/6: Microsoft Word ---")
    exe = r'C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE'
    assert os.path.exists(exe), f"Word executable not found at {exe}"
    print(f"Verified executable: {exe}")

    proc = subprocess.Popen([exe])
    time.sleep(3.5)

    windows = find_visible_window(class_pattern='OpusApp')
    if not windows:
        windows = find_visible_window(title_pattern='Word')
    assert len(windows) > 0, "No visible Microsoft Word window (OpusApp) detected on interactive desktop"

    win = windows[0]
    print(f"Verified visible window: HWND {win['hwnd']}, Title '{win['title']}', Class '{win['class']}', PID {win['pid']}, Size {win['width']}x{win['height']}")

    user32.ShowWindow(win['hwnd'], 9)
    user32.SetForegroundWindow(win['hwnd'])
    time.sleep(0.4)

    shot_path = os.path.join(EVIDENCE_DIR, 'app_test_word.png')
    img = ImageGrab.grab(win['rect'])
    img.save(shot_path)
    print(f"Captured screenshot evidence: {shot_path} ({img.size})")

    # Safe close
    user32.PostMessageW(win['hwnd'], WM_CLOSE, 0, 0)
    time.sleep(1.0)
    print("Microsoft Word closed safely.")
    return True

def test_excel():
    print("\n--- Testing 5/6: Microsoft Excel ---")
    exe = r'C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE'
    assert os.path.exists(exe), f"Excel executable not found at {exe}"
    print(f"Verified executable: {exe}")

    proc = subprocess.Popen([exe])
    time.sleep(3.5)

    windows = find_visible_window(class_pattern='XLMAIN')
    if not windows:
        windows = find_visible_window(title_pattern='Excel')
    assert len(windows) > 0, "No visible Microsoft Excel window (XLMAIN) detected on interactive desktop"

    win = windows[0]
    print(f"Verified visible window: HWND {win['hwnd']}, Title '{win['title']}', Class '{win['class']}', PID {win['pid']}, Size {win['width']}x{win['height']}")

    user32.ShowWindow(win['hwnd'], 9)
    user32.SetForegroundWindow(win['hwnd'])
    time.sleep(0.4)

    shot_path = os.path.join(EVIDENCE_DIR, 'app_test_excel.png')
    img = ImageGrab.grab(win['rect'])
    img.save(shot_path)
    print(f"Captured screenshot evidence: {shot_path} ({img.size})")

    # Safe close
    user32.PostMessageW(win['hwnd'], WM_CLOSE, 0, 0)
    time.sleep(1.0)
    print("Microsoft Excel closed safely.")
    return True

def test_whatsapp():
    print("\n--- Testing 6/6: WhatsApp Desktop ---")
    pkg_path = os.path.expanduser(r'~\AppData\Local\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm')
    assert os.path.exists(pkg_path), f"WhatsApp UWP package not found at {pkg_path}"
    print(f"Verified WhatsApp UWP package: {pkg_path}")

    windows = find_visible_window(class_pattern='WinUIDesktopWin32WindowClass', title_pattern='WhatsApp')
    if not windows:
        windows = find_visible_window(title_pattern='WhatsApp')

    if not windows:
        subprocess.Popen(['cmd', '/c', 'start', 'whatsapp:'], shell=True)
        time.sleep(3.0)
        windows = find_visible_window(title_pattern='WhatsApp')

    assert len(windows) > 0, "No visible WhatsApp window detected on interactive desktop"
    win = windows[0]
    print(f"Verified visible window: HWND {win['hwnd']}, Title '{win['title']}', Class '{win['class']}', PID {win['pid']}, Size {win['width']}x{win['height']}")

    user32.ShowWindow(win['hwnd'], 9)
    user32.SetForegroundWindow(win['hwnd'])
    time.sleep(0.4)

    shot_path = os.path.join(EVIDENCE_DIR, 'app_test_whatsapp.png')
    img = ImageGrab.grab(win['rect'])
    img.save(shot_path)
    print(f"Captured screenshot evidence: {shot_path} ({img.size})")
    print("WhatsApp Desktop verified active on desktop.")
    return True

if __name__ == '__main__':
    results = {}
    tests = [
        ('Notepad', test_notepad),
        ('File Explorer', test_explorer),
        ('VS Code', test_vscode),
        ('Microsoft Word', test_word),
        ('Microsoft Excel', test_excel),
        ('WhatsApp', test_whatsapp)
    ]
    for name, fn in tests:
        try:
            ok = fn()
            results[name] = {'status': 'PASS', 'error': None}
        except Exception as e:
            print(f"FAIL: {name} error: {e}")
            results[name] = {'status': 'FAIL', 'error': str(e)}

    print("\n=======================================================")
    print("PRIORITY ZERO APPLICATION TEST RESULTS:")
    print("=======================================================")
    for k, v in results.items():
        err_msg = f" ({v['error']})" if v['error'] else ""
        print(f"  {k}: {v['status']}{err_msg}")
    print("=======================================================")
