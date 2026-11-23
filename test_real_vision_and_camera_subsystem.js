/**
 * STARK AI — Real Eyes, Computer Vision & Visual Awareness Master Test Suite
 * Comprehensive automated verification for:
 * 1. Camera Hardware Discovery & Device Enumeration
 * 2. Camera Lifecycle, Permissions & Emergency Stop Lockout
 * 3. Disconnection, Fault Detection, Obscured Frame Recovery
 * 4. Visual Understanding, Engineering Inspection & Frame Comparison
 * 5. Digital Brain Subsystem & Real Telemetry Bus
 * 6. Natural Language Voice/Text Conversation Intent Routing
 * 7. Voice Pipeline Decoupling & Offline Fallback Reliability
 * 8. HTTP REST API Gateway Endpoints
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const { visionServiceInstance, VisionService } = require('./server/visionService.js');
const { executeTool } = require('./server/toolsRegistry.js');
const { commandInterpreterInstance } = require('./server/commandInterpreter.js');
const { aiAdapterInstance } = require('./server/aiProviderAdapter.js');
const brainArchitectureEngine = require('./server/brainArchitectureEngine.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');

let passCount = 0;
let failCount = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ PASSED: ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${description}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

async function testAsync(description, fn) {
  try {
    await fn();
    console.log(`  ✓ PASSED: ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${description}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

async function httpPost(urlPath, payload) {
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:3000${urlPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP request timeout')); });
    req.write(data);
    req.end();
  });
}

async function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:3000${urlPath}`, {
      method: 'GET',
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP request timeout')); });
    req.end();
  });
}

// 1x1 base64 mock image frames
const VALID_FRAME_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const OBSCURED_BLACK_FRAME = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function runAllTests() {
  console.log('\n================================================================');
  console.log('👁️ STARK AI: REAL EYES & COMPUTER VISION SUBSYSTEM TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // 1. CAMERA HARDWARE DISCOVERY & ENUMERATION
  // -------------------------------------------------------------------------
  console.log('--- Suite 1: Camera Hardware Discovery & Device Enumeration ---');

  test('1.1 VisionService discovers available cameras and default integrated webcam', () => {
    const report = visionServiceInstance.getConnectedHardwareReport();
    assert(report.success, 'Expected report.success to be true');
    assert(Array.isArray(report.hardware.cameras), 'Expected cameras array');
    assert(report.hardware.cameras.length >= 1, 'Expected at least 1 camera');
    assert(report.hardware.cameras[0].label.includes('Webcam') || report.hardware.cameras[0].id, 'Expected webcam device');
  });

  await testAsync('1.2 get_camera_devices tool execution via central tools registry', async () => {
    const result = await executeTool('get_camera_devices', {}, 'JARVIS');
    assert(result.success, 'Expected tool execution to succeed');
    assert(result.hardware.cameras.length >= 1, 'Expected camera devices in tool result');
  });

  // -------------------------------------------------------------------------
  // 2. CAMERA LIFECYCLE, PERMISSIONS & EMERGENCY STOP LOCKOUT
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 2: Camera Lifecycle, Permissions & Emergency Stop ---');

  test('2.1 Camera start updates active status and permission to granted', () => {
    const res = visionServiceInstance.notifyCameraState({
      state: 'STARTED',
      deviceId: 'integrated_cam_0',
      label: 'Integrated HD Webcam'
    });
    assert(res.success, 'Expected success');
    assert.strictEqual(res.cameraState.active, true, 'Expected camera active');
    assert.strictEqual(res.cameraState.permission, 'granted', 'Expected permission granted');
  });

  test('2.2 Camera stop cleanly releases active status', () => {
    const res = visionServiceInstance.notifyCameraState({ state: 'STOPPED' });
    assert(res.success, 'Expected success');
    assert.strictEqual(res.cameraState.active, false, 'Expected camera inactive');
  });

  test('2.3 Multiple disable and re-enable cycles execute reliably', () => {
    for (let i = 0; i < 3; i++) {
      visionServiceInstance.notifyCameraState({ state: 'STARTED', deviceId: `cam_cycle_${i}` });
      assert.strictEqual(visionServiceInstance.cameraState.active, true);
      visionServiceInstance.notifyCameraState({ state: 'STOPPED' });
      assert.strictEqual(visionServiceInstance.cameraState.active, false);
    }
  });

  test('2.4 Emergency stop terminates active capture immediately and engages lockout', () => {
    visionServiceInstance.notifyCameraState({ state: 'STARTED', deviceId: 'test_cam' });
    assert.strictEqual(visionServiceInstance.cameraState.active, true);

    const stopRes = visionServiceInstance.handleEmergencyStop('Unit Test Emergency Stop');
    assert(stopRes.success, 'Expected emergency stop to succeed');
    assert.strictEqual(stopRes.cameraState.active, false, 'Expected active to be false');
    assert.strictEqual(stopRes.cameraState.isLockedEmergencyStop, true, 'Expected lock engaged');
  });

  test('2.5 Camera activation while Emergency Stop locked is strictly rejected', () => {
    assert.throws(() => {
      visionServiceInstance.notifyCameraState({ state: 'STARTED', deviceId: 'test_cam' });
    }, /Emergency Stop lock/i, 'Expected error blocking activation during emergency stop');
  });

  test('2.6 Resetting Emergency Stop allows normal camera activation', () => {
    const resetRes = visionServiceInstance.resetEmergencyStop();
    assert(resetRes.success, 'Expected reset success');
    assert.strictEqual(visionServiceInstance.cameraState.isLockedEmergencyStop, false);

    const startRes = visionServiceInstance.notifyCameraState({ state: 'STARTED', deviceId: 'test_cam_recovered' });
    assert.strictEqual(startRes.cameraState.active, true, 'Camera should now start cleanly');
    visionServiceInstance.notifyCameraState({ state: 'STOPPED' });
  });

  test('2.7 Permission denied state updates status truthfully', () => {
    const res = visionServiceInstance.notifyCameraState({ state: 'PERMISSION_DENIED' });
    assert.strictEqual(res.cameraState.permission, 'denied');
    assert.strictEqual(res.cameraState.active, false);
  });

  // -------------------------------------------------------------------------
  // 3. FAULT DETECTION, DISCONNECTION & RECOVERY
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 3: Fault Detection, Disconnection & Recovery ---');

  test('3.1 Camera disconnection records disconnected state and error message', () => {
    const res = visionServiceInstance.notifyCameraState({
      state: 'DISCONNECTED',
      error: 'USB Camera unplugged unexpectedly'
    });
    assert.strictEqual(res.cameraState.active, false);
    assert.strictEqual(res.cameraState.error, 'USB Camera unplugged unexpectedly');
  });

  test('3.2 Camera recovery clears disconnection fault', () => {
    const res = visionServiceInstance.notifyCameraState({
      state: 'RECOVERED',
      deviceId: 'integrated_cam_0'
    });
    assert.strictEqual(res.cameraState.error, null);
  });

  await testAsync('3.3 Empty or invalid frames throw clean validation errors', async () => {
    await assert.rejects(
      async () => visionServiceInstance.analyzeImage(null),
      /non-empty string/i
    );
    await assert.rejects(
      async () => visionServiceInstance.analyzeImage(''),
      /non-empty string/i
    );
    await assert.rejects(
      async () => visionServiceInstance.analyzeImage('corrupt_short'),
      /too small or corrupted/i
    );
  });

  await testAsync('3.4 Poor lighting / covered camera detection warns user without hallucinating', async () => {
    const res = await visionServiceInstance.analyzeImage(OBSCURED_BLACK_FRAME, 'Can you see me?', 'JARVIS');
    assert(res.success, 'Expected success response with warning');
    assert(res.isObscured, 'Expected isObscured to be true');
    assert(/pitch dark|covered|obscured|shutter/i.test(res.analysis), 'Expected covered/dark warning in analysis');
  });

  // -------------------------------------------------------------------------
  // 4. VISUAL UNDERSTANDING, ENGINEERING & FRAME COMPARISON
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 4: Visual Understanding, Engineering & Comparison ---');

  await testAsync('4.1 analyzeCameraImage returns structured observations', async () => {
    const res = await visionServiceInstance.analyzeCameraImage({
      imageBase64: VALID_FRAME_BASE64,
      prompt: 'What can you see in front of you?'
    });
    assert(res.success, 'Expected analyzeCameraImage success');
    assert(typeof res.analysis === 'string' && res.analysis.length > 0, 'Expected analysis text');
    assert(res.provider, 'Expected provider identifier');
  });

  await testAsync('4.2 inspectEngineeringComponent enforces uncalibrated measurement disclaimer', async () => {
    const res = await visionServiceInstance.inspectEngineeringComponent({
      imageBase64: VALID_FRAME_BASE64,
      prompt: 'Look at this robot arm link and measure its length.',
      componentType: 'robotics',
      personality: 'JARVIS'
    });
    assert(res.success, 'Expected success');
    assert(/visual estimate|calibrated|calipers|reference scale|uncalibrated/i.test(res.analysis),
      'Must distinguish visual estimates from calibrated physical measurements');
    assert(res.measurementDisclaimer, 'Expected measurementDisclaimer property');
  });

  await testAsync('4.3 inspectEngineeringComponent enforces physical machine safety disclaimer', async () => {
    const res = await visionServiceInstance.inspectEngineeringComponent({
      imageBase64: VALID_FRAME_BASE64,
      prompt: 'Is this high-voltage circuit board safe to turn on?',
      componentType: 'circuit',
      personality: 'JARVIS'
    });
    assert(res.success, 'Expected success');
    assert(/safe|bench test|grounding|load testing|safety/i.test(res.analysis),
      'Must disclaim machine/electrical safety based purely on visual inspection');
    assert(res.safetyDisclaimer, 'Expected safetyDisclaimer property');
  });

  await testAsync('4.4 compareFrames computes temporal differences between successive captures', async () => {
    const frame1 = VALID_FRAME_BASE64;
    const frame2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const res = await visionServiceInstance.compareFrames({
      frame1Base64: frame1,
      frame2Base64: frame2,
      prompt: 'Compare these two frames.',
      personality: 'JARVIS'
    });
    assert(res.success, 'Expected comparison success');
    assert(typeof res.analysis === 'string' && res.analysis.length > 0, 'Expected comparison text');
    assert(res.provider, 'Expected provider identifier');
  });

  await testAsync('4.5 readScreenText OCR extracts visible text', async () => {
    const res = await visionServiceInstance.readScreenText({
      imageBase64: VALID_FRAME_BASE64,
      prompt: 'Read the text on this page.'
    });
    assert(res.success, 'Expected OCR success');
    assert(typeof res.extractedText === 'string', 'Expected extractedText');
  });

  // -------------------------------------------------------------------------
  // 5. DIGITAL BRAIN INTEGRATION & TELEMETRY BUS
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 5: Digital Brain Integration & Telemetry Bus ---');

  test('5.1 sub_vision_sensors exists in Brain Architecture at Occipital Lobe', () => {
    const sub = brainArchitectureEngine.getSubsystemById('sub_vision_sensors');
    assert(sub, 'Expected sub_vision_sensors subsystem');
    assert.strictEqual(sub.category, 'PERCEPTION');
    assert(sub.anatomicalRegion.includes('Occipital Lobe'), 'Expected Occipital Lobe');
    assert.strictEqual(sub.filePath, 'server/visionService.js');
  });

  test('5.2 Real vision events are broadcast to the Digital Brain telemetry bus', () => {
    visionServiceInstance.broadcastTelemetry('sub_conversation', 'CAMERA_STARTED', {
      deviceId: 'cam_verify',
      label: 'Integrated HD Webcam'
    });

    const recent = brainArchitectureEngine.getRecentTelemetry(10);
    const camEvt = recent.find(e => e.eventType === 'CAMERA_STARTED');
    assert(camEvt, 'Expected CAMERA_STARTED event in brain telemetry ring buffer');
    assert.strictEqual(camEvt.source, 'sub_vision_sensors');
    assert.strictEqual(camEvt.isRealTelemetry, true);
  });

  // -------------------------------------------------------------------------
  // 6. NATURAL VOICE & VISUAL CONVERSATION INTENT ROUTING
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 6: Natural Voice & Visual Conversation Routing ---');

  test('6.1 "JARVIS, can you see me?" maps to analyze_camera_image', () => {
    const match = commandInterpreterInstance.matchCommand('JARVIS, can you see me?');
    assert(match.matched, 'Expected command match');
    assert.strictEqual(match.toolName, 'analyze_camera_image');
  });

  test('6.2 "What can you see in front of you?" maps to analyze_camera_image', () => {
    const match = commandInterpreterInstance.matchCommand('What can you see in front of you?');
    assert(match.matched, 'Expected command match');
    assert.strictEqual(match.toolName, 'analyze_camera_image');
  });

  test('6.3 "Read the text on this page" maps to read_screen_text', () => {
    const match = commandInterpreterInstance.matchCommand('Read the text on this page');
    assert(match.matched, 'Expected command match');
    assert.strictEqual(match.toolName, 'read_screen_text');
  });

  test('6.4 "Look at this component and explain what it does" maps to inspect_engineering_component', () => {
    const match = commandInterpreterInstance.matchCommand('Look at this component and explain what it does');
    assert(match.matched, 'Expected command match');
    assert.strictEqual(match.toolName, 'inspect_engineering_component');
  });

  test('6.5 "Help me troubleshoot this device" maps to inspect_engineering_component', () => {
    const match = commandInterpreterInstance.matchCommand('Help me troubleshoot this device');
    assert(match.matched, 'Expected command match');
    assert.strictEqual(match.toolName, 'inspect_engineering_component');
    assert.strictEqual(match.args.componentType, 'circuit');
  });

  test('6.6 "Compare these two components" maps to compare_visual_frames', () => {
    const match = commandInterpreterInstance.matchCommand('Compare these two components');
    assert(match.matched, 'Expected command match');
    assert.strictEqual(match.toolName, 'compare_visual_frames');
  });

  test('6.7 "Start camera" and "Stop camera" map to set_camera_stream_state', () => {
    const matchStart = commandInterpreterInstance.matchCommand('Start camera');
    assert(matchStart.matched, 'Expected match');
    assert.strictEqual(matchStart.toolName, 'set_camera_stream_state');
    assert.strictEqual(matchStart.args.state, 'STARTED');

    const matchStop = commandInterpreterInstance.matchCommand('Stop camera');
    assert(matchStop.matched, 'Expected match');
    assert.strictEqual(matchStop.toolName, 'set_camera_stream_state');
    assert.strictEqual(matchStop.args.state, 'STOPPED');
  });

  // -------------------------------------------------------------------------
  // 7. VOICE PIPELINE DECOUPLING & OFFLINE RELIABILITY
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 7: Voice Pipeline Decoupling & Offline Reliability ---');

  await testAsync('7.1 AI adapter generates response with vision tool execution in offline mode', async () => {
    const res = await aiAdapterInstance.generateResponse('JARVIS', 'What is on my desk?');
    assert(res, 'Expected response');
    assert(res.reply && res.reply.length > 0, 'Expected non-empty reply');
    assert(res.toolResult, 'Expected toolResult attached');
    assert.strictEqual(res.toolResult.toolName, 'analyze_desk_workspace');
  });

  test('7.2 Permission gate enforces JARVIS-only restriction on camera hardware', () => {
    assert.doesNotThrow(() => {
      permissionGateInstance.authorizeToolExecution('capture_camera_snapshot', {}, 'JARVIS');
    });
    assert.throws(() => {
      permissionGateInstance.authorizeToolExecution('capture_camera_snapshot', {}, 'ULTRON');
    }, /Security Violation|prohibited|permission denied/i);
  });

  // -------------------------------------------------------------------------
  // 8. BACKEND HTTP REST API GATEWAY ENDPOINTS
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 8: HTTP REST API Gateway Endpoints ---');

  await testAsync('8.1 GET /api/vision/status returns vision and camera state', async () => {
    const res = await httpGet('/api/vision/status');
    assert.strictEqual(res.status, 200);
    assert(res.json.success, 'Expected success true');
    const provider = res.json.status?.provider || res.json.provider;
    assert(provider, 'Expected provider');
    const camera = res.json.status?.camera || res.json.camera;
    assert(camera, 'Expected camera state in status');
  });

  await testAsync('8.2 GET /api/vision/devices returns hardware report', async () => {
    const res = await httpGet('/api/vision/devices');
    assert.strictEqual(res.status, 200);
    assert(res.json.success, 'Expected success true');
    assert(Array.isArray(res.json.hardware.cameras), 'Expected cameras array');
  });

  await testAsync('8.3 POST /api/vision/camera-state updates camera state', async () => {
    const res = await httpPost('/api/vision/camera-state', {
      state: 'STARTED',
      deviceId: 'api_test_cam',
      label: 'Integrated HD Webcam'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.cameraState.active, true);

    // Stop it
    const resStop = await httpPost('/api/vision/camera-state', { state: 'STOPPED' });
    assert.strictEqual(resStop.status, 200);
    assert.strictEqual(resStop.json.cameraState.active, false);
  });

  await testAsync('8.4 POST /api/vision/analyze processes visual frames', async () => {
    const res = await httpPost('/api/vision/analyze', {
      imageBase64: VALID_FRAME_BASE64,
      prompt: 'What do you see?',
      personality: 'JARVIS'
    });
    assert.strictEqual(res.status, 200);
    assert(res.json.success, 'Expected success');
    assert(res.json.summary, 'Expected summary');
  });

  await testAsync('8.5 POST /api/vision/engineering-inspect performs component inspection with disclaimers', async () => {
    const res = await httpPost('/api/vision/engineering-inspect', {
      imageBase64: VALID_FRAME_BASE64,
      prompt: 'Inspect this motor bracket.',
      componentType: 'mechanical'
    });
    assert.strictEqual(res.status, 200);
    assert(res.json.success, 'Expected success');
    assert(/visual estimate|calibrated|calipers|reference scale|uncalibrated/i.test(res.json.analysis), 'Expected measurement disclaimer');
    assert(/safe|bench test|grounding|load testing|safety/i.test(res.json.analysis), 'Expected safety disclaimer');
  });

  await testAsync('8.6 POST /api/vision/compare executes multi-frame comparison', async () => {
    const res = await httpPost('/api/vision/compare', {
      frame1Base64: VALID_FRAME_BASE64,
      frame2Base64: VALID_FRAME_BASE64,
      prompt: 'Compare frames.'
    });
    assert.strictEqual(res.status, 200);
    assert(res.json.success, 'Expected success');
    assert(res.json.analysis, 'Expected analysis');
  });

  await testAsync('8.7 POST /api/security/emergency-stop halts camera and engages lockout', async () => {
    // Start camera first
    await httpPost('/api/vision/camera-state', { state: 'STARTED', deviceId: 'cam_stop_test' });

    // Execute emergency stop
    const res = await httpPost('/api/security/emergency-stop', { reason: 'Test Emergency Stop' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.cameraState.active, false);
    assert.strictEqual(res.json.cameraState.isLockedEmergencyStop, true);

    // Reset lock
    const resetRes = await httpPost('/api/security/emergency-stop-reset', {});
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.json.cameraState.isLockedEmergencyStop, false);
  });

  // -------------------------------------------------------------------------
  // FINAL SCORECARD
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`FINAL RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
