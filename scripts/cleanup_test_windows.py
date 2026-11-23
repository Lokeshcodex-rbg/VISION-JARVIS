import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
user32.SetThreadDesktop(h_default)

# Close test instances of Notepad, Word, Excel, VS Code, and Explorer
def close_test_windows():
    def cb(hwnd, lp):
        if user32.IsWindowVisible(hwnd):
            cbuff = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, cbuff, 256)
            cname = cbuff.value
            length = user32.GetWindowTextLengthW(hwnd)
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value
            if cname in ['Notepad', 'OpusApp', 'XLMAIN'] or (cname == 'CabinetWClass' and 'File Explorer' in title):
                print(f"Closing {title} [{cname}] HWND {hwnd}...")
                user32.PostMessageW(hwnd, 0x0010, 0, 0)
        return True
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)

close_test_windows()
