/**
 * VISION AI — Live Execution Monitor & Real-Time Event Streamer
 * 
 * Provides an authoritative, real-time live execution monitor that reflects
 * actual task progression, plan execution, active tools, permission checks,
 * elapsed time, error recovery, and physical evidence verification.
 * 
 * In strict adherence to Section 9 of the Master Engineering Directive:
 * - Reflects genuine execution events (zero decorative animations or fabricated progress)
 * - Exposes real-time Server-Sent Events (SSE) streaming (/api/monitoring/stream)
 * - Tracks 13 mandatory execution metrics:
 *   1. Current task ID & objective
 *   2. Execution status (IDLE, PLANNING, RUNNING, AWAITING_APPROVAL, VERIFYING, COMPLETED, FAILED, HALTED)
 *   3. Current plan structure
 *   4. Completed steps count
 *   5. Remaining steps count
 *   6. Current active tool
 *   7. Permission evaluation status (Level 0-4, Decision, Reason)
 *   8. Elapsed time (live ms)
 *   9. Errors encountered
 *   10. Retry attempts
 *   11. Recovery / checkpoint state
 *   12. Evidence references (paths & SHA-256 hashes)
 *   13. Final independent verification certificate
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { permissionPolicyEngineInstance } = require('../security/permissionPolicyEngine.js');

const MONITOR_STATES = {
  IDLE: 'IDLE',
  PLANNING: 'PLANNING',
  RUNNING: 'RUNNING',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  VERIFYING: 'VERIFYING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  HALTED: 'HALTED'
};

class LiveExecutionMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.subscribers = new Set();
    this.recentEventsBuffer = [];
    this.maxEventBufferSize = options.maxEventBufferSize || 300;

    this._initializeState();
  }

  _initializeState() {
    this.state = {
      currentTask: {
        taskId: null,
        objective: '',
        status: MONITOR_STATES.IDLE,
        startedAt: null,
        completedAt: null,
        elapsedMs: 0
      },
      plan: {
        planId: null,
        totalSteps: 0,
        completedSteps: 0,
        remainingSteps: 0,
        nodes: []
      },
      currentNode: null,
      permissionStatus: {
        level: null,
        decision: null,
        reason: null,
        approvalRequest: null
      },
      errors: [],
      retryAttempts: 0,
      recoveryState: {
        checkpointLoaded: false,
        restoredNodesCount: 0,
        checkpointFile: null
      },
      evidence: [],
      finalVerification: {
        status: 'PENDING',
        verified: false,
        timestamp: null,
        summary: '',
        method: null
      }
    };
  }

  /**
   * Resets monitor state cleanly
   */
  reset() {
    this._initializeState();
    this.recentEventsBuffer = [];
    this.emit('state_reset');
  }

  /**
   * Returns authoritative live execution state snapshot
   */
  getLiveSnapshot() {
    // Dynamically calculate live elapsed time if running
    const snapshot = JSON.parse(JSON.stringify(this.state));
    if (snapshot.currentTask.startedAt && !snapshot.currentTask.completedAt && snapshot.currentTask.status !== MONITOR_STATES.IDLE) {
      snapshot.currentTask.elapsedMs = Date.now() - new Date(snapshot.currentTask.startedAt).getTime();
    }
    return snapshot;
  }

  /**
   * Returns recent live event stream history
   */
  getRecentEvents(limit = 50) {
    return this.recentEventsBuffer.slice(-limit);
  }

  /**
   * Connects an HTTP response for Server-Sent Events (SSE) streaming
   */
  subscribeSse(res, req = null) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    res.write(`retry: 1500\n\n`);

    // Send immediate initial state snapshot upon connection
    const initialPayload = JSON.stringify({
      type: 'INIT_SNAPSHOT',
      timestamp: new Date().toISOString(),
      snapshot: this.getLiveSnapshot(),
      recentEvents: this.getRecentEvents(20)
    });
    res.write(`event: snapshot\ndata: ${initialPayload}\n\n`);

    this.subscribers.add(res);

    const cleanup = () => {
      this.subscribers.delete(res);
    };

    res.on('close', cleanup);
    res.on('finish', cleanup);
    if (req) {
      req.on('close', cleanup);
    }
  }

  /**
   * Broadcasts a live event to all connected SSE clients and internal listeners
   */
  broadcastEvent(eventType, payload = {}) {
    const timestamp = new Date().toISOString();
    const eventId = 'mon_evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

    // Sanitize any secrets in payload before broadcasting
    const sanitizedPayload = permissionPolicyEngineInstance.redactSecrets(payload);

    const eventRecord = {
      id: eventId,
      timestamp,
      type: eventType,
      taskId: this.state.currentTask.taskId,
      payload: sanitizedPayload
    };

    // Buffer in-memory ring buffer
    this.recentEventsBuffer.push(eventRecord);
    if (this.recentEventsBuffer.length > this.maxEventBufferSize) {
      this.recentEventsBuffer.shift();
    }

    // Emit on Node EventEmitter
    this.emit(eventType, eventRecord);
    this.emit('event', eventRecord);

    // Stream to active SSE clients
    if (this.subscribers.size > 0) {
      const sseData = `event: ${eventType}\ndata: ${JSON.stringify(eventRecord)}\n\n`;
      for (const client of this.subscribers) {
        try {
          client.write(sseData);
        } catch (_) {
          this.subscribers.delete(client);
        }
      }
    }

    return eventRecord;
  }

  // =========================================================================
  // State Machine Hooks (Invoked by DAG Orchestrator & Tool Registry)
  // =========================================================================

  onTaskStarted(data = {}) {
    const { taskId, objective } = data;
    this.state.currentTask.taskId = taskId;
    this.state.currentTask.objective = objective || '';
    this.state.currentTask.status = MONITOR_STATES.PLANNING;
    this.state.currentTask.startedAt = new Date().toISOString();
    this.state.currentTask.completedAt = null;
    this.state.currentTask.elapsedMs = 0;

    // Reset task-scoped collections
    this.state.plan = { planId: null, totalSteps: 0, completedSteps: 0, remainingSteps: 0, nodes: [] };
    this.state.currentNode = null;
    this.state.errors = [];
    this.state.retryAttempts = 0;
    this.state.evidence = [];
    this.state.finalVerification = { status: 'PENDING', verified: false, timestamp: null, summary: '', method: null };

    this.broadcastEvent('TASK_STARTED', { taskId, objective });
  }

  onPlanGenerated(data = {}) {
    const { taskId, plan } = data;
    const nodes = (plan && plan.nodes) ? plan.nodes : [];

    this.state.currentTask.status = MONITOR_STATES.RUNNING;
    this.state.plan.planId = plan ? (plan.plan_id || plan.id) : null;
    this.state.plan.totalSteps = nodes.length;
    this.state.plan.completedSteps = 0;
    this.state.plan.remainingSteps = nodes.length;
    this.state.plan.nodes = nodes.map(n => ({
      id: n.node_id || n.id,
      tool: n.assigned_tool || n.tool,
      description: n.task_description || n.description || '',
      status: n.execution_status || 'PENDING',
      riskLevel: n.risk_level || 2,
      dependencies: n.dependencies || [],
      startedAt: null,
      durationMs: 0,
      error: null
    }));

    this.broadcastEvent('PLAN_GENERATED', {
      taskId,
      planId: this.state.plan.planId,
      totalSteps: this.state.plan.totalSteps,
      nodes: this.state.plan.nodes
    });
  }

  onNodeStarted(data = {}) {
    const { taskId, nodeId, tool, description, riskLevel, dependencies } = data;

    const nodeRecord = {
      nodeId,
      tool,
      description: description || '',
      status: 'RUNNING',
      attempts: (data.attempt || 1),
      startedAt: new Date().toISOString(),
      durationMs: 0
    };

    this.state.currentNode = nodeRecord;
    this.state.currentTask.status = MONITOR_STATES.RUNNING;

    // Update in plan nodes
    const planNode = this.state.plan.nodes.find(n => n.id === nodeId);
    if (planNode) {
      planNode.status = 'RUNNING';
      planNode.startedAt = nodeRecord.startedAt;
    }

    this.broadcastEvent('NODE_STARTED', { taskId, nodeId, tool, description, riskLevel });
  }

  onPermissionEvaluated(data = {}) {
    const { taskId, nodeId, tool, level, decision, reason, approvalRequest } = data;

    this.state.permissionStatus = {
      level,
      decision,
      reason: reason || null,
      approvalRequest: approvalRequest || null
    };

    if (decision === 'REQUIRE_APPROVAL') {
      this.state.currentTask.status = MONITOR_STATES.AWAITING_APPROVAL;
      if (this.state.currentNode) {
        this.state.currentNode.status = 'AWAITING_APPROVAL';
      }
      const planNode = this.state.plan.nodes.find(n => n.id === nodeId);
      if (planNode) planNode.status = 'AWAITING_APPROVAL';
    }

    this.broadcastEvent('PERMISSION_EVALUATED', { taskId, nodeId, tool, level, decision, reason, approvalRequest });
  }

  onNodeCompleted(data = {}) {
    const { taskId, nodeId, tool, output, durationMs, evidence } = data;

    if (this.state.currentNode && this.state.currentNode.nodeId === nodeId) {
      this.state.currentNode.status = 'COMPLETED';
      this.state.currentNode.durationMs = durationMs || 0;
    }

    // Update plan progress
    const planNode = this.state.plan.nodes.find(n => n.id === nodeId);
    if (planNode) {
      planNode.status = 'COMPLETED';
      planNode.durationMs = durationMs || 0;
    }

    this.state.plan.completedSteps = this.state.plan.nodes.filter(n => n.status === 'COMPLETED').length;
    this.state.plan.remainingSteps = Math.max(0, this.state.plan.totalSteps - this.state.plan.completedSteps);

    // Track evidence references
    if (evidence) {
      const evList = Array.isArray(evidence) ? evidence : [evidence];
      for (const ev of evList) {
        if (ev && ev.path) {
          this.state.evidence.push({
            nodeId,
            tool,
            evidenceType: ev.type || 'FILE_ARTIFACT',
            path: ev.path,
            sha256: ev.sha256 || null,
            sizeBytes: ev.sizeBytes || null,
            verified: ev.verified !== false
          });
        }
      }
    }

    this.broadcastEvent('NODE_COMPLETED', {
      taskId,
      nodeId,
      tool,
      durationMs,
      completedSteps: this.state.plan.completedSteps,
      remainingSteps: this.state.plan.remainingSteps
    });
  }

  onNodeFailed(data = {}) {
    const { taskId, nodeId, tool, error, attempt } = data;

    const errorRecord = {
      timestamp: new Date().toISOString(),
      nodeId,
      tool,
      error: (error && error.message) ? error.message : String(error || 'Execution failure'),
      attempt: attempt || 1
    };
    this.state.errors.push(errorRecord);

    if (this.state.currentNode && this.state.currentNode.nodeId === nodeId) {
      this.state.currentNode.status = 'FAILED';
      this.state.currentNode.error = errorRecord.error;
    }

    const planNode = this.state.plan.nodes.find(n => n.id === nodeId);
    if (planNode) {
      planNode.status = 'FAILED';
      planNode.error = errorRecord.error;
    }

    this.broadcastEvent('NODE_FAILED', { taskId, nodeId, tool, error: errorRecord.error, attempt });
  }

  onNodeRetry(data = {}) {
    const { taskId, nodeId, tool, attempt, backoffMs } = data;
    this.state.retryAttempts++;

    if (this.state.currentNode && this.state.currentNode.nodeId === nodeId) {
      this.state.currentNode.attempts = attempt;
      this.state.currentNode.status = 'RETRYING';
    }

    this.broadcastEvent('NODE_RETRY', { taskId, nodeId, tool, attempt, backoffMs, totalRetries: this.state.retryAttempts });
  }

  onRecoveryCheckpointLoaded(data = {}) {
    const { taskId, restoredNodesCount, checkpointFile } = data;
    this.state.recoveryState = {
      checkpointLoaded: true,
      restoredNodesCount: restoredNodesCount || 0,
      checkpointFile: checkpointFile || null
    };

    this.broadcastEvent('RECOVERY_CHECKPOINT_LOADED', { taskId, restoredNodesCount, checkpointFile });
  }

  onVerificationStarted(data = {}) {
    const { taskId } = data;
    this.state.currentTask.status = MONITOR_STATES.VERIFYING;
    this.state.finalVerification.status = 'VERIFYING';

    this.broadcastEvent('VERIFICATION_STARTED', { taskId });
  }

  onVerificationCompleted(data = {}) {
    const { taskId, verified, status, details, method } = data;

    this.state.finalVerification = {
      status: verified ? 'VERIFIED' : 'FAILED',
      verified: Boolean(verified),
      timestamp: new Date().toISOString(),
      summary: (details && details.summary) ? details.summary : (verified ? 'All artifacts independently verified.' : 'Verification checks failed.'),
      method: method || 'INDEPENDENT_VERIFIER'
    };

    this.broadcastEvent('VERIFICATION_COMPLETED', {
      taskId,
      verified: this.state.finalVerification.verified,
      status: this.state.finalVerification.status,
      summary: this.state.finalVerification.summary
    });
  }

  onTaskCompleted(data = {}) {
    const { taskId, status, verified, deliverables } = data;

    this.state.currentTask.status = MONITOR_STATES.COMPLETED;
    this.state.currentTask.completedAt = new Date().toISOString();
    if (this.state.currentTask.startedAt) {
      this.state.currentTask.elapsedMs = Date.now() - new Date(this.state.currentTask.startedAt).getTime();
    }
    this.state.currentNode = null;

    this.broadcastEvent('TASK_COMPLETED', {
      taskId,
      status: MONITOR_STATES.COMPLETED,
      verified: Boolean(verified),
      elapsedMs: this.state.currentTask.elapsedMs,
      completedSteps: this.state.plan.completedSteps,
      evidenceCount: this.state.evidence.length
    });
  }

  onTaskFailed(data = {}) {
    const { taskId, error } = data;

    this.state.currentTask.status = MONITOR_STATES.FAILED;
    this.state.currentTask.completedAt = new Date().toISOString();
    if (this.state.currentTask.startedAt) {
      this.state.currentTask.elapsedMs = Date.now() - new Date(this.state.currentTask.startedAt).getTime();
    }

    this.broadcastEvent('TASK_FAILED', {
      taskId,
      error: (error && error.message) ? error.message : String(error || 'Task execution failed'),
      elapsedMs: this.state.currentTask.elapsedMs
    });
  }

  onEmergencyStopEngaged(data = {}) {
    const { reason, timestamp } = data;
    this.state.currentTask.status = MONITOR_STATES.HALTED;
    if (this.state.currentNode) {
      this.state.currentNode.status = 'HALTED';
    }

    this.broadcastEvent('EMERGENCY_STOP_ENGAGED', {
      status: MONITOR_STATES.HALTED,
      reason: reason || 'User triggered emergency stop',
      timestamp: timestamp || new Date().toISOString()
    });
  }

  onEmergencyStopReset(data = {}) {
    const { reason, timestamp } = data;
    if (this.state.currentTask.status === MONITOR_STATES.HALTED) {
      this.state.currentTask.status = MONITOR_STATES.IDLE;
    }

    this.broadcastEvent('EMERGENCY_STOP_RESET', {
      status: MONITOR_STATES.IDLE,
      reason: reason || 'Authorized emergency stop reset',
      timestamp: timestamp || new Date().toISOString()
    });
  }
}

const liveExecutionMonitorInstance = new LiveExecutionMonitor();

module.exports = {
  LiveExecutionMonitor,
  liveExecutionMonitorInstance,
  MONITOR_STATES
};

