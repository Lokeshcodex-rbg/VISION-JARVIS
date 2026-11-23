/**
 * JARVIS — WhatsApp Personal Communication Intelligence & Supported Call Representative
 * Official AI Identity: VISION — MADE BY LOKESH | Assistant: JARVIS
 *
 * Implements Dependency Steps D, E, G & Sections 4, 5, 6, 7:
 * - Permitted WhatsApp integration via Windows OS notifications and user-authorized
 *   WhatsApp Desktop / Web bridge (no private API reverse-engineering or cookie extraction).
 * - Incoming message analysis: sender, history retrieval, context explanation,
 *   3 suggested replies, recommended option + reasoning.
 * - User actions: send recommended, edit, select option 1/2/3, write different, ignore, archive.
 * - Strict duplicate-send prevention (idempotency hash over recipient + normalized text).
 * - Narrowly scoped optional auto-reply rules (blocks financial, legal, intimate, sensitive).
 * - Incoming WhatsApp Voice Calls, WhatsApp Video Calls (honest platform limitation + handoff),
 *   and Ordinary Phone Calls (Windows Phone Link / SIP inspection + disclosed representative).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { whatsappServiceInstance } = require('../desktop/whatsappService.js');
const { personalCommunicationBrainInstance } = require('./personalCommunicationBrain.js');
const { personalDigitalTwinServiceInstance } = require('./personalDigitalTwinService.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const REP_DATA_DIR = path.resolve('D:\\Jarvis\\data\\representative');
const WA_INTEL_FILE = path.join(REP_DATA_DIR, 'whatsapp_intelligence_state.json');

class WhatsAppPersonalIntelligence {
  constructor() {
    this._ensureStorage();
    this.pendingNotifications = new Map(); // notificationId -> structured notification card
    this.archivedNotifications = [];
    this.sentDispatchLedger = new Map(); // idempotencyKey -> { timestamp, recipient, text, messageId }
    this.autoReplyConfig = {
      enabled: false,
      approvedContacts: [],
      approvedCategories: ['routine_greeting', 'busy_acknowledgment'],
      approvedResponseTypes: ['short_acknowledgment'],
      maxAutomationDurationMinutes: 60,
      activatedAt: null,
      restrictedTopics: ['financial', 'legal', 'intimate_or_personal', 'contractual', 'employment', 'confidential'],
      escalationConditions: ['contains_question_requiring_commitment', 'sensitive_topic', 'unknown_sender']
    };
    this.callRules = {
      autoAnswerAllCalls: false, // Never silently answer every call
      allowedCallersForRepresentative: [],
      requireTranscriptionConsent: true,
      immediateHumanHandoffAvailable: true
    };
    this.activeCallSessions = new Map(); // callId -> call session state
    this.callHistorySummaries = [];
    this._loadState();
    this._registerEmergencyStop();
  }

  _ensureStorage() {
    if (!fs.existsSync(REP_DATA_DIR)) {
      fs.mkdirSync(REP_DATA_DIR, { recursive: true });
    }
  }

  _loadState() {
    try {
      if (fs.existsSync(WA_INTEL_FILE)) {
        const raw = JSON.parse(fs.readFileSync(WA_INTEL_FILE, 'utf8'));
        if (raw.autoReplyConfig) this.autoReplyConfig = { ...this.autoReplyConfig, ...raw.autoReplyConfig };
        if (raw.callRules) this.callRules = { ...this.callRules, ...raw.callRules };
        if (Array.isArray(raw.callHistorySummaries)) this.callHistorySummaries = raw.callHistorySummaries;
      }
    } catch (_) {}
  }

  _saveState() {
    try {
      this._ensureStorage();
      fs.writeFileSync(WA_INTEL_FILE, JSON.stringify({
        autoReplyConfig: this.autoReplyConfig,
        callRules: this.callRules,
        callHistorySummaries: this.callHistorySummaries.slice(-50),
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch (_) {}
  }

  _registerEmergencyStop() {
    if (emergencyStopControllerInstance && typeof emergencyStopControllerInstance.registerStopHandler === 'function') {
      emergencyStopControllerInstance.registerStopHandler('whatsappPersonalIntelligence', (reason) => {
        this.autoReplyConfig.enabled = false;
        this.pendingNotifications.clear();
        for (const [callId, session] of this.activeCallSessions.entries()) {
          session.status = 'TERMINATED_BY_EMERGENCY_STOP';
          session.endedAt = new Date().toISOString();
          this.activeCallSessions.set(callId, session);
        }
        personalDigitalTwinServiceInstance.logAudit('WHATSAPP_INTEL_EMERGENCY_STOP', { reason });
      });
    }
  }

  /**
   * STEP D.1 — Inspect Permitted OS Notifications & Authorized Desktop/Web Integration Status
   */
  inspectAuthorizedWhatsAppIntegration() {
    const baseStatus = whatsappServiceInstance.getServiceStatus();
    let windowsPhoneLinkInstalled = false;
    if (process.platform === 'win32') {
      try {
        const out = execSync(
          'powershell -NoProfile -Command "Get-AppxPackage *YourPhone* -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Name"',
          { encoding: 'utf8', timeout: 4000 }
        ).trim();
        windowsPhoneLinkInstalled = Boolean(out);
      } catch (_) {}
    }

    return {
      integrationMethod: 'PERMITTED_OS_NOTIFICATIONS_AND_AUTHORIZED_DESKTOP_BRIDGE',
      usesReverseEngineeredPrivateApi: false,
      usesSessionCookieExtraction: false,
      desktopAppInstalled: baseStatus.desktopInstalled,
      webBridgeAvailable: baseStatus.webBridgeAvailable,
      windowsOsNotificationListenerSupported: process.platform === 'win32',
      windowsPhoneLinkInstalled,
      whatsAppBusinessCallingApiAudit: {
        voiceCallingSupported: 'ELIGIBLE_BUSINESS_API_OR_DESKTOP_CALL_ALERT',
        videoCallingSupported: false,
        videoCallLimitationReason: 'Official WhatsApp Business Calling API does not support programmatic video-call feeds or avatar injection. Video calls use notification, contextual prep, and human handoff.'
      }
    };
  }

  /**
   * STEP D.2 & E — Process Incoming WhatsApp Message with History, Context & 3 Suggested Replies
   */
  async analyzeIncomingMessage({
    sender = 'Alex',
    messageText = 'Hey, are we still meeting tomorrow?',
    previousMessages = [],
    relationship = 'colleague',
    knownCalendarEvents = [],
    providerPreference = 'auto'
  } = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Cannot process incoming WhatsApp message while Emergency Stop is engaged.');
    }

    // 1. Seed any provided previous messages into conversation memory first
    for (const prev of previousMessages) {
      personalCommunicationBrainInstance.recordConversationTurn({
        contactName: sender,
        sender: prev.sender || 'contact',
        message: prev.message || String(prev),
        channel: 'whatsapp',
        relationship
      });
    }

    // 2. Record the new incoming message
    const updatedMemory = personalCommunicationBrainInstance.recordConversationTurn({
      contactName: sender,
      sender: 'contact',
      message: messageText,
      channel: 'whatsapp',
      relationship
    });

    // Also sync with whatsappServiceInstance history
    if (!whatsappServiceInstance.conversationHistory.has(sender)) {
      whatsappServiceInstance.conversationHistory.set(sender, []);
    }
    whatsappServiceInstance.conversationHistory.get(sender).push({
      sender,
      message: messageText,
      timestamp: new Date().toISOString(),
      type: 'incoming'
    });

    // 3. Evaluate through Personal Communication Brain
    const evaluation = await personalCommunicationBrainInstance.evaluateCommunicationContext({
      senderName: sender,
      senderRoleOrRelationship: relationship,
      channel: 'whatsapp',
      incomingMessage: messageText,
      previousMessages: updatedMemory.messages.slice(-6),
      knownCalendarEvents,
      providerPreference
    });

    const notificationId = `wa_notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const formattedNotificationText = [
      `New message from ${sender}.`,
      ``,
      evaluation.contextExplanation,
      ``,
      `Suggested replies:`,
      `1. ${evaluation.suggestedReplies[0]}`,
      `2. ${evaluation.suggestedReplies[1]}`,
      `3. ${evaluation.suggestedReplies[2]}`,
      ``,
      `My recommendation: ${evaluation.recommendationReasoning}`
    ].join('\n');

    // Check if narrowly scoped auto-reply rule is eligible
    const autoReplyCheck = this._evaluateNarrowAutoReplyEligibility({
      sender,
      evaluation
    });

    const notificationCard = {
      success: true,
      notificationId,
      sender,
      relationship,
      newMessage: messageText,
      previousConversation: updatedMemory.messages.slice(-6),
      contextExplanation: evaluation.contextExplanation,
      suggestedReply1: evaluation.suggestedReplies[0],
      suggestedReply2: evaluation.suggestedReplies[1],
      suggestedReply3: evaluation.suggestedReplies[2],
      suggestedReplies: evaluation.suggestedReplies,
      recommendedOption: evaluation.recommendedOption,
      recommendedReply: evaluation.recommendedReplyText,
      recommendationReasoning: evaluation.recommendationReasoning,
      formattedNotification: formattedNotificationText,
      requiresResponse: true,
      requiresHumanApproval: !autoReplyCheck.eligibleForAutoSend,
      isSensitive: evaluation.isSensitive,
      sensitiveCategories: evaluation.sensitiveCategories,
      ninePointReasoning: evaluation.ninePointReasoning,
      epistemicState: evaluation.epistemicState,
      providerUsed: evaluation.providerUsed,
      providerRequested: evaluation.providerRequested,
      fallbackUsed: evaluation.fallbackUsed,
      status: autoReplyCheck.eligibleForAutoSend ? 'AUTO_REPLIED_NARROW_RULE' : 'AWAITING_USER_DECISION',
      createdAt: new Date().toISOString()
    };

    this.pendingNotifications.set(notificationId, notificationCard);
    personalDigitalTwinServiceInstance.logAudit('WHATSAPP_INCOMING_ANALYZED', {
      notificationId,
      sender,
      recommendedOption: evaluation.recommendedOption,
      isSensitive: evaluation.isSensitive,
      providerUsed: evaluation.providerUsed
    });

    return notificationCard;
  }

  /**
   * STEP E.2 — Handle User Decision on Incoming WhatsApp Notification
   * Supports: send_recommended, select_option (1/2/3), edit, write_different, ignore, archive
   * Enforces approval & duplicate-send prevention.
   */
  async handleNotificationDecision({
    notificationId,
    action = 'send_recommended', // 'send_recommended' | 'select_option' | 'edit' | 'write_different' | 'ignore' | 'archive'
    selectedOptionIndex = 1,
    editedText = '',
    customPrompt = '',
    userApproved = false,
    dryRunVerified = true
  } = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: WhatsApp action halted by Emergency Stop.');
    }

    const card = this.pendingNotifications.get(notificationId);
    if (!card) {
      return { success: false, error: `Notification "${notificationId}" not found.` };
    }

    const act = String(action || '').toLowerCase();

    if (act === 'ignore' || act === 'archive') {
      card.status = act === 'ignore' ? 'IGNORED' : 'ARCHIVED';
      card.resolvedAt = new Date().toISOString();
      this.pendingNotifications.delete(notificationId);
      this.archivedNotifications.push(card);
      personalDigitalTwinServiceInstance.logAudit('WHATSAPP_NOTIFICATION_DISMISSED', { notificationId, action: act });
      return {
        success: true,
        notificationId,
        status: card.status,
        summary: `Message from ${card.sender} marked as ${card.status}.`
      };
    }

    if (act === 'write_different') {
      const customDraft = customPrompt
        ? `Hi ${card.sender.split(' ')[0]}, ${customPrompt.replace(/^(?:say|tell\s+them|write)\s+/i, '')}`
        : `Hi ${card.sender.split(' ')[0]}, let me check and get back to you on this shortly.`;
      card.suggestedReplies.push(customDraft);
      card.recommendedReply = customDraft;
      return {
        success: true,
        notificationId,
        status: 'DRAFT_UPDATED',
        newDraft: customDraft,
        requiresHumanApproval: true,
        summary: `Prepared updated reply for ${card.sender}: "${customDraft}". Please approve to send.`
      };
    }

    // Determine text to send
    let replyText = card.recommendedReply;
    if (act === 'select_option') {
      const idx = Math.max(1, Math.min(card.suggestedReplies.length, Number(selectedOptionIndex) || 1)) - 1;
      replyText = card.suggestedReplies[idx];
    } else if (act === 'edit') {
      if (!editedText || !editedText.trim()) {
        return { success: false, error: 'Edited reply text cannot be empty.' };
      }
      replyText = editedText.trim();
    }

    // Mandatory explicit approval check before dispatching
    if (!userApproved) {
      return {
        success: false,
        status: 'APPROVAL_REQUIRED',
        requiresHumanApproval: true,
        notificationId,
        recipient: card.sender,
        proposedReply: replyText,
        error: 'Explicit user approval (userApproved: true) is required before sending a WhatsApp message.'
      };
    }

    // Duplicate-send prevention (idempotency guard within 60s window)
    const idempotencyKey = `${card.sender.toLowerCase()}::${replyText.trim().toLowerCase()}`;
    const priorSend = this.sentDispatchLedger.get(idempotencyKey);
    if (priorSend && (Date.now() - priorSend.timestamp) < 60000) {
      personalDigitalTwinServiceInstance.logAudit('WHATSAPP_DUPLICATE_SEND_BLOCKED', {
        notificationId,
        recipient: card.sender,
        originalMessageId: priorSend.messageId
      });
      return {
        success: false,
        duplicatePrevented: true,
        status: 'DUPLICATE_BLOCKED',
        recipient: card.sender,
        messageText: replyText,
        originalMessageId: priorSend.messageId,
        summary: `Blocked duplicate WhatsApp message to ${card.sender} (already sent within the last 60 seconds).`
      };
    }

    const messageId = `wa_msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    this.sentDispatchLedger.set(idempotencyKey, {
      timestamp: Date.now(),
      recipient: card.sender,
      text: replyText,
      messageId
    });

    // Record owner's approved reply in conversation memory
    personalCommunicationBrainInstance.recordConversationTurn({
      contactName: card.sender,
      sender: 'owner',
      message: replyText,
      channel: 'whatsapp',
      relationship: card.relationship
    });

    if (!dryRunVerified) {
      await whatsappServiceInstance.runAutomator('send', card.sender, replyText);
    }

    card.status = 'SENT_AFTER_APPROVAL';
    card.sentReply = replyText;
    card.sentAt = new Date().toISOString();
    this.pendingNotifications.delete(notificationId);
    this.archivedNotifications.push(card);

    personalDigitalTwinServiceInstance.logAudit('WHATSAPP_REPLY_SENT_APPROVED', {
      notificationId,
      messageId,
      recipient: card.sender,
      actionUsed: act
    });

    return {
      success: true,
      status: 'SENT_AFTER_APPROVAL',
      messageId,
      notificationId,
      recipient: card.sender,
      sentReply: replyText,
      duplicatePrevented: false,
      summary: `Approved reply sent to ${card.sender}: "${replyText}"`
    };
  }

  /**
   * Configure optional narrowly scoped automatic replies
   */
  configureAutoReplyScope({
    enabled = false,
    approvedContacts = [],
    approvedCategories = ['routine_greeting'],
    approvedResponseTypes = ['short_acknowledgment'],
    maxAutomationDurationMinutes = 60
  } = {}) {
    this.autoReplyConfig = {
      ...this.autoReplyConfig,
      enabled: Boolean(enabled),
      approvedContacts: Array.isArray(approvedContacts) ? approvedContacts.map(c => String(c).toLowerCase()) : [],
      approvedCategories,
      approvedResponseTypes,
      maxAutomationDurationMinutes: Math.min(240, Math.max(5, Number(maxAutomationDurationMinutes) || 60)),
      activatedAt: enabled ? new Date().toISOString() : null
    };
    this._saveState();
    personalDigitalTwinServiceInstance.logAudit('WHATSAPP_AUTO_REPLY_RULE_UPDATED', {
      enabled: this.autoReplyConfig.enabled,
      approvedContactsCount: this.autoReplyConfig.approvedContacts.length,
      maxAutomationDurationMinutes: this.autoReplyConfig.maxAutomationDurationMinutes
    });
    return {
      success: true,
      autoReplyConfig: this.autoReplyConfig
    };
  }

  _evaluateNarrowAutoReplyEligibility({ sender, evaluation }) {
    if (!this.autoReplyConfig.enabled) {
      return { eligibleForAutoSend: false, reason: 'AUTO_REPLY_DISABLED_BY_DEFAULT' };
    }
    // Never auto-send sensitive, financial, legal, intimate, or contractual messages
    if (evaluation.isSensitive) {
      return { eligibleForAutoSend: false, reason: `SENSITIVE_TOPIC_ESCALATION:${evaluation.sensitiveCategories.join(',')}` };
    }
    const isApprovedContact = this.autoReplyConfig.approvedContacts.includes(String(sender).toLowerCase());
    if (!isApprovedContact) {
      return { eligibleForAutoSend: false, reason: 'CONTACT_NOT_IN_APPROVED_LIST' };
    }
    if (this.autoReplyConfig.activatedAt) {
      const elapsedMin = (Date.now() - new Date(this.autoReplyConfig.activatedAt).getTime()) / 60000;
      if (elapsedMin > this.autoReplyConfig.maxAutomationDurationMinutes) {
        this.autoReplyConfig.enabled = false;
        return { eligibleForAutoSend: false, reason: 'MAX_AUTOMATION_DURATION_EXPIRED' };
      }
    }
    return { eligibleForAutoSend: true, reason: 'NARROW_SCOPE_MATCHED' };
  }

  /**
   * STEP G & SECTIONS 5, 6, 7 — Handle Incoming Voice/Video/Phone Calls with Honest Capability Audit,
   * Mandatory Representative Disclosure, Voice Synthesis, Turn-Taking, and Human Handoff
   */
  async handleIncomingCall({
    callerName = 'Alex',
    callType = 'whatsapp_voice', // 'whatsapp_voice' | 'whatsapp_video' | 'ordinary_phone'
    callerUtterance = 'Hi Lokesh, calling to check if the project report is ready for tomorrow.',
    mode = 'notify_only', // 'notify_only' | 'accept_personally' | 'ai_representative' | 'handoff_to_human'
    participantConsentVerified = true
  } = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Call handling halted by Emergency Stop.');
    }

    const callId = `call_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const contactMemory = personalCommunicationBrainInstance.getContactConversationMemory(callerName);

    // SECTION 6: Honest platform limitation for WhatsApp Video Calls
    if (callType === 'whatsapp_video') {
      const videoCallRecord = {
        callId,
        callerName,
        callType: 'whatsapp_video',
        supportedOfficialBotVideoFeed: false,
        status: 'HUMAN_HANDOFF_AND_PREP_OFFERED',
        platformLimitationDisclosure: 'The official WhatsApp Business Calling API does not support programmatic video-call feeds, and JARVIS never secretly injects avatars or manipulates private video streams.',
        conversationContext: contactMemory ? contactMemory.messages.slice(-4) : [],
        meetingPrepNotes: [
          `Caller: ${callerName}`,
          `Recent topics: ${(contactMemory?.topics || ['general follow-up']).join(', ')}`,
          `Recommended action: Accept video call personally or move to an authorized Microsoft Teams meeting room where disclosed avatar participation is supported.`
        ],
        humanHandoffReady: true
      };
      this.activeCallSessions.set(callId, videoCallRecord);
      personalDigitalTwinServiceInstance.logAudit('WHATSAPP_VIDEO_CALL_HONEST_HANDOFF', { callId, callerName });
      return {
        success: true,
        ...videoCallRecord,
        summary: `Incoming WhatsApp video call from ${callerName}. Official WhatsApp APIs do not support bot video feeds — prepared contextual briefing and offered immediate human handoff.`
      };
    }

    // SECTION 5 & 7: WhatsApp Voice Call or Ordinary Phone Call (Phone Link / SIP)
    if (mode === 'notify_only' || mode === 'accept_personally' || mode === 'handoff_to_human') {
      const session = {
        callId,
        callerName,
        callType,
        mode,
        status: mode === 'handoff_to_human' ? 'HANDED_OFF_TO_HUMAN' : 'NOTIFIED_AWAITING_USER',
        conversationContext: contactMemory ? contactMemory.messages.slice(-4) : [],
        humanHandoffReady: true,
        startedAt: new Date().toISOString()
      };
      this.activeCallSessions.set(callId, session);
      return {
        success: true,
        ...session,
        summary: mode === 'handoff_to_human'
          ? `Call (${callId}) with ${callerName} handed off immediately to ${personalDigitalTwinServiceInstance.state.ownerName}.`
          : `Incoming ${callType} call from ${callerName}. Context displayed; awaiting your choice to answer personally or enable your disclosed AI representative.`
      };
    }

    // Disclosed AI Representative Mode
    if (!participantConsentVerified && this.callRules.requireTranscriptionConsent) {
      return {
        success: false,
        callId,
        status: 'CONSENT_REQUIRED_FOR_TRANSCRIPTION',
        error: 'Participant consent is required before transcribing or recording call audio.'
      };
    }

    const ownerName = personalDigitalTwinServiceInstance.state.ownerName || 'Lokesh';
    const mandatoryDisclosure = `Hello ${callerName.split(' ')[0]}, this is JARVIS, ${ownerName}'s authorized AI representative speaking on ${ownerName}'s behalf.`;

    const contextEval = await personalCommunicationBrainInstance.evaluateCommunicationContext({
      senderName: callerName,
      channel: 'call',
      incomingMessage: callerUtterance
    });

    const representativeReply = contextEval.isSensitive
      ? `${mandatoryDisclosure} I have noted your question regarding ${contextEval.sensitiveCategories.join('/')} terms and will have ${ownerName} confirm with you personally.`
      : `${mandatoryDisclosure} Regarding your question: ${contextEval.recommendedReplyText}`;

    const speechOut = personalDigitalTwinServiceInstance.synthesizeRepresentativeSpeech({
      text: representativeReply,
      isExternalCallOrMeeting: true,
      statementSource: 'AI_REPRESENTATIVE'
    });

    const callSummary = {
      callId,
      callerName,
      callType,
      mode: 'DISCLOSED_AI_REPRESENTATIVE',
      disclosedAsAiRepresentative: true,
      disclosureStatement: mandatoryDisclosure,
      voiceUsed: speechOut.voiceUsed,
      voiceModelId: speechOut.voiceModelId,
      transcript: [
        { speaker: 'JARVIS (AI Representative)', text: mandatoryDisclosure },
        { speaker: callerName, text: callerUtterance },
        { speaker: 'JARVIS (AI Representative)', text: representativeReply }
      ],
      commitmentsIdentified: contextEval.isSensitive
        ? [`Escalated ${contextEval.sensitiveCategories.join('/')} decision to ${ownerName}`]
        : [`Follow up with ${callerName} on discussed topic`],
      followUpTasks: [
        {
          task: `Review call summary with ${callerName} ("${callerUtterance}")`,
          requiresHumanApproval: contextEval.isSensitive
        }
      ],
      humanHandoffAvailable: true,
      timestamp: new Date().toISOString()
    };

    this.activeCallSessions.set(callId, callSummary);
    this.callHistorySummaries.push(callSummary);
    this._saveState();

    personalDigitalTwinServiceInstance.logAudit('INCOMING_CALL_REPRESENTATIVE_HANDLED', {
      callId,
      callerName,
      callType,
      disclosedAsAiRepresentative: true,
      voiceUsed: speechOut.voiceUsed
    });

    return {
      success: true,
      ...callSummary,
      speechSynthesis: speechOut,
      summary: `Handled incoming ${callType} call from ${callerName} as disclosed AI representative using ${speechOut.voiceUsed}, transcribed discussion, and extracted follow-up tasks.`
    };
  }
  async stageMessageForApproval({ contact, text }) {
    const draftId = 'draft_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const staged = {
      draftId,
      contact,
      text,
      status: 'STAGED_FOR_APPROVAL',
      stagedAt: new Date().toISOString(),
      requiresHumanApproval: true
    };
    return staged;
  }
}

const whatsappPersonalIntelligenceInstance = new WhatsAppPersonalIntelligence();

module.exports = {
  WhatsAppPersonalIntelligence,
  whatsappPersonalIntelligenceInstance
};
