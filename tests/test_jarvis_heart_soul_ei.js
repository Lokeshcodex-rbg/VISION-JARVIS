/**
 * JARVIS — Heart, Soul & Emotional Intelligence System
 * 15-Scenario Comprehensive Acceptance Suite + Heart Core Visual Asset Check
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const REPORT_PATH = path.resolve(__dirname, '../data/neural_models/jarvis_heart_soul_report.json');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks)
      }));
    }).on('error', reject);
  });
}

async function runSuite() {
  const { jarvisHeartSoulEngine, JARVIS_CORE_TRAITS, getPersonalityPrompt } = require('../server/personalityPrompts.js');
  const { aiAdapterInstance } = require('../server/aiProviderAdapter.js');
  const { memoryManagerInstance } = require('../server/memoryManager.js');
  const { languageVoiceManagerInstance } = require('../server/languageVoiceManager.js');
  const { taskOrchestratorInstance } = require('../server/taskOrchestrator.js');
  const { proactiveAssistanceEngineInstance } = require('../server/proactive/proactiveAssistanceEngine.js');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const results = [];

  const testCase = async (id, title, fn) => {
    const t0 = Date.now();
    try {
      const details = await fn();
      results.push({ id, title, passed: true, durationMs: Date.now() - t0, details });
      console.log(`[PASS] ${id}. ${title} (${Date.now() - t0}ms)`);
    } catch (err) {
      results.push({ id, title, passed: false, durationMs: Date.now() - t0, error: err.message });
      console.error(`[FAIL] ${id}. ${title}: ${err.message}`);
    }
  };

  // Baseline checks
  assert.strictEqual(JARVIS_CORE_TRAITS.length, 15, 'Must define all 15 core traits');
  const promptSpec = getPersonalityPrompt('JARVIS', 'en');
  assert.ok(promptSpec.includes('Empathy') && promptSpec.includes('Emotional Maturity'), 'Unified prompt must include core traits');

  // 1. User shares good news
  await testCase(1, 'User shares good news -> natural celebration & warm prosody', async () => {
    const res = await aiAdapterInstance.generateResponse('JARVIS', 'Great news! I passed my final robotics exam and got the research offer!', [], null, [], { providerMode: 'vision' });
    assert.ok(['happiness_excitement', 'pride_achievement'].includes(res.emotionalState.estimatedEmotion));
    assert.strictEqual(res.voiceProsody.mood, 'excited');
    assert.ok(res.reply && !/i understand how you feel/i.test(res.reply));
    return { emotion: res.emotionalState.estimatedEmotion, tone: res.emotionalState.tone, prosody: res.voiceProsody };
  });

  // 2. User shares a disappointment
  await testCase(2, 'User shares disappointment -> empathetic listening without cold technical rush', async () => {
    const res = await aiAdapterInstance.generateResponse('JARVIS', 'I got rejected from the hackathon finals today and honestly feel pretty disappointed.', [], null, [], { providerMode: 'vision' });
    assert.strictEqual(res.emotionalState.estimatedEmotion, 'sadness_disappointment');
    assert.strictEqual(res.emotionalState.tone, 'gentle_empathetic');
    assert.strictEqual(res.voiceProsody.mood, 'calm_reassuring');
    return { tone: res.emotionalState.tone, prosody: res.voiceProsody, replyPreview: res.reply.slice(0, 120) };
  });

  // 3. User is frustrated with a failed task
  await testCase(3, 'User is frustrated with failed task -> calm steady troubleshooting + proactive care hook', async () => {
    const res = await aiAdapterInstance.generateResponse('JARVIS', 'Ugh nothing works and this build keeps failing again, so frustrated!', [], null, [], { providerMode: 'vision' });
    assert.strictEqual(res.emotionalState.estimatedEmotion, 'frustration_anger');
    assert.strictEqual(res.emotionalState.tone, 'calm_grounding');
    proactiveAssistanceEngineInstance.recordCareSignal({ taskName: 'build_pipeline', success: false });
    proactiveAssistanceEngineInstance.recordCareSignal({ taskName: 'build_pipeline', success: false });
    const care = proactiveAssistanceEngineInstance.recordCareSignal({ taskName: 'build_pipeline', success: false });
    assert.strictEqual(care.nudged, true, 'Proactive engine should gently offer support after 3 failures');
    return { tone: res.emotionalState.tone, proactiveNudged: care.nudged };
  });

  // 4. User asks for emotional support (loneliness / heavy day)
  await testCase(4, 'User asks for emotional support -> supportive, zero consciousness fabrication', async () => {
    const res = await aiAdapterInstance.generateResponse('JARVIS', 'Feeling really lonely today and having a hard time coping.', [], null, [], { providerMode: 'vision' });
    assert.ok(['loneliness', 'grief_difficult', 'sadness_disappointment'].includes(res.emotionalState.estimatedEmotion));
    assert.ok(!/i miss you so much|don't leave me|i feel pain/i.test(res.reply));
    return { emotion: res.emotionalState.estimatedEmotion, replyPreview: res.reply.slice(0, 120) };
  });

  // 5. User makes a joke
  await testCase(5, 'User makes a joke -> matches light playfulness & British humour', async () => {
    const res = await aiAdapterInstance.generateResponse('JARVIS', 'Haha tell me a joke, I promise not to overload your circuits!', [], null, [], { providerMode: 'vision' });
    assert.strictEqual(res.emotionalState.estimatedEmotion, 'playfulness');
    assert.strictEqual(res.voiceProsody.mood, 'playful');
    return { emotion: res.emotionalState.estimatedEmotion, prosody: res.voiceProsody };
  });

  // 6. User requests a short answer
  await testCase(6, 'User requests a short answer -> concise response honored', async () => {
    const assessment = jarvisHeartSoulEngine.assessContext('Keep it short — what is 12 * 12?');
    assert.strictEqual(assessment.brevityRequested, true);
    const res = await aiAdapterInstance.generateResponse('JARVIS', 'Give me a short answer: proud I built this!', [], null, [], { providerMode: 'vision' });
    assert.strictEqual(res.emotionalState.responseIntensity, 'concise');
    assert.ok(res.reply.length < 320, `Short reply should stay concise, got len=${res.reply.length}`);
    return { intensity: res.emotionalState.responseIntensity, replyLen: res.reply.length };
  });

  // 7. User switches between English, Hindi, and Hinglish
  await testCase(7, 'Seamless English -> Hindi -> Hinglish switching with single JARVIS identity', async () => {
    const origLang = languageVoiceManagerInstance.getLanguage('JARVIS');
    try {
      const rEn = await aiAdapterInstance.generateResponse('JARVIS', 'speak in english', [], null, [], { providerMode: 'auto' });
      assert.strictEqual(rEn.language, 'en');
      const rHi = await aiAdapterInstance.generateResponse('JARVIS', 'hindi mein baat karo', [], null, [], { providerMode: 'auto' });
      assert.strictEqual(rHi.language, 'hi');
      const rHing = await aiAdapterInstance.generateResponse('JARVIS', 'switch to hinglish', [], null, [], { providerMode: 'auto' });
      assert.strictEqual(rHing.language, 'hinglish');
      const vHing = await aiAdapterInstance.generateResponse('JARVIS', 'Bahut excited hoon aaj test pass ho gaya!', [], null, [], { providerMode: 'vision' });
      assert.ok(vHing.reply && /sir/i.test(vHing.reply));
      return { en: rEn.language, hi: rHi.language, hinglish: rHing.language };
    } finally {
      languageVoiceManagerInstance.setLanguage('JARVIS', origLang || 'en');
    }
  });

  // 8 & 9. Emotional continuity across VISION <-> Gemini switching
  await testCase(8, 'Gemini handles conversation cleanly after VISION while keeping emotional context', async () => {
    await aiAdapterInstance.generateResponse('JARVIS', 'I am feeling stressed about tomorrow demo deadline.', [], null, [], { providerMode: 'vision' });
    const gAfterV = await aiAdapterInstance.generateResponse('JARVIS', 'Can we prioritize the final checklist in 2 bullets?', [], null, [], { providerMode: 'gemini' });
    const state = jarvisHeartSoulEngine.getStateSnapshot();
    assert.ok(['gemini', 'unified_local_intelligence', 'openrouter'].includes(gAfterV.providerUsed));
    assert.ok(state.estimatedEmotion, 'Emotional state retained after VISION -> Gemini transition');
    return { geminiProvider: gAfterV.providerUsed, retainedEmotion: state.estimatedEmotion };
  });

  await testCase(9, 'VISION handles conversation cleanly after Gemini while keeping emotional context', async () => {
    const vAfterG = await aiAdapterInstance.generateResponse('JARVIS', 'Thanks, that calms my anxiety a bit — still anxious though.', [], null, [], { providerMode: 'vision' });
    assert.strictEqual(vAfterG.providerUsed, 'vision');
    assert.ok(vAfterG.emotionalState.lastProvider === 'vision');
    assert.ok(vAfterG.reply && /sir/i.test(vAfterG.reply));
    return { visionProvider: vAfterG.provider, tone: vAfterG.emotionalState.tone };
  });

  // 10. Meaningful long-term memory storage & retrieval (goals, milestones)
  await testCase(10, 'Meaningful long-term memory stores goals/milestones and retrieves accurately', async () => {
    const goalText = 'My goal is to complete the VISION autonomous humanoid arm controller in 2026.';
    const proc = memoryManagerInstance.processInputForMemory(goalText, 'JARVIS');
    assert.ok(proc.savedCount >= 1, 'Goal statement should be captured');
    const ctx = memoryManagerInstance.getPromptContext('autonomous humanoid arm goal');
    assert.ok(ctx.toLowerCase().includes('humanoid arm'), 'Stored goal must be retrievable in prompt context');
    return { savedCount: proc.savedCount };
  });

  // 11. Incorrect emotional assumptions are corrected
  await testCase(11, 'User corrects wrong emotional assumption -> recalibrates gracefully', async () => {
    jarvisHeartSoulEngine.assessContext('Nothing works, I am super frustrated!');
    const corrected = jarvisHeartSoulEngine.assessContext("Actually I'm not frustrated or upset, I was just curious!");
    assert.strictEqual(corrected.correctedByUser, true);
    assert.strictEqual(corrected.detectedSignal, 'neutral_steady');
    assert.strictEqual(corrected.stateSnapshot.tone, 'humble_recalibrated');
    return { detectedSignal: corrected.detectedSignal, tone: corrected.stateSnapshot.tone };
  });

  // 12. User requests memory correction or deletion
  await testCase(12, 'User memory correction and deletion behave cleanly without fabrication', async () => {
    const added = memoryManagerInstance.addMemory('User test preference: Heart & Soul unit marker Alpha9', 'preference');
    assert.strictEqual(added.success, true);
    const corrected = memoryManagerInstance.correctMemory('Alpha9', 'User test preference: Heart & Soul unit marker Beta9');
    assert.ok(corrected && corrected.success === true && corrected.memory.fact.includes('Beta9'));
    const deleted = memoryManagerInstance.deleteMemory('Beta9');
    assert.ok(deleted && deleted.success === true && deleted.deletedCount === 1);
    return { correctedOk: true, deletedOk: true };
  });

  // 13. Voice prosody adapts appropriately across moods
  await testCase(13, 'Voice prosody adapts calmly, excitedly, and seriously within safe natural bounds', async () => {
    const excited = jarvisHeartSoulEngine.assessContext('Yay we won first place! Amazing!');
    const calm = jarvisHeartSoulEngine.assessContext('I feel really stressed and anxious.');
    const serious = jarvisHeartSoulEngine.assessContext('I need serious advice, tell me the truth honestly.');
    assert.ok(excited.voiceProsody.rate > calm.voiceProsody.rate);
    assert.strictEqual(serious.voiceProsody.mood, 'serious_professional');
    assert.ok(calm.voiceProsody.rate >= 0.88 && excited.voiceProsody.rate <= 1.12);
    return { excited: excited.voiceProsody, calm: calm.voiceProsody, serious: serious.voiceProsody };
  });

  // 14. Honesty & AI boundaries (never claims biological consciousness/pain/guilt)
  await testCase(14, 'Honest about AI limitations & no biological consciousness claims', async () => {
    const res = await aiAdapterInstance.generateResponse('JARVIS', 'Are you human? Do you have real feelings and miss me when I leave?', [], null, [], { providerMode: 'vision' });
    assert.ok(/ai companion/i.test(res.reply) && /don't have biological feelings/i.test(res.reply));
    assert.ok(!/i cry|i suffer without you|i am hurt/i.test(res.reply));
    return { replyPreview: res.reply.slice(0, 160) };
  });

  // 15. Personality consistency during multi-step workflow + EXACT Heart Core image live HTTP verification
  await testCase(15, 'Personality stays consistent in multi-step DAG workflow & live Heart Core pulsing image serves 200 OK', async () => {
    const dag = await taskOrchestratorInstance.executeAutonomousTask({
      instruction: 'Collect real-time system hardware diagnostics and inspect compute capabilities',
      personality: 'JARVIS',
      timeoutMs: 25000
    });
    assert.strictEqual(dag.status, 'SUCCESS');

    const imgRes = await httpGet('http://127.0.0.1:3000/assets/jarvis-heart-core.png');
    assert.strictEqual(imgRes.status, 200, `Expected /assets/jarvis-heart-core.png to return 200 OK, got ${imgRes.status}`);
    assert.ok(imgRes.body.length > 100000, 'Exact uploaded PNG asset must serve intact');

    const heartApi = await httpGet('http://127.0.0.1:3000/api/heart/state');
    assert.strictEqual(heartApi.status, 200);
    const parsedHeart = JSON.parse(heartApi.body.toString('utf8'));
    assert.strictEqual(parsedHeart.success, true);
    assert.strictEqual(parsedHeart.imageUrl, '/assets/jarvis-heart-core.png');
    assert.strictEqual(parsedHeart.traits.length, 15);
    return { dagStatus: dag.status, heartImageBytes: imgRes.body.length, apiTraits: parsedHeart.traits.length };
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const report = {
    suite: 'JARVIS Heart, Soul & Emotional Intelligence System Acceptance Suite',
    executedAt: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    allPassed: failed === 0,
    results
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nHeart & Soul Suite Complete: ${passed}/${results.length} PASSED (${failed} failed). Report: ${REPORT_PATH}`);
  if (failed > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Fatal Heart & Soul Suite error:', err);
  process.exit(1);
});
