/**
 * VISION AI — Microsoft Word Desktop Automation Service
 * Directly interfaces with native Microsoft Word (WINWORD.EXE) via COM automation
 * using PowerShell interop on Windows.
 * 
 * Mandate:
 * - Real Microsoft Word application on the interactive desktop (no fake HTML typewriter preview).
 * - Opens blank white document in Word, writes progressively section-by-section.
 * - Handles live voice revisions directly on the open Word document.
 * - Saves and verifies .docx output via Word.SaveAs2.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PS_SCRIPT = path.resolve(__dirname, 'word_automator.ps1');

class WordAutomationService {
  constructor() {
    this.psScriptPath = PS_SCRIPT;
    this.activeSession = null;
    this.lastState = null;
  }

  /**
   * Executes an action against word_automator.ps1
   * @param {string} action - 'check', 'init', 'write_progressive', 'revise', 'save', 'get_state', 'close'
   * @param {object} payload - Action arguments
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<object>}
   */
  async executeWordAction(action, payload = {}, timeoutMs = 30000) {
    return new Promise((resolve) => {
      const payloadJson = JSON.stringify(payload || {});
      const args = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.psScriptPath,
        '-Action', action,
        '-PayloadJson', payloadJson
      ];

      let stdout = '';
      let stderr = '';
      let timer = null;

      const child = spawn('powershell.exe', args, {
        cwd: __dirname,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          try { child.kill('SIGTERM'); } catch (_) {}
          resolve({
            success: false,
            error: `Word automation action "${action}" timed out after ${timeoutMs}ms.`
          });
        }, timeoutMs);
      }

      child.stdout.on('data', (d) => {
        stdout += d.toString('utf8');
      });

      child.stderr.on('data', (d) => {
        stderr += d.toString('utf8');
      });

      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        resolve({
          success: false,
          error: `Failed to spawn powershell for Word automation: ${err.message}`
        });
      });

      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        // Extract JSON between markers
        const beginMarker = '---STARK_WORD_JSON_BEGIN---';
        const endMarker = '---STARK_WORD_JSON_END---';
        const bIdx = stdout.indexOf(beginMarker);
        const eIdx = stdout.indexOf(endMarker);

        if (bIdx !== -1 && eIdx !== -1 && eIdx > bIdx) {
          const jsonStr = stdout.slice(bIdx + beginMarker.length, eIdx).trim();
          try {
            const parsed = JSON.parse(jsonStr);
            resolve(parsed);
            return;
          } catch (pe) {
            resolve({
              success: false,
              error: `Failed to parse Word JSON output: ${pe.message}`,
              raw: stdout
            });
            return;
          }
        }

        if (code !== 0) {
          resolve({
            success: false,
            error: `Word automator exited with code ${code}. Stderr: ${stderr.trim() || stdout.trim()}`
          });
        } else {
          resolve({
            success: false,
            error: `Word automator returned without JSON markers. Output: ${stdout.trim()}`
          });
        }
      });
    });
  }

  /**
   * Checks if Microsoft Word is installed on the local system
   */
  async checkInstallation() {
    return this.executeWordAction('check', {}, 10000);
  }

  /**
   * Opens Microsoft Word visibly on desktop and creates a blank document
   */
  async initWordSession({ forceNew = false } = {}) {
    const res = await this.executeWordAction('init', { forceNew }, 20000);
    if (res.success) {
      this.activeSession = {
        pid: res.pid,
        hwnd: res.hwnd,
        title: res.title,
        startTime: Date.now()
      };
    }
    return res;
  }

  /**
   * Progressively writes title, subtitle, and sections into the open Word document
   */
  async writeProgressive({ title, subtitle, sections }) {
    return this.executeWordAction('write_progressive', { title, subtitle, sections }, 45000);
  }

  /**
   * Applies live revisions (paragraph expansion, correction, or tables) to the open document
   */
  async reviseWordDocument({ instruction, operationType, targetSectionKeyword, paragraphNumber, additionText, addTable, table }) {
    return this.executeWordAction('revise', {
      instruction,
      operationType,
      targetSectionKeyword,
      paragraphNumber,
      additionText,
      addTable,
      table
    }, 25000);
  }

  /**
   * Synchronizes complete canonical document (title, subtitle, sections, tables) into Microsoft Word
   * and optionally saves as DOCX and PDF directly via Word COM.
   */
  async syncCanonical({ title, subtitle, sections, filePath = null, generatePdf = false }) {
    return this.executeWordAction('sync_canonical', {
      title,
      subtitle,
      sections,
      filePath,
      generatePdf
    }, 45000);
  }

  /**
   * Saves the open Word document as DOCX (and optional PDF) and returns verification data
   */
  async saveWordDocument({ filePath, generatePdf = false }) {
    return this.executeWordAction('save', { filePath, generatePdf }, 30000);
  }

  /**
   * Queries Word application and active document status
   */
  async getWordState() {
    return this.executeWordAction('get_state', {}, 10000);
  }

  /**
   * Closes the active Word document
   */
  async closeWordDocument({ quitWord = false } = {}) {
    const res = await this.executeWordAction('close', { quitWord }, 15000);
    this.activeSession = null;
    return res;
  }
}

const wordAutomationServiceInstance = new WordAutomationService();

module.exports = {
  WordAutomationService,
  wordAutomationServiceInstance
};
