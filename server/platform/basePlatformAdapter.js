/**
 * VISION AI — Base Platform Adapter
 * Defines the canonical contract for all operating-system-specific integrations.
 * Subclasses: WindowsAdapter, MacOSAdapter, LinuxAdapter.
 */

class BasePlatformAdapter {
  constructor(platformName) {
    this.platformName = platformName;
  }

  getPlatformName() {
    return this.platformName;
  }

  isCurrentPlatform() {
    return false;
  }

  async getSystemInfo() {
    throw new Error('Not implemented');
  }

  async launchApplication(appName, args = []) {
    throw new Error('Not implemented');
  }

  async focusWindow(windowTitleOrPid) {
    throw new Error('Not implemented');
  }

  async listWindows() {
    throw new Error('Not implemented');
  }

  async closeApplication(processNameOrPid, force = false) {
    throw new Error('Not implemented');
  }

  async executeShell(command, options = {}) {
    throw new Error('Not implemented');
  }

  getSpecialDirectories() {
    throw new Error('Not implemented');
  }

  async storeCredential(service, account, secret) {
    throw new Error('Not implemented');
  }

  async getCredential(service, account) {
    throw new Error('Not implemented');
  }

  async deleteCredential(service, account) {
    throw new Error('Not implemented');
  }

  async discoverAudioDevices() {
    throw new Error('Not implemented');
  }

  async discoverCameraDevices() {
    throw new Error('Not implemented');
  }

  async checkAccessibilityPermission() {
    throw new Error('Not implemented');
  }

  getCapabilityStatus() {
    return {
      platform: this.platformName,
      isCurrent: this.isCurrentPlatform(),
      groundingLevel: 'PLANNED',
      status: 'UNAVAILABLE'
    };
  }
}

module.exports = { BasePlatformAdapter };
