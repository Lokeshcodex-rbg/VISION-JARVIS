/**
 * VISION AI — Advanced Machine Learning & Deep Learning Engine
 * Phase 12 Section 7: Machine Learning and Deep Learning
 * 
 * Provides:
 * - Supervised classification and regression workflows
 * - Anti-leakage pipeline (scaler strictly fitted on train split)
 * - Evaluation metrics (accuracy, precision, recall, F1, RMSE, R²)
 * - Multi-algorithm model comparison tables
 * - Reproducibility via explicit random seeds
 * - Strict prohibition of fabricated metrics
 */

const { execFile } = require('child_process');
const path = require('path');
const { pythonScienceBridgeClientInstance } = require('./pythonScienceBridgeClient.js');

class MachineLearningEngine {
  constructor() {}

  async _runBridge(operation, payload) {
    return await pythonScienceBridgeClientInstance.execute(operation, payload);
  }

  /**
   * Section 7: Executes an end-to-end ML classification workflow with anti-leakage guards
   */
  async runClassificationWorkflow(options = {}) {
    return await this._runBridge('ml_workflow', {
      task: 'classification',
      seed: options.seed || 42,
      test_size: options.testSize || 0.25,
      n_samples: options.nSamples || 200,
      ...options
    });
  }

  /**
   * Section 7: Executes an end-to-end ML regression workflow
   */
  async runRegressionWorkflow(options = {}) {
    return await this._runBridge('ml_workflow', {
      task: 'regression',
      seed: options.seed || 42,
      test_size: options.testSize || 0.25,
      n_samples: options.nSamples || 200,
      ...options
    });
  }

  /**
   * Compares multiple models and returns a structured benchmark table
   */
  async compareModels(task = 'classification', options = {}) {
    const res = task === 'classification'
      ? await this.runClassificationWorkflow(options)
      : await this.runRegressionWorkflow(options);

    return {
      success: res.success,
      task,
      bestModel: res.bestModel,
      dataLeakagePrevented: res.dataLeakagePrevented,
      comparisonTable: res.modelComparison,
      summary: res.summary
    };
  }
}

module.exports = {
  MachineLearningEngine,
  machineLearningEngineInstance: new MachineLearningEngine()
};
