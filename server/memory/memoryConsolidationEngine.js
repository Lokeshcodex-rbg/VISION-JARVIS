/**
 * VISION AI — Intelligent Memory Consolidation Engine
 * Phase 14 Module 2: Deduplication, Contradiction Detection, Epistemic Tagging,
 * Historical Fact Handling, and Supersession Management.
 * 
 * Invariants:
 * 1. Model inferences NEVER silently convert into confirmed user facts.
 * 2. User corrections supersede outdated information without destroying historical context.
 * 3. Contradictions between unconfirmed claims flag UNRESOLVED; user statements take precedence.
 */

const crypto = require('crypto');
const {
  starkMemoryDbInstance: db,
  EPISTEMIC_TYPES,
  MEMORY_LAYERS,
  CONFIDENCE_CLASSES,
  RECORD_TYPES
} = require('./starkMemoryDb');

class MemoryConsolidationEngine {
  constructor(dbInstance = db) {
    this.db = dbInstance;
  }

  // =========================================================================
  // 1. CANONICAL FACT KEY & SIMILARITY
  // =========================================================================

  /**
   * Generates a normalized canonical key from a fact string
   */
  computeCanonicalKey(fact = '') {
    return String(fact || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\b(a|an|the|is|are|was|were|my|our|user|to|set|preference|preferences|prefer|prefers|fact)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Computes token overlap (Jaccard similarity) between two strings
   */
  computeSimilarity(strA = '', strB = '') {
    const tokensA = new Set(this.computeCanonicalKey(strA).split(' ').filter(Boolean));
    const tokensB = new Set(this.computeCanonicalKey(strB).split(' ').filter(Boolean));
    if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
    if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const union = new Set([...tokensA, ...tokensB]).size;
    return union > 0 ? intersection / union : 0;
  }

  // =========================================================================
  // 2. DUPLICATE DETECTION & MERGING
  // =========================================================================

  /**
   * Scans existing memories for duplicates or near-duplicates.
   * If a compatible duplicate is found, merges provenance without creating duplicate records.
   */
  consolidateMemory(candidateItem) {
    const factText = String(candidateItem.fact || '').trim();
    if (!factText) return { action: 'SKIPPED_EMPTY', memory: null };

    const canonicalKey = this.computeCanonicalKey(factText);
    const existing = this.db.getValidMemories({
      layer: candidateItem.memoryLayer || candidateItem.memory_layer
    });

    for (const ex of existing) {
      const exKey = this.computeCanonicalKey(ex.fact);
      const sim = this.computeSimilarity(factText, ex.fact);

      // Exact or very high similarity (> 0.88)
      if (canonicalKey === exKey || sim >= 0.88) {
        // Merge compatible fact: preserve source history, update access count, keep highest confidence
        const now = new Date().toISOString();
        const meta = ex.metadata || {};
        meta.sources = meta.sources || [];
        if (candidateItem.source && !meta.sources.includes(candidateItem.source)) {
          meta.sources.push(candidateItem.source);
        }
        meta.lastMergedAt = now;
        meta.mergeCount = (meta.mergeCount || 0) + 1;

        // User confirmation takes absolute precedence
        let newConfidenceClass = ex.confidenceClass;
        let newEpistemic = ex.epistemicType;
        if (candidateItem.confidenceClass === CONFIDENCE_CLASSES.USER_CONFIRMED ||
            candidateItem.epistemicType === EPISTEMIC_TYPES.USER_STATEMENT) {
          newConfidenceClass = CONFIDENCE_CLASSES.USER_CONFIRMED;
          newEpistemic = EPISTEMIC_TYPES.USER_STATEMENT;
        }

        const merged = {
          ...ex,
          confidence: Math.max(ex.confidence, candidateItem.confidence !== undefined ? candidateItem.confidence : 1.0),
          confidenceClass: newConfidenceClass,
          epistemicType: newEpistemic,
          metadata: meta,
          accessCount: (ex.accessCount || 0) + 1,
          lastAccessedAt: now,
          updatedAt: now
        };

        this.db.saveMemory(merged);
        return {
          action: 'MERGED_EXISTING',
          isDuplicate: true,
          memoryId: ex.id,
          similarity: sim,
          memory: merged
        };
      }
    }

    // No duplicate found: check for potential contradictions before inserting
    const contradictionCheck = this.detectContradiction(candidateItem);
    if (contradictionCheck.hasContradiction) {
      return this.handleContradiction(candidateItem, contradictionCheck);
    }

    // Safe new insert
    const saved = this.db.saveMemory(candidateItem);
    return {
      action: 'INSERTED_NEW',
      isDuplicate: false,
      memoryId: candidateItem.id || (saved && saved.id),
      memory: saved
    };
  }

  // =========================================================================
  // 3. CONTRADICTION DETECTION & RESOLUTION
  // =========================================================================

  /**
   * Evaluates if candidate fact directly contradicts an active memory.
   * Checks entity, property, and conflicting predicate values.
   */
  detectContradiction(candidateItem) {
    const text = String(candidateItem.fact || '').toLowerCase();
    const existing = this.db.getValidMemories();

    // Regex extractors for common opposing statements
    const patterns = [
      // Format / indent: e.g. "tabs" vs "spaces"
      {
        entity: 'code_indentation',
        testA: /\b(tabs|tab indentation)\b/i,
        testB: /\b(spaces|2 spaces|4 spaces)\b/i
      },
      // Theme / mode: "dark mode" vs "light mode"
      {
        entity: 'ui_theme',
        testA: /\b(dark mode|dark theme)\b/i,
        testB: /\b(light mode|light theme)\b/i
      },
      // Deadlines / dates: "deadline is [Day/Date]"
      {
        entity: 'project_deadline',
        testA: /deadline\s+(?:is|set\s+to)\s+([A-Za-z0-9\s,\-]+)/i,
        testB: /deadline\s+(?:is|set\s+to)\s+([A-Za-z0-9\s,\-]+)/i,
        isCustomExtractor: true
      },
      // Beam / engineering parameter changes
      {
        entity: 'beam_load',
        testA: /applied\s+load\s*=\s*([0-9\.,]+)/i,
        testB: /applied\s+load\s*=\s*([0-9\.,]+)/i,
        isCustomExtractor: true
      }
    ];

    for (const pat of patterns) {
      if (pat.isCustomExtractor) {
        const matchCandidate = text.match(pat.testA);
        if (matchCandidate) {
          const valCandidate = matchCandidate[1].trim();
          for (const ex of existing) {
            const exText = (ex.fact || '').toLowerCase();
            const matchEx = exText.match(pat.testB);
            if (matchEx) {
              const valEx = matchEx[1].trim();
              if (valCandidate !== valEx) {
                return {
                  hasContradiction: true,
                  contradictionType: 'ATTRIBUTE_VALUE_MISMATCH',
                  entity: pat.entity,
                  conflictingMemory: ex,
                  existingValue: valEx,
                  candidateValue: valCandidate
                };
              }
            }
          }
        }
      } else {
        const candidateIsA = pat.testA.test(text);
        const candidateIsB = pat.testB.test(text);
        if (candidateIsA || candidateIsB) {
          for (const ex of existing) {
            const exText = (ex.fact || '').toLowerCase();
            const exIsA = pat.testA.test(exText);
            const exIsB = pat.testB.test(exText);
            if ((candidateIsA && exIsB) || (candidateIsB && exIsA)) {
              return {
                hasContradiction: true,
                contradictionType: 'MUTUALLY_EXCLUSIVE_PREDICATE',
                entity: pat.entity,
                conflictingMemory: ex,
                existingValue: exIsA ? 'Pattern A' : 'Pattern B',
                candidateValue: candidateIsA ? 'Pattern A' : 'Pattern B'
              };
            }
          }
        }
      }
    }

    return { hasContradiction: false };
  }

  /**
   * Resolves contradictions according to epistemic precedence:
   * 1. If candidate is USER_CONFIRMED: older fact is superseded, preserving historical record.
   * 2. If candidate is MODEL_INFERRED: recorded in kg_contradictions as UNRESOLVED; existing confirmed fact preserved.
   */
  handleContradiction(candidateItem, contradictionInfo) {
    const now = new Date().toISOString();
    const ex = contradictionInfo.conflictingMemory;
    const isCandidateUserConfirmed = candidateItem.confidenceClass === CONFIDENCE_CLASSES.USER_CONFIRMED ||
                                     candidateItem.epistemicType === EPISTEMIC_TYPES.USER_STATEMENT;
    const isExUserConfirmed = ex.confidenceClass === CONFIDENCE_CLASSES.USER_CONFIRMED ||
                              ex.epistemicType === EPISTEMIC_TYPES.USER_STATEMENT;

    const contraId = `contra_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    if (isCandidateUserConfirmed) {
      // User has explicitly overridden or updated the fact:
      // Mark older fact as SUPERSEDED, record superseding reference
      const newId = candidateItem.id || `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      // 1. Record contradiction resolved by user update
      this.db.saveContradiction({
        id: contraId,
        entityOrConcept: contradictionInfo.entity,
        claimA: ex.fact,
        sourceA: ex.source || 'prior_memory',
        claimB: candidateItem.fact,
        sourceB: candidateItem.source || 'user_update',
        contradictionType: contradictionInfo.contradictionType,
        projectId: candidateItem.metadata ? candidateItem.metadata.projectId : null
      });
      this.db.resolveContradiction(contraId, `Resolved by explicit user update at ${now}`);

      // 2. Mark older memory as superseded
      const updatedEx = {
        ...ex,
        isCurrent: false,
        validUntil: now,
        epistemicType: EPISTEMIC_TYPES.OUTDATED,
        confidenceClass: CONFIDENCE_CLASSES.SUPERSEDED,
        supersededBy: newId,
        metadata: {
          ...(ex.metadata || {}),
          supersededAt: now,
          supersededBy: newId,
          supersessionReason: 'Updated by explicit user statement'
        }
      };
      this.db.saveMemory(updatedEx);

      // 3. Save new memory with reference to prior
      const newRecord = {
        ...candidateItem,
        id: newId,
        isCurrent: true,
        validFrom: now,
        confidenceClass: CONFIDENCE_CLASSES.USER_CONFIRMED,
        epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
        metadata: {
          ...(candidateItem.metadata || {}),
          priorMemoryId: ex.id,
          supersedesMemoryId: ex.id
        }
      };
      const saved = this.db.saveMemory(newRecord);

      return {
        action: 'RESOLVED_BY_USER_CORRECTION',
        supersededMemoryId: ex.id,
        newMemoryId: newId,
        contradictionId: contraId,
        memory: saved
      };
    } else {
      // Candidate is model-inferred or uncertain:
      // STRICT INVARIANT: Model inference NEVER silently overwrites user fact.
      this.db.saveContradiction({
        id: contraId,
        entityOrConcept: contradictionInfo.entity,
        claimA: ex.fact,
        sourceA: ex.source || 'prior_memory',
        claimB: candidateItem.fact,
        sourceB: candidateItem.source || 'model_inference',
        contradictionType: contradictionInfo.contradictionType,
        projectId: candidateItem.metadata ? candidateItem.metadata.projectId : null
      });

      // Save candidate memory tagged UNCERTAIN / MODEL_INFERRED, NOT current
      const candidateRecord = {
        ...candidateItem,
        isCurrent: false,
        confidenceClass: CONFIDENCE_CLASSES.UNCERTAIN,
        epistemicType: EPISTEMIC_TYPES.HYPOTHESIS,
        metadata: {
          ...(candidateItem.metadata || {}),
          conflictsWithId: ex.id,
          contradictionId: contraId,
          status: 'PENDING_USER_CLARIFICATION'
        }
      };
      const saved = this.db.saveMemory(candidateRecord);

      return {
        action: 'FLAGGED_UNRESOLVED_CONTRADICTION',
        existingConfirmedMemoryId: ex.id,
        candidateMemoryId: candidateRecord.id,
        contradictionId: contraId,
        requiresClarification: true,
        memory: saved
      };
    }
  }

  // =========================================================================
  // 4. HISTORICAL RECONSTRUCTION
  // =========================================================================

  /**
   * Retrieves the fact state of the world at a historical timestamp
   */
  getHistoricalState(timestamp, layer = null) {
    return this.db.getMemoriesAtTimestamp(timestamp, layer);
  }

  /**
   * Returns the complete version lineage and supersession chain for a given memory
   */
  getFactLineage(memoryId) {
    return this.db.getMemoryHistory(memoryId);
  }
}

module.exports = {
  MemoryConsolidationEngine,
  memoryConsolidationEngineInstance: new MemoryConsolidationEngine()
};
