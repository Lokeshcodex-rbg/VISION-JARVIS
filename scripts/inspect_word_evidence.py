import ctypes
from ctypes import wintypes
import pytesseract
from PIL import Image

user32 = ctypes.windll.user32
h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
user32.SetThreadDesktop(h_default)

hwnd = 788376
print(f"Inspecting HWND {hwnd}:")
length = user32.GetWindowTextLengthW(hwnd)
buff = ctypes.create_unicode_buffer(length + 1)
user32.GetWindowTextW(hwnd, buff, length + 1)
print(f"Title: {buff.value}")

def enum_child_cb(child_hwnd, lparam):
    length = user32.GetWindowTextLengthW(child_hwnd)
    buff = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(child_hwnd, buff, length + 1)
    cbuff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(child_hwnd, cbuff, 256)
    vis = user32.IsWindowVisible(child_hwnd)
    if vis and buff.value:
        print(f"  Child HWND {child_hwnd}: Class='{cbuff.value}', Text='{buff.value}'")
    return True

WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_cb), 0)

# OCR the screenshot
img_path = r'D:\Jarvis\reports\evidence\evidence_launch_microsoft_word.png'
try:
    img = Image.open(img_path)
    text = pytesseract.image_to_string(img)
    print("\nOCR of Word Dialog Screenshot:")
    print(text.strip())
except Exception as e:
    print(f"OCR error: {e}")
