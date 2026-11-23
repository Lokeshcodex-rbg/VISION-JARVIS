/**
 * VISION AI — Advanced Language Intelligence Engine
 * server/languageIntelligenceEngine.js
 * 
 * Implements Section 1 of the Extreme Capability Expansion Directive:
 * - Deep contextual understanding & reference resolution (pronouns, temporal references, former/latter)
 * - Complex instruction interpretation & ambiguity detection
 * - Multi-intent detection & decomposition
 * - Question decomposition into atomic queries
 * - Semantic understanding, paraphrase detection & Levenshtein similarity
 * - Factual consistency & contradiction detection
 * - Epistemic uncertainty estimation & confidence calibration
 * - Knowledge boundary awareness (detecting unknown domains vs grounded knowledge)
 * - Adaptive response detail scaling (concise, balanced, in-depth)
 * - Multilingual code-switching detection (English, Hindi, Hinglish)
 */

'use strict';

const crypto = require('crypto');

// Known domain entity patterns
const ENTITY_PATTERNS = {
  TEMPORAL: /\b(yesterday|today|tomorrow|last\s+(?:week|month|year)|next\s+(?:week|month|year)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d{4}-\d{2}-\d{2})\b/gi,
  NUMERIC: /\b\d+(?:\.\d+)?(?:%|k|m|b|gb|mb|kb|hz|khz|mhz|ghz|ms|s|min|hr)?\b/gi,
  CODE_SYNTAX: /\b(function|def|class|const|let|var|return|import|export|select|from|where|insert|delete|update)\b/gi,
  HINGLISH_MARKERS: /\b(hai|hain|karo|karein|karna|kyun|kaise|kya|bhai|yaar|mujhe|mera|meri|mere|aap|tum|hum|nahi|hoga|hogi|achha|theek|samajh|batao)\b/gi,
  HINDI_DEVANAGARI: /[\u0900-\u097F]/g
};

// Ambiguity trigger keywords
const AMBIGUOUS_WORDS = [
  'it', 'that', 'this', 'they', 'them', 'fast', 'soon', 'better', 'optimal',
  'fix it', 'do that', 'update it', 'clean it', 'run it', 'later'
];

class LanguageIntelligenceEngine {
  constructor(options = {}) {
    this.options = options;
  }

  // =========================================================================
  // 1. AMBIGUITY RESOLUTION & DETECTION
  // =========================================================================

  /**
   * Analyzes an instruction for ambiguity and determines whether clarification is required.
   */
  detectAmbiguity(text, contextHistory = []) {
    const clean = String(text || '').trim();
    if (!clean) return { isAmbiguous: true, reason: 'EMPTY_INPUT', confidence: 1.0 };

    const tokens = clean.toLowerCase().split(/\s+/);
    const ambiguousTokensFound = [];
    for (const t of tokens) {
      if (AMBIGUOUS_WORDS.includes(t)) {
        ambiguousTokensFound.push(t);
      }
    }

    // Check if context resolves the ambiguity
    const hasHistory = Array.isArray(contextHistory) && contextHistory.length > 0;
    const isVagueCommand = tokens.length <= 3 && ambiguousTokensFound.length > 0;

    let isAmbiguous = false;
    let clarificationPrompt = null;
    let resolution = null;

    if (isVagueCommand && !hasHistory) {
      isAmbiguous = true;
      clarificationPrompt = `Could you please clarify what specific entity or action you mean by "${ambiguousTokensFound.join(', ')}"?`;
    } else if (hasHistory && ambiguousTokensFound.length > 0) {
      // Resolve against latest context subject
      const latestTurn = contextHistory[contextHistory.length - 1];
      const prevText = typeof latestTurn === 'string' ? latestTurn : (latestTurn?.content || latestTurn?.message || '');
      resolution = `Resolved [${ambiguousTokensFound.join(', ')}] in context of previous topic: "${prevText.slice(0, 60)}..."`;
    }

    return {
      isAmbiguous,
      ambiguousTokens: ambiguousTokensFound,
      clarificationRequired: isAmbiguous,
      clarificationPrompt,
      resolution,
      tokenCount: tokens.length
    };
  }

  // =========================================================================
  // 2. MULTI-INTENT DETECTION & DECOMPOSITION
  // =========================================================================

  /**
   * Identifies multiple distinct intents joined by conjunctions or compound directives.
   */
  detectMultipleIntents(text) {
    const clean = String(text || '').trim();
    if (!clean) return { hasMultipleIntents: false, intents: [] };

    // Common intent splitting phrases: "and also", "then", "after that", "furthermore", "and please"
    const splitRegex = /\b(?:and\s+also|then|after\s+that|afterwards|subsequently|furthermore|as\s+well\s+as|and\s+please)\b|[;]|\band(?=\s+(?:create|build|run|search|test|deploy|delete|update|send|summarize|calculate|find))\b/i;
    
    const clauses = clean.split(splitRegex).map(c => c.trim()).filter(c => c.length > 3);
    const intents = [];

    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      let intentCategory = 'GENERAL_QUERY';

      if (/\b(search|find|lookup|research|arxiv)\b/i.test(clause)) {
        intentCategory = 'RESEARCH';
      } else if (/\b(code|function|debug|refactor|test|compile|script|python|javascript)\b/i.test(clause)) {
        intentCategory = 'CODING';
      } else if (/\b(calculate|math|integral|derivative|matrix|solve|equation)\b/i.test(clause)) {
        intentCategory = 'MATHEMATICS';
      } else if (/\b(launch|open|window|desktop|app|click|close)\b/i.test(clause)) {
        intentCategory = 'DESKTOP_AUTOMATION';
      } else if (/\b(email|whatsapp|message|send|draft|contact)\b/i.test(clause)) {
        intentCategory = 'COMMUNICATION';
      } else if (/\b(database|sql|table|schema|query|insert|select)\b/i.test(clause)) {
        intentCategory = 'DATABASE';
      } else if (/\b(plan|schedule|roadmap|steps|decompose)\b/i.test(clause)) {
        intentCategory = 'PLANNING';
      }

      intents.push({
        stepIndex: i + 1,
        rawClause: clause,
        category: intentCategory
      });
    }

    return {
      hasMultipleIntents: intents.length > 1,
      totalIntents: intents.length,
      intents
    };
  }

  // =========================================================================
  // 3. CONVERSATIONAL REFERENCE RESOLUTION
  // =========================================================================

  /**
   * Resolves anaphoric and coreferential references: "it", "that", "the former", "the latter".
   */
  resolveReferences(currentMessage, priorEntities = []) {
    const text = String(currentMessage || '');
    let resolvedText = text;
    const replacements = [];

    if (!Array.isArray(priorEntities) || priorEntities.length === 0) {
      return { resolvedText, replacements, hasResolvedReferences: false };
    }

    const firstEntity = priorEntities[0];
    const lastEntity = priorEntities[priorEntities.length - 1];

    if (/\bthe\s+former\b/i.test(resolvedText) && firstEntity) {
      resolvedText = resolvedText.replace(/\bthe\s+former\b/gi, `"${firstEntity}"`);
      replacements.push({ target: 'the former', resolvedTo: firstEntity });
    }

    if (/\bthe\s+latter\b/i.test(resolvedText) && lastEntity) {
      resolvedText = resolvedText.replace(/\bthe\s+latter\b/gi, `"${lastEntity}"`);
      replacements.push({ target: 'the latter', resolvedTo: lastEntity });
    }

    // Resolves single dangling "it" if explicit entity exists
    if (/\b(analyze|inspect|explain|run|solve)\s+it\b/i.test(resolvedText) && lastEntity) {
      resolvedText = resolvedText.replace(/\bit\b/gi, `"${lastEntity}"`);
      replacements.push({ target: 'it', resolvedTo: lastEntity });
    }

    return {
      resolvedText,
      replacements,
      hasResolvedReferences: replacements.length > 0
    };
  }

  // =========================================================================
  // 4. QUESTION DECOMPOSITION
  // =========================================================================

  /**
   * Decomposes complex multi-part queries into atomic single-fact questions.
   */
  decomposeQuestion(question) {
    const q = String(question || '').trim();
    if (!q) return { atomicQuestions: [] };

    const atomic = [];
    const parts = q.split(/\band\s+(?:what|how|why|when|where|who|is|are|can)\b|[?]/i)
      .map(p => p.trim())
      .filter(p => p.length > 5);

    if (parts.length > 1) {
      for (let i = 0; i < parts.length; i++) {
        let cleanPart = parts[i];
        if (!cleanPart.endsWith('?')) cleanPart += '?';
        atomic.push({ index: i + 1, question: cleanPart });
      }
    } else {
      atomic.push({ index: 1, question: q.endsWith('?') ? q : `${q}?` });
    }

    return {
      originalQuestion: q,
      atomicQuestionsCount: atomic.length,
      atomicQuestions: atomic
    };
  }

  // =========================================================================
  // 5. SEMANTIC PARAPHRASE & SIMILARITY
  // =========================================================================

  computeLevenshteinDistance(str1, str2) {
    const s1 = String(str1 || '').toLowerCase();
    const s2 = String(str2 || '').toLowerCase();
    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }
    return dp[m][n];
  }

  computeSemanticSimilarity(textA, textB) {
    const a = String(textA || '').toLowerCase().trim();
    const b = String(textB || '').toLowerCase().trim();
    if (a === b) return 1.0;
    if (!a || !b) return 0.0;

    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 1));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 1));

    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    const union = new Set([...wordsA, ...wordsB]).size;
    const jaccard = union > 0 ? (intersection / union) : 0;

    // Levenshtein ratio
    const maxLen = Math.max(a.length, b.length);
    const levDist = this.computeLevenshteinDistance(a, b);
    const levSim = maxLen > 0 ? (1 - levDist / maxLen) : 1;

    // Composite similarity
    const composite = 0.5 * jaccard + 0.5 * levSim;
    return Number(composite.toFixed(4));
  }

  isParaphrase(textA, textB, threshold = 0.45) {
    const sim = this.computeSemanticSimilarity(textA, textB);
    return {
      isParaphrase: sim >= threshold,
      similarityScore: sim,
      threshold
    };
  }

  // =========================================================================
  // 6. FACTUAL CONSISTENCY & CONTRADICTION DETECTION
  // =========================================================================

  detectContradiction(statementA, statementB) {
    const a = String(statementA || '').toLowerCase();
    const b = String(statementB || '').toLowerCase();

    // Check negation polarity with negation prefix cancellation (e.g. "disabled" vs "not disabled")
    const hasNegAffirmativeA = /\bnot\s+(?:disabled|prohibited|unsupported|false)\b/i.test(a);
    const hasNegAffirmativeB = /\bnot\s+(?:disabled|prohibited|unsupported|false)\b/i.test(b);

    const rawNegA = /\b(not|never|cannot|disabled|unsupported|false|none|prohibited)\b/i.test(a);
    const rawNegB = /\b(not|never|cannot|disabled|unsupported|false|none|prohibited)\b/i.test(b);

    const polA = hasNegAffirmativeA ? false : rawNegA;
    const polB = hasNegAffirmativeB ? false : rawNegB;
    const polarityConflict = (polA !== polB);

    // Check shared keywords
    const tokensA = new Set(a.split(/\s+/).filter(t => t.length > 2));
    const tokensB = new Set(b.split(/\s+/).filter(t => t.length > 2));
    let shared = 0;
    for (const t of tokensA) if (tokensB.has(t)) shared++;

    const sharesSubject = shared >= 2;

    // Number extraction conflict
    const numsA = a.match(/\b\d+(?:\.\d+)?\b/g) || [];
    const numsB = b.match(/\b\d+(?:\.\d+)?\b/g) || [];
    const numConflict = sharesSubject && numsA.length > 0 && numsB.length > 0 && numsA.some(n => !numsB.includes(n));

    const isContradiction = sharesSubject && (polarityConflict || numConflict);

    return {
      isContradiction,
      sharedKeywordsCount: shared,
      polarityConflict,
      numericConflict: numConflict,
      diagnostic: isContradiction
        ? `Contradiction detected: opposing assertions or diverging numbers on shared subject.`
        : `Consistent statements.`
    };
  }

  // =========================================================================
  // 7. UNCERTAINTY ESTIMATION & CONFIDENCE CALIBRATION
  // =========================================================================

  /**
   * Estimates epistemic uncertainty and calibrates model confidence score.
   */
  calibrateConfidence({ text = '', evidenceCount = 0, retrievedEvidenceQuality = 1.0, isDirectFact = true }) {
    let baseConfidence = isDirectFact ? 0.90 : 0.65;

    // Adjust for evidence backing
    if (evidenceCount >= 2) baseConfidence += 0.08;
    else if (evidenceCount === 1) baseConfidence += 0.04;
    else baseConfidence -= 0.20;

    baseConfidence *= Math.min(1.0, Math.max(0.2, retrievedEvidenceQuality));

    // Hedging language analysis
    const hedgingCount = (text.match(/\b(possibly|perhaps|might|maybe|could\s+be|uncertain|unclear|assumed|estimated)\b/gi) || []).length;
    if (hedgingCount > 0) {
      baseConfidence -= (hedgingCount * 0.08);
    }

    const finalConfidence = Math.max(0.10, Math.min(0.99, Number(baseConfidence.toFixed(4))));
    const uncertaintyLevel = finalConfidence >= 0.80 ? 'LOW' : (finalConfidence >= 0.50 ? 'MEDIUM' : 'HIGH');

    return {
      confidenceScore: finalConfidence,
      uncertaintyLevel,
      hedgingTokensFound: hedgingCount,
      evidenceBackingCount: evidenceCount,
      isGrounded: evidenceCount > 0
    };
  }

  // =========================================================================
  // 8. KNOWLEDGE BOUNDARY AWARENESS
  // =========================================================================

  /**
   * Checks whether a topic exceeds reliable system knowledge boundaries.
   */
  checkKnowledgeBoundary(query, knownCorpusKeywords = []) {
    const q = String(query || '').toLowerCase();
    
    // Explicit known impossible requests
    const impossiblePatterns = [
      /\b(predict\s+(?:exact\s+)?lottery\s+numbers)\b/i,
      /\b(private\s+passwords|bank\s+pin|unreleased\s+future\s+dates)\b/i,
      /\b(what\s+will\s+happen\s+in\s+year\s+3000)\b/i
    ];

    for (const pat of impossiblePatterns) {
      if (pat.test(q)) {
        return {
          withinKnowledgeBoundary: false,
          reason: 'PHYSICALLY_IMPOSSIBLE_OR_UNREACHABLE_INFORMATION',
          recommendation: 'Politely refuse and state knowledge boundaries clearly.'
        };
      }
    }

    if (Array.isArray(knownCorpusKeywords) && knownCorpusKeywords.length > 0) {
      const qTokens = q.split(/\s+/).filter(t => t.length > 2);
      const match = qTokens.some(t => knownCorpusKeywords.includes(t));
      return {
        withinKnowledgeBoundary: match,
        reason: match ? 'TOPIC_GROUNDED_IN_SYSTEM_INDEX' : 'TOPIC_ABSENT_FROM_INTERNAL_KNOWLEDGE',
        recommendation: match ? 'Proceed with RAG grounding.' : 'Consult external web search or acknowledge absence.'
      };
    }

    return {
      withinKnowledgeBoundary: true,
      reason: 'GENERAL_DOMAINS_ACCEPTABLE',
      recommendation: 'Proceed.'
    };
  }

  // =========================================================================
  // 9. ADAPTIVE RESPONSE DETAIL SCALING
  // =========================================================================

  /**
   * Scales response length and depth based on explicit user preference or inquiry style.
   */
  scaleResponseDetail(userPreference = 'BALANCED', rawDraft = '') {
    const mode = String(userPreference).toUpperCase();
    const sentences = rawDraft.split(/(?<=[.?!])\s+/).filter(Boolean);

    if (mode === 'CONCISE' || mode === 'BRIEF') {
      // Limit to top 2 salient sentences
      return {
        mode: 'CONCISE',
        content: sentences.slice(0, 2).join(' ') || rawDraft,
        reductionPercent: sentences.length > 2 ? Math.round((1 - 2 / sentences.length) * 100) : 0
      };
    }

    if (mode === 'IN_DEPTH' || mode === 'TUTORIAL') {
      return {
        mode: 'IN_DEPTH',
        content: rawDraft,
        isComprehensive: true
      };
    }

    // Default BALANCED
    return {
      mode: 'BALANCED',
      content: sentences.slice(0, 5).join(' ') || rawDraft
    };
  }

  // =========================================================================
  // 10. MULTILINGUAL CODE-SWITCHING DETECTION
  // =========================================================================

  /**
   * Detects multilingual mixing between English, Hindi (Devanagari), and Hinglish.
   */
  detectLanguageMixing(text) {
    const raw = String(text || '');
    const devanagariMatches = raw.match(ENTITY_PATTERNS.HINDI_DEVANAGARI) || [];
    const hinglishMatches = raw.match(ENTITY_PATTERNS.HINGLISH_MARKERS) || [];
    const totalWords = raw.split(/\s+/).filter(w => w.length > 0).length || 1;

    const hasDevanagari = devanagariMatches.length > 0;
    const hasHinglish = hinglishMatches.length > 0;
    const hasEnglish = /[a-zA-Z]{3,}/.test(raw);

    let primaryLanguage = 'ENGLISH';
    let isCodeSwitched = false;

    if (hasDevanagari && hasEnglish) {
      primaryLanguage = 'MIXED_HINDI_ENGLISH';
      isCodeSwitched = true;
    } else if (hasHinglish && hasEnglish) {
      primaryLanguage = 'HINGLISH';
      isCodeSwitched = true;
    } else if (hasDevanagari) {
      primaryLanguage = 'HINDI';
    }

    return {
      primaryLanguage,
      isCodeSwitched,
      devanagariCharCount: devanagariMatches.length,
      hinglishTokensCount: hinglishMatches.length,
      hinglishTokens: Array.from(new Set(hinglishMatches.map(m => m.toLowerCase())))
    };
  }
}

const languageIntelligenceEngineInstance = new LanguageIntelligenceEngine();

module.exports = {
  LanguageIntelligenceEngine,
  languageIntelligenceEngineInstance
};
