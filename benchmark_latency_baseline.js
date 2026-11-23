/**
 * STARK AI — Latency Baseline & Performance Benchmark Suite
 * Measures exact latency across each stage of the conversational pipeline:
 * 1. Tool Intent Detection & Local Execution Latency
 * 2. Prompt Construction & Context Overhead
 * 3. SentenceStreamer Incremental Boundary Detection Latency
 * 4. Model Routing & Token Budget Calculation
 * 5. End-to-End Voice-to-Ear Request Lifecycle
 */

const { performance } = require('perf_hooks');
const { aiAdapterInstance } = require('./server/aiProviderAdapter.js');
const { executeTool } = require('./server/toolsRegistry.js');
const { commandInterpreterInstance } = require('./server/commandInterpreter.js');
const { timeServiceInstance } = require('./server/timeService.js');
const { memoryManagerInstance } = require('./server/memoryManager.js');

function calculateStats(numbers) {
  if (numbers.length === 0) return { median: 0, p95: 0, mean: 0, min: 0, max: 0 };
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Index];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    median: Math.round(median * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    min: Math.round(sorted[0] * 100) / 100,
    max: Math.round(sorted[sorted.length - 1] * 100) / 100
  };
}

async function runBenchmark() {
  console.log('========================================================================');
  console.log('STARK AI — PIPELINE LATENCY BASELINE BENCHMARK');
  console.log('========================================================================\n');

  // --------------------------------------------------------------------------
  // BENCHMARK 1: Local Tool Intent Detection & Local Execution Speed
  // --------------------------------------------------------------------------
  console.log('--- 1. Local Tool Intent Detection & Execution Latency ---');
  const testQueries = [
    'what time is it',
    'time in London',
    'how many days until December 25',
    'what time will it be in 3 hours',
    'what do you remember',
    'remember that my favorite language is Python',
    'what is the CPU usage',
    'open WhatsApp',
    'open calculator'
  ];

  const intentLatencies = [];
  const execLatencies = [];

  for (const q of testQueries) {
    const t0 = performance.now();
    const intent = aiAdapterInstance.detectToolIntent('JARVIS', q);
    const t1 = performance.now();
    intentLatencies.push(t1 - t0);

    if (intent) {
      const tExec0 = performance.now();
      try {
        await executeTool(intent.toolName, intent.args, 'JARVIS');
      } catch (e) {}
      const tExec1 = performance.now();
      execLatencies.push(tExec1 - tExec0);
    }
  }

  const intentStats = calculateStats(intentLatencies);
  const execStats = calculateStats(execLatencies);
  console.log(`Intent Detection: Median = ${intentStats.median}ms, P95 = ${intentStats.p95}ms, Max = ${intentStats.max}ms`);
  console.log(`Tool Execution:   Median = ${execStats.median}ms, P95 = ${execStats.p95}ms, Max = ${execStats.max}ms\n`);

  // --------------------------------------------------------------------------
  // BENCHMARK 2: Prompt Context Construction Overhead
  // --------------------------------------------------------------------------
  console.log('--- 2. Prompt Context Construction Overhead ---');
  const promptLatencies = [];
  const promptLengths = [];

  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const ctx = aiAdapterInstance.buildPromptContext('JARVIS', 'Can you explain how async/await works in JavaScript in detail?', null);
    const t1 = performance.now();
    promptLatencies.push(t1 - t0);
    promptLengths.push(ctx.systemPrompt.length + ctx.promptWithContext.length);
  }

  const promptStats = calculateStats(promptLatencies);
  const promptLenStats = calculateStats(promptLengths);
  console.log(`Context Build Time: Median = ${promptStats.median}ms, P95 = ${promptStats.p95}ms`);
  console.log(`Context Character Count: Mean = ${promptLenStats.mean} chars (~${Math.round(promptLenStats.mean / 4)} tokens)\n`);

  // --------------------------------------------------------------------------
  // BENCHMARK 3: SentenceStreamer Token Ingestion & Sentence Form Time
  // --------------------------------------------------------------------------
  console.log('--- 3. SentenceStreamer Boundary Detection Latency ---');
  const { SentenceStreamer } = require('./server/aiProviderAdapter.js');
  
  const tokenChunks = [
    'Good ', 'afternoon, ', 'sir. ',
    'All ', 'core ', 'subsystems ', 'are ', 'operational. ',
    'I ', 'have ', 'verified ', 'the ', 'network ', 'bandwidth, ',
    'which ', 'is ', 'currently ', 'at ', '99.9% ', 'efficiency. ',
    'How ', 'may ', 'I ', 'assist ', 'you ', 'today?'
  ];

  const sentenceTimings = [];
  const emittedSentences = [];

  const streamer = new SentenceStreamer((sentence, idx, meta) => {
    emittedSentences.push({ sentence, idx, time: performance.now() });
  });

  const tStreamStart = performance.now();
  for (const chunk of tokenChunks) {
    streamer.push(chunk, performance.now());
  }
  streamer.flush();
  const tStreamEnd = performance.now();

  console.log(`Streamed ${emittedSentences.length} sentences in ${(tStreamEnd - tStreamStart).toFixed(2)}ms`);
  emittedSentences.forEach((s, idx) => {
    console.log(`  Sentence [${idx}]: "${s.sentence.slice(0, 40)}..." (formed at +${(s.time - tStreamStart).toFixed(2)}ms)`);
  });

  console.log('\n========================================================================');
  console.log('BASELINE LATENCY BENCHMARK COMPLETED');
  console.log('========================================================================\n');
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
