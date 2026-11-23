/**
 * VISION AI — Multi-Agent Structured Message Bus
 * 
 * Provides an authoritative, validated message exchange layer between specialist agents
 * and the central Multi-Agent Orchestrator.
 * 
 * In strict adherence to Section 5 of the Phase 6 Directive:
 * - Structured messages (Message ID, Sender, Recipient, Task ID, Parent Task ID, Type, Payload, Timestamp, Status)
 * - Supported Types: TASK_ASSIGNMENT, TASK_ACCEPTANCE, PROGRESS_UPDATE, RESULT, FAILURE_REPORT,
 *   CLARIFICATION_REQUEST, DELEGATION_REQUEST, CONFLICT_NOTIFICATION
 * - Input validation on all incoming messages
 * - Security Invariant: Message payloads are strictly data; no message can elevate permissions or grant access.
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');
const { permissionPolicyEngineInstance } = require('./security/permissionPolicyEngine.js');

const MESSAGE_TYPES = {
  TASK_ASSIGNMENT: 'TASK_ASSIGNMENT',
  TASK_ACCEPTANCE: 'TASK_ACCEPTANCE',
  PROGRESS_UPDATE: 'PROGRESS_UPDATE',
  RESULT: 'RESULT',
  FAILURE_REPORT: 'FAILURE_REPORT',
  CLARIFICATION_REQUEST: 'CLARIFICATION_REQUEST',
  DELEGATION_REQUEST: 'DELEGATION_REQUEST',
  CONFLICT_NOTIFICATION: 'CONFLICT_NOTIFICATION',
  LESSON_LEARNED: 'LESSON_LEARNED'
};

const MESSAGE_STATUS = {
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  PROCESSED: 'PROCESSED',
  REJECTED: 'REJECTED'
};

class MultiAgentMessageBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.messageHistory = [];
    this.maxHistorySize = options.maxHistorySize || 1000;
    this.agentInboxes = new Map(); // agentId -> Message[]
  }

  /**
   * Validates a message structure against required schema
   */
  validateMessage(message = {}) {
    const errors = [];

    if (!message.sender || typeof message.sender !== 'string') {
      errors.push('Missing or invalid "sender" field.');
    }
    if (!message.recipient || typeof message.recipient !== 'string') {
      errors.push('Missing or invalid "recipient" field.');
    }
    if (!message.messageType || !MESSAGE_TYPES[message.messageType]) {
      errors.push(`Invalid "messageType": "${message.messageType}". Must be one of: ${Object.keys(MESSAGE_TYPES).join(', ')}`);
    }
    if (!message.taskId || typeof message.taskId !== 'string') {
      errors.push('Missing or invalid "taskId" field.');
    }
    if (message.payload === undefined || message.payload === null) {
      errors.push('Missing "payload" field.');
    }

    // Security Check: Ensure payload contains no permission elevation attempts
    if (message.payload && typeof message.payload === 'object') {
      const payloadStr = JSON.stringify(message.payload);
      if (payloadStr.includes('grantPermission') || payloadStr.includes('elevateLevel') || payloadStr.includes('bypassGate')) {
        errors.push('SECURITY_VIOLATION: Messages cannot contain permission elevation instructions.');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sends a structured message across the bus
   */
  sendMessage(rawMessage = {}) {
    const validation = this.validateMessage(rawMessage);
    if (!validation.valid) {
      throw new Error(`INVALID_MESSAGE: ${validation.errors.join(' ')}`);
    }

    const messageId = rawMessage.messageId || ('msg_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex'));
    const timestamp = rawMessage.timestamp || new Date().toISOString();

    // Sanitize any secrets in the payload pre-dispatch
    const sanitizedPayload = permissionPolicyEngineInstance.redactSecrets(rawMessage.payload);

    const structuredMessage = {
      messageId,
      sender: rawMessage.sender,
      recipient: rawMessage.recipient,
      taskId: rawMessage.taskId,
      parentTaskId: rawMessage.parentTaskId || rawMessage.taskId,
      messageType: rawMessage.messageType,
      payload: sanitizedPayload,
      timestamp,
      status: MESSAGE_STATUS.DELIVERED
    };

    // Store in global history
    this.messageHistory.push(structuredMessage);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }

    // Deliver to recipient inbox
    const recipient = structuredMessage.recipient;
    if (!this.agentInboxes.has(recipient)) {
      this.agentInboxes.set(recipient, []);
    }
    this.agentInboxes.get(recipient).push(structuredMessage);

    // Emit typed and global events
    this.emit(structuredMessage.messageType, structuredMessage);
    this.emit(`to:${recipient}`, structuredMessage);
    this.emit('message', structuredMessage);

    return structuredMessage;
  }

  /**
   * Retrieves messages for an agent with optional unread drainage
   */
  getInbox(agentId, drain = false) {
    const inbox = this.agentInboxes.get(agentId) || [];
    if (drain) {
      this.agentInboxes.set(agentId, []);
    }
    return [...inbox];
  }

  /**
   * Queries message history with filters
   */
  queryMessages(filter = {}) {
    let results = [...this.messageHistory];

    if (filter.taskId) {
      results = results.filter(m => m.taskId === filter.taskId || m.parentTaskId === filter.taskId);
    }
    if (filter.sender) {
      results = results.filter(m => m.sender === filter.sender);
    }
    if (filter.recipient) {
      results = results.filter(m => m.recipient === filter.recipient);
    }
    if (filter.messageType) {
      results = results.filter(m => m.messageType === filter.messageType);
    }

    return results;
  }

  /**
   * Clears inboxes and history (for test isolation)
   */
  reset() {
    this.messageHistory = [];
    this.agentInboxes.clear();
  }
}

const multiAgentMessageBusInstance = new MultiAgentMessageBus();

module.exports = {
  MultiAgentMessageBus,
  multiAgentMessageBusInstance,
  MESSAGE_TYPES,
  MESSAGE_STATUS
};

