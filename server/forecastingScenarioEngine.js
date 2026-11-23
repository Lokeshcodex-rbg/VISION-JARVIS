/**
 * VISION AI — Forecasting & Scenario Analysis Engine
 * Module 10: Mathematical projections vs empirical forecasts, multi-scenario evaluation
 * (Nominal, Optimistic, Worst-Case, Stress Test), uncertainty bounds, and risk analysis.
 */

const { scientificComputationEngineInstance } = require('./scientificComputationEngine.js');

class ForecastingScenarioEngine {
  constructor() {
    this.forecastLog = [];
  }

  /**
   * Generates a multi-scenario projection for an engineering, resource, or computational metric
   */
  generateScenarioAnalysis(options = {}) {
    const metricName = options.metricName || 'System Performance Metric';
    const baseValue = Number(options.baseValue || 100);
    const horizonPeriods = Number(options.horizonPeriods || 6); // e.g. 6 months/weeks
    const historicalGrowthRates = options.historicalGrowthRates || [0.05, 0.08, 0.04, 0.07]; // 4%-8% typical growth

    const stats = scientificComputationEngineInstance.computeStatistics(historicalGrowthRates);
    const meanGrowth = stats.mean;
    const stdDevGrowth = stats.stdDev || 0.02;

    // Define 4 Scenarios
    const scenarios = {
      optimistic: {
        name: 'Optimistic Scenario (90th Percentile Growth)',
        growthRatePerPeriod: meanGrowth + 1.28 * stdDevGrowth,
        assumptions: 'Favorable operating conditions, optimal hardware throughput, minimal latency degradation.'
      },
      nominal: {
        name: 'Nominal / Expected Scenario',
        growthRatePerPeriod: meanGrowth,
        assumptions: 'Historical average growth rate maintained with standard operational overhead.'
      },
      conservative: {
        name: 'Conservative / Worst-Case Scenario (10th Percentile)',
        growthRatePerPeriod: Math.max(-0.2, meanGrowth - 1.28 * stdDevGrowth),
        assumptions: 'Adverse network conditions, thermal throttling, resource contention.'
      },
      stressTest: {
        name: 'Severe Stress Test (2x Volatility Shock)',
        growthRatePerPeriod: meanGrowth - 2.5 * stdDevGrowth,
        assumptions: 'Major failure mode: unexpected component stall, 50% power loss, or API outage.'
      }
    };

    const projections = {};
    for (const [key, scen] of Object.entries(scenarios)) {
      const trajectory = [baseValue];
      let current = baseValue;
      for (let t = 1; t <= horizonPeriods; t++) {
        current = current * (1 + scen.growthRatePerPeriod);
        trajectory.push(parseFloat(current.toFixed(2)));
      }

      projections[key] = {
        name: scen.name,
        assumptions: scen.assumptions,
        effectiveGrowthRatePercent: parseFloat((scen.growthRatePerPeriod * 100).toFixed(2)),
        finalValue: trajectory[trajectory.length - 1],
        trajectory
      };
    }

    // Uncertainty and 95% Confidence Interval at final period
    const finalNominal = projections.nominal.finalValue;
    const estimatedStandardError = finalNominal * (stdDevGrowth * Math.sqrt(horizonPeriods));
    const ci95 = [
      parseFloat((finalNominal - 1.96 * estimatedStandardError).toFixed(2)),
      parseFloat((finalNominal + 1.96 * estimatedStandardError).toFixed(2))
    ];

    const result = {
      success: true,
      metricName,
      baseValue,
      horizonPeriods,
      classification: 'MATHEMATICAL_PROJECTION',
      note: 'Distinguished from empirical certainty: Projection is contingent upon stated model growth assumptions.',
      projections,
      confidenceInterval95: ci95,
      uncertaintyRange: `At period ${horizonPeriods}, expected value is ${finalNominal} (95% CI: ${ci95[0]} to ${ci95[1]}).`
    };

    this.forecastLog.push({ timestamp: new Date().toISOString(), result });
    return result;
  }

  /**
   * Evaluates Risk Priority Numbers (RPN = Severity * Occurrence * Detection)
   * for engineering failure mode and effects analysis (FMEA)
   */
  evaluateFMEA(failureModes = []) {
    if (!Array.isArray(failureModes) || failureModes.length === 0) {
      throw new Error('Failure modes array cannot be empty.');
    }

    const analyzed = failureModes.map(fm => {
      const severity = Math.max(1, Math.min(10, parseInt(fm.severity, 10) || 5));
      const occurrence = Math.max(1, Math.min(10, parseInt(fm.occurrence, 10) || 5));
      const detection = Math.max(1, Math.min(10, parseInt(fm.detection, 10) || 5));
      const rpn = severity * occurrence * detection;

      let riskCategory = 'LOW';
      if (rpn >= 200 || severity >= 9) riskCategory = 'CRITICAL / MANDATORY MITIGATION';
      else if (rpn >= 100) riskCategory = 'MEDIUM / ACTIVE MONITORING';

      return {
        failureMode: fm.mode || 'Generic Failure',
        effect: fm.effect || 'Performance degradation',
        severity,
        occurrence,
        detection,
        rpn,
        riskCategory,
        mitigationAction: fm.mitigation || 'Implement software watchdog and hardware safety stop'
      };
    });

    analyzed.sort((a, b) => b.rpn - a.rpn);

    return {
      success: true,
      totalModesAnalyzed: analyzed.length,
      highestRiskMode: analyzed[0],
      failureModes: analyzed
    };
  }
}

const forecastingScenarioEngineInstance = new ForecastingScenarioEngine();

module.exports = {
  ForecastingScenarioEngine,
  forecastingScenarioEngineInstance
};
