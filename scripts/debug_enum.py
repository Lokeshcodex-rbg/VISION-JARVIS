import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32
h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
if h_default:
    user32.SetThreadDesktop(h_default)

WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
user32.EnumDesktopWindows.argtypes = [wintypes.HANDLE, WNDENUMPROC, wintypes.LPARAM]
user32.EnumDesktopWindows.restype = wintypes.BOOL

def enum_cb(hwnd, lparam):
    length = user32.GetWindowTextLengthW(hwnd)
    buff = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buff, length + 1)
    class_buff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, class_buff, 256)
    vis = user32.IsWindowVisible(hwnd)
    if "whatsapp" in buff.value.lower() or "whatsapp" in class_buff.value.lower():
        print(f"HWND: {hwnd}, Visible: {vis}, Title: '{buff.value}', Class: '{class_buff.value}'")
    return True

user32.EnumDesktopWindows(h_default, WNDENUMPROC(enum_cb), 0)

