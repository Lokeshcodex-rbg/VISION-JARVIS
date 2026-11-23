import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
winsta0 = user32.OpenWindowStationW("WinSta0", False, 0x037F)
if winsta0: user32.SetProcessWindowStation(winsta0)
h_desk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
if h_desk: user32.SetThreadDesktop(h_desk)

def click_coords(x, y, delay=0.1):
    sw = user32.GetSystemMetrics(0)
    sh = user32.GetSystemMetrics(1)
    norm_x = int(x * 65535 / (sw - 1))
    norm_y = int(y * 65535 / (sh - 1))
    user32.mouse_event(0x8001, norm_x, norm_y, 0, 0)
    time.sleep(0.06)
    user32.mouse_event(0x0002, 0, 0, 0, 0)
    time.sleep(0.04)
    user32.mouse_event(0x0004, 0, 0, 0, 0)
    time.sleep(delay)

hwnd = 526618
user32.ShowWindow(hwnd, 5)
user32.SetForegroundWindow(hwnd)
time.sleep(0.3)

# Click search box
click_coords(128, 114)
time.sleep(0.2)

# Type 'Harsh' using keyboard events
for char in "Harsh":
    vk = ord(char.upper())
    user32.keybd_event(vk, 0, 0, 0)
    time.sleep(0.03)
    user32.keybd_event(vk, 0, 2, 0)
    time.sleep(0.03)

print("Typed 'Harsh' into search box!")

