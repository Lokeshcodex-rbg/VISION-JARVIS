/**
 * Acceptance Test: Workstream H — Autonomous Multi-Language Software Development Lab
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { autonomousDevelopmentLab } = require('../server/devlab/autonomousDevelopmentLab.js');
const { executeTool } = require('../server/toolsRegistry.js');

async function runTests() {
  console.log('=== TEST SUITE: WORKSTREAM H (Autonomous Multi-Language Dev Lab) ===');

  // Test 1: Scaffold a Python Project
  const projName = 'stark_calc_test';
  const scaffoldRes = await autonomousDevelopmentLab.createProject(projName, {
    language: 'python',
    code: `import sys\n\ndef add(a, b):\n    return a + b\n\ndef run():\n    res = add(10, 32)\n    print(f"CALC_RESULT:{res}")\n    return 0\n\nif __name__ == '__main__':\n    sys.exit(run())\n`
  });
  assert(scaffoldRes.success, 'Scaffold must succeed');
  assert(fs.existsSync(path.join(scaffoldRes.projectPath, 'main.py')), 'main.py must exist on disk');
  console.log('  [PASS] Python project scaffold verified:', scaffoldRes.projectName);

  // Test 2: Sandboxed Execution via Tool Registry
  const runRes = await executeTool('run_project_code', {
    projectName: projName,
    language: 'python',
    entrypoint: 'main.py'
  }, 'JARVIS');
  assert(runRes.success, 'Run must succeed');
  assert(runRes.stdout.includes('CALC_RESULT:42'), 'Output must contain computed result 42');
  console.log('  [PASS] Sandboxed Python execution verified:', runRes.stdout);

  // Test 3: Scaffold and Run Node.js Project
  const nodeProjName = 'stark_node_test';
  await autonomousDevelopmentLab.createProject(nodeProjName, {
    language: 'javascript',
    code: `console.log("NODE_STARK_ACTIVE"); process.exit(0);`
  });
  const nodeRun = await executeTool('run_project_code', {
    projectName: nodeProjName,
    language: 'javascript',
    entrypoint: 'index.js'
  }, 'JARVIS');
  assert(nodeRun.success, 'Node execution must succeed');
  assert(nodeRun.stdout.includes('NODE_STARK_ACTIVE'), 'Node stdout must match');
  console.log('  [PASS] Sandboxed Node.js execution verified:', nodeRun.stdout);

  // Test 4: Auto-Repair Loop Test (Inject syntax error and repair)
  const brokenProjName = 'stark_repair_test';
  await autonomousDevelopmentLab.createProject(brokenProjName, {
    language: 'python',
    code: `def run()\n    return 0\n` // missing colon
  });
  const failedRun = await autonomousDevelopmentLab.runCode(brokenProjName, { language: 'python' });
  assert.strictEqual(failedRun.success, false, 'Broken code must fail execution');
  console.log('  [PASS] Broken code failure captured as expected');

  // Trigger auto-repair
  const repairRes = await autonomousDevelopmentLab.debugAndRepair(brokenProjName, {
    language: 'python',
    entrypoint: 'main.py',
    failureLog: failedRun.stderr
  });
  assert(repairRes.repaired && repairRes.success, 'Auto-repair must patch syntax and succeed verification');
  console.log('  [PASS] Automated self-repair loop verified:', repairRes.summary);

  console.log('=== WORKSTREAM H: ALL ACCEPTANCE TESTS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
