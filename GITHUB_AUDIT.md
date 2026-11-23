# Comprehensive GitHub & Engineering Portfolio Audit

> **Target Profile:** [@Lokeshcodex-rbg](https://github.com/Lokeshcodex-rbg)  
> **Auditor:** Senior Portfolio Architect & Technical Recruiter  
> **Audit Date:** November 23, 2026  
> **Methodology:** Direct inspection of the GitHub REST API, repository commit trees, local project directories on disk, package manifests (`package.json`, `requirements.txt`), and AST import graphs. Zero fabricated metrics or unverified claims.

---

## 1. Executive Summary

Lokesh Upadhyay is an undergraduate engineering student pursuing a B.Tech in Computer and Communication Engineering. The portfolio assessment reveals substantial technical depth across three distinct engineering verticals:

1. **Frontend & Systems Engineering**: Production Next.js 15 and React 19 development with TypeScript, Tailwind CSS, Framer Motion, in-browser WASM PostgreSQL, and responsive PWA architectures (`BrandTrace`, `JeevanSetu`, `OpsBrain`).
2. **Artificial Intelligence & Systems ML**: Pure PyTorch foundational transformer development (`VISION LLM` ~98.3M parameters with RoPE, GQA, RMSNorm, SwiGLU, and custom Byte-BPE tokenization), agentic healthcare surge forecasting (`Surge Shield` — Mumbai Hacks Finalist among 20,000+ participants), and XGBoost clinical triage microservices (`JeevanSetu`).
3. **Desktop Automation & Applied Software Engineering**: Low-level Win32 interop via Python `ctypes`, Microsoft Playwright headless browser control, Windows Runtime (WinRT) hardware OCR, and pure-Python OpenXML/PDF document generation engines (`JARVIS`).

### Primary Portfolio Deficits Prior to Audit
- **Under-Representation of Frontend Work**: Enterprise frontend systems such as `BrandTrace` were held in a private repository, leaving the public GitHub profile skewed toward unfinished or mislabeled data repositories.
- **Obscure Repository Naming**: The repository `ETH` actually contains a complete industrial operations prototype named **OpsBrain**, but is completely unindexed and unsearchable due to the misleading name and empty description.
- **Missing GitHub Profile Overview**: The special profile repository `Lokeshcodex-rbg/Lokeshcodex-rbg` has not yet been initialized, leaving visitors with an uncurated default repository feed.
- **Outdated Virtual Internship Forks**: Repositories such as `Shiptivitas` and `forage-midas` occupy top-level visual weight despite being completed exploratory coursework.

---

## 2. Complete Repository Census & Technical Inventory

| Project / Repository | Current Visibility | Primary Languages | Verified Tech Stack | Last Updated | README State | Functional Status | Security / Secret Risk | Classification | Strategic Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **VISION / JARVIS** (`D:\Jarvis`) | Local / Staged | JavaScript, Python 3.12, HTML5/CSS3, PowerShell | PyTorch 2.15.0+cpu, Google Gemini REST (SSE), Win32 `ctypes`, Playwright, WinRT OCR, Electron 45 | Nov 2026 | Excellent (Standardized 18 sections, Mermaid diagram, architecture specs) | Fully Tested & Operational | Clean. `.env` and checkpoints strictly gitignored. | **Featured Project (Priority #1)** | Publish publicly to `vision-jarvis`. |
| **BrandTrace** (`Lokeshcodex-rbg/BrandTrace`, `D:\BrandTrace`) | Private on GitHub | TypeScript, JavaScript | Next.js 15, React, TypeScript, Tailwind CSS, SHA-256 Version Immutability, 3-State Claim Verifier | 2026 | High (Clean problem statement, enterprise governance focus) | Complete (Inkloom AI Challenge Submission) | Clean. Ensure `.env.local` remains uncommitted. | **Featured Project (Priority #2)** | **Recommend making Public** to showcase production Next.js 15 & TypeScript skills. |
| **Surge Shield** (`shubhsrii/Surge-Shield`) | Public (Collab) | TypeScript, Python | Next.js, FastAPI, Python, MongoDB, LSTM, Gradient Boosting, Agentic AI | Dec 2025 | Functional Hackathon Documentation (PPT link, run steps) | Mumbai Hacks Finalist Prototype | **Warning:** Public README contains hardcoded OpenWeather API key. Recommend rotation. | **Featured Project (Priority #3)** | Feature prominently as collaborative healthcare AI system. |
| **BrandTrace** (`Lokeshcodex-rbg/BrandTrace`, `D:\BrandTrace`) | Private on GitHub | TypeScript, JavaScript | Next.js 15, React, TypeScript, Tailwind CSS, SHA-256 Version Immutability, 3-State Claim Verifier | 2026 | High (Clean problem statement, enterprise governance focus) | Complete (Inkloom AI Challenge Submission) | Clean. Ensure `.env.local` remains uncommitted. | **Featured Project (Full-Stack / Governance)** | **Recommend making Public** to showcase production Next.js 15 & TypeScript skills. |
| **JeevanSetu** (`shubhshrii/JeevanSetu`, `D:\JeevanSetu-v7-fixes`) | Public (Collab) | TypeScript, JavaScript, Python | React + Vite PWA, Node.js + Express, Socket.IO, FastAPI + XGBoost (triage & ranking), OSRM | 2026 | High (System architecture, triage microservices, routing APIs) | Functional Emergency Dispatch Prototype | **Warning:** Firebase Admin SDK private key exists on local disk root (`D:\`). Ensure it is never pushed. | **Featured Project (Healthcare Systems)** | Feature as core team engineering project. |
| **MEDVAULT AI** (`D:\medvault\medvault`) | Local Project | Python | Tesseract 5 OCR, OpenCV, Pandas, Regex Clinical Lexicon, Multi-Branch PDF extraction | 2026 | High (B.Tech mini-project demonstration build, clinical taxonomy) | Complete Demonstration Build | Clean. Uses local synthetic clinical reports. | **Academic / Applied Engineering** | Initialize git and publish to GitHub as an applied computer vision / document intelligence project. |
| **ETH** (`Lokeshcodex-rbg/ETH`) | Public on GitHub | JavaScript (63%), CSS (20%), HTML (9%), Python (8%) | Node.js, Express, HTML5/CSS3, Python ingestion, pitch deck, architecture documentation | Jul 2026 | Moderate (Inner project `outputs/industrial-knowledge-brain` is documented; root is empty) | Functional Prototype (`OpsBrain`) | Clean. | **Experiments / Research** | **Rename repository** to `OpsBrain` or `industrial-knowledge-brain`. Move inner app to root; update description and topics. |
| **stock-analysis-dashboard** (`Lokeshcodex-rbg/stock-analysis-dashboard`) | Public on GitHub | Jupyter Notebook (100%) | Python, Pandas, yfinance, Plotly, Beautiful Soup (web scraping) | Mar 2026 | Low (1-line description only) | Complete Notebook Analysis | Clean. | **Academic / Data Analytics** | Update README with visual Plotly graphs, methodology, and financial KPI definitions. |
| **Cosmetic-Dataset** (`Lokeshcodex-rbg/Cosmetic-Dataset`) | Public on GitHub | Tableau, Power BI, Word | Tableau Workbook (`.twb`), Power BI Report (`.pbix`), Data Visualization Honours Coursework | Jun 2026 | Low (Brief dataset summary) | Academic Coursework | Clean. | **Academic / Business Intelligence** | Update description & README to showcase as an "Academic Data Visualization & Business Intelligence Case Study (Tableau & Power BI)". |
| **Shiptivitas** (`Lokeshcodex-rbg/Shiptivitas`) | Public on GitHub | JavaScript, HTML, CSS | React, Node.js (InsideSherpa / Forage YC Startup program) | Mar 2026 | Standard template | Completed Virtual Experience | Outdated default branch (`dependabot/...`). | **Outdated / Unmaintained** | Fix default branch to `master` and **Archive / set to Private**. |
| **forage-midas** (`Lokeshcodex-rbg/forage-midas`) | Public Fork on GitHub | Java | Spring Boot, Maven, Java 17 (JPMC Advanced Software Engineering Forage) | Aug 2024 | Standard template | Completed Virtual Experience Fork | Clean. | **Academic / Coursework Fork** | Keep public or archive to demonstrate enterprise Java / Spring Boot foundational training. |

---

## 3. Detailed Subsystem Analysis

### 3.1 Frontend Engineering Capabilities
The frontend capabilities across Lokesh's codebase are modern and sophisticated:
- **Next.js 15 & React 19 Ecosystem**: `BrandTrace` demonstrates mastery of modern React 19 Server Components, in-browser WASM database execution (`@electric-sql/pglite`), and responsive layout systems.
- **Interactive Visualizations & Telemetry**: `OpsBrain` implements interactive knowledge graph telemetry and operations dashboards, while `JARVIS` features procedural 60fps canvas visualizers and Three.js WebGL rendering.
- **Design Systems & Modern UI**: High-fidelity Tailwind CSS implementations with Framer Motion transitions, responsive mobile layouts, and accessible component hierarchies.

### 3.2 Artificial Intelligence & Machine Learning
- **PyTorch Foundation Architecture**: In `ml_foundation/model.py`, Lokesh has engineered a 14-layer decoder transformer utilizing modern architectural primitives: RoPE positional embeddings, Grouped-Query Attention (12 query heads, 4 key-value heads), SwiGLU non-linearities, and RMSNorm pre-normalization.
- **Tokenizer Engineering**: Custom Byte-BPE implementation (`ml_foundation/tokenizer.py`) providing deterministic UTF-8 byte-to-code mapping that preserves English identifiers, Devanagari Hindi characters, and code indentation.
- **Applied Machine Learning & Forecasting**: In `Surge Shield` (LSTM and gradient boosting for time-series hospital capacity forecasting) and `JeevanSetu` (XGBoost triage classification microservice), showing practical ML applied to real-world operational bottlenecks.

### 3.3 Systems & Desktop Automation
- **Win32 OS Interop**: Direct invocation of Windows user32/kernel32 APIs via Python `ctypes` (`SendInput`, `EnumWindows`, `SetForegroundWindow`, `SetProcessDpiAwareness`), avoiding fragile third-party wrapper dependencies.
- **Headless Browser Control**: Microsoft Playwright automation in `server/browser/browserAutomationEngine.js` for Chromium-based structured web data extraction.
- **Defensive Security Governance**: Multi-tier permission gate (Levels 0–4) enforcing human authorization for irreversible actions (file deletion outside scratch, external communication).

---

## 4. Security Findings & Immediate Remediation

1. **Local Disk Firebase Admin Key**:
   - `D:\jeevansetu-2026-firebase-adminsdk-fbsvc-53d3b4919a.json` is located in the root of drive `D:\`.
   - **Remediation**: Confirm that this private key is never staged or committed into any git repository. Add `*firebase-adminsdk*.json` to global `~/.gitignore`.
2. **Local Payment Gateway Credentials**:
   - `D:\Cosmetic\razorpay_test_api_keys_1783955222669.csv` contains test Razorpay API keys.
   - **Remediation**: Ensure this file remains outside all version-controlled directories.
3. **Public Repository API Key in Surge-Shield README**:
   - `shubhsrii/Surge-Shield` currently displays an OpenWeather API key directly in its public `README.md`.
   - **Remediation**: Advise teammate Shubh Srivastava to rotate this key and move it to a private `.env` file.
4. **Gitignore Standards**:
   - Verified that `D:\Jarvis\.gitignore` and `D:\BrandTrace\.gitignore` properly exclude `.env`, `.env.local`, and model weights (`*.pt`, `*.bin`).

---

## 5. Strategic Categorization & Public Portfolio Blueprint

### Tier 1: Primary Featured Repositories (Profile Pins)
1. **VISION / JARVIS**: AI Assistant & Windows Desktop Automation Engine (~100M PyTorch LLM + Gemini REST + Win32/Playwright).
2. **BrandTrace**: Evidence-Driven Brand Compliance & Content Quality Assurance Platform (Next.js 15, React 19, TypeScript, WASM Postgres).
3. **Surge Shield**: Agentic AI Hospital Surge Forecasting & Response System (Mumbai Hacks Finalist — Next.js, FastAPI, LSTM, Gradient Boosting).
4. **OpsBrain**: Industrial Knowledge Intelligence & Operations Dashboard (Modular JavaScript, Node.js, Knowledge Graphs).
5. **JeevanSetu**: AI-Assisted Emergency Healthcare Coordination Platform (React PWA, Node.js, FastAPI + XGBoost, OSRM).
6. **MEDVAULT AI**: Clinical Document Intelligence & Longitudinal Record System (Python, Tesseract 5 OCR, OpenCV).

### Tier 2: Specialized Secondary Repositories (Kept Public)
- **stock-analysis-dashboard**: Python & Plotly financial analytics dashboard (with upgraded README).
- **Cosmetic-Dataset**: Academic Data Visualization & Business Intelligence case study (Tableau & Power BI).

### Tier 3: Candidates for Archival / Private Storage
- **Shiptivitas**: Completed YC startup virtual internship task (fix default branch and archive).
- **forage-midas**: JPMC Java Spring Boot virtual internship fork (archive to keep profile focused on original projects).
