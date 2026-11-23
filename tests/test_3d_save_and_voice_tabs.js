/**
 * Verification Suite:
 * 1) Persistent 3D CAD Save / Save-As / Vault / Pose restoration inside JARVIS
 * 2) Enhanced 3D CAD Viewport UI controls (presets, grid, studio light, snapshot, vault, live HUD)
 * 3) Voice listening pill, live captions (#smoke-captions), and responses across #stark-3d-modal AND non-default tabs
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:3000';

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function fetchAuthToken() {
  const res = await fetch(`${BASE_URL}/api/auth/session`);
  assert(res.ok, `GET /api/auth/session HTTP ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function runTests() {
  console.log('=== [TEST] 3D Save Vault + Voice/Captions Across Modals & Tabs ===\n');

  // 0. Server health check
  const healthRes = await fetch(`${BASE_URL}/`);
  assert(healthRes.ok, `Server root check failed: ${healthRes.status}`);
  const token = await fetchAuthToken();

  // 1. Backend API Save & Save-As Round-Trip
  console.log('1. Testing backend create -> save -> list -> saveAsNew -> get...');
  const createRes = await fetch(`${BASE_URL}/api/tools/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Stark-Auth-Token': token },
    body: JSON.stringify({
      toolName: 'create_3d_model',
      params: { description: '6-DOF Robotic Arm Save Test', archetype: 'robotic_arm', theme: 'holographic' }
    })
  });
  const created = await createRes.json();
  assert(created.success && created.result?.modelId, `create_3d_model failed: ${JSON.stringify(created)}`);
  const modelId = created.result.modelId;

  const saveRes = await fetch(`${BASE_URL}/api/3d-model/${encodeURIComponent(modelId)}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Precision_Arm_Saved',
      notes: 'Joint torque calibrated at 18Nm',
      theme: 'titanium',
      jointStates: { j1_waist: 37, j3_elbow: 75 },
      viewState: { exploded: true, wireframe: false, showGrid: true }
    })
  });
  const savedPayload = await saveRes.json();
  assert(saveRes.ok && savedPayload.success && savedPayload.verified, `Save failed: ${JSON.stringify(savedPayload)}`);
  assert(savedPayload.model.name === 'Precision_Arm_Saved', 'Saved name mismatch');
  assert(savedPayload.model.saved === true, 'Saved flag should be true');
  assert(savedPayload.model.savedJointPose?.j1_waist === 37, `Expected savedJointPose.j1_waist=37, got ${savedPayload.model.savedJointPose?.j1_waist}`);
  assert(savedPayload.model.savedJointPose?.j3_elbow === 75, `Expected savedJointPose.j3_elbow=75, got ${savedPayload.model.savedJointPose?.j3_elbow}`);
  assert(fs.existsSync(savedPayload.model.files.obj), 'Saved OBJ missing on disk');
  assert(fs.existsSync(savedPayload.model.files.stl), 'Saved STL missing on disk');
  assert(fs.existsSync(savedPayload.model.files.metadata), 'Saved metadata.json missing on disk');

  const getRes = await fetch(`${BASE_URL}/api/3d-model/${encodeURIComponent(modelId)}`);
  const getData = await getRes.json();
  assert(getRes.ok && getData.success && getData.model?.name === 'Precision_Arm_Saved', 'GET /api/3d-model/:id round-trip mismatch');

  const listRes = await fetch(`${BASE_URL}/api/3d-model/list`);
  const listData = await listRes.json();
  assert(listRes.ok && listData.success && Array.isArray(listData.models), 'GET /api/3d-model/list failed');
  assert(listData.models.some((m) => m.modelId === modelId), 'Saved model missing from list');

  const saveAsRes = await fetch(`${BASE_URL}/api/3d-model/${encodeURIComponent(modelId)}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Precision_Arm_Fork', saveAsNew: true })
  });
  const saveAsData = await saveAsRes.json();
  assert(saveAsRes.ok && saveAsData.success && saveAsData.model.modelId !== modelId, 'Save-As should create a distinct modelId');
  console.log(`   PASS: Saved "${savedPayload.model.name}" (${modelId}) & Save-As fork (${saveAsData.model.modelId}).`);

  // 2. Live Browser Playwright Tests (3D CAD Save + Vault + Voice & Captions over Modals and Tabs)
  console.log('2. Testing Live UI in headless Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-gl=angle',
      '--use-angle=swiftshader'
    ]
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 860 } });
  await context.grantPermissions(['microphone']);
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
    console.error('[BROWSER PAGEERROR]', err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('[BROWSER CONSOLE ERROR]', msg.text());
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.stark3DViewer && window.jarvisApp && window.jarvisApp.commandAndPermissionUI), null, { timeout: 15000 });
  await page.waitForSelector('#stark-brand-menu-btn', { timeout: 15000 });
  await page.waitForTimeout(300);

  // Open drawer & open 3D CAD Viewport via sidebar quick button
  await page.click('#stark-brand-menu-btn');
  await page.waitForSelector('#btn-quick-robot-cad', { state: 'visible', timeout: 10000 });
  await page.click('#btn-quick-robot-cad');
  await page.waitForFunction(() => {
    const m = document.getElementById('stark-3d-modal');
    return m && getComputedStyle(m).display !== 'none';
  }, null, { timeout: 45000 });

  // Modify design name, notes, joint pose & save directly inside 3D CAD modal
  await page.fill('#stark-3d-name-input', 'Lokesh_Workshop_Arm');
  await page.fill('#stark-3d-notes-input', 'Saved inside CAD viewport');
  await page.evaluate(() => {
    const j1 = document.querySelector('#stark-3d-joints-controls input[data-joint-id="j1_waist"]');
    if (j1) {
      j1.value = '44';
      j1.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  await page.click('#stark-3d-save-btn');
  await page.waitForFunction(() => {
    const s = document.getElementById('stark-3d-save-status');
    return s && /Saved in JARVIS/i.test(s.textContent || '');
  }, null, { timeout: 10000 });

  // Check Saved Vault has Lokesh_Workshop_Arm
  const vaultHasSaved = await page.evaluate(() => {
    const list = document.getElementById('stark-3d-vault-list');
    return list && list.textContent.includes('Lokesh_Workshop_Arm');
  });
  assert(vaultHasSaved, 'Saved model Lokesh_Workshop_Arm did not appear in #stark-3d-vault-list');

  // Test Grid toggle, Studio Light toggle, and Preset Pose buttons inside 3D modal
  await page.click('#stark-3d-grid-btn');
  await page.click('#stark-3d-light-btn');
  await page.click('.stark-3d-preset-btn[data-preset="pick"]');
  const uiStates = await page.evaluate(() => ({
    gridText: document.getElementById('stark-3d-grid-btn')?.innerText,
    lightText: document.getElementById('stark-3d-light-btn')?.innerText,
    j1Val: document.getElementById('stark-3d-jval-j1_waist')?.innerText
  }));
  assert(uiStates.gridText === 'GRID: OFF', `Expected GRID: OFF, got ${uiStates.gridText}`);
  assert(uiStates.lightText === 'LIGHT: STUDIO', `Expected LIGHT: STUDIO, got ${uiStates.lightText}`);
  assert(uiStates.j1Val === '18°', `Expected PICK preset j1=18°, got ${uiStates.j1Val}`);

  // Test inline 3D command input -> directive + JARVIS voice pill + captions over 3D modal
  await page.fill('#stark-3d-voice-input', 'switch to titanium');
  await page.click('#stark-3d-voice-send');
  const themeAfterVoiceCmd = await page.evaluate(() => document.getElementById('stark-3d-theme-btn')?.innerText);
  assert(themeAfterVoiceCmd === 'THEME: TITANIUM', `Expected THEME: TITANIUM, got ${themeAfterVoiceCmd}`);

  // Verify Voice Pill & Always-On live interim+final SpeechRecognition captions float ABOVE #stark-3d-modal (z-index check)
  const preModalVoiceState = await page.evaluate(() => ({
    mode: window.jarvisApp.voiceController?.voiceMode,
    state: window.jarvisApp.voiceController?.getCanonicalState()
  }));
  assert(preModalVoiceState.mode === 'CONTINUOUS', `Expected Always-On CONTINUOUS mode without manual Ready click, got ${preModalVoiceState.mode}`);

  const modalCaptionMetrics = await page.evaluate(() => {
    const app = window.jarvisApp;
    const vc = app.voiceController;

    // 1) Simulate live interim spoken words via SpeechRecognition handleSpeechResults
    vc.handleSpeechResults({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'jarvis explain this joint', confidence: 0.9 } }]
    });
    const interimCapText = document.getElementById('smoke-captions')?.textContent?.trim() || '';

    // 2) Simulate final spoken words & assistant reply sentence
    vc.handleSpeechResults({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'jarvis explain this joint torque', confidence: 0.97 } }]
    });
    const finalCapText = document.getElementById('smoke-captions')?.textContent?.trim() || '';
    app.speechSynthesizer?.onSentenceStart?.('Joint 3 torque load is calibrated and nominal, sir.', 'JARVIS', 'utt_test_1');

    const cap = document.getElementById('smoke-captions');
    const modal = document.getElementById('stark-3d-modal');
    const capZ = Number(getComputedStyle(cap).zIndex || 0);
    const modalZ = Number(getComputedStyle(modal).zIndex || 0);
    const capRect = cap.getBoundingClientRect();
    const modalPillLabel = document.getElementById('stark-3d-voice-label')?.textContent || '';
    const modalCaptionText = document.getElementById('stark-3d-voice-caption')?.textContent || '';
    return {
      capZ,
      modalZ,
      capVisible: cap.textContent.trim().length > 0 && capRect.height > 0,
      interimCapText,
      finalCapText,
      capText: cap.textContent.trim(),
      modalPillLabel,
      modalCaptionText
    };
  });
  assert(modalCaptionMetrics.interimCapText.includes('jarvis explain this joint'), `Live interim speech missing in #smoke-captions: ${modalCaptionMetrics.interimCapText}`);
  assert(modalCaptionMetrics.finalCapText.includes('jarvis explain this joint torque'), `Live final speech missing in #smoke-captions: ${modalCaptionMetrics.finalCapText}`);
  assert(modalCaptionMetrics.capZ > modalCaptionMetrics.modalZ, `#smoke-captions z-index (${modalCaptionMetrics.capZ}) must exceed #stark-3d-modal z-index (${modalCaptionMetrics.modalZ})`);
  assert(modalCaptionMetrics.capVisible, '#smoke-captions did not visibly render over #stark-3d-modal');
  assert(modalCaptionMetrics.modalCaptionText.includes('nominal'), `#stark-3d-voice-caption did not update: ${modalCaptionMetrics.modalCaptionText}`);
  console.log(`   PASS: 3D CAD Save, Vault, Presets, Always-On Live User+Assistant Captions, and Modal overlay (z=${modalCaptionMetrics.capZ} > ${modalCaptionMetrics.modalZ}).`);

  // Close 3D modal, open drawer & switch to Engineering Lab tab, verify captions + voice still work above non-default tab!
  await page.click('#stark-3d-close-btn');
  await page.waitForFunction(() => {
    const m = document.getElementById('stark-3d-modal');
    return !m || getComputedStyle(m).display === 'none';
  }, null, { timeout: 10000 });

  await page.evaluate(() => {
    const panel = document.getElementById('stark-secondary-nav-panel');
    if (panel && getComputedStyle(panel).display === 'none') {
      document.getElementById('stark-brand-menu-btn')?.click();
    }
  });
  await page.waitForSelector('.drawer-view-item[data-view="view-engineering-lab"]', { state: 'visible', timeout: 5000 });
  await page.click('.drawer-view-item[data-view="view-engineering-lab"]');
  await page.waitForFunction(() => {
    const pane = document.getElementById('view-engineering-lab');
    return pane && pane.classList.contains('active-pane') && getComputedStyle(pane).display !== 'none';
  }, null, { timeout: 10000 });

  const tabCaptionMetrics = await page.evaluate(() => {
    const pane = document.getElementById('view-engineering-lab');
    const cap = document.getElementById('smoke-captions');
    const app = window.jarvisApp;
    app.smokeCaptions?.clear?.(true);
    app.speechSynthesizer?.onSentenceStart?.('Engineering tab audio & caption bridge online, sir.', 'JARVIS', 'utt_test_2');
    const paneZ = Number(getComputedStyle(pane).zIndex || 0);
    const capZ = Number(getComputedStyle(cap).zIndex || 0);
    const capRect = cap.getBoundingClientRect();
    const micVisible = getComputedStyle(document.getElementById('mic-status-badge')).display !== 'none';
    return {
      paneZ,
      capZ,
      capVisible: cap.textContent.includes('Engineering tab') && capRect.height > 0,
      micVisible
    };
  });
  assert(tabCaptionMetrics.capZ > tabCaptionMetrics.paneZ, `#smoke-captions z-index (${tabCaptionMetrics.capZ}) must exceed active tab z-index (${tabCaptionMetrics.paneZ})`);
  assert(tabCaptionMetrics.capVisible, 'Captions did not render over active non-default tab view-engineering-lab');
  assert(tabCaptionMetrics.micVisible, '#mic-status-badge should stay visible on view-engineering-lab');

  // Verify persisted saved Lokesh_Workshop_Arm survives full page reload!
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloadedSaved = await page.evaluate(async () => {
    const res = await fetch('/api/3d-model/list');
    const data = await res.json();
    return (data.models || []).find((m) => m.name === 'Lokesh_Workshop_Arm');
  });
  assert(reloadedSaved && reloadedSaved.saved === true, 'Lokesh_Workshop_Arm not persisted after reload');
  assert(reloadedSaved.savedJointPose?.j1_waist === 44 || reloadedSaved.savedJointPose?.j1_waist === 18, `Expected persisted j1_waist angle, got ${JSON.stringify(reloadedSaved.savedJointPose)}`);

  assert(consoleErrors.length === 0, `Unexpected browser page errors: ${consoleErrors.join('; ')}`);

  await browser.close();
  console.log('   PASS: Non-default tab captions/mic verified & full page reload persistence verified.');
  console.log('\n=== ALL 3D SAVE VAULT & CROSS-TAB VOICE/CAPTION CHECKS PASSED ===');
}

runTests().catch((err) => {
  console.error('\nFAILED:', err);
  process.exit(1);
});
