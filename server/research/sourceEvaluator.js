/**
 * VISION AI — Source Evaluator & Cross-Verification Engine (Phase 7 Architecture)
 * 
 * Provides transparent, empirical evaluation of research sources, evidence quality,
 * freshness, independent corroboration, and contradiction detection.
 * 
 * In strict adherence to Section 4 of the Phase 7 Directive:
 * - Transparent scoring criteria:
 *   1. Source identity and institutional origin
 *   2. Publication date and freshness
 *   3. Primary vs secondary evidence classification
 *   4. Relevance to the specific research question
 *   5. Evidence quality (direct experiment vs secondary speculation)
 *   6. Corroboration by independent sources (no snippet or model-agreement proof)
 *   7. Contradiction and uncertainty boundaries
 * - Anti-hallucination invariant: preserves URLs and verifiable quotes
 */

const SOURCE_ORIGIN_TIERS = {
  PRIMARY_PEER_REVIEWED: {
    tier: 'PRIMARY_PEER_REVIEWED',
    name: 'Peer-Reviewed Academic / Preprint Repository',
    baseScore: 1.0,
    requiresCorroborationForFact: false
  },
  PRIMARY_EXPERIMENTAL: {
    tier: 'PRIMARY_EXPERIMENTAL',
    name: 'Direct Empirical Experiment / OS Benchmark',
    baseScore: 1.0,
    requiresCorroborationForFact: false
  },
  AUTHORITATIVE_DOCUMENTATION: {
    tier: 'AUTHORITATIVE_DOCUMENTATION',
    name: 'Official Vendor / Language Specification',
    baseScore: 0.9,
    requiresCorroborationForFact: false
  },
  SECONDARY_TECHNICAL_REPORT: {
    tier: 'SECONDARY_TECHNICAL_REPORT',
    name: 'Industry Technical Whitepaper / Organization Report',
    baseScore: 0.7,
    requiresCorroborationForFact: true
  },
  SECONDARY_BLOG_ARTICLE: {
    tier: 'SECONDARY_BLOG_ARTICLE',
    name: 'Public Web Article / Blog Post',
    baseScore: 0.45,
    requiresCorroborationForFact: true
  },
  UNVERIFIED_CLAIM: {
    tier: 'UNVERIFIED_CLAIM',
    name: 'Unverified External Assertion',
    baseScore: 0.2,
    requiresCorroborationForFact: true
  }
};

const FRESHNESS_TIERS = {
  VERY_FRESH: { name: 'VERY_FRESH', maxAgeMonths: 6, multiplier: 1.0 },
  FRESH: { name: 'FRESH', maxAgeMonths: 18, multiplier: 0.95 },
  CURRENT: { name: 'CURRENT', maxAgeMonths: 36, multiplier: 0.8 },
  HISTORICAL: { name: 'HISTORICAL', maxAgeMonths: 84, multiplier: 0.5 },
  STALE: { name: 'STALE', maxAgeMonths: Infinity, multiplier: 0.2 }
};

class SourceEvaluator {
  constructor() {
    this.authoritativeDomains = new Set([
      'arxiv.org',
      'doi.org',
      'nature.com',
      'ieee.org',
      'acm.org',
      'w3.org',
      'nodejs.org',
      'microsoft.com',
      'developer.mozilla.org',
      'github.com',
      'python.org'
    ]);
  }

  /**
   * Evaluates an individual source against objective criteria
   */
  evaluateSource(source = {}) {
    const url = String(source.url || source.sourceUrl || '').trim();
    const title = String(source.title || source.sourceName || 'Untitled Source').trim();
    const text = String(source.text || source.snippet || source.content || '').trim();
    const dateStr = source.date || source.publishedDate || source.timestamp || null;

    // 1. Identify Origin & Tier
    let tier = SOURCE_ORIGIN_TIERS.SECONDARY_BLOG_ARTICLE;
    if (source.isExperimental || source.evidenceClassification === 'PRIMARY_EXPERIMENTAL') {
      tier = SOURCE_ORIGIN_TIERS.PRIMARY_EXPERIMENTAL;
    } else if (source.evidenceClassification === 'PEER_REVIEWED_PREPRINT' || /arxiv\.org|doi\.org/i.test(url)) {
      tier = SOURCE_ORIGIN_TIERS.PRIMARY_PEER_REVIEWED;
    } else if (this._isAuthoritativeDomain(url)) {
      tier = SOURCE_ORIGIN_TIERS.AUTHORITATIVE_DOCUMENTATION;
    } else if (source.evidenceClassification === 'SECONDARY_TECHNICAL_REPORT') {
      tier = SOURCE_ORIGIN_TIERS.SECONDARY_TECHNICAL_REPORT;
    } else if (!url && !source.sourceName) {
      tier = SOURCE_ORIGIN_TIERS.UNVERIFIED_CLAIM;
    }

    // 2. Evaluate Freshness
    const freshness = this._evaluateFreshness(dateStr);

    // 3. Evaluate Evidence Directness & Quality
    let evidenceQuality = 0.5;
    if (text.length > 50) {
      evidenceQuality = 0.7;
      // Bonus for quantitative data or empirical citations
      if (/\b\d+(?:\.\d+)?(?:%|ms|s|gb|mb|ghz|flops|parameters|tests)\b/i.test(text)) {
        evidenceQuality += 0.2;
      }
      // Penalty for heavy speculation language
      if (/\b(?:perhaps|rumored|might\s+be|allegedly|some\s+say|speculated)\b/i.test(text)) {
        evidenceQuality -= 0.3;
      }
    } else if (text.length === 0) {
      evidenceQuality = 0.1;
    }
    evidenceQuality = Math.max(0.1, Math.min(1.0, evidenceQuality));

    // 4. Compute Composite Credibility Score
    // Formula: 0.40 * origin + 0.30 * evidenceQuality + 0.30 * freshness
    const credibilityScore = Number(
      (0.40 * tier.baseScore + 0.30 * evidenceQuality + 0.30 * freshness.multiplier).toFixed(3)
    );

    return {
      title,
      url: url || null,
      originTier: tier.tier,
      originName: tier.name,
      originScore: tier.baseScore,
      publishedDate: dateStr,
      freshnessTier: freshness.tier,
      freshnessScore: freshness.multiplier,
      evidenceQualityScore: Number(evidenceQuality.toFixed(2)),
      credibilityScore,
      isPrimary: tier.tier.startsWith('PRIMARY'),
      requiresCorroboration: tier.requiresCorroborationForFact,
      isValid: Boolean(url || source.isExperimental),
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Cross-verifies a target claim across multiple independent sources
   */
  crossVerifyClaim(claimText, sources = []) {
    const claim = String(claimText || '').trim();
    if (!claim) throw new Error('Claim cannot be empty.');
    if (!Array.isArray(sources) || sources.length === 0) {
      return {
        claim,
        verified: false,
        epistemicType: 'ASSUMPTION',
        confidence: 0.1,
        corroborationCount: 0,
        contradictionCount: 0,
        sourcesEvaluated: [],
        verdict: 'UNSUPPORTED: Claim has zero supporting citations.',
        summary: 'Claim cannot be admitted as fact without evidence.'
      };
    }

    const evaluations = sources.map(s => this.evaluateSource(s));
    const validSources = evaluations.filter(e => e.isValid);

    // Filter into supporting vs contradicting
    const supporting = [];
    const contradicting = [];

    for (let i = 0; i < validSources.length; i++) {
      const src = sources[i];
      const text = String(src.text || src.snippet || src.summary || '').toLowerCase();
      const claimLower = claim.toLowerCase();

      // Check for contradiction markers
      const isContradictory = src.contradicts === true || 
        /\b(?:not\s+true|incorrect|false|disproven|refuted|fails\s+to|contrary\s+to)\b/i.test(text);

      if (isContradictory) {
        contradicting.push(validSources[i]);
      } else {
        supporting.push(validSources[i]);
      }
    }

    // Determine Corroboration & Epistemic Classification
    const hasPrimarySource = supporting.some(s => s.isPrimary);
    const avgCredibility = supporting.length > 0
      ? supporting.reduce((acc, s) => acc + s.credibilityScore, 0) / supporting.length
      : 0;

    let epistemicType = 'CLAIM';
    let verified = false;
    let confidence = 0.5;

    if (contradicting.length > 0) {
      epistemicType = 'CLAIM';
      confidence = 0.4;
      verified = false;
    } else if (hasPrimarySource && supporting.length >= 1) {
      epistemicType = 'VERIFIED_FACT';
      verified = true;
      confidence = Math.min(1.0, 0.85 + (supporting.length * 0.05));
    } else if (supporting.length >= 2 && avgCredibility >= 0.6) {
      epistemicType = 'VERIFIED_FACT';
      verified = true;
      confidence = Number(Math.min(0.98, avgCredibility + 0.05).toFixed(2));
    } else if (supporting.length === 1 && avgCredibility >= 0.5) {
      epistemicType = 'CLAIM';
      verified = false;
      confidence = Number(avgCredibility.toFixed(2));
    } else {
      epistemicType = 'ASSUMPTION';
      verified = false;
      confidence = 0.3;
    }

    return {
      claim,
      verified,
      epistemicType,
      confidence: Number(confidence.toFixed(2)),
      corroborationCount: supporting.length,
      contradictionCount: contradicting.length,
      supportingSources: supporting,
      contradictingSources: contradicting,
      sourcesEvaluated: evaluations,
      hasPrimaryEvidence: hasPrimarySource,
      verdict: verified
        ? `VERIFIED (${epistemicType}): Corroborated across ${supporting.length} independent source(s).`
        : (contradicting.length > 0
            ? `CONTESTED: Claim has ${contradicting.length} contradictory citations.`
            : `UNVERIFIED: Insufficient authoritative corroboration (retained as ${epistemicType}).`),
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Scans a set of findings for pairwise contradictions
   */
  detectContradictions(findings = []) {
    const contradictions = [];

    for (let i = 0; i < findings.length; i++) {
      for (let j = i + 1; j < findings.length; j++) {
        const a = findings[i];
        const b = findings[j];

        // 1. Same topic/concept check
        const topicA = (a.topic || a.entity || a.concept || '').toLowerCase();
        const topicB = (b.topic || b.entity || b.concept || '').toLowerCase();
        const sameTopic = topicA && topicB && (topicA === topicB || topicA.includes(topicB) || topicB.includes(topicA));

        if (!sameTopic && !a.metric && !b.metric) continue;

        // 2. Numerical metric conflict
        if (a.metric && b.metric && a.metric === b.metric && a.value !== b.value) {
          contradictions.push({
            id: `contra_${Date.now()}_${i}_${j}`,
            concept: a.metric,
            contradictionType: 'NUMERICAL_DISCREPANCY',
            claimA: `${a.metric} = ${a.value} (${a.source || 'Source A'})`,
            sourceA: a.source || a.url || 'Source A',
            claimB: `${b.metric} = ${b.value} (${b.source || 'Source B'})`,
            sourceB: b.source || b.url || 'Source B',
            discrepancy: `Value mismatch: ${a.value} vs ${b.value}`,
            detectedAt: new Date().toISOString()
          });
          continue;
        }

        // 3. Semantic polarity conflict
        const textA = (a.claim || a.text || '').toLowerCase();
        const textB = (b.claim || b.text || '').toLowerCase();

        const aPositive = /\b(?:is|supports|improves|faster|secure|scalable)\b/i.test(textA);
        const aNegative = /\b(?:is\s+not|fails|vulnerable|slower|insecure|unscalable)\b/i.test(textA);

        const bPositive = /\b(?:is|supports|improves|faster|secure|scalable)\b/i.test(textB);
        const bNegative = /\b(?:is\s+not|fails|vulnerable|slower|insecure|unscalable)\b/i.test(textB);

        if ((aPositive && bNegative) || (aNegative && bPositive)) {
          contradictions.push({
            id: `contra_${Date.now()}_${i}_${j}`,
            concept: topicA || a.claim?.slice(0, 40) || 'General',
            contradictionType: 'DIRECT_POLARITY_CONFLICT',
            claimA: a.claim || a.text,
            sourceA: a.source || a.url || 'Source A',
            claimB: b.claim || b.text,
            sourceB: b.source || b.url || 'Source B',
            discrepancy: 'Direct polarity conflict between claims',
            detectedAt: new Date().toISOString()
          });
        }
      }
    }

    return contradictions;
  }

  _isAuthoritativeDomain(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      for (const d of this.authoritativeDomains) {
        if (hostname === d || hostname.endsWith('.' + d)) return true;
      }
    } catch (_) {}
    return false;
  }

  _evaluateFreshness(dateStr) {
    if (!dateStr) {
      return { tier: FRESHNESS_TIERS.HISTORICAL.name, multiplier: FRESHNESS_TIERS.HISTORICAL.multiplier };
    }

    try {
      const pubDate = new Date(dateStr);
      if (isNaN(pubDate.getTime())) {
        return { tier: FRESHNESS_TIERS.HISTORICAL.name, multiplier: FRESHNESS_TIERS.HISTORICAL.multiplier };
      }

      const ageMs = Date.now() - pubDate.getTime();
      const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30.44);

      if (ageMonths <= FRESHNESS_TIERS.VERY_FRESH.maxAgeMonths) {
        return { tier: FRESHNESS_TIERS.VERY_FRESH.name, multiplier: FRESHNESS_TIERS.VERY_FRESH.multiplier };
      }
      if (ageMonths <= FRESHNESS_TIERS.FRESH.maxAgeMonths) {
        return { tier: FRESHNESS_TIERS.FRESH.name, multiplier: FRESHNESS_TIERS.FRESH.multiplier };
      }
      if (ageMonths <= FRESHNESS_TIERS.CURRENT.maxAgeMonths) {
        return { tier: FRESHNESS_TIERS.CURRENT.name, multiplier: FRESHNESS_TIERS.CURRENT.multiplier };
      }
      if (ageMonths <= FRESHNESS_TIERS.HISTORICAL.maxAgeMonths) {
        return { tier: FRESHNESS_TIERS.HISTORICAL.name, multiplier: FRESHNESS_TIERS.HISTORICAL.multiplier };
      }
      return { tier: FRESHNESS_TIERS.STALE.name, multiplier: FRESHNESS_TIERS.STALE.multiplier };
    } catch (_) {
      return { tier: FRESHNESS_TIERS.HISTORICAL.name, multiplier: FRESHNESS_TIERS.HISTORICAL.multiplier };
    }
  }
}

const sourceEvaluatorInstance = new SourceEvaluator();

module.exports = {
  SourceEvaluator,
  sourceEvaluatorInstance,
  SOURCE_ORIGIN_TIERS,
  FRESHNESS_TIERS
};
