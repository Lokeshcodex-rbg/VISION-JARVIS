const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { taskOrchestratorInstance } = require('./server/taskOrchestrator.js');
const { appLauncherInstance } = require('./server/desktop/appLauncher.js');
const { documentAutomationServiceInstance } = require('./server/desktop/documentAutomationService.js');
const { aiAdapterInstance } = require('./server/aiProviderAdapter.js');
const { TOOLS } = require('./server/toolsRegistry.js');
const resourceComputeManager = require('./server/resourceComputeManager.js');
const { experimentLedgerInstance } = require('./server/experimentLedger.js');

async function runAllVerificationTests() {
  console.log('========================================================');
  console.log(' STARK AI 3.0 — AUTONOMOUS REAL-WORLD CAPABILITY TEST');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  [PASS] Assertion ${total}: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  [FAIL] Assertion ${total}: ${name}`);
      console.error('         ', e.message);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] Assertion ${total}: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  [FAIL] Assertion ${total}: ${name}`);
      console.error('         ', e.message);
    }
  }

  // ----------------------------------------------------
  // SUITE 1: Autonomous Task Execution Engine
  // ----------------------------------------------------
  console.log('--- SUITE 1: Autonomous Task Execution & Replanning ---');
  await asyncTest('Autonomous task executes and verifies outcomes', async () => {
    const res = await taskOrchestratorInstance.executeAutonomousTask({
      instruction: 'Inspect system telemetry and verify hardware memory',
      personality: 'JARVIS'
    });
    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.verified, true);
    assert.ok(res.stepsExecuted >= 1);
  });

  await asyncTest('Autonomous task dynamically detects error and replans', async () => {
    const res = await taskOrchestratorInstance.executeAutonomousTask({
      instruction: 'Read non_existent_dummy_file_99999.js, recover by reading package.json',
      personality: 'JARVIS'
    });
    assert.strictEqual(res.status, 'SUCCESS');
    assert.ok(res.replanCount > 0);
  });

  await asyncTest('Autonomous task cancels cleanly when abortSignal fires', async () => {
    const abortCtrl = new AbortController();
    abortCtrl.abort();
    const res = await taskOrchestratorInstance.executeAutonomousTask({
      instruction: 'Inspect system telemetry and run test suite',
      personality: 'JARVIS',
      abortSignal: abortCtrl.signal
    });
    assert.strictEqual(res.status, 'CANCELLED');
  });

  // ----------------------------------------------------
  // SUITE 2: Tool Registry Standardization
  // ----------------------------------------------------
  console.log('\n--- SUITE 2: Standardized Tool Registry ---');
  test('TOOLS object contains standard metadata on every registered tool', () => {
    const keys = Object.keys(TOOLS);
    assert.ok(keys.length >= 50, 'Must have at least 50 tools registered');
    for (const key of keys) {
      const tool = TOOLS[key];
      assert.ok(typeof tool.execute === 'function', `Tool "${key}" must have execute function`);
      assert.ok(typeof tool.description === 'string', `Tool "${key}" must have description string`);
      assert.ok(tool.inputs !== undefined, `Tool "${key}" must define inputs`);
      assert.ok(tool.outputs !== undefined, `Tool "${key}" must define outputs`);
      assert.ok(Array.isArray(tool.requiredPermissions), `Tool "${key}" must define requiredPermissions array`);
      assert.ok(typeof tool.timeoutMs === 'number', `Tool "${key}" must define timeoutMs`);
      assert.ok(typeof tool.cancellationBehavior === 'string', `Tool "${key}" must define cancellationBehavior`);
      assert.ok(typeof tool.healthStatus === 'string', `Tool "${key}" must define healthStatus`);
      assert.ok(typeof tool.verificationMethod === 'string', `Tool "${key}" must define verificationMethod`);
    }
  });

  test('New autonomous task tools are registered in TOOLS', () => {
    assert.ok(TOOLS.execute_autonomous_task !== undefined, 'execute_autonomous_task registered');
    assert.ok(TOOLS.get_task_status !== undefined, 'get_task_status registered');
    assert.ok(TOOLS.cancel_task !== undefined, 'cancel_task registered');
    assert.ok(TOOLS.list_task_history !== undefined, 'list_task_history registered');
  });

  // ----------------------------------------------------
  // SUITE 3: Desktop Application Launching & Verification
  // ----------------------------------------------------
  console.log('\n--- SUITE 3: Desktop Application Launching ---');
  await asyncTest('Notepad launches and returns verified PID', async () => {
    const res = await appLauncherInstance.launchApplication('notepad');
    assert.strictEqual(res.verified, true);
    assert.ok(res.pid !== null && res.pid > 0);
    // Cleanup
    execSync('powershell -Command "Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue"');
  });

  await asyncTest('Notepad already_running detection brings to foreground', async () => {
    const res1 = await appLauncherInstance.launchApplication('notepad');
    assert.strictEqual(res1.status, 'launched');
    const res2 = await appLauncherInstance.launchApplication('notepad');
    assert.strictEqual(res2.status, 'already_running');
    assert.strictEqual(res2.verified, true);
    execSync('powershell -Command "Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue"');
  });

  await asyncTest('Word launches and returns verified PID', async () => {
    const res = await appLauncherInstance.launchApplication('word');
    assert.strictEqual(res.verified, true);
    assert.ok(res.pid !== null && res.pid > 0);
    execSync('powershell -Command "Stop-Process -Name winword -Force -ErrorAction SilentlyContinue"');
  });

  // ----------------------------------------------------
  // SUITE 4: Document Automation & Disk Verification
  // ----------------------------------------------------
  console.log('\n--- SUITE 4: Document Automation & Verification ---');
  await asyncTest('writeNotepadDocument saves report, verifies disk SHA-256 and opens Notepad', async () => {
    const target = 'D:\\Jarvis\\Notes\\STARK_Report.txt';
    const content = 'STARK AI Automated Verification Report\nStatus: 100% Operational';
    const res = await documentAutomationServiceInstance.writeNotepadDocument({
      filePath: target,
      content,
      openInNotepad: true
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verified, true);
    assert.ok(fs.existsSync(target));
    assert.strictEqual(fs.readFileSync(target, 'utf8').trim(), content.trim());
    execSync('powershell -Command "Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue"');
  });

  await asyncTest('createWordDocument creates valid RTF document and verifies on disk', async () => {
    const target = 'D:\\Jarvis\\Notes\\STARK_AI_Test.doc';
    const content = 'Word Document Content Verification';
    const res = await documentAutomationServiceInstance.createWordDocument({
      title: 'STARK AI Test',
      filePath: target,
      content,
      openInWord: true
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verified, true);
    assert.ok(fs.existsSync(target));
    assert.ok(fs.statSync(target).size > 100);
    execSync('powershell -Command "Stop-Process -Name winword -Force -ErrorAction SilentlyContinue"');
  });

  // ----------------------------------------------------
  // SUITE 5: Voice/Text Query Intent Routing
  // ----------------------------------------------------
  console.log('\n--- SUITE 5: Query Intent Detection & Routing ---');
  test('Voice query "open Notepad, write a report..." routes to write_notepad_document', () => {
    const intent = aiAdapterInstance.detectToolIntent('JARVIS', 'JARVIS, open Notepad, write a report about my STARK AI project, save it as D:\\Jarvis\\Notes\\STARK_Report.txt, and verify it.');
    assert.ok(intent !== null);
    assert.strictEqual(intent.toolName, 'write_notepad_document');
    assert.strictEqual(intent.args.filePath, 'D:\\Jarvis\\Notes\\STARK_Report.txt');
  });

  test('Voice query "open Microsoft Word and create a document..." routes to create_word_document', () => {
    const intent = aiAdapterInstance.detectToolIntent('JARVIS', 'JARVIS, open Microsoft Word and create a document titled STARK AI Test.');
    assert.ok(intent !== null);
    assert.strictEqual(intent.toolName, 'create_word_document');
    assert.strictEqual(intent.args.title, 'STARK AI Test');
  });

  test('Voice query "open Word" routes to open_desktop_app', () => {
    const intent = aiAdapterInstance.detectToolIntent('JARVIS', 'JARVIS, open Word.');
    assert.ok(intent !== null);
    assert.strictEqual(intent.toolName, 'open_desktop_app');
    assert.strictEqual(intent.args.appName, 'Word');
  });

  // ----------------------------------------------------
  // SUITE 6: Local AI Compute & Experiment Ledger
  // ----------------------------------------------------
  console.log('\n--- SUITE 6: Local AI Compute & Empirical Ledger ---');
  await asyncTest('Local model runtimes checked cleanly without hang or crash', async () => {
    const runtimes = await resourceComputeManager.checkLocalModelRuntimes();
    assert.ok(runtimes.ollama !== undefined);
    assert.ok(runtimes.lmStudio !== undefined);
    assert.strictEqual(typeof runtimes.ollama.active, 'boolean');
    assert.strictEqual(typeof runtimes.lmStudio.active, 'boolean');
  });

  test('Experiment ledger queries recorded experiment with reproducible metrics', () => {
    const experiments = experimentLedgerInstance.getExperiments();
    assert.ok(experiments.length > 0);
    const autonomousExp = experiments.find(e => e.id.startsWith('exp_') && e.title.includes('Autonomous Task Dynamic Replanning'));
    assert.ok(autonomousExp !== undefined, 'Must find autonomous task experiment');
    assert.strictEqual(autonomousExp.decision, 'ACCEPTED');
  });

  console.log('\n========================================================');
  console.log(` RESULTS: ${passed}/${total} Assertions Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAllVerificationTests().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
