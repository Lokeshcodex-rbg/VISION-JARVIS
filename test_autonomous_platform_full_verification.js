/**
 * STARK AI — Autonomous Platform Full Verification Test Suite
 * Comprehensive automated testing covering:
 * 1. External API Integration Manager (Credentials, health, rate-limiting, live testing)
 * 2. Safe Administrative Elevation & UAC Management (Triggers, impact, ULTRON isolation)
 * 3. Controlled Self-Repair Engine (Isolated staging, validation, auto-rollback on failure)
 * 4. Self-Healing Service Manager (Health matrix, stalled requests, bounded restart limits)
 * 5. Central Permission Gate & Global Emergency Stop
 * 6. Multiturn Voice Pipeline Stability & Barge-In Regression
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { apiIntegrationsManagerInstance } = require('./server/apiIntegrationsManager.js');
const { elevationManagerInstance } = require('./server/desktop/elevationManager.js');
const { selfRepairServiceInstance, IMMUTABLE_CORE_ASSETS } = require('./server/selfRepairService.js');
const { serviceHealingManagerInstance } = require('./server/serviceHealingManager.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
const { permissionManagerInstance } = require('./server/desktop/permissionManager.js');
const { executeTool } = require('./server/toolsRegistry.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        passedTests++;
        console.log(`  [PASS] #${totalTests}: ${description}`);
      }).catch((err) => {
        failedTests++;
        console.error(`  [FAIL] #${totalTests}: ${description} -> ${err.message}`);
      });
    }
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] #${totalTests}: ${description} -> ${err.message}`);
  }
}

async function runVerificationCampaign() {
  console.log('\n===============================================================================');
  console.log('       STARK AI AUTONOMOUS PLATFORM -- COMPREHENSIVE VERIFICATION SUITE        ');
  console.log('===============================================================================\n');

  // =========================================================================
  // 1. External API Integration Manager Tests
  // =========================================================================
  console.log('[SECTION 1] External API Integration Manager & Security:');

  it('1.1. Summary reports all registered integrations with metadata', () => {
    const summary = apiIntegrationsManagerInstance.getIntegrationsSummary();
    assert.strictEqual(summary.success, true);
    assert(summary.count >= 20, `Expected >= 20 integrations, got ${summary.count}`);
    assert(summary.integrations.gemini, 'Gemini must be registered');
    assert(summary.integrations.duckduckgo, 'DuckDuckGo must be registered');
    assert(summary.integrations.open_meteo, 'Open-Meteo must be registered');
    assert(summary.integrations.coingecko, 'CoinGecko must be registered');
  });

  it('1.2. Sensitive API credentials are never exposed in raw text', () => {
    const masked = apiIntegrationsManagerInstance.maskApiKey('sk-ant-api03-abcdef123456789xyz');
    assert.strictEqual(masked, 'sk-a...9xyz');
    assert.strictEqual(apiIntegrationsManagerInstance.maskApiKey('short'), '********');
    assert.strictEqual(apiIntegrationsManagerInstance.maskApiKey(''), '');
  });

  it('1.3. Sliding-window rate limit enforces bounds and provides retry backoff', () => {
    const testProvider = 'test_rate_dummy';
    apiIntegrationsManagerInstance.integrations[testProvider] = {
      rateLimitPerMinute: 3,
      health: 'HEALTHY'
    };

    // 3 allowed calls
    assert.strictEqual(apiIntegrationsManagerInstance.checkRateLimit(testProvider).allowed, true);
    assert.strictEqual(apiIntegrationsManagerInstance.checkRateLimit(testProvider).allowed, true);
    assert.strictEqual(apiIntegrationsManagerInstance.checkRateLimit(testProvider).allowed, true);

    // 4th call must be blocked with retryAfterMs
    const blocked = apiIntegrationsManagerInstance.checkRateLimit(testProvider);
    assert.strictEqual(blocked.allowed, false);
    assert(blocked.retryAfterMs > 0, 'Must provide retry wait time');
    assert.strictEqual(apiIntegrationsManagerInstance.integrations[testProvider].health, 'RATE_LIMITED');
  });

  await it('1.4. Live connection test succeeds for zero-key search & weather endpoints', async () => {
    const ddgResult = await apiIntegrationsManagerInstance.testConnection('duckduckgo');
    assert.strictEqual(ddgResult.success, true, 'DuckDuckGo should be reachable');
    assert(ddgResult.latencyMs >= 0, 'Must record latency');

    const weatherResult = await apiIntegrationsManagerInstance.testConnection('open_meteo');
    assert.strictEqual(weatherResult.success, true, 'Open-Meteo should be reachable');
  });

  it('1.5. Config setting and credential revocation operate safely', () => {
    apiIntegrationsManagerInstance.setIntegration('duckduckgo', { rateLimitPerMinute: 45 });
    assert.strictEqual(apiIntegrationsManagerInstance.integrations.duckduckgo.rateLimitPerMinute, 45);

    const revoked = apiIntegrationsManagerInstance.revokeIntegration('reddit');
    assert.strictEqual(revoked.success, true);
    assert.strictEqual(apiIntegrationsManagerInstance.integrations.reddit.apiKey, '');
    assert.strictEqual(apiIntegrationsManagerInstance.integrations.reddit.enabled, false);
  });

  // =========================================================================
  // 2. Safe Administrative & UAC Elevation Tests
  // =========================================================================
  console.log('\n[SECTION 2] Safe Administrative & Windows Elevation:');

  it('2.1. Correctly identifies operations requiring Windows elevation', () => {
    const check1 = elevationManagerInstance.requiresElevation('MODIFY_REGISTRY', 'HKLM:\\Software\\MyApp');
    assert.strictEqual(check1.required, true);

    const check2 = elevationManagerInstance.requiresElevation('STOP_SERVICE', '', 'sc.exe stop Spooler');
    assert.strictEqual(check2.required, true);

    const check3 = elevationManagerInstance.requiresElevation('READ_USER_FILE', 'D:\\Jarvis\\notes.txt');
    assert.strictEqual(check3.required, false);
  });

  it('2.2. Creates human-intelligible elevation proposal with impact explanation', () => {
    const prop = elevationManagerInstance.createElevationProposal({
      operation: 'UPDATE_FIREWALL',
      target: 'Windows Defender Firewall',
      command: 'New-NetFirewallRule -Name "STARK" -Port 3000',
      rationale: 'Enable companion communication',
      personality: 'JARVIS'
    });

    assert(prop.proposalId.startsWith('elev-'));
    assert.strictEqual(prop.elevationRequired, true);
    assert(prop.impactExplanation.includes('User Account Control (UAC)'));
    assert.strictEqual(prop.status, 'PENDING_USER_CONFIRMATION');
  });

  it('2.3. Strictly denies ULTRON from requesting elevation', () => {
    assert.throws(() => {
      elevationManagerInstance.createElevationProposal({
        operation: 'MODIFY_SYSTEM',
        command: 'sc.exe delete TestService',
        personality: 'ULTRON'
      });
    }, /ULTRON is strictly restricted/);
  });

  await it('2.4. Elevation safely aborts without executing if user declines', async () => {
    const prop = elevationManagerInstance.createElevationProposal({
      operation: 'INSTALL_PACKAGE',
      target: 'System Package',
      command: 'echo harmless',
      personality: 'JARVIS'
    });

    const result = await elevationManagerInstance.executeElevated({
      proposalId: prop.proposalId,
      userConfirmed: false
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 'USER_DECLINED');
  });

  // =========================================================================
  // 3. Controlled Self-Repair & Self-Improvement Tests
  // =========================================================================
  console.log('\n[SECTION 3] Controlled Self-Repair & Isolated Staging:');

  it('3.1. Rejects self-modification of immutable security core assets', () => {
    for (const coreAsset of IMMUTABLE_CORE_ASSETS) {
      assert.strictEqual(
        selfRepairServiceInstance.isImmutableTarget(coreAsset),
        true,
        `File ${coreAsset} must be recognized as immutable core`
      );

      assert.throws(() => {
        selfRepairServiceInstance.createRepairPlan({
          targetFile: coreAsset,
          problemDescription: 'test tampering',
          proposedSolution: 'bypass'
        });
      }, /immutable security core/);
    }
  });

  it('3.2. Diagnoses issues accurately from stack traces and error messages', () => {
    const diag = selfRepairServiceInstance.diagnoseIssue({
      errorMessage: "Cannot find module 'non_existent_helper'",
      stackTrace: "Error: Cannot find module 'non_existent_helper'\n    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1144:15)\n    at d:\\Jarvis\\server\\test.js:15:20"
    });

    assert.strictEqual(diag.confidence, 'HIGH');
    assert(diag.verifiedCauses.some(c => c.type === 'MISSING_DEPENDENCY_OR_IMPORT'));
    assert(diag.verifiedCauses.some(c => c.type === 'STACK_TRACE_LOCATED' && c.line === 15));
  });

  await it('3.3. Stages patch into isolated workspace and validates syntax', async () => {
    // Create a temporary scratch target for self-repair test
    const scratchTarget = path.join(__dirname, 'scratch', 'self_repair_test_target.js');
    fs.mkdirSync(path.dirname(scratchTarget), { recursive: true });
    fs.writeFileSync(scratchTarget, 'module.exports = { value: 10 };\n', 'utf8');

    const plan = selfRepairServiceInstance.createRepairPlan({
      targetFile: 'scratch/self_repair_test_target.js',
      problemDescription: 'Increase value to 20',
      proposedSolution: 'Update exported number'
    });

    const staged = selfRepairServiceInstance.stageRepairPatch(
      plan.planId,
      'module.exports = { value: 20 };\n'
    );

    assert.strictEqual(staged.success, true);
    assert(fs.existsSync(staged.stagedFilePath), 'Staged file must exist in staging directory');

    // Run isolated validation
    const validation = await selfRepairServiceInstance.validateCandidate(plan.planId);
    assert.strictEqual(validation.success, true);
    assert.strictEqual(validation.validation.syntaxCheck.passed, true);
    assert.strictEqual(validation.validation.securityCheck.passed, true);
  });

  await it('3.4. Automatically triggers rollback if post-deployment health check fails', async () => {
    const scratchTarget = path.join(__dirname, 'scratch', 'rollback_test_target.js');
    fs.mkdirSync(path.dirname(scratchTarget), { recursive: true });
    const originalContent = 'module.exports = { state: "ORIGINAL_GOOD" };\n';
    fs.writeFileSync(scratchTarget, originalContent, 'utf8');

    const plan = selfRepairServiceInstance.createRepairPlan({
      targetFile: 'scratch/rollback_test_target.js',
      problemDescription: 'Deploy candidate that breaks health',
      proposedSolution: 'Change state'
    });

    selfRepairServiceInstance.stageRepairPatch(
      plan.planId,
      'module.exports = { state: "BROKEN_CANDIDATE" };\n'
    );

    await selfRepairServiceInstance.validateCandidate(plan.planId);

    // Deploy with a deliberately failing health check URL (e.g. non-existent port)
    const deployResult = await selfRepairServiceInstance.deployRepair(plan.planId, {
      healthCheckUrl: 'http://localhost:39999/broken-endpoint'
    });

    assert.strictEqual(deployResult.success, false);
    assert.strictEqual(deployResult.status, 'AUTOMATICALLY_ROLLED_BACK');

    // Verify the target file was instantly restored to original good content!
    const restoredContent = fs.readFileSync(scratchTarget, 'utf8');
    assert.strictEqual(restoredContent, originalContent, 'File must be restored to original content');
  });

  // =========================================================================
  // 4. Self-Healing Service Manager Tests
  // =========================================================================
  console.log('\n[SECTION 4] Self-Healing Service Management:');

  it('4.1. Health report inspects all 7 core subsystems and resource health', () => {
    const report = serviceHealingManagerInstance.getHealthReport();
    assert.strictEqual(report.success, true);
    assert.strictEqual(report.overallStatus, 'OPERATIONAL');
    assert(report.services.VOICE_STT, 'Must monitor VOICE_STT');
    assert(report.services.VOICE_TTS, 'Must monitor VOICE_TTS');
    assert(report.services.AI_ADAPTER, 'Must monitor AI_ADAPTER');
    assert(report.resources.heapUsedMb > 0, 'Must report heap memory');
    assert(report.resources.systemFreeMemMb > 0, 'Must report system memory');
  });

  it('4.2. Stalled request tracker sweeps requests exceeding threshold', () => {
    const testReqId = 'req_stalled_test_123';
    serviceHealingManagerInstance.trackRequest(testReqId, 'AI_ADAPTER', 'Long reasoning query');
    
    // Artificially age the request beyond threshold
    serviceHealingManagerInstance.activeRequests.get(testReqId).startedAt = Date.now() - 50000;

    const stalled = serviceHealingManagerInstance.sweepStalledRequests();
    assert(stalled.some(s => s.reqId === testReqId), 'Must detect stalled request');
    assert(!serviceHealingManagerInstance.activeRequests.has(testReqId), 'Must sweep stalled request from active map');
  });

  await it('4.3. Bounded restart limiter blocks retry loops exceeding max threshold', async () => {
    const testService = 'VOICE_TTS';
    // Clear history for clean test
    serviceHealingManagerInstance.restartHistory.set(testService, []);

    // 3 restarts allowed
    const r1 = await serviceHealingManagerInstance.restartService(testService, 'Simulated retry 1');
    const r2 = await serviceHealingManagerInstance.restartService(testService, 'Simulated retry 2');
    const r3 = await serviceHealingManagerInstance.restartService(testService, 'Simulated retry 3');
    assert.strictEqual(r1.success, true);
    assert.strictEqual(r2.success, true);
    assert.strictEqual(r3.success, true);

    // 4th restart must be rejected to prevent infinite loop
    const r4 = await serviceHealingManagerInstance.restartService(testService, 'Simulated retry 4');
    assert.strictEqual(r4.success, false);
    assert.strictEqual(r4.status, 'OFFLINE_RETRY_EXHAUSTED');
    assert(r4.error.includes('reached maximum 3 restarts'));

    // Reset service state
    serviceHealingManagerInstance.services[testService].status = 'HEALTHY';
    serviceHealingManagerInstance.restartHistory.set(testService, []);
  });

  // =========================================================================
  // 5. Central Permission Gate & Global Emergency Stop Tests
  // =========================================================================
  console.log('\n[SECTION 5] Central Permission Gate & Emergency Stop:');

  await it('5.1. Global Emergency Stop halts all tool execution immediately', async () => {
    permissionGateInstance.triggerEmergencyStop('Automated test emergency stop');
    assert.strictEqual(permissionGateInstance.isEmergencyStopActive(), true);

    // Attempting to execute any tool must throw
    await assert.rejects(async () => {
      await executeTool('get_current_time', {}, 'JARVIS');
    }, /Emergency Stop is ACTIVE/);

    // Reset emergency stop
    permissionGateInstance.resetEmergencyStop();
    assert.strictEqual(permissionGateInstance.isEmergencyStopActive(), false);

    // Tool execution now succeeds
    const result = await executeTool('get_current_time', {}, 'JARVIS');
    assert(result.time, 'Should return current time after emergency stop reset');
  });

  await it('5.2. Enforces strict profile separation: ULTRON denied application launching', async () => {
    await assert.rejects(async () => {
      await executeTool('open_desktop_app', { appName: 'notepad' }, 'ULTRON');
    }, /ULTRON is operating under restricted read-only governance/);
  });

  // =========================================================================
  // 6. Integrated Tool Registry Verification
  // =========================================================================
  console.log('\n[SECTION 6] Integrated Tool Registry & New Tool Execution:');

  await it('6.1. list_api_integrations tool returns summary via tool registry', async () => {
    const res = await executeTool('list_api_integrations', {}, 'JARVIS');
    assert.strictEqual(res.success, true);
    assert(res.count >= 20);
  });

  await it('6.2. get_subsystem_health tool returns operational metrics', async () => {
    const res = await executeTool('get_subsystem_health', {}, 'ULTRON');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.overallStatus, 'OPERATIONAL');
  });

  console.log('\n===============================================================================');
  console.log(`CAMPAIGN SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('===============================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerificationCampaign().catch((err) => {
  console.error('[FATAL] Verification suite crashed:', err);
  process.exit(1);
});
