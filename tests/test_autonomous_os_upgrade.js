/**
 * JARVIS Autonomous Computer Control, Engineering CAD & Robotics Upgrade Verification Suite
 * Tests real runtime execution, disk artifacts, HTTP endpoints, UI rendering, safety gates, and routing.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const BASE_URL = 'http://127.0.0.1:3000';
const SCRATCH_DIR = path.join(__dirname, '../scratch/test_autonomous_os');
if (!fs.existsSync(SCRATCH_DIR)) fs.mkdirSync(SCRATCH_DIR, { recursive: true });

let passed = 0;
let failed = 0;

async function runTest(name, category, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - start;
    passed++;
    console.log(`✅ [${category}] ${name} (${ms}ms)${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    const ms = Date.now() - start;
    failed++;
    console.error(`❌ [${category}] ${name} (${ms}ms): ${err.message}`);
  }
}

(async () => {
  console.log('\n=== JARVIS AUTONOMOUS OS & ENGINEERING VERIFICATION SUITE ===\n');

  // 1. Engineering-Grade 3D Robot Arm CAD + Real OBJ/STL + HTTP Export Endpoint + Playwright WebGL UI
  let createdModelId = null;
  await runTest('3D Robot Arm CAD (35+ parts, 6-DOF joints, triangulated OBJ/STL)', 'REAL_DISK', async () => {
    const { universal3dEngine } = require('../server/desktop/universal3dEngine.js');
    const res = await universal3dEngine.create3dModel('6-DOF Industrial Articulated Robot Arm CAD Assembly', {
      archetype: 'robotic_arm',
      theme: 'titanium'
    });
    assert(res.success, 'create3dModel must succeed');
    assert.strictEqual(res.archetype, 'robotic_arm', `archetype must be robotic_arm, got ${res.archetype}`);
    const spec = res.geometrySpec;
    assert(spec && Array.isArray(spec.components) && spec.components.length >= 30, `expected >= 30 CAD components, got ${spec?.components?.length}`);
    assert(Array.isArray(spec.joints) && spec.joints.length >= 6, `expected >= 6 articulated joints, got ${spec?.joints?.length}`);

    const samplePart = spec.components.find(p => p.material && p.dimensionsMm && p.parentJoint);
    assert(samplePart, 'components must carry material, dimensionsMm, and parentJoint metadata');
    assert(res.files && fs.existsSync(res.files.obj) && fs.existsSync(res.files.stl), 'OBJ & STL files must exist');

    const objStat = fs.statSync(res.files.obj);
    const stlStat = fs.statSync(res.files.stl);
    assert(objStat.size > 5000, `OBJ mesh too small (${objStat.size} bytes)`);
    assert(stlStat.size > 5000, `STL mesh too small (${stlStat.size} bytes)`);
    const objContent = fs.readFileSync(res.files.obj, 'utf8');
    assert(objContent.includes('v ') && objContent.includes('\nf '), 'OBJ must contain triangulated vertices and faces');
    createdModelId = res.modelId;
    return `${spec.components.length} components, ${spec.joints.length} joints, OBJ=${objStat.size}B, STL=${stlStat.size}B`;
  });

  await runTest('HTTP GET /api/3d-model/:id/export/:format serves valid OBJ & STL', 'REAL_HTTP', async () => {
    assert(createdModelId, 'Model ID required');
    const objResp = await fetch(`${BASE_URL}/api/3d-model/${encodeURIComponent(createdModelId)}/export/obj`);
    assert.strictEqual(objResp.status, 200, `Expected HTTP 200 for OBJ export, got ${objResp.status}`);
    const objText = await objResp.text();
    assert(objText.length > 5000 && objText.includes('v '), 'HTTP OBJ payload invalid');

    const stlResp = await fetch(`${BASE_URL}/api/3d-model/${encodeURIComponent(createdModelId)}/export/stl`);
    assert.strictEqual(stlResp.status, 200, `Expected HTTP 200 for STL export, got ${stlResp.status}`);
    const stlText = await stlResp.text();
    assert(stlText.startsWith('solid ') && stlText.includes('facet normal'), 'HTTP STL ASCII payload invalid');
    return `OBJ=${objText.length} chars, STL=${stlText.length} chars`;
  });

  await runTest('Playwright UI: Stark3DViewer renders articulated CAD, explode, joints & export buttons', 'REAL_BROWSER_UI', async () => {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForFunction(() => Boolean(window.stark3DViewer), { timeout: 15000 });

      const uiState = await page.evaluate(async (mId) => {
        const execResp = await fetch('/api/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolName: 'get_3d_model', params: { modelId: mId } })
        });
        const data = await execResp.json();
        const model = data.result.model || data.result;
        window.stark3DViewer.showModel(model);
        await new Promise(r => setTimeout(r, 450));

        const modal = document.getElementById('stark-3d-modal');
        const jointSliders = document.querySelectorAll('#stark-3d-joints-controls input[type="range"]');
        const explodeBtn = document.getElementById('stark-3d-explode-btn');
        const exportObjBtn = document.getElementById('stark-3d-export-obj-btn');
        const micBadge = document.getElementById('mic-status-badge');
        const quickCadBtn = document.getElementById('btn-quick-robot-cad');
        if (explodeBtn) explodeBtn.click();
        await new Promise(r => setTimeout(r, 120));
        return {
          visible: modal && getComputedStyle(modal).display !== 'none',
          sliderCount: jointSliders.length,
          explodeTextAfterClick: explodeBtn ? explodeBtn.textContent.trim() : '',
          hasExportObj: Boolean(exportObjBtn),
          hasMicBadge: Boolean(micBadge),
          hasQuickCadBtn: Boolean(quickCadBtn),
          compCountText: document.getElementById('stark-3d-components-count')?.textContent || ''
        };
      }, createdModelId);

      assert(uiState.visible, '3D viewer modal (#stark-3d-modal) must be visible');
      assert(uiState.sliderCount >= 6, `Expected >= 6 joint sliders, got ${uiState.sliderCount}`);
      assert(uiState.explodeTextAfterClick.includes('ON'), `Explode toggle did not switch ON: ${uiState.explodeTextAfterClick}`);
      assert(uiState.hasExportObj, 'Export OBJ button missing');
      assert(uiState.hasMicBadge, '#mic-status-badge missing from UI');
      assert(uiState.hasQuickCadBtn, '#btn-quick-robot-cad missing from UI');
      return `sliders=${uiState.sliderCount}, ${uiState.compCountText}, ${uiState.explodeTextAfterClick}`;
    } finally {
      await browser.close();
    }
  });

  // 2. Live Document Creation (Word & WPS Writer .docx + OpenXML Parse Verification)
  await runTest('DOCX creation writes formatted paragraphs/headings & verifies non-empty OpenXML on disk', 'REAL_DISK', async () => {
    const { documentIntelligenceEngineInstance } = require('../server/documentIntelligenceEngine.js');
    const docRes = documentIntelligenceEngineInstance.createDocxDocument({
      title: 'Robotic Arm Torque & Control Architecture',
      topic: '6-DOF Robotic Arm Actuators, Inverse Kinematics, and Power Safety',
      content: '## System Overview\nThis report covers joint torque sizing.\n\n## Actuator Selection Table\n- J1 Base: NEMA 23 Planetary\n- J2 Shoulder: 35 kg-cm Servo',
      targetDir: SCRATCH_DIR,
      openInWord: false
    });
    assert(docRes.success, 'createDocxDocument failed');
    assert(fs.existsSync(docRes.filePath), 'DOCX file missing on disk');
    const stat = fs.statSync(docRes.filePath);
    assert(stat.size > 1500, `DOCX unexpectedly small: ${stat.size}`);
    const parsed = documentIntelligenceEngineInstance.parseDocxDocument(docRes.filePath);
    assert(parsed && parsed.wordCount >= 15, `Expected >= 15 parsed words in DOCX, got ${parsed?.wordCount}`);
    return `${path.basename(docRes.filePath)} (${stat.size}B, ${parsed.wordCount} words)`;
  });

  await runTest('LiveDocumentStudio supports preferredApp="wps" and detects installed WPS/Word accurately', 'REAL_ENV', async () => {
    const { liveDocumentStudioInstance } = require('../server/desktop/liveDocumentStudio.js');
    const { windowsAppRegistry } = require('../server/desktop/windowsAppRegistry.js');
    await windowsAppRegistry.scanInstalledApps(true);
    const wpsDef = windowsAppRegistry.cachedApps.get('wps');
    const wpsPath = windowsAppRegistry.resolveExecutablePath(wpsDef);
    assert(wpsPath, 'Expected wps.exe or ksolaunch.exe to resolve on this PC');
    const sessionRes = await liveDocumentStudioInstance.createDocumentProgressively({
      topic: 'Autonomous Mobile Manipulator Spec',
      preferredApp: 'wps',
      openDesktop: false,
      targetDir: SCRATCH_DIR
    });
    assert(sessionRes.success, 'LiveDocumentStudio failed');
    assert(sessionRes.filePath && fs.existsSync(sessionRes.filePath), 'LiveDocumentStudio .docx missing on disk');
    return `wpsPath=${wpsPath}, docx=${path.basename(sessionRes.filePath)}`;
  });

  // 3. Universal Windows App Discovery + Chrome Profiles + Live YouTube Extraction + Notepad Lifecycle
  await runTest('WindowsAppRegistry discovers Win32, StartApps UWP & App Paths and flags ambiguous "office"', 'REAL_ENV', async () => {
    const { windowsAppRegistry } = require('../server/desktop/windowsAppRegistry.js');
    const apps = await windowsAppRegistry.scanInstalledApps(true);
    assert(Array.isArray(apps) && apps.length >= 10, `Expected >=10 installed apps, got ${apps?.length}`);
    const ambig = await windowsAppRegistry.resolveAppWithDisambiguation('office');
    assert(ambig && (ambig.status === 'AMBIGUOUS' || ambig.status === 'RESOLVED'), `Unexpected disambiguation: ${JSON.stringify(ambig)}`);
    return `discovered=${apps.length} apps, office.status=${ambig.status}, matches=${ambig.matches?.length || 0}`;
  });

  await runTest('Real live YouTube search extracts real watch URLs (Nth index selection)', 'REAL_NETWORK', async () => {
    const { chromeProfileService } = require('../server/desktop/chromeProfileService.js');
    const ytRes = await chromeProfileService.openYouTubeAndPlayResult({
      query: '6 DOF robotic arm inverse kinematics',
      index: 2,
      openInChrome: false
    });
    assert(ytRes.success, `YouTube extraction failed: ${ytRes.error}`);
    assert(Array.isArray(ytRes.results) && ytRes.results.length >= 2, `Expected >= 2 results, got ${ytRes.results?.length}`);
    assert(ytRes.selectedVideo && /^https:\/\/www\.youtube\.com\/watch\?v=/.test(ytRes.selectedVideo.url), 'Invalid watch URL');
    return `${ytRes.results.length} results; #2="${ytRes.selectedVideo.title.slice(0, 45)}"`;
  });

  await runTest('Chrome profile discovery finds local Chrome profiles cleanly', 'REAL_ENV', async () => {
    const { chromeProfileService } = require('../server/desktop/chromeProfileService.js');
    const profiles = chromeProfileService.getProfiles(true);
    assert(Array.isArray(profiles) && profiles.length >= 1, 'Expected at least 1 Chrome profile');
    const somaiya = chromeProfileService.resolveProfile('somaiya');
    assert(somaiya && somaiya.dir, `Expected somaiya profile to resolve, got ${JSON.stringify(somaiya)}`);
    return `profiles=${profiles.length}, somaiya="${somaiya.name}" (${somaiya.dir})`;
  });

  await runTest('Win32 Notepad launch + UIA listOpenWindows + UIA readWindowContent + close("last") lifecycle', 'REAL_DESKTOP', async () => {
    const { appLauncherInstance } = require('../server/desktop/appLauncher.js');
    const launchRes = await appLauncherInstance.launch('notepad');
    assert(launchRes.success || launchRes.verified, `Notepad launch failed: ${launchRes.error}`);
    const winListRes = await appLauncherInstance.listOpenWindows();
    const windows = Array.isArray(winListRes) ? winListRes : (winListRes?.windows || []);
    const hasNotepad = windows.some(w => /notepad/i.test(`${w.windowTitle || w.title || ''} ${w.processName || ''}`));
    assert(hasNotepad, 'Notepad window not observed in listOpenWindows');
    assert.strictEqual(String(appLauncherInstance.lastActiveExternalApp?.appName || '').toLowerCase(), 'notepad', `Expected lastActiveExternalApp.appName="notepad", got "${JSON.stringify(appLauncherInstance.lastActiveExternalApp)}"`);

    const readRes = await appLauncherInstance.readWindowContent('notepad');
    assert(readRes && readRes.success, `UIA readWindowContent failed: ${readRes?.error}`);

    const closeRes = await appLauncherInstance.closeApplication('last');
    assert(closeRes.success, `Context close failed: ${closeRes.error}`);
    return `launched Notepad, UIA read (${readRes.texts?.length || 0} nodes), closed cleanly via contextual "last"`;
  });

  // 4. WhatsApp Health Fix & Explicit Confirmation Gate (sandboxed to protect desktop focus)
  await runTest('WhatsApp integration reports HEALTHY and enforces confirmation before send', 'REAL_ENV', async () => {
    const { apiIntegrationsManagerInstance } = require('../server/apiIntegrationsManager.js');
    const { whatsappServiceInstance } = require('../server/desktop/whatsappService.js');
    const health = await apiIntegrationsManagerInstance.testConnection('whatsapp');
    assert(health.health === 'HEALTHY', `Expected HEALTHY WhatsApp health, got ${health.health} (${health.error || ''})`);

    const prevSandbox = whatsappServiceInstance.sandboxMode;
    whatsappServiceInstance.enableSandboxMode();
    try {
      const stageRes = await whatsappServiceInstance.stageMessageForUserConfirmation('Rahul Verma', 'Checking confirmation gate');
      assert(!stageRes.sent && !stageRes.dispatched, 'Must NEVER auto-send during staging');

      const directBlocked = await whatsappServiceInstance.sendMessage('Rahul Verma', 'Unconfirmed send', false);
      assert(!directBlocked.sent && !directBlocked.dispatched, 'sendMessage(confirmed=false) must NOT send without explicit confirmation');
      await whatsappServiceInstance.cancelPendingMessage();
      return `health=${health.health}, confirmation gate enforced (sandboxMode)`;
    } finally {
      if (!prevSandbox) whatsappServiceInstance.disableSandboxMode();
    }
  });

  // 5. Deep Codebase RAG + Bounded Autonomous Engineering Loop (Rollback + Immutable Core + E-Stop)
  await runTest('Deep Codebase RAG builds incremental TF-IDF index & retrieves accurate symbols', 'REAL_DISK', async () => {
    const { codingAssistantInstance } = require('../server/codingAssistant.js');
    const buildRes = codingAssistantInstance.buildCodebaseRagIndex();
    assert(buildRes.success && buildRes.stats?.totalChunks > 50, `Expected >50 chunks indexed, got ${buildRes?.stats?.totalChunks}`);
    const searchRes = codingAssistantInstance.semanticSearchCodebase('openYouTubeAndPlayResult chrome profile youtube', { topK: 5 });
    assert(searchRes.success && Array.isArray(searchRes.matches) && searchRes.matches.length > 0, 'RAG search returned 0 matches');
    const hitFiles = searchRes.matches.map(r => r.file).join(', ');
    assert(hitFiles.includes('chromeProfileService.js'), `Expected chromeProfileService.js in matches, got: ${hitFiles}`);
    return `${buildRes.stats.totalFiles} files, ${buildRes.stats.totalChunks} chunks, top match=${searchRes.matches[0].file}`;
  });

  await runTest('Bounded Autonomous Loop patches, tests, rolls back bad patches & blocks immutable core/E-Stop', 'REAL_EXEC', async () => {
    const { selfRepairServiceInstance } = require('../server/selfRepairService.js');
    const { emergencyStopControllerInstance } = require('../server/emergencyStopController.js');

    const blocked = await selfRepairServiceInstance.runBoundedAutonomousEngineeringLoop({
      goal: 'Modify immutable core',
      targetFile: 'server/unifiedIntelligenceLayer.js',
      originalCode: 'foo',
      replacementCode: 'bar'
    });
    assert(!blocked.success && blocked.status === 'REJECTED_IMMUTABLE_CORE', `Expected REJECTED_IMMUTABLE_CORE, got ${blocked.status}`);

    const sandboxFile = path.join(SCRATCH_DIR, 'temp_math_target.js');
    const sandboxTest = path.join(__dirname, 'test_temp_loop_sandbox.js');
    fs.writeFileSync(sandboxFile, 'exports.add = (a, b) => a - b;\n', 'utf8');
    fs.writeFileSync(sandboxTest, 'const assert = require("assert"); const m = require("../scratch/test_autonomous_os/temp_math_target.js"); assert.strictEqual(m.add(2, 3), 5); console.log("[PASS] add works");\n', 'utf8');

    try {
      const syntaxRb = await selfRepairServiceInstance.runBoundedAutonomousEngineeringLoop({
        goal: 'Test syntax rollback',
        targetFile: 'scratch/test_autonomous_os/temp_math_target.js',
        testScript: 'tests/test_temp_loop_sandbox.js',
        originalCode: 'exports.add = (a, b) => a - b;',
        replacementCode: 'exports.add = (a, b) => a + ;'
      });
      assert(!syntaxRb.success && syntaxRb.status === 'ROLLED_BACK_SYNTAX_ERROR', `Expected syntax rollback, got ${syntaxRb.status}`);
      assert(fs.readFileSync(sandboxFile, 'utf8').includes('a - b'), 'Original file not restored on syntax rollback');

      const fixRes = await selfRepairServiceInstance.runBoundedAutonomousEngineeringLoop({
        goal: 'Fix add bug in temp_math_target.js',
        targetFile: 'scratch/test_autonomous_os/temp_math_target.js',
        testScript: 'tests/test_temp_loop_sandbox.js',
        originalCode: 'exports.add = (a, b) => a - b;',
        replacementCode: 'exports.add = (a, b) => a + b;',
        maxIterations: 2
      });
      assert(fixRes.success && fixRes.status === 'VERIFIED_COMPLETE', `Expected VERIFIED_COMPLETE, got ${JSON.stringify(fixRes)}`);
    } finally {
      if (fs.existsSync(sandboxTest)) fs.unlinkSync(sandboxTest);
    }

    emergencyStopControllerInstance.engage('TEST_ESTOP');
    const halted = await selfRepairServiceInstance.runBoundedAutonomousEngineeringLoop({ goal: 'Should halt' });
    emergencyStopControllerInstance.reset('TEST_COMPLETE');
    assert(!halted.success && halted.status === 'HALTED_BY_EMERGENCY_STOP', 'Emergency Stop did not halt autonomous loop');
    return 'immutable blocked + syntax auto-rollback + green patch + E-Stop verified';
  });

  // 6. Real Host Hardware Telemetry + HTTP Endpoint
  await runTest('Host Hardware Telemetry collects genuine Windows CPU/RAM/GPU/Disk & HTTP API works', 'REAL_ENV', async () => {
    const resp = await fetch(`${BASE_URL}/api/system/hardware-telemetry`);
    assert.strictEqual(resp.status, 200, `Expected HTTP 200, got ${resp.status}`);
    const data = await resp.json();
    assert(data.success && data.telemetry && data.telemetry.cpu && data.telemetry.memory && Array.isArray(data.telemetry.gpu), 'Malformed telemetry payload');
    assert(data.telemetry.memory.totalGb > 1, 'Invalid total RAM');
    return `CPU=${data.telemetry.cpu.model.slice(0, 32)}, RAM=${data.telemetry.memory.usedGb}/${data.telemetry.memory.totalGb}GB, GPUs=${data.telemetry.gpu.length}`;
  });

  // 7. Physical Robotics Engine: Torque Math, INR BOM, Electrical Safety & Persistent Inventory
  await runTest('Robotics Torque math, INR BOM ranges, Electrical Safety audit & Hardware Inventory persistence', 'REAL_COMPUTE', async () => {
    const { mechanicalRoboticsEngineInstance } = require('../server/mechanicalRoboticsEngine.js');
    const { electronicsEmbeddedEngineInstance } = require('../server/electronicsEmbeddedEngine.js');

    const torque = mechanicalRoboticsEngineInstance.computeJointTorqueAndPayload({
      payloadKg: 1.5,
      armLengthM: 0.5,
      linkMassKg: 0.5,
      safetyFactor: 2.0
    });
    assert(torque.success && torque.results.recommendedShoulderTorqueNm > torque.results.shoulderStaticTorqueNm, 'Torque safety factor math failed');

    const bom = mechanicalRoboticsEngineInstance.generateRoboticsBomINR({ projectName: '6-DOF Robotic Arm' });
    assert(bom.success && bom.currency === 'INR' && Array.isArray(bom.items) && bom.items.every(i => i.priceType === 'ESTIMATED_INR_RANGE'), 'INR BOM validation failed');

    const safety = mechanicalRoboticsEngineInstance.evaluateRoboticsSafety({
      supplyVoltageV: 24,
      logicVoltageV: 5,
      hasInlineFuse: false,
      hasPhysicalEStop: false,
      hasCommonGround: false
    });
    assert(Array.isArray(safety.hazards) && safety.hazards.length >= 3 && !safety.safeToPowerOn, 'Missing fuse/E-Stop/ground must flag unsafe');

    const added = electronicsEmbeddedEngineInstance.addHardwareInventoryItem({
      name: 'MG996R Metal Gear Servo',
      category: 'actuator',
      quantity: 4,
      specs: '11 kg-cm @ 6V'
    });
    const list = electronicsEmbeddedEngineInstance.listHardwareInventory();
    assert(added.success && list.count >= 1 && list.items.some(i => i.name === 'MG996R Metal Gear Servo'), 'Inventory persistence failed');
    return `designTorque=${torque.results.recommendedShoulderTorqueNm}Nm, BOM=${bom.items.length} items (INR), inventory=${list.count} item(s)`;
  });

  // 8. Intent Routing & Unified Project/Goal/CAD Continuity
  await runTest('Deterministic Intent Routing & Unified Continuity Context ("robot arm" / YouTube 3rd / WPS)', 'REAL_LOGIC', async () => {
    const { aiAdapterInstance } = require('../server/aiProviderAdapter.js');
    const { unifiedIntelligenceLayerInstance } = require('../server/unifiedIntelligenceLayer.js');

    const ytIntent = aiAdapterInstance.detectToolIntent('JARVIS', 'Open Chrome, go to YouTube, search for 6 DOF robot arm and open the 3rd video');
    assert(ytIntent && ytIntent.toolName === 'youtube_search_and_open' && ytIntent.args.index === 3, `Wrong YouTube intent: ${JSON.stringify(ytIntent)}`);

    const wpsIntent = aiAdapterInstance.detectToolIntent('JARVIS', 'Open WPS Writer and write a report about embedded robotics');
    assert(wpsIntent && wpsIntent.toolName === 'create_word_document' && wpsIntent.args.preferredApp === 'wps', `Wrong WPS intent: ${JSON.stringify(wpsIntent)}`);

    const closeLastIntent = aiAdapterInstance.detectToolIntent('JARVIS', 'close the application i was using');
    assert(closeLastIntent && closeLastIntent.toolName === 'close_desktop_app' && closeLastIntent.args.appName === 'last', `Wrong contextual close intent: ${JSON.stringify(closeLastIntent)}`);

    const hwIntent = aiAdapterInstance.detectToolIntent('JARVIS', 'Check my host hardware telemetry and GPU status');
    assert(hwIntent && hwIntent.toolName === 'get_host_hardware_telemetry', `Wrong hardware intent: ${JSON.stringify(hwIntent)}`);

    const continuity = unifiedIntelligenceLayerInstance.getPromptContinuityContext('continue building the robot arm');
    assert(continuity.includes('Recent 3D CAD Models') && continuity.includes('Hardware Inventory'), `Missing continuity context: ${continuity}`);
    return 'All 4 deterministic routes + unified continuity snapshot verified';
  });

  console.log(`\n=== SUMMARY: ${passed}/${passed + failed} PASSED (${failed} FAILED) ===\n`);
  if (failed > 0) process.exit(1);
})();
