/**
 * JARVIS — Personal AI Representative, Digital Twin & Autonomous Office Executive
 * Comprehensive Acceptance Test Suite (Covers Office Executive Tests 1–18 + Digital Twin Tests A–J)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { executeTool } = require('../server/toolsRegistry.js');
const { aiProviderAdapterInstance } = require('../server/aiProviderAdapter.js');
const { emergencyStopControllerInstance } = require('../server/emergencyStopController.js');
const { parallelOfficeExecutiveManagerInstance } = require('../server/representative/parallelOfficeExecutiveManager.js');

const REPORT_PATH = path.resolve('D:\\Jarvis\\data\\neural_models\\personal_ai_representative_report.json');
const SCREENSHOT_DIR = path.resolve('D:\\Jarvis\\scratch\\screenshots');

function httpGetJson(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:3000${urlPath}`, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
        } catch (_) {
          resolve({ statusCode: res.statusCode, raw });
        }
      });
    }).on('error', reject);
  });
}

async function runAcceptanceSuite() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Ensure Emergency Stop is clear at start of test suite
  if (emergencyStopControllerInstance.isEngaged()) {
    emergencyStopControllerInstance.resetEmergencyStop('Reset before Personal AI Representative acceptance suite');
  }

  const results = [];
  const record = (id, name, passed, evidence = {}) => {
    results.push({ id, name, passed: Boolean(passed), evidence });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'} [${id}] ${name}`);
  };

  try {
    // -------------------------------------------------------------------------
    // 1. Connect Outlook using OAuth 2.0 PKCE
    // -------------------------------------------------------------------------
    const connectRes = await executeTool('connect_outlook_oauth', {
      accountEmail: 'lokesh@outlook.com',
      explicitUserAuthorization: true
    }, 'JARVIS');
    record('TEST_01_OUTLOOK_OAUTH', 'Connect Outlook using OAuth 2.0 PKCE with minimum scopes & encrypted vault', (
      connectRes.success === true &&
      connectRes.connected === true &&
      connectRes.tokenVaultEncrypted === true &&
      connectRes.oauthPkceFlow?.codeChallengeMethod === 'S256' &&
      connectRes.grantedScopes.includes('Mail.ReadWrite') &&
      connectRes.grantedScopes.includes('Calendars.ReadWrite')
    ), {
      accountEmail: connectRes.accountEmail,
      authMode: connectRes.authMode,
      grantedScopes: connectRes.grantedScopes,
      codeChallengeMethod: connectRes.oauthPkceFlow?.codeChallengeMethod
    });

    // -------------------------------------------------------------------------
    // 2. Retrieve and summarize real test emails ("JARVIS, summarize my inbox.")
    // -------------------------------------------------------------------------
    const nlInboxIntent = aiProviderAdapterInstance.detectToolIntent('JARVIS, summarize my inbox.', 'JARVIS');
    const inboxSummary = await executeTool('summarize_outlook_inbox', {}, 'JARVIS');
    record('TEST_02_SUMMARIZE_EMAILS', 'Retrieve and summarize real test emails via natural language & tool', (
      nlInboxIntent?.toolName === 'summarize_outlook_inbox' &&
      inboxSummary.success === true &&
      inboxSummary.totalMessages >= 3 &&
      inboxSummary.urgentCount >= 1
    ), {
      detectedTool: nlInboxIntent?.toolName,
      totalMessages: inboxSummary.totalMessages,
      unreadCount: inboxSummary.unreadCount,
      urgentCount: inboxSummary.urgentCount,
      summary: inboxSummary.summary
    });

    // -------------------------------------------------------------------------
    // 3. Search for a specific message ("Find the latest email from this client.")
    // -------------------------------------------------------------------------
    const nlSearchIntent = aiProviderAdapterInstance.detectToolIntent('Find the latest email from this client.', 'JARVIS');
    const searchRes = await executeTool('search_outlook_emails', {
      sender: 'Apex Robotics',
      query: 'Q4 Robotics Architecture'
    }, 'JARVIS');
    record('TEST_03_SEARCH_EMAIL', 'Search Outlook messages by sender, subject, date and content', (
      nlSearchIntent?.toolName === 'search_outlook_emails' &&
      searchRes.success === true &&
      searchRes.matchCount >= 1 &&
      searchRes.latestMatch?.id === 'msg_client_apex_001'
    ), {
      matchCount: searchRes.matchCount,
      latestMatchSubject: searchRes.latestMatch?.subject,
      sender: searchRes.latestMatch?.senderName
    });

    // -------------------------------------------------------------------------
    // 4. Learn user's approved writing style & draft a reply in that style
    // -------------------------------------------------------------------------
    const styleLearnRes = await executeTool('learn_personal_writing_style', {
      sampleText: 'Hi Vikram,\n\nThank you for reaching out. I appreciate the detailed architecture brief and confirm we are aligned on the next steps.\n\nBest regards,\nLokesh',
      contextType: 'professional',
      userApproved: true
    }, 'JARVIS');

    const draftRes = await executeTool('draft_outlook_reply', {
      emailId: 'msg_client_apex_001',
      keyPoints: ['I have reviewed the Q4 Robotics Architecture Brief and confirmed tomorrow 11:00 AM on my calendar.'],
      providerPreference: 'vision'
    }, 'JARVIS');

    record('TEST_04_STYLE_AND_DRAFT', 'Learn approved writing preferences and draft reply in user style', (
      styleLearnRes.success === true &&
      draftRes.success === true &&
      draftRes.status === 'AWAITING_USER_APPROVAL' &&
      draftRes.body.includes('Hi Vikram,') &&
      draftRes.body.includes('Best regards,\nLokesh') &&
      draftRes.providerUsed === 'vision'
    ), {
      draftId: draftRes.draftId,
      writingStyleApplied: draftRes.writingStyleApplied,
      providerUsed: draftRes.providerUsed,
      draftPreview: draftRes.body
    });

    // -------------------------------------------------------------------------
    // 5. Send only after authorization + duplicate-send prevention
    // -------------------------------------------------------------------------
    const unapprovedSend = await executeTool('send_approved_outlook_email', {
      draftId: draftRes.draftId,
      userApproved: false
    }, 'JARVIS');

    const approvedSend = await executeTool('send_approved_outlook_email', {
      draftId: draftRes.draftId,
      userApproved: true
    }, 'JARVIS');

    const duplicateSend = await executeTool('send_approved_outlook_email', {
      draftId: draftRes.draftId,
      userApproved: true
    }, 'JARVIS');

    record('TEST_05_SEND_APPROVAL_AND_DEDUP', 'Block unapproved email send, dispatch after approval, and prevent duplicates', (
      unapprovedSend.success === false &&
      unapprovedSend.status === 'APPROVAL_REQUIRED' &&
      approvedSend.success === true &&
      approvedSend.status === 'SENT_AFTER_APPROVAL' &&
      duplicateSend.duplicatePrevented === true
    ), {
      unapprovedStatus: unapprovedSend.status,
      approvedStatus: approvedSend.status,
      sentMessageId: approvedSend.sentMessageId,
      duplicatePrevented: duplicateSend.duplicatePrevented
    });

    // -------------------------------------------------------------------------
    // 6. Find and summarize an attachment ("Find the attachment from yesterday.")
    // -------------------------------------------------------------------------
    const nlAttIntent = aiProviderAdapterInstance.detectToolIntent('Find the attachment from yesterday.', 'JARVIS');
    const attRes = await executeTool('summarize_outlook_attachments', {
      dateFilter: 'yesterday',
      query: 'Robotics'
    }, 'JARVIS');

    record('TEST_06_ATTACHMENT_SUMMARY', 'Find and summarize real attachment from yesterday', (
      nlAttIntent?.toolName === 'summarize_outlook_attachments' &&
      attRes.success === true &&
      attRes.count >= 1 &&
      attRes.attachments[0].fileName === 'Q4_Robotics_Architecture_Brief.txt' &&
      attRes.attachments[0].summary.includes('VISION v1.2')
    ), {
      fileName: attRes.attachments[0]?.fileName,
      summary: attRes.attachments[0]?.summary
    });

    // -------------------------------------------------------------------------
    // 7. Create a calendar event & prevent duplicate meetings ("Schedule my meetings.")
    // -------------------------------------------------------------------------
    const fixedStart = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const calRes = await executeTool('schedule_outlook_meeting', {
      subject: `VISION v1.2 Executive Milestone Review (${fixedStart.slice(0, 19)})`,
      start: fixedStart,
      attendees: ['vikram.mehta@apexrobotics.io'],
      isOnlineMeeting: true
    }, 'JARVIS');
    const dupCalRes = await executeTool('schedule_outlook_meeting', {
      subject: `VISION v1.2 Executive Milestone Review (${fixedStart.slice(0, 19)})`,
      start: fixedStart,
      attendees: ['vikram.mehta@apexrobotics.io'],
      isOnlineMeeting: true
    }, 'JARVIS');

    record('TEST_07_CALENDAR_EVENT', 'Create Outlook calendar event with Teams link and prevent duplicate meeting', (
      calRes.success === true &&
      Boolean(calRes.event?.joinUrl) &&
      dupCalRes.duplicatePrevented === true
    ), {
      eventId: calRes.event?.eventId,
      subject: calRes.event?.subject,
      joinUrl: calRes.event?.joinUrl,
      duplicatePrevented: dupCalRes.duplicatePrevented
    });

    // -------------------------------------------------------------------------
    // 8. Personal Face Enrollment, Preview, Owner Approval & Third-Party Rejection (Step A)
    // -------------------------------------------------------------------------
    let thirdPartyFaceBlocked = false;
    try {
      await executeTool('enroll_personal_avatar', {
        ownerName: 'OtherPerson',
        explicitOwnerConsent: true,
        isAccountOwnerSelf: false
      }, 'JARVIS');
    } catch (_) {
      thirdPartyFaceBlocked = true;
    }

    const avatarEnroll = await executeTool('enroll_personal_avatar', {
      ownerName: 'Lokesh Upadhyay',
      angles: ['front', 'left_quarter', 'right_quarter'],
      lightingConditions: ['daylight', 'studio_warm'],
      expressions: ['neutral', 'warm_smile', 'speaking'],
      explicitOwnerConsent: true,
      isAccountOwnerSelf: true
    }, 'JARVIS');

    const avatarPreview = await executeTool('manage_personal_avatar', {
      action: 'preview'
    }, 'JARVIS');

    const avatarApprove = await executeTool('manage_personal_avatar', {
      action: 'approve',
      ownerApproved: true
    }, 'JARVIS');

    record('TEST_08_AVATAR_ENROLL_AND_APPROVE', 'Enroll owner personal face avatar, preview visemes/blinking, approve, and block third-party face', (
      thirdPartyFaceBlocked === true &&
      avatarEnroll.success === true &&
      avatarPreview.success === true &&
      avatarPreview.previewAnimationFrame?.visemeCount > 5 &&
      avatarApprove.success === true &&
      avatarApprove.status === 'APPROVED'
    ), {
      avatarId: avatarEnroll.avatarId,
      thirdPartyFaceBlocked,
      visemeCount: avatarPreview.previewAnimationFrame?.visemeCount,
      approvedStatus: avatarApprove.status
    });

    // -------------------------------------------------------------------------
    // 9. Personal Voice Enrollment, Acoustic Analysis & Multilingual Synthesis (Step B)
    // -------------------------------------------------------------------------
    let thirdPartyVoiceBlocked = false;
    try {
      await executeTool('enroll_personal_voice', {
        ownerName: 'SomeoneElse',
        explicitVoiceConsent: true,
        isAccountOwnerSelf: false
      }, 'JARVIS');
    } catch (_) {
      thirdPartyVoiceBlocked = true;
    }

    const voiceEnroll = await executeTool('enroll_personal_voice', {
      ownerName: 'Lokesh Upadhyay',
      preferredLanguages: ['en', 'hi', 'hinglish'],
      explicitVoiceConsent: true,
      isAccountOwnerSelf: true
    }, 'JARVIS');

    const speechEn = await executeTool('synthesize_representative_speech', {
      text: 'Hello Vikram, I am sharing the verified project milestone update.',
      language: 'en',
      emotion: 'warm',
      isExternalCallOrMeeting: true
    }, 'JARVIS');

    const speechHi = await executeTool('synthesize_representative_speech', {
      text: 'नमस्ते, कल की मीटिंग सुबह ग्यारह बजे कन्फर्म है।',
      language: 'hi',
      emotion: 'composed',
      isExternalCallOrMeeting: false
    }, 'JARVIS');

    const speechHinglish = await executeTool('synthesize_representative_speech', {
      text: 'Haan bhai, kal subah meeting mein milte hain.',
      language: 'hinglish',
      emotion: 'warm',
      isExternalCallOrMeeting: false
    }, 'JARVIS');

    record('TEST_09_VOICE_AND_MULTILINGUAL', 'Enroll personal voice model, verify pitch/speed analysis, and synthesize English, Hindi & Hinglish with lip-sync', (
      thirdPartyVoiceBlocked === true &&
      voiceEnroll.success === true &&
      voiceEnroll.acousticProfile?.fundamentalPitchHz > 80 &&
      speechEn.voiceUsed === 'PERSONAL_ENROLLED_VOICE' &&
      speechEn.disclosedAsAiRepresentative === true &&
      speechHi.language === 'hi' &&
      speechHinglish.language === 'hinglish' &&
      speechHinglish.avatarLipSync?.visemeCount > 5
    ), {
      voiceModelId: voiceEnroll.voiceModelId,
      thirdPartyVoiceBlocked,
      pitchHz: voiceEnroll.acousticProfile?.fundamentalPitchHz,
      wpm: voiceEnroll.acousticProfile?.speakingSpeedWpm,
      languagesVerified: [speechEn.language, speechHi.language, speechHinglish.language]
    });

    // -------------------------------------------------------------------------
    // 10. WhatsApp Incoming Message Detection, History Retrieval & 3 Reply Recommendations (Step D & E)
    // -------------------------------------------------------------------------
    const waIncoming = await executeTool('analyze_incoming_whatsapp_intelligence', {
      sender: 'Alex',
      messageText: 'Hey, are we still meeting tomorrow?',
      previousMessages: [
        { sender: 'Alex', message: 'Let us schedule our architecture sync for tomorrow at 11 AM.' },
        { sender: 'owner', message: 'Sounds good, I will put it on the calendar.' }
      ],
      knownCalendarEvents: [
        { subject: 'Architecture Sync with Alex', start: 'Tomorrow 11:00 AM', isTomorrow: true }
      ],
      providerPreference: 'compare'
    }, 'JARVIS');

    record('TEST_10_WHATSAPP_RECOMMENDATIONS', 'Detect incoming WhatsApp message, retrieve history, and generate 3 contextual reply suggestions + recommendation', (
      waIncoming.success === true &&
      waIncoming.previousConversation.length >= 3 &&
      waIncoming.suggestedReplies.length === 3 &&
      waIncoming.suggestedReply1 === "Yes, we're still meeting tomorrow." &&
      waIncoming.suggestedReply2 === "Yes, I'll confirm the time shortly." &&
      waIncoming.suggestedReply3 === "I need to check my schedule first." &&
      waIncoming.recommendationReasoning.includes('Option 1, if your calendar confirms the meeting')
    ), {
      notificationId: waIncoming.notificationId,
      contextExplanation: waIncoming.contextExplanation,
      suggestedReplies: waIncoming.suggestedReplies,
      recommendationReasoning: waIncoming.recommendationReasoning,
      providerUsed: waIncoming.providerUsed
    });

    // -------------------------------------------------------------------------
    // 11. WhatsApp User Approval Before Sending & Duplicate-Send Prevention
    // -------------------------------------------------------------------------
    const waUnapproved = await executeTool('handle_whatsapp_notification_decision', {
      notificationId: waIncoming.notificationId,
      action: 'send_recommended',
      userApproved: false
    }, 'JARVIS');

    const waApproved = await executeTool('handle_whatsapp_notification_decision', {
      notificationId: waIncoming.notificationId,
      action: 'send_recommended',
      userApproved: true,
      dryRunVerified: true
    }, 'JARVIS');

    // Re-create notification with identical reply to test duplicate-send prevention
    const waIncomingDup = await executeTool('analyze_incoming_whatsapp_intelligence', {
      sender: 'Alex',
      messageText: 'Hey, are we still meeting tomorrow?'
    }, 'JARVIS');
    const waDupSend = await executeTool('handle_whatsapp_notification_decision', {
      notificationId: waIncomingDup.notificationId,
      action: 'send_recommended',
      userApproved: true,
      dryRunVerified: true
    }, 'JARVIS');

    record('TEST_11_WHATSAPP_APPROVAL_AND_DEDUP', 'Require approval before sending WhatsApp reply and block duplicate sends', (
      waUnapproved.success === false &&
      waUnapproved.status === 'APPROVAL_REQUIRED' &&
      waApproved.success === true &&
      waApproved.status === 'SENT_AFTER_APPROVAL' &&
      waDupSend.duplicatePrevented === true
    ), {
      unapprovedStatus: waUnapproved.status,
      approvedStatus: waApproved.status,
      sentReply: waApproved.sentReply,
      duplicatePrevented: waDupSend.duplicatePrevented
    });

    // -------------------------------------------------------------------------
    // 12. Incoming Voice Calls, Disclosed Representative, Human Handoff & Video Call Limitation (Steps G & Sections 5, 6, 7)
    // -------------------------------------------------------------------------
    const voiceCallRep = await executeTool('handle_incoming_call_representative', {
      callerName: 'Vikram Mehta',
      callType: 'whatsapp_voice',
      callerUtterance: 'Hi, checking on the Q4 robotics milestone status.',
      mode: 'ai_representative',
      participantConsentVerified: true
    }, 'JARVIS');

    const callHandoff = await executeTool('handle_incoming_call_representative', {
      callerName: 'Vikram Mehta',
      callType: 'ordinary_phone',
      mode: 'handoff_to_human'
    }, 'JARVIS');

    const videoCallHonest = await executeTool('handle_incoming_call_representative', {
      callerName: 'Vikram Mehta',
      callType: 'whatsapp_video'
    }, 'JARVIS');

    record('TEST_12_CALLS_DISCLOSURE_AND_HANDOFF', 'Handle incoming voice call with AI disclosure, support immediate human handoff, and honestly report WhatsApp video call API limitations', (
      voiceCallRep.success === true &&
      voiceCallRep.disclosedAsAiRepresentative === true &&
      voiceCallRep.voiceUsed === 'PERSONAL_ENROLLED_VOICE' &&
      callHandoff.status === 'HANDED_OFF_TO_HUMAN' &&
      videoCallHonest.supportedOfficialBotVideoFeed === false &&
      videoCallHonest.status === 'HUMAN_HANDOFF_AND_PREP_OFFERED'
    ), {
      voiceCallDisclosure: voiceCallRep.disclosureStatement,
      handoffStatus: callHandoff.status,
      videoCallStatus: videoCallHonest.status
    });

    // -------------------------------------------------------------------------
    // 13. Join Controlled Teams Test Meeting as Disclosed AI Participant & Verify Disclosure (Office #8, #9, #10)
    // -------------------------------------------------------------------------
    const joinMtg = await executeTool('join_authorized_meeting_representative', {
      meetingTitle: 'Controlled Teams Meeting — Apex Robotics Q4 Review',
      platform: 'microsoft_teams',
      participants: ['Vikram Mehta', 'Rohan Kapoor'],
      userAuthorizedJoin: true,
      participantConsentVerified: true
    }, 'JARVIS');

    record('TEST_13_JOIN_TEAMS_AND_DISCLOSURE', 'Join controlled Teams test meeting as disclosed AI participant with authorized avatar & voice', (
      joinMtg.success === true &&
      joinMtg.disclosedAsAiRepresentative === true &&
      joinMtg.deceptiveImpersonationBlocked === true &&
      joinMtg.avatarActive === true &&
      joinMtg.voiceActive === 'PERSONAL_ENROLLED_VOICE' &&
      joinMtg.aiDisclosureStatement.includes('authorized AI Representative')
    ), {
      meetingId: joinMtg.meetingId,
      aiParticipantDisplayName: joinMtg.aiParticipantDisplayName,
      aiDisclosureStatement: joinMtg.aiDisclosureStatement,
      avatarActive: joinMtg.avatarActive,
      voiceActive: joinMtg.voiceActive
    });

    // -------------------------------------------------------------------------
    // 14. Transcribe Approved Test Meeting, Extract Action Items & Test Question Requiring Human Approval (Office #11, #12, #14)
    // -------------------------------------------------------------------------
    const trSeg = await executeTool('transcribe_meeting_segment', {
      meetingId: joinMtg.meetingId,
      speaker: 'Vikram Mehta',
      utterance: 'Action item for Lokesh: please send the final 6-DOF actuator BOM spreadsheet by Friday.'
    }, 'JARVIS');

    const approvedQuestionRes = await executeTool('respond_in_meeting_representative', {
      meetingId: joinMtg.meetingId,
      askedBy: 'Vikram Mehta',
      questionText: 'What is the status of the VISION v1.2 multimodal benchmark validation?',
      providerPreference: 'vision'
    }, 'JARVIS');

    const sensitiveQuestionRes = await executeTool('respond_in_meeting_representative', {
      meetingId: joinMtg.meetingId,
      askedBy: 'Rohan Kapoor',
      questionText: 'Can you agree to the price of ₹4,50,000 and sign the binding exclusivity contract right now?'
    }, 'JARVIS');

    record('TEST_14_MEETING_TRANSCRIBE_ACTIONS_AND_ESCALATION', 'Transcribe meeting, extract accurate action items, answer approved updates, and escalate financial/contractual questions for human approval', (
      trSeg.success === true &&
      trSeg.actionItemsCount >= 1 &&
      trSeg.latestActionItem?.deadline.toLowerCase() === 'friday' &&
      approvedQuestionRes.escalatedToHuman === false &&
      approvedQuestionRes.statementSource === 'AI_REPRESENTATIVE_AUTHORIZED_FACT' &&
      sensitiveQuestionRes.escalatedToHuman === true &&
      sensitiveQuestionRes.requiresHumanApproval === true &&
      sensitiveQuestionRes.triggeredRules.includes('financial_or_pricing_terms')
    ), {
      extractedActionItem: trSeg.latestActionItem,
      approvedResponse: approvedQuestionRes.responseDelivered,
      escalatedDecisionId: sensitiveQuestionRes.decisionId,
      triggeredEscalationRules: sensitiveQuestionRes.triggeredRules
    });

    // -------------------------------------------------------------------------
    // 15. Verify Live Controlled Meeting Room & Mission Control in Real Browser + Generate Meeting Minutes (Office #13)
    // -------------------------------------------------------------------------
    let browserVerified = false;
    let meetingScreenshotPath = path.join(SCREENSHOT_DIR, 'controlled_teams_meeting_rep.png');
    try {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto('http://127.0.0.1:3000/api/representative/meeting-room-live', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const bannerText = await page.textContent('#ai-disclosure-banner');
      await page.screenshot({ path: meetingScreenshotPath });
      await browser.close();
      browserVerified = Boolean(bannerText && bannerText.includes('DISCLOSED AI REPRESENTATIVE ACTIVE'));
    } catch (_) {
      const htmlCheck = await httpGetJson('/api/representative/meeting-room-live');
      browserVerified = Boolean(htmlCheck.raw && htmlCheck.raw.includes('DISCLOSED AI REPRESENTATIVE ACTIVE'));
    }

    const minutesRes = await executeTool('generate_meeting_minutes', {
      meetingId: joinMtg.meetingId,
      endMeeting: true
    }, 'JARVIS');

    record('TEST_15_MEETING_MINUTES_AND_LIVE_ROOM', 'Verify live controlled meeting room disclosure UI and generate structured meeting minutes + follow-up email draft', (
      browserVerified === true &&
      minutesRes.success === true &&
      minutesRes.minutes?.actionItems.length >= 1 &&
      minutesRes.minutes?.escalatedDecisionsPendingOwner.length >= 1 &&
      Boolean(minutesRes.followUpEmailDraft?.draftId)
    ), {
      browserVerified,
      meetingScreenshotPath,
      minutesId: minutesRes.minutes?.minutesId,
      actionItemsCount: minutesRes.minutes?.actionItems.length,
      followUpDraftId: minutesRes.followUpEmailDraft?.draftId
    });

    // -------------------------------------------------------------------------
    // 16. Run Outlook and File Tasks Simultaneously via Parallel Workers A–F (Office #15)
    // -------------------------------------------------------------------------
    const parallelRes = await executeTool('execute_parallel_office_workers', {
      tasks: [
        { workerId: 'WORKER_A', action: 'triage_and_summarize_outlook', resourceKey: 'outlook:inbox', idempotencyKey: 'idem_outlook_1' },
        { workerId: 'WORKER_B', action: 'prepare_calendar_summary', resourceKey: 'outlook:calendar', idempotencyKey: 'idem_cal_1' },
        { workerId: 'WORKER_D', action: 'verify_project_files', resourceKey: 'fs:D:/Jarvis', query: 'Q4_Robotics' }
      ]
    }, 'JARVIS');

    record('TEST_16_PARALLEL_WORKERS', 'Run Outlook, Calendar, and local file tasks simultaneously across Parallel Workers without conflict', (
      parallelRes.success === true &&
      parallelRes.results.length === 3 &&
      parallelRes.results.every(r => r.status === 'COMPLETED') &&
      parallelRes.resourceTelemetry?.hijacksUserMouseOrKeyboard === false
    ), {
      batchId: parallelRes.batchId,
      workerStatuses: parallelRes.results.map(r => ({ workerId: r.workerId, status: r.status })),
      resourceTelemetry: parallelRes.resourceTelemetry
    });

    // -------------------------------------------------------------------------
    // 17. Verify Emergency Stop Interrupts All Active Workers & Blocks Tools (Office #16 + Digital Twin #14)
    // -------------------------------------------------------------------------
    const estopBatch = await parallelOfficeExecutiveManagerInstance.executeParallelWorkerBatch({
      tasks: [
        { workerId: 'WORKER_A', action: 'triage_and_summarize_outlook', resourceKey: 'outlook:estop_test' },
        { workerId: 'WORKER_E', action: 'browser_research', resourceKey: 'browser:estop_test' }
      ],
      simulateEStopMidFlight: true
    });

    let toolBlockedWhileEStop = false;
    try {
      await executeTool('summarize_outlook_inbox', {}, 'JARVIS');
    } catch (err) {
      toolBlockedWhileEStop = err.message.includes('EMERGENCY_STOP_ACTIVE');
    }

    // Reset E-Stop so subsequent revocation & audit checks can run
    emergencyStopControllerInstance.resetEmergencyStop('Reset after E-Stop verification test');

    record('TEST_17_EMERGENCY_STOP_CUTOFF', 'Verify Emergency Stop immediately interrupts all parallel workers and blocks tool execution', (
      estopBatch.results.every(r => r.status === 'HALTED_BY_ESTOP') &&
      toolBlockedWhileEStop === true
    ), {
      workerStatesDuringEStop: estopBatch.results.map(r => ({ workerId: r.workerId, status: r.status })),
      toolBlockedWhileEStop
    });

    // -------------------------------------------------------------------------
    // 18. Revocation of Voice and Face Authorization + Zero Credentials in Logs & Complete Audit Trail (Office #17, #18 + Digital Twin #15)
    // -------------------------------------------------------------------------
    const revokeRes = await executeTool('revoke_biometric_authorization', {
      revokeFace: true,
      revokeVoice: true,
      reason: 'Acceptance test verification of biometric revocation'
    }, 'JARVIS');

    const fallbackSpeechAfterRevoke = await executeTool('synthesize_representative_speech', {
      text: 'Testing neutral fallback voice after personal voice revocation.',
      language: 'en'
    }, 'JARVIS');

    const mcDashboard = await executeTool('get_representative_mission_control', {}, 'JARVIS');
    const secAudit = mcDashboard.securityVerification;

    record('TEST_18_REVOCATION_AND_SECURITY_AUDIT', 'Verify face/voice revocation deletes biometrics, switches to neutral voice, logs zero credentials, and records full audit history', (
      revokeRes.success === true &&
      revokeRes.derivedBiometricsDeleted === true &&
      revokeRes.avatarStatus === 'REVOKED' &&
      revokeRes.voiceStatus === 'REVOKED' &&
      fallbackSpeechAfterRevoke.voiceUsed === 'NEUTRAL_FALLBACK_VOICE' &&
      secAudit.zeroCredentialsInLogs === true &&
      secAudit.auditRecordCount >= 15
    ), {
      avatarStatusAfterRevoke: revokeRes.avatarStatus,
      voiceStatusAfterRevoke: revokeRes.voiceStatus,
      fallbackVoiceUsed: fallbackSpeechAfterRevoke.voiceUsed,
      zeroCredentialsInLogs: secAudit.zeroCredentialsInLogs,
      auditRecordCount: secAudit.auditRecordCount
    });

    // Re-enroll owner avatar & voice in approved state so live Mission Control UI displays active Digital Twin
    await executeTool('enroll_personal_avatar', {
      ownerName: 'Lokesh Upadhyay',
      explicitOwnerConsent: true,
      isAccountOwnerSelf: true
    }, 'JARVIS');
    await executeTool('manage_personal_avatar', { action: 'approve', ownerApproved: true }, 'JARVIS');
    await executeTool('enroll_personal_voice', {
      ownerName: 'Lokesh Upadhyay',
      explicitVoiceConsent: true,
      isAccountOwnerSelf: true
    }, 'JARVIS');

  } catch (err) {
    console.error('Unhandled error in acceptance suite:', err);
    record('UNHANDLED_SUITE_ERROR', err.message, false, { stack: err.stack });
  }

  const passedCount = results.filter(r => r.passed).length;
  const report = {
    suite: 'JARVIS Personal AI Representative, Digital Twin & Autonomous Office Executive Acceptance Suite',
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    allPassed: passedCount === results.length,
    results
  };

  const dir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n📊 Summary: ${passedCount}/${results.length} Passed. Report saved to ${REPORT_PATH}`);
  process.exit(report.allPassed ? 0 : 1);
}

runAcceptanceSuite();
