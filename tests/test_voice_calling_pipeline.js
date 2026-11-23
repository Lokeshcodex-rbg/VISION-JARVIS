/**
 * Comprehensive Acceptance Test Suite — Real-Time Voice Calling & Audio Pipeline
 * Validates Pillar 2: Calling apps discovery, audio device enumeration, mic consent,
 * contact resolution, pre-call confirmation, call initiation, VAD, STT, conversational reasoning,
 * natural TTS, barge-in interruption, mute control, and clean termination.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { realtimeVoiceCallServiceInstance } = require('../server/voice/realtimeVoiceCallService.js');
const { executeTool } = require('../server/toolsRegistry.js');

const RESULTS_FILE = path.resolve(__dirname, '../jarvis_realtime_audio_test_results.json');

async function runVoiceTests() {
  console.log('================================================================');
  console.log('  JARVIS REAL-TIME VOICE CALLING & AUDIO ACCEPTANCE TEST SUITE  ');
  console.log('================================================================\n');

  const tests = [
    {
      id: 'VOICE-01',
      name: 'Windows Calling Applications Discovery',
      category: 'APP_DISCOVERY',
      fn: async () => {
        const res = await realtimeVoiceCallServiceInstance.inspectCallingApplications();
        assert.strictEqual(res.success, true);
        assert(Array.isArray(res.applications), 'Must list calling apps');
        const wa = res.applications.find(a => a.name === 'WhatsApp Desktop');
        assert(wa, 'WhatsApp Desktop must be detected');
        const teams = res.applications.find(a => a.name === 'Microsoft Teams');
        assert(teams, 'Microsoft Teams must be detected');
        return {
          applicationsChecked: res.applications.length,
          whatsAppRunning: wa.running,
          teamsRunning: teams.running
        };
      }
    },
    {
      id: 'VOICE-02',
      name: 'Windows WASAPI Audio Endpoints & Loopback Enumeration',
      category: 'AUDIO_HARDWARE',
      fn: async () => {
        const res = await realtimeVoiceCallServiceInstance.enumerateAudioHardware(true);
        assert.strictEqual(res.success, true);
        assert(res.microphones.length > 0, 'Microphone capture endpoint must be discovered');
        assert(res.speakers.length > 0, 'Speaker playback endpoint must be discovered');
        return {
          microphonesDiscovered: res.microphones.length,
          primaryMic: res.microphones[0].label,
          speakersDiscovered: res.speakers.length,
          primarySpeaker: res.speakers[0].label
        };
      }
    },
    {
      id: 'VOICE-03',
      name: 'Microphone Permission Consent Verification',
      category: 'AUDIO_HARDWARE',
      fn: async () => {
        const withoutConsent = realtimeVoiceCallServiceInstance.verifyMicrophoneConsent(false);
        const withConsent = realtimeVoiceCallServiceInstance.verifyMicrophoneConsent(true);
        assert.strictEqual(withConsent.consentGranted, true);
        assert.strictEqual(withConsent.status, 'AUTHORIZED');
        return { verified: true, status: withConsent.status };
      }
    },
    {
      id: 'VOICE-04',
      name: 'Contact Resolution & Pre-Call Confirmation Enforcement',
      category: 'CALL_CONTROL',
      fn: async () => {
        const unconfirmed = await executeTool('voice_call_initiate', {
          contact: 'Vikram Mehta',
          platform: 'whatsapp',
          userConfirmed: false
        }, 'JARVIS');
        assert.strictEqual(unconfirmed.status, 'CONFIRMATION_REQUIRED');
        assert(unconfirmed.confirmationPrompt.includes('Vikram Mehta'));
        return {
          status: unconfirmed.status,
          contact: unconfirmed.contact.name,
          prompt: unconfirmed.confirmationPrompt
        };
      }
    },
    {
      id: 'VOICE-05',
      name: 'Outbound Voice Call Initiation & AI Disclosure Broadcast',
      category: 'CALL_CONTROL',
      fn: async () => {
        const call = await executeTool('voice_call_initiate', {
          contact: 'Vikram Mehta',
          platform: 'whatsapp',
          userConfirmed: true,
          explicitMicConsent: true
        }, 'JARVIS');
        assert.strictEqual(call.success, true);
        assert.strictEqual(call.state, 'CONNECTED');
        assert(call.aiDisclosure.includes('JARVIS'), 'Must broadcast transparent AI disclosure');
        return {
          callId: call.callId,
          state: call.state,
          aiDisclosure: call.aiDisclosure
        };
      }
    },
    {
      id: 'VOICE-06',
      name: 'Real-Time Conversational Turn (VAD, Reasoning & TTS)',
      category: 'REALTIME_VOICE',
      fn: async () => {
        const turn = await executeTool('voice_call_process_turn', {
          callerUtterance: 'Hi JARVIS, what is the status of the robot arm kinematic solver?'
        }, 'JARVIS');
        assert.strictEqual(turn.success, true);
        assert(turn.aiResponse.length > 10, 'Must generate conversational response');
        assert(turn.latencyMs >= 0, 'Must record latency');
        return {
          caller: turn.callerUtterance,
          aiResponse: turn.aiResponse,
          latencyMs: turn.latencyMs,
          turns: turn.turns
        };
      }
    },
    {
      id: 'VOICE-07',
      name: 'Sensitive Contractual/Financial Escalation Holding Pattern',
      category: 'SAFETY_GOVERNANCE',
      fn: async () => {
        const turn = await executeTool('voice_call_process_turn', {
          callerUtterance: 'Can you sign contract and agree to a 20% discount on the quote right now?'
        }, 'JARVIS');
        assert.strictEqual(turn.success, true);
        assert(turn.aiResponse.includes('Lokesh Upadhyay'), 'Must hold and escalate to human owner');
        assert(/review|confirm|flag/i.test(turn.aiResponse), 'Must not make unauthorized binding commitments');
        return {
          caller: turn.callerUtterance,
          holdingResponse: turn.aiResponse,
          escalatedToOwner: true
        };
      }
    },
    {
      id: 'VOICE-08',
      name: 'Barge-In Interruption Detection & Speech Playback Abort',
      category: 'REALTIME_VOICE',
      fn: async () => {
        const bargeIn = await executeTool('voice_call_process_turn', {
          callerUtterance: 'Wait, stop, I have another question!',
          callerInterrupted: true
        }, 'JARVIS');
        assert.strictEqual(bargeIn.success, true);
        assert.strictEqual(bargeIn.bargeInHandled, true);
        assert.strictEqual(bargeIn.speechPlaybackStopped, true);
        return {
          bargeInHandled: bargeIn.bargeInHandled,
          speechPlaybackStopped: bargeIn.speechPlaybackStopped
        };
      }
    },
    {
      id: 'VOICE-09',
      name: 'Hardware Microphone Mute / Unmute Control',
      category: 'MEDIA_CONTROL',
      fn: async () => {
        const muteOn = await executeTool('voice_call_toggle_mute', { muted: true }, 'JARVIS');
        assert.strictEqual(muteOn.success, true);
        assert.strictEqual(muteOn.micMuted, true);

        const muteOff = await executeTool('voice_call_toggle_mute', { muted: false }, 'JARVIS');
        assert.strictEqual(muteOff.success, true);
        assert.strictEqual(muteOff.micMuted, false);

        return { muteOn: muteOn.micMuted, muteOff: muteOff.micMuted };
      }
    },
    {
      id: 'VOICE-10',
      name: 'Clean Call Disconnection & Transcript Logging',
      category: 'CALL_CONTROL',
      fn: async () => {
        const end = await executeTool('voice_call_end', { reason: 'User completed discussion' }, 'JARVIS');
        assert.strictEqual(end.success, true);
        assert(end.transcriptCount > 0, 'Transcript entries must be saved');
        assert(end.durationSec >= 0, 'Duration must be computed');
        return {
          callId: end.callId,
          durationSec: end.durationSec,
          transcriptEntries: end.transcriptCount,
          summary: end.summary
        };
      }
    }
  ];

  const results = [];
  let passedCount = 0;

  for (const t of tests) {
    const t0 = Date.now();
    try {
      const output = await t.fn();
      const durationMs = Date.now() - t0;
      results.push({
        id: t.id,
        name: t.name,
        category: t.category,
        status: 'VERIFIED',
        durationMs,
        output
      });
      passedCount++;
      console.log(`[PASS] [${t.id}] ${t.name} (${durationMs}ms)`);
    } catch (err) {
      const durationMs = Date.now() - t0;
      results.push({
        id: t.id,
        name: t.name,
        category: t.category,
        status: 'FAILED',
        durationMs,
        error: err.message
      });
      console.error(`[FAIL] [${t.id}] ${t.name} (${durationMs}ms): ${err.message}`);
    }
  }

  const summary = {
    testSuite: 'JARVIS Real-Time Voice Calling & Audio Pipeline',
    executedAt: new Date().toISOString(),
    totalTests: tests.length,
    passed: passedCount,
    failed: tests.length - passedCount,
    successRate: `${((passedCount / tests.length) * 100).toFixed(1)}%`,
    overallStatus: passedCount === tests.length ? 'VERIFIED' : 'PARTIALLY VERIFIED',
    results
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\n================================================================`);
  console.log(`  PASSED: ${passedCount}/${tests.length} (${summary.successRate}) | Status: ${summary.overallStatus}`);
  console.log(`  Results saved to: ${RESULTS_FILE}`);
  console.log(`================================================================\n`);

  return summary;
}

if (require.main === module) {
  runVoiceTests().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}

module.exports = { runVoiceTests };
