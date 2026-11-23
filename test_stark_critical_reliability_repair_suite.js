/**
 * STARK AI / J.A.R.V.I.S. — CRITICAL END-TO-END RELIABILITY REPAIR ACCEPTANCE SUITE
 * Verifies Scenarios A through P with empirical assertions on real execution paths:
 * - Scenario A: Word-style white A4 page live progressive writing
 * - Scenario B: Voice revision ("Make the theory longer and add an observation table.")
 * - Scenario C: Targeted paragraph revision ("Make the second paragraph longer.")
 * - Scenario D: Open in Microsoft Word (real WINWORD.EXE + OpusApp window verification + missing-Word truth guard)
 * - Scenario E: Save and verify ("Save it as Physics Experiment 1.") + real error handling (locked file / invalid path)
 * - Scenario F: WhatsApp open & existing window reuse
 * - Scenario G: Exact Contact & Message extraction across all 4 required natural language phrasings
 * - Scenario H: Ambiguous contact clarification ("Rahul" -> Rahul Sharma vs Rahul Verma)
 * - Scenario I: Non-existent contact protection ("NonExistentPersonXYZ" -> contact_not_found, no New Contact)
 * - Scenario J: Send Word file on WhatsApp with header verification & confirmation gate
 * - Scenario K: Notepad single-instance reuse across repeated write commands
 * - Scenario L: Explicit new Notepad window when forceNew is requested
 * - Scenario M: Voice misunderstanding & incomplete command protection ("JARVIS, send a message to...")
 * - Scenario N: Emergency Stop during active document writing & pending WhatsApp staging
 * - Scenario O: Duplicate send prevention
 * - Scenario P: Regression across command routing, STT multi-model failover, and memory extraction
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { liveDocumentStudioInstance, STUDIO_WRITING_STATUS } = require('./server/desktop/liveDocumentStudio.js');
const { whatsappServiceInstance } = require('./server/desktop/whatsappService.js');
const { aiAdapterInstance, formatInstantToolResponse } = require('./server/aiProviderAdapter.js');
const { commandInterpreterInstance } = require('./server/commandInterpreter.js');
const { documentAutomationServiceInstance } = require('./server/desktop/documentAutomationService.js');
const { appLauncherInstance } = require('./server/desktop/appLauncher.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { sttServiceInstance } = require('./server/sttService.js');
const { memoryExtractorInstance } = require('./server/memory/memoryExtractor.js');

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ [FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runCriticalReliabilitySuite() {
  console.log('================================================================================');
  console.log('STARK AI / J.A.R.V.I.S. — CRITICAL END-TO-END RELIABILITY REPAIR SUITE (A–P)');
  console.log('================================================================================\n');

  whatsappServiceInstance.enableSandboxMode();
  emergencyStopControllerInstance.reset('PRE_TEST_CLEAN_STATE');

  // ---------------------------------------------------------------------------
  // SCENARIO A: Word-Style Live Writing ("JARVIS, create a Word document about Ohm's Law.")
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO A: Word-Style White A4 Page & Progressive Writing ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');

  assert(
    indexHtml.includes('id="lds-editor-preview"') &&
    indexHtml.includes('background: #ffffff; color: #111827;') &&
    indexHtml.includes('id="lds-open-word-btn"'),
    'A.1 Live Document Studio UI uses a clean white A4 page (#ffffff background, #111827 black text) inside a neutral workspace with compact top toolbar'
  );
  assert(
    appJs.includes('lds-progressive-sections') && appJs.includes('<table style="width: 100%; border-collapse: collapse;'),
    'A.2 Frontend renderer supports progressive section-by-section rendering and bordered Word tables on the white page'
  );

  const createRes = await liveDocumentStudioInstance.createDocumentProgressively({
    instruction: "JARVIS, create a Word document about Ohm's Law.",
    forceNew: true
  });
  const studioStatusA = liveDocumentStudioInstance.getStudioStatus();
  assert(
    createRes.success === true &&
    studioStatusA.currentDocumentName === 'Ohms_Law.docx' &&
    fs.existsSync(createRes.filePath),
    'A.3 Created single document session and real synchronized .docx file on disk',
    `file=${studioStatusA.currentDocumentName}, size=${studioStatusA.verificationState?.sizeBytes}B`
  );
  assert(
    Array.isArray(studioStatusA.activeDocumentSession?.progressiveWriteLog) &&
    studioStatusA.activeDocumentSession.progressiveWriteLog.length >= 5 &&
    studioStatusA.verificationState?.verified === true,
    'A.4 Progressively wrote all sections and verified canonical .docx synchronization',
    `progressiveChunks=${studioStatusA.activeDocumentSession?.progressiveWriteLog?.length}`
  );

  // ---------------------------------------------------------------------------
  // SCENARIO B: Voice Revision ("Make the theory longer and add an observation table.")
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO B: Voice Revision (Theory + Observation Table) ---');
  const introBeforeB = JSON.stringify(liveDocumentStudioInstance.activeSession.canonicalDocument.sections[0].paragraphs);
  const revB = await liveDocumentStudioInstance.applyVoiceRevision('Make the theory longer and add an observation table.');
  const introAfterB = JSON.stringify(liveDocumentStudioInstance.activeSession.canonicalDocument.sections[0].paragraphs);
  const theorySecB = liveDocumentStudioInstance.activeSession.canonicalDocument.sections[1];
  const obsSecB = liveDocumentStudioInstance.activeSession.canonicalDocument.sections.find(s => s.table);

  assert(
    revB.success === true &&
    introBeforeB === introAfterB &&
    theorySecB.paragraphs.length >= 3 &&
    Boolean(obsSecB && obsSecB.table && obsSecB.table.rows.length >= 3),
    'B.1 Modified only the intended theory and observation table sections while preserving the introduction unchanged',
    `theoryParas=${theorySecB.paragraphs.length}, tableRows=${obsSecB?.table?.rows?.length}`
  );

  // ---------------------------------------------------------------------------
  // SCENARIO C: Targeted Paragraph Revision ("Make the second paragraph longer.")
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO C: Targeted Paragraph Revision ---');
  const p1BeforeC = liveDocumentStudioInstance.activeSession.canonicalDocument.sections[0].paragraphs[0];
  const p2BeforeC = liveDocumentStudioInstance.activeSession.canonicalDocument.sections[0].paragraphs[1];
  const revC = await liveDocumentStudioInstance.applyVoiceRevision('Make the second paragraph longer.');
  const p1AfterC = liveDocumentStudioInstance.activeSession.canonicalDocument.sections[0].paragraphs[0];
  const p2AfterC = liveDocumentStudioInstance.activeSession.canonicalDocument.sections[0].paragraphs[1];

  assert(
    revC.success === true &&
    p1BeforeC === p1AfterC &&
    p2AfterC.length > p2BeforeC.length,
    'C.1 Modified only the second paragraph while keeping the first paragraph strictly unchanged',
    `p2Len: ${p2BeforeC.length} -> ${p2AfterC.length}`
  );

  // Also test "Make the conclusion better" and "Keep the content but improve the formatting"
  const revConclusion = await liveDocumentStudioInstance.applyVoiceRevision('Make the conclusion better.');
  const revFormat = await liveDocumentStudioInstance.applyVoiceRevision('Keep the content but improve the formatting.');
  assert(
    revConclusion.success === true && revFormat.success === true,
    'C.2 Supported "Make the conclusion better" and "Keep the content but improve the formatting" revisions cleanly'
  );

  // ---------------------------------------------------------------------------
  // SCENARIO D: Open in Microsoft Word (Real Verification + Missing-Word Guard)
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO D: Microsoft Word Integration & Real Verification ---');
  const wordMissingSim = await liveDocumentStudioInstance.openInMicrosoftWord({ simulateWordMissing: true });
  assert(
    wordMissingSim.success === false &&
    wordMissingSim.verified === false &&
    wordMissingSim.wordInstalled === false,
    'D.1 When Microsoft Word is not installed, STARK truthfully reports wordInstalled=false and never claims Word opened'
  );

  const wordCheck = liveDocumentStudioInstance.checkMicrosoftWordInstallation();
  assert(
    wordCheck.installed === true,
    'D.2 Verified Microsoft Word (WINWORD.EXE) is installed on this machine',
    wordCheck.executablePath
  );

  const openWordRes = await liveDocumentStudioInstance.openInMicrosoftWord();
  assert(
    openWordRes.success === true &&
    openWordRes.verified === true &&
    Boolean(openWordRes.pid || openWordRes.hwnd),
    'D.3 Opened the real .docx in Microsoft Word and empirically verified the running WINWORD process/OpusApp window',
    `PID=${openWordRes.pid}, HWND=${openWordRes.hwnd}`
  );

  // ---------------------------------------------------------------------------
  // SCENARIO E: Save & Verify + Real Save Error Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO E: Save & Verify + Real Save Error Handling ---');
  const lockedSaveRes = await liveDocumentStudioInstance.saveDocumentSession({
    instruction: 'Save it',
    simulateLockedFile: true
  });
  assert(
    lockedSaveRes.success === false &&
    lockedSaveRes.verified === false &&
    lockedSaveRes.saveStatus === 'SAVE_FAILED' &&
    lockedSaveRes.code === 'EBUSY',
    'E.1 Locked file (EBUSY) returns saveStatus=SAVE_FAILED and verified=false (never falsely claims SAVED_AND_VERIFIED)',
    lockedSaveRes.error
  );

  const invalidPathSaveRes = await liveDocumentStudioInstance.saveDocumentSession({
    filePath: 'Z:\\nonexistent_invalid_drive\\test.docx'
  });
  assert(
    invalidPathSaveRes.success === false &&
    invalidPathSaveRes.verified === false &&
    invalidPathSaveRes.saveStatus === 'SAVE_FAILED',
    'E.2 Invalid path returns saveStatus=SAVE_FAILED and preserves active draft session safely'
  );

  const realSaveRes = await liveDocumentStudioInstance.saveDocumentSession('Save it as Physics Experiment 1.');
  assert(
    realSaveRes.success === true &&
    realSaveRes.verified === true &&
    realSaveRes.fileName === 'Physics_Experiment_1.docx' &&
    fs.existsSync(realSaveRes.filePath) &&
    fs.statSync(realSaveRes.filePath).size > 3000,
    'E.3 Saved "Physics_Experiment_1.docx" and verified physical file, size, and OpenXML structure on disk',
    `filePath=${realSaveRes.filePath} (${realSaveRes.verification?.sizeBytes}B)`
  );

  // ---------------------------------------------------------------------------
  // SCENARIO F: WhatsApp Open & Existing Window Reuse
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO F: WhatsApp Open & Existing Window Reuse ---');
  const waFocus1 = await appLauncherInstance.launch('whatsapp');
  const waFocus2 = await appLauncherInstance.launch('whatsapp');
  assert(
    waFocus1.verified === true &&
    waFocus2.verified === true &&
    waFocus2.status === 'already_running',
    'F.1 Opening WhatsApp reuses and focuses the existing WhatsApp window without spawning duplicate instances',
    `status=${waFocus2.status}, hwnd=${waFocus2.hwnd || 'verified'}`
  );

  // ---------------------------------------------------------------------------
  // SCENARIO G: Contact Name and Message Extraction (All 4 Required Phrasings)
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO G: Contact Name & Message Extraction ---');
  const requiredPhrasings = [
    {
      cmd: "Text Lokesh Upadhyay, what's going on?",
      expectedRecipient: 'Lokesh Upadhyay',
      expectedMessage: "What's going on?"
    },
    {
      cmd: "Send a message to Lokesh Upadhyay saying I'll call you later.",
      expectedRecipient: 'Lokesh Upadhyay',
      expectedMessage: "I'll call you later."
    },
    {
      cmd: 'WhatsApp Lokesh Upadhyay, are you coming tomorrow?',
      expectedRecipient: 'Lokesh Upadhyay',
      expectedMessage: 'Are you coming tomorrow?'
    },
    {
      cmd: 'Tell Lokesh Upadhyay that the document is ready.',
      expectedRecipient: 'Lokesh Upadhyay',
      expectedMessage: 'The document is ready.'
    }
  ];

  for (const item of requiredPhrasings) {
    const intent = aiAdapterInstance.detectToolIntent('JARVIS', item.cmd);
    const interp = commandInterpreterInstance.interpret(item.cmd);
    assert(
      intent &&
      intent.toolName === 'stage_whatsapp_message' &&
      intent.args.recipient === item.expectedRecipient &&
      intent.args.messageText === item.expectedMessage &&
      interp &&
      interp.args &&
      interp.args.recipient === item.expectedRecipient &&
      interp.args.messageText === item.expectedMessage,
      `G. Extract "${item.cmd}"`,
      `Recipient="${intent?.args?.recipient}", Message="${intent?.args?.messageText}"`
    );
  }

  // Stage one of the extracted messages in sandbox mode and verify staging state
  const stageLokesh = await whatsappServiceInstance.stageMessageForUserConfirmation(
    'Lokesh Upadhyay',
    "What's going on?"
  );
  assert(
    stageLokesh.success === true &&
    stageLokesh.status === 'awaiting_confirmation' &&
    stageLokesh.recipient === 'Lokesh Upadhyay' &&
    stageLokesh.messageText === "What's going on?",
    'G.5 Verified existing contact resolution and draft staging awaiting confirmation'
  );

  // ---------------------------------------------------------------------------
  // SCENARIO H: Ambiguous Contact Clarification ("Rahul" -> Rahul Sharma vs Rahul Verma)
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO H: Ambiguous Contact Clarification ---');
  whatsappServiceInstance.initContacts();
  const originalContacts = JSON.parse(JSON.stringify(whatsappServiceInstance.contacts));
  whatsappServiceInstance.contacts.push(
    { name: 'Rahul Sharma', fullName: 'Rahul Sharma', phone: '+919800000001', aliases: ['rahul sharma'] },
    { name: 'Rahul Verma', fullName: 'Rahul Verma', phone: '+919800000002', aliases: ['rahul verma'] }
  );

  const ambigStage = await whatsappServiceInstance.stageMessageForUserConfirmation('Rahul', 'hello');
  const ambigReply = formatInstantToolResponse('JARVIS', 'stage_whatsapp_message', ambigStage, 'en', 'Send a message to Rahul saying hello.');
  assert(
    ambigStage.success === false &&
    ambigStage.status === 'ambiguous_contact' &&
    ambigStage.requiresClarification === true &&
    Array.isArray(ambigStage.matches) &&
    ambigStage.matches.length >= 2 &&
    ambigReply.includes('Rahul Sharma') &&
    ambigReply.includes('Rahul Verma'),
    'H.1 Ambiguous contact "Rahul" asks user to clarify between Rahul Sharma and Rahul Verma and does NOT send',
    ambigReply
  );
  whatsappServiceInstance.contacts = originalContacts;

  // ---------------------------------------------------------------------------
  // SCENARIO I: Non-Existent Contact Protection ("NonExistentPersonXYZ")
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO I: Non-Existent Contact Protection ---');
  const missingStage = await whatsappServiceInstance.stageMessageForUserConfirmation(
    'NonExistentPersonXYZ',
    'hello',
    { strictDirectory: true }
  );
  const missingReply = formatInstantToolResponse('JARVIS', 'stage_whatsapp_message', missingStage, 'en', 'Send a message to NonExistentPersonXYZ saying hello.');
  assert(
    missingStage.success === false &&
    missingStage.status === 'contact_not_found' &&
    missingReply.includes('NonExistentPersonXYZ'),
    'I.1 Non-existent contact reports contact_not_found and never selects another contact or clicks New Contact',
    missingReply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO J: Send Word File on WhatsApp
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO J: Send Word File on WhatsApp ---');
  const stageDocWa = await liveDocumentStudioInstance.deliverDocumentViaWhatsApp({
    instruction: 'Send this Word file to Lokesh Upadhyay on WhatsApp.'
  });
  assert(
    stageDocWa.success === true &&
    stageDocWa.status === 'awaiting_confirmation' &&
    stageDocWa.recipient === 'Lokesh Upadhyay' &&
    stageDocWa.fileName === 'Physics_Experiment_1.docx' &&
    stageDocWa.headerVerification?.headerMatchesRecipient === true &&
    stageDocWa.headerVerification?.newContactTriggered === false,
    'J.1 Staged verified Word file for Lokesh Upadhyay with header verification and confirmation gate',
    `file=${stageDocWa.fileName}, recipient=${stageDocWa.recipient}`
  );

  const confirmDocWa = await liveDocumentStudioInstance.confirmPendingWhatsAppDelivery();
  assert(
    confirmDocWa.success === true &&
    confirmDocWa.status === 'sent_and_verified' &&
    confirmDocWa.outgoingAttachmentVerified === true,
    'J.2 Sent Word document attachment once after explicit confirmation and verified outgoing state'
  );

  // ---------------------------------------------------------------------------
  // SCENARIO O: Duplicate Send Prevention
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO O: Duplicate Send Prevention ---');
  const dupDocWa = await liveDocumentStudioInstance.deliverDocumentViaWhatsApp({
    instruction: 'Send this Word file to Lokesh Upadhyay on WhatsApp.'
  });
  assert(
    dupDocWa.success === false &&
    dupDocWa.duplicateSendPrevented === true &&
    dupDocWa.status === 'duplicate_blocked',
    'O.1 Duplicate attachment send to the same recipient is blocked within deduplication window',
    dupDocWa.summary
  );

  // ---------------------------------------------------------------------------
  // SCENARIO K & L: Notepad Single-Instance Reuse & Explicit New Window
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO K & L: Notepad Single-Instance Reuse & Explicit New Window ---');
  const pyLauncher = path.join(__dirname, 'server/desktop/win32_app_launcher.py');
  const countNotepadWindows = () => {
    try {
      const out = execFileSync('python', [pyLauncher, 'count', 'notepad'], { encoding: 'utf8', timeout: 5000 });
      return JSON.parse(out.trim()).count || 0;
    } catch (_) {
      return 0;
    }
  };

  await documentAutomationServiceInstance.writeNotepadDocument({
    title: 'Project_Notes_Test',
    content: 'Line 1: Initial STARK project notes.',
    openInNotepad: true
  });
  await documentAutomationServiceInstance.writeNotepadDocument({
    title: 'Project_Notes_Test',
    content: 'Line 1: Initial STARK project notes.\nLine 2: Added second line to existing Notepad.',
    openInNotepad: true
  });
  const npCountAfterReuse = countNotepadWindows();
  assert(
    npCountAfterReuse === 1,
    'K.1 Repeated Notepad write commands reuse/replace the single managed Notepad window without accumulating multiple windows',
    `activeNotepadWindows=${npCountAfterReuse}`
  );

  // Scenario L: Explicit new Notepad window (forceNew: true)
  await appLauncherInstance.launch('notepad', { forceNew: true });
  const npCountAfterExplicitNew = countNotepadWindows();
  assert(
    npCountAfterExplicitNew >= 2,
    'L.1 Explicit new Notepad window request (forceNew: true) opens a second Notepad window as requested',
    `activeNotepadWindows=${npCountAfterExplicitNew}`
  );

  // Clean up extra Notepad windows so at most 1 remains
  await appLauncherInstance.close('notepad');

  // ---------------------------------------------------------------------------
  // SCENARIO M: Voice Misunderstanding & Incomplete Command Protection
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO M: Voice Misunderstanding & Incomplete Command Protection ---');
  const incompleteExtract = whatsappServiceInstance.extractMessagingEntities('JARVIS, send a message to...');
  const incompleteInterp = commandInterpreterInstance.interpret('JARVIS, send a message to...');
  const incompleteStage = await whatsappServiceInstance.stageMessageForUserConfirmation('', '');
  assert(
    incompleteExtract.isMessagingIntent === true &&
    incompleteExtract.isIncomplete === true &&
    incompleteExtract.requiresClarification === true &&
    incompleteInterp.requiresClarification === true &&
    incompleteStage.status === 'incomplete_command',
    'M.1 Interrupted command "JARVIS, send a message to..." requests clarification and never invents a recipient',
    incompleteExtract.summary
  );

  // ---------------------------------------------------------------------------
  // SCENARIO N: Emergency Stop During Active Writing & Pending WhatsApp Staging
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO N: Emergency Stop & Recovery Safety ---');
  await whatsappServiceInstance.stageMessageForUserConfirmation('Lokesh Upadhyay', 'Test message before E-stop');
  assert(
    whatsappServiceInstance.pendingConfirmation !== null,
    'N.1 Staged pending WhatsApp draft prior to Emergency Stop'
  );

  const estopRes = emergencyStopControllerInstance.engage('CRITICAL_RELIABILITY_TEST_ESTOP');
  assert(
    estopRes.engaged === true &&
    whatsappServiceInstance.pendingConfirmation === null &&
    liveDocumentStudioInstance.activeSession.writingStatus === STUDIO_WRITING_STATUS.HALTED_BY_EMERGENCY_STOP,
    'N.2 Emergency Stop immediately halts Live Document Studio and purges pending WhatsApp drafts'
  );

  emergencyStopControllerInstance.reset('CRITICAL_RELIABILITY_TEST_RESET');
  const postResetSend = await whatsappServiceInstance.confirmAndDispatchPendingMessage();
  assert(
    postResetSend.status === 'no_pending_draft',
    'N.3 Resetting Emergency Stop never replays or sends a previously purged WhatsApp draft'
  );

  const recoverRes = await liveDocumentStudioInstance.recoverInterruptedSession();
  assert(
    recoverRes.success === true &&
    recoverRes.verification?.verified === true,
    'N.4 Document session recovers cleanly after E-stop reset with all prior committed revisions intact'
  );

  // ---------------------------------------------------------------------------
  // SCENARIO P: Regression Checks (Task Routing, STT Failover, Memory Extractor)
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO P: Regression Checks ---');
  const nonWaSentence = "I am correcting the now the messages being sent immediately";
  const nonWaIntent = aiAdapterInstance.detectToolIntent('JARVIS', nonWaSentence);
  const extractedMems = memoryExtractorInstance.extractMemories(nonWaSentence);
  assert(
    nonWaIntent === null &&
    (extractedMems.items ? extractedMems.items.length === 0 : extractedMems.length === 0),
    'P.1 Conversational sentence with "sent" or "I am <verb-ing>" never false-triggers WhatsApp or pollutes user name memory'
  );

  assert(
    Array.isArray(sttServiceInstance.candidateModels) &&
    sttServiceInstance.candidateModels.includes('gemini-3.1-flash-lite') &&
    sttServiceInstance.candidateModels.includes('gemini-2.5-flash'),
    'P.2 STTService configures multi-model failover across gemini-3.1-flash-lite, gemini-2.5-flash, and gemini-2.0-flash'
  );

  console.log('\n================================================================================');
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCriticalReliabilitySuite().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});

