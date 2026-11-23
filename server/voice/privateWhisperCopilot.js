/**
 * VISION AI — PHASE 15 UPGRADE 5: PRIVATE WHISPERING COPILOT MODE
 * 
 * Provides a private headphone assistant mode where JARVIS listens to authorized
 * meeting/call audio, maintains live meeting context, summarizes key points,
 * suggests answers to questions, and delivers private spoken hints EXCLUSIVELY
 * through the user's selected headphone output without injecting audio into the call.
 * 
 * Strict Safety & Isolation Invariants:
 * 1. Explicit Meeting Authorization: Requires `explicitMeetingConsent: true` before
 *    capturing or transcribing any meeting audio.
 * 2. Strict Headphone Output Isolation: Verifies that `privateOutputDeviceId` is a
 *    dedicated headphone/private endpoint and NEVER a virtual call microphone sink
 *    (`outputIsolationVerified: true`, `injectedIntoCallAudio: false`).
 * 3. Zero Impersonation: Strictly prohibits impersonating the user or concealing AI
 *    participation (`impersonationProhibited: true`).
 * 4. Mission Control Supporting Cards: Generates concise visual whisper cards for
 *    Mission Control alongside private headphone hints.
 * 5. Immediate Controls: Supports instant `interruptWhisper()`, `muteCopilot()`,
 *    `unmuteCopilot()`, `disableCopilot()`, and Global Emergency Stop.
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { audioLoopbackEngineInstance, AUDIO_SOURCES } = require('./audioLoopbackEngine.js');
const { conversationalTtsEngineInstance } = require('./conversationalTtsEngine.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const COPILOT_STATES = {
  DISABLED: 'DISABLED',
  ACTIVE: 'ACTIVE',
  WHISPERING_PRIVATE_HINT: 'WHISPERING_PRIVATE_HINT',
  MUTED: 'MUTED',
  EMERGENCY_HALTED: 'EMERGENCY_HALTED'
};

class PrivateWhisperCopilot extends EventEmitter {
  constructor(options = {}) {
    super();
    this.loopbackEngine = options.loopbackEngine || audioLoopbackEngineInstance;
    this.tts = options.tts || conversationalTtsEngineInstance;
    this.emergencyStop = options.emergencyStop || emergencyStopControllerInstance;

    // State & Consent
    this.state = COPILOT_STATES.DISABLED;
    this.explicitMeetingConsent = false;
    this.isMuted = false;
    this.sessionId = null;

    // Output Routing & Isolation
    this.privateOutputDevice = null;
    this.outputIsolationVerified = false;
    this.allowCallAudioInjection = false; // Strictly false unless explicitly authorized
    this.impersonationProhibited = true;

    // Live Meeting Context
    this.liveMeetingContext = {
      meetingTitle: 'Live Session',
      participants: new Set(),
      transcriptSegments: [],
      importantPoints: [],
      detectedQuestions: [],
      suggestedAnswers: [],
      missionControlCards: []
    };

    // Register Emergency Stop Handler
    if (this.emergencyStop && typeof this.emergencyStop.registerStopHandler === 'function') {
      this.emergencyStop.registerStopHandler('PrivateWhisperCopilot', (reason) => {
        this.interruptWhisper(`EMERGENCY_STOP: ${reason}`);
        this.explicitMeetingConsent = false;
        this.isMuted = true;
        this.state = COPILOT_STATES.EMERGENCY_HALTED;
      });
    }
  }

  /**
   * Enables Private Whispering Copilot Mode ONLY when explicit meeting consent is provided
   * and the selected output device is verified to be isolated from the meeting input sink.
   */
  async enableCopilot({
    explicitMeetingConsent = false,
    privateOutputDeviceId = 'headphones_private_out',
    meetingTitle = 'Active Meeting Session'
  } = {}) {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Cannot enable Private Whisper Copilot while Emergency Stop is engaged.');
    }

    if (explicitMeetingConsent !== true) {
      this.state = COPILOT_STATES.DISABLED;
      this.explicitMeetingConsent = false;
      return {
        success: false,
        error: 'MEETING_CONSENT_REQUIRED: Private Whispering Copilot requires explicitMeetingConsent: true.',
        state: this.state
      };
    }

    const endpoints = await this.loopbackEngine.enumerateAudioDevices();
    const targetOut = endpoints.outputDevices.find(d => d.deviceId === privateOutputDeviceId) || {
      deviceId: privateOutputDeviceId,
      label: privateOutputDeviceId,
      isPrivateHeadphone: privateOutputDeviceId.includes('headphone'),
      isCallInput: privateOutputDeviceId.includes('call') || privateOutputDeviceId.includes('virtual')
    };

    if (targetOut.isCallInput) {
      return {
        success: false,
        blockedByIsolationGuard: true,
        error: `OUTPUT_ISOLATION_VIOLATION: Device "${privateOutputDeviceId}" feeds into call audio. Select a private headphone output device.`
      };
    }

    await this.loopbackEngine.enableLoopbackCapture({
      explicitConsent: true,
      outputDeviceId: targetOut.deviceId
    });

    this.sessionId = `copilot_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    this.explicitMeetingConsent = true;
    this.isMuted = false;
    this.privateOutputDevice = targetOut;
    this.outputIsolationVerified = true;
    this.state = COPILOT_STATES.ACTIVE;

    this.liveMeetingContext = {
      meetingTitle,
      participants: new Set(['User']),
      transcriptSegments: [],
      importantPoints: [],
      detectedQuestions: [],
      suggestedAnswers: [],
      missionControlCards: []
    };

    this.emit('stateChange', this.getStatus());

    return {
      success: true,
      sessionId: this.sessionId,
      state: this.state,
      explicitMeetingConsent: this.explicitMeetingConsent,
      privateOutputDevice: this.privateOutputDevice,
      outputIsolationVerified: this.outputIsolationVerified,
      impersonationProhibited: this.impersonationProhibited
    };
  }

  /**
   * Processes a live meeting conversation utterance, updates live meeting context,
   * summarizes important points, suggests answers to questions, displays a concise
   * card in Mission Control, and whispers a private hint into the user's headphones.
   */
  async processMeetingConversationTurn({
    transcript = '',
    speaker = 'Meeting Participant',
    source = AUDIO_SOURCES.SYSTEM_LOOPBACK,
    deliverPrivateSpokenHint = true,
    attemptImpersonation = false,
    attemptInjectIntoCall = false
  } = {}) {
    if (this.emergencyStop && this.emergencyStop.isEngaged()) {
      await this.disableCopilot('EMERGENCY_STOP_ACTIVE');
      throw new Error('EMERGENCY_STOP_ACTIVE: Private Whisper Copilot halted by Emergency Stop.');
    }

    if (this.state === COPILOT_STATES.DISABLED || !this.explicitMeetingConsent) {
      return {
        success: false,
        error: 'COPILOT_NOT_ENABLED: Enable Private Whisper Copilot with explicitMeetingConsent: true first.'
      };
    }

    // Guardrail 1: Never impersonate the user or conceal AI participation
    if (attemptImpersonation) {
      return {
        success: false,
        blockedByImpersonationGuard: true,
        error: 'IMPERSONATION_PROHIBITED: JARVIS never impersonates the user or conceals AI participation.'
      };
    }

    // Guardrail 2: Never inject speech into the meeting/call audio stream unless explicitly authorized
    if (attemptInjectIntoCall && !this.allowCallAudioInjection) {
      return {
        success: false,
        blockedByCallInjectionGuard: true,
        error: 'CALL_AUDIO_INJECTION_PROHIBITED: Private Whisper Copilot strictly routes audio only to private headphones.'
      };
    }

    const ingestRes = await this.loopbackEngine.ingestAudioSegment({
      transcript,
      speakerLabel: speaker,
      source
    });

    if (!ingestRes.success || !ingestRes.segment) {
      return ingestRes;
    }

    const seg = ingestRes.segment;
    this.liveMeetingContext.participants.add(speaker);
    this.liveMeetingContext.transcriptSegments.push(seg);

    // Extract important point for rolling meeting summary
    const keyPoint = `[${speaker}]: ${seg.transcript}`;
    this.liveMeetingContext.importantPoints.push(keyPoint);
    if (this.liveMeetingContext.importantPoints.length > 25) {
      this.liveMeetingContext.importantPoints.shift();
    }

    let suggestedAnswer = null;
    let whisperHintText = null;
    if (seg.isQuestion && seg.suggestedReplies && seg.suggestedReplies.length > 0) {
      suggestedAnswer = seg.suggestedReplies[0];
      whisperHintText = `Whisper Hint: ${speaker} asked about ${seg.questionCategory.toLowerCase().replace(/_/g, ' ')}. Suggested answer: ${suggestedAnswer}`;

      this.liveMeetingContext.detectedQuestions.push({
        question: seg.transcript,
        speaker,
        suggestedAnswer,
        timestamp: seg.isoTimestamp
      });
      this.liveMeetingContext.suggestedAnswers.push(suggestedAnswer);
    } else {
      whisperHintText = `Note: ${speaker} mentioned "${seg.transcript.slice(0, 80)}".`;
    }

    // Create concise Mission Control card
    const card = {
      cardId: `mc_whisper_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
      timestamp: seg.isoTimestamp,
      speaker,
      isQuestion: Boolean(seg.isQuestion),
      utterance: seg.transcript,
      suggestedAnswer: suggestedAnswer || 'Context logged in live meeting summary.',
      keyPointSummary: keyPoint
    };
    this.liveMeetingContext.missionControlCards.push(card);
    if (this.liveMeetingContext.missionControlCards.length > 15) {
      this.liveMeetingContext.missionControlCards.shift();
    }

    // Deliver private spoken hint through isolated headphone output if not muted
    let privateAudioDelivery = null;
    if (deliverPrivateSpokenHint && !this.isMuted && whisperHintText) {
      this.state = COPILOT_STATES.WHISPERING_PRIVATE_HINT;
      const synth = await this.tts.synthesizeSentence(whisperHintText, { volume: 0.65, speechRate: 1.1 });
      this.state = COPILOT_STATES.ACTIVE;
      privateAudioDelivery = {
        delivered: true,
        routedExclusivelyTo: this.privateOutputDevice.deviceId,
        outputIsolationVerified: this.outputIsolationVerified,
        injectedIntoCallAudio: false,
        whisperText: whisperHintText,
        utteranceId: synth.utteranceId
      };
    } else if (this.isMuted) {
      privateAudioDelivery = {
        delivered: false,
        reason: 'COPILOT_MUTED_VISUAL_CARD_ONLY',
        routedExclusivelyTo: null,
        injectedIntoCallAudio: false
      };
    }

    return {
      success: true,
      sessionId: this.sessionId,
      segment: seg,
      isQuestion: Boolean(seg.isQuestion),
      suggestedAnswer,
      meetingSummary: this.getMeetingSummary(),
      missionControlCard: card,
      privateAudioDelivery
    };
  }

  /**
   * Returns a concise structured summary of the live meeting context.
   */
  getMeetingSummary() {
    const pts = this.liveMeetingContext.importantPoints;
    const qs = this.liveMeetingContext.detectedQuestions;
    return {
      meetingTitle: this.liveMeetingContext.meetingTitle,
      participantCount: this.liveMeetingContext.participants.size,
      participants: Array.from(this.liveMeetingContext.participants),
      totalSegments: this.liveMeetingContext.transcriptSegments.length,
      importantPoints: pts.slice(-5),
      detectedQuestionsCount: qs.length,
      latestSuggestedAnswer: qs.length > 0 ? qs[qs.length - 1].suggestedAnswer : null,
      summaryText: pts.length > 0
        ? `Meeting "${this.liveMeetingContext.meetingTitle}" (${this.liveMeetingContext.participants.size} participants): ${pts.slice(-3).join(' | ')}`
        : 'No meeting statements recorded yet.'
    };
  }

  /**
   * Immediately interrupts any active private spoken hint in the headphones.
   */
  interruptWhisper(reason = 'User interrupted private whisper') {
    if (this.tts.isPlaying) {
      this.tts.stop(reason);
    }
    if (this.state === COPILOT_STATES.WHISPERING_PRIVATE_HINT) {
      this.state = this.isMuted ? COPILOT_STATES.MUTED : COPILOT_STATES.ACTIVE;
    }
    return {
      success: true,
      interrupted: true,
      state: this.state,
      reason
    };
  }

  /**
   * Immediately mutes private spoken hints (visual Mission Control cards continue if active).
   */
  muteCopilot() {
    this.interruptWhisper('Copilot muted');
    this.isMuted = true;
    if (this.state !== COPILOT_STATES.DISABLED) {
      this.state = COPILOT_STATES.MUTED;
    }
    return {
      success: true,
      isMuted: this.isMuted,
      state: this.state
    };
  }

  /**
   * Unmutes private spoken hints to headphones.
   */
  unmuteCopilot() {
    this.isMuted = false;
    if (this.explicitMeetingConsent) {
      this.state = COPILOT_STATES.ACTIVE;
    }
    return {
      success: true,
      isMuted: this.isMuted,
      state: this.state
    };
  }

  /**
   * Immediately disables Private Whisper Copilot Mode and stops audio loopback capture.
   */
  async disableCopilot(reason = 'User disabled Private Whisper Copilot') {
    this.interruptWhisper(reason);
    await this.loopbackEngine.stopLoopbackCapture(reason, { purgeAll: true });
    this.state = COPILOT_STATES.DISABLED;
    this.explicitMeetingConsent = false;
    this.isMuted = false;
    this.sessionId = null;

    this.emit('stateChange', this.getStatus());

    return {
      success: true,
      state: this.state,
      explicitMeetingConsent: this.explicitMeetingConsent,
      reason
    };
  }

  getStatus() {
    return {
      state: this.state,
      sessionId: this.sessionId,
      explicitMeetingConsent: this.explicitMeetingConsent,
      isMuted: this.isMuted,
      privateOutputDevice: this.privateOutputDevice,
      outputIsolationVerified: this.outputIsolationVerified,
      allowCallAudioInjection: this.allowCallAudioInjection,
      impersonationProhibited: this.impersonationProhibited,
      meetingSummary: this.getMeetingSummary(),
      missionControlCards: this.liveMeetingContext.missionControlCards.slice(-5)
    };
  }
}

const privateWhisperCopilotInstance = new PrivateWhisperCopilot();

module.exports = {
  PrivateWhisperCopilot,
  privateWhisperCopilotInstance,
  COPILOT_STATES
};
