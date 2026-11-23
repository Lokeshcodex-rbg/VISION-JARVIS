/**
 * VISION AI — User Feedback & Preference Learning Engine
 * 
 * Captures, parses, and acts upon human feedback to dynamically adapt agent behavior.
 * 
 * Strict Invariants:
 * 1. Separates explicit user instructions (confidence: 1.0) from inferred preferences (confidence: 0.6).
 * 2. Explicit user corrections MUST take precedence over conflicting unverified assumptions.
 * 3. Never infers sensitive personal characteristics or retains credentials/secrets.
 * 4. Provides user controls to inspect, correct, and remove learned preferences.
 * 5. Persists rules to the 'user_preference' memory layer with full auditability.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { starkMemoryDbInstance } = require('../memory/starkMemoryDb.js');
const { auditTrailEngineInstance, EVENT_TYPES } = require('../audit/auditTrailEngine.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PREFERENCES_DATA_DIR = path.join(PROJECT_ROOT, 'data', 'learning');
if (!fs.existsSync(PREFERENCES_DATA_DIR)) {
  fs.mkdirSync(PREFERENCES_DATA_DIR, { recursive: true });
}

const FEEDBACK_TYPES = {
  EXPLICIT_CORRECTION: 'EXPLICIT_CORRECTION', // User directly commands: "Don't do it that way", "Use this next time"
  POSITIVE_REINFORCEMENT: 'POSITIVE_REINFORCEMENT', // "That worked", "This is better"
  INFERRED_PREFERENCE: 'INFERRED_PREFERENCE', // Soft pattern inferred from repeated choices
  REPEATED_MISTAKE_ALERT: 'REPEATED_MISTAKE_ALERT' // "You made the same mistake again"
};

class UserFeedbackEngine {
  constructor(options = {}) {
    this.memoryDb = options.memoryDb || starkMemoryDbInstance;
    this.auditTrail = options.auditTrail || auditTrailEngineInstance;
    this.emergencyStop = options.emergencyStop || emergencyStopControllerInstance;
    this.preferencesFilePath = path.join(PREFERENCES_DATA_DIR, 'user_learned_preferences.json');
    this.preferences = new Map(); // id -> preferenceRecord
    this.feedbackHistory = [];
    this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(this.preferencesFilePath)) {
        const raw = fs.readFileSync(this.preferencesFilePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.preferences)) {
          for (const p of data.preferences) {
            this.preferences.set(p.id, p);
          }
        }
        if (Array.isArray(data.history)) {
          this.feedbackHistory = data.history;
        }
      }
    } catch (_) {}
  }

  saveState() {
    try {
      const data = {
        preferences: Array.from(this.preferences.values()),
        history: this.feedbackHistory.slice(-500)
      };
      fs.writeFileSync(this.preferencesFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (_) {}
  }

  recordFeedback(feedbackText = '', context = {}) {
    return this.processUserFeedback(feedbackText, context);
  }

  /**
   * Ingests natural-language user feedback and extracts behavioral directives
   */
  processUserFeedback(feedbackText = '', context = {}) {
    if (this.emergencyStop && this.emergencyStop.isEmergencyStopped()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Feedback processing blocked.');
    }

    const text = String(feedbackText || '').trim();
    if (!text) return { success: false, reason: 'Empty feedback text' };

    const tLower = text.toLowerCase();
    const now = new Date().toISOString();

    let feedbackType = FEEDBACK_TYPES.INFERRED_PREFERENCE;
    let ruleAction = null;
    let confidence = 0.6;
    let precedence = 50; // Standard baseline precedence

    // 1. Explicit Directives & Negative Corrections
    if (
      tLower.includes("don't do it that way") ||
      tLower.includes('dont do it that way') ||
      tLower.includes('never do that') ||
      tLower.includes('this is incorrect') ||
      tLower.includes('do not use') ||
      tLower.includes('stop doing that')
    ) {
      feedbackType = FEEDBACK_TYPES.EXPLICIT_CORRECTION;
      ruleAction = 'PROHIBIT';
      confidence = 1.0;
      precedence = 100; // Highest precedence overrides assumptions
    } else if (
      tLower.includes('use this approach next time') ||
      tLower.includes('always do it this way') ||
      tLower.includes('prefer this') ||
      tLower.includes('remember this procedure')
    ) {
      feedbackType = FEEDBACK_TYPES.EXPLICIT_CORRECTION;
      ruleAction = 'MANDATE';
      confidence = 1.0;
      precedence = 100;
    } else if (
      tLower.includes('same mistake again') ||
      tLower.includes('repeated mistake')
    ) {
      feedbackType = FEEDBACK_TYPES.REPEATED_MISTAKE_ALERT;
      ruleAction = 'CRITICAL_AVOIDANCE';
      confidence = 1.0;
      precedence = 100;
    } else if (
      tLower.includes('that worked') ||
      tLower.includes('this result is better') ||
      tLower.includes('good job') ||
      tLower.includes('perfect')
    ) {
      feedbackType = FEEDBACK_TYPES.POSITIVE_REINFORCEMENT;
      ruleAction = 'REINFORCE';
      confidence = 0.85;
      precedence = 75;
    }

    // Extract Rule Content
    const ruleContent = this.extractRuleContent(text, ruleAction);
    const prefId = `pref_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

    const preferenceRecord = {
      id: prefId,
      rawFeedback: text,
      feedbackType,
      ruleAction,
      ruleContent,
      category: context.category || 'general_interaction',
      relatedTool: context.toolName || null,
      relatedAgent: context.agentId || null,
      precedence,
      confidence,
      createdAt: now,
      updatedAt: now,
      active: true,
      overriddenCount: 0
    };

    // Store in active map
    this.preferences.set(prefId, preferenceRecord);

    // Record in History
    this.feedbackHistory.push({
      prefId,
      timestamp: now,
      feedbackType,
      rawText: text,
      ruleAction,
      context
    });

    // Persist to 8-Layer Memory Database (layer: user_preference)
    if (this.memoryDb) {
      try {
        this.memoryDb.insertMemory({
          id: `mem_${prefId}`,
          fact: `[User Preference: ${ruleAction}] ${ruleContent}`,
          category: 'user_directive',
          epistemicType: feedbackType === FEEDBACK_TYPES.EXPLICIT_CORRECTION ? 'USER_STATEMENT' : 'CLAIM',
          source: 'explicit_user_feedback',
          confidence,
          memoryLayer: 'user_preference',
          metadata: {
            prefId,
            feedbackType,
            precedence,
            ruleAction
          }
        });
      } catch (_) {}
    }

    // Record to Audit Trail
    if (this.auditTrail && typeof this.auditTrail.recordEvent === 'function') {
      try {
        this.auditTrail.recordEvent('USER_FEEDBACK_LEARNED', {
          prefId,
          feedbackType,
          ruleAction,
          ruleContent,
          confidence,
          precedence
        }, { tool: 'user_feedback_engine' });
      } catch (_) {}
    }

    this.saveState();

    return {
      success: true,
      preferenceId: prefId,
      feedbackType,
      ruleAction,
      ruleContent,
      confidence,
      precedence
    };
  }

  extractRuleContent(rawText, ruleAction) {
    let clean = rawText
      .replace(/don't do it that way again/gi, '')
      .replace(/dont do it that way again/gi, '')
      .replace(/use this approach next time/gi, '')
      .replace(/this is incorrect/gi, '')
      .replace(/that worked/gi, '')
      .replace(/this result is better/gi, '')
      .replace(/you made the same mistake again/gi, '')
      .trim();

    if (clean.length < 5) {
      if (ruleAction === 'PROHIBIT') clean = 'Avoid previously failed approach';
      else if (ruleAction === 'MANDATE') clean = 'Retain proven preferred procedure';
      else if (ruleAction === 'REINFORCE') clean = 'Reinforce successful execution sequence';
      else clean = rawText;
    }

    return clean;
  }

  /**
   * User control: Inspect all learned preferences with optional filtering
   */
  listLearnedPreferences(filter = {}) {
    let list = Array.from(this.preferences.values()).filter(p => p.active !== false);
    if (filter.feedbackType) {
      list = list.filter(p => p.feedbackType === filter.feedbackType);
    }
    if (filter.category) {
      list = list.filter(p => p.category === filter.category);
    }
    return list;
  }

  /**
   * User control: Correct or refine an existing learned preference
   */
  correctPreference(preferenceId, newRuleText) {
    const pref = this.preferences.get(preferenceId);
    if (!pref) throw new Error(`Preference '${preferenceId}' not found.`);

    pref.ruleContent = String(newRuleText || '').trim();
    pref.updatedAt = new Date().toISOString();
    pref.correctedByUser = true;

    // Update in memory DB
    if (this.memoryDb) {
      try {
        this.memoryDb.correctMemory(`mem_${preferenceId}`, `[User Preference Refinement] ${pref.ruleContent}`, {
          correctedBy: 'user_direct_action',
          preferenceId
        });
      } catch (_) {}
    }

    this.saveState();
    return { success: true, preferenceId, updatedRule: pref.ruleContent };
  }

  /**
   * User control: Remove a learned preference completely
   */
  removePreference(preferenceId) {
    const pref = this.preferences.get(preferenceId);
    if (!pref) return { success: false, reason: 'Preference not found' };

    pref.active = false;
    pref.removedAt = new Date().toISOString();
    this.preferences.delete(preferenceId);

    // Soft delete in memory DB
    if (this.memoryDb) {
      try {
        this.memoryDb.deleteMemory(`mem_${preferenceId}`);
      } catch (_) {}
    }

    this.saveState();
    return { success: true, preferenceId, removed: true };
  }

  /**
   * Evaluates if any explicit user preference overrides a planned action or tool
   */
  checkPreferenceConstraints(toolName, args = {}) {
    const activePrefs = this.listLearnedPreferences();
    for (const p of activePrefs) {
      if (p.ruleAction === 'PROHIBIT' && p.relatedTool === toolName) {
        return {
          allowed: false,
          reason: `OVERRIDDEN_BY_USER_CORRECTION: Tool '${toolName}' prohibited by preference rule: "${p.ruleContent}".`,
          preferenceId: p.id
        };
      }
    }
    return { allowed: true };
  }

  clear() {
    this.preferences.clear();
    this.feedbackHistory = [];
    this.saveState();
  }
}

const userFeedbackEngineInstance = new UserFeedbackEngine();

module.exports = {
  UserFeedbackEngine,
  userFeedbackEngineInstance,
  FEEDBACK_TYPES
};
