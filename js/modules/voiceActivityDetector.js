/**
 * VISION AI — Voice Activity Detection (VAD) Service
 * Real-time audio energy and spectral analysis using Web Audio API.
 * Distinguishes ambient room noise, user speech onset, speech continuation,
 * pauses, speech completion, and dynamic interruptions during TTS playback.
 * Automatically falls back to speech-recognition events if audio device is unavailable.
 */

import { CONFIG } from '../config.js';

export class VoiceActivityDetector {
  constructor(options = {}) {
    this.config = Object.assign({}, CONFIG.session, options);

    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.sourceNode = null;
    this.speechFilter = null;
    this.animFrameId = null;

    // VAD Status & States
    this.isEnabled = this.config.vadEnabled !== false;
    this.isInitialized = false;
    this.isListening = false;
    this.isFallbackMode = false;
    this.isUserSpeaking = false;
    this.isAssistantSpeaking = false;

    // Track Settings & Telemetry
    this.appliedTrackSettings = null;
    this.appliedTrackCapabilities = null;
    this.activeDeviceLabel = 'Unknown Device';

    // Energy & Noise Floor Tracking (Calibrated against real hardware turn-on transients & ambient hum)
    this.noiseFloor = 0.006;
    this.warmupUntilMs = 0;
    this.currentRMS = 0;
    this.currentCentroid = 0;
    this.speechStartTime = 0;
    this.lastSpeechTime = 0;
    this.consecutiveSpeechFrames = 0;

    // Debounce Hangover Timer
    this.silenceTimer = null;
    this.speechHangoverMs = this.config.speechEndDebounceMs || 400;

    // Event Callbacks
    this.onSpeechStart = options.onSpeechStart || null;
    this.onSpeechContinue = options.onSpeechContinue || null;
    this.onSpeechEnd = options.onSpeechEnd || null;
    this.onUserInterrupt = options.onUserInterrupt || null;
    this.onNoiseCalibrated = options.onNoiseCalibrated || null;
    this.onError = options.onError || null;
    this.onDeviceChange = options.onDeviceChange || null;

    this._deviceChangeTimer = null;
    this._onMediaDeviceChange = this._handleMediaDeviceChange.bind(this);
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
      navigator.mediaDevices.addEventListener('devicechange', this._onMediaDeviceChange);
    }
  }

  /**
   * Non-capturing hardware/permission check for startup initialization (zero getUserMedia calls).
   */
  async probeHardware() {
    const AudioCtx = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext) : null;
    const hasMedia = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    let audioInputCount = 0;
    let deviceLabels = [];
    let permissionState = 'prompt';

    if (typeof navigator !== 'undefined' && navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        const perm = await navigator.permissions.query({ name: 'microphone' });
        if (perm && perm.state) permissionState = perm.state;
      } catch (_) {}
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        audioInputCount = inputs.length;
        deviceLabels = inputs.map(d => d.label || d.deviceId || 'Audio Input');
      } catch (_) {}
    }

    return {
      supported: Boolean(AudioCtx && hasMedia),
      audioInputCount,
      deviceLabels,
      permissionState
    };
  }

  _handleMediaDeviceChange() {
    if (this._deviceChangeTimer) {
      clearTimeout(this._deviceChangeTimer);
    }
    this._deviceChangeTimer = setTimeout(async () => {
      this._deviceChangeTimer = null;
      const probe = await this.probeHardware().catch(() => ({ supported: true, audioInputCount: 0, deviceLabels: [], permissionState: 'unknown' }));
      if (typeof this.onDeviceChange === 'function') {
        this.onDeviceChange(probe);
      }
    }, 350);
  }

  /**
   * Initializes audio capture with optimized speech constraints,
   * inspects applied hardware track settings, and routes through a speech-band filter.
   */
  async init() {
    if (!this.isEnabled) {
      console.log('[VAD] VAD is disabled in configuration. Operating in fallback mode.');
      this.isFallbackMode = true;
      return true;
    }

    if (this.isInitialized && this.mediaStream && this.mediaStream.getAudioTracks().some(t => t.readyState === 'live')) {
      return true;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        if (typeof window === 'undefined') {
          this.isFallbackMode = true;
          return false;
        }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('[VAD] Web Audio API or getUserMedia not supported. Falling back to speech-recognition events.');
          this.isFallbackMode = true;
          return false;
        }

        if (!this.audioContext || this.audioContext.state === 'closed') {
          this.audioContext = new AudioCtx();
        }

        if (this.audioContext.state === 'suspended') {
          const enableAudio = () => this.resumeContext();
          window.addEventListener('click', enableAudio, { once: true, passive: true });
          window.addEventListener('keydown', enableAudio, { once: true, passive: true });
        }

        // Reuse healthy live stream if present; otherwise acquire fresh stream
        const liveTrack = this.mediaStream && this.mediaStream.getAudioTracks().find(t => t.readyState === 'live');
        if (!liveTrack) {
          if (this.mediaStream) {
            try { this.mediaStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            this.mediaStream = null;
          }
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: { ideal: 48000, min: 16000 }
            }
          });
        }

        const audioTrack = this.mediaStream.getAudioTracks()[0];
        if (audioTrack) {
          this.appliedTrackSettings = typeof audioTrack.getSettings === 'function' ? audioTrack.getSettings() : null;
          this.appliedTrackCapabilities = typeof audioTrack.getCapabilities === 'function' ? audioTrack.getCapabilities() : null;
          this.activeDeviceLabel = audioTrack.label || 'Default System Microphone';
          console.log(`[VAD] Active Microphone: "${this.activeDeviceLabel}"`, this.appliedTrackSettings || '');

          audioTrack.onended = () => {
            console.warn('[VAD] Microphone track ended unexpectedly (device disconnected).');
            this.isInitialized = false;
            this.mediaStream = null;
            if (typeof this.onError === 'function') {
              this.onError(new Error('Microphone audio track ended'));
            }
          };
        }

        if (!this.sourceNode) {
          this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
        }
        if (!this.analyser) {
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 512;
          this.analyser.smoothingTimeConstant = 0.20;
        }

        // Human Vocal Bandpass Filter (boosts speech SNR for soft/whispered voices ~90Hz to 3600Hz)
        if (this.config.quietSensitivityBoost !== false && typeof this.audioContext.createBiquadFilter === 'function') {
          try {
            if (!this.speechFilter) {
              this.speechFilter = this.audioContext.createBiquadFilter();
              this.speechFilter.type = 'bandpass';
              this.speechFilter.frequency.setValueAtTime(1250, this.audioContext.currentTime);
              this.speechFilter.Q.setValueAtTime(0.55, this.audioContext.currentTime);
            }
            this.sourceNode.connect(this.speechFilter);
            this.speechFilter.connect(this.analyser);
          } catch (filterErr) {
            this.sourceNode.connect(this.analyser);
          }
        } else {
          this.sourceNode.connect(this.analyser);
        }

        this.isInitialized = true;
        this.isFallbackMode = false;
        this.lastError = null;

        console.log('[VAD] Audio capture, vocal filter, and spectral analyzer initialized successfully.');
        if (this.isListening && !this.animFrameId) {
          this.startAnalysisLoop();
        }
        return true;
      } catch (err) {
        this.lastError = {
          name: err?.name || 'Error',
          message: err?.message || 'Microphone access failed',
          timestamp: Date.now()
        };
        this.isInitialized = false;
        this.isFallbackMode = true;
        console.warn('[VAD] Initialization failed or microphone access denied:', err.name, err.message);
        if (typeof this.onError === 'function') {
          this.onError(err);
        }
        return false;
      }
    })().finally(() => {
      this.initPromise = null;
    });

    return this.initPromise;
  }

  resumeContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  /**
   * Sets assistant speech state for self-speech echo suppression
   */
  setAssistantSpeaking(isSpeaking) {
    this.isAssistantSpeaking = Boolean(isSpeaking);
  }

  start() {
    this.isListening = true;
    this.consecutiveSpeechFrames = 0;
    this.warmupUntilMs = Date.now() + 700;
    this.resumeContext();
    if (!this.isInitialized) {
      return this.init();
    }
    if (this.isInitialized && !this.isFallbackMode && !this.animFrameId) {
      this.startAnalysisLoop();
    }
    return Promise.resolve(this.isInitialized);
  }

  stop() {
    this.isListening = false;
    this.isUserSpeaking = false;
    this.consecutiveSpeechFrames = 0;
    if (this.animFrameId) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.animFrameId);
      } else {
        clearTimeout(this.animFrameId);
      }
      this.animFrameId = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Releases all active hardware microphone tracks cleanly (for DISABLED / PAUSED / ERROR / E-STOP).
   */
  releaseMicrophone(reason = 'RELEASED') {
    this.stop();
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }
    if (this.speechFilter) {
      try { this.speechFilter.disconnect(); } catch (e) {}
      this.speechFilter = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (e) {}
      this.analyser = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(track => {
          try { track.onended = null; } catch (_) {}
          try { track.stop(); } catch (_) {}
        });
      } catch (e) {}
      this.mediaStream = null;
    }
    this.isInitialized = false;
    this.isFallbackMode = false;
    this.activeDeviceLabel = 'None';
    this.appliedTrackSettings = null;
    this.currentRMS = 0;
    console.log(`[VAD] Hardware microphone released (${reason}).`);
  }

  /**
   * Continuous 60fps audio energy and spectral analysis loop (runs ONLY while actively listening)
   */
  startAnalysisLoop() {
    if (!this.analyser || !this.isListening || !this.isInitialized || this.isFallbackMode) {
      this.animFrameId = null;
      return;
    }
    if (typeof this.analyser.getFloatTimeDomainData !== 'function' || typeof this.analyser.getByteFrequencyData !== 'function') {
      this.isFallbackMode = true;
      this.animFrameId = null;
      return;
    }
    if (this.animFrameId) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.animFrameId);
      } else {
        clearTimeout(this.animFrameId);
      }
      this.animFrameId = null;
    }
    const timeBuffer = new Float32Array(this.analyser.fftSize);
    const freqBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    const scheduleNext = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : ((fn) => setTimeout(fn, 16));

    const analyze = () => {
      if (!this.isListening || !this.isInitialized || this.isFallbackMode || !this.analyser) {
        this.animFrameId = null;
        return;
      }
      this.animFrameId = scheduleNext(analyze);

      // 1. Calculate Root-Mean-Square (RMS) Energy
      this.analyser.getFloatTimeDomainData(timeBuffer);
      let sumSq = 0;
      for (let i = 0; i < timeBuffer.length; i++) {
        sumSq += timeBuffer[i] * timeBuffer[i];
      }
      const rms = Math.sqrt(sumSq / timeBuffer.length);
      this.currentRMS = rms;

      // 2. Calculate Spectral Centroid (identifies vocal frequency formants vs low-freq fan rumble)
      this.analyser.getByteFrequencyData(freqBuffer);
      let num = 0;
      let den = 0;
      const binWidth = (this.audioContext.sampleRate / 2) / freqBuffer.length;
      for (let i = 0; i < freqBuffer.length; i++) {
        const freq = i * binWidth;
        const mag = freqBuffer[i];
        num += freq * mag;
        den += mag;
      }
      const centroid = den > 0 ? num / den : 0;
      this.currentCentroid = centroid;

      // 3. Hardware Warm-Up & Dynamic Asymmetric Background Noise Floor Calibration
      const nowEpoch = Date.now();
      if (this.warmupUntilMs && nowEpoch < this.warmupUntilMs) {
        this.noiseFloor = Math.min(0.035, Math.max(this.noiseFloor, rms * 1.15));
        this.consecutiveSpeechFrames = 0;
        return;
      }

      const noiseAdaptRate = this.config.noiseFloorAdaptRate || 0.04;
      if (!this.isUserSpeaking && !this.isAssistantSpeaking) {
        if (rms < this.noiseFloor) {
          // Rapid downward relaxation towards true ambient silence
          this.noiseFloor = (1 - noiseAdaptRate * 1.5) * this.noiseFloor + (noiseAdaptRate * 1.5) * Math.max(0.002, rms);
        } else {
          // Slow upward tracking, capped to prevent speech from pushing floor out of range
          this.noiseFloor = Math.min(0.035, (1 - noiseAdaptRate * 0.4) * this.noiseFloor + (noiseAdaptRate * 0.4) * rms);
        }
      }

      // 4. Threshold & Human Speech Discrimination (rejects laptop room hum & mic turn-on transients)
      const baseThreshold = this.config.energyThreshold || 0.018;
      const dynamicThreshold = Math.min(0.06, Math.max(baseThreshold, this.noiseFloor * 2.2 + 0.006));
      const isVoiceEnergy = rms > dynamicThreshold;
      const minHz = this.config.spectralCentroidMinHz || 90;
      const maxHz = this.config.spectralCentroidMaxHz || 3800;
      const isSpeechFrequency = centroid >= minHz && centroid <= maxHz;
      const isSpeechCandidate = isVoiceEnergy && isSpeechFrequency;

      const now = performance.now();

      // 5. Echo-gating / TTS Interruption Detection
      if (this.isAssistantSpeaking) {
        // Significantly higher acoustic contrast threshold to distinguish intentional human speech from laptop speaker audio
        const bargeInThreshold = Math.max(0.065, dynamicThreshold * 3.5);
        if (rms > bargeInThreshold && isSpeechFrequency) {
          this.consecutiveSpeechFrames++;
          if (this.consecutiveSpeechFrames >= 8 && (now - this.lastSpeechTime > 250)) {
            this.lastSpeechTime = now;
            console.log(`[VAD] Dynamic Voice Interruption detected (RMS: ${rms.toFixed(4)}, BargeThreshold: ${bargeInThreshold.toFixed(4)})`);
            if (typeof this.onUserInterrupt === 'function') {
              this.onUserInterrupt({ rms, centroid });
            }
            if (!this.isUserSpeaking) {
              this.isUserSpeaking = true;
              this.speechStartTime = now;
              if (typeof this.onSpeechStart === 'function') {
                this.onSpeechStart({ rms, centroid, dynamicThreshold, isBargeIn: true });
              }
            }
          }
        } else {
          this.consecutiveSpeechFrames = 0;
        }
        return; // Suppress ambient noise while assistant is speaking
      }

      // 6. Temporal Hysteresis (Requires 6 consecutive frames ~100ms to reject ambient transients)
      if (isSpeechCandidate) {
        this.consecutiveSpeechFrames++;
      } else {
        this.consecutiveSpeechFrames = 0;
      }
      const isConfirmedSpeech = this.isUserSpeaking ? isSpeechCandidate : (this.consecutiveSpeechFrames >= 6);

      // 7. Speech State Transitions
      if (isConfirmedSpeech) {
        this.lastSpeechTime = now;

        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }

        if (!this.isUserSpeaking) {
          this.isUserSpeaking = true;
          this.speechStartTime = now;
          if (typeof this.onSpeechStart === 'function') {
            this.onSpeechStart({ rms, centroid, dynamicThreshold });
          }
        } else {
          if (typeof this.onSpeechContinue === 'function') {
            this.onSpeechContinue({ rms, centroid, elapsedMs: now - this.speechStartTime });
          }
        }
      } else {
        // Below speech threshold
        if (this.isUserSpeaking && !this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.silenceTimer = null;
            if (this.isUserSpeaking) {
              this.isUserSpeaking = false;
              this.consecutiveSpeechFrames = 0;
              const durationMs = performance.now() - this.speechStartTime;
              if (typeof this.onSpeechEnd === 'function') {
                this.onSpeechEnd({ durationMs });
              }
            }
          }, this.speechHangoverMs);
        }
      }
    };

    analyze();
  }

  /**
   * Returns current diagnostic telemetry for HUD monitoring
   */
  getDiagnostics() {
    const baseThreshold = this.config.energyThreshold || 0.0055;
    const dynamicThreshold = Math.min(0.024, Math.max(baseThreshold, this.noiseFloor * 1.65 + 0.002));

    return {
      isEnabled: this.isEnabled,
      isInitialized: this.isInitialized,
      isListening: this.isListening,
      isFallbackMode: this.isFallbackMode,
      isUserSpeaking: this.isUserSpeaking,
      isAssistantSpeaking: this.isAssistantSpeaking,
      activeDeviceLabel: this.activeDeviceLabel,
      appliedTrackSettings: this.appliedTrackSettings,
      currentRMS: this.currentRMS,
      currentCentroid: this.currentCentroid,
      noiseFloor: this.noiseFloor,
      dynamicThreshold,
      consecutiveSpeechFrames: this.consecutiveSpeechFrames
    };
  }

  destroy() {
    this.stop();
    if (this._deviceChangeTimer) {
      clearTimeout(this._deviceChangeTimer);
      this._deviceChangeTimer = null;
    }
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.removeEventListener === 'function' && this._onMediaDeviceChange) {
      navigator.mediaDevices.removeEventListener('devicechange', this._onMediaDeviceChange);
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.speechFilter) {
      try { this.speechFilter.disconnect(); } catch (e) {}
      this.speechFilter = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.isInitialized = false;
  }
}
