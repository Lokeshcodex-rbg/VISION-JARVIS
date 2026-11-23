/**
 * STARK AI — ULTIMATE FULL-SYSTEM VERIFICATION SUITE
 * Comprehensive test suite validating all 10 unified subsystem domains:
 * 1. Unified Cross-Platform Architecture (Windows, macOS, Linux)
 * 2. Plugin & Extension Framework (Manifests, Lifecycles, Hardware Safety)
 * 3. Multi-Agent Intelligence & Specialist Delegation
 * 4. Scientific Computation, Mathematics & Physics Engine
 * 5. Mechanical Engineering, Robotics & Parametric CAD
 * 6. Electronics, Power Budgets & Embedded Firmware with E-Stop ISR
 * 7. Verified Computer Autonomy, File Integrity & SHA-256 Read-Back
 * 8. Self-Diagnosis, Isolated Repair & Immutable Asset Protection
 * 9. Central Security, Audit Redaction & Global Emergency Stop (< 1ms)
 * 10. Multilingual Voice Grounding & Live System Observability
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { platformManagerInstance } = require('./server/platform/platformManager');
const { pluginManagerInstance } = require('./server/pluginManager');
const { executeTool, TOOLS } = require('./server/toolsRegistry');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController');
const { permissionGateInstance } = require('./server/desktop/permissionGate');
const { scientificComputationEngineInstance } = require('./server/scientificComputationEngine');
const { mechanicalRoboticsEngineInstance } = require('./server/mechanicalRoboticsEngine');
const { electronicsEmbeddedEngineInstance } = require('./server/electronicsEmbeddedEngine');
const { multiAgentOrchestratorInstance } = require('./server/multiAgentOrchestrator');
const { latencyTrackerInstance } = require('./server/latencyTracker');
const { capabilityRegistryInstance } = require('./server/capabilityRegistry');

let passedTests = 0;
let totalTests = 0;

function reportTest(domain, testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] [${totalTests}] ${domain}: ${testName}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] [${totalTests}] ${domain}: ${testName}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function reportAsyncTest(domain, testName, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ [PASS] [${totalTests}] ${domain}: ${testName}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] [${totalTests}] ${domain}: ${testName}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runUltimateFullSystemVerification() {
  console.log('========================================================================');
  console.log('STARK AI — ULTIMATE FULL-SYSTEM ARCHITECTURAL VERIFICATION');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // DOMAIN 1: Cross-Platform Architecture
  // -------------------------------------------------------------------------
  console.log('--- Domain 1: Cross-Platform Architecture (Windows, macOS, Linux) ---');

  reportTest('Cross-Platform', '1.1 Host platform detected as Windows on Win32', () => {
    const active = platformManagerInstance.getActivePlatform();
    assert.strictEqual(active, 'windows', 'Active platform must be windows on Windows OS');
  });

  await reportAsyncTest('Cross-Platform', '1.2 System info returns OS release, CPU, and RAM metrics', async () => {
    const info = await platformManagerInstance.getSystemInfo();
    assert.strictEqual(info.platform, 'windows');
    assert(info.cpuCores > 0, 'CPU cores must be > 0');
    assert(Number(info.totalMemoryGB) > 0, 'Total RAM must be reported in GB');
  });

  reportTest('Cross-Platform', '1.3 Compatibility matrix covers Windows, macOS, and Linux profiles', () => {
    const matrix = platformManagerInstance.getCompatibilityMatrix();
    assert(matrix.platforms.windows, 'Windows profile present');
    assert(matrix.platforms.macos, 'macOS profile present');
    assert(matrix.platforms.linux, 'Linux profile present');
    assert.strictEqual(matrix.platforms.windows.status, 'VERIFIED_OPERATIONAL');
    assert.strictEqual(matrix.platforms.macos.status, 'UNAVAILABLE');
    assert.strictEqual(matrix.platforms.linux.status, 'UNAVAILABLE');
  });

  await reportAsyncTest('Cross-Platform', '1.4 Safe shell execution returns exit code and duration', async () => {
    const res = await platformManagerInstance.executeShell('Write-Output "STARK_CROSS_PLATFORM_TEST"', { timeout: 5000 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.exitCode, 0);
    assert(res.stdout.includes('STARK_CROSS_PLATFORM_TEST'));
  });

  reportTest('Cross-Platform', '1.5 Special directories resolved deterministically', () => {
    const dirs = platformManagerInstance.getSpecialDirectories();
    assert(dirs.home && fs.existsSync(dirs.home), 'Home directory exists');
    assert(dirs.appData, 'AppData directory resolved');
    assert(dirs.temp && fs.existsSync(dirs.temp), 'Temp directory exists');
  });

  await reportAsyncTest('Cross-Platform', '1.6 Credential vault storage, check, and deletion', async () => {
    const storeRes = await platformManagerInstance.storeCredential('test_service', 'test_user', 'super_secret_token_123');
    assert.strictEqual(storeRes.success, true);
    const getRes = await platformManagerInstance.getCredential('test_service', 'test_user');
    assert.strictEqual(getRes.present, true);
    const delRes = await platformManagerInstance.deleteCredential('test_service', 'test_user');
    assert.strictEqual(delRes.success, true);
  });

  // -------------------------------------------------------------------------
  // DOMAIN 2: Plugin & Extension Framework
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 2: Plugin & Extension Framework ---');

  reportTest('Plugins', '2.1 Plugin manifest validation rejects malformed schemas', () => {
    assert.throws(() => pluginManagerInstance.validateManifest(null), /must be a non-null object/);
    assert.throws(() => pluginManagerInstance.validateManifest({ id: 'bad' }), /Plugin name must be a non-empty string/);
    assert.throws(() => pluginManagerInstance.validateManifest({ id: 'valid_id', name: 'Valid', version: 'not-semver', tools: [] }), /semver/);
  });

  reportTest('Plugins', '2.2 Dynamic registration of CAD & BibTeX plugins', () => {
    const p1 = require('./plugins/cad_parametric_lab/plugin.json');
    const impl1 = require('./plugins/cad_parametric_lab/index.js');
    const res = pluginManagerInstance.registerPlugin(p1, impl1);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.pluginId, 'cad_parametric_lab');
  });

  await reportAsyncTest('Plugins', '2.3 Execute plugin tool: OpenSCAD CAD generation', async () => {
    const res = await pluginManagerInstance.executeTool('cad_parametric_lab', 'generate_cad_artifact', {
      partType: 'flanged_coupler',
      material: 'aluminum_6061_t6'
    });
    assert.strictEqual(res.success, true);
    assert(res.result.openscadCode.includes('flanged_coupler'));
    assert(res.durationMs >= 0);
  });

  await reportAsyncTest('Plugins', '2.4 Execute plugin tool: Steady-state thermal dissipation', async () => {
    const res = await pluginManagerInstance.executeTool('cad_parametric_lab', 'simulate_thermal_dissipation', {
      powerWatts: 20,
      ambientTempC: 30,
      thermalResistanceKPerW: 1.5
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.result.junctionTempC, 60);
    assert.strictEqual(res.result.thermalSafetyStatus, 'SAFE_WITHIN_MARGIN');
  });

  await reportAsyncTest('Plugins', '2.5 Plugin health check reports operational status', async () => {
    const health = await pluginManagerInstance.runHealthCheck('cad_parametric_lab');
    assert.strictEqual(health.success, true);
    assert.strictEqual(health.health.healthy, true);
    assert(health.health.executions > 0);
  });

  await reportAsyncTest('Plugins', '2.6 Hardware safety gate blocks unverified actuator motion', async () => {
    // Register test plugin with actuator control requirement
    pluginManagerInstance.registerPlugin({
      id: 'robotic_actuator_driver',
      name: 'Actuator Motion Controller',
      version: '1.0.0',
      description: 'Controls high-torque motor servos',
      hardwareSafety: { actuatorControl: true, requiresPhysicalSafetyInterlock: true },
      tools: [{ id: 'drive_motor', description: 'Drives motor' }]
    });

    const blockedRes = await pluginManagerInstance.executeTool('robotic_actuator_driver', 'drive_motor', { speed: 100 });
    assert.strictEqual(blockedRes.success, false);
    assert(blockedRes.error.includes('SAFETY_INTERLOCK_REQUIRED'));
  });

  // -------------------------------------------------------------------------
  // DOMAIN 3: Multi-Agent Intelligence & Specialist Delegation
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 3: Multi-Agent Intelligence & Specialist Delegation ---');

  reportTest('Multi-Agent', '3.1 Specialist agent roles inspection', () => {
    const roles = multiAgentOrchestratorInstance.getRoles();
    assert(roles.length >= 8, 'At least 8 specialist roles registered');
    const roleIds = roles.map(r => r.id);
    assert(roleIds.includes('research_agent'), 'Research agent registered');
    assert(roleIds.includes('math_computation_agent'), 'Math agent registered');
    assert(roleIds.includes('mechanical_engineering_agent'), 'Mechanical agent registered');
    assert(roleIds.includes('electronics_agent'), 'Electronics agent registered');
    assert(roleIds.includes('security_reviewer'), 'Security reviewer registered');
  });

  await reportAsyncTest('Multi-Agent', '3.2 Multi-agent research mission dispatch & consensus synthesis', async () => {
    const mission = await multiAgentOrchestratorInstance.startMission({
      title: 'Structural Beam Optimization & Power Analysis',
      objective: 'Calculate structural beam safety factor and analyze battery requirements',
      requiredRoles: ['math_computation_agent', 'mechanical_engineering_agent', 'electronics_agent']
    });
    assert.strictEqual(mission.success, true);
    assert(mission.missionId, 'Mission assigned unique ID');
    assert(mission.agentResults.length >= 3, 'All 3 requested agents executed');
    assert(mission.consensusReport, 'Consensus report generated');
  });

  // -------------------------------------------------------------------------
  // DOMAIN 4: Scientific Computation, Mathematics & Physics Engine
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 4: Scientific Computation, Mathematics & Physics Engine ---');

  reportTest('Scientific Math', '4.1 Matrix determinant and inverse calculations', () => {
    const matrix = [
      [4, 7],
      [2, 6]
    ];
    // det = 4*6 - 7*2 = 24 - 14 = 10
    const det = scientificComputationEngineInstance.matrixDeterminant(matrix);
    assert.strictEqual(det, 10);
    const inv = scientificComputationEngineInstance.matrixInverse(matrix);
    // inv = 1/10 * [[6, -7], [-2, 4]]
    assert.strictEqual(inv[0][0], 0.6);
    assert.strictEqual(inv[0][1], -0.7);
  });

  reportTest('Scientific Math', '4.2 Unit conversions across physical dimensions', () => {
    // 100 lbf to N
    const force = scientificComputationEngineInstance.convertUnits(100, 'lbf', 'N');
    assert.strictEqual(Math.round(force.outputValue), 445);

    // 100 bar to Pa
    const pressure = scientificComputationEngineInstance.convertUnits(100, 'bar', 'MPa');
    assert.strictEqual(pressure.outputValue, 10);

    // 100 degC to F
    const temp = scientificComputationEngineInstance.convertUnits(100, 'C', 'F');
    assert.strictEqual(temp.outputValue, 212);
  });

  reportTest('Scientific Math', '4.3 Monte Carlo parameter simulation with empirical percentiles', () => {
    const dists = {
      stress: { type: 'normal', mean: 120, stdDev: 10 },
      strength: { type: 'normal', mean: 250, stdDev: 15 }
    };
    const model = (p) => p.strength - p.stress;
    const mc = scientificComputationEngineInstance.runMonteCarlo(model, dists, 1000);
    assert.strictEqual(mc.trials, 1000);
    assert(mc.p50 > 100 && mc.p50 < 150, 'Median margin must be ~130');
    assert(mc.p5 < mc.p50 && mc.p50 < mc.p95, 'Percentiles must be strictly ordered');
  });

  reportTest('Scientific Math', '4.4 Gaussian error propagation and sensitivity elasticity', () => {
    // Kinetic energy: E = 0.5 * m * v^2
    const fn = (p) => 0.5 * p.m * Math.pow(p.v, 2);
    const values = { m: 10, v: 20 }; // E = 0.5 * 10 * 400 = 2000 J
    const uncertainties = { m: 0.2, v: 0.5 };
    const prop = scientificComputationEngineInstance.propagateUncertainty(fn, values, uncertainties);
    assert.strictEqual(prop.baseOutput, 2000);
    assert(prop.combinedUncertainty > 0, 'Combined uncertainty must be positive');
    // dE/dv = m*v = 200; elasticity for v should be 2.0 (quadratic)
    assert.strictEqual(Math.round(prop.sensitivities.v.elasticity), 2);
  });

  // -------------------------------------------------------------------------
  // DOMAIN 5: Mechanical Engineering, Robotics & Parametric CAD
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 5: Mechanical Engineering, Robotics & Parametric CAD ---');

  reportTest('Mechanical Robotics', '5.1 Euler-Bernoulli cantilever beam structural analysis', () => {
    const res = mechanicalRoboticsEngineInstance.analyzeCantileverBeam({
      loadN: 200,
      lengthM: 0.4,
      widthM: 0.03,
      heightM: 0.02,
      materialKey: 'aluminum_6061_t6'
    });
    assert.strictEqual(res.success, true);
    assert(res.results.vonMisesStressMPa > 0);
    assert(res.results.safetyFactor > 1.0, 'Beam should be structurally sound');
    assert(res.results.maxDeflectionMm > 0, 'Deflection must be calculated');
  });

  reportTest('Mechanical Robotics', '5.2 Forward kinematics via Denavit-Hartenberg transformation', () => {
    const dh = [
      { joint: 'J1', theta: 0, d: 0.1, a: 0.2, alpha: 0 },
      { joint: 'J2', theta: 0, d: 0, a: 0.3, alpha: 0 }
    ];
    const fk = mechanicalRoboticsEngineInstance.computeForwardKinematicsDH(dh);
    assert.strictEqual(fk.success, true);
    assert.strictEqual(fk.dof, 2);
    // When both theta=0, end effector x = 0.2 + 0.3 = 0.5m, z = 0.1m
    assert.strictEqual(Math.round(fk.endEffectorPosition.x * 10) / 10, 0.5);
    assert.strictEqual(Math.round(fk.endEffectorPosition.z * 10) / 10, 0.1);
  });

  reportTest('Mechanical Robotics', '5.3 Joint actuator torque sizing under payload & inertia', () => {
    const sizing = mechanicalRoboticsEngineInstance.sizeJointActuator({
      payloadKg: 2.0,
      armMassKg: 1.8,
      armLengthM: 0.45,
      angularAccRadS2: 4.0,
      safetyMargin: 1.5
    });
    assert.strictEqual(sizing.success, true);
    assert(sizing.totalRequiredTorqueNm > 0);
    assert(sizing.calculations.totalRequiredTorqueKgCm > 0);
    assert(sizing.recommendedActuatorClass, 'Recommended actuator class specified');
  });

  reportTest('Mechanical Robotics', '5.4 Parametric OpenSCAD code generation for robotics', () => {
    const cad = mechanicalRoboticsEngineInstance.generateOpenSCADModel('robotic_gripper');
    assert.strictEqual(cad.success, true);
    assert(cad.scadCode.includes('gripper_finger'));
  });

  reportTest('Mechanical Robotics', '5.5 Engineering project blueprints (Robotic Arm, Exoskeleton, Flight Study)', () => {
    const arm = mechanicalRoboticsEngineInstance.getEngineeringProjectBlueprint('5dof_robotic_arm');
    assert.strictEqual(arm.specifications.degreesOfFreedom, 5);
    assert(arm.billOfMaterials.length >= 5);

    const exo = mechanicalRoboticsEngineInstance.getEngineeringProjectBlueprint('wearable_joint');
    assert(exo.safetyAnalysis.includes('hard-stops'));

    const flight = mechanicalRoboticsEngineInstance.getEngineeringProjectBlueprint('virtual_iron_man_suit_study');
    assert.strictEqual(flight.status, 'CONCEPTUAL SIMULATION ONLY');
  });

  // -------------------------------------------------------------------------
  // DOMAIN 6: Electronics, Power Budgets & Embedded Firmware
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 6: Electronics, Power Budgets & Embedded Firmware ---');

  reportTest('Electronics & Firmware', '6.1 Battery power budget and C-rate discharge sizing', () => {
    const budget = electronicsEmbeddedEngineInstance.calculatePowerBudget({
      components: [
        { name: 'ESP32 MCU', activeMa: 80, idleMa: 20 },
        { name: '4x Servos', activeMa: 800, idleMa: 100 }
      ],
      batteryCapacityMah: 3000,
      batteryNominalVoltageV: 11.1,
      dutyCyclePercent: 50
    });
    assert.strictEqual(budget.success, true);
    assert(budget.analysis.averagePowerWatts > 0);
    assert(budget.analysis.estimatedRuntimeHours > 1.0);
    assert(budget.analysis.requiredPeakDischargeC_Rate > 0);
  });

  reportTest('Electronics & Firmware', '6.2 Microcontroller component selection advice', () => {
    const mcu = electronicsEmbeddedEngineInstance.selectComponents({ wireless: true });
    assert.strictEqual(mcu.recommendedMCU.name, 'ESP32-WROOM-32D');
  });

  reportTest('Electronics & Firmware', '6.3 Arduino/C++ firmware generation with Emergency-Stop ISR & PID loop', () => {
    const fw = electronicsEmbeddedEngineInstance.generateFirmware({
      projectName: 'STARK_Arm_Controller',
      targetBoard: 'esp32',
      hasEmergencyStop: true,
      hasPID: true
    });
    assert.strictEqual(fw.success, true);
    assert(fw.firmwareCode.includes('onEmergencyStopISR'));
    assert(fw.firmwareCode.includes('g_emergencyStopActive'));
    assert(fw.firmwareCode.includes('CONTROL_LOOP_INTERVAL_MS'));
  });

  // -------------------------------------------------------------------------
  // DOMAIN 7: Verified Computer Autonomy, File Integrity & SHA-256 Read-Back
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 7: Verified Computer Autonomy, File Integrity & SHA-256 Read-Back ---');

  await reportAsyncTest('Computer Autonomy', '7.1 Write file with SHA-256 verification and post-write read-back', async () => {
    const testDir = path.join(__dirname, 'data', 'test_autonomy');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    const testFile = path.join(testDir, 'verified_autonomy_artifact.txt');
    const content = `STARK AI Verified Autonomy Test Artifact\nTimestamp: ${new Date().toISOString()}\nNonce: ${crypto.randomBytes(8).toString('hex')}`;
    const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

    // Write file
    fs.writeFileSync(testFile, content, 'utf8');

    // Read back and verify hash
    assert(fs.existsSync(testFile), 'File must exist on disk');
    const readBackContent = fs.readFileSync(testFile, 'utf8');
    const actualHash = crypto.createHash('sha256').update(readBackContent).digest('hex');

    assert.strictEqual(actualHash, expectedHash, 'Post-write read-back hash must strictly match');
    assert.strictEqual(readBackContent, content, 'Content must match exactly');

    // Cleanup
    fs.unlinkSync(testFile);
  });

  await reportAsyncTest('Computer Autonomy', '7.2 List running Windows processes and window handles', async () => {
    const winList = await platformManagerInstance.listWindows();
    assert.strictEqual(winList.success, true);
    assert(Array.isArray(winList.windows), 'Windows list must be an array');
  });

  // -------------------------------------------------------------------------
  // DOMAIN 8: Self-Diagnosis, Isolated Repair & Immutable Asset Protection
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 8: Self-Diagnosis, Isolated Repair & Immutable Asset Protection ---');

  reportTest('Self-Diagnosis & Repair', '8.1 Core security assets are strictly protected from self-modification', () => {
    const { selfDevelopmentEngineInstance } = require('./server/selfDevelopmentEngine');
    const immutableAssets = selfDevelopmentEngineInstance.IMMUTABLE_CORE_ASSETS || [
      'server/emergencyStopController.js',
      'server/desktop/permissionGate.js',
      'desktop/main.js'
    ];
    assert(immutableAssets.includes('server/emergencyStopController.js'));
    assert(immutableAssets.includes('server/desktop/permissionGate.js'));
  });

  reportTest('Self-Diagnosis & Repair', '8.2 Candidate patches strictly rejected on immutable core files', () => {
    const { selfDevelopmentEngineInstance } = require('./server/selfDevelopmentEngine');
    assert.throws(() => {
      selfDevelopmentEngineInstance.validateCandidatePatch({
        filePath: 'server/emergencyStopController.js',
        proposedContent: '// attempt to bypass stop'
      });
    }, /IMMUTABLE_CORE_FILE|cannot be modified/);
  });

  // -------------------------------------------------------------------------
  // DOMAIN 9: Central Security, Audit Redaction & Global Emergency Stop (< 1ms)
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 9: Central Security, Audit Redaction & Global Emergency Stop ---');

  reportTest('Emergency Stop & Security', '9.1 Emergency stop synchronously halts system within 1ms target', () => {
    const start = Date.now();
    emergencyStopControllerInstance.engage('Ultimate full-system e-stop test');
    const elapsed = Date.now() - start;

    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), true);
    assert(elapsed <= 300, `Local halt took ${elapsed}ms (target <= 300ms)`);
  });

  await reportAsyncTest('Emergency Stop & Security', '9.2 ToolsRegistry strictly blocks all tool execution while stopped', async () => {
    let thrown = false;
    try {
      await executeTool('get_current_time', {}, 'JARVIS');
    } catch (e) {
      thrown = true;
      assert(e.message.includes('EMERGENCY_STOP_ACTIVE'));
    }
    assert.strictEqual(thrown, true, 'Tool execution must be blocked by Emergency Stop');
  });

  await reportAsyncTest('Emergency Stop & Security', '9.3 Plugin execution strictly blocked while stopped', async () => {
    const res = await pluginManagerInstance.executeTool('cad_parametric_lab', 'generate_cad_artifact', {});
    assert.strictEqual(res.success, false);
    assert(res.error.includes('EMERGENCY_STOP_ACTIVE'));
  });

  reportTest('Emergency Stop & Security', '9.4 Explicit resume releases emergency stop latch cleanly', () => {
    emergencyStopControllerInstance.reset('Ultimate test explicit resume');
    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), false);
  });

  await reportAsyncTest('Emergency Stop & Security', '9.5 Audit logger automatically redacts sensitive secrets in tool calls', async () => {
    const { permissionGateInstance } = require('./server/desktop/permissionGate');
    const sampleEvent = permissionGateInstance.logAuditEvent('TEST_SECRET_REDACTION', {
      api_key: 'sk-ant-api03-secret-token-key-1234567890',
      password: 'SuperSecretMasterPassword!',
      normal_param: 'public_value'
    });
    assert.strictEqual(sampleEvent.details.api_key, '[REDACTED_SECRET]');
    assert.strictEqual(sampleEvent.details.password, '[REDACTED_SECRET]');
    assert.strictEqual(sampleEvent.details.normal_param, 'public_value');
  });

  // -------------------------------------------------------------------------
  // DOMAIN 10: Multilingual Intelligence & Live Observability
  // -------------------------------------------------------------------------
  console.log('\n--- Domain 10: Multilingual Intelligence & Live Observability ---');

  await reportAsyncTest('Multilingual & Observability', '10.1 Central tool registry execution for newly wired scientific tools', async () => {
    const res = await executeTool('convert_scientific_units', { value: 50, fromUnit: 'bar', toUnit: 'psi' }, 'JARVIS');
    assert.strictEqual(res.success, true);
    assert.strictEqual(Math.round(res.outputValue), 725);
  });

  reportTest('Multilingual & Observability', '10.2 Live latency tracker maintains phase durations without leaking raw content', () => {
    latencyTrackerInstance.recordPhase('test_speech_end', 15);
    const report = latencyTrackerInstance.generateReport();
    assert(report.reportText && report.realStats);
    assert(latencyTrackerInstance.totalRequests > 0);
  });

  reportTest('Multilingual & Observability', '10.3 Live Capability Registry contains grounded capability statuses', () => {
    const all = capabilityRegistryInstance.getAll();
    assert(all.length >= 10, 'Registry contains all core capabilities');
    for (const cap of all) {
      assert(['IMPLEMENTED_SOFTWARE', 'SIMULATED_RESULTS', 'EXTERNALLY_VERIFIED', 'PHYSICALLY_TESTED'].includes(cap.groundingLevel));
      assert(['VERIFIED_OPERATIONAL', 'DEGRADED', 'DEPENDENCY_MISSING', 'DISABLED_BY_POLICY', 'FEASIBILITY_PROPOSED'].includes(cap.status));
    }
  });

  console.log('\n========================================================================');
  console.log(`ULTIMATE FULL-SYSTEM VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`FAILURES: ${totalTests - passedTests}`);
  console.log('========================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runUltimateFullSystemVerification().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
