import ctypes
from ctypes import wintypes
import time
import os

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
user32.SetThreadDesktop(h_default)

def list_default_windows(filter_str=""):
    wins = []
    def cb(hwnd, lp):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            cbuff = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, cbuff, 256)
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            title = buff.value
            cname = cbuff.value
            if not filter_str or filter_str.lower() in title.lower() or filter_str.lower() in cname.lower():
                wins.append((hwnd, title, cname, pid.value))
        return True
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)
    return wins

print("Current windows before test:")
for w in list_default_windows():
    print(" ", w)

# Test launching via cmd /c start
for app_cmd, label in [("winword", "Word"), ("excel", "Excel"), ("code", "VS Code")]:
    print(f"\n--- Launching {label} via 'cmd /c start {app_cmd}' ---")
    desk_buf = ctypes.create_unicode_buffer('WinSta0\\Default')
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

    si = STARTUPINFO()
    si.cb = ctypes.sizeof(STARTUPINFO)
    si.lpDesktop = ctypes.cast(desk_buf, wintypes.LPWSTR)
    si.dwFlags = 1
    si.wShowWindow = 1
    pi = PROCESS_INFORMATION()

    cmd = f'C:\\Windows\\System32\\cmd.exe /c start "" {app_cmd}'
    res = kernel32.CreateProcessW(None, cmd, None, None, False, 0, None, None, ctypes.byref(si), ctypes.byref(pi))
    print(f"CreateProcessW result: {res}, PID: {pi.dwProcessId}")
    kernel32.CloseHandle(pi.hThread)
    kernel32.CloseHandle(pi.hProcess)

    time.sleep(4.0)
    print(f"Windows matching {label} or new windows:")
    matching = list_default_windows()
    for w in matching:
        print("  ", w)
