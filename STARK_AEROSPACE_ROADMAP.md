# VISION AI (MADE BY LOKESH) — Aerospace Engineering, eVTOL & Electric Propulsion Roadmap

**Document Version:** 3.0.0  
**Project Workspace:** `D:\Jarvis`  
**Classification:** Aerodynamics, eVTOL Sizing, Propulsion Analysis & Airworthiness Standards  

---

## 1. Grounding Principle: Real Aerodynamics vs. Fictional Propulsion

Tony Stark's suit flight relied on fictional technology (repulsors, micro-nuclear arc reactors) that violate modern thermodynamic and power-density realities.

**VISION AI (MADE BY LOKESH) strictly enforces engineering honesty:**

- Fictional concepts are categorized as *conceptual research studies* only.
- Real vehicle designs must obey the Navier-Stokes equations, momentum theory, Newton's third law, and real battery specific energy limits ($Wh/kg$).
- **No unsupervised or uncertified flight tests:** Flight testing of personal aircraft or eVTOL prototypes requires ground tether test stands, radio-controlled subscale models, and formal compliance with national aviation authorities (FAA Part 103 / Part 23, EASA SC-VTOL, DGCA).

---

## 2. Aerodynamic Fundamentals & Propulsion Physics

### 2.1 Rotor Disk Momentum Theory

For hovering rotors of total area $A$ in air density $\rho \approx 1.225 \, \frac{kg}{m^3}$:

- **Induced Velocity through Rotor Disk:**
  $$v_i = \sqrt{\frac{T}{2 \rho A}}$$
- **Ideal Hover Power (Induced Power):**
  $$P_{ideal} = T \cdot v_i = \frac{T^{3/2}}{\sqrt{2 \rho A}}$$
- **Figure of Merit ($FoM$):** Measures aerodynamic efficiency of the rotor (typically $0.60$ to $0.75$ for tuned eVTOL rotors):
  $$P_{shaft} = \frac{P_{ideal}}{FoM}$$

### 2.2 Fixed-Wing Lift and Drag Estimation

For forward flight transitions:

- **Aerodynamic Lift:**
  $$L = \frac{1}{2} \rho v^2 S C_L$$
- **Total Aerodynamic Drag:**
  $$D = \frac{1}{2} \rho v^2 S C_D = \frac{1}{2} \rho v^2 S \left( C_{D0} + \frac{C_L^2}{\pi \cdot AR \cdot e} \right)$$
  Where $C_{D0}$ is zero-lift parasitic drag, $AR = \frac{b^2}{S}$ is aspect ratio, and $e$ is Oswald span efficiency factor.

---

## 3. Mass & Energy Budget Constraints for Personal Electric Flight

The primary engineering bottleneck in personal aviation is battery specific energy:

- **Current Commercial Li-Ion / LiPo:** $\sim 220 - 270 \, \frac{Wh}{kg}$ (pack level: $\sim 180 - 210 \, \frac{Wh}{kg}$).
- **Jet A / Avgas Fuel Energy Density:** $\sim 12,000 \, \frac{Wh}{kg}$ ($\sim 50\times$ higher than batteries).

### 3.1 Mass Breakdown for a 1-Person Ultralight eVTOL (FAA Part 103 Class)

| Component Group | Mass ($kg$) | Percentage of MTOW |
| :--- | :---: | :---: |
| **Airframe & Structural Carbon Fiber** | 45.0 | 19.6% |
| **Propulsion Units (8x Motors, ESCs, Rotors)** | 32.0 | 13.9% |
| **Avionics, Wiring & Redundant Flight Computers** | 12.0 | 5.2% |
| **Battery Energy Storage Pack (14 kWh)** | 65.0 | 28.3% |
| **Pilot (Design Standard)** | 75.0 | 32.6% |
| **Emergency Ballistic Parachute Recovery System** | 1.0 | 0.4% |
| **Maximum Takeoff Weight (MTOW)** | **230.0 kg** | **100.0%** |

### 3.2 Hover Endurance Calculation

At $MTOW = 230 \, kg$, total thrust $T = 2,256 \, N$. For 8 rotors of diameter $D = 0.8 \, m$ ($A_{total} = 4.02 \, m^2$):
$$v_i = \sqrt{\frac{2256}{2 \cdot 1.225 \cdot 4.02}} \approx 15.1 \, \frac{m}{s}$$
$$P_{ideal} = 2256 \cdot 15.1 \approx 34.1 \, kW$$
With $FoM = 0.70$ and electrical drive efficiency $\eta_{elec} = 0.88$:
$$P_{electrical} = \frac{34.1}{0.70 \cdot 0.88} \approx 55.4 \, kW$$
Usable battery capacity (80% Depth of Discharge on 14 kWh pack): $11.2 \, kWh$.
$$\text{Hover Endurance} = \frac{11.2 \, kWh}{55.4 \, kW} \cdot 60 \, \text{min} \approx \mathbf{12.1 \, \text{minutes}}$$

---

## 4. Staged Aerospace Engineering Milestones

```text
[Milestone 1: Mathematical Mission Profile & Energy Budget]
      │ - Trade study: Pure multicopter vs. Lift+Cruise vs. Vectored Thrust
      ▼
[Milestone 2: Subscale Radio-Controlled Flight Validation]
      │ - 1:5 or 1:4 subscale dynamic flight test model
      │ - Avionics tuning, ArduPilot / PX4 transition logic
      ▼
[Milestone 3: Full-Scale Ground Tether Test Stand]
      │ - Full-scale propulsion arm mounted to multi-axis load cell
      │ - Verification of motor thermal limits and vibration harmonics
      ▼
[Milestone 4: Failure Mode & Effects Analysis (FMEA)]
      │ - Rotor loss failure modes (octocopter motor-out redundancy)
      │ - Battery cell thermal runaway containment
      ▼
[Milestone 5: Regulatory Compliance & Supervised Testing]
      │ - FAA Part 103 Ultralight exemption verification
      └ - Mandatory ballistic parachute system integration
```
