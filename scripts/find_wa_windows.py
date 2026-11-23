import ctypes
from ctypes import wintypes
user32 = ctypes.windll.user32
shcore = ctypes.windll.shcore
try: shcore.SetProcessDpiAwareness(2)
except: pass

def enum_cb(hwnd, _):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        cbuff = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cbuff, 256)
        if 'whatsapp' in buff.value.lower() or 'whatsapp' in cbuff.value.lower():
            r = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(r))
            is_vis = user32.IsWindowVisible(hwnd)
            print(f"HWND {hwnd}: title='{buff.value}', class='{cbuff.value}', visible={is_vis}, rect=({r.left}, {r.top}, {r.right}, {r.bottom})")
    return True

winsta0 = user32.OpenWindowStationW('WinSta0', False, 0x037F)
if winsta0: user32.SetProcessWindowStation(winsta0)
h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
if not h_default:
    try: h_default = user32.OpenInputDesktop(0, False, 0x01FF)
    except: pass
if h_default: user32.SetThreadDesktop(h_default)

WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
user32.EnumDesktopWindows(h_default, WNDENUMPROC(enum_cb), 0)

