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

def tap(vk):
    user32.keybd_event(vk, 0, 0, 0)
    time.sleep(0.04)
    user32.keybd_event(vk, 0, 2, 0)
    time.sleep(0.04)

def hotkey(*vks):
    for vk in vks:
        user32.keybd_event(vk, 0, 0, 0)
        time.sleep(0.03)
    time.sleep(0.05)
    for vk in reversed(vks):
        user32.keybd_event(vk, 0, 2, 0)
        time.sleep(0.03)
    time.sleep(0.05)

hwnd = 526618
user32.ShowWindow(hwnd, 5)
user32.SetForegroundWindow(hwnd)
time.sleep(0.3)

# 1. Ctrl+F to ensure search focus
hotkey(0x11, 0x46)
time.sleep(0.15)

# 2. Select all and backspace in search box
hotkey(0x11, 0x41)
tap(0x08)
time.sleep(0.1)

# 3. Paste "Lokesh Upadhyay"
set_clip("Lokesh Upadhyay")
hotkey(0x11, 0x56)
print("Pasted 'Lokesh Upadhyay' into search box, waiting 0.8s for filter...")
time.sleep(0.8)

# 4. Tap Down arrow to select first matching contact, then Enter to open
tap(0x28) # Down arrow
time.sleep(0.2)
tap(0x0D) # Enter to open chat
print("Opened chat with Lokesh Upadhyay!")
time.sleep(0.6)

# 5. Type and send "hii"
set_clip("hii")
hotkey(0x11, 0x56)
time.sleep(0.25)

# Tap Enter to SEND!
print("Pressing Enter to SEND...")
tap(0x0D)
time.sleep(0.5)

print("Finished send operation!")

