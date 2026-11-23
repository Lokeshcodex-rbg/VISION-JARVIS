/**
 * Acceptance Test: Workstream I — Structured Error Diagnosis & Error ID Ledger
 */

const assert = require('assert');
const { errorDiagnostics, ErrorCode } = require('../server/errorDiagnosticsService.js');

async function runTests() {
  console.log('=== TEST SUITE: WORKSTREAM I (Error Diagnostics & Ledger) ===');

  // Test 1: Classify rate limits
  const rateLimitErr = new Error('HTTP 429 RESOURCE_EXHAUSTED quota exceeded');
  const code1 = errorDiagnostics.classify(rateLimitErr, { subsystem: 'gemini' });
  assert.strictEqual(code1, ErrorCode.ERR_AI_RATE_LIMITED, 'Should classify 429 as ERR_AI_RATE_LIMITED');
  console.log('  [PASS] Rate limit classification verified');

  // Test 2: Classify WhatsApp contact error
  const waErr = new Error('Could not find contact Harsh in WhatsApp');
  const code2 = errorDiagnostics.classify(waErr, { subsystem: 'whatsapp' });
  assert.strictEqual(code2, ErrorCode.ERR_WHATSAPP_CONTACT_NOT_FOUND, 'Should classify as ERR_WHATSAPP_CONTACT_NOT_FOUND');
  console.log('  [PASS] WhatsApp contact classification verified');

  // Test 3: Record error, verify ledger structure and spoken explanation
  const recorded = errorDiagnostics.record(waErr, { subsystem: 'whatsapp', target: 'Harsh' });
  assert(recorded.errorId.startsWith('ERR-'), 'Error ID must start with ERR-');
  assert.strictEqual(recorded.code, ErrorCode.ERR_WHATSAPP_CONTACT_NOT_FOUND);
  assert(recorded.spokenExplanation.includes('Harsh'), 'Spoken explanation must reference the target');
  assert(recorded.recoveryActions.length > 0, 'Recovery actions must not be empty');
  console.log('  [PASS] Record generation verified:', recorded.errorId);

  // Test 4: Query recent errors from ledger
  const recent = errorDiagnostics.getRecentErrors(5);
  assert(recent.some(e => e.errorId === recorded.errorId), 'Recorded error must appear in recent errors');
  console.log('  [PASS] Recent errors ledger retrieval verified');

  // Test 5: Resolve error
  const resolved = errorDiagnostics.resolveError(recorded.errorId);
  assert.strictEqual(resolved, true, 'Error should be marked resolved');
  console.log('  [PASS] Error resolution verified');

  // Test 6: API key sanitization
  const secretErr = new Error('Failed with key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q in URL');
  const recSecret = errorDiagnostics.record(secretErr, { subsystem: 'core' });
  assert(!recSecret.technicalDetail.includes('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q'), 'Secret key must be redacted');
  assert(recSecret.technicalDetail.includes('[REDACTED_API_KEY]'), 'Secret key must be replaced with placeholder');
  console.log('  [PASS] Secret sanitization verified');

  console.log('=== WORKSTREAM I: ALL ACCEPTANCE TESTS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
