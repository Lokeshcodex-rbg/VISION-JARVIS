/**
 * VISION AI — Compact Holographic Hand Tracking HUD & 21-Landmark Canvas Overlay
 * Owned by JARVIS — POWERED BY VISION (MADE BY LOKESH).
 */

import { HAND_CONNECTIONS } from './handTrackingEngine.js';
import { GESTURE_SUBMODES } from './gestureController.js';

export class HandHudOverlay {
  constructor(options = {}) {
    this.handTracker = options.handTracker;
    this.gestureController = options.gestureController;
    this.onCameraToggle = options.onCameraToggle || (() => {});
    this.onConfigChange = options.onConfigChange || (() => {});
    this.root = null;
    this.videoEl = null;
    this.canvasEl = null;
    this.ctx = null;
    this.lastFrame = null;
    this.lastGestureState = null;
  }

  mount(parentEl) {
    if (!parentEl) return;
    if (this.root && this.root.parentNode === parentEl) return;

    this.root = document.createElement('section');
    this.root.id = 'stark-hand-hud';
    this.root.setAttribute('aria-label', 'VISION Hand Tracking HUD');
    this.root.style.cssText = `
      position: absolute; left: 16px; top: 16px; width: 288px; z-index: 30;
      background: rgba(4, 14, 28, 0.90); border: 1px solid rgba(0, 229, 255, 0.42);
      border-radius: 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
      color: #dff7ff; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11px;
      overflow: hidden; backdrop-filter: blur(8px);
    `;

    this.root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(0,229,255,0.1);border-bottom:1px solid rgba(0,229,255,0.22);">
        <div style="display:flex;align-items:center;gap:6px;">
          <span id="hud-cam-dot" style="width:8px;height:8px;border-radius:50%;background:#64748b;display:inline-block;"></span>
          <strong style="letter-spacing:0.7px;color:#7df3ff;font-size:11px;">VISION HAND TRACKER</strong>
        </div>
        <span id="hud-cam-status" style="font-size:10px;color:#94a3b8;font-family:Consolas,monospace;">OFF</span>
      </div>

      <div id="hud-consent-box" style="padding:10px;border-bottom:1px solid rgba(0,229,255,0.14);">
        <div style="color:#bfe8f7;line-height:1.4;margin-bottom:8px;">
          Camera remains disabled until you grant permission. Tracking runs locally in browser memory — no video is uploaded.
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" id="hud-btn-cam-start" style="flex:1;padding:6px 8px;background:rgba(0,229,255,0.2);border:1px solid #00e5ff;color:#e6fbff;border-radius:5px;cursor:pointer;font-weight:700;font-size:11px;">Enable Webcam Gestures</button>
        </div>
      </div>

      <div id="hud-live-feed-wrap" style="display:none;position:relative;width:100%;aspect-ratio:4/3;background:#02060d;">
        <video id="hud-webcam-video" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1);opacity:0.72;"></video>
        <canvas id="hud-landmark-canvas" width="320" height="240" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></canvas>
        <div id="hud-lowlight-warn" style="display:none;position:absolute;left:6px;right:6px;top:6px;padding:3px 6px;background:rgba(245,158,11,0.9);color:#111;border-radius:4px;font-weight:700;font-size:10px;text-align:center;">Low lighting detected — increase room light for stable tracking</div>
        <div style="position:absolute;right:6px;bottom:6px;display:flex;gap:4px;">
          <button type="button" id="hud-btn-cam-pause" style="padding:4px 7px;background:rgba(15,23,42,0.88);border:1px solid rgba(0,229,255,0.5);color:#7df3ff;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;">Pause</button>
          <button type="button" id="hud-btn-cam-stop" style="padding:4px 7px;background:rgba(127,29,29,0.88);border:1px solid #ef4444;color:#fecaca;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;">Stop</button>
        </div>
      </div>

      <div style="padding:8px 10px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#89b8d4;">Submode</span>
          <select id="hud-submode-select" style="background:rgba(0,20,38,0.95);border:1px solid rgba(0,229,255,0.35);color:#e2f8ff;border-radius:4px;padding:3px 6px;font-size:11px;">
            ${GESTURE_SUBMODES.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-family:Consolas,monospace;font-size:10.5px;background:rgba(0,0,0,0.3);padding:6px 8px;border-radius:5px;border:1px solid rgba(0,229,255,0.14);">
          <div>HANDS: <strong id="hud-hands-val" style="color:#00ffee;">--</strong></div>
          <div>CONF: <strong id="hud-conf-val" style="color:#00ffee;">0%</strong></div>
          <div>LAT: <strong id="hud-lat-val" style="color:#7df3ff;">0ms</strong></div>
          <div>FPS: <strong id="hud-fps-val" style="color:#7df3ff;">0</strong></div>
        </div>

        <div style="padding:5px 8px;border-radius:5px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.22);display:flex;justify-content:space-between;align-items:center;">
          <span id="hud-gesture-label" style="font-weight:700;color:#7df3ff;letter-spacing:0.4px;">IDLE — READY</span>
          <span id="hud-dwell-bar" style="width:42px;height:5px;background:rgba(255,255,255,0.12);border-radius:3px;overflow:hidden;"><i style="display:block;height:100%;width:0%;background:#00e5ff;"></i></span>
        </div>

        <details style="color:#9ad0ea;cursor:pointer;">
          <summary style="font-size:10.5px;font-weight:600;padding:2px 0;">Gesture Thresholds & Mapping</summary>
          <div style="padding-top:6px;display:flex;flex-direction:column;gap:5px;">
            <label style="display:flex;justify-content:space-between;align-items:center;">
              <span>Min Confidence (<b id="hud-cfg-conf-txt">72%</b>)</span>
              <input id="hud-cfg-conf" type="range" min="50" max="95" value="72" style="width:110px;accent-color:#00e5ff;" />
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center;">
              <span>Dwell Confirm (<b id="hud-cfg-dwell-txt">240ms</b>)</span>
              <input id="hud-cfg-dwell" type="range" min="100" max="600" step="20" value="240" style="width:110px;accent-color:#00e5ff;" />
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center;">
              <span>Orbit Sens (<b id="hud-cfg-orbit-txt">1.4x</b>)</span>
              <input id="hud-cfg-orbit" type="range" min="0.5" max="3.0" step="0.1" value="1.4" style="width:110px;accent-color:#00e5ff;" />
            </label>
            <div style="font-size:10px;color:#8cb8d4;line-height:1.35;">
              Palm Move: Orbit • Palm Still: Pause • Pinch/Spread: Zoom • Index: Point/Select • Fist: Grab/Grip • Two-Finger: Next Joint • 👍 Confirm • 👎 Cancel
            </div>
          </div>
        </details>
      </div>
    `;

    parentEl.appendChild(this.root);
    this.videoEl = this.root.querySelector('#hud-webcam-video');
    this.canvasEl = this.root.querySelector('#hud-landmark-canvas');
    this.ctx = this.canvasEl.getContext('2d');

    this.root.querySelector('#hud-btn-cam-start')?.addEventListener('click', () => this.requestStartCamera());
    this.root.querySelector('#hud-btn-cam-pause')?.addEventListener('click', () => {
      if (!this.handTracker) return;
      const btn = this.root.querySelector('#hud-btn-cam-pause');
      if (this.handTracker.status === 'PAUSED') {
        this.handTracker.resume();
        if (btn) btn.textContent = 'Pause';
      } else {
        this.handTracker.pause();
        if (btn) btn.textContent = 'Resume';
      }
    });
    this.root.querySelector('#hud-btn-cam-stop')?.addEventListener('click', () => {
      this.handTracker?.stop('USER_STOP');
    });

    this.root.querySelector('#hud-submode-select')?.addEventListener('change', (e) => {
      this.gestureController?.setSubmode(e.target.value);
    });

    const wireCfg = (id, txtId, fmt, key, scale = 1) => {
      const el = this.root.querySelector(id);
      const txt = this.root.querySelector(txtId);
      el?.addEventListener('input', () => {
        const val = Number(el.value);
        if (txt) txt.textContent = fmt(val);
        this.gestureController?.saveConfig({ [key]: val * scale });
      });
    };
    wireCfg('#hud-cfg-conf', '#hud-cfg-conf-txt', v => `${v}%`, 'confidenceThreshold', 0.01);
    wireCfg('#hud-cfg-dwell', '#hud-cfg-dwell-txt', v => `${v}ms`, 'dwellMs', 1);
    wireCfg('#hud-cfg-orbit', '#hud-cfg-orbit-txt', v => `${v.toFixed(1)}x`, 'orbitSensitivity', 1);
  }

  async requestStartCamera() {
    if (!this.handTracker || !this.videoEl) return { success: false };
    const res = await this.handTracker.start(this.videoEl);
    this.onCameraToggle(res);
    return res;
  }

  updateTrackingStatus({ status, errorMessage }) {
    if (!this.root) return;
    const dot = this.root.querySelector('#hud-cam-dot');
    const st = this.root.querySelector('#hud-cam-status');
    const consent = this.root.querySelector('#hud-consent-box');
    const feed = this.root.querySelector('#hud-live-feed-wrap');
    const pauseBtn = this.root.querySelector('#hud-btn-cam-pause');

    if (status === 'ACTIVE') {
      if (dot) dot.style.background = '#22c55e';
      if (st) { st.textContent = 'LIVE CAMERA'; st.style.color = '#4ade80'; }
      if (consent) consent.style.display = 'none';
      if (feed) feed.style.display = 'block';
      if (pauseBtn) pauseBtn.textContent = 'Pause';
    } else if (status === 'PAUSED') {
      if (dot) dot.style.background = '#f59e0b';
      if (st) { st.textContent = 'PAUSED'; st.style.color = '#fbbf24'; }
      if (pauseBtn) pauseBtn.textContent = 'Resume';
    } else if (status === 'INITIALIZING') {
      if (dot) dot.style.background = '#00e5ff';
      if (st) { st.textContent = 'LOADING VISION...'; st.style.color = '#7df3ff'; }
    } else if (status === 'BLOCKED_ESTOP') {
      if (dot) dot.style.background = '#ef4444';
      if (st) { st.textContent = 'E-STOP HALTED'; st.style.color = '#f87171'; }
      if (consent) consent.style.display = 'block';
      if (feed) feed.style.display = 'none';
    } else {
      if (dot) dot.style.background = '#64748b';
      if (st) { st.textContent = errorMessage ? 'CAM ERROR' : 'OFF'; st.style.color = errorMessage ? '#f87171' : '#94a3b8'; }
      if (consent) consent.style.display = 'block';
      if (feed) feed.style.display = 'none';
    }
  }

  renderFrame(frame, gestureState) {
    this.lastFrame = frame || this.lastFrame;
    this.lastGestureState = gestureState || this.lastGestureState;
    if (!this.root) return;

    const metrics = frame?.metrics || {};
    const hands = frame?.hands || [];

    const set = (sel, txt) => {
      const el = this.root.querySelector(sel);
      if (el) el.textContent = txt;
    };
    set('#hud-hands-val', hands.length ? hands.map(h => h.handedness[0]).join('+') : '--');
    set('#hud-conf-val', `${Math.round((gestureState?.confidence || 0) * 100)}%`);
    set('#hud-lat-val', `${metrics.latencyMs ?? 0}ms`);
    set('#hud-fps-val', `${metrics.fps ?? 0}`);
    set('#hud-gesture-label', gestureState?.statusLabel || 'READY');

    const subSel = this.root.querySelector('#hud-submode-select');
    if (subSel && gestureState?.submode && subSel.value !== gestureState.submode) {
      subSel.value = gestureState.submode;
    }

    const dwellFill = this.root.querySelector('#hud-dwell-bar i');
    if (dwellFill) {
      dwellFill.style.width = `${Math.round((gestureState?.dwellProgress || 0) * 100)}%`;
    }

    const lowLight = this.root.querySelector('#hud-lowlight-warn');
    if (lowLight) lowLight.style.display = metrics.lowLight ? 'block' : 'none';

    // Draw mirrored 21-landmark hand skeletons
    if (this.ctx && this.canvasEl) {
      const w = this.canvasEl.width;
      const h = this.canvasEl.height;
      this.ctx.clearRect(0, 0, w, h);

      for (const hand of hands) {
        const isRight = hand.handedness === 'Right';
        const stroke = isRight ? '#00e5ff' : '#ffb300';
        const dotFill = isRight ? '#7df3ff' : '#fde047';
        const lm = hand.landmarks;

        this.ctx.strokeStyle = stroke;
        this.ctx.lineWidth = 2;
        for (const [a, b] of HAND_CONNECTIONS) {
          const pa = lm[a], pb = lm[b];
          if (!pa || !pb) continue;
          this.ctx.beginPath();
          this.ctx.moveTo((1 - pa.x) * w, pa.y * h);
          this.ctx.lineTo((1 - pb.x) * w, pb.y * h);
          this.ctx.stroke();
        }
        this.ctx.fillStyle = dotFill;
        for (let idx = 0; idx < lm.length; idx++) {
          const p = lm[idx];
          const px = (1 - p.x) * w;
          const py = p.y * h;
          this.ctx.beginPath();
          this.ctx.arc(px, py, (idx === 4 || idx === 8) ? 4 : 2.5, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }
  }
}
