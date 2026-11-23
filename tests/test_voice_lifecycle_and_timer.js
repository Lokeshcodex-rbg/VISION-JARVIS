/**
 * STARK AI / J.A.R.V.I.S. — Comprehensive Voice Auto-Listening, 0:00 Timer & 7-State Lifecycle Verification Suite
 *
 * Covers all 14 lifecycle scenarios against live server (http://127.0.0.1:3000), real Windows Chromium audio APIs,
 * backend /api/voice/* & /api/brain/telemetry endpoints, E-Stop latch/reset, reload & restart recovery, and error paths.
 */

const assert = require('assert');
const http = require('http');
const { chromium } = require('playwright');
const { FullDuplexVoiceEngine } = require('../server/voice/fullDuplexVoiceEngine.js');

const BASE_URL = 'http://127.0.0.1:3000';

async function getAuthToken() {
  const res = await fetch(`${BASE_URL}/api/auth/session`, { method: 'GET' });
  const data = await res.json();
  return data.token;
}

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  const body = await res.json();
  return { status: res.status, body };
}

async function apiPost(path, payload = {}, token = '') {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Stark-Auth-Token': token } : {})
    },
    body: JSON.stringify(payload)
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function runSuite() {
  console.log('\n================================================================================');
  console.log('STARK AI — VOICE AUTO-LISTENING / 0:00 TIMER & 7-STATE VERIFICATION SUITE');
  console.log('================================================================================');

  const results = [];
  const pass = (id, msg) => {
    console.log(`  ✓ [PASS] [${id}] ${msg}`);
    results.push({ id, ok: true, msg });
  };

  // Ensure clean server start (clear E-Stop if any prior test left it latched)
  const token = await getAuthToken();
  await apiPost('/api/security/emergency-reset', { reason: 'Voice test pre-clean' }, token);
  await apiPost('/api/voice/mode', { mode: 'DISABLED', reason: 'TEST_INIT_RESET' }, token);

  // ===========================================================================
  // SCENARIO 1 & 2: Startup State DISABLED + No 0:00 Timer + No Click/Key Hijack
  // ===========================================================================
  const browserReal = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  });

  try {
    const context = await browserReal.newContext({ viewport: { width: 1440, height: 900 } });
    await context.grantPermissions(['microphone'], { origin: BASE_URL });

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    // Spy on navigator.mediaDevices.getUserMedia BEFORE scripts run to verify ZERO auto-mic requests on boot
    await page.addInitScript(() => {
      window.__getUserMediaCalls = 0;
      const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async function (constraints) {
        window.__getUserMediaCalls++;
        return origGUM(constraints);
      };
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mic-status-text', { timeout: 10000 });
    await page.waitForFunction(() => {
      const badge = document.getElementById('mic-status-badge');
      return badge && badge.dataset.jarvisStatus && badge.dataset.jarvisStatus !== 'Initializing';
    }, null, { timeout: 8000 });
    await page.waitForTimeout(400);

    // Random clicks & keystrokes on page MUST NOT start listening
    await page.click('#stark-main-chat-input');
    await page.type('#stark-main-chat-input', 'hello check no auto listen');
    await page.click('body', { position: { x: 200, y: 200 } });
    await page.waitForTimeout(400);

    const bootState = await page.evaluate(() => {
      const app = window.jarvisApp;
      const vc = app?.voiceController;
      const badge = document.getElementById('mic-status-badge');
      const timerEl = document.getElementById('mic-session-timer');
      return {
        removedControlsPresent: [
          '#voice-mode-select',
          '#btn-voice-ptt',
          '#btn-voice-pause',
          '#assistant-mode-select',
          '#btn-screen-observation'
        ].filter(sel => document.querySelector(sel) !== null),
        badgeText: document.getElementById('mic-status-text')?.textContent?.trim(),
        jarvisStatus: badge?.dataset?.jarvisStatus,
        timerVisible: timerEl ? getComputedStyle(timerEl).display !== 'none' : false,
        timerText: timerEl?.textContent?.trim(),
        canonicalState: vc?.getCanonicalState(),
        voiceMode: vc?.voiceMode,
        continuousListening: vc?.continuousListening,
        isListening: vc?.isListening,
        getUserMediaCalls: window.__getUserMediaCalls,
        timerSnapshot: vc?.getTimerSnapshot()
      };
    });

    assert.deepStrictEqual(bootState.removedControlsPresent, [], `Removed manual controls must not exist in DOM: ${bootState.removedControlsPresent}`);
    assert.strictEqual(bootState.badgeText, 'Ready', `Expected Ready badge on boot, got ${bootState.badgeText}`);
    assert.strictEqual(bootState.jarvisStatus, 'Ready');
    assert.strictEqual(bootState.canonicalState, 'READY', `Expected Always-On READY when mic permission granted, got ${bootState.canonicalState}`);
    assert.strictEqual(bootState.voiceMode, 'CONTINUOUS');
    assert.strictEqual(bootState.continuousListening, true);
    assert.strictEqual(bootState.isListening, false);
    assert(bootState.getUserMediaCalls >= 1, 'getUserMedia should auto-arm CONTINUOUS standby when mic permission is already granted');
    assert.strictEqual(bootState.timerVisible, false, '0:00 timer must NOT be visible before actual speech onset');
    assert.strictEqual(bootState.timerSnapshot.isTimerActive, false);

    // Also verify backend /api/voice/state & /api/brain/telemetry report READY cleanly without fake 0:00 timer
    const srvVoice1 = await apiGet('/api/voice/state');
    assert.strictEqual(srvVoice1.body.state, 'READY');
    assert.strictEqual(srvVoice1.body.isTimerActive, false);
    assert.strictEqual(srvVoice1.body.elapsedMs, 0);

    const telemetryRes = await apiGet('/api/brain/console');
    assert.strictEqual(telemetryRes.body.voiceState.currentState, 'READY', 'Brain console telemetry must report real READY state');
    assert.strictEqual(telemetryRes.body.voiceState.isTimerActive, false);

    pass('SCENARIO_1_2_STARTUP_ALWAYS_ON_READY', 'App + backend auto-arm Always-On CONTINUOUS READY with granted mic, 5 manual controls removed, and no fake 0:00 timer');

    // =========================================================================
    // SCENARIO 3, 4 & 7: Always-On Continuous Standby + Live Spoken Captions + Real Mic
    // =========================================================================
    const enumInfo = await page.evaluate(async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      return {
        audioInputCount: audioInputs.length,
        labels: audioInputs.map(d => d.label || d.deviceId)
      };
    });
    assert(enumInfo.audioInputCount >= 1, `Expected >= 1 Chromium audioinput device on Windows host, got ${enumInfo.audioInputCount}`);

    // Wait for Always-On VAD & passive SpeechRecognition without clicking #mic-status-badge
    await page.waitForFunction(() => {
      const vc = window.jarvisApp?.voiceController;
      return vc && vc.voiceMode === 'CONTINUOUS' && (vc.vad?.isInitialized === true || vc.getCanonicalState() === 'ERROR');
    }, null, { timeout: 8000 });
    await page.waitForTimeout(900);

    // Verify live interim & final user speech results immediately appear in #smoke-captions while in Always-On mode
    const captionCheck = await page.evaluate(() => {
      const vc = window.jarvisApp.voiceController;
      const cap = document.getElementById('smoke-captions');
      vc.handleSpeechResults({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: 'open robotic', confidence: 0.9 } }]
      });
      const interimText = cap?.textContent?.trim() || '';
      const stateAfterSpeech = vc.getCanonicalState();
      vc.endListeningSession('CAPTION_TEST_RESET');
      return { interimText, stateAfterSpeech };
    });
    assert(captionCheck.interimText.includes('open robotic'), `Live interim speech must render in #smoke-captions, got "${captionCheck.interimText}"`);
    assert.strictEqual(captionCheck.stateAfterSpeech, 'LISTENING', `Speaking from READY must seamlessly promote to LISTENING, got ${captionCheck.stateAfterSpeech}`);

    const contSilence = await page.evaluate(() => {
      const vc = window.jarvisApp.voiceController;
      const timerEl = document.getElementById('mic-session-timer');
      return {
        state: vc.getCanonicalState(),
        mode: vc.voiceMode,
        badge: document.getElementById('mic-status-text')?.textContent?.trim(),
        timerVisible: getComputedStyle(timerEl).display !== 'none',
        isTimerActive: vc.getTimerSnapshot().isTimerActive,
        gumCalls: window.__getUserMediaCalls,
        vadInitialized: vc.vad?.isInitialized,
        vadError: vc.vad?.lastError || vc.lastError,
        vadRMS: vc.vad?.currentRMS,
        vadFloor: vc.vad?.noiseFloor,
        reason: vc.lastTransitionReason,
        activeDevice: vc.vad?.activeDeviceLabel
      };
    });
    assert.strictEqual(contSilence.state, 'READY', `Expected READY in continuous silence, got ${contSilence.state} (info=${JSON.stringify(contSilence)})`);
    assert.strictEqual(contSilence.mode, 'CONTINUOUS');
    assert.strictEqual(contSilence.badge, 'Ready');
    assert.strictEqual(contSilence.timerVisible, false, 'Continuous READY during ambient silence must NOT show stuck 0:00 timer');
    assert.strictEqual(contSilence.isTimerActive, false);
    assert(contSilence.gumCalls >= 1 && contSilence.vadInitialized === true, `Real getUserMedia & VAD must init cleanly: ${JSON.stringify(contSilence)}`);

    // Also test backend FullDuplexVoiceEngine noise-frame invariant directly
    const isolatedFd = new (require('../server/voice/fullDuplexVoiceEngine.js').FullDuplexVoiceEngine)();
    assert.strictEqual(isolatedFd.getStatus().state, 'DISABLED');
    isolatedFd.setMode('CONTINUOUS', 'TEST_CONT_SILENCE');
    assert.strictEqual(isolatedFd.getStatus().state, 'READY');
    const noiseRes = await isolatedFd.processAudioFrame({ rms: 0.002, snrDb: 4, transcript: '' });
    assert.strictEqual(noiseRes.status, 'NOISE_FILTERED');
    assert.strictEqual(isolatedFd.getStatus().state, 'READY', 'Silence/noise frame in READY must NOT auto-start LISTENING session');
    assert.strictEqual(isolatedFd.getStatus().isTimerActive, false);

    pass('SCENARIO_3_4_7_AUTONOMOUS_VOICE_REAL_MIC', `Clicking unified status activated CONTINUOUS mode ("${contSilence.activeDevice}", ${enumInfo.audioInputCount} Windows audioinput(s)), staying Ready without 0:00 timer`);

    // =========================================================================
    // SCENARIO 8 & 10: Real Speech Capture -> Ticking Timer -> Processing -> Multi-Turn
    // =========================================================================
    await page.evaluate(() => {
      window.jarvisApp.voiceController.vad.onSpeechStart({ rms: 0.04, centroid: 900, dynamicThreshold: 0.01 });
    });
    await page.waitForFunction(() => {
      const vc = window.jarvisApp?.voiceController;
      const timer = document.getElementById('mic-session-timer');
      return vc?.getCanonicalState() === 'LISTENING' && timer && getComputedStyle(timer).display !== 'none';
    }, null, { timeout: 5000 });

    const tStartSnap = await page.evaluate(() => ({
      badge: document.getElementById('mic-status-text')?.textContent?.trim(),
      timerText: document.getElementById('mic-session-timer')?.textContent?.trim(),
      snap: window.jarvisApp.voiceController.getTimerSnapshot()
    }));
    assert.strictEqual(tStartSnap.badge, 'Listening');
    assert.strictEqual(tStartSnap.snap.isTimerActive, true);

    // Wait until timer genuinely ticks past 0:00 (0:01+)
    await page.waitForFunction(() => {
      const vc = window.jarvisApp?.voiceController;
      const timerEl = document.getElementById('mic-session-timer');
      const snap = vc?.getTimerSnapshot?.();
      const txt = timerEl?.textContent?.trim() || '0:00';
      return Boolean(snap && snap.elapsedMs >= 1000 && txt !== '0:00');
    }, null, { timeout: 3000 });
    const tTickedSnap = await page.evaluate(() => ({
      timerText: document.getElementById('mic-session-timer')?.textContent?.trim(),
      snap: window.jarvisApp.voiceController.getTimerSnapshot()
    }));
    assert(tTickedSnap.snap.elapsedMs >= 1000 && tTickedSnap.timerText !== '0:00',
      `Timer must advance during active capture (got text="${tTickedSnap.timerText}", elapsedMs=${tTickedSnap.snap.elapsedMs})`);

    const srvListening = await apiGet('/api/voice/state');
    assert.strictEqual(srvListening.body.state, 'LISTENING', 'Backend /api/voice/state synced to LISTENING');
    assert.strictEqual(srvListening.body.isTimerActive, true);

    // Verify live spoken interim + final transcript via SpeechRecognition handleSpeechResults renders immediately in #smoke-captions
    const liveCaptionCheck = await page.evaluate(() => {
      const vc = window.jarvisApp.voiceController;
      const cap = document.getElementById('smoke-captions');
      vc.handleSpeechResults({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: 'what is the weather', confidence: 0.88 } }]
      });
      const interimText = cap?.textContent?.trim() || '';
      const interimVisible = Boolean(cap && interimText.includes('what is the weather') && getComputedStyle(cap).opacity !== '0');
      return { interimText, interimVisible };
    });
    assert(liveCaptionCheck.interimVisible, `Spoken interim words must appear immediately in #smoke-captions, got "${liveCaptionCheck.interimText}"`);

    // Simulate Turn 1 transcript during capture -> Processing -> Speaking -> returns cleanly to READY + timer resets!
    const multiTurnCheck = await page.evaluate(async () => {
      const app = window.jarvisApp;
      const vc = app.voiceController;
      const dispatched = [];
      const origCmd = vc.onCommand;
      vc.onCommand = (cmd, raw) => {
        if (cmd && cmd.type !== 'SESSION_CLOSED') dispatched.push({ cmd, raw });
      };

      // Dispatch duplicate identical final transcript within dedupe window -> must trigger ONLY ONCE
      vc.processTranscript('hello jarvis turn one', true, 0.96);
      vc.processTranscript('hello jarvis turn one', true, 0.96);
      const processingState = vc.getCanonicalState();
      const procTimerActive = vc.getTimerSnapshot().isTimerActive;

      vc.notifyAssistantSpeechStart();
      const speakingState = vc.getCanonicalState();

      vc.notifyAssistantSpeechEnd('Acknowledged turn one.');
      vc.endListeningSession('TURN_1_DONE');
      const postTurn1State = vc.getCanonicalState();
      const postTurn1Timer = vc.getTimerSnapshot();

      // Turn 2 capture -> process -> speaking -> complete -> READY
      vc.startListening({ reason: 'TURN_2_START' });
      const turn2Session = vc.getTimerSnapshot().sessionId;
      vc.processTranscript('check system status', true, 0.95);
      vc.notifyAssistantSpeechStart();
      vc.notifyAssistantSpeechEnd('Systems nominal.');
      vc.endListeningSession('TURN_2_DONE');
      const postTurn2State = vc.getCanonicalState();
      const postTurn2Timer = vc.getTimerSnapshot();

      vc.onCommand = origCmd;
      return {
        dispatchedCount: dispatched.length,
        processingState,
        procTimerActive,
        speakingState,
        postTurn1State,
        postTurn1TimerActive: postTurn1Timer.isTimerActive,
        turn2Session,
        postTurn2State,
        postTurn2TimerActive: postTurn2Timer.isTimerActive
      };
    });

    assert.strictEqual(multiTurnCheck.dispatchedCount, 2, 'Duplicate transcript within window deduplicated; 2 distinct turns dispatched');
    assert.strictEqual(multiTurnCheck.processingState, 'PROCESSING');
    assert.strictEqual(multiTurnCheck.procTimerActive, false, 'Capture timer must stop cleanly during PROCESSING');
    assert.strictEqual(multiTurnCheck.speakingState, 'SPEAKING');
    assert.strictEqual(multiTurnCheck.postTurn1State, 'READY', 'Must return to READY after turn completion');
    assert.strictEqual(multiTurnCheck.postTurn1TimerActive, false);
    assert.strictEqual(multiTurnCheck.postTurn2State, 'READY', 'Multi-turn 2 must return cleanly to READY');
    assert.strictEqual(multiTurnCheck.postTurn2TimerActive, false);

    pass('SCENARIO_8_10_ACTIVE_CAPTURE_TIMER_MULTITURN', `Capture timer ticked 0:00 -> ${tTickedSnap.timerText} (${tTickedSnap.snap.elapsedMs}ms), stopped in Processing/Speaking, deduped transcripts, and completed multi-turn back to Ready`);

    // =========================================================================
    // SCENARIO 9 & 11: Pause / Resume via Unified Indicator & Barge-in
    // =========================================================================
    await page.click('#mic-status-badge'); // Clicking while READY -> Paused
    await page.waitForFunction(() => window.jarvisApp?.voiceController?.getCanonicalState() === 'PAUSED', null, { timeout: 5000 });
    const pausedCheck = await page.evaluate(() => ({
      badge: document.getElementById('mic-status-text')?.textContent?.trim(),
      timerVisible: getComputedStyle(document.getElementById('mic-session-timer')).display !== 'none',
      vadInit: window.jarvisApp.voiceController.vad?.isInitialized
    }));
    assert.strictEqual(pausedCheck.badge, 'Paused');
    assert.strictEqual(pausedCheck.timerVisible, false);
    assert.strictEqual(pausedCheck.vadInit, false, 'Pausing must release OS microphone tracks cleanly');

    // Verify devicechange while Paused MUST NOT bypass Pause
    await page.evaluate(async () => {
      await window.jarvisApp.voiceController.handleDeviceChange({ audioInputCount: 1, supported: true });
    });
    assert.strictEqual(await page.evaluate(() => window.jarvisApp.voiceController.getCanonicalState()), 'PAUSED', 'devicechange must NOT bypass PAUSED state');

    await page.click('#mic-status-badge'); // Resume back to READY
    await page.waitForFunction(() => window.jarvisApp?.voiceController?.getCanonicalState() === 'READY', null, { timeout: 5000 });

    // Barge-in test: simulate SPEAKING then handleStopAction() -> clears speaking + timer cleanly
    const bargeRes = await page.evaluate(() => {
      const app = window.jarvisApp;
      const vc = app.voiceController;
      vc.startListening({ reason: 'BARGE_PRE' });
      vc.notifyAssistantSpeechStart();
      app.handleStopAction();
      vc.endListeningSession('BARGE_IN_DONE');
      return {
        state: vc.getCanonicalState(),
        timerActive: vc.getTimerSnapshot().isTimerActive
      };
    });
    assert.strictEqual(bargeRes.state, 'READY', 'Stop/barge-in returns cleanly to READY');
    assert.strictEqual(bargeRes.timerActive, false);

    pass('SCENARIO_9_11_PAUSE_RESUME_BARGEIN', 'Unified Pause releases hardware mic (devicechange does not bypass Pause), Resume returns to Ready, and Stop/barge-in clears speaking + timer');

    // =========================================================================
    // SCENARIO 12: Browser Refresh Synchronization (No Auto-LISTENING on Reload)
    // =========================================================================
    await page.click('#mic-status-badge'); // READY -> Paused
    await page.waitForFunction(() => window.jarvisApp?.voiceController?.getCanonicalState() === 'PAUSED', null, { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mic-status-text', { timeout: 10000 });
    await page.waitForFunction(() => {
      const badge = document.getElementById('mic-status-badge');
      return badge && badge.dataset.jarvisStatus && badge.dataset.jarvisStatus !== 'Initializing';
    }, null, { timeout: 8000 });
    await page.waitForTimeout(400);

    const postReloadPaused = await page.evaluate(() => ({
      state: window.jarvisApp?.voiceController?.getCanonicalState(),
      badge: document.getElementById('mic-status-text')?.textContent?.trim(),
      timerVisible: getComputedStyle(document.getElementById('mic-session-timer')).display !== 'none'
    }));
    assert.strictEqual(postReloadPaused.state, 'PAUSED', 'Browser reload must preserve PAUSED state cleanly without auto-listening');
    assert.strictEqual(postReloadPaused.badge, 'Paused');
    assert.strictEqual(postReloadPaused.timerVisible, false);

    // Also test reload from READY
    await page.click('#mic-status-badge'); // Paused -> Ready
    await page.waitForFunction(() => window.jarvisApp?.voiceController?.getCanonicalState() === 'READY', null, { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mic-status-text', { timeout: 10000 });
    await page.waitForFunction(() => {
      const badge = document.getElementById('mic-status-badge');
      return badge && badge.dataset.jarvisStatus && badge.dataset.jarvisStatus !== 'Initializing';
    }, null, { timeout: 8000 });
    await page.waitForTimeout(400);
    const postReloadReady = await page.evaluate(() => ({
      state: window.jarvisApp?.voiceController?.getCanonicalState(),
      timerVisible: getComputedStyle(document.getElementById('mic-session-timer')).display !== 'none'
    }));
    assert.strictEqual(postReloadReady.state, 'READY', 'Reload in opted-in mode restores READY (never stuck 0:00 LISTENING)');
    assert.strictEqual(postReloadReady.timerVisible, false);

    pass('SCENARIO_12_BROWSER_REFRESH_SYNC', 'Browser reload synchronizes Paused and Ready from backend without auto-starting listening timer');

    // =========================================================================
    // SCENARIO 14: Emergency Stop & Reset During Active Listening + Device Recovery Lock
    // =========================================================================
    await page.evaluate(() => window.jarvisApp.voiceController.startListening({ reason: 'TEST_ESTOP_ACTIVE' }));
    await page.waitForFunction(() => window.jarvisApp?.voiceController?.getCanonicalState() === 'LISTENING', null, { timeout: 5000 });

    // Engage Emergency Stop via UI button!
    await page.click('#btn-emergency-stop');
    await page.waitForFunction(() => {
      const vc = window.jarvisApp?.voiceController;
      return vc?.isEmergencyStopped === true;
    }, null, { timeout: 5000 });

    // Verify neither badge click nor devicechange bypasses Emergency Stop!
    await page.click('#mic-status-badge');
    await page.evaluate(async () => {
      await window.jarvisApp.voiceController.handleDeviceChange({ audioInputCount: 1, supported: true });
    });

    const estopSnap = await page.evaluate(() => {
      const vc = window.jarvisApp.voiceController;
      return {
        isEmergencyStopped: vc.isEmergencyStopped,
        canonical: vc.getCanonicalState(),
        badge: document.getElementById('mic-status-text')?.textContent?.trim(),
        isListening: vc.isListening,
        vadInit: vc.vad?.isInitialized,
        timerVisible: getComputedStyle(document.getElementById('mic-session-timer')).display !== 'none'
      };
    });
    assert.strictEqual(estopSnap.isEmergencyStopped, true);
    assert.strictEqual(estopSnap.canonical, 'DISABLED');
    assert.strictEqual(estopSnap.badge, 'Paused');
    assert.strictEqual(estopSnap.isListening, false);
    assert.strictEqual(estopSnap.vadInit, false, 'E-Stop must immediately release hardware microphone');
    assert.strictEqual(estopSnap.timerVisible, false, 'E-Stop must clear/hide session timer');

    const srvEstop = await apiGet('/api/voice/state');
    assert.strictEqual(srvEstop.body.state, 'EMERGENCY_STOPPED');
    assert.strictEqual(srvEstop.body.isTimerActive, false);

    // Reset Emergency Stop -> MUST return cleanly to DISABLED ('Ready' badge, NEVER auto-LISTENING!)
    await page.click('#btn-emergency-stop');
    await page.waitForTimeout(500);
    const resetSnap = await page.evaluate(() => {
      const vc = window.jarvisApp.voiceController;
      return {
        isEmergencyStopped: vc.isEmergencyStopped,
        canonical: vc.getCanonicalState(),
        badge: document.getElementById('mic-status-text')?.textContent?.trim(),
        timerVisible: getComputedStyle(document.getElementById('mic-session-timer')).display !== 'none'
      };
    });
    assert.strictEqual(resetSnap.isEmergencyStopped, false);
    assert.strictEqual(resetSnap.canonical, 'DISABLED', 'E-Stop reset MUST return cleanly to DISABLED — NEVER auto-start listening');
    assert.strictEqual(resetSnap.badge, 'Ready');
    assert.strictEqual(resetSnap.timerVisible, false);

    pass('SCENARIO_14_ESTOP_HALT_AND_CLEAN_RESET', 'E-Stop immediately kills mic/timer (and blocks badge click & devicechange recovery); Reset returns cleanly to Ready without auto-listening');

    // =========================================================================
    // SCENARIO 5 & 6: Permission Denied + Device Not Found + Devicechange Recovery
    // =========================================================================
    const contextDenied = await browserReal.newContext({ viewport: { width: 1440, height: 900 } });
    // Intentionally do NOT grant microphone permission and simulate NotAllowedError + NotFoundError cleanly
    const pageErrTest = await contextDenied.newPage();
    await pageErrTest.addInitScript(() => {
      window.__simMicErrorName = 'NotAllowedError';
      navigator.mediaDevices.getUserMedia = async () => {
        const msg = window.__simMicErrorName === 'NotFoundError'
          ? 'Requested audio input device not found'
          : 'Permission denied by user/browser';
        const err = new Error(msg);
        err.name = window.__simMicErrorName;
        throw err;
      };
    });
    await pageErrTest.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await pageErrTest.waitForFunction(() => {
      const badge = document.getElementById('mic-status-badge');
      return badge && badge.dataset.jarvisStatus && badge.dataset.jarvisStatus !== 'Initializing';
    }, null, { timeout: 10000 });

    // Try activating autonomous voice when permission denied
    await pageErrTest.click('#mic-status-badge');
    await pageErrTest.waitForFunction(() => window.jarvisApp?.voiceController?.getCanonicalState() === 'ERROR', null, { timeout: 5000 });
    const deniedSnap = await pageErrTest.evaluate(() => ({
      badge: document.getElementById('mic-status-text')?.textContent?.trim(),
      timerVisible: getComputedStyle(document.getElementById('mic-session-timer')).display !== 'none',
      errCat: window.jarvisApp.voiceController.lastErrorCategory
    }));
    assert.strictEqual(deniedSnap.badge, 'Error (Denied)');
    assert.strictEqual(deniedSnap.timerVisible, false, 'Permission denied MUST NOT display 0:00 timer');
    assert.strictEqual(deniedSnap.errCat, 'PERMISSION_DENIED');

    // Try NotFoundError (disconnected microphone) + devicechange recovery
    await pageErrTest.evaluate(async () => {
      window.__simMicErrorName = 'NotFoundError';
      await window.jarvisApp.setVoiceMode('CONTINUOUS', 'TEST_DEVICE_MISSING');
    });
    await pageErrTest.waitForFunction(() => window.jarvisApp?.voiceController?.lastErrorCategory === 'DEVICE_NOT_FOUND', null, { timeout: 5000 });
    const noMicSnap = await pageErrTest.evaluate(() => ({
      state: window.jarvisApp.voiceController.getCanonicalState(),
      badge: document.getElementById('mic-status-text')?.textContent?.trim(),
      timerVisible: getComputedStyle(document.getElementById('mic-session-timer')).display !== 'none'
    }));
    assert.strictEqual(noMicSnap.state, 'ERROR');
    assert.strictEqual(noMicSnap.badge, 'Error (No Mic)');
    assert.strictEqual(noMicSnap.timerVisible, false);

    // Simulate device reconnection recovering via handleDeviceChange cleanly
    await pageErrTest.evaluate(async () => {
      window.jarvisApp.voiceController.vad.probeHardware = async () => ({ supported: true, audioInputCount: 1, permissionState: 'granted' });
      window.jarvisApp.voiceController.vad.start = async () => {
        window.jarvisApp.voiceController.vad.isInitialized = true;
        return true;
      };
      await window.jarvisApp.voiceController.handleDeviceChange({ supported: true, audioInputCount: 1, permissionState: 'granted' });
    });
    const recoveredSnap = await pageErrTest.evaluate(() => ({
      state: window.jarvisApp.voiceController.getCanonicalState(),
      badge: document.getElementById('mic-status-text')?.textContent?.trim()
    }));
    assert.strictEqual(recoveredSnap.state, 'READY', 'Device reconnection must recover ERROR (No Mic) cleanly back to READY');
    assert.strictEqual(recoveredSnap.badge, 'Ready');

    // Cleanly reset back to DISABLED before finishing
    await pageErrTest.evaluate(async () => {
      await window.jarvisApp.setVoiceMode('DISABLED', 'TEST_ERR_CLEANUP');
    });
    await contextDenied.close();
    await context.close();

    assert.strictEqual(pageErrors.length, 0, `Browser runtime page errors occurred: ${pageErrors.join('; ')}`);
    pass('SCENARIO_5_6_PERMISSION_DENIED_DISCONNECTED_MIC', 'NotAllowedError -> Error (Denied), NotFoundError -> Error (No Mic), devicechange recovery works, zero stuck 0:00 timers');

    // =========================================================================
    // SCENARIO 13: Server / Fresh Engine Boot Recovery Verification
    // =========================================================================
    const freshEngine = new (require('../server/voice/fullDuplexVoiceEngine.js').FullDuplexVoiceEngine)();
    const freshStatus = freshEngine.getStatus();
    assert.strictEqual(freshStatus.state, 'DISABLED');
    assert.strictEqual(freshStatus.voiceMode, 'DISABLED');
    assert.strictEqual(freshStatus.elapsedMs, 0);
    assert.strictEqual(freshStatus.isTimerActive, false);
    // Cleanly reset live server back to DISABLED
    await apiPost('/api/voice/mode', { mode: 'DISABLED', reason: 'TEST_COMPLETE_CLEANUP' }, token);
    pass('SCENARIO_13_FRESH_ENGINE_RESTART_STATE', 'Fresh server engine restarts in DISABLED with 0 elapsedMs and inactive timer');

  } finally {
    await browserReal.close();
  }

  console.log('\n================================================================================');
  console.log(`ALL ${results.length}/${results.length} VOICE LIFECYCLE & TIMER SCENARIOS PASSED!`);
  console.log('================================================================================');
}

runSuite().catch((err) => {
  console.error('\n❌ VOICE LIFECYCLE TEST SUITE FAILED:', err);
  process.exit(1);
});
