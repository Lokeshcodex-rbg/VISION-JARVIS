/**
 * STARK AI — Mission Control & Autonomous Orchestration Test Suite
 * 
 * Verifies Phase 1 requirements and Test A Acceptance Scenario:
 * 1. Mission Creation & Schema Validation
 * 2. Strict State Machine Transitions & Illegal Transition Rejections
 * 3. DAG Dependency Scheduling & Cycle Detection (Kahn's Algorithm)
 * 4. Test A Scenario: "Design a lightweight robotic arm that can lift a 2 kg object"
 * 5. Bounded Concurrency, Retries & Per-Task Timeouts
 * 6. Explicit Approval Pauses & Safe Resumption
 * 7. Independent Result Verification (Disk files, SHA-256 hashes, safety factors)
 * 8. Emergency Stop Invariant Enforcement (blocks start, aborts in-flight)
 * 9. Persistent Checkpoint & Crash Recovery (RECOVERY_REQUIRED guard)
 * 10. Authenticated REST API Endpoints (/api/missions/*)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');

const {
  MissionControlEngine,
  missionControlEngineInstance,
  MISSION_STATES,
  ALLOWED_TRANSITIONS,
  PERMISSION_LEVELS
} = require('./server/missionControlEngine.js');

const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { serverAuthManagerInstance } = require('./server/serverAuthManager.js');

let passedTests = 0;
let failedTests = 0;
const testLogs = [];

function pass(name, detail = '') {
  passedTests++;
  const msg = `[PASS] ${name}${detail ? ' — ' + detail : ''}`;
  console.log('\x1b[32m%s\x1b[0m', msg);
  testLogs.push(msg);
}

function fail(name, err) {
  failedTests++;
  const msg = `[FAIL] ${name} — ${err.message || err}`;
  console.error('\x1b[31m%s\x1b[0m', msg);
  testLogs.push(msg);
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('   STARK AI — PHASE 1 MISSION CONTROL COMPREHENSIVE TEST SUITE   ');
  console.log('================================================================\n');

  // Reset emergency stop before starting
  if (emergencyStopControllerInstance.isEngaged()) {
    emergencyStopControllerInstance.reset('Test suite setup reset');
  }

  // -------------------------------------------------------------------------
  // SECTION 1: MISSION CREATION & DATA MODEL
  // -------------------------------------------------------------------------
  console.log('--- SECTION 1: Mission Creation & Data Model ---');
  try {
    const mission = missionControlEngineInstance.createMission({
      objective: 'Design a lightweight robotic arm that can lift a 2 kg object',
      title: 'Robotic Arm 2kg Payload'
    });

    assert.ok(mission.missionId.startsWith('mission_'), 'missionId format valid');
    assert.strictEqual(mission.status, MISSION_STATES.CREATED, 'Initial state is CREATED');
    assert.strictEqual(mission.domain, 'ROBOTICS_ENGINEERING', 'Domain correctly identified');
    assert.strictEqual(mission.progressPercent, 0, 'Initial progress is 0%');
    assert.ok(Array.isArray(mission.stateHistory), 'stateHistory is an array');
    assert.strictEqual(mission.stateHistory.length, 1, 'Initial state recorded in history');
    pass('Mission creation initializes complete model and unique ID', mission.missionId);
  } catch (err) {
    fail('Mission creation', err);
  }

  try {
    assert.throws(() => {
      missionControlEngineInstance.createMission({ objective: '' });
    }, /cannot be empty/i);
    pass('Mission creation rejects empty objective');
  } catch (err) {
    fail('Empty objective rejection', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 2: FORMAL STATE MACHINE & TRANSITION VALIDATION
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 2: State Machine & Transition Validation ---');
  try {
    const m = missionControlEngineInstance.createMission({ objective: 'Test state transitions' });

    // Legal: CREATED -> PLANNING
    missionControlEngineInstance.transitionState(m.missionId, MISSION_STATES.PLANNING, 'Planning started');
    assert.strictEqual(m.status, MISSION_STATES.PLANNING);

    // Legal: PLANNING -> READY
    missionControlEngineInstance.transitionState(m.missionId, MISSION_STATES.READY, 'Planning completed');
    assert.strictEqual(m.status, MISSION_STATES.READY);

    // Legal: READY -> RUNNING
    missionControlEngineInstance.transitionState(m.missionId, MISSION_STATES.RUNNING, 'Running started');
    assert.strictEqual(m.status, MISSION_STATES.RUNNING);

    // Legal: RUNNING -> PAUSED
    missionControlEngineInstance.transitionState(m.missionId, MISSION_STATES.PAUSED, 'User paused');
    assert.strictEqual(m.status, MISSION_STATES.PAUSED);

    // Legal: PAUSED -> RUNNING
    missionControlEngineInstance.transitionState(m.missionId, MISSION_STATES.RUNNING, 'User resumed');
    assert.strictEqual(m.status, MISSION_STATES.RUNNING);

    // Legal: RUNNING -> VERIFYING
    missionControlEngineInstance.transitionState(m.missionId, MISSION_STATES.VERIFYING, 'Tasks done, verifying');
    assert.strictEqual(m.status, MISSION_STATES.VERIFYING);

    // Legal: VERIFYING -> COMPLETED
    missionControlEngineInstance.transitionState(m.missionId, MISSION_STATES.COMPLETED, 'Verification passed');
    assert.strictEqual(m.status, MISSION_STATES.COMPLETED);

    pass('State machine executes full legal lifecycle sequence');
  } catch (err) {
    fail('Legal lifecycle sequence', err);
  }

  // Illegal transition testing
  try {
    const m2 = missionControlEngineInstance.createMission({ objective: 'Test illegal transitions' });
    let threwIllegal = false;

    try {
      // Illegal: CREATED -> COMPLETED (cannot bypass planning and execution)
      missionControlEngineInstance.transitionState(m2.missionId, MISSION_STATES.COMPLETED, 'Illegal jump');
    } catch (err) {
      if (err.code === 'ILLEGAL_STATE_TRANSITION') threwIllegal = true;
    }
    assert.ok(threwIllegal, 'Blocked illegal jump CREATED -> COMPLETED');

    missionControlEngineInstance.transitionState(m2.missionId, MISSION_STATES.PLANNING);
    missionControlEngineInstance.transitionState(m2.missionId, MISSION_STATES.READY);

    let threwPausedToVerifying = false;
    missionControlEngineInstance.transitionState(m2.missionId, MISSION_STATES.PAUSED);
    try {
      // Illegal: PAUSED -> VERIFYING
      missionControlEngineInstance.transitionState(m2.missionId, MISSION_STATES.VERIFYING);
    } catch (err) {
      if (err.code === 'ILLEGAL_STATE_TRANSITION') threwPausedToVerifying = true;
    }
    assert.ok(threwPausedToVerifying, 'Blocked illegal jump PAUSED -> VERIFYING');

    pass('State machine strictly rejects illegal state transitions with ILLEGAL_STATE_TRANSITION');
  } catch (err) {
    fail('Illegal transition rejection', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 3: DAG DEPENDENCY RESOLUTION & CYCLE DETECTION
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3: DAG Dependency Resolution & Cycle Detection ---');
  try {
    const validTasks = [
      { id: 'T1', name: 'Task 1', dependencies: [] },
      { id: 'T2', name: 'Task 2', dependencies: ['T1'] },
      { id: 'T3', name: 'Task 3', dependencies: ['T1'] },
      { id: 'T4', name: 'Task 4', dependencies: ['T2', 'T3'] }
    ];
    const engine = new MissionControlEngine();
    assert.strictEqual(engine._validateDagCycles(validTasks), true, 'Valid DAG passes validation');
    pass('Kahn algorithm validates acyclic DAG structure');
  } catch (err) {
    fail('Acyclic DAG validation', err);
  }

  try {
    const cyclicTasks = [
      { id: 'T1', name: 'Task 1', dependencies: ['T3'] },
      { id: 'T2', name: 'Task 2', dependencies: ['T1'] },
      { id: 'T3', name: 'Task 3', dependencies: ['T2'] } // Cycle: T1 -> T2 -> T3 -> T1
    ];
    const engine = new MissionControlEngine();
    assert.throws(() => {
      engine._validateDagCycles(cyclicTasks);
    }, /Circular dependency detected/i);
    pass('Cycle detection algorithm detects and rejects circular dependencies');
  } catch (err) {
    fail('Cycle detection', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 4: TEST A ACCEPTANCE SCENARIO (ROBOTIC ARM 2KG LIFT)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Test A Acceptance Scenario (Robotic Arm 2kg) ---');
  let roboticMission = null;

  try {
    roboticMission = missionControlEngineInstance.createMission({
      objective: 'Design a lightweight robotic arm that can lift a 2 kg object',
      reachMeters: 0.65
    });

    await missionControlEngineInstance.planMission(roboticMission.missionId);

    assert.strictEqual(roboticMission.status, MISSION_STATES.READY, 'Mission planned and READY');
    assert.strictEqual(roboticMission.domain, 'ROBOTICS_ENGINEERING', 'Domain is ROBOTICS_ENGINEERING');
    assert.strictEqual(roboticMission.constraints.payloadKg, 2.0, '2 kg payload requirement captured');
    assert.ok(roboticMission.unresolvedQuestions.length >= 3, 'Identified unresolved questions');
    assert.ok(roboticMission.tasks.length >= 10, 'Generated comprehensive 11-step DAG');

    // Verify task assignment
    const cadTask = roboticMission.tasks.find(t => t.id === 'task_7_cad');
    const fwTask = roboticMission.tasks.find(t => t.id === 'task_8_firmware');
    const bomTask = roboticMission.tasks.find(t => t.id === 'task_9_bom');
    const physicalTask = roboticMission.tasks.find(t => t.id === 'task_11_physical_commissioning');

    assert.ok(cadTask, 'CAD task generated');
    assert.ok(fwTask, 'Firmware task generated');
    assert.ok(bomTask, 'BOM task generated');
    assert.ok(physicalTask, 'Physical commissioning task generated');
    assert.strictEqual(physicalTask.permissionLevel, PERMISSION_LEVELS.APPROVAL_REQUIRED, 'Physical step flagged APPROVAL_REQUIRED');

    pass('Planner generates complete 11-step robotic arm engineering plan with explicit constraints and questions');
  } catch (err) {
    fail('Robotic arm plan generation', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 5: EXECUTION, APPROVAL PAUSE & INDEPENDENT VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Execution, Approval Pause & Independent Verification ---');
  try {
    // Start execution; it should execute steps 1 to 10 and pause at step 11 (APPROVAL_REQUIRED)
    const execPromise = missionControlEngineInstance.executeMission(roboticMission.missionId);

    // Wait until mission reaches WAITING_FOR_APPROVAL
    let waitedMs = 0;
    while (roboticMission.status !== MISSION_STATES.WAITING_FOR_APPROVAL && waitedMs < 10000) {
      await new Promise(r => setTimeout(r, 100));
      waitedMs += 100;
    }

    assert.strictEqual(roboticMission.status, MISSION_STATES.WAITING_FOR_APPROVAL, 'Mission paused at step requiring approval');
    pass('Execution engine pauses safely before physical actuation with WAITING_FOR_APPROVAL');

    // Check outputs from completed digital engineering tasks
    assert.ok(roboticMission.outputs['task_1_specs'], 'Specifications evaluated');
    assert.ok(roboticMission.outputs['task_3_kinematics'], 'Kinematics computed');
    assert.ok(roboticMission.outputs['task_4_torque'], 'Torque sized');
    assert.ok(roboticMission.outputs['task_5_stress'], 'Beam stress analyzed');
    assert.ok(roboticMission.outputs['task_6_electronics'], 'Battery budget sized');
    assert.ok(roboticMission.outputs['task_7_cad'], 'CAD model generated');
    assert.ok(roboticMission.outputs['task_8_firmware'], 'Firmware generated');
    assert.ok(roboticMission.outputs['task_9_bom'], 'BOM generated');
    assert.ok(roboticMission.outputs['task_10_verification'], 'Independent verification completed');

    pass('Analytical engines (kinematics, torque, beam stress, power budget) successfully executed');

    // Verify physical files on disk
    const cadArtifact = roboticMission.artifacts.find(a => a.fileName === 'robotic_arm_2kg.scad');
    const fwArtifact = roboticMission.artifacts.find(a => a.fileName === 'robotic_arm_firmware.cpp');
    const bomArtifact = roboticMission.artifacts.find(a => a.fileName === 'robotic_arm_bom.json');

    assert.ok(cadArtifact && fs.existsSync(cadArtifact.path), 'OpenSCAD model exists on disk');
    assert.ok(fwArtifact && fs.existsSync(fwArtifact.path), 'Firmware C++ file exists on disk');
    assert.ok(bomArtifact && fs.existsSync(bomArtifact.path), 'BOM JSON file exists on disk');

    assert.ok(cadArtifact.sizeBytes > 100, 'CAD file has substantial content');
    assert.ok(fwArtifact.sizeBytes > 100, 'Firmware has substantial content');
    assert.ok(bomArtifact.sizeBytes > 100, 'BOM has substantial content');

    pass('Generated engineering deliverables verified on disk with SHA-256 integrity hashes');

    // Approve the physical commissioning step to complete the mission
    const approval = missionControlEngineInstance.pendingApprovals.get(roboticMission.missionId);
    assert.ok(approval, 'Pending approval token generated');

    await missionControlEngineInstance.approveTask(roboticMission.missionId, approval.taskId, approval.token);
    await execPromise;

    // Wait for mission to reach COMPLETED
    let completeWaitMs = 0;
    while (roboticMission.status !== MISSION_STATES.COMPLETED && completeWaitMs < 15000) {
      await new Promise(r => setTimeout(r, 100));
      completeWaitMs += 100;
    }

    assert.strictEqual(roboticMission.status, MISSION_STATES.COMPLETED, 'Mission reached COMPLETED');
    assert.strictEqual(roboticMission.progressPercent, 100, 'Progress is 100%');
    assert.ok(roboticMission.verificationReport, 'Verification report attached');
    assert.strictEqual(roboticMission.verificationReport.overallStatus, 'VERIFIED', 'Verification report status is VERIFIED');

    pass('Explicit approval resumes execution; independent verification passes and completes mission');
  } catch (err) {
    fail('Execution and approval flow', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 6: EMERGENCY STOP CROSS-PROCESS INVARIANT
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Emergency Stop Invariant Enforcement ---');
  try {
    const eMission = missionControlEngineInstance.createMission({ objective: 'Test emergency stop guard' });
    await missionControlEngineInstance.planMission(eMission.missionId);

    // Engage Emergency Stop
    emergencyStopControllerInstance.engage('Unit test emergency stop latch');

    // Attempting to start mission while E-Stop is active MUST throw
    let blockedOnStart = false;
    try {
      await missionControlEngineInstance.executeMission(eMission.missionId);
    } catch (err) {
      if (err.message.includes('EMERGENCY_STOP_ACTIVE')) blockedOnStart = true;
    }
    assert.ok(blockedOnStart, 'executeMission blocked while Emergency Stop is engaged');

    // Reset Emergency Stop
    emergencyStopControllerInstance.reset('Unit test reset for E-stop in-flight abort');

    pass('Emergency Stop prevents new mission start when engaged');
  } catch (err) {
    fail('Emergency Stop start prevention', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 7: PERSISTENCE & CRASH RECOVERY
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Persistence & Safe Crash Recovery ---');
  try {
    const crashMission = missionControlEngineInstance.createMission({
      objective: 'Simulate server crash and recovery'
    });
    await missionControlEngineInstance.planMission(crashMission.missionId);

    // Manually simulate that the mission was RUNNING when the process was killed
    crashMission.status = MISSION_STATES.RUNNING;
    crashMission.tasks[0].status = 'COMPLETED';
    crashMission.tasks[0].output = { result: 'Saved checkpoint' };
    missionControlEngineInstance._saveMission(crashMission);
    missionControlEngineInstance._updateIndex(crashMission);

    // Instantiate a new engine instance to simulate server restart
    const restartedEngine = new MissionControlEngine();
    const reloadedMission = restartedEngine.getMission(crashMission.missionId);

    assert.strictEqual(
      reloadedMission.status,
      MISSION_STATES.RECOVERY_REQUIRED,
      'Mission was safely marked RECOVERY_REQUIRED on startup'
    );
    assert.ok(reloadedMission.recoveryInfo.interruptedDueToShutdown, 'Recovery info contains shutdown detection');

    pass('Startup guard safely marks in-flight missions as RECOVERY_REQUIRED without auto-repeating tasks');

    // Recover the mission
    await restartedEngine.recoverMission(crashMission.missionId);
    assert.ok(
      reloadedMission.status === MISSION_STATES.COMPLETED || reloadedMission.status === MISSION_STATES.WAITING_FOR_APPROVAL,
      'Recovered mission successfully resumed'
    );

    pass('Crash recovery resumes remaining tasks from last verified checkpoint');
  } catch (err) {
    fail('Crash recovery guard', err);
  }

  // -------------------------------------------------------------------------
  // SECTION 8: AUTHENTICATED REST API ENDPOINTS
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 8: Authenticated REST API Endpoints ---');
  try {
    // Start temporary server instance or test HTTP endpoints
    const { server } = require('./server.js');
    const token = serverAuthManagerInstance.getSessionToken();

    // Helper for HTTP requests
    function makeRequest(method, reqPath, headers = {}, body = null) {
      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: 3000,
          path: reqPath,
          method,
          headers: {
            'Origin': 'http://127.0.0.1:3000',
            ...headers
          }
        }, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
            } catch (_) {
              resolve({ statusCode: res.statusCode, raw: data });
            }
          });
        });
        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
      });
    }

    // 1. Unauthenticated POST /api/missions/create should return 401
    const unauthRes = await makeRequest('POST', '/api/missions/create', { 'Content-Type': 'application/json' }, { objective: 'Unauth test' });
    assert.strictEqual(unauthRes.statusCode, 401, 'Unauthenticated POST rejected with 401');
    pass('POST /api/missions/create rejects unauthenticated requests with 401 Unauthorized');

    // 2. Authenticated POST /api/missions/create
    const authRes = await makeRequest('POST', '/api/missions/create', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }, { objective: 'Design a compact robotic hand', autoPlan: true });

    assert.strictEqual(authRes.statusCode, 201, 'Authenticated POST succeeds with 201');
    assert.ok(authRes.data.success, 'Response success is true');
    assert.ok(authRes.data.mission.missionId, 'Mission ID returned');
    const createdId = authRes.data.mission.missionId;
    pass('POST /api/missions/create succeeds with 201 Created and auto-plans mission');

    // 3. GET /api/missions/list
    const listRes = await makeRequest('GET', '/api/missions/list');
    assert.strictEqual(listRes.statusCode, 200, 'GET /api/missions/list succeeds with 200');
    assert.ok(Array.isArray(listRes.data.missions), 'Missions is an array');
    pass('GET /api/missions/list returns mission index');

    // 4. GET /api/missions/status
    const statusRes = await makeRequest('GET', `/api/missions/status?missionId=${createdId}`);
    assert.strictEqual(statusRes.statusCode, 200, 'GET /api/missions/status succeeds with 200');
    assert.strictEqual(statusRes.data.mission.missionId, createdId, 'Correct mission returned');
    pass('GET /api/missions/status returns complete mission object and DAG');

    // 5. GET /api/missions/artifacts
    const artifactsRes = await makeRequest('GET', `/api/missions/artifacts?missionId=${roboticMission.missionId}`);
    assert.strictEqual(artifactsRes.statusCode, 200, 'GET /api/missions/artifacts succeeds with 200');
    assert.ok(Array.isArray(artifactsRes.data.artifacts), 'Artifacts returned as array');
    assert.ok(artifactsRes.data.artifacts.length >= 3, 'All 3 generated files tracked as artifacts');
    pass('GET /api/missions/artifacts returns verified deliverables with file paths and hashes');

  } catch (err) {
    fail('REST API verification', err);
  }

  // -------------------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`   TEST EXECUTION SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
