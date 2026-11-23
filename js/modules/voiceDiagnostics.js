/**
 * VISION AI — Controlled Voice & Latency Diagnostic HUD
 * Real-time developer diagnostic overlay reporting microphone hardware constraints,
 * VAD energy / adaptive noise floor, speech recognition state, synthetic voice assignments,
 * and streaming latency metrics (TTFT, TTFS, dispatch latency, error counts).
 * Toggled via Ctrl+Shift+D or ?diag=1 URL parameter.
 * Preserves clean cinematic interface when disabled.
 */

export class VoiceDiagnostics {
  constructor(options = {}) {
    this.voiceController = options.voiceController || null;
    this.speechSynthesizer = options.speechSynthesizer || null;
    this.aiClient = options.aiClient || null;
    this.containerId = options.containerId || 'voice-diagnostics-hud';

    this.isVisible = false;
    this.hudElement = null;
    this.updateInterval = null;

    // Latency & Telemetry History
    this.metrics = {
      lastTtftMs: null,
      lastTtfsMs: null,
      lastDispatchMs: null,
      lastTotalMs: null,
      lastVoiceToEarMs: null,
      lastTier: null,
      recognitionErrors: 0,
      playbackWarnings: 0,
      cancellations: 0,
      lastQueryTime: null
    };

    this.serverStats = null;
    this.statsPollInterval = null;

    this.init();
  }

  init() {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) return;

    // Check if ?diag=1 or ?diagnostics=1 is present in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('diag') || urlParams.has('diagnostics')) {
      this.show();
    }
  }

  recordAudioStart(voiceToEarMs = null) {
    if (voiceToEarMs !== null) this.metrics.lastVoiceToEarMs = voiceToEarMs;
    if (this.isVisible) this.render();
  }

  recordLatencyMetrics({ ttftMs = null, ttfsMs = null, dispatchMs = null, totalMs = null, tier = null }) {
    if (ttftMs !== null) this.metrics.lastTtftMs = ttftMs;
    if (ttfsMs !== null) this.metrics.lastTtfsMs = ttfsMs;
    if (dispatchMs !== null) this.metrics.lastDispatchMs = dispatchMs;
    if (totalMs !== null) this.metrics.lastTotalMs = totalMs;
    if (tier !== null) this.metrics.lastTier = tier;
    this.metrics.lastQueryTime = new Date().toLocaleTimeString();

    if (this.isVisible) {
      this.render();
    }
  }

  recordRecognitionError() {
    this.metrics.recognitionErrors++;
    if (this.isVisible) this.render();
  }

  recordPlaybackWarning() {
    this.metrics.playbackWarnings++;
    if (this.isVisible) this.render();
  }

  recordCancellation() {
    this.metrics.cancellations++;
    if (this.isVisible) this.render();
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
    return this.isVisible;
  }

  fetchServerStats() {
    if (typeof fetch === 'undefined') return;
    fetch('/api/latency/metrics')
      .then(res => res.json())
      .then(data => {
        this.serverStats = data;
      })
      .catch(() => {});
  }

  show() {
    if (this.isVisible) return;
    this.isVisible = true;

    if (typeof document === 'undefined') {
      return;
    }

    let el = document.getElementById(this.containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = this.containerId;
      el.className = 'voice-diagnostics-hud';
      document.body.appendChild(el);
    }
    this.hudElement = el;
    this.hudElement.style.display = 'block';

    this.fetchServerStats();
    this.statsPollInterval = setInterval(() => this.fetchServerStats(), 1000);

    this.render();
    this.updateInterval = setInterval(() => this.render(), 120);
    console.log('[DIAGNOSTICS] Voice & Latency Diagnostic HUD active. Press Ctrl+Shift+D to toggle.');
  }

  hide() {
    this.isVisible = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.statsPollInterval) {
      clearInterval(this.statsPollInterval);
      this.statsPollInterval = null;
    }
    if (this.hudElement) {
      this.hudElement.style.display = 'none';
    }
  }

  render() {
    if (!this.hudElement || !this.isVisible) return;

    const vadDiag = (this.voiceController && this.voiceController.vad && typeof this.voiceController.vad.getDiagnostics === 'function')
      ? this.voiceController.vad.getDiagnostics()
      : null;

    const synthDiag = (this.speechSynthesizer && typeof this.speechSynthesizer.getDiagnostics === 'function')
      ? this.speechSynthesizer.getDiagnostics()
      : null;

    const vcDiag = (this.voiceController && typeof this.voiceController.getDiagnostics === 'function')
      ? this.voiceController.getDiagnostics()
      : null;

    // Track Settings
    const track = vadDiag ? vadDiag.appliedTrackSettings : null;
    const micName = (vadDiag && vadDiag.activeDeviceLabel) || 'Default Audio Input';
    const sampleRate = track && track.sampleRate ? `${track.sampleRate} Hz` : 'Standard (48kHz)';
    const agc = track && track.autoGainControl !== undefined ? (track.autoGainControl ? 'ON' : 'OFF') : 'ON (Auto)';
    const ns = track && track.noiseSuppression !== undefined ? (track.noiseSuppression ? 'ON' : 'OFF') : 'ON (Auto)';
    const aec = track && track.echoCancellation !== undefined ? (track.echoCancellation ? 'ON' : 'OFF') : 'ON (Auto)';

    // VAD & Energy
    const rms = vadDiag ? vadDiag.currentRMS : 0;
    const centroid = vadDiag ? Math.round(vadDiag.currentCentroid) : 0;
    const noiseFloor = vadDiag ? vadDiag.noiseFloor : 0.004;
    const dynThresh = vadDiag ? vadDiag.dynamicThreshold : 0.007;

    const rmsPercent = Math.min(100, Math.round((rms / 0.035) * 100));
    const threshPercent = Math.min(100, Math.round((dynThresh / 0.035) * 100));
    const floorPercent = Math.min(100, Math.round((noiseFloor / 0.035) * 100));

    let speechStatus = 'AMBIENT SILENCE';
    let statusClass = 'diag-tag-dim';
    if (vadDiag && vadDiag.isAssistantSpeaking) {
      speechStatus = 'ASSISTANT SPEAKING';
      statusClass = 'diag-tag-blue';
    } else if (vadDiag && vadDiag.isUserSpeaking) {
      speechStatus = 'VOICE ACTIVE';
      statusClass = 'diag-tag-green';
    } else if (rms > dynThresh) {
      speechStatus = 'QUIET SPEECH CANDIDATE';
      statusClass = 'diag-tag-amber';
    }

    // Voice Assignments
    const jarvisVoice = synthDiag && synthDiag.selectedVoices ? synthDiag.selectedVoices.JARVIS : { name: 'Auto-detect', lang: 'en-GB' };
    const ultronVoice = synthDiag && synthDiag.selectedVoices ? synthDiag.selectedVoices.ULTRON : { name: 'Auto-detect', lang: 'en-US' };

    const s = this.serverStats || {};

    this.hudElement.innerHTML = `
      <div class="diag-header">
        <span class="diag-title">JARVIS · VISION // VOICE &amp; LATENCY TELEMETRY</span>
        <div class="diag-controls">
          <span class="diag-badge ${statusClass}">${speechStatus}</span>
          <button class="diag-close-btn" id="diag-close-btn" title="Close (Ctrl+Shift+D)">✕</button>
        </div>
      </div>

      <div class="diag-grid">
        <!-- 1. Microphone Hardware & Constraints -->
        <div class="diag-card">
          <div class="diag-card-title">1. AUDIO HARDWARE CAPTURE</div>
          <div class="diag-row"><span class="diag-label">Device:</span><span class="diag-val diag-truncate" title="${micName}">${micName}</span></div>
          <div class="diag-row"><span class="diag-label">Sample Rate:</span><span class="diag-val">${sampleRate}</span></div>
          <div class="diag-row"><span class="diag-label">Constraints:</span><span class="diag-val">AEC:${aec} | NS:${ns} | AGC:${agc}</span></div>
          <div class="diag-row"><span class="diag-label">Vocal Bandpass:</span><span class="diag-val diag-hl">90Hz – 3600Hz (Active)</span></div>
        </div>

        <!-- 2. VAD & Adaptive Noise Floor -->
        <div class="diag-card">
          <div class="diag-card-title">2. ADAPTIVE HEARING & NOISE FLOOR</div>
          <div class="diag-meter-container">
            <div class="diag-meter-bar" style="width: ${rmsPercent}%;"></div>
            <div class="diag-meter-marker" style="left: ${threshPercent}%;" title="Threshold: ${dynThresh.toFixed(4)}"></div>
            <div class="diag-meter-floor" style="left: ${floorPercent}%;" title="Noise Floor: ${noiseFloor.toFixed(4)}"></div>
          </div>
          <div class="diag-row"><span class="diag-label">RMS Energy:</span><span class="diag-val">${rms.toFixed(4)} (Threshold: ${dynThresh.toFixed(4)})</span></div>
          <div class="diag-row"><span class="diag-label">Noise Floor:</span><span class="diag-val">${noiseFloor.toFixed(4)} (Adaptive)</span></div>
          <div class="diag-row"><span class="diag-label">Spectral Centroid:</span><span class="diag-val">${centroid} Hz</span></div>
        </div>

        <!-- 3. Speech Recognition Engine & Subsystems -->
        <div class="diag-card">
          <div class="diag-card-title">3. SPEECH RECOGNITION & LIFECYCLE</div>
          <div class="diag-row"><span class="diag-label">Active Personality:</span><span class="diag-val diag-hl">${(vcDiag && vcDiag.activePersonality) || 'JARVIS'}</span></div>
          <div class="diag-row"><span class="diag-label">Voice Mode / State:</span><span class="diag-val diag-cyan">${(vcDiag && vcDiag.voiceMode) || 'DISABLED'} // ${(vcDiag && vcDiag.canonicalState) || (vcDiag && vcDiag.state) || 'DISABLED'}${vcDiag && vcDiag.timer && vcDiag.timer.isTimerActive ? ' (' + vcDiag.timer.formatted + ')' : ''}</span></div>
          <div class="diag-row"><span class="diag-label">Turn ID:</span><span class="diag-val diag-truncate">${(vcDiag && vcDiag.currentTurnId) || 'turn_0'}</span></div>
          <div class="diag-row"><span class="diag-label">Last Transition:</span><span class="diag-val">${vcDiag && vcDiag.lastTransition ? `${vcDiag.lastTransition.fromState || 'START'} ➔ ${vcDiag.lastTransition.toState} (${vcDiag.lastTransitionDurationMs}ms)` : 'Initial'}</span></div>
          <div class="diag-row"><span class="diag-label">Mic Available:</span><span class="diag-val">${(vcDiag && vcDiag.microphoneAvailability) || (vcDiag && vcDiag.subsystems && vcDiag.subsystems.microphoneAccess) || 'granted'}</span></div>
          <div class="diag-row"><span class="diag-label">Capture Status:</span><span class="diag-val">${(vcDiag && vcDiag.subsystems && vcDiag.subsystems.audioCapture === 'active') ? 'ACTIVE (Live Stream)' : 'INACTIVE'}</span></div>
          <div class="diag-row"><span class="diag-label">Recognition:</span><span class="diag-val">${(vcDiag && vcDiag.isRecognitionActive) ? 'ACTIVE' : ((vcDiag && vcDiag.isAudioFallbackActive) ? 'FALLBACK ACTIVE' : 'STANDBY')}</span></div>
          <div class="diag-row"><span class="diag-label">Subsystems:</span><span class="diag-val">AI:${vcDiag?.subsystems?.aiProvider || 'ready'} | TTS:${vcDiag?.subsystems?.textToSpeech || 'idle'}</span></div>
          <div class="diag-row"><span class="diag-label">Last Error / Sub:</span><span class="diag-val ${vcDiag && vcDiag.lastError ? 'diag-red' : 'diag-muted'}">${vcDiag && vcDiag.lastError ? `${vcDiag.lastError} (${vcDiag.affectedSubsystem})` : 'None (Healthy)'}</span></div>
          <div class="diag-row"><span class="diag-label">Reconnect:</span><span class="diag-val">${vcDiag ? `${vcDiag.reconnectAttempts} / ${vcDiag.maxReconnectAttempts || 6}` : '0 / 6'}</span></div>
          <div class="diag-row"><span class="diag-label">Last Transcription:</span><span class="diag-val">${vcDiag ? vcDiag.lastSuccessfulRecognitionTimestamp : 'None'}</span></div>
          <div style="margin-top: 6px; display: flex; gap: 6px;">
            <button id="diag-btn-retry" class="stark-btn stark-btn-glass" style="font-size: 11px; padding: 2px 8px; cursor: pointer;">🔄 Retry</button>
            <button id="diag-btn-stop" class="stark-btn stark-btn-glass" style="font-size: 11px; padding: 2px 8px; cursor: pointer;">⏹️ Stop</button>
          </div>
        </div>

        <!-- 4. Ultra-Synthetic Personalities -->
        <div class="diag-card">
          <div class="diag-card-title">4. SYNTHETIC VOICES</div>
          <div class="diag-row"><span class="diag-label">JARVIS:</span><span class="diag-val diag-truncate" title="${jarvisVoice.name || jarvisVoice}">${jarvisVoice.name || jarvisVoice} (P: 1.03, R: 1.02)</span></div>
          <div class="diag-row"><span class="diag-label">JARVIS Carrier:</span><span class="diag-val diag-cyan">880/1760Hz Holographic Shimmer</span></div>
          <div class="diag-row"><span class="diag-label">ULTRON:</span><span class="diag-val diag-truncate" title="${ultronVoice.name || ultronVoice}">${ultronVoice.name || ultronVoice} (P: 0.80, R: 0.93)</span></div>
          <div class="diag-row"><span class="diag-label">ULTRON Carrier:</span><span class="diag-val diag-red">55/110Hz Metallic Sub-Pulse</span></div>
        </div>

        <!-- 5. Progressive Streaming & Latency -->
        <div class="diag-card">
          <div class="diag-card-title">5. END-TO-END PIPELINE LATENCY</div>
          <div class="diag-row"><span class="diag-label">Voice-to-Ear Total:</span><span class="diag-val diag-hl">${this.metrics.lastVoiceToEarMs ? this.metrics.lastVoiceToEarMs + 'ms' : 'Ready'}</span></div>
          <div class="diag-row"><span class="diag-label">Time to First Token (TTFT):</span><span class="diag-val">${this.metrics.lastTtftMs ? this.metrics.lastTtftMs + 'ms' : 'Ready'}</span></div>
          <div class="diag-row"><span class="diag-label">Time to First Sentence (TTFS):</span><span class="diag-val">${this.metrics.lastTtfsMs ? this.metrics.lastTtfsMs + 'ms' : 'Ready'}</span></div>
          <div class="diag-row"><span class="diag-label">Routing Tier:</span><span class="diag-val diag-cyan">${this.metrics.lastTier || 'LOCAL_INSTANT / FAST'}</span></div>
          <div class="diag-row"><span class="diag-label">Total Duration:</span><span class="diag-val">${this.metrics.lastTotalMs ? this.metrics.lastTotalMs + 'ms' : '—'}</span></div>
        </div>

        <!-- 6. Rolling Benchmarks (P50 / P95) -->
        <div class="diag-card">
          <div class="diag-card-title">6. ROLLING BENCHMARKS (P50 / P95)</div>
          <div class="diag-row"><span class="diag-label">Voice-to-Ear:</span><span class="diag-val">${s.voiceToEar?.median !== null && s.voiceToEar?.median !== undefined ? s.voiceToEar.median + 'ms (P95: ' + s.voiceToEar.p95 + 'ms)' : 'Collecting...'}</span></div>
          <div class="diag-row"><span class="diag-label">TTFT:</span><span class="diag-val">${s.ttft?.median !== null && s.ttft?.median !== undefined ? s.ttft.median + 'ms (P95: ' + s.ttft.p95 + 'ms)' : 'Collecting...'}</span></div>
          <div class="diag-row"><span class="diag-label">TTFS:</span><span class="diag-val">${s.ttfs?.median !== null && s.ttfs?.median !== undefined ? s.ttfs.median + 'ms (P95: ' + s.ttfs.p95 + 'ms)' : 'Collecting...'}</span></div>
          <div class="diag-row"><span class="diag-label">Tool Execution:</span><span class="diag-val">${s.toolExec?.median !== null && s.toolExec?.median !== undefined ? s.toolExec.median + 'ms (P95: ' + s.toolExec.p95 + 'ms)' : 'Collecting...'}</span></div>
          <div class="diag-row"><span class="diag-label">Sample Count:</span><span class="diag-val diag-muted">${s.sampleSize || 0} calls recorded</span></div>
        </div>
      </div>
    `;

    const closeBtn = this.hudElement.querySelector('#diag-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }

    const diagRetry = this.hudElement.querySelector('#diag-btn-retry');
    if (diagRetry && this.voiceController) {
      diagRetry.onclick = () => this.voiceController.retryListening();
    }

    const diagStop = this.hudElement.querySelector('#diag-btn-stop');
    if (diagStop && this.voiceController) {
      diagStop.onclick = () => this.voiceController.stopListening();
    }
  }
}
