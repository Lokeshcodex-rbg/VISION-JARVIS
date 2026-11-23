/**
 * VISION AI — Central Experience Learning Engine
 * 
 * Collects, indexes, and analyzes structured task execution experiences to empower
 * autonomous learning across successful outcomes, failures, recoveries, and user corrections.
 * 
 * Strict Invariants:
 * 1. Distinguishes actual learning from simply storing conversations.
 * 2. Never treats an AI-generated completion statement as verified success.
 * 3. Categorizes outcomes: VERIFIED_SUCCESS, REPORTED_SUCCESS, PARTIAL_SUCCESS, FAILURE, CANCELLED, USER_CORRECTED.
 * 4. Connects to 8-layer memory: experiences in 'episodic', proofs in 'evidence'.
 * 5. Classifies failures and tracks root causes, failure frequencies, and recovery effectiveness.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { starkMemoryDbInstance } = require('../memory/starkMemoryDb.js');
const { auditTrailEngineInstance, EVENT_TYPES } = require('../audit/auditTrailEngine.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const LEARNING_DATA_DIR = path.join(PROJECT_ROOT, 'data', 'learning');
if (!fs.existsSync(LEARNING_DATA_DIR)) {
  fs.mkdirSync(LEARNING_DATA_DIR, { recursive: true });
}

// Authoritative Outcome Classifications
const TASK_OUTCOMES = {
  VERIFIED_SUCCESS: 'VERIFIED_SUCCESS', // Empirical side-effects verified by independentVerifier
  REPORTED_SUCCESS: 'REPORTED_SUCCESS', // Model/tool reported success without external verification
  PARTIAL_SUCCESS: 'PARTIAL_SUCCESS',   // Some nodes succeeded, but overall goal was incomplete
  FAILURE: 'FAILURE',                   // Unhandled error or explicit execution failure
  CANCELLED: 'CANCELLED',               // Aborted by user or task orchestrator
  USER_CORRECTED: 'USER_CORRECTED'      // Initial result was rejected/corrected by user feedback
};

// Standardized Error Classifications for Failure Diagnosis
const ERROR_TAXONOMIES = {
  TIMEOUT: 'TIMEOUT',
  FOCUS_LOSS: 'FOCUS_LOSS',
  ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  NETWORK_DELAY: 'NETWORK_DELAY',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  RESOURCE_BUSY: 'RESOURCE_BUSY',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

class ExperienceLearningEngine {
  constructor(options = {}) {
    this.memoryDb = options.memoryDb || starkMemoryDbInstance;
    this.auditTrail = options.auditTrail || auditTrailEngineInstance;
    this.emergencyStop = options.emergencyStop || emergencyStopControllerInstance;
    this.experiencesPath = path.join(LEARNING_DATA_DIR, 'experiences_index.json');
    this.failureStatsPath = path.join(LEARNING_DATA_DIR, 'failure_taxonomy.json');
    this.experiences = new Map(); // id -> experienceRecord
    this.failureTaxonomy = new Map(); // rootCauseKey -> { count, recoveryAttempts, successCount, lastSeen }
    this.agentStats = new Map(); // agentId -> { runs, verified, failed, avgDurationMs }
    this.toolReliability = new Map(); // toolName -> { totalCalls, successes, failures }
    this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(this.experiencesPath)) {
        const raw = fs.readFileSync(this.experiencesPath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const exp of list) {
            this.experiences.set(exp.experienceId, exp);
          }
        }
      }
      if (fs.existsSync(this.failureStatsPath)) {
        const raw = fs.readFileSync(this.failureStatsPath, 'utf8');
        const data = JSON.parse(raw);
        if (typeof data === 'object') {
          for (const [k, v] of Object.entries(data)) {
            this.failureTaxonomy.set(k, v);
          }
        }
      }
    } catch (_) {}
  }

  saveState() {
    try {
      const expList = Array.from(this.experiences.values()).slice(-2000); // Retain recent index in JSON, full in SQLite
      fs.writeFileSync(this.experiencesPath, JSON.stringify(expList, null, 2), 'utf8');
      
      const failObj = {};
      for (const [k, v] of this.failureTaxonomy.entries()) {
        failObj[k] = v;
      }
      fs.writeFileSync(this.failureStatsPath, JSON.stringify(failObj, null, 2), 'utf8');
    } catch (_) {}
  }

  /**
   * Computes an experience content signature for duplicate detection
   */
  computeSignature(objective, category, executionSequence) {
    const normObj = String(objective || '').trim().toLowerCase();
    const normCat = String(category || '').trim().toLowerCase();
    const seqStr = Array.isArray(executionSequence)
      ? executionSequence.map(s => `${s.tool || s.toolName}:${s.status}`).join('->')
      : String(executionSequence || '');
    return crypto.createHash('sha256').update(`${normObj}|${normCat}|${seqStr}`).digest('hex').slice(0, 16);
  }

  /**
   * Records a structured task execution experience.
   * Enforces the 16-attribute schema and outcome classification.
   */
  recordExperience(data = {}) {
    if (this.emergencyStop && this.emergencyStop.isEmergencyStopped()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Experience recording blocked during emergency stop.');
    }

    const now = new Date().toISOString();
    const objective = String(data.taskObjective || data.objective || 'Unknown Objective').trim();
    const category = String(data.taskCategory || data.category || 'general').trim();
    const originalPlan = data.originalPlan || [];
    const executionSequence = Array.isArray(data.actualExecutionSequence || data.executionSequence)
      ? (data.actualExecutionSequence || data.executionSequence)
      : [];
    const toolsUsed = Array.isArray(data.toolsUsed)
      ? data.toolsUsed
      : executionSequence.map(s => s.tool || s.toolName).filter(Boolean);
    const agentInvolved = String(data.agentInvolved || data.agentId || 'planning_agent');
    const durationMs = Number(data.durationMs || data.duration || 0);
    const permissionLevel = Number(data.permissionLevel !== undefined ? data.permissionLevel : 2);
    const userFeedback = data.userFeedback || null;
    const errorsEncountered = Array.isArray(data.errorsEncountered) ? data.errorsEncountered : (data.error ? [data.error] : []);
    const recoveryAttempts = Array.isArray(data.recoveryAttempts) ? data.recoveryAttempts : [];
    const successfulRecoveryMethod = data.successfulRecoveryMethod || null;
    const provenance = data.provenance || 'stark_execution_engine';
    const confidence = typeof data.confidence === 'number' ? data.confidence : 1.0;

    // Strict Outcome Classification: Never treat an unverified AI claim as VERIFIED_SUCCESS
    let taskOutcome = data.taskOutcome || TASK_OUTCOMES.REPORTED_SUCCESS;
    const verificationEvidence = data.verificationEvidence || data.verification || null;

    if (userFeedback && (userFeedback.isNegative || userFeedback.correction)) {
      taskOutcome = TASK_OUTCOMES.USER_CORRECTED;
    } else if (data.cancelled || data.taskOutcome === TASK_OUTCOMES.CANCELLED) {
      taskOutcome = TASK_OUTCOMES.CANCELLED;
    } else if (data.isPartial || data.taskOutcome === TASK_OUTCOMES.PARTIAL_SUCCESS) {
      taskOutcome = TASK_OUTCOMES.PARTIAL_SUCCESS;
    } else if (errorsEncountered.length > 0 && !successfulRecoveryMethod) {
      taskOutcome = TASK_OUTCOMES.FAILURE;
    } else if (verificationEvidence && (verificationEvidence.verified === true || verificationEvidence.status === 'SUCCESS')) {
      taskOutcome = TASK_OUTCOMES.VERIFIED_SUCCESS;
    } else if (taskOutcome === TASK_OUTCOMES.VERIFIED_SUCCESS && (!verificationEvidence || !verificationEvidence.verified)) {
      // Demote unsupported claim of verified success to reported success
      taskOutcome = TASK_OUTCOMES.REPORTED_SUCCESS;
    }

    const signature = this.computeSignature(objective, category, executionSequence);

    // Duplicate detection: Check if exact experience already exists
    let existingId = null;
    for (const [id, exp] of this.experiences.entries()) {
      if (exp.signature === signature && exp.taskOutcome === taskOutcome) {
        existingId = id;
        break;
      }
    }

    let experienceId;
    let recurrenceCount = 1;

    if (existingId) {
      // Update recurrence without creating duplicate row
      const existing = this.experiences.get(existingId);
      existing.recurrenceCount = (existing.recurrenceCount || 1) + 1;
      existing.lastRecurrenceAt = now;
      existing.durationMs = Math.round((existing.durationMs + durationMs) / 2);
      experienceId = existingId;
      recurrenceCount = existing.recurrenceCount;
    } else {
      experienceId = data.experienceId || `exp_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
      const record = {
        experienceId,
        signature,
        taskObjective: objective,
        taskCategory: category,
        originalPlan,
        actualExecutionSequence: executionSequence,
        toolsUsed,
        agentInvolved,
        taskOutcome,
        verificationEvidence,
        errorsEncountered,
        recoveryAttempts,
        successfulRecoveryMethod,
        durationMs,
        permissionLevel,
        userFeedback,
        confidence,
        provenance,
        timestamp: now,
        recurrenceCount: 1,
        lastRecurrenceAt: now
      };
      this.experiences.set(experienceId, record);
    }

    // Update Failure Taxonomy & Learning Stats if failures were recorded
    if (errorsEncountered.length > 0) {
      this.classifyAndTrackFailures({
        objective,
        category,
        toolsUsed,
        errors: errorsEncountered,
        recoveryAttempts,
        successfulRecoveryMethod,
        taskOutcome
      });
    }

    // Update Agent Performance Statistics
    this.updateAgentStats(agentInvolved, taskOutcome, durationMs);

    // Update Tool Reliability Statistics
    this.updateToolReliability(toolsUsed, taskOutcome, errorsEncountered);

    // Persist to 8-Layer Memory Database (Episodic + Evidence layers)
    if (this.memoryDb) {
      try {
        const factText = `[Experience: ${taskOutcome}] Objective: "${objective}" | Tools: [${toolsUsed.join(', ')}] | Duration: ${durationMs}ms`;
        this.memoryDb.saveMemory(
          factText,
          `experience_${category}`,
          taskOutcome === TASK_OUTCOMES.VERIFIED_SUCCESS ? 'VERIFIED_FACT' : 'CLAIM',
          provenance,
          confidence
        );

        if (verificationEvidence && taskOutcome === TASK_OUTCOMES.VERIFIED_SUCCESS) {
          const proofFact = `[Verification Evidence for ${experienceId}] Method: ${verificationEvidence.verificationMethod || 'INDEPENDENT_AST'} | SHA-256: ${verificationEvidence.sha256 || 'N/A'}`;
          this.memoryDb.insertMemory({
            id: `evid_${experienceId}`,
            fact: proofFact,
            category: 'evidence_proof',
            epistemicType: 'VERIFIED_FACT',
            source: 'independent_verifier',
            memoryLayer: 'evidence',
            metadata: { experienceId, verificationEvidence }
          });
        }
      } catch (_) {}
    }

    // Record in Tamper-Evident Audit Trail
    if (this.auditTrail && typeof this.auditTrail.recordEvent === 'function') {
      try {
        this.auditTrail.recordEvent('EXPERIENCE_RECORDED', {
          experienceId,
          objective,
          taskOutcome,
          agentInvolved,
          toolsCount: toolsUsed.length,
          recurrenceCount
        }, { tool: 'experience_learning_engine' });
      } catch (_) {}
    }

    this.saveState();

    return {
      experienceId,
      signature,
      taskOutcome,
      recurrenceCount,
      isDuplicate: Boolean(existingId),
      verified: (taskOutcome === TASK_OUTCOMES.VERIFIED_SUCCESS)
    };
  }

  /**
   * Failure diagnosis and root-cause clustering
   */
  classifyAndTrackFailures(context = {}) {
    const { category, toolsUsed, errors = [], recoveryAttempts = [], successfulRecoveryMethod, taskOutcome } = context;

    for (const rawErr of errors) {
      const errStr = typeof rawErr === 'object' ? (rawErr.message || JSON.stringify(rawErr)) : String(rawErr || '');
      const taxonomy = this.diagnoseErrorTaxonomy(errStr);
      const primaryTool = (toolsUsed && toolsUsed[0]) || 'general';
      const rootCauseKey = `${primaryTool}:${taxonomy}`;

      const existing = this.failureTaxonomy.get(rootCauseKey) || {
        rootCauseKey,
        primaryTool,
        taxonomy,
        category,
        sampleError: errStr.slice(0, 200),
        frequency: 0,
        recoveryAttemptsCount: 0,
        successfulRecoveries: 0,
        successfulRecoveryMethods: {},
        lastSeenAt: null
      };

      existing.frequency += 1;
      existing.lastSeenAt = new Date().toISOString();
      if (recoveryAttempts.length > 0) {
        existing.recoveryAttemptsCount += recoveryAttempts.length;
      }
      if (successfulRecoveryMethod) {
        existing.successfulRecoveries += 1;
        existing.successfulRecoveryMethods[successfulRecoveryMethod] =
          (existing.successfulRecoveryMethods[successfulRecoveryMethod] || 0) + 1;
      }

      this.failureTaxonomy.set(rootCauseKey, existing);
    }
  }

  /**
   * Diagnostic classifier mapping raw error messages to structured root causes
   */
  diagnoseErrorTaxonomy(errStr = '') {
    const s = String(errStr).toLowerCase();
    if (s.includes('timeout') || s.includes('timed out') || s.includes('etimedout')) return ERROR_TAXONOMIES.TIMEOUT;
    if (s.includes('focus') || s.includes('foreground') || s.includes('active window')) return ERROR_TAXONOMIES.FOCUS_LOSS;
    if (s.includes('not found') && (s.includes('element') || s.includes('control') || s.includes('selector'))) return ERROR_TAXONOMIES.ELEMENT_NOT_FOUND;
    if (s.includes('syntax') || s.includes('unexpected token') || s.includes('parse error')) return ERROR_TAXONOMIES.SYNTAX_ERROR;
    if (s.includes('network') || s.includes('connection') || s.includes('econnrefused')) return ERROR_TAXONOMIES.NETWORK_DELAY;
    if (s.includes('permission') || s.includes('eacces') || s.includes('unauthorized') || s.includes('prohibited')) return ERROR_TAXONOMIES.PERMISSION_DENIED;
    if (s.includes('verification') || s.includes('ast mismatch') || s.includes('hash mismatch')) return ERROR_TAXONOMIES.VERIFICATION_FAILED;
    if (s.includes('enoent') || s.includes('file not found')) return ERROR_TAXONOMIES.FILE_NOT_FOUND;
    if (s.includes('ebusy') || s.includes('locked') || s.includes('resource busy')) return ERROR_TAXONOMIES.RESOURCE_BUSY;
    return ERROR_TAXONOMIES.UNKNOWN_ERROR;
  }

  updateAgentStats(agentId, outcome, durationMs) {
    const stats = this.agentStats.get(agentId) || {
      agentId,
      totalRuns: 0,
      verifiedSuccesses: 0,
      failures: 0,
      totalDurationMs: 0
    };
    stats.totalRuns++;
    stats.totalDurationMs += durationMs;
    if (outcome === TASK_OUTCOMES.VERIFIED_SUCCESS) stats.verifiedSuccesses++;
    if (outcome === TASK_OUTCOMES.FAILURE) stats.failures++;
    this.agentStats.set(agentId, stats);
  }

  updateToolReliability(tools = [], outcome, errors = []) {
    for (const tool of tools) {
      const stats = this.toolReliability.get(tool) || { tool, calls: 0, successes: 0, failures: 0 };
      stats.calls++;
      if (outcome === TASK_OUTCOMES.VERIFIED_SUCCESS || outcome === TASK_OUTCOMES.REPORTED_SUCCESS) {
        stats.successes++;
      } else if (outcome === TASK_OUTCOMES.FAILURE || errors.length > 0) {
        stats.failures++;
      }
      this.toolReliability.set(tool, stats);
    }
  }

  /**
   * Retrieves historical experiences matching a target objective or category
   */
  retrieveSimilarExperiences(query, options = {}) {
    const { category = null, limit = 5, verifiedOnly = false } = options;
    const qNorm = String(query || '').trim().toLowerCase();
    const tokens = qNorm.split(/\s+/).filter(t => t.length > 2);

    const candidates = [];
    for (const exp of this.experiences.values()) {
      if (category && exp.taskCategory.toLowerCase() !== category.toLowerCase()) continue;
      if (verifiedOnly && exp.taskOutcome !== TASK_OUTCOMES.VERIFIED_SUCCESS) continue;

      let score = 0;
      const expObj = exp.taskObjective.toLowerCase();
      if (expObj === qNorm) score += 1.0;
      else if (expObj.includes(qNorm)) score += 0.6;

      for (const tok of tokens) {
        if (expObj.includes(tok)) score += (0.4 / tokens.length);
      }

      if (exp.taskOutcome === TASK_OUTCOMES.VERIFIED_SUCCESS) score += 0.2;
      if (score > 0.1) {
        candidates.push({ ...exp, matchScore: Math.round(score * 100) / 100 });
      }
    }

    candidates.sort((a, b) => b.matchScore - a.matchScore);
    return candidates.slice(0, limit);
  }

  /**
   * Evaluates the best recovery strategy for a given failure root-cause key
   */
  getBestRecoveryStrategy(rootCauseKey) {
    const stat = this.failureTaxonomy.get(rootCauseKey);
    let bestMethod = null;
    let maxSuccess = 0;
    if (stat && stat.successfulRecoveryMethods) {
      for (const [method, count] of Object.entries(stat.successfulRecoveryMethods)) {
        if (count > maxSuccess) {
          maxSuccess = count;
          bestMethod = method;
        }
      }
    }

    if (bestMethod) return bestMethod;

    // Default heuristic based on taxonomy
    if (rootCauseKey.includes(ERROR_TAXONOMIES.FOCUS_LOSS)) return 'RESTORE_FOCUS';
    if (rootCauseKey.includes(ERROR_TAXONOMIES.TIMEOUT)) return 'INCREASE_WAIT_TIMEOUT';
    if (rootCauseKey.includes(ERROR_TAXONOMIES.RESOURCE_BUSY)) return 'WAIT_AND_RETRY';
    return 'FALLBACK_ALTERNATIVE_TOOL';
  }

  /**
   * Returns a comprehensive failure diagnosis report
   */
  getFailureAnalysisReport() {
    const rootCauses = Array.from(this.failureTaxonomy.values());
    rootCauses.sort((a, b) => b.frequency - a.frequency);

    return {
      totalFailuresTracked: rootCauses.reduce((acc, c) => acc + c.frequency, 0),
      distinctRootCausesCount: rootCauses.length,
      topRootCauses: rootCauses.slice(0, 10),
      frequentlyFailingTools: Array.from(this.toolReliability.values())
        .filter(t => t.failures > 0)
        .sort((a, b) => (b.failures / b.calls) - (a.failures / a.calls))
        .slice(0, 5)
    };
  }

  getExperienceById(id) {
    return this.experiences.get(id) || null;
  }

  queryExperiences(filter = {}) {
    if (typeof filter === 'string') {
      return this.retrieveSimilarExperiences(filter);
    }
    const { query, category, limit, verifiedOnly } = filter;
    if (query) {
      return this.retrieveSimilarExperiences(query, { category, limit, verifiedOnly });
    }
    let results = this.getAllExperiences();
    if (category) {
      results = results.filter(e => e.taskCategory.toLowerCase() === category.toLowerCase());
    }
    if (verifiedOnly) {
      results = results.filter(e => e.taskOutcome === TASK_OUTCOMES.VERIFIED_SUCCESS);
    }
    return results.slice(0, limit || 20);
  }

  getAllExperiences() {
    return Array.from(this.experiences.values());
  }

  clear() {
    this.experiences.clear();
    this.failureTaxonomy.clear();
    this.agentStats.clear();
    this.toolReliability.clear();
    this.saveState();
  }
}

const experienceLearningEngineInstance = new ExperienceLearningEngine();

module.exports = {
  ExperienceLearningEngine,
  experienceLearningEngineInstance,
  TASK_OUTCOMES,
  ERROR_TAXONOMIES
};
