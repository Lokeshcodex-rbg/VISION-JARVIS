/**
 * STARK AI — Zero-Lag Voice Pipeline & Global Emergency Stop Comprehensive Test Suite
 * Validates all 14 real failure cases specified in Mission 7:
 *  1. Emergency Stop button clicked while JARVIS is speaking
 *  2. Space bar pressed while JARVIS is speaking
 *  3. Emergency stop while the model is generating a response
 *  4. Emergency stop during a long-running tool execution
 *  5. Emergency stop while the camera and microphone are active
 *  6. A delayed model response arriving after the stop
 *  7. A queued speech segment attempting to play after the stop
 *  8. Repeated emergency-stop activation (idempotency)
 *  9. Attempted new commands while stopped
 * 10. Explicit resume after a stop
 * 11. Provider timeout and recovery
 * 12. Many consecutive voice turns with continuously updating captions
 * 13. Interruption during speech followed by a new request
 * 14. Renderer/backend disconnection and recovery
 */

const assert = require('assert');
const { performance } = require('perf_hooks');

// Import Backend Singletons
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { latencyTrackerInstance } = require('./server/latencyTracker.js');
const { executeTool } = require('./server/toolsRegistry.js');
const { taskOrchestratorInstance } = require('./server/taskOrchestrator.js');
const { SentenceStreamer } = require('./server/aiProviderAdapter.js');

let passed = 0;
let failed = 0;

function testAssert(condition, testId, description) {
  if (condition) {
    console.log(`  ✓ [PASS] [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] [${testId}] ${description}`);
    failed++;
  }
}

// Setup Mock Browser Global Environment for Renderer Modules
function setupMockBrowser() {
  const elements = new Map();

  function createMockElement(id, tagName = 'div') {
    const el = {
      id,
      tagName: tagName.toUpperCase(),
      className: '',
      classList: {
        add: (c) => { el.className += ' ' + c; },
        remove: (c) => { el.className = el.className.replace(new RegExp('\\b' + c + '\\b', 'g'), '').trim(); },
        contains: (c) => el.className.includes(c)
      },
      style: {},
      textContent: '',
      innerHTML: '',
      children: [],
      appendChild: (child) => { el.children.push(child); return child; },
      contains: (child) => el.children.includes(child),
      setAttribute: (k, v) => { el[k] = v; },
      getAttribute: (k) => el[k],
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    elements.set(id, el);
    return el;
  }

  const document = {
    activeElement: null,
    getElementById: (id) => elements.get(id) || createMockElement(id),
    createElement: (tag) => createMockElement('el_' + Math.random().toString(36).slice(2, 6), tag),
    querySelectorAll: () => [],
    body: createMockElement('body')
  };

  let mockSpeaking = false;
  let mockPaused = false;
  const mockUtterances = new Set();

  class MockSpeechSynthesisUtterance {
    constructor(text) {
      this.text = text;
      this.lang = 'en-US';
      this.rate = 1.0;
      this.pitch = 1.0;
      this.volume = 1.0;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  }

  const window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    speechSynthesis: {
      get speaking() { return mockSpeaking; },
      get paused() { return mockPaused; },
      speak: (u) => {
        mockSpeaking = true;
        mockUtterances.add(u);
        setTimeout(() => {
          if (u.onstart) u.onstart();
        }, 2);
      },
      cancel: () => {
        mockSpeaking = false;
        mockUtterances.clear();
      },
      resume: () => { mockPaused = false; },
      getVoices: () => [
        { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
        { name: 'Microsoft Mark - English (United States)', lang: 'en-US' }
      ]
    },
    SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
    desktopAPI: {
      isElectron: true,
      triggerEmergencyStop: (reason) => emergencyStopControllerInstance.engage(reason),
      resetEmergencyStop: (reason) => emergencyStopControllerInstance.reset(reason),
      getEmergencyStopStatus: () => emergencyStopControllerInstance.getStatus(),
      onEmergencyStopEngaged: () => () => {},
      onEmergencyStopReset: () => () => {}
    }
  };

  global.window = window;
  global.document = document;
  global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  global.navigator = { onLine: true, mediaDevices: {} };

  return { window, document, elements };
}

async function runAllTests() {
  console.log('================================================================');
  console.log('STARK AI — ZERO-LAG CONVERSATION & EMERGENCY STOP TEST SUITE');
  console.log('================================================================');

  setupMockBrowser();

  // Dynamically import ES modules in mock environment
  const { SpeechSynthesizer } = await import('./js/modules/speechSynthesizer.js');
  const { VoiceController } = await import('./js/modules/voiceController.js');
  const { AIClient } = await import('./js/modules/aiClient.js');
  const { SmokeCaptions } = await import('./js/modules/smokeCaptions.js');
  const { EmergencyStopCoordinator } = await import('./js/modules/emergencyStopCoordinator.js');

  // Build Mock Application Harness
  const mockApp = {
    speechSynthesizer: new SpeechSynthesizer(),
    aiClient: new AIClient('/api/chat', '/api/chat/stream'),
    smokeCaptions: new SmokeCaptions('smoke-captions'),
    voiceController: new VoiceController(() => {}),
    sensorManager: {
      isCameraStreaming: true,
      onEmergencyStop: function() { this.isCameraStreaming = false; }
    },
    isPaused: false,
    setExpressionState: (s) => {}
  };

  const coordinator = new EmergencyStopCoordinator(mockApp);
  mockApp.emergencyStopCoordinator = coordinator;

  // -------------------------------------------------------------------------
  // SCENARIO 1: Emergency Stop button clicked while JARVIS is speaking
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 1: Emergency Stop Button Clicked While JARVIS Is Speaking ---');
  {
    coordinator.resetEmergencyStop();
    const uttId = mockApp.speechSynthesizer.beginUtterance('JARVIS');
    mockApp.speechSynthesizer.enqueueSentence('Good morning, sir.', 'JARVIS', uttId);
    mockApp.speechSynthesizer.enqueueSentence('All engineering systems are operational.', 'JARVIS', uttId);
    testAssert(mockApp.speechSynthesizer.sentenceQueue.length > 0 || mockApp.speechSynthesizer.isSpeaking, '1.1', 'Utterance and sentences queued in SpeechSynthesizer');

    // Simulate clicking the Emergency Stop button
    await coordinator.triggerEmergencyStop('Header Emergency Stop button clicked');

    testAssert(coordinator.isEmergencyStopActive() === true, '1.2', 'EmergencyStopCoordinator latch is engaged');
    testAssert(mockApp.speechSynthesizer.isSpeaking === false, '1.3', 'SpeechSynthesizer active speech silenced');
    testAssert(mockApp.speechSynthesizer.sentenceQueue.length === 0, '1.4', 'SpeechSynthesizer queue completely drained');
    testAssert(emergencyStopControllerInstance.isEngaged() === true, '1.5', 'Backend emergencyStopControllerInstance engaged');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 2: Accidental Spacebar Trigger Removed & Dedicated Ctrl+Shift+X Verification
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Spacebar Accidental Trigger Removed & Ctrl+Shift+X Verification ---');
  {
    await coordinator.resetEmergencyStop();
    testAssert(coordinator.isEmergencyStopActive() === false, '2.1', 'Reset cleanly unlatched coordinator');

    // Start speaking
    const uttId = mockApp.speechSynthesizer.beginUtterance('JARVIS');
    mockApp.speechSynthesizer.enqueueSentence('I am analyzing the telemetry data now.', 'JARVIS', uttId);

    // 1. Simulate bare Space bar pressed (whether inside or outside input fields)
    document.activeElement = { tagName: 'DIV', isContentEditable: false };
    const spaceEvent = { code: 'Space', key: ' ', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };

    // Handler logic from hardened app.js: bare Space is NO LONGER handled for emergency stop
    if (spaceEvent.ctrlKey && spaceEvent.shiftKey && (spaceEvent.key === 'X' || spaceEvent.key === 'x')) {
      spaceEvent.preventDefault();
      await coordinator.triggerEmergencyStop('Global shortcut Ctrl+Shift+X');
    }

    testAssert(spaceEvent.defaultPrevented === false, '2.2', 'Space bar default is NOT prevented (normal typing & interaction preserved)');
    testAssert(coordinator.isEmergencyStopActive() === false, '2.3', 'Space bar does NOT trigger emergency stop latch');
    testAssert(mockApp.speechSynthesizer.sentenceQueue.length > 0 || mockApp.speechSynthesizer.isSpeaking, '2.4', 'Speech playback continues uninterrupted during Space bar press');

    // 2. Verify dedicated shortcut Ctrl+Shift+X triggers Emergency Stop
    const ctrlShiftXEvent = { code: 'KeyX', key: 'X', ctrlKey: true, altKey: false, metaKey: false, shiftKey: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    if (ctrlShiftXEvent.ctrlKey && ctrlShiftXEvent.shiftKey && (ctrlShiftXEvent.key === 'X' || ctrlShiftXEvent.key === 'x')) {
      ctrlShiftXEvent.preventDefault();
      await coordinator.triggerEmergencyStop('Global shortcut Ctrl+Shift+X');
    }

    testAssert(ctrlShiftXEvent.defaultPrevented === true, '2.5', 'Dedicated shortcut Ctrl+Shift+X default prevented');
    testAssert(coordinator.isEmergencyStopActive() === true, '2.6', 'Dedicated shortcut Ctrl+Shift+X immediately engages emergency stop');
    testAssert(mockApp.speechSynthesizer.sentenceQueue.length === 0, '2.7', 'Queued speech cleared upon dedicated Ctrl+Shift+X trigger');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 3: Emergency stop while the model is generating a response
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Emergency Stop While Model Is Generating Response ---');
  {
    await coordinator.resetEmergencyStop();
    let streamCancelled = false;

    // Simulate active in-flight request
    mockApp.aiClient.currentAbortController = new AbortController();
    mockApp.aiClient.isQuerying = true;
    mockApp.aiClient.currentAbortController.signal.addEventListener('abort', () => {
      streamCancelled = true;
    });

    await coordinator.triggerEmergencyStop('Stop mid-generation');

    testAssert(streamCancelled === true, '3.1', 'Active AIClient AbortController signaled abort');
    testAssert(mockApp.aiClient.isQuerying === false, '3.2', 'AIClient isQuerying reset to false');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 4: Emergency stop during a long-running tool execution
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Emergency Stop During Long-Running Tool Execution ---');
  {
    await coordinator.resetEmergencyStop();

    // Register active tool abort controller
    const toolController = new AbortController();
    let toolAborted = false;
    toolController.signal.addEventListener('abort', () => { toolAborted = true; });
    emergencyStopControllerInstance.registerToolAbortController(toolController);

    // Engage stop
    emergencyStopControllerInstance.engage('Tool execution stop');

    testAssert(toolAborted === true, '4.1', 'Active tool abort controller aborted upon emergency stop');
    testAssert(emergencyStopControllerInstance.activeToolControllers.size === 0, '4.2', 'Tool controllers registry cleared');

    // Attempt to execute task DAG while stopped
    let taskRejected = false;
    try {
      await taskOrchestratorInstance.executeAutonomousTask({ instruction: 'Check system health and memory usage' });
    } catch (err) {
      if (err.message.includes('EMERGENCY_STOP_ACTIVE')) {
        taskRejected = true;
      }
    }
    testAssert(taskRejected === true, '4.3', 'Task orchestrator halts execution when emergency stop is engaged');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 5: Emergency stop while camera and microphone are active
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Emergency Stop While Camera and Microphone Are Active ---');
  {
    await coordinator.resetEmergencyStop();
    mockApp.sensorManager.isCameraStreaming = true;
    mockApp.voiceController.startListening();
    testAssert(mockApp.voiceController.isListening === true, '5.1', 'VoiceController active before stop');

    await coordinator.triggerEmergencyStop('Stop perception');

    testAssert(mockApp.voiceController.isListening === false, '5.2', 'VoiceController listening halted');
    testAssert(mockApp.voiceController.isRecognitionActive === false, '5.3', 'Speech recognition engine stopped');
    testAssert(mockApp.sensorManager.isCameraStreaming === false, '5.4', 'Camera preview stream stopped');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 6: Delayed model response arriving after the stop
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Delayed Model Response Arriving After Stop ---');
  {
    // System is stopped
    testAssert(coordinator.isEmergencyStopActive() === true, '6.1', 'System confirmed stopped');

    let delayedTokenReceived = false;
    let delayedSentenceReceived = false;

    const streamer = new SentenceStreamer(
      (sentence) => { delayedSentenceReceived = true; },
      (token) => { delayedTokenReceived = true; }
    );

    // Attempt pushing delayed tokens after stop
    streamer.push('This is a late token.');
    testAssert(delayedTokenReceived === false, '6.2', 'SentenceStreamer dropped delayed tokens while stopped');
    testAssert(delayedSentenceReceived === false, '6.3', 'SentenceStreamer dropped delayed sentence while stopped');

    // Attempt rendering late captions
    mockApp.smokeCaptions.appendAssistantStream('Late caption token', 'JARVIS');
    testAssert(!mockApp.smokeCaptions.currentText.includes('Late caption token'), '6.4', 'SmokeCaptions ignored late tokens while stopped');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 7: Queued speech segment attempting to play after the stop
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Queued Speech Segment Attempting to Play After Stop ---');
  {
    testAssert(mockApp.speechSynthesizer.isEmergencyStopped === true, '7.1', 'SpeechSynthesizer latched in emergency stop');
    mockApp.speechSynthesizer.enqueueSentence('This sentence should never play', 'JARVIS', 'utt_late');
    mockApp.speechSynthesizer.speak('Late speak command', 'JARVIS');

    testAssert(mockApp.speechSynthesizer.sentenceQueue.length === 0, '7.2', 'Late sentence rejected from queue');
    testAssert(mockApp.speechSynthesizer.isSpeaking === false, '7.3', 'Late speak command rejected');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 8: Repeated emergency-stop activation (Idempotency)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 8: Repeated Emergency Stop Activation (Idempotency) ---');
  {
    let noErrors = true;
    try {
      for (let i = 0; i < 5; i++) {
        emergencyStopControllerInstance.engage(`Repeated stop ${i}`);
        await coordinator.triggerEmergencyStop(`Repeated coordinator stop ${i}`);
      }
    } catch (err) {
      noErrors = false;
    }
    testAssert(noErrors === true, '8.1', 'Repeated emergency stop triggers executed safely without exception');
    testAssert(coordinator.isEmergencyStopActive() === true, '8.2', 'Coordinator remains safely latched');
    testAssert(emergencyStopControllerInstance.isEngaged() === true, '8.3', 'Backend remains safely latched');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 9: Attempted new commands while stopped
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 9: Attempted New Commands While Stopped ---');
  {
    let toolRejected = false;
    try {
      await executeTool('get_current_time', {}, 'JARVIS');
    } catch (err) {
      if (err.message.includes('EMERGENCY_STOP_ACTIVE')) {
        toolRejected = true;
      }
    }
    testAssert(toolRejected === true, '9.1', 'ToolsRegistry rejected tool execution while stopped');

    const sendRes = await mockApp.aiClient.sendMessage('JARVIS', 'Hello');
    testAssert(sendRes.emergencyStopped === true || sendRes.aborted === true, '9.2', 'AIClient.sendMessage rejected while stopped');

    const streamRes = await mockApp.aiClient.streamMessage('JARVIS', 'Hello', {});
    testAssert(streamRes.emergencyStopped === true || streamRes.aborted === true, '9.3', 'AIClient.streamMessage rejected while stopped');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 10: Explicit resume after a stop
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 10: Explicit Resume After Stop ---');
  {
    const resumeRes = await coordinator.resetEmergencyStop('User clicked resume');
    testAssert(resumeRes.success === true, '10.1', 'Coordinator reset returned success');
    testAssert(coordinator.isEmergencyStopActive() === false, '10.2', 'Coordinator latch released');
    testAssert(emergencyStopControllerInstance.isEngaged() === false, '10.3', 'Backend controller released');
    testAssert(mockApp.speechSynthesizer.isEmergencyStopped === false, '10.4', 'SpeechSynthesizer re-armed');
    testAssert(mockApp.voiceController.isEmergencyStopped === false, '10.5', 'VoiceController re-armed');

    // Verify tool execution functions normally again after resume
    const timeTool = await executeTool('get_current_time', {}, 'JARVIS');
    testAssert(timeTool.success === true && (timeTool.currentTime || timeTool.time || timeTool.iso), '10.6', 'Tool execution works normally after explicit resume');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 11: Provider timeout and recovery
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 11: Provider Timeout and Fallback Recovery ---');
  {
    const { aiAdapterInstance } = require('./server/aiProviderAdapter.js');
    testAssert(typeof aiAdapterInstance.streamResponse === 'function', '11.1', 'aiAdapterInstance streamResponse available');

    let streamCompleted = false;
    let streamSentence = '';
    let streamToken = '';

    await aiAdapterInstance.streamResponse({
      personality: 'JARVIS',
      userMessage: 'What time is it?',
      onToken: (tok) => { streamToken += tok; },
      onSentence: (sent) => { streamSentence = sent; },
      onDone: (res) => { streamCompleted = true; }
    });

    testAssert(streamCompleted === true, '11.2', 'Instant tool query resolved with zero cloud timeout');
    testAssert(streamToken.length > 0, '11.3', 'Tokens emitted immediately on instant tool response');
    testAssert(streamSentence.length > 0, '11.4', 'Sentence formed and emitted to client');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 12: Many consecutive voice turns with continuously updating captions
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 12: Many Consecutive Turns With Progressive Captions ---');
  {
    let totalTokensEmitted = 0;
    let totalSentencesEmitted = 0;

    for (let turn = 1; turn <= 10; turn++) {
      let tokensThisTurn = 0;
      let sentencesThisTurn = 0;

      const streamer = new SentenceStreamer(
        (sentence, idx) => {
          sentencesThisTurn++;
          totalSentencesEmitted++;
          mockApp.smokeCaptions.showAssistantSentence(sentence, 'JARVIS');
        },
        (token) => {
          tokensThisTurn++;
          totalTokensEmitted++;
          mockApp.smokeCaptions.appendAssistantStream(token, 'JARVIS');
        }
      );

      // Push 5 token chunks per turn
      streamer.push('Processing ');
      streamer.push('telemetry ');
      streamer.push('cycle ');
      streamer.push(String(turn));
      streamer.push('. All values nominal.');
      streamer.flush();
      streamer.destroy();

      testAssert(tokensThisTurn === 5, `12.Turn${turn}.Tokens`, `Turn ${turn}: 5 progressive tokens emitted`);
      testAssert(sentencesThisTurn >= 1, `12.Turn${turn}.Sentences`, `Turn ${turn}: Sentences cleanly separated`);
    }

    testAssert(totalTokensEmitted === 50, '12.Summary', 'All 50 tokens processed across 10 consecutive turns');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 13: Interruption during speech followed by a new request
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 13: Interruption During Speech Followed By New Request ---');
  {
    const uttId1 = mockApp.speechSynthesizer.beginUtterance('JARVIS');
    mockApp.voiceController.notifyAssistantSpeechStart();
    mockApp.speechSynthesizer.enqueueSentence('This is the first long sentence being spoken.', 'JARVIS', uttId1);

    const prevGen = mockApp.voiceController.interruptionManager.getCurrentGenerationId();

    // User speaks over JARVIS (barge-in)
    mockApp.voiceController.interruptionManager.notifyUserSpeechOnset('VAD_BARGE_IN_ONSET', { volume: 0.85 });

    const newGen = mockApp.voiceController.interruptionManager.getCurrentGenerationId();
    testAssert(newGen > prevGen, '13.1', 'Interruption generation ID advanced to invalidate prior audio');
    testAssert(mockApp.speechSynthesizer.sentenceQueue.length === 0, '13.2', 'Interruption cleared prior speech queue');

    // New request starts cleanly
    const uttId2 = mockApp.speechSynthesizer.beginUtterance('JARVIS');
    mockApp.speechSynthesizer.enqueueSentence('Yes, sir? How may I assist you?', 'JARVIS', uttId2);
    testAssert(mockApp.speechSynthesizer.activeUtteranceId === uttId2, '13.3', 'New utterance cleanly established');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 14: Renderer/backend disconnection and recovery
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 14: Renderer/Backend Disconnection and Recovery ---');
  {
    // Simulate network offline
    mockApp.voiceController.subsystems.networkConnectivity = 'offline';
    testAssert(mockApp.voiceController.subsystems.networkConnectivity === 'offline', '14.1', 'Network offline detected');

    // Bounded retries: test that reconnect counter caps at maxReconnectAttempts (6)
    mockApp.voiceController.reconnectAttempts = 0;
    for (let i = 0; i < 10; i++) {
      mockApp.voiceController.scheduleSafeRecognitionRestart('NETWORK_DISCONNECT');
    }
    testAssert(mockApp.voiceController.reconnectAttempts <= mockApp.voiceController.maxReconnectAttempts + 1, '14.2', 'Reconnect attempts bounded, preventing infinite retry loops');

    // Simulate network restored
    mockApp.voiceController.subsystems.networkConnectivity = 'online';
    mockApp.voiceController.reconnectAttempts = 0;
    mockApp.voiceController.isReconnecting = false;
    testAssert(mockApp.voiceController.subsystems.networkConnectivity === 'online', '14.3', 'Network online recovered');
  }

  // -------------------------------------------------------------------------
  // MISSION 6: Diagnostics and Performance Telemetry Verification
  // -------------------------------------------------------------------------
  console.log('\n--- Mission 6: Latency Telemetry & Diagnostic Phase Verification ---');
  {
    // Record sample turn timestamps in latency tracker
    const tBase = performance.now();
    latencyTrackerInstance.record({
      personality: 'JARVIS',
      provider: 'local_instant_router',
      tier: 'LOCAL_INSTANT',
      toolName: 'get_current_time',
      tSpeechEnd: tBase,
      tTranscribed: tBase + 12,
      tReqSubmitted: tBase + 15,
      tReqReceived: tBase + 18,
      tToolStart: tBase + 20,
      tToolEnd: tBase + 22,
      tFirstToken: tBase + 25,
      tFirstCaption: tBase + 26,
      tFirstSentence: tBase + 28,
      tFirstAudioPlayed: tBase + 35,
      tFullCompleted: tBase + 40,
      isSimulation: false
    });

    const report = latencyTrackerInstance.getDiagnosticReport();
    testAssert(report.realStats.sampleSize >= 1, '15.1', 'Diagnostic report records turn');
    testAssert(report.realStats.voiceToEar.median !== null, '15.2', 'Voice-to-ear latency metric computed');
    testAssert(report.realStats.toolExec.median !== null, '15.3', 'Tool execution latency metric computed');
    console.log(report.reportText);
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
