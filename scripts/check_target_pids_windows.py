import ctypes
from ctypes import wintypes
import sys

user32 = ctypes.windll.user32
pids_to_check = [31604, 6068, 13232, 17992, 21720, 22540, 24264, 26236, 34704, 34724, 37096, 38992]

def check_all_windows():
    found = []
    def cb(hwnd, lp):
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value in pids_to_check or pid.value == 31604:
            length = user32.GetWindowTextLengthW(hwnd)
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            cbuff = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, cbuff, 256)
            vis = user32.IsWindowVisible(hwnd)
            rect = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            found.append({
                'hwnd': hwnd,
                'pid': pid.value,
                'title': buff.value,
                'class': cbuff.value,
                'visible': vis,
                'rect': (rect.left, rect.top, rect.right, rect.bottom)
            })
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(WNDENUMPROC(cb), 0)
    return found

print("Windows for target PIDs:")
for w in check_all_windows():
    print(w)
