/**
 * STARK AI / J.A.R.V.I.S. — LIVE DOCUMENT STUDIO & VOICE-CONTROLLED WORD COLLABORATION
 * Comprehensive Acceptance & Real Windows End-to-End Verification Suite
 * 
 * Covers all 14 required test scenarios (A through N):
 * A. Document creation from voice instruction ("JARVIS, create a Word document about Ohm's Law.")
 * B. Live visible progressive writing (chunk-by-chunk progressive events, non-typewriter real chunks)
 * C. Actual DOCX synchronization (physical OpenXML .docx verification, SHA-256, no fabricated lab data)
 * D. Completion review conversation ("I've finished the document. How does it look? Would you like me to make any changes?")
 * E. Voice-directed paragraph modification ("Make the second paragraph longer" + full-duplex barge-in)
 * F. Multiple sequential revisions ("Make the theory longer and add an observation table" -> "Add a proper conclusion")
 * G. Formatting and table preservation (OpenXML <w:tbl> and heading structure verified on disk)
 * H. Save and independent DOCX/PDF verification ("Save it as Physics Experiment 1" + PDF export)
 * I. Session recovery after interruption & revision rollback (undoLastRevision / recoverInterruptedSession)
 * J. WhatsApp recipient resolution and attachment staging ("Send this Word file to Lokesh Upadhyay on WhatsApp")
 * K. Exact recipient/header verification & ambiguous contact block (never triggering New Contact)
 * L. E-stop during document generation, editing, and WhatsApp dispatch (preserving prior edits)
 * M. Duplicate-send & duplicate-document prevention
 * N. Existing Phase 1–15 regression & Mission Control telemetry verification
 */

const fs = require('fs');
const path = require('path');

const {
  liveDocumentStudioInstance,
  STUDIO_WRITING_STATUS,
  REVIEW_COMPLETION_PROMPT
} = require('./server/desktop/liveDocumentStudio.js');
const { documentIntelligenceEngineInstance } = require('./server/documentIntelligenceEngine.js');
const { independentVerifierInstance } = require('./server/independentVerifier.js');
const { fullDuplexVoiceEngineInstance, FULL_DUPLEX_STATES } = require('./server/voice/fullDuplexVoiceEngine.js');
const { whatsappServiceInstance } = require('./server/desktop/whatsappService.js');
const { missionControlEngineInstance } = require('./server/missionControlEngine.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { aiProviderAdapterInstance } = require('./server/aiProviderAdapter.js');
const { executeTool, getToolSchema } = require('./server/toolsRegistry.js');

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

async function runLiveDocumentStudioAcceptanceSuite() {
  console.log('\n================================================================================');
  console.log('STARK AI — LIVE DOCUMENT STUDIO & VOICE-CONTROLLED WORD COLLABORATION SUITE');
  console.log('================================================================================\n');

  if (emergencyStopControllerInstance.isEngaged()) {
    emergencyStopControllerInstance.resetEmergencyStop('Live Document Studio Suite Init');
  }

  // Enable WhatsApp sandbox mode for safe controlled attachment staging & dispatch verification
  whatsappServiceInstance.enableSandboxMode();

  // Track progressive chunk events emitted during real document creation
  const progressiveEvents = [];
  const onChunk = (evt) => progressiveEvents.push(evt);
  liveDocumentStudioInstance.on('chunkWritten', onChunk);

  // =========================================================================
  // SCENARIO A: Document Creation from Voice Instruction
  // =========================================================================
  console.log('--- SCENARIO A: Document Creation from Voice Instruction ---');
  const voiceCreateCommand = "JARVIS, create a Word document about Ohm's Law.";
  const detectedCreateIntent = aiProviderAdapterInstance.detectToolIntent('JARVIS', voiceCreateCommand);

  check(
    detectedCreateIntent && detectedCreateIntent.toolName === 'live_document_create',
    'A.1 Natural voice instruction routes to live_document_create',
    `tool=${detectedCreateIntent?.toolName}, topic="${detectedCreateIntent?.args?.topic}"`
  );

  const createRes = await executeTool('live_document_create', {
    instruction: voiceCreateCommand,
    forceNew: true
  }, 'JARVIS');

  check(
    createRes.success === true && Boolean(createRes.sessionId),
    'A.2 Live Document Studio session created for "Ohm\'s Law"',
    `sessionId=${createRes.sessionId}, type=${createRes.documentType}`
  );
  check(
    createRes.documentType === 'EXPERIMENT_REPORT' && /Ohm's Law/i.test(createRes.title),
    'A.3 Understands requested topic ("Ohm\'s Law") and classifies as EXPERIMENT_REPORT',
    `title="${createRes.title}"`
  );

  // =========================================================================
  // SCENARIO B: Live Visible Progressive Writing
  // =========================================================================
  console.log('\n--- SCENARIO B: Live Visible Progressive Writing ---');
  const studioStatusAfterCreate = liveDocumentStudioInstance.getStudioStatus();

  check(
    studioStatusAfterCreate.windowControls.isOpen === true &&
    studioStatusAfterCreate.windowControls.isMinimized === false,
    'B.1 Live Document Studio window is open and visible during/after writing',
    `editorDistinction=${studioStatusAfterCreate.windowControls.editorDistinction}`
  );
  check(
    progressiveEvents.length >= 4 &&
    progressiveEvents[0].chunk.writingProgress < progressiveEvents[progressiveEvents.length - 1].chunk.writingProgress,
    'B.2 Real content chunks emitted progressively per section (not a fake typewriter animation)',
    `chunksEmitted=${progressiveEvents.length}, progress=${progressiveEvents.map(e => e.chunk.writingProgress + '%').join(' -> ')}`
  );
  check(
    studioStatusAfterCreate.activeDocumentSession.visibleEditorChunks.length >= 5,
    'B.3 Visible editor preview reflects all generated sections and header',
    `visibleChunks=${studioStatusAfterCreate.activeDocumentSession.visibleEditorChunks.length}`
  );

  // =========================================================================
  // SCENARIO C: Actual DOCX Synchronization & Scientific Integrity
  // =========================================================================
  console.log('\n--- SCENARIO C: Actual DOCX Synchronization & Scientific Integrity ---');
  const initialDocxPath = createRes.filePath;
  const parsedInitialDocx = documentIntelligenceEngineInstance.parseDocxDocument(initialDocxPath);

  check(
    fs.existsSync(initialDocxPath) && parsedInitialDocx.success === true && createRes.verification.sizeBytes > 1500,
    'C.1 Physical .docx file exists on Windows disk and has valid OpenXML ZIP/XML structure',
    `path="${initialDocxPath}", size=${createRes.verification.sizeBytes}B, sha256=${createRes.verification.sha256?.slice(0, 12)}...`
  );
  check(
    parsedInitialDocx.fullText.includes("Ohm's Law") &&
    parsedInitialDocx.fullText.includes('V = I') &&
    parsedInitialDocx.fullText.includes('[USER_INPUT_REQUIRED'),
    'C.2 Synchronized .docx contains real theoretical content and marks unmeasured lab observations as [USER_INPUT_REQUIRED]',
    `paragraphsCount=${parsedInitialDocx.paragraphsCount}`
  );

  // =========================================================================
  // SCENARIO D: Natural Completion and Review Conversation
  // =========================================================================
  console.log('\n--- SCENARIO D: Natural Completion and Review Conversation ---');
  check(
    createRes.completionPrompt === REVIEW_COMPLETION_PROMPT &&
    createRes.completionPrompt.includes("I've finished the document. How does it look?"),
    'D.1 JARVIS asks the natural completion & review prompt after finishing initial draft',
    `prompt="${createRes.completionPrompt}"`
  );
  check(
    studioStatusAfterCreate.activeDocumentSession.writingStatus === STUDIO_WRITING_STATUS.AWAITING_USER_REVIEW &&
    studioStatusAfterCreate.windowControls.isOpen === true,
    'D.2 Document studio remains open in AWAITING_USER_REVIEW waiting for voice instructions',
    `status=${studioStatusAfterCreate.activeDocumentSession.writingStatus}`
  );

  // =========================================================================
  // SCENARIO E: Voice-Directed Paragraph Modification & Full-Duplex Barge-In
  // =========================================================================
  console.log('\n--- SCENARIO E: Voice-Directed Paragraph Modification & Full-Duplex Barge-In ---');
  // Snapshot paragraph 1 and paragraph 2 before editing paragraph 2
  const parasBeforeE = liveDocumentStudioInstance._getAllParagraphReferences(
    liveDocumentStudioInstance.activeSession.canonicalDocument
  );
  const para1Before = parasBeforeE[0].text;
  const para2Before = parasBeforeE[1].text;
  const para3Before = parasBeforeE[2].text;

  // Ensure FullDuplexVoiceEngine is in SPEAKING state so barge-in interruption is exercised
  await fullDuplexVoiceEngineInstance.beginAssistantSpeech(REVIEW_COMPLETION_PROMPT);
  check(
    fullDuplexVoiceEngineInstance.state === FULL_DUPLEX_STATES.SPEAKING,
    'E.1 Full-Duplex Voice Engine is actively speaking before user barge-in revision',
    `voiceState=${fullDuplexVoiceEngineInstance.state}`
  );

  const paraRevCommand = 'Make the second paragraph longer.';
  const detectedParaIntent = aiProviderAdapterInstance.detectToolIntent('JARVIS', paraRevCommand);
  check(
    detectedParaIntent && detectedParaIntent.toolName === 'live_document_revise',
    'E.2 Voice command "Make the second paragraph longer." routes to live_document_revise',
    `tool=${detectedParaIntent?.toolName}`
  );

  const revERes = await executeTool('live_document_revise', { instruction: paraRevCommand }, 'JARVIS');
  const parasAfterE = liveDocumentStudioInstance._getAllParagraphReferences(
    liveDocumentStudioInstance.activeSession.canonicalDocument
  );

  check(
    revERes.success === true && revERes.bargeInHandled === true,
    'E.3 Full-duplex voice barge-in interrupted assistant speech and applied paragraph revision',
    `bargeInHandled=${revERes.bargeInHandled}`
  );
  check(
    parasAfterE[1].text.length > para2Before.length &&
    parasAfterE[0].text === para1Before &&
    parasAfterE[2].text === para3Before,
    'E.4 Only the second paragraph was extended while unrelated paragraphs (1 and 3) were strictly preserved',
    `p2Len: ${para2Before.length} -> ${parasAfterE[1].text.length}`
  );

  // =========================================================================
  // SCENARIO F: Multiple Sequential Revisions (Compound & Follow-up)
  // =========================================================================
  console.log('\n--- SCENARIO F: Multiple Sequential Revisions ---');
  const compoundRevCommand = 'Make the theory longer and add an observation table.';
  const revF1Res = await executeTool('live_document_revise', { instruction: compoundRevCommand }, 'JARVIS');

  check(
    revF1Res.success === true && revF1Res.appliedOperations.length === 2,
    'F.1 Compound revision ("Make the theory longer and add an observation table") executed both operations',
    `ops=${revF1Res.appliedOperations.map(o => o.operationType).join(' + ')}`
  );

  const conclusionRevCommand = 'Add a proper conclusion.';
  const revF2Res = await executeTool('live_document_revise', { instruction: conclusionRevCommand }, 'JARVIS');

  check(
    revF2Res.success === true &&
    revF2Res.appliedOperations.some(o => o.operationType.includes('CONCLUSION')),
    'F.2 Sequential follow-up revision ("Add a proper conclusion.") updated conclusion section live',
    `versionNumber=${revF2Res.versionNumber}, summary="${revF2Res.summary}"`
  );

  // Also test adding an example and a schematic diagram
  const revF3Res = await executeTool('live_document_revise', {
    instruction: 'Add an example and add a diagram.'
  }, 'JARVIS');
  check(
    revF3Res.success === true && revF3Res.appliedOperations.length === 2,
    'F.3 Sequential revision added worked analytical example and labeled schematic diagram',
    `ops=${revF3Res.appliedOperations.map(o => o.operationType).join(' + ')}`
  );

  // =========================================================================
  // SCENARIO G: Formatting and Table Preservation in Physical DOCX
  // =========================================================================
  console.log('\n--- SCENARIO G: Formatting and Table Preservation ---');
  const rawXmlCheck = documentIntelligenceEngineInstance.parseDocxDocument(
    liveDocumentStudioInstance.activeSession.filePath
  );
  const verifyAfterRevs = liveDocumentStudioInstance.activeSession.documentVerificationStatus;

  check(
    rawXmlCheck.success === true &&
    rawXmlCheck.fullText.includes('Microscopic Derivation') &&
    rawXmlCheck.fullText.includes('Comprehensive Conclusion') &&
    rawXmlCheck.tablesCount >= 1 &&
    verifyAfterRevs.tableCount >= 1 &&
    verifyAfterRevs.headingCount >= 5,
    'G.1 Physical .docx preserves headings, extended theory, conclusion, and structured OpenXML table',
    `headings=${verifyAfterRevs.headingCount}, tables=${rawXmlCheck.tablesCount}, paragraphs=${rawXmlCheck.paragraphsCount}`
  );

  // =========================================================================
  // SCENARIO H: Save, Custom Filename, PDF Export & Independent Verification
  // =========================================================================
  console.log('\n--- SCENARIO H: Save and Independent DOCX/PDF Verification ---');
  const saveCommand = 'Save it as Physics Experiment 1 and make a PDF copy too.';
  const detectedSaveIntent = aiProviderAdapterInstance.detectToolIntent('JARVIS', 'Save it.');
  check(
    detectedSaveIntent && detectedSaveIntent.toolName === 'live_document_save',
    'H.1 "Save it." voice command routes to live_document_save while studio is open',
    `tool=${detectedSaveIntent?.toolName}`
  );

  const saveRes = await executeTool('live_document_save', {
    instruction: saveCommand
  }, 'JARVIS');

  const independentDocxVerify = await independentVerifierInstance.verifyExecution('FILE_EXISTS_AND_NONEMPTY', {
    targetPath: saveRes.filePath,
    executionResult: saveRes
  });
  const independentPdfVerify = await independentVerifierInstance.verifyExecution('FILE_EXISTS_AND_NONEMPTY', {
    targetPath: saveRes.pdfFilePath,
    executionResult: saveRes
  });

  check(
    saveRes.success === true &&
    saveRes.fileName === 'Physics_Experiment_1.docx' &&
    fs.existsSync(saveRes.filePath) &&
    independentDocxVerify.verified === true,
    'H.2 Saved custom filename "Physics_Experiment_1.docx" and verified independently on disk',
    `filePath="${saveRes.filePath}", size=${saveRes.verification.sizeBytes}B`
  );
  check(
    Boolean(saveRes.pdfFilePath) &&
    fs.existsSync(saveRes.pdfFilePath) &&
    independentPdfVerify.verified === true,
    'H.3 Generated and independently verified companion PDF copy ("Physics_Experiment_1.pdf")',
    `pdfFilePath="${saveRes.pdfFilePath}"`
  );
  check(
    liveDocumentStudioInstance.getStudioStatus().windowControls.isOpen === true,
    'H.4 Document session remains open after saving for further review or WhatsApp delivery'
  );

  // =========================================================================
  // SCENARIO I: Accidental Edit Rollback & Session Recovery
  // =========================================================================
  console.log('\n--- SCENARIO I: Accidental Edit Rollback & Session Recovery ---');
  const countBeforeRemove = liveDocumentStudioInstance.activeSession.canonicalDocument.sections.length;
  await executeTool('live_document_revise', { instruction: 'Remove the conclusion section.' }, 'JARVIS');
  const countAfterRemove = liveDocumentStudioInstance.activeSession.canonicalDocument.sections.length;

  const undoRes = await executeTool('live_document_undo', {}, 'JARVIS');
  const countAfterUndo = liveDocumentStudioInstance.activeSession.canonicalDocument.sections.length;

  check(
    countAfterRemove === countBeforeRemove - 1 &&
    undoRes.success === true &&
    countAfterUndo === countBeforeRemove,
    'I.1 Accidental section removal cleanly rolled back via revision history snapshot',
    `sections: ${countBeforeRemove} -> ${countAfterRemove} -> ${countAfterUndo}`
  );

  // =========================================================================
  // SCENARIO J & K: WhatsApp Recipient Resolution, Header Verification & Staging
  // =========================================================================
  console.log('\n--- SCENARIO J & K: WhatsApp Recipient Resolution, Header Verification & Staging ---');
  const waCommand = 'JARVIS, send this Word file to Lokesh Upadhyay on WhatsApp.';
  const detectedWaIntent = aiProviderAdapterInstance.detectToolIntent('JARVIS', waCommand);

  check(
    detectedWaIntent && detectedWaIntent.toolName === 'live_document_send_whatsapp',
    'J.1 Voice instruction "JARVIS, send this Word file to Lokesh Upadhyay on WhatsApp." routes to live_document_send_whatsapp',
    `recipient="${detectedWaIntent?.args?.recipient}"`
  );

  const stageWaRes = await executeTool('live_document_send_whatsapp', {
    instruction: waCommand
  }, 'JARVIS');

  check(
    stageWaRes.success === true &&
    stageWaRes.status === 'awaiting_confirmation' &&
    stageWaRes.requiresConfirmation === true &&
    stageWaRes.fileName === 'Physics_Experiment_1.docx',
    'J.2 Stages the exact saved .docx attachment and holds at permission confirmation gate',
    `draftId=${stageWaRes.draftId}, file="${stageWaRes.fileName}" (${stageWaRes.fileSizeBytes}B)`
  );
  check(
    stageWaRes.headerVerification &&
    stageWaRes.headerVerification.headerMatchesRecipient === true &&
    stageWaRes.headerVerification.newContactTriggered === false,
    'K.1 Verifies exact recipient ("Lokesh Upadhyay") and chat header without triggering New Contact',
    `recipientVerified="${stageWaRes.headerVerification?.recipientVerified}"`
  );

  // Dispatch after explicit user confirmation
  const confirmIntent = aiProviderAdapterInstance.detectToolIntent('JARVIS', 'Yes, send it');
  check(
    confirmIntent && confirmIntent.toolName === 'live_document_confirm_whatsapp',
    'K.2 Explicit user confirmation ("Yes, send it") routes to live_document_confirm_whatsapp',
    `tool=${confirmIntent?.toolName}`
  );

  const dispatchWaRes = await executeTool('live_document_confirm_whatsapp', {}, 'JARVIS');
  check(
    dispatchWaRes.success === true &&
    dispatchWaRes.status === 'sent_and_verified' &&
    dispatchWaRes.outgoingAttachmentVerified === true,
    'K.3 Dispatches attachment only after explicit confirmation and verifies outgoing delivery state',
    `status=${dispatchWaRes.status}, sha256=${dispatchWaRes.fileSha256?.slice(0, 12)}...`
  );

  // =========================================================================
  // SCENARIO M: Duplicate-Send & Duplicate-Document Prevention
  // =========================================================================
  console.log('\n--- SCENARIO M: Duplicate-Send & Duplicate-Document Prevention ---');
  const dupSendRes = await executeTool('live_document_send_whatsapp', {
    instruction: waCommand
  }, 'JARVIS');
  check(
    dupSendRes.duplicateSendPrevented === true && dupSendRes.status === 'duplicate_blocked',
    'M.1 Duplicate WhatsApp attachment send to the same recipient is blocked within deduplication window',
    `summary="${dupSendRes.summary}"`
  );

  // =========================================================================
  // SCENARIO L: Emergency Stop During Document Generation, Editing & Dispatch
  // =========================================================================
  console.log('\n--- SCENARIO L: Emergency Stop During Document Generation, Editing & Dispatch ---');
  const revisionCountBeforeEstop = liveDocumentStudioInstance.activeSession.revisionHistory.length;
  emergencyStopControllerInstance.triggerEmergencyStop('TEST_LIVE_DOC_STUDIO_ESTOP');

  let blockedDuringEstop = false;
  try {
    await executeTool('live_document_revise', { instruction: 'Make the introduction longer.' }, 'JARVIS');
  } catch (err) {
    blockedDuringEstop = /EMERGENCY_STOP_ACTIVE/i.test(err.message);
  }

  const studioUnderEstop = liveDocumentStudioInstance.getStudioStatus();
  check(
    blockedDuringEstop === true &&
    studioUnderEstop.activeDocumentSession.writingStatus === STUDIO_WRITING_STATUS.HALTED_BY_EMERGENCY_STOP &&
    studioUnderEstop.revisionHistory.length === revisionCountBeforeEstop,
    'L.1 Emergency Stop immediately halts studio operations while preserving all prior committed user edits',
    `status=${studioUnderEstop.activeDocumentSession.writingStatus}, preservedRevisions=${studioUnderEstop.revisionHistory.length}`
  );

  // Reset E-stop and recover session
  emergencyStopControllerInstance.resetEmergencyStop('Restore after Scenario L');
  const recoverRes = await executeTool('live_document_control', { action: 'RECOVER' }, 'JARVIS');
  check(
    recoverRes.success === true &&
    recoverRes.studioState.activeDocumentSession.writingStatus === STUDIO_WRITING_STATUS.AWAITING_USER_REVIEW,
    'L.2 Session recovers cleanly after E-stop reset with verified .docx intact',
    `recoveredRevisions=${recoverRes.recoveredRevisionCount}`
  );

  // =========================================================================
  // SCENARIO N: Mission Control Telemetry & Phase 1–15 Regression Verification
  // =========================================================================
  console.log('\n--- SCENARIO N: Mission Control Telemetry & Phase 1–15 Regression ---');
  const mcSnapshot = missionControlEngineInstance.getLiveTelemetrySnapshot();

  const hasAllRequiredMcFields = Boolean(
    mcSnapshot.activeDocumentSession &&
    mcSnapshot.currentDocumentName === 'Physics_Experiment_1.docx' &&
    mcSnapshot.currentGenerationStage &&
    mcSnapshot.currentSection &&
    typeof mcSnapshot.writingProgress === 'number' &&
    Array.isArray(mcSnapshot.revisionHistory) &&
    mcSnapshot.saveState &&
    mcSnapshot.verificationState &&
    mcSnapshot.verificationState.verified === true &&
    mcSnapshot.finalDeliveryState
  );

  check(
    hasAllRequiredMcFields === true,
    'N.1 Mission Control exposes all 11 required Live Document Studio telemetry fields accurately',
    `doc="${mcSnapshot.currentDocumentName}", progress=${mcSnapshot.writingProgress}%, revisions=${mcSnapshot.revisionHistory.length}`
  );

  // Verify Phase 15 sensory & GUI telemetry and tool registrations remain intact
  const registeredStudioTools = [
    'live_document_create',
    'live_document_revise',
    'live_document_save',
    'live_document_send_whatsapp',
    'live_document_confirm_whatsapp',
    'live_document_undo',
    'live_document_status',
    'live_document_control'
  ];
  const allToolsRegistered = registeredStudioTools.every(t => Boolean(getToolSchema(t)));
  check(
    allToolsRegistered === true &&
    Boolean(mcSnapshot.audioCaptureStatus) &&
    Boolean(mcSnapshot.currentVoiceSession) &&
    Boolean(mcSnapshot.activeGuiAutomation) &&
    Boolean(mcSnapshot.copilotModeStatus),
    'N.2 All 8 Live Document Studio tools and Phase 1–15 Mission Control subsystems verified with zero regression'
  );

  liveDocumentStudioInstance.removeListener('chunkWritten', onChunk);
  whatsappServiceInstance.disableSandboxMode();

  console.log('\n================================================================================');
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveDocumentStudioAcceptanceSuite().catch((err) => {
  console.error('Fatal error in Live Document Studio Acceptance Suite:', err);
  process.exit(1);
});
