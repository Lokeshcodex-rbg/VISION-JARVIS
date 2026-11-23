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
    VK_RETURN, VK_CONTROL, VK_A, VK_V, VK_BACK
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
print("HWND:", hwnd)
if not hwnd:
    print("WhatsApp window not found")
    sys.exit(1)

force_foreground(hwnd)
time.sleep(0.3)

rect = get_window_rect(hwnd)
print(f"Current rect: L={rect.left}, T={rect.top}, R={rect.right}, B={rect.bottom}")

# If window is partly off-screen to the left, reposition to x=0
if rect.left < 0 or rect.top < 0:
    new_left = max(0, rect.left)
    new_top = max(0, rect.top)
    w = rect.right - rect.left
    h = rect.bottom - rect.top
    user32.SetWindowPos(hwnd, 0, new_left, new_top, w, h, 0x0040) # SWP_SHOWWINDOW
    time.sleep(0.2)
    rect = get_window_rect(hwnd)
    print(f"Repositioned rect: L={rect.left}, T={rect.top}, R={rect.right}, B={rect.bottom}")

w = rect.right - rect.left
h = rect.bottom - rect.top

# Focus the composer text box
# Composer capsule is vertically at rect.bottom - 48
# Horizontally, the chat pane is the right side of the window (between rect.left + 380 and rect.right)
chat_left = rect.left + 380 if w > 500 else rect.left + int(w * 0.45)
composer_x = int((chat_left + rect.right) / 2)
composer_y = rect.bottom - 48
send_btn_x = rect.right - 45
send_btn_y = rect.bottom - 48

print(f"Clicking composer at ({composer_x}, {composer_y})...")
click_coords(composer_x, composer_y, delay=0.15)

# Type test message
set_clipboard_text("hii testing live dispatch")
hotkey(VK_CONTROL, VK_V)
time.sleep(0.3)

# Capture composer area to see typed text & green send button
im_staged = capture_rect(max(0, rect.left), rect.bottom - 75, rect.right, rect.bottom)
im_staged.save("D:/Jarvis/wa_test_staged.png")
print("Saved staged composer screenshot")

# Check for green pixels near send button
im_btn = capture_rect(send_btn_x - 30, send_btn_y - 30, send_btn_x + 30, send_btn_y + 30)
green_count = 0
for px in im_btn.getdata():
    r, g, b = px[:3]
    if g > 120 and g > r * 1.3 and g > b * 1.2:
        green_count += 1
print(f"Green pixels in send button region: {green_count}")

# Now DISPATCH by clicking the send button or pressing Enter
print(f"Clicking send button at ({send_btn_x}, {send_btn_y})...")
click_coords(send_btn_x, send_btn_y, delay=0.15)
tap_key(VK_RETURN)
time.sleep(0.5)

# Capture composer area after dispatch
im_after = capture_rect(max(0, rect.left), rect.bottom - 75, rect.right, rect.bottom)
im_after.save("D:/Jarvis/wa_test_after_send.png")

# Verify green button is gone
im_btn_after = capture_rect(send_btn_x - 30, send_btn_y - 30, send_btn_x + 30, send_btn_y + 30)
green_count_after = 0
for px in im_btn_after.getdata():
    r, g, b = px[:3]
    if g > 120 and g > r * 1.3 and g > b * 1.2:
        green_count_after += 1
print(f"Green pixels after dispatch: {green_count_after}")

if green_count_after < 20:
    print("VERIFICATION: Message successfully DISPATCHED! (Send button cleared)")
else:
    print("VERIFICATION: Message still pending or send failed.")

