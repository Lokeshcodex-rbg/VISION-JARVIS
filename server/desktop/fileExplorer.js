/**
 * VISION AI — Windows File Explorer & User Storage Manager
 * Safely navigates user folders (Downloads, Documents, Desktop, Workspace),
 * opens files via registered Windows shell associations, searches permitted directories,
 * and reads user documents with strict boundary validation.
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { WORKSPACE_ROOT } = require('../securityPermissions.js');

// Standard Permitted User Directories
const PERMITTED_USER_DIRECTORIES = {
  downloads: path.join(os.homedir(), 'Downloads'),
  documents: path.join(os.homedir(), 'Documents'),
  desktop: path.join(os.homedir(), 'Desktop'),
  pictures: path.join(os.homedir(), 'Pictures'),
  videos: path.join(os.homedir(), 'Videos'),
  workspace: WORKSPACE_ROOT,
  project: WORKSPACE_ROOT
};

// Forbidden sensitive paths strictly excluded from search & reading
const FORBIDDEN_PATHS = [
  'c:\\windows',
  'c:\\program files',
  'c:\\program files (x86)',
  'appdata\\local\\google\\chrome\\user data',
  'appdata\\roaming\\mozilla\\firefox',
  '.ssh',
  '.aws',
  '.azure',
  'sam',
  'security',
  'system32'
];

const STORAGE_CONFIG_FILE = path.join(WORKSPACE_ROOT, 'data', 'authorized_storage.json');

class WindowsFileExplorer {
  constructor() {
    this.permittedDirs = PERMITTED_USER_DIRECTORIES;
    this.workspaceRoot = WORKSPACE_ROOT;
    this.authorizedRoots = [
      'D:\\',
      os.homedir(),
      WORKSPACE_ROOT
    ];
    this.loadAuthorizedStorage();
  }

  loadAuthorizedStorage() {
    try {
      if (fs.existsSync(STORAGE_CONFIG_FILE)) {
        const raw = fs.readFileSync(STORAGE_CONFIG_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.authorizedRoots) && data.authorizedRoots.length > 0) {
          this.authorizedRoots = Array.from(new Set([...this.authorizedRoots, ...data.authorizedRoots]));
        }
      }
    } catch (_) {}
  }

  saveAuthorizedStorage() {
    try {
      const dir = path.dirname(STORAGE_CONFIG_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STORAGE_CONFIG_FILE, JSON.stringify({
        authorizedRoots: this.authorizedRoots,
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch (_) {}
  }

  addAuthorizedLocation(dirPath) {
    if (!dirPath || typeof dirPath !== 'string') throw new Error('Directory path is required.');
    const resolved = path.resolve(dirPath);
    if (!this.authorizedRoots.includes(resolved)) {
      this.authorizedRoots.push(resolved);
      this.saveAuthorizedStorage();
    }
    return {
      success: true,
      authorizedRoots: this.authorizedRoots,
      summary: `Authorized location "${resolved}" added to JARVIS storage registry.`
    };
  }

  revokeAuthorizedLocation(dirPath) {
    const resolved = path.resolve(dirPath);
    this.authorizedRoots = this.authorizedRoots.filter(r => path.resolve(r).toLowerCase() !== resolved.toLowerCase());
    this.saveAuthorizedStorage();
    return {
      success: true,
      authorizedRoots: this.authorizedRoots,
      summary: `Authorized location "${resolved}" revoked.`
    };
  }

  listAuthorizedLocations() {
    return {
      authorizedRoots: [...this.authorizedRoots],
      forbiddenPaths: [...FORBIDDEN_PATHS]
    };
  }

  /**
   * Resolves a folder name or user alias to an authorized directory path
   */
  resolveUserFolder(folderName) {
    if (!folderName || typeof folderName !== 'string') return null;
    const clean = folderName.toLowerCase().trim();

    if (this.permittedDirs[clean]) {
      return this.permittedDirs[clean];
    }

    for (const [key, dirPath] of Object.entries(this.permittedDirs)) {
      if (clean.includes(key) || key.includes(clean)) {
        return dirPath;
      }
    }

    return null;
  }

  /**
   * Validates if a target path is safe and permitted
   */
  isPathPermitted(targetPath) {
    if (!targetPath || typeof targetPath !== 'string') return false;
    const normalized = path.normalize(path.resolve(targetPath)).toLowerCase();

    // Check against forbidden system / credential directories
    for (const forbidden of FORBIDDEN_PATHS) {
      if (normalized.includes(forbidden)) {
        return false;
      }
    }

    // Must reside within authorized storage roots
    for (const root of this.authorizedRoots) {
      const normRoot = path.normalize(path.resolve(root)).toLowerCase();
      if (normalized.startsWith(normRoot)) {
        return true;
      }
    }

    const userHome = os.homedir().toLowerCase();
    const wsRoot = this.workspaceRoot.toLowerCase();

    return normalized.startsWith(userHome) || normalized.startsWith(wsRoot) || normalized.startsWith('d:\\');
  }

  /**
   * Opens a folder in Windows File Explorer
   */
  async openFolder(folderName, customPath = null) {
    let targetPath = null;

    if (customPath) {
      if (!this.isPathPermitted(customPath)) {
        return {
          status: 'rejected_unauthorized',
          path: customPath,
          summary: `Security Violation: Access to path "${customPath}" is restricted to protect your private system files, sir.`
        };
      }
      targetPath = path.resolve(customPath);
    } else {
      targetPath = this.resolveUserFolder(folderName);
      if (!targetPath && folderName) {
        const cleanQuery = String(folderName)
          .replace(/^(?:the|my)\s+/i, '')
          .replace(/\s+(?:folder|directory)$/i, '')
          .trim();
        if (cleanQuery) {
          const searchRes = await this.searchUserFiles(cleanQuery, {
            includeFolders: true,
            includeDriveD: true,
            maxResults: 10
          });
          const matchedDir = (searchRes.results || []).find(r => r.isDirectory);
          if (matchedDir && matchedDir.path) {
            targetPath = matchedDir.path;
          }
        }
      }
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      return {
        status: 'not_found',
        target: folderName || customPath,
        summary: `I could not locate the folder "${folderName || customPath}" on your computer, sir.`
      };
    }

    try {
      // Launch Windows File Explorer pointing at the target folder
      const proc = spawn('explorer.exe', [targetPath], { detached: true, stdio: 'ignore' });
      proc.unref();

      const folderBaseName = path.basename(targetPath);
      return {
        status: 'opened',
        folderPath: targetPath,
        folderName: folderBaseName,
        summary: `I have opened your ${folderBaseName} folder in File Explorer, sir.`
      };
    } catch (err) {
      return {
        status: 'error',
        error: err.message,
        summary: `Failed to open folder: ${err.message}`
      };
    }
  }

  /**
   * Opens a specific file using its registered Windows default application
   */
  async openFile(filePath) {
    if (!this.isPathPermitted(filePath)) {
      return {
        status: 'rejected_unauthorized',
        filePath,
        summary: `Security Violation: Access to "${filePath}" is restricted, sir.`
      };
    }

    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return {
        status: 'not_found',
        filePath,
        summary: `I could not locate the file "${path.basename(filePath)}" on your laptop, sir.`
      };
    }

    try {
      // Use Windows cmd start to launch with default handler
      exec(`start "" "${resolved}"`);
      return {
        status: 'opened',
        filePath: resolved,
        fileName: path.basename(resolved),
        summary: `Opening ${path.basename(resolved)} with its default application, sir.`
      };
    } catch (err) {
      return {
        status: 'error',
        error: err.message,
        summary: `Failed to open file: ${err.message}`
      };
    }
  }

  /**
   * Searches permitted user directories (and D:\ when allowed) for files or folders matching a query
   */
  async searchUserFiles(query, options = {}) {
    if (!query || typeof query !== 'string') {
      return { success: false, count: 0, results: [], summary: 'No search query specified, sir.' };
    }

    const cleanQuery = query.toLowerCase().trim();
    const maxResults = options.maxResults || 15;
    const includeFolders = options.includeFolders !== false;
    const isPermitted = (p) => this.isPathPermitted(p);

    let searchDirs;
    if (options.location && this.permittedDirs[options.location.toLowerCase()]) {
      searchDirs = [this.permittedDirs[options.location.toLowerCase()]];
    } else if (options.location && /^d:\\?$/i.test(options.location.trim())) {
      searchDirs = ['D:\\'];
    } else {
      searchDirs = [
        this.permittedDirs.downloads,
        this.permittedDirs.documents,
        this.permittedDirs.desktop,
        this.workspaceRoot,
        ...(options.includeDriveD !== false && fs.existsSync('D:\\') ? ['D:\\'] : [])
      ];
    }

    const results = [];
    const seen = new Set();
    const skipNames = new Set(['node_modules', '$recycle.bin', 'system volume information', 'windows', 'program files', 'program files (x86)', '.git', '__pycache__', '.venv']);
    const startTime = Date.now();
    const maxScanMs = options.timeoutMs || 5000;

    function searchDir(dir, depth = 0) {
      if (depth > 4 || results.length >= maxResults || (Date.now() - startTime) > maxScanMs) return;
      if (!isPermitted(dir)) return;
      try {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults || (Date.now() - startTime) > maxScanMs) break;
          const lowerName = entry.name.toLowerCase();
          if (entry.name.startsWith('.') || skipNames.has(lowerName)) continue;

          const fullPath = path.join(dir, entry.name);
          if (!isPermitted(fullPath)) continue;

          const nameMatches = lowerName.includes(cleanQuery);
          if (entry.isDirectory()) {
            if (includeFolders && nameMatches && !seen.has(fullPath.toLowerCase())) {
              seen.add(fullPath.toLowerCase());
              try {
                const stat = fs.statSync(fullPath);
                results.push({
                  name: entry.name,
                  path: fullPath,
                  isDirectory: true,
                  extension: 'DIR',
                  sizeBytes: 0,
                  sizeKB: 0,
                  mtimeMs: stat.mtimeMs,
                  modified: stat.mtime.toISOString()
                });
              } catch (_) {}
            }
            searchDir(fullPath, depth + 1);
          } else if (nameMatches && !seen.has(fullPath.toLowerCase())) {
            seen.add(fullPath.toLowerCase());
            try {
              const stat = fs.statSync(fullPath);
              results.push({
                name: entry.name,
                path: fullPath,
                isDirectory: false,
                extension: path.extname(entry.name).toLowerCase(),
                sizeBytes: stat.size,
                sizeKB: Math.round(stat.size / 1024),
                mtimeMs: stat.mtimeMs,
                modified: stat.mtime.toISOString()
              });
            } catch (e) {
              results.push({ name: entry.name, path: fullPath, isDirectory: false });
            }
          }
        }
      } catch (e) {
        // Inaccessible directory skipped
      }
    }

    for (const baseDir of searchDirs) {
      if (results.length >= maxResults || (Date.now() - startTime) > maxScanMs) break;
      searchDir(baseDir, 0);
    }

    results.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));

    if (results.length === 0) {
      return {
        success: true,
        query,
        count: 0,
        results: [],
        summary: `I searched your Downloads, Documents, Desktop, project files, and D: drive, but found no files matching "${query}", sir.`
      };
    }

    const topNames = results.slice(0, 3).map(r => r.name).join(', ');
    return {
      success: true,
      verified: true,
      query,
      count: results.length,
      results,
      summary: `I found ${results.length} matching item${results.length === 1 ? '' : 's'} (${topNames}), sir.`
    };
  }

  /**
   * Finds the most recently modified files by category ('pdf', 'image', 'docx', 'any') across Downloads/Documents/Desktop/Workspace
   */
  async findLatestFiles({ fileType = 'any', folderName = null, extensions = null, limit = 5 } = {}) {
    const extMap = {
      pdf: ['.pdf'],
      image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'],
      docx: ['.docx', '.doc'],
      document: ['.pdf', '.docx', '.doc', '.txt', '.md']
    };
    const allowedExts = Array.isArray(extensions) && extensions.length > 0
      ? extensions.map(e => e.toLowerCase())
      : (extMap[String(fileType || 'any').toLowerCase()] || null);

    const searchDirs = folderName && this.permittedDirs[folderName.toLowerCase()]
      ? [this.permittedDirs[folderName.toLowerCase()]]
      : [
          this.permittedDirs.downloads,
          this.permittedDirs.documents,
          this.permittedDirs.desktop,
          ...(String(fileType).toLowerCase() === 'image' ? [this.permittedDirs.pictures] : []),
          this.workspaceRoot
        ];

    const candidates = [];
    const skip = new Set(['node_modules', '$recycle.bin', '.git', '__pycache__']);
    const walk = (dir, depth = 0) => {
      if (depth > 2 || !this.isPathPermitted(dir) || !fs.existsSync(dir)) return;
      try {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          if (ent.name.startsWith('.') || skip.has(ent.name.toLowerCase())) continue;
          const full = path.join(dir, ent.name);
          if (!this.isPathPermitted(full)) continue;
          if (ent.isDirectory()) {
            walk(full, depth + 1);
          } else if (ent.isFile()) {
            const ext = path.extname(ent.name).toLowerCase();
            if (!allowedExts || allowedExts.includes(ext)) {
              try {
                const st = fs.statSync(full);
                candidates.push({
                  name: ent.name,
                  path: full,
                  extension: ext,
                  sizeBytes: st.size,
                  sizeKB: Math.round(st.size / 1024),
                  mtimeMs: st.mtimeMs,
                  modified: st.mtime.toISOString()
                });
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    };

    for (const d of searchDirs) walk(d, 0);
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const top = candidates.slice(0, Math.max(1, limit));
    return {
      success: top.length > 0,
      verified: top.length > 0,
      fileType,
      count: top.length,
      latestFile: top[0] || null,
      files: top,
      summary: top.length > 0
        ? `Latest ${fileType} found: "${top[0].name}" at "${top[0].path}" (${top[0].sizeBytes} bytes, modified ${top[0].modified}).`
        : `No matching ${fileType} files found in your Downloads, Documents, Desktop, or workspace folders, sir.`
    };
  }

  /**
   * Reads and summarizes an authorized local PDF, DOCX, or text file with grounded metadata
   */
  async summarizeLocalDocument(filePath, options = {}) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('filePath is required.');
    }
    if (!this.isPathPermitted(filePath)) {
      throw new Error(`Security Violation: File path "${filePath}" is outside authorized user directories.`);
    }
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: "${filePath}".`);
    }
    const stat = fs.statSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const { documentIntelligenceEngineInstance } = require('../documentIntelligenceEngine.js');

    let fullText = '';
    let headings = [];
    let meta = {};

    if (ext === '.pdf') {
      const parsed = documentIntelligenceEngineInstance.parsePdfDocument(resolved, options);
      fullText = parsed.fullText || '';
      meta = { totalPages: parsed.totalPages, wordCount: parsed.wordCount, tablesCount: (parsed.detectedTables || []).length };
    } else if (ext === '.docx') {
      const parsed = documentIntelligenceEngineInstance.parseDocxDocument(resolved);
      fullText = parsed.fullText || '';
      headings = (parsed.headings || []).map(h => h.text);
      meta = { title: parsed.title, paragraphsCount: parsed.paragraphsCount, wordCount: parsed.wordCount, tablesCount: parsed.tablesCount };
    } else {
      fullText = fs.readFileSync(resolved, 'utf8');
      meta = { wordCount: fullText.split(/\s+/).filter(Boolean).length };
    }

    const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const excerpt = lines.slice(0, 12).join(' ').slice(0, options.maxChars || 1800);
    return {
      success: true,
      verified: true,
      filePath: resolved,
      fileName: path.basename(resolved),
      extension: ext,
      sizeBytes: stat.size,
      modified: stat.mtime.toISOString(),
      headings,
      ...meta,
      excerpt,
      summary: `Read "${path.basename(resolved)}" (${meta.wordCount || 0} words${meta.totalPages ? `, ${meta.totalPages} pages` : ''}). Summary excerpt: ${excerpt.slice(0, 420)}`
    };
  }

  /**
   * Safely reads text from an authorized user document or code file
   */
  async readTextFile(filePath, options = {}) {
    if (!this.isPathPermitted(filePath)) {
      throw new Error(`Security Violation: File path "${filePath}" is outside authorized user directories.`);
    }

    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: "${filePath}".`);
    }

    const stat = fs.statSync(resolved);
    const maxBytes = options.maxBytes || 50000;
    if (stat.size > 500000) {
      throw new Error(`File size (${Math.round(stat.size / 1024)} KB) exceeds maximum safe reading limit.`);
    }

    const content = fs.readFileSync(resolved, 'utf8');
    const truncated = content.length > maxBytes;
    const finalContent = truncated ? content.slice(0, maxBytes) + '\n... [TRUNCATED]' : content;

    return {
      success: true,
      filePath: resolved,
      fileName: path.basename(resolved),
      sizeKB: Math.round(stat.size / 1024),
      truncated,
      content: finalContent,
      summary: `Successfully read ${path.basename(resolved)} (${Math.round(stat.size / 1024)} KB).`
    };
  }

  /**
   * Creates a new document or source file within authorized directories and verifies written output
   */
  async createFile(filePath, content = '') {
    if (!this.isPathPermitted(filePath)) {
      throw new Error(`Security Violation: Target path "${filePath}" is outside authorized user directories.`);
    }

    const resolved = path.resolve(filePath);
    const parentDir = path.dirname(resolved);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(resolved, String(content), 'utf8');

    // Post-write verification
    if (!fs.existsSync(resolved)) {
      throw new Error(`Write Verification Failure: File "${filePath}" was not detected on disk after write.`);
    }

    const stat = fs.statSync(resolved);
    return {
      success: true,
      status: 'created',
      filePath: resolved,
      fileName: path.basename(resolved),
      sizeBytes: stat.size,
      summary: `I have successfully created "${path.basename(resolved)}" (${stat.size} bytes), sir.`
    };
  }

  /**
   * Edits an existing file with atomic backup and post-write verification
   */
  async editFile(filePath, content, options = {}) {
    if (!this.isPathPermitted(filePath)) {
      throw new Error(`Security Violation: Target path "${filePath}" is outside authorized user directories.`);
    }

    const resolved = path.resolve(filePath);
    let backupPath = null;

    if (fs.existsSync(resolved) && options.backup !== false) {
      backupPath = resolved + '.bak';
      fs.copyFileSync(resolved, backupPath);
    }

    if (options.append && fs.existsSync(resolved)) {
      fs.appendFileSync(resolved, String(content), 'utf8');
    } else {
      fs.writeFileSync(resolved, String(content), 'utf8');
    }

    // Post-write verification
    if (!fs.existsSync(resolved)) {
      throw new Error(`Verification Failure: File "${filePath}" missing after save.`);
    }

    const stat = fs.statSync(resolved);
    return {
      success: true,
      status: 'saved',
      filePath: resolved,
      fileName: path.basename(resolved),
      sizeBytes: stat.size,
      backupPath,
      summary: `I have updated and saved "${path.basename(resolved)}" (${stat.size} bytes)${backupPath ? ' with atomic backup' : ''}, sir.`
    };
  }

  /**
   * Renames or moves a file between permitted directories
   */
  async renameFile(oldPath, newPath) {
    if (!this.isPathPermitted(oldPath) || !this.isPathPermitted(newPath)) {
      throw new Error('Security Violation: Source or destination path is outside authorized user directories.');
    }

    const resolvedOld = path.resolve(oldPath);
    const resolvedNew = path.resolve(newPath);

    if (!fs.existsSync(resolvedOld)) {
      throw new Error(`Source file does not exist: "${oldPath}".`);
    }

    const destDir = path.dirname(resolvedNew);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.renameSync(resolvedOld, resolvedNew);

    return {
      success: true,
      status: 'renamed',
      oldPath: resolvedOld,
      newPath: resolvedNew,
      fileName: path.basename(resolvedNew),
      summary: `I have renamed "${path.basename(resolvedOld)}" to "${path.basename(resolvedNew)}", sir.`
    };
  }

  /**
   * Copies a file to a new destination within permitted directories
   */
  async copyFile(sourcePath, destPath) {
    if (!this.isPathPermitted(sourcePath) || !this.isPathPermitted(destPath)) {
      throw new Error('Security Violation: Source or destination path is outside authorized user directories.');
    }

    const resolvedSrc = path.resolve(sourcePath);
    const resolvedDest = path.resolve(destPath);

    if (!fs.existsSync(resolvedSrc)) {
      throw new Error(`Source file does not exist: "${sourcePath}".`);
    }

    const destDir = path.dirname(resolvedDest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(resolvedSrc, resolvedDest);

    return {
      success: true,
      status: 'copied',
      sourcePath: resolvedSrc,
      destPath: resolvedDest,
      summary: `I have copied "${path.basename(resolvedSrc)}" to "${path.basename(resolvedDest)}", sir.`
    };
  }

  /**
   * Deletes a file with safety backup
   */
  async deleteFile(filePath, options = {}) {
    if (!this.isPathPermitted(filePath)) {
      throw new Error(`Security Violation: File path "${filePath}" is outside authorized user directories.`);
    }

    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File does not exist: "${filePath}".`);
    }

    let backupPath = null;
    if (!options.permanent) {
      const trashDir = path.join(os.tmpdir(), 'stark_ai_trash');
      if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });
      backupPath = path.join(trashDir, `${Date.now()}_${path.basename(resolved)}`);
      fs.copyFileSync(resolved, backupPath);
    }

    fs.unlinkSync(resolved);

    return {
      success: true,
      status: 'deleted',
      filePath: resolved,
      backupPath,
      summary: `I have removed "${path.basename(resolved)}"${backupPath ? ' (recoverable from backup)' : ''}, sir.`
    };
  }

  /**
   * Creates a directory tree in authorized storage and verifies disk existence
   */
  async createFolder(folderPath) {
    if (!this.isPathPermitted(folderPath)) {
      throw new Error(`Security Violation: Target path "${folderPath}" is outside authorized storage locations.`);
    }

    const resolved = path.resolve(folderPath);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }

    if (!fs.existsSync(resolved)) {
      throw new Error(`Folder creation failure: "${resolved}" could not be confirmed on disk.`);
    }

    return {
      success: true,
      folderPath: resolved,
      folderName: path.basename(resolved),
      summary: `I have created the folder "${path.basename(resolved)}" at "${resolved}", sir.`
    };
  }

  /**
   * Lists directory contents with item metadata (size, type, modified time)
   */
  async listDirectory(dirPath, options = {}) {
    if (!this.isPathPermitted(dirPath)) {
      throw new Error(`Security Violation: Path "${dirPath}" is outside authorized storage locations.`);
    }

    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Directory not found: "${dirPath}".`);
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      throw new Error(`Path is a file, not a directory: "${dirPath}".`);
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') && !options.includeHidden) continue;
      const full = path.join(resolved, entry.name);
      try {
        const itemStat = fs.statSync(full);
        items.push({
          name: entry.name,
          path: full,
          isDirectory: entry.isDirectory(),
          sizeBytes: itemStat.size,
          sizeFormatted: entry.isDirectory() ? '--' : `${Math.round(itemStat.size / 1024)} KB`,
          extension: entry.isDirectory() ? 'DIR' : path.extname(entry.name).toLowerCase(),
          modified: itemStat.mtime.toISOString()
        });
      } catch (_) {
        items.push({ name: entry.name, path: full, isDirectory: entry.isDirectory() });
      }
    }

    return {
      success: true,
      directory: resolved,
      count: items.length,
      items,
      summary: `Directory "${path.basename(resolved)}" contains ${items.length} item${items.length === 1 ? '' : 's'}, sir.`
    };
  }

  /**
   * Finds duplicate files in a folder by size and SHA-256 hash comparison
   */
  async findDuplicateFiles(dirPath, options = {}) {
    if (!this.isPathPermitted(dirPath)) {
      throw new Error(`Security Violation: Path "${dirPath}" is outside authorized storage locations.`);
    }

    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Directory does not exist: "${dirPath}".`);
    }

    const maxFiles = options.maxFiles || 500;
    const fileList = [];

    const scan = (current) => {
      if (fileList.length >= maxFiles) return;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === '$Recycle.Bin') continue;
          const full = path.join(current, ent.name);
          if (ent.isDirectory()) {
            scan(full);
          } else if (ent.isFile()) {
            try {
              const stat = fs.statSync(full);
              fileList.push({ path: full, name: ent.name, size: stat.size });
            } catch (_) {}
          }
        }
      } catch (_) {}
    };

    scan(resolved);

    // Group by size first
    const bySize = new Map();
    for (const f of fileList) {
      if (!bySize.has(f.size)) bySize.set(f.size, []);
      bySize.get(f.size).push(f);
    }

    const crypto = require('crypto');
    const duplicates = [];

    for (const [size, files] of bySize.entries()) {
      if (files.length > 1 && size > 0) {
        const byHash = new Map();
        for (const f of files) {
          try {
            const buf = fs.readFileSync(f.path);
            const hash = crypto.createHash('sha256').update(buf).digest('hex');
            if (!byHash.has(hash)) byHash.set(hash, []);
            byHash.get(hash).push(f);
          } catch (_) {}
        }
        for (const [hash, matchingFiles] of byHash.entries()) {
          if (matchingFiles.length > 1) {
            duplicates.push({
              hash,
              sizeBytes: size,
              sizeKB: Math.round(size / 1024),
              count: matchingFiles.length,
              files: matchingFiles.map(m => m.path)
            });
          }
        }
      }
    }

    return {
      success: true,
      directory: resolved,
      scannedFiles: fileList.length,
      duplicateClusters: duplicates.length,
      duplicates,
      summary: duplicates.length > 0
        ? `Found ${duplicates.length} set${duplicates.length === 1 ? '' : 's'} of duplicate files in "${path.basename(resolved)}", sir.`
        : `No duplicate files detected in "${path.basename(resolved)}" across ${fileList.length} files scanned, sir.`
    };
  }

  /**
   * Organizes loose files in a directory by file type into dedicated subfolders
   */
  async organizeFilesByType(dirPath, options = {}) {
    if (!this.isPathPermitted(dirPath)) {
      throw new Error(`Security Violation: Path "${dirPath}" is outside authorized storage locations.`);
    }

    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Directory does not exist: "${dirPath}".`);
    }

    const CATEGORIES = {
      Documents: ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.xlsx', '.csv', '.pptx', '.md'],
      Images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],
      Code: ['.js', '.ts', '.py', '.json', '.html', '.css', '.c', '.cpp', '.java'],
      Audio: ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
      Archives: ['.zip', '.tar', '.gz', '.7z', '.rar']
    };

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const moves = [];

    for (const ent of entries) {
      if (ent.isFile() && !ent.name.startsWith('.')) {
        const ext = path.extname(ent.name).toLowerCase();
        let targetCategory = 'Others';
        for (const [cat, extensions] of Object.entries(CATEGORIES)) {
          if (extensions.includes(ext)) {
            targetCategory = cat;
            break;
          }
        }

        const targetFolder = path.join(resolved, targetCategory);
        if (!fs.existsSync(targetFolder)) {
          fs.mkdirSync(targetFolder, { recursive: true });
        }

        const src = path.join(resolved, ent.name);
        let dest = path.join(targetFolder, ent.name);
        if (fs.existsSync(dest) && dest !== src) {
          dest = path.join(targetFolder, `${path.parse(ent.name).name}_${Date.now()}${ext}`);
        }

        if (src !== dest) {
          fs.renameSync(src, dest);
          moves.push({ source: src, destination: dest, category: targetCategory });
        }
      }
    }

    // Save undo journal
    if (moves.length > 0) {
      const undoFile = path.join(resolved, '.stark_organize_undo.json');
      fs.writeFileSync(undoFile, JSON.stringify({ moves, timestamp: new Date().toISOString() }, null, 2), 'utf8');
    }

    return {
      success: true,
      directory: resolved,
      filesOrganized: moves.length,
      moves,
      summary: `Organized ${moves.length} file${moves.length === 1 ? '' : 's'} in "${path.basename(resolved)}" by category, sir.`
    };
  }

  /**
   * Restores a deleted file from trash/quarantine backup
   */
  async restoreDeletedFile(backupPath, targetPath = null) {
    if (!backupPath || !fs.existsSync(backupPath)) {
      throw new Error(`Quarantined backup not found at "${backupPath}".`);
    }

    let destination = targetPath;
    if (!destination) {
      const base = path.basename(backupPath);
      const originalName = base.replace(/^\d+_/, '');
      destination = path.join(this.workspaceRoot, originalName);
    }

    if (!this.isPathPermitted(destination)) {
      throw new Error(`Security Violation: Target restore path "${destination}" is unauthorized.`);
    }

    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    fs.copyFileSync(backupPath, destination);

    return {
      success: true,
      restoredFile: destination,
      backupSource: backupPath,
      summary: `File successfully restored to "${destination}", sir.`
    };
  }
}

module.exports = {
  WindowsFileExplorer,
  fileExplorerInstance: new WindowsFileExplorer(),
  PERMITTED_USER_DIRECTORIES
};
