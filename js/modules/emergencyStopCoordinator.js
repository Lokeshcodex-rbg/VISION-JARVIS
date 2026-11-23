/**
 * VISION AI — Centralized Frontend Emergency Stop Coordinator
 * Provides synchronous local control paths to immediately halt speech audio,
 * microphone capture, Web Speech recognition, active model requests, progressive captions,
 * camera streams, and background task dispatch.
 * 
 * Works 100% offline and locally independent of cloud providers.
 * Latches securely until an explicit, controlled user Resume/Reset action.
 */

export class EmergencyStopCoordinator {
  constructor(app) {
    this.app = app;
    this.isLatched = false;
    this.reason = null;
    this.stoppedAt = null;
    this.subscribers = new Set();

    if (typeof window !== 'undefined' && window.desktopAPI) {
      if (typeof window.desktopAPI.onEmergencyStopEngaged === 'function') {
        window.desktopAPI.onEmergencyStopEngaged((data) => {
          if (!this.isLatched) {
            this.triggerEmergencyStop(data?.reason || 'ELECTRON_GLOBAL_TRIGGER');
          }
        });
      }
      if (typeof window.desktopAPI.onEmergencyStopReset === 'function') {
        window.desktopAPI.onEmergencyStopReset((data) => {
          if (this.isLatched) {
            this.resetEmergencyStop(data?.reason || 'ELECTRON_GLOBAL_RESET');
          }
        });
      }
    }
  }

  isEmergencyStopActive() {
    return this.isLatched;
  }

  getStatus() {
    return {
      active: this.isLatched,
      reason: this.reason,
      stoppedAt: this.stoppedAt
    };
  }

  /**
   * Activates immediate synchronous emergency stop across all renderer subsystems,
   * IPC channels, and backend endpoints.
   * @param {string} reason
   */
  async triggerEmergencyStop(reason = 'USER_EMERGENCY_STOP') {
    const tStart = performance.now();
    this.isLatched = true;
    this.reason = reason;
    this.stoppedAt = Date.now();

    console.warn(`[EMERGENCY_STOP] Controller engaged immediately (Reason: ${reason})`);

    // 1. Immediate synchronous local audio silence & queue flush
    if (this.app.speechSynthesizer) {
      try {
        this.app.speechSynthesizer.handleEmergencyStop(reason);
      } catch (e) {
        console.error('[EMERGENCY_STOP] Error stopping speech synthesizer:', e);
      }
    }

    // 2. Immediate synchronous local speech recognition & mic halt
    if (this.app.voiceController) {
      try {
        this.app.voiceController.handleEmergencyStop(reason);
      } catch (e) {
        console.error('[EMERGENCY_STOP] Error stopping voice controller:', e);
      }
    }

    // 3. Abort active model requests & SSE readers
    if (this.app.aiClient) {
      try {
        this.app.aiClient.handleEmergencyStop(reason);
      } catch (e) {
        console.error('[EMERGENCY_STOP] Error aborting AI client:', e);
      }
    }

    // 4. Stop captions & show STOPPED indicator
    if (this.app.smokeCaptions) {
      try {
        this.app.smokeCaptions.handleEmergencyStop(reason);
      } catch (e) {
        console.error('[EMERGENCY_STOP] Error stopping smoke captions:', e);
      }
    }

    // 5. Halt camera & peripheral sensors + Robotics Lab hand tracker / kinematics
    if (this.app.sensorManager) {
      try {
        this.app.sensorManager.onEmergencyStop();
      } catch (e) {
        console.error('[EMERGENCY_STOP] Error stopping sensor manager:', e);
      }
    }
    if (this.app.stark3DViewer && typeof this.app.stark3DViewer.onEmergencyStop === 'function') {
      try {
        this.app.stark3DViewer.onEmergencyStop();
      } catch (e) {
        console.error('[EMERGENCY_STOP] Error halting Robotics Lab:', e);
      }
    }

    // 6. Freeze eye animation into STOPPED state
    this.app.isPaused = true;
    if (typeof this.app.setExpressionState === 'function') {
      try {
        this.app.setExpressionState('ALERT');
      } catch (e) {}
    }

    // 7. Update UI Buttons & Indicators
    this.app.isScreenObserving = false;
    this.updateUI(true);
    if (this.app.commandAndPermissionUI) {
      try {
        this.app.commandAndPermissionUI.hideConsentPrompt?.();
        this.app.commandAndPermissionUI.updateMicrophoneStatus('PAUSED', this.app.targetTheme, { reason: 'EMERGENCY_STOP' });
        this.app.commandAndPermissionUI.updateVoiceTimer();
      } catch (_) {}
    }
    if (typeof this.app.hideInlineToolBadge === 'function') {
      try {
        this.app.hideInlineToolBadge();
      } catch (_) {}
    }

    // 8. Propagate to Electron Main process via desktopAPI IPC
    if (window.desktopAPI?.triggerEmergencyStop) {
      try {
        window.desktopAPI.triggerEmergencyStop(reason);
      } catch (e) {
        console.error('[EMERGENCY_STOP] Error notifying desktop main IPC:', e);
      }
    }

    // 9. Propagate to Backend HTTP/SSE Server
    try {
      const url = (typeof location !== 'undefined' && location.origin) 
        ? '/api/security/emergency-stop' 
        : 'http://localhost:3000/api/security/emergency-stop';
      fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, timestamp: this.stoppedAt })
      }).catch(() => {});
    } catch (e) {}

    const latencyMs = Math.round(performance.now() - tStart);
    console.log(`[EMERGENCY_STOP] Synchronous local halt completed in ${latencyMs}ms`);

    for (const sub of this.subscribers) {
      try { sub(true, reason); } catch (e) {}
    }

    return { success: true, latencyMs };
  }

  /**
   * Performs an explicit, controlled reset from the stopped state.
   * Restores subsystems in a verified clean order.
   * @param {string} reason
   */
  async resetEmergencyStop(reason = 'USER_EXPLICIT_RESUME') {
    if (!this.isLatched) return { success: true, alreadyReset: true };

    console.log(`[EMERGENCY_STOP] Resetting system (Reason: ${reason}). Initializing clean state in controlled order.`);
    this.isLatched = false;
    this.reason = null;
    this.stoppedAt = null;

    // 1. Reset backend controller
    try {
      const url = (typeof location !== 'undefined' && location.origin) 
        ? '/api/security/emergency-reset' 
        : 'http://localhost:3000/api/security/emergency-reset';
      await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      }).catch(() => {});
    } catch (e) {
      console.warn('[EMERGENCY_STOP] Backend reset request warning:', e.message);
    }

    // 2. Reset Electron Main process
    if (window.desktopAPI?.resetEmergencyStop) {
      try {
        window.desktopAPI.resetEmergencyStop(reason);
      } catch (e) {}
    }

    // 3. Reset UI modules in controlled order
    if (this.app.speechSynthesizer) {
      this.app.speechSynthesizer.resetEmergencyStop();
    }
    if (this.app.aiClient) {
      this.app.aiClient.resetEmergencyStop();
    }
    if (this.app.smokeCaptions) {
      this.app.smokeCaptions.resetEmergencyStop();
    }
    if (this.app.voiceController) {
      this.app.voiceController.resetEmergencyStop();
      if (this.app.commandAndPermissionUI) {
        this.app.commandAndPermissionUI.updateMicrophoneStatus('DISABLED', this.app.targetTheme);
        this.app.commandAndPermissionUI.updateVoiceTimer();
      }
      if (typeof this.app.syncVoiceStateWithBackend === 'function') {
        this.app.syncVoiceStateWithBackend('EMERGENCY_RESET');
      }
    }

    // Unpause eye animation cleanly into standby without auto-starting microphone listening
    this.app.isPaused = false;
    if (this.app.stark3DViewer && typeof this.app.stark3DViewer.onEmergencyReset === 'function') {
      try {
        this.app.stark3DViewer.onEmergencyReset();
      } catch (_) {}
    }
    if (typeof this.app.setExpressionState === 'function') {
      this.app.setExpressionState('IDLE');
    }

    this.updateUI(false);

    for (const sub of this.subscribers) {
      try { sub(false, reason); } catch (e) {}
    }

    return { success: true };
  }

  /**
   * Synchronizes visual indicator badges, buttons, and status labels
   */
  updateUI(isStopped) {
    const btnEStop = document.getElementById('btn-emergency-stop');
    if (btnEStop) {
      if (isStopped) {
        btnEStop.textContent = '🟢 Resume System';
        btnEStop.style.backgroundColor = '#dc2626';
        btnEStop.style.color = '#ffffff';
        btnEStop.style.boxShadow = '0 0 18px rgba(220, 38, 38, 0.9)';
        btnEStop.setAttribute('title', 'Emergency Stop is ENGAGED. Click to safely reset and resume.');
      } else {
        btnEStop.textContent = '🛑 Emergency Stop';
        btnEStop.style.backgroundColor = '';
        btnEStop.style.color = '';
        btnEStop.style.boxShadow = '';
        btnEStop.setAttribute('title', 'Trigger immediate emergency stop of voice, tools, and automation.');
      }
    }

    const gatePill = document.getElementById('console-gate');
    if (gatePill) {
      gatePill.textContent = isStopped ? 'HALTED' : 'ARMED';
      gatePill.style.color = isStopped ? '#ef4444' : '';
    }

    const micIndicator = document.getElementById('mic-indicator-dot');
    if (micIndicator && isStopped) {
      micIndicator.style.backgroundColor = '#ef4444';
    }

    const micStatus = document.getElementById('mic-status-text');
    if (micStatus && isStopped) {
      micStatus.textContent = 'STOPPED';
      micStatus.style.color = '#ef4444';
    }
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
      return () => this.subscribers.delete(callback);
    }
    return () => {};
  }
}
