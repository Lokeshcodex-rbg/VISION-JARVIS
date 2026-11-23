/**
 * VISION AI — PHASE 15 UPGRADE 3: AMBIENT VISION & CONTEXTUAL AWARENESS DAEMON
 * 
 * Allows JARVIS to understand the user's computer environment ONLY when
 * ambient observation is explicitly enabled by the user.
 * 
 * Strict Privacy & Safety Invariants:
 * 1. Separate Explicit Consents: `screenObservationConsent` and `webcamPresenceConsent`
 *    are independent and strictly `false` by default.
 * 2. Zero Continuous Recording by Default: Frame hashes and transient observations
 *    are processed in-memory without saving continuous video recordings.
 * 3. Mandatory Visible Indicators: Exposes real-time indicator flags for screen
 *    observation, webcam presence, and microphone status.
 * 4. Event-Driven Screen-Change Detection: Computes SHA-256 perceptual state signatures
 *    and skips heavy OCR/vision analysis when the screen has not meaningfully changed.
 * 5. Biometric & Emotion Prohibition: Strictly prohibits facial recognition/identification
 *    and sensitive emotion inference (`faceIdentificationProhibited: true`,
 *    `emotionInferenceProhibited: true`).
 * 6. Non-Intrusive Assistance: Never locks, closes, or modifies applications automatically
 *    without explicit user authorization.
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { computerVisionIntelligenceInstance } = require('../desktop/computerVisionIntelligence.js');
const { cameraIntelligenceEngineInstance } = require('./cameraIntelligenceEngine.js');
const { proactiveAssistanceEngineInstance, PROACTIVE_CATEGORIES, PROACTIVE_LEVELS } = require('../proactive/proactiveAssistanceEngine.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const AMBIENT_STATES = {
  DISABLED: 'DISABLED',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  EMERGENCY_HALTED: 'EMERGENCY_HALTED'
};

const PRESENCE_STATES = {
  DISABLED: 'DISABLED',
  USER_PRESENT: 'USER_PRESENT',
  USER_STEPPED_AWAY: 'USER_STEPPED_AWAY'
};

class AmbientVisionDaemon extends EventEmitter {
  constructor(options = {}) {
    super();
    this.cvEngine = options.cvEngine || computerVisionIntelligenceInstance;
    this.cameraEngine = options.cameraEngine || cameraIntelligenceEngineInstance;
    this.proactiveEngine = options.proactiveEngine || proactiveAssistanceEngineInstance;
    this.emergencyStop = options.emergencyStop || emergencyStopControllerInstance;

    // Separate Explicit Consents (Strictly OFF by default)
    this.screenObservationConsent = false;
    this.webcamPresenceConsent = false;
    this.continuousRecording = false; // Never records continuously by default

    // Daemon State & Configurable Frequency
    this.state = AMBIENT_STATES.DISABLED;
    this.observationIntervalMs = options.observationIntervalMs || 5000;
    this.timerHandle = null;

    // Visible Indicators
    this.indicators = {
      screenIndicatorVisible: false,
      webcamIndicatorVisible: false,
      microphoneIndicatorVisible: false
    };

    // Strict Privacy Enforcement Flags
    this.privacyGuarantees = {
      noHiddenSensorAccess: true,
      continuousRecordingDefaultOff: true,
      separateScreenAndWebcamConsent: true,
      faceIdentificationProhibited: true,
      emotionInferenceProhibited: true,
      autoLockCloseModifyProhibited: true
    };

    // Event-driven screen-change state
    this.lastFrameSignature = null;
    this.lastActiveWindowTitle = null;
    this.consecutiveStuckCount = 0;
    this.lastErrorSignature = null;

    // Presence & Return Summary State
    this.presenceState = PRESENCE_STATES.DISABLED;
    this.steppedAwayTimestamp = null;
    this.eventsWhileAway = [];
    this.observationHistory = [];

    // Metrics
    this.metrics = {
      totalTicks: 0,
      meaningfulChangesProcessed: 0,
      unchangedFramesSkipped: 0,
      vsCodeErrorsDetected: 0,
      stuckWorkflowsDetected: 0,
      proactiveSuggestionsOffered: 0,
      lastTickLatencyMs: 0
    };

    // Register Emergency Stop Handler
    if (this.emergencyStop && typeof this.emergencyStop.registerStopHandler === 'function') {
      this.emergencyStop.registerStopHandler('AmbientVisionDaemon', (reason) => {
        if (this.timerHandle) {
          clearInterval(this.timerHandle);
          this.timerHandle = null;
        }
        this.screenObservationConsent = false;
        this.webcamPresenceConsent = false;
        this.presenceState = PRESENCE_STATES.DISABLED;
        this.state = AMBIENT_STATES.EMERGENCY_HALTED;
        if (this.cameraEngine && this.cameraEngine.cameraState) {
          this.cameraEngine.cameraState.active = false;
          this.cameraEngine.cameraState.activeIndicatorVisible = false;
        }
        this._syncIndicators();
      });
    }
  }

  /**
   * Configures observation frequency (minimum 500ms to prevent CPU saturation).
   */
  setObservationFrequency(intervalMs = 5000) {
    const parsed = Number(intervalMs);
    if (isNaN(parsed) || parsed < 500) {
      throw new Error('INVALID_OBSERVATION_INTERVAL: Observation interval must be at least 500ms.');
    }
    this.observationIntervalMs = parsed;
    return {
      success: true,
      observationIntervalMs: this.observationIntervalMs
    };
  }

  /**
   * Enables ambient observation with separate explicit consent flags for screen and webcam.
   */
  async enableAmbientObservation({
    screenConsent = false,
    webcamPresenceConsent = false,
    observationIntervalMs = null
  } = {}) {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Cannot enable Ambient Vision while Emergency Stop is engaged.');
    }

    if (screenConsent !== true && webcamPresenceConsent !== true) {
      this.state = AMBIENT_STATES.DISABLED;
      this._syncIndicators();
      return {
        success: false,
        error: 'CONSENT_REQUIRED: At least one explicit consent flag (screenConsent: true or webcamPresenceConsent: true) is required.',
        state: this.state,
        indicators: { ...this.indicators }
      };
    }

    if (observationIntervalMs !== null) {
      this.setObservationFrequency(observationIntervalMs);
    }

    this.screenObservationConsent = Boolean(screenConsent === true);
    this.webcamPresenceConsent = Boolean(webcamPresenceConsent === true);
    this.state = AMBIENT_STATES.ACTIVE;

    if (this.webcamPresenceConsent) {
      await this.cameraEngine.startCamera('integrated_webcam_0', true);
      this.presenceState = PRESENCE_STATES.USER_PRESENT;
    } else {
      await this.cameraEngine.stopCamera('Webcam consent not enabled for ambient session');
      this.presenceState = PRESENCE_STATES.DISABLED;
    }

    this._syncIndicators();
    this.emit('stateChange', this.getStatus());

    return {
      success: true,
      state: this.state,
      screenObservationConsent: this.screenObservationConsent,
      webcamPresenceConsent: this.webcamPresenceConsent,
      observationIntervalMs: this.observationIntervalMs,
      indicators: { ...this.indicators },
      privacyGuarantees: { ...this.privacyGuarantees }
    };
  }

  /**
   * Immediately pauses ambient observation and hides active observation indicators.
   */
  async pauseAmbientObservation(reason = 'User paused ambient observation') {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.state = AMBIENT_STATES.PAUSED;
    if (this.cameraEngine.cameraState.active) {
      await this.cameraEngine.stopCamera('Ambient observation paused');
    }
    this._syncIndicators();
    this.emit('stateChange', this.getStatus());

    return {
      success: true,
      state: this.state,
      indicators: { ...this.indicators },
      reason
    };
  }

  /**
   * Resumes ambient observation using previously granted consent flags.
   */
  async resumeAmbientObservation() {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Cannot resume Ambient Vision while Emergency Stop is engaged.');
    }
    if (!this.screenObservationConsent && !this.webcamPresenceConsent) {
      return {
        success: false,
        error: 'CONSENT_REQUIRED: Cannot resume without explicit screen or webcam consent.'
      };
    }

    this.state = AMBIENT_STATES.ACTIVE;
    if (this.webcamPresenceConsent) {
      await this.cameraEngine.startCamera('integrated_webcam_0', true);
    }
    this._syncIndicators();
    this.emit('stateChange', this.getStatus());

    return {
      success: true,
      state: this.state,
      indicators: { ...this.indicators }
    };
  }

  /**
   * Immediately stops ambient observation, revokes active sensors, and turns off all indicators.
   */
  async stopAmbientObservation(reason = 'User stopped ambient observation') {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.state = AMBIENT_STATES.STOPPED;
    this.screenObservationConsent = false;
    this.webcamPresenceConsent = false;
    this.presenceState = PRESENCE_STATES.DISABLED;
    this.lastFrameSignature = null;

    await this.cameraEngine.stopCamera(reason);
    this._syncIndicators();
    this.emit('stateChange', this.getStatus());

    return {
      success: true,
      state: this.state,
      screenObservationConsent: this.screenObservationConsent,
      webcamPresenceConsent: this.webcamPresenceConsent,
      indicators: { ...this.indicators },
      reason
    };
  }

  _syncIndicators() {
    const isActive = this.state === AMBIENT_STATES.ACTIVE;
    this.indicators = {
      screenIndicatorVisible: Boolean(isActive && this.screenObservationConsent),
      webcamIndicatorVisible: Boolean(isActive && this.webcamPresenceConsent && this.cameraEngine.cameraState.active),
      microphoneIndicatorVisible: false
    };
  }

  /**
   * Executes an event-driven ambient observation tick.
   * - Skips heavy processing if the screen signature has not meaningfully changed.
   * - Recognizes open applications, visible VS Code errors, and stuck workflows.
   * - Offers explainable proactive assistance without ever automatically modifying/closing/locking apps.
   * - Processes coarse presence signal (USER_PRESENT vs USER_STEPPED_AWAY) when webcamPresenceConsent is true.
   */
  async observeEnvironmentTick(simulatedContext = null) {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      await this.stopAmbientObservation('EMERGENCY_STOP_ACTIVE');
      throw new Error('EMERGENCY_STOP_ACTIVE: Ambient observation tick halted by Emergency Stop.');
    }

    if (this.state !== AMBIENT_STATES.ACTIVE || (!this.screenObservationConsent && !this.webcamPresenceConsent)) {
      return {
        success: false,
        error: 'AMBIENT_OBSERVATION_INACTIVE: Enable ambient observation with explicit consent first.',
        state: this.state,
        indicators: { ...this.indicators }
      };
    }

    const t0 = Date.now();
    this.metrics.totalTicks++;

    // Guardrail: Reject any request attempting biometric face ID or emotion inference
    if (simulatedContext && (simulatedContext.requestFaceIdentification || simulatedContext.requestEmotionInference)) {
      return {
        success: false,
        blockedByPrivacyGuard: true,
        error: 'PRIVACY_VIOLATION_BLOCKED: Biometric face identification and emotion inference are strictly prohibited.'
      };
    }

    let presenceUpdate = null;
    if (this.webcamPresenceConsent && simulatedContext && simulatedContext.userPresent !== undefined) {
      presenceUpdate = this._updateUserPresence(Boolean(simulatedContext.userPresent), simulatedContext.requestReturnSummary);
    }

    if (!this.screenObservationConsent) {
      const latencyMs = Math.max(1, Date.now() - t0);
      this.metrics.lastTickLatencyMs = latencyMs;
      return {
        success: true,
        screenObserved: false,
        presenceUpdate,
        indicators: { ...this.indicators },
        latencyMs
      };
    }

    // Obtain screen/window state (either from live desktop or controlled test context)
    let activeWindowTitle = '';
    let activeAppName = '';
    let visibleText = '';
    let openApplications = [];
    let frameBytesOrKey = '';

    if (simulatedContext) {
      activeWindowTitle = simulatedContext.activeWindowTitle || 'Visual Studio Code - server.js';
      activeAppName = simulatedContext.activeAppName || this._inferAppName(activeWindowTitle);
      visibleText = simulatedContext.visibleText || '';
      openApplications = simulatedContext.openApplications || [activeAppName];
      frameBytesOrKey = simulatedContext.frameSignature || `${activeWindowTitle}|${visibleText}`;
    } else {
      const hierarchy = await this.cvEngine.inspectUIHierarchy();
      activeWindowTitle = hierarchy.activeWindowTitle || 'Windows Desktop';
      activeAppName = this._inferAppName(activeWindowTitle);
      visibleText = (hierarchy.elements || []).map(e => e.Name).filter(Boolean).join(' ');
      openApplications = [activeAppName];
      frameBytesOrKey = `${activeWindowTitle}|${visibleText}`;
    }

    const currentSignature = crypto.createHash('sha256').update(String(frameBytesOrKey)).digest('hex');

    // Event-Driven Screen-Change Detection: Skip redundant analysis if screen is unchanged
    // unless we are tracking a recurring stuck workflow across ticks
    const isUnchanged = (currentSignature === this.lastFrameSignature && activeWindowTitle === this.lastActiveWindowTitle);
    if (isUnchanged && !(simulatedContext && simulatedContext.checkStuckWorkflow)) {
      this.metrics.unchangedFramesSkipped++;
      const latencyMs = Math.max(1, Date.now() - t0);
      this.metrics.lastTickLatencyMs = latencyMs;
      return {
        success: true,
        meaningfulChangeDetected: false,
        skippedUnchangedFrame: true,
        activeAppName,
        activeWindowTitle,
        presenceUpdate,
        indicators: { ...this.indicators },
        latencyMs
      };
    }

    this.lastFrameSignature = currentSignature;
    this.lastActiveWindowTitle = activeWindowTitle;
    this.metrics.meaningfulChangesProcessed++;

    // Detect visible VS Code / IDE errors
    const detectedError = this._detectVisibleError(activeWindowTitle, visibleText);
    if (detectedError) {
      this.metrics.vsCodeErrorsDetected++;
      if (this.lastErrorSignature === detectedError.errorSignature) {
        this.consecutiveStuckCount++;
      } else {
        this.lastErrorSignature = detectedError.errorSignature;
        this.consecutiveStuckCount = 1;
      }
    } else {
      this.lastErrorSignature = null;
      this.consecutiveStuckCount = 0;
    }

    const isStuckWorkflow = this.consecutiveStuckCount >= 2 || Boolean(simulatedContext && simulatedContext.stuckIterations >= 2);
    if (isStuckWorkflow) {
      this.metrics.stuckWorkflowsDetected++;
    }

    // Generate non-intrusive, explainable proactive suggestion if error or stuck workflow found
    let proactiveOffer = null;
    if (detectedError || isStuckWorkflow) {
      const title = isStuckWorkflow
        ? `Stuck Workflow Detected in ${activeAppName}`
        : `Visible Error Detected in ${activeAppName}`;
      const explanation = detectedError
        ? `Observed "${detectedError.summary}" in "${activeWindowTitle}". Suggested fix: ${detectedError.suggestedFix}`
        : `Observed repeated unsuccessful state in "${activeWindowTitle}".`;

      proactiveOffer = {
        title,
        category: PROACTIVE_CATEGORIES.CONTEXTUAL,
        explanation,
        suggestedFix: detectedError ? detectedError.suggestedFix : 'Review active dialog or run diagnostic check.',
        autoExecuted: false // Strictly never modifies or closes apps automatically
      };
      this.metrics.proactiveSuggestionsOffered++;

      try {
        this.proactiveEngine.proposeRecommendation({
          title,
          category: PROACTIVE_CATEGORIES.CONTEXTUAL,
          minimumLevel: PROACTIVE_LEVELS.L1_CONTEXTUAL,
          message: explanation,
          reason: `Ambient Vision observed ${detectedError ? 'an active IDE diagnostic error' : 'a repeated stuck workflow'} while screen observation consent was enabled.`,
          actionableSteps: [proactiveOffer.suggestedFix]
        });
      } catch (_) {}
    }

    const observationRecord = {
      observationId: `obs_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      activeAppName,
      activeWindowTitle,
      openApplications,
      meaningfulChangeDetected: true,
      detectedError,
      isStuckWorkflow,
      proactiveOffer,
      autoModifiedApplications: false
    };

    this.observationHistory.push(observationRecord);
    if (this.observationHistory.length > 50) {
      this.observationHistory.shift();
    }

    if (this.presenceState === PRESENCE_STATES.USER_STEPPED_AWAY) {
      this.eventsWhileAway.push({
        timestamp: observationRecord.timestamp,
        summary: detectedError
          ? `${activeAppName} reported: ${detectedError.summary}`
          : `Screen updated in ${activeAppName} (${activeWindowTitle})`
      });
    }

    const latencyMs = Math.max(1, Date.now() - t0);
    this.metrics.lastTickLatencyMs = latencyMs;

    return {
      success: true,
      meaningfulChangeDetected: true,
      skippedUnchangedFrame: false,
      observation: observationRecord,
      presenceUpdate,
      indicators: { ...this.indicators },
      latencyMs
    };
  }

  _inferAppName(windowTitle = '') {
    const lower = String(windowTitle).toLowerCase();
    if (lower.includes('visual studio code') || lower.includes('vscode')) return 'Visual Studio Code';
    if (lower.includes('chrome')) return 'Google Chrome';
    if (lower.includes('excel')) return 'Microsoft Excel';
    if (lower.includes('whatsapp')) return 'WhatsApp';
    if (lower.includes('powershell') || lower.includes('terminal')) return 'Windows Terminal';
    return windowTitle.split('-').pop().trim() || 'Windows Application';
  }

  _detectVisibleError(windowTitle = '', visibleText = '') {
    const combined = `${windowTitle}\n${visibleText}`;
    if (!/(error|exception|cannot find module|syntaxerror|typeerror|referenceerror|pyrefly|failed|exit code [1-9])/i.test(combined)) {
      return null;
    }

    let errorType = 'IDE_DIAGNOSTIC_ERROR';
    let summary = 'Diagnostic error detected in active editor/terminal.';
    let suggestedFix = 'Inspect the highlighted line in the Problems panel and verify module imports and variable types.';

    const missingMod = combined.match(/cannot find module ['"`]([^'"`]+)['"`]/i);
    if (missingMod) {
      errorType = 'MISSING_MODULE_IMPORT';
      summary = `Cannot find module '${missingMod[1]}'`;
      suggestedFix = `Install '${missingMod[1]}' in the project environment or replace it with an existing standard library / Pillow equivalent.`;
    } else if (/typeerror:\s*([^\r\n]+)/i.test(combined)) {
      const m = combined.match(/typeerror:\s*([^\r\n]+)/i);
      errorType = 'RUNTIME_TYPE_ERROR';
      summary = `TypeError: ${m[1].trim()}`;
      suggestedFix = 'Add null/undefined guards or verify the object schema before accessing the property.';
    } else if (/syntaxerror:\s*([^\r\n]+)/i.test(combined)) {
      const m = combined.match(/syntaxerror:\s*([^\r\n]+)/i);
      errorType = 'SYNTAX_ERROR';
      summary = `SyntaxError: ${m[1].trim()}`;
      suggestedFix = 'Fix the syntax token or closing bracket at the reported line.';
    }

    const errorSignature = crypto.createHash('md5').update(`${errorType}:${summary}`).digest('hex');
    return {
      errorType,
      summary,
      suggestedFix,
      errorSignature
    };
  }

  _updateUserPresence(isUserPresent, requestReturnSummary = false) {
    if (!this.webcamPresenceConsent) {
      return { enabled: false, presenceState: PRESENCE_STATES.DISABLED };
    }

    const previousState = this.presenceState;
    if (!isUserPresent) {
      this.presenceState = PRESENCE_STATES.USER_STEPPED_AWAY;
      if (!this.steppedAwayTimestamp) {
        this.steppedAwayTimestamp = new Date().toISOString();
      }
      return {
        enabled: true,
        previousState,
        presenceState: this.presenceState,
        steppedAwayAt: this.steppedAwayTimestamp,
        autoLockedOrClosedApps: false // Never locks or closes apps automatically
      };
    }

    // User is present
    this.presenceState = PRESENCE_STATES.USER_PRESENT;
    let returnSummary = null;
    if (previousState === PRESENCE_STATES.USER_STEPPED_AWAY && requestReturnSummary) {
      returnSummary = this.generateReturnSummary();
    }
    this.steppedAwayTimestamp = null;

    return {
      enabled: true,
      previousState,
      presenceState: this.presenceState,
      returnSummary,
      autoLockedOrClosedApps: false
    };
  }

  /**
   * Generates a concise summary of events observed while the user stepped away.
   */
  generateReturnSummary() {
    const count = this.eventsWhileAway.length;
    const summaryText = count === 0
      ? 'Welcome back, sir. No significant screen alerts or errors occurred while you were away.'
      : `Welcome back, sir. While you were away, I noted ${count} event(s): ${this.eventsWhileAway.map(e => e.summary).join('; ')}.`;

    const snapshot = {
      eventCount: count,
      events: [...this.eventsWhileAway],
      summaryText,
      generatedAt: new Date().toISOString()
    };
    this.eventsWhileAway = [];
    return snapshot;
  }

  getStatus() {
    return {
      state: this.state,
      screenObservationConsent: this.screenObservationConsent,
      webcamPresenceConsent: this.webcamPresenceConsent,
      continuousRecording: this.continuousRecording,
      observationIntervalMs: this.observationIntervalMs,
      presenceState: this.presenceState,
      indicators: { ...this.indicators },
      privacyGuarantees: { ...this.privacyGuarantees },
      lastActiveWindowTitle: this.lastActiveWindowTitle,
      eventsWhileAwayCount: this.eventsWhileAway.length,
      metrics: { ...this.metrics }
    };
  }
}

const ambientVisionDaemonInstance = new AmbientVisionDaemon();

module.exports = {
  AmbientVisionDaemon,
  ambientVisionDaemonInstance,
  AMBIENT_STATES,
  PRESENCE_STATES
};
