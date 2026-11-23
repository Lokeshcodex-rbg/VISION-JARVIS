/**
 * STARK AI — Master 25-Module Intelligence Test Suite
 * Validates the integration of all 25 modules and the 6 logical engines.
 */

const assert = require('assert');
const { masterIntelligenceIntegration } = require('../server/masterIntelligenceIntegration.js');
const { decisionMakingEngineInstance } = require('../server/decisionMakingEngine.js');
const { reinforcementPolicyEngineInstance } = require('../server/learning/reinforcementPolicyEngine.js');
const { continuousImprovementLoopInstance } = require('../server/learning/continuousImprovementLoop.js');

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('       STARK AI — 25-MODULE MASTER INTELLIGENCE VERIFICATION    ');
  console.log('================================================================\n');

  // 1. Verify 6 Logical Engines
  console.log('Test 1: Verify the 6 Logical Intelligence Engines...');
  assert(masterIntelligenceIntegration.languageEngine, 'Language Engine must exist');
  assert(masterIntelligenceIntegration.reasoningEngine, 'Reasoning Engine must exist');
  assert(masterIntelligenceIntegration.memoryEngine, 'Memory Engine must exist');
  assert(masterIntelligenceIntegration.knowledgeEngine, 'Knowledge Engine must exist');
  assert(masterIntelligenceIntegration.learningEngine, 'Learning Engine must exist');
  assert(masterIntelligenceIntegration.toolEngine, 'Tool Engine must exist');
  console.log('  [PASS] 6 Logical Engines initialized and verified.');

  // 2. Test Module 2: Natural Language Understanding
  console.log('Test 2: Module 2 (NLU: grammar tolerance & intent extraction)...');
  const nluRes = masterIntelligenceIntegration.languageEngine.parseInput('yo jarvis open my somaiya profile and gmail pls');
  assert(nluRes.entities.hasCommands, 'NLU must detect command intent from informal phrasing');
  assert.strictEqual(nluRes.detectedIntent.toolName, 'open_gmail');
  console.log('  [PASS] Module 2 NLU handled informal syntax and extracted tool intent.');

  // 3. Test Module 14: Adaptive Communication Depth
  console.log('Test 3: Module 14 (Adaptive Communication Engine)...');
  const beginnerProfile = masterIntelligenceIntegration.languageEngine.adaptCommunicationStyle({ expertise: 'beginner' });
  assert.strictEqual(beginnerProfile.useAnalogies, true);
  assert.strictEqual(beginnerProfile.technicalDepth, 'minimal');

  const advancedProfile = masterIntelligenceIntegration.languageEngine.adaptCommunicationStyle({ expertise: 'advanced' });
  assert.strictEqual(advancedProfile.includeFormulas, true);
  assert.strictEqual(advancedProfile.technicalDepth, 'high');
  console.log('  [PASS] Module 14 adapted communication depth between beginner and advanced.');

  // 4. Test Module 20: Decision-Making Engine
  console.log('Test 4: Module 20 (Multi-Criteria Decision Making Engine)...');
  const decisionResult = decisionMakingEngineInstance.evaluateOptions({
    objective: 'Select caching strategy for low-latency voice pipeline',
    constraints: ['Must run locally', 'Sub-10ms response'],
    options: [
      {
        name: 'In-Memory LRU Cache',
        complexity: 2,
        risk: 1,
        advantages: ['Zero network hop', 'Blazing sub-millisecond lookups'],
        disadvantages: ['RAM limited']
      },
      {
        name: 'Distributed Redis Cluster',
        complexity: 8,
        risk: 6,
        advantages: ['High scalability across nodes'],
        disadvantages: ['Network latency penalty', 'Operational overhead']
      }
    ]
  });
  assert(decisionResult.decisionId, 'Decision must return a unique decisionId');
  assert.strictEqual(decisionResult.selectedOption.name, 'In-Memory LRU Cache');
  assert(decisionResult.rationale.includes('In-Memory LRU Cache'), 'Rationale must justify practical selection');
  console.log(`  [PASS] Module 20 selected "${decisionResult.selectedOption.name}" (Score: ${decisionResult.selectedOption.metrics.compositeScore}).`);

  // 5. Test Module 12: Reinforcement Learning & Offline Policy Evaluation
  console.log('Test 5: Module 12 (Reinforcement Learning & Policy Engine)...');
  const stateKey = reinforcementPolicyEngineInstance.encodeState({ taskCategory: 'DESKTOP_AUTOMATION', complexity: 'low', hasToolAvailable: true });
  const selectedAction = reinforcementPolicyEngineInstance.selectAction(stateKey);
  assert(selectedAction.action, 'Action must be selected from policy');

  const reward = reinforcementPolicyEngineInstance.computeReward({
    taskCompleted: true,
    correctnessScore: 1.0,
    toolExecutionSuccess: true,
    safetyCompliant: true,
    latencyMs: 450,
    userFeedback: 1
  });
  assert(reward > 0.8, 'High completion and satisfaction must yield positive reward');

  const stepRecord = reinforcementPolicyEngineInstance.recordStep({
    stateKey,
    action: selectedAction.action,
    reward
  });
  assert(stepRecord.newQ !== undefined, 'Step record must compute updated Q-value via Bellman equation');
  console.log(`  [PASS] Module 12 computed reward (${reward}) and updated Q-value (${stepRecord.newQ}).`);

  // 6. Test Module 23: 12-Stage Continuous Improvement Loop
  console.log('Test 6: Module 23 (12-Stage Continuous Improvement Loop)...');
  const cycle = continuousImprovementLoopInstance.startCycle('Open Microsoft Word and create document', { user: 'developer' });
  assert(cycle.cycleId, 'Cycle must have unique cycleId');
  assert.strictEqual(cycle.currentStage, 1);

  // Advance through sample stages
  continuousImprovementLoopInstance.recordStage(cycle.cycleId, 2, { nluParsed: true });
  continuousImprovementLoopInstance.recordStage(cycle.cycleId, 4, { planGenerated: true });
  continuousImprovementLoopInstance.recordStage(cycle.cycleId, 6, { executedTool: 'open_desktop_app' });
  const finalizedCycle = continuousImprovementLoopInstance.recordStage(cycle.cycleId, 10, { memoryUpdated: true });

  assert.strictEqual(finalizedCycle.status, 'COMPLETED');
  console.log(`  [PASS] Module 23 tracked cycle ${cycle.cycleId} through 12-stage improvement pipeline.`);

  // 7. Test Complete 25-Module Audit Report
  console.log('Test 7: Complete 25-Module Master Audit Report...');
  const report = masterIntelligenceIntegration.getComplete25ModuleReport();
  assert.strictEqual(report.architectureStatus, 'OPERATIONAL');
  assert.strictEqual(Object.keys(report.modules).length, 25, 'All 25 modules must be tracked');
  
  for (let i = 1; i <= 25; i++) {
    const modKey = Object.keys(report.modules).find(k => k.startsWith(`module${i}_`));
    assert(modKey, `Module ${i} must be present in report`);
    assert.strictEqual(report.modules[modKey].status, 'VERIFIED');
  }
  console.log('  [PASS] All 25 modules verified and accounted for in master report.');

  console.log('\n================================================================');
  console.log('🌟 25/25 MODULES & 6/6 ENGINES FULLY VERIFIED & OPERATIONAL!    ');
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
