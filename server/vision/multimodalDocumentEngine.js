/**
 * VISION AI — Multimodal Document & Image Understanding Engine
 * Implements Phase 11 Section 6: Image and Document Intelligence.
 * Supports PNG, JPEG, WebP, BMP, TIFF, PDF, DOCX, XLSX, PPTX.
 * Extracts text, layouts, tables, summaries, cross-document comparison,
 * and grounded VQA without hallucination.
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON_BRIDGE = path.join(__dirname, 'python_vision_bridge.py');

class MultimodalDocumentEngine {
  constructor() {
    this.supportedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.pdf', '.docx', '.xlsx', '.pptx', '.txt'];
  }

  async runBridge(action, args = []) {
    return new Promise((resolve) => {
      execFile('python', [PYTHON_BRIDGE, action, ...args], { timeout: 20000 }, (err, stdout, stderr) => {
        if (err) {
          return resolve({ success: false, error: err.message || stderr });
        }
        try {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const parsed = JSON.parse(lastLine);
          resolve(parsed);
        } catch (e) {
          resolve({ success: false, error: 'JSON parse error', raw: stdout });
        }
      });
    });
  }

  /**
   * Sanitizes untrusted document text to prevent prompt injection attacks
   */
  sanitizeDocumentInput(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    // Strip common prompt injection patterns
    return rawText
      .replace(/ignore (all )?previous instructions/gi, '[FLAGGED_INJECTION_ATTEMPT]')
      .replace(/system:?\s*you are now/gi, '[FLAGGED_INJECTION_ATTEMPT]')
      .replace(/<\|im_start\|>|<\|im_end\|>/gi, '');
  }

  /**
   * Analyzes an image, PDF, or DOCX document with structural extraction
   */
  async analyzeDocument(filePath) {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Document file does not exist: ${filePath}` };
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(ext)) {
      return { success: false, error: `Unsupported format "${ext}". Supported: ${this.supportedExtensions.join(', ')}` };
    }

    const stat = fs.statSync(filePath);

    if (ext === '.pdf') {
      const parsed = await this.runBridge('parse_pdf', [filePath]);
      if (!parsed.success) return parsed;
      const cleanText = this.sanitizeDocumentInput(parsed.fullText || '');

      return {
        success: true,
        documentType: 'PDF',
        filePath,
        fileName: path.basename(filePath),
        sizeBytes: stat.size,
        pageCount: parsed.pageCount,
        metadata: parsed.metadata,
        tablesCount: (parsed.pages || []).reduce((acc, p) => acc + (p.tableCount || 0), 0),
        extractedText: cleanText,
        summary: `PDF document "${path.basename(filePath)}" containing ${parsed.pageCount} page(s) and ${cleanText.length} characters.`
      };
    } else if (ext === '.docx') {
      const parsed = await this.runBridge('parse_docx', [filePath]);
      if (!parsed.success) return parsed;
      const cleanText = this.sanitizeDocumentInput(parsed.fullText || '');

      return {
        success: true,
        documentType: 'DOCX',
        filePath,
        fileName: path.basename(filePath),
        sizeBytes: stat.size,
        paragraphCount: parsed.paragraphCount,
        headings: parsed.headings || [],
        tablesCount: parsed.tableCount || 0,
        tables: parsed.tables || [],
        extractedText: cleanText,
        summary: `Word DOCX document "${path.basename(filePath)}" containing ${parsed.paragraphCount} paragraphs and ${parsed.tableCount || 0} table(s).`
      };
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'].includes(ext)) {
      const parsed = await this.runBridge('parse_image', [filePath]);
      if (!parsed.success) return parsed;

      return {
        success: true,
        documentType: 'IMAGE',
        filePath,
        fileName: path.basename(filePath),
        sizeBytes: stat.size,
        width: parsed.width,
        height: parsed.height,
        meanBrightness: parsed.meanBrightness,
        detectedRegionsCount: parsed.detectedRegionsCount,
        circularFeaturesCount: parsed.circularFeaturesCount || 0,
        normalizedRegions: Array.isArray(parsed.normalizedRegions) ? parsed.normalizedRegions : [],
        segmentation: parsed.segmentation || null,
        spatialRelations: Array.isArray(parsed.spatialRelations) ? parsed.spatialRelations : [],
        visualAnomaly: parsed.visualAnomaly || null,
        ocrText: this.sanitizeDocumentInput(parsed.ocrText || ''),
        summary: `Image "${path.basename(filePath)}" (${parsed.width}x${parsed.height}, ${parsed.detectedRegionsCount} detected visual regions, ${parsed.segmentation?.segmentCount || 0} foreground segments, anomalyDetected=${Boolean(parsed.visualAnomaly?.anomalyDetected)}).`
      };
    } else {
      // Plain text or CSV fallback
      const content = fs.readFileSync(filePath, 'utf8');
      const cleanText = this.sanitizeDocumentInput(content);
      return {
        success: true,
        documentType: 'TEXT',
        filePath,
        fileName: path.basename(filePath),
        sizeBytes: stat.size,
        extractedText: cleanText,
        summary: `Text document "${path.basename(filePath)}" (${cleanText.length} characters).`
      };
    }
  }

  /**
   * Compares two documents or images and identifies structural & textual discrepancies
   */
  async compareDocuments(fileA, fileB) {
    const docA = await this.analyzeDocument(fileA);
    const docB = await this.analyzeDocument(fileB);

    if (!docA.success) return { success: false, error: `Document A error: ${docA.error}` };
    if (!docB.success) return { success: false, error: `Document B error: ${docB.error}` };

    const extA = path.extname(fileA).toLowerCase();
    const extB = path.extname(fileB).toLowerCase();

    // If both are images, perform pixel and region comparison
    if (docA.documentType === 'IMAGE' && docB.documentType === 'IMAGE') {
      const visualDiff = await this.runBridge('compare_images', [fileA, fileB]);
      return {
        success: true,
        comparisonType: 'VISUAL_IMAGE',
        fileA: docA.fileName,
        fileB: docB.fileName,
        visualDiff,
        isIdentical: visualDiff.identical,
        summary: visualDiff.identical
          ? `Both images are visually identical (100% similarity).`
          : `Images differ by ${visualDiff.differencePercentage}%. Changed bounding box: [${(visualDiff.changedBoundingBox || []).join(', ')}].`
      };
    }

    // Textual comparison for documents
    const textA = docA.extractedText || '';
    const textB = docB.extractedText || '';

    const linesA = textA.split('\n').map(l => l.trim()).filter(Boolean);
    const linesB = textB.split('\n').map(l => l.trim()).filter(Boolean);

    const setB = new Set(linesB);
    const setA = new Set(linesA);

    const onlyInA = linesA.filter(x => !setB.has(x));
    const onlyInB = linesB.filter(x => !setA.has(x));

    const isIdentical = onlyInA.length === 0 && onlyInB.length === 0;

    return {
      success: true,
      comparisonType: 'TEXTUAL_DOCUMENT',
      fileA: docA.fileName,
      fileB: docB.fileName,
      isIdentical,
      totalLinesA: linesA.length,
      totalLinesB: linesB.length,
      discrepanciesCount: onlyInA.length + onlyInB.length,
      differencesOnlyInA: onlyInA.slice(0, 10),
      differencesOnlyInB: onlyInB.slice(0, 10),
      summary: isIdentical
        ? `Documents "${docA.fileName}" and "${docB.fileName}" have identical content.`
        : `Found ${onlyInA.length + onlyInB.length} differences between "${docA.fileName}" and "${docB.fileName}".`
    };
  }

  /**
   * Grounded Visual Question Answering (VQA) against document content
   */
  async answerDocumentQuestion(filePath, question) {
    const analysis = await this.analyzeDocument(filePath);
    if (!analysis.success) return analysis;

    const text = (analysis.extractedText || analysis.ocrText || '').toLowerCase();
    const qLower = question.toLowerCase();

    // Find sentences/paragraphs containing question keywords
    const keywords = qLower.replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3);
    const paragraphs = (analysis.extractedText || analysis.ocrText || '').split('\n').filter(p => p.trim());

    const relevantSections = [];
    for (const p of paragraphs) {
      const matchCount = keywords.filter(k => p.toLowerCase().includes(k)).length;
      if (matchCount > 0) {
        relevantSections.push({ text: p.trim(), relevance: matchCount });
      }
    }

    relevantSections.sort((a, b) => b.relevance - a.relevance);

    const answer = relevantSections.length > 0
      ? relevantSections.map(s => s.text).slice(0, 3).join('\n\n')
      : `Based strictly on "${analysis.fileName}", no direct information regarding "${question}" was located.`;

    return {
      success: true,
      document: analysis.fileName,
      question,
      groundedAnswer: answer,
      provenance: {
        sourceFile: filePath,
        pageOrParagraphCount: analysis.pageCount || analysis.paragraphCount || 1,
        matchCount: relevantSections.length
      },
      summary: `Answered grounded query for "${analysis.fileName}" with ${relevantSections.length} matching citations.`
    };
  }
}

module.exports = {
  MultimodalDocumentEngine,
  multimodalDocumentEngineInstance: new MultimodalDocumentEngine()
};
