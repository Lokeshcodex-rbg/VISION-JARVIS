/**
 * VISION AI — Adaptive Planning Intelligence Engine
 * 
 * Enhances the Generalized DAG Planning Engine by leveraging accumulated historical
 * task experiences, error root causes, empirical durations, and trusted reusable skills.
 * 
 * Strict Invariants:
 * 1. Never blindly reuses old plans without validating current tool availability and state.
 * 2. Employs empirical historical duration and failure telemetry instead of guesswork.
 * 3. Injects proven recovery strategies into DAG nodes identified as high-risk failure points.
 * 4. Respects the unified 5-tier permission policy hierarchy.
 */

const { experienceLearningEngineInstance, TASK_OUTCOMES } = require('./experienceLearningEngine.js');
const { skillLibraryEngineInstance, SKILL_STATUS } = require('./skillLibraryEngine.js');
const { permissionPolicyEngineInstance } = require('../security/permissionPolicyEngine.js');

class AdaptivePlanningEngine {
  constructor(options = {}) {
    this.experienceEngine = options.experienceEngine || experienceLearningEngineInstance;
    this.skillLibrary = options.skillLibrary || skillLibraryEngineInstance;
    this.policyEngine = options.policyEngine || permissionPolicyEngineInstance;
  }

  generateAdaptivePlan(objective, options = {}) {
    return this.adaptPlan(objective, options.category || 'general', options.basePlan || null);
  }

  /**
   * Generates an adaptive execution plan for a given natural-language objective
   * by querying similar historical experiences and trusted skills.
   */
  adaptPlan(objective, category = 'general', basePlan = null) {
    const normObj = String(objective || '').trim();
    
    // 1. Check if a trusted reusable skill directly covers this objective
    const matchedSkill = this.findMatchingSkill(normObj);
    
    // 2. Query similar historical experiences
    const similarExperiences = this.experienceEngine.retrieveSimilarExperiences(normObj, {
      category,
      limit: 5
    });

    const successfulPastRuns = similarExperiences.filter(e => e.taskOutcome === TASK_OUTCOMES.VERIFIED_SUCCESS);
    const failedPastRuns = similarExperiences.filter(e => e.taskOutcome === TASK_OUTCOMES.FAILURE || e.taskOutcome === TASK_OUTCOMES.PARTIAL_SUCCESS);

    // 3. Empirical Duration & Complexity Estimation
    const durationEstimate = this.estimateDuration(successfulPastRuns, basePlan);
    const complexityEstimate = this.estimateComplexity(normObj, basePlan, matchedSkill);

    // 4. Failure Point Prediction & Recovery Selection
    const failurePredictions = this.predictFailurePoints(failedPastRuns);

    // 5. Build or Enhance Adaptive DAG Nodes
    let nodes = [];
    if (matchedSkill && matchedSkill.status === SKILL_STATUS.TRUSTED) {
      nodes = this.buildNodesFromSkill(matchedSkill, normObj);
    } else if (successfulPastRuns.length > 0 && successfulPastRuns[0].originalPlan && successfulPastRuns[0].originalPlan.length > 0) {
      nodes = this.adaptPastSuccessfulPlan(successfulPastRuns[0], failurePredictions);
    } else if (basePlan && Array.isArray(basePlan.nodes)) {
      nodes = this.enrichBasePlanNodes(basePlan.nodes, failurePredictions);
    } else {
      nodes = this.generateDefaultAdaptiveNodes(normObj, category, failurePredictions);
    }

    // 6. Permission & Tool Policy Validation across all planned nodes
    const validatedNodes = [];
    for (const node of nodes) {
      const evalResult = this.policyEngine.evaluateInvocation({
        toolName: node.tool,
        args: node.arguments || {},
        personality: 'JARVIS'
      });
      validatedNodes.push({
        ...node,
        permissionLevel: evalResult.level,
        policyDecision: evalResult.decision,
        requiresApproval: (evalResult.decision === 'REQUIRE_APPROVAL')
      });
    }

    return {
      objective: normObj,
      category,
      adapted: true,
      matchedSkill: matchedSkill ? { skillId: matchedSkill.skillId, name: matchedSkill.name, status: matchedSkill.status } : null,
      similarExperiencesCount: similarExperiences.length,
      successfulPastRunsCount: successfulPastRuns.length,
      failedPastRunsCount: failedPastRuns.length,
      estimatedDurationMs: durationEstimate.durationMs,
      durationConfidence: durationEstimate.confidence,
      estimatedComplexity: complexityEstimate,
      failureRisksIdentified: failurePredictions,
      nodes: validatedNodes
    };
  }

  findMatchingSkill(objective) {
    const qLower = objective.toLowerCase();
    const trustedSkills = this.skillLibrary.getTrustedSkills();

    for (const skill of trustedSkills) {
      const nameMatch = qLower.includes(skill.name.toLowerCase().replace(' skill', ''));
      const purposeTokens = skill.purpose.toLowerCase().split(/\s+/).filter(t => t.length > 3);
      let matchCount = 0;
      for (const tok of purposeTokens) {
        if (qLower.includes(tok)) matchCount++;
      }
      if (nameMatch || matchCount >= 2) {
        return skill;
      }
    }
    return null;
  }

  estimateDuration(successfulPastRuns = [], basePlan = null) {
    if (successfulPastRuns.length > 0) {
      const total = successfulPastRuns.reduce((acc, r) => acc + (r.durationMs || 0), 0);
      const avg = Math.round(total / successfulPastRuns.length);
      return { durationMs: Math.max(100, avg), confidence: 0.85, basis: 'empirical_historical_experiences' };
    }
    if (basePlan && Array.isArray(basePlan.nodes)) {
      return { durationMs: basePlan.nodes.length * 350, confidence: 0.50, basis: 'heuristic_node_count' };
    }
    return { durationMs: 1200, confidence: 0.40, basis: 'default_baseline' };
  }

  estimateComplexity(objective, basePlan = null, matchedSkill = null) {
    if (matchedSkill) return 'MODERATE_SKILL_AUTOMATION';
    const nodeCount = basePlan && Array.isArray(basePlan.nodes) ? basePlan.nodes.length : 3;
    if (nodeCount <= 2) return 'LOW_COMPLEXITY';
    if (nodeCount <= 5) return 'MEDIUM_COMPLEXITY';
    return 'HIGH_COMPLEXITY';
  }

  predictFailurePoints(failedPastRuns = []) {
    const failurePoints = [];
    const toolFailureMap = new Map();

    for (const run of failedPastRuns) {
      for (const err of (run.errorsEncountered || [])) {
        const errStr = typeof err === 'object' ? err.message : String(err);
        const taxonomy = this.experienceEngine.diagnoseErrorTaxonomy(errStr);
        const count = toolFailureMap.get(taxonomy) || 0;
        toolFailureMap.set(taxonomy, count + 1);
      }
    }

    for (const [taxonomy, count] of toolFailureMap.entries()) {
      const recoveryStrategy = this.experienceEngine.getBestRecoveryStrategy(`general:${taxonomy}`);
      failurePoints.push({
        riskType: taxonomy,
        observedFailureCount: count,
        recommendedMitigation: recoveryStrategy,
        preemptiveActionRequired: (taxonomy === 'FOCUS_LOSS' || taxonomy === 'TIMEOUT')
      });
    }

    return failurePoints;
  }

  buildNodesFromSkill(skill, objective) {
    return skill.executionProcedure.map((step, idx) => ({
      id: `node_skill_${step.step || (idx + 1)}`,
      name: step.description || `Execute ${step.action}`,
      tool: step.tool || (skill.requiredTools[0] || 'run_system_diagnostics'),
      arguments: { taskObjective: objective },
      dependencies: idx === 0 ? [] : [`node_skill_${idx}`],
      verificationMethod: (idx === skill.executionProcedure.length - 1) ? skill.independentVerificationMethod : null,
      recoveryStrategy: skill.recoveryProcedure
    }));
  }

  adaptPastSuccessfulPlan(pastExperience, failurePredictions = []) {
    const rawNodes = pastExperience.originalPlan.length > 0
      ? pastExperience.originalPlan
      : pastExperience.actualExecutionSequence;

    return rawNodes.map((n, idx) => {
      const tool = n.tool || n.toolName || 'run_system_diagnostics';
      let recovery = n.recoveryStrategy || 'RETRY_ONCE';

      // Inject preemptive recovery if failure risk detected
      for (const risk of failurePredictions) {
        if (risk.preemptiveActionRequired) {
          recovery = risk.recommendedMitigation;
        }
      }

      return {
        id: n.id || `node_past_${idx + 1}`,
        name: n.name || `Execute ${tool}`,
        tool,
        arguments: n.arguments || n.args || {},
        dependencies: n.dependencies || (idx === 0 ? [] : [`node_past_${idx}`]),
        verificationMethod: n.verificationMethod || null,
        recoveryStrategy: recovery
      };
    });
  }

  enrichBasePlanNodes(baseNodes = [], failurePredictions = []) {
    return baseNodes.map(node => {
      let enrichedRecovery = node.recoveryStrategy || 'STANDARD_RETRY';
      for (const risk of failurePredictions) {
        if (risk.preemptiveActionRequired) {
          enrichedRecovery = risk.recommendedMitigation;
        }
      }
      return {
        ...node,
        recoveryStrategy: enrichedRecovery,
        adaptiveEnrichment: true
      };
    });
  }

  generateDefaultAdaptiveNodes(objective, category, failurePredictions = []) {
    const recovery = failurePredictions.length > 0 ? failurePredictions[0].recommendedMitigation : 'STANDARD_FALLBACK';
    return [
      {
        id: 'node_init_1',
        name: 'Analyze Objective & Environment Prerequisites',
        tool: 'get_system_telemetry',
        arguments: { checkReady: true },
        dependencies: [],
        recoveryStrategy: 'RETRY_ONCE'
      },
      {
        id: 'node_exec_2',
        name: 'Execute Core Operational Task',
        tool: category === 'document' ? 'create_word_document' : (category === 'data' ? 'analyze_spreadsheet' : 'run_system_diagnostics'),
        arguments: { objective },
        dependencies: ['node_init_1'],
        recoveryStrategy: recovery
      },
      {
        id: 'node_verify_3',
        name: 'Independent Output Verification',
        tool: 'verify_document',
        arguments: { target: 'output_artifact' },
        dependencies: ['node_exec_2'],
        verificationMethod: 'INDEPENDENT_VERIFICATION',
        recoveryStrategy: 'LOG_DIAGNOSTIC'
      }
    ];
  }
}

const adaptivePlanningEngineInstance = new AdaptivePlanningEngine();

module.exports = {
  AdaptivePlanningEngine,
  adaptivePlanningEngineInstance
};
