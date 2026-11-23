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

def launch_word():
    desk_buf = ctypes.create_unicode_buffer('WinSta0\\Default')
    si = STARTUPINFO()
    si.cb = ctypes.sizeof(STARTUPINFO)
    si.lpDesktop = ctypes.cast(desk_buf, wintypes.LPWSTR)
    si.dwFlags = 1
    si.wShowWindow = 1
    pi = PROCESS_INFORMATION()

    word_exe = r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE"
    cmd = f'"{word_exe}"'
    print(f"Launching Word: {cmd}")

    res = kernel32.CreateProcessW(None, cmd, None, None, False, 0, None, None, ctypes.byref(si), ctypes.byref(pi))
    print(f"CreateProcessW: {res}, PID: {pi.dwProcessId}")
    kernel32.CloseHandle(pi.hThread)
    kernel32.CloseHandle(pi.hProcess)

    VK_RETURN = 0x0D
    for i in range(12):
        time.sleep(1.0)
        # Check if dialog or OpusApp window exists
        found_dialog = None
        found_word = None
        def cb(hwnd, lp):
            nonlocal found_dialog, found_word
            if user32.IsWindowVisible(hwnd):
                cbuff = ctypes.create_unicode_buffer(256)
                user32.GetClassNameW(hwnd, cbuff, 256)
                length = user32.GetWindowTextLengthW(hwnd)
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value
                cname = cbuff.value
                if cname == '#32770' and 'Word' in title:
                    found_dialog = hwnd
                elif cname == 'OpusApp':
                    found_word = hwnd
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
        user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)

        if found_dialog:
            print(f"Found Word startup dialog HWND {found_dialog}. Dismissing by sending Enter...")
            user32.SetForegroundWindow(found_dialog)
            time.sleep(0.2)
            user32.PostMessageW(found_dialog, 0x0100, VK_RETURN, 0)
            user32.PostMessageW(found_dialog, 0x0101, VK_RETURN, 0)

        if found_word:
            print(f"FOUND WORD MAIN WINDOW HWND {found_word}!")
            rect = wintypes.RECT()
            user32.GetWindowRect(found_word, ctypes.byref(rect))
            user32.ShowWindow(found_word, 9)
            user32.SetForegroundWindow(found_word)
            time.sleep(0.5)
            shot_path = os.path.join(os.getcwd(), 'reports', 'evidence', 'evidence_launch_microsoft_word.png')
            img = ImageGrab.grab((rect.left, rect.top, rect.right, rect.bottom))
            img.save(shot_path)
            print(f"Captured screenshot evidence: {shot_path} ({img.size})")
            return True
        else:
            print(f"Sec {i+1}: Waiting for Word...")

    return False

launch_word()
