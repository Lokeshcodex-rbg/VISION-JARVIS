/**
 * VISION AI — Advanced Physical Technologies & Engineering Lab
 * Implements Part 5 of STARK Beyond 100 Directive:
 * - Section 11: Robotics and Embodied Intelligence (Kinematics, Jacobians, torque limits)
 * - Section 12: Iron Man-Inspired Exoskeleton Research (Torque, power, structural stress, safety factor >= 2.0)
 * - Section 13: Advanced Vehicles & Propulsion (eVTOL hover endurance, momentum theory, ion drive)
 * - Section 14: Materials Discovery & Topology Screening (Specific strength/stiffness Pareto front)
 * - Section 15: Advanced Energy Research (Lawson criterion, Carnot limit, conservation laws audit)
 */

const fs = require('fs');
const path = require('path');
const { mechanicalRoboticsEngineInstance } = require('./mechanicalRoboticsEngine.js');
const { scientificComputationEngineInstance } = require('./scientificComputationEngine.js');

class AdvancedEngineeringLab {
  constructor() {
    this.gravity = 9.80665; // m/s^2
    this.airDensitySeaLevel = 1.225; // kg/m^3
  }

  // =========================================================================
  // SECTION 12: IRON MAN-INSPIRED EXOSKELETON RESEARCH
  // =========================================================================

  /**
   * Section 12: Evaluates assistive exoskeleton joint torque, power, structural stress, and battery thermal bounds
   */
  evaluateExoskeletonKneeJoint(params = {}) {
    const {
      operatorMassKg = 80,
      exoskeletonMassKg = 18,
      kneeFlexionDeg = 45,
      shankLengthM = 0.45,
      assistanceFraction = 0.40, // 40% metabolic assistance target
      structuralMaterial = 'titanium_ti6al4v',
      appliedAngularAccRadS2 = 4.0, // rad/s^2 during sit-to-stand
      safetyReviewToken = null
    } = params;

    const rad = deg => (deg * Math.PI) / 180;
    const theta = rad(kneeFlexionDeg);

    // Biomechanical joint torque:
    // Quasi-static gravity torque: tau_g = (operatorMass * 0.6 * g * (shankLength / 2)) * sin(theta)
    const massSupported = (operatorMassKg + exoskeletonMassKg) * 0.5; // per leg
    const staticTorqueNm = massSupported * this.gravity * (shankLengthM * 0.5) * Math.sin(theta);

    // Dynamic torque: tau_d = I * alpha
    const shankInertiaKgM2 = (1 / 3) * (exoskeletonMassKg * 0.25) * Math.pow(shankLengthM, 2);
    const dynamicTorqueNm = shankInertiaKgM2 * appliedAngularAccRadS2;

    const totalBiologicalTorqueNm = staticTorqueNm + dynamicTorqueNm;
    const requiredExoAssistTorqueNm = parseFloat((totalBiologicalTorqueNm * assistanceFraction).toFixed(2));

    // Actuator power at 1.5 rad/s angular velocity
    const angularVelocityRadS = 1.5;
    const mechanicalPowerWatts = parseFloat((requiredExoAssistTorqueNm * angularVelocityRadS).toFixed(1));
    const electricalPowerWatts = parseFloat((mechanicalPowerWatts / 0.85).toFixed(1)); // 85% inverter/motor efficiency

    // Structural Stress & Safety Factor on Link Bracket
    // Hollow rectangular section: width 35mm, height 35mm, wall thickness 3.5mm
    const b = 0.035;
    const h = 0.035;
    const t = 0.0035;
    const I = (b * Math.pow(h, 3) - (b - 2 * t) * Math.pow(h - 2 * t, 3)) / 12;
    const c = h / 2;
    const bendingStressPa = (requiredExoAssistTorqueNm * c) / I;
    const bendingStressMpa = parseFloat((bendingStressPa / 1e6).toFixed(2));

    const materialProps = mechanicalRoboticsEngineInstance.materialsDatabase[structuralMaterial] ||
                          mechanicalRoboticsEngineInstance.materialsDatabase['titanium_ti6al4v'];
    const safetyFactor = parseFloat((materialProps.yieldStrengthMPa / bendingStressMpa).toFixed(2));

    // Battery Mass & Thermal Dissipation
    // 48V pack supplying electricalPowerWatts for 60 minutes
    const continuousCurrentA = parseFloat((electricalPowerWatts / 48.0).toFixed(2));
    const batteryCapacityWh = parseFloat((electricalPowerWatts * 1.0).toFixed(1)); // 1 hour endurance
    const batteryMassKg = parseFloat((batteryCapacityWh / 180.0).toFixed(2)); // 180 Wh/kg Li-Ion
    const heatRejectionWatts = parseFloat((electricalPowerWatts - mechanicalPowerWatts).toFixed(1));

    return {
      simulationOnly: true,
      humanTestingPermitted: false,
      joint: 'KNEE_FLEXION_ASSISTANCE',
      kneeFlexionAngleDeg: kneeFlexionDeg,
      totalBiologicalTorqueNm: parseFloat(totalBiologicalTorqueNm.toFixed(2)),
      requiredExoAssistTorqueNm,
      kneeAssistTorqueNm: requiredExoAssistTorqueNm,
      mechanicalPowerWatts,
      electricalPowerWatts,
      continuousCurrentAmps: continuousCurrentA,
      heatRejectionWatts,
      batteryThermalDissipationWatts: heatRejectionWatts,
      vonMisesBendingStressMpa: bendingStressMpa,
      safetyFactor,
      safetyFactorCompliance: safetyFactor >= 2.0,
      structuralAnalysis: {
        material: materialProps.name,
        yieldStrengthMPa: materialProps.yieldStrengthMPa,
        maxBendingStressMpa: bendingStressMpa,
        safetyFactor,
        isSafetyCompliant: safetyFactor >= 2.0
      },
      powerSystem: {
        busVoltageV: 48.0,
        estimatedBatteryMassKg: batteryMassKg,
        enduranceHours: 1.0
      },
      safetyStatus: {
        hasEngineeringReviewToken: Boolean(safetyReviewToken),
        humanWearingAuthorized: Boolean(safetyReviewToken && safetyFactor >= 2.0),
        warning: 'Physical testing must be performed on non-human-loaded instrumented test benches before human wearing.'
      }
    };
  }

  // =========================================================================
  // SECTION 13: ADVANCED VEHICLES & PROPULSION
  // =========================================================================

  /**
   * Section 13: Computes eVTOL hover endurance, rotor disk momentum theory, and power budgets
   */
  evaluateEvtolHoverDynamics(params = {}) {
    const totalMassKg = params.grossMassKg || params.totalMassKg || 1200;
    const rotorCount = params.numberOfRotors || params.rotorCount || 6;
    const rotorRadiusM = params.rotorRadiusM || 1.25;
    const batteryEnergyDensityWhKg = params.batteryEnergyDensityWhKg || 250;
    const batteryMassKg = params.batteryMassKg || 350;
    const figureOfMerit = params.figureOfMerit || 0.72;

    const totalWeightN = totalMassKg * this.gravity;
    const totalDiskAreaM2 = rotorCount * Math.PI * Math.pow(rotorRadiusM, 2);

    // Momentum Theory: Induced velocity v_i = sqrt(T / (2 * rho * A))
    const inducedVelocityMS = Math.sqrt(totalWeightN / (2 * this.airDensitySeaLevel * totalDiskAreaM2));
    
    // Ideal induced power: P_ideal = T * v_i
    const idealInducedPowerW = totalWeightN * inducedVelocityMS;

    // Actual hover power including profile drag and figure of merit
    const actualHoverPowerKw = parseFloat(((idealInducedPowerW / figureOfMerit) / 1000).toFixed(2));

    // Usable battery energy (80% Depth of Discharge for battery cycle life)
    const totalBatteryEnergyKwh = (batteryMassKg * batteryEnergyDensityWhKg) / 1000;
    const usableEnergyKwh = totalBatteryEnergyKwh * 0.80;

    // Hover endurance: t = E_usable / P_hover
    const hoverEnduranceHours = usableEnergyKwh / actualHoverPowerKw;
    const hoverEnduranceMinutes = parseFloat((hoverEnduranceHours * 60).toFixed(1));

    return {
      aerodynamicModel: 'ACTUATOR_DISK_MOMENTUM_THEORY',
      aircraftClass: 'MULTIROTOR_EVTOL',
      totalMassKg,
      grossMassKg: totalMassKg,
      totalWeightNewtons: parseFloat(totalWeightN.toFixed(1)),
      hoverThrustN: parseFloat(totalWeightN.toFixed(1)),
      rotorCount,
      totalDiskAreaM2: parseFloat(totalDiskAreaM2.toFixed(2)),
      diskLoadingNPerM2: parseFloat((totalWeightN / totalDiskAreaM2).toFixed(1)),
      inducedVelocityMS: parseFloat(inducedVelocityMS.toFixed(2)),
      actualHoverPowerKw,
      hoverPowerKw: actualHoverPowerKw,
      usableBatteryEnergyKwh: parseFloat(usableEnergyKwh.toFixed(2)),
      hoverEnduranceMinutes,
      powerToWeightRatioKwPerKg: parseFloat((actualHoverPowerKw / totalMassKg).toFixed(3)),
      physicalFeasibility: {
        isEnergyBudgetValid: hoverEnduranceMinutes > 10.0,
        batteryMassFraction: parseFloat((batteryMassKg / totalMassKg).toFixed(2)),
        note: 'Calculations adhere strictly to actuator disk momentum conservation and realistic battery energy densities.'
      }
    };
  }

  /**
   * Section 13: Analyzes deep-space electrostatic ion drive thrust-to-power and ISP
   */
  evaluateIonThrusterPhysics(params = {}) {
    const {
      propellant = 'XENON',
      beamVoltageV = 1500,
      beamCurrentA = 2.5
    } = params;

    const xenonAtomicMassKg = (params.propellantMolarMassG || 131.293) * 1.66054e-27;
    const electronChargeC = 1.60218e-19;

    // Exhaust velocity v_e = sqrt(2 * q * V / m)
    const exhaustVelocityMS = Math.sqrt((2 * electronChargeC * beamVoltageV) / xenonAtomicMassKg);
    const specificImpulseS = parseFloat((exhaustVelocityMS / this.gravity).toFixed(1));

    // Mass flow rate m_dot = (I_beam / q) * m
    const massFlowRateKgS = (beamCurrentA / electronChargeC) * xenonAtomicMassKg;

    // Thrust T = m_dot * v_e
    const thrustN = parseFloat((massFlowRateKgS * exhaustVelocityMS).toFixed(3));
    const thrustMillinewtons = parseFloat((thrustN * 1000).toFixed(1));

    const inputBeamPowerWatts = parseFloat((beamVoltageV * beamCurrentA).toFixed(1));
    const thrustToPowerRatioMnPerKw = parseFloat((thrustMillinewtons / (inputBeamPowerWatts / 1000)).toFixed(2));

    return {
      propulsionType: 'ELECTROSTATIC_GRidded_ION_THRUSTER',
      propellant,
      beamVoltageV,
      beamCurrentA,
      inputBeamPowerWatts,
      exhaustVelocityMS: parseFloat(exhaustVelocityMS.toFixed(1)),
      exhaustVelocityKmS: parseFloat((exhaustVelocityMS / 1000).toFixed(1)),
      specificImpulseSeconds: specificImpulseS,
      thrustMillinewtons,
      thrustMilliNewtons: thrustMillinewtons,
      thrustToPowerRatioMnPerKw,
      governingPhysics: 'Conservation of Momentum (dp/dt) & Electrostatic Potential Acceleration (q*V = 0.5*m*v^2)'
    };
  }

  // =========================================================================
  // SECTION 14: MATERIALS SCREENING & TOPOLOGY DISCOVERY
  // =========================================================================

  /**
   * Section 14: Evaluates materials database for Specific Strength and Specific Stiffness Pareto frontier
   */
  screenMaterialsParetoFront(customCandidates = null) {
    let candidateList = [];
    if (Array.isArray(customCandidates) && customCandidates.length > 0) {
      candidateList = customCandidates.map((m, idx) => {
        const densityGCm3 = (m.densityKgM3 || 1000) / 1000;
        const yieldStrength = m.yieldStrengthMpa || m.yieldStrengthMPa || 250;
        const youngsModulus = m.youngsModulusGpa || m.youngsModulusGPa || 70;
        const cost = m.costPerKgUsd || m.costPerKg || 10;
        const specificStrength = parseFloat((yieldStrength / densityGCm3).toFixed(1));
        const specificStiffness = parseFloat((youngsModulus / densityGCm3).toFixed(1));
        return {
          key: m.name || `mat_${idx}`,
          name: m.name || `Material_${idx}`,
          densityGCm3,
          yieldStrengthMPa: yieldStrength,
          youngsModulusGPa: youngsModulus,
          costPerKg: cost,
          costPerKgUsd: cost,
          specificStrength,
          specificStrengthKnmKg: specificStrength,
          specificStiffness,
          specificStiffnessMnmKg: specificStiffness
        };
      });
    } else {
      const db = mechanicalRoboticsEngineInstance.materialsDatabase;
      candidateList = Object.entries(db).map(([key, m]) => {
        const densityGCm3 = m.densityKgM3 / 1000;
        const specificStrength = parseFloat((m.yieldStrengthMPa / densityGCm3).toFixed(1));
        const specificStiffness = parseFloat((m.youngsModulusGPa / densityGCm3).toFixed(1));
        return {
          key,
          name: m.name,
          densityGCm3,
          yieldStrengthMPa: m.yieldStrengthMPa,
          youngsModulusGPa: m.youngsModulusGPa,
          costPerKg: m.estimatedCostPerKg,
          costPerKgUsd: m.estimatedCostPerKg,
          specificStrength,
          specificStrengthKnmKg: specificStrength,
          specificStiffness,
          specificStiffnessMnmKg: specificStiffness
        };
      });
    }

    const paretoFront = [];
    for (const a of candidateList) {
      let isDominated = false;
      for (const b of candidateList) {
        if (b.key === a.key) continue;
        if (b.specificStrength >= a.specificStrength && b.costPerKg <= a.costPerKg &&
           (b.specificStrength > a.specificStrength || b.costPerKg < a.costPerKg)) {
          isDominated = true;
          break;
        }
      }
      if (!isDominated) {
        paretoFront.push(a);
      }
    }

    return paretoFront;
  }

  // =========================================================================
  // SECTION 15: ADVANCED ENERGY RESEARCH
  // =========================================================================

  /**
   * Section 15: Evaluates Carnot thermal efficiency, energy conservation audit, and Lawson fusion criteria
   */
  auditEnergySystemBudget(systemSpec = {}) {
    const inputEnergyJoules = systemSpec.inputEnergyJoules || (systemSpec.inputPowerKw ? systemSpec.inputPowerKw * 1000 : 1000);
    const outputWorkJoules = systemSpec.outputWorkJoules || (systemSpec.claimedOutputPowerKw ? systemSpec.claimedOutputPowerKw * 1000 : 400);
    const efficiency = systemSpec.conversionEfficiency || (outputWorkJoules / inputEnergyJoules);
    const basePower = Math.max(inputEnergyJoules, outputWorkJoules);
    const wasteHeatJoules = systemSpec.wasteHeatJoules !== undefined
      ? systemSpec.wasteHeatJoules
      : (systemSpec.wasteHeatKw ? systemSpec.wasteHeatKw * 1000 : Math.max(1, basePower * (1 - Math.min(0.99, efficiency))));

    const hotReservoirTempK = systemSpec.hotReservoirTempK || 600;
    const coldReservoirTempK = systemSpec.coldReservoirTempK || systemSpec.radiatorHeatSinkTempK || 300;

    const obeysFirstLaw = outputWorkJoules <= inputEnergyJoules;

    const carnotEfficiency = parseFloat((1 - (coldReservoirTempK / hotReservoirTempK)).toFixed(3));
    const actualEfficiency = parseFloat((outputWorkJoules / inputEnergyJoules).toFixed(3));
    const obeysSecondLaw = actualEfficiency <= Math.max(0.01, carnotEfficiency);

    const isPerpetualMotionClaim = actualEfficiency > 1.0 || (systemSpec.claimedOutputPowerKw && systemSpec.claimedOutputPowerKw > (systemSpec.inputPowerKw || 0));

    const sigma = 5.670374e-8;
    const epsilon = 0.90;
    const powerRejectionWatts = wasteHeatJoules;
    const requiredRadiatorAreaM2 = parseFloat(
      (powerRejectionWatts / (sigma * epsilon * Math.pow(coldReservoirTempK, 4))).toFixed(2)
    );

    return {
      inputEnergyJoules,
      outputWorkJoules,
      wasteHeatJoules,
      wasteHeatKw: parseFloat((wasteHeatJoules / 1000).toFixed(2)),
      actualThermalEfficiency: actualEfficiency,
      carnotMaxEfficiency: carnotEfficiency,
      carnotLimitExceeded: isPerpetualMotionClaim || !obeysSecondLaw,
      obeysFirstLawOfThermodynamics: obeysFirstLaw,
      obeysSecondLawOfThermodynamics: obeysSecondLaw,
      isPerpetualMotionDetected: isPerpetualMotionClaim,
      requiredRadiatorAreaM2,
      auditVerdict: (obeysFirstLaw && obeysSecondLaw && !isPerpetualMotionClaim)
        ? 'THERMODYNAMICALLY_VALID'
        : 'THERMODYNAMIC_LAW_VIOLATION'
    };
  }

  /**
   * Section 15: Evaluates fusion plasma Lawson criterion triple product
   */
  evaluateLawsonFusionCriterion(densityM3 = 1e20, temperatureKev = 15, confinementTimeS = 3.0) {
    // Lawson triple product: n * T * tau_E >= 3e21 keV * s / m^3 for D-T ignition
    const tripleProduct = densityM3 * temperatureKev * confinementTimeS;
    const ignitionThreshold = 3e21; // keV * s / m^3

    const achievementRatio = parseFloat((tripleProduct / ignitionThreshold).toFixed(3));
    const reachesIgnition = achievementRatio >= 1.0;

    return {
      plasmaDensityM3: densityM3,
      plasmaTemperatureKev: temperatureKev,
      energyConfinementTimeSeconds: confinementTimeS,
      tripleProduct,
      tripleProductCalculated: tripleProduct,
      ignitionThresholdRequired: ignitionThreshold,
      ignitionRatio: achievementRatio,
      lawsonThresholdSatisfied: reachesIgnition,
      reachesThermonuclearIgnition: reachesIgnition,
      scientificAssessment: reachesIgnition
        ? 'Plasma parameters satisfy theoretical Lawson D-T ignition criterion (Q >= 1).'
        : `Below ignition threshold (${(achievementRatio * 100).toFixed(1)}% of required triple product). Requires increased confinement time or density.`
    };
  }
}

const advancedEngineeringLabInstance = new AdvancedEngineeringLab();

module.exports = {
  AdvancedEngineeringLab,
  advancedEngineeringLabInstance
};
