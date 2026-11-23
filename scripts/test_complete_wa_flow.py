import sys, os
sys.path.insert(0, os.path.abspath('.'))
import time
import ctypes
from ctypes import wintypes
from PIL import Image

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
shcore = ctypes.windll.shcore
try: shcore.SetProcessDpiAwareness(2)
except: pass

winsta0 = user32.OpenWindowStationW('WinSta0', False, 0x037F)
if winsta0: user32.SetProcessWindowStation(winsta0)
h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
if not h_default:
    try: h_default = user32.OpenInputDesktop(0, False, 0x01FF)
    except: pass
if h_default: user32.SetThreadDesktop(h_default)

from server.desktop.whatsapp_automator import (
    find_whatsapp_window, get_window_rect, force_foreground,
    click_coords, tap_key, hotkey, set_clipboard_text,
    VK_RETURN, VK_CONTROL, VK_A, VK_V, VK_BACK, VK_DOWN, VK_ESCAPE, VK_F
)

def capture_rect(x1, y1, x2, y2):
    w = max(1, x2 - x1)
    h = max(1, y2 - y1)
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
if not hwnd:
    print("WhatsApp window not found")
    sys.exit(1)

force_foreground(hwnd)
time.sleep(0.3)

rect = get_window_rect(hwnd)
if rect.left < 0 or rect.top < 0:
    new_left = max(0, rect.left)
    new_top = max(0, rect.top)
    w = rect.right - rect.left
    h = rect.bottom - rect.top
    user32.SetWindowPos(hwnd, 0, new_left, new_top, w, h, 0x0040)
    time.sleep(0.2)
    rect = get_window_rect(hwnd)

print(f"WhatsApp window rect: L={rect.left}, T={rect.top}, R={rect.right}, B={rect.bottom}")

# STEP 1: Search for Lokesh Upadhyay
print("Step 1: Searching for contact 'Lokesh Upadhyay'...")
hotkey(VK_CONTROL, VK_F)
time.sleep(0.15)
hotkey(VK_CONTROL, VK_A)
time.sleep(0.05)
tap_key(VK_BACK)
time.sleep(0.05)

set_clipboard_text("Lokesh Upadhyay")
hotkey(VK_CONTROL, VK_V)
time.sleep(0.8) # Wait for filter

# Click first chat in search results
# In left pane, first item is around x=rect.left + 160, y=rect.top + 225
first_item_x = rect.left + 160
first_item_y = rect.top + 225
print(f"Clicking first filtered chat item at ({first_item_x}, {first_item_y})...")
click_coords(first_item_x, first_item_y, delay=0.3)

# STEP 2: Focus Composer
composer_x = rect.right - 200
composer_y = rect.bottom - 50
print(f"Step 2: Focusing composer at ({composer_x}, {composer_y})...")
click_coords(composer_x, composer_y, delay=0.15)

# Clear previous text
hotkey(VK_CONTROL, VK_A)
time.sleep(0.05)
tap_key(VK_BACK)
time.sleep(0.05)

# STEP 3: Stage "hii then how are you doing"
test_msg = "hii then how are you doing"
print(f"Step 3: Staging message: '{test_msg}'...")
set_clipboard_text(test_msg)
hotkey(VK_CONTROL, VK_V)
time.sleep(0.3)

# Capture staged proof
im_staged = capture_rect(max(0, rect.left), rect.bottom - 75, rect.right, rect.bottom)
im_staged.save("D:/Jarvis/wa_flow_staged.png")
print("Saved staged proof to D:/Jarvis/wa_flow_staged.png")

# STEP 4: User Confirmation Simulation -> DISPATCH!
print("Step 4: Dispatching staged message...")
send_btn_x = rect.right - 56
send_btn_y = rect.bottom - 55

# Click composer to ensure focus
click_coords(composer_x, composer_y, delay=0.1)
# Click send button
click_coords(send_btn_x, send_btn_y, delay=0.1)
# Send Enter key
tap_key(VK_RETURN)
time.sleep(0.5)

# STEP 5: Verification
im_after = capture_rect(max(0, rect.left), rect.bottom - 75, rect.right, rect.bottom)
im_after.save("D:/Jarvis/wa_flow_after.png")
print("Saved after-dispatch proof to D:/Jarvis/wa_flow_after.png")

# Capture chat messages above composer to verify message appears in bubbles
im_chat = capture_rect(rect.left + 350, rect.bottom - 220, rect.right, rect.bottom - 75)
im_chat.save("D:/Jarvis/wa_flow_chat.png")
print("Saved chat history proof to D:/Jarvis/wa_flow_chat.png")
print("SUCCESS: Live WhatsApp test flow executed!")
