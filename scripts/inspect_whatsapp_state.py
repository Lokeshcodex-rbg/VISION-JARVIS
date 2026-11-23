import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32

def get_title(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

def get_class(hwnd):
    buff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, buff, 256)
    return buff.value

fg = user32.GetForegroundWindow()
print(f"Current Foreground Window: HWND={fg}, Title='{get_title(fg)}', Class='{get_class(fg)}'")

import sys
sys.path.append('server/desktop')
import whatsapp_automator as wa

wa_hwnd = wa.find_whatsapp_window()
if wa_hwnd:
    rect = wa.get_window_rect(wa_hwnd)
    print(f"WhatsApp Window Found: HWND={wa_hwnd}, Title='{get_title(wa_hwnd)}', Class='{get_class(wa_hwnd)}'")
    print(f"Rect: left={rect.left}, top={rect.top}, right={rect.right}, bottom={rect.bottom}, width={rect.right - rect.left}, height={rect.bottom - rect.top}")
else:
    print("WhatsApp Window NOT found via find_whatsapp_window()")

