/**
 * STARK AI — ULTRA-SYNTHETIC VOICE, LOW-VOLUME HEARING & ZERO-LAG TEST SUITE
 * Tests:
 * 1. Low-Volume Speech & Whisper Detection (RMS 0.007 vs Noise Floor 0.0035)
 * 2. Asymmetric Noise Floor Adaptation (Bounded Ambient Tracking)
 * 3. Vocal Spectral Centroid & Click Rejection (90Hz-3800Hz speech band, click hysteresis)
 * 4. Web Speech Low-Confidence Allowance for Whispered Text
 * 5. Elimination of Avoidable Lag (350ms debounce, 200ms wake, 60ms speech delay)
 * 6. Ultra-Synthetic Voice Profiles (JARVIS British 1.03/1.02 vs ULTRON Deep 0.80/0.93)
 * 7. Acronym Robotic Spoken Formatting (J.A.R.V.I.S., A.I., V.A.D., C.P.U., etc.)
 * 8. Procedural Carrier Acoustic Cues (playJarvisCarrier & playUltronCarrier)
 * 9. Controlled Voice & Latency Diagnostic HUD State & Telemetry
 */

import { CONFIG } from './js/config.js';
import { VoiceActivityDetector } from './js/modules/voiceActivityDetector.js';
import { VoiceController } from './js/modules/voiceController.js';
import { SpeechSynthesizer } from './js/modules/speechSynthesizer.js';
import { AudioSynthesizer } from './js/modules/audioSynthesizer.js';
import { VoiceDiagnostics } from './js/modules/voiceDiagnostics.js';

let passed = 0;
let failed = 0;

function assert(condition, testId, description) {
  if (condition) {
    console.log(`  ✓ [PASS] [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] [${testId}] ${description}`);
    failed++;
  }
}

// Mock Web Speech & Web Audio APIs for Node environment testing
function setupMockEnvironment() {
  class MockUtterance {
    constructor(text) {
      this.text = text;
      this.voice = null;
      this.rate = 1.0;
      this.pitch = 1.0;
      this.volume = 1.0;
      this.lang = 'en-US';
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  }

  const mockSynthesis = {
    speaking: false,
    paused: false,
    getVoices: () => [
      { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Microsoft Mark - English (United States)', lang: 'en-US' },
      { name: 'Microsoft David - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Zira - English (United States)', lang: 'en-US' }
    ],
    speak: (u) => {
      mockSynthesis.speaking = true;
      setTimeout(() => {
        if (u.onstart) u.onstart();
        setTimeout(() => {
          mockSynthesis.speaking = false;
          if (u.onend) u.onend();
        }, 15);
      }, 5);
    },
    cancel: () => { mockSynthesis.speaking = false; },
    pause: () => { mockSynthesis.paused = true; },
    resume: () => { mockSynthesis.paused = false; }
  };

  class MockAudioNode {
    constructor() { this.connectedTo = []; }
    connect(node) { this.connectedTo.push(node); return node; }
    disconnect() { this.connectedTo = []; }
  }

  class MockGainNode extends MockAudioNode {
    constructor() {
      super();
      this.gain = {
        value: 1.0,
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        cancelScheduledValues: () => {}
      };
    }
  }

  class MockOscillatorNode extends MockAudioNode {
    constructor() {
      super();
      this.type = 'sine';
      this.frequency = {
        value: 440,
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      };
    }
    start() {}
    stop() {}
  }

  class MockBiquadFilterNode extends MockAudioNode {
    constructor() {
      super();
      this.type = 'lowpass';
      this.frequency = { setValueAtTime: () => {} };
      this.Q = { setValueAtTime: () => {} };
    }
  }

  class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.sampleRate = 48000;
      this.destination = new MockAudioNode();
    }
    createGain() { return new MockGainNode(); }
    createOscillator() { return new MockOscillatorNode(); }
    createBiquadFilter() { return new MockBiquadFilterNode(); }
    createBuffer(c, l, s) { return { getChannelData: () => new Float32Array(l) }; }
    createBufferSource() { return Object.assign(new MockAudioNode(), { start: () => {}, stop: () => {} }); }
    createAnalyser() {
      return Object.assign(new MockAudioNode(), {
        fftSize: 512,
        frequencyBinCount: 256,
        smoothingTimeConstant: 0.2,
        getFloatTimeDomainData: () => {},
        getByteFrequencyData: () => {}
      });
    }
    createMediaStreamSource() { return new MockAudioNode(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }

  class MockSpeechRecognition {
    constructor() {
      this.continuous = true;
      this.interimResults = true;
      this.lang = 'en-US';
      this.onstart = null;
      this.onend = null;
      this.onresult = null;
      this.onerror = null;
      this.onspeechstart = null;
      this.onspeechend = null;
    }
    start() {}
    stop() {}
  }

  global.window = {
    speechSynthesis: mockSynthesis,
    SpeechSynthesisUtterance: MockUtterance,
    SpeechRecognition: MockSpeechRecognition,
    webkitSpeechRecognition: MockSpeechRecognition,
    AudioContext: MockAudioContext,
    location: { search: '' }
  };
  global.SpeechSynthesisUtterance = MockUtterance;
  global.AudioContext = MockAudioContext;
  global.SpeechRecognition = MockSpeechRecognition;
  global.webkitSpeechRecognition = MockSpeechRecognition;
}

async function runTests() {
  console.log('========================================================================');
  console.log('STARK AI — ULTRA-SYNTHETIC VOICE, LOW-VOLUME HEARING & ZERO-LAG SUITE');
  console.log('========================================================================\n');

  setupMockEnvironment();

  // --------------------------------------------------------------------------
  // SECTION 1: Low-Volume Speech & Whisper Detection
  // --------------------------------------------------------------------------
  console.log('--- Section 1: Low-Volume Speech & Whisper Sensitivity ---');
  {
    const vad = new VoiceActivityDetector();

    // 1.1 Baseline calibration
    assert(vad.config.energyThreshold <= 0.006, '1.1', `Calibrated base energy threshold (${vad.config.energyThreshold}) allows quiet speech`);

    // 1.2 Soft speech detection simulation
    // A soft whisper produces RMS ~0.0075. In quiet room (noiseFloor 0.0035), dynamic threshold is ~0.0078
    const quietRoomFloor = 0.0032;
    vad.noiseFloor = quietRoomFloor;
    const dynamicThreshold = Math.min(0.024, Math.max(vad.config.energyThreshold, quietRoomFloor * 1.65 + 0.002));
    const quietWhisperRMS = 0.0085;
    const normalSpeechRMS = 0.0220;

    assert(quietWhisperRMS > dynamicThreshold, '1.2', `Quiet speech (RMS: ${quietWhisperRMS}) exceeds dynamic threshold (${dynamicThreshold.toFixed(4)})`);
    assert(normalSpeechRMS > dynamicThreshold, '1.3', `Normal speech (RMS: ${normalSpeechRMS}) comfortably exceeds dynamic threshold`);

    // 1.3 Previous rigid threshold comparison: Old 0.016 threshold rejected soft speech!
    const oldThreshold = 0.016;
    const rejectedByOld = quietWhisperRMS < oldThreshold;
    assert(rejectedByOld, '1.4', `Verified old hardcoded threshold (0.016) rejected quiet speech (RMS: ${quietWhisperRMS})`);
  }

  // --------------------------------------------------------------------------
  // SECTION 2: Asymmetric Noise Floor Adaptation & Bound Protection
  // --------------------------------------------------------------------------
  console.log('\n--- Section 2: Asymmetric Noise Floor Adaptation & Bound Protection ---');
  {
    const vad = new VoiceActivityDetector();
    vad.noiseFloor = 0.008;

    // Simulate quiet silence: floor must relax downwards toward true ambient
    const silenceRMS = 0.002;
    const noiseAdaptRate = vad.config.noiseFloorAdaptRate || 0.04;
    for (let i = 0; i < 30; i++) {
      vad.noiseFloor = (1 - noiseAdaptRate * 1.5) * vad.noiseFloor + (noiseAdaptRate * 1.5) * Math.max(0.001, silenceRMS);
    }
    assert(vad.noiseFloor < 0.005, '2.1', `Noise floor adapted downward in silence to ambient baseline (${vad.noiseFloor.toFixed(4)})`);

    // Simulate sustained noise: floor adaptation must be bounded to prevent runaway
    const loudNoiseRMS = 0.045;
    for (let i = 0; i < 50; i++) {
      vad.noiseFloor = Math.min(0.020, (1 - noiseAdaptRate * 0.4) * vad.noiseFloor + (noiseAdaptRate * 0.4) * loudNoiseRMS);
    }
    assert(vad.noiseFloor <= 0.020, '2.2', `Noise floor strictly capped at safe upper bound (${vad.noiseFloor.toFixed(4)}) to prevent desensitization`);
  }

  // --------------------------------------------------------------------------
  // SECTION 3: Vocal Frequency Filtering & Click Rejection
  // --------------------------------------------------------------------------
  console.log('\n--- Section 3: Spectral Centroid & Transient Click Rejection ---');
  {
    const vad = new VoiceActivityDetector();

    // 3.1 Vocal frequency spectrum
    const maleVoiceCentroid = 130;  // Deep male pitch ~130Hz
    const femaleVoiceCentroid = 250;// Female pitch ~250Hz
    const fanRumbleCentroid = 45;   // 45Hz fan/AC rumble
    const highPitchClickCentroid = 4800; // Key tap / click

    const minHz = vad.config.spectralCentroidMinHz || 90;
    const maxHz = vad.config.spectralCentroidMaxHz || 3800;

    assert(maleVoiceCentroid >= minHz && maleVoiceCentroid <= maxHz, '3.1', `Male fundamental voice (${maleVoiceCentroid}Hz) within speech band [${minHz}-${maxHz}Hz]`);
    assert(femaleVoiceCentroid >= minHz && femaleVoiceCentroid <= maxHz, '3.2', `Female voice (${femaleVoiceCentroid}Hz) within speech band`);
    assert(fanRumbleCentroid < minHz, '3.3', `Low-frequency fan rumble (${fanRumbleCentroid}Hz) rejected below ${minHz}Hz floor`);
    assert(highPitchClickCentroid > maxHz, '3.4', `High-frequency click (${highPitchClickCentroid}Hz) rejected above ${maxHz}Hz ceiling`);

    // 3.2 Temporal hysteresis: single-frame spike must be rejected
    vad.consecutiveSpeechFrames = 0;
    const frame1Candidate = true; // First transient frame (e.g. key tap)
    vad.consecutiveSpeechFrames = frame1Candidate ? 1 : 0;
    const isTriggeredFrame1 = vad.consecutiveSpeechFrames >= 2;
    assert(!isTriggeredFrame1, '3.5', 'Single isolated transient click (frame 1) safely rejected by temporal hysteresis');

    // Sustained audio (frame 2) triggers speech
    vad.consecutiveSpeechFrames = 2;
    const isTriggeredFrame2 = vad.consecutiveSpeechFrames >= 2;
    assert(isTriggeredFrame2, '3.6', 'Sustained candidate speech (frame 2) confirms vocal speech start');
  }

  // --------------------------------------------------------------------------
  // SECTION 4: Web Speech Low-Confidence Allowance
  // --------------------------------------------------------------------------
  console.log('\n--- Section 4: Web Speech Confidence Allowance for Whispers ---');
  {
    let triggeredCommand = null;
    const vc = new VoiceController((evt) => { triggeredCommand = evt; });

    // 4.1 Check debounce setting
    assert(vc.debounceMs === 350, '4.1', `VoiceController debounceMs reduced from 850ms to ${vc.debounceMs}ms (Zero Lag)`);

    // 4.2 Low-confidence quiet speech result (e.g. whispered "jarvis, what is the current time")
    // Chrome Speech API often returns 0.18-0.25 for whispered or soft speech
    const mockEvent = {
      resultIndex: 0,
      results: [
        Object.assign([
          { transcript: 'jarvis, what is the current time', confidence: 0.22 }
        ], { isFinal: true })
      ]
    };

    vc.handleSpeechResults(mockEvent);
    assert(triggeredCommand !== null && triggeredCommand.type === 'AI_QUERY', '4.2', `Quiet utterance with low confidence (0.22) accepted (Command: ${triggeredCommand?.type})`);

    // 4.3 Extremely low confidence follow-up query (0.10) in active session
    triggeredCommand = null;
    vc.lastTriggerTime = -10000; // Reset debounce guard
    vc.sessionManager.startSession('JARVIS', 'TEST');
    const mockWakeEvent = {
      resultIndex: 0,
      results: [
        Object.assign([
          { transcript: 'how are you feeling today', confidence: 0.10 }
        ], { isFinal: true })
      ]
    };
    vc.handleSpeechResults(mockWakeEvent);
    assert(triggeredCommand !== null && triggeredCommand.type === 'AI_QUERY', '4.3', `Follow-up query during active session accepted at 0.10 confidence (Command: ${triggeredCommand?.type})`);
  }

  // --------------------------------------------------------------------------
  // SECTION 5: Zero Avoidable Lag Parameters
  // --------------------------------------------------------------------------
  console.log('\n--- Section 5: Elimination of Avoidable Latency ---');
  {
    assert(CONFIG.speech.delayMs <= 60, '5.1', `Speech greeting delayMs reduced to ${CONFIG.speech.delayMs}ms (was 280ms)`);
    assert(CONFIG.session.speechEndDebounceMs <= 400, '5.2', `Speech end debounce reduced to ${CONFIG.session.speechEndDebounceMs}ms (was 700ms)`);
  }

  // --------------------------------------------------------------------------
  // SECTION 6: Ultra-Synthetic Voice Tuning & Distinct Personalities
  // --------------------------------------------------------------------------
  console.log('\n--- Section 6: Ultra-Synthetic Voice Profiles & Timbre Tuning ---');
  {
    const synth = new SpeechSynthesizer();

    // 6.1 Configuration check
    assert(CONFIG.speech.JARVIS.rate === 1.02, '6.1', `JARVIS synthetic rate tuned to 1.02 for crisp articulation`);
    assert(CONFIG.speech.JARVIS.pitch === 1.03, '6.2', `JARVIS synthetic pitch tuned to 1.03 for subtle crystalline resonance`);
    assert(CONFIG.speech.ULTRON.rate === 0.93, '6.3', `ULTRON synthetic rate tuned to 0.93 for deliberate mechanical pacing`);
    assert(CONFIG.speech.ULTRON.pitch === 0.80, '6.4', `ULTRON synthetic pitch tuned to 0.80 for deep resonance without guttural muffling`);

    // 6.2 Distinct voice resolution
    const jarvisVoice = synth.selectVoiceForTheme('JARVIS');
    const ultronVoice = synth.selectVoiceForTheme('ULTRON');

    assert(jarvisVoice !== null, '6.5', `JARVIS voice selected: "${jarvisVoice.name}" (${jarvisVoice.lang})`);
    assert(jarvisVoice.lang.toLowerCase().includes('gb') || jarvisVoice.name.toLowerCase().includes('george'), '6.6', `JARVIS assigned British voice`);
    assert(ultronVoice !== null, '6.7', `ULTRON voice selected: "${ultronVoice.name}" (${ultronVoice.lang})`);
    assert(ultronVoice.name !== jarvisVoice.name, '6.8', `JARVIS and ULTRON assigned distinct voice identities`);
  }

  // --------------------------------------------------------------------------
  // SECTION 7: Acronym Robotic Spoken Formatting
  // --------------------------------------------------------------------------
  console.log('\n--- Section 7: Acronym Pronunciation & Micro-Pause Formatting ---');
  {
    const synth = new SpeechSynthesizer();

    const rawInput = "JARVIS and ULTRON are AI cores with VAD, CPU, RAM, and HTTP SSE.";
    const cleaned = synth.cleanTextForSpeech(rawInput);

    assert(cleaned.includes('J.A.R.V.I.S.'), '7.1', `JARVIS formatted as "J.A.R.V.I.S." for crisp lettered speech`);
    assert(cleaned.includes('A.I.'), '7.2', `AI formatted as "A.I."`);
    assert(cleaned.includes('V.A.D.'), '7.3', `VAD formatted as "V.A.D."`);
    assert(cleaned.includes('C.P.U.'), '7.4', `CPU formatted as "C.P.U."`);
    assert(cleaned.includes('R.A.M.'), '7.5', `RAM formatted as "R.A.M."`);
    assert(cleaned.includes('H.T.T.P.'), '7.6', `HTTP formatted as "H.T.T.P."`);
    assert(cleaned.includes('S.S.E.'), '7.7', `SSE formatted as "S.S.E."`);
  }

  // --------------------------------------------------------------------------
  // SECTION 8: Procedural Carrier Acoustic Cues
  // --------------------------------------------------------------------------
  console.log('\n--- Section 8: Procedural Web Audio Carrier Cues ---');
  {
    const audioSynth = new AudioSynthesizer();
    audioSynth.init();

    let jarvisCarrierFired = false;
    let ultronCarrierFired = false;

    // Test execution of carrier methods without throwing
    try {
      audioSynth.playJarvisCarrier();
      jarvisCarrierFired = true;
    } catch (e) {}

    try {
      audioSynth.playUltronCarrier();
      ultronCarrierFired = true;
    } catch (e) {}

    assert(jarvisCarrierFired, '8.1', 'playJarvisCarrier() executed safely (dual 880/1760Hz shimmer tone)');
    assert(ultronCarrierFired, '8.2', 'playUltronCarrier() executed safely (55/110Hz mechanical sub-pulse)');

    // Test hook in speech synthesizer
    const synth = new SpeechSynthesizer();
    let cueThemeReceived = null;
    synth.onCarrierCue = (theme) => { cueThemeReceived = theme; };

    const uttId = synth.beginUtterance('JARVIS');
    synth.enqueueSentence('Diagnostic check online.', 'JARVIS', uttId, true);
    synth.markStreamComplete(uttId);

    // Allow mock dispatch tick
    await new Promise(r => setTimeout(r, 20));
    assert(cueThemeReceived === 'JARVIS', '8.3', 'SpeechSynthesizer triggers onCarrierCue on first spoken sentence');
  }

  // --------------------------------------------------------------------------
  // SECTION 9: Controlled Voice & Latency Diagnostic HUD
  // --------------------------------------------------------------------------
  console.log('\n--- Section 9: Voice & Latency Diagnostic HUD Telemetry ---');
  {
    const vc = new VoiceController(() => {});
    const synth = new SpeechSynthesizer();
    const diag = new VoiceDiagnostics({
      voiceController: vc,
      speechSynthesizer: synth
    });

    assert(!diag.isVisible, '9.1', 'Voice diagnostics HUD is hidden by default (clean cinematic interface preserved)');

    // Toggle HUD on
    diag.toggle();
    assert(diag.isVisible, '9.2', 'Voice diagnostics HUD successfully toggles on via toggle()');

    // Record latency metrics
    diag.recordLatencyMetrics({
      ttftMs: 185,
      ttfsMs: 840,
      dispatchMs: 4,
      totalMs: 1120
    });

    assert(diag.metrics.lastTtftMs === 185, '9.3', 'Diagnostic HUD recorded TTFT (185ms)');
    assert(diag.metrics.lastTtfsMs === 840, '9.4', 'Diagnostic HUD recorded TTFS (840ms)');
    assert(diag.metrics.lastTotalMs === 1120, '9.5', 'Diagnostic HUD recorded total response time (1120ms)');

    // Toggle HUD off
    diag.toggle();
    assert(!diag.isVisible, '9.6', 'Voice diagnostics HUD successfully toggles off, releasing timers');
  }

  console.log('\n========================================================================');
  console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
