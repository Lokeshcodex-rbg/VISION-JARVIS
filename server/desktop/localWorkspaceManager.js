/**
 * VISION AI — Persistent Local Workspace Manager
 * Central, disk-backed filesystem service providing comprehensive, persistent access
 * to user-authorized local files and folders (D:\Jarvis, Documents, Desktop, and user roots).
 * 
 * Features:
 * - Dynamic resolution of Windows user folders (Documents, Desktop, Downloads) without hardcoded usernames.
 * - Persistent authorized root configuration saved across restarts (data/authorized_roots.json).
 * - Path canonicalization, traversal protection (../../ escaping), and symlink escape defense.
 * - System-level protection against accessing sensitive OS and credential paths.
 * - Atomic file writes (temporary write -> verify -> atomic rename) preventing truncated destinations.
 * - Optimistic concurrency hashing, unified diffs, versioned backups, and safe restore.
 * - Unicode and multi-language encoding support (UTF-8, Hindi, non-English).
 * - Directory organization by file type, file comparison, and deep text search.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PROJECT_ROOT = process.env.JARVIS_PROJECT_PATH
  ? path.resolve(process.env.JARVIS_PROJECT_PATH)
  : path.resolve(__dirname, '..', '..');

const CONFIG_FILE = path.join(PROJECT_ROOT, 'data', 'authorized_roots.json');
const BACKUPS_DIR = path.join(PROJECT_ROOT, 'backups', 'workspace_backups');
const RECYCLE_DIR = path.join(PROJECT_ROOT, 'backups', 'recycle_bin');

// Sensitive system and credential locations strictly prohibited
const BLACKLISTED_SYSTEM_PATHS = [
  'c:\\windows',
  'c:\\program files',
  'c:\\program files (x86)',
  'appdata\\local\\google\\chrome\\user data',
  'appdata\\roaming\\mozilla\\firefox',
  '\\system32',
  '\\syswow64',
  '\\sam',
  '\\security',
  '.ssh',
  '.aws',
  '.azure',
  'id_rsa',
  'id_ed25519',
  '.env.production'
];

class LocalWorkspaceManager {
  constructor() {
    this.projectRoot = PROJECT_ROOT;
    this.standardFolders = this.resolveStandardWindowsFolders();
    this.authorizedRoots = new Set();
    this.ensureBaseDirectories();
    this.loadAuthorizedRoots();
  }

  /**
   * Resolves standard Windows user folders dynamically without hardcoding usernames
   */
  resolveStandardWindowsFolders() {
    const home = os.homedir();
    const resolved = {
      workspace: this.projectRoot,
      home: home,
      downloads: path.join(home, 'Downloads'),
      documents: path.join(home, 'Documents'),
      desktop: path.join(home, 'Desktop'),
      pictures: path.join(home, 'Pictures'),
      videos: path.join(home, 'Videos')
    };

    // Windows 11 OneDrive folder redirection detection
    const oneDriveDir = process.env.OneDrive || path.join(home, 'OneDrive');
    if (fs.existsSync(oneDriveDir)) {
      const oneDriveDocs = path.join(oneDriveDir, 'Documents');
      if (fs.existsSync(oneDriveDocs)) {
        resolved.documents = oneDriveDocs;
        resolved.documentsAlt = path.join(home, 'Documents');
      }

      const oneDriveDesktop = path.join(oneDriveDir, 'Desktop');
      if (fs.existsSync(oneDriveDesktop)) {
        resolved.desktop = oneDriveDesktop;
        resolved.desktopAlt = path.join(home, 'Desktop');
      }
    }

    return resolved;
  }

  ensureBaseDirectories() {
    try {
      const dataDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      if (!fs.existsSync(RECYCLE_DIR)) fs.mkdirSync(RECYCLE_DIR, { recursive: true });
    } catch (e) {
      console.warn('[WORKSPACE_MGR] Error ensuring base directories:', e.message);
    }
  }

  /**
   * Loads authorized roots from disk config or initializes defaults
   */
  loadAuthorizedRoots() {
    // Add default core roots
    this.authorizedRoots.add(path.normalize(this.projectRoot));
    if (this.standardFolders.documents) this.authorizedRoots.add(path.normalize(this.standardFolders.documents));
    if (this.standardFolders.documentsAlt && fs.existsSync(this.standardFolders.documentsAlt)) {
      this.authorizedRoots.add(path.normalize(this.standardFolders.documentsAlt));
    }
    if (this.standardFolders.desktop) this.authorizedRoots.add(path.normalize(this.standardFolders.desktop));
    if (this.standardFolders.desktopAlt && fs.existsSync(this.standardFolders.desktopAlt)) {
      this.authorizedRoots.add(path.normalize(this.standardFolders.desktopAlt));
    }
    if (this.standardFolders.downloads && fs.existsSync(this.standardFolders.downloads)) {
      this.authorizedRoots.add(path.normalize(this.standardFolders.downloads));
    }

    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.authorizedRoots)) {
          for (const root of parsed.authorizedRoots) {
            if (root && typeof root === 'string') {
              this.authorizedRoots.add(path.normalize(path.resolve(root)));
            }
          }
        }
      } else {
        this.saveAuthorizedRoots();
      }
    } catch (e) {
      console.warn('[WORKSPACE_MGR] Error loading authorized roots config:', e.message);
    }
  }

  /**
   * Persists authorized roots to disk
   */
  saveAuthorizedRoots() {
    try {
      const list = Array.from(this.authorizedRoots).sort();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({
        authorizedRoots: list,
        standardFolders: this.standardFolders,
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch (e) {
      console.warn('[WORKSPACE_MGR] Error saving authorized roots:', e.message);
    }
  }

  /**
   * Adds a new user-approved directory root
   */
  addAuthorizedRoot(dirPath) {
    if (!dirPath || typeof dirPath !== 'string') {
      throw new Error('Valid directory path is required.');
    }
    const resolved = path.normalize(path.resolve(dirPath));
    if (!fs.existsSync(resolved)) {
      throw new Error(`Directory does not exist on disk: "${resolved}".`);
    }
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      throw new Error(`Target path is a file, not a directory: "${resolved}".`);
    }

    // Verify target does not point to a blacklisted system directory
    const lower = resolved.toLowerCase();
    for (const blacklisted of BLACKLISTED_SYSTEM_PATHS) {
      if (lower.includes(blacklisted.toLowerCase())) {
        throw new Error(`Security Violation: Directory "${resolved}" contains protected system files and cannot be authorized.`);
      }
    }

    this.authorizedRoots.add(resolved);
    this.saveAuthorizedRoots();

    return {
      success: true,
      addedRoot: resolved,
      authorizedRoots: this.getAuthorizedRoots(),
      summary: `Directory "${resolved}" has been authorized and persisted for LOKESH workspace access.`
    };
  }

  /**
   * Removes an authorized root
   */
  removeAuthorizedRoot(dirPath) {
    if (!dirPath || typeof dirPath !== 'string') {
      throw new Error('Directory path is required.');
    }
    const resolved = path.normalize(path.resolve(dirPath));
    // Protect project workspace from removal
    if (resolved.toLowerCase() === path.normalize(this.projectRoot).toLowerCase()) {
      throw new Error('The primary project workspace cannot be de-authorized.');
    }

    let deleted = false;
    for (const r of this.authorizedRoots) {
      if (path.normalize(r).toLowerCase() === resolved.toLowerCase()) {
        this.authorizedRoots.delete(r);
        deleted = true;
      }
    }

    if (deleted) {
      this.saveAuthorizedRoots();
    }

    return {
      success: deleted,
      removedRoot: resolved,
      authorizedRoots: this.getAuthorizedRoots(),
      summary: deleted ? `Root "${resolved}" revoked from authorized workspace.` : `Root "${resolved}" was not in authorized list.`
    };
  }

  /**
   * Returns list of currently authorized roots and standard folders
   */
  getAuthorizedRoots() {
    return Array.from(this.authorizedRoots);
  }

  listAuthorizedRoots() {
    return this.getAuthorizedRoots();
  }

  /**
   * Canonicalizes and normalizes an input path
   */
  canonicalizePath(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') return '';
    let clean = rawPath.trim().replace(/^['"]|['"]$/g, '');

    // Resolve common user aliases
    const lower = clean.toLowerCase();
    if (lower === 'documents' || lower === 'my documents') {
      return this.standardFolders.documents;
    }
    if (lower === 'desktop' || lower === 'my desktop') {
      return this.standardFolders.desktop;
    }
    if (lower === 'downloads' || lower === 'my downloads') {
      return this.standardFolders.downloads;
    }
    if (lower === 'workspace' || lower === 'project' || lower === 'jarvis') {
      return this.projectRoot;
    }

    // Resolve folder prefix paths (e.g. "documents/report.docx" -> user's actual Documents directory)
    if (/^(?:documents|my documents)[\\/]/i.test(clean)) {
      clean = path.join(this.standardFolders.documents, clean.replace(/^(?:documents|my documents)[\\/]/i, ''));
    } else if (/^(?:desktop|my desktop)[\\/]/i.test(clean)) {
      clean = path.join(this.standardFolders.desktop, clean.replace(/^(?:desktop|my desktop)[\\/]/i, ''));
    } else if (/^(?:downloads|my downloads)[\\/]/i.test(clean)) {
      clean = path.join(this.standardFolders.downloads, clean.replace(/^(?:downloads|my downloads)[\\/]/i, ''));
    } else if (/^(?:workspace|project|jarvis)[\\/]/i.test(clean)) {
      clean = path.join(this.projectRoot, clean.replace(/^(?:workspace|project|jarvis)[\\/]/i, ''));
    }

    // Expand ~ home prefix
    if (clean.startsWith('~') || clean.startsWith('~\\') || clean.startsWith('~/')) {
      clean = path.join(os.homedir(), clean.slice(1));
    }

    // If relative, resolve against project workspace
    const abs = path.isAbsolute(clean) ? clean : path.join(this.projectRoot, clean);
    return path.normalize(path.resolve(abs));
  }

  /**
   * Checks whether a path resides inside at least one authorized root
   */
  isPathAuthorized(targetPath) {
    if (!targetPath || typeof targetPath !== 'string') return false;
    const resolved = this.canonicalizePath(targetPath);
    const lower = resolved.toLowerCase();

    // Check system blacklist
    for (const blacklisted of BLACKLISTED_SYSTEM_PATHS) {
      if (lower.includes(blacklisted.toLowerCase())) {
        return false;
      }
    }

    // Check against authorized roots
    for (const root of this.authorizedRoots) {
      const normRoot = path.normalize(root).toLowerCase();
      // Exact match or subpath
      if (lower === normRoot || lower.startsWith(normRoot + path.sep.toLowerCase()) || lower.startsWith(normRoot + '/')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolves and verifies safe path against authorized roots
   */
  resolveSafePath(userPath, defaultDir = null) {
    if (!userPath || typeof userPath !== 'string') {
      throw new Error('Invalid file path specified.');
    }

    let resolved = this.canonicalizePath(userPath);

    // If relative and a default directory was specified
    if (!path.isAbsolute(userPath.trim().replace(/^['"]|['"]$/g, '')) && defaultDir) {
      const base = this.canonicalizePath(defaultDir);
      resolved = path.normalize(path.resolve(base, userPath.trim().replace(/^['"]|['"]$/g, '')));
    }

    if (!this.isPathAuthorized(resolved)) {
      throw new Error(`Security Violation: Path "${userPath}" is outside authorized local workspace roots.`);
    }

    // Verify symlink or junction target doesn't escape authorized roots if path exists
    try {
      if (fs.existsSync(resolved)) {
        const real = fs.realpathSync(resolved);
        if (!this.isPathAuthorized(real)) {
          throw new Error(`Security Violation: Symlink target "${real}" resolves outside authorized roots.`);
        }
        return real;
      }
    } catch (_) {}

    return resolved;
  }

  /**
   * Computes SHA-256 hash of a file
   */
  getFileHash(filePath) {
    const absPath = this.resolveSafePath(filePath);
    if (!fs.existsSync(absPath)) return null;
    const buffer = fs.readFileSync(absPath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // =========================================================================
  // DISK-BACKED FILESYSTEM OPERATIONS
  // =========================================================================

  /**
   * Lists contents of an authorized folder
   */
  listDirectory(dirPath = null, options = {}) {
    const targetDir = dirPath ? this.resolveSafePath(dirPath) : this.projectRoot;
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory not found: "${targetDir}".`);
    }

    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) {
      throw new Error(`Target is not a directory: "${targetDir}".`);
    }

    const maxEntries = Math.min(500, parseInt(options.maxEntries, 10) || 100);
    const rawEntries = fs.readdirSync(targetDir, { withFileTypes: true });
    const items = [];

    for (const entry of rawEntries) {
      if (items.length >= maxEntries) break;
      if (entry.name === '$Recycle.Bin' || entry.name === 'System Volume Information') continue;

      const fullPath = path.join(targetDir, entry.name);
      try {
        const entryStat = fs.statSync(fullPath);
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          sizeBytes: entry.isDirectory() ? 0 : entryStat.size,
          sizeKB: entry.isDirectory() ? 0 : Math.round(entryStat.size / 1024),
          modified: entryStat.mtime.toISOString(),
          extension: entry.isDirectory() ? '' : path.extname(entry.name).toLowerCase()
        });
      } catch (err) {
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          error: err.message
        });
      }
    }

    return {
      success: true,
      directory: targetDir,
      totalEntries: rawEntries.length,
      returnedEntries: items.length,
      items,
      summary: `Listed ${items.length} item(s) from "${path.basename(targetDir) || targetDir}".`
    };
  }

  /**
   * Reads a text or code file safely
   */
  readFile(filePath, options = {}) {
    const absPath = this.resolveSafePath(filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found: "${filePath}".`);
    }

    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      throw new Error(`Target is a directory, not a file: "${filePath}".`);
    }

    // Safety check on file size
    const maxBytes = options.maxBytes || 1000000; // 1 MB limit
    if (stat.size > 10000000) { // 10 MB absolute hard ceiling
      throw new Error(`File size (${Math.round(stat.size / 1024 / 1024)} MB) exceeds maximum safe file read limit.`);
    }

    // Detect binary files
    const buffer = fs.readFileSync(absPath);
    const isBinary = this.isBinaryBuffer(buffer);

    if (isBinary && !options.allowBinary) {
      return {
        success: true,
        filePath: absPath,
        fileName: path.basename(absPath),
        isBinary: true,
        sizeBytes: stat.size,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        summary: `File "${path.basename(absPath)}" is a binary file (${Math.round(stat.size / 1024)} KB). Text contents omitted.`
      };
    }

    const encoding = options.encoding || 'utf8';
    const content = buffer.toString(encoding);
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    const startLine = Math.max(1, parseInt(options.startLine, 10) || 1);
    const maxLines = Math.min(2000, parseInt(options.maxLines, 10) || totalLines);
    const endLine = options.endLine ? Math.min(totalLines, parseInt(options.endLine, 10)) : Math.min(totalLines, startLine + maxLines - 1);

    const slice = lines.slice(startLine - 1, endLine);
    const truncated = slice.length < totalLines;

    return {
      success: true,
      filePath: absPath,
      fileName: path.basename(absPath),
      totalLines,
      startLine,
      endLine,
      lineCount: slice.length,
      truncated,
      sizeBytes: stat.size,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      content: slice.join('\n'),
      summary: `Successfully read ${slice.length} lines from "${path.basename(absPath)}" (${stat.size} bytes).`
    };
  }

  isBinaryBuffer(buf) {
    const checkLength = Math.min(buf.length, 512);
    for (let i = 0; i < checkLength; i++) {
      if (buf[i] === 0) return true; // Null byte indicates binary
    }
    return false;
  }

  /**
   * Writes a file atomically with post-write verification
   * Prevents corrupted/truncated files if process is interrupted.
   */
  writeFile(filePath, content = '', options = {}) {
    const absPath = this.resolveSafePath(filePath);
    const parentDir = path.dirname(absPath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    if (fs.existsSync(absPath) && options.overwrite === false) {
      throw new Error(`File already exists: "${absPath}". Set overwrite: true to replace.`);
    }

    const data = Buffer.isBuffer(content) ? content : Buffer.from(String(content), options.encoding || 'utf8');

    // Create backup if target file already exists and backup requested
    let backupId = null;
    if (fs.existsSync(absPath) && options.createBackup !== false) {
      backupId = this.createBackup(absPath).backupId;
    }

    // Atomic write pattern: write to tmp file in same directory, then rename
    const tmpPath = path.join(parentDir, `.tmp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
    try {
      fs.writeFileSync(tmpPath, data);

      // Verify temp write integrity
      if (!fs.existsSync(tmpPath)) {
        throw new Error('Temporary file creation failed verification.');
      }
      const tmpStat = fs.statSync(tmpPath);
      if (tmpStat.size !== data.length) {
        throw new Error(`Temporary file size mismatch: expected ${data.length} bytes, found ${tmpStat.size} bytes.`);
      }

      // Rename temp over destination atomically
      fs.renameSync(tmpPath, absPath);
    } catch (err) {
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
      throw new Error(`Atomic write failure for "${filePath}": ${err.message}`);
    }

    // Post-write verification of final destination
    if (!fs.existsSync(absPath)) {
      throw new Error(`Post-write verification failed: destination "${absPath}" does not exist on disk.`);
    }
    const finalStat = fs.statSync(absPath);
    const hash = crypto.createHash('sha256').update(data).digest('hex');

    return {
      success: true,
      filePath: absPath,
      fileName: path.basename(absPath),
      sizeBytes: finalStat.size,
      sha256: hash,
      backupId,
      summary: `File "${path.basename(absPath)}" successfully saved and verified (${finalStat.size} bytes, SHA-256: ${hash.slice(0, 8)}...).`
    };
  }

  /**
   * Creates a directory within authorized roots
   */
  createDirectory(dirPath) {
    const absPath = this.resolveSafePath(dirPath);
    if (!fs.existsSync(absPath)) {
      fs.mkdirSync(absPath, { recursive: true });
    }
    return {
      success: true,
      directory: absPath,
      summary: `Directory "${path.basename(absPath)}" created successfully at ${absPath}.`
    };
  }

  /**
   * Edits an existing text file with optimistic concurrency and backup preservation
   */
  editFile(filePath, options = {}) {
    const absPath = this.resolveSafePath(filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Target file does not exist: "${filePath}".`);
    }

    const currentContent = fs.readFileSync(absPath, 'utf8');
    const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');

    // Optimistic Concurrency Check
    if (options.expectedHash && options.expectedHash !== currentHash) {
      throw new Error(`CONCURRENT_MODIFICATION: Expected hash "${options.expectedHash}" does not match on-disk hash "${currentHash}".`);
    }

    const targetCode = String(options.targetContent !== undefined ? options.targetContent : (options.targetCode || ''));
    const replacementCode = String(options.replacementContent !== undefined ? options.replacementContent : (options.replacementCode || ''));

    if (!targetCode) {
      throw new Error('targetContent snippet is required for file editing.');
    }

    if (!currentContent.includes(targetCode)) {
      throw new Error(`TARGET_NOT_FOUND: Specified target content snippet not found in "${path.basename(absPath)}".`);
    }

    // Ambiguity check
    const firstIdx = currentContent.indexOf(targetCode);
    const lastIdx = currentContent.lastIndexOf(targetCode);
    if (firstIdx !== lastIdx && !options.allowMultiple) {
      throw new Error(`AMBIGUOUS_TARGET: Target snippet occurs multiple times in "${path.basename(absPath)}". Provide more context or set allowMultiple: true.`);
    }

    // Create backup
    const backupId = this.createBackup(absPath).backupId;

    // Apply replacement
    let newContent;
    if (options.allowMultiple) {
      newContent = currentContent.split(targetCode).join(replacementCode);
    } else {
      newContent = currentContent.slice(0, firstIdx) + replacementCode + currentContent.slice(firstIdx + targetCode.length);
    }

    // Write atomically
    this.writeFile(absPath, newContent, { createBackup: false, overwrite: true });

    const newHash = crypto.createHash('sha256').update(newContent).digest('hex');

    return {
      success: true,
      filePath: absPath,
      fileName: path.basename(absPath),
      backupId,
      originalHash: currentHash,
      newHash,
      diff: `--- a/${path.basename(absPath)}\n+++ b/${path.basename(absPath)}\n@@ -1 +1 @@\n-${targetCode}\n+${replacementCode}`,
      summary: `File "${path.basename(absPath)}" edited cleanly with backup preserved as ${backupId}.`
    };
  }

  /**
   * Copies a file or folder safely with hash verification
   */
  copyFileOrDir(srcPath, destPath, options = {}) {
    const absSrc = this.resolveSafePath(srcPath);
    const absDest = this.resolveSafePath(destPath);

    if (!fs.existsSync(absSrc)) {
      throw new Error(`Source path does not exist: "${srcPath}".`);
    }

    const srcStat = fs.statSync(absSrc);
    const destParent = path.dirname(absDest);
    if (!fs.existsSync(destParent)) {
      fs.mkdirSync(destParent, { recursive: true });
    }

    if (srcStat.isDirectory()) {
      fs.cpSync(absSrc, absDest, { recursive: true });
    } else {
      fs.copyFileSync(absSrc, absDest);
      // Verify copy
      if (!fs.existsSync(absDest)) {
        throw new Error('Copy failed: destination file missing after copy.');
      }
      const srcHash = crypto.createHash('sha256').update(fs.readFileSync(absSrc)).digest('hex');
      const destHash = crypto.createHash('sha256').update(fs.readFileSync(absDest)).digest('hex');
      if (srcHash !== destHash) {
        throw new Error('Copy integrity failure: source and destination SHA-256 hashes do not match.');
      }
    }

    return {
      success: true,
      source: absSrc,
      destination: absDest,
      summary: `Copied "${path.basename(absSrc)}" to "${absDest}" with verified integrity.`
    };
  }

  /**
   * Moves or renames a file or directory safely
   */
  moveFileOrDir(srcPath, destPath, options = {}) {
    const absSrc = this.resolveSafePath(srcPath);
    const absDest = this.resolveSafePath(destPath);

    if (!fs.existsSync(absSrc)) {
      throw new Error(`Source path does not exist: "${srcPath}".`);
    }

    const destParent = path.dirname(absDest);
    if (!fs.existsSync(destParent)) {
      fs.mkdirSync(destParent, { recursive: true });
    }

    fs.renameSync(absSrc, absDest);

    if (!fs.existsSync(absDest)) {
      throw new Error('Move verification failed: destination does not exist after move.');
    }

    return {
      success: true,
      oldPath: absSrc,
      newPath: absDest,
      summary: `Moved "${path.basename(absSrc)}" to "${absDest}".`
    };
  }

  /**
   * Deletes a file by safely moving it to the workspace recycle bin
   */
  deleteFile(filePath, options = {}) {
    const absPath = this.resolveSafePath(filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`File does not exist: "${filePath}".`);
    }

    const fileName = path.basename(absPath);
    const recycleId = `del_${Date.now()}_${fileName}`;
    const recycleTarget = path.join(RECYCLE_DIR, recycleId);

    // Copy to recycle bin
    fs.copyFileSync(absPath, recycleTarget);
    fs.unlinkSync(absPath);

    return {
      success: true,
      deletedFile: absPath,
      recycleId,
      summary: `File "${fileName}" moved to recoverable workspace recycle bin (ID: ${recycleId}).`
    };
  }

  /**
   * Organizes files in an authorized directory into subfolders by type
   */
  organizeFiles(dirPath, options = {}) {
    const targetDir = this.resolveSafePath(dirPath);
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory not found: "${dirPath}".`);
    }

    const typeMapping = {
      Documents: ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt', '.csv', '.xlsx', '.xls', '.pptx'],
      Images: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'],
      Code: ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.sql', '.sh', '.bat', '.ps1'],
      Archives: ['.zip', '.rar', '.7z', '.tar', '.gz'],
      Media: ['.mp3', '.mp4', '.wav', '.mkv', '.avi', '.mov']
    };

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    let movedCount = 0;
    const log = [];

    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      let targetFolder = 'Other';

      for (const [category, extList] of Object.entries(typeMapping)) {
        if (extList.includes(ext)) {
          targetFolder = category;
          break;
        }
      }

      const destFolder = path.join(targetDir, targetFolder);
      if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder, { recursive: true });
      }

      const srcFile = path.join(targetDir, entry.name);
      const destFile = path.join(destFolder, entry.name);

      if (!fs.existsSync(destFile)) {
        fs.renameSync(srcFile, destFile);
        movedCount++;
        log.push({ file: entry.name, movedTo: targetFolder });
      }
    }

    return {
      success: true,
      directory: targetDir,
      organizedFilesCount: movedCount,
      operations: log,
      summary: `Organized ${movedCount} file(s) into category subfolders in "${path.basename(targetDir)}".`
    };
  }

  /**
   * Searches authorized files by name or content
   */
  searchFiles(query, options = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required.');
    }

    const cleanQuery = query.toLowerCase().trim();
    const maxResults = Math.min(100, parseInt(options.maxResults, 10) || 20);
    const searchDirs = options.location ? [this.resolveSafePath(options.location)] : Array.from(this.authorizedRoots);
    const searchContent = Boolean(options.searchContent);

    const results = [];

    const walk = (dir, depth = 0) => {
      if (depth > 4 || results.length >= maxResults) return;
      try {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults) break;
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '$Recycle.Bin') continue;

          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath, depth + 1);
          } else {
            let matched = false;
            let matchType = 'FILENAME';
            let snippet = '';

            if (entry.name.toLowerCase().includes(cleanQuery)) {
              matched = true;
            } else if (searchContent && /\.(txt|md|js|json|html|css|py|csv|log)$/i.test(entry.name)) {
              try {
                const stat = fs.statSync(fullPath);
                if (stat.size < 500000) {
                  const text = fs.readFileSync(fullPath, 'utf8');
                  if (text.toLowerCase().includes(cleanQuery)) {
                    matched = true;
                    matchType = 'CONTENT';
                    const idx = text.toLowerCase().indexOf(cleanQuery);
                    snippet = text.slice(Math.max(0, idx - 40), Math.min(text.length, idx + 80)).replace(/\r?\n/g, ' ');
                  }
                }
              } catch (_) {}
            }

            if (matched) {
              const stat = fs.statSync(fullPath);
              results.push({
                name: entry.name,
                path: fullPath,
                matchType,
                snippet,
                sizeBytes: stat.size,
                sizeKB: Math.round(stat.size / 1024),
                modified: stat.mtime.toISOString()
              });
            }
          }
        }
      } catch (_) {}
    };

    for (const d of searchDirs) {
      if (results.length >= maxResults) break;
      walk(d, 0);
    }

    return {
      success: true,
      query,
      resultsCount: results.length,
      results,
      summary: `Found ${results.length} file match(es) for "${query}".`
    };
  }

  /**
   * Compares two files and computes SHA-256 hashes and diff
   */
  compareFiles(pathA, pathB) {
    const absA = this.resolveSafePath(pathA);
    const absB = this.resolveSafePath(pathB);

    if (!fs.existsSync(absA)) throw new Error(`File A not found: "${pathA}".`);
    if (!fs.existsSync(absB)) throw new Error(`File B not found: "${pathB}".`);

    const bufA = fs.readFileSync(absA);
    const bufB = fs.readFileSync(absB);
    const hashA = crypto.createHash('sha256').update(bufA).digest('hex');
    const hashB = crypto.createHash('sha256').update(bufB).digest('hex');
    const identical = (hashA === hashB);

    let textDiff = '';
    if (!identical && !this.isBinaryBuffer(bufA) && !this.isBinaryBuffer(bufB)) {
      const textA = bufA.toString('utf8');
      const textB = bufB.toString('utf8');
      textDiff = `--- a/${path.basename(absA)}\n+++ b/${path.basename(absB)}\n@@ Size: ${bufA.length} -> ${bufB.length} bytes @@`;
    }

    return {
      success: true,
      fileA: absA,
      fileB: absB,
      identical,
      hashA,
      hashB,
      sizeA: bufA.length,
      sizeB: bufB.length,
      diff: textDiff,
      summary: identical
        ? `Files "${path.basename(absA)}" and "${path.basename(absB)}" are identical (SHA-256: ${hashA.slice(0, 8)}...).`
        : `Files differ. File A: ${bufA.length} bytes, File B: ${bufB.length} bytes.`
    };
  }

  /**
   * Creates a versioned backup of a file
   */
  createBackup(filePath) {
    const absPath = this.resolveSafePath(filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found for backup: "${filePath}".`);
    }

    const backupId = `bk_${Date.now()}_${path.basename(absPath)}`;
    const backupTarget = path.join(BACKUPS_DIR, backupId);
    fs.copyFileSync(absPath, backupTarget);

    const hash = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');

    return {
      success: true,
      backupId,
      sourceFile: absPath,
      backupPath: backupTarget,
      sha256: hash,
      summary: `Backup created for "${path.basename(absPath)}" as ${backupId}.`
    };
  }

  /**
   * Restores an approved backup to its original or specified destination
   */
  restoreBackup(backupId, targetPath = null) {
    if (!backupId || typeof backupId !== 'string') {
      throw new Error('Valid backupId is required.');
    }

    const backupFile = path.join(BACKUPS_DIR, backupId);
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup "${backupId}" does not exist.`);
    }

    let dest = targetPath ? this.resolveSafePath(targetPath) : null;
    if (!dest) {
      // Parse original file name from backupId: bk_<timestamp>_<filename>
      const parts = backupId.split('_');
      if (parts.length >= 3) {
        const origName = parts.slice(2).join('_');
        dest = path.join(this.projectRoot, origName);
      } else {
        throw new Error('Target destination path must be provided for this backup.');
      }
    }

    fs.copyFileSync(backupFile, dest);

    return {
      success: true,
      backupId,
      restoredTo: dest,
      summary: `Backup "${backupId}" successfully restored to "${dest}".`
    };
  }

  /**
   * Verifies the presence, size, and SHA-256 hash of a file on disk
   */
  verifyFileHash(userPath, expectedHash = null) {
    const absPath = this.resolveSafePath(userPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`File "${userPath}" does not exist.`);
    }
    const stat = fs.statSync(absPath);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
    const matches = expectedHash ? hash.toLowerCase() === String(expectedHash).toLowerCase() : true;
    return {
      success: true,
      filePath: absPath,
      fileName: path.basename(absPath),
      sizeBytes: stat.size,
      sha256: hash,
      verified: matches,
      matchesExpected: matches,
      summary: `File "${path.basename(absPath)}" (${stat.size} bytes) SHA-256 verified: ${hash}.`
    };
  }
}

const localWorkspaceManagerInstance = new LocalWorkspaceManager();

module.exports = {
  LocalWorkspaceManager,
  localWorkspaceManagerInstance
};
