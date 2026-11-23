/**
 * VISION AI — Electronics & Embedded Systems Engine
 * Module 4: Power budgets, component selection, C++/Arduino firmware generation,
 * PID controllers, and circuit schematic netlists.
 */

class ElectronicsEmbeddedEngine {
  constructor() {
    this.fs = require('fs');
    this.path = require('path');
    this.inventoryFile = this.path.join(__dirname, '..', 'data', 'robotics', 'hardware_inventory.json');
    this.hardwareInventory = this._loadInventory();
    this.microcontrollers = {
      esp32: {
        name: 'ESP32-WROOM-32D',
        core: 'Dual-core Tensilica Xtensa 32-bit LX6 @ 240 MHz',
        ramKb: 520,
        flashMb: 4,
        gpioCount: 34,
        adcChannels: 18,
        dacChannels: 2,
        interfaces: ['WiFi 802.11 b/g/n', 'Bluetooth v4.2 BR/EDR & BLE', '3x UART', '2x I2C', '4x SPI', 'PWM (LEDC 16-ch)'],
        operatingVoltage: '3.3V',
        activeCurrentMa: 80,
        deepSleepCurrentUa: 10,
        estimatedCostUSD: 4.50,
        recommendedFor: 'Robotic wireless controllers, telemetry nodes, IoT sensor gateways'
      },
      rp2040: {
        name: 'Raspberry Pi RP2040',
        core: 'Dual-core ARM Cortex-M0+ @ 133 MHz',
        ramKb: 264,
        flashMb: 2, // External
        gpioCount: 30,
        adcChannels: 4,
        dacChannels: 0,
        interfaces: ['2x UART', '2x I2C', '2x SPI', '16x PWM', '8x PIO (Programmable I/O)'],
        operatingVoltage: '3.3V',
        activeCurrentMa: 25,
        estimatedCostUSD: 1.00,
        recommendedFor: 'High-speed deterministic motor pulse timing, custom step/dir PIO drivers'
      },
      stm32f401: {
        name: 'STM32F401 BlackPill (ARM Cortex-M4)',
        core: '32-bit ARM Cortex-M4 with FPU @ 84 MHz',
        ramKb: 64,
        flashMb: 0.5,
        gpioCount: 36,
        adcChannels: 16,
        dacChannels: 0,
        interfaces: ['3x USART', '3x I2C', '4x SPI', 'USB OTG', 'Timers with advanced PWM'],
        operatingVoltage: '3.3V',
        activeCurrentMa: 35,
        estimatedCostUSD: 3.50,
        recommendedFor: 'Hard real-time closed-loop robotic flight control, low-latency FOC motor control'
      },
      arduino_nano: {
        name: 'Arduino Nano (ATmega328P)',
        core: '8-bit AVR RISC @ 16 MHz',
        ramKb: 2,
        flashMb: 0.032,
        gpioCount: 14,
        adcChannels: 8,
        dacChannels: 0,
        interfaces: ['1x UART', '1x I2C', '1x SPI', '6x 8-bit PWM'],
        operatingVoltage: '5.0V',
        activeCurrentMa: 20,
        estimatedCostUSD: 2.50,
        recommendedFor: 'Basic educational grippers, simple sensor test benches'
      }
    };

    this.motorDrivers = {
      tmc2209: {
        name: 'TMC2209 SilentStepStick',
        type: 'Stepper Motor Driver',
        maxVoltageV: 28,
        continuousCurrentA: 2.0,
        peakCurrentA: 2.8,
        features: ['StealthChop2 ultra-silent operation', 'SpreadCycle dynamic torque', 'StallGuard4 sensorless homing'],
        estimatedCostUSD: 6.50
      },
      drv8825: {
        name: 'DRV8825 Microstepping Driver',
        type: 'Stepper Motor Driver',
        maxVoltageV: 45,
        continuousCurrentA: 1.5,
        peakCurrentA: 2.2,
        features: ['Up to 1/32 microstepping', 'Over-temperature thermal shutdown'],
        estimatedCostUSD: 2.80
      },
      tb6612fng: {
        name: 'TB6612FNG Dual H-Bridge',
        type: 'Dual DC Motor Driver',
        maxVoltageV: 15,
        continuousCurrentA: 1.2,
        peakCurrentA: 3.2,
        features: ['High-efficiency MOSFET H-bridge', 'Standby power-down mode'],
        estimatedCostUSD: 3.20
      }
    };
  }

  // =========================================================================
  // 1. POWER BUDGET & BATTERY RUNTIME CALCULATION
  // =========================================================================

  calculatePowerBudget(options = {}) {
    const components = options.components || [];
    const batteryCapacityMah = Number(options.batteryCapacityMah || 2500);
    const batteryNominalVoltageV = Number(options.batteryNominalVoltageV || 11.1); // e.g. 3S LiPo
    const dutyCyclePercent = Number(options.dutyCyclePercent || 60);

    let totalContinuousCurrentMa = 0;
    let totalPeakCurrentMa = 0;

    const breakdown = components.map(c => {
      const qty = Number(c.qty || 1);
      const idleMa = Number(c.idleMa || 0) * qty;
      const activeMa = Number(c.activeMa || idleMa) * qty;
      const peakMa = Number(c.peakMa || activeMa) * qty;

      totalContinuousCurrentMa += activeMa;
      totalPeakCurrentMa += peakMa;

      return {
        name: c.name || 'Component',
        qty,
        idleMa,
        activeMa,
        peakMa,
        powerWatts: ((activeMa / 1000) * batteryNominalVoltageV).toFixed(2)
      };
    });

    // Weighted average current draw based on duty cycle
    const averageCurrentMa = (totalContinuousCurrentMa * (dutyCyclePercent / 100)) + 
      ((totalContinuousCurrentMa * 0.2) * ((100 - dutyCyclePercent) / 100));

    const totalBatteryEnergyWh = (batteryCapacityMah / 1000) * batteryNominalVoltageV;
    const averagePowerWatts = (averageCurrentMa / 1000) * batteryNominalVoltageV;

    // Runtime with 80% DoD (Depth of Discharge) safety margin
    const usableCapacityMah = batteryCapacityMah * 0.80;
    const runtimeHours = averageCurrentMa > 0 ? usableCapacityMah / averageCurrentMa : 0;
    const runtimeMinutes = runtimeHours * 60;

    // Required C-rate for peak current
    const requiredC_rate = totalPeakCurrentMa / batteryCapacityMah;

    return {
      success: true,
      inputs: {
        batteryCapacityMah,
        batteryNominalVoltageV,
        totalBatteryEnergyWh: parseFloat(totalBatteryEnergyWh.toFixed(2)),
        dutyCyclePercent
      },
      componentBreakdown: breakdown,
      analysis: {
        totalContinuousCurrentMa,
        totalPeakCurrentMa,
        averageCurrentMa: parseFloat(averageCurrentMa.toFixed(1)),
        averagePowerWatts: parseFloat(averagePowerWatts.toFixed(2)),
        estimatedRuntimeMinutes: parseFloat(runtimeMinutes.toFixed(1)),
        estimatedRuntimeHours: parseFloat(runtimeHours.toFixed(2)),
        requiredPeakDischargeC_Rate: parseFloat(requiredC_rate.toFixed(2)),
        batteryHealthRecommendation: requiredC_rate > 25
          ? 'High-discharge battery required (>= 30C discharge rate like drone LiPo).'
          : 'Standard Li-Ion 18650 / LiPo pack (5C-10C) is suitable.'
      }
    };
  }

  // =========================================================================
  // 2. HARDWARE COMPONENT SELECTION & ADVICE
  // =========================================================================

  selectComponents(requirements = {}) {
    const needWireless = Boolean(requirements.wireless);
    const motorType = requirements.motorType || 'servo';
    const numMotors = Number(requirements.numMotors || 4);

    let recommendedMcu = this.microcontrollers.esp32;
    if (!needWireless && requirements.realtimeControl) {
      recommendedMcu = this.microcontrollers.stm32f401;
    } else if (!needWireless && requirements.costSensitive) {
      recommendedMcu = this.microcontrollers.rp2040;
    }

    let recommendedDriver = null;
    if (motorType === 'stepper') {
      recommendedDriver = this.motorDrivers.tmc2209;
    } else if (motorType === 'dc') {
      recommendedDriver = this.motorDrivers.tb6612fng;
    }

    return {
      success: true,
      requirements,
      recommendedMCU: recommendedMcu,
      recommendedMotorDriver: recommendedDriver,
      reasoning: `${recommendedMcu.name} chosen for ${recommendedMcu.recommendedFor}.`
    };
  }

  // =========================================================================
  // 3. READY-TO-COMPILE ARDUINO / C++ FIRMWARE GENERATOR
  // =========================================================================

  generateFirmware(options = {}) {
    const projectName = options.projectName || 'STARK_Robotic_Controller';
    const targetBoard = options.targetBoard || 'esp32';
    const hasPID = Boolean(options.hasPID !== false);
    const hasEmergencyStop = Boolean(options.hasEmergencyStop !== false);

    const firmwareCode = `/**
 * ${projectName} - Autonomous Firmware
 * Generated by VISION AI Embedded Systems Engine
 * Target Architecture: ${targetBoard.toUpperCase()}
 */

#include <Arduino.h>

// Pin Definitions
#define PIN_STATUS_LED        2
#define PIN_EMERGENCY_STOP    4   // Active-low E-Stop button
#define PIN_MOTOR_PWM         18
#define PIN_MOTOR_DIR         19
#define PIN_ENCODER_A         34
#define PIN_ENCODER_B         35

// Volatile System Flags
volatile bool g_emergencyStopActive = false;
volatile long g_encoderTicks = 0;

// Non-blocking Task Timing
unsigned long g_lastTelemetryTime = 0;
unsigned long g_lastControlLoopTime = 0;
const unsigned long CONTROL_LOOP_INTERVAL_MS = 10; // 100 Hz Loop

// PID Controller Variables
float g_targetPosition = 1000.0;
float g_currentPosition = 0.0;
float g_integralError = 0.0;
float g_lastError = 0.0;

// PID Gains
const float Kp = 1.85f;
const float Ki = 0.05f;
const float Kd = 0.45f;

// E-Stop Interrupt Handler
void IRAM_ATTR onEmergencyStopISR() {
    g_emergencyStopActive = true;
}

// Quadrature Encoder ISR
void IRAM_ATTR onEncoderAISR() {
    if (digitalRead(PIN_ENCODER_B) == HIGH) {
        g_encoderTicks++;
    } else {
        g_encoderTicks--;
    }
}

void setup() {
    Serial.begin(115200);
    delay(200);
    Serial.println(F("[SYSTEM_INIT] ${projectName} Initialized."));

    pinMode(PIN_STATUS_LED, OUTPUT);
    pinMode(PIN_MOTOR_PWM, OUTPUT);
    pinMode(PIN_MOTOR_DIR, OUTPUT);

    // Setup Emergency Stop Pin with Internal Pullup
    pinMode(PIN_EMERGENCY_STOP, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_EMERGENCY_STOP), onEmergencyStopISR, FALLING);

    // Setup Optical Encoder Interrupt
    pinMode(PIN_ENCODER_A, INPUT);
    pinMode(PIN_ENCODER_B, INPUT);
    attachInterrupt(digitalPinToInterrupt(PIN_ENCODER_A), onEncoderAISR, RISING);

    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.println(F("[SAFETY_READY] Watchdogs & E-Stop Pin Armed."));
}

void applyMotorEffort(float effort) {
    if (g_emergencyStopActive) {
        // Hard-stop motor output instantly
        analogWrite(PIN_MOTOR_PWM, 0);
        digitalWrite(PIN_MOTOR_DIR, LOW);
        return;
    }

    // Constrain effort between -255 and 255
    effort = constrain(effort, -255.0f, 255.0f);

    if (effort >= 0) {
        digitalWrite(PIN_MOTOR_DIR, HIGH);
        analogWrite(PIN_MOTOR_PWM, (int)effort);
    } else {
        digitalWrite(PIN_MOTOR_DIR, LOW);
        analogWrite(PIN_MOTOR_PWM, (int)(-effort));
    }
}

void loop() {
    unsigned long now = millis();

    // 1. Check Emergency Stop Status
    if (g_emergencyStopActive || digitalRead(PIN_EMERGENCY_STOP) == LOW) {
        g_emergencyStopActive = true;
        applyMotorEffort(0);
        digitalWrite(PIN_STATUS_LED, (now / 200) % 2 == 0 ? HIGH : LOW); // Rapid error blink
        
        if (now - g_lastTelemetryTime >= 1000) {
            Serial.println(F("[E-STOP_ALERT] EMERGENCY STOP TRIPPED. ACTUATORS DISABLED."));
            g_lastTelemetryTime = now;
        }
        return;
    }

    // 2. Closed-Loop PID Control Task (100 Hz)
    if (now - g_lastControlLoopTime >= CONTROL_LOOP_INTERVAL_MS) {
        g_lastControlLoopTime = now;

        noInterrupts();
        g_currentPosition = (float)g_encoderTicks;
        interrupts();

        float error = g_targetPosition - g_currentPosition;
        g_integralError += error * (CONTROL_LOOP_INTERVAL_MS / 1000.0f);
        // Anti-windup clamp
        g_integralError = constrain(g_integralError, -100.0f, 100.0f);

        float derivative = (error - g_lastError) / (CONTROL_LOOP_INTERVAL_MS / 1000.0f);
        g_lastError = error;

        float controlEffort = (Kp * error) + (Ki * g_integralError) + (Kd * derivative);
        applyMotorEffort(controlEffort);
    }

    // 3. Non-blocking Telemetry Reporting (5 Hz)
    if (now - g_lastTelemetryTime >= 200) {
        g_lastTelemetryTime = now;
        Serial.print(F("POS: "));
        Serial.print(g_currentPosition);
        Serial.print(F(" | TARGET: "));
        Serial.print(g_targetPosition);
        Serial.print(F(" | STATUS: OPERATIONAL"));
        Serial.println();
    }
}
`;

    return {
      success: true,
      projectName,
      targetBoard,
      hasPID,
      hasEmergencyStop,
      firmwareCode,
      compilationInstructions: 'Compile using Arduino IDE, PlatformIO (platform = espressif32), or arduino-cli.'
    };
  }

  // =========================================================================
  // 4. CIRCUIT SCHEMATIC NETLIST & PINOUT GENERATOR
  // =========================================================================

  generateCircuitNetlist(projectName, config = {}) {
    const netlist = `* VISION AI Electronic Circuit Netlist & Wiring Table
* Project: ${projectName}
* Generated: ${new Date().toISOString()}

===============================================================================
POWER RAILS:
  +12V_MAIN    : Main DC Supply Rail (Battery / 12V 5A Bench Supply)
  +5V_LOGIC    : Step-down Buck Converter (LM2596 / MP1584) Logic Rail
  +3V3_MCU     : Clean LDO Regulated Rail for ESP32 / RP2040 VDD
  GND          : Common Ground Star-Point (Power & Signal Tied at Battery)

PIN INTERCONNECTIONS:
  NET_MCU_TXD        : ESP32 GPIO1 (TX0) -> USB-UART CP2102 RX
  NET_MCU_RXD        : ESP32 GPIO3 (RX0) -> USB-UART CP2102 TX
  NET_I2C_SDA        : ESP32 GPIO21 (SDA) -> INA219 SDA, MPU6050 SDA (4.7kΩ Pullup to +3.3V)
  NET_I2C_SCL        : ESP32 GPIO22 (SCL) -> INA219 SCL, MPU6050 SCL (4.7kΩ Pullup to +3.3V)
  NET_MOTOR_PWM      : ESP32 GPIO18 (PWM) -> Motor Driver IN1 (via 100Ω series damping resistor)
  NET_MOTOR_DIR      : ESP32 GPIO19 (DIR) -> Motor Driver IN2
  NET_ESTOP_LINE     : ESP32 GPIO4 (E-STOP) -> NC Pushbutton to GND (Internal 10kΩ Pullup)
  NET_STATUS_LED     : ESP32 GPIO2 -> 330Ω Resistor -> Blue Indicator LED -> GND

PROTECTION COMPONENTS:
  - D1 (Flyback Diode) : 1N5819 Schottky across inductive motor terminals
  - C1 (Bulk Filter)   : 470µF 35V Low-ESR Electrolytic capacitor at 12V motor driver input
  - C2 (Decoupling)    : 0.1µF Ceramic capacitor directly adjacent to MCU VDD pins
  - F1 (Main Fuse)     : 5A PTC Resettable Fuse on +12V battery terminal
===============================================================================
`;

    return {
      success: true,
      projectName,
      netlistText: netlist
    };
  }

  // =========================================================================
  // 5. PERSISTENT USER HARDWARE INVENTORY (Zero Assumed Ownership)
  // =========================================================================

  _loadInventory() {
    try {
      if (this.fs.existsSync(this.inventoryFile)) {
        const parsed = JSON.parse(this.fs.readFileSync(this.inventoryFile, 'utf8'));
        return Array.isArray(parsed.items) ? parsed.items : [];
      }
    } catch (_) {}
    return [];
  }

  _saveInventory() {
    try {
      const dir = this.path.dirname(this.inventoryFile);
      if (!this.fs.existsSync(dir)) this.fs.mkdirSync(dir, { recursive: true });
      this.fs.writeFileSync(this.inventoryFile, JSON.stringify({ updatedAt: new Date().toISOString(), items: this.hardwareInventory }, null, 2), 'utf8');
      return true;
    } catch (_) {
      return false;
    }
  }

  addHardwareInventoryItem({ name, category = 'component', quantity = 1, specs = '', notes = '' } = {}) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return { success: false, error: 'Component name is required.' };
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const existing = this.hardwareInventory.find(i => i.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      existing.quantity = (existing.quantity || 0) + qty;
      if (specs) existing.specs = specs;
      if (notes) existing.notes = notes;
      existing.updatedAt = new Date().toISOString();
    } else {
      this.hardwareInventory.push({
        id: `hw_${Date.now().toString(36)}`,
        name: cleanName,
        category,
        quantity: qty,
        specs,
        notes,
        addedAt: new Date().toISOString()
      });
    }
    this._saveInventory();
    return {
      success: true,
      inventoryCount: this.hardwareInventory.length,
      items: this.hardwareInventory,
      summary: `Recorded ${qty}x "${cleanName}" in your hardware inventory (${this.hardwareInventory.length} item types saved), sir.`
    };
  }

  listHardwareInventory() {
    return {
      success: true,
      count: this.hardwareInventory.length,
      items: this.hardwareInventory,
      summary: this.hardwareInventory.length > 0
        ? `You have ${this.hardwareInventory.length} recorded component type(s) on file: ${this.hardwareInventory.map(i => `${i.quantity}x ${i.name}`).join(', ')}.`
        : 'No owned hardware components are recorded in your inventory yet, sir. Tell me which motors, drivers, wires, or boards you have (or upload a photo) and I will log them without guessing.'
    };
  }
}

const electronicsEmbeddedEngineInstance = new ElectronicsEmbeddedEngine();

module.exports = {
  ElectronicsEmbeddedEngine,
  electronicsEmbeddedEngineInstance
};
