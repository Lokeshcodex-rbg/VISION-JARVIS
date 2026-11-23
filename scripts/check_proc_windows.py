import ctypes
from ctypes import wintypes
import subprocess

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
user32.SetThreadDesktop(h_default)

def check_proc_windows(pid):
    print(f"\n--- Checking windows for PID {pid} ---")
    windows = []
    def enum_cb(hwnd, lparam):
        p = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
        if p.value == pid:
            length = user32.GetWindowTextLengthW(hwnd)
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            cbuff = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, cbuff, 256)
            vis = user32.IsWindowVisible(hwnd)
            rect = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            windows.append((hwnd, buff.value, cbuff.value, vis, (rect.left, rect.top, rect.right, rect.bottom)))
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    # Check default desktop
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(enum_cb), 0)
    print(f"Default desktop windows for PID {pid}: {len(windows)}")
    for w in windows:
        print(" ", w)

    # Also check EnumWindows
    all_wins = []
    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    print(f"EnumWindows for PID {pid}: {len(all_wins)}")

check_proc_windows(31604) # WINWORD
check_proc_windows(13232) # Code.exe
