/**
 * VISION AI — Advanced Data Engineering Platform
 * Provides schema validation, data cleaning, deduplication, versioned lineage,
 * anomaly detection, and queryable project databases.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_LAKE_DIR = path.resolve(__dirname, '..', 'data', 'data_lake');

class DataEngineeringPlatform {
  constructor() {
    this.datasets = new Map();
    this.lineageGraph = new Map(); // datasetId -> { parentDatasetIds, transformations, generatedAt }
    this._ensureLakeDirectory();
    this._seedInitialDataset();
  }

  _ensureLakeDirectory() {
    if (!fs.existsSync(DATA_LAKE_DIR)) {
      fs.mkdirSync(DATA_LAKE_DIR, { recursive: true });
    }
  }

  _seedInitialDataset() {
    const rawTelemetryRecords = [
      { timestamp: '2026-10-27T08:00:00Z', sensorId: 'temp_01', readingValue: 42.1, unit: 'C', status: 'OK' },
      { timestamp: '2026-10-27T08:01:00Z', sensorId: 'temp_01', readingValue: 42.3, unit: 'C', status: 'OK' },
      { timestamp: '2026-10-27T08:02:00Z', sensorId: 'temp_01', readingValue: 42.2, unit: 'C', status: 'OK' },
      { timestamp: '2026-10-27T08:03:00Z', sensorId: 'temp_01', readingValue: 98.7, unit: 'C', status: 'SPIKE' }, // Anomaly
      { timestamp: '2026-10-27T08:04:00Z', sensorId: 'temp_01', readingValue: 42.5, unit: 'C', status: 'OK' },
      { timestamp: '2026-10-27T08:04:00Z', sensorId: 'temp_01', readingValue: 42.5, unit: 'C', status: 'OK' }  // Duplicate
    ];

    this.createDataset('raw_thermal_telemetry', {
      fields: {
        timestamp: 'string',
        sensorId: 'string',
        readingValue: 'number',
        unit: 'string',
        status: 'string'
      }
    }, rawTelemetryRecords, { source: 'Physical Chamber Thermocouple', retentionDays: 90 });
  }

  getDataset(idOrName) {
    if (!idOrName) return null;
    if (this.datasets.has(idOrName)) return this.datasets.get(idOrName);
    const clean = String(idOrName).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    for (const ds of this.datasets.values()) {
      if (ds.id === idOrName || ds.name === idOrName || ds.id === `ds_${clean}_v1` || ds.id === clean) {
        return ds;
      }
    }
    return null;
  }

  /**
   * Creates and registers a new versioned dataset
   */
  createDataset(name, schema, records = [], metadata = {}) {
    if (!name || !schema) throw new Error('name and schema are required to create dataset');

    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const datasetId = `ds_${cleanName}_v1`;
    const dataString = JSON.stringify(records);
    const checksum = crypto.createHash('sha256').update(dataString).digest('hex');

    const datasetRecord = {
      id: datasetId,
      name,
      version: '1.0.0',
      schema,
      recordCount: records.length,
      records: records.map((r, i) => ({ _id: i + 1, ...r })),
      checksum,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString()
      }
    };

    this.datasets.set(datasetId, datasetRecord);
    this.lineageGraph.set(datasetId, {
      datasetId,
      parents: [],
      transformation: 'RAW_INGESTION',
      createdAt: datasetRecord.metadata.createdAt
    });

    return {
      success: true,
      datasetId,
      checksum,
      recordCount: records.length
    };
  }

  /**
   * Validates schema compliance for input records
   */
  validateSchema(records = [], schema = {}) {
    const fields = schema.fields || {};
    const violations = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      for (const [field, expectedType] of Object.entries(fields)) {
        const val = rec[field];
        if (val === undefined || val === null) {
          violations.push({ recordIndex: i, field, error: 'MISSING_FIELD' });
        } else if (typeof val !== expectedType) {
          violations.push({ recordIndex: i, field, error: `TYPE_MISMATCH: expected ${expectedType}, got ${typeof val}` });
        }
      }
    }

    return {
      totalRecords: records.length,
      violationsCount: violations.length,
      isValid: violations.length === 0,
      violations: violations.slice(0, 20)
    };
  }

  /**
   * Cleans, deduplicates, and normalizes a dataset, producing a versioned child dataset
   */
  cleanAndNormalize(parentDatasetId, cleaningRules = {}) {
    const parent = this.getDataset(parentDatasetId);
    if (!parent) throw new Error(`Dataset ${parentDatasetId} not found`);

    const {
      removeDuplicates = true,
      dropNulls = true,
      valueClamping = {} // fieldName -> { min, max }
    } = cleaningRules;

    const seenHashes = new Set();
    const cleanRecords = [];
    let duplicatesCount = 0;
    let droppedNullsCount = 0;
    let clampedCount = 0;

    for (const rec of parent.records) {
      // 1. Drop nulls
      if (dropNulls) {
        const hasNull = Object.values(rec).some(v => v === null || v === undefined);
        if (hasNull) {
          droppedNullsCount++;
          continue;
        }
      }

      // 2. Value Clamping
      const processedRec = { ...rec };
      delete processedRec._id; // strip temporary id for hashing

      for (const [field, bounds] of Object.entries(valueClamping)) {
        if (typeof processedRec[field] === 'number') {
          if (bounds.min !== undefined && processedRec[field] < bounds.min) {
            processedRec[field] = bounds.min;
            clampedCount++;
          }
          if (bounds.max !== undefined && processedRec[field] > bounds.max) {
            processedRec[field] = bounds.max;
            clampedCount++;
          }
        }
      }

      // 3. Deduplication via record hash
      if (removeDuplicates) {
        const recHash = crypto.createHash('sha256').update(JSON.stringify(processedRec)).digest('hex');
        if (seenHashes.has(recHash)) {
          duplicatesCount++;
          continue;
        }
        seenHashes.add(recHash);
      }

      cleanRecords.push(processedRec);
    }

    // Register cleaned child dataset
    const childId = `ds_${parent.name}_clean_v2`;
    const childDataString = JSON.stringify(cleanRecords);
    const childChecksum = crypto.createHash('sha256').update(childDataString).digest('hex');

    const cleanDataset = {
      id: childId,
      name: `${parent.name} (Cleaned)`,
      version: '2.0.0',
      schema: parent.schema,
      recordCount: cleanRecords.length,
      records: cleanRecords.map((r, i) => ({ _id: i + 1, ...r })),
      checksum: childChecksum,
      metadata: {
        parentDatasetId: parent.id,
        duplicatesRemoved: duplicatesCount,
        droppedNulls: droppedNullsCount,
        clampedFieldsCount: clampedCount,
        createdAt: new Date().toISOString()
      }
    };

    this.datasets.set(childId, cleanDataset);
    this.lineageGraph.set(childId, {
      datasetId: childId,
      parents: [parent.id],
      transformation: 'DEDUPLICATE_CLEAN_CLAMP',
      metrics: { duplicatesCount, droppedNullsCount, clampedCount },
      createdAt: cleanDataset.metadata.createdAt
    });

    return {
      success: true,
      childDatasetId: childId,
      initialRecords: parent.recordCount,
      cleanedRecords: cleanRecords.length,
      duplicatesRemoved: duplicatesCount,
      droppedNulls: droppedNullsCount,
      checksum: childChecksum
    };
  }

  /**
   * Detects statistical anomalies in numerical column using IQR (Interquartile Range)
   */
  detectAnomalies(datasetId, fieldName) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error(`Dataset ${datasetId} not found`);

    const values = ds.records
      .map(r => r[fieldName])
      .filter(v => typeof v === 'number' && !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length < 4) {
      return { datasetId, fieldName, anomalyCount: 0, anomalies: [], note: 'Insufficient samples for statistical IQR' };
    }

    const q1 = values[Math.floor(values.length * 0.25)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const anomalies = [];
    for (const r of ds.records) {
      const val = r[fieldName];
      if (typeof val === 'number' && (val < lowerBound || val > upperBound)) {
        anomalies.push({
          recordId: r._id,
          value: val,
          lowerBound,
          upperBound,
          reason: val > upperBound ? 'UPPER_OUTLIER_SPIKE' : 'LOWER_OUTLIER_DROP'
        });
      }
    }

    return {
      datasetId,
      fieldName,
      sampleSize: values.length,
      q1,
      q3,
      iqr,
      bounds: { lowerBound, upperBound },
      anomalyCount: anomalies.length,
      anomalies
    };
  }

  /**
   * Queries records from a dataset with projection, filtering, and limit
   */
  queryDataset(datasetId, query = {}) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error(`Dataset ${datasetId} not found`);

    const { filter = {}, projection = [], limit = 50 } = query;
    let results = ds.records;

    // Apply exact match filtering
    if (Object.keys(filter).length > 0) {
      results = results.filter(rec => {
        for (const [k, v] of Object.entries(filter)) {
          if (rec[k] !== v) return false;
        }
        return true;
      });
    }

    // Apply projection (select specific fields)
    if (projection.length > 0) {
      results = results.map(rec => {
        const proj = {};
        for (const field of projection) {
          if (rec[field] !== undefined) proj[field] = rec[field];
        }
        return proj;
      });
    }

    return {
      datasetId,
      totalMatched: results.length,
      records: results.slice(0, limit)
    };
  }

  /**
   * Retrieves complete lineage history (DAG) for a dataset
   */
  getDataLineage(datasetId) {
    const lineage = [];
    let currentId = datasetId;

    while (currentId) {
      const node = this.lineageGraph.get(currentId);
      if (!node) break;
      lineage.push(node);
      currentId = node.parents && node.parents.length > 0 ? node.parents[0] : null;
    }

    return {
      targetDatasetId: datasetId,
      depth: lineage.length,
      lineagePath: lineage
    };
  }

  /**
   * Validates cryptographic data integrity against original checksum
   */
  verifyIntegrity(datasetId) {
    const ds = this.getDataset(datasetId);
    if (!ds) throw new Error(`Dataset ${datasetId} not found`);

    const unwrapRecords = ds.records.map(r => {
      const copy = { ...r };
      delete copy._id;
      return copy;
    });

    const currentChecksum = crypto.createHash('sha256').update(JSON.stringify(unwrapRecords)).digest('hex');
    const matches = (currentChecksum === ds.checksum);

    return {
      datasetId,
      originalChecksum: ds.checksum,
      verifiedChecksum: currentChecksum,
      integrityVerified: matches
    };
  }
}

const dataEngineeringPlatformInstance = new DataEngineeringPlatform();

module.exports = {
  DataEngineeringPlatform,
  dataEngineeringPlatformInstance
};
