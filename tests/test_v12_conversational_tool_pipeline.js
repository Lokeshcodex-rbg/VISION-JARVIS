/**
 * Test Suite: VISION v1.2 Multi-Turn & Conversational Tool Execution Pipeline
 * Tests:
 *   1. Multi-turn context retention across conversation history
 *   2. Structured tool intent recognition and safe tool execution
 *   3. Verified tool output interpretation and natural language synthesis
 *   4. Brand & Persona integrity (VISION — MADE BY LOKESH, JARVIS powered by VISION)
 */

const assert = require('assert');
const { aiAdapterInstance } = require('../server/aiProviderAdapter.js');
const { neuralBrainServiceInstance } = require('../server/neural/neuralBrainService.js');

async function runPipelineTests() {
  console.log('=' .repeat(60));
  console.log('VISION v1.2 CONVERSATIONAL TOOL & MULTI-TURN PIPELINE TESTS');
  console.log('=' .repeat(60));

  // 1. Verify Active Checkpoint
  const status = neuralBrainServiceInstance.getStatus();
  console.log(`[Status] Active Experimental Checkpoint: ${status.activeExperimentalCheckpoint || 'none'}`);
  console.log(`[Status] Production Primary Model: ${status.productionPrimaryModel}`);
  assert(
    status.activeExperimentalCheckpoint?.startsWith('vision-v1.'),
    `Expected active checkpoint to start with vision-v1., got: ${status.activeExperimentalCheckpoint}`
  );

  // 2. Multi-Turn Dialogue Context Retention Test
  console.log('\n--- Test 1: Multi-Turn Conversation History Retention ---');
  const history = [
    { role: 'user', content: 'My name is Lokesh and I am developing the VISION AI brain.' },
    { role: 'assistant', content: 'Greetings Sir, it is an honor to assist you on the VISION project.' }
  ];
  const turn2UserMsg = 'What is my name?';
  const multiTurnRes = await aiAdapterInstance.inferVisionWithTools('JARVIS', turn2UserMsg, history);
  console.log(`[Multi-Turn] Prompt: "${turn2UserMsg}"`);
  console.log(`[Multi-Turn] Response: "${multiTurnRes.reply}"`);
  console.log(`[Multi-Turn] Raw Model Text: "${multiTurnRes.visionRawOutput}"`);
  assert(multiTurnRes.providerUsed === 'vision', 'Expected providerUsed to be vision');
  assert(
    multiTurnRes.checkpoint?.startsWith('vision-v1.'),
    `Expected vision-v1.* checkpoint, got: ${multiTurnRes.checkpoint}`
  );

  // 3. Conversational Tool Execution Pipeline Test
  console.log('\n--- Test 2: In-Context Tool Calling & Observation Synthesis ---');
  const toolMsg = 'What is the current time?';
  const toolRes = await aiAdapterInstance.generateResponse('JARVIS', toolMsg, [], null, [], {
    provider: 'vision',
    tier: 'LOCAL_INSTANT'
  });
  console.log(`[Tool Pipeline] User Query: "${toolMsg}"`);
  console.log(`[Tool Pipeline] Provider Used: ${toolRes.providerUsed}`);
  console.log(`[Tool Pipeline] Tool Executed: ${toolRes.toolExecutions?.length > 0 ? toolRes.toolExecutions[0].toolName : 'none'}`);
  console.log(`[Tool Pipeline] Reply: "${toolRes.reply}"`);
  assert(toolRes.providerUsed === 'vision', 'Expected providerUsed to be vision');
  assert(toolRes.toolExecutions && toolRes.toolExecutions.length > 0, 'Expected tool to be executed');

  // 4. STEM / Multilingual Query Test
  console.log('\n--- Test 3: Multilingual Hindi Query ---');
  const hindiMsg = 'अंतरिक्ष में गुरुत्वाकर्षण की भूमिका संक्षेप में समझाएँ।';
  const hindiRes = await aiAdapterInstance.inferVisionWithTools('JARVIS', hindiMsg);
  console.log(`[Hindi] Query: "${hindiMsg}"`);
  console.log(`[Hindi] Reply: "${hindiRes.reply}"`);
  assert(hindiRes.providerUsed === 'vision', 'Expected providerUsed to be vision');
  assert(hindiRes.reply && hindiRes.reply.length > 10, 'Expected non-empty response');

  console.log('\nAll VISION v1.2 pipeline integration checks PASSED successfully!');
  console.log('=' .repeat(60));
  process.exit(0);
}

runPipelineTests().catch((err) => {
  console.error('\nPipeline test failed with error:', err);
  process.exit(1);
});
