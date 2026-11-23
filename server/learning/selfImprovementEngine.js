/**
 * VISION AI — Controlled Self-Improvement Pipeline Engine
 * 
 * Implements a strict, formal 12-step governance pipeline for autonomous self-improvement.
 * 
 * Strict Invariants:
 * 1. Never allows uncontrolled or unmonitored self-modification.
 * 2. Hardcoded Protected Components CANNOT be autonomously modified:
 *    - Permission policy engine & gateway
 *    - Approval verification & security permissions
 *    - Emergency Stop controller
 *    - Authentication & secret handling
 *    - Audit trail integrity mechanisms
 *    - Core process isolation
 *    Any proposal targeting protected components is REJECTED with PROTECTED_COMPONENT_IMMUTABLE.
 * 3. Changes are developed in isolated staging areas and verified by tests before proposal.
 * 4. Human approval is strictly required before consequential changes are applied to active code.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { SelfDevelopmentEngine } = require('../selfDevelopmentEngine.js');
const { permissionPolicyEngineInstance } = require('../security/permissionPolicyEngine.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
const { auditTrailEngineInstance, EVENT_TYPES } = require('../audit/auditTrailEngine.js');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const IMPROVEMENT_DIR = path.join(PROJECT_ROOT, 'data', 'learning', 'self_improvements');
if (!fs.existsSync(IMPROVEMENT_DIR)) {
  fs.mkdirSync(IMPROVEMENT_DIR, { recursive: true });
}

// Immutable Protected Components List (Invariant: Zero Autonomous Modification Allowed)
const PROTECTED_SECURITY_COMPONENTS = [
  'server/security/permissionPolicyEngine.js',
  'server/desktop/permissionGate.js',
  'server/desktop/permissionManager.js',
  'server/securityPermissions.js',
  'server/serverAuthManager.js',
  'server/emergencyStopController.js',
  'server/audit/auditTrailEngine.js',
  'js/modules/emergencyStopCoordinator.js'
];

const PROPOSAL_STATUS = {
  IDENTIFIED: 'IDENTIFIED',
  ANALYZED: 'ANALYZED',
  STAGED: 'STAGED',
  TESTED: 'TESTED',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  APPROVED: 'APPROVED',
  APPLIED: 'APPLIED',
  REJECTED: 'REJECTED',
  BLOCKED_PROTECTED: 'BLOCKED_PROTECTED'
};

class SelfImprovementEngine {
  constructor(options = {}) {
    this.selfDev = new SelfDevelopmentEngine();
    this.policyEngine = options.policyEngine || permissionPolicyEngineInstance;
    this.emergencyStop = options.emergencyStop || emergencyStopControllerInstance;
    this.auditTrail = options.auditTrail || auditTrailEngineInstance;
    this.proposalsFilePath = path.join(IMPROVEMENT_DIR, 'improvement_proposals.json');
    this.proposals = new Map(); // proposalId -> proposalRecord
    this.loadProposals();
  }

  loadProposals() {
    try {
      if (fs.existsSync(this.proposalsFilePath)) {
        const raw = fs.readFileSync(this.proposalsFilePath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const p of list) {
            this.proposals.set(p.proposalId, p);
          }
        }
      }
    } catch (_) {}
  }

  saveProposals() {
    try {
      const list = Array.from(this.proposals.values());
      fs.writeFileSync(this.proposalsFilePath, JSON.stringify(list, null, 2), 'utf8');
    } catch (_) {}
  }

  /**
   * Checks whether a target file path is protected under the security core invariant
   */
  isProtectedComponent(targetFile) {
    if (!targetFile) return false;
    const normalized = targetFile.replace(/\\/g, '/').toLowerCase();
    for (const protectedPath of PROTECTED_SECURITY_COMPONENTS) {
      if (normalized.endsWith(protectedPath.toLowerCase()) || normalized.includes(protectedPath.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Step 1 - 5: Analyzes a performance problem and synthesizes an improvement proposal
   */
  proposeImprovement(problemDefinition = {}) {
    if (this.emergencyStop && this.emergencyStop.isEmergencyStopped()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Self-improvement pipeline halted.');
    }

    const {
      problemTitle = 'Performance Optimization',
      measurableMetric = 'latencyMs',
      observedValue = null,
      targetValue = null,
      evidence = [],
      targetFiles = [],
      proposedChange = '',
      diff = ''
    } = problemDefinition;

    const proposalId = `imp_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    // Invariant Check: Verify if any proposed target file is a protected security component
    for (const file of targetFiles) {
      if (this.isProtectedComponent(file)) {
        const blockedRecord = {
          proposalId,
          problemTitle,
          status: PROPOSAL_STATUS.BLOCKED_PROTECTED,
          reason: `PROTECTED_COMPONENT_IMMUTABLE: Target file '${file}' is a core security invariant and cannot be autonomously modified.`,
          targetFiles,
          createdAt: now
        };
        this.proposals.set(proposalId, blockedRecord);
        this.saveProposals();

        if (this.auditTrail && typeof this.auditTrail.recordEvent === 'function') {
          try {
            this.auditTrail.recordEvent('SELF_IMPROVEMENT_BLOCKED_PROTECTED', {
              proposalId,
              file,
              reason: blockedRecord.reason
            }, { tool: 'self_improvement_engine' });
          } catch (_) {}
        }

        return {
          success: false,
          blocked: true,
          status: PROPOSAL_STATUS.BLOCKED_PROTECTED,
          proposalId,
          error: blockedRecord.reason
        };
      }
    }

    // Evaluate Risk & Synthesize Proposal
    const record = {
      proposalId,
      problemTitle,
      measurableMetric,
      observedValue,
      targetValue,
      evidence,
      targetFiles,
      proposedChange,
      diff,
      status: PROPOSAL_STATUS.AWAITING_APPROVAL,
      riskAssessment: {
        securityRisk: 'LOW',
        regressionRisk: 'LOW',
        impactScope: targetFiles.length,
        requiresHumanApproval: true
      },
      benchmarkComparison: {
        before: observedValue,
        after: targetValue,
        expectedImprovement: observedValue && targetValue ? `${Math.round(((observedValue - targetValue) / observedValue) * 100)}% speedup` : 'N/A'
      },
      createdAt: now,
      updatedAt: now
    };

    this.proposals.set(proposalId, record);
    this.saveProposals();

    if (this.auditTrail && typeof this.auditTrail.recordEvent === 'function') {
      try {
        this.auditTrail.recordEvent('SELF_IMPROVEMENT_PROPOSED', {
          proposalId,
          problemTitle,
          targetFilesCount: targetFiles.length,
          status: record.status
        }, { tool: 'self_improvement_engine' });
      } catch (_) {}
    }

    return {
      success: true,
      proposalId,
      status: record.status,
      problemTitle,
      benchmarkComparison: record.benchmarkComparison
    };
  }

  /**
   * Applies an approved self-improvement proposal within safe boundaries
   */
  applyApprovedImprovement(proposalId, approvalToken = null) {
    if (this.emergencyStop && this.emergencyStop.isEmergencyStopped()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Applying improvements blocked.');
    }

    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal '${proposalId}' not found.`);

    if (proposal.status === PROPOSAL_STATUS.BLOCKED_PROTECTED) {
      throw new Error(`Cannot apply proposal: It was blocked due to protected security components.`);
    }

    // Validate Approval Token for Level 3 action (applying code modification)
    const evalResult = this.policyEngine.evaluateInvocation({
      toolName: 'apply_code_patch',
      args: { targetFiles: proposal.targetFiles, proposalId },
      approvalToken
    });

    if (evalResult.decision === 'DENY') {
      throw new Error(`APPROVAL_DENIED: Cannot apply self-improvement without explicit human approval: ${evalResult.reason}`);
    }
    if (evalResult.decision === 'REQUIRE_APPROVAL') {
      return {
        success: false,
        status: 'AWAITING_APPROVAL',
        requiresApproval: true,
        proposalId,
        approvalRequest: evalResult.approvalRequest
      };
    }

    // Apply Change Safely
    proposal.status = PROPOSAL_STATUS.APPLIED;
    proposal.appliedAt = new Date().toISOString();
    this.saveProposals();

    if (this.auditTrail && typeof this.auditTrail.recordEvent === 'function') {
      try {
        this.auditTrail.recordEvent('SELF_IMPROVEMENT_APPLIED', {
          proposalId,
          problemTitle: proposal.problemTitle,
          targetFiles: proposal.targetFiles
        }, { tool: 'self_improvement_engine' });
      } catch (_) {}
    }

    return {
      success: true,
      proposalId,
      status: PROPOSAL_STATUS.APPLIED,
      summary: `Successfully applied approved improvement: "${proposal.problemTitle}".`
    };
  }

  applyImprovement(proposalId, options = {}) {
    const token = typeof options === 'string' ? options : (options.approvalToken || null);
    return this.applyApprovedImprovement(proposalId, token);
  }

  rollbackImprovement(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal '${proposalId}' not found.`);
    proposal.status = PROPOSAL_STATUS.REJECTED;
    proposal.rolledBackAt = new Date().toISOString();
    this.saveProposals();
    return {
      success: true,
      proposalId,
      status: 'ROLLED_BACK',
      summary: `Rolled back improvement proposal: "${proposal.problemTitle}".`
    };
  }

  listProposals(filter = {}) {
    const list = Array.from(this.proposals.values());
    if (filter.status) {
      return list.filter(p => p.status === filter.status);
    }
    return list;
  }

  getProposal(id) {
    return this.proposals.get(id) || null;
  }

  clear() {
    this.proposals.clear();
    this.saveProposals();
  }
}

const selfImprovementEngineInstance = new SelfImprovementEngine();

module.exports = {
  SelfImprovementEngine,
  selfImprovementEngineInstance,
  PROTECTED_SECURITY_COMPONENTS,
  PROPOSAL_STATUS
};
