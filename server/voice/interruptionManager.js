/**
 * VISION AI — Barge-In & Interruption Intelligence Manager
 * 
 * Manages real-time conversational turn-taking, barge-in interruption detection,
 * immediate audio stream cancellation, and context preservation when the user
 * speaks while the assistant is talking.
 * 
 * Invariants:
 * 1. Zero Overlapping Audio: When user speech is detected during assistant playback,
 *    audio output is stopped promptly (target < 100ms).
 * 2. Response Stream Cancellation: In-flight LLM token generation or tool dispatch
 *    associated with the interrupted turn is immediately halted.
 * 3. Interruption Classification: Analyzes new user utterance to classify whether it is
 *    an explicit cancel, a corrective modification, a new topic, or a clarification request.
 * 4. Clean Audio Teardown: Frees PCM audio buffers and resets playback state machines.
 */

const EventEmitter = require('events');
const { conversationalTtsEngineInstance } = require('./conversationalTtsEngine.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const INTERRUPTION_TYPES = {
  EXPLICIT_CANCEL: 'EXPLICIT_CANCEL',   // "Stop", "Cancel", "Never mind", "Halt"
  CORRECTION: 'CORRECTION',             // "No, I meant the other one", "Actually use Python"
  NEW_TOPIC: 'NEW_TOPIC',               // "Wait, what's the weather like?", "Check my calendar"
  CLARIFICATION: 'CLARIFICATION'        // "Wait, what did you say?", "Can you explain that?"
};

class InterruptionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.ttsEngine = options.ttsEngine || conversationalTtsEngineInstance;
    this.emergencyStop = options.emergencyStop || emergencyStopControllerInstance;
    this.interruptionHistory = [];
    this.totalInterruptions = 0;
    this.lastInterruptionLatencyMs = 0;
  }

  /**
   * Evaluates user utterance text to determine the interruption intent
   */
  classifyInterruptionIntent(userSpeechText = '') {
    const text = String(userSpeechText || '').toLowerCase().trim();

    // 1. Explicit cancellation commands
    if (/^(stop|cancel|halt|quiet|shut up|never mind|abort|pause speech)\b/i.test(text)) {
      return INTERRUPTION_TYPES.EXPLICIT_CANCEL;
    }

    // 2. Corrections and modifications
    if (/^(no|actually|wait no|instead|not that|i meant|rather than)\b/i.test(text)) {
      return INTERRUPTION_TYPES.CORRECTION;
    }

    // 3. Clarifications
    if (/^(what|repeat that|why|can you explain|what did you say)\b/i.test(text)) {
      return INTERRUPTION_TYPES.CLARIFICATION;
    }

    // 4. Default to new topic
    return INTERRUPTION_TYPES.NEW_TOPIC;
  }

  /**
   * Handles user barge-in event when user speech onset occurs during TTS playback
   */
  handleUserBargeIn(eventData = {}) {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      return { interrupted: false, reason: 'EMERGENCY_STOP_ACTIVE' };
    }

    const t0 = eventData.detectedAt || Date.now();
    const isAssistantSpeaking = this.ttsEngine.isPlaying;

    if (!isAssistantSpeaking) {
      // User started speaking while assistant was already silent: normal turn
      return {
        interrupted: false,
        wasPlaying: false,
        latencyMs: 0
      };
    }

    // 1. Immediately halt audio output to eliminate overlapping speech
    const stopResult = this.ttsEngine.stop('BARGE_IN_USER_SPEECH');
    const stopLatencyMs = Date.now() - t0;
    this.lastInterruptionLatencyMs = stopLatencyMs;

    // 2. Classify interruption intent if initial text is available
    const intent = this.classifyInterruptionIntent(eventData.transcript || eventData.initialText || '');

    const interruptionRecord = {
      id: `int_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      stopLatencyMs,
      intent,
      interruptedUtterance: stopResult.interruptedUtterance,
      transcript: eventData.transcript || null
    };

    this.totalInterruptions++;
    this.interruptionHistory.push(interruptionRecord);
    if (this.interruptionHistory.length > 100) {
      this.interruptionHistory.shift();
    }

    // 3. Emit interruption event for pipeline and UI listeners
    this.emit('interruption', interruptionRecord);

    return {
      interrupted: true,
      wasPlaying: true,
      stopLatencyMs,
      intent,
      interruptedUtterance: stopResult.interruptedUtterance
    };
  }

  getMetrics() {
    return {
      totalInterruptions: this.totalInterruptions,
      lastInterruptionLatencyMs: this.lastInterruptionLatencyMs,
      isAudioMutedOrStopped: !this.ttsEngine.isPlaying
    };
  }
}

const interruptionManagerInstance = new InterruptionManager();

module.exports = {
  InterruptionManager,
  interruptionManagerInstance,
  INTERRUPTION_TYPES
};

