/**
 * JARVIS — Gaze Tracking, Autonomous Scanning & Microsaccades
 */

import { CONFIG } from '../config.js';
import { lerp, clamp, randomRange } from '../math/utils.js';

export const GazeMode = {
  MOUSE_FOLLOW: 'MOUSE_FOLLOW',
  AUTONOMOUS_SCAN: 'AUTONOMOUS_SCAN'
};

export class GazeTracker {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = GazeMode.MOUSE_FOLLOW;
    
    // Normalized gaze position (-1.0 to +1.0)
    this.currentGazeX = 0;
    this.currentGazeY = 0;
    this.targetGazeX = 0;
    this.targetGazeY = 0;

    // Mouse activity tracker
    this.lastMouseMoveTime = performance.now();
    this.mouseActive = false;

    // Autonomous scanning state
    this.autonomousTimer = 0;
    this.autonomousInterval = 2000;
    
    // Microsaccade state (tiny natural involuntary eye tremors)
    this.microsaccadeOffsetX = 0;
    this.microsaccadeOffsetY = 0;

    // Pupil accommodation dilation factor (0.9 to 1.15)
    this.pupilDilation = 1.0;
    this.targetPupilDilation = 1.0;

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('mousemove', (e) => {
      this.lastMouseMoveTime = performance.now();
      this.mouseActive = true;

      if (this.mode === GazeMode.MOUSE_FOLLOW) {
        // Fast viewport dimension lookup without layout thrashing
        const w = window.innerWidth || 1920;
        const h = window.innerHeight || 1080;

        // Map mouse position relative to canvas center
        const normX = (e.clientX / w - 0.5) * 2.0;
        const normY = (e.clientY / h - CONFIG.eye.centerYOffset) * 2.0;

        // Apply calibrated anatomical gaze limits
        this.targetGazeX = clamp(normX * 0.7, -CONFIG.gaze.maxGazeDeviationX, CONFIG.gaze.maxGazeDeviationX);
        this.targetGazeY = clamp(normY * 0.7, -CONFIG.gaze.maxGazeDeviationY, CONFIG.gaze.maxGazeDeviationY);

        // Dilate pupil slightly on sudden movements
        this.targetPupilDilation = 1.08;
      }
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      this.mouseActive = false;
    }, { passive: true });

    // Touch support for mobile/tablets
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.lastMouseMoveTime = performance.now();
        this.mouseActive = true;
        const touch = e.touches[0];
        const w = window.innerWidth || 1920;
        const h = window.innerHeight || 1080;
        const normX = (touch.clientX / w - 0.5) * 2.0;
        const normY = (touch.clientY / h - CONFIG.eye.centerYOffset) * 2.0;
        this.targetGazeX = clamp(normX * 0.7, -CONFIG.gaze.maxGazeDeviationX, CONFIG.gaze.maxGazeDeviationX);
        this.targetGazeY = clamp(normY * 0.7, -CONFIG.gaze.maxGazeDeviationY, CONFIG.gaze.maxGazeDeviationY);
      }
    }, { passive: true });
  }

  toggleMode() {
    this.mode = (this.mode === GazeMode.MOUSE_FOLLOW) ? GazeMode.AUTONOMOUS_SCAN : GazeMode.MOUSE_FOLLOW;
    if (this.mode === GazeMode.AUTONOMOUS_SCAN) {
      this.pickNewAutonomousTarget();
    }
    return this.mode;
  }

  pickNewAutonomousTarget() {
    // Generate intelligent AI scanning movements:
    // Glancing left, scanning across code lines, glancing down or thoughtfully upward
    const angle = randomRange(0, Math.PI * 2);
    const radius = randomRange(0.08, CONFIG.gaze.maxGazeDeviationX);

    // Natural reading bias: horizontal scanning is more common than vertical
    this.targetGazeX = Math.cos(angle) * radius * 1.15;
    this.targetGazeY = Math.sin(angle) * radius * 0.65;

    // Clamp strictly within bounds
    this.targetGazeX = clamp(this.targetGazeX, -CONFIG.gaze.maxGazeDeviationX, CONFIG.gaze.maxGazeDeviationX);
    this.targetGazeY = clamp(this.targetGazeY, -CONFIG.gaze.maxGazeDeviationY, CONFIG.gaze.maxGazeDeviationY);

    // Pupil accommodation breathing
    this.targetPupilDilation = randomRange(0.92, 1.12);

    this.autonomousInterval = randomRange(CONFIG.gaze.saccadeMinInterval, CONFIG.gaze.saccadeMaxInterval);
    this.autonomousTimer = 0;
  }

  update(dtMs) {
    const now = performance.now();

    // Check if mouse has been idle long enough to trigger autonomous scan automatically
    const isMouseIdle = (now - this.lastMouseMoveTime) > CONFIG.gaze.idleTimeoutMs;

    if (this.mode === GazeMode.AUTONOMOUS_SCAN || isMouseIdle) {
      this.autonomousTimer += dtMs;
      if (this.autonomousTimer >= this.autonomousInterval) {
        this.pickNewAutonomousTarget();
      }
    }

    // Apply biological microsaccades (fine involuntary tremor)
    if (Math.random() < CONFIG.gaze.microsaccadeRate) {
      const amp = CONFIG.gaze.microsaccadeAmp;
      this.microsaccadeOffsetX = (Math.random() - 0.5) * amp;
      this.microsaccadeOffsetY = (Math.random() - 0.5) * amp;
    } else {
      // Gently decay microsaccade offset
      this.microsaccadeOffsetX *= 0.88;
      this.microsaccadeOffsetY *= 0.88;
    }

    // Smooth spring-damping interpolation towards target gaze
    const damping = CONFIG.gaze.mouseFollowDamping;
    this.currentGazeX = lerp(this.currentGazeX, this.targetGazeX + this.microsaccadeOffsetX, damping);
    this.currentGazeY = lerp(this.currentGazeY, this.targetGazeY + this.microsaccadeOffsetY, damping);

    // Smooth pupil accommodation interpolation
    this.pupilDilation = lerp(this.pupilDilation, this.targetPupilDilation, 0.05);

    return {
      x: this.currentGazeX,
      y: this.currentGazeY,
      dilation: this.pupilDilation
    };
  }
}
