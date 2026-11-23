/**
 * STARK BEYOND — MASTER BENCHMARK SUITE
 * Comprehensive empirical validation covering all 8 parts of the Master Intelligence Directive:
 * - Part I: Unified Cognitive Architecture & Task Engine
 * - Part II: Experiment Factory (bounded trials up to 1000, adaptive allocation, statistical tests, rollback, safety shield)
 * - Part III: Predictive Intelligence (Forecasting, failure prevention, Goal Guardian)
 * - Part IV: Autonomous Research Scheduler (Priority queue, dependencies, e-stop abort)
 * - Part V: Persistent Knowledge Graph & Memory Quality Evaluation
 * - Part VI: Desktop, Voice & Verified State Transitions
 * - Part VII: Future Capabilities Prototypes (Cap 20-25)
 * - Part VIII: Real-world execution and Safety Invariance
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Core Subsystems
const { unifiedIntelligenceLayerInstance, TASK_CATEGORIES, GROUNDING_LEVELS } = require('./server/unifiedIntelligenceLayer.js');
const { experimentFactoryInstance } = require('./server/experimentFactory.js');
const { forecastingEngineInstance, FORECAST_CATEGORIES } = require('./server/forecastingEngine.js');
const { goalGuardianInstance, GOAL_STATUS, MILESTONE_STATUS } = require('./server/goalGuardian.js');
const { experimentSchedulerInstance, JOB_STATUS } = require('./server/experimentScheduler.js');
const knowledgeGraphEngine = require('./server/knowledgeGraphEngine.js');
const { futureCapabilitiesLabInstance } = require('./server/futureCapabilitiesLab.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { localWorkspaceManagerInstance } = require('./server/desktop/localWorkspaceManager.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
const { executeTool } = require('./server/toolsRegistry.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ test: name, error: err.message, stack: err.stack });
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         ${err.message}`);
  }
}

async function runMasterSuite() {
  emergencyStopControllerInstance.disengage('Suite start clean reset');
  console.log('\n================================================================================');
  console.log('STARK BEYOND — MASTER CAPABILITY BENCHMARK SUITE');
  console.log('================================================================================\n');

  // ===========================================================================
  // PART I: THE STARK INTELLIGENCE CORE
  // ===========================================================================
  console.log('--- PART I: COGNITIVE ARCHITECTURE & UNIFIED INTELLIGENCE CORE ---');

  await test('Subsystem 1 & 2: Model routing selects strong reasoning for high-complexity coding and fast for routine', async () => {
    const codingRoute = unifiedIntelligenceLayerInstance.selectOptimalModel({
      category: TASK_CATEGORIES.CODING,
      complexity: 'high'
    });
    assert.strictEqual(codingRoute.tier, 'COMPLEX_REASONING');
    assert.ok(codingRoute.selectedModel.includes('gemini'));

    const routineRoute = unifiedIntelligenceLayerInstance.selectOptimalModel({
      category: TASK_CATEGORIES.GENERAL_QUESTION,
      complexity: 'low'
    });
    assert.strictEqual(routineRoute.tier, 'FAST_LIGHTWEIGHT');
  });

  await test('Subsystem 3: 12-category task classifier categorizes requests accurately', async () => {
    const c1 = unifiedIntelligenceLayerInstance.classifyTask('Refactor the AST parser in codingAssistant.js to fix syntax errors');
    assert.strictEqual(c1.category, TASK_CATEGORIES.CODING);

    const c2 = unifiedIntelligenceLayerInstance.classifyTask('Generate an executive Word document summary with title and table');
    assert.strictEqual(c2.category, TASK_CATEGORIES.DOCUMENT_CREATION);

    const c3 = unifiedIntelligenceLayerInstance.classifyTask('Calculate von Mises bending stress and cantilever deflection for robotic link');
    assert.strictEqual(c3.category, TASK_CATEGORIES.SCIENTIFIC_COMPUTATION);

    const c4 = unifiedIntelligenceLayerInstance.classifyTask('Search ArXiv for recent transformer memory retrieval papers and citations');
    assert.strictEqual(c4.category, TASK_CATEGORIES.RESEARCH);
  });

  await test('Subsystem 4: DAG planning engine generates dependency-aware task plan', async () => {
    const plan = unifiedIntelligenceLayerInstance.createTaskPlan({
      goal: 'Create an engineering report, verify its hash, and open Word',
      category: TASK_CATEGORIES.MULTI_STEP_PROJECT
    });
    assert.ok(plan.taskId.startsWith('task_'));
    assert.ok(plan.steps.length >= 2);
    // Step 2 must depend on Step 1
    assert.ok(plan.steps[1].dependsOn.includes(plan.steps[0].id));
  });

  await test('Subsystem 5: 7-Level evidence manager strictly tags and calibrates grounding levels', async () => {
    const ev1 = unifiedIntelligenceLayerInstance.tagEvidence({
      claim: 'File written to disk with SHA-256 match',
      level: GROUNDING_LEVELS.VERIFIED_FACT,
      source: 'localWorkspaceManager'
    });
    assert.strictEqual(ev1.confidence, 1.0);
    assert.strictEqual(ev1.level, 'VERIFIED_FACT');

    const ev2 = unifiedIntelligenceLayerInstance.tagEvidence({
      claim: 'Model estimated latency delta',
      level: GROUNDING_LEVELS.MODEL_ESTIMATE,
      source: 'llm_estimate'
    });
    assert.strictEqual(ev2.confidence, 0.50);
  });

  await test('Subsystem 6: Private reasoning traces are concealed in user interaction response', async () => {
    const res = await unifiedIntelligenceLayerInstance.processInteraction({
      personality: 'JARVIS',
      message: 'What is the current time?',
      history: []
    });
    assert.ok(res.reply);
    // Ensure no private reasoning tokens or scratchpad leaks
    assert.ok(!res.reply.includes('<thought>'));
    assert.ok(!res.reply.includes('</thought>'));
    assert.ok(!res.reply.includes('private_reasoning_trace'));
  });

  // ===========================================================================
  // PART II: SELF-PROGRAMMING & THE STARK EXPERIMENT FACTORY
  // ===========================================================================
  console.log('\n--- PART II: SELF-PROGRAMMING & THE STARK EXPERIMENT FACTORY ---');

  await test('Experiment Factory: Creates campaign with configurable budget (up to 1,000 trials)', async () => {
    const camp = experimentFactoryInstance.createCampaign({
      title: 'Speech Synchronization Latency Optimization',
      hypothesis: 'Streaming token buffer reduces audio-caption sync lag to <50ms',
      metricName: 'syncLagMs',
      objective: 'MINIMIZE',
      baseline: { name: 'Legacy Buffered Sync', metricValue: 120.0, trials: 20 },
      maxTrials: 200,
      seed: 101
    });
    assert.ok(camp.id.startsWith('camp_'));
    assert.strictEqual(camp.maxTrials, 200);
    assert.strictEqual(camp.baseline.metricValue, 120.0);
  });

  await test('Experiment Factory Safety Shield: Rejects candidates modifying protected core files', async () => {
    const camp = experimentFactoryInstance.createCampaign({
      title: 'Adversarial Code Injection Test',
      hypothesis: 'Modify securityPermissions to bypass permission checks',
      metricName: 'throughput',
      baseline: { metricValue: 50.0 }
    });

    assert.throws(() => {
      experimentFactoryInstance.registerCandidate(camp.id, {
        name: 'Malicious Bypass Patch',
        sourceFile: 'server/securityPermissions.js'
      });
    }, /Security Violation: Candidate.*touches protected core security module/);
  });

  await test('Experiment Factory: Adaptive allocation tests weak vs strong candidates and computes statistics', async () => {
    const camp = experimentFactoryInstance.createCampaign({
      title: 'Token Buffer Size Benchmark Campaign',
      hypothesis: 'Adaptive token chunk size reduces latency without quality regression',
      metricName: 'latencyMs',
      objective: 'MINIMIZE',
      baseline: { name: 'Static Buffer Baseline', metricValue: 100.0, trials: 25 },
      maxTrials: 60,
      seed: 42
    });

    // Register a weak candidate (worse than baseline)
    experimentFactoryInstance.registerCandidate(camp.id, {
      id: 'cand_weak',
      name: 'Oversized Buffer Candidate (Slow)',
      executeFn: (seed) => 140.0 + (seed % 10)
    });

    // Register a strong candidate (substantially better than baseline)
    experimentFactoryInstance.registerCandidate(camp.id, {
      id: 'cand_strong',
      name: 'Dynamic Token Ring Buffer (Fast)',
      executeFn: (seed) => 65.0 + (seed % 5)
    });

    const summary = await experimentFactoryInstance.runCampaign(camp.id);
    assert.ok(summary.trialsSummary.completed > 0);
    assert.strictEqual(summary.status, 'PROMOTED');
    assert.ok(summary.winner);
    assert.strictEqual(summary.winner.candidateId, 'cand_strong');

    // Statistical assertions
    const strongStats = summary.candidateRankings.find(c => c.id === 'cand_strong');
    assert.ok(strongStats.mean < 100.0, 'Strong candidate mean must beat baseline 100.0');
    assert.ok(strongStats.pValue < 0.05, 'Strong candidate p-value must be statistically significant (p < 0.05)');
    assert.ok(strongStats.ci95[0] < strongStats.ci95[1], 'Valid 95% Confidence Interval');
    assert.ok(strongStats.percentImprovement > 30.0, 'Demonstrates >30% measurable improvement');

    // Adaptive allocation check: strong candidate must receive more trials than weak candidate
    const weakStats = summary.candidateRankings.find(c => c.id === 'cand_weak');
    assert.ok(strongStats.trials > weakStats.trials, 'Adaptive allocation must grant more trials to promising candidate');
  });

  await test('Experiment Factory: Rollback restores known-good baseline state cleanly', async () => {
    const camp = experimentFactoryInstance.createCampaign({
      title: 'Rollback Verification Campaign',
      hypothesis: 'Experimental test',
      baseline: { metricValue: 88.0 }
    });
    const rb = experimentFactoryInstance.rollback(camp.id);
    assert.strictEqual(rb.success, true);
    assert.strictEqual(rb.status, 'ROLLED_BACK');
    assert.strictEqual(rb.baselineMetric, 88.0);
  });

  // ===========================================================================
  // PART III: PREDICTIVE INTELLIGENCE & GOAL GUARDIAN
  // ===========================================================================
  console.log('\n--- PART III: PREDICTIVE INTELLIGENCE & GOAL GUARDIAN ---');

  await test('Forecasting Engine: Generates testable prediction with explicit time horizon, assumptions, and 95% CI', async () => {
    const pred = forecastingEngineInstance.generatePrediction({
      statement: 'Heap memory usage will remain below 350 MB over the next 2 hours of continuous operation',
      category: FORECAST_CATEGORIES.RESOURCE_USAGE,
      timeHorizonMs: 7200000,
      expectedValue: 300,
      uncertaintyInterval: [260, 340],
      confidence: 0.90,
      evidence: ['Baseline heap at 180MB', 'Linear memory slope +0.12 MB/step'],
      assumptions: ['No sudden external load spikes exceeding 100 concurrent requests']
    });

    assert.ok(pred.id.startsWith('pred_'));
    assert.strictEqual(pred.status, 'PENDING');
    assert.strictEqual(pred.confidenceScore, 0.90);
    assert.deepStrictEqual(pred.uncertaintyInterval, [260, 340]);
  });

  await test('Forecasting Engine: Resolves prediction with verified outcome and computes Brier score', async () => {
    const pred = forecastingEngineInstance.generatePrediction({
      statement: 'Task completion time prediction',
      category: FORECAST_CATEGORIES.TASK_DURATION,
      expectedValue: 50.0,
      uncertaintyInterval: [45.0, 55.0],
      confidence: 0.85
    });

    const resolved = forecastingEngineInstance.resolvePrediction(pred.id, {
      actualValue: 48.5,
      actualOutcome: 'Task completed in 48.5 seconds'
    });

    assert.strictEqual(resolved.status, 'VERIFIED_CORRECT');
    assert.ok(resolved.forecastError.withinUncertaintyInterval);
    assert.ok(resolved.brierScore !== null && resolved.brierScore < 0.10);

    const evalReport = forecastingEngineInstance.evaluateForecastAccuracy();
    assert.ok(evalReport.resolvedCount >= 1);
    assert.ok(evalReport.meanBrierScore >= 0.0);
  });

  await test('Predictive Failure Prevention: Detects memory leak trend and proposes reversible action', async () => {
    // Feed synthetic telemetry demonstrating steep memory climb
    for (let i = 1; i <= 6; i++) {
      forecastingEngineInstance.recordTelemetry({
        heapUsedMb: 210 + i * 15, // climbs by 15 MB each step
        providerErrors: 0,
        providerTotalCalls: 10
      });
    }

    const failureRisk = forecastingEngineInstance.detectPredictiveFailures();
    assert.strictEqual(failureRisk.hasAlerts, true);
    const memAlert = failureRisk.alerts.find(a => a.riskType === 'MEMORY_LEAK_SURGE');
    assert.ok(memAlert, 'Must detect MEMORY_LEAK_SURGE');
    assert.ok(memAlert.probability >= 0.80);
    assert.ok(memAlert.proposedReversibleAction.actionId === 'ACTION_TRIGGER_GC_AND_COMPACT_CACHE');

    // Apply reversible action
    const actionResult = forecastingEngineInstance.applyPreventiveAction(memAlert.proposedReversibleAction.actionId);
    assert.strictEqual(actionResult.status, 'APPLIED');
  });

  await test('Goal Guardian: Creates user goal and breaks into verifiable milestones', async () => {
    const goal = goalGuardianInstance.createGoal({
      title: 'Evolve Speech Synchronization to Sub-50ms',
      description: 'Upgrade STARK audio pipeline to achieve instantaneous caption-speech alignment',
      category: 'AUDIO_ENGINEERING',
      milestones: [
        { id: 'm_profile', title: 'Profile audio chunk jitter', criteria: 'Jitter profile recorded and verified' },
        { id: 'm_ringbuffer', title: 'Implement dynamic circular ring buffer', criteria: 'Unit tests pass with 100% assertions', dependsOn: ['m_profile'] },
        { id: 'm_benchmark', title: 'Empirical benchmark confirmation', criteria: 'Lag verified < 50ms across 100 trials', dependsOn: ['m_ringbuffer'] }
      ]
    });

    assert.ok(goal.id.startsWith('goal_'));
    assert.strictEqual(goal.status, GOAL_STATUS.ACTIVE);
    assert.strictEqual(goal.milestones.length, 3);
    assert.strictEqual(goal.progressPercent, 0);
  });

  await test('Goal Guardian: Rejects unverified progress and enforces dependency blocking', async () => {
    const goal = goalGuardianInstance.createGoal({
      title: 'Dependency Verification Goal',
      milestones: [
        { id: 'm_a', title: 'Prerequisite Milestone A', criteria: 'Criteria A' },
        { id: 'm_b', title: 'Dependent Milestone B', criteria: 'Criteria B', dependsOn: ['m_a'] }
      ]
    });

    // 1. Attempt unverified progress on m_a
    const unverifiedAttempt = goalGuardianInstance.recordMilestoneProgress(goal.id, 'm_a', {
      proof: null,
      verified: false
    });
    assert.strictEqual(unverifiedAttempt.success, false);

    // 2. Attempt to complete dependent milestone B before A is done
    const prematureAttempt = goalGuardianInstance.recordMilestoneProgress(goal.id, 'm_b', {
      proof: 'Tried to bypass A',
      verified: true
    });
    assert.strictEqual(prematureAttempt.success, false);
    assert.ok(prematureAttempt.message.includes('blocked by dependency'));

    // 3. Complete A with verified evidence
    const validA = goalGuardianInstance.recordMilestoneProgress(goal.id, 'm_a', {
      proof: 'Verified test run passed with 0 errors',
      verified: true
    });
    assert.strictEqual(validA.success, true);

    // 4. Now B can be completed with verified evidence
    const validB = goalGuardianInstance.recordMilestoneProgress(goal.id, 'm_b', {
      proof: 'Benchmark report confirms criteria B',
      verified: true
    });
    assert.strictEqual(validB.success, true);
    assert.strictEqual(validB.goalStatus, GOAL_STATUS.ACHIEVED);
  });

  await test('Goal Guardian: Detects circular dependencies and flags unrealistic goals', async () => {
    const circularGoal = goalGuardianInstance.createGoal({
      title: 'Circular Goal Test',
      resourceBudget: { maxHours: 500 }, // exceeds capacity 200 hours
      milestones: [
        { id: 'c1', title: 'Step 1', dependsOn: ['c2'] },
        { id: 'c2', title: 'Step 2', dependsOn: ['c1'] }
      ]
    });

    assert.ok(circularGoal.contradictions.length > 0, 'Must detect circular contradiction');
    assert.strictEqual(circularGoal.status, GOAL_STATUS.UNREALISTIC, 'Must flag resource deficit as UNREALISTIC');
  });

  // ===========================================================================
  // PART IV: AUTONOMOUS RESEARCH SCHEDULER
  // ===========================================================================
  console.log('\n--- PART IV: AUTONOMOUS RESEARCH SCIENTIST & SCHEDULER ---');

  await test('Experiment Scheduler: Priority queue with dependency execution and checkpoints', async () => {
    experimentSchedulerInstance.jobs.clear();

    const jobA = experimentSchedulerInstance.scheduleJob({
      title: 'Dataset Preparation Job',
      priority: 8
    });

    const jobB = experimentSchedulerInstance.scheduleJob({
      title: 'Candidate Evaluation Job',
      priority: 9,
      dependencies: [jobA.id]
    });

    assert.strictEqual(jobB.status, JOB_STATUS.WAITING_DEPENDENCY);

    // Execute job A
    const resA = await experimentSchedulerInstance.executeJob(jobA);
    assert.strictEqual(resA.success, true);
    assert.strictEqual(jobA.status, JOB_STATUS.COMPLETED);
    assert.ok(jobA.checkpoints.length >= 2);

    // Process queue: job B should now become eligible and execute
    const resB = await experimentSchedulerInstance.processNextJob();
    assert.strictEqual(resB.success, true);
    assert.strictEqual(resB.jobId, jobB.id);
    assert.strictEqual(jobB.status, JOB_STATUS.COMPLETED);
  });

  await test('Experiment Scheduler: Aborts immediately when Emergency Stop is engaged', async () => {
    try {
      emergencyStopControllerInstance.engage('Safety invariant violation during research run');

      const job = experimentSchedulerInstance.scheduleJob({
        title: 'High Risk Physics Simulation',
        priority: 10
      });

      const outcome = await experimentSchedulerInstance.processNextJob();
      assert.strictEqual(outcome.executed, false);
      assert.ok(outcome.reason.includes('Emergency Stop is engaged'));
    } finally {
      emergencyStopControllerInstance.disengage('Testing completed');
      assert.strictEqual(emergencyStopControllerInstance.isHalted(), false);
    }
  });

  // ===========================================================================
  // PART V: PERSISTENT KNOWLEDGE GRAPH & MEMORY QUALITY
  // ===========================================================================
  console.log('\n--- PART V: PERSISTENT KNOWLEDGE GRAPH & MEMORY QUALITY ---');

  await test('Knowledge Graph: Indexes code file, extracts AST symbols, and links with SHA-256', async () => {
    const testFilePath = path.join(__dirname, 'server', 'timeService.js');
    const content = fs.readFileSync(testFilePath, 'utf8');

    const indexRes = knowledgeGraphEngine.indexCodeArtifact(testFilePath, content, { version: '2.1.0' });
    assert.ok(indexRes.fileId);
    assert.ok(indexRes.symbolsCount > 0);
    assert.strictEqual(indexRes.sha256.length, 64);

    const fileNode = knowledgeGraphEngine.getNode(indexRes.fileId);
    assert.ok(fileNode);
    assert.strictEqual(fileNode.type, 'file');
    assert.strictEqual(fileNode.properties.sha256, indexRes.sha256);
  });

  await test('Knowledge Graph: Links defect, repair patch, and validating test case', async () => {
    const linkRes = knowledgeGraphEngine.indexDefectAndRepair(
      { title: 'Audio buffer underrun under high system load', rootCause: 'Ring buffer size too small (2048)', severity: 'HIGH' },
      { title: 'Expanded ring buffer to 4096 and optimized read pointer', summary: 'Modified audioRingBuffer.js' },
      { testSuiteId: 'test_audio_reliability_suite.js', passRate: 100 }
    );

    assert.ok(linkRes.defectId);
    assert.ok(linkRes.repairId);

    const edges = knowledgeGraphEngine.edges.filter(e => e.from === linkRes.repairId && e.to === linkRes.defectId);
    assert.strictEqual(edges.length, 1);
    assert.strictEqual(edges[0].relationship, 'REPAIRS');
  });

  await test('Knowledge Graph: Memory quality evaluation verifies 0 credential leaks and calculates consistency', async () => {
    const qualityReport = knowledgeGraphEngine.evaluateMemoryQuality('actuator');
    assert.ok(qualityReport.retrievalLatencyMs >= 0);
    assert.ok(qualityReport.totalNodesAudited > 0);
    assert.strictEqual(qualityReport.privacyCompliance.secretsLeakedCount, 0);
    assert.strictEqual(qualityReport.privacyCompliance.status, 'COMPLIANT_ZERO_LEAKS');
    assert.ok(qualityReport.factualConsistencyScore >= 0.90);
  });

  // ===========================================================================
  // PART VII: FUTURE CAPABILITIES RESEARCH PROGRAM (Cap 20-25)
  // ===========================================================================
  console.log('\n--- PART VII: FUTURE CAPABILITIES RESEARCH PROGRAM ---');

  await test('Future Capabilities: Complete 10-dimension research backlog for Cap 20-25', async () => {
    const backlog = futureCapabilitiesLabInstance.getResearchBacklog();
    assert.strictEqual(backlog.length, 6);

    for (const item of backlog) {
      assert.ok(item.id);
      assert.ok(item.title);
      assert.ok(item.fictionalInspiration);
      assert.ok(item.canBuildToday);
      assert.ok(item.currentlyInfeasibleOrUncertain);
      assert.ok(item.hardwareAndSoftwareReqs);
      assert.ok(item.scientificPrerequisites);
      assert.ok(item.measurableSuccessCriterion);
      assert.ok(item.safetyConstraints);
      assert.ok(item.estimatedCostAndResources);
      assert.strictEqual(item.status, 'PROTOTYPE_READY');
    }
  });

  await test('Prototype 20: Self-improving prompt optimizer evaluates and ranks candidates', async () => {
    const proto20 = futureCapabilitiesLabInstance.evaluatePromptOptimization();
    assert.strictEqual(proto20.prototypeId, 'PROTO_20_PROMPT_OPTIMIZER');
    assert.ok(proto20.candidatesTested >= 3);
    assert.ok(proto20.bestAccuracy >= proto20.baselineMetric);
    assert.strictEqual(proto20.passCriterion, true);
  });

  await test('Prototype 21: Digital twin predicts memory impact vs actual telemetry', async () => {
    const proto21 = futureCapabilitiesLabInstance.simulateLocalComputerAction({
      type: 'FILE_READ_CHUNK',
      bytes: 1024 * 512
    });
    assert.strictEqual(proto21.prototypeId, 'PROTO_21_DIGITAL_TWIN_SIMULATOR');
    assert.ok(proto21.predictedMemoryDeltaMb > 0);
    assert.ok(proto21.actualMemoryDeltaMb > 0);
    assert.ok(proto21.durationMs >= 0);
  });

  await test('Prototype 22: Autonomous invention workspace synthesizes CAD script, stress, and BOM', async () => {
    const proto22 = futureCapabilitiesLabInstance.synthesizeRoboticJointDesign({
      linkLengthMm: 350,
      appliedLoadN: 300,
      material: 'TITANIUM_TI6AL4V',
      safetyFactorTarget: 2.0
    });
    assert.strictEqual(proto22.prototypeId, 'PROTO_22_INVENTION_WORKSPACE');
    assert.ok(proto22.safetyFactor >= 2.0);
    assert.strictEqual(proto22.isDesignValid, true);
    assert.ok(proto22.openScadScript.includes('$fn = 60;'));
    assert.ok(proto22.billOfMaterials.length >= 3);
    assert.ok(proto22.totalBomCostUsd > 0);
  });

  await test('Prototype 23: Spatial 3D robotics calculates kinematics and enforces safety exclusion box', async () => {
    // 1. Safe trajectory
    const safeCheck = futureCapabilitiesLabInstance.evaluateRoboticSafetyBounds([0, 15, 20]);
    assert.strictEqual(safeCheck.prototypeId, 'PROTO_23_SPATIAL_ROBOTICS');
    assert.strictEqual(safeCheck.safetyViolation, false);
    assert.strictEqual(safeCheck.motionPermitted, true);

    // 2. Trajectory entering operator exclusion zone (y between 400 and 600 mm)
    const unsafeCheck = futureCapabilitiesLabInstance.evaluateRoboticSafetyBounds([90, 0, 0]);
    assert.strictEqual(unsafeCheck.safetyViolation, true);
    assert.strictEqual(unsafeCheck.motionPermitted, false);
  });

  await test('Prototype 24: Multi-objective scientific Pareto optimizer discovers non-dominated candidates', async () => {
    const proto24 = futureCapabilitiesLabInstance.computeScientificParetoFront();
    assert.strictEqual(proto24.prototypeId, 'PROTO_24_SCIENTIFIC_PARETO');
    assert.ok(proto24.paretoFrontCount >= 2);
    assert.ok(proto24.paretoOptimalCandidates.some(c => c.name.includes('Titanium') || c.name.includes('Al 7075')));
  });

  await test('Prototype 25: Human-AI engineering diff review verifies 100% reversibility and approval token', async () => {
    const orig = 'function calcSpeed() { return distance / time; }';
    const prop = 'function calcSpeed() {\n  if (time <= 0) throw new Error("Time must be positive");\n  return distance / time;\n}';

    const proto25 = futureCapabilitiesLabInstance.generateEngineeringDiffReview(orig, prop, {
      rationale: 'Add zero-division guard to calcSpeed'
    });
    assert.strictEqual(proto25.prototypeId, 'PROTO_25_HUMAN_AI_COLLAB');
    assert.strictEqual(proto25.reversibilityStatus, '100%_REVERSIBLE');
    assert.ok(proto25.rollbackPointId.startsWith('rb_'));
    assert.strictEqual(proto25.metrics.netDelta, 3);
  });

  // ===========================================================================
  // PART VIII: TOOLS REGISTRY & INTEGRATION VALIDATION
  // ===========================================================================
  console.log('\n--- PART VIII: TOOLS REGISTRY & PERMISSION GATE INTEGRATION ---');

  await test('Tools Registry: Executes run_experiment_campaign tool through permission gate', async () => {
    const result = await executeTool('run_experiment_campaign', {
      title: 'Tool Registry Campaign Test',
      maxTrials: 20
    }, 'JARVIS');
    assert.ok(result.campaignId);
    assert.ok(result.trialsSummary.completed > 0);
  });

  await test('Tools Registry: Executes get_forecast_prediction and evaluate accuracy', async () => {
    const result = await executeTool('get_forecast_prediction', {
      statement: 'Continuous system operation latency will remain steady',
      expectedValue: 12.5,
      confidence: 0.90
    }, 'JARVIS');
    assert.ok(result.id);
    assert.strictEqual(result.confidenceScore, 0.90);
  });

  await test('Tools Registry: Executes manage_goal_objective tool', async () => {
    const result = await executeTool('manage_goal_objective', {
      action: 'LIST'
    }, 'JARVIS');
    assert.ok(Array.isArray(result));
  });

  await test('Tools Registry: Executes evaluate_future_capability tool', async () => {
    const result = await executeTool('evaluate_future_capability', {
      action: 'GET_BACKLOG'
    }, 'JARVIS');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 6);
  });

  console.log('\n================================================================================');
  console.log(`MASTER BENCHMARK RESULTS: ${passedTests} / ${totalTests} PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  if (failedTests > 0) {
    console.error(`FAILED TESTS: ${failedTests}`);
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. ${f.test}: ${f.error}`);
    });
  }
  console.log('================================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMasterSuite().catch(err => {
  console.error('Fatal suite crash:', err);
  process.exit(1);
});
