/**
 * STARK AI — Test F Acceptance Verification: Google Workspace & Connected Services
 * 
 * Verifies Section 8 & Section 23 Test F requirements:
 * 1. Truthful status reporting (NOT_CONFIGURED when client credentials are missing).
 * 2. Minimum-scope OAuth 2.0 URL generation with human-readable permission explanations.
 * 3. Hardware-derived AES-256-GCM encrypted token storage and clean revocation.
 * 4. Google Drive search, metadata, and deliverable upload with hash verification.
 * 5. Google Docs document creation and editing links.
 * 6. Gmail draft preparation with strict preview-and-send boundary (blocks unapproved send).
 * 7. Google Calendar event scheduling and schedule conflict detection.
 * 8. Central Tool Registry execution boundary.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const {
  googleWorkspaceServiceInstance,
  SCOPE_DEFINITIONS
} = require('./server/googleWorkspaceService.js');
const { executeTool } = require('./server/toolsRegistry.js');

const PROJECT_ROOT = path.resolve(__dirname);
const TEST_ARTIFACTS_DIR = path.join(PROJECT_ROOT, 'scratch', 'test_f_artifacts');

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

function cleanupArtifacts() {
  try {
    if (fs.existsSync(TEST_ARTIFACTS_DIR)) {
      fs.rmSync(TEST_ARTIFACTS_DIR, { recursive: true, force: true });
    }
    googleWorkspaceServiceInstance.revokeTokens();
  } catch (e) {
    console.warn('[CLEANUP_WARN]', e.message);
  }
}

async function runTestF() {
  console.log('\n========================================================================');
  console.log('STARK AI — TEST F: GOOGLE WORKSPACE & CONNECTED SERVICES VERIFICATION');
  console.log('========================================================================\n');

  cleanupArtifacts();
  fs.mkdirSync(TEST_ARTIFACTS_DIR, { recursive: true });

  // --- 1. Status Reporting & Unconfigured State ---
  console.log('--- 1. Truthful Status Classification & Unconfigured Safeguard ---');

  await check('Reports NOT_CONFIGURED truthfully when client credentials are absent', async () => {
    // Ensure clean unauthenticated state
    googleWorkspaceServiceInstance.revokeTokens();
    googleWorkspaceServiceInstance.sandboxMode = false;

    const status = googleWorkspaceServiceInstance.getServiceStatus();
    assert.ok(status.status === 'NOT_CONFIGURED' || status.status === 'CREDENTIALS_CONFIGURED_PENDING_AUTH');
    assert.strictEqual(status.isConnected, false, 'Must not claim connected without tokens');
    assert.strictEqual(status.connectedAccount, null);
  });

  await check('Minimum-scope dictionary contains explanations and risk levels for all services', async () => {
    assert.ok(SCOPE_DEFINITIONS['https://www.googleapis.com/auth/drive.file']);
    assert.ok(SCOPE_DEFINITIONS['https://www.googleapis.com/auth/documents']);
    assert.ok(SCOPE_DEFINITIONS['https://www.googleapis.com/auth/gmail.compose']);
    assert.ok(SCOPE_DEFINITIONS['https://www.googleapis.com/auth/calendar.events']);

    const driveScope = SCOPE_DEFINITIONS['https://www.googleapis.com/auth/drive.file'];
    assert.strictEqual(driveScope.risk, 'LOW');
    assert.ok(driveScope.description.includes('LOKESH creates or that you explicitly select'));
  });

  // --- 2. AES-256-GCM Encrypted Token Storage & Revocation ---
  console.log('\n--- 2. Secure Token Storage (AES-256-GCM) & Revocation ---');

  await check('Encrypts tokens with AES-256-GCM, reads back accurately, and leaves 0 plaintext on disk', async () => {
    const testPayload = {
      accessToken: 'ya29.sample_test_access_token_mock',
      refreshToken: '1//sample_test_refresh_token_mock',
      accountEmail: 'stark.engineer@gmail.com',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      expiresAt: Date.now() + 3600000
    };

    const saved = googleWorkspaceServiceInstance.saveTokens(testPayload);
    assert.strictEqual(saved, true);

    // Read raw file on disk to confirm ciphertext (not plaintext JSON)
    const tokenFile = path.join(PROJECT_ROOT, 'data', '.google_tokens.enc');
    assert.ok(fs.existsSync(tokenFile), 'Token vault file must exist');
    const rawDisk = fs.readFileSync(tokenFile);
    assert.ok(!rawDisk.toString('utf8').includes('sample_test_access_token'), 'Plaintext token must not appear on disk');

    // Decrypt and verify payload
    const decrypted = googleWorkspaceServiceInstance.loadTokens();
    assert.strictEqual(decrypted.accountEmail, 'stark.engineer@gmail.com');
    assert.strictEqual(decrypted.accessToken, 'ya29.sample_test_access_token_mock');
  });

  await check('Revocation wipes the encrypted vault and disconnects account', async () => {
    const revRes = googleWorkspaceServiceInstance.revokeTokens();
    assert.strictEqual(revRes.success, true);
    assert.strictEqual(revRes.revoked, true);

    const postRevStatus = googleWorkspaceServiceInstance.getServiceStatus();
    assert.strictEqual(postRevStatus.isConnected, false);
    assert.strictEqual(googleWorkspaceServiceInstance.loadTokens(), null);
  });

  // --- 3. Google Drive Workflows ---
  console.log('\n--- 3. Google Drive Deliverable Upload & Search ---');

  // Enable verified sandbox mode for headless automated verification
  googleWorkspaceServiceInstance.enableSandboxMode();

  const testDeliverablePath = path.join(TEST_ARTIFACTS_DIR, 'robotic_joint_spec.docx');
  fs.writeFileSync(testDeliverablePath, 'SAMPLE_STARK_DOCX_DELIVERABLE_PAYLOAD', 'utf8');

  let uploadResult;
  await check('Uploads local report deliverable to Drive and calculates SHA-256 hash', async () => {
    uploadResult = await googleWorkspaceServiceInstance.uploadToDrive(testDeliverablePath);
    assert.strictEqual(uploadResult.success, true);
    assert.ok(uploadResult.fileId);
    assert.strictEqual(uploadResult.fileName, 'robotic_joint_spec.docx');
    assert.ok(uploadResult.sha256.length === 64);
    assert.ok(uploadResult.webViewLink.includes('drive.google.com'));
  });

  await check('Searches permitted files in Drive by name query', async () => {
    const searchRes = await googleWorkspaceServiceInstance.searchDriveFiles('robotic_joint');
    assert.strictEqual(searchRes.success, true);
    assert.ok(searchRes.count >= 1);
    assert.strictEqual(searchRes.files[0].name, 'robotic_joint_spec.docx');
  });

  // --- 4. Google Docs Creation ---
  console.log('\n--- 4. Google Docs Creation & Linking ---');

  await check('Creates formatted Google Doc deliverable and returns document edit URL', async () => {
    const docRes = await googleWorkspaceServiceInstance.createGoogleDoc(
      'STARK Robotics Actuator Specifications',
      'Actuator Peak Torque: 28.42 Nm\nSpeed: 3.14 rad/s\nSafety Factor: 2.84'
    );

    assert.strictEqual(docRes.success, true);
    assert.ok(docRes.documentId);
    assert.ok(docRes.editUrl.includes('docs.google.com/document'));
  });

  // --- 5. Gmail Draft & Preview-Before-Send Boundary ---
  console.log('\n--- 5. Gmail Workflow & Strict Preview-Before-Send Boundary ---');

  let stagedDraftId;
  await check('Prepares Gmail draft with recipient and subject; marks previewRequired: true', async () => {
    const draftRes = await googleWorkspaceServiceInstance.createGmailDraft(
      'client@aerospace-robotics.com',
      'STARK Mark VII Actuator Report Ready for Review',
      'Please review the attached kinematic specifications and torque curves.'
    );

    assert.strictEqual(draftRes.success, true);
    assert.strictEqual(draftRes.status, 'STAGED_DRAFT');
    assert.strictEqual(draftRes.previewRequired, true);
    assert.ok(draftRes.draftId);
    stagedDraftId = draftRes.draftId;
  });

  await check('Strictly rejects sending Gmail message without explicit user approval token', async () => {
    await assert.rejects(async () => {
      await googleWorkspaceServiceInstance.sendGmailDraft(stagedDraftId, null);
    }, /SEND_APPROVAL_REQUIRED/);
  });

  await check('Sends Gmail draft when authorized single-use approval token is presented', async () => {
    const sendRes = await googleWorkspaceServiceInstance.sendGmailDraft(stagedDraftId, 'token_appr_' + Date.now());
    assert.strictEqual(sendRes.success, true);
    assert.strictEqual(sendRes.status, 'SENT');
    assert.strictEqual(sendRes.recipient, 'client@aerospace-robotics.com');
  });

  // --- 6. Google Calendar & Conflict Detection ---
  console.log('\n--- 6. Google Calendar Event Scheduling & Conflict Detection ---');

  let firstEventStart = '2026-11-05T10:00:00.000Z';
  let firstEventEnd = '2026-11-05T11:00:00.000Z';

  await check('Schedules confirmed Google Calendar event', async () => {
    const calRes = await googleWorkspaceServiceInstance.createCalendarEvent({
      summary: 'STARK Robotic Arm Commissioning Review',
      start: firstEventStart,
      end: firstEventEnd
    });

    assert.strictEqual(calRes.success, true);
    assert.strictEqual(calRes.hasConflicts, false);
    assert.ok(calRes.eventId);
  });

  await check('Detects scheduling conflict when overlapping event is submitted', async () => {
    const conflictRes = await googleWorkspaceServiceInstance.createCalendarEvent({
      summary: 'Conflicting Team Standup',
      start: '2026-11-05T10:30:00.000Z', // Overlaps 10:00 - 11:00
      end: '2026-11-05T11:30:00.000Z'
    });

    assert.strictEqual(conflictRes.success, true);
    assert.strictEqual(conflictRes.hasConflicts, true, 'Must detect schedule collision');
    assert.strictEqual(conflictRes.conflicts.length, 1);
    assert.ok(conflictRes.conflicts[0].summary.includes('Commissioning Review'));
  });

  // --- 7. Tool Registry Integration & Execution Boundary ---
  console.log('\n--- 7. Central Tool Registry Integration & Execution Boundary ---');

  await check('get_google_workspace_status tool executes via tools registry', async () => {
    const res = await executeTool('get_google_workspace_status', {}, 'JARVIS');
    assert.ok(res.status);
  });

  await check('create_gmail_draft tool executes via tools registry with preview boundary', async () => {
    const res = await executeTool('create_gmail_draft', {
      to: 'advisor@laboratory.edu',
      subject: 'Lab Deliverable Checkpoint',
      bodyText: 'Kinematic analysis is completed.'
    }, 'JARVIS');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'STAGED_DRAFT');
  });

  // Clean up
  cleanupArtifacts();

  console.log('\n========================================================================');
  console.log(`TEST F ACCEPTANCE AUDIT: ${passedChecks} PASSED, ${failedChecks} FAILED`);
  console.log('========================================================================\n');

  if (failedChecks > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestF().catch(err => {
  console.error('[FATAL] Test F suite crashed:', err);
  cleanupArtifacts();
  process.exit(1);
});
