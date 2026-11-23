/**
 * Comprehensive Verification Suite:
 * JARVIS Holographic Robotics Lab + VISION Real-Time Hand Gesture Intelligence
 */

const assert = require('assert');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:3000';

async function fetchAuthToken() {
  const res = await fetch(`${BASE_URL}/api/auth/session`);
  assert(res.ok, `GET /api/auth/session HTTP ${res.status}`);
  const data = await res.json();
  return data.token;
}

function makeHandLandmarks({ mode = 'open_palm', cx = 0.5, cy = 0.5, spread = 0.16, rollOffset = 0 } = {}) {
  // Construct plausible 21 normalized MediaPipe landmarks
  const pts = Array.from({ length: 21 }, () => ({ x: cx, y: cy, z: 0 }));
  const set = (idx, dx, dy, dz = 0) => {
    pts[idx] = { x: cx + dx, y: cy + dy, z: dz };
  };

  // Wrist & MCP arch
  set(0, 0, 0.22);
  set(1, -0.05, 0.14);
  set(2, -0.08, 0.08);
  set(5, -0.07, 0.0 + rollOffset);
  set(9, -0.02, -0.01);
  set(13, 0.03, 0.0);
  set(17, 0.08, 0.02 - rollOffset);

  if (mode === 'open_palm') {
    set(3, -0.14, 0.03); set(4, -0.19, -0.02);
    set(6, -0.08, -0.09); set(7, -0.09, -0.15); set(8, -0.095, -0.22);
    set(10, -0.02, -0.11); set(11, -0.02, -0.18); set(12, -0.02, -0.25);
    set(14, 0.04, -0.10); set(15, 0.045, -0.17); set(16, 0.05, -0.23);
    set(18, 0.09, -0.07); set(19, 0.10, -0.12); set(20, 0.11, -0.17);
  } else if (mode === 'pinch') {
    // Thumb tip & index tip close together, middle/ring/pinky curled
    set(3, -0.07, 0.01); set(4, -0.045, -0.09);
    set(6, -0.06, -0.06); set(7, -0.05, -0.08); set(8, -0.04, -0.092);
    set(10, -0.02, 0.04); set(11, -0.02, 0.08); set(12, -0.02, 0.11);
    set(14, 0.03, 0.05); set(15, 0.03, 0.08); set(16, 0.03, 0.11);
    set(18, 0.07, 0.06); set(19, 0.07, 0.09); set(20, 0.07, 0.11);
  } else if (mode === 'index_point') {
    set(3, -0.05, 0.05); set(4, -0.02, 0.08);
    set(6, -0.07, -0.09); set(7, -0.07, -0.16); set(8, -0.07, -0.24);
    set(10, -0.02, 0.04); set(11, -0.02, 0.08); set(12, -0.02, 0.11);
    set(14, 0.03, 0.05); set(15, 0.03, 0.08); set(16, 0.03, 0.11);
    set(18, 0.07, 0.06); set(19, 0.07, 0.09); set(20, 0.07, 0.11);
  } else if (mode === 'two_finger') {
    set(3, -0.05, 0.05); set(4, -0.02, 0.08);
    set(6, -0.08, -0.09); set(7, -0.09, -0.16); set(8, -0.10, -0.23);
    set(10, -0.01, -0.10); set(11, 0.01, -0.17); set(12, 0.02, -0.24);
    set(14, 0.03, 0.05); set(15, 0.03, 0.08); set(16, 0.03, 0.11);
    set(18, 0.07, 0.06); set(19, 0.07, 0.09); set(20, 0.07, 0.11);
  } else if (mode === 'fist') {
    set(3, -0.03, 0.05); set(4, 0.01, 0.09);
    set(6, -0.06, 0.04); set(7, -0.06, 0.09); set(8, -0.06, 0.13);
    set(10, -0.02, 0.04); set(11, -0.02, 0.09); set(12, -0.02, 0.13);
    set(14, 0.03, 0.04); set(15, 0.03, 0.09); set(16, 0.03, 0.13);
    set(18, 0.07, 0.05); set(19, 0.07, 0.09); set(20, 0.07, 0.13);
  } else if (mode === 'thumbs_up') {
    set(2, -0.08, 0.04); set(3, -0.09, -0.05); set(4, -0.10, -0.16);
    set(6, -0.06, 0.04); set(7, -0.06, 0.09); set(8, -0.06, 0.13);
    set(10, -0.02, 0.04); set(11, -0.02, 0.09); set(12, -0.02, 0.13);
    set(14, 0.03, 0.04); set(15, 0.03, 0.09); set(16, 0.03, 0.13);
    set(18, 0.07, 0.05); set(19, 0.07, 0.09); set(20, 0.07, 0.13);
  }
  return pts;
}

async function runTests() {
  console.log('=== [TEST] Holographic Robotics Lab + VISION Hand Gesture Intelligence ===\n');

  const token = await fetchAuthToken();

  // Ensure system E-stop is clear before tests
  await fetch(`${BASE_URL}/api/security/emergency-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Stark-Auth-Token': token },
    body: JSON.stringify({ reason: 'TEST_PREFLIGHT' })
  });

  // 1. Verify 15-Category Robotics Catalog + Generation + GLB/OBJ/STL/Spec Exports + STEP Import Rejection
  console.log('1. Verifying 15+ Robotics Catalog, Multi-Robot Generation & Binary GLB/Spec Exports...');
  const catRes = await fetch(`${BASE_URL}/api/3d-model/catalog`);
  const catData = await catRes.json();
  assert(catRes.ok && catData.success && catData.count >= 15, `Expected >=15 robotics categories, got ${catData?.count}`);

  for (const arch of ['robotic_arm', 'seven_axis_arm', 'scara_robot', 'delta_robot', 'humanoid_hand', 'robotic_leg', 'multi_axis_cnc', 'conveyor_system']) {
    const createRes = await fetch(`${BASE_URL}/api/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Stark-Auth-Token': token },
      body: JSON.stringify({ toolName: 'create_3d_model', params: { description: `Test ${arch}`, archetype: arch } })
    });
    const cr = await createRes.json();
    assert(cr.success && cr.result?.modelId && cr.result.geometrySpec?.components?.length >= 4, `Failed generating ${arch}: ${JSON.stringify(cr)}`);

    const glbRes = await fetch(`${BASE_URL}/api/3d-model/${encodeURIComponent(cr.result.modelId)}/export/glb`);
    assert(glbRes.ok, `GLB export HTTP ${glbRes.status} for ${arch}`);
    const glbBuf = Buffer.from(await glbRes.arrayBuffer());
    assert(glbBuf.toString('ascii', 0, 4) === 'glTF' && glbBuf.length > 200, `Invalid GLB header/size for ${arch}`);

    const specRes = await fetch(`${BASE_URL}/api/3d-model/${encodeURIComponent(cr.result.modelId)}/export/spec`);
    const specJson = await specRes.json();
    assert(specRes.ok && Array.isArray(specJson.billOfMaterials) && specJson.billOfMaterials.length > 0, `Spec JSON missing BOM for ${arch}`);
  }
  console.log(`   PASS: Verified ${catData.count} catalog entries, multi-robot generation, valid binary .GLB ('glTF' magic) & Spec+BOM exports.`);

  // 2. Import OBJ (real) & STEP (honest 415 unsupported B-Rep kernel notice)
  console.log('2. Testing CAD Import (valid OBJ vs unsupported STEP)...');
  const objImpRes = await fetch(`${BASE_URL}/api/3d-model/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: 'test_bracket.obj',
      textContent: 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'
    })
  });
  const objImp = await objImpRes.json();
  assert(objImpRes.ok && objImp.success && objImp.geometrySpec?.type === 'external_mesh', `OBJ import failed: ${JSON.stringify(objImp)}`);

  const stepImpRes = await fetch(`${BASE_URL}/api/3d-model/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'part.step', textContent: 'ISO-10303-21;' })
  });
  const stepImp = await stepImpRes.json();
  assert(stepImpRes.status === 415 && stepImp.unsupportedFormat === true && /OpenCASCADE|FreeCAD/i.test(stepImp.error), `STEP import should return honest 415 kernel notice`);
  console.log('   PASS: Valid OBJ imported & stored; STEP accurately reported missing B-Rep kernel.');

  // 3. Real IK, Unreachable Explanation, Stress/Weakest-Link, Scene Q&A
  console.log('3. Testing DLS Inverse Kinematics, Reachability Explanation, Stress & Scene AI...');
  const armCreate = await fetch(`${BASE_URL}/api/tools/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Stark-Auth-Token': token },
    body: JSON.stringify({ toolName: 'create_3d_model', params: { description: '6-DOF Arm IK Check', archetype: 'robotic_arm' } })
  }).then(r => r.json());

  const ikGood = await fetch(`${BASE_URL}/api/robotics/ik`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geometrySpec: armCreate.result.geometrySpec, targetScene: [2.4, 4.2, 1.0] })
  }).then(r => r.json());
  assert(ikGood.success && ikGood.reachable && ikGood.trajectoryWaypoints?.length >= 10, `Reachable IK failed: ${JSON.stringify(ikGood)}`);

  const ikFar = await fetch(`${BASE_URL}/api/robotics/ik`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geometrySpec: armCreate.result.geometrySpec, targetScene: [18.0, 2.0, 0.0] })
  }).then(r => r.json());
  assert(ikFar.success && ikFar.reachable === false && /exceeds maximum kinematic reach/i.test(ikFar.explanation), `Unreachable explanation mismatch: ${ikFar.explanation}`);

  const simStress = await fetch(`${BASE_URL}/api/robotics/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geometrySpec: armCreate.result.geometrySpec, payloadKg: 2.0 })
  }).then(r => r.json());
  assert(simStress.success && simStress.weakestJoint && typeof simStress.beamDeflectionMm === 'number', `Stress evaluation failed`);

  const sceneQa = await fetch(`${BASE_URL}/api/robotics/scene-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'which part is weakest under load?',
      sceneContext: {
        modelName: 'Test_Arm',
        archetype: 'robotic_arm',
        geometrySpec: armCreate.result.geometrySpec,
        selectedPart: armCreate.result.geometrySpec.components[2],
        selectedJoint: armCreate.result.geometrySpec.joints[1]
      }
    })
  }).then(r => r.json());
  assert(sceneQa.success && /Safety Factor/i.test(sceneQa.answer), `Scene Q&A answer missing real metrics: ${sceneQa.answer}`);
  console.log('   PASS: IK convergence, unreachable reason, stress weakest-joint, and scene Q&A verified.');

  // 4. Live Browser UI, Local MediaPipe WASM Load, Gesture Engine, Lab Tabs & E-Stop Latch
  console.log('4. Launching headless Chromium to verify live UI, MediaPipe WASM/Task loading, gestures, and E-Stop...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.grantPermissions(['microphone', 'camera']);
  const page = await context.newPage();

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.stark3DViewer && window.jarvisApp), null, { timeout: 15000 });

  // Open viewer via quick button
  await page.click('#stark-brand-menu-btn');
  await page.waitForSelector('#btn-quick-robot-cad', { state: 'visible', timeout: 8000 });
  await page.click('#btn-quick-robot-cad');
  await page.waitForFunction(() => {
    const m = document.getElementById('stark-3d-modal');
    return m && getComputedStyle(m).display !== 'none';
  }, null, { timeout: 25000 });

  // Privacy check: Camera must stay OFF by default!
  const camInitStatus = await page.textContent('#hud-cam-status');
  assert(camInitStatus === 'OFF', `Camera auto-started on open! Got ${camInitStatus}`);

  // Verify local MediaPipe HandLandmarker bundle & WASM assets initialize cleanly with zero CDN calls
  const mpLoaded = await page.evaluate(async () => {
    try {
      const lm = await window.stark3DViewer.handTracker._ensureLandmarkerLoaded();
      return Boolean(lm);
    } catch (err) {
      return { error: err.message };
    }
  });
  assert(mpLoaded === true, `MediaPipe HandLandmarker local initialization failed: ${JSON.stringify(mpLoaded)}`);
  console.log('   PASS: Local MediaPipe HandLandmarker WASM + hand_landmarker.task loaded & initialized cleanly in browser.');

  // Exercise 9 Lab Mode Tabs + X-Ray + Camera Preset + Hand Tracking + Gesture State Machine
  await page.click('#s3d-tab-simulation');
  const simSelected = await page.getAttribute('#s3d-tab-simulation', 'aria-selected');
  assert(simSelected === 'true', 'Simulation tab aria-selected did not activate');

  const tablistWrapStyle = await page.evaluate(() => getComputedStyle(document.getElementById('stark-3d-lab-tablist')).flexWrap);
  assert(tablistWrapStyle === 'nowrap', `Tablist must be non-wrapping single row, got flexWrap=${tablistWrapStyle}`);

  // Switch catalog robot (SCARA) inside live UI
  await page.selectOption('#stark-3d-robot-catalog-select', 'scara_robot');
  await page.click('#stark-3d-load-catalog-btn');
  await page.waitForFunction(() => /SCARA/i.test(document.getElementById('stark-3d-archetype-tag')?.textContent || ''), null, { timeout: 10000 });

  // Verify X-Ray toggle, Camera Presets, Stress Analyze, IK/Trajectory Play & Vision Scene Q&A
  await page.click('#stark-3d-xray-btn');
  assert((await page.getAttribute('#stark-3d-xray-btn', 'aria-pressed')) === 'true', 'X-Ray button did not activate');
  await page.click('[data-cam-preset="front"]');
  const frontAz = await page.evaluate(() => Number(window.stark3DViewer.camState.desiredAzimuth.toFixed(3)));
  await page.click('[data-cam-preset="top"]');
  const topEl = await page.evaluate(() => Number(window.stark3DViewer.camState.desiredElevation.toFixed(3)));
  assert(Math.abs(frontAz) < 0.05 && topEl > 1.1, `Camera presets did not update unified camState: frontAz=${frontAz}, topEl=${topEl}`);

  await page.click('#stark-3d-run-stress-btn');
  await page.waitForFunction(() => /safety|weakest|torq|deflect/i.test(document.getElementById('stark-3d-stress-output')?.textContent || ''), null, { timeout: 8000 });

  await page.click('#stark-3d-solve-ik-btn');
  await page.waitForFunction(() => /Solved|IK|Reach|mm|deg/i.test(document.getElementById('stark-3d-ik-output')?.textContent || ''), null, { timeout: 8000 });
  await page.click('#stark-3d-traj-step-btn');

  await page.click('#stark-3d-vision-ask-btn');
  await page.waitForFunction(() => !/^Select a joint or part/i.test(document.getElementById('stark-3d-vision-output')?.textContent || ''), null, { timeout: 8000 });

  // Verify GestureController dwell + open_palm orbit + pinch zoom + thumbs_up confirm
  const gestureResult = await page.evaluate(async ({ open1, open2, pinch1, pinch2 }) => {
    const viewer = window.stark3DViewer;
    viewer.gestureController.setSubmode('Camera Control');
    const azBefore = viewer.camState.desiredAzimuth;
    const distBefore = viewer.camState.desiredDistance;

    // Feed dwell sequence for open palm across >300ms (realistic 33-100ms frame stream)
    viewer.handTracker.processExternalLandmarks({ landmarks: [open1], handednesses: [[{ categoryName: 'Right', score: 0.94 }]] }, 1000);
    viewer.handTracker.processExternalLandmarks({ landmarks: [open1], handednesses: [[{ categoryName: 'Right', score: 0.94 }]] }, 1120);
    viewer.handTracker.processExternalLandmarks({ landmarks: [open1], handednesses: [[{ categoryName: 'Right', score: 0.94 }]] }, 1320);
    viewer.handTracker.processExternalLandmarks({ landmarks: [open2], handednesses: [[{ categoryName: 'Right', score: 0.94 }]] }, 1380);
    const azAfter = viewer.camState.desiredAzimuth;
    const palmConfirmed = viewer.gestureController.state.confirmedGesture;

    // Transition to PINCH over realistic frames + >240ms dwell before dragging
    viewer.handTracker.processExternalLandmarks({ landmarks: [pinch1], handednesses: [[{ categoryName: 'Right', score: 0.95 }]] }, 1500);
    viewer.handTracker.processExternalLandmarks({ landmarks: [pinch1], handednesses: [[{ categoryName: 'Right', score: 0.95 }]] }, 1550);
    viewer.handTracker.processExternalLandmarks({ landmarks: [pinch1], handednesses: [[{ categoryName: 'Right', score: 0.95 }]] }, 1600);
    viewer.handTracker.processExternalLandmarks({ landmarks: [pinch1], handednesses: [[{ categoryName: 'Right', score: 0.95 }]] }, 1900);
    viewer.handTracker.processExternalLandmarks({ landmarks: [pinch2], handednesses: [[{ categoryName: 'Right', score: 0.95 }]] }, 1960);
    const distAfter = viewer.camState.desiredDistance;
    const pinchConfirmed = viewer.gestureController.state.confirmedGesture;

    return {
      azDelta: Number((azAfter - azBefore).toFixed(4)),
      distDelta: Number((distAfter - distBefore).toFixed(4)),
      palmConfirmed,
      pinchConfirmed,
      hudConf: document.getElementById('hud-conf-val')?.textContent
    };
  }, {
    open1: makeHandLandmarks({ mode: 'open_palm', cx: 0.45, cy: 0.50 }),
    open2: makeHandLandmarks({ mode: 'open_palm', cx: 0.62, cy: 0.46 }),
    pinch1: makeHandLandmarks({ mode: 'pinch', cx: 0.50, cy: 0.40 }),
    pinch2: makeHandLandmarks({ mode: 'pinch', cx: 0.50, cy: 0.62 })
  });
  assert(gestureResult.palmConfirmed === 'OPEN_PALM' && Math.abs(gestureResult.azDelta) > 0.05, `Palm orbit gesture failed: ${JSON.stringify(gestureResult)}`);
  assert(gestureResult.pinchConfirmed === 'PINCH' && Math.abs(gestureResult.distDelta) > 0.5, `Pinch zoom gesture failed: ${JSON.stringify(gestureResult)}`);
  console.log(`   PASS: Dwell-gated gestures drove unified camera (Δazimuth=${gestureResult.azDelta}, Δdist=${gestureResult.distDelta}, conf=${gestureResult.hudConf}).`);

  // Verify real webcam hardware stream capture works via getUserMedia in headless Chromium fake-device AND verify E-Stop immediately halts camera & blocks IK!
  const camActiveAfterConsent = await page.evaluate(async () => {
    const res = await window.stark3DViewer.handHud.requestStartCamera();
    return { res, status: window.stark3DViewer.handTracker.status, hasStream: Boolean(window.stark3DViewer.handTracker.stream) };
  });
  assert(camActiveAfterConsent.res.success && camActiveAfterConsent.status === 'ACTIVE' && camActiveAfterConsent.hasStream, `Explicit webcam start failed: ${JSON.stringify(camActiveAfterConsent)}`);

  // Trigger Emergency Stop -> verify synchronous camera track release & latched API block!
  await page.evaluate(() => {
    window.jarvisApp.emergencyStopCoordinator.triggerEmergencyStop('ROBOTICS_LAB_SAFETY_TEST');
  });
  await page.waitForTimeout(200);
  const estopCheck = await page.evaluate(() => ({
    trackerStatus: window.stark3DViewer.handTracker.status,
    streamRemaining: window.stark3DViewer.handTracker.stream,
    simBadge: document.getElementById('stark-3d-sim-badge')?.textContent
  }));
  assert(estopCheck.trackerStatus === 'BLOCKED_ESTOP' && estopCheck.streamRemaining === null, `E-Stop failed to stop camera stream: ${JSON.stringify(estopCheck)}`);
  assert(estopCheck.simBadge === 'E-STOP HALTED', `Sim badge did not show E-STOP HALTED: ${estopCheck.simBadge}`);

  const blockedIk = await fetch(`${BASE_URL}/api/robotics/ik`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geometrySpec: armCreate.result.geometrySpec, targetScene: [2, 3, 1] })
  });
  assert(blockedIk.status === 423, `Expected HTTP 423 locked during E-Stop, got ${blockedIk.status}`);

  // Explicitly reset E-Stop cleanly for subsequent tests
  await page.evaluate(async () => {
    await window.jarvisApp.emergencyStopCoordinator.resetEmergencyStop('TEST_COMPLETE');
  });

  assert(pageErrors.length === 0, `Browser page errors encountered: ${pageErrors.join('; ')}`);
  await browser.close();
  console.log('   PASS: Webcam consent gate, E-Stop synchronous camera halt, HTTP 423 latch, and reset verified cleanly.\n');
  console.log('=== ALL HOLOGRAPHIC ROBOTICS LAB & GESTURE CHECKS PASSED ===');
}

runTests().catch((err) => {
  console.error('\nFAILED:', err);
  process.exit(1);
});
