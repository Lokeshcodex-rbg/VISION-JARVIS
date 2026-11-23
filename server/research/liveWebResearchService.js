/**
 * VISION AI / JARVIS — Persistent Live Internet & Multi-Provider Web Intelligence Service
 *
 * Unified live web connectivity, multi-provider search, webpage & PDF extraction,
 * link investigation, source cross-checking, disconnect/recovery monitoring,
 * quota/auth circuit breaking, and strict prompt-injection + SSRF defense.
 *
 * Reuses existing infrastructure without duplication:
 *  - apiIntegrationsManagerInstance (credentials, rate limits, health & quota telemetry)
 *  - browserAutomationEngineInstance (Playwright rendering fallback & SSRF validation)
 *  - documentIntelligenceEngineInstance (online PDF parsing in quarantine)
 *  - sourceEvaluatorInstance (credibility, freshness & contradiction detection)
 *  - weatherServiceInstance (live meteorological retrieval)
 *  - securityPermissionsInstance (untrusted content sanitization)
 *  - emergencyStopControllerInstance (immediate kill switch compliance)
 */

const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const crypto = require('crypto');

const { errorDiagnostics } = require('../errorDiagnosticsService.js');
const { securityPermissionsInstance } = require('../securityPermissions.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
const { apiIntegrationsManagerInstance } = require('../apiIntegrationsManager.js');
const { browserAutomationEngineInstance, DOWNLOADS_DIR } = require('../browser/browserAutomationEngine.js');
const { documentIntelligenceEngineInstance } = require('../documentIntelligenceEngine.js');
const { sourceEvaluatorInstance } = require('./sourceEvaluator.js');
const { weatherServiceInstance } = require('../weatherService.js');

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VISION-JARVIS/2.0 (WebIntelligence)',
  'Accept-Language': 'en-US,en;q=0.9'
};

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB HTML guard
const MAX_PDF_BYTES = 8 * 1024 * 1024;  // 8 MB PDF guard

function decodeHtmlEntities(str = '') {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function stripTags(html = '') {
  return decodeHtmlEntities(
    String(html)
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function sanitizeUntrusted(text = '') {
  const step1 = securityPermissionsInstance.sanitizeUntrustedContent(String(text || ''));
  const step2 = browserAutomationEngineInstance.sanitizeWebText(step1);
  return {
    cleanText: step2.rawText,
    untrustedPayload: step2.sanitizedText,
    hasThreats: step2.hasThreats,
    threatsDetected: step2.threatsDetected
  };
}

function normalizeDomain(rawUrl = '') {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return 'unknown';
  }
}

class LiveWebResearchService {
  constructor(options = {}) {
    this.cache = new Map();
    this.cacheTtlMs = options.cacheTtlMs || 10 * 60 * 1000; // 10 minutes
    this.robotsCache = new Map();
    this.robotsTtlMs = 15 * 60 * 1000;
    this._fetch = options.fetchImpl || ((...args) => globalThis.fetch(...args));
    this._dnsLookup = options.dnsLookup || ((host) => dns.lookup(host));
    this._monitorTimer = null;
    this._authorizedMonitors = new Map();

    this.state = {
      initializedAt: null,
      internetConnected: null, // unknown until first probe completes
      browserAvailable: false,
      webSearchAvailable: false,
      lastOnlineAt: null,
      lastOfflineAt: null,
      lastHealthCheckAt: null,
      disconnectCount: 0,
      reconnectCount: 0,
      activeResearchCount: 0,
      lastError: null
    };

    if (emergencyStopControllerInstance && typeof emergencyStopControllerInstance.addListener === 'function') {
      emergencyStopControllerInstance.addListener('STOP', () => {
        this.disableAllAuthorizedMonitors('EMERGENCY_STOP');
      });
    }
  }

  /**
   * Allows tests or harnesses to inject a mock fetch implementation cleanly and restore it later.
   */
  setFetchImplementation(fetchFn = null, dnsFn = null) {
    this._fetch = fetchFn || ((...args) => globalThis.fetch(...args));
    if (dnsFn !== undefined) {
      this._dnsLookup = dnsFn || ((host) => dns.lookup(host));
    }
  }

  _assertNotEmergencyStopped() {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Live web intelligence is halted while Emergency Stop is engaged.');
    }
  }

  /**
   * Startup health initialization (lightweight reachability + browser readiness, zero unnecessary scraping)
   */
  async initializeOnStartup(options = {}) {
    if (!this.state.initializedAt) {
      this.state.initializedAt = new Date().toISOString();
    }
    apiIntegrationsManagerInstance.detectEnvironmentKeys();
    const health = await this.refreshConnectionHealth({ testExternal: options.testExternal !== false });
    if (options.startMonitor !== false && !this._monitorTimer) {
      this.startHealthMonitor(options.monitorIntervalMs || 60000);
    }
    return health;
  }

  startHealthMonitor(intervalMs = 60000) {
    if (this._monitorTimer) clearInterval(this._monitorTimer);
    this._monitorTimer = setInterval(async () => {
      if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) return;
      try {
        await this.refreshConnectionHealth({ testExternal: true });
      } catch (_) {}
    }, Math.max(15000, intervalMs));
    if (typeof this._monitorTimer.unref === 'function') {
      this._monitorTimer.unref();
    }
  }

  stopHealthMonitor() {
    if (this._monitorTimer) {
      clearInterval(this._monitorTimer);
      this._monitorTimer = null;
    }
  }

  /**
   * Checks internet connectivity & updates Connected -> Disconnected -> Reconnected state
   */
  async checkInternetConnectivity(options = {}) {
    const t0 = Date.now();
    const probes = [
      'https://en.wikipedia.org/api/rest_v1/page/summary/Earth',
      'https://open.er-api.com/v6/latest/USD'
    ];

    let dnsOk = false;
    try {
      await this._dnsLookup('en.wikipedia.org');
      dnsOk = true;
    } catch (_) {
      dnsOk = false;
    }

    let reachable = false;
    let lastErr = null;
    for (const probeUrl of probes) {
      try {
        const res = await this._fetch(probeUrl, {
          method: 'HEAD',
          headers: DEFAULT_HEADERS,
          signal: AbortSignal.timeout(options.timeoutMs || 3500)
        });
        if (res && (res.ok || (res.status >= 200 && res.status < 500))) {
          reachable = true;
          break;
        }
      } catch (err) {
        // Fallback to GET if HEAD not supported by custom mock or upstream
        try {
          const resGet = await this._fetch(probeUrl, {
            headers: DEFAULT_HEADERS,
            signal: AbortSignal.timeout(options.timeoutMs || 3500)
          });
          if (resGet && (resGet.ok || (resGet.status >= 200 && resGet.status < 500))) {
            reachable = true;
            break;
          }
        } catch (err2) {
          lastErr = err2.message;
        }
      }
    }

    const connected = Boolean(reachable);
    const wasConnected = this.state.internetConnected;
    const nowIso = new Date().toISOString();
    this.state.lastHealthCheckAt = nowIso;

    if (connected) {
      if (wasConnected === false) {
        this.state.reconnectCount += 1;
      }
      this.state.internetConnected = true;
      this.state.lastOnlineAt = nowIso;
      this.state.lastError = null;
    } else {
      if (wasConnected === true || wasConnected === null) {
        this.state.disconnectCount += 1;
      }
      this.state.internetConnected = false;
      this.state.lastOfflineAt = nowIso;
      this.state.lastError = lastErr || (dnsOk ? 'HTTPS probe unreachable' : 'DNS & HTTPS unreachable');
    }

    return {
      connected,
      dnsOk,
      reconnected: wasConnected === false && connected === true,
      disconnected: wasConnected === true && connected === false,
      latencyMs: Date.now() - t0,
      error: this.state.lastError,
      checkedAt: nowIso
    };
  }

  async _checkBrowserAvailability() {
    try {
      const hasEngine = Boolean(browserAutomationEngineInstance && typeof browserAutomationEngineInstance.openSession === 'function');
      if (!hasEngine) return false;
      if (process.platform !== 'win32') return true;
      const candidates = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      ];
      return candidates.some(p => fs.existsSync(p)) || Boolean(this._hasPlaywrightChromium());
    } catch (_) {
      return false;
    }
  }

  _hasPlaywrightChromium() {
    try {
      const { chromium } = require('playwright');
      const exe = chromium.executablePath();
      return Boolean(exe && fs.existsSync(exe));
    } catch (_) {
      return false;
    }
  }

  async refreshConnectionHealth(options = {}) {
    apiIntegrationsManagerInstance.detectEnvironmentKeys();
    let conn = { connected: Boolean(this.state.internetConnected), checkedAt: this.state.lastHealthCheckAt };
    if (options.testExternal !== false || this.state.internetConnected === null) {
      conn = await this.checkInternetConnectivity(options);
    }

    const browserAvail = await this._checkBrowserAvailability();
    this.state.browserAvailable = browserAvail;

    const searchProviders = ['tavily', 'brave_search', 'serper', 'duckduckgo_html', 'wikipedia', 'google_news_rss'];
    const anyUsableSearch = searchProviders.some(id => apiIntegrationsManagerInstance.isProviderUsable(id));
    this.state.webSearchAvailable = Boolean(conn.connected && (anyUsableSearch || browserAvail));

    return this.getConnectivityStatus();
  }

  /**
   * Safe public status for Mission Control & Health endpoints (NEVER includes API keys)
   */
  getConnectivityStatus() {
    const summary = apiIntegrationsManagerInstance.getIntegrationsSummary().integrations;
    const trackedIds = [
      'tavily', 'brave_search', 'serper', 'duckduckgo_html', 'duckduckgo',
      'wikipedia', 'google_news_rss', 'newsapi', 'arxiv', 'github_api',
      'open_meteo', 'openweathermap', 'coingecko', 'exchangerate_api', 'yahoo_finance', 'alphavantage'
    ];
    const providers = {};
    for (const id of trackedIds) {
      const p = summary[id];
      if (!p) continue;
      providers[id] = {
        name: p.name,
        category: p.category,
        requiresKey: p.requiresKey,
        configured: p.isConfigured,
        health: p.health,
        usable: apiIntegrationsManagerInstance.isProviderUsable(id),
        latencyMs: p.latencyMs,
        lastCheck: p.lastCheck,
        requests: p.stats?.requests || 0,
        errors: p.stats?.errors || 0
      };
    }

    const connected = Boolean(this.state.internetConnected);
    const searchAvail = Boolean(connected && (this.state.webSearchAvailable || Object.values(providers).some(p => p.usable && (p.category === 'SEARCH' || p.category === 'NEWS'))));

    return {
      success: true,
      internet: connected ? 'Connected' : 'Disconnected',
      webSearch: searchAvail ? 'Available' : 'Unavailable',
      browser: this.state.browserAvailable ? 'Available' : 'Unavailable',
      research: this.state.activeResearchCount > 0 ? 'Working' : 'Ready',
      internetConnected: connected,
      webSearchAvailable: searchAvail,
      browserAvailable: this.state.browserAvailable,
      researchState: this.state.activeResearchCount > 0 ? 'Working' : 'Ready',
      activeResearchCount: this.state.activeResearchCount,
      initializedAt: this.state.initializedAt,
      lastHealthCheckAt: this.state.lastHealthCheckAt,
      lastOnlineAt: this.state.lastOnlineAt,
      lastOfflineAt: this.state.lastOfflineAt,
      disconnectCount: this.state.disconnectCount,
      reconnectCount: this.state.reconnectCount,
      lastError: this.state.lastError,
      providers,
      authorizedMonitors: Array.from(this._authorizedMonitors.values()).map(m => ({
        monitorId: m.monitorId,
        topic: m.topic,
        intervalMs: m.intervalMs,
        lastRunAt: m.lastRunAt,
        lastCount: m.lastCount
      }))
    };
  }

  /**
   * Authorized optional monitoring (strictly opt-in, disabled by default and on E-Stop)
   */
  enableAuthorizedMonitor(topic, options = {}) {
    this._assertNotEmergencyStopped();
    if (options.authorized !== true) {
      throw new Error('PERMISSION_REQUIRED: Scheduled monitoring requires explicit user authorization (authorized: true).');
    }
    const cleanTopic = String(topic || '').trim();
    if (!cleanTopic) throw new Error('Monitoring topic is required.');
    const intervalMs = Math.max(60000, Number(options.intervalMs || 300000));
    const monitorId = 'mon_' + Date.now().toString(36) + '_' + crypto.randomBytes(2).toString('hex');

    const record = {
      monitorId,
      topic: cleanTopic,
      intervalMs,
      lastRunAt: null,
      lastCount: 0,
      timer: null
    };

    record.timer = setInterval(async () => {
      if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) return;
      try {
        const res = await this.getLiveNews(cleanTopic, 5, { fresh: true });
        record.lastRunAt = new Date().toISOString();
        record.lastCount = res.count || 0;
        if (typeof options.onUpdate === 'function') {
          options.onUpdate(res);
        }
      } catch (_) {}
    }, intervalMs);

    if (typeof record.timer.unref === 'function') record.timer.unref();
    this._authorizedMonitors.set(monitorId, record);

    return {
      success: true,
      monitorId,
      topic: cleanTopic,
      intervalMs,
      summary: `Authorized periodic monitor "${monitorId}" enabled for "${cleanTopic}".`
    };
  }

  disableAuthorizedMonitor(monitorId) {
    const rec = this._authorizedMonitors.get(monitorId);
    if (!rec) return { success: false, error: `Monitor "${monitorId}" not found.` };
    if (rec.timer) clearInterval(rec.timer);
    this._authorizedMonitors.delete(monitorId);
    return { success: true, monitorId };
  }

  disableAllAuthorizedMonitors(reason = 'USER_STOP') {
    for (const [id, rec] of this._authorizedMonitors.entries()) {
      if (rec.timer) clearInterval(rec.timer);
      this._authorizedMonitors.delete(id);
    }
    return { success: true, reason };
  }

  /**
   * Central bounded fetch wrapper with rate-limiting, timeouts, transient retries, and quota/auth tracking
   */
  async _fetchWithRetry(providerId, targetUrl, fetchInit = {}, options = {}) {
    this._assertNotEmergencyStopped();
    const rate = apiIntegrationsManagerInstance.checkRateLimit(providerId);
    if (!rate.allowed) {
      const err = new Error(`RATE_LIMITED: Provider ${providerId} exceeded per-minute rate limit (retry in ${Math.ceil(rate.retryAfterMs / 1000)}s).`);
      err.code = 'RATE_LIMITED';
      err.statusCode = 429;
      throw err;
    }

    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 1;
    const timeoutMs = options.timeoutMs || 6500;
    let lastErr = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      this._assertNotEmergencyStopped();
      const t0 = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await this._fetch(targetUrl, {
          ...fetchInit,
          headers: { ...DEFAULT_HEADERS, ...(fetchInit.headers || {}) },
          signal: controller.signal
        });
        clearTimeout(timer);

        const latencyMs = Date.now() - t0;
        const quotaRemaining = res.headers?.get ? res.headers.get('x-ratelimit-remaining') : null;

        if (res.status === 401 || res.status === 403) {
          const msg = `${providerId} authentication/access error (HTTP ${res.status})`;
          apiIntegrationsManagerInstance.recordProviderOutcome(providerId, {
            ok: false,
            statusCode: res.status,
            authError: true,
            latencyMs,
            error: msg
          });
          const err = new Error(msg);
          err.statusCode = res.status;
          err.isAuthError = true;
          throw err;
        }

        if (res.status === 429) {
          const retryAfterHdr = res.headers?.get ? Number(res.headers.get('retry-after') || 0) : 0;
          const retryAfterMs = retryAfterHdr > 0 ? retryAfterHdr * 1000 : 120000;
          const msg = `${providerId} quota/rate limit exhausted (HTTP 429)`;
          apiIntegrationsManagerInstance.recordProviderOutcome(providerId, {
            ok: false,
            statusCode: 429,
            quotaExhausted: true,
            retryAfterMs,
            latencyMs,
            error: msg
          });
          const err = new Error(msg);
          err.statusCode = 429;
          err.isQuotaExhausted = true;
          throw err;
        }

        if (res.status >= 500 && attempt < maxRetries) {
          lastErr = new Error(`${providerId} temporary upstream HTTP ${res.status}`);
          await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
          continue;
        }

        if (!res.ok) {
          const err = new Error(`${providerId} responded with HTTP ${res.status}`);
          err.statusCode = res.status;
          apiIntegrationsManagerInstance.recordProviderOutcome(providerId, {
            ok: false,
            statusCode: res.status,
            latencyMs,
            error: err.message
          });
          throw err;
        }

        apiIntegrationsManagerInstance.recordProviderOutcome(providerId, {
          ok: true,
          latencyMs,
          quotaRemaining
        });
        // A successful real external request proves connectivity is up
        if (this.state.internetConnected === false) {
          this.state.reconnectCount += 1;
        }
        this.state.internetConnected = true;
        this.state.lastOnlineAt = new Date().toISOString();
        this.state.lastError = null;
        return res;
      } catch (err) {
        clearTimeout(timer);
        if (err.isAuthError || err.isQuotaExhausted || err.statusCode) {
          throw err;
        }
        lastErr = err;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 220 * (attempt + 1)));
          continue;
        }
        apiIntegrationsManagerInstance.recordProviderOutcome(providerId, {
          ok: false,
          offline: true,
          latencyMs: Date.now() - t0,
          error: err.message
        });
      }
    }

    throw lastErr || new Error(`${providerId} request failed`);
  }

  /**
   * Respects robots.txt Disallow rules for autonomous crawls (fail-open if robots.txt 404/absent)
   */
  async _checkRobotsPolicy(targetUrl) {
    try {
      const u = new URL(targetUrl);
      const origin = u.origin;
      const now = Date.now();
      let cached = this.robotsCache.get(origin);

      if (!cached || (now - cached.timestamp) > this.robotsTtlMs) {
        let disallowedPaths = [];
        try {
          const res = await this._fetch(`${origin}/robots.txt`, {
            headers: DEFAULT_HEADERS,
            signal: AbortSignal.timeout(2200)
          });
          if (res && res.ok) {
            const body = await res.text();
            let activeBlock = false;
            for (const rawLine of body.split(/\r?\n/)) {
              const line = rawLine.split('#')[0].trim();
              if (!line) continue;
              const uaMatch = line.match(/^User-agent:\s*(.+)$/i);
              if (uaMatch) {
                const agent = uaMatch[1].trim().toLowerCase();
                activeBlock = (agent === '*' || agent.includes('jarvis') || agent.includes('lokesh'));
                continue;
              }
              if (activeBlock) {
                const disMatch = line.match(/^Disallow:\s*(.*)$/i);
                if (disMatch && disMatch[1].trim()) {
                  disallowedPaths.push(disMatch[1].trim());
                }
              }
            }
          }
        } catch (_) {
          disallowedPaths = [];
        }
        cached = { timestamp: now, disallowedPaths };
        this.robotsCache.set(origin, cached);
      }

      const pathAndQuery = u.pathname + (u.search || '');
      for (const rule of cached.disallowedPaths) {
        if (rule === '/' || pathAndQuery.startsWith(rule)) {
          return { allowed: false, rule };
        }
      }
      return { allowed: true };
    } catch (_) {
      return { allowed: true };
    }
  }

  // ===========================================================================
  // INDIVIDUAL SEARCH PROVIDERS
  // ===========================================================================

  async _searchTavily(query, maxResults = 5) {
    const key = apiIntegrationsManagerInstance.getProviderKey('tavily');
    if (!key) throw new Error('TAVILY_API_KEY not configured');
    const res = await this._fetchWithRetry('tavily', 'https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: maxResults,
        include_answer: false
      })
    }, { timeoutMs: 7000, maxRetries: 0 });
    const data = await res.json();
    const list = Array.isArray(data.results) ? data.results : [];
    return list.slice(0, maxResults).map(item => ({
      title: sanitizeUntrusted(item.title || query).cleanText,
      snippet: sanitizeUntrusted(item.content || '').cleanText,
      url: item.url,
      source: `Tavily (${normalizeDomain(item.url)})`,
      publishedAt: item.published_date || null,
      provider: 'tavily'
    })).filter(r => r.url);
  }

  async _searchBrave(query, maxResults = 5) {
    const key = apiIntegrationsManagerInstance.getProviderKey('brave_search');
    if (!key) throw new Error('BRAVE_SEARCH_API_KEY not configured');
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(10, maxResults)}`;
    const res = await this._fetchWithRetry('brave_search', url, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': key }
    }, { timeoutMs: 6500, maxRetries: 0 });
    const data = await res.json();
    const list = data.web?.results || [];
    return list.slice(0, maxResults).map(item => ({
      title: sanitizeUntrusted(item.title || query).cleanText,
      snippet: sanitizeUntrusted(item.description || '').cleanText,
      url: item.url,
      source: `Brave Search (${normalizeDomain(item.url)})`,
      publishedAt: item.page_age || item.age || null,
      provider: 'brave_search'
    })).filter(r => r.url);
  }

  async _searchSerper(query, maxResults = 5) {
    const key = apiIntegrationsManagerInstance.getProviderKey('serper');
    if (!key) throw new Error('SERPER_API_KEY not configured');
    const res = await this._fetchWithRetry('serper', 'https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
      body: JSON.stringify({ q: query, num: Math.min(10, maxResults) })
    }, { timeoutMs: 6500, maxRetries: 0 });
    const data = await res.json();
    const list = Array.isArray(data.organic) ? data.organic : [];
    return list.slice(0, maxResults).map(item => ({
      title: sanitizeUntrusted(item.title || query).cleanText,
      snippet: sanitizeUntrusted(item.snippet || '').cleanText,
      url: item.link,
      source: `Serper (${normalizeDomain(item.link)})`,
      publishedAt: item.date || null,
      provider: 'serper'
    })).filter(r => r.url);
  }

  async _searchDuckDuckGoHtml(query, maxResults = 5) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await this._fetchWithRetry('duckduckgo_html', url, {
      headers: {
        ...DEFAULT_HEADERS,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      }
    }, { timeoutMs: 6500, maxRetries: 1 });
    const html = await res.text();
    const results = [];

    // Match result blocks cleanly without touching DDG ad blocks
    const anchorRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<(?:a|div)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/gi;

    const snippets = [];
    let sMatch;
    while ((sMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(stripTags(sMatch[1]));
    }

    let aMatch;
    let idx = 0;
    while ((aMatch = anchorRegex.exec(html)) !== null && results.length < maxResults) {
      let href = decodeHtmlEntities(aMatch[1]);
      if (href.startsWith('//')) href = 'https:' + href;
      if (href.includes('duckduckgo.com/y.js') || href.includes('ad_domain=')) {
        idx++;
        continue;
      }
      if (href.includes('uddg=')) {
        try {
          const parsed = new URL(href);
          const real = parsed.searchParams.get('uddg');
          if (real) href = real;
        } catch (_) {}
      }
      if (!/^https?:\/\//i.test(href)) {
        idx++;
        continue;
      }
      const title = sanitizeUntrusted(stripTags(aMatch[2])).cleanText;
      const snippet = sanitizeUntrusted(snippets[idx] || title).cleanText;
      idx++;
      if (!title) continue;

      results.push({
        title,
        snippet,
        url: href,
        source: `${normalizeDomain(href)}`,
        publishedAt: null,
        provider: 'duckduckgo_html'
      });
    }

    return results;
  }

  async _searchWikipedia(query, maxResults = 3) {
    const out = [];
    // 1. Direct REST summary for crisp canonical topics
    try {
      const slug = encodeURIComponent(query.trim().replace(/\s+/g, '_'));
      const sumRes = await this._fetchWithRetry('wikipedia', `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {}, { timeoutMs: 4500, maxRetries: 0 });
      const data = await sumRes.json();
      if (data && data.extract) {
        out.push({
          title: sanitizeUntrusted(data.title || query).cleanText,
          snippet: sanitizeUntrusted(data.extract).cleanText,
          url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${slug}`,
          source: 'Wikipedia',
          publishedAt: data.timestamp || null,
          provider: 'wikipedia'
        });
      }
    } catch (_) {}

    // 2. Full-text Wikipedia search (returns multiple relevant pages + timestamps even when query is a sentence)
    if (out.length < maxResults) {
      try {
        const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${maxResults}&format=json`;
        const searchRes = await this._fetchWithRetry('wikipedia', apiUrl, {}, { timeoutMs: 5000, maxRetries: 0 });
        const sData = await searchRes.json();
        const hits = sData?.query?.search || [];
        for (const hit of hits) {
          const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(String(hit.title || '').replace(/\s+/g, '_'))}`;
          if (out.some(r => r.url === pageUrl)) continue;
          out.push({
            title: sanitizeUntrusted(hit.title).cleanText,
            snippet: sanitizeUntrusted(stripTags(hit.snippet || '')).cleanText,
            url: pageUrl,
            source: 'Wikipedia Search',
            publishedAt: hit.timestamp || null,
            provider: 'wikipedia'
          });
          if (out.length >= maxResults) break;
        }
      } catch (_) {}
    }

    return out;
  }

  async _searchDuckDuckGoInstant(query, maxResults = 3) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await this._fetchWithRetry('duckduckgo', url, {}, { timeoutMs: 4500, maxRetries: 0 });
    const text = await res.text();
    if (!text) return [];
    const data = JSON.parse(text);
    const out = [];
    if (data.AbstractText) {
      out.push({
        title: sanitizeUntrusted(data.Heading || query).cleanText,
        snippet: sanitizeUntrusted(data.AbstractText).cleanText,
        url: data.AbstractURL || 'https://duckduckgo.com',
        source: data.AbstractSource || 'DuckDuckGo Knowledge',
        publishedAt: null,
        provider: 'duckduckgo'
      });
    }
    if (Array.isArray(data.RelatedTopics)) {
      for (const top of data.RelatedTopics) {
        if (out.length >= maxResults) break;
        if (top.Text && top.FirstURL) {
          out.push({
            title: sanitizeUntrusted(top.Text.split(' - ')[0] || query).cleanText,
            snippet: sanitizeUntrusted(top.Text).cleanText,
            url: top.FirstURL,
            source: 'DuckDuckGo Related',
            publishedAt: null,
            provider: 'duckduckgo'
          });
        }
      }
    }
    return out;
  }

  /**
   * First-Party Google Search Grounding via Gemini API (tools: [{ googleSearch: {} }])
   * Retrieves genuine Google webSearchQueries, grounding chunks, URLs, and summaries.
   */
  async _searchGoogleGrounding(query, maxResults = 5) {
    const key = process.env.GEMINI_API_KEY || apiIntegrationsManagerInstance.getProviderKey('gemini');
    if (!key) throw new Error('GEMINI_API_KEY not configured for Google Search Grounding');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await this._fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Search Google for: ${query}. Summarize the verified facts, web sources, and direct URLs.` }] }],
        tools: [{ googleSearch: {} }]
      }),
      signal: AbortSignal.timeout(9500)
    });

    if (!res.ok) {
      throw new Error(`Google Search Grounding HTTP ${res.status}`);
    }
    const data = await res.json();
    const cand = data.candidates?.[0];
    const meta = cand?.groundingMetadata;
    const text = cand?.content?.parts?.[0]?.text || '';
    const chunks = meta?.groundingChunks || [];

    const results = [];
    for (let i = 0; i < chunks.length && results.length < maxResults; i++) {
      const c = chunks[i];
      if (!c.web || !c.web.uri) continue;
      const cleanTitle = sanitizeUntrusted(c.web.title || query).cleanText;
      results.push({
        title: cleanTitle,
        snippet: sanitizeUntrusted(text.slice(0, 320)).cleanText,
        url: c.web.uri,
        source: `Google Search Grounding (${c.web.title || 'Web'})`,
        publishedAt: new Date().toISOString(),
        provider: 'google_search_grounding'
      });
    }

    return results;
  }

  /**
   * Playwright Browser-Based Search Fallback (reuses browserAutomationEngineInstance)
   */
  async _searchViaBrowser(query, maxResults = 5) {
    this._assertNotEmergencyStopped();
    let sessionId = null;
    try {
      const opened = await browserAutomationEngineInstance.openSession({ headless: true, timeout: 12000 });
      sessionId = opened.sessionId;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      await browserAutomationEngineInstance.navigate(sessionId, searchUrl, { timeout: 12000 });
      const sess = browserAutomationEngineInstance._getSession(sessionId);

      const rawItems = await sess.page.evaluate((limit) => {
        const links = Array.from(document.querySelectorAll('a.result__a, .result__title a'));
        const snippets = Array.from(document.querySelectorAll('.result__snippet'));
        const items = [];
        for (let i = 0; i < links.length && items.length < limit; i++) {
          const a = links[i];
          const href = a.getAttribute('href') || a.href || '';
          const title = (a.innerText || a.textContent || '').trim();
          const snippet = snippets[i] ? (snippets[i].innerText || '').trim() : title;
          if (title && href) items.push({ title, href, snippet });
        }
        return items;
      }, maxResults * 2);

      const results = [];
      for (const item of rawItems) {
        let href = item.href;
        if (href.startsWith('//')) href = 'https:' + href;
        if (href.includes('uddg=')) {
          try {
            const real = new URL(href).searchParams.get('uddg');
            if (real) href = real;
          } catch (_) {}
        }
        if (!/^https?:\/\//i.test(href) || href.includes('duckduckgo.com/y.js')) continue;
        results.push({
          title: sanitizeUntrusted(item.title).cleanText,
          snippet: sanitizeUntrusted(item.snippet).cleanText,
          url: href,
          source: `${normalizeDomain(href)} (Playwright)`,
          publishedAt: null,
          provider: 'playwright_browser'
        });
        if (results.length >= maxResults) break;
      }
      this.state.browserAvailable = true;
      return results;
    } finally {
      if (sessionId) {
        await browserAutomationEngineInstance.closeSession(sessionId).catch(() => {});
      }
    }
  }

  // ===========================================================================
  // LIVE NEWS (Direct Publisher Feeds + Hacker News + NewsAPI + Normalized Google News RSS)
  // ===========================================================================

  _isEncodedTokenJunk(text = '') {
    const s = String(text || '').trim();
    if (!s) return true;
    if (/\b(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{24,}\b/.test(s)) return true;
    if (/^[A-Za-z0-9+/_=-]{48,}$/.test(s) && !/\s/.test(s)) return true;
    return false;
  }

  _cleanReadableNewsText(raw = '') {
    let txt = decodeHtmlEntities(String(raw || ''))
      .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/https?:\/\/news\.google\.com\/rss\/articles\/[^\s)]+/gi, '')
      .replace(/\b(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{20,}(?:\?oc=\d+)?/g, '')
      .replace(/https?:\/\/[^\s)]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    // Drop standalone unbroken base64/hash blobs >= 42 chars
    txt = txt
      .split(/\s+/)
      .filter(tok => !(/^[A-Za-z0-9+/_=-]{42,}$/.test(tok)))
      .join(' ')
      .trim();
    return sanitizeUntrusted(txt).cleanText;
  }

  _formatRelativeTime(isoDate) {
    if (!isoDate) return { publishedAt: null, publishedDisplay: 'Date unavailable', isCurrentNews: false };
    const ts = Date.parse(isoDate);
    if (!Number.isFinite(ts)) {
      return { publishedAt: String(isoDate), publishedDisplay: String(isoDate), isCurrentNews: false };
    }
    const iso = new Date(ts).toISOString();
    const diffMs = Math.max(0, Date.now() - ts);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const isCurrentNews = diffHours <= 72;
    let ago = '';
    if (diffMins < 60) ago = `${Math.max(1, diffMins)}m ago`;
    else if (diffHours < 48) ago = `${diffHours}h ago`;
    else ago = `${diffDays}d ago`;
    const dateShort = new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return {
      publishedAt: iso,
      publishedDisplay: `${dateShort} · ${ago}`,
      isCurrentNews
    };
  }

  _normalizeNewsArticle(raw = {}, fallbackSource = 'News Outlet') {
    const source = this._cleanReadableNewsText(raw.source || raw.publisher || fallbackSource) || fallbackSource;
    let headline = this._cleanReadableNewsText(raw.headline || raw.title || '');
    // Strip trailing " - Source Name" suffix injected by aggregator RSS feeds
    if (source && headline.toLowerCase().endsWith(` - ${source.toLowerCase()}`)) {
      headline = headline.slice(0, -(source.length + 3)).trim();
    } else if (headline.includes(' - ')) {
      const parts = headline.split(' - ');
      const tail = parts[parts.length - 1].trim();
      if (tail.length <= 42 && !/\d{4}/.test(tail) && parts.length > 1) {
        parts.pop();
        headline = parts.join(' - ').trim();
      }
    }

    if (!headline || headline.length < 6 || this._isEncodedTokenJunk(headline)) {
      return null;
    }

    const rawUrl = String(raw.url || raw.link || '').trim();
    if (!/^https?:\/\/[^\s]+$/i.test(rawUrl)) {
      return null;
    }

    const isGoogleWrapper = /news\.google\.com\/(?:rss\/)?articles\//i.test(rawUrl);
    let summary = this._cleanReadableNewsText(raw.summary || raw.snippet || raw.description || '');
    // If summary only repeats headline/source or is empty/junk, build an honest short descriptor (zero encoded tokens)
    if (!summary || summary.length < 18 || summary.toLowerCase() === headline.toLowerCase() || summary.toLowerCase() === `${headline.toLowerCase()} ${source.toLowerCase()}`) {
      summary = `Reported by ${source}. Open the original article to read full coverage.`;
    }
    if (summary.length > 340) {
      summary = `${summary.slice(0, 337).replace(/\s+\S*$/, '')}...`;
    }

    const timing = this._formatRelativeTime(raw.publishedAt || raw.pubDate || null);
    const authorClean = raw.author ? this._cleanReadableNewsText(raw.author) : null;
    const rawImg = String(raw.imageUrl || '').trim();
    const imageUrl = /^https?:\/\/[^\s"'<>]+$/i.test(rawImg) ? rawImg : null;
    const id = crypto.createHash('sha1').update(`${source}|${headline}|${rawUrl}`).digest('hex').slice(0, 12);

    return {
      id,
      source,
      publisher: source,
      headline,
      title: headline,
      summary,
      snippet: summary,
      url: rawUrl,
      link: rawUrl,
      sourceUrl: raw.sourceUrl && /^https?:\/\//i.test(raw.sourceUrl) ? raw.sourceUrl : null,
      isGoogleNewsWrapper: isGoogleWrapper,
      publishedAt: timing.publishedAt,
      publishedDisplay: timing.publishedDisplay,
      isCurrentNews: timing.isCurrentNews,
      author: authorClean && authorClean.length >= 2 ? authorClean : null,
      imageUrl
    };
  }

  _extractXmlTag(block, tagNames = []) {
    for (const tag of tagNames) {
      const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      if (m && m[1]) return m[1];
    }
    return '';
  }

  _parseNewsFeedXml(xml = '', fallbackSource = 'News Feed', maxItems = 15) {
    const blocks = [
      ...(String(xml).match(/<item\b[\s\S]*?<\/item>/gi) || []),
      ...(String(xml).match(/<entry\b[\s\S]*?<\/entry>/gi) || [])
    ];
    const items = [];
    for (const block of blocks.slice(0, maxItems)) {
      const rawTitle = this._extractXmlTag(block, ['title']);
      let linkUrl = decodeHtmlEntities(this._extractXmlTag(block, ['link', 'id'])).trim();
      if (!linkUrl) {
        const atomLink = block.match(/<link\b[^>]*rel=["']?alternate["']?[^>]*href=["']([^"']+)["']/i) ||
                         block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
        if (atomLink) linkUrl = decodeHtmlEntities(atomLink[1]).trim();
      }
      const sourceMatch = block.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/i);
      const sourceUrlAttr = sourceMatch ? (sourceMatch[1].match(/url=["']([^"']+)["']/i)?.[1] || null) : null;
      const sourceName = sourceMatch ? decodeHtmlEntities(sourceMatch[2]).trim() : fallbackSource;

      const rawDesc = this._extractXmlTag(block, ['description', 'summary', 'content:encoded', 'content']);
      const rawDate = this._extractXmlTag(block, ['pubDate', 'published', 'updated', 'dc:date']);
      const rawAuthor = this._extractXmlTag(block, ['dc:creator', 'author']);
      let author = decodeHtmlEntities(rawAuthor).replace(/<name>([\s\S]*?)<\/name>/i, '$1').replace(/<[^>]+>/g, ' ').trim();

      let imageUrl = null;
      const mediaMatch = block.match(/<media:(?:thumbnail|content)\b[^>]*url=["']([^"']+)["']/i) ||
                         block.match(/<enclosure\b[^>]*type=["']image\/[^"']+["'][^>]*url=["']([^"']+)["']/i) ||
                         decodeHtmlEntities(rawDesc).match(/<img\b[^>]*src=["'](https?:\/\/[^"']+)["']/i);
      if (mediaMatch && mediaMatch[1]) {
        imageUrl = decodeHtmlEntities(mediaMatch[1]).trim();
      }

      const normalized = this._normalizeNewsArticle({
        headline: rawTitle,
        source: sourceName,
        url: linkUrl,
        sourceUrl: sourceUrlAttr,
        description: rawDesc,
        publishedAt: rawDate.trim(),
        author,
        imageUrl
      }, fallbackSource);

      if (normalized) items.push(normalized);
    }
    return items;
  }

  _getDirectFeedsForQuery(rawTopic = 'technology', explicitSource = '') {
    const q = `${rawTopic} ${explicitSource}`.toLowerCase().trim();
    const CATALOG = [
      { id: 'the_register', name: 'The Register', url: 'https://www.theregister.com/headlines.atom', tags: ['the register', 'theregister', 'register', 'technology', 'tech', 'ai', 'security', 'cloud', 'software'] },
      { id: 'bbc_tech', name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', tags: ['bbc', 'bbc news', 'bbc tech', 'technology', 'tech', 'ai'] },
      { id: 'techcrunch', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', tags: ['techcrunch', 'technology', 'tech', 'ai', 'artificial intelligence', 'startup', 'venture'] },
      { id: 'arstechnica', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', tags: ['ars technica', 'arstechnica', 'ars', 'technology', 'tech', 'ai', 'science', 'space'] },
      { id: 'bbc_world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', tags: ['bbc', 'bbc world', 'world', 'global', 'international'] },
      { id: 'bbc_business', name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', tags: ['bbc', 'bbc business', 'business', 'finance', 'economy', 'markets'] }
    ];

    const srcLower = String(explicitSource || '').toLowerCase().trim();
    if (srcLower) {
      const matchedBySource = CATALOG.filter(f => f.name.toLowerCase().includes(srcLower) || f.id.includes(srcLower.replace(/\s+/g, '_')) || f.tags.includes(srcLower));
      if (matchedBySource.length > 0) return matchedBySource;
    }

    if (/\b(?:the\s+)?register\b/i.test(q)) return [CATALOG[0]];
    if (/\btechcrunch\b/i.test(q)) return [CATALOG[2]];
    if (/\bars\s*technica\b/i.test(q)) return [CATALOG[3]];
    if (/\bbbc\b/i.test(q)) return [CATALOG[1], CATALOG[4], CATALOG[5]];
    if (/\b(?:world|global|international)\b/i.test(q)) return [CATALOG[4]];
    if (/\b(?:business|finance|economy|markets|stocks)\b/i.test(q)) return [CATALOG[5], CATALOG[2]];
    if (/\b(?:ai|artificial\s+intelligence|llm|openai|anthropic|gemini|machine\s+learning)\b/i.test(q)) {
      return [CATALOG[2], CATALOG[3], CATALOG[0], CATALOG[1]];
    }
    if (/\b(?:tech|technology|software|cyber|computing|hardware)\b/i.test(q) || !q) {
      return [CATALOG[0], CATALOG[1], CATALOG[2], CATALOG[3]];
    }
    return [];
  }

  async getLiveNews(topic = 'technology', maxResults = 6, options = {}) {
    this._assertNotEmergencyStopped();
    const rawTopic = String(topic || 'technology').trim() || 'technology';
    const sourceFilter = String(options.source || '').trim();
    const limit = Math.min(12, Math.max(1, Number(maxResults) || 6));
    const cacheKey = `news_${rawTopic.toLowerCase()}_${sourceFilter.toLowerCase()}_${limit}`;
    if (!options.fresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
        return { ...cached.data, cached: true };
      }
    }

    const t0 = Date.now();
    const articles = [];
    const seenKeys = new Set();
    const providersAttempted = [];
    const providersSucceeded = [];
    const providerErrors = {};

    const addNormalized = (list) => {
      for (const item of list) {
        if (!item) continue;
        const k = `${item.headline.toLowerCase()}|${item.url.toLowerCase()}`;
        if (!seenKeys.has(k)) {
          seenKeys.add(k);
          articles.push(item);
        }
      }
    };

    // 1. Optional NewsAPI if configured
    if (apiIntegrationsManagerInstance.isProviderUsable('newsapi') && apiIntegrationsManagerInstance.getProviderKey('newsapi')) {
      providersAttempted.push('newsapi');
      try {
        const key = apiIntegrationsManagerInstance.getProviderKey('newsapi');
        const qStr = sourceFilter ? `${rawTopic} ${sourceFilter}` : rawTopic;
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(qStr)}&sortBy=publishedAt&pageSize=${limit}`;
        const res = await this._fetchWithRetry('newsapi', url, {
          headers: { 'X-Api-Key': key }
        }, { timeoutMs: 6000, maxRetries: 0 });
        const data = await res.json();
        const normList = (data.articles || [])
          .map(a => this._normalizeNewsArticle({
            headline: a.title,
            source: a.source?.name || 'NewsAPI',
            url: a.url,
            description: a.description || a.content,
            publishedAt: a.publishedAt,
            author: a.author,
            imageUrl: a.urlToImage
          }, 'NewsAPI'))
          .filter(Boolean);
        if (normList.length > 0) providersSucceeded.push('newsapi');
        addNormalized(normList);
      } catch (err) {
        providerErrors.newsapi = err.message;
      }
    }

    // 2. Direct Verified Publisher RSS/Atom Feeds (real URLs, summaries, dates, authors & images — zero encoded tokens)
    const directFeeds = this._getDirectFeedsForQuery(rawTopic, sourceFilter);
    if (articles.length < limit && directFeeds.length > 0) {
      const stopWords = new Set(['the', 'and', 'for', 'news', 'latest', 'current', 'today', 'top', 'technology', 'tech', 'world', 'business', 'from']);
      const topicKeywords = rawTopic.toLowerCase().split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w) && !sourceFilter.toLowerCase().includes(w));

      await Promise.all(directFeeds.map(async (feed) => {
        providersAttempted.push(feed.id);
        try {
          const res = await this._fetchWithRetry('google_news_rss', feed.url, { headers: DEFAULT_HEADERS }, { timeoutMs: 6000, maxRetries: 0 });
          const xml = await res.text();
          let parsed = this._parseNewsFeedXml(xml, feed.name, 16);
          if (topicKeywords.length > 0) {
            const aiKeywords = topicKeywords.includes('ai')
              ? ['ai', 'artificial intelligence', 'llm', 'openai', 'anthropic', 'gemini', 'claude', 'model', 'machine learning', 'neural']
              : topicKeywords;
            const filtered = parsed.filter(item => {
              const hay = `${item.headline} ${item.summary}`.toLowerCase();
              return aiKeywords.some(kw => hay.includes(kw));
            });
            if (filtered.length > 0) parsed = filtered;
          }
          if (parsed.length > 0) {
            providersSucceeded.push(feed.id);
            addNormalized(parsed.slice(0, directFeeds.length === 1 ? limit : Math.max(2, Math.ceil(limit / directFeeds.length) + 1)));
          }
        } catch (err) {
          providerErrors[feed.id] = err.message;
        }
      }));
    }

    // 3. Live Hacker News Algolia API for custom tech/AI searches
    if (articles.length < limit && !sourceFilter) {
      providersAttempted.push('hacker_news_algolia');
      try {
        const hnUrl = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(rawTopic)}&tags=story&hitsPerPage=${limit}`;
        const res = await this._fetchWithRetry('duckduckgo_html', hnUrl, { headers: DEFAULT_HEADERS }, { timeoutMs: 5000, maxRetries: 0 });
        const data = await res.json();
        const hnItems = (data.hits || [])
          .filter(h => h.title && h.url && !h.url.includes('news.google.com'))
          .map(h => this._normalizeNewsArticle({
            headline: h.title,
            source: normalizeDomain(h.url) || 'Hacker News',
            url: h.url,
            description: h.story_text ? stripTags(h.story_text) : `Featured in live tech discussions (${h.points || 0} points, ${h.num_comments || 0} comments).`,
            publishedAt: h.created_at,
            author: h.author
          }, 'Tech Community'))
          .filter(Boolean);
        if (hnItems.length > 0) providersSucceeded.push('hacker_news_algolia');
        addNormalized(hnItems);
      } catch (err) {
        providerErrors.hacker_news_algolia = err.message;
      }
    }

    // 4. Google News RSS (custom topic / broad supplement — strictly cleaned & normalized to prevent CBMi... display leaks)
    if (articles.length < limit && apiIntegrationsManagerInstance.isProviderUsable('google_news_rss')) {
      providersAttempted.push('google_news_rss');
      try {
        const queryTerms = sourceFilter ? `${rawTopic} ${sourceFilter}` : rawTopic;
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(queryTerms)}&hl=en-US&gl=US&ceid=US:en`;
        const res = await this._fetchWithRetry('google_news_rss', url, {}, { timeoutMs: 6500, maxRetries: 1 });
        const xml = await res.text();
        const gItems = this._parseNewsFeedXml(xml, 'News Outlet', limit + 3);
        if (gItems.length > 0) providersSucceeded.push('google_news_rss');
        addNormalized(gItems);
      } catch (err) {
        providerErrors.google_news_rss = err.message;
      }
    }

    // 5. Fallback to DuckDuckGo HTML news query if still empty
    if (articles.length === 0 && apiIntegrationsManagerInstance.isProviderUsable('duckduckgo_html')) {
      providersAttempted.push('duckduckgo_html');
      try {
        const webHits = await this._searchDuckDuckGoHtml(`${sourceFilter || rawTopic} latest news`, limit);
        const ddgNorm = webHits
          .map(hit => this._normalizeNewsArticle({
            headline: hit.title,
            source: hit.source,
            url: hit.url,
            description: hit.snippet,
            publishedAt: hit.publishedAt
          }, 'Web News'))
          .filter(Boolean);
        if (ddgNorm.length > 0) providersSucceeded.push('duckduckgo_html');
        addNormalized(ddgNorm);
      } catch (err) {
        providerErrors.duckduckgo_html = err.message;
      }
    }

    // Sort current articles newest-first
    articles.sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) || 0 : 0;
      return tb - ta;
    });

    const finalArticles = articles.slice(0, limit);
    const success = finalArticles.length > 0;
    const providerUsed = providersSucceeded.length > 0 ? Array.from(new Set(providersSucceeded)).join(', ') : 'none';
    const anyNetErr = Object.values(providerErrors).some(msg => /fetch|ENOTFOUND|ECONN|network|timeout|abort/i.test(String(msg)));
    const offline = Boolean(!success && (this.state.internetConnected === false || anyNetErr));

    if (!success) {
      errorDiagnostics.record(new Error(`All news providers failed for "${rawTopic}"`), { subsystem: 'live_news', topic: rawTopic, providerErrors });
    }

    const summaryLines = finalArticles.map((a, i) =>
      `${i + 1}. **${a.headline}** (${a.source}, ${a.publishedDisplay}) — ${a.summary} [Read Article](${a.url})`
    );

    const payload = {
      success,
      offline,
      topic: rawTopic,
      sourceFilter: sourceFilter || null,
      providerUsed,
      providersAttempted: Array.from(new Set(providersAttempted)),
      providersSucceeded: Array.from(new Set(providersSucceeded)),
      providerErrors,
      count: finalArticles.length,
      articles: finalArticles,
      retrievedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      summary: success
        ? `Retrieved ${finalArticles.length} live headlines for "${sourceFilter || rawTopic}" via ${providerUsed}:\n${summaryLines.join('\n')}`
        : (offline
          ? `Unable to retrieve live news for "${sourceFilter || rawTopic}" because the internet connection appears offline.`
          : `Unable to retrieve live news for "${sourceFilter || rawTopic}". Attempted: ${Array.from(new Set(providersAttempted)).join(', ')}. Errors: ${Object.values(providerErrors).join(' | ') || 'No parseable articles returned'}.`)
    };

    if (success) {
      this.cache.set(cacheKey, { timestamp: Date.now(), data: payload });
    }
    return payload;
  }

  // ===========================================================================
  // LIVE GITHUB / DOCS, ARXIV, AND FINANCIAL / FX / COMMODITY DATA
  // ===========================================================================

  async searchGitHub(query, maxResults = 5) {
    this._assertNotEmergencyStopped();
    const cleanQ = String(query || '').trim();
    if (!cleanQ) throw new Error('GitHub search query is required.');
    const headers = { Accept: 'application/vnd.github+json' };
    const key = apiIntegrationsManagerInstance.getProviderKey('github_api');
    if (key) headers.Authorization = `Bearer ${key}`;

    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(cleanQ)}&sort=stars&order=desc&per_page=${Math.min(10, maxResults)}`;
    const res = await this._fetchWithRetry('github_api', url, { headers }, { timeoutMs: 6500, maxRetries: 1 });
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const results = items.slice(0, maxResults).map(repo => ({
      title: sanitizeUntrusted(repo.full_name).cleanText,
      snippet: sanitizeUntrusted(`${repo.description || 'Repository'} (★ ${repo.stargazers_count || 0}, Language: ${repo.language || 'N/A'})`).cleanText,
      url: repo.html_url,
      source: 'GitHub',
      stars: repo.stargazers_count || 0,
      language: repo.language || null,
      publishedAt: repo.pushed_at || repo.updated_at || null,
      provider: 'github_api'
    }));
    return {
      success: results.length > 0,
      query: cleanQ,
      count: results.length,
      results,
      retrievedAt: new Date().toISOString()
    };
  }

  async getFinancialData(query = '') {
    this._assertNotEmergencyStopped();
    const raw = String(query || '').trim();
    const lower = raw.toLowerCase();
    const t0 = Date.now();

    // 1. Foreign Exchange Rate check (e.g. "USD to INR", "100 EUR in USD", "dollar to rupee")
    const aliasCur = (tok) => {
      const m = {
        dollar: 'USD', usd: 'USD', rupee: 'INR', rupees: 'INR', inr: 'INR',
        euro: 'EUR', eur: 'EUR', pound: 'GBP', gbp: 'GBP', yen: 'JPY', jpy: 'JPY',
        cad: 'CAD', aud: 'AUD', sgd: 'SGD', aed: 'AED', chf: 'CHF', cny: 'CNY'
      };
      return m[tok.toLowerCase()] || tok.toUpperCase();
    };
    const fxMatch = raw.match(/(\d+(?:\.\d+)?)?\s*\b(usd|inr|eur|gbp|jpy|cad|aud|sgd|aed|chf|cny|dollar|rupee|rupees|euro|pound|yen)\b\s*(?:to|in|into|vs|\/)\s*\b(usd|inr|eur|gbp|jpy|cad|aud|sgd|aed|chf|cny|dollar|rupee|rupees|euro|pound|yen)\b/i);
    if (fxMatch || /\b(?:exchange\s+rate|forex|fx\s+rate|currency\s+rate)\b/i.test(lower)) {
      const amount = fxMatch && fxMatch[1] ? parseFloat(fxMatch[1]) : 1;
      const base = fxMatch ? aliasCur(fxMatch[2]) : 'USD';
      const target = fxMatch ? aliasCur(fxMatch[3]) : 'INR';
      try {
        const res = await this._fetchWithRetry('exchangerate_api', `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {}, { timeoutMs: 5500, maxRetries: 1 });
        const data = await res.json();
        const rate = data.rates && data.rates[target];
        if (rate) {
          const converted = Number((amount * rate).toFixed(4));
          const updatedAt = data.time_last_update_utc || new Date().toISOString();
          return {
            success: true,
            category: 'FOREX',
            provider: 'exchangerate_api',
            base,
            target,
            amount,
            rate,
            convertedValue: converted,
            publishedAt: updatedAt,
            retrievedAt: new Date().toISOString(),
            sources: [{ title: `ExchangeRate Open FX (${base}/${target})`, url: `https://open.er-api.com/v6/latest/${base}`, publishedAt: updatedAt }],
            durationMs: Date.now() - t0,
            summary: `Live exchange rate: ${amount} ${base} = ${converted} ${target} (1 ${base} = ${rate} ${target}; updated ${updatedAt}). Source: [ExchangeRate-API](https://open.er-api.com/v6/latest/${base})`
          };
        }
      } catch (_) {}
    }

    // 2. Cryptocurrency check
    const cryptoMap = {
      bitcoin: 'bitcoin', btc: 'bitcoin',
      ethereum: 'ethereum', eth: 'ethereum',
      solana: 'solana', sol: 'solana',
      dogecoin: 'dogecoin', doge: 'dogecoin',
      cardano: 'cardano', ada: 'cardano',
      ripple: 'ripple', xrp: 'ripple',
      bnb: 'binancecoin'
    };
    for (const [kw, coinId] of Object.entries(cryptoMap)) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
        try {
          const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,inr&include_24hr_change=true&include_last_updated_at=true`;
          const res = await this._fetchWithRetry('coingecko', url, {}, { timeoutMs: 5500, maxRetries: 1 });
          const data = await res.json();
          const entry = data[coinId];
          if (entry && entry.usd !== undefined) {
            const change24 = entry.usd_24h_change !== undefined ? Number(entry.usd_24h_change).toFixed(2) : null;
            const updatedIso = entry.last_updated_at ? new Date(entry.last_updated_at * 1000).toISOString() : new Date().toISOString();
            const coinUrl = `https://www.coingecko.com/en/coins/${coinId}`;
            return {
              success: true,
              category: 'CRYPTO',
              provider: 'coingecko',
              asset: coinId,
              priceUsd: entry.usd,
              priceInr: entry.inr || null,
              change24hPercent: change24 ? Number(change24) : null,
              publishedAt: updatedIso,
              retrievedAt: new Date().toISOString(),
              sources: [{ title: `CoinGecko ${coinId.toUpperCase()}`, url: coinUrl, publishedAt: updatedIso }],
              durationMs: Date.now() - t0,
              summary: `Live ${coinId} price: $${Number(entry.usd).toLocaleString('en-US')} USD${entry.inr ? ` (₹${Number(entry.inr).toLocaleString('en-IN')} INR)` : ''}${change24 !== null ? `, 24h change: ${change24}%` : ''} as of ${updatedIso}. Source: [CoinGecko](${coinUrl})`
            };
          }
        } catch (_) {}
      }
    }

    // 3. Equities, Indices & Commodities via Yahoo Finance
    const symbolAliases = {
      apple: 'AAPL', aapl: 'AAPL',
      microsoft: 'MSFT', msft: 'MSFT',
      google: 'GOOGL', alphabet: 'GOOGL', googl: 'GOOGL',
      amazon: 'AMZN', amzn: 'AMZN',
      nvidia: 'NVDA', nvda: 'NVDA',
      tesla: 'TSLA', tsla: 'TSLA',
      meta: 'META',
      's&p 500': '^GSPC', sp500: '^GSPC',
      nasdaq: '^IXIC',
      dow: '^DJI',
      nifty: '^NSEI',
      sensex: '^BSESN',
      gold: 'GC=F',
      silver: 'SI=F',
      'crude oil': 'CL=F', oil: 'CL=F'
    };
    let symbol = null;
    for (const [kw, sym] of Object.entries(symbolAliases)) {
      if (lower.includes(kw)) { symbol = sym; break; }
    }
    if (!symbol) {
      const tickerMatch = raw.match(/\b([A-Z]{2,5})\b/);
      if (tickerMatch && !['USD', 'INR', 'EUR', 'GBP', 'API', 'NEWS'].includes(tickerMatch[1])) {
        symbol = tickerMatch[1];
      }
    }
    if (symbol) {
      try {
        const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
        const res = await this._fetchWithRetry('yahoo_finance', yUrl, {}, { timeoutMs: 6000, maxRetries: 1 });
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta && meta.regularMarketPrice !== undefined) {
          const price = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose || meta.previousClose || price;
          const pct = prevClose ? (((price - prevClose) / prevClose) * 100).toFixed(2) : null;
          const marketTime = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString();
          const pageUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
          return {
            success: true,
            category: 'EQUITY_INDEX',
            provider: 'yahoo_finance',
            symbol: meta.symbol || symbol,
            currency: meta.currency || 'USD',
            price,
            previousClose: prevClose,
            changePercent: pct ? Number(pct) : null,
            exchange: meta.exchangeName || null,
            publishedAt: marketTime,
            retrievedAt: new Date().toISOString(),
            sources: [{ title: `Yahoo Finance (${meta.symbol || symbol})`, url: pageUrl, publishedAt: marketTime }],
            durationMs: Date.now() - t0,
            summary: `Live market quote for ${meta.symbol || symbol}: ${price} ${meta.currency || 'USD'}${pct !== null ? ` (${Number(pct) >= 0 ? '+' : ''}${pct}%)` : ''} as of ${marketTime}. Source: [Yahoo Finance](${pageUrl})`
          };
        }
      } catch (_) {}
    }

    return {
      success: false,
      query: raw,
      durationMs: Date.now() - t0,
      error: 'No matching live market symbol or currency pair succeeded via configured finance providers.'
    };
  }

  // ===========================================================================
  // UNIVERSAL MULTI-PROVIDER WEB SEARCH (with automatic failover)
  // ===========================================================================

  async searchLiveWeb(query, maxResultsOrOptions = 5) {
    this._assertNotEmergencyStopped();
    const rawQ = String(query || '').trim();
    if (!rawQ) throw new Error('Search query is required.');

    const opts = typeof maxResultsOrOptions === 'object' ? maxResultsOrOptions : { maxResults: maxResultsOrOptions };
    const maxResults = Math.max(1, Math.min(12, Number(opts.maxResults || 5)));
    const cacheKey = `search_${rawQ.toLowerCase()}_${maxResults}_${opts.category || 'general'}`;
    if (!opts.fresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
        return { ...cached.data, cached: true };
      }
    }

    const t0 = Date.now();
    const results = [];
    const providersAttempted = [];
    const providersSucceeded = [];
    const providerErrors = {};

    const addResults = (list = []) => {
      for (const item of list) {
        if (!item || !item.url) continue;
        const norm = item.url.replace(/#.*$/, '').trim();
        if (results.some(existing => existing.url.replace(/#.*$/, '').trim() === norm)) continue;
        results.push(item);
      }
    };

    // 1. Primary API Providers (if API keys exist and healthy/usable)
    const wantsGoogleGrounding = Boolean(
      opts.provider === 'google' ||
      opts.preferGoogle ||
      /\b(?:google(?:\s+search)?|search\s+google|google\s+grounding)\b/i.test(rawQ) ||
      (process.env.GEMINI_API_KEY && (opts.multiSource || results.length < maxResults))
    );

    if (wantsGoogleGrounding && process.env.GEMINI_API_KEY) {
      providersAttempted.push('google_search_grounding');
      try {
        const gHits = await this._searchGoogleGrounding(rawQ, maxResults);
        if (gHits.length > 0) {
          providersSucceeded.push('google_search_grounding');
          addResults(gHits);
        }
      } catch (err) {
        providerErrors.google_search_grounding = err.message;
      }
    }

    for (const [id, fn] of [
      ['tavily', () => this._searchTavily(rawQ, maxResults)],
      ['brave_search', () => this._searchBrave(rawQ, maxResults)],
      ['serper', () => this._searchSerper(rawQ, maxResults)]
    ]) {
      if (results.length >= maxResults && !opts.multiSource) break;
      if (!apiIntegrationsManagerInstance.isProviderUsable(id) || !apiIntegrationsManagerInstance.getProviderKey(id)) continue;
      providersAttempted.push(id);
      try {
        const hits = await fn();
        if (hits.length > 0) {
          providersSucceeded.push(id);
          addResults(hits);
        }
      } catch (err) {
        providerErrors[id] = err.message;
      }
    }

    // 2. Specialized domain search enrichment (GitHub / News / arXiv / Wikipedia)
    const lowerQ = rawQ.toLowerCase();
    const wantsGitHub = /\b(github|repo|repository|open[\s-]?source|npm|package|library|framework|documentation|docs)\b/i.test(lowerQ);
    const wantsNews = /\b(news|headline|breaking|latest|today|update|world\s+events|current\s+events)\b/i.test(lowerQ);
    const wantsSci = /\b(arxiv|paper|research\s+paper|study|journal|physics|quantum|transformer|scientific)\b/i.test(lowerQ);

    if (wantsGitHub && apiIntegrationsManagerInstance.isProviderUsable('github_api')) {
      providersAttempted.push('github_api');
      try {
        const gh = await this.searchGitHub(rawQ, Math.min(4, maxResults));
        if (gh.results.length > 0) {
          providersSucceeded.push('github_api');
          addResults(gh.results);
        }
      } catch (err) {
        providerErrors.github_api = err.message;
      }
    }

    if (wantsSci && apiIntegrationsManagerInstance.isProviderUsable('arxiv')) {
      providersAttempted.push('arxiv');
      try {
        const { advancedResearchEngineInstance } = require('../advancedResearchEngine.js');
        const ax = await advancedResearchEngineInstance.searchScientificPapers(rawQ, Math.min(3, maxResults));
        if (ax && Array.isArray(ax.papers) && ax.papers.length > 0) {
          providersSucceeded.push('arxiv');
          addResults(ax.papers.map(p => ({
            title: sanitizeUntrusted(p.title).cleanText,
            snippet: sanitizeUntrusted(p.summary).cleanText,
            url: p.sourceUrl,
            source: 'arXiv',
            publishedAt: p.publishedDate || null,
            provider: 'arxiv'
          })));
        }
      } catch (err) {
        providerErrors.arxiv = err.message;
      }
    }

    // 3. Zero-key DuckDuckGo HTML Organic Web Search (Primary fallback / general web index)
    if ((results.length < maxResults || opts.multiSource) && apiIntegrationsManagerInstance.isProviderUsable('duckduckgo_html')) {
      providersAttempted.push('duckduckgo_html');
      try {
        const ddgHits = await this._searchDuckDuckGoHtml(rawQ, maxResults);
        if (ddgHits.length > 0) {
          providersSucceeded.push('duckduckgo_html');
          addResults(ddgHits);
        }
      } catch (err) {
        providerErrors.duckduckgo_html = err.message;
      }
    }

    // 4. Wikipedia Knowledge + Search API (for multi-source corroboration & encyclopedic facts)
    if ((results.length < maxResults || opts.multiSource) && apiIntegrationsManagerInstance.isProviderUsable('wikipedia')) {
      providersAttempted.push('wikipedia');
      try {
        const wikiHits = await this._searchWikipedia(rawQ, Math.min(3, maxResults));
        if (wikiHits.length > 0) {
          providersSucceeded.push('wikipedia');
          addResults(wikiHits);
        }
      } catch (err) {
        providerErrors.wikipedia = err.message;
      }
    }

    // 5. DuckDuckGo Instant Answer JSON (supplemental when sparse)
    if (results.length < 2 && apiIntegrationsManagerInstance.isProviderUsable('duckduckgo')) {
      providersAttempted.push('duckduckgo');
      try {
        const iaHits = await this._searchDuckDuckGoInstant(rawQ, 2);
        if (iaHits.length > 0) {
          providersSucceeded.push('duckduckgo');
          addResults(iaHits);
        }
      } catch (err) {
        providerErrors.duckduckgo = err.message;
      }
    }

    // 6. Google News RSS (if news intent or still < 2 hits)
    if ((wantsNews || results.length < 2) && apiIntegrationsManagerInstance.isProviderUsable('google_news_rss')) {
      providersAttempted.push('google_news_rss');
      try {
        const news = await this.getLiveNews(rawQ, Math.min(4, maxResults), { fresh: opts.fresh });
        if (news.success && news.articles.length > 0) {
          providersSucceeded.push('google_news_rss');
          addResults(news.articles.map(a => ({
            title: a.headline || a.title,
            snippet: a.summary || a.snippet || `Published by ${a.source || a.publisher} (${a.publishedDisplay || a.publishedAt || 'Recent'})`,
            url: a.url || a.link,
            source: a.source || a.publisher,
            publishedAt: a.publishedAt,
            provider: news.providerUsed || 'google_news_rss'
          })));
        }
      } catch (err) {
        providerErrors.google_news_rss = err.message;
      }
    }

    // 7. Playwright Browser Search Fallback (when all HTTP search providers failed/returned empty)
    if ((results.length === 0 || opts.preferBrowser) && opts.allowBrowserFallback !== false) {
      providersAttempted.push('playwright_browser');
      try {
        const browserHits = await this._searchViaBrowser(rawQ, maxResults);
        if (browserHits.length > 0) {
          providersSucceeded.push('playwright_browser');
          addResults(browserHits);
        }
      } catch (err) {
        providerErrors.playwright_browser = err.message;
      }
    }

    const boundedResults = results.slice(0, maxResults);
    const success = boundedResults.length > 0;

    if (!success) {
      const anyNetErr = Object.values(providerErrors).some(msg => /fetch|ENOTFOUND|ECONN|network|timeout|abort/i.test(String(msg)));
      if (anyNetErr && this.state.internetConnected) {
        await this.checkInternetConnectivity({ timeoutMs: 2500 }).catch(() => {});
      }
    }

    const payload = {
      success,
      found: success,
      offline: !this.state.internetConnected && !success,
      query: rawQ,
      count: boundedResults.length,
      results: boundedResults,
      providersAttempted: Array.from(new Set(providersAttempted)),
      providersSucceeded: Array.from(new Set(providersSucceeded)),
      providerErrors,
      retrievedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      summary: success
        ? `Found ${boundedResults.length} verified web result(s) for "${rawQ}" (${Array.from(new Set(providersSucceeded)).join(', ')}):\n` +
          boundedResults.map(r => `• **${r.title}** (${r.source}${r.publishedAt ? `, ${r.publishedAt}` : ''}): ${String(r.snippet || '').slice(0, 180)} — [Link](${r.url})`).join('\n')
        : `No live web results could be retrieved for "${rawQ}". Providers attempted: ${Array.from(new Set(providersAttempted)).join(', ') || 'none'}. Details: ${Object.entries(providerErrors).map(([k, v]) => `${k}: ${v}`).join('; ') || 'Connectivity or upstream failure'}.`
    };

    if (success) {
      this.cache.set(cacheKey, { timestamp: Date.now(), data: payload });
    }
    return payload;
  }

  // ===========================================================================
  // WEBPAGE, ONLINE PDF & OUTGOING LINK RETRIEVAL (with SSRF, Robots & Browser Fallback)
  // ===========================================================================

  async fetchWebArticle(targetUrl, options = {}) {
    this._assertNotEmergencyStopped();
    const rawUrl = String(targetUrl || '').trim();
    const validation = browserAutomationEngineInstance.validateUrl(rawUrl, {
      allowLocalhost: Boolean(options.allowLocalhost),
      allowPrivateNetworks: Boolean(options.allowPrivateNetworks)
    });
    if (!validation.valid) {
      return {
        success: false,
        url: rawUrl,
        securityBlocked: true,
        error: validation.reason,
        summary: `Blocked unsafe URL "${rawUrl}": ${validation.reason}`
      };
    }

    // Respect robots.txt unless disabled in local fixture tests
    if (options.checkRobots !== false) {
      const robots = await this._checkRobotsPolicy(validation.parsedUrl);
      if (!robots.allowed) {
        return {
          success: false,
          url: validation.parsedUrl,
          blockedByRobots: true,
          error: `Disallowed by site robots.txt (${robots.rule})`,
          summary: `Skipped "${validation.parsedUrl}" in respect of robots.txt policy (Disallow: ${robots.rule}).`
        };
      }
    }

    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
      const res = await this._fetch(validation.parsedUrl, {
        headers: DEFAULT_HEADERS,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.status === 401 || res.status === 403 || res.status === 402 || res.status === 451) {
        // Check if browser fallback helps on soft bot challenge; never bypass login/paywall
        if (options.useBrowserFallback !== false && res.status === 403) {
          const browserTry = await this._fetchViaPlaywright(validation.parsedUrl, options).catch(() => null);
          if (browserTry && browserTry.success && !browserTry.accessRestricted) {
            return browserTry;
          }
        }
        return {
          success: false,
          url: validation.parsedUrl,
          accessRestricted: true,
          httpStatus: res.status,
          error: `Target page restricted access (HTTP ${res.status}); credentials or access walls are not bypassed.`,
          summary: `Access restricted on "${validation.parsedUrl}" (HTTP ${res.status}). VISION respects authentication and paywall restrictions.`
        };
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} returned by target URL`);
      }

      const contentType = String(res.headers?.get ? res.headers.get('content-type') || '' : '').toLowerCase();
      const lastModified = res.headers?.get ? res.headers.get('last-modified') || null : null;

      // Handle Online PDF Documents cleanly via DocumentIntelligenceEngine
      if (options.expectPdf || contentType.includes('application/pdf') || /\.pdf(?:\?|$)/i.test(validation.parsedUrl)) {
        const arrBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrBuf);
        if (buf.length > MAX_PDF_BYTES) {
          throw new Error(`PDF exceeds safety limit of ${Math.round(MAX_PDF_BYTES / (1024 * 1024))}MB.`);
        }
        if (!buf.slice(0, 8).toString('binary').startsWith('%PDF-')) {
          throw new Error('Response does not contain a valid %PDF- signature.');
        }

        const safeName = `web_pdf_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.pdf`;
        const savedPath = path.join(DOWNLOADS_DIR, safeName);
        fs.writeFileSync(savedPath, buf);

        let parsed = { pagesCount: 0, fullText: '', title: path.basename(new URL(validation.parsedUrl).pathname) || 'Online PDF' };
        try {
          parsed = documentIntelligenceEngineInstance.parsePdfDocument(savedPath);
        } catch (pdfErr) {
          parsed = { pagesCount: 0, fullText: '', parseWarning: pdfErr.message };
        }

        const rawPdfText = parsed.fullText || (Array.isArray(parsed.pages) ? parsed.pages.map(p => p.text).join('\n') : '');
        const san = sanitizeUntrusted(rawPdfText);
        return {
          success: true,
          isPdf: true,
          url: validation.parsedUrl,
          title: sanitizeUntrusted(parsed.title || path.basename(new URL(validation.parsedUrl).pathname) || 'PDF Document').cleanText,
          savedPath,
          sizeBytes: buf.length,
          pageCount: parsed.pagesCount || (parsed.pages ? parsed.pages.length : 1),
          publishedAt: lastModified,
          retrievedAt: new Date().toISOString(),
          textSample: san.cleanText.slice(0, 4000),
          untrustedPayload: san.untrustedPayload.slice(0, 4200),
          totalLength: san.cleanText.length,
          hasThreats: san.hasThreats,
          durationMs: Date.now() - t0,
          summary: `Retrieved PDF "${validation.parsedUrl}" (${parsed.pagesCount || 1} pages, ${san.cleanText.length} extracted chars).`
        };
      }

      // Handle HTML / Plain Text / JSON Documents
      const rawHtml = (await res.text()).slice(0, MAX_HTML_BYTES);
      const extracted = this._parseHtmlDocument(rawHtml, validation.parsedUrl, lastModified);

      // Detect soft paywall / verification wall
      if (/\b(?:please subscribe to read|sign in to continue reading|verify you are human|enable cookies and javascript to continue)\b/i.test(extracted.cleanText) && extracted.cleanText.length < 800) {
        return {
          success: false,
          url: validation.parsedUrl,
          accessRestricted: true,
          error: 'Target page displays a login, anti-bot, or subscription gate.',
          summary: `Unable to read "${validation.parsedUrl}" completely due to an access/subscription wall.`
        };
      }

      // Dynamic JS rendering fallback via Playwright if HTML looks like a thin SPA shell
      if (options.useBrowserFallback !== false && extracted.cleanText.length < 200 && /id=["'](?:root|app|__next)["']/i.test(rawHtml)) {
        const rendered = await this._fetchViaPlaywright(validation.parsedUrl, options).catch(() => null);
        if (rendered && rendered.success && rendered.totalLength > extracted.cleanText.length) {
          return rendered;
        }
      }

      return {
        success: true,
        isPdf: false,
        url: extracted.canonicalUrl || validation.parsedUrl,
        title: extracted.title,
        author: extracted.author,
        publishedAt: extracted.publishedAt,
        retrievedAt: new Date().toISOString(),
        textSample: extracted.cleanText.slice(0, 4000),
        untrustedPayload: extracted.untrustedPayload.slice(0, 4200),
        totalLength: extracted.cleanText.length,
        links: extracted.links,
        hasThreats: extracted.hasThreats,
        threatsDetected: extracted.threatsDetected,
        method: 'http_fetch',
        durationMs: Date.now() - t0,
        summary: `Retrieved article "${extracted.title}" (${extracted.cleanText.length} characters${extracted.publishedAt ? `, published ${extracted.publishedAt}` : ''}).`
      };
    } catch (err) {
      // Try Playwright fallback once on transient HTTP fetch errors when enabled
      if (options.useBrowserFallback !== false && !options.expectPdf && !/EMERGENCY_STOP|Unsafe URL/i.test(err.message)) {
        const rendered = await this._fetchViaPlaywright(validation.parsedUrl, options).catch(() => null);
        if (rendered && rendered.success) return rendered;
      }
      errorDiagnostics.record(err, { subsystem: 'web_article_fetch', url: validation.parsedUrl });
      return {
        success: false,
        url: validation.parsedUrl,
        error: err.message,
        durationMs: Date.now() - t0,
        summary: `Unable to retrieve webpage "${validation.parsedUrl}": ${err.message}`
      };
    }
  }

  _parseHtmlDocument(rawHtml, baseUrl, httpLastModified = null) {
    const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaTitleMatch = rawHtml.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const rawTitle = metaTitleMatch ? metaTitleMatch[1] : (titleMatch ? titleMatch[1] : baseUrl);
    const title = sanitizeUntrusted(stripTags(rawTitle)).cleanText || baseUrl;

    const pubPatterns = [
      /<meta[^>]+(?:property|name)=["'](?:article:published_time|pubdate|publishdate|date|DC\.date\.issued|parsely-pub-date)["'][^>]+content=["']([^"']+)["']/i,
      /"datePublished"\s*:\s*"([^"]+)"/i,
      /<time[^>]+datetime=["']([^"']+)["']/i
    ];
    let publishedAt = null;
    for (const re of pubPatterns) {
      const m = rawHtml.match(re);
      if (m && m[1]) { publishedAt = m[1].trim(); break; }
    }
    if (!publishedAt && httpLastModified) publishedAt = httpLastModified;

    const authorMatch = rawHtml.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i);
    const author = authorMatch ? sanitizeUntrusted(decodeHtmlEntities(authorMatch[1])).cleanText : null;

    const canonMatch = rawHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    let canonicalUrl = null;
    if (canonMatch && canonMatch[1]) {
      try { canonicalUrl = new URL(canonMatch[1], baseUrl).href; } catch (_) {}
    }

    // Prefer <article> or <main> text if substantive, otherwise full cleaned body
    const mainMatch = rawHtml.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i);
    const mainText = mainMatch ? stripTags(mainMatch[1]) : '';
    const fullText = stripTags(rawHtml);
    const selectedText = mainText.length >= 250 ? mainText : fullText;
    const sanitized = sanitizeUntrusted(selectedText);

    // Extract clean outgoing links for multi-site investigation
    const links = [];
    const seen = new Set();
    const linkRegex = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let lMatch;
    while ((lMatch = linkRegex.exec(rawHtml)) !== null && links.length < 12) {
      const hrefRaw = decodeHtmlEntities(lMatch[1].trim());
      if (/^(?:javascript:|mailto:|tel:)/i.test(hrefRaw)) continue;
      try {
        const resolved = new URL(hrefRaw, baseUrl).href;
        if (!/^https?:\/\//i.test(resolved)) continue;
        if (resolved === baseUrl || seen.has(resolved)) continue;
        const label = sanitizeUntrusted(stripTags(lMatch[2])).cleanText;
        if (label.length < 4) continue;
        seen.add(resolved);
        links.push({ url: resolved, title: label.slice(0, 120), domain: normalizeDomain(resolved) });
      } catch (_) {}
    }

    return {
      title,
      author,
      publishedAt,
      canonicalUrl,
      cleanText: sanitized.cleanText,
      untrustedPayload: sanitized.untrustedPayload,
      hasThreats: sanitized.hasThreats,
      threatsDetected: sanitized.threatsDetected,
      links
    };
  }

  async _fetchViaPlaywright(targetUrl, options = {}) {
    this._assertNotEmergencyStopped();
    const t0 = Date.now();
    let sessionId = null;
    try {
      const opened = await browserAutomationEngineInstance.openSession({ headless: true, timeout: 12000 });
      sessionId = opened.sessionId;
      const nav = await browserAutomationEngineInstance.navigate(sessionId, targetUrl, {
        allowLocalhost: Boolean(options.allowLocalhost),
        allowPrivateNetworks: Boolean(options.allowPrivateNetworks),
        timeout: 15000
      });
      let ext = await browserAutomationEngineInstance.extractText(sessionId, 'main', { timeout: 4000 }).catch(() => null);
      if (!ext || ext.characterCount < 150) {
        ext = await browserAutomationEngineInstance.extractText(sessionId, 'body', { timeout: 5000 });
      }
      const sess = browserAutomationEngineInstance._getSession(sessionId);
      const links = await sess.page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href^="http"]')).slice(0, 10).map(a => ({
          url: a.href,
          title: (a.innerText || '').trim().slice(0, 120)
        })).filter(x => x.title.length >= 4);
      }).catch(() => []);

      return {
        success: Boolean(ext && ext.characterCount > 0),
        isPdf: false,
        url: nav.url || targetUrl,
        title: sanitizeUntrusted(nav.title || targetUrl).cleanText,
        publishedAt: null,
        retrievedAt: new Date().toISOString(),
        textSample: String(ext.text || '').slice(0, 4000),
        untrustedPayload: String(ext.untrustedPayload || '').slice(0, 4200),
        totalLength: ext.characterCount || 0,
        links,
        hasThreats: Boolean(ext.hasThreats),
        threatsDetected: ext.threatsDetected || [],
        method: 'playwright_browser',
        durationMs: Date.now() - t0,
        summary: `Rendered and extracted "${nav.title || targetUrl}" (${ext.characterCount} chars) via Playwright.`
      };
    } finally {
      if (sessionId) {
        await browserAutomationEngineInstance.closeSession(sessionId).catch(() => {});
      }
    }
  }

  // ===========================================================================
  // AUTONOMOUS MULTI-SOURCE RESEARCH, INSPECTION, FOLLOW-LINKS & CROSS-CHECKING
  // ===========================================================================

  async autonomousResearch(query, options = {}) {
    this._assertNotEmergencyStopped();
    const rawQ = String(query || '').trim();
    if (!rawQ) throw new Error('Research query cannot be empty.');

    this.state.activeResearchCount += 1;
    const t0 = Date.now();

    try {
      const lower = rawQ.toLowerCase();
      const maxSources = Math.max(2, Math.min(8, Number(options.maxSources || 5)));
      const inspectLimit = Math.max(1, Math.min(4, Number(options.inspectPages || 3)));

      // 1. Check direct URL / Online PDF first
      const urlMatch = rawQ.match(/https?:\/\/[^\s"'<>)]+/i);
      if (urlMatch) {
        const directUrl = urlMatch[0];
        const primaryDoc = await this.fetchWebArticle(directUrl, {
          allowLocalhost: Boolean(options.allowLocalhost),
          allowPrivateNetworks: Boolean(options.allowPrivateNetworks)
        });

        const inspectedPages = primaryDoc.success ? [primaryDoc] : [];
        // Optional link following on the inspected page if requested or useful
        if (primaryDoc.success && Array.isArray(primaryDoc.links) && primaryDoc.links.length > 0 && options.followLinks !== false) {
          const nextLink = primaryDoc.links.find(l => normalizeDomain(l.url) !== normalizeDomain(directUrl)) || primaryDoc.links[0];
          if (nextLink) {
            const followed = await this.fetchWebArticle(nextLink.url, {
              allowLocalhost: Boolean(options.allowLocalhost),
              allowPrivateNetworks: Boolean(options.allowPrivateNetworks),
              timeoutMs: 5500,
              useBrowserFallback: false
            }).catch(() => null);
            if (followed && followed.success) inspectedPages.push(followed);
          }
        }

        if (!primaryDoc.success) {
          return {
            success: false,
            found: false,
            query: rawQ,
            url: directUrl,
            error: primaryDoc.error,
            summary: primaryDoc.summary,
            durationMs: Date.now() - t0
          };
        }

        const evalSources = inspectedPages.map(p => ({
          title: p.title,
          url: p.url,
          text: p.textSample,
          date: p.publishedAt || p.retrievedAt
        }));
        const verification = sourceEvaluatorInstance.crossVerifyClaim(rawQ, evalSources);

        return {
          success: true,
          found: true,
          query: rawQ,
          mode: primaryDoc.isPdf ? 'ONLINE_PDF' : 'WEBPAGE_READ',
          inspectedPagesCount: inspectedPages.length,
          inspectedPages: inspectedPages.map(p => ({
            title: p.title,
            url: p.url,
            isPdf: p.isPdf,
            pageCount: p.pageCount || null,
            publishedAt: p.publishedAt || null,
            textSample: p.textSample,
            totalLength: p.totalLength
          })),
          sources: evalSources,
          verification,
          retrievedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
          summary: `${primaryDoc.summary}\n\nExcerpt:\n${primaryDoc.textSample.slice(0, 1200)}\n\nSources:\n` +
            inspectedPages.map((p, i) => `${i + 1}. [${p.title}](${p.url})${p.publishedAt ? ` (${p.publishedAt})` : ''}`).join('\n')
        };
      }

      // 2. Specialized Weather check
      if (/\b(?:weather|temperature|forecast|rain|humidity)\b/i.test(lower) && !/\b(?:compare|news|research|paper|article)\b/i.test(lower)) {
        const cityMatch = rawQ.match(/(?:weather|temperature|forecast|rain)\s+(?:in|for|at|of)\s+([a-zA-Z\s,]+?)(?:\?|$)/i);
        const targetCity = cityMatch ? cityMatch[1].trim() : null;
        const w = await weatherServiceInstance.getWeather(targetCity);
        if (w && w.status !== 'error') {
          return {
            success: true,
            found: true,
            query: rawQ,
            mode: 'LIVE_WEATHER',
            weather: w,
            sources: [{ title: `Open-Meteo Weather (${w.location})`, url: 'https://open-meteo.com', publishedAt: w.retrievedAt }],
            retrievedAt: new Date().toISOString(),
            durationMs: Date.now() - t0,
            summary: `${w.summary} (Source: [Open-Meteo](https://open-meteo.com), retrieved ${w.retrievedAt})`
          };
        }
      }

      // 3. Specialized Finance / Crypto / FX / Commodity check
      if (/\b(?:price|stock|share\s+price|market\s+cap|bitcoin|btc|ethereum|eth|solana|crypto|exchange\s+rate|forex|usd\s+to\s+inr|eur\s+to|gold\s+price|crude\s+oil|nifty|sensex|s&p\s*500)\b/i.test(lower) && !/\bnews\b/i.test(lower)) {
        const fin = await this.getFinancialData(rawQ);
        if (fin && fin.success) {
          return { ...fin, found: true, mode: 'LIVE_FINANCE' };
        }
      }

      // 4. Multi-Provider Web Search across independent providers
      const searchRes = await this.searchLiveWeb(rawQ, {
        maxResults: maxSources,
        multiSource: true,
        fresh: Boolean(options.fresh),
        allowBrowserFallback: options.allowBrowserFallback !== false
      });

      if (!searchRes.success || searchRes.results.length === 0) {
        return {
          success: false,
          found: false,
          offline: searchRes.offline,
          query: rawQ,
          providersAttempted: searchRes.providersAttempted,
          providerErrors: searchRes.providerErrors,
          sources: [],
          durationMs: Date.now() - t0,
          summary: searchRes.summary
        };
      }

      // 5. Open & Inspect Top Diverse Domains (skipping slow redirect wrappers where possible)
      const candidatesToInspect = [];
      const seenDomains = new Set();
      for (const hit of searchRes.results) {
        if (!hit.url) continue;
        const dom = normalizeDomain(hit.url);
        // News RSS google redirect URLs often JS-redirect; prefer direct web domains first, fallback if needed
        if (dom === 'news.google.com') continue;
        if (seenDomains.has(dom)) continue;
        seenDomains.add(dom);
        candidatesToInspect.push(hit);
        if (candidatesToInspect.length >= inspectLimit) break;
      }

      const inspectedPages = [];
      if (candidatesToInspect.length > 0 && options.inspectPages !== 0) {
        const fetches = await Promise.allSettled(
          candidatesToInspect.map(hit =>
            this.fetchWebArticle(hit.url, { timeoutMs: 5500, useBrowserFallback: false })
          )
        );
        for (const f of fetches) {
          if (f.status === 'fulfilled' && f.value && f.value.success && f.value.textSample) {
            inspectedPages.push(f.value);
          }
        }
      }

      // Follow 1 outgoing corroborating link if we only inspected 1 page cleanly
      if (inspectedPages.length === 1 && inspectedPages[0].links && inspectedPages[0].links.length > 0 && options.followLinks !== false) {
        const extLink = inspectedPages[0].links.find(l => normalizeDomain(l.url) !== normalizeDomain(inspectedPages[0].url));
        if (extLink) {
          const secondary = await this.fetchWebArticle(extLink.url, { timeoutMs: 5000, useBrowserFallback: false }).catch(() => null);
          if (secondary && secondary.success && secondary.textSample) {
            inspectedPages.push(secondary);
          }
        }
      }

      // 6. Cross-Check Claims & Detect Contradictions using SourceEvaluator
      const combinedSources = [];
      const combinedSeen = new Set();
      for (const p of inspectedPages) {
        combinedSeen.add(p.url);
        combinedSources.push({
          title: p.title,
          url: p.url,
          sourceName: normalizeDomain(p.url),
          text: p.textSample.slice(0, 1200),
          date: p.publishedAt || p.retrievedAt,
          publishedAt: p.publishedAt || null
        });
      }
      for (const r of searchRes.results) {
        if (combinedSeen.has(r.url)) continue;
        combinedSeen.add(r.url);
        combinedSources.push({
          title: r.title,
          url: r.url,
          sourceName: r.source || normalizeDomain(r.url),
          text: r.snippet,
          date: r.publishedAt || searchRes.retrievedAt,
          publishedAt: r.publishedAt || null
        });
      }

      const independentDomains = Array.from(new Set(combinedSources.map(s => normalizeDomain(s.url)).filter(d => d !== 'unknown')));
      const verification = sourceEvaluatorInstance.crossVerifyClaim(rawQ, combinedSources);
      const contradictions = sourceEvaluatorInstance.detectContradictions(
        combinedSources.map(s => ({ topic: rawQ, text: s.text, source: s.url }))
      );

      const uncertaintyNotes = [];
      if (independentDomains.length < 2) {
        uncertaintyNotes.push('Only a single independent domain returned matching evidence; cross-source certainty is limited.');
      }
      if (contradictions.length > 0) {
        uncertaintyNotes.push(`Detected ${contradictions.length} potential discrepancy/contradiction across sources.`);
      }
      if (inspectedPages.length === 0) {
        uncertaintyNotes.push('Findings rely on search snippets/feed metadata because direct article bodies were unavailable or skipped.');
      }

      const citationsMarkdown = combinedSources.slice(0, maxSources).map((s, idx) =>
        `${idx + 1}. [${s.title}](${s.url}) — ${s.sourceName}${s.publishedAt ? ` (Published: ${s.publishedAt})` : ` (Retrieved: ${searchRes.retrievedAt})`}`
      ).join('\n');

      const highlights = (inspectedPages.length > 0
        ? inspectedPages.map(p => `- **${p.title}** (${normalizeDomain(p.url)}): ${p.textSample.slice(0, 280)}...`)
        : combinedSources.slice(0, 4).map(s => `- **${s.title}** (${s.sourceName}): ${String(s.text || '').slice(0, 220)}`)
      ).join('\n');

      const summary = [
        `Live multi-source web research for **"${rawQ}"** (${combinedSources.length} source(s) across ${independentDomains.length} domain(s), ${inspectedPages.length} full page(s) inspected; Retrieved ${new Date().toISOString()}):`,
        highlights,
        uncertaintyNotes.length > 0 ? `\n**Verification & Uncertainty:** ${uncertaintyNotes.join(' ')}` : `\n**Verification:** ${verification.verdict}`,
        `\n**Sources:**\n${citationsMarkdown}`
      ].join('\n');

      return {
        success: true,
        found: true,
        query: rawQ,
        mode: 'AUTONOMOUS_MULTI_SOURCE',
        providersAttempted: searchRes.providersAttempted,
        providersSucceeded: searchRes.providersSucceeded,
        providerErrors: searchRes.providerErrors,
        independentDomainsCount: independentDomains.length,
        independentDomains,
        inspectedPagesCount: inspectedPages.length,
        inspectedPages: inspectedPages.map(p => ({
          title: p.title,
          url: p.url,
          publishedAt: p.publishedAt,
          totalLength: p.totalLength,
          textSample: p.textSample.slice(0, 1500)
        })),
        sources: combinedSources.slice(0, maxSources),
        verification,
        contradictions,
        uncertaintyNotes,
        retrievedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        summary
      };
    } catch (err) {
      errorDiagnostics.record(err, { subsystem: 'autonomous_web_research', query: rawQ });
      return {
        success: false,
        found: false,
        query: rawQ,
        error: err.message,
        durationMs: Date.now() - t0,
        summary: `Live web research for "${rawQ}" failed: ${err.message}`
      };
    } finally {
      this.state.activeResearchCount = Math.max(0, this.state.activeResearchCount - 1);
    }
  }
}

const liveWebResearchServiceInstance = new LiveWebResearchService();

module.exports = {
  LiveWebResearchService,
  liveWebResearchService: liveWebResearchServiceInstance,
  liveWebResearchServiceInstance
};
