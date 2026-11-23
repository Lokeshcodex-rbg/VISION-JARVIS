/**
 * VISION AI — Windows Application Launcher & Process Manager
 * Provides verified desktop application discovery, protocol activation,
 * process lifecycle management, duplicate prevention, and truthful web fallbacks.
 */

const { spawn, exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { windowsAppRegistry } = require('./windowsAppRegistry.js');

// Standard verified Windows application definitions & fallbacks
const REGISTERED_APPS = {
  whatsapp: {
    name: 'WhatsApp Desktop',
    type: 'uwp',
    packageFamilyName: '5319275A.WhatsAppDesktop_cv1g1gvanyjgm',
    aumid: '5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App',
    protocol: 'whatsapp:',
    processNames: ['WhatsApp.Root', 'WhatsApp', 'WhatsAppDesktop'],
    webFallbackUrl: 'https://web.whatsapp.com',
    aliases: ['whatsapp', 'wa', 'whats app', 'whatsapp desktop']
  },
  vscode: {
    name: 'Visual Studio Code',
    type: 'win32',
    execCandidates: [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Microsoft VS Code', 'Code.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
      'C:\\Program Files\\Microsoft VS Code\\Code.exe',
      'code'
    ],
    processNames: ['Code'],
    aliases: ['vscode', 'code', 'vs code', 'visual studio code']
  },
  chrome: {
    name: 'Google Chrome',
    type: 'win32',
    execCandidates: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'chrome'
    ],
    processNames: ['chrome'],
    aliases: ['chrome', 'google chrome', 'google']
  },
  edge: {
    name: 'Microsoft Edge',
    type: 'win32',
    execCandidates: [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'msedge'
    ],
    processNames: ['msedge'],
    aliases: ['edge', 'msedge', 'microsoft edge', 'browser']
  },
  notepad: {
    name: 'Notepad',
    type: 'win32',
    execCandidates: [
      'C:\\Windows\\System32\\notepad.exe',
      'notepad'
    ],
    processNames: ['notepad'],
    aliases: ['notepad', 'text editor', 'notes']
  },
  calculator: {
    name: 'Calculator',
    type: 'uwp_or_win32',
    aumid: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App',
    execCandidates: [
      'C:\\Windows\\System32\\calc.exe',
      'calc'
    ],
    processNames: ['CalculatorApp', 'calc', 'Calculator'],
    aliases: ['calc', 'calculator', 'hisab']
  },
  explorer: {
    name: 'File Explorer',
    type: 'win32',
    execCandidates: [
      'C:\\Windows\\explorer.exe',
      'explorer'
    ],
    processNames: ['explorer'],
    aliases: ['explorer', 'file explorer', 'files', 'windows explorer']
  },
  taskmgr: {
    name: 'Task Manager',
    type: 'win32',
    execCandidates: [
      'C:\\Windows\\System32\\taskmgr.exe',
      'taskmgr'
    ],
    processNames: ['Taskmgr', 'taskmgr'],
    aliases: ['task manager', 'taskmgr', 'processes', 'activity monitor']
  },
  settings: {
    name: 'Windows Settings',
    type: 'uri',
    uri: 'ms-settings:',
    processNames: ['SystemSettings'],
    aliases: ['settings', 'windows settings', 'control panel', 'system settings']
  },
  word: {
    name: 'Microsoft Word',
    type: 'win32',
    execCandidates: [
      'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
      'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
      'C:\\Program Files\\Microsoft Office\\Office15\\WINWORD.EXE',
      'C:\\Program Files (x86)\\Microsoft Office\\Office15\\WINWORD.EXE',
      'winword.exe',
      'winword'
    ],
    processNames: ['WINWORD', 'winword'],
    aliases: ['word', 'ms word', 'microsoft word', 'winword', 'document editor', 'doc']
  },
  wps: {
    name: 'WPS Writer',
    type: 'uwp_or_win32',
    aumid: 'Kingsoft.Office.WPS',
    execCandidates: windowsAppRegistry._discoverWpsExecutables(),
    processNames: ['wps', 'wpsoffice'],
    aliases: ['wps', 'wps writer', 'wps docs', 'wps office', 'kingsoft', 'kingsoft writer']
  },
  terminal: {
    name: 'Windows Terminal',
    type: 'win32',
    execCandidates: [
      path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'wt.exe'),
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      'C:\\Windows\\System32\\cmd.exe',
      'wt',
      'powershell'
    ],
    processNames: ['WindowsTerminal', 'wt', 'powershell', 'cmd'],
    aliases: ['terminal', 'windows terminal', 'powershell', 'cmd', 'command prompt', 'bash', 'console']
  },
  excel: {
    name: 'Microsoft Excel',
    type: 'win32',
    execCandidates: [
      'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE',
      'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\EXCEL.EXE',
      'excel.exe',
      'excel'
    ],
    processNames: ['EXCEL', 'excel'],
    aliases: ['excel', 'ms excel', 'microsoft excel', 'spreadsheet']
  }
};

// System critical processes protected from accidental termination
const PROTECTED_PROCESSES = [
  'system', 'idle', 'csrss.exe', 'smss.exe', 'lsass.exe', 'services.exe',
  'svchost.exe', 'wininit.exe', 'winlogon.exe', 'dwm.exe', 'explorer.exe',
  'electron.exe', 'node.exe'
];

class WindowsAppLauncher {
  constructor() {
    this.apps = REGISTERED_APPS;
    this.installedCache = new Map();
    this.processCache = new Map();
    this.lastProcessCacheTime = 0;
    this.isRefreshing = false;
    this.lastActiveExternalApp = null;

    // Pre-warm verified applications in memory for sub-millisecond execution
    try {
      for (const [key, app] of Object.entries(this.apps)) {
        if (app.type === 'uri') {
          this.installedCache.set(app.name, true);
        } else if (app.type === 'uwp' && app.packageFamilyName) {
          const pkgPath = path.join(os.homedir(), 'AppData', 'Local', 'Packages', app.packageFamilyName);
          if (fs.existsSync(pkgPath)) {
            this.installedCache.set(app.name, true);
          }
        } else if (app.execCandidates) {
          for (const cand of app.execCandidates) {
            if (path.isAbsolute(cand) && fs.existsSync(cand)) {
              this.installedCache.set(app.name, true);
              break;
            }
          }
        }
      }
    } catch (e) {}
  }

  get registeredApps() {
    return this.apps;
  }

  /**
   * Resolves user query (English / Hindi / Hinglish) to a registered app definition
   */
  resolveApp(appName) {
    if (!appName || typeof appName !== 'string') return null;
    const clean = appName.toLowerCase().replace(/[;!?,.]+$/, '').trim();

    // Reject input containing shell metacharacters
    if (/[&|;`$\\]/.test(clean)) {
      return null;
    }

    // Direct key match
    if (this.apps[clean]) return this.apps[clean];

    // Check exact alias or whole-word match
    for (const [key, app] of Object.entries(this.apps)) {
      for (const alias of app.aliases) {
        if (alias === clean || `${alias}.exe` === clean) return app;
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRegex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
        if (wordRegex.test(clean)) {
          return app;
        }
      }
    }
    return null;
  }

  /**
   * Checks if an application process is already running on the system    * Leverages fast in-memory cache with synchronous fallback when empty to guarantee accuracy.
   */
  async isProcessRunning(processNames, liveCheck = false) {
    if (!processNames || processNames.length === 0) return { running: false };

    // 1. Instant in-memory check with PID liveness validation
    if (this.processCache && this.processCache.size > 0 && !liveCheck) {
      for (const pName of processNames) {
        const cleanP = pName.toLowerCase().replace(/\.exe$/, '');
        if (this.processCache.has(cleanP)) {
          const pid = this.processCache.get(cleanP);
          try {
            process.kill(pid, 0); // Verify PID is genuinely alive
            return { running: true, processName: pName, pid };
          } catch (e) {
            if (e.code === 'EPERM') {
              // EPERM confirms the process exists and is actively running with elevated permissions
              return { running: true, processName: pName, pid };
            }
            this.processCache.delete(cleanP); // Only clean up dead process if ESRCH
          }
        }
      }
    }

    // 2. Fast direct targeted inspection for specific process names (<500ms)
    for (const pName of processNames) {
      const cleanP = pName.toLowerCase().replace(/\.exe$/, '');
      try {
        const out = execSync(`tasklist /FI "IMAGENAME eq ${cleanP}.exe" /FO CSV /NH`, { timeout: 3000, encoding: 'utf8' });
        const m = out.match(/"([^"]+)","(\d+)"/i);
        if (m) {
          const pid = parseInt(m[2], 10);
          if (this.processCache) this.processCache.set(cleanP, pid);
          return { running: true, processName: pName, pid };
        }
      } catch (_) {}
    }

    // 3. Trigger non-blocking background refresh if cache is older than 10s
    const now = Date.now();
    if (now - this.lastProcessCacheTime > 10000) {
      this.refreshProcessCacheInBackground();
    }

    return { running: false };
  }

  async refreshProcessCache() {
    return new Promise((resolve) => {
      this.lastProcessCacheTime = Date.now();
      exec('tasklist /FO CSV /NH', { timeout: 20000 }, (err, stdout) => {
        if (err || !stdout) return resolve(this.processCache);

        const cache = new Map();
        const lines = stdout.toLowerCase().split(/\r?\n/);
        for (const line of lines) {
          const match = line.match(/^"([^"]+)","(\d+)"/);
          if (match) {
            const cleanName = match[1].replace(/\.exe$/, '');
            cache.set(cleanName, parseInt(match[2], 10));
          }
        }
        this.processCache = cache;
        resolve(this.processCache);
      });
    });
  }

  refreshProcessCacheInBackground() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.refreshProcessCache().finally(() => {
      this.isRefreshing = false;
    });
  }

  /**
   * Detects whether an application is genuinely installed on this machine
   */
  async verifyInstallation(appDef) {
    if (this.installedCache.has(appDef.name)) {
      return this.installedCache.get(appDef.name);
    }

    if (appDef.type === 'uri') {
      this.installedCache.set(appDef.name, true);
      return true;
    }

    // Fast filesystem check for UWP Package
    if (appDef.type === 'uwp' || appDef.packageFamilyName) {
      if (appDef.packageFamilyName) {
        const pkgPath = path.join(os.homedir(), 'AppData', 'Local', 'Packages', appDef.packageFamilyName);
        if (fs.existsSync(pkgPath)) {
          this.installedCache.set(appDef.name, true);
          return true;
        }
      }
      const uwpInstalled = await new Promise((resolve) => {
        exec(`powershell -NoProfile -Command "Get-AppxPackage -Name '*${appDef.name.split(' ')[0]}*' | Select-Object -ExpandProperty PackageFullName"`, { timeout: 800 }, (err, stdout) => {
          if (!err && stdout && stdout.trim()) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
      if (uwpInstalled) {
        this.installedCache.set(appDef.name, true);
        return true;
      }
    }

    // Check Win32 Executable Candidates
    if (appDef.execCandidates) {
      for (const candidate of appDef.execCandidates) {
        if (path.isAbsolute(candidate)) {
          if (fs.existsSync(candidate)) {
            this.installedCache.set(appDef.name, true);
            return true;
          }
        } else {
          // Check PATH
          const inPath = await new Promise((resolve) => {
            exec(`where ${candidate}`, { timeout: 2500 }, (err) => resolve(!err));
          });
          if (inPath) {
            this.installedCache.set(appDef.name, true);
            return true;
          }
        }
      }
    }

    this.installedCache.set(appDef.name, false);
    return false;
  }

  /**
   * Alias for launchApplication / closeApplication
   */
  async launch(appName, options = {}) {
    return this.launchApplication(appName, options);
  }

  async close(appName) {
    return this.closeApplication(appName);
  }

  /**
   * Launches or activates an application on Windows
   */
  async launchApplication(appName, options = {}) {
    // Check explicit ambiguity first (e.g. "open office" when both Word and WPS Writer exist)
    try {
      const disambig = await windowsAppRegistry.resolveAppWithDisambiguation(appName);
      if (disambig && disambig.status === 'AMBIGUOUS') {
        return {
          status: 'clarification_needed',
          clarificationRequired: true,
          verified: false,
          appName,
          candidates: disambig.matches.map(m => m.name),
          summary: disambig.clarificationQuestion
        };
      }
    } catch (_) {}

    const appDef = this.resolveApp(appName);

    if (!appDef) {
      try {
        // Resolve dynamically via installed registry (Start Menu, App Paths, UWP StartApps)
        const dynApp = await windowsAppRegistry.resolveApp(appName);
        if (dynApp) {
          const dynExec = windowsAppRegistry.resolveExecutablePath(dynApp);
          const pyScript = path.join(__dirname, 'win32_app_launcher.py');
          const pyArgs = [pyScript, dynApp.name];
          if (dynExec) pyArgs.push('--exec', dynExec);
          else if (dynApp.aumid) pyArgs.push('--aumid', dynApp.aumid);
          if (options.targetFile) pyArgs.push(options.targetFile);
          if (options.forceNew === true) pyArgs.push('--force-new');

          const dynResult = await new Promise((resolve) => {
            const { execFile } = require('child_process');
            execFile('python', pyArgs, { timeout: 15000 }, (err, stdout) => {
              if (!err && stdout && stdout.trim()) {
                try { return resolve(JSON.parse(stdout.trim())); } catch (_) {}
              }
              resolve({ verified: false, pid: null });
            });
          });
          if (dynResult && dynResult.verified) {
            this.lastActiveExternalApp = { appName: dynApp.name, pid: dynResult.pid, hwnd: dynResult.hwnd, windowTitle: dynResult.windowTitle, trackedAt: Date.now() };
            return {
              status: dynResult.reusedExisting ? 'already_running' : 'launched',
              verified: true,
              reusedExisting: Boolean(dynResult.reusedExisting),
              appName: dynApp.name,
              pid: dynResult.pid,
              hwnd: dynResult.hwnd,
              windowTitle: dynResult.windowTitle || dynApp.name,
              summary: dynResult.summary || `Launched ${dynApp.name} on your desktop (PID ${dynResult.pid}), sir.`
            };
          }
        }

        const regRes = await windowsAppRegistry.launchOrActivate(appName, options);
        if (regRes && regRes.success && regRes.verified) {
          this.lastActiveExternalApp = { appName: regRes.app || appName, pid: regRes.pid, hwnd: regRes.hwnd || null, windowTitle: regRes.title, trackedAt: Date.now() };
          return {
            status: regRes.reused ? 'already_running' : 'launched',
            verified: true,
            reusedExisting: Boolean(regRes.reused),
            appName: regRes.app || appName,
            pid: regRes.pid || null,
            hwnd: regRes.hwnd || null,
            title: regRes.title || null,
            summary: regRes.summary
          };
        }
        if (regRes && regRes.success === false) {
          return {
            status: regRes.action || 'launch_failed',
            appName: regRes.app || appName,
            verified: false,
            error: regRes.error || regRes.summary,
            summary: regRes.summary || regRes.error || `Failed to verify launch for "${appName}", sir.`
          };
        }
      } catch (regErr) {
        // Fall through to error
      }

      return {
        status: 'unrecognized',
        appName,
        verified: false,
        summary: `I could not locate "${appName}" among installed Windows applications, sir. Try saying the exact app name or ask me to search installed apps.`
      };
    }

    // 1. Check if application is already running (duplicate prevention)
    const runningStatus = await this.isProcessRunning(appDef.processNames);
    if (runningStatus.running && options.forceNew !== true && !options.targetFile) {
      // Bring active window to foreground
      let focusResult = null;
      try {
        focusResult = await this.focusWindow(appDef.name);
      } catch (_) {}

      // Only treat as already running if focus succeeded on a visible GUI window!
      if (focusResult && focusResult.success) {
        this.lastActiveExternalApp = {
          appName: appDef.name,
          pid: focusResult.pid || runningStatus.pid,
          hwnd: focusResult.hwnd || null,
          windowTitle: focusResult.windowTitle || appDef.name,
          trackedAt: Date.now()
        };
        return {
          status: 'already_running',
          verified: true,
          reusedExisting: true,
          appName: appDef.name,
          pid: focusResult.pid || runningStatus.pid,
          hwnd: focusResult.hwnd || null,
          windowTitle: focusResult.windowTitle || '',
          instanceCount: focusResult.instanceCount || 1,
          summary: `${appDef.name} is already active on your laptop, sir. I have brought it to the foreground.`
        };
      }
      // If focus could not find the existing window, proceed to normal launcher without killing existing user sessions!
    }

    // 2. Verify installation on Windows
    const isInstalled = await this.verifyInstallation(appDef);

    // 3. Fallback handling for missing desktop app (e.g. WhatsApp Web)
    if (!isInstalled) {
      if (appDef.webFallbackUrl && (options.openWebFallback !== false)) {
        exec(`start "" "${appDef.webFallbackUrl}"`);
        return {
          status: 'fallback_web',
          appName: appDef.name,
          url: appDef.webFallbackUrl,
          isDesktopApp: false,
          verified: true,
          summary: `I could not locate an installed desktop version of ${appDef.name} on your Windows laptop. I have opened ${appDef.name} Web in your default browser instead, sir.`
        };
      }

      return {
        status: 'not_installed',
        appName: appDef.name,
        isDesktopApp: false,
        verified: false,
        summary: `${appDef.name} does not appear to be installed on your Windows system, sir.`
      };
    }

    // 4. Execute Launch on Interactive Windows Desktop with Verification
    try {
      let resolvedExec = null;
      if (appDef.execCandidates) {
        for (const candidate of appDef.execCandidates) {
          if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
            resolvedExec = candidate;
            break;
          }
        }
      }
      if (!resolvedExec && appDef.execCandidates && appDef.execCandidates.length > 0) {
        resolvedExec = appDef.execCandidates[0];
      }

      const args = options.args || [];
      const processNames = appDef.processNames || [appDef.name];

      const pyScript = path.join(__dirname, 'win32_app_launcher.py');
      const pyArgs = [pyScript, appDef.name];
      if (options.targetFile) {
        pyArgs.push(options.targetFile);
      }
      if (options.forceNew === true) {
        pyArgs.push('--force-new');
      }

      const launchResult = await new Promise((resolve) => {
        const { execFile } = require('child_process');
        execFile('python', pyArgs, { timeout: 15000 }, (err, stdout, stderr) => {
          if (!err && stdout && stdout.trim()) {
            try {
              const parsed = JSON.parse(stdout.trim());
              return resolve(parsed);
            } catch (_) {}
          }
          // Fallback if launcher returned plain output or error
          resolve({
            verified: false,
            pid: null,
            appName: appDef.name,
            summary: err ? err.message : stdout.trim()
          });
        });
      });

      // Update process cache & lastActiveExternalApp with genuine active PID
      if (launchResult.pid && appDef.processNames) {
        for (const pName of appDef.processNames) {
          this.processCache.set(pName.toLowerCase().replace(/\.exe$/, ''), launchResult.pid);
        }
      }
      if (launchResult.verified) {
        this.lastActiveExternalApp = {
          appName: appDef.name,
          pid: launchResult.pid,
          hwnd: launchResult.hwnd,
          windowTitle: launchResult.windowTitle || appDef.name,
          trackedAt: Date.now()
        };
      }

      return {
        status: launchResult.verified ? 'launched' : 'launched_unverified',
        appName: appDef.name,
        target: appDef.name,
        pid: launchResult.pid,
        hwnd: launchResult.hwnd,
        windowTitle: launchResult.windowTitle || '',
        verified: launchResult.verified,
        evidenceScreenshot: launchResult.evidenceScreenshot,
        summary: launchResult.summary || (launchResult.verified
          ? `Opening ${appDef.name} for you right away, sir. Process is verified active on your desktop.`
          : `I dispatched the launch command for ${appDef.name}, but could not empirically verify the process active on your desktop, sir.`)
      };
    } catch (err) {
      return {
        status: 'error',
        appName: appDef.name,
        error: err.message,
        verified: false,
        summary: `I encountered an issue opening ${appDef.name}, sir: ${err.message}`
      };
    }
  }

  /**
   * Closes or terminates a running application safely.
   * Supports contextual references ("the app I was using", "current app") when unambiguous,
   * and returns clarification_needed instead of guessing across multiple unrelated open apps.
   */
  async closeApplication(appName, options = {}) {
    let targetQuery = String(appName || '').trim();
    const isContextualRef = !targetQuery || /^(?:the\s+)?(?:app(?:lication)?\s+i\s+was\s+using|previous(?:\s+app(?:lication)?)?|last(?:\s+app(?:lication)?)?|current\s+app(?:lication)?|that\s+app|it|this\s+app)$/i.test(targetQuery);

    if (isContextualRef) {
      if (this.lastActiveExternalApp && this.lastActiveExternalApp.appName) {
        targetQuery = this.lastActiveExternalApp.appName;
      } else {
        const winList = await this.listOpenWindows();
        const nonHost = (winList.windows || []).filter(w => {
          const pn = (w.processName || '').toLowerCase();
          const wt = (w.windowTitle || '').toLowerCase();
          return !['electron', 'node', 'code', 'antigravity', 'explorer', 'applicationframehost', 'textinputhost'].includes(pn) && !wt.includes('lokesh ai');
        });
        if (nonHost.length === 1) {
          targetQuery = nonHost[0].processName || nonHost[0].windowTitle;
        } else if (nonHost.length > 1) {
          const choices = nonHost.slice(0, 4).map(w => w.windowTitle || w.processName).join(', ');
          return {
            status: 'clarification_needed',
            clarificationRequired: true,
            verified: false,
            candidates: nonHost.slice(0, 5).map(w => ({ pid: w.pid, processName: w.processName, windowTitle: w.windowTitle })),
            summary: `Multiple user applications are open right now (${choices}). Which one would you like me to close, sir?`
          };
        } else {
          return {
            status: 'clarification_needed',
            clarificationRequired: true,
            verified: false,
            summary: 'Which application would you like me to close, sir? No recent external application was tracked.'
          };
        }
      }
    }

    const appDef = this.resolveApp(targetQuery) || await windowsAppRegistry.resolveApp(targetQuery);
    const targetName = appDef ? appDef.name : targetQuery;
    const processNames = appDef ? (appDef.processNames || [targetQuery]) : [targetQuery];

    // Check if running
    const runningStatus = await this.isProcessRunning(processNames, true);
    if (!runningStatus.running) {
      return {
        status: 'not_running',
        appName: targetName,
        summary: `${targetName} is not currently running on your laptop, sir.`
      };
    }

    const primaryProcess = runningStatus.processName || processNames[0];

    // Protection check against terminating system-critical processes
    if (PROTECTED_PROCESSES.includes(primaryProcess.toLowerCase()) || PROTECTED_PROCESSES.includes(`${primaryProcess.toLowerCase()}.exe`)) {
      return {
        status: 'rejected_protected',
        appName: targetName,
        processName: primaryProcess,
        summary: `Security Warning: "${primaryProcess}" is a protected Windows core process. Terminating it is strictly prohibited to preserve system stability.`
      };
    }

    const force = Boolean(options.force);
    const killFlag = force ? '/F' : '';

    return new Promise((resolve) => {
      exec(`taskkill /IM "${primaryProcess}.exe" ${killFlag} /T`, { timeout: 4000 }, (err) => {
        if (err) {
          // Try without .exe extension
          exec(`taskkill /IM "${primaryProcess}" ${killFlag} /T`, { timeout: 4000 }, (err2) => {
            if (err2) {
              return resolve({
                status: 'error',
                appName: targetName,
                error: err2.message,
                summary: `Failed to close ${targetName}: ${err2.message}`
              });
            }
            if (this.lastActiveExternalApp && String(this.lastActiveExternalApp.appName || '').toLowerCase() === String(targetName).toLowerCase()) {
              this.lastActiveExternalApp = null;
            }
            resolve({
              success: true,
              status: 'closed',
              appName: targetName,
              summary: `I have closed ${targetName} for you, sir.`
            });
          });
          return;
        }

        if (this.lastActiveExternalApp && String(this.lastActiveExternalApp.appName || '').toLowerCase() === String(targetName).toLowerCase()) {
          this.lastActiveExternalApp = null;
        }
        resolve({
          success: true,
          status: 'closed',
          appName: targetName,
          summary: `I have closed ${targetName} for you, sir.`
        });
      });
    });
  }

  /**
   * Enumerates active open application windows and process IDs on Windows
   */
  async listOpenWindows() {
    return new Promise((resolve) => {
      const pyScript = path.join(__dirname, 'win32_app_launcher.py');
      const { execFile } = require('child_process');
      execFile('python', [pyScript, 'list_windows'], { timeout: 3500 }, (pyErr, pyOut) => {
        if (!pyErr && pyOut && pyOut.trim()) {
          try {
            const parsed = JSON.parse(pyOut.trim());
            if (parsed.success && Array.isArray(parsed.windows)) {
              const cleanWindows = parsed.windows.map(w => ({
                hwnd: w.hwnd,
                pid: w.pid,
                processName: (w.proc || '').replace(/\.exe$/i, ''),
                windowTitle: w.title,
                className: w.class,
                rect: w.rect,
                isForeground: Boolean(w.isForeground)
              }));
              const fg = cleanWindows.find(w => w.isForeground) || cleanWindows[0] || null;
              return resolve({
                success: true,
                count: cleanWindows.length,
                foregroundWindow: fg,
                windows: cleanWindows,
                summary: `Found ${cleanWindows.length} active application window${cleanWindows.length === 1 ? '' : 's'}${fg ? ` (Active: ${fg.windowTitle})` : ''}.`
              });
            }
          } catch (_) {}
        }

        const ps = `powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress"`;
        exec(ps, { timeout: 3500 }, (err, stdout) => {
          if (err || !stdout) {
            return resolve({ success: true, count: 0, windows: [], summary: 'No visible application windows detected.' });
          }
          try {
            const parsed = JSON.parse(stdout.trim());
            const list = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
            const cleanWindows = list.map(w => ({
              pid: w.Id,
              processName: w.ProcessName,
              windowTitle: w.MainWindowTitle
            }));
            resolve({
              success: true,
              count: cleanWindows.length,
              foregroundWindow: cleanWindows[0] || null,
              windows: cleanWindows,
              summary: `Found ${cleanWindows.length} active application window${cleanWindows.length === 1 ? '' : 's'}.`
            });
          } catch (_) {
            resolve({ success: true, count: 0, windows: [], summary: 'No visible application windows detected.' });
          }
        });
      });
    });
  }

  /**
   * Focuses and brings a window matching title or process name to foreground
   */
  async focusWindow(query) {
    if (!query) throw new Error('Window title or application name is required.');
    const safeQ = String(query).replace(/'/g, "''");

    // Fast Path (<30ms): Direct Win32 EnumDesktopWindows via launcher
    try {
      const pyScript = path.join(__dirname, 'win32_app_launcher.py');
      const fastRes = await new Promise((resolve) => {
        const { execFile } = require('child_process');
        execFile('python', [pyScript, 'focus', query], { timeout: 2000 }, (err, stdout) => {
          if (!err && stdout && stdout.trim()) {
            try {
              const parsed = JSON.parse(stdout.trim());
              if (parsed.success) return resolve(parsed);
            } catch (_) {}
          }
          resolve(null);
        });
      });

      if (fastRes && fastRes.success) {
        return {
          success: true,
          action: 'focus',
          pid: fastRes.pid,
          hwnd: fastRes.hwnd,
          title: fastRes.windowTitle || query,
          summary: fastRes.summary || `Focused "${fastRes.windowTitle || query}", sir.`
        };
      }
    } catch (_) {}

    // Fallback: PowerShell WScript.Shell AppActivate
    return new Promise((resolve) => {
      const ps = `powershell -NoProfile -Command "$proc = Get-Process | Where-Object { $_.MainWindowTitle -like '*${safeQ}*' -or $_.ProcessName -like '*${safeQ}*' } | Select-Object -First 1; if ($proc) { $ws = New-Object -ComObject WScript.Shell; $res = $ws.AppActivate($proc.Id); if ($res) { 'SUCCESS:' + $proc.MainWindowTitle } else { 'FAILED' } } else { 'NOT_FOUND' }"`;
      exec(ps, { timeout: 4000 }, (err, stdout) => {
        const out = String(stdout || '').trim();
        if (out.startsWith('SUCCESS:')) {
          const title = out.replace('SUCCESS:', '');
          resolve({
            success: true,
            action: 'focus',
            title,
            summary: `Focused "${title}", sir.`
          });
        } else if (out === 'NOT_FOUND') {
          resolve({
            success: false,
            action: 'focus',
            summary: `I could not locate an active window matching "${query}", sir.`
          });
        } else {
          resolve({
            success: false,
            action: 'focus',
            summary: `Attempted to focus "${query}", but Windows denied foreground activation.`
          });
        }
      });
    });
  }

  /**
   * Minimizes a window matching query
   */
  async minimizeWindow(query) {
    if (!query) throw new Error('Window title or application name is required.');
    const safeQ = String(query).replace(/'/g, "''");
    return new Promise((resolve) => {
      const ps = `powershell -NoProfile -Command "Add-Type -TypeDefinition '@using System; using System.Runtime.InteropServices; public class WinMgr { [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'; $proc = Get-Process | Where-Object { $_.MainWindowTitle -like '*${safeQ}*' -or $_.ProcessName -like '*${safeQ}*' } | Select-Object -First 1; if ($proc) { [WinMgr]::ShowWindow($proc.MainWindowHandle, 6); 'SUCCESS:' + $proc.MainWindowTitle } else { 'NOT_FOUND' }"`;
      exec(ps, { timeout: 4000 }, (err, stdout) => {
        const out = String(stdout || '').trim();
        if (out.startsWith('SUCCESS:')) {
          const title = out.replace('SUCCESS:', '');
          resolve({
            success: true,
            action: 'minimize',
            title,
            summary: `Minimized "${title}", sir.`
          });
        } else {
          resolve({
            success: false,
            action: 'minimize',
            summary: `I could not locate an active window matching "${query}" to minimize, sir.`
          });
        }
      });
    });
  }

  /**
   * Maximizes a window matching query
   */
  async maximizeWindow(query) {
    if (!query) throw new Error('Window title or application name is required.');
    const safeQ = String(query).replace(/'/g, "''");
    return new Promise((resolve) => {
      const ps = `powershell -NoProfile -Command "Add-Type -TypeDefinition '@using System; using System.Runtime.InteropServices; public class WinMgr { [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'; $proc = Get-Process | Where-Object { $_.MainWindowTitle -like '*${safeQ}*' -or $_.ProcessName -like '*${safeQ}*' } | Select-Object -First 1; if ($proc) { [WinMgr]::ShowWindow($proc.MainWindowHandle, 3); 'SUCCESS:' + $proc.MainWindowTitle } else { 'NOT_FOUND' }"`;
      exec(ps, { timeout: 4000 }, (err, stdout) => {
        const out = String(stdout || '').trim();
        if (out.startsWith('SUCCESS:')) {
          const title = out.replace('SUCCESS:', '');
          resolve({
            success: true,
            action: 'maximize',
            title,
            summary: `Maximized "${title}", sir.`
          });
        } else {
          resolve({
            success: false,
            action: 'maximize',
            summary: `I could not locate an active window matching "${query}" to maximize, sir.`
          });
        }
      });
    });
  }

  /**
   * Restores a minimized/maximized window matching query
   */
  async restoreWindow(query) {
    if (!query) throw new Error('Window title or application name is required.');
    const safeQ = String(query).replace(/'/g, "''");
    return new Promise((resolve) => {
      const ps = `powershell -NoProfile -Command "Add-Type -TypeDefinition '@using System; using System.Runtime.InteropServices; public class WinMgr { [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'; $proc = Get-Process | Where-Object { $_.MainWindowTitle -like '*${safeQ}*' -or $_.ProcessName -like '*${safeQ}*' } | Select-Object -First 1; if ($proc) { [WinMgr]::ShowWindow($proc.MainWindowHandle, 9); 'SUCCESS:' + $proc.MainWindowTitle } else { 'NOT_FOUND' }"`;
      exec(ps, { timeout: 4000 }, (err, stdout) => {
        const out = String(stdout || '').trim();
        if (!err && out.startsWith('SUCCESS:')) {
          const title = out.replace('SUCCESS:', '');
          resolve({
            success: true,
            verified: true,
            action: 'restore',
            title,
            summary: `Restored "${title}", sir.`
          });
        } else {
          resolve({
            success: false,
            verified: false,
            action: 'restore',
            summary: `I could not locate an active window matching "${query}" to restore, sir.`
          });
        }
      });
    });
  }

  /**
   * Reads visible UI elements & text from an open or active Windows application via UI Automation
   */
  async readWindowContent(query = '') {
    let targetHwnd = 0;
    const rawQ = String(query || '').trim();
    const qLower = rawQ.toLowerCase();

    // First leverage real Win32 EnumWindows enumeration (works reliably for Win11 tabbed/Store apps like Notepad whose Get-Process MainWindowHandle can be 0)
    try {
      if (qLower === 'last' && this.lastActiveExternalApp?.hwnd) {
        targetHwnd = Number(this.lastActiveExternalApp.hwnd) || 0;
      } else if (rawQ) {
        const winsRes = await this.listOpenWindows();
        const wins = Array.isArray(winsRes) ? winsRes : (winsRes?.windows || []);
        const matched = wins.find(w => {
          const hay = `${w.windowTitle || w.title || ''} ${w.processName || ''}`.toLowerCase();
          return hay.includes(qLower);
        });
        if (matched?.hwnd) targetHwnd = Number(matched.hwnd) || 0;
      }
    } catch { /* fallback to UIA lookup in PowerShell */ }

    const safeQ = rawQ.replace(/'/g, "''");
    return new Promise((resolve) => {
      const psScript = `
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$targetEl = $null
$hwndNum = ${targetHwnd}
if ($hwndNum -gt 0) {
  try { $targetEl = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]::new($hwndNum)) } catch {}
}
if (-not $targetEl -and '${safeQ}' -ne '') {
  $proc = Get-Process | Where-Object { ($_.MainWindowTitle -like '*${safeQ}*' -or $_.ProcessName -like '*${safeQ}*') -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($proc) { $targetEl = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle) }
  if (-not $targetEl) {
    $rootWins = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($rw in $rootWins) {
      if ($rw.Current.Name -like '*${safeQ}*') { $targetEl = $rw; break }
    }
  }
}
if (-not $targetEl) {
  $targetEl = [System.Windows.Automation.AutomationElement]::FocusedElement
  if ($targetEl) {
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    $curr = $targetEl
    while ($curr -ne $null) {
      $parent = $walker.GetParent($curr)
      if ($parent -eq [System.Windows.Automation.AutomationElement]::RootElement) { $targetEl = $curr; break }
      $curr = $parent
    }
  }
}
if (-not $targetEl) {
  @{ success = $false; error = 'No matching visible window found' } | ConvertTo-Json -Compress
  exit 0
}
$texts = New-Object System.Collections.Generic.List[string]
$seen = New-Object 'System.Collections.Generic.HashSet[string]'
$winName = $targetEl.Current.Name
if ($winName) { [void]$seen.Add($winName); $texts.Add($winName) }
$all = $targetEl.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
$count = [Math]::Min(160, $all.Count)
for ($i = 0; $i -lt $count; $i++) {
  $el = $all.Item($i)
  $n = $el.Current.Name
  if ($n -and $n.Trim().Length -gt 0 -and -not $seen.Contains($n.Trim())) {
    [void]$seen.Add($n.Trim())
    $texts.Add($n.Trim())
  }
  try {
    $vp = $null
    if ($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
      $val = $vp.Current.Value
      if ($val -and $val.Trim().Length -gt 0 -and -not $seen.Contains($val.Trim())) {
        [void]$seen.Add($val.Trim())
        $texts.Add($val.Trim())
      }
    }
  } catch {}
}
@{ success = $true; windowTitle = $winName; controlCount = $all.Count; texts = @($texts) } | ConvertTo-Json -Compress -Depth 3
`;
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      exec(`powershell -NoProfile -EncodedCommand ${encoded}`, { timeout: 8000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          return resolve({ success: false, windowTitle: '', texts: [], error: err ? err.message : 'Empty UIA output' });
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          const texts = Array.isArray(parsed.texts) ? parsed.texts : [];
          resolve({
            success: Boolean(parsed.success),
            error: parsed.error || undefined,
            windowTitle: parsed.windowTitle || '',
            controlCount: parsed.controlCount || texts.length,
            texts,
            content: texts.join('\n'),
            summary: parsed.success
              ? `Read ${texts.length} visible UI text element(s) from "${parsed.windowTitle || query}", sir.`
              : (parsed.error || 'Could not inspect target window.')
          });
        } catch (parseErr) {
          resolve({ success: false, windowTitle: '', texts: [], error: parseErr.message });
        }
      });
    });
  }

  /**
   * Switches window to target application
   */
  async switchWindow(query) {
    return this.focusWindow(query);
  }

  /**
   * Searches for installed applications on the Windows machine
   */
  async findInstalledApplications(query = '') {
    const qLower = String(query || '').toLowerCase().trim();
    const registeredMatches = Object.values(this.apps)
      .filter(a => !qLower || a.name.toLowerCase().includes(qLower) || a.aliases.some(al => al.includes(qLower)))
      .map(a => ({ name: a.name, type: a.type, aliases: a.aliases }));

    let dynamicMatches = [];
    try {
      const scanned = await windowsAppRegistry.scanInstalledApps();
      dynamicMatches = scanned
        .filter(a => !qLower || a.name.toLowerCase().includes(qLower) || (a.aliases && a.aliases.some(al => al.includes(qLower))))
        .filter(a => !registeredMatches.some(rm => rm.name.toLowerCase() === a.name.toLowerCase()))
        .map(a => ({ name: a.name, type: 'discovered', aliases: a.aliases }));
    } catch (_) {}

    const allMatches = [...registeredMatches, ...dynamicMatches];

    return {
      success: true,
      query,
      count: allMatches.length,
      applications: allMatches,
      summary: `Found ${allMatches.length} application${allMatches.length === 1 ? '' : 's'} matching "${query}".`
    };
  }
}

module.exports = {
  WindowsAppLauncher,
  appLauncherInstance: new WindowsAppLauncher(),
  REGISTERED_APPS
};
