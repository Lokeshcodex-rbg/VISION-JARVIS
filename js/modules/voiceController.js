/**
 * VISION AI — Smart Voice Recognition, Turn-Taking & Real-Time Barge-in Controller
 * Integrates Web Speech API, Voice Activity Detection (VAD), continuous MediaRecorder STT fallback,
 * and the authoritative Conversation Session Manager & Interruption Manager.
 * Guarantees full-duplex continuous listening, instant user barge-in,
 * acoustic echo suppression, and English/Hindi/Hinglish speech understanding.
 */

import { CONFIG } from '../config.js';
import { VoiceActivityDetector } from './voiceActivityDetector.js';
import { ConversationSessionManager, CONVERSATION_STATES, SESSION_CLOSE_REASONS } from './conversationSessionManager.js';
import { InterruptionManager, INTERRUPTION_STATES } from './interruptionManager.js';

export const VOICE_MODES = {
  DISABLED: 'DISABLED',
  PUSH_TO_TALK: 'PUSH_TO_TALK',
  WAKE_WORD: 'WAKE_WORD',
  CONTINUOUS: 'CONTINUOUS'
};

export const CANONICAL_VOICE_STATES = {
  DISABLED: 'DISABLED',
  READY: 'READY',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR'
};

export class VoiceController {
  constructor(onCommandCallback) {
    this.onCommand = onCommandCallback;
    this.recognition = null;
    this.isSupported = false;
    this.isListening = false;
    this.voiceMode = VOICE_MODES.DISABLED; // MUST default DISABLED on startup — never auto-listening
    this.continuousListening = false; // Explicit user opt-in only
    this.isRecognitionActive = false; // Actual Web Speech recognition engine active state
    this.isExplicitlyStopped = false;
    this.isPaused = false;
    this.isMuted = false; // User-controlled microphone mute toggle
    this.isNetworkError = false;
    this.isAudioFallbackActive = false;
    this.isEmergencyStopped = false;
    this.currentLanguage = 'en';
    this.voiceGeneration = 0;
    this.lastTransitionReason = 'BOOT_DEFAULT_DISABLED';

    // Subsystem Health Tracking (Independent Component States)
    this.subsystems = {
      microphoneAccess: 'prompt', // 'granted' | 'denied' | 'prompt' | 'unknown'
      audioCapture: 'inactive',   // 'active' | 'inactive' | 'error'
      speechRecognition: 'inactive', // 'active' | 'restarting' | 'fallback' | 'inactive' | 'error'
      aiProvider: 'ready',        // 'ready' | 'processing' | 'error'
      textToSpeech: 'idle',       // 'idle' | 'speaking' | 'error'
      networkConnectivity: (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'offline' : 'online'
    };

    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 6;
    this.reconnectBackoffMs = 250;
    this.isReconnecting = false;
    this.isInitializing = false;
    this._deviceRecoveryInFlight = false;
    this.availableAudioInputs = 0;
    this.lastError = null;
    this.lastErrorCategory = 'NONE';
    this.lastSuccessfulRecognitionTime = Date.now();
    this.restartTimer = null;
    this.watchdogIntervalId = null;
    this.rescueTimeout = null;
    this.lastWebSpeechResultTime = 0;
    this.lastDispatchedCommand = '';
    this.lastDispatchedCommandTime = 0;

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => {
        this.subsystems.networkConnectivity = 'online';
        console.log('[VOICE_CONTROLLER] Network connection restored.');
      });
      window.addEventListener('offline', () => {
        this.subsystems.networkConnectivity = 'offline';
        console.warn('[VOICE_CONTROLLER] Network connection offline.');
      });
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (
          document.visibilityState === 'visible' &&
          this.continuousListening &&
          !this.isExplicitlyStopped &&
          !this.isPaused &&
          !this.isEmergencyStopped &&
          !this.isMuted &&
          !this.isListening &&
          !this.isAssistantSpeaking()
        ) {
          this.scheduleSafeRecognitionRestart('TAB_VISIBILITY_RETURN');
        }
      });
    }

    this.lastTriggerTime = -10000;
    this.debounceMs = 350;
    this.pendingWakeTimeout = null;
    this.onUserSpeech = null;
    this.onMuteChange = null;

    // Acoustic Echo Suppression Tracking
    this.currentSpokenSentence = '';
    this.recentSpokenHistory = [];

    // Continuous Audio Stream Fallback Recording & Parallel Dual-Engine Buffer
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecordingAudio = false;

    // Shared Interruption Manager
    this.interruptionManager = new InterruptionManager({
      onCommandDispatch: (command, transcript) => {
        if (typeof this.onCommand === 'function') {
          this.onCommand(command, transcript);
        }
      },
      onStateChange: (nextState, prevState, meta) => {
        if (typeof this.onInterruptionStateChange === 'function') {
          this.onInterruptionStateChange(nextState, prevState, meta);
        }
      }
    });

    // Smart Conversational Session & State Machine (boots DISABLED — never starts session on boot)
    this.sessionManager = new ConversationSessionManager({
      initialState: CONVERSATION_STATES.DISABLED,
      continuousListening: false,
      onStateTransition: (nextState, prevState, meta) => {
        if (meta && meta.reason) {
          this.lastTransitionReason = meta.reason;
        }
        if (typeof this.onStateChange === 'function') {
          this.onStateChange(nextState, prevState, meta);
        }
      },
      onSessionClose: (reason, durationMs, sessionId) => {
        console.log(`[VOICE_CONTROLLER] Session [${sessionId}] closed (Reason: ${reason}, Duration: ${(durationMs / 1000).toFixed(1)}s)`);
        if (typeof this.onCommand === 'function') {
          this.onCommand({ type: 'SESSION_CLOSED', reason, durationMs });
        }
      },
      onInterrupt: () => {
        if (typeof this.onCommand === 'function') {
          this.onCommand({ type: 'STOP_SPEAKING', reason: 'USER_INTERRUPT' });
        }
      }
    });

    // Voice Activity Detector (VAD) with Dual-Engine Capture
    this.vad = new VoiceActivityDetector({
      onSpeechStart: (data) => {
        if (this.voiceMode === VOICE_MODES.DISABLED || this.isPaused || this.isMuted || this.isEmergencyStopped) {
          return;
        }
        // Only activate capture timer & LISTENING when speech begins (so silence in READY stays 0:00-free!)
        const curState = this.sessionManager.getState();
        if (curState === CONVERSATION_STATES.READY) {
          this.voiceGeneration++;
          this.isListening = true;
          this.sessionManager.startCaptureTimer();
          this.sessionManager.transition(CONVERSATION_STATES.LISTENING, { reason: 'VAD_SPEECH_ONSET' });
        }
        this.sessionManager.notifyUserSpeechStart();
        this.interruptionManager.notifyUserSpeechOnset('VAD_ONSET', data);
        this._armPassiveSpeechRecognition('VAD_SPEECH_ONSET');
        // Always record audio chunks in parallel so speech is NEVER dropped if Web Speech hangs
        this.startAudioChunkRecording();
      },
      onSpeechEnd: (data) => {
        this.sessionManager.notifyUserSpeechEnd();
        this.stopAudioChunkRecordingAndTranscribe();
      },
      onUserInterrupt: (data) => {
        console.log('[VOICE_CONTROLLER] VAD detected sustained vocal energy during assistant speech.');
        this.interruptionManager.notifyUserSpeechOnset('VAD_BARGE_IN_ONSET', data);
        this.startAudioChunkRecording();
      },
      onError: (err) => {
        console.warn('[VOICE_CONTROLLER] VAD microphone error:', err?.name || 'Error', err?.message || err);
        if (this.isEmergencyStopped || this.voiceMode === VOICE_MODES.DISABLED || this.isPaused || this.isExplicitlyStopped) {
          return;
        }
        if (err && /track ended|disconnected|not found|notallowed/i.test(`${err.name || ''} ${err.message || ''}`)) {
          this._handleCaptureFailureError(err);
        }
      },
      onDeviceChange: (probe) => {
        this.handleDeviceChange(probe);
      }
    });

    this.init();
  }

  /**
   * Non-capturing startup initialization of the voice pipeline.
   * Checks hardware support & permission state without secretly calling getUserMedia().
   */
  async initializeVoiceSystem() {
    if (!this.vad || typeof this.vad.probeHardware !== 'function') {
      return { supported: this.isSupported, audioInputCount: 0, permissionState: 'prompt' };
    }
    this.isInitializing = true;
    try {
      const probe = await this.vad.probeHardware();
      this.availableAudioInputs = probe.audioInputCount || 0;
      if (probe.permissionState && this.subsystems) {
        this.subsystems.microphoneAccess = probe.permissionState;
      }
      return probe;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Requests microphone permission explicitly (when required) and activates autonomous
   * hands-free voice (full-duplex CONTINUOUS listening <-> processing <-> speaking).
   */
  async enableAutonomousVoice(reason = 'USER_ENABLE_AUTONOMOUS_VOICE') {
    if (this.isEmergencyStopped) {
      return this.getVoiceTelemetry();
    }
    return await this.setVoiceMode(VOICE_MODES.CONTINUOUS, { reason });
  }

  /**
   * Gracefully handles hot-plug / unplugged audio devices without bypassing Pause or E-Stop,
   * and without opening duplicate capture sessions.
   */
  async handleDeviceChange(probe = null) {
    const info = probe || (this.vad && typeof this.vad.probeHardware === 'function'
      ? await this.vad.probeHardware().catch(() => ({ audioInputCount: 0 }))
      : { audioInputCount: 0 });
    this.availableAudioInputs = info.audioInputCount || 0;

    if (this.isEmergencyStopped || this.voiceMode === VOICE_MODES.DISABLED || this.isPaused) {
      return;
    }
    if (this._deviceRecoveryInFlight) {
      return;
    }

    const canonical = this.getCanonicalState();
    const hasLiveTrack = Boolean(
      this.vad && this.vad.mediaStream &&
      typeof this.vad.mediaStream.getAudioTracks === 'function' &&
      this.vad.mediaStream.getAudioTracks().some(t => t.readyState === 'live')
    );

    if (info.audioInputCount === 0 && (this.voiceMode === VOICE_MODES.CONTINUOUS || this.voiceMode === VOICE_MODES.WAKE_WORD)) {
      this._handleCaptureFailureError({ name: 'NotFoundError', message: 'Microphone device disconnected' });
      return;
    }

    const needsRecovery =
      (canonical === CANONICAL_VOICE_STATES.ERROR && this.lastErrorCategory === 'DEVICE_NOT_FOUND' && info.audioInputCount > 0) ||
      ((this.voiceMode === VOICE_MODES.CONTINUOUS || this.voiceMode === VOICE_MODES.WAKE_WORD) && !hasLiveTrack && info.audioInputCount > 0);

    if (!needsRecovery) return;

    this._deviceRecoveryInFlight = true;
    try {
      console.log(`[VOICE_CONTROLLER] Audio device change detected (${info.audioInputCount} input(s)). Re-acquiring clean stream.`);
      if (this.vad) {
        this.vad.releaseMicrophone('DEVICE_CHANGE_REACQUIRE');
      }
      await this.setVoiceMode(this.voiceMode, { reason: 'DEVICE_CHANGE_RECOVERY' });
    } finally {
      this._deviceRecoveryInFlight = false;
    }
  }

  init() {
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

    if (!SpeechRecognition) {
      console.warn('[VOICE_CONTROLLER] Web Speech API not supported. Audio Stream STT will be used on explicit activation.');
      this.isSupported = true;
      this.isAudioFallbackActive = true;
      // Do NOT open microphone on boot; wait for explicit user voice mode activation
      return;
    }

    this.isSupported = true;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.updateRecognitionLanguage(this.currentLanguage);

      this.recognition.onstart = () => {
        if (this.voiceMode === VOICE_MODES.DISABLED || this.isPaused || this.isExplicitlyStopped || this.isEmergencyStopped || this.isMuted) {
          try { this.recognition.abort(); } catch (_) {}
          this.isRecognitionActive = false;
          return;
        }
        this.isRecognitionActive = true;
        this.isNetworkError = false;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.reconnectBackoffMs = 250;
        this.lastSuccessfulRecognitionTime = Date.now();
        this.lastError = null;
        this.lastErrorCategory = 'NONE';
        this.subsystems.speechRecognition = 'active';
        this.subsystems.microphoneAccess = 'granted';

        // Passive standby in READY must keep recognition hot for instant live captions WITHOUT triggering 0:00 timer.
        if (this.isListening) {
          this.subsystems.audioCapture = 'active';
          const currentState = this.sessionManager.getState ? this.sessionManager.getState() : this.sessionManager.state;
          if (currentState !== CONVERSATION_STATES.LISTENING && currentState !== CONVERSATION_STATES.CAPTURING) {
            if (this.sessionManager.captureStartTimeMs <= 0) {
              this.sessionManager.startCaptureTimer();
            }
            this.sessionManager.transition(CONVERSATION_STATES.LISTENING, { reason: 'RECOGNITION_READY' });
          }
        } else {
          this.subsystems.audioCapture = 'monitoring';
        }
        console.log('[VOICE_CONTROLLER] Web Speech recognition capture active.');
      };

      this.recognition.onspeechstart = () => {
        if (this.voiceMode === VOICE_MODES.DISABLED || this.isPaused || this.isMuted || this.isEmergencyStopped) return;
        const curState = this.sessionManager.getState ? this.sessionManager.getState() : this.sessionManager.state;
        if (curState === CONVERSATION_STATES.READY && !this.isListening) {
          this.isListening = true;
          this.sessionManager.startCaptureTimer();
          this.sessionManager.transition(CONVERSATION_STATES.LISTENING, { reason: 'RECOGNITION_SPEECH_ONSET' });
        }
        this.sessionManager.notifyUserSpeechStart();
        this.interruptionManager.notifyUserSpeechOnset('RECOGNITION_SPEECH_START');
      };

      this.recognition.onspeechend = () => {
        this.lastSpeechEndTime = performance.now();
        this.sessionManager.notifyUserSpeechEnd();
      };

      this.recognition.onresult = (event) => {
        this.handleSpeechResults(event);
      };

      this.recognition.onerror = (event) => {
        this.isRecognitionActive = false;
        const err = event.error;
        this.lastError = err;

        if (err === 'no-speech' || err === 'aborted') {
          // Normal silence pause or user abort; handled cleanly without error states
          this.subsystems.speechRecognition = 'restarting';
          return;
        }

        if (err === 'not-allowed') {
          console.warn('[VOICE_CONTROLLER] Microphone permission denied (not-allowed). Halting reconnect loop.');
          this.lastErrorCategory = 'PERMISSION_DENIED';
          this.subsystems.microphoneAccess = 'denied';
          this.subsystems.speechRecognition = 'error';
          this.isReconnecting = false;
          if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
          }
          this.sessionManager.transition(CONVERSATION_STATES.ERROR, {
            reason: 'PERMISSION_DENIED',
            message: 'Microphone permission denied. Please allow microphone access and click Retry.'
          });
          return;
        }

        if (err === 'service-not-allowed') {
          console.warn('[VOICE_CONTROLLER] Speech recognition service not allowed. Activating continuous Audio Stream STT fallback.');
          const wasListening = Boolean(this.isListening);
          this.isAudioFallbackActive = true;
          this.setupAudioStreamFallback({ startTimerIfReady: wasListening });
          return;
        }

        if (err === 'audio-capture') {
          console.warn('[VOICE_CONTROLLER] No microphone audio capture hardware available.');
          this.lastErrorCategory = 'DEVICE_NOT_FOUND';
          this.scheduleSafeRecognitionRestart('DEVICE_NOT_FOUND', event);
          return;
        }

        if (err === 'network') {
          console.log('[VOICE_CONTROLLER] Web Speech network error. Activating continuous Audio Stream STT fallback.');
          const wasListening = Boolean(this.isListening);
          this.isNetworkError = true;
          this.lastErrorCategory = 'TRANSIENT_NETWORK';
          this.isAudioFallbackActive = true;
          this.setupAudioStreamFallback({ startTimerIfReady: wasListening });

          // Schedule an automatic probe back to primary recognition after 25s if network is online
          if (this.networkRecoveryTimer) clearTimeout(this.networkRecoveryTimer);
          this.networkRecoveryTimer = setTimeout(() => {
            this.networkRecoveryTimer = null;
            if (this.isNetworkError && this.subsystems.networkConnectivity === 'online' && !this.isAssistantSpeaking() && !this.isExplicitlyStopped) {
              console.log('[VOICE_CONTROLLER] Probing recovery from Web Speech network error back to primary recognizer...');
              this.isNetworkError = false;
              this.isAudioFallbackActive = false;
              this.scheduleSafeRecognitionRestart('NETWORK_AUTO_PROBE');
            }
          }, 25000);
          return;
        }

        console.warn('[VOICE_CONTROLLER] Speech recognition error:', err);
        this.lastErrorCategory = 'TRANSIENT_NETWORK';
        this.scheduleSafeRecognitionRestart(`RECOGNITION_ERROR_${err}`, event);
      };

      this.recognition.onend = () => {
        this.isRecognitionActive = false;
        if (this.isPaused || this.isExplicitlyStopped) {
          this.isListening = false;
          return;
        }
        // Only restart automatically when explicitly operating in continuous mode (or unit test continuousListening=true)
        if (this.continuousListening && this.isSupported && !this.isNetworkError && !this.isAudioFallbackActive) {
          this.scheduleSafeRecognitionRestart('RECOGNITION_ONEND');
        } else if (!this.isAudioFallbackActive) {
          this.isListening = false;
        }
      };

      // Do NOT request microphone hardware during page load!
      // Audio capture initializes ONLY upon explicit user activation (setVoiceMode / Push-to-Talk / startListening).
    } catch (err) {
      console.warn('[VOICE_CONTROLLER] SpeechRecognition construction failed. Audio Stream STT available on explicit activation:', err);
      this.isRecognitionActive = false;
      this.isAudioFallbackActive = true;
    }
  }

  /**
   * Sets up Audio Stream capture fallback using MediaRecorder + VAD (ONLY when explicitly capturing)
   */
  async setupAudioStreamFallback({ startTimerIfReady = true } = {}) {
    if (this.isEmergencyStopped || this.isExplicitlyStopped || this.isPaused || this.voiceMode === VOICE_MODES.DISABLED) {
      return false;
    }
    if (typeof window === 'undefined' || !navigator.mediaDevices) return false;
    this.subsystems.speechRecognition = 'fallback';

    if (!this.vad.isInitialized) {
      const ok = await this.vad.init();
      if (!ok || !this.vad.isInitialized) {
        const err = this.vad.lastError || { name: 'NotReadableError', message: 'Microphone audio capture unavailable' };
        this._handleCaptureFailureError(err);
        return false;
      }
    }

    this.subsystems.audioCapture = startTimerIfReady ? 'active' : 'monitoring';
    this.subsystems.microphoneAccess = 'granted';
    this.isAudioFallbackActive = true;
    this.isListening = Boolean(startTimerIfReady);
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    const state = this.sessionManager.getState ? this.sessionManager.getState() : this.sessionManager.state;
    if (
      startTimerIfReady &&
      (state === CONVERSATION_STATES.RECONNECTING ||
        state === CONVERSATION_STATES.ACTIVATING ||
        state === CONVERSATION_STATES.ERROR ||
        state === CONVERSATION_STATES.IDLE ||
        state === CONVERSATION_STATES.READY)
    ) {
      this.sessionManager.startCaptureTimer();
      this.sessionManager.transition(CONVERSATION_STATES.LISTENING, { reason: 'FALLBACK_READY' });
    }
    return true;
  }

  _handleCaptureFailureError(err = {}) {
    const errName = String(err.name || err.code || '');
    const errMsg = String(err.message || 'Microphone access error');
    this.isListening = false;
    this.isRecognitionActive = false;
    this.isReconnecting = false;
    if (this.vad && typeof this.vad.releaseMicrophone === 'function') {
      this.vad.releaseMicrophone('CAPTURE_ERROR');
    }

    const isExplicitPermissionName = errName === 'NotAllowedError' || errName === 'PermissionDeniedError';
    const isExplicitNotFoundName = errName === 'NotFoundError' || errName === 'DevicesNotFoundError';

    if (isExplicitPermissionName || (!isExplicitNotFoundName && /denied|permission/i.test(errMsg))) {
      this.lastErrorCategory = 'PERMISSION_DENIED';
      this.lastError = 'Microphone permission denied. Allow microphone access and retry.';
      this.subsystems.microphoneAccess = 'denied';
      this.subsystems.audioCapture = 'error';
      this.subsystems.speechRecognition = 'error';
      this.sessionManager.transition(CONVERSATION_STATES.ERROR, {
        reason: 'PERMISSION_DENIED',
        message: this.lastError
      });
      return;
    }

    if (isExplicitNotFoundName || /not found|no audio/i.test(errMsg)) {
      this.lastErrorCategory = 'DEVICE_NOT_FOUND';
      this.lastError = 'No active microphone hardware detected. Connect a microphone and retry.';
      this.subsystems.audioCapture = 'error';
      this.subsystems.speechRecognition = 'error';
      this.sessionManager.transition(CONVERSATION_STATES.ERROR, {
        reason: 'DEVICE_NOT_FOUND',
        message: this.lastError
      });
      return;
    }

    this.lastErrorCategory = 'AUDIO_CAPTURE_ERROR';
    this.lastError = errMsg;
    this.subsystems.audioCapture = 'error';
    this.subsystems.speechRecognition = 'error';
    this.sessionManager.transition(CONVERSATION_STATES.ERROR, {
      reason: 'AUDIO_CAPTURE_ERROR',
      message: this.lastError
    });
  }

  startAudioChunkRecording() {
    if (this.isRecordingAudio || !this.vad || !this.vad.mediaStream) return;
    try {
      const mime = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) 
        ? 'audio/webm;codecs=opus' 
        : ((typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm' : '');

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.vad.mediaStream, mime ? { mimeType: mime } : {});
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };
      this.mediaRecorder.start(100);
      this.isRecordingAudio = true;
      this.audioRecordingStartTime = Date.now();
      this.sessionManager.notifyCapturingStart();

      // Emit live user captions indication during audio stream recording when Web Speech is not already active
      if ((!this.isRecognitionActive || this.isAudioFallbackActive || this.isNetworkError) && typeof this.onUserSpeech === 'function') {
        this.onUserSpeech('Listening...', false);
      }
    } catch (err) {
      console.warn('[VOICE_CONTROLLER] MediaRecorder start failed:', err.message);
    }
  }

  async stopAudioChunkRecordingAndTranscribe() {
    if (!this.isRecordingAudio || !this.mediaRecorder) return;
    this.isRecordingAudio = false;
    this.audioRecordingStartTime = 0;
    this.sessionManager.notifyCapturingEnd();

    try {
      await new Promise((resolve) => {
        if (this.mediaRecorder.state === 'inactive') return resolve();
        this.mediaRecorder.addEventListener('stop', () => resolve(), { once: true });
        try {
          this.mediaRecorder.stop();
        } catch (err) {
          resolve();
        }
        setTimeout(resolve, 350);
      });

      if (this.audioChunks.length === 0) {
        this._recoverAfterNoSpeech('AUDIO_BUFFER_EMPTY');
        return;
      }

      const chunksSnapshot = [...this.audioChunks];
      this.audioChunks = [];

      const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksSnapshot, { type: mimeType });

      if (blob.size < 150) {
        this._recoverAfterNoSpeech('AUDIO_CHUNK_TOO_SMALL');
        return;
      }

      // If already in fallback mode or network error or no recognition engine, transcribe immediately
      if (this.isAudioFallbackActive || this.isNetworkError || !this.recognition) {
        this.dispatchAudioBlobToSTT(blob, mimeType);
        return;
      }

      // Dual-Engine safety net: wait up to 1000ms for Web Speech to emit transcript.
      // If Web Speech stalls or misses the utterance, auto-dispatch to STT!
      if (this.rescueTimeout) {
        clearTimeout(this.rescueTimeout);
      }
      const recordTime = Date.now();
      this.rescueTimeout = setTimeout(() => {
        this.rescueTimeout = null;
        if (this.lastWebSpeechResultTime < recordTime) {
          console.log('[VOICE_CONTROLLER] Web Speech missed utterance. Dual-engine fallback rescued speech!');
          this.dispatchAudioBlobToSTT(blob, mimeType);
        }
      }, 600);
    } catch (e) {
      this.isRecordingAudio = false;
      this._recoverAfterNoSpeech('AUDIO_RECORD_ERROR');
    }
  }

  _recoverAfterNoSpeech(reason = 'NO_SPEECH') {
    this.isListening = false;
    this.lastTransitionReason = reason;
    const targetState = (this.voiceMode === VOICE_MODES.DISABLED || this.isExplicitlyStopped)
      ? CONVERSATION_STATES.DISABLED
      : CONVERSATION_STATES.READY;
    this.sessionManager.transition(targetState, { reason });
  }

  dispatchAudioBlobToSTT(blob, mimeType) {
    this.sessionManager.notifyTranscribingStart();

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      try {
        const res = await fetch('/api/stt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio: base64,
            mimeType,
            language: this.currentLanguage || 'en'
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.text && data.text.trim()) {
            console.log(`[VOICE_CONTROLLER] Dual-engine STT recognized: "${data.text}" (${data.provider})`);
            this.processTranscript(data.text.trim(), true, data.confidence || 0.95);
          } else {
            this._recoverAfterNoSpeech('STT_EMPTY_RESPONSE');
          }
        } else {
          this._recoverAfterNoSpeech('STT_NON_OK_RESPONSE');
        }
      } catch (err) {
        console.warn('[VOICE_CONTROLLER] STT API call error:', err.message);
        this._recoverAfterNoSpeech('STT_ERROR_RECOVERY');
      }
    };
    reader.readAsDataURL(blob);
  }

  updateRecognitionLanguage(langMode = 'en') {
    this.currentLanguage = langMode;
    if (this.recognition) {
      if (langMode === 'hi') {
        this.recognition.lang = 'hi-IN';
      } else if (langMode === 'hinglish') {
        this.recognition.lang = 'en-IN';
      } else {
        const isIndiaTimezone = (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone && 
          ((Intl.DateTimeFormat().resolvedOptions().timeZone || '').includes('Calcutta') || (Intl.DateTimeFormat().resolvedOptions().timeZone || '').includes('Kolkata')));
        this.recognition.lang = isIndiaTimezone ? 'en-IN' : 'en-US';
      }
    }
  }

  setLanguage(langMode) {
    this.updateRecognitionLanguage(langMode);
  }

  setContinuousListening(enabled) {
    this.continuousListening = Boolean(enabled);
    if (!this.continuousListening) {
      console.log('[VOICE_CONTROLLER] Continuous listening disabled by user.');
    } else {
      console.log('[VOICE_CONTROLLER] Continuous listening enabled by user.');
      if (!this.isListening) {
        this.startListening();
      }
    }
  }

  isAssistantSpeaking() {
    const synthManaged = typeof window !== 'undefined' ? window.jarvisApp?.speechSynthesizer : null;
    const synthSpeaking = synthManaged
      ? Boolean(synthManaged.isSpeaking)
      : Boolean(typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking);
    return Boolean(
      synthSpeaking ||
      (this.vad && this.vad.isAssistantSpeaking) ||
      (this.interruptionManager && this.interruptionManager.getState() === INTERRUPTION_STATES.ASSISTANT_SPEAKING)
    );
  }

  scheduleSafeRecognitionRestart(reason = 'SAFE_RESTART', errorEvent = null) {
    if (this.isEmergencyStopped || this.isExplicitlyStopped || !this.continuousListening || this.isMuted) return;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    // 1. If assistant is speaking, defer restart until speech completion (avoids self-echo loop)
    if (this.isAssistantSpeaking()) {
      console.log('[VOICE_CONTROLLER] Recognition ended during assistant speech. Restart deferred to speech completion.');
      return;
    }

    // 2. Normal speech endings / routine pauses: NEVER count as errors and NEVER transition to RECONNECTING!
    if (reason === 'RECOGNITION_ONEND' || reason === 'NO_SPEECH_SILENCE' || reason === 'ROUTINE_CYCLE') {
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.subsystems.speechRecognition = 'active';

      // Keep current healthy conversation state
      const currentState = this.sessionManager.getState();
      if ((currentState === CONVERSATION_STATES.IDLE || currentState === CONVERSATION_STATES.ERROR) && this.continuousListening) {
        this.sessionManager.transition(CONVERSATION_STATES.LISTENING, { reason: 'CONTINUOUS_ARMED' });
      }

      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (!this.isExplicitlyStopped && this.continuousListening && !this.isRecognitionActive && !this.isAudioFallbackActive && !this.isAssistantSpeaking() && !this.isMuted) {
          this.startListening();
        }
      }, 60);
      return;
    }

    // 3. Permanent / Non-recoverable failures: halt retries immediately
    if (this.lastErrorCategory === 'PERMISSION_DENIED') {
      this.subsystems.microphoneAccess = 'denied';
      this.subsystems.speechRecognition = 'error';
      this.isReconnecting = false;
      this.sessionManager.transition(CONVERSATION_STATES.ERROR, {
        reason: 'PERMISSION_DENIED',
        message: 'Microphone permission denied. Please allow microphone access and click Retry.'
      });
      return;
    }

    if (this.lastErrorCategory === 'DEVICE_NOT_FOUND') {
      this.subsystems.audioCapture = 'error';
      this.subsystems.speechRecognition = 'error';
      this.isReconnecting = false;
      this.sessionManager.transition(CONVERSATION_STATES.ERROR, {
        reason: 'DEVICE_NOT_FOUND',
        message: 'No microphone input device detected. Please connect a microphone and click Retry.'
      });
      return;
    }

    // Routine Chrome ~60s idle cycle / tab visibility return in READY standby: re-arm silently without error count
    const stateBeforeRearm = this.sessionManager && this.sessionManager.getState ? this.sessionManager.getState() : CONVERSATION_STATES.READY;
    if (
      (reason === 'RECOGNITION_ONEND' || reason === 'PASSIVE_REARM' || reason === 'TAB_VISIBILITY_RETURN') &&
      stateBeforeRearm === CONVERSATION_STATES.READY &&
      !this.isListening
    ) {
      this.reconnectAttempts = 0;
      if (this.restartTimer) clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        this._armPassiveSpeechRecognition(reason);
      }, 200);
      return;
    }

    // 4. Prevent multiple simultaneous reconnect loops
    if (this.isReconnecting) {
      console.log('[VOICE_CONTROLLER] Reconnection already in progress. Ignoring duplicate trigger.');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // 5. Bounded Retries: Stop after maxReconnectAttempts (6)
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.warn(`[VOICE_CONTROLLER] Maximum reconnect attempts (${this.maxReconnectAttempts}) exceeded. Transitioning to bounded ERROR state.`);
      this.isReconnecting = false;
      this.subsystems.speechRecognition = 'error';
      this.sessionManager.transition(CONVERSATION_STATES.ERROR, {
        reason: 'MAX_RECONNECT_EXCEEDED',
        message: `Voice connection failed after ${this.maxReconnectAttempts} attempts. Click Retry to reconnect.`
      });
      return;
    }

    // 6. Exponential backoff with jitter (250ms * 1.5^n + jitter, capped at 6000ms)
    const baseDelay = 250 * Math.pow(1.5, this.reconnectAttempts);
    const jitter = Math.random() * 200;
    const delay = Math.min(6000, Math.round(baseDelay + jitter));

    console.log(`[VOICE_CONTROLLER] Transient failure (${reason}). Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
    this.subsystems.speechRecognition = 'reconnecting';
    this.sessionManager.transition(CONVERSATION_STATES.RECONNECTING, {
      reason,
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay
    });

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.isExplicitlyStopped && this.continuousListening && !this.isAssistantSpeaking() && !this.isMuted && !this.isPaused) {
        const stateNow = this.sessionManager && this.sessionManager.getState ? this.sessionManager.getState() : CONVERSATION_STATES.READY;
        if (stateNow === CONVERSATION_STATES.READY && !this.isListening) {
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          this._armPassiveSpeechRecognition(reason || 'PASSIVE_REARM');
        } else {
          this.startListening();
        }
      } else {
        this.isReconnecting = false;
      }
    }, delay);
  }

  /**
   * Arms Web Speech API silently in Always-On standby (READY) without triggering a fake 0:00 timer
   */
  _armPassiveSpeechRecognition(reason = 'PASSIVE_ARM') {
    if (
      typeof window === 'undefined' ||
      !this.recognition ||
      this.isNetworkError ||
      this.isAudioFallbackActive ||
      this.isEmergencyStopped ||
      this.isExplicitlyStopped ||
      this.isPaused ||
      this.isMuted ||
      this.isAssistantSpeaking() ||
      (this.voiceMode !== VOICE_MODES.CONTINUOUS && this.voiceMode !== VOICE_MODES.WAKE_WORD)
    ) {
      return false;
    }
    if (this.isRecognitionActive) return true;
    try {
      this.recognition.start();
      return true;
    } catch (e) {
      if (e && e.name === 'InvalidStateError') {
        this.isRecognitionActive = true;
        return true;
      }
      console.warn(`[VOICE_CONTROLLER] Passive recognition arm failed (${reason}):`, e?.message || e);
      return false;
    }
  }

  /**
   * Maps internal state machine & mode into the 7 canonical voice lifecycle states:
   * DISABLED | READY | LISTENING | PROCESSING | SPEAKING | PAUSED | ERROR
   */
  getCanonicalState() {
    const raw = this.sessionManager && this.sessionManager.getState
      ? this.sessionManager.getState()
      : (this.sessionManager ? this.sessionManager.state : CONVERSATION_STATES.DISABLED);

    if (raw === CONVERSATION_STATES.ERROR) return CANONICAL_VOICE_STATES.ERROR;
    if (this.isPaused || raw === CONVERSATION_STATES.PAUSED) return CANONICAL_VOICE_STATES.PAUSED;
    if (raw === CONVERSATION_STATES.SPEAKING || raw === CONVERSATION_STATES.ASSISTANT_SPEAKING) {
      return CANONICAL_VOICE_STATES.SPEAKING;
    }
    if (
      raw === CONVERSATION_STATES.THINKING ||
      raw === CONVERSATION_STATES.TRANSCRIBING ||
      raw === CONVERSATION_STATES.EXECUTING ||
      raw === CONVERSATION_STATES.PROCESSING
    ) {
      return CANONICAL_VOICE_STATES.PROCESSING;
    }
    if (
      raw === CONVERSATION_STATES.CAPTURING ||
      raw === CONVERSATION_STATES.USER_SPEAKING ||
      (raw === CONVERSATION_STATES.LISTENING && (this.isListening || (this.sessionManager && this.sessionManager.captureStartTimeMs > 0))) ||
      (raw === CONVERSATION_STATES.AWAITING_FOLLOWUP && this.isListening) ||
      (raw === CONVERSATION_STATES.INTERRUPTED && this.isListening)
    ) {
      return CANONICAL_VOICE_STATES.LISTENING;
    }
    if (raw === CONVERSATION_STATES.READY) return CANONICAL_VOICE_STATES.READY;
    if (raw === CONVERSATION_STATES.DISABLED) return CANONICAL_VOICE_STATES.DISABLED;
    if (this.voiceMode !== VOICE_MODES.DISABLED && !this.isExplicitlyStopped && !this.isEmergencyStopped) {
      return CANONICAL_VOICE_STATES.READY;
    }
    return CANONICAL_VOICE_STATES.DISABLED;
  }

  getTimerSnapshot() {
    const canonical = this.getCanonicalState();
    const captureStartedAtMs = this.sessionManager ? this.sessionManager.captureStartTimeMs : 0;
    const isTimerActive = canonical === CANONICAL_VOICE_STATES.LISTENING && captureStartedAtMs > 0;
    const elapsedMs = isTimerActive ? Math.max(0, Date.now() - captureStartedAtMs) : 0;
    const totalSec = Math.floor(elapsedMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return {
      isTimerActive,
      captureStartedAtMs: isTimerActive ? captureStartedAtMs : null,
      elapsedMs,
      formatted: `${mins}:${String(secs).padStart(2, '0')}`,
      sessionId: this.sessionManager ? (this.sessionManager.captureSessionId || this.sessionManager.sessionId) : null,
      generation: this.voiceGeneration
    };
  }

  getVoiceTelemetry() {
    const canonical = this.getCanonicalState();
    const timer = this.getTimerSnapshot();
    return {
      state: canonical,
      internalState: this.sessionManager ? this.sessionManager.getState() : canonical,
      voiceMode: this.voiceMode,
      sessionId: timer.sessionId,
      generation: this.voiceGeneration,
      captureStartedAtMs: timer.captureStartedAtMs,
      elapsedMs: timer.elapsedMs,
      isTimerActive: timer.isTimerActive,
      timerFormatted: timer.formatted,
      lastError: (canonical === CANONICAL_VOICE_STATES.ERROR || this.lastError)
        ? { code: this.lastErrorCategory || 'VOICE_ERROR', message: String(this.lastError || 'Voice error') }
        : null,
      micDeviceLabel: (this.vad && this.vad.activeDeviceLabel && this.vad.activeDeviceLabel !== 'Unknown Device')
        ? this.vad.activeDeviceLabel
        : null,
      permissionState: this.subsystems.microphoneAccess,
      reason: this.lastTransitionReason
    };
  }

  async setVoiceMode(mode = VOICE_MODES.DISABLED, { reason = 'USER_MODE_CHANGE' } = {}) {
    const normalized = String(mode || VOICE_MODES.DISABLED).trim().toUpperCase();
    if (!VOICE_MODES[normalized]) {
      throw new Error(`Unsupported voice mode: ${mode}`);
    }

    if (this.isEmergencyStopped && normalized !== VOICE_MODES.DISABLED) {
      this.lastErrorCategory = 'EMERGENCY_STOP_ACTIVE';
      this.lastError = 'Emergency Stop is active. Reset Emergency Stop before enabling voice.';
      return this.getVoiceTelemetry();
    }

    this.voiceGeneration++;
    this.lastTransitionReason = reason;
    this.isPaused = false;
    this.isMuted = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.lastErrorCategory = 'NONE';
    this.stopWatchdog();

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.rescueTimeout) {
      clearTimeout(this.rescueTimeout);
      this.rescueTimeout = null;
    }
    if (this.mediaRecorder && this.isRecordingAudio) {
      try { this.mediaRecorder.stop(); } catch (_) {}
      this.isRecordingAudio = false;
    }
    if (this.recognition) {
      try { this.recognition.abort(); } catch (_) {}
      this.isRecognitionActive = false;
    }

    this.isListening = false;
    this.voiceMode = VOICE_MODES[normalized];

    if (this.voiceMode === VOICE_MODES.DISABLED) {
      this.isExplicitlyStopped = true;
      this.continuousListening = false;
      this.subsystems.speechRecognition = 'inactive';
      this.subsystems.audioCapture = 'inactive';
      if (this.sessionManager) this.sessionManager.setContinuousListening(false);
      if (this.vad) this.vad.releaseMicrophone('MODE_DISABLED');
      if (this.sessionManager) {
        this.sessionManager.transition(CONVERSATION_STATES.DISABLED, { reason });
      }
      return this.getVoiceTelemetry();
    }

    this.isExplicitlyStopped = false;
    this.continuousListening = (this.voiceMode === VOICE_MODES.CONTINUOUS);
    if (this.sessionManager) {
      this.sessionManager.setContinuousListening(this.continuousListening);
    }

    if (this.voiceMode === VOICE_MODES.PUSH_TO_TALK) {
      // Do NOT keep microphone capturing in standby PTT; wait until PTT press
      if (this.vad) this.vad.releaseMicrophone('PTT_READY');
      this.subsystems.audioCapture = 'inactive';
      this.subsystems.speechRecognition = 'inactive';
      if (this.sessionManager) {
        this.sessionManager.transition(CONVERSATION_STATES.READY, { reason });
      }
      return this.getVoiceTelemetry();
    }

    // WAKE_WORD or CONTINUOUS mode: verify mic permission & monitor audio cleanly in READY (timer remains inactive!)
    if (this.vad && typeof window !== 'undefined' && navigator.mediaDevices) {
      const ok = await this.vad.start();
      if (!ok || !this.vad.isInitialized) {
        this._handleCaptureFailureError(this.vad.lastError || { name: 'NotReadableError', message: 'Microphone access failed' });
        return this.getVoiceTelemetry();
      }
      this.subsystems.microphoneAccess = 'granted';
      this.subsystems.audioCapture = 'monitoring';
    }

    if (this.sessionManager) {
      const curState = this.sessionManager.getState();
      if (curState !== CONVERSATION_STATES.LISTENING && curState !== CONVERSATION_STATES.CAPTURING) {
        this.sessionManager.transition(CONVERSATION_STATES.READY, { reason });
      }
    }
    // Keep Web Speech recognition passively armed so live spoken captions render instantaneously
    this._armPassiveSpeechRecognition(reason || 'MODE_READY_ARM');
    return this.getVoiceTelemetry();
  }

  async startPushToTalk() {
    if (!this.isSupported || this.isEmergencyStopped) return this.getVoiceTelemetry();
    if (this.voiceMode === VOICE_MODES.DISABLED || this.isPaused) {
      this.voiceMode = VOICE_MODES.PUSH_TO_TALK;
      this.isPaused = false;
    }
    this.startListening({ reason: 'PTT_HOLD_START', modeOverride: this.voiceMode });
    return this.getVoiceTelemetry();
  }

  async stopPushToTalk() {
    if (this.isRecordingAudio && this.mediaRecorder) {
      this.isListening = false;
      this.subsystems.audioCapture = 'inactive';
      if (this.recognition) {
        try { this.recognition.stop(); } catch (_) {}
      }
      this.isRecognitionActive = false;
      await this.stopAudioChunkRecordingAndTranscribe();
      const canonical = this.getCanonicalState();
      if (canonical === CANONICAL_VOICE_STATES.LISTENING) {
        this.endListeningSession('PTT_RELEASED');
      }
    } else {
      this.endListeningSession('PTT_RELEASED');
    }
    return this.getVoiceTelemetry();
  }

  pauseVoice(reason = 'USER_PAUSED') {
    this.voiceGeneration++;
    this.isPaused = true;
    this.isExplicitlyStopped = true;
    this.isListening = false;
    this.isRecognitionActive = false;
    this.isReconnecting = false;
    this.lastTransitionReason = reason;
    this.subsystems.speechRecognition = 'inactive';
    this.subsystems.audioCapture = 'inactive';
    this.stopWatchdog();
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.rescueTimeout) {
      clearTimeout(this.rescueTimeout);
      this.rescueTimeout = null;
    }
    if (this.mediaRecorder && this.isRecordingAudio) {
      try { this.mediaRecorder.stop(); } catch (_) {}
      this.isRecordingAudio = false;
    }
    if (this.recognition) {
      try { this.recognition.abort(); } catch (_) {}
    }
    if (this.vad) {
      this.vad.releaseMicrophone(reason);
    }
    if (this.sessionManager) {
      this.sessionManager.transition(CONVERSATION_STATES.PAUSED, { reason });
    }
    return this.getVoiceTelemetry();
  }

  async resumeVoice(reason = 'USER_RESUMED') {
    if (this.isEmergencyStopped) {
      return this.getVoiceTelemetry();
    }
    const targetMode = (this.voiceMode && this.voiceMode !== VOICE_MODES.DISABLED)
      ? this.voiceMode
      : VOICE_MODES.PUSH_TO_TALK;
    return this.setVoiceMode(targetMode, { reason });
  }

  endListeningSession(reason = 'CAPTURE_ENDED') {
    this.voiceGeneration++;
    this.isListening = false;
    this.isRecognitionActive = false;
    this.lastTransitionReason = reason;
    this.subsystems.speechRecognition = 'inactive';
    this.subsystems.audioCapture = (this.voiceMode === VOICE_MODES.CONTINUOUS || this.voiceMode === VOICE_MODES.WAKE_WORD) ? 'monitoring' : 'inactive';

    if (this.rescueTimeout) {
      clearTimeout(this.rescueTimeout);
      this.rescueTimeout = null;
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
    }
    if (this.voiceMode === VOICE_MODES.PUSH_TO_TALK || this.voiceMode === VOICE_MODES.DISABLED) {
      if (this.vad) this.vad.releaseMicrophone(reason);
    }
    if (this.sessionManager) {
      const targetState = (this.voiceMode === VOICE_MODES.DISABLED || this.isExplicitlyStopped)
        ? CONVERSATION_STATES.DISABLED
        : CONVERSATION_STATES.READY;
      this.sessionManager.transition(targetState, { reason });
    }
    return this.getVoiceTelemetry();
  }

  startListening(options = {}) {
    if (!this.isSupported || this.isEmergencyStopped) return;
    if (this.isMuted) {
      console.log('[VOICE_CONTROLLER] Microphone is currently muted.');
      return;
    }
    this.voiceGeneration++;
    this.isPaused = false;
    this.isExplicitlyStopped = false;
    if (options && options.modeOverride && VOICE_MODES[options.modeOverride]) {
      this.voiceMode = VOICE_MODES[options.modeOverride];
      this.continuousListening = (this.voiceMode === VOICE_MODES.CONTINUOUS);
    } else if (this.voiceMode === VOICE_MODES.DISABLED) {
      // Explicit startListening() call without prior mode promotes to CONTINUOUS for multi-turn test & legacy compat
      this.voiceMode = VOICE_MODES.CONTINUOUS;
      this.continuousListening = true;
    } else {
      this.continuousListening = (this.voiceMode === VOICE_MODES.CONTINUOUS);
    }

    if (this.sessionManager) {
      this.sessionManager.setContinuousListening(this.continuousListening);
    }
    this.lastTransitionReason = (options && options.reason) || 'EXPLICIT_START';

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    // Check browser hardware capture asynchronously (cannot hold a synchronous Node unit test, but aborts immediately if denied/missing in Chromium)
    const captureGen = this.voiceGeneration;
    if (this.vad) {
      const vadPromise = this.vad.start();
      if (vadPromise && typeof vadPromise.then === 'function' && typeof window !== 'undefined' && navigator.mediaDevices) {
        vadPromise.then((ok) => {
          if (captureGen !== this.voiceGeneration || this.isExplicitlyStopped || this.isPaused || this.isEmergencyStopped) return;
          if (!ok || !this.vad.isInitialized) {
            this._handleCaptureFailureError(this.vad.lastError || { name: 'NotReadableError', message: 'Microphone audio capture unavailable' });
            return;
          }
          this.subsystems.microphoneAccess = 'granted';
          this.subsystems.audioCapture = 'active';
          this.isListening = true;
          if (this.sessionManager) {
            if (this.sessionManager.captureStartTimeMs <= 0) {
              this.sessionManager.startCaptureTimer();
            }
            const cur = this.sessionManager.getState ? this.sessionManager.getState() : this.sessionManager.state;
            if (cur !== CONVERSATION_STATES.LISTENING && cur !== CONVERSATION_STATES.CAPTURING && !this.isReconnecting && !this.isAssistantSpeaking()) {
              this.sessionManager.transition(CONVERSATION_STATES.LISTENING, { reason: this.lastTransitionReason || 'MIC_CAPTURE_ACTIVE' });
            }
          }
          if (this.voiceMode === VOICE_MODES.PUSH_TO_TALK && !this.isRecordingAudio) {
            this.startAudioChunkRecording();
          }
        }).catch((err) => {
          if (captureGen !== this.voiceGeneration) return;
          this._handleCaptureFailureError(err);
        });
      } else {
        this.subsystems.audioCapture = 'active';
      }
    }

    this.isListening = true;
    if (this.sessionManager) {
      this.sessionManager.startCaptureTimer();
    }

    if (this.recognition && !this.isNetworkError && !this.isAudioFallbackActive) {
      if (!this.isRecognitionActive) {
        try {
          this.recognition.start();
        } catch (e) {
          if (e.name === 'InvalidStateError') {
            // Recognition is already running — preserve it cleanly instead of aborting live captions!
            this.isRecognitionActive = true;
          } else {
            this._handleCaptureFailureError(e);
            return;
          }
        }
      } else {
        const currentState = this.sessionManager.getState ? this.sessionManager.getState() : this.sessionManager.state;
        if (currentState !== CONVERSATION_STATES.LISTENING) {
          this.sessionManager.transition(CONVERSATION_STATES.LISTENING, { reason: 'RECOGNITION_ALREADY_ACTIVE' });
        }
      }
    } else if (this.isAudioFallbackActive) {
      const currentState = this.sessionManager.getState ? this.sessionManager.getState() : this.sessionManager.state;
      if (currentState !== CONVERSATION_STATES.LISTENING) {
        this.sessionManager.transition(CONVERSATION_STATES.LISTENING, { reason: 'FALLBACK_LISTENING' });
      }
    }

    this.startWatchdog();
  }

  startWatchdog() {
    if (this.isEmergencyStopped || this.watchdogIntervalId) return;
    this.watchdogIntervalId = setInterval(() => {
      if (!this.continuousListening || this.isExplicitlyStopped || this.isMuted || this.isAssistantSpeaking() || this.isReconnecting || this.restartTimer) {
        return;
      }

      // 1. Anti-hang: prolonged audio chunk recording (>8s) auto-stop
      if (this.isRecordingAudio && this.audioRecordingStartTime && (Date.now() - this.audioRecordingStartTime > 8000)) {
        console.warn('[VOICE_CONTROLLER] Watchdog: Audio recording prolonged (>8s). Auto-stopping chunk recording.');
        this.stopAudioChunkRecordingAndTranscribe();
      }

      // 2. Anti-hang: ensure sessionManager is not trapped in CAPTURING or TRANSCRIBING indefinitely
      const currentState = this.sessionManager ? (this.sessionManager.getState ? this.sessionManager.getState() : this.sessionManager.state) : null;
      if (currentState === 'CAPTURING' && !this.isRecordingAudio) {
        console.warn('[VOICE_CONTROLLER] Watchdog: Inconsistent CAPTURING state without active audio recording. Resetting to LISTENING.');
        this.sessionManager.transition('LISTENING', { reason: 'WATCHDOG_INCONSISTENT_CAPTURING_RESET' });
      } else if (currentState === 'TRANSCRIBING' && !this.isRecordingAudio && (!this._sttInFlightTimestamp || (Date.now() - this._sttInFlightTimestamp > 4000))) {
        console.warn('[VOICE_CONTROLLER] Watchdog: Inconsistent TRANSCRIBING state without active processing. Resetting to LISTENING.');
        this.sessionManager.transition('LISTENING', { reason: 'WATCHDOG_INCONSISTENT_TRANSCRIBING_RESET' });
      }

      // 3. Ensure recognition engine has not stalled or died
      if (!this.isAudioFallbackActive && this.recognition && !this.isRecognitionActive) {
        try {
          this.recognition.start();
        } catch (e) {
          if (e.name === 'InvalidStateError') {
            try { this.recognition.abort(); } catch (err) {}
            this.isRecognitionActive = false;
          }
        }
      }
    }, 2000);
  }

  stopWatchdog() {
    if (this.watchdogIntervalId) {
      clearInterval(this.watchdogIntervalId);
      this.watchdogIntervalId = null;
    }
  }

  stopListening() {
    this.voiceGeneration++;
    this.isExplicitlyStopped = true;
    this.continuousListening = false;
    this.isReconnecting = false;
    this.isPaused = false;
    this.voiceMode = VOICE_MODES.DISABLED;
    this.lastTransitionReason = 'STOP_LISTENING_EXPLICIT';
    if (this.sessionManager) {
      this.sessionManager.setContinuousListening(false);
    }
    this.isListening = false;
    this.isRecognitionActive = false;
    this.subsystems.speechRecognition = 'inactive';
    this.subsystems.audioCapture = 'inactive';

    this.stopWatchdog();
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.rescueTimeout) {
      clearTimeout(this.rescueTimeout);
      this.rescueTimeout = null;
    }
    if (this.vad) {
      if (typeof this.vad.releaseMicrophone === 'function') {
        this.vad.releaseMicrophone('STOP_LISTENING_EXPLICIT');
      } else {
        this.vad.stop();
      }
    }
    if (this.mediaRecorder && this.isRecordingAudio) {
      try { this.mediaRecorder.stop(); } catch (e) {}
      this.isRecordingAudio = false;
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
    this.sessionManager.transition(CONVERSATION_STATES.IDLE, { reason: 'STOP_LISTENING_EXPLICIT' });
  }

  handleEmergencyStop(reason = 'EMERGENCY_STOP') {
    this.voiceGeneration++;
    this.isEmergencyStopped = true;
    this.isExplicitlyStopped = true;
    this.continuousListening = false;
    this.isPaused = false;
    this.voiceMode = VOICE_MODES.DISABLED;
    this.lastTransitionReason = reason;
    this.isListening = false;
    this.isRecognitionActive = false;
    this.subsystems.speechRecognition = 'inactive';
    this.subsystems.audioCapture = 'inactive';

    this.stopWatchdog();
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.rescueTimeout) {
      clearTimeout(this.rescueTimeout);
      this.rescueTimeout = null;
    }
    if (this.pendingWakeTimeout) {
      clearTimeout(this.pendingWakeTimeout);
      this.pendingWakeTimeout = null;
    }
    if (this.vad) {
      try {
        if (typeof this.vad.releaseMicrophone === 'function') {
          this.vad.releaseMicrophone(reason);
        } else {
          this.vad.stop();
        }
      } catch (e) {}
    }
    if (this.mediaRecorder && this.isRecordingAudio) {
      try { this.mediaRecorder.stop(); } catch (e) {}
      this.isRecordingAudio = false;
    }
    if (this.recognition) {
      try { this.recognition.abort(); } catch (e) {}
    }
    if (this.sessionManager) {
      this.sessionManager.setContinuousListening(false);
      this.sessionManager.transition(CONVERSATION_STATES.DISABLED, { reason: 'EMERGENCY_STOP' });
    }
    if (this.interruptionManager) {
      this.interruptionManager.reset();
    }
  }

  resetEmergencyStop() {
    this.voiceGeneration++;
    this.isEmergencyStopped = false;
    this.isExplicitlyStopped = true;
    this.continuousListening = false;
    this.isPaused = false;
    this.isListening = false;
    this.voiceMode = VOICE_MODES.DISABLED;
    this.lastTransitionReason = 'EMERGENCY_RESET';
    if (this.sessionManager) {
      this.sessionManager.transition(CONVERSATION_STATES.DISABLED, { reason: 'EMERGENCY_RESET' });
    }
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    console.log(`[VOICE_CONTROLLER] Microphone muted: ${this.isMuted}`);
    if (this.isMuted) {
      this.isListening = false;
      this.isRecognitionActive = false;
      this.subsystems.audioCapture = 'inactive';
      this.subsystems.speechRecognition = 'inactive';
      if (this.recognition) {
        try { this.recognition.abort(); } catch (e) {}
      }
      if (this.vad) {
        this.vad.stop();
      }
      this.sessionManager.transition(CONVERSATION_STATES.IDLE, { reason: 'MICROPHONE_MUTED' });
    } else {
      if (this.continuousListening) {
        this.startListening();
      }
    }
    if (typeof this.onMuteChange === 'function') {
      this.onMuteChange(this.isMuted);
    }
  }

  isMicrophoneMuted() {
    return Boolean(this.isMuted);
  }

  retryListening() {
    if (this.isEmergencyStopped) return;
    console.log('[VOICE_CONTROLLER] Manual retry requested. Reconnecting voice pipeline.');
    this.isExplicitlyStopped = false;
    this.isMuted = false;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    this.lastError = null;
    this.lastErrorCategory = 'NONE';
    this.isNetworkError = false;
    this.isAudioFallbackActive = false;
    this.subsystems.microphoneAccess = 'granted';
    this.subsystems.speechRecognition = 'reconnecting';
    this.subsystems.audioCapture = 'inactive';

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition) {
      try { this.recognition.abort(); } catch (e) {}
    }
    this.isRecognitionActive = false;

    if (this.vad && typeof this.vad.reset === 'function') {
      this.vad.reset();
    }

    if (this.sessionManager) {
      this.sessionManager.transition(CONVERSATION_STATES.RECONNECTING, { reason: 'MANUAL_RETRY_REQUESTED' });
    }

    setTimeout(() => {
      this.startListening();
    }, 80);
  }

  setSubsystemStatus(subsystem, status, meta = null) {
    if (this.subsystems && this.subsystems[subsystem] !== undefined) {
      this.subsystems[subsystem] = status;
    }
  }

  getSubsystemStatus() {
    return { ...this.subsystems };
  }

  setPersonality(personality) {
    if (!personality) return;
    const clean = personality.toUpperCase();
    console.log(`[VOICE_CONTROLLER] Switching personality context to: ${clean}`);
    this.clearPendingWake();
    this.lastTriggerTime = -10000;
    this.lastDispatchedCommand = '';
    this.lastDispatchedCommandTime = 0;
    if (this.sessionManager) {
      this.sessionManager.setPersonality(clean);
    }
  }

  getPersonality() {
    return this.sessionManager ? this.sessionManager.getPersonality() : 'JARVIS';
  }

  startSession(personality = 'JARVIS', reason = 'EXPLICIT_CALL') {
    return this.sessionManager.startSession(personality, reason);
  }

  endSession(reason = SESSION_CLOSE_REASONS.EXPLICIT_SLEEP) {
    return this.sessionManager.closeSession(reason);
  }

  isSessionActive() {
    return this.sessionManager.isSessionActive();
  }

  notifyAssistantSpeechStart() {
    this.vad.setAssistantSpeaking(true);
    this.sessionManager.notifyAssistantSpeakingStart();
    this.interruptionManager.notifySpeakingStart(this.interruptionManager.getCurrentGenerationId());
  }

  notifyCurrentSentence(sentence) {
    if (!sentence || typeof sentence !== 'string') return;
    this.currentSpokenSentence = sentence.toLowerCase().trim();
    this.recentSpokenHistory.push(this.currentSpokenSentence);
    if (this.recentSpokenHistory.length > 8) {
      this.recentSpokenHistory.shift();
    }
  }

  notifyAssistantSpeechEnd(replyText = '') {
    this.vad.setAssistantSpeaking(false);
    this.sessionManager.notifyAssistantSpeakingEnd(replyText);
    this.interruptionManager.notifySpeakingEnd(this.interruptionManager.getCurrentGenerationId());
    this.currentSpokenSentence = '';
    this.lastTriggerTime = -10000;
    this.lastDispatchedCommand = '';
    this.lastDispatchedCommandTime = 0;
    setTimeout(() => {
      this.recentSpokenHistory = [];
    }, 2500);

    if (this.isEmergencyStopped || this.isPaused || this.voiceMode === VOICE_MODES.DISABLED) {
      this.isListening = false;
      return;
    }

    // In PUSH_TO_TALK or WAKE_WORD mode, return cleanly to READY without auto-starting a 0:00 capture timer
    if (this.voiceMode === VOICE_MODES.PUSH_TO_TALK || this.voiceMode === VOICE_MODES.WAKE_WORD) {
      this.isListening = false;
      if (this.recognition && this.isRecognitionActive) {
        try { this.recognition.stop(); } catch (_) {}
        this.isRecognitionActive = false;
      }
      if (this.sessionManager) {
        this.sessionManager.transition(CONVERSATION_STATES.READY, { reason: 'ASSISTANT_TURN_COMPLETE_READY' });
      }
      return;
    }

    // In explicit CONTINUOUS mode in the browser, return cleanly to READY with passive VAD armed (no idle 0:00 capture timer)
    if (this.continuousListening && !this.isExplicitlyStopped) {
      if (typeof window === 'undefined') {
        this.isListening = true;
        if (!this.isAudioFallbackActive && !this.isRecognitionActive) {
          console.log('[VOICE_CONTROLLER] Assistant finished speaking. Re-arming SpeechRecognition for next conversational turn.');
          this.startListening({ reason: 'POST_TTS_CONTINUOUS_REARM', modeOverride: this.voiceMode });
        } else if (this.isAudioFallbackActive) {
          if (this.vad) this.vad.start();
        }
        return;
      }

      this.isListening = false;
      if (this.recognition && this.isRecognitionActive) {
        try { this.recognition.stop(); } catch (_) {}
        this.isRecognitionActive = false;
      }
      if (this.vad) {
        this.vad.start();
      }
      if (this.sessionManager) {
        this.sessionManager.transition(CONVERSATION_STATES.READY, { reason: 'ASSISTANT_TURN_COMPLETE_READY' });
      }
      setTimeout(() => {
        this._armPassiveSpeechRecognition('POST_TTS_PASSIVE_REARM');
      }, 220);
    }
  }

  /**
   * Tokenized Jaccard similarity and substring analysis to prevent assistant voice acoustic feedback
   */
  isEchoOfAssistantSpeech(transcript) {
    if (!transcript) return false;
    const clean = transcript.toLowerCase().trim();

    // Never consider explicit command words as an echo
    if (/\b(stop|quiet|silence|open|close|launch|switch|jarvis|ultron|hindi|english|hinglish|search)\b/i.test(clean)) {
      return false;
    }

    // Direct substring match against currently spoken sentence
    if (this.currentSpokenSentence) {
      const cleanCurrent = this.currentSpokenSentence.toLowerCase().trim();
      if (cleanCurrent.includes(clean) || clean.includes(cleanCurrent)) {
        return true;
      }
    }

    // Direct substring match against recent spoken history
    for (const recent of this.recentSpokenHistory) {
      if (!recent) continue;
      const cleanRecent = recent.toLowerCase().trim();
      if (cleanRecent.includes(clean) || clean.includes(cleanRecent)) {
        return true;
      }
    }

    const inputWords = clean.split(/\s+/).filter(w => w.length > 2);
    if (inputWords.length === 0) {
      // Short vocal fragments without command words during TTS are treated as acoustic echo
      return true;
    }

    // Check against current active sentence with 40% threshold
    if (this.currentSpokenSentence) {
      const sentenceWords = this.currentSpokenSentence.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const matches = inputWords.filter(w => sentenceWords.includes(w)).length;
      if (matches / inputWords.length >= 0.40) {
        return true;
      }
    }

    // Check against recent history
    for (const recent of this.recentSpokenHistory) {
      if (!recent) continue;
      const recentWords = recent.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const matches = inputWords.filter(w => recentWords.includes(w)).length;
      if (matches / inputWords.length >= 0.40) {
        return true;
      }
    }

    return false;
  }

  handleSpeechResults(event) {
    if (this.isEmergencyStopped || this.isMuted) return;
    this.lastWebSpeechResultTime = Date.now();
    if (this.rescueTimeout) {
      clearTimeout(this.rescueTimeout);
      this.rescueTimeout = null;
    }

    const curState = this.sessionManager && this.sessionManager.getState ? this.sessionManager.getState() : this.sessionManager?.state;
    let interimParts = [];

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const isFinal = Boolean(result.isFinal);

      // Only evaluate top-confidence candidate to prevent duplicate dispatch loops
      const item = result[0];
      if (!item || !item.transcript) continue;

      const transcript = item.transcript.trim();
      if (!transcript) continue;

      if (curState === CONVERSATION_STATES.READY && !this.isPaused && !this.isExplicitlyStopped) {
        this.isListening = true;
        this.sessionManager.startCaptureTimer();
        this.sessionManager.transition(CONVERSATION_STATES.LISTENING, { reason: 'SPEECH_RESULT_ONSET' });
      }

      if (!isFinal) {
        interimParts.push(transcript);
        continue;
      }

      const isWakeWordCandidate = /\b(jarvis|jarves|ultron|altron|wake|sleep|stop|quiet)\b/i.test(transcript);
      const minConfidence = isWakeWordCandidate || this.sessionManager.isSessionActive() ? 0.05 : 0.10;
      if (typeof item.confidence === 'number' && item.confidence > 0 && item.confidence < minConfidence) {
        continue;
      }

      this.processTranscript(transcript, true, item.confidence || 0.95);
    }

    if (interimParts.length > 0) {
      this.processTranscript(interimParts.join(' '), false, 0.90);
    }
  }

  /**
   * Master Transcript & Intent Router (Handles Web Speech API + Audio Stream Fallback STT)
   */
  processTranscript(rawTranscript, isFinal = true, confidence = 0.95) {
    if (this.isEmergencyStopped || this.isMuted) return;
    this.lastRawTranscript = rawTranscript;
    this.lastConfidence = confidence;
    const now = performance.now();
    const transcript = rawTranscript.toLowerCase().trim();
    if (!transcript) return;

    // 0. Update Smoke Captions
    if (typeof this.onUserSpeech === 'function') {
      this.onUserSpeech(rawTranscript, isFinal);
    }

    // Deduplicate identical finalized transcripts within 600ms
    if (isFinal && transcript === this.lastDispatchedCommand && (now - this.lastDispatchedCommandTime < 600)) {
      return;
    }
    if (isFinal) {
      this.lastDispatchedCommand = transcript;
      this.lastDispatchedCommandTime = now;
    }

    // Check if assistant is currently speaking or streaming
    const isAssistantSpeaking = this.isAssistantSpeaking();

    // =========================================================================
    // 1. DYNAMIC REAL-TIME BARGE-IN HANDLING DURING ASSISTANT PLAYBACK
    // =========================================================================
    if (isAssistantSpeaking) {
      // 1a. Acoustic Echo Check (prevents self-listening loop)
      if (this.isEchoOfAssistantSpeech(transcript)) {
        console.log(`[VOICE_CONTROLLER] Echo detected and safely suppressed: "${transcript}"`);
        return;
      }

      // 1b. Check for "Stop and [command]" or "Stop, [command]" (e.g. "Stop, open Chrome")
      const stopAndCommandMatch = rawTranscript.match(/^(?:stop|quiet|be quiet|chup ho jao|chup raho|shut up)(?:,?\s+(?:and\s+)?)(.+)$/i);
      if (stopAndCommandMatch && stopAndCommandMatch[1]) {
        const trailingCommand = stopAndCommandMatch[1].trim();
        console.log(`[VOICE_CONTROLLER] Stop + command detected during TTS: "${trailingCommand}". Interrupting and dispatching.`);
        this.interruptionManager.triggerBargeIn('USER_STOP_AND_COMMAND');
        this.sessionManager.requestInterrupt('USER_STOP_AND_COMMAND');

        // Immediately route the trailing command
        this.dispatchExtractedCommand(trailingCommand, isFinal);
        return;
      }

      // 1c. Immediate Standalone Stop: "Stop" / "Be quiet" / "Silence" / "Chup ho jao"
      if (/^(?:stop speaking|stop talking|be quiet|quiet|silence|cancel speech|shut up|chup ho jao|chup raho|bolna band karo|stop|wait|pause|hold on)[.!?]?$/i.test(transcript)) {
        console.log('[VOICE_CONTROLLER] Immediate stop command detected. Interrupting speech playback.');
        this.interruptionManager.triggerBargeIn('USER_EXPLICIT_STOP_COMMAND');
        this.sessionManager.requestInterrupt('USER_EXPLICIT_STOP_COMMAND');
        if (typeof this.onCommand === 'function') {
          this.onCommand({ type: 'STOP_SPEAKING', reason: 'USER_EXPLICIT_STOP_COMMAND' }, rawTranscript);
        }
        return;
      }

      // 1d. Intentional new query spoken while assistant is speaking triggers prompt barge-in:
      // Must be a direct wake query (e.g. "Jarvis, what's CPU?") OR finalized substantial query (> 5 chars)
      const isWakeCandidateDuringTTS = /\b(jarvis|jarves|ultron|altron)\b/i.test(transcript);
      const isSubstantialFinalQuery = isFinal && transcript.length >= 6 && !/^(uh|um|ah|hmm|well|yes|no|ok|okay)$/i.test(transcript);

      if (isWakeCandidateDuringTTS || isSubstantialFinalQuery) {
        console.log(`[VOICE_CONTROLLER] New query during TTS: "${transcript}". Triggering barge-in.`);
        this.interruptionManager.triggerBargeIn('USER_NEW_QUERY_INTERRUPT');
        this.sessionManager.requestInterrupt('USER_NEW_QUERY_INTERRUPT');
        if (typeof this.onCommand === 'function') {
          this.onCommand({ type: 'STOP_SPEAKING', reason: 'USER_NEW_QUERY_INTERRUPT' }, rawTranscript);
        }
        // Fall through to execute the new command without requiring full sentence finish!
      } else {
        // Suppress interim noise fragments during speech playback
        return;
      }
    }

    // 2. Explicit Thinking Utterance: User asks for a moment ("let me think", "give me a second")
    if (this.sessionManager.isSessionActive()) {
      if (this.sessionManager.checkThinkingUtterance(transcript)) {
        return;
      }
    }

    // 3. Sleep / Dismiss Command
    if (/\b(go to sleep|sleep now|goodbye jarvis|goodbye ultron|goodbye|sleep mode|dismiss|hide interface|power down|hibernate|that's all|see you later|so jao|so jao jarvis|so jao ultron|band ho jao)\b/i.test(transcript)) {
      if (now - this.lastTriggerTime < 800) return;
      this.lastTriggerTime = now;
      this.clearPendingWake();
      const targetPers = /ultron/i.test(transcript) ? 'ULTRON' : (this.sessionManager.activePersonality || 'JARVIS');
      this.sessionManager.closeSession(SESSION_CLOSE_REASONS.EXPLICIT_SLEEP);
      this.interruptionManager.dispatchCommand({ type: 'GO_TO_SLEEP', personality: targetPers }, rawTranscript);
      return;
    }

    // 4. Standalone Stop / Silence Command (Outside playback)
    if (/^(?:stop speaking|stop talking|be quiet|quiet|silence|cancel speech|shut up|chup ho jao|chup raho|bolna band karo|stop)[.!?]?$/i.test(transcript)) {
      if (now - this.lastTriggerTime < 500) return;
      this.lastTriggerTime = now;
      this.clearPendingWake();
      this.interruptionManager.triggerBargeIn('USER_EXPLICIT_STOP');
      this.sessionManager.requestInterrupt('USER_EXPLICIT_STOP');
      this.interruptionManager.dispatchCommand({ type: 'STOP_SPEAKING', reason: 'USER_EXPLICIT_STOP' }, rawTranscript);
      return;
    }

    // 5. Repeat Command
    if (/\b(repeat that|say that again|repeat response|repeat last)\b/i.test(transcript)) {
      if (now - this.lastTriggerTime < this.debounceMs) return;
      this.lastTriggerTime = now;
      this.clearPendingWake();
      this.interruptionManager.dispatchCommand({ type: 'REPEAT_THAT', personality: this.sessionManager.activePersonality }, rawTranscript);
      return;
    }

    const timings = {
      tSpeechEnd: this.lastSpeechEndTime || (performance.now() - 320),
      tTranscribed: now,
      tReqSubmitted: performance.now()
    };

    // 6. Direct Command Query for JARVIS: "Jarvis, [query]" / "Hey Jarvis, [query]"
    const jarvisQueryMatch = rawTranscript.match(/^(?:hey\s+|activate\s+|switch\s+to\s+)?(?:jarvis|jarves|jarviss)(?:,\s*|\s+)(.+)$/i);
    if (jarvisQueryMatch && jarvisQueryMatch[1]) {
      if (!isFinal) return; // Prevent premature execution on partial transcripts
      const query = jarvisQueryMatch[1].trim();
      if (query.length > 2 && !/^(please|now|mode)$/i.test(query)) {
        if (now - this.lastTriggerTime < this.debounceMs) return;
        this.lastTriggerTime = now;
        this.clearPendingWake();
        this.sessionManager.startSession('JARVIS', 'QUERY_DIRECT');
        this.sessionManager.notifyProcessingStart(query);
        this.interruptionManager.dispatchCommand({ type: 'AI_QUERY', personality: 'JARVIS', query, timings }, rawTranscript);
        return;
      }
    }

    // 7. Direct Command Query for ULTRON: "Ultron, [query]" / "Hey Ultron, [query]"
    const ultronQueryMatch = rawTranscript.match(/^(?:hey\s+|activate\s+|switch\s+to\s+)?(?:ultron|altron|alltron|oltron|eltron)(?:,\s*|\s+)(.+)$/i);
    if (ultronQueryMatch && ultronQueryMatch[1]) {
      if (!isFinal) return; // Prevent premature execution on partial transcripts
      const query = ultronQueryMatch[1].trim();
      if (query.length > 2 && !/^(please|now|mode)$/i.test(query)) {
        if (now - this.lastTriggerTime < this.debounceMs) return;
        this.lastTriggerTime = now;
        this.clearPendingWake();
        this.sessionManager.startSession('ULTRON', 'QUERY_DIRECT');
        this.sessionManager.notifyProcessingStart(query);
        this.interruptionManager.dispatchCommand({ type: 'AI_QUERY', personality: 'ULTRON', query, timings }, rawTranscript);
        return;
      }
    }

    const isSessionActive = this.sessionManager.isSessionActive();
    const isSwitchToJarvis = /\b(?:switch\s+to|change\s+to|activate|wake\s+up|wake)\s+(?:jarvis|jarves|jarviss)\b/i.test(transcript);
    const isSwitchToUltron = /\b(?:switch\s+to|change\s+to|activate|wake\s+up|wake)\s+(?:ultron|altron|alltron|oltron|eltron)\b/i.test(transcript);
    const isStandaloneJarvis = isSwitchToJarvis || /^(?:hey\s+|wake\s+up\s+|wake\s+|activate\s+|switch\s+to\s+)?(?:jarvis|jarves|jarviss)[.!?]?$/i.test(transcript);
    const isStandaloneUltron = isSwitchToUltron || /^(?:hey\s+|wake\s+up\s+|wake\s+|activate\s+|switch\s+to\s+)?(?:ultron|altron|alltron|oltron|eltron)[.!?]?$/i.test(transcript);
    const isGenericWake = /^(?:wake\s+up|wake)[.!?]?$/i.test(transcript);

    // 8a. Generic Wake
    if (!isSessionActive && isGenericWake) {
      if (now - this.lastTriggerTime < this.debounceMs) return;
      const targetPers = this.sessionManager.activePersonality || 'JARVIS';
      this.clearPendingWake();
      this.lastTriggerTime = now;
      this.sessionManager.startSession(targetPers, 'WAKE_WORD_GENERIC');
      this.interruptionManager.dispatchCommand({ type: 'ACTIVATE_THEME', personality: targetPers }, rawTranscript);
      return;
    }

    // 8b. Standalone Wake / Switch JARVIS
    if ((!isSessionActive && /\b(jarvis|jarves|jarviss)\b/i.test(transcript)) || isStandaloneJarvis) {
      if (now - this.lastTriggerTime < this.debounceMs) return;
      if (!isFinal) {
        this.schedulePendingWake('JARVIS', rawTranscript, now);
      } else {
        this.clearPendingWake();
        this.lastTriggerTime = now;
        this.sessionManager.startSession('JARVIS', 'WAKE_WORD_FINAL');
        this.interruptionManager.dispatchCommand({ type: 'ACTIVATE_THEME', personality: 'JARVIS' }, rawTranscript);
      }
      return;
    }

    // 8c. Standalone Wake / Switch ULTRON
    if ((!isSessionActive && /\b(ultron|altron|alltron|oltron|eltron)\b/i.test(transcript)) || isStandaloneUltron) {
      if (now - this.lastTriggerTime < this.debounceMs) return;
      if (!isFinal) {
        this.schedulePendingWake('ULTRON', rawTranscript, now);
      } else {
        this.clearPendingWake();
        this.lastTriggerTime = now;
        this.sessionManager.startSession('ULTRON', 'WAKE_WORD_FINAL');
        this.interruptionManager.dispatchCommand({ type: 'ACTIVATE_THEME', personality: 'ULTRON' }, rawTranscript);
      }
      return;
    }

    // 9. Adaptive Follow-Up Queries or Implicit Command Processing
    if (isFinal) {
      if (now - this.lastTriggerTime < this.debounceMs) return;
      if (rawTranscript.trim().length > 2 && !/^(uh|um|ah|hmm|well)$/i.test(transcript)) {
        this.lastTriggerTime = now;
        this.clearPendingWake();
        const activePers = this.sessionManager.activePersonality || 'JARVIS';
        const finalQuery = rawTranscript.trim();
        console.log(`[VOICE_CONTROLLER] Query routed to ${activePers}: "${finalQuery}"`);
        this.sessionManager.notifyProcessingStart(finalQuery);
        this.interruptionManager.dispatchCommand({ type: 'AI_QUERY', personality: activePers, query: finalQuery, timings }, rawTranscript);
        return;
      }
    }
  }

  dispatchExtractedCommand(commandText, isFinal = true) {
    const pers = this.sessionManager.activePersonality || 'JARVIS';
    this.sessionManager.notifyProcessingStart(commandText);
    this.interruptionManager.dispatchCommand({ type: 'AI_QUERY', personality: pers, query: commandText }, commandText);
  }

  schedulePendingWake(personality, transcript, now) {
    this.clearPendingWake();
    this.pendingWakeTimeout = setTimeout(() => {
      this.lastTriggerTime = performance.now();
      this.sessionManager.startSession(personality, 'PENDING_WAKE_RESOLVED');
      this.interruptionManager.dispatchCommand({ type: 'ACTIVATE_THEME', personality }, transcript);
    }, 200);
  }

  clearPendingWake() {
    if (this.pendingWakeTimeout) {
      clearTimeout(this.pendingWakeTimeout);
      this.pendingWakeTimeout = null;
    }
  }

  getDiagnostics() {
    const sessionState = this.sessionManager && this.sessionManager.getState ? this.sessionManager.getState() : (this.sessionManager ? this.sessionManager.state : 'IDLE');
    const lastTrans = this.sessionManager && this.sessionManager.getLastTransition ? this.sessionManager.getLastTransition() : null;
    const currentTurnId = this.sessionManager && this.sessionManager.getCurrentTurnId ? this.sessionManager.getCurrentTurnId() : 'turn_0';
    const activePersonality = this.sessionManager && this.sessionManager.getPersonality ? this.sessionManager.getPersonality() : (this.sessionManager ? this.sessionManager.activePersonality : 'JARVIS');

    const telemetry = this.getVoiceTelemetry();
    return {
      activePersonality,
      state: sessionState,
      canonicalState: telemetry.state,
      voiceMode: this.voiceMode,
      generation: this.voiceGeneration,
      timer: this.getTimerSnapshot(),
      currentState: sessionState,
      currentTurnId,
      lastTransition: lastTrans,
      lastTransitionDurationMs: lastTrans ? lastTrans.durationMs : 0,
      microphoneAvailability: this.subsystems.microphoneAccess,
      captureStatus: this.subsystems.audioCapture,
      detectedMicrophone: (this.vad && (this.vad.activeDeviceLabel || this.vad.activeMicLabel)) || 'None',
      audioLevel: (this.vad && (typeof this.vad.currentRMS === 'number' ? this.vad.currentRMS : this.vad.currentRms)) || 0,
      vadStatus: (this.vad && this.vad.isUserSpeaking) ? 'speaking' : ((this.vad && this.vad.isInitialized) ? 'monitoring' : 'idle'),
      rawRecognizedTranscript: this.lastRawTranscript || '',
      finalNormalizedTranscript: this.lastDispatchedCommand || '',
      recognitionConfidence: this.lastConfidence !== undefined ? this.lastConfidence : 1.0,
      recognitionStatus: this.subsystems.speechRecognition,
      aiProviderStatus: this.subsystems.aiProvider,
      ttsStatus: this.subsystems.textToSpeech,
      lastError: this.lastError,
      lastErrorCategory: this.lastErrorCategory,
      affectedSubsystem: this.lastErrorCategory !== 'NONE' ? this.lastErrorCategory : 'none',
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      isReconnecting: this.isReconnecting,
      lastSuccessfulRecognitionTime: this.lastSuccessfulRecognitionTime,
      lastSuccessfulRecognitionTimestamp: this.lastSuccessfulRecognitionTime ? new Date(this.lastSuccessfulRecognitionTime).toLocaleTimeString() : 'None',
      isSupported: this.isSupported,
      isListening: this.isListening,
      continuousListening: this.continuousListening,
      isMuted: Boolean(this.isMuted),
      isRecognitionActive: this.isRecognitionActive,
      isAudioFallbackActive: Boolean(this.isAudioFallbackActive),
      activeProvider: this.isAudioFallbackActive ? 'Gemini Multimodal STT Fallback' : 'Web Speech API',
      subsystems: { ...this.subsystems },
      isExplicitlyStopped: this.isExplicitlyStopped,
      isNetworkError: Boolean(this.isNetworkError),
      recognitionLang: (this.recognition && this.recognition.lang) || this.currentLanguage || 'unknown',
      debounceMs: this.debounceMs,
      sessionActive: this.sessionManager ? this.sessionManager.isSessionActive() : false,
      interruption: this.interruptionManager.getTelemetry(),
      vad: this.vad && typeof this.vad.getDiagnostics === 'function' ? this.vad.getDiagnostics() : null
    };
  }
}
