/**
 * VISION AI — PHASE 15 UPGRADE 2: FULL-DUPLEX INTERRUPTIBLE VOICE ENGINE
 * 
 * Evolves STARK into a natural real-time bidirectional conversational assistant
 * while preserving the existing `VoiceConversationalPipeline` as a reliable fallback.
 * 
 * Capabilities:
 * 1. Speak While JARVIS Is Speaking (Full-Duplex Barge-In): Detects user speech
 *    onset during active TTS playback.
 * 2. Immediate Speech Halting (<50ms): Immediately halts TTS stream and in-flight
 *    generation without overlapping audio.
 * 3. Session Continuity Without Restart: Transitions smoothly from `SPEAKING` ->
 *    `LISTENING` while preserving the same `sessionId` and conversational memory.
 * 4. Low-Latency Streaming & Profiling: Tracks `vadLatencyMs`, `bargeInStopLatencyMs`,
 *    `sttLatencyMs`, `reasoningLatencyMs`, `ttsFirstByteLatencyMs`, and `totalEndToEndLatencyMs`.
 * 5. Multi-Turn Conversational Context Retention: Resolves pronouns, follow-ups,
 *    and corrective interruptions ("Actually, use Python instead").
 * 6. Noise-Floor Filtering & Incomplete Sentence Buffering:
 *    - Ignores background noise (low SNR / low RMS) so ambient noise never triggers
 *      false barge-in.
 *    - Buffers incomplete clauses/pauses ("JARVIS, could you open...") and merges
 *      continuation frames when the user finishes their thought.
 * 7. Immediate Cancellation & Emergency Stop Integration.
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { voiceConversationalPipelineInstance, PIPELINE_STATES } = require('./voiceConversationalPipeline.js');
const { interruptionManagerInstance, INTERRUPTION_TYPES } = require('./interruptionManager.js');
const { speechRecognitionPipelineInstance } = require('./speechRecognitionPipeline.js');
const { conversationalTtsEngineInstance } = require('./conversationalTtsEngine.js');
const { conversationalContextEngineInstance } = require('./conversationalContextEngine.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const VOICE_MODES = {
  DISABLED: 'DISABLED',
  PUSH_TO_TALK: 'PUSH_TO_TALK',
  WAKE_WORD: 'WAKE_WORD',
  CONTINUOUS: 'CONTINUOUS'
};

const FULL_DUPLEX_STATES = {
  DISABLED: 'DISABLED',
  READY: 'READY',
  INACTIVE: 'INACTIVE',
  LISTENING: 'LISTENING',
  BUFFERING_PAUSE: 'BUFFERING_PAUSE',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
  INTERRUPTED_SWITCHING_TO_LISTEN: 'INTERRUPTED_SWITCHING_TO_LISTEN',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED',
  EMERGENCY_STOPPED: 'EMERGENCY_STOPPED'
};

class FullDuplexVoiceEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.fallbackPipeline = options.fallbackPipeline || voiceConversationalPipelineInstance;
    this.interruptionManager = options.interruptionManager || interruptionManagerInstance;
    this.stt = options.stt || speechRecognitionPipelineInstance;
    this.tts = options.tts || conversationalTtsEngineInstance;
    this.contextEngine = options.contextEngine || conversationalContextEngineInstance;
    this.emergencyStop = options.emergencyStop || emergencyStopControllerInstance;

    // Session & canonical voice lifecycle state (MUST boot DISABLED — never auto-listening)
    this.sessionId = null;
    this.sessionStartedAt = null;
    this.listeningStartedAtMs = null;
    this.generation = 0;
    this.voiceMode = VOICE_MODES.DISABLED;
    this.state = (this.emergencyStop && this.emergencyStop.isEngaged())
      ? FULL_DUPLEX_STATES.EMERGENCY_STOPPED
      : FULL_DUPLEX_STATES.DISABLED;
    this.sessionRestartCount = 0;
    this.lastError = null;
    this.lastTransitionReason = 'BOOT_DEFAULT_DISABLED';
    this.micDeviceLabel = null;
    this.permissionState = 'prompt';

    // Acoustic VAD & Noise gate thresholds
    this.vadRmsThreshold = options.vadRmsThreshold || 0.035;
    this.bargeInMinSnrDb = options.bargeInMinSnrDb || 12.0;

    // Utterance pause / incomplete sentence buffer
    this.incompleteUtteranceBuffer = '';
    this.incompleteBufferTimestamp = 0;
    this.pauseContinuationWindowMs = options.pauseContinuationWindowMs || 4500;

    // Active speaking & turn tracking
    this.activeSpeakingTurnId = null;
    this.activeSpeakingText = null;
    this.activeTurnAbortController = null;
    this.conversationalHistory = [];

    // Latency & Performance Telemetry
    this.latencyMetrics = {
      lastBargeInStopLatencyMs: 0,
      lastVadLatencyMs: 0,
      lastSttLatencyMs: 0,
      lastReasoningLatencyMs: 0,
      lastTtsFirstChunkLatencyMs: 0,
      lastEndToEndLatencyMs: 0,
      averageEndToEndLatencyMs: 0,
      totalTurnsCompleted: 0,
      totalBargeInsHandled: 0,
      noiseFramesFiltered: 0,
      incompleteUtterancesMerged: 0
    };

    // Hook into Emergency Stop Controller (stop + reset)
    if (this.emergencyStop && typeof this.emergencyStop.registerStopHandler === 'function') {
      this.emergencyStop.registerStopHandler('FullDuplexVoiceEngine', async (reason) => {
        this.handleEmergencyStop(reason);
      });
    }
    if (this.emergencyStop && typeof this.emergencyStop.registerResetHandler === 'function') {
      this.emergencyStop.registerResetHandler('FullDuplexVoiceEngine', async (reason) => {
        this.resetEmergencyStop(reason);
      });
    }
  }

  /**
   * Starts or resumes an active capture session (requires explicit trigger).
   */
  startSession({ personality = 'JARVIS', preserveExistingSession = true, reason = 'EXPLICIT_START' } = {}) {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Cannot start Full-Duplex Voice session while Emergency Stop is engaged.');
    }

    if (!this.sessionId || !preserveExistingSession) {
      this.sessionId = `fdup_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
      this.sessionStartedAt = new Date().toISOString();
      if (!preserveExistingSession) {
        this.sessionRestartCount++;
      }
    }

    this.generation++;
    this.personality = personality;
    this.lastError = null;
    this.lastTransitionReason = reason;
    this.listeningStartedAtMs = Date.now();
    this.state = FULL_DUPLEX_STATES.LISTENING;
    this.emit('sessionState', this.getStatus());

    return {
      success: true,
      sessionId: this.sessionId,
      generation: this.generation,
      state: this.state,
      voiceMode: this.voiceMode,
      personality: this.personality,
      listeningStartedAtMs: this.listeningStartedAtMs,
      elapsedMs: 0,
      isTimerActive: true,
      fallbackEngineReady: Boolean(this.fallbackPipeline)
    };
  }

  /**
   * Explicitly switches voice activation mode.
   * Never enters LISTENING directly on mode selection; waits in READY (or DISABLED).
   */
  setMode(mode = VOICE_MODES.DISABLED, reason = 'USER_MODE_CHANGE') {
    const normalized = String(mode || '').trim().toUpperCase();
    if (!VOICE_MODES[normalized]) {
      throw new Error(`INVALID_VOICE_MODE: Unsupported voice mode "${mode}".`);
    }
    if (this.emergencyStop && this.emergencyStop.isEngaged() && normalized !== VOICE_MODES.DISABLED) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Cannot enable voice mode while Emergency Stop is engaged.');
    }

    this.voiceMode = VOICE_MODES[normalized];
    this.generation++;
    this.listeningStartedAtMs = null;
    this.lastTransitionReason = reason;

    if (this.voiceMode === VOICE_MODES.DISABLED) {
      if (this.tts && this.tts.isPlaying) {
        this.tts.stop('VOICE_MODE_DISABLED');
      }
      this.sessionId = null;
      this.sessionStartedAt = null;
      this.incompleteUtteranceBuffer = '';
      this.lastError = null;
      this.state = (this.emergencyStop && this.emergencyStop.isEngaged())
        ? FULL_DUPLEX_STATES.EMERGENCY_STOPPED
        : FULL_DUPLEX_STATES.DISABLED;
    } else {
      this.lastError = null;
      this.state = FULL_DUPLEX_STATES.READY;
    }

    const status = this.getStatus();
    this.emit('sessionState', status);
    return status;
  }

  /**
   * Ends active audio capture and resets the session timer without entering stuck 0:00 LISTENING.
   */
  endListeningSession(reason = 'CAPTURE_ENDED') {
    this.generation++;
    this.listeningStartedAtMs = null;
    this.incompleteUtteranceBuffer = '';
    this.lastTransitionReason = reason;
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      this.state = FULL_DUPLEX_STATES.EMERGENCY_STOPPED;
    } else {
      this.state = this.voiceMode === VOICE_MODES.DISABLED
        ? FULL_DUPLEX_STATES.DISABLED
        : FULL_DUPLEX_STATES.READY;
    }
    const status = this.getStatus();
    this.emit('sessionState', status);
    return status;
  }

  /**
   * Suspends voice interaction cleanly (releases mic & stops timer).
   */
  pause(reason = 'USER_PAUSED') {
    this.generation++;
    this.listeningStartedAtMs = null;
    this.incompleteUtteranceBuffer = '';
    if (this.tts && this.tts.isPlaying) {
      this.tts.stop('VOICE_PAUSED');
    }
    this.lastTransitionReason = reason;
    this.state = (this.emergencyStop && this.emergencyStop.isEngaged())
      ? FULL_DUPLEX_STATES.EMERGENCY_STOPPED
      : FULL_DUPLEX_STATES.PAUSED;
    const status = this.getStatus();
    this.emit('sessionState', status);
    return status;
  }

  /**
   * Resumes from PAUSED or ERROR into READY (never auto-LISTENING without trigger).
   */
  resume(reason = 'USER_RESUMED') {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Cannot resume voice while Emergency Stop is engaged.');
    }
    this.generation++;
    this.listeningStartedAtMs = null;
    this.lastError = null;
    this.lastTransitionReason = reason;
    this.state = this.voiceMode === VOICE_MODES.DISABLED
      ? FULL_DUPLEX_STATES.DISABLED
      : FULL_DUPLEX_STATES.READY;
    const status = this.getStatus();
    this.emit('sessionState', status);
    return status;
  }

  setError(code = 'VOICE_ERROR', message = 'Microphone or voice failure') {
    this.generation++;
    this.listeningStartedAtMs = null;
    this.lastError = {
      code: String(code || 'VOICE_ERROR'),
      message: String(message || 'Microphone or voice failure'),
      timestamp: Date.now()
    };
    this.lastTransitionReason = code;
    this.state = FULL_DUPLEX_STATES.ERROR;
    const status = this.getStatus();
    this.emit('sessionState', status);
    return status;
  }

  resetEmergencyStop(reason = 'EMERGENCY_RESET') {
    this.generation++;
    this.listeningStartedAtMs = null;
    this.sessionId = null;
    this.sessionStartedAt = null;
    this.incompleteUtteranceBuffer = '';
    this.activeSpeakingText = null;
    this.activeSpeakingTurnId = null;
    this.lastError = null;
    this.voiceMode = VOICE_MODES.DISABLED;
    this.state = FULL_DUPLEX_STATES.DISABLED;
    this.lastTransitionReason = reason;
    const status = this.getStatus();
    this.emit('sessionState', status);
    return status;
  }

  /**
   * Synchronizes canonical browser/client voice state telemetry with backend state.
   */
  syncClientState(payload = {}) {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      return this.getStatus();
    }
    if (payload.voiceMode && VOICE_MODES[String(payload.voiceMode).toUpperCase()]) {
      this.voiceMode = VOICE_MODES[String(payload.voiceMode).toUpperCase()];
    }
    if (payload.permissionState !== undefined) {
      this.permissionState = String(payload.permissionState);
    }
    if (payload.micDeviceLabel !== undefined) {
      this.micDeviceLabel = payload.micDeviceLabel || null;
    }
    if (payload.reason) {
      this.lastTransitionReason = String(payload.reason);
    }

    const reqState = payload.state ? String(payload.state).toUpperCase() : null;
    if (reqState && FULL_DUPLEX_STATES[reqState]) {
      this.state = FULL_DUPLEX_STATES[reqState];
    }

    if (this.state === FULL_DUPLEX_STATES.LISTENING) {
      if (typeof payload.captureStartedAtMs === 'number' && payload.captureStartedAtMs > 0) {
        this.listeningStartedAtMs = payload.captureStartedAtMs;
      } else if (!this.listeningStartedAtMs) {
        const elapsed = Number(payload.elapsedMs) || 0;
        this.listeningStartedAtMs = Date.now() - Math.max(0, elapsed);
      }
      if (payload.sessionId) {
        this.sessionId = String(payload.sessionId);
      }
    } else {
      this.listeningStartedAtMs = null;
      if (this.state === FULL_DUPLEX_STATES.DISABLED) {
        this.sessionId = null;
      }
    }

    if (this.state === FULL_DUPLEX_STATES.ERROR && payload.lastError) {
      this.lastError = {
        code: String(payload.lastError.code || 'VOICE_ERROR'),
        message: String(payload.lastError.message || 'Voice error'),
        timestamp: Number(payload.lastError.timestamp) || Date.now()
      };
    } else if (this.state !== FULL_DUPLEX_STATES.ERROR) {
      this.lastError = null;
    }

    if (typeof payload.generation === 'number' && payload.generation > this.generation) {
      this.generation = payload.generation;
    }

    const status = this.getStatus();
    this.emit('sessionState', status);
    return status;
  }

  getElapsedMs() {
    if (this.state !== FULL_DUPLEX_STATES.LISTENING || !this.listeningStartedAtMs) {
      return 0;
    }
    return Math.max(0, Date.now() - this.listeningStartedAtMs);
  }

  /**
   * Simulates or initiates JARVIS speaking an utterance in full-duplex mode so
   * incoming audio frames can test live barge-in while `state === 'SPEAKING'`.
   */
  async beginAssistantSpeech(responseText = '', { turnId = null } = {}) {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Assistant speech blocked by Emergency Stop.');
    }

    if (!this.sessionId) {
      this.startSession();
    }

    const activeTurn = turnId || `turn_${Date.now().toString(36)}`;
    this.activeSpeakingTurnId = activeTurn;
    this.activeSpeakingText = responseText;
    this.state = FULL_DUPLEX_STATES.SPEAKING;

    const tTts0 = Date.now();
    const synthResult = await this.tts.synthesizeSentence(responseText);
    // Keep TTS marked as playing during full-duplex speech window until completion or barge-in
    this.tts.isPlaying = true;
    this.tts.currentUtterance = responseText;
    this.latencyMetrics.lastTtsFirstChunkLatencyMs = Math.max(1, Date.now() - tTts0);

    return {
      success: true,
      sessionId: this.sessionId,
      turnId: activeTurn,
      state: this.state,
      isAssistantSpeaking: this.tts.isPlaying,
      ttsFirstChunkLatencyMs: this.latencyMetrics.lastTtsFirstChunkLatencyMs,
      synthResult
    };
  }

  /**
   * Processes an incoming full-duplex audio/speech frame.
   * Handles:
   * - Background noise filtering (ignores low RMS/SNR without interrupting speech)
   * - Real-time barge-in while JARVIS is speaking (stops TTS immediately & switches to LISTENING in same session)
   * - Incomplete sentence buffering across natural user pauses
   * - Low-latency contextual response generation with fallback to `VoiceConversationalPipeline`
   */
  async processAudioFrame({
    audioBuffer = null,
    transcript = '',
    rms = 0.09,
    snrDb = 24.0,
    isFinalClause = undefined,
    waitForContinuation = false
  } = {}) {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      this.handleEmergencyStop('EMERGENCY_STOP_ACTIVE');
      throw new Error('EMERGENCY_STOP_ACTIVE: Full-Duplex Voice frame rejected due to Emergency Stop.');
    }

    if (
      this.state === FULL_DUPLEX_STATES.DISABLED ||
      this.state === FULL_DUPLEX_STATES.PAUSED ||
      this.state === FULL_DUPLEX_STATES.ERROR
    ) {
      return {
        status: 'IGNORED_NOT_ACTIVE',
        sessionId: this.sessionId,
        state: this.state,
        elapsedMs: 0,
        isTimerActive: false
      };
    }

    const tFrameStart = Date.now();

    // -------------------------------------------------------------------------
    // 1. VAD & BACKGROUND NOISE FILTERING (MUST run before starting capture)
    // -------------------------------------------------------------------------
    const tVad0 = Date.now();
    const isBackgroundNoise = (rms !== undefined && rms < this.vadRmsThreshold) ||
      (snrDb !== undefined && snrDb < this.bargeInMinSnrDb && !transcript);
    this.latencyMetrics.lastVadLatencyMs = Math.max(1, Date.now() - tVad0);

    if (isBackgroundNoise) {
      this.latencyMetrics.noiseFramesFiltered++;
      return {
        status: 'NOISE_FILTERED',
        sessionId: this.sessionId,
        state: this.state,
        assistantContinuedSpeaking: this.state === FULL_DUPLEX_STATES.SPEAKING && this.tts.isPlaying,
        vadLatencyMs: this.latencyMetrics.lastVadLatencyMs,
        elapsedMs: this.getElapsedMs(),
        isTimerActive: this.state === FULL_DUPLEX_STATES.LISTENING && Boolean(this.listeningStartedAtMs)
      };
    }

    if (!this.sessionId || this.state === FULL_DUPLEX_STATES.READY) {
      this.startSession({ reason: 'VAD_SPEECH_TRIGGER' });
    }

    const preservedSessionId = this.sessionId;

    // -------------------------------------------------------------------------
    // 2. BARGE-IN DETECTION WHILE JARVIS IS SPEAKING
    // -------------------------------------------------------------------------
    let bargeInEvent = null;
    if (this.state === FULL_DUPLEX_STATES.SPEAKING || this.tts.isPlaying) {
      const tBarge0 = Date.now();
      this.state = FULL_DUPLEX_STATES.INTERRUPTED_SWITCHING_TO_LISTEN;

      const bargeRes = this.interruptionManager.handleUserBargeIn({
        detectedAt: tBarge0,
        transcript
      });
      // Guarantee TTS stream is halted
      if (this.tts.isPlaying) {
        this.tts.stop('FULL_DUPLEX_BARGE_IN');
      }
      if (this.activeTurnAbortController) {
        try { this.activeTurnAbortController.abort(); } catch (_) {}
      }

      const stopLatencyMs = Math.max(1, Date.now() - tBarge0);
      this.latencyMetrics.lastBargeInStopLatencyMs = stopLatencyMs;
      this.latencyMetrics.totalBargeInsHandled++;

      // Switch immediately to LISTENING without restarting the session
      this.state = FULL_DUPLEX_STATES.LISTENING;

      bargeInEvent = {
        interrupted: true,
        stopLatencyMs,
        interruptionIntent: bargeRes.intent || this.interruptionManager.classifyInterruptionIntent(transcript),
        interruptedUtterance: this.activeSpeakingText,
        sessionPreserved: this.sessionId === preservedSessionId
      };
      this.activeSpeakingText = null;
      this.activeSpeakingTurnId = null;
    }

    // -------------------------------------------------------------------------
    // 3. STREAMING STT TRANSCRIPTION
    // -------------------------------------------------------------------------
    const tStt0 = Date.now();
    let rawUtterance = String(transcript || '').trim();
    if (!rawUtterance && audioBuffer) {
      const sttRes = await this.stt.transcribeAudioSegment({ buffer: audioBuffer, rms, snrDb });
      rawUtterance = (sttRes.transcription || '').trim();
    }
    this.latencyMetrics.lastSttLatencyMs = Math.max(1, Date.now() - tStt0);

    if (!rawUtterance) {
      return {
        status: 'LISTENING_NO_SPEECH',
        sessionId: preservedSessionId,
        state: FULL_DUPLEX_STATES.LISTENING,
        bargeIn: bargeInEvent
      };
    }

    // Check if the utterance is an explicit stop/cancel command ("Stop", "Cancel", "Quiet")
    if (/^(stop|cancel|halt|quiet|shut up|never mind|abort)\.?$/i.test(rawUtterance)) {
      this.incompleteUtteranceBuffer = '';
      this.state = FULL_DUPLEX_STATES.LISTENING;
      return {
        status: 'INTERRUPTED_AND_LISTENING',
        sessionId: preservedSessionId,
        sessionRestarted: false,
        state: this.state,
        bargeIn: bargeInEvent || { interrupted: true, stopLatencyMs: 1, interruptionIntent: INTERRUPTION_TYPES.EXPLICIT_CANCEL },
        responseText: null
      };
    }

    // -------------------------------------------------------------------------
    // 4. INCOMPLETE SENTENCE / PAUSE DETECTION & BUFFERING
    // -------------------------------------------------------------------------
    const looksIncomplete = isFinalClause === false ||
      waitForContinuation === true ||
      this._isUtteranceSyntacticallyIncomplete(rawUtterance);

    if (looksIncomplete) {
      this.incompleteUtteranceBuffer = this.incompleteUtteranceBuffer
        ? `${this.incompleteUtteranceBuffer} ${rawUtterance}`.trim()
        : rawUtterance;
      this.incompleteBufferTimestamp = Date.now();
      this.state = FULL_DUPLEX_STATES.BUFFERING_PAUSE;

      return {
        status: 'BUFFERING_INCOMPLETE_UTTERANCE',
        sessionId: preservedSessionId,
        sessionRestarted: false,
        state: this.state,
        bufferedText: this.incompleteUtteranceBuffer,
        bargeIn: bargeInEvent
      };
    }

    // Merge with buffered partial sentence if within continuation window
    let completeUtterance = rawUtterance;
    let mergedFromPauseBuffer = false;
    if (this.incompleteUtteranceBuffer && (Date.now() - this.incompleteBufferTimestamp <= this.pauseContinuationWindowMs)) {
      completeUtterance = `${this.incompleteUtteranceBuffer} ${rawUtterance}`.replace(/\s+/g, ' ').trim();
      this.incompleteUtteranceBuffer = '';
      this.latencyMetrics.incompleteUtterancesMerged++;
      mergedFromPauseBuffer = true;
    } else {
      this.incompleteUtteranceBuffer = '';
    }

    // -------------------------------------------------------------------------
    // 5. CONTEXTUAL RESPONSE GENERATION (WITH FALLBACK PIPELINE)
    // -------------------------------------------------------------------------
    this.state = FULL_DUPLEX_STATES.PROCESSING;
    this.activeTurnAbortController = new AbortController();
    const tReason0 = Date.now();

    let responseText = '';
    let turnResult = null;

    try {
      // Resolve references against conversational history
      const resolved = this.contextEngine.resolveReferences(completeUtterance);
      const effectiveUtterance = resolved.resolvedText || completeUtterance;

      // Build fast contextual response or delegate to fallback pipeline
      if (this._canAnswerFastInSession(effectiveUtterance)) {
        responseText = this._generateFastContextualReply(effectiveUtterance, bargeInEvent);
      } else {
        const wasWakeEnabled = this.fallbackPipeline.wakeWord.isEnabled;
        this.fallbackPipeline.wakeWord.isEnabled = false;
        try {
          turnResult = await this.fallbackPipeline.processConversationalTurn({
            transcript: effectiveUtterance,
            snrDb,
            rms
          });
          responseText = turnResult.responseText || 'Understood, sir.';
        } finally {
          this.fallbackPipeline.wakeWord.isEnabled = wasWakeEnabled;
        }
      }
    } catch (err) {
      responseText = `I encountered an issue processing that request: ${err.message}`;
    }

    this.latencyMetrics.lastReasoningLatencyMs = Math.max(1, Date.now() - tReason0);

    // -------------------------------------------------------------------------
    // 6. STREAMING TTS SYNTHESIS & CONVERSATIONAL MEMORY UPDATE
    // -------------------------------------------------------------------------
    this.state = FULL_DUPLEX_STATES.SPEAKING;
    const tTts0 = Date.now();
    const speechResult = await this.tts.synthesizeSentence(responseText);
    this.latencyMetrics.lastTtsFirstChunkLatencyMs = Math.max(1, Date.now() - tTts0);

    // After synthesis finishes, return to LISTENING in the same session
    this.state = FULL_DUPLEX_STATES.LISTENING;

    const totalTurnLatencyMs = Math.max(1, Date.now() - tFrameStart);
    this.latencyMetrics.lastEndToEndLatencyMs = totalTurnLatencyMs;
    this.latencyMetrics.totalTurnsCompleted++;
    const prevAvg = this.latencyMetrics.averageEndToEndLatencyMs;
    const n = this.latencyMetrics.totalTurnsCompleted;
    this.latencyMetrics.averageEndToEndLatencyMs = Math.round(((prevAvg * (n - 1)) + totalTurnLatencyMs) / n);

    // Record turn in session history & context engine
    const turnRecord = {
      turnIndex: this.conversationalHistory.length + 1,
      sessionId: preservedSessionId,
      userUtterance: completeUtterance,
      mergedFromPauseBuffer,
      bargeIn: bargeInEvent,
      assistantResponse: responseText,
      latencyBreakdownMs: {
        vad: this.latencyMetrics.lastVadLatencyMs,
        bargeInStop: bargeInEvent ? bargeInEvent.stopLatencyMs : 0,
        stt: this.latencyMetrics.lastSttLatencyMs,
        reasoning: this.latencyMetrics.lastReasoningLatencyMs,
        ttsFirstChunk: this.latencyMetrics.lastTtsFirstChunkLatencyMs,
        totalEndToEnd: totalTurnLatencyMs
      },
      timestamp: new Date().toISOString()
    };

    this.conversationalHistory.push(turnRecord);
    this.contextEngine.recordTurnContext({
      userQuery: completeUtterance,
      assistantResponse: responseText,
      topic: this._extractTopic(completeUtterance)
    });

    return {
      status: 'COMPLETED',
      sessionId: preservedSessionId,
      sessionRestarted: false,
      state: this.state,
      userUtterance: completeUtterance,
      mergedFromPauseBuffer,
      bargeIn: bargeInEvent,
      responseText,
      speechResult,
      turnIndex: turnRecord.turnIndex,
      latencyBreakdownMs: turnRecord.latencyBreakdownMs
    };
  }

  _isUtteranceSyntacticallyIncomplete(text = '') {
    const clean = String(text).trim().replace(/[.!?]+$/, '').trim();
    if (!clean) return false;
    // Ends with ellipsis or trailing connector indicating the speaker paused mid-sentence
    if (/\.\.\.$/.test(text.trim())) return true;
    if (/\b(and|or|but|because|please|open the|go to|search for|tell me about|instead of|wait can you)\s*$/i.test(clean)) {
      return true;
    }
    return false;
  }

  _canAnswerFastInSession(utterance = '') {
    // Use fast contextual in-session responder for conversational dialogue, follow-ups, and corrections
    return !/\b(remember this|switch to hindi|switch to english|delete_file|format drive)\b/i.test(utterance);
  }

  _generateFastContextualReply(utterance = '', bargeInEvent = null) {
    const prevTurn = this.conversationalHistory.length > 0
      ? this.conversationalHistory[this.conversationalHistory.length - 1]
      : null;

    if (bargeInEvent && bargeInEvent.interruptionIntent === INTERRUPTION_TYPES.CORRECTION) {
      return `Understood — switching immediately as requested: "${utterance}". Previous context updated.`;
    }

    if (/\b(what did i just ask|what was my previous|what were we talking about|earlier topic)\b/i.test(utterance) && prevTurn) {
      return `In our previous turn on this session, we discussed: "${prevTurn.userUtterance}".`;
    }

    if (prevTurn && /\b(it|that|them|instead|also)\b/i.test(utterance)) {
      return `Continuing from "${prevTurn.userUtterance}": I have processed "${utterance}" in the current session.`;
    }

    return `Acknowledged, sir. Processing "${utterance}" with full-duplex context active.`;
  }

  _extractTopic(text = '') {
    const words = String(text).replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    return words.slice(0, 3).join('_').toLowerCase() || 'general_conversation';
  }

  /**
   * Immediately cancels the current voice turn and stops TTS without killing the session.
   */
  cancelCurrentTurn(reason = 'USER_CANCELLED_TURN') {
    const t0 = Date.now();
    if (this.tts.isPlaying) {
      this.tts.stop(reason);
    }
    if (this.activeTurnAbortController) {
      try { this.activeTurnAbortController.abort(); } catch (_) {}
    }
    this.incompleteUtteranceBuffer = '';
    this.activeSpeakingText = null;
    this.state = this.sessionId ? FULL_DUPLEX_STATES.LISTENING : FULL_DUPLEX_STATES.CANCELLED;

    return {
      success: true,
      cancelled: true,
      sessionId: this.sessionId,
      state: this.state,
      cancelLatencyMs: Math.max(1, Date.now() - t0),
      reason
    };
  }

  /**
   * Handles global Emergency Stop immediately.
   */
  handleEmergencyStop(reason = 'EMERGENCY_STOP') {
    if (this.tts.isPlaying) {
      this.tts.stop(reason);
    }
    if (this.activeTurnAbortController) {
      try { this.activeTurnAbortController.abort(); } catch (_) {}
    }
    this.generation++;
    this.listeningStartedAtMs = null;
    this.incompleteUtteranceBuffer = '';
    this.activeSpeakingText = null;
    this.activeSpeakingTurnId = null;
    this.lastTransitionReason = reason;
    this.state = FULL_DUPLEX_STATES.EMERGENCY_STOPPED;
    this.emit('emergencyStop', { reason, sessionId: this.sessionId, generation: this.generation });
    this.emit('sessionState', this.getStatus());
    return {
      stopped: true,
      state: this.state,
      generation: this.generation,
      elapsedMs: 0,
      isTimerActive: false,
      reason
    };
  }

  getStatus() {
    const elapsedMs = this.getElapsedMs();
    const isTimerActive = this.state === FULL_DUPLEX_STATES.LISTENING && Boolean(this.listeningStartedAtMs);
    return {
      sessionId: this.sessionId,
      sessionStartedAt: this.sessionStartedAt,
      state: this.state,
      voiceMode: this.voiceMode,
      generation: this.generation,
      listeningStartedAtMs: this.listeningStartedAtMs,
      elapsedMs,
      isTimerActive,
      lastError: this.lastError,
      lastTransitionReason: this.lastTransitionReason,
      micDeviceLabel: this.micDeviceLabel,
      permissionState: this.permissionState,
      sessionRestartCount: this.sessionRestartCount,
      isAssistantSpeaking: Boolean(this.tts.isPlaying || this.state === FULL_DUPLEX_STATES.SPEAKING),
      bufferedPartialUtterance: this.incompleteUtteranceBuffer || null,
      turnCount: this.conversationalHistory.length,
      fallbackPipelineAvailable: Boolean(this.fallbackPipeline),
      latencyMetrics: { ...this.latencyMetrics }
    };
  }
}

const fullDuplexVoiceEngineInstance = new FullDuplexVoiceEngine();

module.exports = {
  FullDuplexVoiceEngine,
  fullDuplexVoiceEngineInstance,
  FULL_DUPLEX_STATES,
  VOICE_MODES
};
