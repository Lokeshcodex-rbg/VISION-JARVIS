/**
 * VISION AI — Smart Conversational Session Manager & State Machine
 * Authoritative lifecycle manager providing adaptive inactivity timing,
 * deep thinking pause tolerance, maximum session duration protection,
 * and multi-timer collision prevention.
 */

import { CONFIG } from '../config.js';

export const CONVERSATION_STATES = {
  DISABLED: 'DISABLED',
  READY: 'READY',
  PAUSED: 'PAUSED',
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  LISTENING: 'LISTENING',
  CAPTURING: 'CAPTURING',
  USER_SPEAKING: 'CAPTURING', // backwards compatibility alias
  TRANSCRIBING: 'TRANSCRIBING',
  THINKING: 'THINKING',
  PROCESSING: 'THINKING', // backwards compatibility alias
  EXECUTING: 'EXECUTING',
  SPEAKING: 'SPEAKING',
  ASSISTANT_SPEAKING: 'SPEAKING', // backwards compatibility alias
  INTERRUPTED: 'INTERRUPTED',
  RECONNECTING: 'RECONNECTING',
  ERROR: 'ERROR',
  SHUTTING_DOWN: 'SHUTTING_DOWN',
  AWAITING_FOLLOWUP: 'AWAITING_FOLLOWUP',
  WAKE_WORD_DETECTED: 'WAKE_WORD_DETECTED',
  ACTIVATING: 'ACTIVATING',
  SESSION_ENDING: 'SESSION_ENDING'
};

export const SESSION_CLOSE_REASONS = {
  INACTIVITY: 'REASON_INACTIVITY',
  EXPLICIT_SLEEP: 'REASON_EXPLICIT_SLEEP',
  MAX_SESSION: 'REASON_MAX_SESSION',
  THEME_SWITCH: 'REASON_THEME_SWITCH',
  USER_REQUEST: 'REASON_USER_REQUEST'
};

export class ConversationSessionManager {
  constructor(options = {}) {
    this.config = Object.assign({}, CONFIG.session, options);

    // Current Authoritative State & Active Personality (MUST boot DISABLED — never auto-listening)
    this.state = options.initialState || CONVERSATION_STATES.DISABLED;
    this.activePersonality = CONFIG.transition.defaultTheme || 'JARVIS';

    // Unique Turn Identifier System (prevents older callbacks from overwriting newer turns)
    this.turnCounter = 0;
    this.currentTurnId = 'turn_0';
    this.lastStateChangeTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.lastTransition = {
      fromState: null,
      toState: this.state,
      reason: 'INITIAL_BOOT',
      timestamp: Date.now(),
      durationMs: 0,
      turnId: this.currentTurnId
    };

    // Session Identifiers, Capture Timer & Collision Prevention
    this.sessionId = null;
    this.sessionGeneration = 0;
    this.sessionStartTime = 0;
    this.captureSessionId = null;
    this.captureStartTimeMs = 0;
    this.captureGeneration = 0;

    // Adaptive Inactivity Deadlines
    this.deadlineTimestamp = 0;
    this.inExtendedThinking = false;
    this.tickerIntervalId = null;
    this.stuckWatchdogTimeout = null;

    // Continuous Conversation Mode (Explicit opt-in only — NEVER enabled by default)
    this.continuousListening = (options.continuousListening !== undefined)
      ? Boolean(options.continuousListening)
      : false;

    // Callbacks
    this.onStateTransition = options.onStateTransition || null;
    this.onSessionClose = options.onSessionClose || null;
    this.onSessionStart = options.onSessionStart || null;
    this.onInterrupt = options.onInterrupt || null;
    this.onSessionExtend = options.onSessionExtend || null;
  }

  setPersonality(personality) {
    if (!personality || typeof personality !== 'string') return;
    const cleanPers = personality.toUpperCase();
    if (this.activePersonality !== cleanPers) {
      console.log(`[STATE_MACHINE] Active personality switched: ${this.activePersonality} -> ${cleanPers}`);
      this.activePersonality = cleanPers;
      this.startNewTurn();
    }
  }

  getPersonality() {
    return this.activePersonality;
  }

  startNewTurn() {
    this.turnCounter++;
    this.currentTurnId = `turn_${Date.now()}_${this.turnCounter}`;
    return this.currentTurnId;
  }

  getCurrentTurnId() {
    return this.currentTurnId;
  }

  getLastTransition() {
    return { ...this.lastTransition };
  }

  setContinuousListening(enabled) {
    this.continuousListening = Boolean(enabled);
    console.log(`[SESSION] Continuous listening set to: ${this.continuousListening}`);
    // Do NOT auto-start a capture session just because mode flag changed; remain READY until triggered.
  }

  startCaptureTimer(sessionId = null) {
    this.captureGeneration++;
    this.captureSessionId = sessionId || this.sessionId || `cap_${Date.now().toString(36)}_${this.captureGeneration}`;
    this.captureStartTimeMs = Date.now();
    return {
      captureSessionId: this.captureSessionId,
      captureStartTimeMs: this.captureStartTimeMs,
      captureGeneration: this.captureGeneration
    };
  }

  stopCaptureTimer() {
    this.captureGeneration++;
    this.captureStartTimeMs = 0;
    this.captureSessionId = null;
  }

  getElapsedCaptureMs() {
    if (this.captureStartTimeMs <= 0) return 0;
    if (this.state !== CONVERSATION_STATES.LISTENING && this.state !== CONVERSATION_STATES.CAPTURING && this.state !== CONVERSATION_STATES.USER_SPEAKING) {
      return 0;
    }
    return Math.max(0, Date.now() - this.captureStartTimeMs);
  }

  /**
   * Validates state machine transition matrix
   * Validates all canonical lifecycle transitions while rejecting illegal leaps
   */
  isValidTransition(fromState, toState) {
    if (fromState === toState) return true;
    const allowed = {
      DISABLED: ['READY', 'INITIALIZING', 'LISTENING', 'CAPTURING', 'RECONNECTING', 'ERROR', 'IDLE', 'PAUSED'],
      READY: ['DISABLED', 'PAUSED', 'INITIALIZING', 'WAKE_WORD_DETECTED', 'ACTIVATING', 'LISTENING', 'CAPTURING', 'RECONNECTING', 'ERROR', 'IDLE'],
      PAUSED: ['DISABLED', 'READY', 'LISTENING', 'IDLE', 'ERROR'],
      IDLE: ['DISABLED', 'READY', 'PAUSED', 'INITIALIZING', 'WAKE_WORD_DETECTED', 'ACTIVATING', 'LISTENING', 'RECONNECTING', 'CAPTURING', 'ERROR', 'SHUTTING_DOWN'],
      INITIALIZING: ['LISTENING', 'READY', 'DISABLED', 'IDLE', 'ERROR', 'RECONNECTING'],
      WAKE_WORD_DETECTED: ['ACTIVATING', 'LISTENING', 'CAPTURING', 'THINKING', 'EXECUTING', 'SPEAKING', 'SESSION_ENDING', 'IDLE', 'READY', 'DISABLED', 'ERROR', 'RECONNECTING'],
      ACTIVATING: ['LISTENING', 'CAPTURING', 'THINKING', 'EXECUTING', 'SPEAKING', 'IDLE', 'READY', 'DISABLED', 'ERROR'],
      LISTENING: ['CAPTURING', 'TRANSCRIBING', 'THINKING', 'EXECUTING', 'SPEAKING', 'RECONNECTING', 'INTERRUPTED', 'SESSION_ENDING', 'SHUTTING_DOWN', 'IDLE', 'READY', 'PAUSED', 'DISABLED', 'ERROR', 'AWAITING_FOLLOWUP'],
      CAPTURING: ['TRANSCRIBING', 'THINKING', 'EXECUTING', 'LISTENING', 'INTERRUPTED', 'IDLE', 'READY', 'PAUSED', 'DISABLED', 'ERROR'],
      TRANSCRIBING: ['THINKING', 'EXECUTING', 'CAPTURING', 'LISTENING', 'INTERRUPTED', 'IDLE', 'READY', 'PAUSED', 'DISABLED', 'ERROR'],
      THINKING: ['EXECUTING', 'SPEAKING', 'LISTENING', 'CAPTURING', 'TRANSCRIBING', 'INTERRUPTED', 'RECONNECTING', 'IDLE', 'READY', 'PAUSED', 'DISABLED', 'ERROR', 'AWAITING_FOLLOWUP'],
      EXECUTING: ['SPEAKING', 'THINKING', 'LISTENING', 'INTERRUPTED', 'RECONNECTING', 'IDLE', 'READY', 'PAUSED', 'DISABLED', 'ERROR'],
      SPEAKING: ['LISTENING', 'CAPTURING', 'INTERRUPTED', 'SESSION_ENDING', 'SHUTTING_DOWN', 'IDLE', 'READY', 'PAUSED', 'DISABLED', 'ERROR', 'AWAITING_FOLLOWUP'],
      INTERRUPTED: ['LISTENING', 'CAPTURING', 'TRANSCRIBING', 'THINKING', 'EXECUTING', 'IDLE', 'READY', 'PAUSED', 'DISABLED', 'ERROR'],
      RECONNECTING: ['LISTENING', 'CAPTURING', 'TRANSCRIBING', 'THINKING', 'EXECUTING', 'SPEAKING', 'IDLE', 'READY', 'PAUSED', 'DISABLED', 'ERROR'],
      ERROR: ['LISTENING', 'READY', 'PAUSED', 'DISABLED', 'RECONNECTING', 'SHUTTING_DOWN', 'IDLE'],
      AWAITING_FOLLOWUP: ['LISTENING', 'CAPTURING', 'TRANSCRIBING', 'THINKING', 'EXECUTING', 'IDLE', 'READY', 'PAUSED', 'DISABLED', 'ERROR', 'RECONNECTING', 'SESSION_ENDING'],
      SHUTTING_DOWN: ['IDLE', 'DISABLED', 'ERROR'],
      SESSION_ENDING: ['IDLE', 'READY', 'DISABLED', 'SHUTTING_DOWN', 'ERROR']
    };
    return (allowed[fromState] && allowed[fromState].includes(toState)) ||
      ['IDLE', 'DISABLED', 'READY', 'PAUSED', 'ERROR', 'LISTENING'].includes(toState);
  }

  /**
   * Authoritative State Transition Handler
   */
  transition(nextState, metadata = {}) {
    // Resolve alias states
    const resolvedNext = CONVERSATION_STATES[nextState] || nextState;
    if (this.state === resolvedNext) return false;

    // Stale asynchronous event rejection for outdated turns
    const isGlobalOverride = ['IDLE', 'ERROR', 'SHUTTING_DOWN', 'RECONNECTING', 'INTERRUPTED'].includes(resolvedNext);
    if (metadata.turnId && metadata.turnId !== this.currentTurnId && !isGlobalOverride) {
      console.warn(`[STATE_MACHINE] Stale asynchronous event rejected for turn '${metadata.turnId}'. Current active turn is '${this.currentTurnId}'.`);
      return false;
    }

    if (!this.isValidTransition(this.state, resolvedNext)) {
      console.warn(`[STATE_MACHINE] Invalid transition rejected: ${this.state} -> ${resolvedNext}`);
      return false;
    }

    const prevState = this.state;
    this.state = resolvedNext;

    // Stop capture timer whenever leaving active capture/listening into processing, speaking, paused, error, ready, idle, or disabled
    if (['DISABLED', 'READY', 'PAUSED', 'IDLE', 'ERROR', 'SESSION_ENDING', 'SHUTTING_DOWN', 'THINKING', 'TRANSCRIBING', 'EXECUTING', 'SPEAKING'].includes(resolvedNext)) {
      this.stopCaptureTimer();
    }

    // Track transition latency and duration
    const nowPerf = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const durationMs = Math.max(0, Math.round(nowPerf - this.lastStateChangeTime));
    this.lastStateChangeTime = nowPerf;

    this.lastTransition = {
      fromState: prevState,
      toState: resolvedNext,
      reason: metadata.reason || 'DIRECT',
      timestamp: Date.now(),
      durationMs,
      turnId: metadata.turnId || this.currentTurnId
    };

    // Clear previous stuck watchdog
    if (this.stuckWatchdogTimeout) {
      clearTimeout(this.stuckWatchdogTimeout);
      this.stuckWatchdogTimeout = null;
    }

    const timestamp = new Date().toISOString().slice(11, 23);
    console.log(`[STATE_MACHINE] ${timestamp} Transition: ${prevState} -> ${resolvedNext} | Reason: ${metadata.reason || 'DIRECT'} | Pers: ${this.activePersonality} | Turn: ${this.currentTurnId}`);

    if (typeof this.onStateTransition === 'function') {
      this.onStateTransition(resolvedNext, prevState, { ...metadata, turnId: this.currentTurnId, durationMs });
    }

    // Anti-hang stuck state protection watchdogs
    if (resolvedNext === CONVERSATION_STATES.CAPTURING) {
      this.stuckWatchdogTimeout = setTimeout(() => {
        if (this.state === CONVERSATION_STATES.CAPTURING) {
          console.warn('[STATE_MACHINE] Auto-recovering from stuck CAPTURING state after 10s watchdog.');
          this.transition(CONVERSATION_STATES.LISTENING, { reason: 'CAPTURING_TIMEOUT_AUTO_RECOVER' });
        }
      }, 10000);
    } else if (resolvedNext === CONVERSATION_STATES.TRANSCRIBING) {
      this.stuckWatchdogTimeout = setTimeout(() => {
        if (this.state === CONVERSATION_STATES.TRANSCRIBING) {
          console.warn('[STATE_MACHINE] Auto-recovering from stuck TRANSCRIBING state after 12s watchdog.');
          this.transition(CONVERSATION_STATES.LISTENING, { reason: 'TRANSCRIBING_TIMEOUT_AUTO_RECOVER' });
        }
      }, 12000);
    } else if (resolvedNext === CONVERSATION_STATES.THINKING) {
      this.stuckWatchdogTimeout = setTimeout(() => {
        if (this.state === CONVERSATION_STATES.THINKING) {
          console.warn('[STATE_MACHINE] Auto-recovering from hung THINKING state after 60s timeout.');
          this.transition(CONVERSATION_STATES.LISTENING, { reason: 'THINKING_TIMEOUT_AUTO_RECOVER' });
        }
      }, 60000);
    } else if (resolvedNext === CONVERSATION_STATES.EXECUTING) {
      this.stuckWatchdogTimeout = setTimeout(() => {
        if (this.state === CONVERSATION_STATES.EXECUTING) {
          console.warn('[STATE_MACHINE] Auto-recovering from hung EXECUTING state after 120s timeout.');
          this.transition(CONVERSATION_STATES.LISTENING, { reason: 'EXECUTING_TIMEOUT_AUTO_RECOVER' });
        }
      }, 120000);
    } else if (resolvedNext === CONVERSATION_STATES.SPEAKING) {
      this.stuckWatchdogTimeout = setTimeout(() => {
        if (this.state === CONVERSATION_STATES.SPEAKING) {
          console.warn('[STATE_MACHINE] Auto-recovering from hung SPEAKING state after 45s timeout.');
          this.transition(CONVERSATION_STATES.LISTENING, { reason: 'SPEAKING_TIMEOUT_AUTO_RECOVER' });
        }
      }, 45000);
    } else if (resolvedNext === CONVERSATION_STATES.RECONNECTING) {
      this.stuckWatchdogTimeout = setTimeout(() => {
        if (this.state === CONVERSATION_STATES.RECONNECTING) {
          console.warn('[STATE_MACHINE] Auto-recovering from stuck RECONNECTING state after 6s watchdog.');
          this.transition(CONVERSATION_STATES.LISTENING, { reason: 'RECONNECT_TIMEOUT_AUTO_RECOVER' });
        }
      }, 6000);
    }

    // State-specific actions
    if (resolvedNext === CONVERSATION_STATES.INTERRUPTED) {
      if (typeof this.onInterrupt === 'function') {
        this.onInterrupt({ ...metadata, turnId: this.currentTurnId });
      }
      // Return cleanly to listening after handling interruption
      setTimeout(() => {
        if (this.state === CONVERSATION_STATES.INTERRUPTED) {
          this.transition(CONVERSATION_STATES.LISTENING, { reason: 'INTERRUPTION_CLEARED' });
        }
      }, 40);
    }

    return true;
  }

  /**
   * Starts an active conversational session (e.g. on wake word or explicit command)
   */
  startSession(personality = 'JARVIS', reason = 'WAKE_WORD') {
    this.sessionGeneration++;
    const currentToken = this.sessionGeneration;
    this.activePersonality = personality;
    this.sessionStartTime = performance.now();
    this.sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    this.inExtendedThinking = false;

    // Default normal inactivity window (45s)
    const timeoutMs = this.config.normalInactivityTimeoutMs || 45000;
    this.deadlineTimestamp = performance.now() + timeoutMs;

    console.log(`[SESSION] Started new session [${this.sessionId}] for ${personality}. Inactivity window: ${timeoutMs / 1000}s`);

    if (reason && reason.includes('QUERY')) {
      this.transition(CONVERSATION_STATES.LISTENING, { reason, sessionId: this.sessionId });
    } else {
      this.transition(CONVERSATION_STATES.WAKE_WORD_DETECTED, { reason, sessionId: this.sessionId });

      setTimeout(() => {
        if (this.state === CONVERSATION_STATES.WAKE_WORD_DETECTED && currentToken === this.sessionGeneration) {
          this.transition(CONVERSATION_STATES.ACTIVATING, { reason: 'ACTIVATING_THEME' });
          setTimeout(() => {
            if (this.state === CONVERSATION_STATES.ACTIVATING && currentToken === this.sessionGeneration) {
              this.transition(CONVERSATION_STATES.LISTENING, { reason: 'READY_TO_LISTEN' });
            }
          }, 50);
        }
      }, 25);
    }

    this.startTicker(currentToken);

    if (typeof this.onSessionStart === 'function') {
      this.onSessionStart(personality, this.sessionId);
    }
  }

  /**
   * Marks genuine user speech beginning
   */
  notifyUserSpeechStart() {
    if (this.state === CONVERSATION_STATES.IDLE || this.state === CONVERSATION_STATES.SESSION_ENDING) {
      return;
    }

    // Reset inactivity countdown when genuine user speech begins
    const timeoutMs = this.inExtendedThinking 
      ? (this.config.extendedThinkingTimeoutMs || 90000)
      : (this.config.normalInactivityTimeoutMs || 45000);
    this.deadlineTimestamp = performance.now() + timeoutMs;

    this.transition(CONVERSATION_STATES.USER_SPEAKING, { reason: 'USER_SPEECH_START' });
  }

  /**
   * Marks genuine user speech completion
   */
  notifyUserSpeechEnd() {
    if (this.state === CONVERSATION_STATES.USER_SPEAKING || this.state === CONVERSATION_STATES.CAPTURING) {
      // Grant full normal inactivity window (45s) after completing speech
      const timeoutMs = this.inExtendedThinking
        ? (this.config.extendedThinkingTimeoutMs || 90000)
        : (this.config.normalInactivityTimeoutMs || 45000);
      this.deadlineTimestamp = performance.now() + timeoutMs;
      this.transition(CONVERSATION_STATES.LISTENING, { reason: 'USER_SPEECH_END' });
    }
  }

  /**
   * Marks audio buffer capturing start
   */
  notifyCapturingStart() {
    this.transition(CONVERSATION_STATES.CAPTURING, { reason: 'AUDIO_CAPTURE_START' });
  }

  /**
   * Marks audio buffer capturing complete
   */
  notifyCapturingEnd() {
    if (this.state === CONVERSATION_STATES.CAPTURING) {
      this.transition(CONVERSATION_STATES.TRANSCRIBING, { reason: 'AUDIO_CAPTURE_COMPLETE' });
    }
  }

  /**
   * Marks speech transcription in-flight
   */
  notifyTranscribingStart() {
    this.transition(CONVERSATION_STATES.TRANSCRIBING, { reason: 'STT_TRANSCRIPTION_DISPATCH' });
  }

  /**
   * Marks system initialization start
   */
  notifyInitializingStart(reason = 'SYSTEM_INIT') {
    return this.transition(CONVERSATION_STATES.INITIALIZING, { reason });
  }

  /**
   * Marks processing start for AI query or tool execution
   */
  notifyProcessingStart(query) {
    this.sessionGeneration++;
    return this.transition(CONVERSATION_STATES.THINKING, { reason: 'QUERY_DISPATCH', query });
  }

  /**
   * Marks tool execution in-flight
   */
  notifyExecutingStart(actionInfo = {}) {
    return this.transition(CONVERSATION_STATES.EXECUTING, { reason: 'TOOL_EXECUTION_START', ...actionInfo });
  }

  /**
   * Marks tool execution complete
   */
  notifyExecutingEnd(result = {}) {
    if (this.state === CONVERSATION_STATES.EXECUTING) {
      return this.transition(CONVERSATION_STATES.SPEAKING, { reason: 'TOOL_EXECUTION_COMPLETE', ...result });
    }
    return false;
  }

  /**
   * Marks graceful system shutdown
   */
  notifyShuttingDown(reason = 'SHUTDOWN_REQUEST') {
    return this.transition(CONVERSATION_STATES.SHUTTING_DOWN, { reason });
  }

  /**
   * Marks assistant speech start
   */
  notifyAssistantSpeakingStart() {
    this.transition(CONVERSATION_STATES.SPEAKING, { reason: 'TTS_PLAYBACK_START' });
  }

  /**
   * Marks assistant speech end and calculates adaptive inactivity deadline
   */
  notifyAssistantSpeakingEnd(replyText = '') {
    if (this.state === CONVERSATION_STATES.IDLE || this.state === CONVERSATION_STATES.SESSION_ENDING) {
      return;
    }

    // Determine if the assistant's response ended with a question or prompts choices
    const isQuestion = typeof replyText === 'string' && (
      replyText.trim().endsWith('?') ||
      /\b(would you like|what do you think|shall we|do you want|what are your thoughts)\b/i.test(replyText)
    );

    let graceMs = this.config.normalInactivityTimeoutMs || 45000;

    if (isQuestion && this.config.waitForFollowupAnswers !== false) {
      // Extended thinking window (90s) for thinking through answers to questions
      graceMs = this.config.extendedThinkingTimeoutMs || 90000;
      this.inExtendedThinking = true;
      console.log(`[SESSION] Assistant asked a question. Extended thinking grace window granted: ${graceMs / 1000}s`);
    } else {
      this.inExtendedThinking = false;
    }

    this.extendDeadline(graceMs, isQuestion ? 'ASSISTANT_QUESTION_DETECTED' : 'ASSISTANT_TURN_COMPLETED');
    const targetState = (isQuestion && this.config.waitForFollowupAnswers !== false)
      ? CONVERSATION_STATES.AWAITING_FOLLOWUP
      : CONVERSATION_STATES.LISTENING;
    this.transition(targetState, { reason: 'ASSISTANT_SPEECH_FINISHED', isQuestion });
  }

  /**
   * Extends the session deadline
   */
  extendDeadline(additionalMs, reason = 'EXTENSION') {
    const now = performance.now();
    const newDeadline = now + additionalMs;
    // Never shrink an existing extended deadline
    if (newDeadline > this.deadlineTimestamp) {
      this.deadlineTimestamp = newDeadline;
      if (typeof this.onSessionExtend === 'function') {
        this.onSessionExtend(reason, this.deadlineTimestamp);
      }
    }
  }

  /**
   * Checks if user indicated they are pausing to think ("let me think", "give me a second")
   */
  checkThinkingUtterance(text) {
    if (/\b(let me think|give me a second|give me a moment|hang on|wait a second|wait a minute|thinking|one moment)\b/i.test(text)) {
      const graceMs = this.config.extendedThinkingTimeoutMs || 90000;
      this.extendDeadline(graceMs, 'USER_EXPLICIT_THINKING_REQUEST');
      console.log(`[SESSION] User requested thinking time. Extended deadline: ${graceMs / 1000}s`);
      return true;
    }
    return false;
  }

  /**
   * Requests immediate interruption of active speech
   */
  requestInterrupt(reason = 'USER_INTERRUPT') {
    if (
      this.state === CONVERSATION_STATES.SPEAKING ||
      this.state === CONVERSATION_STATES.ASSISTANT_SPEAKING ||
      this.state === CONVERSATION_STATES.THINKING ||
      this.state === CONVERSATION_STATES.PROCESSING
    ) {
      console.log(`[SESSION] Interruption triggered: ${reason}`);
      this.startNewTurn();
      this.transition(CONVERSATION_STATES.INTERRUPTED, { reason });
      return true;
    }
    return false;
  }

  /**
   * Periodic ticker evaluating timeouts and session limits
   */
  startTicker(currentToken) {
    if (this.tickerIntervalId) {
      clearInterval(this.tickerIntervalId);
      this.tickerIntervalId = null;
    }

    this.tickerIntervalId = setInterval(() => {
      // Guard against old generation timer callbacks
      if (currentToken !== this.sessionGeneration) {
        clearInterval(this.tickerIntervalId);
        return;
      }

      if (this.state === CONVERSATION_STATES.IDLE || this.state === CONVERSATION_STATES.SESSION_ENDING) {
        clearInterval(this.tickerIntervalId);
        return;
      }

      const now = performance.now();

      // 1. Check Maximum Active Session Limit (e.g. 30 minutes) - bypassed in continuous listening
      const maxDuration = this.config.maximumActiveSessionMs || 1800000;
      if (!this.continuousListening && (now - this.sessionStartTime >= maxDuration)) {
        // Only close if not in the middle of active speaking or processing
        if (this.state !== CONVERSATION_STATES.USER_SPEAKING && this.state !== CONVERSATION_STATES.PROCESSING && this.state !== CONVERSATION_STATES.ASSISTANT_SPEAKING) {
          console.log(`[SESSION] Maximum active session duration reached (${maxDuration / 60000} min). Closing session.`);
          this.closeSession(SESSION_CLOSE_REASONS.MAX_SESSION);
          return;
        }
      }

      // 2. Check Inactivity Timeout Deadline - bypassed in continuous conversation mode
      // When continuous listening is enabled, JARVIS stays permanently active for multi-turn dialogue
      if (!this.continuousListening && (this.state === CONVERSATION_STATES.AWAITING_FOLLOWUP || this.state === CONVERSATION_STATES.LISTENING)) {
        if (now >= this.deadlineTimestamp) {
          const totalDurationSec = ((now - this.sessionStartTime) / 1000).toFixed(1);
          console.log(`[SESSION] Natural inactivity timeout reached after ${totalDurationSec}s. Closing session.`);
          this.closeSession(SESSION_CLOSE_REASONS.INACTIVITY);
        }
      }
    }, 500);
  }

  /**
   * Closes active conversational session and returns to background wake word listening
   */
  closeSession(reason = SESSION_CLOSE_REASONS.INACTIVITY) {
    if (this.state === CONVERSATION_STATES.IDLE) return;

    const durationMs = performance.now() - this.sessionStartTime;
    const closedSessionId = this.sessionId;

    this.transition(CONVERSATION_STATES.SESSION_ENDING, { reason, durationMs });

    if (this.tickerIntervalId) {
      clearInterval(this.tickerIntervalId);
      this.tickerIntervalId = null;
    }

    this.sessionId = null;
    this.inExtendedThinking = false;

    if (typeof this.onSessionClose === 'function') {
      this.onSessionClose(reason, durationMs, closedSessionId);
    }

    setTimeout(() => {
      if (this.state === CONVERSATION_STATES.SESSION_ENDING) {
        this.transition(CONVERSATION_STATES.IDLE, { reason: 'SESSION_COMPLETE' });
      }
    }, 950);
  }

  isSessionActive() {
    return this.state !== CONVERSATION_STATES.IDLE && this.state !== CONVERSATION_STATES.SESSION_ENDING;
  }

  getState() {
    return this.state;
  }
}
