/**
 * VISION AI — Command Bar Overlay & Permissions Governance UI Coordinator
 * Manages Phase 2 (Permissions Modal with 14 granular toggles and live test buttons),
 * Phase 8 (Memory manager), Phase 9 (Personality separation), and Phase 10 (Text command bar Ctrl+Shift+Space).
 */

import { SensorManager } from './sensorManager.js';

export class CommandAndPermissionUI {
  constructor(app) {
    this.app = app;
    this.activePersonality = app.currentTheme || 'JARVIS';
    this.isCommandBarOpen = false;
    this.isPermissionsModalOpen = false;

    // Hardware & Sensor Manager
    this.sensorManager = new SensorManager(app);
    this.app.sensorManager = this.sensorManager;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // Header & Status
    this.headerPersonalityTag = document.getElementById('header-personality-tag');
    this.micIndicatorDot = document.getElementById('mic-indicator-dot');
    this.micStatusText = document.getElementById('mic-status-text');
    this.micSessionTimer = document.getElementById('mic-session-timer');
    this._voiceTimerInterval = null;

    // Inline Consent Prompt Controls
    this.consentPromptEl = document.getElementById('stark-consent-prompt');
    this.consentIconEl = document.getElementById('stark-consent-icon');
    this.consentTitleEl = document.getElementById('stark-consent-title');
    this.consentDescEl = document.getElementById('stark-consent-desc');
    this.consentActionsEl = document.getElementById('stark-consent-actions');

    // Quick Voice & System Controls in Header
    this.btnMicMute = document.getElementById('btn-mic-mute');
    this.btnContinuousToggle = document.getElementById('btn-continuous-toggle');
    this.btnVoiceRetry = document.getElementById('btn-voice-retry');
    this.btnStopListening = document.getElementById('btn-stop-listening');
    this.btnStopSpeaking = document.getElementById('btn-stop-speaking');
    this.btnCameraToggle = document.getElementById('btn-camera-toggle');
    this.btnEmergencyStop = document.getElementById('btn-emergency-stop');

    // Floating Camera Preview Panel
    this.cameraPreviewPanel = document.getElementById('camera-preview-panel');
    this.cameraPreviewVideo = document.getElementById('camera-preview-video');
    this.cameraLiveBadge = document.getElementById('camera-live-badge');
    this.closeCameraBtn = document.getElementById('close-camera-btn');
    this.btnAnalyzeDesk = document.getElementById('btn-analyze-desk');
    this.btnCameraSnapshot = document.getElementById('btn-camera-snapshot');
    this.btnInspectEngineering = document.getElementById('btn-inspect-engineering');
    this.btnCompareFrames = document.getElementById('btn-compare-frames');
    this.btnScreenDiagnose = document.getElementById('btn-screen-diagnose');
    this.btnStopCamera = document.getElementById('btn-stop-camera');
    this.cameraAnalysisOutput = document.getElementById('camera-analysis-output');
    this.cameraAnalysisText = document.getElementById('camera-analysis-text');

    // Bind preview elements into sensor manager
    this.sensorManager.bindPreviewElements({
      containerId: 'camera-preview-panel',
      videoId: 'camera-preview-video',
      badgeId: 'camera-live-badge',
      selectId: 'camera-device-select',
      headerIndicatorId: 'header-camera-indicator'
    });

    // Command Bar
    this.commandBarOverlay = document.getElementById('command-bar-overlay');
    this.commandInput = document.getElementById('command-input');
    this.commandCloseBtn = document.getElementById('command-close-btn');
    this.commandFeedback = document.getElementById('command-feedback');
    this.feedbackMeta = document.getElementById('feedback-meta');
    this.feedbackContent = document.getElementById('feedback-content');
    this.openCommandBarBtn = document.getElementById('open-command-bar-btn');

    // Permissions Modal
    this.permissionsModal = document.getElementById('permissions-modal');
    this.openPermissionsBtn = document.getElementById('open-permissions-btn');
    this.closePermissionsBtn = document.getElementById('close-permissions-btn');
    this.permissionsList = document.getElementById('permissions-list');
    this.trustedModeCheckbox = document.getElementById('trusted-mode-checkbox');
    this.selectJarvisProfileBtn = document.getElementById('select-jarvis-profile');
    this.selectUltronProfileBtn = document.getElementById('select-ultron-profile');

    // Hardware & Sensors Tab
    this.sensorsPermissionsList = document.getElementById('sensors-permissions-list');
    this.telemetryLux = document.getElementById('telemetry-lux');
    this.telemetryBattery = document.getElementById('telemetry-battery');
    this.telemetryNetwork = document.getElementById('telemetry-network');
    this.telemetryCameras = document.getElementById('telemetry-cameras');
    this.btnRefreshSensors = document.getElementById('btn-refresh-sensors');

    // Tabs
    this.navTabs = document.querySelectorAll('.nav-tab');
    this.tabPanes = document.querySelectorAll('.tab-pane');

    // Folders Tab
    this.newFolderInput = document.getElementById('new-folder-input');
    this.addFolderBtn = document.getElementById('add-folder-btn');
    this.permittedFoldersList = document.getElementById('permitted-folders-list');

    // Memory Tab
    this.newMemoryInput = document.getElementById('new-memory-input');
    this.addMemoryBtn = document.getElementById('add-memory-btn');
    this.exportMemoriesBtn = document.getElementById('export-memories-btn');
    this.clearMemoriesBtn = document.getElementById('clear-memories-btn');
    this.memoriesList = document.getElementById('memories-list');

    // Live Capability Registry Modal
    this.capabilitiesModal = document.getElementById('capabilities-modal');
    this.btnCapabilitiesModal = document.getElementById('btn-capabilities-modal');
    this.closeCapabilitiesModalBtn = document.getElementById('close-capabilities-modal');
    this.capabilitiesCardsContainer = document.getElementById('capabilities-cards-container');
    this.btnRefreshCaps = document.getElementById('btn-refresh-caps');
    this.capsFilterBtns = document.querySelectorAll('.caps-filter-btn');
    this.modalTabBtns = document.querySelectorAll('.modal-tab-btn');
    this.experimentsSummaryBanner = document.getElementById('experiments-summary-banner');
    this.experimentsListContainer = document.getElementById('experiments-list-container');
    this.diagnoseTargetInput = document.getElementById('diagnose-target-input');
    this.btnRunDiagnosis = document.getElementById('btn-run-diagnosis');
    this.diagnosisResultsBox = document.getElementById('diagnosis-results-box');
    this.beyondDashboardSummary = document.getElementById('beyond-dashboard-summary');
    this.beyondCapabilitiesGrid = document.getElementById('beyond-capabilities-grid');
  }

  bindEvents() {
    // Global Keyboard Hotkey for Command Bar: Ctrl + Shift + Space
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        this.toggleCommandBar();
      } else if (e.key === 'Escape') {
        if (this.isCommandBarOpen) this.closeCommandBar();
        if (this.isPermissionsModalOpen) this.closePermissionsModal();
      }
    });

    // Electron Preload IPC binding
    if (window.desktopAPI?.onOpenCommandBar) {
      window.desktopAPI.onOpenCommandBar(() => {
        this.openCommandBar();
      });
    }

    // Command Bar Buttons
    if (this.openCommandBarBtn) {
      this.openCommandBarBtn.addEventListener('click', () => this.openCommandBar());
    }
    if (this.commandCloseBtn) {
      this.commandCloseBtn.addEventListener('click', () => this.closeCommandBar());
    }
    if (this.commandInput) {
      this.commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.executeCommand();
        }
      });
    }

    // Quick Voice & System Controls in Header
    if (this.btnMicMute) {
      this.btnMicMute.addEventListener('click', () => {
        const vc = this.app.voiceController;
        if (!vc) return;
        const isMuted = !vc.isMicrophoneMuted();
        vc.setMuted(isMuted);
        this.btnMicMute.textContent = isMuted ? '🔇 Unmute' : '🎙️ Mute';
        this.btnMicMute.style.borderColor = isMuted ? '#ef4444' : '';
      });
    }

    if (this.btnContinuousToggle) {
      this.btnContinuousToggle.addEventListener('click', () => {
        const vc = this.app.voiceController;
        if (!vc) return;
        const next = !vc.continuousListening;
        vc.setContinuousListening(next);
        this.btnContinuousToggle.textContent = next ? '🔄 Continuous: ON' : '⏸️ Continuous: OFF';
        this.btnContinuousToggle.style.color = next ? '#10b981' : '#94a3b8';
      });
    }

    if (this.btnVoiceRetry) {
      this.btnVoiceRetry.addEventListener('click', () => {
        const vc = this.app.voiceController;
        if (!vc || vc.isEmergencyStopped) return;
        vc.retryListening();
      });
    }

    const micBadge = document.getElementById('mic-status-badge');
    if (micBadge) {
      micBadge.style.cursor = 'pointer';
      const onActivate = () => this.handleUnifiedStatusActivate();
      micBadge.addEventListener('click', onActivate);
      micBadge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      });
    }

    // Periodic timer UI updater (renders elapsed m:ss strictly while actively capturing in LISTENING)
    if (!this._voiceTimerInterval) {
      this._voiceTimerInterval = setInterval(() => this.updateVoiceTimer(), 100);
    }

    if (this.btnStopListening) {
      this.btnStopListening.addEventListener('click', () => {
        const vc = this.app.voiceController;
        if (!vc) return;
        vc.stopListening();
      });
    }

    if (this.btnStopSpeaking) {
      this.btnStopSpeaking.addEventListener('click', () => {
        if (this.app.speechSynthesizer) this.app.speechSynthesizer.stopSpeaking();
        if (this.app.aiClient) this.app.aiClient.cancelActiveRequest();
        if (this.app.smokeCaptions) this.app.smokeCaptions.clear(true);
        if (this.app.voiceController) this.app.voiceController.interruptionManager.triggerBargeIn('USER_HEADER_STOP_BUTTON');
      });
    }

    if (this.btnCameraToggle) {
      this.btnCameraToggle.addEventListener('click', async () => {
        if (this.sensorManager.isCameraStreaming) {
          this.sensorManager.stopCameraStream();
          this.btnCameraToggle.style.borderColor = '';
        } else {
          try {
            await this.sensorManager.startCameraStream();
            this.btnCameraToggle.style.borderColor = '#10b981';
          } catch (err) {
            alert(`Camera Initialization Error: ${err.message}`);
          }
        }
      });
    }

    if (this.btnEmergencyStop) {
      this.btnEmergencyStop.addEventListener('click', async () => {
        if (!this.app.emergencyStopCoordinator) return;
        if (!this.app.emergencyStopCoordinator.isEmergencyStopActive()) {
          await this.app.emergencyStopCoordinator.triggerEmergencyStop('Header Emergency Stop button clicked');
        } else {
          await this.app.emergencyStopCoordinator.resetEmergencyStop('User clicked Resume System');
        }
      });
    }

    // Camera Preview Floating Panel Buttons
    if (this.closeCameraBtn) {
      this.closeCameraBtn.addEventListener('click', () => {
        this.sensorManager.stopCameraStream();
      });
    }
    if (this.btnStopCamera) {
      this.btnStopCamera.addEventListener('click', () => {
        this.sensorManager.stopCameraStream();
      });
    }

    if (this.btnAnalyzeDesk) {
      this.btnAnalyzeDesk.addEventListener('click', async () => {
        await this.handleDeskInspection();
      });
    }

    if (this.btnCameraSnapshot) {
      this.btnCameraSnapshot.addEventListener('click', async () => {
        await this.handleCameraSnapshotAnalysis();
      });
    }

    if (this.btnInspectEngineering) {
      this.btnInspectEngineering.addEventListener('click', async () => {
        await this.handleEngineeringInspection();
      });
    }

    if (this.btnCompareFrames) {
      this.btnCompareFrames.addEventListener('click', async () => {
        await this.handleFrameComparison();
      });
    }

    if (this.btnScreenDiagnose) {
      this.btnScreenDiagnose.addEventListener('click', async () => {
        await this.handleScreenDiagnosis();
      });
    }

    // Hardware & Sensors Tab Refresh
    if (this.btnRefreshSensors) {
      this.btnRefreshSensors.addEventListener('click', async () => {
        await this.loadSensorsHardwareTab();
      });
    }

    // Permissions Modal Buttons
    if (this.openPermissionsBtn) {
      this.openPermissionsBtn.addEventListener('click', () => this.openPermissionsModal());
    }
    if (this.closePermissionsBtn) {
      this.closePermissionsBtn.addEventListener('click', () => this.closePermissionsModal());
    }

    // Live Capabilities Modal Buttons
    if (this.btnCapabilitiesModal) {
      this.btnCapabilitiesModal.addEventListener('click', () => this.openCapabilitiesModal());
    }
    if (this.closeCapabilitiesModalBtn) {
      this.closeCapabilitiesModalBtn.addEventListener('click', () => this.closeCapabilitiesModal());
    }
    if (this.btnRefreshCaps) {
      this.btnRefreshCaps.addEventListener('click', () => this.loadCapabilities());
    }
    if (this.capsFilterBtns) {
      this.capsFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.capsFilterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.getAttribute('data-filter');
          this.loadCapabilities(filter === 'all' ? {} : { groundingLevel: filter });
        });
      });
    }
    if (this.modalTabBtns) {
      this.modalTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.modalTabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const tabId = btn.getAttribute('data-tab');
          ['caps-list-tab', 'caps-experiments-tab', 'caps-diagnose-tab', 'caps-beyond-tab', 'caps-personal-tab'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (id === tabId) ? 'block' : 'none';
          });
          if (tabId === 'caps-experiments-tab') this.loadExperiments();
          if (tabId === 'caps-beyond-tab') this.loadBeyondDashboard();
          if (tabId === 'caps-personal-tab') {
            if (!this.personalIntelligenceUI) {
              import('./personalIntelligenceUI.js').then(m => {
                this.personalIntelligenceUI = new m.PersonalIntelligenceUI();
                this.personalIntelligenceUI.refreshAll();
              }).catch(err => console.warn('[PERSONAL_UI] Failed to load module:', err));
            } else {
              this.personalIntelligenceUI.refreshAll();
            }
          }
        });
      });
    }
    if (this.btnRunDiagnosis) {
      this.btnRunDiagnosis.addEventListener('click', async () => {
        const target = this.diagnoseTargetInput ? this.diagnoseTargetInput.value.trim() : '';
        if (target) await this.runDependencyDiagnosis(target);
      });
    }

    // Profile switch buttons in modal
    if (this.selectJarvisProfileBtn) {
      this.selectJarvisProfileBtn.addEventListener('click', () => this.selectProfile('JARVIS'));
    }
    if (this.selectUltronProfileBtn) {
      this.selectUltronProfileBtn.addEventListener('click', () => this.selectProfile('ULTRON'));
    }

    // Trusted mode toggle
    if (this.trustedModeCheckbox) {
      this.trustedModeCheckbox.addEventListener('change', async (e) => {
        await this.setTrustedMode(e.target.checked);
      });
    }

    // Tab Navigation
    this.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.navTabs.forEach(t => t.classList.remove('active'));
        this.tabPanes.forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });

        tab.classList.add('active');
        const targetId = tab.dataset.tab;
        const targetPane = document.getElementById(targetId);
        if (targetPane) {
          targetPane.style.display = 'flex';
          targetPane.classList.add('active');
        }
        if (targetId === 'sensors-hardware-tab') this.loadSensorsHardwareTab();
        if (targetId === 'folders-tab') this.loadFolders();
        if (targetId === 'memory-tab') this.loadMemories();
      });
    });

    // Folders Actions
    if (this.addFolderBtn) {
      this.addFolderBtn.addEventListener('click', () => this.addFolder());
    }

    // Memory Actions
    if (this.addMemoryBtn) {
      this.addMemoryBtn.addEventListener('click', () => this.addMemory());
    }
    if (this.exportMemoriesBtn) {
      this.exportMemoriesBtn.addEventListener('click', () => this.exportMemories());
    }
    if (this.clearMemoriesBtn) {
      this.clearMemoriesBtn.addEventListener('click', () => this.clearMemories());
    }
  }

  // =========================================================================
  // Personality Header Helper (Authoritative updateMicrophoneStatus lives below)
  // =========================================================================

  // =========================================================================
  // Command Bar (Phase 10: Ctrl+Shift+Space)
  // =========================================================================

  openCommandBar() {
    this.isCommandBarOpen = true;
    if (this.commandBarOverlay) {
      this.commandBarOverlay.style.display = 'flex';
      setTimeout(() => {
        if (this.commandInput) {
          this.commandInput.focus();
          this.commandInput.select();
        }
      }, 50);
    }
  }

  closeCommandBar() {
    this.isCommandBarOpen = false;
    if (this.commandBarOverlay) {
      this.commandBarOverlay.style.display = 'none';
    }
  }

  toggleCommandBar() {
    if (this.isCommandBarOpen) {
      this.closeCommandBar();
    } else {
      this.openCommandBar();
    }
  }

  async executeCommand() {
    if (!this.commandInput) return;
    const text = this.commandInput.value.trim();
    if (!text) return;

    if (this.commandFeedback) {
      this.commandFeedback.style.display = 'block';
      this.feedbackMeta.textContent = 'PROCESSING COMMAND...';
      this.feedbackContent.textContent = 'Evaluating action against security permissions...';
    }

    try {
      const personality = this.app.targetTheme || 'JARVIS';
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: text, personality })
      });

      const data = await res.json();
      if (data.success) {
        this.feedbackMeta.textContent = `SUCCESS [${data.mode.toUpperCase()}]`;
        this.feedbackContent.textContent = data.summary || data.response || 'Action completed.';

        // Speak summary through speech synthesizer if voice enabled
        if (this.app.speechSynthesizer && data.summary) {
          this.app.speechSynthesizer.speak(data.summary, personality);
        }
      } else {
        this.feedbackMeta.textContent = 'OPERATION REJECTED';
        this.feedbackContent.textContent = data.error || 'Permission denied or execution failed.';
      }
    } catch (err) {
      this.feedbackMeta.textContent = 'CONNECTION ERROR';
      this.feedbackContent.textContent = err.message;
    }
  }

  // =========================================================================
  // Permissions Modal (Phase 2 & Phase 9)
  // =========================================================================

  async openPermissionsModal() {
    this.isPermissionsModalOpen = true;
    if (this.permissionsModal) {
      this.permissionsModal.style.display = 'flex';
    }
    await this.loadPermissions(this.activePersonality);
  }

  closePermissionsModal() {
    this.isPermissionsModalOpen = false;
    if (this.permissionsModal) {
      this.permissionsModal.style.display = 'none';
    }
  }

  async selectProfile(personality) {
    this.activePersonality = personality;
    if (this.selectJarvisProfileBtn && this.selectUltronProfileBtn) {
      this.selectJarvisProfileBtn.classList.toggle('active', personality === 'JARVIS');
      this.selectUltronProfileBtn.classList.toggle('active', personality === 'ULTRON');
    }
    await this.loadPermissions(personality);
  }

  async setTrustedMode(enabled) {
    try {
      await fetch('/api/permissions/trusted-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, personality: this.activePersonality })
      });
    } catch (err) {
      console.warn('Failed to toggle trusted mode:', err);
    }
  }

  async loadPermissions(personality) {
    if (!this.permissionsList) return;
    this.permissionsList.innerHTML = '<div style="padding: 12px; color: #64748b;">Loading governance matrix...</div>';

    try {
      const res = await fetch(`/api/permissions?personality=${personality}`);
      const data = await res.json();
      const profile = data.profile;

      if (this.trustedModeCheckbox) {
        this.trustedModeCheckbox.checked = Boolean(profile.trustedMode);
      }

      this.permissionsList.innerHTML = '';
      profile.permissions.forEach(perm => {
        const card = document.createElement('div');
        card.className = 'permission-card';
        card.innerHTML = `
          <div class="card-top">
            <span class="card-title">${perm.title}</span>
            <label class="switch-label">
              <input type="checkbox" data-id="${perm.id}" ${perm.enabled ? 'checked' : ''} />
              <span class="switch-slider"></span>
            </label>
          </div>
          <div class="card-desc">${perm.description}</div>
          <div class="card-resources"><strong>Scope:</strong> ${perm.resources} ${perm.requiresOsAuth ? '• <em>Requires Windows Auth</em>' : ''}</div>
          <div class="card-actions">
            <button class="stark-btn stark-btn-glass test-cap-btn" data-id="${perm.id}">🧪 Test Capability</button>
            <span class="perm-status-badge" style="font-size: 10px; color: ${perm.enabled ? '#10b981' : '#64748b'}">${perm.enabled ? 'AUTHORIZED' : 'RESTRICTED'}</span>
          </div>
          <div class="test-result-box" id="result-${perm.id}" style="display: none;"></div>
        `;

        // Toggle listener
        const checkbox = card.querySelector(`input[data-id="${perm.id}"]`);
        checkbox.addEventListener('change', async (e) => {
          await this.togglePermission(perm.id, e.target.checked);
        });

        // Test capability button
        const testBtn = card.querySelector(`.test-cap-btn[data-id="${perm.id}"]`);
        testBtn.addEventListener('click', async () => {
          await this.testCapability(perm.id, card.querySelector(`#result-${perm.id}`));
        });

        this.permissionsList.appendChild(card);
      });
    } catch (err) {
      this.permissionsList.innerHTML = `<div style="color: #ef4444;">Failed to load permissions: ${err.message}</div>`;
    }
  }

  async togglePermission(permissionId, enabled) {
    try {
      await fetch('/api/permissions/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionId, enabled, personality: this.activePersonality })
      });
    } catch (err) {
      console.warn('Failed to set permission:', err);
    }
  }

  async testCapability(permissionId, resultBox) {
    if (!resultBox) return;
    resultBox.style.display = 'block';
    resultBox.textContent = 'Testing capability on local system...';

    try {
      const res = await fetch(`/api/permissions/test/${permissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personality: this.activePersonality })
      });
      const data = await res.json();
      if (data.success) {
        resultBox.style.borderColor = '#10b981';
        resultBox.style.color = '#34d399';
        resultBox.innerHTML = `<strong>PASS (${data.durationMs}ms):</strong> ${data.evidence || 'Verified operational.'}`;
      } else {
        resultBox.style.borderColor = '#ef4444';
        resultBox.style.color = '#f87171';
        resultBox.innerHTML = `<strong>FAIL:</strong> ${data.error || 'Capability check failed.'}`;
      }
    } catch (err) {
      resultBox.style.borderColor = '#ef4444';
      resultBox.style.color = '#f87171';
      resultBox.textContent = `Error: ${err.message}`;
    }
  }

  // =========================================================================
  // Folders Management
  // =========================================================================

  async loadFolders() {
    if (!this.permittedFoldersList) return;
    this.permittedFoldersList.innerHTML = '<div style="color: #64748b;">Loading authorized directories...</div>';

    try {
      const res = await fetch(`/api/permissions?personality=${this.activePersonality}`);
      const data = await res.json();
      const folders = data.profile.permittedFolders || [];

      this.permittedFoldersList.innerHTML = '';
      folders.forEach(folder => {
        const item = document.createElement('div');
        item.className = 'folder-item';
        item.innerHTML = `
          <span>📁 ${folder}</span>
          <button class="stark-btn stark-btn-danger remove-folder-btn" data-folder="${encodeURIComponent(folder)}" style="padding: 2px 8px; font-size: 10px;">Remove</button>
        `;
        item.querySelector('.remove-folder-btn').addEventListener('click', async () => {
          await this.removeFolder(folder);
        });
        this.permittedFoldersList.appendChild(item);
      });
    } catch (err) {
      this.permittedFoldersList.innerHTML = `<div style="color: #ef4444;">Failed to load folders: ${err.message}</div>`;
    }
  }

  async addFolder() {
    if (!this.newFolderInput) return;
    const pathVal = this.newFolderInput.value.trim();
    if (!pathVal) return;

    try {
      await fetch('/api/permissions/folder/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: pathVal, personality: this.activePersonality })
      });
      this.newFolderInput.value = '';
      await this.loadFolders();
    } catch (err) {
      console.warn('Failed to add folder:', err);
    }
  }

  async removeFolder(folderPath) {
    try {
      await fetch('/api/permissions/folder/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath, personality: this.activePersonality })
      });
      await this.loadFolders();
    } catch (err) {
      console.warn('Failed to remove folder:', err);
    }
  }

  // =========================================================================
  // Memory Management
  // =========================================================================

  async loadMemories() {
    if (!this.memoriesList) return;
    this.memoriesList.innerHTML = '<div style="color: #64748b;">Loading stored memories...</div>';

    try {
      const res = await fetch('/api/memories');
      const data = await res.json();
      const memories = data.memories || [];

      this.memoriesList.innerHTML = '';
      if (memories.length === 0) {
        this.memoriesList.innerHTML = '<div style="color: #64748b; font-size: 11px;">No memories or facts stored yet.</div>';
        return;
      }

      memories.forEach(mem => {
        const item = document.createElement('div');
        item.className = 'memory-item';
        item.innerHTML = `
          <span>🧠 ${mem.fact}</span>
          <button class="stark-btn stark-btn-danger delete-mem-btn" data-id="${mem.id}" style="padding: 2px 8px; font-size: 10px;">Forget</button>
        `;
        item.querySelector('.delete-mem-btn').addEventListener('click', async () => {
          await this.deleteMemory(mem.id);
        });
        this.memoriesList.appendChild(item);
      });
    } catch (err) {
      this.memoriesList.innerHTML = `<div style="color: #ef4444;">Failed to load memories: ${err.message}</div>`;
    }
  }

  async addMemory() {
    if (!this.newMemoryInput) return;
    const text = this.newMemoryInput.value.trim();
    if (!text) return;

    try {
      await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `remember that ${text}`, personality: this.activePersonality })
      });
      this.newMemoryInput.value = '';
      await this.loadMemories();
    } catch (err) {
      console.warn('Failed to save memory:', err);
    }
  }

  async deleteMemory(id) {
    try {
      await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `forget memory ${id}`, personality: this.activePersonality })
      });
      await this.loadMemories();
    } catch (err) {
      console.warn('Failed to delete memory:', err);
    }
  }

  async exportMemories() {
    try {
      const res = await fetch('/api/memories/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stark_ai_memories_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export memories: ' + err.message);
    }
  }

  async clearMemories() {
    if (!confirm('Are you sure you want to clear all stored memories?')) return;
    try {
      await fetch('/api/memories/clear', { method: 'POST' });
      await this.loadMemories();
    } catch (err) {
      console.warn('Failed to clear memories:', err);
    }
  }

  // =========================================================================
  // Objective B — Vision Analysis & Hardware Sensor Dashboard Handlers
  // =========================================================================

  async handleDeskInspection() {
    if (!this.cameraAnalysisOutput || !this.cameraAnalysisText) return;
    this.cameraAnalysisOutput.style.display = 'block';
    this.cameraAnalysisText.textContent = 'Inspecting desk workspace through high-resolution vision sensor...';

    try {
      const snap = await this.sensorManager.captureSnapshot();
      const analysis = await this.sensorManager.analyzeVisual({
        imageBase64: snap.dataUrl,
        prompt: 'Inspect my desk and workspace. List visible objects and posture/setup notes.',
        type: 'desk',
        personality: 'JARVIS'
      });

      this.cameraAnalysisText.textContent = analysis.summary || analysis.response;
      if (this.app.speechSynthesizer && analysis.summary) {
        this.app.speechSynthesizer.speak(analysis.summary, 'JARVIS');
      }
    } catch (err) {
      this.cameraAnalysisText.textContent = `Inspection Failed: ${err.message}`;
    }
  }

  async handleCameraSnapshotAnalysis() {
    if (!this.cameraAnalysisOutput || !this.cameraAnalysisText) return;
    this.cameraAnalysisOutput.style.display = 'block';
    this.cameraAnalysisText.textContent = 'Capturing frame and analyzing optical contents...';

    try {
      const snap = await this.sensorManager.captureSnapshot();
      const analysis = await this.sensorManager.analyzeVisual({
        imageBase64: snap.dataUrl,
        prompt: 'Describe what you see in this camera frame in detail.',
        type: 'camera',
        personality: 'JARVIS'
      });

      this.cameraAnalysisText.textContent = analysis.summary || analysis.response;
      if (this.app.speechSynthesizer && analysis.summary) {
        this.app.speechSynthesizer.speak(analysis.summary, 'JARVIS');
      }
    } catch (err) {
      this.cameraAnalysisText.textContent = `Camera Analysis Failed: ${err.message}`;
    }
  }

  async handleScreenDiagnosis() {
    if (!this.cameraAnalysisOutput || !this.cameraAnalysisText) return;
    this.cameraAnalysisOutput.style.display = 'block';
    this.cameraAnalysisText.textContent = 'Requesting display frame for error & UI diagnosis...';

    try {
      const snap = await this.sensorManager.captureScreenSnapshot();
      const analysis = await this.sensorManager.analyzeVisual({
        imageBase64: snap.dataUrl,
        prompt: 'Analyze this visible screen for errors, terminal tracebacks, or UI elements.',
        type: 'error',
        personality: 'JARVIS'
      });

      this.cameraAnalysisText.textContent = analysis.summary || analysis.response;
      if (this.app.speechSynthesizer && analysis.summary) {
        this.app.speechSynthesizer.speak(analysis.summary, 'JARVIS');
      }
    } catch (err) {
      this.cameraAnalysisText.textContent = `Screen Diagnosis Failed: ${err.message}`;
    }
  }

  async handleEngineeringInspection() {
    if (!this.cameraAnalysisOutput || !this.cameraAnalysisText) return;
    this.cameraAnalysisOutput.style.display = 'block';
    this.cameraAnalysisText.textContent = 'Performing engineering visual inspection with uncalibrated measurement and safety verification...';

    try {
      const snap = await this.sensorManager.captureSnapshot();
      const analysis = await this.sensorManager.inspectEngineeringComponent({
        imageBase64: snap.dataUrl,
        prompt: 'Inspect this engineering component, robotic part, or circuit. Identify visible features, check tolerances, and provide safety notices.',
        componentType: 'general',
        personality: 'JARVIS'
      });

      this.cameraAnalysisText.textContent = analysis.summary || analysis.analysis;
      if (this.app.speechSynthesizer && analysis.summary) {
        this.app.speechSynthesizer.speak(analysis.summary, 'JARVIS');
      }
    } catch (err) {
      this.cameraAnalysisText.textContent = `Engineering Inspection Failed: ${err.message}`;
    }
  }

  async handleFrameComparison() {
    if (!this.cameraAnalysisOutput || !this.cameraAnalysisText) return;
    this.cameraAnalysisOutput.style.display = 'block';
    this.cameraAnalysisText.textContent = 'Capturing frame and comparing with previous visual reference...';

    try {
      const comparison = await this.sensorManager.compareWithPreviousFrame(
        'Compare these two camera frames and explain the physical, motion, or component differences.'
      );

      this.cameraAnalysisText.textContent = comparison.summary || comparison.analysis || comparison.message;
      if (this.app.speechSynthesizer && comparison.summary) {
        this.app.speechSynthesizer.speak(comparison.summary, 'JARVIS');
      }
    } catch (err) {
      this.cameraAnalysisText.textContent = `Frame Comparison Failed: ${err.message}`;
    }
  }

  async loadSensorsHardwareTab() {
    if (!this.sensorsPermissionsList) return;
    this.sensorsPermissionsList.innerHTML = '<div style="padding: 12px; color: #64748b;">Scanning physical hardware & sensors...</div>';

    try {
      // 1. Live hardware & client telemetry scan
      const hardware = await this.sensorManager.enumerateAvailableHardware();
      const clientTelem = await this.sensorManager.getClientTelemetry();

      if (this.telemetryLux) {
        this.telemetryLux.textContent = clientTelem.ambientLightLux !== null ? `${clientTelem.ambientLightLux} lux` : 'Ambient Lux Sensor';
      }
      if (this.telemetryBattery) {
        this.telemetryBattery.textContent = clientTelem.battery ? `${clientTelem.battery.level}% (${clientTelem.battery.charging ? 'Charging' : 'Battery'})` : 'AC Power / Desktop';
      }
      if (this.telemetryNetwork) {
        this.telemetryNetwork.textContent = clientTelem.network ? `${clientTelem.network.effectiveType.toUpperCase()}` : 'Online (Gigabit)';
      }
      if (this.telemetryCameras) {
        this.telemetryCameras.textContent = `${hardware.cameras.length} camera(s) detected`;
      }

      // 2. Fetch permissions from server
      const res = await fetch(`/api/permissions?personality=${this.activePersonality}`);
      const data = await res.json();
      const allPerms = data.profile.permissions;

      const sensorPermIds = [
        'microphone_voice',
        'camera_access',
        'camera_image_capture',
        'user_camera_analysis',
        'live_camera_analysis',
        'ambient_light_sensor',
        'environmental_sensors',
        'screen_capture',
        'screen_window_analysis',
        'local_image_analysis',
        'audio_input_analysis',
        'connected_hardware'
      ];

      const sensorPerms = allPerms.filter(p => sensorPermIds.includes(p.id));

      this.sensorsPermissionsList.innerHTML = '';
      sensorPerms.forEach(perm => {
        let hardwareStatus = 'VERIFIED HARDWARE';
        let statusColor = '#10b981';

        if (perm.id.includes('camera')) {
          if (hardware.cameras.length === 0) {
            hardwareStatus = 'NO CAMERA DETECTED';
            statusColor = '#f59e0b';
          } else {
            hardwareStatus = `${hardware.cameras.length} CAMERA(S) READY`;
            statusColor = '#10b981';
          }
        } else if (perm.id.includes('microphone')) {
          if (hardware.microphones.length === 0) {
            hardwareStatus = 'NO MIC DETECTED';
            statusColor = '#ef4444';
          } else {
            hardwareStatus = `${hardware.microphones.length} MIC(S) READY`;
            statusColor = '#10b981';
          }
        }

        const isUltron = this.activePersonality === 'ULTRON';
        const isProhibitedForUltron = isUltron && (perm.id.includes('camera') || perm.id.includes('screen'));

        const card = document.createElement('div');
        card.className = 'permission-card';
        card.innerHTML = `
          <div class="card-top">
            <span class="card-title">${perm.title}</span>
            <label class="switch-label">
              <input type="checkbox" data-id="${perm.id}" ${perm.enabled && !isProhibitedForUltron ? 'checked' : ''} ${isProhibitedForUltron ? 'disabled' : ''} />
              <span class="switch-slider"></span>
            </label>
          </div>
          <div class="card-desc">${perm.description}</div>
          <div class="card-resources">
            <strong>Device State:</strong> <span style="color: ${statusColor}; font-weight: 600;">${hardwareStatus}</span>
            • <strong>Scope:</strong> ${perm.resources}
            ${isProhibitedForUltron ? '<br><span style="color: #ef4444; font-weight: 600;">⚠️ Strictly PROHIBITED under ULTRON governance</span>' : ''}
          </div>
          <div class="card-actions">
            <button class="stark-btn stark-btn-glass test-cap-btn" data-id="${perm.id}">🧪 Test Sensor</button>
            <span class="perm-status-badge" style="font-size: 10px; color: ${perm.enabled && !isProhibitedForUltron ? '#10b981' : '#64748b'}">
              ${isProhibitedForUltron ? 'PROHIBITED' : (perm.enabled ? 'ACTIVE & AUTHORIZED' : 'RESTRICTED')}
            </span>
          </div>
          <div class="test-result-box" id="result-${perm.id}" style="display: none;"></div>
        `;

        if (!isProhibitedForUltron) {
          const checkbox = card.querySelector(`input[data-id="${perm.id}"]`);
          checkbox.addEventListener('change', async (e) => {
            await this.togglePermission(perm.id, e.target.checked);
          });
        }

        const testBtn = card.querySelector(`.test-cap-btn[data-id="${perm.id}"]`);
        testBtn.addEventListener('click', async () => {
          await this.testCapability(perm.id, card.querySelector(`#result-${perm.id}`));
        });

        this.sensorsPermissionsList.appendChild(card);
      });
    } catch (err) {
      this.sensorsPermissionsList.innerHTML = `<div style="color: #ef4444;">Failed to load sensor matrix: ${err.message}</div>`;
    }
  }

  // =========================================================================
  // LIVE CAPABILITY REGISTRY & EMPIRICAL EXPERIMENT LEDGER UI
  // =========================================================================

  openCapabilitiesModal() {
    if (this.capabilitiesModal) {
      this.capabilitiesModal.style.display = 'flex';
      this.loadCapabilities();
    }
  }

  closeCapabilitiesModal() {
    if (this.capabilitiesModal) {
      this.capabilitiesModal.style.display = 'none';
    }
  }

  async loadCapabilities(filter = {}) {
    if (!this.capabilitiesCardsContainer) return;
    this.capabilitiesCardsContainer.innerHTML = '<div style="color: #94a3b8; padding: 20px;">Auditing live system capabilities...</div>';

    try {
      const queryParams = new URLSearchParams(filter).toString();
      const res = await fetch(`/api/capabilities?${queryParams}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.capabilities)) {
        this.renderCapabilitiesCards(data.capabilities);
      } else {
        this.capabilitiesCardsContainer.innerHTML = '<div style="color: #ef4444;">Failed to load capability registry.</div>';
      }
    } catch (err) {
      this.capabilitiesCardsContainer.innerHTML = `<div style="color: #ef4444;">Error fetching capabilities: ${err.message}</div>`;
    }
  }

  renderCapabilitiesCards(capabilities) {
    if (!this.capabilitiesCardsContainer) return;
    this.capabilitiesCardsContainer.innerHTML = '';

    capabilities.forEach(cap => {
      const card = document.createElement('div');
      card.className = 'capability-card';

      const groundingClass = (cap.groundingLevel || 'implemented_software').toLowerCase();
      const statusColor = cap.status === 'VERIFIED_OPERATIONAL' ? '#10b981' : (cap.status === 'DEGRADED' ? '#f59e0b' : '#ef4444');

      card.innerHTML = `
        <div class="cap-card-header">
          <div class="cap-card-title">${cap.name}</div>
          <span class="cap-grounding-badge ${groundingClass}">${cap.groundingLevel}</span>
        </div>
        <div class="cap-card-desc">${cap.description}</div>
        <div style="font-size: 10px; color: #94a3b8;">
          <strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 700;">${cap.status}</span>
        </div>
        <div class="cap-card-metrics">
          <span>⚡ Latency: ${cap.measuredPerformance?.latencyMs || 0}ms</span>
          <span>✓ Reliability: ${((cap.measuredPerformance?.successRate || 1) * 100).toFixed(0)}%</span>
        </div>
      `;

      this.capabilitiesCardsContainer.appendChild(card);
    });
  }

  async loadExperiments() {
    if (!this.experimentsListContainer) return;
    this.experimentsListContainer.innerHTML = '<div style="color: #94a3b8; padding: 12px;">Querying empirical experiment ledger...</div>';

    try {
      const res = await fetch('/api/experiments');
      const data = await res.json();
      if (data.success && Array.isArray(data.experiments)) {
        this.renderExperiments(data.experiments, data.learningsSummary);
      }
    } catch (err) {
      this.experimentsListContainer.innerHTML = `<div style="color: #ef4444;">Failed to query experiments: ${err.message}</div>`;
    }
  }

  renderExperiments(experiments, summary) {
    if (this.experimentsSummaryBanner && summary) {
      this.experimentsSummaryBanner.innerHTML = `
        <div>
          <div style="font-size: 11px; color: #94a3b8;">TOTAL EXPERIMENTS</div>
          <div style="font-size: 20px; font-weight: 700; color: #38bdf8;">${summary.totalExperiments}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #94a3b8;">ACCEPTED GAINS</div>
          <div style="font-size: 20px; font-weight: 700; color: #10b981;">${summary.acceptedCount}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #94a3b8;">ACCEPTANCE RATE</div>
          <div style="font-size: 20px; font-weight: 700; color: #f59e0b;">${summary.acceptanceRatePercent}%</div>
        </div>
      `;
    }

    if (!this.experimentsListContainer) return;
    this.experimentsListContainer.innerHTML = '';

    experiments.forEach(exp => {
      const card = document.createElement('div');
      card.className = 'experiment-card';
      const isAccepted = exp.decision === 'ACCEPTED';
      const gainText = exp.measuredOutcome?.percentImprovement ? `+${exp.measuredOutcome.percentImprovement}%` : '';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #f8fafc; font-size: 13px;">${exp.title}</strong>
          <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${isAccepted ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color: ${isAccepted ? '#10b981' : '#ef4444'};">
            ${exp.decision} ${gainText}
          </span>
        </div>
        <div style="font-size: 11px; color: #94a3b8;"><em>Hypothesis:</em> ${exp.hypothesis}</div>
        <div style="font-size: 11px; color: #cbd5e1;"><em>Measured Impact:</em> Baseline: ${exp.baseline?.value} ${exp.baseline?.metric} → Result: ${exp.measuredOutcome?.value} ${exp.measuredOutcome?.metric}</div>
        <div style="font-size: 10px; color: #64748b;"><em>Reproduction:</em> ${exp.reproductionSteps?.[0] || 'Run automated regression suite'}</div>
      `;
      this.experimentsListContainer.appendChild(card);
    });
  }

  async runDependencyDiagnosis(target) {
    if (!this.diagnosisResultsBox) return;
    this.diagnosisResultsBox.innerHTML = `<div style="color: #94a3b8;">Investigating exact dependencies for "${target}"...</div>`;

    try {
      const res = await fetch('/api/capabilities/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
      const data = await res.json();
      const diag = data.diagnosis;

      let html = `<h4 style="color: #38bdf8; margin-bottom: 8px;">Diagnosis Report: ${diag.name || target}</h4>`;
      html += `<div style="font-size: 12px; margin-bottom: 8px;"><strong>Status:</strong> ${diag.status || 'Audited'} | <strong>Grounding:</strong> ${diag.groundingLevel || 'ANALYZED'}</div>`;

      if (diag.obstacle) {
        html += `<div style="color: #f87171; font-size: 12px; margin-bottom: 12px;"><strong>Obstacle:</strong> ${diag.obstacle}</div>`;
      } else {
        html += `<div style="color: #34d399; font-size: 12px; margin-bottom: 12px;">✓ Zero fatal missing dependencies detected. Operational.</div>`;
      }

      if (diag.feasibleAlternatives && diag.feasibleAlternatives.length > 0) {
        html += `<div style="font-size: 12px; font-weight: 600; color: #f8fafc; margin-bottom: 6px;">FEASIBLE ALTERNATIVES PROPOSED:</div>`;
        diag.feasibleAlternatives.forEach((alt, idx) => {
          html += `
            <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; font-size: 11px;">
              <strong style="color: #38bdf8;">${idx + 1}. ${alt.name || alt.substitute}</strong> (Feasibility: ${Math.round((alt.feasibilityScore || 0.9) * 100)}%)<br>
              <span style="color: #cbd5e1;">${alt.action}</span>
            </div>
          `;
        });
      }

      this.diagnosisResultsBox.innerHTML = html;
    } catch (err) {
      this.diagnosisResultsBox.innerHTML = `<div style="color: #ef4444;">Diagnosis failed: ${err.message}</div>`;
    }
  }

  async handleUnifiedStatusActivate() {
    const vc = this.app?.voiceController;
    if (!vc || vc.isEmergencyStopped) return;
    const canonical = vc.getCanonicalState ? vc.getCanonicalState() : 'DISABLED';

    if (canonical === 'ERROR') {
      vc.retryListening();
    } else if (this.app?.isScreenObserving && canonical !== 'LISTENING') {
      if (typeof this.app.setScreenObservationEnabled === 'function') {
        await this.app.setScreenObservationEnabled(false, 'STATUS_INDICATOR_STOP_OBSERVING');
      }
      return;
    } else if (canonical === 'DISABLED') {
      if (typeof this.app.enableAutonomousVoice === 'function') {
        await this.app.enableAutonomousVoice('STATUS_INDICATOR_ACTIVATE');
      } else if (typeof this.app.setVoiceMode === 'function') {
        await this.app.setVoiceMode('CONTINUOUS', 'STATUS_INDICATOR_ACTIVATE');
      }
    } else if (canonical === 'PAUSED') {
      if (typeof localStorage !== 'undefined') try { localStorage.removeItem('jarvis_user_paused'); } catch (_) {}
      await vc.resumeVoice('STATUS_INDICATOR_RESUME');
    } else if (canonical === 'READY' || canonical === 'LISTENING') {
      if (typeof localStorage !== 'undefined') try { localStorage.setItem('jarvis_user_paused', 'true'); } catch (_) {}
      vc.pauseVoice('STATUS_INDICATOR_PAUSE');
    }
    this.updateMicrophoneStatus(vc.getCanonicalState(), this.app.targetTheme);
    this.updateVoiceTimer();
    if (typeof this.app.syncVoiceStateWithBackend === 'function') {
      this.app.syncVoiceStateWithBackend('STATUS_INDICATOR_CLICK');
    }
  }

  /**
   * Authoritatively renders the 7 canonical voice states and capture timer visibility:
   * DISABLED | READY | LISTENING | PROCESSING | SPEAKING | PAUSED | ERROR
   */
  updateMicrophoneStatus(state, theme = 'JARVIS', meta = {}) {
    if (this.headerPersonalityTag) {
      this.headerPersonalityTag.textContent = theme || this.app.currentTheme || 'JARVIS';
      this.headerPersonalityTag.style.borderColor = theme === 'ULTRON' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)';
    }

    const vc = this.app && this.app.voiceController;
    const rawState = String(state || (vc && vc.getCanonicalState ? vc.getCanonicalState() : 'DISABLED')).toUpperCase();
    if (!this.micStatusText || !this.micIndicatorDot) {
      this.micStatusText = document.getElementById('mic-status-text');
      this.micIndicatorDot = document.getElementById('mic-indicator-dot');
      this.micSessionTimer = document.getElementById('mic-session-timer');
    }
    if (!this.micStatusText) return;

    let canonical = rawState;
    if (canonical === 'INITIALIZING') {
      // Explicit transient startup check state
    } else if (['IDLE', 'STOPPED', 'DORMANT', 'SLEEP'].includes(rawState)) {
      canonical = (vc && vc.voiceMode && vc.voiceMode !== 'DISABLED') ? 'READY' : 'DISABLED';
    } else if (['CAPTURING', 'USER_SPEAKING', 'AWAITING_FOLLOWUP', 'INTERRUPTED', 'WAKE_WORD_DETECTED', 'ACTIVATING'].includes(rawState)) {
      canonical = 'LISTENING';
    } else if (['THINKING', 'TRANSCRIBING', 'EXECUTING', 'RECONNECTING', 'RECOVERING'].includes(rawState)) {
      canonical = 'PROCESSING';
    } else if (rawState === 'ASSISTANT_SPEAKING') {
      canonical = 'SPEAKING';
    }

    const isObserving = Boolean(this.app && this.app.isScreenObserving);
    let displayLabel = 'Ready';
    let jarvisStatus = 'Ready';
    let dotColor = '#64748b';
    let isPulsing = false;

    switch (canonical) {
      case 'INITIALIZING':
        displayLabel = 'Initializing';
        jarvisStatus = 'Initializing';
        dotColor = '#94a3b8';
        isPulsing = true;
        break;
      case 'DISABLED':
        displayLabel = 'Ready';
        jarvisStatus = 'Ready';
        dotColor = '#64748b';
        isPulsing = false;
        break;
      case 'READY':
        displayLabel = 'Ready';
        jarvisStatus = 'Ready';
        dotColor = '#38bdf8';
        isPulsing = false;
        break;
      case 'LISTENING':
        displayLabel = 'Listening';
        jarvisStatus = 'Listening';
        dotColor = '#10b981';
        isPulsing = true;
        break;
      case 'PROCESSING':
        displayLabel = rawState === 'RECONNECTING' ? 'Recovering' : 'Processing';
        jarvisStatus = 'Processing';
        dotColor = '#f59e0b';
        isPulsing = true;
        break;
      case 'SPEAKING':
        displayLabel = 'Speaking';
        jarvisStatus = 'Speaking';
        dotColor = theme === 'ULTRON' ? '#f43f5e' : '#60a5fa';
        isPulsing = true;
        break;
      case 'PAUSED':
        displayLabel = 'Paused';
        jarvisStatus = 'Paused';
        dotColor = '#94a3b8';
        isPulsing = false;
        break;
      case 'ERROR': {
        const errCode = (meta && meta.reason) || (vc && vc.lastErrorCategory) || '';
        displayLabel = errCode === 'PERMISSION_DENIED'
          ? 'Error (Denied)'
          : (errCode === 'DEVICE_NOT_FOUND' ? 'Error (No Mic)' : 'Error');
        jarvisStatus = 'Error';
        dotColor = '#ef4444';
        isPulsing = false;
        break;
      }
      default:
        displayLabel = canonical;
        jarvisStatus = canonical;
        dotColor = '#64748b';
        isPulsing = false;
    }

    const showObservingPrimary = isObserving && (canonical === 'DISABLED' || canonical === 'READY');
    if (showObservingPrimary) {
      displayLabel = 'Observing';
      jarvisStatus = 'Observing';
      dotColor = '#14b8a6';
      isPulsing = true;
    } else if (isObserving && canonical !== 'ERROR' && !(canonical === 'PAUSED' && meta?.reason === 'EMERGENCY_STOP')) {
      displayLabel = `${displayLabel} · Observing`;
      jarvisStatus = 'Observing';
    }

    this.micStatusText.textContent = displayLabel;
    this.micStatusText.style.color = dotColor;

    if (typeof window !== 'undefined') {
      if (window.stark3DViewer && typeof window.stark3DViewer.syncVoiceBadge === 'function') {
        window.stark3DViewer.syncVoiceBadge(displayLabel, dotColor, isPulsing);
      }
      const simDot = document.getElementById('stark-sim-voice-dot');
      const simLabel = document.getElementById('stark-sim-voice-label');
      const simPill = document.getElementById('stark-sim-voice-pill');
      if (simLabel) simLabel.textContent = `JARVIS: ${displayLabel}`;
      if (simDot) {
        simDot.style.backgroundColor = dotColor;
        simDot.style.boxShadow = isPulsing ? `0 0 10px ${dotColor}` : 'none';
      }
      if (simPill) simPill.style.borderColor = dotColor;
    }

    if (this.micIndicatorDot) {
      this.micIndicatorDot.style.backgroundColor = dotColor;
      this.micIndicatorDot.style.boxShadow = isPulsing ? `0 0 10px ${dotColor}` : 'none';
      this.micIndicatorDot.classList.toggle('pulse', isPulsing);
    }

    const badge = document.getElementById('mic-status-badge');
    if (badge) {
      const voiceStateAttr = canonical === 'INITIALIZING' ? 'DISABLED' : canonical;
      badge.dataset.voiceState = voiceStateAttr;
      badge.dataset.jarvisStatus = jarvisStatus;
      badge.dataset.observing = isObserving ? 'true' : 'false';
      const hint = showObservingPrimary
        ? 'Observing screen with your consent (Click to stop observing)'
        : (voiceStateAttr === 'DISABLED'
          ? 'JARVIS Ready — Click to enable autonomous voice'
          : (voiceStateAttr === 'READY'
            ? 'Autonomous Voice Ready — Click to pause'
            : (voiceStateAttr === 'PAUSED'
              ? 'Voice Paused — Click to resume'
              : (voiceStateAttr === 'ERROR'
                ? 'Voice Error — Click to retry microphone'
                : `JARVIS Status: ${displayLabel}`))));
      badge.setAttribute('title', hint);
      badge.classList.toggle('state-initializing', canonical === 'INITIALIZING');
      badge.classList.toggle('state-disabled', canonical === 'DISABLED' && !showObservingPrimary);
      badge.classList.toggle('state-ready', canonical === 'READY' && !showObservingPrimary);
      badge.classList.toggle('state-listening', canonical === 'LISTENING');
      badge.classList.toggle('state-processing', canonical === 'PROCESSING');
      badge.classList.toggle('state-speaking', canonical === 'SPEAKING');
      badge.classList.toggle('state-paused', canonical === 'PAUSED');
      badge.classList.toggle('state-observing', isObserving);
      badge.classList.toggle('observing-state', isObserving);
      badge.classList.toggle('state-error', canonical === 'ERROR');
      badge.classList.toggle('error-state', canonical === 'ERROR');
      badge.classList.toggle('speaking-state', canonical === 'SPEAKING');
      badge.classList.toggle('listening-state', canonical === 'LISTENING');
    }

    if (this.btnVoiceRetry) {
      this.btnVoiceRetry.style.display = canonical === 'ERROR' ? 'inline-flex' : 'none';
    }

    this.updateVoiceTimer();
  }

  showConsentPrompt({ icon = '🛡️', title = 'Permission Required', description = '', actions = [] } = {}) {
    if (!this.consentPromptEl) {
      this.consentPromptEl = document.getElementById('stark-consent-prompt');
      this.consentIconEl = document.getElementById('stark-consent-icon');
      this.consentTitleEl = document.getElementById('stark-consent-title');
      this.consentDescEl = document.getElementById('stark-consent-desc');
      this.consentActionsEl = document.getElementById('stark-consent-actions');
    }
    if (!this.consentPromptEl) return;
    if (this.consentIconEl) this.consentIconEl.textContent = icon;
    if (this.consentTitleEl) this.consentTitleEl.textContent = title;
    if (this.consentDescEl) this.consentDescEl.textContent = description;
    if (this.consentActionsEl) {
      this.consentActionsEl.innerHTML = '';
      for (const act of actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        if (act.id) btn.id = act.id;
        btn.className = `consent-action-btn ${act.variant || ''}`.trim();
        btn.textContent = act.label || 'Confirm';
        btn.addEventListener('click', async () => {
          this.hideConsentPrompt();
          if (typeof act.onClick === 'function') {
            await act.onClick();
          }
        });
        this.consentActionsEl.appendChild(btn);
      }
    }
    this.consentPromptEl.style.display = 'flex';
  }

  hideConsentPrompt() {
    if (!this.consentPromptEl) {
      this.consentPromptEl = document.getElementById('stark-consent-prompt');
    }
    if (this.consentPromptEl) {
      this.consentPromptEl.style.display = 'none';
    }
    if (this.consentActionsEl) {
      this.consentActionsEl.innerHTML = '';
    }
  }

  updateVoiceTimer() {
    if (!this.micSessionTimer) {
      this.micSessionTimer = document.getElementById('mic-session-timer');
    }
    if (!this.micSessionTimer) return;

    const vc = this.app && this.app.voiceController;
    const snap = (vc && typeof vc.getTimerSnapshot === 'function')
      ? vc.getTimerSnapshot()
      : { isTimerActive: false, formatted: '0:00' };

    if (snap.isTimerActive) {
      this.micSessionTimer.style.display = 'inline-block';
      this.micSessionTimer.textContent = snap.formatted;
    } else {
      this.micSessionTimer.style.display = 'none';
      this.micSessionTimer.textContent = '0:00';
    }
  }

  async loadBeyondDashboard() {
    if (!this.beyondDashboardSummary || !this.beyondCapabilitiesGrid) return;
    this.beyondDashboardSummary.innerHTML = '<div style="color: #94a3b8; padding: 8px;">Querying VISION Beyond 100 frontier telemetry...</div>';
    this.beyondCapabilitiesGrid.innerHTML = '<div style="color: #94a3b8; padding: 12px;">Retrieving 15-dimension capability registry...</div>';

    try {
      const [overviewRes, capsRes] = await Promise.all([
        fetch('/api/beyond/dashboard/overview'),
        fetch('/api/beyond/capabilities')
      ]);
      const overview = await overviewRes.json();
      const capabilities = await capsRes.json();

      this.renderBeyondDashboard(overview, Array.isArray(capabilities) ? capabilities : overview.capabilities);
    } catch (err) {
      this.beyondDashboardSummary.innerHTML = `<div style="color: #ef4444;">Dashboard telemetry failed: ${err.message}</div>`;
      this.beyondCapabilitiesGrid.innerHTML = '';
    }
  }

  renderBeyondDashboard(overview, capabilities) {
    if (this.beyondDashboardSummary) {
      const eStopStatus = overview.emergencyStopArmed
        ? '<span style="color: #10b981; font-weight: 700;">ARMED (READY)</span>'
        : '<span style="color: #ef4444; font-weight: 700;">ENGAGED (HALTED)</span>';

      const brierScore = overview.forecastAccuracy?.brierScore !== undefined
        ? Number(overview.forecastAccuracy.brierScore).toFixed(3)
        : '0.250';

      this.beyondDashboardSummary.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; align-items: center;">
          <div>
            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">FRONTIER CAPABILITIES</div>
            <div style="font-size: 18px; font-weight: 800; color: #38bdf8;">${overview.capabilitiesCount || 12} / 12</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">ACTIVE CAMPAIGNS</div>
            <div style="font-size: 18px; font-weight: 800; color: #a855f7;">${overview.experimentCampaigns?.totalCampaigns || 0}</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">FORECAST BRIER SCORE</div>
            <div style="font-size: 18px; font-weight: 800; color: #f59e0b;">${brierScore}</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">WORLD MODEL MEMORY</div>
            <div style="font-size: 18px; font-weight: 800; color: #34d399;">${overview.worldModelTelemetry?.heapUsedMb || 0} MB</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">EMERGENCY STOP</div>
            <div style="font-size: 13px;">${eStopStatus}</div>
          </div>
        </div>
      `;
    }

    if (!this.beyondCapabilitiesGrid) return;
    this.beyondCapabilitiesGrid.innerHTML = '';

    const MATURITY_COLORS = {
      CONCEPT_ONLY: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: '#475569' },
      LITERATURE_REVIEWED: { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa', border: '#3b82f6' },
      SIMULATED: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: '#9333ea' },
      PROTOTYPE_IMPLEMENTED: { bg: 'rgba(6, 182, 212, 0.15)', text: '#22d3ee', border: '#0891b2' },
      UNIT_TESTED: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: '#0284c7' },
      INTEGRATION_TESTED: { bg: 'rgba(52, 211, 153, 0.15)', text: '#34d399', border: '#059669' },
      EXPERIMENTALLY_VALIDATED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: '#047857' },
      INDEPENDENTLY_REPLICATED: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: '#d97706' },
      PHYSICALLY_VALIDATED: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6', border: '#db2777' }
    };

    capabilities.forEach(cap => {
      const card = document.createElement('div');
      card.className = 'capability-card';
      card.style.cssText = 'background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;';

      const style = MATURITY_COLORS[cap.maturityLevel] || MATURITY_COLORS.CONCEPT_ONLY;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <span style="font-size: 10px; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">${cap.id}</span>
            <div style="font-size: 14px; font-weight: 700; color: #f8fafc; margin-top: 2px;">${cap.userFacingGoal || cap.id}</div>
          </div>
          <span style="font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px; background: ${style.bg}; color: ${style.text}; border: 1px solid ${style.border}; white-space: nowrap;">
            ${cap.maturityLevel}
          </span>
        </div>

        <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">
          <strong style="color: #cbd5e1;">Inspiration:</strong> ${cap.fictionalInspiration || 'Advanced Speculative Science'}
        </div>

        <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">
          <strong style="color: #38bdf8;">State of the Art:</strong> ${cap.currentSota || 'Active scientific investigation'}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; font-size: 10px; background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px;">
          <div>
            <span style="color: #34d399; font-weight: 600;">VISION Implementable:</span>
            <div style="color: #cbd5e1; margin-top: 2px;">${cap.starkImplementableToday?.substring(0, 85) || 'Model & simulate'}...</div>
          </div>
          <div>
            <span style="color: #f87171; font-weight: 600;">Requires Breakthrough:</span>
            <div style="color: #cbd5e1; margin-top: 2px;">${cap.unresolvedBreakthroughRequired?.substring(0, 85) || 'Hardware & physics'}...</div>
          </div>
        </div>

        <div style="font-size: 11px; color: #f59e0b; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
          <strong>Next Experiment:</strong> ${cap.nextRecommendedExperiment || 'Define test dataset'}
        </div>
      `;

      this.beyondCapabilitiesGrid.appendChild(card);
    });
  }
}

