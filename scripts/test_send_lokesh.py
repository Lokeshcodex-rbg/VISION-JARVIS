import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
shcore = ctypes.windll.shcore

try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    user32.SetProcessDPIAware()

winsta0 = user32.OpenWindowStationW("WinSta0", False, 0x037F)
if winsta0: user32.SetProcessWindowStation(winsta0)
h_desk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
if h_desk: user32.SetThreadDesktop(h_desk)

kernel32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
kernel32.GlobalAlloc.restype = wintypes.HGLOBAL
kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
kernel32.GlobalLock.restype = ctypes.c_void_p
kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
kernel32.GlobalUnlock.restype = wintypes.BOOL
user32.OpenClipboard.argtypes = [wintypes.HWND]
user32.OpenClipboard.restype = wintypes.BOOL
user32.EmptyClipboard.argtypes = []
user32.EmptyClipboard.restype = wintypes.BOOL
user32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
user32.SetClipboardData.restype = wintypes.HANDLE
user32.CloseClipboard.argtypes = []
user32.CloseClipboard.restype = wintypes.BOOL

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

PUL = ctypes.POINTER(ctypes.c_ulong)
class KeyBdInput(ctypes.Structure):
    _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD), ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD), ("dwExtraInfo", PUL)]
class HardwareInput(ctypes.Structure):
    _fields_ = [("uMsg", wintypes.DWORD), ("wParamL", wintypes.WORD), ("wParamH", wintypes.WORD)]
class MouseInput(ctypes.Structure):
    _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG), ("mouseData", wintypes.DWORD), ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD), ("dwExtraInfo", PUL)]
class Input_I(ctypes.Union):
    _fields_ = [("ki", KeyBdInput), ("mi", MouseInput), ("hi", HardwareInput)]
class Input(ctypes.Structure):
    _fields_ = [("type", ctypes.c_ulong), ("ii", Input_I)]

extra = ctypes.c_ulong(0)

def send_key(vk, is_up=False, use_scan=True):
    scan = user32.MapVirtualKeyW(vk, 0)
    flags = 0x0002 if is_up else 0
    if use_scan:
        flags |= 0x0008
    ii = Input_I()
    ii.ki = KeyBdInput(vk, scan, flags, 0, ctypes.pointer(extra))
    inp = Input(1, ii)
    user32.SendInput(1, ctypes.pointer(inp), ctypes.sizeof(inp))

def tap(vk, delay=0.06):
    send_key(vk, False, use_scan=False)
    time.sleep(delay)
    send_key(vk, True, use_scan=False)
    time.sleep(delay)

def hotkey(*vks):
    for vk in vks:
        send_key(vk, False, use_scan=False)
        time.sleep(0.02)
    time.sleep(0.05)
    for vk in reversed(vks):
        send_key(vk, True, use_scan=False)
        time.sleep(0.02)
    time.sleep(0.05)

def click(x, y):
    user32.SetCursorPos(int(x), int(y))
    time.sleep(0.06)
    user32.mouse_event(0x0002, 0, 0, 0, 0)
    time.sleep(0.04)
    user32.mouse_event(0x0004, 0, 0, 0, 0)
    time.sleep(0.08)

def set_clip(text):
    data = str(text).encode('utf-16le') + b'\x00\x00'
    h_mem = kernel32.GlobalAlloc(0x0002, len(data))
    if not h_mem: return False
    p_mem = kernel32.GlobalLock(h_mem)
    if not p_mem: return False
    ctypes.memmove(p_mem, data, len(data))
    kernel32.GlobalUnlock(h_mem)
    for _ in range(8):
        if user32.OpenClipboard(0):
            user32.EmptyClipboard()
            user32.SetClipboardData(13, h_mem)
            user32.CloseClipboard()
            return True
        time.sleep(0.04)
    return False

hwnd = find_wa()
print("WhatsApp HWND:", hwnd)
if not hwnd:
    print("WhatsApp not found!")
    exit(1)

# Bring to foreground
if user32.IsIconic(hwnd):
    user32.ShowWindow(hwnd, 9)
else:
    user32.ShowWindow(hwnd, 5)

user32.SetForegroundWindow(hwnd)
user32.SetActiveWindow(hwnd)
time.sleep(0.4)

client_rect = wintypes.RECT()
user32.GetClientRect(hwnd, ctypes.byref(client_rect))
w = client_rect.right
h = client_rect.bottom
print(f"WhatsApp Client: {w}x{h}")

# Step 1: Search for Lokesh Upadhyay
hotkey(0x11, 0x46) # Ctrl+F
time.sleep(0.2)

# Click search box
pt_search = wintypes.POINT(int(w * 0.15), 140)
user32.ClientToScreen(hwnd, ctypes.byref(pt_search))
click(pt_search.x, pt_search.y)
time.sleep(0.1)

# Clear search box
hotkey(0x11, 0x41) # Ctrl+A
tap(0x08) # Backspace
time.sleep(0.1)

# Paste "Lokesh Upadhyay"
set_clip("Lokesh Upadhyay")
hotkey(0x11, 0x56) # Ctrl+V
time.sleep(0.6)

# Press Down arrow to select first result, then Enter to open
tap(0x28) # Down
time.sleep(0.15)
tap(0x0D) # Enter
time.sleep(0.5)

# Step 2: In the opened chat, focus composer
pt_comp = wintypes.POINT(int(w * 0.60), h - 50)
user32.ClientToScreen(hwnd, ctypes.byref(pt_comp))
click(pt_comp.x, pt_comp.y)
time.sleep(0.1)

# Select all in composer and replace with "hii"
hotkey(0x11, 0x41) # Ctrl+A
tap(0x08) # Backspace
time.sleep(0.1)

set_clip("hii")
hotkey(0x11, 0x56) # Ctrl+V
time.sleep(0.2)

# Step 3: DISPATCH!
# 1. Tap Enter
tap(0x0D) # Enter key
time.sleep(0.2)

# 2. Click the green Send button
pt_send = wintypes.POINT(w - 48, h - 50)
user32.ClientToScreen(hwnd, ctypes.byref(pt_send))
print(f"Clicking send button at: ({pt_send.x}, {pt_send.y})")
click(pt_send.x, pt_send.y)
time.sleep(0.1)

# 3. Tap Enter again
tap(0x0D)
time.sleep(0.3)

print("Dispatch complete for Lokesh Upadhyay!")
