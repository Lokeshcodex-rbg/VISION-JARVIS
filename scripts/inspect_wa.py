import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
shcore = ctypes.windll.shcore
try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    user32.SetProcessDPIAware()

winsta0 = user32.OpenWindowStationW("WinSta0", False, 0x037F)
if winsta0:
    user32.SetProcessWindowStation(winsta0)

h_desk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
if h_desk:
    user32.SetThreadDesktop(h_desk)

hwnd = 526618
print("IsIconic:", user32.IsIconic(hwnd))

# Restore
user32.ShowWindow(hwnd, 9) # SW_RESTORE
time.sleep(0.5)

rect = wintypes.RECT()
user32.GetWindowRect(hwnd, ctypes.byref(rect))
print(f"Restored Window Rect: left={rect.left}, top={rect.top}, right={rect.right}, bottom={rect.bottom}, width={rect.right-rect.left}, height={rect.bottom-rect.top}")
