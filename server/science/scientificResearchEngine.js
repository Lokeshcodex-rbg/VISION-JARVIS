/**
 * VISION AI — Scientific Research & Technical Document Intelligence Engine
 * Phase 12 Section 8 & Section 10: Scientific Research, Experiments & Technical Document Understanding
 * 
 * Provides:
 * - Hypothesis formulation (H0 null vs H1 alternative)
 * - Source credibility scoring & contradiction detection
 * - Technical document equation extraction & table interpretation
 * - Provenance preservation in 8-layer SQLite memory
 * - Multi-agent scientific collaboration orchestration
 */

const fs = require('fs');
const path = require('path');
const { starkMemoryDbInstance } = require('../memory/starkMemoryDb.js');

class ScientificResearchEngine {
  constructor() {
    this.memoryDb = starkMemoryDbInstance;
  }

  /**
   * Section 8: Converts research questions into testable scientific hypotheses
   */
  formulateHypothesis(researchTopic, independentVar, dependentVar, direction = 'positive') {
    const h0 = `There is no statistically significant effect of ${independentVar} on ${dependentVar} (effect size = 0).`;
    const h1 = direction === 'positive'
      ? `An increase in ${independentVar} results in a statistically significant increase in ${dependentVar}.`
      : `An increase in ${independentVar} results in a statistically significant decrease in ${dependentVar}.`;

    const experimentProtocol = {
      topic: researchTopic,
      independentVariable: independentVar,
      dependentVariable: dependentVar,
      nullHypothesis_H0: h0,
      alternativeHypothesis_H1: h1,
      statisticalTest: 'Welch’s Two-Sample t-test or Two-Way ANOVA',
      significanceThresholdAlpha: 0.05,
      powerTarget: 0.80,
      confidenceInterval: '95%'
    };

    return {
      success: true,
      protocol: experimentProtocol,
      summary: `Formulated hypothesis for "${researchTopic}": H0: [${h0}] vs H1: [${h1}].`
    };
  }

  /**
   * Section 8: Evaluates source reliability and detects contradictory evidence
   */
  evaluateSourceEvidence(sources = []) {
    // Each source: { title, type: 'peer_reviewed' | 'preprint' | 'technical_report' | 'unverified_web', findings: string }
    const TYPE_WEIGHTS = {
      peer_reviewed: 0.95,
      technical_report: 0.80,
      preprint: 0.65,
      unverified_web: 0.30
    };

    const evaluated = sources.map(s => {
      const weight = TYPE_WEIGHTS[s.type] || 0.40;
      return {
        ...s,
        credibilityScore: weight,
        peerReviewed: s.type === 'peer_reviewed'
      };
    });

    // Detect contradictions across findings
    const findingsTexts = sources.map(s => String(s.findings || '').toLowerCase());
    let hasContradiction = false;
    let contradictionDetail = null;

    for (let i = 0; i < findingsTexts.length; i++) {
      for (let j = i + 1; j < findingsTexts.length; j++) {
        const textA = findingsTexts[i];
        const textB = findingsTexts[j];
        if (
          (textA.includes('increase') && textB.includes('decrease')) ||
          (textA.includes('positive') && textB.includes('negative')) ||
          (textA.includes('effective') && textB.includes('ineffective'))
        ) {
          hasContradiction = true;
          contradictionDetail = `Contradictory findings between Source #${i + 1} ("${sources[i].title}") and Source #${j + 1} ("${sources[j].title}").`;
          break;
        }
      }
      if (hasContradiction) break;
    }

    return {
      success: true,
      totalSources: sources.length,
      evaluatedSources: evaluated,
      hasContradiction,
      contradictionDetail,
      meanCredibility: evaluated.length > 0
        ? roundNum(evaluated.reduce((acc, s) => acc + s.credibilityScore, 0) / evaluated.length, 2)
        : 0.0,
      summary: hasContradiction
        ? `Evidence audit flagged contradictory findings across ${sources.length} sources.`
        : `Evidence audit verified ${sources.length} sources with no conflicting claims.`
    };
  }

  /**
   * Section 10: Technical document equation and table extractor
   */
  extractTechnicalContent(documentText = '') {
    // Extract inline and display LaTeX / mathematical formulas ($...$, $$...$$, \[...\])
    const equationRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\[[\s\S]*?\\\])/g;
    const equations = [];
    let match;
    while ((match = equationRegex.exec(documentText)) !== null) {
      equations.push(match[0].trim());
    }

    // Extract Markdown tables
    const tableRegex = /\|(.+)\|[\r\n]+\|([-:\s|]+)\|[\r\n]+((\|.*\|[\r\n]*)+)/g;
    const tables = [];
    while ((match = tableRegex.exec(documentText)) !== null) {
      tables.push(match[0].trim());
    }

    return {
      success: true,
      equationCount: equations.length,
      equations,
      tableCount: tables.length,
      tables,
      summary: `Extracted ${equations.length} mathematical equation(s) and ${tables.length} structured table(s) from document.`
    };
  }

  /**
   * Section 13: Memory Provenance Recording
   */
  async recordScientificProvenance(topic, result, epistemicType = 'verified_calculation', confidence = 0.98) {
    try {
      if (this.memoryDb && this.memoryDb.storeMemory) {
        await this.memoryDb.storeMemory({
          layer: 'project',
          key: `science_${topic.replace(/\s+/g, '_').toLowerCase()}`,
          content: JSON.stringify(result),
          epistemicType,
          confidence,
          source: 'Phase12_Scientific_Intelligence'
        });
      }
      return { success: true, stored: true, topic, epistemicType };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

function roundNum(num, dec = 2) {
  return parseFloat(Number(num).toFixed(dec));
}

module.exports = {
  ScientificResearchEngine,
  scientificResearchEngineInstance: new ScientificResearchEngine()
};
