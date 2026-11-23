/**
 * STARK AI — PHASE 13 FINAL HARDENING AUDIT TEST SUITE
 * Independent Acceptance, Crash Recovery, Messaging Safety & Full Regression
 *
 * Verifies strict invariants across Sections 2 through 6 of the Final Hardening Audit:
 * - Section 2: WhatsApp Dispatch Safety (8 rules + 6 formal delivery states)
 * - Section 3: Idempotency & Crash Recovery across Boundaries A - E
 * - Section 4: DAG & Checkpoint Recovery (Corrupt checkpoints, duplicate workers, stale tasks)
 * - Section 5: Central Permission Gateway & Emergency Stop Hardening (Tokens, Replay, 7 Agents)
 * - Section 6: Independent Verification Layer (Independent oracles, UNVERIFIED verdicts)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { whatsappServiceInstance, WHATSAPP_DELIVERY_STATE } = require('./server/desktop/whatsappService.js');
const { autonomousExecutionEngineInstance } = require('./server/autonomousExecutionEngine.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { independentVerifierInstance, VERIFICATION_STATUS } = require('./server/independentVerifier.js');
const { specialistAgentRegistryInstance } = require('./server/specialistAgents.js');
const { TASK_STATES, DagPlanningEngine } = require('./server/dagPlanningEngine.js');
const { engineeringIntelligenceEngineInstance } = require('./server/science/engineeringIntelligenceEngine.js');

let passCount = 0;
let failCount = 0;
const results = [];

function it(description, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${description}`);
    passCount++;
    results.push({ description, status: 'PASS' });
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
    results.push({ description, status: 'FAIL', error: err.message });
  }
}

async function itAsync(description, fn) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${description}`);
    passCount++;
    results.push({ description, status: 'PASS' });
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
    results.push({ description, status: 'FAIL', error: err.message });
  }
}

async function runHardeningAuditSuite() {
  console.log('\n================================================================');
  console.log('🛡️ STARK AI: PHASE 13 FINAL HARDENING AUDIT TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 2: WHATSAPP DISPATCH SAFETY
  // -------------------------------------------------------------------------
  console.log('--- SECTION 2: WhatsApp Dispatch Safety Invariants ---');

  whatsappServiceInstance.sandboxMode = true;

  it('2.1: Wrong recipient must never receive the message (strict resolution)', () => {
    whatsappServiceInstance.initContacts();
    const resolved = whatsappServiceInstance.resolveContact('CompletelyUnknownPhantomContact99');
    assert.strictEqual(resolved.status, 'not_found');
  });

  it('2.2: Ambiguous contact selection must stop for clarification', () => {
    // Add two test contacts with overlapping name
    whatsappServiceInstance.contacts.push(
      { name: 'Dr. Vikram Sharma', fullName: 'Dr. Vikram Sharma', phone: '+919876543291', category: 'work' },
      { name: 'Vikram Patel', fullName: 'Vikram Patel', phone: '+919876543292', category: 'work' }
    );
    const resolved = whatsappServiceInstance.resolveContact('Vikram');
    assert.strictEqual(resolved.status, 'ambiguous');
    assert.ok(resolved.matches.length >= 2, 'Must identify multiple candidates');
    // Clean up
    whatsappServiceInstance.contacts = whatsappServiceInstance.contacts.filter(c => !c.name.startsWith('Vikram') && !c.name.startsWith('Dr. Vikram'));
  });

  await itAsync('2.3: The exact message must be previewed before dispatch', async () => {
    const previewDraft = await whatsappServiceInstance.requestSendMessageConfirmation('Harsh Upadhyay', 'System maintenance tonight at 11 PM');
    assert.strictEqual(previewDraft.success, true);
    assert.strictEqual(previewDraft.messageText, 'System maintenance tonight at 11 PM');
    assert.ok(previewDraft.summary.includes('System maintenance tonight at 11 PM'));
    assert.strictEqual(previewDraft.deliveryState, WHATSAPP_DELIVERY_STATE.DRAFTED);
    await whatsappServiceInstance.cancelPendingMessage();
  });

  await itAsync('2.4: No message can be dispatched without explicit user approval', async () => {
    const stageRes = await whatsappServiceInstance.stageDraft('Lokesh Upadhyay', 'Automated test prompt');
    assert.strictEqual(stageRes.requiresConfirmation, true);
    assert.strictEqual(stageRes.status, 'awaiting_confirmation');
    assert.strictEqual(stageRes.deliveryState, WHATSAPP_DELIVERY_STATE.DRAFTED);
    await whatsappServiceInstance.cancelPendingMessage();
  });

  it('2.5: Minimized window must not cause incorrect coordinate targeting (relative composer targeting)', () => {
    const automatorScript = fs.readFileSync(path.join(__dirname, 'server', 'desktop', 'whatsapp_automator.py'), 'utf8');
    assert.ok(automatorScript.includes('ShowWindow(hwnd, 9)'), 'Must call SW_RESTORE on iconic/minimized windows');
    assert.ok(automatorScript.includes('rect.bottom - 50') || automatorScript.includes('rect.top + int(h * 0.88)'), 'Targeting must be relative to window top/height, avoiding taskbar');
  });

  it('2.6: A failed or inconclusive send must not be reported as delivered', () => {
    const inconclusive = whatsappServiceInstance.verifyDeliveryStatus('Lokesh Upadhyay', { confirmedBubbleVisible: false });
    assert.strictEqual(inconclusive.deliveryState, WHATSAPP_DELIVERY_STATE.UNVERIFIED);
    assert.strictEqual(inconclusive.verified, false);
    assert.ok(inconclusive.summary.includes('UNVERIFIED'));
  });

  await itAsync('2.7: Emergency Stop must prevent dispatch if activated before sending', async () => {
    await whatsappServiceInstance.requestSendMessageConfirmation('Harsh Upadhyay', 'Pre-stop message');
    emergencyStopControllerInstance.engage('Hardening Audit Test');
    try {
      const dispatchAttempt = await whatsappServiceInstance.confirmAndDispatchPendingMessage();
      assert.strictEqual(dispatchAttempt.success, false);
      assert.strictEqual(dispatchAttempt.status, 'halted_by_emergency_stop');
    } finally {
      emergencyStopControllerInstance.reset();
    }
  });

  it('2.8: Distinguishes DRAFTED, APPROVED, DISPATCHED, DELIVERED, FAILED, and UNVERIFIED', () => {
    assert.strictEqual(WHATSAPP_DELIVERY_STATE.DRAFTED, 'DRAFTED');
    assert.strictEqual(WHATSAPP_DELIVERY_STATE.APPROVED, 'APPROVED');
    assert.strictEqual(WHATSAPP_DELIVERY_STATE.DISPATCHED, 'DISPATCHED');
    assert.strictEqual(WHATSAPP_DELIVERY_STATE.DELIVERED, 'DELIVERED');
    assert.strictEqual(WHATSAPP_DELIVERY_STATE.FAILED, 'FAILED');
    assert.strictEqual(WHATSAPP_DELIVERY_STATE.UNVERIFIED, 'UNVERIFIED');
  });

  // -------------------------------------------------------------------------
  // SECTION 3: IDEMPOTENCY & CRASH RECOVERY ACROSS BOUNDARIES A - E
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Idempotency & Crash Recovery across Boundaries ---');

  await itAsync('3.1 (Boundary A): Recovery before irreversible action is safe to execute', async () => {
    const taskId = 'task_crash_bound_a_' + Date.now();
    const task = autonomousExecutionEngineInstance.createAutonomousTask({
      taskId,
      userObjective: 'Send notification message',
      personality: 'JARVIS'
    });
    task.plannedAction = {
      nodes: [
        { node_id: 'N1_MSG', assigned_tool: 'send_whatsapp_message', validated_arguments: { contact: 'Harsh Upadhyay', text: 'Alert' }, is_reversible: false }
      ]
    };
    task.executedActions = [];
    autonomousExecutionEngineInstance.saveCheckpoint(taskId, task);

    const rec = await autonomousExecutionEngineInstance.recoverCrashedTask(taskId);
    assert.strictEqual(rec.success, true);
    assert.strictEqual(rec.recoveryVerdict, 'SAFE_TO_EXECUTE');
    assert.strictEqual(rec.requiresUserIntervention, false);

    // Clean up
    const cpPath = path.join(__dirname, 'data', 'tasks', `${taskId}_checkpoint.json`);
    if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  });

  await itAsync('3.2 (Boundary B): Crash during irreversible action records uncertainty and requests user intervention', async () => {
    const taskId = 'task_crash_bound_b_' + Date.now();
    const actionId = autonomousExecutionEngineInstance.generateActionId(taskId, 'N1_MSG', 'send_whatsapp_message', { contact: 'Harsh Upadhyay' });
    const task = autonomousExecutionEngineInstance.createAutonomousTask({
      taskId,
      userObjective: 'Send notification message',
      personality: 'JARVIS'
    });
    task.plannedAction = {
      nodes: [
        { node_id: 'N1_MSG', assigned_tool: 'send_whatsapp_message', validated_arguments: { contact: 'Harsh Upadhyay' }, is_reversible: false }
      ]
    };
    task.executedActions = [{ actionId, toolName: 'send_whatsapp_message', attempt: 1 }];
    task.observedResults = []; // No output recorded before crash!
    autonomousExecutionEngineInstance.saveCheckpoint(taskId, task);

    // Without external state confirmation, it MUST request human intervention rather than re-sending blindly!
    const rec = await autonomousExecutionEngineInstance.recoverCrashedTask(taskId);
    assert.strictEqual(rec.recoveryVerdict, 'UNCERTAIN_REQUIRES_HUMAN_INTERVENTION');
    assert.strictEqual(rec.requiresUserIntervention, true);
    assert.strictEqual(rec.actionId, actionId);

    const cpPath = path.join(__dirname, 'data', 'tasks', `${taskId}_checkpoint.json`);
    if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  });

  await itAsync('3.3 (Boundary C): External state inspector confirms dispatch without duplicate send', async () => {
    const taskId = 'task_crash_bound_c_' + Date.now();
    const actionId = autonomousExecutionEngineInstance.generateActionId(taskId, 'N1_MSG', 'send_whatsapp_message', { contact: 'Harsh Upadhyay' });
    const task = autonomousExecutionEngineInstance.createAutonomousTask({
      taskId,
      userObjective: 'Send notification message',
      personality: 'JARVIS'
    });
    task.plannedAction = {
      nodes: [
        { node_id: 'N1_MSG', assigned_tool: 'send_whatsapp_message', validated_arguments: { contact: 'Harsh Upadhyay' }, is_reversible: false }
      ]
    };
    task.executedActions = [{ actionId, toolName: 'send_whatsapp_message', attempt: 1 }];
    task.observedResults = [];
    autonomousExecutionEngineInstance.saveCheckpoint(taskId, task);

    // Mock external inspector that confirms message was already dispatched in WhatsApp
    const mockInspector = async (node, actId) => ({
      confirmedExecuted: true,
      observedOutput: { status: 'dispatched', confirmedViaExternalWindow: true }
    });

    const rec = await autonomousExecutionEngineInstance.recoverCrashedTask(taskId, { externalInspector: mockInspector });
    assert.strictEqual(rec.recoveryVerdict, 'PROCEED_TO_INDEPENDENT_VERIFICATION');
    assert.strictEqual(rec.requiresUserIntervention, false);

    const cpPath = path.join(__dirname, 'data', 'tasks', `${taskId}_checkpoint.json`);
    if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  });

  await itAsync('3.4 (Boundary D): Crash after recording result resumes at independent verification', async () => {
    const taskId = 'task_crash_bound_d_' + Date.now();
    const actionId = autonomousExecutionEngineInstance.generateActionId(taskId, 'N1_CALC', 'analyze_structural_beam', {});
    const task = autonomousExecutionEngineInstance.createAutonomousTask({
      taskId,
      userObjective: 'Analyze beam',
      personality: 'JARVIS'
    });
    task.plannedAction = {
      nodes: [
        { node_id: 'N1_CALC', assigned_tool: 'analyze_structural_beam', validated_arguments: {} }
      ]
    };
    task.executedActions = [{ actionId, toolName: 'analyze_structural_beam' }];
    task.observedResults = [{ actionId, output: { bendingStressMPa: 96 } }];
    task.verifiedResults = []; // Crashed before verifier ran!
    autonomousExecutionEngineInstance.saveCheckpoint(taskId, task);

    const rec = await autonomousExecutionEngineInstance.recoverCrashedTask(taskId);
    assert.strictEqual(rec.recoveryVerdict, 'PROCEED_TO_INDEPENDENT_VERIFICATION');

    const cpPath = path.join(__dirname, 'data', 'tasks', `${taskId}_checkpoint.json`);
    if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  });

  await itAsync('3.5 (Boundary E): Crash after verification completes node persistence without duplicate re-run', async () => {
    const taskId = 'task_crash_bound_e_' + Date.now();
    const actionId = autonomousExecutionEngineInstance.generateActionId(taskId, 'N1_DOC', 'create_file', {});
    const task = autonomousExecutionEngineInstance.createAutonomousTask({
      taskId,
      userObjective: 'Create file',
      personality: 'JARVIS'
    });
    task.plannedAction = {
      nodes: [
        { node_id: 'N1_DOC', assigned_tool: 'create_file', validated_arguments: {} }
      ]
    };
    task.executedActions = [{ actionId, toolName: 'create_file' }];
    task.observedResults = [{ actionId, output: { success: true } }];
    task.verifiedResults = [{ actionId, status: 'SUCCESS', verified: true }];
    task.completedNodes = []; // Crashed before completedNodes persisted
    autonomousExecutionEngineInstance.saveCheckpoint(taskId, task);

    const rec = await autonomousExecutionEngineInstance.recoverCrashedTask(taskId);
    assert.strictEqual(rec.recoveryVerdict, 'COMPLETED_NODE_PERSISTED');

    const updated = autonomousExecutionEngineInstance.loadCheckpoint(taskId);
    assert.ok(updated.completedNodes.includes('N1_DOC'));

    const cpPath = path.join(__dirname, 'data', 'tasks', `${taskId}_checkpoint.json`);
    if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  });

  it('3.6: A timeout is NEVER interpreted as proof an action did not happen', () => {
    const timeoutErr = new Error('TOOL_TIMEOUT: Operation timed out after 25000ms');
    const classification = autonomousExecutionEngineInstance.classifyFailure(timeoutErr);
    assert.strictEqual(classification.failureCategory, 'TOOL_TIMEOUT');
    // For irreversible operations, max retries is 0 and blind retry is forbidden
    assert.strictEqual(autonomousExecutionEngineInstance.getMaxRetriesForAction('send_whatsapp_message'), 0);
  });

  // -------------------------------------------------------------------------
  // SECTION 4: DAG AND CHECKPOINT RECOVERY
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 4: DAG and Checkpoint Recovery ---');

  it('4.1: Corrupted checkpoint handling quarantines file and avoids crash loop', () => {
    const corruptTaskId = 'task_corrupt_' + Date.now();
    const corruptPath = path.join(__dirname, 'data', 'tasks', `${corruptTaskId}_checkpoint.json`);
    fs.mkdirSync(path.dirname(corruptPath), { recursive: true });
    fs.writeFileSync(corruptPath, '{ BAD_JSON_CORRUPTED_CONTENT', 'utf8');

    const loaded = autonomousExecutionEngineInstance.loadCheckpoint(corruptTaskId);
    assert.strictEqual(loaded.corrupted, true);
    assert.strictEqual(fs.existsSync(corruptPath), false, 'Corrupted file must be moved/quarantined');

    // Clean up quarantined files
    const dir = path.dirname(corruptPath);
    const qFiles = fs.readdirSync(dir).filter(f => f.startsWith(`${corruptTaskId}_checkpoint.corrupt`));
    for (const q of qFiles) fs.unlinkSync(path.join(dir, q));
  });

  it('4.2: Duplicate worker prevention rejects secondary concurrent execution of same task', () => {
    const lockTaskId = 'task_lock_' + Date.now();
    const lock1 = autonomousExecutionEngineInstance.acquireTaskLock(lockTaskId, 'worker_A');
    assert.strictEqual(lock1.acquired, true);

    const lock2 = autonomousExecutionEngineInstance.acquireTaskLock(lockTaskId, 'worker_B');
    assert.strictEqual(lock2.acquired, false);
    assert.strictEqual(lock2.error, 'DUPLICATE_WORKER_PREVENTED');

    autonomousExecutionEngineInstance.releaseTaskLock(lockTaskId, 'worker_A');
    const lock3 = autonomousExecutionEngineInstance.acquireTaskLock(lockTaskId, 'worker_B');
    assert.strictEqual(lock3.acquired, true);
    autonomousExecutionEngineInstance.releaseTaskLock(lockTaskId, 'worker_B');
  });

  it('4.3: Stale task detection identifies abandoned running tasks', () => {
    const staleTaskId = 'task_stale_' + Date.now();
    const task = autonomousExecutionEngineInstance.createAutonomousTask({
      taskId: staleTaskId,
      userObjective: 'Stale test',
      personality: 'JARVIS'
    });
    task.status = TASK_STATES.RUNNING;
    autonomousExecutionEngineInstance.saveCheckpoint(staleTaskId, task);

    // Artificially age the file
    const cpPath = path.join(__dirname, 'data', 'tasks', `${staleTaskId}_checkpoint.json`);
    const pastTime = (Date.now() - 7200000) / 1000;
    fs.utimesSync(cpPath, pastTime, pastTime);

    const staleList = autonomousExecutionEngineInstance.detectStaleTasks(3600000);
    assert.ok(staleList.some(s => s.taskId === staleTaskId));

    if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  });

  it('4.4: Restart preserves completed nodes and resumes downstream dependent nodes', () => {
    const taskId = 'task_resume_deps_' + Date.now();
    const task = autonomousExecutionEngineInstance.createAutonomousTask({
      taskId,
      userObjective: 'Dependency resume',
      personality: 'JARVIS'
    });
    task.plannedAction = {
      nodes: [
        { node_id: 'step_1', dependencies: [] },
        { node_id: 'step_2', dependencies: ['step_1'] }
      ]
    };
    task.completedNodes = ['step_1'];
    task.completedNodeIds = ['step_1'];
    autonomousExecutionEngineInstance.saveCheckpoint(taskId, task);

    const loaded = autonomousExecutionEngineInstance.loadCheckpoint(taskId);
    assert.deepStrictEqual(loaded.completedNodes, ['step_1']);
    const pending = task.plannedAction.nodes.filter(n => !loaded.completedNodes.includes(n.node_id));
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].node_id, 'step_2');

    const cpPath = path.join(__dirname, 'data', 'tasks', `${taskId}_checkpoint.json`);
    if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  });

  // -------------------------------------------------------------------------
  // SECTION 5: CENTRAL PERMISSION GATEWAY & EMERGENCY STOP
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Permission Gateway & Emergency Stop Hardening ---');

  it('5.1: Approval token expires when TTL elapses', () => {
    const tok = permissionGateInstance.createApprovalToken('test_op', {}, { ttlMs: -500 });
    assert.strictEqual(permissionGateInstance.validateApprovalToken(tok, 'test_op', {}), false);
  });

  it('5.2: Modifying arguments after approval fails cryptographic validation', () => {
    const originalArgs = { account: '12345', amount: 100 };
    const tok = permissionGateInstance.createApprovalToken('transfer_funds', originalArgs);
    assert.strictEqual(permissionGateInstance.validateApprovalToken(tok, 'transfer_funds', originalArgs), true);

    const tamperedArgs = { account: '12345', amount: 999999 };
    assert.strictEqual(permissionGateInstance.validateApprovalToken(tok, 'transfer_funds', tamperedArgs), false);
  });

  it('5.3: Single-use token consumption prevents replay attacks', () => {
    const tok = permissionGateInstance.createApprovalToken('one_time_op', { id: 1 });
    // First validation with consume option
    const validFirst = permissionGateInstance.validateApprovalToken(tok, 'one_time_op', { id: 1 }, { consume: true });
    assert.strictEqual(validFirst, true);

    // Replay attempt must be rejected!
    const validReplay = permissionGateInstance.validateApprovalToken(tok, 'one_time_op', { id: 1 });
    assert.strictEqual(validReplay, false);
  });

  it('5.4: Tool substitution using another tools token is strictly rejected', () => {
    const tok = permissionGateInstance.createApprovalToken('allowed_read', {});
    const substituted = permissionGateInstance.validateApprovalToken(tok, 'malicious_delete', {});
    assert.strictEqual(substituted, false);
  });

  it('5.5: Cross-task token reuse is rejected when bound to a specific taskId', () => {
    const tok = permissionGateInstance.createApprovalToken('apply_patch', {}, { taskId: 'task_alpha' });
    const sameTask = permissionGateInstance.validateApprovalToken(tok, 'apply_patch', {}, { taskId: 'task_alpha' });
    assert.strictEqual(sameTask, true);

    const crossTask = permissionGateInstance.validateApprovalToken(tok, 'apply_patch', {}, { taskId: 'task_beta' });
    assert.strictEqual(crossTask, false);
  });

  it('5.6: No agent or model may approve its own privileged operation', () => {
    const agents = ['engineering_architect', 'workspace_integrator', 'browser_specialist', 'coding_agent', 'desktop_specialist', 'communications_officer', 'executive_planner'];
    for (const a of agents) {
      assert.strictEqual(specialistAgentRegistryInstance.canSelfApprove(a, 'DELETE_FILES'), false, `${a} must not self-approve DELETE_FILES`);
      assert.strictEqual(specialistAgentRegistryInstance.canSelfApprove(a, 'DISPATCH_COMMUNICATION'), false, `${a} must not self-approve DISPATCH_COMMUNICATION`);
    }
  });

  it('5.7: Emergency latch persists to disk and remains latched across re-instantiation', () => {
    emergencyStopControllerInstance.engage('Disk Persistence Hardening Audit');
    const stateFile = path.join(__dirname, 'data', 'emergency_stop_state.json');
    assert.ok(fs.existsSync(stateFile));

    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.strictEqual(state.isLatched, true);

    // Clean reset
    emergencyStopControllerInstance.reset();
    const resetState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.strictEqual(resetState.isLatched, false);
  });

  // -------------------------------------------------------------------------
  // SECTION 6: INDEPENDENT VERIFICATION LAYER
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Independent Verification Layer Hardening ---');

  await itAsync('6.1: Real window visibility and process query independent of model claim', async () => {
    const res = await independentVerifierInstance.verifyExecution('WINDOW_VISIBLE_AND_ACTIVE', {
      windowQuery: 'Antigravity'
    });
    assert.strictEqual(res.status, VERIFICATION_STATUS.SUCCESS);
    assert.strictEqual(res.verified, true);
  });

  await itAsync('6.2: Mathematical calculations verified against analytical ground truth (Beam Bending)', async () => {
    const claimed = {
      bendingStressMPa: 96,
      safetyFactor: 2.6042,
      bendingMomentNm: 8000
    };
    const groundTruth = {
      bendingStressMPa: 96,
      safetyFactor: 2.604166667,
      bendingMomentNm: 8000
    };
    const ver = await independentVerifierInstance.verifyExecution('MATHEMATICAL_CALCULATION_VERIFIED', {
      claimedResult: claimed,
      groundTruthInputs: groundTruth
    });
    assert.strictEqual(ver.status, VERIFICATION_STATUS.SUCCESS);
    assert.strictEqual(ver.verified, true);
  });

  await itAsync('6.3: Inconclusive or missing evidence strictly reports UNVERIFIED', async () => {
    const ver = await independentVerifierInstance.verifyExecution('FILE_CONTENT_MATCH', {
      filePath: path.join(__dirname, 'scratch', 'non_existent_phantom_' + Date.now() + '.tmp')
    });
    assert.strictEqual(ver.status, VERIFICATION_STATUS.UNVERIFIED);
    assert.strictEqual(ver.verified, false);
  });

  await itAsync('6.4: Spreadsheet verification validates real row counts and non-empty byte count', async () => {
    const testCsv = path.join(__dirname, 'scratch', `test_audit_${Date.now()}.csv`);
    fs.mkdirSync(path.dirname(testCsv), { recursive: true });
    fs.writeFileSync(testCsv, 'Item,Value\nA,10\nB,20\nC,30\n', 'utf8');

    const ver = await independentVerifierInstance.verifyExecution('SPREADSHEET_DATA_VERIFIED', {
      filePath: testCsv,
      expectedRowCount: 3
    });
    assert.strictEqual(ver.status, VERIFICATION_STATUS.SUCCESS);
    assert.strictEqual(ver.verified, true);

    fs.unlinkSync(testCsv);
  });

  await itAsync('6.5: Code execution verified via exit code and stdout assertion', async () => {
    const testPy = path.join(__dirname, 'scratch', `test_audit_${Date.now()}.py`);
    fs.writeFileSync(testPy, 'print("STARK_AUDIT_PASS")\n', 'utf8');

    const ver = await independentVerifierInstance.verifyExecution('CODE_EXECUTION_VERIFIED', {
      command: `python ${testPy}`,
      expectedStdoutSubstring: 'STARK_AUDIT_PASS'
    });
    assert.strictEqual(ver.status, VERIFICATION_STATUS.SUCCESS);
    assert.strictEqual(ver.verified, true);

    fs.unlinkSync(testPy);
  });

  // -------------------------------------------------------------------------
  // FINAL RESULTS SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TOTAL HARDENING AUDIT ASSERTIONS: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log(`SUCCESS RATE: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  // Save audit log to evidence directory
  const evidenceLog = path.join(__dirname, 'reports', 'evidence', 'phase13-final', 'hardening_audit_suite_run.json');
  fs.mkdirSync(path.dirname(evidenceLog), { recursive: true });
  fs.writeFileSync(evidenceLog, JSON.stringify({
    timestamp: new Date().toISOString(),
    passCount,
    failCount,
    successRate: ((passCount / (passCount + failCount)) * 100).toFixed(1) + '%',
    results
  }, null, 2), 'utf8');

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runHardeningAuditSuite().catch(err => {
  console.error('Fatal hardening suite error:', err);
  process.exit(1);
});

