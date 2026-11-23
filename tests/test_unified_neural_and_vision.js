/**
 * End-to-End Verification Suite: Unified Neural Intelligence & Vision AI
 * Tests REAL PyTorch owned foundation model, OpenCV + Windows WinRT OCR,
 * Gemini/unified multimodal inspection, shared SQLite+KG visual memory,
 * real MP4 temporal video analysis, real desktop screen capture, REST /api/neural/*,
 * and Playwright browser verification of ONE unified JARVIS UI.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const BASE_URL = 'http://127.0.0.1:3000';
const VENV_PYTHON = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
const TEMP_DIR = path.join(__dirname, '..', 'data', 'vision_temp', 'test_unified');

function logSection(tag, msg) {
  console.log(`\n[${tag}] ${msg}`);
}

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE_URL}/api/neural/status`);
      if (r.ok) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('Server did not become ready on :3000');
}

function generateTestMedia() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const imgPath = path.join(TEMP_DIR, 'motor_spec_test.png');
  const vidPath = path.join(TEMP_DIR, 'arm_motion_test.mp4');

  const pyScript = `
import cv2, numpy as np
img = np.full((360, 640, 3), 245, dtype=np.uint8)
cv2.circle(img, (180, 180), 85, (30, 60, 150), -1)
cv2.circle(img, (180, 180), 28, (220, 220, 220), -1)
cv2.rectangle(img, (300, 90), (600, 270), (25, 25, 25), 3)
cv2.putText(img, "NEMA17 24V 2A", (315, 165), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (10, 10, 10), 3)
cv2.putText(img, "ROBOT ARM ACTUATOR", (315, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (20, 20, 20), 2)
cv2.imwrite(r"${imgPath}", img)

fourcc = cv2.VideoWriter_fourcc(*'mp4v')
vw = cv2.VideoWriter(r"${vidPath}", fourcc, 10.0, (320, 240))
for i in range(18):
    frame = np.full((240, 320, 3), 20, dtype=np.uint8)
    if i < 9:
        cv2.circle(frame, (80, 120), 35, (0, 200, 255), -1)
    else:
        cv2.rectangle(frame, (170, 50), (295, 195), (255, 120, 20), -1)
        cv2.putText(frame, "MOVED", (40, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    vw.write(frame)
vw.release()
print("MEDIA_OK")
`;
  const proc = spawnSync(VENV_PYTHON, ['-c', pyScript], { encoding: 'utf8', timeout: 20000 });
  if (proc.status !== 0 || !proc.stdout.includes('MEDIA_OK')) {
    throw new Error(`Failed generating test media: ${proc.stderr || proc.stdout}`);
  }
  return { imgPath, vidPath };
}

(async () => {
  let passed = 0;
  let failed = 0;

  async function runTest(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (err) {
      failed++;
      console.error(`FAIL: ${name} -> ${err.message}`);
    }
  }

  const { imgPath, vidPath } = generateTestMedia();

  const { neuralBrainServiceInstance } = require('../server/neural/neuralBrainService.js');
  const { multimodalDocumentEngineInstance } = require('../server/vision/multimodalDocumentEngine.js');
  const { videoIntelligenceEngineInstance } = require('../server/vision/videoIntelligenceEngine.js');
  const { cameraIntelligenceEngineInstance } = require('../server/vision/cameraIntelligenceEngine.js');
  const { multimodalReasoningEngineInstance } = require('../server/vision/multimodalReasoningEngine.js');
  const { visionServiceInstance } = require('../server/visionService.js');
  const { unifiedIntelligenceLayerInstance, EPISTEMIC_SOURCES } = require('../server/unifiedIntelligenceLayer.js');
  const { aiAdapterInstance } = require('../server/aiProviderAdapter.js');
  const { modelLifecycleManagerInstance } = require('../server/modelLifecycleManager.js');
  const { codingAssistantInstance } = require('../server/codingAssistant.js');

  await runTest('[REAL_PYTORCH] Owned tokenizer, transformer checkpoint eval, honest gating, rollback & inference', async () => {
    const status = neuralBrainServiceInstance.getStatus();
    assert.strictEqual(status.success, true);
    assert(status.checkpointCount >= 1, 'Expected at least 1 trained owned checkpoint');
    const targetVersion = status.checkpoints.find(c => c.version === 'jarvis-v0.7.0')?.version
      || status.checkpoints.find(c => c.version === 'jarvis-v0.6.0')?.version
      || status.checkpoints.find(c => c.version === 'jarvis-v0.5.0')?.version
      || status.activeExperimentalCheckpoint
      || status.checkpoints[status.checkpoints.length - 1].version;

    const evalRes = await neuralBrainServiceInstance.evaluateCheckpoint(targetVersion);
    assert.strictEqual(evalRes.success, true);
    assert(evalRes.parameters.total_parameters > 100000, 'Expected real neural parameter count > 100k');
    assert((evalRes.parameters.audio_parameters || 0) > 0, 'Expected JarvisAudioFeatureEncoder parameters > 0');
    assert(evalRes.metrics.vision_val_accuracy >= 0.5, `Expected held-out vision accuracy >= 0.5, got ${evalRes.metrics.vision_val_accuracy}`);
    if (evalRes.metrics.audio_val_total > 0) {
      assert(evalRes.metrics.audio_val_accuracy >= 0.7, `Expected held-out audio accuracy >= 0.7, got ${evalRes.metrics.audio_val_accuracy}`);
    }
    if (evalRes.metrics.ocr_total > 0) {
      assert(evalRes.metrics.ocr_char_accuracy >= 0.85, `Expected Stage 5 OCR char accuracy >= 0.85, got ${evalRes.metrics.ocr_char_accuracy}`);
    }
    assert(Number.isFinite(evalRes.metrics.sft_test_perplexity) && evalRes.metrics.sft_test_perplexity > 0, 'Expected held-out sft_test_perplexity');
    assert(Number.isFinite(evalRes.metrics.expected_calibration_error_ece) && evalRes.metrics.expected_calibration_error_ece >= 0, 'Expected ECE calibration metric');
    assert(evalRes.metrics.kv_cache_speedup > 0 && Number.isFinite(evalRes.metrics.kv_cache_ms_per_token), 'Expected KV-cache latency benchmark metrics');
    assert(
      evalRes.metrics.domain_benchmarks
      && typeof evalRes.metrics.domain_benchmarks.math_reasoning === 'number'
      && typeof evalRes.metrics.domain_benchmarks.general_knowledge === 'number'
      && typeof evalRes.metrics.domain_benchmarks.tool_selection === 'number'
      && typeof evalRes.metrics.domain_benchmarks.visual_reasoning === 'number',
      'Expected 7-domain benchmark metrics'
    );

    // Verify 3-way split & zero contamination dataset manifest if present
    const targetCkptEntry = neuralBrainServiceInstance.registry.checkpoints[targetVersion];
    const manifestAudit = targetCkptEntry?.trainingReport?.dataset_audit;
    if (manifestAudit) {
      assert.strictEqual(manifestAudit.zero_exact_contamination_val, true, 'Expected zero exact val contamination');
      assert.strictEqual(manifestAudit.zero_exact_contamination_test, true, 'Expected zero exact test contamination');
    }

    // Honest gate: MUST block promoting tiny CPU experimental model as primary production model
    const prodPromote = await neuralBrainServiceInstance.promoteCheckpoint(targetVersion, { targetRole: 'production_primary' });
    assert.strictEqual(prodPromote.promoted, false);
    assert.strictEqual(prodPromote.gateBlocked, true);
    assert(/SAFETY_AND_QUALITY_GATE/i.test(prodPromote.reason));

    // Real ModelLifecycleManager delegate check (no hardcoded isCorrect=true)
    const mlmRes = await modelLifecycleManagerInstance.evaluateModel(targetVersion);
    assert.strictEqual(mlmRes.success, true);
    assert(mlmRes.metrics && mlmRes.metrics.vision_val_accuracy !== undefined, 'Expected real metrics from ML evaluator');

    // Real PyTorch forward pass with image + text
    const inferRes = await neuralBrainServiceInstance.inferWithOwnedBrain({
      prompt: 'Inspect motor actuator',
      imagePath: imgPath,
      version: targetVersion,
      maxNewTokens: 12
    });
    assert.strictEqual(inferRes.success, true);
    assert(inferRes.visionPrediction && inferRes.visionPrediction.top_category, 'Expected owned vision prediction category');
    assert(Array.isArray(inferRes.visionPrediction.predicted_bbox_xywh) && inferRes.visionPrediction.predicted_bbox_xywh.length === 4);

    // Real PyTorch acoustic classification check using held-out WAV if present
    const sampleWav = path.join(__dirname, '..', 'data', 'neural_models', 'datasets', targetVersion, 'audio_samples', 'wake_word_jarvis_15.wav');
    let audioTopPred = 'n/a';
    if (fs.existsSync(sampleWav)) {
      const audioInferRes = await neuralBrainServiceInstance.inferWithOwnedBrain({
        prompt: 'Classify acoustic wake-word frame',
        audioPath: sampleWav,
        version: targetVersion,
        maxNewTokens: 8
      });
      assert.strictEqual(audioInferRes.success, true);
      assert(audioInferRes.audioPrediction && audioInferRes.audioPrediction.top_category, 'Expected owned audioPrediction category');
      audioTopPred = audioInferRes.audioPrediction.top_category;
    }
    logSection('REAL_PYTORCH', `Version=${targetVersion}, Params=${evalRes.parameters.total_parameters}, VisionAcc=${evalRes.metrics.vision_val_accuracy}, AudioAcc=${evalRes.metrics.audio_val_accuracy ?? 'n/a'}, TopVision=${inferRes.visionPrediction.top_category}, TopAudio=${audioTopPred}`);
  });

  await runTest('[REAL_VISION_AND_OCR] OpenCV circle/region features + Windows WinRT OCR + Unified design image inspection', async () => {
    const docRes = await multimodalDocumentEngineInstance.analyzeDocument(imgPath);
    assert.strictEqual(docRes.success, true);
    assert(docRes.width === 640 && docRes.height === 360, `Expected 640x360 image dimensions, got ${docRes.width}x${docRes.height}`);
    assert(docRes.segmentation && docRes.segmentation.segmentCount >= 1 && docRes.segmentation.foregroundRatio > 0, 'Expected real OpenCV foreground segmentation stats');
    assert(Array.isArray(docRes.spatialRelations) && docRes.spatialRelations.length >= 1, `Expected pairwise spatialRelations, got ${JSON.stringify(docRes.spatialRelations)}`);
    assert(docRes.visualAnomaly && typeof docRes.visualAnomaly.sharpnessLaplacian === 'number' && typeof docRes.visualAnomaly.anomalyDetected === 'boolean', 'Expected visualAnomaly sharpness/outlier metrics');
    const extracted = String(docRes.ocrText || docRes.extractedText || docRes.summary || '');
    assert(/NEMA17|24V|ROBOT/i.test(extracted), `Expected WinRT OCR to read label from image, got: "${extracted}"`);

    const anomRes = await visionServiceInstance.detectVisualAnomalies({ filePath: imgPath, prompt: '' });
    assert.strictEqual(anomRes.success, true);
    assert.strictEqual(anomRes.verified, true);
    assert.strictEqual(anomRes.epistemicSource, 'INFERENCE');
    assert(anomRes.segmentation && Array.isArray(anomRes.spatialRelations));

    const designRes = await aiAdapterInstance.analyzeDesignReferenceImage(
      'Inspect this motor image and identify visible specs and uncertainties',
      [{ filePath: imgPath }],
      'JARVIS'
    );
    assert.strictEqual(designRes.success, true);
    assert(designRes.ownedNeuralPrediction && designRes.ownedNeuralPrediction.top_category);
    assert(designRes.sharedMemoryRecord && designRes.sharedMemoryRecord.success, 'Expected visual observation saved to shared memory');
    logSection('REAL_VISION_AND_OCR', `OCR="${extracted.replace(/\s+/g, ' ').slice(0, 70)}", Provider=${designRes.provider}, MemoryId=${designRes.sharedMemoryRecord.id}`);
  });

  await runTest('[SHARED_VISUAL_MEMORY] Cross-session continuity recalls visual observation into robotics context', async () => {
    const recalled = multimodalReasoningEngineInstance.recallVisualObservations('NEMA17 motor robotic arm', 5);
    assert(Array.isArray(recalled) && recalled.length > 0, 'Expected recalled visual observations from SQLite/KG');
    const continuity = unifiedIntelligenceLayerInstance.getPromptContinuityContext('continue building my robotic arm with NEMA17 motor');
    assert(/Shared Visual & Hardware Observations/i.test(continuity), 'Expected continuity context to inject shared visual observations');

    const mmRes = await multimodalReasoningEngineInstance.reasonOverMultimodalInput({
      userQuery: 'Analyze attached actuator schematic',
      attachedFiles: [imgPath],
      includeScreen: false,
      personality: 'JARVIS'
    });
    assert.strictEqual(mmRes.success, true);
    assert(mmRes.findings.ownedNeuralVision.length >= 1, 'Expected owned neural vision result inside multimodal reasoning');
    logSection('SHARED_VISUAL_MEMORY', `Recalled=${recalled.length} visual memories, ContinuityLen=${continuity.length}`);
  });

  await runTest('[REAL_VIDEO_SCREEN_CAMERA] Real MP4 motion delta, non-mock PNG screenshot & honest camera discovery', async () => {
    const vidRes = await videoIntelligenceEngineInstance.analyzeVideo(vidPath);
    assert.strictEqual(vidRes.success, true);
    assert(vidRes.motionSummary && vidRes.motionSummary.maxMotionDeltaPercent > 1.0, `Expected significant temporal motion delta > 1.0%, got ${JSON.stringify(vidRes.motionSummary)}`);
    assert(vidRes.motionSummary.significantChangeCount >= 1, 'Expected at least 1 scene-change timestamp');

    const scrRes = await visionServiceInstance.captureScreen();
    assert.strictEqual(scrRes.success, true, `Screen capture failed: ${scrRes.error}`);
    assert(!scrRes.isMock, 'Screen capture must NOT return mock fallback');
    const b64Str = scrRes.rawBase64 || scrRes.frameBase64 || scrRes.base64 || '';
    assert(b64Str.length > 500, 'Expected genuine desktop PNG base64');

    const camProbe = await cameraIntelligenceEngineInstance.discoverDevices();
    assert.strictEqual(camProbe.success, true);
    assert.strictEqual(camProbe.hardwareProbed, true);
    logSection('REAL_VIDEO_SCREEN_CAMERA', `VideoMaxDelta=${vidRes.motionSummary.maxMotionDeltaPercent}%, ScreenPngB64=${b64Str.length} chars, PhysicalCameras=${camProbe.cameraCount}`);
  });

  await waitForServer();

  await runTest('[REAL_HTTP_AND_PLAYWRIGHT_UI] Live /api/neural/*, /api/chat multimodal & ONE JARVIS UI in browser', async () => {
    const sessRes = await fetch(`${BASE_URL}/api/auth/session`);
    assert.strictEqual(sessRes.status, 200);
    const { token } = await sessRes.json();
    assert(token, 'Expected bearer token from /api/auth/session');

    const stRes = await fetch(`${BASE_URL}/api/neural/status`);
    assert.strictEqual(stRes.status, 200);
    const stData = await stRes.json();
    assert.strictEqual(stData.success, true);
    assert(stData.checkpointCount >= 1);

    const archRes = await fetch(`${BASE_URL}/api/neural/architecture`);
    assert.strictEqual(archRes.status, 200);
    const archData = await archRes.json();
    assert.strictEqual(archData.success, true);
    assert(archData.chosenApproach && /Early-Fusion/i.test(archData.chosenApproach.design));
    assert(archData.componentRoles?.ownedNeuralCore?.role === 'EXPERIMENTAL_LOCAL_SUBSYSTEM');
    assert(archData.hardwareConstraints?.accelerator);

    const benchRes = await fetch(`${BASE_URL}/api/neural/benchmark`);
    assert.strictEqual(benchRes.status, 200);
    const benchData = await benchRes.json();
    assert.strictEqual(benchData.success, true);
    assert(Array.isArray(benchData.measured_presets) && benchData.measured_presets.length >= 2, 'Expected >= 2 measured hardware presets');
    assert(Array.isArray(benchData.scaling_projections) && benchData.scaling_projections.length >= 2, 'Expected scaling projections');

    const imgB64 = fs.readFileSync(imgPath).toString('base64');
    const inferHttp = await fetch(`${BASE_URL}/api/neural/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ prompt: 'Inspect actuator', imageBase64: imgB64 })
    });
    assert.strictEqual(inferHttp.status, 200);
    const inferData = await inferHttp.json();
    assert.strictEqual(inferData.success, true);
    assert(inferData.visionPrediction?.top_category);

    // HTTP audio inference + verified experience distillation checks
    const testWav = path.join(__dirname, '..', 'data', 'neural_models', 'datasets', 'jarvis-v0.6.0', 'audio_samples', 'alert_tone_14.wav');
    if (fs.existsSync(testWav)) {
      const wavB64 = fs.readFileSync(testWav).toString('base64');
      const audHttp = await fetch(`${BASE_URL}/api/neural/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ prompt: 'Inspect acoustic waveform', audioBase64: wavB64 })
      });
      assert.strictEqual(audHttp.status, 200);
      const audData = await audHttp.json();
      assert.strictEqual(audData.success, true);
      assert(audData.audioPrediction?.top_category, 'Expected HTTP audioPrediction from /api/neural/infer');
    }

    const distillHttp = await fetch(`${BASE_URL}/api/neural/distill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ version: 'distilled-test-audit' })
    });
    assert.strictEqual(distillHttp.status, 200);
    const distillData = await distillHttp.json();
    assert.strictEqual(distillData.success, true);
    assert((distillData.counts?.distilled_experiences_count || 0) >= 1, 'Expected distilled verified episodes >= 1');
    assert.strictEqual(distillData.data_processing_audit?.zero_exact_contamination_test, true);

    const chatHttp = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        personality: 'JARVIS',
        message: 'What is the status of your neural foundation brain?',
        attachments: [{ mimeType: 'image/png', data: imgB64 }]
      })
    });
    assert.strictEqual(chatHttp.status, 200);
    const chatData = await chatHttp.json();
    assert(chatData.reply && chatData.reply.length > 20, 'Expected non-empty unified chat reply');

    // Playwright real browser check (if playwright installed)
    let playwrightOk = false;
    try {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1200);
      const bodyText = await page.locator('body').innerText();
      assert(!/STARK AI|LOKESH AI/i.test(bodyText), 'Unexpected legacy branding leaked in main body');
      assert(/VISION/i.test(bodyText) && /JARVIS/i.test(bodyText), 'Expected unified JARVIS powered by VISION branding');
      await browser.close();
      playwrightOk = true;
    } catch (pwErr) {
      if (!/Cannot find module/i.test(pwErr.message)) throw pwErr;
    }
    logSection('REAL_HTTP_AND_PLAYWRIGHT_UI', `NeuralCheckpoints=${stData.checkpointCount}, NeuralTopPred=${inferData.visionPrediction.top_category}, PlaywrightVerified=${playwrightOk}`);
  });

  await runTest('[UNIFIED_REASONING_RAG_AND_GAPS] Code+Docs RAG, 13-step reasoning trace, epistemic tags & hardware gaps', async () => {
    const idxRes = codingAssistantInstance.buildCodebaseRagIndex(true);
    assert.strictEqual(idxRes.success, true);
    const ragNeural = codingAssistantInstance.semanticSearchCodebase('JarvisAudioFeatureEncoder', { topK: 5 });
    assert.strictEqual(ragNeural.success, true);
    assert(ragNeural.matches.some(m => m.file.includes('ml_foundation/model.py') && m.sourceType === 'code'), 'Expected RAG to index ml_foundation/model.py');

    const ragDocs = codingAssistantInstance.semanticSearchCodebase('JARVIS architecture', { topK: 5 });
    assert.strictEqual(ragDocs.success, true);
    assert(ragDocs.matches.length >= 1, 'Expected RAG matches for technical docs / modules');

    const chatTraceRes = await unifiedIntelligenceLayerInstance.processInteraction({
      personality: 'JARVIS',
      message: 'Remember my hardware project constraint: 4-DOF arm uses owned MG996R servos.'
    });
    assert(chatTraceRes.reasoningTrace && chatTraceRes.reasoningTrace.totalSteps === 13, 'Expected explicit 13-step unified reasoning trace');
    assert(Array.isArray(chatTraceRes.epistemicSources) && chatTraceRes.epistemicSources.length >= 1, 'Expected epistemic provenance sources');
    for (const src of chatTraceRes.epistemicSources) {
      assert(Object.values(EPISTEMIC_SOURCES).includes(src), `Unexpected epistemic source ${src}`);
    }

    const gapReport = unifiedIntelligenceLayerInstance.getSystemCapabilitiesAndGaps();
    assert.strictEqual(gapReport.success, true);
    assert(Array.isArray(gapReport.capabilityGaps) && gapReport.capabilityGaps.some(g => g.area === 'compute_accelerator'), 'Expected honest CPU-only compute accelerator gap report');

    const offlineRes = aiAdapterInstance.generateOfflineResponse('JARVIS', 'Explain JarvisAudioFeatureEncoder and neuralBrainService status');
    assert.strictEqual(offlineRes.provider, 'unified_local_intelligence', `Expected offline fallback to query local unified stack, got ${offlineRes.provider}`);
    assert(Array.isArray(offlineRes.localEvidence) && offlineRes.localEvidence.length >= 1, 'Expected grounded local evidence in offline response');
    logSection('UNIFIED_REASONING_RAG_AND_GAPS', `RagFiles=${idxRes.stats.totalFiles}, TraceSteps=${chatTraceRes.reasoningTrace.totalSteps}, Gaps=${gapReport.capabilityGaps.length}, OfflineEvidence=${offlineRes.localEvidence.length}`);
  });

  // Cleanup temp media dir
  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch (_) {}

  console.log(`\n=== UNIFIED NEURAL & VISION SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
})();
