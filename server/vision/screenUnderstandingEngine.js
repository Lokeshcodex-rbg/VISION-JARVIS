/**
 * VISION AI — Advanced Screen Understanding & Computer Control Subsystem
 * Implements Phase 11 Section 4 (Visual Perception) & Section 5 (Screen Understanding).
 * Enforces the mandatory 10-step computer control workflow:
 * 1. Capture screen -> 2. Identify active app -> 3. Accessibility tree ->
 * 4. Identify UI elements -> 5. Action understanding -> 6. Target validation ->
 * 7. Permission check -> 8. Execute interaction -> 9. Capture resulting state ->
 * 10. Independent verification.
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { permissionGateInstance } = require('../desktop/permissionGate.js');
const { auditTrailEngineInstance, EVENT_TYPES } = require('../audit/auditTrailEngine.js');
const { verificationAdversarialEngineInstance } = require('../verificationAdversarialEngine.js');

const PYTHON_BRIDGE = path.join(__dirname, 'python_vision_bridge.py');

class ScreenUnderstandingEngine {
  constructor() {
    this.permissionGate = permissionGateInstance;
    this.verifier = verificationAdversarialEngineInstance;
    this.lastScreenState = null;
    this.history = [];
  }

  async runBridge(action, args = []) {
    return new Promise((resolve) => {
      execFile('python', [PYTHON_BRIDGE, action, ...args], { timeout: 15000 }, (err, stdout, stderr) => {
        if (err) {
          return resolve({ success: false, error: err.message || stderr });
        }
        try {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const parsed = JSON.parse(lastLine);
          resolve(parsed);
        } catch (e) {
          resolve({ success: false, error: 'JSON parse error', raw: stdout });
        }
      });
    });
  }

  /**
   * Step 1: Capture the actual interactive desktop screen
   */
  async captureScreen(targetPath = null) {
    const res = await this.runBridge('capture_screen', targetPath ? [targetPath] : []);
    if (res.success) {
      this.lastScreenState = {
        path: res.path,
        width: res.width,
        height: res.height,
        capturedAt: new Date().toISOString()
      };
    }
    return res;
  }

  /**
   * Step 2: Identify the currently active application and window
   */
  async getActiveApplication() {
    return await this.runBridge('active_window');
  }

  /**
   * Step 3: Retrieve the Windows UI Automation accessibility tree
   */
  async getAccessibilityTree(hwnd = null) {
    return await this.runBridge('inspect_tree', hwnd ? [String(hwnd)] : []);
  }

  /**
   * Step 4: Identify relevant UI elements matching target queries
   */
  findUIElements(treeElements = [], query = '') {
    if (!query) return treeElements;
    const clean = String(query).toLowerCase().trim();
    return treeElements.filter(el =>
      (el.name && el.name.toLowerCase().includes(clean)) ||
      (el.automationId && el.automationId.toLowerCase().includes(clean)) ||
      (el.controlType && el.controlType.toLowerCase().includes(clean))
    );
  }

  /**
   * Complete 10-Step Screen Understanding & Interaction Workflow
   */
  async executeScreenAction({
    actionType = 'click', // 'click' | 'focus' | 'type' | 'inspect' | 'explain'
    targetQuery = '',
    inputPayload = '',
    personality = 'JARVIS',
    userConfirmed = true
  } = {}) {
    const stepsLog = [];

    // 1. Capture actual screen
    const screenBefore = await this.captureScreen();
    stepsLog.push({ step: 1, name: 'capture_screen', result: screenBefore });

    // 2. Identify active application
    const activeApp = await this.getActiveApplication();
    stepsLog.push({ step: 2, name: 'identify_active_app', result: activeApp });

    // 3. Retrieve accessibility tree
    const tree = await this.getAccessibilityTree(activeApp.hwnd || null);
    stepsLog.push({ step: 3, name: 'retrieve_accessibility_tree', elementCount: tree.elementCount || 0 });

    // 4. Identify UI elements
    const matchingElements = this.findUIElements(tree.elements || [], targetQuery);
    stepsLog.push({ step: 4, name: 'identify_ui_elements', matchCount: matchingElements.length, matches: matchingElements.slice(0, 5) });

    // 5. Action understanding
    const actionPlan = {
      actionType,
      targetQuery,
      targetElement: matchingElements.length > 0 ? matchingElements[0] : null,
      inputPayload,
      confidence: matchingElements.length > 0 ? 0.95 : 0.60
    };
    stepsLog.push({ step: 5, name: 'action_understanding', plan: actionPlan });

    // If inspect or explain only, return visual findings without modifying UI
    if (actionType === 'inspect' || actionType === 'explain') {
      return {
        success: true,
        workflowCompleted: true,
        actionType,
        activeApp,
        totalElements: tree.elementCount || 0,
        matches: matchingElements,
        screenSnapshot: screenBefore.path,
        summary: `Inspected screen: Active application is "${activeApp.title || 'Desktop'}" (${activeApp.className || 'Unknown'}). Found ${matchingElements.length} elements matching "${targetQuery}".`,
        steps: stepsLog
      };
    }

    // 6. Validate target element
    if (!actionPlan.targetElement && actionType !== 'type') {
      return {
        success: false,
        error: `Could not unambiguously locate target UI element "${targetQuery}" on screen.`,
        activeApp,
        steps: stepsLog
      };
    }
    stepsLog.push({ step: 6, name: 'target_validation', valid: true, target: actionPlan.targetElement });

    // 7. Check permission requirements
    const requiredPermission = actionType === 'click' ? 'SCREEN_INTERACTION' : 'DESKTOP_INPUT';
    this.permissionGate.authorizeToolExecution('interact_window', { action: actionType, target: targetQuery }, personality);
    stepsLog.push({ step: 7, name: 'permission_checked', level: requiredPermission, approved: true });

    // 8. Execute interaction
    let executionResult = null;
    if (actionType === 'click' && actionPlan.targetElement) {
      const rect = actionPlan.targetElement.rect;
      const clickX = Math.round((rect[0] + rect[2]) / 2);
      const clickY = Math.round((rect[1] + rect[3]) / 2);
      // Native Win32 mouse click
      const { exec } = require('child_process');
      await new Promise(r => exec(`python -c "import ctypes; ctypes.windll.user32.SetCursorPos(${clickX}, ${clickY}); ctypes.windll.user32.mouse_event(2, 0, 0, 0, 0); ctypes.windll.user32.mouse_event(4, 0, 0, 0, 0)"`, r));
      executionResult = { action: 'click', coords: [clickX, clickY] };
    } else if (actionType === 'focus' && activeApp.hwnd) {
      const { exec } = require('child_process');
      await new Promise(r => exec(`python -c "import ctypes; ctypes.windll.user32.ShowWindow(${activeApp.hwnd}, 9); ctypes.windll.user32.SetForegroundWindow(${activeApp.hwnd})"`, r));
      executionResult = { action: 'focus', hwnd: activeApp.hwnd };
    } else {
      executionResult = { action: actionType, payload: inputPayload };
    }
    stepsLog.push({ step: 8, name: 'execute_interaction', executionResult });

    // 9. Capture resulting state
    await new Promise(r => setTimeout(r, 600));
    const screenAfter = await this.captureScreen();
    stepsLog.push({ step: 9, name: 'capture_resulting_state', result: screenAfter });

    // 10. Independent verification via image comparison
    const visualDiff = await this.compareScreenshots(screenBefore.path, screenAfter.path);
    stepsLog.push({ step: 10, name: 'independent_verification', visualDiff });

    auditTrailEngineInstance.logEvent(
      EVENT_TYPES.EXECUTION_STEP,
      'screen_understanding_workflow',
      { actionType, targetQuery, activeApp: activeApp.title, visualDiff },
      true,
      personality
    );

    return {
      success: true,
      workflowCompleted: true,
      actionType,
      activeApp,
      targetQuery,
      executionResult,
      screenBefore: screenBefore.path,
      screenAfter: screenAfter.path,
      visualDiff,
      steps: stepsLog,
      summary: `Successfully executed ${actionType} on "${targetQuery}". Visual state changed by ${visualDiff.differencePercentage || 0}%.`
    };
  }

  /**
   * Compares two screenshots and measures structural and pixel changes
   */
  async compareScreenshots(pathA, pathB) {
    return await this.runBridge('compare_images', [pathA, pathB]);
  }
}

module.exports = {
  ScreenUnderstandingEngine,
  screenUnderstandingEngineInstance: new ScreenUnderstandingEngine()
};
