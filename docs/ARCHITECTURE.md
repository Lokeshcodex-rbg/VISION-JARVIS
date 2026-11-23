# VISION / JARVIS — System Architecture Specification

This document provides a comprehensive technical overview of the system architecture, inter-process communication (IPC) protocols, process lifecycle management, and subsystem isolation boundaries for **VISION / JARVIS**.

---

## 1. System Block Diagram

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Desktop & UI)"]
        Electron["Electron 45 Desktop Shell\n(desktop/main.js & preload.js)"]
        CanvasEye["HTML5 Canvas 2D\n(Living Code Eye - 60 FPS)"]
        WebGLBrain["Three.js WebGL\n(3D Holographic Brain)"]
        WebSpeech["Web Speech API\n(Continuous Speech & Synthesis)"]
        UI_DOM["HUD Glassmorphism DOM\n(Vanilla ES Modules)"]
    end

    subgraph Server ["Backend Server (Node.js v22+)"]
        HTTPServer["HTTP REST Server & Static Router\n(server.js - No 3P Frameworks)"]
        SSEHub["Server-Sent Events (SSE) Streamer\n(/api/chat/stream, /api/agent/stream)"]
        Router["REST Endpoint Dispatcher"]
        
        subgraph Intelligence ["Intelligence & Coordination Core"]
            Personality["Personality Engine\n(JARVIS vs ULTRON)"]
            Memory["Multi-Tier Memory Manager\n(Working, Episodic, Long-Term)"]
            DAG["DAG Task Planning Engine\n(Task Decomposition & Dependencies)"]
            Diagnostics["Error Diagnostics & Recovery Ledger"]
        end
    end

    subgraph AIProviders ["AI & Foundation Model Layer"]
        GeminiAdapter["Google Gemini REST Adapter\n(aiProviderAdapter.js - Zero SDK)"]
        VisionModel["VISION LLM (PyTorch 2.15.0)\n(JarvisUnifiedTransformer - ~100M Params)"]
        VisionTokenizer["JarvisBPE Tokenizer\n(8,192 Vocab - Byte-Level BPE)"]
        VisionInference["Local Autoregressive Engine\n(KV-Cache Decoders)"]
    end

    subgraph Automation ["Desktop Automation & Execution Engine"]
        PermissionGate["Central Permission Policy Engine\n(Levels 0-4 + Human-in-the-Loop)"]
        Win32Bridge["Python Win32 Bridge (ctypes)\n(SendInput, EnumWindows, DPI-Aware)"]
        BrowserEngine["Playwright Engine\n(Headless/Headed Chromium)"]
        WinRT_OCR["PowerShell WinRT OCR Engine\n(Windows.Media.Ocr.OcrEngine)"]
        DocGenerators["Pure-Python Document Engines\n(OpenXML .docx/.xlsx & PDF 1.4)"]
    end

    subgraph Storage ["Storage & Persistence"]
        JSONMemory["data/memory/*.json\n(Conversational State)"]
        AuditLog["data/audit_trail.jsonl\n(Tamper-Evident SHA-256 Chained)"]
        ModelWeights["models/*.pt\n(PyTorch Model Checkpoints)"]
        BinaryShards["data/*.bin\n(numpy.memmap Pretraining Shards)"]
        ClientStorage["localStorage\n(User Preferences & Themes)"]
    end

    %% Connections
    Electron --> CanvasEye & WebGLBrain & WebSpeech & UI_DOM
    UI_DOM -->|HTTP POST / GET| Router
    UI_DOM -->|EventSource| SSEHub
    HTTPServer --> Router & SSEHub
    Router --> Intelligence
    Intelligence --> PermissionGate
    Intelligence --> GeminiAdapter
    Intelligence --> VisionModel
    
    VisionModel --> VisionTokenizer & VisionInference
    
    PermissionGate -->|Authorized Action| Win32Bridge
    PermissionGate -->|Authorized Action| BrowserEngine
    PermissionGate -->|Authorized Action| WinRT_OCR
    PermissionGate -->|Authorized Action| DocGenerators
    
    Intelligence --> JSONMemory
    PermissionGate --> AuditLog
    VisionModel --> ModelWeights & BinaryShards
    UI_DOM --> ClientStorage
```

---

## 2. Process Lifecycle & IPC Protocols

### 2.1 Process Isolation Boundaries

1. **Main Process (Node.js / Electron)**:
   - Owns the native Windows window, system tray menu, global hotkeys (`Ctrl+Shift+J`, `Ctrl+Shift+U`), and HTTP server lifecycle.
   - Runs in isolated context with `contextIsolation: true` and `nodeIntegration: false`.
2. **Renderer Process (Chromium)**:
   - Executes UI animations, Canvas 2D eye rendering, Three.js WebGL graphics, and audio synthesis.
   - Communicates with the main process exclusively via Electron `ipcRenderer.invoke()` channels mapped in `desktop/preload.js`.
3. **Subprocess Workers (Python & PowerShell)**:
   - Spawned on demand via Node.js `child_process.spawn()` or `execFile()`.
   - Dedicated virtual environment (`.venv\Scripts\python.exe`) isolates Python dependencies from system installations.
   - Standard output communication uses structured JSON framing delimiters:
     ```text
     ---STARK_WORD_JSON_BEGIN---
     { "status": "SUCCESS", "documentPath": "...", "pages": 2 }
     ---STARK_WORD_JSON_END---
     ```

---

## 3. Communication Protocols

| Protocol | Transport | Endpoints | Purpose |
| :--- | :--- | :--- | :--- |
| **HTTP REST** | TCP / HTTP 1.1 | `/api/chat`, `/api/system/health`, `/api/tools/execute` | Command dispatch, system health queries, settings updates |
| **Server-Sent Events (SSE)** | Persistent HTTP | `/api/chat/stream`, `/api/agent/stream` | Token-by-token streaming of assistant thoughts and tool steps |
| **Electron IPC** | Native OS Pipes | `window:wake`, `window:sleep`, `window:fullscreen` | Window visibility toggling, system tray management |
| **Subprocess stdio** | Anonymous Pipes | Python & PowerShell sub-agents | Synchronous and asynchronous desktop action execution |

---

## 4. Multi-Tier Memory Subsystem

The memory architecture in `server/memoryManager.js` and `server/memory/` maintains conversational coherence across sessions:

1. **Working Memory**: In-memory turn buffer capturing active dialog, tool calls, and immediate execution results.
2. **Episodic Memory**: Recorded task outcomes and goal milestones stored in `data/vision_v13_memory_state.json`.
3. **Long-Term Memory**: Consolidated user preferences and verified facts with conflict detection.
4. **Prompt Injection Sanitization**: Context retrieved from memory is strictly wrapped inside non-executable XML boundary tags (`<memory_context> ... </memory_context>`) to prevent stored text from hijacking assistant execution.

---

## 5. Security & Isolation Architecture

1. **Permission Gate**: Every tool execution passes through `PermissionGate.evaluate()`, mapping requests against authorization Levels 0 through 4.
2. **Human-in-the-Loop Validation**: Sensitive actions (file deletion, message dispatch, code modification) are halted until an authorized cryptographic approval token is supplied.
3. **Zero Hardcoded Secrets**: Cloud keys are sourced strictly from environment variables (`.env`).
4. **Secret Scrubbing**: Regex filters automatically sanitize API keys and authorization tokens before writing to disk or emitting error logs.
