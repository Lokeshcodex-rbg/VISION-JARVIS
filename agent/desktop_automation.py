"""
VISION AI — Python Windows Desktop Automation Adapter
Provides low-level Windows window discovery, focus, keystroke automation,
and process lifecycle validation using Windows user32 and kernel32 APIs.
"""

import os
import sys
import time
import subprocess
import ctypes
from ctypes import wintypes


user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

SW_RESTORE = 9
SW_SHOW = 5


def list_windows() -> list:
    windows = []

    def enum_proc(hwnd, lParam):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value
                if title:
                    pid = wintypes.DWORD()
                    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                    windows.append({
                        "hwnd": hwnd,
                        "title": title,
                        "pid": pid.value
                    })
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(WNDENUMPROC(enum_proc), 0)
    return windows


def find_window_by_query(query: str) -> dict:
    if not query:
        return None
    q = query.lower().strip()
    wins = list_windows()
    for w in wins:
        if q in w["title"].lower():
            return w
    return None


def focus_window(query_or_hwnd) -> bool:
    hwnd = None
    if isinstance(query_or_hwnd, int):
        hwnd = query_or_hwnd
    elif isinstance(query_or_hwnd, str):
        w = find_window_by_query(query_or_hwnd)
        if w:
            hwnd = w["hwnd"]

    if not hwnd:
        return False

    try:
        user32.ShowWindow(hwnd, SW_RESTORE)
        user32.SetForegroundWindow(hwnd)
        user32.BringWindowToTop(hwnd)
        return True
    except Exception:
        return False


def type_into_window(query_or_hwnd: str, text: str) -> bool:
    if not focus_window(query_or_hwnd):
        return False

    time.sleep(0.2)

    # Use PowerShell SendKeys via WScript.Shell for reliable Unicode / special characters
    safe_text = text.replace("'", "''")
    ps_cmd = (
        f"$ws = New-Object -ComObject WScript.Shell; "
        f"[void]$ws.SendKeys('{safe_text}')"
    )
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            timeout=5
        )
        return True
    except Exception:
        return False


def is_process_running(pid_or_name) -> bool:
    if isinstance(pid_or_name, int):
        # OpenProcess with PROCESS_QUERY_LIMITED_INFORMATION (0x1000)
        h = kernel32.OpenProcess(0x1000, False, pid_or_name)
        if h:
            kernel32.CloseHandle(h)
            return True
        return False
    elif isinstance(pid_or_name, str):
        wins = list_windows()
        q = pid_or_name.lower().strip()
        for w in wins:
            if q in w["title"].lower():
                return True
        # Check tasklist fallback
        try:
            out = subprocess.run(
                ["tasklist", "/FI", f"IMAGENAME eq {pid_or_name}.exe"],
                capture_output=True,
                text=True,
                timeout=3
            ).stdout
            return pid_or_name.lower() in out.lower()
        except Exception:
            return False
    return False


def kill_process_tree(pid: int) -> bool:
    if not pid:
        return False
    try:
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(pid)],
            capture_output=True,
            timeout=3
        )
        return True
    except Exception:
        return False

