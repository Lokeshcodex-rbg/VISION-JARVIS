import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
shcore = ctypes.windll.shcore

try: shcore.SetProcessDpiAwareness(2)
except: pass

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

def tap_key(vk):
    user32.keybd_event(vk, 0, 0, 0)
    time.sleep(0.05)
    user32.keybd_event(vk, 0, 2, 0)
    time.sleep(0.05)

def hotkey(*vks):
    for vk in vks:
        user32.keybd_event(vk, 0, 0, 0)
        time.sleep(0.03)
    time.sleep(0.05)
    for vk in reversed(vks):
        user32.keybd_event(vk, 0, 2, 0)
        time.sleep(0.03)
    time.sleep(0.05)

def click(x, y):
    user32.SetCursorPos(int(x), int(y))
    time.sleep(0.08)
    user32.mouse_event(0x0002, 0, 0, 0, 0)
    time.sleep(0.05)
    user32.mouse_event(0x0004, 0, 0, 0, 0)
    time.sleep(0.10)

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
print("WhatsApp HWND:", hwnd)
if not hwnd:
    print("WhatsApp not found!")
    exit(1)

# Ensure foreground
user32.ShowWindow(hwnd, 5) # SW_SHOW
user32.SetForegroundWindow(hwnd)
time.sleep(0.3)

# 1. Click Search box directly at (160, 142)
print("Clicking search box at (160, 142)...")
click(160, 142)
time.sleep(0.1)

# 2. Clear previous search
hotkey(0x11, 0x41) # Ctrl+A
tap_key(0x08) # Backspace
time.sleep(0.1)

# 3. Paste contact name
set_clip("Lokesh Upadhyay")
hotkey(0x11, 0x56) # Ctrl+V
print("Pasted contact name, waiting for filter...")
time.sleep(0.7)

# 4. Click first result at (160, 265)
print("Clicking first filtered chat row at (160, 265)...")
click(160, 265)
time.sleep(0.5)

# 5. Focus message composer at (800, 1030)
print("Clicking composer at (800, 1030)...")
click(800, 1030)
time.sleep(0.15)

# 6. Type "hii"
set_clip("hii")
hotkey(0x11, 0x56) # Ctrl+V
time.sleep(0.2)

# 7. Press Enter to SEND!
print("Pressing Enter to dispatch message...")
tap_key(0x0D)
time.sleep(0.5)

print("Dispatch complete!")

