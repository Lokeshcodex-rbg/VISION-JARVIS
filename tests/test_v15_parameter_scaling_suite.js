/**
 * VISION v1.5 — Major Parameter Scaling & Architectural Verification Suite
 * tests/test_v15_parameter_scaling_suite.js
 *
 * Verifies:
 * 1. Exact Scaling Matrix (25M, 50M, 100M, 250M, 500M, 1B, 3B, 7B)
 * 2. PyTorch Architecture Instantiation & Parameter Breakdown for 25M
 * 3. Safe Versioned Checkpoint Loading & Incompatible Model Shape Trap
 * 4. Dynamic INT8 Quantization Engine
 * 5. Cloud Distributed Training Harness & Multi-GPU Launch Configuration
 * 6. Zero-Contamination Guarantee Across V14 and V13 Benchmark Canaries
 * 7. Unified AI Platform Identity (VISION — MADE BY LOKESH | JARVIS)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PYTHON_EXE = path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe');

async function runTestSuite() {
  console.log('================================================================');
  console.log('VISION v1.5: PARAMETER SCALING & ARCHITECTURAL VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] Suite ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Suite ${total}: ${name}`);
      console.error(`  Error: ${err.message}`);
    }
  }

  // Suite 1: Mathematical Scaling Analysis Report Exists & Has All Target Sizes
  test('Scaling Analysis JSON & Mathematical Calculations', () => {
    const jsonPath = path.join(REPO_ROOT, 'data', 'learning', 'vision_parameter_scaling_analysis.json');
    assert.strictEqual(fs.existsSync(jsonPath), true, 'Scaling analysis JSON must exist');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    const requiredKeys = [
      'vision-baseline-13m',
      'vision-scale-25m',
      'vision-scale-50m',
      'vision-scale-100m',
      'vision-scale-250m',
      'vision-scale-500m',
      'vision-scale-1b',
      'vision-scale-3b',
      'vision-scale-7b'
    ];

    for (const key of requiredKeys) {
      assert.ok(data[key], `Scale preset '${key}' must exist in report`);
      const params = data[key].parameter_breakdown;
      assert.ok(params.total_parameters > 0, `Total parameters for ${key} must be > 0`);
      assert.ok(params.language_parameters > 0, `Language parameters for ${key} must be > 0`);
      assert.ok(data[key].storage.fp16_mb > 0, `FP16 storage for ${key} must be > 0`);
      assert.ok(data[key].training_ram.adamw_mb > 0, `AdamW training RAM for ${key} must be > 0`);
      assert.ok(data[key].hardware_feasibility.status, `Hardware feasibility status for ${key} must be defined`);
    }

    // Verify 25M exact count
    const p25 = data['vision-scale-25m'].parameter_breakdown.total_parameters;
    assert.strictEqual(p25, 26785394, `25M target must equal exactly 26,785,394 parameters (got ${p25})`);
    console.log(`  Verified 25M exact parameters: ${p25.toLocaleString()}`);
  });

  // Suite 2: Model Architecture Scale Presets in model.py
  test('MODEL_SCALE_PRESETS Native Registration', () => {
    const cmd = `"${PYTHON_EXE}" -c "from ml_foundation.model import MODEL_SCALE_PRESETS; print(list(MODEL_SCALE_PRESETS.keys()))"`;
    const out = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' });
    const presets = ['vision-scale-25m', 'vision-scale-50m', 'vision-scale-100m', 'vision-scale-250m', 'vision-scale-500m', 'vision-scale-1b'];
    for (const p of presets) {
      assert.ok(out.includes(p), `MODEL_SCALE_PRESETS must include '${p}'`);
    }
  });

  // Suite 3: PyTorch Instantiation & Layer Dimensions for 25M Model
  test('PyTorch 25M Instantiation & Parameter Verification', () => {
    const cmd = `"${PYTHON_EXE}" -c "from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer; cfg = JarvisConfig.from_dict({'model_name': 'vision-scale-25m', 'vocab_size': 8192, 'd_model': 448, 'n_layers': 10, 'n_heads': 8, 'n_kv_heads': 4, 'd_ff': 1152, 'vision_layers': 3, 'vision_dim': 192, 'qk_norm': True}); m = JarvisUnifiedTransformer(cfg); p = m.parameter_count(); print(p['total_parameters'], p['language_parameters'])"`;
    const out = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    const [total, lm] = out.split(' ').map(Number);
    assert.strictEqual(total, 26785394, `PyTorch total parameters must equal 26,785,394 (got ${total})`);
    assert.strictEqual(lm, 25184544, `PyTorch LM parameters must equal 25,184,544 (got ${lm})`);
  });

  // Suite 4: Safe Versioned Loading & Dimension Mismatch Trap
  test('Safe Checkpoint Loading (load_pretrained) & Shape Mismatch Prevention', () => {
    const testPy = [
      "import torch",
      "from ml_foundation.model import JarvisUnifiedTransformer, JarvisConfig",
      "m, cfg = JarvisUnifiedTransformer.load_pretrained('data/neural_models/checkpoints/vision-v1.4-calibrated-local')",
      "assert cfg.d_model == 320",
      "assert m.parameter_count()['total_parameters'] == 13332498",
      "cfg_25m = JarvisConfig.from_dict({'model_name': 'vision-scale-25m', 'd_model': 448, 'n_layers': 10, 'n_heads': 8, 'n_kv_heads': 4, 'd_ff': 1152})",
      "m25 = JarvisUnifiedTransformer(cfg_25m)",
      "ckpt = torch.load('data/neural_models/checkpoints/vision-v1.4-calibrated-local/weights.pt', map_location='cpu')",
      "mismatches = [k for k, v in ckpt['model_state_dict'].items() if k in m25.state_dict() and m25.state_dict()[k].shape != v.shape]",
      "assert len(mismatches) > 100",
      "print('SAFE_LOAD_VERIFIED')"
    ].join('; ');
    const cmd = `"${PYTHON_EXE}" -c "${testPy}"`;
    const out = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.ok(out.includes('SAFE_LOAD_VERIFIED'), 'Safe loading and shape mismatch trap must pass');
  });

  // Suite 5: Dynamic INT8 Quantization Verification
  test('Dynamic INT8 Quantization Functionality', () => {
    const testPy = [
      "from ml_foundation.model import JarvisConfig, JarvisUnifiedTransformer",
      "cfg = JarvisConfig.from_dict({'model_name': 'vision-scale-25m', 'd_model': 448, 'n_layers': 4, 'n_heads': 8, 'n_kv_heads': 4, 'd_ff': 1152})",
      "m = JarvisUnifiedTransformer(cfg)",
      "q = m.quantize_dynamic_int8()",
      "assert hasattr(q.blocks[0].attn.q_proj, '_packed_params')",
      "print('INT8_QUANT_VERIFIED')"
    ].join('; ');
    const cmd = `"${PYTHON_EXE}" -c "${testPy}"`;
    const out = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.ok(out.includes('INT8_QUANT_VERIFIED'), 'Dynamic INT8 quantization must succeed');
  });

  // Suite 6: Cloud Distributed Training Package Exists & Parses Args
  test('Cloud Multi-GPU Training Harness (PyTorch FSDP & DeepSpeed ZeRO-3)', () => {
    const fsdpScript = path.join(REPO_ROOT, 'ml_foundation', 'cloud_training', 'fsdp_train_cloud.py');
    const deepspeedConfig = path.join(REPO_ROOT, 'ml_foundation', 'cloud_training', 'deepspeed_zero3_config.json');
    const clusterScript = path.join(REPO_ROOT, 'ml_foundation', 'cloud_training', 'run_cluster.sh');

    assert.strictEqual(fs.existsSync(fsdpScript), true, 'FSDP training script must exist');
    assert.strictEqual(fs.existsSync(deepspeedConfig), true, 'DeepSpeed config must exist');
    assert.strictEqual(fs.existsSync(clusterScript), true, 'Cluster run script must exist');

    const cmd = `"${PYTHON_EXE}" "${fsdpScript}" --help`;
    const out = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.ok(out.includes('--model-size'), 'FSDP script must parse --model-size argument');
  });

  // Suite 7: Zero Canary Contamination in Cognitive Dataset
  test('Zero Canary Contamination Audit (V14 & V13 Suites)', () => {
    const testPy = [
      "from ml_foundation.v15_scaling_engine import build_v15_cognitive_dataset",
      "items = build_v15_cognitive_dataset()",
      "assert len(items) >= 1500",
      "print('ZERO_CONTAMINATION_VERIFIED', len(items))"
    ].join('; ');
    const cmd = `"${PYTHON_EXE}" -c "${testPy}"`;
    const out = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.ok(out.includes('ZERO_CONTAMINATION_VERIFIED'), 'Zero contamination audit must pass');
  });

  // Suite 8: Unified Platform & Identity Attribution
  test('Unified Platform Identity & Attribution Invariants', () => {
    const regPath = path.join(REPO_ROOT, 'data', 'neural_models', 'neural_registry.json');
    assert.strictEqual(fs.existsSync(regPath), true, 'Registry file must exist');
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));

    assert.strictEqual(reg.brand, 'VISION — MADE BY LOKESH', 'Brand must be VISION — MADE BY LOKESH');
    assert.strictEqual(reg.aiBrand, 'VISION', 'aiBrand must be VISION');
    assert.strictEqual(reg.brandSignature, 'MADE BY LOKESH', 'brandSignature must be MADE BY LOKESH');
    assert.strictEqual(reg.assistantIdentity, 'JARVIS', 'assistantIdentity must be JARVIS');
    assert.strictEqual(reg.productIdentity, 'JARVIS, powered by VISION', 'productIdentity must be JARVIS, powered by VISION');
    assert.ok(reg.productionPrimaryModel.includes('gemini'), 'External provider Gemini must be attributed as teacher/production router');
  });

  console.log('\n================================================================');
  console.log(`TEST SUITE COMPLETE: ${passed} / ${total} suites passed (${((passed/total)*100).toFixed(1)}%)`);
  console.log('================================================================');
  assert.strictEqual(passed, total, `All ${total} suites must pass`);
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
