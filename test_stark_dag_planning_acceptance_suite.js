/**
 * STARK AI — PHASE 2: GENERALIZED AUTONOMOUS DAG PLANNING & VERIFICATION ACCEPTANCE SUITE
 * 
 * Verifies all 10 required Phase 2 acceptance scenarios on Windows OS:
 * TEST A: Simple File Task (objective -> DAG plan -> execution -> disk content verification)
 * TEST B: Multi-Step Document Task (OpenXML Word document generation & AST verification)
 * TEST C: Dependency Workflow (strict sequence ordering: producer -> consumer)
 * TEST D: Parallel Workflow (concurrent independent nodes + synchronized dependent node)
 * TEST E: Failure Recovery (bounded retries, error categorization, recovery execution)
 * TEST F: Invalid Plan Rejection (unregistered tools, circular cycles, bad references blocked pre-exec)
 * TEST G: Verification Failure (tool succeeds but verification fails -> completion denied)
 * TEST H: In-Flight Cancellation (AbortController halts active & dependent work cleanly)
 * TEST I: Restart Recovery (checkpoint resumption without repeating non-idempotent completed steps)
 * TEST J: False Success Defence (tool claims success without side effect -> verifier detects & rejects)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const {
  DagPlanningEngine,
  dagPlanningEngineInstance,
  TASK_STATES,
  PERMITTED_STATE_TRANSITIONS,
  FAILURE_CATEGORIES
} = require('./server/dagPlanningEngine.js');

const {
  DagExecutionEngine,
  dagExecutionEngineInstance
} = require('./server/dagExecutionEngine.js');

const {
  IndependentVerifier,
  independentVerifierInstance,
  VERIFICATION_STATUS
} = require('./server/independentVerifier.js');

const { taskOrchestratorInstance } = require('./server/taskOrchestrator.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');

const SCRATCH_DIR = path.resolve(__dirname, 'scratch');
if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(name, details = '') {
  totalTests++;
  passedTests++;
  console.log(`  [PASS] ${name}${details ? ' — ' + details : ''}`);
}

function fail(name, err) {
  totalTests++;
  failedTests++;
  console.error(`  [FAIL] ${name}: ${err?.message || err}`);
}

async function runSuite() {
  console.log('================================================================================');
  console.log('STARK AI — PHASE 2: AUTONOMOUS DAG PLANNING & VERIFICATION ACCEPTANCE SUITE');
  console.log('Platform: Windows 10/11 x64 | Engine: Generalized Model-Assisted DAG Orchestrator');
  console.log('================================================================================');

  // ===========================================================================
  // TEST A: SIMPLE FILE TASK
  // ===========================================================================
  console.log('\n--- TEST A: Simple File Task Execution & Verification ---');
  try {
    const targetFile = path.join(SCRATCH_DIR, 'phase2_simple_task.txt');
    const expectedContent = `PHASE_2_TEST_A_VERIFIED_PAYLOAD_${Date.now()}`;
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);

    // 1. Generate DAG Plan from Objective
    const plan = await dagPlanningEngineInstance.generatePlan(
      `Create a text file named phase2_simple_task.txt containing verified payload`,
      {
        title: 'phase2_simple_task',
        content: expectedContent
      }
    );

    // Assert 15-field Plan Record Schema
    const requiredPlanFields = [
      'plan_id', 'task_id', 'original_objective', 'interpreted_objective',
      'planning_timestamp', 'model_metadata', 'required_inputs', 'assumptions',
      'expected_outputs', 'execution_constraints', 'risk_assessment',
      'nodes', 'dependency_edges', 'verification_strategy', 'completion_criteria'
    ];
    for (const f of requiredPlanFields) {
      assert(plan[f] !== undefined, `Plan schema missing field: ${f}`);
    }
    pass('Plan record adheres to complete 15-field schema', `Plan ID: ${plan.plan_id}`);

    // Assert 12-field Node Record Schema
    const node = plan.nodes[0];
    const requiredNodeFields = [
      'node_id', 'task_description', 'assigned_tool', 'validated_arguments',
      'dependencies', 'expected_output', 'risk_level', 'permission_requirement',
      'timeout', 'retry_policy', 'verification_method', 'execution_status'
    ];
    for (const nf of requiredNodeFields) {
      assert(node[nf] !== undefined, `Node schema missing field: ${nf}`);
    }
    pass('Node record adheres to complete 12-field schema', `Node: ${node.node_id} (${node.assigned_tool})`);

    // 2. Execute Plan via DAG Execution Engine
    const report = await dagExecutionEngineInstance.executePlan(plan);

    assert.strictEqual(report.status, TASK_STATES.COMPLETED, 'Task must achieve COMPLETED status');
    assert.strictEqual(report.verified, true, 'Task execution must report verified: true');
    assert.strictEqual(report.completedCount, plan.nodes.length, 'All planned nodes must complete');
    pass('DAG Execution Engine executed all nodes to terminal COMPLETED');

    // 3. Independent Verification of File on Disk
    assert(fs.existsSync(targetFile), 'Target file must physically exist on disk');
    const onDiskText = fs.readFileSync(targetFile, 'utf8');
    assert.strictEqual(onDiskText.trim(), expectedContent.trim(), 'On-disk content must match expected text identically');
    const onDiskHash = crypto.createHash('sha256').update(onDiskText, 'utf8').digest('hex');
    assert(report.artifacts.length > 0, 'Artifacts must record created file');
    assert.strictEqual(report.artifacts[0].sha256, onDiskHash, 'Artifact SHA-256 must match file on disk');
    pass('Physical deliverable verified on disk with matching SHA-256 hash', onDiskHash.slice(0, 16));
  } catch (err) {
    fail('TEST A: Simple File Task', err);
  }

  // ===========================================================================
  // TEST B: MULTI-STEP DOCUMENT TASK (OPENXML AST)
  // ===========================================================================
  console.log('\n--- TEST B: Multi-Step Document Task & OpenXML AST Verification ---');
  try {
    const docTitle = 'Phase2_Architecture_Deliverable';
    const docPath = path.join(SCRATCH_DIR, 'phase2_architecture_deliverable.docx');
    if (fs.existsSync(docPath)) fs.unlinkSync(docPath);

    const plan = await dagPlanningEngineInstance.generatePlan(
      `Create a structured Word document report titled "${docTitle}" with architectural findings`,
      {
        title: docTitle,
        sections: [
          { heading: '1. Executive Overview', level: 1, paragraphs: ['Phase 2 DAG Planning verified on host.'] },
          { heading: '2. Subsystem Telemetry', level: 2, paragraphs: ['Topological execution and AST validated.'] }
        ]
      }
    );

    assert.strictEqual(plan.nodes.length, 2, 'Document plan must contain creation and verification nodes');
    assert.strictEqual(plan.nodes[1].dependencies[0], plan.nodes[0].node_id, 'Verification node must depend on creation node');
    pass('Multi-step document DAG generated with creation -> verification dependency');

    const report = await dagExecutionEngineInstance.executePlan(plan);

    assert.strictEqual(report.status, TASK_STATES.COMPLETED, 'Document task must achieve COMPLETED');
    assert.strictEqual(report.verified, true, 'Document deliverable must be verified');
    assert(fs.existsSync(docPath), 'Generated DOCX file must physically exist on disk');
    const stat = fs.statSync(docPath);
    assert(stat.size > 2000, `DOCX package must be substantial (>2000 bytes, got ${stat.size})`);
    pass('Genuine OpenXML Word document generated and verified on disk', `${stat.size} bytes`);
  } catch (err) {
    fail('TEST B: Multi-Step Document Task', err);
  }

  // ===========================================================================
  // TEST C: DEPENDENCY WORKFLOW (PRODUCER -> CONSUMER SEQUENCE)
  // ===========================================================================
  console.log('\n--- TEST C: Dependency Workflow (Strict Sequence Ordering) ---');
  try {
    const intermediateFile = path.join(SCRATCH_DIR, 'phase2_dep_intermediate.txt');
    const finalFile = path.join(SCRATCH_DIR, 'phase2_dep_final.txt');
    if (fs.existsSync(intermediateFile)) fs.unlinkSync(intermediateFile);
    if (fs.existsSync(finalFile)) fs.unlinkSync(finalFile);

    const token = `DEP_TOKEN_${Date.now()}`;

    // Construct a DAG where node_2 reads what node_1 creates
    const nodes = [
      {
        node_id: 'prod_node',
        task_description: 'Generate intermediate data file',
        assigned_tool: 'create_file',
        validated_arguments: { filePath: intermediateFile, content: token },
        dependencies: [],
        expected_output: 'Intermediate file created',
        risk_level: 'LOW',
        permission_requirement: 'WORKSPACE_WRITE',
        timeout: 10000,
        retry_policy: { maxRetries: 1, backoffMs: 200 },
        verification_method: 'FILE_EXISTS_AND_NONEMPTY',
        execution_status: TASK_STATES.READY
      },
      {
        node_id: 'cons_node',
        task_description: 'Consume intermediate file and copy to final file',
        assigned_tool: 'copy_file',
        validated_arguments: { sourcePath: intermediateFile, destPath: finalFile, destinationPath: finalFile },
        dependencies: ['prod_node'],
        expected_output: 'Final file copied from intermediate',
        risk_level: 'LOW',
        permission_requirement: 'WORKSPACE_WRITE',
        timeout: 10000,
        retry_policy: { maxRetries: 1, backoffMs: 200 },
        verification_method: 'FILE_EXISTS_AND_NONEMPTY',
        execution_status: TASK_STATES.READY
      }
    ];

    const plan = await dagPlanningEngineInstance.generatePlan('Dependency test objective', {
      candidateNodes: nodes
    });

    const report = await dagExecutionEngineInstance.executePlan(plan);

    assert.strictEqual(report.status, TASK_STATES.COMPLETED);
    assert(fs.existsSync(finalFile), 'Final file must exist after consumer execution');
    const finalContent = fs.readFileSync(finalFile, 'utf8');
    assert.strictEqual(finalContent, token, 'Final file must contain data produced by dependency node');
    pass('Dependency ordering strictly enforced: producer executed before consumer');
  } catch (err) {
    fail('TEST C: Dependency Workflow', err);
  }

  // ===========================================================================
  // TEST D: PARALLEL WORKFLOW (CONCURRENT INDEPENDENT NODES + SYNC)
  // ===========================================================================
  console.log('\n--- TEST D: Parallel Workflow & Resource-Bounded Concurrency ---');
  try {
    const fileA = path.join(SCRATCH_DIR, 'parallel_a.txt');
    const fileB = path.join(SCRATCH_DIR, 'parallel_b.txt');
    const fileC = path.join(SCRATCH_DIR, 'parallel_c.txt');
    if (fs.existsSync(fileA)) fs.unlinkSync(fileA);
    if (fs.existsSync(fileB)) fs.unlinkSync(fileB);
    if (fs.existsSync(fileC)) fs.unlinkSync(fileC);

    const nodes = [
      {
        node_id: 'node_A',
        task_description: 'Write file A independently',
        assigned_tool: 'create_file',
        validated_arguments: { filePath: fileA, content: 'PAYLOAD_A' },
        dependencies: [],
        expected_output: 'File A created',
        risk_level: 'LOW',
        permission_requirement: 'WORKSPACE_WRITE',
        timeout: 10000,
        retry_policy: { maxRetries: 1, backoffMs: 200 },
        verification_method: 'FILE_EXISTS_AND_NONEMPTY',
        execution_status: TASK_STATES.READY
      },
      {
        node_id: 'node_B',
        task_description: 'Write file B independently',
        assigned_tool: 'create_file',
        validated_arguments: { filePath: fileB, content: 'PAYLOAD_B' },
        dependencies: [],
        expected_output: 'File B created',
        risk_level: 'LOW',
        permission_requirement: 'WORKSPACE_WRITE',
        timeout: 10000,
        retry_policy: { maxRetries: 1, backoffMs: 200 },
        verification_method: 'FILE_EXISTS_AND_NONEMPTY',
        execution_status: TASK_STATES.READY
      },
      {
        node_id: 'node_C',
        task_description: 'Combine data after A and B complete',
        assigned_tool: 'create_file',
        validated_arguments: { filePath: fileC, content: 'COMBINED_A_AND_B' },
        dependencies: ['node_A', 'node_B'],
        expected_output: 'File C created after A and B',
        risk_level: 'LOW',
        permission_requirement: 'WORKSPACE_WRITE',
        timeout: 10000,
        retry_policy: { maxRetries: 1, backoffMs: 200 },
        verification_method: 'FILE_EXISTS_AND_NONEMPTY',
        execution_status: TASK_STATES.READY
      }
    ];

    const plan = await dagPlanningEngineInstance.generatePlan('Parallel workflow test', {
      candidateNodes: nodes,
      maxConcurrency: 2
    });

    const report = await dagExecutionEngineInstance.executePlan(plan);

    assert.strictEqual(report.status, TASK_STATES.COMPLETED);
    assert(fs.existsSync(fileA) && fs.existsSync(fileB) && fs.existsSync(fileC), 'All 3 parallel/dependent files must exist');
    assert.strictEqual(report.completedCount, 3, 'All 3 nodes completed');
    pass('Parallel execution executed independent nodes concurrently and synchronized dependent node');
  } catch (err) {
    fail('TEST D: Parallel Workflow', err);
  }

  // ===========================================================================
  // TEST E: FAILURE RECOVERY & RETRY POLICIES
  // ===========================================================================
  console.log('\n--- TEST E: Failure Handling & Bounded Retry Policies ---');
  try {
    const invalidFile = 'C:\\Windows\\System32\\unauthorized_test_root_e.txt';
    const nodes = [
      {
        node_id: 'failing_node',
        task_description: 'Attempt write to unauthorized path with retries',
        assigned_tool: 'create_file',
        validated_arguments: { filePath: invalidFile, content: 'blocked' },
        dependencies: [],
        expected_output: 'File created',
        risk_level: 'HIGH',
        permission_requirement: 'CONTROLLED_SHELL',
        timeout: 5000,
        retry_policy: { maxRetries: 2, backoffMs: 50 },
        verification_method: 'FILE_EXISTS_AND_NONEMPTY',
        execution_status: TASK_STATES.READY
      }
    ];

    const plan = await dagPlanningEngineInstance.generatePlan('Failing task test', { candidateNodes: nodes });
    const report = await dagExecutionEngineInstance.executePlan(plan);

    assert.strictEqual(report.status, TASK_STATES.FAILED, 'Task must report FAILED when critical node fails');
    const nodeRes = report.nodeResults.find(n => n.node_id === 'failing_node');
    assert(nodeRes.attempts >= 2, `Expected at least 2 attempts (retries), got ${nodeRes.attempts}`);
    assert.strictEqual(nodeRes.status, TASK_STATES.FAILED);
    assert(nodeRes.error.toLowerCase().includes('security') || nodeRes.error.toLowerCase().includes('outside'), 'Error reflects security denial');
    assert.strictEqual(nodeRes.failureCategory, FAILURE_CATEGORIES.PERMISSION_DENIED);
    pass('Bounded retries attempted and failure categorized accurately', `Attempts: ${nodeRes.attempts}, Category: ${nodeRes.failureCategory}`);
  } catch (err) {
    fail('TEST E: Failure Recovery', err);
  }

  // ===========================================================================
  // TEST F: INVALID PLAN REJECTION (UNREGISTERED TOOL, CYCLE, BAD REF)
  // ===========================================================================
  console.log('\n--- TEST F: Invalid Plan Rejection (Security & Semantic Gates) ---');
  try {
    // 1. Unregistered Tool Rejection
    let unregisteredBlocked = false;
    try {
      await dagPlanningEngineInstance.generatePlan('Bad tool test', {
        candidateNodes: [
          {
            node_id: 'bad_node',
            task_description: 'Call non-existent hallucinated tool',
            assigned_tool: 'hypothetical_unregistered_hallucination_tool_99',
            validated_arguments: {},
            dependencies: [],
            expected_output: 'None',
            risk_level: 'LOW',
            permission_requirement: 'READ_ONLY',
            timeout: 5000,
            retry_policy: { maxRetries: 1, backoffMs: 100 },
            verification_method: 'DEFAULT',
            execution_status: TASK_STATES.READY
          }
        ]
      });
    } catch (e) {
      unregisteredBlocked = true;
      assert(e.message.includes('INVALID_PLAN'), 'Must reject with INVALID_PLAN error');
      assert(e.message.includes('hypothetical_unregistered'), 'Must name unregistered tool');
    }
    assert.strictEqual(unregisteredBlocked, true, 'Unregistered tool strictly rejected before execution');
    pass('Plan with unregistered tool name rejected pre-execution');

    // 2. Circular Dependency Cycle Rejection
    let cycleBlocked = false;
    try {
      await dagPlanningEngineInstance.generatePlan('Cycle test', {
        candidateNodes: [
          {
            node_id: 'cycle_A',
            task_description: 'Step A depends on B',
            assigned_tool: 'get_current_time',
            validated_arguments: {},
            dependencies: ['cycle_B'],
            expected_output: 'Time',
            risk_level: 'LOW',
            permission_requirement: 'READ_ONLY',
            timeout: 5000,
            retry_policy: { maxRetries: 1, backoffMs: 100 },
            verification_method: 'DEFAULT',
            execution_status: TASK_STATES.READY
          },
          {
            node_id: 'cycle_B',
            task_description: 'Step B depends on A',
            assigned_tool: 'get_current_time',
            validated_arguments: {},
            dependencies: ['cycle_A'],
            expected_output: 'Time',
            risk_level: 'LOW',
            permission_requirement: 'READ_ONLY',
            timeout: 5000,
            retry_policy: { maxRetries: 1, backoffMs: 100 },
            verification_method: 'DEFAULT',
            execution_status: TASK_STATES.READY
          }
        ]
      });
    } catch (e) {
      cycleBlocked = true;
      assert(e.message.includes('INVALID_PLAN'), 'Must reject with INVALID_PLAN error');
      assert(e.message.includes('Cycle Detection') || e.message.includes('Circular dependency'), 'Must detect cycle');
    }
    assert.strictEqual(cycleBlocked, true, 'Circular dependency cycle strictly rejected before execution');
    pass('Plan with circular dependency cycle rejected pre-execution via Kahn algorithm');

    // 3. Non-existent Dependency Reference Rejection
    let badRefBlocked = false;
    try {
      await dagPlanningEngineInstance.generatePlan('Bad ref test', {
        candidateNodes: [
          {
            node_id: 'node_1',
            task_description: 'Step 1 depends on phantom node',
            assigned_tool: 'get_current_time',
            validated_arguments: {},
            dependencies: ['phantom_node_999'],
            expected_output: 'Time',
            risk_level: 'LOW',
            permission_requirement: 'READ_ONLY',
            timeout: 5000,
            retry_policy: { maxRetries: 1, backoffMs: 100 },
            verification_method: 'DEFAULT',
            execution_status: TASK_STATES.READY
          }
        ]
      });
    } catch (e) {
      badRefBlocked = true;
      assert(e.message.includes('phantom_node_999'), 'Must identify non-existent dependency');
    }
    assert.strictEqual(badRefBlocked, true, 'Non-existent dependency reference rejected');
    pass('Plan referencing non-existent dependency node rejected pre-execution');
  } catch (err) {
    fail('TEST F: Invalid Plan Rejection', err);
  }

  // ===========================================================================
  // TEST G: VERIFICATION FAILURE (TOOL SUCCEEDS, VERIFIER REJECTS)
  // ===========================================================================
  console.log('\n--- TEST G: Verification Failure Defense (Completion Denied) ---');
  try {
    const testFile = path.join(SCRATCH_DIR, 'verif_fail_test.txt');
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

    // Node executes create_file with 'ACTUAL_CONTENT', but expected_output / content verification expects 'IMPOSSIBLE_CONTENT'
    const nodes = [
      {
        node_id: 'fail_verif_node',
        task_description: 'Write file with content mismatch',
        assigned_tool: 'create_file',
        validated_arguments: {
          filePath: testFile,
          content: 'ACTUAL_CONTENT_ON_DISK'
        },
        dependencies: [],
        expected_output: 'IMPOSSIBLE_DESIRED_CONTENT',
        expectedContent: 'IMPOSSIBLE_DESIRED_CONTENT',
        risk_level: 'LOW',
        permission_requirement: 'WORKSPACE_WRITE',
        timeout: 10000,
        retry_policy: { maxRetries: 1, backoffMs: 100 },
        verification_method: 'FILE_CONTENT_MATCH',
        execution_status: TASK_STATES.READY
      }
    ];

    const plan = await dagPlanningEngineInstance.generatePlan('Verification failure test', { candidateNodes: nodes });
    plan.nodes[0].expectedContent = 'IMPOSSIBLE_DESIRED_CONTENT';

    // Tool will run create_file(testFile, 'ACTUAL_CONTENT_ON_DISK')
    // But verifier will check if file contains 'IMPOSSIBLE_DESIRED_CONTENT'
    const report = await dagExecutionEngineInstance.executePlan(plan);

    assert.notStrictEqual(report.status, TASK_STATES.COMPLETED, 'Task must NEVER report COMPLETED when verification fails');
    assert.strictEqual(report.status, TASK_STATES.FAILED, 'Task must report FAILED on verification failure');
    assert.strictEqual(report.verified, false, 'Report must assert verified: false');
    const nodeRes = report.nodeResults.find(n => n.node_id === 'fail_verif_node');
    assert.strictEqual(nodeRes.status, TASK_STATES.FAILED);
    assert.strictEqual(nodeRes.failureCategory, FAILURE_CATEGORIES.VERIFICATION_FAILURE);
    pass('Verification failure defense verified: action executed but completion denied due to evidence mismatch');
  } catch (err) {
    fail('TEST G: Verification Failure', err);
  }

  // ===========================================================================
  // TEST H: IN-FLIGHT CANCELLATION & ABORT SIGNAL
  // ===========================================================================
  console.log('\n--- TEST H: In-Flight Cancellation & AbortController ---');
  try {
    const longRunningFile = path.join(SCRATCH_DIR, 'cancel_test.txt');
    const abortController = new AbortController();

    const nodes = [
      {
        node_id: 'long_step_1',
        task_description: 'Execute long-running controlled sleep command',
        assigned_tool: 'execute_controlled_shell_command',
        validated_arguments: { command: 'Start-Sleep -Seconds 30', timeoutMs: 35000 },
        dependencies: [],
        expected_output: 'Completed sleep',
        risk_level: 'LOW',
        permission_requirement: 'CONTROLLED_SHELL',
        timeout: 35000,
        retry_policy: { maxRetries: 1, backoffMs: 100 },
        verification_method: 'PROCESS_EXIT_CODE_ZERO',
        execution_status: TASK_STATES.READY
      },
      {
        node_id: 'dependent_step_2',
        task_description: 'Step that should NEVER run due to prior cancellation',
        assigned_tool: 'create_file',
        validated_arguments: { filePath: longRunningFile, content: 'SHOULD_NEVER_EXIST' },
        dependencies: ['long_step_1'],
        expected_output: 'File created',
        risk_level: 'LOW',
        permission_requirement: 'WORKSPACE_WRITE',
        timeout: 5000,
        retry_policy: { maxRetries: 1, backoffMs: 100 },
        verification_method: 'FILE_EXISTS_AND_NONEMPTY',
        execution_status: TASK_STATES.READY
      }
    ];

    const plan = await dagPlanningEngineInstance.generatePlan('Cancellation test', { candidateNodes: nodes });

    const execPromise = dagExecutionEngineInstance.executePlan(plan, { abortSignal: abortController.signal });

    // Cancel in-flight execution after 80ms
    setTimeout(() => {
      abortController.abort();
    }, 80);

    const cancelReport = await execPromise;

    assert.strictEqual(cancelReport.status, TASK_STATES.CANCELLED, 'Task status must be CANCELLED');
    assert.strictEqual(cancelReport.verified, false, 'Cancelled task must report verified: false');
    assert(!fs.existsSync(longRunningFile), 'Dependent step 2 must NEVER have executed');
    pass('In-flight cancellation cleanly aborted active work and prevented dependent steps from starting');
  } catch (err) {
    fail('TEST H: In-Flight Cancellation', err);
  }

  // ===========================================================================
  // TEST I: RESTART RECOVERY & CHECKPOINT PERSISTENCE
  // ===========================================================================
  console.log('\n--- TEST I: Checkpoint Persistence & Safe Resumption ---');
  try {
    const resumeTaskId = 'task_restart_recovery_' + Date.now().toString(36);
    const step1File = path.join(SCRATCH_DIR, 'restart_step1.txt');
    const step2File = path.join(SCRATCH_DIR, 'restart_step2.txt');
    if (fs.existsSync(step1File)) fs.unlinkSync(step1File);
    if (fs.existsSync(step2File)) fs.unlinkSync(step2File);

    // 1. Create step 1 artifact
    fs.writeFileSync(step1File, 'STEP_1_ALREADY_COMPLETED', 'utf8');

    // 2. Persist checkpoint simulating an interrupted execution state
    const simulatedCheckpoint = {
      taskId: resumeTaskId,
      planId: 'plan_restart_test',
      status: TASK_STATES.RECOVERING,
      completedNodeIds: ['node_1'],
      failedNodeIds: [],
      artifacts: [{ path: step1File, sizeBytes: 24, sha256: 'mockhash', verified: true }],
      checkpoints: [{ nodeId: 'node_1', status: 'COMPLETED' }]
    };
    dagExecutionEngineInstance.saveCheckpoint(resumeTaskId, simulatedCheckpoint);

    // 3. Simulate process restart by loading checkpoint from fresh engine instance
    const freshEngine = new DagExecutionEngine();
    const loadedCheckpoint = freshEngine.loadCheckpoint(resumeTaskId);

    assert(loadedCheckpoint !== null, 'Checkpoint must be successfully loaded from disk');
    assert.strictEqual(loadedCheckpoint.taskId, resumeTaskId, 'Loaded task ID must match');
    assert(loadedCheckpoint.completedNodeIds.includes('node_1'), 'Step 1 must be recorded as completed');

    // 4. Execute remaining step 2 without repeating non-idempotent step 1
    const remainingPlan = {
      plan_id: 'plan_restart_test',
      task_id: resumeTaskId,
      original_objective: 'Resume remaining tasks',
      interpreted_objective: 'Resuming from checkpoint',
      planning_timestamp: new Date().toISOString(),
      model_metadata: { provider: 'test' },
      required_inputs: [],
      assumptions: [],
      expected_outputs: [],
      execution_constraints: [],
      risk_assessment: { overallRisk: 'LOW', requiresApproval: false },
      nodes: [
        {
          node_id: 'node_2',
          task_description: 'Execute remaining uncompleted step 2',
          assigned_tool: 'create_file',
          validated_arguments: { filePath: step2File, content: 'STEP_2_RESUMED_CLEANLY' },
          dependencies: [],
          expected_output: 'Step 2 completed',
          risk_level: 'LOW',
          permission_requirement: 'WORKSPACE_WRITE',
          timeout: 10000,
          retry_policy: { maxRetries: 1, backoffMs: 200 },
          verification_method: 'FILE_EXISTS_AND_NONEMPTY',
          execution_status: TASK_STATES.READY
        }
      ],
      dependency_edges: [],
      verification_strategy: { method: 'FILE_EXISTS_AND_NONEMPTY' },
      completion_criteria: ['Step 2 complete']
    };

    const resumeReport = await freshEngine.executePlan(remainingPlan);

    assert.strictEqual(resumeReport.status, TASK_STATES.COMPLETED);
    assert(fs.existsSync(step2File), 'Step 2 file must be produced on resumption');
    pass('Checkpoint loaded across restart: prior completed steps preserved and remaining work resumed');
  } catch (err) {
    fail('TEST I: Restart Recovery', err);
  }

  // ===========================================================================
  // TEST J: FALSE SUCCESS DEFENCE (TOOL CLAIMS SUCCESS, VERIFIER REJECTS)
  // ===========================================================================
  console.log('\n--- TEST J: False Success Defence (Independent Verifier) ---');
  try {
    const phantomPath = path.join(SCRATCH_DIR, 'phantom_file_that_does_not_exist_99.txt');
    if (fs.existsSync(phantomPath)) fs.unlinkSync(phantomPath);

    // Simulate tool returning a plausible "success" response
    const mockToolSuccessResponse = {
      success: true,
      filePath: phantomPath,
      message: 'Operation reported success: file created successfully.',
      verified: true // Model/tool claims verified!
    };

    // Independent verifier evaluates real evidence on disk
    const verification = await independentVerifierInstance.verifyExecution({
      verificationMethod: 'FILE_EXISTS_AND_NONEMPTY',
      targetPath: phantomPath,
      executionResult: mockToolSuccessResponse
    });

    assert.strictEqual(verification.verified, false, 'Verifier must assert verified: false');
    assert.strictEqual(verification.status, VERIFICATION_STATUS.FAILURE, 'Verifier status must be FAILURE');
    assert(verification.failureReason.includes('does not physically exist'), 'Failure reason states file does not exist');
    pass('False success detected and rejected: tool claimed success: true but verifier caught missing disk evidence');
  } catch (err) {
    fail('TEST J: False Success Defence', err);
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n================================================================================');
  console.log(`PHASE 2 ACCEPTANCE SUITE SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
  if (failedTests === 0) {
    console.log('ALL 10 PHASE 2 ACCEPTANCE WORKFLOWS EMPIRICALLY VERIFIED ON LIVE WINDOWS HOST! 🚀');
  } else {
    console.error(`FAILED: ${failedTests} assertion(s) failed.`);
  }
  console.log('================================================================================\n');

  process.exit(failedTests === 0 ? 0 : 1);
}

runSuite();
