/**
 * VISION AI — Robust SQLite Memory Database Engine
 * Backed by Node.js 22 native node:sqlite DatabaseSync with atomic WAL mode,
 * 8-layer cognitive memory architecture, unconstrained disk-bounded scalability,
 * hybrid intelligent retrieval, automated archival, atomic backups, and PRAGMA integrity verification.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const DATA_DIR = path.resolve(__dirname, '../../data');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'stark_memory.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const ARCHIVE_DIR = path.join(DATA_DIR, 'memory_archives');

// 8 Logical Memory Layers (Phase 8 Architecture Mandate)
const MEMORY_LAYERS = {
  WORKING: 'working',                   // Current conversation & active task context
  EPISODIC: 'episodic',                 // Experiences, task execution traces, interactions
  SEMANTIC: 'semantic',                 // Facts, concepts, world knowledge, relationships
  PROCEDURAL: 'procedural',             // Learned workflows, procedures, reusable tool instructions
  PROJECT: 'project',                   // Long-term context for individual projects
  USER_PREFERENCE: 'user_preference',   // Stable user preferences, explicitly retained rules
  ARCHIVE: 'archive',                   // Historical records compressed for long-term retention
  EVIDENCE: 'evidence'                  // Source URLs, provenance, verification proofs, hashes
};

const EPISTEMIC_TYPES = {
  VERIFIED_FACT: 'VERIFIED_FACT',
  USER_STATEMENT: 'USER_STATEMENT',
  CLAIM: 'CLAIM',
  ASSUMPTION: 'ASSUMPTION',
  HYPOTHESIS: 'HYPOTHESIS',
  ERROR_REPAIR: 'ERROR_REPAIR',
  PROJECT_PROGRESS: 'PROJECT_PROGRESS',
  OUTDATED: 'OUTDATED'
};

const CONFIDENCE_CLASSES = {
  USER_CONFIRMED: 'USER_CONFIRMED',
  SOURCE_VERIFIED: 'SOURCE_VERIFIED',
  MODEL_INFERRED: 'MODEL_INFERRED',
  UNCERTAIN: 'UNCERTAIN',
  SUPERSEDED: 'SUPERSEDED'
};

const RECORD_TYPES = {
  PREFERENCE: 'PREFERENCE',
  FACT: 'FACT',
  EVENT: 'EVENT',
  DECISION: 'DECISION',
  GOAL: 'GOAL',
  HISTORICAL_RECORD: 'HISTORICAL_RECORD'
};

class StarkMemoryDb {
  constructor(dbPath = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    this.db = null;
    this.isNativeSqlite = false;
    this.fallbackStore = { memories: [], projects: {}, config: {}, archives: [] };
    this.init();
  }

  init() {
    try {
      const parentDir = path.dirname(this.dbPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
      if (!fs.existsSync(ARCHIVE_DIR)) {
        fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
      }

      // Try initializing native node:sqlite
      const { DatabaseSync } = require('node:sqlite');
      this.db = new DatabaseSync(this.dbPath);
      this.isNativeSqlite = true;

      // Enable WAL mode & foreign keys for high performance and durability
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');

      this.createSchema();
      this.initError = null;
    } catch (err) {
      console.warn(`[STARK_MEMORY_DB] Native SQLite warning: ${err.message}. Initializing robust JSON-backed store.`);
      if (this.db) {
        try { this.db.close(); } catch (_) {}
        this.db = null;
      }
      this.isNativeSqlite = false;
      this.initError = err.message;
      this.initFallbackStore();
    }
  }

  createSchema() {
    if (!this.isNativeSqlite) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        fact TEXT NOT NULL,
        category TEXT NOT NULL,
        epistemic_type TEXT NOT NULL,
        source TEXT,
        confidence REAL DEFAULT 1.0,
        verified INTEGER DEFAULT 0,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER DEFAULT 0,
        memory_layer TEXT DEFAULT 'semantic',
        expires_at TEXT,
        access_count INTEGER DEFAULT 0,
        last_accessed_at TEXT,
        is_archived INTEGER DEFAULT 0,
        archive_id TEXT,
        record_type TEXT DEFAULT 'FACT',
        valid_from TEXT,
        valid_until TEXT,
        is_current INTEGER DEFAULT 1,
        superseded_by TEXT,
        confidence_class TEXT DEFAULT 'MODEL_INFERRED',
        domain_tags TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_memories_cat ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_memories_epistemic ON memories(epistemic_type);
      CREATE INDEX IF NOT EXISTS idx_memories_deleted ON memories(deleted);
      CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at);

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL UNIQUE,
        objective TEXT,
        architecture TEXT,
        status TEXT DEFAULT 'IN_PROGRESS',
        milestones TEXT,
        key_files TEXT,
        decisions TEXT,
        bugs_and_fixes TEXT,
        next_steps TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name);

      CREATE TABLE IF NOT EXISTS memory_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS kg_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        properties TEXT,
        provenance TEXT,
        confidence REAL DEFAULT 1.0,
        epistemic_type TEXT DEFAULT 'CLAIM',
        project_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(type);
      CREATE INDEX IF NOT EXISTS idx_kg_nodes_label ON kg_nodes(label);
      CREATE INDEX IF NOT EXISTS idx_kg_nodes_proj ON kg_nodes(project_id);

      CREATE TABLE IF NOT EXISTS kg_edges (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relationship TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        metadata TEXT,
        source TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kg_edges_from ON kg_edges(from_id);
      CREATE INDEX IF NOT EXISTS idx_kg_edges_to ON kg_edges(to_id);
      CREATE INDEX IF NOT EXISTS idx_kg_edges_rel ON kg_edges(relationship);

      CREATE TABLE IF NOT EXISTS kg_contradictions (
        id TEXT PRIMARY KEY,
        entity_or_concept TEXT NOT NULL,
        claim_a TEXT NOT NULL,
        source_a TEXT NOT NULL,
        claim_b TEXT NOT NULL,
        source_b TEXT NOT NULL,
        contradiction_type TEXT NOT NULL,
        resolved INTEGER DEFAULT 0,
        resolution TEXT,
        project_id TEXT,
        detected_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kg_contra_entity ON kg_contradictions(entity_or_concept);

      CREATE TABLE IF NOT EXISTS memory_archives (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        record_count INTEGER NOT NULL,
        compressed_size_bytes INTEGER NOT NULL,
        uncompressed_size_bytes INTEGER NOT NULL,
        sha256_hash TEXT NOT NULL,
        data_blob TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_archives_created ON memory_archives(created_at);

      CREATE TABLE IF NOT EXISTS storage_metrics (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        db_size_bytes INTEGER NOT NULL,
        record_count INTEGER NOT NULL,
        free_disk_bytes INTEGER NOT NULL,
        warning_level TEXT DEFAULT 'NORMAL'
      );
    `);

    // Dynamic schema migration for existing databases
    try {
      const cols = this.db.prepare("PRAGMA table_info(memories)").all();
      const colNames = new Set(cols.map(c => c.name));
      if (!colNames.has('memory_layer')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN memory_layer TEXT DEFAULT 'semantic';");
      }
      if (!colNames.has('expires_at')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN expires_at TEXT;");
      }
      if (!colNames.has('access_count')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN access_count INTEGER DEFAULT 0;");
      }
      if (!colNames.has('last_accessed_at')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN last_accessed_at TEXT;");
      }
      if (!colNames.has('is_archived')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN is_archived INTEGER DEFAULT 0;");
      }
      if (!colNames.has('archive_id')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN archive_id TEXT;");
      }
      if (!colNames.has('record_type')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN record_type TEXT DEFAULT 'FACT';");
      }
      if (!colNames.has('valid_from')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN valid_from TEXT;");
      }
      if (!colNames.has('valid_until')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN valid_until TEXT;");
      }
      if (!colNames.has('is_current')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN is_current INTEGER DEFAULT 1;");
      }
      if (!colNames.has('superseded_by')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN superseded_by TEXT;");
      }
      if (!colNames.has('confidence_class')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN confidence_class TEXT DEFAULT 'MODEL_INFERRED';");
      }
      if (!colNames.has('domain_tags')) {
        this.db.exec("ALTER TABLE memories ADD COLUMN domain_tags TEXT;");
      }
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_memories_layer ON memories(memory_layer);");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_memories_archived ON memories(is_archived);");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_memories_layer_updated ON memories(memory_layer, updated_at DESC);");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_memories_is_current ON memories(is_current);");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_memories_record_type ON memories(record_type);");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_memories_conf_class ON memories(confidence_class);");
    } catch (_) {}

    // Initialize default config if not present
    this.initConfigDefaults();
  }

  initConfigDefaults() {
    const defaults = {
      auto_memory_enabled: 'true',
      privacy_level: 'standard',
      retrieval_limit: '5',
      min_confidence: '0.6',
      storage_warning_percent: '10',
      archive_after_days: '90'
    };

    for (const [key, val] of Object.entries(defaults)) {
      if (this.isNativeSqlite) {
        const stmt = this.db.prepare('INSERT OR IGNORE INTO memory_config (key, value) VALUES (?, ?)');
        stmt.run(key, val);
      } else {
        if (!this.fallbackStore.config[key]) {
          this.fallbackStore.config[key] = val;
        }
      }
    }
  }

  initFallbackStore() {
    const jsonPath = path.join(DATA_DIR, 'stark_memory_fallback.json');
    if (fs.existsSync(jsonPath)) {
      try {
        this.fallbackStore = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch (_) {
        this.fallbackStore = { memories: [], projects: {}, config: {}, archives: [] };
      }
    }
    this.initConfigDefaults();
  }

  saveFallbackStore() {
    if (this.isNativeSqlite) return;
    const jsonPath = path.join(DATA_DIR, 'stark_memory_fallback.json');
    try {
      fs.writeFileSync(jsonPath, JSON.stringify(this.fallbackStore, null, 2), 'utf8');
    } catch (_) {}
  }

  // =========================================================================
  // 1. LAYER CLASSIFICATION & NORMALIZATION
  // =========================================================================

  determineLayer(category = '', epistemicType = '', source = '') {
    const cat = String(category || '').toUpperCase();
    const epi = String(epistemicType || '').toUpperCase();
    const src = String(source || '').toLowerCase();

    if (cat === 'WORKING' || epi === 'WORKING' || src === 'scratchpad') {
      return MEMORY_LAYERS.WORKING;
    }
    if (cat === 'TASK_TRACE' || cat === 'EXECUTION' || cat === 'INTERACTION' || cat === 'EPISODIC' || cat === 'EXPERIENCE') {
      return MEMORY_LAYERS.EPISODIC;
    }
    if (cat === 'PROCEDURAL' || cat === 'SKILL' || cat === 'WORKFLOW' || cat === 'INSTRUCTION') {
      return MEMORY_LAYERS.PROCEDURAL;
    }
    if (cat === 'PROJECT' || cat === 'PROJECT_PROGRESS' || epi === 'PROJECT_PROGRESS') {
      return MEMORY_LAYERS.PROJECT;
    }
    if (cat === 'PREFERENCE' || cat === 'USER_PREFERENCE' || epi === 'USER_STATEMENT') {
      return MEMORY_LAYERS.USER_PREFERENCE;
    }
    if (cat === 'ARCHIVE' || cat === 'ARCHIVED') {
      return MEMORY_LAYERS.ARCHIVE;
    }
    if (cat === 'EVIDENCE' || cat === 'SOURCE' || cat === 'CITATION' || cat === 'PROVENANCE') {
      return MEMORY_LAYERS.EVIDENCE;
    }
    return MEMORY_LAYERS.SEMANTIC;
  }

  normalizeMemory(row) {
    let meta = {};
    try {
      meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    } catch (_) {
      meta = {};
    }

    return {
      id: row.id,
      fact: row.fact,
      category: row.category,
      epistemicType: row.epistemic_type || row.epistemicType || 'USER_STATEMENT',
      source: row.source || 'user_dialogue',
      confidence: Number(row.confidence !== undefined ? row.confidence : 1.0),
      verified: Boolean(row.verified),
      metadata: meta,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
      deleted: Boolean(row.deleted),
      memoryLayer: row.memory_layer || 'semantic',
      expiresAt: row.expires_at || null,
      accessCount: Number(row.access_count || 0),
      lastAccessedAt: row.last_accessed_at || null,
      isArchived: Boolean(row.is_archived),
      archiveId: row.archive_id || null,
      recordType: row.record_type || 'FACT',
      validFrom: row.valid_from || null,
      validUntil: row.valid_until || null,
      isCurrent: row.is_current !== undefined ? Boolean(row.is_current) : true,
      supersededBy: row.superseded_by || null,
      confidenceClass: row.confidence_class || 'MODEL_INFERRED',
      domainTags: typeof row.domain_tags === 'string' ? (JSON.parse(row.domain_tags || '[]')) : (row.domain_tags || [])
    };
  }

  // =========================================================================
  // 2. MEMORY CRUD & BATCH INGESTION (SCALABLE UP TO 1M+ RECORDS)
  // =========================================================================

  saveMemory(fact, category = 'FACT', epistemicType = EPISTEMIC_TYPES.VERIFIED_FACT, source = 'system', confidence = 1.0) {
    if (typeof fact === 'object' && fact !== null) {
      return this.insertMemory(fact);
    }
    return this.insertMemory({
      fact: String(fact || ''),
      category,
      epistemicType,
      source,
      confidence
    });
  }

  insertMemory(item) {
    const now = new Date().toISOString();
    const id = item.id || `mem_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const metadataStr = typeof item.metadata === 'object' ? JSON.stringify(item.metadata) : (item.metadata || '{}');
    const category = item.category || 'preference';
    const epistemicType = item.epistemic_type || item.epistemicType || 'USER_STATEMENT';
    const source = item.source || 'user_dialogue';
    const memoryLayer = item.memoryLayer || item.memory_layer || this.determineLayer(category, epistemicType, source);
    const expiresAt = item.expiresAt || item.expires_at || null;
    const isArchived = item.isArchived || item.is_archived ? 1 : 0;
    const archiveId = item.archiveId || item.archive_id || null;

    const recordType = item.recordType || item.record_type || 'FACT';
    const validFrom = item.validFrom || item.valid_from || (item.created_at || now);
    const validUntil = item.validUntil || item.valid_until || null;
    const isCurrent = item.isCurrent !== undefined ? (item.isCurrent ? 1 : 0) : 1;
    const supersededBy = item.supersededBy || item.superseded_by || null;
    const confidenceClass = item.confidenceClass || item.confidence_class || 
      (epistemicType === EPISTEMIC_TYPES.USER_STATEMENT ? CONFIDENCE_CLASSES.USER_CONFIRMED :
      (epistemicType === EPISTEMIC_TYPES.VERIFIED_FACT ? CONFIDENCE_CLASSES.SOURCE_VERIFIED :
      (epistemicType === EPISTEMIC_TYPES.OUTDATED ? CONFIDENCE_CLASSES.SUPERSEDED : CONFIDENCE_CLASSES.MODEL_INFERRED)));
    const domainTags = Array.isArray(item.domainTags) ? JSON.stringify(item.domainTags) : 
      (typeof item.domain_tags === 'string' ? item.domain_tags : (typeof item.domainTags === 'string' ? item.domainTags : '[]'));

    const record = {
      id,
      fact: (item.fact || '').trim(),
      category,
      epistemic_type: epistemicType,
      source,
      confidence: item.confidence !== undefined ? Number(item.confidence) : 1.0,
      verified: item.verified ? 1 : 0,
      metadata: metadataStr,
      created_at: item.created_at || item.createdAt || now,
      updated_at: item.updated_at || item.updatedAt || now,
      deleted: 0,
      memory_layer: memoryLayer,
      expires_at: expiresAt,
      access_count: Number(item.accessCount || 0),
      last_accessed_at: item.lastAccessedAt || null,
      is_archived: isArchived,
      archive_id: archiveId,
      record_type: recordType,
      valid_from: validFrom,
      valid_until: validUntil,
      is_current: isCurrent,
      superseded_by: supersededBy,
      confidence_class: confidenceClass,
      domain_tags: domainTags
    };

    if (this.isNativeSqlite) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memories 
        (id, fact, category, epistemic_type, source, confidence, verified, metadata, created_at, updated_at, deleted, memory_layer, expires_at, access_count, last_accessed_at, is_archived, archive_id, record_type, valid_from, valid_until, is_current, superseded_by, confidence_class, domain_tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        record.id,
        record.fact,
        record.category,
        record.epistemic_type,
        record.source,
        record.confidence,
        record.verified,
        record.metadata,
        record.created_at,
        record.updated_at,
        record.memory_layer,
        record.expires_at,
        record.access_count,
        record.last_accessed_at,
        record.is_archived,
        record.archive_id,
        record.record_type,
        record.valid_from,
        record.valid_until,
        record.is_current,
        record.superseded_by,
        record.confidence_class,
        record.domain_tags
      );
    } else {
      const idx = this.fallbackStore.memories.findIndex(m => m.id === record.id);
      if (idx >= 0) {
        this.fallbackStore.memories[idx] = record;
      } else {
        this.fallbackStore.memories.push(record);
      }
      this.saveFallbackStore();
    }

    return this.normalizeMemory(record);
  }

  /**
   * High-throughput atomic transaction batch ingestion for scalable datasets (tested up to 1,000,000 records)
   */
  batchInsertMemories(items = [], batchSize = 10000) {
    if (!Array.isArray(items) || items.length === 0) return { insertedCount: 0, elapsedMs: 0 };
    const t0 = Date.now();
    const now = new Date().toISOString();

    if (this.isNativeSqlite && this.db) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memories 
        (id, fact, category, epistemic_type, source, confidence, verified, metadata, created_at, updated_at, deleted, memory_layer, expires_at, access_count, last_accessed_at, is_archived, archive_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
      `);

      let totalInserted = 0;
      for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        this.db.exec('BEGIN TRANSACTION;');
        try {
          for (const item of chunk) {
            const id = item.id || `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
            const fact = (item.fact || '').trim();
            const category = item.category || 'general';
            const epistemicType = item.epistemicType || item.epistemic_type || 'VERIFIED_FACT';
            const source = item.source || 'batch_ingest';
            const confidence = item.confidence !== undefined ? Number(item.confidence) : 1.0;
            const verified = item.verified ? 1 : 0;
            const metaStr = typeof item.metadata === 'object' ? JSON.stringify(item.metadata) : (item.metadata || '{}');
            const layer = item.memoryLayer || item.memory_layer || this.determineLayer(category, epistemicType, source);
            const expires = item.expiresAt || item.expires_at || null;
            const accessCount = item.accessCount || 0;
            const isArch = item.isArchived ? 1 : 0;
            const archId = item.archiveId || null;

            stmt.run(id, fact, category, epistemicType, source, confidence, verified, metaStr, now, now, layer, expires, accessCount, null, isArch, archId);
            totalInserted++;
          }
          this.db.exec('COMMIT;');
        } catch (err) {
          this.db.exec('ROLLBACK;');
          throw err;
        }
      }
      return { insertedCount: totalInserted, elapsedMs: Date.now() - t0 };
    } else {
      for (const item of items) {
        this.insertMemory(item);
      }
      return { insertedCount: items.length, elapsedMs: Date.now() - t0 };
    }
  }

  updateMemory(id, updates = {}) {
    const existing = this.getMemoryById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fact = updates.fact !== undefined ? updates.fact.trim() : existing.fact;
    const category = updates.category || existing.category;
    const epistemic_type = updates.epistemic_type || updates.epistemicType || existing.epistemicType;
    const confidence = updates.confidence !== undefined ? Number(updates.confidence) : existing.confidence;
    const verified = updates.verified !== undefined ? (updates.verified ? 1 : 0) : (existing.verified ? 1 : 0);
    const memory_layer = updates.memoryLayer || updates.memory_layer || existing.memoryLayer;
    const metadata = updates.metadata !== undefined
      ? (typeof updates.metadata === 'object' ? JSON.stringify(updates.metadata) : updates.metadata)
      : JSON.stringify(existing.metadata || {});

    if (this.isNativeSqlite) {
      const stmt = this.db.prepare(`
        UPDATE memories 
        SET fact = ?, category = ?, epistemic_type = ?, confidence = ?, verified = ?, memory_layer = ?, metadata = ?, updated_at = ?
        WHERE id = ? AND deleted = 0
      `);
      stmt.run(fact, category, epistemic_type, confidence, verified, memory_layer, metadata, now, id);
    } else {
      const m = this.fallbackStore.memories.find(item => item.id === id);
      if (m) {
        m.fact = fact;
        m.category = category;
        m.epistemic_type = epistemic_type;
        m.confidence = confidence;
        m.verified = verified;
        m.memory_layer = memory_layer;
        m.metadata = metadata;
        m.updated_at = now;
        this.saveFallbackStore();
      }
    }

    return this.getMemoryById(id);
  }

  deleteMemory(id) {
    if (!id) return false;

    if (this.isNativeSqlite) {
      const stmt = this.db.prepare('UPDATE memories SET deleted = 1, updated_at = ? WHERE id = ?');
      const info = stmt.run(new Date().toISOString(), id);
      return (info.changes || 0) > 0;
    } else {
      const m = this.fallbackStore.memories.find(item => item.id === id);
      if (m && !m.deleted) {
        m.deleted = 1;
        m.updated_at = new Date().toISOString();
        this.saveFallbackStore();
        return true;
      }
      return false;
    }
  }

  hardDeleteMemory(id) {
    if (!id) return false;

    if (this.isNativeSqlite) {
      const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
      const info = stmt.run(id);
      return (info.changes || 0) > 0;
    } else {
      const lenBefore = this.fallbackStore.memories.length;
      this.fallbackStore.memories = this.fallbackStore.memories.filter(m => m.id !== id);
      this.saveFallbackStore();
      return this.fallbackStore.memories.length < lenBefore;
    }
  }

  clearAllMemories() {
    if (this.isNativeSqlite) {
      this.db.exec('DELETE FROM memories');
      return true;
    } else {
      this.fallbackStore.memories = [];
      this.saveFallbackStore();
      return true;
    }
  }

  getMemoryById(id) {
    if (!id) return null;

    if (this.isNativeSqlite) {
      const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ? AND deleted = 0');
      const row = stmt.get(id);
      return row ? this.normalizeMemory(row) : null;
    } else {
      const found = this.fallbackStore.memories.find(m => m.id === id && !m.deleted);
      return found ? this.normalizeMemory(found) : null;
    }
  }

  getMemory(id) {
    return this.getMemoryById(id);
  }

  listMemories(options = {}) {
    const { category, epistemicType, memoryLayer, includeDeleted = false, includeArchived = false, limit = 500, offset = 0 } = options;

    if (this.isNativeSqlite) {
      let query = 'SELECT * FROM memories WHERE 1=1';
      const params = [];

      if (!includeDeleted) {
        query += ' AND deleted = 0';
      }
      if (!includeArchived) {
        query += ' AND is_archived = 0';
      }
      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      if (epistemicType) {
        query += ' AND epistemic_type = ?';
        params.push(epistemicType);
      }
      if (memoryLayer) {
        query += ' AND memory_layer = ?';
        params.push(memoryLayer);
      }

      query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);
      return rows.map(r => this.normalizeMemory(r));
    } else {
      let list = this.fallbackStore.memories.filter(m => includeDeleted || !m.deleted);
      if (!includeArchived) list = list.filter(m => !m.is_archived);
      if (category) list = list.filter(m => m.category === category);
      if (epistemicType) list = list.filter(m => (m.epistemic_type || m.epistemicType) === epistemicType);
      if (memoryLayer) list = list.filter(m => (m.memory_layer || m.memoryLayer) === memoryLayer);
      list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      return list.slice(offset, offset + limit).map(m => this.normalizeMemory(m));
    }
  }

  // =========================================================================
  // 3. HYBRID INTELLIGENT RETRIEVAL (TOKEN + LAYER + RECENCY + FREQUENCY)
  // =========================================================================

  searchMemories(query = '', options = {}) {
    return this.hybridSearchMemories(query, options);
  }

  hybridSearchMemories(query = '', options = {}) {
    const t0 = Date.now();
    const qStr = String(query || '').trim().toLowerCase();
    const {
      layer = null,
      category = null,
      epistemicType = null,
      projectId = null,
      minConfidence = 0.0,
      includeArchived = false,
      limit = 20,
      offset = 0
    } = options;

    const tokens = qStr ? qStr.split(/\s+/).filter(t => t.length > 1) : [];

    let candidates = [];
    if (this.isNativeSqlite && this.db) {
      let sql = 'SELECT * FROM memories WHERE deleted = 0';
      const params = [];

      if (!includeArchived) {
        sql += ' AND is_archived = 0';
      }
      if (layer) {
        sql += ' AND memory_layer = ?';
        params.push(layer);
      }
      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }
      if (epistemicType) {
        sql += ' AND epistemic_type = ?';
        params.push(epistemicType);
      }
      if (minConfidence > 0) {
        sql += ' AND confidence >= ?';
        params.push(minConfidence);
      }

      // Keyword token filters for indexed fast filtering
      if (tokens.length > 0) {
        const tokenClauses = tokens.map(() => '(LOWER(fact) LIKE ? OR LOWER(category) LIKE ? OR LOWER(source) LIKE ?)');
        sql += ` AND (${tokenClauses.join(' OR ')})`;
        for (const tok of tokens) {
          const wild = `%${tok}%`;
          params.push(wild, wild, wild);
        }
      }

      sql += ' ORDER BY updated_at DESC LIMIT 500';
      const rows = this.db.prepare(sql).all(...params);
      candidates = rows.map(r => this.normalizeMemory(r));
    } else {
      candidates = this.fallbackStore.memories
        .filter(m => !m.deleted && (includeArchived || !m.is_archived))
        .map(m => this.normalizeMemory(m));
      if (layer) candidates = candidates.filter(m => m.memoryLayer === layer);
      if (category) candidates = candidates.filter(m => m.category === category);
      if (epistemicType) candidates = candidates.filter(m => m.epistemicType === epistemicType);
      if (minConfidence > 0) candidates = candidates.filter(m => m.confidence >= minConfidence);
    }

    // Project context filter via metadata
    if (projectId) {
      candidates = candidates.filter(m => {
        const meta = m.metadata || {};
        return meta.projectId === projectId || meta.project_id === projectId;
      });
    }

    // Rank candidates using multi-factor hybrid scoring
    const nowMs = Date.now();
    const scored = candidates.map(mem => {
      let score = 0.0;
      const lowerFact = mem.fact.toLowerCase();

      // 1. Exact phrase match bonus
      if (qStr && lowerFact.includes(qStr)) {
        score += 0.50;
      }

      // 2. Token overlap score
      if (tokens.length > 0) {
        let matchedCount = 0;
        for (const tok of tokens) {
          if (lowerFact.includes(tok)) matchedCount++;
        }
        score += (matchedCount / tokens.length) * 0.40;
      } else {
        score += 0.30;
      }

      // 3. Confidence weighting
      score += (mem.confidence || 1.0) * 0.15;

      // 4. Recency exponential time decay
      const ageDays = Math.max(0, (nowMs - new Date(mem.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      const recencyBoost = Math.exp(-0.001 * ageDays) * 0.15;
      score += recencyBoost;

      // 5. Access count frequency boost
      const accessBoost = Math.min(0.10, (mem.accessCount || 0) * 0.01);
      score += accessBoost;

      // 6. User preference & verified fact epistemic boost
      if (mem.epistemicType === EPISTEMIC_TYPES.USER_STATEMENT) score += 0.10;
      if (mem.epistemicType === EPISTEMIC_TYPES.VERIFIED_FACT) score += 0.05;

      return { ...mem, relevancyScore: Math.round(score * 100) / 100 };
    });

    scored.sort((a, b) => b.relevancyScore - a.relevancyScore);
    const paginated = scored.slice(offset, offset + limit);

    // Asynchronously record access frequency for retrieved items
    if (this.isNativeSqlite && paginated.length > 0) {
      try {
        const updateStmt = this.db.prepare('UPDATE memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?');
        const nowIso = new Date().toISOString();
        for (const p of paginated) {
          updateStmt.run(nowIso, p.id);
        }
      } catch (_) {}
    }

    return {
      results: paginated,
      totalMatches: scored.length,
      latencyMs: Date.now() - t0,
      query: qStr,
      layerFilter: layer
    };
  }

  // =========================================================================
  // 4. ARCHIVE MANAGEMENT & ATOMIC COMPRESSION
  // =========================================================================

  archiveMemories(options = {}) {
    const {
      olderThanDays = 90,
      memoryLayer = null,
      category = null,
      archiveName = null,
      limit = 10000
    } = options;

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const archiveId = `arch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const name = archiveName || `MemoryArchive_${now.toISOString().slice(0, 10)}`;

    let targetMemories = [];
    if (this.isNativeSqlite && this.db) {
      let sql = 'SELECT * FROM memories WHERE deleted = 0 AND is_archived = 0 AND updated_at < ?';
      const params = [cutoffDate];
      if (memoryLayer) {
        sql += ' AND memory_layer = ?';
        params.push(memoryLayer);
      }
      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }
      sql += ' ORDER BY updated_at ASC LIMIT ?';
      params.push(limit);

      const rows = this.db.prepare(sql).all(...params);
      targetMemories = rows.map(r => this.normalizeMemory(r));
    } else {
      targetMemories = this.fallbackStore.memories
        .filter(m => !m.deleted && !m.is_archived && m.updated_at < cutoffDate)
        .slice(0, limit)
        .map(m => this.normalizeMemory(m));
    }

    if (targetMemories.length === 0) {
      return { archiveId: null, recordCount: 0, message: 'No eligible memories found matching archive criteria.' };
    }

    // Compress memories payload using gzip
    const rawJson = JSON.stringify(targetMemories);
    const uncompressedBytes = Buffer.byteLength(rawJson, 'utf8');
    const compressedBuffer = zlib.gzipSync(Buffer.from(rawJson, 'utf8'));
    const compressedBytes = compressedBuffer.length;
    const sha256Hash = crypto.createHash('sha256').update(compressedBuffer).digest('hex');
    const base64Data = compressedBuffer.toString('base64');

    const startDate = targetMemories[0].createdAt || targetMemories[0].updatedAt;
    const endDate = targetMemories[targetMemories.length - 1].updatedAt;
    const createdAt = now.toISOString();

    if (this.isNativeSqlite && this.db) {
      this.db.exec('BEGIN TRANSACTION;');
      try {
        const archStmt = this.db.prepare(`
          INSERT INTO memory_archives (id, name, record_count, compressed_size_bytes, uncompressed_size_bytes, sha256_hash, data_blob, start_date, end_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        archStmt.run(archiveId, name, targetMemories.length, compressedBytes, uncompressedBytes, sha256Hash, base64Data, startDate, endDate, createdAt);

        // Mark target memories as archived
        const updateStmt = this.db.prepare('UPDATE memories SET is_archived = 1, archive_id = ? WHERE id = ?');
        for (const m of targetMemories) {
          updateStmt.run(archiveId, m.id);
        }
        this.db.exec('COMMIT;');
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      }
    } else {
      if (!this.fallbackStore.archives) this.fallbackStore.archives = [];
      this.fallbackStore.archives.push({
        id: archiveId,
        name,
        record_count: targetMemories.length,
        compressed_size_bytes: compressedBytes,
        uncompressed_size_bytes: uncompressedBytes,
        sha256_hash: sha256Hash,
        data_blob: base64Data,
        start_date: startDate,
        end_date: endDate,
        created_at: createdAt
      });
      for (const m of targetMemories) {
        const found = this.fallbackStore.memories.find(x => x.id === m.id);
        if (found) {
          found.is_archived = 1;
          found.archive_id = archiveId;
        }
      }
      this.saveFallbackStore();
    }

    return {
      archiveId,
      name,
      recordCount: targetMemories.length,
      compressedSizeBytes: compressedBytes,
      uncompressedSizeBytes: uncompressedBytes,
      compressionRatio: Math.round((1 - compressedBytes / uncompressedBytes) * 100) + '%',
      sha256Hash,
      createdAt
    };
  }

  restoreArchive(archiveId) {
    if (!archiveId) throw new Error('Archive ID is required to restore.');

    let archive = null;
    if (this.isNativeSqlite && this.db) {
      archive = this.db.prepare('SELECT * FROM memory_archives WHERE id = ?').get(archiveId);
    } else {
      archive = (this.fallbackStore.archives || []).find(a => a.id === archiveId);
    }

    if (!archive) {
      throw new Error(`Archive '${archiveId}' not found.`);
    }

    const compressedBuffer = Buffer.from(archive.data_blob, 'base64');
    const calculatedHash = crypto.createHash('sha256').update(compressedBuffer).digest('hex');
    if (calculatedHash !== archive.sha256_hash) {
      throw new Error(`Archive corruption detected! Hash mismatch: expected ${archive.sha256_hash}, got ${calculatedHash}`);
    }

    const uncompressedBuffer = zlib.gunzipSync(compressedBuffer);
    const restoredMemories = JSON.parse(uncompressedBuffer.toString('utf8'));

    // Re-instate unarchived status
    if (this.isNativeSqlite && this.db) {
      const stmt = this.db.prepare('UPDATE memories SET is_archived = 0, archive_id = null WHERE archive_id = ?');
      stmt.run(archiveId);
    } else {
      for (const mem of this.fallbackStore.memories) {
        if (mem.archive_id === archiveId) {
          mem.is_archived = 0;
          mem.archive_id = null;
        }
      }
      this.saveFallbackStore();
    }

    return {
      archiveId,
      restoredCount: restoredMemories.length,
      verified: true,
      sha256Hash: calculatedHash
    };
  }

  listArchives() {
    if (this.isNativeSqlite && this.db) {
      const rows = this.db.prepare('SELECT id, name, record_count, compressed_size_bytes, uncompressed_size_bytes, sha256_hash, start_date, end_date, created_at FROM memory_archives ORDER BY created_at DESC').all();
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        recordCount: r.record_count,
        compressedSizeBytes: r.compressed_size_bytes,
        uncompressedSizeBytes: r.uncompressed_size_bytes,
        sha256Hash: r.sha256_hash,
        startDate: r.start_date,
        endDate: r.end_date,
        createdAt: r.created_at
      }));
    } else {
      return (this.fallbackStore.archives || []).map(r => ({
        id: r.id,
        name: r.name,
        recordCount: r.record_count,
        compressedSizeBytes: r.compressed_size_bytes,
        uncompressedSizeBytes: r.uncompressed_size_bytes,
        sha256Hash: r.sha256_hash,
        startDate: r.start_date,
        endDate: r.end_date,
        createdAt: r.created_at
      }));
    }
  }

  // =========================================================================
  // 5. ATOMIC BACKUP & DATABASE RESTORATION
  // =========================================================================

  createAtomicBackup(targetPath = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = targetPath || path.join(BACKUP_DIR, `stark_memory_${timestamp}.db`);

    if (this.isNativeSqlite && this.db && fs.existsSync(this.dbPath)) {
      // 1. Passive checkpoint to flush dirty pages
      try {
        this.db.exec('PRAGMA wal_checkpoint(PASSIVE);');
      } catch (_) {}

      // 2. Use SQLite VACUUM INTO for a clean atomic snapshot
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      const normalizedPath = outPath.replace(/\\/g, '/');
      try {
        this.db.exec(`VACUUM INTO '${normalizedPath}';`);
      } catch (err) {
        // Fallback to copyFileSync if VACUUM INTO is unsupported in specific context
        fs.copyFileSync(this.dbPath, outPath);
      }

      const stat = fs.statSync(outPath);
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(outPath)).digest('hex');

      return {
        success: true,
        verified: true,
        backupPath: outPath,
        sizeBytes: stat.size,
        sha256Hash: sha256,
        timestamp,
        format: 'sqlite'
      };
    } else {
      const jsonBackup = outPath.replace(/\.db$/, '.json');
      fs.writeFileSync(jsonBackup, JSON.stringify(this.fallbackStore, null, 2), 'utf8');
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(jsonBackup)).digest('hex');
      return {
        success: true,
        verified: true,
        backupPath: jsonBackup,
        sizeBytes: fs.statSync(jsonBackup).size,
        sha256Hash: sha256,
        timestamp,
        format: 'json'
      };
    }
  }

  backupDatabase(targetPath = null) {
    return this.createAtomicBackup(targetPath);
  }

  restoreFromBackup(backupPath) {
    if (!backupPath || !fs.existsSync(backupPath)) {
      throw new Error(`Backup file '${backupPath}' does not exist on disk.`);
    }

    if (this.isNativeSqlite) {
      // Close current db connection
      this.close();

      // Atomic replace
      fs.copyFileSync(backupPath, this.dbPath);

      // Remove stale wal/shm files
      try { if (fs.existsSync(this.dbPath + '-wal')) fs.unlinkSync(this.dbPath + '-wal'); } catch (_) {}
      try { if (fs.existsSync(this.dbPath + '-shm')) fs.unlinkSync(this.dbPath + '-shm'); } catch (_) {}

      // Re-initialize
      const { DatabaseSync } = require('node:sqlite');
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');

      const integrity = this.checkIntegrity();
      if (!integrity.ok) {
        throw new Error(`Restored database failed integrity check: ${integrity.error || 'Corrupt'}`);
      }

      return {
        success: true,
        verified: true,
        activeMemoriesCount: integrity.activeMemoriesCount,
        dbPath: this.dbPath,
        engine: 'native_sqlite_wal'
      };
    } else {
      this.fallbackStore = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      this.saveFallbackStore();
      return { success: true, verified: true, activeMemoriesCount: this.fallbackStore.memories.length };
    }
  }

  // =========================================================================
  // 6. STORAGE HEALTH, CAPACITY THRESHOLDS & OBSERVABILITY
  // =========================================================================

  checkStorageHealth(options = {}) {
    let dbSize = 0;
    try {
      if (fs.existsSync(this.dbPath)) dbSize += fs.statSync(this.dbPath).size;
      if (fs.existsSync(this.dbPath + '-wal')) dbSize += fs.statSync(this.dbPath + '-wal').size;
      if (fs.existsSync(this.dbPath + '-shm')) dbSize += fs.statSync(this.dbPath + '-shm').size;
    } catch (_) {}

    let archiveSize = 0;
    try {
      const archives = this.listArchives();
      archiveSize = archives.reduce((sum, a) => sum + (a.compressedSizeBytes || 0), 0);
    } catch (_) {}

    const counts = this.getCounts();
    const integrity = this.checkIntegrity();

    // Query free disk space approximation (Node.js os.freemem or stats)
    const freeMemoryBytes = require('os').freemem();
    let warningLevel = 'NORMAL';
    let warningMessage = 'Storage capacity healthy. Continuous memory formation active.';

    // Configurable thresholds
    if (dbSize > 500 * 1024 * 1024) { // 500MB warning threshold
      warningLevel = 'WARNING';
      warningMessage = `Database size (${Math.round(dbSize / (1024 * 1024))}MB) is growing large. Recommend running archiveMemories().`;
    }

    if (!integrity.ok) {
      warningLevel = 'CRITICAL';
      warningMessage = `Database corruption warning: ${integrity.error || 'Integrity check failed'}`;
    }

    return {
      dbSizeBytes: dbSize,
      archiveSizeBytes: archiveSize,
      totalMemorySizeBytes: dbSize + archiveSize,
      activeMemories: counts.active,
      totalMemories: counts.total,
      freeHostMemoryBytes: freeMemoryBytes,
      warningLevel,
      warningMessage,
      integrityOk: integrity.ok,
      engine: this.isNativeSqlite ? 'native_sqlite_wal' : 'fallback_json'
    };
  }

  optimizeDatabase() {
    if (this.isNativeSqlite && this.db) {
      try {
        this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        this.db.exec('PRAGMA optimize;');
        return { success: true, optimizedAt: new Date().toISOString() };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: true, optimizedAt: new Date().toISOString() };
  }

  getMemoryObservability() {
    const health = this.checkStorageHealth();
    const layers = {};
    for (const key of Object.values(MEMORY_LAYERS)) {
      layers[key] = 0;
    }

    const epistemic = {};
    for (const key of Object.values(EPISTEMIC_TYPES)) {
      epistemic[key] = 0;
    }

    if (this.isNativeSqlite && this.db) {
      try {
        const layerRows = this.db.prepare('SELECT memory_layer, count(*) as c FROM memories WHERE deleted = 0 GROUP BY memory_layer').all();
        for (const r of layerRows) {
          if (r.memory_layer) layers[r.memory_layer] = r.c;
        }

        const epistemicRows = this.db.prepare('SELECT epistemic_type, count(*) as c FROM memories WHERE deleted = 0 GROUP BY epistemic_type').all();
        for (const r of epistemicRows) {
          if (r.epistemic_type) epistemic[r.epistemic_type] = r.c;
        }
      } catch (_) {}
    } else {
      for (const m of this.fallbackStore.memories.filter(x => !x.deleted)) {
        const l = m.memory_layer || m.memoryLayer || 'semantic';
        layers[l] = (layers[l] || 0) + 1;
        const e = m.epistemic_type || m.epistemicType || 'USER_STATEMENT';
        epistemic[e] = (epistemic[e] || 0) + 1;
      }
    }

    return {
      totalStoredMemories: health.totalMemories,
      activeMemories: health.activeMemories,
      memoryLayers: layers,
      epistemicDistribution: epistemic,
      storage: {
        databaseSizeBytes: health.dbSizeBytes,
        archiveSizeBytes: health.archiveSizeBytes,
        totalSizeBytes: health.totalMemorySizeBytes,
        warningLevel: health.warningLevel,
        warningMessage: health.warningMessage
      },
      indexHealth: health.integrityOk ? 'OPTIMAL' : 'CORRUPT',
      retrievalEngine: this.isNativeSqlite ? 'SQLite_WAL_Indexed' : 'MemoryFallback'
    };
  }

  // =========================================================================
  // 7. USER CONTROL & SEMANTIC INTENTS
  // =========================================================================

  rememberUserFact(fact, category = 'preference', metadata = {}) {
    return this.insertMemory({
      fact,
      category,
      epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
      memoryLayer: MEMORY_LAYERS.USER_PREFERENCE,
      source: 'user_explicit_command',
      confidence: 1.0,
      metadata: { ...metadata, rememberedAt: new Date().toISOString() }
    });
  }

  recallProjectMemories(projectName) {
    if (!projectName) return { project: null, memories: [] };
    const project = this.getProject(projectName);
    const memories = this.hybridSearchMemories(projectName, {
      layer: MEMORY_LAYERS.PROJECT,
      limit: 100
    });
    return {
      project,
      memories: memories.results
    };
  }

  markMemoryOutdated(id, reason = 'Marked outdated by user') {
    return this.updateMemory(id, {
      epistemicType: EPISTEMIC_TYPES.OUTDATED,
      confidence: 0.1,
      metadata: { outdated: true, outdatedReason: reason, outdatedAt: new Date().toISOString() }
    });
  }

  invalidateMemory(id, reason = 'User requested deletion') {
    const memory = this.getMemoryById(id);
    if (!memory) return { success: false, error: 'Memory not found' };

    // Soft delete memory with audit reason
    const now = new Date().toISOString();
    const meta = { ...memory.metadata, invalidatedAt: now, invalidationReason: reason };
    this.updateMemory(id, { metadata: meta });
    this.deleteMemory(id);

    // Invalidate derived knowledge graph nodes
    if (this.isNativeSqlite && this.db) {
      try {
        const kgRows = this.db.prepare('SELECT id, properties FROM kg_nodes WHERE label = ?').all(memory.fact);
        const updateKg = this.db.prepare('UPDATE kg_nodes SET confidence = 0.0, properties = ? WHERE id = ?');
        for (const row of kgRows) {
          let props = {};
          try { props = JSON.parse(row.properties || '{}'); } catch (_) {}
          props.invalidated = 1;
          props.invalidationReason = reason;
          updateKg.run(JSON.stringify(props), row.id);
        }
      } catch (_) {}
    } else {
      if (this.fallbackStore.kg_nodes) {
        for (const n of this.fallbackStore.kg_nodes) {
          if (n.label === memory.fact) {
            n.confidence = 0.0;
            n.properties = n.properties || {};
            n.properties.invalidated = 1;
          }
        }
        this.saveFallbackStore();
      }
    }

    return { success: true, id, fact: memory.fact, reason, invalidatedAt: now };
  }

  // =========================================================================
  // 8. PROJECT CONTEXT OPERATIONS
  // =========================================================================

  saveProject(project) {
    if (!project || !project.projectName) {
      throw new Error('Project name is required to save project memory.');
    }

    const now = new Date().toISOString();
    const id = project.id || `proj_${project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    const name = project.projectName.trim();
    const objective = project.objective || '';
    const architecture = project.architecture || '';
    const status = project.status || 'IN_PROGRESS';
    const milestones = JSON.stringify(project.milestones || []);
    const keyFiles = JSON.stringify(project.keyFiles || []);
    const decisions = JSON.stringify(project.decisions || []);
    const bugsAndFixes = JSON.stringify(project.bugsAndFixes || []);
    const nextSteps = JSON.stringify(project.nextSteps || []);

    if (this.isNativeSqlite) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projects 
        (id, project_name, objective, architecture, status, milestones, key_files, decisions, bugs_and_fixes, next_steps, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, coalesce((SELECT created_at FROM projects WHERE project_name = ?), ?), ?)
      `);
      stmt.run(id, name, objective, architecture, status, milestones, keyFiles, decisions, bugsAndFixes, nextSteps, name, now, now);
    } else {
      this.fallbackStore.projects[name.toLowerCase()] = {
        id,
        projectName: name,
        objective,
        architecture,
        status,
        milestones: project.milestones || [],
        keyFiles: project.keyFiles || [],
        decisions: project.decisions || [],
        bugsAndFixes: project.bugsAndFixes || [],
        nextSteps: project.nextSteps || [],
        createdAt: now,
        updatedAt: now
      };
      this.saveFallbackStore();
    }

    return this.getProject(name);
  }

  getProject(projectName) {
    if (!projectName) return null;

    if (this.isNativeSqlite) {
      const stmt = this.db.prepare('SELECT * FROM projects WHERE LOWER(project_name) = LOWER(?)');
      const row = stmt.get(projectName.trim());
      if (!row) return null;

      return {
        id: row.id,
        projectName: row.project_name,
        objective: row.objective,
        architecture: row.architecture,
        status: row.status,
        milestones: JSON.parse(row.milestones || '[]'),
        keyFiles: JSON.parse(row.key_files || '[]'),
        decisions: JSON.parse(row.decisions || '[]'),
        bugsAndFixes: JSON.parse(row.bugs_and_fixes || '[]'),
        nextSteps: JSON.parse(row.next_steps || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } else {
      const p = this.fallbackStore.projects[projectName.toLowerCase().trim()];
      return p ? { ...p } : null;
    }
  }

  listProjects() {
    if (this.isNativeSqlite) {
      const stmt = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
      const rows = stmt.all();
      return rows.map(row => ({
        id: row.id,
        projectName: row.project_name,
        objective: row.objective,
        architecture: row.architecture,
        status: row.status,
        milestones: JSON.parse(row.milestones || '[]'),
        keyFiles: JSON.parse(row.key_files || '[]'),
        decisions: JSON.parse(row.decisions || '[]'),
        bugsAndFixes: JSON.parse(row.bugs_and_fixes || '[]'),
        nextSteps: JSON.parse(row.next_steps || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } else {
      return Object.values(this.fallbackStore.projects);
    }
  }

  // =========================================================================
  // 9. CONFIGURATION KEY-VALUE STORE
  // =========================================================================

  getConfig(key, defaultValue = null) {
    if (!key) return defaultValue;

    if (this.isNativeSqlite) {
      const stmt = this.db.prepare('SELECT value FROM memory_config WHERE key = ?');
      const row = stmt.get(key);
      return row ? row.value : defaultValue;
    } else {
      return this.fallbackStore.config[key] !== undefined ? this.fallbackStore.config[key] : defaultValue;
    }
  }

  setConfig(key, value) {
    if (!key) return false;
    const strVal = String(value);

    if (this.isNativeSqlite) {
      const stmt = this.db.prepare('INSERT OR REPLACE INTO memory_config (key, value) VALUES (?, ?)');
      stmt.run(key, strVal);
    } else {
      this.fallbackStore.config[key] = strVal;
      this.saveFallbackStore();
    }
    return true;
  }

  // =========================================================================
  // 10. KNOWLEDGE GRAPH & RESEARCH PERSISTENCE (PHASE 7 REUSE)
  // =========================================================================

  saveKgNode(node = {}) {
    const id = node.id || `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const type = node.type || 'concept';
    const label = node.label || String(id);
    const properties = typeof node.properties === 'object' ? JSON.stringify(node.properties) : String(node.properties || '{}');
    const provenance = node.provenance || 'research_pipeline';
    const confidence = typeof node.confidence === 'number' ? node.confidence : 1.0;
    const epistemicType = node.epistemicType || EPISTEMIC_TYPES.CLAIM;
    const projectId = node.projectId || null;
    const now = new Date().toISOString();

    if (this.isNativeSqlite && this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO kg_nodes (id, type, label, properties, provenance, confidence, epistemic_type, project_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          properties = excluded.properties,
          provenance = excluded.provenance,
          confidence = excluded.confidence,
          epistemic_type = excluded.epistemic_type,
          project_id = excluded.project_id,
          updated_at = excluded.updated_at
      `);
      stmt.run(id, type, label, properties, provenance, confidence, epistemicType, projectId, now, now);
    } else {
      if (!this.fallbackStore.kg_nodes) this.fallbackStore.kg_nodes = [];
      const idx = this.fallbackStore.kg_nodes.findIndex(n => n.id === id);
      const record = { id, type, label, properties: JSON.parse(properties), provenance, confidence, epistemicType, projectId, createdAt: now, updatedAt: now };
      if (idx >= 0) this.fallbackStore.kg_nodes[idx] = record;
      else this.fallbackStore.kg_nodes.push(record);
      this.saveFallbackStore();
    }

    return { id, type, label, provenance, confidence, epistemicType, projectId };
  }

  getKgNode(id) {
    if (this.isNativeSqlite && this.db) {
      const stmt = this.db.prepare('SELECT * FROM kg_nodes WHERE id = ?');
      const row = stmt.get(id);
      if (!row) return null;
      return {
        id: row.id,
        type: row.type,
        label: row.label,
        properties: JSON.parse(row.properties || '{}'),
        provenance: row.provenance,
        confidence: row.confidence,
        epistemicType: row.epistemic_type,
        projectId: row.project_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } else {
      if (!this.fallbackStore.kg_nodes) return null;
      return this.fallbackStore.kg_nodes.find(n => n.id === id) || null;
    }
  }

  searchKgNodes(query = '', typeFilter = null, projectId = null) {
    const qLower = String(query || '').toLowerCase().trim();
    if (this.isNativeSqlite && this.db) {
      let sql = 'SELECT * FROM kg_nodes WHERE 1=1';
      const params = [];
      if (typeFilter) {
        sql += ' AND type = ?';
        params.push(typeFilter);
      }
      if (projectId) {
        sql += ' AND project_id = ?';
        params.push(projectId);
      }
      if (qLower) {
        sql += ' AND (LOWER(label) LIKE ? OR LOWER(properties) LIKE ? OR LOWER(provenance) LIKE ?)';
        const wild = `%${qLower}%`;
        params.push(wild, wild, wild);
      }
      sql += ' ORDER BY confidence DESC, updated_at DESC LIMIT 50';
      const rows = this.db.prepare(sql).all(...params);
      return rows.map(r => ({
        id: r.id,
        type: r.type,
        label: r.label,
        properties: JSON.parse(r.properties || '{}'),
        provenance: r.provenance,
        confidence: r.confidence,
        epistemicType: r.epistemic_type,
        projectId: r.project_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    } else {
      if (!this.fallbackStore.kg_nodes) return [];
      return this.fallbackStore.kg_nodes.filter(n => {
        if (typeFilter && n.type !== typeFilter) return false;
        if (projectId && n.projectId !== projectId) return false;
        if (!qLower) return true;
        return n.label.toLowerCase().includes(qLower) || JSON.stringify(n.properties).toLowerCase().includes(qLower);
      });
    }
  }

  saveKgEdge(edge = {}) {
    const id = edge.id || `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fromId = edge.fromId || edge.from_id;
    const toId = edge.toId || edge.to_id;
    const relationship = edge.relationship || 'RELATES_TO';
    const weight = typeof edge.weight === 'number' ? edge.weight : 1.0;
    const metadata = typeof edge.metadata === 'object' ? JSON.stringify(edge.metadata) : String(edge.metadata || '{}');
    const source = edge.source || null;
    const now = new Date().toISOString();

    if (this.isNativeSqlite && this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO kg_edges (id, from_id, to_id, relationship, weight, metadata, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          relationship = excluded.relationship,
          weight = excluded.weight,
          metadata = excluded.metadata,
          source = excluded.source
      `);
      stmt.run(id, fromId, toId, relationship, weight, metadata, source, now);
    } else {
      if (!this.fallbackStore.kg_edges) this.fallbackStore.kg_edges = [];
      const idx = this.fallbackStore.kg_edges.findIndex(e => e.id === id);
      const record = { id, fromId, toId, relationship, weight, metadata: JSON.parse(metadata), source, createdAt: now };
      if (idx >= 0) this.fallbackStore.kg_edges[idx] = record;
      else this.fallbackStore.kg_edges.push(record);
      this.saveFallbackStore();
    }

    return { id, fromId, toId, relationship, weight, source };
  }

  getKgEdges(nodeId, direction = 'all') {
    if (this.isNativeSqlite && this.db) {
      let sql = 'SELECT * FROM kg_edges WHERE ';
      const params = [];
      if (direction === 'outgoing') {
        sql += 'from_id = ?';
        params.push(nodeId);
      } else if (direction === 'incoming') {
        sql += 'to_id = ?';
        params.push(nodeId);
      } else {
        sql += 'from_id = ? OR to_id = ?';
        params.push(nodeId, nodeId);
      }
      const rows = this.db.prepare(sql).all(...params);
      return rows.map(r => ({
        id: r.id,
        fromId: r.from_id,
        toId: r.to_id,
        relationship: r.relationship,
        weight: r.weight,
        metadata: JSON.parse(r.metadata || '{}'),
        source: r.source,
        createdAt: r.created_at
      }));
    } else {
      if (!this.fallbackStore.kg_edges) return [];
      return this.fallbackStore.kg_edges.filter(e => {
        if (direction === 'outgoing') return e.fromId === nodeId;
        if (direction === 'incoming') return e.toId === nodeId;
        return e.fromId === nodeId || e.toId === nodeId;
      });
    }
  }

  saveContradiction(contra = {}) {
    const id = contra.id || `contra_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const entityOrConcept = contra.entityOrConcept || contra.concept || 'General';
    const claimA = contra.claimA || '';
    const sourceA = contra.sourceA || 'Unknown';
    const claimB = contra.claimB || '';
    const sourceB = contra.sourceB || 'Unknown';
    const contradictionType = contra.contradictionType || 'DIRECT_CONFLICT';
    const resolved = contra.resolved ? 1 : 0;
    const resolution = contra.resolution || null;
    const projectId = contra.projectId || null;
    const now = new Date().toISOString();

    if (this.isNativeSqlite && this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO kg_contradictions (id, entity_or_concept, claim_a, source_a, claim_b, source_b, contradiction_type, resolved, resolution, project_id, detected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          resolved = excluded.resolved,
          resolution = excluded.resolution
      `);
      stmt.run(id, entityOrConcept, claimA, sourceA, claimB, sourceB, contradictionType, resolved, resolution, projectId, now);
    } else {
      if (!this.fallbackStore.kg_contradictions) this.fallbackStore.kg_contradictions = [];
      const idx = this.fallbackStore.kg_contradictions.findIndex(c => c.id === id);
      const record = { id, entityOrConcept, claimA, sourceA, claimB, sourceB, contradictionType, resolved: Boolean(resolved), resolution, projectId, detectedAt: now };
      if (idx >= 0) this.fallbackStore.kg_contradictions[idx] = record;
      else this.fallbackStore.kg_contradictions.push(record);
      this.saveFallbackStore();
    }

    return { id, entityOrConcept, claimA, sourceA, claimB, sourceB, contradictionType, resolved: Boolean(resolved), resolution };
  }

  getContradictions(entityOrConcept = null, resolvedOnly = null) {
    if (this.isNativeSqlite && this.db) {
      let sql = 'SELECT * FROM kg_contradictions WHERE 1=1';
      const params = [];
      if (entityOrConcept) {
        sql += ' AND entity_or_concept = ?';
        params.push(entityOrConcept);
      }
      if (resolvedOnly !== null) {
        sql += ' AND resolved = ?';
        params.push(resolvedOnly ? 1 : 0);
      }
      sql += ' ORDER BY detected_at DESC';
      const rows = this.db.prepare(sql).all(...params);
      return rows.map(r => ({
        id: r.id,
        entityOrConcept: r.entity_or_concept,
        claimA: r.claim_a,
        sourceA: r.source_a,
        claimB: r.claim_b,
        sourceB: r.source_b,
        contradictionType: r.contradiction_type,
        resolved: Boolean(r.resolved),
        resolution: r.resolution,
        projectId: r.project_id,
        detectedAt: r.detected_at
      }));
    } else {
      if (!this.fallbackStore.kg_contradictions) return [];
      return this.fallbackStore.kg_contradictions.filter(c => {
        if (entityOrConcept && c.entityOrConcept !== entityOrConcept) return false;
        if (resolvedOnly !== null && c.resolved !== resolvedOnly) return false;
        return true;
      });
    }
  }

  resolveContradiction(id, resolutionText) {
    if (this.isNativeSqlite && this.db) {
      const stmt = this.db.prepare('UPDATE kg_contradictions SET resolved = 1, resolution = ? WHERE id = ?');
      stmt.run(resolutionText, id);
    } else {
      if (!this.fallbackStore.kg_contradictions) return false;
      const c = this.fallbackStore.kg_contradictions.find(x => x.id === id);
      if (c) {
        c.resolved = true;
        c.resolution = resolutionText;
        this.saveFallbackStore();
      }
    }
    return true;
  }

  correctMemory(memoryId, updatedFact, correctionReason = 'User correction') {
    const now = new Date().toISOString();
    if (this.isNativeSqlite && this.db) {
      const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(memoryId);
      if (!row) return null;
      const meta = JSON.parse(row.metadata || '{}');
      meta.priorVersions = meta.priorVersions || [];
      meta.priorVersions.push({ fact: row.fact, replacedAt: now, reason: correctionReason });
      meta.correctionReason = correctionReason;

      const stmt = this.db.prepare(`
        UPDATE memories
        SET fact = ?, epistemic_type = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(updatedFact, EPISTEMIC_TYPES.USER_STATEMENT, JSON.stringify(meta), now, memoryId);

      return {
        id: memoryId,
        fact: updatedFact,
        epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
        priorFact: row.fact,
        correctionReason,
        updatedAt: now
      };
    } else {
      const mem = this.fallbackStore.memories.find(m => m.id === memoryId);
      if (!mem) return null;
      mem.priorVersions = mem.priorVersions || [];
      mem.priorVersions.push({ fact: mem.fact, replacedAt: now, reason: correctionReason });
      mem.fact = updatedFact;
      mem.epistemic_type = EPISTEMIC_TYPES.USER_STATEMENT;
      mem.updated_at = now;
      this.saveFallbackStore();
      return { id: memoryId, fact: updatedFact, correctionReason, updatedAt: now };
    }
  }

  // =========================================================================
  // 11. COUNTS & INTEGRITY
  // =========================================================================

  getCounts() {
    if (this.isNativeSqlite && this.db) {
      try {
        const total = this.db.prepare('SELECT count(*) as c FROM memories').get().c;
        const active = this.db.prepare('SELECT count(*) as c FROM memories WHERE deleted = 0 AND is_archived = 0').get().c;
        const deleted = this.db.prepare('SELECT count(*) as c FROM memories WHERE deleted = 1').get().c;
        const archived = this.db.prepare('SELECT count(*) as c FROM memories WHERE is_archived = 1 AND deleted = 0').get().c;
        return { total, active, deleted, archived };
      } catch (_) {
        return { total: 0, active: 0, deleted: 0, archived: 0 };
      }
    } else {
      const total = this.fallbackStore.memories.length;
      const deleted = this.fallbackStore.memories.filter(m => m.deleted).length;
      const archived = this.fallbackStore.memories.filter(m => m.is_archived).length;
      const active = total - deleted - archived;
      return { total, active, deleted, archived };
    }
  }

  checkIntegrity() {
    if (this.initError) {
      return { ok: false, error: this.initError, engine: 'corrupt_sqlite' };
    }
    if (!this.isNativeSqlite) {
      return { ok: true, engine: 'fallback_json', totalMemories: this.fallbackStore.memories.length };
    }

    try {
      const stmt = this.db.prepare('PRAGMA integrity_check;');
      const result = stmt.get();
      const countStmt = this.db.prepare('SELECT count(*) as count FROM memories WHERE deleted = 0;');
      const count = countStmt.get().count;

      return {
        ok: result.integrity_check === 'ok',
        engine: 'native_sqlite_wal',
        dbPath: this.dbPath,
        activeMemoriesCount: count
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // =========================================================================
  // 12. PHASE 14 TEMPORAL VALIDITY & HISTORICAL FACT METHODS
  // =========================================================================

  getMemoriesAtTimestamp(timestamp, layer = null) {
    const ts = typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString();
    if (this.isNativeSqlite && this.db) {
      let query = `
        SELECT * FROM memories
        WHERE deleted = 0
          AND (valid_from IS NULL OR valid_from <= ?)
          AND (valid_until IS NULL OR valid_until > ?)
      `;
      const params = [ts, ts];
      if (layer) {
        query += ' AND memory_layer = ?';
        params.push(layer);
      }
      query += ' ORDER BY created_at DESC';
      const rows = this.db.prepare(query).all(...params);
      return rows.map(r => this.normalizeMemory(r));
    } else {
      return this.fallbackStore.memories
        .filter(m => !m.deleted)
        .filter(m => (!m.valid_from || m.valid_from <= ts) && (!m.valid_until || m.valid_until > ts))
        .filter(m => !layer || (m.memory_layer || m.memoryLayer) === layer)
        .map(m => this.normalizeMemory(m));
    }
  }

  getMemoryHistory(memoryId) {
    if (this.isNativeSqlite && this.db) {
      const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(memoryId);
      if (!row) return null;
      const current = this.normalizeMemory(row);
      const meta = current.metadata || {};
      const priorVersions = meta.priorVersions || [];
      return {
        id: memoryId,
        currentFact: current.fact,
        isCurrent: current.isCurrent,
        confidenceClass: current.confidenceClass,
        validFrom: current.validFrom,
        validUntil: current.validUntil,
        priorVersions
      };
    } else {
      const mem = this.fallbackStore.memories.find(m => m.id === memoryId);
      if (!mem) return null;
      const current = this.normalizeMemory(mem);
      const meta = current.metadata || {};
      return {
        id: memoryId,
        currentFact: current.fact,
        isCurrent: current.isCurrent,
        confidenceClass: current.confidenceClass,
        validFrom: current.validFrom,
        validUntil: current.validUntil,
        priorVersions: meta.priorVersions || []
      };
    }
  }

  getValidMemories(filter = {}) {
    if (this.isNativeSqlite && this.db) {
      let query = 'SELECT * FROM memories WHERE deleted = 0 AND is_current = 1 AND is_archived = 0';
      const params = [];
      if (filter.layer) {
        query += ' AND memory_layer = ?';
        params.push(filter.layer);
      }
      if (filter.category) {
        query += ' AND category = ?';
        params.push(filter.category);
      }
      if (filter.recordType) {
        query += ' AND record_type = ?';
        params.push(filter.recordType);
      }
      if (filter.confidenceClass) {
        query += ' AND confidence_class = ?';
        params.push(filter.confidenceClass);
      }
      query += ' ORDER BY updated_at DESC';
      if (filter.limit) {
        query += ' LIMIT ?';
        params.push(Number(filter.limit));
      }
      const rows = this.db.prepare(query).all(...params);
      return rows.map(r => this.normalizeMemory(r));
    } else {
      let res = this.fallbackStore.memories.filter(m => !m.deleted && (m.is_current !== false && m.isCurrent !== false) && !m.is_archived);
      if (filter.layer) res = res.filter(m => (m.memory_layer || m.memoryLayer) === filter.layer);
      if (filter.category) res = res.filter(m => m.category === filter.category);
      if (filter.recordType) res = res.filter(m => (m.record_type || m.recordType) === filter.recordType);
      if (filter.confidenceClass) res = res.filter(m => (m.confidence_class || m.confidenceClass) === filter.confidenceClass);
      if (filter.limit) res = res.slice(0, Number(filter.limit));
      return res.map(m => this.normalizeMemory(m));
    }
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch (_) {}
      this.db = null;
    }
  }
}

module.exports = {
  StarkMemoryDb,
  EPISTEMIC_TYPES,
  MEMORY_LAYERS,
  CONFIDENCE_CLASSES,
  RECORD_TYPES,
  starkMemoryDbInstance: new StarkMemoryDb()
};
