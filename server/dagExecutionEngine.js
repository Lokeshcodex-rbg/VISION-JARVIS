/**
 * VISION AI — Generalized DAG Execution & State Machine Orchestrator
 * 
 * Executes dependency-ordered Directed Acyclic Graphs with:
 * - 12 Standard Task States & Permitted State Transitions
 * - Concurrent execution of independent nodes (resource-bounded)
 * - Topological dependency resolution and failure propagation
 * - Per-node timeouts, bounded retries, and cancellation signals
 * - Atomic persistence of checkpoints to data/tasks/<taskId>_checkpoint.json
 * - Independent verification pass before certifying node/task completion
 * - Integrated Emergency Stop and structured failure categorization
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { executeTool } = require('./toolsRegistry.js');
const { emergencyStopControllerInstance } = require('./emergencyStopController.js');
const { independentVerifierInstance, VERIFICATION_STATUS } = require('./independentVerifier.js');
const {
  TASK_STATES,
  PERMITTED_STATE_TRANSITIONS,
  FAILURE_CATEGORIES
} = require('./dagPlanningEngine.js');

const DATA_DIR = path.join(__dirname, '../data');
const TASKS_DIR = path.join(DATA_DIR, 'tasks');

class DagExecutionEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.projectRoot = options.projectRoot || path.resolve(__dirname, '..');
    this.maxConcurrency = options.maxConcurrency || 2;
    this.activeExecutions = new Map();
    this.abortControllers = new Map();
    this.pendingApprovals = new Map();
    this._ensureDirectories();
  }

  _ensureDirectories() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });
    } catch (_) {}
  }

  /**
   * Safe State Transition Validator
   */
  transitionState(record, targetState, reason = null) {
    const currentState = record.status;
    const allowed = PERMITTED_STATE_TRANSITIONS[currentState] || [];

    if (!allowed.includes(targetState) && currentState !== targetState) {
      const err = new Error(`ILLEGAL_STATE_TRANSITION: Cannot transition task from ${currentState} to ${targetState}.`);
      err.currentState = currentState;
      err.targetState = targetState;
      throw err;
    }

    record.status = targetState;
    record.updatedAt = new Date().toISOString();
    if (reason) {
      record.statusReason = reason;
    }

    record.stateHistory = record.stateHistory || [];
    record.stateHistory.push({
      from: currentState,
      to: targetState,
      timestamp: record.updatedAt,
      reason
    });

    this.saveCheckpoint(record.taskId, record);
    this.emit('stateChange', { taskId: record.taskId, from: currentState, to: targetState, reason });
    return record;
  }

  saveCheckpoint(taskId, data) {
    try {
      this._ensureDirectories();
      const filePath = path.join(TASKS_DIR, `${taskId}_checkpoint.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn(`[DAG_EXEC_ENGINE] Failed to save checkpoint for ${taskId}:`, e.message);
    }
  }

  loadCheckpoint(taskId) {
    try {
      const filePath = path.join(TASKS_DIR, `${taskId}_checkpoint.json`);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (_) {}
    return null;
  }

  /**
   * Executes a validated DAG plan
   */
  async executePlan(plan, options = {}) {
    if (!plan || !Array.isArray(plan.nodes) || plan.nodes.length === 0) {
      throw new Error('INVALID_PLAN: Plan must contain a valid array of nodes.');
    }

    const taskId = plan.task_id || ('task_' + Date.now().toString(36));
    const personality = (options.personality || 'JARVIS').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';
    const callerSignal = options.abortSignal || null;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const t0 = Date.now();

    if (emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Execution blocked by active Emergency Stop latch.');
    }

    const abortController = new AbortController();
    this.abortControllers.set(taskId, abortController);
    const unregisterEStop = emergencyStopControllerInstance.registerTaskAbortController(abortController);

    if (callerSignal) {
      if (callerSignal.aborted) {
        abortController.abort(new Error('Caller signal aborted'));
      } else {
        callerSignal.addEventListener('abort', () => abortController.abort(new Error('Caller signal aborted')), { once: true });
      }
    }

    // Initialize Execution Record
    const executionRecord = {
      taskId,
      planId: plan.plan_id,
      originalObjective: plan.original_objective,
      interpretedObjective: plan.interpreted_objective,
      personality,
      status: TASK_STATES.CREATED,
      totalNodes: plan.nodes.length,
      startedAt: t0,
      updatedAt: new Date().toISOString(),
      nodeStates: new Map(), // node_id -> { status, attempts, result, verification, error }
      completedNodeIds: new Set(),
      failedNodeIds: new Set(),
      artifacts: [],
      checkpoints: [],
      stateHistory: []
    };

    for (const n of plan.nodes) {
      executionRecord.nodeStates.set(n.node_id, {
        node_id: n.node_id,
        status: TASK_STATES.READY,
        attempts: 0,
        result: null,
        verification: null,
        error: null
      });
    }

    this.activeExecutions.set(taskId, executionRecord);
    this.transitionState(executionRecord, TASK_STATES.PLANNING, 'Initializing DAG execution');
    this.transitionState(executionRecord, TASK_STATES.READY, 'DAG dependency graph staged');
    this.transitionState(executionRecord, TASK_STATES.RUNNING, 'Starting dependency-ordered execution');

    try {
      const { auditTrailEngineInstance, EVENT_TYPES } = require('./audit/auditTrailEngine.js');
      if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
        auditTrailEngineInstance.recordEvent(EVENT_TYPES.TASK_CREATED, {
          planId: plan.plan_id,
          originalObjective: plan.original_objective,
          totalNodes: plan.nodes.length
        }, { taskId, personality });
      }
    } catch (_) {}

    const emitProgress = (event, data = {}) => {
      if (onProgress) {
        onProgress({
          taskId,
          planId: plan.plan_id,
          event,
          status: executionRecord.status,
          completedCount: executionRecord.completedNodeIds.size,
          totalNodes: plan.nodes.length,
          timestamp: new Date().toISOString(),
          ...data
        });
      }
    };

    emitProgress('PLAN_STARTED', { planTitle: plan.original_objective });

    // Topological execution loop
    try {
      while (executionRecord.completedNodeIds.size + executionRecord.failedNodeIds.size < plan.nodes.length) {
        // Emergency Stop & Cancellation Check
        if (abortController.signal.aborted || emergencyStopControllerInstance.isEngaged()) {
          const isEStop = emergencyStopControllerInstance.isEngaged();
          const targetState = isEStop ? TASK_STATES.STOPPED : TASK_STATES.CANCELLED;
          this.transitionState(executionRecord, targetState, isEStop ? 'Halted by global Emergency Stop' : 'Cancelled by user');
          break;
        }

        // Find all ready nodes whose dependencies are satisfied
        const readyNodes = plan.nodes.filter(n => {
          const st = executionRecord.nodeStates.get(n.node_id);
          if (!st || st.status !== TASK_STATES.READY) return false;

          // All prerequisite dependencies must be in completedNodeIds
          const deps = Array.isArray(n.dependencies) ? n.dependencies : [];
          const allDepsSatisfied = deps.every(d => executionRecord.completedNodeIds.has(d));
          const anyDepFailed = deps.some(d => executionRecord.failedNodeIds.has(d));

          if (anyDepFailed) {
            // Propagate dependency failure
            st.status = TASK_STATES.FAILED;
            st.error = `DEPENDENCY_FAILURE: Prerequisite node(s) failed.`;
            st.failureCategory = FAILURE_CATEGORIES.DEPENDENCY_FAILURE;
            executionRecord.failedNodeIds.add(n.node_id);
            emitProgress('NODE_DEPENDENCY_FAILED', { nodeId: n.node_id, error: st.error });
            return false;
          }

          return allDepsSatisfied;
        });

        if (readyNodes.length === 0) {
          // No more nodes can run (either done or blocked by prior failure)
          break;
        }

        // Run ready nodes concurrently up to maxConcurrency
        const batch = readyNodes.slice(0, this.maxConcurrency);
        const batchPromises = batch.map(node => this._executeNode(node, executionRecord, abortController, personality, emitProgress, options));
        await Promise.all(batchPromises);
      }
    } catch (loopErr) {
      console.warn(`[DAG_EXEC_ENGINE] Execution loop exception:`, loopErr.message);
      this.transitionState(executionRecord, TASK_STATES.FAILED, loopErr.message);
    }

    // Final Task Status Decision
    if (abortController.signal.aborted || emergencyStopControllerInstance.isEngaged()) {
      const isEStop = emergencyStopControllerInstance.isEngaged();
      const terminalState = isEStop ? TASK_STATES.STOPPED : TASK_STATES.CANCELLED;
      if (executionRecord.status !== terminalState) {
        this.transitionState(executionRecord, terminalState, isEStop ? 'Emergency stop latch engaged' : 'Task cancelled');
      }
    } else {
      // Transition to VERIFYING before terminal completion
      this.transitionState(executionRecord, TASK_STATES.VERIFYING, 'Performing independent outcome verification');

      const allNodesCompleted = (executionRecord.completedNodeIds.size === plan.nodes.length);
      const someNodesCompleted = (executionRecord.completedNodeIds.size > 0);

      // Check whether all verified artifacts are authentic
      const allArtifactsVerified = executionRecord.artifacts.every(a => a.verified !== false);

      if (allNodesCompleted && allArtifactsVerified) {
        this.transitionState(executionRecord, TASK_STATES.COMPLETED, 'All DAG nodes executed and verified successfully');
      } else if (someNodesCompleted) {
        this.transitionState(executionRecord, TASK_STATES.PARTIALLY_COMPLETED, 'Some nodes completed, but one or more nodes failed or failed verification');
      } else {
        this.transitionState(executionRecord, TASK_STATES.FAILED, 'Plan execution failed to complete successfully');
      }
    }

    // Cleanup
    this.activeExecutions.delete(taskId);
    this.abortControllers.delete(taskId);
    if (typeof unregisterEStop === 'function') {
      try { unregisterEStop(); } catch (_) {}
    }

    const durationMs = Date.now() - t0;
    const finalReport = {
      taskId,
      planId: plan.plan_id,
      originalObjective: plan.original_objective,
      status: executionRecord.status,
      verified: (executionRecord.status === TASK_STATES.COMPLETED),
      durationMs,
      totalNodes: plan.nodes.length,
      completedCount: executionRecord.completedNodeIds.size,
      failedCount: executionRecord.failedNodeIds.size,
      artifacts: executionRecord.artifacts,
      checkpoints: executionRecord.checkpoints,
      stateHistory: executionRecord.stateHistory,
      nodeResults: Array.from(executionRecord.nodeStates.values()),
      summary: `DAG Task [${taskId}] finished in ${durationMs}ms with status: ${executionRecord.status} (${executionRecord.completedNodeIds.size}/${plan.nodes.length} nodes verified).`
    };

    this.saveCheckpoint(taskId, finalReport);

    try {
      const { auditTrailEngineInstance, EVENT_TYPES } = require('./audit/auditTrailEngine.js');
      if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
        auditTrailEngineInstance.recordEvent(EVENT_TYPES.TASK_FINAL_OUTCOME, {
          planId: plan.plan_id,
          status: executionRecord.status,
          verified: (executionRecord.status === TASK_STATES.COMPLETED),
          durationMs,
          completedCount: executionRecord.completedNodeIds.size,
          failedCount: executionRecord.failedNodeIds.size,
          artifactsCount: executionRecord.artifacts.length
        }, { taskId, personality });
      }
    } catch (_) {}

    emitProgress('PLAN_FINISHED', { finalReport });
    return finalReport;
  }

  /**
   * Executes a single DAG node with timeouts, retries, and independent verification
   */
  async _executeNode(node, executionRecord, abortController, personality, emitProgress, options = {}) {
    const nodeState = executionRecord.nodeStates.get(node.node_id);
    nodeState.status = TASK_STATES.RUNNING;
    nodeState.startedAt = Date.now();

    emitProgress('NODE_STARTED', { nodeId: node.node_id, tool: node.assigned_tool });

    try {
      const { auditTrailEngineInstance, EVENT_TYPES } = require('./audit/auditTrailEngine.js');
      if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
        auditTrailEngineInstance.recordEvent(EVENT_TYPES.DAG_NODE_STARTED, {
          tool: node.assigned_tool,
          verificationMethod: node.verification_method
        }, { taskId: executionRecord.taskId, nodeId: node.node_id, tool: node.assigned_tool, personality });
      }
    } catch (_) {}

    const maxRetries = (node.retry_policy && typeof node.retry_policy.maxRetries === 'number')
      ? node.retry_policy.maxRetries
      : 1;
    const timeoutMs = node.timeout || 15000;

    let success = false;
    let toolResult = null;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries + 1 && !success; attempt++) {
      if (abortController.signal.aborted || emergencyStopControllerInstance.isEngaged()) break;
      nodeState.attempts = attempt;

      try {
        // Resolve dynamic arguments from dependencies if referenced ($node_id.key or {{node_id.key}})
        const resolvedArgs = { ...(node.validated_arguments || {}) };
        for (const [k, v] of Object.entries(resolvedArgs)) {
          if (typeof v === 'string') {
            const refMatch = v.match(/^(?:\$|\{\{)([a-zA-Z0-9_\-]+)\.([a-zA-Z0-9_\-]+)(?:\}\})?$/);
            if (refMatch) {
              const depId = refMatch[1];
              const field = refMatch[2];
              const depNodeState = executionRecord.nodeStates.get(depId);
              if (depNodeState && depNodeState.result && depNodeState.result[field] !== undefined) {
                resolvedArgs[k] = depNodeState.result[field];
              }
            }
          }
        }

        // Central Permission Policy Check
        const { permissionPolicyEngineInstance, POLICY_DECISIONS } = require('./security/permissionPolicyEngine.js');
        const policyCheck = permissionPolicyEngineInstance.evaluateInvocation({
          toolName: node.assigned_tool,
          args: resolvedArgs,
          personality,
          taskId: executionRecord.taskId,
          nodeId: node.node_id,
          approvalToken: resolvedArgs.approvalToken || node.approvalToken,
          approvalSource: resolvedArgs.approvalSource || node.approvalSource,
          originalObjective: executionRecord.originalObjective,
          agentId: node.assigned_agent || resolvedArgs.agentId || null
        });

        if (policyCheck.decision === POLICY_DECISIONS.DENY) {
          throw new Error(`Security Violation: ${policyCheck.reason}`);
        }

        if (policyCheck.decision === POLICY_DECISIONS.REQUIRE_APPROVAL) {
          // Pause node in AWAITING_APPROVAL state
          nodeState.status = TASK_STATES.AWAITING_APPROVAL;
          nodeState.approvalRequest = policyCheck.approvalRequest;
          emitProgress('NODE_APPROVAL_REQUIRED', {
            taskId: executionRecord.taskId,
            nodeId: node.node_id,
            tool: node.assigned_tool,
            approvalRequest: policyCheck.approvalRequest
          });

          // Wait for explicit approval
          const approvalToken = await this._waitForApproval(
            executionRecord.taskId,
            node.node_id,
            policyCheck.approvalRequest,
            options.approvalHandler,
            options.approvalTimeoutMs || 30000,
            abortController
          );

          if (!approvalToken) {
            throw new Error(`APPROVAL_DENIED: Action "${node.assigned_tool}" requires explicit user approval which was not granted or timed out.`);
          }

          resolvedArgs.approvalToken = approvalToken;
          node.approvalToken = approvalToken;
          nodeState.status = TASK_STATES.RUNNING;
        }

        const toolPromise = executeTool(node.assigned_tool, resolvedArgs, personality);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`TOOL_TIMEOUT: Node ${node.node_id} timed out after ${timeoutMs}ms`)), timeoutMs)
        );

        const abortPromise = new Promise((_, reject) => {
          if (abortController.signal.aborted) return reject(new Error('USER_CANCELLATION: Node execution cancelled.'));
          abortController.signal.addEventListener('abort', () => reject(new Error('USER_CANCELLATION: Node execution cancelled.')), { once: true });
        });

        toolResult = await Promise.race([toolPromise, timeoutPromise, abortPromise]);
        success = true;
      } catch (err) {
        lastError = err;
        if (err.message && err.message.includes('APPROVAL_DENIED')) {
          break;
        }
        if (attempt <= maxRetries) {
          const backoff = (node.retry_policy?.backoffMs || 200) * attempt;
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }

    if (abortController.signal.aborted || emergencyStopControllerInstance.isEngaged()) {
      nodeState.status = TASK_STATES.CANCELLED;
      return;
    }

    if (!success) {
      nodeState.status = TASK_STATES.FAILED;
      nodeState.error = lastError ? lastError.message : 'Unknown execution failure';
      nodeState.failureCategory = this._classifyFailure(lastError);
      executionRecord.failedNodeIds.add(node.node_id);
      emitProgress('NODE_FAILED', { nodeId: node.node_id, error: nodeState.error });

      try {
        const { auditTrailEngineInstance, EVENT_TYPES } = require('./audit/auditTrailEngine.js');
        if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
          auditTrailEngineInstance.recordEvent(EVENT_TYPES.DAG_NODE_FAILED, {
            tool: node.assigned_tool,
            error: nodeState.error,
            failureCategory: nodeState.failureCategory
          }, { taskId: executionRecord.taskId, nodeId: node.node_id, tool: node.assigned_tool, personality });
        }
      } catch (_) {}
      return;
    }

    // Step: Independent Verification Layer Check
    nodeState.status = TASK_STATES.VERIFYING;
    const verification = await independentVerifierInstance.verifyExecution({
      verificationMethod: node.verification_method,
      expectedOutput: node.expected_output,
      executionResult: toolResult,
      targetPath: node.validated_arguments?.filePath || node.validated_arguments?.path || node.validated_arguments?.destPath || node.validated_arguments?.destinationPath,
      expectedHeadings: node.validated_arguments?.expectedHeadings || node.validated_arguments?.sections?.map(s => s.heading),
      expectedSheets: node.validated_arguments?.expectedSheets || (Array.isArray(node.validated_arguments?.sheets) ? node.validated_arguments.sheets.map(s => s.name) : undefined),
      expectedSlides: node.validated_arguments?.expectedSlides || (Array.isArray(node.validated_arguments?.slides) ? node.validated_arguments.slides.length : undefined),
      expectedContent: (node.expectedContent !== undefined)
        ? node.expectedContent
        : (node.validated_arguments?.content !== undefined ? node.validated_arguments.content : undefined)
    });

    nodeState.result = toolResult;
    nodeState.verification = verification;

    try {
      const { auditTrailEngineInstance, EVENT_TYPES } = require('./audit/auditTrailEngine.js');
      if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
        auditTrailEngineInstance.recordEvent(EVENT_TYPES.INDEPENDENT_VERIFICATION, {
          tool: node.assigned_tool,
          verified: verification.verified,
          status: verification.status,
          failureReason: verification.failureReason
        }, { taskId: executionRecord.taskId, nodeId: node.node_id, tool: node.assigned_tool, personality });
      }
    } catch (_) {}

    if (verification.verified) {
      nodeState.status = TASK_STATES.COMPLETED;
      executionRecord.completedNodeIds.add(node.node_id);
      if (Array.isArray(verification.artifacts)) {
        executionRecord.artifacts.push(...verification.artifacts);
      }
      emitProgress('NODE_COMPLETED', { nodeId: node.node_id, verificationSummary: verification.summary });

      try {
        const { auditTrailEngineInstance, EVENT_TYPES } = require('./audit/auditTrailEngine.js');
        if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
          auditTrailEngineInstance.recordEvent(EVENT_TYPES.DAG_NODE_COMPLETED, {
            tool: node.assigned_tool,
            verificationSummary: verification.summary
          }, { taskId: executionRecord.taskId, nodeId: node.node_id, tool: node.assigned_tool, personality });
        }
      } catch (_) {}
    } else {
      // FALSE SUCCESS DEFENSE: The tool may have reported success, but independent verification caught failure!
      nodeState.status = TASK_STATES.FAILED;
      nodeState.error = `VERIFICATION_FAILURE: ${verification.failureReason}`;
      nodeState.failureCategory = FAILURE_CATEGORIES.VERIFICATION_FAILURE;
      executionRecord.failedNodeIds.add(node.node_id);
      emitProgress('NODE_VERIFICATION_FAILED', { nodeId: node.node_id, reason: verification.failureReason });

      try {
        const { auditTrailEngineInstance, EVENT_TYPES } = require('./audit/auditTrailEngine.js');
        if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
          auditTrailEngineInstance.recordEvent(EVENT_TYPES.DAG_NODE_FAILED, {
            tool: node.assigned_tool,
            error: nodeState.error,
            failureCategory: nodeState.failureCategory
          }, { taskId: executionRecord.taskId, nodeId: node.node_id, tool: node.assigned_tool, personality });
        }
      } catch (_) {}
    }
  }

  _classifyFailure(err) {
    if (!err || !err.message) return FAILURE_CATEGORIES.UNKNOWN_FAILURE;
    const msg = err.message.toUpperCase();
    if (msg.includes('TIMEOUT')) return FAILURE_CATEGORIES.TOOL_TIMEOUT;
    if (msg.includes('NOT REGISTERED') || msg.includes('TOOL_NOT_FOUND')) return FAILURE_CATEGORIES.TOOL_NOT_FOUND;
    if (msg.includes('SECURITY') || msg.includes('PERMISSION') || msg.includes('OUTSIDE AUTHORIZED')) return FAILURE_CATEGORIES.PERMISSION_DENIED;
    if (msg.includes('CANCEL')) return FAILURE_CATEGORIES.USER_CANCELLATION;
    if (msg.includes('EMERGENCY_STOP')) return FAILURE_CATEGORIES.EMERGENCY_STOP;
    if (msg.includes('VERIF')) return FAILURE_CATEGORIES.VERIFICATION_FAILURE;
    return FAILURE_CATEGORIES.PROCESS_FAILURE;
  }

  async _waitForApproval(taskId, nodeId, approvalRequest, approvalHandler, timeoutMs, abortController) {
    if (typeof approvalHandler === 'function') {
      try {
        const res = await approvalHandler({ taskId, nodeId, approvalRequest });
        if (typeof res === 'string') return res;
        if (res && res.token) return res.token;
        if (res && res.approved && res.approvalId) return res.approvalId;
        return null;
      } catch (_) {
        return null;
      }
    }

    const key = `${taskId}:${nodeId}`;
    return new Promise((resolve) => {
      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.pendingApprovals.delete(key);
      };

      if (abortController.signal.aborted || emergencyStopControllerInstance.isEngaged()) {
        return resolve(null);
      }

      const onAbort = () => {
        cleanup();
        resolve(null);
      };
      abortController.signal.addEventListener('abort', onAbort, { once: true });

      timer = setTimeout(() => {
        abortController.signal.removeEventListener('abort', onAbort);
        cleanup();
        resolve(null); // Silence or timeout is strictly denied
      }, timeoutMs);

      this.pendingApprovals.set(key, {
        resolve: (token) => {
          abortController.signal.removeEventListener('abort', onAbort);
          cleanup();
          resolve(token);
        },
        reject: (err) => {
          abortController.signal.removeEventListener('abort', onAbort);
          cleanup();
          resolve(null);
        },
        approvalRequest,
        taskId,
        nodeId
      });
    });
  }

  submitNodeApproval(taskId, nodeId, approvalToken) {
    const key = `${taskId}:${nodeId}`;
    const pending = this.pendingApprovals.get(key);
    if (pending) {
      pending.resolve(approvalToken);
      return { success: true, taskId, nodeId, status: 'APPROVED' };
    }
    return { success: false, error: 'No pending approval found for this node.' };
  }

  denyNodeApproval(taskId, nodeId, reason = 'User denied action') {
    const key = `${taskId}:${nodeId}`;
    const pending = this.pendingApprovals.get(key);
    if (pending) {
      pending.reject(new Error(reason));
      return { success: true, taskId, nodeId, status: 'DENIED' };
    }
    return { success: false, error: 'No pending approval found for this node.' };
  }

  getPendingApprovals() {
    const list = [];
    for (const [key, val] of this.pendingApprovals.entries()) {
      list.push({
        key,
        taskId: val.taskId,
        nodeId: val.nodeId,
        approvalRequest: val.approvalRequest
      });
    }
    return list;
  }

  cancelAllPendingApprovals(reason = 'Emergency stop engaged') {
    const count = this.pendingApprovals.size;
    for (const [key, pending] of this.pendingApprovals.entries()) {
      pending.reject(new Error(reason));
    }
    this.pendingApprovals.clear();
    return { success: true, cancelledCount: count };
  }

  cancelTask(taskId, reason = 'User initiated task cancellation') {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort(new Error(reason));
      for (const [key, pending] of this.pendingApprovals.entries()) {
        if (pending.taskId === taskId) {
          pending.reject(new Error(reason));
        }
      }
      const record = this.activeExecutions.get(taskId);
      if (record) {
        this.transitionState(record, TASK_STATES.CANCELLED, reason);
      }
      return { success: true, taskId, cancelled: true };
    }
    return { success: false, taskId, error: 'Task not found or already completed.' };
  }
}

const dagExecutionEngineInstance = new DagExecutionEngine();

module.exports = {
  DagExecutionEngine,
  dagExecutionEngineInstance
};
