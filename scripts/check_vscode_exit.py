import ctypes
from ctypes import wintypes
import os

kernel32 = ctypes.windll.kernel32

vs_exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')
cmd = f'"{vs_exe}" --verbose'

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

desk_buf = ctypes.create_unicode_buffer('WinSta0\\Default')
si = STARTUPINFO()
si.cb = ctypes.sizeof(STARTUPINFO)
si.lpDesktop = ctypes.cast(desk_buf, wintypes.LPWSTR)
si.dwFlags = 1
si.wShowWindow = 1
pi = PROCESS_INFORMATION()

res = kernel32.CreateProcessW(None, cmd, None, None, False, 0, None, None, ctypes.byref(si), ctypes.byref(pi))
print(f"CreateProcessW: {res}, PID: {pi.dwProcessId}")

kernel32.WaitForSingleObject(pi.hProcess, 5000)
exit_code = wintypes.DWORD()
kernel32.GetExitCodeProcess(pi.hProcess, ctypes.byref(exit_code))
print(f"Exit code: {exit_code.value}")
kernel32.CloseHandle(pi.hThread)
kernel32.CloseHandle(pi.hProcess)
