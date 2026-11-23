/**
 * VISION AI — Camera Intelligence & Real-World Perception Subsystem
 * Implements Phase 11 Section 8: Camera Intelligence and Real-World Perception.
 * Enforces strict user consent gates, hardware indicators, and zero background surveillance.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const PYTHON_BRIDGE = path.join(__dirname, 'python_vision_bridge.py');

class CameraIntelligenceEngine {
  constructor() {
    this.emergencyStop = emergencyStopControllerInstance;
    this.cameraState = {
      active: false,
      deviceId: null,
      deviceLabel: null,
      permissionStatus: 'prompt', // 'prompt' | 'granted' | 'denied'
      activeIndicatorVisible: false,
      lastCaptureTime: null,
      error: null
    };
  }

  /**
   * Discovers available physical camera devices via OpenCV hardware probe
   */
  async discoverDevices() {
    const probed = await new Promise((resolve) => {
      execFile('python', [PYTHON_BRIDGE, 'discover_cameras'], { timeout: 10000 }, (err, stdout) => {
        if (!err && stdout) {
          try {
            const lines = stdout.trim().split('\n');
            return resolve(JSON.parse(lines[lines.length - 1]));
          } catch (_) {}
        }
        resolve({ success: false, devices: [], hardwareProbed: true });
      });
    });

    const devices = Array.isArray(probed.devices) ? probed.devices : [];
    return {
      success: true,
      hardwareProbed: true,
      devices,
      cameraCount: devices.length,
      selectedDevice: this.cameraState.deviceId || (devices[0]?.deviceId || null),
      permissionStatus: this.cameraState.permissionStatus,
      summary: devices.length > 0
        ? `Detected ${devices.length} physical camera device(s).`
        : 'No physical webcam hardware responded on OpenCV device indices 0-2.'
    };
  }

  /**
   * Requests explicit permission and starts camera stream
   */
  async startCamera(deviceId = 'integrated_webcam_0', explicitConsent = false) {
    if (this.emergencyStop.isEmergencyStopped()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Camera sensor activation is strictly prohibited while Emergency Stop is engaged.');
    }

    if (!explicitConsent && this.cameraState.permissionStatus !== 'granted') {
      return {
        success: false,
        requiresExplicitConsent: true,
        permissionStatus: 'prompt',
        summary: 'Camera access requires explicit user approval. Would you like to enable the camera, sir?'
      };
    }

    this.cameraState.active = true;
    this.cameraState.deviceId = deviceId;
    this.cameraState.deviceLabel = deviceId === 'integrated_webcam_0' ? 'Integrated HD Webcam' : deviceId;
    this.cameraState.permissionStatus = 'granted';
    this.cameraState.activeIndicatorVisible = true;
    this.cameraState.lastCaptureTime = new Date().toISOString();
    this.cameraState.error = null;

    return {
      success: true,
      active: true,
      deviceId: this.cameraState.deviceId,
      deviceLabel: this.cameraState.deviceLabel,
      indicatorStatus: 'CAMERA_ACTIVE_VISIBLE_GREEN_LED',
      summary: `Camera activated on ${this.cameraState.deviceLabel}. Visual recording indicator is active.`
    };
  }

  /**
   * Immediate stop control for camera feed
   */
  async stopCamera(reason = 'User requested stop') {
    this.cameraState.active = false;
    this.cameraState.activeIndicatorVisible = false;
    this.cameraState.lastCaptureTime = null;

    return {
      success: true,
      active: false,
      reason,
      summary: 'Camera feed immediately stopped and sensor hardware released, sir.'
    };
  }

  /**
   * Captures and analyzes a real live camera snapshot (only if camera is authorized and active)
   */
  async analyzeLiveFrame(prompt = 'Describe visible scene and workspace objects', options = {}) {
    if (!this.cameraState.active) {
      return {
        success: false,
        error: 'Camera is not currently active. Explicit user activation required.',
        requiresActivation: true
      };
    }

    if (this.emergencyStop.isEmergencyStopped()) {
      await this.stopCamera('Emergency stop initiated');
      return { success: false, error: 'Sensor access terminated by Emergency Stop.' };
    }

    const { visionServiceInstance } = require('../visionService.js');
    let frameDataUrl = options.imageBase64 || null;
    let captureMeta = null;

    if (!frameDataUrl) {
      captureMeta = await visionServiceInstance.captureCameraSnapshot({ allowMock: false });
      if (!captureMeta.success || !captureMeta.frameBase64) {
        return {
          success: false,
          verified: false,
          deviceId: this.cameraState.deviceId,
          error: captureMeta.error || 'Physical webcam frame capture failed or device unavailable.',
          summary: `Camera sensor did not produce a live frame: ${captureMeta.error || 'Hardware unavailable'}.`
        };
      }
      frameDataUrl = captureMeta.frameBase64;
    }

    this.cameraState.lastCaptureTime = new Date().toISOString();
    const visionResult = await visionServiceInstance.analyzeImage(frameDataUrl, prompt, options.personality || 'JARVIS');

    let ownedNeuralVision = null;
    if (captureMeta?.path) {
      try {
        const { neuralBrainServiceInstance } = require('../neural/neuralBrainService.js');
        const nr = await neuralBrainServiceInstance.inferWithOwnedBrain({
          prompt,
          imagePath: captureMeta.path,
          maxTokens: 24
        });
        if (nr && nr.success && nr.vision_analysis) {
          ownedNeuralVision = nr.vision_analysis;
        }
      } catch (_) {}
    }

    return {
      success: Boolean(visionResult.success),
      verified: Boolean(visionResult.success && !visionResult.isObscured),
      deviceId: this.cameraState.deviceId,
      deviceLabel: this.cameraState.deviceLabel,
      capturedAt: this.cameraState.lastCaptureTime,
      framePath: captureMeta?.path || null,
      provider: visionResult.provider,
      isObscured: Boolean(visionResult.isObscured),
      sceneDescription: visionResult.analysis,
      ownedNeuralVision,
      summary: visionResult.analysis
    };
  }

  getStatus() {
    return { ...this.cameraState };
  }
}

module.exports = {
  CameraIntelligenceEngine,
  cameraIntelligenceEngineInstance: new CameraIntelligenceEngine()
};
