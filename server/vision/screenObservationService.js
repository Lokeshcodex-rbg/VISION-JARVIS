/**
 * VISION AI — User-Controlled Screen Observation & Assistant Interaction Mode Service
 * Integrates AmbientVisionDaemon, ScreenUnderstandingEngine, VisionService, Win32 active window inspection,
 * and configurable Assistant Modes (COMMAND | CONVERSATION | PROACTIVE | QUIET).
 */

const fs = require('fs');
const { ambientVisionDaemonInstance, AMBIENT_STATES } = require('./ambientVisionDaemon.js');
const { screenUnderstandingEngineInstance } = require('./screenUnderstandingEngine.js');
const { visionServiceInstance } = require('../visionService.js');
const { desktopControllerInstance } = require('../desktop/desktopController.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const ASSISTANT_MODES = {
  COMMAND: 'COMMAND',
  CONVERSATION: 'CONVERSATION',
  PROACTIVE: 'PROACTIVE',
  QUIET: 'QUIET'
};

class ScreenObservationService {
  constructor() {
    this.ambientDaemon = ambientVisionDaemonInstance;
    this.screenEngine = screenUnderstandingEngineInstance;
    this.visionService = visionServiceInstance;
    this.desktopController = desktopControllerInstance;
    this.emergencyStop = emergencyStopControllerInstance;

    this.assistantMode = ASSISTANT_MODES.CONVERSATION;
    this.observationScope = 'NONE'; // 'NONE' | 'TASK' | 'CONTINUOUS'
    this.observationLeaseStartedAt = null;
    this.lastObservation = null;
    this.lastActionRecord = null;
  }

  getStatus() {
    const emergencyStopped = this.emergencyStop && typeof this.emergencyStop.isEngaged === 'function'
      ? this.emergencyStop.isEngaged()
      : false;
    const enabled = Boolean(this.ambientDaemon.screenObservationConsent) && this.ambientDaemon.state === AMBIENT_STATES.ACTIVE;
    if (!enabled && this.observationScope !== 'NONE') {
      this.observationScope = 'NONE';
      this.observationLeaseStartedAt = null;
    }
    return {
      screenObservationEnabled: enabled,
      screenObservationConsent: Boolean(this.ambientDaemon.screenObservationConsent),
      daemonState: emergencyStopped ? AMBIENT_STATES.EMERGENCY_HALTED : this.ambientDaemon.state,
      screenIndicatorVisible: Boolean(this.ambientDaemon.indicators?.screenIndicatorVisible),
      webcamPresenceConsent: Boolean(this.ambientDaemon.webcamPresenceConsent),
      assistantMode: this.assistantMode,
      observationScope: this.observationScope,
      observationLeaseStartedAt: this.observationLeaseStartedAt,
      emergencyStopped,
      lastObservationAt: this.lastObservation ? this.lastObservation.observedAt : null,
      lastForegroundWindow: this.lastObservation ? this.lastObservation.foregroundWindow : null
    };
  }

  setAssistantMode(mode) {
    const clean = String(mode || '').toUpperCase().trim();
    if (!ASSISTANT_MODES[clean]) {
      throw new Error(`Invalid assistant mode "${mode}". Allowed: COMMAND, CONVERSATION, PROACTIVE, QUIET.`);
    }
    this.assistantMode = clean;
    return {
      success: true,
      assistantMode: this.assistantMode,
      summary: `Assistant interaction mode switched to ${this.assistantMode}, sir.`
    };
  }

  async enableObservation({ reason = 'User explicitly enabled Screen Observation Mode', scope = 'CONTINUOUS' } = {}) {
    if (this.emergencyStop && typeof this.emergencyStop.isEngaged === 'function' && this.emergencyStop.isEngaged()) {
      return {
        success: false,
        verified: false,
        error: 'EMERGENCY_STOP_ACTIVE',
        summary: 'Emergency Stop is currently active. Reset Emergency Stop before enabling Screen Observation Mode.'
      };
    }

    const normalizedScope = String(scope || 'CONTINUOUS').toUpperCase() === 'TASK' ? 'TASK' : 'CONTINUOUS';
    const res = await this.ambientDaemon.enableAmbientObservation({
      screenConsent: true,
      webcamPresenceConsent: this.ambientDaemon.webcamPresenceConsent
    });

    if (!res || !res.success || this.ambientDaemon.state !== AMBIENT_STATES.ACTIVE) {
      this.observationScope = 'NONE';
      this.observationLeaseStartedAt = null;
      return {
        success: false,
        verified: false,
        screenObservationEnabled: false,
        daemonState: res?.state || this.ambientDaemon.state,
        error: res?.error || 'ENABLE_FAILED',
        summary: res?.error || 'Failed to activate Screen Observation Mode.'
      };
    }

    this.observationScope = normalizedScope;
    this.observationLeaseStartedAt = Date.now();

    // Perform an immediate grounded window check (metadata only) to verify WinSta0 access
    let fg = null;
    try {
      const winList = await this.desktopController.listOpenWindows();
      fg = winList.foregroundWindow || null;
    } catch (_) {}

    return {
      success: true,
      verified: true,
      screenObservationEnabled: true,
      daemonState: res.state,
      screenIndicatorVisible: true,
      observationScope: this.observationScope,
      foregroundWindow: fg,
      summary: fg
        ? `Screen Observation is now ACTIVE (${this.observationScope === 'TASK' ? 'this task only' : 'continuous'}), sir. Observing indicator is visible. Focused window: "${fg.windowTitle}" (${fg.processName}).`
        : `Screen Observation is now ACTIVE (${this.observationScope === 'TASK' ? 'this task only' : 'continuous'}), sir. Observing indicator is visible.`
    };
  }

  pauseObservation() {
    this.observationScope = 'NONE';
    this.observationLeaseStartedAt = null;
    this.ambientDaemon.state = AMBIENT_STATES.PAUSED;
    if (this.ambientDaemon.indicators) {
      this.ambientDaemon.indicators.screenIndicatorVisible = false;
    }
    return {
      success: true,
      verified: true,
      screenObservationEnabled: false,
      daemonState: AMBIENT_STATES.PAUSED,
      summary: 'Screen Observation Mode is PAUSED, sir. Screen capture is suspended.'
    };
  }

  async disableObservation(reason = 'User disabled Screen Observation Mode') {
    this.observationScope = 'NONE';
    this.observationLeaseStartedAt = null;
    const res = await this.ambientDaemon.stopAmbientObservation(reason);
    return {
      success: true,
      verified: true,
      screenObservationEnabled: false,
      daemonState: res.state || AMBIENT_STATES.DISABLED,
      screenIndicatorVisible: false,
      summary: 'Screen Observation Mode has been stopped and disabled, sir.'
    };
  }

  async completeTaskObservationIfScoped(reason = 'TASK_COMPLETED') {
    const status = this.getStatus();
    if (status.screenObservationEnabled && this.observationScope === 'TASK') {
      const disabled = await this.disableObservation(reason);
      return { autoStopped: true, ...disabled };
    }
    return { autoStopped: false, screenObservationEnabled: status.screenObservationEnabled };
  }

  _buildPermissionRequiredResult(actionLabel = 'inspect your active window') {
    return {
      success: false,
      verified: true,
      permissionRequired: true,
      screenObservationEnabled: false,
      screenIndicatorVisible: false,
      assistantMode: this.assistantMode,
      state: 'WAITING_FOR_PERMISSION',
      consentScopeSuggestion: 'TASK',
      consentPrompt: `Allow JARVIS to temporarily observe your screen to ${actionLabel}? A visible Observing indicator will be displayed and turned off automatically once finished.`,
      summary: `Screen Observation is currently OFF to protect your privacy, sir. Please grant screen-observation permission so I can show the Observing indicator and ${actionLabel}.`
    };
  }

  /**
   * Truthfully inspects the foreground Windows app, open windows, UI Automation tree,
   * and (optionally via Gemini Vision) screen pixels — ONLY when Screen Observation Mode is enabled!
   */
  async inspectScreen({ question = 'What is on my active window and screen?', includeScreenshotAnalysis = true } = {}) {
    const status = this.getStatus();
    if (status.emergencyStopped) {
      return {
        success: false,
        verified: false,
        permissionRequired: false,
        state: 'BLOCKED',
        summary: 'Screen inspection is blocked because Emergency Stop is active, sir.'
      };
    }

    if (!status.screenObservationEnabled) {
      return this._buildPermissionRequiredResult('inspect your active window and visible content');
    }

    // 1. Get verified Win32 windows & foreground window
    const windowsRes = await this.desktopController.listOpenWindows();
    const activeApp = await this.screenEngine.getActiveApplication().catch(() => ({ success: false }));
    const fgWindow = activeApp.success ? {
      hwnd: activeApp.hwnd,
      title: activeApp.title,
      className: activeApp.className,
      pid: activeApp.pid,
      rect: activeApp.rect
    } : (windowsRes.foregroundWindow || null);

    // 2. Get Windows UI Automation Accessibility Elements for the foreground window
    let uiElements = [];
    try {
      const treeRes = await this.screenEngine.getAccessibilityTree(fgWindow?.hwnd || null);
      if (treeRes && treeRes.success && Array.isArray(treeRes.elements)) {
        uiElements = treeRes.elements
          .filter(e => e && e.name && e.name.trim())
          .slice(0, 25)
          .map(e => ({ name: e.name.trim(), controlType: e.controlType }));
      }
    } catch (_) {}

    // 3. Capture real screen screenshot & analyze if requested
    let screenshotPath = null;
    let visionAnalysis = null;
    if (includeScreenshotAnalysis) {
      try {
        const cap = await this.screenEngine.captureScreen();
        if (cap && cap.success && cap.path && fs.existsSync(cap.path)) {
          screenshotPath = cap.path;
          const imgB64 = fs.readFileSync(cap.path).toString('base64');
          const visionRes = await this.visionService.analyzeImage(
            `data:image/png;base64,${imgB64}`,
            `Analyze this live Windows desktop screenshot accurately and concisely. Foreground window title is "${fgWindow?.title || fgWindow?.windowTitle || 'Unknown'}". User question: "${question}". Only state what is visibly present on screen.`,
            'JARVIS'
          );
          if (visionRes && visionRes.success && visionRes.analysis && visionRes.provider !== 'local_inspection') {
            visionAnalysis = visionRes.analysis;
          }
        }
      } catch (_) {}
    }

    const openTitles = (windowsRes.windows || [])
      .filter(w => w.windowTitle && w.windowTitle !== 'Program Manager' && w.windowTitle !== 'Windows Input Experience')
      .map(w => `${w.windowTitle} (${w.processName || w.proc || 'app'})`);

    const uiTextSample = uiElements.slice(0, 8).map(e => e.name).join(' | ');
    const fgTitle = fgWindow?.title || fgWindow?.windowTitle || 'Windows Desktop';

    const groundedSummary = visionAnalysis
      ? `${visionAnalysis}`
      : `Your active foreground window is "${fgTitle}" (HWND ${fgWindow?.hwnd || 'N/A'}). Visible UI controls include: ${uiTextSample || 'none enumerated'}. Other open windows: ${openTitles.slice(0, 5).join('; ') || 'none'}.`;

    this.lastObservation = {
      observedAt: new Date().toISOString(),
      foregroundWindow: fgWindow,
      openWindowsCount: openTitles.length,
      openWindows: openTitles,
      uiElementsSample: uiElements.slice(0, 12),
      screenshotPath,
      visionAnalysis,
      verified: true
    };

    return {
      success: true,
      verified: true,
      screenObservationEnabled: true,
      foregroundWindow: fgWindow,
      openWindows: openTitles,
      uiElementsSample: uiElements.slice(0, 12),
      screenshotPath,
      visionAnalysis,
      summary: groundedSummary
    };
  }

  async _ensureScreenConsentAndFrame(actionLabel, imageBase64 = null) {
    const status = this.getStatus();
    if (status.emergencyStopped) {
      return {
        blockedResult: {
          success: false,
          verified: false,
          permissionRequired: false,
          state: 'BLOCKED',
          summary: 'Screen inspection is blocked because Emergency Stop is active, sir.'
        }
      };
    }
    if (imageBase64) {
      return { frame: imageBase64, screenshotPath: null };
    }
    if (!status.screenObservationEnabled) {
      return { blockedResult: this._buildPermissionRequiredResult(actionLabel) };
    }
    try {
      const cap = await this.screenEngine.captureScreen();
      if (cap && cap.success && cap.path && fs.existsSync(cap.path)) {
        const imgB64 = fs.readFileSync(cap.path).toString('base64');
        return { frame: `data:image/png;base64,${imgB64}`, screenshotPath: cap.path };
      }
    } catch (_) {}
    return { frame: null, screenshotPath: null };
  }

  async captureScreenWithConsent() {
    const check = await this._ensureScreenConsentAndFrame('capture a screenshot of your screen');
    if (check.blockedResult) return check.blockedResult;
    if (check.screenshotPath) {
      return {
        success: true,
        verified: true,
        screenObservationEnabled: true,
        screenshotPath: check.screenshotPath,
        timestamp: Date.now(),
        summary: `Display screen capture acquired (${check.screenshotPath}).`
      };
    }
    const res = await this.visionService.captureScreen();
    return { ...res, screenObservationEnabled: true, verified: true };
  }

  async analyzeScreenWithConsent({ imageBase64, prompt = 'Analyze the current screen and visible application content.', personality = 'JARVIS' } = {}) {
    const check = await this._ensureScreenConsentAndFrame('analyze your active screen', imageBase64);
    if (check.blockedResult) return check.blockedResult;
    const res = await this.visionService.analyzeScreen({ imageBase64: check.frame, prompt, personality });
    return { ...res, screenshotPath: check.screenshotPath, screenObservationEnabled: this.getStatus().screenObservationEnabled, verified: true };
  }

  async diagnoseScreenErrorWithConsent({ imageBase64, prompt = 'Diagnose the visible error or stack trace on this screen.', personality = 'JARVIS' } = {}) {
    const check = await this._ensureScreenConsentAndFrame('diagnose the error on your screen', imageBase64);
    if (check.blockedResult) return check.blockedResult;
    const res = await this.visionService.diagnoseScreenError({ imageBase64: check.frame, prompt, personality });
    return { ...res, screenshotPath: check.screenshotPath, screenObservationEnabled: this.getStatus().screenObservationEnabled, verified: true };
  }

  async readScreenTextWithConsent({ imageBase64, prompt = 'Extract and read all visible text and code from this screen.', personality = 'JARVIS' } = {}) {
    const check = await this._ensureScreenConsentAndFrame('read visible text on your screen', imageBase64);
    if (check.blockedResult) return check.blockedResult;
    const res = await this.visionService.readScreenText({ imageBase64: check.frame, prompt, personality });
    return { ...res, screenshotPath: check.screenshotPath, screenObservationEnabled: this.getStatus().screenObservationEnabled, verified: true };
  }
}

module.exports = {
  ScreenObservationService,
  ASSISTANT_MODES,
  screenObservationServiceInstance: new ScreenObservationService()
};

