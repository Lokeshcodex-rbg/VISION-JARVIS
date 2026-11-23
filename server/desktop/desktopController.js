/**
 * VISION AI — Unified Desktop Controller
 * Central coordinator combining application management, file system access,
 * system telemetry, web browser navigation, and Windows settings.
 * Enforces permissionGate authorization on every call.
 */

const { exec, spawn } = require('child_process');
const { appLauncherInstance } = require('./appLauncher.js');
const { fileExplorerInstance } = require('./fileExplorer.js');
const { systemInfoInstance } = require('./systemInfo.js');
const { permissionGateInstance } = require('./permissionGate.js');
const { whatsappServiceInstance } = require('./whatsappService.js');

// Windows Settings URI mapping
const SETTINGS_MAP = {
  default: 'ms-settings:',
  display: 'ms-settings:display',
  screen: 'ms-settings:display',
  sound: 'ms-settings:sound',
  audio: 'ms-settings:sound',
  volume: 'ms-settings:sound',
  network: 'ms-settings:network',
  wifi: 'ms-settings:network-wifi',
  internet: 'ms-settings:network',
  bluetooth: 'ms-settings:bluetooth',
  devices: 'ms-settings:bluetooth',
  apps: 'ms-settings:appsfeatures',
  update: 'ms-settings:windowsupdate',
  windowsupdate: 'ms-settings:windowsupdate',
  power: 'ms-settings:powersleep',
  battery: 'ms-settings:powersleep',
  notifications: 'ms-settings:notifications'
};

class DesktopController {
  constructor() {
    this.appLauncher = appLauncherInstance;
    this.fileExplorer = fileExplorerInstance;
    this.systemInfo = systemInfoInstance;
    this.permissionGate = permissionGateInstance;
  }

  /**
   * Opens an application with permission check
   */
  async openApplication(appName, options = {}, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('open_desktop_app', { appName }, personality);
    const res = await this.appLauncher.launchApplication(appName, options);
    if (res && typeof res.success !== 'boolean') {
      res.success = (res.status === 'launched' || res.status === 'already_running' || res.status === 'focused' || res.verified === true);
    }
    return res;
  }

  /**
   * Closes an application with permission check
   */
  async closeApplication(appName, options = {}, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('close_desktop_app', { appName, ...options }, personality);
    return await this.appLauncher.closeApplication(appName, options);
  }

  /**
   * Opens a folder in File Explorer with permission check
   */
  async openFolder(folderName, customPath = null, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('open_folder', { folderName, customPath }, personality);
    return await this.fileExplorer.openFolder(folderName, customPath);
  }

  /**
   * Opens a file via Windows default association with permission check
   */
  async openFile(filePath, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('open_file', { filePath }, personality);
    return await this.fileExplorer.openFile(filePath);
  }

  /**
   * Searches user directories for files with permission check
   */
  async searchUserFiles(query, options = {}, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('search_user_files', { query, ...options }, personality);
    return await this.fileExplorer.searchUserFiles(query, options);
  }

  /**
   * Reads an authorized user file with permission check
   */
  async readTextFile(filePath, options = {}, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('read_text_file', { filePath }, personality);
    return await this.fileExplorer.readTextFile(filePath, options);
  }

  /**
   * Lists active running applications with permission check
   */
  async getRunningApplications(options = {}, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('get_running_applications', options, personality);
    return await this.systemInfo.getRunningApplications(options);
  }

  /**
   * Retrieves hardware metrics (CPU, RAM, Disks) with permission check
   */
  async getHardwareMetrics(metricType = 'all', personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('get_hardware_metrics', { metricType }, personality);
    return await this.systemInfo.getHardwareMetrics(metricType);
  }

  /**
   * Opens a website or web search in the default Windows browser
   */
  async openWebUrl(url, browser = null, personality = 'JARVIS') {
    if (!url || typeof url !== 'string') {
      return { status: 'error', summary: 'No valid URL provided, sir.' };
    }

    const t0 = Date.now();
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
        targetUrl = 'https://' + targetUrl;
      } else {
        // Search query
        targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(targetUrl);
      }
    }

    this.permissionGate.authorizeToolExecution('open_web_url', { url: targetUrl, browser }, personality);

    try {
      const wantChrome = String(browser || '').toLowerCase().includes('chrome') || !browser;
      if (wantChrome && (!browser || String(browser).toLowerCase().includes('chrome'))) {
        try {
          const { chromeProfileService } = require('./chromeProfileService.js');
          const chromeExe = chromeProfileService.getChromeExecutablePath();
          if (chromeExe) {
            const profQuery = (typeof browser === 'object' && browser?.profile) ? browser.profile : 'default';
            const chromeRes = await chromeProfileService.launchProfile(profQuery, targetUrl);
            if (chromeRes && chromeRes.success && chromeRes.verified) {
              let domain = targetUrl;
              try { domain = new URL(targetUrl).hostname; } catch (e) {}
              return {
                success: true,
                verified: true,
                status: 'opened',
                browser: 'Google Chrome',
                url: targetUrl,
                domain,
                pid: chromeRes.pid,
                hwnd: chromeRes.hwnd,
                windowTitle: chromeRes.windowTitle || domain,
                durationMs: Date.now() - t0,
                summary: `Opened ${domain} in verified Google Chrome (PID ${chromeRes.pid || 'active'}), sir.`
              };
            }
            if (String(browser || '').toLowerCase().includes('chrome')) {
              return {
                success: false,
                verified: false,
                status: 'error',
                browser: 'Google Chrome',
                url: targetUrl,
                error: chromeRes?.error || 'Could not verify Google Chrome window opened.',
                summary: chromeRes?.summary || `Failed to verify Google Chrome opening ${targetUrl}, sir.`
              };
            }
          } else if (String(browser || '').toLowerCase().includes('chrome')) {
            return {
              success: false,
              verified: false,
              status: 'not_installed',
              browser: 'Google Chrome',
              url: targetUrl,
              error: 'Google Chrome executable was not found on this Windows system.',
              summary: 'Google Chrome is not installed on this PC, sir.'
            };
          }
        } catch (chromeErr) {
          if (String(browser || '').toLowerCase().includes('chrome')) {
            return {
              success: false,
              verified: false,
              status: 'error',
              browser: 'Google Chrome',
              url: targetUrl,
              error: chromeErr.message,
              summary: `Failed to launch Google Chrome: ${chromeErr.message}`
            };
          }
        }
      }

      exec(`start "" "${targetUrl}"`);
      let domain = targetUrl;
      try {
        domain = new URL(targetUrl).hostname;
      } catch (e) {}

      const durationMs = Date.now() - t0;
      return {
        success: true,
        verified: false,
        status: 'opened',
        url: targetUrl,
        domain,
        durationMs,
        summary: `Dispatched ${domain} to default browser handler, sir.`
      };
    } catch (err) {
      return {
        success: false,
        verified: false,
        status: 'error',
        error: err.message,
        summary: `Failed to open web browser: ${err.message}`
      };
    }
  }

  /**
   * Opens a specific Windows Settings page
   */
  async openWindowsSetting(settingPage = 'default', personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('open_windows_settings', { settingPage }, personality);

    const clean = (settingPage || 'default').toLowerCase().trim();
    const uri = SETTINGS_MAP[clean] || SETTINGS_MAP.default;

    try {
      exec(`start ${uri}`);
      const pageTitle = clean === 'default' ? 'Windows Settings' : `${clean.charAt(0).toUpperCase() + clean.slice(1)} Settings`;
      return {
        status: 'opened',
        settingPage: clean,
        uri,
        summary: `Opening ${pageTitle} for you, sir.`
      };
    } catch (err) {
      return {
        status: 'error',
        error: err.message,
        summary: `Failed to open Windows Settings: ${err.message}`
      };
    }
  }

  /**
   * Controls system media playback (Play, Pause, Mute, Volume)
   */
  async controlMedia(action = 'playpause', personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('control_media', { action }, personality);

    const act = (action || '').toLowerCase().trim();
    // PowerShell WScript.Shell key codes:
    // 0xAD = Volume Mute, 0xAE = Volume Down, 0xAF = Volume Up, 0xB3 = Play/Pause, 0xB0 = Next, 0xB1 = Prev
    const keyMap = {
      'play': 0xB3,
      'pause': 0xB3,
      'playpause': 0xB3,
      'toggle': 0xB3,
      'next': 0xB0,
      'skip': 0xB0,
      'previous': 0xB1,
      'prev': 0xB1,
      'mute': 0xAD,
      'unmute': 0xAD,
      'volumedown': 0xAE,
      'volumeup': 0xAF
    };

    const keyCode = keyMap[act] || 0xB3;

    return new Promise((resolve) => {
      const psCommand = `powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]${keyCode})"`;
      exec(psCommand, { timeout: 3000 }, (err) => {
        if (err) {
          return resolve({
            status: 'error',
            error: err.message,
            summary: `Media control failed: ${err.message}`
          });
        }
        resolve({
          status: 'success',
          action: act,
          summary: `Media ${act} signal sent, sir.`
        });
      });
    });
  }

  /**
   * Adjusts system and call volume live with discrete steps
   */
  async adjustVolume(direction = 'volumeup', steps = 2, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('adjust_volume', { direction, steps }, personality);
    const { whatsappServiceInstance } = require('./whatsappService.js');
    return await whatsappServiceInstance.adjustVolume(direction, steps);
  }

  /**
   * Creates a file with permission check
   */
  async createFile(filePath, content = '', personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('create_file', { filePath }, personality);
    return await this.fileExplorer.createFile(filePath, content);
  }

  /**
   * Edits a file with permission check
   */
  async editFile(filePath, content, options = {}, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('edit_file', { filePath }, personality);
    return await this.fileExplorer.editFile(filePath, content, options);
  }

  /**
   * Renames a file with permission check
   */
  async renameFile(oldPath, newPath, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('rename_file', { oldPath, newPath }, personality);
    return await this.fileExplorer.renameFile(oldPath, newPath);
  }

  /**
   * Copies a file with permission check
   */
  async copyFile(sourcePath, destPath, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('copy_file', { sourcePath, destPath }, personality);
    return await this.fileExplorer.copyFile(sourcePath, destPath);
  }

  /**
   * Deletes a file with permission check
   */
  async deleteFile(filePath, options = {}, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('delete_file', { filePath, ...options }, personality);
    return await this.fileExplorer.deleteFile(filePath, options);
  }

  /**
   * Reads Windows clipboard text
   */
  async getClipboardText(personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('read_clipboard', {}, personality);
    return new Promise((resolve) => {
      exec('powershell -NoProfile -Command "Get-Clipboard"', { timeout: 3000 }, (err, stdout) => {
        if (err) {
          return resolve({ status: 'error', error: err.message, summary: 'Failed to read clipboard.' });
        }
        const text = String(stdout || '').trim();
        resolve({
          success: true,
          status: 'success',
          text,
          content: text,
          summary: text ? `Clipboard contains: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"` : 'Clipboard is currently empty, sir.'
        });
      });
    });
  }

  /**
   * Writes text to Windows clipboard
   */
  async setClipboardText(text, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('write_clipboard', { text }, personality);
    return new Promise((resolve) => {
      const cleanText = String(text || '').replace(/'/g, "''");
      const ps = `powershell -NoProfile -Command "Set-Clipboard -Value '${cleanText}'"`;
      exec(ps, { timeout: 3000 }, (err) => {
        if (err) {
          return resolve({ success: false, status: 'error', error: err.message, summary: 'Failed to write to clipboard.' });
        }
        resolve({
          success: true,
          status: 'success',
          summary: `Text successfully copied to your clipboard, sir.`
        });
      });
    });
  }

  /**
   * Interacts with an application window (focus or typing text)
   */
  async interactWindow(windowTitle, action = 'focus', text = '', personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('interact_window', { windowTitle, action }, personality);
    return new Promise((resolve) => {
      const safeTitle = String(windowTitle || '').replace(/'/g, "''");
      const safeText = String(text || '').replace(/'/g, "''");

      let ps = '';
      if (action === 'type' && text) {
        ps = `powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; if ($ws.AppActivate('${safeTitle}')) { Start-Sleep -Milliseconds 250; $ws.SendKeys('${safeText}'); 'SUCCESS' } else { 'NOT_FOUND' }"`;
      } else {
        ps = `powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; if ($ws.AppActivate('${safeTitle}')) { 'SUCCESS' } else { 'NOT_FOUND' }"`;
      }

      exec(ps, { timeout: 4000 }, (err, stdout) => {
        if (err) {
          return resolve({ status: 'error', error: err.message, summary: `Window interaction failed: ${err.message}` });
        }
        const res = String(stdout || '').trim();
        if (res.includes('SUCCESS')) {
          resolve({
            status: 'success',
            windowTitle,
            action,
            summary: action === 'type' ? `Focused "${windowTitle}" and typed text, sir.` : `Focused window "${windowTitle}", sir.`
          });
        } else {
          resolve({
            status: 'window_not_found',
            windowTitle,
            summary: `I could not locate an active window matching "${windowTitle}", sir.`
          });
        }
      });
    });
  }

  async listOpenWindows(personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('list_open_windows', {}, personality);
    return await this.appLauncher.listOpenWindows();
  }

  async focusWindow(query, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('focus_desktop_window', { query }, personality);
    return await this.appLauncher.focusWindow(query);
  }

  async minimizeWindow(query, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('minimize_desktop_window', { query }, personality);
    return await this.appLauncher.minimizeWindow(query);
  }

  async maximizeWindow(query, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('maximize_desktop_window', { query }, personality);
    return await this.appLauncher.maximizeWindow(query);
  }

  async restoreWindow(query, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('restore_desktop_window', { query }, personality);
    return await this.appLauncher.restoreWindow(query);
  }

  async switchWindow(query, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('switch_desktop_window', { query }, personality);
    return await this.appLauncher.switchWindow(query);
  }

  async findInstalledApplications(query = '', personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('find_installed_apps', { query }, personality);
    return await this.appLauncher.findInstalledApplications(query);
  }

  async readWindowContent(query = '', personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('read_window_content', { query }, personality);
    return await this.appLauncher.readWindowContent(query);
  }

  // =========================================================================
  // WhatsApp Integration Proxies
  // =========================================================================

  async openWhatsApp(personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('open_desktop_app', { appName: 'whatsapp' }, personality);
    return await whatsappServiceInstance.openWhatsApp();
  }

  async openWhatsAppConversation(contact, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('open_whatsapp_conversation', { contact }, personality);
    return await whatsappServiceInstance.openConversation(contact);
  }

  async draftWhatsAppMessage(contact, messageText, personality = 'JARVIS', options = {}) {
    this.permissionGate.authorizeToolExecution('draft_whatsapp_message', { contact, messageText }, personality);
    return whatsappServiceInstance.draftMessage(contact, messageText, options);
  }

  async stageWhatsAppMessage(contact, messageText, personality = 'JARVIS', options = {}) {
    this.permissionGate.authorizeToolExecution('stage_whatsapp_message', { contact, messageText }, personality);
    return await whatsappServiceInstance.stageMessageForUserConfirmation(contact, messageText, options);
  }

  async confirmWhatsAppSend(personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('confirm_whatsapp_send', { userConfirmed: true }, personality);
    return await whatsappServiceInstance.confirmAndDispatchPendingMessage();
  }

  async cancelWhatsAppSend(personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('cancel_whatsapp_send', {}, personality);
    return await whatsappServiceInstance.cancelPendingMessage();
  }

  async sendWhatsAppMessage(draftIdOrContact, messageText = null, userConfirmed = true, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('send_whatsapp_message', { target: draftIdOrContact, userConfirmed }, personality);
    return await whatsappServiceInstance.sendMessage(draftIdOrContact, messageText, userConfirmed);
  }

  async sendWhatsAppVoiceMessage(contact, durationSec = 3, userConfirmed = true, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('send_whatsapp_voice_message', { contact, userConfirmed }, personality);
    return await whatsappServiceInstance.sendVoiceMessage(contact, durationSec, userConfirmed);
  }

  async initiateWhatsAppCall(contact, userConfirmed = true, personality = 'JARVIS', callType = 'voice') {
    this.permissionGate.authorizeToolExecution('initiate_whatsapp_call', { contact, userConfirmed }, personality);
    return await whatsappServiceInstance.initiateCall(contact, userConfirmed, callType);
  }

  async endWhatsAppCall(personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('end_whatsapp_call', {}, personality);
    return await whatsappServiceInstance.endCall();
  }

  async readRecentWhatsAppMessages(contact = '', personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('read_whatsapp_messages', { contact }, personality);
    return await whatsappServiceInstance.readRecentMessages(contact);
  }

  getWhatsAppCallState(personality = 'JARVIS') {
    return whatsappServiceInstance.getCallState();
  }

  setUserAvailability(status = 'AVAILABLE', customMessage = null, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('set_user_availability', { status, customMessage }, personality);
    return whatsappServiceInstance.setUserAvailability(status, customMessage);
  }

  getUserAvailability(personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('get_user_availability', {}, personality);
    return whatsappServiceInstance.getUserAvailability();
  }

  async processIncomingWhatsAppMessage(contact, incomingMessage, options = {}, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('process_incoming_whatsapp_message', { contact, incomingMessage }, personality);
    return await whatsappServiceInstance.processIncomingMessage(contact, incomingMessage, options);
  }

  async confirmIncomingReply(userConfirmed = true, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('confirm_incoming_reply', { userConfirmed }, personality);
    return await whatsappServiceInstance.confirmIncomingReply(userConfirmed);
  }

  async sendJarvisVoiceNote(contact, textToSpeak = null, durationSec = 3, userConfirmed = true, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('send_jarvis_voice_note', { contact, userConfirmed }, personality);
    return await whatsappServiceInstance.sendJarvisVoiceNote(contact, textToSpeak, durationSec, userConfirmed);
  }

  getWhatsAppConversationHistory(contact, personality = 'JARVIS') {
    this.permissionGate.authorizeToolExecution('get_whatsapp_conversation_history', { contact }, personality);
    return whatsappServiceInstance.getConversationHistory(contact);
  }
}

module.exports = {
  DesktopController,
  desktopControllerInstance: new DesktopController()
};
