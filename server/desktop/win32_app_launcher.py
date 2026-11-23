"""
VISION AI — Win32 Interactive Desktop Application Launcher & Window Controller
Directly attaches to 'WinSta0\\Default' interactive user desktop session.
Eliminates session isolation, cleans Electron/VS Code environment pollution,
handles Office Safe Mode prompts, and verifies physical window creation.
"""

import sys
import os
import time
import json
import ctypes
from ctypes import wintypes
from PIL import ImageGrab

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
shcore = ctypes.windll.shcore

# 1. Enable Per-Monitor DPI Awareness (critical for accurate coordinates on scaled displays like 125%/150%)
try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass

# 2. Attach thread to interactive user desktop
DESKTOP_ALL = 0x01FF
h_default = user32.OpenDesktopW('Default', 0, False, DESKTOP_ALL)
if h_default:
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
    _fields_ = [
        ('hProcess', wintypes.HANDLE), ('hThread', wintypes.HANDLE),
        ('dwProcessId', wintypes.DWORD), ('dwThreadId', wintypes.DWORD)
    ]

CREATE_UNICODE_ENVIRONMENT = 0x00000400
SW_SHOWNORMAL = 1
SW_SHOW = 5
SW_RESTORE = 9
WM_CLOSE = 0x0010
VK_RETURN = 0x0D
KEYEVENTF_KEYUP = 0x0002

def get_clean_env_buffer():
    clean_env = os.environ.copy()
    for k in list(clean_env.keys()):
        if 'ELECTRON' in k or 'VSCODE' in k:
            del clean_env[k]
    env_str = ""
    for k, v in clean_env.items():
        env_str += f"{k}={v}\0"
    env_str += "\0"
    return ctypes.create_unicode_buffer(env_str)

def force_foreground(hwnd):
    """Restores a minimized window and reliably brings it to the foreground on WinSta0\\Default."""
    try:
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, SW_RESTORE)
        else:
            user32.ShowWindow(hwnd, SW_SHOW)

        fg_hwnd = user32.GetForegroundWindow()
        if fg_hwnd == hwnd:
            return True

        fg_tid = user32.GetWindowThreadProcessId(fg_hwnd, None) if fg_hwnd else 0
        target_tid = user32.GetWindowThreadProcessId(hwnd, None)
        cur_tid = kernel32.GetCurrentThreadId()

        if fg_tid and fg_tid != cur_tid:
            user32.AttachThreadInput(cur_tid, fg_tid, True)
        if target_tid and target_tid != cur_tid:
            user32.AttachThreadInput(cur_tid, target_tid, True)

        # Simulate brief Alt press/release to satisfy Windows foreground lock policy
        user32.keybd_event(0x12, 0, 0, 0)
        user32.keybd_event(0x12, 0, KEYEVENTF_KEYUP, 0)

        user32.BringWindowToTop(hwnd)
        user32.SetForegroundWindow(hwnd)

        if target_tid and target_tid != cur_tid:
            user32.AttachThreadInput(cur_tid, target_tid, False)
        if fg_tid and fg_tid != cur_tid:
            user32.AttachThreadInput(cur_tid, fg_tid, False)
        return True
    except Exception:
        return False

def get_process_name(pid):
    if not pid:
        return ""
    try:
        hProc = kernel32.OpenProcess(0x0400 | 0x0010, False, pid)
        if not hProc:
            return ""
        buff = ctypes.create_unicode_buffer(260)
        ctypes.windll.psapi.GetModuleBaseNameW(hProc, None, buff, 260)
        kernel32.CloseHandle(hProc)
        return buff.value.lower()
    except Exception:
        return ""

def find_desktop_windows(title_sub=None, class_name=None, proc_name=None, min_width=120, min_height=80):
    found = []
    def enum_cb(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        is_iconic = bool(user32.IsIconic(hwnd))
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        if not is_iconic and (w < min_width or h < min_height):
            return True

        length = user32.GetWindowTextLengthW(hwnd)
        title = ""
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value

        cbuff = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cbuff, 256)
        cname = cbuff.value

        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

        match = True
        if title_sub and title_sub.lower() not in title.lower():
            match = False
        if class_name and class_name.lower() != cname.lower():
            match = False
        if proc_name:
            actual_proc = get_process_name(pid.value)
            if proc_name.lower() not in actual_proc:
                match = False

        if match:
            found.append({
                'hwnd': hwnd,
                'title': title,
                'class': cname,
                'pid': pid.value,
                'proc': get_process_name(pid.value),
                'rect': [rect.left, rect.top, rect.right, rect.bottom],
                'width': w,
                'height': h
            })
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(enum_cb), 0)
    return found

def dismiss_safe_mode_dialogs():
    """Dismisses any Safe Mode or error prompt dialogs from Word/Excel/Office."""
    def cb(hwnd, lp):
        if user32.IsWindowVisible(hwnd):
            cbuff = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, cbuff, 256)
            if cbuff.value == '#32770':
                length = user32.GetWindowTextLengthW(hwnd)
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value.lower()
                if 'word' in title or 'excel' in title or 'office' in title:
                    user32.SetForegroundWindow(hwnd)
                    time.sleep(0.1)
                    user32.PostMessageW(hwnd, 0x0100, VK_RETURN, 0)
                    user32.PostMessageW(hwnd, 0x0101, VK_RETURN, 0)
        return True
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumDesktopWindows(h_default, WNDENUMPROC(cb), 0)

def resolve_app_window_criteria(app_name):
    clean_name = app_name.lower().strip()
    search_class = None
    search_title = None
    search_proc = None

    if clean_name in ['notepad', 'text editor']:
        search_class = "Notepad"
        search_title = "Notepad"
        search_proc = "notepad.exe"
    elif clean_name in ['explorer', 'file explorer', 'files']:
        search_class = "CabinetWClass"
        search_proc = "explorer.exe"
    elif clean_name in ['word', 'ms word', 'microsoft word', 'winword']:
        search_class = "OpusApp"
        search_proc = "winword.exe"
    elif clean_name in ['wps', 'wps writer', 'wps docs', 'wps office', 'kingsoft', 'kingsoft writer']:
        search_proc = "wps.exe"
        search_title = "WPS"
    elif clean_name in ['excel', 'ms excel', 'microsoft excel']:
        search_class = "XLMAIN"
        search_proc = "excel.exe"
    elif clean_name in ['vscode', 'code', 'vs code', 'visual studio code']:
        search_class = "Chrome_WidgetWin_1"
        search_title = "Visual Studio Code"
        search_proc = "code.exe"
    elif clean_name in ['whatsapp', 'whatsapp desktop']:
        search_class = "WinUIDesktopWin32WindowClass"
        search_title = "WhatsApp"
    elif clean_name in ['chrome', 'google chrome']:
        search_class = "Chrome_WidgetWin_1"
        search_title = "Google Chrome"
        search_proc = "chrome.exe"
    elif clean_name in ['calculator', 'calc']:
        search_title = "Calculator"

    return search_class, search_title, search_proc

def focus_app(app_name):
    """
    Instantly locates and activates an already-running application window in <10ms.
    Returns success: True with window metadata if found, or success: False if not running.
    """
    search_class, search_title, search_proc = resolve_app_window_criteria(app_name)
    windows = find_desktop_windows(title_sub=search_title, class_name=search_class, proc_name=search_proc)
    if search_title == "Visual Studio Code":
        windows = [w for w in windows if 'antigravity' not in w['title'].lower()]

    if windows:
        w = windows[0]
        hwnd = w['hwnd']
        force_foreground(hwnd)
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        return {
            "success": True,
            "verified": True,
            "action": "already_running",
            "reusedExisting": True,
            "appName": app_name,
            "pid": w['pid'],
            "hwnd": hwnd,
            "windowTitle": w['title'],
            "className": w['class'],
            "rect": [rect.left, rect.top, rect.right, rect.bottom],
            "instanceCount": len(windows),
            "summary": f"{app_name} is already active on your interactive desktop. Brought to foreground (PID {w['pid']}, HWND {hwnd})."
        }
    return {
        "success": False,
        "action": "not_running",
        "appName": app_name,
        "summary": f"{app_name} is not currently running on the desktop."
    }

def _find_wps_executable():
    import glob
    local_app = os.environ.get('LOCALAPPDATA') or os.path.expanduser(r'~\AppData\Local')
    pattern = os.path.join(local_app, 'kingsoft', 'WPS Office', '*', 'office6', 'wps.exe')
    matches = sorted(glob.glob(pattern), reverse=True)
    if matches:
        return matches[0]
    fallback = r"C:\Program Files (x86)\Kingsoft\WPS Office\ksolaunch.exe"
    return fallback if os.path.exists(fallback) else None


def launch_app(app_name, custom_cmd=None, target_file=None, take_screenshot=False, force_new=False, extra_args=None, exec_path=None, aumid=None):
    t0 = time.time()
    clean_name = app_name.lower().strip()

    # 1. Fast Session Reuse: If window is already open and force_new is False, reuse it!
    if not force_new and not custom_cmd and not extra_args:
        if not target_file:
            existing = focus_app(app_name)
            if existing["success"]:
                existing["durationMs"] = round((time.time() - t0) * 1000, 1)
                return existing
        elif clean_name in ['notepad', 'text editor']:
            # Check if Notepad is already open
            np_windows = find_desktop_windows(class_name="Notepad")
            target_base = os.path.basename(target_file).lower()
            for w in np_windows:
                if target_base in (w.get('title') or '').lower():
                    force_foreground(w['hwnd'])
                    return {
                        "success": True,
                        "verified": True,
                        "action": "already_running",
                        "reusedExisting": True,
                        "appName": app_name,
                        "pid": w['pid'],
                        "hwnd": w['hwnd'],
                        "windowTitle": w['title'],
                        "className": w['class'],
                        "rect": w['rect'],
                        "durationMs": round((time.time() - t0) * 1000, 1),
                        "summary": f"Reused existing Notepad window for {os.path.basename(target_file)} (PID {w['pid']}, HWND {w['hwnd']})."
                    }
            # Close any excess untitled/previous managed Notepad windows so we never accumulate multiple Notepad windows
            for w in np_windows:
                try:
                    user32.PostMessageW(w['hwnd'], 0x0010, 0, 0)  # WM_CLOSE
                except Exception:
                    pass
                time.sleep(0.05)

    desk_buf = ctypes.create_unicode_buffer('WinSta0\\Default')
    si = STARTUPINFO()
    si.cb = ctypes.sizeof(STARTUPINFO)
    si.lpDesktop = ctypes.cast(desk_buf, wintypes.LPWSTR)
    si.dwFlags = 1
    si.wShowWindow = SW_SHOWNORMAL
    pi = PROCESS_INFORMATION()

    env_buf = get_clean_env_buffer()

    cmd = None
    search_class, search_title, search_proc = resolve_app_window_criteria(app_name)

    if custom_cmd:
        cmd = custom_cmd
    elif clean_name in ['notepad', 'text editor']:
        cmd = r"C:\Windows\System32\notepad.exe"
        if target_file:
            cmd += f' "{target_file}"'
        search_class = "Notepad"
    elif clean_name in ['explorer', 'file explorer', 'files']:
        target_dir = target_file if target_file else r"d:\Jarvis"
        cmd = f'C:\\Windows\\explorer.exe "{target_dir}"'
        search_class = "CabinetWClass"
    elif clean_name in ['word', 'ms word', 'microsoft word', 'winword']:
        word_exe = r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE"
        if not os.path.exists(word_exe):
            word_exe = r"C:\Program Files (x86)\Microsoft Office\root\Office16\WINWORD.EXE"
        if not os.path.exists(word_exe):
            return {
                "success": False,
                "verified": False,
                "action": "word_not_installed",
                "appName": app_name,
                "error": "Microsoft Word (WINWORD.EXE) is not installed at standard Office paths.",
                "summary": "Microsoft Word is not installed or could not be located on this machine."
            }
        cmd = f'"{word_exe}" /w'
        if target_file:
            cmd = f'"{word_exe}" "{target_file}"'
        search_class = "OpusApp"
        search_proc = "winword.exe"
    elif clean_name in ['wps', 'wps writer', 'wps docs', 'wps office', 'kingsoft', 'kingsoft writer']:
        wps_exe = exec_path if (exec_path and os.path.exists(exec_path)) else _find_wps_executable()
        if wps_exe and os.path.exists(wps_exe):
            cmd = f'"{wps_exe}"'
            if target_file:
                cmd += f' "{target_file}"'
        else:
            cmd = r'C:\Windows\explorer.exe shell:AppsFolder\Kingsoft.Office.WPS'
        search_proc = "wps.exe"
        search_title = os.path.splitext(os.path.basename(target_file))[0] if target_file else None
    elif clean_name in ['excel', 'ms excel', 'microsoft excel']:
        excel_exe = r"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE"
        if not os.path.exists(excel_exe):
            excel_exe = r"C:\Program Files (x86)\Microsoft Office\root\Office16\EXCEL.EXE"
        cmd = f'"{excel_exe}" /e'
        if target_file:
            cmd = f'"{excel_exe}" "{target_file}"'
        search_class = "XLMAIN"
    elif clean_name in ['vscode', 'code', 'vs code', 'visual studio code']:
        vs_exe = os.path.expanduser(r'~\AppData\Local\Programs\Microsoft VS Code\Code.exe')
        data_dir = os.path.expanduser(r'~\.vscode-standalone')
        target_path = f'"{target_file}"' if target_file else r'"d:\Jarvis"'
        cmd = f'"{vs_exe}" --user-data-dir "{data_dir}" --new-window {target_path}'
        search_class = "Chrome_WidgetWin_1"
        search_title = "Visual Studio Code"
    elif clean_name in ['whatsapp', 'whatsapp desktop']:
        cmd = r'C:\Windows\explorer.exe shell:AppsFolder\5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App'
        search_class = "WinUIDesktopWin32WindowClass"
        search_title = "WhatsApp"
    elif clean_name in ['chrome', 'google chrome']:
        chrome_candidates = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe")
        ]
        chrome_exe = next((p for p in chrome_candidates if os.path.exists(p)), chrome_candidates[0])
        if not os.path.exists(chrome_exe):
            return {
                "success": False,
                "verified": False,
                "action": "chrome_not_installed",
                "appName": app_name,
                "error": "Google Chrome executable not found.",
                "summary": "Google Chrome could not be located on this Windows system."
            }
        cmd = f'"{chrome_exe}"'
        if extra_args:
            cmd += f' {extra_args}'
        search_class = "Chrome_WidgetWin_1"
        search_title = "Chrome"
        search_proc = "chrome.exe"
    elif clean_name in ['calculator', 'calc']:
        cmd = r"C:\Windows\System32\calc.exe"
        search_title = "Calculator"
    elif exec_path and os.path.exists(exec_path):
        if exec_path.lower().endswith('.lnk'):
            cmd = f'C:\\Windows\\System32\\cmd.exe /c start "" "{exec_path}"'
        else:
            cmd = f'"{exec_path}"'
            if target_file:
                cmd += f' "{target_file}"'
            search_proc = os.path.basename(exec_path).lower()
    elif aumid:
        cmd = f'C:\\Windows\\explorer.exe shell:AppsFolder\\{aumid}'
        search_title = app_name
    else:
        cmd = app_name

    res = kernel32.CreateProcessW(
        None,
        cmd,
        None,
        None,
        False,
        CREATE_UNICODE_ENVIRONMENT,
        ctypes.byref(env_buf),
        None,
        ctypes.byref(si),
        ctypes.byref(pi)
    )

    if not res:
        err = kernel32.GetLastError()
        return {
            "success": False,
            "error": f"CreateProcessW failed with error code {err}",
            "command": cmd
        }

    spawned_pid = pi.dwProcessId
    kernel32.CloseHandle(pi.hThread)
    kernel32.CloseHandle(pi.hProcess)

    # State-based rapid polling on WinSta0\Default (every 60ms up to 8.0s for Office/WPS/WhatsApp apps, 6.0s otherwise)
    max_wait = 8.0 if clean_name in ['word', 'ms word', 'microsoft word', 'winword', 'wps', 'wps writer', 'wps docs', 'wps office', 'excel', 'ms excel', 'microsoft excel', 'whatsapp', 'whatsapp desktop'] else 6.0
    target_stem = os.path.splitext(os.path.basename(target_file))[0].lower() if target_file else None
    start_t = time.time()
    verified_window = None
    wa_zombie_recycled = False

    while (time.time() - start_t) < max_wait:
        time.sleep(0.06)
        dismiss_safe_mode_dialogs()

        windows = find_desktop_windows(title_sub=search_title, class_name=search_class, proc_name=search_proc)
        if not windows and search_title and search_proc:
            windows = find_desktop_windows(proc_name=search_proc)
        if not windows and clean_name in ['whatsapp', 'whatsapp desktop'] and not wa_zombie_recycled and (time.time() - start_t) >= 3.0:
            wa_zombie_recycled = True
            try:
                import subprocess as _sp
                tl = _sp.check_output(['tasklist', '/NH', '/FI', 'IMAGENAME eq WhatsApp*'], text=True, timeout=3, stderr=_sp.DEVNULL).lower()
                if 'whatsapp.root.exe' in tl or 'whatsapp.exe' in tl:
                    _sp.run(['taskkill', '/IM', 'WhatsApp.Root.exe', '/F', '/T'], timeout=3, check=False, stdout=_sp.DEVNULL, stderr=_sp.DEVNULL)
                    _sp.run(['taskkill', '/IM', 'WhatsApp.exe', '/F', '/T'], timeout=3, check=False, stdout=_sp.DEVNULL, stderr=_sp.DEVNULL)
                    time.sleep(0.5)
                    _sp.Popen(['explorer.exe', r'shell:AppsFolder\5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App'])
            except Exception:
                pass
        if windows:
            if search_title == "Visual Studio Code":
                windows = [w for w in windows if 'antigravity' not in w['title'].lower()]
            if target_stem and clean_name in ['word', 'ms word', 'microsoft word', 'winword', 'wps', 'wps writer', 'wps docs', 'wps office']:
                matching = [w for w in windows if target_stem in (w.get('title') or '').lower()]
                if matching:
                    verified_window = matching[0]
                    break
                # Wait up to 4.5s for the specific document title to appear before accepting any Word/WPS window
                if (time.time() - start_t) < 4.5:
                    continue
            if windows:
                verified_window = windows[0]
                break

    duration_ms = round((time.time() - t0) * 1000, 1)

    if verified_window:
        hwnd = verified_window['hwnd']
        force_foreground(hwnd)
        time.sleep(0.06)

        evidence_file = None
        if take_screenshot:
            evidence_dir = os.path.join(os.getcwd(), 'reports', 'evidence')
            os.makedirs(evidence_dir, exist_ok=True)
            shot_path = os.path.join(evidence_dir, f"evidence_launch_{clean_name.replace(' ', '_')}.png")
            try:
                rect = verified_window['rect']
                img = ImageGrab.grab((rect[0], rect[1], rect[2], rect[3]))
                img.save(shot_path)
                evidence_file = shot_path
            except Exception:
                evidence_file = None

        return {
            "success": True,
            "verified": True,
            "action": "launched",
            "reusedExisting": False,
            "appName": app_name,
            "pid": verified_window['pid'] or spawned_pid,
            "hwnd": hwnd,
            "windowTitle": verified_window['title'],
            "className": verified_window['class'],
            "rect": verified_window['rect'],
            "evidenceScreenshot": evidence_file,
            "durationMs": duration_ms,
            "summary": f"Successfully launched {app_name} on your interactive desktop in {duration_ms}ms (PID {verified_window['pid']}, HWND {hwnd})."
        }
    else:
        return {
            "success": True,
            "verified": False,
            "action": "dispatched",
            "reusedExisting": False,
            "appName": app_name,
            "pid": spawned_pid,
            "durationMs": duration_ms,
            "summary": f"Dispatched {app_name} launch onto WinSta0\\Default in {duration_ms}ms (PID {spawned_pid}). Window is initializing."
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python win32_app_launcher.py <app_name> [target_file_or_cmd] | focus <app_name> | list"}))
        sys.exit(1)

    mode_or_app = sys.argv[1].lower().strip()
    def _extract_flag(flag):
        if flag in sys.argv:
            try:
                idx = sys.argv.index(flag)
                if idx + 1 < len(sys.argv):
                    return sys.argv[idx + 1]
            except Exception:
                return None
        return None

    extra_args = _extract_flag('--args')
    exec_path_arg = _extract_flag('--exec')
    aumid_arg = _extract_flag('--aumid')

    def _first_positional(start_idx):
        skip_next = False
        for a in sys.argv[start_idx:]:
            if skip_next:
                skip_next = False
                continue
            if a in ('--args', '--exec', '--aumid'):
                skip_next = True
                continue
            if not a.startswith('--'):
                return a
        return None

    if mode_or_app in ('list', 'list_windows'):
        fg = user32.GetForegroundWindow()
        wins = find_desktop_windows(min_width=150, min_height=100)
        wins = [w for w in wins if (w.get('title') or '').strip()]
        for w in wins:
            w['isForeground'] = (w['hwnd'] == fg)
        result = {"success": True, "count": len(wins), "foregroundHwnd": fg, "windows": wins}
    elif mode_or_app == 'focus' and len(sys.argv) > 2:
        target_app = sys.argv[2]
        result = focus_app(target_app)
    elif mode_or_app == 'focus_hwnd' and len(sys.argv) > 2:
        try:
            target_hwnd = int(sys.argv[2])
        except Exception:
            target_hwnd = 0
        wins = [w for w in find_desktop_windows(min_width=100, min_height=60) if w['hwnd'] == target_hwnd]
        if wins:
            w = wins[0]
            force_foreground(target_hwnd)
            result = {
                "success": True,
                "verified": True,
                "action": "already_running",
                "reusedExisting": True,
                "hwnd": target_hwnd,
                "pid": w['pid'],
                "windowTitle": w['title'],
                "proc": w['proc'],
                "rect": w['rect']
            }
        else:
            result = {"success": False, "verified": False, "action": "not_found", "hwnd": target_hwnd}
    elif mode_or_app == 'count' and len(sys.argv) > 2:
        target_app = sys.argv[2]
        s_class, s_title, s_proc = resolve_app_window_criteria(target_app)
        wins = find_desktop_windows(title_sub=s_title, class_name=s_class, proc_name=s_proc)
        result = {"success": True, "appName": target_app, "count": len(wins), "windows": wins}
    elif mode_or_app == 'launch' and len(sys.argv) > 2:
        target_app = sys.argv[2]
        take_shot = '--screenshot' in sys.argv
        force_new = '--force-new' in sys.argv
        arg3 = _first_positional(3)
        target_file = None
        cmd_override = None
        if arg3:
            if os.path.exists(arg3) or os.path.splitext(arg3)[1].lower() in ['.txt', '.md', '.docx', '.doc', '.xlsx', '.csv', '.pdf', '.json', '.js', '.py']:
                target_file = arg3
            else:
                cmd_override = arg3
        result = launch_app(target_app, custom_cmd=cmd_override, target_file=target_file, take_screenshot=take_shot, force_new=force_new, extra_args=extra_args, exec_path=exec_path_arg, aumid=aumid_arg)
    else:
        target_app = sys.argv[1]
        take_shot = '--screenshot' in sys.argv
        force_new = '--force-new' in sys.argv
        arg2 = _first_positional(2)
        target_file = None
        cmd_override = None
        if arg2:
            if os.path.exists(arg2) or os.path.splitext(arg2)[1].lower() in ['.txt', '.md', '.docx', '.doc', '.xlsx', '.csv', '.pdf', '.json', '.js', '.py']:
                target_file = arg2
            else:
                cmd_override = arg2
        result = launch_app(target_app, custom_cmd=cmd_override, target_file=target_file, take_screenshot=take_shot, force_new=force_new, extra_args=extra_args, exec_path=exec_path_arg, aumid=aumid_arg)

    print(json.dumps(result))
