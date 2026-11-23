/**
 * JARVIS — Floating Voice Conversation Window
 * js/modules/floatingVoiceWindow.js
 *
 * Implements:
 * 1. Automatic window behavior on voice conversation start (no focus stealing).
 * 2. Real-time conversation display:
 *    - Left side: Speech-recognized words (interim vs. final), typed user messages, transparent error alerts.
 *    - Right side: Progressive streaming responses from JARVIS, speech synchronization, generation state.
 * 3. Right-side text input:
 *    - Type messages, Enter to send, Shift+Enter for new line.
 *    - Send button, mic toggle, stop-speaking button, end-voice button.
 *    - Seamless voice <-> text switching preserving unified conversation context.
 * 4. Voice experience:
 *    - Dynamic states: LISTENING, LIVE SPEECH, THINKING, SPEAKING, MUTED, ERROR.
 *    - Animated audio waveform indicator reflecting live capture state.
 * 5. Visual design:
 *    - Compact, premium dark translucent glass styling with JARVIS branding.
 *    - Draggable, minimizable (into a compact floating pill), and responsive.
 *    - Non-destructive closure: active speech and background tasks continue if window is closed.
 * 6. Conversation continuity:
 *    - Connected to existing JARVIS conversation manager, memory, and provider routing.
 */

export class FloatingVoiceWindow {
  constructor(app) {
    this.app = app;
    this.isOpen = false;
    this.isMinimized = false;
    this.isSpeaking = false;
    this.isStreaming = false;
    this.activePersonality = app.currentTheme || 'JARVIS';
    this.currentVoiceState = 'DISABLED';

    // Active assistant streaming reference
    this.currentAssistantBubble = null;
    this.currentAssistantContentEl = null;
    this.currentAssistantStatusEl = null;
    this.currentStreamingText = '';

    // Active interim speech reference
    this.currentInterimEl = null;

    // Dragging state
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    this.initDOM();
    this.bindEvents();
    this.loadConversationHistory();
  }

  // =========================================================================
  // 1. DOM INITIALIZATION
  // =========================================================================

  initDOM() {
    // 1. Floating Window Container
    let win = document.getElementById('jarvis-floating-voice-window');
    if (!win) {
      win = document.createElement('div');
      win.id = 'jarvis-floating-voice-window';
      win.className = 'jarvis-floating-voice-window';
      win.setAttribute('role', 'region');
      win.setAttribute('aria-label', 'JARVIS Floating Voice Conversation Window');
      win.innerHTML = `
        <!-- Floating Window Header / Drag Handle -->
        <div class="fvw-header" id="fvw-header">
          <div class="fvw-brand-group">
            <span class="fvw-arc-glyph" aria-hidden="true">◈</span>
            <div class="fvw-brand-text">
              <span class="fvw-brand-name">JARVIS</span>
              <span class="fvw-brand-sub">VISION — MADE BY LOKESH</span>
            </div>
          </div>

          <!-- Dynamic Voice State Pill -->
          <div class="fvw-status-pill state-ready" id="fvw-status-pill" title="Microphone & Voice Engine Status">
            <span class="fvw-status-dot" id="fvw-status-dot"></span>
            <span class="fvw-status-text" id="fvw-status-text">READY</span>
          </div>

          <!-- Animated Audio Waveform -->
          <div class="fvw-waveform" id="fvw-waveform" title="Audio Activity">
            <span class="fvw-bar b1"></span>
            <span class="fvw-bar b2"></span>
            <span class="fvw-bar b3"></span>
            <span class="fvw-bar b4"></span>
            <span class="fvw-bar b5"></span>
          </div>

          <!-- Window Action Buttons -->
          <div class="fvw-window-controls">
            <button class="fvw-btn-icon fvw-mic-btn" id="fvw-mic-toggle-btn" title="Toggle Microphone (Mute/Unmute)" aria-label="Toggle Microphone">
              <span id="fvw-mic-icon">🎙️</span>
            </button>
            <button class="fvw-btn-icon fvw-end-btn" id="fvw-end-voice-btn" title="End Voice Conversation" aria-label="End Voice Conversation">
              <span>⏹️</span>
            </button>
            <button class="fvw-btn-icon fvw-min-btn" id="fvw-minimize-btn" title="Minimize Window" aria-label="Minimize Window">
              <span>—</span>
            </button>
            <button class="fvw-btn-icon fvw-expand-btn" id="fvw-expand-btn" title="Toggle Size" aria-label="Toggle Size">
              <span>⤢</span>
            </button>
            <button class="fvw-btn-icon fvw-close-btn" id="fvw-close-btn" title="Close Window (Active tasks continue)" aria-label="Close Window">
              <span>✕</span>
            </button>
          </div>
        </div>

        <!-- Window Body: Conversation Stream + Right-Side Input Area -->
        <div class="fvw-content-area">
          <!-- Conversation Stream (Left = User, Right = JARVIS) -->
          <div class="fvw-stream-container" id="fvw-stream-container" tabindex="0" aria-label="Conversation History">
            <div class="fvw-messages" id="fvw-messages">
              <!-- Initial Welcome Entry -->
              <div class="fvw-message-row fvw-assistant-row">
                <div class="fvw-bubble fvw-assistant-bubble">
                  <div class="fvw-bubble-header">
                    <span class="fvw-speaker-label">JARVIS</span>
                    <span class="fvw-bubble-status">✓ Ready</span>
                  </div>
                  <div class="fvw-bubble-text">
                    Good day, sir. Voice conversation window active. Speak or type as you prefer; I am listening.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right-Side / Bottom Docked Text & Control Bar -->
          <div class="fvw-input-panel" id="fvw-input-panel">
            <div class="fvw-input-wrapper">
              <textarea
                id="fvw-text-input"
                class="fvw-text-input"
                rows="1"
                placeholder="Type to JARVIS... (Enter to send, Shift+Enter for new line)"
                autocomplete="off"
                spellcheck="false"
              ></textarea>
              <div class="fvw-input-actions">
                <input type="file" id="fvw-file-input" style="display: none;" accept="image/*,.pdf,.txt,.js,.py,.json" />
                <button id="fvw-attach-btn" class="fvw-action-btn fvw-attach-btn" title="Attach Image / Document (Clip)">
                  <span>📎</span>
                </button>
                <button id="fvw-stop-speech-btn" class="fvw-action-btn fvw-stop-btn" style="display: none;" title="Stop Speaking (Esc)">
                  <span>⏹️ Stop</span>
                </button>
                <button id="fvw-send-btn" class="fvw-action-btn fvw-send-btn" title="Send typed message (Enter)">
                  <span>➤</span>
                </button>
              </div>
            </div>
            <div class="fvw-input-footer">
              <span class="fvw-footer-hint">Switch between voice and text seamlessly. Context is preserved.</span>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(win);
    }
    this.windowEl = win;

    // 2. Floating Minimized Pill
    let pill = document.getElementById('jarvis-floating-voice-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'jarvis-floating-voice-pill';
      pill.className = 'jarvis-floating-voice-pill';
      pill.style.display = 'none';
      pill.innerHTML = `
        <span class="fvw-pill-dot"></span>
        <span class="fvw-pill-mic">🎙️</span>
        <span class="fvw-pill-label" id="fvw-pill-label">JARVIS · VOICE ACTIVE</span>
        <div class="fvw-pill-waveform">
          <span></span><span></span><span></span>
        </div>
        <button class="fvw-pill-restore-btn" id="fvw-pill-restore-btn" title="Restore Conversation Window">⤢</button>
      `;
      document.body.appendChild(pill);
    }
    this.pillEl = pill;

    // Element references
    this.headerEl = document.getElementById('fvw-header');
    this.statusPillEl = document.getElementById('fvw-status-pill');
    this.statusDotEl = document.getElementById('fvw-status-dot');
    this.statusTextEl = document.getElementById('fvw-status-text');
    this.waveformEl = document.getElementById('fvw-waveform');
    this.messagesContainer = document.getElementById('fvw-messages');
    this.streamContainer = document.getElementById('fvw-stream-container');
    this.textInput = document.getElementById('fvw-text-input');
    this.sendBtn = document.getElementById('fvw-send-btn');
    this.stopSpeechBtn = document.getElementById('fvw-stop-speech-btn');
    this.micToggleBtn = document.getElementById('fvw-mic-toggle-btn');
    this.micIconEl = document.getElementById('fvw-mic-icon');
    this.endVoiceBtn = document.getElementById('fvw-end-voice-btn');
    this.minimizeBtn = document.getElementById('fvw-minimize-btn');
    this.expandBtn = document.getElementById('fvw-expand-btn');
    this.closeBtn = document.getElementById('fvw-close-btn');
    this.pillRestoreBtn = document.getElementById('fvw-pill-restore-btn');
    this.pillLabelEl = document.getElementById('fvw-pill-label');
    this.attachBtn = document.getElementById('fvw-attach-btn');
    this.fileInput = document.getElementById('fvw-file-input');
  }

  // =========================================================================
  // 2. EVENT BINDINGS
  // =========================================================================

  bindEvents() {
    // Window Controls
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.minimizeBtn) {
      this.minimizeBtn.addEventListener('click', () => this.minimize());
    }

    if (this.attachBtn && this.fileInput) {
      this.attachBtn.addEventListener('click', () => {
        this.fileInput.click();
      });

      this.fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          this.handleFileUpload(file);
          this.fileInput.value = '';
        }
      });
    }

    if (this.pillRestoreBtn) {
      this.pillRestoreBtn.addEventListener('click', () => this.restore());
    }
    if (this.pillEl) {
      this.pillEl.addEventListener('click', (e) => {
        if (e.target !== this.pillRestoreBtn) this.restore();
      });
    }

    if (this.expandBtn) {
      this.expandBtn.addEventListener('click', () => this.toggleExpand());
    }

    // Microphone Toggle
    if (this.micToggleBtn) {
      this.micToggleBtn.addEventListener('click', () => this.toggleMicrophone());
    }

    // End Voice Session
    if (this.endVoiceBtn) {
      this.endVoiceBtn.addEventListener('click', () => this.endVoiceSession());
    }

    // Stop Speaking
    if (this.stopSpeechBtn) {
      this.stopSpeechBtn.addEventListener('click', () => this.stopSpeaking());
    }

    // Send Button & Text Input
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.sendTextMessage());
    }

    if (this.textInput) {
      this.textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendTextMessage();
        } else if (e.key === 'Escape' && this.isSpeaking) {
          e.preventDefault();
          this.stopSpeaking();
        }
      });

      // Auto-grow textarea up to max 120px
      this.textInput.addEventListener('input', () => {
        this.textInput.style.height = 'auto';
        this.textInput.style.height = Math.min(120, this.textInput.scrollHeight) + 'px';
      });
    }

    // Draggable Header
    this.initDraggable();
  }

  initDraggable() {
    if (!this.headerEl || !this.windowEl) return;

    this.headerEl.addEventListener('mousedown', (e) => {
      // Don't drag if clicking buttons
      if (e.target.closest('button')) return;

      this.isDragging = true;
      const rect = this.windowEl.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;

      this.windowEl.classList.add('is-dragging');
      document.body.style.userSelect = 'none';

      const onMouseMove = (moveEvt) => {
        if (!this.isDragging) return;
        const newX = Math.max(10, Math.min(window.innerWidth - rect.width - 10, moveEvt.clientX - this.dragOffsetX));
        const newY = Math.max(10, Math.min(window.innerHeight - rect.height - 10, moveEvt.clientY - this.dragOffsetY));

        this.windowEl.style.left = `${newX}px`;
        this.windowEl.style.top = `${newY}px`;
        this.windowEl.style.right = 'auto';
        this.windowEl.style.bottom = 'auto';
      };

      const onMouseUp = () => {
        this.isDragging = false;
        this.windowEl.classList.remove('is-dragging');
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  // =========================================================================
  // 3. WINDOW LIFECYCLE & VISIBILITY
  // =========================================================================

  /**
   * Opens the floating conversation window.
   * If autoTriggered is true, does NOT steal keyboard focus from active application!
   */
  open(options = {}) {
    const autoTriggered = Boolean(options.autoTriggered);

    if (this.isMinimized) {
      this.restore();
      return;
    }

    this.isOpen = true;
    if (this.windowEl) {
      this.windowEl.style.display = 'flex';
      this.windowEl.classList.remove('fvw-hidden');
    }
    if (this.pillEl) {
      this.pillEl.style.display = 'none';
    }

    // Do NOT steal keyboard focus when opened automatically!
    if (!autoTriggered && this.textInput) {
      setTimeout(() => this.textInput.focus(), 60);
    }

    // Electron non-focus-stealing support
    if (window.desktopAPI && typeof window.desktopAPI.showWindowInactive === 'function') {
      window.desktopAPI.showWindowInactive();
    }

    this.scrollToBottom();
  }

  /**
   * Closes the window without terminating ongoing tasks or speech!
   */
  close() {
    this.isOpen = false;
    if (this.windowEl) {
      this.windowEl.style.display = 'none';
    }
    if (this.pillEl) {
      this.pillEl.style.display = 'none';
    }
    // Note: Active speech and AI requests continue running in the background!
  }

  /**
   * Minimizes the window into a sleek floating pill.
   */
  minimize() {
    this.isMinimized = true;
    if (this.windowEl) {
      this.windowEl.style.display = 'none';
    }
    if (this.pillEl) {
      this.pillEl.style.display = 'flex';
      this.updatePillStatus();
    }
  }

  /**
   * Restores the window from the minimized pill.
   */
  restore() {
    this.isMinimized = false;
    if (this.pillEl) {
      this.pillEl.style.display = 'none';
    }
    if (this.windowEl) {
      this.windowEl.style.display = 'flex';
      this.scrollToBottom();
    }
    this.isOpen = true;
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  toggleExpand() {
    if (!this.windowEl) return;
    this.windowEl.classList.toggle('fvw-expanded');
    this.scrollToBottom();
  }

  scrollToBottom() {
    if (this.streamContainer) {
      this.streamContainer.scrollTop = this.streamContainer.scrollHeight;
    }
  }

  // =========================================================================
  // 4. USER CONVERSATION EVENTS (LEFT SIDE)
  // =========================================================================

  /**
   * Displays speech recognition transcript on the LEFT side.
   * Clearly distinguishes interim live speech from finalized speech.
   */
  onUserSpeech(transcript, isFinal = false) {
    const raw = String(transcript || '').trim();
    if (!raw) return;

    // Automatically open window if closed or minimized when user speaks
    if (!this.isOpen && !this.isMinimized) {
      this.open({ autoTriggered: true });
    }

    if (!isFinal) {
      // Temporary live transcription (italicized, pulsing listening indicator)
      this.renderInterimSpeech(raw);
      this.setVoiceState('LIVE SPEECH');
    } else {
      // Finalized transcription
      this.removeInterimSpeech();
      this.appendUserMessage(raw, { isSpoken: true });
      this.setVoiceState('THINKING');
    }
  }

  renderInterimSpeech(text) {
    if (!this.messagesContainer) return;

    if (!this.currentInterimEl) {
      const row = document.createElement('div');
      row.className = 'fvw-message-row fvw-user-row fvw-interim-row';
      row.innerHTML = `
        <div class="fvw-bubble fvw-user-bubble fvw-interim-bubble">
          <div class="fvw-bubble-header">
            <span class="fvw-speaker-label">You (Speaking...)</span>
            <span class="fvw-live-indicator"><span class="fvw-pulse-dot"></span> Live</span>
          </div>
          <div class="fvw-bubble-text fvw-interim-text">${this.escapeHtml(text)}</div>
        </div>
      `;
      this.messagesContainer.appendChild(row);
      this.currentInterimEl = row;
    } else {
      const textEl = this.currentInterimEl.querySelector('.fvw-interim-text');
      if (textEl) textEl.textContent = text;
    }
    this.scrollToBottom();
  }

  removeInterimSpeech() {
    if (this.currentInterimEl) {
      this.currentInterimEl.remove();
      this.currentInterimEl = null;
    }
  }

  /**
   * Appends a finalized user message on the LEFT side.
   */
  appendUserMessage(text, meta = {}) {
    if (!this.messagesContainer) return;
    const isSpoken = Boolean(meta.isSpoken);

    const row = document.createElement('div');
    row.className = 'fvw-message-row fvw-user-row';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    row.innerHTML = `
      <div class="fvw-bubble fvw-user-bubble">
        <div class="fvw-bubble-header">
          <span class="fvw-speaker-label">You</span>
          <span class="fvw-input-badge">${isSpoken ? '🎙️ Spoken' : '⌨️ Typed'}</span>
          <span class="fvw-time-label">${timeStr}</span>
        </div>
        <div class="fvw-bubble-text">${this.escapeHtml(text)}</div>
      </div>
    `;

    this.messagesContainer.appendChild(row);
    this.scrollToBottom();
  }

  /**
   * Displays transcription or speech recognition errors transparently on the LEFT side.
   */
  onSpeechRecognitionError(err) {
    if (!this.messagesContainer) return;
    const errMessage = typeof err === 'string' ? err : (err?.message || err?.error || 'Audio capture interrupted');

    const row = document.createElement('div');
    row.className = 'fvw-message-row fvw-user-row fvw-error-row';
    row.innerHTML = `
      <div class="fvw-bubble fvw-error-bubble">
        <div class="fvw-bubble-header">
          <span class="fvw-speaker-label">⚠️ Speech Recognition Notice</span>
        </div>
        <div class="fvw-bubble-text">
          ${this.escapeHtml(errMessage)}
        </div>
        <div class="fvw-error-actions">
          <button class="fvw-btn-mini" onclick="window.jarvisApp?.enableAutonomousVoice('ERROR_RETRY')">Retry Mic</button>
        </div>
      </div>
    `;
    this.messagesContainer.appendChild(row);
    this.setVoiceState('ERROR');
    this.scrollToBottom();
  }

  // =========================================================================
  // 5. ASSISTANT CONVERSATION EVENTS (RIGHT SIDE)
  // =========================================================================

  /**
   * Prepares or retrieves the active assistant response bubble on the RIGHT side.
   */
  getOrCreateAssistantBubble(theme = 'JARVIS') {
    if (this.currentAssistantBubble) return this.currentAssistantBubble;

    if (!this.messagesContainer) return null;

    const row = document.createElement('div');
    row.className = 'fvw-message-row fvw-assistant-row';
    row.innerHTML = `
      <div class="fvw-bubble fvw-assistant-bubble is-generating">
        <div class="fvw-bubble-header">
          <span class="fvw-speaker-label">${this.escapeHtml(theme)}</span>
          <span class="fvw-bubble-status" id="fvw-cur-assistant-status">⚡ Generating...</span>
        </div>
        <div class="fvw-bubble-text fvw-assistant-text">
          <span class="fvw-streaming-content"></span><span class="fvw-cursor">▌</span>
        </div>
        <div class="fvw-bubble-tools" style="display: none;"></div>
      </div>
    `;

    this.messagesContainer.appendChild(row);
    this.currentAssistantBubble = row;
    this.currentAssistantContentEl = row.querySelector('.fvw-streaming-content');
    this.currentAssistantStatusEl = row.querySelector('#fvw-cur-assistant-status');
    this.currentStreamingText = '';

    this.scrollToBottom();
    return this.currentAssistantBubble;
  }

  /**
   * Progressive token streaming onto the RIGHT side.
   */
  onAssistantToken(token, theme = 'JARVIS') {
    this.getOrCreateAssistantBubble(theme);
    this.currentStreamingText += token;

    if (this.currentAssistantContentEl) {
      this.currentAssistantContentEl.innerHTML = this.renderMarkdown(this.currentStreamingText);
    }
    this.setVoiceState('SPEAKING');
    this.showStopButton(true);
    this.scrollToBottom();
  }

  /**
   * Synchronizes text with spoken sentence (highlighting active spoken sentence).
   */
  onAssistantSentenceStart(sentence, themeKey, utteranceId) {
    this.isSpeaking = true;
    this.setVoiceState('SPEAKING');
    this.showStopButton(true);

    if (this.currentAssistantStatusEl) {
      this.currentAssistantStatusEl.textContent = '🔊 Speaking...';
    }

    if (this.currentAssistantContentEl && sentence) {
      const cleanSent = sentence.trim();
      // Highlight the active sentence within current assistant text
      const regex = new RegExp(`(${this.escapeRegex(cleanSent)})`, 'i');
      const html = this.currentAssistantContentEl.innerHTML;
      if (regex.test(html)) {
        this.currentAssistantContentEl.innerHTML = html.replace(
          regex,
          '<span class="fvw-active-sentence">$1</span>'
        );
      }
    }
  }

  onAssistantSentenceEnd(sentence, themeKey, utteranceId) {
    if (this.currentAssistantContentEl) {
      const activeEl = this.currentAssistantContentEl.querySelector('.fvw-active-sentence');
      if (activeEl) {
        activeEl.classList.remove('fvw-active-sentence');
        activeEl.classList.add('fvw-spoken-sentence');
      }
    }
  }

  onAssistantSpeechStart(theme, text) {
    this.isSpeaking = true;
    this.setVoiceState('SPEAKING');
    this.showStopButton(true);
  }

  onAssistantSpeechEnd(text) {
    this.isSpeaking = false;
    this.showStopButton(false);
    this.finalizeAssistantBubble(text);

    const canonical = this.app.voiceController?.getCanonicalState?.() || 'LISTENING';
    this.setVoiceState(canonical === 'LISTENING' ? 'LISTENING' : 'READY');
  }

  onAssistantDone(data = {}) {
    this.showStopButton(false);
    if (data.fullReply) {
      this.finalizeAssistantBubble(data.fullReply);
    }

    // Display tools executed
    if (this.currentAssistantBubble && Array.isArray(data.toolExecutions) && data.toolExecutions.length > 0) {
      const toolsEl = this.currentAssistantBubble.querySelector('.fvw-bubble-tools');
      if (toolsEl) {
        toolsEl.style.display = 'block';
        toolsEl.innerHTML = data.toolExecutions.map(t => `
          <div class="fvw-tool-pill">
            <span class="fvw-tool-icon">⚙️</span>
            <span class="fvw-tool-name">${this.escapeHtml(t.toolName || 'tool')}</span>
            <span class="fvw-tool-status">✓ Completed</span>
          </div>
        `).join('');
      }

      // If image generation tools were invoked, render image preview cards
      data.toolExecutions.forEach(t => {
        if ((t.toolName === 'generate_image' || t.toolName === 'edit_image') && t.result) {
          this.appendGeneratedImageCard(t.result);
        }
      });
    }

    this.currentAssistantBubble = null;
    this.currentAssistantContentEl = null;
    this.currentAssistantStatusEl = null;
    this.currentStreamingText = '';
    this.scrollToBottom();
  }

  appendGeneratedImageCard(imageMeta = {}) {
    if (!this.messagesContainer) return;
    const {
      imageId = '',
      fileName = '',
      prompt = '',
      style = 'realistic_photography',
      attribution = '',
      providerUsed = '',
      format = 'svg'
    } = imageMeta;

    const fileUrl = `/api/image/file/${encodeURIComponent(fileName || ('img_' + imageId + '.' + format))}`;
    const row = document.createElement('div');
    row.className = 'fvw-message-row fvw-assistant-row fvw-image-row';
    row.innerHTML = `
      <div class="fvw-bubble fvw-assistant-bubble fvw-image-bubble">
        <div class="fvw-bubble-header">
          <span class="fvw-speaker-label">JARVIS · Visual Synthesis</span>
          <span class="fvw-bubble-status">✓ Rendered</span>
        </div>
        <div class="fvw-image-card" id="fvw-img-${this.escapeHtml(imageId)}">
          <div class="fvw-image-preview-wrapper" onclick="window.open('${fileUrl}', '_blank')" title="Click to view full image in new tab">
            <img class="fvw-generated-img" src="${fileUrl}" alt="${this.escapeHtml(prompt)}" loading="lazy" />
            <div class="fvw-image-overlay">
              <span>🔍 Click to View Full Resolution</span>
            </div>
          </div>
          <div class="fvw-image-details">
            <div class="fvw-image-prompt">"${this.escapeHtml(prompt)}"</div>
            <div class="fvw-image-meta-bar">
              <span class="fvw-image-badge">${this.escapeHtml(style)}</span>
              <span class="fvw-image-provider">${this.escapeHtml(providerUsed || 'VISION')}</span>
            </div>
            ${attribution ? `<div class="fvw-image-attribution">${this.escapeHtml(attribution)}</div>` : ''}
            <div class="fvw-image-actions">
              <a href="${fileUrl}" download="${this.escapeHtml(fileName || 'image.jpg')}" class="fvw-btn-mini fvw-btn-download">⬇ Download</a>
              <button class="fvw-btn-mini" onclick="window.jarvisApp?.floatingVoiceWindow?.sendImageVariationPrompt('${this.escapeHtml(imageId)}', '${this.escapeHtml(prompt)}')">✦ Variation</button>
            </div>
          </div>
        </div>
      </div>
    `;
    this.messagesContainer.appendChild(row);
    this.scrollToBottom();
  }

  sendImageVariationPrompt(imageId, prompt) {
    if (!this.textInput) return;
    this.textInput.value = `Create a variation of image ${imageId}: ${prompt}`;
    this.textInput.focus();
  }

  async handleFileUpload(file) {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    this.appendUserMessage(`📎 Attached ${isImage ? 'image' : 'file'}: ${file.name} (${Math.round(file.size / 1024)} KB)`);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const base64Data = dataUrl.split(',')[1];
      const attachment = {
        name: file.name,
        type: file.type,
        data: base64Data
      };
      this.setVoiceState('THINKING');
      if (this.app?.dispatchStreamingQuery) {
        this.app.dispatchStreamingQuery(this.activePersonality, isImage ? `Analyze this image in detail: ${file.name}` : `Analyze this file: ${file.name}`, [attachment]);
      }
    };
    reader.readAsDataURL(file);
  }

  onAssistantError(err) {
    this.showStopButton(false);
    if (this.currentAssistantStatusEl) {
      this.currentAssistantStatusEl.textContent = '⚠️ Error';
    }
    if (this.currentAssistantContentEl) {
      this.currentAssistantContentEl.innerHTML += `<div class="fvw-error-text">Issue encountered: ${this.escapeHtml(err.message || 'Operation failed')}</div>`;
    }
    this.currentAssistantBubble = null;
    this.setVoiceState('ERROR');
  }

  finalizeAssistantBubble(fullText) {
    if (!this.currentAssistantBubble) return;

    this.currentAssistantBubble.querySelector('.fvw-assistant-bubble')?.classList.remove('is-generating');
    const cursor = this.currentAssistantBubble.querySelector('.fvw-cursor');
    if (cursor) cursor.remove();

    if (this.currentAssistantStatusEl) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.currentAssistantStatusEl.textContent = `✓ ${timeStr}`;
    }

    if (fullText && this.currentAssistantContentEl) {
      this.currentAssistantContentEl.innerHTML = this.renderMarkdown(fullText);
    }
  }

  // =========================================================================
  // 6. RIGHT-SIDE TEXT INPUT & CONTROLS
  // =========================================================================

  /**
   * Sends user-typed message without losing voice or conversation context!
   */
  async sendTextMessage() {
    if (!this.textInput) return;
    const text = this.textInput.value.trim();
    if (!text) return;

    this.textInput.value = '';
    this.textInput.style.height = 'auto';

    // 1. Post typed message to LEFT side
    this.appendUserMessage(text, { isSpoken: false });

    // 2. Dispatch query through existing JARVIS streaming pipeline
    this.setVoiceState('THINKING');
    this.app.dispatchStreamingQuery(this.activePersonality, text);
  }

  /**
   * Stop-speaking button: immediately halts speech synthesis and AI streaming.
   */
  stopSpeaking() {
    if (this._isStopping) return;
    this._isStopping = true;
    try {
      if (this.app.speechSynthesizer) {
        this.app.speechSynthesizer.stopSpeaking();
        this.app.speechSynthesizer.cancel();
      }
      if (this.app.aiClient) {
        this.app.aiClient.cancelActiveRequest();
      }
      this.isSpeaking = false;
      this.showStopButton(false);

      if (this.currentAssistantStatusEl) {
        this.currentAssistantStatusEl.textContent = '⏹️ Stopped';
      }
      this.finalizeAssistantBubble();

      const canonical = this.app.voiceController?.getCanonicalState?.() || 'LISTENING';
      this.setVoiceState(canonical === 'LISTENING' ? 'LISTENING' : 'READY');
    } finally {
      this._isStopping = false;
    }
  }

  showStopButton(show) {
    if (this.stopSpeechBtn) {
      this.stopSpeechBtn.style.display = show ? 'inline-flex' : 'none';
    }
  }

  /**
   * Toggles microphone active state.
   */
  async toggleMicrophone() {
    const isMuted = this.isMuted || this.currentVoiceState === 'MUTED' || (this.app.voiceController && this.app.voiceController.isMicrophoneMuted());
    if (isMuted) {
      this.isMuted = false;
      if (this.app.voiceController) {
        this.app.voiceController.setMuted(false);
      }
      if (typeof this.app.enableAutonomousVoice === 'function') {
        try { await this.app.enableAutonomousVoice('USER_CLICK_UNMUTE'); } catch (_) {}
      }
      this.setVoiceState('LISTENING');
    } else {
      this.isMuted = true;
      if (this.app.voiceController) {
        this.app.voiceController.setMuted(true);
      }
      this.setVoiceState('MUTED');
    }
  }

  /**
   * Explicitly ends active voice conversation session.
   */
  endVoiceSession() {
    if (this.app.voiceController) {
      this.app.voiceController.endSession('USER_ENDED_CONVERSATION');
      this.app.voiceController.setVoiceMode('DISABLED', { reason: 'USER_ENDED_CONVERSATION' });
    }
    this.setVoiceState('READY');
  }

  // =========================================================================
  // 7. VOICE EXPERIENCE & STATE BADGES
  // =========================================================================

  onVoiceStateChange(canonicalState, meta = {}) {
    if (this.isMuted && canonicalState !== 'MUTED') {
      return;
    }
    this.setVoiceState(canonicalState);
  }

  setVoiceState(state) {
    this.currentVoiceState = String(state || 'READY').toUpperCase();
    if (this.currentVoiceState === 'MUTED') {
      this.isMuted = true;
    } else if (this.currentVoiceState === 'LISTENING' || this.currentVoiceState === 'LIVE SPEECH' || this.currentVoiceState === 'LIVE_SPEECH') {
      this.isMuted = false;
    }
    if (!this.statusPillEl || !this.statusTextEl) return;

    this.statusPillEl.className = 'fvw-status-pill';
    let text = this.currentVoiceState;
    let waveformActive = false;

    switch (this.currentVoiceState) {
      case 'LISTENING':
        this.statusPillEl.classList.add('state-listening');
        text = 'LISTENING';
        waveformActive = true;
        this.updateMicIcon(true);
        break;
      case 'LIVE SPEECH':
      case 'LIVE_SPEECH':
        this.statusPillEl.classList.add('state-live');
        text = 'LIVE SPEECH';
        waveformActive = true;
        this.updateMicIcon(true);
        break;
      case 'PROCESSING':
      case 'THINKING':
        this.statusPillEl.classList.add('state-thinking');
        text = 'THINKING';
        waveformActive = false;
        break;
      case 'SPEAKING':
        this.statusPillEl.classList.add('state-speaking');
        text = 'SPEAKING';
        waveformActive = true;
        break;
      case 'MUTED':
      case 'PAUSED':
        this.statusPillEl.classList.add('state-muted');
        text = 'MUTED';
        waveformActive = false;
        this.updateMicIcon(false);
        break;
      case 'ERROR':
        this.statusPillEl.classList.add('state-error');
        text = 'ERROR';
        waveformActive = false;
        break;
      case 'DISABLED':
      case 'READY':
      default:
        this.statusPillEl.classList.add('state-ready');
        text = 'READY';
        waveformActive = false;
        this.updateMicIcon(false);
        break;
    }

    this.statusTextEl.textContent = text;

    // Waveform animation class
    if (this.waveformEl) {
      if (waveformActive) {
        this.waveformEl.classList.add('is-active');
      } else {
        this.waveformEl.classList.remove('is-active');
      }
    }

    this.updatePillStatus();
  }

  updateMicIcon(isListening) {
    if (this.micIconEl) {
      this.micIconEl.textContent = isListening ? '🎙️' : '🔇';
    }
  }

  updatePillStatus() {
    if (this.pillLabelEl) {
      this.pillLabelEl.textContent = `JARVIS · ${this.currentVoiceState}`;
    }
  }

  // =========================================================================
  // 8. CONVERSATION CONTINUITY & HISTORY
  // =========================================================================

  async loadConversationHistory() {
    try {
      const res = await fetch(`/api/conversation/history?personality=${this.activePersonality}`);
      if (!res.ok) return;

      const data = await res.json();
      const history = data.history || [];
      if (!this.messagesContainer || history.length === 0) return;

      // Keep welcome entry, append recent historical turns (up to 8)
      const recent = history.slice(-8);
      for (const item of recent) {
        if (item.role === 'user') {
          this.appendUserMessage(item.content, { isSpoken: item.source === 'voice' });
        } else if (item.role === 'assistant') {
          const row = document.createElement('div');
          row.className = 'fvw-message-row fvw-assistant-row';
          row.innerHTML = `
            <div class="fvw-bubble fvw-assistant-bubble">
              <div class="fvw-bubble-header">
                <span class="fvw-speaker-label">JARVIS</span>
                <span class="fvw-bubble-status">✓ History</span>
              </div>
              <div class="fvw-bubble-text">${this.renderMarkdown(item.content)}</div>
            </div>
          `;
          this.messagesContainer.appendChild(row);
        }
      }
      this.scrollToBottom();
    } catch (_) {}
  }

  // =========================================================================
  // 9. UTILITIES & MARKDOWN RENDERING
  // =========================================================================

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeRegex(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  renderMarkdown(text) {
    if (!text) return '';
    let out = String(text);

    // Code blocks
    out = out.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, (m, lang, code) => {
      return `<pre class="fvw-code-block"><code>${this.escapeHtml(code.trim())}</code></pre>`;
    });

    // Inline code
    out = out.replace(/`([^`\n]+)`/g, (m, code) => `<code class="fvw-inline-code">${this.escapeHtml(code)}</code>`);

    // Bold & italic
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Paragraph linebreaks
    out = out.replace(/\n\n+/g, '<br/><br/>');
    out = out.replace(/\n/g, '<br/>');

    return out;
  }
}
