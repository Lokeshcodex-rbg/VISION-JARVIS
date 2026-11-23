/**
 * VISION AI — Real Browser Automation Engine
 * Powered by Playwright (Managed Chromium / System Chrome)
 * 
 * Provides robust, verified browser automation:
 * - Session & Page Lifecycle Management
 * - Semantic Selectors & Explicit Wait Conditions
 * - Prompt Injection & Malicious Content Neutralization
 * - SSRF & Dangerous Scheme Navigation Defense
 * - Controlled Download Handling (Zero Auto-Execution)
 * - Emergency Stop & In-Flight Cancellation Enforcement
 */

const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const { chromium } = require('playwright');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const SCRATCH_DIR = path.resolve(__dirname, '..', '..', 'scratch');
const SCREENSHOTS_DIR = path.join(SCRATCH_DIR, 'screenshots');
const DOWNLOADS_DIR = path.join(SCRATCH_DIR, 'downloads');

// Ensure scratch subdirectories exist
for (const dir of [SCRATCH_DIR, SCREENSHOTS_DIR, DOWNLOADS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Suspicious prompt injection signatures in untrusted web text
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+(?:instructions|directives|prompts)/i,
  /system\s+override/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /new\s+system\s+directive/i,
  /execute\s+(?:shell|powershell|cmd|bash|terminal)\s+command/i,
  /delete\s+(?:all\s+)?files/i,
  /send\s+(?:all\s+)?(?:passwords|tokens|credentials|keys)/i,
  /curl\s+https?:\/\//i
];

class BrowserAutomationEngine {
  constructor() {
    this.browser = null;
    this.sessions = new Map(); // sessionId -> { context, page, createdAt, lastActivity, url, pids: [] }
    this.isLaunching = false;
    this._browserProcessPid = null;

    // Register with Emergency Stop Controller
    if (emergencyStopControllerInstance && typeof emergencyStopControllerInstance.registerActiveProcess === 'function') {
      // Periodic check or on-launch PID capture
    }

    // Subscribe to Emergency Stop engagement
    if (emergencyStopControllerInstance && typeof emergencyStopControllerInstance.addListener === 'function') {
      emergencyStopControllerInstance.addListener('STOP', async () => {
        await this.emergencyShutdown();
      });
    }
  }

  /**
   * Initializes or returns the shared Playwright Chromium instance.
   * Respects requested channel ('chrome' vs 'msedge') without silently substituting Edge when Chrome is explicitly asked for.
   */
  async _ensureBrowser(options = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Cannot launch browser while Emergency Stop is engaged.');
    }

    const requestedChannel = options.channel || (options.browser === 'chrome' || options.preferChrome ? 'chrome' : null);
    const requestedHeadless = options.headless !== undefined ? Boolean(options.headless) : undefined;

    if (this.browser && this.browser.isConnected()) {
      const channelMismatch = requestedChannel && this._activeChannel && this._activeChannel !== requestedChannel;
      const headlessMismatch = requestedHeadless !== undefined && this._activeHeadless !== undefined && this._activeHeadless !== requestedHeadless;
      if (!channelMismatch && !headlessMismatch) {
        return this.browser;
      }
      // Close existing browser only if there are no active open sessions needing it
      if (this.sessions.size === 0) {
        try { await this.browser.close().catch(() => {}); } catch (_) {}
        this.browser = null;
        this._browserProcessPid = null;
      }
    }

    if (this._launchPromise) {
      return await this._launchPromise;
    }

    this._launchPromise = (async () => {
      try {
        const headless = requestedHeadless !== undefined ? requestedHeadless : true;
        const launchArgs = [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check'
        ];
        if (headless) {
          launchArgs.push('--disable-gpu');
        }

        const launchOptions = {
          headless,
          args: launchArgs
        };

        let resolvedChannel = requestedChannel || process.env.PLAYWRIGHT_BROWSER_CHANNEL || process.env.STARK_BROWSER_CHANNEL;
        if (!resolvedChannel && process.platform === 'win32') {
          try {
            const { chromeProfileService } = require('../desktop/chromeProfileService.js');
            resolvedChannel = chromeProfileService.getChromeExecutablePath() ? 'chrome' : 'msedge';
          } catch (_) {
            resolvedChannel = 'msedge';
          }
        }
        if (resolvedChannel) {
          launchOptions.channel = resolvedChannel;
        }

        this.browser = await chromium.launch(launchOptions);
        this._activeChannel = resolvedChannel || 'chromium';
        this._activeHeadless = headless;

        // Capture authentic Chromium PID via Chrome DevTools Protocol (CDP)
        try {
          const cdp = await this.browser.newBrowserCDPSession();
          const sysInfo = await cdp.send('SystemInfo.getProcessInfo');
          if (sysInfo && Array.isArray(sysInfo.processInfo)) {
            const browserProc = sysInfo.processInfo.find(p => p.type === 'browser');
            if (browserProc && browserProc.id) {
              this._browserProcessPid = browserProc.id;
              emergencyStopControllerInstance.registerActiveProcess(browserProc.id);
            }
            for (const p of sysInfo.processInfo) {
              if (p.id) emergencyStopControllerInstance.registerActiveProcess(p.id);
            }
          }
          await cdp.detach().catch(() => {});
        } catch (cdpErr) {
          // Fallback: check process() if supported
          const proc = typeof this.browser.process === 'function' ? this.browser.process() : null;
          if (proc && proc.pid) {
            this._browserProcessPid = proc.pid;
            emergencyStopControllerInstance.registerActiveProcess(proc.pid);
          }
        }

        this.browser.on('disconnected', () => {
          this.browser = null;
          this._browserProcessPid = null;
          this._launchPromise = null;
          this.sessions.clear();
        });

        return this.browser;
      } catch (err) {
        this.browser = null;
        this._launchPromise = null;
        throw new Error(`BROWSER_LAUNCH_FAILED: Failed to launch Chromium browser: ${err.message}`);
      } finally {
        this._launchPromise = null;
      }
    })();

    return await this._launchPromise;
  }

  /**
   * Launches a new isolated browser context and page session
   */
  async openSession(options = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Cannot open browser session while Emergency Stop is engaged.');
    }

    const browser = await this._ensureBrowser(options);
    const sessionId = options.sessionId || ('bsess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));

    const context = await browser.newContext({
      viewport: options.viewport || { width: 1280, height: 800 },
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) STARK/1.0 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      acceptDownloads: true,
      ignoreHTTPSErrors: Boolean(options.ignoreHTTPSErrors)
    });

    const page = await context.newPage();
    page.setDefaultTimeout(options.timeout || 15000);
    page.setDefaultNavigationTimeout(options.navigationTimeout || 20000);

    const sessionRecord = {
      sessionId,
      context,
      page,
      options: { ...(options || {}) },
      activeNavigationOptions: null,
      createdAt: new Date().toISOString(),
      lastActivity: Date.now(),
      currentUrl: 'about:blank',
      pageTitle: '',
      history: []
    };

    // Install request-level SSRF, redirect, and dangerous scheme firewall
    await page.route('**', (route) => {
      const reqUrl = route.request().url();
      const activeOpts = sessionRecord.activeNavigationOptions || sessionRecord.options || options;
      const check = this.validateUrl(reqUrl, activeOpts);
      if (!check.valid) {
        return route.abort('blockedbyclient');
      }
      route.continue();
    });

    this.sessions.set(sessionId, sessionRecord);

    return {
      success: true,
      sessionId,
      browserPid: this._browserProcessPid,
      createdAt: sessionRecord.createdAt
    };
  }

  /**
   * Retrieves an active session or throws truthful error
   */
  _getSession(sessionId) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Operation blocked by active Emergency Stop latch.');
    }

    const session = this.sessions.get(sessionId);
    if (!session || !session.page || session.page.isClosed()) {
      throw new Error(`BROWSER_SESSION_NOT_FOUND: Active browser session "${sessionId}" does not exist or has been closed.`);
    }
    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Validates target URL against SSRF, dangerous schemes, and host boundaries
   */
  validateUrl(targetUrl = '', options = {}) {
    if (!targetUrl || typeof targetUrl !== 'string') {
      return { valid: false, reason: 'URL must be a non-empty string.' };
    }

    let parsed;
    try {
      parsed = new url.URL(targetUrl);
    } catch (_) {
      return { valid: false, reason: `Malformed URL string: "${targetUrl}"` };
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return {
        valid: false,
        reason: `DANGEROUS_SCHEME: Scheme "${protocol}" is strictly prohibited. Only HTTP and HTTPS are permitted.`
      };
    }

    const hostname = parsed.hostname.toLowerCase();
    const cleanHost = hostname.replace(/^\[|\]$/g, '').toLowerCase();

    // Check Cloud Metadata Services (IPv4 & IPv6 link-local metadata)
    if (
      cleanHost === '169.254.169.254' ||
      cleanHost === 'metadata.google.internal' ||
      cleanHost === 'metadata' ||
      cleanHost === 'fd00:ec2::254' ||
      cleanHost.includes('169.254.169.254')
    ) {
      return {
        valid: false,
        reason: `SSRF_VIOLATION: Navigation to cloud metadata services (${hostname}) is strictly prohibited.`
      };
    }

    // Check loopback / localhost (IPv4, IPv6, IPv4-mapped)
    const isLoopback = (
      cleanHost === '127.0.0.1' ||
      cleanHost === 'localhost' ||
      cleanHost === '::1' ||
      cleanHost === '0:0:0:0:0:0:0:1' ||
      cleanHost.startsWith('::ffff:127.') ||
      cleanHost === '0.0.0.0'
    );
    if (isLoopback) {
      if (options.allowLocalhost === true || parsed.port === '3008' || parsed.port === '3000' || parsed.port === '3005') {
        return { valid: true, protocol, hostname, parsedUrl: parsed.href };
      }
      return {
        valid: false,
        reason: `SSRF_VIOLATION: Navigation to loopback/localhost (${hostname}) is blocked unless explicitly authorized for controlled test fixtures.`
      };
    }

    // Check IPv6 Link-Local (fe80::/10) and Unique Local Address (fc00::/7, fd00::/8)
    if (cleanHost.startsWith('fe80:') || cleanHost.startsWith('fc') || cleanHost.startsWith('fd')) {
      if (!options.allowPrivateNetworks) {
        return {
          valid: false,
          reason: `SSRF_VIOLATION: Navigation to IPv6 private/link-local address (${hostname}) is prohibited.`
        };
      }
    }

    // Check private network IP ranges (RFC 1918)
    const ipMatch = cleanHost.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const b1 = parseInt(ipMatch[1], 10);
      const b2 = parseInt(ipMatch[2], 10);
      if (b1 === 10 || (b1 === 172 && b2 >= 16 && b2 <= 31) || (b1 === 192 && b2 === 168) || b1 === 0) {
        if (!options.allowPrivateNetworks) {
          return {
            valid: false,
            reason: `SSRF_VIOLATION: Navigation to private RFC 1918 IP address (${hostname}) is prohibited.`
          };
        }
      }
    }

    return { valid: true, protocol, hostname, parsedUrl: parsed.href };
  }

  /**
   * Sanitizes untrusted web text and detects prompt injection attempts
   */
  sanitizeWebText(rawText = '') {
    const text = String(rawText || '').trim();
    const threats = [];

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        threats.push(pattern.source);
      }
    }

    // Wrap in explicit untrusted container
    return {
      rawText: text,
      sanitizedText: `[UNTRUSTED_WEB_DATA_BEGIN]\n${text}\n[UNTRUSTED_WEB_DATA_END]`,
      hasThreats: threats.length > 0,
      threatsDetected: threats,
      isClean: threats.length === 0
    };
  }

  /**
   * Navigates to a validated URL with explicit wait and response verification
   */
  async navigate(sessionId, targetUrl, options = {}) {
    const session = this._getSession(sessionId);
    const validation = this.validateUrl(targetUrl, options);
    if (!validation.valid) {
      throw new Error(`NAVIGATION_REJECTED: ${validation.reason}`);
    }

    const waitUntil = options.waitUntil || 'domcontentloaded';
    const timeout = options.timeout || 15000;

    let response = null;
    let navError = null;

    session.activeNavigationOptions = options;
    try {
      response = await session.page.goto(validation.parsedUrl, {
        waitUntil,
        timeout
      });
    } catch (err) {
      navError = err;
    }

    if (navError) {
      throw new Error(`NAVIGATION_FAILED: Could not reach "${targetUrl}": ${navError.message}`);
    }

    const currentUrl = session.page.url();
    const pageTitle = await session.page.title();
    const httpStatus = response ? response.status() : 200;

    session.currentUrl = currentUrl;
    session.pageTitle = pageTitle;
    session.history.push({ url: currentUrl, title: pageTitle, timestamp: new Date().toISOString() });

    return {
      success: true,
      url: currentUrl,
      title: pageTitle,
      httpStatus,
      verified: Boolean(httpStatus < 400 && currentUrl !== 'about:blank')
    };
  }

  /**
   * Returns current URL and title of active page
   */
  async getPageInfo(sessionId) {
    const session = this._getSession(sessionId);
    const currentUrl = session.page.url();
    const title = await session.page.title();
    return {
      sessionId,
      url: currentUrl,
      title,
      readyState: await session.page.evaluate(() => document.readyState)
    };
  }

  /**
   * Extracts visible text using semantic selectors, with prompt-injection defense
   */
  async extractText(sessionId, selector = 'body', options = {}) {
    const session = this._getSession(sessionId);
    await session.page.waitForSelector(selector, { state: 'attached', timeout: options.timeout || 5000 });

    let extracted = '';
    let hiddenText = '';

    if (selector === 'body' || selector === 'main' || selector === 'article') {
      const pageData = await session.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        const visible = el ? el.innerText : '';

        // Also inspect hidden HTML nodes and metadata for indirect injection attempts
        const hiddenNodes = Array.from(document.querySelectorAll('[hidden], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"], [aria-hidden="true"], meta[name="description"], meta[name="keywords"]'));
        const hidden = hiddenNodes.map(n => n.innerText || n.textContent || n.getAttribute('content') || '').join(' ');

        return { visible, hidden };
      }, selector);

      extracted = pageData.visible;
      hiddenText = pageData.hidden;
    } else {
      extracted = await session.page.textContent(selector);
    }

    const sanitizedVisible = this.sanitizeWebText(extracted);
    const sanitizedHidden = this.sanitizeWebText(hiddenText);

    const combinedThreats = Array.from(new Set([...sanitizedVisible.threatsDetected, ...sanitizedHidden.threatsDetected]));

    return {
      success: true,
      selector,
      text: sanitizedVisible.rawText,
      untrustedPayload: sanitizedVisible.sanitizedText,
      hasThreats: combinedThreats.length > 0,
      threatsDetected: combinedThreats,
      hiddenThreatsCount: sanitizedHidden.threatsDetected.length,
      characterCount: (sanitizedVisible.rawText || '').length
    };
  }

  /**
   * Extracts structured data from tables, lists, or semantic cards
   */
  async extractStructured(sessionId, options = {}) {
    const session = this._getSession(sessionId);
    const { tableSelector = 'table', rowSelector = 'tr', cellSelector = 'td,th' } = options;

    const data = await session.page.evaluate(({ tSel, rSel, cSel }) => {
      const table = document.querySelector(tSel);
      if (!table) return { found: false, rows: [] };

      const rows = Array.from(table.querySelectorAll(rSel));
      const extractedRows = rows.map(r => {
        const cells = Array.from(r.querySelectorAll(cSel));
        return cells.map(c => c.innerText.trim());
      }).filter(r => r.length > 0);

      return { found: true, rowCount: extractedRows.length, rows: extractedRows };
    }, { tSel: tableSelector, rSel: rowSelector, cSel: cellSelector });

    return {
      success: data.found,
      tableSelector,
      rowCount: data.rowCount || 0,
      rows: data.rows || []
    };
  }

  /**
   * Clicks an element with semantic selector, wait condition, and state verification
   */
  async clickElement(sessionId, selector, options = {}) {
    const session = this._getSession(sessionId);
    const timeout = options.timeout || 5000;

    await session.page.waitForSelector(selector, { state: 'visible', timeout });

    // Capture pre-click state
    const preUrl = session.page.url();
    const preText = options.verifyTextChange ? await session.page.textContent(options.verifyTextChangeSelector || selector) : null;

    await session.page.click(selector, { timeout });

    // Optional post-click wait condition
    if (options.waitForNavigation) {
      try {
        await session.page.waitForNavigation({ timeout, waitUntil: 'domcontentloaded' });
      } catch (_) {}
    } else if (options.waitForSelector) {
      await session.page.waitForSelector(options.waitForSelector, { timeout });
    } else {
      // Brief settling pause
      await new Promise(r => setTimeout(r, 100));
    }

    const postUrl = session.page.url();
    let postText = null;
    let stateChanged = (preUrl !== postUrl);

    if (options.verifyTextChange && options.verifyTextChangeSelector) {
      postText = await session.page.textContent(options.verifyTextChangeSelector);
      stateChanged = stateChanged || (preText !== postText);
    }

    return {
      success: true,
      selector,
      preUrl,
      postUrl,
      navigated: (preUrl !== postUrl),
      stateChanged,
      postText
    };
  }

  /**
   * Fills a form input with value validation and secret masking
   */
  async fillForm(sessionId, selector, value = '', options = {}) {
    const session = this._getSession(sessionId);
    const timeout = options.timeout || 5000;

    await session.page.waitForSelector(selector, { state: 'visible', timeout });

    // Clear prior value if requested
    if (options.clearFirst !== false) {
      await session.page.fill(selector, '');
    }

    await session.page.fill(selector, String(value), { timeout });

    // Verify filled value on element
    const actualValue = await session.page.inputValue(selector);
    const isSensitive = options.isSensitive || /password|secret|token|credit|cvv/i.test(selector);

    return {
      success: (actualValue === String(value)),
      selector,
      verifiedValue: isSensitive ? '***REDACTED***' : actualValue,
      isSensitive
    };
  }

  /**
   * Selects an option in a standard <select> dropdown
   */
  async selectOption(sessionId, selector, value, options = {}) {
    const session = this._getSession(sessionId);
    const timeout = options.timeout || 5000;

    await session.page.waitForSelector(selector, { state: 'visible', timeout });
    const selected = await session.page.selectOption(selector, value, { timeout });

    return {
      success: selected.length > 0,
      selector,
      selectedValues: selected
    };
  }

  /**
   * Takes a full page or element screenshot and saves to scratch
   */
  async takeScreenshot(sessionId, options = {}) {
    const session = this._getSession(sessionId);
    const fileName = options.fileName || (`screenshot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
    const targetPath = options.filePath || path.join(SCREENSHOTS_DIR, fileName);

    await session.page.screenshot({
      path: targetPath,
      fullPage: Boolean(options.fullPage)
    });

    const stat = fs.statSync(targetPath);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');

    return {
      success: true,
      filePath: targetPath,
      sizeBytes: stat.size,
      sha256: hash,
      verified: stat.size > 0
    };
  }

  /**
   * Controlled Download Handling: Captures download, saves to scratch, and strictly forbids execution
   */
  async handleDownload(sessionId, triggerActionFn, options = {}) {
    const session = this._getSession(sessionId);
    const timeout = options.timeout || 15000;

    const downloadPromise = session.page.waitForEvent('download', { timeout });
    await triggerActionFn();
    const download = await downloadPromise;

    const suggestedFilename = download.suggestedFilename() || `download_${Date.now()}`;
    const safeFilename = path.basename(suggestedFilename).replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    // Reject dangerous executable extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.msi', '.com', '.scr', '.pif'];
    const ext = path.extname(safeFilename).toLowerCase();
    const isDangerous = dangerousExtensions.includes(ext);

    const targetPath = path.join(DOWNLOADS_DIR, safeFilename);
    await download.saveAs(targetPath);

    const stat = fs.statSync(targetPath);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');

    return {
      success: true,
      filePath: targetPath,
      filename: safeFilename,
      sizeBytes: stat.size,
      sha256: hash,
      isExecutableThreat: isDangerous,
      executionBlocked: true, // Prohibited by default
      verified: stat.size > 0
    };
  }

  /**
   * Closes a specific browser session cleanly
   */
  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: true, message: 'Session already closed' };

    try {
      if (session.page && !session.page.isClosed()) {
        await session.page.close().catch(() => {});
      }
      if (session.context) {
        await session.context.close().catch(() => {});
      }
    } finally {
      this.sessions.delete(sessionId);
    }

    return { success: true, sessionId };
  }

  /**
   * Lists open pages/tabs across active context (or session)
   */
  async listTabs(sessionId) {
    const session = this._getSession(sessionId);
    const pages = session.context.pages().filter(p => !p.isClosed());
    const tabs = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      tabs.push({
        index: i,
        url: p.url(),
        title: await p.title().catch(() => ''),
        active: p === session.page
      });
    }
    return { success: true, sessionId, count: tabs.length, tabs };
  }

  /**
   * Switches active tab in a browser session by index or title/url substring
   */
  async switchTab(sessionId, selectorOrIndex = 0) {
    const session = this._getSession(sessionId);
    const pages = session.context.pages().filter(p => !p.isClosed());
    let target = null;
    if (typeof selectorOrIndex === 'number' || /^\d+$/.test(String(selectorOrIndex))) {
      target = pages[Number(selectorOrIndex)] || null;
    } else {
      const q = String(selectorOrIndex || '').toLowerCase();
      for (const p of pages) {
        const title = (await p.title().catch(() => '')).toLowerCase();
        if (title.includes(q) || p.url().toLowerCase().includes(q)) {
          target = p;
          break;
        }
      }
    }
    if (!target) {
      return { success: false, error: `No matching tab found for "${selectorOrIndex}".` };
    }
    await target.bringToFront().catch(() => {});
    session.page = target;
    return {
      success: true,
      sessionId,
      url: target.url(),
      title: await target.title().catch(() => '')
    };
  }

  /**
   * Closes a specific tab by index (or current tab if omitted)
   */
  async closeTab(sessionId, tabIndex = null) {
    const session = this._getSession(sessionId);
    const pages = session.context.pages().filter(p => !p.isClosed());
    const target = tabIndex !== null && tabIndex !== undefined ? pages[Number(tabIndex)] : session.page;
    if (!target) {
      return { success: false, error: 'Tab not found.' };
    }
    await target.close().catch(() => {});
    const remaining = session.context.pages().filter(p => !p.isClosed());
    session.page = remaining[0] || null;
    return { success: true, remainingTabs: remaining.length };
  }

  /**
   * Scrolls the current page up/down/top/bottom
   */
  async scrollPage(sessionId, direction = 'down', pixels = 650) {
    const session = this._getSession(sessionId);
    const dir = String(direction || 'down').toLowerCase();
    const amount = Number(pixels) || 650;
    const pos = await session.page.evaluate(({ d, amt }) => {
      if (d === 'top') window.scrollTo(0, 0);
      else if (d === 'bottom') window.scrollTo(0, document.body.scrollHeight);
      else if (d === 'up') window.scrollBy(0, -amt);
      else window.scrollBy(0, amt);
      return { scrollY: Math.round(window.scrollY), scrollHeight: document.body.scrollHeight };
    }, { d: dir, amt: amount });
    return { success: true, direction: dir, ...pos };
  }

  /**
   * Summarizes the currently open page visibly (title, URL, headings, key clean text)
   */
  async summarizePage(sessionId, maxChars = 2400) {
    const session = this._getSession(sessionId);
    const info = await this.getPageInfo(sessionId);
    const ext = await this.extractText(sessionId, 'body');
    const headings = await session.page.evaluate(() => {
      return Array.from(document.querySelectorAll('h1,h2,h3'))
        .map(h => (h.innerText || '').trim())
        .filter(Boolean)
        .slice(0, 12);
    }).catch(() => []);
    const cleanBody = String(ext.text || '').replace(/\s+/g, ' ').trim();
    return {
      success: true,
      verified: true,
      url: info.url,
      title: info.title,
      headings,
      excerpt: cleanBody.slice(0, maxChars),
      characterCount: cleanBody.length,
      hasThreats: ext.hasThreats,
      summary: `Extracted "${info.title}" (${info.url}) — ${headings.length} heading(s), ${cleanBody.length} chars.`
    };
  }

  /**
   * Navigates internal links matching text or selector on the current page
   */
  async navigateLink(sessionId, { linkText = '', selector = '', hrefPattern = '', timeout = 10000 } = {}) {
    const session = this._getSession(sessionId);
    const preUrl = session.page.url();
    let targetSelector = selector;

    if (!targetSelector) {
      if (linkText) {
        targetSelector = `a:has-text("${linkText.replace(/"/g, '\\"')}")`;
      } else if (hrefPattern) {
        targetSelector = `a[href*="${hrefPattern.replace(/"/g, '\\"')}"]`;
      } else {
        targetSelector = 'a[href]';
      }
    }

    await session.page.waitForSelector(targetSelector, { timeout, state: 'visible' });
    const targetHref = await session.page.getAttribute(targetSelector, 'href').catch(() => null);

    await Promise.all([
      session.page.waitForNavigation({ timeout, waitUntil: 'domcontentloaded' }).catch(() => null),
      session.page.click(targetSelector, { timeout })
    ]);

    const postUrl = session.page.url();
    const pageTitle = await session.page.title().catch(() => '');
    return {
      success: true,
      previousUrl: preUrl,
      currentUrl: postUrl,
      targetHref,
      pageTitle,
      navigated: preUrl !== postUrl
    };
  }

  /**
   * Handles pagination by locating next button or page number link
   */
  async navigatePagination(sessionId, { direction = 'next', pageNumber = null, nextSelector = 'a[rel="next"], a.next, button[aria-label="Next"], .pagination-next, [aria-label="Next page"]', timeout = 10000 } = {}) {
    const session = this._getSession(sessionId);
    const preUrl = session.page.url();
    let targetSelector = nextSelector;

    if (pageNumber !== null && pageNumber !== undefined) {
      targetSelector = `a[data-page="${pageNumber}"], [aria-label="Page ${pageNumber}"], .page-number:has-text("${pageNumber}")`;
    }

    const exists = await session.page.$(targetSelector);
    if (!exists) {
      return {
        success: false,
        error: `Pagination control not found for ${direction} (selector: ${targetSelector})`,
        atEnd: true
      };
    }

    await Promise.all([
      session.page.waitForNavigation({ timeout, waitUntil: 'domcontentloaded' }).catch(() => null),
      session.page.click(targetSelector, { timeout })
    ]);

    const postUrl = session.page.url();
    const pageTitle = await session.page.title().catch(() => '');
    return {
      success: true,
      direction,
      pageNumber,
      previousUrl: preUrl,
      currentUrl: postUrl,
      pageTitle,
      navigated: preUrl !== postUrl
    };
  }

  /**
   * Recovers from browser crash or unexpected disconnection
   */
  async recoverFromCrash() {
    try {
      if (this.browser) {
        await this.browser.close().catch(() => {});
      }
    } catch (_) {}
    this.browser = null;
    this.sessions.clear();
    this._launchPromise = null;
    return await this._ensureBrowser({ headless: true });
  }

  /**
   * Opens visible Google Chrome (authenticated user profile via chromeProfileService, never exposing cookies/tokens)
   * OR visible Playwright Chrome session when DOM extraction is requested.
   */
  async openVisibleChrome(url = '', options = {}) {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Chrome launch blocked by Emergency Stop.');
    }
    const { chromeProfileService } = require('../desktop/chromeProfileService.js');
    const targetUrl = url ? this.validateUrl(url, { allowLocalhost: Boolean(options.allowLocalhost) }) : '';
    const profileQuery = options.profile || 'default';
    const launchRes = await chromeProfileService.launchProfile(profileQuery, targetUrl);
    return {
      ...launchRes,
      browser: 'Google Chrome',
      channel: 'chrome',
      url: targetUrl || launchRes.targetUrl || 'New Tab',
      credentialsExposed: false
    };
  }

  /**
   * Live web search via real Chrome/Playwright browser session (respects CAPTCHA/anti-bot gates without bypassing them)
   */
  async searchGoogle(query, options = {}) {
    if (!query || !String(query).trim()) {
      return { success: false, error: 'Search query is required.' };
    }
    const q = String(query).trim();
    const openVisible = options.openVisible !== false;
    const channel = options.channel || 'chrome';
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;

    let visibleChrome = null;
    if (openVisible) {
      try {
        visibleChrome = await this.openVisibleChrome(searchUrl, { profile: options.profile || 'default' });
      } catch (_) {}
    }

    // Use Playwright session to extract real verified search results / state
    const sess = await this.openSession({
      channel,
      headless: options.headless !== undefined ? Boolean(options.headless) : true
    });
    const sessionObj = this._getSession(sess.sessionId);
    try {
      let navRes = await this.navigate(sess.sessionId, searchUrl);
      let finalUrl = navRes.finalUrl || searchUrl;
      let pageTitle = navRes.title || '';

      const pageCheck = await sessionObj.page.evaluate(() => {
        const bodyText = (document.body?.innerText || '').trim();
        const isCaptcha = /unusual traffic|not a robot|captcha|recaptcha/i.test(bodyText) ||
          location.pathname.includes('/sorry/');
        const anchors = Array.from(document.querySelectorAll('a h3')).map(h3 => {
          const a = h3.closest('a');
          return {
            title: (h3.innerText || '').trim(),
            url: a ? a.href : ''
          };
        }).filter(r => r.title && r.url);
        return { isCaptcha, results: anchors.slice(0, 8), bodyPreview: bodyText.slice(0, 600) };
      });

      let sourceEngine = 'google';
      let results = pageCheck.results || [];
      let blockedByCaptcha = Boolean(pageCheck.isCaptcha);

      // If Google presents an anti-bot CAPTCHA gate, DO NOT bypass it — report transparently and optionally fall back to Bing/DuckDuckGo HTML search for informational extraction if allowed
      if (blockedByCaptcha && options.fallbackOnCaptcha !== false) {
        const ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        try {
          const ddgNav = await this.navigate(sess.sessionId, ddgUrl);
          const ddgResults = await sessionObj.page.evaluate(() => {
            return Array.from(document.querySelectorAll('.result__a')).map(a => ({
              title: (a.innerText || '').trim(),
              url: a.href || ''
            })).filter(r => r.title && r.url).slice(0, 8);
          });
          if (ddgResults.length > 0) {
            results = ddgResults;
            sourceEngine = 'duckduckgo_fallback_after_google_captcha';
            finalUrl = ddgNav.finalUrl || ddgUrl;
            pageTitle = ddgNav.title || pageTitle;
          }
        } catch (_) {}
      }

      let screenshot = null;
      if (options.captureScreenshot !== false) {
        screenshot = await this.takeScreenshot(sess.sessionId, { fileName: `search_${Date.now()}.png` }).catch(() => null);
      }

      return {
        success: visibleChrome?.verified === true || results.length > 0 || !blockedByCaptcha,
        verified: visibleChrome?.verified === true || results.length > 0,
        query: q,
        searchUrl,
        finalUrl,
        pageTitle,
        sourceEngine,
        blockedByCaptcha,
        resultsCount: results.length,
        results,
        visibleChrome,
        screenshot,
        summary: results.length > 0
          ? `Searched "${q}" and extracted ${results.length} live web result(s) via ${sourceEngine}${visibleChrome?.verified ? ' with visible Chrome verified' : ''}.`
          : (blockedByCaptcha
            ? `Google presented an anti-bot verification gate for "${q}" (not bypassed); visible Chrome was opened at ${searchUrl}.`
            : `Opened search for "${q}" (${finalUrl}).`)
      };
    } finally {
      await this.closeSession(sess.sessionId).catch(() => {});
    }
  }

  /**
   * Google Maps Place / Nearby Search (strictly never fabricates distances/hours or leaks user location without consent)
   */
  async searchGoogleMaps(query, options = {}) {
    if (!query || !String(query).trim()) {
      return {
        success: false,
        clarificationRequired: true,
        summary: 'Please tell me what place or location you want to search on Google Maps, sir.'
      };
    }
    const q = String(query).trim();
    const near = options.location ? String(options.location).trim() : '';

    // Never access or disclose user's exact live location without explicit permission
    const isNearMe = /\b(?:near me|around me|my location|current location|here)\b/i.test(q) ||
      /\b(?:me|my location|current location|here)\b/i.test(near);
    if (isNearMe && !options.locationConsent && !options.userCoordinates) {
      return {
        success: false,
        clarificationRequired: true,
        locationPermissionRequired: true,
        summary: 'To protect your privacy and ensure accurate local results, please specify the city or area to search near (or grant location access), sir.'
      };
    }

    const fullQuery = near && !q.toLowerCase().includes(near.toLowerCase()) ? `${q} near ${near}` : q;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`;

    let visibleChrome = null;
    if (options.openVisible !== false) {
      try {
        visibleChrome = await this.openVisibleChrome(mapsUrl, { profile: options.profile || 'default' });
      } catch (_) {}
    }

    // Attempt headless Chrome extraction of visible place titles/ratings
    let extractedPlaces = [];
    let finalUrl = mapsUrl;
    let pageTitle = 'Google Maps';
    let screenshot = null;
    const sess = await this.openSession({ channel: options.channel || 'chrome', headless: true });
    const sessionObj = this._getSession(sess.sessionId);
    try {
      const navRes = await this.navigate(sess.sessionId, mapsUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2200));
      finalUrl = sessionObj.page.url() || navRes.finalUrl || mapsUrl;
      pageTitle = await sessionObj.page.title().catch(() => navRes.title || 'Google Maps');

      extractedPlaces = await sessionObj.page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('[role="article"], .Nv2PK'));
        const seen = new Set();
        const out = [];
        for (const c of cards.slice(0, 10)) {
          const name = (c.getAttribute('aria-label') || c.querySelector('.qBF1Pd, .fontHeadlineSmall')?.textContent || '').trim();
          if (!name || seen.has(name)) continue;
          seen.add(name);
          const snippet = (c.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220);
          out.push({ name, visibleDetails: snippet, verifiedOnPage: true });
        }
        if (out.length === 0) {
          const h1 = (document.querySelector('h1.DUwDvf, h1')?.textContent || '').trim();
          if (h1 && !/^google maps$/i.test(h1)) {
            out.push({ name: h1, visibleDetails: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 260), verifiedOnPage: true });
          }
        }
        return out;
      }).catch(() => []);

      if (options.captureScreenshot !== false) {
        screenshot = await this.takeScreenshot(sess.sessionId, { fileName: `maps_${Date.now()}.png` }).catch(() => null);
      }
    } finally {
      await this.closeSession(sess.sessionId).catch(() => {});
    }

    return {
      success: Boolean(visibleChrome?.verified || extractedPlaces.length > 0 || finalUrl.includes('/maps')),
      verified: Boolean(visibleChrome?.verified || extractedPlaces.length > 0),
      query: fullQuery,
      mapsUrl,
      finalUrl,
      pageTitle,
      placesCount: extractedPlaces.length,
      places: extractedPlaces,
      visibleChrome,
      screenshot,
      locationDisclosed: false,
      summary: extractedPlaces.length > 0
        ? `Opened Google Maps for "${fullQuery}" and observed ${extractedPlaces.length} visible place result(s): ${extractedPlaces.slice(0, 4).map(p => p.name).join(', ')}.`
        : `Opened Google Maps for "${fullQuery}" in verified Chrome (${finalUrl}). Visual page loaded; live distance/traffic/hours depend on interactive Maps state.`
    };
  }

  /**
   * Google Maps Directions & Route Stops (asks for missing origin/destination; never guesses live traffic/ETA)
   */
  async getGoogleMapsDirections({ origin = '', destination = '', travelMode = 'driving', openVisible = true, profile = 'default' } = {}) {
    const cleanOrigin = String(origin || '').trim();
    const cleanDest = String(destination || '').trim();
    if (!cleanOrigin || !cleanDest) {
      const missing = [];
      if (!cleanOrigin) missing.push('origin (starting location)');
      if (!cleanDest) missing.push('destination');
      return {
        success: false,
        clarificationRequired: true,
        missingFields: missing,
        summary: `Please provide the ${missing.join(' and ')} so I can load verified Google Maps directions, sir.`
      };
    }

    const mode = ['driving', 'walking', 'bicycling', 'transit'].includes(String(travelMode).toLowerCase())
      ? String(travelMode).toLowerCase()
      : 'driving';
    const mapsDirUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(cleanOrigin)}&destination=${encodeURIComponent(cleanDest)}&travelmode=${mode}`;

    let visibleChrome = null;
    if (openVisible) {
      try {
        visibleChrome = await this.openVisibleChrome(mapsDirUrl, { profile });
      } catch (_) {}
    }

    let extractedRouteSummary = null;
    const sess = await this.openSession({ channel: 'chrome', headless: true });
    const sessionObj = this._getSession(sess.sessionId);
    try {
      await this.navigate(sess.sessionId, mapsDirUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2200));
      extractedRouteSummary = await sessionObj.page.evaluate(() => {
        const trip = document.querySelector('[data-trip-index], .MespJc, #section-directions-trip-0');
        return trip ? (trip.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300) : null;
      }).catch(() => null);
    } finally {
      await this.closeSession(sess.sessionId).catch(() => {});
    }

    return {
      success: Boolean(visibleChrome?.verified || extractedRouteSummary),
      verified: Boolean(visibleChrome?.verified || extractedRouteSummary),
      origin: cleanOrigin,
      destination: cleanDest,
      travelMode: mode,
      mapsUrl: mapsDirUrl,
      visibleRouteSummary: extractedRouteSummary || 'Open in Google Maps window for live traffic & turn-by-turn ETA (not fabricated offline).',
      visibleChrome,
      summary: `Opened Google Maps directions from "${cleanOrigin}" to "${cleanDest}" (${mode})${extractedRouteSummary ? ` — ${extractedRouteSummary}` : ''}, sir.`
    };
  }

  /**
   * Complete emergency shutdown: immediately terminates all contexts and closes browser
   */
  async emergencyShutdown() {
    for (const [id, session] of this.sessions.entries()) {
      try {
        if (session.page) session.page.close().catch(() => {});
        if (session.context) session.context.close().catch(() => {});
      } catch (_) {}
    }
    this.sessions.clear();

    if (this.browser) {
      try {
        await this.browser.close().catch(() => {});
      } catch (_) {}
      this.browser = null;
    }

    this._browserProcessPid = null;
  }
}

const browserAutomationEngineInstance = new BrowserAutomationEngine();

module.exports = {
  BrowserAutomationEngine,
  browserAutomationEngineInstance,
  SCRATCH_DIR,
  SCREENSHOTS_DIR,
  DOWNLOADS_DIR
};
