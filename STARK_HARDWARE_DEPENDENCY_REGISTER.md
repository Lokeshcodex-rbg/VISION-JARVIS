# STARK AI — HARDWARE & EXTERNAL DEPENDENCY REGISTER

**Directive Compliance:** Non-Negotiable Engineering Rules 3, 4, 7, 13, and 14  
**Date:** 2026-10-27

---

## 1. GROUNDING CLASSIFICATION CRITERIA

Every capability in STARK AI is explicitly classified under one of four grounded tiers:

1. **`IMPLEMENTED_SOFTWARE`**: Pure deterministic software running locally on CPU/RAM, verified by automated unit and integration tests.
2. **`SIMULATED_RESULTS`**: Numerical, kinematic, physical, and aerodynamic solvers that produce simulated models rather than physical hardware actuation.
3. **`EXTERNALLY_VERIFIED`**: Capabilities fetching real-time data from verified external network endpoints with source attribution.
4. **`PHYSICALLY_TESTED`**: Operations executing on verified host operating-system kernel handles, real hardware sensors, or local devices.

---

## 2. EXHAUSTIVE CAPABILITY DEPENDENCY REGISTER

| Subsystem / Capability | Grounding Tier | Operational Status | Local Fallback Behavior | Physical Hardware / Service Needed |
| :--- | :---: | :---: | :--- | :--- |
| **Global Emergency Stop** | `IMPLEMENTED_SOFTWARE` | **VERIFIED_OPERATIONAL** | Synchronously halts local audio in <1ms without network | None (Local CPU/RAM) |
| **Space-Bar E-Stop Shortcut** | `PHYSICALLY_TESTED` | **VERIFIED_OPERATIONAL** | Checks input focus; activates local latch | Standard keyboard |
| **Windows App Launching** | `PHYSICALLY_TESTED` | **VERIFIED_OPERATIONAL** | Pre-cached registry + window handle focus | Windows 10/11 Desktop |
| **File Creation & SHA-256** | `PHYSICALLY_TESTED` | **VERIFIED_OPERATIONAL** | Read-back verification and hash checking | Local NTFS SSD/HDD |
| **Plugin Extension Framework** | `IMPLEMENTED_SOFTWARE` | **VERIFIED_OPERATIONAL** | Sandboxed execution with timeout & safety gate | Local Node.js runtime |
| **Scientific Math & ODEs** | `SIMULATED_RESULTS` | **VERIFIED_OPERATIONAL** | Built-in native JS RK4 & matrix solvers | None (CPU) |
| **Beam Structural Analysis** | `SIMULATED_RESULTS` | **VERIFIED_OPERATIONAL** | Euler-Bernoulli analytical solver | None (CPU) |
| **Robotic DH Kinematics** | `SIMULATED_RESULTS` | **VERIFIED_OPERATIONAL** | Closed-form homogenous 4x4 matrix transforms | None (CPU) |
| **Actuator Motor Sizing** | `SIMULATED_RESULTS` | **VERIFIED_OPERATIONAL** | Gravity + inertial dynamic torque modeling | None (CPU) |
| **OpenSCAD CAD Code Gen** | `IMPLEMENTED_SOFTWARE` | **VERIFIED_OPERATIONAL** | Outputs clean parametric .scad scripts | OpenSCAD CLI (optional for rendering) |
| **Embedded Firmware Gen** | `IMPLEMENTED_SOFTWARE` | **VERIFIED_OPERATIONAL** | Ready-to-compile C++/Arduino code with E-Stop ISR | PlatformIO / Arduino IDE (for flashing) |
| **Multi-Agent Orchestrator** | `IMPLEMENTED_SOFTWARE` | **VERIFIED_OPERATIONAL** | 9 specialist agents with consensus synthesis | None (CPU) |
| **ArXiv Scholarly Research** | `EXTERNALLY_VERIFIED` | **VERIFIED_OPERATIONAL** | Public export.arxiv.org API | Internet connection |
| **DuckDuckGo Web Search** | `EXTERNALLY_VERIFIED` | **VERIFIED_OPERATIONAL** | Zero-key html.duckduckgo.com scraping | Internet connection |
| **Physical Microphone Audio** | `PHYSICALLY_TESTED` | **VERIFIED_OPERATIONAL** | Web Audio API volume VAD thresholding | Real microphone device |
| **Physical Camera Hardware** | `PHYSICALLY_TESTED` | **DEPENDENCY_MISSING** | Emits missing device warning; accepts image files | USB / Integrated Webcam |
| **Physical Motor Actuators** | `PHYSICALLY_TESTED` | **UNAVAILABLE / BLOCKED** | Blocked by safety gate without verified interlock | Physical servo/BLDC motor controller |
| **Cloud LLM (Gemini/OpenRouter)** | `EXTERNALLY_VERIFIED` | **VERIFIED_OPERATIONAL** | Local instant routing (time, hardware, math) | API Keys in `.env` |
| **Local LLM (Ollama/llama.cpp)** | `IMPLEMENTED_SOFTWARE` | **DEGRADED (NOT RUNNING)** | Falls back to cloud API or local deterministic | Local Ollama running on port 11434 |
| **macOS Native Platform** | `IMPLEMENTED_SOFTWARE` | **UNAVAILABLE ON WIN32** | Truthfully reports `UNAVAILABLE` on Windows | Physical Mac hardware / macOS runner |
| **Linux Native Platform** | `IMPLEMENTED_SOFTWARE` | **UNAVAILABLE ON WIN32** | Truthfully reports `UNAVAILABLE` on Windows | Physical Linux machine / Linux runner |
| **eVTOL / Flight Suit Model** | `SIMULATED_RESULTS` | **SIMULATION ONLY** | Strict non-flight warning displayed | Physical drone test lab (not ready) |

---

## 3. PHYSICAL SAFETY INVARIANTS

1. **Software Emergency Stop Is Supplementary:** For any physical robotic machinery, the software emergency-stop controller complements—but never replaces—a dedicated, hardwired physical emergency-stop button with galvanic motor power cutoff.
2. **Simulation Never Equates to Flight/Wearable Readiness:** Analytical aerodynamic models and exoskeleton kinematics must undergo independent engineering review and physical bench trials before human use.
