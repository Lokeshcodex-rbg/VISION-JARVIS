/**
 * VISION v1.3 — Cognitive Intelligence & Autonomy Comprehensive End-to-End Test Suite
 * tests/test_v13_end_to_end_cognitive_pipeline.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { conversationalMemorySystemInstance } = require('../server/memory/conversationalMemorySystem.js');
const { visionPlanningEngineInstance } = require('../server/planning/visionPlanningEngine.js');
const { conversationalToolEngineInstance } = require('../server/tools/conversationalToolEngine.js');
const { neuralBrainServiceInstance } = require('../server/neural/neuralBrainService.js');
const { aiProviderAdapterInstance } = require('../server/aiProviderAdapter.js');

async function runEndToEndTests() {
  console.log('=' .repeat(70));
  console.log('TEST SUITE: VISION v1.3 COGNITIVE INTELLIGENCE & AUTONOMY PIPELINE');
  console.log('=' .repeat(70));

  // 1. Model Registry & Safe Fallback Verification
  console.log('\n--- 1. Registry & Production Fallback Status ---');
  const reg = neuralBrainServiceInstance.registry;
  assert.strictEqual(reg.brand, 'VISION — MADE BY LOKESH', 'Brand identity mismatch');
  assert.strictEqual(reg.activeExperimentalCheckpoint, 'vision-v1.3-experimental-local', 'Active checkpoint mismatch');
  assert.ok(reg.productionPrimaryModel.includes('gemini-2.5-pro'), 'Primary production router must remain Gemini');
  const v13Info = reg.checkpoints['vision-v1.3-experimental-local'];
  assert.ok(v13Info, 'vision-v1.3-experimental-local must be registered');
  assert.strictEqual(v13Info.status, 'ACTIVE_EXPERIMENTAL', 'Must be ACTIVE_EXPERIMENTAL');
  console.log(`[PASS] Registry verified: ${reg.activeExperimentalCheckpoint} (${v13Info.status})`);
  console.log(`[PASS] Primary router: ${reg.productionPrimaryModel}`);

  // 2. Evaluation Report Verification
  console.log('\n--- 2. Held-Out 48-Probe Benchmark Verification ---');
  const evalRepPath = path.join(__dirname, '..', 'data', 'neural_models', 'reports', 'vision_v13_scores.json');
  assert.ok(fs.existsSync(evalRepPath), 'Evaluation report must exist');
  const evalRep = JSON.parse(fs.readFileSync(evalRepPath, 'utf8'));
  assert.strictEqual(evalRep.total_probes, 48, 'Benchmark must contain exactly 48 probes');
  assert.ok(evalRep.overall_pass_rate > 0.25, `Expected overall pass rate > 25%, got: ${evalRep.overall_pass_rate}`);
  assert.ok(evalRep.category_pass_rates.tool_intelligence >= 0.5, 'Tool intelligence pass rate must be >= 50%');
  assert.ok(evalRep.category_pass_rates.reasoning >= 0.3, 'Reasoning pass rate must be >= 30%');
  console.log(`[PASS] Benchmark verified: ${evalRep.total_probes} probes | Overall Pass: ${(evalRep.overall_pass_rate * 100).toFixed(1)}%`);
  console.log(`[PASS] Tool Intelligence: ${(evalRep.category_pass_rates.tool_intelligence * 100).toFixed(1)}% | Reasoning: ${(evalRep.category_pass_rates.reasoning * 100).toFixed(1)}%`);

  // 3. Three-Layer Conversational Memory System
  console.log('\n--- 3. Conversational Memory Verification ---');
  conversationalMemorySystemInstance.recordTurn('user', 'My name is Lokesh and I prefer dark mode');
  conversationalMemorySystemInstance.recordFact('favorite_ide', 'VS Code', 'preference', 'FACT');
  conversationalMemorySystemInstance.recordFact('favorite_ide', 'Antigravity IDE', 'preference', 'FACT'); // Conflict update
  conversationalMemorySystemInstance.recordEpisode({
    context: 'Architecture development',
    action: 'Build v1.3 architecture',
    outcome: 'All modules instantiated and verified',
    success: true,
    milestone: 'v1.3_cognitive_upgrade'
  });

  const contextStr = conversationalMemorySystemInstance.formatContextForPrompt('Tell me about my IDE');
  assert.ok(contextStr.includes('Antigravity IDE'), 'Updated preference must be retrieved');
  assert.ok(contextStr.includes('<memory_context>'), 'Must be enclosed in injection-safe delimiter');
  console.log('[PASS] Three-layer memory operations and conflict resolution verified.');

  // 4. Autonomous Planning Engine & Security Gate
  console.log('\n--- 4. Autonomous Planning Engine & Safety Verification ---');
  const safeGoal = visionPlanningEngineInstance.interpretGoal('Check system health and memory usage');
  assert.strictEqual(safeGoal.isSensitive, false, 'Goal must not be sensitive');

  const sensitiveGoal = visionPlanningEngineInstance.interpretGoal('Delete all temporary cache files');
  assert.strictEqual(sensitiveGoal.isSensitive, true, 'Goal must be sensitive');
  assert.strictEqual(sensitiveGoal.requiresApproval, true, 'Sensitive goal must require approval');

  const planRes = await visionPlanningEngineInstance.createExecutionPlan('Check system hardware metrics');
  assert.ok(planRes.success && planRes.plan.nodes && planRes.plan.nodes.length > 0, 'Plan must contain executable steps');
  console.log(`[PASS] Goal interpretation and decomposition verified (${planRes.plan.nodes.length} steps).`);

  // 5. Conversational Tool Intelligence & Error Recovery
  console.log('\n--- 5. Conversational Tool Engine & Resilient JSON Recovery ---');
  const malformedInput = '```json\n{\'tool\': \'get_current_time\', \'arguments\': {},\n}\n```';
  const recovered = conversationalToolEngineInstance.recoverMalformedJson(malformedInput);
  assert.ok(recovered, 'Malformed JSON must be recovered');
  assert.strictEqual(recovered.tool, 'get_current_time', 'Tool name must match');

  const liveRes = await conversationalToolEngineInstance.executeConversationalTool('get_current_time', {});
  assert.strictEqual(liveRes.success, true, 'Live tool execution must succeed');
  assert.ok(liveRes.summary.includes('2026'), 'Time output must be valid');
  console.log(`[PASS] Malformed JSON recovery and live tool execution verified (${liveRes.latencyMs}ms).`);

  // 6. Duplicate-Action Prevention
  console.log('\n--- 6. Duplicate Action Prevention Verification ---');
  let dupBlocked = false;
  for (let i = 0; i < 4; i++) {
    const dRes = await conversationalToolEngineInstance.executeConversationalTool('test_dup_tool_v13', { count: 1 });
    if (!dRes.success && dRes.error && dRes.error.includes('DUPLICATE_ACTION_BLOCKED')) {
      dupBlocked = true;
      break;
    }
  }
  assert.strictEqual(dupBlocked, true, 'Duplicate action blocker must trigger on >=3 consecutive calls');
  console.log('[PASS] Duplicate action blocker verified.');

  console.log('\n' + '=' .repeat(70));
  console.log('ALL VISION v1.3 COGNITIVE PIPELINE TESTS PASSED SUCCESSFULLY!');
  console.log('=' .repeat(70));
}

runEndToEndTests().catch(err => {
  console.error('\n[FAIL] Test suite failed:', err);
  process.exit(1);
});
