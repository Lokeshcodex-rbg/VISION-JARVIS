# Verified Engineering Technology Stack Inventory

> **Classification:** Engineering Inventory & Verification Manifest  
> **Developer:** Lokesh Upadhyay  
> **Scope:** Cross-project technical stack covering **VISION / JARVIS**, **BrandTrace**, **Surge Shield**, **OpsBrain**, **JeevanSetu**, and **MEDVAULT AI**.  
> **Grounding Standard:** Every technology listed is verified against implementation source code, dependency manifests (`package.json`, `requirements.txt`), or direct AST import verification.

---

## 1. Frontend Engineering & Visual Systems

| Technology | Purpose & Implementation | Verification Source | Status |
| :--- | :--- | :--- | :---: |
| **Next.js (v15)** | App Router, Server Components, enterprise compliance review console | `BrandTrace/package.json`, `Surge-Shield/frontend` | Verified Implemented |
| **React (v18 / v19)** | Declarative component architecture, interactive state hooks, PWA views | `BrandTrace/package.json`, `JeevanSetu/frontend` | Verified Implemented |
| **TypeScript** | Strict compile-time type safety, interface definitions, API contracts | `BrandTrace/tsconfig.json`, `JeevanSetu/frontend` | Verified Implemented |
| **Three.js (WebGL)** | 3D mesh rendering, procedural point-cloud cortical hemispheres, filaments | `vision-jarvis/js/libs/three.module.js`, `brain3DVisualizer.js` | Verified Implemented |
| **Framer Motion** | Micro-interactions, spring physics, modal overlays, smooth transitions | `BrandTrace/package.json` (`framer-motion: ^14.9.1`) | Verified Implemented |
| **Tailwind CSS** | Utility-first responsive design, modern dark themes, backdrop blur filters | `BrandTrace/src/app/globals.css`, `JeevanSetu/frontend` | Verified Implemented |
| **Leaflet & React-Leaflet** | Interactive geospatial map tiles, ambulance GPS breadcrumbs, route rendering | `JeevanSetu/frontend/package.json` (`leaflet: ^1.9.4`) | Verified Implemented |
| **HTML5 Canvas 2D** | Procedural 60fps visualizer, dynamic geometry, eye dilation shaders | `vision-jarvis/js/eye.js`, `OpsBrain/styles.css` | Verified Implemented |
| **Modular JavaScript (ES2022+)** | Native ES modules, custom DOM state machines, zero-framework lightweight UI | `vision-jarvis/js/app.js`, `vision-jarvis/server.js`, `OpsBrain/app.js` | Verified Implemented |

---

## 2. Artificial Intelligence & Machine Learning

| Technology | Purpose & Implementation | Verification Source | Status |
| :--- | :--- | :--- | :---: |
| **PyTorch (`torch`)** | Foundational transformer model architecture, attention heads, training loops | `vision-jarvis/ml_foundation/model.py`, `trainer.py`, `inference.py` | Verified Implemented |
| **Custom Transformer (RoPE, GQA, SwiGLU, RMSNorm)** | ~98.3M-parameter decoder-only foundation language model architecture | `vision-jarvis/ml_foundation/model.py` (`JarvisUnifiedTransformer`) | Verified Implemented |
| **Byte-BPE Tokenizer (`JarvisBPE`)** | 8,192-vocab subword tokenizer with lossless UTF-8 bijection and Devanagari support | `vision-jarvis/ml_foundation/tokenizer.py` (`_V2_PRETOKENIZE_RE`) | Verified Implemented |
| **XGBoost** | Emergency clinical triage severity classification and hospital capacity ranking | `JeevanSetu/mlservice/requirements.txt` | Verified Implemented |
| **LSTM & Gradient Boosting** | 7–30 day predictive hospital admission surge forecasting based on pollution and seasonal trends | `Surge-Shield/backend/requirements.txt`, `Surge-Shield/backend/models` | Verified Implemented |
| **Google Gemini REST API** | Cloud teacher model, complex reasoning fallback, and streaming function calling | `vision-jarvis/server/aiProviderAdapter.js` (direct HTTPS REST to Gemini API) | Verified Implemented |
| **SymPy** | Symbolic calculus, algebraic equation derivation, mathematical probe validation | `vision-jarvis/server/science/python_science_bridge.py`, `evaluator.py` | Verified Implemented |
| **Scikit-Learn** | Classical regression, classification benchmarks, dataset metrics, train/test splitting | `vision-jarvis/server/science/python_science_bridge.py`, `Surge-Shield/backend` | Verified Implemented |
| **SciPy** | Numerical integration, ODE solvers, optimization algorithms, signal processing | `vision-jarvis/server/science/python_science_bridge.py` | Verified Implemented |
| **MediaPipe Tasks Vision** | WebAssembly and local bundle for real-time webcam hand tracking & gesture recognition | `vision-jarvis/js/modules/handTrackingEngine.js` | Verified Implemented |
| **OpenCV (`opencv-python`)** | Image preprocessing (thresholding, deskewing, noise filtering) and screen frame capture | `vision-jarvis/server/vision/python_vision_bridge.py`, `medvault-ai/backend` | Verified Implemented |
| **Tesseract 5 OCR (`pytesseract`)** | Optical character recognition on scanned diagnostic lab reports and medical printouts | `medvault-ai/backend/ocr_engine.py`, `inspect_word_evidence.py` | Verified Implemented |

---

## 3. Backend Engineering & APIs

| Technology | Purpose & Implementation | Verification Source | Status |
| :--- | :--- | :--- | :---: |
| **FastAPI** | High-performance asynchronous Python backend services for ML inference | `Surge-Shield/backend/main.py`, `JeevanSetu/mlservice` | Verified Implemented |
| **Node.js Native HTTP** | Zero-framework native HTTP server, REST routing, static asset delivery, rate limiting | `vision-jarvis/server.js` (`http.createServer()`) | Verified Implemented |
| **Express.js** | Backend orchestration API for patient triage, hospital routing, and authentication | `JeevanSetu/backend/package.json`, `OpsBrain/backend` | Verified Implemented |
| **Server-Sent Events (SSE)** | Low-latency token-by-token streaming from assistant to frontend over persistent HTTP | `vision-jarvis/server.js` (`/api/chat/stream`, `/api/agent/stream`) | Verified Implemented |
| **Socket.IO** | Real-time bi-directional telemetry for live ambulance dispatch and tracking | `JeevanSetu/backend/package.json`, `JeevanSetu/frontend/package.json` | Verified Implemented |
| **OSRM (Road Routing)** | Road network distance calculations, shortest path travel times for ambulance dispatch | `JeevanSetu/backend/services/osrmService.js` | Verified Implemented |

---

## 4. Desktop & Systems Automation

| Technology | Purpose & Implementation | Verification Source | Status |
| :--- | :--- | :--- | :---: |
| **Win32 API via Python `ctypes`** | Synthetic `SendInput`, `mouse_event`, `EnumWindows`, `SetProcessDpiAwareness(2)` | `vision-jarvis/agent/desktop_automation.py`, `whatsapp_automator.py` | Verified Implemented |
| **Microsoft Playwright** | Headless Chromium automation for deep web research, article extraction, DOM scraping | `vision-jarvis/server/browser/browserAutomationEngine.js` | Verified Implemented |
| **Windows Runtime (WinRT) OCR** | Hardware-accelerated local Windows OCR via `Windows.Media.Ocr.OcrEngine` | `vision-jarvis/server/desktop/windows_ocr.ps1` | Verified Implemented |
| **Pure-Python OpenXML Generator** | Standards-compliant Word (.docx) and Excel (.xlsx) generation with zero 3P dependencies | `vision-jarvis/agent/docx_generator.py`, `agent/excel_generator.py` | Verified Implemented |
| **Pure-Python PDF 1.4 Generator** | Stream-compressed PDF generation using Python `zlib` with zero 3P dependencies | `vision-jarvis/agent/pdf_generator.py` | Verified Implemented |
| **PowerShell COM Automation** | Programmatic attachment to running Microsoft Word instances for document editing | `vision-jarvis/server/desktop/word_automator.ps1` | Verified Implemented |
| **Electron 45** | Windows desktop application shell, system tray integration, global keyboard shortcuts | `vision-jarvis/desktop/main.js`, `desktop/preload.js` | Verified Implemented |
| **Web Speech API** | In-browser speech recognition and dual-voice acoustic synthesis | `vision-jarvis/js/modules/voiceInputEngine.js` | Verified Implemented |

---

## 5. Databases & Storage Systems

| Technology | Purpose & Implementation | Verification Source | Status |
| :--- | :--- | :--- | :---: |
| **MongoDB** | Document store for hospital bed capacity, surge records, and incident histories | `Surge-Shield/backend/requirements.txt` (`pymongo`, `motor`) | Verified Implemented |
| **PostgreSQL / PostGIS** | Relational spatial database for hospital geospatial coordinates and ambulance tracking | `JeevanSetu/docker-compose.yml` | Verified Implemented |
| **WASM In-Browser Postgres (`@electric-sql/pglite`)** | Client-side embedded relational database for instant offline rule evaluation | `BrandTrace/package.json` | Verified Implemented |
| **Memory-Mapped Binary Shards** | High-throughput zero-copy token array streaming (`numpy.memmap`) for LLM training | `vision-jarvis/ml_foundation/data_pipeline.py` | Verified Implemented |
| **Flat-File JSON / JSONL** | Multi-turn conversational memory, task checkpoints, SHA-256 chained audit logs | `vision-jarvis/data/memory/*.json`, `data/audit_trail.jsonl` | Verified Implemented |
| **Browser `localStorage`** | Client-side user preferences, active personality states, HUD visibility flags | `vision-jarvis/js/app.js` | Verified Implemented |

---

## 6. Developer Tools & DevOps

| Technology | Purpose & Implementation | Verification Source | Status |
| :--- | :--- | :--- | :---: |
| **Git & GitHub** | Source code version control, feature branches, multi-contributor pull requests | Git repositories and commit trees | Verified Implemented |
| **Docker & Docker Compose** | Containerized deployment for multi-service architectures (Node + FastAPI + Postgres) | `JeevanSetu/docker-compose.yml` | Verified Implemented |
| **Vite** | Modern frontend build tooling and hot module reloading (HMR) for React PWAs | `JeevanSetu/frontend/vite.config.ts` | Verified Implemented |
| **npm & Python venv** | Package management across JavaScript ecosystems and isolated Python environments | `package.json`, `requirements.txt`, `.venv` | Verified Implemented |
| **Markdownlint** | Compliance and formatting validation for developer specifications and technical reports | Project markdown documentation | Verified Implemented |
