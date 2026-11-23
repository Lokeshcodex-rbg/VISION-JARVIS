/**
 * VISION AI — Interactive Physics & Engineering Simulation Viewer
 * Automatically renders live animated simulations (projectile motion, planetary orbit,
 * robotic arm kinematics, DC motor, rotating turbine, RLC circuit) on the user's screen
 * with Play/Pause/Reset controls and real computed physics telemetry.
 */

export class StarkSimulationViewer {
  constructor() {
    this.modal = null;
    this.canvas = null;
    this.ctx = null;
    this.simSpec = null;
    this.animFrame = null;
    this.isPlaying = true;
    this.frameIdx = 0;
    this.speedMultiplier = 1.0;
    this.lastStepTs = 0;
  }

  _createDOM() {
    if (document.getElementById('stark-sim-modal')) {
      this.modal = document.getElementById('stark-sim-modal');
      this.canvas = document.getElementById('stark-sim-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'stark-sim-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(2, 6, 14, 0.92); backdrop-filter: blur(14px);
      z-index: 9998; display: none; flex-direction: column;
      color: #e2e8f0; font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid rgba(56, 189, 248, 0.35); background: rgba(4, 15, 28, 0.9);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="display: inline-block; width: 10px; height: 10px; background: #10b981; border-radius: 50%; box-shadow: 0 0 10px #10b981;"></span>
          <strong style="letter-spacing: 1.5px; color: #38bdf8; font-size: 13px;">VISION LIVE SIMULATION ENGINE</strong>
          <span id="stark-sim-title-badge" style="padding: 3px 10px; background: rgba(56, 189, 248, 0.14); border: 1px solid rgba(56, 189, 248, 0.45); border-radius: 4px; font-size: 12px; color: #7dd3fc;">SIMULATION</span>
          <button id="stark-sim-voice-pill" type="button" onclick="window.jarvisApp && window.jarvisApp.commandAndPermissionUI && window.jarvisApp.commandAndPermissionUI.handleUnifiedStatusActivate()" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(6, 22, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.5); color: #cbd5e1; padding: 4px 10px; border-radius: 999px; cursor: pointer; font-size: 11px; font-weight: 600;">
            <span id="stark-sim-voice-dot" style="width: 7px; height: 7px; border-radius: 50%; background: #64748b; display: inline-block;"></span>
            <span id="stark-sim-voice-label">JARVIS: Ready</span>
          </button>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button id="stark-sim-play-btn" style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #6ee7b7; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">⏸ PAUSE</button>
          <button id="stark-sim-reset-btn" style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.45); color: #7dd3fc; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">↺ RESET</button>
          <button id="stark-sim-close-btn" style="background: rgba(239, 68, 68, 0.25); border: 1px solid #ef4444; color: #fecaca; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">✕ CLOSE</button>
        </div>
      </div>

      <div style="flex: 1; display: grid; grid-template-columns: 1fr 310px; overflow: hidden;">
        <div style="position: relative; display: flex; align-items: center; justify-content: center; padding: 18px;">
          <canvas id="stark-sim-canvas" width="900" height="540" style="width: 100%; height: 100%; max-width: 980px; max-height: 600px; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; background: radial-gradient(circle at center, #08182b 0%, #02060f 100%);"></canvas>
        </div>
        <div style="border-left: 1px solid rgba(56, 189, 248, 0.2); padding: 18px; background: rgba(3, 10, 20, 0.85); overflow-y: auto;">
          <h4 style="margin: 0 0 10px 0; color: #38bdf8; font-size: 13px; letter-spacing: 1px;">COMPUTED PARAMETERS</h4>
          <div id="stark-sim-params" style="font-size: 12px; line-height: 1.7; color: #cbd5e1; margin-bottom: 16px;"></div>
          <h4 style="margin: 0 0 10px 0; color: #10b981; font-size: 13px; letter-spacing: 1px;">LIVE TELEMETRY</h4>
          <div id="stark-sim-telemetry" style="font-family: monospace; font-size: 12px; line-height: 1.75; color: #93c5fd; margin-bottom: 16px;"></div>
          <h4 style="margin: 0 0 8px 0; color: #f59e0b; font-size: 13px; letter-spacing: 1px;">VERIFICATION ARTIFACT</h4>
          <div id="stark-sim-artifact" style="font-size: 11px; color: #94a3b8; word-break: break-all;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
    this.canvas = document.getElementById('stark-sim-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    const closeBtn = document.getElementById('stark-sim-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.hide();

    const playBtn = document.getElementById('stark-sim-play-btn');
    if (playBtn) {
      playBtn.onclick = () => {
        this.isPlaying = !this.isPlaying;
        playBtn.innerText = this.isPlaying ? '⏸ PAUSE' : '▶ PLAY';
      };
    }

    const resetBtn = document.getElementById('stark-sim-reset-btn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        this.frameIdx = 0;
        this.isPlaying = true;
        if (playBtn) playBtn.innerText = '⏸ PAUSE';
      };
    }
  }

  showSimulation(simSpec) {
    if (!simSpec || !Array.isArray(simSpec.series)) return;
    this.simSpec = simSpec;
    this.frameIdx = 0;
    this.isPlaying = true;
    this._createDOM();
    this.modal.style.display = 'flex';

    const titleEl = document.getElementById('stark-sim-title-badge');
    if (titleEl) titleEl.innerText = simSpec.title || simSpec.simulationType || 'LIVE SIMULATION';

    const paramsEl = document.getElementById('stark-sim-params');
    if (paramsEl) {
      const entries = Object.entries(simSpec.metrics || simSpec.parameters || {});
      paramsEl.innerHTML = entries.map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('');
    }

    const artEl = document.getElementById('stark-sim-artifact');
    if (artEl) {
      artEl.innerText = simSpec.artifactPath ? `Verified Disk Spec: ${simSpec.artifactPath}` : 'In-Memory Telemetry';
    }

    const playBtn = document.getElementById('stark-sim-play-btn');
    if (playBtn) playBtn.innerText = '⏸ PAUSE';

    this._startLoop();
  }

  hide() {
    if (this.modal) this.modal.style.display = 'none';
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  _startLoop() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    const tick = (ts) => {
      if (!this.modal || this.modal.style.display === 'none') return;
      if (this.isPlaying && (!this.lastStepTs || ts - this.lastStepTs >= 45)) {
        this.lastStepTs = ts;
        const series = this.simSpec?.series || [];
        if (series.length > 0) {
          this.frameIdx = (this.frameIdx + 1) % series.length;
        }
      }
      this._renderFrame();
      this.animFrame = requestAnimationFrame(tick);
    };
    this.animFrame = requestAnimationFrame(tick);
  }

  _renderFrame() {
    if (!this.ctx || !this.canvas || !this.simSpec) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const series = this.simSpec.series || [];
    if (!series.length) return;
    const pt = series[this.frameIdx] || series[0];

    ctx.clearRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const type = this.simSpec.simulationType;
    if (type === 'projectile_motion') {
      const pad = 60;
      const groundY = H - pad;
      const maxRange = Math.max(10, this.simSpec.metrics?.horizontalRangeM || 100);
      const maxHeight = Math.max(5, this.simSpec.metrics?.maxHeightM || 40);
      const scaleX = (W - 2 * pad) / maxRange;
      const scaleY = (H - 2 * pad) / (maxHeight * 1.25);

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pad, groundY); ctx.lineTo(W - pad, groundY); ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= this.frameIdx; i++) {
        const sx = pad + series[i].x * scaleX;
        const sy = groundY - series[i].y * scaleY;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      const cx = pad + pt.x * scaleX;
      const cy = groundY - pt.y * scaleY;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'planetary_orbit') {
      const cx = W / 2;
      const cy = H / 2;
      const scale = Math.min(W, H) * 0.28;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      series.forEach((p, idx) => {
        const px = cx + p.x * scale;
        const py = cy - p.y * scale;
        if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath(); ctx.stroke();

      const px = cx + pt.x * scale;
      const py = cy - pt.y * scale;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'robotic_arm_sim') {
      const baseX = W * 0.35;
      const baseY = H * 0.72;
      const scale = 120;
      const ex = baseX + pt.elbowX * scale;
      const ey = baseY - pt.elbowY * scale;
      const tx = baseX + pt.endX * scale;
      const ty = baseY - pt.endY * scale;

      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();

      [ [baseX, baseY, '#94a3b8'], [ex, ey, '#f59e0b'], [tx, ty, '#ef4444'] ].forEach(([jx, jy, col]) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(jx, jy, 9, 0, Math.PI * 2); ctx.fill();
      });
    } else if (type === 'rotating_turbine') {
      const cx = W / 2;
      const cy = H / 2;
      const blades = this.simSpec.parameters?.blades || 12;
      const angle = (this.frameIdx * 0.25) % (Math.PI * 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      for (let b = 0; b < blades; b++) {
        ctx.rotate((Math.PI * 2) / blades);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(28, -5, 130, 10);
      }
      ctx.restore();
      ctx.fillStyle = '#0f172a'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      // Waveform / Transient Curve (DC Motor & RLC Circuit)
      const pad = 60;
      const keys = Object.keys(pt).filter(k => k !== 't' && k !== 'tMs' && k !== 'step');
      const primaryKey = keys[0];
      const vals = series.map(s => Number(s[primaryKey] || 0));
      const minV = Math.min(...vals, 0);
      const maxV = Math.max(...vals, 1);
      const span = Math.max(0.001, maxV - minV);

      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= this.frameIdx; i++) {
        const px = pad + (i / Math.max(1, series.length - 1)) * (W - 2 * pad);
        const py = (H - pad) - ((vals[i] - minV) / span) * (H - 2 * pad);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    const telEl = document.getElementById('stark-sim-telemetry');
    if (telEl) {
      telEl.innerHTML = Object.entries(pt)
        .map(([k, v]) => `<div>${k}: <span style="color:#f8fafc">${v}</span></div>`)
        .join('');
    }
  }
}

export const starkSimulationViewerInstance = new StarkSimulationViewer();

