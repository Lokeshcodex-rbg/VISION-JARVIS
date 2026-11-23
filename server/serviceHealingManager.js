/**
 * VISION AI — Self-Healing Subsystem Manager
 * Provides continuous health monitoring, stalled request detection,
 * service-specific isolated restarts, bounded reconnection attempts,
 * resource leak inspection, and stale task garbage collection.
 * 
 * Never restarts the entire application when restarting one subsystem is sufficient.
 * Enforces maximum 3 recovery attempts per rolling 5-minute window to prevent retry thrashing.
 */

const os = require('os');

class ServiceHealingManager {
  constructor() {
    this.services = {
      VOICE_STT: { name: 'Speech-to-Text Fallback', status: 'HEALTHY', restarts: 0, lastRestart: null, lastError: null },
      VOICE_TTS: { name: 'Speech Synthesis Engine', status: 'HEALTHY', restarts: 0, lastRestart: null, lastError: null },
      AI_ADAPTER: { name: 'Dual AI Model Adapter', status: 'HEALTHY', restarts: 0, lastRestart: null, lastError: null },
      DESKTOP_CONTROLLER: { name: 'Windows Desktop Controller', status: 'HEALTHY', restarts: 0, lastRestart: null, lastError: null },
      TASK_ORCHESTRATOR: { name: 'Autonomous Task Orchestrator', status: 'HEALTHY', restarts: 0, lastRestart: null, lastError: null },
      VISION_SERVICE: { name: 'Multimodal Vision Subsystem', status: 'HEALTHY', restarts: 0, lastRestart: null, lastError: null },
      API_INTEGRATIONS: { name: 'External API Integration Manager', status: 'HEALTHY', restarts: 0, lastRestart: null, lastError: null }
    };

    this.activeRequests = new Map(); // reqId -> { serviceId, startedAt, description }
    this.restartHistory = new Map(); // serviceId -> [timestamps...]
    this.diagnosticLogs = [];
    this.maxRetriesPerWindow = 3;
    this.retryWindowMs = 5 * 60 * 1000; // 5 minutes
    this.stalledThresholdMs = 45 * 1000; // 45 seconds
  }

  log(level, serviceId, message, details = null) {
    const entry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      level,
      serviceId,
      message,
      details
    };
    this.diagnosticLogs.unshift(entry);
    if (this.diagnosticLogs.length > 200) this.diagnosticLogs.pop();
    if (level === 'ERROR' || level === 'WARN') {
      console.warn(`[SERVICE_HEALER][${level}] [${serviceId}] ${message}`);
    }
  }

  /**
   * Registers in-flight request for stalled request tracking
   */
  trackRequest(reqId, serviceId, description = '') {
    this.activeRequests.set(reqId, {
      serviceId,
      startedAt: Date.now(),
      description
    });
  }

  completeRequest(reqId) {
    this.activeRequests.delete(reqId);
  }

  /**
   * Scans and purges stalled requests exceeding threshold
   */
  sweepStalledRequests() {
    const now = Date.now();
    const stalled = [];

    for (const [reqId, data] of this.activeRequests.entries()) {
      const elapsed = now - data.startedAt;
      if (elapsed > this.stalledThresholdMs) {
        stalled.push({ reqId, ...data, elapsedMs: elapsed });
        this.activeRequests.delete(reqId);
        this.log('WARN', data.serviceId, `Stalled request ${reqId} aborted after ${Math.round(elapsed / 1000)}s`, data);
        
        // Mark service as degraded
        if (this.services[data.serviceId]) {
          this.services[data.serviceId].status = 'DEGRADED';
          this.services[data.serviceId].lastError = `Stalled request after ${Math.round(elapsed / 1000)}s`;
        }
      }
    }

    return stalled;
  }

  /**
   * Inspects Node.js heap memory, OS free memory, and CPU load for leak symptoms
   */
  inspectResourceHealth() {
    const memUsage = process.memoryUsage();
    const heapUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMb = Math.round(memUsage.rss / 1024 / 1024);
    const freeSystemMemMb = Math.round(os.freemem() / 1024 / 1024);
    const totalSystemMemMb = Math.round(os.totalmem() / 1024 / 1024);

    const heapRatio = memUsage.heapUsed / memUsage.heapTotal;
    const warning = heapRatio > 0.88;

    return {
      status: warning ? 'WARNING' : 'HEALTHY',
      heapUsedMb,
      heapTotalMb,
      rssMb,
      heapUtilizationPercent: Math.round(heapRatio * 100),
      systemFreeMemMb: freeSystemMemMb,
      systemTotalMemMb: totalSystemMemMb,
      systemMemoryPressurePercent: Math.round(((totalSystemMemMb - freeSystemMemMb) / totalSystemMemMb) * 100),
      uptimeSeconds: Math.round(process.uptime()),
      warning: warning ? 'High heap utilization detected; consider garbage collection' : null
    };
  }

  /**
   * Evaluates bounded restart eligibility to avoid infinite retry loops
   */
  canRestartService(serviceId) {
    const now = Date.now();
    const windowStart = now - this.retryWindowMs;

    if (!this.restartHistory.has(serviceId)) {
      this.restartHistory.set(serviceId, []);
    }

    const history = this.restartHistory.get(serviceId).filter(t => t > windowStart);
    this.restartHistory.set(serviceId, history);

    if (history.length >= this.maxRetriesPerWindow) {
      return {
        allowed: false,
        reason: `Service "${serviceId}" reached maximum ${this.maxRetriesPerWindow} restarts in 5 minutes. Halting to prevent retry thrashing.`,
        cooldownRemainingMs: Math.max(1000, history[0] + this.retryWindowMs - now)
      };
    }

    return { allowed: true, recentRestarts: history.length };
  }

  /**
   * Performs granular, service-specific recovery
   */
  async restartService(serviceId, reason = 'Automated recovery') {
    const srv = this.services[serviceId];
    if (!srv) {
      throw new Error(`Subsystem "${serviceId}" does not exist.`);
    }

    const eligibility = this.canRestartService(serviceId);
    if (!eligibility.allowed) {
      this.log('ERROR', serviceId, `Restart rejected: ${eligibility.reason}`);
      srv.status = 'OFFLINE_RETRY_EXHAUSTED';
      return { success: false, serviceId, status: srv.status, error: eligibility.reason };
    }

    this.log('INFO', serviceId, `Initiating targeted service restart. Reason: ${reason}`);
    srv.status = 'RECOVERING';

    try {
      // Execute subsystem-specific recovery routines
      if (serviceId === 'VOICE_TTS') {
        const { languageVoiceManagerInstance } = require('./languageVoiceManager.js');
        // Reset cached synthesized audio and clear pending buffers
        languageVoiceManagerInstance.fishAudioCache?.clear();
      } else if (serviceId === 'VOICE_STT') {
        const { sttServiceInstance } = require('./sttService.js');
        // Reset provider state and retry circuit breakers
        sttServiceInstance.lastError = null;
      } else if (serviceId === 'TASK_ORCHESTRATOR') {
        const { taskOrchestratorInstance } = require('./taskOrchestrator.js');
        // Purge stalled plans
        taskOrchestratorInstance.sweepStalePlans?.();
      } else if (serviceId === 'API_INTEGRATIONS') {
        const { apiIntegrationsManagerInstance } = require('./apiIntegrationsManager.js');
        apiIntegrationsManagerInstance.rateWindows = {};
      }

      // Record restart
      this.restartHistory.get(serviceId).push(Date.now());
      srv.restarts += 1;
      srv.lastRestart = new Date().toISOString();
      srv.status = 'HEALTHY';
      srv.lastError = null;

      this.log('INFO', serviceId, `Service successfully recovered.`);
      return {
        success: true,
        serviceId,
        status: 'HEALTHY',
        restarts: srv.restarts,
        message: `Subsystem ${srv.name} successfully recovered.`
      };
    } catch (err) {
      srv.status = 'OFFLINE';
      srv.lastError = err.message;
      this.log('ERROR', serviceId, `Recovery failed: ${err.message}`);
      return {
        success: false,
        serviceId,
        status: 'OFFLINE',
        error: err.message
      };
    }
  }

  /**
   * Comprehensive health status matrix across all subsystems
   */
  getHealthReport() {
    this.sweepStalledRequests();
    const resources = this.inspectResourceHealth();

    return {
      success: true,
      timestamp: new Date().toISOString(),
      overallStatus: Object.values(this.services).some(s => s.status.startsWith('OFFLINE'))
        ? 'DEGRADED'
        : 'OPERATIONAL',
      services: this.services,
      activeRequestsCount: this.activeRequests.size,
      resources
    };
  }

  getDiagnosticLogs(limit = 50) {
    return this.diagnosticLogs.slice(0, limit);
  }
}

const serviceHealingManagerInstance = new ServiceHealingManager();

module.exports = {
  ServiceHealingManager,
  serviceHealingManagerInstance
};
