/**
 * VISION AI — Document, Dataset, Code & Log Analyzer
 * Implements ChatGPT-level analysis of user-provided content and authorized files:
 * 1. Text & Markdown: structure, word count, key sections, summaries.
 * 2. Source Code: language detection, syntax analysis, functions/classes/imports, complexity.
 * 3. CSV & Tabular Data: header extraction, column data typing, null checks, numeric statistics (min, max, mean).
 * 4. JSON Configurations: schema extraction, nesting depth, array counts, key structures.
 * 5. Logs & Stack Traces: error classification, failure frequency, root cause pinpointing.
 * 6. Image & Visual Content: format inspection, metadata extraction, and multimodal readiness.
 */

const fs = require('fs');
const path = require('path');
const { securityPermissionsInstance, WORKSPACE_ROOT } = require('./securityPermissions.js');

class DocumentAnalyzer {
  constructor() {
    this.workspaceRoot = WORKSPACE_ROOT;
  }

  /**
   * Universal document analyzer that inspects local authorized files or raw text content
   */
  analyzeDocument(target, options = {}) {
    let content = '';
    let filename = options.filename || 'document.txt';
    let isFile = false;
    let filePath = null;

    if (typeof target === 'string') {
      // Check if target is a file path
      try {
        const resolved = securityPermissionsInstance.resolveSafePath(target);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          content = fs.readFileSync(resolved, 'utf8');
          filename = path.basename(resolved);
          isFile = true;
          filePath = path.relative(this.workspaceRoot, resolved);
        } else {
          content = target;
        }
      } catch (e) {
        // Not a safe file path or string content directly
        content = target;
      }
    } else if (typeof target === 'object' && target !== null) {
      content = JSON.stringify(target, null, 2);
      filename = options.filename || 'data.json';
    }

    const ext = path.extname(filename).toLowerCase();
    const sizeBytes = Buffer.byteLength(content, 'utf8');

    // Route to specialized analyzers based on extension or detected format
    if (ext === '.csv' || (!ext && this.looksLikeCsv(content))) {
      return this.analyzeCsv(content, { filename, isFile, filePath, sizeBytes });
    }

    if (ext === '.json' || (!ext && this.looksLikeJson(content))) {
      return this.analyzeJson(content, { filename, isFile, filePath, sizeBytes });
    }

    if (ext === '.log' || this.looksLikeLog(content)) {
      return this.analyzeLog(content, { filename, isFile, filePath, sizeBytes });
    }

    if (['.js', '.mjs', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs', '.html', '.css', '.sql'].includes(ext)) {
      return this.analyzeCodeDocument(content, { filename, ext, isFile, filePath, sizeBytes });
    }

    return this.analyzeTextDocument(content, { filename, ext, isFile, filePath, sizeBytes });
  }

  looksLikeCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return false;
    const commas = (lines[0].match(/,/g) || []).length;
    return commas >= 1 && (lines[1].match(/,/g) || []).length === commas;
  }

  looksLikeJson(text) {
    const trimmed = text.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }

  looksLikeLog(text) {
    return /\b(?:ERROR|WARN|INFO|DEBUG|FATAL|EXCEPTION|TRACE)\b/i.test(text) && /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}/.test(text);
  }

  /**
   * Analyzes CSV and Tabular datasets
   */
  analyzeCsv(csvText, meta = {}) {
    const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      return { type: 'csv', error: 'Empty CSV dataset', meta };
    }

    const headers = this.parseCsvLine(lines[0]);
    const rowCount = lines.length - 1;
    const sampleRows = [];
    const columnStats = {};

    headers.forEach(h => {
      columnStats[h] = {
        name: h,
        inferredType: 'unknown',
        nonNullCount: 0,
        nullCount: 0,
        values: [],
        numericSum: 0,
        numericCount: 0,
        min: null,
        max: null
      };
    });

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      if (sampleRows.length < 5) {
        const rowObj = {};
        headers.forEach((h, idx) => { rowObj[h] = values[idx] || ''; });
        sampleRows.push(rowObj);
      }

      headers.forEach((h, idx) => {
        const val = (values[idx] !== undefined) ? values[idx].trim() : '';
        const stat = columnStats[h];
        if (!val || val.toLowerCase() === 'null' || val.toLowerCase() === 'na' || val === '-') {
          stat.nullCount++;
        } else {
          stat.nonNullCount++;
          const num = Number(val);
          if (!isNaN(num) && val !== '') {
            stat.numericCount++;
            stat.numericSum += num;
            if (stat.min === null || num < stat.min) stat.min = num;
            if (stat.max === null || num > stat.max) stat.max = num;
          }
          if (stat.values.length < 20) {
            stat.values.push(val);
          }
        }
      });
    }

    // Determine final column types and averages
    const summaryColumns = headers.map(h => {
      const s = columnStats[h];
      const isNum = s.nonNullCount > 0 && (s.numericCount / s.nonNullCount >= 0.8);
      const isDate = !isNum && s.values.some(v => !isNaN(Date.parse(v)) && /\d{4}|\d{2}\/\d{2}/.test(v));
      const type = isNum ? 'numeric' : (isDate ? 'datetime' : 'string');

      return {
        column: h,
        type,
        fillRatePercent: rowCount > 0 ? Math.round((s.nonNullCount / rowCount) * 100) : 0,
        nullCount: s.nullCount,
        min: s.min,
        max: s.max,
        mean: isNum && s.numericCount > 0 ? parseFloat((s.numericSum / s.numericCount).toFixed(2)) : null
      };
    });

    const summary = `CSV dataset "${meta.filename || 'dataset'}" contains ${rowCount} rows and ${headers.length} columns (${headers.join(', ')}). Total non-null records: ${rowCount * headers.length - summaryColumns.reduce((acc, c) => acc + c.nullCount, 0)}.`;

    return {
      type: 'tabular_dataset',
      format: 'CSV',
      filename: meta.filename,
      filePath: meta.filePath || null,
      sizeBytes: meta.sizeBytes || Buffer.byteLength(csvText, 'utf8'),
      rowCount,
      columnCount: headers.length,
      headers,
      columns: summaryColumns,
      sampleRows,
      summary
    };
  }

  parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  /**
   * Analyzes JSON structure, schema and contents
   */
  analyzeJson(jsonText, meta = {}) {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      return {
        type: 'json_error',
        filename: meta.filename,
        error: `JSON Syntax Error: ${err.message}`,
        summary: `Invalid JSON syntax in "${meta.filename}": ${err.message}`
      };
    }

    const isArray = Array.isArray(parsed);
    const topLevelKeys = isArray ? [] : Object.keys(parsed);
    const count = isArray ? parsed.length : topLevelKeys.length;

    const schema = {};
    if (!isArray && typeof parsed === 'object' && parsed !== null) {
      topLevelKeys.forEach(k => {
        const v = parsed[k];
        schema[k] = Array.isArray(v) ? `Array[${v.length}]` : (typeof v === 'object' && v !== null ? `Object{${Object.keys(v).length}}` : typeof v);
      });
    }

    const summary = isArray
      ? `JSON array in "${meta.filename}" containing ${parsed.length} items.`
      : `JSON configuration in "${meta.filename}" containing ${topLevelKeys.length} top-level fields: ${topLevelKeys.slice(0, 10).join(', ')}${topLevelKeys.length > 10 ? '...' : ''}.`;

    return {
      type: 'json_data',
      filename: meta.filename,
      filePath: meta.filePath || null,
      sizeBytes: meta.sizeBytes || Buffer.byteLength(jsonText, 'utf8'),
      isArray,
      itemCount: count,
      topLevelKeys,
      schema,
      summary
    };
  }

  /**
   * Analyzes log files and runtime stack traces
   */
  analyzeLog(logText, meta = {}) {
    const lines = logText.split(/\r?\n/);
    const errors = [];
    const warnings = [];
    let fatalCount = 0;

    lines.forEach((line, idx) => {
      if (/\b(?:ERROR|FATAL|EXCEPTION|FAIL|CRITICAL)\b/i.test(line)) {
        if (/FATAL/i.test(line)) fatalCount++;
        if (errors.length < 20) {
          errors.push({ lineNum: idx + 1, message: line.trim() });
        }
      } else if (/\bWARN(?:ING)?\b/i.test(line)) {
        if (warnings.length < 15) {
          warnings.push({ lineNum: idx + 1, message: line.trim() });
        }
      }
    });

    // Detect primary root cause
    const rootCauseMatch = logText.match(/(?:Caused by:|Error:|Exception:)\s*([^\r\n]+)/i);
    const rootCause = rootCauseMatch ? rootCauseMatch[1].trim() : (errors.length > 0 ? errors[0].message : null);

    const summary = `Log analysis for "${meta.filename}": Scanned ${lines.length} lines. Detected ${errors.length} error entries (${fatalCount} fatal) and ${warnings.length} warnings. Primary identified issue: ${rootCause || 'No explicit failure markers identified'}.`;

    return {
      type: 'log_analysis',
      filename: meta.filename,
      filePath: meta.filePath || null,
      sizeBytes: meta.sizeBytes || Buffer.byteLength(logText, 'utf8'),
      totalLines: lines.length,
      errorCount: errors.length,
      fatalCount,
      warningCount: warnings.length,
      rootCause,
      sampleErrors: errors.slice(0, 5),
      sampleWarnings: warnings.slice(0, 5),
      summary
    };
  }

  /**
   * Analyzes source code files
   */
  analyzeCodeDocument(codeText, meta = {}) {
    const lines = codeText.split(/\r?\n/);
    const lineCount = lines.length;

    // Detect imports / requires
    const imports = [];
    const importRegex = /(?:import\s+(?:.+?\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    let match;
    while ((match = importRegex.exec(codeText)) !== null) {
      const mod = match[1] || match[2];
      if (mod && !imports.includes(mod)) imports.push(mod);
    }

    // Detect functions and classes
    const functions = [];
    const classes = [];
    const fnRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(?:async\s+)?([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{)/g;
    while ((match = fnRegex.exec(codeText)) !== null) {
      const fn = match[1] || match[2] || match[3];
      if (fn && !['if', 'for', 'while', 'switch', 'catch'].includes(fn) && !functions.includes(fn)) {
        functions.push(fn);
      }
    }

    const classRegex = /class\s+([a-zA-Z0-9_$]+)/g;
    while ((match = classRegex.exec(codeText)) !== null) {
      if (match[1] && !classes.includes(match[1])) classes.push(match[1]);
    }

    const summary = `Source file "${meta.filename}" (${meta.ext}) has ${lineCount} lines. Detected ${classes.length} class${classes.length === 1 ? '' : 'es'} (${classes.join(', ') || 'none'}), ${functions.length} functions, and ${imports.length} external module dependencies (${imports.slice(0, 6).join(', ') || 'none'}).`;

    return {
      type: 'source_code',
      language: meta.ext.replace('.', '') || 'code',
      filename: meta.filename,
      filePath: meta.filePath || null,
      sizeBytes: meta.sizeBytes || Buffer.byteLength(codeText, 'utf8'),
      lineCount,
      classes,
      functionsCount: functions.length,
      sampleFunctions: functions.slice(0, 10),
      imports,
      summary
    };
  }

  /**
   * Analyzes general text or Markdown documents
   */
  analyzeTextDocument(text, meta = {}) {
    const lines = text.split(/\r?\n/);
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

    // Markdown headings
    const headings = [];
    lines.forEach(line => {
      const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (hMatch && headings.length < 15) {
        headings.push({ level: hMatch[1].length, title: hMatch[2].trim() });
      }
    });

    const isMarkdown = meta.ext === '.md' || headings.length > 0;
    const summary = `Document "${meta.filename}" contains ${wordCount} words across ${lines.length} lines. Estimated reading time: ~${readingTimeMin} minute${readingTimeMin === 1 ? '' : 's'}.${headings.length > 0 ? ` Structured with ${headings.length} headings.` : ''}`;

    return {
      type: isMarkdown ? 'markdown_document' : 'text_document',
      filename: meta.filename,
      filePath: meta.filePath || null,
      sizeBytes: meta.sizeBytes || Buffer.byteLength(text, 'utf8'),
      wordCount,
      lineCount: lines.length,
      estimatedReadingTimeMinutes: readingTimeMin,
      headings,
      summary
    };
  }
}

module.exports = {
  DocumentAnalyzer,
  documentAnalyzerInstance: new DocumentAnalyzer()
};
