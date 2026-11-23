import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

winsta0 = user32.OpenWindowStationW("WinSta0", False, 0x037F)
if winsta0: user32.SetProcessWindowStation(winsta0)
h_desk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
if h_desk: user32.SetThreadDesktop(h_desk)

hdc_screen = user32.GetDC(0)
print("Screen DC:", hdc_screen)
user32.ReleaseDC(0, hdc_screen)

