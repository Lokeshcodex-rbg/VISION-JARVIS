const { app, BrowserWindow, session } = require('electron');

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('[ELECTRON_TEST] Permission requested:', permission);
    callback(true);
  });

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.webContents.on('console-message', (event) => {
    console.log(`[RENDERER_CONSOLE] (${event.level}):`, event.message);
  });

  console.log('[ELECTRON_TEST] Loading http://localhost:3000 ...');
  await win.loadURL('http://localhost:3000');

  // Let it run for 4 seconds to observe initial voice controller setup
  await new Promise(r => setTimeout(r, 4000));

  const diagnostics = await win.webContents.executeJavaScript(`
    (() => {
      const vc = window.jarvisApp?.voiceController;
      return {
        hasApp: Boolean(window.jarvisApp),
        vcSupported: vc?.isSupported,
        vcListening: vc?.isListening,
        vcNetworkError: vc?.isNetworkError,
        vadInitialized: vc?.vad?.isInitialized,
        vadFallback: vc?.vad?.isFallbackMode,
        vadDevice: vc?.vad?.activeDeviceLabel,
        vadRMS: vc?.vad?.currentRMS
      };
    })()
  `);

  console.log('[ELECTRON_TEST] Diagnostics:', diagnostics);
  app.quit();
});
