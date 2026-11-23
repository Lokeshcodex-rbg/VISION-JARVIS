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

def launch_and_find(name, cmd, search_title, search_class=None, sleep_sec=4.0):
    print(f"\n==========================================")
    print(f"Launching {name}: {cmd}")
    print(f"==========================================")
    desk_buf = ctypes.create_unicode_buffer('WinSta0\\Default')
    si = STARTUPINFO()
    si.cb = ctypes.sizeof(STARTUPINFO)
    si.lpDesktop = ctypes.cast(desk_buf, wintypes.LPWSTR)
    si.dwFlags = 1
    si.wShowWindow = 1
    pi = PROCESS_INFORMATION()

    res = kernel32.CreateProcessW(None, cmd, None, None, False, 0, None, None, ctypes.byref(si), ctypes.byref(pi))
    if not res:
        err = kernel32.GetLastError()
        print(f"CreateProcessW FAILED with error {err}")
        return False

    print(f"Spawned PID {pi.dwProcessId}")
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
            if w > 100 and h > 100:
                match = False
                if search_title and search_title.lower() in title.lower():
                    match = True
                if search_class and search_class.lower() in cname.lower():
                    match = True
                if match:
                    found.append((hwnd, title, cname, (rect.left, rect.top, rect.right, rect.bottom)))
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)

    if found:
        hwnd, title, cname, rect = found[0]
        print(f"SUCCESS: Found window HWND {hwnd}: '{title}' [{cname}] Rect={rect}")
        user32.ShowWindow(hwnd, 9)
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.5)
        shot_path = os.path.join(os.getcwd(), 'reports', 'evidence', f'evidence_launch_{name.lower().replace(" ", "_")}.png')
        img = ImageGrab.grab(rect)
        img.save(shot_path)
        print(f"Saved evidence screenshot: {shot_path} ({img.size})")
        return True
    else:
        print(f"FAILED: No matching window found for {name} (title='{search_title}', class='{search_class}')")
        return False

# Test Word
ok_word = launch_and_find("Microsoft Word", r'"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE"', "Word", "OpusApp", sleep_sec=5.0)

# Test Excel
ok_excel = launch_and_find("Microsoft Excel", r'"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE"', "Excel", "XLMAIN", sleep_sec=5.0)

# Test VS Code
vs_exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')
ok_code = launch_and_find("Visual Studio Code", f'"{vs_exe}"', "Visual Studio Code", None, sleep_sec=5.0)

print("\nRESULTS:")
print("Word:", "PASS" if ok_word else "FAIL")
print("Excel:", "PASS" if ok_excel else "FAIL")
print("VS Code:", "PASS" if ok_code else "FAIL")
