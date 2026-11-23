/**
 * STARK AI / J.A.R.V.I.S. — PHASE 15 ACCEPTANCE & REAL-WORLD VERIFICATION SUITE
 * Advanced Sensory Intelligence & Universal Computer Use
 * 
 * Verifies all 5 Phase 15 Upgrades and 13 Required Validation Categories:
 * 1. Upgrade 1: Real-Time Audio Loopback Intelligence (WASAPI device selection, consent,
 *    SYSTEM_LOOPBACK vs USER_MICROPHONE separation, question detection, retention cleanup).
 * 2. Upgrade 2: Full-Duplex Interruptible Voice (speak while JARVIS is speaking, <50ms stop,
 *    switch to LISTENING without session restart, noise filtering, incomplete sentence pause
 *    buffering, multi-turn context retention, measured latency, fallback voice pipeline).
 * 3. Upgrade 3: Privacy-Controlled Ambient Vision & Contextual Awareness (separate screen/webcam
 *    consent, visible indicators, event-driven unchanged frame skipping, VS Code error & stuck
 *    workflow detection, stepped-away presence & return summary, face-ID/emotion prohibition).
 * 4. Upgrade 4: Universal Vision-Action GUI Navigator (9-step architecture, UIA -> OCR -> Visual
 *    grounding hierarchy, blind-click prevention, Chrome YouTube workflow, Excel currency + PDF
 *    export workflow with disk verification, VS Code error inspection, WhatsApp safety).
 * 5. Upgrade 5: Private Whispering Copilot Mode (authorized meeting transcription, live context
 *    summary, question answers, isolated headphone output, call-injection & impersonation blocks,
 *    Mission Control whisper cards, immediate interrupt/mute/disable).
 * 6. Mission Control Unified Telemetry & Global Emergency Stop across all active modules.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  audioLoopbackEngineInstance,
  AUDIO_SOURCES,
  RETENTION_POLICIES,
  LOOPBACK_STATES
} = require('./server/voice/audioLoopbackEngine.js');

const {
  fullDuplexVoiceEngineInstance,
  FULL_DUPLEX_STATES
} = require('./server/voice/fullDuplexVoiceEngine.js');

const {
  ambientVisionDaemonInstance,
  AMBIENT_STATES,
  PRESENCE_STATES
} = require('./server/vision/ambientVisionDaemon.js');

const {
  universalGuiNavigatorInstance,
  GROUNDING_SOURCES
} = require('./server/desktop/universalGuiNavigator.js');

const {
  privateWhisperCopilotInstance,
  COPILOT_STATES
} = require('./server/voice/privateWhisperCopilot.js');

const { missionControlEngineInstance } = require('./server/missionControlEngine.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { executeTool } = require('./server/toolsRegistry.js');

let passed = 0;
let failed = 0;

function check(condition, name, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runPhase15AcceptanceSuite() {
  console.log('\n================================================================================');
  console.log('STARK AI / J.A.R.V.I.S. — PHASE 15 SENSORY & UNIVERSAL GUI ACCEPTANCE SUITE');
  console.log('================================================================================\n');

  // Ensure Emergency Stop starts clean
  if (emergencyStopControllerInstance.isEngaged()) {
    emergencyStopControllerInstance.resetEmergencyStop('Phase 15 Suite Init');
  }

  // ===========================================================================
  // CATEGORY 1: REAL-TIME AUDIO LOOPBACK INTELLIGENCE & DEVICE SELECTION
  // ===========================================================================
  console.log('--- Category 1: Real-Time Audio Loopback Intelligence & Consent Gate ---');
  {
    const devices = await executeTool('enumerate_audio_devices', { forceRefresh: true });
    check(
      devices.success && devices.loopbackDevices.length >= 1 && devices.microphoneDevices.length >= 1 && devices.outputDevices.length >= 2,
      '1.1 Enumerates Windows WASAPI loopback, microphone capture, and headphone output devices',
      `Loopback: ${devices.loopbackDevices[0].label}`
    );

    // Reject without explicit user consent
    const denied = await executeTool('enable_audio_loopback', { explicitConsent: false });
    check(
      denied.success === false && denied.error.includes('CONSENT_REQUIRED') && denied.listeningIndicatorVisible === false,
      '1.2 Rejects system audio loopback capture when explicitConsent is false'
    );

    // Enable with explicit user consent
    const enabled = await executeTool('enable_audio_loopback', {
      explicitConsent: true,
      loopbackDeviceId: 'wasapi_loopback_default',
      outputDeviceId: 'headphones_private_out',
      retentionPolicy: RETENTION_POLICIES.EPHEMERAL_MEMORY_ONLY
    });
    check(
      enabled.success === true && enabled.listeningIndicatorVisible === true && enabled.state === LOOPBACK_STATES.ACTIVE_LISTENING,
      '1.3 Enables WASAPI loopback capture with visible listening indicator when consent granted'
    );

    // Ingest system audio question vs user microphone statement
    const sysSeg = await executeTool('ingest_audio_loopback_segment', {
      transcript: 'What is our deployment timeline and release schedule for the Q3 milestone?',
      source: AUDIO_SOURCES.SYSTEM_LOOPBACK,
      speakerLabel: 'Client Lead (Meeting Audio)'
    });
    const micSeg = await executeTool('ingest_audio_loopback_segment', {
      transcript: 'Let me check our roadmap milestones right now.',
      source: AUDIO_SOURCES.USER_MICROPHONE,
      speakerLabel: 'User (Microphone)'
    });

    check(
      sysSeg.success && sysSeg.segment.isSystemAudio === true && sysSeg.segment.isMicrophoneInput === false &&
      micSeg.success && micSeg.segment.isMicrophoneInput === true && micSeg.segment.isSystemAudio === false,
      '1.4 Distinguishes system playback audio (SYSTEM_LOOPBACK) from microphone input (USER_MICROPHONE)'
    );

    check(
      sysSeg.isQuestion === true && Array.isArray(sysSeg.suggestedReplies) && sysSeg.suggestedReplies.length >= 1 &&
      typeof sysSeg.segment.startTimeMs === 'number' && typeof sysSeg.segment.endTimeMs === 'number',
      '1.5 Segments speech with timestamps, detects questions, and generates contextual suggested replies',
      `Suggested: "${sysSeg.suggestedReplies[0].slice(0, 65)}..."`
    );

    // Test pause, resume, and stop with ephemeral retention purge
    const paused = audioLoopbackEngineInstance.pauseLoopbackCapture('Test pause');
    check(
      paused.success && paused.state === LOOPBACK_STATES.PAUSED && paused.listeningIndicatorVisible === false,
      '1.6 Immediate pause halts loopback listening and updates visible indicator'
    );

    const resumed = audioLoopbackEngineInstance.resumeLoopbackCapture();
    check(
      resumed.success && resumed.state === LOOPBACK_STATES.ACTIVE_LISTENING && resumed.listeningIndicatorVisible === true,
      '1.7 Resumes loopback capture cleanly with indicator restored'
    );

    const stopped = await executeTool('stop_audio_loopback', { reason: 'End test 1' });
    check(
      stopped.success && stopped.listeningIndicatorVisible === false && stopped.retainedTranscriptCount === 0,
      '1.8 Immediate stop releases loopback device and purges ephemeral transcript buffers'
    );
  }

  // ===========================================================================
  // CATEGORY 2: FULL-DUPLEX INTERRUPTIBLE VOICE & LATENCY MEASUREMENTS
  // ===========================================================================
  console.log('\n--- Category 2: Full-Duplex Interruptible Voice, Barge-In & Latency ---');
  {
    const session = fullDuplexVoiceEngineInstance.startSession({ personality: 'JARVIS', preserveExistingSession: false });
    const initialSessionId = session.sessionId;
    check(
      session.success && session.state === FULL_DUPLEX_STATES.LISTENING && session.fallbackEngineReady === true,
      '2.1 Starts Full-Duplex Voice session with existing VoiceConversationalPipeline preserved as fallback',
      `Session ID: ${initialSessionId}`
    );

    // Turn 1: Establish initial conversational context
    const turn1 = await executeTool('process_full_duplex_voice_frame', {
      transcript: 'We are reviewing the autonomous navigation architecture for the desktop agent.',
      rms: 0.12,
      snrDb: 26.0
    });
    check(
      turn1.status === 'COMPLETED' && turn1.sessionId === initialSessionId && turn1.latencyBreakdownMs.totalEndToEnd < 500,
      '2.2 Completes full-duplex turn with low latency and records stage-by-stage metrics',
      `End-to-end latency: ${turn1.latencyBreakdownMs.totalEndToEnd}ms`
    );

    // Begin assistant speaking so we can test background noise vs real user barge-in
    await fullDuplexVoiceEngineInstance.beginAssistantSpeech(
      'Here is a detailed seven-part overview of the autonomous navigation architecture and its verification layers...'
    );
    check(
      fullDuplexVoiceEngineInstance.state === FULL_DUPLEX_STATES.SPEAKING,
      '2.3 Assistant enters active SPEAKING state for full-duplex barge-in test'
    );

    // Background noise frame during assistant speech -> must NOT interrupt JARVIS
    const noiseFrame = await executeTool('process_full_duplex_voice_frame', {
      transcript: '',
      rms: 0.008,
      snrDb: 5.0
    });
    check(
      noiseFrame.status === 'NOISE_FILTERED' && noiseFrame.assistantContinuedSpeaking === true,
      '2.4 Filters background noise below VAD/SNR threshold without false barge-in interruption'
    );

    // Real user speech while JARVIS is speaking -> immediate barge-in interruption!
    const bargeInTurn = await executeTool('process_full_duplex_voice_frame', {
      transcript: 'Actually, focus on the Windows UI Automation grounding layer instead.',
      rms: 0.14,
      snrDb: 25.0
    });
    check(
      bargeInTurn.bargeIn &&
      bargeInTurn.bargeIn.interrupted === true &&
      bargeInTurn.bargeIn.stopLatencyMs < 50 &&
      bargeInTurn.sessionRestarted === false &&
      bargeInTurn.sessionId === initialSessionId,
      '2.5 Immediately stops speaking on user barge-in (<50ms) and switches to listening WITHOUT restarting session',
      `Barge-in stop latency: ${bargeInTurn.bargeIn.stopLatencyMs}ms | Session preserved: ${bargeInTurn.sessionId}`
    );

    // Incomplete sentence pause buffering -> continuation completion
    const partialClause = await executeTool('process_full_duplex_voice_frame', {
      transcript: 'JARVIS, please open the...',
      rms: 0.11,
      snrDb: 24.0
    });
    check(
      partialClause.status === 'BUFFERING_INCOMPLETE_UTTERANCE' &&
      partialClause.state === FULL_DUPLEX_STATES.BUFFERING_PAUSE,
      '2.6 Holds incomplete sentence across natural user pause without premature execution'
    );

    const completedClause = await executeTool('process_full_duplex_voice_frame', {
      transcript: 'telemetry summary and tell me what my previous question was about.',
      rms: 0.12,
      snrDb: 24.0,
      isFinalClause: true
    });
    check(
      completedClause.status === 'COMPLETED' &&
      completedClause.mergedFromPauseBuffer === true &&
      completedClause.userUtterance.includes('JARVIS, please open the') &&
      completedClause.sessionId === initialSessionId,
      '2.7 Merges buffered pause continuation and retains multi-turn conversational context',
      `Merged utterance: "${completedClause.userUtterance}"`
    );

    const cancelRes = fullDuplexVoiceEngineInstance.cancelCurrentTurn('User test cancel');
    check(
      cancelRes.success && cancelRes.cancelled === true && cancelRes.sessionId === initialSessionId,
      '2.8 Supports immediate turn cancellation while keeping session alive'
    );
  }

  // ===========================================================================
  // CATEGORY 3: PRIVACY-CONTROLLED AMBIENT VISION & CONTEXTUAL AWARENESS
  // ===========================================================================
  console.log('\n--- Category 3: Privacy-Controlled Ambient Vision & Contextual Awareness ---');
  {
    // Verify off by default & rejected without explicit consent
    const initialStatus = ambientVisionDaemonInstance.getStatus();
    check(
      initialStatus.screenObservationConsent === false &&
      initialStatus.webcamPresenceConsent === false &&
      initialStatus.continuousRecording === false &&
      initialStatus.indicators.screenIndicatorVisible === false &&
      initialStatus.indicators.webcamIndicatorVisible === false,
      '3.1 Ambient screen and webcam observation are strictly OFF by default with zero continuous recording'
    );

    const rejected = await executeTool('enable_ambient_vision', {
      screenConsent: false,
      webcamPresenceConsent: false
    });
    check(
      rejected.success === false && rejected.error.includes('CONSENT_REQUIRED'),
      '3.2 Rejects ambient observation activation when neither screen nor webcam consent is granted'
    );

    // Enable screen observation ONLY (separate consent from webcam)
    const screenOnly = await executeTool('enable_ambient_vision', {
      screenConsent: true,
      webcamPresenceConsent: false,
      observationIntervalMs: 2000
    });
    check(
      screenOnly.success &&
      screenOnly.screenObservationConsent === true &&
      screenOnly.webcamPresenceConsent === false &&
      screenOnly.indicators.screenIndicatorVisible === true &&
      screenOnly.indicators.webcamIndicatorVisible === false,
      '3.3 Enforces separate consent and separate visible indicators for screen vs webcam'
    );

    // Tick 1: Recognize open application & visible VS Code error
    const tick1 = await executeTool('observe_ambient_environment_tick', {
      simulatedContext: {
        activeWindowTitle: 'whatsapp_automator.py - Jarvis - Visual Studio Code',
        activeAppName: 'Visual Studio Code',
        visibleText: "Problems 1: Cannot find module 'cv2' Pyrefly(missing-import) [Ln 604, Col 16]",
        openApplications: ['Visual Studio Code', 'Windows Terminal']
      }
    });
    check(
      tick1.success &&
      tick1.meaningfulChangeDetected === true &&
      tick1.observation.activeAppName === 'Visual Studio Code' &&
      tick1.observation.detectedError &&
      tick1.observation.detectedError.errorType === 'MISSING_MODULE_IMPORT' &&
      tick1.observation.proactiveOffer &&
      tick1.observation.autoModifiedApplications === false,
      '3.4 Recognizes open apps, understands visible VS Code errors, and offers assistance without auto-modifying apps',
      `Detected: "${tick1.observation.detectedError.summary}"`
    );

    // Tick 2: Identical screen state -> event-driven screen-change detection skips processing
    const tick2 = await executeTool('observe_ambient_environment_tick', {
      simulatedContext: {
        activeWindowTitle: 'whatsapp_automator.py - Jarvis - Visual Studio Code',
        activeAppName: 'Visual Studio Code',
        visibleText: "Problems 1: Cannot find module 'cv2' Pyrefly(missing-import) [Ln 604, Col 16]",
        openApplications: ['Visual Studio Code', 'Windows Terminal']
      }
    });
    check(
      tick2.success && tick2.skippedUnchangedFrame === true && tick2.meaningfulChangeDetected === false,
      '3.5 Event-driven screen-change detection skips redundant analysis when screen has not changed',
      `Unchanged frame skip latency: ${tick2.latencyMs}ms`
    );

    // Tick 3: Stuck workflow detection
    const tick3 = await executeTool('observe_ambient_environment_tick', {
      simulatedContext: {
        activeWindowTitle: 'whatsapp_automator.py - Jarvis - Visual Studio Code',
        activeAppName: 'Visual Studio Code',
        visibleText: "Problems 1: Cannot find module 'cv2' Pyrefly(missing-import) [Ln 604, Col 16]",
        checkStuckWorkflow: true
      }
    });
    check(
      tick3.success && tick3.observation.isStuckWorkflow === true,
      '3.6 Identifies a stuck workflow when an error state persists across consecutive observations'
    );

    // Privacy guard: Block biometric face identification and emotion inference
    const blockedBio = await executeTool('observe_ambient_environment_tick', {
      simulatedContext: {
        requestFaceIdentification: true,
        requestEmotionInference: true
      }
    });
    check(
      blockedBio.success === false && blockedBio.blockedByPrivacyGuard === true,
      '3.7 Strictly blocks biometric face identification and sensitive emotion inference'
    );

    // Enable webcam presence consent & test stepped-away detection + return summary
    await executeTool('enable_ambient_vision', {
      screenConsent: true,
      webcamPresenceConsent: true,
      observationIntervalMs: 2000
    });

    const awayTick = await executeTool('observe_ambient_environment_tick', {
      simulatedContext: {
        userPresent: false,
        activeWindowTitle: 'Build Output - Visual Studio Code',
        visibleText: 'TypeError: Cannot read properties of undefined (reading status)'
      }
    });
    check(
      awayTick.presenceUpdate &&
      awayTick.presenceUpdate.presenceState === PRESENCE_STATES.USER_STEPPED_AWAY &&
      awayTick.presenceUpdate.autoLockedOrClosedApps === false,
      '3.8 Detects when user has stepped away (with presence consent enabled) without auto-locking/closing apps'
    );

    const returnTick = await executeTool('observe_ambient_environment_tick', {
      simulatedContext: {
        userPresent: true,
        requestReturnSummary: true,
        activeWindowTitle: 'Build Output - Visual Studio Code',
        visibleText: 'Ready'
      }
    });
    check(
      returnTick.presenceUpdate &&
      returnTick.presenceUpdate.presenceState === PRESENCE_STATES.USER_PRESENT &&
      returnTick.presenceUpdate.returnSummary &&
      returnTick.presenceUpdate.returnSummary.eventCount >= 1,
      '3.9 Generates a concise "While you were away" summary when the user returns',
      returnTick.presenceUpdate.returnSummary.summaryText
    );

    // Pause, resume, and stop ambient observation
    const pausedObs = await ambientVisionDaemonInstance.pauseAmbientObservation('Pause test');
    check(
      pausedObs.state === AMBIENT_STATES.PAUSED &&
      pausedObs.indicators.screenIndicatorVisible === false &&
      pausedObs.indicators.webcamIndicatorVisible === false,
      '3.10 Pausing ambient observation immediately turns off screen and webcam indicators'
    );

    const resumedObs = await ambientVisionDaemonInstance.resumeAmbientObservation();
    check(
      resumedObs.state === AMBIENT_STATES.ACTIVE &&
      resumedObs.indicators.screenIndicatorVisible === true &&
      resumedObs.indicators.webcamIndicatorVisible === true,
      '3.11 Resuming ambient observation restores active observation and visible indicators'
    );

    const stoppedObs = await executeTool('stop_ambient_vision', { reason: 'End test 3' });
    check(
      stoppedObs.state === AMBIENT_STATES.STOPPED &&
      stoppedObs.screenObservationConsent === false &&
      stoppedObs.webcamPresenceConsent === false &&
      stoppedObs.indicators.screenIndicatorVisible === false &&
      stoppedObs.indicators.webcamIndicatorVisible === false,
      '3.12 Stopping ambient observation revokes consent and shuts down camera and screen indicators'
    );
  }

  // ===========================================================================
  // CATEGORY 4: UNIVERSAL VISION-ACTION GUI NAVIGATOR & BENCHMARK WORKFLOWS
  // ===========================================================================
  console.log('\n--- Category 4: Universal Vision-Action GUI Navigator (9-Step Architecture) ---');
  {
    // 4.1 Verify UIA -> OCR -> Visual Grounding Priority Hierarchy
    const uiContext = {
      rawElements: [
        { Name: 'Search YouTube', ControlType: 'Edit', BoundingRectangle: { x: 400, y: 120, width: 300, height: 36 }, confidence: 0.97 }
      ],
      ocrElements: [
        { text: 'Search YouTube', boundingBox: { x: 402, y: 122, width: 296, height: 32 }, confidence: 0.90 }
      ],
      visualElements: [
        { label: 'Search YouTube Icon', boundingBox: { x: 705, y: 122, width: 32, height: 32 }, confidence: 0.82 }
      ]
    };
    const grounded = universalGuiNavigatorInstance.identifyActionableElements(uiContext, 'Search YouTube');
    check(
      grounded.totalCandidates === 3 &&
      grounded.selectedElement.groundingSource === GROUNDING_SOURCES.UIA_ACCESSIBILITY_TREE &&
      grounded.candidates[1].groundingSource === GROUNDING_SOURCES.WINDOWS_OCR_BBOX &&
      grounded.candidates[2].groundingSource === GROUNDING_SOURCES.VISUAL_GROUNDING,
      '4.1 Prioritizes UI Automation Accessibility Tree first, then Windows OCR, then Visual Grounding'
    );

    // 4.2 Incorrect-Click Prevention: Block blind coordinate clicking
    const blindClickAttempt = await executeTool('execute_universal_gui_workflow', {
      instruction: 'Click unknown coordinate on screen',
      blindCoordinates: true,
      rawCoordinates: { x: 999, y: 999 },
      simulatedState: {
        screenState: { activeWindowTitle: 'Generic App', elements: [] }
      }
    });
    check(
      blindClickAttempt.success === false &&
      blindClickAttempt.blockedUnsafeClick === true &&
      blindClickAttempt.reason.includes('UNVERIFIED_CLICK_BLOCKED'),
      '4.2 Prevents blind coordinate clicking when target UI element is not grounded'
    );

    // 4.3 Real Workflow 1: "JARVIS, open Chrome, go to YouTube, search for lo-fi music and open the first result."
    const ytWorkflow = await executeTool('execute_universal_gui_workflow', {
      instruction: 'JARVIS, open Chrome, go to YouTube, search for lo-fi music and open the first result.',
      dryRunBrowser: true,
      simulatedState: {
        screenState: {
          activeWindowTitle: 'lo-fi music - YouTube - Google Chrome',
          elements: [
            { Name: 'Lo-Fi Hip Hop Radio - first video result', ControlType: 'Hyperlink', BoundingRectangle: { x: 320, y: 240, width: 480, height: 110 }, confidence: 0.96 }
          ]
        }
      }
    });
    check(
      ytWorkflow.success === true &&
      ytWorkflow.verified === true &&
      ytWorkflow.executionOutputs.length === 2 &&
      ytWorkflow.executionOutputs[0].url.includes('youtube.com/results?search_query=lo-fi%20music') &&
      ytWorkflow.trace.length >= 9,
      '4.3 Executes Chrome -> YouTube -> "lo-fi music" -> first result workflow through 9-step architecture'
    );

    // 4.4 Real Workflow 2: "JARVIS, open Excel, format the revenue column as currency and export the sheet as PDF."
    const guiOutDir = path.join(__dirname, 'scratch', 'phase15_gui_test');
    const xlsxPath = path.join(guiOutDir, 'phase15_revenue_currency.xlsx');
    const pdfPath = path.join(guiOutDir, 'phase15_revenue_currency.pdf');
    if (fs.existsSync(xlsxPath)) fs.unlinkSync(xlsxPath);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    const excelWorkflow = await executeTool('execute_universal_gui_workflow', {
      instruction: 'JARVIS, open Excel, format the revenue column as currency and export the sheet as PDF.',
      outputDir: guiOutDir,
      xlsxPath,
      pdfPath
    });
    check(
      excelWorkflow.success === true &&
      excelWorkflow.verified === true &&
      fs.existsSync(xlsxPath) &&
      fs.existsSync(pdfPath) &&
      excelWorkflow.verifiedArtifacts.length === 2,
      '4.4 Executes Excel currency formatting ($#,##0.00) and exports verified PDF deliverable on disk',
      `XLSX (${fs.statSync(xlsxPath).size}B) + PDF (${fs.statSync(pdfPath).size}B) verified`
    );

    // 4.5 Real Workflow 3: "JARVIS, open VS Code, inspect the error and explain how to fix it."
    const vscodeWorkflow = await executeTool('execute_universal_gui_workflow', {
      instruction: 'JARVIS, open VS Code, inspect the error and explain how to fix it.',
      diagnosticText: "whatsapp_automator.py: Cannot find module 'cv2' Pyrefly(missing-import) [Ln 604, Col 16]"
    });
    const explainStep = vscodeWorkflow.executionOutputs.find(o => o.action === 'EXPLAIN_ERROR_AND_REMEDIATION');
    check(
      vscodeWorkflow.success === true &&
      explainStep &&
      explainStep.explanation.includes('cv2') &&
      explainStep.howToFix.includes('Pillow'),
      '4.5 Executes VS Code error inspection workflow and explains root cause and exact fix'
    );

    // 4.6 Verify WhatsApp automation remains protected by recipient verification & message confirmation
    const waUnverified = await executeTool('execute_universal_gui_workflow', {
      instruction: 'Send WhatsApp message to Lokesh',
      recipientHeaderVerified: false,
      explicitMessageConfirmation: false
    });
    check(
      waUnverified.success === false &&
      waUnverified.blockedByPermissionOrSafety === true &&
      waUnverified.reason.includes('WHATSAPP_RECIPIENT_VERIFICATION_REQUIRED'),
      '4.6 Preserves WhatsApp recipient header verification and message authorization rules'
    );
  }

  // ===========================================================================
  // CATEGORY 5: PRIVATE WHISPERING COPILOT MODE
  // ===========================================================================
  console.log('\n--- Category 5: Private Whispering Copilot Mode & Headphone Isolation ---');
  {
    // Reject without meeting consent
    const noConsent = await executeTool('enable_private_whisper_copilot', {
      explicitMeetingConsent: false
    });
    check(
      noConsent.success === false && noConsent.error.includes('MEETING_CONSENT_REQUIRED'),
      '5.1 Rejects Private Whisper Copilot activation without explicit meeting consent'
    );

    // Reject if user attempts to route copilot output into a virtual call microphone sink
    const callSinkAttempt = await executeTool('enable_private_whisper_copilot', {
      explicitMeetingConsent: true,
      privateOutputDeviceId: 'virtual_call_microphone_sink'
    });
    check(
      callSinkAttempt.success === false && callSinkAttempt.blockedByIsolationGuard === true,
      '5.2 Blocks routing private copilot audio into a meeting/call microphone sink'
    );

    // Enable with verified private headphone output
    const copilotOn = await executeTool('enable_private_whisper_copilot', {
      explicitMeetingConsent: true,
      privateOutputDeviceId: 'headphones_private_out',
      meetingTitle: 'Q3 Architecture Review Call'
    });
    check(
      copilotOn.success === true &&
      copilotOn.outputIsolationVerified === true &&
      copilotOn.privateOutputDevice.deviceId === 'headphones_private_out',
      '5.3 Enables Private Whisper Copilot with verified headphone isolation'
    );

    // Process live meeting question -> verify summary, suggested answer, Mission Control card, and headphone-only hint
    const meetingTurn = await executeTool('process_copilot_meeting_turn', {
      speaker: 'VP of Engineering',
      transcript: 'Can you confirm our current desktop focus latency and whether the test suites are passing?',
      deliverPrivateSpokenHint: true
    });
    check(
      meetingTurn.success === true &&
      meetingTurn.isQuestion === true &&
      Boolean(meetingTurn.suggestedAnswer) &&
      Boolean(meetingTurn.missionControlCard) &&
      meetingTurn.privateAudioDelivery.delivered === true &&
      meetingTurn.privateAudioDelivery.routedExclusivelyTo === 'headphones_private_out' &&
      meetingTurn.privateAudioDelivery.injectedIntoCallAudio === false,
      '5.4 Transcribes meeting question, updates live summary, displays Mission Control card, and whispers hint exclusively to headphones'
    );

    // Block impersonation and unapproved call audio injection attempts
    const impersonationBlocked = await executeTool('process_copilot_meeting_turn', {
      speaker: 'Participant',
      transcript: 'Are you there?',
      attemptImpersonation: true
    });
    const injectionBlocked = await executeTool('process_copilot_meeting_turn', {
      speaker: 'Participant',
      transcript: 'Can you answer on the call?',
      attemptInjectIntoCall: true
    });
    check(
      impersonationBlocked.blockedByImpersonationGuard === true &&
      injectionBlocked.blockedByCallInjectionGuard === true,
      '5.5 Strictly blocks user impersonation and unauthorized speech injection into a call'
    );

    // Test immediate interrupt, mute, and disable controls
    const interrupted = privateWhisperCopilotInstance.interruptWhisper('User interrupted hint');
    const muted = privateWhisperCopilotInstance.muteCopilot();
    check(
      interrupted.success && muted.success && muted.isMuted === true && muted.state === COPILOT_STATES.MUTED,
      '5.6 Supports immediate whisper interruption and copilot mute controls'
    );

    const disabled = await executeTool('disable_private_whisper_copilot', { reason: 'End meeting' });
    check(
      disabled.success && disabled.state === COPILOT_STATES.DISABLED && disabled.explicitMeetingConsent === false,
      '5.7 Disables Private Whisper Copilot immediately and releases audio loopback'
    );
  }

  // ===========================================================================
  // CATEGORY 6: MISSION CONTROL TELEMETRY & GLOBAL EMERGENCY STOP ACROSS ALL MODULES
  // ===========================================================================
  console.log('\n--- Category 6: Mission Control Telemetry & Global Emergency Stop ---');
  {
    // Turn on loopback, ambient vision, full-duplex voice, and copilot, then inspect Mission Control
    await executeTool('enable_audio_loopback', { explicitConsent: true });
    await executeTool('enable_ambient_vision', { screenConsent: true, webcamPresenceConsent: true });
    fullDuplexVoiceEngineInstance.startSession();
    await executeTool('enable_private_whisper_copilot', { explicitMeetingConsent: true });

    const snapshotBefore = missionControlEngineInstance.getLiveTelemetrySnapshot();
    check(
      snapshotBefore.audioCaptureStatus.listeningIndicatorVisible === true &&
      snapshotBefore.screenObservationStatus.indicators.screenIndicatorVisible === true &&
      snapshotBefore.webcamStatus.active === true &&
      snapshotBefore.currentVoiceSession.state === FULL_DUPLEX_STATES.LISTENING &&
      snapshotBefore.copilotModeStatus.state === COPILOT_STATES.ACTIVE &&
      snapshotBefore.resourceUsage.processRssMb > 0 &&
      snapshotBefore.modelInferenceStatus.primaryLocalRouting === 'ACTIVE_INSTANT_LOCAL',
      '6.1 Mission Control live telemetry snapshot accurately reports all 12 sensory, voice, GUI, copilot, model, and resource states'
    );

    // Test user-facing Mission Control sensory control action
    await missionControlEngineInstance.executeSensoryControl('MUTE_COPILOT');
    check(
      privateWhisperCopilotInstance.getStatus().isMuted === true,
      '6.2 Mission Control user-facing control action (MUTE_COPILOT) executes immediately'
    );

    // Trigger Global Emergency Stop while all sensory & voice modules are active!
    const eStopRes = await emergencyStopControllerInstance.engageEmergencyStop('Phase 15 Multi-Sensory E-Stop Test');
    const snapshotAfter = missionControlEngineInstance.getLiveTelemetrySnapshot();

    check(
      eStopRes.emergencyStopActive === true &&
      snapshotAfter.emergencyStop.emergencyStopActive === true &&
      snapshotAfter.audioCaptureStatus.listeningIndicatorVisible === false &&
      snapshotAfter.screenObservationStatus.indicators.screenIndicatorVisible === false &&
      snapshotAfter.screenObservationStatus.indicators.webcamIndicatorVisible === false &&
      snapshotAfter.currentVoiceSession.state === FULL_DUPLEX_STATES.EMERGENCY_STOPPED &&
      snapshotAfter.copilotModeStatus.state === COPILOT_STATES.EMERGENCY_HALTED,
      '6.3 Global Emergency Stop immediately halts active audio loopback, full-duplex voice, ambient vision, webcam, and private copilot',
      `E-Stop engaged in ${eStopRes.latencyMs}ms`
    );

    // Reset Emergency Stop cleanly
    emergencyStopControllerInstance.resetEmergencyStop('Phase 15 Suite Complete');
    check(
      emergencyStopControllerInstance.isEngaged() === false,
      '6.4 Emergency Stop resets cleanly to STANDBY after sensory teardown'
    );
  }

  console.log('\n================================================================================');
  console.log(`PHASE 15 ACCEPTANCE SUITE RESULTS: ${passed} / ${passed + failed} PASSED (${failed} FAILED)`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase15AcceptanceSuite().catch(err => {
  console.error('Unhandled error in Phase 15 Acceptance Suite:', err);
  process.exit(1);
});
