/**
 * VISION AI — Interactive Holographic Robotics Lab & CAD Viewer
 * Owned by JARVIS — POWERED BY VISION (MADE BY LOKESH).
 *
 * Unified Three.js WebGL Workstation supporting:
 * - Mouse, keyboard, real-time 21-landmark hand gestures, and voice control on a single unified camera rig
 * - 15-Category Robotics Library + External OBJ/STL/GLB/GLTF import
 * - Solid / Wireframe / X-Ray / Exploded / Isolate / Axes & Dimension / 2-point Ruler Measurement modes
 * - FK/DLS IK solver + Reachability Sphere + Singularity Check + Trajectory Simulation Player
 * - Mechanical Stress/Torque/Weakest-Link Diagnostics & Scene-Aware VISION AI Analysis
 * - E-Stop latch & WebGL disposal
 */

import * as THREE from '../libs/three.module.js';
import { OBJLoader } from '../libs/three-addons/loaders/OBJLoader.js';
import { STLLoader } from '../libs/three-addons/loaders/STLLoader.js';
import { GLTFLoader } from '../libs/three-addons/loaders/GLTFLoader.js';
import { HandTrackingEngine } from './handTrackingEngine.js';
import { GestureController } from './gestureController.js';
import { HandHudOverlay } from './handHudOverlay.js';
import { LAB_MODES, buildRoboticsLabHtml, buildRoboticsLabStyles } from './roboticsLabTemplate.js';

export class Stark3DViewer {
  constructor() {
    this.modal = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null; 
    this.modelGroup = null;
    this.animFrameId = null;

    this.activeModel = null;
    this.isExploded = false;
    this.explodeFactor = 0;
    this.explodeProgress = 0;
    this.isAnimatingKinematics = false;
    this.isWireframe = false;
    this.isXRay = false;
    this.isIsolated = false;
    this.isRotating = true;
    this.showGrid = true;
    this.snapGrid = false;
    this.showDimsAxes = true;
    this.studioLight = false;
    this.currentTheme = 'holographic';
    this.activeLabMode = 'Explore';

    this.rotationSpeed = 0.0028;
    this.kinematicTime = 0;
    this.isDragging = false;
    this.isPanning = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.pointerDownPos = { x: 0, y: 0 };

    // Single unified camera controller state (driven equally by mouse, keyboard, gestures, and voice)
    this.camState = {
      azimuth: 0.42,
      elevation: 0.36,
      distance: 14.5,
      targetX: 0,
      targetY: 2.5,
      targetZ: 0,
      roll: 0,
      desiredAzimuth: 0.42,
      desiredElevation: 0.36,
      desiredDistance: 14.5,
      desiredTargetX: 0,
      desiredTargetY: 2.5,
      desiredTargetZ: 0,
      desiredRoll: 0
    };

    this.jointGroups = new Map();
    this.componentMeshes = [];
    this.gripperFingers = [];
    this.jointDefinitions = [];
    this.selectedJointId = null;
    this.selectedMesh = null;
    this.raycaster = new THREE.Raycaster();
    this.isSaving = false;
    this.catalogCache = [];

    // Simulation, IK & Measurement Overlays
    this.ikTargetMarker = null;
    this.workspaceSphere = null;
    this.dimBoundingBoxHelper = null;
    this.measureGroup = null;
    this.measurePins = [];
    this.trajectoryWaypoints = [];
    this.isPlayingTrajectory = false;
    this.trajIndex = 0;
    this.trajAccumulator = 0;
    this.trajSpeed = 1.0;
    this.lastIkReport = null;
    this.lastStressReport = null;
    this._gestureCursorTimeout = null;
    this._emergencyStopped = false;

    // Hand tracking & gesture intelligence
    this.handTracker = new HandTrackingEngine({
      isEmergencyStopActive: () => this._isEmergencyStopBlocked(),
      onStatusChange: (st) => this.handHud?.updateTrackingStatus(st),
      onFrameUpdate: (frame) => {
        this.gestureController?.processFrame(frame);
        this.handHud?.renderFrame(frame, this.gestureController?.state);
      }
    });
    this.gestureController = new GestureController({
      isEmergencyStopActive: () => this._isEmergencyStopBlocked(),
      onAction: (action) => this._handleGestureAction(action),
      onStateUpdate: (gs) => {
        if (this.handHud) this.handHud.renderFrame(this.handHud.lastFrame, gs);
      }
    });
    this.handHud = new HandHudOverlay({
      handTracker: this.handTracker,
      gestureController: this.gestureController,
      onCameraToggle: (res) => {
        if (res && !res.success && res.error) {
          this._showToast(res.error, true);
        } else if (res?.success) {
          this._showToast('VISION Hand Tracking Camera Active');
        }
      }
    });

    this._resizeHandler = () => this._handleResize();
    this._visibilityHandler = () => {
      if (document.hidden && this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      } else if (!document.hidden && this.modal && this.modal.style.display !== 'none' && !this.animFrameId) {
        this._startLoop();
      }
    };
  }

  get distance() {
    return this.camState.desiredDistance;
  }
  set distance(v) {
    const clamped = Math.max(4.5, Math.min(55, Number(v) || 14.5));
    this.camState.desiredDistance = clamped;
    this.camState.distance = clamped;
  }

  _isEmergencyStopBlocked() {
    return Boolean(this._emergencyStopped || window.jarvisApp?.emergencyStopCoordinator?.isEmergencyStopActive?.());
  }

  onEmergencyStop() {
    this._emergencyStopped = true;
    this.isAnimatingKinematics = false;
    this.isPlayingTrajectory = false;
    this.isRotating = false;
    this.handTracker?.onEmergencyStop?.();
    const simBadge = document.getElementById('stark-3d-sim-badge');
    if (simBadge) {
      simBadge.textContent = 'E-STOP HALTED';
      simBadge.style.color = '#f87171';
    }
    const rotBtn = document.getElementById('stark-3d-rot-btn');
    if (rotBtn) {
      rotBtn.textContent = 'ROTATION: OFF';
      rotBtn.setAttribute('aria-pressed', 'false');
    }
    this._announce('Emergency stop activated. All camera, hand gesture, and kinematic motion halted.');
    this._showToast('EMERGENCY STOP ACTIVE — Robotics motion & camera halted', true);
  }

  onEmergencyReset() {
    this._emergencyStopped = false;
    const simBadge = document.getElementById('stark-3d-sim-badge');
    if (simBadge) {
      simBadge.textContent = 'READY';
      simBadge.style.color = '#34d399';
    }
    this._showToast('Emergency Stop cleared — Robotics Lab ready');
  }

  _announce(text) {
    const lr = document.getElementById('stark-3d-live-status');
    if (lr && text) lr.textContent = String(text);
  }

  _createDOM() {
    if (this.modal) return;
    if (!document.getElementById('stark-3d-lab-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'stark-3d-lab-styles';
      styleEl.textContent = buildRoboticsLabStyles();
      document.head.appendChild(styleEl);
    }

    const modal = document.createElement('div');
    modal.id = 'stark-3d-modal';
    modal.innerHTML = buildRoboticsLabHtml();
    document.body.appendChild(modal);
    this.modal = modal;

    const canvasWrap = document.getElementById('stark-3d-canvas-container');
    if (canvasWrap) this.handHud.mount(canvasWrap);

    this._wireToolbarAndInputs();
    this._wireLabTabs();
    this._wireCanvasInteractions();
    this._loadRobotCatalog();
    this.gestureController.loadConfig();
    document.addEventListener('visibilitychange', this._visibilityHandler);
  }

  _wireToolbarAndInputs() {
    document.getElementById('stark-3d-close-btn').onclick = () => this.hide();

    const explodeBtn = document.getElementById('stark-3d-explode-btn');
    if (explodeBtn) {
      explodeBtn.onclick = () => {
        this.isExploded = !this.isExploded;
        this.explodeFactor = this.isExploded ? 1.0 : 0.0;
        const slider = document.getElementById('stark-3d-explode-slider');
        if (slider) slider.value = String(Math.round(this.explodeFactor * 100));
        const pct = document.getElementById('stark-3d-explode-pct');
        if (pct) pct.textContent = `${Math.round(this.explodeFactor * 100)}%`;
        explodeBtn.innerText = `EXPLODED: ${this.isExploded ? 'ON' : 'OFF'}`;
        explodeBtn.setAttribute('aria-pressed', String(this.isExploded));
        this._announce(`Exploded view ${this.isExploded ? 'enabled' : 'disabled'}`);
      };
    }

    const explodeSlider = document.getElementById('stark-3d-explode-slider');
    if (explodeSlider) {
      explodeSlider.addEventListener('input', () => {
        const pctVal = Number(explodeSlider.value);
        this.explodeFactor = pctVal / 100;
        this.isExploded = pctVal > 0;
        const pctEl = document.getElementById('stark-3d-explode-pct');
        if (pctEl) pctEl.textContent = `${pctVal}%`;
        if (explodeBtn) {
          explodeBtn.innerText = `EXPLODED: ${this.isExploded ? 'ON' : 'OFF'}`;
          explodeBtn.setAttribute('aria-pressed', String(this.isExploded));
        }
      });
    }

    const wfBtn = document.getElementById('stark-3d-wireframe-btn');
    if (wfBtn) {
      wfBtn.onclick = () => {
        this.isWireframe = !this.isWireframe;
        wfBtn.setAttribute('aria-pressed', String(this.isWireframe));
        this._updateMaterials();
      };
    }

    const xrayBtn = document.getElementById('stark-3d-xray-btn');
    if (xrayBtn) {
      xrayBtn.onclick = () => {
        this.isXRay = !this.isXRay;
        xrayBtn.setAttribute('aria-pressed', String(this.isXRay));
        this._updateMaterials();
      };
    }

    const isolateBtn = document.getElementById('stark-3d-isolate-btn');
    if (isolateBtn) {
      isolateBtn.onclick = () => {
        if (!this.selectedMesh && !this.isIsolated) {
          this._showToast('Select a part first to isolate it', true);
          return;
        }
        this.isIsolated = !this.isIsolated;
        isolateBtn.setAttribute('aria-pressed', String(this.isIsolated));
        this._updateMaterials();
      };
    }

    const gridBtn = document.getElementById('stark-3d-grid-btn');
    if (gridBtn) {
      gridBtn.onclick = () => {
        this.showGrid = !this.showGrid;
        if (this.gridHelper) this.gridHelper.visible = this.showGrid;
        if (this.baseRing) this.baseRing.visible = this.showGrid;
        gridBtn.innerText = `GRID: ${this.showGrid ? 'ON' : 'OFF'}`;
        gridBtn.setAttribute('aria-pressed', String(this.showGrid));
      };
    }

    const snapBtn = document.getElementById('stark-3d-snap-btn');
    if (snapBtn) {
      snapBtn.onclick = () => {
        this.snapGrid = !this.snapGrid;
        snapBtn.setAttribute('aria-pressed', String(this.snapGrid));
        this._showToast(`Grid snapping ${this.snapGrid ? 'enabled (5° / 1cm)' : 'disabled'}`);
      };
    }

    const dimsBtn = document.getElementById('stark-3d-dims-btn');
    if (dimsBtn) {
      dimsBtn.onclick = () => {
        this.showDimsAxes = !this.showDimsAxes;
        dimsBtn.setAttribute('aria-pressed', String(this.showDimsAxes));
        if (this.axesHelper) this.axesHelper.visible = this.showDimsAxes;
        if (this.dimBoundingBoxHelper) this.dimBoundingBoxHelper.visible = this.showDimsAxes;
      };
    }

    const lightBtn = document.getElementById('stark-3d-light-btn');
    if (lightBtn) {
      lightBtn.onclick = () => {
        this.studioLight = !this.studioLight;
        lightBtn.innerText = `LIGHT: ${this.studioLight ? 'STUDIO' : 'HOLOGRAPHIC'}`;
        lightBtn.setAttribute('aria-pressed', String(this.studioLight));
        if (this.hemiLight) this.hemiLight.intensity = this.studioLight ? 1.15 : 0.45;
        if (this.fillLight) this.fillLight.intensity = this.studioLight ? 1.55 : 0.65;
      };
    }

    const rotBtn = document.getElementById('stark-3d-rot-btn');
    if (rotBtn) {
      rotBtn.onclick = () => {
        this.isRotating = !this.isRotating;
        rotBtn.innerText = `ROTATION: ${this.isRotating ? 'ON' : 'OFF'}`;
        rotBtn.setAttribute('aria-pressed', String(this.isRotating));
      };
    }

    const animateBtn = document.getElementById('stark-3d-kinematics-btn');
    if (animateBtn) {
      animateBtn.onclick = () => {
        if (this._isEmergencyStopBlocked()) {
          this.onEmergencyStop();
          return;
        }
        this.isAnimatingKinematics = !this.isAnimatingKinematics;
        animateBtn.innerText = `KINEMATICS: ${this.isAnimatingKinematics ? 'ON' : 'OFF'}`;
        animateBtn.setAttribute('aria-pressed', String(this.isAnimatingKinematics));
      };
    }

    const resetBtn = document.getElementById('stark-3d-reset-btn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        this.isAnimatingKinematics = false;
        this.isPlayingTrajectory = false;
        if (animateBtn) {
          animateBtn.innerText = 'KINEMATICS: OFF';
          animateBtn.setAttribute('aria-pressed', 'false');
        }
        this._resetJointPose();
        this.setCameraPreset('iso');
      };
    }

    const themeBtn = document.getElementById('stark-3d-theme-btn');
    if (themeBtn) {
      themeBtn.onclick = () => {
        this.currentTheme = this.currentTheme === 'holographic' ? 'titanium' : 'holographic';
        themeBtn.innerText = `THEME: ${this.currentTheme.toUpperCase()}`;
        this._updateMaterials();
      };
    }

    document.getElementById('stark-3d-save-btn').onclick = () => this.saveCurrentModel(false);
    document.getElementById('stark-3d-saveas-btn').onclick = () => this.saveCurrentModel(true);
    document.getElementById('stark-3d-snapshot-btn').onclick = () => this._captureSnapshotPng();
    document.getElementById('stark-3d-vault-refresh-btn').onclick = () => this.refreshSavedVault();

    document.querySelectorAll('.stark-3d-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => this._applyPresetPose(btn.dataset.preset));
    });
    document.querySelectorAll('.stark-3d-grip-preset').forEach(btn => {
      btn.addEventListener('click', () => this._applyGripPreset(btn.dataset.grip));
    });
    document.querySelectorAll('.stark-3d-cam-preset').forEach(btn => {
      btn.addEventListener('click', () => this.setCameraPreset(btn.dataset.camPreset));
    });

    document.getElementById('stark-3d-export-obj-btn').onclick = () => this._triggerDownload('obj');
    document.getElementById('stark-3d-export-stl-btn').onclick = () => this._triggerDownload('stl');
    document.getElementById('stark-3d-export-glb-btn').onclick = () => this._triggerDownload('glb');
    document.getElementById('stark-3d-export-spec-btn').onclick = () => this._triggerDownload('spec');

    const importBtn = document.getElementById('stark-3d-import-btn');
    const importFile = document.getElementById('stark-3d-import-file');
    if (importBtn && importFile) {
      importBtn.onclick = () => importFile.click();
      importFile.addEventListener('change', async (e) => {
        const f = e.target.files?.[0];
        if (f) await this._handleImportFile(f);
        importFile.value = '';
      });
    }

    document.getElementById('stark-3d-load-catalog-btn')?.addEventListener('click', async () => {
      const sel = document.getElementById('stark-3d-robot-catalog-select');
      if (sel && sel.value) await this.loadRobotArchetype(sel.value);
    });

    document.getElementById('stark-3d-solve-ik-btn')?.addEventListener('click', () => this.solveIkFromInputs());
    document.getElementById('stark-3d-traj-play-btn')?.addEventListener('click', () => this._toggleTrajectoryPlayback());
    document.getElementById('stark-3d-traj-step-btn')?.addEventListener('click', () => this._stepTrajectory());
    document.getElementById('stark-3d-traj-speed')?.addEventListener('change', (e) => {
      this.trajSpeed = Number(e.target.value) || 1.0;
    });
    document.getElementById('stark-3d-run-stress-btn')?.addEventListener('click', () => this.runStressAnalysis());
    document.getElementById('stark-3d-vision-ask-btn')?.addEventListener('click', () => this.explainCurrentSelection());

    const voiceInput = document.getElementById('stark-3d-voice-input');
    const voiceSend = document.getElementById('stark-3d-voice-send');
    const dispatchCmd = () => {
      const val = voiceInput ? voiceInput.value.trim() : '';
      if (!val) return;
      voiceInput.value = '';
      if (!this.execute3dDirective(val) && window.jarvisApp?.submitMainChatQuery) {
        window.jarvisApp.submitMainChatQuery(val);
      }
    };
    if (voiceSend) voiceSend.onclick = dispatchCmd;
    if (voiceInput) {
      voiceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          dispatchCmd();
        }
      });
    }
  }

  _wireLabTabs() {
    const tablist = document.getElementById('stark-3d-lab-tablist');
    if (!tablist) return;
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));

    const activate = (tab) => {
      tabs.forEach(t => {
        const selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        t.setAttribute('tabindex', selected ? '0' : '-1');
      });
      this.setLabMode(tab.dataset.labMode || 'Explore');
    };

    tabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', (e) => {
        let nextIdx = -1;
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = tabs.length - 1;
        if (nextIdx >= 0) {
          e.preventDefault();
          tabs[nextIdx].focus();
          activate(tabs[nextIdx]);
        }
      });
    });
  }

  setLabMode(mode) {
    this.activeLabMode = mode;
    if (mode === 'Gesture') {
      this.gestureController.setSubmode('Camera Control');
    } else if (mode === 'Joint Control') {
      this.gestureController.setSubmode('Joint Control');
    } else if (mode === 'Simulation') {
      if (this.workspaceSphere) this.workspaceSphere.visible = true;
      if (this.ikTargetMarker) this.ikTargetMarker.visible = true;
    } else if (mode === 'Engineering') {
      this.runStressAnalysis();
    } else if (mode === 'Exploded View') {
      if (!this.isExploded) document.getElementById('stark-3d-explode-btn')?.click();
    } else if (mode === 'Vision Analysis') {
      this.explainCurrentSelection();
    } else if (mode === 'Presentation') {
      this.gestureController.setSubmode('Presentation');
      this.isRotating = true;
    }
    this._announce(`Switched to ${mode} lab mode`);
  }

  _wireCanvasInteractions() {
    const container = document.getElementById('stark-3d-canvas-container');
    if (container) {
      container.addEventListener('contextmenu', (e) => e.preventDefault());
      container.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.isPanning = e.button === 2 || e.shiftKey;
        this.prevMousePos = { x: e.clientX, y: e.clientY };
        this.pointerDownPos = { x: e.clientX, y: e.clientY };
      });
      window.addEventListener('mouseup', (e) => {
        const wasDragging = this.isDragging;
        this.isDragging = false;
        this.isPanning = false;
        if (wasDragging && Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y) < 5) {
          this._handleCanvasClick(e);
        }
      });
      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.prevMousePos.x;
        const dy = e.clientY - this.prevMousePos.y;
        this.prevMousePos = { x: e.clientX, y: e.clientY };
        if (this.isPanning) {
          this.camState.desiredTargetX -= dx * 0.014;
          this.camState.desiredTargetY += dy * 0.014;
        } else {
          this.camState.desiredAzimuth -= dx * 0.01;
          this.camState.desiredElevation = Math.max(-1.25, Math.min(1.42, this.camState.desiredElevation + dy * 0.01));
        }
      });
      container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.2 : -1.2;
        this.camState.desiredDistance = Math.max(4.5, Math.min(55, this.camState.desiredDistance + factor));
      }, { passive: false });
    }

    window.addEventListener('keydown', (e) => {
      if (!this.modal || this.modal.style.display === 'none') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'r' || e.key === 'R') this.setCameraPreset('iso');
      else if (e.key === '1') this.setCameraPreset('front');
      else if (e.key === '2') this.setCameraPreset('side');
      else if (e.key === '3') this.setCameraPreset('top');
      else if (e.key === 'ArrowLeft') this.camState.desiredAzimuth -= 0.14;
      else if (e.key === 'ArrowRight') this.camState.desiredAzimuth += 0.14;
      else if (e.key === 'ArrowUp') this.camState.desiredElevation = Math.min(1.4, this.camState.desiredElevation + 0.1);
      else if (e.key === 'ArrowDown') this.camState.desiredElevation = Math.max(-1.2, this.camState.desiredElevation - 0.1);
    });
    window.addEventListener('resize', this._resizeHandler);
  }

  setCameraPreset(preset = 'iso') {
    const presets = {
      iso: { azimuth: 0.52, elevation: 0.38, distance: 14.5, targetX: 0, targetY: 2.5, targetZ: 0, roll: 0 },
      front: { azimuth: 0, elevation: 0.08, distance: 13.5, targetX: 0, targetY: 2.5, targetZ: 0, roll: 0 },
      side: { azimuth: Math.PI / 2, elevation: 0.08, distance: 13.5, targetX: 0, targetY: 2.5, targetZ: 0, roll: 0 },
      top: { azimuth: 0, elevation: 1.42, distance: 16.0, targetX: 0, targetY: 1.5, targetZ: 0, roll: 0 },
      center: { azimuth: 0.42, elevation: 0.36, distance: 14.5, targetX: 0, targetY: 2.5, targetZ: 0, roll: 0 }
    };
    const p = presets[preset] || presets.iso;
    this.camState.desiredAzimuth = p.azimuth;
    this.camState.desiredElevation = p.elevation;
    this.camState.desiredDistance = p.distance;
    this.camState.desiredTargetX = p.targetX;
    this.camState.desiredTargetY = p.targetY;
    this.camState.desiredTargetZ = p.targetZ;
    this.camState.desiredRoll = p.roll;
    this._showToast(`Camera Preset: ${preset.toUpperCase()}`);
  }

  _handleGestureAction(action) {
    if (!action || this._isEmergencyStopBlocked()) return;
    const cursorEl = document.getElementById('stark-3d-gesture-cursor');

    if (action.pointerNdc && cursorEl) {
      const px = ((action.pointerNdc.x + 1) * 0.5) * 100;
      const py = ((-action.pointerNdc.y + 1) * 0.5) * 100;
      cursorEl.style.left = `${Math.max(2, Math.min(98, px))}%`;
      cursorEl.style.top = `${Math.max(2, Math.min(98, py))}%`;
      cursorEl.style.display = 'block';
      clearTimeout(this._gestureCursorTimeout);
      this._gestureCursorTimeout = setTimeout(() => {
        if (cursorEl) cursorEl.style.display = 'none';
      }, 900);
    }

    switch (action.type) {
      case 'camera_orbit':
        this.camState.desiredAzimuth += action.deltaAzimuth || 0;
        this.camState.desiredElevation = Math.max(-1.25, Math.min(1.42, this.camState.desiredElevation + (action.deltaElevation || 0)));
        if (action.deltaRoll) this.camState.desiredRoll += action.deltaRoll;
        break;
      case 'camera_zoom':
        this.camState.desiredDistance = Math.max(4.5, Math.min(55, this.camState.desiredDistance + (action.deltaDistance || 0)));
        break;
      case 'two_hand_transform':
        this.camState.desiredDistance = Math.max(4.5, Math.min(55, this.camState.desiredDistance + (action.deltaZoom || 0)));
        this.camState.desiredAzimuth += action.deltaAzimuth || 0;
        this.camState.desiredTargetX += action.deltaPanX || 0;
        this.camState.desiredTargetY += action.deltaPanY || 0;
        break;
      case 'hover_raycast':
      case 'point_select':
        if (action.pointerNdc && this.camera && this.componentMeshes.length) {
          this.raycaster.setFromCamera(new THREE.Vector2(action.pointerNdc.x, action.pointerNdc.y), this.camera);
          const hits = this.raycaster.intersectObjects(this.componentMeshes, false);
          if (hits.length > 0 && action.type === 'point_select') {
            this._selectComponentMesh(hits[0].object);
          }
        }
        break;
      case 'cycle_joint_select':
        if (this.jointDefinitions.length > 0) {
          const curIdx = this.jointDefinitions.findIndex(j => j.id === this.selectedJointId);
          const next = this.jointDefinitions[(curIdx + 1) % this.jointDefinitions.length];
          this.selectedJointId = next.id;
          this._showToast(`Selected Joint: ${next.label}`);
        }
        break;
      case 'adjust_active_joint': {
        const targetId = this.selectedJointId || this.jointDefinitions[0]?.id;
        const j = this.jointDefinitions.find(x => x.id === targetId);
        const slider = targetId ? document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${targetId}"]`) : null;
        if (j && slider) {
          const cur = Number(slider.value);
          let next = Math.max(j.minDeg ?? -180, Math.min(j.maxDeg ?? 180, cur + (action.deltaDeg || 0)));
          if (this.snapGrid) next = Math.round(next / 5) * 5;
          slider.value = String(Math.round(next));
          this._setJointValue(j.id, next);
        }
        break;
      }
      case 'drag_ik_or_object': {
        const ix = document.getElementById('stark-3d-ik-x');
        const iy = document.getElementById('stark-3d-ik-y');
        if (ix && iy) {
          ix.value = String(Math.round(Number(ix.value) + (action.deltaX || 0) * 8));
          iy.value = String(Math.max(4, Math.round(Number(iy.value) + (action.deltaY || 0) * 8)));
          if (this.ikTargetMarker) {
            this.ikTargetMarker.visible = true;
            this.ikTargetMarker.position.set(Number(ix.value) / 10, Number(iy.value) / 10, Number(document.getElementById('stark-3d-ik-z')?.value || 10) / 10);
          }
        }
        break;
      }
      case 'toggle_gripper': {
        const gripJoint = this.jointDefinitions.find(j => j.axis === 'grip');
        const slider = gripJoint ? document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${gripJoint.id}"]`) : null;
        if (gripJoint && slider) {
          const isClosed = Number(slider.value) < (gripJoint.maxDeg || 40) * 0.4;
          const next = isClosed ? (gripJoint.maxDeg || 40) : (gripJoint.minDeg || 2);
          slider.value = String(next);
          this._setJointValue(gripJoint.id, next);
          this._showToast(`Gripper ${isClosed ? 'OPENED' : 'CLOSED'} via fist gesture`);
        }
        break;
      }
      case 'drop_measure_pin':
        if (action.pointerNdc) this._dropMeasurePinAtNdc(action.pointerNdc);
        break;
      case 'cycle_preset': {
        const order = ['iso', 'front', 'side', 'top'];
        const cur = order.indexOf(this._lastCamPreset || 'iso');
        const next = order[(cur + (action.direction > 0 ? 1 : order.length - 1)) % order.length];
        this._lastCamPreset = next;
        this.setCameraPreset(next);
        break;
      }
      case 'confirm':
        if (this.trajectoryWaypoints.length) this._toggleTrajectoryPlayback();
        else this.solveIkFromInputs();
        break;
      case 'cancel':
        this._clearMeasurePins();
        if (this.isIsolated) {
          this.isIsolated = false;
          this._updateMaterials();
        }
        break;
      default:
        break;
    }
  }

  async _loadRobotCatalog() {
    const sel = document.getElementById('stark-3d-robot-catalog-select');
    const countEl = document.getElementById('stark-3d-catalog-count');
    const descEl = document.getElementById('stark-3d-catalog-desc');
    if (!sel) return;
    try {
      const res = await fetch('/api/3d-model/catalog');
      const data = await res.json();
      if (!data?.success || !Array.isArray(data.catalog)) return;
      this.catalogCache = data.catalog;
      if (countEl) countEl.textContent = `${data.catalog.length} ROBOTS`;
      sel.innerHTML = data.catalog.map(c => `<option value="${c.archetype}">${c.title} (${c.dof} DOF)</option>`).join('');
      const syncDesc = () => {
        const found = this.catalogCache.find(x => x.archetype === sel.value);
        if (descEl && found) {
          const badge = found.geometryProvenance === 'engineering_parametric' ? 'Engineering Parametric' : 'Conceptual Approximation';
          descEl.textContent = `[${badge}] ${found.description}`;
        }
      };
      sel.addEventListener('change', syncDesc);
      syncDesc();
    } catch (_) {}
  }

  async loadRobotArchetype(archetype, descriptionOverride = null) {
    try {
      const catalogItem = this.catalogCache.find(c => c.archetype === archetype);
      let headers = { 'Content-Type': 'application/json' };
      try {
        if (!this._cachedAuthToken) {
          const authRes = await fetch('/api/auth/session');
          const authData = await authRes.json();
          if (authData?.token) this._cachedAuthToken = authData.token;
        }
        if (this._cachedAuthToken) headers['X-Stark-Auth-Token'] = this._cachedAuthToken;
      } catch (_) {}
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          toolName: 'create_3d_model',
          params: {
            description: descriptionOverride || catalogItem?.title || archetype,
            archetype,
            theme: this.currentTheme || 'holographic'
          },
          personality: 'JARVIS'
        })
      });
      const data = await res.json();
      if (data?.success && data.result) {
        this.showModel(data.result.geometrySpec ? data.result : data.result.model);
        this._showToast(`Loaded ${catalogItem?.title || archetype}`);
        return data.result;
      }
    } catch (err) {
      this._showToast(`Failed to load robot: ${err.message}`, true);
    }
    return null;
  }

  async _handleImportFile(file) {
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/3d-model/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, dataBase64: base64, theme: this.currentTheme })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        this._showToast(data?.error || `Import failed (${res.status})`, true);
        return;
      }
      this.showModel(data.model || data);
      this._showToast(data.summary || `Imported ${file.name}`);
    } catch (err) {
      this._showToast(`Import error: ${err.message}`, true);
    }
  }

  async solveIkFromInputs() {
    if (this._isEmergencyStopBlocked()) {
      this.onEmergencyStop();
      return null;
    }
    if (!this.activeModel?.geometrySpec) return null;
    const x = (Number(document.getElementById('stark-3d-ik-x')?.value) || 22) / 10;
    const y = (Number(document.getElementById('stark-3d-ik-y')?.value) || 38) / 10;
    const z = (Number(document.getElementById('stark-3d-ik-z')?.value) || 10) / 10;

    if (this.ikTargetMarker) {
      this.ikTargetMarker.visible = true;
      this.ikTargetMarker.position.set(x, y, z);
    }

    const out = document.getElementById('stark-3d-ik-output');
    try {
      const res = await fetch('/api/robotics/ik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometrySpec: this.activeModel.geometrySpec,
          targetScene: [x, y, z],
          currentJointAngles: this._collectCurrentJointStates()
        })
      });
      const data = await res.json();
      this.lastIkReport = data;
      if (!res.ok || !data?.success) {
        if (out) out.innerHTML = `<span style="color:#f87171;">${data?.error || 'IK solve error'}</span>`;
        return null;
      }
      this.trajectoryWaypoints = Array.isArray(data.trajectoryWaypoints) ? data.trajectoryWaypoints : [];
      this.trajIndex = 0;

      // Apply solved pose immediately & update sliders
      for (const [jId, ang] of Object.entries(data.jointAnglesDeg || {})) {
        this._setJointValue(jId, ang);
        const slider = document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${jId}"]`);
        if (slider) slider.value = String(Math.round(ang));
      }

      if (this.workspaceSphere) {
        const radiusScene = Math.max(1.0, (data.maxReachMm || 650) / 100);
        this.workspaceSphere.scale.setScalar(radiusScene);
        this.workspaceSphere.visible = true;
      }

      if (out) {
        const statusColor = data.converged ? '#34d399' : '#fbbf24';
        out.innerHTML = `
          <div style="color:${statusColor};font-weight:700;">${data.reachable ? 'REACHABLE' : 'CONSTRAINED'} • Err ${data.residualErrorMm} mm • Collisions: ${data.collisionWarnings || 0}</div>
          <div>${data.explanation}</div>
          <div style="color:#7dd3fc;margin-top:3px;">Trajectory: ${this.trajectoryWaypoints.length} waypoints ready (${data.nearSingularity ? 'SINGULARITY RISK' : 'Singularity Clear'})</div>
        `;
      }
      return data;
    } catch (err) {
      if (out) out.textContent = `IK error: ${err.message}`;
      return null;
    }
  }

  _toggleTrajectoryPlayback() {
    if (this._isEmergencyStopBlocked()) {
      this.onEmergencyStop();
      return;
    }
    if (!this.trajectoryWaypoints.length) {
      this.solveIkFromInputs();
      return;
    }
    this.isPlayingTrajectory = !this.isPlayingTrajectory;
    const btn = document.getElementById('stark-3d-traj-play-btn');
    if (btn) btn.textContent = this.isPlayingTrajectory ? 'PAUSE' : 'PLAY';
  }

  _stepTrajectory() {
    if (this._isEmergencyStopBlocked() || !this.trajectoryWaypoints.length) return;
    this.trajIndex = (this.trajIndex + 1) % this.trajectoryWaypoints.length;
    const wp = this.trajectoryWaypoints[this.trajIndex];
    for (const [jId, ang] of Object.entries(wp.jointAngles || {})) {
      this._setJointValue(jId, ang);
      const slider = document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${jId}"]`);
      if (slider) slider.value = String(Math.round(ang));
    }
    const badge = document.getElementById('stark-3d-sim-badge');
    if (badge) {
      badge.textContent = wp.collision ? `STEP ${wp.step}: COLLISION!` : `STEP ${wp.step}/${this.trajectoryWaypoints.length - 1}`;
      badge.style.color = wp.collision ? '#f87171' : '#34d399';
    }
  }

  async runStressAnalysis() {
    const out = document.getElementById('stark-3d-stress-output');
    if (!this.activeModel?.geometrySpec || !out) return null;
    try {
      const res = await fetch('/api/robotics/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometrySpec: this.activeModel.geometrySpec,
          jointAngles: this._collectCurrentJointStates(),
          payloadKg: this.activeModel.geometrySpec?.engineeringSummary?.recommendedPayloadKg ?? 1.5
        })
      });
      const data = await res.json();
      this.lastStressReport = data;
      if (!res.ok || !data?.success) {
        out.textContent = data?.error || 'Stress evaluation unavailable.';
        return null;
      }
      const w = data.weakestJoint;
      out.innerHTML = `
        <div><strong>Weakest Joint:</strong> <span style="color:${w?.status === 'OVERLOADED' ? '#f87171' : '#fbbf24'};">${w?.label || 'N/A'}</span> (Req ${w?.estimatedLoadTorqueNm ?? 0} Nm / Cap ${w?.estimatedActuatorCapacityNm ?? 0} Nm, SF=${w?.safetyFactor ?? 'N/A'})</div>
        <div><strong>Cantilever Deflection:</strong> ${data.beamDeflectionMm} mm (Structural SF ${data.beamSafetyFactor})</div>
        <div style="color:#94a3b8;font-size:10px;margin-top:3px;">${data.engineeringNote}</div>
      `;
      return data;
    } catch (err) {
      out.textContent = `Stress error: ${err.message}`;
      return null;
    }
  }

  async explainCurrentSelection(customQuestion = null) {
    const out = document.getElementById('stark-3d-vision-output');
    if (!out) return null;
    try {
      const ctx = this.getSceneContext();
      const res = await fetch('/api/robotics/scene-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: customQuestion || 'Explain the selected component/joint, mechanical stress margin, and configuration.',
          sceneContext: ctx
        })
      });
      const data = await res.json();
      if (data?.success && data.answer) {
        out.innerHTML = `<div style="color:#a5f3fc;">${data.answer}</div>`;
        this.setVoiceCaption(data.answer);
        return data;
      }
    } catch (err) {
      out.textContent = `Scene analysis error: ${err.message}`;
    }
    return null;
  }

  getSceneContext() {
    const comp = this.selectedMesh?.userData?.comp || null;
    const jId = this.selectedJointId || comp?.parentJoint || this.jointDefinitions[0]?.id || null;
    const joint = this.jointDefinitions.find(j => j.id === jId) || null;
    return {
      modelId: this.activeModel?.modelId || null,
      modelName: this.activeModel?.name || null,
      archetype: this.activeModel?.archetype || null,
      activeLabMode: this.activeLabMode,
      gestureSubmode: this.gestureController?.state?.submode || 'Camera Control',
      partCount: this.componentMeshes.length,
      jointCount: this.jointDefinitions.length,
      selectedPart: comp,
      selectedJoint: joint,
      jointAngles: this._collectCurrentJointStates(),
      geometrySpec: this.activeModel?.geometrySpec || null,
      lastIkReport: this.lastIkReport,
      lastStressReport: this.lastStressReport
    };
  }

  _collectCurrentJointStates() {
    const pose = {};
    for (const j of this.jointDefinitions || []) {
      const slider = document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${j.id}"]`);
      pose[j.id] = slider ? Number(slider.value) : Number(j.defaultDeg ?? 0);
    }
    return pose;
  }

  async saveCurrentModel(saveAsNew = false) {
    if (!this.activeModel || !this.activeModel.modelId || this.isSaving) return null;
    this.isSaving = true;
    const saveBtn = document.getElementById('stark-3d-save-btn');
    const statusEl = document.getElementById('stark-3d-save-status');
    const nameInput = document.getElementById('stark-3d-name-input');
    const notesInput = document.getElementById('stark-3d-notes-input');
    if (saveBtn) saveBtn.innerText = 'SAVING...';
    if (statusEl) {
      statusEl.textContent = 'Saving to JARVIS...';
      statusEl.style.color = '#fbbf24';
    }

    const baseName = (nameInput?.value || this.activeModel.name || this.activeModel.archetype || 'design').trim();
    const targetName = saveAsNew ? `${baseName}_v${Math.floor(Date.now() / 1000) % 1000}` : baseName;

    const payload = {
      name: targetName,
      notes: notesInput ? notesInput.value : (this.activeModel.notes || ''),
      theme: this.currentTheme,
      saveAsNew: Boolean(saveAsNew),
      jointStates: this._collectCurrentJointStates(),
      viewState: {
        exploded: this.isExploded,
        wireframe: this.isWireframe,
        showGrid: this.showGrid,
        studioLight: this.studioLight,
        cameraDistance: this.distance,
        modelRotation: this.modelGroup ? {
          x: Number(this.modelGroup.rotation.x.toFixed(4)),
          y: Number(this.modelGroup.rotation.y.toFixed(4)),
          z: Number(this.modelGroup.rotation.z.toFixed(4))
        } : undefined
      }
    };

    try {
      const res = await fetch(`/api/3d-model/${encodeURIComponent(this.activeModel.modelId)}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data.model) throw new Error(data?.error || `HTTP ${res.status}`);

      this.activeModel = data.model;
      if (nameInput) nameInput.value = data.model.name || targetName;
      const titleEl = document.getElementById('stark-3d-title-badge');
      if (titleEl) titleEl.innerText = `${(data.model.name || 'MODEL').toUpperCase()} • SAVED`;
      await this.refreshSavedVault();
      if (statusEl) {
        statusEl.textContent = `Saved in JARVIS • ${new Date(data.model.savedAt || Date.now()).toLocaleTimeString()}`;
        statusEl.style.color = '#34d399';
      }
      if (saveBtn) saveBtn.innerText = 'SAVED ✓';
      setTimeout(() => { if (saveBtn) saveBtn.innerText = 'SAVE IN JARVIS'; }, 2200);
      this._showToast(`Saved "${data.model.name}" inside JARVIS CAD Vault`);
      return data.model;
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `Save failed: ${err.message}`;
        statusEl.style.color = '#f87171';
      }
      if (saveBtn) saveBtn.innerText = 'SAVE IN JARVIS';
      this._showToast(`Save failed: ${err.message}`, true);
      return null;
    } finally {
      this.isSaving = false;
    }
  }

  async refreshSavedVault() {
    const listEl = document.getElementById('stark-3d-vault-list');
    if (!listEl) return;
    try {
      const res = await fetch('/api/3d-model/list');
      const data = await res.json();
      const models = Array.isArray(data?.models) ? data.models : [];
      if (!models.length) {
        listEl.innerHTML = '<div style="color:#64748b;">No saved 3D models yet. Click SAVE IN JARVIS to persist this assembly.</div>';
        return;
      }
      const ordered = models.slice().sort((a, b) => {
        const aScore = (a.saved ? 2 : 0) + (this.activeModel?.modelId === a.modelId ? 1 : 0);
        const bScore = (b.saved ? 2 : 0) + (this.activeModel?.modelId === b.modelId ? 1 : 0);
        if (bScore !== aScore) return bScore - aScore;
        return new Date(b.savedAt || b.createdAt || 0).getTime() - new Date(a.savedAt || a.createdAt || 0).getTime();
      });
      listEl.innerHTML = '';
      for (const m of ordered.slice(0, 15)) {
        const isCurrent = this.activeModel && this.activeModel.modelId === m.modelId;
        const item = document.createElement('div');
        item.style.cssText = `display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;border:1px solid ${isCurrent ? 'rgba(0,255,170,0.55)' : 'rgba(0,229,255,0.2)'};background:${isCurrent ? 'rgba(0,255,170,0.08)' : 'rgba(2,10,22,0.65)'};`;
        const stamp = m.savedAt ? `SAVED • ${new Date(m.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : (m.archetype || 'generated');
        item.innerHTML = `
          <div style="min-width:0;flex:1;">
            <div style="color:#e2e8f0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.name || m.modelId}</div>
            <div style="font-size:10px;color:${m.saved ? '#34d399' : '#7dd3fc'};">${stamp}</div>
          </div>
          <button type="button" class="stark-3d-vault-open-btn" data-model-id="${m.modelId}" style="background:rgba(0,229,255,0.14);border:1px solid #00e5ff;color:#7dd3fc;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:700;">${isCurrent ? 'ACTIVE' : 'OPEN'}</button>
        `;
        item.querySelector('button').onclick = async () => this.loadModelById(m.modelId);
        listEl.appendChild(item);
      }
    } catch (err) {
      listEl.innerHTML = `<div style="color:#f87171;">Failed to load vault: ${err.message}</div>`;
    }
  }

  async loadModelById(modelId) {
    if (!modelId) return null;
    try {
      const res = await fetch(`/api/3d-model/${encodeURIComponent(modelId)}`);
      const data = await res.json();
      if (!res.ok || !data?.success || !data.model) throw new Error(data?.error || 'Not found');
      this.showModel(data.model);
      this._showToast(`Loaded "${data.model.name}" from JARVIS Vault`);
      return data.model;
    } catch (err) {
      this._showToast(`Load failed: ${err.message}`, true);
      return null;
    }
  }

  _showToast(msg, isError = false) {
    const el = document.getElementById('stark-3d-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#fecaca' : '#6ee7b7';
    el.style.background = isError ? 'rgba(65,16,20,0.94)' : 'rgba(6,40,32,0.94)';
    el.style.borderColor = isError ? '#ef4444' : '#10b981';
    el.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3400);
  }

  setVoiceCaption(text) {
    const cap = document.getElementById('stark-3d-voice-caption');
    if (cap && text) cap.textContent = String(text);
  }

  syncVoiceBadge(label, color = '#64748b', isPulsing = false) {
    const dot = document.getElementById('stark-3d-voice-dot');
    const txt = document.getElementById('stark-3d-voice-label');
    const pill = document.getElementById('stark-3d-voice-pill');
    if (txt && label) txt.textContent = `JARVIS: ${label}`;
    if (dot) {
      dot.style.backgroundColor = color;
      dot.style.boxShadow = isPulsing ? `0 0 10px ${color}` : 'none';
    }
    if (pill) pill.style.borderColor = color;
  }

  _captureSnapshotPng() {
    if (!this.renderer || !this.renderer.domElement) return;
    if (this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${this.activeModel?.name || 'vision_cad'}_snapshot.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    this._showToast('Captured high-res PNG snapshot');
  }

  _applyPresetPose(preset) {
    if (this._isEmergencyStopBlocked()) {
      this.onEmergencyStop();
      return;
    }
    if (!this.jointDefinitions.length) return;
    this.isAnimatingKinematics = false;
    const animateBtn = document.getElementById('stark-3d-kinematics-btn');
    if (animateBtn) {
      animateBtn.innerText = 'KINEMATICS: OFF';
      animateBtn.setAttribute('aria-pressed', 'false');
    }
    const presetMaps = {
      home: [0, 0, 0, 0, 0, 20],
      pick: [18, -32, 74, 24, 0, 42],
      reach: [0, 42, -28, -12, 0, 35],
      stow: [-45, -72, 110, 40, 0, 5]
    };
    const vals = presetMaps[preset] || presetMaps.home;
    this.jointDefinitions.forEach((j, idx) => {
      const target = idx < vals.length ? vals[idx] : (j.defaultDeg ?? 0);
      const clamped = Math.max(j.minDeg ?? -180, Math.min(j.maxDeg ?? 180, target));
      this._setJointValue(j.id, clamped);
      const slider = document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${j.id}"]`);
      if (slider) slider.value = String(clamped);
    });
    const poseMeta = document.getElementById('stark-3d-meta-pose');
    if (poseMeta) poseMeta.textContent = `POSE: ${(preset || 'home').toUpperCase()}`;
    this._showToast(`Applied ${(preset || 'home').toUpperCase()} pose`);
  }

  _applyGripPreset(mode) {
    if (this._isEmergencyStopBlocked()) {
      this.onEmergencyStop();
      return;
    }
    const gripPresets = this.activeModel?.geometrySpec?.gripPresets;
    if (gripPresets && gripPresets[mode]) {
      for (const [jId, ang] of Object.entries(gripPresets[mode])) {
        this._setJointValue(jId, ang);
        const slider = document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${jId}"]`);
        if (slider) slider.value = String(ang);
      }
      this._showToast(`Applied Hand Grip Preset: ${mode.toUpperCase()}`);
      return;
    }
    const gripJoint = this.jointDefinitions.find(j => j.axis === 'grip');
    if (gripJoint) {
      const map = { open: gripJoint.maxDeg ?? 40, pinch: 14, power: 4, precision: 18 };
      const val = Math.max(gripJoint.minDeg ?? 0, Math.min(gripJoint.maxDeg ?? 45, map[mode] ?? 20));
      this._setJointValue(gripJoint.id, val);
      const slider = document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${gripJoint.id}"]`);
      if (slider) slider.value = String(val);
      this._showToast(`Gripper ${mode.toUpperCase()} (${val}mm)`);
    }
  }

  execute3dDirective(text) {
    if (!this.modal || this.modal.style.display === 'none') return false;
    const low = String(text || '').toLowerCase().trim();
    if (!low) return false;

    if (/\bsave\b.*\bas\b|\bsave\s+new\b|\bsave\s+copy\b/.test(low)) { this.saveCurrentModel(true); return true; }
    if (/\bsave\b.*\b(model|3d|cad|design|this|pose|it|jarvis)\b|^save$/.test(low)) { this.saveCurrentModel(false); return true; }
    if (/\breset\b.*\bpose\b|\bhome\b.*\bpose\b/.test(low)) { this._resetJointPose(); return true; }
    if (/\bexplode\b/.test(low)) { document.getElementById('stark-3d-explode-btn')?.click(); return true; }
    if (/\btitanium\b/.test(low)) {
      this.currentTheme = 'titanium';
      const tb = document.getElementById('stark-3d-theme-btn');
      if (tb) tb.innerText = 'THEME: TITANIUM';
      this._updateMaterials();
      return true;
    }
    if (/\bholographic\b|\bholo\b/.test(low)) {
      this.currentTheme = 'holographic';
      const tb = document.getElementById('stark-3d-theme-btn');
      if (tb) tb.innerText = 'THEME: HOLOGRAPHIC';
      this._updateMaterials();
      return true;
    }
    if (/\bwireframe\b/.test(low)) { document.getElementById('stark-3d-wireframe-btn')?.click(); return true; }
    if (/\bx[\s-]*ray\b|\btransparent\b/.test(low)) { document.getElementById('stark-3d-xray-btn')?.click(); return true; }
    if (/\bisolate\b/.test(low)) { document.getElementById('stark-3d-isolate-btn')?.click(); return true; }
    if (/\bfront\s+view\b|^front$/.test(low)) { this.setCameraPreset('front'); return true; }
    if (/\bside\s+view\b|^side$/.test(low)) { this.setCameraPreset('side'); return true; }
    if (/\btop\s+view\b|^top$/.test(low)) { this.setCameraPreset('top'); return true; }
    if (/\bisometric\b|\biso\s+view\b/.test(low)) { this.setCameraPreset('iso'); return true; }
    if (/\bzoom\s+in\b|\bcloser\b/.test(low)) { this.camState.desiredDistance = Math.max(4.5, this.camState.desiredDistance - 3.0); return true; }
    if (/\bzoom\s+out\b/.test(low)) { this.camState.desiredDistance = Math.min(55, this.camState.desiredDistance + 3.0); return true; }
    if (/\bzoom\s+into\s+(\w+)/.test(low)) {
      const kw = low.match(/\bzoom\s+into\s+([a-z0-9_]+)/)[1];
      const match = this.componentMeshes.find(m => `${m.userData?.comp?.id} ${m.userData?.comp?.name}`.toLowerCase().includes(kw));
      if (match) {
        this._selectComponentMesh(match);
        const wp = new THREE.Vector3();
        match.getWorldPosition(wp);
        this.camState.desiredTargetX = wp.x;
        this.camState.desiredTargetY = wp.y;
        this.camState.desiredTargetZ = wp.z;
        this.camState.desiredDistance = 7.5;
        return true;
      }
    }
    const rotMatch = low.match(/rotate(?:\s+it)?\s+(-?\d+)\s*deg/);
    if (rotMatch) {
      this.camState.desiredAzimuth += (Number(rotMatch[1]) * Math.PI) / 180;
      return true;
    }
    const jointSetMatch = low.match(/set\s+(?:this\s+joint|joint\s*([a-z0-9_]+))\s+(?:to\s+)?(-?\d+)/);
    if (jointSetMatch) {
      const key = jointSetMatch[1] || this.selectedJointId || this.jointDefinitions[0]?.id;
      const j = this.jointDefinitions.find(x => x.id === key || x.id.includes(key) || (x.label || '').toLowerCase().includes(key));
      if (j) {
        const val = Math.max(j.minDeg ?? -180, Math.min(j.maxDeg ?? 180, Number(jointSetMatch[2])));
        this._setJointValue(j.id, val);
        const slider = document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${j.id}"]`);
        if (slider) slider.value = String(val);
        return true;
      }
    }
    if (/\bopen\s+gripper\b/.test(low)) { this._applyGripPreset('open'); return true; }
    if (/\bclose\s+gripper\b|\bpower\s+grip\b/.test(low)) { this._applyGripPreset('power'); return true; }
    if (/\bpinch\s+grip\b/.test(low)) { this._applyGripPreset('pinch'); return true; }
    if (/\bexplain\s+(?:this\s+)?(?:joint|part|selection)|\bwhich\s+part\s+is\s+weakest\b|\bwhy\s+can't\s+it\s+reach\b/.test(low)) {
      this.explainCurrentSelection(text);
      return true;
    }
    if (/\bsnapshot\b|\bscreenshot\b/.test(low)) { this._captureSnapshotPng(); return true; }
    if (/\bclose\b.*\b(3d|viewer|cad|modal)\b/.test(low)) { this.hide(); return true; }
    return false;
  }

  _triggerDownload(format) {
    if (!this.activeModel || !this.activeModel.modelId) return;
    const url = `/api/3d-model/${encodeURIComponent(this.activeModel.modelId)}/export/${encodeURIComponent(format)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.activeModel.name || this.activeModel.modelId}.${format === 'spec' ? 'spec.json' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  _initScene() {
    const container = document.getElementById('stark-3d-canvas-container');
    if (!container) return;

    const width = Math.max(container.clientWidth || 720, 320);
    const height = Math.max(container.clientHeight || 520, 320);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Preserve HUD and camera preset overlays inside canvas container
    const oldCanvas = container.querySelector('canvas:not(#hud-landmark-canvas)');
    if (oldCanvas) oldCanvas.remove();
    container.prepend(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x09152b, 0.45);
    this.scene.add(this.hemiLight);

    const keyLight = new THREE.DirectionalLight(0xccf5ff, 1.8);
    keyLight.position.set(12, 18, 14);
    this.scene.add(keyLight);

    this.fillLight = new THREE.DirectionalLight(0xf8fafc, 0.65);
    this.fillLight.position.set(-10, 12, 12);
    this.scene.add(this.fillLight);

    const rimLight = new THREE.PointLight(0x0088ff, 1.4, 60);
    rimLight.position.set(-12, 8, -10);
    this.scene.add(rimLight);

    this.gridHelper = new THREE.GridHelper(24, 24, 0x00e5ff, 0x002244);
    this.gridHelper.position.y = -0.35;
    this.scene.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(3.2);
    this.axesHelper.position.set(-11.5, -0.32, -11.5);
    this.scene.add(this.axesHelper);

    this.baseRing = new THREE.Mesh(
      new THREE.RingGeometry(3.8, 3.95, 64),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
    );
    this.baseRing.rotation.x = -Math.PI / 2;
    this.baseRing.position.y = -0.34;
    this.scene.add(this.baseRing);

    this.ikTargetMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.26, 0),
      new THREE.MeshBasicMaterial({ color: 0x00ffee, wireframe: true })
    );
    this.ikTargetMarker.visible = false;
    this.scene.add(this.ikTargetMarker);

    this.workspaceSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.14 })
    );
    this.workspaceSphere.position.set(0, 0.85, 0);
    this.workspaceSphere.visible = false;
    this.scene.add(this.workspaceSphere);

    this.measureGroup = new THREE.Group();
    this.scene.add(this.measureGroup);

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);
  }

  _handleResize() {
    if (!this.renderer || !this.camera || !this.modal || this.modal.style.display === 'none') return;
    const container = document.getElementById('stark-3d-canvas-container');
    if (!container) return;
    const w = Math.max(container.clientWidth || 720, 320);
    const h = Math.max(container.clientHeight || 520, 320);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  showModel(modelDef) {
    this.activeModel = modelDef;
    if (!this.modal) this._createDOM();
    this.modal.style.display = 'flex';
    const vs = modelDef.viewState || {};
    this.isExploded = Boolean(vs.exploded);
    this.explodeFactor = this.isExploded ? 1 : 0;
    this.explodeProgress = this.explodeFactor;
    this.isAnimatingKinematics = false;
    this.isPlayingTrajectory = false;
    this.isWireframe = Boolean(vs.wireframe ?? modelDef.parameters?.wireframe);
    this.currentTheme = modelDef.theme || 'holographic';
    if (Number.isFinite(Number(vs.cameraDistance))) this.distance = Number(vs.cameraDistance);

    if (!this.scene) this._initScene();
    this._handleResize();

    const spec = modelDef.geometrySpec || {};
    const comps = Array.isArray(spec.components) ? spec.components : [];
    const joints = Array.isArray(spec.joints) ? spec.joints : [];
    const savedPose = modelDef.savedJointPose && typeof modelDef.savedJointPose === 'object' ? modelDef.savedJointPose : null;
    if (savedPose) {
      joints.forEach(j => { if (savedPose[j.id] !== undefined) j.defaultDeg = savedPose[j.id]; });
    }
    this.jointDefinitions = joints;
    this.selectedJointId = joints[0]?.id || null;

    const archTag = document.getElementById('stark-3d-archetype-tag');
    if (archTag) archTag.innerText = String(modelDef.archetype || spec.archetype || 'ROBOT').toUpperCase();

    const provTag = document.getElementById('stark-3d-provenance-tag');
    if (provTag) {
      const prov = spec.geometryProvenance || 'engineering_parametric';
      provTag.innerText = prov === 'conceptual_kinematic_approximation' ? 'CONCEPTUAL KINEMATIC RIG' : 'ENGINEERING PARAMETRIC';
    }

    const titleEl = document.getElementById('stark-3d-title-badge');
    if (titleEl) {
      const baseTitle = (modelDef.name || modelDef.archetype || 'VISION CAD MODEL').toUpperCase();
      titleEl.innerText = modelDef.saved ? `${baseTitle} • SAVED` : baseTitle;
    }

    const nameInput = document.getElementById('stark-3d-name-input');
    if (nameInput) nameInput.value = modelDef.name || modelDef.archetype || 'vision_cad_model';
    const notesInput = document.getElementById('stark-3d-notes-input');
    if (notesInput) notesInput.value = modelDef.notes || '';
    const statusEl = document.getElementById('stark-3d-save-status');
    if (statusEl) {
      statusEl.textContent = modelDef.saved && modelDef.savedAt
        ? `Saved in JARVIS • ${new Date(modelDef.savedAt).toLocaleTimeString()}`
        : 'Unsaved session draft';
      statusEl.style.color = modelDef.saved ? '#34d399' : '#94a3b8';
    }

    const explodeBtn = document.getElementById('stark-3d-explode-btn');
    if (explodeBtn) {
      explodeBtn.innerText = `EXPLODED: ${this.isExploded ? 'ON' : 'OFF'}`;
      explodeBtn.setAttribute('aria-pressed', String(this.isExploded));
    }
    const wfBtn = document.getElementById('stark-3d-wireframe-btn');
    if (wfBtn) wfBtn.setAttribute('aria-pressed', String(this.isWireframe));
    const themeBtn = document.getElementById('stark-3d-theme-btn');
    if (themeBtn) themeBtn.innerText = `THEME: ${this.currentTheme.toUpperCase()}`;

    const partsMeta = document.getElementById('stark-3d-meta-parts');
    if (partsMeta) partsMeta.innerText = `COMPONENTS: ${comps.length}`;
    const jointsMeta = document.getElementById('stark-3d-meta-joints');
    if (jointsMeta) jointsMeta.innerText = `JOINTS: ${joints.length}`;

    const summaryEl = document.getElementById('stark-3d-specs-body');
    if (summaryEl) {
      const es = spec.engineeringSummary || spec.assemblySpecs || {};
      summaryEl.innerHTML = `
        <div><strong>Archetype:</strong> ${modelDef.archetype || spec.archetype || 'custom'}</div>
        ${es.estimatedArmMassKg || es.estimatedMassKg ? `<div><strong>Total Mass:</strong> ${es.estimatedArmMassKg || es.estimatedMassKg} kg</div>` : ''}
        ${es.reachMm ? `<div><strong>Max Reach:</strong> ${es.reachMm} mm</div>` : ''}
        ${es.recommendedPayloadKg ? `<div><strong>Rated Payload:</strong> ${es.recommendedPayloadKg} kg</div>` : ''}
        <div><strong>Mechanical Parts:</strong> ${comps.length} • <strong>DOF:</strong> ${spec.dof ?? joints.length}</div>
      `;
    }

    const mainBadgeText = document.getElementById('mic-status-text');
    const mainDot = document.getElementById('mic-indicator-dot');
    if (mainBadgeText) {
      this.syncVoiceBadge(mainBadgeText.textContent || 'Ready', mainBadgeText.style.color || '#64748b', mainDot?.classList.contains('pulse'));
    }

    this._clearMeasurePins();
    this._buildModel(comps, joints, spec);
    if (this.modelGroup && vs.modelRotation) {
      this.modelGroup.rotation.set(vs.modelRotation.x || 0, vs.modelRotation.y ?? 0.35, vs.modelRotation.z || 0);
    }
    this._renderJointSliders(joints);
    this._startLoop();
    this.refreshSavedVault();
  }

  _disposeObjectTree(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }

  _buildModel(components, joints = [], spec = {}) {
    if (!this.modelGroup) return;
    this._disposeObjectTree(this.modelGroup);
    while (this.modelGroup.children.length > 0) this.modelGroup.remove(this.modelGroup.children[0]);
    if (this.dimBoundingBoxHelper) {
      this.scene?.remove(this.dimBoundingBoxHelper);
      this.dimBoundingBoxHelper = null;
    }

    this.jointGroups.clear();
    this.componentMeshes = [];
    this.gripperFingers = [];
    this.selectedMesh = null;

    if (spec.type === 'external_mesh' && spec.meshUrl) {
      this._loadExternalMesh(spec);
      return;
    }

    for (const j of joints) {
      const grp = new THREE.Group();
      const piv = j.pivot || [0, 0, 0];
      grp.position.set(piv[0], piv[1], piv[2]);
      grp.userData.joint = j;
      grp.userData.basePivot = [...piv];
      this.jointGroups.set(j.id, grp);
    }

    for (const j of joints) {
      const grp = this.jointGroups.get(j.id);
      if (j.parent && this.jointGroups.has(j.parent)) {
        this.jointGroups.get(j.parent).add(grp);
      } else {
        this.modelGroup.add(grp);
      }
    }

    for (const comp of components) {
      let geom = null;
      const s = comp.shape;
      if (s === 'cylinder') {
        geom = new THREE.CylinderGeometry(comp.radiusTop ?? 1, comp.radiusBottom ?? 1, comp.height ?? 2, 24);
      } else if (s === 'sphere') {
        geom = new THREE.SphereGeometry(comp.radius ?? 1, 22, 22);
      } else if (s === 'cone') {
        geom = new THREE.ConeGeometry(comp.radius ?? 1, comp.height ?? 2, 24);
      } else if (s === 'torus') {
        geom = new THREE.TorusGeometry(comp.radius ?? 3, comp.tube ?? 0.3, 14, 36);
      } else {
        const sz = comp.size || [2, 2, 2];
        geom = new THREE.BoxGeometry(sz[0], sz[1], sz[2]);
      }

      const baseColor = comp.color || 0x00e5ff;
      const mat = this._createMaterial(baseColor);
      const mesh = new THREE.Mesh(geom, mat);
      const basePos = comp.pos || [0, 0, 0];
      mesh.position.set(basePos[0], basePos[1], basePos[2]);
      if (comp.rot) mesh.rotation.set(comp.rot[0], comp.rot[1], comp.rot[2]);

      mesh.userData = {
        comp,
        baseColor,
        basePos: [...basePos],
        explodeOffset: comp.explodeOffset || comp.explodeVector || [0, 0, 0]
      };

      const targetParent = (comp.parentJoint && this.jointGroups.has(comp.parentJoint))
        ? this.jointGroups.get(comp.parentJoint)
        : this.modelGroup;
      targetParent.add(mesh);
      this.componentMeshes.push(mesh);

      if (comp.gripSide || (comp.parentJoint && /grip/i.test(comp.parentJoint) && /finger|jaw|pad/i.test(String(comp.id || comp.name || '')))) {
        this.gripperFingers.push(mesh);
      }
    }

    this._resetJointPose();
    this._refreshBoundingBoxOverlay();
  }

  async _loadExternalMesh(spec) {
    const fmt = (spec.importFormat || '').toLowerCase();
    try {
      let root = null;
      if (fmt === 'obj') {
        root = await new OBJLoader().loadAsync(spec.meshUrl);
      } else if (fmt === 'stl') {
        const geom = await new STLLoader().loadAsync(spec.meshUrl);
        root = new THREE.Mesh(geom, this._createMaterial(0x00e5ff));
      } else if (fmt === 'glb' || fmt === 'gltf') {
        const gltf = await new GLTFLoader().loadAsync(spec.meshUrl);
        root = gltf.scene || gltf.scenes?.[0];
      }
      if (!root) throw new Error('Loaded external scene was empty');

      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 6.0 / maxDim;
      root.scale.setScalar(scale);
      root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

      root.traverse((child) => {
        if (child.isMesh) {
          child.userData = {
            comp: { id: child.name || 'imported_mesh', name: child.name || 'Imported CAD Submesh', material: 'Imported Mesh', dimensionsMm: `${Math.round(size.x)}x${Math.round(size.y)}x${Math.round(size.z)}` },
            baseColor: 0x00e5ff,
            basePos: [child.position.x, child.position.y, child.position.z],
            explodeOffset: [0, 0, 0]
          };
          child.material = this._createMaterial(0x00e5ff);
          this.componentMeshes.push(child);
        }
      });
      this.modelGroup.add(root);
      this._refreshBoundingBoxOverlay();
    } catch (err) {
      this._showToast(`External CAD render failed: ${err.message}`, true);
    }
  }

  _refreshBoundingBoxOverlay() {
    if (!this.scene || !this.modelGroup) return;
    if (this.dimBoundingBoxHelper) this.scene.remove(this.dimBoundingBoxHelper);
    this.dimBoundingBoxHelper = new THREE.BoxHelper(this.modelGroup, 0x00e5ff);
    this.dimBoundingBoxHelper.material.transparent = true;
    this.dimBoundingBoxHelper.material.opacity = 0.28;
    this.dimBoundingBoxHelper.visible = this.showDimsAxes;
    this.scene.add(this.dimBoundingBoxHelper);
  }

  _renderJointSliders(joints = []) {
    const container = document.getElementById('stark-3d-joints-controls');
    if (!container) return;
    container.innerHTML = '';
    if (!joints.length) {
      container.innerHTML = '<div style="font-size:11px;color:#64748b;">No articulated joints in this assembly.</div>';
      return;
    }

    for (const j of joints) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
      const min = j.minDeg ?? -180;
      const max = j.maxDeg ?? 180;
      const def = j.defaultDeg ?? 0;
      const unit = j.axis === 'grip' || String(j.axis).startsWith('translate_') ? 'mm' : '°';

      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:11px;">
          <span>${j.label || j.id}</span>
          <span id="stark-3d-jval-${j.id}" style="color:#00ffaa;">${def}${unit}</span>
        </div>
        <input type="range" class="stark-joint-slider" data-joint-id="${j.id}" min="${min}" max="${max}" value="${def}" step="1" style="width:100%;accent-color:#00e5ff;" />
      `;
      const slider = row.querySelector('input');
      slider.addEventListener('input', () => {
        this.selectedJointId = j.id;
        this._setJointValue(j.id, Number(slider.value));
      });
      container.appendChild(row);
    }
  }

  _setJointValue(jointId, degValue) {
    const grp = this.jointGroups.get(jointId);
    const valEl = document.getElementById(`stark-3d-jval-${jointId}`);
    const j = grp ? grp.userData.joint : null;
    const unit = j?.axis === 'grip' || String(j?.axis || '').startsWith('translate_') ? 'mm' : '°';
    if (valEl && j) valEl.innerText = `${Math.round(degValue)}${unit}`;
    if (!grp || !j) return;

    if (j.axis === 'grip') {
      const halfSpan = Math.max(0.05, Number(degValue) / 45);
      for (const m of this.gripperFingers) {
        const sign = m.userData.comp?.gripSide === 'right' ? -1 : (m.userData.comp?.gripSide === 'left' ? 1 : (m.userData.basePos[2] >= 0 ? 1 : -1));
        m.userData.basePos[2] = sign * halfSpan;
        m.position.z = m.userData.basePos[2] + (m.userData.explodeOffset[2] || 0) * this.explodeProgress;
      }
      return;
    }

    const bp = grp.userData.basePivot || j.pivot || [0, 0, 0];
    if (j.axis === 'translate_x') { grp.position.x = bp[0] + Number(degValue) / 100; return; }
    if (j.axis === 'translate_y') { grp.position.y = bp[1] + Number(degValue) / 100; return; }
    if (j.axis === 'translate_z') { grp.position.z = bp[2] + Number(degValue) / 100; return; }

    const rad = (Number(degValue) * Math.PI) / 180;
    if (j.axis === 'x') grp.rotation.x = rad;
    else if (j.axis === 'z') grp.rotation.z = rad;
    else grp.rotation.y = rad;
  }

  _resetJointPose() {
    for (const j of this.jointDefinitions) {
      const def = j.defaultDeg ?? 0;
      this._setJointValue(j.id, def);
      const slider = document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${j.id}"]`);
      if (slider) slider.value = String(def);
    }
    if (this.modelGroup) this.modelGroup.rotation.set(0, 0.35, 0);
  }

  _handleCanvasClick(e) {
    if (!this.renderer || !this.camera || !this.componentMeshes.length) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    if (this.activeLabMode === 'Measurement' || this.gestureController?.state?.submode === 'Measurement') {
      this._dropMeasurePinAtNdc(mouse);
      return;
    }
    this.raycaster.setFromCamera(mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.componentMeshes, false);
    if (hits.length > 0) this._selectComponentMesh(hits[0].object);
  }

  _dropMeasurePinAtNdc(ndc) {
    if (!this.camera || !this.componentMeshes.length || !this.measureGroup) return;
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);
    const hits = this.raycaster.intersectObjects(this.componentMeshes, false);
    if (!hits.length) return;
    if (this.measurePins.length >= 2) this._clearMeasurePins();
    const pt = hits[0].point.clone();
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffb300 })
    );
    pin.position.copy(pt);
    this.measureGroup.add(pin);
    this.measurePins.push(pt);

    const badge = document.getElementById('stark-3d-measure-badge');
    if (this.measurePins.length === 2 && badge) {
      const lineGeom = new THREE.BufferGeometry().setFromPoints(this.measurePins);
      this.measureGroup.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xffb300 })));
      const distMm = Math.round(this.measurePins[0].distanceTo(this.measurePins[1]) * 100);
      badge.textContent = `RULER SPAN: ${distMm} mm (${(distMm / 10).toFixed(1)} cm)`;
      badge.style.display = 'block';
    } else if (badge) {
      badge.textContent = 'RULER PIN 1 SET — Point/Click Pin 2';
      badge.style.display = 'block';
    }
  }

  _clearMeasurePins() {
    this.measurePins = [];
    if (this.measureGroup) {
      this._disposeObjectTree(this.measureGroup);
      while (this.measureGroup.children.length > 0) this.measureGroup.remove(this.measureGroup.children[0]);
    }
    const badge = document.getElementById('stark-3d-measure-badge');
    if (badge) badge.style.display = 'none';
  }

  _selectComponentMesh(mesh) {
    this.selectedMesh = mesh;
    const comp = mesh.userData.comp || {};
    if (comp.parentJoint) this.selectedJointId = comp.parentJoint;
    this._updateMaterials();

    const inspector = document.getElementById('stark-3d-part-inspector');
    if (inspector) {
      inspector.innerHTML = `
        <div><strong>Part:</strong> ${comp.name || comp.label || comp.id || 'Component'}</div>
        ${comp.material ? `<div><strong>Material:</strong> ${comp.material}</div>` : ''}
        ${comp.dimensionsMm ? `<div><strong>Dimensions (mm):</strong> ${comp.dimensionsMm}</div>` : ''}
        ${comp.massGrams !== undefined ? `<div><strong>Mass:</strong> ${comp.massGrams} g</div>` : ''}
        <div><strong>Parent Joint:</strong> ${comp.parentJoint || 'Fixed Base'}</div>
      `;
    }
  }

  _createMaterial(colorHex, meshRef = null) {
    const isSel = meshRef && meshRef === this.selectedMesh;
    const dimOther = this.isIsolated && this.selectedMesh && !isSel;

    if (isSel) {
      return new THREE.MeshStandardMaterial({
        color: 0x00ffaa,
        emissive: 0x00ffaa,
        emissiveIntensity: 0.65,
        wireframe: this.isWireframe
      });
    }
    if (this.isXRay) {
      return new THREE.MeshStandardMaterial({
        color: colorHex || 0x00e5ff,
        emissive: colorHex || 0x00e5ff,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: dimOther ? 0.06 : 0.26,
        depthWrite: false,
        wireframe: this.isWireframe
      });
    }
    if (this.currentTheme === 'titanium') {
      return new THREE.MeshStandardMaterial({
        color: colorHex || 0xcccccc,
        metalness: 0.85,
        roughness: 0.25,
        transparent: dimOther,
        opacity: dimOther ? 0.12 : 1.0,
        wireframe: this.isWireframe
      });
    }
    return new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.32,
      transparent: true,
      opacity: dimOther ? 0.12 : 0.9,
      wireframe: this.isWireframe
    });
  }

  _updateMaterials() {
    for (const mesh of this.componentMeshes) {
      if (mesh.material) mesh.material.dispose();
      mesh.material = this._createMaterial(mesh.userData.baseColor || 0x00e5ff, mesh);
    }
  }

  _startLoop() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    const animate = () => {
      if (!this.modal || this.modal.style.display === 'none' || document.hidden) {
        this.animFrameId = null;
        return;
      }
      this.animFrameId = requestAnimationFrame(animate);

      // Unified smooth camera spherical interpolation
      const cs = this.camState;
      cs.azimuth += (cs.desiredAzimuth - cs.azimuth) * 0.16;
      cs.elevation += (cs.desiredElevation - cs.elevation) * 0.16;
      cs.distance += (cs.desiredDistance - cs.distance) * 0.16;
      cs.targetX += (cs.desiredTargetX - cs.targetX) * 0.16;
      cs.targetY += (cs.desiredTargetY - cs.targetY) * 0.16;
      cs.targetZ += (cs.desiredTargetZ - cs.targetZ) * 0.16;
      cs.roll += (cs.desiredRoll - cs.roll) * 0.16;

      if (this.camera) {
        const horiz = cs.distance * Math.cos(cs.elevation);
        this.camera.position.set(
          cs.targetX + horiz * Math.sin(cs.azimuth),
          cs.targetY + cs.distance * Math.sin(cs.elevation),
          cs.targetZ + horiz * Math.cos(cs.azimuth)
        );
        this.camera.lookAt(cs.targetX, cs.targetY, cs.targetZ);
        if (Math.abs(cs.roll) > 0.001) this.camera.rotation.z += cs.roll;
      }

      if (Math.abs(this.explodeProgress - this.explodeFactor) > 0.004) {
        this.explodeProgress += (this.explodeFactor - this.explodeProgress) * 0.15;
        for (const m of this.componentMeshes) {
          const bp = m.userData.basePos;
          const ev = m.userData.explodeOffset;
          if (bp && ev) {
            m.position.set(bp[0] + ev[0] * this.explodeProgress, bp[1] + ev[1] * this.explodeProgress, bp[2] + ev[2] * this.explodeProgress);
          }
        }
      }

      if (!this._isEmergencyStopBlocked()) {
        if (this.isPlayingTrajectory && this.trajectoryWaypoints.length > 0) {
          this.trajAccumulator += 0.03 * this.trajSpeed;
          if (this.trajAccumulator >= 1.0) {
            this.trajAccumulator = 0;
            this._stepTrajectory();
          }
        } else if (this.isAnimatingKinematics && this.jointDefinitions.length) {
          this.kinematicTime += 0.025;
          this.jointDefinitions.forEach((j, idx) => {
            const min = j.minDeg ?? -90;
            const max = j.maxDeg ?? 90;
            const mid = (min + max) / 2;
            const amp = (max - min) * 0.35;
            const val = mid + Math.sin(this.kinematicTime + idx * 0.9) * amp;
            this._setJointValue(j.id, val);
            const slider = document.querySelector(`#stark-3d-joints-controls input[data-joint-id="${j.id}"]`);
            if (slider) slider.value = String(Math.round(val));
          });
        }

        if (this.isRotating && this.modelGroup && !this.isDragging) {
          this.modelGroup.rotation.y += this.rotationSpeed;
        }
      }

      if (this.dimBoundingBoxHelper && this.dimBoundingBoxHelper.visible) {
        this.dimBoundingBoxHelper.update();
      }
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();
  }

  hide() {
    this.isPlayingTrajectory = false;
    this.isAnimatingKinematics = false;
    this.handTracker?.stop?.('VIEWER_CLOSED');
    if (this.modal) this.modal.style.display = 'none';
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

export const stark3DViewerInstance = new Stark3DViewer();
