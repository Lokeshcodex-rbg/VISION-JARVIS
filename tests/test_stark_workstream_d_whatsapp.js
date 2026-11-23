/**
 * Acceptance Test: Workstream D — WhatsApp Contact Resolution, Calling & Tool Registration
 */

const assert = require('assert');
const { whatsappServiceInstance } = require('../server/desktop/whatsappService.js');
const { commandInterpreterInstance } = require('../server/commandInterpreter.js');
const { executeTool } = require('../server/toolsRegistry.js');

async function runTests() {
  console.log('=== TEST SUITE: WORKSTREAM D (WhatsApp Resolution & Calling Tools) ===');

  // Test 1: Resolve "Harsh Upadhyay" from contact book
  const resHarsh = whatsappServiceInstance.resolveContact('Harsh Upadhyay');
  assert(resHarsh.status === 'exact_match' || resHarsh.status === 'partial_match', 'Must resolve Harsh Upadhyay');
  assert.strictEqual(resHarsh.contact.fullName, 'Harsh Upadhyay', 'Contact full name must match');
  console.log('  [PASS] Contact resolution verified:', resHarsh.contact.fullName, resHarsh.contact.phone);

  // Test 2: Resolve "Lokesh Upadhyay"
  const resLokesh = whatsappServiceInstance.resolveContact('Lokesh Upadhyay');
  assert.strictEqual(resLokesh.contact.fullName, 'Lokesh Upadhyay');
  console.log('  [PASS] Contact resolution verified:', resLokesh.contact.fullName);

  // Test 3: Verify call_whatsapp_contact exists in toolsRegistry
  const callState = await executeTool('get_whatsapp_call_state', {}, 'JARVIS');
  assert(callState, 'get_whatsapp_call_state must return valid state');
  console.log('  [PASS] get_whatsapp_call_state tool execution verified:', callState.status);

  // Test 4: Verify initiateCall sandbox simulation
  whatsappServiceInstance.sandboxMode = true;
  const simCall = await executeTool('call_whatsapp_contact', { recipient: 'Harsh Upadhyay', userConfirmed: true }, 'JARVIS');
  assert.strictEqual(simCall.status, 'call_initiated', 'Call must be initiated');
  assert.strictEqual(simCall.contact.fullName, 'Harsh Upadhyay');
  console.log('  [PASS] call_whatsapp_contact execution verified:', simCall.summary);

  // Test 5: Verify end_whatsapp_call tool
  const endCall = await executeTool('end_whatsapp_call', {}, 'JARVIS');
  assert(endCall.status === 'call_ended' || endCall.status === 'idle', 'end_whatsapp_call must disconnect');
  console.log('  [PASS] end_whatsapp_call execution verified');

  // Test 6: Compound "open whatsapp and text/send/msg <Multi-word Contact> <Message>" parsing
  for (const cmd of [
    'open whatsapp and text Lokesh Upadhyay Hii',
    'open whatsapp and send Lokesh Upadhyay Hii',
    'open whatsapp and msg Lokesh Upadhyay Hii'
  ]) {
    const parsed = commandInterpreterInstance.interpret(cmd);
    assert.strictEqual(parsed.matched, true, `Must match: ${cmd}`);
    assert.strictEqual(parsed.toolName, 'stage_whatsapp_message', `Must stage message: ${cmd}`);
    assert.strictEqual(parsed.args.contact, 'Lokesh Upadhyay', `Must resolve full contact: ${cmd}`);
    assert.strictEqual(parsed.args.recipient, 'Lokesh Upadhyay', `Must set recipient: ${cmd}`);
    assert.strictEqual(parsed.args.messageText, 'Hii', `Must extract exact message 'Hii': ${cmd}`);
    assert.strictEqual(parsed.args.openApp, true, `Must request openApp: ${cmd}`);
  }
  const entities = whatsappServiceInstance.extractMessagingEntities('open whatsapp and text Lokesh Upadhyay Hii');
  assert.strictEqual(entities.isMessagingIntent, true);
  assert.strictEqual(entities.recipient, 'Lokesh Upadhyay');
  assert.strictEqual(entities.messageText, 'Hii');
  assert.strictEqual(entities.openApp, true);

  const nonWa = commandInterpreterInstance.interpret('hello how are you text me');
  assert.notStrictEqual(nonWa.toolName, 'stage_whatsapp_message', 'Must not emit empty-contact stage_whatsapp_message');
  console.log('  [PASS] Compound WhatsApp text/send/msg parsing verified (Lokesh Upadhyay -> Hii)');

  whatsappServiceInstance.sandboxMode = false;
  console.log('=== WORKSTREAM D: ALL ACCEPTANCE TESTS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
