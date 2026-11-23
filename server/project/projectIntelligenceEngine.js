/**
 * VISION AI — Project Intelligence & Continuity Engine
 * Phase 14 Module 3: Multi-Project Resolution, Disambiguation Dialogs,
 * Decision Ledger, Milestone Tracking, and Cross-Conversation Project Continuity.
 * 
 * Invariants:
 * 1. Ambiguous references NEVER guess; they surface concise clarifying dialogs.
 * 2. Cross-project connections preserve project boundaries without mixing data.
 * 3. Decisions and milestones are source-traceable and persisted to SQLite.
 */

const { personalContextEngineInstance: pce } = require('../memory/personalContextEngine');
const {
  starkMemoryDbInstance: db,
  EPISTEMIC_TYPES,
  MEMORY_LAYERS,
  CONFIDENCE_CLASSES,
  RECORD_TYPES
} = require('../memory/starkMemoryDb');

class ProjectIntelligenceEngine {
  constructor(pceInstance = pce, dbInstance = db) {
    this.pce = pceInstance;
    this.db = dbInstance;
    this.activeProjectId = null;
  }

  // =========================================================================
  // 1. MULTI-PROJECT RESOLUTION & DISAMBIGUATION
  // =========================================================================

  /**
   * Resolves a natural language query or reference to a concrete project entity.
   * If ambiguous, returns a structured disambiguation payload instead of guessing.
   */
  resolveProjectReference(query = '', activeContext = {}) {
    const raw = String(query || '').trim();
    if (!raw) {
      if (this.activeProjectId) {
        const activeProj = this.pce.getProject(this.activeProjectId);
        if (activeProj) return { resolved: true, ambiguous: false, project: activeProj, matchType: 'ACTIVE_PROJECT_FALLBACK' };
      }
      return { resolved: false, ambiguous: false, project: null, reason: 'EMPTY_QUERY' };
    }

    const qLower = raw.toLowerCase();
    const allProjects = this.pce.getAllProjects();
    const candidates = [];

    for (const proj of allProjects) {
      const pName = proj.projectName.toLowerCase();
      const pId = proj.id.toLowerCase();
      const aliases = (proj.aliases || []).map(a => a.toLowerCase());
      const keyFiles = (proj.keyFiles || []).map(f => f.toLowerCase());
      const objective = (proj.objective || '').toLowerCase();

      // Score matching
      let score = 0;
      let matchType = '';

      if (qLower === pName || qLower === pId) {
        score = 100;
        matchType = 'EXACT_NAME_MATCH';
      } else if (aliases.includes(qLower)) {
        score = 95;
        matchType = 'ALIAS_MATCH';
      } else if (qLower.includes(pName) || pName.includes(qLower)) {
        score = 80;
        matchType = 'SUBSTRING_MATCH';
      } else if (aliases.some(a => qLower.includes(a) || a.includes(qLower))) {
        score = 75;
        matchType = 'ALIAS_SUBSTRING_MATCH';
      } else {
        // Keyword token matching
        const qTokens = qLower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
        const matchTokens = qTokens.filter(t => 
          pName.includes(t) ||
          aliases.some(a => a.includes(t)) ||
          objective.includes(t) ||
          keyFiles.some(f => f.includes(t))
        );
        if (matchTokens.length > 0) {
          score = matchTokens.length * 20;
          matchType = 'TOKEN_RELEVANCE';
        }
      }

      if (score >= 40) {
        candidates.push({
          project: proj,
          score,
          matchType
        });
      }
    }

    // Sort by descending relevance score
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      // Fallback to active project if present
      if (this.activeProjectId) {
        const activeProj = this.pce.getProject(this.activeProjectId);
        if (activeProj) return { resolved: true, ambiguous: false, project: activeProj, matchType: 'ACTIVE_PROJECT_FALLBACK' };
      }
      return { resolved: false, ambiguous: false, project: null, reason: 'NO_MATCHING_PROJECT' };
    }

    if (candidates.length === 1) {
      this.activeProjectId = candidates[0].project.id;
      return {
        resolved: true,
        ambiguous: false,
        project: candidates[0].project,
        matchType: candidates[0].matchType,
        score: candidates[0].score
      };
    }

    // Multiple candidates: check if top candidate is significantly better
    if (candidates[0].score >= 80 && (candidates[0].score - candidates[1].score >= 30)) {
      this.activeProjectId = candidates[0].project.id;
      return {
        resolved: true,
        ambiguous: false,
        project: candidates[0].project,
        matchType: candidates[0].matchType,
        score: candidates[0].score
      };
    }

    // Ambiguity detected: do not guess!
    const candidateNames = candidates.map(c => `"${c.project.projectName}"`);
    return {
      resolved: false,
      ambiguous: true,
      candidateProjects: candidates.map(c => ({
        id: c.project.id,
        name: c.project.projectName,
        status: c.project.status,
        score: c.score
      })),
      clarificationPrompt: `Multiple matching projects found (${candidateNames.join(', ')}). Which project did you mean?`
    };
  }

  // =========================================================================
  // 2. MILESTONE PROGRESSION & DEPENDENCY TRACKING
  // =========================================================================

  addMilestone(projectId, milestoneData = {}) {
    const proj = this.pce.getProject(projectId);
    if (!proj) throw new Error(`PROJECT_NOT_FOUND: Project "${projectId}" not found.`);

    const now = new Date().toISOString();
    const id = milestoneData.id || `ms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const milestone = {
      id,
      title: milestoneData.title || 'Untitled Milestone',
      status: milestoneData.status || 'PENDING', // 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'
      dueDate: milestoneData.dueDate || null,
      dependencies: milestoneData.dependencies || [],
      blockers: milestoneData.blockers || [],
      notes: milestoneData.notes || '',
      updatedAt: now,
      createdAt: milestoneData.createdAt || now
    };

    proj.milestones = proj.milestones || [];
    const idx = proj.milestones.findIndex(m => m.id === id);
    if (idx >= 0) proj.milestones[idx] = milestone;
    else proj.milestones.push(milestone);

    this.pce.createOrUpdateProject(proj);

    // Save semantic memory record
    this.db.saveMemory({
      id: `mem_ms_${id}`,
      fact: `Milestone for ${proj.projectName}: "${milestone.title}" (Status: ${milestone.status})`,
      category: 'project_milestone',
      recordType: RECORD_TYPES.EVENT,
      confidenceClass: CONFIDENCE_CLASSES.USER_CONFIRMED,
      epistemicType: EPISTEMIC_TYPES.PROJECT_PROGRESS,
      memoryLayer: MEMORY_LAYERS.PROJECT,
      validFrom: now,
      isCurrent: 1,
      source: 'project_intelligence',
      domainTags: ['project', proj.id, 'milestone'],
      metadata: { projectId: proj.id, ...milestone }
    });

    return milestone;
  }

  updateMilestoneStatus(projectId, milestoneId, status, notes = '') {
    const proj = this.pce.getProject(projectId);
    if (!proj) throw new Error(`PROJECT_NOT_FOUND: Project "${projectId}" not found.`);

    const ms = (proj.milestones || []).find(m => m.id === milestoneId);
    if (!ms) throw new Error(`MILESTONE_NOT_FOUND: Milestone "${milestoneId}" not found in project "${projectId}".`);

    ms.status = String(status).toUpperCase();
    if (notes) ms.notes = notes;
    ms.updatedAt = new Date().toISOString();

    return this.addMilestone(projectId, ms);
  }

  // =========================================================================
  // 3. DECISION LEDGER
  // =========================================================================

  recordDecision(projectId, decisionText, options = {}) {
    const {
      rationale = '',
      alternativesConsidered = [],
      selectedOption = '',
      artifacts = []
    } = options;

    return this.pce.recordProjectDecision(projectId, decisionText, rationale, artifacts);
  }

  getDecisionHistory(projectId) {
    const proj = this.pce.getProject(projectId);
    if (!proj) return [];
    return proj.decisions || [];
  }

  // =========================================================================
  // 4. CROSS-CONVERSATION PROJECT BRIEFING
  // =========================================================================

  /**
   * Generates a comprehensive structured project briefing
   */
  getProjectBriefing(projectIdOrName) {
    const proj = this.pce.getProject(projectIdOrName);
    if (!proj) return null;

    const milestones = proj.milestones || [];
    const decisions = proj.decisions || [];
    const completedMs = milestones.filter(m => m.status === 'COMPLETED');
    const inProgressMs = milestones.filter(m => m.status === 'IN_PROGRESS');
    const blockedMs = milestones.filter(m => m.status === 'BLOCKED');
    const pendingMs = milestones.filter(m => m.status === 'PENDING');

    const progressPct = milestones.length > 0 ? Math.round((completedMs.length / milestones.length) * 100) : 0;

    return {
      projectId: proj.id,
      projectName: proj.projectName,
      status: proj.status,
      objective: proj.objective,
      architecture: proj.architecture,
      progressPercent: progressPct,
      milestonesSummary: {
        total: milestones.length,
        completed: completedMs.length,
        inProgress: inProgressMs.length,
        blocked: blockedMs.length,
        pending: pendingMs.length
      },
      activeMilestones: inProgressMs,
      blockedMilestones: blockedMs,
      recentDecisions: decisions.slice(-5),
      keyFiles: proj.keyFiles || [],
      nextSteps: proj.nextSteps || (inProgressMs.length > 0 ? inProgressMs.map(m => `Advance milestone: ${m.title}`) : []),
      updatedAt: proj.updatedAt
    };
  }
}

module.exports = {
  ProjectIntelligenceEngine,
  projectIntelligenceEngineInstance: new ProjectIntelligenceEngine()
};

