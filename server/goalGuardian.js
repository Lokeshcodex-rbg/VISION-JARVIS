/**
 * VISION AI — Goal Guardian & Long-Term Objective Tracking
 * Implements Part III, Section 12 of the Master Intelligence Directive:
 * - Records user-approved goals and milestone decompositions
 * - Evidence-verified progress tracking (no unverified milestone completion)
 * - Dependency mapping and blocker / contradiction detection
 * - Resource realism assessment
 * - Full user control: modify, pause, resume, cancel
 * - Integrated decision and experiment linking
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../data/goals');
const GOALS_FILE = path.join(DATA_DIR, 'goals_ledger.json');

const GOAL_STATUS = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  ACHIEVED: 'ACHIEVED',
  UNREALISTIC: 'UNREALISTIC'
};

const MILESTONE_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  VERIFIED_COMPLETE: 'VERIFIED_COMPLETE',
  BLOCKED: 'BLOCKED'
};

class GoalGuardian {
  constructor() {
    this.goals = new Map();
    this.ensureDataStorage();
    this.loadGoals();
  }

  ensureDataStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(GOALS_FILE)) {
        fs.writeFileSync(GOALS_FILE, JSON.stringify({ goals: [] }, null, 2), 'utf8');
      }
    } catch (e) {
      console.warn('[GOAL_GUARDIAN] Failed to initialize storage:', e.message);
    }
  }

  loadGoals() {
    try {
      if (fs.existsSync(GOALS_FILE)) {
        const raw = fs.readFileSync(GOALS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.goals)) {
          parsed.goals.forEach(g => this.goals.set(g.id, g));
        }
      }
    } catch (e) {
      console.warn('[GOAL_GUARDIAN] Error loading goals:', e.message);
    }
  }

  saveGoals() {
    try {
      const list = Array.from(this.goals.values());
      fs.writeFileSync(GOALS_FILE, JSON.stringify({ goals: list }, null, 2), 'utf8');
    } catch (e) {
      console.warn('[GOAL_GUARDIAN] Error saving goals:', e.message);
    }
  }

  /**
   * Registers a user-approved long-term goal
   */
  createGoal(config = {}) {
    const {
      title,
      description,
      category = 'ENGINEERING',
      targetDate = null,
      priority = 'HIGH',
      milestones = [],
      resourceBudget = { maxHours: 100, maxBudgetCost: 0, requiredCompute: 'STANDARD' },
      dependencies = []
    } = config;

    if (!title) throw new Error('Goal title is required.');

    const goalId = `goal_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const createdAt = new Date().toISOString();

    const formattedMilestones = (milestones.length > 0 ? milestones : [
      { id: 'm1', title: 'Problem definition & initial requirements', criteria: 'Requirements document verified', status: MILESTONE_STATUS.PENDING },
      { id: 'm2', title: 'Prototype implementation', criteria: 'Executable passes unit test suite', status: MILESTONE_STATUS.PENDING, dependsOn: ['m1'] },
      { id: 'm3', title: 'Benchmarking and verification', criteria: 'Performance verified vs baseline', status: MILESTONE_STATUS.PENDING, dependsOn: ['m2'] }
    ]).map((m, idx) => ({
      id: m.id || `m_${idx + 1}`,
      title: m.title,
      criteria: m.criteria || 'Outcome verified with reproducible evidence',
      status: m.status || MILESTONE_STATUS.PENDING,
      dependsOn: Array.isArray(m.dependsOn) ? m.dependsOn : [],
      evidence: m.evidence || null,
      completedAt: null
    }));

    const goalRecord = {
      id: goalId,
      title,
      description: description || '',
      category,
      status: GOAL_STATUS.ACTIVE,
      priority,
      createdAt,
      targetDate,
      progressPercent: 0,
      resourceBudget,
      dependencies,
      milestones: formattedMilestones,
      blockers: [],
      contradictions: [],
      linkedDecisions: [],
      linkedExperiments: [],
      feasibilityAssessment: null,
      auditHistory: [{ action: 'CREATED', timestamp: createdAt, note: 'User approved goal creation' }]
    };

    // Assess initial contradictions and feasibility
    this.detectContradictionsAndBlockers(goalRecord);
    this.assessFeasibility(goalRecord);

    this.goals.set(goalId, goalRecord);
    this.saveGoals();
    return goalRecord;
  }

  /**
   * Records verified evidence for a milestone. Never marks complete without verified proof.
   */
  recordMilestoneProgress(goalId, milestoneId, evidence = {}) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found.`);

    const milestone = goal.milestones.find(m => m.id === milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found in goal ${goalId}.`);

    const { proof, verified = false, testResult = null, artifactPath = null } = evidence;

    if (!proof || !verified) {
      milestone.status = MILESTONE_STATUS.IN_PROGRESS;
      milestone.evidence = {
        lastAttempt: new Date().toISOString(),
        note: 'Attempt recorded, but milestone outcome is not yet fully verified with proof.',
        details: evidence
      };
      this.saveGoals();
      return {
        success: false,
        status: milestone.status,
        message: 'Evidence submitted was incomplete or unverified. Milestone remains in progress.'
      };
    }

    // Check if prerequisite milestones are completed
    if (milestone.dependsOn && milestone.dependsOn.length > 0) {
      for (const depId of milestone.dependsOn) {
        const depMilestone = goal.milestones.find(m => m.id === depId);
        if (depMilestone && depMilestone.status !== MILESTONE_STATUS.VERIFIED_COMPLETE) {
          milestone.status = MILESTONE_STATUS.BLOCKED;
          goal.blockers.push(`Milestone "${milestone.title}" blocked by unfinished dependency "${depMilestone.title}"`);
          this.saveGoals();
          return {
            success: false,
            status: milestone.status,
            message: `Milestone is blocked by dependency: ${depMilestone.title}`
          };
        }
      }
    }

    // Verified completion
    milestone.status = MILESTONE_STATUS.VERIFIED_COMPLETE;
    milestone.completedAt = new Date().toISOString();
    milestone.evidence = {
      verifiedAt: milestone.completedAt,
      proof,
      testResult,
      artifactPath
    };

    // Recompute goal progress percentage
    const completedCount = goal.milestones.filter(m => m.status === MILESTONE_STATUS.VERIFIED_COMPLETE).length;
    goal.progressPercent = parseFloat(((completedCount / goal.milestones.length) * 100).toFixed(1));

    if (completedCount === goal.milestones.length) {
      goal.status = GOAL_STATUS.ACHIEVED;
      goal.achievedAt = new Date().toISOString();
    }

    goal.auditHistory.push({
      action: 'MILESTONE_COMPLETED',
      milestoneId,
      timestamp: new Date().toISOString(),
      proof
    });

    this.detectContradictionsAndBlockers(goal);
    this.saveGoals();

    return {
      success: true,
      milestoneId,
      status: milestone.status,
      goalProgressPercent: goal.progressPercent,
      goalStatus: goal.status
    };
  }

  /**
   * Detects circular dependencies, contradictory plans, and active blockers
   */
  detectContradictionsAndBlockers(goal) {
    const blockers = [];
    const contradictions = [];

    // 1. Check for circular dependencies in milestones
    const visited = new Set();
    const recursionStack = new Set();

    const checkCycle = (mId) => {
      visited.add(mId);
      recursionStack.add(mId);

      const m = goal.milestones.find(x => x.id === mId);
      if (m && m.dependsOn) {
        for (const dep of m.dependsOn) {
          if (!visited.has(dep)) {
            if (checkCycle(dep)) return true;
          } else if (recursionStack.has(dep)) {
            contradictions.push(`Circular milestone dependency detected between "${mId}" and "${dep}".`);
            return true;
          }
        }
      }
      recursionStack.delete(mId);
      return false;
    };

    goal.milestones.forEach(m => {
      if (!visited.has(m.id)) checkCycle(m.id);
    });

    // 2. Identify active blockers
    goal.milestones.forEach(m => {
      if (m.status !== MILESTONE_STATUS.VERIFIED_COMPLETE && m.dependsOn) {
        m.dependsOn.forEach(depId => {
          const dep = goal.milestones.find(x => x.id === depId);
          if (dep && dep.status !== MILESTONE_STATUS.VERIFIED_COMPLETE) {
            blockers.push(`"${m.title}" is waiting on "${dep.title}".`);
          }
        });
      }
    });

    goal.blockers = Array.from(new Set(blockers));
    goal.contradictions = Array.from(new Set(contradictions));
    return { blockers: goal.blockers, contradictions: goal.contradictions };
  }

  /**
   * Assesses whether a goal is realistic given current resources and target deadlines
   */
  assessFeasibility(goal, currentCapacity = {}) {
    const maxAvailableHours = currentCapacity.availableHours !== undefined ? currentCapacity.availableHours : 200;
    const requiredHours = goal.resourceBudget?.maxHours || 50;

    let isRealistic = true;
    const notes = [];

    if (requiredHours > maxAvailableHours) {
      isRealistic = false;
      notes.push(`Resource Deficit: Requires ${requiredHours} hours but current capacity is ${maxAvailableHours} hours.`);
    }

    if (goal.targetDate) {
      const targetTime = new Date(goal.targetDate).getTime();
      const now = Date.now();
      const remainingDays = (targetTime - now) / (1000 * 3600 * 24);
      if (remainingDays < 1 && goal.progressPercent < 50) {
        isRealistic = false;
        notes.push(`Time Deficit: Target deadline is within ${remainingDays.toFixed(1)} days with ${goal.progressPercent}% completion.`);
      }
    }

    if (!isRealistic && goal.status === GOAL_STATUS.ACTIVE) {
      goal.status = GOAL_STATUS.UNREALISTIC;
    } else if (isRealistic && goal.status === GOAL_STATUS.UNREALISTIC) {
      goal.status = GOAL_STATUS.ACTIVE;
    }

    goal.feasibilityAssessment = {
      isRealistic,
      notes,
      assessedAt: new Date().toISOString()
    };

    return goal.feasibilityAssessment;
  }

  /**
   * Suggests the optimal next milestone step based on topological order
   */
  suggestNextStep(goalId) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found.`);

    if (goal.status === GOAL_STATUS.ACHIEVED) {
      return { status: 'COMPLETED', suggestion: 'Goal is fully achieved and verified.' };
    }

    if (goal.contradictions.length > 0) {
      return {
        status: 'CONTRADICTION_BLOCKED',
        suggestion: `Resolve contradictory plan dependencies: ${goal.contradictions[0]}`
      };
    }

    for (const m of goal.milestones) {
      if (m.status !== MILESTONE_STATUS.VERIFIED_COMPLETE) {
        const unmetDeps = (m.dependsOn || []).filter(depId => {
          const dep = goal.milestones.find(x => x.id === depId);
          return dep && dep.status !== MILESTONE_STATUS.VERIFIED_COMPLETE;
        });

        if (unmetDeps.length === 0) {
          return {
            status: 'READY_TO_EXECUTE',
            milestoneId: m.id,
            title: m.title,
            criteria: m.criteria,
            suggestion: `Focus next effort on completing milestone "${m.title}". Verification criteria: ${m.criteria}.`
          };
        }
      }
    }

    return { status: 'ALL_BLOCKED', suggestion: 'All remaining milestones are currently blocked by prerequisites.' };
  }

  pauseGoal(goalId, reason = 'User requested pause') {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found.`);
    goal.status = GOAL_STATUS.PAUSED;
    goal.auditHistory.push({ action: 'PAUSED', reason, timestamp: new Date().toISOString() });
    this.saveGoals();
    return { success: true, goalId, status: goal.status };
  }

  resumeGoal(goalId) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found.`);
    goal.status = GOAL_STATUS.ACTIVE;
    goal.auditHistory.push({ action: 'RESUMED', timestamp: new Date().toISOString() });
    this.saveGoals();
    return { success: true, goalId, status: goal.status };
  }

  cancelGoal(goalId, reason = 'User requested cancellation') {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found.`);
    goal.status = GOAL_STATUS.CANCELLED;
    goal.auditHistory.push({ action: 'CANCELLED', reason, timestamp: new Date().toISOString() });
    this.saveGoals();
    return { success: true, goalId, status: goal.status };
  }

  linkExperiment(goalId, experimentId) {
    const goal = this.goals.get(goalId);
    if (goal && !goal.linkedExperiments.includes(experimentId)) {
      goal.linkedExperiments.push(experimentId);
      this.saveGoals();
    }
  }

  getGoal(goalId) {
    return this.goals.get(goalId) || null;
  }

  listGoals() {
    return Array.from(this.goals.values());
  }

  updateMilestoneStatus(goalId, milestoneId, status, evidence = {}) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found.`);

    const milestone = goal.milestones.find(m => m.id === milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found in goal ${goalId}.`);

    const mappedStatus = status === 'COMPLETED' ? 'COMPLETED' : status;
    milestone.status = mappedStatus;
    milestone.evidence = evidence;
    if (mappedStatus === 'COMPLETED' || mappedStatus === MILESTONE_STATUS.VERIFIED_COMPLETE) {
      milestone.completedAt = new Date().toISOString();
    }
    this.detectContradictionsAndBlockers(goal);
    this.saveGoals();
    return goal;
  }
}

const goalGuardianInstance = new GoalGuardian();

module.exports = {
  GoalGuardian,
  goalGuardianInstance,
  GOAL_STATUS,
  MILESTONE_STATUS
};
