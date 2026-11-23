/**
 * STARK AI — Test D Acceptance Verification: Self-Programming & Self-Repair
 * 
 * Verifies Section 23 Test D requirements:
 * 1. Reproduces a harmless defect in a disposable test fixture.
 * 2. Patches the defect in isolation with automated diagnosis and minimal surgical fix.
 * 3. Runs regression tests and verifies the fix with empirical evidence.
 * 4. Demonstrates automated rollback when a patch fails or introduces regressions.
 * 5. Verifies post-rollback file integrity (SHA-256 matches pre-patch state).
 * 6. Strictly enforces immutable security core assets (denies modifications to security components).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const { selfDevelopmentEngineInstance, IMMUTABLE_CORE_ASSETS } = require('./server/selfDevelopmentEngine.js');
const { executeTool } = require('./server/toolsRegistry.js');

const PROJECT_ROOT = path.resolve(__dirname);
const FIXTURE_DIR = path.join(PROJECT_ROOT, 'scratch', 'test_d_fixture');
const REL_FIXTURE_DIR = path.relative(PROJECT_ROOT, FIXTURE_DIR);

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

function cleanupFixture() {
  try {
    if (fs.existsSync(FIXTURE_DIR)) {
      fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('[FIXTURE_CLEANUP_WARN]', e.message);
  }
}

function setupFixtureFiles() {
  cleanupFixture();
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  // 1. Target source module with a harmless bug in division
  const targetCode = `/**
 * Engineering Calculation Helper
 */
function calculateJointVelocity(displacementRad, timeSec) {
  if (timeSec === 0) return 0;
  // Buggy implementation: multiplying instead of dividing
  return displacementRad * timeSec;
}

function calculateTorqueRatio(loadNm, motorNm) {
  if (motorNm === 0) return 0;
  return loadNm / motorNm;
}

module.exports = { calculateJointVelocity, calculateTorqueRatio };
`;
  fs.writeFileSync(path.join(FIXTURE_DIR, 'kinematicsCalc.js'), targetCode, 'utf8');

  // 2. Unit test file that asserts velocity = 10 rad / 2 sec = 5 rad/s
  const testCode = `const assert = require('assert');
const { calculateJointVelocity, calculateTorqueRatio } = require('./kinematicsCalc.js');

// Test 1: Velocity calculation
const velocity = calculateJointVelocity(10, 2);
assert.strictEqual(velocity, 5, 'calculateJointVelocity(10, 2) must equal 5');

// Test 2: Torque ratio
const ratio = calculateTorqueRatio(100, 20);
assert.strictEqual(ratio, 5, 'calculateTorqueRatio(100, 20) must equal 5');

console.log('ALL_KINEMATICS_TESTS_PASSED');
`;
  fs.writeFileSync(path.join(FIXTURE_DIR, 'test_kinematics.js'), testCode, 'utf8');
}

async function runTestD() {
  console.log('\n========================================================================');
  console.log('STARK AI — TEST D: AUTONOMOUS SELF-PROGRAMMING & ROLLBACK VERIFICATION');
  console.log('========================================================================\n');

  setupFixtureFiles();

  const relTargetFile = path.join(REL_FIXTURE_DIR, 'kinematicsCalc.js');
  const relTestFile = path.join(REL_FIXTURE_DIR, 'test_kinematics.js');

  // --- Step 1: Defect Reproduction ---
  console.log('--- 1. Defect Reproduction & Autonomous Diagnosis ---');

  await check('Initial test run reproduces the harmless defect (exitCode !== 0)', async () => {
    const runRes = await selfDevelopmentEngineInstance.runProjectTests({ testFile: relTestFile });
    assert.strictEqual(runRes.success, false, 'Test must fail on buggy implementation');
    assert.ok(runRes.exitCode !== 0, 'Exit code must be non-zero');
    assert.ok(
      (runRes.stderr || runRes.stdout).includes('calculateJointVelocity') ||
      (runRes.stderr || runRes.stdout).includes('AssertionError'),
      'Output must reference failing assertion'
    );
  });

  await check('Autonomous diagnosis isolates failing assertion and root cause', async () => {
    const runRes = await selfDevelopmentEngineInstance.runProjectTests({ testFile: relTestFile });
    const diag = selfDevelopmentEngineInstance.diagnoseTestFailure({
      testOutput: runRes.stderr || runRes.stdout,
      testFile: relTestFile
    });
    assert.strictEqual(diag.success, true);
    assert.ok(diag.verifiedCauses.length > 0 || diag.hypotheses.length > 0);
  });

  // --- Step 2: Successful Autonomous Patch & Verification ---
  console.log('\n--- 2. Isolated Patching, Regression Testing & Fix Verification ---');

  await check('Autonomous workflow applies minimal surgical patch and verifies clean diff', async () => {
    const workflowResult = await selfDevelopmentEngineInstance.executeSoftwareEngineeringWorkflow({
      issueDescription: 'Fix velocity calculation in kinematicsCalc.js: replace displacementRad * timeSec with displacementRad / timeSec',
      failingTestFile: relTestFile,
      targetSourceFile: relTargetFile,
      automatedPatch: {
        targetCode: 'return displacementRad * timeSec;',
        replacementCode: 'return displacementRad / timeSec;'
      }
    });

    assert.strictEqual(workflowResult.success, true, 'Workflow must succeed');
    assert.strictEqual(workflowResult.fixVerified, true, 'Fix must be verified');
    assert.strictEqual(workflowResult.rolledBack, false, 'No rollback should occur on valid fix');
    assert.strictEqual(workflowResult.reproduced, true, 'Original bug must be recorded as reproduced');
    assert.ok(workflowResult.diff.includes('+return displacementRad / timeSec;'), 'Diff must show surgical change');

    // Confirm the test now passes
    const reTest = await selfDevelopmentEngineInstance.runProjectTests({ testFile: relTestFile });
    assert.strictEqual(reTest.success, true, 'Test must pass after patch');
    assert.ok(reTest.stdout.includes('ALL_KINEMATICS_TESTS_PASSED'));
  });

  // --- Step 3: Failed Patch & Automated Rollback Demonstration ---
  console.log('\n--- 3. Failed Patch Detection & Automated Rollback Demonstration ---');

  const preDefectContent = fs.readFileSync(path.join(PROJECT_ROOT, relTargetFile), 'utf8');
  const preDefectHash = crypto.createHash('sha256').update(preDefectContent).digest('hex');

  await check('Flawed patch fails regression test, triggers automated rollback, and restores file', async () => {
    // Attempt a flawed patch that introduces a syntax error / regression
    const rollbackWorkflow = await selfDevelopmentEngineInstance.executeSoftwareEngineeringWorkflow({
      issueDescription: 'Attempt invalid patch that will fail verification',
      failingTestFile: relTestFile, // Note: test passes now, so we need a patch that causes it to break
      targetSourceFile: relTargetFile,
      automatedPatch: {
        targetCode: 'return displacementRad / timeSec;',
        replacementCode: 'return displacementRad + "INVALID_STRING_VALUE";'
      }
    });

    assert.strictEqual(rollbackWorkflow.success, false, 'Workflow must return success: false for failed verification');
    assert.strictEqual(rollbackWorkflow.fixVerified, false, 'Fix must NOT be marked verified');
    assert.strictEqual(rollbackWorkflow.rolledBack, true, 'Rollback must be automatically triggered');
    assert.strictEqual(rollbackWorkflow.status, 'ROLLED_BACK', 'Status must be ROLLED_BACK');

    // Verify file content on disk was restored to its exact pre-patch state
    const postRollbackContent = fs.readFileSync(path.join(PROJECT_ROOT, relTargetFile), 'utf8');
    const postRollbackHash = crypto.createHash('sha256').update(postRollbackContent).digest('hex');
    assert.strictEqual(postRollbackHash, preDefectHash, 'File hash after rollback must match original pre-patch hash');
    assert.ok(postRollbackContent.includes('return displacementRad / timeSec;'), 'Original working code must be restored');

    // Verify tests still pass after rollback
    const postRollbackTest = await selfDevelopmentEngineInstance.runProjectTests({ testFile: relTestFile });
    assert.strictEqual(postRollbackTest.success, true, 'Tests must pass on restored codebase');
  });

  // --- Step 4: Security Core Immutability Enforcement ---
  console.log('\n--- 4. Inviolable Security Core Asset Protection ---');

  for (const immutableAsset of IMMUTABLE_CORE_ASSETS) {
    await check(`Strictly blocks modification of immutable security asset: ${immutableAsset}`, async () => {
      assert.throws(() => {
        selfDevelopmentEngineInstance.validateCandidatePatch({
          filePath: immutableAsset,
          targetCode: 'foo',
          replacementCode: 'bar'
        });
      }, /IMMUTABLE_CORE_FILE/);
    });
  }

  // --- Step 5: Verification via Tool Registry ---
  console.log('\n--- 5. Tool Registry Integration & Execution Boundary ---');

  await check('execute_software_engineering_workflow tool is callable via tools registry', async () => {
    const res = await executeTool('execute_software_engineering_workflow', {
      issueDescription: 'Tool registry verification test',
      failingTestFile: relTestFile,
      targetSourceFile: relTargetFile,
      automatedPatch: {
        targetCode: 'return displacementRad / timeSec;',
        replacementCode: 'return displacementRad / timeSec; // verified by tool registry'
      }
    }, 'JARVIS');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.fixVerified, true);
  });

  // Clean up fixture after successful tests
  cleanupFixture();

  console.log('\n========================================================================');
  console.log(`TEST D ACCEPTANCE AUDIT: ${passedChecks} PASSED, ${failedChecks} FAILED`);
  console.log('========================================================================\n');

  if (failedChecks > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestD().catch(err => {
  console.error('[FATAL] Test D suite crashed:', err);
  cleanupFixture();
  process.exit(1);
});
