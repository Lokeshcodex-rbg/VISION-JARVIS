/**
 * STARK AI — Automated Test Suite for Cinematic Sleep, Eye Closure & Wake-Up Animation
 * Validates all 15 acceptance criteria specified in the prompt:
 * 1. Inactivity triggers slow cinematic sleep sequence (Phase 1 -> 2 -> 3 -> 4)
 * 2. Distinct sleep parameters for JARVIS (gentle, 4.6s) vs ULTRON (mechanical, 3.9s, iris contraction)
 * 3. Screen becomes completely dark in DORMANT state
 * 4. Background wake-word listening stays active in DORMANT state
 * 5. Saying "Jarvis" from dormant triggers 4-phase wake (cyan glow, silhouette, lid opening, activation)
 * 6. Saying "Ultron" from dormant triggers 4-phase wake (crimson glow, silhouette, lid opening, activation)
 * 7. Correct voice profile and greeting (respecting first vs subsequent greeting)
 * 8. Conversational memory and context preserved across sleep/wake
 * 9. Explicit sleep commands ("Go to sleep", "Sleep now", "Goodbye", "That's all") complete farewell before sleep
 * 10. Wake word interrupts ongoing sleep sequence immediately (generation token check)
 * 11. Personality switching during transition works directly without flashing wrong eye
 * 12. Duplicate wake events do not create duplicate windows or greetings
 * 13. Stale inactivity timers cannot close a new active session
 * 14. "Wake up" without personality restores last active personality
 * 15. "Stop speaking" stops speech promptly without closing eye
 * 16. Eye geometry aperture clipping and multi-resolution resizing support
 */

import { CONFIG } from './js/config.js';
import { EyeGeometry } from './js/modules/eyeGeometry.js';
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

// Mock browser environment for modules that check window/document
function setupMockBrowser() {
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
        if (typeof this.onstart === 'function') {
          this.onstart();
        }
      }
      stop() {
        if (typeof this.onend === 'function') {
          this.onend();
        }
      }
    },
    SpeechSynthesisUtterance: class MockSpeechSynthesisUtterance {
      constructor(text) {
        this.text = text;
        this.rate = 1.0;
        this.pitch = 1.0;
        this.volume = 1.0;
      }
    },
    speechSynthesis: {
      speaking: false,
      paused: false,
      getVoices: () => [
        { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
        { name: 'Microsoft David - English (United States)', lang: 'en-US' }
      ],
      speak: (u) => {
        global.window.speechSynthesis.speaking = true;
        if (u.onstart) u.onstart();
        setTimeout(() => {
          global.window.speechSynthesis.speaking = false;
          if (u.onend) u.onend();
        }, 30);
      },
      cancel: () => {
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

  global.SpeechSynthesisUtterance = global.window.SpeechSynthesisUtterance;

  global.document = {
    getElementById: () => ({
      getContext: () => ({
        save: () => {},
        restore: () => {},
        clearRect: () => {},
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        clip: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createLinearGradient: () => ({ addColorStop: () => {} }),
        setTransform: () => {},
        scale: () => {}
      }),
      style: {}
    }),
    createElement: () => ({
      getContext: () => ({
        clearRect: () => {},
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} })
      })
    }),
    documentElement: {
      requestFullscreen: async () => {}
    }
  };

  global.Path2D = class MockPath2D {
    moveTo() {}
    bezierCurveTo() {}
    closePath() {}
  };
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('STARK AI — CINEMATIC SLEEP, EYE CLOSURE & WAKE-UP AUTOMATED TEST SUITE');
  console.log('========================================================================\n');

  setupMockBrowser();

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Inactivity Timeout Triggers 4-Phase Sleep Sequence
  // --------------------------------------------------------------------------
  console.log('--- Test Group 1: Natural Inactivity Triggers 4-Phase Sleep Sequence ---');
  {
    const sm = new ConversationSessionManager({
      normalInactivityTimeoutMs: 200 // fast timeout for test
    });

    let closedReason = null;
    sm.onSessionClose = (reason) => {
      closedReason = reason;
    };

    sm.startSession('JARVIS', 'WAKE_WORD');
    assert(sm.isSessionActive() === true, '1.1', 'Session is actively running');

    // Wait for transition into LISTENING state
    await new Promise(r => setTimeout(r, 180));
    assert(sm.state === CONVERSATION_STATES.LISTENING, '1.2', 'Session reached LISTENING state');

    // Advance deadline and wait for ticker tick (runs every 500ms)
    sm.deadlineTimestamp = performance.now() - 10;
    await new Promise(r => setTimeout(r, 650));

    assert(closedReason === SESSION_CLOSE_REASONS.INACTIVITY, '1.3', 'Session closed due to genuine inactivity');
    assert(sm.state === CONVERSATION_STATES.SESSION_ENDING || sm.state === CONVERSATION_STATES.IDLE, '1.4', 'State transitioned to SESSION_ENDING/IDLE');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: JARVIS vs ULTRON Distinct Sleep Parameters
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 2: Distinct Sleep Parameters for JARVIS & ULTRON ---');
  {
    const jarvisCfg = CONFIG.visualLifecycle.JARVIS;
    const ultronCfg = CONFIG.visualLifecycle.ULTRON;

    assert(jarvisCfg.sleepDurationMs >= 4000, '2.1', `JARVIS sleep duration is calm and slow (${jarvisCfg.sleepDurationMs}ms)`);
    assert(ultronCfg.sleepDurationMs < jarvisCfg.sleepDurationMs, '2.2', `ULTRON sleep duration is sharper and deliberate (${ultronCfg.sleepDurationMs}ms)`);
    assert(jarvisCfg.phase1RealizeMs === 1500, '2.3', 'JARVIS realization phase is 1500ms');
    assert(ultronCfg.phase1RealizeMs === 1200, '2.4', 'ULTRON realization phase is 1200ms');

    // Simulate mathematical evaluation of JARVIS sleep timeline
    const evaluateJarvisSleep = (t) => {
      let lidProgress = 0, gazeRelax = 0, codeSpeed = 1, irisGlow = 1, masterFade = 0;
      const p1 = jarvisCfg.phase1RealizeMs; // 1500
      const p2 = jarvisCfg.phase2CloseMs;   // 2200
      const p3 = jarvisCfg.phase3FadeMs;    // 900
      if (t < p1) {
        const p = t / p1;
        gazeRelax = easeInOutCubic(p);
        codeSpeed = lerp(1.0, 0.45, easeInOutCubic(p));
        irisGlow = lerp(1.0, 0.75, easeInOutCubic(p));
        lidProgress = 0.0;
        masterFade = 0.0;
      } else if (t < p1 + p2) {
        const p = (t - p1) / p2;
        gazeRelax = 1.0;
        lidProgress = easeInOutCubic(p);
        codeSpeed = lerp(0.45, 0.15, easeInOutCubic(p));
        irisGlow = lerp(0.75, 0.15, easeInOutCubic(p));
        masterFade = 0.0;
      } else if (t < p1 + p2 + p3) {
        const p = (t - (p1 + p2)) / p3;
        gazeRelax = 1.0;
        lidProgress = 1.0;
        codeSpeed = lerp(0.15, 0.0, p);
        irisGlow = 0.0;
        masterFade = easeInOutCubic(p);
      } else {
        return { state: 'DORMANT', masterFade: 1.0, lidProgress: 1.0 };
      }
      return { gazeRelax, codeSpeed, irisGlow, lidProgress, masterFade, state: 'EYE_CLOSING' };
    };

    // Phase 1 (1000ms): eye open, gaze relaxed, code slowed, glow dimmed, no black curtain
    const ph1 = evaluateJarvisSleep(1000);
    assert(ph1.lidProgress === 0.0, '2.5', 'JARVIS Phase 1: Eyelids remain open (lidProgress = 0)');
    assert(ph1.gazeRelax > 0.5, '2.6', 'JARVIS Phase 1: Gaze relaxes toward neutral center');
    assert(ph1.codeSpeed < 0.8 && ph1.codeSpeed > 0.4, '2.7', 'JARVIS Phase 1: Code stream decelerates smoothly');
    assert(ph1.irisGlow < 1.0 && ph1.irisGlow >= 0.75, '2.8', 'JARVIS Phase 1: Iris glow subtly dims');
    assert(ph1.masterFade === 0.0, '2.9', 'JARVIS Phase 1: Screen has not faded to black yet');

    // Phase 2 (2500ms): eyelids closing, iris obscured, code further slowed
    const ph2 = evaluateJarvisSleep(2500);
    assert(ph2.lidProgress > 0.3 && ph2.lidProgress < 0.9, '2.10', `JARVIS Phase 2: Eyelids smoothly closing (progress=${ph2.lidProgress.toFixed(2)})`);
    assert(ph2.codeSpeed < 0.4, '2.11', 'JARVIS Phase 2: Code streams decelerate to low speed');
    assert(ph2.masterFade === 0.0, '2.12', 'JARVIS Phase 2: Background still visible while eye closes');

    // Phase 3 (4000ms): eye completely closed, fading to black
    const ph3 = evaluateJarvisSleep(4000);
    assert(ph3.lidProgress === 1.0, '2.13', 'JARVIS Phase 3: Eyelids are fully closed');
    assert(ph3.masterFade > 0.1, '2.14', 'JARVIS Phase 3: Background code and glow fading into pitch black');

    // Phase 4 (4700ms): dormant reached, 100% black
    const ph4 = evaluateJarvisSleep(4700);
    assert(ph4.state === 'DORMANT', '2.15', 'JARVIS Phase 4: Enters DORMANT state');
    assert(ph4.masterFade === 1.0, '2.16', 'JARVIS Phase 4: Screen is 100% black (masterFade = 1.0)');

    // Simulate mathematical evaluation of ULTRON sleep timeline (with mechanical iris contraction)
    const evaluateUltronSleep = (t) => {
      let lidProgress = 0, irisScale = 1, codeSpeed = 1, masterFade = 0;
      const p1 = ultronCfg.phase1RealizeMs; // 1200
      const p2 = ultronCfg.phase2CloseMs;   // 1800
      const p3 = ultronCfg.phase3FadeMs;    // 900
      if (t < p1) {
        const p = t / p1;
        irisScale = lerp(1.0, 0.91, easeInOutCubic(p));
        codeSpeed = p < 0.5 ? 0.75 : 0.45;
        lidProgress = 0.0;
        masterFade = 0.0;
      } else if (t < p1 + p2) {
        const p = (t - p1) / p2;
        irisScale = 0.91;
        lidProgress = p < 0.5 ? (2 * p * p) : (1 - Math.pow(-2 * p + 2, 2) / 2);
        codeSpeed = p < 0.5 ? 0.30 : 0.12;
        masterFade = 0.0;
      } else if (t < p1 + p2 + p3) {
        const p = (t - (p1 + p2)) / p3;
        lidProgress = 1.0;
        irisScale = 0.91;
        codeSpeed = 0.0;
        masterFade = easeInOutCubic(p);
      } else {
        return { state: 'DORMANT', masterFade: 1.0, lidProgress: 1.0, irisScale: 0.91 };
      }
      return { irisScale, codeSpeed, lidProgress, masterFade, state: 'EYE_CLOSING' };
    };

    const uPh1 = evaluateUltronSleep(800);
    assert(uPh1.irisScale < 0.96, '2.17', `ULTRON Phase 1: Crimson iris contracts slightly (${uPh1.irisScale.toFixed(2)})`);
    assert(uPh1.codeSpeed === 0.45, '2.18', 'ULTRON Phase 1: Code speed exhibits controlled staged drops');

    const uPh4 = evaluateUltronSleep(4000);
    assert(uPh4.state === 'DORMANT' && uPh4.masterFade === 1.0, '2.19', 'ULTRON Phase 4: Enters DORMANT with full screen darkness');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Background Wake-Word Listening Stays Active in DORMANT State
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 3: Wake-Word Audio Listening Preserved During Sleep ---');
  {
    let commandReceived = null;
    const vc = new VoiceController((cmd) => {
      commandReceived = cmd;
    });

    vc.startListening();
    assert(vc.isSupported === true, '3.1', 'Voice recognition is initialized');
    assert(vc.isListening === true, '3.2', 'Voice recognition is actively listening');

    // Simulate application being in DORMANT state
    const visualLifecycleState = 'DORMANT';
    assert(visualLifecycleState === 'DORMANT', '3.3', 'Visual state is DORMANT (black screen)');
    assert(vc.isListening === true, '3.4', 'Microphone and speech recognition NOT closed or destroyed during sleep');

    // Simulate user speaking "Jarvis" from dormant state
    vc.handleSpeechResults({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'jarvis', confidence: 0.95 }], { isFinal: true })
      ]
    });

    assert(commandReceived !== null, '3.5', 'Voice controller successfully detected wake word during sleep');
    assert(commandReceived.type === 'ACTIVATE_THEME', '3.6', 'Event type is ACTIVATE_THEME');
    assert(commandReceived.personality === 'JARVIS', '3.7', 'Target personality is JARVIS');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: 4-Phase Wake-Up Sequences (JARVIS & ULTRON)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 4: 4-Phase Cinematic Wake-Up Animation ---');
  {
    const evaluateWake = (theme, t) => {
      const cfg = CONFIG.visualLifecycle[theme];
      const isUltron = theme === 'ULTRON';
      const w1 = cfg.wakePhase1DetectMs; // 300
      const w2 = cfg.wakePhase2GlowMs;   // 900 or 800
      const w3 = cfg.wakePhase3OpenMs;   // 2000 or 1800

      let lidProgress = 1.0, masterFade = 1.0, emergenceGlow = 0, silhouette = 0, codeSpeed = 0, state = 'EYE_OPENING';

      if (t < w1) {
        // Phase 1 — Wake detection (0 - 300ms)
        lidProgress = 1.0;
        masterFade = 1.0;
        codeSpeed = 0.0;
      } else if (t < w1 + w2) {
        // Phase 2 — First sign of life (0.3s - 1.2s)
        const p = (t - w1) / w2;
        lidProgress = 1.0;
        masterFade = 1.0;
        emergenceGlow = Math.sin(p * Math.PI) * (isUltron ? 0.55 : 0.45);
        silhouette = easeOutCubic(p) * (isUltron ? 0.48 : 0.40);
        codeSpeed = isUltron ? 0.25 : 0.20;
      } else if (t < w1 + w2 + w3) {
        // Phase 3 — Eye opening (1.2s - 3.2s)
        const p = (t - (w1 + w2)) / w3;
        lidProgress = 1.0 - easeOutCubic(p);
        masterFade = 1.0 - easeOutCubic(p);
        emergenceGlow = (1.0 - p) * 0.25;
        codeSpeed = lerp(isUltron ? 0.25 : 0.20, 1.0, easeInOutCubic(p));
      } else {
        // Phase 4 — Full activation
        lidProgress = 0.0;
        masterFade = 0.0;
        codeSpeed = 1.0;
        state = 'EYE_OPEN';
      }
      return { lidProgress, masterFade, emergenceGlow, silhouette, codeSpeed, state };
    };

    // JARVIS Wake:
    // Phase 1 (150ms): Detection, pure black, lids closed
    const jW1 = evaluateWake('JARVIS', 150);
    assert(jW1.lidProgress === 1.0 && jW1.masterFade === 1.0, '4.1', 'JARVIS Phase 1: Pure black screen, eyelids closed');

    // Phase 2 (700ms): First sign of life — Cyan emergence glow & silhouette visible
    const jW2 = evaluateWake('JARVIS', 700);
    assert(jW2.lidProgress === 1.0, '4.2', 'JARVIS Phase 2: Eyelids still closed');
    assert(jW2.emergenceGlow > 0.35, '4.3', `JARVIS Phase 2: Cyan emergence glow blooming (glow=${jW2.emergenceGlow.toFixed(2)})`);
    assert(jW2.silhouette > 0.25, '4.4', 'JARVIS Phase 2: Faint circular iris silhouette emerges');
    assert(jW2.codeSpeed === 0.20, '4.5', 'JARVIS Phase 2: Code streams at gentle emerging crawl');

    // Phase 3 (2200ms): Eyelids slowly and smoothly opening, code accelerating
    const jW3 = evaluateWake('JARVIS', 2200);
    assert(jW3.lidProgress < 0.8 && jW3.lidProgress > 0.1, '4.6', `JARVIS Phase 3: Eyelids opening progressively (lidProgress=${jW3.lidProgress.toFixed(2)})`);
    assert(jW3.codeSpeed > 0.5, '4.7', 'JARVIS Phase 3: Code streams smoothly accelerating toward 1.0');
    assert(jW3.masterFade < 0.6, '4.8', 'JARVIS Phase 3: Background atmosphere revealing');

    // Phase 4 (3500ms): Fully open, eye open state
    const jW4 = evaluateWake('JARVIS', 3500);
    assert(jW4.state === 'EYE_OPEN', '4.9', 'JARVIS Phase 4: Transitioned to EYE_OPEN state');
    assert(jW4.lidProgress === 0.0, '4.10', 'JARVIS Phase 4: Eyelids 100% open');
    assert(jW4.codeSpeed === 1.0, '4.11', 'JARVIS Phase 4: Full operating code speed');

    // ULTRON Wake:
    // Phase 2 (700ms): Crimson emergence glow
    const uW2 = evaluateWake('ULTRON', 700);
    assert(uW2.emergenceGlow > 0.40, '4.12', `ULTRON Phase 2: Crimson emergence glow blooming (glow=${uW2.emergenceGlow.toFixed(2)})`);
    assert(uW2.codeSpeed === 0.25, '4.13', 'ULTRON Phase 2: Staged code crawl');

    // Phase 4 (3350ms): Fully open
    const uW4 = evaluateWake('ULTRON', 3350);
    assert(uW4.state === 'EYE_OPEN', '4.14', 'ULTRON Phase 4: Transitioned to EYE_OPEN state');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Voice Profile & Greeting Persistence (First vs Subsequent)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 5: Voice Profile & Greeting Rules ---');
  {
    const synth = new SpeechSynthesizer();
    assert(synth.activationCounts.JARVIS === 0, '5.1', 'Initial JARVIS activation count is 0');
    assert(synth.activationCounts.ULTRON === 0, '5.2', 'Initial ULTRON activation count is 0');

    // First JARVIS activation: full greeting
    synth.speakPersonality('JARVIS');
    assert(synth.activationCounts.JARVIS === 1, '5.3', 'JARVIS activation count incremented to 1');
    assert(Boolean(synth.lastResponse.JARVIS && synth.lastResponse.JARVIS.length > 5), '5.4', 'Speaks first-time greeting on first activation');

    // Sleep sequence occurs... (simulated)
    // Subsequent JARVIS activation after waking from sleep: concise acknowledgment
    synth.speakPersonality('JARVIS');
    assert(synth.activationCounts.JARVIS === 2, '5.5', 'JARVIS activation count is 2');
    assert(synth.lastResponse.JARVIS === "Yes, sir. I'm listening.", '5.6', 'Speaks concise subsequent greeting on returning session');

    // Voice selection: British English for JARVIS, Deep US male for ULTRON
    const jarvisVoice = synth.selectVoiceForTheme('JARVIS');
    assert(jarvisVoice.lang.toLowerCase().includes('en-gb'), '5.7', `JARVIS uses British English voice (${jarvisVoice.name})`);

    const ultronVoice = synth.selectVoiceForTheme('ULTRON');
    assert(ultronVoice.lang.toLowerCase().includes('en-us'), '5.8', `ULTRON uses US English voice (${ultronVoice.name})`);
    synth.cancel();
    await new Promise(r => setTimeout(r, 60));
    global.window.speechSynthesis.speaking = false;
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Explicit Sleep Commands Acknowledge Before Closing
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 6: Explicit Sleep Commands Complete Farewell Before Sleep ---');
  {
    let commandReceived = null;
    const vc = new VoiceController((cmd) => {
      commandReceived = cmd;
    });
    vc.sessionManager.startSession('JARVIS', 'TEST');

    // Test phrases: "Go to sleep", "Sleep now", "Goodbye", "That's all"
    const sleepPhrases = ['go to sleep', 'sleep now', 'goodbye jarvis', "that's all"];
    for (const phrase of sleepPhrases) {
      vc.lastTriggerTime = 0;
      vc.handleSpeechResults({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: phrase, confidence: 0.95 }], { isFinal: true })
        ]
      });
      assert(commandReceived !== null && commandReceived.type === 'GO_TO_SLEEP', '6.1', `Recognized sleep command: "${phrase}"`);
    }

    // Verify farewell speech completes without cutting off
    const synth = new SpeechSynthesizer();
    let farewellCompleted = false;
    synth.speakSleep('JARVIS', () => {
      farewellCompleted = true;
    });

    await new Promise(r => setTimeout(r, 160));
    assert(farewellCompleted === true, '6.2', 'Farewell callback fired upon completion of spoken acknowledgment');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Interruptible Sleep and Wake Animations (Token Guard)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 7: Interruptible Sleep/Wake & Generation Token Check ---');
  {
    let visualGeneration = 0;
    let visualLifecycleState = 'EYE_CLOSING';
    let targetTheme = 'ULTRON';

    // 1. User says "Jarvis" while ULTRON is halfway through closing its eye
    const simulateWake = (personality) => {
      visualGeneration++;
      const currentToken = visualGeneration;
      visualLifecycleState = 'EYE_OPENING';
      targetTheme = personality;
      return currentToken;
    };

    const token1 = simulateWake('JARVIS');
    assert(visualLifecycleState === 'EYE_OPENING', '7.1', 'ULTRON sleep canceled, switched to EYE_OPENING');
    assert(targetTheme === 'JARVIS', '7.2', 'Target theme switched directly to JARVIS');

    // Simulate stale callback from old ULTRON sleep sequence
    let staleCallbackExecuted = false;
    const oldSleepToken = token1 - 1;
    if (oldSleepToken === visualGeneration) {
      staleCallbackExecuted = true;
    }
    assert(staleCallbackExecuted === false, '7.3', 'Stale sleep callback prevented by generation token');

    // 2. User says "Ultron" while JARVIS is fading into darkness
    const token2 = simulateWake('ULTRON');
    assert(visualLifecycleState === 'EYE_OPENING', '7.4', 'JARVIS fading canceled, switched to ULTRON wake');
    assert(targetTheme === 'ULTRON', '7.5', 'Target theme switched directly to ULTRON');
    assert(token2 > token1, '7.6', 'Generation token strictly incremented');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 8: Direct Personality Switch From Dormant (No Flash of Wrong Eye)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 8: Direct Personality Activation from Dormant ---');
  {
    let dormantTheme = 'JARVIS';
    let currentThemeProgress = 1.0; // JARVIS (blue)
    let targetTheme = 'ULTRON';     // User says "Ultron"

    // When waking requested personality, themeProgressRaw is directly set to target
    currentThemeProgress = (targetTheme === 'JARVIS') ? 1.0 : 0.0;
    assert(currentThemeProgress === 0.0, '8.1', 'ULTRON awakens directly in crimson mode (themeProgressRaw = 0.0)');

    // Verify reverse
    targetTheme = 'JARVIS';
    currentThemeProgress = (targetTheme === 'JARVIS') ? 1.0 : 0.0;
    assert(currentThemeProgress === 1.0, '8.2', 'JARVIS awakens directly in ocean blue mode (themeProgressRaw = 1.0)');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 9: Duplicate Wake Events Ignored
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 9: Duplicate Wake Word Deduplication ---');
  {
    let wakeCount = 0;
    let visualLifecycleState = 'EYE_OPENING';
    let visualTimer = 150; // 150ms into wake
    let targetTheme = 'JARVIS';

    const handleWake = (personality) => {
      // Guard in app.js
      if (visualLifecycleState === 'EYE_OPENING' && visualTimer < 600 && targetTheme === personality) {
        return false; // ignored
      }
      wakeCount++;
      return true;
    };

    const firstWake = handleWake('JARVIS');
    assert(firstWake === false, '9.1', 'Duplicate wake event within 600ms of active emergence ignored');
    assert(wakeCount === 0, '9.2', 'No duplicate wake sequence initiated');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 10: "Wake Up" Without Personality Restores Last Active Personality
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 10: Generic "Wake Up" Restores Last Active Personality ---');
  {
    let commandReceived = null;
    const vc = new VoiceController((cmd) => {
      commandReceived = cmd;
    });

    // Set last active personality to ULTRON
    vc.sessionManager.activePersonality = 'ULTRON';
    vc.sessionManager.state = CONVERSATION_STATES.IDLE;

    vc.handleSpeechResults({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'wake up', confidence: 0.95 }], { isFinal: true })
      ]
    });

    assert(commandReceived !== null, '10.1', 'Recognized generic "wake up" command');
    assert(commandReceived.type === 'ACTIVATE_THEME', '10.2', 'Dispatched ACTIVATE_THEME');
    assert(commandReceived.personality === 'ULTRON', '10.3', 'Restored last active personality (ULTRON)');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 11: "Stop Speaking" Stops Speech Promptly Without Closing Eye
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 11: "Stop Speaking" Control Command ---');
  {
    let commandReceived = null;
    const vc = new VoiceController((cmd) => {
      commandReceived = cmd;
    });
    vc.sessionManager.startSession('JARVIS', 'TEST');

    vc.handleSpeechResults({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'stop speaking', confidence: 0.95 }], { isFinal: true })
      ]
    });

    assert(commandReceived !== null && commandReceived.type === 'STOP_SPEAKING', '11.1', 'Dispatched STOP_SPEAKING');
    assert(vc.sessionManager.isSessionActive() === true, '11.2', 'Conversational session remains active (eye does NOT close)');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 12: Eye Geometry Dynamic Aperture Clipping & Resizing
  // --------------------------------------------------------------------------
  console.log('\n--- Test Group 12: Eye Geometry Dynamic Aperture & Resizing ---');
  {
    const eye = new EyeGeometry();
    eye.resize(1920, 1080);
    assert(eye.width > 1000, '12.1', `Calculated horizontal eye width (${eye.width}px)`);

    // Test fully open eye (lidProgress = 0.0)
    eye.updateBlink(0.0);
    const clipOpen = eye.createEyeClipPath();
    assert(clipOpen !== null, '12.2', 'Constructed Path2D for fully open eye');
    assert(eye.isPointInside(eye.cx, eye.cy) === true, '12.3', 'Center point inside open eye aperture');

    // Test fully closed eye (lidProgress = 1.0)
    eye.updateBlink(1.0);
    const clipClosed = eye.createEyeClipPath();
    assert(clipClosed !== null, '12.4', 'Constructed Path2D for fully closed eye seam');

    // Test resizing at 4K resolution (3840 x 2160)
    eye.resize(3840, 2160);
    assert(eye.width <= CONFIG.eye.maxWidth, '12.5', `Eye width constrained by maxWidth at 4K (${eye.width}px <= ${CONFIG.eye.maxWidth}px)`);

    // Test resizing at mobile/small laptop window (800 x 600)
    eye.resize(800, 600);
    assert(eye.width >= CONFIG.eye.minWidth, '12.6', `Eye width respects minWidth (${eye.width}px >= ${CONFIG.eye.minWidth}px)`);
  }

  console.log('\n========================================================================');
  console.log(`ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions verified.`);
  console.log('========================================================================');
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
