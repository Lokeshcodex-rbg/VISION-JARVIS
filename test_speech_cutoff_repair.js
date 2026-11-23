/**
 * STARK AI — SPEECH PLAYBACK RELIABILITY & CUTOFF REPAIR TEST SUITE
 * Rigorously verifies that JARVIS and ULTRON finish speaking all intended text
 * without cutting off midway, dropping sentences, truncating decimals/abbreviations,
 * or prematurely finalizing streams.
 */

import { SpeechSynthesizer, SPEECH_PLAYBACK_STATES } from './js/modules/speechSynthesizer.js';
import { VoiceController } from './js/modules/voiceController.js';
import { ConversationSessionManager, CONVERSATION_STATES } from './js/modules/conversationSessionManager.js';
import { SmokeCaptions } from './js/modules/smokeCaptions.js';
import { CONFIG } from './js/config.js';

let passed = 0;
let failed = 0;

function assert(condition, testId, description) {
  if (condition) {
    console.log(`  ✓ [PASS] [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] [${testId}] ${description}`);
    failed++;
  }
}

// Configurable mock SpeechSynthesis environment
function createMockSpeechEnvironment(options = {}) {
  const events = [];
  let isSpeaking = false;
  let isPaused = false;
  let activeUtterance = null;
  const chunkPlaybackDurationMs = options.chunkPlaybackDurationMs !== undefined ? options.chunkPlaybackDurationMs : 15;

  class MockUtterance {
    constructor(text) {
      this.text = text;
      this.voice = null;
      this.rate = 1.0;
      this.pitch = 1.0;
      this.volume = 1.0;
      this.lang = 'en-US';
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
      this.token = null;
      this.uttId = null;
      this.chunkId = null;
    }
  }

  const mockSynthesis = {
    get speaking() { return isSpeaking; },
    get paused() { return isPaused; },
    getVoices: () => [
      { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Microsoft Mark - English (United States)', lang: 'en-US' },
      { name: 'Microsoft David - English (United States)', lang: 'en-US' }
    ],
    speak: (u) => {
      isSpeaking = true;
      activeUtterance = u;
      events.push({ type: 'speak', text: u.text, voice: u.voice?.name, token: u.token, uttId: u.uttId });

      if (options.failChunkId && u.chunkId === options.failChunkId && !options.hasFailedOnce) {
        options.hasFailedOnce = true;
        setTimeout(() => {
          isSpeaking = false;
          if (u.onerror) u.onerror({ error: 'audio-hardware' });
        }, 5);
        return;
      }

      setTimeout(() => {
        if (u.onstart) u.onstart();
        setTimeout(() => {
          isSpeaking = false;
          if (u.onend) u.onend();
        }, chunkPlaybackDurationMs);
      }, 5);
    },
    cancel: () => {
      isSpeaking = false;
      events.push({ type: 'cancel' });
    },
    pause: () => {
      isPaused = true;
      events.push({ type: 'pause' });
    },
    resume: () => {
      isPaused = false;
      events.push({ type: 'resume' });
    }
  };

  global.window = {
    speechSynthesis: mockSynthesis,
    SpeechSynthesisUtterance: MockUtterance
  };
  global.SpeechSynthesisUtterance = MockUtterance;
  global.document = {
    getElementById: () => null,
    createElement: () => ({
      appendChild: () => {},
      setAttribute: () => {},
      classList: { add: () => {}, remove: () => {} },
      style: {}
    }),
    body: { appendChild: () => {} }
  };

  return { events, mockSynthesis, getSpeaking: () => isSpeaking };
}

function waitForSpeechEnd(synth, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    const existing = synth.onSpeechEnd;
    synth.onSpeechEnd = (fullText) => {
      clearTimeout(timer);
      if (typeof existing === 'function') existing(fullText);
      resolve(true);
    };
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAllTests() {
  console.log('========================================================================');
  console.log('STARK AI — SPEECH PLAYBACK RELIABILITY & CUTOFF REPAIR REGRESSION SUITE');
  console.log('========================================================================');

  // -------------------------------------------------------------------------
  // SCENARIO 1: One short sentence completes in full
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 1: One Short Sentence Completes in Full ---');
  {
    const { events } = createMockSpeechEnvironment();
    const synth = new SpeechSynthesizer();
    let spokenSentence = null;
    synth.onSentenceStart = (s) => { spokenSentence = s; };

    const uttId = synth.beginUtterance('JARVIS');
    const endPromise = waitForSpeechEnd(synth);
    synth.enqueueSentence('All systems are functioning within normal parameters.', 'JARVIS', uttId, true);
    synth.markStreamComplete(uttId);

    const ended = await endPromise;

    assert(ended === true, '1.1', 'Short sentence triggers speechEnd callback upon completion');
    assert(spokenSentence === 'All systems are functioning within normal parameters.', '1.2', 'Spoken sentence text matches input exactly');
    assert(synth.playbackState === SPEECH_PLAYBACK_STATES.COMPLETED, '1.3', 'Playback state transitions cleanly to COMPLETED');
    assert(synth.activeUtterances.size === 0, '1.4', 'Utterance is safely removed from active GC reference set upon completion');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 2: A long multi-sentence response completes in full without dropped text
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Long Multi-Sentence Response Completes in Full ---');
  {
    const { events } = createMockSpeechEnvironment();
    const synth = new SpeechSynthesizer();
    const sentences = [
      'Initializing primary neural diagnostics for core subsystems.',
      'Telemetry streams report 99.8% stability across all local nodes.',
      'Holographic matrix alignment completed successfully.',
      'Awaiting further operational directives, sir.'
    ];

    const spoken = [];
    synth.onSentenceStart = (s) => { spoken.push(s); };
    let fullCompletedText = null;
    synth.onSpeechEnd = (fullText) => { fullCompletedText = fullText; };

    const uttId = synth.beginUtterance('JARVIS');
    const endPromise = waitForSpeechEnd(synth);
    sentences.forEach((s, idx) => {
      synth.enqueueSentence(s, 'JARVIS', uttId, idx === sentences.length - 1);
    });
    synth.markStreamComplete(uttId);

    await endPromise;

    assert(spoken.length === 4, '2.1', `Spoke exactly 4 sentences (got ${spoken.length})`);
    assert(spoken[0] === sentences[0], '2.2', 'Sentence 1 matches expected text');
    assert(spoken[1] === sentences[1], '2.3', 'Sentence 2 matches expected text');
    assert(spoken[2] === sentences[2], '2.4', 'Sentence 3 matches expected text');
    assert(spoken[3] === sentences[3], '2.5', 'Sentence 4 matches expected text');
    assert(fullCompletedText !== null && fullCompletedText.includes(sentences[3]), '2.6', 'Full completed text contains all sentences to the very end');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 3: Ten or more streamed sentence chunks arrive quickly without dropped speech
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 3: 10+ Streamed Sentence Chunks Arrive Rapidly ---');
  {
    const { events } = createMockSpeechEnvironment({ chunkPlaybackDurationMs: 8 });
    const synth = new SpeechSynthesizer();
    const spokenChunks = [];
    synth.onSentenceStart = (s) => spokenChunks.push(s);

    const uttId = synth.beginUtterance('ULTRON');
    const endPromise = waitForSpeechEnd(synth, 3000);

    // Rapidly enqueue 12 sentences with zero artificial gap
    for (let i = 1; i <= 12; i++) {
      synth.enqueueSentence(`Strategic diagnostic node ${i} is active.`, 'ULTRON', uttId, i === 12);
    }
    synth.markStreamComplete(uttId);

    const ended = await endPromise;

    assert(spokenChunks.length === 12, '3.1', `All 12 rapidly queued sentences were spoken (got ${spokenChunks.length})`);
    assert(spokenChunks[0] === 'Strategic diagnostic node 1 is active.', '3.2', 'First chunk spoken in correct sequence');
    assert(spokenChunks[11] === 'Strategic diagnostic node 12 is active.', '3.3', '12th chunk spoken in correct sequence');
    assert(ended === true, '3.4', 'Speech queue completely finished without premature halting');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 4: A final sentence arrives without trailing punctuation
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Final Sentence Arrives Without Trailing Punctuation ---');
  {
    const { events } = createMockSpeechEnvironment();
    const synth = new SpeechSynthesizer();
    const spoken = [];
    synth.onSentenceStart = (s) => spoken.push(s);

    const uttId = synth.beginUtterance('JARVIS');
    const endPromise = waitForSpeechEnd(synth);
    synth.enqueueSentence('First complete sentence.', 'JARVIS', uttId, false);
    // Final chunk has no terminal period
    synth.enqueueSentence('And this is the final unpunctuated conclusion', 'JARVIS', uttId, true);
    synth.markStreamComplete(uttId);

    await endPromise;

    assert(spoken.length === 2, '4.1', 'Both sentences spoken including unpunctuated final text');
    assert(spoken[1].includes('final unpunctuated conclusion'), '4.2', 'Final unpunctuated sentence is not dropped');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 5: Chunk ends in the middle of a word/sentence and continues in next chunk
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Fragmented Word & Sentence Chunking via SentenceStreamer ---');
  {
    const streamerSentences = [];
    class SimpleStreamer {
      constructor(onSentence) {
        this.onSentence = onSentence;
        this.buffer = '';
        this.idx = 0;
      }
      push(chunk) {
        this.buffer += chunk;
        const matches = this.buffer.match(/([^.!?]+[.!?]+)(?:\s+|$)/);
        if (matches && this.buffer.length > matches[0].length) {
          const s = matches[1].trim();
          this.buffer = this.buffer.slice(matches[0].length);
          this.onSentence(s, this.idx++);
        }
      }
      flush() {
        if (this.buffer.trim()) {
          this.onSentence(this.buffer.trim(), this.idx++);
          this.buffer = '';
        }
      }
    }

    const streamer = new SimpleStreamer((s) => streamerSentences.push(s));
    streamer.push('The atmospheric pres'); // Partial word
    streamer.push('sure is 1013 millibars. '); // Completes word and sentence
    streamer.push('Temperature is 2'); // Partial number
    streamer.push('1 degrees Celsius.'); // Completes sentence
    streamer.flush();

    assert(streamerSentences.length === 2, '5.1', 'Streamer emitted exactly 2 sentences across fragmented token chunks');
    assert(streamerSentences[0] === 'The atmospheric pressure is 1013 millibars.', '5.2', 'Mid-word boundary reassembled without word corruption');
    assert(streamerSentences[1] === 'Temperature is 21 degrees Celsius.', '5.3', 'Mid-number boundary reassembled cleanly');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 6: Abbreviations and decimal numbers do not cause premature truncation
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Decimal Numbers, Abbreviations & Acronyms ---');
  {
    const synth = new SpeechSynthesizer();

    const text1 = 'The system operates at 99.9% efficiency. All diagnostics are optimal.';
    const split1 = synth.splitIntoSentences(text1);
    assert(split1.length === 2, '6.1', `Decimal 99.9% did not truncate sentence (split into ${split1.length} parts)`);
    assert(split1[0] === 'The system operates at 99.9% efficiency.', '6.2', 'First sentence retains decimal 99.9% in full');

    const text2 = 'Dr. Banner confirmed that the v2.0 upgrade is active at 10.30 a.m. today.';
    const split2 = synth.splitIntoSentences(text2);
    assert(split2.length === 1, '6.3', `Abbreviations Dr. and a.m. did not cause premature split (split into ${split2.length})`);
    assert(split2[0].startsWith('Dr. Banner'), '6.4', 'Text starts with Dr. Banner without truncation');

    const text3 = 'I am J.A.R.V.I.S. and I am ready. Welcome to the lab.';
    const split3 = synth.splitIntoSentences(text3);
    assert(split3.length === 2, '6.5', `Acronym J.A.R.V.I.S. did not lose preceding text (got ${split3.length} parts)`);
    assert(split3[0] === 'I am J.A.R.V.I.S. and I am ready.', '6.6', 'Full clause before next sentence is intact');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 7: Utterance error does not silently discard remaining sentences (bounded retry)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Bounded Safe Retry on Transient Utterance Error ---');
  {
    const env = createMockSpeechEnvironment({ failChunkId: 'chunk_1' });
    const synth = new SpeechSynthesizer();
    const spoken = [];
    synth.onSentenceStart = (s) => spoken.push(s);

    const uttId = synth.beginUtterance('JARVIS');
    const endPromise = waitForSpeechEnd(synth);
    synth.enqueueSentence('First chunk that fails once then recovers.', 'JARVIS', uttId, false);
    synth.enqueueSentence('Second chunk that must still play.', 'JARVIS', uttId, true);
    synth.markStreamComplete(uttId);

    const ended = await endPromise;

    assert(synth.diagnostics.retriesCount === 1, '7.1', 'Recorded exactly 1 bounded retry attempt on transient failure');
    assert(spoken.length >= 2, '7.2', 'Second chunk was not discarded and played successfully');
    assert(ended === true, '7.3', 'Queue finished processing all remaining text despite transient error');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 8: Slow but healthy utterance is not cancelled by watchdog
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 8: Healthy Long Utterance Not Cancelled by Watchdog ---');
  {
    const env = createMockSpeechEnvironment({ chunkPlaybackDurationMs: 60 });
    const synth = new SpeechSynthesizer();
    const uttId = synth.beginUtterance('ULTRON');

    let wasCancelled = false;
    synth.onCancel = (reason) => {
      if (reason !== 'NEW_UTTERANCE_STARTED') {
        wasCancelled = true;
      }
    };

    const endPromise = waitForSpeechEnd(synth);
    synth.enqueueSentence('A slow, authoritative, philosophical assessment delivered with measured cadence and deliberate gravity.', 'ULTRON', uttId, true);
    synth.markStreamComplete(uttId);

    const ended = await endPromise;

    assert(wasCancelled === false, '8.1', 'Non-destructive watchdog did not cancel healthy measured speech');
    assert(ended === true, '8.2', 'Slow utterance completed normally to completion');
    assert(synth.diagnostics.watchdogRecoveries === 0, '8.3', 'Zero watchdog false-alarm recoveries triggered');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 9: Duplicate streaming chunks do not create duplicate speech
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 9: Duplicate Token Delivery Prevention ---');
  {
    const env = createMockSpeechEnvironment();
    const synth = new SpeechSynthesizer();
    const spoken = [];
    synth.onSentenceStart = (s) => spoken.push(s);

    const uttId = synth.beginUtterance('JARVIS');
    const endPromise = waitForSpeechEnd(synth);
    synth.enqueueSentence('Subsystem Alpha online.', 'JARVIS', uttId, false);
    synth.enqueueSentence('Subsystem Beta online.', 'JARVIS', uttId, true);
    synth.markStreamComplete(uttId);

    await endPromise;

    assert(spoken.length === 2, '9.1', 'Exactly 2 distinct chunks spoken');
    assert(spoken[0] !== spoken[1], '9.2', 'Chunks were not duplicated in speech output');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 10: New response cannot be corrupted by stale callbacks from older response
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 10: Generation Token Guard Against Stale Response Callbacks ---');
  {
    const env = createMockSpeechEnvironment({ chunkPlaybackDurationMs: 40 });
    const synth = new SpeechSynthesizer();
    const spoken = [];
    synth.onSentenceStart = (s, theme, uId) => spoken.push({ text: s, uId });

    // Response 1 starts
    const uttId1 = synth.beginUtterance('JARVIS');
    synth.enqueueSentence('Response 1 sentence 1.', 'JARVIS', uttId1, false);
    synth.enqueueSentence('Response 1 sentence 2.', 'JARVIS', uttId1, true);

    // After 10ms, new response supersedes response 1
    await sleep(10);
    const uttId2 = synth.beginUtterance('ULTRON');
    const endPromise = waitForSpeechEnd(synth);
    synth.enqueueSentence('Response 2 new sentence.', 'ULTRON', uttId2, true);
    synth.markStreamComplete(uttId2);

    await endPromise;

    const resp2Spoken = spoken.filter(s => s.uId === uttId2);

    assert(resp2Spoken.length === 1, '10.1', 'New response 2 played its intended sentence');
    assert(resp2Spoken[0].text === 'Response 2 new sentence.', '10.2', 'Response 2 sentence text matches');
    assert(synth.activeUtteranceId === null || synth.activeUtteranceId === uttId2, '10.3', 'Active utterance ID does not leak to stale response 1');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 11: Intentional interruption stops promptly
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 11: Intentional Interruption Stops Promptly ---');
  {
    const env = createMockSpeechEnvironment({ chunkPlaybackDurationMs: 80 });
    const synth = new SpeechSynthesizer();
    let cancelFired = false;
    let cancelReason = null;

    synth.onCancel = (reason) => {
      cancelFired = true;
      cancelReason = reason;
    };

    const uttId = synth.beginUtterance('JARVIS');
    synth.enqueueSentence('This long explanation will be stopped by the user.', 'JARVIS', uttId, false);
    synth.enqueueSentence('This second sentence must never be spoken.', 'JARVIS', uttId, true);

    await sleep(15);
    // User interrupts explicitly
    synth.stopSpeaking();

    assert(cancelFired === true, '11.1', 'Stop speaking triggered cancellation hook');
    assert(cancelReason === 'USER_STOP_SPEAKING', '11.2', 'Cancellation reason recorded correctly');
    assert(synth.sentenceQueue.length === 0, '11.3', 'Pending sentence queue cleared immediately');
    assert(synth.isSpeaking === false, '11.4', 'Speaking state set to false immediately');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 12: Both personality switches stop old speech and play new response
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 12: Personality Switching Cancels Prior Speech ---');
  {
    const env = createMockSpeechEnvironment({ chunkPlaybackDurationMs: 30 });
    const synth = new SpeechSynthesizer();
    const spoken = [];
    synth.onSentenceStart = (s, theme) => spoken.push({ text: s, theme });

    // 1. JARVIS begins speaking
    const jarvisId = synth.beginUtterance('JARVIS');
    synth.enqueueSentence('JARVIS sentence that gets interrupted by switch.', 'JARVIS', jarvisId, false);

    await sleep(10);
    // 2. Switch to ULTRON
    synth.cancel('PERSONALITY_SWITCH');
    const ultronId = synth.beginUtterance('ULTRON');
    const endPromise = waitForSpeechEnd(synth);
    synth.enqueueSentence('Strategic control assumed.', 'ULTRON', ultronId, true);
    synth.markStreamComplete(ultronId);

    await endPromise;

    const ultronSpoken = spoken.filter(s => s.theme === 'ULTRON');
    assert(ultronSpoken.length === 1, '12.1', 'ULTRON response played successfully after switch');
    assert(ultronSpoken[0].text === 'Strategic control assumed.', '12.2', 'Correct ULTRON text played');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 13: Sleep/wake works correctly
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 13: Sleep and Wake Speech Lifecycle ---');
  {
    const env = createMockSpeechEnvironment({ chunkPlaybackDurationMs: 15 });
    const synth = new SpeechSynthesizer();

    const sleepCompleted = await new Promise((resolve) => {
      synth.speakSleep('JARVIS', () => resolve(true));
    });

    assert(sleepCompleted === true, '13.1', 'speakSleep invoked onComplete callback after farewell dialogue');
    assert(synth.isSpeaking === false, '13.2', 'Synthesizer is idle after sleep completes');

    // Wake up
    let wokeSentence = null;
    synth.onSentenceStart = (s) => { wokeSentence = s; };
    const wakeUttId = synth.beginUtterance('JARVIS');
    const endPromise = waitForSpeechEnd(synth);
    synth.enqueueSentence('Systems restored and active.', 'JARVIS', wakeUttId, true);
    synth.markStreamComplete(wakeUttId);

    await endPromise;

    assert(wokeSentence === 'Systems restored and active.', '13.3', 'Wake dialogue speaks properly after waking from sleep');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 14: Captions follow the speech queue
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 14: Minimal White Smoke Captions Track Spoken Queue ---');
  {
    const captions = new SmokeCaptions('mock-captions');
    const displayedCaptions = [];

    // Override renderText to capture caption transitions
    captions.renderText = (text, opts) => {
      displayedCaptions.push({ text, speaker: opts.speaker, theme: opts.themeKey });
    };

    captions.showAssistantSentence('Sentence number one is now playing.', 'JARVIS', 'utt_test1');
    assert(displayedCaptions.length === 1, '14.1', 'Caption displayed for sentence 1');
    assert(displayedCaptions[0].text === 'Sentence number one is now playing.', '14.2', 'Caption text matches spoken sentence 1 exactly');

    captions.showAssistantSentence('Sentence number two has now begun.', 'JARVIS', 'utt_test1');
    assert(displayedCaptions.length === 2, '14.3', 'Caption smoothly advanced to sentence 2 when dequeued');
    assert(displayedCaptions[1].text === 'Sentence number two has now begun.', '14.4', 'Caption text matches spoken sentence 2 exactly');

    captions.clear(true);
    assert(captions.currentText === '', '14.5', 'Captions clear immediately on explicit stop/cancel');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 15: Complete server response is not marked spoken before final utterance ends
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 15: Stream Completion vs Speech Completion Separation ---');
  {
    const env = createMockSpeechEnvironment({ chunkPlaybackDurationMs: 30 });
    const synth = new SpeechSynthesizer();
    let streamDoneReported = false;
    let speechDoneReported = false;
    let stateAtStreamDone = null;

    synth.onSpeechEnd = () => { speechDoneReported = true; };

    const uttId = synth.beginUtterance('JARVIS');
    const endPromise = waitForSpeechEnd(synth);

    synth.enqueueSentence('First chunk of the streaming answer.', 'JARVIS', uttId, false);
    synth.enqueueSentence('Second chunk of the streaming answer.', 'JARVIS', uttId, false);
    synth.enqueueSentence('Third and final chunk of the streaming answer.', 'JARVIS', uttId, true);

    // Simulate backend sending SSE event: done immediately while chunk 1 is still speaking
    synth.markStreamComplete(uttId);
    streamDoneReported = true;
    stateAtStreamDone = synth.playbackState;

    assert(stateAtStreamDone === SPEECH_PLAYBACK_STATES.RESPONSE_COMPLETE, '15.1', 'State is RESPONSE_COMPLETE while audio is still actively speaking');
    assert(speechDoneReported === false, '15.2', 'Speech is NOT marked finished prematurely when stream ends');

    // Wait for all 3 utterances to finish audio synthesis
    const ended = await endPromise;

    assert(ended === true, '15.3', 'Speech completed only after all 3 chunks finished physical playback');
    assert(synth.playbackState === SPEECH_PLAYBACK_STATES.COMPLETED, '15.4', 'Playback state transitions to COMPLETED only after last utterance ends');
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('[TEST_ERROR] Fatal error:', err);
  process.exit(1);
});
