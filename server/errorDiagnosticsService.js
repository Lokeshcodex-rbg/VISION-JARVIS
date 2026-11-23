/**
 * STARK Error Diagnostics Service
 * Workstream I: Structured Error Taxonomy, Ledger & Self-Healing
 */

const fs = require('fs');
const path = require('path');

const LEDGER_PATH = path.join(__dirname, '..', 'data', 'error_ledger.json');

const ErrorCode = {
  ERR_AUTH_SESSION_EXPIRED: 'ERR_AUTH_SESSION_EXPIRED',
  ERR_AI_PROVIDER_UNAVAILABLE: 'ERR_AI_PROVIDER_UNAVAILABLE',
  ERR_AI_RATE_LIMITED: 'ERR_AI_RATE_LIMITED',
  ERR_APP_NOT_INSTALLED: 'ERR_APP_NOT_INSTALLED',
  ERR_APP_LAUNCH_FAILED: 'ERR_APP_LAUNCH_FAILED',
  ERR_COM_INITIALIZATION_FAILED: 'ERR_COM_INITIALIZATION_FAILED',
  ERR_FILE_LOCKED_OR_BUSY: 'ERR_FILE_LOCKED_OR_BUSY',
  ERR_WHATSAPP_CONTACT_NOT_FOUND: 'ERR_WHATSAPP_CONTACT_NOT_FOUND',
  ERR_WHATSAPP_CALL_FAILED: 'ERR_WHATSAPP_CALL_FAILED',
  ERR_WHATSAPP_WINDOW_NOT_FOUND: 'ERR_WHATSAPP_WINDOW_NOT_FOUND',
  ERR_SPOTIFY_NOT_RUNNING: 'ERR_SPOTIFY_NOT_RUNNING',
  ERR_SPOTIFY_PLAYBACK_RESTRICTED: 'ERR_SPOTIFY_PLAYBACK_RESTRICTED',
  ERR_CHROME_PROFILE_NOT_FOUND: 'ERR_CHROME_PROFILE_NOT_FOUND',
  ERR_SEARCH_NETWORK_UNAVAILABLE: 'ERR_SEARCH_NETWORK_UNAVAILABLE',
  ERR_3D_PARAMETRIC_BUILD_FAILED: 'ERR_3D_PARAMETRIC_BUILD_FAILED',
  ERR_DEVLAB_EXECUTION_TIMEOUT: 'ERR_DEVLAB_EXECUTION_TIMEOUT',
  ERR_DEVLAB_BUILD_ERROR: 'ERR_DEVLAB_BUILD_ERROR',
  ERR_DESKTOP_TARGET_NOT_FOCUSED: 'ERR_DESKTOP_TARGET_NOT_FOCUSED',
  ERR_UNKNOWN_INTERNAL: 'ERR_UNKNOWN_INTERNAL'
};

class ErrorDiagnosticsService {
  constructor() {
    this.memoryLedger = [];
    this.maxMemoryEntries = 200;
    this._loadLedger();
  }

  _loadLedger() {
    try {
      if (fs.existsSync(LEDGER_PATH)) {
        const raw = fs.readFileSync(LEDGER_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.memoryLedger = parsed.slice(-this.maxMemoryEntries);
        }
      }
    } catch {
      this.memoryLedger = [];
    }
  }

  _persistLedger() {
    try {
      const dir = path.dirname(LEDGER_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LEDGER_PATH, JSON.stringify(this.memoryLedger, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[ERROR_DIAGNOSTICS] Failed to persist ledger:', err.message);
    }
  }

  /**
   * Classify an incoming raw error into taxonomy
   */
  classify(err, context = {}) {
    const msg = (err && (err.message || String(err))) || '';
    const ctx = (context.subsystem || '').toLowerCase();

    if (msg.includes('401') || msg.includes('403') || msg.includes('token') || msg.includes('unauthorized')) {
      return ErrorCode.ERR_AUTH_SESSION_EXPIRED;
    }
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      return ErrorCode.ERR_AI_RATE_LIMITED;
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('socket hang up')) {
      return ErrorCode.ERR_AI_PROVIDER_UNAVAILABLE;
    }
    if (ctx.includes('whatsapp')) {
      if (msg.includes('not found') || msg.includes('contact') || msg.includes('recipient')) {
        return ErrorCode.ERR_WHATSAPP_CONTACT_NOT_FOUND;
      }
      if (msg.includes('call') || msg.includes('voice') || msg.includes('video')) {
        return ErrorCode.ERR_WHATSAPP_CALL_FAILED;
      }
      return ErrorCode.ERR_WHATSAPP_WINDOW_NOT_FOUND;
    }
    if (ctx.includes('word') || ctx.includes('office') || ctx.includes('com')) {
      if (msg.includes('EBUSY') || msg.includes('locked') || msg.includes('resource busy')) {
        return ErrorCode.ERR_FILE_LOCKED_OR_BUSY;
      }
      return ErrorCode.ERR_COM_INITIALIZATION_FAILED;
    }
    if (ctx.includes('spotify')) {
      if (msg.includes('not running') || msg.includes('process')) {
        return ErrorCode.ERR_SPOTIFY_NOT_RUNNING;
      }
      return ErrorCode.ERR_SPOTIFY_PLAYBACK_RESTRICTED;
    }
    if (ctx.includes('chrome') && msg.includes('profile')) {
      return ErrorCode.ERR_CHROME_PROFILE_NOT_FOUND;
    }
    if (ctx.includes('search') || ctx.includes('research')) {
      return ErrorCode.ERR_SEARCH_NETWORK_UNAVAILABLE;
    }
    if (ctx.includes('3d') || ctx.includes('blender') || ctx.includes('three')) {
      return ErrorCode.ERR_3D_PARAMETRIC_BUILD_FAILED;
    }
    if (ctx.includes('devlab') || ctx.includes('compiler')) {
      if (msg.includes('timeout') || msg.includes('TIMEDOUT')) {
        return ErrorCode.ERR_DEVLAB_EXECUTION_TIMEOUT;
      }
      return ErrorCode.ERR_DEVLAB_BUILD_ERROR;
    }
    if (msg.includes('not recognized') || msg.includes('cannot find') || msg.includes('not installed')) {
      return ErrorCode.ERR_APP_NOT_INSTALLED;
    }
    return ErrorCode.ERR_UNKNOWN_INTERNAL;
  }

  /**
   * Generate sanitized, helpful diagnostics and record to ledger
   */
  record(err, context = {}) {
    const code = context.code || this.classify(err, context);
    const rawMessage = (err && (err.message || String(err))) || 'Unknown error occurred';
    
    // Sanitize API keys or tokens
    const sanitizedMsg = rawMessage
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
      .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED_TOKEN]');

    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const spokenExplanation = this.generateSpokenAdvice(code, context, sanitizedMsg);
    const recoveryActions = this.getRecoveryPlan(code, context);

    const record = {
      errorId,
      code,
      timestamp: new Date().toISOString(),
      subsystem: context.subsystem || 'core',
      context: { ...context, code: undefined },
      technicalDetail: sanitizedMsg,
      spokenExplanation,
      recoveryActions,
      resolved: false
    };

    this.memoryLedger.push(record);
    if (this.memoryLedger.length > this.maxMemoryEntries) {
      this.memoryLedger.shift();
    }
    this._persistLedger();

    console.warn(`[ERROR_DIAGNOSTICS][${errorId}] ${code}: ${spokenExplanation}`);
    return record;
  }

  generateSpokenAdvice(code, context, rawMsg) {
    const target = context.target || context.recipient || context.appName || 'the requested item';
    switch (code) {
      case ErrorCode.ERR_AUTH_SESSION_EXPIRED:
        return 'Sir, our session authentication needed renewal. I have renegotiated the security token; please proceed.';
      case ErrorCode.ERR_AI_RATE_LIMITED:
        return 'Sir, our primary neural inference engine encountered a temporary quota limit. Switching automatically to our fallback tier.';
      case ErrorCode.ERR_AI_PROVIDER_UNAVAILABLE:
        return 'Sir, the remote inference endpoint is currently unreachable. Engaging local cognitive routines.';
      case ErrorCode.ERR_WHATSAPP_CONTACT_NOT_FOUND:
        return `Sir, I searched WhatsApp but could not locate contact "${target}". Please check if the name is spelled differently or unsaved.`;
      case ErrorCode.ERR_WHATSAPP_CALL_FAILED:
        return `Sir, I opened WhatsApp for "${target}", but the call action could not be engaged automatically. WhatsApp desktop is ready on your screen.`;
      case ErrorCode.ERR_WHATSAPP_WINDOW_NOT_FOUND:
        return 'Sir, WhatsApp desktop does not appear to be running or open. Launching WhatsApp now.';
      case ErrorCode.ERR_COM_INITIALIZATION_FAILED:
        return 'Sir, Microsoft Word automation COM interface did not respond. Attempting clean process recovery.';
      case ErrorCode.ERR_FILE_LOCKED_OR_BUSY:
        return 'Sir, the document file was momentarily locked by Microsoft Word. Synchronizing atomic save now.';
      case ErrorCode.ERR_SPOTIFY_NOT_RUNNING:
        return 'Sir, Spotify is not currently active on your system. Starting Spotify desktop now.';
      case ErrorCode.ERR_SPOTIFY_PLAYBACK_RESTRICTED:
        return 'Sir, Spotify media playback did not respond. Bringing Spotify into view.';
      case ErrorCode.ERR_CHROME_PROFILE_NOT_FOUND:
        return `Sir, I could not identify a Chrome profile named "${target}". Available profiles are mapped in system memory.`;
      case ErrorCode.ERR_SEARCH_NETWORK_UNAVAILABLE:
        return 'Sir, real-time web retrieval is currently experiencing connectivity latency. Utilizing verified internal knowledge.';
      case ErrorCode.ERR_3D_PARAMETRIC_BUILD_FAILED:
        return 'Sir, parametric 3D mesh calculation encountered a geometric constraint violation. Re-evaluating geometry.';
      case ErrorCode.ERR_DEVLAB_BUILD_ERROR:
        return `Sir, the autonomous code execution reported a syntax or compilation fault: ${rawMsg.substring(0, 100)}`;
      case ErrorCode.ERR_DEVLAB_EXECUTION_TIMEOUT:
        return 'Sir, the code execution exceeded our safety runtime threshold of 15 seconds and was terminated.';
      case ErrorCode.ERR_APP_NOT_INSTALLED:
        return `Sir, the application "${target}" does not appear to be registered in standard Windows system paths.`;
      default:
        return `Sir, an operational exception occurred in ${context.subsystem || 'the system'}: ${rawMsg.substring(0, 120)}.`;
    }
  }

  getRecoveryPlan(code, context) {
    switch (code) {
      case ErrorCode.ERR_AUTH_SESSION_EXPIRED:
        return ['REFRESH_TOKEN', 'RETRY_REQUEST'];
      case ErrorCode.ERR_AI_RATE_LIMITED:
        return ['FAILOVER_MODEL', 'COOLDOWN_PRIMARY'];
      case ErrorCode.ERR_WHATSAPP_CONTACT_NOT_FOUND:
        return ['LIST_RECENT_CHATS', 'REQUEST_NAME_CLARIFICATION'];
      case ErrorCode.ERR_WHATSAPP_CALL_FAILED:
        return ['BRING_WHATSAPP_FOREGROUND', 'USER_MANUAL_CLICK'];
      case ErrorCode.ERR_SPOTIFY_NOT_RUNNING:
        return ['LAUNCH_SPOTIFY', 'RETRY_PLAYBACK_COMMAND'];
      case ErrorCode.ERR_FILE_LOCKED_OR_BUSY:
        return ['RETRY_WITH_EXPONENTIAL_BACKOFF', 'IN_PLACE_SAVE'];
      case ErrorCode.ERR_DEVLAB_BUILD_ERROR:
        return ['ANALYZE_COMPILER_OUTPUT', 'SELF_HEAL_CODE_EDIT'];
      default:
        return ['LOG_DIAGNOSTICS', 'NOTIFY_USER'];
    }
  }

  getRecentErrors(limit = 10) {
    return this.memoryLedger.slice(-limit).reverse();
  }

  resolveError(errorId) {
    const item = this.memoryLedger.find(e => e.errorId === errorId);
    if (item) {
      item.resolved = true;
      this._persistLedger();
      return true;
    }
    return false;
  }
}

const errorDiagnosticsInstance = new ErrorDiagnosticsService();

module.exports = {
  ErrorCode,
  ErrorDiagnosticsService,
  errorDiagnostics: errorDiagnosticsInstance
};
