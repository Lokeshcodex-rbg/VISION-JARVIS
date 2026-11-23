/**
 * VISION AI — Universal Windows Application Registry & Lifecycle Manager
 * Workstream B: Dynamic Discovery, Process Enumeration, Window Reuse & Focus
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn, execSync, execFileSync } = require('child_process');

class WindowsAppRegistry {
  constructor() {
    this.cachedApps = new Map();
    this.lastScanTime = 0;
    this.scanIntervalMs = 60000; // 1 minute cache
    this.initializeStandardApps();
  }

  initializeStandardApps() {
    const home = os.homedir();
    const wpsCandidates = this._discoverWpsExecutables(home);
    const standard = [
      {
        id: 'word',
        name: 'Microsoft Word',
        executable: 'WINWORD.EXE',
        aliases: ['word', 'ms word', 'microsoft word', 'winword', 'doc', 'docx'],
        protocol: null,
        processNames: ['WINWORD', 'WINWORD.EXE'],
        candidates: [
          'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
          'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
          'C:\\Program Files\\Microsoft Office\\Office16\\WINWORD.EXE',
          'C:\\Program Files (x86)\\Microsoft Office\\Office16\\WINWORD.EXE'
        ]
      },
      {
        id: 'wps',
        name: 'WPS Writer',
        executable: 'wps.exe',
        aumid: 'Kingsoft.Office.WPS',
        aliases: ['wps', 'wps writer', 'wps docs', 'wps office', 'kingsoft', 'kingsoft writer'],
        protocol: null,
        processNames: ['wps', 'wpsoffice'],
        candidates: wpsCandidates
      },
      {
        id: 'excel',
        name: 'Microsoft Excel',
        executable: 'EXCEL.EXE',
        aliases: ['excel', 'ms excel', 'microsoft excel', 'spreadsheet', 'xls', 'xlsx'],
        protocol: null,
        processNames: ['EXCEL', 'EXCEL.EXE'],
        candidates: [
          'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE',
          'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\EXCEL.EXE'
        ]
      },
      {
        id: 'powerpoint',
        name: 'Microsoft PowerPoint',
        executable: 'POWERPNT.EXE',
        aliases: ['powerpoint', 'ppt', 'power point', 'slides'],
        protocol: null,
        processNames: ['POWERPNT', 'POWERPNT.EXE'],
        candidates: [
          'C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE',
          'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\POWERPNT.EXE'
        ]
      },
      {
        id: 'chrome',
        name: 'Google Chrome',
        executable: 'chrome.exe',
        aliases: ['chrome', 'google chrome', 'browser'],
        protocol: null,
        processNames: ['chrome'],
        candidates: [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe')
        ]
      },
      {
        id: 'edge',
        name: 'Microsoft Edge',
        executable: 'msedge.exe',
        aliases: ['edge', 'msedge', 'microsoft edge'],
        protocol: null,
        processNames: ['msedge'],
        candidates: [
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ]
      },
      {
        id: 'vscode',
        name: 'Visual Studio Code',
        executable: 'Code.exe',
        aliases: ['vscode', 'vs code', 'code', 'visual studio code'],
        protocol: 'vscode:',
        processNames: ['Code'],
        candidates: [
          path.join(home, 'AppData', 'Local', 'Programs', 'Microsoft VS Code', 'Code.exe'),
          'C:\\Program Files\\Microsoft VS Code\\Code.exe'
        ]
      },
      {
        id: 'spotify',
        name: 'Spotify',
        executable: 'Spotify.exe',
        aliases: ['spotify', 'music player'],
        protocol: 'spotify:',
        processNames: ['Spotify'],
        candidates: [
          path.join(home, 'AppData', 'Roaming', 'Spotify', 'Spotify.exe'),
          path.join(home, 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'Spotify.exe')
        ]
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp Desktop',
        executable: null,
        aumid: '5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App',
        aliases: ['whatsapp', 'wa', 'whats app', 'whatsapp desktop'],
        protocol: 'whatsapp:',
        processNames: ['WhatsApp.Root', 'WhatsApp', 'WhatsAppDesktop'],
        candidates: []
      },
      {
        id: 'notepad',
        name: 'Notepad',
        executable: 'notepad.exe',
        aliases: ['notepad', 'notes', 'text editor'],
        protocol: null,
        processNames: ['notepad'],
        candidates: ['C:\\Windows\\notepad.exe', 'C:\\Windows\\System32\\notepad.exe']
      },
      {
        id: 'calculator',
        name: 'Calculator',
        executable: 'calc.exe',
        aumid: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App',
        aliases: ['calc', 'calculator'],
        protocol: 'calculator:',
        processNames: ['CalculatorApp', 'calc'],
        candidates: ['C:\\Windows\\System32\\calc.exe']
      },
      {
        id: 'paint',
        name: 'Paint',
        executable: 'mspaint.exe',
        aumid: 'Microsoft.Paint_8wekyb3d8bbwe!App',
        aliases: ['paint', 'mspaint', 'ms paint'],
        protocol: null,
        processNames: ['mspaint'],
        candidates: ['C:\\Windows\\System32\\mspaint.exe']
      },
      {
        id: 'terminal',
        name: 'Windows Terminal',
        executable: 'wt.exe',
        aliases: ['terminal', 'windows terminal', 'powershell', 'cmd', 'command prompt'],
        protocol: null,
        processNames: ['WindowsTerminal', 'wt', 'powershell', 'cmd'],
        candidates: [
          path.join(home, 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'wt.exe'),
          'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
        ]
      },
      {
        id: 'settings',
        name: 'Windows Settings',
        executable: null,
        aliases: ['settings', 'win settings', 'control panel'],
        protocol: 'ms-settings:',
        processNames: ['SystemSettings'],
        candidates: []
      }
    ];

    for (const app of standard) {
      this.cachedApps.set(app.id, app);
    }
  }

  _discoverWpsExecutables(home = os.homedir()) {
    const out = [];
    try {
      const kBase = path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'kingsoft', 'WPS Office');
      if (fs.existsSync(kBase)) {
        const versions = fs.readdirSync(kBase, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name)
          .sort()
          .reverse();
        for (const ver of versions) {
          const wpsExe = path.join(kBase, ver, 'office6', 'wps.exe');
          if (fs.existsSync(wpsExe)) out.push(wpsExe);
        }
      }
    } catch (_) {}
    out.push('C:\\Program Files (x86)\\Kingsoft\\WPS Office\\ksolaunch.exe');
    return out;
  }

  /**
   * Resolves first existing executable path for a registered or discovered app
   */
  resolveExecutablePath(appDef) {
    if (!appDef) return null;
    if (appDef.executable && path.isAbsolute(appDef.executable) && fs.existsSync(appDef.executable)) {
      return appDef.executable;
    }
    for (const cand of (appDef.candidates || [])) {
      if (cand && path.isAbsolute(cand) && fs.existsSync(cand) && cand.toLowerCase().endsWith('.exe')) {
        return cand;
      }
    }
    return null;
  }

  /**
   * Scan Start Menu shortcuts, Registry App Paths, and Windows Store StartApps
   */
  async scanInstalledApps(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && now - this.lastScanTime < this.scanIntervalMs && this.cachedApps.size > 18) {
      return Array.from(this.cachedApps.values());
    }

    const shortcutDirs = [
      path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs')
    ];

    const findShortcuts = (dir, depth = 0) => {
      if (depth > 3 || !fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            findShortcuts(fullPath, depth + 1);
          } else if (entry.isFile() && (entry.name.endsWith('.lnk') || entry.name.endsWith('.exe'))) {
            const baseName = path.basename(entry.name, path.extname(entry.name));
            const id = baseName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (id && !this.cachedApps.has(id)) {
              this.cachedApps.set(id, {
                id,
                name: baseName,
                executable: entry.name.endsWith('.exe') ? fullPath : null,
                shortcutPath: entry.name.endsWith('.lnk') ? fullPath : null,
                aliases: [baseName.toLowerCase()],
                processNames: [baseName],
                candidates: [fullPath],
                source: 'start_menu_file'
              });
            }
          }
        }
      } catch (_) {}
    };

    for (const dir of shortcutDirs) {
      findShortcuts(dir);
    }

    // Dynamic Get-StartApps + Registry App Paths discovery (handles UWP, Store, WPS, CodeBlocks, etc.)
    try {
      const psCmd = `powershell -NoProfile -Command "$apps = @(); try { Get-StartApps | ForEach-Object { $apps += [PSCustomObject]@{ name = $_.Name; aumid = $_.AppID; exe = $null } } } catch {}; try { Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*.exe','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*.exe' -ErrorAction SilentlyContinue | ForEach-Object { $p = $_.'(default)'; if ($p) { $apps += [PSCustomObject]@{ name = [System.IO.Path]::GetFileNameWithoutExtension($_.PSChildName); aumid = $null; exe = $p.Trim('\"') } } } } catch {}; $apps | ConvertTo-Json -Compress"`;
      const rawOut = await new Promise((resolve) => {
        exec(psCmd, { timeout: 6500, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
          resolve(err ? '' : String(stdout || '').trim());
        });
      });
      if (rawOut) {
        const parsed = JSON.parse(rawOut);
        const list = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
        for (const item of list) {
          const name = String(item.name || '').trim();
          if (!name) continue;
          const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
          if (!id) continue;
          const exePath = item.exe && fs.existsSync(item.exe) ? item.exe : null;
          const aumid = item.aumid || null;
          if (!this.cachedApps.has(id)) {
            this.cachedApps.set(id, {
              id,
              name,
              executable: exePath,
              aumid,
              aliases: [name.toLowerCase()],
              processNames: exePath ? [path.basename(exePath, '.exe')] : [name.replace(/\s+/g, '')],
              candidates: exePath ? [exePath] : [],
              source: exePath ? 'registry_app_paths' : 'start_apps_uwp'
            });
          } else {
            const existing = this.cachedApps.get(id);
            if (!existing.aumid && aumid) existing.aumid = aumid;
            if (exePath && !(existing.candidates || []).includes(exePath)) {
              existing.candidates = [...(existing.candidates || []), exePath];
            }
          }
        }
      }
    } catch (_) {}

    this.lastScanTime = now;
    return Array.from(this.cachedApps.values());
  }

  /**
   * Resolves an app query to a registered or discovered app record, supporting ambiguity detection
   */
  async resolveAppWithDisambiguation(query) {
    if (!query) return { status: 'NOT_FOUND', matches: [] };
    const qLower = String(query).toLowerCase().trim();
    const isInstalled = (app) => Boolean(
      app && (this.resolveExecutablePath(app) || (app.shortcutPath && fs.existsSync(app.shortcutPath)) || app.aumid || app.protocol)
    );

    // 1. Common genuine ambiguous category intents
    if (['office', 'document editor', 'word processor', 'docs app'].includes(qLower)) {
      const word = this.cachedApps.get('word');
      const wps = this.cachedApps.get('wps');
      const cands = [word, wps].filter(isInstalled);
      if (cands.length > 1) {
        return {
          status: 'AMBIGUOUS',
          matches: cands,
          clarificationQuestion: `Multiple document editors are installed (${cands.map(c => c.name).join(' and ')}). Which one would you like to open, sir?`
        };
      }
    }

    if (['browser', 'web browser'].includes(qLower)) {
      const cands = [this.cachedApps.get('chrome'), this.cachedApps.get('edge')].filter(isInstalled);
      if (cands.length > 1) {
        return {
          status: 'AMBIGUOUS',
          matches: cands,
          clarificationQuestion: `Multiple web browsers are installed (${cands.map(c => c.name).join(' and ')}). Which one would you like me to open, sir?`
        };
      }
    }

    await this.scanInstalledApps();

    // 2. Exact match on ID, name, or exact alias takes precedence
    for (const app of this.cachedApps.values()) {
      if (!isInstalled(app)) continue;
      if (app.id === qLower || app.name.toLowerCase() === qLower ||
          (app.aliases && app.aliases.some(a => a === qLower || `${a}.exe` === qLower))) {
        return { status: 'RESOLVED', app, matches: [app] };
      }
    }

    // 3. Collect all distinct installed apps matching substring/alias
    const matches = [];
    const seenIds = new Set();
    for (const app of this.cachedApps.values()) {
      if (!isInstalled(app)) continue;
      const nameLow = (app.name || '').toLowerCase();
      const aliasHit = app.aliases && app.aliases.some(a => a.includes(qLower) || (qLower.length >= 4 && qLower.includes(a)));
      if (nameLow.includes(qLower) || aliasHit) {
        if (!seenIds.has(app.id)) {
          seenIds.add(app.id);
          matches.push(app);
        }
      }
    }

    if (matches.length === 1) {
      return { status: 'RESOLVED', app: matches[0], matches };
    }
    if (matches.length > 1) {
      const shown = matches.slice(0, 5);
      return {
        status: 'AMBIGUOUS',
        matches: shown,
        clarificationQuestion: `Multiple installed applications match "${query}": ${shown.map(m => m.name).join(', ')}. Which one should I open, sir?`
      };
    }

    return { status: 'NOT_FOUND', matches: [] };
  }

  /**
   * Resolve an app query to registered or discovered app record
   */
  async resolveApp(query) {
    if (!query) return null;
    const qLower = String(query).toLowerCase().trim();

    // Check exact ID, name, or exact alias first
    for (const app of this.cachedApps.values()) {
      if (app.id === qLower || app.name.toLowerCase() === qLower) {
        return app;
      }
      if (app.aliases && app.aliases.some(a => a === qLower || `${a}.exe` === qLower)) {
        return app;
      }
    }

    // Check partial alias match in cached standard apps
    for (const app of this.cachedApps.values()) {
      if (app.aliases && app.aliases.some(a => qLower.includes(a) || a.includes(qLower))) {
        return app;
      }
    }

    // Refresh dynamic scan if not found
    await this.scanInstalledApps();
    for (const app of this.cachedApps.values()) {
      if (app.name.toLowerCase() === qLower || app.id === qLower.replace(/[^a-z0-9]+/g, '_')) {
        return app;
      }
    }
    for (const app of this.cachedApps.values()) {
      if (app.name.toLowerCase().includes(qLower) || (app.aliases && app.aliases.some(a => a.includes(qLower) || qLower.includes(a)))) {
        return app;
      }
    }

    return null;
  }

  /**
   * List currently active top-level windows
   */
  async listActiveWindows() {
    return new Promise((resolve) => {
      const psScript = `
        Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Trim().Length -gt 0 } | 
        Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | 
        ConvertTo-Json -Compress
      `;
      exec(`powershell -NoProfile -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { timeout: 4000 }, (err, stdout) => {
        if (err || !stdout.trim()) return resolve([]);
        try {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          resolve(list.map(p => ({
            pid: p.Id,
            processName: p.ProcessName,
            windowTitle: p.MainWindowTitle,
            handle: p.MainWindowHandle
          })));
        } catch (_) {
          resolve([]);
        }
      });
    });
  }

  /**
   * Focus and bring an existing window to the foreground
   */
  async focusWindow(queryOrPid) {
    return new Promise((resolve) => {
      const isPid = typeof queryOrPid === 'number' || /^\d+$/.test(String(queryOrPid));
      const filter = isPid 
        ? `$_.Id -eq ${queryOrPid}`
        : `$_.MainWindowTitle -like '*${String(queryOrPid).replace(/'/g, "''")}*' -or $_.ProcessName -like '*${String(queryOrPid).replace(/'/g, "''")}*'`;

      const ps = `powershell -NoProfile -Command "Add-Type -TypeDefinition '@using System; using System.Runtime.InteropServices; public class WinFocus { [DllImport(\\\"user32.dll\\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'; $p = Get-Process | Where-Object { ${filter} } | Select-Object -First 1; if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) { [WinFocus]::ShowWindow($p.MainWindowHandle, 9); [WinFocus]::SetForegroundWindow($p.MainWindowHandle); 'SUCCESS:' + $p.MainWindowTitle } else { 'NOT_FOUND' }"`;

      exec(ps, { timeout: 4000 }, (err, stdout) => {
        const out = String(stdout || '').trim();
        if (out.startsWith('SUCCESS:')) {
          const title = out.replace('SUCCESS:', '');
          resolve({ success: true, action: 'focus', title, summary: `Focused "${title}", sir.` });
        } else {
          resolve({ success: false, action: 'focus', summary: `Window matching "${queryOrPid}" could not be focused.` });
        }
      });
    });
  }

  /**
   * Launch application or reuse existing running window
   */
  async launchOrActivate(query, options = {}) {
    const { forceNew = false, args = [] } = options;
    const app = await this.resolveApp(query);
    const targetName = app ? app.name : query;

    // 1. Check if application is already running and has an active window
    if (!forceNew) {
      const activeWindows = await this.listActiveWindows();
      const match = activeWindows.find(w => {
        if (app && app.processNames) {
          if (app.processNames.some(p => p.toLowerCase() === w.processName.toLowerCase())) return true;
        }
        return w.windowTitle.toLowerCase().includes(query.toLowerCase()) ||
               w.processName.toLowerCase().includes(query.toLowerCase());
      });

      if (match) {
        const focusRes = await this.focusWindow(match.pid);
        return {
          success: true,
          reused: true,
          action: 'activated_existing',
          app: targetName,
          pid: match.pid,
          title: match.windowTitle,
          summary: `Reused active window for "${targetName}" (${match.windowTitle}).`
        };
      }
    }

    // 2. Launch new instance with empirical post-launch window/process verification
    const verifyLaunch = async (spawnedPid = null, timeoutMs = 4500) => {
      const deadline = Date.now() + timeoutMs;
      const procNames = (app && app.processNames ? app.processNames : [query]).map(p => String(p).toLowerCase().replace(/\.exe$/, ''));
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 300));
        const activeWindows = await this.listActiveWindows();
        const winMatch = activeWindows.find(w => {
          if (spawnedPid && Number(w.pid) === Number(spawnedPid)) return true;
          const pn = String(w.processName || '').toLowerCase();
          const wt = String(w.windowTitle || '').toLowerCase();
          return procNames.some(p => p && pn.includes(p)) || wt.includes(String(query || '').toLowerCase());
        });
        if (winMatch) {
          return { verified: true, pid: winMatch.pid, hwnd: winMatch.handle, title: winMatch.windowTitle };
        }
        if (spawnedPid) {
          try {
            const tl = execFileSync('tasklist', ['/FI', `PID eq ${spawnedPid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, timeout: 1500 });
            if (tl && tl.includes(String(spawnedPid))) {
              return { verified: true, pid: spawnedPid, hwnd: null, title: targetName };
            }
          } catch (_) {}
        }
      }
      return { verified: false, pid: spawnedPid, hwnd: null, title: null };
    };

    const runShellAsync = (cmd) => new Promise((resolve, reject) => {
      exec(cmd, { timeout: 6000 }, (err) => err ? reject(err) : resolve());
    });

    // Protocol launch
    if (app && app.protocol) {
      try {
        await runShellAsync(`start "" "${app.protocol}"`);
        const v = await verifyLaunch(null, 4000);
        if (v.verified) {
          return {
            success: true,
            verified: true,
            reused: false,
            action: 'launched_protocol',
            app: targetName,
            pid: v.pid,
            hwnd: v.hwnd,
            title: v.title,
            summary: `Launched and verified ${targetName} via system protocol (PID ${v.pid || 'active'}).`
          };
        }
      } catch (_) {
        // Fall through to executable
      }
    }

    // Shortcut launch
    if (app && app.shortcutPath && fs.existsSync(app.shortcutPath)) {
      try {
        await runShellAsync(`start "" "${app.shortcutPath}"`);
        const v = await verifyLaunch(null, 4500);
        if (v.verified) {
          return {
            success: true,
            verified: true,
            reused: false,
            action: 'launched_shortcut',
            app: targetName,
            pid: v.pid,
            hwnd: v.hwnd,
            title: v.title,
            summary: `Launched and verified ${targetName} via Start Menu shortcut (PID ${v.pid || 'active'}).`
          };
        }
      } catch (_) {}
    }

    // Executable launch
    let exePath = this.resolveExecutablePath(app);
    if (!exePath && app && app.executable) {
      exePath = app.executable;
    }

    if (exePath && (path.isAbsolute(exePath) ? fs.existsSync(exePath) : true)) {
      try {
        const child = spawn(exePath, args, { detached: true, stdio: 'ignore' });
        let spawnErr = null;
        child.once('error', (e) => { spawnErr = e; });
        child.unref();
        await new Promise(r => setTimeout(r, 120));
        if (spawnErr) throw spawnErr;

        const v = await verifyLaunch(child.pid, 5000);
        if (!v.verified) {
          return {
            success: false,
            verified: false,
            reused: false,
            action: 'spawn_unverified',
            app: targetName,
            path: exePath,
            pid: child.pid || null,
            error: `Started ${targetName} (${exePath}) but could not verify an active window or process.`,
            summary: `Dispatched ${targetName}, but no active window or process could be verified on Windows, sir.`
          };
        }
        return {
          success: true,
          verified: true,
          reused: false,
          action: 'spawned',
          app: targetName,
          path: exePath,
          pid: v.pid || child.pid,
          hwnd: v.hwnd,
          title: v.title,
          summary: `Launched and verified ${targetName} (${v.title || exePath}, PID ${v.pid || child.pid}).`
        };
      } catch (err) {
        throw new Error(`Failed to spawn ${targetName}: ${err.message}`);
      }
    }

    // Fallback: verify executable exists on Windows PATH via where.exe before spawning
    const safeToken = String(query || '').trim();
    if (/^[a-z0-9_.-]+$/i.test(safeToken)) {
      try {
        const resolved = execFileSync('where.exe', [safeToken], { encoding: 'utf8', windowsHide: true, timeout: 3000 })
          .split(/\r?\n/)
          .map(s => s.trim())
          .find(Boolean);
        if (resolved && fs.existsSync(resolved)) {
          const child = spawn(resolved, args, { detached: true, stdio: 'ignore' });
          let spawnErr = null;
          child.once('error', (e) => { spawnErr = e; });
          child.unref();
          await new Promise(r => setTimeout(r, 120));
          if (spawnErr) throw spawnErr;

          const v = await verifyLaunch(child.pid, 4500);
          if (!v.verified) {
            return {
              success: false,
              verified: false,
              reused: false,
              action: 'spawn_unverified',
              app: safeToken,
              path: resolved,
              pid: child.pid || null,
              error: `Started ${safeToken} from ${resolved} without verified active window/process.`
            };
          }
          return {
            success: true,
            verified: true,
            reused: false,
            action: 'spawned_path',
            app: safeToken,
            path: resolved,
            pid: v.pid || child.pid,
            hwnd: v.hwnd,
            title: v.title,
            summary: `Launched and verified ${safeToken} from ${resolved} (PID ${v.pid || child.pid}).`
          };
        }
      } catch (_) {}
    }

    throw new Error(`Application "${query}" is not recognized or installed.`);
  }

  /**
   * ShowWindow helper (6=minimize, 3=maximize, 9=restore)
   */
  async _showWindowCommand(query, nCmdShow, actionLabel) {
    if (!query) throw new Error('Window query is required.');
    const safeQ = String(query).replace(/'/g, "''");
    return new Promise((resolve) => {
      const ps = `powershell -NoProfile -Command "Add-Type -TypeDefinition '@using System; using System.Runtime.InteropServices; public class WinStateMgr { [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'; $p = Get-Process | Where-Object { ($_.MainWindowTitle -like '*${safeQ}*' -or $_.ProcessName -like '*${safeQ}*') -and $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1; if ($p) { [WinStateMgr]::ShowWindow($p.MainWindowHandle, ${nCmdShow}); 'SUCCESS:' + $p.MainWindowTitle } else { 'NOT_FOUND' }"`;
      exec(ps, { timeout: 4500 }, (err, stdout) => {
        const out = String(stdout || '').trim();
        if (!err && out.startsWith('SUCCESS:')) {
          const title = out.replace('SUCCESS:', '');
          return resolve({ success: true, verified: true, action: actionLabel, title, summary: `${actionLabel} "${title}", sir.` });
        }
        resolve({ success: false, verified: false, action: actionLabel, error: `No active window matching "${query}".`, summary: `Could not find active window matching "${query}" to ${actionLabel}.` });
      });
    });
  }

  async minimizeWindow(query) { return this._showWindowCommand(query, 6, 'minimized'); }
  async maximizeWindow(query) { return this._showWindowCommand(query, 3, 'maximized'); }
  async restoreWindow(query) { return this._showWindowCommand(query, 9, 'restored'); }
}

const windowsAppRegistryInstance = new WindowsAppRegistry();

module.exports = {
  WindowsAppRegistry,
  windowsAppRegistry: windowsAppRegistryInstance
};
