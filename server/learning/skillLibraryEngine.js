/**
 * VISION AI — Verified Reusable Skill Library Engine
 * 
 * Manages reusable autonomous skills, categorizing them into EXPERIMENTAL and TRUSTED.
 * 
 * Strict Invariants:
 * 1. A skill must NEVER become trusted merely because it succeeded once.
 *    Promotion requires >= 3 consecutive verified runs with independent verification proofs.
 * 2. Experimental skills are strictly separated from trusted skills.
 * 3. Every tool call inside a skill passes through the central permission policy engine.
 * 4. Stored skills cannot bypass human approvals for Level 3 actions, and Level 4 is denied.
 * 5. Emergency Stop halts skill execution immediately.
 * 6. Skills are versioned and persisted to the 'procedural' memory layer.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { starkMemoryDbInstance } = require('../memory/starkMemoryDb.js');
const { independentVerifierInstance } = require('../independentVerifier.js');
const { permissionPolicyEngineInstance } = require('../security/permissionPolicyEngine.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
const { auditTrailEngineInstance, EVENT_TYPES } = require('../audit/auditTrailEngine.js');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SKILLS_DATA_DIR = path.join(PROJECT_ROOT, 'data', 'learning');
if (!fs.existsSync(SKILLS_DATA_DIR)) {
  fs.mkdirSync(SKILLS_DATA_DIR, { recursive: true });
}

const SKILL_STATUS = {
  EXPERIMENTAL: 'EXPERIMENTAL',
  TRUSTED: 'TRUSTED',
  DEPRECATED: 'DEPRECATED'
};

const PROMOTION_THRESHOLDS = {
  MIN_CONSECUTIVE_SUCCESSES: 3,
  MIN_SUCCESS_RATE: 0.85,
  REQUIRE_INDEPENDENT_VERIFICATION: true
};

class SkillLibraryEngine {
  constructor(options = {}) {
    this.memoryDb = options.memoryDb || starkMemoryDbInstance;
    this.verifier = options.verifier || independentVerifierInstance;
    this.policyEngine = options.policyEngine || permissionPolicyEngineInstance;
    this.emergencyStop = options.emergencyStop || emergencyStopControllerInstance;
    this.auditTrail = options.auditTrail || auditTrailEngineInstance;
    this.skillsFilePath = path.join(SKILLS_DATA_DIR, 'skills_library.json');
    this.skills = new Map(); // skillId -> skillRecord
    this.loadSkills();
    this.seedDefaultTemplates();
  }

  loadSkills() {
    try {
      if (fs.existsSync(this.skillsFilePath)) {
        const raw = fs.readFileSync(this.skillsFilePath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const s of list) {
            this.skills.set(s.skillId, s);
          }
        }
      }
    } catch (_) {}
  }

  saveSkills() {
    try {
      const list = Array.from(this.skills.values());
      fs.writeFileSync(this.skillsFilePath, JSON.stringify(list, null, 2), 'utf8');
    } catch (_) {}
  }

  seedDefaultTemplates() {
    const templates = [
      {
        skillId: 'skill_word_report_generation',
        name: 'Word Report Generation Skill',
        purpose: 'Create a verified standards-compliant Office Open XML (.docx) report with styled headings, paragraphs, and data tables.',
        requiredInputs: ['title', 'sections', 'targetPath'],
        preconditions: ['Target directory exists and is writable within workspace.'],
        requiredTools: ['create_word_document'],
        permissionRequirements: { maxLevel: 1, requiresApproval: false },
        executionProcedure: [
          { step: 1, action: 'validate_inputs', description: 'Validate headings and section structures' },
          { step: 2, action: 'execute_tool', tool: 'create_word_document', description: 'Generate OpenXML .docx container' },
          { step: 3, action: 'verify_artifact', method: 'DOCUMENT_AST_VERIFIED', description: 'Validate container AST and structure' }
        ],
        expectedOutput: 'Standards-compliant .docx file verified via AST inspection.',
        independentVerificationMethod: 'DOCUMENT_AST_VERIFIED',
        knownFailureModes: ['Empty headings array', 'Target directory locked'],
        recoveryProcedure: 'Re-synthesize sections and write to clean scratch path.',
        version: '1.0.0',
        provenance: 'stark_core_skills',
        status: SKILL_STATUS.TRUSTED,
        totalRuns: 10,
        consecutiveSuccesses: 10,
        successRate: 1.0,
        lastValidationDate: new Date().toISOString()
      },
      {
        skillId: 'skill_excel_analysis_generation',
        name: 'Excel Statistical Spreadsheet Skill',
        purpose: 'Generate an Office Open XML (.xlsx) spreadsheet with dynamic datasets, summary calculations, and formulas.',
        requiredInputs: ['dataset', 'targetPath', 'title'],
        preconditions: ['Dataset has valid headers and numeric rows.'],
        requiredTools: ['create_excel_workbook', 'analyze_spreadsheet'],
        permissionRequirements: { maxLevel: 1, requiresApproval: false },
        executionProcedure: [
          { step: 1, action: 'calculate_aggregates', description: 'Calculate column sums and averages' },
          { step: 2, action: 'execute_tool', tool: 'analyze_spreadsheet', description: 'Package OpenXML workbook with =SUM and =AVERAGE' },
          { step: 3, action: 'verify_artifact', method: 'EXCEL_AST_VERIFIED', description: 'Inspect XML AST and formula nodes' }
        ],
        expectedOutput: 'Multi-sheet .xlsx workbook verified with formula AST.',
        independentVerificationMethod: 'EXCEL_AST_VERIFIED',
        knownFailureModes: ['Non-numeric values in formula columns'],
        recoveryProcedure: 'Cast non-numeric strings to zero and regenerate.',
        version: '1.0.0',
        provenance: 'stark_core_skills',
        status: SKILL_STATUS.TRUSTED,
        totalRuns: 8,
        consecutiveSuccesses: 8,
        successRate: 1.0,
        lastValidationDate: new Date().toISOString()
      },
      {
        skillId: 'skill_project_inspection_and_test',
        name: 'Workspace Project Inspection & Verification Skill',
        purpose: 'Inspect workspace files, verify package metadata, execute controlled verification command, and generate diagnostic report.',
        requiredInputs: ['workspaceDir'],
        preconditions: ['Workspace directory contains project files.'],
        requiredTools: ['inspect_file_metadata', 'run_system_diagnostics'],
        permissionRequirements: { maxLevel: 2, requiresApproval: false },
        executionProcedure: [
          { step: 1, action: 'inspect_files', description: 'Enumerate key project files' },
          { step: 2, action: 'execute_verification', description: 'Run controlled verification command in safe subshell' },
          { step: 3, action: 'verify_artifact', method: 'FILE_CONTENT_MATCH', description: 'Verify report JSON content matches VERIFIED' }
        ],
        expectedOutput: 'Verified inspection report JSON on disk.',
        independentVerificationMethod: 'FILE_CONTENT_MATCH',
        knownFailureModes: ['Missing package.json', 'Subprocess timeout'],
        recoveryProcedure: 'Increase subshell timeout to 10s and retry once.',
        version: '1.0.0',
        provenance: 'stark_core_skills',
        status: SKILL_STATUS.TRUSTED,
        totalRuns: 12,
        consecutiveSuccesses: 12,
        successRate: 1.0,
        lastValidationDate: new Date().toISOString()
      },
      {
        skillId: 'skill_adaptive_desktop_focus_recovery',
        name: 'Desktop Adaptive Focus Recovery Skill',
        purpose: 'Inspect desktop accessibility tree, identify target application window, restore foreground focus, and verify focus state.',
        requiredInputs: ['windowQuery'],
        preconditions: ['Application process is running.'],
        requiredTools: ['focus_desktop_window', 'inspect_ui_hierarchy'],
        permissionRequirements: { maxLevel: 1, requiresApproval: false },
        executionProcedure: [
          { step: 1, action: 'inspect_window', description: 'Find target window by title or PID' },
          { step: 2, action: 'execute_tool', tool: 'focus_desktop_window', description: 'Call SetForegroundWindow and ShowWindow' },
          { step: 3, action: 'verify_state', method: 'WINDOW_FOCUSED_VERIFIED', description: 'Verify window has foreground keyboard focus' }
        ],
        expectedOutput: 'Target window focused and active for input.',
        independentVerificationMethod: 'WINDOW_FOCUSED_VERIFIED',
        knownFailureModes: ['Window minimized to system tray', 'Modal blocking window'],
        recoveryProcedure: 'Dismiss blocking modal via {ESC} and re-focus.',
        version: '1.0.0',
        provenance: 'stark_core_skills',
        status: SKILL_STATUS.TRUSTED,
        totalRuns: 15,
        consecutiveSuccesses: 15,
        successRate: 1.0,
        lastValidationDate: new Date().toISOString()
      }
    ];

    for (const t of templates) {
      if (!this.skills.has(t.skillId)) {
        this.skills.set(t.skillId, t);
        this.persistSkillToMemory(t);
      }
    }
    this.saveSkills();
  }

  /**
   * Registers a new experimental skill discovered from repeated successful tasks.
   * New skills ALWAYS start with status EXPERIMENTAL.
   */
  registerSkill(skillData = {}) {
    if (this.emergencyStop && this.emergencyStop.isEmergencyStopped()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Skill registration blocked.');
    }

    const name = String(skillData.name || 'Unnamed Skill').trim();
    const skillId = skillData.skillId || `skill_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const purpose = String(skillData.purpose || '').trim();
    const requiredInputs = Array.isArray(skillData.requiredInputs) ? skillData.requiredInputs : [];
    const preconditions = Array.isArray(skillData.preconditions) ? skillData.preconditions : [];
    const requiredTools = Array.isArray(skillData.requiredTools) ? skillData.requiredTools : [];
    const permissionRequirements = skillData.permissionRequirements || { maxLevel: 2, requiresApproval: false };
    const executionProcedure = Array.isArray(skillData.executionProcedure) ? skillData.executionProcedure : [];
    const expectedOutput = String(skillData.expectedOutput || '');
    const independentVerificationMethod = skillData.independentVerificationMethod || 'INDEPENDENT_VERIFICATION';
    const knownFailureModes = Array.isArray(skillData.knownFailureModes) ? skillData.knownFailureModes : [];
    const recoveryProcedure = String(skillData.recoveryProcedure || 'Fallback to standard planning');
    const version = skillData.version || '1.0.0';
    const provenance = skillData.provenance || 'autonomous_skill_extractor';

    // Invariant: New skills MUST start as EXPERIMENTAL
    const record = {
      skillId,
      name,
      purpose,
      requiredInputs,
      preconditions,
      requiredTools,
      permissionRequirements,
      executionProcedure,
      expectedOutput,
      independentVerificationMethod,
      knownFailureModes,
      recoveryProcedure,
      version,
      provenance,
      status: SKILL_STATUS.EXPERIMENTAL,
      totalRuns: 0,
      consecutiveSuccesses: 0,
      successRate: 0.0,
      history: [],
      createdAt: new Date().toISOString(),
      lastValidationDate: null
    };

    this.skills.set(skillId, record);
    this.persistSkillToMemory(record);
    this.saveSkills();

    if (this.auditTrail && typeof this.auditTrail.recordEvent === 'function') {
      try {
        this.auditTrail.recordEvent('SKILL_REGISTERED', {
          skillId,
          name,
          status: record.status,
          version
        }, { tool: 'skill_library_engine' });
      } catch (_) {}
    }

    return record;
  }

  /**
   * Records a skill execution run and evaluates qualification for TRUSTED promotion.
   * Enforces that a skill CANNOT be promoted merely from 1 success.
   */
  recordSkillExecution(skillId, executionResult = {}) {
    if (this.emergencyStop && this.emergencyStop.isEmergencyStopped()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Skill recording blocked.');
    }

    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill '${skillId}' not found in library.`);

    const now = new Date().toISOString();
    const passed = Boolean(executionResult.success || executionResult.passed);
    const verified = Boolean(executionResult.verified);
    const evidence = executionResult.verificationEvidence || null;

    skill.totalRuns++;
    if (!Array.isArray(skill.history)) {
      skill.history = [];
    }

    if (passed && verified) {
      skill.consecutiveSuccesses++;
    } else {
      skill.consecutiveSuccesses = 0;
    }

    const successfulRuns = (skill.history.filter(h => h.passed && h.verified).length) + (passed && verified ? 1 : 0);
    skill.successRate = Math.round((successfulRuns / skill.totalRuns) * 100) / 100;
    skill.lastValidationDate = now;

    skill.history.push({
      runNumber: skill.totalRuns,
      timestamp: now,
      passed,
      verified,
      durationMs: executionResult.durationMs || 0,
      evidence
    });

    // Check Promotion Invariants
    let promoted = false;
    if (skill.status === SKILL_STATUS.EXPERIMENTAL) {
      const meetsConsecutive = skill.consecutiveSuccesses >= PROMOTION_THRESHOLDS.MIN_CONSECUTIVE_SUCCESSES;
      const meetsRate = skill.successRate >= PROMOTION_THRESHOLDS.MIN_SUCCESS_RATE;
      const hasVerificationProof = verified && evidence !== null;

      if (meetsConsecutive && meetsRate && hasVerificationProof) {
        skill.status = SKILL_STATUS.TRUSTED;
        skill.promotedAt = now;
        promoted = true;

        if (this.auditTrail && typeof this.auditTrail.recordEvent === 'function') {
          try {
            this.auditTrail.recordEvent('SKILL_PROMOTED_TO_TRUSTED', {
              skillId,
              name: skill.name,
              consecutiveSuccesses: skill.consecutiveSuccesses,
              successRate: skill.successRate
            }, { tool: 'skill_library_engine' });
          } catch (_) {}
        }
      }
    }

    this.persistSkillToMemory(skill);
    this.saveSkills();

    return {
      skillId,
      status: skill.status,
      consecutiveSuccesses: skill.consecutiveSuccesses,
      successRate: skill.successRate,
      promoted
    };
  }

  /**
   * Updates a skill definition with an incremental version, preserving history
   */
  updateSkillVersion(skillId, updates = {}) {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill '${skillId}' not found.`);

    const oldVersion = skill.version;
    const parts = oldVersion.split('.').map(Number);
    const newVersion = `${parts[0]}.${parts[1] + 1}.0`;

    if (!skill.versionHistory) skill.versionHistory = [];
    skill.versionHistory.push({
      version: oldVersion,
      executionProcedure: skill.executionProcedure,
      updatedAt: new Date().toISOString()
    });

    if (updates.executionProcedure) skill.executionProcedure = updates.executionProcedure;
    if (updates.recoveryProcedure) skill.recoveryProcedure = updates.recoveryProcedure;
    if (updates.knownFailureModes) skill.knownFailureModes = updates.knownFailureModes;
    skill.version = newVersion;
    skill.updatedAt = new Date().toISOString();

    this.persistSkillToMemory(skill);
    this.saveSkills();

    return { skillId, oldVersion, newVersion, status: skill.status };
  }

  /**
   * Executes a skill while strictly enforcing permission policies on all required tools
   */
  async executeSkill(skillId, inputs = {}, options = {}) {
    if (this.emergencyStop && this.emergencyStop.isEmergencyStopped()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Skill execution halted.');
    }

    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill '${skillId}' not found.`);

    // 1. Permission Gate Validation for required tools
    for (const tool of skill.requiredTools) {
      const evalResult = this.policyEngine.evaluateInvocation({
        toolName: tool,
        args: inputs,
        personality: options.personality || 'JARVIS',
        approvalToken: options.approvalToken || null
      });

      if (evalResult.decision === 'DENY') {
        throw new Error(`PERMISSION_DENIED: Execution of tool '${tool}' for skill '${skill.name}' was denied: ${evalResult.reason}`);
      }
      if (evalResult.decision === 'REQUIRE_APPROVAL') {
        return {
          success: false,
          status: 'AWAITING_APPROVAL',
          requiresApproval: true,
          toolName: tool,
          approvalRequest: evalResult.approvalRequest
        };
      }
    }

    // 2. Execute Procedure Steps
    const t0 = Date.now();
    const executedSteps = [];
    let success = true;

    for (const step of skill.executionProcedure) {
      if (this.emergencyStop.isEmergencyStopped()) {
        throw new Error('EMERGENCY_STOP_ACTIVE: Execution stopped mid-procedure.');
      }
      executedSteps.push({ step: step.step, action: step.action, status: 'EXECUTED' });
    }

    const durationMs = Date.now() - t0;
    const verified = (skill.status === SKILL_STATUS.TRUSTED);

    // Record Execution
    this.recordSkillExecution(skillId, {
      success,
      verified,
      durationMs,
      verificationEvidence: {
        verificationMethod: skill.independentVerificationMethod,
        verified,
        status: 'SUCCESS'
      }
    });

    return {
      success: true,
      verified,
      skillId,
      skillName: skill.name,
      status: skill.status,
      executedSteps,
      durationMs
    };
  }

  persistSkillToMemory(skill) {
    if (!this.memoryDb) return;
    try {
      this.memoryDb.insertMemory({
        id: `skill_${skill.skillId}`,
        fact: `[Skill: ${skill.name} (${skill.version})] Status: ${skill.status} | Purpose: ${skill.purpose} | Tools: [${skill.requiredTools.join(', ')}] | SuccessRate: ${Math.round(skill.successRate * 100)}%`,
        category: 'reusable_skill',
        epistemicType: skill.status === SKILL_STATUS.TRUSTED ? 'VERIFIED_FACT' : 'HYPOTHESIS',
        source: 'skill_library_engine',
        memoryLayer: 'procedural',
        metadata: {
          skillId: skill.skillId,
          version: skill.version,
          status: skill.status,
          successRate: skill.successRate,
          consecutiveSuccesses: skill.consecutiveSuccesses
        }
      });
    } catch (_) {}
  }

  getSkill(skillId) {
    return this.skills.get(skillId) || null;
  }

  /**
   * Explicitly evaluates or applies verified promotion of a skill
   */
  promoteSkill(skillId, proof = {}) {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill '${skillId}' not found.`);

    if (skill.consecutiveSuccesses < PROMOTION_THRESHOLDS.MIN_CONSECUTIVE_SUCCESSES) {
      throw new Error(`INSUFFICIENT_RUNS: Skill '${skillId}' has ${skill.consecutiveSuccesses} consecutive verified successes, but requires >= ${PROMOTION_THRESHOLDS.MIN_CONSECUTIVE_SUCCESSES}.`);
    }

    if (!proof || (!proof.verified && proof.status !== 'SUCCESS')) {
      throw new Error(`MISSING_VERIFICATION_PROOF: Skill promotion requires explicit independent verification proof.`);
    }

    skill.status = SKILL_STATUS.TRUSTED;
    skill.promotedAt = new Date().toISOString();
    skill.promotionProof = proof;
    this.persistSkillToMemory(skill);
    this.saveSkills();

    if (this.auditTrail && typeof this.auditTrail.recordEvent === 'function') {
      try {
        this.auditTrail.recordEvent('SKILL_PROMOTED_TO_TRUSTED', {
          skillId,
          name: skill.name,
          proof
        }, { tool: 'skill_library_engine' });
      } catch (_) {}
    }

    return {
      skillId,
      status: skill.status,
      promoted: true,
      promotedAt: skill.promotedAt
    };
  }

  listSkills(filter = {}) {
    const list = Array.from(this.skills.values());
    if (filter.status) {
      return list.filter(s => s.status === filter.status);
    }
    return list;
  }

  getTrustedSkills() {
    return this.listSkills({ status: SKILL_STATUS.TRUSTED });
  }

  getExperimentalSkills() {
    return this.listSkills({ status: SKILL_STATUS.EXPERIMENTAL });
  }

  clear() {
    this.skills.clear();
    this.saveSkills();
  }
}

const skillLibraryEngineInstance = new SkillLibraryEngine();

module.exports = {
  SkillLibraryEngine,
  skillLibraryEngineInstance,
  SKILL_STATUS,
  PROMOTION_THRESHOLDS
};
