/**
 * VISION AI — Continuous Improvement Loop Orchestrator (Module 23)
 * 
 * Formalizes and executes the 12-step continuous improvement lifecycle:
 * 1. USER_INPUT
 * 2. LANGUAGE_UNDERSTANDING (NLU)
 * 3. CONTEXT_RETRIEVAL
 * 4. REASONING_AND_PLANNING
 * 5. KNOWLEDGE_RETRIEVAL
 * 6. RESPONSE_OR_TOOL_EXECUTION
 * 7. OUTPUT_EVALUATION
 * 8. USER_FEEDBACK
 * 9. ERROR_AND_PREFERENCE_CLASSIFICATION
 * 10. MEMORY_OR_FEEDBACK_DB_UPDATE
 * 11. OFFLINE_MODEL_EVALUATION
 * 12. CONTROLLED_MODEL_IMPROVEMENT
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data', 'learning');
const LOOP_LOG_FILE = path.join(DATA_DIR, 'continuous_improvement_cycles.json');

const STAGES = {
  1: 'USER_INPUT',
  2: 'LANGUAGE_UNDERSTANDING',
  3: 'CONTEXT_RETRIEVAL',
  4: 'REASONING_AND_PLANNING',
  5: 'KNOWLEDGE_RETRIEVAL',
  6: 'RESPONSE_OR_TOOL_EXECUTION',
  7: 'OUTPUT_EVALUATION',
  8: 'USER_FEEDBACK',
  9: 'ERROR_AND_PREFERENCE_CLASSIFICATION',
  10: 'MEMORY_OR_FEEDBACK_DB_UPDATE',
  11: 'OFFLINE_MODEL_EVALUATION',
  12: 'CONTROLLED_MODEL_IMPROVEMENT'
};

class ContinuousImprovementLoop {
  constructor() {
    this.activeCycles = new Map();
    this.completedCycles = [];
    this._ensureDirectories();
    this._loadCycles();
  }

  _ensureDirectories() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  _loadCycles() {
    try {
      if (fs.existsSync(LOOP_LOG_FILE)) {
        const raw = fs.readFileSync(LOOP_LOG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.completedCycles)) {
          this.completedCycles = parsed.completedCycles.slice(-100);
        }
      }
    } catch (_) {}
  }

  _saveCycles() {
    try {
      fs.writeFileSync(LOOP_LOG_FILE, JSON.stringify({
        updatedAt: new Date().toISOString(),
        totalCycles: this.completedCycles.length,
        completedCycles: this.completedCycles.slice(-100)
      }, null, 2), 'utf8');
    } catch (_) {}
  }

  /**
   * Initializes a tracked 12-stage improvement cycle for an interaction
   */
  startCycle(userInput, metadata = {}) {
    const cycleId = `cic_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const cycleRecord = {
      cycleId,
      startedAt: new Date().toISOString(),
      currentStage: 1,
      stageName: STAGES[1],
      stages: {
        [STAGES[1]]: {
          completedAt: new Date().toISOString(),
          input: userInput,
          metadata
        }
      },
      status: 'IN_PROGRESS'
    };

    this.activeCycles.set(cycleId, cycleRecord);
    return cycleRecord;
  }

  /**
   * Advances the cycle to the specified stage with telemetry data
   */
  recordStage(cycleId, stageNumber, stageData = {}) {
    const cycle = this.activeCycles.get(cycleId);
    if (!cycle) return null;

    const stageName = STAGES[stageNumber];
    if (!stageName) return null;

    cycle.currentStage = stageNumber;
    cycle.stageName = stageName;
    cycle.stages[stageName] = {
      completedAt: new Date().toISOString(),
      ...stageData
    };

    // If reaching the end or terminal stage
    if (stageNumber >= 10) {
      cycle.status = 'COMPLETED';
      cycle.completedAt = new Date().toISOString();
      this.completedCycles.push(cycle);
      this.activeCycles.delete(cycleId);
      this._saveCycles();
    }

    return cycle;
  }

  getCycleStatus(cycleId) {
    return this.activeCycles.get(cycleId) || this.completedCycles.find(c => c.cycleId === cycleId) || null;
  }

  getMetrics() {
    return {
      activeCycles: this.activeCycles.size,
      totalCompletedCycles: this.completedCycles.length,
      recentCycles: this.completedCycles.slice(-5)
    };
  }
}

const continuousImprovementLoopInstance = new ContinuousImprovementLoop();

module.exports = {
  ContinuousImprovementLoop,
  continuousImprovementLoopInstance,
  STAGES
};
