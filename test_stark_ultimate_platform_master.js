/**
 * STARK AI — Ultimate Autonomous Platform Master Test Suite
 * 
 * Comprehensive regression and functional verification for:
 * - Phase 3: World Model & Knowledge Graph (causal physics, decisions, failures, security)
 * - Phase 8: Multi-Agent Research Team (9 specialists, parallel dispatch, conflict detection, consensus)
 * - Phase 13: Proactive Assistance Engine (event monitoring, quiet hours, pause/resume)
 * - Phase 14: Local Compute & Hardware Resource Manager (specs, GPUs, toolchains, intelligent routing)
 * - Phase 15: Central Permission Gate & Emergency Stop Enforcement
 * - Natural Language Command Interpreter Voice Intents
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const knowledgeGraph = require('./server/knowledgeGraphEngine');
const multiAgentOrchestrator = require('./server/multiAgentOrchestrator');
const proactiveAssistant = require('./server/proactiveAssistant');
const resourceComputeManager = require('./server/resourceComputeManager');
const { TOOLS, executeTool } = require('./server/toolsRegistry');
const { permissionGateInstance } = require('./server/desktop/permissionGate');
const { commandInterpreterInstance } = require('./server/commandInterpreter');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${testName}: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${testName}: ${err.message}`);
    failedTests++;
  }
}

async function runMasterSuite() {
  console.log('\n========================================================================');
  console.log('STARK AI — ULTIMATE PLATFORM MASTER VERIFICATION SUITE');
  console.log('========================================================================\n');

  // =========================================================================
  // SUITE 1: WORLD MODEL & KNOWLEDGE GRAPH ENGINE
  // =========================================================================
  console.log('--- Suite 1: World Model & Knowledge Graph Engine ---');

  runTest('1.1: Default Seed Graph Contains Core Engineering Entities', () => {
    assert(knowledgeGraph.nodes.size >= 8, `Expected >= 8 seed nodes, got ${knowledgeGraph.nodes.size}`);
    assert(knowledgeGraph.edges.length >= 5, `Expected >= 5 seed edges, got ${knowledgeGraph.edges.length}`);
    const armNode = knowledgeGraph.getNode('proj_robotic_arm_5dof');
    assert(armNode, 'Expected proj_robotic_arm_5dof node in seed graph');
    assert.strictEqual(armNode.type, 'project');
  });

  runTest('1.2: Add Custom Node & Edge With Provenance', () => {
    const nodeRes = knowledgeGraph.addNode(
      'hardware_component',
      'comp_test_lidar_sensor',
      'Solid-State LiDAR Scanner (20m Range)',
      { rangeMeters: 20, scanRateHz: 15 },
      'Autonomous Perception Specification'
    );
    assert(nodeRes.success, 'Failed to add custom node');
    assert.strictEqual(nodeRes.node.label, 'Solid-State LiDAR Scanner (20m Range)');

    const edgeRes = knowledgeGraph.addEdge(
      'proj_robotic_arm_5dof',
      'comp_test_lidar_sensor',
      'CONNECTED_TO',
      0.95,
      { interface: 'Ethernet / UDP' }
    );
    assert(edgeRes.success, 'Failed to add custom edge');
    assert.strictEqual(edgeRes.edge.relationship, 'CONNECTED_TO');
  });

  runTest('1.3: Graph Search & Neighbor Traversal', () => {
    const searchResults = knowledgeGraph.searchNodes('LiDAR');
    assert(searchResults.length >= 1, 'Expected to find LiDAR node via search');
    assert.strictEqual(searchResults[0].id, 'comp_test_lidar_sensor');

    const neighbors = knowledgeGraph.getNeighbors('proj_robotic_arm_5dof', 'both');
    assert(neighbors.length >= 2, `Expected >= 2 neighbors for robotic arm, got ${neighbors.length}`);
  });

  runTest('1.4: Causal Consequence Analysis — Motor Torque Alteration', () => {
    const res = knowledgeGraph.analyzeConsequence('motor', {
      parameter: 'torque',
      direction: 'increase',
      factor: 1.4
    });
    assert(res.directEffects.length >= 2, 'Expected direct effects for torque increase');
    assert(res.cascadingConsequences.length >= 3, 'Expected cascading impacts on gears, heat, links');
    assert(res.constraintViolations.length >= 1, 'Expected current limit constraint warning');
    assert(res.recommendations.length >= 1, 'Expected cooling/sourcing recommendations');
  });

  runTest('1.5: Causal Consequence Analysis — Gear Ratio Alteration', () => {
    const res = knowledgeGraph.analyzeConsequence('gearbox', {
      parameter: 'gear ratio',
      direction: 'increase',
      factor: 2.0
    });
    assert(res.directEffects.some(e => e.parameter.includes('Torque')), 'Expected torque increase effect');
    assert(res.directEffects.some(e => e.parameter.includes('Velocity')), 'Expected velocity decrease effect');
    assert(res.cascadingConsequences.some(c => c.component.includes('Reflected Inertia')), 'Expected reflected inertia impact');
  });

  runTest('1.6: Causal Consequence Analysis — Battery Voltage Sag', () => {
    const res = knowledgeGraph.analyzeConsequence('battery', {
      parameter: 'voltage',
      direction: 'decrease',
      factor: 1.25
    });
    assert(res.directEffects.some(e => e.parameter.includes('Speed')), 'Expected speed drop');
    assert(res.cascadingConsequences.some(c => c.component.includes('Harness')), 'Expected harness loss warning');
  });

  runTest('1.7: Causal Consequence Analysis — Material Substitution (Titanium)', () => {
    const res = knowledgeGraph.analyzeConsequence('chassis titanium', {
      parameter: 'material titanium',
      direction: 'increase',
      factor: 1.0
    });
    assert(res.directEffects.some(e => e.parameter.includes('Yield Strength')), 'Expected yield strength increase');
    assert(res.directEffects.some(e => e.parameter.includes('Density')), 'Expected density increase');
    assert(res.cascadingConsequences.some(c => c.component.includes('Cost')), 'Expected machining cost warning');
  });

  runTest('1.8: Decision & Failure Tracking In World Model', () => {
    const decRes = knowledgeGraph.addDecision(
      'proj_robotic_arm_5dof',
      'Select Al 6061-T6 for link members instead of 7075-T6',
      'Superior machinability and weldability with sufficient yield strength (276 MPa)',
      ['Al 7075-T6', 'Carbon Fiber Composite']
    );
    assert(decRes.success, 'Failed to add architectural decision');

    const failRes = knowledgeGraph.addFailure(
      'comp_motor_bldc_actuator',
      'Over-temperature shutdown during 100% stall torque benchmark',
      'Added active 40mm fan duct and set software current clamping threshold to 22A'
    );
    assert(failRes.success, 'Failed to record failure incident');

    const memory = knowledgeGraph.inspectMemory();
    assert(memory.nodeCount >= 10, 'Expected >= 10 nodes in memory inspector');
    assert(memory.recentDecisions.length >= 1, 'Expected recent decision in memory inspector');
    assert(memory.recentFailures.length >= 1, 'Expected recent failure in memory inspector');
  });

  runTest('1.9: Strict Credential & Password Blocking in Knowledge Graph', () => {
    const blockedRes = knowledgeGraph.addNode(
      'concept',
      'node_secret_leak',
      'Database password and api_key',
      { secret: 'SuperSecret123!', apiKey: 'AIzaSyFakeToken' }
    );
    assert.strictEqual(blockedRes.success, false);
    assert.strictEqual(blockedRes.reason, 'SECURITY_BLOCKED');
  });

  // =========================================================================
  // SUITE 2: MULTI-AGENT RESEARCH & ENGINEERING TEAM
  // =========================================================================
  console.log('\n--- Suite 2: Multi-Agent Research & Engineering Team ---');

  runTest('2.1: Specialist Agent Roles & Permissions Definition', () => {
    const roles = multiAgentOrchestrator.getRoles();
    assert.strictEqual(roles.length, 9, 'Expected exactly 9 specialist roles');
    const roleIds = roles.map(r => r.id);
    assert(roleIds.includes('research_agent'), 'Missing research_agent');
    assert(roleIds.includes('software_engineer'), 'Missing software_engineer');
    assert(roleIds.includes('math_computation_agent'), 'Missing math_computation_agent');
    assert(roleIds.includes('mechanical_engineering_agent'), 'Missing mechanical_engineering_agent');
    assert(roleIds.includes('electronics_agent'), 'Missing electronics_agent');
    assert(roleIds.includes('ai_ml_engineer'), 'Missing ai_ml_engineer');
    assert(roleIds.includes('testing_verification_agent'), 'Missing testing_verification_agent');
    assert(roleIds.includes('security_reviewer'), 'Missing security_reviewer');
    assert(roleIds.includes('project_coordinator'), 'Missing project_coordinator');
  });

  await runAsyncTest('2.2: Single Specialist Execution — Math & Computation Agent', async () => {
    const res = await multiAgentOrchestrator.executeSpecialistTask('math_computation_agent', {}, 1);
    assert.strictEqual(res.status, 'COMPLETED');
    assert(res.findings.exponentialDecayCheck, 'Expected ODE decay solution');
    assert(res.findings.monteCarloStats.mean > 0, 'Expected Monte Carlo mean');
  });

  await runAsyncTest('2.3: Single Specialist Execution — Mechanical Engineering Agent', async () => {
    const res = await multiAgentOrchestrator.executeSpecialistTask('mechanical_engineering_agent', {
      material: 'aluminum_6061_t6',
      lengthMm: 300,
      loadNewtons: 100,
      payloadKg: 1.5
    }, 1);
    assert.strictEqual(res.status, 'COMPLETED');
    assert(res.findings.beamAnalysis.safetyFactor > 0, 'Expected safety factor calculation');
    assert(res.findings.torqueRequirement.recommendedTorqueNm > 0, 'Expected actuator torque');
  });

  await runAsyncTest('2.4: Full Multi-Agent Collaborative Mission & Conflict Detection', async () => {
    const mission = await multiAgentOrchestrator.runMission('Biomechanical Exoskeleton Synthesis', {
      payloadKg: 2.0,
      lengthMm: 350,
      capacityAh: 10,
      voltageV: 48,
      paramsBillion: 7.0
    });
    assert(mission.missionId.startsWith('mission_'), 'Expected valid mission ID');
    assert.strictEqual(mission.specialistReports.length, 5, 'Expected 5 specialist reports');
    const completedReports = mission.specialistReports.filter(r => r.status === 'COMPLETED');
    assert.strictEqual(completedReports.length, 5, 'Expected all 5 specialists to complete');
    assert(mission.consensusSummary.includes('STARK Multi-Agent Council'), 'Expected consensus summary');
    assert(mission.totalExecutionTimeMs >= 0, 'Expected recorded execution time');
  });

  await runAsyncTest('2.5: Circular Delegation Safeguard', async () => {
    let trappedError = null;
    try {
      await multiAgentOrchestrator.executeSpecialistTask('research_agent', {}, 5); // depth 5 exceeds max 3
    } catch (e) {
      trappedError = e.message;
    }
    assert(trappedError && trappedError.includes('delegation depth'), 'Expected circular delegation trap');
  });

  // =========================================================================
  // SUITE 3: PROACTIVE ASSISTANCE & SYSTEM HEALTH ENGINE
  // =========================================================================
  console.log('\n--- Suite 3: Proactive Assistance & System Health Engine ---');

  runTest('3.1: Proactive Notification Creation & Quiet Hours Logic', () => {
    proactiveAssistant.setQuietHours(23, 7, true);
    const notif = proactiveAssistant.createNotification(
      'Test Normal Notification',
      'Background check complete',
      'PROJECT_MILESTONE',
      'NORMAL'
    );
    assert(notif.id.startsWith('notif_'), 'Expected valid notification ID');
    assert.strictEqual(notif.status, 'UNREAD');

    const notifs = proactiveAssistant.getNotifications('UNREAD');
    assert(notifs.some(n => n.id === notif.id), 'Notification must be in unread list');
    proactiveAssistant.markAsRead(notif.id);
    assert.strictEqual(notif.status, 'READ');
  });

  await runAsyncTest('3.2: Full Proactive Health Scan Execution', async () => {
    const scanResult = await proactiveAssistant.runSystemScan();
    assert.strictEqual(scanResult.status, 'SCAN_COMPLETE');
    assert(scanResult.timestamp, 'Expected scan timestamp');
  });

  runTest('3.3: Proactive Monitoring Global Pause & Resume Controls', () => {
    const pauseRes = proactiveAssistant.pause();
    assert.strictEqual(pauseRes.status, 'PAUSED');
    assert.strictEqual(proactiveAssistant.isPaused, true);

    const resumeRes = proactiveAssistant.resume();
    assert.strictEqual(resumeRes.status, 'ACTIVE');
    assert.strictEqual(proactiveAssistant.isPaused, false);
  });

  // =========================================================================
  // SUITE 4: LOCAL COMPUTE & HARDWARE RESOURCE MANAGER
  // =========================================================================
  console.log('\n--- Suite 4: Local Compute & Hardware Resource Manager ---');

  runTest('4.1: System Overview & Resource Detection', () => {
    const overview = resourceComputeManager.getSystemOverview();
    assert(overview.cpu.cores > 0, 'Expected positive CPU cores');
    assert(overview.memory.totalGb > 0, 'Expected positive total RAM');
    assert(overview.memory.freeGb >= 0, 'Expected positive free RAM');
    assert(overview.memory.usagePercent >= 0 && overview.memory.usagePercent <= 100, 'Invalid RAM percentage');
  });

  runTest('4.2: Installed Toolchain Detection (Node, Python, Git)', () => {
    const runtimes = resourceComputeManager.detectInstalledToolchains();
    assert(runtimes.node.installed, 'Expected Node.js to be detected');
    assert(runtimes.node.version.startsWith('v'), 'Expected valid Node version string');
    assert(runtimes.git.installed, 'Expected Git to be detected');
    assert(runtimes.python.installed, 'Expected Python to be detected');
  });

  runTest('4.3: GPU & Display Acceleration Detection', () => {
    const gpus = resourceComputeManager.detectGpu();
    assert(Array.isArray(gpus) && gpus.length > 0, 'Expected at least one GPU/Display adapter');
    assert(gpus[0].name, 'Expected GPU name property');
  });

  runTest('4.4: Task Execution Routing — Confidentiality Enforced Local', () => {
    const route = resourceComputeManager.routeTaskExecution({
      taskType: 'general',
      isConfidential: true
    });
    assert.strictEqual(route.target, 'LOCAL');
    assert.strictEqual(route.reason, 'CONFIDENTIALITY_POLICY_ENFORCED');
  });

  runTest('4.5: Task Execution Routing — Deterministic Physics Local', () => {
    const route = resourceComputeManager.routeTaskExecution({
      taskType: 'beam_stress'
    });
    assert.strictEqual(route.target, 'LOCAL');
    assert.strictEqual(route.reason, 'DETERMINISTIC_EXECUTION');
  });

  runTest('4.6: Task Execution Routing — Low Latency Voice Streaming', () => {
    const route = resourceComputeManager.routeTaskExecution({
      taskType: 'voice_stream',
      maxLatencyMs: 400
    });
    assert.strictEqual(route.target, 'CLOUD_STREAMING');
    assert.strictEqual(route.reason, 'LOW_LATENCY_VOICE_STREAM');
  });

  runTest('4.7: Task Execution Routing — Deep Research Hybrid', () => {
    const route = resourceComputeManager.routeTaskExecution({
      taskType: 'deep_research',
      requiresInternet: true
    });
    assert.strictEqual(route.target, 'HYBRID');
    assert.strictEqual(route.reason, 'RESEARCH_SYNTHESIS');
  });

  await runAsyncTest('4.8: Complete Hardware Capability Audit', async () => {
    const audit = await resourceComputeManager.getCompleteCapabilityAudit();
    assert(audit.timestamp, 'Expected audit timestamp');
    assert(audit.system.cpu.model, 'Expected CPU model');
    assert(audit.resourceHealth.localComputeReady, 'Expected local compute ready flag');
  });

  // =========================================================================
  // SUITE 5: TOOL REGISTRY & CENTRAL PERMISSION GATE
  // =========================================================================
  console.log('\n--- Suite 5: Tool Registry & Central Permission Gate ---');

  runTest('5.1: Verify All 7 New Tools Registered in TOOLS', () => {
    const newToolNames = [
      'query_knowledge_graph',
      'analyze_engineering_consequence',
      'record_graph_decision',
      'record_graph_failure',
      'dispatch_multi_agent_mission',
      'scan_proactive_assistance',
      'audit_compute_resources'
    ];
    for (const name of newToolNames) {
      assert(TOOLS[name], `Tool "${name}" is missing from TOOLS registry`);
      assert(typeof TOOLS[name].execute === 'function', `Tool "${name}" lacks execute handler`);
    }
  });

  await runAsyncTest('5.2: Execute Tool query_knowledge_graph via executeTool (JARVIS)', async () => {
    const res = await executeTool('query_knowledge_graph', { query: 'robotic' }, 'JARVIS');
    assert(res.results.length >= 1, 'Expected at least one matching node');
  });

  await runAsyncTest('5.3: Execute Tool analyze_engineering_consequence via executeTool (JARVIS)', async () => {
    const res = await executeTool('analyze_engineering_consequence', {
      targetEntity: 'actuator',
      parameterChange: { parameter: 'torque', direction: 'increase', factor: 1.25 }
    }, 'JARVIS');
    assert(res.directEffects.length >= 1, 'Expected direct effects');
  });

  await runAsyncTest('5.4: Execute Tool audit_compute_resources via executeTool (JARVIS)', async () => {
    const res = await executeTool('audit_compute_resources', {}, 'JARVIS');
    assert(res.system.cpu.cores > 0, 'Expected positive CPU cores');
  });

  runTest('5.5: Strict ULTRON Permission Gate Enforcement (Blocked Writes)', () => {
    let trappedError = null;
    try {
      permissionGateInstance.authorizeToolExecution(
        'record_graph_decision',
        { projectId: 'p1', decisionSummary: 'test' },
        'ULTRON'
      );
    } catch (err) {
      trappedError = err.message;
    }
    assert(trappedError && (trappedError.includes('Security Violation') || trappedError.includes('prohibited')), 'ULTRON must be blocked from PRODUCTIVITY_TASKS writes');
  });

  runTest('5.6: Emergency Stop Hard Halt Enforced on All Execution', () => {
    permissionGateInstance.triggerEmergencyStop('Master Verification Test E-Stop');
    assert.strictEqual(permissionGateInstance.emergencyStopActive, true);

    let trappedError = null;
    try {
      permissionGateInstance.authorizeToolExecution('get_current_time', {}, 'JARVIS');
    } catch (err) {
      trappedError = err.message;
    }
    assert(trappedError && (trappedError.toLowerCase().includes('emergency stop is active') || trappedError.toLowerCase().includes('prohibited')), 'All execution must be halted under E-Stop');

    // Reset emergency stop
    permissionGateInstance.resetEmergencyStop();
    assert.strictEqual(permissionGateInstance.emergencyStopActive, false);
  });

  // =========================================================================
  // SUITE 6: COMMAND INTERPRETER NATURAL LANGUAGE INTENTS
  // =========================================================================
  console.log('\n--- Suite 6: Command Interpreter Natural Language Intents ---');

  runTest('6.1: Parse "What happens if we increase motor torque?"', () => {
    const res = commandInterpreterInstance.interpret('What happens if we increase motor torque?');
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.toolName, 'analyze_engineering_consequence');
    assert.strictEqual(res.args.parameterChange.parameter, 'torque');
    assert.strictEqual(res.args.parameterChange.direction, 'increase');
  });

  runTest('6.2: Parse "What if we change gear ratio?"', () => {
    const res = commandInterpreterInstance.interpret('What if we change gear ratio?');
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.toolName, 'analyze_engineering_consequence');
    assert.strictEqual(res.args.parameterChange.parameter, 'gear ratio');
  });

  runTest('6.3: Parse "Query knowledge graph for robotic arm"', () => {
    const res = commandInterpreterInstance.interpret('Query knowledge graph for robotic arm');
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.toolName, 'query_knowledge_graph');
    assert.strictEqual(res.args.query, 'robotic arm');
  });

  runTest('6.4: Parse "Dispatch multi agent mission on robotic gripper"', () => {
    const res = commandInterpreterInstance.interpret('Dispatch multi agent mission on robotic gripper');
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.toolName, 'dispatch_multi_agent_mission');
  });

  runTest('6.5: Parse "Run proactive scan for alerts"', () => {
    const res = commandInterpreterInstance.interpret('Run proactive scan for alerts');
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.toolName, 'scan_proactive_assistance');
  });

  runTest('6.6: Parse "Audit hardware resources and compute status"', () => {
    const res = commandInterpreterInstance.interpret('Audit hardware resources and compute status');
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.toolName, 'audit_compute_resources');
  });

  console.log('\n========================================================================');
  console.log(`MASTER VERIFICATION COMPLETE: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(`FAILED TESTS: ${failedTests}`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMasterSuite().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
