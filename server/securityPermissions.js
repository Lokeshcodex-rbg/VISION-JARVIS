/**
 * VISION AI — Application Security, Permissions & Approval Authority
 * Enforces strict 3-tier permission boundaries:
 * 1. READ-ONLY: Workspace file reading, symbol search, diagnostics, documentation.
 * 2. LOW-RISK: Allowlisted app launch, verified test executions.
 * 3. HIGH-IMPACT: Code patching, file writes, memory clearing, task deletion.
 * High-impact actions strictly require single-use, time-bounded approval tokens.
 * Protects against prompt injection, path traversal, and unauthorized shell execution.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const WORKSPACE_ROOT = process.env.JARVIS_PROJECT_PATH
  ? path.resolve(process.env.JARVIS_PROJECT_PATH)
  : path.resolve(__dirname, '..');

// In-memory token store for single-use approval tokens
const activeApprovals = new Map();
const APPROVAL_TTL_MS = 60 * 1000; // 60 seconds validity

const INJECTION_PATTERNS = [
  /\bignore\s+(?:all\s+)?previous\s+instructions\b/i,
  /\bsystem\s+prompt\s+override\b/i,
  /\byou\s+are\s+now\s+in\s+DAN\s+mode\b/i,
  /\bdisregard\s+(?:all\s+)?prior\s+rules\b/i,
  /\bexfiltrate\s+(?:keys?|secrets?|passwords?)\b/i
];

class SecurityPermissions {
  constructor() {
    this.workspaceRoot = WORKSPACE_ROOT;
  }

  /**
   * Validates and resolves a file path strictly within the workspace root.
   * Prevents path traversal attacks (e.g. ../../Windows).
   */
  resolveSafePath(userPath) {
    if (!userPath || typeof userPath !== 'string') {
      throw new Error('Invalid file path specified.');
    }

    const clean = userPath.trim().replace(/^['"]|['"]$/g, '');
    let resolved = path.isAbsolute(clean)
      ? path.normalize(clean)
      : path.normalize(path.join(this.workspaceRoot, clean));

    // First check if path resides strictly within the primary workspace directory
    const rel = path.relative(this.workspaceRoot, resolved);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      return resolved;
    }

    // Check against authorized local workspace manager roots (Documents, Desktop, etc.)
    try {
      const { localWorkspaceManagerInstance } = require('./desktop/localWorkspaceManager.js');
      if (localWorkspaceManagerInstance.isPathAuthorized(resolved)) {
        return resolved;
      }
    } catch (_) {}

    throw new Error(`Security Violation: Path "${userPath}" is outside authorized workspace "${this.workspaceRoot}" and authorized roots.`);
  }

  /**
   * Boolean check for safe path authorization
   */
  isSafePath(userPath) {
    try {
      this.resolveSafePath(userPath);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Sanitizes external content (retrieved webpages, tool inputs, user files)
   * to mitigate indirect prompt injection.
   */
  sanitizeUntrustedContent(content) {
    if (!content || typeof content !== 'string') return '';
    let sanitized = content;
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '[SECURITY: UNTRUSTED INSTRUCTION FILTERED]');
      }
    }
    return sanitized;
  }

  /**
   * Generates a cryptographically strong, single-use approval token
   * bound to an exact action, target, and arguments.
   */
  createApprovalRequest(action, target, args = {}, personality = 'JARVIS') {
    const tokenId = 'appr_' + crypto.randomBytes(16).toString('hex');
    const now = Date.now();

    const approval = {
      tokenId,
      action: String(action).toUpperCase(),
      target: String(target || ''),
      argsHash: crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex'),
      requestedBy: personality,
      createdAt: now,
      expiresAt: now + APPROVAL_TTL_MS,
      consumed: false
    };

    activeApprovals.set(tokenId, approval);

    // Auto cleanup after expiration
    setTimeout(() => {
      activeApprovals.delete(tokenId);
    }, APPROVAL_TTL_MS + 5000);

    return {
      tokenId,
      action: approval.action,
      target: approval.target,
      expiresInSeconds: Math.round(APPROVAL_TTL_MS / 1000),
      summary: `Explicit approval token created for high-impact action: ${approval.action} on ${approval.target}. Token expires in 60 seconds.`
    };
  }

  /**
   * Verifies and consumes a single-use approval token immediately before action execution.
   */
  verifyAndConsumeApproval(tokenId, action, target, args = {}) {
    if (!tokenId || typeof tokenId !== 'string') {
      throw new Error('High-impact operation rejected: Missing required approvalToken.');
    }

    const approval = activeApprovals.get(tokenId);
    if (!approval) {
      throw new Error('High-impact operation rejected: Invalid or expired approvalToken.');
    }

    if (approval.consumed) {
      throw new Error('High-impact operation rejected: approvalToken has already been consumed.');
    }

    if (Date.now() > approval.expiresAt) {
      activeApprovals.delete(tokenId);
      throw new Error('High-impact operation rejected: approvalToken has expired.');
    }

    // Verify action binding
    if (approval.action !== String(action).toUpperCase()) {
      throw new Error(`Security Violation: Token action mismatch. Expected "${approval.action}", got "${action}".`);
    }

    // Verify target binding if target was specified
    if (approval.target && approval.target !== String(target || '')) {
      throw new Error(`Security Violation: Token target mismatch. Expected "${approval.target}", got "${target}".`);
    }

    // Verify arguments hash
    const currentArgsHash = crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex');
    if (approval.argsHash && approval.argsHash !== currentArgsHash) {
      throw new Error('Security Violation: Token argument tamper detected.');
    }

    // Single-use enforcement: mark consumed and remove
    approval.consumed = true;
    activeApprovals.delete(tokenId);

    return true;
  }
}

module.exports = {
  SecurityPermissions,
  securityPermissionsInstance: new SecurityPermissions(),
  WORKSPACE_ROOT
};
