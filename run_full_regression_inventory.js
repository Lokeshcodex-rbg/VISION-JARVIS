/**
 * Full Regression Inventory Runner for Phases 1–14
 * Systematically runs each candidate suite, captures exit code, execution time,
 * parsed passed/failed assertions, status, and full log outputs.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SUITES = [
  // Phase 1 - 3: Voice, Browser, Desktop
  { file: 'test_stark_advanced_voice_conversation_acceptance_suite.js', phase: 'Phase 1', subsystem: 'Advanced Voice & Audio Streaming' },
  { file: 'test_stark_browser_automation_acceptance_suite.js', phase: 'Phase 2', subsystem: 'SAC Browser Automation' },
  { file: 'test_stark_local_agent_complete_acceptance_suite.js', phase: 'Phase 3', subsystem: 'Windows Local Desktop Agent' },
  { file: 'test_windows_local_agent_acceptance_suite.js', phase: 'Phase 3', subsystem: 'Windows System Integration' },
  
  // Phase 4 - 5: Permission & Emergency Stop
  { file: 'test_stark_permission_policy_acceptance_suite.js', phase: 'Phase 4', subsystem: 'Permission Policy & Gate' },
  { file: 'test_stark_emergency_stop_audit_system_acceptance_suite.js', phase: 'Phase 5', subsystem: 'Emergency Stop & Cryptographic Audit' },
  
  // Phase 6 - 7: DAG Planning & Multi-Agent
  { file: 'test_stark_dag_planning_acceptance_suite.js', phase: 'Phase 6', subsystem: 'Dependency DAG & Execution Engine' },
  { file: 'test_stark_multi_agent_orchestration_acceptance_suite.js', phase: 'Phase 7', subsystem: 'Multi-Agent Specialist Coordination' },
  
  // Phase 8 - 10: Memory, Knowledge & Self-Coding
  { file: 'test_stark_infinite_scale_memory_acceptance_suite.js', phase: 'Phase 8', subsystem: '8-Layer Scalable SQLite Memory' },
  { file: 'test_stark_advanced_research_knowledge_acceptance_suite.js', phase: 'Phase 9', subsystem: 'Deep Research & Synthesis' },
  { file: 'test_stark_advanced_computer_intelligence_acceptance_suite.js', phase: 'Phase 10', subsystem: 'Computer Intelligence & Self-Coding' },
  { file: 'test_stark_autonomous_learning_acceptance_suite.js', phase: 'Phase 10', subsystem: 'Autonomous Skill Acquisition' },
  
  // Phase 11 - 12: Multimodal & Science
  { file: 'test_stark_phase11_multimodal_intelligence_acceptance_suite.js', phase: 'Phase 11', subsystem: 'Multimodal Vision & Audio Inspection' },
  { file: 'test_stark_phase12_scientific_engineering_intelligence_suite.js', phase: 'Phase 12', subsystem: 'Engineering & Scientific Intelligence' },
  { file: 'test_phase12_structural_beam_regression.js', phase: 'Phase 12', subsystem: 'Structural Beam Mathematical Verification' },
  
  // Phase 13: Autonomous Execution, Safety & Hardening
  { file: 'test_stark_phase13_production_autonomous_execution_suite.js', phase: 'Phase 13', subsystem: 'Production Autonomous Execution Engine' },
  { file: 'test_phase13_final_hardening_audit.js', phase: 'Phase 13', subsystem: 'Crash Recovery, Idempotency & WhatsApp Hardening' },
  { file: 'test_whatsapp_confirmation_and_stop_invariants.js', phase: 'Phase 13', subsystem: 'WhatsApp Confirmation & Stop Invariants' },
  
  // Phase 14: Personal Intelligence
  { file: 'test_stark_phase14_personal_intelligence_acceptance_suite.js', phase: 'Phase 14', subsystem: 'Personal Context, KG & Proactive Assistance' }
];

async function runInventory() {
  console.log('='.repeat(80));
  console.log('🧪 STARK AI: PHASES 1–14 FULL REGRESSION INVENTORY EXECUTION');
  console.log('='.repeat(80));

  const results = [];
  let totalSuitesPassed = 0;
  let totalSuitesFailed = 0;
  let totalSuitesSkipped = 0;
  let grandTotalPassedAssertions = 0;
  let grandTotalFailedAssertions = 0;

  const logsDir = path.join(__dirname, 'reports', 'evidence', 'phase14', 'regression_logs');
  fs.mkdirSync(logsDir, { recursive: true });

  for (const s of SUITES) {
    const fullPath = path.join(__dirname, s.file);
    if (!fs.existsSync(fullPath)) {
      console.log(`\n[-] ${s.file} (${s.phase}): SKIPPED (File not found on disk)`);
      totalSuitesSkipped++;
      results.push({
        file: s.file,
        phase: s.phase,
        subsystem: s.subsystem,
        status: 'SKIPPED',
        exitCode: null,
        durationMs: 0,
        passed: 0,
        failed: 0,
        reason: 'File not found on disk',
        logFile: null
      });
      continue;
    }

    // Reset Emergency Stop state between suites to guarantee clean baseline
    const estopState = path.join(__dirname, 'data', 'emergency_stop_state.json');
    if (fs.existsSync(estopState)) {
      try {
        fs.writeFileSync(estopState, JSON.stringify({ isLatched: false, latchTimestamp: null, latchReason: null, stopCount: 0 }), 'utf8');
      } catch (_) {}
    }

    // Clean scratch docx/txt artifacts between suites to prevent EBUSY locks
    const scratchDir = path.join(__dirname, 'scratch');
    if (fs.existsSync(scratchDir)) {
      const lockFiles = fs.readdirSync(scratchDir).filter(f => f.endsWith('.docx') || f.endsWith('.txt') || f.endsWith('.csv') || f.endsWith('.tmp'));
      for (const lf of lockFiles) {
        try { fs.unlinkSync(path.join(scratchDir, lf)); } catch (_) {}
      }
    }

    // Inter-suite delay for Windows process handle wind-down
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800);

    console.log(`\n[>] Executing ${s.file} (${s.phase} — ${s.subsystem})...`);
    const t0 = Date.now();
    const child = spawnSync(process.execPath, [s.file], {
      cwd: __dirname,
      encoding: 'utf8',
      timeout: 180000,
      env: { ...process.env, NODE_ENV: 'test' }
    });
    const durationMs = Date.now() - t0;
    const stdout = child.stdout || '';
    const stderr = child.stderr || '';
    const output = stdout + '\n' + stderr;

    const logFileName = s.file.replace(/\.js$/, '.log');
    const logFilePath = path.join(logsDir, logFileName);
    fs.writeFileSync(logFilePath, output, 'utf8');

    // Parse assertion counts
    let passed = 0;
    let failed = 0;

    // Check specific patterns
    const matchSlash = output.match(/(?:RESULT|COMPLETE|TOTAL[^\n]*?):\s*(\d+)\s*\/\s*(\d+)\s*(?:ASSERTIONS|SCENARIOS|assertions|tests)?\s*PASSED/i) ||
                       output.match(/(\d+)\s*\/\s*(\d+)\s*tests?\s*passed/i) ||
                       output.match(/Summary:\s*(\d+)\s*\/\s*(\d+)\s*passed/i);
    const matchSimple = output.match(/PASSED:\s*(\d+)\s*\n\s*FAILED:\s*(\d+)/i);
    const passCheckmarks = (output.match(/(?:✓\s*\[PASS\]|✅\s*PASSED|\[PASS\])/g) || []).length;
    const failCheckmarks = (output.match(/(?:✗\s*\[FAIL\]|❌\s*FAILED|\[FAIL\])/g) || []).length;

    if (matchSlash) {
      passed = parseInt(matchSlash[1], 10);
      const total = parseInt(matchSlash[2], 10);
      failed = Math.max(0, total - passed);
    } else if (matchSimple) {
      passed = parseInt(matchSimple[1], 10);
      failed = parseInt(matchSimple[2], 10);
    } else {
      passed = passCheckmarks;
      failed = failCheckmarks;
    }

    const isPass = (child.status === 0 && failed === 0);
    if (isPass) {
      totalSuitesPassed++;
      grandTotalPassedAssertions += passed;
      console.log(`    ✅ PASS — Exit Code 0 | ${passed} passed, 0 failed (${durationMs}ms)`);
    } else {
      totalSuitesFailed++;
      grandTotalPassedAssertions += passed;
      grandTotalFailedAssertions += failed;
      console.log(`    ❌ FAIL — Exit Code ${child.status} | ${passed} passed, ${failed} failed (${durationMs}ms)`);
    }

    results.push({
      file: s.file,
      phase: s.phase,
      subsystem: s.subsystem,
      status: isPass ? 'PASS' : 'FAIL',
      exitCode: child.status,
      durationMs,
      passed,
      failed,
      logFile: path.relative(__dirname, logFilePath)
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY OF PHASES 1–14 FULL REGRESSION INVENTORY:');
  console.log(`Total Suites: ${SUITES.length} | Passed: ${totalSuitesPassed} | Failed: ${totalSuitesFailed} | Skipped: ${totalSuitesSkipped}`);
  console.log(`Grand Total Assertions Passed: ${grandTotalPassedAssertions}`);
  console.log(`Grand Total Assertions Failed: ${grandTotalFailedAssertions}`);
  console.log('='.repeat(80));

  const jsonSummary = {
    timestamp: new Date().toISOString(),
    totalSuites: SUITES.length,
    suitesPassed: totalSuitesPassed,
    suitesFailed: totalSuitesFailed,
    suitesSkipped: totalSuitesSkipped,
    grandTotalPassedAssertions,
    grandTotalFailedAssertions,
    results
  };

  const jsonSummaryPath = path.join(__dirname, 'reports', 'evidence', 'phase14', 'full_regression_inventory.json');
  fs.writeFileSync(jsonSummaryPath, JSON.stringify(jsonSummary, null, 2), 'utf8');
  console.log(`\nDetailed inventory saved to: ${jsonSummaryPath}`);

  return jsonSummary;
}

runInventory().catch(err => {
  console.error('Inventory execution error:', err);
  process.exit(1);
});

