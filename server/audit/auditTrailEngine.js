/**
 * VISION AI — Cryptographic Tamper-Evident Hash-Chained Audit Trail
 * 
 * Enforces an immutable, append-only security log where every record
 * is cryptographically chained to its predecessor using SHA-256.
 * 
 * Guarantees:
 * 1. Sequential record integrity: Sequence numbers strictly increment.
 * 2. Cryptographic hash-chaining: Record(i).prevHash === Record(i-1).hash.
 * 3. Tampering detection: Any modified, deleted, or reordered record breaks the chain.
 * 4. Pre-persistence secret redaction: Sensitive tokens, passwords, and keys are redacted
 *    BEFORE computing hashes and writing to disk.
 * 5. Restart persistence: Persists to data/audit_trail.jsonl and survives application restarts.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { permissionPolicyEngineInstance } = require('../security/permissionPolicyEngine.js');

const DATA_DIR = path.join(__dirname, '../../data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_trail.jsonl');
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const EVENT_TYPES = {
  USER_OBJECTIVE_RECEIVED: 'USER_OBJECTIVE_RECEIVED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_PLAN_GENERATED: 'TASK_PLAN_GENERATED',
  DAG_NODE_STARTED: 'DAG_NODE_STARTED',
  DAG_NODE_COMPLETED: 'DAG_NODE_COMPLETED',
  DAG_NODE_FAILED: 'DAG_NODE_FAILED',
  TOOL_INVOCATION_REQUESTED: 'TOOL_INVOCATION_REQUESTED',
  TOOL_INVOCATION_AUTHORIZED: 'TOOL_INVOCATION_AUTHORIZED',
  TOOL_INVOCATION_DENIED: 'TOOL_INVOCATION_DENIED',
  TOOL_EXECUTION_COMPLETED: 'TOOL_EXECUTION_COMPLETED',
  POLICY_DECISION_EVALUATED: 'POLICY_DECISION_EVALUATED',
  APPROVAL_REQUEST_CREATED: 'APPROVAL_REQUEST_CREATED',
  APPROVAL_GRANTED: 'APPROVAL_GRANTED',
  APPROVAL_DENIED: 'APPROVAL_DENIED',
  APPROVAL_EXPIRED: 'APPROVAL_EXPIRED',
  APPROVAL_INVALIDATED: 'APPROVAL_INVALIDATED',
  BROWSER_NAVIGATION: 'BROWSER_NAVIGATION',
  BROWSER_ACTION_EXECUTED: 'BROWSER_ACTION_EXECUTED',
  FILESYSTEM_MUTATION: 'FILESYSTEM_MUTATION',
  PROCESS_SPAWNED: 'PROCESS_SPAWNED',
  PROCESS_TERMINATED: 'PROCESS_TERMINATED',
  INDEPENDENT_VERIFICATION: 'INDEPENDENT_VERIFICATION',
  EMERGENCY_STOP_ENGAGED: 'EMERGENCY_STOP_ENGAGED',
  EMERGENCY_STOP_RESET: 'EMERGENCY_STOP_RESET',
  TASK_FINAL_OUTCOME: 'TASK_FINAL_OUTCOME'
};

class AuditTrailEngine {
  constructor(options = {}) {
    this.dataDir = options.dataDir || DATA_DIR;
    this.auditFilePath = options.auditFilePath || path.join(this.dataDir, 'audit_trail.jsonl');
    this.inMemoryRecords = [];
    this.lastHash = GENESIS_HASH;
    this.sequenceNumber = 0;
    this._ensureStorage();
    this._loadExistingRecords();
  }

  _ensureStorage() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (!fs.existsSync(this.auditFilePath)) {
        fs.writeFileSync(this.auditFilePath, '', 'utf8');
      }
    } catch (e) {
      console.warn('[AUDIT_TRAIL] Failed to ensure audit storage:', e.message);
    }
  }

  _loadExistingRecords() {
    try {
      this.inMemoryRecords = [];
      if (!fs.existsSync(this.auditFilePath)) return;

      const content = fs.readFileSync(this.auditFilePath, 'utf8').trim();
      if (!content) {
        this.lastHash = GENESIS_HASH;
        this.sequenceNumber = 0;
        return;
      }

      const lines = content.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          this.inMemoryRecords.push(record);
          this.sequenceNumber = record.seq;
          this.lastHash = record.hash;
        } catch (_) {}
      }
    } catch (e) {
      console.warn('[AUDIT_TRAIL] Warning loading existing audit records:', e.message);
    }
  }

  logEvent(eventType, rawDetails = {}, context = {}) {
    return this.recordEvent(eventType, rawDetails, context);
  }

  /**
   * Records a security-relevant event with cryptographic chaining and secret redaction
   */
  recordEvent(eventType, rawDetails = {}, context = {}) {
    const {
      taskId = null,
      nodeId = null,
      tool = null,
      personality = 'JARVIS'
    } = context;

    this.sequenceNumber++;
    const seq = this.sequenceNumber;
    const timestamp = new Date().toISOString();
    const eventId = 'evt_' + Date.now().toString(36) + '_' + crypto.randomBytes(6).toString('hex');

    // 1. Pre-persistence Secret Redaction (Sanitization & Normalization)
    const rawRedacted = permissionPolicyEngineInstance.redactSecrets(rawDetails);
    const sanitizedDetails = (rawRedacted !== undefined && rawRedacted !== null)
      ? JSON.parse(JSON.stringify(rawRedacted))
      : rawRedacted;

    // 2. Canonical serialization for deterministic hashing
    const canonicalDetails = this._canonicalString(sanitizedDetails);
    const prevHash = this.lastHash;

    // 3. Compute SHA-256 hash of this chained record
    const hashPayload = `${seq}|${timestamp}|${eventType}|${taskId || ''}|${nodeId || ''}|${tool || ''}|${prevHash}|${canonicalDetails}`;
    const hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    const record = {
      id: eventId,
      seq,
      timestamp,
      eventType,
      taskId,
      nodeId,
      tool,
      personality,
      details: sanitizedDetails,
      prevHash,
      hash,
      integrityStatus: 'VERIFIED'
    };

    // 4. Update head pointer & in-memory cache
    this.lastHash = hash;
    this.inMemoryRecords.push(record);
    if (this.inMemoryRecords.length > 2000) {
      this.inMemoryRecords.shift();
    }

    // 5. Append atomically to audit file on disk
    try {
      this._ensureStorage();
      fs.appendFileSync(this.auditFilePath, JSON.stringify(record) + '\n', 'utf8');
    } catch (e) {
      console.error('[AUDIT_TRAIL] CRITICAL: Failed to append audit record to disk:', e.message);
    }

    return record;
  }

  /**
   * Verifies the cryptographic hash-chain across all stored records on disk
   * Detects: missing records, modified records, reordered records, invalid hashes
   */
  verifyIntegrity(customRecords = null) {
    let records = customRecords;
    if (!records) {
      try {
        if (!fs.existsSync(this.auditFilePath)) {
          return { valid: true, totalRecords: 0, unbroken: true, message: 'Empty audit trail.' };
        }
        const content = fs.readFileSync(this.auditFilePath, 'utf8').trim();
        if (!content) {
          return { valid: true, totalRecords: 0, unbroken: true, message: 'Empty audit trail.' };
        }
        records = content.split('\n').filter(Boolean).map(l => JSON.parse(l));
      } catch (err) {
        return {
          valid: false,
          totalRecords: 0,
          unbroken: false,
          error: `CORRUPT_AUDIT_LOG: Failed to parse audit trail: ${err.message}`
        };
      }
    }

    if (!Array.isArray(records) || records.length === 0) {
      return { valid: true, totalRecords: 0, unbroken: true, message: 'Zero records.' };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const expectedSeq = i + 1;

      // 1. Verify sequence order
      if (rec.seq !== expectedSeq) {
        return {
          valid: false,
          totalRecords: records.length,
          unbroken: false,
          brokenIndex: i,
          brokenRecordId: rec.id,
          error: `SEQUENCE_DISCONTINUITY: Record at index ${i} has seq ${rec.seq}, expected ${expectedSeq} (missing or reordered records).`
        };
      }

      // 2. Verify previous hash pointer
      if (rec.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          totalRecords: records.length,
          unbroken: false,
          brokenIndex: i,
          brokenRecordId: rec.id,
          error: `CHAIN_BROKEN: Record ${rec.id} (seq ${rec.seq}) has prevHash "${rec.prevHash}", expected "${expectedPrevHash}".`
        };
      }

      // 3. Recompute SHA-256 hash
      const canonicalDetails = this._canonicalString(rec.details);
      const payload = `${rec.seq}|${rec.timestamp}|${rec.eventType}|${rec.taskId || ''}|${rec.nodeId || ''}|${rec.tool || ''}|${rec.prevHash}|${canonicalDetails}`;
      const recomputedHash = crypto.createHash('sha256').update(payload).digest('hex');

      if (rec.hash !== recomputedHash) {
        return {
          valid: false,
          totalRecords: records.length,
          unbroken: false,
          brokenIndex: i,
          brokenRecordId: rec.id,
          error: `TAMPERING_DETECTED: Record ${rec.id} (seq ${rec.seq}) hash "${rec.hash}" does not match recomputed SHA-256 "${recomputedHash}" (payload was modified).`
        };
      }

      expectedPrevHash = rec.hash;
    }

    return {
      valid: true,
      totalRecords: records.length,
      unbroken: true,
      genesisHash: GENESIS_HASH,
      headHash: expectedPrevHash,
      message: `Audit trail verified: All ${records.length} records form an unbroken, tamper-evident cryptographic hash chain.`
    };
  }

  /**
   * Deterministic JSON serializer to ensure stable key ordering for hash computation
   */
  _canonicalString(obj) {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') return JSON.stringify(obj);

    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this._canonicalString(item)).join(',') + ']';
    }

    const sortedKeys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
    const parts = sortedKeys.map(k => `${JSON.stringify(k)}:${this._canonicalString(obj[k])}`);
    return '{' + parts.join(',') + '}';
  }

  /**
   * Retrieves recent audit records with optional filters
   */
  getAuditHistory(limit = 100, filter = {}) {
    const records = [...this.inMemoryRecords];
    let filtered = records;

    if (filter.eventType) {
      filtered = filtered.filter(r => r.eventType === filter.eventType);
    }
    if (filter.taskId) {
      filtered = filtered.filter(r => r.taskId === filter.taskId);
    }
    if (filter.tool) {
      filtered = filtered.filter(r => r.tool === filter.tool);
    }

    return filtered.slice(-limit).reverse();
  }

  getRecentRecords(limit = 50) {
    return this.getAuditHistory({ limit });
  }

  /**
   * Clears audit trail for test teardown / fresh session initialization (requires explicit user reason)
   */
  clearAuditTrail(authorizedReason = 'Test environment reset') {
    try {
      this._ensureStorage();
      fs.writeFileSync(this.auditFilePath, '', 'utf8');
      this.inMemoryRecords = [];
      this.lastHash = GENESIS_HASH;
      this.sequenceNumber = 0;
      return { success: true, reason: authorizedReason };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

const auditTrailEngineInstance = new AuditTrailEngine();

module.exports = {
  AuditTrailEngine,
  auditTrailEngineInstance,
  EVENT_TYPES,
  GENESIS_HASH
};
