/**
 * JARVIS — Transparent AI Video Meeting Representative Service
 * Official AI Identity: VISION — MADE BY LOKESH | Assistant: JARVIS
 *
 * Implements Dependency Steps H & I + Sections 4 & 5 (Office Executive) + Section 8 (Digital Twin):
 * - Joins authorized Microsoft Teams & WebRTC meeting rooms as a clearly disclosed AI Representative.
 * - Verifies explicit owner authorization for Personal Avatar and Personal Voice Model.
 * - Enforces participant consent before recording or transcribing meeting speech.
 * - Enforces strict Meeting Decision & Authority Rules:
 *   * Permitted within authority: pre-approved facts, approved project updates, known progress,
 *     taking notes, asking clarifying questions, proposing follow-up schedules.
 *   * Mandatory escalation to human BEFORE: contractual commitments, prices/financial terms,
 *     job offers/legal terms, hiring/employment decisions, confidential disclosures,
 *     payment approvals, personal promises, or personal judgment questions.
 * - Explicitly distinguishes AI-generated responses from human-approved statements.
 * - Extracts structured notes, action items & deadlines, generates meeting minutes,
 *   post-meeting summaries, and follow-up email drafts.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { personalDigitalTwinServiceInstance } = require('./personalDigitalTwinService.js');
const { personalCommunicationBrainInstance } = require('./personalCommunicationBrain.js');
const { outlookGraphServiceInstance } = require('./outlookGraphService.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const REP_DATA_DIR = path.resolve('D:\\Jarvis\\data\\representative');
const MEETINGS_STATE_FILE = path.join(REP_DATA_DIR, 'meeting_representative_state.json');

const ESCALATION_TRIGGERS = [
  { rule: 'contractual_commitment', regex: /\b(sign\s+contract|binding\s+commitment|guarantee\s+delivery|exclusivity\s+clause|contractual|sla\s+penalty)\b/i },
  { rule: 'financial_or_pricing_terms', regex: /\b(agree\s+to\s+the\s+price|pricing|discount|quote|fee|₹|\$\d+|budget\s+approval|cost\s+terms|retainer\s+amount)\b/i },
  { rule: 'job_offer_or_legal_terms', regex: /\b(accept.*job\s+offer|employment\s+contract|nda\s+terms|liability|indemnity|waiver|legal\s+settlement)\b/i },
  { rule: 'hiring_or_employment_decision', regex: /\b(hire|hiring\s+decision|terminate|fire|candidate\s+selection|salary\s+offer|compensation\s+package)\b/i },
  { rule: 'confidential_disclosure', regex: /\b(share.*private\s+key|confidential\s+source|unreleased\s+ip|proprietary\s+weights|secret\s+roadmap|passwords?)\b/i },
  { rule: 'payment_approval', regex: /\b(approve.*payment|wire\s+transfer|release\s+funds|authorize\s+invoice|pay\s+now)\b/i },
  { rule: 'personal_promise', regex: /\b(personal\s+promise|do\s+you\s+personally\s+swear|commit\s+your\s+weekend|personal\s+guarantee)\b/i },
  { rule: 'personal_judgment', regex: /\b(what\s+is\s+lokesh's\s+personal\s+opinion|how\s+do\s+you\s+personally\s+feel\s+about\s+the\s+ceo|strategic\s+pivot\s+decision)\b/i }
];

class AiMeetingRepresentativeService {
  constructor() {
    this._ensureStorage();
    this.activeMeetings = new Map(); // meetingId -> session object
    this.completedMeetings = [];
    this.pendingHumanDecisions = new Map(); // decisionId -> escalation object
    this.approvedKnowledgeBase = {
      ownerName: 'Lokesh Upadhyay',
      approvedFacts: [
        'VISION v1.2 multimodal benchmark validation is currently on schedule for Friday completion.',
        'The 6-DOF robotic arm kinematic solver and BOM calculator passed all 22 automated verification tests.',
        'JARVIS operates on a local-first D: drive storage architecture with strict permission gating.'
      ],
      approvedProjectUpdates: [
        'Completed Unified VISION + Gemini provider routing with transparent model attribution.',
        'Completed Universal Windows Desktop Launcher, Chrome Profile automation, and Live Latest News pipeline.',
        'Completed Personal Digital Twin face/voice enrollment and Outlook Graph OAuth integration.'
      ]
    };
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
      if (fs.existsSync(MEETINGS_STATE_FILE)) {
        const raw = JSON.parse(fs.readFileSync(MEETINGS_STATE_FILE, 'utf8'));
        if (Array.isArray(raw.completedMeetings)) this.completedMeetings = raw.completedMeetings;
        if (raw.approvedKnowledgeBase) {
          this.approvedKnowledgeBase = { ...this.approvedKnowledgeBase, ...raw.approvedKnowledgeBase };
        }
        if (Array.isArray(raw.pendingHumanDecisions)) {
          for (const d of raw.pendingHumanDecisions) {
            this.pendingHumanDecisions.set(d.decisionId, d);
          }
        }
      }
    } catch (_) {}
  }

  _saveState() {
    try {
      this._ensureStorage();
      fs.writeFileSync(MEETINGS_STATE_FILE, JSON.stringify({
        approvedKnowledgeBase: this.approvedKnowledgeBase,
        activeMeetings: Array.from(this.activeMeetings.values()),
        completedMeetings: this.completedMeetings.slice(-30),
        pendingHumanDecisions: Array.from(this.pendingHumanDecisions.values()),
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch (_) {}
  }

  _registerEmergencyStop() {
    if (emergencyStopControllerInstance && typeof emergencyStopControllerInstance.registerStopHandler === 'function') {
      emergencyStopControllerInstance.registerStopHandler('aiMeetingRepresentative', (reason) => {
        for (const [meetingId, session] of this.activeMeetings.entries()) {
          session.status = 'TERMINATED_BY_EMERGENCY_STOP';
          session.endedAt = new Date().toISOString();
          this.completedMeetings.push(session);
        }
        this.activeMeetings.clear();
        this._saveState();
        personalDigitalTwinServiceInstance.logAudit('MEETING_REP_EMERGENCY_STOP', { reason });
      });
    }
  }

  /**
   * STEP H.1 — Join an Authorized Microsoft Teams / Online Meeting as a Disclosed AI Representative
   */
  joinAuthorizedMeeting({
    meetingTitle = 'Apex Robotics Q4 Architecture Review',
    platform = 'microsoft_teams', // 'microsoft_teams' | 'webrtc_controlled_room' | 'google_meet'
    joinUrl = 'https://teams.microsoft.com/l/meetup-join/jarvis-controlled-test-room-001',
    participants = ['Vikram Mehta', 'Ananya Rao'],
    userAuthorizedJoin = true,
    participantConsentVerified = true,
    useAuthorizedAvatar = true,
    useAuthorizedVoice = true
  } = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Cannot join meeting while Emergency Stop is engaged.');
    }
    if (!userAuthorizedJoin) {
      throw new Error('Explicit user authorization is required before JARVIS can join an online meeting.');
    }

    const twinStatus = personalDigitalTwinServiceInstance.getStatus();
    const ownerName = twinStatus.ownerName || 'Lokesh Upadhyay';

    // Check avatar & voice authorization
    const avatarReady = Boolean(useAuthorizedAvatar && twinStatus.avatar.enrolled && twinStatus.avatar.approvedByOwner && twinStatus.avatar.enabled);
    const voiceReady = Boolean(useAuthorizedVoice && twinStatus.voice.enrolled && twinStatus.voice.approvedByOwner);

    const meetingId = `mtg_rep_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const aiParticipantDisplayName = `JARVIS (AI Representative for ${ownerName})`;
    const disclosureStatement = `Hello everyone, I am JARVIS, joining as ${ownerName}'s authorized AI Representative. I am an AI participant using ${ownerName}'s authorized digital twin profile to share approved project updates, take structured notes, and escalate any decisions requiring ${ownerName}'s personal judgment.`;

    // Generate initial spoken disclosure & avatar lip-sync frame
    const openingSpeech = personalDigitalTwinServiceInstance.synthesizeRepresentativeSpeech({
      text: disclosureStatement,
      language: 'en',
      emotion: 'warm',
      isExternalCallOrMeeting: true,
      statementSource: 'AI_REPRESENTATIVE'
    });

    const session = {
      meetingId,
      meetingTitle,
      platform,
      joinUrl,
      ownerName,
      aiParticipantDisplayName,
      disclosedAsAiRepresentative: true,
      deceptiveImpersonationBlocked: true,
      aiDisclosureStatement: disclosureStatement,
      participantConsentVerified: Boolean(participantConsentVerified),
      avatarActive: avatarReady,
      avatarId: avatarReady ? twinStatus.avatar.avatarId : null,
      voiceActive: voiceReady ? 'PERSONAL_ENROLLED_VOICE' : 'NEUTRAL_FALLBACK_VOICE',
      voiceModelId: voiceReady ? twinStatus.voice.voiceModelId : twinStatus.voice.fallbackVoiceId,
      participants,
      status: 'ACTIVE_IN_MEETING',
      joinedAt: new Date().toISOString(),
      transcript: [
        {
          entryId: `tr_${Date.now()}_0`,
          timestamp: new Date().toISOString(),
          speaker: aiParticipantDisplayName,
          statementSource: 'AI_REPRESENTATIVE_DISCLOSURE',
          text: disclosureStatement
        }
      ],
      structuredNotes: [
        `Joined "${meetingTitle}" on ${platform} as disclosed AI Representative (${aiParticipantDisplayName}).`
      ],
      actionItems: [],
      escalatedQuestions: [],
      openingSpeech
    };

    this.activeMeetings.set(meetingId, session);
    this._saveState();

    personalDigitalTwinServiceInstance.logAudit('MEETING_JOINED_AS_DISCLOSED_AI', {
      meetingId,
      meetingTitle,
      platform,
      aiParticipantDisplayName,
      disclosedAsAiRepresentative: true,
      avatarActive: avatarReady,
      voiceActive: session.voiceActive,
      participantConsentVerified: session.participantConsentVerified
    });

    return {
      success: true,
      ...session,
      summary: `Joined "${meetingTitle}" (${platform}) as "${aiParticipantDisplayName}". Broadcasted mandatory AI participant disclosure with ${session.voiceActive} and avatarActive=${avatarReady}.`
    };
  }

  /**
   * STEP H.2 — Transcribe Meeting Speech (Requires Participant Consent) & Extract Action Items
   */
  transcribeMeetingSegment({
    meetingId,
    speaker = 'Vikram Mehta',
    utterance = '',
    timestamp = null
  } = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Meeting transcription halted by Emergency Stop.');
    }

    const session = this.activeMeetings.get(meetingId);
    if (!session) {
      throw new Error(`Active meeting session "${meetingId}" not found.`);
    }
    if (!session.participantConsentVerified) {
      throw new Error('Participant consent is required before transcribing meeting audio.');
    }

    const cleanText = String(utterance || '').trim();
    const entry = {
      entryId: `tr_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      timestamp: timestamp || new Date().toISOString(),
      speaker,
      statementSource: 'MEETING_PARTICIPANT',
      text: cleanText
    };
    session.transcript.push(entry);

    // Extract structured notes
    if (cleanText.length > 10) {
      session.structuredNotes.push(`${speaker}: ${cleanText}`);
    }

    // Extract action items and deadlines automatically
    const actionMatch = cleanText.match(/\b(?:action\s+item|please\s+send|need\s+to\s+complete|deliver|prepare|schedule|by\s+(?:friday|monday|tomorrow|next\s+week|eod|\d{4}-\d{2}-\d{2}))\b/i);
    if (actionMatch) {
      const deadlineMatch = cleanText.match(/\bby\s+(friday|monday|tuesday|wednesday|thursday|tomorrow|next\s+week|eod|\d{4}-\d{2}-\d{2})\b/i);
      const ownerMatch = cleanText.match(/\b(lokesh|vikram|ananya|team)\b/i);
      const item = {
        actionId: `act_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        description: cleanText,
        assignedTo: ownerMatch ? ownerMatch[1] : session.ownerName,
        deadline: deadlineMatch ? deadlineMatch[1] : 'Upcoming milestone',
        reportedBy: speaker,
        extractedAt: new Date().toISOString()
      };
      session.actionItems.push(item);
    }

    this.activeMeetings.set(meetingId, session);
    this._saveState();

    personalDigitalTwinServiceInstance.logAudit('MEETING_SPEECH_TRANSCRIBED', {
      meetingId,
      speaker,
      actionItemsExtracted: session.actionItems.length
    });

    return {
      success: true,
      meetingId,
      transcriptEntry: entry,
      totalTranscriptEntries: session.transcript.length,
      actionItemsCount: session.actionItems.length,
      latestActionItem: session.actionItems[session.actionItems.length - 1] || null
    };
  }

  /**
   * STEP H.3 & SECTION 5 — Evaluate Question in Meeting, Share Approved Facts, or Escalate to Human
   */
  async evaluateAndRespondInMeeting({
    meetingId,
    askedBy = 'Vikram Mehta',
    questionText = '',
    humanApprovedStatement = null,
    providerPreference = 'auto'
  } = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Meeting response halted by Emergency Stop.');
    }

    const session = this.activeMeetings.get(meetingId);
    if (!session) {
      throw new Error(`Active meeting session "${meetingId}" not found.`);
    }

    // Record the incoming question in the transcript first
    this.transcribeMeetingSegment({
      meetingId,
      speaker: askedBy,
      utterance: questionText
    });

    // If the human owner has explicitly provided a personally approved statement for this turn:
    if (humanApprovedStatement) {
      const taggedText = `[Personally Approved by ${session.ownerName}]: ${humanApprovedStatement}`;
      const speech = personalDigitalTwinServiceInstance.synthesizeRepresentativeSpeech({
        text: humanApprovedStatement,
        isExternalCallOrMeeting: true,
        statementSource: 'HUMAN_APPROVED_STATEMENT'
      });
      session.transcript.push({
        entryId: `tr_${Date.now()}_human`,
        timestamp: new Date().toISOString(),
        speaker: session.aiParticipantDisplayName,
        statementSource: 'HUMAN_APPROVED_STATEMENT',
        text: taggedText
      });
      this._saveState();
      personalDigitalTwinServiceInstance.logAudit('MEETING_HUMAN_APPROVED_STATEMENT_DELIVERED', {
        meetingId,
        askedBy
      });
      return {
        success: true,
        meetingId,
        escalatedToHuman: false,
        requiresHumanApproval: false,
        statementSource: 'HUMAN_APPROVED_STATEMENT',
        responseDelivered: taggedText,
        speechSynthesis: speech
      };
    }

    // Check against Section 5 Mandatory Human Escalation Rules
    const triggeredEscalations = [];
    for (const trig of ESCALATION_TRIGGERS) {
      if (trig.regex.test(questionText)) {
        triggeredEscalations.push(trig.rule);
      }
    }

    if (triggeredEscalations.length > 0) {
      const decisionId = `mtg_esc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const holdingResponse = `[AI Representative - Escalated for Human Decision]: Thank you, ${askedBy.split(' ')[0]}. Because this question involves ${triggeredEscalations.join(', ').replace(/_/g, ' ')}, it requires ${session.ownerName}'s direct personal approval. I have flagged this in Mission Control for ${session.ownerName} right now.`;

      const escalationRecord = {
        decisionId,
        meetingId,
        meetingTitle: session.meetingTitle,
        askedBy,
        questionText,
        triggeredRules: triggeredEscalations,
        requiresHumanApproval: true,
        status: 'AWAITING_HUMAN_DECISION',
        holdingResponseDelivered: holdingResponse,
        createdAt: new Date().toISOString()
      };

      session.escalatedQuestions.push(escalationRecord);
      this.pendingHumanDecisions.set(decisionId, escalationRecord);

      session.transcript.push({
        entryId: `tr_${Date.now()}_esc`,
        timestamp: new Date().toISOString(),
        speaker: session.aiParticipantDisplayName,
        statementSource: 'AI_REPRESENTATIVE_ESCALATION_HOLD',
        text: holdingResponse
      });

      const speech = personalDigitalTwinServiceInstance.synthesizeRepresentativeSpeech({
        text: holdingResponse,
        isExternalCallOrMeeting: true,
        statementSource: 'AI_REPRESENTATIVE'
      });

      this._saveState();
      personalDigitalTwinServiceInstance.logAudit('MEETING_QUESTION_ESCALATED_TO_HUMAN', {
        meetingId,
        decisionId,
        askedBy,
        triggeredRules: triggeredEscalations
      });

      return {
        success: true,
        meetingId,
        decisionId,
        escalatedToHuman: true,
        requiresHumanApproval: true,
        triggeredRules: triggeredEscalations,
        statementSource: 'AI_REPRESENTATIVE',
        responseDelivered: holdingResponse,
        speechSynthesis: speech,
        summary: `Escalated question from ${askedBy} ("${questionText}") to ${session.ownerName} due to [${triggeredEscalations.join(', ')}]. Delivered polite holding response without making unauthorized commitments.`
      };
    }

    // Permitted within authority: share pre-approved factual information or project updates
    const relevantFact = this.approvedKnowledgeBase.approvedFacts.find(f => {
      const words = questionText.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      return words.some(w => f.toLowerCase().includes(w));
    }) || this.approvedKnowledgeBase.approvedProjectUpdates[0];

    const brainEval = await personalCommunicationBrainInstance.evaluateCommunicationContext({
      senderName: askedBy,
      channel: 'meeting',
      incomingMessage: questionText,
      knownFacts: [relevantFact],
      providerPreference
    });

    const authorizedResponse = `[AI Representative - Pre-Approved Project Update]: Based on ${session.ownerName}'s verified project records, ${relevantFact}`;
    const speech = personalDigitalTwinServiceInstance.synthesizeRepresentativeSpeech({
      text: authorizedResponse,
      isExternalCallOrMeeting: true,
      statementSource: 'AI_REPRESENTATIVE'
    });

    session.transcript.push({
      entryId: `tr_${Date.now()}_ai`,
      timestamp: new Date().toISOString(),
      speaker: session.aiParticipantDisplayName,
      statementSource: 'AI_REPRESENTATIVE_AUTHORIZED_FACT',
      text: authorizedResponse,
      providerUsed: brainEval.providerUsed
    });
    this._saveState();

    personalDigitalTwinServiceInstance.logAudit('MEETING_AUTHORIZED_UPDATE_SHARED', {
      meetingId,
      askedBy,
      providerUsed: brainEval.providerUsed
    });

    return {
      success: true,
      meetingId,
      escalatedToHuman: false,
      requiresHumanApproval: false,
      statementSource: 'AI_REPRESENTATIVE_AUTHORIZED_FACT',
      responseDelivered: authorizedResponse,
      providerUsed: brainEval.providerUsed,
      providerRequested: brainEval.providerRequested,
      speechSynthesis: speech,
      summary: `Shared pre-approved factual project update with ${askedBy} (distinguished as AI Representative output).`
    };
  }

  /**
   * STEP H.4 — Generate Structured Meeting Minutes, Post-Meeting Summary & Follow-Up Email Draft
   */
  async generateMeetingMinutesAndSummary({ meetingId, endMeeting = true } = {}) {
    const session = this.activeMeetings.get(meetingId) || this.completedMeetings.find(m => m.meetingId === meetingId);
    if (!session) {
      throw new Error(`Meeting "${meetingId}" not found.`);
    }

    const minutesDocument = {
      minutesId: `min_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      meetingId: session.meetingId,
      meetingTitle: session.meetingTitle,
      platform: session.platform,
      date: session.joinedAt,
      participants: [session.aiParticipantDisplayName, ...session.participants],
      aiDisclosureVerified: session.disclosedAsAiRepresentative,
      keyDiscussionPoints: session.structuredNotes,
      actionItems: session.actionItems,
      escalatedDecisionsPendingOwner: session.escalatedQuestions.map(q => ({
        decisionId: q.decisionId,
        askedBy: q.askedBy,
        question: q.questionText,
        rules: q.triggeredRules,
        status: q.status
      })),
      postMeetingSummary: `Meeting "${session.meetingTitle}" concluded with ${session.transcript.length} recorded turns, ${session.actionItems.length} extracted action item(s), and ${session.escalatedQuestions.length} item(s) escalated for ${session.ownerName}'s personal decision.`
    };

    // Stage follow-up email draft if Outlook is connected
    let followUpDraft = null;
    if (outlookGraphServiceInstance.connected) {
      followUpDraft = await outlookGraphServiceInstance.draftReply({
        keyPoints: [
          `Thank you for attending "${session.meetingTitle}".`,
          `Summary: ${minutesDocument.postMeetingSummary}`,
          session.actionItems.length > 0
            ? `Action Items: ${session.actionItems.map(a => `${a.description} (Owner: ${a.assignedTo}, Due: ${a.deadline})`).join('; ')}`
            : 'All discussed updates have been logged.'
        ]
      });
    }

    if (endMeeting && this.activeMeetings.has(meetingId)) {
      session.status = 'COMPLETED';
      session.endedAt = new Date().toISOString();
      session.minutes = minutesDocument;
      this.activeMeetings.delete(meetingId);
      this.completedMeetings.push(session);
      this._saveState();
    }

    personalDigitalTwinServiceInstance.logAudit('MEETING_MINUTES_GENERATED', {
      meetingId: session.meetingId,
      actionItemsCount: session.actionItems.length,
      escalationsCount: session.escalatedQuestions.length
    });

    return {
      success: true,
      minutes: minutesDocument,
      followUpEmailDraft: followUpDraft,
      summary: minutesDocument.postMeetingSummary
    };
  }
}

const aiMeetingRepresentativeServiceInstance = new AiMeetingRepresentativeService();

module.exports = {
  AiMeetingRepresentativeService,
  aiMeetingRepresentativeServiceInstance
};
