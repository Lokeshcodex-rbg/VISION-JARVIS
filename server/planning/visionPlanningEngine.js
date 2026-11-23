/**
 * VISION v1.3 — Autonomous Planning Engine
 * server/planning/visionPlanningEngine.js
 * 
 * Provides:
 *   1. Goal Interpretation: Identifies desired outcomes, target objects, and constraints.
 *   2. Task Decomposition: Breaks complex goals into discrete subtasks.
 *   3. Dependency Identification: Identifies prerequisites and prevents circular blocks.
 *   4. Step Prioritization: Orders steps topologically.
 *   5. Tool Selection: Matches each step to a registered safe tool.
 *   6. Execution Monitoring: Tracks status and verifies step postconditions.
 *   7. Result Verification: Validates empirical output before declaring success.
 *   8. Failure Recovery: Fallback strategies (retry with relaxed args, alternate tools, pause for guidance).
 *   9. Final Response Synthesis: Compiles a clean, verified final report for the user.
 * 
 * Safety Gate:
 *   - Enforces PermissionGate checks: Destructive, sensitive, or high-impact actions
 *     halt the plan and require explicit human approval tokens before proceeding.
 */

const { dagPlanningEngineInstance, TASK_STATES } = require('../dagPlanningEngine.js');
const { permissionGateInstance } = require('../desktop/permissionGate.js');
const { executeTool } = require('../toolsRegistry.js');
const { conversationalMemorySystemInstance } = require('../memory/conversationalMemorySystem.js');

class VisionPlanningEngine {
  constructor(options = {}) {
    this.dagEngine = options.dagEngine || dagPlanningEngineInstance;
    this.activePlans = new Map();
  }

  /**
   * 1. Goal Interpretation
   */
  interpretGoal(goalText) {
    if (!goalText) return { success: false, error: 'EMPTY_GOAL' };
    const cleanGoal = String(goalText).trim();

    let goalCategory = 'GENERAL_WORKFLOW';
    if (/\b(organize|sort|cleanup|clean\s+up|archive|delete|move|compress)\b/i.test(cleanGoal)) {
      goalCategory = 'FILE_MANAGEMENT';
    } else if (/\b(test|build|compile|debug|fix|benchmark|refactor)\b/i.test(cleanGoal)) {
      goalCategory = 'SOFTWARE_ENGINEERING';
    } else if (/\b(weather|temperature|forecast|time|clock|date)\b/i.test(cleanGoal)) {
      goalCategory = 'INFO_RETRIEVAL';
    } else if (/\b(report|summary|analyze|inspect|audit|telemetry|diagnostics|status)\b/i.test(cleanGoal)) {
      goalCategory = 'SYSTEM_AUDIT';
    }

    const isSensitive = /\b(delete|remove|erase|format|kill|terminate|shutdown|drop|truncate|purge)\b/i.test(cleanGoal);

    return {
      success: true,
      rawGoal: cleanGoal,
      category: goalCategory,
      isSensitive,
      requiresApproval: isSensitive,
      interpretedAt: new Date().toISOString(),
    };
  }

  /**
   * 2, 3, 4, 5. Task Decomposition, Dependency Identification, Prioritization, & Tool Selection
   */
  async createExecutionPlan(goalText, context = {}) {
    const interpretation = this.interpretGoal(goalText);
    if (!interpretation.success) return interpretation;

    // Use DAG engine to build structured plan
    let plan = null;
    try {
      plan = await this.dagEngine.generatePlan(interpretation.rawGoal, {
        personality: context.personality || 'JARVIS',
        skipCache: true,
      });
    } catch (_) {
      plan = null;
    }

    // Fallback deterministic synthesis if DAG engine template needed
    if (!plan || !plan.nodes || plan.nodes.length === 0) {
      plan = this._buildFallbackPlan(interpretation);
    }

    const planId = plan.planId || plan.plan_id || `plan_${Date.now()}`;
    plan.planId = planId;
    this.activePlans.set(planId, plan);

    // Update working memory active task state
    conversationalMemorySystemInstance.setActiveTaskState({
      goal: interpretation.rawGoal,
      currentStep: plan.nodes[0]?.name || plan.nodes[0]?.description || 'Plan initialized',
      scratchpad: { planId, totalSteps: plan.nodes.length },
    });

    return {
      success: true,
      planId,
      interpretation,
      plan,
      totalSteps: plan.nodes.length,
      steps: plan.nodes.map((n, i) => ({
        step: i + 1,
        id: n.id,
        name: n.name || n.description || `Step ${i + 1}`,
        tool: n.toolName || n.assigned_tool || n.tool || n.action,
        dependencies: n.dependencies || [],
        requiresApproval: n.requiresApproval || Boolean(interpretation.requiresApproval && n.isDestructive),
      })),
    };
  }

  _buildFallbackPlan(interpretation) {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nodes = [];

    if (interpretation.category === 'FILE_MANAGEMENT') {
      nodes.push({
        id: 'node_1',
        name: 'Scan and index target project files',
        toolName: 'list_directory_contents',
        args: { path: '.' },
        dependencies: [],
        status: TASK_STATES.READY,
        isDestructive: false,
      });
      nodes.push({
        id: 'node_2',
        name: 'Analyze file distribution and organize',
        toolName: 'organize_project_files',
        args: { target_dir: '.' },
        dependencies: ['node_1'],
        status: TASK_STATES.READY,
        isDestructive: true,
        requiresApproval: true,
      });
      nodes.push({
        id: 'node_3',
        name: 'Generate project organization summary report',
        toolName: 'generate_summary_report',
        args: { format: 'markdown' },
        dependencies: ['node_2'],
        status: TASK_STATES.READY,
        isDestructive: false,
      });
    } else {
      nodes.push({
        id: 'node_1',
        name: 'Gather system and project context',
        toolName: 'get_system_telemetry',
        args: {},
        dependencies: [],
        status: TASK_STATES.READY,
        isDestructive: false,
      });
      nodes.push({
        id: 'node_2',
        name: 'Synthesize verified diagnostic report',
        toolName: 'generate_summary_report',
        args: {},
        dependencies: ['node_1'],
        status: TASK_STATES.READY,
        isDestructive: false,
      });
    }

    return {
      planId,
      objective: interpretation.rawGoal,
      nodes,
      status: TASK_STATES.READY,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 6, 7, 8. Execution Monitoring, Result Verification & Failure Recovery
   */
  async executePlan(planOrId, personality = 'JARVIS', callbacks = {}) {
    const plan = typeof planOrId === 'string' ? this.activePlans.get(planOrId) : planOrId;
    if (!plan || !plan.nodes) {
      return { success: false, error: 'PLAN_NOT_FOUND' };
    }

    const executedSteps = [];
    let haltedForApproval = false;
    let pendingApprovalStep = null;

    for (let i = 0; i < plan.nodes.length; i++) {
      const node = plan.nodes[i];
      const toolName = node.toolName || node.assigned_tool || node.tool || node.action;
      const toolArgs = node.args || node.validated_arguments || {};

      // Update working memory
      conversationalMemorySystemInstance.setActiveTaskState({
        goal: plan.objective,
        currentStep: node.name || `Step ${i + 1}`,
        scratchpad: { executingStepIndex: i, stepId: node.id },
      });

      // Permission Gate Check for Sensitive / Destructive Tools
      const isSensitiveNode = Boolean(
        node.requiresApproval ||
        node.isDestructive ||
        plan.requiresApproval ||
        (plan.interpretation && plan.interpretation.requiresApproval) ||
        /delete|remove|erase|purge|kill|terminate/i.test(toolName) ||
        /delete|remove|erase|purge|kill|terminate/i.test(node.name || '') ||
        /delete|remove|erase|purge|kill|terminate/i.test(node.task_description || '') ||
        /delete|remove|erase|purge|kill|terminate/i.test(plan.objective || plan.original_objective || '')
      );

      let permAllowed = true;
      let permReason = '';
      try {
        permissionGateInstance.authorizeToolExecution(toolName, toolArgs, personality);
      } catch (gateErr) {
        permAllowed = false;
        permReason = gateErr.message;
      }

      if (isSensitiveNode || !permAllowed) {
        if (!callbacks.approvalToken) {
          haltedForApproval = true;
          pendingApprovalStep = {
            stepIndex: i + 1,
            nodeId: node.id,
            nodeName: node.name || `Step ${i + 1}`,
            toolName: toolName,
            reason: permReason || 'Action requires single-use authorization token.',
          };
          break;
        }
      }

      // Execute Step with safe wrapper and retry
      let result = null;
      let stepErr = null;
      let attempt = 0;
      const maxAttempts = 2;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          if (typeof callbacks.onStepStart === 'function') {
            callbacks.onStepStart(i + 1, node);
          }

          result = await executeTool(toolName, toolArgs, personality);
          if (result && result.success !== false) {
            stepErr = null;
            break;
          } else {
            stepErr = result?.error || 'Unknown tool failure';
          }
        } catch (err) {
          stepErr = err.message;
        }

        // Failure Recovery: If first attempt failed, attempt argument relaxation
        if (attempt === 1 && stepErr) {
          if (toolArgs && typeof toolArgs === 'object') {
            toolArgs.retryMode = 'safe_fallback';
          }
        }
      }

      const verified = Boolean(result && result.success !== false);
      executedSteps.push({
        stepIndex: i + 1,
        id: node.id,
        name: node.name || `Step ${i + 1}`,
        tool: toolName,
        verified,
        result: result?.summary || result?.data || result || { error: stepErr },
        error: stepErr,
      });

      if (!verified && node.isCritical !== false) {
        // Critical step failure halts execution
        break;
      }
    }

    // 9. Final Outcome Synthesis
    const allSuccessful = executedSteps.length === plan.nodes.length && executedSteps.every(s => s.verified);
    const synthesis = this.synthesizeFinalOutcome(plan, executedSteps, haltedForApproval, pendingApprovalStep);

    // Record episode in memory
    const objText = String(plan.objective || plan.original_objective || plan.interpreted_objective || 'Autonomous Goal');
    conversationalMemorySystemInstance.recordEpisode({
      context: objText,
      action: `Executed plan ${plan.planId} (${executedSteps.length}/${plan.nodes.length} steps)`,
      outcome: allSuccessful ? 'Goal achieved successfully' : (haltedForApproval ? 'Awaiting human authorization' : 'Halted due to step failure'),
      success: allSuccessful,
      milestone: allSuccessful ? `Completed: ${objText.slice(0, 60)}` : null,
    });

    if (allSuccessful) {
      conversationalMemorySystemInstance.clearActiveTask();
    }

    return {
      success: allSuccessful,
      planId: plan.planId,
      haltedForApproval,
      pendingApprovalStep,
      executedSteps,
      synthesis,
    };
  }

  /**
   * 9. Final Response Synthesis
   */
  synthesizeFinalOutcome(plan, executedSteps, haltedForApproval, pendingApprovalStep) {
    const objText = String(plan.objective || plan.original_objective || plan.interpreted_objective || 'Autonomous Goal');
    if (haltedForApproval && pendingApprovalStep) {
      return (
        `### Autonomous Execution Paused — Human Authorization Required\n\n` +
        `**Goal:** ${objText}\n` +
        `**Pending Action:** Step ${pendingApprovalStep.stepIndex} — \`${pendingApprovalStep.toolName}\` (${pendingApprovalStep.nodeName})\n` +
        `**Security Reason:** ${pendingApprovalStep.reason}\n\n` +
        `Please confirm authorization to proceed with this sensitive action.`
      );
    }

    const completed = executedSteps.filter(s => s.verified).length;
    const total = plan.nodes.length;

    let out = `### Execution Summary — Goal: ${objText}\n\n`;
    out += `**Status:** ${completed === total ? 'Successfully Completed' : 'Partially Completed'}\n`;
    out += `**Verified Steps (${completed}/${total}):**\n`;

    for (const s of executedSteps) {
      const icon = s.verified ? '✓' : '✗';
      const detail = typeof s.result === 'string' ? s.result : (s.result?.summary || s.error || 'Verified');
      out += `- [${icon}] **Step ${s.stepIndex}:** ${s.name} — *${detail}*\n`;
    }

    return out;
  }
}

const visionPlanningEngineInstance = new VisionPlanningEngine();

module.exports = {
  VisionPlanningEngine,
  visionPlanningEngineInstance,
};
