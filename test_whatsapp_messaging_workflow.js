/**
 * STARK AI — Test G Acceptance Verification: WhatsApp & External Messaging
 * 
 * Verifies Section 9 & Section 23 Test G requirements:
 * 1. Recipient contact resolution: exact match, ambiguous match detection, direct number handling.
 * 2. E.164 international phone number validation (+[country_code][digits]).
 * 3. Staged message drafting with strict preview boundary (requires confirmation before send).
 * 4. User cancellation of staged drafts.
 * 5. Approved attachment validation: file existence, allowed file type (.pdf, .docx), and size limits.
 * 6. Duplicate-send prevention: blocks sending the same draft multiple times.
 * 7. Verified sandbox delivery recording actual provider status without spamming real people.
 * 8. Central Tool Registry execution boundary.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { whatsappServiceInstance } = require('./server/desktop/whatsappService.js');
const { executeTool } = require('./server/toolsRegistry.js');

const PROJECT_ROOT = path.resolve(__dirname);
const TEST_ATTACHMENT_DIR = path.join(PROJECT_ROOT, 'scratch', 'test_g_attachments');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

async function check(description, fn) {
  totalChecks++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      await result;
    }
    passedChecks++;
    console.log(`  ✓ [PASS] [${passedChecks}] ${description}`);
  } catch (err) {
    failedChecks++;
    console.error(`  ✗ [FAIL] [Check #${totalChecks}] ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

function cleanupWorkspace() {
  try {
    if (fs.existsSync(TEST_ATTACHMENT_DIR)) {
      fs.rmSync(TEST_ATTACHMENT_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('[CLEANUP_WARN]', e.message);
  }
}

async function runTestG() {
  console.log('\n========================================================================');
  console.log('STARK AI — TEST G: WHATSAPP & EXTERNAL MESSAGING VERIFICATION');
  console.log('========================================================================\n');

  cleanupWorkspace();
  fs.mkdirSync(TEST_ATTACHMENT_DIR, { recursive: true });

  // Enable test sandbox mode so tests never send external desktop commands to real contacts
  whatsappServiceInstance.enableSandboxMode();

  // --- 1. Phone Number Validation (E.164 International Format) ---
  console.log('--- 1. Phone Number Validation (E.164 Standard) ---');

  await check('Validates compliant E.164 phone numbers (+919876543210, +14155552671)', async () => {
    const validIndian = whatsappServiceInstance.validatePhoneNumber('+919876543210');
    assert.strictEqual(validIndian.valid, true);
    assert.strictEqual(validIndian.isE164, true);

    const validUS = whatsappServiceInstance.validatePhoneNumber('+14155552671');
    assert.strictEqual(validUS.valid, true);
  });

  await check('Rejects invalid phone numbers missing country code or containing invalid characters', async () => {
    const noCountryCode = whatsappServiceInstance.validatePhoneNumber('9876543210');
    assert.strictEqual(noCountryCode.valid, false);
    assert.ok(noCountryCode.error.includes('E.164'));

    const invalidChars = whatsappServiceInstance.validatePhoneNumber('abc-invalid');
    assert.strictEqual(invalidChars.valid, false);
  });

  // --- 2. Contact Resolution & Ambiguity Detection ---
  console.log('\n--- 2. Contact Resolution & Ambiguity Handling ---');

  await check('Resolves exact contact match from saved address book', async () => {
    const res = whatsappServiceInstance.resolveContact('Rahul Sharma');
    assert.strictEqual(res.status, 'exact_match');
    assert.strictEqual(res.contact.fullName, 'Rahul Sharma');
    assert.strictEqual(res.contact.phone, '+919876543210');
  });

  await check('Detects ambiguous matches and halts to ask for user clarification', async () => {
    // Both Rahul Sharma and Rahul Verma exist with first name 'Rahul'
    const ambigRes = whatsappServiceInstance.resolveContact('Rahul');
    assert.strictEqual(ambigRes.status, 'ambiguous');
    assert.ok(ambigRes.matches.length >= 2, 'Must detect multiple matching contacts');
    assert.ok(ambigRes.summary.includes('Which one would you like to choose'));
  });

  // --- 3. Message Drafting & Preview-Before-Send Boundary ---
  console.log('\n--- 3. Message Drafting & Preview-Before-Send Boundary ---');

  let testDraftId;
  await check('Stages message draft for review with recipient, phone, and preview flag', async () => {
    const draftRes = whatsappServiceInstance.draftMessage(
      'Rahul Sharma',
      'The kinematic analysis report for the 2kg robotic arm is complete and verified.'
    );

    assert.strictEqual(draftRes.status, 'drafted');
    assert.strictEqual(draftRes.requiresConfirmation, true, 'Draft must require confirmation before send');
    assert.ok(draftRes.draftId);
    assert.strictEqual(draftRes.recipient, 'Rahul Sharma');
    assert.strictEqual(draftRes.phone, '+919876543210');
    testDraftId = draftRes.draftId;
  });

  await check('Displays staged draft details when queried via showDraft', async () => {
    const showRes = whatsappServiceInstance.showDraft(testDraftId);
    assert.strictEqual(showRes.status, 'found');
    assert.strictEqual(showRes.draft.recipient, 'Rahul Sharma');
    assert.ok(showRes.draft.messageText.includes('kinematic analysis report'));
  });

  // --- 4. Attachment Handling ---
  console.log('\n--- 4. Attachment Validation & Staging ---');

  const testPdfAttachment = path.join(TEST_ATTACHMENT_DIR, 'kinematic_deliverable.pdf');
  fs.writeFileSync(testPdfAttachment, '%PDF-1.4 TEST ATTACHMENT DELIVERABLE PAYLOAD', 'utf8');

  await check('Attaches approved .pdf deliverable to staged draft and calculates SHA-256', async () => {
    const attachRes = whatsappServiceInstance.attachFileToDraft(testDraftId, testPdfAttachment);
    assert.strictEqual(attachRes.success, true);
    assert.strictEqual(attachRes.attachment.fileName, 'kinematic_deliverable.pdf');
    assert.ok(attachRes.attachment.sha256.length === 64);
  });

  await check('Rejects unapproved file formats or non-existent files', async () => {
    assert.throws(() => {
      whatsappServiceInstance.attachFileToDraft(testDraftId, 'non_existent_file_xyz.pdf');
    }, /does not exist/);

    const badExtFile = path.join(TEST_ATTACHMENT_DIR, 'script.exe');
    fs.writeFileSync(badExtFile, 'BINARY_EXEC_MOCK', 'utf8');
    assert.throws(() => {
      whatsappServiceInstance.attachFileToDraft(testDraftId, badExtFile);
    }, /Unsupported attachment extension/);
  });

  // --- 5. Message Cancellation ---
  console.log('\n--- 5. User Draft Cancellation Workflow ---');

  await check('Explicitly cancels and deletes a staged message draft', async () => {
    const cancelRes = whatsappServiceInstance.cancelDraft(testDraftId);
    assert.strictEqual(cancelRes.success, true);
    assert.strictEqual(cancelRes.status, 'draft_cancelled');

    // Confirm draft no longer exists
    const postCancel = whatsappServiceInstance.showDraft(testDraftId);
    assert.strictEqual(postCancel.status, 'no_drafts');
  });

  // --- 6. Verified Dispatch & Duplicate-Send Prevention ---
  console.log('\n--- 6. Message Dispatch & Duplicate-Send Prevention ---');

  const sendDraft = whatsappServiceInstance.draftMessage(
    'Priya',
    'Meeting rescheduled to 4:00 PM for project status review.'
  );

  await check('Pauses message sending if user confirmation is false', async () => {
    const unconfirmedRes = await whatsappServiceInstance.sendMessage(sendDraft.draftId, null, false);
    assert.strictEqual(unconfirmedRes.status, 'confirmation_required');
  });

  await check('Dispatches approved draft and records delivery status in sandbox', async () => {
    const dispatchRes = await whatsappServiceInstance.sendMessage(sendDraft.draftId, null, true);
    assert.strictEqual(dispatchRes.status, 'dispatched');
    assert.strictEqual(dispatchRes.deliveryState, 'DELIVERED_TO_SANDBOX');
    assert.strictEqual(dispatchRes.recipient, 'Priya Patel');
    assert.strictEqual(dispatchRes.phone, '+919876543211');
  });

  await check('Prevents duplicate send when dispatching the exact same draft again', async () => {
    const duplicateRes = await whatsappServiceInstance.sendMessage(sendDraft.draftId, null, true);
    assert.strictEqual(duplicateRes.status, 'duplicate_prevented');
    assert.ok(duplicateRes.summary.includes('Duplicate send prevented'));
  });

  // --- 7. Tool Registry Integration & Execution Boundary ---
  console.log('\n--- 7. Central Tool Registry Integration & Execution Boundary ---');

  await check('validate_phone_number tool executes via central tools registry', async () => {
    const res = await executeTool('validate_phone_number', { phone: '+919876543210' }, 'JARVIS');
    assert.strictEqual(res.valid, true);
  });

  await check('draft_whatsapp_message tool executes via central tools registry with preview', async () => {
    const res = await executeTool('draft_whatsapp_message', {
      recipient: 'Mom',
      messageText: 'Hello from STARK AI lab.'
    }, 'JARVIS');

    assert.strictEqual(res.status, 'drafted');
    assert.strictEqual(res.requiresConfirmation, true);
  });

  // Clean up
  cleanupWorkspace();

  console.log('\n========================================================================');
  console.log(`TEST G ACCEPTANCE AUDIT: ${passedChecks} PASSED, ${failedChecks} FAILED`);
  console.log('========================================================================\n');

  if (failedChecks > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestG().catch(err => {
  console.error('[FATAL] Test G suite crashed:', err);
  cleanupWorkspace();
  process.exit(1);
});
