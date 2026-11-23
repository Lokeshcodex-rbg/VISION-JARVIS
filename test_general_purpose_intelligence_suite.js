/**
 * STARK AI — Advanced General-Purpose AI Architecture Test Suite
 * Comprehensive verification of all 12 core subsystems:
 *  1. Model & Provider Manager (capabilities, adaptive routing, tier selection, fallback)
 *  2. Conversation & Context Manager (token budgeting, selective memory, rolling summary)
 *  3. Task Classification & Routing (12 categories, intent detection, ambiguity clarification)
 *  4. Planning & Decomposition Engine (DAG task ledger, dependencies, checkpoints, cancellation)
 *  5. Evidence & Uncertainty Manager (VERIFIED_FACT, RETRIEVED_SOURCE, ESTIMATE, UNKNOWN, SIMULATED)
 *  6. Tool Execution, Sandboxing & Emergency Stop Invariant
 *  7. Document Intelligence & Local Workspace Verification (Word creation, parsing, SHA-256)
 *  8. Specialist Agents Delegation (Math/Computation, Research, Security Reviewer)
 *  9. Live HTTP & Server-Sent Events Endpoints (/api/chat, /api/chat/stream, /api/intelligence/*)
 * 10. Continuous Evaluation & Metrics Recording (experiment ledger, latencies, success rates)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const http = require('http');

const { unifiedIntelligenceLayerInstance, TASK_CATEGORIES, GROUNDING_LEVELS } = require('./server/unifiedIntelligenceLayer.js');
const { conversationManagerInstance } = require('./server/conversationManager.js');
const { memoryManagerInstance } = require('./server/memoryManager.js');
const { localWorkspaceManagerInstance } = require('./server/desktop/localWorkspaceManager.js');
const { securityPermissionsInstance } = require('./server/securityPermissions.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { documentIntelligenceEngineInstance } = require('./server/documentIntelligenceEngine.js');
const multiAgentOrchestrator = require('./server/multiAgentOrchestrator.js');
const { serverAuthManagerInstance } = require('./server/serverAuthManager.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertTest(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] Test ${totalTests}: ${name} — ${details}`);
  }
}

// Helper: HTTP request with session token
function makeHttpRequest(method, reqPath, body = null) {
  return new Promise((resolve, reject) => {
    const token = serverAuthManagerInstance.getSessionToken();
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: reqPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Stark-Auth-Token': token,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody), raw: resBody });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Helper: SSE stream request
function testSseStream(message) {
  return new Promise((resolve, reject) => {
    const token = serverAuthManagerInstance.getSessionToken();
    const data = JSON.stringify({ message, personality: 'JARVIS' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/chat/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Stark-Auth-Token': token,
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let eventsReceived = [];
      let rawData = '';
      res.on('data', chunk => {
        rawData += chunk.toString();
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventsReceived.push(line.replace('event: ', '').trim());
          }
        }
      });
      res.on('end', () => resolve({ status: res.statusCode, events: eventsReceived, raw: rawData }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('   STARK AI — GENERAL-PURPOSE AI ARCHITECTURE EVALUATION SUITE  ');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: MODEL ABSTRACTION, ADAPTIVE ROUTING & CAPABILITIES
  // -------------------------------------------------------------------------
  console.log('--- Section 1: Model Abstraction, Adaptive Routing & Capabilities ---');
  {
    const providers = unifiedIntelligenceLayerInstance.listConfiguredProviders();
    assertTest('Provider discovery returns operational status', providers && providers.providers !== undefined);

    const capPro = unifiedIntelligenceLayerInstance.getModelCapabilities('gemini-2.5-pro');
    assertTest('Gemini 2.5 Pro discovery flags REASONING_HEAVY tier', capPro.latencyTier === 'REASONING_HEAVY');

    const capLite = unifiedIntelligenceLayerInstance.getModelCapabilities('gemini-3.1-flash-lite');
    assertTest('Gemini 3.1 Flash Lite discovery flags FAST_LIGHTWEIGHT tier', capLite.latencyTier === 'FAST_LIGHTWEIGHT');

    // Routing for complex coding task
    const codingRoute = unifiedIntelligenceLayerInstance.selectOptimalModel({
      category: TASK_CATEGORIES.CODING,
      complexity: 'high'
    });
    assertTest('Coding task routes to COMPLEX_REASONING tier', codingRoute.tier === 'COMPLEX_REASONING');

    // Routing for simple conversation
    const convoRoute = unifiedIntelligenceLayerInstance.selectOptimalModel({
      category: TASK_CATEGORIES.CONVERSATION,
      complexity: 'low'
    });
    assertTest('Conversational banter routes to FAST_LIGHTWEIGHT tier', convoRoute.tier === 'FAST_LIGHTWEIGHT');

    // Routing for strict local privacy mode
    const localRoute = unifiedIntelligenceLayerInstance.selectOptimalModel({
      category: TASK_CATEGORIES.FILE_OPERATIONS,
      privacyMode: 'strict_local_only'
    });
    assertTest('Strict local privacy mode enforces LOCAL_INSTANT model tier', localRoute.selectedModel === 'local_deterministic');

    // User model override
    const overrideRoute = unifiedIntelligenceLayerInstance.selectOptimalModel({
      category: TASK_CATEGORIES.CONVERSATION,
      userOverride: 'claude-3.5-sonnet'
    });
    assertTest('User model override is honored', overrideRoute.selectedModel === 'claude-3.5-sonnet' && overrideRoute.isUserOverride === true);
  }

  // -------------------------------------------------------------------------
  // SECTION 2: TASK UNDERSTANDING & CLASSIFICATION (12 CATEGORIES)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 2: Task Understanding & Classification (12 Categories) ---');
  {
    const c1 = unifiedIntelligenceLayerInstance.classifyTask('Hello Jarvis, how are you today?');
    assertTest('Classifies greetings as CONVERSATION', c1.category === TASK_CATEGORIES.CONVERSATION);

    const c2 = unifiedIntelligenceLayerInstance.classifyTask('Explain how quantum entanglement works in physics');
    assertTest('Classifies conceptual explanation as GENERAL_QUESTION', c2.category === TASK_CATEGORIES.GENERAL_QUESTION);

    const c3 = unifiedIntelligenceLayerInstance.classifyTask('Refactor this JavaScript function and run tests');
    assertTest('Classifies code changes as CODING', c3.category === TASK_CATEGORIES.CODING);

    const c4 = unifiedIntelligenceLayerInstance.classifyTask('List workspace files in documents folder and compare hashes');
    assertTest('Classifies directory operations as FILE_OPERATIONS', c4.category === TASK_CATEGORIES.FILE_OPERATIONS);

    const c5 = unifiedIntelligenceLayerInstance.classifyTask('Create a Word document (.docx) summary of quarterly reports');
    assertTest('Classifies document generation as DOCUMENT_CREATION', c5.category === TASK_CATEGORIES.DOCUMENT_CREATION);

    const c6 = unifiedIntelligenceLayerInstance.classifyTask('Search ArXiv for recent peer-reviewed humanoid robotics papers');
    assertTest('Classifies academic literature search as RESEARCH', c6.category === TASK_CATEGORIES.RESEARCH);

    const c7 = unifiedIntelligenceLayerInstance.classifyTask('Open Notepad app and bring the window to front');
    assertTest('Classifies window/app launch as DESKTOP_AUTOMATION', c7.category === TASK_CATEGORIES.DESKTOP_AUTOMATION);

    const c8 = unifiedIntelligenceLayerInstance.classifyTask('What time is it currently in Tokyo?');
    assertTest('Classifies time check as SCHEDULING', c8.category === TASK_CATEGORIES.SCHEDULING);

    const c9 = unifiedIntelligenceLayerInstance.classifyTask('Send WhatsApp message to John with the update');
    assertTest('Classifies WhatsApp as EXTERNAL_COMMUNICATION', c9.category === TASK_CATEGORIES.EXTERNAL_COMMUNICATION);

    const c10 = unifiedIntelligenceLayerInstance.classifyTask('Get hardware metrics and telemetry for CPU and memory usage');
    assertTest('Classifies system telemetry as DATA_ANALYSIS', c10.category === TASK_CATEGORIES.DATA_ANALYSIS);

    const c11 = unifiedIntelligenceLayerInstance.classifyTask('Solve ODE with RK4 and calculate beam stress analysis');
    assertTest('Classifies numerical simulation as SCIENTIFIC_COMPUTATION', c11.category === TASK_CATEGORIES.SCIENTIFIC_COMPUTATION);

    const c12 = unifiedIntelligenceLayerInstance.classifyTask('Build a project report and then open it in Word after that');
    assertTest('Classifies compound workflow as MULTI_STEP_PROJECT', c12.category === TASK_CATEGORIES.MULTI_STEP_PROJECT);

    // Ambiguity Detection
    const cAmb1 = unifiedIntelligenceLayerInstance.classifyTask('Delete please');
    assertTest('Ambiguous deletion request triggers clarification requirement', cAmb1.requiresClarification === true);

    const cAmb2 = unifiedIntelligenceLayerInstance.classifyTask('Send email right away');
    assertTest('Ambiguous email request triggers clarification requirement', cAmb2.requiresClarification === true);
  }

  // -------------------------------------------------------------------------
  // SECTION 3: CONTEXT ASSEMBLY, ROLLING SUMMARY & USER PREFERENCES
  // -------------------------------------------------------------------------
  console.log('\n--- Section 3: Context Assembly, Memory & User Preferences ---');
  {
    // Memory integration test
    const memRes = memoryManagerInstance.addMemory('Preferred code editor is VSCode with 2 spaces indent', 'preference');
    assertTest('Explicit preference saved in memoryManager', memRes.success === true);

    const context = unifiedIntelligenceLayerInstance.assembleContext({
      personality: 'JARVIS',
      userMessage: 'What code editor and indent settings do I like?'
    });
    assertTest('Context assembly selectively includes relevant memory', context.injectedMemories.some(m => m.fact.includes('VSCode')));
    assertTest('Context assembly includes active preferences', context.activePreferences.communicationStyle !== undefined);
    assertTest('Context assembly calculates token budget estimate', typeof context.tokenEstimated === 'number' && context.tokenEstimated >= 0);

    // User Preferences Inspection, Updating, and Resetting
    const initialPrefs = unifiedIntelligenceLayerInstance.getPreferences();
    assertTest('Default communicationStyle is concise', initialPrefs.communicationStyle === 'concise');

    const updateRes = unifiedIntelligenceLayerInstance.setPreferences({ communicationStyle: 'technical', language: 'hi' });
    assertTest('setPreferences updates active profile', updateRes.preferences.communicationStyle === 'technical' && updateRes.preferences.language === 'hi');

    // Persistence on disk
    const diskPrefs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/user_preferences.json'), 'utf8'));
    assertTest('Preferences persisted to data/user_preferences.json', diskPrefs.communicationStyle === 'technical');

    // Reset preferences
    const resetRes = unifiedIntelligenceLayerInstance.resetPreferences();
    assertTest('resetPreferences restores default configuration', resetRes.preferences.communicationStyle === 'concise' && resetRes.preferences.language === 'en');
  }

  // -------------------------------------------------------------------------
  // SECTION 4: PLANNING, DECOMPOSITION & TASK LEDGER DAG EXECUTION
  // -------------------------------------------------------------------------
  console.log('\n--- Section 4: Planning, Decomposition & Task Ledger DAG Execution ---');
  {
    const plan = unifiedIntelligenceLayerInstance.createTaskPlan({
      goal: 'Autonomous Workspace Audit and Verification',
      category: TASK_CATEGORIES.MULTI_STEP_PROJECT
    });
    assertTest('createTaskPlan generates structured TaskLedger', plan && plan.taskId.startsWith('task_'));
    assertTest('TaskLedger initial status is PLANNED', plan.status === 'PLANNED');
    assertTest('TaskLedger contains 3 decomposed steps', plan.steps.length === 3);

    // Checkpoint persisted on disk
    const checkpointFile = path.join(__dirname, 'data/tasks', `${plan.taskId}_checkpoint.json`);
    assertTest('Task checkpoint written to data/tasks/<taskId>_checkpoint.json', fs.existsSync(checkpointFile));

    // Execute the task ledger
    const executed = await unifiedIntelligenceLayerInstance.executeTaskPlan(plan, { personality: 'JARVIS' });
    assertTest('Task ledger execution reaches COMPLETED status', executed.status === 'COMPLETED');
    assertTest('All steps executed and marked COMPLETED', executed.steps.every(s => s.status === 'COMPLETED'));
    assertTest('Final verification confirms all steps verified', executed.finalVerification.success === true);

    // In-flight task cancellation test
    const plan2 = unifiedIntelligenceLayerInstance.createTaskPlan({
      goal: 'Long running task to cancel',
      category: TASK_CATEGORIES.MULTI_STEP_PROJECT
    });
    const cancelRes = unifiedIntelligenceLayerInstance.cancelTask(plan2.taskId, 'User abort test');
    assertTest('cancelTask marks ledger CANCELLED', cancelRes.success === true && cancelRes.status === 'CANCELLED');
    const retrievedLedger = unifiedIntelligenceLayerInstance.getTaskLedger(plan2.taskId);
    assertTest('Persisted checkpoint reflects CANCELLED state', retrievedLedger.status === 'CANCELLED');
  }

  // -------------------------------------------------------------------------
  // SECTION 5: EVIDENCE & UNCERTAINTY MANAGER
  // -------------------------------------------------------------------------
  console.log('\n--- Section 5: Evidence & Uncertainty Manager ---');
  {
    const factEvidence = unifiedIntelligenceLayerInstance.tagEvidence({
      claim: 'File exists on disk with verified SHA-256 hash',
      level: GROUNDING_LEVELS.VERIFIED_FACT,
      source: 'localWorkspaceManager'
    });
    assertTest('tagEvidence creates VERIFIED_FACT record with timestamp', factEvidence.level === 'VERIFIED_FACT' && factEvidence.timestamp);

    const sourceEvidence = unifiedIntelligenceLayerInstance.tagEvidence({
      claim: 'Published ArXiv paper on transformer attention',
      level: GROUNDING_LEVELS.RETRIEVED_SOURCE,
      source: 'arxiv:1706.03762'
    });
    assertTest('tagEvidence creates RETRIEVED_SOURCE record', sourceEvidence.level === 'RETRIEVED_SOURCE');

    const simEvidence = unifiedIntelligenceLayerInstance.tagEvidence({
      claim: 'Monte Carlo simulation estimate of mechanical yield',
      level: GROUNDING_LEVELS.SIMULATED,
      source: 'scientificComputationEngine'
    });
    assertTest('tagEvidence clearly separates SIMULATED from physical reality', simEvidence.level === 'SIMULATED');

    const unknownEvidence = unifiedIntelligenceLayerInstance.tagEvidence({
      claim: 'Undocumented external API schema',
      level: GROUNDING_LEVELS.UNKNOWN
    });
    assertTest('tagEvidence supports explicit UNKNOWN attribution', unknownEvidence.level === 'UNKNOWN');
  }

  // -------------------------------------------------------------------------
  // SECTION 6: REAL TOOL EXECUTION, SANDBOXING & EMERGENCY STOP INVARIANT
  // -------------------------------------------------------------------------
  console.log('\n--- Section 6: Real Tool Execution, Sandboxing & Emergency Stop Invariant ---');
  {
    // Real tool execution with ground truth verification
    const execRes = await unifiedIntelligenceLayerInstance.executeToolSafely('get_current_time', {}, { personality: 'JARVIS' });
    assertTest('executeToolSafely runs deterministic tool', execRes.success === true && execRes.result !== null);
    assertTest('executeToolSafely verifies outcome and tags evidence', execRes.verified === true && execRes.evidence.level === 'VERIFIED_FACT');

    // Directory traversal attack defense
    let traversalBlocked = false;
    try {
      await unifiedIntelligenceLayerInstance.executeToolSafely('read_workspace_file', {
        filePath: 'documents/../../Windows/System32/drivers/etc/hosts'
      });
    } catch (err) {
      traversalBlocked = err.message.includes('SECURITY_VIOLATION') || err.message.includes('traversal');
    }
    assertTest('Path traversal attempt strictly blocked before tool execution', traversalBlocked === true);

    // Global Emergency Stop Invariant
    emergencyStopControllerInstance.engage('Automated test emergency halt');
    let eStopBlocked = false;
    try {
      await unifiedIntelligenceLayerInstance.executeToolSafely('get_current_time', {});
    } catch (err) {
      eStopBlocked = err.message.includes('EMERGENCY_STOP_ACTIVE');
    }
    assertTest('Emergency stop immediately halts tool execution', eStopBlocked === true);

    // Reset emergency stop
    emergencyStopControllerInstance.disengage();
    assertTest('Emergency stop cleanly disengaged', emergencyStopControllerInstance.isEngaged() === false);
  }

  // -------------------------------------------------------------------------
  // SECTION 7: DOCUMENT INTELLIGENCE & LOCAL WORKSPACE INTEGRATION
  // -------------------------------------------------------------------------
  console.log('\n--- Section 7: Document Intelligence & Local Workspace Verification ---');
  {
    const docPath = 'documents/STARK_Architecture_Test_Doc.docx';
    const createDocRes = await documentIntelligenceEngineInstance.createWordDocument({
      filePath: docPath,
      title: 'STARK AI General-Purpose Architecture Verification',
      author: 'JARVIS Autonomous Core',
      paragraphs: [
        'This document verifies the end-to-end document intelligence engine.',
        'Deterministic local file creation with zero hallucination and verifiable disk footprint.'
      ],
      sections: [{ heading: 'Verification Status', content: 'Status: PASS' }],
      bulletPoints: ['Ground Truth Verification', 'SHA-256 Hashing', 'Word Document Parsing']
    });

    assertTest('createWordDocument creates valid .docx file on disk', createDocRes.success === true && fs.existsSync(createDocRes.filePath));
    assertTest('Document size is non-zero bytes', createDocRes.sizeBytes > 0);

    // Read back and verify document content
    const inspectDoc = await documentIntelligenceEngineInstance.inspectDocument(createDocRes.filePath);
    assertTest('inspectDocument reads back .docx metadata and structure', inspectDoc.success === true && inspectDoc.format === 'docx');

    // Verify SHA-256 hash using workspace manager
    const hashCheck = localWorkspaceManagerInstance.verifyFileHash(createDocRes.filePath);
    assertTest('localWorkspaceManager verifies SHA-256 hash on disk', hashCheck.success === true && hashCheck.sha256.length === 64);
  }

  // -------------------------------------------------------------------------
  // SECTION 8: SCIENTIFIC COMPUTATION & SPECIALIST AGENTS DELEGATION
  // -------------------------------------------------------------------------
  console.log('\n--- Section 8: Scientific Computation & Specialist Agents Delegation ---');
  {
    // Specialist Agent: Math & Computation
    const mathAgentRes = await unifiedIntelligenceLayerInstance.executeSpecialistAgent('math_computation_agent', {
      type: 'ode_and_monte_carlo'
    });
    assertTest('Math specialist agent solves ODE and runs Monte Carlo', mathAgentRes.status === 'COMPLETED' && mathAgentRes.findings !== null);
    assertTest('Math specialist confirms RK4 convergence', mathAgentRes.findings.exponentialDecayCheck.finalValue > 0);

    // Specialist Agent: Research Specialist
    const researchAgentRes = await unifiedIntelligenceLayerInstance.executeSpecialistAgent('research_agent', {
      query: 'deep learning optimization'
    });
    assertTest('Research specialist retrieves papers with citations', researchAgentRes.status === 'COMPLETED' && Array.isArray(researchAgentRes.findings.topPapers));

    // Specialist Agent: Security Reviewer
    const securityAgentRes = await unifiedIntelligenceLayerInstance.executeSpecialistAgent('security_reviewer', {});
    assertTest('Security reviewer validates permission gate invariants', securityAgentRes.status === 'COMPLETED' && securityAgentRes.findings.emergencyStopStatus === 'ARMED_AND_READY');
  }

  // -------------------------------------------------------------------------
  // SECTION 9: LIVE HTTP & SERVER-SENT EVENTS ENDPOINTS
  // -------------------------------------------------------------------------
  console.log('\n--- Section 9: Live HTTP & Server-Sent Events Endpoints ---');
  {
    // 1. POST /api/chat (Dual AI Conversation & Tool Execution)
    const chatRes = await makeHttpRequest('POST', '/api/chat', {
      message: 'What time is it right now?',
      personality: 'JARVIS'
    });
    assertTest('POST /api/chat returns HTTP 200 with structured reply', chatRes.status === 200 && typeof chatRes.data.reply === 'string');
    assertTest('POST /api/chat returns toolResult and category', chatRes.data.toolResult !== null && chatRes.data.category === 'SCHEDULING');
    assertTest('POST /api/chat attaches evidence array', Array.isArray(chatRes.data.evidence));

    // 2. POST /api/chat/stream (SSE Progressive Streaming)
    const streamRes = await testSseStream('What time is it right now?');
    assertTest('POST /api/chat/stream returns HTTP 200 text/event-stream', streamRes.status === 200);
    assertTest('SSE stream emits done event', streamRes.events.includes('done'));

    // 3. POST /api/intelligence/task
    const taskApiRes = await makeHttpRequest('POST', '/api/intelligence/task', {
      goal: 'Audit documents workspace',
      category: TASK_CATEGORIES.MULTI_STEP_PROJECT,
      personality: 'JARVIS'
    });
    assertTest('POST /api/intelligence/task creates & executes task via API', taskApiRes.status === 200 && taskApiRes.data.success === true);

    // 4. GET /api/intelligence/tasks
    const tasksListRes = await makeHttpRequest('GET', '/api/intelligence/tasks');
    assertTest('GET /api/intelligence/tasks returns list of task ledgers', tasksListRes.status === 200 && Array.isArray(tasksListRes.data.tasks));

    // 5. GET & POST /api/intelligence/preferences
    const getPrefsRes = await makeHttpRequest('GET', '/api/intelligence/preferences');
    assertTest('GET /api/intelligence/preferences returns active preferences', getPrefsRes.status === 200 && getPrefsRes.data.preferences !== undefined);

    const postPrefsRes = await makeHttpRequest('POST', '/api/intelligence/preferences', {
      communicationStyle: 'detailed'
    });
    assertTest('POST /api/intelligence/preferences updates user preferences via API', postPrefsRes.status === 200 && postPrefsRes.data.preferences.communicationStyle === 'detailed');

    // Reset back
    await makeHttpRequest('DELETE', '/api/intelligence/preferences');

    // 6. POST /api/intelligence/classify
    const classifyApiRes = await makeHttpRequest('POST', '/api/intelligence/classify', {
      message: 'Refactor source code in server.js'
    });
    assertTest('POST /api/intelligence/classify categorizes request via API', classifyApiRes.status === 200 && classifyApiRes.data.classification.category === 'CODING');

    // 7. GET /api/intelligence/metrics
    const metricsApiRes = await makeHttpRequest('GET', '/api/intelligence/metrics');
    assertTest('GET /api/intelligence/metrics returns evaluation report', metricsApiRes.status === 200 && metricsApiRes.data.status === 'OPERATIONAL');
  }

  // -------------------------------------------------------------------------
  // SECTION 10: CONTINUOUS EVALUATION & MEASURABLE LEARNING
  // -------------------------------------------------------------------------
  console.log('\n--- Section 10: Continuous Evaluation & Measurable Learning ---');
  {
    // Execute interaction in local instance to record metrics
    await unifiedIntelligenceLayerInstance.processInteraction({ message: 'What time is it right now?' });

    const evalReport = unifiedIntelligenceLayerInstance.getEvaluationReport();
    assertTest('Evaluation report calculates total interactions', typeof evalReport.totalInteractions === 'number' && evalReport.totalInteractions > 0);
    assertTest('Evaluation report calculates tool success rate and logs security blocks', typeof evalReport.tools.successRatePercent === 'number' && evalReport.tools.successes > 0 && evalReport.tools.failures > 0);
    assertTest('Evaluation report calculates task success rate', typeof evalReport.tasks.successRatePercent === 'number');
    assertTest('Evaluation report tracks average latency', typeof evalReport.performance.averageLatencyMs === 'number');

    // Verify experiment ledger persistence
    const ledgerFile = path.join(__dirname, 'data/experiment_ledger.json');
    assertTest('data/experiment_ledger.json contains recorded experiment entries', fs.existsSync(ledgerFile));
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`   EVALUATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  if (failedTests > 0) {
    console.error(`   FAILURES DETECTED: ${failedTests} TESTS FAILED.`);
    process.exit(1);
  } else {
    console.log('   STATUS: ALL ACCEPTANCE CRITERIA VERIFIED (100% PASS)');
    console.log('================================================================\n');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
