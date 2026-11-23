import ctypes
from ctypes import wintypes
import time
import os
from PIL import ImageGrab

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
shcore = ctypes.windll.shcore

try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    user32.SetProcessDPIAware()

h_default = user32.OpenDesktopW('Default', 0, False, 0x01FF)
user32.SetThreadDesktop(h_default)

class STARTUPINFO(ctypes.Structure):
    _fields_ = [
        ('cb', wintypes.DWORD), ('lpReserved', wintypes.LPWSTR), ('lpDesktop', wintypes.LPWSTR),
        ('lpTitle', wintypes.LPWSTR), ('dwX', wintypes.DWORD), ('dwY', wintypes.DWORD),
        ('dwXSize', wintypes.DWORD), ('dwYSize', wintypes.DWORD), ('dwXCountChars', wintypes.DWORD),
        ('dwYCountChars', wintypes.DWORD), ('dwFillAttribute', wintypes.DWORD), ('dwFlags', wintypes.DWORD),
        ('wShowWindow', wintypes.WORD), ('cbReserved2', wintypes.WORD), ('lpReserved2', ctypes.c_char_p),
        ('hStdInput', wintypes.HANDLE), ('hStdOutput', wintypes.HANDLE), ('hStdError', wintypes.HANDLE)
    ]

class PROCESS_INFORMATION(ctypes.Structure):
    _fields_ = [('hProcess', wintypes.HANDLE), ('hThread', wintypes.HANDLE), ('dwProcessId', wintypes.DWORD), ('dwThreadId', wintypes.DWORD)]

def get_current_hwnds():
    hwnds = set()
    def cb(hwnd, lp):
        if user32.IsWindowVisible(hwnd):
            hwnds.add(hwnd)
        return True
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)
    return hwnds

before_hwnds = get_current_hwnds()

# Launch VS Code with --new-window
vs_exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')
cmd = f'"{vs_exe}" --new-window'
print(f"Launching VS Code: {cmd}")

desk_buf = ctypes.create_unicode_buffer('WinSta0\\Default')
si = STARTUPINFO()
si.cb = ctypes.sizeof(STARTUPINFO)
si.lpDesktop = ctypes.cast(desk_buf, wintypes.LPWSTR)
si.dwFlags = 1
si.wShowWindow = 1
pi = PROCESS_INFORMATION()

res = kernel32.CreateProcessW(None, cmd, None, None, False, 0, None, None, ctypes.byref(si), ctypes.byref(pi))
print(f"CreateProcessW: {res}, PID: {pi.dwProcessId}")
kernel32.CloseHandle(pi.hThread)
kernel32.CloseHandle(pi.hProcess)

for i in range(10):
    time.sleep(1.0)
    after_hwnds = get_current_hwnds()
    new_hwnds = after_hwnds - before_hwnds
    print(f"Sec {i+1}: New visible HWNDs count = {len(new_hwnds)}")
    for h in new_hwnds:
        length = user32.GetWindowTextLengthW(h)
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(h, buff, length + 1)
        cbuff = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(h, cbuff, 256)
        p = wintypes.DWORD()
        user32.GetWindowThreadProcessId(h, ctypes.byref(p))
        rect = wintypes.RECT()
        user32.GetWindowRect(h, ctypes.byref(rect))
        print(f"  -> HWND {h}: Title='{buff.value}', Class='{cbuff.value}', PID={p.value}, Rect={(rect.left, rect.top, rect.right, rect.bottom)}")
        if 'Chrome_WidgetWin_1' in cbuff.value and (rect.right - rect.left) > 300:
            print("FOUND VS CODE WINDOW!")
            user32.SetForegroundWindow(h)
            time.sleep(0.5)
            shot_path = os.path.join(os.getcwd(), 'reports', 'evidence', 'evidence_launch_vscode.png')
            img = ImageGrab.grab((rect.left, rect.top, rect.right, rect.bottom))
            img.save(shot_path)
            print(f"Saved screenshot: {shot_path}")
            break
    if any('Chrome_WidgetWin_1' in cbuff.value for h in new_hwnds):
        break
