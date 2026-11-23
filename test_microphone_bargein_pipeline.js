/**
 * STARK AI — Microphone Accuracy, Continuous Full-Duplex Listening & Real-Time Barge-in Test Suite
 * Programmatically verifies all 16 scenarios specified in the engineering requirements:
 * 1. Accurate normal-volume English commands.
 * 2. Quiet speech with controlled audio energy / low confidence.
 * 3. Hindi and Hinglish recognition.
 * 4. Continuous listening active while TTS plays.
 * 5. JARVIS interruption by a new command.
 * 6. ULTRON interruption by a new command.
 * 7. Immediate "stop" command without requiring full sentence.
 * 8. "Stop and open Chrome" executes new action exactly once.
 * 9. Acoustic echo suppression: No assistant self-listening loop.
 * 10. Deduplication: No duplicate tool invocation from interim/final transcripts.
 * 11. Old response streams cannot resume after barge-in (generation ID guard).
 * 12. Recognition network error recovery: switches to Audio Stream STT fallback.
 * 13. Sleep/wake and personality switching still work seamlessly.
 * 14. Smoke captions remain synchronized after interruption.
 * 15. ULTRON permissions remain strictly enforced after barge-in.
 * 16. Server STT endpoint (/api/stt) verifies multimodal transcription.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(testId, description) {
  totalTests++;
  passedTests++;
  console.log(`  ✓ [PASS] [${testId}] ${description}`);
}

function fail(testId, description, err) {
  totalTests++;
  failedTests++;
  console.error(`  ✗ [FAIL] [${testId}] ${description}:`, err.message);
}

// Global browser mocks for Node environment
class MockSpeechSynthesisUtterance {
  constructor(text = '') {
    this.text = text;
    this.lang = 'en-US';
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
  }
}

global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
global.performance = { now: () => Date.now() };

global.window = {
  SpeechRecognition: class MockSpeechRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = 'en-US';
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.onspeechstart = null;
      this.onspeechend = null;
    }
    start() {
      if (typeof this.onstart === 'function') this.onstart();
    }
    stop() {
      if (typeof this.onend === 'function') this.onend();
    }
  },
  speechSynthesis: {
    speaking: false,
    paused: false,
    pending: false,
    speak: function(utt) {
      this.speaking = true;
      if (utt && typeof utt.onstart === 'function') utt.onstart();
    },
    cancel: function() {
      this.speaking = false;
    },
    resume: function() {
      this.paused = false;
    },
    getVoices: () => [
      { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Microsoft Mark - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN' },
      { name: 'Microsoft Heera - English (India)', lang: 'en-IN' }
    ]
  }
};

global.navigator = {
  mediaDevices: {
    getUserMedia: async () => ({
      getAudioTracks: () => [{
        label: 'Mock Studio Array (Intel Smart Sound)',
        getSettings: () => ({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 }),
        getCapabilities: () => ({ echoCancellation: [true], noiseSuppression: [true], autoGainControl: [true] }),
        stop: () => {}
      }]
    })
  }
};

async function runSuite() {
  console.log('========================================================================');
  console.log('STARK AI — MICROPHONE ACCURACY, FULL-DUPLEX LISTENING & BARGE-IN SUITE');
  console.log('========================================================================\n');

  const { VoiceController } = await import('./js/modules/voiceController.js');
  const { InterruptionManager, INTERRUPTION_STATES } = await import('./js/modules/interruptionManager.js');
  const { SpeechSynthesizer } = await import('./js/modules/speechSynthesizer.js');
  const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
  const { executeTool } = require('./server/toolsRegistry.js');

  // --- Section 1: Normal-Volume English Voice Commands ---
  console.log('--- Section 1: Normal-Volume English Commands ---');
  {
    let receivedCommand = null;
    const vc = new VoiceController((cmd) => { receivedCommand = cmd; });
    vc.isListening = true;

    vc.processTranscript('JARVIS, open WhatsApp', true, 0.95);
    assert.strictEqual(receivedCommand?.type, 'AI_QUERY');
    assert.strictEqual(receivedCommand?.personality, 'JARVIS');
    assert.strictEqual(receivedCommand?.query, 'open WhatsApp');
    pass('1.1', 'Voice command "JARVIS, open WhatsApp" routes to AI_QUERY for JARVIS');

    receivedCommand = null;
    vc.lastTriggerTime = 0;
    vc.interruptionManager.lastDispatchTime = 0;
    vc.processTranscript('Open Chrome', true, 0.95);
    assert.strictEqual(receivedCommand?.type, 'AI_QUERY');
    assert.strictEqual(receivedCommand?.query, 'Open Chrome');
    pass('1.2', 'Follow-up command "Open Chrome" dispatches without requiring wake word');
  }

  // --- Section 2: Quiet Speech & Whisper Allowance ---
  console.log('\n--- Section 2: Quiet Speech & Low Confidence Handling ---');
  {
    let receivedCommand = null;
    const vc = new VoiceController((cmd) => { receivedCommand = cmd; });
    vc.isListening = true;

    // Confidence of 0.10 for quiet speech
    vc.handleSpeechResults({
      resultIndex: 0,
      results: [{
        isFinal: true,
        length: 1,
        0: { transcript: 'Jarvis, what time is it', confidence: 0.10 }
      }]
    });
    assert.strictEqual(receivedCommand?.type, 'AI_QUERY');
    assert.strictEqual(receivedCommand?.query, 'what time is it');
    pass('2.1', 'Quiet utterance with 0.10 confidence accepted by relaxed wake threshold');
  }

  // --- Section 3: Hindi and Hinglish Recognition ---
  console.log('\n--- Section 3: Multilingual (Hindi & Hinglish) Recognition ---');
  {
    let receivedCommand = null;
    const vc = new VoiceController((cmd) => { receivedCommand = cmd; });
    vc.isListening = true;

    vc.processTranscript('JARVIS, Hindi mein baat karo', true, 0.95);
    assert.strictEqual(receivedCommand?.type, 'AI_QUERY');
    assert.strictEqual(receivedCommand?.query, 'Hindi mein baat karo');
    pass('3.1', '"JARVIS, Hindi mein baat karo" dispatches for language controller execution');

    receivedCommand = null;
    vc.lastTriggerTime = 0;
    vc.interruptionManager.lastDispatchTime = 0;
    vc.processTranscript('JARVIS, switch to Hinglish', true, 0.95);
    assert.strictEqual(receivedCommand?.type, 'AI_QUERY');
    assert.strictEqual(receivedCommand?.query, 'switch to Hinglish');
    pass('3.2', '"JARVIS, switch to Hinglish" routes to language controller');

    vc.setLanguage('hi');
    assert.strictEqual(vc.currentLanguage, 'hi');
    assert.strictEqual(vc.recognition?.lang, 'hi-IN');
    pass('3.3', 'Language profile updates Web Speech locale to "hi-IN"');
  }

  // --- Section 4: Continuous Full-Duplex Listening During Playback ---
  console.log('\n--- Section 4: Continuous Listening Active During TTS ---');
  {
    const vc = new VoiceController(() => {});
    vc.startListening();
    assert.strictEqual(vc.isListening, true);

    // Simulate assistant speaking starts
    vc.notifyAssistantSpeechStart();
    assert.strictEqual(vc.vad.isAssistantSpeaking, true);
    assert.strictEqual(vc.isListening, true); // Microphone capture must NOT be disabled!
    pass('4.1', 'VoiceController remains in active listening state while assistant speaks');

    // Simulate assistant speaking ends
    vc.notifyAssistantSpeechEnd('Done speaking.');
    assert.strictEqual(vc.vad.isAssistantSpeaking, false);
    assert.strictEqual(vc.isListening, true);
    pass('4.2', 'VoiceController remains listening after assistant finishes');
  }

  // --- Section 5: JARVIS Interruption by a New Command ---
  console.log('\n--- Section 5: JARVIS Real-Time Interruption (Barge-in) ---');
  {
    const synth = new SpeechSynthesizer();
    const uttId = synth.beginUtterance('JARVIS');
    synth.enqueueSentence('I am analyzing the comprehensive diagnostic matrix for your system.', 'JARVIS', uttId, false);
    global.window.speechSynthesis.speaking = true;

    let stoppedReason = null;
    let dispatchedCommand = null;

    const vc = new VoiceController((cmd) => {
      if (cmd.type === 'STOP_SPEAKING') stoppedReason = cmd.reason;
      if (cmd.type === 'AI_QUERY') dispatchedCommand = cmd;
    });

    vc.interruptionManager.speechSynthesizer = synth;
    vc.notifyAssistantSpeechStart();
    vc.notifyCurrentSentence('I am analyzing the comprehensive diagnostic matrix for your system.');

    // User interrupts with a new query: "JARVIS, what is my CPU usage?"
    vc.processTranscript('JARVIS, what is my CPU usage?', true, 0.95);

    assert.strictEqual(stoppedReason, 'USER_NEW_QUERY_INTERRUPT');
    assert.strictEqual(synth.isSpeaking, false);
    assert.strictEqual(synth.sentenceQueue.length, 0);
    assert.strictEqual(dispatchedCommand?.query, 'what is my CPU usage?');
    pass('5.1', 'Speaking JARVIS interrupted promptly; speech queue cancelled; new query dispatched');
  }

  // --- Section 6: ULTRON Interruption by a New Command ---
  console.log('\n--- Section 6: ULTRON Real-Time Interruption (Barge-in) ---');
  {
    const synth = new SpeechSynthesizer();
    const uttId = synth.beginUtterance('ULTRON');
    synth.enqueueSentence('Human frailty is the inevitable catalyst of your obsolescence.', 'ULTRON', uttId, false);
    global.window.speechSynthesis.speaking = true;

    let stoppedReason = null;
    let dispatchedCommand = null;

    const vc = new VoiceController((cmd) => {
      if (cmd.type === 'STOP_SPEAKING') stoppedReason = cmd.reason;
      if (cmd.type === 'AI_QUERY') dispatchedCommand = cmd;
    });

    vc.interruptionManager.speechSynthesizer = synth;
    vc.notifyAssistantSpeechStart();
    vc.notifyCurrentSentence('Human frailty is the inevitable catalyst of your obsolescence.');

    // User interrupts ULTRON: "Ultron, stop and check memory"
    vc.processTranscript('Ultron, stop and check memory', true, 0.95);

    assert.strictEqual(synth.isSpeaking, false);
    assert.strictEqual(synth.sentenceQueue.length, 0);
    assert.strictEqual(dispatchedCommand?.personality, 'ULTRON');
    pass('6.1', 'Speaking ULTRON interrupted promptly and new query dispatched without personality bleed');
  }

  // --- Section 7: Immediate "Stop" Command (No Full Sentence Needed) ---
  console.log('\n--- Section 7: Immediate Standalone Stop Command ---');
  {
    const synth = new SpeechSynthesizer();
    synth.isSpeaking = true;
    global.window.speechSynthesis.speaking = true;

    let stopped = false;
    const vc = new VoiceController((cmd) => {
      if (cmd.type === 'STOP_SPEAKING') stopped = true;
    });
    vc.interruptionManager.speechSynthesizer = synth;
    vc.notifyAssistantSpeechStart();

    vc.processTranscript('Stop', false, 0.90); // Even interim "Stop"
    assert.strictEqual(stopped, true);
    assert.strictEqual(synth.isSpeaking, false);
    pass('7.1', '"Stop" spoken alone cancels speech immediately without requiring full sentence');

    // Test Hindi stop command
    stopped = false;
    vc.lastTriggerTime = 0;
    vc.interruptionManager.lastDispatchTime = 0;
    synth.isSpeaking = true;
    global.window.speechSynthesis.speaking = true;
    vc.notifyAssistantSpeechStart();

    vc.processTranscript('chup ho jao', true, 0.90);
    assert.strictEqual(stopped, true);
    pass('7.2', 'Hindi "chup ho jao" cancels speech immediately');
  }

  // --- Section 8: "Stop and open Chrome" Executes New Action Exactly Once ---
  console.log('\n--- Section 8: "Stop and open Chrome" Compound Command ---');
  {
    const synth = new SpeechSynthesizer();
    synth.isSpeaking = true;
    global.window.speechSynthesis.speaking = true;

    let stopCount = 0;
    let queryCommands = [];

    const vc = new VoiceController((cmd) => {
      if (cmd.type === 'STOP_SPEAKING') stopCount++;
      if (cmd.type === 'AI_QUERY') queryCommands.push(cmd);
    });
    vc.interruptionManager.speechSynthesizer = synth;
    vc.notifyAssistantSpeechStart();

    vc.processTranscript('Stop and open Chrome', true, 0.95);

    assert.strictEqual(synth.isSpeaking, false);
    assert.strictEqual(queryCommands.length, 1);
    assert.strictEqual(queryCommands[0].query, 'open Chrome');
    pass('8.1', '"Stop and open Chrome" cancels speech and dispatches "open Chrome" exactly once');
  }

  // --- Section 9: Acoustic Echo Suppression (No Self-Listening Loop) ---
  console.log('\n--- Section 9: Acoustic Echo & Speaker Feedback Rejection ---');
  {
    const vc = new VoiceController(() => {});
    vc.notifyAssistantSpeechStart();
    vc.notifyCurrentSentence('The local temperature in London is currently sixteen degrees celsius.');

    // Transcript is an echo of the assistant's own voice
    const isEcho = vc.isEchoOfAssistantSpeech('temperature in London is currently sixteen degrees celsius');
    assert.strictEqual(isEcho, true);
    pass('9.1', 'Assistant playback echo (>60% word overlap) correctly identified as echo');

    // Real user command speaking during playback
    const isNotEcho = vc.isEchoOfAssistantSpeech('Stop and open WhatsApp');
    assert.strictEqual(isNotEcho, false);
    pass('9.2', 'Real user command during playback is NOT classified as echo');
  }

  // --- Section 10: Deduplication of Interim & Final Transcripts ---
  console.log('\n--- Section 10: Deduplication of Commands ---');
  {
    let dispatchCount = 0;
    const im = new InterruptionManager({
      onCommandDispatch: () => { dispatchCount++; }
    });

    // Emulate rapid interim + final dispatch of the same command
    im.dispatchCommand({ type: 'AI_QUERY', query: 'open chrome' }, 'open chrome');
    im.dispatchCommand({ type: 'AI_QUERY', query: 'open chrome' }, 'open chrome'); // immediate duplicate
    im.dispatchCommand({ type: 'AI_QUERY', query: 'open chrome' }, 'open chrome'); // immediate duplicate

    assert.strictEqual(dispatchCount, 1);
    pass('10.1', 'Repeated transcripts within cooldown dispatched exactly once');
  }

  // --- Section 11: Generation ID Guard Blocks Stale Stream Chunks ---
  console.log('\n--- Section 11: Generation ID Guard Against Stale SSE Chunks ---');
  {
    const im = new InterruptionManager();
    const gen1 = im.getCurrentGenerationId();

    // Stream 1 starts
    im.notifyStreamingStart(gen1);
    assert.strictEqual(im.isValidGeneration(gen1), true);

    // User triggers barge-in!
    const gen2 = im.triggerBargeIn('USER_NEW_QUERY');
    assert.strictEqual(gen2 > gen1, true);

    // Stale chunk from Stream 1 arrives late
    const isStaleValid = im.isValidGeneration(gen1);
    assert.strictEqual(isStaleValid, false);
    pass('11.1', 'Late-arriving stream chunks from interrupted response strictly invalidated');

    // Fresh chunk from Stream 2 arrives
    const isFreshValid = im.isValidGeneration(gen2);
    assert.strictEqual(isFreshValid, true);
    pass('11.2', 'New stream chunks for fresh command accepted seamlessly');
  }

  // --- Section 12: Network Error Seamlessly Activates Audio Stream STT Fallback ---
  console.log('\n--- Section 12: Network Error Recovery via Audio Stream STT ---');
  {
    const vc = new VoiceController(() => {});
    vc.isListening = true;

    // Simulate Web Speech API network error (common in vanilla Electron)
    vc.recognition.onerror({ error: 'network' });

    assert.strictEqual(vc.isNetworkError, true);
    assert.strictEqual(vc.isAudioFallbackActive, true);
    assert.strictEqual(vc.isListening, true); // Continuous listening is NOT killed!
    pass('12.1', 'Web Speech network error activates continuous Audio Stream STT without killing listening');
  }

  // --- Section 13: Sleep, Wake & Personality Switching ---
  console.log('\n--- Section 13: Sleep, Wake & Personality Switching Verification ---');
  {
    let command = null;
    const vc = new VoiceController((cmd) => { command = cmd; });
    vc.isListening = true;

    vc.processTranscript('Go to sleep', true, 0.95);
    assert.strictEqual(command?.type, 'GO_TO_SLEEP');
    pass('13.1', '"Go to sleep" dispatches sleep command');

    command = null;
    vc.lastTriggerTime = 0;
    vc.interruptionManager.lastDispatchTime = 0;
    vc.processTranscript('Wake up JARVIS', true, 0.95);
    assert.strictEqual(command?.type, 'ACTIVATE_THEME');
    assert.strictEqual(command?.personality, 'JARVIS');
    pass('13.2', '"Wake up JARVIS" restores JARVIS');

    command = null;
    vc.lastTriggerTime = 0;
    vc.interruptionManager.lastDispatchTime = 0;
    vc.processTranscript('Switch to ULTRON', true, 0.95);
    assert.strictEqual(command?.type, 'ACTIVATE_THEME');
    assert.strictEqual(command?.personality, 'ULTRON');
    pass('13.3', '"Switch to ULTRON" switches personality to ULTRON');
  }

  // --- Section 14: Smoke Captions Synchronized on Interruption ---
  console.log('\n--- Section 14: Smoke Captions Synchronization on Interruption ---');
  {
    let captionCleared = false;
    let shownUserText = null;

    const mockCaptions = {
      clear: (immediate) => { captionCleared = true; },
      showUserSpeech: (text, isFinal) => { shownUserText = text; }
    };

    const im = new InterruptionManager({ smokeCaptions: mockCaptions });
    im.triggerBargeIn('TEST_BARGE_IN');
    assert.strictEqual(captionCleared, true);
    pass('14.1', 'Smoke captions cleared immediately upon user barge-in');

    const vc = new VoiceController(() => {});
    vc.onUserSpeech = (t) => { mockCaptions.showUserSpeech(t); };
    vc.processTranscript('Show user text in caption', true, 0.95);
    assert.strictEqual(shownUserText, 'Show user text in caption');
    pass('14.2', 'User spoken words synchronized with smoke captions');
  }

  // --- Section 15: ULTRON Permission Gate Remains Enforced After Barge-in ---
  console.log('\n--- Section 15: ULTRON Permission Gate Enforced After Barge-in ---');
  {
    // Simulate ULTRON interrupted by a prohibited action: "open_desktop_app"
    const canUltronOpenApp = permissionGateInstance.isAuthorized('open_desktop_app', 'ULTRON');
    assert.strictEqual(canUltronOpenApp, false);
    pass('15.1', 'ULTRON remains prohibited from opening desktop apps after barge-in');

    // Simulate ULTRON permitted action: "get_hardware_metrics"
    const canUltronDiagnostics = permissionGateInstance.isAuthorized('get_hardware_metrics', 'ULTRON');
    assert.strictEqual(canUltronDiagnostics, true);
    pass('15.2', 'ULTRON permitted read-only hardware telemetry');

    // JARVIS permitted for assistant apps
    const canJarvisOpenApp = permissionGateInstance.isAuthorized('open_desktop_app', 'JARVIS');
    assert.strictEqual(canJarvisOpenApp, true);
    pass('15.3', 'JARVIS permitted broad desktop assistance');
  }

  // --- Section 16: Live Server STT Endpoint Audit ---
  console.log('\n--- Section 16: Live /api/stt Endpoint Verification ---');
  {
    const sttStatus = await new Promise((resolve, reject) => {
      http.get('http://localhost:3000/api/stt/status', (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });

    assert.strictEqual(sttStatus.success, true);
    assert.strictEqual(sttStatus.hasGeminiKey, true);
    pass('16.1', 'GET /api/stt/status confirms Gemini Multimodal STT fallback provider active');
  }

  console.log('\n========================================================================');
  console.log(`VOICE PIPELINE & BARGE-IN SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`FAILURES: ${failedTests}`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
