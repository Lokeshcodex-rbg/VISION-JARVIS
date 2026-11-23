/**
 * VISION AI — Advanced Data Science & Statistical Intelligence Engine
 * Phase 12 Section 6: Data Science and Statistical Intelligence
 * 
 * Provides:
 * - Dataset ingestion (CSV, JSON, SQLite)
 * - Descriptive statistics (mean, median, std, variance, IQR, skewness, kurtosis)
 * - Missing-data analysis and imputation
 * - Outlier detection (IQR & Z-score)
 * - Hypothesis testing (Welch's t-test, one-sample t-test, p-values, 95% CI)
 * - Strict preservation of original datasets
 */

const fs = require('fs');
const path = require('path');
const { pythonScienceBridgeClientInstance } = require('./pythonScienceBridgeClient.js');

class DataScienceEngine {
  constructor() {}

  async _runBridge(operation, payload) {
    return await pythonScienceBridgeClientInstance.execute(operation, payload);
  }

  /**
   * Section 6: Computes comprehensive statistical summary
   */
  async computeSummary(data = []) {
    return await this._runBridge('data_science', {
      operation: 'summary',
      data
    });
  }

  /**
   * Section 6: Detects outliers using IQR or Z-score
   */
  async detectOutliers(data = [], method = 'iqr', threshold = 3.0) {
    return await this._runBridge('data_science', {
      operation: 'outlier_detection',
      data,
      method,
      threshold
    });
  }

  /**
   * Section 6: Missing-data inspection across record rows
   */
  async analyzeMissingData(records = []) {
    return await this._runBridge('data_science', {
      operation: 'missing_data_analysis',
      records
    });
  }

  /**
   * Section 6: Hypothesis Testing (Two-sample and One-sample t-test)
   */
  async runHypothesisTest(testType, params = {}) {
    return await this._runBridge('data_science', {
      operation: 'hypothesis_testing',
      test_type: testType,
      ...params
    });
  }

  /**
   * Section 6: Preserves original dataset and writes clean output
   */
  cleanAndTransformDataset(inputPath, outputPath, transformFn) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input dataset does not exist: ${inputPath}`);
    }
    const raw = fs.readFileSync(inputPath, 'utf8');
    const originalData = JSON.parse(raw);
    const transformedData = transformFn(originalData);
    
    os.makedirs ? null : fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(transformedData, null, 2), 'utf8');
    
    return {
      success: true,
      originalPath: inputPath,
      transformedPath: outputPath,
      originalRowCount: Array.isArray(originalData) ? originalData.length : 1,
      transformedRowCount: Array.isArray(transformedData) ? transformedData.length : 1,
      summary: `Cleaned dataset preserved: original at ${inputPath}, transformed output at ${outputPath}.`
    };
  }
}

module.exports = {
  DataScienceEngine,
  dataScienceEngineInstance: new DataScienceEngine()
};
