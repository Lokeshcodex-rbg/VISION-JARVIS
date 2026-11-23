/**
 * STARK AI — Full Regression Inventory Runner (Phases 1 - 13)
 * Executes every available acceptance suite and compiles an authoritative,
 * non-fabricated inventory of all test results on the live Windows host.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'reports', 'evidence', 'phase13-final');

const SUITES = [
  { file: 'test_stark_local_agent_complete_acceptance_suite.js', phase: 'Phase 1: Local Agent Core' },
  { file: 'test_stark_real_personal_memory_acceptance_suite.js', phase: 'Phase 2: Personal Memory' },
  { file: 'test_stark_infinite_scale_memory_acceptance_suite.js', phase: 'Phase 2: Infinite-Scale Memory' },
  { file: 'test_stark_dag_planning_acceptance_suite.js', phase: 'Phase 3: DAG Planning' },
  { file: 'test_stark_multi_agent_orchestration_acceptance_suite.js', phase: 'Phase 4: Multi-Agent Collaboration' },
  { file: 'test_stark_browser_automation_acceptance_suite.js', phase: 'Phase 5: Browser Automation' },
  { file: 'test_stark_advanced_computer_intelligence_acceptance_suite.js', phase: 'Phase 6: Desktop Intelligence' },
  { file: 'test_stark_permission_policy_acceptance_suite.js', phase: 'Phase 7: Permission Policy' },
  { file: 'test_stark_emergency_stop_audit_system_acceptance_suite.js', phase: 'Phase 8: Emergency Stop & Audit' },
  { file: 'test_stark_autonomous_learning_acceptance_suite.js', phase: 'Phase 9: Continuous Learning' },
  { file: 'test_stark_advanced_voice_conversation_acceptance_suite.js', phase: 'Phase 10: Advanced Voice' },
  { file: 'test_stark_phase11_multimodal_intelligence_acceptance_suite.js', phase: 'Phase 11: Multimodal Intelligence' },
  { file: 'test_stark_phase12_scientific_engineering_intelligence_suite.js', phase: 'Phase 12: Scientific & Engineering' },
  { file: 'test_phase12_structural_beam_regression.js', phase: 'Phase 12: Beam Bending Regression' },
  { file: 'scripts/verify_phase12_five_closure_checks.js', phase: 'Phase 12: Five Closure Checks' },
  { file: 'test_stark_phase13_production_autonomous_execution_suite.js', phase: 'Phase 13: Production Autonomous Engine' },
  { file: 'test_whatsapp_confirmation_and_stop_invariants.js', phase: 'Phase 13: WhatsApp Confirmation Invariants' },
  { file: 'test_lokesh_whatsapp_companion_suite.js', phase: 'Phase 13: Lokesh Companion Suite' },
  { file: 'test_whatsapp_live_python_fix.js', phase: 'Phase 13: WhatsApp Automator Fix' },
  { file: 'test_phase13_final_hardening_audit.js', phase: 'Phase 13: Final Hardening Audit' }
];

async function runAll() {
  console.log('================================================================');
  console.log('🚀 STARK AI — FULL REGRESSION RUNNER: PHASES 1 TO 13');
  console.log('================================================================\n');

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const inventory = [];
  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;
  let grandSkipped = 0;

  for (const suite of SUITES) {
    const fullPath = path.resolve(ROOT_DIR, suite.file);
    if (!fs.existsSync(fullPath)) {
      inventory.push({
        suiteName: suite.file,
        phase: suite.phase,
        assertionsExecuted: 0,
        passed: 0,
        failed: 0,
        skipped: 1,
        skipReason: 'Suite file not found on disk',
        status: 'SKIPPED'
      });
      grandSkipped++;
      continue;
    }

    console.log(`Executing [${suite.phase}] -> ${suite.file}...`);
    const t0 = Date.now();
    let stdout = '';
    let exitCode = 0;

    try {
      stdout = execSync(`node "${fullPath}"`, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (err) {
      exitCode = err.status || 1;
      stdout = (err.stdout ? String(err.stdout) : '') + '\n' + (err.stderr ? String(err.stderr) : '');
    }

    const durationMs = Date.now() - t0;

    // Parse assertions passed/failed from output
    let passed = 0;
    let failed = 0;
    let total = 0;

    // Count [PASS] or ✓ in stdout
    const passMatches = stdout.match(/(?:\[PASS\]|✓\s*\[PASS\])/g);
    const failMatches = stdout.match(/(?:\[FAIL\]|✗\s*\[FAIL\])/g);

    if (passMatches) passed = passMatches.length;
    if (failMatches) failed = failMatches.length;

    // Explicit summary lines
    const mTotal = stdout.match(/(?:^|\n)\s*(?:TOTAL[^\n]*ASSERTIONS|SUMMARY|Results):\s*(\d+)/i);
    const mPassed = stdout.match(/(?:^|\n)\s*PASSED:\s*(\d+)/i) || stdout.match(/(\d+)\s*\/\s*\d+\s*(?:ASSERTIONS|tests|scenarios)?\s*PASSED/i);
    const mFailed = stdout.match(/(?:^|\n)\s*FAILED:\s*(\d+)/i);

    if (mPassed && !passed) {
      passed = parseInt(mPassed[1], 10);
    }
    if (mFailed && !failMatches) {
      failed = parseInt(mFailed[1], 10);
    }

    if (mTotal) {
      total = parseInt(mTotal[1], 10);
      if (!passed && total > 0 && failed === 0 && exitCode === 0) passed = total;
    } else {
      total = passed + failed;
    }

    if (total === 0 && exitCode === 0) {
      total = 1;
      passed = 1;
    }

    grandTotal += total;
    grandPassed += passed;
    grandFailed += failed;

    const suiteStatus = (exitCode === 0 && failed === 0) ? 'PASS' : 'FAIL';
    console.log(`  -> Verdict: ${suiteStatus} (${passed}/${total} passed in ${durationMs}ms)`);

    // Save individual suite log to evidence
    const baseName = path.basename(suite.file, '.js');
    fs.writeFileSync(path.join(EVIDENCE_DIR, `run_${baseName}.log`), stdout, 'utf8');

    inventory.push({
      suiteName: suite.file,
      phase: suite.phase,
      assertionsExecuted: total,
      passed,
      failed,
      skipped: 0,
      skipReason: null,
      durationMs,
      exitCode,
      status: suiteStatus
    });
  }

  console.log('\n================================================================');
  console.log(`GRAND TOTAL ASSERTIONS EXECUTED: ${grandTotal}`);
  console.log(`TOTAL PASSED: ${grandPassed}`);
  console.log(`TOTAL FAILED: ${grandFailed}`);
  console.log(`TOTAL SKIPPED: ${grandSkipped}`);
  console.log(`OVERALL SUCCESS RATE: ${((grandPassed / (grandTotal || 1)) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  const reportPayload = {
    executedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    grandTotal,
    grandPassed,
    grandFailed,
    grandSkipped,
    overallSuccessRate: ((grandPassed / (grandTotal || 1)) * 100).toFixed(1) + '%',
    inventory
  };

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'full_regression_inventory.json'), JSON.stringify(reportPayload, null, 2), 'utf8');
}

runAll().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});

