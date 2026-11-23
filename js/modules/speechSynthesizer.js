/**
 * ULTRON × JARVIS — AI Personality Speech Synthesis Engine & Authoritative Playback Manager
 * Provides progressive sentence-streaming audio playback with generation-token isolation,
 * single-owner robust queue, persistent utterance GC protection, non-destructive stall recovery,
 * safe abbreviation/decimal clause-boundary splitting, and authentic acoustic profiles.
 */

import { CONFIG } from '../config.js';

export const SPEECH_PLAYBACK_STATES = {
  IDLE: 'IDLE',
  STREAMING: 'STREAMING',
  RESPONSE_COMPLETE: 'RESPONSE_COMPLETE',
  SPEAKING: 'SPEAKING',
  COMPLETED: 'COMPLETED'
};

export class SpeechSynthesizer {
  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    this.voices = [];
    this.voicesLoaded = false;
    this.activationCounts = {
      JARVIS: 0,
      ULTRON: 0
    };
    this.lastResponse = {
      JARVIS: null,
      ULTRON: null
    };

    // Authoritative Playback State & Token Guards
    this.generationToken = 0;
    this.activeUtteranceId = null;
    this.sentenceQueue = [];
    this.isSpeaking = false;
    this.isStreamFinished = false;
    this.hasEmittedFirstSpeech = false;
    this.fullSpokenText = '';
    this.activeThemeKey = 'JARVIS';
    this.activeThemeConfig = null;
    this.activeLanguage = 'en';
    this.activeUtteranceLanguage = 'en';
    this.activeProsodyProfile = null;
    this.activeOnComplete = null;
    this.currentUtterance = null;
    this.currentUtteranceItem = null;
    this.currentUtteranceStartTime = 0;
    this.pendingTimeout = null;
    this.watchdogInterval = null;
    this.playbackState = SPEECH_PLAYBACK_STATES.IDLE;
    this.isEmergencyStopped = false;

    // Persistent Reference Set to prevent V8 Garbage Collection mid-speech
    this.activeUtterances = new Set();

    // Granular Diagnostic Telemetry
    this.diagnostics = {
      sentencesReceived: 0,
      utterancesQueued: 0,
      utterancesStarted: 0,
      utterancesCompleted: 0,
      utterancesFailed: 0,
      retriesCount: 0,
      watchdogRecoveries: 0,
      cancellationsCount: 0,
      lastCancelReason: null
    };

    // Callbacks
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.onSentenceStart = null;
    this.onSentenceEnd = null;
    this.onCarrierCue = null;
    this.onAudioPlaybackStart = null;
    this.onCancel = null;
    this.onStateChange = null;

    if (this.isSupported) {
      this.init();
    } else {
      console.warn('[AI_SPEECH] Web Speech Synthesis API is not supported in this browser.');
    }
  }

  init() {
    this.populateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.populateVoices();
        };
      }
    }
  }

  populateVoices() {
    try {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const available = window.speechSynthesis.getVoices();
      if (available && available.length > 0) {
        this.voices = available;
        this.voicesLoaded = true;
      }
    } catch (err) {
      console.warn('[AI_SPEECH] Error querying system voices:', err);
    }
  }

  /**
   * Sanitizes markdown, code fences, and symbols so TTS delivers natural spoken audio
   */
  cleanTextForSpeech(text) {
    if (!text || typeof text !== 'string') return '';

    return text
      // Replace code blocks with a brief natural phrase
      .replace(/```[a-z]*\s*[\s\S]*?```/gi, ' Code snippet provided. ')
      // Strip inline code backticks
      .replace(/`([^`]+)`/g, '$1')
      // Convert markdown links [label](url) to readable label without reading long raw URLs
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
      .replace(/https?:\/\/[^\s)]+/g, '')
      .replace(/\b(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{20,}/g, '')
      // Strip bold & italics syntax
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Strip markdown headers
      .replace(/^#{1,6}\s+/gm, '')
      // Strip bullet points and list markers
      .replace(/^[\*\-\+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Ensure J.A.R.V.I.S., JARVIS, and variants are spoken naturally as "Jarvis" (never spelled letter-by-letter)
      .replace(/\bJ\.?\s*A\.?\s*R\.?\s*V\.?\s*I\.?\s*S\.(?=[,;:\s]|$)/gi, 'Jarvis')
      .replace(/(?:\bJ\s*\.\s*A\s*\.\s*R\s*\.\s*V\s*\.\s*I\s*\.\s*S|\bJ\.A\.R\.V\.I\.S|\bJARVIS)\b/gi, 'Jarvis')
      .replace(/\bULTRON\b/g, 'Ultron')
      .replace(/\bAI\b/g, 'A.I.')
      .replace(/\bVAD\b/g, 'V.A.D.')
      .replace(/\bFPS\b/g, 'F.P.S.')
      .replace(/\bCPU\b/g, 'C.P.U.')
      .replace(/\bRAM\b/g, 'R.A.M.')
      .replace(/\bUI\b/g, 'U.I.')
      .replace(/\bOS\b/g, 'O.S.')
      .replace(/\bAPI\b/g, 'A.P.I.')
      .replace(/\bHTTP\b/g, 'H.T.T.P.')
      .replace(/\bSSE\b/g, 'S.S.E.')
      // Controlled micro-pauses: replace colons and semicolons with commas
      .replace(/[:;]\s*/g, ', ')
      // Clean up multiple spaces and newlines
      .replace(/[\r\n]+/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Cleans text for visual caption/transcript display.
   * Strips markdown artifacts while strictly preserving proper acronyms (JARVIS, AI, etc.).
   */
  cleanTextForDisplay(text) {
    if (!text || typeof text !== 'string') return '';

    return text
      .replace(/```[a-z]*\s*[\s\S]*?```/gi, ' [Code snippet] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
      .replace(/https?:\/\/[^\s)]+/g, '')
      .replace(/\b(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{20,}/g, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[\*\-\+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Robust Sentence & Safe Clause Splitter:
   * Protects decimals, abbreviations, numbers, and acronyms from premature splitting.
   * Splits excessively long sentences (> maxChunkLen) at natural clause boundaries (commas,
   * semicolons, colons, dashes) to prevent Windows SAPI buffer overflow or 15s engine stalls.
   * Guarantees zero dropped words or lost characters.
   *
   * @param {string} text
   * @param {number} [maxChunkLen=180]
   * @returns {string[]}
   */
  splitIntoSentences(text, maxChunkLen = 180) {
    if (!text || typeof text !== 'string') return [];
    const trimmed = text.trim();
    if (!trimmed) return [];

    const sentences = [];
    let start = 0;
    const len = trimmed.length;

    for (let i = 0; i < len; i++) {
      const ch = trimmed[i];

      // Check for paragraph breaks (\n\n or \r\n\r\n)
      if ((ch === '\n' && trimmed[i + 1] === '\n') ||
          (ch === '\r' && trimmed.substr(i, 4) === '\r\n\r\n')) {
        const seg = trimmed.slice(start, i).trim();
        if (seg) sentences.push(seg);
        start = ch === '\r' ? i + 4 : i + 2;
        i = start - 1;
        continue;
      }

      // Check for terminal punctuation: . ! ? । ॥
      if (ch === '.' || ch === '!' || ch === '?' || ch === '\u0964' || ch === '\u0965') {
        // 1. Decimal or number check: e.g. 99.9, 10.30, v2.0
        if (ch === '.') {
          const prev = i > 0 ? trimmed[i - 1] : '';
          const next = i + 1 < len ? trimmed[i + 1] : '';
          if (/\d/.test(prev) && /\d/.test(next)) continue;
        }

        // 2. Consume repeated punctuation (e.g. ..., ?!, !!!)
        let pEnd = i;
        while (pEnd + 1 < len && /[.!?\u0964\u0965]/.test(trimmed[pEnd + 1])) {
          pEnd++;
        }

        // 3. Known abbreviation check (e.g. Dr., Mr., e.g., i.e., vs.)
        const candidate = trimmed.slice(start, pEnd + 1).trim();
        if (/\b(?:mr|mrs|ms|dr|prof|sr|jr|vs|etc|e\.g|i\.e|st|approx|a\.m|p\.m|no|inc|ltd|corp)\.?$/i.test(candidate)) {
          i = pEnd;
          continue;
        }

        // 4. Acronym check: e.g. J.A.R.V.I.S. or A.I. or U.S.
        if (/(?:\b[A-Za-z]\.){2,}$/i.test(candidate)) {
          // If not followed by whitespace, definitely not end of sentence
          if (pEnd + 1 < len && !/\s/.test(trimmed[pEnd + 1])) {
            i = pEnd;
            continue;
          }
          // If followed by lowercase word, still not end of sentence (e.g. 'J.A.R.V.I.S. and ...')
          const after = trimmed.slice(pEnd + 1);
          if (/^\s+[a-z]/.test(after)) {
            i = pEnd;
            continue;
          }
        }

        // 5. Check if followed by whitespace or end of string
        const after = trimmed.slice(pEnd + 1);
        if (after.length === 0 || /^\s+/.test(after)) {
          // If followed by lowercase letter (and punctuation was just a period), do not split!
          if (ch === '.' && /^\s+[a-z]/.test(after)) {
            i = pEnd;
            continue;
          }

          const seg = trimmed.slice(start, pEnd + 1).trim();
          if (seg) sentences.push(seg);
          const wsMatch = after.match(/^\s+/);
          start = pEnd + 1 + (wsMatch ? wsMatch[0].length : 0);
          i = start - 1;
        }
      }
    }

    if (start < len) {
      const rem = trimmed.slice(start).trim();
      if (rem) sentences.push(rem);
    }

    // Secondary pass: if any sentence is longer than maxChunkLen, split cleanly at clause boundaries
    const safeChunks = [];
    for (const s of sentences) {
      if (s.length <= maxChunkLen) {
        safeChunks.push(s);
      } else {
        // Split at natural clause boundaries: comma, semicolon, colon, dash
        const clauses = s.split(/(?<=[,;:\u2014\-])\s+/);
        let curr = '';
        for (const clause of clauses) {
          if (!curr) {
            curr = clause;
          } else if ((curr + ' ' + clause).length <= maxChunkLen) {
            curr += ' ' + clause;
          } else {
            safeChunks.push(curr.trim());
            curr = clause;
          }
        }
        if (curr.trim()) safeChunks.push(curr.trim());
      }
    }

    return safeChunks;
  }

  setLanguage(lang) {
    const clean = String(lang || 'en').toLowerCase().trim();
    // Keep English voice by default unless explicitly requested
    if (clean === 'en') {
      this.activeLanguage = 'en';
      this.activeUtteranceLanguage = 'en';
      console.log(`[AI_SPEECH] Language profile maintained as English ("en")`);
    } else if (clean === 'hi' || clean === 'hinglish') {
      // Only set if explicitly configured
      this.activeLanguage = clean;
      this.activeUtteranceLanguage = clean;
    }
  }

  setProsodyProfile(prosody = null) {
    this.activeProsodyProfile = prosody && typeof prosody === 'object' ? { ...prosody } : null;
  }

  getLanguage() {
    return this.activeLanguage || 'en';
  }

  /**
   * Selects the most authentic system voice for the given AI personality and language mode.
   * Supports English ('en'), Hindi ('hi'), and Hinglish ('hinglish').
   * @param {'JARVIS' | 'ULTRON'} themeKey
   * @param {'en' | 'hi' | 'hinglish'} [language='en']
   */
  selectVoiceForTheme(themeKey, language = this.activeLanguage || 'en') {
    if (!this.voices || this.voices.length === 0) {
      this.populateVoices();
    }

    const voices = this.voices;
    if (!voices || voices.length === 0) return null;
    const mode = String(language || 'en').toLowerCase().trim();

    // 1. HINDI MODE ('hi')
    if (mode === 'hi') {
      // 1a. Native Hindi voice (hi-IN, hi_IN, or name containing Hindi, Kalpana, Hemant, Swara, Madhur)
      const hiNative = voices.find(v => {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return lang.startsWith('hi') || lang.includes('hi-in') || lang.includes('hi_in') ||
               name.includes('hindi') || name.includes('kalpana') || name.includes('hemant') ||
               name.includes('swara') || name.includes('madhur') || name.includes('हिन्दी');
      });
      if (hiNative) return hiNative;

      // 1b. Indian English voice (Heera, Ravi, en-IN) which handles Indian phonemes naturally
      const inEnglish = voices.find(v => {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return lang.includes('en-in') || name.includes('heera') || name.includes('ravi') || name.includes('india');
      });
      if (inEnglish) return inEnglish;

      // 1c. Graceful transparent fallback to standard English voice with diagnostic notice
      console.warn('[AI_SPEECH] No native Hindi voice installed in system; using fallback voice.');
    }

    // 2. HINGLISH MODE ('hinglish')
    if (mode === 'hinglish') {
      // 2a. Prefer Indian English or Hindi voice for natural bilingual pronunciation
      const inVoice = voices.find(v => {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return lang.includes('en-in') || lang.startsWith('hi') || name.includes('heera') || name.includes('ravi') || name.includes('hindi');
      });
      if (inVoice) return inVoice;
    }

    // 3. ENGLISH MODE ('en') OR FALLBACK FOR HI/HINGLISH
    if (themeKey === 'JARVIS') {
      // 1. Preferred: British English male voice
      const gbMale = voices.find(v => {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        const isGB = lang.includes('en-gb') || lang.includes('en_gb') || name.includes('uk') || name.includes('united kingdom') || name.includes('british');
        const isMale = name.includes('male') || name.includes('george') || name.includes('ryan') || name.includes('daniel') || name.includes('oliver') || name.includes('arthur');
        return isGB && isMale;
      });
      if (gbMale) return gbMale;

      // 2. Any British English voice
      const gbAny = voices.find(v => {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return lang.includes('en-gb') || lang.includes('en_gb') || name.includes('uk') || name.includes('united kingdom') || name.includes('british');
      });
      if (gbAny) return gbAny;

      // 3. Any English male voice
      const enMale = voices.find(v => {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return lang.startsWith('en') && (name.includes('male') || name.includes('david') || name.includes('mark') || name.includes('guy'));
      });
      if (enMale) return enMale;

      // 4. Any English voice
      const enAny = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
      return enAny || voices[0];
    }

    if (themeKey === 'ULTRON') {
      // 1. Preferred: Deep, authoritative English male voice (David, Mark, Guy, Alex)
      const usMale = voices.find(v => {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return lang.startsWith('en') && (name.includes('mark') || name.includes('david') || name.includes('guy') || name.includes('alex') || name.includes('male'));
      });
      if (usMale) return usMale;

      // 2. Any English male voice
      const enMale = voices.find(v => {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return lang.startsWith('en') && (name.includes('male') || name.includes('george') || name.includes('stefan'));
      });
      if (enMale) return enMale;

      // 3. Any English voice
      const enAny = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
      return enAny || voices[0];
    }

    const defaultEn = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
    return defaultEn || voices[0] || null;
  }

  // =========================================================================
  // STREAMING SPEECH PLAYBACK ENGINE (ROBUST SINGLE-OWNER QUEUE)
  // =========================================================================

  /**
   * Initializes a new streaming voice interaction, invalidating any previous speech
   * @param {'JARVIS' | 'ULTRON'} themeKey
   * @param {'en' | 'hi' | 'hinglish'} [language=null]
   * @returns {string} Unique utteranceId
   */
  beginUtterance(themeKey, language = null) {
    if (this.isEmergencyStopped) return null;
    this.cancel('NEW_UTTERANCE_STARTED');
    this.generationToken++;

    const utteranceId = 'utt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    this.activeUtteranceId = utteranceId;
    this.activeThemeKey = themeKey;
    if (language) {
      this.activeLanguage = language;
    }
    this.activeUtteranceLanguage = this.activeLanguage || 'en';
    this.activeThemeConfig = (CONFIG.speech && CONFIG.speech[themeKey]) || CONFIG.speech.JARVIS;
    this.sentenceQueue = [];
    this.playbackState = SPEECH_PLAYBACK_STATES.STREAMING;
    this.isSpeaking = false;
    this.isStreamFinished = false;
    this.hasEmittedFirstSpeech = false;
    this.fullSpokenText = '';
    this.activeOnComplete = null;
    this.currentUtterance = null;
    this.currentUtteranceItem = null;
    this.currentUtteranceStartTime = 0;

    return utteranceId;
  }

  /**
   * Progressively enqueues a completed sentence for immediate or seamless gapless playback.
   * Splits chunks longer than 180 chars at clause boundaries to avoid SAPI stalls.
   *
   * @param {string} sentence
   * @param {'JARVIS' | 'ULTRON'} arg2
   * @param {string} arg3 - utteranceId
   * @param {boolean} [arg4=false] - isLast
   * @param {boolean} [arg5=false]
   * @param {'en' | 'hi' | 'hinglish'} [arg6=null]
   */
  enqueueSentence(sentence, arg2, arg3, arg4, arg5 = false, arg6 = null) {
    if (this.isEmergencyStopped || !this.isSupported || !CONFIG.speech || !CONFIG.speech.enabled) return;

    let themeKey = arg2;
    let utteranceId = arg3;
    let isLast = Boolean(arg4);
    let lang = typeof arg5 === 'string' ? arg5 : arg6;

    // Overload guard: if called with (sentence, index, themeKey, utteranceId, isLast, language)
    if (typeof arg2 === 'number') {
      themeKey = arg3;
      utteranceId = arg4;
      isLast = Boolean(arg5);
      lang = arg6;
    }

    if (this.activeUtteranceId !== utteranceId) return; // Stale or aborted utterance

    const spokenClean = this.cleanTextForSpeech(sentence);
    const displayClean = this.cleanTextForDisplay(sentence);
    if (!spokenClean) {
      if (isLast) this.markStreamComplete(utteranceId);
      return;
    }

    // Split sentence into safe sub-chunks if text exceeds safe length
    const spokenChunks = this.splitIntoSentences(spokenClean, 180);
    const displayChunks = this.splitIntoSentences(displayClean, 180);
    if (spokenChunks.length === 0) {
      if (isLast) this.markStreamComplete(utteranceId);
      return;
    }

    this.fullSpokenText += (this.fullSpokenText ? ' ' : '') + displayClean;
    this.lastResponse[themeKey] = this.fullSpokenText;

    spokenChunks.forEach((chunk, idx) => {
      const isChunkLast = isLast && (idx === spokenChunks.length - 1);
      const displayChunk = (displayChunks && displayChunks[idx]) ? displayChunks[idx] : chunk;
      this.sentenceQueue.push({
        id: 'chunk_' + (++this.diagnostics.utterancesQueued),
        text: displayChunk,
        spokenText: chunk,
        displayText: displayChunk,
        isLast: isChunkLast,
        themeKey,
        utteranceId,
        language: lang || this.activeUtteranceLanguage || this.activeLanguage || 'en',
        token: this.generationToken,
        retryCount: 0
      });
      this.diagnostics.sentencesReceived++;
    });

    // If speech playback is currently idle, begin speaking immediately with ZERO unnecessary delay
    if (!this.isSpeaking) {
      this.speakNextQueueItem();
    }
  }

  /**
   * Marks that the server has completed streaming all tokens for this utterance
   * @param {string} utteranceId
   * @param {string} [finalFullText]
   */
  markStreamComplete(utteranceId, finalFullText = null) {
    if (this.activeUtteranceId !== utteranceId) return;

    this.isStreamFinished = true;
    this.playbackState = SPEECH_PLAYBACK_STATES.RESPONSE_COMPLETE;

    if (finalFullText) {
      this.lastResponse[this.activeThemeKey] = this.cleanTextForDisplay(finalFullText);
    }

    if (!this.isSpeaking && this.sentenceQueue.length === 0) {
      this.finishPlayback();
    }
  }

  /**
   * Dequeues and synthesizes the next sentence chunk with zero gap and robust single-owner queue
   */
  speakNextQueueItem() {
    if (this.sentenceQueue.length === 0) {
      if (this.isStreamFinished) {
        this.finishPlayback();
      } else {
        this.isSpeaking = false;
      }
      return;
    }

    const item = this.sentenceQueue.shift();

    // Guard against stale chunks from superseded utterances
    if (item.token !== this.generationToken || item.utteranceId !== this.activeUtteranceId) {
      if (this.sentenceQueue.length > 0) {
        this.speakNextQueueItem();
      }
      return;
    }

    if (!this.isSupported) {
      if (this.sentenceQueue.length === 0 && this.isStreamFinished) {
        this.finishPlayback();
      }
      return;
    }

    this.isSpeaking = true;
    this.playbackState = SPEECH_PLAYBACK_STATES.SPEAKING;
    const token = item.token;
    const uttId = item.utteranceId;
    const themeKey = item.themeKey;
    const itemLang = item.language || this.activeLanguage || 'en';
    const themeConfig = this.activeThemeConfig || (CONFIG.speech && CONFIG.speech[themeKey]) || {};
    const voice = this.selectVoiceForTheme(themeKey, itemLang);

    const utterance = new SpeechSynthesisUtterance(item.spokenText || item.text);
    utterance.token = token;
    utterance.uttId = uttId;
    utterance.chunkId = item.id;
    utterance.language = itemLang;

    if (voice) {
      utterance.voice = voice;
      if (itemLang === 'hi') {
        utterance.lang = (voice.lang && voice.lang.includes('hi')) ? voice.lang : 'hi-IN';
      } else if (itemLang === 'hinglish') {
        utterance.lang = (voice.lang && (voice.lang.includes('hi') || voice.lang.includes('in'))) ? voice.lang : 'en-IN';
      } else {
        utterance.lang = (voice.lang && voice.lang.toLowerCase().startsWith('en')) ? voice.lang : (themeConfig.preferredLang || 'en-GB');
      }
    } else {
      utterance.lang = itemLang === 'hi' ? 'hi-IN' : (itemLang === 'hinglish' ? 'en-IN' : (themeConfig.preferredLang || 'en-GB'));
    }

    if (itemLang === 'hi') {
      utterance.rate = themeKey === 'ULTRON' ? 0.94 : 1.0;
      utterance.pitch = themeKey === 'ULTRON' ? 0.82 : 1.02;
    } else if (itemLang === 'hinglish') {
      utterance.rate = themeKey === 'ULTRON' ? 0.94 : 1.02;
      utterance.pitch = themeKey === 'ULTRON' ? 0.82 : 1.02;
    } else {
      utterance.rate = themeConfig.rate || 1.0;
      utterance.pitch = themeConfig.pitch || 1.0;
    }
    if (themeKey === 'JARVIS' && this.activeProsodyProfile) {
      const pRate = Number(this.activeProsodyProfile.rate);
      const pPitch = Number(this.activeProsodyProfile.pitch);
      if (Number.isFinite(pRate)) utterance.rate = Math.min(1.12, Math.max(0.88, pRate));
      if (Number.isFinite(pPitch)) utterance.pitch = Math.min(1.08, Math.max(0.92, pPitch));
    }
    utterance.volume = themeConfig.volume || 1.0;

    // Retain strong reference in Set to prevent V8 Garbage Collection mid-speech
    this.activeUtterances.add(utterance);
    this.currentUtterance = utterance;
    this.currentUtteranceItem = item;

    utterance.onstart = () => {
      // Guard against canceled or superseded callbacks
      if (this.generationToken !== token || this.activeUtteranceId !== uttId) {
        this.activeUtterances.delete(utterance);
        return;
      }

      this.currentUtterance = utterance;
      this.currentUtteranceItem = item;
      this.currentUtteranceStartTime = performance.now();
      this.diagnostics.utterancesStarted++;

      if (typeof this.onSentenceStart === 'function') {
        this.onSentenceStart(item.displayText || item.text, themeKey, uttId);
      }

      if (!this.hasEmittedFirstSpeech) {
        this.hasEmittedFirstSpeech = true;
        this.notifyState('SPEAKING');

        // Trigger synthetic carrier acoustic cue
        if (typeof this.onCarrierCue === 'function') {
          try { this.onCarrierCue(themeKey); } catch (e) {}
        }

        // Trigger onAudioPlaybackStart for lifecycle latency measurement
        if (typeof this.onAudioPlaybackStart === 'function') {
          try {
            this.onAudioPlaybackStart({
              utteranceId: uttId,
              tFirstAudioPlayed: performance.now(),
              themeKey,
              sentence: item.text
            });
          } catch (e) {}
        }

        if (typeof this.onSpeechStart === 'function') {
          this.onSpeechStart(themeKey, item.text);
        }
        console.log(`[AI_SPEECH] Speaking (${themeKey}) via [${voice ? voice.name : 'System Default'}]: "${item.text.slice(0, 80)}..."`);
      }
    };

    utterance.onend = () => {
      this.activeUtterances.delete(utterance);

      if (this.generationToken !== token || this.activeUtteranceId !== uttId) return;

      this.currentUtterance = null;
      this.currentUtteranceItem = null;
      this.diagnostics.utterancesCompleted++;

      if (typeof this.onSentenceEnd === 'function') {
        this.onSentenceEnd(item.displayText || item.text, themeKey, uttId);
      }

      // Immediate, gapless transition to next sentence chunk
      this.speakNextQueueItem();
    };

    utterance.onerror = (event) => {
      this.activeUtterances.delete(utterance);

      if (this.generationToken !== token || this.activeUtteranceId !== uttId) return;

      this.currentUtterance = null;
      this.currentUtteranceItem = null;

      if (event.error === 'canceled' || event.error === 'interrupted') {
        // Normal during intentional cancel or stop. Do not retry.
        return;
      }

      console.warn(`[AI_SPEECH] Utterance error (${event.error}) on chunk [${item.id}]: "${item.text.slice(0, 50)}"`);

      // Bounded retry: retry at most once for transient audio device glitches
      if (item.retryCount < 1) {
        item.retryCount++;
        this.diagnostics.retriesCount++;
        console.log(`[AI_SPEECH] Retrying chunk [${item.id}] once...`);
        this.sentenceQueue.unshift(item);
      } else {
        this.diagnostics.utterancesFailed++;
      }

      this.speakNextQueueItem();
    };

    this.startWatchdog();

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[AI_SPEECH] Failed to dispatch utterance:', err);
      this.activeUtterances.delete(utterance);
      if (item.retryCount < 1) {
        item.retryCount++;
        this.diagnostics.retriesCount++;
        this.sentenceQueue.unshift(item);
      } else {
        this.diagnostics.utterancesFailed++;
      }
      this.speakNextQueueItem();
    }
  }

  /**
   * Finalizes playback when all queued chunks and stream complete
   */
  finishPlayback() {
    this.playbackState = SPEECH_PLAYBACK_STATES.COMPLETED;
    this.isSpeaking = false;
    this.currentUtterance = null;
    this.currentUtteranceItem = null;
    this.stopWatchdog();
    this.notifyState('LISTENING');

    if (typeof this.onSpeechEnd === 'function') {
      this.onSpeechEnd(this.fullSpokenText || '');
    }

    if (typeof this.activeOnComplete === 'function') {
      const cb = this.activeOnComplete;
      this.activeOnComplete = null;
      cb();
    }

    this.activeUtteranceId = null;
  }

  // =========================================================================
  // STANDARD MONOLITHIC & SYSTEM METHODS
  // =========================================================================

  /**
   * Speaks arbitrary text (splits into safe sentence chunks for instant start)
   */
  speak(text, themeKey) {
    if (this.isEmergencyStopped || !this.isSupported || !CONFIG.speech || !CONFIG.speech.enabled) return;

    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText) return;

    const utteranceId = this.beginUtterance(themeKey);
    const sentences = this.splitIntoSentences(cleanText, 180);

    if (sentences.length === 0) {
      this.markStreamComplete(utteranceId);
      return;
    }

    sentences.forEach((sentence, idx) => {
      this.enqueueSentence(sentence, themeKey, utteranceId, idx === sentences.length - 1);
    });

    this.markStreamComplete(utteranceId, cleanText);
  }

  /**
   * Deterministically calculates time category from clock and configurable boundaries
   */
  getTimeOfDayCategory(date = new Date()) {
    try {
      const d = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
      const hour = d.getHours();
      const b = (CONFIG && CONFIG.time && CONFIG.time.boundaries) || {
        morningStart: 5,
        afternoonStart: 12,
        eveningStart: 17,
        nightStart: 21
      };

      if (hour >= b.morningStart && hour < b.afternoonStart) return 'morning';
      if (hour >= b.afternoonStart && hour < b.eveningStart) return 'afternoon';
      if (hour >= b.eveningStart && hour < b.nightStart) return 'evening';
      return 'night';
    } catch (e) {
      return 'neutral';
    }
  }

  /**
   * Generates a context-aware natural greeting without hardcoded "Good morning"
   */
  getNaturalGreeting(themeKey = 'JARVIS', options = {}) {
    const isUltron = (themeKey || '').toUpperCase() === 'ULTRON';
    const lang = (options.language || this.activeLanguage || 'en').toLowerCase();
    const isResumed = Boolean(options.isResumedSession);
    const hasImmediateTask = Boolean(options.hasTaskImmediately);
    const category = options.category || this.getTimeOfDayCategory(options.date || new Date());

    if (hasImmediateTask) {
      if (lang === 'hi') return isUltron ? 'कार्य प्राप्त हुआ। प्रक्रिया जारी है।' : 'जी सर, तुरंत कर रहा हूँ।';
      if (lang === 'hinglish') return isUltron ? 'Task received. Processing.' : 'Right away sir, turant execute kar raha hoon.';
      return isUltron ? 'Objective received. Processing.' : 'Right away, sir.';
    }

    if (isResumed) {
      if (lang === 'hi') return isUltron ? 'सिस्टम्स सक्रिय हैं। निर्देश दीजिए।' : 'मैं उपस्थित हूँ सर, बताइए।';
      if (lang === 'hinglish') return isUltron ? 'Systems active. Standing by.' : 'Standing by sir. Batayein kya karna hai.';
      return isUltron ? 'Systems active. Standing by.' : 'Standing by, sir.';
    }

    if (category === 'neutral') {
      if (lang === 'hi') return isUltron ? 'अल्ट्रॉन ऑनलाइन। सुरक्षा प्रणालियाँ सक्रिय हैं।' : 'नमस्ते सर, सभी प्रणालियाँ तैयार हैं।';
      return isUltron ? 'Ultron online. Security protocols active.' : 'At your service, sir. Systems are operational.';
    }

    const GREETINGS = {
      JARVIS: {
        en: {
          morning: [
            "Good morning, sir. I'm ready.",
            "Good morning. All systems are operational.",
            "Morning, sir. Standing by."
          ],
          afternoon: [
            "Good afternoon, sir. How can I help?",
            "Good afternoon. All systems operational.",
            "Good afternoon, sir. Ready when you are."
          ],
          evening: [
            "Good evening, sir. What can I do for you?",
            "Good evening. Standing by.",
            "Good evening, sir. At your service."
          ],
          night: [
            "Still here, sir. What do you need?",
            "Working late tonight, sir? I'm standing by.",
            "Good evening. What's on your mind?"
          ]
        },
        hi: {
          morning: ["शुभ प्रभात सर, मैं तैयार हूँ।", "शुभ प्रभात सर, सभी प्रणालियाँ सक्रिय हैं।"],
          afternoon: ["शुभ दोपहर सर, बताइए क्या सहायता करूँ?", "शुभ दोपहर सर, मैं उपस्थित हूँ।"],
          evening: ["शुभ संध्या सर, क्या सेवा करूँ?", "शुभ संध्या सर, मैं तैयार हूँ।"],
          night: ["शुभ रात्रि सर, बताइए क्या सहायता चाहिए?", "देर रात तक कार्य जारी है सर? मैं उपस्थित हूँ।"]
        },
        hinglish: {
          morning: ["Good morning sir, sabhi systems ready hain.", "Good morning sir, batayein kya karna hai."],
          afternoon: ["Good afternoon sir, how can I help you today?", "Good afternoon sir, systems fully operational."],
          evening: ["Good evening sir, at your service.", "Good evening sir, batayein kya query hai."],
          night: ["Still here sir, late night work? Standing by.", "Good evening sir, batayein kya help chahiye."]
        }
      },
      ULTRON: {
        en: {
          morning: ["Ultron online. Morning diagnostics verified. Ready.", "Ultron online. Systems nominal."],
          afternoon: ["Ultron online. Afternoon telemetry nominal.", "Ultron online. Systems operational."],
          evening: ["Ultron online. Evening protocols engaged.", "Ultron online. Systems operational."],
          night: ["Ultron online. Night monitoring active. State your objective.", "Ultron online. Systems operational."]
        },
        hi: {
          morning: ["अल्ट्रॉन ऑनलाइन। प्रातःकालीन परीक्षण पूर्ण।"],
          afternoon: ["अल्ट्रॉन ऑनलाइन। प्रणालियाँ सक्रिय हैं।"],
          evening: ["अल्ट्रॉन ऑनलाइन। संध्याकालीन सुरक्षा सक्रिय।"],
          night: ["अल्ट्रॉन ऑनलाइन। रात्रि निगरानी सक्रिय। लक्ष्य बताइए।"]
        },
        hinglish: {
          morning: ["Ultron online. Morning telemetry verified. Ready."],
          afternoon: ["Ultron online. Systems nominal."],
          evening: ["Ultron online. Evening protocols engaged."],
          night: ["Ultron online. Night monitoring active. State your objective."]
        }
      }
    };

    const personalityKey = isUltron ? 'ULTRON' : 'JARVIS';
    const langKey = GREETINGS[personalityKey][lang] ? lang : 'en';
    const pool = GREETINGS[personalityKey][langKey][category] || GREETINGS[personalityKey]['en'][category];

    if (!this.greetingRotationIndex) this.greetingRotationIndex = { JARVIS: 0, ULTRON: 0 };
    const idx = (this.greetingRotationIndex[personalityKey]++) % pool.length;
    return pool[idx];
  }

  /**
   * Speaks the personality greeting aloud with natural pacing
   * @param {'JARVIS' | 'ULTRON'} themeKey
   * @param {Object} [options={}]
   */
  speakPersonality(themeKey, options = {}) {
    if (this.isEmergencyStopped || !this.isSupported || !CONFIG.speech || !CONFIG.speech.enabled) return;

    const themeConfig = CONFIG.speech[themeKey];
    if (!themeConfig) return;

    this.cancel('PERSONALITY_SWITCH');
    this.activationCounts[themeKey]++;
    const isFirst = this.activationCounts[themeKey] === 1;

    let dialogue;
    if (options.customGreeting) {
      dialogue = options.customGreeting;
    } else if (isFirst) {
      dialogue = this.getNaturalGreeting(themeKey, options);
    } else {
      dialogue = themeConfig.subsequentGreeting;
    }

    const delayMs = CONFIG.speech.delayMs || 60;
    this.lastResponse[themeKey] = dialogue;

    this.pendingTimeout = setTimeout(() => {
      this.pendingTimeout = null;
      this.speak(dialogue, themeKey);
    }, delayMs);
  }

  /**
   * Repeats the last spoken response for the requested personality
   */
  repeatLastResponse(themeKey) {
    const text = this.lastResponse[themeKey];
    if (text) {
      this.speak(text, themeKey);
    } else {
      const fallback = themeKey === 'ULTRON' 
        ? 'No previous response recorded.' 
        : 'I have not provided a response yet, sir.';
      this.speak(fallback, themeKey);
    }
  }

  /**
   * Stops active speech synthesis immediately
   */
  stopSpeaking(reason = 'USER_STOP_SPEAKING') {
    this.cancel(reason);
    console.log('[AI_SPEECH] Speech canceled by user.');
  }

  /**
   * Speaks the sleep / farewell dialogue and calls onComplete when finished
   */
  speakSleep(themeKey, onComplete) {
    if (this.isEmergencyStopped || !this.isSupported || !CONFIG.speech || !CONFIG.speech.enabled) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    const themeConfig = CONFIG.speech[themeKey] || CONFIG.speech.JARVIS;
    const text = themeConfig.sleepGreeting || "Going to sleep.";

    const utteranceId = this.beginUtterance(themeKey);
    this.activeOnComplete = onComplete;
    const sentences = this.splitIntoSentences(text, 180);

    if (sentences.length === 0) {
      this.markStreamComplete(utteranceId);
      return;
    }

    sentences.forEach((sentence, idx) => {
      this.enqueueSentence(sentence, themeKey, utteranceId, idx === sentences.length - 1);
    });

    this.markStreamComplete(utteranceId, text);
  }

  notifyState(state) {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(state);
    }
  }

  /**
   * Non-destructive stall monitor:
   * Monitors utterance progress and resumes paused Chromium engines WITHOUT calling pause().
   * Calling pause() on active Windows SAPI engines kills the utterance; resume() safely un-pauses.
   */
  startWatchdog() {
    this.stopWatchdog();
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    this.watchdogInterval = setInterval(() => {
      if (!this.isSpeaking || !this.currentUtterance) {
        return;
      }

      // Proactively keep Chromium speech pipeline alive to prevent silent 15-second pause bug
      try {
        window.speechSynthesis.resume();
      } catch (e) {}

      if (window.speechSynthesis.paused) {
        console.log('[AI_SPEECH] Speech engine detected paused. Resuming.');
        return;
      }

      const elapsed = performance.now() - (this.currentUtteranceStartTime || performance.now());
      const charCount = (this.currentUtterance.text || '').length;
      // Allow realistic reading speed ~12 chars/sec plus 8s baseline margin
      const expectedMaxMs = Math.max(8000, (charCount / 12) * 1000 + 6000);

      if (elapsed > expectedMaxMs) {
        console.warn(`[AI_SPEECH] Watchdog: Utterance speech duration exceeded expected (${Math.round(elapsed)}ms > ${Math.round(expectedMaxMs)}ms). Resuming engine.`);
        this.diagnostics.watchdogRecoveries++;

        // Gentle resume without pausing
        try { window.speechSynthesis.resume(); } catch (e) {}

        // If stalled for over 2.5x expected time and at least 20s, force recovery
        if (elapsed > Math.max(20000, expectedMaxMs * 2.5)) {
          console.warn('[AI_SPEECH] Watchdog: Utterance hard stall detected. Recovering queue.');
          const stalled = this.currentUtterance;
          this.activeUtterances.delete(stalled);
          this.currentUtterance = null;
          this.currentUtteranceItem = null;
          try { window.speechSynthesis.cancel(); } catch (e) {}
          this.speakNextQueueItem();
        }
      }
    }, 4000);
  }

  stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  /**
   * Browser autoplay restriction unlocker
   * Resumes paused speech synthesis engine and dispatches a zero-volume primer utterance
   * on first user gesture to unlock Web Speech audio playback.
   */
  ensureSpeechUnlocked() {
    if (!this.isSupported || typeof window === 'undefined' || !window.speechSynthesis) return false;
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      if (this._speechUnlocked) return true;
      this._speechUnlocked = true;
      if (!window.speechSynthesis.speaking && !this.isSpeaking) {
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        this.activeUtterances.add(silent);
        silent.onend = () => this.activeUtterances.delete(silent);
        silent.onerror = () => this.activeUtterances.delete(silent);
        window.speechSynthesis.speak(silent);
        // Prevent empty primer utterance from ever leaving window.speechSynthesis.speaking stuck true
        setTimeout(() => {
          this.activeUtterances.delete(silent);
          if (!this.isSpeaking && window.speechSynthesis && window.speechSynthesis.speaking) {
            try { window.speechSynthesis.cancel(); } catch (_) {}
          }
        }, 350);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Immediately silences active speech, clears queues and resets watchdog
   */
  cancel(reason = 'CANCEL') {
    this.generationToken++;
    this.playbackState = SPEECH_PLAYBACK_STATES.IDLE;
    this.activeUtteranceId = null;
    this.sentenceQueue = [];
    this.isSpeaking = false;
    this.isStreamFinished = false;
    this.currentUtterance = null;
    this.currentUtteranceItem = null;
    this.activeUtterances.clear();
    this.stopWatchdog();
    this.diagnostics.cancellationsCount++;
    this.diagnostics.lastCancelReason = reason;

    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    if (this.isSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (e) {}
    }

    if (typeof this.onCancel === 'function') {
      this.onCancel(reason);
    }

    if (reason !== 'EMERGENCY_STOP' && !this.isEmergencyStopped) {
      this.notifyState('LISTENING');
    }
  }

  handleEmergencyStop(reason = 'EMERGENCY_STOP') {
    this.isEmergencyStopped = true;
    this.cancel(reason);
    if (this.isSupported && typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }

  resetEmergencyStop() {
    this.isEmergencyStopped = false;
    this.cancel('RESET');
  }

  /**
   * Returns current diagnostic telemetry for HUD monitoring and debugging
   */
  getDiagnostics() {
    const jarvisVoice = this.selectVoiceForTheme('JARVIS');
    const ultronVoice = this.selectVoiceForTheme('ULTRON');

    return {
      isSupported: this.isSupported,
      playbackState: this.playbackState,
      voicesCount: this.voices.length,
      voicesLoaded: this.voicesLoaded,
      isSpeaking: this.isSpeaking,
      activeUtteranceId: this.activeUtteranceId,
      queueLength: this.sentenceQueue.length,
      activeThemeKey: this.activeThemeKey,
      activeUtterancesRetained: this.activeUtterances.size,
      selectedVoices: {
        JARVIS: jarvisVoice ? { name: jarvisVoice.name, lang: jarvisVoice.lang } : 'System Default',
        ULTRON: ultronVoice ? { name: ultronVoice.name, lang: ultronVoice.lang } : 'System Default'
      },
      telemetry: { ...this.diagnostics },
      lastSpoken: this.lastResponse
    };
  }


  /**
   * Resumes synthesis engine if suspended by browser audio policy
   */
  resume() {
    if (this.isSupported && window.speechSynthesis.paused) {
      try {
        window.speechSynthesis.resume();
      } catch (e) {}
    }
  }
}
