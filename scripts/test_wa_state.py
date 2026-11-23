import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
shcore = ctypes.windll.shcore
try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    user32.SetProcessDPIAware()

winsta0 = user32.OpenWindowStationW("WinSta0", False, 0x037F)
if winsta0:
    user32.SetProcessWindowStation(winsta0)

h_desk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
if h_desk:
    user32.SetThreadDesktop(h_desk)

def find_wa():
    candidates = []
    def enum_cb(hwnd, lparam):
        length = user32.GetWindowTextLengthW(hwnd)
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        class_buff = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, class_buff, 256)
        if "whatsapp" in buff.value.lower() and class_buff.value == "WinUIDesktopWin32WindowClass":
            candidates.append(hwnd)
        return True
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_desk, WNDENUMPROC(enum_cb), 0)
    return candidates[0] if candidates else None

hwnd = find_wa()
print("WhatsApp HWND:", hwnd)
if hwnd:
    # Bring to foreground without un-snapping!
    # SW_SHOW (5) instead of SW_RESTORE (9) prevents un-snapping snapped windows!
    user32.ShowWindow(hwnd, 5) # SW_SHOW
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.2)
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    print(f"WhatsApp Rect: left={rect.left}, top={rect.top}, right={rect.right}, bottom={rect.bottom}, width={rect.right-rect.left}, height={rect.bottom-rect.top}")

