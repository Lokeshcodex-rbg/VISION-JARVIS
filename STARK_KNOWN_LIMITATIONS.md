# STARK AI — Known Limitations, Environmental Boundaries & Fallbacks

**Document Version:** 3.0.0  
**Project Workspace:** `D:\Jarvis`  
**Classification:** Transparent Technical Boundaries, Hardware Realities & Safety Policy Gates  

---

## 1. Operating Grounding Principle

STARK AI adheres strictly to the rule of honest engineering: **Never claim a capability is operational, connected, or verified unless there is concrete evidence.** When a dependency, external binary, physical device, or API quota is unavailable, the platform implements a clean interface, documents the exact missing dependency, and engages a verified fallback.

---

## 2. Technical Boundaries & Fallback Strategies

### 2.1 CAD Binary Dependency (OpenSCAD)

- **Current Reality:** The external compiler binary `openscad.exe` is not present on the Windows system `PATH`.
- **Impact:** Headless compiling of 3D CSG scripts directly into binary `.stl`, `.obj`, or `.png` render artifacts cannot be executed in-process without the binary.
- **Engaged Fallback:**
  - The [server/mechanicalRoboticsEngine.js](file:///d:/Jarvis/server/mechanicalRoboticsEngine.js) engages pure Constructive Solid Geometry (CSG) parametric code synthesis.
  - Generates valid, dimensioned `.scad` scripts exportable to user-specified directories.
  - Computes analytical bounding boxes, center of mass, and volume estimates mathematically without requiring binary execution.
  - The Live Capability Registry classifies this capability accurately as `SIMULATED` / `FALLBACK_OPERATIONAL`.

### 2.2 Physical Robotics & Hardware Actuation

- **Current Reality:** No physical microcontrollers (e.g. STM32, Arduino, ESP32), motor controllers, CAN bus adapters, or robotic arm servos are currently connected to local USB/COM ports.
- **Impact:** Real physical motion cannot be actuated on physical hardware in the real world.
- **Engaged Fallback:**
  - Robotics algorithms operate in pure mathematical simulation mode.
  - Forward/inverse kinematics, dynamic torque loads ($\tau = J\alpha + T_{load}$), and power budgets are computed analytically.
  - **Safety Policy Enforcement:** Simulated commands are explicitly tagged with `isSimulated: true` and are isolated from issuing hardware write signals.

### 2.3 Computer Vision & Metrology Calibration

- **Current Reality:** Standard webcams and laptop camera sensors lack depth sensors (LiDAR / Time-of-Flight) and optical calibration matrices.
- **Impact:** Pixel-level measurements in camera frames cannot serve as certified engineering dimensional tolerances.
- **Engaged Fallback:**
  - All visual engineering inspections from [server/visionService.js](file:///d:/Jarvis/server/visionService.js) append mandatory disclaimers:
    *"Optical measurements from uncalibrated visual sensors are non-metric approximations. Verified dimensional inspection requires physical calipers, micrometers, or calibrated optical coordinate measuring machines (CMM)."*

### 2.4 Aerospace, eVTOL & Flight Suit Concepts

- **Current Reality:** Theoretical Iron Man-inspired concepts (compact high-density power sources, micro-thrusters, wearable HUDs) are constrained by the laws of thermodynamics and available battery specific energy ($\sim 200-250 \, \frac{Wh}{kg}$).
- **Impact:** The system cannot manufacture or operate fictional propulsion systems or flight suits.
- **Engaged Fallback:**
  - Wearable and flight concepts are treated as serious engineering research projects.
  - Solves real physics: aerodynamic drag, thrust-to-weight ratios, battery energy density, and structural finite stress.
  - Fictional science (repulsors, inertial dampeners) is explicitly distinguished from real physics in all generated engineering reports.
  - **Flight Safety Gate:** Autonomous or unsupervised flight testing is strictly prohibited. Real flight requires ground tether test stands, radio-controlled subscale models, and formal compliance with aviation authorities (FAA Part 103, EASA, DGCA).

### 2.5 Emergency Stop Limitations on Completed OS Operations

- **Current Reality:** The emergency stop controller synchronously halts in-flight AI queries, speech playback, recognition, and tool calls within milliseconds. However, operating system file writes or external network packets already committed prior to the stop event cannot be rewound.
- **Impact:** Once bytes are flushed to disk or a network packet leaves the network interface, the operation is physically completed.
- **Safety Policy Enforcement:** The emergency stop halts all subsequent actions, invalidates active response turns, latches the system into a STOPPED state, and reports the situation honestly without pretending completed external actions were undone.

### 2.6 Cloud AI Provider Quotas & Network Connectivity

- **Current Reality:** Google Gemini API requires internet connectivity and valid API quotas.
- **Impact:** Network disconnects or quota exhaustion (`HTTP 429 Too Many Requests`) can interrupt cloud inference.
- **Engaged Fallback:**
  - The Provider Manager implements bounded retries with fast-fail fallback to OpenRouter or local instant execution tiers.
  - In offline mode or quota depletion, local heuristic command interpreters handle system commands, file searches, desktop automation, and engineering calculations without crashing.
  - Quota errors are reported transparently without infinite retry loops.

### 2.7 Windows Operating System Security Privileges

- **Current Reality:** The STARK AI Node.js backend runs under current standard user account permissions.
- **Impact:** Cannot perform kernel driver installations, modify Windows protected system files (`C:\Windows\System32`), or bypass Windows User Account Control (UAC).
- **Engaged Fallback:**
  - Shell commands and file operations are strictly bounded to user-accessible project roots (`D:\Jarvis` and user directories).
  - Privileged actions fail gracefully with explicit descriptive error messages.
