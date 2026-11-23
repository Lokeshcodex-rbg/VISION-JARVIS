/**
 * Unit Test Suite for test_sub_agent_mvo6chd7
 */

const assert = require('assert');
const { Agent } = require('../index.js');

async function runTests() {
  console.log('Running test suite for: test_sub_agent_mvo6chd7');
  const agent = new Agent();
  assert(agent, 'Agent should instantiate properly');
  
  const res = await agent.processQuery('Hello world');
  assert.strictEqual(res.agent, 'test_sub_agent_mvo6chd7');
  assert(res.reply.includes('Hello world'));
  console.log('  [PASS]: Agent processes query and returns structured response');
}

runTests().then(() => {
  console.log('All tests passed.');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
