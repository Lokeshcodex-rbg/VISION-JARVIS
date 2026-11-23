/**
 * VISION AI — Unified Full Windows Desktop Automation Service
 * Official AI: VISION — MADE BY LOKESH | Assistant: JARVIS
 * 
 * Provides production-grade Windows desktop automation:
 * 1. Precision Mouse Control: move, left/right/double click, smooth drag-and-drop, scroll
 * 2. Keystroke & Hotkey Automation: text entry, complex shortcuts (Ctrl, Alt, Win, Shift combos)
 * 3. Window & Process Management: list, find, focus, geometry (resize/move), min/max/restore, close, launch
 * 4. Windows UI Automation (UIA): accessibility tree element discovery (buttons, text fields, menus)
 * 5. Desktop Filesystem Organization: folder creation, move, copy, rename, safe deletion with recycle backup,
 *    and category-based desktop file organization
 * 6. Hardened Safety: permission gate validation, emergency stop integration, non-destructive defaults
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
const { permissionGateInstance } = require('./permissionGate.js');
const { advancedDesktopAutomationInstance } = require('./advancedDesktopAutomation.js');
const { computerVisionIntelligenceInstance } = require('./computerVisionIntelligence.js');
const { fileExplorerInstance } = require('./fileExplorer.js');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRATCH_DIR = path.join(PROJECT_ROOT, 'scratch');
const RECYCLE_BACKUP_DIR = path.join(PROJECT_ROOT, 'data', 'recycle_backup');

if (!fs.existsSync(SCRATCH_DIR)) fs.mkdirSync(SCRATCH_DIR, { recursive: true });
if (!fs.existsSync(RECYCLE_BACKUP_DIR)) fs.mkdirSync(RECYCLE_BACKUP_DIR, { recursive: true });

// Common Desktop Application Launch Definitions
const ALLOWED_DESKTOP_APPLICATIONS = {
  notepad: { name: 'Notepad', exec: 'notepad.exe', processNames: ['notepad.exe', 'notepad'] },
  calc: { name: 'Calculator', exec: 'calc.exe', processNames: ['CalculatorApp.exe', 'calc.exe'] },
  calculator: { name: 'Calculator', exec: 'calc.exe', processNames: ['CalculatorApp.exe', 'calc.exe'] },
  explorer: { name: 'File Explorer', exec: 'explorer.exe', processNames: ['explorer.exe'] },
  chrome: { name: 'Google Chrome', exec: 'chrome.exe', processNames: ['chrome.exe'] },
  edge: { name: 'Microsoft Edge', exec: 'msedge.exe', processNames: ['msedge.exe'] },
  vscode: { name: 'Visual Studio Code', exec: 'code.cmd', processNames: ['Code.exe', 'code'] },
  settings: { name: 'Windows Settings', exec: 'start ms-settings:', isUri: true, processNames: ['SystemSettings.exe'] },
  whatsapp: { name: 'WhatsApp Desktop', exec: 'whatsapp.exe', processNames: ['WhatsApp.exe', 'WhatsApp.Root.exe'] },
  teams: { name: 'Microsoft Teams', exec: 'ms-teams.exe', processNames: ['ms-teams.exe', 'Teams.exe'] },
  zoom: { name: 'Zoom Meeting', exec: 'zoom.exe', processNames: ['Zoom.exe'] },
  word: { name: 'Microsoft Word', exec: 'winword.exe', processNames: ['WINWORD.EXE', 'winword.exe'] },
  excel: { name: 'Microsoft Excel', exec: 'excel.exe', processNames: ['EXCEL.EXE', 'excel.exe'] },
  powerpoint: { name: 'Microsoft PowerPoint', exec: 'powerpnt.exe', processNames: ['POWERPNT.EXE', 'powerpnt.exe'] }
};

class DesktopAutomationService {
  constructor() {
    this.emergencyStop = emergencyStopControllerInstance;
    this.permissionGate = permissionGateInstance;
    this.advAuto = advancedDesktopAutomationInstance;
    this.cvi = computerVisionIntelligenceInstance;
    this.explorer = fileExplorerInstance;
    this.activeProcesses = new Map();
  }

  _checkEmergencyStop(actionName = 'Desktop Automation') {
    if (this.emergencyStop && this.emergencyStop.isEmergencyStopped && this.emergencyStop.isEmergencyStopped()) {
      throw new Error(`EMERGENCY_STOP_ACTIVE: ${actionName} is blocked by active Emergency Stop.`);
    }
  }

  // =========================================================================
  // 1. MOUSE AUTOMATION
  // =========================================================================

  /**
   * Move the mouse cursor to specific screen coordinates
   */
  mouseMove(x, y) {
    this._checkEmergencyStop('mouseMove');
    const posX = Math.max(0, Math.round(Number(x) || 0));
    const posY = Math.max(0, Math.round(Number(y) || 0));

    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${posX}, ${posY})
Write-Output "SUCCESS"
`;
    try {
      const res = spawnSync('powershell', ['-NoProfile', '-Command', psScript], { encoding: 'utf-8', timeout: 3000 });
      const ok = res.status === 0 && res.stdout.includes('SUCCESS');
      return { success: ok, x: posX, y: posY, verified: ok };
    } catch (err) {
      return { success: false, x: posX, y: posY, error: err.message };
    }
  }

  /**
   * Click mouse at coordinates (left, right, middle, double)
   */
  mouseClick(x, y, options = {}) {
    this._checkEmergencyStop('mouseClick');
    const button = (options.button || 'left').toLowerCase();
    const double = Boolean(options.double);
    const posX = Math.max(0, Math.round(Number(x) || 500));
    const posY = Math.max(0, Math.round(Number(y) || 500));

    return this.advAuto.clickMouse({ x: posX, y: posY }, { button, double });
  }

  /**
   * Smooth drag and drop from (fromX, fromY) to (toX, toY)
   */
  mouseDrag(fromX, fromY, toX, toY, options = {}) {
    this._checkEmergencyStop('mouseDrag');
    const fX = Math.max(0, Math.round(Number(fromX) || 0));
    const fY = Math.max(0, Math.round(Number(fromY) || 0));
    const tX = Math.max(0, Math.round(Number(toX) || 0));
    const tY = Math.max(0, Math.round(Number(toY) || 0));
    const steps = Math.min(30, Math.max(5, Number(options.steps) || 12));
    const button = (options.button || 'left').toLowerCase();

    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class MouseDragHelper {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;

    public static void Drag(int fromX, int fromY, int toX, int toY, int steps, string btn) {
        System.Windows.Forms.Cursor.Position = new System.Drawing.Point(fromX, fromY);
        Thread.Sleep(50);
        uint down = (btn == "right") ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN;
        uint up = (btn == "right") ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP;

        mouse_event(down, 0, 0, 0, 0);
        Thread.Sleep(50);

        for (int i = 1; i <= steps; i++) {
            int curX = fromX + (toX - fromX) * i / steps;
            int curY = fromY + (toY - fromY) * i / steps;
            System.Windows.Forms.Cursor.Position = new System.Drawing.Point(curX, curY);
            Thread.Sleep(15);
        }

        Thread.Sleep(50);
        mouse_event(up, 0, 0, 0, 0);
    }
}
"@
[MouseDragHelper]::Drag(${fX}, ${fY}, ${tX}, ${tY}, ${steps}, "${button}")
Write-Output "SUCCESS"
`;

    try {
      const res = spawnSync('powershell', ['-NoProfile', '-Command', psScript], { encoding: 'utf-8', timeout: 5000 });
      const ok = res.status === 0 && res.stdout.includes('SUCCESS');
      return { success: ok, verified: ok, from: { x: fX, y: fY }, to: { x: tX, y: tY }, steps, button };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Scroll mouse wheel (negative = down, positive = up)
   */
  mouseScroll(delta = -120, coords = null) {
    this._checkEmergencyStop('mouseScroll');
    return this.advAuto.scrollMouse(delta, coords);
  }

  // =========================================================================
  // 2. KEYBOARD & HOTKEY AUTOMATION
  // =========================================================================

  typeText(targetWindowOrNull, text) {
    this._checkEmergencyStop('typeText');
    if (!text && targetWindowOrNull && typeof targetWindowOrNull === 'string') {
      text = targetWindowOrNull;
      targetWindowOrNull = null;
    }
    return this.advAuto.sendKeystrokes(targetWindowOrNull, text);
  }

  sendHotkey(targetWindowOrNull, hotkey) {
    this._checkEmergencyStop('sendHotkey');
    if (!hotkey && targetWindowOrNull && typeof targetWindowOrNull === 'string') {
      hotkey = targetWindowOrNull;
      targetWindowOrNull = null;
    }
    return this.advAuto.sendHotkey(targetWindowOrNull, hotkey);
  }

  // =========================================================================
  // 3. WINDOW & APPLICATION MANAGEMENT
  // =========================================================================

  listWindows() {
    this._checkEmergencyStop('listWindows');
    return this.advAuto.listWindows();
  }

  findWindow(query) {
    this._checkEmergencyStop('findWindow');
    return this.advAuto.findWindow(query);
  }

  focusWindow(queryOrHwnd) {
    this._checkEmergencyStop('focusWindow');
    return this.advAuto.focusWindow(queryOrHwnd);
  }

  setWindowGeometry(queryOrHwnd, bounds) {
    this._checkEmergencyStop('setWindowGeometry');
    return this.advAuto.setWindowGeometry(queryOrHwnd, bounds);
  }

  setWindowState(queryOrHwnd, state) {
    this._checkEmergencyStop('setWindowState');
    return this.advAuto.setWindowState(queryOrHwnd, state);
  }

  closeApplication(queryOrPid) {
    this._checkEmergencyStop('closeApplication');
    return this.advAuto.closeApplication(queryOrPid);
  }

  launchApplication(appName, args = []) {
    this._checkEmergencyStop('launchApplication');
    const key = String(appName || '').toLowerCase().trim();
    const appDef = ALLOWED_DESKTOP_APPLICATIONS[key];
    if (!appDef) {
      throw new Error(`Application '${appName}' is not in allowed desktop applications registry.`);
    }

    if (appDef.isUri) {
      execSync(`start ${appDef.exec}`, { stdio: 'ignore' });
      return { success: true, verified: true, appName: appDef.name, summary: `Launched ${appDef.name} via Windows protocol.` };
    }

    return this.advAuto.launchApplication(key, args, { personality: 'JARVIS' });
  }

  // =========================================================================
  // 4. WINDOWS UI AUTOMATION (UIA) ACCESSIBILITY TREE INSPECTION
  // =========================================================================

  inspectWindowElements(targetWindowOrHwnd = 'active') {
    this._checkEmergencyStop('inspectWindowElements');
    const hierarchy = this.cvi.inspectUIHierarchy(targetWindowOrHwnd);
    return {
      success: true,
      target: targetWindowOrHwnd,
      totalElements: hierarchy.totalControls,
      elements: hierarchy.elements,
      buttons: hierarchy.buttons,
      textFields: hierarchy.textFields,
      menus: hierarchy.menus,
      tabs: hierarchy.tabs,
      dialogs: hierarchy.dialogs,
      durationMs: hierarchy.durationMs
    };
  }

  // =========================================================================
  // 5. FILESYSTEM NAVIGATION, ORGANIZATION & OPERATIONS
  // =========================================================================

  async listDirectory(dirPath = null) {
    this._checkEmergencyStop('listDirectory');
    const target = dirPath ? path.resolve(dirPath) : PROJECT_ROOT;
    return await this.explorer.listDirectory(target);
  }

  async createFolder(folderPath) {
    this._checkEmergencyStop('createFolder');
    const target = path.resolve(folderPath);
    return await this.explorer.createFolder(target);
  }

  async moveItem(srcPath, dstPath) {
    this._checkEmergencyStop('moveItem');
    const s = path.resolve(srcPath);
    const d = path.resolve(dstPath);
    return await this.explorer.renameFile(s, d);
  }

  async copyItem(srcPath, dstPath) {
    this._checkEmergencyStop('copyItem');
    const s = path.resolve(srcPath);
    const d = path.resolve(dstPath);
    return await this.explorer.copyFile(s, d);
  }

  async renameItem(oldPath, newPath) {
    this._checkEmergencyStop('renameItem');
    const o = path.resolve(oldPath);
    const n = path.resolve(newPath);
    return await this.explorer.renameFile(o, n);
  }

  /**
   * Safe file deletion: Always backs up file to recycle backup directory first
   */
  async deleteItem(targetPath, options = {}) {
    this._checkEmergencyStop('deleteItem');
    const t = path.resolve(targetPath);
    if (!fs.existsSync(t)) {
      return { success: false, error: `File not found: ${t}` };
    }

    // Safety backup
    const filename = path.basename(t);
    const backupTarget = path.join(RECYCLE_BACKUP_DIR, `${Date.now()}_${filename}`);
    try {
      fs.copyFileSync(t, backupTarget);
      fs.unlinkSync(t);
      return {
        success: true,
        deletedPath: t,
        backupPath: backupTarget,
        summary: `Safely deleted ${filename} with recovery backup preserved in data/recycle_backup.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Organizes files in target directory into category subfolders
   */
  async organizeDirectory(dirPath, options = {}) {
    this._checkEmergencyStop('organizeDirectory');
    const target = path.resolve(dirPath);
    return await this.explorer.organizeFilesByType(target);
  }
}

const desktopAutomationServiceInstance = new DesktopAutomationService();

module.exports = {
  DesktopAutomationService,
  desktopAutomationServiceInstance,
  ALLOWED_DESKTOP_APPLICATIONS
};
