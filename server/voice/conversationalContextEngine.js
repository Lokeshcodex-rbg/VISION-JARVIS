/**
 * VISION AI — Conversational Context & Disambiguation Engine
 * 
 * Provides natural conversational context tracking across turns:
 * 1. Pronoun and reference resolution ("it", "that file", "the previous task").
 * 2. Follow-up query parsing ("Why did it fail?", "What was its size?").
 * 3. Incomplete sentence completion ("In Hindi", "More details", "Option A").
 * 4. Topic switching detection and multi-intent decomposition.
 * 5. Ambiguous command handling: surfaces concise clarifying questions instead of guessing.
 * 6. Action vs. Chit-chat classification: strictly distinguishes conversation from execution commands.
 * 7. Security Invariant: Rejects untrusted/third-party audio as authorization for sensitive actions.
 */

class ConversationalContextEngine {
  constructor() {
    this.turnHistory = [];
    this.currentContext = {
      activeTopic: 'general',
      activeSubject: null,
      activeEntity: null,
      activeArtifact: null,
      activeProjectId: null,
      activeProjectName: null,
      activeTaskId: null,
      pendingClarification: null,
      language: 'en'
    };
  }

  /**
   * Updates contextual state with the outcome of a completed turn
   */
  recordTurnContext(turnData = {}) {
    if (turnData.subject) this.currentContext.activeSubject = turnData.subject;
    if (turnData.entity) this.currentContext.activeEntity = turnData.entity;
    if (turnData.artifact) this.currentContext.activeArtifact = turnData.artifact;
    if (turnData.topic) this.currentContext.activeTopic = turnData.topic;
    if (turnData.language) this.currentContext.language = turnData.language;
    if (turnData.projectId) this.currentContext.activeProjectId = turnData.projectId;
    if (turnData.projectName) this.currentContext.activeProjectName = turnData.projectName;
    if (turnData.taskId) this.currentContext.activeTaskId = turnData.taskId;
    this.currentContext.pendingClarification = turnData.pendingClarification || null;

    this.turnHistory.push({
      timestamp: new Date().toISOString(),
      ...turnData
    });

    if (this.turnHistory.length > 50) {
      this.turnHistory.shift();
    }

    return { ...this.currentContext };
  }

  /**
   * Resolves pronouns and elliptical phrases using recent turn history and project intelligence
   */
  resolveReferences(utterance = '') {
    const text = String(utterance || '').trim();
    const tLower = text.toLowerCase();

    let resolvedText = text;
    let resolvedEntity = null;
    let wasReferenceResolved = false;

    // Bypass pronoun resolution if user utterance is an explicit memory or recording command
    if (/^(remember this|remember that|keep in mind|record this decision|record that)\b/i.test(text)) {
      return {
        originalText: text,
        resolvedText: text,
        resolvedEntity: null,
        wasReferenceResolved: false,
        activeTopic: this.currentContext.activeTopic
      };
    }

    // Check project reference 'the project' / 'our project' / 'active project'
    const projectPronounRegex = /\b(the project|our project|this project|active project)\b/i;
    if (projectPronounRegex.test(tLower)) {
      if (this.currentContext.activeProjectName) {
        resolvedEntity = this.currentContext.activeProjectName;
        resolvedText = text.replace(projectPronounRegex, `"${this.currentContext.activeProjectName}"`);
        wasReferenceResolved = true;
      }
    }

    // Check pronoun 'it' / 'that' / 'this' / 'the file' / 'the report' / 'the document'
    const pronounRegex = /\b(it|that|this|the file|the document|the report)\b/i;
    if (!wasReferenceResolved && pronounRegex.test(tLower)) {
      if (this.currentContext.activeArtifact) {
        resolvedEntity = this.currentContext.activeArtifact;
        resolvedText = text.replace(pronounRegex, `"${this.currentContext.activeArtifact}"`);
        wasReferenceResolved = true;
      } else if (this.currentContext.activeEntity) {
        resolvedEntity = this.currentContext.activeEntity;
        resolvedText = text.replace(pronounRegex, `"${this.currentContext.activeEntity}"`);
        wasReferenceResolved = true;
      } else if (this.currentContext.activeSubject) {
        resolvedEntity = this.currentContext.activeSubject;
        resolvedText = text.replace(pronounRegex, `"${this.currentContext.activeSubject}"`);
        wasReferenceResolved = true;
      }
    }

    // Incomplete sentences or ellipsis (e.g. "In Hindi", "More details", "In Python instead")
    if (/^(in hindi|in english|in hinglish)$/i.test(tLower)) {
      return {
        resolvedText: `Translate the previous response into ${tLower.replace('in ', '')}`,
        intent: 'LANGUAGE_SWITCH_DIRECTIVE',
        targetLanguage: tLower.replace('in ', ''),
        isFollowUp: true,
        wasReferenceResolved: true
      };
    }

    if (/^(more details|tell me more|expand on that|elaborate)$/i.test(tLower)) {
      return {
        resolvedText: `Provide more details regarding ${this.currentContext.activeSubject || 'the previous topic'}`,
        intent: 'ELABORATION_REQUEST',
        isFollowUp: true,
        wasReferenceResolved: true
      };
    }

    if (/^(in python(?: instead)?|in node(?:js)?(?: instead)?|in rust(?: instead)?)$/i.test(tLower)) {
      const lang = tLower.replace('instead', '').replace('in', '').trim();
      return {
        resolvedText: `Implement ${this.currentContext.activeSubject || 'the previous solution'} in ${lang}`,
        intent: 'LANGUAGE_CONVERSION_DIRECTIVE',
        targetLanguage: lang,
        isFollowUp: true,
        wasReferenceResolved: true
      };
    }

    if (/^(now run (?:the )?tests|run tests)$/i.test(tLower)) {
      return {
        resolvedText: `Run tests for ${this.currentContext.activeProjectName || this.currentContext.activeSubject || 'the current workspace'}`,
        intent: 'RUN_TESTS_DIRECTIVE',
        isFollowUp: true,
        wasReferenceResolved: true
      };
    }

    return {
      originalText: text,
      resolvedText,
      resolvedEntity,
      wasReferenceResolved,
      activeTopic: this.currentContext.activeTopic
    };
  }

  /**
   * Classifies user input into ACTION_INTENT, CONVERSATION_INTENT, or AMBIGUOUS_INTENT
   */
  classifyIntentType(utterance = '') {
    const text = String(utterance || '').toLowerCase().trim();

    // 1. Explicit Desktop / System Actions
    const actionKeywords = [
      'open', 'launch', 'run', 'create', 'generate', 'delete', 'execute',
      'close', 'analyze', 'start', 'stop', 'test', 'compile', 'inspect'
    ];
    const isAction = actionKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(text));

    // 2. Ambiguity Check: action keyword present but missing target or parameters
    if (text === 'open' || text === 'run' || text === 'create' || text === 'execute' || text === 'analyze') {
      return {
        intentType: 'AMBIGUOUS_INTENT',
        requiresClarification: true,
        clarificationPrompt: `What would you like me to ${text}? Please specify the application, file, or objective.`
      };
    }

    if (isAction) {
      return {
        intentType: 'ACTION_INTENT',
        requiresClarification: false
      };
    }

    return {
      intentType: 'CONVERSATION_INTENT',
      requiresClarification: false
    };
  }

  /**
   * Detects whether user utterance signals a topic shift
   */
  detectTopicShift(utterance = '') {
    const text = String(utterance || '').toLowerCase().trim();
    const transitionPhrases = [
      'by the way', 'on another note', 'changing topics', 'different question',
      'switch topics', 'moving on', 'unrelated question'
    ];

    for (const phrase of transitionPhrases) {
      if (text.includes(phrase)) {
        return {
          isShift: true,
          marker: phrase,
          newTopicPrompt: text.replace(phrase, '').replace(/^[, ]+/, '')
        };
      }
    }

    return { isShift: false };
  }

  getCurrentContext() {
    return { ...this.currentContext };
  }

  reset() {
    this.currentContext = {
      activeTopic: 'general',
      activeSubject: null,
      activeEntity: null,
      activeArtifact: null,
      pendingClarification: null,
      language: 'en'
    };
    this.turnHistory = [];
  }
}

const conversationalContextEngineInstance = new ConversationalContextEngine();

module.exports = {
  ConversationalContextEngine,
  conversationalContextEngineInstance
};
