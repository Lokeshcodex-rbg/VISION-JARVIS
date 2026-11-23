/**
 * ULTRON × JARVIS — AI Client Module
 * Communicates with backend /api/chat and handles request aborts/cancellation.
 */

export class AIClient {
  constructor(endpoint = '/api/chat', streamEndpoint = '/api/chat/stream') {
    this.endpoint = endpoint;
    this.streamEndpoint = streamEndpoint;
    this.currentAbortController = null;
    this.isQuerying = false;
    this.isEmergencyStopped = false;
    this._cachedToken = null;
  }

  /**
   * Retrieves or refreshes the active STARK cryptographic session token
   */
  async getAuthToken(forceRefresh = false) {
    if (!forceRefresh && this._cachedToken && this._cachedToken.length === 64) {
      return this._cachedToken;
    }
    if (!forceRefresh) {
      try {
        const stored = sessionStorage.getItem('stark_auth_token');
        if (stored && stored.length === 64) {
          this._cachedToken = stored;
          return stored;
        }
      } catch (_) {}
    }

    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.token && data.token.length === 64) {
          this._cachedToken = data.token;
          try { sessionStorage.setItem('stark_auth_token', data.token); } catch (_) {}
          return data.token;
        }
      }
    } catch (e) {
      console.warn('[AI_CLIENT] Session negotiation fallback warning:', e.message);
    }
    return this._cachedToken;
  }

  /**
   * Streams response progressively from /api/chat/stream, emitting token & sentence chunks
   * as soon as they are completed by the upstream model.
   * @param {'JARVIS' | 'ULTRON'} personality
   * @param {string} message
   * @param {object} callbacks - { onTool, onToken, onSentence, onDone, onError }
   * @param {object|null} timings - Optional lifecycle timestamps (tSpeechEnd, tTranscribed, tReqSubmitted)
   * @param {Array} attachments - Optional multimodal file attachments (images, PDFs)
   */
  async streamMessage(personality, message, { onTool, onToken, onSentence, onDone, onError }, timings = null, attachments = []) {
    if (this.isEmergencyStopped) {
      return { aborted: true, emergencyStopped: true };
    }

    this.cancelActiveRequest();

    const controller = new AbortController();
    this.currentAbortController = controller;
    this.isQuerying = true;

    try {
      let token = await this.getAuthToken();
      if (controller.signal.aborted) {
        return { aborted: true };
      }
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['X-Stark-Auth-Token'] = token;
        headers['Authorization'] = `Bearer ${token}`;
      }

      let response = await fetch(this.streamEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ personality, message, timings, attachments }),
        signal: controller.signal
      });

      // Self-heal: If session cookie/token expired or was invalidated by server restart, auto-refresh and retry once
      if (response.status === 401 || response.status === 403) {
        console.info('[AI_CLIENT] Session token expired or unauthenticated; re-negotiating active session token...');
        token = await this.getAuthToken(true);
        if (controller.signal.aborted) {
          return { aborted: true };
        }
        if (token) {
          headers['X-Stark-Auth-Token'] = token;
          headers['Authorization'] = `Bearer ${token}`;
          response = await fetch(this.streamEndpoint, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ personality, message, timings, attachments }),
            signal: controller.signal
          });
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let hasCalledOnError = false;
      const emitError = (err) => {
        if (hasCalledOnError) return;
        hasCalledOnError = true;
        if (typeof onError === 'function') {
          onError(err);
        }
      };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let currentEvent = 'message';
      let currentDataLines = [];

      while (true) {
        if (this.isEmergencyStopped) {
          try { reader.cancel(); } catch (e) {}
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split(/\r?\n/);
        sseBuffer = lines.pop(); // keep partial trailing line

        for (const line of lines) {
          if (this.isEmergencyStopped) break;

          if (line === '') {
            // Empty line marks end of event per SSE standard
            if (currentDataLines.length > 0) {
              const fullDataStr = currentDataLines.join('\n');
              currentDataLines = [];
              try {
                const data = JSON.parse(fullDataStr);

                if (this.isEmergencyStopped) break;

                if (currentEvent === 'token' && typeof onToken === 'function') {
                  onToken(data.token, data);
                } else if (currentEvent === 'tool' && typeof onTool === 'function') {
                  onTool(data);
                } else if (currentEvent === 'sentence' && typeof onSentence === 'function') {
                  onSentence(data.sentence, data.index, data);
                } else if (currentEvent === 'done' && typeof onDone === 'function') {
                  onDone(data);
                } else if (currentEvent === 'error') {
                  emitError(new Error(data.error || 'Stream error'));
                }
              } catch (parseErr) {
                // Ignore malformed non-JSON data
              }
            }
            currentEvent = 'message';
            continue;
          }

          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentDataLines.push(line.slice(6));
          } else if (line.startsWith(':')) {
            // Comment line, ignore
          }
        }
      }

      // Flush any unconsumed trailing buffer and event if connection ended without trailing empty line
      if (!this.isEmergencyStopped && sseBuffer && sseBuffer.trim()) {
        const trailingLines = sseBuffer.split(/\r?\n/);
        for (const line of trailingLines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentDataLines.push(line.slice(6));
          }
        }
      }

      if (!this.isEmergencyStopped && currentDataLines.length > 0) {
        try {
          const data = JSON.parse(currentDataLines.join('\n'));
          if (currentEvent === 'token' && typeof onToken === 'function') {
            onToken(data.token, data);
          } else if (currentEvent === 'sentence' && typeof onSentence === 'function') {
            onSentence(data.sentence, data.index, data);
          } else if (currentEvent === 'done' && typeof onDone === 'function') {
            onDone(data);
          } else if (currentEvent === 'tool' && typeof onTool === 'function') {
            onTool(data);
          }
        } catch (e) {}
      }

      return { success: true };
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return { aborted: true };
      }
      console.warn('[AI_CLIENT] Streaming error encountered:', err.message);
      if (typeof emitError === 'function') {
        emitError(err);
      } else if (typeof onError === 'function') {
        onError(err);
      }
      return { success: false, error: err.message };
    } finally {
      if (this.currentAbortController === controller) {
        this.isQuerying = false;
        this.currentAbortController = null;
      }
    }
  }

  /**
   * Dispatches user message to active AI personality backend
   * @param {'JARVIS' | 'ULTRON'} personality
   * @param {string} message
   * @returns {Promise<{reply: string, personality: string, provider: string, toolResult?: object}>}
   */
  async sendMessage(personality, message, attachments = []) {
    if (this.isEmergencyStopped) {
      return { reply: null, aborted: true, emergencyStopped: true };
    }

    this.cancelActiveRequest();

    const controller = new AbortController();
    this.currentAbortController = controller;
    this.isQuerying = true;

    try {
      let token = await this.getAuthToken();
      if (controller.signal.aborted) {
        return { reply: null, aborted: true };
      }
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['X-Stark-Auth-Token'] = token;
        headers['Authorization'] = `Bearer ${token}`;
      }

      let response = await fetch(this.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ personality, message, attachments }),
        signal: controller.signal
      });

      if (response.status === 401) {
        token = await this.getAuthToken(true);
        if (controller.signal.aborted) {
          return { reply: null, aborted: true };
        }
        if (token) {
          headers['X-Stark-Auth-Token'] = token;
          headers['Authorization'] = `Bearer ${token}`;
          response = await fetch(this.endpoint, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ personality, message, attachments }),
            signal: controller.signal
          });
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return { reply: null, aborted: true };
      }
      console.warn('[AI_CLIENT] Request failed:', err);
      return {
        reply: personality === 'ULTRON' 
          ? 'System warning: Backend communication channel failure.' 
          : 'I apologize, sir, but I am unable to connect to the backend server at this moment.',
        error: err.message
      };
    } finally {
      if (this.currentAbortController === controller) {
        this.isQuerying = false;
        this.currentAbortController = null;
      }
    }
  }

  cancelActiveRequest() {
    if (this.currentAbortController) {
      try {
        this.currentAbortController.abort();
      } catch (e) {}
      this.currentAbortController = null;
    }
    this.isQuerying = false;
  }

  handleEmergencyStop(reason = 'EMERGENCY_STOP') {
    this.isEmergencyStopped = true;
    this.cancelActiveRequest();
  }

  resetEmergencyStop() {
    this.isEmergencyStopped = false;
  }
}
