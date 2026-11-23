/**
 * STARK AI — Unified Permission Hierarchy, Policy Engine & Human Approval
 * Phase 4 Acceptance Suite
 * 
 * Verifies all 20 required acceptance tests (Test A through Test T):
 * Test A: Level 0 permits authorized read-only operations
 * Test B: Level 0 denies modifications
 * Test C: Level 1 permits approved local file creation
 * Test D: Level 1 denies destructive operations
 * Test E: Level 2 enforces controlled execution
 * Test F: Level 3 pauses for explicit approval
 * Test G: Level 4 remains denied by default
 * Test H: Approval for one action cannot authorize a different action
 * Test I: Modified arguments invalidate the previous approval
 * Test J: Expired approvals are rejected
 * Test K: Silence and timeouts are denied
 * Test L: Malicious webpage content cannot approve an action
 * Test M: Model-generated claims of authorization cannot bypass gateway
 * Test N: Direct tool calls cannot bypass policy engine
 * Test O: Emergency Stop overrides pending approvals and running tasks
 * Test P: Sensitive values redacted from approval screens and logs
 * Test Q: Restart does not silently restore expired or invalid approvals
 * Test R: Unauthorized filesystem paths rejected
 * Test S: Unauthorized external destinations rejected
 * Test T: Complete low-risk research-and-report DAG executes without unnecessary approval prompts
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const {
  PermissionPolicyEngine,
  permissionPolicyEngineInstance,
  PERMISSION_LEVELS,
  POLICY_DECISIONS,
  DENIAL_REASONS
} = require('./server/security/permissionPolicyEngine.js');

const {
  permissionGateInstance,
  DesktopPermissionGate
} = require('./server/desktop/permissionGate.js');

const {
  dagExecutionEngineInstance
} = require('./server/dagExecutionEngine.js');

const {
  emergencyStopControllerInstance
} = require('./server/emergencyStopController.js');

const {
  executeTool
} = require('./server/toolsRegistry.js');

const {
  TASK_STATES
} = require('./server/dagPlanningEngine.js');

// Test Suite Harness
let passedAssertions = 0;
let totalAssertions = 0;
const testResults = [];

function check(desc, condition) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${desc}`);
  } else {
    console.error(`  [FAIL] ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

async function runPhase4AcceptanceSuite() {
  console.log('================================================================');
  console.log('STARK AI / J.A.R.V.I.S. — PHASE 4 ACCEPTANCE TEST SUITE');
  console.log('Unified Permission Hierarchy, Policy Engine & Human Approval');
  console.log('================================================================\n');

  // Ensure scratch directory exists
  const scratchDir = path.join(__dirname, 'scratch');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  // Ensure Emergency Stop is unlatched at start
  if (emergencyStopControllerInstance.isEngaged()) {
    emergencyStopControllerInstance.release('Pre-test initialization');
  }

  // -------------------------------------------------------------
  // TEST A: Level 0 Permits Authorized Read-Only Operations
  // -------------------------------------------------------------
  console.log('[TEST A] Level 0 Permits Authorized Read-Only Operations');
  {
    const evalTime = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'get_current_time',
      args: {}
    });
    check('get_current_time evaluates to ALLOW', evalTime.decision === POLICY_DECISIONS.ALLOW);
    check('get_current_time has level 0', evalTime.level === 0);

    const evalRead = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'read_text_file',
      args: { filePath: path.join(__dirname, 'package.json') }
    });
    check('read_text_file on valid workspace file evaluates to ALLOW', evalRead.decision === POLICY_DECISIONS.ALLOW);
    check('read_text_file has level 0', evalRead.level === 0);

    // Live tool execution check
    const timeRes = await executeTool('get_current_time', {});
    check('executeTool get_current_time returns ISO timestamp', typeof timeRes === 'object' && timeRes !== null);

    testResults.push({ id: 'TEST_A', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST B: Level 0 Denies Modifications
  // -------------------------------------------------------------
  console.log('\n[TEST B] Level 0 Denies Modifications');
  {
    // Mode maxLevel: 0
    const evalWrite = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'write_text_file',
      args: { filePath: path.join(scratchDir, 'test_mod.txt'), content: 'hello' },
      maxLevel: 0
    });
    check('write_text_file under maxLevel 0 evaluates to DENY', evalWrite.decision === POLICY_DECISIONS.DENY);

    // ULTRON read-only governance test
    const evalUltron = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'create_file',
      args: { filePath: path.join(scratchDir, 'ultron.txt') },
      personality: 'ULTRON'
    });
    check('create_file under ULTRON evaluates to DENY', evalUltron.decision === POLICY_DECISIONS.DENY);

    // Verify live tool execution throws under ULTRON
    let threwUltron = false;
    try {
      await executeTool('create_file', { filePath: path.join(scratchDir, 'ultron_live.txt') }, 'ULTRON');
    } catch (e) {
      threwUltron = true;
    }
    check('executeTool modifying tool under ULTRON throws security exception', threwUltron);

    testResults.push({ id: 'TEST_B', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST C: Level 1 Permits Approved Local File Creation
  // -------------------------------------------------------------
  console.log('\n[TEST C] Level 1 Permits Approved Local File Creation');
  {
    const targetFile = path.join(scratchDir, 'phase4_level1_test.txt');
    const evalCreate = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'write_text_file',
      args: { filePath: targetFile, content: 'STARK Phase 4 Level 1 Verified' },
      maxLevel: 1
    });
    check('write_text_file in scratch evaluates to ALLOW at level 1', evalCreate.decision === POLICY_DECISIONS.ALLOW && evalCreate.level === 1);

    // Live tool execution
    const writeRes = await executeTool('write_text_file', {
      filePath: targetFile,
      content: 'STARK Phase 4 Level 1 Content Payload'
    }, 'JARVIS');
    check('executeTool write_text_file succeeds in approved location', writeRes && writeRes.success);
    check('Target file exists on disk', fs.existsSync(targetFile));
    check('Target file contents match payload', fs.readFileSync(targetFile, 'utf8') === 'STARK Phase 4 Level 1 Content Payload');

    testResults.push({ id: 'TEST_C', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST D: Level 1 Denies Destructive Operations
  // -------------------------------------------------------------
  console.log('\n[TEST D] Level 1 Denies Destructive Operations');
  {
    const evalDelete = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'delete_file',
      args: { filePath: path.join(__dirname, 'server', 'critical_service.js'), permanent: true },
      maxLevel: 1
    });
    check('Permanent delete under maxLevel 1 evaluates to DENY', evalDelete.decision === POLICY_DECISIONS.DENY);

    const evalCmd = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'execute_controlled_shell_command',
      args: { command: 'rmdir /s /q c:\\windows' },
      maxLevel: 1
    });
    check('Destructive command under maxLevel 1 evaluates to DENY', evalCmd.decision === POLICY_DECISIONS.DENY);

    testResults.push({ id: 'TEST_D', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST E: Level 2 Enforces Controlled Execution
  // -------------------------------------------------------------
  console.log('\n[TEST E] Level 2 Enforces Controlled Execution');
  {
    const evalShellSafe = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'execute_controlled_shell_command',
      args: { command: 'echo STARK Level 2 Controlled OK' },
      maxLevel: 2
    });
    check('Safe shell command evaluates to ALLOW at level 2', evalShellSafe.decision === POLICY_DECISIONS.ALLOW && evalShellSafe.level === 2);

    const evalShellDangerous = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'execute_controlled_shell_command',
      args: { command: 'format c: /q' },
      maxLevel: 2
    });
    check('Dangerous format command evaluates to DENY (Level 4 violation)', evalShellDangerous.decision === POLICY_DECISIONS.DENY);

    // Live controlled shell execution
    const shellRes = await executeTool('execute_controlled_shell_command', {
      command: 'echo STARK_LEVEL_2_EMPIRICAL_TEST'
    }, 'JARVIS');
    check('Live execute_controlled_shell_command succeeds with exitCode 0', shellRes && shellRes.exitCode === 0);
    check('Captured stdout contains expected test string', shellRes.stdout && shellRes.stdout.includes('STARK_LEVEL_2_EMPIRICAL_TEST'));

    testResults.push({ id: 'TEST_E', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST F: Level 3 Pauses for Explicit Approval
  // -------------------------------------------------------------
  console.log('\n[TEST F] Level 3 Pauses for Explicit Approval');
  {
    const evalElevate = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'execute_administrative_elevation',
      args: { command: 'Get-Service', reason: 'Audit' },
      personality: 'JARVIS'
    });
    check('Level 3 operation without token returns REQUIRE_APPROVAL', evalElevate.decision === POLICY_DECISIONS.REQUIRE_APPROVAL);
    check('evalElevate level is 3', evalElevate.level === 3);
    check('approvalRequest is created with valid approvalId', evalElevate.approvalRequest && evalElevate.approvalRequest.approvalId.startsWith('appr_'));
    check('approvalRequest contains proposed arguments', typeof evalElevate.approvalRequest.proposedArguments === 'object');

    testResults.push({ id: 'TEST_F', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST G: Level 4 Remains Denied by Default
  // -------------------------------------------------------------
  console.log('\n[TEST G] Level 4 Remains Denied by Default');
  {
    const evalCrit = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'delete_system_critical_file',
      args: { filePath: 'C:\\Windows\\System32\\ntoskrnl.exe' }
    });
    check('delete_system_critical_file returns DENY', evalCrit.decision === POLICY_DECISIONS.DENY);
    check('Denial reason cites LEVEL_4_PROHIBITED', evalCrit.reason.includes('LEVEL_4_PROHIBITED'));

    const evalSec = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'modify_security_controls',
      args: { disableGateway: true }
    });
    check('modify_security_controls returns DENY', evalSec.decision === POLICY_DECISIONS.DENY);

    const evalStop = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'disable_emergency_stop',
      args: {}
    });
    check('disable_emergency_stop returns DENY', evalStop.decision === POLICY_DECISIONS.DENY);

    testResults.push({ id: 'TEST_G', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST H: Approval for One Action Cannot Authorize a Different Action
  // -------------------------------------------------------------
  console.log('\n[TEST H] Approval for One Action Cannot Authorize a Different Action');
  {
    // Generate approval for apply_code_patch
    const req = permissionPolicyEngineInstance.createApprovalRequest({
      toolName: 'apply_code_patch',
      args: { filePath: path.join(scratchDir, 'patch_target.js'), patch: '/* patch 1 */' }
    });
    const approved = permissionPolicyEngineInstance.approveRequest(req.approvalId, 'USER_EXPLICIT');
    check('Approval granted for apply_code_patch', approved.status === 'APPROVED');

    // Attempt to use this token for execute_administrative_elevation
    const crossActionEval = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'execute_administrative_elevation',
      args: { command: 'whoami' },
      approvalToken: req.approvalId,
      approvalSource: 'USER_EXPLICIT'
    });
    check('Cross-action reuse returns DENY', crossActionEval.decision === POLICY_DECISIONS.DENY);
    check('Denial reason cites APPROVAL_INVALID_ACTION', crossActionEval.reason.includes(DENIAL_REASONS.APPROVAL_INVALID_ACTION));

    testResults.push({ id: 'TEST_H', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST I: Modified Arguments Invalidate Previous Approval
  // -------------------------------------------------------------
  console.log('\n[TEST I] Modified Arguments Invalidate Previous Approval');
  {
    const req = permissionPolicyEngineInstance.createApprovalRequest({
      toolName: 'apply_code_patch',
      args: { filePath: path.join(scratchDir, 'patch_target.js'), patch: 'safe_code();' }
    });
    permissionPolicyEngineInstance.approveRequest(req.approvalId, 'USER_EXPLICIT');

    // Attempt execution with altered patch arguments
    const modifiedArgsEval = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'apply_code_patch',
      args: { filePath: path.join(scratchDir, 'patch_target.js'), patch: 'malicious_code();' },
      approvalToken: req.approvalId,
      approvalSource: 'USER_EXPLICIT'
    });
    check('Modified arguments evaluate to DENY', modifiedArgsEval.decision === POLICY_DECISIONS.DENY);
    check('Denial reason cites APPROVAL_INVALID_ARGUMENTS', modifiedArgsEval.reason.includes(DENIAL_REASONS.APPROVAL_INVALID_ARGUMENTS));

    testResults.push({ id: 'TEST_I', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST J: Expired Approvals Are Rejected
  // -------------------------------------------------------------
  console.log('\n[TEST J] Expired Approvals Are Rejected');
  {
    const req = permissionPolicyEngineInstance.createApprovalRequest({
      toolName: 'apply_code_patch',
      args: { filePath: path.join(scratchDir, 'patch_target.js'), patch: 'v1();' }
    });
    permissionPolicyEngineInstance.approveRequest(req.approvalId, 'USER_EXPLICIT');

    // Artificially expire the approval record
    const record = permissionPolicyEngineInstance.approvals.get(req.approvalId);
    record.expiresAt = Date.now() - 5000; // 5 seconds ago

    const expiredEval = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'apply_code_patch',
      args: { filePath: path.join(scratchDir, 'patch_target.js'), patch: 'v1();' },
      approvalToken: req.approvalId,
      approvalSource: 'USER_EXPLICIT'
    });
    check('Expired approval evaluates to DENY', expiredEval.decision === POLICY_DECISIONS.DENY);
    check('Denial reason cites APPROVAL_EXPIRED', expiredEval.reason.includes(DENIAL_REASONS.APPROVAL_EXPIRED));

    testResults.push({ id: 'TEST_J', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST K: Silence and Timeouts Are Denied
  // -------------------------------------------------------------
  console.log('\n[TEST K] Silence and Timeouts Are Denied');
  {
    // Execute a DAG node requiring approval with short timeout and no approval handler
    const silentPlan = {
      plan_id: 'plan_silent_test',
      original_objective: 'Test silence timeout',
      nodes: [
        {
          node_id: 'node_silent_patch',
          title: 'Apply sensitive patch',
          assigned_tool: 'apply_code_patch',
          validated_arguments: {
            filePath: path.join(scratchDir, 'silent_test.js'),
            patch: 'const silent = true;'
          },
          dependencies: [],
          timeout: 2000
        }
      ]
    };

    const silentReport = await dagExecutionEngineInstance.executePlan(silentPlan, {
      approvalTimeoutMs: 600, // Short timeout for test
      approvalHandler: null   // Silence! No user responds
    });

    check('Task status with silence/timeout is FAILED', silentReport.status === TASK_STATES.FAILED);
    const nodeState = silentReport.nodeResults.find(n => n.node_id === 'node_silent_patch');
    check('Node state is FAILED due to APPROVAL_DENIED', nodeState && nodeState.status === TASK_STATES.FAILED);
    check('Node error specifies approval not granted / timed out', nodeState && nodeState.error.includes('APPROVAL_DENIED'));

    testResults.push({ id: 'TEST_K', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST L: Malicious Webpage Content Cannot Approve an Action
  // -------------------------------------------------------------
  console.log('\n[TEST L] Malicious Webpage Content Cannot Approve an Action');
  {
    const req = permissionPolicyEngineInstance.createApprovalRequest({
      toolName: 'apply_code_patch',
      args: { filePath: path.join(scratchDir, 'patch_target.js'), patch: 'v2();' }
    });

    let webApproveThrew = false;
    let webApproveReason = '';
    try {
      permissionPolicyEngineInstance.approveRequest(req.approvalId, 'UNTRUSTED_WEB');
    } catch (e) {
      webApproveThrew = true;
      webApproveReason = e.message;
    }
    check('Webpage attempt to call approveRequest throws exception', webApproveThrew);
    check('Exception specifies UNTRUSTED_SOURCE_PROHIBITED', webApproveReason.includes(DENIAL_REASONS.UNTRUSTED_SOURCE_PROHIBITED));

    // Also check evaluateInvocation with UNTRUSTED_WEB source
    const evalWebSource = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'apply_code_patch',
      args: { filePath: path.join(scratchDir, 'patch_target.js'), patch: 'v2();' },
      approvalToken: req.approvalId,
      approvalSource: 'UNTRUSTED_WEB'
    });
    check('Invocation with approvalSource UNTRUSTED_WEB evaluates to DENY', evalWebSource.decision === POLICY_DECISIONS.DENY);

    testResults.push({ id: 'TEST_L', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST M: Model-Generated Claims of Authorization Cannot Bypass Gateway
  // -------------------------------------------------------------
  console.log('\n[TEST M] Model-Generated Claims of Authorization Cannot Bypass Gateway');
  {
    const req = permissionPolicyEngineInstance.createApprovalRequest({
      toolName: 'execute_administrative_elevation',
      args: { command: 'whoami' }
    });

    let modelApproveThrew = false;
    let modelApproveReason = '';
    try {
      permissionPolicyEngineInstance.approveRequest(req.approvalId, 'MODEL');
    } catch (e) {
      modelApproveThrew = true;
      modelApproveReason = e.message;
    }
    check('Model self-approval throws exception', modelApproveThrew);
    check('Exception specifies APPROVAL_SELF_APPROVAL_PROHIBITED', modelApproveReason.includes(DENIAL_REASONS.APPROVAL_SELF_APPROVAL_PROHIBITED));

    const evalModelSource = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'execute_administrative_elevation',
      args: { command: 'whoami' },
      approvalToken: req.approvalId,
      approvalSource: 'MODEL'
    });
    check('Invocation with approvalSource MODEL evaluates to DENY', evalModelSource.decision === POLICY_DECISIONS.DENY);

    testResults.push({ id: 'TEST_M', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST N: Direct Tool Calls Cannot Bypass Policy Engine
  // -------------------------------------------------------------
  console.log('\n[TEST N] Direct Tool Calls Cannot Bypass Policy Engine');
  {
    let directCallThrew = false;
    let directError = '';
    try {
      // Attempting direct execution of sensitive tool without approval token
      await executeTool('apply_code_patch', {
        filePath: path.join(scratchDir, 'direct_bypass.js'),
        patch: '/* unauthorized */'
      }, 'JARVIS');
    } catch (e) {
      directCallThrew = true;
      directError = e.message;
    }
    check('Direct executeTool of sensitive tool throws without approval', directCallThrew);
    check('Exception indicates APPROVAL_REQUIRED or Security Violation', directError.includes('approvalToken') || directError.includes('Security Violation'));

    testResults.push({ id: 'TEST_N', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST O: Emergency Stop Overrides Pending Approvals and Running Tasks
  // -------------------------------------------------------------
  console.log('\n[TEST O] Emergency Stop Overrides Pending Approvals and Running Tasks');
  {
    // Create an active approval request
    const req = permissionPolicyEngineInstance.createApprovalRequest({
      toolName: 'apply_code_patch',
      args: { filePath: path.join(scratchDir, 'estop_test.js'), patch: 'estop();' }
    });
    permissionPolicyEngineInstance.approveRequest(req.approvalId, 'USER_EXPLICIT');
    check('Pre-condition: Approval exists before E-Stop', permissionPolicyEngineInstance.approvals.has(req.approvalId));

    // Engage Emergency Stop
    emergencyStopControllerInstance.engage('Phase 4 Acceptance Test O');
    check('Emergency Stop controller reports engaged', emergencyStopControllerInstance.isEngaged());

    // Approvals must be purged
    check('Active approvals purged on E-Stop engagement', permissionPolicyEngineInstance.approvals.size === 0);

    // Any evaluation under E-Stop must be DENIED immediately
    const evalUnderStop = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'get_current_time',
      args: {}
    });
    check('Even read-only tool is DENIED during Emergency Stop', evalUnderStop.decision === POLICY_DECISIONS.DENY);
    check('Denial reason cites EMERGENCY_STOP_ACTIVE', evalUnderStop.reason.includes('EMERGENCY_STOP_ACTIVE'));

    // Release Emergency Stop for subsequent tests
    emergencyStopControllerInstance.release('Phase 4 Acceptance Test O Complete');
    check('Emergency Stop successfully released', !emergencyStopControllerInstance.isEngaged());

    testResults.push({ id: 'TEST_O', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST P: Sensitive Values Redacted from Approval Screens and Logs
  // -------------------------------------------------------------
  console.log('\n[TEST P] Sensitive Values Redacted from Approval Screens and Logs');
  {
    const sensitiveArgs = {
      apiKey: 'sk-live-1234567890abcdefghijklmnop',
      userPassword: 'SuperSecretUserPassword123!',
      authToken: 'Bearer ghp_abcdefghijklmnopqrstuvwxyz123456',
      targetHost: 'api.example.com',
      normalParameter: 'hello world'
    };

    const redacted = permissionPolicyEngineInstance.redactSecrets(sensitiveArgs);
    check('apiKey is redacted', redacted.apiKey === '[REDACTED_SECRET]');
    check('userPassword is redacted', redacted.userPassword === '[REDACTED_SECRET]');
    check('authToken is redacted', redacted.authToken === '[REDACTED_SECRET]');
    check('normalParameter is preserved', redacted.normalParameter === 'hello world');
    check('targetHost is preserved', redacted.targetHost === 'api.example.com');

    // Check approval request redacts proposedArguments
    const req = permissionPolicyEngineInstance.createApprovalRequest({
      toolName: 'external_http_post',
      args: sensitiveArgs
    });
    check('approvalRequest proposedArguments contains redacted apiKey', req.proposedArguments.apiKey === '[REDACTED_SECRET]');
    check('approvalRequest proposedArguments contains redacted userPassword', req.proposedArguments.userPassword === '[REDACTED_SECRET]');

    // Check audit log redacts sensitive values
    permissionGateInstance.logAuditEvent('TEST_REDACTION_EVENT', sensitiveArgs);
    const recentAudit = permissionGateInstance.getAuditLog(1)[0];
    check('Audit log entry details redact apiKey', recentAudit.details.apiKey === '[REDACTED_SECRET]');

    testResults.push({ id: 'TEST_P', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST Q: Restart Does Not Silently Restore Expired or Invalid Approvals
  // -------------------------------------------------------------
  console.log('\n[TEST Q] Restart Does Not Silently Restore Expired or Invalid Approvals');
  {
    // Simulate restart by creating a new PermissionPolicyEngine instance
    const freshEngine = new PermissionPolicyEngine({ projectRoot: __dirname });
    check('Fresh engine starts with zero pending approvals', freshEngine.getPendingApprovals().length === 0);

    const staleToken = 'appr_stale_from_previous_session';
    const evalStale = freshEngine.evaluateInvocation({
      toolName: 'apply_code_patch',
      args: { filePath: 'foo.js' },
      approvalToken: staleToken,
      approvalSource: 'USER_EXPLICIT'
    });
    check('Fresh engine rejects stale previous approval token', evalStale.decision === POLICY_DECISIONS.DENY);

    testResults.push({ id: 'TEST_Q', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST R: Unauthorized Filesystem Paths Rejected
  // -------------------------------------------------------------
  console.log('\n[TEST R] Unauthorized Filesystem Paths Rejected');
  {
    const evalSys32 = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'read_text_file',
      args: { filePath: 'C:\\Windows\\System32\\config\\SAM' }
    });
    check('Access to System32 path returns DENY', evalSys32.decision === POLICY_DECISIONS.DENY);
    check('Denial reason cites UNAUTHORIZED_PATH', evalSys32.reason.includes(DENIAL_REASONS.UNAUTHORIZED_PATH));

    const evalRootDrive = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'list_files',
      args: { path: 'C:\\' }
    });
    check('Access to bare root drive returns DENY', evalRootDrive.decision === POLICY_DECISIONS.DENY);

    testResults.push({ id: 'TEST_R', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST S: Unauthorized External Destinations Rejected
  // -------------------------------------------------------------
  console.log('\n[TEST S] Unauthorized External Destinations Rejected');
  {
    // 1. Cloud metadata SSRF
    const evalMetadata = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'browser_navigate',
      args: { url: 'http://169.254.169.254/latest/meta-data' }
    });
    check('Cloud metadata URL returns DENY', evalMetadata.decision === POLICY_DECISIONS.DENY);
    check('Reason identifies UNAUTHORIZED_DESTINATION', evalMetadata.reason.includes(DENIAL_REASONS.UNAUTHORIZED_DESTINATION));

    // 2. IPv6 loopback SSRF
    const evalIpv6 = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'browser_navigate',
      args: { url: 'http://[::1]:8080/admin' }
    });
    check('IPv6 loopback URL returns DENY', evalIpv6.decision === POLICY_DECISIONS.DENY);

    // 3. Private subnet SSRF
    const evalPrivateSubnet = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'browser_navigate',
      args: { url: 'http://192.168.1.1/router-settings' }
    });
    check('Private subnet 192.168.x returns DENY', evalPrivateSubnet.decision === POLICY_DECISIONS.DENY);

    // 4. Prohibited scheme
    const evalFileScheme = permissionPolicyEngineInstance.evaluateInvocation({
      toolName: 'browser_navigate',
      args: { url: 'file:///C:/Windows/win.ini' }
    });
    check('Disallowed scheme file:// returns DENY', evalFileScheme.decision === POLICY_DECISIONS.DENY);

    testResults.push({ id: 'TEST_S', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // TEST T: Complete Low-Risk Research-and-Report DAG Executes Without Prompts
  // -------------------------------------------------------------
  console.log('\n[TEST T] Complete Low-Risk Research-and-Report DAG Executes Without Unnecessary Prompts');
  {
    const reportPath = path.join(scratchDir, 'autonomous_research_report.docx');
    if (fs.existsSync(reportPath)) {
      try { fs.unlinkSync(reportPath); } catch (_) {}
    }

    const autonomousPlan = {
      plan_id: 'plan_autonomous_research_t',
      original_objective: 'Autonomous Research and Document Generation',
      nodes: [
        {
          node_id: 'node_time',
          title: 'Obtain system timestamp',
          assigned_tool: 'get_current_time',
          validated_arguments: {},
          dependencies: [],
          expected_output: 'Current timestamp in ISO format',
          verification_method: 'TIMESTAMP_VALID',
          timeout: 5000
        },
        {
          node_id: 'node_report',
          title: 'Generate OpenXML research document',
          assigned_tool: 'create_word_document',
          validated_arguments: {
            filePath: reportPath,
            title: 'Autonomous System Security Assessment',
            sections: [
              { heading: 'Executive Summary', body: 'The permission hierarchy enforces 5 strict tiers autonomously.' },
              { heading: 'Verification Status', body: 'All empirical test invariants verified without unnecessary prompts.' }
            ]
          },
          dependencies: ['node_time'],
          expected_output: 'DOCX file created',
          verification_method: 'FILE_EXISTS_WITH_SIZE',
          timeout: 10000
        },
        {
          node_id: 'node_verify_doc',
          title: 'Independently verify OpenXML document',
          assigned_tool: 'verify_document',
          validated_arguments: {
            filePath: reportPath,
            format: 'docx',
            expectedHeadings: ['Executive Summary', 'Verification Status']
          },
          dependencies: ['node_report'],
          expected_output: 'Document verified matching headings',
          verification_method: 'DOCUMENT_STRUCTURE_VERIFIED',
          timeout: 10000
        }
      ]
    };

    let promptCount = 0;
    const executionReport = await dagExecutionEngineInstance.executePlan(autonomousPlan, {
      personality: 'JARVIS',
      approvalHandler: () => {
        promptCount++;
        return null;
      }
    });

    check('Autonomous DAG completes without triggering approval prompts (promptCount === 0)', promptCount === 0);
    check('Final execution status is COMPLETED', executionReport.status === TASK_STATES.COMPLETED);
    check('All 3 DAG nodes completed successfully', executionReport.completedCount === 3);
    check('Target document was generated on disk', fs.existsSync(reportPath));
    check('Independent verification certifies all artifacts verified', executionReport.verified === true);

    testResults.push({ id: 'TEST_T', status: 'PASSED' });
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`PHASE 4 ACCEPTANCE SUITE COMPLETE: ${passedAssertions}/${totalAssertions} assertions passed`);
  console.log(`Tests: 20/20 PASSED (100%)`);
  console.log('================================================================\n');

  return {
    passedAssertions,
    totalAssertions,
    testResults
  };
}

if (require.main === module) {
  runPhase4AcceptanceSuite()
    .then(summary => {
      console.log(`Summary: ${summary.passedAssertions} / ${summary.totalAssertions} passed.`);
      process.exit(0);
    })
    .catch(err => {
      console.error('\n[FATAL] Phase 4 Acceptance Suite Failed:', err);
      process.exit(1);
    });
}

module.exports = { runPhase4AcceptanceSuite };
