/**
 * STARK AI — PHASE 12 CORRECTIVE PATCH REGRESSION TEST SUITE
 * Structural Beam Bending Calculation: Mathematical Verification & Boundary Security
 * 
 * Tests:
 * A. Original cantilever benchmark (M=8000 Nm, S=8.333e-5 m3, sigma=96 MPa, SF=2.6042)
 * B. Load scaling (Double load -> stress doubles to 192 MPa, SF halves to 1.3021)
 * C. Width scaling (Double width -> S doubles, stress halves to 48 MPa, SF doubles to 5.2083)
 * D. Height scaling (Double height -> S quadruples, stress quarters to 24 MPa, SF quadruples to 10.4167)
 * E. Unit conversions (kN, N, mm, m consistency check)
 * F. Input validation (Zero, negative dimensions, negative strength, unsupported configs)
 * G. Safety qualification & engineering disclaimer integrity
 * H. Execution-boundary security & Emergency Stop enforcement
 */

const assert = require('assert');
const { engineeringIntelligenceEngineInstance } = require('./server/science/engineeringIntelligenceEngine.js');
const { permissionPolicyEngineInstance } = require('./server/security/permissionPolicyEngine.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');

async function runStructuralBeamRegressionSuite() {
  console.log('================================================================');
  console.log('🧪 STARK AI: PHASE 12 STRUCTURAL BEAM REGRESSION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(desc, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [FAIL] ${desc}: ${e.message}`);
    }
  }

  async function testAsync(desc, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [FAIL] ${desc}: ${e.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST A: ORIGINAL CANTILEVER BENCHMARK
  // -------------------------------------------------------------------------
  await testAsync('Test A: Original Cantilever (P=4000N, L=2m, b=0.05m, h=0.10m, Yield=250MPa)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 2.0,
      width_meters: 0.05,
      height_meters: 0.10,
      yield_strength_mpa: 250.0,
      configuration: 'cantilever'
    });

    assert.strictEqual(res.success, true);
    
    // Expected: M = P * L = 8000 N*m
    const expectedM = 4000 * 2.0;
    assert.strictEqual(Math.abs(res.maxBendingMomentNm - expectedM) < 1e-4, true, `M_max should be ${expectedM} N*m`);

    // Expected: S = (b * h^2) / 6 = (0.05 * 0.01) / 6 = 8.333333333e-5 m^3
    const expectedS = (0.05 * Math.pow(0.10, 2)) / 6.0;
    assert.strictEqual(Math.abs(res.sectionModulusM3 - expectedS) < 1e-9, true, `Section modulus S should be ${expectedS}`);

    // Expected: sigma = M / S = 8000 / (8.333333333e-5) = 96,000,000 Pa = 96 MPa
    const expectedStressMpa = 96.0;
    assert.strictEqual(Math.abs(res.maxBendingStressMpa - expectedStressMpa) < 1e-4, true, `Bending stress should be ${expectedStressMpa} MPa, got ${res.maxBendingStressMpa}`);

    // Expected: SF = 250 / 96 = 2.604166667
    const expectedSf = 250.0 / 96.0;
    assert.strictEqual(Math.abs(res.safetyFactor - expectedSf) < 1e-4, true, `Safety factor should be ~${expectedSf.toFixed(4)}, got ${res.safetyFactor}`);
    assert.strictEqual(res.designStatus, 'ADEQUATE');
  });

  // -------------------------------------------------------------------------
  // TEST B: LOAD SCALING (DOUBLE APPLIED LOAD)
  // -------------------------------------------------------------------------
  await testAsync('Test B: Double Applied Load (P=8000N -> Stress doubles to 192 MPa, SF halves to 1.3021)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 8000,
      length_meters: 2.0,
      width_meters: 0.05,
      height_meters: 0.10,
      yield_strength_mpa: 250.0,
      configuration: 'cantilever'
    });

    assert.strictEqual(res.success, true);
    // Moment doubles: 16000 N*m
    assert.strictEqual(Math.abs(res.maxBendingMomentNm - 16000.0) < 1e-4, true);
    // Stress doubles: 96 * 2 = 192 MPa
    assert.strictEqual(Math.abs(res.maxBendingStressMpa - 192.0) < 1e-4, true);
    // SF halves: 2.6041667 / 2 = 1.3020833
    const expectedSf = 250.0 / 192.0;
    assert.strictEqual(Math.abs(res.safetyFactor - expectedSf) < 1e-4, true);
  });

  // -------------------------------------------------------------------------
  // TEST C: WIDTH SCALING (DOUBLE BEAM WIDTH)
  // -------------------------------------------------------------------------
  await testAsync('Test C: Double Beam Width (b=0.10m -> S doubles, Stress halves to 48 MPa, SF doubles to 5.2083)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 2.0,
      width_meters: 0.10, // Doubled from 0.05
      height_meters: 0.10,
      yield_strength_mpa: 250.0,
      configuration: 'cantilever'
    });

    assert.strictEqual(res.success, true);
    // S doubles: (0.10 * 0.01) / 6 = 1.6666667e-4 m^3
    const expectedS = (0.10 * Math.pow(0.10, 2)) / 6.0;
    assert.strictEqual(Math.abs(res.sectionModulusM3 - expectedS) < 1e-9, true);
    // Stress halves: 96 / 2 = 48 MPa
    assert.strictEqual(Math.abs(res.maxBendingStressMpa - 48.0) < 1e-4, true);
    // SF doubles: 250 / 48 = 5.208333
    const expectedSf = 250.0 / 48.0;
    assert.strictEqual(Math.abs(res.safetyFactor - expectedSf) < 1e-4, true);
  });

  // -------------------------------------------------------------------------
  // TEST D: HEIGHT SCALING (DOUBLE BEAM HEIGHT)
  // -------------------------------------------------------------------------
  await testAsync('Test D: Double Beam Height (h=0.20m -> S quadruples, Stress becomes 1/4 = 24 MPa, SF quadruples to 10.4167)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 2.0,
      width_meters: 0.05,
      height_meters: 0.20, // Doubled from 0.10
      yield_strength_mpa: 250.0,
      configuration: 'cantilever'
    });

    assert.strictEqual(res.success, true);
    // S quadruples: (0.05 * 0.04) / 6 = 3.3333333e-4 m^3
    const expectedS = (0.05 * Math.pow(0.20, 2)) / 6.0;
    assert.strictEqual(Math.abs(res.sectionModulusM3 - expectedS) < 1e-9, true);
    // Stress becomes 1/4th: 96 / 4 = 24 MPa
    assert.strictEqual(Math.abs(res.maxBendingStressMpa - 24.0) < 1e-4, true);
    // SF quadruples: 250 / 24 = 10.416667
    const expectedSf = 250.0 / 24.0;
    assert.strictEqual(Math.abs(res.safetyFactor - expectedSf) < 1e-4, true);
  });

  // -------------------------------------------------------------------------
  // TEST E: UNIT CONVERSIONS (kN, mm, m consistency)
  // -------------------------------------------------------------------------
  await testAsync('Test E: Unit Conversions (load_kn=4.0, length_mm=2000, width_mm=50, height_mm=100)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_kn: 4.0,           // 4 kN = 4000 N
      length_mm: 2000,        // 2000 mm = 2.0 m
      width_mm: 50,           // 50 mm = 0.05 m
      height_mm: 100,         // 100 mm = 0.10 m
      yield_strength_mpa: 250.0
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(Math.abs(res.appliedLoadN - 4000.0) < 1e-4, true);
    assert.strictEqual(Math.abs(res.lengthM - 2.0) < 1e-4, true);
    assert.strictEqual(Math.abs(res.widthM - 0.05) < 1e-4, true);
    assert.strictEqual(Math.abs(res.heightM - 0.10) < 1e-4, true);
    assert.strictEqual(Math.abs(res.maxBendingMomentNm - 8000.0) < 1e-4, true);
    assert.strictEqual(Math.abs(res.maxBendingStressMpa - 96.0) < 1e-4, true);
    assert.strictEqual(Math.abs(res.safetyFactor - (250.0 / 96.0)) < 1e-4, true);
  });

  // -------------------------------------------------------------------------
  // TEST F: INVALID INPUTS & UNSUPPORTED BOUNDARY CONDITIONS
  // -------------------------------------------------------------------------
  await testAsync('Test F1: Rejection of zero or negative dimensions (L <= 0)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 0,
      width_meters: 0.05,
      height_meters: 0.10
    });
    assert.strictEqual(res.success, false);
    assert(res.error.includes('Beam length must be strictly positive'));
  });

  await testAsync('Test F2: Rejection of negative width (b <= 0)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 2.0,
      width_meters: -0.05,
      height_meters: 0.10
    });
    assert.strictEqual(res.success, false);
    assert(res.error.includes('Beam cross-section width must be strictly positive'));
  });

  await testAsync('Test F3: Rejection of negative height (h <= 0)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 2.0,
      width_meters: 0.05,
      height_meters: -0.10
    });
    assert.strictEqual(res.success, false);
    assert(res.error.includes('Beam cross-section height must be strictly positive'));
  });

  await testAsync('Test F4: Rejection of invalid yield strength (yield_strength_mpa <= 0)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 2.0,
      width_meters: 0.05,
      height_meters: 0.10,
      yield_strength_mpa: -250.0
    });
    assert.strictEqual(res.success, false);
    assert(res.error.includes('Yield strength must be strictly positive'));
  });

  await testAsync('Test F5: Rejection of unsupported boundary condition without fabricating data', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 2.0,
      width_meters: 0.05,
      height_meters: 0.10,
      configuration: 'fixed_wobble_indeterminate'
    });
    assert.strictEqual(res.success, false);
    assert(res.error.includes('Unsupported beam configuration'));
  });

  // -------------------------------------------------------------------------
  // TEST G: EXPLICIT SUPPORT CONDITIONS & LOADING VARIATIONS
  // -------------------------------------------------------------------------
  await testAsync('Test G1: Simply Supported Beam with Center Load (M_max = P*L/4 = 2000 N*m, Stress = 24 MPa, SF = 10.42)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 2.0,
      width_meters: 0.05,
      height_meters: 0.10,
      yield_strength_mpa: 250.0,
      configuration: 'simply_supported'
    });

    assert.strictEqual(res.success, true);
    // Simply supported with central load: M_max = (4000 * 2) / 4 = 2000 N*m
    assert.strictEqual(Math.abs(res.maxBendingMomentNm - 2000.0) < 1e-4, true);
    // Stress = 2000 / (8.3333333e-5) = 24 MPa
    assert.strictEqual(Math.abs(res.maxBendingStressMpa - 24.0) < 1e-4, true);
    // SF = 250 / 24 = 10.416667
    assert.strictEqual(Math.abs(res.safetyFactor - (250.0 / 24.0)) < 1e-4, true);
    assert.strictEqual(res.boundaryCondition, 'Pinned-Roller (Simply Supported)');
  });

  await testAsync('Test G2: Cantilever with Uniform Load (M_max = P*L/2 = 4000 N*m, Stress = 48 MPa, SF = 5.2083)', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 2.0,
      width_meters: 0.05,
      height_meters: 0.10,
      yield_strength_mpa: 250.0,
      configuration: 'cantilever_uniform'
    });

    assert.strictEqual(res.success, true);
    // Cantilever uniform load: M_max = (4000 * 2) / 2 = 4000 N*m
    assert.strictEqual(Math.abs(res.maxBendingMomentNm - 4000.0) < 1e-4, true);
    // Stress = 4000 / (8.3333333e-5) = 48 MPa
    assert.strictEqual(Math.abs(res.maxBendingStressMpa - 48.0) < 1e-4, true);
    // SF = 250 / 48 = 5.208333
    assert.strictEqual(Math.abs(res.safetyFactor - (250.0 / 48.0)) < 1e-4, true);
  });

  // -------------------------------------------------------------------------
  // TEST H: MANDATORY ENGINEERING SAFETY QUALIFICATION INTEGRITY
  // -------------------------------------------------------------------------
  await testAsync('Test H: Mandatory engineering safety qualification explicitly embedded', async () => {
    const res = await engineeringIntelligenceEngineInstance.analyzeStructuralBeam({
      load_newtons: 4000,
      length_meters: 2.0,
      width_meters: 0.05,
      height_meters: 0.10,
      yield_strength_mpa: 250.0
    });

    assert.strictEqual(res.success, true);
    const disclaimer = (res.safetyDisclaimer || '').toLowerCase();
    assert(disclaimer.includes('a beam safety factor of 1.5 is an initial screening indicator and not a universal engineering safety guarantee'), 'Disclaimer must emphasize SF=1.5 is not a universal guarantee');
    assert(disclaimer.includes('building codes'), 'Disclaimer must mention building codes');
    assert(disclaimer.includes('buckling'), 'Disclaimer must mention buckling');
    assert(disclaimer.includes('fatigue'), 'Disclaimer must mention dynamic/fatigue loading');
    assert(disclaimer.includes('professional'), 'Disclaimer must require qualified professional engineering review');
    assert.strictEqual(typeof res.yieldSafetyFactor, 'number');
  });

  // -------------------------------------------------------------------------
  // TEST I: EXECUTION-BOUNDARY SECURITY & EMERGENCY STOP INTEGRATION
  // -------------------------------------------------------------------------
  await testAsync('Test I1: Normal authorized call succeeds through Central Permission Gate', async () => {
    emergencyStopControllerInstance.reset();
    const { executeTool } = require('./server/toolsRegistry.js');
    const authRes = await executeTool('engineering_system_analyzer', {
      type: 'structural_beam',
      parameters: {
        load_newtons: 4000,
        length_meters: 2.0,
        width_meters: 0.05,
        height_meters: 0.10,
        yield_strength_mpa: 250.0
      }
    }, 'JARVIS');
    assert.strictEqual(authRes.success, true);
    assert.strictEqual(Math.abs(authRes.maxBendingStressMpa - 96.0) < 0.01, true);
  });

  await testAsync('Test I2: Restricted/Unauthorized action is blocked at Central Permission Gate', async () => {
    assert.throws(() => {
      permissionGateInstance.authorizeToolExecution('delete_system_critical_file', {}, 'JARVIS');
    }, /Security Violation|Restricted|Denied|prohibited/i);
  });

  await testAsync('Test I3: Emergency Stop halts execution at runtime and Reset returns to STANDBY', async () => {
    // 1. Engage Emergency Stop
    emergencyStopControllerInstance.engage('Phase 12 Structural Patch Boundary Check');
    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), true);

    // 2. Execution must be rejected at boundary
    const { executeTool } = require('./server/toolsRegistry.js');
    let blocked = false;
    try {
      await executeTool('engineering_system_analyzer', {
        type: 'structural_beam',
        parameters: { load_newtons: 4000 }
      }, 'JARVIS');
    } catch (err) {
      blocked = err.message.includes('EMERGENCY_STOP_ACTIVE') || err.message.includes('Emergency Stop') || err.message.includes('Security Violation');
    }
    assert.strictEqual(blocked, true, 'Execution must be blocked when Emergency Stop is engaged');

    // 3. Reset Emergency Stop restores clean STANDBY
    emergencyStopControllerInstance.reset();
    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), false);

    // 4. Tool works normally again
    const postReset = await executeTool('engineering_system_analyzer', {
      type: 'structural_beam',
      parameters: {
        load_newtons: 4000,
        length_meters: 2.0,
        width_meters: 0.05,
        height_meters: 0.10,
        yield_strength_mpa: 250.0
      }
    }, 'JARVIS');
    assert.strictEqual(postReset.success, true);
    assert.strictEqual(Math.abs(postReset.maxBendingStressMpa - 96.0) < 0.01, true);
  });

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Results: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`----------------------------------------------------------------`);

  if (passed === total) {
    console.log('🎉 ALL STRUCTURAL BEAM REGRESSION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runStructuralBeamRegressionSuite().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
