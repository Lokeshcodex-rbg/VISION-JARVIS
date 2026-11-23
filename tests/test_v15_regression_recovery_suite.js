/**
 * VISION v1.5 Regression Investigation & Intelligence Recovery Test Suite
 * tests/test_v15_regression_recovery_suite.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PYTHON_PATH = path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe');

let passedTests = 0;
let totalTests = 0;

function assert(cond, msg) {
  totalTests++;
  if (!cond) {
    console.error(`  [FAIL] ${msg}`);
    throw new Error(msg);
  }
  passedTests++;
  console.log(`  [PASS] ${msg}`);
}

console.log('================================================================');
console.log('VISION v1.5: REGRESSION INVESTIGATION & RECOVERY TEST SUITE');
console.log('================================================================\n');

// --- Test 1: Parameter Audit & 0 Discrepancy ---
console.log('Suite 1: Parameter Calculation & Exact Analytical Match');
const auditPath = path.join(REPO_ROOT, 'data', 'learning', 'parameter_audit_report.json');
assert(fs.existsSync(auditPath), 'parameter_audit_report.json exists');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));

assert(audit.v14.total_params === 13332498, `v1.4 exact total params is 13,332,498 (got ${audit.v14.total_params})`);
assert(audit.v14.discrepancy === 0, `v1.4 analytical discrepancy is exactly 0`);
assert(audit.v14.is_tied === true, `v1.4 weight tying is True (lm_head is tok_emb)`);

assert(audit.v15.total_params === 26785394, `v1.5 exact total params is 26,785,394 (got ${audit.v15.total_params})`);
assert(audit.v15.discrepancy === 0, `v1.5 analytical discrepancy is exactly 0`);
assert(audit.v15.is_tied === true, `v1.5 weight tying is True (lm_head is tok_emb)`);

// --- Test 2: Regression Reproduction Records ---
console.log('\nSuite 2: Side-by-Side Regression Reproduction Records');
const reproPath = path.join(REPO_ROOT, 'data', 'learning', 'regression_reproduction_report.json');
assert(fs.existsSync(reproPath), 'regression_reproduction_report.json exists');
const repro = JSON.parse(fs.readFileSync(reproPath, 'utf-8'));

assert(repro.head_to_head.length === 64, `Evaluated exactly 64 held-out probes (got ${repro.head_to_head.length})`);
assert(repro.summary.v14.passed === 21, `v1.4 baseline passed 21/64 probes (32.81%)`);
assert(repro.summary.v15.passed === 4, `v1.5 scratch regression passed 4/64 probes (6.25%)`);
assert(repro.summary.delta.regressed_probe_count === 20, `Identified exactly 20 regressed probes that passed in v1.4 but failed in v1.5`);

// --- Test 3: CPU Latency Profiling Verification ---
console.log('\nSuite 3: CPU Inference Latency Profiling & Thread Optimization');
const latPath = path.join(REPO_ROOT, 'data', 'learning', 'latency_profiling_report.json');
assert(fs.existsSync(latPath), 'latency_profiling_report.json exists');
const lat = JSON.parse(fs.readFileSync(latPath, 'utf-8'));

assert(lat.optimal_threads === 4, `Optimal thread count is verified as 4 threads (got ${lat.optimal_threads})`);
assert(lat.thread_scaling_v15.threads_4.tokens_per_sec > lat.thread_scaling_v15.threads_1.tokens_per_sec, '4 threads outperforms 1 thread in throughput');
assert(lat.v15_fp32.tokens_per_sec > lat.v15_int8.tokens_per_sec, 'FP32 outperforms dynamic INT8 on CPU without AVX-512 VNNI kernels');

// --- Test 4: Recovered Checkpoint & Evaluation Report ---
console.log('\nSuite 4: Recovered Model Checkpoint & Evaluation Metrics');
const recovDir = path.join(REPO_ROOT, 'data', 'neural_models', 'checkpoints', 'vision-v1.5-25m-recovered');
assert(fs.existsSync(path.join(recovDir, 'weights.pt')), 'Recovered checkpoint weights.pt exists');
assert(fs.existsSync(path.join(recovDir, 'config.json')), 'Recovered checkpoint config.json exists');
assert(fs.existsSync(path.join(recovDir, 'tokenizer.json')), 'Recovered checkpoint tokenizer.json exists');

const recovEvalPath = path.join(REPO_ROOT, 'data', 'learning', 'evaluation_report_v15_25m_recovered.json');
assert(fs.existsSync(recovEvalPath), 'Recovered evaluation report exists');
const recovEval = JSON.parse(fs.readFileSync(recovEvalPath, 'utf-8'));

assert(recovEval.passed_probes === 8, `Recovered 25M model passed 8/64 probes (12.50%)`);
assert(recovEval.passed_probes > repro.summary.v15.passed, `Recovered model (8/64) doubled the score of scratch v1.5 (4/64)`);
assert(recovEval.p50_latency_ms < 1000.0, `Recovered P50 latency is < 1,000 ms (got ${recovEval.p50_latency_ms} ms)`);

// --- Test 5: Neural Registry Invariants ---
console.log('\nSuite 5: Neural Registry Status & Scaling Gate Enforcement');
const regPath = path.join(REPO_ROOT, 'data', 'neural_models', 'neural_registry.json');
assert(fs.existsSync(regPath), 'neural_registry.json exists');
const reg = JSON.parse(fs.readFileSync(regPath, 'utf-8'));

assert(reg.activeExperimentalCheckpoint.includes('v1.4'), 'v1.4 remains active experimental baseline');
assert(reg.checkpoints['vision-v1.5-25m-recovered'].status === 'RECOVERED_BELOW_BASELINE_UNPROMOTED', 'v1.5 recovered is correctly flagged as unpromoted (sub-baseline)');
assert(reg.checkpoints['vision-v1.5-25m-local'].status === 'REGRESSION_SCRATCH', 'v1.5 scratch is flagged as regression');

console.log('\n================================================================');
console.log(`TEST SUITE COMPLETE: ${passedTests} / ${totalTests} assertions passed (${(passedTests/totalTests*100).toFixed(1)}%)`);
console.log('================================================================');
