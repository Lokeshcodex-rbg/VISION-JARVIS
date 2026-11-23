/**
 * VISION AI — Holographic Robotics Lab UI Template & Accessible Styles
 * Owned by JARVIS — POWERED BY VISION (MADE BY LOKESH).
 * Keeps Stark3DViewer modular and follows modern accessible tablist & toolbar guidelines.
 */

export const LAB_MODES = [
  { id: 'Explore', label: 'Explore' },
  { id: 'Gesture', label: 'Gesture' },
  { id: 'Joint Control', label: 'Joint Control' },
  { id: 'Simulation', label: 'Simulation' },
  { id: 'Engineering', label: 'Engineering' },
  { id: 'Exploded View', label: 'Exploded View' },
  { id: 'Vision Analysis', label: 'Vision Analysis' },
  { id: 'Presentation', label: 'Presentation' },
  { id: 'CAD Design', label: 'CAD Design' }
];

export function buildRoboticsLabStyles() {
  return `
    #stark-3d-modal {
      position: fixed; inset: 0; width: 100dvw; height: 100dvh; z-index: 9500;
      background: radial-gradient(circle at center, rgba(6, 18, 36, 0.96) 0%, rgba(2, 6, 14, 0.99) 100%);
      backdrop-filter: blur(12px);
      display: none; flex-direction: column;
      font-family: 'Segoe UI', system-ui, sans-serif; color: #e2f1f8;
      overflow: hidden;
    }
    .s3d-btn {
      min-height: 28px; min-width: 28px;
      padding: 4px 9px; font-size: 11px; font-weight: 600; letter-spacing: 0.3px;
      border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
      border: 1px solid rgba(0, 229, 255, 0.42);
      background: rgba(0, 229, 255, 0.10); color: #7df3ff;
      transition: background 140ms ease, border-color 140ms ease;
      white-space: nowrap;
    }
    .s3d-btn:hover { background: rgba(0, 229, 255, 0.24); border-color: #00e5ff; }
    .s3d-btn:focus-visible, .s3d-tab:focus-visible { outline: 2px solid #00ffee; outline-offset: 2px; }
    .s3d-btn[aria-pressed="true"], .s3d-btn.active {
      background: rgba(0, 229, 255, 0.34); color: #ffffff; border-color: #00ffee;
    }
    .s3d-btn-success { background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #a7f3d0; }
    .s3d-btn-danger { background: rgba(239, 68, 68, 0.2); border-color: #ef4444; color: #fca5a5; }
    .s3d-btn-amber { background: rgba(245, 158, 11, 0.18); border-color: #f59e0b; color: #fde68a; }
    .s3d-tablist {
      display: flex; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: thin;
      gap: 2px; padding: 0 18px; background: rgba(0, 12, 26, 0.94);
      border-bottom: 1px solid rgba(0, 229, 255, 0.22);
    }
    .s3d-tab {
      position: relative; flex: 0 0 auto; border: none; background: transparent;
      color: #82b8d4; font-size: 11.5px; font-weight: 600; letter-spacing: 0.4px;
      padding: 8px 12px; cursor: pointer; white-space: nowrap;
    }
    .s3d-tab:hover { color: #d8f6ff; }
    .s3d-tab[aria-selected="true"] { color: #00ffee; }
    .s3d-tab[aria-selected="true"]::after {
      content: ""; position: absolute; left: 8px; right: 8px; bottom: 0;
      border-block-end: 2.5px solid #00ffee;
    }
    .s3d-inspector-card {
      background: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.22);
      border-radius: 7px; padding: 10px 12px;
    }
    .s3d-sec-title {
      font-size: 11px; color: #00e5ff; font-weight: 700; letter-spacing: 0.9px;
      margin-bottom: 7px; display: flex; justify-content: space-between; align-items: center;
    }
    @media (max-width: 1024px) {
      #stark-3d-inspector-panel { width: 320px !important; }
    }
  `;
}

export function buildRoboticsLabHtml() {
  const tabsHtml = LAB_MODES.map((m, i) => `
    <button type="button" role="tab" class="s3d-tab" id="s3d-tab-${m.id.replace(/\s+/g, '-').toLowerCase()}"
      data-lab-mode="${m.id}" aria-selected="${i === 0 ? 'true' : 'false'}" tabindex="${i === 0 ? '0' : '-1'}">
      ${m.label}
    </button>
  `).join('');

  return `
    <!-- Top Identity + Primary Command Toolbar -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 18px;border-bottom:1px solid rgba(0,229,255,0.28);background:rgba(0,18,38,0.88);gap:10px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="color:#00e5ff;font-size:15px;font-weight:700;letter-spacing:1.4px;">JARVIS HOLOGRAPHIC ROBOTICS LAB</span>
        <span style="font-size:10px;padding:2px 7px;border:1px solid rgba(0,229,255,0.45);border-radius:10px;color:#8be9ff;letter-spacing:0.6px;">VISION — MADE BY LOKESH</span>
        <span id="stark-3d-archetype-tag" style="font-size:11px;padding:2px 8px;border:1px solid #00e5ff;border-radius:4px;color:#00e5ff;background:rgba(0,229,255,0.10);">ROBOTIC_ARM</span>
        <span id="stark-3d-provenance-tag" style="font-size:10px;padding:2px 7px;border:1px solid rgba(251,191,36,0.45);border-radius:4px;color:#fde68a;background:rgba(245,158,11,0.10);">ENGINEERING PARAMETRIC</span>
        <span id="stark-3d-title-badge" style="font-size:11px;color:#a5f3fc;font-family:Consolas,monospace;"></span>
        <span id="stark-3d-voice-pill" style="display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:12px;background:rgba(0,229,255,0.14);border:1px solid rgba(0,229,255,0.45);color:#7df3ff;font-size:11px;font-weight:600;">
          <span id="stark-3d-voice-dot" style="width:7px;height:7px;border-radius:50%;background:#00e5ff;"></span>
          <span id="stark-3d-voice-label">JARVIS LISTENING</span>
        </span>
      </div>

      <div id="stark-3d-toolbar" role="toolbar" aria-label="Robotics Lab Viewport Controls" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
        <div role="group" aria-label="View Modes" style="display:flex;gap:4px;">
          <button type="button" id="stark-3d-explode-btn" class="s3d-btn" aria-pressed="false">EXPLODED: OFF</button>
          <button type="button" id="stark-3d-kinematics-btn" class="s3d-btn" aria-pressed="false">KINEMATICS: OFF</button>
          <button type="button" id="stark-3d-wireframe-btn" class="s3d-btn" aria-pressed="false">WIREFRAME</button>
          <button type="button" id="stark-3d-xray-btn" class="s3d-btn" aria-pressed="false">X-RAY</button>
          <button type="button" id="stark-3d-isolate-btn" class="s3d-btn" aria-pressed="false">ISOLATE</button>
        </div>
        <div role="group" aria-label="Helpers" style="display:flex;gap:4px;">
          <button type="button" id="stark-3d-grid-btn" class="s3d-btn active" aria-pressed="true">GRID: ON</button>
          <button type="button" id="stark-3d-snap-btn" class="s3d-btn" aria-pressed="false">SNAP</button>
          <button type="button" id="stark-3d-dims-btn" class="s3d-btn active" aria-pressed="true">DIMS/AXES</button>
          <button type="button" id="stark-3d-light-btn" class="s3d-btn" aria-pressed="false">LIGHT: HOLOGRAPHIC</button>
          <button type="button" id="stark-3d-theme-btn" class="s3d-btn">THEME: HOLOGRAPHIC</button>
          <button type="button" id="stark-3d-rot-btn" class="s3d-btn active" aria-pressed="true">ROTATION: ON</button>
        </div>
        <div role="group" aria-label="Actions" style="display:flex;gap:4px;">
          <button type="button" id="stark-3d-reset-btn" class="s3d-btn s3d-btn-amber">RESET POSE</button>
          <button type="button" id="stark-3d-snapshot-btn" class="s3d-btn">SNAPSHOT</button>
          <button type="button" id="stark-3d-import-btn" class="s3d-btn">IMPORT CAD</button>
          <input type="file" id="stark-3d-import-file" accept=".obj,.stl,.glb,.gltf,.json,.step,.stp" style="display:none;" />
          <button type="button" id="stark-3d-export-obj-btn" class="s3d-btn s3d-btn-success">.OBJ</button>
          <button type="button" id="stark-3d-export-stl-btn" class="s3d-btn s3d-btn-success">.STL</button>
          <button type="button" id="stark-3d-export-glb-btn" class="s3d-btn s3d-btn-success">.GLB</button>
          <button type="button" id="stark-3d-export-spec-btn" class="s3d-btn s3d-btn-success">SPEC+BOM</button>
          <button type="button" id="stark-3d-close-btn" class="s3d-btn s3d-btn-danger">CLOSE</button>
        </div>
      </div>
    </div>

    <!-- 9 Lab Mode Tabs -->
    <div id="stark-3d-lab-tablist" class="s3d-tablist" role="tablist" aria-label="Robotics Lab Modes">
      ${tabsHtml}
    </div>

    <!-- Live region outside toolbar for assistive status updates -->
    <div id="stark-3d-live-status" role="status" aria-live="polite" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;"></div>

    <!-- Main Workspace: 3D Canvas + Floating Camera/HUD + Right Engineering Panel -->
    <div style="flex:1;display:flex;gap:14px;padding:12px 18px;overflow:hidden;min-height:0;">
      <!-- Left: Interactive WebGL Canvas + Presets + Hand HUD -->
      <div style="flex:1;position:relative;display:flex;flex-direction:column;min-width:0;">
        <div id="stark-3d-canvas-container" style="flex:1;position:relative;border:1px solid rgba(0,229,255,0.34);border-radius:8px;overflow:hidden;background:radial-gradient(circle at center,#07162a 0%,#01040b 100%);box-shadow:inset 0 0 36px rgba(0,229,255,0.10);">
          <!-- Camera Preset Strip (bottom-left inside canvas) -->
          <div style="position:absolute;left:12px;bottom:12px;z-index:20;display:flex;gap:4px;background:rgba(2,10,22,0.82);padding:5px;border-radius:6px;border:1px solid rgba(0,229,255,0.3);">
            <button type="button" class="s3d-btn stark-3d-cam-preset" data-cam-preset="iso">ISO</button>
            <button type="button" class="s3d-btn stark-3d-cam-preset" data-cam-preset="front">FRONT</button>
            <button type="button" class="s3d-btn stark-3d-cam-preset" data-cam-preset="side">SIDE</button>
            <button type="button" class="s3d-btn stark-3d-cam-preset" data-cam-preset="top">TOP</button>
            <button type="button" class="s3d-btn stark-3d-cam-preset" data-cam-preset="center">CENTER</button>
          </div>
          <!-- Measure Overlay Badge (top-right inside canvas) -->
          <div id="stark-3d-measure-badge" style="position:absolute;right:12px;top:12px;z-index:20;display:none;background:rgba(2,12,26,0.90);border:1px solid #ffb300;border-radius:6px;padding:6px 10px;font-size:11px;color:#fde68a;font-family:Consolas,monospace;"></div>
          <!-- Floating Gesture Target Pointer Ring -->
          <div id="stark-3d-gesture-cursor" style="position:absolute;width:22px;height:22px;border-radius:50%;border:2px solid #00ffee;box-shadow:0 0 12px #00e5ff;pointer-events:none;display:none;transform:translate(-50%,-50%);z-index:25;"></div>
        </div>
        <div id="stark-3d-footer-bar" style="padding-top:7px;font-size:11px;color:#8cb8d4;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <span>DRAG: ORBIT • RIGHT/SHIFT+DRAG: PAN • SCROLL: ZOOM • R: RESET • ARROWS: CAMERA • GESTURES AVAILABLE</span>
          <span style="display:flex;gap:14px;font-family:Consolas,monospace;color:#7df3ff;">
            <span id="stark-3d-meta-parts">COMPONENTS: 0</span>
            <span id="stark-3d-meta-joints">JOINTS: 0</span>
            <span id="stark-3d-meta-pose">POSE: HOME</span>
          </span>
        </div>
      </div>

      <!-- Right Sidebar: Multi-Robot Switcher, Vault, Joints, IK/Sim, Stress, Parts, Vision QA -->
      <aside id="stark-3d-inspector-panel" style="width:396px;display:flex;flex-direction:column;gap:9px;overflow-y:auto;padding-right:4px;">
        <!-- Save / Design Vault -->
        <div class="s3d-inspector-card">
          <div class="s3d-sec-title">
            <span>CAD PROJECT & SAVE IN JARVIS</span>
            <span id="stark-3d-save-status" style="font-size:10px;color:#94a3b8;">Draft</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <input id="stark-3d-name-input" type="text" placeholder="Project / Robot Name" style="width:100%;box-sizing:border-box;padding:6px 8px;background:rgba(0,12,24,0.85);border:1px solid rgba(0,229,255,0.35);border-radius:4px;color:#e2f1f8;font-size:12px;" />
            <input id="stark-3d-notes-input" type="text" placeholder="Engineering notes (optional)" style="width:100%;box-sizing:border-box;padding:5px 8px;background:rgba(0,12,24,0.7);border:1px solid rgba(0,229,255,0.22);border-radius:4px;color:#cbd5e1;font-size:11px;" />
            <div style="display:flex;gap:6px;">
              <button type="button" id="stark-3d-save-btn" class="s3d-btn s3d-btn-success" style="flex:1;">SAVE IN JARVIS</button>
              <button type="button" id="stark-3d-saveas-btn" class="s3d-btn" style="flex:0 0 auto;">SAVE COPY</button>
            </div>
          </div>
        </div>

        <!-- 15-Category Robotics Library Switcher -->
        <div class="s3d-inspector-card">
          <div class="s3d-sec-title"><span>15-CATEGORY ROBOTICS LIBRARY</span><span id="stark-3d-catalog-count" style="color:#8be9ff;font-size:10px;"></span></div>
          <div style="display:flex;gap:6px;">
            <select id="stark-3d-robot-catalog-select" style="flex:1;min-width:0;background:rgba(0,14,28,0.92);border:1px solid rgba(0,229,255,0.35);color:#e2f8ff;border-radius:4px;padding:5px 6px;font-size:11px;"></select>
            <button type="button" id="stark-3d-load-catalog-btn" class="s3d-btn">LOAD</button>
          </div>
          <div id="stark-3d-catalog-desc" style="margin-top:5px;font-size:10.5px;color:#94a3b8;line-height:1.35;"></div>
        </div>

        <!-- Assembly Specs + Explode Slider -->
        <div class="s3d-inspector-card">
          <div class="s3d-sec-title"><span>ASSEMBLY SPECS & EXPLOSION</span><span id="stark-3d-explode-pct" style="font-family:Consolas,monospace;">0%</span></div>
          <div id="stark-3d-specs-body" style="font-size:11.5px;line-height:1.5;color:#cbd5e1;">Loading telemetry...</div>
          <input id="stark-3d-explode-slider" type="range" min="0" max="150" value="0" style="width:100%;margin-top:6px;accent-color:#00e5ff;" aria-label="Exploded view separation factor" />
        </div>

        <!-- Pose & Grip Presets + Articulated Joint Controls -->
        <div class="s3d-inspector-card">
          <div class="s3d-sec-title"><span>ARTICULATED JOINTS & GRIPPER</span><span style="font-size:10px;color:#8be9ff;">SLIDERS / GESTURE</span></div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
            <button type="button" class="stark-3d-preset-btn s3d-btn" data-preset="home">HOME</button>
            <button type="button" class="stark-3d-preset-btn s3d-btn" data-preset="pick">PICK</button>
            <button type="button" class="stark-3d-preset-btn s3d-btn" data-preset="reach">REACH</button>
            <button type="button" class="stark-3d-preset-btn s3d-btn" data-preset="stow">STOW</button>
            <button type="button" class="stark-3d-grip-preset s3d-btn s3d-btn-amber" data-grip="open">GRIP OPEN</button>
            <button type="button" class="stark-3d-grip-preset s3d-btn s3d-btn-amber" data-grip="pinch">PINCH</button>
            <button type="button" class="stark-3d-grip-preset s3d-btn s3d-btn-amber" data-grip="power">POWER</button>
            <button type="button" class="stark-3d-grip-preset s3d-btn s3d-btn-amber" data-grip="precision">PRECISION</button>
          </div>
          <div id="stark-3d-joints-controls" style="display:flex;flex-direction:column;gap:7px;"></div>
        </div>

        <!-- Inverse Kinematics, Reachability & Trajectory Simulation -->
        <div class="s3d-inspector-card">
          <div class="s3d-sec-title"><span>IK SOLVER & TRAJECTORY SIMULATION</span><span id="stark-3d-sim-badge" style="font-size:10px;color:#34d399;">READY</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:6px;font-size:11px;">
            <label>X(cm) <input id="stark-3d-ik-x" type="number" step="1" value="22" style="width:100%;box-sizing:border-box;background:rgba(0,12,24,0.85);border:1px solid rgba(0,229,255,0.3);color:#e2f8ff;border-radius:4px;padding:3px 5px;" /></label>
            <label>Y(cm) <input id="stark-3d-ik-y" type="number" step="1" value="38" style="width:100%;box-sizing:border-box;background:rgba(0,12,24,0.85);border:1px solid rgba(0,229,255,0.3);color:#e2f8ff;border-radius:4px;padding:3px 5px;" /></label>
            <label>Z(cm) <input id="stark-3d-ik-z" type="number" step="1" value="10" style="width:100%;box-sizing:border-box;background:rgba(0,12,24,0.85);border:1px solid rgba(0,229,255,0.3);color:#e2f8ff;border-radius:4px;padding:3px 5px;" /></label>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button type="button" id="stark-3d-solve-ik-btn" class="s3d-btn" style="flex:1;">SOLVE IK</button>
            <button type="button" id="stark-3d-traj-play-btn" class="s3d-btn s3d-btn-success">PLAY</button>
            <button type="button" id="stark-3d-traj-step-btn" class="s3d-btn">STEP</button>
            <select id="stark-3d-traj-speed" style="background:rgba(0,12,24,0.9);border:1px solid rgba(0,229,255,0.35);color:#7df3ff;border-radius:4px;padding:3px;font-size:10.5px;">
              <option value="0.5">0.5x</option>
              <option value="1" selected>1x</option>
              <option value="2">2x</option>
            </select>
          </div>
          <div id="stark-3d-ik-output" style="margin-top:6px;font-size:11px;color:#cbd5e1;line-height:1.45;">Adjust X/Y/Z target or drag in Object Manipulation gesture mode, then click SOLVE IK.</div>
        </div>

        <!-- Mechanical Stress & Weakest-Joint Diagnostics -->
        <div class="s3d-inspector-card">
          <div class="s3d-sec-title"><span>STRESS & WEAKEST-LINK ANALYSIS</span><button type="button" id="stark-3d-run-stress-btn" class="s3d-btn" style="font-size:10px;padding:2px 7px;">ANALYZE</button></div>
          <div id="stark-3d-stress-output" style="font-size:11px;color:#cbd5e1;line-height:1.45;">Click ANALYZE to evaluate joint torque safety factors, weakest actuator, and cantilever beam deflection.</div>
        </div>

        <!-- Selected Component & Hierarchy Tree -->
        <div class="s3d-inspector-card">
          <div class="s3d-sec-title"><span>PART INSPECTOR (CLICK / POINT MESH)</span></div>
          <div id="stark-3d-part-inspector" style="font-size:11.5px;color:#94a3b8;line-height:1.5;">
            Click or point with Index Finger at any structural component, actuator, bearing, or end-effector in the 3D scene to inspect metadata.
          </div>
        </div>

        <!-- Scene-Aware VISION AI Analysis -->
        <div class="s3d-inspector-card">
          <div class="s3d-sec-title"><span>VISION SCENE ANALYSIS</span><button type="button" id="stark-3d-vision-ask-btn" class="s3d-btn" style="font-size:10px;padding:2px 7px;">EXPLAIN SELECTION</button></div>
          <div id="stark-3d-vision-output" style="font-size:11px;color:#cbd5e1;line-height:1.45;">Select a joint or part and click EXPLAIN SELECTION or ask via voice ("explain this joint", "which part is weakest?").</div>
        </div>

        <!-- Saved Designs Vault -->
        <div class="s3d-inspector-card">
          <div class="s3d-sec-title"><span>SAVED DESIGNS IN JARVIS</span><button type="button" id="stark-3d-vault-refresh-btn" class="s3d-btn" style="font-size:10px;padding:2px 7px;">REFRESH</button></div>
          <div id="stark-3d-vault-list" style="display:flex;flex-direction:column;gap:5px;max-height:160px;overflow-y:auto;"></div>
        </div>
      </aside>
    </div>

    <!-- Bottom Always-Visible Voice + Multimodal Fusion Command Strip -->
    <div style="display:flex;align-items:center;gap:10px;padding:8px 18px;border-top:1px solid rgba(0,229,255,0.28);background:rgba(0,14,30,0.94);">
      <span style="font-size:11px;font-weight:700;color:#00e5ff;letter-spacing:0.8px;">VOICE + GESTURE FUSION</span>
      <span id="stark-3d-voice-caption" style="flex:1;font-size:12px;color:#a5f3fc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Say "set this joint to 45 degrees", "zoom into gripper", "why can't it reach", or "open robotics lab"...</span>
      <input id="stark-3d-voice-input" type="text" placeholder="Type engineering or 3D command (e.g. 'front view', 'xray mode', 'which part is weakest?')..." style="width:360px;max-width:42vw;padding:6px 10px;background:rgba(0,18,36,0.92);border:1px solid rgba(0,229,255,0.38);border-radius:5px;color:#e2f1f8;font-size:12px;" />
      <button type="button" id="stark-3d-voice-send" class="s3d-btn">EXECUTE</button>
    </div>
    <div id="stark-3d-toast" style="position:fixed;bottom:58px;left:50%;transform:translateX(-50%);padding:8px 18px;background:rgba(6,40,32,0.94);border:1px solid #10b981;border-radius:6px;color:#6ee7b7;font-size:12px;font-weight:600;display:none;z-index:9600;"></div>
  `;
}
