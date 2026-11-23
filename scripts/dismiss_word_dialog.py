import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
user32.SetThreadDesktop(h_default)

VK_RETURN = 0x0D
VK_N = 0x4E

# Find the Word dialog (#32770) and press Enter or 'N'
def cb(hwnd, lp):
    if user32.IsWindowVisible(hwnd):
        cbuff = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cbuff, 256)
        length = user32.GetWindowTextLengthW(hwnd)
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        if cbuff.value == '#32770' or 'Word' in buff.value:
            print(f"Found dialog HWND {hwnd}: Title='{buff.value}', Class='{cbuff.value}'")
            user32.SetForegroundWindow(hwnd)
            time.sleep(0.3)
            # Send 'N' or Enter
            user32.PostMessageW(hwnd, 0x0100, VK_RETURN, 0)
            user32.PostMessageW(hwnd, 0x0101, VK_RETURN, 0)
            print("Sent VK_RETURN to dialog")
    return True

WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)

time.sleep(2.0)
print("\nChecking for Word OpusApp window:")
def cb_word(hwnd, lp):
    if user32.IsWindowVisible(hwnd):
        cbuff = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cbuff, 256)
        length = user32.GetWindowTextLengthW(hwnd)
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        if cbuff.value == 'OpusApp' or 'Word' in buff.value:
            print(f"  Word Window HWND {hwnd}: Title='{buff.value}', Class='{cbuff.value}'")
    return True

user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb_word), 0)
