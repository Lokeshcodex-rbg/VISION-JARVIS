/**
 * Acceptance Test: Workstream B — Universal Windows Application Registry & Desktop Lifecycle
 */

const assert = require('assert');
const { windowsAppRegistry } = require('../server/desktop/windowsAppRegistry.js');
const { appLauncherInstance } = require('../server/desktop/appLauncher.js');

async function runTests() {
  console.log('=== TEST SUITE: WORKSTREAM B (Windows App Registry & Lifecycle) ===');

  // Test 1: Resolve standard applications
  const wordApp = await windowsAppRegistry.resolveApp('word');
  assert(wordApp, 'Must resolve Microsoft Word');
  assert.strictEqual(wordApp.id, 'word');
  console.log('  [PASS] Microsoft Word resolution verified:', wordApp.name);

  const chromeApp = await windowsAppRegistry.resolveApp('chrome');
  assert(chromeApp, 'Must resolve Google Chrome');
  console.log('  [PASS] Google Chrome resolution verified:', chromeApp.name);

  // Test 2: Dynamic Start Menu & Registry Scanning
  const scanned = await windowsAppRegistry.scanInstalledApps();
  assert(Array.isArray(scanned) && scanned.length > 5, 'Must scan installed applications from Windows');
  console.log(`  [PASS] Dynamic scanning discovered ${scanned.length} applications`);

  // Test 3: List active top-level windows
  const activeWindows = await windowsAppRegistry.listActiveWindows();
  assert(Array.isArray(activeWindows), 'Must return array of active windows');
  console.log(`  [PASS] Active windows enumeration: found ${activeWindows.length} visible windows`);
  if (activeWindows.length > 0) {
    console.log(`         Sample: [PID ${activeWindows[0].pid}] ${activeWindows[0].processName} - "${activeWindows[0].windowTitle.substring(0, 40)}"`);
  }

  // Test 4: AppLauncher integration with discovered applications
  const searchRes = await appLauncherInstance.findInstalledApplications('');
  assert(searchRes.success && searchRes.count > 0, 'findInstalledApplications must succeed with merged apps');
  console.log(`  [PASS] AppLauncher integration: total indexed applications = ${searchRes.count}`);

  console.log('=== WORKSTREAM B: ALL ACCEPTANCE TESTS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
