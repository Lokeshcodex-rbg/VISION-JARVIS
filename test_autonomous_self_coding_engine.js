/**
 * STARK AI — Autonomous Self-Coding & Self-Development Engine Test Suite
 * Comprehensive automated verification covering:
 * 1. Project inspection & multi-language detection (Node.js, Python, Git)
 * 2. Source file creation, atomic editing, and optimistic concurrency hashing
 * 3. Path traversal defense & immutable security core asset protection
 * 4. Stale edit detection and ambiguous target rejection
 * 5. Dynamic tool creation, schema validation, registration, and runtime execution
 * 6. Permission gate enforcement on dynamic tools (ULTRON vs JARVIS)
 * 7. Automated test generation and test runner
 * 8. Diagnosis of deliberately introduced test failures
 * 9. Autonomous repair loop (Inspect -> Reproduce -> Diagnose -> Patch -> Test -> Validate)
 * 10. Rollback to versioned backups
 * 11. Candidate build validation and emergency stop enforcement
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { selfDevelopmentEngineInstance, IMMUTABLE_CORE_ASSETS } = require('./server/selfDevelopmentEngine.js');
const { dynamicToolsManagerInstance } = require('./server/dynamicToolsManager.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
const { executeTool } = require('./server/toolsRegistry.js');

const PROJECT_ROOT = process.env.JARVIS_PROJECT_PATH
  ? path.resolve(process.env.JARVIS_PROJECT_PATH)
  : path.resolve(__dirname);

const DISPOSABLE_DIR = path.join(PROJECT_ROOT, 'scratch', 'disposable_test_project');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function it(description, fn) {
  totalTests++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      await result;
    }
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] #${totalTests}: ${description} -> ${err.message}`);
  }
}

async function setupDisposableProject() {
  if (fs.existsSync(DISPOSABLE_DIR)) {
    fs.rmSync(DISPOSABLE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DISPOSABLE_DIR, { recursive: true });

  // 1. package.json
  const pkg = {
    name: 'stark-disposable-sandbox',
    version: '1.0.0',
    scripts: {
      test: 'node test_math.js',
      build: 'node -e "console.log(\'Build complete\')"'
    },
    dependencies: {
      express: '^4.18.2'
    }
  };
  fs.writeFileSync(path.join(DISPOSABLE_DIR, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');

  // 2. index.js
  const indexJs = `/**
 * Sandbox index entry point
 */
const greeting = "Hello Stark";
module.exports = { greeting };
`;
  fs.writeFileSync(path.join(DISPOSABLE_DIR, 'index.js'), indexJs, 'utf8');

  // 3. calculator.js
  const calcJs = `/**
 * Math calculator module
 */
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add, multiply };
`;
  fs.writeFileSync(path.join(DISPOSABLE_DIR, 'calculator.js'), calcJs, 'utf8');

  // 4. script.py
  const scriptPy = `# Python helper script
def calculate_power(base, exp):
    return base ** exp

if __name__ == '__main__':
    print(calculate_power(2, 3))
`;
  fs.writeFileSync(path.join(DISPOSABLE_DIR, 'script.py'), scriptPy, 'utf8');
}

async function runSelfCodingVerificationCampaign() {
  console.log('\n===============================================================================');
  console.log('   STARK AI AUTONOMOUS SELF-DEVELOPMENT & SELF-CODING VERIFICATION SUITE       ');
  console.log('===============================================================================\n');

  await setupDisposableProject();
  const relDisposableDir = path.relative(PROJECT_ROOT, DISPOSABLE_DIR);

  // =========================================================================
  // 1. Repository & Project Inspection
  // =========================================================================
  console.log('[SECTION 1] Project Inspection & Language Detection:');

  await it('1.1. Inspects disposable project and detects Node.js and Python runtimes', async () => {
    const res = await selfDevelopmentEngineInstance.inspectProject({ targetDir: relDisposableDir });
    assert.strictEqual(res.success, true);
    assert(res.projectTypes.includes('Node.js / JavaScript'));
    assert(res.projectTypes.includes('Python'));
    assert(res.toolchains.node.available, 'Node runtime must be available');
    assert(res.toolchains.python.available, 'Python runtime must be available');
    assert.strictEqual(res.packageInfo.name, 'stark-disposable-sandbox');
  });

  await it('1.2. Searches source code with line context and line numbers', async () => {
    const res = selfDevelopmentEngineInstance.searchSourceCode({ query: 'calculate_power' });
    assert.strictEqual(res.success, true);
    assert(res.resultsCount >= 1);
    assert(res.matches.some(m => m.file.includes('script.py')));
    assert(res.matches[0].context.includes('>>>'));
  });

  await it('1.3. Reads source file with SHA-256 hash and line numbers', async () => {
    const res = selfDevelopmentEngineInstance.readSourceFile({
      filePath: path.join(relDisposableDir, 'calculator.js')
    });
    assert.strictEqual(res.success, true);
    assert(res.sha256 && res.sha256.length === 64, 'Must return 64-char sha256 hash');
    assert(res.totalLines >= 10);
    assert(res.code.includes('add(a, b)'));
  });

  // =========================================================================
  // 2. Code Writing, Creation & Atomic Editing
  // =========================================================================
  console.log('\n[SECTION 2] Code Writing, Path Security & Atomic Editing:');

  await it('2.1. Creates new source file with directory auto-scaffolding', async () => {
    const targetFile = path.join(relDisposableDir, 'lib', 'formatter.js');
    const content = 'module.exports = { format: (s) => String(s).trim().toUpperCase() };\n';
    const res = selfDevelopmentEngineInstance.createSourceFile({
      filePath: targetFile,
      content
    });
    assert.strictEqual(res.success, true);
    assert(fs.existsSync(path.join(PROJECT_ROOT, targetFile)));
    assert.strictEqual(fs.readFileSync(path.join(PROJECT_ROOT, targetFile), 'utf8'), content);
  });

  await it('2.2. Rejects path traversal outside workspace root', async () => {
    assert.throws(() => {
      selfDevelopmentEngineInstance.createSourceFile({
        filePath: '../../evil_script.js',
        content: 'malicious'
      });
    }, /Security Violation: Path/);
  });

  await it('2.3. Strictly denies modification of immutable security core assets', async () => {
    for (const coreAsset of IMMUTABLE_CORE_ASSETS) {
      assert.throws(() => {
        selfDevelopmentEngineInstance.editSourceFile({
          filePath: coreAsset,
          targetCode: 'foo',
          replacementCode: 'bar'
        });
      }, /immutable security core asset/);
    }
  });

  await it('2.4. Atomically edits file, detects stale hashes, and creates backups', async () => {
    const targetFile = path.join(relDisposableDir, 'calculator.js');
    const read1 = selfDevelopmentEngineInstance.readSourceFile({ filePath: targetFile });

    // Test stale hash detection
    assert.throws(() => {
      selfDevelopmentEngineInstance.editSourceFile({
        filePath: targetFile,
        targetCode: 'return a + b;',
        replacementCode: 'return (a + b) * 1;',
        expectedHash: 'stale_hash_1234567890abcdef'
      });
    }, /STALE_FILE_VERSION/);

    // Apply valid edit
    const editRes = selfDevelopmentEngineInstance.editSourceFile({
      filePath: targetFile,
      targetCode: 'return a + b;',
      replacementCode: 'return Number(a) + Number(b);',
      expectedHash: read1.sha256
    });

    assert.strictEqual(editRes.success, true);
    assert(editRes.backupId, 'Must create versioned backup ID');
    assert(fs.existsSync(path.join(PROJECT_ROOT, 'backups', 'code_edits', editRes.backupId)));

    // Verify replacement exists
    const updatedContent = fs.readFileSync(path.join(PROJECT_ROOT, targetFile), 'utf8');
    assert(updatedContent.includes('return Number(a) + Number(b);'));
    assert(updatedContent.includes('multiply(a, b)'), 'Unrelated multiply function must be preserved');
  });

  await it('2.5. Rejects ambiguous edits occurring multiple times without allowMultiple', async () => {
    const targetFile = path.join(relDisposableDir, 'ambiguous_test.js');
    fs.writeFileSync(path.join(PROJECT_ROOT, targetFile), 'const x = 1;\nconst y = 1;\n', 'utf8');

    assert.throws(() => {
      selfDevelopmentEngineInstance.editSourceFile({
        filePath: targetFile,
        targetCode: '1;',
        replacementCode: '2;',
        allowMultiple: false
      });
    }, /AMBIGUOUS_TARGET/);
  });

  // =========================================================================
  // 3. Dynamic Tool Scaffolding, Registration & Execution
  // =========================================================================
  console.log('\n[SECTION 3] Dynamic Tool Creation & Permission Matrix:');

  await it('3.1. Scaffolds, registers, and executes brand new dynamic calculator tool', async () => {
    const toolDef = {
      toolId: 'dynamic_calculator',
      name: 'Dynamic Calculator',
      description: 'Executes dynamic arithmetic operations',
      personality: 'JARVIS',
      category: 'PRODUCTIVITY_TASKS',
      parameters: {
        a: { type: 'number', required: true },
        b: { type: 'number', required: true },
        op: { type: 'string', required: true }
      }
    };

    const toolCode = `/**
 * STARK AI Dynamic Tool: Dynamic Calculator
 */
module.exports = {
  execute: async function(args = {}) {
    const a = Number(args.a || 0);
    const b = Number(args.b || 0);
    const op = String(args.op || 'add').toLowerCase();
    let result = 0;
    if (op === 'add') result = a + b;
    else if (op === 'multiply') result = a * b;
    else if (op === 'subtract') result = a - b;
    else if (op === 'divide') result = b !== 0 ? a / b : null;
    return {
      success: true,
      a,
      b,
      operation: op,
      result,
      summary: "Result: " + result
    };
  }
};
`;

    const regRes = dynamicToolsManagerInstance.createAndRegisterTool(toolDef, toolCode);
    assert.strictEqual(regRes.success, true);
    assert(dynamicToolsManagerInstance.hasTool('dynamic_calculator'));

    // Execute through central executeTool
    const execRes = await executeTool('dynamic_calculator', { a: 15, b: 27, op: 'add' }, 'JARVIS');
    assert.strictEqual(execRes.success, true);
    assert.strictEqual(execRes.result.result, 42);
    assert.strictEqual(execRes.result.operation, 'add');
  });

  await it('3.2. Enforces profile policy on dynamic tools: ULTRON denied execution of non-whitelisted category', async () => {
    // Register tool with APPLICATION_LAUNCH category
    const restrictedToolDef = {
      toolId: 'dynamic_restricted_launcher',
      name: 'Dynamic Launcher',
      description: 'Launches desktop actions',
      personality: 'JARVIS',
      category: 'APPLICATION_LAUNCH'
    };

    dynamicToolsManagerInstance.createAndRegisterTool(restrictedToolDef);

    // ULTRON attempt must be rejected by permissionGate
    await assert.rejects(async () => {
      await executeTool('dynamic_restricted_launcher', {}, 'ULTRON');
    }, /ULTRON is operating under restricted read-only governance/);
  });

  // =========================================================================
  // 4. Autonomous Test Generation, Execution & Debugging Loop
  // =========================================================================
  console.log('\n[SECTION 4] Autonomous Testing, Diagnosis & Repair Loop:');

  await it('4.1. Generates unit test file and runs test runner cleanly', async () => {
    const genRes = selfDevelopmentEngineInstance.generateTests({
      targetModulePath: path.join(relDisposableDir, 'calculator.js'),
      testDir: relDisposableDir
    });
    assert.strictEqual(genRes.success, true);
    assert(fs.existsSync(path.join(PROJECT_ROOT, genRes.testFilePath)));

    // Run test runner
    const testRun = await selfDevelopmentEngineInstance.runProjectTests({
      testFile: genRes.testFilePath
    });
    assert.strictEqual(testRun.success, true);
    assert.strictEqual(testRun.exitCode, 0);
  });

  await it('4.2. Diagnoses deliberately introduced test assertion failure', async () => {
    const failingTestPath = path.join(relDisposableDir, 'test_failing.js');
    const failingCode = `const assert = require('assert');
const { add } = require('./calculator.js');
// Deliberately incorrect assertion
assert.strictEqual(add(2, 2), 5);
`;
    fs.writeFileSync(path.join(PROJECT_ROOT, failingTestPath), failingCode, 'utf8');

    const testRun = await selfDevelopmentEngineInstance.runProjectTests({ testFile: failingTestPath });
    assert.strictEqual(testRun.success, false);
    assert.strictEqual(testRun.exitCode, 1);

    const diag = selfDevelopmentEngineInstance.diagnoseTestFailure({
      testOutput: testRun.stderr || testRun.stdout,
      testFile: failingTestPath
    });

    assert.strictEqual(diag.success, true);
    assert.strictEqual(diag.confidence, 'HIGH');
    assert(diag.verifiedCauses.some(c => c.type === 'ASSERTION_MISMATCH'));
  });

  await it('4.3. Autonomous repair loop inspects, patches, re-tests, and resolves bug', async () => {
    const bugTargetFile = path.join(relDisposableDir, 'math_broken.js');
    const testFile = path.join(relDisposableDir, 'test_math_broken.js');

    // Buggy function: subtracts instead of adds
    fs.writeFileSync(path.join(PROJECT_ROOT, bugTargetFile), 'module.exports = { sum: (a, b) => a - b };\n', 'utf8');
    fs.writeFileSync(
      path.join(PROJECT_ROOT, testFile),
      `const assert = require('assert');\nconst { sum } = require('./math_broken.js');\nassert.strictEqual(sum(10, 5), 15);\nconsole.log('Math passed');\n`,
      'utf8'
    );

    // Initial test must fail
    const initialTest = await selfDevelopmentEngineInstance.runProjectTests({ testFile });
    assert.strictEqual(initialTest.success, false);

    // Run autonomous repair loop with automated patch
    const repairResult = await selfDevelopmentEngineInstance.repairCodeFailure({
      failingTestFile: testFile,
      targetSourceFile: bugTargetFile,
      automatedPatch: {
        targetCode: 'a - b',
        replacementCode: 'a + b'
      }
    });

    assert.strictEqual(repairResult.success, true);
    assert.strictEqual(repairResult.resolved, true);
    assert.strictEqual(repairResult.attemptsCount, 1);

    // Re-verify test passes
    const reTest = await selfDevelopmentEngineInstance.runProjectTests({ testFile });
    assert.strictEqual(reTest.success, true);
    assert.strictEqual(reTest.exitCode, 0);
  });

  // =========================================================================
  // 5. Workspaces, Rollback & Emergency Stop
  // =========================================================================
  console.log('\n[SECTION 5] Workspaces, Rollback & Emergency Stop:');

  await it('5.1. Restores modified file from backup via rollbackCodeChange', async () => {
    const rollbackTarget = path.join(relDisposableDir, 'rollback_test.js');
    const originalContent = 'const status = "GOOD_ORIGINAL";\n';
    fs.writeFileSync(path.join(PROJECT_ROOT, rollbackTarget), originalContent, 'utf8');

    // Make an edit
    const editRes = selfDevelopmentEngineInstance.editSourceFile({
      filePath: rollbackTarget,
      targetCode: 'GOOD_ORIGINAL',
      replacementCode: 'CORRUPTED_CODE'
    });

    // Rollback using backupId
    const rbRes = selfDevelopmentEngineInstance.rollbackCodeChange({
      filePath: rollbackTarget,
      backupId: editRes.backupId
    });

    assert.strictEqual(rbRes.success, true);
    const restored = fs.readFileSync(path.join(PROJECT_ROOT, rollbackTarget), 'utf8');
    assert.strictEqual(restored, originalContent, 'Content must match original');
  });

  await it('5.2. Global Emergency Stop halts self-development tool executions immediately', async () => {
    permissionGateInstance.triggerEmergencyStop('Automated self-dev emergency stop test');
    assert.strictEqual(permissionGateInstance.isEmergencyStopActive(), true);

    await assert.rejects(async () => {
      await executeTool('inspect_project', {}, 'JARVIS');
    }, /Emergency Stop is ACTIVE/);

    permissionGateInstance.resetEmergencyStop();
    assert.strictEqual(permissionGateInstance.isEmergencyStopActive(), false);

    const postReset = await executeTool('inspect_project', { targetDir: relDisposableDir }, 'JARVIS');
    assert.strictEqual(postReset.success, true);
  });

  console.log('\n===============================================================================');
  console.log(`SELF-DEV CAMPAIGN SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('===============================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSelfCodingVerificationCampaign().catch((err) => {
  console.error('[FATAL] Self-dev test suite crashed:', err);
  process.exit(1);
});
