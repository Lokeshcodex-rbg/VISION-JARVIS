/**
 * Test script for verifying multilingual intelligence, English-only responses,
 * real-time tools (weather, time, date, diagnostics) and ULTRON/JARVIS latency.
 */

const { aiAdapterInstance } = require('./server/aiProviderAdapter.js');

async function runTests() {
  const testCases = [
    { pers: 'JARVIS', q: 'aaj weather kaisa hai?', expectedTool: 'get_weather' },
    { pers: 'ULTRON', q: 'mera laptop slow kyun ho raha hai?', expectedTool: 'run_system_diagnostics' },
    { pers: 'JARVIS', q: 'abhi kitna time hua hai?', expectedTool: 'get_current_time' },
    { pers: 'ULTRON', q: 'what time is it in London?', expectedTool: 'get_timezone_time' },
    { pers: 'JARVIS', q: 'what time will it be in two hours?', expectedTool: 'calculate_time_offset' },
    { pers: 'ULTRON', q: 'how many days are left until November 30?', expectedTool: 'calculate_date_difference' },
    { pers: 'JARVIS', q: 'mujhe binary search Java mein samjhao', expectedTool: null }
  ];

  for (const tc of testCases) {
    console.log(`\n============================================================`);
    console.log(`[${tc.pers}] Input: "${tc.q}"`);
    console.log(`============================================================`);

    const intent = aiAdapterInstance.detectToolIntent(tc.pers, tc.q);
    console.log(`Tool Detected: ${intent ? intent.toolName : 'none'} (Expected: ${tc.expectedTool})`);

    const t0 = Date.now();
    const result = await aiAdapterInstance.generateResponse(tc.pers, tc.q);
    const elapsed = Date.now() - t0;

    console.log(`Provider: ${result.provider} | Latency: ${elapsed}ms`);
    console.log(`Tool Result Present: ${Boolean(result.toolResult)}`);
    console.log(`Reply in English: ${/^[a-zA-Z0-9\s.,!?'"()\[\]{}\-–—:;/*+%=#@<>$\n\r`]+$/.test(result.reply.slice(0, 50)) ? 'YES' : 'CHECK'}`);
    console.log(`Reply Preview:\n${result.reply.slice(0, 260)}...\n`);
  }
}

runTests().catch(console.error);
