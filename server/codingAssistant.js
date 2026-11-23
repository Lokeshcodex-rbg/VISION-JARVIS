/**
 * VISION AI — Controlled Coding Assistant & Development Tools
 * Provides a safe, disciplined workflow for development tasks:
 * 1. Reads and explains workspace code safely with line ranges.
 * 2. Locates symbols, functions, dependencies, and stack trace contexts.
 * 3. Proposes surgical diff patches and explains potential regressions.
 * 4. Strictly requires explicit single-use approval tokens for file writes.
 * 5. Runs allowlisted automated tests without arbitrary shell execution.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { securityPermissionsInstance, WORKSPACE_ROOT } = require('./securityPermissions.js');

const ALLOWED_TEST_SCRIPTS = new Set([
  'test_voice_latency_streaming_repair.js',
  'test_vad_session.js',
  'test_cinematic_sleep_wake.js',
  'test_cinematic_personality_switch.js',
  'test_reliability_multilingual_tools.js',
  'test_full_system_audit.js',
  'test_independent_gemini_streaming.js'
]);

class CodingAssistant {
  constructor() {
    this.workspaceRoot = WORKSPACE_ROOT;
  }

  /**
   * Safely reads a project file with optional line bounding.
   */
  readProjectFile(relPath, options = {}) {
    const fullPath = securityPermissionsInstance.resolveSafePath(relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: "${relPath}"`);
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error(`Target "${relPath}" is a directory, not a file.`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    const startLine = Math.max(1, parseInt(options.startLine, 10) || 1);
    const maxLines = Math.min(400, parseInt(options.maxLines, 10) || 150);
    const endLine = options.endLine ? Math.min(totalLines, parseInt(options.endLine, 10)) : Math.min(totalLines, startLine + maxLines - 1);

    const slice = lines.slice(startLine - 1, endLine).map((line, idx) => {
      const lineNum = startLine + idx;
      return `${String(lineNum).padStart(4, ' ')}: ${line}`;
    });

    return {
      relPath: path.relative(this.workspaceRoot, fullPath),
      totalLines,
      sizeBytes: stat.size,
      startLine,
      endLine,
      lineCount: slice.length,
      lines: slice,
      code: slice.join('\n'),
      summary: `Read ${slice.length} lines (${startLine}-${endLine} of ${totalLines}) from ${path.basename(fullPath)}.`
    };
  }

  /**
   * Searches for symbol definitions, functions, classes, or patterns across workspace.
   */
  searchSymbols(query) {
    const term = String(query || '').trim();
    if (!term) throw new Error('Search term cannot be empty.');

    const pattern = new RegExp(term, 'i');
    const results = [];

    const walk = (dir) => {
      if (results.length >= 25) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.endsWith('.png')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(js|json|html|css|md)$/i.test(entry.name)) {
          try {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split(/\r?\n/);
            lines.forEach((line, idx) => {
              if (pattern.test(line) && results.length < 25) {
                results.push({
                  file: path.relative(this.workspaceRoot, full),
                  line: idx + 1,
                  preview: line.trim()
                });
              }
            });
          } catch (e) {}
        }
      }
    };

    walk(this.workspaceRoot);

    return {
      success: true,
      query: term,
      matchCount: results.length,
      matches: results,
      results,
      summary: `Found ${results.length} occurrence${results.length === 1 ? '' : 's'} matching "${term}" across project files.`
    };
  }

  /**
   * Analyzes a runtime stack trace and maps each frame back to existing workspace files.
   */
  debugStackTrace(stackText) {
    const raw = String(stackText || '').trim();
    const frames = [];
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
      const match = line.match(/(?:at\s+)?(?:(.+?)\s+\()?([a-zA-Z0-9_\-\.\/\\]+):(\d+):(\d+)\)?/);
      if (match) {
        const [, fnName, rawFilePath, lineNum, colNum] = match;
        let safePath = null;
        let exists = false;
        let snippet = null;

        try {
          safePath = securityPermissionsInstance.resolveSafePath(rawFilePath);
          exists = fs.existsSync(safePath);
          if (exists) {
            const fileLines = fs.readFileSync(safePath, 'utf8').split(/\r?\n/);
            const target = parseInt(lineNum, 10);
            const start = Math.max(1, target - 3);
            const end = Math.min(fileLines.length, target + 3);
            snippet = fileLines.slice(start - 1, end).map((l, i) => {
              const curr = start + i;
              const marker = curr === target ? ' >>> ' : '     ';
              return `${marker}${curr}: ${l}`;
            }).join('\n');
          }
        } catch (e) {}

        frames.push({
          rawLine: line.trim(),
          function: fnName || '<anonymous>',
          file: safePath ? path.relative(this.workspaceRoot, safePath) : rawFilePath,
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          existsInWorkspace: exists,
          snippet
        });
      }
    }

    return {
      frameCount: frames.length,
      frames,
      primaryFrame: frames.find(f => f.existsInWorkspace) || frames[0] || null,
      summary: `Parsed ${frames.length} stack frames. Found ${frames.filter(f => f.existsInWorkspace).length} frames originating inside this workspace.`
    };
  }

  /**
   * Reviews project dependencies and scripts in package.json.
   */
  reviewDependencies() {
    const pkgPath = path.join(this.workspaceRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      throw new Error('package.json not found in workspace root.');
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const scripts = Object.keys(pkg.scripts || {});

    return {
      name: pkg.name || 'unnamed',
      version: pkg.version || '1.0.0',
      scripts,
      dependenciesCount: deps.length,
      devDependenciesCount: devDeps.length,
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      summary: `Package "${pkg.name}" defines ${scripts.length} scripts (${scripts.join(', ')}), ${deps.length} runtime dependencies, and ${devDeps.length} dev dependencies.`
    };
  }

  /**
   * Proposes a clean diff patch before applying changes.
   */
  proposeCodePatch(relPath, originalCode, replacementCode) {
    const fullPath = securityPermissionsInstance.resolveSafePath(relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Target file "${relPath}" does not exist.`);
    }

    const currentContent = fs.readFileSync(fullPath, 'utf8');
    const origClean = String(originalCode || '').trim();
    const replClean = String(replacementCode || '').trim();

    if (!currentContent.includes(origClean)) {
      return {
        valid: false,
        reason: 'TARGET_NOT_FOUND',
        summary: `Original target code block was not found in ${relPath}. No changes proposed.`
      };
    }

    const preview = `--- a/${relPath}\n+++ b/${relPath}\n@@ proposed changes @@\n-${origClean.split('\n').join('\n-')}\n+${replClean.split('\n').join('\n+')}`;

    return {
      valid: true,
      relPath,
      diffPreview: preview,
      summary: `Patch prepared for ${relPath}. Replaces ${origClean.split('\n').length} lines with ${replClean.split('\n').length} lines. Requires approval token to apply.`
    };
  }

  /**
   * Applies an approved code patch with atomic backup and rollback safety.
   */
  applyCodePatch(relPath, originalCode, replacementCode, approvalToken) {
    const fullPath = securityPermissionsInstance.resolveSafePath(relPath);

    // Verify and consume approval token for this high-impact action
    securityPermissionsInstance.verifyAndConsumeApproval(
      approvalToken,
      'APPLY_CODE_PATCH',
      relPath,
      { relPath, originalCode, replacementCode }
    );

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Target file "${relPath}" does not exist.`);
    }

    const currentContent = fs.readFileSync(fullPath, 'utf8');
    const origClean = String(originalCode || '');
    const replClean = String(replacementCode || '');

    if (!currentContent.includes(origClean)) {
      throw new Error(`Original target code snippet was not found in "${relPath}".`);
    }

    // 1. Create an atomic backup copy before editing
    const backupPath = fullPath + '.bak';
    fs.writeFileSync(backupPath, currentContent, 'utf8');

    try {
      const updatedContent = currentContent.replace(origClean, replClean);
      fs.writeFileSync(fullPath, updatedContent, 'utf8');

      return {
        status: 'applied',
        relPath,
        backupPath: path.relative(this.workspaceRoot, backupPath),
        summary: `Successfully applied patch to ${relPath}. Backup preserved at ${path.basename(backupPath)}.`
      };
    } catch (err) {
      // Rollback on write failure
      if (fs.existsSync(backupPath)) {
        fs.writeFileSync(fullPath, fs.readFileSync(backupPath, 'utf8'), 'utf8');
      }
      throw new Error(`Patch application failed: ${err.message}. Rolled back to original file.`);
    }
  }

  /**
   * Executes an allowlisted automated test suite file without shell interpolation.
   */
  runApprovedTest(testScriptName) {
    const scriptBase = path.basename(testScriptName || '').trim();
    const isAllowlisted = ALLOWED_TEST_SCRIPTS.has(scriptBase) || /^test_[a-zA-Z0-9_\-]+\.js$/i.test(scriptBase);
    if (!isAllowlisted) {
      return {
        status: 'rejected',
        reason: 'NOT_ALLOWLISTED',
        allowlist: Array.from(ALLOWED_TEST_SCRIPTS),
        summary: `Test script "${scriptBase}" is not on the approved test runner allowlist for automated execution.`
      };
    }

    let testFilePath = path.join(this.workspaceRoot, scriptBase);
    if (!fs.existsSync(testFilePath)) {
      const testsSubPath = path.join(this.workspaceRoot, 'tests', scriptBase);
      if (fs.existsSync(testsSubPath)) testFilePath = testsSubPath;
    }
    if (!fs.existsSync(testFilePath)) {
      return {
        status: 'not_found',
        summary: `Test script "${scriptBase}" does not exist in workspace root or tests/.`
      };
    }

    return new Promise((resolve) => {
      const t0 = Date.now();
      execFile('node', [testFilePath], { cwd: this.workspaceRoot, timeout: 35000 }, (err, stdout, stderr) => {
        const durationMs = Date.now() - t0;
        const out = String(stdout || '');
        const errOut = String(stderr || '');

        const passMatches = out.match(/(?:\[PASS\]|✓)/g) || [];
        const failMatches = out.match(/(?:\[FAIL\]|✗)/g) || [];

        resolve({
          status: err ? 'failed' : 'passed',
          scriptName: scriptBase,
          exitCode: err ? (err.code || 1) : 0,
          durationMs,
          passedAssertions: passMatches.length,
          failedAssertions: failMatches.length,
          stdoutSample: out.slice(0, 1200),
          stderrSample: errOut.slice(0, 500),
          summary: `Test suite ${scriptBase} completed in ${durationMs}ms with exit code ${err ? (err.code || 1) : 0} (${passMatches.length} passed, ${failMatches.length} failed).`
        });
      });
    });
  }

  // =========================================================================
  // DEEP CODEBASE RAG (Incremental SHA-256 Chunking & Semantic Retrieval)
  // =========================================================================

  _getRagIndexPath() {
    return path.join(this.workspaceRoot, 'data', 'codebase_rag_index.json');
  }

  _tokenizeCodeText(text) {
    return String(text || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter(t => t.length >= 2 && t.length <= 40);
  }

  _extractChunkSymbols(chunkLines) {
    const syms = [];
    for (const line of chunkLines) {
      const mClass = line.match(/^\s*(?:export\s+)?class\s+([A-Za-z0-9_]+)/);
      if (mClass) syms.push(mClass[1]);
      const mFn = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/);
      if (mFn) syms.push(mFn[1]);
      const mMeth = line.match(/^\s*(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]{2,})\s*\([^)]*\)\s*\{/);
      if (mMeth && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(mMeth[1])) {
        syms.push(mMeth[1]);
      }
      const mPy = line.match(/^\s*(?:def|class)\s+([A-Za-z0-9_]+)/);
      if (mPy) syms.push(mPy[1]);
    }
    return Array.from(new Set(syms));
  }

  /**
   * Incrementally indexes workspace code into line-bounded semantic chunks with SHA-256 skip checks
   */
  buildCodebaseRagIndex(options = {}) {
    const forceRebuild = Boolean(options.forceRebuild);
    const indexPath = this._getRagIndexPath();
    let prevIndex = { version: 1, files: {}, chunks: [], idf: {} };
    if (!forceRebuild && fs.existsSync(indexPath)) {
      try {
        prevIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      } catch (_) {}
    }

    const roots = ['server', 'js', 'desktop', 'ml_foundation', 'scripts', 'docs', 'tests', 'README.md', 'index.html', 'server.js', 'package.json'];
    const targetFiles = [];
    const walk = (absPath) => {
      if (!fs.existsSync(absPath)) return;
      const st = fs.statSync(absPath);
      if (st.isFile()) {
        if (/\.(js|py|ps1|html|css|json|md|txt)$/i.test(absPath) && !absPath.endsWith('three.module.js')) {
          targetFiles.push(absPath);
        }
        return;
      }
      if (st.isDirectory()) {
        const base = path.basename(absPath);
        if (['node_modules', '.git', 'libs', 'data', 'scratch', 'backups'].includes(base)) return;
        for (const entry of fs.readdirSync(absPath, { withFileTypes: true })) {
          walk(path.join(absPath, entry.name));
        }
      }
    };
    for (const r of roots) walk(path.join(this.workspaceRoot, r));

    const prevChunksByFile = new Map();
    for (const ch of (prevIndex.chunks || [])) {
      if (!prevChunksByFile.has(ch.file)) prevChunksByFile.set(ch.file, []);
      prevChunksByFile.get(ch.file).push(ch);
    }

    const nextFiles = {};
    const nextChunks = [];
    let reindexedCount = 0;
    let skippedUnchanged = 0;

    for (const fullPath of targetFiles) {
      const rel = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');
      let raw;
      try { raw = fs.readFileSync(fullPath, 'utf8'); } catch (_) { continue; }
      const hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
      const prevMeta = prevIndex.files?.[rel];

      if (!forceRebuild && prevMeta && prevMeta.sha256 === hash && prevChunksByFile.has(rel)) {
        nextFiles[rel] = prevMeta;
        nextChunks.push(...prevChunksByFile.get(rel));
        skippedUnchanged++;
        continue;
      }

      reindexedCount++;
      const lines = raw.split(/\r?\n/);
      const chunkSize = 55;
      const overlap = 10;
      const fileChunks = [];
      for (let start = 0; start < lines.length; start += (chunkSize - overlap)) {
        const end = Math.min(lines.length, start + chunkSize);
        const slice = lines.slice(start, end);
        const text = slice.join('\n');
        const symbols = this._extractChunkSymbols(slice);
        const tokens = this._tokenizeCodeText(`${rel} ${symbols.join(' ')} ${text}`);
        const tf = {};
        for (const t of tokens) tf[t] = (tf[t] || 0) + 1;

        fileChunks.push({
          chunkId: `${rel}:${start + 1}-${end}`,
          file: rel,
          startLine: start + 1,
          endLine: end,
          symbols,
          tf,
          tokenCount: tokens.length,
          preview: slice.slice(0, 6).join('\n')
        });
        if (end >= lines.length) break;
      }

      nextFiles[rel] = { sha256: hash, lines: lines.length, chunksCount: fileChunks.length, indexedAt: new Date().toISOString() };
      nextChunks.push(...fileChunks);
    }

    // Compute inverse document frequency across all chunks
    const df = {};
    const N = Math.max(1, nextChunks.length);
    for (const ch of nextChunks) {
      for (const term of Object.keys(ch.tf || {})) {
        df[term] = (df[term] || 0) + 1;
      }
    }
    const idf = {};
    for (const [term, count] of Object.entries(df)) {
      idf[term] = Number((Math.log((N + 1) / (count + 1)) + 1).toFixed(4));
    }

    const indexObj = {
      version: 1,
      updatedAt: new Date().toISOString(),
      stats: {
        totalFiles: Object.keys(nextFiles).length,
        totalChunks: nextChunks.length,
        reindexedFiles: reindexedCount,
        unchangedSkipped: skippedUnchanged
      },
      files: nextFiles,
      idf,
      chunks: nextChunks
    };

    try {
      const dir = path.dirname(indexPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(indexPath, JSON.stringify(indexObj), 'utf8');
    } catch (_) {}

    this._ragCache = indexObj;
    return {
      success: true,
      indexPath,
      stats: indexObj.stats,
      summary: `Codebase RAG indexed ${indexObj.stats.totalFiles} files (${indexObj.stats.totalChunks} semantic chunks; ${reindexedCount} updated, ${skippedUnchanged} unchanged).`
    };
  }

  /**
   * Semantic + symbol search across the indexed workspace codebase
   */
  semanticSearchCodebase(query, options = {}) {
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) return { success: false, matches: [], summary: 'Search query cannot be empty.' };

    if (!this._ragCache) {
      const indexPath = this._getRagIndexPath();
      if (fs.existsSync(indexPath)) {
        try { this._ragCache = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch (_) {}
      }
    }
    if (!this._ragCache || !Array.isArray(this._ragCache.chunks) || this._ragCache.chunks.length === 0) {
      this.buildCodebaseRagIndex();
    }

    const qTokens = Array.from(new Set(this._tokenizeCodeText(cleanQuery)));
    const qLower = cleanQuery.toLowerCase();
    const idf = this._ragCache.idf || {};
    const topK = Math.max(1, Math.min(20, parseInt(options.topK, 10) || 8));

    const scored = [];
    for (const ch of (this._ragCache.chunks || [])) {
      let score = 0;
      const tf = ch.tf || {};
      const normFactor = Math.sqrt(Math.max(1, ch.tokenCount || 1));

      for (const qt of qTokens) {
        if (tf[qt]) {
          score += (tf[qt] / normFactor) * (idf[qt] || 1.5);
        }
      }

      if (ch.file.toLowerCase().includes(qLower)) score += 2.5;
      for (const sym of (ch.symbols || [])) {
        const symLow = sym.toLowerCase();
        if (symLow === qLower) {
          score += 6.0;
        } else if (symLow.includes(qLower) || qTokens.some(t => symLow.includes(t))) {
          score += 1.4;
        }
      }

      if (score > 0.15) {
        const sourceType = /\.(md|txt)$/i.test(ch.file) ? 'documentation' : 'code';
        scored.push({
          chunkId: ch.chunkId,
          file: ch.file,
          sourceType,
          epistemicSource: sourceType === 'documentation' ? 'LOCAL_DOCUMENTATION' : 'LOCAL_CODEBASE',
          startLine: ch.startLine,
          endLine: ch.endLine,
          symbols: ch.symbols,
          score: Number(score.toFixed(3)),
          preview: ch.preview
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const matches = scored.slice(0, topK);

    return {
      success: true,
      query: cleanQuery,
      indexedFiles: this._ragCache.stats?.totalFiles || 0,
      indexedChunks: this._ragCache.stats?.totalChunks || 0,
      matches,
      summary: matches.length > 0
        ? `Found ${matches.length} relevant code section(s) for "${cleanQuery}": top match in ${matches[0].file}:${matches[0].startLine}-${matches[0].endLine} (symbols: ${matches[0].symbols.slice(0, 4).join(', ') || 'module code'}).`
        : `No strong semantic matches found for "${cleanQuery}" across ${this._ragCache.stats?.totalFiles || 0} indexed files.`
    };
  }
}

module.exports = {
  CodingAssistant,
  codingAssistantInstance: new CodingAssistant(),
  ALLOWED_TEST_SCRIPTS
};
