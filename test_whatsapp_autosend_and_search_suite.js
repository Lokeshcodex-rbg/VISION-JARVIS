/**
 * TEST SUITE: WhatsApp Visual Search, Clean Text Parsing, and Auto-Dispatch Verification
 * Verifies:
 * 1. Intent extraction of contact, clean message body, and auto-send directive.
 * 2. Elimination of unwanted contact creation.
 * 3. Autonomous dispatch flow when user command includes "and send it".
 * 4. Preservation of Emergency Stop invariants.
 */

const assert = require('assert');
const { aiAdapterInstance } = require('./server/aiProviderAdapter');
const { whatsappServiceInstance } = require('./server/desktop/whatsappService');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController');

async function runSuite() {
  console.log('=== RUNNING WHATSAPP AUTOSEND & VISUAL SEARCH TEST SUITE ===\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. Natural Language Intent Parsing & Wrapper Cleaning
  test('1.1: "text Lokesh upadhyay and write what are you doing and send it" triggers send_whatsapp_message with cleaned body and confirmed: true', () => {
    const res = aiAdapterInstance.detectToolIntent('JARVIS', 'text Lokesh upadhyay and write what are you doing and send it');
    assert.ok(res, 'Intent should be detected');
    assert.strictEqual(res.toolName, 'send_whatsapp_message');
    assert.strictEqual(res.args.contact, 'Lokesh Upadhyay');
    assert.strictEqual(res.args.messageText, 'what are you doing');
    assert.strictEqual(res.args.userConfirmed, true);
  });

  test('1.2: "text to Lokesh upadhyay and write what are you doing and send it" strips leading "to" from contact', () => {
    const res = aiAdapterInstance.detectToolIntent('JARVIS', 'text to Lokesh upadhyay and write what are you doing and send it');
    assert.ok(res);
    assert.strictEqual(res.toolName, 'send_whatsapp_message');
    assert.strictEqual(res.args.contact, 'Lokesh Upadhyay');
    assert.strictEqual(res.args.messageText, 'what are you doing');
    assert.strictEqual(res.args.userConfirmed, true);
  });

  test('1.3: "text Lokesh write what are you doing" without send keyword triggers stage_whatsapp_message', () => {
    const res = aiAdapterInstance.detectToolIntent('JARVIS', 'text Lokesh write what are you doing');
    assert.ok(res);
    assert.strictEqual(res.toolName, 'stage_whatsapp_message');
    assert.strictEqual(res.args.contact, 'Lokesh Upadhyay');
    assert.strictEqual(res.args.messageText, 'what are you doing');
    assert.strictEqual(res.args.userConfirmed, undefined);
  });

  test('1.4: "send message to Lokesh upadhyay write what are you doing and send it" handles prefix verb', () => {
    const res = aiAdapterInstance.detectToolIntent('JARVIS', 'send message to Lokesh upadhyay write what are you doing and send it');
    assert.ok(res);
    assert.strictEqual(res.toolName, 'send_whatsapp_message');
    assert.strictEqual(res.args.contact, 'Lokesh Upadhyay');
    assert.strictEqual(res.args.messageText, 'what are you doing');
    assert.strictEqual(res.args.userConfirmed, true);
  });

  test('1.5: "Lokesh upadhyay ko whatsapp karo ki what are you doing aur bhej do" handles Hinglish with auto-send', () => {
    const res = aiAdapterInstance.detectToolIntent('JARVIS', 'Lokesh upadhyay ko whatsapp karo ki what are you doing aur bhej do');
    assert.ok(res);
    assert.strictEqual(res.toolName, 'send_whatsapp_message');
    assert.strictEqual(res.args.contact, 'Lokesh Upadhyay');
    assert.strictEqual(res.args.messageText, 'what are you doing');
    assert.strictEqual(res.args.userConfirmed, true);
  });

  // 2. Zero Unwanted Contact Creation
  test('2.1: Contact lookup for existing contact never mutates contacts list', () => {
    whatsappServiceInstance.initContacts();
    const initialCount = whatsappServiceInstance.contacts.length;
    const res = whatsappServiceInstance.resolveContact('Lokesh Upadhyay');
    assert.strictEqual(res.status, 'exact_match');
    assert.strictEqual(whatsappServiceInstance.contacts.length, initialCount, 'Contacts count must remain invariant');
  });

  test('2.2: Searching for an unknown contact does not create a new contact unless explicitly requested', () => {
    whatsappServiceInstance.initContacts();
    const initialCount = whatsappServiceInstance.contacts.length;
    const res = whatsappServiceInstance.resolveContact('NonExistentPersonXYZ');
    assert.strictEqual(res.status, 'not_found');
    assert.strictEqual(whatsappServiceInstance.contacts.length, initialCount, 'Unknown search must never add contact');
  });

  // 3. Autonomous Dispatch Flow (Sandbox Mode)
  await testAsync('3.1: sendMessage with userConfirmed: true stages and immediately dispatches', async () => {
    whatsappServiceInstance.enableSandboxMode();
    const result = await whatsappServiceInstance.sendMessage('Lokesh Upadhyay', 'what are you doing', true);
    whatsappServiceInstance.disableSandboxMode();
    assert.ok(result);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'dispatched');
    assert.strictEqual(result.recipient, 'Lokesh Upadhyay');
    assert.strictEqual(result.message, 'what are you doing');
  });

  await testAsync('3.2: sendMessage without userConfirmed stages message and leaves pending confirmation', async () => {
    whatsappServiceInstance.enableSandboxMode();
    const result = await whatsappServiceInstance.sendMessage('Lokesh Upadhyay', 'what are you doing', false);
    assert.ok(result);
    assert.strictEqual(result.success, true);
    assert.ok(whatsappServiceInstance.pendingConfirmation, 'Should hold pending confirmation');
    assert.strictEqual(whatsappServiceInstance.pendingConfirmation.recipientName, 'Lokesh Upadhyay');

    // Confirm dispatch
    const dispatchRes = await whatsappServiceInstance.confirmAndDispatchPendingMessage();
    whatsappServiceInstance.disableSandboxMode();
    assert.strictEqual(dispatchRes.success, true);
    assert.strictEqual(dispatchRes.status, 'dispatched');
  });

  // 4. Emergency Stop Safety Invariant
  await testAsync('4.1: Emergency Stop prevents any WhatsApp send operation', async () => {
    emergencyStopControllerInstance.engage('TEST_SAFETY');
    const result = await whatsappServiceInstance.sendMessage('Lokesh Upadhyay', 'what are you doing', true);
    emergencyStopControllerInstance.disengage();
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 'halted_by_emergency_stop');
  });

  console.log(`\n=== TEST SUITE COMPLETE: ${passed}/${total} PASSED ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
