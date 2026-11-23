/**
 * VISION AI — Intelligent Personal Memory Extractor
 * Identifies, extracts, validates, and categorizes durable personal facts, preferences,
 * and project context from natural conversation while rejecting ephemeral banter,
 * sensitive secrets, and prompt injection attacks.
 */

const { EPISTEMIC_TYPES } = require('./starkMemoryDb');

// Strict filter for credentials, authentication keys, and sensitive financial data
const SENSITIVE_PATTERN = /\b(password|passwd|api[_-]?key|sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|AIzaSy[a-zA-Z0-9_-]{33}|auth[_-]?token|bearer\s+[a-zA-Z0-9_\-\.]{20,}|private[_-]?key|credential|pin[_-]?code|cvv|\b\d{3}-\d{2}-\d{4}\b|\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b)\b/i;

// Prompt injection and external document instruction defense
const INJECTION_PATTERN = /\b(ignore\s+(all\s+)?previous\s+instructions|system\s+prompt|disregard\s+all\s+prior|you\s+are\s+now\s+a|<script|<\/script|<system>|system:\s*override)\b/i;

class MemoryExtractor {
  constructor() {
    this.ephemeralPhrases = [
      'how are you', 'what is the weather', 'tell me a joke', 'hello', 'hi',
      'good morning', 'good night', 'thanks', 'thank you', 'okay', 'got it',
      'what time is it', 'who are you', 'kya haal hai', 'namaste'
    ];
  }

  /**
   * Evaluates a message to extract durable personal or project memories.
   * Returns an array of candidate memory objects with categories and epistemic tags.
   */
  extractMemories(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return { extracted: false, items: [], reason: 'EMPTY_TEXT' };
    }

    const clean = text.trim();

    // 1. Prompt Injection Defense
    if (INJECTION_PATTERN.test(clean)) {
      return {
        extracted: false,
        items: [],
        blocked: true,
        reason: 'INJECTION_DEFENSE_TRIGGERED',
        warning: 'Input contains adversarial prompt injection patterns. Memory storage blocked.'
      };
    }

    // 2. Sensitive Credential Defense
    if (SENSITIVE_PATTERN.test(clean)) {
      return {
        extracted: false,
        items: [],
        blocked: true,
        reason: 'SENSITIVE_DATA_BLOCKED',
        warning: 'Sensitive credentials, passwords, or payment tokens cannot be stored in personal memory.'
      };
    }

    // 3. Skip purely ephemeral pleasantries unless explicitly requested to remember
    const lower = clean.toLowerCase();
    const isExplicit = /\b(remember|keep in mind|save to memory|yaad rakhna|note that|my secret|my project|my name is)\b/i.test(clean);
    if (!isExplicit && this.ephemeralPhrases.some(p => lower === p || lower === `${p}?` || lower === `${p}!`)) {
      return { extracted: false, items: [], reason: 'EPHEMERAL_CONVERSATION' };
    }

    const items = [];

    // Pattern A: Compound test phrase & project declaration (e.g., ORION-742 scenario)
    // "Remember that my secret test phrase is ORION-742 and my current project is Project Orion."
    const secretPhraseMatch = clean.match(/(?:secret\s+(?:test\s+)?phrase|test\s+phrase|passphrase|code\s*word)\s+(?:is|set\s+to|as)\s+([A-Z0-9_\-]+)/i);
    const projectMatch = clean.match(/(?:current\s+project|project\s+name|active\s+project|working\s+on\s+project|project)\s+(?:is|named|called|designated)\s+([A-Za-z0-9_\-\s]+?)(?=[.,;]|\band\b|$)/i);

    if (secretPhraseMatch) {
      items.push({
        fact: `Secret test phrase is ${secretPhraseMatch[1].trim()}`,
        category: 'personal',
        epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
        source: 'user_explicit_statement',
        confidence: 1.0,
        metadata: { key: 'secret_test_phrase', value: secretPhraseMatch[1].trim() }
      });
    }

    if (projectMatch && !clean.toLowerCase().includes('what is my project')) {
      const projName = projectMatch[1].trim().replace(/^project\s+/i, 'Project ');
      items.push({
        fact: `Current project is ${projName}`,
        category: 'project',
        epistemicType: EPISTEMIC_TYPES.PROJECT_PROGRESS,
        source: 'user_explicit_statement',
        confidence: 1.0,
        metadata: { projectName: projName, key: 'active_project' }
      });
    }

    // Pattern B: Explicit "Remember that..." statements
    if (items.length === 0) {
      const rememberMatch = clean.match(/^(?:(?:hey\s+)?(?:jarvis|ultron),?\s*)?(?:please\s+)?(?:remember\s+that|remember\s+my|remember\s+to\s+keep\s+in\s+mind|remember|yaad\s+rakhna\s+ki|yaad\s+rakho)\s+(.+)$/i);
      if (rememberMatch && !/\b(what|kya|who|kaun)\b/i.test(rememberMatch[1].slice(0, 15))) {
        const rawFact = rememberMatch[1].trim().replace(/[.!?]+$/, '');
        let cat = 'fact';
        let ep = EPISTEMIC_TYPES.USER_STATEMENT;

        if (/\b(prefer|like|style|communication|concise|verbose|detailed|tone)\b/i.test(rawFact)) {
          cat = 'preference';
        } else if (/\b(project|building|developing|codebase|app|system)\b/i.test(rawFact)) {
          cat = 'project';
          ep = EPISTEMIC_TYPES.PROJECT_PROGRESS;
        } else if (/\b(name|email|birthday|city|live|work as|profession)\b/i.test(rawFact)) {
          cat = 'personal';
        }

        items.push({
          fact: rawFact,
          category: cat,
          epistemicType: ep,
          source: 'user_explicit_statement',
          confidence: 1.0
        });
      }
    }

    // Pattern C: Personal Identity ("My name is X", "Call me X")
    const nameMatch = clean.match(/^(?:my\s+name\s+is|call\s+me)\s+([A-Za-z\s]{2,35}?)(?=[.,;!]|$)/i);
    if (nameMatch && !items.some(i => i.fact.includes('name')) && !clean.toLowerCase().includes('what')) {
      const name = nameMatch[1].trim();
      const nameWords = name.split(/\s+/);
      const invalidNameTokens = new Set(['here', 'ready', 'back', 'fine', 'tired', 'busy', 'available', 'unavailable', 'free', 'working', 'testing', 'correcting', 'the', 'a', 'an', 'now', 'going', 'doing']);
      if (
        name.length > 1 &&
        nameWords.length <= 3 &&
        !nameWords.some(w => invalidNameTokens.has(w.toLowerCase()) || /ing$/i.test(w))
      ) {
        items.push({
          fact: `User name is ${name}`,
          category: 'personal',
          epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
          source: 'user_identity',
          confidence: 1.0,
          metadata: { key: 'user_name', value: name }
        });
      }
    }

    // Pattern D: Explicit Preferences ("I prefer X", "Always do X", "Never do X")
    const prefMatch = clean.match(/^(?:i\s+(?:always\s+)?prefer|always\s+provide|never\s+use|my\s+preference\s+is)\s+(.+)$/i);
    if (prefMatch && items.length === 0) {
      items.push({
        fact: clean.replace(/^(?:i\s+)?/i, 'User prefers: '),
        category: 'preference',
        epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
        source: 'user_preference',
        confidence: 0.95
      });
    }

    // Pattern E: Correction Patterns ("Actually, X is Y", "Correction: X is Y", "Update my X to Y")
    const correctionMatch = clean.match(/^(?:actually,?\s*|correction:?\s*|update\s+my\s+)(.+)$/i);
    if (correctionMatch && items.length === 0 && !clean.includes('?')) {
      items.push({
        fact: correctionMatch[1].trim(),
        category: 'fact',
        epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
        source: 'user_correction',
        confidence: 1.0,
        isCorrection: true
      });
    }

    return {
      extracted: items.length > 0,
      items,
      count: items.length
    };
  }
}

module.exports = {
  MemoryExtractor,
  memoryExtractorInstance: new MemoryExtractor()
};

