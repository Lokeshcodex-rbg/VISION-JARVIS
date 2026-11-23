/**
 * VISION v1.5 Unified Training Pipeline & Token Optimization Test Suite
 * tests/test_v15_training_pipeline_suite.js
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
console.log('VISION v1.5: UNIFIED TRAINING PIPELINE & DATA SUITE');
console.log('================================================================\n');

// --- Suite 1: Data Pipeline Generation & Manifest Integrity ---
console.log('Suite 1: Scalable Data Pipeline & Canary Verification');
const dataDir = path.join(REPO_ROOT, 'data', 'neural_models', 'datasets', 'unified_pipeline');
assert(fs.existsSync(dataDir), 'unified_pipeline dataset directory exists');

const trainFile = path.join(dataDir, 'train.jsonl');
const valFile = path.join(dataDir, 'val.jsonl');
const testFile = path.join(dataDir, 'test.jsonl');
const manifestFile = path.join(dataDir, 'dataset_manifest.json');

assert(fs.existsSync(trainFile), 'train.jsonl exists');
assert(fs.existsSync(valFile), 'val.jsonl exists');
assert(fs.existsSync(testFile), 'test.jsonl exists');
assert(fs.existsSync(manifestFile), 'dataset_manifest.json exists');

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));

assert(manifest.canary_verification.canaries_checked === 64, 'Canary check audited all 64 benchmark probes');
assert(manifest.canary_verification.contamination_count === 0, 'Canary contamination count is exactly 0 (100% clean)');
assert(manifest.canary_verification.status === '100% CLEAN', 'Canary status is confirmed 100% CLEAN');

assert(manifest.summary.total_raw_candidates === 1984, `Audited 1,984 raw candidates (got ${manifest.summary.total_raw_candidates})`);
assert(manifest.summary.total_accepted_samples === 788, `Accepted 788 clean samples after deduplication (got ${manifest.summary.total_accepted_samples})`);
assert(manifest.summary.total_rejected_samples === 1196, `Rejected 1,196 near-duplicate/corrupt samples (got ${manifest.summary.total_rejected_samples})`);
assert(manifest.summary.total_usable_tokens === 50329, `Verified exact usable token count of 50,329 BPE tokens (got ${manifest.summary.total_usable_tokens})`);

assert(manifest.splits.train.samples === 716, `Train split contains 716 samples (got ${manifest.splits.train.samples})`);
assert(manifest.splits.train.tokens === 45770, `Train split contains 45,770 tokens`);
assert(manifest.splits.val.samples === 36, `Val split contains 36 samples`);
assert(manifest.splits.val.tokens === 2291, `Val split contains 2,291 tokens`);
assert(manifest.splits.test.samples === 36, `Test split contains 36 samples`);
assert(manifest.splits.test.tokens === 2268, `Test split contains 2,268 tokens`);

// Verify 8 distinct domains
const domains = Object.keys(manifest.domain_statistics);
assert(domains.length === 8, `Dataset covers exactly 8 domains (got ${domains.length})`);
const expectedDomains = [
  'coding_python', 'coding_javascript', 'coding_java', 'memory_tools',
  'mathematics', 'reasoning', 'multilingual', 'science_robotics'
];
expectedDomains.forEach(dom => {
  assert(manifest.domain_statistics[dom] && manifest.domain_statistics[dom].count > 0, `Domain ${dom} is populated with ${manifest.domain_statistics[dom]?.count} samples`);
});

// Verify licenses / provenance
assert(manifest.provenance_records.coding_python.license === 'MIT', 'Python coding data provenance has valid MIT license');
assert(manifest.provenance_records.mathematics.license === 'Apache-2.0', 'Mathematics data provenance has valid Apache-2.0 license');

// --- Suite 2: Tokenizer Audit Engine & Verification ---
console.log('\nSuite 2: Tokenizer Audit & Representation Invariants');
const tokReportPath = path.join(REPO_ROOT, 'data', 'learning', 'tokenizer_audit_report.json');
assert(fs.existsSync(tokReportPath), 'tokenizer_audit_report.json exists');
const tokReport = JSON.parse(fs.readFileSync(tokReportPath, 'utf-8'));

assert(tokReport.vocab_size === 8192, `JarvisBPE vocabulary size is exactly 8,192 (got ${tokReport.vocab_size})`);

// Special tokens
assert(tokReport.special_tokens['<pad>'].id === 0, '<pad> token ID is 0');
assert(tokReport.special_tokens['<bos>'].id === 1, '<bos> token ID is 1');
assert(tokReport.special_tokens['<eos>'].id === 2, '<eos> token ID is 2');
assert(tokReport.special_tokens['<unk>'].id === 3, '<unk> token ID is 3');
assert(tokReport.special_tokens['<user>'].id === 5, '<user> token ID is 5');
assert(tokReport.special_tokens['<assistant>'].id === 6, '<assistant> token ID is 6');

// Domain efficiency
assert(tokReport.domain_efficiency.english_prose.round_trip_lossless === true, 'English prose round trip is 100% lossless');
assert(tokReport.domain_efficiency.english_prose.unk_count === 0, 'English prose has 0 unk tokens');
assert(tokReport.domain_efficiency.devanagari_hindi.round_trip_lossless === true, 'Devanagari Hindi round trip is 100% lossless');
assert(tokReport.domain_efficiency.devanagari_hindi.unk_count === 0, 'Devanagari Hindi has 0 unk tokens');
assert(tokReport.domain_efficiency.python_code.round_trip_lossless === true, 'Python code round trip is 100% lossless');
assert(tokReport.domain_efficiency.python_code.unk_count === 0, 'Python code has 0 unk tokens');
assert(tokReport.aggregate.all_roundtrips_lossless === true, 'All aggregate round-trip decodings are 100% lossless');

// Checkpoint compatibility
assert(tokReport.compatibility_matrix['vision-v1.3-experimental-local'].exact_vocab_match === true, 'v1.3 vocabulary is 100% match');
assert(tokReport.compatibility_matrix['vision-v1.4-calibrated-local'].exact_vocab_match === true, 'v1.4 vocabulary is 100% match');
assert(tokReport.compatibility_matrix['vision-v1.5-25m-local'].exact_vocab_match === true, 'v1.5 scratch vocabulary is 100% match');
assert(tokReport.compatibility_matrix['vision-v1.5-25m-recovered'].exact_vocab_match === true, 'v1.5 recovered vocabulary is 100% match');

// --- Suite 3: Resumable Training Engine & State Checkpoints ---
console.log('\nSuite 3: Resumable Multi-Stage Training Engine & Checkpoints');
const runDir = path.join(REPO_ROOT, 'data', 'neural_models', 'checkpoints', 'test-resumable-run');
assert(fs.existsSync(runDir), 'test-resumable-run checkpoint directory exists');

const runConfig = path.join(runDir, 'config.json');
const runMeta = path.join(runDir, 'model_meta.json');
const runWeights = path.join(runDir, 'weights.pt');
const runState = path.join(runDir, 'resumable_state.pt');

assert(fs.existsSync(runConfig), 'run config.json exists');
assert(fs.existsSync(runMeta), 'run model_meta.json exists');
assert(fs.existsSync(runWeights), 'run weights.pt exists');
assert(fs.existsSync(runState), 'run resumable_state.pt exists');

const meta = JSON.parse(fs.readFileSync(runMeta, 'utf-8'));
assert(meta.step === 9, `Resumed run finished at step 9 (got ${meta.step})`);
assert(meta.total_parameters === 26785394, `Checkpoint total params is 26,785,394`);
assert(meta.language_parameters === 25184544, `Checkpoint language params is 25,184,544`);
assert(meta.vision_parameters === 1353548, `Checkpoint vision params is 1,353,548`);
assert(meta.audio_parameters === 247302, `Checkpoint audio params is 247,302`);
assert(meta.tokens_processed === 2415, `Checkpoint processed 2,415 tokens`);
assert(meta.latest_val_loss < 5.5, `Validation loss successfully reduced to ${meta.latest_val_loss} (< 5.5)`);
assert(meta.latest_val_ppl < 200.0, `Validation perplexity reduced to ${meta.latest_val_ppl} (< 200.0)`);

// --- Suite 4: PyTorch Model Load & Forward Pass Verification ---
console.log('\nSuite 4: PyTorch Weights & Resumable State Verification');
const pyVerifyCmd = `"${PYTHON_PATH}" -c "
import torch
import json
from ml_foundation.model import VisionLanguageModel, ModelConfig

cfg = ModelConfig.from_dict(json.load(open(r'${runConfig}')))
model = VisionLanguageModel(cfg)
weights = torch.load(r'${runWeights}', map_location='cpu', weights_only=True)
model.load_state_dict(weights)
model.eval()

# Test forward pass with sample input
dummy_input = torch.tensor([[1, 5, 234, 12, 6]], dtype=torch.long)
with torch.no_grad():
    out = model(dummy_input)
    assert out.shape == (1, 5, 8192), f'Unexpected shape {out.shape}'

# Test resumable state structure
state = torch.load(r'${runState}', map_location='cpu')
assert 'step' in state and state['step'] == 9, 'Missing or incorrect step in state'
assert 'model_state_dict' in state, 'Missing model_state_dict in state'
assert 'optimizer_state_dict' in state, 'Missing optimizer_state_dict in state'
assert 'scheduler_state_dict' in state, 'Missing scheduler_state_dict in state'
assert 'rng_state' in state, 'Missing rng_state in state'
print('PyTorch forward pass and resumable state verified successfully.')
"`;

try {
  const pyOutput = execSync(pyVerifyCmd, { encoding: 'utf-8' });
  console.log(`  [PY EXEC] ${pyOutput.trim()}`);
  assert(true, 'PyTorch model weights loaded and forward pass completed without error');
  assert(true, 'Resumable state bundle contains step, model, optimizer, scheduler, and RNG states');
} catch (err) {
  assert(false, `PyTorch model verification failed: ${err.message}`);
}

// --- Suite 5: JARVIS Provider Adapter & Identity Invariants ---
console.log('\nSuite 5: JARVIS Provider Adapter & Identity Invariants');
const adapterPath = path.join(REPO_ROOT, 'server', 'aiProviderAdapter.js');
assert(fs.existsSync(adapterPath), 'aiProviderAdapter.js exists');
const adapterCode = fs.readFileSync(adapterPath, 'utf-8');

assert(adapterCode.includes('VISION — MADE BY LOKESH') || adapterCode.includes('VISION'), 'Provider adapter contains VISION attribution');
assert(adapterCode.includes('JARVIS'), 'Single unified assistant JARVIS preserved');

console.log('\n================================================================');
console.log(`TEST SUITE COMPLETE: ${passedTests} / ${totalTests} assertions passed (${(passedTests/totalTests*100).toFixed(1)}%)`);
console.log('================================================================');
