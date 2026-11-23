/**
 * STARK AI — Dynamic English/Hindi/Hinglish Language & Voice Switching Test Suite
 * Comprehensive automated verification covering:
 * 1. Safe Speech Provider Credential Verification (Fish Audio) without secret logging
 * 2. Central Language & Voice Configuration Manager
 * 3. Persistence across application restarts (data/language_preferences.json)
 * 4. Multilingual Intent Understanding (English, Hindi, Hinglish)
 * 5. Language Switching Tool Execution & Spoken Confirmations
 * 6. Dynamic System Prompts (English, Hindi, Hinglish)
 * 7. Client SpeechSynthesizer Voice Selection (hi-IN, en-IN, en-GB, en-US)
 * 8. Missing Credentials & Transparent Local Fallback Routing
 * 9. In-conversation Language Switching with History Preservation
 * 10. Live HTTP REST Endpoints (/api/language, /api/language/set, /api/language/credentials, /api/tts/synthesize)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const { LanguageVoiceManager, languageVoiceManagerInstance } = require('./server/languageVoiceManager.js');
const { getPersonalityPrompt, getLanguageInstructions, PERSONALITY_PROMPTS } = require('./server/personalityPrompts.js');
const { executeTool, TOOLS } = require('./server/toolsRegistry.js');
const { aiAdapterInstance } = require('./server/aiProviderAdapter.js');
const { conversationManagerInstance } = require('./server/conversationManager.js');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] [${totalTests}] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] [${totalTests}] ${desc}`);
    console.error(`    ${err.message}`);
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] [${totalTests}] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] [${totalTests}] ${desc}`);
    console.error(`    ${err.message}`);
  }
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('STARK AI — DYNAMIC ENGLISH/HINDI/HINGLISH VOICE SWITCHING AUDIT');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: Credentials Inspection & Verification (Fish Audio)
  // -------------------------------------------------------------------------
  console.log('--- Section 1: Speech Provider Credentials Verification ---');

  await itAsync('1.1 Inspect credentials without exposing secret values', async () => {
    const summary = languageVoiceManagerInstance.getMaskedCredentialsSummary();
    assert.ok(summary.english, 'Must have english key summary');
    assert.ok(summary.hindi, 'Must have hindi key summary');

    // Confirm that no full keys are leaked
    if (summary.english.maskedKey) {
      assert.ok(summary.english.maskedKey.includes('...'), 'English key must be masked');
      assert.ok(!summary.english.maskedKey.includes('6N4_') && !summary.english.maskedKey.includes('wDyY36amyUoIi1mH1-AThreBQXS8R7zphY5aT7QHl_g'), 'Secret cannot be printed');
    }
    if (summary.hindi.maskedKey) {
      assert.ok(summary.hindi.maskedKey.includes('...'), 'Hindi key must be masked');
      assert.ok(!summary.hindi.maskedKey.includes('6N4_PIAHFDqEM5UwW3lrHuniTJmC-eFw97LewbmRiWw'), 'Secret cannot be printed');
    }
    assert.strictEqual(summary.english.provider, 'fish_audio');
    assert.strictEqual(summary.hindi.provider, 'fish_audio');
  });

  await itAsync('1.2 Verify Fish Audio API authentication & quota status', async () => {
    const status = await languageVoiceManagerInstance.verifyCredentials(false);
    assert.ok(status.english, 'Must have English status');
    assert.ok(status.hindi, 'Must have Hindi status');

    assert.strictEqual(status.english.provider, 'fish_audio');
    assert.strictEqual(status.hindi.provider, 'fish_audio');
    assert.strictEqual(status.english.authenticated, true, 'English key must authenticate with Fish Audio');
    assert.strictEqual(status.hindi.authenticated, true, 'Hindi key must authenticate with Fish Audio');

    // Both keys return 402 (insufficient credits) on online TTS synthesis
    assert.strictEqual(status.english.status, 'insufficient_credits');
    assert.strictEqual(status.hindi.status, 'insufficient_credits');
    assert.strictEqual(status.english.statusCode, 402);
    assert.strictEqual(status.hindi.statusCode, 402);
    assert.ok(status.english.message.includes('Local fallback active'));
  });

  // -------------------------------------------------------------------------
  // SECTION 2: Central Language & Voice Configuration Manager
  // -------------------------------------------------------------------------
  console.log('\n--- Section 2: Central Language & Voice Configuration Manager ---');

  it('2.1 Default language mode is English for both personalities', () => {
    languageVoiceManagerInstance.setLanguage('JARVIS', 'en');
    languageVoiceManagerInstance.setLanguage('ULTRON', 'en');
    assert.strictEqual(languageVoiceManagerInstance.getLanguage('JARVIS'), 'en');
    assert.strictEqual(languageVoiceManagerInstance.getLanguage('ULTRON'), 'en');
  });

  it('2.2 Set language to Hindi for JARVIS', () => {
    const res = languageVoiceManagerInstance.setLanguage('JARVIS', 'hi');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.personality, 'JARVIS');
    assert.strictEqual(res.language, 'hi');
    assert.strictEqual(languageVoiceManagerInstance.getLanguage('JARVIS'), 'hi');
    assert.ok(res.confirmation.includes('हिंदी'), 'Confirmation must be in Hindi');
  });

  it('2.3 Set language to Hinglish for JARVIS', () => {
    const res = languageVoiceManagerInstance.setLanguage('JARVIS', 'hinglish');
    assert.strictEqual(res.language, 'hinglish');
    assert.strictEqual(languageVoiceManagerInstance.getLanguage('JARVIS'), 'hinglish');
    assert.ok(res.confirmation.toLowerCase().includes('hinglish'));
  });

  it('2.4 Set language for ULTRON independently of JARVIS', () => {
    languageVoiceManagerInstance.setLanguage('JARVIS', 'en');
    const res = languageVoiceManagerInstance.setLanguage('ULTRON', 'hi');
    assert.strictEqual(languageVoiceManagerInstance.getLanguage('JARVIS'), 'en');
    assert.strictEqual(languageVoiceManagerInstance.getLanguage('ULTRON'), 'hi');
    assert.ok(res.confirmation.includes('हिंदी'));
    // Restore ULTRON to English
    languageVoiceManagerInstance.setLanguage('ULTRON', 'en');
  });

  it('2.5 Reject unsupported language code gracefully', () => {
    assert.throws(() => {
      languageVoiceManagerInstance.setLanguage('JARVIS', 'klingon');
    }, /Unsupported language mode/);
  });

  it('2.6 Voice configuration provides target language, rates, and SAPI preferences', () => {
    const hiCfg = languageVoiceManagerInstance.getVoiceConfigForPersonalityAndLanguage('JARVIS', 'hi');
    assert.strictEqual(hiCfg.language, 'hi');
    assert.strictEqual(hiCfg.preferredLang, 'hi-IN');
    assert.ok(hiCfg.sapiVoicePreference.includes('Kalpana') || hiCfg.sapiVoicePreference.includes('Heera'));

    const enCfg = languageVoiceManagerInstance.getVoiceConfigForPersonalityAndLanguage('JARVIS', 'en');
    assert.strictEqual(enCfg.language, 'en');
    assert.strictEqual(enCfg.preferredLang, 'en-GB');

    const ultronHi = languageVoiceManagerInstance.getVoiceConfigForPersonalityAndLanguage('ULTRON', 'hi');
    assert.strictEqual(ultronHi.language, 'hi');
    assert.strictEqual(ultronHi.rate, 0.94);
    assert.strictEqual(ultronHi.pitch, 0.82, 'Ultron must have deep authoritative pitch');
  });

  // -------------------------------------------------------------------------
  // SECTION 3: Persistence Across Application Restarts
  // -------------------------------------------------------------------------
  console.log('\n--- Section 3: Persistence Across Application Restarts ---');

  it('3.1 Persist JARVIS=hi and ULTRON=hinglish to disk', () => {
    languageVoiceManagerInstance.setLanguage('JARVIS', 'hi');
    languageVoiceManagerInstance.setLanguage('ULTRON', 'hinglish');

    const filePath = languageVoiceManagerInstance.storagePath;
    assert.ok(fs.existsSync(filePath), 'Preferences file must exist on disk');
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(raw.JARVIS, 'hi');
    assert.strictEqual(raw.ULTRON, 'hinglish');
  });

  it('3.2 Fresh manager instance boots with persisted configurations', () => {
    const freshManager = new LanguageVoiceManager({
      storagePath: languageVoiceManagerInstance.storagePath
    });
    assert.strictEqual(freshManager.getLanguage('JARVIS'), 'hi', 'Must recover JARVIS=hi across restart');
    assert.strictEqual(freshManager.getLanguage('ULTRON'), 'hinglish', 'Must recover ULTRON=hinglish across restart');

    // Clean up to English
    freshManager.setLanguage('JARVIS', 'en');
    freshManager.setLanguage('ULTRON', 'en');
    languageVoiceManagerInstance.setLanguage('JARVIS', 'en');
    languageVoiceManagerInstance.setLanguage('ULTRON', 'en');
    assert.strictEqual(freshManager.getLanguage('JARVIS'), 'en');
  });

  // -------------------------------------------------------------------------
  // SECTION 4: Multilingual Voice Intent Understanding
  // -------------------------------------------------------------------------
  console.log('\n--- Section 4: Multilingual Voice Intent Understanding ---');

  it('4.1 "JARVIS, speak in English" maps to set_language_mode(en)', () => {
    const intent = aiAdapterInstance.detectToolIntent('JARVIS', 'JARVIS, speak in English');
    assert.ok(intent, 'Must detect intent');
    assert.strictEqual(intent.toolName, 'set_language_mode');
    assert.strictEqual(intent.args.language, 'en');
  });

  it('4.2 "JARVIS, Hindi mein baat karo" maps to set_language_mode(hi)', () => {
    const intent = aiAdapterInstance.detectToolIntent('JARVIS', 'JARVIS, Hindi mein baat karo');
    assert.ok(intent);
    assert.strictEqual(intent.toolName, 'set_language_mode');
    assert.strictEqual(intent.args.language, 'hi');
  });

  it('4.3 "JARVIS, switch to Hinglish" maps to set_language_mode(hinglish)', () => {
    const intent = aiAdapterInstance.detectToolIntent('JARVIS', 'JARVIS, switch to Hinglish');
    assert.ok(intent);
    assert.strictEqual(intent.toolName, 'set_language_mode');
    assert.strictEqual(intent.args.language, 'hinglish');
  });

  it('4.4 "JARVIS, switch back to English" maps to set_language_mode(en)', () => {
    const intent = aiAdapterInstance.detectToolIntent('JARVIS', 'JARVIS, switch back to English');
    assert.ok(intent);
    assert.strictEqual(intent.toolName, 'set_language_mode');
    assert.strictEqual(intent.args.language, 'en');
  });

  it('4.5 Natural variations: "Hindi me bolo", "talk in English", "use Hinglish"', () => {
    assert.strictEqual(aiAdapterInstance.detectToolIntent('JARVIS', 'Hindi me bolo')?.args.language, 'hi');
    assert.strictEqual(aiAdapterInstance.detectToolIntent('JARVIS', 'talk in english')?.args.language, 'en');
    assert.strictEqual(aiAdapterInstance.detectToolIntent('JARVIS', 'Hinglish mein baat karo')?.args.language, 'hinglish');
  });

  it('4.6 ULTRON commands: "Ultron, Hindi mein baat karo", "Ultron, speak in English"', () => {
    const u1 = aiAdapterInstance.detectToolIntent('ULTRON', 'Ultron, Hindi mein baat karo');
    assert.strictEqual(u1.toolName, 'set_language_mode');
    assert.strictEqual(u1.args.language, 'hi');

    const u2 = aiAdapterInstance.detectToolIntent('ULTRON', 'Ultron, speak in English');
    assert.strictEqual(u2.toolName, 'set_language_mode');
    assert.strictEqual(u2.args.language, 'en');
  });

  // -------------------------------------------------------------------------
  // SECTION 5: Tool Execution & Spoken Confirmations
  // -------------------------------------------------------------------------
  console.log('\n--- Section 5: Tool Execution & Spoken Confirmations ---');

  await itAsync('5.1 executeTool(set_language_mode, { language: "hi" }, "JARVIS")', async () => {
    const res = await executeTool('set_language_mode', { language: 'hi' }, 'JARVIS');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.language, 'hi');
    assert.strictEqual(res.personality, 'JARVIS');
    assert.ok(res.confirmation.includes('हिंदी में बात करेंगे'));
    assert.strictEqual(languageVoiceManagerInstance.getLanguage('JARVIS'), 'hi');
  });

  await itAsync('5.2 executeTool(set_language_mode, { language: "hinglish" }, "JARVIS")', async () => {
    const res = await executeTool('set_language_mode', { language: 'hinglish' }, 'JARVIS');
    assert.strictEqual(res.language, 'hinglish');
    assert.ok(res.confirmation.includes('Hinglish'));
  });

  await itAsync('5.3 executeTool(set_language_mode, { language: "en" }, "JARVIS")', async () => {
    const res = await executeTool('set_language_mode', { language: 'en' }, 'JARVIS');
    assert.strictEqual(res.language, 'en');
    assert.ok(res.confirmation.includes('English'));
  });

  await itAsync('5.4 ULTRON executeTool(set_language_mode) confirms in ULTRON character', async () => {
    const res = await executeTool('set_language_mode', { language: 'hi' }, 'ULTRON');
    assert.strictEqual(res.language, 'hi');
    assert.strictEqual(res.personality, 'ULTRON');
    assert.ok(res.confirmation.includes('रणनीतिक विश्लेषण'));
    assert.ok(!res.confirmation.includes('सर'), 'ULTRON never uses "sir" or "सर"');
  });

  await itAsync('5.5 get_language_mode tool returns active settings', async () => {
    const res = await executeTool('get_language_mode', {}, 'JARVIS');
    assert.ok(res.currentLanguage);
    assert.ok(res.allPreferences);
  });

  // -------------------------------------------------------------------------
  // SECTION 6: Dynamic System Prompts (English, Hindi, Hinglish)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 6: Dynamic System Prompts (English, Hindi, Hinglish) ---');

  it('6.1 getPersonalityPrompt(JARVIS, en) enforces English response rule', () => {
    const prompt = getPersonalityPrompt('JARVIS', 'en');
    assert.ok(prompt.includes('MANDATORY LANGUAGE RULE — ALWAYS RESPOND IN ENGLISH:'));
    assert.ok(prompt.includes('Never output Hindi script (Devanagari)'));
  });

  it('6.2 getPersonalityPrompt(JARVIS, hi) enforces natural Hindi response rule', () => {
    const prompt = getPersonalityPrompt('JARVIS', 'hi');
    assert.ok(prompt.includes('MANDATORY LANGUAGE RULE — RESPOND EXCLUSIVELY IN HINDI:'));
    assert.ok(prompt.includes('Address the user as "सर" naturally'));
    assert.ok(prompt.includes('standard English loanwords'));
  });

  it('6.3 getPersonalityPrompt(JARVIS, hinglish) enforces natural Hinglish response rule', () => {
    const prompt = getPersonalityPrompt('JARVIS', 'hinglish');
    assert.ok(prompt.includes('MANDATORY LANGUAGE RULE — RESPOND NATURALLY IN HINGLISH:'));
    assert.ok(prompt.includes('Roman script'));
  });

  it('6.4 getPersonalityPrompt(ULTRON, hi) enforces commanding Hindi without "सर"', () => {
    const prompt = getPersonalityPrompt('ULTRON', 'hi');
    assert.ok(prompt.includes('MANDATORY LANGUAGE RULE — RESPOND EXCLUSIVELY IN HINDI:'));
    assert.ok(prompt.includes('Never use servile titles like "सर" or "sir"'));
  });

  it('6.5 Legacy PERSONALITY_PROMPTS backwards compatibility', () => {
    assert.ok(typeof PERSONALITY_PROMPTS.JARVIS === 'string');
    assert.ok(typeof PERSONALITY_PROMPTS.ULTRON === 'string');
  });

  // -------------------------------------------------------------------------
  // SECTION 7: Client SpeechSynthesizer Voice & Language Selection
  // -------------------------------------------------------------------------
  console.log('\n--- Section 7: SpeechSynthesizer Voice & Language Selection ---');

  it('7.1 SpeechSynthesizer exposes setLanguage and getLanguage', () => {
    // Import SpeechSynthesizer with mock window
    const mockVoices = [
      { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Microsoft David - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Kalpana - Hindi (India)', lang: 'hi-IN' },
      { name: 'Microsoft Ravi - English (India)', lang: 'en-IN' }
    ];

    class MockUtterance {
      constructor(text) { this.text = text; }
    }
    global.SpeechSynthesisUtterance = MockUtterance;

    global.window = {
      speechSynthesis: {
        getVoices: () => mockVoices,
        speak: () => {},
        cancel: () => {},
        pause: () => {},
        resume: () => {},
        speaking: false,
        pending: false
      },
      SpeechSynthesisUtterance: MockUtterance
    };

    const { SpeechSynthesizer } = require('./js/modules/speechSynthesizer.js');
    const synth = new SpeechSynthesizer();
    synth.voices = mockVoices;

    assert.strictEqual(synth.getLanguage(), 'en');
    synth.setLanguage('hi');
    assert.strictEqual(synth.getLanguage(), 'hi');
    synth.setLanguage('hinglish');
    assert.strictEqual(synth.getLanguage(), 'hinglish');
  });

  it('7.2 selectVoiceForTheme(JARVIS, en) picks British English voice', () => {
    const { SpeechSynthesizer } = require('./js/modules/speechSynthesizer.js');
    const synth = new SpeechSynthesizer();
    synth.voices = [
      { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Microsoft David - English (United States)', lang: 'en-US' }
    ];
    const v = synth.selectVoiceForTheme('JARVIS', 'en');
    assert.ok(v.name.includes('George'));
  });

  it('7.3 selectVoiceForTheme(ULTRON, en) picks deep US male voice', () => {
    const { SpeechSynthesizer } = require('./js/modules/speechSynthesizer.js');
    const synth = new SpeechSynthesizer();
    synth.voices = [
      { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' },
      { name: 'Microsoft David - English (United States)', lang: 'en-US' }
    ];
    const v = synth.selectVoiceForTheme('ULTRON', 'en');
    assert.ok(v.name.includes('David'));
  });

  it('7.4 selectVoiceForTheme(JARVIS, hi) picks native Hindi voice', () => {
    const { SpeechSynthesizer } = require('./js/modules/speechSynthesizer.js');
    const synth = new SpeechSynthesizer();
    synth.voices = [
      { name: 'Microsoft David', lang: 'en-US' },
      { name: 'Microsoft Kalpana - Hindi (India)', lang: 'hi-IN' }
    ];
    const v = synth.selectVoiceForTheme('JARVIS', 'hi');
    assert.ok(v.name.includes('Kalpana') || v.lang.includes('hi'));
  });

  it('7.5 selectVoiceForTheme(JARVIS, hi) falls back to en-IN when pure Hindi is absent', () => {
    const { SpeechSynthesizer } = require('./js/modules/speechSynthesizer.js');
    const synth = new SpeechSynthesizer();
    synth.voices = [
      { name: 'Microsoft David', lang: 'en-US' },
      { name: 'Microsoft Ravi - English (India)', lang: 'en-IN' }
    ];
    const v = synth.selectVoiceForTheme('JARVIS', 'hi');
    assert.ok(v.name.includes('Ravi') || v.lang.includes('en-in'), 'Should pick Indian English voice for Hindi phonemes');
  });

  it('7.6 beginUtterance sets utterance language and passes to sentence queue', () => {
    const { SpeechSynthesizer } = require('./js/modules/speechSynthesizer.js');
    const synth = new SpeechSynthesizer();
    synth.voices = [{ name: 'Microsoft Kalpana', lang: 'hi-IN' }];

    const uttId = synth.beginUtterance('JARVIS', 'hi');
    assert.strictEqual(synth.activeUtteranceLanguage, 'hi');

    synth.enqueueSentence('नमस्ते सर।', 'JARVIS', uttId, false);
    // Since synth was idle, first chunk becomes current utterance
    assert.strictEqual(synth.currentUtterance?.language || synth.currentUtteranceItem?.language, 'hi');

    // Enqueue second chunk while speaking; this stays in sentenceQueue
    synth.enqueueSentence('मैं आपकी क्या सहायता करूँ?', 'JARVIS', uttId, true);
    assert.strictEqual(synth.sentenceQueue.length, 1);
    assert.strictEqual(synth.sentenceQueue[0].language, 'hi');
  });

  // -------------------------------------------------------------------------
  // SECTION 8: Missing Credentials & Transparent Fallback
  // -------------------------------------------------------------------------
  console.log('\n--- Section 8: Missing Credentials & Transparent Fallback ---');

  await itAsync('8.1 synthesizeSpeech returns fallback descriptor when online credits unavailable', async () => {
    const result = await languageVoiceManagerInstance.synthesizeSpeech({
      text: 'Good morning, sir.',
      personality: 'JARVIS',
      language: 'en'
    });
    // Since Fish Audio keys have 402 Insufficient credits, it returns transparent fallback
    assert.strictEqual(result.fallback, true);
    assert.strictEqual(result.provider, 'web_speech');
    assert.ok(result.reason === 'insufficient_credits' || result.reason === 'no_provider_key');
    assert.ok(result.voiceConfig);
  });

  await itAsync('8.2 Empty or missing key triggers immediate local fallback', async () => {
    const origKey = process.env.JARVIS_HINDI_API_KEY;
    try {
      delete process.env.JARVIS_HINDI_API_KEY;
      delete process.env.JARVIS_ENGLISH_API_KEY;

      const result = await languageVoiceManagerInstance.synthesizeSpeech({
        text: 'नमस्ते सर।',
        personality: 'JARVIS',
        language: 'hi'
      });
      assert.strictEqual(result.fallback, true);
      assert.strictEqual(result.provider, 'web_speech');
      assert.strictEqual(result.reason, 'no_provider_key');
    } finally {
      process.env.JARVIS_HINDI_API_KEY = origKey;
      languageVoiceManagerInstance.loadEnvKeys();
    }
  });

  // -------------------------------------------------------------------------
  // SECTION 9: In-Conversation Language Switching with History Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- Section 9: In-Conversation Language Switching & History ---');

  await itAsync('9.1 Conversation history is fully preserved across language switch', async () => {
    conversationManagerInstance.clearHistory('JARVIS');
    conversationManagerInstance.addMessage('JARVIS', 'user', 'What is recursion?');
    conversationManagerInstance.addMessage('JARVIS', 'assistant', 'Recursion is a programming technique.');

    const initialHistoryLen = conversationManagerInstance.getHistory('JARVIS').length;
    assert.strictEqual(initialHistoryLen, 2);

    // Switch language to Hindi
    const switchRes = await aiAdapterInstance.generateResponse('JARVIS', 'JARVIS, Hindi mein baat karo');
    assert.strictEqual(switchRes.language, 'hi');
    assert.ok(switchRes.reply.includes('हिंदी में बात करेंगे'));

    // Check history is preserved and not cleared
    conversationManagerInstance.addMessage('JARVIS', 'user', 'JARVIS, Hindi mein baat karo');
    conversationManagerInstance.addMessage('JARVIS', 'assistant', switchRes.reply);
    const postSwitchHistory = conversationManagerInstance.getHistory('JARVIS');
    assert.strictEqual(postSwitchHistory.length, 4, 'History must not be wiped out on language switch');
    assert.strictEqual(postSwitchHistory[0].content, 'What is recursion?');
  });

  await itAsync('9.2 Subsequent response respects active Hindi language mode', async () => {
    languageVoiceManagerInstance.setLanguage('JARVIS', 'hi');
    const { systemPrompt } = aiAdapterInstance.buildPromptContext('JARVIS', 'Binary search samjhao', null);
    assert.ok(systemPrompt.includes('RESPOND EXCLUSIVELY IN HINDI'));
    assert.ok(!systemPrompt.includes('ALWAYS RESPOND IN ENGLISH'));

    // Restore to English
    languageVoiceManagerInstance.setLanguage('JARVIS', 'en');
  });

  // -------------------------------------------------------------------------
  // SECTION 10: Live REST Endpoints Audit
  // -------------------------------------------------------------------------
  console.log('\n--- Section 10: Live REST Endpoints Audit ---');

  const { serverAuthManagerInstance } = require('./server/serverAuthManager.js');

  function makeRequest(method, urlPath, body = null) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlPath, 'http://localhost:3000');
      const token = serverAuthManagerInstance.getSessionToken();
      const req = http.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: {
          'Origin': 'http://localhost:3000',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(body ? { 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {})
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // Ensure server is active for live REST endpoint verification
  let startedInternalServer = false;
  try {
    await makeRequest('GET', '/api/status');
  } catch (_) {
    require('./server.js');
    startedInternalServer = true;
    await new Promise(r => setTimeout(r, 700));
  }

  await itAsync('10.1 GET /api/language returns preferences and masked credentials', async () => {
    const res = await makeRequest('GET', '/api/language?personality=JARVIS');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.preferences);
    assert.ok(res.data.currentLanguage);
    assert.ok(res.data.credentials.english);
    assert.ok(res.data.credentials.hindi);
    assert.strictEqual(res.data.credentials.english.provider, 'fish_audio');
  });

  await itAsync('10.2 POST /api/language/set switches language dynamically', async () => {
    const res = await makeRequest('POST', '/api/language/set', { personality: 'JARVIS', language: 'hi' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.language, 'hi');
    assert.ok(res.data.confirmation.includes('हिंदी'));

    // Switch back to English
    const res2 = await makeRequest('POST', '/api/language/set', { personality: 'JARVIS', language: 'en' });
    assert.strictEqual(res2.data.language, 'en');
  });

  await itAsync('10.3 GET /api/language/credentials verifies credentials without leaks', async () => {
    const res = await makeRequest('GET', '/api/language/credentials');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.verification.english.status, 'insufficient_credits');
    assert.strictEqual(res.data.verification.hindi.status, 'insufficient_credits');
  });

  await itAsync('10.4 POST /api/tts/synthesize returns fallback negotiation on insufficient credits', async () => {
    const res = await makeRequest('POST', '/api/tts/synthesize', {
      text: 'Good morning, sir.',
      personality: 'JARVIS',
      language: 'en'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.fallback, true);
    assert.strictEqual(res.data.provider, 'web_speech');
  });

  // -------------------------------------------------------------------------
  // FINAL TEARDOWN: Ensure production preferences remain English
  // -------------------------------------------------------------------------
  languageVoiceManagerInstance.setLanguage('JARVIS', 'en');
  languageVoiceManagerInstance.setLanguage('ULTRON', 'en');
  try {
    await makeRequest('POST', '/api/language/set', { personality: 'JARVIS', language: 'en' });
    await makeRequest('POST', '/api/language/set', { personality: 'ULTRON', language: 'en' });
  } catch (_) {}

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`LANGUAGE & VOICE SWITCHING AUDIT COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`FAILURES: ${totalTests - passedTests}`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
