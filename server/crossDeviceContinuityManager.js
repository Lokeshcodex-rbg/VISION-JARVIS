/**
 * VISION AI — Secure Cross-Device Continuity Manager
 * Enables encrypted synchronization of project context, active missions,
 * and remote emergency stop requests across registered, authenticated devices.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MASTER_SYNC_KEY = process.env.STARK_SYNC_KEY
  ? crypto.createHash('sha256').update(process.env.STARK_SYNC_KEY).digest()
  : crypto.createHash('sha256').update('stark_cross_device_secure_sync_salt_2026').digest();

class CrossDeviceContinuityManager {
  constructor() {
    this.devices = new Map(); // deviceId -> deviceRecord
    this.syncHistory = [];
    this.auditLogs = [];
    this._registerLocalPrimaryDevice();
  }

  _registerLocalPrimaryDevice() {
    this.devices.set('device_primary_desktop', {
      deviceId: 'device_primary_desktop',
      name: 'Primary Engineering Workstation (Windows 11)',
      deviceType: 'DESKTOP',
      status: 'ACTIVE',
      permissions: ['ALL', 'EMERGENCY_STOP', 'MISSION_SYNC', 'PROJECT_EDIT'],
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      sharedSecret: crypto.randomBytes(16).toString('hex')
    });
  }

  /**
   * Registers a new authorized secondary device (e.g. laptop, mobile, tablet)
   */
  registerDevice(options = {}) {
    const { name, deviceType = 'LAPTOP', permissions = ['MISSION_SYNC', 'EMERGENCY_STOP'] } = options;
    if (!name) throw new Error('Device name is required');

    const deviceId = `dev_${deviceType.toLowerCase()}_${Date.now()}`;
    const sharedSecret = crypto.randomBytes(32).toString('hex');

    const deviceRecord = {
      deviceId,
      name,
      deviceType,
      status: 'ACTIVE',
      permissions,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      sharedSecret
    };

    this.devices.set(deviceId, deviceRecord);
    this._logAudit('DEVICE_REGISTERED', { deviceId, name, permissions });

    return {
      success: true,
      deviceId,
      deviceRecord,
      pairingSecret: sharedSecret
    };
  }

  /**
   * Revokes an authorized device
   */
  revokeDevice(deviceId, reason = 'USER_REVOCATION') {
    const dev = this.devices.get(deviceId);
    if (!dev) throw new Error(`Device ${deviceId} not found`);

    if (deviceId === 'device_primary_desktop') {
      throw new Error('Cannot revoke primary host workstation');
    }

    dev.status = 'REVOKED';
    this._logAudit('DEVICE_REVOKED', { deviceId, reason });

    return {
      success: true,
      deviceId,
      status: 'REVOKED'
    };
  }

  /**
   * Encrypts and packages project state into a secure sync payload using AES-256-GCM
   */
  createEncryptedSyncPacket(targetDeviceId, projectContext = {}) {
    const dev = this.devices.get(targetDeviceId);
    if (!dev || dev.status !== 'ACTIVE') {
      throw new Error(`Device ${targetDeviceId} is not active or authorized`);
    }

    // Sanitize payload: strip any secrets or API keys
    const sanitizedContext = JSON.parse(JSON.stringify(projectContext, (key, value) => {
      if (/api[_-]?key|secret|password|token/i.test(key)) {
        return '[REDACTED_FOR_DEVICE_SYNC]';
      }
      return value;
    }));

    const packetPlaintext = JSON.stringify({
      sourceDevice: 'device_primary_desktop',
      targetDevice: targetDeviceId,
      timestamp: new Date().toISOString(),
      vectorClock: { primary: Date.now() },
      context: sanitizedContext
    });

    // AES-256-GCM Authenticated Encryption
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_SYNC_KEY, iv);
    let ciphertext = cipher.update(packetPlaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    dev.lastSeen = new Date().toISOString();

    return {
      success: true,
      targetDeviceId,
      iv: iv.toString('hex'),
      ciphertext,
      authTag: authTag.toString('hex'),
      encryptionAlgorithm: 'AES-256-GCM'
    };
  }

  /**
   * Decrypts and ingests an incoming sync packet from an authorized device
   */
  receiveEncryptedSyncPacket(syncPacket = {}) {
    const { sourceDeviceId, iv, ciphertext, authTag } = syncPacket;
    if (!sourceDeviceId || !iv || !ciphertext || !authTag) {
      throw new Error('Malformed sync packet. Missing cryptographic fields.');
    }

    const dev = this.devices.get(sourceDeviceId);
    if (!dev || dev.status !== 'ACTIVE') {
      throw new Error(`Device ${sourceDeviceId} is unauthorized or revoked`);
    }

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_SYNC_KEY, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const parsedPayload = JSON.parse(decrypted);
      dev.lastSeen = new Date().toISOString();

      this._logAudit('SYNC_PACKET_RECEIVED', { sourceDeviceId });

      return {
        success: true,
        sourceDeviceId,
        decryptedPayload: parsedPayload
      };
    } catch (e) {
      this._logAudit('SYNC_AUTHENTICATION_FAILURE', { sourceDeviceId, error: e.message });
      throw new Error(`Packet decryption or authentication tag mismatch: ${e.message}`);
    }
  }

  /**
   * Processes a remote emergency stop request from an authorized device
   */
  processRemoteEmergencyStop(requestingDeviceId, reason = 'REMOTE_TRIGGER') {
    const dev = this.devices.get(requestingDeviceId);
    if (!dev || dev.status !== 'ACTIVE') {
      throw new Error(`Device ${requestingDeviceId} is not authorized for emergency stop`);
    }

    if (!dev.permissions.includes('EMERGENCY_STOP') && !dev.permissions.includes('ALL')) {
      throw new Error(`Device ${requestingDeviceId} lacks EMERGENCY_STOP permission`);
    }

    this._logAudit('REMOTE_EMERGENCY_STOP_TRIGGERED', { requestingDeviceId, reason });

    return {
      success: true,
      action: 'REMOTE_EMERGENCY_STOP',
      requestingDeviceId,
      reason,
      haltAcknowledged: true,
      timestamp: new Date().toISOString()
    };
  }

  _logAudit(action, details = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      action,
      details
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 200) this.auditLogs.pop();
  }

  getContinuityStatus() {
    return {
      timestamp: new Date().toISOString(),
      registeredDevicesCount: this.devices.size,
      activeDevicesCount: Array.from(this.devices.values()).filter(d => d.status === 'ACTIVE').length,
      devices: Array.from(this.devices.values()).map(d => ({
        deviceId: d.deviceId,
        name: d.name,
        deviceType: d.deviceType,
        status: d.status,
        permissions: d.permissions,
        lastSeen: d.lastSeen
      })),
      recentAuditLogs: this.auditLogs.slice(0, 10)
    };
  }
}

const crossDeviceContinuityManagerInstance = new CrossDeviceContinuityManager();

module.exports = {
  CrossDeviceContinuityManager,
  crossDeviceContinuityManagerInstance
};
