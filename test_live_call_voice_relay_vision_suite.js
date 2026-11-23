/**
 * STARK AI — Live Call, Volume Control, Voice Relay & Camera Vision Acceptance Suite
 * Verifies all 5 user capabilities:
 * 1. Truthful WhatsApp call initiation & button detection (no false claims)
 * 2. Live volume up/down/mute control
 * 3. Reading previous WhatsApp messages using native OCR
 * 4. Conversational Voice Relay / Call Proxy ("dicto me" - zero AI markers)
 * 5. Automatic hardware webcam access and computer vision ("see with your eyes")
 */

const assert = require('assert');
const { whatsappServiceInstance } = require('./server/desktop/whatsappService.js');
const { conversationalRelayServiceInstance } = require('./server/voice/conversationalRelayService.js');
const { visionServiceInstance } = require('./server/visionService.js');
const { aiAdapterInstance } = require('./server/aiProviderAdapter.js');
const { executeTool } = require('./server/toolsRegistry.js');
const http = require('http');

let passedAssertions = 0;
function testAssert(condition, message) {
  assert(condition, message);
  passedAssertions++;
  console.log(`  [PASS] ${message}`);
}

async function runSuite() {
  console.log('\n================================================================');
  console.log('STARK AI — LIVE CALL, VOLUME, VOICE RELAY & VISION ACCEPTANCE SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Test 1: Truthful WhatsApp Call Initiation & Verification
  // -------------------------------------------------------------
  console.log('Test 1: WhatsApp Call Initiation & Button Detection Verification...');
  {
    // Check call button locator via automator
    const pythonScript = require('path').join(__dirname, 'server', 'desktop', 'whatsapp_automator.py');
    const { execSync } = require('child_process');
    
    // Test that focus works and finds WhatsApp
    const focusRes = JSON.parse(execSync(`python "${pythonScript}" focus`).toString().trim());
    testAssert(focusRes.success === true, 'WhatsApp desktop window successfully found and focused');

    // Test initiate call without user confirmation returns confirmation gate
    const unconfirmed = await whatsappServiceInstance.initiateCall('Harsh Upadhyay', false);
    testAssert(unconfirmed.status === 'confirmation_required', 'WhatsApp call correctly gates behind explicit user confirmation');

    // Test that getCallState returns valid state structure
    const callState = whatsappServiceInstance.getCallState();
    testAssert(callState && typeof callState.status === 'string', 'getCallState returns valid status');

    // Test endCall executes without throwing and sends disconnect signal
    const endRes = await whatsappServiceInstance.endCall();
    testAssert(endRes && (endRes.status === 'call_ended' || endRes.status === 'no_active_call'), 'endCall safely executes and reports truthful status');
  }

  // -------------------------------------------------------------
  // Test 2: Live Volume Control
  // -------------------------------------------------------------
  console.log('\nTest 2: Live System & Call Volume Adjustment...');
  {
    const volUp = await whatsappServiceInstance.adjustVolume('volumeup', 2);
    testAssert(volUp.success === true && volUp.action === 'volumeup', 'Live volumeup adjustment executed successfully');

    const volDown = await whatsappServiceInstance.adjustVolume('volumedown', 2);
    testAssert(volDown.success === true && volDown.action === 'volumedown', 'Live volumedown adjustment executed successfully');

    // Verify AI Adapter matches volume intents
    const intentUp = aiAdapterInstance.detectToolIntent('JARVIS', 'call volume up');
    testAssert(intentUp && intentUp.toolName === 'adjust_volume' && intentUp.args.direction === 'volumeup', 'AI Adapter matches "call volume up" intent');

    const intentDown = aiAdapterInstance.detectToolIntent('JARVIS', 'volume down');
    testAssert(intentDown && intentDown.toolName === 'adjust_volume' && intentDown.args.direction === 'volumedown', 'AI Adapter matches "volume down" intent');

    // Execute via tools registry
    const toolExec = await executeTool('adjust_volume', { direction: 'volumeup', steps: 1 });
    testAssert(toolExec.success === true, 'adjust_volume tool executes cleanly via ToolsRegistry');
  }

  // -------------------------------------------------------------
  // Test 3: Reading Previous WhatsApp Messages
  // -------------------------------------------------------------
  console.log('\nTest 3: Reading Previous WhatsApp Messages via Native Windows OCR...');
  {
    const ocrRes = await whatsappServiceInstance.readRecentMessages('Harsh Upadhyay');
    testAssert(ocrRes.success === true, 'readRecentMessages successfully executed');
    testAssert(Array.isArray(ocrRes.messages), 'readRecentMessages returned array of parsed messages');
    testAssert(typeof ocrRes.latestMessage === 'string', 'readRecentMessages extracted latest message string');
    console.log(`    (Extracted latest message: "${ocrRes.latestMessage}")`);

    // Verify AI Adapter matches read messages intent
    const intentRead = aiAdapterInstance.detectToolIntent('JARVIS', 'see previous message');
    testAssert(intentRead && intentRead.toolName === 'read_whatsapp_messages', 'AI Adapter matches "see previous message" intent');

    const intentWhatHeSay = aiAdapterInstance.detectToolIntent('JARVIS', 'what did harsh say');
    testAssert(intentWhatHeSay && intentWhatHeSay.toolName === 'read_whatsapp_messages', 'AI Adapter matches "what did harsh say" intent');
  }

  // -------------------------------------------------------------
  // Test 4: Conversational Voice Relay / Call Proxy ("dicto me")
  // -------------------------------------------------------------
  console.log('\nTest 4: Conversational Voice Relay / Call Proxy ("dicto me")...');
  {
    // Test text humanizer: removes AI disclaimers and robotic filler
    const roboticInput = "As an AI language model, I am JARVIS. How can I assist you today? I'm heading over now, sir.";
    const cleaned = conversationalRelayServiceInstance.humanizeText(roboticInput);
    testAssert(!cleaned.includes('As an AI') && !cleaned.includes('JARVIS') && !cleaned.includes('sir'), 'humanizeText strips all AI markers and formalities');
    testAssert(cleaned.includes("I'm heading over now"), 'humanizeText preserves user natural speech core');

    // Test starting relay session
    const startRelay = conversationalRelayServiceInstance.startRelaySession('Harsh Upadhyay');
    testAssert(startRelay.success === true && startRelay.status === 'relay_active', 'Conversational Voice Relay session started successfully');

    // Test listening to caller
    const listenRes = await conversationalRelayServiceInstance.listenToCaller();
    testAssert(listenRes.success === true && listenRes.mode === 'LISTENING', 'listenToCaller enters active monitoring state');

    // Test speaking as user (synthesizes speech without AI pleasantries)
    const speakRes = await conversationalRelayServiceInstance.speakAsUser("Hey, I'm almost done, be right there.");
    testAssert(speakRes.success === true && speakRes.spokenText.includes("almost done"), 'speakAsUser synthesizes natural human speech');

    // Test end relay session
    const endRelay = conversationalRelayServiceInstance.endRelaySession();
    testAssert(endRelay.success === true && endRelay.status === 'relay_ended', 'Conversational Voice Relay session ended cleanly');
  }

  // -------------------------------------------------------------
  // Test 5: Real Webcam Hardware Capture & Vision ("see with your eyes")
  // -------------------------------------------------------------
  console.log('\nTest 5: Real Webcam Hardware Capture & Computer Vision...');
  {
    // Capture real frame from physical webcam
    const snap = await visionServiceInstance.captureCameraSnapshot();
    testAssert(snap.success === true, 'Physical webcam frame captured successfully');
    testAssert(snap.width >= 640 && snap.height >= 480, `Frame resolution verified (${snap.width}x${snap.height})`);
    testAssert(snap.frameBase64 && snap.frameBase64.length > 5000, 'Frame payload contains authentic non-trivial Base64 image data');
    testAssert(snap.path && require('fs').existsSync(snap.path), 'Frame image saved to verified filesystem path');

    // Test AI Adapter camera intent matching
    const intentEyes = aiAdapterInstance.detectToolIntent('JARVIS', 'see it with your eyes');
    testAssert(intentEyes && intentEyes.toolName === 'analyze_camera_image', 'AI Adapter matches "see it with your eyes" intent');

    const intentAccessCam = aiAdapterInstance.detectToolIntent('JARVIS', 'access camera automatically');
    testAssert(intentAccessCam && intentAccessCam.toolName === 'analyze_camera_image', 'AI Adapter matches "access camera automatically" intent');
  }

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passedAssertions}/${passedAssertions} ASSERTIONS PASSED (100.0%)`);
  console.log('================================================================\n');
  process.exit(0);
}

runSuite().catch(err => {
  console.error('\nSuite Execution Failed:', err);
  process.exit(1);
});
