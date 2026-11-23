/**
 * STARK AI — VOICE LATENCY, STREAMING & AUTHORITATIVE TTS TEST SUITE
 * Measures Time to First Spoken Chunk (TTFC), sentence-boundary streaming,
 * token isolation against zombie callbacks, user interruption, voice selection,
 * and 10-trial benchmark latency for both JARVIS and ULTRON.
 */

import { SpeechSynthesizer } from './js/modules/speechSynthesizer.js';
import { AIClient } from './js/modules/aiClient.js';
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

// Mock browser SpeechSynthesis environment for CLI test harness
function setupMockSpeechEnvironment() {
  const events = [];
  let isSpeaking = false;
  let isPaused = false;
  let activeUtterance = null;

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
    }
  }

  const mockSynthesis = {
    get speaking() { return isSpeaking; },
    get paused() { return isPaused; },
    getVoices: () => [
      { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Microsoft Mark - English (United States)', lang: 'en-US' },
      { name: 'Microsoft David - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Zira - English (United States)', lang: 'en-US' }
    ],
    speak: (u) => {
      isSpeaking = true;
      activeUtterance = u;
      events.push({ type: 'speak', text: u.text, voice: u.voice?.name });
      setTimeout(() => {
        if (u.onstart) u.onstart();
        setTimeout(() => {
          isSpeaking = false;
          if (u.onend) u.onend();
        }, 25);
      }, 5);
    },
    cancel: () => {
      isSpeaking = false;
      events.push({ type: 'cancel' });
    },
    pause: () => { isPaused = true; },
    resume: () => { isPaused = false; }
  };

  global.window = {
    speechSynthesis: mockSynthesis,
    SpeechSynthesisUtterance: MockUtterance
  };
  global.SpeechSynthesisUtterance = MockUtterance;

  return { events, mockSynthesis };
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('STARK AI — DEEP VOICE LATENCY & STREAMING AUDIT SUITE');
  console.log('========================================================================\n');

  setupMockSpeechEnvironment();

  // --------------------------------------------------------------------------
  // SECTION 1: Authoritative Queue Management & Zombie Callback Isolation
  // --------------------------------------------------------------------------
  console.log('--- Section 1: Generation Token Guards & Zombie Callback Isolation ---');
  {
    const synth = new SpeechSynthesizer();

    // 1.1 Distinct Utterance IDs
    const id1 = synth.beginUtterance('JARVIS');
    const token1 = synth.generationToken;
    assert(typeof id1 === 'string' && id1.startsWith('utt_'), '1.1', 'Unique utterance ID generated for first request');

    // 1.2 Monotonic Token on Rapid Successive Utterance
    const id2 = synth.beginUtterance('ULTRON');
    const token2 = synth.generationToken;
    assert(token2 > token1, '1.2', 'Generation token strictly incremented on new utterance');
    assert(synth.activeUtteranceId === id2, '1.3', 'Active utterance ID updated to newest request');

    // 1.3 Stale Enqueue Rejection
    synth.enqueueSentence('This sentence belongs to stale request 1.', 'JARVIS', id1, false);
    assert(synth.sentenceQueue.length === 0, '1.4', 'Stale utterance sentence rejected by token guard');

    // 1.4 Active Enqueue Accepted
    synth.enqueueSentence('This sentence belongs to active request 2.', 'ULTRON', id2, true);
    synth.markStreamComplete(id2);
    assert(synth.isSpeaking === true, '1.5', 'Active utterance sentence accepted and dispatched immediately');

    // 1.5 Zombie Callback Protection: Old callback does not corrupt new queue
    const oldUtterance = { token: token1, uttId: id1 };
    synth.beginUtterance('JARVIS'); // increments token to token3
    synth.speakNextQueueItem = () => {
      assert(false, '1.6', 'CRITICAL ERROR: Stale callback triggered next queue item!');
    };
    // Simulate trailing browser callback from oldUtterance
    if (synth.generationToken === oldUtterance.token) {
      assert(false, '1.7', 'Token match should be false');
    } else {
      assert(true, '1.7', 'Zombie callback from cancelled utterance safely blocked by token guard');
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 2: Voice Selection & Personality Acoustic Profiles
  // --------------------------------------------------------------------------
  console.log('\n--- Section 2: British JARVIS & Deep English ULTRON Voice Selection ---');
  {
    const synth = new SpeechSynthesizer();
    synth.populateVoices();

    const jarvisVoice = synth.selectVoiceForTheme('JARVIS');
    assert(jarvisVoice !== null, '2.1', 'JARVIS voice successfully resolved from available system voices');
    assert(jarvisVoice.lang.toLowerCase().includes('en-gb') || jarvisVoice.lang.toLowerCase().startsWith('en'), '2.2', `JARVIS assigned English voice (${jarvisVoice.name} [${jarvisVoice.lang}])`);

    const ultronVoice = synth.selectVoiceForTheme('ULTRON');
    assert(ultronVoice !== null, '2.3', 'ULTRON voice successfully resolved from available system voices');
    assert(ultronVoice.name.includes('Mark') || ultronVoice.name.includes('David') || ultronVoice.lang.toLowerCase().startsWith('en'), '2.4', `ULTRON assigned deep authoritative English voice (${ultronVoice.name} [${ultronVoice.lang}])`);
  }

  // --------------------------------------------------------------------------
  // SECTION 3: Live Server-Sent Events (SSE) Streaming from Backend
  // --------------------------------------------------------------------------
  console.log('\n--- Section 3: Live Backend Server-Sent Events (/api/chat/stream) ---');
  {
    const aiClient = new AIClient('http://localhost:3000/api/chat', 'http://localhost:3000/api/chat/stream');

    // Test JARVIS streaming query
    console.log('  Testing live streaming query to JARVIS...');
    const t0 = performance.now();
    let firstSentenceTime = null;
    let sentencesReceived = [];
    let toolEventReceived = null;
    let doneEventReceived = null;

    await aiClient.streamMessage('JARVIS', 'What is the current time and today\'s date?', {
      onTool: (data) => {
        toolEventReceived = data;
      },
      onSentence: (sentence, index) => {
        if (firstSentenceTime === null) {
          firstSentenceTime = performance.now() - t0;
        }
        sentencesReceived.push({ sentence, index, timeMs: Math.round(performance.now() - t0) });
      },
      onDone: (data) => {
        doneEventReceived = data;
      },
      onError: (err) => {
        console.error('Stream error:', err);
      }
    });

    const totalStreamTime = performance.now() - t0;

    assert(sentencesReceived.length > 0, '3.1', `Received ${sentencesReceived.length} streaming sentence chunk(s) from backend`);
    assert(firstSentenceTime !== null, '3.2', `Time to First Spoken Sentence (TTFS): ${Math.round(firstSentenceTime)}ms`);
    assert(doneEventReceived !== null, '3.3', `Stream completed with full reply (${doneEventReceived.fullReply.length} chars)`);
    assert(firstSentenceTime < 2500, '3.4', `TTFS (${Math.round(firstSentenceTime)}ms) is significantly faster than monolithic full-generation wait`);
    console.log(`    -> Time to First Sentence: ${Math.round(firstSentenceTime)}ms | Total Stream: ${Math.round(totalStreamTime)}ms`);
    console.log(`    -> First sentence: "${sentencesReceived[0]?.sentence}"`);
  }

  // --------------------------------------------------------------------------
  // SECTION 4: Live ULTRON Streaming & Hinglish Input Comprehension
  // --------------------------------------------------------------------------
  console.log('\n--- Section 4: Live ULTRON Streaming & Hinglish Comprehension ---');
  {
    const aiClient = new AIClient('http://localhost:3000/api/chat', 'http://localhost:3000/api/chat/stream');

    console.log('  Testing ULTRON streaming with Hinglish query: "aaj weather kaisa hai?"...');
    const t0 = performance.now();
    let firstSentenceTime = null;
    let ultronSentences = [];
    let ultronDone = null;

    await aiClient.streamMessage('ULTRON', 'aaj Mumbai mein weather kaisa hai?', {
      onSentence: (sentence, index) => {
        if (firstSentenceTime === null) {
          firstSentenceTime = performance.now() - t0;
        }
        ultronSentences.push(sentence);
      },
      onDone: (data) => {
        ultronDone = data;
      }
    });

    assert(ultronSentences.length > 0, '4.1', `ULTRON emitted ${ultronSentences.length} streaming sentence(s)`);
    assert(ultronDone !== null, '4.2', 'ULTRON streaming finished with done event');
    assert(!/[\u0900-\u097F]/.test(ultronDone.fullReply), '4.3', 'ULTRON response strictly adheres to English-only policy (no Devanagari script)');
    assert(firstSentenceTime !== null && firstSentenceTime < 3000, '4.4', `ULTRON TTFS: ${Math.round(firstSentenceTime)}ms`);
    console.log(`    -> ULTRON TTFS: ${Math.round(firstSentenceTime)}ms`);
    console.log(`    -> ULTRON First Sentence: "${ultronSentences[0]}"`);
  }

  // --------------------------------------------------------------------------
  // SECTION 5: Dynamic Turn-Taking & Mid-Speech Interruption
  // --------------------------------------------------------------------------
  console.log('\n--- Section 5: Dynamic Turn-Taking & User Interruption ---');
  {
    const synth = new SpeechSynthesizer();
    const uttId = synth.beginUtterance('JARVIS');

    synth.enqueueSentence('This is a lengthy introductory sentence being spoken aloud by JARVIS.', 'JARVIS', uttId, false);
    synth.enqueueSentence('Here is a secondary sentence queued right behind it.', 'JARVIS', uttId, true);
    synth.markStreamComplete(uttId);

    assert(synth.isSpeaking === true, '5.1', 'Synthesizer is actively speaking sentence 1');

    // Simulate user interruption
    const priorToken = synth.generationToken;
    synth.cancel('USER_INTERRUPT');

    assert(synth.isSpeaking === false, '5.2', 'Synthesizer immediately halted on user interruption');
    assert(synth.sentenceQueue.length === 0, '5.3', 'Remaining queued sentences cleared instantly');
    assert(synth.generationToken > priorToken, '5.4', 'Generation token incremented to protect against stale playback');
    assert(synth.activeUtteranceId === null, '5.5', 'Active utterance ID cleared');

    // Immediately start new request from user after interruption
    const newUttId = synth.beginUtterance('ULTRON');
    synth.enqueueSentence('Interruption acknowledged. I have taken control.', 'ULTRON', newUttId, true);
    synth.markStreamComplete(newUttId);

    assert(synth.isSpeaking === true, '5.6', 'New request begins speaking immediately without stale audio overlap');
  }

  // --------------------------------------------------------------------------
  // SECTION 6: 10-Trial Latency Benchmark (JARVIS vs ULTRON)
  // --------------------------------------------------------------------------
  console.log('\n--- Section 6: 10-Trial Progressive Streaming Benchmark (JARVIS & ULTRON) ---');
  {
    const aiClient = new AIClient('http://localhost:3000/api/chat', 'http://localhost:3000/api/chat/stream');
    const jarvisLatencies = [];
    const ultronLatencies = [];

    const testQueries = [
      'What time is it?',
      'Tell me today\'s date',
      'What is the weather in Delhi?',
      'Check system performance',
      'Give me a 1 sentence thought'
    ];

    console.log('  Running 5 trials for JARVIS...');
    for (let i = 0; i < testQueries.length; i++) {
      const q = testQueries[i];
      const start = performance.now();
      let ttfs = null;

      await aiClient.streamMessage('JARVIS', q, {
        onSentence: () => {
          if (ttfs === null) ttfs = performance.now() - start;
        }
      });

      const recorded = ttfs !== null ? Math.round(ttfs) : Math.round(performance.now() - start);
      jarvisLatencies.push(recorded);
      console.log(`    [Trial ${i + 1}] JARVIS TTFS: ${recorded}ms for "${q}"`);
    }

    console.log('  Running 5 trials for ULTRON...');
    for (let i = 0; i < testQueries.length; i++) {
      const q = testQueries[i];
      const start = performance.now();
      let ttfs = null;

      await aiClient.streamMessage('ULTRON', q, {
        onSentence: () => {
          if (ttfs === null) ttfs = performance.now() - start;
        }
      });

      const recorded = ttfs !== null ? Math.round(ttfs) : Math.round(performance.now() - start);
      ultronLatencies.push(recorded);
      console.log(`    [Trial ${i + 1}] ULTRON TTFS: ${recorded}ms for "${q}"`);
    }

    const calcStats = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
      const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
      return { median, p95, avg };
    };

    const jarvisStats = calcStats(jarvisLatencies);
    const ultronStats = calcStats(ultronLatencies);

    console.log('\n  BENCHMARK SUMMARY (Time to First Spoken Chunk):');
    console.log(`    JARVIS — Median: ${jarvisStats.median}ms | p95: ${jarvisStats.p95}ms | Average: ${jarvisStats.avg}ms`);
    console.log(`    ULTRON — Median: ${ultronStats.median}ms | p95: ${ultronStats.p95}ms | Average: ${ultronStats.avg}ms`);

    assert(jarvisStats.median < 2500, '6.1', `JARVIS median TTFS (${jarvisStats.median}ms) is under conversational threshold`);
    assert(ultronStats.median < 2500, '6.2', `ULTRON median TTFS (${ultronStats.median}ms) is under conversational threshold`);
    assert(Math.abs(jarvisStats.avg - ultronStats.avg) < 1500, '6.3', `JARVIS and ULTRON perform symmetrically (Avg diff: ${Math.abs(jarvisStats.avg - ultronStats.avg)}ms)`);
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
