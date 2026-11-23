/**
 * VISION AI — JARVIS & ULTRON Cinematic Desktop Companion Master Controller
 * 60 FPS Canvas Render Loop with Real-Time Web Speech API Recognition ("Ultron" / "Jarvis"),
 * Full Atmospheric 1100ms Personality Transitions, Cinematic Emergence from Darkness,
 * Visual State Machine (Waking Up, Listening, Thinking, Speaking, Tool Execution, Sleep),
 * and Electron Desktop IPC Synchronization.
 */

import { CONFIG } from './config.js';
import { EyeGeometry } from './modules/eyeGeometry.js';
import { BlinkStateMachine } from './modules/blinkStateMachine.js';
import { GazeTracker } from './modules/gazeTracker.js';
import { CodeField } from './modules/codeField.js';
import { IrisRenderer } from './modules/irisRenderer.js';
import { BackgroundCodeMatrix } from './modules/backgroundCodeMatrix.js';
import { VoiceController } from './modules/voiceController.js';
import { SpeechSynthesizer } from './modules/speechSynthesizer.js';
import { AudioSynthesizer } from './modules/audioSynthesizer.js';
import { AIClient } from './modules/aiClient.js';
import { SmokeCaptions } from './modules/smokeCaptions.js';
import { VoiceDiagnostics } from './modules/voiceDiagnostics.js';
import { EmergencyStopCoordinator } from './modules/emergencyStopCoordinator.js';
import { CommandAndPermissionUI } from './modules/commandAndPermissionUI.js';
import { ChatExperience } from './modules/chatExperience.js';
import { FloatingVoiceWindow } from './modules/floatingVoiceWindow.js';
import { StarkNavigation } from './modules/starkNavigation.js';
import { Brain3DVisualizer } from './modules/brain3DVisualizer.js';
import { KnowledgeExplorerUI } from './modules/knowledgeExplorerUI.js';
import { EngineeringLabUI } from './modules/engineeringLabUI.js';
import { AiCreationLabUI } from './modules/aiCreationLabUI.js';
import { StarkViewPanels } from './modules/starkViewPanels.js';
import { stark3DViewerInstance } from './modules/stark3DViewer.js';
import { starkSimulationViewerInstance } from './modules/starkSimulationViewer.js';
import { clamp, easeInOutCubic, easeOutCubic, lerp, randomRange } from './math/utils.js';

export class JarvisOcularApp {
  constructor() {
    this.canvas = document.getElementById('eye-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.isPaused = false;
    this.lastTimestamp = performance.now();

    // Dual AI Theme State (Default: ULTRON Crimson)
    this.currentTheme = CONFIG.transition.defaultTheme || 'ULTRON';
    this.targetTheme = this.currentTheme;
    this.themeProgressRaw = this.currentTheme === 'JARVIS' ? 1.0 : 0.0; // 0.0 = ULTRON, 1.0 = JARVIS
    this.themeTransitionDuration = CONFIG.transition.durationMs || 1100; // 1100ms

    // Visual Lifecycle State Machine
    // States: 'EYE_OPEN' | 'EYE_CLOSING' | 'DORMANT' | 'EYE_OPENING' | 'EYE_SWITCHING'
    this.visualLifecycleState = 'EYE_OPEN';
    this.expressionState = 'LISTENING'; // 'LISTENING' | 'THINKING' | 'SPEAKING' | 'EXECUTING_TOOL' | 'REPORTING_RESULT' | 'WARNING'
    this.visualState = 'LISTENING';     // Backward compatibility for observers
    this.visualTimer = 0;
    this.visualDuration = 0;
    this.visualGeneration = 0;
    this.lastActivePersonality = this.currentTheme;

    // Cinematic Personality Switch State Controller
    this.switchSource = this.currentTheme;
    this.switchTarget = this.currentTheme;
    this.switchTargetInitialized = false;
    this.switchPendingQuery = null;

    // Legacy timing compatibility
    this.stateTimer = 0;
    this.wakeDurationMs = 3600;
    this.sleepDurationMs = 4600;
    this.wakeTimer = 3600;
    this.sleepTimer = 0;
    this.masterAlpha = 1.0;

    // Cinematic Convergence Particles (converging flowing code on waking)
    this.convergenceParticles = [];
    this.initConvergenceParticles();

    // AI & Graphics Subsystems
    this.eyeGeometry = new EyeGeometry();
    this.blinkMachine = new BlinkStateMachine();
    this.gazeTracker = new GazeTracker(this.canvas);
    this.codeField = new CodeField();
    this.irisRenderer = new IrisRenderer();
    this.backgroundMatrix = new BackgroundCodeMatrix();

    // AI Backend Client
    this.aiClient = new AIClient('/api/chat');

    // Minimal White Smoke Captions Component
    this.smokeCaptions = new SmokeCaptions('smoke-captions');

    // Centralized Emergency Stop Coordinator (Missions 3, 4, 5)
    this.emergencyStopCoordinator = new EmergencyStopCoordinator(this);

    // Procedural Audio Synthesizer (Blinks, ambient drone & synthetic voice carriers)
    this.audioSynthesizer = new AudioSynthesizer();

    // AI Voice Personality Speech Synthesis Engine
    this.speechSynthesizer = new SpeechSynthesizer();
    this.speechSynthesizer.onSpeechStart = (theme, text) => {
      if (this.voiceController) {
        this.voiceController.setSubsystemStatus('textToSpeech', 'speaking');
        this.voiceController.notifyAssistantSpeechStart();
      }
      if (this.commandAndPermissionUI) {
        this.commandAndPermissionUI.updateMicrophoneStatus('SPEAKING', theme);
      }
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.onAssistantSpeechStart(theme, text);
      }
    };
    this.speechSynthesizer.onSpeechEnd = (text) => {
      this.resetMainChatButtons();
      if (this.voiceController) {
        this.voiceController.setSubsystemStatus('textToSpeech', 'idle');
        this.voiceController.notifyAssistantSpeechEnd(text);
      }
      if (this.smokeCaptions) {
        this.smokeCaptions.onAssistantSpeechEnd(text);
      }
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.onAssistantSpeechEnd(text);
      }
      if (this.commandAndPermissionUI) {
        const canonical = (this.voiceController && this.voiceController.getCanonicalState)
          ? this.voiceController.getCanonicalState()
          : 'DISABLED';
        this.commandAndPermissionUI.updateMicrophoneStatus(canonical, this.targetTheme);
      }
      this.syncVoiceStateWithBackend('TTS_SPEECH_END');
      if (this.visualLifecycleState === 'EYE_OPEN') {
        const canonical = (this.voiceController && this.voiceController.getCanonicalState)
          ? this.voiceController.getCanonicalState()
          : 'DISABLED';
        this.setExpressionState(canonical === 'LISTENING' ? 'LISTENING' : 'IDLE');
      }
    };
    this.speechSynthesizer.onError = (err) => {
      console.warn('[SPEECH_SYNTHESIZER] TTS Error:', err);
      if (this.voiceController) {
        this.voiceController.setSubsystemStatus('textToSpeech', 'error');
      }
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.onAssistantError(err);
      }
    };
    this.speechSynthesizer.onSentenceStart = (sentence, themeKey, utteranceId) => {
      if (this.voiceController) {
        this.voiceController.notifyCurrentSentence(sentence);
      }
      if (this.smokeCaptions && this.visualLifecycleState !== 'EYE_CLOSING') {
        this.smokeCaptions.showAssistantSentence(sentence, themeKey, utteranceId);
      }
      if (this.stark3DViewer && this.stark3DViewer.modal && this.stark3DViewer.modal.style.display !== 'none') {
        this.stark3DViewer.setVoiceCaption(sentence);
      }
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.onAssistantSentenceStart(sentence, themeKey, utteranceId);
      }
    };
    this.speechSynthesizer.onSentenceEnd = (sentence, themeKey, utteranceId) => {
      if (this.smokeCaptions) {
        this.smokeCaptions.onAssistantSentenceEnd(sentence, themeKey, utteranceId);
      }
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.onAssistantSentenceEnd(sentence, themeKey, utteranceId);
      }
    };
    this.speechSynthesizer.onCarrierCue = (themeKey) => {
      if (this.audioSynthesizer) {
        if (themeKey === 'ULTRON') {
          this.audioSynthesizer.playUltronCarrier();
        } else {
          this.audioSynthesizer.playJarvisCarrier();
        }
      }
    };
    this.speechSynthesizer.onCancel = (reason) => {
      this.resetMainChatButtons();
      this.hideInlineToolBadge();
      if (this.voiceDiagnostics) {
        this.voiceDiagnostics.recordCancellation();
      }
      if (this.smokeCaptions && !this.smokeCaptions.container?.querySelector('.caption-user-final, .caption-user-interim')) {
        this.smokeCaptions.clear(true);
      }
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.stopSpeaking();
      }
    };
    this.speechSynthesizer.onStateChange = (state) => {
      if (this.visualLifecycleState === 'EYE_OPEN') {
        this.setExpressionState(state);
      }
    };

    // Load persisted language preferences on startup
    fetch('/api/language')
      .then(res => res.json())
      .then(data => {
        if (data && data.preferences) {
          const theme = this.targetTheme || 'JARVIS';
          const lang = data.preferences[theme] || 'en';
          if (this.speechSynthesizer) {
            this.speechSynthesizer.setLanguage(lang);
          }
          if (this.voiceController) {
            this.voiceController.setLanguage(lang);
          }
        }
      })
      .catch(() => {});

    // Proactively warm up authenticated session handshake on load
    if (this.aiClient && typeof this.aiClient.getAuthToken === 'function') {
      this.aiClient.getAuthToken().catch(() => {});
    }

    // Real-Time Web Speech & Continuous Audio Stream Voice Controller
    this.voiceController = new VoiceController((commandEvent, transcript) => {
      this.handleVoiceCommand(commandEvent, transcript);
    });

    // Wire up centralized InterruptionManager
    if (this.voiceController && this.voiceController.interruptionManager) {
      this.voiceController.interruptionManager.speechSynthesizer = this.speechSynthesizer;
      this.voiceController.interruptionManager.aiClient = this.aiClient;
      this.voiceController.interruptionManager.smokeCaptions = this.smokeCaptions;
    }

    this.voiceController.onUserSpeech = (transcript, isFinal) => {
      // In continuous listening mode, user speech automatically wakes up UI and renders captions reliably
      if (this.visualLifecycleState === 'DORMANT' && this.voiceController.continuousListening) {
        this.wakeUp(this.targetTheme);
        this.setExpressionState('LISTENING');
      } else if (this.visualLifecycleState === 'EYE_CLOSING' || this.visualLifecycleState === 'EYE_SWITCHING') {
        return;
      }
      if (this.smokeCaptions) {
        this.smokeCaptions.showUserSpeech(transcript, isFinal);
      }
      if (this.stark3DViewer && this.stark3DViewer.modal && this.stark3DViewer.modal.style.display !== 'none') {
        this.stark3DViewer.setVoiceCaption(`${isFinal ? 'You' : 'Hearing'}: ${transcript}`);
      }
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.onUserSpeech(transcript, isFinal);
      }
    };

    this.voiceController.onStateChange = (nextState, prevState, meta) => {
      const canonical = this.voiceController && typeof this.voiceController.getCanonicalState === 'function'
        ? this.voiceController.getCanonicalState()
        : nextState;
      if (this.commandAndPermissionUI) {
        this.commandAndPermissionUI.updateMicrophoneStatus(canonical, this.targetTheme, meta);
      }
      this.syncVoiceStateWithBackend(meta && meta.reason ? meta.reason : nextState);
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.onVoiceStateChange(canonical, meta);
      }
      // Ignore conversation expression changes while visual transition is in flight
      if (this.visualLifecycleState === 'EYE_OPENING' || this.visualLifecycleState === 'EYE_CLOSING' || this.visualLifecycleState === 'EYE_SWITCHING') {
        return;
      }
      switch (canonical) {
        case 'PROCESSING':
          this.setExpressionState('THINKING');
          break;
        case 'SPEAKING':
          this.setExpressionState('SPEAKING');
          break;
        case 'LISTENING':
          this.setExpressionState('LISTENING');
          break;
        case 'READY':
        case 'DISABLED':
        case 'PAUSED':
          if (this.visualLifecycleState === 'EYE_CLOSING') {
            this.setLifecycleState('DORMANT');
          } else if (this.visualLifecycleState === 'EYE_OPEN') {
            this.setExpressionState('IDLE');
          }
          break;
        case 'ERROR':
          this.setExpressionState('WARNING');
          break;
      }
    };

    // Voice & Streaming Latency Diagnostic HUD (Ctrl+Shift+D or ?diag=1)
    this.voiceDiagnostics = new VoiceDiagnostics({
      voiceController: this.voiceController,
      speechSynthesizer: this.speechSynthesizer,
      aiClient: this.aiClient
    });

    // Unified Command Bar & Permissions Governance UI (Phase 2, 8, 9, 10)
    this.commandAndPermissionUI = new CommandAndPermissionUI(this);

    // ChatGPT-Grade Conversational Text Chat Experience (Part 12: Ctrl+Shift+Space)
    this.chatExperience = new ChatExperience(this);

    // Floating Voice Conversation Window (Voice-Activated, Real-Time Left/Right Conversation & Input)
    this.floatingVoiceWindow = new FloatingVoiceWindow(this);
    window.jarvisFloatingVoiceWindow = this.floatingVoiceWindow;
    window.jarvisApp = this;

    if (this.voiceController) {
      this.voiceController.onError = (err) => {
        if (this.floatingVoiceWindow) {
          this.floatingVoiceWindow.onSpeechRecognitionError(err);
        }
      };
    }

    // Session state restoration detection (Part 17)
    this.isSessionRestored = false;
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (sessionStorage.getItem('stark_session_active')) {
          this.isSessionRestored = true;
        } else {
          sessionStorage.setItem('stark_session_active', '1');
        }
      }
    } catch (e) {}

    // Time awareness state
    this.currentTimeCategory = null;
    this.lastKnownDateStr = null;
    this.lastKnownTimezone = null;
    this.timeCheckInterval = null;

    // Operational Centers & Visual Brain Subsystems
    this.brain3DVisualizer = null;
    this.knowledgeExplorerUI = null;
    this.engineeringLabUI = null;
    this.aiCreationLabUI = null;
    this.starkPanels = new StarkViewPanels();
    this.starkNavigation = null;
    this.stark3DViewer = stark3DViewerInstance;
    window.stark3DViewer = stark3DViewerInstance;
    this.starkSimulationViewer = starkSimulationViewerInstance;
    window.starkSimulationViewer = starkSimulationViewerInstance;

    this.init();
  }

  init() {
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize(), { passive: true });

    this.loadRemoteConfig();
    this.initTimeAwareness();
    this.bindKeyboardAndGestures();
    this.initVoiceActivation();
    this.initDesktopIPC();

    const quickCadBtn = document.getElementById('btn-quick-robot-cad');
    if (quickCadBtn) {
      quickCadBtn.addEventListener('click', async () => {
        try {
          const resp = await fetch('/api/tools/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toolName: 'create_3d_model',
              params: { description: '6-DOF Articulated Industrial Robot Arm CAD', archetype: 'robotic_arm', theme: 'titanium' },
              personality: this.activePersonality || 'JARVIS'
            })
          });
          const data = await resp.json();
          if (data?.success && data.result && this.stark3DViewer) {
            this.stark3DViewer.showModel(data.result.geometrySpec ? data.result : data.result.model);
          }
        } catch (err) {
          console.warn('[UI] Failed to launch 3D Robot CAD:', err.message);
        }
      });
    }

    const fvwToggleBtn = document.getElementById('btn-floating-voice-window');
    if (fvwToggleBtn) {
      fvwToggleBtn.addEventListener('click', () => {
        if (this.floatingVoiceWindow) {
          this.floatingVoiceWindow.toggle();
        }
      });
    }

    // Master Navigation across Operational Centers
    this.starkNavigation = new StarkNavigation({
      onViewChanged: (viewId) => this.handleViewChanged(viewId)
    });

    const headerHeartBtn = document.getElementById('header-heart-badge');
    if (headerHeartBtn) {
      headerHeartBtn.addEventListener('click', () => {
        this.starkNavigation.switchView('view-heart-soul');
      });
    }
    const headerNewsBtn = document.getElementById('header-live-news-badge');
    if (headerNewsBtn) {
      headerNewsBtn.addEventListener('click', () => {
        this.starkNavigation.switchView('view-research-center');
      });
    }

    // Single-Screen Unified Chat Bar (Direct bottom bar without modals)
    this.initMainChatBar();
    this.initScreenObservationControls();

    // Start 60 FPS animation loop
    requestAnimationFrame((ts) => this.renderLoop(ts));
  }

  initScreenObservationControls() {
    this.isScreenObserving = false;
    this.screenObservationStatus = null;
    this._pendingScreenConsentQuery = null;
    this._consentPromptShownForTurn = false;
    this.syncScreenObservationUI();
  }

  refreshUnifiedStatusIndicator(meta = {}) {
    if (!this.commandAndPermissionUI || !this.voiceController) return;
    const state = this.voiceController.isInitializing
      ? 'INITIALIZING'
      : this.voiceController.getCanonicalState();
    this.commandAndPermissionUI.updateMicrophoneStatus(state, this.targetTheme, meta);
  }

  async setScreenObservationEnabled(enable = true, reason = 'USER_CONSENT', scope = 'TASK') {
    if (enable && this.emergencyStopCoordinator && this.emergencyStopCoordinator.isEmergencyStopActive()) {
      return { success: false, error: 'EMERGENCY_STOP_ACTIVE' };
    }
    try {
      const token = await this.aiClient.getAuthToken();
      const res = await fetch('/api/screen-observation/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Stark-Auth-Token': token },
        body: JSON.stringify({
          action: enable ? 'enable' : 'disable',
          scope,
          reason
        })
      });
      const data = await res.json();
      await this.syncScreenObservationUI(data);
      if (this.smokeCaptions && data.summary) {
        this.smokeCaptions.showToolEvent(
          data.screenObservationEnabled ? 'Observing Screen' : 'Screen Observation Off',
          'complete'
        );
      }
      return data;
    } catch (err) {
      console.warn('[SCREEN_OBS_UI] Toggle error:', err);
      return { success: false, error: err.message };
    }
  }

  promptScreenObservationConsent(pendingQuery = null, toolResult = null) {
    if (!this.commandAndPermissionUI || typeof this.commandAndPermissionUI.showConsentPrompt !== 'function') return;
    if (this.emergencyStopCoordinator && this.emergencyStopCoordinator.isEmergencyStopActive()) return;
    const queryToRetry = pendingQuery || this._lastSubmittedQuery || '';
    this._pendingScreenConsentQuery = queryToRetry;
    this._consentPromptShownForTurn = true;

    const desc = (toolResult && toolResult.consentPrompt)
      || 'JARVIS needs your permission to inspect your active window and screen. A visible "Observing" indicator will appear and turn off automatically when the task finishes.';

    this.commandAndPermissionUI.showConsentPrompt({
      icon: '👁️',
      title: 'Screen Observation Permission Required',
      description: desc,
      actions: [
        {
          id: 'btn-consent-allow-once',
          label: 'Allow for This Task',
          variant: 'primary',
          onClick: async () => {
            const grant = await this.setScreenObservationEnabled(true, 'USER_CONSENT_TASK', 'TASK');
            if (grant && grant.success && queryToRetry) {
              if (this.smokeCaptions) {
                this.smokeCaptions.showUserSpeech(queryToRetry, true);
              }
              this.dispatchStreamingQuery(this.targetTheme || this.currentTheme || 'JARVIS', queryToRetry);
            }
          }
        },
        {
          id: 'btn-consent-allow-always',
          label: 'Keep Observing',
          variant: '',
          onClick: async () => {
            const grant = await this.setScreenObservationEnabled(true, 'USER_CONSENT_CONTINUOUS', 'CONTINUOUS');
            if (grant && grant.success && queryToRetry) {
              if (this.smokeCaptions) {
                this.smokeCaptions.showUserSpeech(queryToRetry, true);
              }
              this.dispatchStreamingQuery(this.targetTheme || this.currentTheme || 'JARVIS', queryToRetry);
            }
          }
        },
        {
          id: 'btn-consent-deny',
          label: 'Deny',
          variant: 'danger',
          onClick: async () => {
            this._pendingScreenConsentQuery = null;
          }
        }
      ]
    });
  }

  async syncScreenObservationUI(statusOverride = null) {
    try {
      let data = statusOverride;
      if (!data) {
        const res = await fetch('/api/screen-observation/status');
        data = await res.json();
      }
      this.screenObservationStatus = data || null;
      this.isScreenObserving = Boolean(data && data.screenObservationEnabled);
      if (data && data.assistantMode) {
        this.assistantMode = data.assistantMode;
      }
      this.refreshUnifiedStatusIndicator();
    } catch (_) {}
  }

  _handleToolVisualResult(toolName, res) {
    if (!res || typeof res !== 'object') return;
    if ((toolName === 'create_3d_model' || toolName === 'get_3d_model' || toolName === 'save_3d_model' || toolName === 'design_engineering_system' || toolName === 'analyze_design_reference_image') && (res.geometrySpec || res.model?.geometrySpec)) {
      try {
        this.stark3DViewer.showModel(res.geometrySpec ? res : res.model);
      } catch (_) {}
    } else if (toolName === 'run_visual_simulation' && Array.isArray(res.series)) {
      try {
        this.starkSimulationViewer.showSimulation(res);
      } catch (_) {}
    } else if (res.permissionRequired === true && !this._consentPromptShownForTurn && (
      toolName === 'inspect_screen_observation' ||
      toolName === 'diagnose_screen_error' ||
      toolName === 'read_screen_text' ||
      toolName === 'analyze_screen' ||
      toolName === 'capture_screen'
    )) {
      this.promptScreenObservationConsent(this._lastSubmittedQuery, res);
    } else if (
      toolName === 'enable_screen_observation' ||
      toolName === 'pause_screen_observation' ||
      toolName === 'disable_screen_observation' ||
      toolName === 'set_assistant_mode'
    ) {
      this.syncScreenObservationUI();
    }
  }

  handleViewChanged(viewId) {
    if (viewId === 'view-visual-brain') {
      const gotoHeartBtn = document.getElementById('brain-goto-heart-btn');
      if (gotoHeartBtn && !gotoHeartBtn.dataset.bound) {
        gotoHeartBtn.dataset.bound = '1';
        gotoHeartBtn.addEventListener('click', () => this.starkNavigation?.switchView('view-heart-soul'));
      }
      const container = document.getElementById('brain-3d-canvas-container');
      if (container && !this.brain3DVisualizer) {
        this.brain3DVisualizer = new Brain3DVisualizer(container, {
          onNodeSelect: (sub) => this.showSubsystemInspector(sub)
        });

        // Wire camera presets
        const presetBtns = document.querySelectorAll('.brain-camera-presets button');
        presetBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            if (this.brain3DVisualizer) {
              this.brain3DVisualizer.setCameraPreset(btn.dataset.preset);
            }
          });
        });

        // Wire 3D labels checkbox
        const labelsCheckbox = document.getElementById('toggle-3d-labels');
        if (labelsCheckbox) {
          labelsCheckbox.addEventListener('change', (e) => {
            if (this.brain3DVisualizer) {
              this.brain3DVisualizer.toggleLabels(e.target.checked);
            }
          });
        }

        // Wire reduced motion checkbox
        const motionCheckbox = document.getElementById('toggle-reduced-motion');
        if (motionCheckbox) {
          motionCheckbox.addEventListener('change', (e) => {
            if (this.brain3DVisualizer) {
              this.brain3DVisualizer.setReducedMotion(e.target.checked);
            }
          });
        }

        // Close inspector drawer button
        const closeInspBtn = document.getElementById('close-inspector-btn');
        if (closeInspBtn) {
          closeInspBtn.addEventListener('click', () => {
            const drawer = document.getElementById('subsystem-inspector-drawer');
            if (drawer) drawer.style.display = 'none';
          });
        }
      } else if (this.brain3DVisualizer) {
        this.brain3DVisualizer.handleResize();
      }

      // Start Real-Time Operations Console Telemetry Polling
      if (!this.operationsConsoleInterval) {
        const updateConsole = async () => {
          try {
            const res = await fetch('/api/brain/console');
            const d = await res.json();
            if (d.success) {
              const elModel = document.getElementById('console-ai-model');
              if (elModel) elModel.innerText = d.activeAiProvider?.currentProvider === 'gemini' ? 'Gemini 2.5 Flash' : 'OpenRouter LLaMA-3.3';
              const elHw = document.getElementById('console-hardware');
              if (elHw) elHw.innerText = `${d.hardwareMetrics?.cpu?.cores || 12}-Core | ${d.hardwareMetrics?.memory?.freeGb || 0.5} GB Free`;
              const elTask = document.getElementById('console-task');
              if (elTask) {
                elTask.innerText = (d.currentTask?.activeCount > 0)
                  ? `Task: ${d.currentTask.runningTasks[0]?.title.slice(0, 18)}...`
                  : 'Standby';
              }
              const elVoice = document.getElementById('console-voice');
              if (elVoice) elVoice.innerText = d.voiceState?.currentState || 'IDLE';
              const elGate = document.getElementById('console-gate');
              if (elGate) elGate.innerText = d.permissionStatus?.emergencyStopActive ? 'HALTED' : 'ARMED';
            }
          } catch (_) {}
        };
        updateConsole();
        this.operationsConsoleInterval = setInterval(updateConsole, 3500);
      }
    } else {
      if (this.operationsConsoleInterval) {
        clearInterval(this.operationsConsoleInterval);
        this.operationsConsoleInterval = null;
      }
    }

    if (viewId === 'view-heart-soul') {
      this.syncHeartSoulView();
    } else if (viewId === 'view-knowledge-graph') {
      const container = document.getElementById('view-knowledge-graph');
      if (container && !this.knowledgeExplorerUI) {
        this.knowledgeExplorerUI = new KnowledgeExplorerUI(container);
      }
    } else if (viewId === 'view-engineering-lab') {
      const container = document.getElementById('view-engineering-lab');
      if (container && !this.engineeringLabUI) {
        this.engineeringLabUI = new EngineeringLabUI(container);
      }
    } else if (viewId === 'view-ai-creation-lab') {
      const container = document.getElementById('view-ai-creation-lab');
      if (container && !this.aiCreationLabUI) {
        this.aiCreationLabUI = new AiCreationLabUI(container);
      }
    } else if (viewId === 'view-research-center') {
      const container = document.getElementById('view-research-center');
      if (container && this.starkPanels) {
        this.starkPanels.renderResearchCenter(container);
      }
    } else if (viewId === 'view-code-development') {
      const container = document.getElementById('view-code-development');
      if (container && this.starkPanels) {
        this.starkPanels.renderCodeDevelopment(container);
      }
    } else if (viewId === 'view-simulations') {
      const container = document.getElementById('view-simulations');
      if (container && this.starkPanels) {
        this.starkPanels.renderSimulations(container);
      }
    } else if (viewId === 'view-system-health') {
      const container = document.getElementById('view-system-health');
      if (container && this.starkPanels) {
        this.starkPanels.renderSystemHealth(container);
      }
    } else if (viewId === 'view-permissions') {
      if (this.commandAndPermissionUI) {
        this.commandAndPermissionUI.openPermissionsModal();
      }
    } else if (viewId === 'view-task-history') {
      const container = document.getElementById('view-task-history');
      if (container && this.starkPanels) {
        this.starkPanels.renderTaskHistory(container);
      }
    }
  }

  async syncHeartSoulView() {
    const beepBtn = document.getElementById('heart-audio-beep-btn');
    const refreshBtn = document.getElementById('heart-refresh-btn');
    if (beepBtn && !beepBtn.dataset.bound) {
      beepBtn.dataset.bound = '1';
      beepBtn.addEventListener('click', () => {
        if (this._heartBeepInterval) {
          clearInterval(this._heartBeepInterval);
          this._heartBeepInterval = null;
          beepBtn.textContent = '🔊 Pulse Sound: OFF';
        } else {
          const playSoftLubDub = () => {
            try {
              const Ctx = window.AudioContext || window.webkitAudioContext;
              if (!Ctx) return;
              this._heartAudioCtx = this._heartAudioCtx || new Ctx();
              if (this._heartAudioCtx.state === 'suspended') this._heartAudioCtx.resume();
              const t = this._heartAudioCtx.currentTime;
              [0, 0.22].forEach((offset, idx) => {
                const osc = this._heartAudioCtx.createOscillator();
                const gain = this._heartAudioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(idx === 0 ? 520 : 660, t + offset);
                gain.gain.setValueAtTime(0.001, t + offset);
                gain.gain.exponentialRampToValueAtTime(0.04, t + offset + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.12);
                osc.connect(gain);
                gain.connect(this._heartAudioCtx.destination);
                osc.start(t + offset);
                osc.stop(t + offset + 0.13);
              });
            } catch (_) {}
          };
          playSoftLubDub();
          this._heartBeepInterval = setInterval(playSoftLubDub, 1250);
          beepBtn.textContent = '🔊 Pulse Sound: ON';
        }
      });
    }
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = '1';
      refreshBtn.addEventListener('click', () => this.syncHeartSoulView());
    }

    try {
      const res = await fetch('/api/heart/state');
      const data = await res.json();
      if (data?.success && data.state) {
        const s = data.state;
        const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setEl('heart-tone-pill', s.tone || 'warm_composed');
        setEl('heart-signal-val', s.estimatedEmotion || 'neutral_steady');
        setEl('heart-conf-val', String(s.confidence ?? 0.72));
        setEl('heart-style-val', s.interactionStyle || 'collaborative_partner');
        setEl('heart-prosody-val', `${s.voiceProsody?.mood || 'warm'} (${s.voiceProsody?.rate || 1.0}x)`);
        setEl('heart-intensity-val', s.responseIntensity || 'balanced');
        setEl('heart-provider-val', `VISION + Gemini (Last: ${s.lastProvider || 'auto'})`);
        const traitsBox = document.getElementById('heart-traits-list');
        if (traitsBox && Array.isArray(data.traits)) {
          traitsBox.innerHTML = data.traits.map(t => `<span class="heart-trait-chip">${t.replace(/_/g, ' ')}</span>`).join('');
        }
      }
    } catch (_) {}
  }

  showSubsystemInspector(subsystem) {
    const drawer = document.getElementById('subsystem-inspector-drawer');
    if (!drawer || !subsystem) return;

    document.getElementById('inspector-category-badge').innerText = subsystem.category || 'SYSTEM';
    document.getElementById('inspector-subsystem-name').innerText = subsystem.name;
    const statusPill = document.getElementById('inspector-status-badge');
    statusPill.innerText = subsystem.status;
    statusPill.className = `inspector-status-pill ${subsystem.status.toLowerCase()}`;

    document.getElementById('inspector-region').innerText = subsystem.anatomicalRegion || 'Central Core';
    document.getElementById('inspector-file-path').innerText = subsystem.filePath || 'Internal';
    document.getElementById('inspector-disk-stats').innerText = `${subsystem.fileSizeBytes ? (subsystem.fileSizeBytes / 1024).toFixed(1) + ' KB' : 'Active Module'} | Verified On-Disk`;
    document.getElementById('inspector-permission').innerText = subsystem.permissionLevel || 'READ_ONLY';
    document.getElementById('inspector-dependencies').innerText = (subsystem.dependencies || []).join(', ') || 'Independent Core Module';
    document.getElementById('inspector-description').innerText = subsystem.description;

    // Fetch live recent telemetry for this subsystem
    const eventsContainer = document.getElementById('inspector-recent-events');
    eventsContainer.innerHTML = '<span style="color: #64748b; font-size: 10px;">Loading event history...</span>';

    fetch(`/api/brain/subsystem?id=${subsystem.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.subsystem && d.subsystem.recentEvents && d.subsystem.recentEvents.length > 0) {
          eventsContainer.innerHTML = d.subsystem.recentEvents.map(e => `
            <div class="inspector-event-item">
              <span style="color: #00f0ff;">[${e.eventType}]</span> ${new Date(e.timestamp).toLocaleTimeString()}: ${e.source} → ${e.target}
            </div>
          `).join('');
        } else {
          eventsContainer.innerHTML = '<span style="color: #64748b; font-size: 10px;">Subsystem active. Waiting for next event bus trigger.</span>';
        }
      })
      .catch(() => {
        eventsContainer.innerHTML = '<span style="color: #64748b; font-size: 10px;">Connected to VISION bus.</span>';
      });

    drawer.style.display = 'flex';
  }

  initTimeAwareness() {
    if (this.timeCheckInterval) {
      clearInterval(this.timeCheckInterval);
      this.timeCheckInterval = null;
    }

    const updateTimeCategory = () => {
      try {
        const now = new Date();
        const dateStr = now.toDateString();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
        const category = this.speechSynthesizer ? this.speechSynthesizer.getTimeOfDayCategory(now) : 'morning';

        if (this.currentTimeCategory !== category || this.lastKnownDateStr !== dateStr || this.lastKnownTimezone !== tz) {
          console.log(`[TIME_AWARENESS] Time category updated: ${this.currentTimeCategory} -> ${category} (Date: ${dateStr}, TZ: ${tz})`);
          this.currentTimeCategory = category;
          this.lastKnownDateStr = dateStr;
          this.lastKnownTimezone = tz;
        }
      } catch (err) {
        console.warn('[TIME_AWARENESS] Error checking local time:', err);
      }
    };

    updateTimeCategory();
    const intervalMs = (CONFIG && CONFIG.time && CONFIG.time.recheckIntervalMs) || 60000;
    this.timeCheckInterval = setInterval(updateTimeCategory, intervalMs);

    // Sync remote time boundaries from server if available
    fetch('/api/time')
      .then(res => res.json())
      .then(data => {
        if (data && data.boundaries && CONFIG.time) {
          CONFIG.time.boundaries = { ...data.boundaries };
          console.log('[TIME_AWARENESS] Synchronized time boundaries from backend:', data.boundaries);
        }
      })
      .catch(() => {});
  }

  async loadRemoteConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data && data.session) {
          Object.assign(CONFIG.session, data.session);
          if (this.voiceController && this.voiceController.sessionManager) {
            Object.assign(this.voiceController.sessionManager.config, data.session);
          }
          if (this.voiceController && this.voiceController.vad) {
            Object.assign(this.voiceController.vad.config, data.session);
          }
          console.log('[CONFIG] Successfully synced session & VAD configuration:', data.session);
        }
      }
    } catch (e) {
      console.log('[CONFIG] Operating with local default session configuration.');
    }
  }

  initConvergenceParticles() {
    this.convergenceParticles = [];
    const count = 75;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = randomRange(200, 700);
      this.convergenceParticles.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        origX: Math.cos(angle) * radius,
        origY: Math.sin(angle) * radius,
        speed: randomRange(0.8, 2.2),
        char: ['0', '1', '0x7F', 'JARVIS', 'ULTRON', 'CPU', 'MEM', '>>>', '::', '0x1F', 'AI'][Math.floor(Math.random() * 11)],
        alpha: randomRange(0.3, 0.9)
      });
    }
  }

  initDesktopIPC() {
    if (typeof window !== 'undefined' && window.desktopAPI) {
      console.log('[DESKTOP_IPC] Electron bridge detected. Registering IPC handlers.');

      // Background wake word detected (e.g. via tray, hotkey, or background listener)
      window.desktopAPI.onWakeWord(({ personality, fullQuery }) => {
        console.log(`[DESKTOP_IPC] Wake word event: ${personality}`, fullQuery ? `Query: ${fullQuery}` : '');
        this.switchPersonality(personality, fullQuery);
      });

      // Background sleep request
      window.desktopAPI.onGoToSleep(() => {
        console.log('[DESKTOP_IPC] Go-to-sleep IPC received.');
        this.goToSleep();
      });

      // Status changes
      window.desktopAPI.onStateChange((state) => {
        if (state) this.setVisualState(state);
      });
    }
  }

  setLifecycleState(newState) {
    if (this.visualLifecycleState === newState) return;
    const oldState = this.visualLifecycleState;
    this.visualLifecycleState = newState;
    this.visualTimer = 0;

    if (newState === 'EYE_OPEN') {
      this.visualState = this.expressionState || 'LISTENING';
    } else if (newState === 'EYE_CLOSING') {
      this.visualState = 'EYE_CLOSING';
    } else if (newState === 'DORMANT') {
      this.visualState = 'DORMANT';
      if (this.smokeCaptions) {
        this.smokeCaptions.clear(true);
      }
    } else if (newState === 'EYE_OPENING') {
      this.visualState = 'EYE_OPENING';
    } else if (newState === 'EYE_SWITCHING') {
      this.visualState = 'EYE_SWITCHING';
    }

    console.log(`[VISUAL_LIFECYCLE] State: ${oldState} -> ${newState} | Target: ${this.targetTheme}`);

    if (window.desktopAPI && window.desktopAPI.notifyStatus) {
      window.desktopAPI.notifyStatus(newState);
    }
  }

  setExpressionState(newExpression) {
    this.expressionState = newExpression;
    this.stateTimer = 0;
    if (this.visualLifecycleState === 'EYE_OPEN') {
      this.visualState = newExpression;
      if (window.desktopAPI && window.desktopAPI.notifyStatus) {
        window.desktopAPI.notifyStatus(newExpression);
      }
    }
  }

  setVisualState(state) {
    if (state === 'DORMANT') {
      this.setLifecycleState('DORMANT');
    } else if (state === 'RETURNING_TO_SLEEP' || state === 'EYE_CLOSING') {
      this.startCinematicSleep(this.targetTheme, false);
    } else if (state === 'WAKING_UP' || state === 'EYE_OPENING') {
      this.wakeUp(this.targetTheme);
    } else {
      this.setExpressionState(state);
    }
  }

  initVoiceActivation() {
    // CRITICAL: Initialize non-capturing voice support on boot WITHOUT secretly activating the microphone.
    if (this.commandAndPermissionUI && this.voiceController) {
      this.commandAndPermissionUI.updateMicrophoneStatus('INITIALIZING', this.targetTheme);
    }

    const unlockPlaybackAudio = () => {
      if (this.emergencyStopCoordinator && this.emergencyStopCoordinator.isEmergencyStopActive()) {
        return;
      }
      if (this.speechSynthesizer) {
        this.speechSynthesizer.ensureSpeechUnlocked();
        this.speechSynthesizer.resume();
      }
      if (this.voiceController?.vad?.audioContext && this.voiceController.vad.audioContext.state === 'suspended') {
        try { this.voiceController.vad.audioContext.resume().catch(() => {}); } catch (_) {}
      }
      // Always-On auto-activation on first gesture if mic is still unstarted and user hasn't paused
      const userExplicitPaused = typeof localStorage !== 'undefined' && localStorage.getItem('jarvis_user_paused') === 'true';
      if (
        this.voiceController &&
        !this.voiceController.isEmergencyStopped &&
        !this.voiceController.isPaused &&
        this.voiceController.voiceMode === 'DISABLED' &&
        !userExplicitPaused
      ) {
        this.enableAutonomousVoice('AUTO_ALWAYS_ON_FIRST_GESTURE');
      }
    };
    window.addEventListener('click', unlockPlaybackAudio, { passive: true, once: true });
    window.addEventListener('keydown', unlockPlaybackAudio, { passive: true, once: true });

    // Optional keyboard Push-to-Talk hold key (Alt+Space) when mode is PUSH_TO_TALK
    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.code === 'Space' && !e.repeat && this.voiceController && this.voiceController.voiceMode === 'PUSH_TO_TALK' && !this.voiceController.isEmergencyStopped) {
        e.preventDefault();
        this.voiceController.startPushToTalk().then(() => this.syncVoiceStateWithBackend('PTT_HOTKEY_DOWN'));
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && this.voiceController && this.voiceController.voiceMode === 'PUSH_TO_TALK' && this.voiceController.getCanonicalState() === 'LISTENING') {
        this.voiceController.stopPushToTalk().then(() => this.syncVoiceStateWithBackend('PTT_HOTKEY_UP'));
      }
    });

    // Probe voice hardware without capturing, then hydrate or auto-enable Always-On hands-free listening
    (async () => {
      let probe = null;
      if (this.voiceController && typeof this.voiceController.initializeVoiceSystem === 'function') {
        probe = await this.voiceController.initializeVoiceSystem();
      }
      await this._hydrateVoiceStateFromBackend(probe);
    })();
  }

  async enableAutonomousVoice(reason = 'USER_ENABLE_AUTONOMOUS_VOICE') {
    if (!this.voiceController || this.voiceController.isEmergencyStopped) return null;
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem('jarvis_user_paused'); } catch (_) {}
    }
    const telemetry = await this.setVoiceMode('CONTINUOUS', reason);
    return telemetry;
  }

  async _hydrateVoiceStateFromBackend(probe = null) {
    try {
      const res = await fetch('/api/voice/state');
      const data = res.ok ? await res.json() : null;
      const userExplicitPaused = typeof localStorage !== 'undefined' && localStorage.getItem('jarvis_user_paused') === 'true';
      if (this.voiceController) {
        if (data?.emergencyStopActive || data?.state === 'EMERGENCY_STOPPED') {
          this.voiceController.handleEmergencyStop('SERVER_ESTOP_HYDRATE');
        } else if (data?.state === 'PAUSED') {
          this.voiceController.voiceMode = data.voiceMode || 'CONTINUOUS';
          this.voiceController.pauseVoice('HYDRATE_PAUSED');
        } else if (
          !userExplicitPaused &&
          ((probe && probe.permissionState === 'granted' && probe.audioInputCount > 0) ||
           (data && data.voiceMode === 'CONTINUOUS'))
        ) {
          // Auto Always-On listening when microphone permission is already granted (zero Ready click needed!)
          await this.enableAutonomousVoice('AUTO_ALWAYS_ON_BOOT');
        } else if (data?.voiceMode && data.voiceMode !== 'DISABLED') {
          await this.voiceController.setVoiceMode(data.voiceMode, { reason: 'HYDRATE_MODE_READY' });
        } else {
          await this.voiceController.setVoiceMode('DISABLED', { reason: 'HYDRATE_DISABLED' });
        }
      }
    } catch (_) {
    } finally {
      this.refreshUnifiedStatusIndicator();
    }
  }

  async setVoiceMode(mode = 'DISABLED', reason = 'USER_MODE_CHANGE') {
    if (!this.voiceController) return null;
    const telemetry = await this.voiceController.setVoiceMode(mode, { reason });
    if (this.floatingVoiceWindow && (mode === 'CONTINUOUS' || mode === 'WAKE_WORD')) {
      this.floatingVoiceWindow.open({ autoTriggered: true });
    }
    if (this.commandAndPermissionUI) {
      this.commandAndPermissionUI.updateMicrophoneStatus(telemetry.state, this.targetTheme);
      this.commandAndPermissionUI.updateVoiceTimer();
    }
    try {
      const token = this.aiClient && this.aiClient.getAuthToken ? await this.aiClient.getAuthToken() : '';
      await fetch('/api/voice/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Stark-Auth-Token': token },
        body: JSON.stringify({ mode: telemetry.voiceMode, reason })
      });
    } catch (_) {}
    await this.syncVoiceStateWithBackend(reason);
    return telemetry;
  }

  async syncVoiceStateWithBackend(reason = 'CLIENT_SYNC') {
    if (!this.voiceController || typeof this.voiceController.getVoiceTelemetry !== 'function') return;
    if (this._voiceSyncDisabled) return;
    try {
      const telemetry = this.voiceController.getVoiceTelemetry();
      telemetry.reason = reason || telemetry.reason;
      const token = this.aiClient && this.aiClient.getAuthToken ? await this.aiClient.getAuthToken() : '';
      await fetch('/api/voice/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Stark-Auth-Token': token },
        body: JSON.stringify(telemetry)
      });
    } catch (_) {}
  }

  switchPersonality(personality = null, query = null) {
    const nextTheme = personality ? personality.toUpperCase() : (this.currentTheme === 'ULTRON' ? 'JARVIS' : 'ULTRON');

    // 1. If the target personality is already active and fully visible, avoid redundant closing/reopening
    if (this.visualLifecycleState === 'EYE_OPEN' && this.currentTheme === nextTheme && this.targetTheme === nextTheme) {
      console.log(`[SWITCH] Target personality ${nextTheme} is already active and visible.`);
      if (query) {
        this.setExpressionState('THINKING');
        this.aiClient.sendMessage(nextTheme, query).then((res) => {
          if (res && res.reply && !res.aborted) {
            this.setExpressionState('SPEAKING');
            this.speechSynthesizer.speak(res.reply, nextTheme);
          } else {
            this.setExpressionState('LISTENING');
          }
        }).catch(() => {
          this.setExpressionState('LISTENING');
        });
      }
      return;
    }

    // 2. If the eye is dormant/asleep, awaken directly into the target personality rather than closing an already closed eye
    if (this.visualLifecycleState === 'DORMANT') {
      console.log(`[SWITCH] Eye is dormant. Awakening directly into ${nextTheme}.`);
      this.wakeUp(nextTheme, query);
      return;
    }

    // 3. Stop and cancel any active speech synthesis immediately so voices do not overlap
    this.speechSynthesizer.stopSpeaking();
    this.speechSynthesizer.cancel();
    this.aiClient.cancelActiveRequest();
    if (this.smokeCaptions) {
      this.smokeCaptions.clear(true);
    }

    // Immediately synchronize VoiceController and authoritative session manager to new personality!
    if (this.voiceController) {
      this.voiceController.setPersonality(nextTheme);
    }

    // 4. Invalidate prior callbacks with generation token
    this.visualGeneration++;
    const currentToken = this.visualGeneration;

    // 5. If currently in the middle of closing (EYE_CLOSING), redirect smoothly into darkness and open the new personality directly
    if (this.visualLifecycleState === 'EYE_CLOSING') {
      console.log(`[SWITCH] Redirecting ongoing sleep animation to awaken ${nextTheme}.`);
      this.switchSource = this.currentTheme;
      this.switchTarget = nextTheme;
      this.switchPendingQuery = query;
      this.switchTargetInitialized = false;
      this.lastActivePersonality = nextTheme;
      const cfg = CONFIG.personalitySwitch || { phaseACloseMs: 1500, phaseBDarknessMs: 600, durationMs: 3800 };
      this.visualDuration = cfg.durationMs || 3800;
      this.setLifecycleState('EYE_SWITCHING');
      this.visualTimer = cfg.phaseACloseMs || 1500; // Jump straight to darkness
      return;
    }

    // 6. Full Cinematic Personality Switch Transition (Phase A -> Phase B -> Phase C -> Phase D)
    console.log(`[SWITCH] Initiating cinematic transition: ${this.currentTheme} -> [Darkness] -> ${nextTheme} (Token: ${currentToken})`);
    this.switchSource = this.currentTheme;
    this.switchTarget = nextTheme;
    this.switchPendingQuery = query;
    this.switchTargetInitialized = false;
    this.lastActivePersonality = nextTheme;

    const cfg = CONFIG.personalitySwitch || { durationMs: 3800 };
    this.visualDuration = cfg.durationMs || 3800;

    this.setLifecycleState('EYE_SWITCHING');

    if (window.desktopAPI && window.desktopAPI.showWindow) {
      window.desktopAPI.showWindow();
    }

    if (this.voiceController && !this.voiceController.isSessionActive()) {
      this.voiceController.startSession(nextTheme, 'PERSONALITY_SWITCH');
    }
  }

  wakeUp(personality = null, query = null) {
    const requestedTheme = personality || this.lastActivePersonality || this.targetTheme || 'JARVIS';

    // If eye is already open and user requests the other personality, route to authoritative switch controller
    if (this.visualLifecycleState === 'EYE_OPEN' && requestedTheme !== this.currentTheme) {
      return this.switchPersonality(requestedTheme, query);
    }

    // If target personality is already active and visible, avoid redundant closing/reopening
    if (this.visualLifecycleState === 'EYE_OPEN' && requestedTheme === this.currentTheme) {
      if (query) {
        this.dispatchStreamingQuery(requestedTheme, query);
      }
      return;
    }

    // Ignore duplicate wake words received in rapid succession during active emergence
    if (this.visualLifecycleState === 'EYE_OPENING' && this.visualTimer < 600 && this.targetTheme === requestedTheme) {
      console.log(`[WAKE] Duplicate wake word ignored during active emergence: ${requestedTheme}`);
      return;
    }

    this.visualGeneration++;
    const currentToken = this.visualGeneration;

    console.log(`[WAKE] Initiating cinematic wake sequence for ${requestedTheme} (Token: ${currentToken})`);

    // Invalidate any ongoing sleep animation and activate target personality directly
    this.lastActivePersonality = requestedTheme;
    this.currentTheme = requestedTheme;
    this.targetTheme = requestedTheme;
    this.themeProgressRaw = (requestedTheme === 'JARVIS') ? 1.0 : 0.0;

    const cfg = (CONFIG.visualLifecycle && CONFIG.visualLifecycle[requestedTheme]) || {
      wakeDurationMs: requestedTheme === 'ULTRON' ? 3300 : 3600,
      wakePhase1DetectMs: 300,
      wakePhase2GlowMs: requestedTheme === 'ULTRON' ? 800 : 900,
      wakePhase3OpenMs: requestedTheme === 'ULTRON' ? 1800 : 2000
    };
    this.visualDuration = cfg.wakeDurationMs;

    this.setLifecycleState('EYE_OPENING');
    this.initConvergenceParticles();

    if (window.desktopAPI && window.desktopAPI.showWindow) {
      window.desktopAPI.showWindow();
    }

    if (this.floatingVoiceWindow) {
      this.floatingVoiceWindow.open({ autoTriggered: true });
    }

    if (this.voiceController && !this.voiceController.isSessionActive()) {
      this.voiceController.startSession(requestedTheme, query ? 'WAKE_WORD_WITH_QUERY' : 'WAKE_WORD_DIRECT');
    }

    const fullActivationDelay = (cfg.wakePhase1DetectMs || 300) + (cfg.wakePhase2GlowMs || 800) + (cfg.wakePhase3OpenMs || 1800);

    if (query) {
      // Query provided with wake word: dispatch immediately with progressive streaming!
      this.dispatchStreamingQuery(requestedTheme, query);
    } else {
      // Standalone wake greeting scheduled for Phase 4 (full activation)
      setTimeout(() => {
        if (currentToken !== this.visualGeneration) return;
        this.speechSynthesizer.speakPersonality(requestedTheme, {
          isResumedSession: this.isSessionRestored,
          hasTaskImmediately: false
        });
        this.isSessionRestored = true;
      }, fullActivationDelay);
    }
  }

  goToSleep(personality = this.targetTheme, speakFarewell = true) {
    this.startCinematicSleep(personality, speakFarewell);
  }

  startCinematicSleep(personality = this.targetTheme, speakFarewell = true) {
    // Prevent repeated sleep triggering if already dormant or in the middle of closing
    if (this.visualLifecycleState === 'DORMANT' || this.visualLifecycleState === 'EYE_CLOSING') {
      return;
    }

    this.visualGeneration++;
    const currentToken = this.visualGeneration;
    const targetPers = personality || this.targetTheme || 'JARVIS';
    this.lastActivePersonality = targetPers;
    this.targetTheme = targetPers;

    if (this.voiceController && this.voiceController.isSessionActive()) {
      this.voiceController.endSession('EXPLICIT_SLEEP');
    }

    const cfg = (CONFIG.visualLifecycle && CONFIG.visualLifecycle[targetPers]) || {
      sleepDurationMs: targetPers === 'ULTRON' ? 3900 : 4600
    };
    this.visualDuration = cfg.sleepDurationMs;

    console.log(`[SLEEP] Initiating cinematic sleep sequence for ${targetPers} (${this.visualDuration}ms). Farewell: ${speakFarewell}`);
    this.setLifecycleState('EYE_CLOSING');

    if (!speakFarewell && this.smokeCaptions) {
      this.smokeCaptions.clear(false);
    }

    if (speakFarewell) {
      this.speechSynthesizer.speakSleep(targetPers, () => {
        if (currentToken !== this.visualGeneration) return;
        console.log('[SLEEP] Spoken farewell complete.');
      });
    }
  }

  handleVoiceCommand(event, transcript) {
    if (!event || typeof event !== 'object') {
      const theme = event;
      if (this.targetTheme === theme) return;
      this.targetTheme = theme;
      this.speechSynthesizer.speakPersonality(theme, {
        isResumedSession: true,
        hasTaskImmediately: false
      });
      return;
    }

    // 0a. Natural Inactivity or Max Session Duration Closure
    if (event.type === 'SESSION_CLOSED') {
      console.log(`[VOICE_CONTROL] Active conversation session closed (Reason: ${event.reason})`);
      // Never plunge the companion into darkness on mere inactivity!
      // Keep companion eye alive, attentive, and idling in LISTENING standby.
      if (this.visualLifecycleState === 'EYE_OPEN') {
        this.setExpressionState('LISTENING');
      }
      return;
    }

    // 0b. Sleep / Farewell Command: "Go to sleep" / "Sleep now" / "Goodbye" / "That's all"
    if (event.type === 'GO_TO_SLEEP') {
      console.log(`[VOICE_CONTROL] Sleep command detected for ${event.personality || this.targetTheme}`);
      this.startCinematicSleep(event.personality || this.targetTheme, true);
      return;
    }

    // 1. "Stop speaking" / "Quiet"
    if (event.type === 'STOP_SPEAKING') {
      console.log('[VOICE_CONTROL] Stop speaking requested.');
      this.speechSynthesizer.stopSpeaking();
      this.aiClient.cancelActiveRequest();
      if (this.smokeCaptions) {
        this.smokeCaptions.clear(true);
      }
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.stopSpeaking();
      }
      this.setExpressionState('LISTENING');
      return;
    }

    // 2. "Repeat that" / "Say that again"
    if (event.type === 'REPEAT_THAT') {
      console.log(`[VOICE_CONTROL] Repeat requested for ${this.targetTheme}`);
      this.speechSynthesizer.repeatLastResponse(this.targetTheme);
      return;
    }

    // 3. Standalone wake word: "Jarvis" / "Ultron" / "Wake up"
    if (event.type === 'ACTIVATE_THEME') {
      const theme = event.personality;
      console.log(`[VOICE_ACTIVATION] Wake / switch command recognized: ${theme}`);
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.open({ autoTriggered: true });
      }
      this.switchPersonality(theme);
      return;
    }

    // 4. Command query with request: "Jarvis, [query]" / "Ultron, [query]"
    if (event.type === 'AI_QUERY') {
      const theme = event.personality;
      const query = event.query;
      console.log(`[VOICE_QUERY] Routing to ${theme}: "${query}"`);
      if (this.floatingVoiceWindow) {
        this.floatingVoiceWindow.open({ autoTriggered: true });
      }

      if (this.stark3DViewer && this.stark3DViewer.modal && this.stark3DViewer.modal.style.display !== 'none') {
        if (/\b(explain|which\s+part|weakest|why\s+can'?t|reachability)\b/i.test(query)) {
          this.stark3DViewer.explainCurrentSelection(query).then((res) => {
            const ans = res?.answer;
            if (!ans) return;
            if (this.smokeCaptions) this.smokeCaptions.showAssistantSentence(ans, theme);
            if (this.speechSynthesizer) {
              const uttId = this.speechSynthesizer.beginUtterance(theme);
              this.speechSynthesizer.enqueueSentence(ans, theme, uttId, false);
              this.speechSynthesizer.markStreamComplete(uttId, ans);
            }
          }).catch(() => {});
          return;
        }
        if (this.stark3DViewer.execute3dDirective(query)) {
          const ack = /\bsave\b/i.test(query)
            ? 'Saved the active 3D CAD design inside JARVIS Vault, sir.'
            : 'Updated the 3D Robotics Lab viewport as requested, sir.';
          this.stark3DViewer.setVoiceCaption(ack);
          if (this.smokeCaptions) this.smokeCaptions.showAssistantSentence(ack, theme);
          if (this.speechSynthesizer) {
            const uttId = this.speechSynthesizer.beginUtterance(theme);
            this.speechSynthesizer.enqueueSentence(ack, theme, uttId, false);
            this.speechSynthesizer.markStreamComplete(uttId, ack);
          }
          return;
        }
      }

      if (this.visualLifecycleState === 'DORMANT' || this.visualLifecycleState === 'EYE_CLOSING') {
        this.switchPersonality(theme, query);
        return;
      }

      if (theme !== this.currentTheme) {
        this.switchPersonality(theme, query);
        return;
      }

      this.dispatchStreamingQuery(theme, query, event.timings);
    }
  }

  dispatchStreamingQuery(theme, query, timings = null, attachments = []) {
    if (!query || typeof query !== 'string' || !query.trim()) return;

    this._lastSubmittedQuery = query;
    this._consentPromptShownForTurn = false;
    this.targetTheme = theme;
    this.setExpressionState('THINKING');

    const utteranceId = this.speechSynthesizer.beginUtterance(theme);
    const activeGen = this.voiceController ? this.voiceController.interruptionManager.getCurrentGenerationId() : 0;
    const tQueryStart = performance.now();
    let tFirstSentence = null;

    // Attach playback start hook for exact voice-to-ear latency tracking
    this.speechSynthesizer.onAudioPlaybackStart = (info) => {
      if (info && info.utteranceId === utteranceId) {
        const tFirstAudioPlayed = info.tFirstAudioPlayed || performance.now();
        const voiceToEarMs = timings && timings.tSpeechEnd ? Math.max(0, Math.round(tFirstAudioPlayed - timings.tSpeechEnd)) : null;

        if (this.voiceDiagnostics) {
          this.voiceDiagnostics.recordAudioStart(voiceToEarMs);
        }

        if (timings && timings.tSpeechEnd) {
          fetch('/api/latency/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personality: theme,
              tSpeechEnd: timings.tSpeechEnd,
              tTranscribed: timings.tTranscribed,
              tReqSubmitted: timings.tReqSubmitted,
              tFirstAudioPlayed,
              voiceToEarMs
            })
          }).catch(() => {});
        }
      }
    };

    if (this.voiceController) {
      this.voiceController.setSubsystemStatus('aiProvider', 'processing');
    }

    const handledVisualKeys = new Set();
    const dispatchVisualOnce = (toolName, res) => {
      if (!res || typeof res !== 'object') return;
      const vKey = `${toolName}:${res.executionId || res.modelId || res.simId || 'single'}`;
      if (handledVisualKeys.has(vKey)) return;
      handledVisualKeys.add(vKey);
      this._handleToolVisualResult(toolName, res);
    };

    this.aiClient.streamMessage(theme, query, {
      onTool: (data) => {
        if (this.voiceController && !this.voiceController.interruptionManager.isValidGeneration(activeGen)) return;
        this.setExpressionState('REPORTING_RESULT');
        const toolName = data?.toolName || data?.name || 'tool';
        const toolStatus = data?.status || 'executing';
        this.showInlineToolBadge(toolName, toolStatus);
        if (this.smokeCaptions && data && (data.toolName || data.name)) {
          this.smokeCaptions.showToolEvent(data.toolName || data.name, toolStatus);
        }
        if (data && data.toolResult) {
          dispatchVisualOnce(toolName, data.toolResult);
        }
        if (this.voiceController?.sessionManager && this.voiceController.sessionManager.state !== 'EXECUTING') {
          this.voiceController.sessionManager.transition('EXECUTING', { tool: toolName });
        }
      },
      onToken: (token) => {
        if (this.voiceController && !this.voiceController.interruptionManager.isValidGeneration(activeGen)) return;
        if (this.smokeCaptions) {
          this.smokeCaptions.appendAssistantStream(token, theme);
        }
        if (this.floatingVoiceWindow) {
          this.floatingVoiceWindow.onAssistantToken(token, theme);
        }
      },
      onSentence: (sentence, index, meta) => {
        if (this.voiceController && !this.voiceController.interruptionManager.isValidGeneration(activeGen)) {
          return;
        }
        if (index === 0 && tFirstSentence === null) {
          tFirstSentence = Math.round(performance.now() - tQueryStart);
        }
        if (meta && meta.language) {
          this.speechSynthesizer.setLanguage(meta.language);
          if (this.voiceController) {
            this.voiceController.setLanguage(meta.language);
          }
        }
        const quietSuppressTts = this.assistantMode === 'QUIET' && !timings;
        if (!quietSuppressTts) {
          this.setExpressionState('SPEAKING');
          this.speechSynthesizer.enqueueSentence(sentence, theme, utteranceId, false, meta?.language);
        }
      },
      onDone: (data) => {
        if (this.voiceController && !this.voiceController.interruptionManager.isValidGeneration(activeGen)) return;
        if (this.voiceController) {
          this.voiceController.setSubsystemStatus('aiProvider', 'ready');
        }
        this.resetMainChatButtons();
        if (this.floatingVoiceWindow) {
          this.floatingVoiceWindow.onAssistantDone(data);
        }
        if (data && data.toolExecutions && data.toolExecutions.length > 0) {
          const lastTool = data.toolExecutions[data.toolExecutions.length - 1];
          this.showInlineToolBadge(lastTool.toolName || 'tool', 'complete');
          dispatchVisualOnce(lastTool.toolName, lastTool.result);
        } else if (data && data.toolResult) {
          const tName = data.toolResult.toolName || 'tool';
          this.showInlineToolBadge(tName, 'complete');
          dispatchVisualOnce(tName, data.toolResult);
        } else {
          setTimeout(() => {
            this.hideInlineToolBadge();
          }, 1500);
        }
        const tTotal = Math.round(performance.now() - tQueryStart);
        if (data && data.language) {
          this.speechSynthesizer.setLanguage(data.language);
          if (this.voiceController) {
            this.voiceController.setLanguage(data.language);
          }
        }
        if (this.voiceDiagnostics) {
          this.voiceDiagnostics.recordLatencyMetrics({
            ttftMs: data.tFirstTokenMs || tFirstSentence,
            ttfsMs: tFirstSentence || tTotal,
            dispatchMs: 4,
            totalMs: tTotal,
            tier: data.tier || 'standard'
          });
        }
        if (data && data.interactionStrategy && data.interactionStrategy.assistantMode) {
          this.assistantMode = data.interactionStrategy.assistantMode;
        }
        if (data && (data.autoStoppedScreenObservation || (data.toolResult && /screen_observation/.test(data.toolResult.toolName || '')))) {
          this.syncScreenObservationUI();
        }
        const quietSuppressTts = (this.assistantMode === 'QUIET' || data?.interactionStrategy?.ttsPolicy === 'SILENT') && !timings;
        if (this.stark3DViewer && this.stark3DViewer.modal && this.stark3DViewer.modal.style.display !== 'none' && data?.fullReply) {
          this.stark3DViewer.setVoiceCaption(data.fullReply);
        }
        if (quietSuppressTts) {
          if (this.smokeCaptions) {
            this.smokeCaptions.onAssistantSpeechEnd(data.fullReply);
          }
          this.setExpressionState('LISTENING');
        } else {
          this.speechSynthesizer.markStreamComplete(utteranceId, data.fullReply);
        }
      },
      onError: (err) => {
        if (this.floatingVoiceWindow) {
          this.floatingVoiceWindow.onAssistantError(err);
        }
        if (this.voiceController && !this.voiceController.interruptionManager.isValidGeneration(activeGen)) return;
        // Benign abort/cancellation checks
        if (err && (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('The user aborted a request'))) {
          this.resetMainChatButtons();
          this.hideInlineToolBadge();
          return;
        }
        console.warn('[VOICE_QUERY] Error processing AI query:', err);
        this.resetMainChatButtons();
        this.hideInlineToolBadge();
        if (this.voiceController) {
          this.voiceController.setSubsystemStatus('aiProvider', 'error');
          if (this.voiceController.sessionManager) {
            this.voiceController.sessionManager.transition('LISTENING', { reason: 'AI_QUERY_ERROR' });
          }
        }
        this.setExpressionState('WARNING');
        const errMsg = (err && err.message) ? err.message : '';
        let speechText = 'I encountered an unexpected issue while processing that request, sir.';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
          speechText = 'I lost connection to the server for a moment, sir. Reconnecting now.';
        } else if (errMsg.includes('401') || errMsg.includes('403')) {
          speechText = 'My session credentials were being refreshed, sir. Please try that once more.';
        } else if (errMsg && !errMsg.includes('Stream error')) {
          speechText = `I ran into an issue, sir: ${errMsg}.`;
        }
        this.speechSynthesizer.speak(speechText, theme);
        // Do not force premature startListening here; onSpeechEnd will safely re-arm listening once TTS finishes.
      }
    }, timings, attachments);
  }

  /* ==========================================================================
     SINGLE-SCREEN CONVERSATION INTERACTION METHODS
     ========================================================================== */
  initMainChatBar() {
    const input = document.getElementById('stark-main-chat-input');
    const sendBtn = document.getElementById('stark-main-send-btn');
    const stopBtn = document.getElementById('stark-main-stop-btn');
    const attachBtn = document.getElementById('stark-main-attach-btn');
    const fileInput = document.getElementById('stark-main-file-input');
    const chatInner = document.querySelector('.stark-main-chat-inner');

    if (!input || !sendBtn) return;

    this.chatAttachments = [];

    // Helper: process and attach file (Image or PDF)
    const handleFileAttachment = (file) => {
      if (!file) return;
      const isImg = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isImg && !isPdf) {
        console.warn('[STARK_CHAT] Unsupported attachment type:', file.type, file.name);
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        alert('File size exceeds 25MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const mimeType = file.type || (isPdf ? 'application/pdf' : 'image/png');
        const base64Data = dataUrl.split(',')[1];
        this.chatAttachments.push({
          name: file.name || (isPdf ? 'Document.pdf' : 'Pasted_Screenshot.png'),
          size: file.size,
          mimeType,
          data: base64Data,
          dataUrl: isImg ? dataUrl : null
        });
        this.renderAttachmentsPreview();
      };
      reader.readAsDataURL(file);
    };

    // Paste event: Support Ctrl+V paste of images or PDFs
    input.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      let handled = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/') || item.type === 'application/pdf') {
          const file = item.getAsFile();
          if (file) {
            handleFileAttachment(file);
            handled = true;
          }
        }
      }
      if (handled) {
        console.log('[STARK_CHAT] Attachment added from clipboard');
      }
    });

    // File input button
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
      });
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          for (let i = 0; i < fileInput.files.length; i++) {
            handleFileAttachment(fileInput.files[i]);
          }
          fileInput.value = '';
        }
      });
    }

    // Drag and drop onto chat box
    if (chatInner) {
      ['dragenter', 'dragover'].forEach(name => {
        chatInner.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          chatInner.classList.add('drag-over');
        });
      });
      ['dragleave', 'drop'].forEach(name => {
        chatInner.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          chatInner.classList.remove('drag-over');
        });
      });
      chatInner.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) {
            handleFileAttachment(files[i]);
          }
        }
      });
    }

    // Auto-expand textarea height as user types
    const adjustHeight = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    };
    input.addEventListener('input', adjustHeight);

    // Wake companion eye if dormant when user focuses the chat input, clicks window, or presses key
    const triggerWakeIfDormant = () => {
      if (this.visualLifecycleState === 'DORMANT' || this.visualLifecycleState === 'EYE_CLOSING') {
        this.wakeUp(this.targetTheme);
      }
    };
    input.addEventListener('focus', triggerWakeIfDormant);
    window.addEventListener('pointerdown', triggerWakeIfDormant, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (this.visualLifecycleState === 'DORMANT' || this.visualLifecycleState === 'EYE_CLOSING') {
        triggerWakeIfDormant();
      }
    }, { passive: true });

    // Enter to send (Shift+Enter for newline)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submitMainChatQuery();
      } else if (e.key === 'Escape') {
        if (this.speechSynthesizer && this.speechSynthesizer.isSpeaking) {
          e.preventDefault();
          this.handleStopAction();
        } else {
          input.blur();
        }
      }
    });

    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.submitMainChatQuery();
    });

    if (stopBtn) {
      stopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleStopAction();
      });
    }
  }

  renderAttachmentsPreview() {
    const previewEl = document.getElementById('stark-chat-attachments-preview');
    if (!previewEl) return;
    previewEl.innerHTML = '';
    if (!this.chatAttachments || this.chatAttachments.length === 0) {
      previewEl.style.display = 'none';
      return;
    }
    previewEl.style.display = 'flex';
    this.chatAttachments.forEach((att, idx) => {
      const chip = document.createElement('div');
      chip.className = 'stark-attachment-chip';

      const isImg = att.mimeType.startsWith('image/');
      if (isImg && att.dataUrl) {
        const thumb = document.createElement('img');
        thumb.className = 'stark-attachment-thumb';
        thumb.src = att.dataUrl;
        thumb.alt = att.name;
        chip.appendChild(thumb);
      } else {
        const icon = document.createElement('span');
        icon.className = 'stark-attachment-icon';
        icon.textContent = (att.mimeType === 'application/pdf' || att.name.toLowerCase().endsWith('.pdf')) ? '📄' : '📎';
        chip.appendChild(icon);
      }

      const meta = document.createElement('div');
      meta.className = 'stark-attachment-meta';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'stark-attachment-name';
      nameSpan.textContent = att.name.length > 22 ? att.name.slice(0, 19) + '...' : att.name;
      nameSpan.title = att.name;
      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'stark-attachment-size';
      sizeSpan.textContent = att.size ? `${(att.size / 1024).toFixed(1)} KB` : '';
      meta.appendChild(nameSpan);
      meta.appendChild(sizeSpan);
      chip.appendChild(meta);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'stark-attachment-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Remove';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.chatAttachments.splice(idx, 1);
        this.renderAttachmentsPreview();
      });
      chip.appendChild(removeBtn);

      previewEl.appendChild(chip);
    });
  }

  submitMainChatQuery(overrideQuery = null) {
    const input = document.getElementById('stark-main-chat-input');
    const sendBtn = document.getElementById('stark-main-send-btn');
    const stopBtn = document.getElementById('stark-main-stop-btn');

    let query = typeof overrideQuery === 'string'
      ? overrideQuery.trim()
      : (input ? input.value.trim() : '');
    const attachments = (this.chatAttachments && this.chatAttachments.length > 0) ? [...this.chatAttachments] : [];

    if (!query && attachments.length > 0) {
      query = 'Please analyze this attached file in detail. Read all visible text, error messages, code, or dialog boxes. Identify any issues, bugs, or anomalies, explain why they occurred, and provide clear step-by-step instructions to fix them.';
    }

    if (!query && attachments.length === 0) return;

    if (this.visualLifecycleState === 'DORMANT' || this.visualLifecycleState === 'EYE_CLOSING') {
      this.wakeUp(this.targetTheme);
    }

    // Clear input & reset height immediately
    if (input && typeof overrideQuery !== 'string') {
      input.value = '';
      input.style.height = 'auto';
    }

    // Clear attachment state and preview
    this.chatAttachments = [];
    this.renderAttachmentsPreview();

    // Wake up if asleep or dormant
    if (this.visualLifecycleState === 'DORMANT' || this.visualLifecycleState === 'EYE_CLOSING') {
      this.wakeUp(this.targetTheme);
    }

    // Display user speech directly in smoke captions
    if (this.smokeCaptions) {
      const displayCaption = attachments.length > 0
        ? (query ? `${query} [${attachments.length} file attached]` : `[Analyzing ${attachments[0].name || 'attachment'}...]`)
        : query;
      this.smokeCaptions.showUserSpeech(displayCaption, true);
    }

    // Toggle buttons to show Stop button during active generation
    if (sendBtn) sendBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'flex';

    // Dispatch query to AI streaming engine (inject live Robotics Lab scene context when active)
    let enrichedQuery = query;
    if (this.stark3DViewer?.modal && this.stark3DViewer.modal.style.display !== 'none' && typeof this.stark3DViewer.getSceneContext === 'function') {
      const sctx = this.stark3DViewer.getSceneContext();
      if (sctx?.modelName) {
        const partStr = sctx.selectedPart ? `${sctx.selectedPart.name} (${sctx.selectedPart.material || 'Alloy'})` : 'none';
        const jointStr = sctx.selectedJoint ? `${sctx.selectedJoint.label} at ${sctx.jointAngles?.[sctx.selectedJoint.id] ?? 0} deg` : 'none';
        enrichedQuery = `${query}\n[Active Robotics Lab Scene: model=${sctx.modelName}, archetype=${sctx.archetype}, mode=${sctx.activeLabMode}, selectedPart=${partStr}, selectedJoint=${jointStr}]`;
      }
    }
    const activeTheme = this.targetTheme || this.currentTheme || 'JARVIS';
    this.dispatchStreamingQuery(activeTheme, enrichedQuery, null, attachments);
  }

  handleStopAction() {
    console.log('[STARK_CHAT] Stop requested by user');
    if (this.voiceController?.interruptionManager?.nextGeneration) {
      this.voiceController.interruptionManager.nextGeneration();
    }
    if (this.speechSynthesizer) {
      this.speechSynthesizer.stopSpeaking();
    }
    if (this.aiClient) {
      this.aiClient.cancelActiveRequest();
    }
    if (this.smokeCaptions) {
      this.smokeCaptions.clear(true);
    }
    if (this.voiceController?.notifyAssistantSpeechEnd) {
      this.voiceController.notifyAssistantSpeechEnd('');
    }
    if (this.voiceController?.endListeningSession) {
      this.voiceController.endListeningSession('USER_STOP_ACTION');
    }
    const canonical = this.voiceController?.getCanonicalState ? this.voiceController.getCanonicalState() : 'DISABLED';
    if (this.commandAndPermissionUI) {
      this.commandAndPermissionUI.updateMicrophoneStatus(canonical, this.targetTheme);
    }
    this.hideInlineToolBadge();
    this.resetMainChatButtons();
    this.setExpressionState(canonical === 'LISTENING' ? 'LISTENING' : 'IDLE');
  }

  resetMainChatButtons() {
    const sendBtn = document.getElementById('stark-main-send-btn');
    const stopBtn = document.getElementById('stark-main-stop-btn');
    if (sendBtn) sendBtn.style.display = 'flex';
    if (stopBtn) stopBtn.style.display = 'none';
  }

  showInlineToolBadge(toolName, state = 'executing') {
    const badge = document.getElementById('stark-inline-tool-badge');
    const textEl = document.getElementById('stark-inline-tool-text');
    if (!badge || !textEl) return;

    badge.className = 'stark-inline-tool-badge';
    if (state === 'complete') {
      badge.classList.add('complete');
      textEl.innerText = `✓ Completed: ${toolName}`;
      setTimeout(() => {
        this.hideInlineToolBadge();
      }, 3500);
    } else if (state === 'error') {
      badge.classList.add('error');
      textEl.innerText = `✕ Error: ${toolName}`;
      setTimeout(() => {
        this.hideInlineToolBadge();
      }, 4000);
    } else {
      textEl.innerText = `⚙️ Running: ${toolName}...`;
    }
    badge.style.display = 'inline-flex';
  }

  hideInlineToolBadge() {
    const badge = document.getElementById('stark-inline-tool-badge');
    if (badge) {
      badge.style.display = 'none';
    }
  }

  bindKeyboardAndGestures() {
    window.addEventListener('keydown', (e) => {
      // Prevent shortcut interference when typing inside input or textarea elements
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }

      // Hotkey: Ctrl+Shift+J -> Switch / Wake JARVIS
      if (e.ctrlKey && e.shiftKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        this.switchPersonality('JARVIS');
        return;
      }

      // Hotkey: Ctrl+Shift+U -> Switch / Wake ULTRON
      if (e.ctrlKey && e.shiftKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        this.switchPersonality('ULTRON');
        return;
      }

      // Hotkey: Ctrl+Shift+D -> Toggle Voice & Latency Diagnostic HUD
      if (e.ctrlKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        if (this.voiceDiagnostics) {
          this.voiceDiagnostics.toggle();
        }
        return;
      }

      // Hotkey: Ctrl+Shift+V -> Toggle Floating Voice Conversation Window
      if (e.ctrlKey && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        if (this.floatingVoiceWindow) {
          this.floatingVoiceWindow.toggle();
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        this.toggleTheme();
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
        e.preventDefault();
        if (this.emergencyStopCoordinator) {
          if (!this.emergencyStopCoordinator.isEmergencyStopActive()) {
            this.emergencyStopCoordinator.triggerEmergencyStop('Global shortcut Ctrl+Shift+X');
          } else {
            this.emergencyStopCoordinator.resetEmergencyStop('Global shortcut Ctrl+Shift+X to resume');
          }
        }
      } else if (e.key === 'b' || e.key === 'B') {
        this.blinkMachine.triggerBlink();
      } else if (e.key === 'f' || e.key === 'F') {
        this.toggleFullscreen();
      } else if (e.key === 's' || e.key === 'S') {
        this.speechSynthesizer.stopSpeaking();
        this.aiClient.cancelActiveRequest();
        if (this.smokeCaptions) {
          this.smokeCaptions.clear(true);
        }
        this.setExpressionState('LISTENING');
      } else if (e.key === 'Escape') {
        this.goToSleep();
      }
    });

    window.addEventListener('pointerdown', () => {
      this.speechSynthesizer.ensureSpeechUnlocked();
    }, { passive: true });

    window.addEventListener('dblclick', () => {
      this.toggleFullscreen();
    });
  }

  toggleTheme() {
    const nextTheme = (this.currentTheme === 'ULTRON' || this.targetTheme === 'ULTRON') ? 'JARVIS' : 'ULTRON';
    console.log(`[THEME_TOGGLE] Keyboard M -> Initiating cinematic switch to ${nextTheme}`);
    this.switchPersonality(nextTheme);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDPR);

    this.width = w;
    this.height = h;

    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    this.eyeGeometry.resize(w, h);
    this.codeField.initRows();
    this.backgroundMatrix.init(w, h);
    this.irisRenderer.isGenerated = false;
  }

  renderLoop(timestamp) {
    requestAnimationFrame((ts) => this.renderLoop(ts));

    const rawDtSec = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    const dtSec = Math.min(rawDtSec, 0.08);
    const dtMs = dtSec * 1000;

    if (this.isPaused) return;

    this.updateAndRender(dtSec, dtMs);
  }

  updateAndRender(dtSec, dtMs) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    this.visualTimer += dtMs;
    this.stateTimer += dtMs;

    // =========================================================================
    // 0. VISUAL LIFECYCLE EVALUATION (SLEEP, WAKE & DORMANT TIMELINES)
    // =========================================================================
    let lidProgress = 0.0;
    let gazeRelax = 0.0;
    let codeSpeedMultiplier = 1.0;
    let codeBrightness = 1.0;
    let irisGlowMultiplier = 1.0;
    let irisScale = 1.0;
    let emergenceGlowAlpha = 0.0;
    let silhouetteAlpha = 0.0;
    let particlesAlpha = 0.0;
    let masterBlackFade = 0.0;

    const isUltron = this.targetTheme === 'ULTRON';
    const cfg = (CONFIG.visualLifecycle && CONFIG.visualLifecycle[this.targetTheme]) || {
      sleepDurationMs: isUltron ? 3900 : 4600,
      phase1RealizeMs: isUltron ? 1200 : 1500,
      phase2CloseMs: isUltron ? 1800 : 2200,
      phase3FadeMs: 900,
      wakeDurationMs: isUltron ? 3300 : 3600,
      wakePhase1DetectMs: 300,
      wakePhase2GlowMs: isUltron ? 800 : 900,
      wakePhase3OpenMs: isUltron ? 1800 : 2000
    };

    if (this.visualLifecycleState === 'DORMANT') {
      // Atmospheric Standby: deep, subtle arc-reactor standby pulse so user never sees a broken black void
      ctx.fillStyle = '#05030a';
      ctx.fillRect(0, 0, w, h);

      const standbyPulse = 0.14 + Math.sin(this.visualTimer * 0.002) * 0.05;
      const cy = h * (CONFIG.eye ? CONFIG.eye.centerYOffset : 0.45);
      const themeGrad = ctx.createRadialGradient(w * 0.5, cy, 10, w * 0.5, cy, 280);
      if (this.targetTheme === 'JARVIS') {
        themeGrad.addColorStop(0, `rgba(56, 189, 248, ${standbyPulse})`);
        themeGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      } else {
        themeGrad.addColorStop(0, `rgba(239, 68, 68, ${standbyPulse})`);
        themeGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      }
      ctx.fillStyle = themeGrad;
      ctx.fillRect(0, 0, w, h);
      return;
    } else if (this.visualLifecycleState === 'EYE_CLOSING') {
      const t = this.visualTimer;
      const p1 = cfg.phase1RealizeMs || 1500;
      const p2 = cfg.phase2CloseMs || 2200;
      const p3 = cfg.phase3FadeMs || 900;

      if (!isUltron) {
        // JARVIS Sleep Sequence (Calm, elegant, gentle, reassuring)
        if (t < p1) {
          // Phase 1 — Realization (0–1.5s): Gaze relaxes toward neutral, code decelerates, iris glow dims
          const progress = t / p1;
          gazeRelax = easeInOutCubic(progress);
          codeSpeedMultiplier = lerp(1.0, 0.45, easeInOutCubic(progress));
          irisGlowMultiplier = lerp(1.0, 0.75, easeInOutCubic(progress));
          codeBrightness = lerp(1.0, 0.85, progress);
          lidProgress = 0.0;
          masterBlackFade = 0.0;
        } else if (t < p1 + p2) {
          // Phase 2 — Slow eyelid closure (1.5–3.7s): Organic lid closure, iris progressively obscured
          const progress = (t - p1) / p2;
          gazeRelax = 1.0;
          lidProgress = easeInOutCubic(progress);
          codeSpeedMultiplier = lerp(0.45, 0.15, easeInOutCubic(progress));
          irisGlowMultiplier = lerp(0.75, 0.15, easeInOutCubic(progress));
          codeBrightness = lerp(0.85, 0.20, progress);
          masterBlackFade = 0.0;
        } else if (t < p1 + p2 + p3) {
          // Phase 3 — Fade to darkness (3.7–4.6s): Eye closed, entire screen fades into deep midnight black
          const progress = (t - (p1 + p2)) / p3;
          gazeRelax = 1.0;
          lidProgress = 1.0;
          codeSpeedMultiplier = lerp(0.15, 0.0, progress);
          irisGlowMultiplier = 0.0;
          codeBrightness = 0.0;
          masterBlackFade = easeInOutCubic(progress);
        } else {
          // Phase 4 — Dormant state reached
          this.setLifecycleState('DORMANT');
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);
          return;
        }
      } else {
        // ULTRON Sleep Sequence (Deliberate, mechanical, intense)
        if (t < p1) {
          // Phase 1 — Realization (0–1.2s): Gaze centers, iris contracts, stepped code speed drop
          const progress = t / p1;
          gazeRelax = easeOutCubic(progress);
          irisScale = lerp(1.0, 0.91, easeInOutCubic(progress));
          codeSpeedMultiplier = progress < 0.5 ? 0.75 : 0.45;
          irisGlowMultiplier = lerp(1.0, 0.70, progress);
          codeBrightness = lerp(1.0, 0.80, progress);
          lidProgress = 0.0;
          masterBlackFade = 0.0;
        } else if (t < p1 + p2) {
          // Phase 2 — Mechanical eyelid closure (1.2–3.0s): Controlled sharp deceleration
          const progress = (t - p1) / p2;
          gazeRelax = 1.0;
          irisScale = 0.91;
          lidProgress = progress < 0.5 ? (2 * progress * progress) : (1 - Math.pow(-2 * progress + 2, 2) / 2);
          codeSpeedMultiplier = progress < 0.5 ? 0.30 : 0.12;
          irisGlowMultiplier = lerp(0.70, 0.15, progress);
          codeBrightness = lerp(0.80, 0.15, progress);
          masterBlackFade = 0.0;
        } else if (t < p1 + p2 + p3) {
          // Phase 3 — Controlled stage fade into complete darkness (3.0–3.9s)
          const progress = (t - (p1 + p2)) / p3;
          gazeRelax = 1.0;
          lidProgress = 1.0;
          irisScale = 0.91;
          codeSpeedMultiplier = 0.0;
          irisGlowMultiplier = 0.0;
          codeBrightness = 0.0;
          masterBlackFade = easeInOutCubic(progress);
        } else {
          this.setLifecycleState('DORMANT');
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);
          return;
        }
      }
    } else if (this.visualLifecycleState === 'EYE_OPENING') {
      const t = this.visualTimer;
      const w1 = cfg.wakePhase1DetectMs || 300;
      const w2 = cfg.wakePhase2GlowMs || (isUltron ? 800 : 900);
      const w3 = cfg.wakePhase3OpenMs || (isUltron ? 1800 : 2000);
      const w4 = cfg.wakePhase4FullMs || 400;

      if (t < w1) {
        // Phase 1 — Wake detection (0–0.3s): Black screen, instant foregrounding
        lidProgress = 1.0;
        masterBlackFade = 1.0;
        gazeRelax = 1.0;
        codeSpeedMultiplier = 0.0;
      } else if (t < w1 + w2) {
        // Phase 2 — First sign of life (0.3–1.2s): Emergence glow + silhouette + particles
        const progress = (t - w1) / w2;
        lidProgress = 1.0;
        masterBlackFade = 1.0;
        gazeRelax = 1.0;
        emergenceGlowAlpha = Math.sin(progress * Math.PI) * (isUltron ? 0.55 : 0.45);
        silhouetteAlpha = easeOutCubic(progress) * (isUltron ? 0.48 : 0.40);
        particlesAlpha = easeOutCubic(progress) * 0.85;
        codeSpeedMultiplier = isUltron ? 0.25 : 0.20;
      } else if (t < w1 + w2 + w3) {
        // Phase 3 — Eye opening (1.2–3.2s): Smooth organic opening, accelerating code
        const progress = (t - (w1 + w2)) / w3;
        lidProgress = 1.0 - easeOutCubic(progress);
        masterBlackFade = 1.0 - easeOutCubic(progress);
        emergenceGlowAlpha = (1.0 - progress) * (isUltron ? 0.30 : 0.25);
        silhouetteAlpha = (1.0 - progress) * (isUltron ? 0.25 : 0.20);
        particlesAlpha = (1.0 - progress) * 0.70;
        codeSpeedMultiplier = lerp(isUltron ? 0.25 : 0.20, 1.0, easeInOutCubic(progress));
        codeBrightness = lerp(0.35, 1.0, progress);
        irisGlowMultiplier = lerp(0.40, 1.0, progress);
        gazeRelax = progress < 0.65 ? 1.0 : (1.0 - (progress - 0.65) / 0.35);
      } else {
        // Phase 4 — Full activation (3.2–3.6s): Eye fully open, ready to converse
        lidProgress = 0.0;
        masterBlackFade = 0.0;
        gazeRelax = 0.0;
        codeSpeedMultiplier = 1.0;
        codeBrightness = 1.0;
        irisGlowMultiplier = 1.0;
        this.setLifecycleState('EYE_OPEN');
        this.setExpressionState('LISTENING');
      }
    } else if (this.visualLifecycleState === 'EYE_SWITCHING') {
      const switchCfg = CONFIG.personalitySwitch || {
        durationMs: 3800,
        phaseACloseMs: 1500,
        phaseBDarknessMs: 600,
        phaseCInitMs: 1800,
        phaseDOpenMs: 1700
      };
      const t = this.visualTimer;
      const pA = switchCfg.phaseACloseMs || 1500;
      const pB = switchCfg.phaseBDarknessMs || 600;
      const pC = switchCfg.phaseCInitMs || 1800;
      const pD = switchCfg.phaseDOpenMs || 1700;
      const isSourceUltron = this.switchSource === 'ULTRON';
      const isTargetUltron = this.switchTarget === 'ULTRON';

      if (t < pA) {
        // Phase A — Close the current personality's eyes (0–1.5s):
        // Keep current personality identity, relax gaze, close eyelids smoothly, dim iris & code
        const progA = t / pA;
        gazeRelax = easeInOutCubic(progA);
        lidProgress = easeInOutCubic(progA);
        codeBrightness = lerp(1.0, 0.25, progA);
        irisGlowMultiplier = lerp(1.0, 0.25, progA);
        codeSpeedMultiplier = lerp(1.0, 0.20, easeInOutCubic(progA));
        if (isSourceUltron) {
          irisScale = lerp(1.0, 0.92, progA);
        }
        masterBlackFade = 0.0;
        // Keep theme strictly at source personality
        this.themeProgressRaw = isSourceUltron ? 0.0 : 1.0;
        this.targetTheme = this.switchSource;
      } else if (t < pA + pB) {
        // Phase B & C — Complete darkness (1.5–2.1s):
        // Once eyelids close, fade all visual elements to pure pitch black.
        // Screen is completely dark. Wake-word and audio services remain 100% alive.
        lidProgress = 1.0;
        gazeRelax = 1.0;
        masterBlackFade = 1.0;
        codeBrightness = 0.0;
        irisGlowMultiplier = 0.0;
        codeSpeedMultiplier = 0.0;

        // Phase C — Initialize requested personality internally during darkness (e.g. at 1.8s)
        if (t >= pC && !this.switchTargetInitialized) {
          this.switchTargetInitialized = true;
          this.currentTheme = this.switchTarget;
          this.targetTheme = this.switchTarget;
          this.themeProgressRaw = (this.switchTarget === 'JARVIS') ? 1.0 : 0.0;
          this.lastActivePersonality = this.switchTarget;
          if (this.voiceController && this.voiceController.sessionManager) {
            this.voiceController.sessionManager.activePersonality = this.switchTarget;
          }
          this.initConvergenceParticles();
          console.log(`[SWITCH] Personality switched in darkness: ${this.switchTarget}`);
        }
      } else if (t < pA + pB + pD) {
        // Phase D — Slowly open the new personality's eyes (2.1–3.8s)
        const progD = (t - (pA + pB)) / pD;
        this.themeProgressRaw = isTargetUltron ? 0.0 : 1.0;
        this.currentTheme = this.switchTarget;
        this.targetTheme = this.switchTarget;

        if (progD < 0.32) {
          // Sub-phase D1: Subtle emergence glow in the center + circular iris silhouette + code particles
          const subProg = progD / 0.32;
          lidProgress = 1.0;
          masterBlackFade = 1.0;
          gazeRelax = 1.0;
          emergenceGlowAlpha = Math.sin(subProg * Math.PI) * (isTargetUltron ? 0.55 : 0.45);
          silhouetteAlpha = easeOutCubic(subProg) * (isTargetUltron ? 0.48 : 0.40);
          particlesAlpha = easeOutCubic(subProg) * 0.85;
          codeSpeedMultiplier = isTargetUltron ? 0.25 : 0.20;
        } else {
          // Sub-phase D2: Eyelids slowly and smoothly opening, code accelerating to normal speed
          const openProg = (progD - 0.32) / 0.68;
          lidProgress = 1.0 - easeOutCubic(openProg);
          masterBlackFade = 1.0 - easeOutCubic(openProg);
          emergenceGlowAlpha = (1.0 - openProg) * (isTargetUltron ? 0.30 : 0.25);
          silhouetteAlpha = (1.0 - openProg) * (isTargetUltron ? 0.25 : 0.20);
          particlesAlpha = (1.0 - openProg) * 0.70;
          codeSpeedMultiplier = lerp(isTargetUltron ? 0.25 : 0.20, 1.0, easeInOutCubic(openProg));
          codeBrightness = lerp(0.35, 1.0, openProg);
          irisGlowMultiplier = lerp(0.40, 1.0, openProg);
          gazeRelax = openProg < 0.65 ? 1.0 : (1.0 - (openProg - 0.65) / 0.35);
        }
      } else {
        // Phase D Full Activation: Eye fully open in new personality, enter listening state
        lidProgress = 0.0;
        masterBlackFade = 0.0;
        gazeRelax = 0.0;
        codeSpeedMultiplier = 1.0;
        codeBrightness = 1.0;
        irisGlowMultiplier = 1.0;
        this.currentTheme = this.switchTarget;
        this.targetTheme = this.switchTarget;
        this.themeProgressRaw = (this.switchTarget === 'JARVIS') ? 1.0 : 0.0;
        this.setLifecycleState('EYE_OPEN');
        this.setExpressionState('LISTENING');

        const currentToken = this.visualGeneration;
        const targetTheme = this.switchTarget;
        const query = this.switchPendingQuery;
        this.switchPendingQuery = null;

        if (query) {
          this.setExpressionState('THINKING');
          const utteranceId = this.speechSynthesizer.beginUtterance(targetTheme);

          this.aiClient.streamMessage(targetTheme, query, {
            onTool: (data) => {
              if (currentToken !== this.visualGeneration) return;
              this.setExpressionState('REPORTING_RESULT');
            },
            onSentence: (sentence, index, meta) => {
              if (currentToken !== this.visualGeneration) return;
              if (meta && meta.language) {
                this.speechSynthesizer.setLanguage(meta.language);
              }
              this.setExpressionState('SPEAKING');
              this.speechSynthesizer.enqueueSentence(sentence, targetTheme, utteranceId, false, meta?.language);
            },
            onDone: (data) => {
              if (currentToken !== this.visualGeneration) return;
              if (data && data.language) {
                this.speechSynthesizer.setLanguage(data.language);
              }
              if (this.assistantMode === 'QUIET') {
                if (this.smokeCaptions) {
                  this.smokeCaptions.onAssistantSpeechEnd(data.fullReply);
                }
                this.setExpressionState('LISTENING');
              } else {
                this.speechSynthesizer.markStreamComplete(utteranceId, data.fullReply);
              }
            },
            onError: (err) => {
              console.warn('[VOICE_QUERY] Query failed:', err);
              if (currentToken === this.visualGeneration) {
                this.setExpressionState('LISTENING');
              }
            }
          });
        } else {
          this.speechSynthesizer.speakPersonality(targetTheme, {
            isResumedSession: this.isSessionRestored,
            hasTaskImmediately: false
          });
          this.isSessionRestored = true;
        }
      }
    } else {
      // EYE_OPEN: Normal active companion operation
      lidProgress = this.blinkMachine.update(dtMs);
      gazeRelax = 0.0;
      masterBlackFade = 0.0;
      codeSpeedMultiplier = (this.expressionState === 'THINKING' || this.expressionState === 'EXECUTING_TOOL') ? 2.4 : 1.0;
      codeBrightness = 1.0;
      irisGlowMultiplier = 1.0;
    }

    // 1. Smooth 1100ms Atmospheric Theme Interpolation
    if (this.visualLifecycleState !== 'EYE_SWITCHING') {
      const targetVal = this.targetTheme === 'JARVIS' ? 1.0 : 0.0;
      const transitionStep = dtMs / this.themeTransitionDuration;

      if (this.themeProgressRaw < targetVal) {
        this.themeProgressRaw = Math.min(targetVal, this.themeProgressRaw + transitionStep);
      } else if (this.themeProgressRaw > targetVal) {
        this.themeProgressRaw = Math.max(targetVal, this.themeProgressRaw - transitionStep);
      }
    }

    const easedThemeProgress = easeInOutCubic(this.themeProgressRaw);

    // 2. Autonomous Gaze Tracking with Sleep Relaxation to Center (0, 0)
    const gaze = this.gazeTracker.update(dtMs);
    const effGazeX = lerp(gaze.x, 0, gazeRelax);
    const effGazeY = lerp(gaze.y, 0, gazeRelax);

    // 3. Eyelid Shape & Anatomical Aperture Clipping
    this.eyeGeometry.updateBlink(clamp(lidProgress, 0.0, 1.0));

    // 4. Modulated Iris Position & Radius
    const irisX = this.eyeGeometry.cx + effGazeX * this.eyeGeometry.halfW * 0.44;
    const irisY = this.eyeGeometry.cy + effGazeY * this.eyeGeometry.halfH * 0.38;

    let dynamicPupilDilation = gaze.dilation;
    let dynamicIrisRadius = this.eyeGeometry.irisRadius * irisScale;

    if (this.expressionState === 'SPEAKING' && this.visualLifecycleState === 'EYE_OPEN') {
      const speechPulse = Math.sin(this.stateTimer * 0.012) * 0.035;
      dynamicIrisRadius *= (1.0 + speechPulse);
      dynamicPupilDilation *= (1.0 + speechPulse * 1.5);
    } else if (this.expressionState === 'THINKING' || this.expressionState === 'EXECUTING_TOOL') {
      dynamicPupilDilation *= 0.88;
    } else if (this.expressionState === 'WARNING') {
      dynamicPupilDilation *= 1.20;
    }

    // 5. Update Continuous Streaming Background Code & Sclera Code with Lifecycle Speed Multiplier
    this.backgroundMatrix.update(dtSec * codeSpeedMultiplier, w, h);
    this.codeField.update(dtSec * codeSpeedMultiplier);

    // =========================================================================
    // RENDER PASSES
    // =========================================================================

    // Pass 1: Continuous Background Code with Full Atmospheric Lighting Transition
    this.backgroundMatrix.render(ctx, w, h, this.eyeGeometry, easedThemeProgress);

    // Pass 2: Living Code Sclera Surface (Clipped accurately to eye contour, dimmed during sleep)
    ctx.save();
    if (codeBrightness < 0.999) {
      ctx.globalAlpha = clamp(codeBrightness, 0.0, 1.0);
    }
    this.codeField.render(ctx, this.eyeGeometry, irisX, irisY, dynamicIrisRadius);
    ctx.restore();

    // Pass 3: Detailed Procedural Iris (Clipped strictly to changing eye aperture)
    ctx.save();
    const eyeClip = this.eyeGeometry.createEyeClipPath();
    ctx.clip(eyeClip);
    if (irisGlowMultiplier < 0.999) {
      ctx.globalAlpha = clamp(irisGlowMultiplier, 0.0, 1.0);
    }
    this.irisRenderer.render(ctx, irisX, irisY, dynamicIrisRadius, dynamicPupilDilation, effGazeX, effGazeY, easedThemeProgress);

    // Expression Overlays: LISTENING / THINKING / SPEAKING / SEEING / EXECUTING / SUCCESS / INTERRUPTION / ERROR
    if (this.visualLifecycleState === 'EYE_OPEN') {
      const isJarvisTheme = easedThemeProgress > 0.5;
      const themeColor = isJarvisTheme ? 'rgba(78, 205, 252, ' : 'rgba(255, 60, 80, ';
      const themeGold = isJarvisTheme ? 'rgba(255, 215, 0, ' : 'rgba(255, 120, 40, ';

      if (this.expressionState === 'SEEING') {
        // SEEING: Optical aperture crosshairs + high-precision scanning reticle
        ctx.save();
        ctx.strokeStyle = `${themeColor}0.85)`;
        ctx.lineWidth = 1.5;

        // Circular reticle
        ctx.beginPath();
        ctx.arc(irisX, irisY, dynamicIrisRadius * 1.15, 0, Math.PI * 2);
        ctx.stroke();

        // 4 corner reticle ticks
        const tickDist = dynamicIrisRadius * 1.25;
        const tickLen = 6;
        const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        angles.forEach(a => {
          ctx.beginPath();
          ctx.moveTo(irisX + Math.cos(a) * (tickDist - tickLen), irisY + Math.sin(a) * (tickDist - tickLen));
          ctx.lineTo(irisX + Math.cos(a) * (tickDist + tickLen), irisY + Math.sin(a) * (tickDist + tickLen));
          ctx.stroke();
        });

        // Vertical optical scanline
        const scanOffset = Math.sin(this.stateTimer * 0.005) * dynamicIrisRadius;
        ctx.beginPath();
        ctx.moveTo(irisX - dynamicIrisRadius * 1.1, irisY + scanOffset);
        ctx.lineTo(irisX + dynamicIrisRadius * 1.1, irisY + scanOffset);
        ctx.strokeStyle = `${themeColor}0.95)`;
        ctx.lineWidth = 2.0;
        ctx.shadowColor = isJarvisTheme ? '#38bdf8' : '#ef4444';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();

      } else if (this.expressionState === 'THINKING') {
        // THINKING: Rotating concentric reticle and focused pupil scan
        ctx.save();
        const rotAngle = this.stateTimer * 0.004;
        ctx.strokeStyle = `${themeColor}0.65)`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(irisX, irisY, dynamicIrisRadius * 1.05, rotAngle, rotAngle + Math.PI * 2);
        ctx.stroke();

        // Horizontal scan beam
        const scanY = irisY + Math.sin(this.stateTimer * 0.008) * dynamicIrisRadius * 0.85;
        const scanGrad = ctx.createLinearGradient(irisX - dynamicIrisRadius, scanY, irisX + dynamicIrisRadius, scanY);
        scanGrad.addColorStop(0, 'rgba(0,0,0,0)');
        scanGrad.addColorStop(0.5, `${themeColor}0.75)`);
        scanGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = scanGrad;
        ctx.fillRect(irisX - dynamicIrisRadius, scanY - 2, dynamicIrisRadius * 2, 4);
        ctx.restore();

      } else if (this.expressionState === 'EXECUTING_TOOL' || this.expressionState === 'EXECUTING') {
        // EXECUTING: Rapid counter-rotating dual telemetry HUD rings
        ctx.save();
        const rot1 = this.stateTimer * 0.006;
        const rot2 = -this.stateTimer * 0.004;
        ctx.lineWidth = 1.8;

        // Inner dashed ring
        ctx.strokeStyle = `${themeColor}0.75)`;
        ctx.setLineDash([12, 6, 4, 6]);
        ctx.beginPath();
        ctx.arc(irisX, irisY, dynamicIrisRadius * 0.95, rot1, rot1 + Math.PI * 2);
        ctx.stroke();

        // Outer ring
        ctx.strokeStyle = `${themeGold}0.85)`;
        ctx.setLineDash([6, 14]);
        ctx.beginPath();
        ctx.arc(irisX, irisY, dynamicIrisRadius * 1.18, rot2, rot2 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();

      } else if (this.expressionState === 'SPEAKING') {
        // SPEAKING: Harmonic vocal acoustic waveform pulse expanding from pupil
        ctx.save();
        const waveProgress = (this.stateTimer % 900) / 900;
        const waveRadius = dynamicIrisRadius * (0.4 + waveProgress * 0.7);
        const waveAlpha = Math.max(0, 1.0 - waveProgress) * 0.6;
        ctx.strokeStyle = `${themeColor}${waveAlpha})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(irisX, irisY, waveRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

      } else if (this.expressionState === 'REPORTING_RESULT' || this.expressionState === 'SUCCESS') {
        // SUCCESS: Expanding emerald/cyan burst of light with smooth dissipation
        const flareAlpha = Math.max(0, 1.0 - this.stateTimer / 600);
        const flareGrad = ctx.createRadialGradient(irisX, irisY, 5, irisX, irisY, dynamicIrisRadius * 1.3);
        flareGrad.addColorStop(0, `rgba(52, 211, 153, ${flareAlpha * 0.8})`);
        flareGrad.addColorStop(0.5, isJarvisTheme ? `rgba(56, 189, 248, ${flareAlpha * 0.5})` : `rgba(248, 113, 113, ${flareAlpha * 0.5})`);
        flareGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(irisX, irisY, dynamicIrisRadius * 1.3, 0, Math.PI * 2);
        ctx.fill();

      } else if (this.expressionState === 'INTERRUPTION') {
        // INTERRUPTION: Sharp instantaneous flash line and snap reset
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(irisX - dynamicIrisRadius * 1.2, irisY);
        ctx.lineTo(irisX + dynamicIrisRadius * 1.2, irisY);
        ctx.stroke();
        ctx.restore();
        if (this.stateTimer > 250) {
          this.setExpressionState('LISTENING');
        }

      } else if (this.expressionState === 'WARNING' || this.expressionState === 'ERROR') {
        // ERROR: Crimson warning pulse & optical glitch flicker
        ctx.save();
        const pulse = Math.sin(this.stateTimer * 0.018) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.5})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(irisX, irisY, dynamicIrisRadius * 1.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();

    // Pass 4: Eyelid Waterline Sheen & Anatomical Supratarsal Crease
    this.backgroundMatrix.renderEyelidMargins(ctx, this.eyeGeometry);

    // Pass 5: Phase 2 First Sign of Life (Emergence glow + Iris silhouette + Emerging code particles)
    if (emergenceGlowAlpha > 0.01) {
      ctx.save();
      const glowGrad = ctx.createRadialGradient(
        this.eyeGeometry.cx, this.eyeGeometry.cy, 5,
        this.eyeGeometry.cx, this.eyeGeometry.cy, this.eyeGeometry.irisRadius * 1.7
      );
      const isJarvisTheme = this.targetTheme === 'JARVIS';
      const glowR = isJarvisTheme ? 56 : 239;
      const glowG = isJarvisTheme ? 189 : 68;
      const glowB = isJarvisTheme ? 248 : 68;

      glowGrad.addColorStop(0.0, `rgba(${glowR}, ${glowG}, ${glowB}, ${emergenceGlowAlpha})`);
      glowGrad.addColorStop(0.45, `rgba(${glowR}, ${glowG}, ${glowB}, ${emergenceGlowAlpha * 0.45})`);
      glowGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(this.eyeGeometry.cx, this.eyeGeometry.cy, this.eyeGeometry.irisRadius * 1.7, 0, Math.PI * 2);
      ctx.fill();

      // Faint circular iris silhouette
      if (silhouetteAlpha > 0.01) {
        ctx.beginPath();
        ctx.arc(this.eyeGeometry.cx, this.eyeGeometry.cy, this.eyeGeometry.irisRadius * 0.95, 0, Math.PI * 2);
        ctx.fillStyle = isJarvisTheme ? `rgba(4, 18, 32, ${silhouetteAlpha * 0.85})` : `rgba(20, 4, 10, ${silhouetteAlpha * 0.85})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${silhouetteAlpha * 0.70})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    if (particlesAlpha > 0.01) {
      ctx.save();
      const isJarvisTheme = this.targetTheme === 'JARVIS';
      ctx.fillStyle = isJarvisTheme ? `rgba(96, 215, 255, ${particlesAlpha})` : `rgba(255, 70, 90, ${particlesAlpha})`;
      ctx.font = '10px "Courier New", monospace';
      const pProgress = clamp(this.visualTimer / (this.visualDuration || 3300), 0.0, 1.0);
      const convergeT = easeOutCubic(pProgress);
      for (const p of this.convergenceParticles) {
        const curX = this.eyeGeometry.cx + p.origX * (1.0 - convergeT * p.speed * 0.85);
        const curY = this.eyeGeometry.cy + p.origY * (1.0 - convergeT * p.speed * 0.85);
        ctx.globalAlpha = p.alpha * particlesAlpha;
        ctx.fillText(p.char, curX, curY);
      }
      ctx.restore();
    }

    // Pass 6: Master Black Fade Curtain for Seamless Fade to/from Darkness
    if (masterBlackFade > 0.001) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${clamp(masterBlackFade, 0.0, 1.0)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  /**
   * Synchronizes and renders the Live Document Studio panel as a clean white A4
   * Microsoft Word-style document page with progressive section-by-section rendering.
   */
  async syncLiveDocumentStudioPanel() {
    try {
      const res = await fetch('/api/document-studio/status');
      if (!res.ok) return;
      const data = await res.json();
      const panel = document.getElementById('live-document-studio-panel');
      if (!panel) return;

      if (!data.activeDocumentSession || (data.windowControls && data.windowControls.isOpen === false)) {
        panel.style.display = 'none';
        return;
      }

      panel.style.display = 'block';
      const bodyEl = document.getElementById('lds-body');
      if (bodyEl) {
        bodyEl.style.display = (data.windowControls && data.windowControls.isMinimized) ? 'none' : 'flex';
      }

      const s = data.activeDocumentSession;
      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setTxt('lds-doc-title', s.title || 'Word Document');
      setTxt('lds-doc-filename', `${s.fileName || 'document.docx'} • ${s.filePath || ''}`);
      setTxt('lds-writing-status', s.writingStatus || 'ACTIVE');
      setTxt('lds-progress', `${data.writingProgress || 0}%`);
      setTxt('lds-save-status', data.saveState || 'SYNCED');
      setTxt('lds-voice-status', s.voiceInteractionStatus || 'READY');
      setTxt('lds-verify-status', data.verificationState?.verified ? 'SHA-256 VERIFIED' : (data.saveState === 'SAVE_FAILED' ? 'SAVE FAILED' : 'SYNCING'));
      setTxt('lds-current-section', data.currentSection || '--');

      const previewEl = document.getElementById('lds-editor-preview');
      if (previewEl && Array.isArray(s.visibleEditorChunks)) {
        const renderKey = `${s.sessionId}_v${(data.revisionHistory || []).length}_${s.visibleEditorChunks.length}`;
        if (this._lastRenderedStudioKey !== renderKey) {
          const isNewSession = this._lastRenderedSessionId !== s.sessionId;
          this._lastRenderedSessionId = s.sessionId;
          this._lastRenderedStudioKey = renderKey;

          const headerChunk = s.visibleEditorChunks.find(c => c.type === 'DOCUMENT_HEADER');
          const sectionChunks = s.visibleEditorChunks.filter(c => c.type !== 'DOCUMENT_HEADER');

          const buildHeaderHtml = () => {
            const docTitle = (headerChunk && headerChunk.title) || s.title || 'Document';
            const docSub = (headerChunk && headerChunk.subtitle) || s.subtitle || '';
            return `<div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 18px;">
              <h1 style="margin: 0 0 4px 0; font-family: 'Cambria', 'Georgia', serif; font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">${docTitle}</h1>
              ${docSub ? `<div style="font-size: 11.5px; color: #4b5563; font-family: 'Calibri', 'Segoe UI', sans-serif;">${docSub}</div>` : ''}
            </div>`;
          };

          const buildSectionHtml = (c) => {
            const paras = (c.paragraphs || []).map(p =>
              `<p style="margin: 0 0 10px 0; color: #111827; text-align: justify; font-size: 13.5px; line-height: 1.65;">${p.text}</p>`
            ).join('');

            const calloutHtml = c.callout
              ? `<div style="margin: 8px 0 12px 0; padding: 8px 12px; background: #f8fafc; border-left: 3px solid #185abd; color: #0f172a; font-weight: 600; font-size: 12.5px;">${c.callout}</div>`
              : '';

            const bulletsHtml = (Array.isArray(c.bullets) && c.bullets.length > 0)
              ? `<ul style="margin: 4px 0 12px 20px; padding: 0; color: #111827; font-size: 13px;">${c.bullets.map(b => `<li style="margin-bottom: 4px;">${b}</li>`).join('')}</ul>`
              : '';

            let tblHtml = '';
            if (c.table && Array.isArray(c.table.headers)) {
              const ths = c.table.headers.map(h =>
                `<th style="border: 1px solid #64748b; background: #e2e8f0; color: #0f172a; padding: 6px 8px; font-size: 11.5px; text-align: left; font-weight: 700;">${h}</th>`
              ).join('');
              const trs = (c.table.rows || []).map((row, rIdx) => {
                const tds = (row || []).map(cell =>
                  `<td style="border: 1px solid #94a3b8; background: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'}; color: #111827; padding: 5px 8px; font-size: 11.5px;">${cell}</td>`
                ).join('');
                return `<tr>${tds}</tr>`;
              }).join('');
              tblHtml = `<div style="margin: 10px 0 14px 0; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-family: 'Calibri', 'Segoe UI', sans-serif;">
                  <thead><tr>${ths}</tr></thead>
                  <tbody>${trs}</tbody>
                </table>
              </div>`;
            }

            return `<div class="lds-word-section" style="margin-bottom: 16px;">
              <h2 style="margin: 14px 0 6px 0; font-family: 'Cambria', 'Georgia', serif; font-size: 15.5px; font-weight: 700; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px;">${c.heading || ''}</h2>
              ${paras}${calloutHtml}${bulletsHtml}${tblHtml}
            </div>`;
          };

          if (isNewSession && sectionChunks.length > 1) {
            // Progressive section-by-section rendering on the white Word page
            previewEl.innerHTML = buildHeaderHtml() + `<div id="lds-progressive-sections"></div>`;
            const container = document.getElementById('lds-progressive-sections');
            sectionChunks.forEach((secChunk, idx) => {
              setTimeout(() => {
                if (!container) return;
                const wrapper = document.createElement('div');
                wrapper.innerHTML = buildSectionHtml(secChunk);
                container.appendChild(wrapper.firstElementChild);
                setTxt('lds-current-section', idx + 1 < sectionChunks.length ? `Writing: ${secChunk.heading}` : 'Draft Complete — Awaiting User Review');
                setTxt('lds-progress', `${Math.round(((idx + 1) / sectionChunks.length) * 100)}%`);
              }, idx * 180);
            });
          } else {
            previewEl.innerHTML = buildHeaderHtml() + sectionChunks.map(buildSectionHtml).join('');
          }
        }
      }

      const revEl = document.getElementById('lds-revision-history');
      if (revEl && Array.isArray(data.revisionHistory)) {
        revEl.innerHTML = data.revisionHistory
          .slice()
          .reverse()
          .map(r => `<div style="margin-bottom:3px;">• <strong>v${r.versionNumber}</strong>: ${r.summary || r.instruction}</div>`)
          .join('');
      }
    } catch (_) {}
  }
}

// Wire Live Document Studio Open in Word / minimize / close buttons & periodic status sync
window.addEventListener('DOMContentLoaded', () => {
  const openWordBtn = document.getElementById('lds-open-word-btn');
  const minBtn = document.getElementById('lds-minimize-btn');
  const closeBtn = document.getElementById('lds-close-btn');
  if (openWordBtn) {
    openWordBtn.addEventListener('click', async () => {
      openWordBtn.textContent = 'Opening Word...';
      try {
        const res = await fetch('/api/document-studio/open-word', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        openWordBtn.textContent = data.verified ? 'Opened in Word ✓' : 'Word Unavailable';
        setTimeout(() => { openWordBtn.textContent = 'Open in Word'; }, 3000);
      } catch (_) {
        openWordBtn.textContent = 'Open in Word';
      }
    });
  }
  if (minBtn) {
    minBtn.addEventListener('click', async () => {
      const bodyEl = document.getElementById('lds-body');
      const isHidden = bodyEl && bodyEl.style.display === 'none';
      await fetch('/api/document-studio/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isHidden ? 'RESTORE' : 'MINIMIZE' })
      });
      if (window.jarvisApp) window.jarvisApp.syncLiveDocumentStudioPanel();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', async () => {
      await fetch('/api/document-studio/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLOSE' })
      });
      if (window.jarvisApp) window.jarvisApp.syncLiveDocumentStudioPanel();
    });
  }
  setInterval(() => {
    if (window.jarvisApp && typeof window.jarvisApp.syncLiveDocumentStudioPanel === 'function') {
      window.jarvisApp.syncLiveDocumentStudioPanel();
    }
  }, 2000);
});

// Launch application reliably when DOM is ready
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.jarvisApp) window.jarvisApp = new JarvisOcularApp();
  });
} else {
  if (!window.jarvisApp) window.jarvisApp = new JarvisOcularApp();
}
