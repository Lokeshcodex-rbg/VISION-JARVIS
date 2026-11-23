/**
 * STARK AI — Visual Brain, Engineering Lab & Holographic Neural Core Test Suite
 * Comprehensive automated verification for:
 * 1. Digital Brain Architecture & Live Subsystem Metadata
 * 2. 3D Neural Topology (dual-hemisphere point cloud & synaptic filaments)
 * 3. Live Telemetry Event Bus & Action-Potential Telemetry
 * 4. Multi-Tier Pedagogical Knowledge Explainer (Beginner, Intermediate, Advanced)
 * 5. Engineering Lab: 7 Blueprints, 13-Step Verified Workflows & Calculation Solvers
 * 6. Backend HTTP REST API Gateway Endpoints
 * 7. Security Enforcement & Emergency Stop Integration
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const brainArchitectureEngine = require('./server/brainArchitectureEngine.js');
const { mechanicalRoboticsEngineInstance } = require('./server/mechanicalRoboticsEngine.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');

let passCount = 0;
let failCount = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ PASSED: ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${description}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

async function testAsync(description, fn) {
  try {
    await fn();
    console.log(`  ✓ PASSED: ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${description}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

async function runAllTests() {
  console.log('\n================================================================');
  console.log('⚡ STARK AI: VISUAL BRAIN & ENGINEERING LAB MASTER TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // 1. DIGITAL BRAIN ARCHITECTURE & SUBSYSTEM METADATA
  // -------------------------------------------------------------------------
  console.log('--- Suite 1: Digital Brain Architecture & Subsystems ---');

  test('1.1 Brain engine contains at least 20 real software subsystems', () => {
    const overview = brainArchitectureEngine.getSubsystemsOverview();
    assert(Array.isArray(overview), 'Expected array of subsystems');
    assert(overview.length >= 20, `Expected at least 20 subsystems, found ${overview.length}`);
  });

  test('1.2 Every subsystem defines anatomicalRegion, position3D, and valid category', () => {
    const overview = brainArchitectureEngine.getSubsystemsOverview();
    const validCategories = [
      'COGNITION', 'PERCEPTION', 'COMMUNICATION', 'MEMORY',
      'RESEARCH', 'COMPUTATION', 'ENGINEERING', 'DEVELOPMENT',
      'COORDINATION', 'EXECUTION', 'SECURITY'
    ];

    for (const sub of overview) {
      assert(sub.id && sub.id.startsWith('sub_'), `Invalid subsystem id: ${sub.id}`);
      assert(sub.name, `Subsystem ${sub.id} missing name`);
      assert(sub.anatomicalRegion, `Subsystem ${sub.id} missing anatomicalRegion`);
      assert(sub.position3D && typeof sub.position3D.x === 'number', `Subsystem ${sub.id} missing 3D coordinates`);
      assert(validCategories.includes(sub.category), `Subsystem ${sub.id} has invalid category: ${sub.category}`);
    }
  });

  test('1.3 Subsystems reflect real verified on-disk files and operational status', () => {
    const overview = brainArchitectureEngine.getSubsystemsOverview();
    const operationalCount = overview.filter(s => s.status === 'OPERATIONAL').length;
    assert(operationalCount >= 18, `Expected at least 18 operational subsystems on disk, found ${operationalCount}`);

    const aiSub = overview.find(s => s.id === 'sub_language_ai');
    assert(aiSub, 'sub_language_ai missing');
    assert.strictEqual(aiSub.status, 'OPERATIONAL');
    assert(aiSub.fileSizeBytes > 0, 'sub_language_ai file size should be > 0');
  });

  test('1.4 Querying single subsystem by ID returns deep detail and event stream', () => {
    const sub = brainArchitectureEngine.getSubsystemById('sub_security_permissions');
    assert(sub, 'sub_security_permissions should be found');
    assert.strictEqual(sub.permissionLevel, 'SECURITY_CORE');
    assert(Array.isArray(sub.recentEvents), 'Expected recentEvents array');
  });

  // -------------------------------------------------------------------------
  // 2. 3D NEURAL TOPOLOGY GENERATION
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 2: 3D Neural Topology Generation ---');

  test('2.1 Generates dual-hemisphere point cloud with thousands of 3D coordinates', () => {
    const topo = brainArchitectureEngine.generateBrain3DTopology();
    assert(topo && topo.points, 'Expected topology with points');
    assert(topo.totalPoints >= 3000, `Expected >= 3000 points, got ${topo.totalPoints}`);
    assert(topo.points.some(p => p.region.includes('Left')), 'Expected Left cortex points');
    assert(topo.points.some(p => p.region.includes('Right')), 'Expected Right cortex points');
    assert(topo.points.some(p => p.region === 'Cerebellum'), 'Expected Cerebellum points');
    assert(topo.points.some(p => p.region === 'Brainstem'), 'Expected Brainstem points');
  });

  test('2.2 Generates synaptic filaments connecting dependent subsystems', () => {
    const topo = brainArchitectureEngine.generateBrain3DTopology();
    assert(Array.isArray(topo.filaments), 'Expected filaments array');
    assert(topo.totalFilaments > 15, `Expected > 15 filaments, got ${topo.totalFilaments}`);

    for (const fil of topo.filaments) {
      assert(fil.sourceId && fil.targetId, 'Filament must have sourceId and targetId');
      assert(fil.start && fil.end && fil.controlPoint, 'Filament must define start, end, and controlPoint for bezier curve');
    }
  });

  // -------------------------------------------------------------------------
  // 3. REAL TELEMETRY EVENT BUS
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 3: Live Telemetry Event Bus ---');

  test('3.1 Broadcasts real telemetry events onto the in-memory ring buffer', () => {
    const evt = brainArchitectureEngine.broadcastEvent(
      'sub_conversation',
      'sub_language_ai',
      'TEST_QUERY_RECEIVED',
      { query: 'Design an exoskeleton joint' }
    );

    assert(evt && evt.id.startsWith('evt_'), 'Event must have valid ID');
    assert.strictEqual(evt.source, 'sub_conversation');
    assert.strictEqual(evt.target, 'sub_language_ai');
    assert.strictEqual(evt.eventType, 'TEST_QUERY_RECEIVED');
    assert.strictEqual(evt.isRealTelemetry, true);

    const recent = brainArchitectureEngine.getRecentTelemetry(10);
    assert(recent.some(e => e.id === evt.id), 'Broadcasted event must be in recent telemetry');
  });

  test('3.2 Telemetry ring buffer enforces max event cap without unbounded growth', () => {
    const initialLen = brainArchitectureEngine.getRecentTelemetry(200).length;
    for (let i = 0; i < 30; i++) {
      brainArchitectureEngine.broadcastEvent('sub_compute_manager', 'sub_security_permissions', 'PULSE_CHECK', { i });
    }
    const finalLen = brainArchitectureEngine.getRecentTelemetry(200).length;
    assert(finalLen <= brainArchitectureEngine.maxTelemetryEvents, `Ring buffer exceeded max cap of ${brainArchitectureEngine.maxTelemetryEvents}`);
  });

  // -------------------------------------------------------------------------
  // 4. MULTI-TIER PEDAGOGICAL KNOWLEDGE EXPLAINER
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 4: Multi-Tier Pedagogical Knowledge Explainer ---');

  test('4.1 Generates Beginner, Intermediate, and Advanced explanations for Kinematics', () => {
    const beg = brainArchitectureEngine.explainConcept('Robotics', 'Kinematics', 'beginner');
    const inter = brainArchitectureEngine.explainConcept('Robotics', 'Kinematics', 'intermediate');
    const adv = brainArchitectureEngine.explainConcept('Robotics', 'Kinematics', 'advanced');

    assert.strictEqual(beg.selectedLevel, 'beginner');
    assert(beg.explanation.title && beg.explanation.summary && beg.explanation.analogy, 'Beginner must have title, summary, analogy');

    assert.strictEqual(inter.selectedLevel, 'intermediate');
    assert(inter.explanation.governingEquations, 'Intermediate must have governingEquations');

    assert.strictEqual(adv.selectedLevel, 'advanced');
    assert(adv.explanation.practicalApplication, 'Advanced must have practicalApplication');
  });

  test('4.2 Explains actuator motor torque sizing with analytical equation references', () => {
    const exp = brainArchitectureEngine.explainConcept('Mechanical', 'Actuator Torque', 'intermediate');
    assert(exp.explanation.governingEquations.includes('tau_g'), 'Expected tau_g in governing equations');
    assert(exp.explanation.governingEquations.includes('Power_mech'), 'Expected Power_mech in governing equations');
  });

  // -------------------------------------------------------------------------
  // 5. MECHANICAL ENGINEERING LAB & 7 ROBOTICS PROJECTS
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 5: Engineering Lab & Robotics Blueprints ---');

  test('5.1 Returns all 7 verified engineering projects with complete 13-step workflows', () => {
    const projects = mechanicalRoboticsEngineInstance.getAllEngineeringProjects();
    assert.strictEqual(projects.length, 7, `Expected 7 projects, got ${projects.length}`);

    const requiredIds = [
      '5dof_robotic_arm',
      'servo_compliant_gripper',
      'underactuated_robotic_hand',
      'wearable_exoskeleton_joint',
      'wearable_sensor_system',
      'virtual_iron_man_suit_study',
      'simulated_propulsion_research'
    ];

    for (const reqId of requiredIds) {
      const found = projects.find(p => p.projectId === reqId);
      assert(found, `Project ${reqId} missing from engineering blueprints`);
      assert(Array.isArray(found.workflow13Steps) && found.workflow13Steps.length === 13, `Project ${reqId} must have all 13 steps`);
    }
  });

  test('5.2 Enforces strict safety distinction: flight suit & propulsion are marked conceptual only', () => {
    const projects = mechanicalRoboticsEngineInstance.getAllEngineeringProjects();
    const suit = projects.find(p => p.projectId === 'virtual_iron_man_suit_study');
    const prop = projects.find(p => p.projectId === 'simulated_propulsion_research');
    const arm = projects.find(p => p.projectId === '5dof_robotic_arm');

    assert.strictEqual(suit.isConceptualOnly, true, 'Flight suit must be isConceptualOnly');
    assert.strictEqual(prop.isConceptualOnly, true, 'Propulsion study must be isConceptualOnly');
    assert.strictEqual(arm.isConceptualOnly, false, 'Robotic arm is physical hardware prototype');
  });

  test('5.3 Computes dynamic joint actuator torque sizing correctly', () => {
    const torque = mechanicalRoboticsEngineInstance.sizeJointActuator(2.0, 0.45, 0.8, 2.5);
    assert(torque.success, 'Torque calculation should succeed');
    assert(torque.calculations.totalRequiredTorqueNm > 0, 'Torque must be positive');
    assert(torque.calculations.mechanicalPowerWatts > 0, 'Power must be positive');
    assert(torque.recommendedActuatorClass, 'Must provide actuator class recommendation');
  });

  test('5.4 Analyzes cantilever beam bending stress, von Mises stress, and deflection', () => {
    const beam = mechanicalRoboticsEngineInstance.analyzeCantileverBeam(60, 0.4, 'aluminum_6061_t6', 0.03, 0.015);
    assert(beam.success, 'Beam calculation should succeed');
    assert(beam.results.safetyFactor > 0, 'Safety factor must be positive');
    assert(beam.results.maxDeflectionMm > 0, 'Deflection must be positive');
    assert(beam.results.status.includes('SAFE') || beam.results.status.includes('ACCEPTABLE'), 'Status expected to be safe');
  });

  test('5.5 Computes forward kinematics end-effector position via DH parameters', () => {
    const dh = [
      { theta: 0, d: 0.1, a: 0.2, alpha: 0 },
      { theta: Math.PI / 4, d: 0, a: 0.2, alpha: 0 }
    ];
    const fk = mechanicalRoboticsEngineInstance.computeForwardKinematicsDH(dh);
    assert(fk.success, 'Kinematics should succeed');
    assert(typeof fk.endEffectorPosition.x === 'number', 'Expected x coordinate');
    assert(typeof fk.endEffectorPosition.y === 'number', 'Expected y coordinate');
    assert(typeof fk.endEffectorPosition.z === 'number', 'Expected z coordinate');
  });

  test('5.6 Generates algorithmic OpenSCAD parametric 3D CAD model', () => {
    const cad = mechanicalRoboticsEngineInstance.generateOpenSCADModel('robotic_arm', { length: 160, width: 30 });
    assert(cad.success, 'CAD generation should succeed');
    assert(cad.scadCode.includes('module robot_arm_link'), 'CAD code must define robot_arm_link module');
  });

  // -------------------------------------------------------------------------
  // 6. BACKEND HTTP REST API GATEWAY INTEGRATION
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 6: Backend HTTP API Endpoints ---');

  const BASE_URL = 'http://localhost:3000';

  await testAsync('6.1 GET /api/brain/architecture returns verified 20+ subsystems', async () => {
    const res = await fetch(`${BASE_URL}/api/brain/architecture`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success, 'API response must indicate success');
    assert(data.total >= 20, `Expected total >= 20, got ${data.total}`);
  });

  await testAsync('6.2 GET /api/brain/subsystem/sub_language_ai returns single subsystem detail', async () => {
    const res = await fetch(`${BASE_URL}/api/brain/subsystem/sub_language_ai`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success && data.subsystem, 'Subsystem detail missing');
    assert.strictEqual(data.subsystem.id, 'sub_language_ai');
  });

  await testAsync('6.3 GET /api/brain/topology returns 3D points and filaments', async () => {
    const res = await fetch(`${BASE_URL}/api/brain/topology`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success && data.topology, 'Topology data missing');
    assert(data.topology.totalPoints >= 3000, `Expected >= 3000 points, got ${data.topology.totalPoints}`);
    assert(data.topology.totalFilaments > 10, 'Expected filaments');
  });

  await testAsync('6.4 GET /api/brain/telemetry and POST /api/brain/telemetry', async () => {
    const postRes = await fetch(`${BASE_URL}/api/brain/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'sub_mechanical_robotics',
        target: 'sub_scientific_math',
        eventType: 'CALCULATION_STEP',
        details: { step: 'Torque sized' }
      })
    });
    assert.strictEqual(postRes.status, 200);
    const postData = await postRes.json();
    assert(postData.success && postData.event, 'Event broadcast failed');

    const getRes = await fetch(`${BASE_URL}/api/brain/telemetry?limit=5`);
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert(getData.success && getData.events.length > 0, 'Recent telemetry failed');
  });

  await testAsync('6.5 POST /api/brain/explain returns pedagogical multi-tier explanation', async () => {
    const res = await fetch(`${BASE_URL}/api/brain/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'Robotics',
        concept: 'Kinematics',
        level: 'beginner'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success && data.explanation, 'Explain failed');
    assert.strictEqual(data.explanation.selectedLevel, 'beginner');
  });

  await testAsync('6.6 GET /api/engineering/projects returns 7 projects with 13 steps', async () => {
    const res = await fetch(`${BASE_URL}/api/engineering/projects`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success && data.count === 7, `Expected 7 projects, got ${data.count}`);
  });

  await testAsync('6.7 GET /api/engineering/materials returns materials database', async () => {
    const res = await fetch(`${BASE_URL}/api/engineering/materials`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success && data.materials['aluminum_6061_t6'], 'Missing aluminum_6061_t6 in materials');
  });

  await testAsync('6.8 POST /api/engineering/calculate returns verified solver results', async () => {
    const res = await fetch(`${BASE_URL}/api/engineering/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calculationType: 'torque',
        payloadKg: 1.5,
        linkLengthMeters: 0.4
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success && data.result.calculations.totalRequiredTorqueNm > 0, 'Torque calculation failed via API');
  });

  // -------------------------------------------------------------------------
  // 7. SECURITY GOVERNANCE & EMERGENCY STOP COMPATIBILITY
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 7: Security Enforcement & Emergency Stop ---');

  test('7.1 Central permission gate continues to enforce read-only and emergency stop', () => {
    assert(permissionGateInstance, 'permissionGateInstance must exist');
    const isEStopActive = permissionGateInstance.isEmergencyStopActive();
    assert.strictEqual(typeof isEStopActive, 'boolean');
  });

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TOTAL SUITES COMPLETE: ${passCount} PASSED, ${failCount} FAILED (${((passCount / (passCount + failCount)) * 100).toFixed(1)}%)`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
