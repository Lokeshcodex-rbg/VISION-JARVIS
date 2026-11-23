/**
 * test_full_computer_assistant.js
 *
 * STARK AI — Full Windows Computer Access, Personal Assistant, WhatsApp,
 * Voice Intelligence & Permission Repair Comprehensive Test Suite (Phase 11).
 *
 * Covers:
 * 1. Project file reads, safe writes, edits, backups, and path boundary validation.
 * 2. 14 Granular permission grants, denials, trusted mode, and capability testing.
 * 3. Windows app launching, window focusing, and system telemetry.
 * 4. Fuzzy speech and phonetic transcription typo correction (whatsaap, downlods, crome, etc.).
 * 5. Multilingual understanding (English, Hindi, Hinglish commands).
 * 6. Contact resolution and ambiguous contact handling.
 * 7. WhatsApp message drafting, staging, and confirmation enforcement before dispatch.
 * 8. WhatsApp audio call initiation, state transitions, and truthful API limitation reporting.
 * 9. Persistent memory addition, correction, shielding, and export.
 * 10. Strict ULTRON vs JARVIS permission separation.
 * 11. Command Bar keyboard input processing (/api/command).
 * 12. Honest reporting of tool execution results (success, denied, confirmation_required).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const { permissionManagerInstance } = require('./server/desktop/permissionManager');
const { permissionGateInstance } = require('./server/desktop/permissionGate');
const { fileExplorerInstance } = require('./server/desktop/fileExplorer');
const { desktopControllerInstance } = require('./server/desktop/desktopController');
const { whatsappServiceInstance } = require('./server/desktop/whatsappService');
const { commandInterpreterInstance, APP_FUZZY_MAP } = require('./server/commandInterpreter');
const { memoryManagerInstance } = require('./server/memoryManager');

let passedTests = 0;
let totalTests = 0;

function reportPass(name) {
  totalTests++;
  passedTests++;
  console.log(`  ✓ [PASS] [${totalTests}] ${name}`);
}

function reportFail(name, err) {
  totalTests++;
  console.error(`  ✗ [FAIL] [${totalTests}] ${name}:`, err.message || err);
}

// HTTP Helper for testing server API endpoints
function apiRequest(method, urlPath, payload = null) {
  return new Promise((resolve, reject) => {
    const postData = payload ? JSON.stringify(payload) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: urlPath,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
        },
        timeout: 5000
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${urlPath}`));
    });
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('STARK AI — COMPREHENSIVE PERSONAL ASSISTANT & PERMISSION TEST SUITE');
  console.log('========================================================================\n');

  // --- SECTION 1: Project File Reads, Safe Writes, Edits, and Path Boundaries ---
  console.log('--- Section 1: File Reads, Safe Writes, Verification & Path Boundaries ---');
  const testDir = path.resolve(__dirname, 'test_sandbox_fs');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  try {
    const sampleFilePath = path.join(testDir, 'test_doc.txt');
    
    // 1.1 Create file with write verification
    const createRes = await fileExplorerInstance.createFile(sampleFilePath, 'Initial content for testing JARVIS file capabilities.');
    assert.strictEqual(createRes.status, 'created');
    assert.strictEqual(createRes.sizeBytes > 0, true);
    assert.strictEqual(fs.existsSync(sampleFilePath), true);
    reportPass('File created and verified on disk with byte count check');

    // 1.2 Read file
    const readRes = await fileExplorerInstance.readTextFile(sampleFilePath);
    assert.ok(readRes.content.includes('Initial content'));
    reportPass('File successfully read with content integrity preserved');

    // 1.3 Edit file with automatic backup creation
    const editRes = await fileExplorerInstance.editFile(sampleFilePath, 'Updated content with backup preservation.', { backup: true });
    assert.strictEqual(editRes.status, 'saved');
    assert.strictEqual(editRes.sizeBytes > 0, true);
    assert.ok(fs.existsSync(sampleFilePath + '.bak'));
    reportPass('File edited with write verification and automatic .bak generation');

    // 1.4 Path traversal / forbidden boundary prevention
    const outsidePath = 'C:\\Windows\\System32\\calc.exe';
    const boundaryCheck = fileExplorerInstance.isPathPermitted(outsidePath);
    assert.strictEqual(boundaryCheck, false);
    reportPass('Arbitrary system directory traversal rejected by boundary validation');

    // Clean up test file
    if (fs.existsSync(sampleFilePath)) fs.unlinkSync(sampleFilePath);
    if (fs.existsSync(sampleFilePath + '.bak')) fs.unlinkSync(sampleFilePath + '.bak');
  } catch (err) {
    reportFail('File operations & boundary check', err);
  }

  // --- SECTION 2: 14 Granular Permissions, Profiles & Capability Tests ---
  console.log('\n--- Section 2: 14 Granular Permissions, Persistent Profiles & Tests ---');
  try {
    const jarvisProfile = permissionManagerInstance.getProfile('JARVIS');
    assert.ok(jarvisProfile);
    assert.ok(Array.isArray(jarvisProfile.permissions));
    assert.strictEqual(jarvisProfile.permissions.length, 14);
    reportPass('14 granular permissions successfully registered in JARVIS profile');

    // 2.2 Test permission toggle
    permissionManagerInstance.setPermission('whatsapp_drafting', false, 'JARVIS');
    assert.strictEqual(permissionManagerInstance.isPermissionEnabled('whatsapp_drafting', 'JARVIS'), false);
    permissionManagerInstance.setPermission('whatsapp_drafting', true, 'JARVIS');
    assert.strictEqual(permissionManagerInstance.isPermissionEnabled('whatsapp_drafting', 'JARVIS'), true);
    reportPass('Permission toggle is dynamic and persistently updates profile state');

    // 2.3 Trusted mode toggle
    permissionManagerInstance.setTrustedMode(true, 'JARVIS');
    assert.strictEqual(permissionManagerInstance.isTrustedMode('JARVIS'), true);
    reportPass('User-configurable trusted mode toggles for routine reversible actions');

    // 2.4 Permitted personal folders management
    permissionManagerInstance.addPermittedFolder(testDir, 'JARVIS');
    assert.ok(permissionManagerInstance.getPermittedFolders('JARVIS').includes(path.resolve(testDir)));
    reportPass('Personal document folder added to authorized folder scope');

    // 2.5 Live capability test harness
    const fileTest = await permissionManagerInstance.testCapability('file_read_write', 'JARVIS');
    assert.strictEqual(fileTest.success, true);
    assert.strictEqual(fileTest.status, 'working');
    reportPass('Live capability test for file_read_write executes and returns working status');

    const appTest = await permissionManagerInstance.testCapability('app_management', 'JARVIS');
    assert.strictEqual(appTest.success, true);
    reportPass('Live capability test for app_management returns working status');
  } catch (err) {
    reportFail('14 Granular Permissions check', err);
  }

  // --- SECTION 3: Windows Desktop Integration & System Telemetry ---
  console.log('\n--- Section 3: Windows Desktop Integration, Window Focus & Telemetry ---');
  try {
    // 3.1 Running applications inspection
    const runningApps = await desktopControllerInstance.getRunningApplications();
    assert.ok(Array.isArray(runningApps.applications));
    assert.ok(runningApps.applications.length > 0);
    reportPass('Desktop controller inspects live running Windows applications');

    // 3.2 System resource usage telemetry
    const sysUsage = await desktopControllerInstance.getHardwareMetrics('cpu');
    assert.strictEqual(sysUsage.metric, 'cpu');
    assert.strictEqual(typeof sysUsage.cpuPercent, 'number');
    reportPass('Desktop controller reports live CPU resource metrics');

    // 3.3 Clipboard read / write via PowerShell integration
    const clipSetRes = await desktopControllerInstance.setClipboardText('STARK_AI_TEST_CLIPBOARD_DATA');
    assert.strictEqual(clipSetRes.success, true);
    const clipGetRes = await desktopControllerInstance.getClipboardText();
    assert.strictEqual(clipGetRes.success, true);
    assert.strictEqual(clipGetRes.text.trim(), 'STARK_AI_TEST_CLIPBOARD_DATA');
    reportPass('Clipboard read and write integration successfully synchronized');
  } catch (err) {
    reportFail('Windows desktop control & telemetry', err);
  }

  // --- SECTION 4: Fuzzy Speech & Transcription Typo Correction ---
  console.log('\n--- Section 4: Fuzzy Speech & Transcription Typo Correction ---');
  try {
    // 4.1 "JARVIS, open whatsaap" -> WhatsApp
    const typo1 = commandInterpreterInstance.interpret('JARVIS open whatsaap');
    assert.strictEqual(typo1.matched, true);
    assert.strictEqual(typo1.toolName, 'open_desktop_app');
    assert.strictEqual(typo1.args.appName, 'whatsapp');
    reportPass('Fuzzy phonetics maps "whatsaap" -> "whatsapp" app launch');

    // 4.2 "Open downlods" -> Downloads folder
    const typo2 = commandInterpreterInstance.interpret('open downlods');
    assert.strictEqual(typo2.matched, true);
    assert.strictEqual(typo2.toolName, 'open_folder');
    assert.strictEqual(typo2.args.folderName, 'downloads');
    reportPass('Transcription typo "downlods" resolved to "downloads" folder');

    // 4.3 "crome" -> chrome
    const typo3 = commandInterpreterInstance.interpret('open crome');
    assert.strictEqual(typo3.matched, true);
    assert.strictEqual(typo3.toolName, 'open_desktop_app');
    assert.strictEqual(typo3.args.appName, 'chrome');
    reportPass('Transcription typo "crome" resolved to "chrome"');

    // 4.4 App fuzzy map dictionary checks
    assert.strictEqual(APP_FUZZY_MAP['hisab'], 'calculator');
    assert.strictEqual(APP_FUZZY_MAP['notpad'], 'notepad');
    reportPass('Phonetic map verified for colloquial terms (hisab -> calculator, notpad -> notepad)');
  } catch (err) {
    reportFail('Fuzzy typo correction', err);
  }

  // --- SECTION 5: Multilingual Intelligence (Hindi, Hinglish, English) ---
  console.log('\n--- Section 5: Multilingual Intelligence (Hindi, Hinglish, English) ---');
  try {
    // 5.1 Hindi language switch command
    const interp1 = commandInterpreterInstance.interpret('Hindi mein baat karo');
    assert.strictEqual(interp1.matched, true);
    assert.strictEqual(interp1.toolName, 'set_language_mode');
    assert.strictEqual(interp1.args.language, 'hi');
    reportPass('Hinglish "Hindi mein baat karo" routes to set_language_mode (hi)');

    // 5.2 Hinglish switch to Hinglish
    const interp2 = commandInterpreterInstance.interpret('Hinglish me bolo');
    assert.strictEqual(interp2.matched, true);
    assert.strictEqual(interp2.toolName, 'set_language_mode');
    assert.strictEqual(interp2.args.language, 'hinglish');
    reportPass('Hinglish "Hinglish me bolo" routes to set_language_mode (hinglish)');

    // 5.3 Switch back to English
    const interp3 = commandInterpreterInstance.interpret('Switch to English');
    assert.strictEqual(interp3.matched, true);
    assert.strictEqual(interp3.toolName, 'set_language_mode');
    assert.strictEqual(interp3.args.language, 'en');
    reportPass('English "Switch to English" routes to set_language_mode (en)');

    // 5.4 Memory command interpretation
    const interp4 = commandInterpreterInstance.interpret('Remember that my favorite IDE is VS Code');
    assert.strictEqual(interp4.matched, true);
    assert.strictEqual(interp4.toolName, 'save_memory');
    assert.ok(interp4.args.fact.includes('favorite IDE'));
    reportPass('Natural memory command "Remember that..." interpreted and routed to save_memory');
  } catch (err) {
    reportFail('Multilingual intelligence', err);
  }

  // --- SECTION 6: WhatsApp Contact Resolution & Ambiguity Handling ---
  console.log('\n--- Section 6: WhatsApp Contact Resolution & Ambiguity Handling ---');
  try {
    // 6.1 Direct unambiguous contact
    const resContact = whatsappServiceInstance.resolveContact('Mom');
    assert.strictEqual(resContact.status, 'exact_match');
    assert.strictEqual(resContact.contact.name, 'Mom');
    reportPass('Unambiguous contact "Mom" resolved to verified phone target');

    // 6.2 Ambiguous contact handling (two Rahuls exist in whatsapp_contacts.json)
    const interpAmbiguous = commandInterpreterInstance.interpret('Message Rahul I am on my way');
    assert.strictEqual(interpAmbiguous.matched, true);
    assert.strictEqual(interpAmbiguous.action, 'clarification_required');
    assert.ok(Array.isArray(interpAmbiguous.matches));
    assert.strictEqual(interpAmbiguous.matches.length >= 2, true);
    assert.ok(interpAmbiguous.question.includes('Rahul Sharma'));
    assert.ok(interpAmbiguous.question.includes('Rahul Verma'));
    reportPass('Ambiguous recipient "Rahul" prompts concise clarification without guessing');
  } catch (err) {
    reportFail('WhatsApp contact resolution', err);
  }

  // --- SECTION 7: WhatsApp Message Drafting & Confirmation Enforcement ---
  console.log('\n--- Section 7: WhatsApp Message Drafting & Confirmation Gate ---');
  try {
    // 7.1 Draft creation
    const draftRes = whatsappServiceInstance.draftMessage('Mom', 'I will arrive in ten minutes.');
    assert.strictEqual(draftRes.status, 'drafted');
    assert.ok(draftRes.draftId);
    assert.strictEqual(draftRes.requiresConfirmation, true);
    assert.strictEqual(draftRes.recipient, 'Mother');
    reportPass('WhatsApp draft created with unique draftId and confirmation requirement');

    // 7.2 Attempt send without confirmation when confirmation is required
    const unconfirmedSend = await whatsappServiceInstance.sendMessage('Mom', 'Unauthorized blast', false);
    assert.strictEqual(unconfirmedSend.status, 'confirmation_required');
    reportPass('Sending without explicit confirmation is strictly blocked');

    // 7.3 Send with confirmed draft
    const confirmedSend = await whatsappServiceInstance.sendMessage(draftRes.draftId, null, true);
    assert.strictEqual(confirmedSend.status, 'dispatched');
    assert.strictEqual(confirmedSend.recipient, 'Mother');
    assert.strictEqual(confirmedSend.deliveryMethod, 'WhatsApp Desktop Protocol');
    reportPass('Confirmed message successfully dispatched via official WhatsApp Desktop protocol');
  } catch (err) {
    reportFail('WhatsApp message drafting & confirmation', err);
  }

  // --- SECTION 8: WhatsApp Audio Calling & Call State Machine ---
  console.log('\n--- Section 8: WhatsApp Calling & Truthful Limitations ---');
  try {
    // 8.1 Call state initially idle
    assert.strictEqual(whatsappServiceInstance.getCallState().status, 'idle');
    reportPass('WhatsApp call state initialized to idle');

    // 8.2 Prepare call
    const prepCall = await whatsappServiceInstance.initiateCall('Dad', false);
    assert.strictEqual(prepCall.status, 'confirmation_required');
    assert.ok(prepCall.summary.includes('Are you sure'));
    reportPass('Call initiation requires explicit user confirmation');

    // 8.3 Initiate call after user confirmation
    const callRes = await whatsappServiceInstance.initiateCall('Dad', true);
    assert.strictEqual(callRes.status, 'call_initiated');
    assert.strictEqual(callRes.callState.status, 'dialing');
    reportPass('Audio call initiated to verified contact with dialing state');

    // 8.4 Truthful limitation check: WhatsApp does not allow raw bot voice injection into VOIP call
    assert.strictEqual(callRes.callState.aiAssistanceActive, false);
    reportPass('Truthful reporting: WhatsApp encrypted peer-to-peer VOIP does not support bot voice injection');

    // 8.5 End call
    const endRes = whatsappServiceInstance.endCall();
    assert.strictEqual(endRes.status, 'call_ended');
    assert.strictEqual(whatsappServiceInstance.getCallState().status, 'ended');
    reportPass('Active call successfully terminated and state set to ended');
  } catch (err) {
    reportFail('WhatsApp audio calling', err);
  }

  // --- SECTION 9: Persistent Memory Addition, Correction & Export ---
  console.log('\n--- Section 9: Persistent Memory Addition, Correction & Export ---');
  try {
    // 9.1 Add memory
    const addRes = memoryManagerInstance.addMemory('User favorite IDE is VS Code on Windows 11');
    assert.strictEqual(addRes.success, true);
    assert.ok(addRes.memory.id);
    reportPass('New persistent memory added to storage');

    // 9.2 Correct memory
    const correctRes = memoryManagerInstance.correctMemory(addRes.memory.id, 'User favorite IDE is Antigravity IDE on Windows 11');
    assert.strictEqual(correctRes.success, true);
    assert.strictEqual(correctRes.memory.fact, 'User favorite IDE is Antigravity IDE on Windows 11');
    reportPass('Memory successfully corrected by ID');

    // 9.3 Export memories with credential shielding
    const exportRes = memoryManagerInstance.exportMemories();
    assert.strictEqual(exportRes.success, true);
    assert.ok(Array.isArray(exportRes.memories));
    assert.strictEqual(exportRes.credentialsShielded, true);
    reportPass('Memories exported with sensitive credential shielding active');

    // Clean up test memory
    memoryManagerInstance.deleteMemory(addRes.memory.id);
  } catch (err) {
    reportFail('Memory management & export', err);
  }

  // --- SECTION 10: Strict ULTRON vs JARVIS Permission Separation ---
  console.log('\n--- Section 10: Strict ULTRON vs JARVIS Permission Separation ---');
  try {
    // 10.1 Desktop app launch authorized for JARVIS
    assert.strictEqual(permissionGateInstance.isToolPermitted('launch_application', 'JARVIS'), true);
    reportPass('JARVIS authorized to launch desktop applications');

    // 10.2 Desktop app launch strictly denied for ULTRON
    assert.strictEqual(permissionGateInstance.isToolPermitted('launch_application', 'ULTRON'), false);
    reportPass('ULTRON strictly prohibited from launching desktop applications');

    // 10.3 WhatsApp actions strictly denied for ULTRON
    assert.strictEqual(permissionGateInstance.isToolPermitted('whatsapp_send_message', 'ULTRON'), false);
    reportPass('ULTRON strictly prohibited from WhatsApp messaging and calling');

    // 10.4 File write/create strictly denied for ULTRON
    assert.strictEqual(permissionGateInstance.isToolPermitted('create_file', 'ULTRON'), false);
    reportPass('ULTRON strictly prohibited from modifying files');

    // 10.5 ULTRON permitted read-only telemetry
    assert.strictEqual(permissionGateInstance.isToolPermitted('get_hardware_metrics', 'ULTRON'), true);
    reportPass('ULTRON permitted read-only system telemetry');

    // 10.6 Execution throws on violation for ULTRON
    assert.throws(() => {
      permissionGateInstance.authorizeToolExecution('launch_application', { appName: 'notepad' }, 'ULTRON');
    }, /ULTRON is operating under restricted read-only governance/);
    reportPass('PermissionGate strictly throws error when ULTRON attempts privileged desktop launch');
  } catch (err) {
    reportFail('ULTRON vs JARVIS permission separation', err);
  }

  // --- SECTION 11: Live API Endpoints (/api/command, /api/permissions, etc.) ---
  console.log('\n--- Section 11: Live HTTP API Endpoints & Keyboard Command Input ---');
  try {
    // 11.1 Permissions API for JARVIS
    const permResJarvis = await apiRequest('GET', '/api/permissions?personality=JARVIS');
    assert.strictEqual(permResJarvis.statusCode, 200);
    assert.strictEqual(permResJarvis.data.personality, 'JARVIS');
    assert.strictEqual(permResJarvis.data.profile.permissions.length, 14);
    reportPass('GET /api/permissions?personality=JARVIS returns full JARVIS 14-permission profile');

    // 11.2 Permissions API for ULTRON
    const permResUltron = await apiRequest('GET', '/api/permissions?personality=ULTRON');
    assert.strictEqual(permResUltron.statusCode, 200);
    assert.strictEqual(permResUltron.data.personality, 'ULTRON');
    assert.strictEqual(permResUltron.data.profile.permissions.length, 14);
    reportPass('GET /api/permissions?personality=ULTRON returns strictly isolated ULTRON profile');

    // 11.3 Permission Toggle API
    const setPermRes = await apiRequest('POST', '/api/permissions/set', {
      personality: 'JARVIS',
      permissionId: 'clipboard_access',
      enabled: true
    });
    assert.strictEqual(setPermRes.statusCode, 200);
    assert.strictEqual(setPermRes.data.success, true);
    reportPass('POST /api/permissions/set toggles permission state');

    // 11.4 Natural language command input endpoint (Ctrl+Shift+Space command bar backend)
    const cmdRes = await apiRequest('POST', '/api/command', {
      command: 'Hindi mein baat karo',
      personality: 'JARVIS'
    });
    assert.strictEqual(cmdRes.statusCode, 200);
    assert.strictEqual(cmdRes.data.success, true);
    assert.strictEqual(cmdRes.data.toolName, 'set_language_mode');
    reportPass('POST /api/command accepts natural language keyboard input and returns live tool execution');

    // 11.5 Capability test endpoint
    const capTestRes = await apiRequest('POST', '/api/permissions/test/system_diagnostics', {
      personality: 'JARVIS'
    });
    assert.strictEqual(capTestRes.statusCode, 200);
    assert.strictEqual(capTestRes.data.success, true);
    assert.strictEqual(capTestRes.data.result.status, 'working');
    reportPass('POST /api/permissions/test/:permissionId executes capability verification');
  } catch (err) {
    reportFail('Live HTTP API & Command Bar tests', err);
  }

  // Clean up sandbox directory
  if (fs.existsSync(testDir)) {
    try {
      fs.rmdirSync(testDir, { recursive: true });
    } catch (_) {}
  }

  console.log('\n========================================================================');
  console.log(`FULL SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  if (totalTests - passedTests > 0) {
    console.log(`FAILURES: ${totalTests - passedTests}`);
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED WITH ZERO FAILURES');
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
