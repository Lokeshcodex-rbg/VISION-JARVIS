/**
 * Acceptance Test: Workstream E — Spotify Desktop Controller & Media Transport
 */

const assert = require('assert');
const { spotifyController, VK_CODES } = require('../server/desktop/spotifyController.js');
const { executeTool } = require('../server/toolsRegistry.js');

async function runTests() {
  console.log('=== TEST SUITE: WORKSTREAM E (Spotify Desktop Controller) ===');

  // Test 1: Verify VK_CODES
  assert.strictEqual(VK_CODES.PLAY_PAUSE, 0xB3, 'VK_MEDIA_PLAY_PAUSE must be 0xB3');
  assert.strictEqual(VK_CODES.NEXT_TRACK, 0xB0, 'VK_MEDIA_NEXT_TRACK must be 0xB0');
  console.log('  [PASS] Virtual Media Key codes verified');

  // Test 2: Query Spotify status (truthful check without crashing if not running)
  const status = await spotifyController.getStatus();
  assert(status && typeof status === 'object', 'Status must return object');
  console.log(`  [PASS] Spotify status query verified: running=${status.isRunning}, title="${status.windowTitle}"`);

  // Test 3: Execute tool spotify_get_status via registry & permission gate
  const toolStatus = await executeTool('spotify_get_status', {}, 'JARVIS');
  assert(toolStatus && toolStatus.success === true, 'spotify_get_status must succeed');
  console.log('  [PASS] spotify_get_status tool execution verified:', toolStatus.summary);

  // Test 4: Media key transport dispatch (non-blocking)
  const keyRes = await spotifyController.sendMediaKey(VK_CODES.PLAY_PAUSE);
  assert(keyRes === true, 'Media key dispatch must succeed');
  console.log('  [PASS] Virtual keybd_event media key dispatch verified');

  console.log('=== WORKSTREAM E: ALL ACCEPTANCE TESTS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
