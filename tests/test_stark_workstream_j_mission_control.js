/**
 * Acceptance Test: Workstream J — Unified Mission Control & Full System Integration
 */

const assert = require('assert');
const { windowsAppRegistry } = require('../server/desktop/windowsAppRegistry.js');
const { chromeProfileService } = require('../server/desktop/chromeProfileService.js');
const { spotifyController } = require('../server/desktop/spotifyController.js');
const { whatsappServiceInstance } = require('../server/desktop/whatsappService.js');
const { universal3dEngine } = require('../server/desktop/universal3dEngine.js');
const { errorDiagnostics } = require('../server/errorDiagnosticsService.js');
const { autonomousDevelopmentLab } = require('../server/devlab/autonomousDevelopmentLab.js');

async function runTests() {
  console.log('=== TEST SUITE: WORKSTREAM J (Unified Mission Control & Cross-System Integration) ===');

  // 1. Error Diagnostics Ledger Telemetry
  const errors = errorDiagnostics.getRecentErrors(5);
  assert(Array.isArray(errors), 'Errors must be an array');
  console.log(`  [PASS] Diagnostics Ledger: ${errors.length} recorded events in ledger`);

  // 2. Windows Applications & Windows Lifecycle
  const windows = await windowsAppRegistry.listActiveWindows();
  const installedApps = await windowsAppRegistry.scanInstalledApps();
  assert(installedApps.length > 5, 'Must have indexed Windows applications');
  console.log(`  [PASS] Windows Registry: ${installedApps.length} indexed apps, ${windows.length} active GUI windows`);

  // 3. Chrome Profiles Subsystem
  const chromeProfiles = chromeProfileService.getProfiles();
  assert(chromeProfiles.length > 0, 'Must have discovered Chrome profiles');
  console.log(`  [PASS] Chrome Profiles: ${chromeProfiles.length} profiles discovered (${chromeProfiles.map(p => p.name).join(', ')})`);

  // 4. WhatsApp Subsystem
  const callState = whatsappServiceInstance.getCallState();
  assert(callState && callState.status, 'WhatsApp call state must be defined');
  console.log(`  [PASS] WhatsApp Integration: status="${callState.status}", contacts=${whatsappServiceInstance.contacts ? whatsappServiceInstance.contacts.length : 0}`);

  // 5. Spotify Desktop Music Subsystem
  const spotifyStatus = await spotifyController.getStatus();
  assert(spotifyStatus && typeof spotifyStatus.isRunning === 'boolean', 'Spotify status must report state');
  console.log(`  [PASS] Spotify Transport: running=${spotifyStatus.isRunning}, playing=${spotifyStatus.isPlaying}`);

  // 6. Universal 3D Engine Subsystem
  const model = await universal3dEngine.create3dModel('Mission Control Holographic Reactor', { archetype: 'energy_ring' });
  assert(model.success && universal3dEngine.activeModels.size > 0, 'Active 3D models must be registered');
  console.log(`  [PASS] 3D Visual Engine: ${universal3dEngine.activeModels.size} active models (${model.modelName})`);

  // 7. Autonomous Development Lab
  const devProject = await autonomousDevelopmentLab.createProject('mission_control_check', { language: 'python' });
  const devRun = await autonomousDevelopmentLab.runCode('mission_control_check', { language: 'python' });
  assert(devRun.success, 'DevLab execution must succeed');
  console.log('  [PASS] Autonomous DevLab: Project verified execution exit code 0');

  console.log('=== WORKSTREAM J: ALL ACCEPTANCE TESTS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
