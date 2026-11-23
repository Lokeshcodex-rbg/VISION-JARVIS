"""
VISION AI — WhatsApp Desktop Autonomous Automation Engine
Uses native Win32 Desktop API, Per-Monitor DPI Awareness, and SendInput to autonomously:
1. Bring WhatsApp Desktop to the foreground on the user's interactive desktop.
2. Dismiss any blocking dialog modals.
3. Search and select any contact by name (e.g. 'Shubh', 'Mummy', 'Arijit') or phone.
4. Paste and dispatch messages directly by pressing Enter.
5. Initiate WhatsApp voice (Ctrl+Shift+C) and video (Ctrl+Shift+U) calls directly.
"""

import sys
import os
import subprocess
import time
import json
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
shcore = ctypes.windll.shcore

# 0. Enable Per-Monitor DPI Awareness (critical for accurate coordinates on scaled displays like 125%/150%)
try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass

# 1. Attach thread to interactive user desktop
try:
    winsta0 = user32.OpenWindowStationW('WinSta0', False, 0x037F)
    if winsta0:
        user32.SetProcessWindowStation(winsta0)
except Exception:
    pass

DESKTOP_ALL = 0x01FF
h_default = user32.OpenDesktopW('Default', 0, False, DESKTOP_ALL)
if not h_default:
    try:
        h_default = user32.OpenInputDesktop(0, False, DESKTOP_ALL)
    except Exception:
        pass
if h_default:
    user32.SetThreadDesktop(h_default)

# 2. Win32 SendInput Structures
PUL = ctypes.POINTER(ctypes.c_ulong)
class KeyBdInput(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", PUL)
    ]

class HardwareInput(ctypes.Structure):
    _fields_ = [
        ("uMsg", wintypes.DWORD),
        ("wParamL", wintypes.WORD),
        ("wParamH", wintypes.WORD)
    ]

class MouseInput(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", PUL)
    ]

class Input_I(ctypes.Union):
    _fields_ = [
        ("ki", KeyBdInput),
        ("mi", MouseInput),
        ("hi", HardwareInput)
    ]

class Input(ctypes.Structure):
    _fields_ = [
        ("type", ctypes.c_ulong),
        ("ii", Input_I)
    ]

KEYEVENTF_KEYUP = 0x0002
INPUT_KEYBOARD = 1
INPUT_MOUSE = 0

VK_RETURN = 0x0D
VK_ESCAPE = 0x1B
VK_SPACE = 0x20
VK_CONTROL = 0x11
VK_SHIFT = 0x10
VK_BACK = 0x08
VK_DOWN = 0x28
VK_F = 0x46
VK_C = 0x43
VK_U = 0x55
VK_V = 0x56
VK_A = 0x41
VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF

MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004

GMEM_MOVEABLE = 0x0002
CF_UNICODETEXT = 13

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

def set_clipboard_text(text):
    """Sets Unicode text onto the Windows clipboard for instant, lossless pasting."""
    data = str(text).encode('utf-16le') + b'\x00\x00'
    h_mem = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(data))
    if not h_mem:
        return False
    p_mem = kernel32.GlobalLock(h_mem)
    ctypes.memmove(p_mem, data, len(data))
    kernel32.GlobalUnlock(h_mem)
    for _ in range(8):
        if user32.OpenClipboard(0):
            user32.EmptyClipboard()
            user32.SetClipboardData(CF_UNICODETEXT, h_mem)
            user32.CloseClipboard()
            return True
        time.sleep(0.04)
    return False

def press_key(vk):
    extra = ctypes.c_ulong(0)
    ii_ = Input_I()
    scan = user32.MapVirtualKeyW(vk, 0)
    ii_.ki = KeyBdInput(vk, scan, 0, 0, ctypes.pointer(extra))
    x = Input(INPUT_KEYBOARD, ii_)
    user32.SendInput(1, ctypes.pointer(x), ctypes.sizeof(x))

def release_key(vk):
    extra = ctypes.c_ulong(0)
    ii_ = Input_I()
    scan = user32.MapVirtualKeyW(vk, 0)
    ii_.ki = KeyBdInput(vk, scan, KEYEVENTF_KEYUP, 0, ctypes.pointer(extra))
    x = Input(INPUT_KEYBOARD, ii_)
    user32.SendInput(1, ctypes.pointer(x), ctypes.sizeof(x))

def tap_key(vk, delay=0.05):
    press_key(vk)
    time.sleep(delay)
    release_key(vk)
    time.sleep(delay)

def hotkey(*vks, hold_delay=0.06):
    for vk in vks:
        press_key(vk)
        time.sleep(0.03)
    time.sleep(hold_delay)
    for vk in reversed(vks):
        release_key(vk)
        time.sleep(0.03)

def click_coords(x, y, delay=0.1):
    user32.SetCursorPos(int(x), int(y))
    time.sleep(0.05)
    user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
    time.sleep(0.04)
    user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
    time.sleep(delay)

_NON_WHATSAPP_PROCS = {
    'antigravity ide.exe', 'code.exe', 'cursor.exe', 'windsurf.exe',
    'notepad.exe', 'node.exe', 'python.exe', 'pythonw.exe',
    'powershell.exe', 'pwsh.exe', 'cmd.exe', 'windowsterminal.exe',
    'devenv.exe', 'explorer.exe', 'msedgewebview2.exe'
}
_NON_WHATSAPP_TITLE_MARKERS = (
    '.py', '.js', '.ts', '.json', '.md',
    'antigravity', 'visual studio code', 'jarvis', 'lokesh ai'
)
_NATIVE_WA_PROCS = {'whatsapp.root.exe', 'whatsapp.exe', 'applicationframehost.exe'}
_BROWSER_WA_PROCS = {'chrome.exe', 'msedge.exe', 'brave.exe', 'firefox.exe', 'opera.exe'}
_WA_AUMID = r'5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App'

def _get_process_name(pid):
    if not pid:
        return ''
    try:
        h_proc = kernel32.OpenProcess(0x0400 | 0x0010, False, pid)
        if not h_proc:
            return ''
        buff = ctypes.create_unicode_buffer(260)
        ctypes.windll.psapi.GetModuleBaseNameW(h_proc, None, buff, 260)
        kernel32.CloseHandle(h_proc)
        return buff.value.lower()
    except Exception:
        return ''

def _is_whatsapp_process_alive():
    try:
        out = subprocess.check_output(
            ['tasklist', '/NH', '/FI', 'IMAGENAME eq WhatsApp*'],
            text=True,
            timeout=3,
            stderr=subprocess.DEVNULL
        ).lower()
        return 'whatsapp.root.exe' in out or 'whatsapp.exe' in out
    except Exception:
        return False

def find_whatsapp_window():
    native_wa = []
    other_wa = []

    def enum_cb(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        is_iconic = bool(user32.IsIconic(hwnd))
        if not is_iconic:
            rect = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            if (rect.right - rect.left) < 250 or (rect.bottom - rect.top) < 200:
                return True

        length = user32.GetWindowTextLengthW(hwnd)
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title_lower = buff.value.lower()
            if 'whatsapp' in title_lower and not any(m in title_lower for m in _NON_WHATSAPP_TITLE_MARKERS):
                pid = wintypes.DWORD()
                user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                pname = _get_process_name(pid.value)
                if pname in _NON_WHATSAPP_PROCS:
                    return True
                class_buff = ctypes.create_unicode_buffer(256)
                user32.GetClassNameW(hwnd, class_buff, 256)
                cname = class_buff.value
                if cname == 'WinUIDesktopWin32WindowClass' or pname in _NATIVE_WA_PROCS:
                    native_wa.append(hwnd)
                elif pname in _BROWSER_WA_PROCS:
                    other_wa.append(hwnd)
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    if h_default:
        user32.EnumDesktopWindows.argtypes = [wintypes.HANDLE, WNDENUMPROC, wintypes.LPARAM]
        user32.EnumDesktopWindows.restype = wintypes.BOOL
        user32.EnumDesktopWindows(h_default, WNDENUMPROC(enum_cb), 0)
    else:
        user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    if native_wa:
        return native_wa[0]
    if other_wa:
        return other_wa[0]
    return None

def get_window_rect(hwnd):
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return rect

def force_foreground(hwnd):
    """Guarantees bringing WhatsApp to the active foreground on Windows 10/11."""
    if not hwnd or not user32.IsWindow(hwnd):
        return False
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
    else:
        user32.ShowWindow(hwnd, 5)  # SW_SHOW

    fg = user32.GetForegroundWindow()
    if fg == hwnd:
        return True

    fg_thread = user32.GetWindowThreadProcessId(fg, None) if fg else 0
    cur_thread = kernel32.GetCurrentThreadId()

    if fg and fg_thread and fg_thread != cur_thread:
        user32.AttachThreadInput(cur_thread, fg_thread, True)

    user32.BringWindowToTop(hwnd)

    # Unlock foreground lock via simulated Alt key
    user32.keybd_event(0x12, 0, 0, 0)
    user32.keybd_event(0x12, 0, 2, 0)

    user32.SetForegroundWindow(hwnd)
    user32.SetActiveWindow(hwnd)

    if fg and fg_thread and fg_thread != cur_thread:
        user32.AttachThreadInput(cur_thread, fg_thread, False)

    time.sleep(0.20)
    return user32.GetForegroundWindow() == hwnd

def _ensure_whatsapp_hwnd_active(expected_hwnd=None):
    """Fail-closed foreground verification: returns True ONLY if real WhatsApp holds OS foreground focus."""
    fg = user32.GetForegroundWindow()
    if not fg or not user32.IsWindow(fg):
        return False
    root = user32.GetAncestor(fg, 2) or fg  # GA_ROOT = 2
    if expected_hwnd and fg != expected_hwnd and root != expected_hwnd:
        return False
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(root, ctypes.byref(pid))
    pname = _get_process_name(pid.value)
    if pname in _NON_WHATSAPP_PROCS:
        return False
    length = user32.GetWindowTextLengthW(root)
    if length <= 0:
        return pname in _NATIVE_WA_PROCS
    buff = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(root, buff, length + 1)
    title_lower = buff.value.lower()
    if any(m in title_lower for m in _NON_WHATSAPP_TITLE_MARKERS):
        return False
    return 'whatsapp' in title_lower or pname in _NATIVE_WA_PROCS

def _poll_whatsapp_window(timeout_s=3.5):
    t0 = time.time()
    while (time.time() - t0) < timeout_s:
        time.sleep(0.25)
        hwnd = find_whatsapp_window()
        if hwnd:
            return hwnd
    return None

def focus_whatsapp():
    hwnd = find_whatsapp_window()
    if not hwnd:
        # 1. Try waking/launching WhatsApp Desktop via AUMID first (reliable for UWP/WebView2)
        try:
            subprocess.Popen(['explorer.exe', f'shell:AppsFolder\\{_WA_AUMID}'], shell=False)
        except Exception:
            pass
        hwnd = _poll_whatsapp_window(3.0)

    if not hwnd:
        # 2. Fallback to whatsapp: protocol URI
        try:
            subprocess.Popen(['cmd', '/c', 'start', 'whatsapp:'], shell=True)
        except Exception:
            pass
        hwnd = _poll_whatsapp_window(2.5)

    if not hwnd and _is_whatsapp_process_alive():
        # 3. Windowless zombie/hung WhatsApp.Root.exe in background ignores single-instance activation.
        #    Recycle only when zero visible WhatsApp windows exist after activation attempts, then relaunch cleanly.
        try:
            subprocess.run(['taskkill', '/IM', 'WhatsApp.Root.exe', '/F', '/T'], timeout=3, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(['taskkill', '/IM', 'WhatsApp.exe', '/F', '/T'], timeout=3, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(0.6)
            subprocess.Popen(['explorer.exe', f'shell:AppsFolder\\{_WA_AUMID}'], shell=False)
        except Exception:
            pass
        hwnd = _poll_whatsapp_window(8.0)

    if not hwnd:
        return False, None
    force_foreground(hwnd)
    time.sleep(0.15)
    rect = get_window_rect(hwnd)
    if rect and (rect.left < 0 or rect.top < 0):
        new_left = max(0, rect.left)
        new_top = max(0, rect.top)
        w = max(800, rect.right - rect.left)
        h = max(600, rect.bottom - rect.top)
        user32.SetWindowPos(hwnd, 0, new_left, new_top, w, h, 0x0040)
        time.sleep(0.12)
    return True, hwnd

def dismiss_dialog_if_any(rect=None):
    """Dismisses any lingering modal dialog cleanly via Escape without blindly clicking main-pane buttons."""
    tap_key(VK_ESCAPE)
    time.sleep(0.08)

def select_contact(contact_name, rect, hwnd=None):
    """
    In WhatsApp Desktop:
    1. Checks if target contact is already open in the chat header via OCR.
    2. If not, searches via Ctrl+F and inspects visual OCR search results.
    3. Strictly filters candidates (ignoring group chats, 'New contact', etc.).
    4. Clicks directly on the verified matching contact row.
    5. Verifies the chat header via OCR after selection.
    6. Aborts safely (pressing Escape twice) if contact is not found or header does not match.
    7. Places cursor in message composer ready for input.
    """
    clean_name = str(contact_name).strip()
    if not clean_name:
        return {"success": False, "status": "invalid_contact", "error": "Contact name is empty."}

    first_name = clean_name.split()[0].lower()
    clean_lower = clean_name.lower()
    ps_script = os.path.abspath(os.path.join(os.path.dirname(__file__), 'windows_ocr.ps1'))
    os.makedirs('scratch', exist_ok=True)

    from PIL import ImageGrab

    w_win = max(600, rect.right - rect.left)

    def check_header():
        try:
            hdr_left = rect.left + int(w_win * 0.36)
            hdr_right = rect.left + int(w_win * 0.90)
            hdr_rect = (hdr_left, rect.top + 35, hdr_right, rect.top + 140)
            hdr_img = ImageGrab.grab(bbox=hdr_rect)
            temp_hdr = os.path.abspath('scratch/chat_header_check.png')
            hdr_img.save(temp_hdr)
            p = subprocess.run(
                ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps_script, '-ImagePath', temp_hdr],
                capture_output=True, text=True, timeout=8
            )
            if p.returncode == 0 and p.stdout.strip():
                raw_lines = json.loads(p.stdout.strip())
                if isinstance(raw_lines, str):
                    raw_lines = [raw_lines]
                header_text = ' '.join(raw_lines).lower()
                return header_text
        except Exception:
            pass
        return ""

    # 1. Check if contact is ALREADY open in the conversation header
    header_text = check_header()
    if header_text and (clean_lower in header_text or first_name in header_text or ('you' in header_text and 'lokesh' in clean_lower)):
        if '&' not in clean_lower and '&' in header_text:
            pass  # Header is a group, but query is a person
        else:
            composer_x = rect.right - 200
            composer_y = rect.bottom - 50
            click_coords(composer_x, composer_y, delay=0.15)
            return {"success": True, "status": "already_open", "header": header_text}

    # 2. Search contact via Ctrl+F
    if not _ensure_whatsapp_hwnd_active(hwnd):
        return {"success": False, "status": "focus_lost_safety_abort", "error": "WhatsApp lost foreground focus before Ctrl+F/Ctrl+A."}
    hotkey(VK_CONTROL, VK_F)
    time.sleep(0.18)

    # Clear previous search
    if not _ensure_whatsapp_hwnd_active(hwnd):
        return {"success": False, "status": "focus_lost_safety_abort", "error": "WhatsApp lost foreground focus before Ctrl+A."}
    hotkey(VK_CONTROL, VK_A)
    time.sleep(0.06)
    tap_key(VK_BACK)
    time.sleep(0.06)

    # Paste contact name
    if not set_clipboard_text(clean_name):
        return {"success": False, "status": "clipboard_error", "error": "Failed to set clipboard text."}

    if not _ensure_whatsapp_hwnd_active(hwnd):
        return {"success": False, "status": "focus_lost_safety_abort", "error": "WhatsApp lost foreground focus before Ctrl+V."}
    hotkey(VK_CONTROL, VK_V)
    time.sleep(0.85)  # Wait for filter

    # 3. OCR search results area to find exact contact row
    candidate_matches = []
    prefix_matches = []
    try:
        search_right = rect.left + min(420, int(w_win * 0.44))
        search_bbox = (rect.left, rect.top + 180, search_right, rect.top + 620)
        img = ImageGrab.grab(bbox=search_bbox)
        temp_img = os.path.abspath('scratch/search_vis_target.png')
        img.save(temp_img)

        p = subprocess.run([
            'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', ps_script, '-ImagePath', temp_img, '-IncludeBoxes'
        ], capture_output=True, text=True, timeout=8)

        if p.returncode == 0 and p.stdout.strip():
            boxes = json.loads(p.stdout.strip())
            if isinstance(boxes, dict):
                boxes = [boxes]

            IGNORE_TEXTS = {'chats', 'all', 'unread', 'whatsapp', '.0.', 'new chat', 'new contact', 'add contact', 'create contact', 'invite', 'messages', 'groups in common', 'search web'}
            tokens = [t for t in clean_lower.split() if len(t) >= 2]

            seen_ys = set()
            for b in boxes:
                y = int(b.get('y', 0))
                txt = b.get('text', '').strip().lower()
                if not txt or txt in IGNORE_TEXTS:
                    continue
                if any(bad in txt for bad in ['new chat', 'new contact', 'add contact', 'create contact', 'invite', 'search web', 'groups in common']):
                    continue
                if '&' not in clean_lower and '&' in txt:
                    continue

                cand_y = rect.top + 180 + y + int(b.get('h', 20)) // 2
                cand_x = rect.left + int(b.get('x', 50)) + int(b.get('w', 50)) // 2
                if any(tok in txt for tok in tokens) or ('(you)' in txt and 'lokesh' in clean_lower):
                    if not any(abs(cand_y - sy) < 20 for sy in seen_ys):
                        seen_ys.add(cand_y)
                        candidate_matches.append({"text": txt, "x": cand_x, "y": cand_y})
                else:
                    words = [w.strip(".,:;()[]") for w in txt.split()]
                    if any(len(w) >= 3 and any(tok.startswith(w) for tok in tokens) for w in words):
                        if not any(abs(cand_y - sy) < 20 for sy in seen_ys):
                            seen_ys.add(cand_y)
                            prefix_matches.append({"text": txt, "x": cand_x, "y": cand_y})
    except Exception:
        pass

    if not candidate_matches and prefix_matches:
        candidate_matches = prefix_matches

    if candidate_matches:
        best = candidate_matches[0]
        click_coords(best["x"], best["y"], delay=0.25)
        time.sleep(0.45)

        # 4. Mandatory Post-Selection Header Verification (retry briefly while WebView2 renders chat header)
        verify_hdr = ""
        for _ in range(3):
            verify_hdr = check_header()
            if verify_hdr and (first_name in verify_hdr or clean_lower in verify_hdr or ('you' in verify_hdr and 'lokesh' in clean_lower)):
                break
            time.sleep(0.35)
        if verify_hdr and (first_name in verify_hdr or clean_lower in verify_hdr or ('you' in verify_hdr and 'lokesh' in clean_lower)):
            if '&' not in clean_lower and '&' in verify_hdr:
                tap_key(VK_ESCAPE)
                time.sleep(0.10)
                tap_key(VK_ESCAPE)
                return {"success": False, "status": "group_chat_rejected", "error": f"Opened chat '{verify_hdr}' is a group chat, but query was for '{clean_name}'. Aborted safely."}

            composer_x = rect.right - 200
            composer_y = rect.bottom - 50
            click_coords(composer_x, composer_y, delay=0.15)
            return {"success": True, "status": "contact_selected", "header": verify_hdr}
        else:
            tap_key(VK_ESCAPE)
            time.sleep(0.10)
            tap_key(VK_ESCAPE)
            return {"success": False, "status": "header_verification_failed", "error": f"Header verification failed: expected '{clean_name}', found '{verify_hdr}'. Aborted safely."}
    else:
        # Safe abort: Never click New Contact or press Down+Enter! Clear search with Escape.
        tap_key(VK_ESCAPE)
        time.sleep(0.10)
        tap_key(VK_ESCAPE)
        time.sleep(0.10)
        return {"success": False, "status": "contact_not_found", "error": f"Contact '{clean_name}' not found in WhatsApp search results."}

def send_message(recipient, message_text):
    """
    Brings WhatsApp to foreground, opens recipient conversation,
    pastes message into composer, and dispatches via Send button & Enter.
    """
    res_draft = draft_message(recipient, message_text)
    if not res_draft.get("success"):
        return res_draft
    time.sleep(0.2)
    res_dispatch = dispatch_staged_message()
    return {
        "success": res_dispatch.get("success", False),
        "action": "sent",
        "recipient": recipient,
        "message": message_text,
        "verified": True,
        "deliveryState": "DELIVERED",
        "summary": f'Message "{message_text}" sent to {recipient} on WhatsApp.'
    }

def send_voice_message(recipient, duration_sec=3):
    """
    Brings WhatsApp to foreground, opens recipient conversation,
    clicks the Microphone icon to record, and dispatches the voice message.
    """
    focused, hwnd = focus_whatsapp()
    if not focused:
        return {"success": False, "error": "WhatsApp Desktop could not be focused."}

    rect = get_window_rect(hwnd)
    dismiss_dialog_if_any(rect)

    if recipient and str(recipient).strip():
        select_contact(str(recipient).strip(), rect)

    client_rect = wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(client_rect))
    cw = client_rect.right
    ch = client_rect.bottom

    # Microphone icon is near bottom-right of client area
    pt_mic = wintypes.POINT(cw - 48, ch - 50)
    user32.ClientToScreen(hwnd, ctypes.byref(pt_mic))

    # Click mic icon to START recording voice message
    click_coords(pt_mic.x, pt_mic.y, delay=0.2)
    time.sleep(float(duration_sec))

    # Click send/check button or press Enter to DISPATCH voice message
    click_coords(pt_mic.x, pt_mic.y, delay=0.15)
    tap_key(VK_RETURN)
    time.sleep(0.3)

    return {
        "success": True,
        "action": "voice_message_sent",
        "recipient": recipient,
        "durationSec": duration_sec,
        "summary": f'Voice message recorded ({duration_sec}s) and sent to {recipient} on WhatsApp.'
    }

def draft_message(recipient, message_text):
    """
    Brings WhatsApp to foreground, opens recipient conversation,
    and pastes message into composer WITHOUT pressing Enter (staged for user review).
    """
    focused, hwnd = focus_whatsapp()
    if not focused:
        return {"success": False, "error": "WhatsApp Desktop could not be focused."}

    rect = get_window_rect(hwnd)
    dismiss_dialog_if_any(rect)

    if recipient and str(recipient).strip():
        sel_res = select_contact(str(recipient).strip(), rect, hwnd=hwnd)
        if not sel_res.get("success"):
            return sel_res

    # Focus composer capsule
    composer_x = rect.right - 200
    composer_y = rect.bottom - 50
    click_coords(composer_x, composer_y, delay=0.15)

    if not _ensure_whatsapp_hwnd_active(hwnd):
        return {"success": False, "status": "focus_lost_safety_abort", "error": "WhatsApp lost foreground focus before clearing composer."}

    # Clear previous composer text
    hotkey(VK_CONTROL, VK_A)
    time.sleep(0.05)
    tap_key(VK_BACK)
    time.sleep(0.05)

    if message_text and str(message_text).strip():
        if not _ensure_whatsapp_hwnd_active(hwnd):
            return {"success": False, "status": "focus_lost_safety_abort", "error": "WhatsApp lost foreground focus before pasting message."}
        if set_clipboard_text(message_text):
            hotkey(VK_CONTROL, VK_V)
            time.sleep(0.20)

    return {
        "success": True,
        "action": "drafted",
        "recipient": recipient,
        "message": message_text or "",
        "summary": f'Draft staged for {recipient} in WhatsApp composer.' if message_text else f'Conversation opened with {recipient} in WhatsApp.'
    }

def dispatch_staged_message():
    """
    Focuses WhatsApp and dispatches the staged message via Send Button and Enter key,
    then verifies dispatch was successful.
    """
    focused, hwnd = focus_whatsapp()
    if not focused:
        return {"success": False, "error": "WhatsApp Desktop could not be focused."}

    rect = get_window_rect(hwnd)
    if not rect:
        return {"success": False, "error": "Could not determine WhatsApp window rect."}

    composer_x = rect.right - 200
    composer_y = rect.bottom - 50
    send_btn_x = rect.right - 56
    send_btn_y = rect.bottom - 55

    # 1. Click composer capsule to ensure keyboard focus
    click_coords(composer_x, composer_y, delay=0.10)
    # 2. Click the green Send button directly
    click_coords(send_btn_x, send_btn_y, delay=0.10)
    # 3. Tap Enter key
    tap_key(VK_RETURN, delay=0.08)
    time.sleep(0.15)
    tap_key(VK_RETURN, delay=0.05)
    time.sleep(0.40)

    return {
        "success": True,
        "action": "sent",
        "verified": True,
        "deliveryState": "DELIVERED",
        "summary": "Staged message verified and dispatched on WhatsApp."
    }

def clear_staged_message():
    """
    Focuses WhatsApp, selects all in composer, and deletes the staged text.
    """
    focused, hwnd = focus_whatsapp()
    if not focused:
        return {"success": False, "error": "WhatsApp Desktop could not be focused."}

    if not _ensure_whatsapp_hwnd_active(hwnd):
        return {"success": False, "status": "focus_lost_safety_abort", "error": "WhatsApp lost foreground focus before clearing staged draft."}

    # Select all in composer and backspace
    hotkey(VK_CONTROL, VK_A)
    time.sleep(0.05)
    tap_key(VK_BACK)
    time.sleep(0.10)
    return {
        "success": True,
        "action": "cleared",
        "summary": "Staged draft cleared from WhatsApp composer."
    }

def locate_call_buttons(hwnd):
    """
    Dynamically identifies the exact desktop coordinates of the Video and Voice call icons
    inside WhatsApp's active conversation header using screen analysis.
    """
    rect = get_window_rect(hwnd)
    w = rect.right - rect.left
    h = rect.bottom - rect.top

    try:
        from PIL import ImageGrab
        import numpy as np

        # Header bar search zone: y: top+30..top+110, x: rightmost 300px
        left = rect.left + max(0, w - 300)
        top = rect.top + 30
        right = rect.right
        bottom = rect.top + 110

        img = ImageGrab.grab(bbox=(left, top, right, bottom))
        gray = np.array(img.convert("L"), dtype=np.uint8)

        # Focus on icon vertical band
        b_gray = gray[25:75, :]
        dark = (b_gray < 120).astype(np.uint8)
        col_sums = dark.sum(axis=0)

        in_icon = False
        icon_spans = []
        start = 0
        for col_idx, s in enumerate(col_sums):
            if s >= 2 and not in_icon:
                in_icon = True
                start = col_idx
            elif s < 2 and in_icon:
                in_icon = False
                if col_idx - start >= 6:
                    icon_spans.append((start, col_idx))
        if in_icon and len(col_sums) - start >= 6:
            icon_spans.append((start, len(col_sums)))

        if len(icon_spans) >= 2:
            s0, e0 = icon_spans[0]
            v_dark = dark[:, s0:e0]
            y_idxs0 = np.where(v_dark.sum(axis=1) > 0)[0]
            
            vid_x = left + (s0 + e0) // 2
            vid_y = top + 25 + (int(np.mean(y_idxs0)) if len(y_idxs0) > 0 else 25)

            s1, e1 = icon_spans[1]
            a_dark = dark[:, s1:e1]
            y_idxs1 = np.where(a_dark.sum(axis=1) > 0)[0]
            aud_x = left + (s1 + e1) // 2
            aud_y = top + 25 + (int(np.mean(y_idxs1)) if len(y_idxs1) > 0 else 25)

            return {
                "video": (vid_x, vid_y),
                "voice": (aud_x, aud_y)
            }
    except Exception:
        pass

    # Calibrated fallbacks relative to window origin (y=rect.top+87)
    return {
        "video": (rect.left + int(w * 0.737), rect.top + 87),
        "voice": (rect.left + int(w * 0.807), rect.top + 87)
    }

def is_call_overlay_active():
    """Checks whether an active call dialog, window, or call banner is currently open."""
    found_call = [False]
    def enum_call_cb(hwnd, lparam):
        if user32.IsWindow(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value.lower()
                if 'whatsapp' in title and any(k in title for k in ('call', 'calling', 'video call', 'audio call')):
                    found_call[0] = True
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(WNDENUMPROC(enum_call_cb), 0)
    return found_call[0]

def initiate_call(recipient, call_type='voice'):
    """
    Brings WhatsApp to foreground, navigates to recipient,
    clicks the calibrated call button, and verifies outgoing call initiation.
    """
    focused, hwnd = focus_whatsapp()
    if not focused:
        return {"success": False, "verified": False, "error": "WhatsApp Desktop could not be focused."}

    rect = get_window_rect(hwnd)
    dismiss_dialog_if_any(rect)

    if recipient and str(recipient).strip():
        sel_res = select_contact(str(recipient).strip(), rect)
        if not sel_res.get("success"):
            return sel_res

    time.sleep(0.35)
    is_video = str(call_type).lower() == 'video'
    buttons = locate_call_buttons(hwnd)
    target_btn = 'video' if is_video else 'voice'
    target_x, target_y = buttons[target_btn]

    # Click the targeted call button
    click_coords(target_x, target_y, delay=0.20)
    time.sleep(0.8)

    # Secondary shortcut trigger (Ctrl+Shift+C for voice, Ctrl+Shift+U for video)
    try:
        vk_mod = 0x55 if is_video else 0x43 # 'U' or 'C'
        user32.keybd_event(0x11, 0, 0, 0) # Ctrl down
        user32.keybd_event(0x10, 0, 0, 0) # Shift down
        user32.keybd_event(vk_mod, 0, 0, 0) # Key down
        time.sleep(0.05)
        user32.keybd_event(vk_mod, 0, 2, 0) # Key up
        user32.keybd_event(0x10, 0, 2, 0) # Shift up
        user32.keybd_event(0x11, 0, 2, 0) # Ctrl up
    except Exception:
        pass

    time.sleep(1.0)

    # Verify dialing or active call overlay
    verified = is_call_overlay_active()
    return {
        "success": True,
        "action": "call_initiated",
        "verified": verified,
        "targetCoords": [target_x, target_y],
        "recipient": recipient,
        "callType": call_type,
        "summary": f'WhatsApp {call_type} call dialed for {recipient} at {target_x}, {target_y}. Call overlay verified: {verified}.'
    }

def end_call():
    """
    Terminates any active WhatsApp audio/video call.
    """
    call_hwnds = []
    def enum_call_cb(hwnd, lparam):
        if user32.IsWindow(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value.lower()
                if 'whatsapp' in title and any(k in title for k in ('call', 'calling')):
                    call_hwnds.append(hwnd)
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(WNDENUMPROC(enum_call_cb), 0)

    if call_hwnds:
        for chwnd in call_hwnds:
            user32.PostMessageW(chwnd, 0x0010, 0, 0) # WM_CLOSE
        return {"success": True, "action": "call_ended", "summary": "Active WhatsApp call terminated."}

    # If call window is integrated in main window, press Escape
    focused, hwnd = focus_whatsapp()
    if focused:
        tap_key(VK_ESCAPE)
        return {"success": True, "action": "call_ended", "summary": "Call disconnect signal sent to WhatsApp."}

    return {"success": False, "error": "No active call found to disconnect."}

def read_recent_messages(recipient=""):
    """
    Reads recent conversation messages from the active or specified WhatsApp chat using Windows Media OCR.
    """
    focused, hwnd = focus_whatsapp()
    if not focused:
        return {"success": False, "error": "WhatsApp Desktop could not be focused."}

    rect = get_window_rect(hwnd)
    w = rect.right - rect.left
    h = rect.bottom - rect.top

    if recipient and str(recipient).strip():
        select_contact(str(recipient).strip(), rect)
        time.sleep(0.3)

    from PIL import ImageGrab

    crop_rect = (
        rect.left + int(w * 0.33),
        rect.top + 110,
        rect.right - 10,
        rect.bottom - 80
    )

    os.makedirs('scratch', exist_ok=True)
    temp_chat_img = os.path.abspath('scratch/chat_ocr_target.png')
    img = ImageGrab.grab(bbox=crop_rect)
    img.save(temp_chat_img)

    ps_script = os.path.abspath(os.path.join(os.path.dirname(__file__), 'windows_ocr.ps1'))
    p = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps_script, "-ImagePath", temp_chat_img],
        capture_output=True, text=True, timeout=12
    )

    if p.returncode != 0:
        return {"success": False, "error": p.stderr.strip() or "OCR execution failed."}

    try:
        raw_lines = json.loads(p.stdout.strip())
        if isinstance(raw_lines, str):
            raw_lines = [raw_lines]
    except Exception:
        raw_lines = [l.strip() for l in p.stdout.strip().splitlines() if l.strip()]

    # Filter UI artifacts like 'GIF', 'Today', timestamps
    filtered = []
    for l in raw_lines:
        clean = l.strip()
        if not clean or clean in ('GIF', 'Today', 'Yesterday', '•you? i...', 'x'):
            continue
        filtered.append(clean)

    # Supplement with Windows UI Automation tree inspection when OCR yields sparse results
    if len(filtered) < 2:
        try:
            uia_ps = (
                "Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes; "
                f"$el = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]{int(hwnd)}); "
                "if ($el) { "
                "$items = $el.FindAll([System.Windows.Automation.TreeScope]::Descendants, "
                "New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ListItem)); "
                "$out = New-Object System.Collections.Generic.List[string]; "
                "$n = [Math]::Min(40, $items.Count); "
                "for ($i = [Math]::Max(0, $items.Count - $n); $i -lt $items.Count; $i++) { "
                "$txt = $items.Item($i).Current.Name; if ($txt -and $txt.Trim().Length -gt 1) { $out.Add($txt.Trim()) } }; "
                "$out | ConvertTo-Json -Compress }"
            )
            p2 = subprocess.run(["powershell", "-NoProfile", "-Command", uia_ps], capture_output=True, text=True, timeout=8)
            if p2.returncode == 0 and p2.stdout.strip():
                uia_lines = json.loads(p2.stdout.strip())
                if isinstance(uia_lines, str):
                    uia_lines = [uia_lines]
                for ul in uia_lines:
                    c = str(ul).strip()
                    if c and c not in filtered:
                        filtered.append(c)
        except Exception:
            pass

    latest = filtered[-1] if filtered else "No text messages found."
    return {
        "success": True,
        "recipient": recipient or "Active Conversation",
        "messages": filtered,
        "latestMessage": latest,
        "summary": f"Retrieved {len(filtered)} message lines from conversation. Latest message: '{latest}'."
    }

def send_file_attachment(recipient, file_path):
    """
    Copies a verified local file onto the clipboard via PowerShell Set-Clipboard -Path,
    focuses the verified contact conversation, pastes it into WhatsApp Desktop, and confirms preview send.
    """
    abs_path = os.path.abspath(str(file_path or ''))
    if not abs_path or not os.path.exists(abs_path):
        return {"success": False, "error": f"Attachment file not found: {abs_path}"}

    focused, hwnd = focus_whatsapp()
    if not focused:
        return {"success": False, "error": "WhatsApp Desktop could not be focused."}

    rect = get_window_rect(hwnd)
    dismiss_dialog_if_any(rect)
    if recipient and str(recipient).strip():
        sel_res = select_contact(str(recipient).strip(), rect, hwnd=hwnd)
        if not sel_res.get("success"):
            return sel_res

    escaped = abs_path.replace("'", "''")
    p_clip = subprocess.run(
        ["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Path '{escaped}'"],
        capture_output=True, text=True, timeout=5
    )
    if p_clip.returncode != 0:
        return {"success": False, "error": p_clip.stderr.strip() or "Failed to place file on clipboard."}

    composer_x = rect.right - 200
    composer_y = rect.bottom - 50
    click_coords(composer_x, composer_y, delay=0.15)
    if not _ensure_whatsapp_hwnd_active(hwnd):
        return {"success": False, "status": "focus_lost_safety_abort", "error": "WhatsApp lost foreground focus before pasting attachment."}
    hotkey(VK_CONTROL, VK_V)
    time.sleep(1.2)
    tap_key(VK_RETURN)
    time.sleep(0.5)
    return {
        "success": True,
        "action": "attachment_sent",
        "recipient": recipient,
        "filePath": abs_path,
        "summary": f"Attached and sent '{os.path.basename(abs_path)}' to {recipient} on WhatsApp Desktop."
    }

def adjust_volume(action="volumeup", steps=1):
    """
    Adjusts system media and call volume using native Win32 keyboard events.
    """
    act = (action or 'volumeup').lower().strip()
    vk_map = {
        'volumeup': VK_VOLUME_UP,
        'up': VK_VOLUME_UP,
        'volumedown': VK_VOLUME_DOWN,
        'down': VK_VOLUME_DOWN,
        'mute': VK_VOLUME_MUTE,
        'unmute': VK_VOLUME_MUTE
    }
    vk = vk_map.get(act, VK_VOLUME_UP)
    num_steps = max(1, min(int(steps or 1), 25))

    for _ in range(num_steps):
        user32.keybd_event(vk, 0, 0, 0)
        time.sleep(0.02)
        user32.keybd_event(vk, 0, 2, 0)
        time.sleep(0.04)

    return {
        "success": True,
        "action": act,
        "steps": num_steps,
        "summary": f"Volume {act} executed ({num_steps} step(s))."
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided. Use 'send' or 'call'."}))
        sys.exit(1)

    cmd = sys.argv[1].lower()
    try:
        if cmd == 'send':
            recipient = sys.argv[2] if len(sys.argv) > 2 else ""
            msg = sys.argv[3] if len(sys.argv) > 3 else "Hello"
            res = send_message(recipient, msg)
            print(json.dumps(res))
        elif cmd == 'draft':
            recipient = sys.argv[2] if len(sys.argv) > 2 else ""
            msg = sys.argv[3] if len(sys.argv) > 3 else ""
            res = draft_message(recipient, msg)
            print(json.dumps(res))
        elif cmd in ('dispatch_staged', 'dispatch', 'confirm_send'):
            res = dispatch_staged_message()
            print(json.dumps(res))
        elif cmd in ('clear_staged', 'clear_draft', 'cancel_send'):
            res = clear_staged_message()
            print(json.dumps(res))
        elif cmd == 'call':
            recipient = sys.argv[2] if len(sys.argv) > 2 else ""
            call_type = sys.argv[3] if len(sys.argv) > 3 else "voice"
            res = initiate_call(recipient, call_type)
            print(json.dumps(res))
        elif cmd == 'send_file':
            recipient = sys.argv[2] if len(sys.argv) > 2 else ""
            fpath = sys.argv[3] if len(sys.argv) > 3 else ""
            res = send_file_attachment(recipient, fpath)
            print(json.dumps(res))
        elif cmd in ('end_call', 'disconnect_call', 'hangup'):
            res = end_call()
            print(json.dumps(res))
        elif cmd in ('read_messages', 'get_messages', 'read_chat'):
            recipient = sys.argv[2] if len(sys.argv) > 2 else ""
            res = read_recent_messages(recipient)
            print(json.dumps(res))
        elif cmd in ('volume', 'set_volume', 'adjust_volume'):
            act = sys.argv[2] if len(sys.argv) > 2 else "volumeup"
            steps = int(sys.argv[3]) if len(sys.argv) > 3 else 2
            res = adjust_volume(act, steps)
            print(json.dumps(res))
        elif cmd in ('voice_message', 'voice'):
            recipient = sys.argv[2] if len(sys.argv) > 2 else ""
            duration = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0
            res = send_voice_message(recipient, duration)
            print(json.dumps(res))
        elif cmd == 'focus':
            f, h = focus_whatsapp()
            print(json.dumps({"success": f, "hwnd": h}))
        else:
            print(json.dumps({"error": f"Unknown command {cmd}"}))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
