/**
 * VISION AI — Python Windows Local Agent Lifecycle & Process Manager
 * Coordinates launching, monitoring, health checks, graceful shutdown,
 * and user-level startup registration of the Python Windows Local Agent daemon.
 */

const { spawn, exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PROJECT_ROOT = process.env.JARVIS_PROJECT_PATH
  ? path.resolve(process.env.JARVIS_PROJECT_PATH)
  : path.resolve(__dirname, '../..');

const AGENT_SCRIPT = path.join(PROJECT_ROOT, 'agent', 'windows_agent.py');
const RUNTIME_FILE = path.join(PROJECT_ROOT, 'data', 'agent_runtime.json');
const DEFAULT_PORT = 3005;

class AgentLifecycleManager {
  constructor(port = DEFAULT_PORT) {
    this.port = port;
    this.agentUrl = `http://127.0.0.1:${this.port}`;
    this.projectRoot = PROJECT_ROOT;
    this.agentScript = AGENT_SCRIPT;
    this.runtimeFile = RUNTIME_FILE;
    this.agentProcess = null;
    this.isStarting = false;
  }

  /**
   * Probes the Python agent HTTP health endpoint
   */
  async queryHealth(timeoutMs = 1500) {
    return new Promise((resolve) => {
      const req = http.get(`${this.agentUrl}/health`, { timeout: timeoutMs }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(raw);
              return resolve({ running: true, healthy: true, ...data });
            } catch (_) {}
          }
          resolve({ running: true, healthy: false, statusCode: res.statusCode });
        });
      });

      req.on('error', (err) => {
        resolve({ running: false, healthy: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ running: false, healthy: false, error: 'TIMEOUT' });
      });
    });
  }

  async isRunning() {
    const health = await this.queryHealth();
    return Boolean(health.running && health.healthy);
  }

  /**
   * Spawns the Python agent as a managed detached background daemon
   */
  async startAgent() {
    if (this.isStarting) {
      await new Promise(r => setTimeout(r, 1000));
      return await this.queryHealth();
    }

    const alive = await this.isRunning();
    if (alive) {
      const status = await this.queryHealth();
      return {
        success: true,
        status: 'ALREADY_RUNNING',
        port: this.port,
        pid: status.pid,
        summary: `JARVIS Windows Local Agent is already active on port ${this.port} (PID ${status.pid}).`
      };
    }

    this.isStarting = true;

    try {
      const pythonCmd = 'python';

      // Spawn detached background process
      const child = spawn(pythonCmd, [this.agentScript, String(this.port)], {
        cwd: this.projectRoot,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1'
        }
      });

      if (child.pid) {
        child.unref();
        this.agentProcess = child;
      }

      // Wait up to 4 seconds for health confirmation
      const t0 = Date.now();
      let isHealthy = false;
      let lastHealth = null;

      while (Date.now() - t0 < 4500) {
        lastHealth = await this.queryHealth(800);
        if (lastHealth.running && lastHealth.healthy) {
          isHealthy = true;
          break;
        }
        await new Promise(r => setTimeout(r, 300));
      }

      const dir = path.dirname(this.runtimeFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const runtimeInfo = {
        port: this.port,
        pid: isHealthy ? lastHealth.pid : child.pid,
        startedAt: new Date().toISOString(),
        healthy: isHealthy,
        pythonVersion: isHealthy ? lastHealth.python_version : null
      };

      fs.writeFileSync(this.runtimeFile, JSON.stringify(runtimeInfo, null, 2), 'utf8');

      return {
        success: isHealthy,
        status: isHealthy ? 'HEALTHY' : 'SPAWNED_UNVERIFIED',
        port: this.port,
        pid: isHealthy ? lastHealth.pid : child.pid,
        health: lastHealth,
        summary: isHealthy
          ? `JARVIS Python Windows Local Agent started successfully on port ${this.port} (PID ${lastHealth.pid}).`
          : `Spawned Python process (PID ${child.pid}) but health verification timed out.`
      };
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Ensures the agent is running, starting it if necessary
   */
  async ensureAgentRunning() {
    const running = await this.isRunning();
    if (!running) {
      return await this.startAgent();
    }
    return { success: true, status: 'RUNNING' };
  }

  /**
   * Stops the Python agent cleanly
   */
  async stopAgent() {
    // 1. Send /stop request
    try {
      await new Promise((resolve) => {
        const req = http.request(`${this.agentUrl}/stop`, { method: 'POST', timeout: 2000 }, (res) => {
          resolve(true);
        });
        req.on('error', () => resolve(false));
        req.write('{}');
        req.end();
      });
      await new Promise(r => setTimeout(r, 600));
    } catch (_) {}

    // 2. Kill by recorded PID or port if still listening
    try {
      if (fs.existsSync(this.runtimeFile)) {
        const info = JSON.parse(fs.readFileSync(this.runtimeFile, 'utf8'));
        if (info.pid) {
          try {
            execSync(`taskkill /F /T /PID ${info.pid}`, { stdio: 'ignore' });
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 3. Verify stopped
    const health = await this.queryHealth(1000);
    const stopped = !health.running;

    if (fs.existsSync(this.runtimeFile)) {
      try {
        const info = JSON.parse(fs.readFileSync(this.runtimeFile, 'utf8'));
        info.status = 'STOPPED';
        info.stoppedAt = new Date().toISOString();
        fs.writeFileSync(this.runtimeFile, JSON.stringify(info, null, 2), 'utf8');
      } catch (_) {}
    }

    return {
      success: stopped,
      status: stopped ? 'STOPPED' : 'STILL_RUNNING',
      summary: stopped ? 'JARVIS Python Local Agent stopped successfully.' : 'Agent process termination pending.'
    };
  }

  /**
   * Restarts the agent cleanly
   */
  async restartAgent() {
    await this.stopAgent();
    await new Promise(r => setTimeout(r, 800));
    return await this.startAgent();
  }

  /**
   * Registers user-level startup entry in Windows Startup folder (no elevation required)
   */
  registerUserStartup() {
    try {
      const { execSync } = require('child_process');
      const pyScript = path.join(this.projectRoot, 'agent', 'service_manager.py');
      const out = execSync(`python "${pyScript}" register`, { encoding: 'utf8' });
      return JSON.parse(out);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Comprehensive status report
   */
  async getStatus() {
    const health = await this.queryHealth();
    return {
      agentName: 'STARK_WINDOWS_LOCAL_AGENT',
      agentLanguage: 'Python 3.12 (Standard Library Architecture)',
      port: this.port,
      agentUrl: this.agentUrl,
      running: health.running,
      healthy: health.healthy,
      pid: health.pid || null,
      uptimeSeconds: health.uptime_seconds || 0,
      emergencyStopLatched: health.emergency_stop_latched || false,
      activeChildProcesses: health.active_child_processes || 0,
      pythonVersion: health.python_version || null,
      platform: health.platform || 'win32'
    };
  }
}

const agentLifecycleManagerInstance = new AgentLifecycleManager();

module.exports = {
  AgentLifecycleManager,
  agentLifecycleManagerInstance
};

