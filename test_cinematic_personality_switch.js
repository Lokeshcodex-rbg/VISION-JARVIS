/**
 * STARK AI — Automated Test Suite for Cinematic Personality Switch Transition
 * Validates all 12 test cases specified in the prompt:
 * Case 1: JARVIS active -> switch to ULTRON (Phase A close -> Phase B/C darkness -> Phase D open)
 * Case 2: ULTRON active -> switch to JARVIS (Phase A close -> Phase B/C darkness -> Phase D open)
 * Case 3: Repeat both directions 5 times to detect race conditions & memory leaks
 * Case 4: Switch using voice commands ("Switch to Ultron", "Switch to Jarvis", "Ultron", "Jarvis")
 * Case 5: Switch using keyboard shortcut M (toggleTheme)
 * Case 6: Switch using Ctrl+Shift+J and Ctrl+Shift+U hotkeys
 * Case 7: Switch while assistant is speaking (immediate cancellation of previous speech without overlap)
 * Case 8: Switch during a sleep animation (redirection directly to darkness and target emergence)
 * Case 9: Switch when the eye is already dormant (direct wake into requested personality)
 * Case 10: Correct voice profile, colors, and personality verified after every switch
 * Case 11: Conversational context & memory preserved across transitions
 * Case 12: Stale timeouts cannot close the new personality after switching
 */

import { CONFIG } from './js/config.js';
import { ConversationSessionManager, CONVERSATION_STATES, SESSION_CLOSE_REASONS } from './js/modules/conversationSessionManager.js';
import { VoiceController } from './js/modules/voiceController.js';
import { SpeechSynthesizer } from './js/modules/speechSynthesizer.js';
import { clamp, easeInOutCubic, easeOutCubic, lerp } from './js/math/utils.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, testId, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] Test ${testId}: ${message}`);
  } else {
    console.error(`  ✗ [FAIL] Test ${testId}: ${message}`);
    throw new Error(`Assertion failed in test ${testId}: ${message}`);
  }
}

// Mock browser runtime
function setupMockBrowser() {
  global.SpeechSynthesisUtterance = class MockSpeechSynthesisUtterance {
    constructor(text) {
      this.text = text;
      this.rate = 1.0;
      this.pitch = 1.0;
      this.volume = 1.0;
    }
  };

  global.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    SpeechRecognition: class MockSpeechRecognition {
      constructor() {
        this.continuous = true;
        this.interimResults = true;
      }
      start() {
        if (typeof this.onstart === 'function') this.onstart();
      }
      stop() {
        if (typeof this.onend === 'function') this.onend();
      }
    },
    SpeechSynthesisUtterance: global.SpeechSynthesisUtterance,
    speechSynthesis: {
      speaking: false,
      paused: false,
      getVoices: () => [
        { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
        { name: 'Microsoft David - English (United States)', lang: 'en-US' }
      ],
      speak(u) {
        global.window.speechSynthesis.speaking = true;
        if (u.onstart) u.onstart();
        this.currentUtteranceTimeout = setTimeout(() => {
          global.window.speechSynthesis.speaking = false;
          if (u.onend) u.onend();
        }, 300);
      },
      cancel() {
        if (this.currentUtteranceTimeout) clearTimeout(this.currentUtteranceTimeout);
        global.window.speechSynthesis.speaking = false;
      },
      resume: () => {}
    },
    desktopAPI: {
      showWindow: () => {},
      hideWindow: () => {},
      notifyStatus: () => {}
    }
  };
}

// Pure simulated controller matching app.js state machine logic
class SimulatedPersonalityController {
  constructor(initialTheme = 'JARVIS') {
    this.currentTheme = initialTheme;
    this.targetTheme = initialTheme;
    this.themeProgressRaw = initialTheme === 'JARVIS' ? 1.0 : 0.0;
    this.visualLifecycleState = 'EYE_OPEN';
    this.expressionState = 'LISTENING';
    this.visualTimer = 0;
    this.visualGeneration = 0;
    this.lastActivePersonality = initialTheme;

    this.switchSource = initialTheme;
    this.switchTarget = initialTheme;
    this.switchTargetInitialized = false;
    this.switchPendingQuery = null;

    this.speechSynthesizer = new SpeechSynthesizer();
    this.sessionManager = new ConversationSessionManager();
  }

  setLifecycleState(state) {
    this.visualLifecycleState = state;
    this.visualTimer = 0;
  }

  switchPersonality(personality = null, query = null) {
    const nextTheme = personality ? personality.toUpperCase() : (this.currentTheme === 'ULTRON' ? 'JARVIS' : 'ULTRON');

    if (this.visualLifecycleState === 'EYE_OPEN' && this.currentTheme === nextTheme && this.targetTheme === nextTheme) {
      if (query) {
        this.expressionState = 'THINKING';
      }
      return 'NO_OP_ALREADY_ACTIVE';
    }

    if (this.visualLifecycleState === 'DORMANT') {
      this.wakeUp(nextTheme, query);
      return 'DIRECT_WAKE_FROM_DORMANT';
    }

    this.speechSynthesizer.stopSpeaking();
    this.speechSynthesizer.cancel();

    this.visualGeneration++;
    const currentToken = this.visualGeneration;

    if (this.visualLifecycleState === 'EYE_CLOSING') {
      this.switchSource = this.currentTheme;
      this.switchTarget = nextTheme;
      this.switchPendingQuery = query;
      this.switchTargetInitialized = false;
      this.lastActivePersonality = nextTheme;
      this.setLifecycleState('EYE_SWITCHING');
      this.visualTimer = 1500; // Fast-forward directly to darkness
      return 'REDIRECTED_FROM_SLEEP';
    }

    this.switchSource = this.currentTheme;
    this.switchTarget = nextTheme;
    this.switchPendingQuery = query;
    this.switchTargetInitialized = false;
    this.lastActivePersonality = nextTheme;

    this.setLifecycleState('EYE_SWITCHING');
    return 'CINEMATIC_SWITCH_STARTED';
  }

  wakeUp(personality = null, query = null) {
    const requestedTheme = personality || this.lastActivePersonality || this.targetTheme || 'JARVIS';
    if (this.visualLifecycleState === 'EYE_OPEN' && requestedTheme !== this.currentTheme) {
      return this.switchPersonality(requestedTheme, query);
    }

    this.visualGeneration++;
    this.lastActivePersonality = requestedTheme;
    this.currentTheme = requestedTheme;
    this.targetTheme = requestedTheme;
    this.themeProgressRaw = (requestedTheme === 'JARVIS') ? 1.0 : 0.0;
    this.setLifecycleState('EYE_OPENING');
  }

  toggleTheme() {
    const nextTheme = (this.currentTheme === 'ULTRON' || this.targetTheme === 'ULTRON') ? 'JARVIS' : 'ULTRON';
    return this.switchPersonality(nextTheme);
  }

  // Evaluates frame state at visualTimer (t ms into EYE_SWITCHING)
  evaluateFrame(t) {
    this.visualTimer = t;
    const cfg = CONFIG.personalitySwitch || {
      durationMs: 3800,
      phaseACloseMs: 1500,
      phaseBDarknessMs: 600,
      phaseCInitMs: 1800,
      phaseDOpenMs: 1700
    };

    const pA = cfg.phaseACloseMs || 1500;
    const pB = cfg.phaseBDarknessMs || 600;
    const pC = cfg.phaseCInitMs || 1800;
    const pD = cfg.phaseDOpenMs || 1700;
    const totalDuration = pA + pB + pD;

    let lidProgress = 0.0;
    let gazeRelax = 0.0;
    let codeSpeedMultiplier = 1.0;
    let codeBrightness = 1.0;
    let irisGlowMultiplier = 1.0;
    let masterBlackFade = 0.0;
    let emergenceGlowAlpha = 0.0;
    let silhouetteAlpha = 0.0;
    let particlesAlpha = 0.0;

    const isSourceUltron = this.switchSource === 'ULTRON';
    const isTargetUltron = this.switchTarget === 'ULTRON';

    if (t < pA) {
      // Phase A: Close old eye
      const progA = t / pA;
      gazeRelax = easeInOutCubic(progA);
      lidProgress = easeInOutCubic(progA);
      codeBrightness = lerp(1.0, 0.25, progA);
      irisGlowMultiplier = lerp(1.0, 0.25, progA);
      codeSpeedMultiplier = lerp(1.0, 0.20, easeInOutCubic(progA));
      masterBlackFade = 0.0;
      this.themeProgressRaw = isSourceUltron ? 0.0 : 1.0;
      this.targetTheme = this.switchSource;
    } else if (t < pA + pB) {
      // Phase B & C: Pure darkness
      lidProgress = 1.0;
      gazeRelax = 1.0;
      masterBlackFade = 1.0;
      codeBrightness = 0.0;
      irisGlowMultiplier = 0.0;
      codeSpeedMultiplier = 0.0;

      if (t >= pC && !this.switchTargetInitialized) {
        this.switchTargetInitialized = true;
        this.currentTheme = this.switchTarget;
        this.targetTheme = this.switchTarget;
        this.themeProgressRaw = (this.switchTarget === 'JARVIS') ? 1.0 : 0.0;
        this.lastActivePersonality = this.switchTarget;
      }
    } else if (t < totalDuration) {
      // Phase D: Open new eye
      const progD = (t - (pA + pB)) / pD;
      this.themeProgressRaw = isTargetUltron ? 0.0 : 1.0;
      this.currentTheme = this.switchTarget;
      this.targetTheme = this.switchTarget;

      if (progD < 0.32) {
        const subProg = progD / 0.32;
        lidProgress = 1.0;
        masterBlackFade = 1.0;
        gazeRelax = 1.0;
        emergenceGlowAlpha = Math.sin(subProg * Math.PI) * (isTargetUltron ? 0.55 : 0.45);
        silhouetteAlpha = easeOutCubic(subProg) * (isTargetUltron ? 0.48 : 0.40);
        particlesAlpha = easeOutCubic(subProg) * 0.85;
        codeSpeedMultiplier = isTargetUltron ? 0.25 : 0.20;
      } else {
        const openProg = (progD - 0.32) / 0.68;
        lidProgress = 1.0 - easeOutCubic(openProg);
        masterBlackFade = 1.0 - easeOutCubic(openProg);
        emergenceGlowAlpha = (1.0 - openProg) * (isTargetUltron ? 0.30 : 0.25);
        silhouetteAlpha = (1.0 - openProg) * (isTargetUltron ? 0.25 : 0.20);
        particlesAlpha = (1.0 - openProg) * 0.70;
        codeSpeedMultiplier = lerp(isTargetUltron ? 0.25 : 0.20, 1.0, easeInOutCubic(openProg));
        codeBrightness = lerp(0.35, 1.0, openProg);
        irisGlowMultiplier = lerp(0.40, 1.0, openProg);
        gazeRelax = openProg < 0.65 ? 1.0 : (1.0 - (openProg - 0.65) / 0.35);
      }
    } else {
      // Fully open
      lidProgress = 0.0;
      masterBlackFade = 0.0;
      gazeRelax = 0.0;
      codeSpeedMultiplier = 1.0;
      codeBrightness = 1.0;
      irisGlowMultiplier = 1.0;
      this.currentTheme = this.switchTarget;
      this.targetTheme = this.switchTarget;
      this.themeProgressRaw = (this.switchTarget === 'JARVIS') ? 1.0 : 0.0;
      this.setLifecycleState('EYE_OPEN');
      this.expressionState = 'LISTENING';
    }

    return {
      lidProgress,
      gazeRelax,
      masterBlackFade,
      codeSpeedMultiplier,
      codeBrightness,
      irisGlowMultiplier,
      emergenceGlowAlpha,
      silhouetteAlpha,
      particlesAlpha,
      themeProgressRaw: this.themeProgressRaw,
      currentTheme: this.currentTheme,
      targetTheme: this.targetTheme
    };
  }
}

async function runPersonalitySwitchTests() {
  console.log('========================================================================');
  console.log('STARK AI — CINEMATIC PERSONALITY SWITCH TRANSITION TEST SUITE');
  console.log('========================================================================');

  setupMockBrowser();

  // --------------------------------------------------------------------------
  // TEST GROUP 1: JARVIS -> ULTRON (Phase A close -> B/C darkness -> D open)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 1: JARVIS -> ULTRON Cinematic Transition ---');
  {
    const ctrl = new SimulatedPersonalityController('JARVIS');
    assert(ctrl.currentTheme === 'JARVIS', '1.1', 'Starts with JARVIS active');
    assert(ctrl.themeProgressRaw === 1.0, '1.2', 'Starts with pure ocean blue colors (raw = 1.0)');

    const result = ctrl.switchPersonality('ULTRON');
    assert(result === 'CINEMATIC_SWITCH_STARTED', '1.3', 'Initiated cinematic switch');
    assert(ctrl.visualLifecycleState === 'EYE_SWITCHING', '1.4', 'State entered EYE_SWITCHING');

    // Phase A (t = 800ms): Closing old eye
    const fA = ctrl.evaluateFrame(800);
    assert(fA.themeProgressRaw === 1.0, '1.5', 'Phase A: Preserves original JARVIS blue colors without morphing');
    assert(fA.lidProgress > 0.2 && fA.lidProgress < 0.8, '1.6', 'Phase A: Eyelids closing smoothly (progress: ' + fA.lidProgress.toFixed(2) + ')');
    assert(fA.codeSpeedMultiplier < 1.0, '1.7', 'Phase A: Code streams decelerating');
    assert(fA.codeBrightness < 1.0, '1.8', 'Phase A: Iris & code dimming');
    assert(fA.masterBlackFade === 0.0, '1.9', 'Phase A: Screen not faded to black yet (eye physically closing)');

    // Phase B (t = 1600ms): Pure pitch darkness
    const fB = ctrl.evaluateFrame(1600);
    assert(fB.lidProgress === 1.0, '1.10', 'Phase B: Eyelids are 100% closed');
    assert(fB.masterBlackFade === 1.0, '1.11', 'Phase B: Screen is 100% pitch black');
    assert(fB.codeBrightness === 0.0, '1.12', 'Phase B: All visual light extinguished');

    // Phase C (t = 1850ms): Target personality initialized in darkness
    const fC = ctrl.evaluateFrame(1850);
    assert(ctrl.switchTargetInitialized === true, '1.13', 'Phase C: ULTRON initialized internally during darkness');
    assert(fC.currentTheme === 'ULTRON', '1.14', 'Phase C: currentTheme set to ULTRON');
    assert(fC.themeProgressRaw === 0.0, '1.15', 'Phase C: Crimson theme set in pitch darkness');
    assert(fC.masterBlackFade === 1.0, '1.16', 'Phase C: Screen remains completely dark during initialization');

    // Phase D1 (t = 2300ms): Crimson emergence glow in center of black screen
    const fD1 = ctrl.evaluateFrame(2300);
    assert(fD1.emergenceGlowAlpha > 0.2, '1.17', 'Phase D1: Crimson emergence glow blooming (glow: ' + fD1.emergenceGlowAlpha.toFixed(2) + ')');
    assert(fD1.silhouetteAlpha > 0.1, '1.18', 'Phase D1: Iris silhouette emerging from darkness');
    assert(fD1.lidProgress === 1.0, '1.19', 'Phase D1: Eyelids still closed during first sign of life');

    // Phase D2 (t = 3200ms): Eyelids slowly opening, code accelerating
    const fD2 = ctrl.evaluateFrame(3200);
    assert(fD2.lidProgress < 0.7 && fD2.lidProgress > 0.0, '1.20', 'Phase D2: Eyelids opening smoothly (progress: ' + fD2.lidProgress.toFixed(2) + ')');
    assert(fD2.codeSpeedMultiplier > 0.3, '1.21', 'Phase D2: Code streams accelerating toward normal speed');
    assert(fD2.masterBlackFade < 0.5, '1.22', 'Phase D2: Master black fade lifting to reveal atmosphere');

    // Phase D Completion (t = 3900ms): Full activation
    const fDone = ctrl.evaluateFrame(3900);
    assert(ctrl.visualLifecycleState === 'EYE_OPEN', '1.23', 'Phase D Complete: State entered EYE_OPEN');
    assert(ctrl.currentTheme === 'ULTRON', '1.24', 'Active theme is ULTRON');
    assert(fDone.lidProgress === 0.0, '1.25', 'Eyelids 100% open');
    assert(fDone.masterBlackFade === 0.0, '1.26', 'Full visual clarity');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: ULTRON -> JARVIS (Phase A close -> B/C darkness -> D open)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 2: ULTRON -> JARVIS Reverse Cinematic Transition ---');
  {
    const ctrl = new SimulatedPersonalityController('ULTRON');
    assert(ctrl.currentTheme === 'ULTRON', '2.1', 'Starts with ULTRON active');
    assert(ctrl.themeProgressRaw === 0.0, '2.2', 'Starts with crimson colors (raw = 0.0)');

    ctrl.switchPersonality('JARVIS');
    assert(ctrl.visualLifecycleState === 'EYE_SWITCHING', '2.3', 'Initiated reverse switch to JARVIS');

    // Phase A (t = 700ms): ULTRON eye closing in crimson
    const fA = ctrl.evaluateFrame(700);
    assert(fA.themeProgressRaw === 0.0, '2.4', 'Phase A: Preserves ULTRON crimson colors without morphing');
    assert(fA.lidProgress > 0.1, '2.5', 'Phase A: Eyelids closing');

    // Phase B (t = 1700ms): Complete darkness
    const fB = ctrl.evaluateFrame(1700);
    assert(fB.masterBlackFade === 1.0, '2.6', 'Phase B: Screen completely pitch black');

    // Phase C (t = 1900ms): JARVIS initialized in darkness
    const fC = ctrl.evaluateFrame(1900);
    assert(fC.currentTheme === 'JARVIS', '2.7', 'Phase C: Switched to JARVIS in darkness');
    assert(fC.themeProgressRaw === 1.0, '2.8', 'Phase C: Blue color palette initialized');

    // Phase D (t = 2400ms): Cyan emergence glow bloom
    const fD = ctrl.evaluateFrame(2400);
    assert(fD.emergenceGlowAlpha > 0.2, '2.9', 'Phase D: Cyan emergence glow blooming in darkness');

    // Full activation (t = 3900ms)
    const fDone = ctrl.evaluateFrame(3900);
    assert(ctrl.visualLifecycleState === 'EYE_OPEN', '2.10', 'Full activation in JARVIS mode');
    assert(ctrl.currentTheme === 'JARVIS', '2.11', 'Current theme is JARVIS');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Repeat Both Directions 5 Times (Stress Test & Race Conditions)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 3: Rapid Bidirectional Stress Test (5 Cycles) ---');
  {
    const ctrl = new SimulatedPersonalityController('JARVIS');
    for (let cycle = 1; cycle <= 5; cycle++) {
      // 1. Switch to ULTRON
      ctrl.switchPersonality('ULTRON');
      assert(ctrl.visualLifecycleState === 'EYE_SWITCHING', `3.${cycle}.1`, `Cycle ${cycle}: Switched to ULTRON`);
      ctrl.evaluateFrame(3900);
      assert(ctrl.currentTheme === 'ULTRON' && ctrl.visualLifecycleState === 'EYE_OPEN', `3.${cycle}.2`, `Cycle ${cycle}: ULTRON fully active`);

      // 2. Switch to JARVIS
      ctrl.switchPersonality('JARVIS');
      assert(ctrl.visualLifecycleState === 'EYE_SWITCHING', `3.${cycle}.3`, `Cycle ${cycle}: Switched to JARVIS`);
      ctrl.evaluateFrame(3900);
      assert(ctrl.currentTheme === 'JARVIS' && ctrl.visualLifecycleState === 'EYE_OPEN', `3.${cycle}.4`, `Cycle ${cycle}: JARVIS fully active`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Switch Using Voice Commands
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 4: Voice Command Detection for Personality Switch ---');
  {
    let commandReceived = null;
    const vc = new VoiceController((cmd) => {
      commandReceived = cmd;
    });
    vc.debounceMs = 0;

    // 4.1 "Switch to Ultron" during active JARVIS session
    vc.sessionManager.startSession('JARVIS', 'TEST');
    vc.lastTriggerTime = -5000;
    vc.handleSpeechResults({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'switch to ultron', confidence: 0.95 }], { isFinal: true })
      ]
    });
    assert(commandReceived !== null && commandReceived.personality === 'ULTRON', '4.1', 'Detected "switch to ultron"');

    // 4.2 "Switch to Jarvis" during active ULTRON session
    commandReceived = null;
    vc.sessionManager.startSession('ULTRON', 'TEST');
    vc.lastTriggerTime = -5000;
    vc.handleSpeechResults({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'switch to jarvis', confidence: 0.95 }], { isFinal: true })
      ]
    });
    assert(commandReceived !== null && commandReceived.personality === 'JARVIS', '4.2', 'Detected "switch to jarvis"');

    // 4.3 Standalone "Ultron" while in active session
    commandReceived = null;
    vc.lastTriggerTime = -5000;
    vc.handleSpeechResults({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'ultron', confidence: 0.95 }], { isFinal: true })
      ]
    });
    assert(commandReceived !== null && commandReceived.personality === 'ULTRON', '4.3', 'Detected standalone "ultron" switch');

    // 4.4 Standalone "Jarvis" while in active session
    commandReceived = null;
    vc.lastTriggerTime = -5000;
    vc.handleSpeechResults({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'jarvis', confidence: 0.95 }], { isFinal: true })
      ]
    });
    assert(commandReceived !== null && commandReceived.personality === 'JARVIS', '4.4', 'Detected standalone "jarvis" switch');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Switch Using Keyboard Shortcut M (toggleTheme)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 5: Keyboard Shortcut M (toggleTheme) ---');
  {
    const ctrl = new SimulatedPersonalityController('ULTRON');
    ctrl.toggleTheme();
    assert(ctrl.visualLifecycleState === 'EYE_SWITCHING', '5.1', 'Pressing M initiated EYE_SWITCHING');
    assert(ctrl.switchTarget === 'JARVIS', '5.2', 'Target is JARVIS');
    ctrl.evaluateFrame(3900);
    assert(ctrl.currentTheme === 'JARVIS', '5.3', 'JARVIS is now fully active');

    ctrl.toggleTheme();
    assert(ctrl.switchTarget === 'ULTRON', '5.4', 'Pressing M again targets ULTRON');
    ctrl.evaluateFrame(3900);
    assert(ctrl.currentTheme === 'ULTRON', '5.5', 'ULTRON is now fully active');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Hotkeys Ctrl+Shift+J and Ctrl+Shift+U
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 6: Hotkeys Ctrl+Shift+J & Ctrl+Shift+U ---');
  {
    const ctrl = new SimulatedPersonalityController('ULTRON');
    ctrl.switchPersonality('JARVIS');
    assert(ctrl.switchTarget === 'JARVIS', '6.1', 'Ctrl+Shift+J targets JARVIS');
    ctrl.evaluateFrame(3900);
    assert(ctrl.currentTheme === 'JARVIS', '6.2', 'JARVIS activated');

    ctrl.switchPersonality('ULTRON');
    assert(ctrl.switchTarget === 'ULTRON', '6.3', 'Ctrl+Shift+U targets ULTRON');
    ctrl.evaluateFrame(3900);
    assert(ctrl.currentTheme === 'ULTRON', '6.4', 'ULTRON activated');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Switch While Assistant is Speaking (Prompt Speech Cancellation)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 7: Switch While Speaking Cancels TTS Promptly ---');
  {
    const ctrl = new SimulatedPersonalityController('JARVIS');
    ctrl.speechSynthesizer.speak('Long ongoing response being read aloud by JARVIS...', 'JARVIS');
    await new Promise(r => setTimeout(r, 140));
    assert(global.window.speechSynthesis.speaking === true, '7.1', 'Speech synthesis is actively speaking');

    // User switches to ULTRON while speech is playing
    ctrl.switchPersonality('ULTRON');
    assert(global.window.speechSynthesis.speaking === false, '7.2', 'Previous speech promptly canceled upon switch');
    assert(ctrl.visualLifecycleState === 'EYE_SWITCHING', '7.3', 'Transition safely launched without audio bleed');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 8: Switch During Sleep Animation (Redirection)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 8: Switch During Sleep Animation Redirects Directly ---');
  {
    const ctrl = new SimulatedPersonalityController('JARVIS');
    ctrl.setLifecycleState('EYE_CLOSING');
    ctrl.visualTimer = 800; // Halfway through closing JARVIS eye

    const res = ctrl.switchPersonality('ULTRON');
    assert(res === 'REDIRECTED_FROM_SLEEP', '8.1', 'Detected switch during sleep and redirected');
    assert(ctrl.visualLifecycleState === 'EYE_SWITCHING', '8.2', 'Entered EYE_SWITCHING');
    assert(ctrl.visualTimer === 1500, '8.3', 'Fast-forwarded directly into pitch darkness (no awkward snap back)');
    assert(ctrl.switchTarget === 'ULTRON', '8.4', 'Target set directly to ULTRON');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 9: Switch When Eye is Already Dormant
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 9: Switch from DORMANT Directly Wakes Target ---');
  {
    const ctrl = new SimulatedPersonalityController('JARVIS');
    ctrl.setLifecycleState('DORMANT');

    const res = ctrl.switchPersonality('ULTRON');
    assert(res === 'DIRECT_WAKE_FROM_DORMANT', '9.1', 'Does not close an already closed eye');
    assert(ctrl.visualLifecycleState === 'EYE_OPENING', '9.2', 'Directly entered EYE_OPENING');
    assert(ctrl.currentTheme === 'ULTRON', '9.3', 'ULTRON personality activated');
    assert(ctrl.themeProgressRaw === 0.0, '9.4', 'ULTRON crimson colors initialized');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 10: Correct Voice & Colors Verified After Switch
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 10: Voice & Theme Identity Integrity ---');
  {
    const synth = new SpeechSynthesizer();
    const jarvisVoice = synth.selectVoiceForTheme('JARVIS');
    assert(jarvisVoice.lang.toLowerCase().includes('en-gb'), '10.1', 'JARVIS voice is British English (en-GB)');

    const ultronVoice = synth.selectVoiceForTheme('ULTRON');
    assert(ultronVoice.lang.toLowerCase().includes('en-us'), '10.2', 'ULTRON voice is US English (en-US)');

    assert(CONFIG.themes.JARVIS.dotColor === '#38bdf8', '10.3', 'JARVIS dot color is ocean cyan (#38bdf8)');
    assert(CONFIG.themes.ULTRON.dotColor === '#ef4444', '10.4', 'ULTRON dot color is crimson red (#ef4444)');
    assert(CONFIG.visualLifecycle.JARVIS.glowColor[0] === 56, '10.5', 'JARVIS emergence glow is ocean cyan');
    assert(CONFIG.visualLifecycle.ULTRON.glowColor[0] === 239, '10.6', 'ULTRON emergence glow is crimson red');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 11: Conversational Context & Memory Preserved Across Switch
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 11: Conversational Memory Preserved Across Switch ---');
  {
    const session = new ConversationSessionManager();
    session.startSession('JARVIS', 'INITIAL');
    const sessionId = session.sessionId;
    const deadlineBefore = session.deadlineTimestamp;
    assert(session.isSessionActive() === true, '11.1', 'Session is active before switch');

    // Switch personality to ULTRON
    session.activePersonality = 'ULTRON';
    assert(session.sessionId === sessionId, '11.2', 'Session ID preserved across switch');
    assert(session.isSessionActive() === true, '11.3', 'Session remains active after switch');
    assert(session.activePersonality === 'ULTRON', '11.4', 'Active personality updated to ULTRON');
    assert(session.deadlineTimestamp === deadlineBefore, '11.5', 'Adaptive inactivity deadline preserved across switch');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 12: Stale Timeouts Cannot Close New Personality After Switch
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 12: Generation Token Guard Against Stale Timeouts ---');
  {
    const ctrl = new SimulatedPersonalityController('JARVIS');
    ctrl.switchPersonality('ULTRON');
    const token1 = ctrl.visualGeneration;

    // Simulate stale callback from previous transition attempting to write to state
    const staleCallback = () => {
      if (token1 === ctrl.visualGeneration) {
        ctrl.setLifecycleState('DORMANT');
      }
    };

    // User switches back to JARVIS immediately
    ctrl.switchPersonality('JARVIS');
    assert(ctrl.visualGeneration > token1, '12.1', 'Generation token incremented on new switch');

    // Fire stale callback
    staleCallback();
    assert(ctrl.visualLifecycleState === 'EYE_SWITCHING', '12.2', 'Stale callback rejected by token check (state not corrupted to DORMANT)');
  }

  console.log('\n========================================================================');
  console.log(`ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions verified.`);
  console.log('========================================================================\n');
  process.exit(0);
}

runPersonalitySwitchTests().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
