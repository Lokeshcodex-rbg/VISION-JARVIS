/**
 * VISION AI — Server Authentication & Session Security Manager
 * Protects state-changing and sensitive HTTP API endpoints against unauthenticated access,
 * cross-site request forgery (CSRF), and unauthorized remote execution.
 * 
 * - Generates cryptographically secure 256-bit session tokens.
 * - Enforces constant-time cryptographic verification (timing attack immune).
 * - Issues HttpOnly SameSite=Strict session cookies for authorized local browser sessions.
 * - Supports Authorization: Bearer and X-Stark-Auth-Token headers for desktop and test harnesses.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSION_TOKEN_PATH = path.resolve(__dirname, '../data/.session_token');

class ServerAuthManager {
  constructor() {
    this.sessionToken = null;
    this.tokenCreatedAt = null;
    this.initializeSessionToken();
  }

  /**
   * Initializes or loads a secure 256-bit session token
   */
  initializeSessionToken() {
    try {
      if (fs.existsSync(SESSION_TOKEN_PATH)) {
        const existing = fs.readFileSync(SESSION_TOKEN_PATH, 'utf8').trim();
        if (existing && existing.length === 64) {
          this.sessionToken = existing;
          this.tokenCreatedAt = Date.now();
          return;
        }
      }
    } catch (_) {}

    this.sessionToken = crypto.randomBytes(32).toString('hex');
    this.tokenCreatedAt = Date.now();

    try {
      const dataDir = path.dirname(SESSION_TOKEN_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(SESSION_TOKEN_PATH, this.sessionToken, { encoding: 'utf8', mode: 0o600 });
    } catch (e) {
      // Memory fallback if disk write is restricted
    }
  }

  /**
   * Returns current active session token for legitimate internal modules
   */
  getSessionToken() {
    try {
      if (fs.existsSync(SESSION_TOKEN_PATH)) {
        const onDisk = fs.readFileSync(SESSION_TOKEN_PATH, 'utf8').trim();
        if (onDisk && onDisk.length === 64) {
          this.sessionToken = onDisk;
          return this.sessionToken;
        }
      }
    } catch (_) {}

    if (!this.sessionToken) {
      this.initializeSessionToken();
    }
    return this.sessionToken;
  }

  /**
   * Constant-time comparison between candidate token and active session token
   */
  verifyToken(candidate) {
    if (!candidate || typeof candidate !== 'string') return false;
    const cleanCand = candidate.trim();

    // Check in-memory token
    if (this.sessionToken) {
      const expectedBuf = Buffer.from(this.sessionToken, 'utf8');
      const candidateBuf = Buffer.from(cleanCand, 'utf8');
      if (expectedBuf.length === candidateBuf.length) {
        try {
          if (crypto.timingSafeEqual(expectedBuf, candidateBuf)) {
            return true;
          }
        } catch (_) {}
      }
    }

    // Fallback: check on-disk session token if cross-process update occurred
    try {
      if (fs.existsSync(SESSION_TOKEN_PATH)) {
        const onDisk = fs.readFileSync(SESSION_TOKEN_PATH, 'utf8').trim();
        if (onDisk && onDisk.length === 64) {
          const diskBuf = Buffer.from(onDisk, 'utf8');
          const candidateBuf = Buffer.from(cleanCand, 'utf8');
          if (diskBuf.length === candidateBuf.length && crypto.timingSafeEqual(diskBuf, candidateBuf)) {
            this.sessionToken = onDisk;
            return true;
          }
        }
      }
    } catch (_) {}

    return false;
  }

  /**
   * Extracts and verifies authentication from an incoming HTTP request
   */
  verifyRequest(req) {
    // 1. Check Authorization: Bearer <token>
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(/\s+/);
      if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
        if (this.verifyToken(parts[1])) {
          return { authenticated: true, source: 'bearer_token' };
        }
      }
    }

    // 2. Check X-Stark-Auth-Token header
    const customHeader = req.headers['x-stark-auth-token'] || req.headers['X-Stark-Auth-Token'];
    if (customHeader && typeof customHeader === 'string') {
      if (this.verifyToken(customHeader)) {
        return { authenticated: true, source: 'header_token' };
      }
    }

    // 3. Check Cookie: stark_session=<token>
    const cookieHeader = req.headers['cookie'] || req.headers['Cookie'];
    if (cookieHeader && typeof cookieHeader === 'string') {
      const cookies = cookieHeader.split(';');
      for (const c of cookies) {
        const [k, v] = c.trim().split('=');
        if (k === 'stark_session' && v) {
          if (this.verifyToken(decodeURIComponent(v))) {
            return { authenticated: true, source: 'session_cookie' };
          }
        }
      }
    }

    return {
      authenticated: false,
      reason: 'MISSING_OR_INVALID_CREDENTIALS'
    };
  }

  /**
   * Formats the Set-Cookie header for legitimate browser sessions
   */
  createSessionCookieHeader() {
    return `stark_session=${this.getSessionToken()}; Path=/; SameSite=Strict; HttpOnly`;
  }

  /**
   * Validates if request originates from authorized local origin
   */
  isTrustedOrigin(origin) {
    if (!origin) return true; // Direct local/loopback request (curl, Electron IPC, same-origin)
    try {
      const u = new URL(origin);
      return (
        (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
        (u.port === '3000' || u.port === '' || !u.port)
      );
    } catch (_) {
      return false;
    }
  }
}

const serverAuthManagerInstance = new ServerAuthManager();

module.exports = {
  ServerAuthManager,
  serverAuthManagerInstance
};
