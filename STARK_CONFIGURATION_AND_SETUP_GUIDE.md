# STARK AI — CONFIGURATION AND SETUP GUIDE

**Target System:** STARK AI / JARVIS  
**Root Path:** `D:\Jarvis`

---

## 1. SYSTEM REQUIREMENTS

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 x64 (Build 19041+) | Windows 11 x64 (23H2+) |
| **Node.js** | Node.js v18.x LTS | Node.js v20.x or v22.x LTS |
| **Memory (RAM)** | 8 GB RAM | 16 GB+ DDR4/DDR5 |
| **Processor** | Dual-core 2.4 GHz | 6-core+ AMD Ryzen or Intel Core i7 |
| **Display** | 1280x720 60 Hz | 1920x1080 60 Hz+ (Living Code Eye Canvas) |
| **Microphone** | Standard analog 3.5mm or USB | Low-noise USB condenser or array mic |

---

## 2. INSTALLATION & SETUP STEPS

### Step 1: Clone & Verify Branch

```powershell
cd D:\Jarvis
git status
# Confirm active working branch: stark-unified-full-system
```

### Step 2: Install Node.js Dependencies

```powershell
npm install
```

Installed packages:

- `electron`: Desktop runtime container
- `three`: 3D visual brain and eye rendering mathematics

### Step 3: Configure Environment Variables (`.env`)

Create or edit `.env` in `D:\Jarvis`:

```ini
# Server Port
PORT=3000

# Cloud AI Providers (Optional - System gracefully operates in fallback mode if missing)
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Speech Synthesis Providers (Optional - Defaults to native Windows SAPI voices)
ELEVENLABS_API_KEY=your_elevenlabs_key_here
FISH_AUDIO_API_KEY=your_fish_audio_key_here

# Local AI Engine (Optional - Automatic fallback if Ollama is running)
LOCAL_AI_ENDPOINT=http://localhost:11434/api/generate
LOCAL_MODEL_NAME=llama3.2:latest

# Security & Persona
DEFAULT_PERSONA=JARVIS
ENABLE_PROACTIVE_OBSERVER=true
```

### Step 4: Scientific & Engineering Toolchain (Optional Expansion)

- **Python 3.12** is installed on host. To enable Python SymPy/NumPy numerical bridges:

  ```powershell
  pip install numpy scipy sympy pint matplotlib
  ```

  *Note: STARK AI's built-in `server/scientificComputationEngine.js` already provides pure JavaScript native numerical solvers, matrix determinants, RK4 ODEs, and beam stress calculations without requiring pip packages.*
- **OpenSCAD (Optional CAD Render Engine):**
  - Download from [https://openscad.org](https://openscad.org).
  - Add `openscad.exe` to system PATH for automated headless STL/PNG generation.

---

## 3. LAUNCHING STARK AI

### Launch Mode 1: Complete Desktop Experience (Electron + Server)

```powershell
npm start
```

Starts the integrated Electron window hosting the 60 FPS Living Code Eye canvas, Web Speech microphone pipeline, and background Node API.

### Launch Mode 2: Headless Backend Server (API & Automation Only)

```powershell
npm run server
# Server listening on http://localhost:3000
```

---

## 4. VERIFYING SYSTEM READINESS

Execute the automated test suites:

```powershell
# 1. Ultimate Full-System Verification Suite (38 tests)
node test_stark_ultimate_full_system.js

# 2. Zero-Lag Conversation & Emergency Stop Suite (72 tests)
node test_stark_zero_lag_and_emergency_stop.js

# 3. Master Ultimate Verification Suite (31 tests)
node test_master_ultimate_verification.js
```

Expected output: **141/141 tests passing with 0 failures.**
