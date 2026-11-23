<div align="center">

  <img src="assets/portfolio_header.svg" alt="Lokesh Upadhyay — Portfolio Header" width="100%" />

  <br />

  <p align="center">
    <strong>Frontend Developer</strong> &nbsp;•&nbsp; 
    <strong>AI &amp; Machine Learning Developer</strong> &nbsp;•&nbsp; 
    <strong>Software Engineer</strong>
  </p>

  <p align="center">
    <em>Building intelligent systems and thoughtful digital experiences through software engineering, artificial intelligence, and modern frontend development.</em>
  </p>

  <p align="center">
    <a href="https://www.linkedin.com/in/lokesh-upadhyay-45b83a329">LinkedIn</a> &nbsp;•&nbsp;
    <a href="mailto:Upadhyaylokesh37@gmail.com">Email</a> &nbsp;•&nbsp;
    <a href="https://github.com/Lokeshcodex-rbg">GitHub</a>
  </p>

</div>

<br />

<img src="assets/gold_divider.svg" alt="Divider" width="100%" />

## 01 — Introduction

Welcome to my engineering portfolio. I am a software engineering and machine learning developer with a focus on building reliable full-stack applications, intelligent automation runtimes, and accessible web experiences.

My work centers on combining modern frontend design with rigorous backend engineering and machine learning architectures—translating complex algorithmic systems into intuitive, high-performance interfaces.

---

## 02 — About Me

I am a third-year undergraduate pursuing a **B.Tech in Computer and Communication Engineering** at **KJ Somaiya College of Engineering, Vidyavihar, Mumbai**.

My development philosophy is rooted in technical discipline, sound architecture, and end-to-end execution:
- **Systematic Foundations:** Grounding machine learning in verifiable mathematical and algorithmic principles rather than superficial wrapper APIs.
- **Design & User Experience:** Crafting accessible, responsive web interfaces with fluid component state management and clean typography.
- **Reliable Automation:** Building deterministic desktop runtimes with low-level OS interop and strict human-in-the-loop permission gates.
- **Collaborative Problem Solving:** Engineering real-world software solutions under competitive hackathon constraints to address practical operational challenges.

---

## 03 — Engineering Expertise

### Frontend Engineering
Building responsive, accessible web interfaces and reactive data consoles. Focused on modular component architecture, state machines, and modern styling:
- **Core Stack:** Next.js 15, React 18/19, TypeScript, Tailwind CSS (v3/v4), Framer Motion, Vite
- **Spatial GIS & Graphics:** Leaflet GIS map overlays, Three.js WebGL rendering, HTML5 Canvas 2D
- **Architecture:** React Server Components, custom hooks, accessible layouts, and mobile-first design

### Artificial Intelligence & Machine Learning
Developing foundational neural network architectures, subword tokenization, and time-series forecasting grounded in verifiable mathematics:
- **Foundation Models:** PyTorch, Custom Transformer decoder (~98.3M parameters, RoPE, Grouped-Query Attention 12:4, SwiGLU, RMSNorm)
- **Tokenization:** Custom Byte-BPE subword tokenizer (8,192 vocabulary with lossless UTF-8 bijection)
- **Applied ML:** XGBoost (clinical emergency triage), LSTM & Gradient Boosting (time-series hospital inflow forecasting)

### Systems Engineering & Backend
Engineering low-level operating system interop, headless browser automation, computer vision OCR, and microservices:
- **Automation & Interop:** Win32 API via Python `ctypes` (`SendInput`, window lifecycle), Microsoft Playwright, WinRT OCR
- **Backend Runtimes:** Node.js native HTTP, FastAPI, Express.js, Server-Sent Events (SSE), Socket.IO, Electron 45
- **Data & Storage:** PostgreSQL, MongoDB, PostGIS, In-Browser WASM Postgres (`@electric-sql/pglite`), `numpy.memmap`

---

## 04 — Selected Projects

### 01. VISION / JARVIS — Multi-Model AI Desktop Automation Assistant
*Python • PyTorch • JavaScript • Node.js • Electron • Win32 API • Playwright*

A unified desktop AI assistant integrating an independently developed foundation model with low-level Windows desktop automation:
- **VISION LLM**: Engineered an original ~98.3M-parameter decoder-only transformer in pure PyTorch featuring Rotary Positional Embeddings (RoPE), RMSNorm, Grouped-Query Attention (12:4 GQA), SwiGLU non-linearities, and a custom 8,192-vocab Byte-BPE tokenizer.
- **JARVIS Automation Engine**: Low-level Win32 automation via Python `ctypes` (`user32.dll` `SendInput`, window lifecycle management), Playwright headless browser control, and hardware-accelerated WinRT OCR.
- **Security Governance**: Implemented a multi-tier permission gate (Levels 0–4) requiring cryptographic human authorization for destructive file or system operations.

> **Implementation:** *Private Research & Desktop Automation Runtime • Full Architecture Specifications in [TECH_STACK.md](TECH_STACK.md)*

---

### 02. BrandTrace — Evidence-Driven Brand Compliance & Governance Platform
*Next.js 15 • React 19 • TypeScript • Tailwind CSS • Framer Motion • WASM Postgres (PGlite)*

*Developed for the Inkloom AI Challenge (Enterprise Review Workspace)*
- **Deterministic Rule Enforcement**: Instant evaluation of prohibited terminology, brand guidelines, and mandatory regulatory disclaimers.
- **3-State Claim Grounding**: Classifies content claims strictly as `SUPPORTED`, `CONFLICTS_WITH_SOURCE`, or `NO_APPROVED_SOURCE_FOUND` against verified corporate knowledge bases to eliminate hallucinations.
- **Cryptographic Version Immutability**: Review audits bind immutably to content revisions verified by SHA-256 cryptographic hashing.

> **Platform Status:** *Private Enterprise Build (Inkloom AI Challenge Round 2 Submission) • Verified Implementation Specs in [TECH_STACK.md](TECH_STACK.md)*

---

### 03. Surge Shield — Agentic AI Hospital Surge Forecasting & Autonomous Response
*Next.js • TypeScript • FastAPI • Python • MongoDB • LSTM • Gradient Boosting • Agentic AI*

*Ranked among Top 100 Teams at Mumbai Hacks 2025 (Organized by TEAM — Tech Entrepreneurs Association of Mumbai)*
- **Predictive Healthcare Inflow**: Forecasts emergency department patient admissions 7–30 days in advance by correlating historical admission logs with live weather and environmental pollution trends.
- **Autonomous Operations Engine**: Translates predictive influx spikes into actionable hospital mitigation plans—optimizing nurse-to-patient staffing ratios, ICU bed reallocations, and pharmaceutical inventory staging.
- **Full-Stack Architecture**: Clean decoupling between a modern Next.js client interface and a high-performance asynchronous FastAPI prediction backend.

[`Explore Repository →`](https://github.com/shubhsrii/Surge-Shield)

---

### 04. OpsBrain — Industrial Knowledge Intelligence & Operations Copilot
*HTML5 Canvas • Modular JavaScript • CSS3 • Node.js • Express • Knowledge Graphs*

*Unified Industrial Asset Intelligence & Diagnostic Prototype*
- **Semantic Asset Graph**: Models complex machine hierarchies connecting parent production lines, PLCs, downline sensory arrays, and operating parameters.
- **Root-Cause Telemetry Diagnostics**: Real-time anomaly mapping across vibration, thermal, and pressure sensors against manufacturer tolerances and historical failure modes.
- **Operations Copilot & CAPA**: Interactive operator command center with source-cited diagnostic steps and corrective action workflows.

[`Explore Repository →`](https://github.com/Lokeshcodex-rbg/ETH)

---

### 05. JeevanSetu — AI-Assisted Emergency Healthcare Coordination
*React • Vite PWA • Node.js • Express • FastAPI • XGBoost • Socket.IO • Leaflet GIS • OSRM*

An integrated emergency dispatch and hospital routing ecosystem:
- **ML Triage Engine**: XGBoost microservice assessing patient severity indicators to compute priority triage tiers and capacity-weighted hospital recommendations.
- **Live Dispatch Telemetry**: Real-time ambulance tracking, spatial route visualization via Leaflet GIS, and dynamic ETA calculation via Open Source Routing Machine (OSRM) road network graphs.

> **System Status:** *Collaborative Emergency Dispatch Prototype • Complete Architecture Documented in [TECH_STACK.md](TECH_STACK.md)*

---

### 06. MEDVAULT AI — Clinical Document Intelligence & Medical Record System
*Python • Tesseract 5 OCR • OpenCV • Pandas • Regex Clinical Extraction*

*B.Tech Engineering Mini-Project Demonstration Build*
- **Multi-Branch Ingestion**: Automated text extraction combining native PDF parsing with OpenCV-preprocessed Tesseract 5 OCR for physical, degraded lab reports.
- **Longitudinal Analyte Tracking**: Structured extraction of clinical analytes (HbA1c, lipid profiles, thyroid panels), reference units, and historical trend trajectories across isolated family sub-vaults.

> **System Status:** *Applied Computer Vision & Clinical NLP Demonstration Build • Technical Specifications in [TECH_STACK.md](TECH_STACK.md)*

---

## 05 — Hackathons & Achievements

### Competitive Honors

- **Mumbai Hacks 2025 — Top 100 Teams**  
  *Tech Entrepreneurs Association of Mumbai (TEAM) • Agentic AI & Healthcare Technology*  
  Built **Surge Shield**, an agentic AI-powered hospital admission surge forecasting and emergency response platform. Selected and ranked among the Top 100 teams from 20,000+ national and international participants.

- **Smart India Hackathon (SIH) — Internal Round Selection**  
  *Ministry of Education & Institutional Committee • Software & Systems Innovation*  
  Selected for the institutional internal round following competitive departmental evaluation for automated emergency triage and resource dispatch systems.

### Additional Competitive Hackathons
- **ET AI Hackathon 2.0** — *The Economic Times* (August 2026) • Applied AI & Automation
- **Adobe University Hackathon** — *Adobe* (August 2026) • Digital Experience & Modern Web Systems
- **i-Hack Gaming Hackathon (E-Summit '25)** — *IIT Bombay* (January 2026) • Real-Time Systems & Canvas Graphics
- **TechSprint Hackathon** — *Google Developers Group* (January 2026) • Cloud Architecture & Web Platforms
- **Convolve 3.0 (Pan IIT AI/ML Hackathon)** — *IIT Guwahati* (February 2025) • Deep Learning & Algorithmic Problem Solving

---

## 06 — Technology Stack

All technical skills listed below are grounded in working code repositories and dependency manifests:

### Core Programming Languages
- **Primary:** Python (3.11 / 3.12), TypeScript, JavaScript (ES2022+)
- **Systems & Coursework:** Java (Enterprise coursework), C++, PowerShell, SQL

### Frontend Development
- **Frameworks & UI:** Next.js 15, React 18/19, Tailwind CSS (v3 / v4), Vite
- **Motion & Visualization:** Framer Motion, Leaflet GIS, Three.js (WebGL), HTML5 Canvas 2D

### Backend & Systems Automation
- **Runtimes & Frameworks:** Node.js, FastAPI, Express.js, Socket.IO, Server-Sent Events (SSE), Electron 45
- **OS Automation & Vision:** Win32 API via Python `ctypes`, Microsoft Playwright, Windows Runtime (WinRT) OCR, OpenCV, Tesseract 5

### Databases & Storage
- **Relational & Document:** PostgreSQL, PostGIS, MongoDB
- **Embedded & Training Storage:** In-Browser WASM Postgres (`@electric-sql/pglite`), memory-mapped binary arrays (`numpy.memmap`), JSON/JSONL

### Artificial Intelligence & Machine Learning
- **Implemented Architecture:** PyTorch, Custom Transformer decoder (~98.3M parameters, RoPE, 12:4 GQA, SwiGLU, RMSNorm), Byte-BPE (8,192 vocab), XGBoost, LSTM, Scikit-Learn
- **Experimental & Evaluation:** Multi-step relational reasoning evaluator, AST functional execution gates
- **Optional Cloud Integrations:** Google Gemini REST API (fallback reasoning & SSE streaming)
- **Planned Research:** Multimodal tokenization & distributed GPU scaling

### Developer Tooling & Environments
- Git, GitHub Actions, Docker & Docker Compose, Linux/Windows Subsystems, VS Code, Markdownlint

*Detailed file evidence and AST verification mappings are recorded in [TECH_STACK.md](TECH_STACK.md).*

---

## 07 — Certifications & Professional Development

*Structured virtual job simulations demonstrating enterprise task competency, microservice testing, and analytical problem-solving:*

- **J.P. Morgan — Software Engineering Job Simulation** (Forage, September 2025)  
  *Enterprise Java, Spring Boot microservices, financial transaction data structures, and unit testing.*
- **J.P. Morgan — Investment Banking Job Simulation** (Forage, September 2025)  
  *Financial modeling, corporate valuation metrics, M&A transaction rationale, and equity performance analysis.*
- **Deloitte — Data Analytics Job Simulation** (Forage, May 2026)  
  *Exploratory data analysis (EDA), business intelligence visualization, and client insight reporting.*
- **Quantium — Data Analytics Job Simulation** (Forage, April 2026)  
  *Retail customer transaction analytics, statistical benchmarking, and commercial data modeling.*

*Detailed verification records and coursework context are documented in [CREDENTIALS.md](CREDENTIALS.md).*

---

## 08 — Academic Background

- **Institution:** KJ Somaiya College of Engineering, Vidyavihar, Mumbai
- **Degree:** Bachelor of Technology (B.Tech) in Computer and Communication Engineering (Third Year)
- **Relevant Coursework:** Data Structures & Algorithms, Operating Systems, Database Management Systems, Computer Networks, Artificial Intelligence, Machine Learning, Object-Oriented Programming (Java/C++), Software Engineering.

---

## 09 — Connect

- **GitHub:** [@Lokeshcodex-rbg](https://github.com/Lokeshcodex-rbg)
- **LinkedIn:** [Lokesh Upadhyay](https://www.linkedin.com/in/lokesh-upadhyay-45b83a329)
- **Email:** [Upadhyaylokesh37@gmail.com](mailto:Upadhyaylokesh37@gmail.com)
- **Location:** Mumbai, India

---

<div align="center">
  <sub>Designed with precision. Grounded in verified engineering.</sub>
</div>
