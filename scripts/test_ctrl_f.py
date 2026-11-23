import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
winsta0 = user32.OpenWindowStationW("WinSta0", False, 0x037F)
if winsta0: user32.SetProcessWindowStation(winsta0)
h_desk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
if h_desk: user32.SetThreadDesktop(h_desk)

def tap(vk):
    user32.keybd_event(vk, 0, 0, 0)
    time.sleep(0.04)
    user32.keybd_event(vk, 0, 2, 0)
    time.sleep(0.04)

def hotkey(*vks):
    for vk in vks:
        user32.keybd_event(vk, 0, 0, 0)
        time.sleep(0.03)
    time.sleep(0.05)
    for vk in reversed(vks):
        user32.keybd_event(vk, 0, 2, 0)
        time.sleep(0.03)
    time.sleep(0.05)

hwnd = 526618
user32.ShowWindow(hwnd, 5)
user32.SetForegroundWindow(hwnd)
time.sleep(0.3)

# Send Ctrl+F
hotkey(0x11, 0x46) # VK_CONTROL, VK_F
time.sleep(0.3)

# Type 'test_search'
for c in "Harsh":
    vk = ord(c.upper())
    tap(vk)

print("Sent Ctrl+F and typed Harsh")

