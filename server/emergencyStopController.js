/**
 * VISION AI — Central Server-Side Emergency Stop Controller
 * Authoritative kill-switch latch that coordinates halting across:
 * - Permission Gate & Security Core
 * - Vision Subsystem & Camera Sensors
 * - Task Orchestrator & Autonomous Projects
 * - AI Provider Adapter & Active SSE Streams
 * - Desktop Controller & Document Automation
 * - Central Brain Architecture Telemetry
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { spawn, execSync } = require('child_process');
const { permissionGateInstance } = require('./desktop/permissionGate.js');
const { visionServiceInstance } = require('./visionService.js');
const brainArchitectureEngine = require('./brainArchitectureEngine.js');

const STATE_FILE = path.join(__dirname, '../data/emergency_stop_state.json');

class EmergencyStopController extends EventEmitter {
  constructor(options = {}) {
    super();
    this.stateFilePath = options.stateFilePath || STATE_FILE;
    this.isLatched = false;
    this.latchTimestamp = null;
    this.latchReason = null;
    this.stopCount = 0;
    this.activeStreams = new Set(); // Active AbortControllers for streaming AI calls
    this.activeTaskControllers = new Set(); // Active AbortControllers for background jobs
    this.activeToolControllers = new Set(); // Active AbortControllers for long-running tools
    this.activeChildProcesses = new Map(); // pid -> { childProcess, metadata, abortFn }
    this.stopHandlers = new Map(); // name -> handler(reason)
    this.resetHandlers = new Map(); // name -> handler(reason)
    this._loadPersistedState();
  }

  /**
   * Registers a subsystem Emergency Stop handler callback
   */
  registerStopHandler(name, handlerFn) {
    if (!name || typeof handlerFn !== 'function') return () => {};
    this.stopHandlers.set(name, handlerFn);
    return () => {
      this.stopHandlers.delete(name);
    };
  }

  /**
   * Registers a subsystem Emergency Reset handler callback
   */
  registerResetHandler(name, handlerFn) {
    if (!name || typeof handlerFn !== 'function') return () => {};
    this.resetHandlers.set(name, handlerFn);
    return () => {
      this.resetHandlers.delete(name);
    };
  }

  _loadPersistedState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf8').trim();
        if (raw) {
          const data = JSON.parse(raw);
          if (data && data.isLatched === true) {
            this.isLatched = true;
            this.latchTimestamp = data.latchTimestamp;
            this.latchReason = data.latchReason;
            this.stopCount = data.stopCount || 1;
          }
        }
      }
    } catch (_) {}
  }

  _savePersistedState() {
    try {
      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.stateFilePath, JSON.stringify({
        isLatched: this.isLatched,
        latchTimestamp: this.latchTimestamp,
        latchReason: this.latchReason,
        stopCount: this.stopCount,
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch (_) {}
  }

  /**
   * Registers an active streaming AbortController so emergency stop can abort it instantly
   */
  registerStreamAbortController(abortController) {
    if (!abortController) return () => {};
    this.activeStreams.add(abortController);
    return () => {
      this.activeStreams.delete(abortController);
    };
  }

  /**
   * Registers an active background task AbortController
   */
  registerTaskAbortController(abortController) {
    if (!abortController) return () => {};
    this.activeTaskControllers.add(abortController);
    return () => {
      this.activeTaskControllers.delete(abortController);
    };
  }

  /**
   * Registers an active tool AbortController
   */
  registerToolAbortController(abortController) {
    if (!abortController) return () => {};
    this.activeToolControllers.add(abortController);
    return () => {
      this.activeToolControllers.delete(abortController);
    };
  }

  /**
   * Registers an active OS child process or command task
   * so emergency stop can terminate it immediately.
   */
  registerChildProcess(childProcess, metadata = {}) {
    if (!childProcess || !childProcess.pid) return () => {};
    if (this.isEngaged()) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /F /T /PID ${childProcess.pid}`, { stdio: 'ignore' });
        } else {
          childProcess.kill('SIGKILL');
        }
      } catch (_) {}
      throw new Error(`EMERGENCY_STOP_ACTIVE: Process execution blocked by active Emergency Stop.`);
    }

    const pid = childProcess.pid;
    const record = {
      pid,
      childProcess,
      metadata,
      startedAt: Date.now()
    };
    this.activeChildProcesses.set(pid, record);

    const onExit = () => {
      this.activeChildProcesses.delete(pid);
    };

    if (typeof childProcess.on === 'function') {
      childProcess.on('exit', onExit);
      childProcess.on('error', onExit);
    }

    return () => {
      this.activeChildProcesses.delete(pid);
    };
  }

  registerActiveProcess(pid, metadata = {}) {
    if (!pid || typeof pid !== 'number') return () => {};
    if (this.isEngaged()) {
      this.terminateProcess(pid);
      throw new Error(`EMERGENCY_STOP_ACTIVE: Process execution blocked by active Emergency Stop.`);
    }

    const record = {
      pid,
      childProcess: null,
      metadata,
      startedAt: Date.now()
    };
    this.activeChildProcesses.set(pid, record);
    return () => {
      this.activeChildProcesses.delete(pid);
    };
  }

  registerProcess(pid, metadata = {}) {
    return this.registerActiveProcess(pid, metadata);
  }

  terminateProcess(pid) {
    if (!pid) return false;
    try {
      if (process.platform === 'win32') {
        const taskkillBin = process.env.SystemRoot
          ? path.join(process.env.SystemRoot, 'System32', 'taskkill.exe')
          : 'C:\\Windows\\System32\\taskkill.exe';
        execSync(`"${taskkillBin}" /F /T /PID ${pid}`, { stdio: 'ignore', timeout: 3000 });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch (_) {}
    return this.verifyProcessTerminated(pid);
  }

  verifyProcessTerminated(pid) {
    if (!pid) return true;
    try {
      process.kill(pid, 0); // If returns without error, process is still alive
      return false;
    } catch (e) {
      return e.code === 'ESRCH';
    }
  }

  /**
   * Immediately terminates all registered OS child processes
   */
  terminateAllChildProcesses(reason = 'User initiated emergency stop') {
    let terminatedCount = 0;
    const taskkillBin = process.env.SystemRoot
      ? path.join(process.env.SystemRoot, 'System32', 'taskkill.exe')
      : 'C:\\Windows\\System32\\taskkill.exe';

    for (const [pid, record] of this.activeChildProcesses.entries()) {
      try {
        if (record.metadata && typeof record.metadata.abortFn === 'function') {
          try { record.metadata.abortFn(reason); } catch (_) {}
        }

        if (process.platform === 'win32') {
          // On Windows, taskkill /F /T terminates the process AND all its descendant children
          // We must NOT kill the parent before taskkill runs, otherwise the tree cannot be walked
          try {
            const tk = spawn(taskkillBin, ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
            if (tk && typeof tk.unref === 'function') tk.unref();
          } catch (_) {}

          // Fallback cleanup after taskkill has hooked and pruned the tree
          setTimeout(() => {
            try {
              if (record.childProcess && typeof record.childProcess.kill === 'function') {
                record.childProcess.kill('SIGKILL');
              }
            } catch (_) {}
            try {
              process.kill(pid, 0); // test if still alive
              process.kill(pid, 'SIGKILL');
            } catch (_) {}
          }, 600).unref();
        } else {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch (_) {
            try { process.kill(pid, 'SIGKILL'); } catch (_) {}
          }
        }

        terminatedCount++;
      } catch (err) {
        try {
          if (record.childProcess && typeof record.childProcess.kill === 'function') {
            record.childProcess.kill('SIGKILL');
          }
        } catch (_) {}
      }
    }
    this.activeChildProcesses.clear();

    // Signal Python Local Agent to terminate its child processes and latch E-Stop asynchronously
    setImmediate(() => {
      try {
        const http = require('http');
        const req = http.request('http://127.0.0.1:3005/emergency-stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeout: 800
        }, () => {});
        req.on('error', () => {});
        req.write(JSON.stringify({ reason }));
        req.end();
      } catch (_) {}
    });

    return terminatedCount;
  }

  /**
   * Authoritative Emergency Stop Trigger:
   * Idempotently halts all operations, revokes sensor access, aborts in-flight requests,
   * cancels running task DAGs, and broadcasts a high-priority system HALTED event.
   */
  engage(reason = 'User initiated emergency stop') {
    const t0 = Date.now();
    this.isLatched = true;
    this.latchTimestamp = t0;
    this.latchReason = reason;
    this.stopCount++;

    // 1. Latch Permission Gate
    let gateResult = { emergencyStopActive: true };
    try {
      gateResult = permissionGateInstance.triggerEmergencyStop(reason);
    } catch (e) {
      console.warn('[E_STOP_CONTROLLER] Warning engaging permission gate:', e.message);
    }

    // 2. Lock Vision & Camera Sensors
    let visionResult = { cameraState: { active: false, isLockedEmergencyStop: true } };
    try {
      visionResult = visionServiceInstance.handleEmergencyStop(reason);
    } catch (e) {
      console.warn('[E_STOP_CONTROLLER] Warning locking vision sensor:', e.message);
    }

    // 3. Abort all in-flight AI streams immediately
    let abortedStreamCount = 0;
    for (const controller of this.activeStreams) {
      try {
        controller.abort(new Error(`EMERGENCY_STOP: ${reason}`));
        abortedStreamCount++;
      } catch (e) {}
    }
    this.activeStreams.clear();

    // 4. Abort all in-flight task orchestrator controllers
    let abortedTaskCount = 0;
    for (const controller of this.activeTaskControllers) {
      try {
        controller.abort(new Error(`EMERGENCY_STOP: ${reason}`));
        abortedTaskCount++;
      } catch (e) {}
    }
    this.activeTaskControllers.clear();

    // 4b. Abort all in-flight cancellable tool controllers
    let abortedToolCount = 0;
    for (const controller of this.activeToolControllers) {
      try {
        controller.abort(new Error(`EMERGENCY_STOP: ${reason}`));
        abortedToolCount++;
      } catch (e) {}
    }
    this.activeToolControllers.clear();

    // 4c. Terminate all active OS child processes immediately (<100ms)
    const abortedChildProcessCount = this.terminateAllChildProcesses(reason);

    // 4d. Emergency browser shutdown
    try {
      const { browserAutomationEngineInstance } = require('./browser/browserAutomationEngine.js');
      if (browserAutomationEngineInstance && typeof browserAutomationEngineInstance.emergencyShutdown === 'function') {
        browserAutomationEngineInstance.emergencyShutdown().catch(() => {});
      }
    } catch (_) {}

    // 4e. Revoke all pending approvals across the policy engine
    try {
      const { permissionPolicyEngineInstance } = require('./security/permissionPolicyEngine.js');
      if (permissionPolicyEngineInstance && typeof permissionPolicyEngineInstance.revokeAllApprovals === 'function') {
        permissionPolicyEngineInstance.revokeAllApprovals(reason);
      }
    } catch (_) {}

    // 4f. Forcibly terminate WhatsApp automators and permanently purge all staged drafts & pending sends
    try {
      const { whatsappServiceInstance } = require('./desktop/whatsappService.js');
      if (whatsappServiceInstance && typeof whatsappServiceInstance.handleEmergencyStop === 'function') {
        whatsappServiceInstance.handleEmergencyStop(reason);
      }
    } catch (_) {}

    // 4g. Pause/disable screen observation & camera sensors on E-Stop
    try {
      const { screenObservationServiceInstance } = require('./vision/screenObservationService.js');
      if (screenObservationServiceInstance && typeof screenObservationServiceInstance.disableObservation === 'function') {
        screenObservationServiceInstance.disableObservation();
      }
    } catch (_) {}

    // 4h. Invoke all registered Phase 15 sensory, voice, GUI, and copilot stop handlers immediately
    for (const [, handlerFn] of this.stopHandlers.entries()) {
      try {
        handlerFn(reason);
      } catch (_) {}
    }

    // Persist latched state to disk so it survives server restart
    this._savePersistedState();

    // 5. Notify Brain Architecture Telemetry
    try {
      brainArchitectureEngine.broadcastEvent('sub_security_permissions', 'sub_executive_core', 'EMERGENCY_STOP', {
        reason,
        status: 'HALTED',
        timestamp: t0,
        stopCount: this.stopCount,
        abortedStreamCount,
        abortedTaskCount,
        abortedToolCount,
        abortedChildProcessCount
      });
    } catch (e) {}

    const latencyMs = Date.now() - t0;

    // 6. Record to Cryptographic Audit Trail
    try {
      const { auditTrailEngineInstance, EVENT_TYPES } = require('./audit/auditTrailEngine.js');
      if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
        auditTrailEngineInstance.recordEvent(EVENT_TYPES.EMERGENCY_STOP_ENGAGED, {
          reason,
          stopCount: this.stopCount,
          latencyMs,
          abortedStreamCount,
          abortedTaskCount,
          abortedToolCount,
          abortedChildProcessCount
        }, {
          tool: 'emergency_stop'
        });
      }
    } catch (_) {}

    try {
      this.emit('STOP', { reason, timestamp: t0, stopCount: this.stopCount });
    } catch (_) {}

    try {
      const { latencyTrackerInstance } = require('./latencyTracker.js');
      latencyTrackerInstance.record({
        tCancelRequest: t0,
        tCancelAck: Date.now(),
        cancelAckLatencyMs: latencyMs,
        provider: 'emergency_stop_controller'
      });
    } catch (e) {}

    console.warn(`[E_STOP_CONTROLLER] 🛑 EMERGENCY STOP ENGAGED in ${latencyMs}ms. Reason: "${reason}". Streams aborted: ${abortedStreamCount}, Tasks aborted: ${abortedTaskCount}, Tools aborted: ${abortedToolCount}, Processes killed: ${abortedChildProcessCount}.`);

    return {
      success: true,
      engaged: true,
      emergencyStopActive: true,
      reason: this.latchReason,
      timestamp: this.latchTimestamp,
      stopCount: this.stopCount,
      latencyMs,
      abortedStreamCount,
      abortedTaskCount,
      abortedToolCount,
      abortedChildProcessCount,
      cameraState: visionResult.cameraState || { active: false, isLockedEmergencyStop: true },
      ...gateResult
    };
  }

  /**
   * Authoritative Emergency Stop Release:
   * Explicitly clears the safety latch and resets subsystems to standby.
   */
  reset(reason = 'User initiated emergency reset') {
    const t0 = Date.now();
    this.isLatched = false;
    this.latchTimestamp = null;
    this.latchReason = null;
    this.activeStreams.clear();
    this.activeTaskControllers.clear();
    this.activeToolControllers.clear();

    let gateResult = { emergencyStopActive: false };
    try {
      gateResult = permissionGateInstance.resetEmergencyStop();
    } catch (e) {
      console.warn('[E_STOP_CONTROLLER] Warning resetting permission gate:', e.message);
    }

    let visionResult = { cameraState: { active: false, isLockedEmergencyStop: false } };
    try {
      visionResult = visionServiceInstance.resetEmergencyStop();
    } catch (e) {
      console.warn('[E_STOP_CONTROLLER] Warning resetting vision service:', e.message);
    }

    try {
      brainArchitectureEngine.broadcastEvent('sub_security_permissions', 'sub_executive_core', 'EMERGENCY_RESET', {
        reason,
        status: 'STANDBY',
        timestamp: t0
      });
    } catch (e) {}

    // Persist unlatched state to disk
    this._savePersistedState();

    // Signal Python Local Agent to reset latch
    try {
      const http = require('http');
      const req = http.request('http://127.0.0.1:3005/emergency-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 800
      }, () => {});
      req.on('error', () => {});
      req.write(JSON.stringify({ reason }));
      req.end();
    } catch (_) {}

    // Reset WhatsApp service governance without re-triggering any prior staged sends
    try {
      const { whatsappServiceInstance } = require('./desktop/whatsappService.js');
      if (whatsappServiceInstance && typeof whatsappServiceInstance.handleEmergencyReset === 'function') {
        whatsappServiceInstance.handleEmergencyReset();
      }
    } catch (_) {}

    // Invoke registered subsystem reset handlers (voice returns cleanly to DISABLED, never auto-LISTENING)
    for (const [name, handlerFn] of this.resetHandlers.entries()) {
      try {
        Promise.resolve(handlerFn(reason)).catch(() => {});
      } catch (e) {
        console.warn(`[E_STOP_CONTROLLER] Warning in resetHandler (${name}):`, e.message);
      }
    }

    const latencyMs = Date.now() - t0;

    // Record to Cryptographic Audit Trail
    try {
      const { auditTrailEngineInstance, EVENT_TYPES } = require('./audit/auditTrailEngine.js');
      if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
        auditTrailEngineInstance.recordEvent(EVENT_TYPES.EMERGENCY_STOP_RESET, {
          reason,
          latencyMs
        }, {
          tool: 'emergency_stop'
        });
      }
    } catch (_) {}

    try {
      this.emit('RESET', { reason, timestamp: Date.now() });
    } catch (_) {}

    console.log(`[E_STOP_CONTROLLER] 🟢 EMERGENCY STOP RESET in ${latencyMs}ms. System returned to STANDBY.`);

    return {
      success: true,
      engaged: false,
      emergencyStopActive: false,
      timestamp: Date.now(),
      latencyMs,
      cameraState: visionResult.cameraState || { active: false, isLockedEmergencyStop: false },
      ...gateResult
    };
  }

  /**
   * Alias for reset
   */
  disengage(reason = 'User initiated emergency reset') {
    return this.reset(reason);
  }

  release(reason = 'User initiated emergency reset') {
    return this.reset(reason);
  }

  /**
   * Returns current emergency stop status
   */
  isEngaged() {
    return Boolean(this.isLatched || permissionGateInstance.isEmergencyStopActive());
  }

  isHalted() {
    return this.isEngaged();
  }

  isEmergencyStopActive() {
    return this.isEngaged();
  }

  isEmergencyStopped() {
    return this.isEngaged();
  }

  halt(reason = 'Emergency stop invoked') {
    return this.engage(reason);
  }

  triggerEmergencyStop(reason) {
    return this.engage(reason);
  }

  engageEmergencyStop(reason) {
    return this.engage(reason);
  }

  resetEmergencyStop(reason) {
    return this.reset(reason);
  }

  get stopReason() {
    return this.latchReason || 'Global emergency stop active';
  }

  /**
   * Diagnostic status inspection
   */
  getStatus() {
    return {
      emergencyStopActive: this.isEngaged(),
      reason: this.latchReason,
      timestamp: this.latchTimestamp,
      stopCount: this.stopCount,
      activeStreamCount: this.activeStreams.size,
      activeTaskCount: this.activeTaskControllers.size,
      activeChildProcessCount: this.activeChildProcesses.size
    };
  }
}

const emergencyStopControllerInstance = new EmergencyStopController();

module.exports = {
  EmergencyStopController,
  emergencyStopControllerInstance
};
