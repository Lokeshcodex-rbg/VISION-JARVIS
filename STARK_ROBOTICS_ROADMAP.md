# STARK AI — Robotics, Wearable Systems & Embedded Engineering Roadmap

**Document Version:** 3.0.0  
**Project Workspace:** `D:\Jarvis`  
**Classification:** Biomechanics, Exoskeleton Ergonomics, Actuators & Embedded Firmware  

---

## 1. Vision & Ethical Safety Framework

Inspired by the iconic armor and robotics of Tony Stark, this engineering track focuses on practical, real-world robotic assistance: powered upper-limb exoskeletons, desktop manipulators, and high-performance robotic joints.

### Safety Mandate for Wearable Systems

1. **Never Jump Directly to Human-Worn Powered Tests:** Powered wearable devices introduce immediate physical risks: pinch points, uncontrolled joint hyperextension, motor stalls causing thermal burns, and battery fires.
2. **Mandatory Mechanical End-Stops:** Physical mechanical hard-stops must prevent joint rotation beyond natural human anatomical limits, independent of any software limits.
3. **Passive Emergency Release (Dead-Man Switch):** Wearer must have a spring-loaded or magnetic quick-disconnect mechanism allowing instantaneous decoupling without electrical power.
4. **Current & Force Thresholding:** Motor controllers must enforce strict hardware-level torque and current limits ($I_{max}$) below human pain/injury thresholds.

---

## 2. Staged Prototype Progression

```text
[Phase 1: Desktop Simulation]
      │ - Rigid-body kinematics & dynamic simulation
      │ - Torque sizing & battery power budgets
      ▼
[Phase 2: 3D-Printed Passive Mockup]
      │ - Ergonomic fit check, strap adjustment, and joint alignment
      │ - Range of motion evaluation without actuators
      ▼
[Phase 3: Instrumented Bench Test Stand]
      │ - Isolated single-joint actuator test stand
      │ - Torque output, speed, and temperature logging on load cell
      ▼
[Phase 4: Low-Voltage Subsystem Evaluation]
      │ - Current-limited bench power supply
      │ - Validation of PID feedback and safety ISRs
      ▼
[Phase 5: Supervised Hardware Evaluation]
      │ - Only after engineering review and verified mechanical stops
      └ - Multi-person safety supervision with physical E-Stop
```

---

## 3. Human Biomechanics & Joint Ergonomics

The human arm possesses complex joint degrees of freedom that must be matched by exoskeleton geometry:

| Anatomical Joint | Human Motion Range | Exoskeleton Mechanism | Actuation Type |
| :--- | :---: | :--- | :--- |
| **Shoulder Flexion / Extension** | $-50^\circ$ to $+180^\circ$ | 2-DOF Orthogonal Pivot | Cable-driven remote actuator |
| **Shoulder Abduction / Adduction** | $0^\circ$ to $+180^\circ$ | Curved track guide | High-torque planetary actuator |
| **Elbow Flexion / Extension** | $0^\circ$ to $+145^\circ$ | Single-axis revolute with offset | Quasi-direct drive BLDC |
| **Forearm Pronation / Supination** | $-80^\circ$ to $+80^\circ$ | Circular bearing ring | Low-profile belt drive |
| **Wrist Flexion / Extension** | $-70^\circ$ to $+75^\circ$ | Tendon-driven flexure | Linear servo actuators |

---

## 4. Actuation & Transmission Architecture

### 4.1 Quasi-Direct Drive (QDD) vs. High-Reduction Actuators

- **Quasi-Direct Drive (5:1 to 10:1 planetary):**
  - *Advantages:* Highly back-drivable, low reflected inertia ($J_{ref} = N^2 J_m$), direct force sensing via motor phase current ($T = K_t I_q$), compliant and inherently safe for human interaction.
  - *Application:* Dynamic legged robotics and assistive wearable joints.
- **Harmonic Drive (50:1 to 100:1):**
  - *Advantages:* Zero backlash, extreme torque density.
  - *Disadvantages:* Non-backdrivable; requires dedicated joint torque sensors or Series Elastic Actuators (SEA).

### 4.2 Actuator Sizing Equation

For a combined link mass $m$, payload $m_{load}$, and acceleration $\alpha$:
$$\tau_{peak} = \left[ (m_{link} r_{cg} + m_{load} L) \cdot g + (J_{link} + m_{load} L^2) \alpha \right] \cdot \frac{1}{\eta}$$

---

## 5. Embedded Systems & Firmware Architecture

Implemented in [server/electronicsEmbeddedEngine.js](file:///d:/Jarvis/server/electronicsEmbeddedEngine.js):

### 5.1 Microcontroller Platforms

- **ESP32-WROOM-32D:** Dual-core 240 MHz, wireless telemetry, sensor bus aggregation (I2C/SPI).
- **STM32F401 (ARM Cortex-M4 with FPU):** 84 MHz hard real-time deterministic closed-loop motor control.
- **Raspberry Pi RP2040:** Programmable I/O (PIO) for deterministic multi-axis step/direction and quadrature encoder decoding.

### 5.2 Sensor Integration

- **IMU Orientation Sensing:** 6-axis MPU6050 / LSM6DSOX on joint linkages running Madgwick / Kalman filter sensor fusion.
- **Joint Position Feedback:** AS5600 / AS5048A 14-bit magnetic absolute rotary encoders.
- **Load & Force Sensing:** HX711 strain-gauge amplifiers and Thin-film piezo-resistive force sensors for human-exoskeleton interface pressure.
