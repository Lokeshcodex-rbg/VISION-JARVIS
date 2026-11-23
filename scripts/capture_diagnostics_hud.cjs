/**
 * Script to capture visual screenshots of Voice & Latency Diagnostics HUD
 * using the project's installed Electron runtime.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false,
      frame: false,
      webPreferences: {
        offscreen: true,
        contextIsolation: false,
        nodeIntegration: true
      }
    });

    console.log('[SCREENSHOT] Loading http://localhost:3000?diag=1...');
    await win.loadURL('http://localhost:3000?diag=1');

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Wait for canvas and HUD to render initial telemetry
    await sleep(2200);

    // 1. Capture Living Eye with Voice & Latency Diagnostics HUD Visible
    console.log('[SCREENSHOT] Capturing Living Eye with Diagnostics HUD overlay...');
    let image = await win.webContents.capturePage();
    const hudVisiblePath = path.join(__dirname, '..', 'diagnostics_hud_visible.png');
    fs.writeFileSync(hudVisiblePath, image.toPNG());
    console.log(`[SCREENSHOT] Saved ${hudVisiblePath}`);

    // 2. Hide HUD via Ctrl+Shift+D hotkey
    console.log('[SCREENSHOT] Toggling HUD off via Ctrl+Shift+D...');
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'd',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true
        }));
      })();
    `);
    await sleep(600);

    // 3. Capture clean unobstructed living eye
    console.log('[SCREENSHOT] Capturing clean unobstructed living eye view...');
    image = await win.webContents.capturePage();
    const hudHiddenPath = path.join(__dirname, '..', 'diagnostics_hud_hidden.png');
    fs.writeFileSync(hudHiddenPath, image.toPNG());
    console.log(`[SCREENSHOT] Saved ${hudHiddenPath}`);

    console.log('[SCREENSHOT] All visual evidence captures completed successfully.');
    app.quit();
  } catch (err) {
    console.error('[SCREENSHOT] Capture error:', err);
    app.exit(1);
  }
});
