/**
 * VISION AI — Advanced Camera, Screen Awareness & Hardware Sensor Manager
 * Manages real webcam device enumeration, selection, preview streaming, frame capture,
 * disconnection recovery, persistent status indicators, frame comparison, and engineering inspection.
 * Decoupled from speech recognition to ensure camera latency/errors never interrupt audio listening.
 */

export class SensorManager {
  constructor(app) {
    this.app = app;
    this.activeCameraStream = null;
    this.activeScreenStream = null;
    this.ambientLightSensor = null;
    this.currentLux = null;
    this.isCameraStreaming = false;
    this.isScreenStreaming = false;
    this.cachedDevices = [];
    this.selectedCameraId = null;
    this.lastCapturedFrame = null;
    this.previousFrame = null;
    this.telemetrySyncInterval = null;
    this.isEmergencyLocked = false;

    // Elements
    this.videoElement = null;
    this.cameraContainer = null;
    this.cameraStatusBadge = null;
    this.cameraDeviceSelect = null;
    this.headerCameraIndicator = null;

    this.init();
  }

  async init() {
    this.bindDOMIndicators();
    await this.enumerateAvailableHardware();
    this.listenDeviceChanges();
    this.initAmbientLightSensor();
    this.startTelemetryReporting();
  }

  /**
   * Discovers and binds persistent header indicators and device selector
   */
  bindDOMIndicators() {
    if (typeof document === 'undefined') return;
    this.headerCameraIndicator = document.getElementById('header-camera-indicator');
    this.cameraDeviceSelect = document.getElementById('camera-device-select');
    if (this.cameraDeviceSelect) {
      this.cameraDeviceSelect.addEventListener('change', async (e) => {
        const devId = e.target.value;
        this.selectedCameraId = devId || null;
        if (this.isCameraStreaming) {
          console.log(`[SENSOR_MGR] Switching active camera to device: ${devId}`);
          try {
            await this.startCameraStream({ deviceId: this.selectedCameraId });
          } catch (err) {
            console.warn('[SENSOR_MGR] Camera switch failed:', err.message);
          }
        }
      });
    }
  }

  /**
   * Enumerates physically connected cameras and microphones through platform APIs
   */
  async enumerateAvailableHardware() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.warn('[SENSOR_MGR] mediaDevices.enumerateDevices is not supported in this runtime.');
      return { cameras: [], microphones: [], supported: false };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cachedDevices = devices;
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');

      // Populate device selection dropdown
      if (this.cameraDeviceSelect) {
        this.cameraDeviceSelect.innerHTML = '';
        if (cameras.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'No physical cameras detected';
          this.cameraDeviceSelect.appendChild(opt);
        } else {
          cameras.forEach((cam, idx) => {
            const opt = document.createElement('option');
            opt.value = cam.deviceId;
            opt.textContent = cam.label || (idx === 0 ? 'Integrated HD Webcam (Default)' : `Camera ${idx + 1}`);
            if (this.selectedCameraId === cam.deviceId || (!this.selectedCameraId && idx === 0)) {
              opt.selected = true;
            }
            this.cameraDeviceSelect.appendChild(opt);
          });
        }
      }

      console.log(`[SENSOR_MGR] Hardware detected: ${cameras.length} camera(s), ${microphones.length} microphone(s)`);
      return {
        cameras: cameras.map(c => ({ id: c.deviceId, label: c.label || 'Default Camera Device' })),
        microphones: microphones.map(m => ({ id: m.deviceId, label: m.label || 'Default Microphone Device' })),
        supported: true
      };
    } catch (err) {
      console.warn('[SENSOR_MGR] Hardware enumeration error:', err.message);
      return { cameras: [], microphones: [], supported: false, error: err.message };
    }
  }

  /**
   * Listens for camera and USB device connection/disconnection changes
   */
  listenDeviceChanges() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        console.log('[SENSOR_MGR] Hardware configuration change detected. Re-enumerating devices...');
        const previousCameras = this.cachedDevices.filter(d => d.kind === 'videoinput');
        const res = await this.enumerateAvailableHardware();
        const currentCameras = res.cameras || [];

        // If currently streaming and the selected device disappeared
        if (this.isCameraStreaming && this.selectedCameraId) {
          const stillConnected = currentCameras.some(c => c.id === this.selectedCameraId);
          if (!stillConnected) {
            this.handleCameraDisconnected('Active camera was disconnected from USB port.');
          }
        }
      });
    }
  }

  /**
   * Initializes or binds camera preview UI elements
   */
  bindPreviewElements({
    containerId = 'camera-preview-panel',
    videoId = 'camera-preview-video',
    badgeId = 'camera-live-badge',
    selectId = 'camera-device-select',
    headerIndicatorId = 'header-camera-indicator'
  } = {}) {
    this.cameraContainer = document.getElementById(containerId);
    this.videoElement = document.getElementById(videoId);
    this.cameraStatusBadge = document.getElementById(badgeId);
    if (!this.cameraDeviceSelect) this.cameraDeviceSelect = document.getElementById(selectId);
    if (!this.headerCameraIndicator) this.headerCameraIndicator = document.getElementById(headerIndicatorId);
  }

  /**
   * Requests real camera stream and displays live preview
   */
  async startCameraStream({ videoElement = null, deviceId = null } = {}) {
    if (this.isEmergencyLocked) {
      throw new Error('Camera access blocked: Global Emergency Stop lockout is active. Reset emergency stop first.');
    }

    if (this.app.currentTheme === 'ULTRON') {
      throw new Error('Security Violation: ULTRON is strictly restricted from camera visual hardware.');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access not supported in this browser or runtime environment.');
    }

    if (videoElement) {
      this.videoElement = videoElement;
    }

    // Stop existing tracks cleanly if switching cameras
    if (this.activeCameraStream && typeof this.activeCameraStream.getTracks === 'function') {
      this.activeCameraStream.getTracks().forEach(t => t.stop && t.stop());
      this.activeCameraStream = null;
    }

    const targetDevId = deviceId || this.selectedCameraId || (this.cameraDeviceSelect ? this.cameraDeviceSelect.value : null);
    const constraints = {
      video: targetDevId ? { deviceId: { exact: targetDevId } } : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.activeCameraStream = stream;
      this.isCameraStreaming = true;

      const videoTrack = (stream && typeof stream.getVideoTracks === 'function') ? stream.getVideoTracks()[0] : null;
      if (videoTrack && videoTrack.addEventListener) {
        // Register track ended listener to catch hardware unplugs
        videoTrack.addEventListener('ended', () => {
          this.handleCameraDisconnected('Camera track ended by operating system or device disconnected.');
        });
      }

      if (this.videoElement) {
        this.videoElement.srcObject = stream;
        await this.videoElement.play().catch(() => {});
      }

      if (this.cameraContainer) {
        this.cameraContainer.style.display = 'flex';
      }
      if (this.cameraStatusBadge) {
        this.cameraStatusBadge.textContent = '● LIVE CAMERA ACTIVE';
        this.cameraStatusBadge.className = 'camera-live-badge status-badge-active';
      }
      if (this.headerCameraIndicator) {
        this.headerCameraIndicator.style.display = 'flex';
      }

      // Notify backend and brain architecture of active visual input
      fetch('/api/vision/camera-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: 'STARTED',
          deviceId: targetDevId || 'default',
          label: videoTrack?.label || 'Integrated HD Webcam'
        })
      }).catch(() => {});

      console.log('[SENSOR_MGR] Camera stream acquired successfully.');
      return { success: true, stream, label: videoTrack?.label };
    } catch (err) {
      this.isCameraStreaming = false;
      this.updateIndicatorState(false);

      let userFriendly = err.message;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userFriendly = 'Camera permission was denied. Please allow camera access in browser / Windows settings.';
        fetch('/api/vision/camera-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: 'PERMISSION_DENIED', error: userFriendly })
        }).catch(() => {});
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userFriendly = 'No physical camera device was detected on your system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userFriendly = 'Camera is already in use by another application or OS process.';
      }

      console.warn('[SENSOR_MGR] Camera start failed:', err.name, err.message);
      throw new Error(userFriendly);
    }
  }

  /**
   * Handles unexpected physical camera disconnection
   */
  handleCameraDisconnected(reason = 'Camera hardware unlinked') {
    console.warn(`[SENSOR_MGR] Camera disconnection: ${reason}`);
    this.stopCameraStream(false);

    if (this.cameraStatusBadge) {
      this.cameraStatusBadge.textContent = '⚠️ CAMERA DISCONNECTED';
      this.cameraStatusBadge.className = 'camera-live-badge status-badge-disconnected';
    }

    // Notify backend
    fetch('/api/vision/camera-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'DISCONNECTED', error: reason })
    }).catch(() => {});

    // Speak or render notification non-blockingly
    if (this.app.speechSynthesizer && this.app.currentTheme === 'JARVIS') {
      this.app.speechSynthesizer.speak('Sir, optical camera input was disconnected from the system.', 'JARVIS');
    }
  }

  /**
   * Releases camera hardware and removes preview stream
   */
  stopCameraStream(notifyBackend = true) {
    if (this.activeCameraStream && typeof this.activeCameraStream.getTracks === 'function') {
      this.activeCameraStream.getTracks().forEach(track => {
        track.stop && track.stop();
        console.log(`[SENSOR_MGR] Stopped track: ${track.label}`);
      });
      this.activeCameraStream = null;
    } else {
      this.activeCameraStream = null;
    }

    this.isCameraStreaming = false;

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    if (this.cameraContainer) {
      this.cameraContainer.style.display = 'none';
    }
    this.updateIndicatorState(false);

    if (notifyBackend) {
      fetch('/api/vision/camera-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'STOPPED' })
      }).catch(() => {});
    }

    console.log('[SENSOR_MGR] Camera stream completely released.');
    return { success: true, message: 'Camera stream stopped.' };
  }

  updateIndicatorState(isActive) {
    if (this.headerCameraIndicator) {
      this.headerCameraIndicator.style.display = isActive ? 'flex' : 'none';
    }
    if (this.cameraStatusBadge) {
      if (isActive) {
        this.cameraStatusBadge.textContent = '● LIVE CAMERA ACTIVE';
        this.cameraStatusBadge.className = 'camera-live-badge status-badge-active';
      } else {
        this.cameraStatusBadge.textContent = 'CAMERA INACTIVE';
        this.cameraStatusBadge.className = 'camera-live-badge status-badge-inactive';
      }
    }
  }

  /**
   * Captures a real still frame snapshot from active camera stream
   */
  async captureSnapshot() {
    if (!this.isCameraStreaming || !this.videoElement || !this.activeCameraStream) {
      await this.startCameraStream();
      // Allow sensor auto-exposure settling
      await new Promise(r => setTimeout(r, 250));
    }

    const video = this.videoElement;
    if (!video || !video.videoWidth) {
      throw new Error('Video frame not ready for capture.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.min(video.videoWidth || 1280, 1920);
    canvas.height = Math.min(video.videoHeight || 720, 1080);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    this.previousFrame = this.lastCapturedFrame;
    this.lastCapturedFrame = dataUrl;

    console.log(`[SENSOR_MGR] Snapshot captured (${canvas.width}x${canvas.height}).`);
    return {
      success: true,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Captures screen snapshot
   */
  async captureScreenSnapshot() {
    if (this.app.currentTheme === 'ULTRON') {
      throw new Error('Security Violation: ULTRON is strictly restricted from screen capture.');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen capture is not supported by this browser.');
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      stream.getTracks().forEach(t => t.stop());

      const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
      return {
        success: true,
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      throw new Error(`Screen capture error: ${err.message}`);
    }
  }

  /**
   * Dispatches multimodal analysis request to backend
   */
  async analyzeVisual({ imageBase64, prompt = '', type = 'camera', personality = 'JARVIS' }) {
    const res = await fetch('/api/vision/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        prompt,
        type,
        personality
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Visual analysis error (HTTP ${res.status})`);
    }

    return await res.json();
  }

  /**
   * Inspects physical engineering component, circuit, or prototype
   */
  async inspectEngineeringComponent({ imageBase64 = null, prompt = '', componentType = 'general', personality = 'JARVIS' } = {}) {
    let frame = imageBase64;
    if (!frame) {
      const snap = await this.captureSnapshot();
      frame = snap.dataUrl;
    }

    const res = await fetch('/api/vision/engineering-inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: frame,
        prompt,
        componentType,
        personality
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Engineering inspection error (HTTP ${res.status})`);
    }

    return await res.json();
  }

  /**
   * Performs multi-frame temporal comparison between previous frame and current snapshot
   */
  async compareWithPreviousFrame(prompt = 'Compare these two camera frames and explain any differences.') {
    if (!this.lastCapturedFrame) {
      // First frame capture
      const snap1 = await this.captureSnapshot();
      return {
        success: false,
        message: 'Initial reference frame established. Capture a second frame to compare.'
      };
    }

    const frame1 = this.lastCapturedFrame;
    const snap2 = await this.captureSnapshot();
    const frame2 = snap2.dataUrl;

    const res = await fetch('/api/vision/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frame1Base64: frame1,
        frame2Base64: frame2,
        prompt,
        personality: this.app.currentTheme || 'JARVIS'
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Frame comparison error (HTTP ${res.status})`);
    }

    return await res.json();
  }

  /**
   * Global Emergency Stop Handler
   */
  onEmergencyStop() {
    this.isEmergencyLocked = true;
    this.stopCameraStream(false);
    console.log('[SENSOR_MGR] Emergency Stop executed: Camera stream forcefully terminated.');
  }

  resetEmergencyStop() {
    this.isEmergencyLocked = false;
    console.log('[SENSOR_MGR] Emergency Stop lockout released.');
  }

  /**
   * Initializes W3C AmbientLightSensor if supported
   */
  initAmbientLightSensor() {
    if (typeof window !== 'undefined' && 'AmbientLightSensor' in window) {
      try {
        this.ambientLightSensor = new window.AmbientLightSensor();
        this.ambientLightSensor.onreading = () => {
          this.currentLux = this.ambientLightSensor.illuminance;
        };
        this.ambientLightSensor.onerror = (e) => {
          console.warn('[SENSOR_MGR] AmbientLightSensor error:', e.error.message);
          this.ambientLightSensor = null;
        };
        this.ambientLightSensor.start();
        console.log('[SENSOR_MGR] Native AmbientLightSensor initialized.');
      } catch (err) {
        console.log('[SENSOR_MGR] Native AmbientLightSensor not available, using ambient environment estimator.');
      }
    }
  }

  /**
   * Compiles live client sensor telemetry (ambient lux, battery, network, display)
   */
  async getClientTelemetry() {
    let batteryInfo = null;
    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      try {
        const b = await navigator.getBattery();
        batteryInfo = {
          level: Math.round(b.level * 100),
          charging: b.charging,
          chargingTime: b.chargingTime,
          dischargingTime: b.dischargingTime
        };
      } catch (e) {}
    }

    let networkInfo = null;
    if (typeof navigator !== 'undefined' && navigator.connection) {
      const c = navigator.connection;
      networkInfo = {
        effectiveType: c.effectiveType || '4g',
        downlink: c.downlink || null,
        rtt: c.rtt || null,
        saveData: Boolean(c.saveData)
      };
    }

    return {
      ambientLightLux: this.currentLux !== null ? this.currentLux : null,
      ambientAvailable: this.currentLux !== null,
      screenWidth: typeof window !== 'undefined' ? window.screen.width : null,
      screenHeight: typeof window !== 'undefined' ? window.screen.height : null,
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      colorDepth: typeof window !== 'undefined' ? window.screen.colorDepth : null,
      battery: batteryInfo,
      network: networkInfo,
      isCameraActive: this.isCameraStreaming,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Periodically reports client telemetry to server
   */
  startTelemetryReporting(intervalMs = 30000) {
    if (this.telemetrySyncInterval) clearInterval(this.telemetrySyncInterval);
    this.telemetrySyncInterval = setInterval(async () => {
      try {
        const clientData = await this.getClientTelemetry();
        await fetch('/api/sensors/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientTelemetry: clientData })
        });
      } catch (e) {}
    }, intervalMs);
  }

  getStatus() {
    return {
      isCameraStreaming: this.isCameraStreaming,
      isScreenStreaming: this.isScreenStreaming,
      selectedCameraId: this.selectedCameraId,
      isEmergencyLocked: this.isEmergencyLocked,
      ambientLux: this.currentLux,
      hardwareCount: this.cachedDevices.length
    };
  }
}
