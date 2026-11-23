/**
 * VISION AI — Word, Notepad & Document Automation Service
 * Handles reliable document creation, formatting, automatic saving, and post-write verification.
 * 
 * Workflow for "JARVIS, open Notepad and write down my project plan":
 * 1. Understands requested content and structure.
 * 2. Writes verified text/markdown file to authorized local storage.
 * 3. Verifies file exists on disk and content matches SHA-256 hash.
 * 4. Launches Notepad with the file if requested.
 * 5. Returns exact saved path.
 * 
 * For Microsoft Word:
 * - Generates verified formatted documents (.rtf / .docx / WordML) that open natively in Microsoft Word.
 * - Supports automatic saving without repeated confirmation.
 * - Never claims a document was saved until post-write disk verification succeeds.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { appLauncherInstance } = require('./appLauncher.js');
const { fileExplorerInstance } = require('./fileExplorer.js');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_WORKSPACE_DIR = path.join(PROJECT_ROOT, 'workspace');

class DocumentAutomationService {
  constructor() {
    this.defaultSaveDir = DEFAULT_WORKSPACE_DIR;
    this.ensureWorkspaceDirectory();
  }

  ensureWorkspaceDirectory() {
    try {
      if (!fs.existsSync(this.defaultSaveDir)) {
        fs.mkdirSync(this.defaultSaveDir, { recursive: true });
      }
    } catch (_) {}
  }

  setDefaultSaveDir(newDir) {
    if (!newDir || typeof newDir !== 'string') throw new Error('Valid directory path is required.');
    const resolved = path.resolve(newDir);
    if (!fileExplorerInstance.isPathPermitted(resolved)) {
      throw new Error(`Security Violation: Path "${resolved}" is outside authorized storage locations.`);
    }
    this.defaultSaveDir = resolved;
    this.ensureWorkspaceDirectory();
    return {
      success: true,
      defaultSaveDir: this.defaultSaveDir,
      summary: `Default save directory set to "${this.defaultSaveDir}".`
    };
  }

  getDefaultSaveDir() {
    return this.defaultSaveDir;
  }

  /**
   * Sanitizes a document title into a clean filename
   */
  sanitizeFilename(title, defaultName = 'project_plan') {
    const raw = String(title || defaultName).trim();
    const sanitized = raw.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
    return sanitized || defaultName;
  }

  /**
   * Executes the full Notepad writing workflow
   */
  async writeNotepadDocument({
    title = 'project_plan',
    content = '',
    targetDir = null,
    filePath = null,
    targetPath = null,
    openInNotepad = true,
    fileExtension = 'txt',
    forceNewWindow = false
  } = {}) {
    const explicitPath = filePath || targetPath;
    let fullPath;
    let saveDirectory;
    let fileName;

    if (explicitPath) {
      fullPath = path.resolve(explicitPath);
      saveDirectory = path.dirname(fullPath);
      fileName = path.basename(fullPath);
    } else {
      this.ensureWorkspaceDirectory();
      saveDirectory = targetDir ? path.resolve(targetDir) : this.defaultSaveDir;
      const baseName = this.sanitizeFilename(title, 'project_plan');
      const ext = fileExtension.replace(/^\./, '');
      fileName = `${baseName}.${ext}`;
      fullPath = path.join(saveDirectory, fileName);
      let counter = 1;
      while (fs.existsSync(fullPath)) {
        fileName = `${baseName}_${counter}.${ext}`;
        fullPath = path.join(saveDirectory, fileName);
        counter++;
      }
    }

    if (!fileExplorerInstance.isPathPermitted(saveDirectory)) {
      throw new Error(`Security Violation: Save directory "${saveDirectory}" is outside authorized locations.`);
    }

    if (!fs.existsSync(saveDirectory)) {
      fs.mkdirSync(saveDirectory, { recursive: true });
    }

    const formattedContent = String(content).trim() + '\n';
    const contentHash = crypto.createHash('sha256').update(formattedContent, 'utf8').digest('hex');

    // 1. Write file to disk
    fs.writeFileSync(fullPath, formattedContent, 'utf8');

    // 2. Independent post-write disk verification
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Verification Failure: Document "${fileName}" could not be confirmed on disk after save.`);
    }

    const onDiskContent = fs.readFileSync(fullPath, 'utf8');
    const onDiskHash = crypto.createHash('sha256').update(onDiskContent, 'utf8').digest('hex');
    if (onDiskHash !== contentHash) {
      throw new Error(`Integrity Verification Failure: Saved file content hash does not match original payload.`);
    }

    const stat = fs.statSync(fullPath);

    // 3. Open in Notepad visibly if requested (reusing or replacing single managed Notepad window unless forceNewWindow is true)
    let notepadLaunched = false;
    let windowTitle = '';
    let notepadPid = null;
    let notepadHwnd = null;
    if (openInNotepad) {
      try {
        const { appLauncherInstance } = require('./appLauncher.js');
        const launchRes = await appLauncherInstance.launch('notepad', {
          targetFile: fullPath,
          forceNew: Boolean(forceNewWindow)
        });
        if (launchRes && (launchRes.verified || launchRes.pid)) {
          notepadLaunched = true;
          notepadPid = launchRes.pid || null;
          notepadHwnd = launchRes.hwnd || null;
          windowTitle = launchRes.windowTitle || `${fileName} - Notepad`;
        }
      } catch (e) {
        console.warn('[DOC_AUTOMATION] Notepad launch warning:', e.message);
      }
    }

    return {
      success: true,
      verified: true,
      fileName,
      filePath: fullPath,
      sizeBytes: stat.size,
      hash: onDiskHash,
      notepadLaunched,
      notepadPid,
      notepadHwnd,
      windowTitle,
      summary: `I have saved your document to "${fullPath}" (${stat.size} bytes)${notepadLaunched ? ' and opened it in Notepad' : ''}, sir. Content verified on disk.`
    };
  }

  /**
   * Generates a verified native Microsoft Word (.docx) document with post-write AST validation
   */
  async createWordDocument(options = {}) {
    const { documentIntelligenceEngineInstance } = require('../documentIntelligenceEngine.js');
    return documentIntelligenceEngineInstance.createDocxDocument(options);
  }

  /**
   * Automatic saving without repeated manual confirmation prompts
   */
  async autoSaveDocument({
    filePath,
    content
  } = {}) {
    if (!filePath) throw new Error('filePath is required for auto-saving.');

    const resolved = path.resolve(filePath);
    if (!fileExplorerInstance.isPathPermitted(resolved)) {
      throw new Error(`Security Violation: Path "${resolved}" is outside authorized locations.`);
    }

    const parentDir = path.dirname(resolved);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Backup existing version if present
    let backupCreated = false;
    if (fs.existsSync(resolved)) {
      const backupDir = path.join(PROJECT_ROOT, 'backups', 'autosave');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const bName = `${Date.now()}_${path.basename(resolved)}`;
      fs.copyFileSync(resolved, path.join(backupDir, bName));
      backupCreated = true;
    }

    fs.writeFileSync(resolved, String(content), 'utf8');

    // Verification
    if (!fs.existsSync(resolved)) {
      throw new Error(`Auto-save Verification Failure: "${resolved}" missing after write.`);
    }

    const stat = fs.statSync(resolved);
    return {
      success: true,
      verified: true,
      filePath: resolved,
      fileName: path.basename(resolved),
      sizeBytes: stat.size,
      backupCreated,
      summary: `Document "${path.basename(resolved)}" automatically saved and verified (${stat.size} bytes), sir.`
    };
  }
}

const documentAutomationServiceInstance = new DocumentAutomationService();

module.exports = {
  DocumentAutomationService,
  documentAutomationServiceInstance
};
