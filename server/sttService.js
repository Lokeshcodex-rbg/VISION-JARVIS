/**
 * VISION AI — Multilingual Speech-to-Text (STT) Service
 * Provides robust speech recognition fallback for Electron and environments
 * where Chromium Web Speech API encounters network errors.
 * Transcribes audio streams using Gemini Flash API (English, Hindi, Hinglish)
 * with local Windows Speech Recognition fallback.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class STTService {
  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY || null;
    this.model = 'gemini-3.5-transcribe';
    this.candidateModels = ['gemini-3.5-transcribe', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
    this.lastDiagnostic = {
      transcript: '',
      confidence: 0,
      provider: 'none',
      language: 'en',
      timestamp: null
    };
    this.loadEnv();
  }

  loadEnv() {
    try {
      const envPath = path.resolve(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/GEMINI_API_KEY=(.+)/);
        if (match && match[1]) {
          this.geminiKey = match[1].trim();
        }
      }
    } catch (e) {}
  }

  /**
   * Transcribes base64 audio buffer into text.
   * @param {string} audioBase64 - Base64 encoded audio data
   * @param {string} mimeType - e.g. "audio/webm;codecs=opus" or "audio/wav"
   * @param {string} languageMode - "en" | "hi" | "hinglish"
   * @returns {Promise<{ text: string, language: string, confidence: number, provider: string }>}
   */
  async transcribeAudio(audioBase64, mimeType = 'audio/webm;codecs=opus', languageMode = 'en') {
    const t0 = Date.now();
    this.loadEnv();

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return { text: '', language: languageMode, confidence: 0, provider: 'none', error: 'Empty audio buffer' };
    }

    // Clean base64 string if data URI header is present (supports codecs=opus and other parameters)
    const cleanBase64 = audioBase64.replace(/^data:[^,]+,/, '').trim();
    if (cleanBase64.length < 50) {
      return { text: '', language: languageMode, confidence: 0, provider: 'none', error: 'Audio buffer too short' };
    }

    // 1. Try Gemini Multimodal Speech Transcription
    if (this.geminiKey && (!this.geminiCooldownUntil || Date.now() > this.geminiCooldownUntil)) {
      try {
        const result = await this.transcribeWithGemini(cleanBase64, mimeType, languageMode);
        if (result && result.text) {
          return {
            text: result.text,
            language: result.detectedLanguage || languageMode,
            confidence: result.confidence || 0.95,
            provider: 'gemini_multimodal_stt',
            latencyMs: Date.now() - t0
          };
        }
      } catch (err) {
        console.warn('[STT_SERVICE] Gemini transcription error:', err.message);
        if (err.message && err.message.includes('429')) {
          this.geminiCooldownUntil = Date.now() + 60000;
          console.warn('[STT_SERVICE] Gemini rate limit reached. Activating 60s cooldown.');
        }
      }
    }

    // 2. Local Windows Speech Recognizer fallback (for English)
    try {
      const localResult = await this.transcribeLocalWindows(cleanBase64, mimeType);
      if (localResult && localResult.text) {
        return {
          text: localResult.text,
          language: 'en',
          confidence: 0.85,
          provider: 'windows_sapi_stt',
          latencyMs: Date.now() - t0
        };
      }
    } catch (e) {}

    return {
      text: '',
      language: languageMode,
      confidence: 0,
      provider: 'fallback',
      latencyMs: Date.now() - t0,
      error: 'Transcription failed or silent audio'
    };
  }

  /**
   * Calls Gemini multimodal models with automatic failover across candidate models
   * to transcribe audio accurately in English, Hindi, or Hinglish.
   */
  async transcribeWithGemini(base64Data, mimeType, languageMode) {
    let lastErr = null;
    const models = Array.isArray(this.candidateModels) && this.candidateModels.length > 0
      ? this.candidateModels
      : ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

    for (const rawModel of models) {
      const modelName = String(rawModel).replace(/^models\//, '');
      try {
        const res = await this._callGeminiModelForAudio(modelName, base64Data, mimeType, languageMode);
        if (res && typeof res.text === 'string') {
          this.lastDiagnostic = {
            transcript: res.text,
            confidence: res.confidence || 0.95,
            provider: `gemini_multimodal_stt (${modelName})`,
            language: res.detectedLanguage || languageMode,
            timestamp: new Date().toISOString()
          };
          return res;
        }
      } catch (err) {
        lastErr = err;
        console.warn(`[STT_SERVICE] Gemini STT model ${modelName} failed (${err.message.slice(0, 120)}). Trying next candidate.`);
      }
    }
    throw lastErr || new Error('All Gemini STT candidate models failed');
  }

  _callGeminiModelForAudio(modelName, base64Data, mimeType, languageMode) {
    return new Promise((resolve, reject) => {
      // Determine clean mime type for Gemini
      let cleanMime = 'audio/webm';
      if (mimeType.includes('wav')) cleanMime = 'audio/wav';
      else if (mimeType.includes('mp3')) cleanMime = 'audio/mp3';
      else if (mimeType.includes('ogg')) cleanMime = 'audio/ogg';

      let langInstruction = 'The user is speaking English.';
      if (languageMode === 'hi') {
        langInstruction = 'The user is speaking Hindi (or Hinglish). Transcribe in natural Hindi or Romanized Hindi.';
      } else if (languageMode === 'hinglish') {
        langInstruction = 'The user is speaking a natural blend of Hindi and English (Hinglish). Transcribe accurately preserving English words and Hindi terms.';
      }

      const promptText = `Listen to this short user voice audio command.
${langInstruction}
Transcribe EXACTLY what the user said without dropping any words.
Rules:
1. Return ONLY the complete transcribed words.
2. Do not add quotes, markdown formatting, prefixes, or explanations.
3. If there is only background noise, silence, or unintelligible clicking, return EMPTY string.
4. Preserve punctuation, pauses, contact names, application names, and full message sentences accurately.`;

      const requestBody = JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: cleanMime,
                data: base64Data
              }
            },
            {
              text: promptText
            }
          ]
        }],
        generationConfig: {
          temperature: 0.0,
          maxOutputTokens: 160
        }
      });

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.geminiKey}`;
      const req = https.request(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        },
        timeout: 6000
      }, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Gemini STT HTTP ${res.statusCode} (${modelName}): ${responseBody.slice(0, 150)}`));
          }
          try {
            const parsed = JSON.parse(responseBody);
            const rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const text = rawText.replace(/^(Transcription:|"|'|\*)+/i, '').replace(/("|'|\*)+$/i, '').trim();
            resolve({
              text,
              detectedLanguage: /[\u0900-\u097F]/.test(text) ? 'hi' : languageMode,
              confidence: 0.95
            });
          } catch (e) {
            reject(new Error('Failed to parse Gemini STT response: ' + e.message));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Gemini STT request timed out (${modelName}, 6s)`));
      });

      req.write(requestBody);
      req.end();
    });
  }

  /**
   * Local Windows Speech Recognition fallback for offline / rate-limited environments
   */
  transcribeLocalWindows(base64Data, mimeType) {
    return new Promise((resolve) => {
      try {
        const audioBuf = Buffer.from(base64Data, 'base64');
        const tempDir = path.join(__dirname, '../data/temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const tempWav = path.join(tempDir, `audio_${Date.now()}.wav`);

        // Check if buffer is already RIFF WAV
        const isWav = audioBuf.length > 12 && audioBuf.toString('ascii', 0, 4) === 'RIFF';
        if (isWav) {
          fs.writeFileSync(tempWav, audioBuf);
          const psCommand = `
            Add-Type -AssemblyName System.Speech;
            $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine;
            $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar));
            $engine.SetInputToWaveFile('${tempWav.replace(/'/g, "''")}');
            $result = $engine.Recognize([TimeSpan]::FromSeconds(5));
            $engine.Dispose();
            if ($result) { $result.Text } else { '' }
          `;
          exec(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, ' ')}"`, { timeout: 6000 }, (err, stdout) => {
            try { fs.unlinkSync(tempWav); } catch (_) {}
            const text = (stdout || '').trim();
            if (text) {
              return resolve({ text, provider: 'windows_sapi_stt', confidence: 0.85 });
            }
            resolve(null);
          });
          return;
        }

        resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  getStatus() {
    this.loadEnv();
    return {
      hasGeminiKey: Boolean(this.geminiKey),
      primaryModel: this.model,
      providers: ['gemini_multimodal_stt', 'windows_sapi_stt'],
      inCooldown: Boolean(this.geminiCooldownUntil && Date.now() < this.geminiCooldownUntil)
    };
  }
}

const sttServiceInstance = new STTService();

module.exports = {
  STTService,
  sttServiceInstance
};
