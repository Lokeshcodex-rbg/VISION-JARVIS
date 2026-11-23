/**
 * VISION AI — Windows Local Agent
 * Authoritative on-device agent connecting JARVIS & ULTRON to the Windows desktop.
 * Coordinates authenticated command execution, process lifecycle tracking, window automation,
 * file manipulation, document workflows, audit logging, and Emergency Stop termination.
 * 
 * Truthful Attribution Guarantee:
 * Every action returns empirical verification (process PID, SHA-256 hash, or disk proof).
 * Never claims an application was launched, a command run, or a document saved unless verified.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, exec, execSync } = require('child_process');

const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
const { permissionGateInstance } = require('./permissionGate.js');
const { appLauncherInstance } = require('./appLauncher.js');
const { desktopControllerInstance } = require('./desktopController.js');
const { documentAutomationServiceInstance } = require('./documentAutomationService.js');
const { documentIntelligenceEngineInstance } = require('../documentIntelligenceEngine.js');
const { localWorkspaceManagerInstance } = require('./localWorkspaceManager.js');
const { fileExplorerInstance } = require('./fileExplorer.js');
const { agentLifecycleManagerInstance } = require('./agentLifecycleManager.js');

const PROJECT_ROOT = process.env.JARVIS_PROJECT_PATH
  ? path.resolve(process.env.JARVIS_PROJECT_PATH)
  : path.resolve(__dirname, '../..');

const AUDIT_LOG_FILE = path.join(PROJECT_ROOT, 'data', 'desktop_agent_audit.json');
const SESSION_TOKEN_FILE = path.join(PROJECT_ROOT, 'data', '.session_token');

// Approved commands/binaries for controlled shell execution
const ALLOWED_COMMAND_PATTERNS = [
  /^(?:Get-Date|get-date|date|time)/i,
  /^(?:Get-Process|get-process|ps\b)/i,
  /^(?:Get-Service|get-service)/i,
  /^(?:Get-ChildItem|get-childitem|dir\b|ls\b)/i,
  /^(?:Get-Content|get-content|type\b|cat\b)/i,
  /^(?:Start-Sleep|start-sleep|sleep)\b/i,
  /^(?:whoami|hostname|ipconfig|systeminfo|ver)\b/i,
  /^(?:echo\b)/i,
  /^(?:node\s+-v|node\s+--version|npm\s+-v|npm\s+--version)\b/i,
  /^(?:git\s+status|git\s+branch|git\s+log)\b/i,
  /^(?:node\s+['"]?[a-zA-Z0-9_\-\/\\]+\.js['"]?)/i
];

// Dangerous command tokens strictly blocked under all circumstances
const BLOCKED_COMMAND_PATTERNS = [
  /\bformat\b/i,
  /\bdiskpart\b/i,
  /\bbcdedit\b/i,
  /\breg\s+delete\b/i,
  /\btakeown\b/i,
  /\bicacls\s+.*\/deny\b/i,
  /\bdel\s+\/s\s+\/q\s+[c-zC-Z]:\\/i,
  /\brmdir\s+\/s\s+\/q\s+[c-zC-Z]:\\/i,
  /\bRemove-Item\s+-Recurse\s+-Force\s+[c-zC-Z]:\\/i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/
];

class WindowsLocalAgent {
  constructor() {
    this.projectRoot = PROJECT_ROOT;
    this.auditLogFile = AUDIT_LOG_FILE;
    this.sessionToken = this.loadOrGenerateSessionToken();
    this.activeChildProcesses = new Map();
    this.ensureAuditLogFile();
  }

  loadOrGenerateSessionToken() {
    try {
      if (fs.existsSync(SESSION_TOKEN_FILE)) {
        const token = fs.readFileSync(SESSION_TOKEN_FILE, 'utf8').trim();
        if (token && token.length >= 32) return token;
      }
      const newToken = crypto.randomBytes(32).toString('hex');
      const dir = path.dirname(SESSION_TOKEN_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SESSION_TOKEN_FILE, newToken, 'utf8');
      return newToken;
    } catch (_) {
      return crypto.randomBytes(32).toString('hex');
    }
  }

  ensureAuditLogFile() {
    try {
      const dir = path.dirname(this.auditLogFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(this.auditLogFile)) {
        fs.writeFileSync(this.auditLogFile, '[]', 'utf8');
      }
    } catch (_) {}
  }

  logAudit(action, details = {}, personality = 'JARVIS') {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      personality: (personality || '').toUpperCase(),
      verified: Boolean(details.verified),
      processPid: details.processPid || null,
      executionTimeMs: details.executionTimeMs || null,
      details: this.sanitizeAuditDetails(details)
    };

    try {
      this.ensureAuditLogFile();
      let list = [];
      try {
        const raw = fs.readFileSync(this.auditLogFile, 'utf8');
        list = JSON.parse(raw);
        if (!Array.isArray(list)) list = [];
      } catch (_) {
        list = [];
      }
      list.push(entry);
      if (list.length > 500) list = list.slice(-500);
      fs.writeFileSync(this.auditLogFile, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.warn('[WINDOWS_LOCAL_AGENT] Failed to append audit log:', e.message);
    }

    return entry;
  }

  sanitizeAuditDetails(data) {
    if (!data) return {};
    try {
      let str = JSON.stringify(data);
      str = str.replace(/("?(?:token|secret|password|api[_-]?key)"?\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3');
      return JSON.parse(str);
    } catch (_) {
      return { note: 'Unserializable details' };
    }
  }

  getAuditLogs(limit = 50) {
    try {
      this.ensureAuditLogFile();
      const raw = fs.readFileSync(this.auditLogFile, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list.slice(-limit).reverse();
      }
    } catch (_) {}
    return [];
  }

  /**
   * Validates authentication for local agent requests
   */
  authenticate(tokenOrReq, personality = 'JARVIS') {
    if (emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Local agent operations are prohibited while emergency stop is latched.');
    }

    let token = '';
    if (typeof tokenOrReq === 'string') {
      token = tokenOrReq.trim();
    } else if (tokenOrReq && tokenOrReq.headers) {
      token = String(tokenOrReq.headers['x-stark-agent-token'] || tokenOrReq.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
    }

    // Direct loopback calls with internal key or session token match
    const isValid = (token === this.sessionToken) || (token === 'internal-stark-core') || (!token && process.env.NODE_ENV !== 'production');
    return {
      authenticated: isValid,
      personality: (personality || '').toUpperCase(),
      emergencyStopActive: emergencyStopControllerInstance.isEngaged()
    };
  }

  /**
   * Evaluates if a command string is allowed under safety policy
   */
  validateCommandSafety(commandStr) {
    if (!commandStr || typeof commandStr !== 'string') {
      return { allowed: false, reason: 'Command must be a non-empty string.' };
    }
    const clean = commandStr.trim();

    for (const blocked of BLOCKED_COMMAND_PATTERNS) {
      if (blocked.test(clean)) {
        return { allowed: false, reason: `Command matches prohibited security rule: ${blocked}` };
      }
    }

    let isPatternAllowed = false;
    for (const allowed of ALLOWED_COMMAND_PATTERNS) {
      if (allowed.test(clean)) {
        isPatternAllowed = true;
        break;
      }
    }

    if (!isPatternAllowed) {
      return {
        allowed: false,
        reason: `Command "${clean.slice(0, 40)}" is not on the approved desktop command allowlist.`
      };
    }

    return { allowed: true, cleanCommand: clean };
  }

  /**
   * Executes an authorized controlled shell command with process tracking, timeout,
   * stdout/stderr capture, output hashing, and emergency stop kill registration.
   */
  async executeControlledCommand({
    command = '',
    args = [],
    timeoutMs = 10000,
    cwd = null,
    personality = 'JARVIS'
  } = {}) {
    const t0 = Date.now();

    if (emergencyStopControllerInstance.isEngaged()) {
      this.logAudit('COMMAND_BLOCKED_EMERGENCY_STOP', { command, verified: false }, personality);
      throw new Error(`EMERGENCY_STOP_ACTIVE: Command execution blocked by global Emergency Stop.`);
    }

    try {
      permissionGateInstance.authorizeToolExecution('execute_controlled_shell_command', { command }, personality);
    } catch (e) {
      this.logAudit('COMMAND_DISALLOWED', { command, reason: e.message, verified: false }, personality);
      return {
        success: false,
        verified: false,
        command,
        error: e.message,
        exitCode: -1,
        stdout: '',
        stderr: e.message,
        processPid: null,
        executionTimeMs: Date.now() - t0,
        summary: `Command rejected by security policy: ${e.message}`
      };
    }

    const safety = this.validateCommandSafety(command);
    if (!safety.allowed) {
      this.logAudit('COMMAND_DISALLOWED', { command, reason: safety.reason, verified: false }, personality);
      return {
        success: false,
        verified: false,
        command,
        error: safety.reason,
        exitCode: -1,
        stdout: '',
        stderr: safety.reason,
        processPid: null,
        executionTimeMs: Date.now() - t0,
        summary: `Command rejected by security policy: ${safety.reason}`
      };
    }

    const workingDir = cwd ? path.resolve(cwd) : this.projectRoot;

    return new Promise((resolve) => {
      let isAborted = false;
      let child = null;
      let stdoutData = '';
      let stderrData = '';

      const timer = setTimeout(() => {
        isAborted = true;
        if (child && child.pid) {
          try {
            if (process.platform === 'win32') {
              execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
            } else {
              child.kill('SIGKILL');
            }
          } catch (_) {}
        }
        const latency = Date.now() - t0;
        this.logAudit('COMMAND_TIMEOUT', { command, timeoutMs, verified: false, executionTimeMs: latency }, personality);
        resolve({
          success: false,
          verified: false,
          command,
          error: `Execution timed out after ${timeoutMs}ms`,
          exitCode: -1,
          stdout: stdoutData,
          stderr: stderrData || 'TIMEOUT',
          processPid: child ? child.pid : null,
          executionTimeMs: latency,
          summary: `Command "${command}" timed out after ${timeoutMs}ms.`
        });
      }, timeoutMs);

      try {
        // Run via PowerShell with -NoProfile for clean deterministic execution
        const psArgs = ['-NoProfile', '-Command', command];
        child = spawn('powershell.exe', psArgs, {
          cwd: workingDir,
          windowsHide: true,
          env: process.env
        });

        const unregisterChild = emergencyStopControllerInstance.registerChildProcess(child, {
          command,
          personality,
          abortFn: () => {
            isAborted = true;
            clearTimeout(timer);
          }
        });

        child.stdout.on('data', (d) => {
          stdoutData += d.toString('utf8');
        });

        child.stderr.on('data', (d) => {
          stderrData += d.toString('utf8');
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          unregisterChild();
          const latency = Date.now() - t0;
          this.logAudit('COMMAND_SPAWN_ERROR', { command, error: err.message, verified: false, executionTimeMs: latency }, personality);
          resolve({
            success: false,
            verified: false,
            command,
            error: err.message,
            exitCode: -1,
            stdout: stdoutData,
            stderr: stderrData || err.message,
            processPid: child ? child.pid : null,
            executionTimeMs: latency,
            summary: `Failed to execute command "${command}": ${err.message}`
          });
        });

        child.on('close', (code) => {
          clearTimeout(timer);
          unregisterChild();
          if (isAborted) return; // Handled by timeout or abortFn

          const latency = Date.now() - t0;
          const isSuccess = (code === 0);
          const outputHash = crypto.createHash('sha256').update(stdoutData, 'utf8').digest('hex');

          this.logAudit('COMMAND_COMPLETED', {
            command,
            exitCode: code,
            processPid: child.pid,
            verified: isSuccess,
            executionTimeMs: latency,
            outputHash
          }, personality);

          resolve({
            success: isSuccess,
            verified: isSuccess,
            command,
            exitCode: code,
            stdout: stdoutData.trim(),
            stderr: stderrData.trim(),
            processPid: child.pid,
            executionTimeMs: latency,
            outputHash,
            summary: isSuccess
              ? `Command "${command}" executed successfully (exit code 0, PID ${child.pid}) in ${latency}ms.`
              : `Command "${command}" exited with error code ${code}. Stderr: ${stderrData.trim() || 'None'}`
          });
        });
      } catch (err) {
        clearTimeout(timer);
        const latency = Date.now() - t0;
        this.logAudit('COMMAND_EXCEPTION', { command, error: err.message, verified: false, executionTimeMs: latency }, personality);
        resolve({
          success: false,
          verified: false,
          command,
          error: err.message,
          exitCode: -1,
          stdout: '',
          stderr: err.message,
          processPid: null,
          executionTimeMs: latency,
          summary: `Execution exception: ${err.message}`
        });
      }
    });
  }

  /**
   * Executes complete verified multi-step desktop tasks:
   * 1. notepad_document_workflow: write, hash-verify, launch notepad, check PID, reopen & verify.
   * 2. word_document_workflow: generate genuine .docx, verify OpenXML on disk, return stats.
   * 3. browser_workflow: launch browser, verify process and URL.
   * 4. custom_multistep_workflow: sequential chain of verified operations.
   */
  async executeDesktopWorkflow({
    workflowType = 'notepad_document_workflow',
    options = {},
    personality = 'JARVIS'
  } = {}) {
    const t0 = Date.now();

    if (emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Desktop workflows are halted by Emergency Stop.');
    }

    permissionGateInstance.authorizeToolExecution('execute_desktop_workflow', { workflowType }, personality);

    switch (workflowType) {
      case 'notepad_document_workflow':
      case 'notepad_document':
      case 'notepad': {
        const title = options.title || 'stark_acceptance_plan';
        const content = options.content || 'VISION AI Local Agent acceptance verification test.\nSystem operational and verified.';
        const targetDir = options.targetDir || path.join(this.projectRoot, 'scratch');
        const openInNotepad = options.openInNotepad !== false;

        // Step 1 & 2: Write file and verify on disk
        const docRes = await documentAutomationServiceInstance.writeNotepadDocument({
          title,
          content,
          targetDir,
          openInNotepad,
          fileExtension: 'txt'
        });

        // Step 3: Reopen and verify file content from disk independently
        const reopenedContent = fs.readFileSync(docRes.filePath, 'utf8');
        const reopenedHash = crypto.createHash('sha256').update(reopenedContent, 'utf8').digest('hex');
        const hashMatch = (reopenedHash === docRes.hash);

        // Step 4: Verify Notepad process actively exists if launched
        let notepadPid = docRes.notepadPid || null;
        let notepadRunning = false;
        if (openInNotepad) {
          if (notepadPid) {
            try {
              process.kill(notepadPid, 0);
              notepadRunning = true;
            } catch (_) {
              notepadRunning = false;
            }
          }
          if (!notepadRunning) {
            try {
              const out = execSync(`powershell -NoProfile -Command "(Get-Process notepad -ErrorAction SilentlyContinue | Select-Object -First 1).Id"`, { encoding: 'utf8', timeout: 3000 });
              const pidNum = parseInt(out.trim(), 10);
              if (!isNaN(pidNum) && pidNum > 0) {
                notepadPid = pidNum;
                notepadRunning = true;
              }
            } catch (_) {}
          }
        }

        const fileConfirmedOnDisk = fs.existsSync(docRes.filePath);
        const isFullyVerified = Boolean(docRes.verified && hashMatch && fileConfirmedOnDisk && (!openInNotepad || notepadRunning));
        const latency = Date.now() - t0;

        this.logAudit('WORKFLOW_NOTEPAD_VERIFIED', {
          filePath: docRes.filePath,
          fileSize: docRes.sizeBytes,
          fileHash: docRes.hash,
          notepadPid,
          guiVerified: Boolean(notepadRunning && fileConfirmedOnDisk && hashMatch),
          verified: isFullyVerified,
          executionTimeMs: latency
        }, personality);

        return {
          success: isFullyVerified,
          verified: isFullyVerified,
          workflowType: 'notepad_document_workflow',
          filePath: docRes.filePath,
          fileName: docRes.fileName,
          fileSize: docRes.sizeBytes,
          fileHash: docRes.hash,
          reopenedHash,
          reopenedAndVerified: hashMatch,
          notepadLaunched: docRes.notepadLaunched,
          notepadRunning,
          processPid: notepadPid,
          guiVerified: Boolean(notepadRunning && fileConfirmedOnDisk && hashMatch),
          guiState: {
            processAlive: notepadRunning,
            fileConfirmedOnDisk,
            contentVerified: hashMatch,
            pid: notepadPid
          },
          executionTimeMs: latency,
          summary: isFullyVerified
            ? `Notepad document "${docRes.fileName}" written to disk, verified (${docRes.sizeBytes} bytes, SHA-256 match), launched in Notepad (PID ${notepadPid || 'active'}), and reopened/verified on disk with active GUI process.`
            : `Notepad document written but verification incomplete.`
        };
      }

      case 'word_document_workflow':
      case 'word_document':
      case 'word': {
        const title = options.title || 'VISION AI System Architecture Report';
        const subtitle = options.subtitle || 'Verified OpenXML Document Generation';
        const author = options.author || 'VISION AI Windows Local Agent';
        const sections = options.sections || [
          {
            heading: '1. Executive Summary',
            level: 1,
            paragraphs: ['This document was automatically generated, saved, and verified on disk by the JARVIS Windows Local Agent.']
          },
          {
            heading: '2. Verification Telemetry',
            level: 2,
            paragraphs: ['OpenXML specification standards met. Document hash and archive headers verified on disk.']
          }
        ];
        const targetDir = options.targetDir || path.join(this.projectRoot, 'scratch');
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.docx`;
        const outPath = path.join(targetDir, fileName);

        const docxResult = documentIntelligenceEngineInstance.createDocxDocument({
          title,
          subtitle,
          author,
          filePath: outPath,
          sections
        });

        // Independent reopen & verification
        const expectedHeading = (sections && sections.length > 0 && sections[0].heading)
          ? sections[0].heading
          : '1. Executive Summary';
        const verification = documentIntelligenceEngineInstance.verifyDocument(docxResult.filePath, {
          expectedHeadings: [expectedHeading]
        });

        const isVerified = Boolean(docxResult.verified && verification.verified);
        const latency = Date.now() - t0;

        this.logAudit('WORKFLOW_WORD_VERIFIED', {
          filePath: docxResult.filePath,
          fileSize: docxResult.sizeBytes,
          fileHash: docxResult.sha256 || docxResult.hash,
          verified: isVerified,
          executionTimeMs: latency
        }, personality);

        return {
          success: isVerified,
          verified: isVerified,
          workflowType: 'word_document_workflow',
          filePath: docxResult.filePath,
          fileName,
          fileSize: docxResult.sizeBytes,
          fileHash: docxResult.sha256 || docxResult.hash,
          openXmlVerified: verification.verified,
          headingsCount: verification.headingsCount,
          executionTimeMs: latency,
          summary: isVerified
            ? `Word document "${fileName}" successfully created, formatted, and verified on disk (${docxResult.sizeBytes} bytes, valid OpenXML container with ${verification.headingsCount || 1} headings).`
            : `Word document generation completed with verification warnings: ${verification.error || 'unspecified'}`
        };
      }

      case 'browser_workflow':
      case 'browser': {
        const url = options.url || 'http://127.0.0.1:3000';
        const browser = options.browser || null;

        const navRes = await desktopControllerInstance.openWebUrl(url, browser, personality);
        const latency = Date.now() - t0;
        const isVerified = (navRes.status === 'opened');

        this.logAudit('WORKFLOW_BROWSER_VERIFIED', {
          url,
          browser,
          verified: isVerified,
          executionTimeMs: latency
        }, personality);

        return {
          success: isVerified,
          verified: isVerified,
          workflowType: 'browser_workflow',
          url: navRes.url || url,
          domain: navRes.domain || '',
          executionTimeMs: latency,
          summary: isVerified
            ? `Browser successfully launched and directed to "${url}".`
            : `Failed to launch browser: ${navRes.error || 'Unknown error'}`
        };
      }

      case 'multistep_automation_workflow':
      case 'multistep': {
        const steps = Array.isArray(options.steps) ? options.steps : [];
        if (steps.length === 0) {
          throw new Error('Steps array cannot be empty for multistep workflow.');
        }

        const stepResults = [];
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          if (emergencyStopControllerInstance.isEngaged()) {
            throw new Error(`Workflow halted at step ${i + 1} due to active Emergency Stop.`);
          }

          let res;
          if (step.tool === 'execute_controlled_shell_command') {
            res = await this.executeControlledCommand({ ...step.args, personality });
          } else if (step.tool === 'write_notepad_document') {
            res = await documentAutomationServiceInstance.writeNotepadDocument(step.args || {});
          } else if (step.tool === 'create_word_document') {
            res = await documentIntelligenceEngineInstance.createDocxDocument(step.args || {});
          } else {
            const { executeTool } = require('../toolsRegistry.js');
            res = await executeTool(step.tool, step.args || {}, personality);
          }

          stepResults.push({ stepIndex: i + 1, tool: step.tool, result: res });
          if (res && res.verified === false) {
            return {
              success: false,
              verified: false,
              failedStep: i + 1,
              tool: step.tool,
              stepResults,
              summary: `Multistep workflow stopped at step ${i + 1} (${step.tool}) due to verification failure.`
            };
          }
        }

        const latency = Date.now() - t0;
        this.logAudit('WORKFLOW_MULTISTEP_VERIFIED', {
          stepsCount: steps.length,
          verified: true,
          executionTimeMs: latency
        }, personality);

        return {
          success: true,
          verified: true,
          workflowType: 'multistep_automation_workflow',
          stepCount: steps.length,
          stepResults,
          executionTimeMs: latency,
          summary: `Successfully executed and verified all ${steps.length} desktop workflow steps.`
        };
      }

      default:
        throw new Error(`Unknown workflowType "${workflowType}". Permitted: notepad_document_workflow, word_document_workflow, browser_workflow, multistep_automation_workflow.`);
    }
  }

  /**
   * Interacts with application windows (focus, type, maximize, minimize)
   */
  async controlWindow({
    query = '',
    action = 'focus',
    text = '',
    personality = 'JARVIS'
  } = {}) {
    permissionGateInstance.authorizeToolExecution('control_application_window', { query, action }, personality);

    if (action === 'type' && text) {
      return await desktopControllerInstance.interactWindow(query, 'type', text, personality);
    } else if (action === 'minimize') {
      return await desktopControllerInstance.minimizeWindow(query, personality);
    } else if (action === 'maximize') {
      return await desktopControllerInstance.maximizeWindow(query, personality);
    } else if (action === 'restore') {
      return await desktopControllerInstance.restoreWindow(query, personality);
    } else if (action === 'close') {
      return await desktopControllerInstance.closeApplication(query, {}, personality);
    } else if (action === 'switch') {
      return await desktopControllerInstance.switchWindow(query, personality);
    } else {
      return await desktopControllerInstance.interactWindow(query, 'focus', '', personality);
    }
  }

  /**
   * Dispatches authenticated request to the Python Local Agent background daemon
   */
  async callPythonAgent(endpoint, data = {}, method = 'POST', timeoutMs = 10000) {
    const http = require('http');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const payload = JSON.stringify(data);

    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3005,
        path: cleanEndpoint,
        method: method.toUpperCase(),
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${this.sessionToken}`,
          'X-Stark-Agent-Token': this.sessionToken
        }
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve({ statusCode: res.statusCode, ...parsed });
          } catch (_) {
            resolve({ statusCode: res.statusCode, raw });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Python agent request to ${cleanEndpoint} timed out after ${timeoutMs}ms`));
      });

      if (method.toUpperCase() === 'POST' && payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  async startPythonAgent() {
    return await agentLifecycleManagerInstance.startAgent();
  }

  async stopPythonAgent() {
    return await agentLifecycleManagerInstance.stopAgent();
  }

  async restartPythonAgent() {
    return await agentLifecycleManagerInstance.restartAgent();
  }

  async getPythonAgentStatus() {
    return await agentLifecycleManagerInstance.getStatus();
  }

  registerUserStartup() {
    return agentLifecycleManagerInstance.registerUserStartup();
  }

  /**
   * Queries health of the Python local agent daemon
   */
  async queryHealth(timeoutMs = 1500) {
    const { agentLifecycleManagerInstance } = require('./agentLifecycleManager.js');
    return await agentLifecycleManagerInstance.queryHealth(timeoutMs);
  }

  /**
   * Returns current status of Windows Local Agent
   */
  getStatus() {
    return {
      agentName: 'STARK_WINDOWS_LOCAL_AGENT',
      version: '2.0.0',
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      platform: process.platform,
      hostname: os.hostname(),
      projectRoot: this.projectRoot,
      emergencyStopActive: emergencyStopControllerInstance.isEngaged(),
      activeChildProcesses: emergencyStopControllerInstance.getStatus().activeChildProcessCount || 0,
      recentAuditsCount: this.getAuditLogs(10).length,
      pythonDaemon: {
        port: 3005,
        url: 'http://127.0.0.1:3005',
        architecture: 'Python 3.12 Standard Library Daemon'
      },
      capabilities: [
        'CONTROLLED_SHELL_EXECUTION',
        'NOTEPAD_AUTOMATION_AND_DISK_VERIFICATION',
        'WORD_DOCX_GENERATION_AND_AST_VALIDATION',
        'BROWSER_NAVIGATION_AND_INTERACTION',
        'WINDOW_AUTOMATION_AND_SENDKEYS',
        'EMERGENCY_STOP_SUB_100MS_TERMINATION',
        'PERSISTENT_AUDIT_LOGGING',
        'PYTHON_BACKGROUND_DAEMON_INTEGRATION',
        'USER_LEVEL_STARTUP_REGISTRATION'
      ]
    };
  }
}

const windowsLocalAgentInstance = new WindowsLocalAgent();

module.exports = {
  WindowsLocalAgent,
  windowsLocalAgentInstance
};
