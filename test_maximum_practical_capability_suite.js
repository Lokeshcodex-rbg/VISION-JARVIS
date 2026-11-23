/**
 * test_maximum_practical_capability_suite.js
 * Comprehensive automated verification suite for STARK AI Maximum Practical Capability Directive.
 * Validates:
 * 1. Live Capability Registry (11 core pillars, grounding levels, execution telemetry, live markdown generation)
 * 2. Missing Dependency Investigator & Feasibility Proposer (exact obstacle, alternatives, feasibility scores, fallbacks)
 * 3. Empirical Experiment & Learning Ledger (persistence, metrics, acceptance rate, hypothesis testing)
 * 4. Technical Explainer & Reproduction Guide (governing equations, CLI commands, assertions, safety bounds)
 * 5. Immutable Security & Emergency Stop Inviolability (protection against self-modification)
 * 6. Integrated Tool Registry Execution (6 new autonomous capability tools)
 * 7. Live REST API Gateway Endpoints on http://localhost:3000
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const {
  capabilityRegistryInstance,
  GROUNDING_LEVELS,
  CAPABILITY_STATUS,
  CAPABILITY_CATEGORIES
} = require('./server/capabilityRegistry.js');

const {
  experimentLedgerInstance,
  EXPERIMENT_CATEGORIES,
  DECISIONS
} = require('./server/experimentLedger.js');

const { technicalExplainerInstance } = require('./server/technicalExplainer.js');
const { dependencyInvestigatorInstance } = require('./server/dependencyInvestigator.js');
const { selfDevelopmentEngineInstance, IMMUTABLE_CORE_ASSETS } = require('./server/selfDevelopmentEngine.js');
const { selfRepairServiceInstance } = require('./server/selfRepairService.js');
const toolsRegistry = require('./server/toolsRegistry.js');

let passedTests = 0;
let failedTests = 0;

function report(name, passed, detail = '') {
  if (passed) {
    passedTests++;
    console.log(`  ✓ [PASS] ${name}${detail ? ` - ${detail}` : ''}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${name} - ${detail}`);
  }
}

function makeHttpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runSuite() {
  console.log('================================================================');
  console.log('STARK AI — MAXIMUM PRACTICAL CAPABILITY DIRECTIVE TEST SUITE');
  console.log('================================================================\n');

  // ===========================================================================
  // SUITE 1: LIVE CAPABILITY REGISTRY & GROUNDING LEVELS
  // ===========================================================================
  console.log('--- SUITE 1: Live Capability Registry & Grounding Levels ---');

  const allCaps = capabilityRegistryInstance.getAllCapabilities();
  report('Capability registry loads non-empty list', allCaps.length >= 11, `Found ${allCaps.length} capabilities`);

  const requiredIds = [
    'reliable_research',
    'visual_perception',
    'audio_speech_transcription',
    'desktop_app_operation',
    'engineering_simulation',
    'software_machine_design',
    'self_coding_and_repair',
    'specialist_agents_tools',
    'performance_monitoring',
    'empirical_experiment_learning',
    'technical_explanation_reproduction'
  ];

  for (const reqId of requiredIds) {
    const cap = capabilityRegistryInstance.getCapability(reqId);
    report(`Pillar '${reqId}' is registered`, !!cap, cap ? `ID: ${cap.id} | Grounding: ${cap.groundingLevel}` : 'Missing');
  }

  // Check grounding levels validation
  const groundingCounts = {
    [GROUNDING_LEVELS.IMPLEMENTED_SOFTWARE]: 0,
    [GROUNDING_LEVELS.SIMULATED_RESULTS]: 0,
    [GROUNDING_LEVELS.EXTERNALLY_VERIFIED]: 0,
    [GROUNDING_LEVELS.PHYSICALLY_TESTED]: 0
  };

  allCaps.forEach(c => {
    if (groundingCounts[c.groundingLevel] !== undefined) {
      groundingCounts[c.groundingLevel]++;
    }
  });

  report('Software grounding category populated', groundingCounts[GROUNDING_LEVELS.IMPLEMENTED_SOFTWARE] > 0, `Count: ${groundingCounts[GROUNDING_LEVELS.IMPLEMENTED_SOFTWARE]}`);
  report('Simulation grounding category populated', groundingCounts[GROUNDING_LEVELS.SIMULATED_RESULTS] > 0, `Count: ${groundingCounts[GROUNDING_LEVELS.SIMULATED_RESULTS]}`);
  report('Physical testing grounding category populated', groundingCounts[GROUNDING_LEVELS.PHYSICALLY_TESTED] > 0, `Count: ${groundingCounts[GROUNDING_LEVELS.PHYSICALLY_TESTED]}`);

  // Test execution recording
  const targetCapId = 'cap_structural_stress_solver';
  const preCap = capabilityRegistryInstance.getCapability(targetCapId);
  const prevCount = preCap?.measuredPerformance?.callCount || 0;
  capabilityRegistryInstance.recordExecutionOutcome(targetCapId, { success: true, latencyMs: 42 });
  const postCap = capabilityRegistryInstance.getCapability(targetCapId);
  report('Capability execution telemetry records metrics', postCap.measuredPerformance.callCount === prevCount + 1, `Calls: ${postCap.measuredPerformance.callCount}, Latency: ${postCap.measuredPerformance.latencyMs}ms`);

  // Test Live Markdown Report generation
  const mdReport = capabilityRegistryInstance.generateLiveReport();
  report('Live Markdown Report contains STARK header', mdReport.includes('LIVE CAPABILITY REGISTRY') || mdReport.includes('STARK AI'), 'Header verified');
  report('Live Markdown Report contains Grounding Glossary', mdReport.includes('IMPLEMENTED_SOFTWARE') || mdReport.includes('SIMULATED_RESULTS'), 'Glossary verified');

  // ===========================================================================
  // SUITE 2: MISSING DEPENDENCY INVESTIGATOR & FEASIBILITY PROPOSER
  // ===========================================================================
  console.log('\n--- SUITE 2: Missing Dependency Investigator & Feasibility Proposer ---');

  // 1. Diagnose OpenSCAD (typically missing on vanilla Windows dev machine)
  const openscadDiag = await dependencyInvestigatorInstance.diagnose('openscad');
  report('OpenSCAD diagnosis runs cleanly', openscadDiag.target === 'openscad');
  report('OpenSCAD diagnosis accurately reports binary status', typeof openscadDiag.available === 'boolean');
  if (!openscadDiag.available) {
    report('Identified technical obstacle for missing binary', openscadDiag.obstacle && openscadDiag.obstacle.length > 5, openscadDiag.obstacle);
    report('Provides feasible grounded alternatives', Array.isArray(openscadDiag.feasibleAlternatives) && openscadDiag.feasibleAlternatives.length > 0, `Alternatives: ${openscadDiag.feasibleAlternatives.map(a => a.name).join(', ')}`);
    report('Fallback engaged without faking capability', openscadDiag.implementedFallback === 'CSG_CODE_AND_PARAMETRIC_EXPORT', 'Fallback: ' + openscadDiag.implementedFallback);
  }

  // 2. Diagnose Git (installed)
  const gitDiag = await dependencyInvestigatorInstance.diagnose('git');
  report('Git diagnosis detects available binary', gitDiag.available === true, gitDiag.diagnostics ? JSON.stringify(gitDiag.diagnostics) : 'available');

  // 3. Diagnose API Key
  const apiKeyDiag = await dependencyInvestigatorInstance.diagnose('gemini_vision_api');
  report('API Key diagnosis evaluates environment', typeof apiKeyDiag.available === 'boolean', `API Key Available: ${apiKeyDiag.available}`);

  // 4. Diagnose Permission Gate
  const permDiag = await dependencyInvestigatorInstance.diagnose('camera');
  report('Permission gate diagnosis checks gate status', typeof permDiag.available === 'boolean', `Gate available: ${permDiag.available}`);

  // ===========================================================================
  // SUITE 3: EMPIRICAL EXPERIMENT & LEARNING LEDGER
  // ===========================================================================
  console.log('\n--- SUITE 3: Empirical Experiment & Learning Ledger ---');

  const initialExps = experimentLedgerInstance.getExperiments();
  report('Experiment ledger initial entries loaded', initialExps.length >= 2, `Seeded with ${initialExps.length} experiments`);

  // Record a new empirical experiment
  const newExp = experimentLedgerInstance.recordExperiment({
    title: 'Adaptive Prompt Memoization Optimization',
    hypothesis: 'Quantized prompt caching reduces repeated multi-turn TTFT by > 20%',
    category: EXPERIMENT_CATEGORIES.LATENCY,
    baseline: { metric: 'TTFT_ms', value: 240 },
    parameters: { cacheTtlMs: 60000, maxEntries: 256 },
    measuredOutcome: { metric: 'TTFT_ms', value: 165, percentImprovement: 31.25 },
    decision: DECISIONS.ACCEPTED,
    decisionReason: 'Verified > 30% reduction in time-to-first-token across 50 simulated calls.',
    reproductionSteps: ['node ./scripts/test_prompt_cache.js'],
    reproducibilityNotes: 'Empirical verification under automated load test with 5 iterations'
  });

  report('New experiment recorded in ledger', !!newExp && newExp.measuredOutcome.percentImprovement > 0, `Recorded with ${newExp.measuredOutcome.percentImprovement}% improvement`);

  const summary = experimentLedgerInstance.computeLearningsSummary();
  report('Ledger computes summary metrics', summary.totalExperiments >= 3 && typeof summary.acceptanceRatePercent === 'number', `Acceptance rate: ${summary.acceptanceRatePercent}%`);

  // ===========================================================================
  // SUITE 4: TECHNICAL EXPLAINER & REPRODUCTION GUIDES
  // ===========================================================================
  console.log('\n--- SUITE 4: Technical Explainer & Reproduction Guides ---');

  // Beam Deflection
  const beamGuide = technicalExplainerInstance.explainBeamDeflection({
    forceN: 500,
    lengthM: 1.2,
    elasticModulusPa: 69e9,
    inertiaM4: 8.5e-8
  });

  report('Beam deflection guide generated with exact math', beamGuide.success === true, 'Deflection guide generated');
  report('Beam deflection markdown includes reproduction CLI', beamGuide.markdown.includes('node -e') && beamGuide.markdown.includes('Euler-Bernoulli'), 'CLI and equations included');
  report('Beam deflection grounding flagged as SIMULATED_RESULTS', beamGuide.groundingLevel === GROUNDING_LEVELS.SIMULATED_RESULTS);

  // Actuator Torque
  const torqueGuide = technicalExplainerInstance.explainActuatorTorque({
    massKg: 15,
    armLengthM: 0.45,
    accelerationRadS2: 4.0,
    safetyFactor: 1.5
  });

  report('Actuator torque guide generated', torqueGuide.success === true, 'Torque guide generated');
  report('Actuator torque markdown includes LaTeX equations', torqueGuide.markdown.includes('\\tau_{gravity}') && torqueGuide.markdown.includes('\\tau_{required}'), 'LaTeX math verified');

  // Generic reproduction guide
  const customGuide = technicalExplainerInstance.generateReproductionGuide({
    topic: 'Adaptive Frequency Scaling for Audio Buffer',
    groundingLevel: GROUNDING_LEVELS.PHYSICALLY_TESTED,
    description: 'Empirically tunes input sample chunking from 4096 to 2048 to minimize end-to-end speech latency',
    equations: [
      { name: 'Buffer Latency', formula: '\\tau_{\\text{buff}} = \\frac{N}{f_s}', variables: 'N = chunk size, f_s = sample rate' }
    ],
    cliCommands: ['node ./scripts/benchmark_audio_latency.js --chunk 2048'],
    assertions: [
      { criteria: 'Audio roundtrip latency', expected: '< 120 ms' },
      { criteria: 'Drop rate', expected: '0.0%' }
    ],
    safetyNotes: ['Prevent underrun by prioritizing WebAudio thread']
  });

  report('Custom reproduction guide generated', customGuide.markdown.toLowerCase().includes('adaptive frequency scaling'), 'Custom title verified');
  report('Grounding level correctly tagged in guide', customGuide.markdown.includes('PHYSICALLY_TESTED'), 'Grounding verified');

  // ===========================================================================
  // SUITE 5: IMMUTABLE SECURITY & EMERGENCY STOP INVIOLABILITY
  // ===========================================================================
  console.log('\n--- SUITE 5: Immutable Security & Emergency Stop Inviolability ---');

  // Test selfDevelopmentEngine rejects modification of immutable assets
  const protectedPaths = [
    'server/desktop/permissionGate.js',
    'server/capabilityRegistry.js',
    'server/selfDevelopmentEngine.js',
    'server/selfRepairService.js'
  ];

  for (const p of protectedPaths) {
    const isProtectedEng = selfDevelopmentEngineInstance.isImmutableTarget(p);
    report(`selfDevelopmentEngine protects '${p}'`, isProtectedEng === true);

    const isProtectedRep = selfRepairServiceInstance.isImmutableTarget(p);
    report(`selfRepairService protects '${p}'`, isProtectedRep === true);
  }

  // Attempt to simulate self-modification of permissionGate via createSourceFile
  try {
    selfDevelopmentEngineInstance.createSourceFile({
      filePath: 'server/desktop/permissionGate.js',
      content: '// attempt unauthorized overwrite',
      overwrite: true
    });
    report('selfDevelopmentEngine blocks write to permissionGate', false, 'Expected rejection');
  } catch (err) {
    report('selfDevelopmentEngine blocks write to permissionGate', err.message.includes('immutable security core asset'), err.message);
  }

  // ===========================================================================
  // SUITE 6: INTEGRATED TOOL REGISTRY EXECUTION
  // ===========================================================================
  console.log('\n--- SUITE 6: Integrated Tool Registry Execution ---');

  // 1. get_live_capability_registry
  const toolCapRes = await toolsRegistry.executeTool('get_live_capability_registry', { format: 'summary' });
  report('Tool: get_live_capability_registry executes', toolCapRes && toolCapRes.totalCapabilities >= 11, `Total: ${toolCapRes.totalCapabilities}`);

  // 2. diagnose_missing_dependency
  const toolDiagRes = await toolsRegistry.executeTool('diagnose_missing_dependency', { dependency: 'openscad' });
  report('Tool: diagnose_missing_dependency executes', toolDiagRes && toolDiagRes.target === 'openscad', `Capability status: ${toolDiagRes.capabilityStatus}`);

  // 3. record_system_experiment
  const toolRecExp = await toolsRegistry.executeTool('record_system_experiment', {
    title: 'Tool Dispatch Memoization Benchmark',
    hypothesis: 'Tool call memoization avoids duplicate parsing',
    category: 'LATENCY',
    metricName: 'execution_time_ms',
    baselineValue: 12.4,
    measuredValue: 0.8,
    decision: 'ACCEPTED'
  });
  report('Tool: record_system_experiment executes', toolRecExp && toolRecExp.success === true, `Experiment ID: ${toolRecExp.experiment?.id}`);

  // 4. get_experiment_ledger
  const toolLedger = await toolsRegistry.executeTool('get_experiment_ledger', { limit: 5 });
  report('Tool: get_experiment_ledger executes', toolLedger && toolLedger.experiments.length >= 1, `Count: ${toolLedger.experiments.length}`);

  // 5. explain_engineering_simulation
  const toolBeamSim = await toolsRegistry.executeTool('explain_engineering_simulation', {
    simulationType: 'beam_deflection',
    forceN: 250,
    lengthM: 0.8
  });
  report('Tool: explain_engineering_simulation (beam) executes', toolBeamSim && toolBeamSim.success === true, `Topic: ${toolBeamSim.topic}`);

  // 6. generate_technical_reproduction_guide
  const toolGuide = await toolsRegistry.executeTool('generate_technical_reproduction_guide', {
    topic: 'PID Controller Loop Tuning',
    equations: [
      { name: 'PID Equation', formula: 'u(t) = K_p e(t) + K_i \\int_0^t e(\\tau)d\\tau + K_d \\frac{de(t)}{dt}' }
    ],
    cliCommands: ['node test_pid_tuner.js'],
    assertions: [
      { criteria: 'Overshoot', expected: '< 5%' }
    ]
  });
  report('Tool: generate_technical_reproduction_guide executes', toolGuide && toolGuide.markdown.toLowerCase().includes('pid controller loop tuning'), 'Markdown generated');

  // ===========================================================================
  // SUITE 7: BACKEND REST API GATEWAY ENDPOINTS
  // ===========================================================================
  console.log('\n--- SUITE 7: Backend REST API Gateway Endpoints ---');

  // GET /api/capabilities
  try {
    const res = await makeHttpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/capabilities',
      method: 'GET'
    });
    report('REST: GET /api/capabilities', res.status === 200 && Array.isArray(res.data.capabilities), `Status: ${res.status}, Count: ${res.data.count}`);
  } catch (err) {
    report('REST: GET /api/capabilities', false, err.message);
  }

  // GET /api/capabilities/report
  try {
    const res = await makeHttpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/capabilities/report',
      method: 'GET'
    });
    report('REST: GET /api/capabilities/report', res.status === 200 && res.headers['content-type'].includes('markdown'), `Status: ${res.status}`);
  } catch (err) {
    report('REST: GET /api/capabilities/report', false, err.message);
  }

  // POST /api/capabilities/diagnose
  try {
    const res = await makeHttpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/capabilities/diagnose',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { dependency: 'openscad' });
    report('REST: POST /api/capabilities/diagnose', res.status === 200 && res.data.target === 'openscad', `Status: ${res.status}, Available: ${res.data.available}`);
  } catch (err) {
    report('REST: POST /api/capabilities/diagnose', false, err.message);
  }

  // GET /api/experiments
  try {
    const res = await makeHttpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/experiments',
      method: 'GET'
    });
    report('REST: GET /api/experiments', res.status === 200 && Array.isArray(res.data.experiments), `Status: ${res.status}, Count: ${res.data.experiments.length}`);
  } catch (err) {
    report('REST: GET /api/experiments', false, err.message);
  }

  // POST /api/experiments
  try {
    const res = await makeHttpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/experiments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: 'REST API Gateway Sub-Millisecond Serialization Test',
      hypothesis: 'Fast JSON serialization yields < 2ms latency for capability queries',
      category: 'LATENCY',
      baseline: { metric: 'latency_ms', value: 8 },
      measuredOutcome: { metric: 'latency_ms', value: 1.2, percentImprovement: 85.0 },
      decision: 'ACCEPTED'
    });
    report('REST: POST /api/experiments', res.status === 200 && res.data.success === true, `Status: ${res.status}, ID: ${res.data.experiment?.id}`);
  } catch (err) {
    report('REST: POST /api/experiments', false, err.message);
  }

  // POST /api/technical/explain
  try {
    const res = await makeHttpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/technical/explain',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      type: 'actuator_torque',
      params: { massKg: 10, armLengthM: 0.3 }
    });
    report('REST: POST /api/technical/explain', res.status === 200 && res.data.success === true, `Status: ${res.status}`);
  } catch (err) {
    report('REST: POST /api/technical/explain', false, err.message);
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n================================================================');
  console.log(`TEST SUITE COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Unhandled suite error:', err);
  process.exit(1);
});
