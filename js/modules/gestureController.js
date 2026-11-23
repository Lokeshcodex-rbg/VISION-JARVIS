/**
 * VISION AI — Real-Time Gesture Interpretation & Robotics Control Layer
 * Owned by JARVIS — POWERED BY VISION (MADE BY LOKESH).
 *
 * Converts stabilized 21-landmark hand streams into debounced, hysteresis-gated
 * continuous & discrete engineering controls across 5 selectable interaction submodes:
 *   Camera Control | Object Manipulation | Joint Control | Measurement | Presentation
 */

export const GESTURE_SUBMODES = [
  'Camera Control',
  'Object Manipulation',
  'Joint Control',
  'Measurement',
  'Presentation'
];

export class GestureController {
  constructor(options = {}) {
    this.onAction = options.onAction || (() => {});
    this.onStateUpdate = options.onStateUpdate || (() => {});
    this.isEmergencyStopActive = options.isEmergencyStopActive || (() => false);

    this.config = {
      confidenceThreshold: 0.72,
      dwellMs: 240,
      cooldownMs: 320,
      orbitSensitivity: 1.4,
      zoomSensitivity: 1.25,
      translateSensitivity: 1.0,
      activeSubmode: 'Camera Control',
      mappings: {
        open_palm: 'pause_or_orbit',
        pinch: 'zoom_or_drag',
        fist: 'grab_or_reset_hold',
        index_point: 'raycast_select',
        two_finger: 'joint_select_mode',
        thumbs_up: 'confirm_action',
        thumbs_down: 'cancel_action',
        two_hand_spread: 'two_hand_zoom_scale'
      }
    };

    this._pendingGesture = null;
    this._pendingStartMs = 0;
    this._confirmedGesture = 'NONE';
    this._lastDiscreteFireMs = new Map();
    this._prevAnchor = null;
    this._prevTwoHandSpan = null;
    this._prevTwoHandAngle = null;
    this._prevWristRoll = null;
    this._palmStillStartMs = 0;
    this._isHoldPaused = false;

    this.state = {
      submode: this.config.activeSubmode,
      candidateGesture: 'NONE',
      confirmedGesture: 'NONE',
      statusLabel: 'NO HAND DETECTED',
      confidence: 0,
      dwellProgress: 0,
      handsPresent: [],
      holdPaused: false,
      pointerNdc: null
    };
  }

  async loadConfig() {
    try {
      const res = await fetch('/api/robotics/gesture-config');
      const data = await res.json();
      if (data?.success && data.config) {
        this.applyConfig(data.config);
      }
    } catch (_) {}
  }

  async saveConfig(partial = {}) {
    this.applyConfig(partial);
    try {
      await fetch('/api/robotics/gesture-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.config)
      });
    } catch (_) {}
  }

  applyConfig(cfg = {}) {
    this.config = {
      ...this.config,
      ...cfg,
      mappings: { ...this.config.mappings, ...(cfg.mappings || {}) }
    };
    if (cfg.activeSubmode && GESTURE_SUBMODES.includes(cfg.activeSubmode)) {
      this.config.activeSubmode = cfg.activeSubmode;
      this.state.submode = cfg.activeSubmode;
    }
    this.onStateUpdate({ ...this.state, config: this.config });
  }

  setSubmode(modeName) {
    if (!GESTURE_SUBMODES.includes(modeName)) return;
    this.config.activeSubmode = modeName;
    this.state.submode = modeName;
    this._resetContinuousAnchors();
    this.onAction({ type: 'submode_changed', submode: modeName });
    this.onStateUpdate({ ...this.state, config: this.config });
  }

  _resetContinuousAnchors() {
    this._prevAnchor = null;
    this._prevTwoHandSpan = null;
    this._prevTwoHandAngle = null;
    this._prevWristRoll = null;
  }

  _classifySingleHand(hand) {
    const f = hand.fingers;
    const pinchActive = hand.pinchRatio < 0.34;
    const pinchReleaseThreshold = 0.44; // Hysteresis prevents pinch flicker

    if (hand.isThumbsUp) return { gesture: 'THUMBS_UP', confidence: hand.confidence * 0.96 };
    if (hand.isThumbsDown) return { gesture: 'THUMBS_DOWN', confidence: hand.confidence * 0.96 };

    if (pinchActive || (this._confirmedGesture === 'PINCH' && hand.pinchRatio < pinchReleaseThreshold && !f.middle && !f.ring && !f.pinky)) {
      return { gesture: 'PINCH', confidence: Math.min(1, hand.confidence * (1 - hand.pinchRatio * 0.4)) };
    }

    if (f.index && !f.middle && !f.ring && !f.pinky) {
      return { gesture: 'INDEX_POINT', confidence: hand.confidence * 0.95 };
    }
    if (f.index && f.middle && !f.ring && !f.pinky) {
      return { gesture: 'TWO_FINGER', confidence: hand.confidence * 0.94 };
    }
    if (!f.index && !f.middle && !f.ring && !f.pinky && !hand.isThumbsUp && !hand.isThumbsDown) {
      return { gesture: 'CLOSED_FIST', confidence: hand.confidence * 0.93 };
    }
    if (f.index && f.middle && f.ring && f.pinky) {
      return { gesture: 'OPEN_PALM', confidence: hand.confidence * 0.95 };
    }
    return { gesture: 'UNCERTAIN', confidence: hand.confidence * 0.5 };
  }

  _canFireDiscrete(key, nowMs) {
    const last = this._lastDiscreteFireMs.get(key) || 0;
    if (nowMs - last < this.config.cooldownMs) return false;
    this._lastDiscreteFireMs.set(key, nowMs);
    return true;
  }

  /**
   * Main frame consumer called by HandTrackingEngine.onFrameUpdate
   */
  processFrame(frame) {
    const nowMs = frame?.timestampMs || performance.now();
    if (this.isEmergencyStopActive()) {
      this._confirmedGesture = 'HALTED_ESTOP';
      this._resetContinuousAnchors();
      this.state = {
        ...this.state,
        candidateGesture: 'HALTED_ESTOP',
        confirmedGesture: 'HALTED_ESTOP',
        statusLabel: 'BLOCKED (E-STOP ACTIVE)',
        confidence: 0,
        dwellProgress: 0,
        handsPresent: []
      };
      this.onStateUpdate({ ...this.state, config: this.config });
      return;
    }

    const hands = frame?.hands || [];
    if (hands.length === 0) {
      this._pendingGesture = null;
      this._confirmedGesture = 'NONE';
      this._resetContinuousAnchors();
      this.state = {
        ...this.state,
        candidateGesture: 'NONE',
        confirmedGesture: 'NONE',
        statusLabel: 'NO HAND IN FRAME',
        confidence: 0,
        dwellProgress: 0,
        handsPresent: [],
        pointerNdc: null
      };
      this.onStateUpdate({ ...this.state, config: this.config });
      return;
    }

    // Two-hand simultaneous priority (Zoom / Scale / Rotate / Dual manipulation)
    if (hands.length >= 2) {
      const hA = hands[0];
      const hB = hands[1];
      const cA = this._classifySingleHand(hA);
      const cB = this._classifySingleHand(hB);
      const minConf = Math.min(cA.confidence, cB.confidence);

      if (minConf >= this.config.confidenceThreshold &&
          (cA.gesture === 'OPEN_PALM' || cA.gesture === 'PINCH' || cA.gesture === 'CLOSED_FIST') &&
          (cB.gesture === 'OPEN_PALM' || cB.gesture === 'PINCH' || cB.gesture === 'CLOSED_FIST')) {
        const span = Math.hypot(hA.palmCenter.x - hB.palmCenter.x, hA.palmCenter.y - hB.palmCenter.y);
        const angle = Math.atan2(hB.palmCenter.y - hA.palmCenter.y, hB.palmCenter.x - hA.palmCenter.x);
        const midX = (hA.palmCenter.x + hB.palmCenter.x) * 0.5;
        const midY = (hA.palmCenter.y + hB.palmCenter.y) * 0.5;

        const twoHandGesture = (cA.gesture === 'PINCH' && cB.gesture === 'PINCH') ? 'TWO_HAND_ZOOM_ROTATE' : 'TWO_HAND_SPREAD';
        this._advanceDwell(twoHandGesture, minConf, nowMs);

        if (this._confirmedGesture === twoHandGesture) {
          if (this._prevTwoHandSpan !== null && this._prevTwoHandAngle !== null && this._prevAnchor) {
            const dSpan = span - this._prevTwoHandSpan;
            let dAngle = angle - this._prevTwoHandAngle;
            if (dAngle > Math.PI) dAngle -= Math.PI * 2;
            if (dAngle < -Math.PI) dAngle += Math.PI * 2;
            const dMidX = midX - this._prevAnchor.x;
            const dMidY = midY - this._prevAnchor.y;

            if (Math.abs(dSpan) > 0.002 || Math.abs(dAngle) > 0.01 || Math.hypot(dMidX, dMidY) > 0.004) {
              this.onAction({
                type: 'two_hand_transform',
                submode: this.config.activeSubmode,
                deltaZoom: -dSpan * 18 * this.config.zoomSensitivity,
                deltaAzimuth: -dAngle * 1.8 * this.config.orbitSensitivity,
                deltaPanX: -dMidX * 5.0 * this.config.translateSensitivity,
                deltaPanY: -dMidY * 5.0 * this.config.translateSensitivity
              });
            }
          }
          this._prevTwoHandSpan = span;
          this._prevTwoHandAngle = angle;
          this._prevAnchor = { x: midX, y: midY, z: hA.palmCenter.z };
        }
        this._publishState(hands, twoHandGesture, minConf);
        return;
      }
    }

    // Single-hand primary processing
    this._prevTwoHandSpan = null;
    this._prevTwoHandAngle = null;

    const primary = hands[0];
    const { gesture, confidence } = this._classifySingleHand(primary);

    if (gesture === 'UNCERTAIN' || confidence < this.config.confidenceThreshold) {
      this._pendingGesture = null;
      this._resetContinuousAnchors();
      this.state = {
        ...this.state,
        candidateGesture: gesture,
        confirmedGesture: 'UNCERTAIN',
        statusLabel: `UNCERTAIN (${Math.round(confidence * 100)}%)`,
        confidence,
        dwellProgress: 0,
        handsPresent: hands.map(h => h.handedness)
      };
      this.onStateUpdate({ ...this.state, config: this.config });
      return;
    }

    const justConfirmed = this._advanceDwell(gesture, confidence, nowMs);
    const submode = this.config.activeSubmode;
    const anchor = primary.gesture === 'PINCH' ? primary.indexTip : primary.palmCenter;

    // Mirrored webcam x: moving right hand right in world -> decrease image x -> negate dx cleanly
    const dx = this._prevAnchor ? -(primary.palmCenter.x - this._prevAnchor.x) : 0;
    const dy = this._prevAnchor ? (primary.palmCenter.y - this._prevAnchor.y) : 0;
    const dz = this._prevAnchor ? ((primary.palmScale - (this._prevAnchor.scale || primary.palmScale)) / Math.max(0.05, primary.palmScale)) : 0;
    const dRoll = this._prevWristRoll !== null ? (primary.wristRollRad - this._prevWristRoll) : 0;

    // Pointer NDC from mirrored webcam index fingertip
    const pointerNdc = {
      x: (1 - primary.indexTip.x) * 2 - 1,
      y: -(primary.indexTip.y * 2 - 1)
    };
    this.state.pointerNdc = pointerNdc;

    if (this._confirmedGesture === gesture) {
      if (gesture === 'THUMBS_UP' && justConfirmed && this._canFireDiscrete('thumbs_up', nowMs)) {
        this.onAction({ type: 'confirm', submode });
      } else if (gesture === 'THUMBS_DOWN' && justConfirmed && this._canFireDiscrete('thumbs_down', nowMs)) {
        this.onAction({ type: 'cancel', submode });
      } else if (gesture === 'TWO_FINGER' && justConfirmed && this._canFireDiscrete('two_finger', nowMs)) {
        this.onAction({ type: 'cycle_joint_select', submode });
      } else if (gesture === 'CLOSED_FIST') {
        if (justConfirmed && this._canFireDiscrete('fist', nowMs)) {
          this.onAction({
            type: submode === 'Joint Control' ? 'toggle_gripper' : 'grab_toggle',
            submode,
            pointerNdc
          });
        }
      } else if (gesture === 'INDEX_POINT') {
        this.onAction({
          type: submode === 'Measurement' ? (justConfirmed ? 'drop_measure_pin' : 'hover_raycast') : (justConfirmed ? 'point_select' : 'hover_raycast'),
          submode,
          pointerNdc
        });
      } else if (gesture === 'PINCH') {
        if (submode === 'Camera Control') {
          if (Math.abs(dy) > 0.0025 || Math.abs(dz) > 0.008) {
            this.onAction({
              type: 'camera_zoom',
              deltaDistance: (dy * 16 - dz * 10) * this.config.zoomSensitivity
            });
          }
        } else if (submode === 'Object Manipulation') {
          if (Math.hypot(dx, dy) > 0.0025) {
            this.onAction({
              type: 'drag_ik_or_object',
              deltaX: dx * 9 * this.config.translateSensitivity,
              deltaY: -dy * 9 * this.config.translateSensitivity,
              pointerNdc
            });
          }
        } else if (submode === 'Joint Control') {
          if (Math.abs(dx) > 0.0025 || Math.abs(dy) > 0.0025) {
            this.onAction({
              type: 'adjust_active_joint',
              deltaDeg: (dx * 220 - dy * 160) * this.config.orbitSensitivity
            });
          }
        } else if (submode === 'Measurement' && justConfirmed && this._canFireDiscrete('measure_pin', nowMs)) {
          this.onAction({ type: 'drop_measure_pin', pointerNdc });
        }
      } else if (gesture === 'OPEN_PALM') {
        const motionMag = Math.hypot(dx, dy);
        if (motionMag < 0.0035 && Math.abs(dRoll) < 0.025) {
          if (!this._palmStillStartMs) this._palmStillStartMs = nowMs;
          if (nowMs - this._palmStillStartMs > 850 && !this._isHoldPaused) {
            this._isHoldPaused = true;
            this.onAction({ type: 'palm_hold_pause', paused: true });
          }
        } else {
          this._palmStillStartMs = 0;
          if (this._isHoldPaused) {
            this._isHoldPaused = false;
            this.onAction({ type: 'palm_hold_pause', paused: false });
          }
          if (submode === 'Camera Control') {
            this.onAction({
              type: 'camera_orbit',
              deltaAzimuth: -dx * 5.2 * this.config.orbitSensitivity,
              deltaElevation: dy * 3.8 * this.config.orbitSensitivity,
              deltaRoll: Math.abs(dRoll) > 0.02 ? dRoll * 0.6 : 0
            });
          } else if (submode === 'Presentation' && Math.abs(dx) > 0.045 && this._canFireDiscrete('preset_swipe', nowMs)) {
            this.onAction({ type: 'cycle_preset', direction: dx > 0 ? 1 : -1 });
          }
        }
      }

      this._prevAnchor = { x: primary.palmCenter.x, y: primary.palmCenter.y, scale: primary.palmScale };
      this._prevWristRoll = primary.wristRollRad;
    } else {
      this._prevAnchor = { x: primary.palmCenter.x, y: primary.palmCenter.y, scale: primary.palmScale };
      this._prevWristRoll = primary.wristRollRad;
    }

    this._publishState(hands, gesture, confidence);
  }

  _advanceDwell(gesture, confidence, nowMs) {
    if (this._pendingGesture !== gesture) {
      this._pendingGesture = gesture;
      this._pendingStartMs = nowMs;
      if (this._confirmedGesture !== gesture) {
        return false;
      }
    }
    const elapsed = nowMs - this._pendingStartMs;
    if (elapsed >= this.config.dwellMs && this._confirmedGesture !== gesture) {
      this._confirmedGesture = gesture;
      return true;
    }
    return false;
  }

  _publishState(hands, candidate, confidence) {
    const nowMs = performance.now();
    const dwellProgress = this._pendingGesture === candidate
      ? Math.min(1, Math.max(0, (nowMs - this._pendingStartMs) / Math.max(1, this.config.dwellMs)))
      : (this._confirmedGesture === candidate ? 1 : 0);

    const statusLabel = this._isHoldPaused && candidate === 'OPEN_PALM'
      ? 'PALM HOLD (PAUSED)'
      : (this._confirmedGesture === candidate ? `ACTIVE: ${candidate}` : `DETECTING: ${candidate}`);

    this.state = {
      submode: this.config.activeSubmode,
      candidateGesture: candidate,
      confirmedGesture: this._confirmedGesture,
      statusLabel,
      confidence,
      dwellProgress: Number(dwellProgress.toFixed(2)),
      handsPresent: hands.map(h => h.handedness),
      holdPaused: this._isHoldPaused,
      pointerNdc: this.state.pointerNdc
    };
    this.onStateUpdate({ ...this.state, config: this.config });
  }
}
