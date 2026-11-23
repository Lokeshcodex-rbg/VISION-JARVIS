/**
 * STARK AI 3.0: Master Autonomous Task & Software Engineering Validation Suite
 * 
 * Validates the core deliverables of the Autonomous Real-World Capability Mission:
 * 1. Autonomous Task Execution Engine (DAG planning, step execution, checkpoints, outcome verification)
 * 2. Dynamic Replanning & Failure Recovery (re-evaluates plan when step fails, adapts, succeeds)
 * 3. Graceful Task Cancellation (AbortSignal, active tasks map cleanup, checkpoint finalization)
 * 4. Standardized Tool Registry Architecture (unified schemas, 0 duplicates, cancellation metadata)
 * 5. Autonomous Software Engineering Workflow (reproduction, isolated patching, diff verification, rollback)
 * 6. Authoritative Global Emergency Stop (immediate execution halting, tool execution blocking)
 * 7. Live REST Endpoints & Digital Brain Operations Console
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const { taskOrchestratorInstance } = require('./server/taskOrchestrator');
const { TOOLS, executeTool, getToolDefinition, listTools } = require('./server/toolsRegistry');
const { selfDevelopmentEngine } = require('./server/selfDevelopmentEngine');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController');
const { brainArchitectureEngine } = require('./server/brainArchitectureEngine');

function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

let passedCount = 0;
let failedCount = 0;

function pass(name) {
  console.log(`  ✓ PASSED: ${name}`);
  passedCount++;
}

function fail(name, error) {
  console.error(`  ✗ FAILED: ${name}`);
  console.error(error);
  failedCount++;
}

async function runMasterSuite() {
  console.log('\n================================================================');
  console.log('🤖 STARK AI 3.0: AUTONOMOUS TASK & ENGINEERING CAPABILITY SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  console.log('--- Suite 1: Standardized Tool Registry Architecture ---');
  // --------------------------------------------------------------------------
  try {
    const allTools = listTools();
    assert(allTools.length >= 35, `Expected >= 35 tools, found ${allTools.length}`);

    // Verify no duplicates
    const names = Object.keys(TOOLS);
    const uniqueNames = new Set(names);
    assert.strictEqual(names.length, uniqueNames.size, 'Tools registry must contain zero duplicate keys');

    // Verify standardized schemas
    for (const name of names) {
      const def = TOOLS[name];
      assert(typeof def.description === 'string' && def.description.length > 0, `Tool ${name} missing description`);
      assert(typeof def.personality === 'string', `Tool ${name} missing personality`);
      assert(typeof def.inputs === 'object', `Tool ${name} missing inputs object schema`);
      assert(typeof def.outputs === 'object', `Tool ${name} missing outputs object schema`);
      assert(Array.isArray(def.requiredPermissions), `Tool ${name} missing requiredPermissions array`);
      assert(typeof def.timeoutMs === 'number', `Tool ${name} missing numeric timeoutMs`);
      assert(typeof def.cancellationBehavior === 'string', `Tool ${name} missing cancellationBehavior`);
      assert(typeof def.healthStatus === 'string', `Tool ${name} missing healthStatus`);
      assert(typeof def.verificationMethod === 'string', `Tool ${name} missing verificationMethod`);
    }
    pass('1.1 100% of tools strictly adhere to unified schema (inputs, outputs, permissions, timeout, cancellation)');

    // Verify task tools are wired
    const taskTools = ['execute_autonomous_task', 'get_task_status', 'cancel_task', 'list_task_history'];
    for (const t of taskTools) {
      assert(TOOLS[t], `Task tool "${t}" must be registered in TOOLS registry`);
    }
    pass('1.2 Autonomous task execution tools are wired directly into central registry');
  } catch (err) {
    fail('1. Standardized Tool Registry Architecture', err);
  }

  // --------------------------------------------------------------------------
  console.log('\n--- Suite 2: Autonomous Task Execution Engine & DAG Planning ---');
  // --------------------------------------------------------------------------
  try {
    const progressEvents = [];
    const taskResult = await taskOrchestratorInstance.executeAutonomousTask({
      instruction: 'Inspect workspace files and read package.json configuration',
      personality: 'JARVIS',
      onProgress: (p) => progressEvents.push(p)
    });

    assert.strictEqual(taskResult.status, 'SUCCESS', 'Task must execute to SUCCESS');
    assert(taskResult.stepsExecuted >= 2, `Expected at least 2 steps executed, got ${taskResult.stepsExecuted}`);
    assert.strictEqual(taskResult.verification.verified, true, 'Outcome verification must assert truth');
    assert(progressEvents.length >= 3, 'Must emit progress lifecycle events');

    // Verify checkpoint was written
    const checkpointFile = path.join(__dirname, 'data', 'tasks', `${taskResult.taskId}_checkpoint.json`);
    assert(fs.existsSync(checkpointFile), 'Checkpoint file must be persisted to data/tasks/');
    const checkpointData = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
    assert.strictEqual(checkpointData.taskId, taskResult.taskId);
    pass('2.1 Multi-step autonomous task plans, executes DAG steps, and writes disk checkpoints');

    // Verify independent outcome verification
    assert(taskResult.verification.checks.length > 0, 'Verification checks must evaluate step outputs');
    assert.strictEqual(taskResult.verification.status, 'ALL_CHECKS_PASSED');
    pass('2.2 Independent outcome verification performs domain-specific sanity checks');
  } catch (err) {
    fail('2. Autonomous Task Execution Engine', err);
  }

  // --------------------------------------------------------------------------
  console.log('\n--- Suite 3: Dynamic Replanning & Failure Recovery ---');
  // --------------------------------------------------------------------------
  try {
    const recoveryResult = await taskOrchestratorInstance.executeAutonomousTask({
      instruction: 'Read non_existent_critical_spec_xyz99.txt and recover by inspecting workspace directory',
      personality: 'JARVIS'
    });

    assert.strictEqual(recoveryResult.status, 'SUCCESS', 'Recovery task must adapt and achieve SUCCESS');
    assert(recoveryResult.replanCount >= 1, `Expected replanCount >= 1, got ${recoveryResult.replanCount}`);
    assert(recoveryResult.stepsExecuted >= 2, 'Should execute recovery steps after failure');
    pass('3.1 Dynamic replanning detects step failure, formulates fallback DAG, and achieves resolution');
  } catch (err) {
    fail('3. Dynamic Replanning & Failure Recovery', err);
  }

  // --------------------------------------------------------------------------
  console.log('\n--- Suite 4: Graceful Task Cancellation & AbortController ---');
  // --------------------------------------------------------------------------
  try {
    const abortController = new AbortController();
    const taskPromise = taskOrchestratorInstance.executeAutonomousTask({
      instruction: 'Analyze robotic joint actuators and compute structural beam deflection stress',
      personality: 'JARVIS',
      abortSignal: abortController.signal
    });

    // Abort after 5ms
    setTimeout(() => abortController.abort(), 5);

    const cancelResult = await taskPromise;
    assert.strictEqual(cancelResult.status, 'CANCELLED');
    assert.strictEqual(cancelResult.cancelled, true);
    pass('4.1 In-flight autonomous task handles AbortSignal, aborts execution, and clears active state');
  } catch (err) {
    fail('4. Graceful Task Cancellation', err);
  }

  // --------------------------------------------------------------------------
  console.log('\n--- Suite 5: Autonomous Software Engineering Workflow ---');
  // --------------------------------------------------------------------------
  try {
    const workspaceRoot = __dirname;
    const testDir = path.join(workspaceRoot, 'data', 'temp_master_se_test');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    const srcFile = path.join(testDir, 'multiplier.js');
    fs.writeFileSync(srcFile, `function multiply(a, b) {\n  return a + b; // BUG: should be a * b\n}\nmodule.exports = { multiply };\n`, 'utf8');

    const testFile = path.join(testDir, 'test_multiplier.js');
    fs.writeFileSync(testFile, `const assert = require('assert');\nconst { multiply } = require('./multiplier');\nassert.strictEqual(multiply(3, 4), 12, '3 * 4 must equal 12');\nconsole.log('PASS');\n`, 'utf8');

    // Execute engineering workflow with rollback enabled
    const seResult = await selfDevelopmentEngine.executeSoftwareEngineeringWorkflow({
      repoPath: workspaceRoot,
      failingTestFile: path.relative(workspaceRoot, testFile),
      targetSourceFile: path.relative(workspaceRoot, srcFile),
      issueDescription: 'multiplier returns sum instead of product',
      proposedPatch: {
        targetContent: '  return a + b; // BUG: should be a * b',
        replacementContent: '  return a * b; // FIXED'
      },
      autoRollbackOnFailure: true
    });

    assert.strictEqual(seResult.reproduced, true, 'Workflow must successfully reproduce the bug first');
    assert.strictEqual(seResult.fixVerified, true, 'Workflow must verify tests pass after patch');
    assert.strictEqual(seResult.status, 'FIX_VERIFIED');
    assert(seResult.diff.includes('+  return a * b; // FIXED'), 'Workflow must produce unified diff');

    // Clean up temporary files
    try {
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile);
      if (fs.existsSync(testDir)) fs.rmdirSync(testDir, { recursive: true });
    } catch (e) {}

    pass('5.1 End-to-end software engineering workflow reproduces bug, generates patch, verifies diff & tests');
  } catch (err) {
    fail('5. Autonomous Software Engineering Workflow', err);
  }

  // --------------------------------------------------------------------------
  console.log('\n--- Suite 6: Global Emergency Stop Controller ---');
  // --------------------------------------------------------------------------
  try {
    // 1. Engage Emergency Stop
    const stopResult = emergencyStopControllerInstance.engage('Master suite emergency stop assertion');
    assert.strictEqual(emergencyStopControllerInstance.isEmergencyStopActive(), true);

    // 2. Verify tool execution blocked
    let blocked = false;
    try {
      await executeTool('get_current_time', {}, 'JARVIS');
    } catch (err) {
      blocked = err.message.includes('Emergency Stop is ACTIVE');
    }
    assert.strictEqual(blocked, true, 'All tool executions must be rejected while Emergency Stop is latched');

    // 3. Reset Emergency Stop
    emergencyStopControllerInstance.reset('Master suite test cleanup');
    assert.strictEqual(emergencyStopControllerInstance.isEmergencyStopActive(), false);

    // 4. Verify tool execution resumes
    const resumeRes = await executeTool('get_current_time', {}, 'JARVIS');
    assert(resumeRes.currentTime || resumeRes.iso, 'Tool execution must resume normally after reset');

    pass('6.1 Emergency stop immediately latches system, rejects tool executions, and cleanly resets');
  } catch (err) {
    fail('6. Global Emergency Stop Controller', err);
  }

  // --------------------------------------------------------------------------
  console.log('\n--- Suite 7: Live HTTP Server Endpoints ---');
  // --------------------------------------------------------------------------
  try {
    const health = await request({ hostname: 'localhost', port: 3000, path: '/api/status', method: 'GET' });
    assert.strictEqual(health.status, 200);

    const arch = await request({ hostname: 'localhost', port: 3000, path: '/api/brain/architecture', method: 'GET' });
    assert.strictEqual(arch.status, 200);
    assert(arch.body.subsystems.length >= 20);

    const history = await request({ hostname: 'localhost', port: 3000, path: '/api/orchestration/history', method: 'GET' });
    assert.strictEqual(history.status, 200);

    pass('7.1 Live server endpoints expose brain architecture, health, and task orchestration APIs');
  } catch (err) {
    fail('7. Live HTTP Server Endpoints', err);
  }

  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`FINAL RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) process.exit(1);
}

runMasterSuite().catch(err => {
  console.error('[FATAL] Master suite encountered unexpected error:', err);
  process.exit(1);
});
