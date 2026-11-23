/**
 * VISION AI — Shared Conversation History & Multi-Turn Continuity Manager
 * Maintains a unified chronological conversation history across both JARVIS and ULTRON.
 * Features:
 * 1. Stable turn identifiers (turn_1, turn_2) and unique message IDs.
 * 2. Rolling context summarization to preserve long-session context without blowing context windows.
 * 3. Protection against duplicate user messages and duplicated model responses.
 * 4. Association of tool execution results with conversation turns.
 * 5. Full session export, import, and reset capabilities.
 */

class ConversationManager {
  constructor(maxHistoryLength = 25) {
    this.maxHistoryLength = maxHistoryLength;
    this.sharedHistory = [];
    this.histories = {
      JARVIS: [],
      ULTRON: []
    };
    this.currentTurnIndex = 0;
    this.rollingSummary = '';
  }

  /**
   * Returns conversation history formatted for LLM context.
   * If a rolling summary exists for older condensed turns, it is prepended.
   */
  getHistory(personality, options = { shared: true }) {
    if (options && options.shared === false) {
      return this.histories[personality] || [];
    }

    const messages = [];

    // Prepend rolling summary if older context was condensed
    if (this.rollingSummary) {
      messages.push({
        role: 'system',
        content: `[SUMMARY OF PRIOR CONVERSATION TURNS]:\n${this.rollingSummary}`
      });
    }

    // Return chronological messages formatted with speaker attribution
    for (const entry of this.sharedHistory) {
      if (entry.role === 'user') {
        messages.push({
          role: 'user',
          turnId: entry.turnId,
          content: entry.content,
          timestamp: entry.timestamp
        });
      } else {
        const speaker = entry.personality || 'ASSISTANT';
        const content = (speaker !== personality)
          ? `[${speaker}]: ${entry.content}`
          : entry.content;
        messages.push({
          role: 'assistant',
          turnId: entry.turnId,
          personality: speaker,
          content,
          toolResult: entry.toolResult || null,
          timestamp: entry.timestamp
        });
      }
    }

    return messages;
  }

  /**
   * Returns full raw shared history
   */
  getSharedHistory() {
    return [...this.sharedHistory];
  }

  getTurnCount() {
    return this.currentTurnIndex;
  }

  /**
   * Records a user or assistant message with stable turn ID, dedup checks, and rolling condensation
   */
  addMessage(personality, role, content, metadata = {}) {
    const cleanContent = String(content || '').trim();
    if (!cleanContent) return null;

    // Duplicate message guard: Avoid duplicate consecutive identical messages
    const lastMsg = this.sharedHistory[this.sharedHistory.length - 1];
    if (lastMsg && lastMsg.role === role && lastMsg.content === cleanContent && (Date.now() - lastMsg.timestamp < 1500)) {
      return lastMsg;
    }

    if (role === 'user') {
      this.currentTurnIndex++;
    }

    const currentTurn = `turn_${this.currentTurnIndex}`;
    const entry = {
      id: 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      turnId: currentTurn,
      personality: (personality === 'ULTRON') ? 'ULTRON' : 'JARVIS',
      role: role === 'user' ? 'user' : 'assistant',
      content: cleanContent,
      toolResult: metadata.toolResult || null,
      timestamp: Date.now()
    };

    // 1. Add to shared chronological ledger
    this.sharedHistory.push(entry);

    // 2. Rolling Context Summarization:
    // When history exceeds 20 items (10 turns), condense the oldest turns into rollingSummary
    if (this.sharedHistory.length > 20) {
      this.condenseOldTurns();
    }

    // 3. Add to personality-specific ledger for legacy callers
    if (!this.histories[entry.personality]) {
      this.histories[entry.personality] = [];
    }
    this.histories[entry.personality].push({
      role: entry.role,
      content: entry.content,
      turnId: entry.turnId,
      timestamp: entry.timestamp
    });
    if (this.histories[entry.personality].length > this.maxHistoryLength * 2) {
      this.histories[entry.personality] = this.histories[entry.personality].slice(-this.maxHistoryLength * 2);
    }

    return entry;
  }

  /**
   * Adds a complete conversation turn (user + assistant) to history
   */
  addTurn(turnData = {}) {
    const personality = turnData.personality || 'JARVIS';
    const userMsg = turnData.userMessage || turnData.user || turnData.text;
    const assistantMsg = turnData.jarvisResponse || turnData.assistant || turnData.response;
    if (userMsg) {
      this.addMessage(personality, 'user', userMsg);
    }
    if (assistantMsg) {
      this.addMessage(personality, 'assistant', assistantMsg);
    }
    return { turnCount: this.getTurnCount() };
  }

  /**
   * Condenses the oldest conversation turns into a persistent summary string
   */
  condenseOldTurns() {
    const itemsToCondense = this.sharedHistory.splice(0, 6);
    const summaryLines = [];

    itemsToCondense.forEach(item => {
      const speaker = item.role === 'user' ? 'User' : item.personality;
      const snippet = item.content.length > 120 ? item.content.slice(0, 117) + '...' : item.content;
      summaryLines.push(`${speaker}: ${snippet}`);
    });

    if (this.rollingSummary) {
      this.rollingSummary += '\n' + summaryLines.join('\n');
    } else {
      this.rollingSummary = summaryLines.join('\n');
    }

    // Keep rolling summary within reasonable bounds (~1500 characters)
    if (this.rollingSummary.length > 1500) {
      this.rollingSummary = this.rollingSummary.slice(-1200);
    }
  }

  /**
   * Clears history for a specific personality or entirely
   */
  clearHistory(personality = null) {
    if (personality) {
      const p = (personality === 'ULTRON') ? 'ULTRON' : 'JARVIS';
      this.histories[p] = [];
      this.sharedHistory = this.sharedHistory.filter(m => m.personality !== p || m.role === 'user');
    } else {
      this.sharedHistory = [];
      this.histories.JARVIS = [];
      this.histories.ULTRON = [];
      this.currentTurnIndex = 0;
      this.rollingSummary = '';
    }
  }

  /**
   * Exports full session state
   */
  exportSession() {
    return {
      exportedAt: new Date().toISOString(),
      turnCount: this.currentTurnIndex,
      rollingSummary: this.rollingSummary,
      historyCount: this.sharedHistory.length,
      history: [...this.sharedHistory]
    };
  }

  /**
   * Imports a previously exported session
   */
  importSession(sessionData) {
    if (!sessionData || !Array.isArray(sessionData.history)) {
      throw new Error('Invalid session data format.');
    }
    this.sharedHistory = sessionData.history;
    this.rollingSummary = sessionData.rollingSummary || '';
    this.currentTurnIndex = sessionData.turnCount || Math.ceil(this.sharedHistory.length / 2);
    return { success: true, turnsLoaded: this.currentTurnIndex };
  }
}

module.exports = {
  ConversationManager,
  conversationManagerInstance: new ConversationManager()
};
