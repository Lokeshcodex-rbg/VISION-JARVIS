/**
 * Script to capture visual screenshots of Minimal White Smoke Captions
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

    console.log('[SCREENSHOT] Loading http://localhost:3000...');
    await win.loadURL('http://localhost:3000');

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Wait for canvas to render initial frames
    await sleep(1500);

    // 1. User speech caption (ULTRON crimson theme)
    console.log('[SCREENSHOT] Setting User speech caption (ULTRON)...');
    await win.webContents.executeJavaScript(`
      (() => {
        const container = document.getElementById('smoke-captions');
        if (container) {
          container.innerHTML = '<span class="caption-phrase caption-user-final">What is the status of the primary defense grid?</span>';
        }
      })();
    `);
    await sleep(800);
    let image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, '..', 'caption_ultron_user.png'), image.toPNG());
    console.log('[SCREENSHOT] Saved caption_ultron_user.png');

    // 2. Assistant speech caption (ULTRON crimson theme)
    console.log('[SCREENSHOT] Setting ULTRON Assistant speech caption...');
    await win.webContents.executeJavaScript(`
      (() => {
        const container = document.getElementById('smoke-captions');
        if (container) {
          container.innerHTML = '<span class="caption-phrase caption-assistant">All perimeter defense sensors report nominal telemetry across all sectors.</span>';
        }
      })();
    `);
    await sleep(800);
    image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, '..', 'caption_ultron_assistant.png'), image.toPNG());
    console.log('[SCREENSHOT] Saved caption_ultron_assistant.png');

    // 3. Switch to JARVIS theme
    console.log('[SCREENSHOT] Switching to JARVIS theme...');
    await win.webContents.executeJavaScript(`
      (() => {
        const container = document.getElementById('smoke-captions');
        if (container) {
          container.innerHTML = '';
        }
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
      })();
    `);
    // Wait 4.2 seconds for cinematic transition to complete into JARVIS
    await sleep(4200);

    // 4. Assistant speech caption (JARVIS midnight-blue theme)
    console.log('[SCREENSHOT] Setting JARVIS Assistant speech caption...');
    await win.webContents.executeJavaScript(`
      (() => {
        const container = document.getElementById('smoke-captions');
        if (container) {
          container.innerHTML = '<span class="caption-phrase caption-assistant">At your service, sir. The core diagnostic report is completely clean and verified.</span>';
        }
      })();
    `);
    await sleep(800);
    image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, '..', 'caption_jarvis_assistant.png'), image.toPNG());
    console.log('[SCREENSHOT] Saved caption_jarvis_assistant.png');

    // 5. White mist dissolve animation in progress
    console.log('[SCREENSHOT] Triggering white mist dissolve...');
    await win.webContents.executeJavaScript(`
      (() => {
        const phrase = document.querySelector('.caption-phrase');
        if (phrase) {
          phrase.classList.add('caption-dissolving');
        }
      })();
    `);
    await sleep(220); // Mid-dissolve
    image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, '..', 'caption_dissolve_mist.png'), image.toPNG());
    console.log('[SCREENSHOT] Saved caption_dissolve_mist.png');

    console.log('[SCREENSHOT] All visual screenshots captured successfully!');
  } catch (err) {
    console.error('[SCREENSHOT] Error during capture:', err);
  } finally {
    app.quit();
    process.exit(0);
  }
});
