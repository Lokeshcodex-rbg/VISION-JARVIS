/**
 * JARVIS Desktop Companion, powered by VISION (MADE BY LOKESH) — Electron Main Process
 * Manages window lifecycle, system tray, background wake-word listener,
 * auto-launch on Windows startup, and secure allowlisted desktop actions.
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Suppress non-critical Chromium network pipe warnings and ensure microphone flags
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream'); // Automatically grant audio permissions without prompts
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('enable-features', 'WebAssemblySIMD,AudioServiceOutOfProcess');

// Configuration file path in user data directory
const CONFIG_PATH = path.join(app.getPath('userData'), 'stark_settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {}
  return {
    hideWhenIdle: false, // Keep desktop companion active with deep black screen in dormant state
    alwaysOnTop: false,
    startWithWindows: false,
    defaultPersonality: 'ULTRON'
  };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {}
}

let mainWindow = null;
let tray = null;
let settings = loadSettings();

// Embedded server checker: ensure server.js is running
function ensureServerRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/api/status', (res) => {
      resolve(true);
    });
    req.on('error', () => {
      // Server is not running, spawn server.js
      console.log('[DESKTOP_MAIN] Launching internal backend server...');
      try {
        require('../server.js');
        setTimeout(() => resolve(true), 800);
      } catch (err) {
        console.warn('[DESKTOP_MAIN] Failed to start server directly:', err);
        resolve(false);
      }
    });
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    frame: false,
    show: false, // Start hidden if hideWhenIdle is enabled
    backgroundColor: '#020104',
    alwaysOnTop: settings.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false // Keep Web Speech and 60 FPS animation active even when unfocused!
    }
  });

  // Forward renderer console logs to terminal for real-time diagnostics
  mainWindow.webContents.on('console-message', (event) => {
    console.log(`[DESKTOP_RENDERER] (${event.level}):`, event.message);
  });

  // Security Hardening: Deny arbitrary window.open and popups
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn('[DESKTOP_MAIN] Denied unauthorized window.open request:', url);
    return { action: 'deny' };
  });

  // Security Hardening: Restrict top-level navigations strictly to local companion
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    try {
      const u = new URL(navUrl);
      if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && (u.port === '3000' || !u.port)) {
        return;
      }
    } catch (_) {}
    event.preventDefault();
    console.warn('[DESKTOP_MAIN] Blocked unauthorized navigation attempt to:', navUrl);
  });

  // Load the running companion interface
  mainWindow.loadURL('http://127.0.0.1:3000').catch(() => {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  });

  mainWindow.once('ready-to-show', () => {
    if (!settings.hideWhenIdle) {
      mainWindow.show();
      mainWindow.focus();
    }
    console.log('[DESKTOP_MAIN] Main Window initialized. Hide when idle:', settings.hideWhenIdle);
  });

  mainWindow.on('close', (e) => {
    // If user clicks close, hide to tray instead of quitting
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createSystemTray() {
  // Create an arc reactor / eye stylized tray icon
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#080410" stroke="#38bdf8" stroke-width="2"/>
      <ellipse cx="16" cy="16" rx="10" ry="5" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <circle cx="16" cy="16" r="3.5" fill="#ef4444"/>
    </svg>
  `;
  const icon = nativeImage.createFromBuffer(Buffer.from(svgIcon));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const updateContextMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'JARVIS, powered by VISION — MADE BY LOKESH',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Wake JARVIS (Ocean Blue)',
        click: () => wakePersonality('JARVIS')
      },
      {
        label: 'Wake ULTRON (Crimson)',
        click: () => wakePersonality('ULTRON')
      },
      { type: 'separator' },
      {
        label: '🛑 EMERGENCY STOP',
        click: () => triggerEmergencyStopFromMain('TRAY_EMERGENCY_STOP')
      },
      {
        label: '🟢 Resume / Reset Emergency Stop',
        click: () => resetEmergencyStopFromMain('TRAY_RESET')
      },
      { type: 'separator' },
      {
        label: 'Show Interface',
        click: () => showInterface()
      },
      {
        label: 'Hide Interface (Sleep)',
        click: () => hideInterface()
      },
      { type: 'separator' },
      {
        label: 'Hide When Idle',
        type: 'checkbox',
        checked: settings.hideWhenIdle,
        click: (item) => {
          settings.hideWhenIdle = item.checked;
          saveSettings(settings);
        }
      },
      {
        label: 'Always On Top',
        type: 'checkbox',
        checked: settings.alwaysOnTop,
        click: (item) => {
          settings.alwaysOnTop = item.checked;
          if (mainWindow) mainWindow.setAlwaysOnTop(item.checked);
          saveSettings(settings);
        }
      },
      {
        label: 'Start on Windows Boot',
        type: 'checkbox',
        checked: settings.startWithWindows,
        click: (item) => {
          settings.startWithWindows = item.checked;
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            path: process.execPath
          });
          saveSettings(settings);
        }
      },
      { type: 'separator' },
      {
        label: 'Quit JARVIS (VISION)',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  };

  updateContextMenu();
  tray.setToolTip('JARVIS, powered by VISION — MADE BY LOKESH');
  tray.on('double-click', () => {
    if (mainWindow && mainWindow.isVisible()) {
      hideInterface();
    } else {
      showInterface();
    }
  });
}

function showInterface() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function hideInterface() {
  if (!mainWindow) return;
  // Send go-to-sleep command to renderer so cinematic sleep sequence executes
  mainWindow.webContents.send('desktop:go-to-sleep');
}

function wakePersonality(personality) {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('desktop:wake-word', { personality });
}

// =========================================================================
// IPC HANDLERS
// =========================================================================

ipcMain.on('window:hide', () => {
  hideInterface();
});

ipcMain.on('desktop:hide-window', () => {
  hideInterface();
});

ipcMain.on('window:show', () => {
  showInterface();
});

ipcMain.on('window:show-inactive', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.showInactive();
  }
});

ipcMain.on('desktop:show-window', () => {
  showInterface();
});

ipcMain.on('window:toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

ipcMain.on('window:toggle-always-on-top', () => {
  if (mainWindow) {
    const nextVal = !mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(nextVal);
    settings.alwaysOnTop = nextVal;
    saveSettings(settings);
  }
});

ipcMain.on('renderer:state-change', (event, state) => {
  if (state === 'DORMANT' && settings.hideWhenIdle && mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.handle('app:open-application', async (event, appName, options = {}, personality = 'JARVIS') => {
  const { desktopControllerInstance } = require('../server/desktop/desktopController.js');
  return await desktopControllerInstance.openApplication(appName, options, personality);
});

ipcMain.handle('app:close-application', async (event, appName, options = {}, personality = 'JARVIS') => {
  const { desktopControllerInstance } = require('../server/desktop/desktopController.js');
  return await desktopControllerInstance.closeApplication(appName, options, personality);
});

ipcMain.handle('app:open-folder', async (event, folderName, customPath = null, personality = 'JARVIS') => {
  const { desktopControllerInstance } = require('../server/desktop/desktopController.js');
  return await desktopControllerInstance.openFolder(folderName, customPath, personality);
});

ipcMain.handle('app:open-file', async (event, filePath, personality = 'JARVIS') => {
  const { desktopControllerInstance } = require('../server/desktop/desktopController.js');
  return await desktopControllerInstance.openFile(filePath, personality);
});

ipcMain.handle('app:search-files', async (event, query, options = {}, personality = 'JARVIS') => {
  const { desktopControllerInstance } = require('../server/desktop/desktopController.js');
  return await desktopControllerInstance.searchUserFiles(query, options, personality);
});

ipcMain.handle('app:get-running-apps', async (event, options = {}, personality = 'JARVIS') => {
  const { desktopControllerInstance } = require('../server/desktop/desktopController.js');
  return await desktopControllerInstance.getRunningApplications(options, personality);
});

ipcMain.handle('app:get-hardware-metrics', async (event, metric = 'all', personality = 'JARVIS') => {
  const { desktopControllerInstance } = require('../server/desktop/desktopController.js');
  return await desktopControllerInstance.getHardwareMetrics(metric, personality);
});

ipcMain.handle('app:open-windows-settings', async (event, settingPage = 'default', personality = 'JARVIS') => {
  const { desktopControllerInstance } = require('../server/desktop/desktopController.js');
  return await desktopControllerInstance.openWindowsSetting(settingPage, personality);
});

ipcMain.handle('app:open-web-url', async (event, url, browser = null, personality = 'JARVIS') => {
  const { desktopControllerInstance } = require('../server/desktop/desktopController.js');
  return await desktopControllerInstance.openWebUrl(url, browser, personality);
});

ipcMain.handle('app:control-media', async (event, action = 'playpause', personality = 'JARVIS') => {
  const { desktopControllerInstance } = require('../server/desktop/desktopController.js');
  return await desktopControllerInstance.controlMedia(action, personality);
});

ipcMain.handle('app:get-settings', () => settings);

ipcMain.handle('app:save-settings', (event, newSettings) => {
  settings = { ...settings, ...newSettings };
  saveSettings(settings);
  return settings;
});

// System Time, Timezone & Natural Greeting IPC
ipcMain.handle('app:get-system-time', (event, customDate = null) => {
  const { timeServiceInstance } = require('../server/timeService.js');
  return timeServiceInstance.getCurrentTime(customDate ? new Date(customDate) : null);
});

ipcMain.handle('app:get-natural-greeting', (event, personality = 'JARVIS', options = {}) => {
  const { timeServiceInstance } = require('../server/timeService.js');
  return timeServiceInstance.getNaturalGreeting(personality, options);
});

ipcMain.handle('app:set-time-boundaries', (event, boundaries = {}) => {
  const { timeServiceInstance } = require('../server/timeService.js');
  return timeServiceInstance.setTimeCategoryBoundaries(boundaries);
});

ipcMain.handle('app:select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Folder for JARVIS (VISION) Workspace Access'
  });
  if (canceled || !filePaths || filePaths.length === 0) {
    return { canceled: true };
  }
  const selectedPath = filePaths[0];
  try {
    const { localWorkspaceManagerInstance } = require('../server/desktop/localWorkspaceManager.js');
    const result = localWorkspaceManagerInstance.addAuthorizedRoot(selectedPath);
    return { canceled: false, selectedPath, ...result };
  } catch (err) {
    return { canceled: false, selectedPath, success: false, error: err.message };
  }
});

const { serverAuthManagerInstance } = require('../server/serverAuthManager.js');

function sendAuthenticatedBackendCommand(endpoint, payload = {}) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const token = serverAuthManagerInstance.getSessionToken();
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`,
        'X-Stark-Auth-Token': token
      },
      timeout: 1500
    }, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data: parsed });
        } catch (_) {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, raw: rawData });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'TIMEOUT' });
    });

    req.write(postData);
    req.end();
  });
}

// Emergency Stop Controller IPC (Missions 3, 4, 5)
async function triggerEmergencyStopFromMain(reason = 'GLOBAL_SHORTCUT') {
  console.warn(`[DESKTOP_MAIN] Emergency Stop triggered from main process: ${reason}`);
  const { emergencyStopControllerInstance } = require('../server/emergencyStopController.js');
  const localRes = emergencyStopControllerInstance.engage(reason);

  // Directly latch standalone backend over bounded authenticated HTTP
  const backendResult = await sendAuthenticatedBackendCommand('/api/security/emergency-stop', {
    reason,
    source: 'ELECTRON_MAIN_PROCESS'
  });

  const backendAcknowledged = !!(backendResult && backendResult.ok && backendResult.data && backendResult.data.emergencyStopActive);

  if (backendAcknowledged) {
    console.log('[DESKTOP_MAIN] Standalone backend Emergency Stop verified and latched.');
  } else {
    console.error('[DESKTOP_MAIN] WARNING: Failed to verify backend emergency stop acknowledgement:', backendResult ? backendResult.error || backendResult.statusCode : 'UNKNOWN');
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('desktop:emergency-stop-engaged', {
        reason,
        timestamp: Date.now(),
        backendAcknowledged
      });
    } catch (e) {
      console.warn('[DESKTOP_MAIN] Could not notify renderer window:', e.message);
    }
  }

  return {
    ...localRes,
    backendAcknowledged,
    backendResult
  };
}

async function resetEmergencyStopFromMain(reason = 'TRAY_RESET') {
  console.log(`[DESKTOP_MAIN] Emergency Stop reset from main process: ${reason}`);
  const { emergencyStopControllerInstance } = require('../server/emergencyStopController.js');
  const localRes = emergencyStopControllerInstance.reset(reason);

  const backendResult = await sendAuthenticatedBackendCommand('/api/security/emergency-reset', {
    reason,
    source: 'ELECTRON_MAIN_PROCESS'
  });

  const backendAcknowledged = !!(backendResult && backendResult.ok && backendResult.data && backendResult.data.emergencyStopActive === false);

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('desktop:emergency-stop-reset', {
        reason,
        timestamp: Date.now(),
        backendAcknowledged
      });
    } catch (e) {
      console.warn('[DESKTOP_MAIN] Could not notify renderer window:', e.message);
    }
  }

  return {
    ...localRes,
    backendAcknowledged,
    backendResult
  };
}

ipcMain.handle('emergency-stop:trigger', async (event, reason = 'ELECTRON_MAIN_TRIGGER') => {
  return await triggerEmergencyStopFromMain(reason);
});

ipcMain.handle('emergency-stop:reset', async (event, reason = 'ELECTRON_MAIN_RESET') => {
  return await resetEmergencyStopFromMain(reason);
});

ipcMain.handle('emergency-stop:get-status', () => {
  const { emergencyStopControllerInstance } = require('../server/emergencyStopController.js');
  return emergencyStopControllerInstance.getStatus();
});

// Windows Local Agent IPC Bridges
ipcMain.handle('agent:get-status', async () => {
  const { windowsLocalAgentInstance } = require('../server/desktop/windowsLocalAgent.js');
  return windowsLocalAgentInstance.getStatus();
});

ipcMain.handle('agent:execute-command', async (event, command, options = {}, personality = 'JARVIS') => {
  const { windowsLocalAgentInstance } = require('../server/desktop/windowsLocalAgent.js');
  return await windowsLocalAgentInstance.executeControlledCommand({ command, ...options, personality });
});

ipcMain.handle('agent:execute-workflow', async (event, workflowType, options = {}, personality = 'JARVIS') => {
  const { windowsLocalAgentInstance } = require('../server/desktop/windowsLocalAgent.js');
  return await windowsLocalAgentInstance.executeDesktopWorkflow({ workflowType, options, personality });
});

ipcMain.handle('agent:start-daemon', async () => {
  const { windowsLocalAgentInstance } = require('../server/desktop/windowsLocalAgent.js');
  return await windowsLocalAgentInstance.startPythonAgent();
});

ipcMain.handle('agent:stop-daemon', async () => {
  const { windowsLocalAgentInstance } = require('../server/desktop/windowsLocalAgent.js');
  return await windowsLocalAgentInstance.stopPythonAgent();
});

// =========================================================================
// APP INITIALIZATION
// =========================================================================

app.whenReady().then(async () => {
  // Strictly grant microphone and audio capture permissions in Electron; deny all others
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'mediaKeySystem') {
      return callback(true);
    }
    console.warn(`[DESKTOP_MAIN] Denied unauthorized permission request: ${permission}`);
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return (permission === 'media' || permission === 'mediaKeySystem');
  });

  await ensureServerRunning();
  createMainWindow();
  createSystemTray();

  // Register Global Hotkeys: Ctrl+Shift+J (JARVIS), Ctrl+Shift+U (ULTRON), Ctrl+Shift+Space (Command Bar)
  globalShortcut.register('CommandOrControl+Shift+J', () => wakePersonality('JARVIS'));
  globalShortcut.register('CommandOrControl+Shift+U', () => wakePersonality('ULTRON'));
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('desktop:open-command-bar');
  });
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    triggerEmergencyStopFromMain('GLOBAL_SHORTCUT_CTRL_SHIFT_X');
  });
  globalShortcut.register('Escape', () => hideInterface());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep running in tray on Windows unless explicitly quit
  if (process.platform !== 'darwin') {
    // Keep app alive in tray
  }
});
