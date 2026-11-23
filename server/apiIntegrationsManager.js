/**
 * VISION AI — Central External API Integration Manager
 * Manages credentials, connection health, rate-limiting, request quotas,
 * permitted scopes, and live connectivity tests across all 3rd-party services.
 * 
 * Never logs or exposes raw secrets in logs, reports, or frontend responses.
 * Provides real connection verification with bounded timeouts and honest error reporting.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'integrations_config.json');

// Default supported integrations definition
const SUPPORTED_INTEGRATIONS = {
  // 1. AI Model Providers
  gemini: {
    category: 'AI_MODELS',
    name: 'Google Gemini AI',
    description: 'Multimodal reasoning, STT, Vision, and code generation',
    envKey: 'GEMINI_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://generativelanguage.googleapis.com',
    scopes: ['chat', 'vision', 'audio', 'embeddings'],
    rateLimitPerMinute: 60,
    health: 'UNCONFIGURED'
  },
  openai: {
    category: 'AI_MODELS',
    name: 'OpenAI GPT-4o',
    description: 'Conversational reasoning and advanced programming',
    envKey: 'OPENAI_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://api.openai.com/v1',
    scopes: ['chat', 'code', 'vision'],
    rateLimitPerMinute: 60,
    health: 'UNCONFIGURED'
  },
  anthropic: {
    category: 'AI_MODELS',
    name: 'Anthropic Claude',
    description: 'Long-context document analysis and strategic logic',
    envKey: 'ANTHROPIC_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://api.anthropic.com/v1',
    scopes: ['chat', 'analysis'],
    rateLimitPerMinute: 50,
    health: 'UNCONFIGURED'
  },
  groq: {
    category: 'AI_MODELS',
    name: 'Groq LPU Acceleration',
    description: 'Ultra-low latency sub-200ms open-weights inference',
    envKey: 'GROQ_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    scopes: ['chat', 'fast_inference'],
    rateLimitPerMinute: 120,
    health: 'UNCONFIGURED'
  },
  ollama: {
    category: 'AI_MODELS',
    name: 'Ollama Local LLM',
    description: 'Completely offline zero-network local models (Llama 3, Mistral, Qwen)',
    envKey: 'OLLAMA_ENDPOINT',
    requiresKey: false,
    defaultEndpoint: 'http://127.0.0.1:11434',
    scopes: ['chat', 'offline'],
    rateLimitPerMinute: 1000,
    health: 'UNCONFIGURED'
  },
  deepseek: {
    category: 'AI_MODELS',
    name: 'DeepSeek Reasoner',
    description: 'Math, deep logic, and architectural analysis',
    envKey: 'DEEPSEEK_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://api.deepseek.com/v1',
    scopes: ['chat', 'reasoning'],
    rateLimitPerMinute: 60,
    health: 'UNCONFIGURED'
  },

  // 2. Web Search, News, Scientific & Developer Research
  duckduckgo: {
    category: 'SEARCH',
    name: 'DuckDuckGo Instant Answers',
    description: 'Privacy-first instant knowledge and topic summaries (zero-key required)',
    requiresKey: false,
    defaultEndpoint: 'https://api.duckduckgo.com',
    scopes: ['search_read'],
    rateLimitPerMinute: 30,
    health: 'HEALTHY'
  },
  duckduckgo_html: {
    category: 'SEARCH',
    name: 'DuckDuckGo Live Web Index',
    description: 'Live multi-domain organic web search without third-party API keys',
    requiresKey: false,
    defaultEndpoint: 'https://html.duckduckgo.com/html',
    scopes: ['web_search', 'search_read'],
    rateLimitPerMinute: 25,
    health: 'HEALTHY'
  },
  google_news_rss: {
    category: 'NEWS',
    name: 'Google News Live RSS',
    description: 'Real-time global and topic-filtered news headlines with publishers and publication timestamps (zero-key)',
    requiresKey: false,
    defaultEndpoint: 'https://news.google.com/rss/search',
    scopes: ['news_read'],
    rateLimitPerMinute: 30,
    health: 'HEALTHY'
  },
  newsapi: {
    category: 'NEWS',
    name: 'NewsAPI Global Articles',
    description: 'Structured global journalism search and breaking headlines API',
    envKey: 'NEWSAPI_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://newsapi.org/v2',
    scopes: ['news_read', 'articles_search'],
    rateLimitPerMinute: 30,
    health: 'UNCONFIGURED'
  },
  brave_search: {
    category: 'SEARCH',
    name: 'Brave Search API',
    description: 'Independent web index search and rich snippet extraction',
    envKey: 'BRAVE_SEARCH_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://api.search.brave.com/res/v1/web/search',
    scopes: ['web_search'],
    rateLimitPerMinute: 30,
    health: 'UNCONFIGURED'
  },
  tavily: {
    category: 'SEARCH',
    name: 'Tavily AI Research',
    description: 'High-accuracy search API tailored for autonomous AI agents',
    envKey: 'TAVILY_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://api.tavily.com',
    scopes: ['ai_research'],
    rateLimitPerMinute: 30,
    health: 'UNCONFIGURED'
  },
  serper: {
    category: 'SEARCH',
    name: 'Serper Google Search API',
    description: 'Structured Google Search SERP & news results API',
    envKey: 'SERPER_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://google.serper.dev/search',
    scopes: ['web_search', 'news_search'],
    rateLimitPerMinute: 30,
    health: 'UNCONFIGURED'
  },
  wikipedia: {
    category: 'SEARCH',
    name: 'Wikipedia Knowledge & Search Engine',
    description: 'Global encyclopedic full-text search, summaries, and source attributions (zero-key)',
    requiresKey: false,
    defaultEndpoint: 'https://en.wikipedia.org/api/rest_v1',
    scopes: ['encyclopedia_read', 'search_read'],
    rateLimitPerMinute: 60,
    health: 'HEALTHY'
  },
  arxiv: {
    category: 'RESEARCH',
    name: 'arXiv Scientific Repository',
    description: 'Peer-reviewed preprints, technical research papers, and PDF links (zero-key)',
    requiresKey: false,
    defaultEndpoint: 'https://export.arxiv.org/api/query',
    scopes: ['research_read', 'pdf_read'],
    rateLimitPerMinute: 20,
    health: 'HEALTHY'
  },
  github_api: {
    category: 'RESEARCH',
    name: 'GitHub Public REST API',
    description: 'Repository discovery, release tracking, and technical documentation search (zero-key / optional GITHUB_TOKEN)',
    envKey: 'GITHUB_TOKEN',
    requiresKey: false,
    defaultEndpoint: 'https://api.github.com',
    scopes: ['code_search', 'docs_read'],
    rateLimitPerMinute: 20,
    health: 'HEALTHY'
  },

  // 3. Weather Services
  open_meteo: {
    category: 'WEATHER',
    name: 'Open-Meteo Meteorological Service',
    description: 'High-precision global weather, hourly forecasts, and radar (free)',
    requiresKey: false,
    defaultEndpoint: 'https://api.open-meteo.com/v1',
    scopes: ['weather_read', 'forecast_read'],
    rateLimitPerMinute: 60,
    health: 'HEALTHY'
  },
  openweathermap: {
    category: 'WEATHER',
    name: 'OpenWeatherMap One Call',
    description: 'Severe weather alerts, air pollution, and historical climate',
    envKey: 'OPENWEATHER_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://api.openweathermap.org/data/2.5',
    scopes: ['weather_read', 'severe_alerts'],
    rateLimitPerMinute: 60,
    health: 'UNCONFIGURED'
  },

  // 4. Financial & Market Data
  coingecko: {
    category: 'FINANCE',
    name: 'CoinGecko Crypto API',
    description: 'Real-time cryptocurrency prices, market caps, and gas fees (free tier)',
    requiresKey: false,
    defaultEndpoint: 'https://api.coingecko.com/api/v3',
    scopes: ['crypto_read'],
    rateLimitPerMinute: 30,
    health: 'HEALTHY'
  },
  alphavantage: {
    category: 'FINANCE',
    name: 'Alpha Vantage Securities',
    description: 'Global equity tickers, forex exchange rates, and technical indicators',
    envKey: 'ALPHAVANTAGE_API_KEY',
    requiresKey: true,
    defaultEndpoint: 'https://www.alphavantage.co/query',
    scopes: ['stocks_read', 'forex_read'],
    rateLimitPerMinute: 15,
    health: 'UNCONFIGURED'
  },
  yahoo_finance: {
    category: 'FINANCE',
    name: 'Yahoo Finance Free Gateway',
    description: 'Real-time indices, commodities (Gold, Crude Oil), and currency rates',
    requiresKey: false,
    defaultEndpoint: 'https://query1.finance.yahoo.com/v8/finance/chart',
    scopes: ['market_read'],
    rateLimitPerMinute: 40,
    health: 'HEALTHY'
  },
  exchangerate_api: {
    category: 'FINANCE',
    name: 'ExchangeRate Open FX API',
    description: 'Live global foreign exchange rates across 150+ currencies (zero-key)',
    requiresKey: false,
    defaultEndpoint: 'https://open.er-api.com/v6/latest',
    scopes: ['forex_read'],
    rateLimitPerMinute: 30,
    health: 'HEALTHY'
  },

  // 5. Social Media Services
  twitter_x: {
    category: 'SOCIAL',
    name: 'X / Twitter API v2',
    description: 'Read user timelines and post authorized status updates',
    envKey: 'TWITTER_BEARER_TOKEN',
    requiresKey: true,
    defaultEndpoint: 'https://api.twitter.com/2',
    scopes: ['social_read', 'social_post_requires_approval'],
    rateLimitPerMinute: 15,
    health: 'UNCONFIGURED'
  },
  reddit: {
    category: 'SOCIAL',
    name: 'Reddit Data API',
    description: 'Subreddit post monitoring and developer discussions',
    envKey: 'REDDIT_CLIENT_ID',
    requiresKey: true,
    defaultEndpoint: 'https://oauth.reddit.com',
    scopes: ['reddit_read'],
    rateLimitPerMinute: 30,
    health: 'UNCONFIGURED'
  },

  // 6. Messaging Integrations
  whatsapp: {
    category: 'MESSAGING',
    name: 'WhatsApp Desktop & Local Bridge',
    description: 'Send messages, initiate voice calls, and read incoming notifications',
    requiresKey: false,
    defaultEndpoint: 'local_automation',
    scopes: ['messaging_send_requires_approval', 'call_initiate_requires_approval'],
    rateLimitPerMinute: 20,
    health: 'HEALTHY'
  },
  telegram: {
    category: 'MESSAGING',
    name: 'Telegram Bot API',
    description: 'Encrypted notification dispatch and channel announcements',
    envKey: 'TELEGRAM_BOT_TOKEN',
    requiresKey: true,
    defaultEndpoint: 'https://api.telegram.org',
    scopes: ['telegram_notify'],
    rateLimitPerMinute: 30,
    health: 'UNCONFIGURED'
  },
  discord: {
    category: 'MESSAGING',
    name: 'Discord Webhook Gateway',
    description: 'Channel alerts, rich embedded notifications, and team logs',
    envKey: 'DISCORD_WEBHOOK_URL',
    requiresKey: true,
    defaultEndpoint: 'https://discord.com/api/webhooks',
    scopes: ['discord_post'],
    rateLimitPerMinute: 30,
    health: 'UNCONFIGURED'
  },
  slack: {
    category: 'MESSAGING',
    name: 'Slack Incoming Webhooks',
    description: 'Enterprise workflow status messages and diagnostic alerts',
    envKey: 'SLACK_WEBHOOK_URL',
    requiresKey: true,
    defaultEndpoint: 'https://hooks.slack.com/services',
    scopes: ['slack_post'],
    rateLimitPerMinute: 30,
    health: 'UNCONFIGURED'
  },

  // 7. Calendar & Tasks
  google_calendar: {
    category: 'CALENDAR_TASKS',
    name: 'Google Calendar API',
    description: 'Agenda retrieval, event scheduling, and meeting reminders',
    envKey: 'GOOGLE_CALENDAR_CREDENTIALS',
    requiresKey: true,
    defaultEndpoint: 'https://www.googleapis.com/calendar/v3',
    scopes: ['calendar_read', 'calendar_write_requires_approval'],
    rateLimitPerMinute: 60,
    health: 'UNCONFIGURED'
  },
  local_tasks: {
    category: 'CALENDAR_TASKS',
    name: 'VISION Persistent Task Engine',
    description: 'Local encrypted task organizer, timers, and autonomous reminders',
    requiresKey: false,
    defaultEndpoint: 'local_store',
    scopes: ['tasks_read', 'tasks_write'],
    rateLimitPerMinute: 1000,
    health: 'HEALTHY'
  },

  // 8. Smart Home & IoT
  home_assistant: {
    category: 'SMART_HOME',
    name: 'Home Assistant Local API',
    description: 'Local smart lights, HVAC climate control, switches, and presence sensors',
    envKey: 'HOME_ASSISTANT_TOKEN',
    requiresKey: true,
    defaultEndpoint: 'http://homeassistant.local:8123/api',
    scopes: ['smart_home_control'],
    rateLimitPerMinute: 60,
    health: 'UNCONFIGURED'
  },
  philips_hue: {
    category: 'SMART_HOME',
    name: 'Philips Hue Bridge',
    description: 'Smart lighting scenes, color transitions, and room alerts',
    envKey: 'HUE_BRIDGE_IP',
    requiresKey: true,
    defaultEndpoint: 'http://hue-bridge.local/api',
    scopes: ['lighting_control'],
    rateLimitPerMinute: 30,
    health: 'UNCONFIGURED'
  }
};

class ApiIntegrationsManager {
  constructor() {
    this.integrations = JSON.parse(JSON.stringify(SUPPORTED_INTEGRATIONS));
    this.usageStats = {};
    this.rateWindows = {}; // providerId -> [timestamp, ...]
    this.customRestEndpoints = [];
    this.ensureDataDir();
    this.loadConfig();
    this.detectEnvironmentKeys();
  }

  ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('[API_INTEGRATIONS] Unable to create data directory:', e.message);
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.integrations) {
          for (const [id, cfg] of Object.entries(parsed.integrations)) {
            if (this.integrations[id]) {
              if (cfg.apiKey) this.integrations[id].apiKey = cfg.apiKey;
              if (cfg.endpoint) this.integrations[id].endpoint = cfg.endpoint;
              if (cfg.enabled !== undefined) this.integrations[id].enabled = cfg.enabled;
              if (cfg.scopes) this.integrations[id].scopes = cfg.scopes;
              if (cfg.rateLimitPerMinute) this.integrations[id].rateLimitPerMinute = cfg.rateLimitPerMinute;
            }
          }
        }
        if (Array.isArray(parsed.customRestEndpoints)) {
          this.customRestEndpoints = parsed.customRestEndpoints;
        }
        if (parsed.usageStats) {
          this.usageStats = parsed.usageStats;
        }
      }
    } catch (e) {
      console.warn('[API_INTEGRATIONS] Could not load integrations config:', e.message);
    }
  }

  saveConfig() {
    try {
      this.ensureDataDir();
      const exportData = {
        updatedAt: new Date().toISOString(),
        integrations: {},
        customRestEndpoints: this.customRestEndpoints,
        usageStats: this.usageStats
      };

      for (const [id, item] of Object.entries(this.integrations)) {
        exportData.integrations[id] = {
          enabled: item.enabled !== false,
          // Never write process.env secrets out to disk
          apiKey: item.configuredViaEnv ? '' : (item.apiKey || ''),
          endpoint: item.endpoint || item.defaultEndpoint,
          scopes: item.scopes,
          rateLimitPerMinute: item.rateLimitPerMinute
        };
      }

      fs.writeFileSync(CONFIG_FILE, JSON.stringify(exportData, null, 2), 'utf8');
    } catch (e) {
      console.error('[API_INTEGRATIONS] Failed to save integrations config:', e.message);
    }
  }

  /**
   * Auto-detect API keys already present in process.env or project .env
   */
  detectEnvironmentKeys() {
    try {
      const envPath = path.resolve(__dirname, '..', '.env');
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eq = trimmed.indexOf('=');
          if (eq !== -1) {
            const k = trimmed.slice(0, eq).trim();
            const v = trimmed.slice(eq + 1).trim().replace(/^['"](.*)['"]$/, '$1');
            if (k && !process.env[k]) process.env[k] = v;
          }
        }
      }
    } catch (_) {}

    for (const [id, item] of Object.entries(this.integrations)) {
      if (item.envKey && process.env[item.envKey]) {
        item.apiKey = process.env[item.envKey];
        item.configuredViaEnv = true;
        if (item.health === 'UNCONFIGURED') {
          item.enabled = true;
          item.health = 'HEALTHY';
        }
      } else if (!item.requiresKey && item.health === 'UNCONFIGURED') {
        item.health = 'HEALTHY';
      }
    }
  }

  getProviderKey(providerId) {
    const item = this.integrations[providerId];
    if (!item) return '';
    if (item.apiKey) return String(item.apiKey).trim();
    if (item.envKey && process.env[item.envKey]) return String(process.env[item.envKey]).trim();
    return '';
  }

  isProviderUsable(providerId) {
    const item = this.integrations[providerId];
    if (!item || item.enabled === false) return false;
    if (item.requiresKey && !this.getProviderKey(providerId)) return false;
    if (item.cooldownUntil && Date.now() < item.cooldownUntil) return false;
    if (item.health === 'AUTH_FAILED' && item.requiresKey && !item.cooldownUntil) return false;
    return true;
  }

  recordProviderOutcome(providerId, outcome = {}) {
    const item = this.integrations[providerId];
    if (!item) return null;
    const now = Date.now();
    if (!this.usageStats[providerId]) {
      this.usageStats[providerId] = { requests: 0, errors: 0, lastUsed: null, quotaRemaining: null, lastError: null };
    }
    const stats = this.usageStats[providerId];
    stats.lastUsed = new Date().toISOString();
    if (outcome.quotaRemaining !== undefined && outcome.quotaRemaining !== null) {
      stats.quotaRemaining = outcome.quotaRemaining;
    }

    if (outcome.ok) {
      item.health = 'HEALTHY';
      item.cooldownUntil = null;
      item.lastError = null;
      if (outcome.latencyMs !== undefined) item.latencyMs = outcome.latencyMs;
      item.lastCheck = new Date().toISOString();
      stats.lastError = null;
      return item.health;
    }

    stats.errors += 1;
    const status = Number(outcome.statusCode || 0);
    const errMsg = String(outcome.error || (status ? `HTTP ${status}` : 'Request failed'));
    item.lastError = errMsg;
    stats.lastError = errMsg;
    item.lastCheck = new Date().toISOString();

    if (outcome.authError || status === 401 || status === 403) {
      item.health = 'AUTH_FAILED';
      item.cooldownUntil = now + 5 * 60 * 1000;
    } else if (outcome.quotaExhausted || status === 429) {
      item.health = 'QUOTA_EXHAUSTED';
      item.cooldownUntil = now + (Number(outcome.retryAfterMs) || 3 * 60 * 1000);
    } else if (outcome.offline) {
      item.health = 'OFFLINE';
      item.cooldownUntil = now + 15 * 1000;
    } else {
      item.health = 'DEGRADED';
      item.cooldownUntil = now + 20 * 1000;
    }
    return item.health;
  }

  /**
   * Masks sensitive credentials for safe display in UI or logs
   */
  maskApiKey(key) {
    if (!key || typeof key !== 'string') return '';
    const trimmed = key.trim();
    if (trimmed.length <= 8) return '********';
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }

  /**
   * Retrieves redacted public view of all configured integrations
   */
  getIntegrationsSummary() {
    const summary = {};
    for (const [id, item] of Object.entries(this.integrations)) {
      const stats = this.usageStats[id] || { requests: 0, errors: 0, lastUsed: null };
      summary[id] = {
        id,
        category: item.category,
        name: item.name,
        description: item.description,
        requiresKey: item.requiresKey,
        isConfigured: Boolean(item.apiKey || !item.requiresKey),
        maskedKey: this.maskApiKey(item.apiKey),
        endpoint: item.endpoint || item.defaultEndpoint,
        scopes: item.scopes,
        rateLimitPerMinute: item.rateLimitPerMinute,
        health: item.health,
        lastCheck: item.lastCheck || null,
        latencyMs: item.latencyMs || null,
        stats
      };
    }

    return {
      success: true,
      count: Object.keys(summary).length,
      integrations: summary,
      customRestCount: this.customRestEndpoints.length
    };
  }

  /**
   * Sets or updates credential / settings for a specific integration
   */
  setIntegration(providerId, options = {}) {
    const item = this.integrations[providerId];
    if (!item) {
      throw new Error(`Integration provider "${providerId}" is not recognized.`);
    }

    if (options.apiKey !== undefined) {
      item.apiKey = String(options.apiKey || '').trim();
      item.health = item.apiKey ? 'HEALTHY' : (item.requiresKey ? 'UNCONFIGURED' : 'HEALTHY');
    }
    if (options.endpoint !== undefined) {
      item.endpoint = String(options.endpoint || '').trim();
    }
    if (options.enabled !== undefined) {
      item.enabled = Boolean(options.enabled);
    }
    if (Array.isArray(options.scopes)) {
      item.scopes = options.scopes;
    }
    if (options.rateLimitPerMinute && Number(options.rateLimitPerMinute) > 0) {
      item.rateLimitPerMinute = Number(options.rateLimitPerMinute);
    }

    this.saveConfig();
    return {
      success: true,
      providerId,
      name: item.name,
      isConfigured: Boolean(item.apiKey || !item.requiresKey),
      health: item.health
    };
  }

  /**
   * Revokes credentials and disables integration
   */
  revokeIntegration(providerId) {
    const item = this.integrations[providerId];
    if (!item) {
      throw new Error(`Integration provider "${providerId}" is not recognized.`);
    }

    item.apiKey = '';
    item.enabled = false;
    item.health = item.requiresKey ? 'UNCONFIGURED' : 'DEGRADED';
    this.saveConfig();

    return {
      success: true,
      providerId,
      message: `Credentials for ${item.name} have been securely revoked.`
    };
  }

  /**
   * Sliding-window rate limit checker
   */
  checkRateLimit(providerId) {
    const item = this.integrations[providerId];
    if (!item) return { allowed: true };

    const limit = item.rateLimitPerMinute || 60;
    const now = Date.now();
    const windowStart = now - 60000;

    if (!this.rateWindows[providerId]) {
      this.rateWindows[providerId] = [];
    }

    // Filter out requests older than 1 minute
    this.rateWindows[providerId] = this.rateWindows[providerId].filter(t => t > windowStart);

    if (this.rateWindows[providerId].length >= limit) {
      item.health = 'RATE_LIMITED';
      return {
        allowed: false,
        retryAfterMs: Math.max(1000, 60000 - (now - this.rateWindows[providerId][0])),
        limit
      };
    }

    this.rateWindows[providerId].push(now);

    // Record usage
    if (!this.usageStats[providerId]) {
      this.usageStats[providerId] = { requests: 0, errors: 0, lastUsed: null };
    }
    this.usageStats[providerId].requests += 1;
    this.usageStats[providerId].lastUsed = new Date().toISOString();

    return { allowed: true };
  }

  /**
   * Performs an honest live connection test to a provider endpoint
   */
  async testConnection(providerId) {
    const item = this.integrations[providerId];
    if (!item) {
      throw new Error(`Provider "${providerId}" not found.`);
    }

    if (item.requiresKey && !item.apiKey) {
      item.health = 'UNCONFIGURED';
      item.lastCheck = new Date().toISOString();
      return {
        success: false,
        providerId,
        health: 'UNCONFIGURED',
        error: `Missing API key for ${item.name}. Please configure ${item.envKey || 'API key'}.`
      };
    }

    const t0 = Date.now();

    try {
      let testResult;

      // 1. DuckDuckGo Search Test (Instant + HTML Index)
      if (providerId === 'duckduckgo') {
        const res = await fetch('https://api.duckduckgo.com/?q=Iron+Man&format=json&no_html=1', {
          headers: { 'User-Agent': 'VISION-AI/1.0' },
          signal: AbortSignal.timeout(4500)
        });
        testResult = res.ok;
      }
      else if (providerId === 'duckduckgo_html') {
        const res = await fetch('https://html.duckduckgo.com/html/?q=Node.js', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0' },
          signal: AbortSignal.timeout(5500)
        });
        const html = res.ok ? await res.text() : '';
        testResult = res.ok && html.includes('result');
      }
      else if (providerId === 'google_news_rss') {
        const res = await fetch('https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0' },
          signal: AbortSignal.timeout(5500)
        });
        testResult = res.ok;
      }
      else if (providerId === 'arxiv') {
        const res = await fetch('https://export.arxiv.org/api/query?search_query=all:transformer&max_results=1', {
          headers: { 'User-Agent': 'VISION-AI/1.0' },
          signal: AbortSignal.timeout(5500)
        });
        testResult = res.ok;
      }
      else if (providerId === 'github_api') {
        const headers = { 'User-Agent': 'VISION-AI/1.0', Accept: 'application/vnd.github+json' };
        const key = this.getProviderKey('github_api');
        if (key) headers.Authorization = `Bearer ${key}`;
        const res = await fetch('https://api.github.com/search/repositories?q=nodejs&per_page=1', {
          headers,
          signal: AbortSignal.timeout(5500)
        });
        if (res.status === 401 || res.status === 403 || res.status === 429) {
          this.recordProviderOutcome(providerId, { ok: false, statusCode: res.status, error: `GitHub HTTP ${res.status}` });
          throw new Error(`GitHub HTTP ${res.status}`);
        }
        testResult = res.ok;
      }
      else if (providerId === 'exchangerate_api') {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', {
          signal: AbortSignal.timeout(5000)
        });
        testResult = res.ok;
      }
      else if (providerId === 'brave_search') {
        const key = this.getProviderKey('brave_search');
        const res = await fetch('https://api.search.brave.com/res/v1/web/search?q=test&count=1', {
          headers: { 'Accept': 'application/json', 'X-Subscription-Token': key },
          signal: AbortSignal.timeout(5500)
        });
        if (!res.ok) {
          this.recordProviderOutcome(providerId, { ok: false, statusCode: res.status, error: `Brave Search HTTP ${res.status}` });
          throw new Error(`Brave Search HTTP ${res.status}`);
        }
        testResult = true;
      }
      else if (providerId === 'tavily') {
        const key = this.getProviderKey('tavily');
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: key, query: 'test', max_results: 1 }),
          signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) {
          this.recordProviderOutcome(providerId, { ok: false, statusCode: res.status, error: `Tavily HTTP ${res.status}` });
          throw new Error(`Tavily HTTP ${res.status}`);
        }
        testResult = true;
      }
      else if (providerId === 'serper') {
        const key = this.getProviderKey('serper');
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
          body: JSON.stringify({ q: 'test', num: 1 }),
          signal: AbortSignal.timeout(5500)
        });
        if (!res.ok) {
          this.recordProviderOutcome(providerId, { ok: false, statusCode: res.status, error: `Serper HTTP ${res.status}` });
          throw new Error(`Serper HTTP ${res.status}`);
        }
        testResult = true;
      }
      else if (providerId === 'newsapi') {
        const key = this.getProviderKey('newsapi');
        const res = await fetch('https://newsapi.org/v2/top-headlines?country=us&pageSize=1', {
          headers: { 'X-Api-Key': key },
          signal: AbortSignal.timeout(5500)
        });
        if (!res.ok) {
          this.recordProviderOutcome(providerId, { ok: false, statusCode: res.status, error: `NewsAPI HTTP ${res.status}` });
          throw new Error(`NewsAPI HTTP ${res.status}`);
        }
        testResult = true;
      }
      // 2. Wikipedia Test
      else if (providerId === 'wikipedia') {
        const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/Artificial_intelligence', {
          headers: { 'User-Agent': 'VISION-AI/1.0' },
          signal: AbortSignal.timeout(4500)
        });
        testResult = res.ok;
      }
      // 3. Open-Meteo Weather Test
      else if (providerId === 'open_meteo') {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=19.076&longitude=72.877&current_weather=true', {
          signal: AbortSignal.timeout(4500)
        });
        testResult = res.ok;
      }
      // 4. CoinGecko Finance Test
      else if (providerId === 'coingecko') {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
          signal: AbortSignal.timeout(4500)
        });
        testResult = res.ok;
      }
      // 5. Yahoo Finance Test
      else if (providerId === 'yahoo_finance') {
        const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4500)
        });
        testResult = res.ok;
      }
      // 6. Gemini Test
      else if (providerId === 'gemini') {
        const key = item.apiKey || process.env.GEMINI_API_KEY;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }
        testResult = true;
      }
      // 7. OpenAI Test
      else if (providerId === 'openai') {
        const key = item.apiKey || process.env.OPENAI_API_KEY;
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
        testResult = true;
      }
      // 8. Groq Test
      else if (providerId === 'groq') {
        const key = item.apiKey || process.env.GROQ_API_KEY;
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
        testResult = true;
      }
      // 9. Ollama Local Test
      else if (providerId === 'ollama') {
        const endpoint = item.endpoint || item.defaultEndpoint;
        const res = await fetch(`${endpoint}/api/tags`, {
          signal: AbortSignal.timeout(3000)
        });
        testResult = res.ok;
      }
      // 10. Local WhatsApp Bridge Test
      else if (providerId === 'whatsapp') {
        const { whatsappServiceInstance } = require('./desktop/whatsappService.js');
        const st = whatsappServiceInstance.getServiceStatus();
        testResult = Boolean(st && (st.installed || st.isAppInstalled || st.webBridgeAvailable));
      }
      // 11. Local Tasks Test
      else if (providerId === 'local_tasks') {
        testResult = true;
      }
      // 12. Generic HTTP Ping for other services
      else {
        const endpoint = item.endpoint || item.defaultEndpoint;
        if (endpoint && endpoint.startsWith('http')) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4500);
          const headers = {};
          if (item.apiKey) {
            headers['Authorization'] = `Bearer ${item.apiKey}`;
          }
          const res = await fetch(endpoint, { signal: controller.signal, headers }).catch(() => null);
          clearTimeout(timeout);
          testResult = res && (res.status >= 200 && res.status < 500);
        } else {
          testResult = true;
        }
      }

      const latencyMs = Date.now() - t0;
      item.health = testResult ? 'HEALTHY' : 'DEGRADED';
      item.latencyMs = latencyMs;
      item.lastCheck = new Date().toISOString();

      return {
        success: testResult,
        providerId,
        health: item.health,
        latencyMs,
        endpoint: item.endpoint || item.defaultEndpoint
      };
    } catch (err) {
      const latencyMs = Date.now() - t0;
      const msg = String(err.message || 'Connection failed');
      const statusMatch = msg.match(/\bHTTP\s+(401|403|429)\b/i);
      const code = statusMatch ? Number(statusMatch[1]) : 0;
      if (code === 401 || code === 403 || code === 429) {
        this.recordProviderOutcome(providerId, { ok: false, statusCode: code, error: msg, latencyMs });
      } else {
        this.recordProviderOutcome(providerId, { ok: false, offline: true, error: msg, latencyMs });
      }

      return {
        success: false,
        providerId,
        health: item.health,
        latencyMs,
        error: msg
      };
    }
  }

  /**
   * Tests all configured integrations concurrently with bounded timeouts
   */
  async testAllConnections() {
    const results = {};
    const promises = Object.keys(this.integrations).map(async (id) => {
      results[id] = await this.testConnection(id);
    });
    await Promise.allSettled(promises);
    return {
      success: true,
      testedAt: new Date().toISOString(),
      results
    };
  }
}

const apiIntegrationsManagerInstance = new ApiIntegrationsManager();

module.exports = {
  ApiIntegrationsManager,
  apiIntegrationsManagerInstance,
  SUPPORTED_INTEGRATIONS
};
