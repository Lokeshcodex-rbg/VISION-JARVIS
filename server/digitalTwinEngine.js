/**
 * VISION AI — Live Digital Twins & Sensor Synchronization Engine
 * Connects analytical/simulation models with live or recorded sensor telemetry,
 * tracking prediction residuals, sensor calibration, drift, and constraint violations.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(__dirname, '..', 'data', 'digital_twins');

class DigitalTwinEngine {
  constructor() {
    this.twins = new Map();
    this.telemetryLogs = new Map(); // twinId -> array of telemetry frames
    this.maxLogFrames = 1000;
    this._ensureDataDir();
    this._seedDefaultTwins();
  }

  _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  _seedDefaultTwins() {
    // 1. Brushless DC Motor & Inverter Twin
    this.registerTwin({
      twinId: 'twin_bldc_actuator_01',
      name: 'BLDC High-Torque Actuator Twin',
      systemType: 'BRUSHLESS_MOTOR',
      parameters: {
        phaseResistanceOhms: 0.12,
        phaseInductanceMh: 0.25,
        torqueConstantKt: 0.085, // Nm/A
        rotorInertiaJ: 0.00045, // kg*m^2
        viscousDampingB: 0.0001,
        thermalResistanceCPerW: 1.8,
        thermalCapacityJPerC: 85.0
      },
      operatingEnvelope: {
        maxCurrentAmps: 35.0,
        maxRpm: 6000,
        maxTempCelsius: 95.0,
        maxTorqueNm: 3.2
      },
      calibration: {
        currentSensorOffset: 0.02,
        currentSensorScale: 1.0,
        tempSensorOffset: -0.5,
        tempSensorScale: 1.0,
        lastCalibrated: new Date().toISOString()
      }
    });

    // 2. Cantilever Beam Structural Twin
    this.registerTwin({
      twinId: 'twin_cantilever_spar_01',
      name: 'Titanium Wing Spar Cantilever Twin',
      systemType: 'CANTILEVER_BEAM',
      parameters: {
        lengthMeters: 1.2,
        youngsModulusGpa: 113.8, // Grade 5 Titanium
        yieldStrengthMpa: 880.0,
        secondMomentOfAreaI: 1.45e-7 // m^4
      },
      operatingEnvelope: {
        maxTipDeflectionMm: 15.0,
        maxVonMisesStressMpa: 600.0, // Factor of safety ~1.46
        maxVibrationHz: 120.0
      },
      calibration: {
        strainGaugeOffset: 0.0,
        strainGaugeScale: 1.0,
        lastCalibrated: new Date().toISOString()
      }
    });
  }

  /**
   * Registers a digital twin definition
   */
  registerTwin(config = {}) {
    const { twinId, name, systemType, parameters = {}, operatingEnvelope = {}, calibration = {} } = config;
    if (!twinId || !name || !systemType) {
      throw new Error('twinId, name, and systemType are required to register digital twin');
    }

    const twinRecord = {
      twinId,
      name,
      systemType,
      parameters,
      operatingEnvelope,
      calibration: {
        currentSensorOffset: calibration.currentSensorOffset || 0.0,
        currentSensorScale: calibration.currentSensorScale || 1.0,
        tempSensorOffset: calibration.tempSensorOffset || 0.0,
        tempSensorScale: calibration.tempSensorScale || 1.0,
        lastCalibrated: calibration.lastCalibrated || new Date().toISOString()
      },
      currentPredictedState: {},
      lastMeasuredState: {},
      statistics: {
        samplesIngested: 0,
        anomaliesDetected: 0,
        meanSquaredError: 0.0,
        maxObservedResidual: 0.0
      },
      registeredAt: new Date().toISOString()
    };

    this.twins.set(twinId, twinRecord);
    this.telemetryLogs.set(twinId, []);
    return { success: true, twinId, status: 'INITIALIZED' };
  }

  /**
   * Steps the physics simulation model forward and compares with measured sensor values
   */
  syncStep(twinId, inputCommands = {}, measuredTelemetry = {}, dtSeconds = 0.01) {
    const twin = this.twins.get(twinId);
    if (!twin) throw new Error(`Twin ${twinId} not found`);

    const tStart = Date.now();
    let predictedState = {};
    let residuals = {};
    const violations = [];

    if (twin.systemType === 'BRUSHLESS_MOTOR') {
      const { voltageInputV = 24.0, loadTorqueNm = 0.5 } = inputCommands;
      const { currentAmps = 6.0, rpm = 2500, tempCelsius = 42.0, provenance = 'PHYSICAL_SENSOR' } = measuredTelemetry;

      // Calibrate raw readings
      const calCurrent = (currentAmps - twin.calibration.currentSensorOffset) * twin.calibration.currentSensorScale;
      const calTemp = (tempCelsius - twin.calibration.tempSensorOffset) * twin.calibration.tempSensorScale;

      // Physics model: back-EMF, motor electrical and mechanical ODEs
      const { phaseResistanceOhms, torqueConstantKt, rotorInertiaJ, viscousDampingB, thermalResistanceCPerW } = twin.parameters;
      const backEmfConstantKv = torqueConstantKt; // In SI units rad/s to V
      const omegaRadS = (rpm * 2 * Math.PI) / 60;
      const backEmfV = omegaRadS * backEmfConstantKv;
      const predCurrent = Math.max(0, (voltageInputV - backEmfV) / phaseResistanceOhms);
      
      const motorTorque = predCurrent * torqueConstantKt;
      const netTorque = motorTorque - loadTorqueNm - (viscousDampingB * omegaRadS);
      const alphaRadS2 = netTorque / rotorInertiaJ;
      const predOmega = Math.max(0, omegaRadS + alphaRadS2 * dtSeconds);
      const predRpm = (predOmega * 60) / (2 * Math.PI);

      // Thermal estimate
      const resistiveLossW = (predCurrent ** 2) * phaseResistanceOhms;
      const predTemp = 25.0 + (resistiveLossW * thermalResistanceCPerW);

      predictedState = {
        currentAmps: Number(predCurrent.toFixed(3)),
        rpm: Number(predRpm.toFixed(1)),
        tempCelsius: Number(predTemp.toFixed(2)),
        grounding: 'SIMULATED'
      };

      residuals = {
        currentResidualAmps: Number((calCurrent - predCurrent).toFixed(3)),
        rpmResidual: Number((rpm - predRpm).toFixed(1)),
        tempResidualCelsius: Number((calTemp - predTemp).toFixed(2))
      };

      // Operating envelope checks
      if (calCurrent > twin.operatingEnvelope.maxCurrentAmps) {
        violations.push({ constraint: 'maxCurrentAmps', limit: twin.operatingEnvelope.maxCurrentAmps, measured: calCurrent });
      }
      if (calTemp > twin.operatingEnvelope.maxTempCelsius) {
        violations.push({ constraint: 'maxTempCelsius', limit: twin.operatingEnvelope.maxTempCelsius, measured: calTemp });
      }

    } else if (twin.systemType === 'CANTILEVER_BEAM') {
      const { appliedLoadN = 500.0 } = inputCommands;
      const { tipDeflectionMm = 4.2, provenance = 'PHYSICAL_SENSOR' } = measuredTelemetry;

      const { lengthMeters, youngsModulusGpa, secondMomentOfAreaI, yieldStrengthMpa } = twin.parameters;
      const E = youngsModulusGpa * 1e9;
      const I = secondMomentOfAreaI;
      const L = lengthMeters;

      // Analytical Beam Deflection: delta = (F * L^3) / (3 * E * I)
      const predDeflectionM = (appliedLoadN * (L ** 3)) / (3 * E * I);
      const predDeflectionMm = predDeflectionM * 1000;

      // Maximum bending stress: sigma = (M * c) / I, where M = F * L, c = height/2
      const c = 0.025; // 25mm half height
      const bendingStressMpa = ((appliedLoadN * L * c) / I) / 1e6;

      predictedState = {
        tipDeflectionMm: Number(predDeflectionMm.toFixed(3)),
        bendingStressMpa: Number(bendingStressMpa.toFixed(2)),
        grounding: 'SIMULATED'
      };

      residuals = {
        deflectionResidualMm: Number((tipDeflectionMm - predDeflectionMm).toFixed(3))
      };

      if (bendingStressMpa > twin.operatingEnvelope.maxVonMisesStressMpa) {
        violations.push({ constraint: 'maxVonMisesStressMpa', limit: twin.operatingEnvelope.maxVonMisesStressMpa, predicted: bendingStressMpa });
      }
    }

    // Drift / Anomaly detection: flag if any residual exceeds threshold
    const hasAnomaly = violations.length > 0 || Object.values(residuals).some(r => Math.abs(r) > 15.0);

    // Update twin statistics
    twin.statistics.samplesIngested++;
    if (hasAnomaly) twin.statistics.anomaliesDetected++;
    twin.currentPredictedState = predictedState;
    twin.lastMeasuredState = { ...measuredTelemetry, calibrated: true };

    const frame = {
      timestamp: new Date().toISOString(),
      stepDt: dtSeconds,
      inputCommands,
      measured: measuredTelemetry,
      predicted: predictedState,
      residuals,
      violations,
      anomalyDetected: hasAnomaly
    };

    const logs = this.telemetryLogs.get(twinId);
    logs.push(frame);
    if (logs.length > this.maxLogFrames) logs.shift();

    return {
      success: true,
      twinId,
      frame,
      status: violations.length > 0 ? 'CONSTRAINT_VIOLATION' : (hasAnomaly ? 'DRIFT_DETECTED' : 'SYNCHRONIZED_NORMAL')
    };
  }

  /**
   * Calibrates sensor zero-offset and scale factor using baseline zero-input and reference loads
   */
  calibrateSensors(twinId, calibrationDataset = []) {
    const twin = this.twins.get(twinId);
    if (!twin) throw new Error(`Twin ${twinId} not found`);

    if (!Array.isArray(calibrationDataset) || calibrationDataset.length === 0) {
      throw new Error('Calibration dataset must contain non-empty array of reference samples');
    }

    // Mean zero-offset estimation
    let sumOffset = 0;
    for (const sample of calibrationDataset) {
      sumOffset += (sample.measuredRaw - sample.expectedTrue);
    }
    const computedOffset = Number((sumOffset / calibrationDataset.length).toFixed(4));

    twin.calibration.currentSensorOffset = computedOffset;
    twin.calibration.lastCalibrated = new Date().toISOString();

    return {
      success: true,
      twinId,
      updatedCalibration: twin.calibration,
      samplesUsed: calibrationDataset.length,
      estimatedMeanOffset: computedOffset
    };
  }

  /**
   * Replays recorded telemetry trace through the twin physics model
   */
  replayTrace(twinId, traceFrames = []) {
    const results = [];
    for (const frame of traceFrames) {
      const res = this.syncStep(twinId, frame.inputCommands, frame.measuredTelemetry, frame.dtSeconds || 0.01);
      results.push(res);
    }
    return {
      success: true,
      twinId,
      replayedCount: results.length,
      anomaliesInTrace: results.filter(r => r.frame.anomalyDetected).length
    };
  }

  getTwinStatus(twinId) {
    const twin = this.twins.get(twinId);
    if (!twin) return null;
    const logs = this.telemetryLogs.get(twinId) || [];
    return {
      twin,
      latestFrame: logs.length > 0 ? logs[logs.length - 1] : null,
      historyLength: logs.length
    };
  }
}

const digitalTwinEngineInstance = new DigitalTwinEngine();

module.exports = {
  DigitalTwinEngine,
  digitalTwinEngineInstance
};
