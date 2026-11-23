/**
 * STARK AI — Autonomous General Intelligence, Engineering, Research & Computation Test Suite
 * Comprehensive automated verification for Modules 1 through 15:
 * 1. Scientific & Mathematical Computation (Linear algebra, Calculus, Simpson ODE, Monte Carlo, Units, Error propagation)
 * 2. Mechanical Engineering & Robotics (Materials DB, Beam stress, DH Kinematics, Actuator sizing, OpenSCAD CAD, Blueprints)
 * 3. Electronics & Embedded Systems (Power budget, Component selection, C++/Arduino PID firmware, Schematic netlists)
 * 4. AI Development Laboratory (VRAM estimation, Dataset inspection, RAG search, Standalone agent scaffolder)
 * 5. Advanced Research & Knowledge Base (ArXiv scientific papers, Source comparison, Persistent KB)
 * 6. Forecasting & Project Orchestration (Multi-scenario forecast, FMEA risk, Milestone DAG)
 * 7. Security & Emergency Stop Enforcement (JARVIS vs ULTRON matrix, Emergency stop hard-halt)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { scientificComputationEngineInstance } = require('./server/scientificComputationEngine.js');
const { mechanicalRoboticsEngineInstance } = require('./server/mechanicalRoboticsEngine.js');
const { electronicsEmbeddedEngineInstance } = require('./server/electronicsEmbeddedEngine.js');
const { aiDevelopmentLabInstance } = require('./server/aiDevelopmentLab.js');
const { advancedResearchEngineInstance } = require('./server/advancedResearchEngine.js');
const { forecastingScenarioEngineInstance } = require('./server/forecastingScenarioEngine.js');
const { autonomousProjectOrchestratorInstance } = require('./server/autonomousProjectOrchestrator.js');
const { executeTool } = require('./server/toolsRegistry.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
const { commandInterpreterInstance } = require('./server/commandInterpreter.js');
const { WORKSPACE_ROOT } = require('./server/securityPermissions.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function it(description, fn) {
  totalTests++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      await result;
    }
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] #${totalTests}: ${description} -> ${err.message}`);
  }
}

async function runCampaign() {
  console.log('\n===============================================================================');
  console.log('   STARK AI: GENERAL INTELLIGENCE, ENGINEERING & RESEARCH VERIFICATION SUITE   ');
  console.log('===============================================================================\n');

  // =========================================================================
  // SECTION 1: Scientific & Mathematical Computation (Module 2)
  // =========================================================================
  console.log('[SECTION 1] Scientific & Mathematical Computation:');

  await it('1.1. Dimensional analysis & unit conversions across SI and Imperial', () => {
    // Length: 12 inches to mm
    const resLen = scientificComputationEngineInstance.convertUnits(12, 'in', 'mm');
    assert.strictEqual(resLen.success, true);
    assert.strictEqual(Math.round(resLen.outputValue), 305); // 304.8 mm

    // Force: 100 lbf to N
    const resForce = scientificComputationEngineInstance.convertUnits(100, 'lbf', 'N');
    assert.strictEqual(Math.round(resForce.outputValue), 445); // 444.8 N

    // Pressure: 1 bar to psi
    const resPress = scientificComputationEngineInstance.convertUnits(1, 'bar', 'psi');
    assert.strictEqual(Math.round(resPress.outputValue * 10) / 10, 14.5);

    // Temperature: 100 C to F and K
    const resTempF = scientificComputationEngineInstance.convertUnits(100, 'C', 'F');
    assert.strictEqual(resTempF.outputValue, 212);
    const resTempK = scientificComputationEngineInstance.convertUnits(0, 'C', 'K');
    assert.strictEqual(resTempK.outputValue, 273.15);
  });

  await it('1.2. Linear algebra: matrix multiplication, determinant, and inversion identity', () => {
    const A = [
      [2, 1],
      [5, 3]
    ];
    // det(A) = 2*3 - 1*5 = 1
    const det = scientificComputationEngineInstance.matrixDeterminant(A);
    assert.strictEqual(det, 1);

    // Inverse of A
    const invA = scientificComputationEngineInstance.matrixInverse(A);
    assert.deepStrictEqual(invA, [
      [3, -1],
      [-5, 2]
    ]);

    // Multiply A * invA = Identity
    const I = scientificComputationEngineInstance.matrixMultiply(A, invA);
    assert.strictEqual(Math.round(I[0][0]), 1);
    assert.strictEqual(Math.round(I[0][1]), 0);
    assert.strictEqual(Math.round(I[1][0]), 0);
    assert.strictEqual(Math.round(I[1][1]), 1);
  });

  await it('1.3. Numerical integration via Simpson\'s 1/3 rule with trapezoid cross-check', () => {
    // Integrate f(x) = x^2 from 0 to 3 -> Exact is [x^3 / 3] = 27 / 3 = 9.0
    const calc = scientificComputationEngineInstance.executeCalculation({
      operation: 'integrate_simpson',
      expression: 'x * x',
      a: 0,
      b: 3,
      steps: 100
    });
    assert.strictEqual(calc.operation, 'numerical_integration');
    assert(Math.abs(calc.integral - 9.0) < 1e-4, 'Simpson integral must evaluate to 9.0');
    assert(Math.abs(calc.crossCheckTrapezoid - 9.0) < 1e-2, 'Trapezoid cross-check must be close');
  });

  await it('1.4. Numerical ODE solution via Runge-Kutta 4th Order (RK4)', () => {
    // dy/dt = -y, y(0) = 1. Analytical solution: y(t) = exp(-t). At t=1, y=exp(-1) ≈ 0.367879
    const dydt = (t, y) => -y;
    const rk4 = scientificComputationEngineInstance.solveODE_RK4(dydt, 0, 1.0, 1.0, 50);
    assert.strictEqual(rk4.steps, 50);
    assert(Math.abs(rk4.finalY - Math.exp(-1)) < 1e-5, 'RK4 should match analytical exp(-1)');
  });

  await it('1.5. Gaussian error propagation & parameter sensitivity elasticity', () => {
    // Power in electric circuit: P = V^2 / R
    // V = 12V ± 0.5V, R = 4Ω ± 0.2Ω
    // Nominal P = 144 / 4 = 36 W
    const model = (p) => (p.V ** 2) / p.R;
    const values = { V: 12.0, R: 4.0 };
    const uncertainties = { V: 0.5, R: 0.2 };

    const prop = scientificComputationEngineInstance.propagateUncertainty(model, values, uncertainties);
    assert.strictEqual(prop.baseOutput, 36.0);
    assert(prop.combinedUncertainty > 0, 'Must produce non-zero combined uncertainty');
    assert(prop.sensitivities.V.elasticity > 1.8, 'V elasticity should be ~2.0 (quadratic)');
    assert(prop.sensitivities.R.elasticity < -0.8, 'R elasticity should be ~ -1.0 (inverse)');
  });

  await it('1.6. Monte Carlo stochastic simulation with percentile confidence intervals', () => {
    // Model: Y = A * B
    // A ~ Normal(10, 1), B ~ Uniform(2, 4)
    // Expected mean Y ~ 10 * 3 = 30
    const model = (p) => p.A * p.B;
    const dists = {
      A: { type: 'normal', mean: 10, stdDev: 1 },
      B: { type: 'uniform', min: 2, max: 4 }
    };
    const mc = scientificComputationEngineInstance.runMonteCarlo(model, dists, 2000);
    assert.strictEqual(mc.trials, 2000);
    assert(mc.mean > 28 && mc.mean < 32, 'Mean should hover around 30');
    assert(mc.p5 < mc.p50 && mc.p50 < mc.p95, 'Percentiles must be monotonically increasing');
  });

  // =========================================================================
  // SECTION 2: Mechanical Engineering, Robotics & CAD (Module 3)
  // =========================================================================
  console.log('\n[SECTION 2] Mechanical Engineering, Robotics & CAD:');

  await it('2.1. Materials database property retrieval & comparative analysis', () => {
    const al = mechanicalRoboticsEngineInstance.getMaterial('aluminum_6061_t6');
    assert.strictEqual(al.densityKgM3, 2700);
    assert.strictEqual(al.yieldStrengthMPa, 276);

    const comp = mechanicalRoboticsEngineInstance.compareMaterials('titanium_ti6al4v', 'steel_4140');
    assert(comp.densityRatio < 1.0, 'Titanium is lighter than steel');
    assert(comp.recommendation.includes('Titanium Grade 5'));
  });

  await it('2.2. Structural cantilever beam stress, tip deflection & safety factor', () => {
    // 30cm aluminum beam under 100N load
    const beam = mechanicalRoboticsEngineInstance.analyzeCantileverBeam({
      loadN: 100,
      lengthM: 0.3,
      widthM: 0.025,
      heightM: 0.015,
      materialKey: 'aluminum_6061_t6'
    });

    assert.strictEqual(beam.success, true);
    assert.strictEqual(beam.results.maxBendingMomentNm, 30);
    assert(beam.results.vonMisesStressMPa > 25 && beam.results.vonMisesStressMPa < 40);
    assert(beam.results.safetyFactor > 6.0, 'Safety factor should be substantial');
    assert(beam.results.maxDeflectionMm > 1.0 && beam.results.maxDeflectionMm < 2.5, 'Deflection should be ~1.86mm');
    assert.strictEqual(beam.results.status, 'SAFE (SF >= 2.0)');
  });

  await it('2.3. Robotics forward kinematics via Denavit-Hartenberg (DH) transformation', () => {
    const dh = [
      { theta: 0, d: 0.1, a: 0, alpha: Math.PI / 2 },
      { theta: 0, d: 0, a: 0.3, alpha: 0 },
      { theta: 0, d: 0, a: 0.2, alpha: 0 }
    ];
    const fk = mechanicalRoboticsEngineInstance.computeForwardKinematicsDH(dh);
    assert.strictEqual(fk.success, true);
    assert.strictEqual(fk.dof, 3);
    // Arm extended along X: x = 0.3 + 0.2 = 0.5m, z = 0.1m
    assert(Math.abs(fk.endEffectorPositionM.x - 0.5) < 1e-3);
    assert(Math.abs(fk.endEffectorPositionM.z - 0.1) < 1e-3);
  });

  await it('2.4. Actuator torque sizing with gravity and dynamic inertial loads', () => {
    const sizing = mechanicalRoboticsEngineInstance.sizeJointActuator({
      payloadKg: 1.0,
      armMassKg: 1.5,
      armLengthM: 0.4,
      safetyMargin: 1.5
    });
    assert.strictEqual(sizing.success, true);
    assert(sizing.calculations.totalRequiredTorqueNm > 10);
    assert(sizing.calculations.totalRequiredTorqueKgCm > 100);
    assert(sizing.recommendedActuatorClass.includes('Brushless DC') || sizing.recommendedActuatorClass.includes('Heavy-Duty'));
  });

  await it('2.5. Parametric 3D OpenSCAD model generation for robotic linkages', () => {
    const cad = mechanicalRoboticsEngineInstance.generateOpenSCADModel('robotic_arm', { length: 200, width: 35 });
    assert.strictEqual(cad.success, true);
    assert(cad.scadCode.includes('module robot_arm_link'));
    assert(cad.scadCode.includes('cylinder(d = hole_d'));
    assert(cad.scadCode.includes('$fn = 60'));
  });

  await it('2.6. Complete project blueprint & BOM retrieval for robotic systems & suit study', () => {
    // 1. Robotic Arm
    const armBp = mechanicalRoboticsEngineInstance.getEngineeringProjectBlueprint('5dof_robotic_arm');
    assert.strictEqual(armBp.projectId, '5dof_robotic_arm');
    assert.strictEqual(armBp.specifications.degreesOfFreedom, 5);
    assert(armBp.billOfMaterials.length >= 5);
    assert(armBp.totalEstimatedBOM_USD > 100);

    // 2. Virtual Iron Man Suit Study (Explicit Conceptual Labeling)
    const suit = mechanicalRoboticsEngineInstance.getEngineeringProjectBlueprint('virtual_iron_man_suit_study');
    assert.strictEqual(suit.classification, 'STRICTLY CONCEPTUAL MODEL & NON-OPERATIONAL SIMULATION');
    assert(suit.engineeringCalculations.aerodynamicThrustRequiredForHover.hoverThrustRequiredN > 2000);
    assert(suit.safetyEngineeringWarning.some(w => w.includes('SAFETY DIRECTIVE')));
  });

  // =========================================================================
  // SECTION 3: Electronics & Embedded Systems (Module 4)
  // =========================================================================
  console.log('\n[SECTION 3] Electronics & Embedded Systems:');

  await it('3.1. Power budget calculation: battery runtime & peak C-rate requirements', () => {
    const pwr = electronicsEmbeddedEngineInstance.calculatePowerBudget({
      batteryCapacityMah: 3000,
      batteryNominalVoltageV: 11.1,
      dutyCyclePercent: 60,
      components: [
        { name: 'ESP32 MCU', idleMa: 30, activeMa: 80, qty: 1 },
        { name: 'High-Torque Servos', idleMa: 50, activeMa: 800, peakMa: 2500, qty: 4 }
      ]
    });
    assert.strictEqual(pwr.success, true);
    assert(pwr.analysis.averageCurrentMa > 1500);
    assert(pwr.analysis.estimatedRuntimeMinutes > 30 && pwr.analysis.estimatedRuntimeMinutes < 120);
    assert(pwr.analysis.requiredPeakDischargeC_Rate > 2.0);
  });

  await it('3.2. Firmware generation: ready-to-compile Arduino/C++ closed-loop PID & E-Stop ISR', () => {
    const fw = electronicsEmbeddedEngineInstance.generateFirmware({
      projectName: 'Robotic_Joint_Controller',
      targetBoard: 'esp32'
    });
    assert.strictEqual(fw.success, true);
    assert(fw.firmwareCode.includes('#define PIN_EMERGENCY_STOP'));
    assert(fw.firmwareCode.includes('attachInterrupt(digitalPinToInterrupt(PIN_EMERGENCY_STOP)'));
    assert(fw.firmwareCode.includes('Kp * error'));
    assert(fw.firmwareCode.includes('applyMotorEffort(0)'));
  });

  await it('3.3. Circuit netlist generation with flyback diode, decoupling & fuse protections', () => {
    const net = electronicsEmbeddedEngineInstance.generateCircuitNetlist('Robotic_Arm_PCB');
    assert.strictEqual(net.success, true);
    assert(net.netlistText.includes('NET_ESTOP_LINE'));
    assert(net.netlistText.includes('1N5819 Schottky'));
    assert(net.netlistText.includes('PTC Resettable Fuse'));
  });

  // =========================================================================
  // SECTION 4: AI Development Laboratory (Module 5)
  // =========================================================================
  console.log('\n[SECTION 4] AI Development Laboratory:');

  await it('4.1. Hardware VRAM, training hours, and compute cost estimation', () => {
    const est = aiDevelopmentLabInstance.estimateTrainingAndInferenceResources({
      parameterCountB: 8.0,
      quantization: '4bit',
      trainingType: 'lora_qlora',
      datasetTokensMillion: 5
    });
    assert.strictEqual(est.success, true);
    assert(est.weightsMemoryGb >= 3.5 && est.weightsMemoryGb <= 4.5);
    assert(est.estimatedTotalVramRequiredGb > 5.0 && est.estimatedTotalVramRequiredGb < 12.0);
    assert(est.recommendedHardware.includes('GPU'));
  });

  await it('4.2. Dataset inspection: valid pairs, token estimation & quality scoring', () => {
    const sampleDataset = [
      { prompt: 'What is torque?', completion: 'Torque is the rotational equivalent of linear force.' },
      { prompt: 'Define Young\'s modulus.', completion: 'Young\'s modulus measures tensile stiffness.' },
      { prompt: 'Missing completion', completion: '' }
    ];
    const report = aiDevelopmentLabInstance.inspectDataset(sampleDataset);
    assert.strictEqual(report.success, true);
    assert.strictEqual(report.totalSamples, 3);
    assert.strictEqual(report.validPairs, 2);
    assert.strictEqual(report.missingCompletionCount, 1);
    assert.strictEqual(report.dataQualityScorePercent, 67);
  });

  await it('4.3. RAG chunking and keyword vector search with term frequencies', () => {
    const docs = [
      { title: 'Robotics Manual', text: 'Actuators convert electrical energy into mechanical motion. Brushless DC motors provide superior power density.' },
      { title: 'Battery Guide', text: 'Lithium polymer batteries require careful voltage monitoring to prevent over-discharge below 3.0 volts per cell.' }
    ];
    const rag = aiDevelopmentLabInstance.buildRAGIndex(docs, 10, 2);
    assert(rag.totalChunks >= 2);

    const results = rag.query('brushless motors motion', 2);
    assert(results.length >= 1);
    assert.strictEqual(results[0].docTitle, 'Robotics Manual');
  });

  await it('4.4. Standalone AI sub-agent project scaffolding with isolated permissions', () => {
    const agentName = 'test_sub_agent_' + Date.now().toString(36);
    const scaffold = aiDevelopmentLabInstance.scaffoldAIAgentProject({
      name: agentName,
      description: 'Dedicated test analytical assistant',
      personality: 'PRECISE_CALCULATOR'
    });
    assert.strictEqual(scaffold.success, true);
    assert(fs.existsSync(path.join(WORKSPACE_ROOT, scaffold.projectPath, 'package.json')));
    assert(fs.existsSync(path.join(WORKSPACE_ROOT, scaffold.projectPath, 'config', 'agentConfig.json')));
    assert(fs.existsSync(path.join(WORKSPACE_ROOT, scaffold.projectPath, 'tests', 'test_agent.js')));

    // Clean up temporary test project directory
    fs.rmSync(path.join(WORKSPACE_ROOT, scaffold.projectPath), { recursive: true, force: true });
  });

  // =========================================================================
  // SECTION 5: Advanced Research & Knowledge Base (Module 1)
  // =========================================================================
  console.log('\n[SECTION 5] Advanced Research & Knowledge Base:');

  await it('5.1. Conflicting source comparison distinguishing direct evidence from speculation', () => {
    const sources = [
      { sourceName: 'ISO 10218 Robotic Safety Standard', text: 'Robotic end-stop compliance requires redundant limit switches.', date: '2021' },
      { sourceName: 'Informal Tech Forum', text: 'Maybe you do not need limit switches if your software is good enough.', date: '2023' }
    ];
    const comp = advancedResearchEngineInstance.compareSources('Robotic limit switch requirement', sources);
    assert.strictEqual(comp.sourcesAnalyzed, 2);
    assert.strictEqual(comp.comparisons[0].evidenceType, 'DIRECT_EVIDENCE');
    assert.strictEqual(comp.comparisons[1].evidenceType, 'INFERRED_SPECULATION');
    assert(comp.uncertaintyAssessment.includes('MODERATE UNCERTAINTY'));
  });

  await it('5.2. Searchable local persistent knowledge base: save and tag query', () => {
    const saveRes = advancedResearchEngineInstance.saveToKnowledgeBase({
      title: 'Euler Buckling Formula',
      content: 'Critical column buckling load is given by P_cr = (pi^2 * E * I) / (K * L)^2.',
      tags: ['mechanics', 'structural', 'buckling'],
      confidence: 'VERIFIED_PHYSICS'
    });
    assert.strictEqual(saveRes.success, true);

    const searchRes = advancedResearchEngineInstance.searchKnowledgeBase('buckling', 'structural');
    assert.strictEqual(searchRes.success, true);
    assert(searchRes.resultsCount >= 1);
    assert(searchRes.entries.some(e => e.title.includes('Euler Buckling')));
  });

  // =========================================================================
  // SECTION 6: Forecasting, Risk & Project Orchestration (Modules 10 & 11)
  // =========================================================================
  console.log('\n[SECTION 6] Forecasting, Risk & Project Orchestration:');

  await it('6.1. Multi-scenario forecasting with 95% confidence intervals', () => {
    const forecast = forecastingScenarioEngineInstance.generateScenarioAnalysis({
      metricName: 'Robotic Battery Capacity Degradation',
      baseValue: 100,
      horizonPeriods: 4,
      historicalGrowthRates: [-0.02, -0.03, -0.01, -0.025]
    });
    assert.strictEqual(forecast.success, true);
    assert.strictEqual(forecast.classification, 'MATHEMATICAL_PROJECTION');
    assert(forecast.projections.optimistic.finalValue > forecast.projections.conservative.finalValue);
    assert.strictEqual(forecast.confidenceInterval95.length, 2);
  });

  await it('6.2. Engineering Failure Mode and Effects Analysis (FMEA) RPN ranking', () => {
    const modes = [
      { mode: 'Servo gear tooth stripping', severity: 8, occurrence: 4, detection: 3, mitigation: 'Steel gears' }, // 8*4*3 = 96
      { mode: 'Emergency stop contact weld failure', severity: 10, occurrence: 2, detection: 2, mitigation: 'Redundant dual-channel contacts' }, // 10*2*2 = 40, critical severity
      { mode: 'Sensor wire loose', severity: 5, occurrence: 6, detection: 4, mitigation: 'Molex positive lock connector' } // 5*6*4 = 120
    ];
    const fmea = forecastingScenarioEngineInstance.evaluateFMEA(modes);
    assert.strictEqual(fmea.success, true);
    assert.strictEqual(fmea.totalModesAnalyzed, 3);
    assert.strictEqual(fmea.failureModes[0].rpn, 120); // Ranked highest RPN first
  });

  await it('6.3. Autonomous project DAG decomposition with hardware blocker identification', () => {
    const plan = autonomousProjectOrchestratorInstance.createProjectPlan({
      title: 'Robotic Gripper Manufacturing and Control',
      domain: 'ROBOTICS_ENGINEERING'
    });
    assert(plan.projectId.startsWith('proj_'));
    assert(plan.milestones.length >= 4);
    assert(plan.milestones.some(m => m.id === 'M1_REQUIREMENTS' && m.status === 'COMPLETED'));
    // Physical assembly must be flagged as requiring hardware/user
    const phys = plan.milestones.find(m => m.requiresHardware);
    assert(phys, 'Must identify physical hardware dependency');
    assert.strictEqual(phys.status, 'REQUIRES_USER_INPUT');
    assert(plan.status.includes('BLOCKED_ON_HARDWARE'));
  });

  // =========================================================================
  // SECTION 7: Tool Registry & Permission Gate Integration (Modules 7, 13, 14)
  // =========================================================================
  console.log('\n[SECTION 7] Tool Registry & Permission Gate Integration:');

  await it('7.1. calculate_scientific_math executed cleanly via central executeTool', async () => {
    const res = await executeTool('calculate_scientific_math', {
      operation: 'matrix_determinant',
      matrix: [
        [1, 2],
        [3, 4]
      ]
    }, 'JARVIS');
    assert.strictEqual(res.determinant, -2);
  });

  await it('7.2. ULTRON permitted to run research calculations but blocked from CAD generation', async () => {
    // ULTRON should be allowed to run read-only scientific calculations
    const ultronCalc = await executeTool('calculate_scientific_math', {
      operation: 'statistics',
      data: [10, 20, 30, 40, 50]
    }, 'ULTRON');
    assert.strictEqual(ultronCalc.mean, 30);

    // ULTRON must be BLOCKED by permissionGate from executing generative CAD actions (DEVELOPMENT_EXEC)
    await assert.rejects(async () => {
      await executeTool('generate_parametric_cad', { projectType: 'robot_arm_link' }, 'ULTRON');
    }, /ULTRON is operating under restricted read-only governance/);
  });

  await it('7.3. Global Emergency Stop halts scientific and engineering tools immediately', async () => {
    permissionGateInstance.triggerEmergencyStop('Automated engineering emergency stop verification');
    assert.strictEqual(permissionGateInstance.isEmergencyStopActive(), true);

    await assert.rejects(async () => {
      await executeTool('analyze_structural_beam', {}, 'JARVIS');
    }, /Emergency Stop is ACTIVE/);

    permissionGateInstance.resetEmergencyStop();
    assert.strictEqual(permissionGateInstance.isEmergencyStopActive(), false);

    const postReset = await executeTool('analyze_structural_beam', {
      loadN: 50,
      lengthM: 0.2,
      widthM: 0.02,
      heightM: 0.01
    }, 'JARVIS');
    assert.strictEqual(postReset.success, true);
  });

  await it('7.4. Voice & text command interpreter resolves natural language engineering queries', () => {
    // Beam stress query
    const matchBeam = commandInterpreterInstance.interpret('JARVIS calculate bending stress on the beam');
    assert.strictEqual(matchBeam.matched, true);
    assert.strictEqual(matchBeam.toolName, 'analyze_structural_beam');

    // Robot kinematics query
    const matchKin = commandInterpreterInstance.interpret('calculate forward kinematics for the arm');
    assert.strictEqual(matchKin.matched, true);
    assert.strictEqual(matchKin.toolName, 'calculate_robot_kinematics');

    // Power budget query
    const matchPwr = commandInterpreterInstance.interpret('calculate the battery power budget');
    assert.strictEqual(matchPwr.matched, true);
    assert.strictEqual(matchPwr.toolName, 'calculate_power_budget');
  });

  console.log('\n===============================================================================');
  console.log(`CAMPAIGN SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('===============================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCampaign().catch(err => {
  console.error('[FATAL] Engineering campaign failed:', err);
  process.exit(1);
});
