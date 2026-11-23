/**
 * VISION AI — ChatGPT-Grade Conversational Text Chat Experience
 * Implements Part 12:
 * - Multi-turn conversational history with stable turn identifiers.
 * - Progressive SSE streaming responses with abort/cancel controls.
 * - Rich markdown rendering: headings, bold, bullet lists, blockquotes.
 * - Syntax-highlighted code blocks with 1-click "Copy Code" button and visual confirmation.
 * - Real-time tool execution badges and web research source cards with clickable links.
 * - Multilingual Unicode & Hindi Devanagari rendering.
 * - Conversation session export and clear controls.
 * - Global hotkey toggle: Ctrl + Shift + Space.
 */

export class ChatExperience {
  constructor(app) {
    this.app = app;
    this.activePersonality = app.currentTheme || 'JARVIS';
    this.isOpen = false;
    this.isStreaming = false;
    this.activeAbortController = null;
    this.history = [];

    this.initElements();
    this.bindEvents();
    this.loadInitialHistory();
  }

  initElements() {
    this.overlay = document.getElementById('chat-experience-overlay');
    this.messagesContainer = document.getElementById('chat-messages-container');
    this.chatInput = document.getElementById('chat-experience-input');
    this.sendBtn = document.getElementById('chat-send-btn');
    this.stopBtn = document.getElementById('chat-stop-btn');
    this.closeBtn = document.getElementById('chat-close-btn');
    this.clearBtn = document.getElementById('chat-clear-btn');
    this.exportBtn = document.getElementById('chat-export-btn');
    this.personalityBadge = document.getElementById('chat-personality-badge');
    this.providerSelect = document.getElementById('chat-provider-select');
    this.openBtn = document.getElementById('open-command-bar-btn');
  }

  bindEvents() {
    // Global Hotkey: Ctrl + Shift + Space
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Electron Preload IPC binding
    if (window.desktopAPI?.onOpenCommandBar) {
      window.desktopAPI.onOpenCommandBar(() => {
        this.open();
      });
    }

    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.open());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.sendMessage());
    }

    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', () => this.stopStreaming());
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.clearChat());
    }

    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => this.exportChat());
    }

    if (this.chatInput) {
      this.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Auto-resize textarea
      this.chatInput.addEventListener('input', () => {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(160, this.chatInput.scrollHeight) + 'px';
      });
    }
  }

  setPersonality(personality) {
    this.activePersonality = personality || 'JARVIS';
    if (this.personalityBadge) {
      this.personalityBadge.textContent = this.activePersonality;
      this.personalityBadge.className = 'chat-personality-tag ' + (this.activePersonality === 'ULTRON' ? 'ultron-tag' : 'jarvis-tag');
    }
  }

  open() {
    this.isOpen = true;
    this.setPersonality(this.app.targetTheme || this.app.currentTheme || 'JARVIS');
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      setTimeout(() => {
        if (this.chatInput) {
          this.chatInput.focus();
        }
        this.scrollToBottom();
      }, 50);
    }
  }

  close() {
    this.isOpen = false;
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }

  async loadInitialHistory() {
    try {
      const res = await fetch(`/api/conversation/history?personality=${this.activePersonality}`);
      if (res.ok) {
        const data = await res.json();
        const history = data.history || [];
        if (this.messagesContainer && history.length > 0) {
          this.messagesContainer.innerHTML = '';
          history.forEach(item => {
            if (item.role === 'user') {
              this.appendUserMessage(item.content);
            } else if (item.role === 'assistant') {
              this.appendAssistantMessage(item.content, {
                personality: item.personality || this.activePersonality,
                toolResult: item.toolResult
              });
            }
          });
        }
      }
    } catch (e) {
      // Backend history load error ignored
    }
  }

  async sendMessage() {
    if (!this.chatInput) return;
    const text = this.chatInput.value.trim();
    if (!text || this.isStreaming) return;

    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    // 1. Append User Message
    this.appendUserMessage(text);
    this.scrollToBottom();

    // 2. Prepare Assistant Streaming Message Placeholder
    this.isStreaming = true;
    this.updateControlsState(true);
    this.activeAbortController = new AbortController();

    const assistantBubble = this.createAssistantMessageBubble(this.activePersonality);
    const contentEl = assistantBubble.querySelector('.message-text');
    const metaEl = assistantBubble.querySelector('.message-meta');
    const toolsContainer = assistantBubble.querySelector('.message-tools');

    let fullResponseText = '';

    try {
      let token = this.app?.aiClient ? await this.app.aiClient.getAuthToken() : null;
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['X-Stark-Auth-Token'] = token;
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Stream via Server-Sent Events (/api/chat/stream)
      let res = await fetch('/api/chat/stream', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          message: text,
          personality: this.activePersonality,
          providerMode: this.providerSelect?.value || 'auto'
        }),
        signal: this.activeAbortController.signal
      });

      if (res.status === 401 && this.app?.aiClient) {
        token = await this.app.aiClient.getAuthToken(true);
        if (token) {
          headers['X-Stark-Auth-Token'] = token;
          headers['Authorization'] = `Bearer ${token}`;
          res = await fetch('/api/chat/stream', {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({
              message: text,
              personality: this.activePersonality,
              providerMode: this.providerSelect?.value || 'auto'
            }),
            signal: this.activeAbortController.signal
          });
        }
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to reach assistant.`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      const renderedExecutionIds = new Set();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (!dataStr) continue;
            try {
              const parsed = JSON.parse(dataStr);

              // Handle tool event
              if (parsed.toolName && parsed.toolResult) {
                const execId = parsed.toolResult.executionId || `${parsed.toolName}_${Date.now()}`;
                if (!renderedExecutionIds.has(execId)) {
                  renderedExecutionIds.add(execId);
                  this.renderToolResult(toolsContainer, parsed.toolName, parsed.toolResult, execId);
                }
              }

              // Handle streaming sentences / partial reply
              if (parsed.sentence) {
                fullResponseText += (fullResponseText ? ' ' : '') + parsed.sentence;
                contentEl.innerHTML = this.renderMarkdown(fullResponseText);
                this.bindCopyButtons(contentEl);
                this.scrollToBottom();
              }

              // Handle completion
              if (parsed.fullReply) {
                if (parsed.voiceProsody && this.app?.speechSynthesizer?.setProsodyProfile) {
                  this.app.speechSynthesizer.setProsodyProfile(parsed.voiceProsody);
                }
                fullResponseText = parsed.fullReply;
                contentEl.innerHTML = this.renderMarkdown(fullResponseText);
                this.bindCopyButtons(contentEl);
                if (metaEl) {
                  const used = parsed.providerUsed ? `${parsed.providerUsed} (${parsed.provider || 'AI Engine'})` : (parsed.provider || 'AI Engine');
                  const fb = parsed.fallbackUsed ? ` [fallback: ${parsed.fallbackReason || 'yes'}]` : '';
                  metaEl.textContent = `${used}${fb} • ${parsed.tCompletedMs || parsed.latencyMs || 0}ms`;
                }
                if (parsed.toolResult) {
                  const resolvedToolName = parsed.toolResult.toolName || parsed.toolName || 'tool';
                  const execId = parsed.toolResult.executionId || `${resolvedToolName}_done`;
                  const alreadyRendered = renderedExecutionIds.has(execId) ||
                    Array.from(toolsContainer.querySelectorAll('.tool-execution-card')).some(c => 
                      c.dataset.executionId === execId || (c.dataset.tool && c.dataset.tool !== 'tool' && c.dataset.tool === resolvedToolName)
                    );
                  if (!alreadyRendered) {
                    renderedExecutionIds.add(execId);
                    this.renderToolResult(toolsContainer, resolvedToolName, parsed.toolResult, execId);
                  }
                }
              }
            } catch (err) {}
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        contentEl.innerHTML += `<div class="chat-system-notice">⏹️ Response generation cancelled by user.</div>`;
      } else {
        contentEl.innerHTML = `<div class="chat-error-notice">⚠️ Error: ${err.message}. Retrying or check network connection.</div>`;
      }
    } finally {
      this.isStreaming = false;
      this.activeAbortController = null;
      this.updateControlsState(false);
      this.scrollToBottom();
    }
  }

  stopStreaming() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.isStreaming = false;
    this.updateControlsState(false);
  }

  updateControlsState(isStreaming) {
    if (this.sendBtn) this.sendBtn.style.display = isStreaming ? 'none' : 'flex';
    if (this.stopBtn) this.stopBtn.style.display = isStreaming ? 'flex' : 'none';
  }

  appendUserMessage(text) {
    if (!this.messagesContainer) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message-row user-row';
    msgDiv.innerHTML = `
      <div class="chat-message-bubble user-bubble">
        <div class="message-content">${this.escapeHtml(text)}</div>
      </div>
    `;
    this.messagesContainer.appendChild(msgDiv);
  }

  createAssistantMessageBubble(personality) {
    const isUltron = personality === 'ULTRON';
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message-row assistant-row ${isUltron ? 'ultron-assistant' : 'jarvis-assistant'}`;
    msgDiv.innerHTML = `
      <div class="assistant-avatar">${isUltron ? '🔴' : '💠'}</div>
      <div class="chat-message-bubble assistant-bubble">
        <div class="assistant-header-row">
          <span class="assistant-name">${isUltron ? 'ULTRON' : 'JARVIS'}</span>
          <span class="message-meta">Thinking...</span>
        </div>
        <div class="message-tools"></div>
        <div class="message-text"><span class="chat-pulsing-cursor">●</span></div>
      </div>
    `;
    this.messagesContainer.appendChild(msgDiv);
    return msgDiv;
  }

  appendAssistantMessage(text, meta = {}) {
    const bubble = this.createAssistantMessageBubble(meta.personality || this.activePersonality);
    const contentEl = bubble.querySelector('.message-text');
    const metaEl = bubble.querySelector('.message-meta');
    const toolsContainer = bubble.querySelector('.message-tools');

    contentEl.innerHTML = this.renderMarkdown(text);
    this.bindCopyButtons(contentEl);

    if (metaEl) {
      metaEl.textContent = meta.provider || meta.personality || 'VISION AI';
    }

    if (meta.toolResult) {
      const toolName = meta.toolResult.toolName || meta.toolName || 'tool';
      this.renderToolResult(toolsContainer, toolName, meta.toolResult, meta.toolResult.executionId);
    }
  }

  renderToolResult(container, toolName, toolResult, executionId = null) {
    if (!container) return;
    const resolvedExecId = executionId || toolResult?.executionId || `${toolName}_${Date.now()}`;
    
    // Check if card for this exact execution or tool already exists
    let existing = null;
    if (resolvedExecId) {
      existing = container.querySelector(`[data-execution-id="${resolvedExecId}"]`);
    }
    if (!existing && toolName && toolName !== 'tool') {
      existing = container.querySelector(`[data-tool="${toolName}"]`);
    }
    if (existing) {
      return; // Do not duplicate
    }

    const toolCard = document.createElement('div');
    toolCard.className = 'tool-execution-card';
    toolCard.dataset.tool = toolName;
    toolCard.dataset.executionId = resolvedExecId;

    const isSuccess = toolResult.success !== false && !toolResult.error;
    const statusText = isSuccess ? 'SUCCESS' : 'FAILED';
    const statusClass = isSuccess ? 'status-success' : 'status-failed';

    const summary = toolResult.summary || toolResult.confirmation || toolResult.output || toolResult.error || JSON.stringify(toolResult);
    const cleanCardSummary = (toolName === 'get_live_news' && Array.isArray(toolResult.articles))
      ? `Retrieved ${toolResult.articles.length} live article(s) for "${toolResult.sourceFilter || toolResult.topic || 'news'}" via ${toolResult.providerUsed || 'live feed'}.`
      : String(summary).replace(/\b(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{24,}\b/g, '').slice(0, 300);

    toolCard.innerHTML = `
      <div class="tool-card-header">
        <span class="tool-icon">${isSuccess ? '⚡' : '⚠️'}</span>
        <span class="tool-name">${this.escapeHtml(toolName)}</span>
        <span class="tool-status-badge ${statusClass}">${statusText}</span>
      </div>
      <div class="tool-card-body">${this.escapeHtml(cleanCardSummary)}</div>
    `;

    // Live Latest News Cards
    if (toolName === 'get_live_news' && Array.isArray(toolResult.articles)) {
      if (toolResult.articles.length === 0) {
        const emptyBox = document.createElement('div');
        emptyBox.className = 'news-empty-state';
        emptyBox.textContent = toolResult.offline
          ? 'Offline: Connect to the internet to fetch live headlines.'
          : (toolResult.summary || 'No parseable news articles were found for this query.');
        toolCard.appendChild(emptyBox);
      } else {
        const newsGrid = document.createElement('div');
        newsGrid.className = 'chat-news-cards-grid';
        toolResult.articles.slice(0, 6).forEach(art => {
          const card = document.createElement('div');
          card.className = 'chat-news-card';
          const safeHref = /^https?:\/\//i.test(art.url || art.link || '') ? (art.url || art.link) : '#';
          card.innerHTML = `
            <div class="chat-news-meta">
              <span class="chat-news-source">${this.escapeHtml(art.source || art.publisher || 'News')}</span>
              <span class="chat-news-date">${this.escapeHtml(art.publishedDisplay || art.publishedAt || 'Recent')}</span>
            </div>
            <a class="chat-news-headline" href="${this.escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(art.headline || art.title || 'Untitled Article')}</a>
            <p class="chat-news-summary">${this.escapeHtml(art.summary || art.snippet || '')}</p>
            <div class="chat-news-footer">
              <a class="chat-news-read-link" href="${this.escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">Read full article ↗</a>
            </div>
          `;
          newsGrid.appendChild(card);
        });
        toolCard.appendChild(newsGrid);
      }
    }

    // If web research with citations, render clickable source cards
    if (toolName === 'web_research' && toolResult.results && Array.isArray(toolResult.results)) {
      const sourcesDiv = document.createElement('div');
      sourcesDiv.className = 'tool-sources-grid';
      toolResult.results.slice(0, 3).forEach(src => {
        const srcCard = document.createElement('a');
        srcCard.className = 'source-citation-card';
        srcCard.href = src.sourceUrl || '#';
        srcCard.target = '_blank';
        srcCard.rel = 'noopener noreferrer';
        srcCard.innerHTML = `
          <span class="source-title">${this.escapeHtml(src.title || 'Source')}</span>
          <span class="source-snippet">${this.escapeHtml(src.snippet ? src.snippet.slice(0, 110) + '...' : '')}</span>
          <span class="source-domain">🔗 ${this.escapeHtml(src.sourceName || 'Web Source')}</span>
        `;
        sourcesDiv.appendChild(srcCard);
      });
      toolCard.appendChild(sourcesDiv);
    }

    container.appendChild(toolCard);
    this.scrollToBottom();
  }

  renderMarkdown(text) {
    if (!text) return '';

    let out = String(text);

    // 1. Code blocks with language header and copy button
    out = out.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'code';
      const cleanCode = this.escapeHtml(code.trim());
      return `
        <div class="code-block-wrapper">
          <div class="code-header">
            <span class="code-lang-label">${language}</span>
            <button class="copy-code-btn" data-code="${encodeURIComponent(code.trim())}">📋 Copy Code</button>
          </div>
          <pre><code class="language-${language}">${cleanCode}</code></pre>
        </div>
      `;
    });

    // 2. Inline code
    out = out.replace(/`([^`\n]+)`/g, (match, code) => `<code class="inline-code">${this.escapeHtml(code)}</code>`);

    // 3. Headings (#, ##, ###)
    out = out.replace(/^### (.*$)/gim, '<h3 class="chat-h3">$1</h3>');
    out = out.replace(/^## (.*$)/gim, '<h2 class="chat-h2">$1</h2>');
    out = out.replace(/^# (.*$)/gim, '<h1 class="chat-h1">$1</h1>');

    // 3b. Clickable Markdown Links [label](https://url) — sanitize and prevent raw CBMi... token leaks
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, href) => {
      const cleanLabel = /\b(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{24,}\b/.test(label) ? 'Read Article' : label;
      return `<a class="chat-md-link" href="${this.escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${cleanLabel}</a>`;
    });

    // 3c. Scrub any bare opaque Google News protobuf token if not inside a URL attribute
    out = out.replace(/(^|\s)(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{32,}\b/g, '$1');

    // 4. Bold & Italic
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 5. Blockquotes
    out = out.replace(/^\> (.*$)/gim, '<blockquote class="chat-quote">$1</blockquote>');

    // 6. Bullet lists
    out = out.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li class="chat-list-item">$1</li>');
    out = out.replace(/(<li class="chat-list-item">.*<\/li>)/gms, '<ul class="chat-list">$1</ul>');

    // 7. Paragraph line breaks
    out = out.replace(/\n\n+/g, '<div class="chat-para-break"></div>');
    out = out.replace(/\n/g, '<br/>');

    return out;
  }

  bindCopyButtons(container) {
    const copyBtns = container.querySelectorAll('.copy-code-btn');
    copyBtns.forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const rawCode = decodeURIComponent(btn.dataset.code || '');
        try {
          await navigator.clipboard.writeText(rawCode);
          const original = btn.textContent;
          btn.textContent = '✓ Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('copied');
          }, 2000);
        } catch (err) {
          btn.textContent = 'Failed';
        }
      });
    });
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async clearChat() {
    if (!confirm('Clear all conversation history?')) return;
    try {
      await fetch('/api/reset-conversation', { method: 'POST' });
      if (this.messagesContainer) {
        this.messagesContainer.innerHTML = `
          <div class="chat-welcome-banner">
            <h3>VISION AI Conversational Matrix Cleared</h3>
            <p>Ready for questions, deep technical reasoning, code generation, and computer tasks.</p>
          </div>
        `;
      }
    } catch (e) {
      alert('Error clearing conversation: ' + e.message);
    }
  }

  async exportChat() {
    try {
      const res = await fetch('/api/conversation/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stark_conversation_session_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error exporting conversation: ' + e.message);
    }
  }
}
