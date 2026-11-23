/**
 * Test Suite: VISION v1.3 Autonomous Planning Engine
 * tests/test_v13_planning_engine.js
 */

const assert = require('assert');
const { visionPlanningEngineInstance } = require('../server/planning/visionPlanningEngine.js');

async function runPlanningTests() {
  console.log('='.repeat(60));
  console.log('TEST SUITE: VISION v1.3 AUTONOMOUS PLANNING ENGINE');
  console.log('='.repeat(60));

  // 1. Goal Interpretation Test
  console.log('\n--- 1. Goal Interpretation ---');
  const interpSafe = visionPlanningEngineInstance.interpretGoal('Check system telemetry and status.');
  assert.strictEqual(interpSafe.success, true);
  assert.strictEqual(interpSafe.isSensitive, false);
  assert.strictEqual(interpSafe.category, 'SYSTEM_AUDIT');

  const interpSensitive = visionPlanningEngineInstance.interpretGoal('Clean up and delete outdated temporary logs.');
  assert.strictEqual(interpSensitive.success, true);
  assert.strictEqual(interpSensitive.isSensitive, true);
  assert.strictEqual(interpSensitive.requiresApproval, true);
  console.log('Goal interpretation passed (distinguished safe vs sensitive goals).');

  // 2. Task Decomposition & Prioritization
  console.log('\n--- 2. Task Decomposition & Dependency Identification ---');
  const planOutcome = await visionPlanningEngineInstance.createExecutionPlan('Gather system telemetry and generate report.');
  assert.strictEqual(planOutcome.success, true);
  assert(planOutcome.totalSteps >= 2, 'Expected at least 2 decomposed steps');
  assert(planOutcome.steps[0].tool, 'Expected tool assigned to step 1');
  assert(planOutcome.steps[1].dependencies.length > 0, 'Expected step 2 to depend on step 1');
  console.log(`Decomposed into ${planOutcome.totalSteps} ordered steps.`);

  // 3. Execution Monitoring, Permission Gate Check, and Synthesis
  console.log('\n--- 3. Controlled Execution & Security Pause Test ---');
  // Plan with destructive step should pause for approval
  const sensPlan = await visionPlanningEngineInstance.createExecutionPlan('Organize and delete old cache files.');
  const execOutcome = await visionPlanningEngineInstance.executePlan(sensPlan.planId, 'JARVIS');

  assert.strictEqual(execOutcome.haltedForApproval, true, 'Expected execution to halt for approval');
  assert(execOutcome.pendingApprovalStep !== null, 'Expected pending approval details');
  assert(execOutcome.synthesis.includes('Human Authorization Required'), 'Expected synthesis to request authorization');
  console.log('Security pause on sensitive action verified successfully.');

  console.log('\nAll Autonomous Planning Engine tests PASSED successfully!');
  console.log('='.repeat(60));
}

runPlanningTests().catch(err => {
  console.error('Planning test failed:', err);
  process.exit(1);
});
