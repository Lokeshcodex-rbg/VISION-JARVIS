import ctypes
from ctypes import wintypes
import sys
import os

user32 = ctypes.windll.user32
shcore = ctypes.windll.shcore

try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    user32.SetProcessDPIAware()

h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
print(f"h_default handle: {h_default}")
if h_default:
    ok = user32.SetThreadDesktop(h_default)
    print(f"SetThreadDesktop: {ok}")

import uiautomation as auto

print("Searching for WhatsApp window via UIAutomation...")
wa_win = auto.WindowControl(searchDepth=2, ClassName='WinUIDesktopWin32WindowClass')
if not wa_win.Exists(3):
    wa_win = auto.WindowControl(searchDepth=2, SubName='WhatsApp')

if not wa_win.Exists(1):
    print("WhatsApp window not found via UIAutomation.")
    # Let's list top level windows on desktop
    def enum_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                cbuff = ctypes.create_unicode_buffer(256)
                user32.GetClassNameW(hwnd, cbuff, 256)
                if 'whatsapp' in buff.value.lower() or 'whatsapp' in cbuff.value.lower():
                    print(f"Win32 enum found WA window: hwnd={hwnd}, title='{buff.value}', class='{cbuff.value}'")
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(enum_cb), 0)
    sys.exit(1)

print(f"Found WhatsApp window: Name='{wa_win.Name}', Class='{wa_win.ClassName}', Handle={wa_win.NativeWindowHandle}")
rect = wa_win.BoundingRectangle
print(f"BoundingRectangle: {rect}")

# Check for dialogs or buttons inside
print("Inspecting children...")
for child, depth in auto.WalkControl(wa_win, maxDepth=4):
    ctrl_type = child.ControlTypeName
    name = child.Name
    if name or ctrl_type in ['ButtonControl', 'EditControl', 'ListItemControl', 'TextControl']:
        print(f"{'  '*depth} [{ctrl_type}] '{name}' ({child.BoundingRectangle})")

