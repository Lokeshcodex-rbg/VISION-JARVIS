/**
 * VISION AI — Real-Time Webcam Hand Tracking Engine (21 Landmarks, Two-Hand)
 * Owned by JARVIS — POWERED BY VISION (MADE BY LOKESH).
 *
 * Uses local MediaPipe Tasks Vision (`vision_bundle.mjs` + `hand_landmarker.task`)
 * hosted on 127.0.0.1 with zero external network streaming, explicit user consent gating,
 * One-Euro adaptive tremor smoothing, ambient low-light check, and strict E-Stop halt.
 */

const MEDIAPIPE_BUNDLE_URL = '/js/libs/mediapipe/vision_bundle.mjs';
const MEDIAPIPE_WASM_DIR = '/js/libs/mediapipe';
const HAND_MODEL_URL = '/js/libs/mediapipe/hand_landmarker.task';

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [5, 9], [9, 13], [13, 17]             // Palm arch
];

class OneEuroPointFilter {
  constructor(minCutoff = 1.8, beta = 0.85, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.prev = null;
    this.prevD = [0, 0, 0];
    this.lastTime = null;
  }

  _alpha(cutoff, dt) {
    const r = 2 * Math.PI * cutoff * Math.max(0.001, dt);
    return r / (r + 1);
  }

  filter(pt, nowMs) {
    if (!this.prev || !this.lastTime) {
      this.prev = [pt.x, pt.y, pt.z || 0];
      this.lastTime = nowMs;
      return { x: pt.x, y: pt.y, z: pt.z || 0 };
    }
    const dt = Math.max(0.008, Math.min(0.2, (nowMs - this.lastTime) / 1000));
    this.lastTime = nowMs;
    const raw = [pt.x, pt.y, pt.z || 0];
    const ad = this._alpha(this.dCutoff, dt);
    const out = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const dx = (raw[i] - this.prev[i]) / dt;
      const edx = ad * dx + (1 - ad) * this.prevD[i];
      this.prevD[i] = edx;
      const cutoff = this.minCutoff + this.beta * Math.abs(edx);
      const a = this._alpha(cutoff, dt);
      out[i] = a * raw[i] + (1 - a) * this.prev[i];
    }
    this.prev = out;
    return { x: out[0], y: out[1], z: out[2] };
  }

  reset() {
    this.prev = null;
    this.prevD = [0, 0, 0];
    this.lastTime = null;
  }
}

export class HandTrackingEngine {
  constructor(options = {}) {
    this.onFrameUpdate = options.onFrameUpdate || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.isEmergencyStopActive = options.isEmergencyStopActive || (() => false);

    this.status = 'STOPPED'; // STOPPED | INITIALIZING | ACTIVE | PAUSED | ERROR | BLOCKED_ESTOP
    this.errorMessage = '';
    this.stream = null;
    this.videoEl = null;
    this.landmarker = null;
    this._loadingPromise = null;
    this._rafId = null;
    this._running = false;
    this._paused = false;
    this._lastVideoTime = -1;
    this._lastInferTimeMs = 0;
    this.minIntervalMs = 30; // ~33 FPS ceiling to leave CPU/GPU headroom for 3D + voice

    this._filters = {
      Left: Array.from({ length: 21 }, () => new OneEuroPointFilter()),
      Right: Array.from({ length: 21 }, () => new OneEuroPointFilter())
    };
    this._lastSeenHand = { Left: 0, Right: 0 };
    this._lastGoodHand = { Left: null, Right: null };
    this.recoveryGraceMs = 340;

    this._lumaCanvas = null;
    this._lumaCtx = null;
    this._lastLumaCheckMs = 0;
    this.ambientLuminance = 128;
    this.lowLightWarning = false;

    this.metrics = {
      fps: 0,
      latencyMs: 0,
      framesProcessed: 0,
      handsCount: 0,
      lowLight: false
    };
    this._fpsWindow = [];
  }

  _setStatus(status, extra = {}) {
    this.status = status;
    this.onStatusChange({ status, errorMessage: this.errorMessage, metrics: this.metrics, ...extra });
  }

  async _ensureLandmarkerLoaded() {
    if (this.landmarker) return this.landmarker;
    if (this._loadingPromise) return this._loadingPromise;

    this._loadingPromise = (async () => {
      const mod = await import(MEDIAPIPE_BUNDLE_URL);
      const { FilesetResolver, HandLandmarker } = mod;
      if (!FilesetResolver || !HandLandmarker) {
        throw new Error('MediaPipe HandLandmarker exports unavailable in local bundle.');
      }
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_DIR);
      const commonOpts = {
        baseOptions: {
          modelAssetPath: HAND_MODEL_URL,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55
      };
      try {
        this.landmarker = await HandLandmarker.createFromOptions(vision, commonOpts);
      } catch (gpuErr) {
        // Clean CPU delegate fallback on headless / SwiftShader / restricted GPUs
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          ...commonOpts,
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'CPU' }
        });
      }
      return this.landmarker;
    })();

    try {
      return await this._loadingPromise;
    } catch (err) {
      this._loadingPromise = null;
      throw err;
    }
  }

  /**
   * Explicitly starts webcam hand tracking AFTER user consent. Never called on boot.
   */
  async start(videoElement, options = {}) {
    if (this.isEmergencyStopActive()) {
      this.errorMessage = 'Emergency Stop is active. Reset E-Stop before starting hand tracking camera.';
      this._setStatus('BLOCKED_ESTOP');
      return { success: false, blockedByEstop: true, error: this.errorMessage };
    }
    if (!videoElement) {
      return { success: false, error: 'Video element reference missing.' };
    }
    this.videoEl = videoElement;
    this.errorMessage = '';
    this._paused = false;
    this._setStatus('INITIALIZING');

    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new Error('Browser MediaDevices getUserMedia API is unavailable in this context.');
      }

      const constraints = {
        audio: false,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        }
      };
      if (options.deviceId) {
        constraints.video.deviceId = { exact: options.deviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.isEmergencyStopActive()) {
        stream.getTracks().forEach(t => t.stop());
        this._setStatus('BLOCKED_ESTOP');
        return { success: false, blockedByEstop: true };
      }

      this.stream = stream;
      this.videoEl.srcObject = stream;
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;

      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => {
          this.errorMessage = 'Webcam hardware disconnected.';
          this.stop('HARDWARE_DISCONNECTED');
        });
      }

      await this.videoEl.play().catch(() => {});
      await this._ensureLandmarkerLoaded();

      this._running = true;
      this._lastVideoTime = -1;
      this._notifyBackendCamera('STARTED');
      this._setStatus('ACTIVE');
      this._scheduleNextFrame();
      return { success: true };
    } catch (err) {
      this.errorMessage = err.message || 'Camera permission denied or webcam unavailable.';
      this.stop('START_ERROR');
      this._setStatus('ERROR');
      return { success: false, error: this.errorMessage };
    }
  }

  pause() {
    if (!this._running && this.status !== 'ACTIVE') return;
    this._paused = true;
    this._notifyBackendCamera('PAUSED');
    this._setStatus('PAUSED');
  }

  resume() {
    if (this.isEmergencyStopActive()) {
      this._setStatus('BLOCKED_ESTOP');
      return false;
    }
    if (!this.stream) return false;
    this._paused = false;
    this._running = true;
    this._notifyBackendCamera('STARTED');
    this._setStatus('ACTIVE');
    this._scheduleNextFrame();
    return true;
  }

  stop(reason = 'USER_STOP') {
    this._running = false;
    this._paused = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(t => t.stop());
      } catch (_) {}
      this.stream = null;
    }
    if (this.videoEl) {
      try {
        this.videoEl.pause();
        this.videoEl.srcObject = null;
      } catch (_) {}
    }
    this._filters.Left.forEach(f => f.reset());
    this._filters.Right.forEach(f => f.reset());
    this._lastGoodHand = { Left: null, Right: null };
    this.metrics.handsCount = 0;
    this.metrics.fps = 0;
    this._notifyBackendCamera(reason === 'EMERGENCY_STOP' ? 'EMERGENCY_STOP_HALT' : 'STOPPED');
    this._setStatus(reason === 'EMERGENCY_STOP' ? 'BLOCKED_ESTOP' : 'STOPPED');
    this.onFrameUpdate({ timestampMs: performance.now(), hands: [], metrics: this.metrics });
  }

  onEmergencyStop() {
    this.errorMessage = 'Halted by JARVIS Emergency Stop.';
    this.stop('EMERGENCY_STOP');
  }

  _notifyBackendCamera(state) {
    try {
      fetch('/api/vision/camera-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, consentGranted: state === 'STARTED', source: 'robotics_hand_tracking' })
      }).catch(() => {});
    } catch (_) {}
  }

  _scheduleNextFrame() {
    if (!this._running) return;
    this._rafId = requestAnimationFrame((ts) => this._tick(ts));
  }

  _sampleAmbientLuminance(video) {
    try {
      if (!this._lumaCanvas) {
        this._lumaCanvas = document.createElement('canvas');
        this._lumaCanvas.width = 16;
        this._lumaCanvas.height = 12;
        this._lumaCtx = this._lumaCanvas.getContext('2d', { willReadFrequently: true });
      }
      this._lumaCtx.drawImage(video, 0, 0, 16, 12);
      const data = this._lumaCtx.getImageData(0, 0, 16, 12).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avg = sum / (16 * 12);
      this.ambientLuminance = Math.round(avg);
      this.lowLightWarning = avg < 42;
      this.metrics.lowLight = this.lowLightWarning;
    } catch (_) {}
  }

  _tick(nowMs) {
    if (!this._running) return;
    this._scheduleNextFrame();

    if (this.isEmergencyStopActive()) {
      this.onEmergencyStop();
      return;
    }
    if (this._paused || !this.videoEl || this.videoEl.readyState < 2 || !this.landmarker) return;
    if (nowMs - this._lastInferTimeMs < this.minIntervalMs) return;
    if (this.videoEl.currentTime === this._lastVideoTime) return;

    this._lastVideoTime = this.videoEl.currentTime;
    this._lastInferTimeMs = nowMs;

    if (nowMs - this._lastLumaCheckMs > 600) {
      this._lastLumaCheckMs = nowMs;
      this._sampleAmbientLuminance(this.videoEl);
    }

    const t0 = performance.now();
    let result = null;
    try {
      result = this.landmarker.detectForVideo(this.videoEl, t0);
    } catch (err) {
      return;
    }
    const inferMs = performance.now() - t0;
    this._emitProcessedDetection(result, nowMs, inferMs);
  }

  /**
   * Processes either live MediaPipe detection result OR test landmarks through the exact
   * same One-Euro smoother, feature extractor, and grace recovery pipeline.
   */
  processExternalLandmarks(result, nowMs = performance.now()) {
    this._emitProcessedDetection(result, nowMs, 2.0);
  }

  _emitProcessedDetection(result, nowMs, inferMs) {
    const rawLandmarks = result?.landmarks || [];
    const handednesses = result?.handednesses || result?.handedness || [];
    const worldLandmarks = result?.worldLandmarks || [];

    const activeHands = [];
    const seenKeys = new Set();

    for (let i = 0; i < rawLandmarks.length; i++) {
      const lm = rawLandmarks[i];
      if (!Array.isArray(lm) || lm.length < 21) continue;
      const hInfo = handednesses[i]?.[0];
      const side = (hInfo?.categoryName === 'Left' || hInfo?.categoryName === 'Right') ? hInfo.categoryName : (i === 0 ? 'Right' : 'Left');
      const score = Number(hInfo?.score ?? 0.9);
      seenKeys.add(side);
      this._lastSeenHand[side] = nowMs;

      const filterArr = this._filters[side];
      const smoothed = lm.map((p, idx) => filterArr[idx].filter(p, nowMs));
      const features = this._extractHandFeatures(smoothed, side, score, worldLandmarks[i] || null);
      this._lastGoodHand[side] = features;
      activeHands.push(features);
    }

    // Brief occlusion/tracking-loss grace hold without triggering stale ghosts
    for (const side of ['Left', 'Right']) {
      if (!seenKeys.has(side) && this._lastGoodHand[side]) {
        if (nowMs - this._lastSeenHand[side] <= this.recoveryGraceMs) {
          activeHands.push({ ...this._lastGoodHand[side], recoveredHold: true, confidence: Math.max(0.4, this._lastGoodHand[side].confidence * 0.8) });
        } else {
          this._lastGoodHand[side] = null;
          this._filters[side].forEach(f => f.reset());
        }
      }
    }

    this._fpsWindow.push(nowMs);
    this._fpsWindow = this._fpsWindow.filter(t => nowMs - t <= 1000);
    this.metrics = {
      fps: this._fpsWindow.length,
      latencyMs: Number(inferMs.toFixed(1)),
      framesProcessed: (this.metrics.framesProcessed || 0) + 1,
      handsCount: activeHands.length,
      lowLight: this.lowLightWarning,
      ambientLuminance: this.ambientLuminance
    };

    this.onFrameUpdate({ timestampMs: nowMs, hands: activeHands, metrics: this.metrics });
  }

  _dist2D(a, b) {
    return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
  }

  _extractHandFeatures(lm, handedness, confidence, worldLm) {
    const wrist = lm[0];
    const thumbCmc = lm[1], thumbMcp = lm[2], thumbIp = lm[3], thumbTip = lm[4];
    const indexMcp = lm[5], indexPip = lm[6], indexTip = lm[8];
    const middleMcp = lm[9], middlePip = lm[10], middleTip = lm[12];
    const ringMcp = lm[13], ringPip = lm[14], ringTip = lm[16];
    const pinkyMcp = lm[17], pinkyPip = lm[18], pinkyTip = lm[20];

    const palmWidth = Math.max(0.035, this._dist2D(indexMcp, pinkyMcp));
    const palmHeight = Math.max(0.035, this._dist2D(wrist, middleMcp));
    const palmScale = (palmWidth + palmHeight) * 0.5;

    const palmCenter = {
      x: (wrist.x + indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 5,
      y: (wrist.y + indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 5,
      z: (wrist.z + indexMcp.z + middleMcp.z + ringMcp.z + pinkyMcp.z) / 5
    };

    const pinchRaw = this._dist2D(thumbTip, indexTip);
    const pinchRatio = pinchRaw / palmScale;
    const wristRollRad = Math.atan2(pinkyMcp.y - indexMcp.y, pinkyMcp.x - indexMcp.x);

    const isFingerExtended = (mcp, pip, tip) => {
      const tipDist = this._dist2D(wrist, tip);
      const pipDist = this._dist2D(wrist, pip);
      const mcpDist = this._dist2D(wrist, mcp);
      return tipDist > pipDist * 1.07 && tipDist > mcpDist * 1.16;
    };

    const thumbExtended = this._dist2D(thumbTip, pinkyMcp) > palmWidth * 1.12 && this._dist2D(thumbTip, thumbMcp) > palmWidth * 0.55;
    const indexExtended = isFingerExtended(indexMcp, indexPip, indexTip);
    const middleExtended = isFingerExtended(middleMcp, middlePip, middleTip);
    const ringExtended = isFingerExtended(ringMcp, ringPip, ringTip);
    const pinkyExtended = isFingerExtended(pinkyMcp, pinkyPip, pinkyTip);

    // Thumb direction up/down check when other 4 fingers are curled
    const thumbDy = thumbTip.y - thumbCmc.y; // negative is pointing up in image coords
    const fingersCurled = !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
    const isThumbsUp = fingersCurled && thumbDy < -palmScale * 0.55 && thumbExtended;
    const isThumbsDown = fingersCurled && thumbDy > palmScale * 0.45 && thumbExtended;

    return {
      handedness,
      confidence: Number(confidence.toFixed(3)),
      landmarks: lm,
      worldLandmarks: worldLm,
      palmCenter,
      palmScale,
      pinchRatio: Number(pinchRatio.toFixed(3)),
      wristRollRad: Number(wristRollRad.toFixed(3)),
      indexTip: { x: indexTip.x, y: indexTip.y, z: indexTip.z },
      thumbTip: { x: thumbTip.x, y: thumbTip.y, z: thumbTip.z },
      fingers: {
        thumb: thumbExtended,
        index: indexExtended,
        middle: middleExtended,
        ring: ringExtended,
        pinky: pinkyExtended
      },
      extendedCount: [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length,
      isThumbsUp,
      isThumbsDown
    };
  }
}
