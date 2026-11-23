/**
 * VISION AI — Unified Personal Context Engine
 * Phase 14 Module 1: Central Personal Context, Preferences, Ongoing Projects,
 * Goals, Temporal Validity, and Context Relevance Firewall.
 * 
 * Invariants:
 * 1. Authoritative storage is the existing 8-layer SQLite database (starkMemoryDb).
 * 2. Inferred data NEVER silently becomes confirmed facts.
 * 3. Context Relevance Firewall strictly blocks unrelated personal memories from task execution contexts.
 */

const fs = require('fs');
const path = require('path');
const {
  starkMemoryDbInstance: db,
  EPISTEMIC_TYPES,
  MEMORY_LAYERS,
  CONFIDENCE_CLASSES,
  RECORD_TYPES
} = require('./starkMemoryDb');

class PersonalContextEngine {
  constructor(dbInstance = db) {
    this.db = dbInstance;
    this.activeProjectId = null;
    this.cache = {
      preferences: null,
      projects: new Map(),
      lastLoaded: 0
    };
    this.initDefaultPreferences();
  }

  initDefaultPreferences() {
    // Default baseline user preferences
    this.defaultPreferences = {
      communication: {
        preferredLanguage: 'en',
        preferredVoice: 'JARVIS',
        channel: 'in_app',
        formality: 'direct',
        confirmHighRiskActions: true
      },
      responseStyle: {
        verbosity: 'concise',
        includeMathProof: true,
        tone: 'professional_assistant',
        codeSnippetPreference: 'clean_idiomatic'
      },
      frequentlyUsedApps: [
        'VS Code',
        'Google Chrome',
        'WhatsApp Desktop',
        'Microsoft Word',
        'Excel'
      ],
      workPreferences: {
        indentStyle: 'spaces_2',
        gitCommitFormat: 'conventional',
        alwaysRunTestsBeforeCommit: true,
        enforceDisclaimerOnEngineering: true
      },
      approvedAutomations: {
        autoFormatCode: true,
        preFlightAudits: true,
        stageWhatsAppDrafts: true,
        independentVerification: true
      },
      explicitCorrections: []
    };
  }

  // =========================================================================
  // 1. USER PREFERENCE MANAGEMENT
  // =========================================================================

  getPreferences() {
    const records = this.db.getValidMemories({
      layer: MEMORY_LAYERS.USER_PREFERENCE,
      recordType: RECORD_TYPES.PREFERENCE
    });

    const prefs = JSON.parse(JSON.stringify(this.defaultPreferences));

    for (const rec of records) {
      try {
        const meta = rec.metadata || {};
        if (meta.prefCategory && meta.prefKey) {
          if (!prefs[meta.prefCategory]) prefs[meta.prefCategory] = {};
          prefs[meta.prefCategory][meta.prefKey] = meta.prefValue;
        } else if (meta.isFullPreferenceBlock) {
          Object.assign(prefs, meta.payload);
        }
      } catch (_) {}
    }

    // Retrieve recorded corrections
    const corrections = this.db.getValidMemories({
      layer: MEMORY_LAYERS.USER_PREFERENCE,
      recordType: RECORD_TYPES.HISTORICAL_RECORD
    });
    prefs.explicitCorrections = corrections.map(c => ({
      id: c.id,
      fact: c.fact,
      correctionReason: (c.metadata || {}).correctionReason || 'User explicit correction',
      updatedAt: c.updatedAt
    }));

    return prefs;
  }

  setPreference(category, key, value, source = 'USER_CONFIRMED') {
    const now = new Date().toISOString();
    const id = `pref_${category}_${key}`;
    const fact = `User preference [${category}.${key}] is set to: ${JSON.stringify(value)}`;

    return this.db.saveMemory({
      id,
      fact,
      category: 'user_preference',
      recordType: RECORD_TYPES.PREFERENCE,
      confidenceClass: source === 'USER_CONFIRMED' ? CONFIDENCE_CLASSES.USER_CONFIRMED : CONFIDENCE_CLASSES.MODEL_INFERRED,
      epistemicType: source === 'USER_CONFIRMED' ? EPISTEMIC_TYPES.USER_STATEMENT : EPISTEMIC_TYPES.HYPOTHESIS,
      memoryLayer: MEMORY_LAYERS.USER_PREFERENCE,
      validFrom: now,
      isCurrent: 1,
      source: source === 'USER_CONFIRMED' ? 'user_explicit_statement' : 'model_inference',
      domainTags: ['preferences', category],
      metadata: {
        prefCategory: category,
        prefKey: key,
        prefValue: value,
        updatedAt: now
      }
    });
  }

  recordCorrection(target, previousValue, correctedValue, reason = 'User correction') {
    const now = new Date().toISOString();
    const id = `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const fact = `Correction on [${target}]: changed from "${previousValue}" to "${correctedValue}". Reason: ${reason}`;

    // Mark previous memory as superseded if memoryId provided
    if (typeof target === 'string' && target.startsWith('mem_')) {
      this.db.correctMemory(target, String(correctedValue), reason);
    }

    return this.db.saveMemory({
      id,
      fact,
      category: 'user_correction',
      recordType: RECORD_TYPES.HISTORICAL_RECORD,
      confidenceClass: CONFIDENCE_CLASSES.USER_CONFIRMED,
      epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
      memoryLayer: MEMORY_LAYERS.USER_PREFERENCE,
      validFrom: now,
      isCurrent: 1,
      source: 'user_explicit_statement',
      domainTags: ['user_correction', 'governance'],
      metadata: {
        target,
        previousValue,
        correctedValue,
        correctionReason: reason,
        correctedAt: now
      }
    });
  }

  // =========================================================================
  // 2. ONGOING PROJECTS INTELLIGENCE
  // =========================================================================

  createOrUpdateProject(projectData = {}) {
    const now = new Date().toISOString();
    const id = projectData.id || projectData.projectId || `proj_${(projectData.projectName || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    const name = projectData.projectName || projectData.name || 'Untitled Project';

    const projectPayload = {
      id,
      projectName: name,
      aliases: projectData.aliases || [],
      objective: projectData.objective || '',
      architecture: projectData.architecture || '',
      status: projectData.status || 'IN_PROGRESS', // 'PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED'
      milestones: projectData.milestones || [],
      keyFiles: projectData.keyFiles || [],
      decisions: projectData.decisions || [],
      dependencies: projectData.dependencies || [],
      bugsAndFixes: projectData.bugsAndFixes || [],
      nextSteps: projectData.nextSteps || [],
      deadline: projectData.deadline || null,
      updatedAt: now,
      createdAt: projectData.createdAt || now
    };

    // Save in projects table
    this.db.saveProject({
      id,
      projectName: name,
      objective: projectPayload.objective,
      architecture: projectPayload.architecture,
      status: projectPayload.status,
      milestones: projectPayload.milestones,
      keyFiles: projectPayload.keyFiles,
      decisions: projectPayload.decisions,
      bugsAndFixes: projectPayload.bugsAndFixes,
      nextSteps: projectPayload.nextSteps
    });

    // Save persistent semantic memory record of active project state
    this.db.saveMemory({
      id: `mem_proj_${id}`,
      fact: `Project "${name}": Status=${projectPayload.status}. Objective=${projectPayload.objective}`,
      category: 'project',
      recordType: RECORD_TYPES.DECISION,
      confidenceClass: CONFIDENCE_CLASSES.SOURCE_VERIFIED,
      epistemicType: EPISTEMIC_TYPES.PROJECT_PROGRESS,
      memoryLayer: MEMORY_LAYERS.PROJECT,
      validFrom: now,
      isCurrent: 1,
      source: 'project_intelligence',
      domainTags: ['project', id, name.toLowerCase()],
      metadata: projectPayload
    });

    this.cache.projects.set(id, projectPayload);
    return projectPayload;
  }

  getProject(projectIdOrName) {
    if (!projectIdOrName) return null;
    const all = this.getAllProjects();
    const target = String(projectIdOrName).toLowerCase().trim();

    return all.find(p => 
      p.id.toLowerCase() === target ||
      p.projectName.toLowerCase() === target ||
      (Array.isArray(p.aliases) && p.aliases.some(a => a.toLowerCase() === target))
    ) || null;
  }

  getAllProjects(statusFilter = null) {
    const list = this.db.listProjects();
    let projects = list.map(p => {
      const cached = this.cache.projects.get(p.id);
      let aliases = cached ? cached.aliases : [];
      if (!aliases || aliases.length === 0) {
        const mem = this.db.getMemory(`mem_proj_${p.id}`);
        if (mem && mem.metadata && Array.isArray(mem.metadata.aliases)) {
          aliases = mem.metadata.aliases;
        }
      }
      return {
        id: p.id,
        projectName: p.project_name || p.projectName,
        aliases: aliases || [],
        status: p.status || 'IN_PROGRESS',
        objective: p.objective || '',
        architecture: p.architecture || '',
        milestones: typeof p.milestones === 'string' ? JSON.parse(p.milestones) : (p.milestones || []),
        keyFiles: typeof p.key_files === 'string' ? JSON.parse(p.key_files) : (p.keyFiles || []),
        decisions: typeof p.decisions === 'string' ? JSON.parse(p.decisions) : (p.decisions || []),
        nextSteps: typeof p.next_steps === 'string' ? JSON.parse(p.next_steps) : (p.nextSteps || []),
        updatedAt: p.updated_at || p.updatedAt
      };
    });

    if (statusFilter) {
      const sf = String(statusFilter).toUpperCase();
      projects = projects.filter(p => p.status === sf);
    }
    return projects;
  }

  recordProjectDecision(projectId, decisionText, rationale = '', artifacts = []) {
    const proj = this.getProject(projectId);
    if (!proj) throw new Error(`PROJECT_NOT_FOUND: Project "${projectId}" does not exist.`);

    const now = new Date().toISOString();
    const decisionEntry = {
      id: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      decision: decisionText,
      rationale,
      artifacts,
      timestamp: now
    };

    proj.decisions = proj.decisions || [];
    proj.decisions.push(decisionEntry);
    this.createOrUpdateProject(proj);

    // Save linked memory in PROJECT layer
    this.db.saveMemory({
      id: `mem_dec_${decisionEntry.id}`,
      fact: `Decision for ${proj.projectName}: ${decisionText}. Rationale: ${rationale}`,
      category: 'project_decision',
      recordType: RECORD_TYPES.DECISION,
      confidenceClass: CONFIDENCE_CLASSES.USER_CONFIRMED,
      epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
      memoryLayer: MEMORY_LAYERS.PROJECT,
      validFrom: now,
      isCurrent: 1,
      source: 'user_decision',
      domainTags: ['project', proj.id, 'decision'],
      metadata: decisionEntry
    });

    return decisionEntry;
  }

  // =========================================================================
  // 3. GOALS AND PLANS INTELLIGENCE
  // =========================================================================

  setGoal(goalData = {}) {
    const now = new Date().toISOString();
    const id = goalData.id || `goal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const title = goalData.title || 'Untitled Goal';
    const category = goalData.category || 'WORK'; // 'SHORT_TERM', 'LONG_TERM', 'LEARNING', 'WORK'
    const progress = Number(goalData.progress || 0);

    const goal = {
      id,
      title,
      category,
      targetDate: goalData.targetDate || null,
      progress,
      status: progress >= 100 ? 'COMPLETED' : (goalData.status || 'ACTIVE'),
      milestones: goalData.milestones || [],
      projectId: goalData.projectId || null,
      notes: goalData.notes || '',
      updatedAt: now,
      createdAt: goalData.createdAt || now
    };

    this.db.saveMemory({
      id: `mem_goal_${id}`,
      fact: `Goal [${category}]: "${title}" (Progress: ${progress}%, Status: ${goal.status})`,
      category: 'goal',
      recordType: RECORD_TYPES.GOAL,
      confidenceClass: CONFIDENCE_CLASSES.USER_CONFIRMED,
      epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
      memoryLayer: MEMORY_LAYERS.SEMANTIC,
      validFrom: now,
      isCurrent: 1,
      source: 'user_goal_declaration',
      domainTags: ['goal', category.toLowerCase(), goal.projectId || 'general'],
      metadata: goal
    });

    return goal;
  }

  updateGoalProgress(goalId, progressPercent, notes = '') {
    const raw = this.db.getMemory(`mem_goal_${goalId}`);
    if (!raw) throw new Error(`GOAL_NOT_FOUND: Goal "${goalId}" does not exist.`);

    const meta = raw.metadata || {};
    meta.progress = Math.min(100, Math.max(0, Number(progressPercent)));
    meta.status = meta.progress >= 100 ? 'COMPLETED' : 'ACTIVE';
    if (notes) meta.notes = notes;
    meta.updatedAt = new Date().toISOString();

    return this.setGoal(meta);
  }

  getGoals(categoryFilter = null) {
    const memories = this.db.getValidMemories({
      recordType: RECORD_TYPES.GOAL
    });

    let goals = memories.map(m => m.metadata || {});
    if (categoryFilter) {
      const cf = String(categoryFilter).toUpperCase();
      goals = goals.filter(g => g.category === cf);
    }
    return goals;
  }

  // =========================================================================
  // 4. CONTEXT RELEVANCE FIREWALL
  // =========================================================================

  /**
   * Evaluates candidate memories against a specific task or prompt domain.
   * Strictly firewalls out unrelated personal facts from task executions.
   */
  filterContextForTask(taskSpec = {}, candidateMemories = []) {
    const domain = String(taskSpec.domain || taskSpec.taskType || 'GENERAL').toUpperCase();
    const activeProject = taskSpec.projectId ? String(taskSpec.projectId).toLowerCase() : null;
    const allowPersonal = Boolean(taskSpec.allowPersonalContext);

    const allowed = [];
    const blocked = [];
    const auditLog = [];

    for (const mem of candidateMemories) {
      const memLayer = mem.memoryLayer || mem.memory_layer || 'semantic';
      const recordType = mem.recordType || mem.record_type || 'FACT';
      const meta = mem.metadata || {};
      const domainTags = Array.isArray(mem.domainTags) ? mem.domainTags : (meta.domainTags || []);
      const tagsLower = domainTags.map(t => String(t).toLowerCase());

      // Rule 1: Epistemic separation - mark model inferred vs confirmed
      const isConfirmed = mem.confidenceClass === CONFIDENCE_CLASSES.USER_CONFIRMED ||
                          mem.epistemicType === EPISTEMIC_TYPES.USER_STATEMENT;

      // Rule 2: If task is purely engineering/coding/research and personal context is NOT requested:
      // Block personal lifestyle, communications, and social relationships
      if (!allowPersonal && (domain === 'ENGINEERING' || domain === 'CODING' || domain === 'RESEARCH')) {
        if (memLayer === MEMORY_LAYERS.USER_PREFERENCE && meta.prefCategory === 'communication') {
          blocked.push({
            id: mem.id,
            reason: 'FIREWALL_BLOCKED_PERSONAL_COMMUNICATION_IN_ENGINEERING_TASK'
          });
          auditLog.push(`[FIREWALL] Blocked communication preference "${mem.id}" from ${domain} task.`);
          continue;
        }
        if (tagsLower.includes('social') || tagsLower.includes('family') || tagsLower.includes('medical') || tagsLower.includes('personal_banter')) {
          blocked.push({
            id: mem.id,
            reason: 'FIREWALL_BLOCKED_UNRELATED_PERSONAL_DOMAIN'
          });
          auditLog.push(`[FIREWALL] Blocked personal tag "${mem.id}" from ${domain} task.`);
          continue;
        }
      }

      // Rule 3: Cross-project isolation
      // If task is bound to a specific project (e.g. 'proj_orion'), block facts exclusively belonging to another project
      if (activeProject && mem.category === 'project') {
        const memProj = (meta.projectId || meta.projectName || '').toLowerCase().replace(/^proj_/, '').replace(/_/g, ' ').trim();
        const activeNorm = activeProject.toLowerCase().replace(/^proj_/, '').replace(/_/g, ' ').trim();
        if (memProj && !memProj.includes(activeNorm) && !activeNorm.includes(memProj)) {
          blocked.push({
            id: mem.id,
            reason: `FIREWALL_BLOCKED_CROSS_PROJECT_ISOLATION: belongs to "${memProj}", active is "${activeNorm}"`
          });
          auditLog.push(`[FIREWALL] Blocked cross-project memory "${mem.id}" (${memProj} != ${activeNorm}).`);
          continue;
        }
      }

      // Rule 4: Outdated / superseded records are blocked from operational context
      if (mem.isCurrent === false || mem.epistemicType === EPISTEMIC_TYPES.OUTDATED || mem.confidenceClass === CONFIDENCE_CLASSES.SUPERSEDED) {
        blocked.push({
          id: mem.id,
          reason: 'FIREWALL_BLOCKED_SUPERSEDED_MEMORY'
        });
        auditLog.push(`[FIREWALL] Blocked superseded historical memory "${mem.id}".`);
        continue;
      }

      allowed.push({
        ...mem,
        _firewallClassification: isConfirmed ? 'USER_CONFIRMED' : 'MODEL_INFERRED'
      });
    }

    return {
      allowedCount: allowed.length,
      blockedCount: blocked.length,
      allowedMemories: allowed,
      blockedMemories: blocked,
      auditLog
    };
  }
}

module.exports = {
  PersonalContextEngine,
  personalContextEngineInstance: new PersonalContextEngine()
};
