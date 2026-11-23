#!/usr/bin/env python3
"""
Comprehensive Tech Stack Audit Script for JARVIS & VISION.
Scans package.json, requirements.txt, imports, languages, and subsystem files
across source directories (agent, server, desktop, js, css, ml_foundation, scripts, tests).
Outputs JSON summary of verified facts.
"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

ROOT = Path("D:/Jarvis")

SOURCE_DIRS = ["agent", "server", "desktop", "js", "css", "ml_foundation", "scripts", "tests"]
ROOT_FILES = ["server.js", "index.html", "package.json", "requirements.txt"]

def scan_files():
    file_stats = defaultdict(lambda: {"count": 0, "lines": 0})
    ext_map = {
        ".js": "JavaScript",
        ".py": "Python",
        ".html": "HTML",
        ".css": "CSS",
        ".ps1": "PowerShell",
        ".json": "JSON",
        ".jsonl": "JSONL",
        ".md": "Markdown",
        ".bat": "Batch",
        ".sh": "Shell"
    }
    
    all_files = []
    
    # Root files
    for rf in ROOT_FILES:
        p = ROOT / rf
        if p.is_file():
            all_files.append(p)
            ext = p.suffix.lower()
            if ext in ext_map:
                lang = ext_map[ext]
                file_stats[lang]["count"] += 1
                try:
                    with open(p, "r", encoding="utf-8", errors="ignore") as f:
                        file_stats[lang]["lines"] += sum(1 for _ in f)
                except Exception:
                    pass

    # Source directories
    for sdir in SOURCE_DIRS:
        dp = ROOT / sdir
        if not dp.exists():
            continue
        for p in dp.rglob("*"):
            if "__pycache__" in p.parts:
                continue
            if p.is_file():
                ext = p.suffix.lower()
                all_files.append(p)
                if ext in ext_map:
                    lang = ext_map[ext]
                    file_stats[lang]["count"] += 1
                    try:
                        with open(p, "r", encoding="utf-8", errors="ignore") as f:
                            file_stats[lang]["lines"] += sum(1 for _ in f)
                    except Exception:
                        pass
    return file_stats, all_files

def audit_package_json(all_files):
    pkg_path = ROOT / "package.json"
    with open(pkg_path, "r", encoding="utf-8") as f:
        pkg = json.load(f)
    
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    dep_usage = {}
    
    for dep in deps:
        pattern = re.compile(rf"(?:from\s+['\"]{re.escape(dep)}['\"]|require\(\s*['\"]{re.escape(dep)}['\"]\)|import\s+.*['\"]{re.escape(dep)}['\"])")
        name_only = dep.split("/")[-1]
        
        matches = []
        for p in all_files:
            if p.suffix in [".js", ".html"]:
                try:
                    content = p.read_text(encoding="utf-8", errors="ignore")
                    if dep in content or (name_only in content and p.suffix == ".html"):
                        matches.append(str(p.relative_to(ROOT)))
                except Exception:
                    pass
        dep_usage[dep] = {
            "version": deps[dep],
            "kind": "devDependencies" if dep in pkg.get("devDependencies", {}) else "dependencies",
            "matches_count": len(matches),
            "matched_files": matches[:10]
        }
    return dep_usage

def read_text_safe(path):
    for enc in ["utf-8", "utf-8-sig", "utf-16", "latin-1"]:
        try:
            return path.read_text(encoding=enc)
        except Exception:
            continue
    return ""

def audit_requirements_txt(all_files):
    req_path = ROOT / "requirements.txt"
    raw = read_text_safe(req_path)
    lines = [l.strip() for l in raw.splitlines() if l.strip() and not l.startswith("#")]
    
    packages = []
    for l in lines:
        pkg_name = re.split(r"[=<>!~]", l)[0].strip()
        packages.append((pkg_name, l))
        
    pkg_alias = {
        "pillow": "PIL",
        "opencv-python-headless": "cv2",
        "opencv-python": "cv2",
        "pymupdf": "fitz",
        "scikit-learn": "sklearn",
        "python-docx": "docx",
        "Jinja2": "jinja2",
        "MarkupSafe": "markupsafe"
    }
    
    py_files = [p for p in all_files if p.suffix == ".py"]
    
    dep_usage = {}
    for pkg_name, full_spec in packages:
        module_name = pkg_alias.get(pkg_name.lower(), pkg_name.lower().replace("-", "_"))
        import_pattern = re.compile(rf"(?:import\s+{module_name}\b|from\s+{module_name}\b)", re.IGNORECASE)
        
        matches = []
        for p in py_files:
            try:
                content = p.read_text(encoding="utf-8", errors="ignore")
                if import_pattern.search(content):
                    matches.append(str(p.relative_to(ROOT)))
            except Exception:
                pass
        dep_usage[pkg_name] = {
            "spec": full_spec,
            "import_target": module_name,
            "matches_count": len(matches),
            "matched_files": matches[:10]
        }
    return dep_usage

def audit_subsystems(all_files):
    subsystems = {}
    
    # 1. AI Provider Adapter (Gemini)
    ai_adapter = ROOT / "server" / "aiProviderAdapter.js"
    if ai_adapter.exists():
        content = ai_adapter.read_text(encoding="utf-8", errors="ignore")
        has_gemini = "generativelanguage.googleapis.com" in content
        has_sdk = "@google" in content
        has_sse = "text/event-stream" in content
        subsystems["ai_provider_adapter"] = {
            "file": "server/aiProviderAdapter.js",
            "has_gemini_rest": has_gemini,
            "uses_google_sdk": has_sdk,
            "supports_sse": has_sse,
            "models_referenced": list(set(re.findall(r"gemini-[0-9a-zA-Z\.\-]+", content)))
        }

    # 2. ML Foundation
    ml_files = [p for p in all_files if "ml_foundation" in p.parts]
    subsystems["ml_foundation"] = {
        "file_count": len(ml_files),
        "files": [str(p.relative_to(ROOT)) for p in ml_files if p.suffix == ".py"]
    }
    
    # 3. Server HTTP / WebSockets
    server_js = ROOT / "server.js"
    if server_js.exists():
        content = server_js.read_text(encoding="utf-8", errors="ignore")
        subsystems["backend_server"] = {
            "file": "server.js",
            "uses_http_module": "require('http')" in content or 'require("http")' in content,
            "uses_express": "express" in content,
            "uses_fastify": "fastify" in content,
            "uses_websocket": "ws" in content or "socket.io" in content,
            "has_sse": "text/event-stream" in content
        }
        
    # 4. Desktop Automation
    desktop_agent = ROOT / "agent" / "desktop_automation.py"
    if desktop_agent.exists():
        content = desktop_agent.read_text(encoding="utf-8", errors="ignore")
        subsystems["desktop_automation_py"] = {
            "uses_ctypes": "ctypes" in content,
            "uses_user32": "user32" in content,
            "uses_pyautogui": "pyautogui" in content,
            "uses_uiautomation": "uiautomation" in content,
            "uses_win32api": "win32api" in content
        }
        
    browser_engine = ROOT / "server" / "browser" / "browserAutomationEngine.js"
    if browser_engine.exists():
        content = browser_engine.read_text(encoding="utf-8", errors="ignore")
        subsystems["browser_automation"] = {
            "file": "server/browser/browserAutomationEngine.js",
            "uses_playwright": "playwright" in content
        }
        
    return subsystems

if __name__ == "__main__":
    file_stats, all_files = scan_files()
    pkg_usage = audit_package_json(all_files)
    req_usage = audit_requirements_txt(all_files)
    subsystems = audit_subsystems(all_files)
    
    out = {
        "file_stats": file_stats,
        "package_json_dependencies": pkg_usage,
        "requirements_txt_dependencies": req_usage,
        "subsystems": subsystems
    }
    
    out_path = ROOT / "data" / "tech_stack_audit_raw.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print("Audit written to:", out_path)
