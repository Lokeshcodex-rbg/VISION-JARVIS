# STARK AI — ENGINEERING LAB USAGE GUIDE & REPRODUCIBLE PROJECT

**Target Subsystem:** Unified Engineering & Simulation Laboratory  
**Engines:** `mechanicalRoboticsEngine.js`, `scientificComputationEngine.js`, `electronicsEmbeddedEngine.js`

---

## 1. ENGINEERING LAB WORKFLOW

STARK AI implements an end-to-end, verified engineering pipeline:

```text
[Requirements] ──► [Analytical Math] ──► [Structural FEA/Beam] ──► [Actuator Sizing]
                                                                        │
                                                                        ▼
[Firmware Generation] ◄── [Power Budget & BOM] ◄── [Parametric CAD] ◄── [DH Kinematics]
```

---

## 2. REPRODUCIBLE WALKTHROUGH PROJECT: 5-DOF ROBOTIC MANIPULATOR ARM

This guide walks through calculating, modeling, powering, and programming a real 5-DOF articulated robotic arm using STARK AI tools.

### Step 1: Structural Link Analysis (Euler-Bernoulli Beam)

Calculate stress and safety factor for an aluminum 6061-T6 arm link under 150 N load:

```javascript
const { executeTool } = require('./server/toolsRegistry');

const beamResult = await executeTool('analyze_structural_beam', {
  loadN: 150,
  lengthM: 0.35,
  widthM: 0.03,
  heightM: 0.02,
  materialKey: 'aluminum_6061_t6'
});

console.log('Safety Factor:', beamResult.results.safetyFactor); // e.g., 5.75
console.log('Tip Deflection (mm):', beamResult.results.maxDeflectionMm);
console.log('Status:', beamResult.results.status); // SAFE (SF >= 2.0)
```

### Step 2: Joint Actuator Torque Sizing

Calculate required shoulder actuator torque for a 1.5 kg payload with 2.0 kg arm mass and 3.0 rad/s² acceleration:

```javascript
const torqueResult = await executeTool('size_actuator_motor', {
  payloadKg: 1.5,
  armMassKg: 2.0,
  armLengthM: 0.45,
  angularAccRadS2: 3.0,
  safetyMargin: 1.5
});

console.log('Total Torque Required (N·m):', torqueResult.totalRequiredTorqueNm);
console.log('Total Torque (kg·cm):', torqueResult.calculations.totalRequiredTorqueKgCm);
console.log('Recommended Motor Class:', torqueResult.recommendedActuatorClass);
```

### Step 3: Forward Kinematics (DH Transformation)

Verify end-effector spatial coordinates using Denavit-Hartenberg parameters:

```javascript
const dhTable = [
  { joint: 'Base Yaw', theta: 0, d: 0.12, a: 0, alpha: Math.PI / 2 },
  { joint: 'Shoulder Pitch', theta: 0, d: 0, a: 0.22, alpha: 0 },
  { joint: 'Elbow Pitch', theta: 0, d: 0, a: 0.18, alpha: 0 },
  { joint: 'Wrist Pitch', theta: 0, d: 0, a: 0, alpha: Math.PI / 2 },
  { joint: 'Wrist Roll', theta: 0, d: 0.10, a: 0, alpha: 0 }
];

const kinResult = await executeTool('calculate_robot_kinematics', { dhTable });
console.log('End-Effector Coordinates (meters):', kinResult.endEffectorPosition);
```

### Step 4: Parametric OpenSCAD CAD Generation

Generate clean 3D parametric CAD code for motor brackets:

```javascript
const cadResult = await executeTool('generate_parametric_cad', {
  projectType: 'robotic_gripper'
});

console.log(cadResult.scadCode);
// Save to disk for rendering in OpenSCAD
fs.writeFileSync('robotic_gripper.scad', cadResult.scadCode);
```

### Step 5: Power Budget & Battery Sizing

Calculate battery capacity, peak discharge C-rate, and continuous runtime:

```javascript
const powerResult = await executeTool('calculate_power_budget', {
  components: [
    { name: 'ESP32 Controller', activeMa: 80, idleMa: 20 },
    { name: '2x DS3235 Shoulder Servos', activeMa: 1600, idleMa: 150 },
    { name: '3x RDS3218 Wrist Servos', activeMa: 1200, idleMa: 100 }
  ],
  batteryCapacityMah: 3300,
  batteryNominalVoltageV: 11.1,
  dutyCyclePercent: 60
});

console.log('Continuous Runtime (Hours):', powerResult.analysis.estimatedRuntimeHours);
console.log('Peak Discharge C-Rate:', powerResult.analysis.requiredPeakDischargeC_Rate);
```

### Step 6: Firmware Generation with Emergency-Stop ISR

Generate complete ready-to-flash C++ firmware for the ESP32 microcontroller with active-low hardware emergency stop ISR:

```javascript
const fwResult = await executeTool('generate_embedded_firmware', {
  projectName: 'STARK_5DOF_Arm_Controller',
  targetBoard: 'esp32',
  hasEmergencyStop: true,
  hasPID: true
});

console.log(fwResult.firmwareCode);
fs.writeFileSync('main.cpp', fwResult.firmwareCode);
```

---

## 3. PHYSICAL SAFETY & TESTING BOUNDARIES

1. **Analytical & Simulation First:** All kinematics, beam stresses, and power budgets must pass numerical validation before bench testing.
2. **Dual Physical Stops:** For wearable robotics and exoskeletons, physical mechanical hard-stops must be engineered to prevent human joint hyperextension during total power loss.
3. **Independent Hardware E-Stop:** Software emergency-stops must always be paired with physical, hardware-isolated cutoff switches for high-current motors.
4. **Flight Concepts Disclaimer:** Drone/eVTOL and virtual flight-suit models are strictly mathematical aerodynamic simulations. Flight readiness requires independent aerospace review and physical flight-test certification.
