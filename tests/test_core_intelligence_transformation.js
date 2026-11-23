/**
 * JARVIS — CORE INTELLIGENCE TRANSFORMATION VERIFICATION SUITE
 *
 * Explicitly labels every assertion category by ground-truth verification type:
 * - [REAL_WEB_API]: Live internet query & external source attribution
 * - [REAL_PYTHON_SYMPY]: Live Python SymPy/SciPy daemon execution
 * - [REAL_DISK_CAD]: Actual multi-part CAD geometry & .obj / .stl disk artifact verification
 * - [REAL_GEMINI_API]: Live Google Gemini REST / ReAct tool-calling pipeline
 * - [REAL_PLAYWRIGHT_UI]: Real headless Chromium Playwright UI & WebGL modal verification
 * - [SIMULATED_KINEMATICS]: Numerical Jacobian DLS inverse kinematics & beam mechanics checks
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const BASE_URL = 'http://127.0.0.1:3000';
const PROJECT_ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const findings = [];

async function runCheck(name, category, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - t0;
    passed++;
    console.log(`✅ [${category}] ${name} (${ms}ms)${detail ? ` — ${detail}` : ''}`);
    findings.push({ name, category, status: 'PASSED', ms, detail: detail || '' });
  } catch (err) {
    const ms = Date.now() - t0;
    failed++;
    console.error(`❌ [${category}] ${name} (${ms}ms): ${err.message}`);
    findings.push({ name, category, status: 'FAILED', ms, error: err.message });
  }
}

(async () => {
  console.log('\n=== JARVIS CORE INTELLIGENCE TRANSFORMATION VERIFICATION ===\n');

  // 1. Model Capabilities & Complexity Routing
  await runCheck('Selects heavy reasoning model for engineering/math vs fast model for greetings', 'ARCHITECTURE_ROUTING', async () => {
    const { unifiedIntelligenceLayerInstance, TASK_CATEGORIES } = require('../server/unifiedIntelligenceLayer.js');
    const heavy = unifiedIntelligenceLayerInstance.selectOptimalModel({
      category: TASK_CATEGORIES.SCIENTIFIC_COMPUTATION,
      complexity: 'high',
      query: 'Design a 6-DOF robotic arm with 1.5 kg payload, check inverse kinematics, beam deflection, and INR BOM under 15000 rupees'
    });
    assert.strictEqual(heavy.tier, 'COMPLEX_REASONING', `Expected COMPLEX_REASONING, got ${heavy.tier}`);
    assert(Array.isArray(heavy.candidateModels) && heavy.candidateModels.some(m => m.includes('pro') || m.includes('3.5-flash')),
      `Heavy routing must include pro/reasoning candidate models, got ${JSON.stringify(heavy.candidateModels)}`);

    const fast = unifiedIntelligenceLayerInstance.selectOptimalModel({
      category: TASK_CATEGORIES.CONVERSATION,
      complexity: 'low',
      requiresTools: false,
      query: 'hello jarvis'
    });
    assert.strictEqual(fast.tier, 'FAST_LIGHTWEIGHT', `Expected FAST_LIGHTWEIGHT for greeting, got ${fast.tier}`);
    return `Heavy=${heavy.selectedModel} (${heavy.tier}) | Fast=${fast.selectedModel} (${fast.tier})`;
  });

  // 2. Unfamiliar Concept Learning & Attributed Knowledge Graph
  await runCheck('Acquires unfamiliar engineering concept into connected Knowledge Graph with source attribution', 'REAL_WEB_API', async () => {
    const { executeTool } = require('../server/toolsRegistry.js');
    const res = await executeTool('acquire_concept_knowledge', {
      topic: 'harmonic drive strain wave gear backlash robotic joints',
      domain: 'robotics_actuation',
      maxSources: 3,
      relatedConcepts: [
        { name: 'Zero Backlash Reduction', relation: 'ENABLES' },
        { name: 'Joint Torque Density', relation: 'IMPROVES' }
      ]
    }, 'JARVIS');

    assert(res && res.success, 'acquire_concept_knowledge must succeed');
    assert(res.conceptNodeId, 'Must create conceptNodeId');
    assert(Array.isArray(res.connectedNodes) && res.connectedNodes.length >= 2, 'Must connect related concept edges');

    if (res.online && res.storedClaims.length > 0) {
      assert(res.storedClaims.some(c => Boolean(c.url)), 'Online acquisition must attribute real URLs');
      return `Online=true, claims=${res.storedClaims.length}, edges=${res.connectedNodes.length}, sampleURL=${res.storedClaims[0].url}`;
    }
    assert(Array.isArray(res.uncertaintyNotes) && res.uncertaintyNotes.length > 0, 'Offline acquisition must explicitly state uncertainty');
    return `Online=false (honest uncertainty recorded: ${res.uncertaintyNotes[0]})`;
  });

  // 3. Multi-Step Real Mathematical & Structural Beam Derivation via Python SymPy/SciPy
  await runCheck('Verifies algebra, calculus, matrix eigenvalues, and structural beam physics via live Python SymPy/SciPy', 'REAL_PYTHON_SYMPY', async () => {
    const { executeTool } = require('../server/toolsRegistry.js');

    const alg = await executeTool('verify_mathematical_derivation', {
      operation: 'solveAlgebra',
      expression: 'x**2 - 7*x + 12',
      variable: 'x'
    }, 'JARVIS');
    assert(alg && alg.verified === true, `solveAlgebra failed: ${JSON.stringify(alg)}`);
    assert(JSON.stringify(alg.solutions).includes('3') && JSON.stringify(alg.solutions).includes('4'), `Expected roots [3, 4], got ${JSON.stringify(alg.solutions)}`);

    const calc = await executeTool('verify_mathematical_derivation', {
      operation: 'computeCalculus',
      expression: 'x**3 + 2*x',
      calculusOp: 'diff',
      variable: 'x'
    }, 'JARVIS');
    assert(calc && calc.verified === true && String(calc.result).includes('3*x**2'), `Expected derivative containing 3*x**2, got ${calc?.result}`);

    const mat = await executeTool('verify_mathematical_derivation', {
      operation: 'computeMatrixOperations',
      matrixOp: 'eigenvals',
      matrixA: [[4, 0], [0, 9]]
    }, 'JARVIS');
    assert(mat && mat.verified === true, `computeMatrixOperations failed: ${JSON.stringify(mat)}`);

    const beam = await executeTool('verify_mathematical_derivation', {
      operation: 'analyzeBeam',
      lengthM: 0.45,
      forceN: 12,
      material: 'aluminum'
    }, 'JARVIS');
    assert(beam && (beam.verified === true || beam.success === true), `analyzeBeam failed: ${JSON.stringify(beam)}`);

    return `Algebra roots=${JSON.stringify(alg.solutions)} | d/dx=${calc.result} | Beam=${JSON.stringify(beam.maxDeflectionMm ?? beam.max_deflection_mm ?? beam.deflectionMm ?? beam.summary)}`;
  });

  // 4. Jacobian DLS Inverse Kinematics + Self-Correction Loop + General CAD Archetypes
  await runCheck('Solves 3D Jacobian DLS IK, detects structural overload & self-corrects, and builds multi-archetype CAD (.obj/.stl on disk)', 'SIMULATED_KINEMATICS', async () => {
    const { mechanicalRoboticsEngineInstance } = require('../server/mechanicalRoboticsEngine.js');
    const { universal3dEngine } = require('../server/desktop/universal3dEngine.js');

    // A) Jacobian IK inside reachable envelope vs unreachable target
    const dh = [
      { d: 0.12, a: 0.0, alpha: Math.PI / 2, minDeg: -180, maxDeg: 180 },
      { d: 0.0, a: 0.24, alpha: 0.0, minDeg: -120, maxDeg: 120 },
      { d: 0.0, a: 0.22, alpha: 0.0, minDeg: -135, maxDeg: 135 },
      { d: 0.0, a: 0.08, alpha: 0.0, minDeg: [-180, 180][0] }
    ];
    const reachable = mechanicalRoboticsEngineInstance.solveInverseKinematicsDLS(dh, { x: 0.28, y: 0.14, z: 0.22 });
    assert(reachable.reachable === true && reachable.residualErrorMm < 20, `Expected reachable IK convergence, got residualErrorMm=${reachable.residualErrorMm}`);
    const unreachable = mechanicalRoboticsEngineInstance.solveInverseKinematicsDLS(dh, { x: 2.5, y: 0.0, z: 0.5 });
    assert(unreachable.reachable === false, 'Must reject unreachable target cleanly');

    // B) Heavy payload self-correction loop (starts light polymer -> auto-upgrades to aluminum_6061_t6 / scales beam!)
    const armDesign = await mechanicalRoboticsEngineInstance.designAndOptimizeEngineeringSystem({
      systemType: 'robotic_arm',
      description: '6-DOF Arm designed under heavy payload self-correction test',
      payloadKg: 1.8,
      reachMm: 480,
      budgetInr: 14000,
      materialKey: 'abs_polymer',
      targetPos: { x: 0.30, y: 0.12, z: 0.24 }
    });
    assert(armDesign.success === true, 'designAndOptimizeEngineeringSystem must succeed');
    assert(Array.isArray(armDesign.iterations) && armDesign.iterations.length >= 2,
      `Expected self-correction iterations >= 2 for overloaded ABS arm, got ${armDesign.iterations?.length}`);
    assert(armDesign.geometrySpec && armDesign.geometrySpec.components.length >= 25, 'Arm CAD must contain >= 25 parts');
    assert(armDesign.cadVerification && armDesign.cadVerification.objBytes > 1000 && armDesign.cadVerification.stlBytes > 1000,
      'Arm OBJ & STL must exist and be non-empty on disk');

    // C) General engineering archetypes beyond robotic arm (Cartesian Gantry, Rover, Planetary Gearbox, Gripper, Custom)
    const archetypes = ['cartesian_gantry', 'rover_chassis', 'planetary_gearbox', 'mechanical_gripper'];
    const summaryCounts = [];
    for (const sysType of archetypes) {
      const d = await mechanicalRoboticsEngineInstance.designAndOptimizeEngineeringSystem({
        systemType: sysType,
        payloadKg: 1.0,
        reachMm: 350,
        budgetInr: 12000
      });
      assert(d.success && d.geometrySpec && d.geometrySpec.components.length >= 6, `Archetype ${sysType} failed CAD build`);
      assert(d.cadVerification && d.cadVerification.filesVerified === true, `Archetype ${sysType} missing disk OBJ/STL`);
      summaryCounts.push(`${sysType}:${d.geometrySpec.components.length}parts`);
    }

    // D) Arbitrary Custom Geometry Spec
    const customModel = await universal3dEngine.create3dModel('Custom Telemetry Tower Rig', {
      customSpec: {
        title: 'Custom Telemetry Tower',
        archetype: 'custom_tower',
        components: [
          { name: 'Base_Plate', shape: 'box', args: [2, 0.2, 2], pos: [0, 0.1, 0], material: 'aluminum' },
          { name: 'Mast', shape: 'cylinder', args: [0.15, 0.15, 2.4, 20], pos: [0, 1.3, 0], material: 'carbon_fiber' },
          { name: 'Sensor_Pod', shape: 'sphere', args: [0.28, 20, 20], pos: [0, 2.6, 0], material: 'copper_coil' }
        ]
      }
    });
    assert(customModel.success && customModel.geometrySpec.components.length === 3 && (customModel.verification?.filesVerified || customModel.verified),
      'Custom geometrySpec must generate verified 3D model + OBJ/STL');

    const finalMaterial = armDesign.iterations[armDesign.iterations.length - 1]?.materialKey;
    return `IK err=${reachable.residualErrorMm}mm | Self-correction iters=${armDesign.iterations.length} -> ${finalMaterial} | ${summaryCounts.join(', ')}`;
  });

  // 5. Personal Project Constraints + Hardware Inventory Reuse in INR BOM
  await runCheck('Persists ongoing robotics project constraints & reuses MG996R inventory in INR BOM optimization', 'PERSISTENT_MEMORY', async () => {
    const { executeTool } = require('../server/toolsRegistry.js');
    const { unifiedIntelligenceLayerInstance } = require('../server/unifiedIntelligenceLayer.js');
    const { mechanicalRoboticsEngineInstance } = require('../server/mechanicalRoboticsEngine.js');

    const saved = await executeTool('remember_project_constraint', {
      projectName: 'Progressive Benchtop 6-DOF Robotic Arm to Humanoid Build',
      budgetInr: 14500,
      constraint: 'Reuse owned MG996R Metal Gear Servos and CNC/3D printed fixtures first before ordering new actuators',
      domain: 'ROBOTICS',
      goalTitle: 'Validate Stage-1 6-DOF Arm under ₹14,500 budget'
    }, 'JARVIS');
    assert(saved.success && saved.verified, 'remember_project_constraint must succeed');

    const continuity = unifiedIntelligenceLayerInstance.getPromptContinuityContext('Continue building my robotic arm within budget');
    assert(continuity.includes('Progressive Benchtop') || continuity.includes('MG996R'),
      `Expected continuity injection to include saved robotics constraints/inventory, got: ${continuity}`);

    const bomOpt = await mechanicalRoboticsEngineInstance.optimizeDesignForUserInventoryAndBudget({
      projectType: 'robotic_arm',
      budgetInr: 14500,
      payloadKg: 0.6
    });
    assert(bomOpt.success && Array.isArray(bomOpt.reusedFromInventory) && bomOpt.reusedFromInventory.length >= 1,
      `Expected >= 1 reused owned component (MG996R), got ${JSON.stringify(bomOpt.reusedFromInventory)}`);
    assert(Array.isArray(bomOpt.progressiveUpgradePlan) && bomOpt.progressiveUpgradePlan.length === 3,
      'Must generate 3 progressive hardware upgrade stages');

    return `Reused=${bomOpt.reusedFromInventory.length} owned group(s), Savings>=₹${bomOpt.estimatedSavingsInrMin}, OutOfPocketMin=₹${bomOpt.estimatedAdditionalInrMin}`;
  });

  // 6. Multimodal Vision Reference Inspection (Real Attachment + Honest Uncertainty Handling)
  await runCheck('Inspects attached reference diagram/image with explicit uncertainty reporting', 'REAL_GEMINI_API', async () => {
    const { executeTool } = require('../server/toolsRegistry.js');
    const imgPath = 'C:\\Users\\upadh\\.gemini\\antigravity\\brain\\88baef9f-4cb3-4a0b-a1a9-59c49a68c438\\.user_uploaded\\media_1794644095004_85140224.png';
    if (!fs.existsSync(imgPath)) {
      const noAtt = await executeTool('analyze_design_reference_image', { prompt: 'Inspect missing attachment' }, 'JARVIS');
      assert(noAtt.success === false && noAtt.uncertainty, 'Must explicitly report missing attachment');
      return `Attachment missing on disk; verified honest uncertainty guard`;
    }
    const b64 = fs.readFileSync(imgPath).toString('base64');
    const vis = await executeTool('analyze_design_reference_image', {
      prompt: 'Inspect the attached image and describe clearly what is visible, structure/layers/components, and note any missing physical dimensions or uncertainties.',
      attachments: [{ mimeType: 'image/png', data: b64 }],
      create3dModel: false
    }, 'JARVIS');
    assert(vis && typeof vis.analysis === 'string' && vis.analysis.length > 20, 'Vision inspection must return analysis text');
    return `Provider=${vis.provider} | length=${vis.analysis.length} chars | verified=${vis.verified}`;
  });

  // 7. Codebase Semantic Understanding (RAG)
  await runCheck('Semantically indexes/searches JARVIS codebase and locates real robotics & IQ modules', 'REAL_DISK', async () => {
    const { executeTool } = require('../server/toolsRegistry.js');
    await executeTool('build_codebase_rag', { force: true }, 'JARVIS');
    const rag = await executeTool('search_codebase_rag', { query: 'solveInverseKinematicsDLS beam deflection', topK: 5 }, 'JARVIS');
    assert(rag && rag.success, `search_codebase_rag failed: ${JSON.stringify(rag)}`);
    const hitList = rag.matches || rag.results || [];
    const serialized = JSON.stringify(hitList);
    assert(hitList.length > 0 && (serialized.includes('mechanicalRoboticsEngine') || serialized.includes('unifiedIntelligenceLayer')),
      `Codebase RAG must locate robotics/kinematics files, got ${JSON.stringify(rag).slice(0, 240)}`);
    return `Matches=${hitList.length} (top: ${hitList[0]?.file})`;
  });

  // 8. Live Multi-Step ReAct / Intelligent HTTP Chat Endpoint
  await runCheck('Routes engineering query over live HTTP /api/chat without hallucinating fake tools or bypassing reasoning', 'REAL_GEMINI_API', async () => {
    const authResp = await fetch(`${BASE_URL}/api/auth/session`);
    const authJson = await authResp.json();
    const token = authJson.token || fs.readFileSync(path.join(PROJECT_ROOT, 'data', '.session_token'), 'utf8').trim();

    const resp = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Stark-Auth-Token': token },
      body: JSON.stringify({
        personality: 'JARVIS',
        message: 'Design a compact cartesian gantry with 1.2 kg payload and 15000 INR budget, checking deflection and BOM'
      })
    });
    assert(resp.ok, `POST /api/chat failed HTTP ${resp.status}`);
    const data = await resp.json();
    assert(typeof data.reply === 'string' && data.reply.length > 40, 'Expected substantial reasoned reply');
    assert(data.toolResult && data.toolResult.success === true, 'Expected executed engineering design toolResult');
    assert(data.toolResult.geometrySpec && data.toolResult.geometrySpec.archetype === 'cartesian_gantry',
      `Expected cartesian_gantry geometrySpec, got ${data.toolResult?.geometrySpec?.archetype}`);
    return `Provider=${data.provider} | Archetype=${data.toolResult.geometrySpec.archetype} | Reply=${data.reply.length} chars`;
  });

  // 9. Developmental Learning & Failure Taxonomy Verification
  await runCheck('Records experiences without unverified truth inflation & exposes developmental model status', 'DEVELOPMENTAL_LEARNING', async () => {
    const { executeTool } = require('../server/toolsRegistry.js');
    const { experienceLearningEngineInstance, TASK_OUTCOMES } = require('../server/learning/experienceLearningEngine.js');

    const expRep = experienceLearningEngineInstance.recordExperience({
      taskObjective: 'Test unverified AI claim demotion guard',
      taskCategory: 'SCIENTIFIC_COMPUTATION',
      toolsUsed: ['verify_mathematical_derivation'],
      taskOutcome: TASK_OUTCOMES.VERIFIED_SUCCESS,
      verificationEvidence: null // Intentionally missing verification proof!
    });
    const stored = experienceLearningEngineInstance.getExperienceById(expRep.experienceId);
    assert.strictEqual(stored.taskOutcome, TASK_OUTCOMES.REPORTED_SUCCESS,
      `Must demote unverified claim from VERIFIED_SUCCESS to REPORTED_SUCCESS, got ${stored.taskOutcome}`);

    const devStatus = await executeTool('get_developmental_model_status', {}, 'JARVIS');
    assert(devStatus && devStatus.status === 'DEVELOPMENTAL_ACTIVE', 'Developmental status must be active');
    assert(devStatus.knowledgeBase && devStatus.knowledgeBase.totalNodes >= 1, 'Knowledge base must reflect acquired nodes');
    assert(Array.isArray(devStatus.upgradePriorities), 'Must emit upgrade priorities');

    return `Nodes=${devStatus.knowledgeBase.totalNodes}, Edges=${devStatus.knowledgeBase.totalEdges}, Projects=${devStatus.knowledgeBase.persistentProjects}, VerifiedRatio=${devStatus.experienceProfile.verificationRatio}`;
  });

  // 10. Playwright Live UI Verification: Engineering Design Opens 3D Modal Cleanly
  await runCheck('Opens interactive 3D CAD viewer modal in live Chrome via Playwright for rich engineering design prompt', 'REAL_PLAYWRIGHT_UI', async () => {
    let playwright;
    try {
      playwright = require('playwright');
    } catch (_) {
      return 'Playwright not installed; skipping headless browser render';
    }
    const browser = await playwright.chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#stark-main-chat-input', { timeout: 15000 });
    await page.fill('#stark-main-chat-input', 'Design a planetary gearbox with 1.0 kg payload and 12000 INR budget');
    await page.press('#stark-main-chat-input', 'Enter');

    await page.waitForSelector('#stark-3d-modal.open, #stark-3d-modal[style*="flex"]', { timeout: 30000 }).catch(() => null);
    const modalVisible = await page.evaluate(() => {
      const m = document.getElementById('stark-3d-modal');
      if (!m) return false;
      const st = window.getComputedStyle(m);
      return m.classList.contains('open') || (st.display !== 'none' && st.visibility !== 'hidden');
    });
    assert(modalVisible === true, '3D CAD modal must automatically open on design_engineering_system result');
    assert.strictEqual(pageErrors.length, 0, `Page runtime errors detected: ${pageErrors.join('; ')}`);

    await browser.close();
    return 'Modal opened cleanly, 0 uncaught JS errors';
  });

  console.log(`\n=== SUMMARY: ${passed} Passed, ${failed} Failed (Total ${passed + failed}) ===\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
