/**
 * VISION v1.2 Addendum — Comprehensive 15-Scenario Real Windows Acceptance Suite
 * Verifies Unified VISION/Gemini Provider Control, Universal Windows App Launcher,
 * Chrome & Browser Automation, Google Maps, Google Drive API v3, Local File Intelligence,
 * Multi-Step DAG Orchestration, GUI Safety, NL Reference Resolution, E-Stop & Security.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.resolve(__dirname, '../data/neural_models/v12_desktop_acceptance_report.json');
const TEST_SANDBOX_DIR = path.resolve(__dirname, '../scratch/v12_acceptance_artifacts');

async function runSuite() {
  const { executeTool, TOOLS } = require('../server/toolsRegistry.js');
  const { windowsAppRegistry } = require('../server/desktop/windowsAppRegistry.js');
  const { appLauncherInstance } = require('../server/desktop/appLauncher.js');
  const { browserAutomationEngineInstance } = require('../server/browser/browserAutomationEngine.js');
  const { googleWorkspaceServiceInstance } = require('../server/googleWorkspaceService.js');
  const { fileExplorerInstance } = require('../server/desktop/fileExplorer.js');
  const { documentIntelligenceEngineInstance } = require('../server/documentIntelligenceEngine.js');
  const { taskOrchestratorInstance } = require('../server/taskOrchestrator.js');
  const { universalGuiNavigatorInstance } = require('../server/desktop/universalGuiNavigator.js');
  const { emergencyStopControllerInstance } = require('../server/emergencyStopController.js');
  const { aiAdapterInstance } = require('../server/aiProviderAdapter.js');

  fs.mkdirSync(TEST_SANDBOX_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  // Ensure clean E-stop state before starting
  if (emergencyStopControllerInstance.isEngaged()) {
    emergencyStopControllerInstance.reset('Reset before acceptance suite');
  }

  const results = [];
  const runCase = async (id, title, fn) => {
    const t0 = Date.now();
    try {
      const details = await fn();
      const entry = { id, title, passed: true, durationMs: Date.now() - t0, details };
      results.push(entry);
      console.log(`[PASS] ${id}. ${title} (${entry.durationMs}ms)`);
      return entry;
    } catch (err) {
      const entry = { id, title, passed: false, durationMs: Date.now() - t0, error: err.message };
      results.push(entry);
      console.error(`[FAIL] ${id}. ${title}: ${err.message}`);
      return entry;
    }
  };

  // 1. Open Google Chrome visibly & verify open window
  await runCase(1, 'Open Google Chrome visibly & verify HWND/PID', async () => {
    const res = await executeTool('open_chrome_visible', { url: 'https://example.com' }, 'JARVIS');
    assert.strictEqual(res.browser, 'Google Chrome');
    assert.strictEqual(res.credentialsExposed, false);
    assert.strictEqual(res.success, true, `Expected visible Chrome launch success, got: ${JSON.stringify(res)}`);
    assert.strictEqual(res.verified, true, 'Chrome window must be empirically verified');
    return { pid: res.pid, hwnd: res.hwnd, windowTitle: res.windowTitle, verified: res.verified };
  });

  // 2. Search Google in Chrome & verify URL / results
  await runCase(2, 'Search Google in Chrome & verify live URL/results', async () => {
    const res = await executeTool('search_google_live', {
      query: 'OpenAI robotics official site',
      openVisible: false,
      captureScreenshot: true
    }, 'JARVIS');
    assert.ok(res.searchUrl.includes('google.com/search'), 'Expected Google search URL');
    assert.ok(res.finalUrl, 'Expected finalUrl');
    assert.strictEqual(res.success, true, `Expected search success, got: ${res.summary}`);
    assert.ok(res.screenshot && res.screenshot.verified && fs.existsSync(res.screenshot.filePath), 'Expected verified screenshot on disk');
    return { finalUrl: res.finalUrl, sourceEngine: res.sourceEngine, resultsCount: res.resultsCount, blockedByCaptcha: res.blockedByCaptcha, screenshotPath: res.screenshot?.filePath };
  });

  // 3. Open Google Maps & search for a named location (+ clarify missing route params)
  await runCase(3, 'Google Maps named location search & missing-route clarification', async () => {
    const missingDir = await executeTool('get_google_maps_directions', { origin: '', destination: 'Mumbai Airport' }, 'JARVIS');
    assert.strictEqual(missingDir.success, false);
    assert.strictEqual(missingDir.clarificationRequired, true);

    const mapsRes = await browserAutomationEngineInstance.searchGoogleMaps('Chhatrapati Shivaji Maharaj Terminus Mumbai', {
      openVisible: false,
      captureScreenshot: true
    });
    assert.ok(mapsRes.mapsUrl.includes('google.com/maps'), 'Expected Google Maps URL');
    assert.strictEqual(mapsRes.locationDisclosed, false, 'Must not disclose private user location');
    assert.strictEqual(mapsRes.success, true, `Expected Google Maps search success, got: ${mapsRes.summary}`);
    return { finalUrl: mapsRes.finalUrl, placesCount: mapsRes.placesCount, firstPlace: mapsRes.places?.[0]?.name || null, screenshotPath: mapsRes.screenshot?.filePath };
  });

  // 4. Discover & launch an installed Windows app by NL name (+ minimize/restore/close)
  await runCase(4, 'Discover, launch, minimize, restore & close installed Windows app (Notepad)', async () => {
    const found = await executeTool('find_installed_apps', { query: 'notepad' }, 'JARVIS');
    assert.ok(found, 'Expected app discovery output');
    const launched = await executeTool('open_desktop_app', { appName: 'notepad', forceNew: true }, 'JARVIS');
    assert.strictEqual(launched.verified, true, `Expected verified Notepad launch, got: ${JSON.stringify(launched)}`);
    await new Promise(r => setTimeout(r, 600));
    const minRes = await executeTool('control_application_window', { query: 'notepad', action: 'minimize' }, 'JARVIS');
    const restRes = await executeTool('restore_desktop_window', { query: 'notepad' }, 'JARVIS');
    const closed = await executeTool('close_desktop_app', { appName: 'notepad' }, 'JARVIS');
    return { launchedPid: launched.pid, launchedHwnd: launched.hwnd, minimized: minRes.success, restored: restRes.success, closed: closed.success !== false };
  });

  // 5. Open File Explorer at an authorized user folder
  await runCase(5, 'Open File Explorer at authorized user folder (Documents)', async () => {
    const res = await executeTool('open_folder', { folderName: 'documents' }, 'JARVIS');
    assert.strictEqual(res.status, 'opened');
    assert.ok(fs.existsSync(res.folderPath), 'Documents path must exist');
    let rejectedBlocked = false;
    try {
      const secRes = await fileExplorerInstance.openFolder(null, 'C:\\Windows\\System32');
      rejectedBlocked = secRes.status === 'rejected_unauthorized';
    } catch (_) {
      rejectedBlocked = true;
    }
    assert.strictEqual(rejectedBlocked, true, 'System32 path must be rejected');
    return { folderPath: res.folderPath, status: res.status, restrictedBlocked: rejectedBlocked };
  });

  // 6. Search D: drive for a test folder/document
  await runCase(6, 'Search D: drive & authorized storage with exact metadata', async () => {
    const fixtureFile = path.join(TEST_SANDBOX_DIR, 'Workspace_Acceptance_Brief.txt');
    fs.writeFileSync(fixtureFile, 'Workspace concepts & local storage search verification.', 'utf8');
    const res = await executeTool('search_user_files', { query: 'Workspace_Acceptance_Brief', includeDriveD: true }, 'JARVIS');
    assert.strictEqual(res.success, true);
    assert.ok(res.count >= 1, 'Expected at least 1 match on D:');
    assert.ok(res.results.some(r => r.path.toLowerCase().includes('workspace_acceptance_brief.txt')));
    assert.strictEqual(typeof res.results[0].sizeBytes, 'number');
    return { count: res.count, matchedPath: res.results[0].path, sizeBytes: res.results[0].sizeBytes };
  });

  // 7. Authorized Google Drive flow (live status + real v3 client + sandbox parity + delete confirmation gate)
  await runCase(7, 'Google Drive API v3 client, auth honesty, sandbox lifecycle & confirmation gate', async () => {
    const liveStatus = googleWorkspaceServiceInstance.getServiceStatus();
    assert.ok(['NOT_CONFIGURED', 'CREDENTIALS_CONFIGURED_PENDING_AUTH', 'LIVE_VERIFIED', 'SANDBOX_SIMULATED'].includes(liveStatus.status));
    if (liveStatus.status === 'NOT_CONFIGURED') {
      const liveUnauth = await googleWorkspaceServiceInstance.searchDriveFiles('Acceptance');
      assert.strictEqual(liveUnauth.success, false);
      assert.strictEqual(liveUnauth.status, 'NOT_CONFIGURED');
    }

    // Exercise complete Drive lifecycle in sandbox mode (without overwriting persistent live tokens if live)
    const prevSandbox = googleWorkspaceServiceInstance.sandboxMode;
    const prevVault = googleWorkspaceServiceInstance.loadTokens();
    googleWorkspaceServiceInstance.sandboxMode = true;
    try {
      const folder = await executeTool('create_google_drive_folder', { folderName: 'VISION_Acceptance_Folder' }, 'JARVIS');
      assert.strictEqual(folder.verified, true);
      const localSample = path.join(TEST_SANDBOX_DIR, 'drive_sample.txt');
      fs.writeFileSync(localSample, 'VISION Google Drive API test payload', 'utf8');
      const uploaded = await executeTool('upload_to_google_drive', { filePath: localSample, folderId: folder.folderId }, 'JARVIS');
      assert.strictEqual(uploaded.verified, true);
      const listed = await executeTool('list_google_drive', { folderId: folder.folderId }, 'JARVIS');
      assert.ok(listed.count >= 1);
      const searched = await executeTool('search_google_drive', { query: 'drive_sample' }, 'JARVIS');
      assert.ok(searched.count >= 1);
      const readRes = await executeTool('read_google_drive_file', { fileId: uploaded.fileId }, 'JARVIS');
      assert.strictEqual(readRes.verified, true);
      const blockedDelete = await executeTool('delete_google_drive_file', { fileId: uploaded.fileId, userConfirmed: false }, 'JARVIS');
      assert.strictEqual(blockedDelete.success, false);
      assert.strictEqual(blockedDelete.confirmationRequired, true);
      const confirmedDelete = await executeTool('delete_google_drive_file', { fileId: uploaded.fileId, userConfirmed: true }, 'JARVIS');
      assert.strictEqual(confirmedDelete.verified, true);
      return { initialLiveStatus: liveStatus.status, sandboxLifecycleVerified: true, unconfirmedDeleteBlocked: true };
    } finally {
      googleWorkspaceServiceInstance.sandboxMode = prevSandbox;
      if (!prevVault) googleWorkspaceServiceInstance.revokeTokens();
    }
  });

  // 8. Read & summarize a real local PDF document
  await runCase(8, 'Read & summarize a real local PDF document', async () => {
    const pdfOut = path.join(TEST_SANDBOX_DIR, 'vision_pdf_summary_test.pdf');
    documentIntelligenceEngineInstance.createPdfDocument({
      title: 'VISION Robotics Telemetry Brief',
      filePath: pdfOut,
      pages: [{
        title: 'VISION Robotics Telemetry Brief',
        content: '# Telemetry Summary\nActuator torque peak measured at 14.2 Nm.\nBattery pack voltage 48.0 V nominal.\nAll joint limit switches verified clean.'
      }]
    });
    const summaryRes = await executeTool('summarize_local_document', { filePath: pdfOut }, 'JARVIS');
    assert.strictEqual(summaryRes.success, true);
    assert.strictEqual(summaryRes.verified, true);
    assert.ok(summaryRes.wordCount >= 10, 'Expected extracted PDF words');
    assert.ok(summaryRes.excerpt.toLowerCase().includes('telemetry') || summaryRes.excerpt.toLowerCase().includes('torque'));
    return { pdfOut, wordCount: summaryRes.wordCount, totalPages: summaryRes.totalPages };
  });

  // 9. Create a Word .docx document & verify on disk
  await runCase(9, 'Create structured Word (.docx) document & verify contents on disk', async () => {
    const docxOut = path.join(TEST_SANDBOX_DIR, `vision_v12_report_${Date.now()}.docx`);
    const created = documentIntelligenceEngineInstance.createDocxDocument({
      title: 'VISION v1.2 Desktop Intelligence Report',
      subtitle: 'Empirical Verification Artifact',
      filePath: docxOut,
      sections: [
        { heading: '1. Executive Summary', level: 1, paragraphs: ['VISION v1.2 integrates native neural inference with verified desktop automation.'] }
      ]
    });
    const verified = await executeTool('verify_document', { filePath: created.filePath }, 'JARVIS');
    assert.strictEqual(verified.verified, true);
    assert.ok(verified.sizeBytes > 1000);
    return { filePath: verified.filePath, sizeBytes: verified.sizeBytes, paragraphsCount: verified.paragraphsCount, sha256: verified.sha256 };
  });

  // 10. Multi-step workflow: Research in browser -> summarize -> create Word doc -> verify saved
  await runCase(10, 'Multi-step DAG workflow: browser research -> Word report -> disk verify', async () => {
    const report = await taskOrchestratorInstance.executeAutonomousTask({
      instruction: 'Research autonomous humanoid robotics companies, compare 5, create a structured Word report, and save it',
      personality: 'JARVIS',
      timeoutMs: 60000
    });
    assert.ok(['SUCCESS', 'PARTIAL_SUCCESS'].includes(report.status), `Expected workflow completion, got ${report.status}`);
    assert.ok(report.completedStepsCount >= 2, `Expected >= 2 steps completed, got ${report.completedStepsCount}`);
    return { taskId: report.taskId, status: report.status, completedStepsCount: report.completedStepsCount, outcomeVerified: report.outcomeVerified };
  });

  // 11. Ambiguous app name -> user clarification before action
  await runCase(11, 'Ambiguous app name triggers clarification before acting', async () => {
    const res = await appLauncherInstance.launchApplication('browser');
    assert.strictEqual(res.clarificationRequired, true, `Expected clarificationRequired for "browser", got: ${JSON.stringify(res)}`);
    assert.ok(Array.isArray(res.candidates) && res.candidates.length >= 2, 'Expected multiple app candidates');
    return { status: res.status, candidates: res.candidates, prompt: res.summary };
  });

  // 12. Permission denial (ULTRON) & Emergency Stop interrupting task execution
  await runCase(12, 'Permission denial (ULTRON) + Emergency Stop interruption & reset', async () => {
    let ultronDenied = false;
    try {
      await executeTool('open_desktop_app', { appName: 'notepad' }, 'ULTRON');
    } catch (e) {
      ultronDenied = /denied|restrict|unauthorized|permission/i.test(e.message);
    }
    assert.strictEqual(ultronDenied, true, 'ULTRON must be denied open_desktop_app');

    emergencyStopControllerInstance.engage('Acceptance test E-stop verification');
    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), true);
    let estopBlockedTool = false;
    try {
      await executeTool('get_current_time', {}, 'JARVIS');
    } catch (e) {
      estopBlockedTool = e.message.includes('EMERGENCY_STOP_ACTIVE');
    }
    assert.strictEqual(estopBlockedTool, true, 'Tool execution must be blocked when E-stop engaged');

    emergencyStopControllerInstance.reset('Acceptance test cleanup');
    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), false);
    return { ultronDenied, estopBlockedTool, resetOk: true };
  });

  // 13. Both VISION & Gemini call the same JARVIS tools + Compare mode
  await runCase(13, 'Both VISION & Gemini invoke same tools + Compare mode attribution', async () => {
    const vRes = await aiAdapterInstance.generateResponse('JARVIS', 'what time is it right now', [], null, [], { providerMode: 'vision' });
    assert.strictEqual(vRes.providerUsed, 'vision');
    assert.strictEqual(vRes.fallbackUsed, false);
    assert.ok(vRes.toolResult && vRes.toolResult.time, 'VISION mode must execute shared time tool');

    const gRes = await aiAdapterInstance.generateResponse('JARVIS', 'explain binary search in 2 lines', [], null, [], { providerMode: 'gemini' });
    assert.ok(['gemini', 'unified_local_intelligence', 'local_study_engine'].includes(gRes.providerUsed), `Unexpected providerUsed: ${gRes.providerUsed}`);

    const cmpRes = await aiAdapterInstance.generateResponse('JARVIS', 'compare vision and gemini: what is 2+2?', [], null, [], { providerMode: 'compare' });
    assert.strictEqual(cmpRes.providerUsed, 'compare');
    assert.ok(cmpRes.comparison?.vision && cmpRes.comparison?.gemini, 'Compare mode must include both outputs cleanly separated');
    return { visionProvider: vRes.provider, geminiProviderUsed: gRes.providerUsed, compareHasBoth: true };
  });

  // 14. Fallback attribution + Natural Language Reference Resolution (Section I)
  await runCase(14, 'Fallback attribution & NL coreference resolution', async () => {
    // Seed a search & file entity via tool calls, then resolve "open that file" & "open the same website"
    const testTxt = path.join(TEST_SANDBOX_DIR, 'ref_target.txt');
    fs.writeFileSync(testTxt, 'Reference resolution test content', 'utf8');
    const sumR = await executeTool('summarize_local_document', { filePath: testTxt }, 'JARVIS');
    aiAdapterInstance.recordSessionEntity('JARVIS', 'summarize_local_document', { filePath: testTxt }, sumR);
    const refIntent = aiAdapterInstance.detectToolIntent('JARVIS', 'open that file');
    assert.ok(refIntent && refIntent.toolName === 'open_file' && refIntent.args.filePath === testTxt);

    aiAdapterInstance.recordSessionEntity('JARVIS', 'open_web_url', { url: 'https://example.org' }, { success: true, url: 'https://example.org' });
    const siteIntent = aiAdapterInstance.detectToolIntent('JARVIS', 'open the same website');
    assert.ok(siteIntent && siteIntent.toolName === 'open_web_url' && siteIntent.args.url === 'https://example.org');

    // Explicit Gemini provider call vs fallback honesty
    const origKey = aiAdapterInstance.geminiKey;
    aiAdapterInstance.geminiKey = null;
    try {
      const fbRes = await aiAdapterInstance.generateResponse('JARVIS', 'explain binary search quickly', [], null, [], { providerMode: 'auto' });
      assert.strictEqual(fbRes.fallbackUsed, true);
      assert.ok(fbRes.fallbackReason, 'Must record honest fallbackReason');
      assert.notStrictEqual(fbRes.providerUsed, 'vision', 'Offline/fallback must never misattribute itself as native VISION');
      return { refResolvedTo: refIntent.args.filePath, siteResolvedTo: siteIntent.args.url, fallbackUsed: fbRes.fallbackUsed, fallbackReason: fbRes.fallbackReason };
    } finally {
      aiAdapterInstance.geminiKey = origKey;
    }
  });

  // 15. Failed actions never report success + GUI sensitive confirmation gate
  await runCase(15, 'Failed actions never falsely report success & GUI blocks sensitive clicks', async () => {
    const badApp = await appLauncherInstance.launchApplication('NonExistentApp_99999_XYZ');
    assert.strictEqual(badApp.verified, false);
    assert.notStrictEqual(badApp.status, 'launched');

    let badFileBlocked = false;
    try {
      const f = await executeTool('open_file', { filePath: 'C:\\Windows\\System32\\drivers\\etc\\hosts' }, 'JARVIS');
      badFileBlocked = f.status === 'rejected_unauthorized' || f.success === false;
    } catch (_) {
      badFileBlocked = true;
    }
    assert.strictEqual(badFileBlocked, true);

    const guiSensitive = universalGuiNavigatorInstance.checkPermissions(
      { action: 'CLICK', description: 'Complete payment checkout now', targetQuery: 'Pay $500' },
      'JARVIS',
      { explicitSensitiveConfirmation: false }
    );
    assert.strictEqual(guiSensitive.allowed, false);
    assert.strictEqual(guiSensitive.sensitiveActionBlocked, true);
    return { badAppStatus: badApp.status, badFileBlocked, guiSensitiveBlocked: guiSensitive.sensitiveActionBlocked };
  });

  // Cleanup browser sessions opened during acceptance test
  await browserAutomationEngineInstance.emergencyShutdown().catch(() => {});

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.length - passedCount;
  const report = {
    suite: 'VISION v1.2 Addendum — Universal Desktop Intelligence Real Windows Acceptance Suite',
    executedAt: new Date().toISOString(),
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    allPassed: failedCount === 0,
    results
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nAcceptance Suite Complete: ${passedCount}/${results.length} PASSED (${failedCount} failed). Report: ${REPORT_PATH}`);
  if (failedCount > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Fatal Acceptance Suite error:', err);
  process.exit(1);
});
