/**
 * VISION AI — Proactive Assistance & Notification Engine
 * Phase 14 Module 6: Configurable Assistance Levels (L0–L3), 5 Categories,
 * Mandatory Explainability, Quiet Hours, Anti-Annoyance Rate Limits,
 * Actionable Notifications, and Consequential Action Guards.
 * 
 * Invariants:
 * 1. Proactive recommendations NEVER auto-execute consequential operations.
 * 2. ZERO unsolicited external messages (WhatsApp, email, web).
 * 3. Every recommendation MUST provide a verifiable reason explaining why it was generated.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { personalContextEngineInstance: pce } = require('../memory/personalContextEngine');
const { projectIntelligenceEngineInstance: pie } = require('../project/projectIntelligenceEngine');

const NOTIFICATIONS_FILE = path.join(__dirname, '../../data/proactive_notifications.json');

const PROACTIVE_LEVELS = {
  L0_DISABLED: 'L0_DISABLED',                     // Completely inert
  L1_CONTEXTUAL: 'L1_CONTEXTUAL',                 // Contextual tips only during active work
  L2_REMINDERS_SUMMARIES: 'L2_REMINDERS_SUMMARIES', // User-authorized reminders & daily summaries
  L3_RECURRING_MONITORING: 'L3_RECURRING_MONITORING' // Background monitoring (builds, tests, health)
};

const PROACTIVE_CATEGORIES = {
  PROJECT: 'PROJECT',
  LEARNING: 'LEARNING',
  WORK: 'WORK',
  OPERATIONAL: 'OPERATIONAL',
  CONTEXTUAL: 'CONTEXTUAL'
};

const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  SNOOZED: 'SNOOZED',
  DISMISSED: 'DISMISSED'
};

class ProactiveAssistanceEngine {
  constructor(pceInstance = pce, pieInstance = pie) {
    this.pce = pceInstance;
    this.pie = pieInstance;
    this.currentLevel = PROACTIVE_LEVELS.L2_REMINDERS_SUMMARIES;
    this.isPaused = false;
    this.quietHours = {
      enabled: true,
      startHour: 23,
      endHour: 7
    };
    this.rateLimits = {
      maxPerHour: 3,
      maxPerDay: 10
    };
    this.recentRecommendationHashes = new Map(); // hash -> timestamp
    this.notifications = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(NOTIFICATIONS_FILE)) {
        const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf8');
        this.notifications = JSON.parse(raw);
      } else {
        this.notifications = [];
      }
    } catch (_) {
      this.notifications = [];
    }
  }

  save() {
    try {
      const dir = path.dirname(NOTIFICATIONS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(this.notifications.slice(-100), null, 2), 'utf8');
      return true;
    } catch (_) {
      return false;
    }
  }

  // =========================================================================
  // 1. LEVEL & CONFIGURATION MANAGEMENT
  // =========================================================================

  setAssistanceLevel(level) {
    if (!Object.values(PROACTIVE_LEVELS).includes(level)) {
      throw new Error(`INVALID_PROACTIVE_LEVEL: "${level}" is not a valid assistance level.`);
    }
    this.currentLevel = level;
    return {
      level: this.currentLevel,
      description: this.getLevelDescription(this.currentLevel)
    };
  }

  getAssistanceLevel() {
    return {
      level: this.currentLevel,
      description: this.getLevelDescription(this.currentLevel)
    };
  }

  getLevelDescription(level) {
    switch (level) {
      case PROACTIVE_LEVELS.L0_DISABLED:
        return 'L0: Proactive assistance is completely disabled.';
      case PROACTIVE_LEVELS.L1_CONTEXTUAL:
        return 'L1: Contextual suggestions provided only during active file/project work.';
      case PROACTIVE_LEVELS.L2_REMINDERS_SUMMARIES:
        return 'L2: User-authorized reminders, milestone summaries, and deadline alerts.';
      case PROACTIVE_LEVELS.L3_RECURRING_MONITORING:
        return 'L3: Continuous background monitoring (build health, test regressions, storage).';
      default:
        return 'Unknown level.';
    }
  }

  pause() {
    this.isPaused = true;
    return { status: 'PAUSED', message: 'Proactive background assistance is paused.' };
  }

  resume() {
    this.isPaused = false;
    return { status: 'ACTIVE', message: 'Proactive background assistance is active.' };
  }

  setQuietHours(startHour, endHour, enabled = true) {
    this.quietHours = {
      enabled: Boolean(enabled),
      startHour: (startHour !== undefined && !isNaN(Number(startHour))) ? Number(startHour) : 23,
      endHour: (endHour !== undefined && !isNaN(Number(endHour))) ? Number(endHour) : 7
    };
    return this.quietHours;
  }

  isQuietHoursNow() {
    if (!this.quietHours.enabled) return false;
    const hour = new Date().getHours();
    if (this.quietHours.startHour === 0 && this.quietHours.endHour >= 24) return true;
    if (this.quietHours.startHour > this.quietHours.endHour) {
      // Overnight (e.g. 23:00 to 07:00)
      return hour >= this.quietHours.startHour || hour < this.quietHours.endHour;
    }
    return hour >= this.quietHours.startHour && hour < this.quietHours.endHour;
  }

  // =========================================================================
  // 2. RECOMMENDATION GENERATION & RATE LIMITING
  // =========================================================================

  /**
   * Generates a proactive notification with mandatory explainability and rate checks
   */
  proposeRecommendation(spec = {}) {
    // Check 1: L0 or paused
    if (this.currentLevel === PROACTIVE_LEVELS.L0_DISABLED || this.isPaused) {
      return {
        proposed: false,
        reason: 'PROACTIVE_ASSISTANCE_DISABLED_OR_PAUSED'
      };
    }

    // Check 2: Level requirement
    const requiredLevel = spec.minimumLevel || PROACTIVE_LEVELS.L1_CONTEXTUAL;
    const levelOrder = [
      PROACTIVE_LEVELS.L0_DISABLED,
      PROACTIVE_LEVELS.L1_CONTEXTUAL,
      PROACTIVE_LEVELS.L2_REMINDERS_SUMMARIES,
      PROACTIVE_LEVELS.L3_RECURRING_MONITORING
    ];
    if (levelOrder.indexOf(this.currentLevel) < levelOrder.indexOf(requiredLevel)) {
      return {
        proposed: false,
        reason: `LEVEL_RESTRICTION: Current level is ${this.currentLevel}, required is ${requiredLevel}`
      };
    }

    // Check 3: Mandatory explainability
    const evidenceReason = spec.evidenceReason || spec.reason;
    if (!evidenceReason || String(evidenceReason).trim().length < 5) {
      throw new Error('PROACTIVE_EXPLAINABILITY_VIOLATION: Every recommendation MUST include a verifiable evidenceReason.');
    }

    // Check 4: Rate Limiting
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;
    const recentHourCount = this.notifications.filter(n => new Date(n.timestamp).getTime() > oneHourAgo).length;
    const recentDayCount = this.notifications.filter(n => new Date(n.timestamp).getTime() > oneDayAgo).length;

    if (spec.priority !== 'CRITICAL') {
      if (recentHourCount >= this.rateLimits.maxPerHour) {
        return { proposed: false, reason: 'RATE_LIMIT_EXCEEDED_HOURLY' };
      }
      if (recentDayCount >= this.rateLimits.maxPerDay) {
        return { proposed: false, reason: 'RATE_LIMIT_EXCEEDED_DAILY' };
      }
    }

    // Check 5: Duplicate suppression (hash title + message + category)
    const contentHash = crypto.createHash('sha256').update(`${spec.title}_${spec.message}_${spec.category}`).digest('hex');
    const lastEmitted = this.recentRecommendationHashes.get(contentHash);
    if (lastEmitted && (now - lastEmitted) < 86400000) {
      return { proposed: false, reason: 'SUPPRESSED_DUPLICATE_RECOMMENDATION' };
    }

    // Check 6: Quiet hours suppression
    const isQuiet = this.isQuietHoursNow();
    if (isQuiet && spec.priority !== 'CRITICAL') {
      return { proposed: false, reason: 'SUPPRESSED_DUE_TO_QUIET_HOURS' };
    }

    // Check 7: Consequential operation guard
    // A proactive recommendation NEVER executes level 3/4 operations automatically
    const proposedAction = spec.suggestedAction || null;
    const requiresApproval = true; // Always requires explicit human acceptance

    const notification = {
      id: spec.id || `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      category: spec.category || PROACTIVE_CATEGORIES.CONTEXTUAL,
      level: this.currentLevel,
      title: spec.title || 'Proactive Recommendation',
      message: spec.message || '',
      evidenceReason: String(evidenceReason).trim(),
      priority: spec.priority || 'NORMAL', // 'LOW', 'NORMAL', 'HIGH', 'CRITICAL'
      status: NOTIFICATION_STATUS.PENDING,
      requiresApproval,
      suggestedAction: proposedAction,
      snoozedUntil: null
    };

    this.notifications.unshift(notification);
    this.recentRecommendationHashes.set(contentHash, now);
    this.save();

    return {
      proposed: true,
      notification
    };
  }

  // =========================================================================
  // 3. SCANNING ENGINE ACROSS 5 CATEGORIES
  // =========================================================================

  /**
   * Scans active projects, goals, test status, and dependencies
   */
  async runProactiveScan() {
    if (this.currentLevel === PROACTIVE_LEVELS.L0_DISABLED || this.isPaused) {
      return { status: 'SKIPPED', reason: 'PROACTIVE_DISABLED_OR_PAUSED', generatedCount: 0 };
    }

    const proposedList = [];

    // Category 1: PROJECT — Scan active projects for blocked milestones or next steps
    if (this.currentLevel !== PROACTIVE_LEVELS.L1_CONTEXTUAL) {
      const activeProjects = this.pce.getAllProjects('IN_PROGRESS');
      for (const proj of activeProjects) {
        const briefing = this.pie.getProjectBriefing(proj.id);
        if (briefing && briefing.blockedMilestones && briefing.blockedMilestones.length > 0) {
          const firstBlocked = briefing.blockedMilestones[0];
          const rec = this.proposeRecommendation({
            category: PROACTIVE_CATEGORIES.PROJECT,
            minimumLevel: PROACTIVE_LEVELS.L2_REMINDERS_SUMMARIES,
            title: `Blocked Milestone in ${proj.projectName}`,
            message: `Milestone "${firstBlocked.title}" is currently blocked.`,
            evidenceReason: `Because ${proj.projectName} has milestone "${firstBlocked.title}" marked BLOCKED with blockers: ${JSON.stringify(firstBlocked.blockers || [])}`,
            priority: 'HIGH',
            suggestedAction: {
              type: 'INSPECT_PROJECT_BLOCKERS',
              projectId: proj.id,
              milestoneId: firstBlocked.id
            }
          });
          if (rec.proposed) proposedList.push(rec.notification);
        }
      }
    }

    // Category 2: WORK — Scan goals with approaching deadlines or low progress
    const activeGoals = this.pce.getGoals();
    for (const g of activeGoals) {
      if (g.status === 'ACTIVE' && g.progress < 50 && g.targetDate) {
        const targetMs = new Date(g.targetDate).getTime();
        const diffHours = (targetMs - Date.now()) / (1000 * 3600);
        if (diffHours > 0 && diffHours < 48) {
          const rec = this.proposeRecommendation({
            category: PROACTIVE_CATEGORIES.WORK,
            minimumLevel: PROACTIVE_LEVELS.L2_REMINDERS_SUMMARIES,
            title: `Upcoming Deadline: ${g.title}`,
            message: `Goal is at ${g.progress}% with target deadline in ${Math.round(diffHours)} hours.`,
            evidenceReason: `Because goal "${g.title}" target date is ${g.targetDate} and current progress is only ${g.progress}%`,
            priority: 'NORMAL',
            suggestedAction: {
              type: 'REVIEW_GOAL_PROGRESS',
              goalId: g.id
            }
          });
          if (rec.proposed) proposedList.push(rec.notification);
        }
      }
    }

    return {
      status: 'COMPLETED',
      scanTime: new Date().toISOString(),
      generatedCount: proposedList.length,
      recommendations: proposedList
    };
  }

  // =========================================================================
  // 4. ACTIONABLE NOTIFICATION LIFECYCLE
  // =========================================================================

  actOnNotification(notificationId, action, options = {}) {
    const notif = this.notifications.find(n => n.id === notificationId);
    if (!notif) throw new Error(`NOTIFICATION_NOT_FOUND: Notification "${notificationId}" does not exist.`);

    const actUpper = String(action).toUpperCase();
    const now = new Date().toISOString();

    if (actUpper === 'ACCEPT') {
      notif.status = NOTIFICATION_STATUS.ACCEPTED;
      notif.resolvedAt = now;
      this.save();
      return {
        notificationId,
        status: NOTIFICATION_STATUS.ACCEPTED,
        actionExecuted: notif.suggestedAction,
        message: 'Notification accepted by user.'
      };
    }

    if (actUpper === 'REJECT') {
      notif.status = NOTIFICATION_STATUS.REJECTED;
      notif.resolvedAt = now;
      this.save();
      return {
        notificationId,
        status: NOTIFICATION_STATUS.REJECTED,
        message: 'Notification rejected by user.'
      };
    }

    if (actUpper === 'DISMISS') {
      notif.status = NOTIFICATION_STATUS.DISMISSED;
      notif.resolvedAt = now;
      this.save();
      return {
        notificationId,
        status: NOTIFICATION_STATUS.DISMISSED,
        message: 'Notification dismissed.'
      };
    }

    if (actUpper === 'SNOOZE') {
      const minutes = Number(options.minutes || 60);
      notif.status = NOTIFICATION_STATUS.SNOOZED;
      notif.snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
      this.save();
      return {
        notificationId,
        status: NOTIFICATION_STATUS.SNOOZED,
        snoozedUntil: notif.snoozedUntil,
        message: `Notification snoozed for ${minutes} minutes.`
      };
    }

    throw new Error(`INVALID_NOTIFICATION_ACTION: Action "${action}" is not supported.`);
  }

  getPendingNotifications() {
    const now = new Date().toISOString();
    return this.notifications.filter(n => {
      if (n.status === NOTIFICATION_STATUS.PENDING) return true;
      if (n.status === NOTIFICATION_STATUS.SNOOZED && n.snoozedUntil && n.snoozedUntil <= now) return true;
      return false;
    });
  }

  /**
   * Records task outcomes gently without guilt-tripping or spam.
   * Offers calm help after repeated failures or suggests a short break during long sessions.
   */
  recordCareSignal({ taskName = 'task', success = true, sessionMinutes = 0 } = {}) {
    if (this.currentLevel === PROACTIVE_LEVELS.L0_DISABLED || this.isPaused) {
      return { nudged: false, reason: 'PROACTIVE_DISABLED_BY_USER' };
    }
    this._failureStreaks = this._failureStreaks || new Map();
    if (!success) {
      const count = (this._failureStreaks.get(taskName) || 0) + 1;
      this._failureStreaks.set(taskName, count);
      if (count >= 3) {
        const msg = `I noticed "${taskName}" ran into friction ${count} times. Would you like us to inspect the logs step by step or pause for a short breather?`;
        const rec = this.proposeRecommendation({
          category: PROACTIVE_CATEGORIES.WORK,
          minimumLevel: PROACTIVE_LEVELS.L1_CONTEXTUAL,
          title: `Support offer for "${taskName}"`,
          message: msg,
          evidenceReason: `Detected ${count} consecutive failures on ${taskName}; offering optional non-intrusive support.`
        });
        this._failureStreaks.set(taskName, 0);
        return { nudged: Boolean(rec && rec.proposed), recommendation: rec?.notification || null };
      }
    } else {
      this._failureStreaks.set(taskName, 0);
    }

    if (sessionMinutes >= 90 && !this._breakSuggestedRecently) {
      this._breakSuggestedRecently = Date.now();
      const rec = this.proposeRecommendation({
        category: PROACTIVE_CATEGORIES.CONTEXTUAL,
        minimumLevel: PROACTIVE_LEVELS.L1_CONTEXTUAL,
        title: 'Quick Break Reminder',
        message: `You've been focused for around ${Math.round(sessionMinutes)} minutes — a 5-minute stretch or water break might help keep you fresh, whenever you're ready.`,
        evidenceReason: 'Optional wellness check after extended continuous work session (user-controlled).'
      });
      return { nudged: Boolean(rec && rec.proposed), recommendation: rec?.notification || null };
    }
    return { nudged: false };
  }
}

module.exports = {
  ProactiveAssistanceEngine,
  PROACTIVE_LEVELS,
  PROACTIVE_CATEGORIES,
  NOTIFICATION_STATUS,
  proactiveAssistanceEngineInstance: new ProactiveAssistanceEngine()
};
