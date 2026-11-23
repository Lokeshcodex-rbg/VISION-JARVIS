import sys, os
sys.path.insert(0, os.path.abspath('.'))
import time
import ctypes
from ctypes import wintypes
from PIL import Image

from server.desktop.whatsapp_automator import (
    find_whatsapp_window, get_window_rect, force_foreground,
    click_coords, tap_key, hotkey, set_clipboard_text,
    VK_RETURN, VK_CONTROL, VK_A, VK_V, VK_BACK
)

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

def capture_rect(x1, y1, x2, y2):
    w = x2 - x1
    h = y2 - y1
    hdc_screen = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    hbmp = gdi32.CreateCompatibleBitmap(hdc_screen, w, h)
    gdi32.SelectObject(hdc_mem, hbmp)
    gdi32.BitBlt(hdc_mem, 0, 0, w, h, hdc_screen, x1, y1, 0x00CC0020)

    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [
            ("biSize", wintypes.DWORD), ("biWidth", wintypes.LONG), ("biHeight", wintypes.LONG),
            ("biPlanes", wintypes.WORD), ("biBitCount", wintypes.WORD), ("biCompression", wintypes.DWORD),
            ("biSizeImage", wintypes.DWORD), ("biXPelsPerMeter", wintypes.LONG), ("biYPelsPerMeter", wintypes.LONG),
            ("biClrUsed", wintypes.DWORD), ("biClrImportant", wintypes.DWORD)
        ]
    bmi = BITMAPINFOHEADER()
    bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.biWidth = w
    bmi.biHeight = -h
    bmi.biPlanes = 1
    bmi.biBitCount = 32
    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(hdc_mem, hbmp, 0, h, buf, ctypes.byref(bmi), 0)
    user32.ReleaseDC(0, hdc_screen)
    gdi32.DeleteDC(hdc_mem)
    gdi32.DeleteObject(hbmp)
    return Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1).convert("RGB")

hwnd = find_whatsapp_window()
print("HWND:", hwnd)
rect = get_window_rect(hwnd)
print("Rect:", rect.left, rect.top, rect.right, rect.bottom)
w = rect.right - rect.left
h = rect.bottom - rect.top

# Crop composer region
comp_img = capture_rect(max(0, rect.left), rect.bottom - 70, rect.right, rect.bottom)
comp_img.save("D:/Jarvis/wa_test_composer.png")
print("Composer area captured: size", comp_img.size)

