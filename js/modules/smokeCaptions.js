/**
 * VISION AI — Minimal White Smoke Captions
 * Cinematic, ethereal floating captions for user & AI speech.
 * Zero background boxes, borders, icons, speaker tags, or chat bubbles.
 * Soft smoky glow with subtle blur and gentle white mist dissolve animation.
 * Highly legible across both crimson ULTRON and midnight-blue JARVIS themes.
 */

export class SmokeCaptions {
  constructor(containerId = 'smoke-captions') {
    this.containerId = containerId;
    this.container = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
    this.enabled = true;
    this.currentText = '';
    this.currentSpeaker = null; // 'USER' | 'ASSISTANT'
    this.isFinal = false;
    this.generationToken = 0;
    this.dissolveTimeout = null;
    this.removeTimeout = null;
    this.interimWatchdog = null;
    this.phraseElement = null;
    this.isEmergencyStopped = false;
    this.activeUtteranceId = null;
    this.isSpeakingAudio = false;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.clear(true);
      if (this.container && this.container.style) {
        this.container.style.display = 'none';
      }
    } else {
      if (this.container && this.container.style) {
        this.container.style.display = 'flex';
      }
    }
  }

  isVisible() {
    return this.enabled && Boolean(this.currentText);
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  ensureContainer() {
    if (!this.container && typeof document !== 'undefined') {
      this.container = document.getElementById(this.containerId);
      if (!this.container) {
        const appContainer = document.getElementById('app-container') || document.body;
        const div = document.createElement('div');
        div.id = this.containerId;
        div.className = 'smoke-captions';
        div.setAttribute('aria-live', 'polite');
        appContainer.appendChild(div);
        this.container = div;
      }
    }
    if (this.container && this.container.style) {
      this.container.style.display = this.enabled ? 'flex' : 'none';
    }
    return this.container;
  }

  /**
   * Displays live recognized user speech (interim or final)
   * @param {string} text - Spoken transcript
   * @param {boolean} isFinal - Whether the recognition segment is final
   */
  showUserSpeech(text, isFinal = false) {
    if (!this.enabled || this.isEmergencyStopped) return;
    if (!text || typeof text !== 'string') return;
    const cleanText = text.trim();
    if (!cleanText) return;

    const container = this.ensureContainer();
    if (!container) return;

    this.clearTimeouts();
    this.generationToken++;
    const token = this.generationToken;

    this.currentSpeaker = 'USER';
    this.currentText = cleanText;
    this.isFinal = isFinal;

    this.renderText(cleanText, {
      speaker: 'USER',
      isFinal,
      isInterim: !isFinal
    });

    // If final transcript, schedule smooth mist dissolve after reading pause
    if (isFinal) {
      const readingDurationMs = Math.max(2600, Math.min(4200, cleanText.length * 55));
      this.dissolveTimeout = setTimeout(() => {
        if (this.generationToken === token && this.currentSpeaker === 'USER') {
          this.dissolve();
        }
      }, readingDurationMs);
    } else {
      // Watchdog: interim speech dissolves after 3.5s of silence if no final transcript arrives
      this.interimWatchdog = setTimeout(() => {
        if (this.generationToken === token && !this.isFinal) {
          this.dissolve(true);
        }
      }, 3500);
    }
  }

  /**
   * Displays sentence spoken by JARVIS or ULTRON as audio begins
   * @param {string} sentence - Clean spoken sentence
   * @param {'JARVIS' | 'ULTRON'} themeKey
   * @param {string} utteranceId
   */
  showAssistantSentence(sentence, themeKey = 'JARVIS', utteranceId = null) {
    if (!this.enabled || this.isEmergencyStopped) return;
    if (!sentence || typeof sentence !== 'string') return;
    const clean = sentence.trim();
    if (!clean) return;

    // Reject stale sentences from outdated utterances
    if (utteranceId && this.activeUtteranceId && utteranceId !== this.activeUtteranceId) {
      return;
    }

    const container = this.ensureContainer();
    if (!container) return;

    this.clearTimeouts();
    this.generationToken++;

    this.isSpeakingAudio = true;
    this.activeUtteranceId = utteranceId;
    this.currentSpeaker = 'ASSISTANT';
    this.currentText = clean;
    this.isFinal = true;

    this.renderText(clean, {
      speaker: 'ASSISTANT',
      themeKey,
      isFinal: true,
      isInterim: false
    });
  }

  /**
   * Incrementally appends assistant streaming tokens to smoke captions ONLY when TTS audio is inactive
   * @param {string} token
   * @param {'JARVIS' | 'ULTRON'} themeKey
   */
  appendAssistantStream(token, themeKey = 'JARVIS') {
    if (!this.enabled || this.isEmergencyStopped) return;
    // When audio speech is active, captions must stay strictly bound to the spoken sentence chunk
    if (this.isSpeakingAudio) return;
    if (!token || typeof token !== 'string') return;

    const container = this.ensureContainer();
    if (!container) return;

    if (this.currentSpeaker !== 'ASSISTANT' || this.isFinal) {
      this.clearTimeouts();
      this.generationToken++;
      this.currentSpeaker = 'ASSISTANT';
      this.currentText = '';
      this.isFinal = false;
    }

    this.currentText += token;

    this.renderText(this.currentText, {
      speaker: 'ASSISTANT',
      themeKey,
      isFinal: false,
      isInterim: true
    });
  }

  /**
   * Called when an individual sentence finishes audio playback
   */
  onAssistantSentenceEnd(sentence, themeKey, utteranceId) {
    // Keep sentence visible until next sentence arrives or full speech completes
  }

  /**
   * Called when all queued sentences and speech stream complete
   * Sets reading delay and then dissolves into mist
   */
  onAssistantSpeechEnd(fullText) {
    this.isSpeakingAudio = false;
    this.activeUtteranceId = null;
    if (!this.currentText) return;

    this.clearTimeouts();
    const token = this.generationToken;

    // Reading delay proportional to length of final displayed sentence
    const readingDurationMs = Math.max(2400, Math.min(4200, this.currentText.length * 55));

    this.dissolveTimeout = setTimeout(() => {
      if (this.generationToken === token) {
        this.dissolve();
      }
    }, readingDurationMs);
  }

  /**
   * Displays tool execution events in smoke captions
   * @param {string} toolName - Name of the executing tool
   * @param {'executing' | 'complete' | 'error'} status
   */
  showToolEvent(toolName, status = 'executing') {
    if (!this.enabled || this.isEmergencyStopped) return;
    if (!toolName || typeof toolName !== 'string') return;
    const cleanName = toolName.trim();
    if (!cleanName) return;

    const container = this.ensureContainer();
    if (!container) return;

    this.clearTimeouts();
    this.generationToken++;
    const token = this.generationToken;

    this.currentSpeaker = 'TOOL';
    const symbol = status === 'error' ? '✖' : (status === 'complete' ? '✓' : '⚡');
    const label = status === 'error' ? 'Failed' : (status === 'complete' ? 'Executed' : 'Executing');
    const displayText = `${symbol} [SYSTEM] ${label}: ${cleanName}`;
    this.currentText = displayText;
    this.isFinal = true;

    this.renderText(displayText, {
      speaker: 'TOOL',
      status,
      isFinal: true,
      isInterim: false
    });

    const readingDurationMs = Math.max(2200, Math.min(3800, displayText.length * 45));
    this.dissolveTimeout = setTimeout(() => {
      if (this.generationToken === token && this.currentSpeaker === 'TOOL') {
        this.dissolve();
      }
    }, readingDurationMs);
  }

  /**
   * Renders the caption phrase with smooth smoky transition
   */
  renderText(text, options = {}) {
    const container = this.ensureContainer();
    if (!container) return;

    let el = this.phraseElement;
    const isNew = !el || !container.contains(el);

    if (isNew) {
      container.innerHTML = '';
      el = document.createElement('span');
      el.className = 'caption-phrase';
      container.appendChild(el);
      this.phraseElement = el;
    }

    // Configure classes
    el.className = 'caption-phrase';
    if (options.speaker === 'USER') {
      el.classList.add(options.isFinal ? 'caption-user-final' : 'caption-user-interim');
    } else if (options.speaker === 'TOOL') {
      el.classList.add('caption-tool');
      if (options.status) {
        el.classList.add(`caption-tool-${options.status}`);
      }
    } else {
      el.classList.add('caption-assistant');
      if (options.themeKey) {
        el.classList.add(`caption-assistant-${options.themeKey.toLowerCase()}`);
      }
    }

    // Soft smoky entrance animation if newly mounted
    if (isNew) {
      el.classList.add('caption-enter');
      void el.offsetWidth; // Force reflow
      el.classList.remove('caption-enter');
    }

    const sanitizeCaptionText = (raw) => String(raw || '')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
      .replace(/https?:\/\/[^\s)]+/g, '')
      .replace(/\b(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{20,}/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    el.textContent = sanitizeCaptionText(text);
  }

  /**
   * Dissolves current caption into subtle white mist
   * @param {boolean} immediate - If true, clears instantly without animation
   */
  dissolve(immediate = false) {
    this.clearTimeouts();
    this.generationToken++;

    const container = this.container;
    const el = this.phraseElement;

    if (!container || !el) {
      this.resetState();
      return;
    }

    if (immediate) {
      this.resetState();
      container.innerHTML = '';
      return;
    }

    // Add white mist dissolve animation
    el.classList.add('caption-dissolving');

    this.removeTimeout = setTimeout(() => {
      if (container && container.contains(el)) {
        container.innerHTML = '';
      }
      this.resetState();
    }, 540); // Matches CSS dissolve duration
  }

  /**
   * Clears any active captions immediately or smoothly
   */
  clear(immediate = true) {
    this.dissolve(immediate);
  }

  clearTimeouts() {
    if (this.dissolveTimeout) {
      clearTimeout(this.dissolveTimeout);
      this.dissolveTimeout = null;
    }
    if (this.removeTimeout) {
      clearTimeout(this.removeTimeout);
      this.removeTimeout = null;
    }
    if (this.interimWatchdog) {
      clearTimeout(this.interimWatchdog);
      this.interimWatchdog = null;
    }
  }

  resetState() {
    this.clearTimeouts();
    this.currentText = '';
    this.currentSpeaker = null;
    this.isFinal = false;
    this.phraseElement = null;
    this.activeUtteranceId = null;
    this.isSpeakingAudio = false;
  }

  handleEmergencyStop(reason = 'EMERGENCY_STOP') {
    this.isEmergencyStopped = true;
    this.clearTimeouts();
    this.generationToken++;
    const container = this.ensureContainer();
    if (!container) return;

    this.currentSpeaker = 'STOP';
    this.currentText = '⛔ EMERGENCY STOP ENGAGED';
    this.isFinal = true;

    container.innerHTML = '';
    const el = document.createElement('span');
    el.className = 'caption-phrase caption-emergency-stopped';
    el.style.color = '#ff3344';
    el.style.fontWeight = 'bold';
    el.style.letterSpacing = '2px';
    el.style.textShadow = '0 0 12px rgba(255, 40, 60, 0.8)';
    el.textContent = `⛔ EMERGENCY STOP ACTIVE [${reason.toUpperCase()}]`;
    container.appendChild(el);
    this.phraseElement = el;
  }

  resetEmergencyStop() {
    this.isEmergencyStopped = false;
    this.clear(true);
  }
}
