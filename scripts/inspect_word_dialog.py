import ctypes
from ctypes import wintypes
from PIL import ImageGrab
import os

user32 = ctypes.windll.user32
h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
user32.SetThreadDesktop(h_default)

hwnd = 333850
print("Testing HWND 333850...")
rect = wintypes.RECT()
user32.GetWindowRect(hwnd, ctypes.byref(rect))
w = rect.right - rect.left
h = rect.bottom - rect.top
print(f"Rect: {rect.left}, {rect.top}, {rect.right}, {rect.bottom} ({w}x{h})")

# Grab screenshot of this dialog
shot_path = os.path.join(os.getcwd(), 'reports', 'evidence', 'evidence_word_dialog.png')
img = ImageGrab.grab((rect.left, rect.top, rect.right, rect.bottom))
img.save(shot_path)
print(f"Saved dialog screenshot to {shot_path}")

# Enumerate child controls of this dialog
def enum_child_cb(child_hwnd, lparam):
    length = user32.GetWindowTextLengthW(child_hwnd)
    buff = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(child_hwnd, buff, length + 1)
    cbuff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(child_hwnd, cbuff, 256)
    print(f"  Child HWND {child_hwnd}: Class='{cbuff.value}', Text='{buff.value}'")
    return True

WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_cb), 0)
