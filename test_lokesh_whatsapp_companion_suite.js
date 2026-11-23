/**
 * STARK AI — Full Testing Suite for WhatsApp Companion Engine & Lokesh Upadhyay Chat
 */

const assert = require('assert');
const { whatsappServiceInstance } = require('./server/desktop/whatsappService.js');
const { appLauncherInstance } = require('./server/desktop/appLauncher.js');
const { aiProviderAdapterInstance } = require('./server/aiProviderAdapter.js');
const { commandInterpreterInstance } = require('./server/commandInterpreter.js');

async function runLokeshCompanionSuite() {
  console.log('================================================================');
  console.log('🧪 STARK AI: LOKESH UPADHYAY WHATSAPP COMPANION & STABILITY SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✕ [FAIL] ${name}: ${e.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✕ [FAIL] ${name}: ${e.message}`);
    }
  }

  // TEST 1: Chrome Launch Bug Fix (No Immediate Close / No Unsafe Taskkill)
  await testAsync('Chrome Stability: Launching Chrome does not kill existing Chrome windows or crash', async () => {
    const res = await appLauncherInstance.launchApplication('chrome');
    assert(res.status === 'already_running' || res.status === 'launched' || res.status === 'launched_unverified');
    assert.strictEqual(res.verified, true);
    console.log(`    Status: ${res.status}, PID: ${res.pid}, Summary: ${res.summary}`);
  });

  // Enable Sandbox Mode for automated messaging without sending real WhatsApp messages
  whatsappServiceInstance.enableSandboxMode();

  // TEST 2: Send "Hii" to Lokesh Upadhyay with 3-phase verification & user confirmation
  await testAsync('Lokesh Upadhyay: Stage message "Hii" -> Verify Directory & Autocomplete -> Confirm -> Send', async () => {
    const stageRes = await whatsappServiceInstance.stageMessageForUserConfirmation('Lokesh Upadhyay', 'Hii');
    assert.strictEqual(stageRes.status, 'awaiting_confirmation');
    assert.strictEqual(stageRes.requiresConfirmation, true);
    assert.strictEqual(stageRes.recipient, 'Lokesh Upadhyay');
    assert.strictEqual(stageRes.phone, '+919876543224');
    assert(stageRes.summary.includes('Lokesh Upadhyay'));
    assert(stageRes.summary.includes('Hii'));

    // Confirm dispatch
    const confirmRes = await whatsappServiceInstance.confirmAndDispatchPendingMessage();
    assert.strictEqual(confirmRes.status, 'dispatched');
    assert.strictEqual(confirmRes.recipient, 'Lokesh Upadhyay');
    assert.strictEqual(confirmRes.message, 'Hii');
  });

  // TEST 3: Send "How are you doing" to Lokesh Upadhyay
  await testAsync('Lokesh Upadhyay: Stage message "How are you doing?" -> Confirm -> Send', async () => {
    const stageRes = await whatsappServiceInstance.stageMessageForUserConfirmation('Lokesh Upadhyay', 'How are you doing?');
    assert.strictEqual(stageRes.status, 'awaiting_confirmation');
    assert.strictEqual(stageRes.recipient, 'Lokesh Upadhyay');

    const confirmRes = await whatsappServiceInstance.confirmAndDispatchPendingMessage();
    assert.strictEqual(confirmRes.status, 'dispatched');
    assert.strictEqual(confirmRes.message, 'How are you doing?');
  });

  // TEST 4: Incoming Message when User is AVAILABLE (JARVIS drafts reply and requests confirmation)
  await testAsync('Incoming Response (Available): Lokesh Upadhyay replies -> JARVIS drafts reply -> Asks confirmation', async () => {
    whatsappServiceInstance.setUserAvailability('AVAILABLE');
    assert.strictEqual(whatsappServiceInstance.userAvailability.status, 'AVAILABLE');

    // Lokesh Upadhyay replies: "I am doing good, how are you?"
    const incomingRes = await whatsappServiceInstance.processIncomingMessage(
      'Lokesh Upadhyay',
      'I am doing good, how are you?'
    );

    assert.strictEqual(incomingRes.success, true);
    assert.strictEqual(incomingRes.mode, 'USER_REVIEW_REQUIRED');
    assert.strictEqual(incomingRes.requiresConfirmation, true);
    assert.strictEqual(incomingRes.contact, 'Lokesh Upadhyay');
    assert(incomingRes.suggestedReply && incomingRes.suggestedReply.length > 5);
    assert(incomingRes.summary.includes('Lokesh Upadhyay responded'));

    // User confirms sending the suggested reply
    const replyConfirm = await whatsappServiceInstance.confirmIncomingReply(true);
    assert.strictEqual(replyConfirm.status, 'dispatched');
    assert.strictEqual(replyConfirm.recipient, 'Lokesh Upadhyay');
  });

  // TEST 5: Autonomous Friend-Talk Mode when User is BUSY / UNAVAILABLE
  await testAsync('Incoming Response (Busy): User is unavailable -> JARVIS chats like a friend telling him Harsh is busy', async () => {
    whatsappServiceInstance.setUserAvailability('BUSY', 'working on the STARK AI project');
    assert.strictEqual(whatsappServiceInstance.userAvailability.status, 'BUSY');

    // Lokesh Upadhyay sends a message while Harsh is busy
    const incomingRes = await whatsappServiceInstance.processIncomingMessage(
      'Lokesh Upadhyay',
      'Hey Harsh, are you free to chat?'
    );

    assert.strictEqual(incomingRes.success, true);
    assert.strictEqual(incomingRes.autonomousResponseSent, true);
    assert.strictEqual(incomingRes.mode, 'AUTONOMOUS_FRIEND_TALK');
    assert.strictEqual(incomingRes.contact, 'Lokesh Upadhyay');
    assert(incomingRes.replySent.includes('busy'), 'Reply must politely state that Harsh is busy');
    assert(incomingRes.replySent.includes('Lokesh'), 'Reply must address Lokesh by first name like a friend');
    assert(incomingRes.summary.includes('responded like a friend'));
    console.log(`    Autonomous friend-talk reply sent to Lokesh: "${incomingRes.replySent}"`);
  });

  // TEST 6: JARVIS Autonomous Voice Message Synthesis & Dispatch
  await testAsync('Voice Note: JARVIS generates his own voice message and sends to Lokesh Upadhyay', async () => {
    const voiceRes = await whatsappServiceInstance.sendJarvisVoiceNote(
      'Lokesh Upadhyay',
      'Hey Lokesh, this is JARVIS. Harsh asked me to check in with you while he finishes up some work!',
      4,
      true
    );

    assert.strictEqual(voiceRes.success, true);
    assert.strictEqual(voiceRes.action, 'voice_note_dispatched');
    assert.strictEqual(voiceRes.recipient, 'Lokesh Upadhyay');
    assert.strictEqual(voiceRes.durationSec, 4);
    assert(voiceRes.textSpoken.includes('JARVIS'));
    console.log(`    Voice note dispatch summary: ${voiceRes.summary}`);
  });

  // TEST 7: Natural Language Intent Routing (aiProviderAdapter & commandInterpreter)
  test('NLP Routing: Natural language commands for Lokesh Upadhyay and availability', () => {
    // 1. Text staging
    const i1 = aiProviderAdapterInstance.detectToolIntent('JARVIS', 'Lokesh Upadhyay Text him hii then how are you doing');
    assert(i1);
    assert.strictEqual(i1.toolName, 'stage_whatsapp_message');
    assert.strictEqual(i1.args.recipient, 'Lokesh Upadhyay');

    // 2. Setting availability
    const i2 = aiProviderAdapterInstance.detectToolIntent('JARVIS', 'I am busy right now');
    assert(i2);
    assert.strictEqual(i2.toolName, 'set_user_availability');
    assert.strictEqual(i2.args.status, 'BUSY');

    const i3 = aiProviderAdapterInstance.detectToolIntent('JARVIS', 'I am available now');
    assert(i3);
    assert.strictEqual(i3.toolName, 'set_user_availability');
    assert.strictEqual(i3.args.status, 'AVAILABLE');

    // 3. Own voice message
    const i4 = aiProviderAdapterInstance.detectToolIntent('JARVIS', 'make voice message of your own to Lokesh Upadhyay');
    assert(i4);
    assert.strictEqual(i4.toolName, 'send_jarvis_voice_note');
    assert.strictEqual(i4.args.recipient, 'Lokesh Upadhyay');

    // 4. Command Interpreter
    const ci1 = commandInterpreterInstance.interpret('Lokesh Upadhyay text him hii then how are you doing', 'JARVIS');
    assert(ci1.matched);
    assert.strictEqual(ci1.toolName, 'stage_whatsapp_message');
    assert.strictEqual(ci1.args.recipient, 'Lokesh Upadhyay');
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`Results: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('----------------------------------------------------------------');

  if (passed === total) {
    console.log('🎉 ALL LOKESH UPADHYAY WHATSAPP COMPANION & STABILITY TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}

runLokeshCompanionSuite().catch(err => {
  console.error('Test suite failed with unhandled exception:', err);
  process.exit(1);
});

