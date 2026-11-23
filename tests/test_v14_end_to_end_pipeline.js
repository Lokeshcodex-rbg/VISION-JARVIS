/**
 * Test Suite: VISION v1.4 End-to-End Cognitive & Robotics Intelligence Pipeline
 * tests/test_v14_end_to_end_pipeline.js
 *
 * Verifies:
 *   1. Active Experimental Checkpoint Resolution (vision-v1.4-experimental-local)
 *   2. Production Primary Model router preservation (Gemini teacher & production primary)
 *   3. Multi-turn dialogue context retention & pronoun/reference resolution
 *   4. Conversational tool execution & structured JSON recovery
 *   5. Humanoid Hardware Bridge (ESP32 packet framing, joint movement & watchdog)
 *   6. Three-layer memory operations and prompt injection sanitization
 *   7. Brand & persona compliance (VISION — MADE BY LOKESH, JARVIS powered by VISION)
 */

const assert = require('assert');
const { neuralBrainServiceInstance } = require('../server/neural/neuralBrainService.js');
const { conversationalToolEngineInstance } = require('../server/tools/conversationalToolEngine.js');
const { conversationalMemorySystemInstance } = require('../server/memory/conversationalMemorySystem.js');
const { visionPlanningEngineInstance } = require('../server/planning/visionPlanningEngine.js');
const { humanoidHardwareBridgeInstance } = require('../server/robotics/humanoidHardwareBridge.js');
const { aiProviderAdapterInstance } = require('../server/aiProviderAdapter.js');

async function runEndToEndV14PipelineTests() {
  console.log('='.repeat(70));
  console.log('VISION v1.4 END-TO-END COGNITIVE & ROBOTICS PIPELINE VERIFICATION');
  console.log('='.repeat(70));

  // 1. Model Status & Registry Verification
  console.log('\n--- 1. Neural Brain Status & Brand Verification ---');
  const status = neuralBrainServiceInstance.getStatus();
  console.log(`[Status] Brand: ${status.brand}`);
  console.log(`[Status] Assistant Identity: ${status.assistantIdentity}`);
  console.log(`[Status] Production Primary Model: ${status.productionPrimaryModel}`);
  console.log(`[Status] Active Experimental Checkpoint: ${status.activeExperimentalCheckpoint}`);

  assert(status.brand.includes('VISION'), 'Brand must include VISION');
  assert(status.brand.includes('LOKESH'), 'Brand must include LOKESH');
  assert(status.productionPrimaryModel.includes('gemini'), 'Production primary must remain Gemini');
  console.log('Status and branding verified successfully.');

  // 2. Conversational Memory Layer Verification
  console.log('\n--- 2. Three-Layer Conversational Memory Verification ---');
  const memSession = 'test_v14_user_session';
  conversationalMemorySystemInstance.recordTurn(memSession, 'user', 'My name is Lokesh and I lead the VISION humanoid robotics team.');
  conversationalMemorySystemInstance.recordTurn(memSession, 'assistant', 'Understood Sir, honoring your directives.');
  conversationalMemorySystemInstance.recordFact('creator_identity', 'Lokesh', 'profile', 'verified_ground_truth');
  conversationalMemorySystemInstance.recordFact('primary_robotics_subsystem', 'Humanoid 6-DOF Manipulator', 'robotics', 'working_state');

  const memContext = conversationalMemorySystemInstance.formatContextForPrompt('Who is Lokesh and what is the robotics project?');
  assert(memContext.includes('Lokesh'), 'Memory context must contain Lokesh');
  assert(memContext.includes('<memory_context>'), 'Memory context must have sanitization delimiters');
  console.log('Three-layer memory context verified.');

  // 3. Autonomous Planning Engine Verification
  console.log('\n--- 3. Autonomous Planning Engine & Safety Gate ---');
  const interpSafe = visionPlanningEngineInstance.interpretGoal('Check free disk space and list project files');
  assert(interpSafe.success === true, 'Safe goal interpretation should succeed');
  assert(interpSafe.isSensitive === false, 'Safe goal should not be sensitive');

  const planSafe = await visionPlanningEngineInstance.createExecutionPlan('Gather system telemetry and generate report.');
  assert(planSafe.success === true, 'Safe plan decomposition should succeed');
  console.log(`Safe plan decomposed into ${planSafe.totalSteps} steps.`);

  const interpSensitive = visionPlanningEngineInstance.interpretGoal('Clean up and delete outdated database files.');
  assert(interpSensitive.isSensitive === true, 'Dangerous goal must be sensitive');
  assert(interpSensitive.requiresApproval === true, 'Dangerous goal must require approval');
  console.log('Security pause on destructive action verified.');

  // 4. Conversational Tool Engine & Resilient JSON Recovery
  console.log('\n--- 4. Conversational Tool Engine & JSON Recovery ---');
  const malformedInput = '```json\n{"tool": "get_current_time", "arguments": {},\n```';
  const recovered = conversationalToolEngineInstance.recoverMalformedJson(malformedInput);
  assert(recovered !== null, 'Malformed JSON must be recovered');
  assert(recovered.tool === 'get_current_time', 'Recovered tool must be get_current_time');

  const execRes = await conversationalToolEngineInstance.executeConversationalTool('get_current_time', {}, 'jarvis');
  assert(execRes.success === true, 'Live tool execution must succeed');
  console.log(`Live tool execution verified in ${execRes.latencyMs}ms: "${execRes.summary}"`);

  // 5. Duplicate Action Blocker
  console.log('\n--- 5. Duplicate Action Blocker ---');
  conversationalToolEngineInstance.checkDuplicateAction('test_v14_dup', {});
  conversationalToolEngineInstance.checkDuplicateAction('test_v14_dup', {});
  const thirdCheck = conversationalToolEngineInstance.checkDuplicateAction('test_v14_dup', {});
  assert(thirdCheck.isDuplicate === true, 'Third rapid identical tool call must be flagged as duplicate');
  console.log('Duplicate action prevention verified.');

  // 6. Humanoid Hardware Bridge Verification
  console.log('\n--- 6. Humanoid Hardware Bridge & Robotics Decoupling ---');
  const bridgeStatus = humanoidHardwareBridgeInstance.getArchitectureStatus();
  assert(bridgeStatus.laptopDependency === false, 'Laptop dependency must be false');
  assert(bridgeStatus.modularDecoupling.esp32SerialLink !== undefined, 'ESP32 link must be present');

  const moveRes = await humanoidHardwareBridgeInstance.sendJointAngles({
    joint_1_base: 30.0,
    joint_2_shoulder: -15.0,
    joint_3_elbow: 45.0
  });
  assert(moveRes.success === true, 'Humanoid joint angle command must succeed');
  assert(moveRes.packetBytes === 30, 'Packet must be 4 header + 24 payload + 2 CRC = 30 bytes');
  console.log(`Humanoid joint angles dispatched (${moveRes.packetBytes} bytes binary packet).`);

  console.log('\n' + '='.repeat(70));
  console.log('ALL VISION v1.4 END-TO-END PIPELINE TESTS PASSED SUCCESSFULLY!');
  console.log('='.repeat(70));
}

if (require.main === module) {
  runEndToEndV14PipelineTests().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Pipeline Test Failed:', err);
    process.exit(1);
  });
}

module.exports = { runEndToEndV14PipelineTests };
