/**
 * STARK AI / J.A.R.V.I.S. — FULL SYSTEM IMPROVEMENT & AUTONOMOUS MISSION VERIFICATION SUITE
 *
 * Tests end-to-end improvements across:
 * 1. Autonomous Multi-Step Mission Execution (AutonomousExecutionEngine):
 *    "Research these companies, compare their products, prepare an Excel report,
 *     create a presentation and save everything in my project folder."
 * 2. Coordinated Multi-Agent Orchestrator Compound Deliverables (.xlsx, .pptx, .docx)
 * 3. Generalized DAG Planning & Execution Engine Compound Deliverables
 * 4. Computer Vision Screenshot & UI Hierarchy Caching (Zero Redundant Captures)
 * 5. Mission Control Unified Live Telemetry Snapshot
 * 6. Security, Permission Gateway & Emergency Stop Invariants
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { autonomousExecutionEngineInstance } = require('./server/autonomousExecutionEngine.js');
const { multiAgentOrchestratorInstance } = require('./server/multiAgentOrchestrator.js');
const { dagPlanningEngineInstance } = require('./server/dagPlanningEngine.js');
const { dagExecutionEngineInstance } = require('./server/dagExecutionEngine.js');
const { excelAdapterInstance } = require('./server/desktop/excelAdapter.js');
const { presentationAdapterInstance } = require('./server/desktop/presentationAdapter.js');
const { documentIntelligenceEngineInstance } = require('./server/documentIntelligenceEngine.js');
const { computerVisionIntelligenceInstance } = require('./server/desktop/computerVisionIntelligence.js');
const { missionControlEngineInstance } = require('./server/missionControlEngine.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { independentVerifierInstance } = require('./server/independentVerifier.js');

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.stack || err.message}`);
    failed++;
  }
}

async function main() {
  console.log('\n================================================================================');
  console.log('STARK AI — FULL SYSTEM IMPROVEMENT & AUTONOMOUS MISSION VERIFICATION SUITE');
  console.log('================================================================================\n');

  emergencyStopControllerInstance.reset('Test suite startup');

  const compoundPrompt =
    'Research these companies, compare their products, prepare an Excel report, create a presentation and save everything in my project folder.';
  const testProjectFolder = path.join(__dirname, 'scratch', 'test_project_deliverables_' + Date.now());

  // ---------------------------------------------------------------------------
  // SUITE 1: AutonomousExecutionEngine End-to-End Compound Mission
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: AutonomousExecutionEngine Multi-Step Mission ---');

  await runTest('1.1 Decomposes compound objective into COMPOUND_RESEARCH_AND_DELIVERY with 7 DAG nodes', async () => {
    const understood = autonomousExecutionEngineInstance.understandObjective(compoundPrompt);
    assert.strictEqual(understood.domain, 'COMPOUND_RESEARCH_AND_DELIVERY');
    assert.strictEqual(understood.primaryArtifact, 'MULTI_FORMAT_PACKAGE');

    const plan = await autonomousExecutionEngineInstance.planObjective(understood, 'JARVIS', {
      projectFolder: testProjectFolder
    });
    assert.strictEqual(plan.nodes.length, 7);
    assert.deepStrictEqual(
      plan.nodes.map(n => n.node_id),
      [
        'N1_RESEARCH_COMPANIES',
        'N2_COMPARE_PRODUCTS',
        'N3_CREATE_EXCEL_REPORT',
        'N4_VERIFY_EXCEL_REPORT',
        'N5_CREATE_PRESENTATION',
        'N6_VERIFY_PRESENTATION',
        'N7_CREATE_EXECUTIVE_SUMMARY_DOCX'
      ]
    );
  });

  await runTest('1.2 Executes full 7-node mission, coordinates specialist agents, and verifies .xlsx, .pptx, and .docx on disk', async () => {
    const outcome = await autonomousExecutionEngineInstance.executeAutonomousObjective(compoundPrompt, {
      personality: 'JARVIS',
      projectFolder: testProjectFolder
    });

    assert.strictEqual(outcome.status, 'COMPLETED', `Expected COMPLETED but got ${outcome.status}`);
    assert.strictEqual(outcome.verified, true, 'Outcome must be independently verified');
    assert.strictEqual(outcome.completedNodes.length, 7, 'All 7 DAG nodes must complete');
    assert.strictEqual(outcome.failedNodes.length, 0, 'Zero nodes should fail');

    // Verify 5 distinct execution records
    assert.ok(outcome.userObjective, 'Must record userObjective');
    assert.strictEqual(outcome.executedActions.length, 7, 'Must record all 7 executedActions');
    assert.strictEqual(outcome.observedResults.length, 7, 'Must record all 7 observedResults');
    assert.strictEqual(outcome.verifiedResults.length, 7, 'Must record all 7 verifiedResults');
    assert.ok(outcome.verifiedResults.every(v => v.verified === true), 'Every node must pass independent verification');

    // Verify physical deliverables in project folder
    const excelPath = path.join(testProjectFolder, 'company_product_comparison_report.xlsx');
    const pptxPath = path.join(testProjectFolder, 'company_product_comparison_deck.pptx');
    const docxPath = path.join(testProjectFolder, 'executive_research_summary.docx');

    assert.ok(fs.existsSync(excelPath), 'Excel report (.xlsx) must exist in project folder');
    assert.ok(fs.existsSync(pptxPath), 'PowerPoint presentation (.pptx) must exist in project folder');
    assert.ok(fs.existsSync(docxPath), 'Executive summary (.docx) must exist in project folder');

    const excelVerif = excelAdapterInstance.verifyWorkbook(excelPath, ['Product Comparison', 'Benchmark Metrics']);
    assert.strictEqual(excelVerif.verified, true, 'Excel workbook OpenXML structure must be valid');

    const pptxVerif = presentationAdapterInstance.verifyPresentation(pptxPath, 3);
    assert.strictEqual(pptxVerif.verified, true, 'PowerPoint presentation OpenXML structure must be valid');
    assert.strictEqual(pptxVerif.slide_count, 3, 'Presentation must contain 3 slides');

    const docxVerif = documentIntelligenceEngineInstance.verifyDocument(docxPath, {
      expectedHeadings: ['1. Executive Summary']
    });
    assert.strictEqual(docxVerif.verified, true, 'Word document OpenXML structure must be valid');
    console.log(`      [Mission completed in ${outcome.durationMs}ms | .xlsx (${excelVerif.size_bytes}B), .pptx (${pptxVerif.size_bytes}B), .docx verified]`);
  });

  // ---------------------------------------------------------------------------
  // SUITE 2: MultiAgentOrchestrator End-to-End Compound Mission
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: MultiAgentOrchestrator Compound Mission ---');

  await runTest('2.1 MultiAgentOrchestrator coordinates 5 specialist agents and produces verified .docx, .xlsx, and .pptx deliverables', async () => {
    const maFolder = path.join(__dirname, 'scratch', 'test_ma_project_' + Date.now());
    const mission = await multiAgentOrchestratorInstance.executeMission(compoundPrompt, {
      projectFolder: maFolder
    });

    assert.strictEqual(mission.status, 'COMPLETED');
    assert.strictEqual(mission.verified, true);
    assert.strictEqual(mission.completedPhasesCount, 4);
    assert.ok(mission.deliverables.length >= 3, `Expected >=3 deliverables (.docx, .xlsx, .pptx), got ${mission.deliverables.length}`);

    for (const d of mission.deliverables) {
      assert.ok(fs.existsSync(d.path), `Deliverable must exist on disk: ${d.path}`);
      assert.ok(fs.statSync(d.path).size > 1000, `Deliverable must be non-empty OpenXML container: ${d.path}`);
    }
  });

  // ---------------------------------------------------------------------------
  // SUITE 3: DagPlanningEngine & DagExecutionEngine Compound Mission
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 3: DagPlanningEngine & DagExecutionEngine Compound Mission ---');

  await runTest('3.1 Generates 15-field DAG plan for compound mission and executes all 7 nodes to COMPLETED', async () => {
    const dagFolder = path.join(__dirname, 'scratch', 'test_dag_project_' + Date.now());
    const plan = await dagPlanningEngineInstance.generatePlan(compoundPrompt, {
      projectFolder: dagFolder
    });

    assert.strictEqual(plan.nodes.length, 7);
    const report = await dagExecutionEngineInstance.executePlan(plan);
    assert.strictEqual(report.status, 'COMPLETED');
    assert.strictEqual(report.verified, true);
    assert.strictEqual(report.completedCount, 7);
  });

  // ---------------------------------------------------------------------------
  // SUITE 4: Computer Vision Screen & UI Hierarchy Caching
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 4: Computer Vision Screen & UI Hierarchy Caching ---');

  await runTest('4.1 Avoids redundant screenshot capture when screen has not changed within TTL', async () => {
    const first = computerVisionIntelligenceInstance.captureDesktopScreenshot({
      windowQuery: 'CacheTestWindow',
      force: true
    });
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.cached, false);

    const t0 = Date.now();
    const second = computerVisionIntelligenceInstance.captureDesktopScreenshot({
      windowQuery: 'CacheTestWindow'
    });
    const elapsed = Date.now() - t0;

    assert.strictEqual(second.success, true);
    assert.strictEqual(second.cached, true, 'Second screenshot within TTL must be served from cache');
    assert.strictEqual(second.sha256, first.sha256, 'Cached screenshot SHA-256 must match');
    assert.ok(elapsed < 50, `Cached screenshot should return in <50ms, took ${elapsed}ms`);
    console.log(`      [Timing: Uncached screenshot=${first.durationMs}ms -> Cached screenshot=${elapsed}ms]`);
  });

  await runTest('4.2 Avoids redundant UIAutomation tree inspection within TTL', async () => {
    const first = computerVisionIntelligenceInstance.inspectUIHierarchy('CacheTestUI', { force: true });
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.cached, false);

    const t0 = Date.now();
    const second = computerVisionIntelligenceInstance.inspectUIHierarchy('CacheTestUI');
    const elapsed = Date.now() - t0;

    assert.strictEqual(second.success, true);
    assert.strictEqual(second.cached, true, 'Second UI hierarchy inspection within TTL must be served from cache');
    assert.ok(elapsed < 25, `Cached UI hierarchy should return in <25ms, took ${elapsed}ms`);
    console.log(`      [Timing: Uncached UI tree=${first.durationMs}ms -> Cached UI tree=${elapsed}ms]`);
  });

  // ---------------------------------------------------------------------------
  // SUITE 5: Mission Control Unified Live Telemetry Snapshot
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 5: Mission Control Live Telemetry Snapshot ---');

  await runTest('5.1 Returns complete live telemetry snapshot (tasks, agents, approvals, E-stop, controls)', async () => {
    const snapshot = missionControlEngineInstance.getLiveTelemetrySnapshot();
    assert.ok(snapshot.timestamp);
    assert.ok(snapshot.emergencyStop);
    assert.strictEqual(snapshot.emergencyStop.emergencyStopActive, false);
    assert.ok(Array.isArray(snapshot.specialistAgents));
    assert.strictEqual(snapshot.specialistAgents.length, 7);
    assert.ok(Array.isArray(snapshot.activeMissions));
    assert.ok(Array.isArray(snapshot.activeDagTasks));
    assert.ok(Array.isArray(snapshot.pendingApprovals));
    assert.ok(snapshot.controlsSupported.includes('EMERGENCY_STOP'));
  });

  // ---------------------------------------------------------------------------
  // SUITE 6: Emergency Stop & Independent Verifier Integrity
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 6: Emergency Stop & Independent Verifier Integrity ---');

  await runTest('6.1 IndependentVerifier rejects non-existent presentation with UNVERIFIED status', async () => {
    const ver = await independentVerifierInstance.verifyExecution({
      verificationMethod: 'PRESENTATION_AST_VERIFIED',
      targetPath: path.join(__dirname, 'scratch', 'non_existent_deck_' + Date.now() + '.pptx')
    });
    assert.strictEqual(ver.verified, false);
    assert.strictEqual(ver.status, 'UNVERIFIED');
  });

  await runTest('6.2 Emergency Stop immediately blocks compound autonomous mission execution', async () => {
    emergencyStopControllerInstance.engage('Full system suite E-Stop check');
    let blocked = false;
    try {
      await autonomousExecutionEngineInstance.executeAutonomousObjective(compoundPrompt);
    } catch (err) {
      blocked = err.message.includes('EMERGENCY_STOP_ACTIVE');
    } finally {
      emergencyStopControllerInstance.reset('Full system suite E-Stop reset');
    }
    assert.strictEqual(blocked, true, 'Emergency Stop must block autonomous mission execution');
  });

  console.log('\n================================================================================');
  console.log(`FINAL SUITE RESULTS: ${passed} / ${passed + failed} PASSED (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
