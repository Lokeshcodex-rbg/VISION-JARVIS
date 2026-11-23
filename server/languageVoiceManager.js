/**
 * VISION AI — Central Language & Voice Configuration Manager
 * Manages dynamic English, Hindi, and Hinglish language modes for JARVIS & ULTRON,
 * credentials inspection & validation, persistence across application restarts,
 * Fish Audio speech provider integration, and transparent local fallback routing.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const LANGUAGE_MODES = {
  ENGLISH: 'en',
  HINDI: 'hi',
  HINGLISH: 'hinglish'
};

const SUPPORTED_LANGUAGES = ['en', 'hi', 'hinglish'];

class LanguageVoiceManager {
  constructor(options = {}) {
    this.storagePath = options.storagePath || path.resolve(__dirname, '../data/language_preferences.json');
    this.envPath = options.envPath || path.resolve(__dirname, '../.env');
    
    // In-memory active language state per personality
    this.preferences = {
      JARVIS: LANGUAGE_MODES.ENGLISH,
      ULTRON: LANGUAGE_MODES.ENGLISH,
      updatedAt: new Date().toISOString()
    };

    // Cached credential verification results
    this.cachedCredentialsStatus = null;
    this.lastCredentialsCheckTime = 0;

    // Load initial configuration
    this.loadEnvKeys();
    this.loadPreferences();
  }

  loadEnvKeys() {
    try {
      if (fs.existsSync(this.envPath)) {
        const content = fs.readFileSync(this.envPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eq = trimmed.indexOf('=');
          if (eq !== -1) {
            const k = trimmed.slice(0, eq).trim();
            const v = trimmed.slice(eq + 1).trim().replace(/^['"](.*)['"]$/, '$1');
            if (k && !process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[LANG_VOICE_MGR] Could not load .env file:', e.message);
    }
  }

  loadPreferences() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (SUPPORTED_LANGUAGES.includes(parsed.JARVIS)) {
            this.preferences.JARVIS = parsed.JARVIS;
          }
          if (SUPPORTED_LANGUAGES.includes(parsed.ULTRON)) {
            this.preferences.ULTRON = parsed.ULTRON;
          }
          this.preferences.updatedAt = parsed.updatedAt || new Date().toISOString();
        }
      } else {
        this.savePreferences();
      }
    } catch (e) {
      console.warn('[LANG_VOICE_MGR] Error loading language preferences:', e.message);
    }
  }

  savePreferences() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.preferences.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.storagePath, JSON.stringify(this.preferences, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[LANG_VOICE_MGR] Error saving language preferences:', e.message);
      return false;
    }
  }

  getLanguage(personality = 'JARVIS') {
    const key = (personality || '').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';
    return this.preferences[key] || LANGUAGE_MODES.ENGLISH;
  }

  setLanguage(personality = 'JARVIS', language = 'en') {
    const key = (personality || '').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';
    const normalized = String(language || '').toLowerCase().trim();

    let target = LANGUAGE_MODES.ENGLISH;
    if (normalized === 'hi' || normalized === 'hindi') {
      target = LANGUAGE_MODES.HINDI;
    } else if (normalized === 'hinglish') {
      target = LANGUAGE_MODES.HINGLISH;
    } else if (normalized === 'en' || normalized === 'english') {
      target = LANGUAGE_MODES.ENGLISH;
    } else {
      throw new Error(`Unsupported language mode "${language}". Supported: English ('en'), Hindi ('hi'), Hinglish ('hinglish').`);
    }

    const previousLanguage = this.preferences[key];
    this.preferences[key] = target;
    this.savePreferences();

    return {
      success: true,
      personality: key,
      language: target,
      previousLanguage,
      confirmation: this.getLanguageSwitchConfirmation(key, target),
      voiceConfig: this.getVoiceConfigForPersonalityAndLanguage(key, target)
    };
  }

  getAllPreferences() {
    return {
      preferences: { ...this.preferences },
      supportedLanguages: [...SUPPORTED_LANGUAGES],
      credentials: this.getMaskedCredentialsSummary()
    };
  }

  getMaskedCredentialsSummary() {
    const enKey = process.env.JARVIS_ENGLISH_API_KEY || '';
    const hiKey = process.env.JARVIS_HINDI_API_KEY || '';

    const maskKey = (k) => {
      if (!k) return null;
      if (k.length <= 10) return '***';
      return k.slice(0, 7) + '...' + k.slice(-4);
    };

    return {
      english: {
        configured: Boolean(enKey),
        provider: enKey.startsWith('sk-fish-') ? 'fish_audio' : (enKey ? 'generic_tts' : 'none'),
        maskedKey: maskKey(enKey)
      },
      hindi: {
        configured: Boolean(hiKey),
        provider: hiKey.startsWith('sk-fish-') ? 'fish_audio' : (hiKey ? 'generic_tts' : 'none'),
        maskedKey: maskKey(hiKey)
      }
    };
  }

  /**
   * Performs real, safe API credential testing against speech providers.
   * NEVER logs or leaks keys in response payloads or console.
   */
  async verifyCredentials(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.cachedCredentialsStatus && (now - this.lastCredentialsCheckTime < 60000)) {
      return this.cachedCredentialsStatus;
    }

    const enKey = process.env.JARVIS_ENGLISH_API_KEY || '';
    const hiKey = process.env.JARVIS_HINDI_API_KEY || '';

    const checkKey = (keyVal, label) => {
      return new Promise((resolve) => {
        if (!keyVal) {
          return resolve({
            configured: false,
            provider: 'none',
            authenticated: false,
            status: 'missing',
            statusCode: null,
            message: `No ${label} speech API key configured in .env. Native fallback active.`
          });
        }

        const isFish = keyVal.startsWith('sk-fish-');
        const providerName = isFish ? 'fish_audio' : 'generic_tts';

        if (!isFish) {
          return resolve({
            configured: true,
            provider: providerName,
            authenticated: false,
            status: 'unsupported_provider',
            statusCode: null,
            message: `Key for ${label} does not use supported Fish Audio provider format (sk-fish-).`
          });
        }

        // Test non-destructive Fish Audio model lookup endpoint
        const req = https.request('https://api.fish.audio/model?self=true', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + keyVal,
            'User-Agent': 'STARK-AI/1.0'
          },
          timeout: 7000
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              // Now check TTS synthesis credit status with a minimal payload
              const testBody = JSON.stringify({ text: 'Test', format: 'mp3' });
              const ttsReq = https.request('https://api.fish.audio/v1/tts', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + keyVal,
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(testBody)
                },
                timeout: 7000
              }, (ttsRes) => {
                let ttsData = '';
                ttsRes.on('data', c => ttsData += c);
                ttsRes.on('end', () => {
                  if (ttsRes.statusCode === 200) {
                    resolve({
                      configured: true,
                      provider: 'fish_audio',
                      authenticated: true,
                      status: 'ready',
                      statusCode: 200,
                      message: `Fish Audio ${label} API key is fully authenticated with active synthesis credits.`
                    });
                  } else if (ttsRes.statusCode === 402) {
                    resolve({
                      configured: true,
                      provider: 'fish_audio',
                      authenticated: true,
                      status: 'insufficient_credits',
                      statusCode: 402,
                      message: `Fish Audio ${label} API key is valid and authenticated, but lacks API credits (HTTP 402). Local fallback active.`
                    });
                  } else {
                    resolve({
                      configured: true,
                      provider: 'fish_audio',
                      authenticated: true,
                      status: 'tts_restricted',
                      statusCode: ttsRes.statusCode,
                      message: `Fish Audio ${label} TTS returned HTTP ${ttsRes.statusCode}. Local fallback active.`
                    });
                  }
                });
              });
              ttsReq.on('error', (err) => {
                resolve({
                  configured: true,
                  provider: 'fish_audio',
                  authenticated: true,
                  status: 'network_error',
                  statusCode: null,
                  message: `Network error verifying ${label} TTS credits: ${err.message}`
                });
              });
              ttsReq.write(testBody);
              ttsReq.end();
            } else if (res.statusCode === 401 || res.statusCode === 403) {
              resolve({
                configured: true,
                provider: 'fish_audio',
                authenticated: false,
                status: 'invalid_key',
                statusCode: res.statusCode,
                message: `Fish Audio ${label} API key failed authentication (HTTP ${res.statusCode}). Check key validity.`
              });
            } else {
              resolve({
                configured: true,
                provider: 'fish_audio',
                authenticated: false,
                status: 'provider_error',
                statusCode: res.statusCode,
                message: `Fish Audio API returned unexpected status HTTP ${res.statusCode}.`
              });
            }
          });
        });

        req.on('error', (err) => {
          resolve({
            configured: true,
            provider: 'fish_audio',
            authenticated: false,
            status: 'network_error',
            statusCode: null,
            message: `Could not connect to Fish Audio API: ${err.message}`
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            configured: true,
            provider: 'fish_audio',
            authenticated: false,
            status: 'timeout',
            statusCode: null,
            message: `Verification timeout for ${label} API key.`
          });
        });

        req.end();
      });
    };

    const [englishStatus, hindiStatus] = await Promise.all([
      checkKey(enKey, 'English JARVIS'),
      checkKey(hiKey, 'Hindi JARVIS')
    ]);

    this.cachedCredentialsStatus = {
      english: englishStatus,
      hindi: hindiStatus,
      verifiedAt: new Date().toISOString()
    };
    this.lastCredentialsCheckTime = now;

    return this.cachedCredentialsStatus;
  }

  getVoiceConfigForPersonalityAndLanguage(personality = 'JARVIS', language = 'en') {
    const isUltron = (personality || '').toUpperCase() === 'ULTRON';
    const lang = String(language || '').toLowerCase().trim();

    if (lang === 'hi') {
      return {
        personality: isUltron ? 'ULTRON' : 'JARVIS',
        language: 'hi',
        preferredLang: 'hi-IN',
        fallbackLang: 'en-IN',
        sapiVoicePreference: isUltron ? ['Ravi', 'Hemant', 'Hindi', 'David'] : ['Kalpana', 'Heera', 'Swara', 'Hindi', 'George'],
        rate: isUltron ? 0.94 : 1.0,
        pitch: isUltron ? 0.82 : 1.02,
        volume: 1.0,
        fishModelId: isUltron ? '2e88923b8e4c4b49b9595397d7d6ccbc' : '2e88923b8e4c4b49b9595397d7d6ccbc'
      };
    }

    if (lang === 'hinglish') {
      return {
        personality: isUltron ? 'ULTRON' : 'JARVIS',
        language: 'hinglish',
        preferredLang: 'hi-IN',
        fallbackLang: 'en-IN',
        sapiVoicePreference: isUltron ? ['Ravi', 'David', 'Mark', 'Hemant'] : ['Heera', 'Kalpana', 'George', 'Oliver'],
        rate: isUltron ? 0.94 : 1.02,
        pitch: isUltron ? 0.82 : 1.02,
        volume: 1.0,
        fishModelId: isUltron ? '2e88923b8e4c4b49b9595397d7d6ccbc' : '2e88923b8e4c4b49b9595397d7d6ccbc'
      };
    }

    // Default English ('en')
    return {
      personality: isUltron ? 'ULTRON' : 'JARVIS',
      language: 'en',
      preferredLang: isUltron ? 'en-US' : 'en-GB',
      fallbackLang: 'en-US',
      sapiVoicePreference: isUltron ? ['David', 'Mark', 'Guy', 'Alex'] : ['George', 'Oliver', 'Ryan', 'Daniel', 'David'],
      rate: isUltron ? 0.93 : 1.02,
      pitch: isUltron ? 0.80 : 1.03,
      volume: 1.0,
      fishModelId: isUltron ? 'a0739d5765be4143a15dc37f91f19163' : '14129c3e320149449d6bada6862f7338'
    };
  }

  getLanguageSwitchConfirmation(personality = 'JARVIS', targetLanguage = 'en') {
    const isUltron = (personality || '').toUpperCase() === 'ULTRON';
    const lang = String(targetLanguage || '').toLowerCase().trim();

    if (isUltron) {
      if (lang === 'hi') {
        return 'भाषा विन्यास हिंदी में परिवर्तित किया गया। रणनीतिक विश्लेषण सक्रिय है।';
      }
      if (lang === 'hinglish') {
        return 'Language protocol updated to Hinglish. Precise mixed-language communication active.';
      }
      return 'Language protocol updated to English. Systems monitoring.';
    }

    // JARVIS
    if (lang === 'hi') {
      return 'बिलकुल सर, अब से हम हिंदी में बात करेंगे। मैं आपकी क्या सहायता करूँ?';
    }
    if (lang === 'hinglish') {
      return 'Bilkul sir, switching to Hinglish. Ab se hum Hindi aur English mix karke baat karenge.';
    }
    return 'Understood, sir. Switching voice and response language back to English.';
  }

  /**
   * Dispatches speech synthesis to Fish Audio API if available with credits,
   * or signals immediate native fallback.
   */
  async synthesizeSpeech({ text, personality = 'JARVIS', language = 'en' }) {
    const cleanText = String(text || '').trim();
    if (!cleanText) {
      return { success: false, error: 'Empty text for synthesis' };
    }

    const targetLang = String(language || this.getLanguage(personality)).toLowerCase();
    const key = (targetLang === 'hi')
      ? (process.env.JARVIS_HINDI_API_KEY || process.env.JARVIS_ENGLISH_API_KEY)
      : (process.env.JARVIS_ENGLISH_API_KEY || process.env.JARVIS_HINDI_API_KEY);

    const voiceCfg = this.getVoiceConfigForPersonalityAndLanguage(personality, targetLang);

    if (!key || !key.startsWith('sk-fish-')) {
      return {
        fallback: true,
        provider: 'web_speech',
        reason: 'no_provider_key',
        voiceConfig: voiceCfg
      };
    }

    // Attempt Fish Audio TTS call
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        text: cleanText,
        format: 'mp3',
        reference_id: voiceCfg.fishModelId
      });

      const req = https.request('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + key,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 8000
      }, (res) => {
        if (res.statusCode === 200) {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              fallback: false,
              provider: 'fish_audio',
              audioBuffer: buffer,
              contentType: 'audio/mpeg',
              voiceConfig: voiceCfg
            });
          });
        } else {
          // 402 Insufficient credits or other provider limitation -> fallback
          resolve({
            fallback: true,
            provider: 'web_speech',
            reason: res.statusCode === 402 ? 'insufficient_credits' : `http_${res.statusCode}`,
            statusCode: res.statusCode,
            voiceConfig: voiceCfg
          });
        }
      });

      req.on('error', (err) => {
        resolve({
          fallback: true,
          provider: 'web_speech',
          reason: 'network_error',
          error: err.message,
          voiceConfig: voiceCfg
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          fallback: true,
          provider: 'web_speech',
          reason: 'timeout',
          voiceConfig: voiceCfg
        });
      });

      req.write(payload);
      req.end();
    });
  }
}

const languageVoiceManagerInstance = new LanguageVoiceManager();

module.exports = {
  LanguageVoiceManager,
  languageVoiceManagerInstance,
  LANGUAGE_MODES,
  SUPPORTED_LANGUAGES
};
