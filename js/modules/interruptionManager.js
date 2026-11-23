/**
 * VISION AI — Central Interruption & Barge-in Controller
 * Single authoritative interruption state machine shared across JARVIS & ULTRON.
 * Manages rapid speech-onset confirmation, instant TTS cancellation,
 * response generation token invalidation, and single-dispatch new command routing.
 */

export const INTERRUPTION_STATES = {
  IDLE_LISTENING: 'IDLE_LISTENING',
  SPEECH_DETECTED: 'SPEECH_DETECTED',
  RECOGNITION_IN_PROGRESS: 'RECOGNITION_IN_PROGRESS',
  ASSISTANT_STREAMING: 'ASSISTANT_STREAMING',
  ASSISTANT_SPEAKING: 'ASSISTANT_SPEAKING',
  USER_BARGE_IN_DETECTED: 'USER_BARGE_IN_DETECTED',
  CANCELLING_OLD_RESPONSE: 'CANCELLING_OLD_RESPONSE',
  NEW_COMMAND_PROCESSING: 'NEW_COMMAND_PROCESSING',
  SLEEPING_MUTED: 'SLEEPING_MUTED'
};

export class InterruptionManager {
  constructor(options = {}) {
    this.speechSynthesizer = options.speechSynthesizer || null;
    this.aiClient = options.aiClient || null;
    this.smokeCaptions = options.smokeCaptions || null;
    this.onCommandDispatch = options.onCommandDispatch || null;
    this.onStateChange = options.onStateChange || null;

    this.state = INTERRUPTION_STATES.IDLE_LISTENING;
    this.generationId = 1; // Monotonic generation ID for response/speech gating
    this.activeUtteranceId = null;

    // Speech-onset confirmation window (tunable: 45ms to reject transient clicks)
    this.speechConfirmationWindowMs = options.speechConfirmationWindowMs || 45;
    this.lastSpeechOnsetTime = 0;
    this.bargeInPendingTimer = null;

    // Dispatched command deduplication
    this.lastDispatchedTranscript = '';
    this.lastDispatchTime = 0;
    this.dispatchCooldownMs = 300;

    // Telemetry timestamps
    this.telemetry = {
      firstSpeechDetectedAt: 0,
      firstInterimAt: 0,
      bargeInDetectedAt: 0,
      ttsCancelledAt: 0,
      commandDispatchedAt: 0,
      lastBargeInLatencyMs: 0
    };
  }

  setState(newState, meta = {}) {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(newState, oldState, meta);
    }
  }

  getState() {
    return this.state;
  }

  getCurrentGenerationId() {
    return this.generationId;
  }

  /**
   * Generates a new unique generation ID, instantly invalidating any prior responses
   */
  nextGeneration() {
    this.generationId++;
    return this.generationId;
  }

  /**
   * Checks whether a response chunk or speech callback belongs to the current active generation
   */
  isValidGeneration(genId) {
    return genId === this.generationId;
  }

  notifyStreamingStart(generationId) {
    this.setState(INTERRUPTION_STATES.ASSISTANT_STREAMING, { generationId });
  }

  notifySpeakingStart(generationId, utteranceId) {
    this.activeUtteranceId = utteranceId;
    this.setState(INTERRUPTION_STATES.ASSISTANT_SPEAKING, { generationId, utteranceId });
  }

  notifySpeakingEnd(generationId) {
    if (this.isValidGeneration(generationId)) {
      this.activeUtteranceId = null;
      if (this.state === INTERRUPTION_STATES.ASSISTANT_SPEAKING || this.state === INTERRUPTION_STATES.ASSISTANT_STREAMING) {
        this.setState(INTERRUPTION_STATES.IDLE_LISTENING);
      }
    }
  }

  notifyMutedOrSleeping() {
    this.setState(INTERRUPTION_STATES.SLEEPING_MUTED);
  }

  notifyWakeListening() {
    this.setState(INTERRUPTION_STATES.IDLE_LISTENING);
  }

  /**
   * Called when live microphone VAD or interim recognition detects user speech onset
   */
  notifyUserSpeechOnset(source = 'VAD', meta = {}) {
    const now = performance.now();
    this.lastSpeechOnsetTime = now;
    if (!this.telemetry.firstSpeechDetectedAt) {
      this.telemetry.firstSpeechDetectedAt = now;
    }

    const isSpeakingOrStreaming = this.state === INTERRUPTION_STATES.ASSISTANT_SPEAKING ||
                                  this.state === INTERRUPTION_STATES.ASSISTANT_STREAMING;

    if (isSpeakingOrStreaming) {
      // Evaluate barge-in
      this.triggerBargeIn(source, meta);
    } else if (this.state === INTERRUPTION_STATES.IDLE_LISTENING) {
      this.setState(INTERRUPTION_STATES.SPEECH_DETECTED, { source });
    }
  }

  /**
   * Immediately executes barge-in: cancels TTS, cancels AI stream, increments generation ID
   */
  triggerBargeIn(triggerReason = 'USER_BARGE_IN', meta = {}) {
    const now = performance.now();
    this.telemetry.bargeInDetectedAt = now;

    console.log(`[INTERRUPTION] Real-time barge-in triggered (${triggerReason}). Cancelling current assistant speech.`);

    this.setState(INTERRUPTION_STATES.USER_BARGE_IN_DETECTED, { triggerReason, ...meta });

    // 1. Advance generation ID immediately so late-arriving SSE or speech callbacks are dropped
    const oldGen = this.generationId;
    const newGen = this.nextGeneration();

    this.setState(INTERRUPTION_STATES.CANCELLING_OLD_RESPONSE, { oldGen, newGen });

    // 2. Immediately stop speech synthesizer and purge queue
    if (this.speechSynthesizer) {
      this.speechSynthesizer.stopSpeaking(newGen);
    }
    this.telemetry.ttsCancelledAt = performance.now();
    this.telemetry.lastBargeInLatencyMs = Math.round(this.telemetry.ttsCancelledAt - now);

    // 3. Invalidate active AI stream request
    if (this.aiClient) {
      this.aiClient.cancelActiveRequest(newGen);
    }

    // 4. Clear smoke captions from old response cleanly
    if (this.smokeCaptions) {
      this.smokeCaptions.clear(true);
    }

    this.activeUtteranceId = null;
    this.setState(INTERRUPTION_STATES.RECOGNITION_IN_PROGRESS, { generationId: newGen });

    return newGen;
  }

  /**
   * Dispatches a new recognized command exactly once with debounce protection
   */
  dispatchCommand(command, rawTranscript = '') {
    const now = performance.now();
    const cleanTranscript = (rawTranscript || '').toLowerCase().trim();

    // Prevent immediate duplicate dispatches of the same command
    if (cleanTranscript && cleanTranscript === this.lastDispatchedTranscript && (now - this.lastDispatchTime < this.dispatchCooldownMs)) {
      return false;
    }

    this.lastDispatchedTranscript = cleanTranscript;
    this.lastDispatchTime = now;
    this.telemetry.commandDispatchedAt = now;

    this.setState(INTERRUPTION_STATES.NEW_COMMAND_PROCESSING, { command, transcript: rawTranscript });

    if (typeof this.onCommandDispatch === 'function') {
      this.onCommandDispatch(command, rawTranscript);
    }

    // Reset speech detected timestamp for next interaction
    this.telemetry.firstSpeechDetectedAt = 0;
    this.telemetry.firstInterimAt = 0;

    return true;
  }

  getTelemetry() {
    return {
      state: this.state,
      generationId: this.generationId,
      lastBargeInLatencyMs: this.telemetry.lastBargeInLatencyMs,
      activeUtteranceId: this.activeUtteranceId
    };
  }

  reset() {
    this.generationId++;
    this.activeUtteranceId = null;
    if (this.bargeInPendingTimer) {
      clearTimeout(this.bargeInPendingTimer);
      this.bargeInPendingTimer = null;
    }
    this.setState(INTERRUPTION_STATES.IDLE_LISTENING, { reason: 'RESET' });
  }
}
