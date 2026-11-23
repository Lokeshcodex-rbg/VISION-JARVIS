/**
 * Acceptance Test: Workstream A — Personality, Conversational Intelligence & Continuity
 */

const assert = require('assert');
const { unifiedIntelligenceLayerInstance } = require('../server/unifiedIntelligenceLayer.js');

async function runTests() {
  console.log('=== TEST SUITE: WORKSTREAM A (Personality & Conversation Classification) ===');

  // Test 1: "I'm bored" should route to CONVERSATION, not desktop tools or coding
  const c1 = unifiedIntelligenceLayerInstance.classifyTask("JARVIS, I'm bored");
  assert.strictEqual(c1.category, 'CONVERSATION', "Bored prompt must classify as CONVERSATION");
  console.log('  [PASS] "I\'m bored" -> CONVERSATION verified');

  // Test 2: "Tell me something interesting" should route to CONVERSATION
  const c2 = unifiedIntelligenceLayerInstance.classifyTask("Tell me something interesting about black holes");
  assert.strictEqual(c2.category, 'CONVERSATION', "Interesting query must classify as CONVERSATION");
  console.log('  [PASS] "Tell me something interesting" -> CONVERSATION verified');

  // Test 3: "Test night vision" must NOT misclassify as software coding!
  const c3 = unifiedIntelligenceLayerInstance.classifyTask("JARVIS, test night vision");
  assert.notStrictEqual(c3.category, 'CODING', "Night vision must not be classified as CODING");
  console.log('  [PASS] "Test night vision" avoided CODING misclassification');

  // Test 4: "Call Harsh Upadhyay" must classify as EXTERNAL_COMMUNICATION
  const c4 = unifiedIntelligenceLayerInstance.classifyTask("Call Harsh Upadhyay");
  assert.strictEqual(c4.category, 'EXTERNAL_COMMUNICATION', "Call must classify as EXTERNAL_COMMUNICATION");
  console.log('  [PASS] "Call Harsh Upadhyay" -> EXTERNAL_COMMUNICATION verified');

  // Test 5: "Unit test the authentication module" still correctly classifies as CODING
  const c5 = unifiedIntelligenceLayerInstance.classifyTask("Run unit test for auth module");
  assert.strictEqual(c5.category, 'CODING', "Actual software tests must classify as CODING");
  console.log('  [PASS] "Run unit test" -> CODING verified');

  console.log('=== WORKSTREAM A: ALL ACCEPTANCE TESTS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
