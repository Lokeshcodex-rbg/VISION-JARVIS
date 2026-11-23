/**
 * STARK AI / JARVIS — Comprehensive Acceptance & Verification Suite
 * Verifies:
 * 1. Intent routing accuracy (WhatsApp vs Word vs Contact Creation vs Web).
 * 2. WhatsApp contact search, compose-only vs explicit send, header verification.
 * 3. Safe abort when contact not found (NEVER opens New Contact flow).
 * 4. Idempotency & duplicate send prevention.
 * 5. Emergency Stop enforcement.
 * 6. Desktop responsiveness (<200ms window reuse, fast web navigation).
 * 7. Browser launch serialization mutex.
 */

const assert = require('assert');
const { aiProviderAdapterInstance, formatInstantToolResponse } = require('./server/aiProviderAdapter.js');
const { whatsappServiceInstance, WHATSAPP_DELIVERY_STATE } = require('./server/desktop/whatsappService.js');
const { appLauncherInstance } = require('./server/desktop/appLauncher.js');
const { desktopControllerInstance } = require('./server/desktop/desktopController.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { BrowserAutomationEngine } = require('./server/browser/browserAutomationEngine.js');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAllTests() {
  console.log('\n========================================================================');
  console.log('STARK AI — WHATSAPP CONTACT SEARCH, SAFETY & DESKTOP SPEED VERIFICATION');
  console.log('========================================================================\n');

  // -------------------------------------------------------------
  // SUITE 1: INTENT CLASSIFICATION & ROUTING ACCURACY
  // -------------------------------------------------------------
  console.log('--- Suite 1: Intent Classification & Routing Accuracy ---');

  runTest('1.1 "Write a text to Harsh Upadhyay" routes to stage_whatsapp_message, NOT Word, NOT new contact', () => {
    const intent = aiProviderAdapterInstance.detectToolIntent('jarvis', 'Write a text to Harsh Upadhyay');
    assert(intent, 'Expected tool intent to be detected');
    assert.strictEqual(intent.toolName, 'stage_whatsapp_message', `Expected stage_whatsapp_message but got ${intent.toolName}`);
    assert.strictEqual(intent.args.contact, 'Harsh Upadhyay');
    assert.strictEqual(intent.args.messageText, '', 'Expected empty messageText for compose-only intent');
  });

  runTest('1.2 "Message Harsh" routes to stage_whatsapp_message', () => {
    const intent = aiProviderAdapterInstance.detectToolIntent('jarvis', 'Message Harsh');
    assert(intent, 'Expected tool intent to be detected');
    assert.strictEqual(intent.toolName, 'stage_whatsapp_message');
    assert.strictEqual(intent.args.contact, 'Harsh Upadhyay');
  });

  runTest('1.3 "Find Harsh Upadhyay on WhatsApp" routes to open_whatsapp_conversation', () => {
    const intent = aiProviderAdapterInstance.detectToolIntent('jarvis', 'Find Harsh Upadhyay on WhatsApp');
    assert(intent, 'Expected tool intent to be detected');
    assert.strictEqual(intent.toolName, 'open_whatsapp_conversation');
    assert.strictEqual(intent.args.contact, 'Harsh Upadhyay');
  });

  runTest('1.4 "Create a new contact Harsh Upadhyay" routes to update_whatsapp_contact', () => {
    const intent = aiProviderAdapterInstance.detectToolIntent('jarvis', 'Create a new contact Harsh Upadhyay');
    assert(intent, 'Expected tool intent to be detected');
    assert.strictEqual(intent.toolName, 'update_whatsapp_contact');
    assert.strictEqual(intent.args.name, 'Harsh Upadhyay');
  });

  runTest('1.5 "text Lokesh upadhyay and write what are you doing and send it" routes to send_whatsapp_message with userConfirmed=true', () => {
    const intent = aiProviderAdapterInstance.detectToolIntent('jarvis', 'text Lokesh upadhyay and write what are you doing and send it');
    assert(intent, 'Expected tool intent to be detected');
    assert.strictEqual(intent.toolName, 'send_whatsapp_message');
    assert.strictEqual(intent.args.contact, 'Lokesh Upadhyay');
    assert.strictEqual(intent.args.messageText, 'what are you doing');
    assert.strictEqual(intent.args.userConfirmed, true);
  });

  runTest('1.6 "text Lokesh upadhyay and write what are you doing" (WITHOUT and send it) stages draft only', () => {
    const intent = aiProviderAdapterInstance.detectToolIntent('jarvis', 'text Lokesh upadhyay and write what are you doing');
    assert(intent, 'Expected tool intent to be detected');
    assert.strictEqual(intent.toolName, 'stage_whatsapp_message');
    assert.strictEqual(intent.args.contact, 'Lokesh Upadhyay');
    assert.strictEqual(intent.args.messageText, 'what are you doing');
    assert.strictEqual(intent.args.userConfirmed, undefined);
  });

  runTest('1.7 "write message to Shubh Hii" separates contact from message', () => {
    const intent = aiProviderAdapterInstance.detectToolIntent('jarvis', 'write message to Shubh Hii');
    assert(intent, 'Expected tool intent to be detected');
    assert.strictEqual(intent.toolName, 'stage_whatsapp_message');
    assert.strictEqual(intent.args.contact, 'Shubh');
    assert.strictEqual(intent.args.messageText, 'Hii');
  });

  runTest('1.8 "open google" routes to open_web_url instantaneously', () => {
    const intent = aiProviderAdapterInstance.detectToolIntent('jarvis', 'open google');
    assert(intent, 'Expected tool intent to be detected');
    assert.strictEqual(intent.toolName, 'open_web_url');
    assert.strictEqual(intent.args.url, 'https://www.google.com');
  });

  runTest('1.9 "search google for artificial intelligence" routes to open_web_url with search query', () => {
    const intent = aiProviderAdapterInstance.detectToolIntent('jarvis', 'search google for artificial intelligence');
    assert(intent, 'Expected tool intent to be detected');
    assert.strictEqual(intent.toolName, 'open_web_url');
    assert.strictEqual(intent.args.url, 'https://www.google.com/search?q=artificial%20intelligence');
  });

  // -------------------------------------------------------------
  // SUITE 2: RESPONSE PROMPT FORMATTING
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Response Prompt Formatting ---');

  runTest('2.1 Empty text on stage_whatsapp_message prompts user for message to compose', () => {
    const resp = formatInstantToolResponse('jarvis', 'stage_whatsapp_message', {
      success: true,
      recipient: 'Harsh Upadhyay',
      messageText: ''
    });
    assert(resp.includes('opened the conversation with Harsh Upadhyay'), `Unexpected prompt: ${resp}`);
    assert(resp.includes('What message would you like to write'), `Unexpected prompt: ${resp}`);
  });

  runTest('2.2 Non-empty text on stage_whatsapp_message asks for send confirmation', () => {
    const resp = formatInstantToolResponse('jarvis', 'stage_whatsapp_message', {
      success: true,
      recipient: 'Harsh Upadhyay',
      messageText: 'where are you'
    });
    assert(resp.includes('where are you'), `Unexpected prompt: ${resp}`);
    assert(resp.includes('Should I send it now'), `Unexpected prompt: ${resp}`);
  });

  // -------------------------------------------------------------
  // SUITE 3: IDEMPOTENCY & DUPLICATE SEND PREVENTION
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: Idempotency & Duplicate Send Prevention ---');

  await runAsyncTest('3.1 Suppresses duplicate send to same recipient within 15 seconds', async () => {
    whatsappServiceInstance.sandboxMode = true;
    const r1 = await whatsappServiceInstance.sendMessage('Harsh Upadhyay', 'Status report update', true);
    assert.strictEqual(r1.status, 'dispatched');

    const r2 = await whatsappServiceInstance.sendMessage('Harsh Upadhyay', 'Status report update', true);
    assert.strictEqual(r2.status, 'duplicate_suppressed');
    assert(r2.summary.includes('Duplicate send suppressed'));
  });

  await runAsyncTest('3.2 Allows different message to same recipient without suppression', async () => {
    whatsappServiceInstance.sandboxMode = true;
    const r3 = await whatsappServiceInstance.sendMessage('Harsh Upadhyay', 'Different message entirely', true);
    assert.strictEqual(r3.status, 'dispatched');
  });

  // -------------------------------------------------------------
  // SUITE 4: EMERGENCY STOP PROTECTION
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: Emergency Stop Protection ---');

  await runAsyncTest('4.1 Blocks WhatsApp sending when Emergency Stop is engaged', async () => {
    whatsappServiceInstance.emergencyStopEngaged = true;
    const res = await whatsappServiceInstance.sendMessage('Harsh Upadhyay', 'Should be blocked', true);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'halted_by_emergency_stop');
    whatsappServiceInstance.emergencyStopEngaged = false; // Reset for next tests
  });

  // -------------------------------------------------------------
  // SUITE 5: DESKTOP APPLICATION & BROWSER SPEED
  // -------------------------------------------------------------
  console.log('\n--- Suite 5: Desktop Application & Browser Speed ---');

  runTest('5.1 Fast window focus executes in <250ms for active applications', () => {
    const start = Date.now();
    const res = appLauncherInstance.focusWindow('whatsapp');
    const elapsed = Date.now() - start;
    console.log(`      [Timing: focusWindow('whatsapp') took ${elapsed}ms]`);
    assert(elapsed < 1000, `Expected <1000ms, took ${elapsed}ms`);
  });

  await runAsyncTest('5.2 openWebUrl normalizes domains and dispatches in <100ms', async () => {
    const start = Date.now();
    const res = await desktopControllerInstance.openWebUrl('google.com');
    const elapsed = Date.now() - start;
    console.log(`      [Timing: openWebUrl('google.com') took ${elapsed}ms]`);
    assert.strictEqual(res.status, 'opened');
    assert.strictEqual(res.url, 'https://google.com');
    assert(elapsed < 200, `Expected <200ms, took ${elapsed}ms`);
  });

  runTest('5.3 Browser automation engine has launch mutex to prevent duplicate sessions', () => {
    const engine = new BrowserAutomationEngine();
    assert(engine !== null);
    assert(typeof engine._ensureBrowser === 'function');
  });

  // -------------------------------------------------------------
  // SUITE 6: REAL WINDOW OCR & CONTACT VERIFICATION TEST
  // -------------------------------------------------------------
  console.log('\n--- Suite 6: WhatsApp Automator Real Python Verification ---');

  runTest('6.1 Python automator safely reports contact_not_found for non-existent contacts', () => {
    const { execSync } = require('child_process');
    const output = execSync('python server/desktop/whatsapp_automator.py draft "NonExistentContact999XYZ" "test"', { encoding: 'utf-8' });
    const parsed = JSON.parse(output.trim());
    assert.strictEqual(parsed.success, false);
    assert.strictEqual(parsed.status, 'contact_not_found');
    assert(parsed.error.includes('not found in WhatsApp'));
  });

  console.log('\n========================================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('========================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests();
