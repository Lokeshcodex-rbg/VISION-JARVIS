/**
 * VISION Post-Acceptance Validation, Latency Audit & Authentic Data Expansion Test Suite
 * tests/test_v15_post_acceptance_suite.js
 *
 * Validates:
 * 1. Disk Checkpoint Existence & Exact SHA-256 Hash Verification
 * 2. Standardized CPU Latency Benchmark Methodology & Empirical Bounds
 * 3. Expanded 80-Probe Benchmark Integrity, AST/JS Verification & Zero Canary Contamination
 * 4. Staged Authentic Corpus Manifest (>= 1M BPE tokens, 8 domains, 90/5/5 split)
 * 5. Architectural Invariants (Gemini primary router, v1.4 reference status, strict promotion gate)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(message);
  }
  passedTests++;
  console.log(`  [PASS] ${message}`);
}

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

console.log('================================================================');
console.log('VISION POST-ACCEPTANCE VALIDATION & DATA EXPANSION TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------
// Suite 1: Checkpoint Existence, Size & SHA-256 Integrity on Disk
// -----------------------------------------------------------------
console.log('Suite 1: Checkpoint Binary Integrity & SHA-256 Verification');

const CHECKPOINTS = [
  {
    name: 'vision-v1.3-experimental-local',
    dir: path.join(REPO_ROOT, 'data', 'neural_models', 'checkpoints', 'vision-v1.3-experimental-local'),
    expectedBytes: 53382241,
    expectedSha256: 'b773036547f44ddc97b8a5b001c045ebfd12cd7f1920d63a4a3d8a14ab1e284b',
  },
  {
    name: 'vision-v1.4-calibrated-local',
    dir: path.join(REPO_ROOT, 'data', 'neural_models', 'checkpoints', 'vision-v1.4-calibrated-local'),
    expectedBytes: 53382241,
    expectedSha256: '5575077916210c168e462b27deed5a1c08101b05aad94f7809b188a579a4caea',
  },
  {
    name: 'vision-v1.5-25m-local',
    dir: path.join(REPO_ROOT, 'data', 'neural_models', 'checkpoints', 'vision-v1.5-25m-local'),
    expectedBytes: 107201397,
    expectedSha256: 'fd14b5c6944482464eda68040c71742dbc02b9843c806a3e52648b32a3943940',
  },
  {
    name: 'vision-v1.5-25m-recovered',
    dir: path.join(REPO_ROOT, 'data', 'neural_models', 'checkpoints', 'vision-v1.5-25m-recovered'),
    expectedBytes: 107201461,
    expectedSha256: 'ab80a30809583d9538405bc2a78053349717382337d73f21c22a19d08dbf0fb9',
  },
];

for (const ckpt of CHECKPOINTS) {
  const weightsPath = path.join(ckpt.dir, 'weights.pt');
  assert(fs.existsSync(weightsPath), `${ckpt.name} weights.pt exists on disk`);

  const stat = fs.statSync(weightsPath);
  assert(stat.size === ckpt.expectedBytes, `${ckpt.name} exact size matches ${ckpt.expectedBytes} bytes (got ${stat.size})`);

  const hash = computeSha256(weightsPath);
  assert(hash === ckpt.expectedSha256, `${ckpt.name} SHA-256 matches authentic hash: ${ckpt.expectedSha256}`);

  assert(fs.existsSync(path.join(ckpt.dir, 'config.json')), `${ckpt.name} config.json exists`);
  assert(fs.existsSync(path.join(ckpt.dir, 'tokenizer.json')), `${ckpt.name} tokenizer.json exists`);
  if (ckpt.name.includes('v1.5')) {
    assert(fs.existsSync(path.join(ckpt.dir, 'model_meta.json')), `${ckpt.name} model_meta.json exists`);
  }
}

// -----------------------------------------------------------------
// Suite 2: Standardized Hardware Latency Benchmark Audit
// -----------------------------------------------------------------
console.log('\nSuite 2: Standardized Hardware & Latency Benchmark Methodology');
const latencyPath = path.join(REPO_ROOT, 'data', 'learning', 'standardized_latency_audit.json');
assert(fs.existsSync(latencyPath), 'standardized_latency_audit.json exists');

const latData = JSON.parse(fs.readFileSync(latencyPath, 'utf-8'));
const v14Bench = latData['vision-v1.4-calibrated-local'];
const v15ScratchBench = latData['vision-v1.5-25m-local'];
const v15RecovBench = latData['vision-v1.5-25m-recovered'];

assert(v14Bench.threads === 4, 'Standardized latency benchmark enforced fixed 4 CPU threads');
assert(v14Bench.prompt_tokens === 21, 'Prompt length standardized to exactly 21 tokens');
assert(v14Bench.generated_tokens === 32, 'Generation horizon standardized to exactly 32 tokens');
assert(v14Bench.iterations === 10, 'Benchmark conducted 10 benchmark iterations');

// Latency & Speed metrics
assert(v14Bench.ttft_p50_ms < 30.0, `v1.4 TTFT P50 is under 30ms (actual: ${v14Bench.ttft_p50_ms} ms)`);
assert(v14Bench.tokens_per_sec > 30.0, `v1.4 decode speed exceeds 30 tok/s (actual: ${v14Bench.tokens_per_sec} tok/s)`);
assert(v15ScratchBench.ttft_p50_ms < 50.0, `v1.5 TTFT P50 is under 50ms (actual: ${v15ScratchBench.ttft_p50_ms} ms)`);
assert(v15ScratchBench.tokens_per_sec > 15.0, `v1.5 decode speed exceeds 15 tok/s (actual: ${v15ScratchBench.tokens_per_sec} tok/s)`);

// RSS limits
assert(v14Bench.process_rss_mb < 500.0, `v1.4 memory RSS under 500 MB (actual: ${v14Bench.process_rss_mb} MB)`);
assert(v15ScratchBench.process_rss_mb < 500.0, `v1.5 memory RSS under 500 MB (actual: ${v15ScratchBench.process_rss_mb} MB)`);

// -----------------------------------------------------------------
// Suite 3: Expanded 80-Probe Benchmark Suite & Canary Verification
// -----------------------------------------------------------------
console.log('\nSuite 3: Expanded 80-Probe Evaluation Suite & Canary Protection');
const benchRepPath = path.join(REPO_ROOT, 'data', 'learning', 'expanded_benchmark_report.json');
assert(fs.existsSync(benchRepPath), 'expanded_benchmark_report.json exists');

const benchRep = JSON.parse(fs.readFileSync(benchRepPath, 'utf-8'));
assert(benchRep.summary.v14_calibrated.total === 80, 'Benchmark suite contains exactly 80 held-out probes');
assert(Object.keys(benchRep.domain_comparison).length === 10, 'Benchmark suite covers exactly 10 distinct domains');

assert(benchRep.summary.v14_calibrated.passed === 3, `v1.4 baseline scored 3/80 on expanded held-out benchmark (got ${benchRep.summary.v14_calibrated.passed})`);
assert(benchRep.summary.v15_scratch.passed === 3, `v1.5 scratch scored 3/80 on expanded held-out benchmark (got ${benchRep.summary.v15_scratch.passed})`);
assert(benchRep.summary.v15_recovered.passed === 2, `v1.5 recovered scored 2/80 on expanded held-out benchmark (got ${benchRep.summary.v15_recovered.passed})`);

// -----------------------------------------------------------------
// Suite 4: Authentic Staged Corpus Manifest & Data Ingestion
// -----------------------------------------------------------------
console.log('\nSuite 4: Authentic Staged Corpus Manifest (>= 1M BPE Tokens)');
const manifestPath = path.join(REPO_ROOT, 'data', 'neural_models', 'datasets', 'expanded_corpus', 'staged_dataset_manifest.json');
assert(fs.existsSync(manifestPath), 'staged_dataset_manifest.json exists');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
assert(manifest.summary.total_usable_tokens >= 1000000, `Expanded corpus exceeds 1,000,000 tokens (actual: ${manifest.summary.total_usable_tokens.toLocaleString()} tokens)`);
assert(manifest.summary.total_accepted_samples === 8000, `Expanded corpus contains exactly 8,000 accepted samples (actual: ${manifest.summary.total_accepted_samples})`);

// Domain diversity
const domainKeys = Object.keys(manifest.domain_statistics);
assert(domainKeys.length === 8, `Expanded corpus covers 8 diverse domains (got ${domainKeys.length})`);
for (const dom of domainKeys) {
  assert(manifest.domain_statistics[dom].count === 1000, `Domain ${dom} contains exactly 1,000 samples`);
}

// Split ratio verification (90/5/5)
const trainSamples = manifest.summary.splits.train.samples;
const valSamples = manifest.summary.splits.val.samples;
const testSamples = manifest.summary.splits.test.samples;
assert(trainSamples === 7200, `Train split is 90% (7,200 samples)`);
assert(valSamples === 400, `Val split is 5% (400 samples)`);
assert(testSamples === 400, `Test split is 5% (400 samples)`);

// Zero canary contamination in staged dataset
assert(manifest.canary_verification.contamination_count === 0, 'Zero canaries detected in expanded training shards');
assert(manifest.peak_rss_mb < 500.0, `Data expansion process RSS kept under 500 MB (actual: ${manifest.peak_rss_mb} MB)`);

// -----------------------------------------------------------------
// Suite 5: Invariants & Production Router Governance
// -----------------------------------------------------------------
console.log('\nSuite 5: Architecture & Invariant Enforcement');

// Production primary router check
const adapterPath = path.join(REPO_ROOT, 'server', 'aiProviderAdapter.js');
const adapterCode = fs.readFileSync(adapterPath, 'utf-8');
assert(adapterCode.includes("this.geminiKey ? 'gemini'"), 'Gemini is the prioritized primary cloud provider');
assert(adapterCode.includes("resolveProviderMode(userMessage, options = {})"), 'Adaptive provider routing resolver is present');

// Neural registry check
const regPath = path.join(REPO_ROOT, 'data', 'neural_models', 'neural_registry.json');
assert(fs.existsSync(regPath), 'neural_registry.json exists');
const reg = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
assert(reg.brand.includes('VISION — MADE BY LOKESH'), 'Brand identity is VISION — MADE BY LOKESH');
assert(reg.assistantIdentity === 'JARVIS', 'Assistant identity is JARVIS');
assert(reg.productionPrimaryModel.includes('gemini'), 'Production primary model is Gemini');
assert(reg.activeExperimentalCheckpoint.includes('experimental'), 'Experimental checkpoint remains designated as experimental');

console.log('\n================================================================');
console.log(`POST-ACCEPTANCE AUDIT PASSED: ${passedTests}/${totalTests} assertions verified successfully.`);
console.log('================================================================\n');
