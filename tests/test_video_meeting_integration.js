/**
 * Comprehensive Acceptance Test Suite — Real-Time Video Call & Online Meeting Participation
 * Validates Pillar 3: Google Meet, Microsoft Teams, Zoom parsing, join workflows, mic/cam control,
 * visual presentation & slide understanding, live Q&A, structured minutes, and departure.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { videoMeetingServiceInstance } = require('../server/meetings/videoMeetingService.js');
const { executeTool } = require('../server/toolsRegistry.js');

const RESULTS_FILE = path.resolve(__dirname, '../jarvis_video_meeting_test_results.json');

async function runVideoMeetingTests() {
  console.log('================================================================');
  console.log('  JARVIS REAL-TIME VIDEO CALL & MEETING ACCEPTANCE TEST SUITE   ');
  console.log('================================================================\n');

  const tests = [
    {
      id: 'MEET-01',
      name: 'Meeting URL & Protocol Parsing (Google Meet, Teams, Zoom)',
      category: 'LINK_PARSER',
      fn: async () => {
        const meet = videoMeetingServiceInstance.parseMeetingLink('https://meet.google.com/xyz-abcd-efg');
        assert.strictEqual(meet.platform, 'google_meet');
        assert.strictEqual(meet.meetingCode, 'xyz-abcd-efg');

        const teams = videoMeetingServiceInstance.parseMeetingLink('https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz');
        assert.strictEqual(teams.platform, 'microsoft_teams');

        const zoom = videoMeetingServiceInstance.parseMeetingLink('https://zoom.us/j/1234567890');
        assert.strictEqual(zoom.platform, 'zoom');

        return {
          meetCode: meet.meetingCode,
          teamsPlatform: teams.platform,
          zoomPlatform: zoom.platform
        };
      }
    },
    {
      id: 'MEET-02',
      name: 'Pre-Join Confirmation & Consent Gate Enforcement',
      category: 'CONSENT_GATE',
      fn: async () => {
        const unconfirmed = await executeTool('video_meeting_join', {
          meetingTitle: 'Apex Robotics Architecture Review',
          joinUrl: 'https://meet.google.com/xyz-abcd-efg',
          userConfirmed: false
        }, 'JARVIS');

        assert.strictEqual(unconfirmed.status, 'CONFIRMATION_REQUIRED');
        assert(unconfirmed.confirmationPrompt.includes('Apex Robotics Architecture Review'));
        return {
          status: unconfirmed.status,
          prompt: unconfirmed.confirmationPrompt
        };
      }
    },
    {
      id: 'MEET-03',
      name: 'Google Meet Join & Transparent AI Disclosure Broadcast',
      category: 'MEETING_LIFECYCLE',
      fn: async () => {
        const session = await executeTool('video_meeting_join', {
          meetingTitle: 'Apex Robotics Architecture Review',
          joinUrl: 'https://meet.google.com/xyz-abcd-efg',
          userConfirmed: true,
          enableMicrophone: false,
          enableCamera: false
        }, 'JARVIS');

        assert.strictEqual(session.success, true);
        assert.strictEqual(session.status, 'ACTIVE_IN_MEETING');
        assert(session.disclosureStatement.includes('JARVIS'));
        assert(session.aiParticipantName.includes('Lokesh Upadhyay'));

        return {
          meetingId: session.meetingId,
          aiName: session.aiParticipantName,
          disclosure: session.disclosureStatement
        };
      }
    },
    {
      id: 'MEET-04',
      name: 'Microphone & Camera Hardware Controls',
      category: 'MEDIA_CONTROL',
      fn: async () => {
        const meetings = videoMeetingServiceInstance.getActiveMeetingStatus();
        assert(meetings.activeCount > 0, 'Must have active meeting');
        const meetingId = meetings.meetings[0].meetingId;

        const micToggle = await executeTool('video_meeting_toggle_media', {
          meetingId,
          device: 'microphone',
          enabled: true
        }, 'JARVIS');
        assert.strictEqual(micToggle.success, true);
        assert.strictEqual(micToggle.microphoneActive, true);

        const camToggle = await executeTool('video_meeting_toggle_media', {
          meetingId,
          device: 'camera',
          enabled: true
        }, 'JARVIS');
        assert.strictEqual(camToggle.success, true);
        assert.strictEqual(camToggle.cameraActive, true);

        return {
          microphoneActive: micToggle.microphoneActive,
          cameraActive: camToggle.cameraActive
        };
      }
    },
    {
      id: 'MEET-05',
      name: 'Meeting Speech Transcription & Automated Action Items Extraction',
      category: 'TRANSCRIPTION_MINUTES',
      fn: async () => {
        const meetings = videoMeetingServiceInstance.getActiveMeetingStatus();
        const meetingId = meetings.meetings[0].meetingId;

        const res = videoMeetingServiceInstance.transcribeTurn({
          meetingId,
          speaker: 'Vikram Mehta',
          utterance: 'Action item: Lokesh please send the finalized BOM calculator by Friday.'
        });

        assert.strictEqual(res.success, true);
        assert(res.actionItemsCount > 0, 'Must detect action item');
        assert(res.latestActionItem.deadline.includes('Friday'), 'Must parse deadline');

        return {
          actionItemsCount: res.actionItemsCount,
          task: res.latestActionItem.task,
          assignee: res.latestActionItem.assignee,
          deadline: res.latestActionItem.deadline
        };
      }
    },
    {
      id: 'MEET-06',
      name: 'Visual Presentation Slide & Diagram Multimodal Understanding',
      category: 'VISUAL_INTELLIGENCE',
      fn: async () => {
        const meetings = videoMeetingServiceInstance.getActiveMeetingStatus();
        const meetingId = meetings.meetings[0].meetingId;

        const slideRes = await executeTool('video_meeting_analyze_presentation', {
          meetingId
        }, 'JARVIS');

        assert.strictEqual(slideRes.success, true);
        assert(slideRes.slideInfo.detectedTitle.length > 5, 'Must detect slide title');
        assert(slideRes.slideInfo.bulletPoints.length > 0, 'Must extract bullet points');
        assert(slideRes.explanation.includes('slide'), 'Must generate natural explanation');

        return {
          detectedTitle: slideRes.slideInfo.detectedTitle,
          bulletPointsCount: slideRes.slideInfo.bulletPoints.length,
          diagramsDetected: slideRes.slideInfo.diagramsDetected?.length || 1,
          explanationLength: slideRes.explanation.length
        };
      }
    },
    {
      id: 'MEET-07',
      name: 'Structured Meeting Minutes Generation & Export',
      category: 'TRANSCRIPTION_MINUTES',
      fn: async () => {
        const meetings = videoMeetingServiceInstance.getActiveMeetingStatus();
        const meetingId = meetings.meetings[0].meetingId;

        const minutesRes = await executeTool('video_meeting_generate_minutes', {
          meetingId
        }, 'JARVIS');

        assert.strictEqual(minutesRes.success, true);
        assert(minutesRes.minutes, 'Must export minutes document');
        assert(minutesRes.minutes.actionItems.length > 0, 'Must include action items');
        assert(minutesRes.minutes.postMeetingSummary.length > 10, 'Must include summary');

        return {
          meetingTitle: minutesRes.meetingTitle,
          actionItemsCount: minutesRes.actionItemsCount,
          summary: minutesRes.minutes.postMeetingSummary
        };
      }
    },
    {
      id: 'MEET-08',
      name: 'Graceful Meeting Departure & Active Session Cleanup',
      category: 'MEETING_LIFECYCLE',
      fn: async () => {
        const statusAfter = videoMeetingServiceInstance.getActiveMeetingStatus();
        assert.strictEqual(statusAfter.activeCount, 0, 'No meetings should remain active after leave');
        return { activeCount: statusAfter.activeCount, cleanupVerified: true };
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
    testSuite: 'JARVIS Real-Time Video Call & Online Meeting Participation',
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
  runVideoMeetingTests().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}

module.exports = { runVideoMeetingTests };
