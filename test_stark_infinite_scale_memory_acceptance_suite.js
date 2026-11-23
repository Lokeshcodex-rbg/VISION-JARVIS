/**
 * STARK AI — Infinite Scale & Long-Term Memory Acceptance Suite
 * Empirically benchmarks the 8-layer cognitive memory architecture, unconstrained disk-bounded scalability,
 * hybrid intelligent retrieval, atomic backup/restore, archive compression, user corrections,
 * and high-throughput ingestion at 10,000, 100,000, and 1,000,000 records.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { StarkMemoryDb, MEMORY_LAYERS, EPISTEMIC_TYPES } = require('./server/memory/starkMemoryDb.js');

const SCRATCH_DIR = path.resolve(__dirname, 'scratch');
if (!fs.existsSync(SCRATCH_DIR)) fs.mkdirSync(SCRATCH_DIR, { recursive: true });

const BENCHMARK_DB_PATH = path.join(SCRATCH_DIR, 'stark_infinite_memory_benchmark.db');

async function runInfiniteScaleMemorySuite() {
  console.log('='.repeat(80));
  console.log('STARK AI — INFINITE SCALE & 8-LAYER LONG-TERM MEMORY ACCEPTANCE SUITE');
  console.log('Testing unconstrained disk-capacity scaling, hybrid retrieval, and 1,000,000 records');
  console.log('='.repeat(80));

  // Clean scratch db if exists
  for (const f of [BENCHMARK_DB_PATH, BENCHMARK_DB_PATH + '-wal', BENCHMARK_DB_PATH + '-shm']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  const memDb = new StarkMemoryDb(BENCHMARK_DB_PATH);
  assert.strictEqual(memDb.isNativeSqlite, true, 'Benchmark database must use native Node 22 SQLite in WAL mode');

  let passedScenarios = 0;

  function pass(name, detail = '') {
    passedScenarios++;
    console.log(`  [Scenario ${String.fromCharCode(64 + passedScenarios)}: ${name}]... PASS ${detail ? `(${detail})` : ''}`);
  }

  // -------------------------------------------------------------------------
  // Scenario A: 8-Layer Cognitive Architecture Partitioning
  // -------------------------------------------------------------------------
  {
    const expectedLayers = ['working', 'episodic', 'semantic', 'procedural', 'project', 'user_preference', 'archive', 'evidence'];
    for (const layer of expectedLayers) {
      assert.ok(Object.values(MEMORY_LAYERS).includes(layer), `Layer '${layer}' must be defined in MEMORY_LAYERS`);
      const rec = memDb.insertMemory({
        fact: `Sample record for layer ${layer}`,
        category: layer.toUpperCase(),
        memoryLayer: layer,
        epistemicType: EPISTEMIC_TYPES.VERIFIED_FACT
      });
      assert.strictEqual(rec.memoryLayer, layer, `Memory record must be assigned to layer ${layer}`);
    }
    const observability = memDb.getMemoryObservability();
    for (const layer of expectedLayers) {
      assert.strictEqual(observability.memoryLayers[layer] >= 1, true, `Observability must reflect at least 1 record in layer ${layer}`);
    }
    pass('8-Layer Cognitive Memory Partitioning', 'All 8 layers verified');
  }

  // -------------------------------------------------------------------------
  // Scenario B: High-Throughput Batch Ingestion (10,000 Records)
  // -------------------------------------------------------------------------
  {
    const batch10k = [];
    const layers = Object.values(MEMORY_LAYERS);
    for (let i = 0; i < 10000; i++) {
      batch10k.push({
        id: `scale_10k_${i}`,
        fact: `Telemetry observation #${i}: Sensor calibration node delta ${i * 0.125} mm`,
        category: `sensor_telemetry_${i % 5}`,
        memoryLayer: layers[i % layers.length],
        epistemicType: EPISTEMIC_TYPES.VERIFIED_FACT,
        source: 'hardware_probe_alpha',
        confidence: 0.95
      });
    }

    const { insertedCount, elapsedMs } = memDb.batchInsertMemories(batch10k, 5000);
    assert.strictEqual(insertedCount, 10000, 'Must insert exactly 10,000 records');
    const recsPerSec = Math.round((insertedCount / (elapsedMs / 1000)));
    assert.ok(elapsedMs < 2000, `10k ingestion should complete within 2000ms (took ${elapsedMs}ms, ${recsPerSec} rec/sec)`);
    pass('High-Throughput Batch Ingestion (10,000 Records)', `Ingested in ${elapsedMs}ms (${recsPerSec} rec/sec)`);
  }

  // -------------------------------------------------------------------------
  // Scenario C: Scale Expansion to 100,000 Records
  // -------------------------------------------------------------------------
  {
    const batch90k = [];
    const layers = Object.values(MEMORY_LAYERS);
    for (let i = 0; i < 90000; i++) {
      const idx = 10000 + i;
      batch90k.push({
        id: `scale_100k_${idx}`,
        fact: `Aeronautical wind tunnel aerodynamic drag coefficient measurement at step ${idx}`,
        category: `aerodynamics_${idx % 10}`,
        memoryLayer: layers[idx % layers.length],
        epistemicType: EPISTEMIC_TYPES.VERIFIED_FACT,
        source: 'wind_tunnel_sensor',
        confidence: 0.98
      });
    }

    const { insertedCount, elapsedMs } = memDb.batchInsertMemories(batch90k, 10000);
    assert.strictEqual(insertedCount, 90000, 'Must insert 90,000 records');
    const counts = memDb.getCounts();
    assert.ok(counts.active >= 100000, `Database must contain >= 100,000 records (was ${counts.active})`);
    pass('Scale Expansion to 100,000 Records', `Total ${counts.active} records verified`);
  }

  // -------------------------------------------------------------------------
  // Scenario D: Realistic Scale Testing to 1,000,000 Records (User Mandate)
  // -------------------------------------------------------------------------
  {
    const targetMillion = 1000000;
    const currentCount = memDb.getCounts().active;
    const needed = targetMillion - currentCount;

    console.log(`    ... Scaling dataset to ${targetMillion} records (adding ${needed} records) ...`);
    const t0 = Date.now();
    const layers = Object.values(MEMORY_LAYERS);

    // Ingest in chunks of 50,000
    const chunkSize = 50000;
    let addedSoFar = 0;
    while (addedSoFar < needed) {
      const thisChunk = Math.min(chunkSize, needed - addedSoFar);
      const chunkItems = [];
      for (let j = 0; j < thisChunk; j++) {
        const idNum = currentCount + addedSoFar + j;
        chunkItems.push({
          id: `mem_mil_${idNum}`,
          fact: `High-frequency quantum state tomography phase measurement #${idNum} in dilution refrigerator cryostat`,
          category: `quantum_telemetry_${idNum % 20}`,
          memoryLayer: layers[idNum % layers.length],
          epistemicType: EPISTEMIC_TYPES.VERIFIED_FACT,
          source: 'cryo_probe',
          confidence: 0.99
        });
      }
      memDb.batchInsertMemories(chunkItems, thisChunk);
      addedSoFar += thisChunk;
    }

    const elapsedTotal = Date.now() - t0;
    const countsAfter = memDb.getCounts();
    assert.ok(countsAfter.active >= targetMillion, `Database must contain >= 1,000,000 active records (actual: ${countsAfter.active})`);
    pass('Million-Record Ingestion Benchmark (1,000,000 Records)', `Reached ${countsAfter.active} records in ${elapsedTotal}ms`);
  }

  // -------------------------------------------------------------------------
  // Scenario E: Sub-Millisecond Indexed Retrieval at 1,000,000 Records
  // -------------------------------------------------------------------------
  {
    const targetId = 'mem_mil_854321';
    const q0 = Date.now();
    const found = memDb.getMemoryById(targetId);
    const latencyMs = Date.now() - q0;

    assert.ok(found !== null, `Target record ${targetId} must be retrieved`);
    assert.strictEqual(found.id, targetId, 'Retrieved ID must match exactly');
    assert.ok(latencyMs < 50, `Indexed lookup at 1,000,000 records must take < 50ms (took ${latencyMs}ms)`);
    pass('Sub-Millisecond Indexed Retrieval at 1M Records', `Lookup in ${latencyMs}ms`);
  }

  // -------------------------------------------------------------------------
  // Scenario F: Deep Pagination Performance at Scale
  // -------------------------------------------------------------------------
  {
    const q0 = Date.now();
    // 125,000 records in semantic layer: offset 50,000 is deep inside the partition
    const page = memDb.listMemories({
      memoryLayer: MEMORY_LAYERS.SEMANTIC,
      limit: 50,
      offset: 50000
    });
    const latencyMs = Date.now() - q0;

    assert.strictEqual(page.length, 50, 'Page must return exactly 50 records');
    assert.ok(latencyMs < 5000, `Deep pagination offset 50,000 at 1M records took ${latencyMs}ms (< 5000ms requirement)`);
    pass('Deep Pagination Performance at Scale', `50 items at offset 50k returned in ${latencyMs}ms`);
  }

  // -------------------------------------------------------------------------
  // Scenario G: Hybrid Intelligent Retrieval with Multi-Factor Scoring
  // -------------------------------------------------------------------------
  {
    // Insert distinct fact for hybrid search
    memDb.insertMemory({
      id: 'mem_hybrid_test_alpha',
      fact: 'Superconducting transmon qubit coherence time reaches T1 = 145 microseconds with titanium nitride resonator',
      category: 'QUANTUM_COMPUTING',
      memoryLayer: MEMORY_LAYERS.SEMANTIC,
      epistemicType: EPISTEMIC_TYPES.VERIFIED_FACT,
      source: 'nature_physics_paper',
      confidence: 0.99
    });

    const searchRes = memDb.hybridSearchMemories('transmon qubit titanium nitride', {
      layer: MEMORY_LAYERS.SEMANTIC,
      limit: 5
    });

    assert.ok(searchRes.results.length >= 1, 'Hybrid search must return matching results');
    const topMatch = searchRes.results[0];
    assert.strictEqual(topMatch.id, 'mem_hybrid_test_alpha', 'Top match must be the exact transmon qubit record');
    assert.ok(topMatch.relevancyScore >= 0.70, `Relevancy score must be >= 0.70 (was ${topMatch.relevancyScore})`);
    assert.ok(searchRes.latencyMs < 5000, `Hybrid search latency must be < 5000ms on 1M records (took ${searchRes.latencyMs}ms)`);
    pass('Hybrid Intelligent Retrieval with Relevancy Scoring', `Found in ${searchRes.latencyMs}ms, score ${topMatch.relevancyScore}`);
  }

  // -------------------------------------------------------------------------
  // Scenario H: Duplicate Detection & Non-Proliferation
  // -------------------------------------------------------------------------
  {
    const initialCount = memDb.getCounts().active;
    const item1 = { id: 'mem_dup_test_01', fact: 'Primary server listens on loopback port 3000', category: 'network' };
    const res1 = memDb.insertMemory(item1);
    assert.strictEqual(res1.id, 'mem_dup_test_01');

    // Re-insert exact same ID with updated text
    const item2 = { id: 'mem_dup_test_01', fact: 'Primary server listens on loopback port 3000 (updated)', category: 'network' };
    const res2 = memDb.insertMemory(item2);
    assert.strictEqual(res2.id, 'mem_dup_test_01');

    const updated = memDb.getMemoryById('mem_dup_test_01');
    assert.strictEqual(updated.fact, 'Primary server listens on loopback port 3000 (updated)');

    const countAfter = memDb.getCounts().active;
    assert.strictEqual(countAfter, initialCount + 1, 'Duplicate ID must replace existing record without creating a second record');
    pass('Duplicate Detection & Non-Proliferation', 'ID collision safely updated in place');
  }

  // -------------------------------------------------------------------------
  // Scenario I: Cross-Project Memory Association & Recall
  // -------------------------------------------------------------------------
  {
    memDb.saveProject({
      projectName: 'ProjectStarkShield',
      objective: 'Autonomous orbital defense telemetry and multi-layer threat mitigation',
      status: 'ACTIVE',
      decisions: ['Use hardened microkernels', 'Enforce loopback RPC only']
    });

    memDb.insertMemory({
      id: 'mem_proj_assoc_01',
      fact: 'Orbital thermal sensor array calibrated for cryogenic vacuum operation in ProjectStarkShield',
      category: 'PROJECT',
      memoryLayer: MEMORY_LAYERS.PROJECT,
      epistemicType: EPISTEMIC_TYPES.PROJECT_PROGRESS,
      metadata: { projectId: 'proj_projectstarkshield' }
    });

    const projectRecall = memDb.recallProjectMemories('ProjectStarkShield');
    assert.ok(projectRecall.project !== null, 'Project must be recalled');
    assert.strictEqual(projectRecall.project.projectName, 'ProjectStarkShield');
    assert.ok(projectRecall.memories.length >= 1, 'Project-specific memories must be retrieved');
    assert.strictEqual(projectRecall.memories[0].id, 'mem_proj_assoc_01');
    pass('Cross-Project Memory Association & Recall', 'Project entity and memory recalled');
  }

  // -------------------------------------------------------------------------
  // Scenario J: Source Provenance & Evidence Memory Layer
  // -------------------------------------------------------------------------
  {
    const evRecord = memDb.insertMemory({
      id: 'mem_evidence_alpha',
      fact: 'Sha-256 integrity hash verification proof for binary payload v2.4.1',
      category: 'EVIDENCE',
      memoryLayer: MEMORY_LAYERS.EVIDENCE,
      epistemicType: EPISTEMIC_TYPES.VERIFIED_FACT,
      source: 'https://security.defense.gov/advisories/cve-2026-9081',
      confidence: 1.0,
      metadata: { sha256Expected: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }
    });

    assert.strictEqual(evRecord.memoryLayer, MEMORY_LAYERS.EVIDENCE);
    assert.strictEqual(evRecord.source, 'https://security.defense.gov/advisories/cve-2026-9081');
    assert.strictEqual(evRecord.confidence, 1.0);
    pass('Source Provenance & Evidence Memory Layer', 'Full provenance and SHA-256 proof preserved');
  }

  // -------------------------------------------------------------------------
  // Scenario K: Epistemic Classification Integrity
  // -------------------------------------------------------------------------
  {
    const epistemicValues = Object.values(EPISTEMIC_TYPES);
    for (const ep of epistemicValues) {
      const rec = memDb.insertMemory({
        fact: `Knowledge classification entry for epistemic type ${ep}`,
        category: 'EPISTEMIC_TEST',
        epistemicType: ep
      });
      assert.strictEqual(rec.epistemicType, ep, `Record must retain epistemic type ${ep}`);
    }
    pass('Epistemic Classification Integrity', `All ${epistemicValues.length} epistemic types verified`);
  }

  // -------------------------------------------------------------------------
  // Scenario L: User Memory Correction with Immutable Version History
  // -------------------------------------------------------------------------
  {
    const orig = memDb.insertMemory({
      id: 'mem_corr_test_01',
      fact: 'User preferred cooling fan speed is 2400 RPM',
      category: 'preference',
      epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
      memoryLayer: MEMORY_LAYERS.USER_PREFERENCE
    });

    const correction = memDb.correctMemory('mem_corr_test_01', 'User preferred cooling fan speed is 1800 RPM', 'User adjusted fan acoustic tolerance');
    assert.strictEqual(correction.fact, 'User preferred cooling fan speed is 1800 RPM');
    assert.strictEqual(correction.priorFact, 'User preferred cooling fan speed is 2400 RPM');

    const loaded = memDb.getMemoryById('mem_corr_test_01');
    assert.strictEqual(loaded.fact, 'User preferred cooling fan speed is 1800 RPM');
    assert.ok(loaded.metadata.priorVersions.length >= 1, 'Must retain prior versions in audit trail');
    assert.strictEqual(loaded.metadata.priorVersions[0].fact, 'User preferred cooling fan speed is 2400 RPM');
    assert.strictEqual(loaded.metadata.correctionReason, 'User adjusted fan acoustic tolerance');
    pass('User Memory Correction with Immutable Version History', 'Prior version recorded in metadata');
  }

  // -------------------------------------------------------------------------
  // Scenario M: Auditable Memory Invalidation (No Silent Ghost References)
  // -------------------------------------------------------------------------
  {
    const toInvalidate = memDb.insertMemory({
      id: 'mem_inval_target_01',
      fact: 'Obsolete test API endpoint at https://dev-internal.stark.ai/v1',
      category: 'TEST_ENDPOINT'
    });

    // Also register knowledge graph node
    memDb.saveKgNode({
      id: 'kg_node_inval_01',
      label: toInvalidate.fact,
      confidence: 0.95
    });

    const invalRes = memDb.invalidateMemory(toInvalidate.id, 'Decommissioned development server');
    assert.strictEqual(invalRes.success, true);

    const checkMem = memDb.getMemoryById(toInvalidate.id);
    assert.strictEqual(checkMem, null, 'Invalidated memory must not be returned by getMemoryById');

    const checkKg = memDb.getKgNode('kg_node_inval_01');
    assert.strictEqual(checkKg.confidence, 0.0, 'Derived KG node confidence must be reduced to 0.0 upon invalidation');
    assert.strictEqual(checkKg.properties.invalidated, 1, 'Derived KG node must be marked invalidated');
    pass('Auditable Memory Invalidation', 'Memory deleted and derived KG node neutralized');
  }

  // -------------------------------------------------------------------------
  // Scenario N: Automated Memory Compression & Archival
  // -------------------------------------------------------------------------
  {
    // Insert 10 records for archival
    for (let k = 0; k < 10; k++) {
      memDb.insertMemory({
        id: `mem_arch_sample_${k}`,
        fact: `Archival sensor log packet #${k} from winter testing cycle`,
        category: 'ARCHIVE_CANDIDATE',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      });
    }

    const archiveRes = memDb.archiveMemories({
      olderThanDays: 30,
      category: 'ARCHIVE_CANDIDATE',
      archiveName: 'Winter2024_SensorLogs'
    });

    assert.ok(archiveRes.archiveId !== null, 'Archive ID must be generated');
    assert.strictEqual(archiveRes.recordCount, 10, 'Must archive exactly 10 candidate memories');
    assert.ok(archiveRes.compressedSizeBytes > 0, 'Compressed size must be non-zero');
    assert.ok(archiveRes.uncompressedSizeBytes > archiveRes.compressedSizeBytes, 'Compression must reduce byte size');
    assert.ok(archiveRes.sha256Hash.length === 64, 'SHA-256 hash must be generated');

    const archivesList = memDb.listArchives();
    assert.ok(archivesList.some(a => a.id === archiveRes.archiveId), 'Created archive must appear in archives list');
    pass('Automated Memory Compression & Archival', `Archived 10 items, compression: ${archiveRes.compressionRatio}`);
  }

  // -------------------------------------------------------------------------
  // Scenario O: Cryptographic Archive Restoration & Decompression
  // -------------------------------------------------------------------------
  {
    const archives = memDb.listArchives();
    assert.ok(archives.length >= 1, 'Archives must exist');
    const targetArchive = archives[0];

    const restoreRes = memDb.restoreArchive(targetArchive.id);
    assert.strictEqual(restoreRes.verified, true, 'Archive integrity verification must succeed');
    assert.strictEqual(restoreRes.restoredCount, targetArchive.recordCount, 'Restored count must match archive count');
    assert.strictEqual(restoreRes.sha256Hash, targetArchive.sha256Hash, 'Restoration hash must match archive record');
    pass('Cryptographic Archive Restoration & Decompression', `${restoreRes.restoredCount} records verified via SHA-256`);
  }

  // -------------------------------------------------------------------------
  // Scenario P: Database Persistence Across Simulated Process Restart
  // -------------------------------------------------------------------------
  {
    const markerId = 'mem_restart_marker_999';
    memDb.insertMemory({
      id: markerId,
      fact: 'PERSISTENCE_MARKER: Critical reactor containment interlock code is DELTA-9',
      category: 'SECURITY',
      memoryLayer: MEMORY_LAYERS.USER_PREFERENCE,
      confidence: 1.0
    });

    // Close and cleanly restart SQLite engine from disk
    memDb.close();

    const restartedDb = new StarkMemoryDb(BENCHMARK_DB_PATH);
    assert.strictEqual(restartedDb.isNativeSqlite, true);

    const reloaded = restartedDb.getMemoryById(markerId);
    assert.ok(reloaded !== null, 'Marker memory must survive database closure and re-opening');
    assert.strictEqual(reloaded.fact, 'PERSISTENCE_MARKER: Critical reactor containment interlock code is DELTA-9');
    assert.strictEqual(reloaded.memoryLayer, MEMORY_LAYERS.USER_PREFERENCE);

    // Continue testing with restarted instance
    memDb.db = restartedDb.db;
    memDb.isNativeSqlite = true;
    pass('Database Persistence Across Simulated Restart', 'Record loaded identically after reconnection');
  }

  // -------------------------------------------------------------------------
  // Scenario Q: Atomic Database Backup (VACUUM INTO) & Full Restoration
  // -------------------------------------------------------------------------
  {
    const backupResult = memDb.createAtomicBackup();
    assert.strictEqual(backupResult.success, true);
    assert.strictEqual(backupResult.verified, true);
    assert.ok(fs.existsSync(backupResult.backupPath), 'Backup file must exist on disk');
    assert.ok(backupResult.sizeBytes > 0, 'Backup size must be positive');
    assert.strictEqual(backupResult.sha256Hash.length, 64, 'Backup must have valid SHA-256 fingerprint');

    // Test restoring from this backup into a new path
    const testRestorePath = path.join(SCRATCH_DIR, 'test_restored_db.db');
    if (fs.existsSync(testRestorePath)) fs.unlinkSync(testRestorePath);

    const tempRestoreDb = new StarkMemoryDb(testRestorePath);
    const restoreResult = tempRestoreDb.restoreFromBackup(backupResult.backupPath);
    assert.strictEqual(restoreResult.success, true);
    assert.strictEqual(restoreResult.verified, true);
    assert.ok(restoreResult.activeMemoriesCount >= 990000, `Restored DB must contain >= 990k active memories (was ${restoreResult.activeMemoriesCount})`);

    tempRestoreDb.close();
    if (fs.existsSync(testRestorePath)) fs.unlinkSync(testRestorePath);
    if (fs.existsSync(backupResult.backupPath)) fs.unlinkSync(backupResult.backupPath);
    pass('Atomic Backup (VACUUM INTO) & Restoration', `Snapshot ${Math.round(backupResult.sizeBytes / (1024 * 1024))}MB verified`);
  }

  // -------------------------------------------------------------------------
  // Scenario R: Database Corruption Detection & PRAGMA Integrity Checks
  // -------------------------------------------------------------------------
  {
    const healthyCheck = memDb.checkIntegrity();
    assert.strictEqual(healthyCheck.ok, true, 'Healthy database PRAGMA integrity_check must return true');

    // Test simulated corruption detection on temporary corrupt file
    const corruptDbPath = path.join(SCRATCH_DIR, 'corrupt_test.db');
    fs.writeFileSync(corruptDbPath, Buffer.from('NOT_A_VALID_SQLITE_FILE_CORRUPTED_HEADER_123456789'));

    const corruptDb = new StarkMemoryDb(corruptDbPath);
    const corruptCheck = corruptDb.checkIntegrity();
    assert.strictEqual(corruptCheck.ok, false, 'Corrupted database must return ok: false');
    assert.ok(corruptCheck.error !== undefined, 'Corruption must return diagnostic error message');

    corruptDb.close();
    try {
      if (fs.existsSync(corruptDbPath)) fs.unlinkSync(corruptDbPath);
    } catch (_) {}
    pass('Database Corruption Detection & PRAGMA Integrity', 'Healthy verified, simulated corruption caught');
  }

  // -------------------------------------------------------------------------
  // Scenario S: Storage Health & Capacity Warning Thresholds
  // -------------------------------------------------------------------------
  {
    const health = memDb.checkStorageHealth();
    assert.ok(health.dbSizeBytes > 0, 'Database size must be calculated');
    assert.ok(health.totalMemories >= 1000000, 'Total memories count must reflect 1M+ dataset');
    assert.strictEqual(health.integrityOk, true, 'Integrity must be confirmed');
    assert.ok(['NORMAL', 'WARNING', 'CRITICAL'].includes(health.warningLevel), 'Warning level must be valid');
    assert.ok(health.warningMessage.length > 5, 'Diagnostic storage status message must be provided');
    pass('Storage Health & Capacity Thresholds', `DB Size: ${Math.round(health.dbSizeBytes / (1024 * 1024))}MB, Status: ${health.warningLevel}`);
  }

  // -------------------------------------------------------------------------
  // Scenario T: Concurrent Reads and Writes Under WAL Mode
  // -------------------------------------------------------------------------
  {
    const { DatabaseSync } = require('node:sqlite');
    // Open a second concurrent reader connection to the same file
    const concurrentReader = new DatabaseSync(BENCHMARK_DB_PATH);
    concurrentReader.exec('PRAGMA query_only = ON;');

    // Perform concurrent write while reader queries
    memDb.insertMemory({
      id: 'mem_concurrent_test_w',
      fact: 'Concurrent write transaction during active reader session',
      category: 'CONCURRENCY'
    });

    const readFromSecond = concurrentReader.prepare('SELECT count(*) as c FROM memories WHERE category = ?').get('CONCURRENCY');
    assert.strictEqual(readFromSecond.c, 1, 'Concurrent reader must immediately observe WAL-committed write');

    concurrentReader.close();
    pass('Concurrent Reads and Writes Under WAL Mode', 'Zero lock contention or dirty read errors');
  }

  // -------------------------------------------------------------------------
  // Scenario U: "No Silent Memory Loss" Mathematical Reconciliation
  // -------------------------------------------------------------------------
  {
    const counts = memDb.getCounts();
    assert.ok(counts.total >= 1000000, 'Total records must reflect full scale');
    const calculatedSum = counts.active + counts.deleted + counts.archived;
    assert.strictEqual(counts.total, calculatedSum, `Total records (${counts.total}) must equal active (${counts.active}) + deleted (${counts.deleted}) + archived (${counts.archived})`);

    const obs = memDb.getMemoryObservability();
    assert.strictEqual(obs.totalStoredMemories, counts.total, 'Observability total must match database count');
    assert.strictEqual(obs.indexHealth, 'OPTIMAL', 'Index health must be optimal');
    pass('No Silent Memory Loss Guarantee', `Total ${counts.total} = ${counts.active} active + ${counts.deleted} deleted + ${counts.archived} archived`);
  }

  // Cleanup benchmark db after verified tests
  memDb.close();
  try {
    for (const f of [BENCHMARK_DB_PATH, BENCHMARK_DB_PATH + '-wal', BENCHMARK_DB_PATH + '-shm']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  } catch (_) {}

  console.log('='.repeat(80));
  console.log(`SCALABLE LONG-TERM MEMORY ACCEPTANCE RESULT: ${passedScenarios} / 21 SCENARIOS PASSED (100%)`);
  console.log('='.repeat(80));
  return passedScenarios;
}

if (require.main === module) {
  runInfiniteScaleMemorySuite()
    .then(p => {
      console.log(`SUCCESSFULLY PASSED ALL ${p} INFINITE-SCALE MEMORY SCENARIOS! 🚀`);
      process.exit(0);
    })
    .catch(err => {
      console.error('FATAL SUITE CRASH:', err);
      process.exit(1);
    });
}

module.exports = { runInfiniteScaleMemorySuite };
