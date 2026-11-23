/**
 * Verification test for WhatsApp Live Communication & Python Error Fix
 */

const assert = require('assert');
const { whatsappServiceInstance } = require('./server/desktop/whatsappService.js');
const { commandInterpreterInstance } = require('./server/commandInterpreter.js');

async function run() {
  console.log('================================================================');
  console.log('🧪 STARK AI: WHATSAPP LIVE COMMUNICATION & PYTHON ERROR FIX TEST');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(desc, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [FAIL] ${desc}: ${e.message}`);
    }
  }

  async function testAsync(desc, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [FAIL] ${desc}: ${e.message}`);
    }
  }

  // 1. Contact Book includes Papa and Lokesh Upadhyay
  test('Contact Directory contains Papa and Lokesh Upadhyay', () => {
    whatsappServiceInstance.initContacts();
    const papaRes = whatsappServiceInstance.resolveContact('Papa');
    assert.strictEqual(papaRes.status === 'exact_match' || papaRes.status === 'partial_match', true);
    assert.strictEqual(papaRes.contact.name, 'Papa');

    const lokeshRes = whatsappServiceInstance.resolveContact('Lokesh Upadhyay');
    assert.strictEqual(lokeshRes.status, 'exact_match');
    assert.strictEqual(lokeshRes.contact.fullName, 'Lokesh Upadhyay');
  });

  // 2. Strict Contact Resolution: Extra message words never falsely match contact
  test('Strict resolution rejects corrupt candidates like "Lokesh Upadhyay hii"', () => {
    const corruptRes = whatsappServiceInstance.resolveContact('Lokesh Upadhyay hii');
    assert.strictEqual(corruptRes.status, 'not_found');
  });

  // 3. Command Interpreter: "Lokesh Upadhyay Text him hii"
  test('Command Interpreter: "Lokesh Upadhyay Text him hii" preserves message "hii"', () => {
    const res = commandInterpreterInstance.interpret('Lokesh Upadhyay Text him hii');
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.toolName, 'stage_whatsapp_message');
    assert.strictEqual(res.args.contact, 'Lokesh Upadhyay');
    assert.strictEqual(res.args.messageText, 'hii');
  });

  // 4. Command Interpreter: "Lokesh Upadhyay Text him hii then how are you doing"
  test('Command Interpreter: "Lokesh Upadhyay Text him hii then how are you doing"', () => {
    const res = commandInterpreterInstance.interpret('Lokesh Upadhyay Text him hii then how are you doing');
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.toolName, 'stage_whatsapp_message');
    assert.strictEqual(res.args.contact, 'Lokesh Upadhyay');
    assert.strictEqual(res.args.messageText.toLowerCase().includes('hii'), true);
    assert.strictEqual(res.args.messageText.toLowerCase().includes('how are you doing'), true);
  });

  // 5. Command Interpreter: "do the testing in whatsapp Lokesh Upadhyay Text him hii then how are you doing"
  test('Command Interpreter: Long testing sentence parses Lokesh Upadhyay and preserves message', () => {
    const res = commandInterpreterInstance.interpret('do the testing in whatsapp Lokesh Upadhyay Text him hii then how are you doing');
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.toolName, 'stage_whatsapp_message');
    assert.strictEqual(res.args.contact, 'Lokesh Upadhyay');
    assert.strictEqual(res.args.messageText.toLowerCase().includes('hii'), true);
  });

  // 6. WhatsApp Automator: Python execution returns structured JSON without exceptions
  await testAsync('WhatsApp Automator: focus command returns valid JSON', async () => {
    const res = await whatsappServiceInstance.runAutomator('focus');
    assert.strictEqual(typeof res, 'object');
    assert.strictEqual(typeof res.success, 'boolean');
  });

  // 7. Staging and User Confirmation Flow for Lokesh Upadhyay
  await testAsync('WhatsApp Staging: stages draft for Lokesh Upadhyay awaiting confirmation', async () => {
    whatsappServiceInstance.enableSandboxMode();
    const stageRes = await whatsappServiceInstance.stageMessageForUserConfirmation('Lokesh Upadhyay', 'hii then how are you doing');
    assert.strictEqual(stageRes.success, true);
    assert.strictEqual(stageRes.status, 'awaiting_confirmation');
    assert.strictEqual(stageRes.requiresConfirmation, true);
    assert.strictEqual(stageRes.recipient, 'Lokesh Upadhyay');

    const confirmRes = await whatsappServiceInstance.confirmAndDispatchPendingMessage();
    assert.strictEqual(confirmRes.success, true);
    assert.strictEqual(confirmRes.status, 'dispatched');
    whatsappServiceInstance.disableSandboxMode();
  });

  // 8. Companion Mode: When user is BUSY, autonomous friend-talk explains Harsh is busy
  await testAsync('Companion Engine: Autonomous friend-talk when user is BUSY', async () => {
    whatsappServiceInstance.enableSandboxMode();
    whatsappServiceInstance.setUserAvailability('BUSY', 'Working on deep architecture');
    const incomingRes = await whatsappServiceInstance.processIncomingMessage('Lokesh Upadhyay', 'Bro where are you?');
    assert.strictEqual(incomingRes.success, true);
    assert.strictEqual(incomingRes.autonomousResponseSent, true);
    assert.strictEqual(incomingRes.mode, 'AUTONOMOUS_FRIEND_TALK');
    assert.strictEqual(incomingRes.replySent.includes('busy'), true);
    whatsappServiceInstance.setUserAvailability('AVAILABLE');
    whatsappServiceInstance.disableSandboxMode();
  });

  // 9. Companion Mode: When user is AVAILABLE, asks for confirmation before sending reply
  await testAsync('Companion Engine: User review when AVAILABLE', async () => {
    whatsappServiceInstance.enableSandboxMode();
    whatsappServiceInstance.setUserAvailability('AVAILABLE');
    const incomingRes = await whatsappServiceInstance.processIncomingMessage('Lokesh Upadhyay', 'Hii how are you doing?');
    assert.strictEqual(incomingRes.success, true);
    assert.strictEqual(incomingRes.requiresConfirmation, true);
    assert.strictEqual(incomingRes.mode, 'USER_REVIEW_REQUIRED');
    assert.strictEqual(typeof incomingRes.suggestedReply, 'string');
    whatsappServiceInstance.disableSandboxMode();
  });

  // 10. Voice Note in JARVIS's own voice
  await testAsync('JARVIS Own Voice Note: Dispatches voice note for Lokesh Upadhyay', async () => {
    whatsappServiceInstance.enableSandboxMode();
    const voiceRes = await whatsappServiceInstance.sendJarvisVoiceNote('Lokesh Upadhyay', null, 4, true);
    assert.strictEqual(voiceRes.success, true);
    assert.strictEqual(voiceRes.action, 'voice_note_dispatched');
    assert.strictEqual(voiceRes.recipient, 'Lokesh Upadhyay');
    whatsappServiceInstance.disableSandboxMode();
  });

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Results: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`----------------------------------------------------------------`);

  if (passed === total) {
    console.log('🎉 ALL WHATSAPP LIVE COMMUNICATION & PYTHON ERROR FIX TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
