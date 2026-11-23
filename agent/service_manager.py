"""
VISION AI — Python Agent Lifecycle & Service Manager
Handles user-level registration, startup, shutdown, restart, and health queries
for the VISION Windows Local Agent background daemon.
"""

import os
import sys
import json
import time
import subprocess
import urllib.request
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
AGENT_SCRIPT = Path(__file__).resolve().parent / "windows_agent.py"
RUNTIME_FILE = DATA_DIR / "agent_runtime.json"
DEFAULT_PORT = 3005


def get_runtime_info() -> dict:
    if RUNTIME_FILE.exists():
        try:
            return json.loads(RUNTIME_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_runtime_info(info: dict):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_FILE.write_text(json.dumps(info, indent=2), encoding="utf-8")


def is_agent_alive(port: int = DEFAULT_PORT) -> bool:
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/health", headers={"User-Agent": "VISION-Manager"})
        with urllib.request.urlopen(req, timeout=1.5) as res:
            if res.status == 200:
                data = json.loads(res.read().decode("utf-8"))
                return data.get("agent_name") == "STARK_WINDOWS_LOCAL_AGENT"
    except Exception:
        return False
    return False


def query_health(port: int = DEFAULT_PORT) -> dict:
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/health", headers={"User-Agent": "VISION-Manager"})
        with urllib.request.urlopen(req, timeout=2.0) as res:
            return json.loads(res.read().decode("utf-8"))
    except Exception as e:
        return {"status": "STOPPED", "error": str(e), "running": False}


def start_agent(port: int = DEFAULT_PORT) -> dict:
    if is_agent_alive(port):
        h = query_health(port)
        return {
            "success": True,
            "status": "ALREADY_RUNNING",
            "port": port,
            "pid": h.get("pid"),
            "summary": f"VISION Windows Local Agent is already running on port {port} (PID {h.get('pid')})."
        }

    python_exe = sys.executable
    # Spawn as detached background process on Windows (creationflags=0x00000008 DETACHED_PROCESS)
    DETACHED_PROCESS = 0x00000008
    CREATE_NO_WINDOW = 0x08000000

    proc = subprocess.Popen(
        [python_exe, str(AGENT_SCRIPT), str(port)],
        cwd=str(PROJECT_ROOT),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=DETACHED_PROCESS | CREATE_NO_WINDOW,
        close_fds=True
    )

    # Wait up to 4 seconds for agent to become healthy
    t0 = time.time()
    healthy = False
    while time.time() - t0 < 4.0:
        if is_agent_alive(port):
            healthy = True
            break
        time.sleep(0.3)

    if healthy:
        info = {
            "pid": proc.pid,
            "port": port,
            "started_at": time.time(),
            "status": "HEALTHY"
        }
        save_runtime_info(info)
        return {
            "success": True,
            "status": "HEALTHY",
            "port": port,
            "pid": proc.pid,
            "summary": f"VISION Windows Local Agent started successfully on port {port} (PID {proc.pid})."
        }
    else:
        return {
            "success": False,
            "status": "FAILED_TO_START",
            "port": port,
            "pid": proc.pid,
            "summary": f"VISION Windows Local Agent process spawned (PID {proc.pid}) but failed health check."
        }


def stop_agent(port: int = DEFAULT_PORT) -> dict:
    runtime = get_runtime_info()
    target_pid = runtime.get("pid")

    # Try graceful /stop endpoint first
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/stop",
            data=b"{}",
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=2.0)
        time.sleep(0.5)
    except Exception:
        pass

    # Ensure process termination via taskkill if PID known
    if target_pid:
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(target_pid)], capture_output=True)
        except Exception:
            pass

    # Verify stopped
    stopped = not is_agent_alive(port)
    if stopped:
        save_runtime_info({"status": "STOPPED", "port": port})
        return {"success": True, "status": "STOPPED", "summary": "VISION Windows Local Agent stopped."}
    return {"success": False, "status": "TERMINATION_PENDING", "summary": "Agent process still alive."}


def restart_agent(port: int = DEFAULT_PORT) -> dict:
    stop_agent(port)
    time.sleep(1.0)
    return start_agent(port)


def register_user_startup() -> dict:
    """
    Registers a user-level startup shortcut in Windows Startup directory
    No admin privileges required.
    """
    startup_dir = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
    if not startup_dir.exists():
        return {"success": False, "error": f"Startup directory '{startup_dir}' not found."}

    cmd_script = PROJECT_ROOT / "scripts" / "start_stark_agent.cmd"
    cmd_script.parent.mkdir(parents=True, exist_ok=True)

    cmd_content = f'@echo off\ncd /d "{PROJECT_ROOT}"\nstart "" "{sys.executable}" "{AGENT_SCRIPT}" {DEFAULT_PORT}\n'
    cmd_script.write_text(cmd_content, encoding="utf-8")

    shortcut_vbs = startup_dir / "StartStarkAgent.vbs"
    vbs_content = (
        f'Set WshShell = CreateObject("WScript.Shell")\n'
        f'WshShell.Run chr(34) & "{cmd_script}" & chr(34), 0\n'
        f'Set WshShell = Nothing\n'
    )
    try:
        shortcut_vbs.write_text(vbs_content, encoding="utf-8")
        return {
            "success": True,
            "mechanism": "USER_STARTUP_VBS",
            "script_path": str(cmd_script),
            "startup_path": str(shortcut_vbs),
            "summary": "User-level startup task registered. Agent will start on user login without admin elevation."
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    action = (sys.argv[1] if len(sys.argv) > 1 else "status").lower()
    port = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_PORT

    if action == "start":
        res = start_agent(port)
        print(json.dumps(res, indent=2))
    elif action == "stop":
        res = stop_agent(port)
        print(json.dumps(res, indent=2))
    elif action == "restart":
        res = restart_agent(port)
        print(json.dumps(res, indent=2))
    elif action == "register":
        res = register_user_startup()
        print(json.dumps(res, indent=2))
    elif action == "health" or action == "status":
        h = query_health(port)
        print(json.dumps(h, indent=2))
    else:
        print(f"Unknown action '{action}'. Usage: python service_manager.py [start|stop|restart|status|register] [port]")
