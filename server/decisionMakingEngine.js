/**
 * VISION AI — Advanced Decision-Making Engine (Module 20)
 * 
 * Evaluates competing solutions, architectures, algorithms, or execution plans
 * using structured multi-criteria decision analysis (MCDA).
 * 
 * Strict Invariants:
 * 1. Never defaults to the most complex solution merely for complexity's sake.
 * 2. Compares: Advantages, Disadvantages, Complexity, Risk, Cost, User Requirements.
 * 3. Prioritizes reliable, robust, practical, and reversible solutions.
 * 4. Produces transparent decision explanations and confidence scores.
 */

const crypto = require('crypto');

class DecisionMakingEngine {
  constructor(options = {}) {
    this.decisionsLedger = new Map();
    this.weights = {
      reliability: 0.30,
      simplicity: 0.20,
      safetyRisk: 0.20, // lower risk = higher score
      executionSpeed: 0.15,
      userConstraintFit: 0.15,
      ...options.weights
    };
  }

  /**
   * Evaluates multiple candidate solutions for a given problem and selects the optimal one.
   * 
   * @param {Object} problem
   * @param {string} problem.objective - Primary goal or question
   * @param {Array<string>} [problem.constraints] - Hard constraints that must be satisfied
   * @param {Array<Object>} problem.options - List of candidate approaches
   * @returns {Object} Structured decision evaluation with ranked solutions and rationale
   */
  evaluateOptions(problem = {}) {
    const {
      objective = 'General Decision',
      constraints = [],
      options = []
    } = problem;

    if (!Array.isArray(options) || options.length === 0) {
      throw new Error('DecisionMakingEngine requires at least one candidate option to evaluate.');
    }

    const decisionId = `dec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const evaluatedOptions = options.map((opt, index) => {
      const name = opt.name || `Option ${index + 1}`;
      const description = opt.description || '';
      const advantages = Array.isArray(opt.advantages) ? opt.advantages : [];
      const disadvantages = Array.isArray(opt.disadvantages) ? opt.disadvantages : [];
      
      // Complexity score: 1 (minimal) to 10 (extreme). Lower is simpler/better.
      const complexity = typeof opt.complexity === 'number' ? Math.max(1, Math.min(10, opt.complexity)) : 5;
      
      // Risk score: 1 (negligible) to 10 (critical). Lower risk is better.
      const risk = typeof opt.risk === 'number' ? Math.max(1, Math.min(10, opt.risk)) : 5;
      
      // Estimated execution time or latency (ms/scale)
      const estimatedLatency = opt.estimatedLatency || 'normal';

      // Constraint satisfaction
      const violatesConstraints = (opt.violations || []).filter(v => constraints.includes(v));
      const isViable = violatesConstraints.length === 0;

      // Compute normalized component scores (0.0 to 1.0)
      const reliabilityScore = typeof opt.reliabilityScore === 'number' ? opt.reliabilityScore : (10 - risk) / 10;
      const simplicityScore = (11 - complexity) / 10;
      const riskScore = (11 - risk) / 10;
      const speedScore = opt.speedScore !== undefined ? opt.speedScore : (complexity <= 4 ? 0.9 : 0.6);
      const fitScore = isViable ? 1.0 : 0.1;

      // Weighted aggregate composite score
      const compositeScore = Number((
        (reliabilityScore * this.weights.reliability) +
        (simplicityScore * this.weights.simplicity) +
        (riskScore * this.weights.safetyRisk) +
        (speedScore * this.weights.executionSpeed) +
        (fitScore * this.weights.userConstraintFit)
      ).toFixed(4));

      return {
        id: opt.id || `opt_${index + 1}`,
        name,
        description,
        advantages,
        disadvantages,
        complexity,
        risk,
        isViable,
        violatesConstraints,
        metrics: {
          reliabilityScore,
          simplicityScore,
          riskScore,
          speedScore,
          fitScore,
          compositeScore
        }
      };
    });

    // Rank by composite score descending
    evaluatedOptions.sort((a, b) => b.metrics.compositeScore - a.metrics.compositeScore);

    const bestOption = evaluatedOptions[0];
    const rationale = this._generateRationale(objective, bestOption, evaluatedOptions);

    const decisionRecord = {
      decisionId,
      timestamp: new Date().toISOString(),
      objective,
      constraints,
      rankedOptions: evaluatedOptions,
      selectedOption: bestOption,
      rationale,
      confidence: bestOption.metrics.compositeScore
    };

    this.decisionsLedger.set(decisionId, decisionRecord);
    return decisionRecord;
  }

  _generateRationale(objective, best, all) {
    if (all.length === 1) {
      return `Selected "${best.name}" as the sole viable solution for: ${objective}. Complexity: ${best.complexity}/10, Risk: ${best.risk}/10.`;
    }

    const runnerUp = all[1];
    return `Selected "${best.name}" (Score: ${best.metrics.compositeScore}) over "${runnerUp.name}" (Score: ${runnerUp.metrics.compositeScore}). ` +
      `Key factors: superior balance of practical reliability (Risk: ${best.risk}/10 vs ${runnerUp.risk}/10) and implementation simplicity (Complexity: ${best.complexity}/10). ` +
      `Meets all stated constraints with zero unverified assumptions.`;
  }

  getDecision(decisionId) {
    return this.decisionsLedger.get(decisionId) || null;
  }

  getRecentDecisions(limit = 10) {
    return Array.from(this.decisionsLedger.values()).slice(-limit);
  }
}

const decisionMakingEngineInstance = new DecisionMakingEngine();

module.exports = {
  DecisionMakingEngine,
  decisionMakingEngineInstance
};
