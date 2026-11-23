/**
 * JARVIS, powered by VISION (MADE BY LOKESH) — Secure Electron Preload Bridge
 * Exposes strictly gated IPC methods to the renderer window.
 * Enforces Context Isolation with zero Node.js integration in renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isElectron: true,

  // Window Management
  hideWindow: () => ipcRenderer.send('window:hide'),
  showWindow: () => ipcRenderer.send('window:show'),
  showWindowInactive: () => ipcRenderer.send('window:show-inactive'),
  toggleFullscreen: () => ipcRenderer.send('window:toggle-fullscreen'),
  toggleAlwaysOnTop: () => ipcRenderer.send('window:toggle-always-on-top'),

  // Application Lifecycle & Wake Events
  onWakeWord: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('desktop:wake-word', handler);
    return () => ipcRenderer.removeListener('desktop:wake-word', handler);
  },

  onGoToSleep: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('desktop:go-to-sleep', handler);
    return () => ipcRenderer.removeListener('desktop:go-to-sleep', handler);
  },

  onSwitchPersonality: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('desktop:switch-personality', handler);
    return () => ipcRenderer.removeListener('desktop:switch-personality', handler);
  },

  onOpenCommandBar: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('desktop:open-command-bar', handler);
    return () => ipcRenderer.removeListener('desktop:open-command-bar', handler);
  },

  // Notify Main Process
  notifyRendererState: (state) => ipcRenderer.send('renderer:state-change', state),
  notifyStatus: (state) => ipcRenderer.send('renderer:state-change', state),

  // Allowlisted Native App Launcher & Desktop Control Bridge
  openApplication: (appName, options = {}, personality = 'JARVIS') =>
    ipcRenderer.invoke('app:open-application', appName, options, personality),
  closeApplication: (appName, options = {}, personality = 'JARVIS') =>
    ipcRenderer.invoke('app:close-application', appName, options, personality),
  openFolder: (folderName, customPath = null, personality = 'JARVIS') =>
    ipcRenderer.invoke('app:open-folder', folderName, customPath, personality),
  openFile: (filePath, personality = 'JARVIS') =>
    ipcRenderer.invoke('app:open-file', filePath, personality),
  searchFiles: (query, options = {}, personality = 'JARVIS') =>
    ipcRenderer.invoke('app:search-files', query, options, personality),
  getRunningApplications: (options = {}, personality = 'JARVIS') =>
    ipcRenderer.invoke('app:get-running-apps', options, personality),
  getHardwareMetrics: (metric = 'all', personality = 'JARVIS') =>
    ipcRenderer.invoke('app:get-hardware-metrics', metric, personality),
  openWindowsSettings: (settingPage = 'default', personality = 'JARVIS') =>
    ipcRenderer.invoke('app:open-windows-settings', settingPage, personality),
  openWebUrl: (url, browser = null, personality = 'JARVIS') =>
    ipcRenderer.invoke('app:open-web-url', url, browser, personality),
  controlMedia: (action = 'playpause', personality = 'JARVIS') =>
    ipcRenderer.invoke('app:control-media', action, personality),
  selectFolder: () => ipcRenderer.invoke('app:select-folder'),

  // Settings
  getSettings: () => ipcRenderer.invoke('app:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('app:save-settings', settings),

  // OS System Time, Timezone & Natural Greeting Bridge
  getSystemTime: (customDate = null) => ipcRenderer.invoke('app:get-system-time', customDate),
  getNaturalGreeting: (personality = 'JARVIS', options = {}) =>
    ipcRenderer.invoke('app:get-natural-greeting', personality, options),
  setTimeBoundaries: (boundaries = {}) =>
    ipcRenderer.invoke('app:set-time-boundaries', boundaries),

  // Emergency Stop Controller (Missions 3, 4, 5)
  triggerEmergencyStop: (reason) => ipcRenderer.invoke('emergency-stop:trigger', reason),
  resetEmergencyStop: (reason) => ipcRenderer.invoke('emergency-stop:reset', reason),
  getEmergencyStopStatus: () => ipcRenderer.invoke('emergency-stop:get-status'),
  onEmergencyStopEngaged: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('desktop:emergency-stop-engaged', handler);
    return () => ipcRenderer.removeListener('desktop:emergency-stop-engaged', handler);
  },
  onEmergencyStopReset: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('desktop:emergency-stop-reset', handler);
    return () => ipcRenderer.removeListener('desktop:emergency-stop-reset', handler);
  },

  // Windows Local Agent Bridges
  agentGetStatus: () => ipcRenderer.invoke('agent:get-status'),
  agentExecuteCommand: (command, options = {}, personality = 'JARVIS') =>
    ipcRenderer.invoke('agent:execute-command', command, options, personality),
  agentExecuteWorkflow: (workflowType, options = {}, personality = 'JARVIS') =>
    ipcRenderer.invoke('agent:execute-workflow', workflowType, options, personality),
  agentStartDaemon: () => ipcRenderer.invoke('agent:start-daemon'),
  agentStopDaemon: () => ipcRenderer.invoke('agent:stop-daemon')
});
