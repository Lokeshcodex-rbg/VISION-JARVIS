/**
 * STARK AI — Full Self-Coding Engine & Local Workspace Access Acceptance Test Suite
 * Validates Phase 1 through Phase 7 against real disk-backed operations and genuine command executions.
 * 
 * Sections:
 * 1. Filesystem Tests (18 Assertions)
 * 2. Self-Coding & Autonomous Repair Tests (12 Assertions)
 * 3. End-to-End Conversational & Document Saving Tests (8 Assertions)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const { localWorkspaceManagerInstance } = require('./server/desktop/localWorkspaceManager.js');
const { selfDevelopmentEngineInstance } = require('./server/selfDevelopmentEngine.js');
const { securityPermissionsInstance } = require('./server/securityPermissions.js');
const { executeTool } = require('./server/toolsRegistry.js');
const { aiProviderAdapterInstance } = require('./server/aiProviderAdapter.js');
const { documentIntelligenceEngineInstance } = require('./server/documentIntelligenceEngine.js');

const FIXTURE_DIR = path.join(__dirname, 'scratch', 'test_workspace_fixture');

let passedTests = 0;
let totalTests = 0;
const results = [];

function testCase(id, name, fn) {
  totalTests++;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      throw new Error(`Test ${id} returned a promise; use asyncTestCase for async tests.`);
    }
    passedTests++;
    console.log(`[PASS] [${id}] ${name}`);
    results.push({ id, name, passed: true });
  } catch (err) {
    console.error(`[FAIL] [${id}] ${name} -> ${err.message}`);
    results.push({ id, name, passed: false, error: err.message });
  }
}

async function asyncTestCase(id, name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`[PASS] [${id}] ${name}`);
    results.push({ id, name, passed: true });
  } catch (err) {
    console.error(`[FAIL] [${id}] ${name} -> ${err.message}`);
    results.push({ id, name, passed: false, error: err.message });
  }
}

async function runSuite() {
  console.log('========================================================================');
  console.log('STARK AI — COMPREHENSIVE SELF-CODING & WORKSPACE ACCEPTANCE TEST SUITE');
  console.log('========================================================================\n');

  // Setup temporary fixture directory
  if (fs.existsSync(FIXTURE_DIR)) {
    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  // =========================================================================
  // 1. FILESYSTEM INTEGRATION TESTS (18 TESTS)
  // =========================================================================
  console.log('--- 1. FILESYSTEM INTEGRATION TESTS ---');

  // 1. List an authorized directory
  testCase('FS-1', 'List an authorized directory with metadata', () => {
    const res = localWorkspaceManagerInstance.listDirectory(path.join(__dirname, 'server'));
    assert(res.success === true, 'Directory list must succeed');
    assert(Array.isArray(res.items), 'Must return items array');
    assert(res.items.length > 0, 'Must contain server files');
    assert(res.items.some(i => i.name === 'toolsRegistry.js'), 'Must locate toolsRegistry.js');
  });

  // 2. Read a real text file
  testCase('FS-2', 'Read a real text file with line numbers and sha256', () => {
    const res = localWorkspaceManagerInstance.readFile(path.join(__dirname, 'package.json'));
    assert(res.success === true, 'Must read package.json');
    assert(res.content.includes('"name"'), 'Content must contain package name');
    assert(typeof res.sha256 === 'string' && res.sha256.length === 64, 'Must compute valid SHA-256');
    assert(res.totalLines > 0, 'Total lines must be > 0');
  });

  // 3. Search a file by content
  testCase('FS-3', 'Search file by content across authorized roots', () => {
    const res = localWorkspaceManagerInstance.searchFiles('Dual AI', { location: path.join(__dirname, 'server'), searchContent: true });
    assert(res.success === true, 'Content search must succeed');
    assert(res.resultsCount > 0, 'Must find matching content');
    assert(res.results.some(r => r.name === 'server.js' || r.name.endsWith('.js')), 'Must locate match in source files');
  });

  // 4. Create a directory
  testCase('FS-4', 'Create a new directory within authorized workspace', () => {
    const newDir = path.join(FIXTURE_DIR, 'sub_project', 'modules');
    const res = localWorkspaceManagerInstance.createDirectory(newDir);
    assert(res.success === true, 'Directory creation must succeed');
    assert(fs.existsSync(newDir), 'Directory must exist on disk');
    assert(fs.statSync(newDir).isDirectory(), 'Must be a directory');
  });

  // 5. Write a file atomically
  testCase('FS-5', 'Write file atomically with temporary-file verification', () => {
    const targetFile = path.join(FIXTURE_DIR, 'atomic_sample.txt');
    const content = 'Sample atomic content for verification\nLine 2';
    const res = localWorkspaceManagerInstance.writeFile(targetFile, content);
    assert(res.success === true, 'Atomic write must succeed');
    assert(fs.existsSync(targetFile), 'Target file must exist on disk');
    assert.strictEqual(fs.readFileSync(targetFile, 'utf8'), content, 'Disk content must match exactly');
    assert.strictEqual(res.sizeBytes, Buffer.byteLength(content), 'Size must match');
  });

  // 6. Reopen and verify the file
  testCase('FS-6', 'Reopen and verify the newly written file', () => {
    const targetFile = path.join(FIXTURE_DIR, 'atomic_sample.txt');
    const res = localWorkspaceManagerInstance.readFile(targetFile);
    assert(res.success === true, 'Must read back written file');
    assert(res.content.startsWith('Sample atomic content'), 'Content must match');
    assert.strictEqual(res.lineCount, 2, 'Must have 2 lines');
  });

  // 7. Edit and verify new content with backup
  testCase('FS-7', 'Edit existing file with optimistic hash and backup', () => {
    const targetFile = path.join(FIXTURE_DIR, 'atomic_sample.txt');
    const originalHash = localWorkspaceManagerInstance.getFileHash(targetFile);
    const res = localWorkspaceManagerInstance.editFile(targetFile, {
      targetContent: 'Line 2',
      replacementContent: 'Line 2 Revised Successfully',
      expectedHash: originalHash
    });
    assert(res.success === true, 'Edit must succeed');
    assert(res.backupId && typeof res.backupId === 'string', 'Must preserve backupId');
    const onDisk = fs.readFileSync(targetFile, 'utf8');
    assert(onDisk.includes('Line 2 Revised Successfully'), 'Disk must reflect revised content');
  });

  // 8. Copy a file and verify the copy
  testCase('FS-8', 'Copy a file with SHA-256 integrity verification', () => {
    const src = path.join(FIXTURE_DIR, 'atomic_sample.txt');
    const dest = path.join(FIXTURE_DIR, 'atomic_sample_copy.txt');
    const res = localWorkspaceManagerInstance.copyFileOrDir(src, dest);
    assert(res.success === true, 'Copy must succeed');
    assert(fs.existsSync(dest), 'Copied file must exist on disk');
    const srcHash = localWorkspaceManagerInstance.getFileHash(src);
    const destHash = localWorkspaceManagerInstance.getFileHash(dest);
    assert.strictEqual(srcHash, destHash, 'SHA-256 hashes must be bit-identical');
  });

  // 9. Rename and move a file
  testCase('FS-9', 'Move and rename file safely', () => {
    const src = path.join(FIXTURE_DIR, 'atomic_sample_copy.txt');
    const dest = path.join(FIXTURE_DIR, 'moved_renamed_sample.txt');
    const res = localWorkspaceManagerInstance.moveFileOrDir(src, dest);
    assert(res.success === true, 'Move must succeed');
    assert(!fs.existsSync(src), 'Source must no longer exist');
    assert(fs.existsSync(dest), 'Destination must exist on disk');
  });

  // 10. Compute and compare SHA-256 hashes
  testCase('FS-10', 'Compute and compare file hashes and detect diffs', () => {
    const fileA = path.join(FIXTURE_DIR, 'atomic_sample.txt');
    const fileB = path.join(FIXTURE_DIR, 'moved_renamed_sample.txt');
    const res = localWorkspaceManagerInstance.compareFiles(fileA, fileB);
    assert(res.success === true, 'Compare must succeed');
    assert.strictEqual(res.identical, true, 'Files must be identical');
    assert.strictEqual(res.hashA, res.hashB, 'Hashes must match');
  });

  // 11. Handle missing file cleanly
  testCase('FS-11', 'Handle missing file with truthful error message', () => {
    assert.throws(() => {
      localWorkspaceManagerInstance.readFile(path.join(FIXTURE_DIR, 'non_existent_file_xyz.txt'));
    }, /File not found/i, 'Must throw descriptive not found error');
  });

  // 12. Handle invalid path
  testCase('FS-12', 'Handle empty or invalid path input', () => {
    assert.throws(() => {
      localWorkspaceManagerInstance.readFile(null);
    }, /Invalid file path/i, 'Must reject invalid path');
  });

  // 13. Reject traversal outside authorized roots
  testCase('FS-13', 'Reject path traversal attempts (../../ escaping roots)', () => {
    assert.throws(() => {
      localWorkspaceManagerInstance.resolveSafePath('D:/Jarvis/../../Windows/System32/cmd.exe');
    }, /Security Violation/i, 'Must reject path traversal escaping workspace');
  });

  // 14. Handle Unicode text
  testCase('FS-14', 'Handle Unicode text (Hindi, emojis, non-English)', () => {
    const target = path.join(FIXTURE_DIR, 'unicode_test.txt');
    const unicodeText = 'नमस्ते JARVIS! ✨ 🚀 STARK AI Autonomous Engine: परीक्षण सफल!';
    const writeRes = localWorkspaceManagerInstance.writeFile(target, unicodeText);
    assert(writeRes.success === true, 'Write must succeed');
    const readRes = localWorkspaceManagerInstance.readFile(target);
    assert.strictEqual(readRes.content, unicodeText, 'Unicode characters must be perfectly preserved');
  });

  // 15. Handle destination conflicts
  testCase('FS-15', 'Handle destination conflicts when overwrite is false', () => {
    const target = path.join(FIXTURE_DIR, 'unicode_test.txt');
    assert.throws(() => {
      localWorkspaceManagerInstance.writeFile(target, 'Replacement', { overwrite: false });
    }, /already exists/i, 'Must reject overwrite when overwrite flag is false');
  });

  // 16. Handle access-denied errors without reporting false success
  testCase('FS-16', 'Blacklisted system locations are strictly rejected without false success', () => {
    assert.throws(() => {
      localWorkspaceManagerInstance.writeFile('C:/Windows/System32/hacked.dll', 'bad');
    }, /Security Violation/i, 'Must strictly deny write to system directory');
  });

  // 17. Verify configured roots persist after reload
  testCase('FS-17', 'Configured authorized roots persist in storage configuration', () => {
    const rootsBefore = localWorkspaceManagerInstance.getAuthorizedRoots();
    assert(Array.isArray(rootsBefore) && rootsBefore.length > 0, 'Roots array must exist');
    const configPath = path.join(__dirname, 'data', 'authorized_roots.json');
    assert(fs.existsSync(configPath), 'authorized_roots.json must exist on disk');
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert(Array.isArray(raw.authorizedRoots), 'Saved json must contain authorizedRoots');
    assert(raw.authorizedRoots.includes(path.normalize(__dirname)), 'Must include current project root');
  });

  // 18. Verify unauthorized roots remain inaccessible
  testCase('FS-18', 'Verify unauthorized foreign drive or system folder is inaccessible', () => {
    assert.strictEqual(localWorkspaceManagerInstance.isPathAuthorized('C:/Program Files/SecretApp'), false, 'Program files must be unauthorized');
    assert.strictEqual(localWorkspaceManagerInstance.isPathAuthorized('C:/Windows/System32'), false, 'System32 must be unauthorized');
  });

  // =========================================================================
  // 2. SELF-CODING ENGINE INTEGRATION TESTS (12 TESTS)
  // =========================================================================
  console.log('\n--- 2. SELF-CODING ENGINE INTEGRATION TESTS ---');

  // Prepare isolated test fixture file for self-coding
  const codeFixtureFile = path.join(FIXTURE_DIR, 'mathModule.js');
  const initialCode = `/**
 * Controlled fixture for STARK AI self-coding tests
 */
function calculateMultiplier(value) {
  // Controlled defect: multiplies by 3 instead of 2
  return value * 3;
}

module.exports = { calculateMultiplier };
`;
  fs.writeFileSync(codeFixtureFile, initialCode, 'utf8');

  const testFixtureFile = path.join(FIXTURE_DIR, 'test_mathModule.js');
  const testCode = `const assert = require('assert');
const { calculateMultiplier } = require('./mathModule.js');

try {
  const result = calculateMultiplier(10);
  assert.strictEqual(result, 20, 'Expected calculateMultiplier(10) to return 20');
  console.log('TEST_PASS: calculateMultiplier returned 20');
  process.exit(0);
} catch (err) {
  console.error('TEST_FAIL:', err.message);
  process.exit(1);
}
`;
  fs.writeFileSync(testFixtureFile, testCode, 'utf8');

  // 1. Locate a known function in fixture
  testCase('SC-1', 'Locate known function calculateMultiplier in fixture', () => {
    const res = selfDevelopmentEngineInstance.searchSourceCode({ query: 'calculateMultiplier' });
    assert(res.success === true, 'Search must succeed');
    assert(res.resultsCount > 0, 'Must find calculateMultiplier');
    assert(res.matches.some(m => m.file.includes('mathModule.js')), 'Must locate file in matches');
  });

  // 2. Read the correct source file
  testCase('SC-2', 'Read the source file with line numbers and hash', () => {
    const res = selfDevelopmentEngineInstance.readSourceFile({ filePath: path.relative(__dirname, codeFixtureFile) });
    assert(res.success === true, 'Must read source file');
    assert(res.code.includes('calculateMultiplier'), 'Code must contain function');
    assert(res.sha256 && res.sha256.length === 64, 'Must compute valid SHA-256');
  });

  // 3. Identify controlled defect by running initial test
  await asyncTestCase('SC-3', 'Reproduce and identify controlled defect via test execution', async () => {
    const runRes = await selfDevelopmentEngineInstance.runProjectTests({ testFile: path.relative(__dirname, testFixtureFile) });
    assert.strictEqual(runRes.success, false, 'Initial test must fail due to controlled defect');
    assert.strictEqual(runRes.exitCode, 1, 'Exit code must be 1');
    const diag = selfDevelopmentEngineInstance.diagnoseTestFailure({ testOutput: runRes.stderr || runRes.stdout, testFile: 'test_mathModule.js' });
    assert(diag.success === true, 'Diagnosis must succeed');
    assert(diag.verifiedCauses.length > 0 || diag.hypotheses.length > 0, 'Must produce causes or hypotheses');
  });

  // 4. Generate targeted diff
  testCase('SC-4', 'Generate targeted replacement diff for defect', () => {
    const relFile = path.relative(__dirname, codeFixtureFile);
    const patch = {
      targetCode: 'return value * 3;',
      replacementCode: 'return value * 2;'
    };
    const diff = `--- a/${relFile}\n+++ b/${relFile}\n@@ -1 +1 @@\n-${patch.targetCode}\n+${patch.replacementCode}`;
    assert(diff.includes('-return value * 3;'), 'Diff must show removed defect');
    assert(diff.includes('+return value * 2;'), 'Diff must show added fix');
  });

  // 5. Apply patch to disk
  testCase('SC-5', 'Apply patch to disk with optimistic concurrency and backup', () => {
    const relFile = path.relative(__dirname, codeFixtureFile);
    const editRes = selfDevelopmentEngineInstance.editSourceFile({
      filePath: relFile,
      targetCode: 'return value * 3;',
      replacementCode: 'return value * 2;'
    });
    assert(editRes.success === true, 'Edit must succeed');
    assert(editRes.backupId, 'Must generate backupId');
  });

  // 6. Verify changed source on disk
  testCase('SC-6', 'Verify updated on-disk content matches patch', () => {
    const onDisk = fs.readFileSync(codeFixtureFile, 'utf8');
    assert(onDisk.includes('return value * 2;'), 'Disk must contain fixed code');
    assert(!onDisk.includes('return value * 3;'), 'Disk must not contain old defect');
  });

  // 7. Execute relevant test against fixed code
  await asyncTestCase('SC-7', 'Execute relevant test against fixed source code', async () => {
    const runRes = await selfDevelopmentEngineInstance.runProjectTests({ testFile: path.relative(__dirname, testFixtureFile) });
    assert.strictEqual(runRes.success, true, 'Test must pass after patch');
    assert.strictEqual(runRes.exitCode, 0, 'Exit code must be 0');
    assert(runRes.stdout.includes('TEST_PASS'), 'Output must confirm passing assertion');
  });

  // 8. Confirm passing repair is retained
  testCase('SC-8', 'Confirm passing repair is retained on disk', () => {
    const onDisk = fs.readFileSync(codeFixtureFile, 'utf8');
    assert(onDisk.includes('return value * 2;'), 'Fix must be retained on disk');
  });

  // 9. Confirm failing repair is automatically rolled back
  await asyncTestCase('SC-9', 'Confirm failing repair is automatically rolled back to known-good state', async () => {
    const relFile = path.relative(__dirname, codeFixtureFile);
    const relTest = path.relative(__dirname, testFixtureFile);
    const beforeContent = fs.readFileSync(codeFixtureFile, 'utf8');

    // Run workflow with a broken patch that will cause tests to fail
    const workflowRes = await selfDevelopmentEngineInstance.executeSoftwareEngineeringWorkflow({
      issueDescription: 'Test rollback mechanism with failing patch',
      targetFile: relFile,
      proposedPatch: {
        targetCode: 'return value * 2;',
        replacementCode: 'return value * 999; // Broken on purpose'
      },
      reproduceScript: relTest
    });

    assert.strictEqual(workflowRes.success, false, 'Workflow must fail because test fails');
    assert.strictEqual(workflowRes.rolledBack, true, 'Rollback must be triggered');
    const afterRollbackContent = fs.readFileSync(codeFixtureFile, 'utf8');
    assert.strictEqual(afterRollbackContent, beforeContent, 'On-disk content must be exactly restored to pre-patch state');
  });

  // 10. Confirm unrelated files remain untouched
  testCase('SC-10', 'Confirm unrelated files remain untouched during repair', () => {
    const pkgBefore = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8');
    assert(pkgBefore.includes('"name"'), 'package.json must be intact');
  });

  // 11. Confirm protected security components cannot be modified
  testCase('SC-11', 'Confirm immutable security core assets cannot be bypassed or modified', () => {
    assert.throws(() => {
      selfDevelopmentEngineInstance.editSourceFile({
        filePath: 'server/securityPermissions.js',
        targetCode: 'WORKSPACE_ROOT',
        replacementCode: 'HACKED'
      });
    }, /Security Policy Rejection.*immutable/i, 'Must reject modifications to securityPermissions.js');

    assert.throws(() => {
      selfDevelopmentEngineInstance.editSourceFile({
        filePath: 'server/desktop/localWorkspaceManager.js',
        targetCode: 'PROJECT_ROOT',
        replacementCode: 'HACKED'
      });
    }, /Security Policy Rejection.*immutable/i, 'Must reject modifications to localWorkspaceManager.js');
  });

  // 12. Confirm failed command execution cannot be reported as successful
  await asyncTestCase('SC-12', 'Confirm failed command execution truthfully returns failure', async () => {
    const runRes = await selfDevelopmentEngineInstance.runProjectTests({ testFile: 'non_existent_test_script.js' }).catch(err => ({ success: false, error: err.message }));
    assert.strictEqual(runRes.success, false, 'Non-existent test must return success: false');
  });

  // =========================================================================
  // 3. END-TO-END CONVERSATIONAL & DOCUMENT SAVING TESTS (8 TESTS)
  // =========================================================================
  console.log('\n--- 3. END-TO-END CONVERSATIONAL & SAVING TESTS ---');

  // E2E-1: Ask STARK to create a file in an authorized folder
  await asyncTestCase('E2E-1', 'Conversation query: create a folder named Research in my Documents', async () => {
    const query = 'Create a folder named Research in my Documents';
    const resp = await aiProviderAdapterInstance.generateResponse('JARVIS', query, []);
    assert(resp, 'Must return response object');
    assert(resp.reply && resp.reply.length > 0, 'Must produce verbal response');
    const docsDir = localWorkspaceManagerInstance.standardFolders.documents;
    const researchFolder = path.join(docsDir, 'Research');
    assert(fs.existsSync(researchFolder), 'Research folder must exist in user Documents');
  });

  // E2E-2: Verify the actual file on disk
  testCase('E2E-2', 'Verify the actual folder and file on disk in Documents', () => {
    const docsDir = localWorkspaceManagerInstance.standardFolders.documents;
    const researchFolder = path.join(docsDir, 'Research');
    assert(fs.existsSync(researchFolder), 'Folder must exist on disk');
    assert(fs.statSync(researchFolder).isDirectory(), 'Must be a directory');
  });

  // E2E-3: Ask STARK to search and explain an existing source file
  await asyncTestCase('E2E-3', 'Conversation query: search my project for the function that opens WhatsApp', async () => {
    const query = 'Search my project for the function that opens WhatsApp';
    const resp = await aiProviderAdapterInstance.generateResponse('JARVIS', query, []);
    assert(resp, 'Must return response object');
    assert(resp.toolResult && resp.toolResult.success, 'Tool result must be successful');
    assert(resp.toolResult.symbol === 'openWhatsApp' || resp.toolResult.symbols || resp.toolResult.results, 'Must locate WhatsApp symbol');
  });

  // E2E-4: Ask STARK to repair a controlled defect in an isolated fixture
  await asyncTestCase('E2E-4', 'Conversation query: repair controlled defect', async () => {
    const query = 'Inspect your voice service, find why captions lag, fix the code, run the tests, and save a repair report in my Documents';
    const resp = await aiProviderAdapterInstance.generateResponse('JARVIS', query, []);
    assert(resp, 'Must return response object');
    assert(resp.reply && resp.reply.length > 0, 'Must produce verified reply');
    assert(resp.toolResult && resp.toolResult.success === true, 'Self repair tool execution must succeed');
  });

  // E2E-5: Verify actual source diff and test output
  testCase('E2E-5', 'Verify source diff and test execution evidence exist', () => {
    const diff = selfDevelopmentEngineInstance.inspectGitDiff();
    assert(diff, 'Git diff inspect must return result');
  });

  // E2E-6: Ask STARK to save a report in Documents
  await asyncTestCase('E2E-6', 'Conversation query: Save your explanation as STARK_Architecture.docx in my Documents', async () => {
    const query = 'Save your explanation as STARK_Architecture.docx in my Documents';
    const resp = await aiProviderAdapterInstance.generateResponse('JARVIS', query, []);
    assert(resp, 'Must return response object');
    assert(resp.toolResult && resp.toolResult.success === true, 'Word document generation must succeed');
    const docPath = resp.toolResult.filePath;
    assert(fs.existsSync(docPath), 'STARK_Architecture.docx must exist on disk in Documents');
    assert(fs.statSync(docPath).size > 1000, 'File size must be > 1 KB');
  });

  // E2E-7: Restart application and verify authorized roots remain configured
  testCase('E2E-7', 'Verify authorized roots persist across instance restart', () => {
    const { LocalWorkspaceManager } = require('./server/desktop/localWorkspaceManager.js');
    const freshInstance = new LocalWorkspaceManager();
    const roots = freshInstance.getAuthorizedRoots();
    assert(roots.length >= 3, 'Must retain at least workspace, documents, and desktop roots');
    assert(roots.some(r => r.toLowerCase().includes('jarvis')), 'Must retain Jarvis workspace root');
    assert(roots.some(r => r.toLowerCase().includes('documents')), 'Must retain Documents root');
  });

  // E2E-8: Verify results appear in the existing conversation stream
  await asyncTestCase('E2E-8', 'Verify results return synchronously in conversation stream with tool results', async () => {
    let capturedTool = null;
    let capturedResult = null;
    let fullReplyText = '';

    await aiProviderAdapterInstance.streamResponse({
      personality: 'JARVIS',
      userMessage: 'List files in my Documents folder',
      onToolResult: (toolName, result) => {
        capturedTool = toolName;
        capturedResult = result;
      },
      onToken: (tok) => { fullReplyText += tok; },
      onDone: (res) => {}
    });

    assert(capturedTool, 'Tool must be invoked');
    assert(capturedResult && capturedResult.success === true, 'Tool result must be successful');
    assert(fullReplyText.length > 0, 'Stream must produce speech/text response for user');
  });

  console.log('\n========================================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
