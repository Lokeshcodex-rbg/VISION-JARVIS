import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
if h_default:
    user32.SetThreadDesktop(h_default)

hwnd = 526618
print("Before ShowWindow, IsWindowVisible:", user32.IsWindowVisible(hwnd))
user32.ShowWindow(hwnd, 9) # SW_RESTORE
time.sleep(0.3)
print("After SW_RESTORE, IsWindowVisible:", user32.IsWindowVisible(hwnd))
user32.ShowWindow(hwnd, 5) # SW_SHOW
time.sleep(0.3)
print("After SW_SHOW, IsWindowVisible:", user32.IsWindowVisible(hwnd))
user32.SetForegroundWindow(hwnd)
time.sleep(0.3)
print("After SetForegroundWindow, IsWindowVisible:", user32.IsWindowVisible(hwnd))

