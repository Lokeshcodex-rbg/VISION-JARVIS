/**
 * STARK AI — REAL WINDOWS & LIVE BROWSER UI ACCEPTANCE TEST SUITE (Tests A–I)
 * Executes real commands through http://127.0.0.1:3000/api/chat/stream,
 * real Win32 desktop automation (Chrome, Somaiya Profile, Gmail, Microsoft Word COM, Notepad),
 * real Screen Observation Mode, real Simulation & 3D Viewer modal opening in Playwright Chromium,
 * Emergency Stop blocking & recovery, and Mission Control telemetry.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:3000';
const TOKEN_FILE = path.resolve(__dirname, '../data/.session_token');

async function getAuthToken() {
  const res = await fetch(`${BASE_URL}/api/auth/session`);
  const data = await res.json();
  if (data && data.token) return data.token;
  return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
}

async function sendStreamChat(message, personality = 'JARVIS') {
  const token = await getAuthToken();
  const res = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Stark-Auth-Token': token
    },
    body: JSON.stringify({ message, personality })
  });
  assert.strictEqual(res.status, 200, `SSE HTTP status should be 200 for "${message}"`);
  const raw = await res.text();
  const events = [];
  const blocks = raw.split(/\r?\n\r?\n/).filter(Boolean);
  for (const blk of blocks) {
    let evName = 'message';
    let dataLine = '';
    for (const line of blk.split(/\r?\n/)) {
      if (line.startsWith('event:')) evName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
    }
    if (dataLine) {
      try {
        events.push({ event: evName, data: JSON.parse(dataLine) });
      } catch (_) {}
    }
  }
  const doneEvt = events.find(e => e.event === 'done');
  const toolEvts = events.filter(e => e.event === 'tool');
  const toolEvt = toolEvts.find(e => e.data && e.data.status === 'complete') || toolEvts[toolEvts.length - 1] || null;
  return { events, done: doneEvt ? doneEvt.data : null, tool: toolEvt ? toolEvt.data : null };
}

async function postJson(endpoint, body = {}) {
  const token = await getAuthToken();
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Stark-Auth-Token': token },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.json() };
}

async function getJson(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`);
  return { status: res.status, body: await res.json() };
}

function listWin32Windows() {
  const out = execFileSync('python', [path.resolve(__dirname, '../server/desktop/win32_app_launcher.py'), 'list_windows'], { encoding: 'utf8' });
  return JSON.parse(out.trim());
}

async function runTests() {
  const results = {};
  const token = getAuthToken();
  console.log('===============================================================');
  console.log(' STARK REAL DESKTOP EXECUTION & UI ACCEPTANCE SUITE (TESTS A-I)');
  console.log('===============================================================\n');

  // Make sure Emergency Stop is initially disengaged and Screen Observation starts OFF
  await postJson('/api/security/emergency-reset', {});
  await postJson('/api/screen-observation/toggle', { action: 'disable' });

  // -------------------------------------------------------------------------
  // TEST A: Chrome + Somaiya Profile + Gmail Launch & Window Verification
  // -------------------------------------------------------------------------
  console.log('Running Test A: Chrome + Somaiya Profile + Gmail...');
  const a1 = await sendStreamChat('open Chrome');
  assert(a1.tool && a1.tool.toolName === 'open_desktop_app', 'open Chrome must run open_desktop_app');
  assert(a1.tool.toolResult && a1.tool.toolResult.verified === true, 'open Chrome must verify visible Chrome window');
  assert(a1.tool.toolResult.hwnd, 'open Chrome must return real Chrome HWND');

  const a2 = await sendStreamChat('open my Somaiya Chrome profile');
  assert(a2.tool && a2.tool.toolName === 'launch_chrome_profile', 'Somaiya profile must run launch_chrome_profile');
  assert(a2.tool.toolResult && a2.tool.toolResult.verified === true, 'Somaiya profile launch must verify visible Chrome window');
  assert.strictEqual(a2.tool.toolResult.profile.dir, 'Profile 1', 'Somaiya must resolve to Profile 1');

  const a3 = await sendStreamChat('open Gmail in my Somaiya profile');
  assert(a3.tool && a3.tool.toolName === 'open_gmail', 'Gmail Somaiya must run open_gmail');
  assert(a3.tool.toolResult && a3.tool.toolResult.verified === true, 'Gmail Somaiya must verify visible Chrome window');
  assert(a3.tool.toolResult.targetUrl.includes('mail.google.com'), 'Gmail URL verified');
  results.testA = 'PASS (Verified Chrome HWND ' + a1.tool.toolResult.hwnd + ', Somaiya Profile 1 HWND ' + a2.tool.toolResult.hwnd + ', Gmail)';
  console.log('  ✅', results.testA);

  // -------------------------------------------------------------------------
  // TEST B: Microsoft Word Real COM Blank Doc + Document Create + Save + Reopen
  // -------------------------------------------------------------------------
  console.log('Running Test B: Microsoft Word Real COM & .docx Verification...');
  const b1 = await sendStreamChat('open Word and create a blank document');
  assert(b1.tool && b1.tool.toolName === 'word_init_blank_document', 'Blank doc must execute word_init_blank_document');
  assert(b1.tool.toolResult && b1.tool.toolResult.success === true, 'Word blank doc COM init must succeed');
  assert(b1.tool.toolResult.pid > 0 && b1.tool.toolResult.hwnd > 0, `Word blank doc must have valid WINWORD PID/HWND, got PID=${b1.tool.toolResult.pid}, HWND=${b1.tool.toolResult.hwnd}`);

  // Verify via win32_app_launcher that the HWND belongs to winword.exe (NOT wps.exe)
  const wList = listWin32Windows();
  const wordWin = (wList.windows || []).find(w => w.hwnd === b1.tool.toolResult.hwnd || (w.proc || '').toLowerCase() === 'winword.exe');
  assert(wordWin && wordWin.proc.toLowerCase() === 'winword.exe', 'Verified window belongs strictly to winword.exe');

  const b2 = await sendStreamChat('open Word and write a report on Autonomous Robotics');
  assert(b2.tool && b2.tool.toolName === 'create_word_document', 'Word report must execute create_word_document');
  assert(b2.tool.toolResult && b2.tool.toolResult.filePath && fs.existsSync(b2.tool.toolResult.filePath), 'Generated .docx file must exist on disk');
  assert(fs.statSync(b2.tool.toolResult.filePath).size > 1000, '.docx file size must be > 1KB');

  // Cleanly close test Word instance, then verify reopening the saved .docx in real Word
  try {
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve(__dirname, '../server/desktop/word_automator.ps1'), '-Action', 'close', '-PayloadJson', '{"quitWord":true}'], { timeout: 10000 });
  } catch (_) {}
  const reopenOut = JSON.parse(execFileSync('python', [path.resolve(__dirname, '../server/desktop/win32_app_launcher.py'), 'launch', 'Microsoft Word', b2.tool.toolResult.filePath], { encoding: 'utf8', timeout: 15000 }).trim());
  assert(reopenOut.verified === true && reopenOut.hwnd > 0, 'Reopened .docx in real WINWORD must verify visible window');
  try {
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve(__dirname, '../server/desktop/word_automator.ps1'), '-Action', 'close', '-PayloadJson', '{"quitWord":true}'], { timeout: 10000 });
  } catch (_) {}
  results.testB = `PASS (WINWORD PID ${wordWin.pid}, .docx verified & reopened ${path.basename(b2.tool.toolResult.filePath)})`;
  console.log('  ✅', results.testB);

  // -------------------------------------------------------------------------
  // TEST C: Notepad Reuse (No Duplicate Windows)
  // -------------------------------------------------------------------------
  console.log('Running Test C: Notepad Launch & Window Reuse...');
  const c1 = await sendStreamChat('open Notepad');
  assert(c1.tool && c1.tool.toolName === 'open_desktop_app' && c1.tool.toolResult.verified === true, 'First open Notepad must verify');
  const c2 = await sendStreamChat('open Notepad');
  assert(c2.tool && c2.tool.toolName === 'open_desktop_app' && c2.tool.toolResult.verified === true, 'Second open Notepad must verify');
  assert.strictEqual(c2.tool.toolResult.reusedExisting, true, 'Second open Notepad must reuse existing window');
  const countRes = JSON.parse(execFileSync('python', [path.resolve(__dirname, '../server/desktop/win32_app_launcher.py'), 'count', 'Notepad'], { encoding: 'utf8' }).trim());
  assert.strictEqual(countRes.count, 1, `Expected 1 Notepad window, found ${countRes.count}`);
  // Close test Notepad cleanly
  await sendStreamChat('close Notepad');
  results.testC = `PASS (Reused HWND ${c2.tool.toolResult.hwnd}, instance count=1)`;
  console.log('  ✅', results.testC);

  // -------------------------------------------------------------------------
  // TEST E: Screen Observation Privacy Gate + Real Enable + Inspect + Disable
  // -------------------------------------------------------------------------
  console.log('Running Test E: Screen Observation Mode & Active Window Inspection...');
  const e0 = await sendStreamChat('what is on my active window');
  assert(e0.tool && e0.tool.toolName === 'inspect_screen_observation', 'Must route active window check to inspect_screen_observation');
  assert.strictEqual(e0.tool.toolResult.permissionRequired, true, 'Must block inspection and ask permission while Screen Observation is OFF');
  assert.strictEqual(e0.tool.toolResult.screenObservationEnabled, false);

  const e1 = await sendStreamChat('enable screen observation');
  assert(e1.tool && e1.tool.toolName === 'enable_screen_observation' && e1.tool.toolResult.screenObservationEnabled === true, 'Must enable screen observation on command');

  const e2 = await sendStreamChat('what is on my active window');
  assert(e2.tool && e2.tool.toolName === 'inspect_screen_observation' && e2.tool.toolResult.success === true, 'Must succeed when enabled');
  assert(e2.tool.toolResult.foregroundWindow && e2.tool.toolResult.foregroundWindow.hwnd, 'Must return real foreground HWND');
  assert(e2.tool.toolResult.screenshotPath && fs.existsSync(e2.tool.toolResult.screenshotPath), 'Must capture real screen screenshot');

  const e3 = await sendStreamChat('disable screen observation');
  assert(e3.tool && e3.tool.toolName === 'disable_screen_observation' && e3.tool.toolResult.screenObservationEnabled === false, 'Must disable screen observation');
  results.testE = `PASS (Privacy-gated when OFF, inspected real HWND ${e2.tool.toolResult.foregroundWindow.hwnd} when ON, cleanly disabled)`;
  console.log('  ✅', results.testE);

  // -------------------------------------------------------------------------
  // TEST D & F & G (Part 1 Backend + Part 2 Real Browser UI Verification via Playwright)
  // -------------------------------------------------------------------------
  console.log('Running Test D (Chat visibility & Voice/Captions UI) + Test F (Simulation Viewer) + Test G (3D Model + OBJ Export)...');
  const dChat = await sendStreamChat('can you see my chat messages');
  assert(dChat.done && dChat.done.fullReply && !/cannot see your chat|don't have access to your chat/i.test(dChat.done.fullReply),
    `Reply should affirm visibility of STARK chat messages, got: ${dChat.done?.fullReply}`);

  // Real Browser UI Verification via Playwright Chromium
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#stark-main-chat-input', { timeout: 10000 });
  await page.waitForSelector('#mic-status-badge', { timeout: 5000 });
  const manualToolbarCount = await page.evaluate(() => [
    '#voice-mode-select',
    '#btn-voice-ptt',
    '#btn-voice-pause',
    '#assistant-mode-select',
    '#btn-screen-observation'
  ].filter(sel => document.querySelector(sel) !== null).length);
  assert.strictEqual(manualToolbarCount, 0, 'All 5 manual toolbar controls must be removed');

  // Verify Test F in Live UI: Type "simulate a projectile motion" -> assert #stark-sim-modal opens visibly!
  await page.fill('#stark-main-chat-input', 'simulate a projectile motion');
  await page.press('#stark-main-chat-input', 'Enter');
  await page.waitForFunction(() => {
    const m = document.getElementById('stark-sim-modal');
    return m && m.style.display === 'flex';
  }, { timeout: 15000 });
  const simTitle = await page.textContent('#stark-sim-title-badge');
  assert(simTitle && /projectile/i.test(simTitle), `Simulation viewer modal opened with title: ${simTitle}`);
  await page.click('#stark-sim-play-btn');
  const pauseLabel = await page.textContent('#stark-sim-play-btn');
  assert(pauseLabel && /PLAY/i.test(pauseLabel), 'Play/Pause control should toggle to PLAY');
  await page.click('#stark-sim-reset-btn');
  await page.click('#stark-sim-close-btn');

  // Verify Test G in Live UI: Type "create a robotic arm" -> assert #stark-3d-modal opens visibly with Three.js canvas!
  await page.fill('#stark-main-chat-input', 'create a robotic arm');
  await page.press('#stark-main-chat-input', 'Enter');
  await page.waitForFunction(() => {
    const m = document.getElementById('stark-3d-modal');
    const c = document.getElementById('stark-3d-canvas-container');
    return m && m.style.display === 'flex' && c && c.querySelector('canvas');
  }, { timeout: 15000 });
  const modelTitle = await page.textContent('#stark-3d-title-badge');
  const compText = await page.textContent('#stark-3d-components-count');
  assert(compText && !compText.endsWith(': 0'), `3D viewer components populated: ${compText}`);
  await page.click('#stark-3d-rotate-btn');
  assert.match(await page.textContent('#stark-3d-rotate-btn'), /ROTATION:\s*OFF/i);
  await page.click('#stark-3d-theme-btn');
  assert.match(await page.textContent('#stark-3d-theme-btn'), /TITANIUM/i);
  await page.click('#stark-3d-close-btn');

  // Verify Test G Export OBJ via SSE & verify file exists on disk + reload via get_3d_model
  const gExport = await sendStreamChat('export robotic arm model to obj');
  assert(gExport.tool && gExport.tool.toolName === 'export_3d_model' && gExport.tool.toolResult.verified === true, 'OBJ export must verify on disk');
  assert(fs.existsSync(gExport.tool.toolResult.filePath), 'Exported OBJ file exists');
  const gReload = await sendStreamChat('show my latest 3d model');
  assert(gReload.tool && (gReload.tool.toolName === 'get_3d_model' || gReload.tool.toolName === 'create_3d_model') && gReload.tool.toolResult.geometrySpec, '3D model geometry reloadable');

  // Verify Test D in Playwright: Default DISABLED Voice Safety (no auto-listen), Opt-in Mode, Captions & Stop Recovery
  const voiceCheck = await page.evaluate(async () => {
    const app = window.jarvisApp;
    const vc = app?.voiceController;
    const sc = app?.smokeCaptions;
    if (!app || !vc || !sc) return { ok: false, reason: 'missing_app_components' };
    const initialState = vc.getCanonicalState();
    const initialTimer = vc.getTimerSnapshot();
    await app.setVoiceMode('PUSH_TO_TALK', 'VERIFY_UI_TEST');
    const readyState = vc.getCanonicalState();
    const readyTimer = vc.getTimerSnapshot();
    sc.showUserSpeech('open Chro', false);
    const interimText = document.getElementById('smoke-captions')?.textContent || '';
    sc.showUserSpeech('open Chrome', true);
    const finalText = document.getElementById('smoke-captions')?.textContent || '';
    sc.showAssistantSentence('Opening Google Chrome.', 'JARVIS', 'utt_test_1');
    app.handleStopAction();
    const afterInterruptState = vc.getCanonicalState();
    const afterTimer = vc.getTimerSnapshot();
    await app.setVoiceMode('DISABLED', 'VERIFY_UI_TEST_CLEANUP');
    return {
      ok: true,
      initialState,
      initialTimerActive: initialTimer.isTimerActive,
      readyState,
      readyTimerActive: readyTimer.isTimerActive,
      interimText,
      finalText,
      afterInterruptState,
      afterTimerActive: afterTimer.isTimerActive
    };
  });
  assert(voiceCheck.ok, 'Voice UI components present');
  assert.strictEqual(voiceCheck.initialState, 'DISABLED', 'Voice must boot in DISABLED (never auto-listening)');
  assert.strictEqual(voiceCheck.initialTimerActive, false, 'Timer must NOT be active on boot');
  assert.strictEqual(voiceCheck.readyState, 'READY', 'Opting into Push-to-Talk must enter READY (not LISTENING)');
  assert.strictEqual(voiceCheck.readyTimerActive, false, 'Timer must NOT start in READY before capture');
  assert.strictEqual(voiceCheck.interimText, 'open Chro');
  assert.strictEqual(voiceCheck.finalText, 'open Chrome');
  assert.strictEqual(voiceCheck.afterInterruptState, 'READY', 'Interruption/Stop must return PTT mode cleanly to READY');
  assert.strictEqual(voiceCheck.afterTimerActive, false, 'Timer must stop cleanly on interruption');

  // Verify autonomous interaction strategy inference (quiet / command / detailed) without manual dropdown
  const quietTurn = await sendStreamChat('be quiet please');
  assert(quietTurn.done && quietTurn.done.interactionStrategy && quietTurn.done.interactionStrategy.assistantMode === 'QUIET',
    'Asking JARVIS to be quiet must infer QUIET mode autonomously');
  const speakTurn = await sendStreamChat('speak again please');
  assert(speakTurn.done && speakTurn.done.interactionStrategy && speakTurn.done.interactionStrategy.assistantMode === 'CONVERSATION',
    'Asking JARVIS to speak again must restore CONVERSATION mode autonomously');

  // Verify Autonomous Consent-Gated Screen Observation in live browser:
  // 1) Ask about active window while Screen Observation is OFF -> consent prompt appears, ZERO hidden capture
  await postJson('/api/screen-observation/toggle', { action: 'disable' });
  await page.fill('#stark-main-chat-input', 'what is on my active window right now');
  await page.press('#stark-main-chat-input', 'Enter');
  await page.waitForSelector('#btn-consent-allow-once', { timeout: 10000 });
  // 2) Grant temporary consent -> UI displays Observing, inspects active screen, and auto-stops after task finishes!
  await page.click('#btn-consent-allow-once');
  await page.waitForFunction(() => {
    const badge = document.getElementById('mic-status-badge');
    return badge && badge.dataset.observing === 'true';
  }, { timeout: 5000 });
  // Wait for inspection task completion -> auto-stops screen observation back cleanly
  await page.waitForFunction(async () => {
    const res = await fetch('/api/screen-observation/status');
    const st = await res.json();
    const badge = document.getElementById('mic-status-badge');
    return st && st.screenObservationEnabled === false && badge && badge.dataset.observing === 'false';
  }, { timeout: 25000 });

  await browser.close();
  assert.strictEqual(pageErrors.length, 0, `Browser JS runtime errors detected: ${pageErrors.join('; ')}`);

  results.testD = `PASS (Autonomous voice readiness, captions interim->final, barge-in stop, autonomous conversation mode & consent-gated auto-stopping Screen Observation verified)`;
  results.testF = `PASS (Opened #stark-sim-modal "${simTitle.trim()}" with live Pause/Reset controls)`;
  results.testG = `PASS (Opened #stark-3d-modal "${modelTitle.trim()}" [${compText.trim()}], verified rotation/theme controls & OBJ ${path.basename(gExport.tool.toolResult.filePath)})`;
  console.log('  ✅', results.testD);
  console.log('  ✅', results.testF);
  console.log('  ✅', results.testG);

  // -------------------------------------------------------------------------
  // TEST H: Error Recovery & Truthful Failure Reporting (No Fake Success)
  // -------------------------------------------------------------------------
  console.log('Running Test H: Error Recovery & Anti-Fake Failure Handling...');
  const h1 = await sendStreamChat('open my nonexistent_fake_profile Chrome profile');
  assert(h1.tool && h1.tool.toolResult && h1.tool.toolResult.success === false, 'Unknown Chrome profile must return truthful failure');
  assert(h1.done && /unable|error|failed|resolve/i.test(h1.done.fullReply), 'Reply must honestly report failure');

  const h2 = await sendStreamChat('open NonExistentAppXYZ99');
  if (h2.tool && h2.tool.toolResult) {
    assert.strictEqual(h2.tool.toolResult.success, false, 'Unavailable app tool execution must return success=false');
  } else {
    assert(h2.done && /doesn't exist|not found|unable|cannot|not installed|unavailable/i.test(h2.done.fullReply), 'Reply must honestly report unavailable app instead of claiming launch');
    assert(!/opening NonExistentAppXYZ99|launched NonExistentAppXYZ99|successfully opened/i.test(h2.done.fullReply), 'Must never falsely claim launch');
  }

  // Also test deterministic backend tool failure paths directly (unavailable app & nonexistent 3D model)
  const { executeTool } = require('../server/toolsRegistry.js');
  const hAppErr = await executeTool('open_desktop_app', { appName: 'NonExistentAppXYZ99' }, 'JARVIS');
  assert.strictEqual(hAppErr.success, false, 'open_desktop_app must return success=false for unavailable app');
  const h3dErr = await executeTool('get_3d_model', { modelId: 'nonexistent_model_id_999' }, 'JARVIS');
  assert.strictEqual(h3dErr.success, false, 'get_3d_model must return success=false for missing model');
  results.testH = 'PASS (Truthful failure returned for unknown Chrome profile, unavailable app & invalid 3D model; zero fake claims)';
  console.log('  ✅', results.testH);

  // -------------------------------------------------------------------------
  // TEST I: Emergency Stop & Mission Control Live Telemetry
  // -------------------------------------------------------------------------
  console.log('Running Test I: Emergency Stop Enforcement & Mission Control Telemetry...');
  await postJson('/api/security/emergency-stop', { reason: 'Acceptance Test I Verification' });
  const i1 = await postJson('/api/chat/stream', { message: 'enable screen observation', personality: 'JARVIS' });
  assert.strictEqual(i1.status, 423, `Emergency Stop MUST lock /api/chat/stream with HTTP 423, got ${i1.status}`);
  assert(/EMERGENCY_STOP/i.test(JSON.stringify(i1.body || {})),
    'Response body MUST explicitly report EMERGENCY_STOP_ACTIVE when Emergency Stop is engaged');

  const mc = await getJson('/api/mission-control/status');
  assert.strictEqual(mc.body.system.emergencyStop, true, 'Mission Control must report emergencyStop=true');
  assert(mc.body.subsystems.simulations.activeCount >= 1, 'Mission Control must count live simulations');
  assert(mc.body.subsystems.models3D.activeCount >= 1, 'Mission Control must count live 3D models');

  await postJson('/api/security/emergency-reset', {});
  const mcAfter = await getJson('/api/mission-control/status');
  assert.strictEqual(mcAfter.body.system.emergencyStop, false, 'Mission Control must report emergencyStop=false after reset');
  results.testI = 'PASS (Emergency Stop blocked execution cleanly & reset verified in Mission Control)';
  console.log('  ✅', results.testI);

  console.log('\n===============================================================');
  console.log(' ALL REAL WINDOWS & LIVE BROWSER ACCEPTANCE TESTS (A-I) PASSED');
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('\n❌ ACCEPTANCE SUITE FAILED:', err);
  process.exit(1);
});
