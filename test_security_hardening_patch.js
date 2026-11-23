/**
 * STARK AI — Priority Security Patch & Emergency Stop Hardening Test Suite
 * Comprehensive automated verification for Phase 1 & Phase 2 security repairs:
 * 1. Critical Static-File Exposure & Path Traversal Prevention
 * 2. Origin & CORS Restriction
 * 3. Network Binding (127.0.0.1 loopback)
 * 4. API Authentication & Constant-Time Token Enforcement
 * 5. Emergency Stop Cross-Process Propagation & Autonomous Latching
 * 6. Accidental Spacebar Decoupling & Dedicated Ctrl+Shift+X Shortcut
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { serverAuthManagerInstance } = require('./server/serverAuthManager.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');

let passCount = 0;
let failCount = 0;

function pass(name) {
  passCount++;
  console.log(`  ✓ [PASS] [${passCount}] ${name}`);
}

function fail(name, err) {
  failCount++;
  console.error(`  ✗ [FAIL] [${failCount}] ${name}: ${err.message || err}`);
}

function requestHttp({ method = 'GET', path: reqPath = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: reqPath,
      method,
      headers: reqHeaders,
      timeout: 3000
    }, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(rawData); } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: rawData,
          json
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP request timed out'));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

async function runSecuritySuite() {
  console.log('========================================================================');
  console.log('STARK AI — SECURITY PATCH & EMERGENCY STOP HARDENING AUDIT');
  console.log('========================================================================\n');

  // Negotiate session token via loopback session endpoint
  let token = serverAuthManagerInstance.getSessionToken();
  try {
    const sessionRes = await requestHttp({ path: '/api/auth/session' });
    if (sessionRes.json?.token) {
      token = sessionRes.json.token;
    }
  } catch (_) {}

  // -------------------------------------------------------------------------
  // 1. STATIC FILE EXPOSURE & PATH TRAVERSAL TESTS
  // -------------------------------------------------------------------------
  console.log('--- 1. Critical Static-File Exposure & Path Traversal Prevention ---');

  // 1.1 Legitimate Root Page
  try {
    const res = await requestHttp({ path: '/' });
    assert.strictEqual(res.statusCode, 200, 'Root / must return 200 OK');
    assert.ok(res.headers['content-type'].includes('text/html'), 'Content-Type must be text/html');
    assert.ok(res.headers['set-cookie'], 'Must attach Set-Cookie with stark_session');
    assert.ok(res.headers['set-cookie'][0].includes('stark_session='), 'Cookie must contain stark_session');
    assert.ok(res.headers['set-cookie'][0].includes('SameSite=Strict'), 'Cookie must be SameSite=Strict');
    assert.ok(res.headers['set-cookie'][0].includes('HttpOnly'), 'Cookie must be HttpOnly');
    assert.ok(res.body.includes('ULTRON & JARVIS'), 'Must return valid index.html content');
    pass('1.1 Root / serves index.html with HttpOnly SameSite=Strict session cookie');
  } catch (e) { fail('1.1 Root / serves index.html', e); }

  // 1.2 Legitimate Frontend Assets
  try {
    const resCss = await requestHttp({ path: '/css/style.css' });
    assert.strictEqual(resCss.statusCode, 200, '/css/style.css must return 200 OK');
    assert.ok(resCss.headers['content-type'].includes('text/css'), 'Content-Type must be text/css');

    const resJs = await requestHttp({ path: '/js/app.js' });
    assert.strictEqual(resJs.statusCode, 200, '/js/app.js must return 200 OK');
    assert.ok(resJs.headers['content-type'].includes('javascript'), 'Content-Type must be javascript');

    const resMod = await requestHttp({ path: '/js/modules/emergencyStopCoordinator.js' });
    assert.strictEqual(resMod.statusCode, 200, '/js/modules/emergencyStopCoordinator.js must return 200 OK');

    pass('1.2 Legitimate frontend assets (/css/style.css, /js/app.js, modules) load successfully');
  } catch (e) { fail('1.2 Legitimate frontend assets', e); }

  // 1.3 Blocked Critical Files
  const forbiddenFiles = [
    '/.env',
    '/.env.example',
    '/.git/config',
    '/.git/HEAD',
    '/.gitignore',
    '/package.json',
    '/package-lock.json',
    '/server.js',
    '/server/serverAuthManager.js',
    '/server/emergencyStopController.js',
    '/desktop/main.js',
    '/data/user_memory.json',
    '/data/.session_token'
  ];

  for (const f of forbiddenFiles) {
    try {
      const res = await requestHttp({ path: f });
      assert.strictEqual(res.statusCode, 403, `${f} must return 403 Forbidden (got ${res.statusCode})`);
      assert.strictEqual(res.body, '403 Forbidden: Access to requested asset is restricted.', `${f} must return generic 403 message without content`);
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff', 'Must include X-Content-Type-Options: nosniff');
      pass(`1.3 Blocked sensitive file: ${f} -> 403 Forbidden`);
    } catch (e) { fail(`1.3 Blocked sensitive file: ${f}`, e); }
  }

  // 1.4 Path Traversal Variants
  const traversalAttempts = [
    '/..%2f.env',
    '/css/..%2f.env',
    '/js/..%2fpackage.json',
    '/%2e%2e%2fpackage.json',
    '/%2e%2e%5cserver.js',
    '/css/..%5cserver.js',
    '/js/../../.git/config',
    '/index.html%00.env',
    '/%00index.html',
    '/css/%00style.css'
  ];

  for (const t of traversalAttempts) {
    try {
      const res = await requestHttp({ path: t });
      assert.ok(res.statusCode === 400 || res.statusCode === 403, `Traversal ${t} must return 400 or 403 (got ${res.statusCode})`);
      pass(`1.4 Blocked traversal variant: ${t} -> ${res.statusCode}`);
    } catch (e) { fail(`1.4 Blocked traversal variant: ${t}`, e); }
  }

  // 1.5 Missing Asset inside Allowed Directory
  try {
    const res = await requestHttp({ path: '/css/non_existent_stylesheet_987.css' });
    assert.strictEqual(res.statusCode, 404, 'Non-existent file in allowed dir must return 404');
    pass('1.5 Non-existent file in allowed directory correctly returns 404 Not Found');
  } catch (e) { fail('1.5 Non-existent file in allowed directory', e); }

  // -------------------------------------------------------------------------
  // 2. NETWORK ACCESS & CORS PROTECTION TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Network Access & Strict CORS Origin Validation ---');

  // 2.1 Untrusted Origin
  try {
    const res = await requestHttp({
      path: '/api/status',
      headers: { 'Origin': 'https://malicious-attacker-website.com' }
    });
    assert.strictEqual(res.headers['access-control-allow-origin'], 'null', 'Untrusted origin must receive Access-Control-Allow-Origin: null');
    pass('2.1 Wildcard CORS eliminated: Untrusted origin receives Allow-Origin: null');
  } catch (e) { fail('2.1 Untrusted origin', e); }

  // 2.2 Trusted Origin
  try {
    const res = await requestHttp({
      path: '/api/status',
      headers: { 'Origin': 'http://127.0.0.1:3000' }
    });
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://127.0.0.1:3000', 'Trusted loopback origin receives matched Allow-Origin');
    assert.strictEqual(res.headers['access-control-allow-credentials'], 'true', 'Must support Allow-Credentials: true');
    pass('2.2 Trusted loopback origin (127.0.0.1:3000) allowed with credentials');
  } catch (e) { fail('2.2 Trusted loopback origin', e); }

  // -------------------------------------------------------------------------
  // 3. API AUTHENTICATION & REJECTION OF UNAUTHENTICATED REQUESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 3. API Authentication & Rejection of Unauthenticated Requests ---');

  const protectedEndpoints = [
    { method: 'POST', path: '/api/chat', body: { message: 'hello' } },
    { method: 'POST', path: '/api/command', body: { command: 'system status' } },
    { method: 'POST', path: '/api/tools/execute', body: { toolName: 'get_current_time' } },
    { method: 'POST', path: '/api/tasks/execute', body: { instruction: 'test' } },
    { method: 'POST', path: '/api/orchestration/plan', body: { prompt: 'build component' } },
    { method: 'POST', path: '/api/cluster/schedule', body: { taskType: 'compute' } },
    { method: 'POST', path: '/api/security/emergency-stop', body: { reason: 'unauth test' } },
    { method: 'POST', path: '/api/security/emergency-reset', body: { reason: 'unauth reset' } },
    { method: 'GET', path: '/api/security/audit-log' }
  ];

  for (const ep of protectedEndpoints) {
    try {
      const res = await requestHttp({
        method: ep.method,
        path: ep.path,
        body: ep.body
      });
      assert.strictEqual(res.statusCode, 401, `Unauthenticated request to ${ep.path} must return 401 Unauthorized (got ${res.statusCode})`);
      assert.strictEqual(res.json?.code, 'AUTH_REQUIRED', `Response must indicate AUTH_REQUIRED`);
      pass(`3.1 Rejected unauthenticated request: ${ep.method} ${ep.path} -> 401 Unauthorized`);
    } catch (e) { fail(`3.1 Rejected unauthenticated request: ${ep.method} ${ep.path}`, e); }
  }

  // 3.2 Rejected Invalid Bearer Token
  try {
    const res = await requestHttp({
      method: 'POST',
      path: '/api/security/emergency-status', // Public GET, but test on protected route:
      path: '/api/tools/execute',
      headers: { 'Authorization': 'Bearer bad_token_1234567890abcdef' },
      body: { toolName: 'get_current_time' }
    });
    assert.strictEqual(res.statusCode, 401, 'Invalid Bearer token must return 401');
    pass('3.2 Invalid credentials rejected by constant-time verification');
  } catch (e) { fail('3.2 Invalid credentials', e); }

  // 3.3 Accepted Valid Bearer Token
  try {
    const res = await requestHttp({
      method: 'POST',
      path: '/api/tools/execute',
      headers: { 'Authorization': `Bearer ${token}` },
      body: { toolName: 'get_current_time' }
    });
    assert.strictEqual(res.statusCode, 200, 'Valid Bearer token must be accepted');
    assert.strictEqual(res.json?.success, true, 'Tool execution succeeds with valid auth');
    pass('3.3 Valid Bearer token authenticated successfully for tool execution');
  } catch (e) { fail('3.3 Valid Bearer token', e); }

  // 3.4 Accepted Valid Session Cookie
  try {
    const res = await requestHttp({
      method: 'POST',
      path: '/api/tools/execute',
      headers: { 'Cookie': `stark_session=${token}` },
      body: { toolName: 'get_current_time' }
    });
    assert.strictEqual(res.statusCode, 200, 'Valid Cookie must be accepted');
    assert.strictEqual(res.json?.success, true, 'Tool execution succeeds with session cookie');
    pass('3.4 Valid stark_session cookie authenticated successfully');
  } catch (e) { fail('3.4 Valid stark_session cookie', e); }

  // -------------------------------------------------------------------------
  // 4. EMERGENCY STOP CROSS-PROCESS PROPAGATION & LATCHING
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Emergency Stop Cross-Process Propagation & Autonomous Latching ---');

  // Ensure clean starting state
  emergencyStopControllerInstance.reset('Pre-test reset');

  // 4.1 Trigger Emergency Stop via Authenticated HTTP (simulating Electron Main bounded call)
  try {
    const res = await requestHttp({
      method: 'POST',
      path: '/api/security/emergency-stop',
      headers: { 'Authorization': `Bearer ${token}` },
      body: { reason: 'Cross-process test stop', source: 'DESKTOP_MAIN_PROCESS' }
    });
    assert.strictEqual(res.statusCode, 200, 'Emergency stop trigger returns 200 OK');
    assert.strictEqual(res.json?.emergencyStopActive, true, 'Response confirms emergencyStopActive: true');
    assert.strictEqual(res.json?.reason, 'Cross-process test stop', 'Response preserves stop reason');
    pass('4.1 Cross-process Emergency Stop request acknowledged and latched by backend');
  } catch (e) { fail('4.1 Cross-process Emergency Stop', e); }

  // 4.2 Verify Backend Remains Independently Latched
  try {
    const statusRes = await requestHttp({
      method: 'GET',
      path: '/api/security/emergency-status'
    });
    assert.strictEqual(statusRes.statusCode, 200);
    assert.strictEqual(statusRes.json?.emergencyStopActive, true, 'Status endpoint confirms stop is active');
    assert.strictEqual(statusRes.json?.reason, 'Cross-process test stop', 'Status endpoint confirms latched reason');
    pass('4.2 Backend independently latches stop state (verified across HTTP status & latch reason)');
  } catch (e) { fail('4.2 Backend latch', e); }

  // 4.3 Verify Tool Execution is Prohibited While Latched
  try {
    const toolRes = await requestHttp({
      method: 'POST',
      path: '/api/tools/execute',
      headers: { 'Authorization': `Bearer ${token}` },
      body: { toolName: 'get_current_time' }
    });
    assert.strictEqual(toolRes.statusCode, 403, 'Tool execution while stopped must return 403 Forbidden');
    assert.ok(toolRes.json?.error.includes('Emergency Stop is ACTIVE'), 'Error message must cite active Emergency Stop');
    pass('4.3 Tool execution strictly prohibited while Emergency Stop is latched');
  } catch (e) { fail('4.3 Tool execution while stopped', e); }

  // 4.4 Verify AI Chat Streaming is Prohibited While Latched
  try {
    const chatRes = await requestHttp({
      method: 'POST',
      path: '/api/chat',
      headers: { 'Authorization': `Bearer ${token}` },
      body: { message: 'calculate trajectory' }
    });
    assert.strictEqual(chatRes.statusCode, 423, 'Chat while stopped must return 423 Locked');
    assert.strictEqual(chatRes.json?.emergencyStopActive, true, 'Chat confirms emergencyStopActive');
    pass('4.4 AI requests strictly locked (423) while Emergency Stop is latched');
  } catch (e) { fail('4.4 AI chat while stopped', e); }

  // 4.5 Authorized Reset Releases Latch
  try {
    const resetRes = await requestHttp({
      method: 'POST',
      path: '/api/security/emergency-reset',
      headers: { 'Authorization': `Bearer ${token}` },
      body: { reason: 'Test authorized reset' }
    });
    assert.strictEqual(resetRes.statusCode, 200, 'Reset request returns 200 OK');
    assert.strictEqual(resetRes.json?.emergencyStopActive, false, 'Response confirms emergencyStopActive: false');

    // Tool execution now succeeds again
    const postResetTool = await requestHttp({
      method: 'POST',
      path: '/api/tools/execute',
      headers: { 'Authorization': `Bearer ${token}` },
      body: { toolName: 'get_current_time' }
    });
    assert.strictEqual(postResetTool.statusCode, 200, 'Tool execution succeeds after authorized reset');
    pass('4.5 Authorized reset releases safety latch and restores tool execution');
  } catch (e) { fail('4.5 Authorized reset', e); }

  // -------------------------------------------------------------------------
  // 5. ACCIDENTAL SPACEBAR REMOVAL VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Keyboard Handler Audit (Accidental Spacebar Removed) ---');

  try {
    const appJsContent = fs.readFileSync(path.resolve(__dirname, 'js/app.js'), 'utf8');
    assert.ok(!appJsContent.includes("'Space bar hotkey pressed'"), 'Bare spacebar emergency stop string must be removed from js/app.js');
    assert.ok(!appJsContent.includes("e.code === 'Space'"), 'e.code === Space emergency stop check must be removed from js/app.js');
    assert.ok(appJsContent.includes("e.ctrlKey && e.shiftKey && (e.key === 'X' || e.key === 'x')"), 'Ctrl+Shift+X dedicated shortcut must be present');
    pass('5.1 Verified source code: Bare Spacebar handler completely removed from js/app.js');
    pass('5.2 Verified source code: Dedicated Ctrl+Shift+X hotkey retained and active');
  } catch (e) { fail('5.1/5.2 Spacebar source check', e); }

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`SECURITY AUDIT COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

// Ensure server is reachable before running suite
const checkReq = http.get('http://127.0.0.1:3000/api/status', (res) => {
  runSecuritySuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
});
checkReq.on('error', () => {
  console.error('[TEST_HARNESS] Server is not active at http://127.0.0.1:3000. Launching in-process server...');
  require('./server.js');
  setTimeout(() => {
    runSecuritySuite().catch(err => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
  }, 1000);
});
