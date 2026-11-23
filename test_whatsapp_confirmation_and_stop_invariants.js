const assert = require('assert');
const path = require('path');
const { whatsappServiceInstance } = require('./server/desktop/whatsappService.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { aiProviderAdapterInstance } = require('./server/aiProviderAdapter.js');
const { commandInterpreterInstance } = require('./server/commandInterpreter.js');

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 WHATSAPP MULTI-STEP CONFIRMATION & EMERGENCY STOP INVARIANT SUITE');
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

  // 1. Directory & Contact Verification
  test('Contact Resolution: Harsh resolves to Harsh Upadhyay (+919876543221)', () => {
    const res1 = whatsappServiceInstance.resolveContact('Harsh');
    assert.strictEqual(res1.status, 'exact_match', 'Should find exact match for Harsh');
    assert.strictEqual(res1.contact.fullName, 'Harsh Upadhyay');
    assert.strictEqual(res1.contact.phone, '+919876543221');

    const res2 = whatsappServiceInstance.resolveContact('Harsh Upadhyay');
    assert.strictEqual(res2.status, 'exact_match');
    assert.strictEqual(res2.contact.fullName, 'Harsh Upadhyay');
  });

  test('Contact Resolution: Lokesh resolves to Lokesh Upadhyay (+919876543224)', () => {
    const res1 = whatsappServiceInstance.resolveContact('Lokesh');
    assert.strictEqual(res1.status, 'exact_match', 'Should find exact match for Lokesh');
    assert.strictEqual(res1.contact.fullName, 'Lokesh Upadhyay');
    assert.strictEqual(res1.contact.phone, '+919876543224');

    const res2 = whatsappServiceInstance.resolveContact('Lokesh Upadhyay');
    assert.strictEqual(res2.status, 'exact_match');
    assert.strictEqual(res2.contact.fullName, 'Lokesh Upadhyay');
  });

  // 2. Multi-Step Confirmation Workflow (Harsh Upadhyay)
  await testAsync('Workflow: Stage message for Harsh Upadhyay -> Awaiting confirmation -> Explicit Yes -> Dispatched', async () => {
    whatsappServiceInstance.enableSandboxMode();

    const stageRes = await whatsappServiceInstance.stageMessageForUserConfirmation('Harsh Upadhyay', 'Hello Harsh, testing confirmation workflow');
    assert.strictEqual(stageRes.status, 'awaiting_confirmation');
    assert.strictEqual(stageRes.requiresConfirmation, true);
    assert.strictEqual(stageRes.recipient, 'Harsh Upadhyay');
    assert.strictEqual(stageRes.verificationChecks.length, 3);
    assert(stageRes.summary.includes('Harsh Upadhyay'));
    assert(whatsappServiceInstance.pendingConfirmation !== null, 'pendingConfirmation must be stored');

    // Confirm dispatch
    const confirmRes = await whatsappServiceInstance.confirmAndDispatchPendingMessage();
    assert.strictEqual(confirmRes.status, 'dispatched');
    assert.strictEqual(confirmRes.recipient, 'Harsh Upadhyay');
    assert.strictEqual(whatsappServiceInstance.pendingConfirmation, null, 'pendingConfirmation must be cleared after send');
  });

  // 3. Cancellation Workflow (Lokesh Upadhyay)
  await testAsync('Workflow: Stage message for Lokesh Upadhyay -> Cancel -> Cleared and not dispatched', async () => {
    whatsappServiceInstance.enableSandboxMode();

    const stageRes = await whatsappServiceInstance.stageMessageForUserConfirmation('Lokesh Upadhyay', 'Hello Lokesh, staging test');
    assert.strictEqual(stageRes.status, 'awaiting_confirmation');
    assert.strictEqual(stageRes.recipient, 'Lokesh Upadhyay');
    assert(whatsappServiceInstance.pendingConfirmation !== null);

    // Cancel dispatch
    const cancelRes = await whatsappServiceInstance.cancelPendingMessage();
    assert.strictEqual(cancelRes.status, 'cancelled');
    assert.strictEqual(cancelRes.recipient, 'Lokesh Upadhyay');
    assert.strictEqual(whatsappServiceInstance.pendingConfirmation, null, 'pendingConfirmation must be cleared on cancel');

    // Attempting to confirm after cancel should fail
    const confirmAfterCancel = await whatsappServiceInstance.confirmAndDispatchPendingMessage();
    assert.strictEqual(confirmAfterCancel.status, 'no_pending_draft');
  });

  // 4. Strict Stop & Resume Invariant
  await testAsync('Emergency Stop Invariant: Stop aborts immediately, purges pending state, and Resume NEVER auto-sends', async () => {
    whatsappServiceInstance.enableSandboxMode();

    // Reset E-stop first to ensure clean baseline
    emergencyStopControllerInstance.reset('Clean baseline for test');
    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), false);

    // Stage a message for Harsh Upadhyay
    const stageRes = await whatsappServiceInstance.stageMessageForUserConfirmation('Harsh Upadhyay', 'Message that must be stopped');
    assert.strictEqual(stageRes.status, 'awaiting_confirmation');
    assert(whatsappServiceInstance.pendingConfirmation !== null);

    // Trigger Emergency Stop
    emergencyStopControllerInstance.engage('User pressed Emergency Stop during staging');
    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), true);
    assert.strictEqual(whatsappServiceInstance.emergencyStopEngaged, true);
    assert.strictEqual(whatsappServiceInstance.pendingConfirmation, null, 'Pending confirmation must be PURGED on Stop!');

    // Attempting to dispatch while stopped must be blocked
    const dispatchWhileStopped = await whatsappServiceInstance.confirmAndDispatchPendingMessage();
    assert.strictEqual(dispatchWhileStopped.status, 'halted_by_emergency_stop');

    // Now resume / reset Emergency Stop
    emergencyStopControllerInstance.reset('User resumed system');
    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), false);
    assert.strictEqual(whatsappServiceInstance.emergencyStopEngaged, false);

    // CRITICAL: Verify resuming does NOT restore or auto-send the prior message!
    assert.strictEqual(whatsappServiceInstance.pendingConfirmation, null, 'Pending confirmation must STAY purged after resume!');
    const dispatchAfterResume = await whatsappServiceInstance.confirmAndDispatchPendingMessage();
    assert.strictEqual(dispatchAfterResume.status, 'no_pending_draft', 'Resuming must NEVER auto-send prior message!');
  });

  // 5. Intent Detection & Routing (aiProviderAdapter)
  test('aiProviderAdapter: Text message command routes to stage_whatsapp_message (Never direct send)', () => {
    const intent1 = aiProviderAdapterInstance.detectToolIntent('JARVIS', 'send message to Harsh Upadhyay Hii');
    assert(intent1, 'Intent should be detected');
    assert.strictEqual(intent1.toolName, 'stage_whatsapp_message');
    assert.strictEqual(intent1.args.recipient, 'Harsh Upadhyay');
    assert.strictEqual(intent1.args.messageText, 'Hii');

    const intent2 = aiProviderAdapterInstance.detectToolIntent('JARVIS', 'write message to Lokesh Upadhyay hello');
    assert(intent2);
    assert.strictEqual(intent2.toolName, 'stage_whatsapp_message');
    assert.strictEqual(intent2.args.recipient, 'Lokesh Upadhyay');
    assert.strictEqual(intent2.args.messageText, 'hello');

    const intent3 = aiProviderAdapterInstance.detectToolIntent('JARVIS', 'Harsh ko whatsapp pe message bhejo Kaha ho');
    assert(intent3);
    assert.strictEqual(intent3.toolName, 'stage_whatsapp_message');
    assert.strictEqual(intent3.args.recipient, 'Harsh Upadhyay');
  });

  test('aiProviderAdapter: Voice note command routes to stage_whatsapp_message with isVoice: true', () => {
    const intentVoice = aiProviderAdapterInstance.detectToolIntent('JARVIS', 'send voice message to Harsh');
    assert(intentVoice);
    assert.strictEqual(intentVoice.toolName, 'stage_whatsapp_message');
    assert.strictEqual(intentVoice.args.recipient, 'Harsh Upadhyay');
    assert.strictEqual(intentVoice.args.isVoice, true);
  });

  test('aiProviderAdapter: User confirmations route to confirm_whatsapp_send', () => {
    const confirms = ['yes send it', 'send it', 'bhej do', 'confirm', 'send now', 'haan bhej do', 'yes, send it'];
    for (const phrase of confirms) {
      const intent = aiProviderAdapterInstance.detectToolIntent('JARVIS', phrase);
      assert(intent, `Phrase "${phrase}" should be detected`);
      assert.strictEqual(intent.toolName, 'confirm_whatsapp_send', `Phrase "${phrase}" must route to confirm_whatsapp_send`);
    }
  });

  test('aiProviderAdapter: User cancellations route to cancel_whatsapp_send', () => {
    const cancels = ['no', 'don\'t send', 'mat bhejo', 'cancel', 'stop sending', 'nahi bhejo', 'clear'];
    for (const phrase of cancels) {
      const intent = aiProviderAdapterInstance.detectToolIntent('JARVIS', phrase);
      assert(intent, `Phrase "${phrase}" should be detected`);
      assert.strictEqual(intent.toolName, 'cancel_whatsapp_send', `Phrase "${phrase}" must route to cancel_whatsapp_send`);
    }
  });

  // 6. Command Interpreter Routing
  test('commandInterpreter: Routes text and confirmation commands accurately', () => {
    const r1 = commandInterpreterInstance.interpret('send message to Harsh Upadhyay Hii', 'JARVIS');
    assert(r1.matched);
    assert.strictEqual(r1.toolName, 'stage_whatsapp_message');
    assert.strictEqual(r1.args.recipient, 'Harsh Upadhyay');
    assert.strictEqual(r1.args.messageText.toLowerCase(), 'hii');

    const r2 = commandInterpreterInstance.interpret('message to Lokesh Upadhyay hello', 'JARVIS');
    assert(r2.matched);
    assert.strictEqual(r2.toolName, 'stage_whatsapp_message');
    assert.strictEqual(r2.args.recipient, 'Lokesh Upadhyay');
    assert.strictEqual(r2.args.messageText, 'hello');

    const r3 = commandInterpreterInstance.interpret('send it', 'JARVIS');
    assert(r3.matched);
    assert.strictEqual(r3.toolName, 'confirm_whatsapp_send');

    const r4 = commandInterpreterInstance.interpret('bhej do', 'JARVIS');
    assert(r4.matched);
    assert.strictEqual(r4.toolName, 'confirm_whatsapp_send');

    const r5 = commandInterpreterInstance.interpret('mat bhejo', 'JARVIS');
    assert(r5.matched);
    assert.strictEqual(r5.toolName, 'cancel_whatsapp_send');
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`Results: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('----------------------------------------------------------------');

  if (passed === total) {
    console.log('🎉 ALL WHATSAPP CONFIRMATION & EMERGENCY STOP INVARIANTS VERIFIED!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed with unhandled exception:', err);
  process.exit(1);
});
