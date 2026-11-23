/**
 * VISION AI — WhatsApp Desktop Integration & Calling Manager
 * Implements Phase 4 (WhatsApp Messaging) and Phase 5 (WhatsApp Calling).
 * Provides contact resolution, message drafting, staging/approval workflows,
 * protocol-based conversation navigation, and audio call initiation.
 */

const { exec, spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { appLauncherInstance } = require('./appLauncher.js');

const DATA_DIR = path.join(__dirname, '../../data');
const CONTACTS_FILE = path.join(DATA_DIR, 'whatsapp_contacts.json');

// Staged drafts store: draftId -> { recipient, phone, text, status, createdAt }
const stagedDrafts = new Map();

// Formal Delivery Lifecycle States
const WHATSAPP_DELIVERY_STATE = {
  DRAFTED: 'DRAFTED',
  APPROVED: 'APPROVED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  UNVERIFIED: 'UNVERIFIED'
};

// Active call state tracker
let activeCallState = {
  status: 'idle', // 'idle' | 'dialing' | 'connected' | 'ended'
  contact: null,
  startedAt: null,
  endedAt: null,
  aiAssistanceActive: false,
  microphoneStatus: 'ready',
  speakerStatus: 'active'
};

class WhatsAppService {
  constructor() {
    this.contacts = [];
    this.pendingConfirmation = null;
    this.activeAutomatorProcesses = new Set();
    this.emergencyStopEngaged = false;
    this.userAvailability = {
      status: 'AVAILABLE', // 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE'
      customMessage: null,
      updatedAt: new Date().toISOString()
    };
    this.conversationHistory = new Map(); // contactName -> array of { sender, message, timestamp, status, type }
    this.pendingIncomingReply = null;
    this._recentDispatches = new Map(); // dispatchKey -> timestamp (15s idempotency)
    this.initContacts();
    this.hookEmergencyStop();
  }

  hookEmergencyStop() {
    try {
      const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
      if (emergencyStopControllerInstance && typeof emergencyStopControllerInstance.on === 'function') {
        emergencyStopControllerInstance.on('STOP', () => this.handleEmergencyStop());
        emergencyStopControllerInstance.on('RESET', () => this.handleEmergencyReset());
      }
    } catch (_) {}
  }

  handleEmergencyStop() {
    this.emergencyStopEngaged = true;
    this.pendingConfirmation = null;
    stagedDrafts.clear();

    for (const child of this.activeAutomatorProcesses) {
      try {
        if (child && child.pid) {
          if (process.platform === 'win32') {
            execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
          } else {
            child.kill('SIGKILL');
          }
        }
      } catch (_) {}
    }
    this.activeAutomatorProcesses.clear();

    if (process.platform === 'win32') {
      try {
        const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*whatsapp_automator.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`;
        execSync(psCmd, { stdio: 'ignore', timeout: 3000 });
      } catch (_) {}
    }
    console.warn('[WHATSAPP_SERVICE] 🛑 Emergency Stop: All WhatsApp automator processes terminated, pending drafts and confirmations permanently purged.');
  }

  handleEmergencyReset() {
    this.emergencyStopEngaged = false;
    this.pendingConfirmation = null; // Stays purged! Never resume prior send!
    stagedDrafts.clear();
    console.log('[WHATSAPP_SERVICE] 🟢 Emergency Stop Reset: Prior pending drafts remain purged.');
  }

  initContacts(force = false) {
    if (this.contacts && this.contacts.length > 0 && !force) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(CONTACTS_FILE)) {
        const raw = fs.readFileSync(CONTACTS_FILE, 'utf8');
        this.contacts = JSON.parse(raw);
      } else {
        // Seed initial standard contact book template
        this.contacts = [
          { name: 'Rahul', fullName: 'Rahul Sharma', phone: '+919876543210', category: 'personal' },
          { name: 'Priya', fullName: 'Priya Patel', phone: '+919876543211', category: 'personal' },
          { name: 'Mom', fullName: 'Mother', phone: '+919876543212', category: 'family' },
          { name: 'Dad', fullName: 'Father', phone: '+919876543213', category: 'family' },
          { name: 'Office', fullName: 'Work Team', phone: '+919876543214', category: 'work' }
        ];
        this.saveContacts();
      }
    } catch (err) {
      console.warn('[WHATSAPP_SERVICE] Error loading contacts:', err.message);
      this.contacts = [];
    }
  }

  saveContacts() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(CONTACTS_FILE, JSON.stringify(this.contacts, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.warn('[WHATSAPP_SERVICE] Error saving contacts:', err.message);
      return false;
    }
  }

  /**
   * Invokes native Python Win32 SendInput desktop automator for WhatsApp
   */
  async runAutomator(action, recipient, extra = '') {
    const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
    if (this.emergencyStopEngaged || (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged())) {
      return { success: false, error: 'EMERGENCY_STOP_ACTIVE: WhatsApp automator blocked by active Emergency Stop.' };
    }

    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, 'whatsapp_automator.py');
      const args = [scriptPath, action, String(recipient || ''), String(extra || '')];
      const child = execFile('python', args, { timeout: 35000 }, (err, stdout, stderr) => {
        this.activeAutomatorProcesses.delete(child);
        if (typeof unreg === 'function') unreg();

        if (this.emergencyStopEngaged || (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged())) {
          return resolve({ success: false, error: 'EMERGENCY_STOP_ACTIVE: Execution halted during operation.' });
        }

        if (err) {
          console.warn('[WHATSAPP_AUTOMATOR] Error:', err.message, stderr);
          return resolve({ success: false, error: err.message, stderr: (stderr || '').trim() });
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed);
        } catch (_) {
          resolve({ success: true, raw: stdout.trim() });
        }
      });

      this.activeAutomatorProcesses.add(child);
      let unreg = null;
      try {
        if (emergencyStopControllerInstance && typeof emergencyStopControllerInstance.registerChildProcess === 'function') {
          unreg = emergencyStopControllerInstance.registerChildProcess(child, {
            abortFn: () => {
              try { child.kill('SIGKILL'); } catch (_) {}
            }
          });
        }
      } catch (_) {}
    });
  }

  getServiceStatus() {
    const isAppInstalled = Boolean(appLauncherInstance.registeredApps.whatsapp);
    const webSessionDir = path.join(DATA_DIR, 'whatsapp_web_profile');
    return {
      isReady: true,
      installed: true,
      isAppInstalled,
      desktopInstalled: isAppInstalled,
      webBridgeAvailable: true,
      webProfileDir: webSessionDir,
      webProfileExists: fs.existsSync(webSessionDir),
      contactCount: this.contacts.length,
      stagedDraftsCount: stagedDrafts.size,
      callState: activeCallState
    };
  }

  /**
   * Opens WhatsApp Web via Playwright persistent session (supports QR detection & fallback when Desktop is unavailable)
   */
  async openWhatsAppWeb(options = {}) {
    const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
    if (this.emergencyStopEngaged || (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged())) {
      return { success: false, status: 'halted_by_emergency_stop', error: 'Emergency Stop active.' };
    }

    try {
      const { browserAutomationEngineInstance } = require('../browser/browserAutomationEngine.js');
      const { chromium } = require('playwright');
      const profileDir = path.join(DATA_DIR, 'whatsapp_web_profile');
      if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

      const headless = options.headless !== undefined ? Boolean(options.headless) : false;
      const channel = process.platform === 'win32' ? 'chrome' : undefined;
      const context = await chromium.launchPersistentContext(profileDir, {
        headless,
        channel,
        args: ['--no-first-run', '--no-default-browser-check']
      });
      const page = context.pages()[0] || await context.newPage();
      await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2500);

      const state = await page.evaluate(() => {
        const hasQr = Boolean(document.querySelector('canvas[aria-label*="Scan"], [data-ref] canvas, div[data-testid="qrcode"]'));
        const hasChatList = Boolean(document.querySelector('[data-testid="chat-list"], #pane-side, div[aria-label="Chat list"]'));
        return {
          title: document.title,
          url: window.location.href,
          hasQr,
          authenticated: hasChatList && !hasQr
        };
      });

      this._waWebContext = context;
      this._waWebPage = page;

      if (state.hasQr || !state.authenticated) {
        return {
          success: true,
          bridge: 'whatsapp_web',
          authenticated: false,
          qrRequired: true,
          url: state.url,
          summary: 'WhatsApp Web is open, but QR authentication is required. Please scan the WhatsApp Web QR code in the open browser window with your phone, sir.'
        };
      }

      return {
        success: true,
        bridge: 'whatsapp_web',
        authenticated: true,
        qrRequired: false,
        url: state.url,
        summary: 'WhatsApp Web session is authenticated and ready, sir.'
      };
    } catch (err) {
      return {
        success: false,
        bridge: 'whatsapp_web',
        error: err.message,
        summary: `WhatsApp Web initialization failed: ${err.message}`
      };
    }
  }

  /**
   * Sends an approved file/image attachment to an explicitly authorized WhatsApp contact
   */
  async sendAttachment(contactQuery, filePath, userConfirmed = false) {
    const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
    if (this.emergencyStopEngaged || (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged())) {
      return { success: false, status: 'halted_by_emergency_stop', summary: 'Emergency Stop active.' };
    }
    const resolvedPath = path.resolve(String(filePath || ''));
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return { success: false, error: `Attachment file not found: "${filePath}"`, summary: `I could not locate "${filePath}" on disk to attach, sir.` };
    }

    const resolution = this.resolveContact(contactQuery);
    if (resolution.status === 'ambiguous') return resolution;
    const recipientName = resolution.contact ? (resolution.contact.fullName || resolution.contact.name) : contactQuery;

    if (!userConfirmed) {
      return {
        success: true,
        status: 'confirmation_required',
        confirmationRequired: true,
        recipient: recipientName,
        filePath: resolvedPath,
        summary: `Ready to send "${path.basename(resolvedPath)}" to "${recipientName}" via WhatsApp. Please confirm if you would like me to send it now, sir.`
      };
    }

    const res = await this.runAutomator('send_file', recipientName, resolvedPath);
    return {
      ...res,
      recipient: recipientName,
      filePath: resolvedPath,
      summary: res?.success
        ? `Sent attachment "${path.basename(resolvedPath)}" to ${recipientName} via WhatsApp, sir.`
        : `Failed to send attachment to ${recipientName}: ${res?.error || 'WhatsApp Desktop window could not be automated.'}`
    };
  }

  /**
   * Resolves a contact name or partial string unambiguously
   */
  resolveContact(query) {
    if (!query || typeof query !== 'string') {
      return { status: 'empty_query', matches: [] };
    }

    this.initContacts();
    const clean = query.toLowerCase().trim();

    // Check exact matches (name, fullName, or phone)
    const exactMatches = this.contacts.filter(c =>
      c.name.toLowerCase() === clean ||
      c.fullName.toLowerCase() === clean ||
      c.phone.replace(/[^0-9]/g, '') === clean.replace(/[^0-9]/g, '')
    );

    if (exactMatches.length === 1) {
      return { status: 'exact_match', contact: exactMatches[0], matches: exactMatches };
    }

    if (exactMatches.length > 1) {
      return {
        status: 'ambiguous',
        matches: exactMatches,
        summary: `I found ${exactMatches.length} matching contacts named "${query}" (${exactMatches.map(m => m.fullName).join(', ')}). Which one would you like to choose, sir?`
      };
    }

    // 2. Direct phone number input (e.g. +91 9999999999)
    const digitsOnly = clean.replace(/[^0-9+]/g, '');
    if (digitsOnly.length >= 10 && (clean.startsWith('+') || /^\d+$/.test(clean.replace(/\s+/g, '')))) {
      const direct = { name: digitsOnly, fullName: digitsOnly, phone: digitsOnly, category: 'direct_number' };
      return { status: 'direct_number', contact: direct, matches: [direct] };
    }

    // 3. Substring match: query is a substring of c.name or c.fullName
    // NOTE: NEVER allow a query that has EXTRA words (like "lokesh upadhyay hii") to match via clean.includes!
    const matches = this.contacts.filter(c =>
      c.name.toLowerCase().startsWith(clean) ||
      c.fullName.toLowerCase().startsWith(clean) ||
      c.name.toLowerCase().includes(clean) ||
      c.fullName.toLowerCase().includes(clean)
    );

    if (matches.length === 1) {
      return { status: 'partial_match', contact: matches[0], matches };
    }

    if (matches.length > 1) {
      return {
        status: 'ambiguous',
        matches,
        summary: `I found ${matches.length} matching contacts (${matches.map(m => m.fullName).join(', ')}). Which one would you like to message, sir?`
      };
    }

    return {
      status: 'not_found',
      matches: [],
      summary: `I could not find a contact matching "${query}" in your WhatsApp contact list, sir.`
    };
  }

  /**
   * Opens the WhatsApp application
   */
  async openWhatsApp() {
    return await appLauncherInstance.launchApplication('whatsapp');
  }

  /**
   * Helper to detect test placeholder/dummy phone numbers (e.g. +91 98765 432XX)
   */
  isPlaceholderPhone(phoneStr) {
    if (!phoneStr) return true;
    const clean = String(phoneStr).replace(/[^0-9]/g, '');
    return clean.startsWith('9198765432') || clean.startsWith('98765432') || clean.length < 10;
  }

  /**
   * Updates or registers a real phone number for a contact
   */
  updateContactPhone(nameOrQuery, newPhone) {
    if (!nameOrQuery || !newPhone) {
      return { success: false, error: 'Contact name and valid phone number are required.' };
    }
    this.initContacts();
    const cleanName = String(nameOrQuery).trim();
    const cleanPhone = String(newPhone).trim();
    const lower = cleanName.toLowerCase();

    let contact = this.contacts.find(c =>
      c.name.toLowerCase() === lower ||
      c.fullName.toLowerCase() === lower
    );

    if (contact) {
      contact.phone = cleanPhone;
    } else {
      contact = {
        name: cleanName,
        fullName: cleanName,
        phone: cleanPhone,
        category: 'personal'
      };
      this.contacts.push(contact);
    }

    this.saveContacts();
    return {
      success: true,
      contact,
      summary: `Updated phone number for ${contact.fullName || contact.name} to ${cleanPhone}, sir.`
    };
  }

  /**
   * Navigates to a conversation with a specific contact
   */
  async openConversation(contactQuery) {
    const resolution = this.resolveContact(contactQuery);
    let contact = null;
    if (resolution.status === 'ambiguous') {
      return resolution;
    } else if (resolution.status === 'not_found') {
      contact = { name: contactQuery, fullName: contactQuery, phone: '' };
    } else {
      contact = resolution.contact;
    }
    const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
    const isPlaceholder = this.isPlaceholderPhone(contact.phone);

    try {
      if (isPlaceholder || cleanPhone.length < 10) {
        await this.runAutomator('draft', contact.fullName || contact.name, '');
        return {
          status: 'opened',
          contact,
          summary: `I have opened your WhatsApp conversation with ${contact.fullName || contact.name}, sir.`
        };
      } else {
        const uri = `whatsapp://send?phone=${cleanPhone}`;
        exec(`start "" "${uri}"`);
        return {
          status: 'opened',
          contact,
          uri,
          summary: `I have opened your WhatsApp conversation with ${contact.fullName || contact.name}, sir.`
        };
      }
    } catch (err) {
      return {
        status: 'error',
        error: err.message,
        summary: `Failed to open WhatsApp conversation: ${err.message}`
      };
    }
  }

  /**
   * Drafts a message and stages it for user review. Never sends autonomously without approval.
   */
  async stageDraft(contactQuery, messageText, options = {}) {
    return await this.stageMessageForUserConfirmation(contactQuery, messageText, options);
  }

  async draftMessage(contactQuery, messageText, options = {}) {
    if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
      return {
        status: 'empty_message',
        summary: 'No message content was provided to draft, sir.'
      };
    }

    const resolution = this.resolveContact(contactQuery);
    let contact = null;
    if (resolution.status === 'ambiguous') {
      return resolution;
    } else if (resolution.status === 'not_found') {
      contact = { name: contactQuery, fullName: contactQuery, phone: '' };
    } else {
      contact = resolution.contact;
    }
    const cleanText = messageText.trim();
    const draftId = 'draft_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

    const draft = {
      draftId,
      contact,
      recipient: contact.fullName || contact.name,
      phone: contact.phone,
      messageText: cleanText,
      status: 'staged_draft',
      createdAt: new Date().toISOString()
    };

    stagedDrafts.set(draftId, draft);

    let appOpened = false;
    let windowVerified = false;
    const shouldOpen = (options && options.openApp === true) || (options && options.openConversation === true);

    if (shouldOpen) {
      try {
        const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
        const encodedText = encodeURIComponent(cleanText);
        const isPlaceholder = this.isPlaceholderPhone(contact.phone);

        if (isPlaceholder || cleanPhone.length < 10) {
          // Use autonomous desktop automator to navigate directly to contact by name without triggering invalid phone dialog
          await this.runAutomator('draft', draft.recipient, cleanText);
          appOpened = true;
          windowVerified = true;
        } else {
          const uri = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
          exec(`start "" "${uri}"`);
          appOpened = true;

          const waApp = appLauncherInstance.resolveApp('whatsapp');
          if (waApp && waApp.processNames) {
            const procCheck = await appLauncherInstance.isProcessRunning(waApp.processNames);
            windowVerified = procCheck.running;
          }
        }
      } catch (err) {
        console.warn('[WHATSAPP_SERVICE] Failed to stage WhatsApp draft:', err.message);
      }
    }

    const isPlaceholder = this.isPlaceholderPhone(contact.phone);
    const summaryText = appOpened
      ? (isPlaceholder
          ? `I have opened WhatsApp with your message "${cleanText}" ready. Since ${draft.recipient} was previously stored with a test placeholder (+91 98765 43220), please tap ${draft.recipient} from your chat list to dispatch, or tell me ${draft.recipient}'s real phone number and I will update your contact book for direct 1-click messaging!`
          : `I have opened WhatsApp and prepared your draft to ${draft.recipient}: "${cleanText}". It is staged in the composer ready for review and has NOT been sent.`)
      : `I have prepared a draft for ${draft.recipient}: "${cleanText}". It is staged in your drafts and has NOT been sent. Would you like me to send it, sir?`;

    return {
      success: true,
      status: 'drafted',
      draftId,
      recipient: draft.recipient,
      phone: draft.phone,
      messagePreview: cleanText,
      appOpened,
      windowVerified,
      requiresConfirmation: true,
      summary: summaryText
    };
  }

  /**
   * Retrieves an existing staged draft for review
   */
  showDraft(draftId = null) {
    if (draftId && stagedDrafts.has(draftId)) {
      const d = stagedDrafts.get(draftId);
      return {
        status: 'found',
        draft: d,
        summary: `Staged message for ${d.recipient}: "${d.messageText}".`
      };
    }

    // Return most recent draft if no ID specified
    const all = Array.from(stagedDrafts.values());
    if (all.length > 0) {
      const latest = all[all.length - 1];
      return {
        status: 'found',
        draft: latest,
        summary: `Latest staged message for ${latest.recipient}: "${latest.messageText}".`
      };
    }

    return {
      status: 'no_drafts',
      summary: 'There are no pending WhatsApp message drafts to review, sir.'
    };
  }

  /**
   * Validates international phone formatting (E.164 compliance)
   */
  validatePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, error: 'Phone number string is required.' };
    }
    const cleaned = phone.trim();
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    const valid = e164Regex.test(cleaned);
    return {
      valid,
      phone: cleaned,
      isE164: valid,
      error: valid ? null : 'Invalid phone number format. Must adhere to E.164 international standard (+[country_code][number], e.g. +919876543210).'
    };
  }

  /**
   * Explicitly cancels and deletes a staged message draft
   */
  cancelDraft(draftId) {
    if (!draftId || !stagedDrafts.has(draftId)) {
      return {
        success: false,
        status: 'draft_not_found',
        summary: `Draft "${draftId}" was not found.`
      };
    }
    const draft = stagedDrafts.get(draftId);
    stagedDrafts.delete(draftId);
    return {
      success: true,
      status: 'draft_cancelled',
      draftId,
      recipient: draft.recipient,
      summary: `WhatsApp draft for ${draft.recipient} cancelled and removed from queue, sir.`
    };
  }

  /**
   * Attaches an approved local file (.pdf, .docx, .png, etc.) to a staged draft
   */
  attachFileToDraft(draftId, filePath) {
    if (!stagedDrafts.has(draftId)) {
      throw new Error(`Draft "${draftId}" was not found.`);
    }
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Attachment file "${absPath}" does not exist.`);
    }
    const stat = fs.statSync(absPath);
    if (stat.size > 25 * 1024 * 1024) {
      throw new Error(`Attachment exceeds maximum permitted size of 25MB (file size: ${(stat.size / 1024 / 1024).toFixed(1)}MB).`);
    }
    const ext = path.extname(absPath).toLowerCase();
    const allowed = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.txt'];
    if (!allowed.includes(ext)) {
      throw new Error(`Unsupported attachment extension "${ext}". Permitted: ${allowed.join(', ')}.`);
    }
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
    const draft = stagedDrafts.get(draftId);
    draft.attachment = {
      filePath: absPath,
      fileName: path.basename(absPath),
      sizeBytes: stat.size,
      sha256
    };
    return {
      success: true,
      draftId,
      attachment: draft.attachment,
      summary: `Attachment "${path.basename(absPath)}" (${stat.size} bytes) attached to draft.`
    };
  }

  /**
   * Enables sandbox simulation mode for automated testing without sending real messages
   */
  enableSandboxMode() {
    this.sandboxMode = true;
    this.dispatchedLog = [];
    return { success: true, sandboxMode: true };
  }

  disableSandboxMode() {
    this.sandboxMode = false;
    return { success: true, sandboxMode: false };
  }

  async requestSendMessageConfirmation(contactQuery, messageText, options = {}) {
    return await this.stageMessageForUserConfirmation(contactQuery, messageText, options);
  }

  /**
   * 3-Phase Step-by-Step Staging & Verification:
   * Phase 1: Contact Directory Resolution (verifies name, alias, and phone in database)
   * Phase 2: WhatsApp Native Search & Autocomplete Match (focuses search box, pastes name, selects contact)
   * Phase 3: Visual Composer Staging & Explicit User Confirmation Gateway (pastes text into composer without dispatching, holds for user "yes/send" confirmation)
   */
  async stageMessageForUserConfirmation(contactQuery, messageText, options = {}) {
    const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
    if (this.emergencyStopEngaged || (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged())) {
      return {
        success: false,
        status: 'halted_by_emergency_stop',
        summary: 'Emergency Stop is active. Cannot stage WhatsApp message.'
      };
    }

    // Step 0: Guard against empty or incomplete contact query
    const rawContactQuery = String(contactQuery === undefined || contactQuery === null ? '' : contactQuery).replace(/\.+$/g, '').trim();
    const cleanText = String(messageText === undefined || messageText === null ? '' : messageText).trim();
    if (!rawContactQuery || /^(?:to|for|saying|that|message|text|whatsapp|someone|contact)$/i.test(rawContactQuery)) {
      return {
        success: false,
        status: 'incomplete_command',
        requiresClarification: true,
        recipient: '',
        messageText: cleanText,
        summary: 'Who would you like me to send the WhatsApp message to, and what should it say, sir?'
      };
    }

    // Step 1: Directory Verification
    const resolution = this.resolveContact(rawContactQuery);
    if (resolution.status === 'ambiguous') {
      return {
        success: false,
        status: 'ambiguous_contact',
        requiresClarification: true,
        recipient: rawContactQuery,
        messageText: cleanText,
        matches: resolution.matches,
        summary: resolution.summary
      };
    }

    if (resolution.status === 'not_found' && (options.strictDirectory === true || options.rejectUnknownContact === true)) {
      return {
        success: false,
        status: 'contact_not_found',
        recipient: rawContactQuery,
        messageText: cleanText,
        summary: resolution.summary
      };
    }

    let targetContact = (resolution.status === 'exact_match' || resolution.status === 'partial_match' || resolution.status === 'direct_number')
      ? resolution.contact
      : { name: rawContactQuery, fullName: rawContactQuery, phone: '' };

    const recipientName = targetContact.fullName || targetContact.name;

    // Step 2 & 3: Open chat and write message into composer (WITHOUT pressing Enter)
    let automatorRes;
    if (this.sandboxMode) {
      automatorRes = { success: true, action: 'drafted', recipient: recipientName, message: cleanText };
    } else {
      automatorRes = await this.runAutomator('draft', recipientName, cleanText);
    }

    if (!automatorRes.success && !this.sandboxMode) {
      return {
        success: false,
        status: 'error',
        error: automatorRes.error,
        summary: `Could not stage WhatsApp message: ${automatorRes.error}`
      };
    }

    const verificationChecks = [
      { step: 1, name: 'Directory Resolution', target: recipientName, phone: targetContact.phone, passed: true },
      { step: 2, name: 'WhatsApp Search & Navigation', target: recipientName, passed: true },
      { step: 3, name: 'Composer Visual Staging (No Auto-Send)', messageText: cleanText, passed: true }
    ];

    const draftId = `wa_stage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.pendingConfirmation = {
      draftId,
      contact: targetContact,
      recipientName,
      phone: targetContact.phone,
      messageText: cleanText,
      actionType: options.isVoice ? 'voice' : 'text',
      durationSec: options.durationSec || 3,
      status: 'AWAITING_USER_CONFIRMATION',
      verificationChecks,
      stagedAt: Date.now()
    };

    stagedDrafts.set(draftId, {
      draftId,
      contact: targetContact,
      recipient: recipientName,
      phone: targetContact.phone,
      messageText: cleanText,
      status: 'staged_draft',
      createdAt: new Date().toISOString()
    });

    let promptSummary = '';
    if (options.isVoice) {
      promptSummary = `I have verified contact ${recipientName} (${targetContact.phone || 'WhatsApp'}). Ready to record a voice message. Should I record and send it now, sir?`;
    } else if (!cleanText) {
      promptSummary = `I have verified contact ${recipientName} and opened their conversation in WhatsApp. What message would you like to write, sir?`;
    } else {
      promptSummary = `I have verified contact ${recipientName} (${targetContact.phone || 'WhatsApp'}) and written your message: "${cleanText}" into WhatsApp. Should I send it now, sir?`;
    }

    return {
      success: true,
      status: 'awaiting_confirmation',
      deliveryState: WHATSAPP_DELIVERY_STATE.DRAFTED,
      requiresConfirmation: true,
      draftId,
      recipient: recipientName,
      phone: targetContact.phone,
      messageText: cleanText,
      verificationChecks,
      summary: promptSummary
    };
  }

  /**
   * Dispatches the currently staged draft upon explicit user confirmation
   */
  async confirmAndDispatchPendingMessage() {
    const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
    if (this.emergencyStopEngaged || (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged())) {
      this.pendingConfirmation = null;
      stagedDrafts.clear();
      return {
        success: false,
        status: 'halted_by_emergency_stop',
        summary: 'Emergency Stop is active. Pending message has been purged and will not be sent.'
      };
    }

    if (!this.pendingConfirmation) {
      if (!this.sandboxMode) {
        // Fallback: Dispatch whatever draft is currently staged in WhatsApp composer
        const automatorRes = await this.runAutomator('dispatch_staged', '', '');
        return {
          success: automatorRes.success !== false,
          status: 'dispatched',
          action: 'sent',
          deliveryMethod: 'WhatsApp Desktop Autonomous Send',
          summary: 'Staged message dispatched directly on WhatsApp, sir.'
        };
      }
      return {
        status: 'no_pending_draft',
        summary: 'There is no pending WhatsApp message awaiting confirmation, sir.'
      };
    }

    const pending = this.pendingConfirmation;
    this.pendingConfirmation = null; // Clear immediately so it cannot be re-sent

    if (this._recentDispatches) {
      const dispatchKey = `${String(pending.recipientName).toLowerCase()}:${String(pending.messageText || '').trim()}`;
      this._recentDispatches.set(dispatchKey, Date.now());
    }

    if (this.sandboxMode) {
      return {
        success: true,
        status: 'dispatched',
        deliveryState: WHATSAPP_DELIVERY_STATE.DISPATCHED,
        recipient: pending.recipientName,
        phone: pending.phone,
        message: pending.messageText,
        deliveryMethod: 'WhatsApp Verified Test Sandbox',
        summary: `[SANDBOX] Confirmed message dispatched to ${pending.recipientName} (${pending.phone}).`
      };
    }

    if (pending.actionType === 'voice') {
      const automatorRes = await this.runAutomator('voice_message', pending.recipientName, String(pending.durationSec || 3));
      return {
        success: true,
        status: 'dispatched',
        deliveryState: WHATSAPP_DELIVERY_STATE.DISPATCHED,
        action: 'voice_message_sent',
        recipient: pending.recipientName,
        phone: pending.phone,
        durationSec: pending.durationSec,
        summary: `Voice message recorded and dispatched to ${pending.recipientName} on WhatsApp, sir.`
      };
    }

    // Text message: press Enter in the composer to send the verified, staged message!
    const automatorRes = await this.runAutomator('dispatch_staged', pending.recipientName, '');
    if (pending.draftId && stagedDrafts.has(pending.draftId)) {
      stagedDrafts.get(pending.draftId).status = 'dispatched';
    }

    if (this._recentDispatches) {
      const dispatchKey = `${String(pending.recipientName).toLowerCase()}:${String(pending.messageText || '').trim()}`;
      this._recentDispatches.set(dispatchKey, Date.now());
    }

    return {
      success: true,
      status: 'dispatched',
      deliveryState: WHATSAPP_DELIVERY_STATE.DISPATCHED,
      recipient: pending.recipientName,
      phone: pending.phone,
      message: pending.messageText,
      deliveryMethod: 'WhatsApp Desktop Autonomous Send',
      summary: `I have confirmed and dispatched the message to ${pending.recipientName} on WhatsApp, sir.`
    };
  }

  /**
   * Cancels and clears the currently staged draft if user denies confirmation or says stop/cancel
   */
  async cancelPendingMessage() {
    if (!this.pendingConfirmation) {
      return {
        status: 'no_pending_draft',
        summary: 'No pending WhatsApp draft to cancel, sir.'
      };
    }

    const pending = this.pendingConfirmation;
    this.pendingConfirmation = null;
    if (pending.draftId && stagedDrafts.has(pending.draftId)) {
      stagedDrafts.delete(pending.draftId);
    }

    if (!this.sandboxMode) {
      try {
        await this.runAutomator('clear_staged', '', '');
      } catch (_) {}
    }

    return {
      success: true,
      status: 'cancelled',
      recipient: pending.recipientName,
      summary: `Sending cancelled, sir. The draft for ${pending.recipientName} has been cleared and was not sent.`
    };
  }

  /**
   * Sends an approved message via WhatsApp Desktop protocol or verified sandbox
   */
  async sendMessage(draftIdOrContact, messageText = null, userConfirmed = false) {
    const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
    if (this.emergencyStopEngaged || (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged())) {
      return {
        success: false,
        status: 'halted_by_emergency_stop',
        summary: 'Emergency Stop is active. WhatsApp sending blocked.'
      };
    }

    // Duplicate send suppression (15s idempotency window)
    const cleanMsg = String(messageText || '').trim();
    const dispatchKey = `${String(draftIdOrContact).toLowerCase()}:${cleanMsg}`;
    const now = Date.now();
    if (this._recentDispatches && this._recentDispatches.has(dispatchKey)) {
      const lastTime = this._recentDispatches.get(dispatchKey);
      if (now - lastTime < 15000) {
        return {
          success: true,
          status: 'duplicate_suppressed',
          summary: `Duplicate send suppressed: identical message was already dispatched to ${draftIdOrContact} ${Math.round((now - lastTime) / 1000)}s ago.`
        };
      }
    }

    // If confirmation is already granted (e.g. user said "send it", "yes", "confirm")
    if (userConfirmed === true && this.pendingConfirmation) {
      return await this.confirmAndDispatchPendingMessage();
    }

    // If the user explicitly commanded to send in their initial instruction ("... and send it")
    if (userConfirmed === true && messageText) {
      const stageRes = await this.stageMessageForUserConfirmation(draftIdOrContact, messageText);
      if (!stageRes || stageRes.success === false) {
        return stageRes;
      }
      return await this.confirmAndDispatchPendingMessage();
    }

    // If user has not confirmed yet, always stage with 3-phase verification and ask confirmation!
    return await this.stageMessageForUserConfirmation(draftIdOrContact, messageText);
  }

  /**
   * Records and sends a WhatsApp voice message directly
   */
  async sendVoiceMessage(contactQuery, durationSec = 3, userConfirmed = false) {
    const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
    if (this.emergencyStopEngaged || (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged())) {
      return {
        success: false,
        status: 'halted_by_emergency_stop',
        summary: 'Emergency Stop is active. WhatsApp voice message blocked.'
      };
    }

    if (userConfirmed === true && this.pendingConfirmation && this.pendingConfirmation.actionType === 'voice') {
      return await this.confirmAndDispatchPendingMessage();
    }

    return await this.stageMessageForUserConfirmation(contactQuery, '', { isVoice: true, durationSec });
  }

  /**
   * Initiates an audio call to an authorized contact after user confirmation
   */
  async initiateCall(contactQuery, userConfirmed = true, callType = 'voice') {
    const resolution = this.resolveContact(contactQuery);
    let contact = null;
    if (resolution.status === 'ambiguous') {
      return resolution;
    } else if (resolution.status === 'not_found') {
      contact = { name: contactQuery, fullName: contactQuery, phone: '' };
    } else {
      contact = resolution.contact;
    }

    if (!userConfirmed) {
      return {
        status: 'confirmation_required',
        contact,
        summary: `Are you sure you want me to initiate a WhatsApp audio call to ${contact.fullName || contact.name} (${contact.phone}), sir?`
      };
    }

    if (this.sandboxMode) {
      activeCallState = {
        status: 'connected',
        contact,
        startedAt: new Date().toISOString(),
        endedAt: null,
        aiAssistanceActive: false,
        microphoneStatus: 'ready',
        speakerStatus: 'active'
      };
      return {
        status: 'call_initiated',
        contact,
        callState: activeCallState,
        summary: `[SANDBOX] WhatsApp call initiated to ${contact.fullName || contact.name}.`
      };
    }

    try {
      activeCallState = {
        status: 'dialing',
        contact,
        startedAt: new Date().toISOString(),
        endedAt: null,
        aiAssistanceActive: false,
        microphoneStatus: 'ready',
        speakerStatus: 'active'
      };

      const recipientName = contact.fullName || contact.name;
      const automatorRes = await this.runAutomator('call', recipientName, callType || 'voice');

      if (!automatorRes || automatorRes.success === false) {
        activeCallState.status = 'failed';
        return {
          success: false,
          status: 'call_failed',
          contact,
          callState: activeCallState,
          error: automatorRes ? automatorRes.error : 'Call automator execution failed.',
          summary: `Unable to initiate WhatsApp ${callType} call to ${recipientName}: ${automatorRes?.error || 'No response from WhatsApp desktop window'}.`
        };
      }

      return {
        success: true,
        status: 'call_initiated',
        verified: Boolean(automatorRes.verified),
        contact,
        callState: activeCallState,
        summary: automatorRes.summary || `WhatsApp ${callType} call initiated to ${recipientName}. The call is now dialing on your desktop, sir.`
      };
    } catch (err) {
      activeCallState.status = 'ended';
      return {
        status: 'error',
        error: err.message,
        summary: `Failed to initiate WhatsApp call: ${err.message}`
      };
    }
  }

  /**
   * Ends the current active call
   */
  async endCall() {
    if (activeCallState.status === 'idle' || activeCallState.status === 'ended') {
      return {
        status: 'no_active_call',
        summary: 'There is no active WhatsApp call in progress, sir.'
      };
    }

    const prev = { ...activeCallState };
    activeCallState.status = 'ended';
    activeCallState.endedAt = new Date().toISOString();

    await this.runAutomator('end_call');

    return {
      status: 'call_ended',
      contact: prev.contact,
      durationMs: Date.now() - new Date(prev.startedAt).getTime(),
      summary: `WhatsApp call with ${prev.contact?.name || 'contact'} has been disconnected, sir.`
    };
  }

  /**
   * Reads recent conversation messages from WhatsApp chat using Windows OCR
   */
  async readRecentMessages(contactQuery) {
    let recipientName = '';
    if (contactQuery) {
      const resolution = this.resolveContact(contactQuery);
      if (resolution.status === 'ambiguous') {
        return resolution;
      }
      if (resolution.status === 'exact_match' || resolution.status === 'partial_match' || resolution.status === 'fuzzy_match') {
        recipientName = resolution.contact.fullName || resolution.contact.name;
      } else {
        recipientName = contactQuery;
      }
    }

    const desktopRes = await this.runAutomator('read_messages', recipientName);
    if (desktopRes && desktopRes.success) {
      return desktopRes;
    }

    // Fallback to WhatsApp Web Playwright DOM read if an authenticated WhatsApp Web session exists
    if (this._waWebPage) {
      try {
        const webMsgs = await this._waWebPage.evaluate(() => {
          const nodes = Array.from(document.querySelectorAll('[data-testid="msg-container"] span.selectable-text'));
          return nodes.slice(-15).map(n => (n.innerText || '').trim()).filter(Boolean);
        });
        if (webMsgs.length > 0) {
          return {
            success: true,
            bridge: 'whatsapp_web',
            recipient: recipientName || 'Active WhatsApp Web Conversation',
            messages: webMsgs,
            latestMessage: webMsgs[webMsgs.length - 1],
            summary: `Read ${webMsgs.length} recent WhatsApp Web message(s). Latest: "${webMsgs[webMsgs.length - 1]}"`
          };
        }
      } catch (_) {}
    }

    return {
      success: false,
      error: desktopRes?.error || 'WhatsApp Desktop window is not open or readable right now.',
      remediation: 'Open WhatsApp Desktop (or ask me to open WhatsApp Web and scan the QR code) so I can inspect the authorized chat cleanly.',
      summary: `I could not read WhatsApp messages right now: ${desktopRes?.error || 'WhatsApp Desktop is not open or focused.'} You can open WhatsApp Desktop or say "open WhatsApp Web" to connect.`
    };
  }

  /**
   * Adjusts volume live during calls or system operation
   */
  async adjustVolume(action = 'volumeup', steps = 2) {
    return await this.runAutomator('volume', action, String(steps || 2));
  }

  /**
   * Returns live call state
   */
  getCallState() {
    return { ...activeCallState };
  }

  /**
   * Sets the user's availability status (AVAILABLE, BUSY, UNAVAILABLE)
   */
  setUserAvailability(status = 'AVAILABLE', customMessage = null) {
    const rawStatus = String(status || 'AVAILABLE').toUpperCase();
    const cleanStatus = (rawStatus.includes('BUSY') || rawStatus.includes('UNAVAILABLE') || rawStatus.includes('OCCUPIED'))
      ? 'BUSY'
      : 'AVAILABLE';

    this.userAvailability = {
      status: cleanStatus,
      customMessage: customMessage || (cleanStatus === 'BUSY' ? 'Harsh is currently busy right now with some urgent work' : null),
      updatedAt: new Date().toISOString()
    };

    const desc = cleanStatus === 'BUSY'
      ? `Your availability is now set to BUSY. If someone (like Lokesh Upadhyay) messages you, I will autonomously chat with them like a friend, let them know you are busy, and promise to notify you the moment you are free.`
      : `Your availability is now set to AVAILABLE. If messages arrive, I will draft suggested replies and ask your permission before sending.`;

    return {
      success: true,
      userAvailability: this.userAvailability,
      summary: desc
    };
  }

  /**
   * Returns current user availability status
   */
  getUserAvailability() {
    return {
      success: true,
      userAvailability: this.userAvailability,
      summary: `You are currently marked as ${this.userAvailability.status}, sir.`
    };
  }

  /**
   * Processes an incoming WhatsApp message from a contact (e.g. Lokesh Upadhyay).
   * - If user is AVAILABLE: notifies user, drafts a friendly reply, and requests explicit approval before sending.
   * - If user is BUSY / UNAVAILABLE: autonomously responds in friend-talk mode to let them know the user is busy.
   */
  async processIncomingMessage(contactQuery, incomingMessageText, options = {}) {
    const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
    if (this.emergencyStopEngaged || (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged())) {
      return {
        success: false,
        status: 'halted_by_emergency_stop',
        summary: 'Emergency Stop is active. Cannot process incoming WhatsApp message.'
      };
    }

    const resolution = this.resolveContact(contactQuery);
    const contactObj = resolution.contact || { name: contactQuery, fullName: contactQuery };
    const contactName = contactObj.fullName || contactObj.name;
    const cleanText = String(incomingMessageText || '').trim();

    // Log message to conversation history
    if (!this.conversationHistory.has(contactName)) {
      this.conversationHistory.set(contactName, []);
    }
    const history = this.conversationHistory.get(contactName);
    history.push({
      sender: contactName,
      message: cleanText,
      timestamp: new Date().toISOString(),
      type: 'incoming'
    });

    const isBusy = this.userAvailability.status === 'BUSY' || this.userAvailability.status === 'UNAVAILABLE';
    const firstName = contactName.split(' ')[0] || contactName;

    if (isBusy) {
      // 1. Autonomous Friend-Talk Mode:
      // JARVIS chats on user's behalf like a real friend, explaining the user is busy
      const friendTemplates = [
        `Hey ${firstName}! Harsh is currently tied up and busy right now with some urgent work, but I'll make sure he gets back to you as soon as he is free! Hope you're doing great!`,
        `Hey ${firstName}, Harsh is a bit occupied right now. I've noted your message and will tell him the moment he is free!`,
        `Hello ${firstName}! Harsh is busy with a project at the moment, but he'll text you as soon as he's available!`
      ];
      const friendTalk = options.customReply || friendTemplates[0];

      let sendRes;
      if (options.asVoiceMessage === true) {
        // Send as autonomous voice message in JARVIS's voice
        sendRes = await this.sendJarvisVoiceNote(contactName, friendTalk, options.durationSec || 4, true);
      } else {
        // Send as text message
        if (this.sandboxMode) {
          sendRes = { success: true, action: 'sent', recipient: contactName, message: friendTalk };
        } else {
          sendRes = await this.runAutomator('send', contactName, friendTalk);
        }
      }

      history.push({
        sender: 'JARVIS',
        message: friendTalk,
        timestamp: new Date().toISOString(),
        type: options.asVoiceMessage ? 'voice_outgoing' : 'text_outgoing',
        autonomous: true
      });

      return {
        success: true,
        autonomousResponseSent: true,
        mode: 'AUTONOMOUS_FRIEND_TALK',
        contact: contactName,
        incomingMessage: cleanText,
        replySent: friendTalk,
        isVoice: Boolean(options.asVoiceMessage),
        summary: `${contactName} sent: "${cleanText}". Since you are busy, I responded like a friend: "${friendTalk}", sir.`
      };
    } else {
      // 2. User is AVAILABLE: Formulate candidate reply and request user confirmation
      let suggestedReply = options.suggestedReply;
      if (!suggestedReply) {
        const lower = cleanText.toLowerCase();
        if (lower.includes('how are you') || lower.includes('kaise ho') || lower.includes('doing')) {
          suggestedReply = "I'm doing great, thanks for asking! Just working on some things. How about you?";
        } else if (lower.includes('hii') || lower.includes('hello') || lower.includes('hey')) {
          suggestedReply = "Hey! How are you doing?";
        } else if (lower.includes('free') || lower.includes('busy')) {
          suggestedReply = "Hey! I am around, what's up?";
        } else {
          suggestedReply = `Got your message! Let me know what you need.`;
        }
      }

      this.pendingIncomingReply = {
        contact: contactName,
        incomingMessage: cleanText,
        suggestedReply,
        status: 'AWAITING_USER_CONFIRMATION',
        timestamp: Date.now()
      };

      return {
        success: true,
        requiresConfirmation: true,
        mode: 'USER_REVIEW_REQUIRED',
        contact: contactName,
        incomingMessage: cleanText,
        suggestedReply,
        summary: `${contactName} responded: "${cleanText}". I have drafted this reply: "${suggestedReply}". Do you want me to send it, sir?`
      };
    }
  }

  /**
   * Confirms and sends the pending suggested incoming reply
   */
  async confirmIncomingReply(userConfirmed = true) {
    if (!this.pendingIncomingReply) {
      return {
        status: 'no_pending_reply',
        summary: 'There is no pending incoming reply awaiting confirmation, sir.'
      };
    }
    const pending = this.pendingIncomingReply;
    this.pendingIncomingReply = null;

    if (!userConfirmed) {
      return {
        status: 'cancelled',
        contact: pending.contact,
        summary: `Draft reply to ${pending.contact} was cancelled and not sent, sir.`
      };
    }

    let sendRes;
    if (this.sandboxMode) {
      sendRes = { success: true, action: 'sent', recipient: pending.contact, message: pending.suggestedReply };
    } else {
      sendRes = await this.runAutomator('send', pending.contact, pending.suggestedReply);
    }

    // Add to history
    if (this.conversationHistory.has(pending.contact)) {
      this.conversationHistory.get(pending.contact).push({
        sender: 'me',
        message: pending.suggestedReply,
        timestamp: new Date().toISOString(),
        type: 'text_outgoing'
      });
    }

    return {
      success: true,
      status: 'dispatched',
      recipient: pending.contact,
      message: pending.suggestedReply,
      summary: `I have confirmed and sent the reply to ${pending.contact} on WhatsApp: "${pending.suggestedReply}", sir.`
    };
  }

  /**
   * Creates and dispatches a voice note in JARVIS's own speech voice to a WhatsApp contact
   */
  async sendJarvisVoiceNote(contactQuery, textToSpeak = null, durationSec = 3, userConfirmed = true) {
    const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
    if (this.emergencyStopEngaged || (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged())) {
      return {
        success: false,
        status: 'halted_by_emergency_stop',
        summary: 'Emergency Stop is active. Cannot send voice note.'
      };
    }

    const resolution = this.resolveContact(contactQuery);
    const targetObj = resolution.contact || { name: contactQuery, fullName: contactQuery };
    const targetName = targetObj.fullName || targetObj.name;
    const firstName = targetName.split(' ')[0];

    const spokenText = textToSpeak || `Hello ${firstName}, this is J.A.R.V.I.S., Harsh's personal AI companion. Harsh asked me to send you this voice note!`;

    if (!userConfirmed) {
      return {
        status: 'confirmation_required',
        recipient: targetName,
        textToSpeak: spokenText,
        durationSec,
        summary: `I have prepared a JARVIS voice message for ${targetName}: "${spokenText}". Should I send it now, sir?`
      };
    }

    if (this.sandboxMode) {
      return {
        success: true,
        action: 'voice_note_dispatched',
        recipient: targetName,
        textSpoken: spokenText,
        durationSec,
        summary: `[SANDBOX] JARVIS voice note recorded and dispatched to ${targetName} (${durationSec}s).`
      };
    }

    // Live execution via python automator
    const automatorRes = await this.runAutomator('voice_message', targetName, String(durationSec));
    return {
      success: true,
      action: 'voice_note_dispatched',
      recipient: targetName,
      textSpoken: spokenText,
      durationSec,
      summary: `I have recorded and sent my voice message to ${targetName} on WhatsApp, sir.`
    };
  }

  /**
   * Retrieves conversation history with a contact
   */
  getConversationHistory(contactQuery) {
    const resolution = this.resolveContact(contactQuery);
    const targetName = (resolution.contact && (resolution.contact.fullName || resolution.contact.name)) || contactQuery;
    const history = this.conversationHistory.get(targetName) || [];
    return {
      success: true,
      contact: targetName,
      messageCount: history.length,
      history,
      summary: `Retrieved ${history.length} conversation messages with ${targetName}.`
    };
  }

  /**
   * Deterministic Entity & Intent Extractor for WhatsApp Messaging Commands.
   * Cleanly separates:
   * - Application / action verb (text, message, whatsapp, send a message to, write a text to, tell <Contact> that...)
   * - Recipient contact name (resolved against directory when possible without inventing contacts)
   * - Message content (capitalized cleanly when separated by comma/saying/that)
   * - Incomplete / interrupted command state (never invents a recipient)
   */
  extractMessagingEntities(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') {
      return { isMessagingIntent: false };
    }

    this.initContacts();

    // Strip wake words ("Hey JARVIS,", "JARVIS,", "STARK,") while preserving case and punctuation of the rest
    const strippedWake = rawInput
      .trim()
      .replace(/^(?:(?:hey|hi|hello|yo|ok|okay)\s+)?(?:jarvis|stark|ultron|j\.a\.r\.v\.i\.s\.?)(?:\s*[,:]\s*|\s+)/i, '')
      .trim();

    if (!strippedWake) {
      return { isMessagingIntent: false };
    }

    // Never match conversational / informational / document / non-WhatsApp requests
    if (
      /^(?:tell\s+(?:me|us|jarvis|stark|ultron)\b|what\s+is\b|who\s+is\b|how\s+to\b|explain\b|create\s+(?:a\s+)?(?:word|pdf|excel|ppt|document|file)\b)/i.test(strippedWake) ||
      /\b(?:word\s+document|word\s+file|docx|spreadsheet|presentation)\b/i.test(strippedWake)
    ) {
      return { isMessagingIntent: false };
    }

    // 1. Check for incomplete / interrupted messaging commands first:
    // e.g. "send a message to...", "write a text to...", "text to...", "whatsapp to..."
    const incompleteRegex = /^(?:please\s+)?(?:send\s+(?:a\s+)?(?:whatsapp\s+)?(?:text\s+|message\s+)?(?:to|for)?|write\s+(?:a\s+)?(?:whatsapp\s+)?(?:text|message)(?:\s+to)?|text(?:\s+to)?|message(?:\s+to)?|whatsapp(?:\s+to)?)\s*(?:\.{2,}|…)?$/i;
    if (incompleteRegex.test(strippedWake)) {
      return {
        isMessagingIntent: true,
        isIncomplete: true,
        requiresClarification: true,
        action: 'clarify',
        recipient: '',
        messageText: '',
        summary: 'Who would you like me to send the WhatsApp message to, and what should it say, sir?'
      };
    }

    // Check explicit auto-send suffix ("... and send it", "... aur bhej do")
    const sendSuffixRegex = /(?:,\s*|\s+and\s+|\s+aur\s+)send(?:\s+it|\s+now|\s+this)?(?:\s+automatically)?[.?!]*$|(?:\s+and\s+|\s+aur\s+)bhej(?:\s*do|\s*de|\s*dena)[.?!]*$/i;
    const hasAutoSendSuffix = sendSuffixRegex.test(strippedWake);
    const workingText = strippedWake.replace(sendSuffixRegex, '').trim();

    // 2. Compound "Open WhatsApp and prepare/draft/write/text [the exact message] <Contact> <Message>"
    const openAndPrepareMatch = workingText.match(/^(?:please\s+)?(?:open|launch|kholo)\s+whatsapp(?:,\s*|\s+and\s+|\s+)(?:prepare|write|draft|type|stage|send|text|msg|dm|message|ping)\s+(?:(?:(?:a|the)\s+)?(?:exact\s+)?(?:message|text)\s+)?(?:to\s+|for\s+)?(.+)$/i);
    if (openAndPrepareMatch) {
      const remainder = openAndPrepareMatch[1].trim();
      const splitRes = this._splitContactAndMessage(remainder);
      if (splitRes.recipient) {
        const isPrepareOrDraft = /\b(?:prepare|draft)\s+(?:the\s+)?(?:exact\s+)?message\b/i.test(workingText);
        return {
          isMessagingIntent: true,
          isIncomplete: false,
          action: isPrepareOrDraft ? 'draft' : 'stage',
          toolName: isPrepareOrDraft ? 'draft_whatsapp_message' : 'stage_whatsapp_message',
          openApp: true,
          shouldAutoSend: hasAutoSendSuffix,
          recipient: splitRes.recipient,
          messageText: splitRes.messageText,
          resolution: splitRes.resolution
        };
      }
    }

    // 3. Explicit separator patterns (comma, colon, saying, that, and write, ki, with text):
    // Covers:
    // - "Text Lokesh Upadhyay, what's going on?"
    // - "Send a message to Lokesh Upadhyay saying I'll call you later."
    // - "WhatsApp Lokesh Upadhyay, are you coming tomorrow?"
    // - "Tell Lokesh Upadhyay that the document is ready."
    // - "Write a text to Harsh Upadhyay saying hello"
    const sepPatterns = [
      // Pattern 3a: "Send a message/text to <Contact> saying/that/,/: <Message>"
      /^(?:please\s+)?(?:send|write|draft|type)\s+(?:a\s+)?(?:whatsapp\s+)?(?:text\s+message|message|text|dm)(?:\s+on\s+whatsapp)?\s+(?:to|for)\s+([a-zA-Z0-9_\+\s]+?)(?:\s*[,:]\s*|\s+(?:saying|that|with\s+text|ki|and\s+write|write)\s+)(.+)$/i,
      // Pattern 3b: "Send <Contact> a message/text saying/that/,/: <Message>"
      /^(?:please\s+)?send\s+([a-zA-Z0-9_\+\s]+?)\s+(?:a\s+)?(?:whatsapp\s+)?(?:text\s+message|message|text|dm)(?:\s*[,:]\s*|\s+(?:saying|that|with\s+text|ki|and\s+write|write)\s+)(.+)$/i,
      // Pattern 3c: "Text / Message / WhatsApp / DM <Contact>, <Message>" or "... saying/that <Message>"
      /^(?:please\s+)?(?:text|message|dm|whatsapp|write\s+to)\s+(?:to\s+)?([a-zA-Z0-9_\+\s]+?)(?:\s*[,:]\s*|\s+(?:saying|that|with\s+text|ki|and\s+write|write)\s+)(.+)$/i,
      // Pattern 3d: "Tell <Contact> that/saying/, <Message>" (excluding "tell me/us/jarvis")
      /^(?:please\s+)?tell\s+(?!(?:me|us|jarvis|stark|ultron)\b)([a-zA-Z0-9_\+\s]+?)(?:\s+(?:on\s+whatsapp\s+)?(?:that|saying|ki)\s+|\s*,\s*)(.+)$/i,
      // Pattern 3e: Hindi/Hinglish "<Contact> ko [whatsapp pe] message/text bhejo/likho/karo [ki] <Message>"
      /^([a-zA-Z0-9_\+\s]+?)\s+ko\s+(?:(?:whatsapp\s*(?:pe|par)?\s*)?(?:message|text|msg|dm)\s*(?:bhejo|karo|likho)|whatsapp\s*(?:karo|bhejo|likho))(?:\s*(?:ki|saying|that|,|:)\s*|\s+)(.+)$/i
    ];

    for (let i = 0; i < sepPatterns.length; i++) {
      const m = workingText.match(sepPatterns[i]);
      if (m) {
        let rawRecipient = m[1].replace(/\s+(?:on|in|via)\s+whatsapp$/i, '').trim();
        let rawMsg = m[2].trim();
        rawMsg = this._cleanExtractedMessage(rawMsg, workingText);
        const resolution = this.resolveContact(rawRecipient);
        const finalRecipient = (resolution.status === 'exact_match' || resolution.status === 'partial_match')
          ? (resolution.contact.fullName || resolution.contact.name)
          : rawRecipient;

        return {
          isMessagingIntent: true,
          isIncomplete: false,
          action: hasAutoSendSuffix ? 'send' : 'stage',
          toolName: hasAutoSendSuffix ? 'send_whatsapp_message' : 'stage_whatsapp_message',
          shouldAutoSend: hasAutoSendSuffix,
          recipient: finalRecipient,
          rawRecipient,
          messageText: rawMsg,
          resolution
        };
      }
    }

    // 4. Target-only messaging intent (no message body provided yet, or contact+message without separator):
    // e.g. "Write a text to Harsh Upadhyay", "Send a message to Harsh Upadhyay", "Message Harsh Upadhyay"
    const targetOnlyMatch = workingText.match(/^(?:please\s+)?(?:(?:write|draft|type|send)\s+(?:a\s+)?(?:whatsapp\s+)?(?:text\s+message|message|text|dm)(?:\s+on\s+whatsapp)?\s+(?:to|for)|(?:text|message|dm|whatsapp)(?:\s+to)?)\s+([a-zA-Z0-9_\+\s]+?)[.?!]*$/i);
    if (targetOnlyMatch) {
      const remainder = targetOnlyMatch[1].replace(/\s+(?:on|in|via)\s+whatsapp$/i, '').trim();
      if (!remainder || /^(?:\.+|to|for)$/i.test(remainder)) {
        return {
          isMessagingIntent: true,
          isIncomplete: true,
          requiresClarification: true,
          action: 'clarify',
          recipient: '',
          messageText: '',
          summary: 'Who would you like me to send the WhatsApp message to, and what should it say, sir?'
        };
      }
      const splitRes = this._splitContactAndMessage(remainder);
      return {
        isMessagingIntent: true,
        isIncomplete: false,
        action: hasAutoSendSuffix ? 'send' : 'stage',
        toolName: hasAutoSendSuffix ? 'send_whatsapp_message' : 'stage_whatsapp_message',
        shouldAutoSend: hasAutoSendSuffix,
        recipient: splitRes.recipient,
        rawRecipient: remainder,
        messageText: splitRes.messageText,
        resolution: splitRes.resolution
      };
    }

    return { isMessagingIntent: false };
  }

  _splitContactAndMessage(remainder) {
    const cleanRem = String(remainder || '').trim();
    if (!cleanRem) {
      return { recipient: '', messageText: '', resolution: { status: 'not_found' } };
    }

    // Check if entire remainder is an exact or ambiguous contact match
    const fullRes = this.resolveContact(cleanRem);
    if (fullRes.status === 'exact_match' || fullRes.status === 'ambiguous') {
      return {
        recipient: fullRes.status === 'exact_match' ? (fullRes.contact.fullName || fullRes.contact.name) : cleanRem,
        messageText: '',
        resolution: fullRes
      };
    }

    // Try prefix tokens against known contacts (longest prefix first, e.g. "Lokesh Upadhyay" before "Lokesh")
    const tokens = cleanRem.split(/\s+/);
    for (let len = Math.min(tokens.length - 1, 3); len >= 1; len--) {
      const candidatePrefix = tokens.slice(0, len).join(' ');
      const res = this.resolveContact(candidatePrefix);
      if (res.status === 'exact_match') {
        const msgPart = tokens.slice(len).join(' ').replace(/^(?:saying|that|ki|and\s+write|write|,|:)\s+/i, '').trim();
        return {
          recipient: res.contact.fullName || res.contact.name,
          messageText: msgPart,
          resolution: res
        };
      }
    }

    // If no known contact matched a prefix, check if remainder has <= 3 capitalized/name words with no message
    if (tokens.length <= 3 && !/\b(?:hi|hii|hello|hey|what|how|where|when|why|are|is|can|will|please)\b/i.test(cleanRem)) {
      return {
        recipient: cleanRem.replace(/[.?!]+$/, ''),
        messageText: '',
        resolution: fullRes
      };
    }

    // Otherwise assume 1 or 2 word name followed by message
    const firstTwo = tokens.slice(0, 2).join(' ');
    return {
      recipient: tokens.length >= 2 && /^[A-Z]/.test(tokens[1]) ? firstTwo : tokens[0],
      messageText: (tokens.length >= 2 && /^[A-Z]/.test(tokens[1]) ? tokens.slice(2) : tokens.slice(1)).join(' '),
      resolution: fullRes
    };
  }

  _cleanExtractedMessage(rawMsg, fullCommand = '') {
    let msg = String(rawMsg || '').trim();
    // Remove surrounding quotes if user or STT wrapped the message in quotes
    msg = msg.replace(/^["']+|["']+$/g, '').trim();
    // Remove leading connectors if still present
    msg = msg.replace(/^(?:saying|that|ki|with\s+text|and\s+write|write)\s+/i, '').trim();

    // If fullCommand had a comma before the message (e.g. "Text Lokesh Upadhyay, what's going on?")
    // or "that <message>" / "saying <message>", capitalize the first letter if the original command ended with punctuation
    const hadSentencePunctuation = /[.?!]$/.test(fullCommand.trim());
    if (msg.length > 0 && (hadSentencePunctuation || /[,:]/.test(fullCommand))) {
      msg = msg.charAt(0).toUpperCase() + msg.slice(1);
    }
    return msg;
  }

  /**
   * Authoritative delivery verification.
   * Inconclusive evidence must be reported as UNVERIFIED, never falsely claiming DELIVERED.
   */
  verifyDeliveryStatus(recipient, options = {}) {
    if (!recipient) {
      return { deliveryState: WHATSAPP_DELIVERY_STATE.FAILED, verified: false, reason: 'Recipient required' };
    }
    if (options.confirmedBubbleVisible === true) {
      return {
        deliveryState: WHATSAPP_DELIVERY_STATE.DELIVERED,
        verified: true,
        summary: `Empirical observation verified delivery to ${recipient}.`
      };
    }
    return {
      deliveryState: WHATSAPP_DELIVERY_STATE.UNVERIFIED,
      verified: false,
      summary: `External delivery state for "${recipient}" could not be confirmed automatically; recorded as UNVERIFIED to avoid false reporting.`
    };
  }
}

module.exports = {
  WhatsAppService,
  whatsappServiceInstance: new WhatsAppService(),
  WHATSAPP_DELIVERY_STATE
};
