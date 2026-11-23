/**
 * Test Suite: VISION v1.3 Conversational Tool Intelligence Engine
 * tests/test_v13_tool_engine.js
 */

const assert = require('assert');
const { conversationalToolEngineInstance } = require('../server/tools/conversationalToolEngine.js');

async function runToolEngineTests() {
  console.log('='.repeat(60));
  console.log('TEST SUITE: VISION v1.3 CONVERSATIONAL TOOL ENGINE');
  console.log('='.repeat(60));

  // 1. Malformed JSON Recovery
  console.log('\n--- 1. Malformed JSON Recovery ---');
  // Trailing comma + single quotes
  const badJson1 = "{'tool': 'get_weather', 'arguments': {'city': 'Delhi',}}";
  const rec1 = conversationalToolEngineInstance.recoverMalformedJson(badJson1);
  assert.strictEqual(rec1?.tool, 'get_weather');
  assert.strictEqual(rec1?.arguments?.city, 'Delhi');

  // Markdown fences + unclosed brace
  const badJson2 = "```json\n{\"tool\": \"open_desktop_app\", \"arguments\": {\"app_name\": \"vscode\"";
  const rec2 = conversationalToolEngineInstance.recoverMalformedJson(badJson2);
  assert.strictEqual(rec2?.tool, 'open_desktop_app');
  assert.strictEqual(rec2?.arguments?.app_name, 'vscode');
  console.log('Malformed JSON recovery passed for all test cases.');

  // 2. Argument Validation and Normalization
  console.log('\n--- 2. Argument Validation & Normalization ---');
  const norm1 = conversationalToolEngineInstance.validateAndNormalizeArgs('get_weather', { city: 'Paris' });
  assert.strictEqual(norm1.args.location, 'Paris');
  assert.strictEqual(norm1.args.unit, 'Celsius');

  const norm2 = conversationalToolEngineInstance.validateAndNormalizeArgs('calculate_expression', { query: '15 * 12' });
  assert.strictEqual(norm2.args.expression, '15 * 12');
  console.log('Argument validation and normalization passed.');

  // 3. Duplicate Action Prevention
  console.log('\n--- 3. Duplicate Action Prevention ---');
  const d1 = conversationalToolEngineInstance.checkDuplicateAction('test_dup_tool', {});
  assert.strictEqual(d1.isDuplicate, false);
  const d2 = conversationalToolEngineInstance.checkDuplicateAction('test_dup_tool', {});
  assert.strictEqual(d2.isDuplicate, false);
  // Third rapid identical invocation should be blocked
  const d3 = conversationalToolEngineInstance.checkDuplicateAction('test_dup_tool', {});
  assert.strictEqual(d3.isDuplicate, true, 'Expected duplicate action to be blocked');
  console.log('Duplicate action block passed.');

  // 4. Execution & Verification
  console.log('\n--- 4. Live Tool Execution & Structured Verification ---');
  const execRes = await conversationalToolEngineInstance.executeConversationalTool('get_current_time', {}, 'JARVIS');
  assert.strictEqual(execRes.success, true);
  assert.strictEqual(execRes.verified, true);
  assert(execRes.summary.includes('Current time') || execRes.summary.includes(':'));
  console.log(`Live execution verified: "${execRes.summary}" (${execRes.latencyMs}ms)`);

  console.log('\nAll Conversational Tool Engine tests PASSED successfully!');
  console.log('='.repeat(60));
}

runToolEngineTests().catch(err => {
  console.error('Tool engine test failed:', err);
  process.exit(1);
});
