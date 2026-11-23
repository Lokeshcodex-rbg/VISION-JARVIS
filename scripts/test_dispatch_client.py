import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
shcore = ctypes.windll.shcore
kernel32 = ctypes.windll.kernel32

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
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            if "whatsapp" in buff.value.lower():
                cls_buff = ctypes.create_unicode_buffer(256)
                user32.GetClassNameW(hwnd, cls_buff, 256)
                if cls_buff.value == "WinUIDesktopWin32WindowClass":
                    candidates.append(hwnd)
        return True
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_desk, WNDENUMPROC(enum_cb), 0)
    return candidates[0] if candidates else None

hwnd = find_wa()
print("Found WhatsApp HWND:", hwnd)

if hwnd:
    # Bring to foreground
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, 9)
    else:
        user32.ShowWindow(hwnd, 5)
    
    user32.SetForegroundWindow(hwnd)
    user32.SetActiveWindow(hwnd)
    time.sleep(0.3)
    
    client_rect = wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(client_rect))
    w = client_rect.right
    h = client_rect.bottom
    print(f"Client rect: {w}x{h}")
    
    # 1. Focus composer via ClientToScreen
    pt_comp = wintypes.POINT(int(w * 0.65), h - 35)
    user32.ClientToScreen(hwnd, ctypes.byref(pt_comp))
    print(f"Clicking composer at screen: ({pt_comp.x}, {pt_comp.y})")
    
    user32.SetCursorPos(pt_comp.x, pt_comp.y)
    time.sleep(0.05)
    user32.mouse_event(0x0002, 0, 0, 0, 0)
    time.sleep(0.04)
    user32.mouse_event(0x0004, 0, 0, 0, 0)
    time.sleep(0.1)
    
    # Send Enter key
    extra = ctypes.c_ulong(0)
    class KeyBdInput(ctypes.Structure):
        _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD), ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]
    class Input_I(ctypes.Union):
        _fields_ = [("ki", KeyBdInput)]
    class Input(ctypes.Structure):
        _fields_ = [("type", ctypes.c_ulong), ("ii", Input_I)]
        
    def tap_vk(vk):
        scan = user32.MapVirtualKeyW(vk, 0)
        ii1 = Input_I()
        ii1.ki = KeyBdInput(vk, scan, 0, 0, ctypes.pointer(extra))
        x1 = Input(1, ii1)
        user32.SendInput(1, ctypes.pointer(x1), ctypes.sizeof(x1))
        time.sleep(0.05)
        ii2 = Input_I()
        ii2.ki = KeyBdInput(vk, scan, 0x0002, 0, ctypes.pointer(extra))
        x2 = Input(1, ii2)
        user32.SendInput(1, ctypes.pointer(x2), ctypes.sizeof(x2))
        time.sleep(0.05)
        
    tap_vk(0x0D) # Enter
    time.sleep(0.15)
    
    # Also click Send button
    pt_send = wintypes.POINT(w - 40, h - 35)
    user32.ClientToScreen(hwnd, ctypes.byref(pt_send))
    print(f"Clicking send button at screen: ({pt_send.x}, {pt_send.y})")
    user32.SetCursorPos(pt_send.x, pt_send.y)
    time.sleep(0.05)
    user32.mouse_event(0x0002, 0, 0, 0, 0)
    time.sleep(0.04)
    user32.mouse_event(0x0004, 0, 0, 0, 0)
    time.sleep(0.1)
    
    tap_vk(0x0D) # Enter again
    print("Done dispatch!")

