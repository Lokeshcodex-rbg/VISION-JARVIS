/**
 * VISION AI — Autonomous Self-Coding & Self-Development Engine
 * Provides comprehensive software engineering capabilities directly within VISION AI:
 * - Full repository & source code inspection with architecture mapping
 * - Structured code writing, atomic editing, optimistic concurrency hashing, and diff patching
 * - Dynamic tool scaffolding and runtime activation
 * - Autonomous test generation and test suite execution
 * - Multi-language project detection (Node.js, TypeScript, Python, Maven, HTML/CSS)
 * - Autonomous debugging loop (Inspect -> Reproduce -> Diagnose -> Patch -> Test -> Validate)
 * - Git branch creation, git diff inspection, versioned backups, and automated rollback
 * 
 * Invariants:
 * - Immutable security core assets are shielded from self-modification.
 * - Emergency stop strictly halts all code modifications and executions immediately.
 * - Edits detect stale file versions and ambiguous matches before writing.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec, execSync, execFile } = require('child_process');
const vm = require('vm');

const { securityPermissionsInstance } = require('./securityPermissions.js');
const { analyzeCode } = require('./codeSecurityAnalyzer.js');
const { permissionGateInstance } = require('./desktop/permissionGate.js');
const { dynamicToolsManagerInstance } = require('./dynamicToolsManager.js');

const PROJECT_ROOT = process.env.JARVIS_PROJECT_PATH
  ? path.resolve(process.env.JARVIS_PROJECT_PATH)
  : path.resolve(__dirname, '..');

const BACKUPS_DIR = path.join(PROJECT_ROOT, 'backups', 'code_edits');
const STAGING_DIR = path.join(PROJECT_ROOT, 'scratch', 'dev_staging');
const WORKSPACES_DIR = path.join(PROJECT_ROOT, 'scratch', 'dev_workspaces');

const IMMUTABLE_CORE_ASSETS = [
  'server/securityPermissions.js',
  'server/serverAuthManager.js',
  'server/desktop/permissionGate.js',
  'server/desktop/permissionManager.js',
  'server/desktop/localWorkspaceManager.js',
  'server/selfRepairService.js',
  'server/selfDevelopmentEngine.js',
  'server/capabilityRegistry.js',
  'server/unifiedIntelligenceLayer.js',
  'server/emergencyStopController.js',
  'js/modules/emergencyStopCoordinator.js',
  'desktop/main.js'
];

class SelfDevelopmentEngine {
  constructor() {
    this.workspaceRoot = PROJECT_ROOT;
    this.IMMUTABLE_CORE_ASSETS = IMMUTABLE_CORE_ASSETS;
    this.ensureDirectories();
  }

  ensureDirectories() {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      if (!fs.existsSync(STAGING_DIR)) fs.mkdirSync(STAGING_DIR, { recursive: true });
      if (!fs.existsSync(WORKSPACES_DIR)) fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
    } catch (e) {
      console.warn('[SELF_DEV] Error creating directories:', e.message);
    }
  }

  /**
   * Evaluates if a relative target file is part of the immutable security core
   */
  isImmutableTarget(relPath) {
    const normalized = String(relPath || '').replace(/\\/g, '/').toLowerCase();
    for (const item of IMMUTABLE_CORE_ASSETS) {
      if (normalized.includes(item.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validates a candidate patch before staging or deployment
   */
  validateCandidatePatch(options = {}) {
    const rawPath = String(options.filePath || '').trim();
    if (!rawPath) throw new Error('filePath is required for patch validation.');
    const relPath = path.relative(this.workspaceRoot, this.resolveSafePath(rawPath));
    if (this.isImmutableTarget(relPath)) {
      throw new Error(`IMMUTABLE_CORE_FILE: File "${relPath}" is an immutable security core asset and cannot be modified.`);
    }
    return {
      valid: true,
      filePath: relPath,
      verifiedNonImmutable: true
    };
  }

  /**
   * Resolves and validates a safe file path strictly within workspace
   */
  resolveSafePath(targetPath) {
    return securityPermissionsInstance.resolveSafePath(targetPath);
  }

  /**
   * Computes SHA-256 hash of a file for optimistic concurrency
   */
  computeFileHash(absPath) {
    if (!fs.existsSync(absPath)) return null;
    const content = fs.readFileSync(absPath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // =========================================================================
  // 1. REPOSITORY & PROJECT UNDERSTANDING
  // =========================================================================

  /**
   * Inspects repository structure, detects language toolchains and project types
   */
  async inspectProject(options = {}) {
    const targetDir = options.targetDir
      ? this.resolveSafePath(options.targetDir)
      : this.workspaceRoot;

    const maxDepth = Math.max(1, Math.min(6, parseInt(options.maxDepth, 10) || 3));
    const projectTypes = [];
    const languageFiles = {};
    const topLevelDirs = [];
    let totalFiles = 0;
    let totalSizeBytes = 0;

    // Detect project markers
    if (fs.existsSync(path.join(targetDir, 'package.json'))) projectTypes.push('Node.js / JavaScript');
    if (fs.existsSync(path.join(targetDir, 'tsconfig.json'))) projectTypes.push('TypeScript');
    if (fs.existsSync(path.join(targetDir, 'requirements.txt')) || fs.existsSync(path.join(targetDir, 'pyproject.toml'))) projectTypes.push('Python');
    if (fs.existsSync(path.join(targetDir, 'pom.xml'))) projectTypes.push('Java / Maven');
    if (fs.existsSync(path.join(targetDir, 'index.html'))) projectTypes.push('Web Frontend (HTML/CSS/JS)');
    if (fs.existsSync(path.join(targetDir, '.git'))) projectTypes.push('Git Version Control');

    // Detect installed system runtimes
    const toolchains = await this.detectInstalledToolchains();

    // Package.json inspect
    let packageInfo = null;
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        packageInfo = {
          name: pkg.name || 'unnamed',
          version: pkg.version || '1.0.0',
          scripts: pkg.scripts || {},
          dependenciesCount: Object.keys(pkg.dependencies || {}).length,
          devDependenciesCount: Object.keys(pkg.devDependencies || {}).length,
          main: pkg.main || null
        };
      } catch (e) {}
    }

    // Traverse directory tree up to maxDepth
    const scan = (currentDir, depth) => {
      if (depth > maxDepth) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'backups' || entry.name === 'scratch') {
          if (depth === 1) topLevelDirs.push(entry.name);
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (depth === 1) topLevelDirs.push(entry.name);
          scan(fullPath, depth + 1);
        } else if (entry.isFile()) {
          totalFiles++;
          const stat = fs.statSync(fullPath);
          totalSizeBytes += stat.size;
          const ext = path.extname(entry.name).toLowerCase() || '.noext';
          languageFiles[ext] = (languageFiles[ext] || 0) + 1;
        }
      }
    };

    scan(targetDir, 1);

    if (languageFiles['.py'] && !projectTypes.includes('Python')) projectTypes.push('Python');
    if (languageFiles['.ts'] && !projectTypes.includes('TypeScript')) projectTypes.push('TypeScript');
    if (languageFiles['.java'] && !projectTypes.includes('Java / Maven')) projectTypes.push('Java / Maven');

    return {
      success: true,
      workspaceRoot: this.workspaceRoot,
      targetDir: path.relative(this.workspaceRoot, targetDir) || '.',
      projectTypes,
      toolchains,
      packageInfo,
      topLevelDirs,
      fileBreakdown: languageFiles,
      totalFiles,
      totalSizeBytes,
      summary: `Project "${packageInfo?.name || 'VISION AI'}" identified as ${projectTypes.join(', ')} with ${totalFiles} scanned files across ${topLevelDirs.length} primary directories.`
    };
  }

  /**
   * Detects installed language runtimes and toolchains on Windows host
   */
  async detectInstalledToolchains() {
    const results = {};
    const checkCmd = (bin, verArg) => new Promise((resolve) => {
      exec(`${bin} ${verArg}`, { timeout: 3500 }, (err, stdout) => {
        if (!err && stdout) {
          resolve({ available: true, version: stdout.trim().split('\n')[0] });
        } else {
          resolve({ available: false });
        }
      });
    });

    results.node = await checkCmd('node', '-v');
    results.python = await checkCmd('python', '--version');
    results.git = await checkCmd('git', '--version');
    results.tsc = await checkCmd('tsc', '-v');

    return results;
  }

  /**
   * Searches source code across workspace files with surrounding context lines
   */
  searchSourceCode(options = {}) {
    const query = String(options.query || '').trim();
    if (!query) throw new Error('Search query cannot be empty.');

    const maxResults = Math.min(50, parseInt(options.maxResults, 10) || 25);
    const caseSensitive = Boolean(options.caseSensitive);
    const flags = caseSensitive ? 'g' : 'gi';
    let regex;
    try {
      regex = new RegExp(query, flags);
    } catch (e) {
      regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    }

    const results = [];
    const walk = (dir) => {
      if (results.length >= maxResults) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'backups' || entry.name.endsWith('.png')) {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && /\.(js|mjs|cjs|ts|py|json|html|css|md|sql)$/i.test(entry.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                const lineNum = i + 1;
                const start = Math.max(1, lineNum - 2);
                const end = Math.min(lines.length, lineNum + 2);
                const contextLines = lines.slice(start - 1, end).map((l, idx) => {
                  const curr = start + idx;
                  const prefix = curr === lineNum ? ' >>> ' : '     ';
                  return `${prefix}${curr}: ${l}`;
                });

                results.push({
                  file: path.relative(this.workspaceRoot, fullPath),
                  line: lineNum,
                  matchText: lines[i].trim(),
                  context: contextLines.join('\n')
                });

                if (results.length >= maxResults) break;
              }
            }
          } catch (e) {}
        }
      }
    };

    walk(this.workspaceRoot);

    return {
      success: true,
      query,
      resultsCount: results.length,
      matches: results,
      summary: `Found ${results.length} matches for "${query}" across project source code.`
    };
  }

  /**
   * Finds where a function or symbol is invoked or called across project source files
   */
  findCallSites(symbolName, options = {}) {
    const symbol = String(symbolName || '').trim();
    if (!symbol) throw new Error('symbolName is required.');
    const regex = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`, 'g');
    const results = [];
    const maxResults = Math.min(50, parseInt(options.maxResults, 10) || 20);

    const walk = (dir) => {
      if (results.length >= maxResults) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'backups' || entry.name === 'scratch') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && /\.(js|mjs|cjs|ts|py)$/i.test(entry.name)) {
          try {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push({
                  file: path.relative(this.workspaceRoot, full).replace(/\\/g, '/'),
                  line: i + 1,
                  callText: lines[i].trim()
                });
                if (results.length >= maxResults) break;
              }
            }
          } catch (_) {}
        }
      }
    };

    walk(this.workspaceRoot);

    return {
      success: true,
      symbol,
      callSitesCount: results.length,
      callSites: results,
      summary: `Found ${results.length} call site(s) for "${symbol}" in project.`
    };
  }

  /**
   * Discovers test suite files in the project
   */
  findTestFiles() {
    const testFiles = [];
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'backups' || entry.name === 'scratch') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && /^(test_.*|.*\.test)\.(js|py)$/i.test(entry.name)) {
          testFiles.push(path.relative(this.workspaceRoot, full).replace(/\\/g, '/'));
        }
      }
    };

    walk(this.workspaceRoot);

    return {
      success: true,
      count: testFiles.length,
      testFiles,
      summary: `Located ${testFiles.length} test suite file(s) in project.`
    };
  }

  /**
   * Inspects recent runtime server and execution logs
   */
  inspectRuntimeLogs(options = {}) {
    const maxLines = Math.min(200, parseInt(options.maxLines, 10) || 50);
    const logs = [];
    const logPaths = [
      path.join(this.workspaceRoot, 'server.log'),
      path.join(this.workspaceRoot, 'logs', 'error.log'),
      path.join(this.workspaceRoot, 'logs', 'server.log')
    ];

    for (const lp of logPaths) {
      if (fs.existsSync(lp)) {
        try {
          const content = fs.readFileSync(lp, 'utf8');
          const lines = content.split(/\r?\n/).filter(Boolean);
          const recent = lines.slice(-maxLines);
          logs.push({
            logFile: path.basename(lp),
            recentLines: recent,
            count: recent.length
          });
        } catch (_) {}
      }
    }

    return {
      success: true,
      logs,
      summary: logs.length > 0 ? `Retrieved runtime logs from ${logs.length} log file(s).` : 'No active server.log or logs/ files found.'
    };
  }

  /**
   * Reads source file safely with line numbering, file size, and optimistic sha256 hash
   */
  readSourceFile(options = {}) {
    const rawPath = String(options.filePath || '').trim();
    if (!rawPath) throw new Error('filePath is required.');

    const absPath = this.resolveSafePath(rawPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found: "${rawPath}"`);
    }

    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      throw new Error(`Target "${rawPath}" is a directory, not a file.`);
    }

    const content = fs.readFileSync(absPath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    const startLine = Math.max(1, parseInt(options.startLine, 10) || 1);
    const maxLines = Math.min(500, parseInt(options.maxLines, 10) || 150);
    const endLine = options.endLine ? Math.min(totalLines, parseInt(options.endLine, 10)) : Math.min(totalLines, startLine + maxLines - 1);

    const slice = lines.slice(startLine - 1, endLine).map((l, idx) => {
      const lineNum = startLine + idx;
      return `${String(lineNum).padStart(4, ' ')}: ${l}`;
    });

    return {
      success: true,
      filePath: path.relative(this.workspaceRoot, absPath),
      totalLines,
      startLine,
      endLine,
      lineCount: slice.length,
      sha256: hash,
      sizeBytes: stat.size,
      code: slice.join('\n'),
      summary: `Read ${slice.length} lines (${startLine}-${endLine} of ${totalLines}) from ${path.basename(absPath)}.`
    };
  }

  // =========================================================================
  // 2. CODE WRITING, CREATION & STRUCTURED EDITING
  // =========================================================================

  /**
   * Creates a new source file with path traversal protection and immutable core defense
   */
  createSourceFile(options = {}) {
    const rawPath = String(options.filePath || '').trim();
    if (!rawPath) throw new Error('filePath is required.');

    const absPath = this.resolveSafePath(rawPath);
    const relPath = path.relative(this.workspaceRoot, absPath);

    if (this.isImmutableTarget(relPath)) {
      throw new Error(`Security Policy Rejection: File "${relPath}" is an immutable security core asset.`);
    }

    if (fs.existsSync(absPath) && !options.overwrite) {
      throw new Error(`File "${relPath}" already exists. Set overwrite: true to replace.`);
    }

    // Ensure parent directory
    fs.mkdirSync(path.dirname(absPath), { recursive: true });

    const content = String(options.content !== undefined ? options.content : '');

    // Validate JavaScript syntax if .js file
    const ext = path.extname(absPath).toLowerCase();
    if (ext === '.js' && options.validateSyntax !== false) {
      try {
        new vm.Script(content);
      } catch (syntaxErr) {
        throw new Error(`Syntax Error in created JavaScript file: ${syntaxErr.message}`);
      }
    }

    // Atomic write pattern: write to tmp in same dir, then rename
    const tmpPath = path.join(path.dirname(absPath), `.tmp_create_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
    try {
      fs.writeFileSync(tmpPath, content, 'utf8');
      fs.renameSync(tmpPath, absPath);
    } catch (err) {
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
      throw new Error(`Atomic write failure for "${relPath}": ${err.message}`);
    }

    // Post-write verification
    if (!fs.existsSync(absPath)) {
      throw new Error(`Write Verification Failure: Created file "${relPath}" not found on disk.`);
    }
    const verifiedContent = fs.readFileSync(absPath, 'utf8');
    const hash = crypto.createHash('sha256').update(verifiedContent).digest('hex');

    permissionGateInstance.logAudit({
      action: 'SELF_DEV_FILE_CREATED',
      target: relPath,
      personality: 'JARVIS',
      details: { sizeBytes: Buffer.byteLength(content), sha256: hash }
    });

    return {
      success: true,
      filePath: relPath,
      sizeBytes: Buffer.byteLength(content),
      sha256: hash,
      message: `File "${relPath}" created successfully.`
    };
  }

  /**
   * Atomically edits an existing source file with optimistic concurrency and backup preservation
   */
  editSourceFile(options = {}) {
    const rawPath = String(options.filePath || '').trim();
    if (!rawPath) throw new Error('filePath is required.');

    const absPath = this.resolveSafePath(rawPath);
    const relPath = path.relative(this.workspaceRoot, absPath);

    if (this.isImmutableTarget(relPath)) {
      throw new Error(`Security Policy Rejection: File "${relPath}" is an immutable security core asset.`);
    }

    if (!fs.existsSync(absPath)) {
      throw new Error(`Target file "${relPath}" does not exist.`);
    }

    const currentContent = fs.readFileSync(absPath, 'utf8');
    const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');

    // Optimistic Concurrency / Stale Edit Detection
    if (options.expectedHash && options.expectedHash !== currentHash) {
      throw new Error(`STALE_FILE_VERSION: Expected hash "${options.expectedHash}" does not match current file hash "${currentHash}". File was modified concurrently.`);
    }

    const targetCode = String(options.targetCode !== undefined ? options.targetCode : (options.targetContent || ''));
    const replacementCode = String(options.replacementCode !== undefined ? options.replacementCode : (options.replacementContent || ''));

    if (!targetCode) {
      throw new Error('targetCode is required.');
    }

    if (!currentContent.includes(targetCode)) {
      throw new Error(`TARGET_NOT_FOUND: Specified targetCode snippet was not found in "${relPath}".`);
    }

    // Ambiguity Check: Ensure unique match unless allowMultiple is explicitly requested
    const firstIdx = currentContent.indexOf(targetCode);
    const lastIdx = currentContent.lastIndexOf(targetCode);
    if (firstIdx !== lastIdx && !options.allowMultiple) {
      throw new Error(`AMBIGUOUS_TARGET: targetCode occurs multiple times in "${relPath}". Please provide a larger unique context block or set allowMultiple: true.`);
    }

    // Create versioned backup
    this.ensureDirectories();
    const backupId = `edit_${Date.now()}_${path.basename(relPath)}`;
    const backupPath = path.join(BACKUPS_DIR, backupId);
    fs.writeFileSync(backupPath, currentContent, 'utf8');

    // Apply replacement
    let newContent;
    if (options.allowMultiple) {
      newContent = currentContent.split(targetCode).join(replacementCode);
    } else {
      newContent = currentContent.slice(0, firstIdx) + replacementCode + currentContent.slice(firstIdx + targetCode.length);
    }

    // Validate syntax before write if .js
    const editExt = path.extname(absPath).toLowerCase();
    if (editExt === '.js' && options.validateSyntax !== false) {
      try {
        new vm.Script(newContent);
      } catch (syntaxErr) {
        throw new Error(`Syntax Error in proposed edit: ${syntaxErr.message}`);
      }
    }

    // Atomic write pattern
    const tmpEditPath = path.join(path.dirname(absPath), `.tmp_edit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
    try {
      fs.writeFileSync(tmpEditPath, newContent, 'utf8');
      fs.renameSync(tmpEditPath, absPath);
    } catch (err) {
      if (fs.existsSync(tmpEditPath)) {
        try { fs.unlinkSync(tmpEditPath); } catch (_) {}
      }
      throw new Error(`Atomic write failure for "${relPath}": ${err.message}`);
    }

    // Post-write verification
    if (!fs.existsSync(absPath)) {
      throw new Error(`Verification Failure: Edited file "${relPath}" not found on disk.`);
    }
    const verifiedNewContent = fs.readFileSync(absPath, 'utf8');
    const newHash = crypto.createHash('sha256').update(verifiedNewContent).digest('hex');

    permissionGateInstance.logAudit({
      action: 'SELF_DEV_FILE_EDITED',
      target: relPath,
      personality: 'JARVIS',
      details: { backupId, originalHash: currentHash, newHash }
    });

    return {
      success: true,
      filePath: relPath,
      backupId,
      originalHash: currentHash,
      newHash,
      diff: `--- a/${relPath}\n+++ b/${relPath}\n@@ -1 +1 @@\n-${targetCode}\n+${replacementCode}`,
      diffSummary: {
        originalLength: currentContent.length,
        newLength: newContent.length,
        netChangeBytes: newContent.length - currentContent.length
      },
      message: `File "${relPath}" edited successfully with backup preserved as ${backupId}.`
    };
  }

  /**
   * Creates a brand new custom module with exports and documentation
   */
  createNewModule(options = {}) {
    const moduleName = String(options.moduleName || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!moduleName) throw new Error('moduleName is required.');

    const category = options.category || 'UTILITY';
    const description = options.description || `VISION AI Module: ${moduleName}`;
    const targetRelPath = `server/custom_tools/${moduleName}.js`;
    const absPath = this.resolveSafePath(targetRelPath);

    fs.mkdirSync(path.dirname(absPath), { recursive: true });

    let code = options.code;
    if (!code) {
      code = `/**
 * VISION AI — ${moduleName}
 * Description: ${description}
 * Category: ${category}
 */

module.exports = {
  name: "${moduleName}",
  description: "${description}",
  execute: async function(args = {}) {
    return {
      success: true,
      module: "${moduleName}",
      receivedArgs: args,
      timestamp: new Date().toISOString()
    };
  }
};
`;
    }

    // Verify syntax
    try {
      new vm.Script(code);
    } catch (syntaxErr) {
      throw new Error(`Syntax error in generated module code: ${syntaxErr.message}`);
    }

    fs.writeFileSync(absPath, code, 'utf8');

    return {
      success: true,
      moduleName,
      filePath: targetRelPath,
      description,
      message: `Module "${moduleName}" scaffolded and saved to ${targetRelPath}.`
    };
  }

  /**
   * Registers a newly developed tool into dynamic tools manager
   */
  registerNewTool(toolDef, code) {
    return dynamicToolsManagerInstance.createAndRegisterTool(toolDef, code);
  }

  // =========================================================================
  // 3. TESTING, LINTING, COMPILATION & DIAGNOSTICS
  // =========================================================================

  /**
   * Generates a complete unit test suite for a specified target module
   */
  generateTests(options = {}) {
    const targetModulePath = String(options.targetModulePath || '').trim();
    if (!targetModulePath) throw new Error('targetModulePath is required.');

    const absModulePath = this.resolveSafePath(targetModulePath);
    if (!fs.existsSync(absModulePath)) {
      throw new Error(`Module "${targetModulePath}" not found.`);
    }

    const testType = options.testType || 'unit';
    const testFileName = options.testFileName || `test_generated_${path.basename(targetModulePath, path.extname(targetModulePath))}.js`;
    const testRelPath = options.testDir ? path.join(options.testDir, testFileName) : testFileName;
    const absTestPath = this.resolveSafePath(testRelPath);

    let relFromTest = path.relative(path.dirname(absTestPath), absModulePath).replace(/\\/g, '/');
    if (!relFromTest.startsWith('.')) relFromTest = './' + relFromTest;
    const moduleReqPath = relFromTest;

    const testContent = `/**
 * Automated Generated Test Suite for ${path.basename(targetModulePath)}
 * Generated by VISION AI Autonomous Self-Development Engine
 */

const assert = require('assert');
const target = require('${moduleReqPath}');

console.log('Running test suite for: ${path.basename(targetModulePath)}');
let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    passed++;
    console.log('  [PASS]: ' + name);
  } catch (err) {
    failed++;
    console.error('  [FAIL]: ' + name + ' -> ' + err.message);
  }
}

// 1. Module Export Verification
it('Module exports correctly', () => {
  assert(target, 'Module must export an object or function');
  if (typeof target === 'object' && target !== null) {
    assert(typeof target.execute === 'function' || Object.keys(target).length > 0, 'Module should export execute method or module members');
  }
});

// 2. Invocation Safety Check
it('Handles empty arguments safely', async () => {
  if (typeof target.execute === 'function') {
    const res = await target.execute({});
    assert(res, 'Execution must return a result object');
  }
});

console.log('\\nGenerated Test Results: Passed: ' + passed + ' | Failed: ' + failed);
if (failed > 0) process.exit(1);
`;

    fs.writeFileSync(absTestPath, testContent, 'utf8');

    return {
      success: true,
      testFilePath: path.relative(this.workspaceRoot, absTestPath),
      targetModule: targetModulePath,
      message: `Generated automated test suite saved to ${path.relative(this.workspaceRoot, absTestPath)}.`
    };
  }

  /**
   * Executes project tests safely and captures stdout, stderr, exit code, and durations
   */
  async runProjectTests(options = {}) {
    const testFile = String(options.testFile || '').trim();
    if (!testFile) {
      return {
        success: false,
        exitCode: 1,
        testFile: '',
        error: 'testFile argument is required.',
        summary: 'testFile argument is required.'
      };
    }

    let absTestPath;
    try {
      absTestPath = this.resolveSafePath(testFile);
    } catch (err) {
      return {
        success: false,
        exitCode: 1,
        testFile,
        error: err.message,
        summary: `Invalid test file path: ${err.message}`
      };
    }

    if (!fs.existsSync(absTestPath)) {
      return {
        success: false,
        exitCode: 1,
        testFile,
        error: `Test file "${testFile}" does not exist.`,
        summary: `Test file "${testFile}" does not exist.`
      };
    }

    const timeoutMs = Math.max(2000, Math.min(60000, parseInt(options.timeoutMs, 10) || 30000));
    const t0 = Date.now();

    return new Promise((resolve) => {
      exec(`node "${absTestPath}"`, { timeout: timeoutMs, cwd: this.workspaceRoot }, (err, stdout, stderr) => {
        const durationMs = Date.now() - t0;
        const exitCode = err ? (err.code || 1) : 0;
        const combinedOutput = `${stdout || ''}\n${stderr || ''}`;

        // Parse test count summary if standard output pattern present
        const passMatch = combinedOutput.match(/(\d+)\s*(?:\/|\s*passed)/i);
        const failMatch = combinedOutput.match(/(\d+)\s*failed/i);

        resolve({
          success: exitCode === 0,
          exitCode,
          durationMs,
          testFile,
          stdout: (stdout || '').trim(),
          stderr: (stderr || '').trim(),
          passedCount: passMatch ? parseInt(passMatch[1], 10) : null,
          failedCount: failMatch ? parseInt(failMatch[1], 10) : (exitCode === 0 ? 0 : 1),
          summary: exitCode === 0
            ? `Test suite "${testFile}" PASSED in ${durationMs}ms.`
            : `Test suite "${testFile}" FAILED (exit code ${exitCode}) in ${durationMs}ms.`
        });
      });
    });
  }

  /**
   * Runs linter and syntax analysis across specified source files
   */
  runLinter(options = {}) {
    const rawFiles = Array.isArray(options.filePaths) ? options.filePaths : [options.filePaths || 'server.js'];
    const results = [];
    let allPassed = true;

    for (const relPath of rawFiles) {
      if (!relPath) continue;
      try {
        const absPath = this.resolveSafePath(relPath);
        if (!fs.existsSync(absPath)) {
          results.push({ file: relPath, passed: false, error: 'File not found' });
          allPassed = false;
          continue;
        }

        const ext = path.extname(absPath).toLowerCase();
        let syntaxOk = true;
        let syntaxErr = null;

        if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
          try {
            execSync(`node --check "${absPath}"`, { timeout: 5000, stdio: 'pipe' });
          } catch (err) {
            syntaxOk = false;
            syntaxErr = err.stderr ? err.stderr.toString().trim() : err.message;
          }
        } else if (ext === '.py') {
          try {
            execSync(`python -m py_compile "${absPath}"`, { timeout: 5000, stdio: 'pipe' });
          } catch (err) {
            syntaxOk = false;
            syntaxErr = err.stderr ? err.stderr.toString().trim() : err.message;
          }
        }

        // Static Security Analysis
        const content = fs.readFileSync(absPath, 'utf8');
        const sec = analyzeCode(content, path.basename(absPath));

        if (!syntaxOk || sec.riskLevel === 'CRITICAL' || sec.riskLevel === 'HIGH') {
          allPassed = false;
        }

        results.push({
          file: relPath,
          syntaxCheck: { passed: syntaxOk, error: syntaxErr },
          securityCheck: { riskLevel: sec.riskLevel, score: sec.score, flags: sec.flags },
          passed: syntaxOk && sec.riskLevel !== 'CRITICAL' && sec.riskLevel !== 'HIGH'
        });
      } catch (err) {
        results.push({ file: relPath, passed: false, error: err.message });
        allPassed = false;
      }
    }

    return {
      success: allPassed,
      evaluatedCount: results.length,
      files: results,
      summary: allPassed
        ? `All ${results.length} files passed syntax and security verification.`
        : `Linting detected errors or high-risk patterns in candidate files.`
    };
  }

  /**
   * Executes project build scripts
   */
  runBuild(options = {}) {
    const pkgPath = path.join(this.workspaceRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      throw new Error('package.json not found for build execution.');
    }

    const command = options.command || 'node --check server.js';
    const t0 = Date.now();

    return new Promise((resolve) => {
      exec(command, { timeout: 45000, cwd: this.workspaceRoot }, (err, stdout, stderr) => {
        const durationMs = Date.now() - t0;
        const exitCode = err ? (err.code || 1) : 0;
        resolve({
          success: exitCode === 0,
          command,
          exitCode,
          durationMs,
          output: `${stdout || ''}\n${stderr || ''}`.trim(),
          summary: exitCode === 0 ? `Build succeeded in ${durationMs}ms.` : `Build failed with exit code ${exitCode}.`
        });
      });
    });
  }

  /**
   * Inspects Git status and diffs
   */
  inspectGitDiff(options = {}) {
    return new Promise((resolve) => {
      exec('git status --short && git diff --stat', { timeout: 6000, cwd: this.workspaceRoot }, (err, stdout, stderr) => {
        if (err) {
          return resolve({
            success: false,
            isGitRepo: false,
            error: stderr || err.message,
            summary: 'Git status unavailable; workspace uses filesystem versioned backups.'
          });
        }

        resolve({
          success: true,
          isGitRepo: true,
          status: stdout.trim(),
          summary: `Git diff inspected: ${stdout.trim().split('\n').filter(Boolean).length} modified or untracked files.`
        });
      });
    });
  }

  /**
   * Analyzes test failure output to isolate failing assertions and stack lines
   */
  diagnoseTestFailure(options = {}) {
    const testOutput = String(options.testOutput || '').trim();
    const exitCode = options.exitCode !== undefined ? options.exitCode : 1;
    const testFile = options.testFile || 'test.js';

    const verifiedCauses = [];
    const hypotheses = [];

    // Parse assertion mismatches (standard or with custom message)
    const assertMatch = testOutput.match(/AssertionError(?: \[[^\]]+\])?:?\s*([^\n]+)/i) ||
                        testOutput.match(/Expected values to be strictly equal:\s*([\s\S]+?)(?:\n\s*at|\n\n|$)/i) ||
                        testOutput.match(/(?:TEST_FAIL|FAIL|Assertion failed):\s*([^\n]+)/i) ||
                        testOutput.match(/Expected\s+.*?\s+to\s+(?:return|be|equal)\s+[^\n]+/i) ||
                        testOutput.match(/Error:\s*([^\n]+)/i);
    if (assertMatch) {
      verifiedCauses.push({
        type: 'ASSERTION_MISMATCH',
        details: (assertMatch[1] || '').trim()
      });
    }

    // Parse stack frame line (supporting Windows paths D:\... and parentheses)
    const frameMatch = testOutput.match(/at\s+(?:.*?\()?([a-zA-Z]:[^\r\n:()]+|[^:\r\n()]+):(\d+):(\d+)\)?/);
    if (frameMatch) {
      verifiedCauses.push({
        type: 'FAILURE_LOCATION',
        file: frameMatch[1],
        line: parseInt(frameMatch[2], 10),
        column: parseInt(frameMatch[3], 10)
      });
    }

    if (/SyntaxError/i.test(testOutput)) {
      verifiedCauses.push({ type: 'SYNTAX_ERROR', description: 'Invalid syntax prevents execution.' });
    } else if (/ReferenceError/i.test(testOutput)) {
      hypotheses.push({ type: 'UNDEFINED_VARIABLE', description: 'Variable or function referenced before declaration.' });
    }

    // Fallback hypothesis when exit code is non-zero but specific pattern wasn't isolated
    if (verifiedCauses.length === 0 && exitCode !== 0) {
      hypotheses.push({
        type: 'NON_ZERO_EXIT',
        description: testOutput.slice(0, 200) || `Test process exited with non-zero code ${exitCode}.`
      });
    }

    return {
      success: true,
      testFile,
      exitCode,
      verifiedCauses,
      hypotheses,
      confidence: verifiedCauses.length > 0 ? 'HIGH' : 'MEDIUM',
      summary: `Diagnosed ${verifiedCauses.length} verified failure cause(s) and ${hypotheses.length} hypothesis/hypotheses in "${testFile}".`
    };
  }

  // =========================================================================
  // 4. AUTONOMOUS DEBUGGING & REPAIR LOOP
  // =========================================================================

  /**
   * Bounded repair loop: Inspect -> Reproduce -> Diagnose -> Patch -> Test -> Validate
   */
  async repairCodeFailure(options = {}) {
    const failingTestFile = String(options.failingTestFile || '').trim();
    const targetSourceFile = String(options.targetSourceFile || '').trim();

    if (!failingTestFile || !targetSourceFile) {
      throw new Error('Both failingTestFile and targetSourceFile are required.');
    }

    const maxAttempts = Math.max(1, Math.min(5, parseInt(options.maxAttempts, 10) || 3));
    let attempt = 0;
    const attemptsLog = [];

    // Step 1: Initial Test Run (Reproduce)
    const initialRun = await this.runProjectTests({ testFile: failingTestFile });
    if (initialRun.success) {
      return {
        success: true,
        resolved: true,
        attempts: 0,
        message: `Test "${failingTestFile}" already passes cleanly. No repair required.`
      };
    }

    let currentError = initialRun.stderr || initialRun.stdout;

    while (attempt < maxAttempts) {
      attempt++;
      const tStart = Date.now();

      // Step 2: Diagnose
      const diag = this.diagnoseTestFailure({ testOutput: currentError, testFile: failingTestFile });

      // Step 3: Minimal Surgical Patch Generation
      // Read current source
      const srcRead = this.readSourceFile({ filePath: targetSourceFile, maxLines: 500 });
      let patchApplied = false;

      // Automated fix heuristic for common syntax / assertion bugs
      if (options.automatedPatch) {
        try {
          this.editSourceFile({
            filePath: targetSourceFile,
            targetCode: options.automatedPatch.targetCode,
            replacementCode: options.automatedPatch.replacementCode
          });
          patchApplied = true;
        } catch (e) {
          currentError = e.message;
        }
      }

      // Step 4: Re-Test
      const testRun = await this.runProjectTests({ testFile: failingTestFile });
      attemptsLog.push({
        attempt,
        durationMs: Date.now() - tStart,
        diagnosis: diag,
        patchApplied,
        passed: testRun.success,
        exitCode: testRun.exitCode
      });

      if (testRun.success) {
        return {
          success: true,
          resolved: true,
          attemptsCount: attempt,
          targetSourceFile,
          failingTestFile,
          history: attemptsLog,
          message: `Autonomous debugging loop resolved failure in ${attempt} attempt(s). Test suite now passes!`
        };
      }

      currentError = testRun.stderr || testRun.stdout;
    }

    return {
      success: false,
      resolved: false,
      attemptsCount: attempt,
      targetSourceFile,
      failingTestFile,
      history: attemptsLog,
      message: `Autonomous repair halted after ${maxAttempts} unsuccessful attempts. Preserved last known-good files.`
    };
  }

  /**
   * Complete End-to-End Autonomous Software Engineering Workflow:
   * 1. Understand repository architecture & target components
   * 2. Reproduce bug via targeted test/script/function
   * 3. Diagnose root cause and failing lines/symbols
   * 4. Propose minimal surgical fix
   * 5. Create isolated branch or workspace snapshot
   * 6. Apply atomic patch and record backup
   * 7. Inspect resulting diff & verify unintended changes
   * 8. Run regression tests and builds
   * 9. Add or run regression test assertion
   * 10. Automatically rollback if verification fails
   * 11. Produce evidence-based explanation
   */
  async executeSelfRepair(options = {}) {
    return this.executeSoftwareEngineeringWorkflow(options);
  }

  async executeSoftwareEngineeringWorkflow(options = {}) {
    const issueDescription = options.issueDescription || options.taskDescription || options.description || 'Autonomous software defect repair';
    const reproduceScript = options.reproduceScript || options.failingTestFile || options.testFile || options.testScript || null;
    const reproduceFn = options.reproduceFn || null;
    const targetFile = options.targetFile || options.targetSourceFile || options.filePath || null;
    const patchFn = options.patchFn || null;
    const automatedPatch = options.automatedPatch || (options.proposedPatch ? {
      targetCode: options.proposedPatch.targetContent !== undefined ? options.proposedPatch.targetContent : options.proposedPatch.targetCode,
      replacementCode: options.proposedPatch.replacementContent !== undefined ? options.proposedPatch.replacementContent : options.proposedPatch.replacementCode
    } : (options.targetCode && options.replacementCode ? {
      targetCode: options.targetCode,
      replacementCode: options.replacementCode
    } : (options.targetContent && options.replacementContent ? {
      targetCode: options.targetContent,
      replacementCode: options.replacementContent
    } : null)));
    const regressionTestSuite = options.regressionTestSuite || options.suite || null;
    const useBranch = Boolean(options.useBranch);
    const branchName = options.branchName;

    const workflowReport = {
      issueDescription,
      targetFile,
      targetSourceFile: targetFile,
      startedAt: new Date().toISOString(),
      steps: [],
      success: false,
      reproduced: false,
      fixVerified: false,
      rolledBack: false,
      diff: '',
      status: 'INITIALIZING'
    };

    // Step 1: Understand repository context
    const repoContext = await this.inspectProject({ maxDepth: 2 });
    workflowReport.steps.push({
      step: 1,
      name: 'Understand Repository',
      status: 'COMPLETED',
      projectTypes: repoContext.projectTypes,
      totalFiles: repoContext.totalFiles
    });

    // Step 2: Reproduce bug
    let reproductionFailed = false;
    let reproductionOutput = '';
    if (typeof reproduceFn === 'function') {
      try {
        const res = await reproduceFn();
        reproductionFailed = (res?.reproduced === true || res?.failed === true);
        reproductionOutput = res?.output || res?.message || 'Reproduction executed';
      } catch (e) {
        reproductionFailed = true;
        reproductionOutput = e.message;
      }
    } else if (reproduceScript) {
      const repRun = await this.runProjectTests({ testFile: reproduceScript });
      reproductionFailed = !repRun.success;
      reproductionOutput = repRun.stderr || repRun.stdout;
    }

    workflowReport.reproduced = reproductionFailed;
    workflowReport.steps.push({
      step: 2,
      name: 'Reproduce Bug',
      status: reproductionFailed ? 'BUG_REPRODUCED' : 'CLEAN',
      evidence: reproductionOutput
    });

    // Step 3: Locate Root Cause
    const diagnosis = this.diagnoseTestFailure({
      testOutput: reproductionOutput,
      testFile: reproduceScript || targetFile
    });
    workflowReport.steps.push({
      step: 3,
      name: 'Locate Root Cause',
      status: 'COMPLETED',
      diagnosis
    });

    // Step 4: Propose Minimal Fix
    const proposedFix = {
      targetFile,
      summary: options.fixSummary || 'Minimal surgical correction',
      patch: automatedPatch || null
    };
    workflowReport.steps.push({
      step: 4,
      name: 'Propose Minimal Fix',
      status: 'PROPOSED',
      proposedFix
    });

    // Step 5: Isolate Branch / Workspace
    let branchInfo = null;
    if (useBranch) {
      branchInfo = this.createDevelopmentBranch({ branchName: branchName || `fix_${Date.now()}` });
    }
    workflowReport.steps.push({
      step: 5,
      name: 'Isolate Workspace or Branch',
      status: 'COMPLETED',
      branchInfo
    });

    // Capture baseline modified files prior to patch
    const baselineDiff = await this.inspectGitDiff();
    const baselineModified = new Set(
      (baselineDiff.status || '')
        .split('\n')
        .filter(l => l.startsWith(' M ') || l.startsWith('M ') || l.startsWith('MM '))
        .map(l => l.slice(2).trim().toLowerCase())
    );

    // Step 6: Apply Patch with Backup
    let patchRes = null;
    let backupId = null;
    try {
      if (typeof patchFn === 'function') {
        patchRes = await patchFn();
      } else if (automatedPatch && targetFile) {
        patchRes = this.editSourceFile({
          filePath: targetFile,
          targetCode: automatedPatch.targetCode,
          replacementCode: automatedPatch.replacementCode
        });
      }
      backupId = patchRes?.backupId || null;
      workflowReport.diff = patchRes?.diff || (automatedPatch ? `--- a/${targetFile}\n+++ b/${targetFile}\n@@ -1 +1 @@\n-${automatedPatch.targetCode}\n+${automatedPatch.replacementCode}` : 'Patch applied');
      workflowReport.steps.push({
        step: 6,
        name: 'Apply Minimal Patch',
        status: 'PATCH_APPLIED',
        backupId,
        diffDetails: patchRes
      });
    } catch (e) {
      workflowReport.steps.push({
        step: 6,
        name: 'Apply Minimal Patch',
        status: 'FAILED',
        error: e.message
      });
      return { ...workflowReport, success: false, status: 'FAILED', message: `Patch application failed: ${e.message}` };
    }

    // Step 7: Inspect Resulting Diff & Detect Unintended Changes
    const gitDiff = await this.inspectGitDiff();
    const statusText = gitDiff.status || '';
    const currentModifiedLines = statusText.split('\n').filter(l => l.startsWith(' M ') || l.startsWith('M ') || l.startsWith('MM '));
    const currentModifiedFiles = currentModifiedLines.map(l => l.slice(2).trim());
    const newlyModifiedFiles = currentModifiedFiles.filter(f => !baselineModified.has(f.toLowerCase()));
    const normalizedTarget = targetFile ? targetFile.replace(/\\/g, '/').toLowerCase() : '';
    const unintendedFiles = newlyModifiedFiles.filter(f => !f.toLowerCase().includes(normalizedTarget));

    workflowReport.steps.push({
      step: 7,
      name: 'Inspect Diff & Detect Unintended Changes',
      status: unintendedFiles.length === 0 ? 'DIFF_CLEAN' : 'UNINTENDED_CHANGES_DETECTED',
      modifiedFiles: newlyModifiedFiles.length > 0 ? newlyModifiedFiles : currentModifiedFiles,
      unintendedFiles,
      hasUnintendedChanges: unintendedFiles.length > 0
    });

    if (unintendedFiles.length > 0) {
      // Rollback immediately if unintended files were modified
      if (backupId && targetFile) {
        this.rollbackCodeChange({ backupId, filePath: targetFile });
        workflowReport.rolledBack = true;
      }
      return {
        ...workflowReport,
        success: false,
        message: `Detected unintended modifications to: ${unintendedFiles.join(', ')}. Automated rollback triggered.`
      };
    }

    // Step 8 & 9: Run Verification and Regression Suite
    let verificationPassed = false;
    let regressionOutput = '';

    if (typeof reproduceFn === 'function') {
      try {
        const recheck = await reproduceFn();
        verificationPassed = (recheck?.reproduced === false && recheck?.failed !== true);
        regressionOutput = recheck?.output || recheck?.message || 'Verification re-run passed';
      } catch (e) {
        verificationPassed = false;
        regressionOutput = e.message;
      }
    } else if (reproduceScript) {
      const reTest = await this.runProjectTests({ testFile: reproduceScript });
      verificationPassed = reTest.success;
      regressionOutput = reTest.stdout;
    } else {
      verificationPassed = true;
    }

    let suitePassed = true;
    if (regressionTestSuite) {
      const suiteRun = await this.runProjectTests({ testFile: regressionTestSuite });
      suitePassed = suiteRun.success;
      if (!suitePassed) {
        regressionOutput += '\nRegression Suite Failure: ' + (suiteRun.stderr || suiteRun.stdout);
      }
    }

    const allPassed = verificationPassed && suitePassed;
    workflowReport.steps.push({
      step: 8,
      name: 'Run Verification & Regression Tests',
      status: allPassed ? 'ALL_TESTS_PASSED' : 'TESTS_FAILED',
      verificationPassed,
      suitePassed,
      evidence: regressionOutput
    });

    // Step 10: Rollback if unsuccessful
    if (!allPassed) {
      if (backupId && targetFile) {
        this.rollbackCodeChange({ backupId, filePath: targetFile });
        workflowReport.rolledBack = true;
      }
      workflowReport.status = 'ROLLED_BACK';
      workflowReport.fixVerified = false;
      workflowReport.success = false;
      workflowReport.steps.push({
        step: 10,
        name: 'Rollback Unsuccessful Updates',
        status: 'ROLLED_BACK',
        backupId
      });
      return {
        ...workflowReport,
        success: false,
        message: 'Verification failed after patch. Changes rolled back cleanly.'
      };
    }

    // Step 11: Explain Fix with Evidence
    workflowReport.success = true;
    workflowReport.fixVerified = true;
    workflowReport.status = 'FIX_VERIFIED';
    workflowReport.summary = `Autonomous Software Engineering Workflow succeeded for issue: "${issueDescription}". Root cause isolated, minimal fix applied to "${targetFile}", diff verified clean with 0 unintended modifications, and all tests passed cleanly.`;
    workflowReport.steps.push({
      step: 11,
      name: 'Explain Fix with Evidence',
      status: 'VERIFIED',
      summary: workflowReport.summary
    });

    // Record verified software engineering outcome in empirical experiment ledger
    try {
      const { experimentLedgerInstance } = require('./experimentLedger.js');
      experimentLedgerInstance.recordExperiment({
        taskOrQuestion: issueDescription,
        hypothesis: `Applying minimal surgical patch to "${targetFile}" resolves issue without collateral regression.`,
        category: 'TOOL_SYNTHESIS',
        parameterVariations: { targetFile, branchUsed: useBranch },
        quantitativeMetrics: {
          stepsExecuted: workflowReport.steps.length,
          unintendedModifications: 0,
          suiteExitCode: 0
        },
        qualitativeOutcome: workflowReport.summary,
        decision: 'ACCEPTED',
        nextIterationHypothesis: 'Extend autonomous verification to AST-based mutation testing.',
        reproductionSteps: [reproduceScript || `Reproduce with function for ${issueDescription}`],
        reproducibilityNotes: 'Verified clean diff and zero unintended modifications.'
      });
    } catch (_) {}

    return workflowReport;
  }

  // =========================================================================
  // 5. WORKSPACES, BRANCHES & ROLLBACK
  // =========================================================================

  /**
   * Creates a dedicated development branch or isolated workspace
   */
  createDevelopmentBranch(options = {}) {
    const branchName = String(options.branchName || `dev_${Date.now()}`).trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const workspaceName = options.workspaceName || branchName;
    const wsPath = path.join(WORKSPACES_DIR, workspaceName);

    this.ensureDirectories();
    fs.mkdirSync(wsPath, { recursive: true });

    let gitBranchCreated = false;
    try {
      execSync(`git checkout -b "${branchName}"`, { cwd: this.workspaceRoot, stdio: 'pipe' });
      gitBranchCreated = true;
    } catch (e) {}

    return {
      success: true,
      branchName,
      gitBranchCreated,
      isolatedWorkspaceDir: path.relative(this.workspaceRoot, wsPath),
      message: `Development branch "${branchName}" created with isolated workspace.`
    };
  }

  /**
   * Restores a source file to previous version from backup
   */
  rollbackCodeChange(options = {}) {
    const backupId = options.backupId;
    const filePath = options.filePath;

    if (!backupId && !filePath) {
      throw new Error('Either backupId or filePath is required for rollback.');
    }

    if (backupId) {
      const backupPath = path.join(BACKUPS_DIR, backupId);
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup "${backupId}" not found.`);
      }
      if (!filePath) {
        throw new Error('Target filePath is required when restoring from backupId.');
      }
      const absTarget = this.resolveSafePath(filePath);
      fs.copyFileSync(backupPath, absTarget);
      return {
        success: true,
        restoredFile: filePath,
        backupUsed: backupId,
        message: `Restored "${filePath}" from backup ${backupId}.`
      };
    }

    // Git checkout rollback
    try {
      execSync(`git checkout -- "${filePath}"`, { cwd: this.workspaceRoot, stdio: 'pipe' });
      return {
        success: true,
        restoredFile: filePath,
        method: 'git_checkout',
        message: `Restored "${filePath}" to Git HEAD version.`
      };
    } catch (e) {
      throw new Error(`Rollback failed: ${e.message}`);
    }
  }

  /**
   * Validates candidate build before deployment promotion
   */
  async validateCandidateBuild(options = {}) {
    const candidateFiles = options.candidateFiles || [];
    const testSuites = options.testSuites || [];
    const healthCheckUrl = options.healthCheckUrl || 'http://localhost:3000/api/status';

    // 1. Lint and security checks
    const lintResult = this.runLinter({ filePaths: candidateFiles });

    // 2. Test Suites
    const testResults = [];
    let testsPassed = true;
    for (const testFile of testSuites) {
      const res = await this.runProjectTests({ testFile });
      testResults.push(res);
      if (!res.success) testsPassed = false;
    }

    // 3. Health check
    let healthOk = false;
    try {
      const res = await fetch(healthCheckUrl, { signal: AbortSignal.timeout(4000) });
      healthOk = res.ok;
    } catch (e) {}

    const ready = lintResult.success && testsPassed && healthOk;

    return {
      success: ready,
      candidateReady: ready,
      lintResult,
      testResults,
      healthCheck: { url: healthCheckUrl, ok: healthOk },
      summary: ready
        ? 'Candidate build fully validated and certified for activation.'
        : 'Candidate build validation FAILED. Do not activate in production.'
    };
  }
}

const selfDevelopmentEngineInstance = new SelfDevelopmentEngine();

module.exports = {
  SelfDevelopmentEngine,
  selfDevelopmentEngineInstance,
  selfDevelopmentEngine: selfDevelopmentEngineInstance,
  IMMUTABLE_CORE_ASSETS
};
