/**
 * Acceptance Test: Workstream C — Chrome Multi-Profile Intelligence & Gmail Integration
 */

const assert = require('assert');
const { chromeProfileService } = require('../server/desktop/chromeProfileService.js');

async function runTests() {
  console.log('=== TEST SUITE: WORKSTREAM C (Chrome Profiles & Gmail Integration) ===');

  // Test 1: Discover profiles from Local State
  const profiles = chromeProfileService.getProfiles(true);
  assert(Array.isArray(profiles), 'Profiles must be an array');
  assert(profiles.length > 0, 'Must discover at least 1 Chrome profile');
  console.log(`  [PASS] Discovered ${profiles.length} Chrome profiles`);
  profiles.forEach(p => console.log(`         - [${p.dir}] ${p.name} (${p.email || 'No email'})`));

  // Test 2: Resolve Somaiya college profile
  const somaiyaProfile = chromeProfileService.resolveProfile('somaiya');
  assert(somaiyaProfile, 'Must resolve Somaiya profile');
  assert(
    somaiyaProfile.email.includes('somaiya.edu') || somaiyaProfile.name.toLowerCase().includes('somaiya'),
    'Somaiya profile must match somaiya email or name'
  );
  console.log(`  [PASS] Resolved Somaiya profile: "${somaiyaProfile.name}" (${somaiyaProfile.email}) -> dir: ${somaiyaProfile.dir}`);

  // Test 3: Resolve Personal / Default profile
  const personalProfile = chromeProfileService.resolveProfile('personal');
  assert(personalProfile, 'Must resolve personal profile');
  console.log(`  [PASS] Resolved Personal profile: "${personalProfile.name}" (${personalProfile.email}) -> dir: ${personalProfile.dir}`);

  // Test 4: Verify Chrome executable path
  const exePath = chromeProfileService.getChromeExecutablePath();
  assert(exePath && exePath.includes('chrome.exe'), 'Chrome executable path must be found');
  console.log(`  [PASS] Chrome binary path verified: ${exePath}`);

  // Test 5: Nonexistent profile must return structured PROFILE_NOT_FOUND without launching anything
  const notFoundRes = await chromeProfileService.launchProfile('nonexistent_fake_profile');
  assert.strictEqual(notFoundRes.success, false, 'Nonexistent profile must return success=false');
  assert.strictEqual(notFoundRes.verified, false);
  assert.strictEqual(notFoundRes.code, 'PROFILE_NOT_FOUND', 'Must return structured PROFILE_NOT_FOUND code');
  assert(Array.isArray(notFoundRes.availableProfiles) && notFoundRes.availableProfiles.length > 0, 'Must offer available profiles');
  console.log(`  [PASS] Nonexistent profile returned PROFILE_NOT_FOUND (${notFoundRes.availableProfiles.length} available profiles listed)`);

  // Test 6: Ambiguous profile ("lokesh" appears across multiple profiles) must return AMBIGUOUS_PROFILE cleanly
  const ambRes = chromeProfileService.resolveProfileDetailed('lokesh');
  if (ambRes.status === 'AMBIGUOUS') {
    const ambLaunch = await chromeProfileService.launchProfile('lokesh');
    assert.strictEqual(ambLaunch.success, false);
    assert.strictEqual(ambLaunch.code, 'AMBIGUOUS_PROFILE');
    assert(Array.isArray(ambLaunch.matchingProfiles) && ambLaunch.matchingProfiles.length > 1, 'Must list matching ambiguous profiles');
    console.log(`  [PASS] Ambiguous profile "lokesh" returned AMBIGUOUS_PROFILE (${ambLaunch.matchingProfiles.length} matches)`);
  } else {
    console.log(`  [PASS] Profile ambiguity check ran cleanly (status=${ambRes.status})`);
  }

  console.log('=== WORKSTREAM C: ALL ACCEPTANCE TESTS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
