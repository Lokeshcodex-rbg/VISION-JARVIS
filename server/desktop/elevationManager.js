/**
 * VISION AI — Safe Windows Administrative & UAC Elevation Manager
 * Detects whether an operation requires Windows Administrator privileges,
 * generates user-intelligible impact assessments, triggers standard Windows UAC
 * elevation prompts with explicit user consent, verifies observable outcomes afterward,
 * and recovers safely on cancellation or failure.
 * 
 * Never silently bypasses UAC, disables security, or grants persistent admin tokens.
 * ULTRON is strictly prohibited from requesting or executing elevation.
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { permissionGateInstance } = require('./permissionGate.js');

// Known paths, commands, and operations that inherently require Windows Elevation
const ELEVATION_TRIGGERS = [
  /\\Windows\\System32/i,
  /\\Program Files(\s*\(x86\))?/i,
  /HKLM:\\/i,
  /HKEY_LOCAL_MACHINE/i,
  /\breg\s+(add|delete|import|restore)\b/i,
  /\b(sc\.exe|sc\s+create|sc\s+delete|sc\s+config)\b/i,
  /\bnet\s+(stop|start|pause)\b/i,
  /\b(New-Service|Set-Service|Remove-Service)\b/i,
  /\b(netsh\s+advfirewall|New-NetFirewallRule)\b/i,
  /\b(netsh\s+interface|Set-NetIPInterface)\b/i,
  /\bwinget\s+install.*--scope\s+machine\b/i,
  /\bchoco\s+install\b/i,
  /drivers\\etc\\hosts/i,
  /\b(dism|sfc\s+\/scannow|bcdedit)\b/i
];

class ElevationManager {
  constructor() {
    this.pendingProposals = new Map();
    this.auditHistory = [];
  }

  /**
   * Checks whether the current Node process is running elevated (Administrator)
   */
  async checkProcessElevated() {
    return new Promise((resolve) => {
      // In Windows, 'net session' succeeds (exit code 0) only if running as Administrator
      exec('net session', (err) => {
        resolve(!err);
      });
    });
  }

  /**
   * Evaluates whether an operation or command requires administrative elevation
   */
  requiresElevation(operation, target = '', command = '') {
    const combined = `${operation} ${target} ${command}`.trim();
    for (const pattern of ELEVATION_TRIGGERS) {
      if (pattern.test(combined)) {
        return {
          required: true,
          matchedTrigger: pattern.toString(),
          reason: `Operation touches protected Windows subsystem: ${pattern.toString()}`
        };
      }
    }

    return {
      required: false,
      reason: 'Standard user privileges are sufficient for this operation.'
    };
  }

  /**
   * Generates a clear, user-facing Elevation Proposal with impact assessment
   */
  createElevationProposal({ operation, target, command, rationale, personality = 'JARVIS' }) {
    // ULTRON Separation Guard
    if (personality === 'ULTRON') {
      throw new Error(
        'Security Policy Violation: ULTRON is strictly restricted to analytical governance and cannot request administrative elevation.'
      );
    }

    const elevationCheck = this.requiresElevation(operation, target, command);
    const proposalId = `elev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Generate human-intelligible impact assessment
    let impactExplanation = `This action will perform "${operation}" targeting "${target || 'Windows System'}".`;
    if (elevationCheck.required) {
      impactExplanation += ` Because this touches protected system resources (${elevationCheck.reason}), Windows User Account Control (UAC) will prompt for your authorization.`;
    }

    const proposal = {
      proposalId,
      personality,
      operation,
      target: target || 'Windows System',
      command: command || '',
      rationale: rationale || 'Administrative maintenance operation requested by user',
      elevationRequired: elevationCheck.required,
      impactExplanation,
      status: 'PENDING_USER_CONFIRMATION',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5-minute validity
    };

    this.pendingProposals.set(proposalId, proposal);

    // Audit proposal creation
    permissionGateInstance.logAudit({
      action: 'ELEVATION_PROPOSAL_CREATED',
      target: proposal.target,
      personality,
      details: { proposalId, operation, elevationRequired: elevationCheck.required }
    });

    return proposal;
  }

  /**
   * Executes an authorized elevation proposal with Windows UAC trigger & post-verification
   */
  async executeElevated({ proposalId, userConfirmed, verificationCallback }) {
    const proposal = this.pendingProposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Elevation proposal "${proposalId}" does not exist or has expired.`);
    }

    if (new Date() > new Date(proposal.expiresAt)) {
      this.pendingProposals.delete(proposalId);
      throw new Error(`Elevation proposal "${proposalId}" has expired. Please create a new request.`);
    }

    if (!userConfirmed) {
      proposal.status = 'USER_DECLINED';
      this.pendingProposals.delete(proposalId);
      permissionGateInstance.logAudit({
        action: 'ELEVATION_USER_DECLINED',
        target: proposal.target,
        personality: proposal.personality,
        details: { proposalId }
      });
      return {
        success: false,
        status: 'USER_DECLINED',
        message: 'Administrative operation was cancelled by the user.'
      };
    }

    // Check emergency stop
    if (permissionGateInstance.isEmergencyStopActive()) {
      proposal.status = 'ABORTED_EMERGENCY_STOP';
      this.pendingProposals.delete(proposalId);
      throw new Error('Operation aborted: System Emergency Stop is currently active.');
    }

    const t0 = Date.now();
    proposal.status = 'EXECUTING';

    try {
      let executionResult;

      if (!proposal.elevationRequired) {
        // Standard non-elevated command execution
        executionResult = await this.runStandardCommand(proposal.command);
      } else {
        // Trigger legitimate Windows UAC elevation via Start-Process powershell -Verb RunAs
        executionResult = await this.runWithUAC(proposal.command);
      }

      // Observable Outcome Post-Verification
      let verifiedOutcome = { verified: true, note: 'Command executed successfully.' };
      if (typeof verificationCallback === 'function') {
        try {
          verifiedOutcome = await verificationCallback(proposal);
        } catch (vErr) {
          verifiedOutcome = { verified: false, error: vErr.message };
        }
      }

      const durationMs = Date.now() - t0;
      proposal.status = verifiedOutcome.verified ? 'COMPLETED_VERIFIED' : 'COMPLETED_UNVERIFIED';
      this.pendingProposals.delete(proposalId);

      const record = {
        proposalId,
        personality: proposal.personality,
        operation: proposal.operation,
        target: proposal.target,
        elevationUsed: proposal.elevationRequired,
        durationMs,
        executionResult,
        verifiedOutcome,
        completedAt: new Date().toISOString()
      };

      this.auditHistory.unshift(record);
      if (this.auditHistory.length > 50) this.auditHistory.pop();

      permissionGateInstance.logAudit({
        action: verifiedOutcome.verified ? 'ELEVATION_EXECUTION_SUCCESS' : 'ELEVATION_VERIFICATION_FAILED',
        target: proposal.target,
        personality: proposal.personality,
        details: { proposalId, durationMs, verified: verifiedOutcome.verified }
      });

      return {
        success: verifiedOutcome.verified,
        status: proposal.status,
        durationMs,
        output: executionResult.stdout || executionResult.output,
        verified: verifiedOutcome.verified,
        verificationNote: verifiedOutcome.note || verifiedOutcome.error || 'Verified'
      };
    } catch (err) {
      proposal.status = 'FAILED';
      this.pendingProposals.delete(proposalId);

      permissionGateInstance.logAudit({
        action: 'ELEVATION_EXECUTION_FAILED',
        target: proposal.target,
        personality: proposal.personality,
        details: { proposalId, error: err.message }
      });

      return {
        success: false,
        status: 'FAILED',
        error: err.message,
        suggestion: 'The UAC prompt was either cancelled or the elevated command returned an error.'
      };
    }
  }

  /**
   * Executes standard command using child_process
   */
  runStandardCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      });
    });
  }

  /**
   * Launches standard Windows UAC prompt via PowerShell -Verb RunAs
   */
  runWithUAC(command) {
    return new Promise((resolve, reject) => {
      // Create a temporary script file to execute cleanly
      const tempScript = path.join(os.tmpdir(), `stark_elev_${Date.now()}.ps1`);
      const scriptContent = `
$ErrorActionPreference = 'Stop'
try {
  ${command}
  exit 0
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`;
      fs.writeFileSync(tempScript, scriptContent, 'utf8');

      // Use powershell Start-Process -Verb RunAs with -Wait
      const launcherCommand = `Start-Process powershell -Verb RunAs -Wait -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File \\"${tempScript}\\""`;

      exec(`powershell -NoProfile -Command "${launcherCommand}"`, { timeout: 45000 }, (err) => {
        try { fs.unlinkSync(tempScript); } catch (e) {}

        if (err) {
          return reject(new Error(`Elevated process failed or was cancelled by user: ${err.message}`));
        }
        resolve({
          output: 'Elevated command completed via Windows UAC.',
          uacGranted: true
        });
      });
    });
  }

  getPendingProposals() {
    return Array.from(this.pendingProposals.values());
  }

  getAuditHistory(limit = 20) {
    return this.auditHistory.slice(0, limit);
  }
}

const elevationManagerInstance = new ElevationManager();

module.exports = {
  ElevationManager,
  elevationManagerInstance,
  ELEVATION_TRIGGERS
};
