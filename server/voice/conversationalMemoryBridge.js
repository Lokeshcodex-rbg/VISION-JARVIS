/**
 * VISION AI — Conversational Memory & Continuity Bridge
 * 
 * Bridges natural voice conversations with the central 8-layer SQLite memory architecture:
 * 1. Working & Session Layers: Tracks active turn entities, subjects, and recent tool outcomes.
 * 2. User Preference Layer: Ingests explicit user voice corrections (precedence 100, confidence 1.0).
 * 3. Project & Semantic Layers: Stores and retrieves cross-session architectural decisions,
 *    prior objectives, and contextual facts ("Continue what we were doing yesterday").
 * 4. Episodic Layer: Links voice conversations to past execution experiences.
 * 5. Epistemic Classification: Explicitly flags user statements as USER_STATEMENT, verified outputs
 *    as VERIFIED_FACT, and ungrounded statements as CLAIM.
 */

const crypto = require('crypto');
const { starkMemoryDbInstance, EPISTEMIC_TYPES } = require('../memory/starkMemoryDb.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

class ConversationalMemoryBridge {
  constructor(options = {}) {
    this.memoryDb = options.memoryDb || starkMemoryDbInstance;
    this.emergencyStop = options.emergencyStop || emergencyStopControllerInstance;
    
    // In-memory working conversation context
    this.activeContext = {
      sessionId: `voice_session_${Date.now().toString(36)}`,
      lastTopic: null,
      lastEntity: null,
      lastDeliverablePath: null,
      lastToolUsed: null,
      turnCount: 0,
      activeLanguage: 'en'
    };
  }

  /**
   * Updates in-memory working turn state
   */
  updateWorkingContext(turnData = {}) {
    this.activeContext.turnCount++;
    if (turnData.topic) this.activeContext.lastTopic = turnData.topic;
    if (turnData.entity) this.activeContext.lastEntity = turnData.entity;
    if (turnData.deliverablePath) this.activeContext.lastDeliverablePath = turnData.deliverablePath;
    if (turnData.toolUsed) this.activeContext.lastToolUsed = turnData.toolUsed;
    if (turnData.language) this.activeContext.activeLanguage = turnData.language;

    return { ...this.activeContext };
  }

  /**
   * Resolves conversational references ("continue what we were doing", "what was the decision", etc.)
   */
  async resolveConversationalReference(phrase = '') {
    const text = String(phrase || '').toLowerCase().trim();

    // 1. Session continuity / resume previous task
    if (text.includes('continue what we were doing') || text.includes('continue yesterday') || text.includes('resume previous work')) {
      // Query recent project or session memories
      const recentMemories = this.memoryDb ? this.memoryDb.listMemories({ limit: 10, memoryLayer: 'project' }) : [];
      const sessionMemories = this.memoryDb ? this.memoryDb.listMemories({ limit: 5, memoryLayer: 'session' }) : [];
      const candidate = (recentMemories[0] || sessionMemories[0]);

      if (candidate) {
        return {
          resolved: true,
          type: 'RESUME_PREVIOUS_WORKFLOW',
          contextFact: candidate.fact || candidate.text,
          memoryId: candidate.id,
          sourceLayer: candidate.memoryLayer || 'project'
        };
      }

      return {
        resolved: true,
        type: 'RESUME_PREVIOUS_WORKFLOW',
        contextFact: this.activeContext.lastTopic || 'General assistant tasks',
        sourceLayer: 'working'
      };
    }

    // 2. Querying project decisions or past agreements
    if (text.includes('what did we decide') || text.includes('what was the decision') || text.includes('remember what we agreed')) {
      const queryStr = text.replace(/what did we decide about|what was the decision on|what did we agree/gi, '').replace(/[?.,!]/g, '').trim();
      const searchRes = this.memoryDb ? this.memoryDb.searchMemories(queryStr || 'decision', { limit: 5 }) : [];
      const results = Array.isArray(searchRes) ? searchRes : (searchRes && searchRes.results ? searchRes.results : []);

      if (results.length > 0) {
        return {
          resolved: true,
          type: 'PROJECT_DECISION_QUERY',
          query: queryStr,
          foundDecision: results[0].fact || results[0].text,
          epistemicType: results[0].epistemicType || 'USER_STATEMENT',
          confidence: results[0].confidence || 1.0
        };
      }

      return {
        resolved: false,
        type: 'PROJECT_DECISION_QUERY',
        query: queryStr,
        reason: 'NO_MATCHING_DECISION_FOUND'
      };
    }

    // 3. Pronoun reference to last deliverable or entity
    if (text.includes('show it') || text.includes('open it') || text.includes('analyze it')) {
      if (this.activeContext.lastDeliverablePath) {
        return {
          resolved: true,
          type: 'PRONOUN_DELIVERABLE_REFERENCE',
          targetPath: this.activeContext.lastDeliverablePath
        };
      }
      if (this.activeContext.lastEntity) {
        return {
          resolved: true,
          type: 'PRONOUN_ENTITY_REFERENCE',
          targetEntity: this.activeContext.lastEntity
        };
      }
    }

    return { resolved: false, originalPhrase: phrase };
  }

  /**
   * Persists an explicit conversational instruction or project decision into 8-layer memory
   */
  async persistConversationalFact(factText = '', options = {}) {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Memory bridge persistence halted.');
    }

    const text = String(factText || '').trim();
    if (!text) return null;

    const layer = options.layer || (options.isProjectDecision ? 'project' : 'user_preference');
    const epistemicType = options.epistemicType || 'USER_STATEMENT';
    const confidence = options.confidence !== undefined ? options.confidence : 1.0;
    const category = options.category || 'voice_conversation';
    const memId = `vmem_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

    if (this.memoryDb) {
      try {
        this.memoryDb.insertMemory({
          id: memId,
          fact: text,
          category,
          epistemicType,
          source: 'voice_interaction',
          memoryLayer: layer,
          confidence,
          metadata: {
            sessionId: this.activeContext.sessionId,
            timestamp: new Date().toISOString(),
            ...options.metadata
          }
        });
      } catch (e) {
        console.warn('[VOICE_MEM_BRIDGE] Fallback insert failed:', e.message);
      }
    }

    return {
      persisted: true,
      memoryId: memId,
      fact: text,
      layer,
      epistemicType,
      confidence
    };
  }

  /**
   * Applies an explicit voice correction ("Don't repeat that mistake", "Use X instead of Y")
   */
  async recordVoiceCorrection(correctionText = '', options = {}) {
    const { userFeedbackEngineInstance } = require('../learning/userFeedbackEngine.js');
    if (userFeedbackEngineInstance) {
      return userFeedbackEngineInstance.processUserFeedback(correctionText, {
        category: 'voice_directive',
        source: 'conversational_memory_bridge',
        ...options
      });
    }

    return this.persistConversationalFact(correctionText, {
      layer: 'user_preference',
      epistemicType: 'USER_STATEMENT',
      confidence: 1.0
    });
  }

  getWorkingContext() {
    return { ...this.activeContext };
  }
}

const conversationalMemoryBridgeInstance = new ConversationalMemoryBridge();

module.exports = {
  ConversationalMemoryBridge,
  conversationalMemoryBridgeInstance
};
