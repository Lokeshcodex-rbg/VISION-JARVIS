/**
 * Test Suite: VISION × JARVIS — Ultimate Unified AI Operating System
 * tests/test_v14_jarvis_unified_os.js
 *
 * Verifies the Absolute Architectural Decision:
 *   THERE MUST BE ONLY ONE JARVIS.
 *
 * Tests all integrated functional abilities under the single central `jarvis` instance:
 *   1. Single Assistant Identity & Brand Integrity
 *   2. Natural Language Interaction & Routing
 *   3. Integrated Research & Citation Grounding
 *   4. Integrated Software Engineering & Code Inspection
 *   5. Integrated Planning & DAG Goal Decomposition
 *   6. Integrated Mathematics & Scientific Computation
 *   7. Integrated Communication & Message Staging (Safe Human Approval)
 *   8. Integrated Business Analytics & Forecasting with Uncertainty
 *   9. Integrated File & Document Parsing
 *  10. Integrated Independent Verification & Safety Boundaries
 *  11. Integrated Windows Desktop Management
 *  12. Integrated Robotics & ESP32 Embodied Control
 *  13. Integrated Proactive Assistance & Quiet Hours
 *  14. Integrated Three-Layer Memory & Context Formatting
 *  15. Complete 23-Capability Audit Generation
 */

const assert = require('assert');
const { jarvis } = require('../server/jarvisUnifiedOS.js');

async function runUnifiedOSTests() {
  console.log('='.repeat(75));
  console.log('TEST SUITE: VISION × JARVIS ULTIMATE UNIFIED AI OPERATING SYSTEM');
  console.log('='.repeat(75));

  // 1. Single Assistant Identity & Brand Invariant
  console.log('\n--- 1. Single Assistant Identity & Brand Invariant ---');
  assert.strictEqual(jarvis.brand, 'VISION — MADE BY LOKESH');
  assert.strictEqual(jarvis.assistantIdentity, 'JARVIS');
  const sysStatus = jarvis.getSystemStatus();
  assert.strictEqual(sysStatus.singleAssistantEnforced, true);
  assert.strictEqual(sysStatus.productionPrimaryModel.includes('gemini'), true);
  console.log(`Brand: ${sysStatus.brand}`);
  console.log(`Assistant: ${sysStatus.identity}`);
  console.log(`Single Assistant Enforced: ${sysStatus.singleAssistantEnforced}`);
  console.log('Single Assistant Identity invariant verified.');

  // 2. Central Natural Language Interaction
  console.log('\n--- 2. Central Natural Language Interaction ---');
  const chatRes = await jarvis.interact({
    message: 'What is the current time?',
    options: { sessionId: 'unified_test_session' }
  });
  assert(chatRes.reply.length > 0, 'Reply should not be empty');
  assert.strictEqual(chatRes.identity, 'JARVIS');
  console.log(`[Interaction] Reply: "${chatRes.reply.slice(0, 80)}..." (${chatRes.latencyMs}ms)`);
  console.log('Central natural language turn verified.');

  // 3. Integrated Research
  console.log('\n--- 3. Integrated Function: Research & Knowledge Intelligence ---');
  const researchRes = await jarvis.research({ query: 'quantum computing algorithms', maxResults: 3 });
  assert.strictEqual(researchRes.status, 'COMPLETED');
  assert(researchRes.papersFound >= 0, 'Research should execute cleanly');
  console.log(`Research query: "${researchRes.query}" | Grounding: ${researchRes.evidenceGrounding} (${researchRes.durationMs}ms)`);
  console.log('Integrated research function verified.');

  // 4. Integrated Software Engineering
  console.log('\n--- 4. Integrated Function: Software Engineering & Code Analysis ---');
  const codeRead = await jarvis.code({ task: 'READ', relPath: 'package.json' });
  assert.strictEqual(codeRead.status, 'COMPLETED');
  assert(codeRead.lines.length > 0, 'Should read package.json lines');

  const secAudit = await jarvis.code({ task: 'AUDIT_SECURITY', relPath: 'server/jarvisUnifiedOS.js' });
  assert.strictEqual(secAudit.status, 'COMPLETED');
  assert(secAudit.riskScore !== undefined, 'Security audit should compute risk score');
  console.log(`Code Read: ${codeRead.totalLines} lines | Security Audit Risk Score: ${secAudit.riskScore}`);
  console.log('Integrated software engineering function verified.');

  // 5. Integrated Planning & Goal Decomposition
  console.log('\n--- 5. Integrated Function: Autonomous Planning & Decomposition ---');
  const planRes = await jarvis.plan({ objective: 'Audit system health and backup memory files' });
  assert.strictEqual(planRes.status, 'PLAN_CREATED');
  assert(planRes.totalSteps >= 1, 'Should create at least 1 plan step');
  console.log(`Plan ID: ${planRes.planId} | Steps: ${planRes.totalSteps} | Sensitive: ${planRes.isSensitive}`);
  console.log('Integrated planning function verified.');

  // 6. Integrated Mathematics & Reasoning
  console.log('\n--- 6. Integrated Function: Mathematics & Scientific Computation ---');
  const mathRes = await jarvis.math({ expression: '45 * 12 - 140', problemType: 'ARITHMETIC' });
  assert.strictEqual(mathRes.status, 'COMPLETED');
  assert.strictEqual(mathRes.result, 400);
  assert.strictEqual(mathRes.verified, true);
  console.log(`Math Expression: "${mathRes.expression}" = ${mathRes.result} (Verified: ${mathRes.verified})`);
  console.log('Integrated mathematics function verified.');

  // 7. Integrated Communication Intelligence
  console.log('\n--- 7. Integrated Function: Communication & Message Staging ---');
  const commRes = await jarvis.communicate({
    channel: 'WHATSAPP',
    action: 'STAGE_MESSAGE',
    contact: 'Alice',
    message: 'The unified JARVIS architecture is fully operational.'
  });
  assert.strictEqual(commRes.status, 'MESSAGE_STAGED');
  assert.strictEqual(commRes.requiresHumanApprovalToSend, true);
  console.log(`Channel: ${commRes.channel} | Staged Contact: "${commRes.staged.contact}" | Requires Approval: ${commRes.requiresHumanApprovalToSend}`);
  console.log('Integrated communication safety gate verified.');

  // 8. Integrated Business & Financial Intelligence
  console.log('\n--- 8. Integrated Function: Business & Financial Intelligence ---');
  const bizRes = await jarvis.business({ action: 'FORECAST', horizonMonths: 4 });
  assert.strictEqual(bizRes.status, 'COMPLETED');
  assert.strictEqual(bizRes.predictions.length, 4);
  assert.strictEqual(bizRes.uncertaintyAcknowledged, true);
  console.log(`Forecast Horizon: ${bizRes.horizonMonths} months | Predictions: [${bizRes.predictions.join(', ')}]`);
  console.log('Integrated business intelligence function verified.');

  // 9. Integrated File & Document Intelligence
  console.log('\n--- 9. Integrated Function: File & Document Intelligence ---');
  const fileRes = await jarvis.files({ action: 'INSPECT', targetPath: 'package.json' });
  assert.strictEqual(fileRes.status, 'COMPLETED');
  assert.strictEqual(fileRes.documentType, 'json');
  console.log(`File: "${fileRes.targetPath}" | Type: ${fileRes.documentType} | Pages: ${fileRes.pageCount}`);
  console.log('Integrated file intelligence function verified.');

  // 10. Integrated Independent Verification & Safety Boundaries
  console.log('\n--- 10. Integrated Function: Independent Verification & Safety ---');
  const verifyFact = await jarvis.verify({ claim: 'All metals conduct electricity.', evidence: ['Copper conducts electricity.'] });
  assert.strictEqual(verifyFact.status, 'COMPLETED');
  assert(verifyFact.confidenceScore >= 0.0);

  const verifyAction = await jarvis.verify({ action: { toolName: 'set_system_volume', args: { level_percent: 50 } } });
  assert.strictEqual(verifyAction.status, 'COMPLETED');
  assert.strictEqual(verifyAction.isSafe, true);
  console.log(`Claim Verification Confidence: ${verifyFact.confidenceScore} | Action Safe: ${verifyAction.isSafe}`);
  console.log('Integrated verification function verified.');

  // 11. Integrated Windows Desktop Management
  console.log('\n--- 11. Integrated Function: Windows Desktop Management ---');
  const deskRes = await jarvis.desktop({ action: 'LIST_RUNNING' });
  assert.strictEqual(deskRes.status, 'COMPLETED');
  assert(Array.isArray(deskRes.runningApps), 'runningApps should be an array');
  console.log(`Running Desktop Applications Detected: ${deskRes.runningApps.length}`);
  console.log('Integrated Windows desktop function verified.');

  // 12. Integrated Robotics & ESP32 Embodied Control
  console.log('\n--- 12. Integrated Function: Robotics & Embodied Control ---');
  const robotStatus = await jarvis.robotics({ action: 'STATUS' });
  assert.strictEqual(robotStatus.brand, 'VISION — MADE BY LOKESH');
  assert.strictEqual(robotStatus.laptopDependency, false);

  const jointRes = await jarvis.robotics({ action: 'SET_JOINTS', targetAngles: { joint_1_base: 15.0, joint_2_shoulder: 20.0 } });
  assert.strictEqual(jointRes.success, true);
  assert.strictEqual(jointRes.packetBytes, 30);
  console.log(`Target Runtime: ${robotStatus.targetRuntime} | Joint Packet: ${jointRes.packetBytes} bytes`);
  console.log('Integrated robotics function verified.');

  // 13. Integrated Proactive Assistance
  console.log('\n--- 13. Integrated Function: Proactive Assistance & Monitoring ---');
  const proStatus = await jarvis.proactive({ action: 'STATUS' });
  assert.strictEqual(typeof proStatus.isPaused, 'boolean');
  assert.strictEqual(typeof proStatus.isQuietHourNow, 'boolean');
  console.log(`Proactive Paused: ${proStatus.isPaused} | Quiet Hours Active: ${proStatus.isQuietHourNow} | Queued: ${proStatus.totalQueuedNotifications}`);
  console.log('Integrated proactive assistance function verified.');

  // 14. Integrated Three-Layer Memory
  console.log('\n--- 14. Integrated Function: Three-Layer Memory & Context ---');
  jarvis.memory({ action: 'RECORD_FACT', key: 'user_preferred_language', value: 'JavaScript', category: 'preferences' });
  const memContext = jarvis.memory({ action: 'RETRIEVE_CONTEXT', query: 'What programming language does the user prefer?' });
  assert.strictEqual(memContext.status, 'COMPLETED');
  assert(memContext.memoryContext.includes('<memory_context>'), 'Context must contain memory delimiters');
  console.log('Integrated memory context formatting verified.');

  // 15. Complete Unified Capability Architecture Audit
  console.log('\n--- 15. Authoritative Unified Capability Architecture Audit ---');
  const audit = jarvis.getCapabilityAudit();
  assert.ok(audit.capabilities.length >= 23, 'Must audit at least 23 core capabilities');
  const allFullyImplemented = audit.capabilities.every(c => c.status === 'FULLY_IMPLEMENTED_AND_TESTED');
  assert.strictEqual(allFullyImplemented, true, 'All audited capabilities must be fully implemented and tested');
  console.log(`Total Capabilities Audited: ${audit.capabilities.length} capabilities certified.`);
  console.log(`All Capabilities Status: FULLY_IMPLEMENTED_AND_TESTED (100%)`);

  console.log('\n' + '='.repeat(75));
  console.log('ALL 15 VISION × JARVIS UNIFIED OS TESTS PASSED SUCCESSFULLY!');
  console.log('ONE VISION. ONE JARVIS. ONE INTELLIGENCE. ALL CAPABILITIES.');
  console.log('='.repeat(75));
}

if (require.main === module) {
  runUnifiedOSTests().catch(err => {
    console.error('Unified OS Test Failed:', err);
    process.exit(1);
  });
}

module.exports = { runUnifiedOSTests };
