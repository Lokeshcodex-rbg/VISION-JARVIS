/**
 * VISION AI — Platform Manager
 * Unified cross-platform orchestration layer for Windows, macOS, and Linux.
 * Automatically detects host operating system, instantiates appropriate platform adapter,
 * and exposes uniform interfaces with honest status reporting.
 */

const { WindowsAdapter } = require('./windowsAdapter');
const { MacOSAdapter } = require('./macOSAdapter');
const { LinuxAdapter } = require('./linuxAdapter');

class PlatformManager {
  constructor() {
    this.adapters = {
      windows: new WindowsAdapter(),
      macos: new MacOSAdapter(),
      linux: new LinuxAdapter()
    };

    this.activePlatform = this.detectPlatform();
    this.activeAdapter = this.adapters[this.activePlatform];
  }

  detectPlatform() {
    switch (process.platform) {
      case 'win32': return 'windows';
      case 'darwin': return 'macos';
      case 'linux': return 'linux';
      default: return 'windows';
    }
  }

  getActivePlatform() {
    return this.activePlatform;
  }

  getActiveAdapter() {
    return this.activeAdapter;
  }

  getAdapter(platformName) {
    return this.adapters[platformName] || null;
  }

  async getSystemInfo() {
    return this.activeAdapter.getSystemInfo();
  }

  async launchApplication(appName, args = []) {
    return this.activeAdapter.launchApplication(appName, args);
  }

  async focusWindow(windowTitleOrPid) {
    return this.activeAdapter.focusWindow(windowTitleOrPid);
  }

  async listWindows() {
    return this.activeAdapter.listWindows();
  }

  async closeApplication(processNameOrPid, force = false) {
    return this.activeAdapter.closeApplication(processNameOrPid, force);
  }

  async executeShell(command, options = {}) {
    return this.activeAdapter.executeShell(command, options);
  }

  getSpecialDirectories() {
    return this.activeAdapter.getSpecialDirectories();
  }

  async storeCredential(service, account, secret) {
    return this.activeAdapter.storeCredential(service, account, secret);
  }

  async getCredential(service, account) {
    return this.activeAdapter.getCredential(service, account);
  }

  async deleteCredential(service, account) {
    return this.activeAdapter.deleteCredential(service, account);
  }

  async discoverAudioDevices() {
    return this.activeAdapter.discoverAudioDevices();
  }

  async discoverCameraDevices() {
    return this.activeAdapter.discoverCameraDevices();
  }

  async checkAccessibilityPermission() {
    return this.activeAdapter.checkAccessibilityPermission();
  }

  getCompatibilityMatrix() {
    return {
      hostPlatform: this.activePlatform,
      detectedNodePlatform: process.platform,
      platforms: {
        windows: this.adapters.windows.getCapabilityStatus(),
        macos: this.adapters.macos.getCapabilityStatus(),
        linux: this.adapters.linux.getCapabilityStatus()
      }
    };
  }
}

const platformManagerInstance = new PlatformManager();

module.exports = {
  PlatformManager,
  platformManagerInstance
};
