const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

async function verifyAfterReboot() {
  console.log('======================================================================');
  console.log('STARK AI — POST-REBOOT EMERGENCY STOP LATCH VERIFICATION');
  console.log('======================================================================\n');

  const projectRoot = path.resolve(__dirname, '..');
  const stateFile = path.join(projectRoot, 'data', 'emergency_stop_state.json');
  const resultLog = path.join(projectRoot, 'data', 'reboot_verification_result.json');

  console.log(`Checking non-volatile persistence state file: ${stateFile}`);
  if (!fs.existsSync(stateFile)) {
    console.error('FATAL: emergency_stop_state.json not found!');
    process.exit(1);
  }

  const rawState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  console.log('Persisted state on disk:');
  console.log(JSON.stringify(rawState, null, 2));

  // 1. Verify that isLatched is true
  const latchRetained = rawState.isLatched === true;
  console.log(`\n1. Latch state retained on disk: ${latchRetained ? 'YES (LATCHED)' : 'NO'}`);

  // 2. Instantiate fresh EmergencyStopController (cold boot)
  const { EmergencyStopController } = require('../server/emergencyStopController.js');
  const controller = new EmergencyStopController({ projectRoot });
  const isEngagedOnStartup = controller.isEngaged();
  console.log(`2. Fresh Controller instance starts in HALTED state: ${isEngagedOnStartup ? 'YES (HALTED)' : 'NO'}`);

  // 3. Test that tool execution is blocked
  const { executeTool } = require('../server/toolsRegistry.js');
  let toolBlocked = false;
  try {
    await executeTool('get_current_time', {}, 'JARVIS');
  } catch (err) {
    toolBlocked = err.message.includes('EMERGENCY_STOP_ACTIVE');
    console.log(`3. Tool execution rejected on boot: ${toolBlocked ? 'YES (BLOCKED)' : 'NO'} (${err.message})`);
  }

  // 4. Test authenticated reset
  console.log('\n4. Testing authenticated reset to STANDBY...');
  controller.reset('Post-reboot test standby restoration');
  const isStandbyAfterReset = !controller.isEngaged();
  console.log(`   Controller returned to STANDBY: ${isStandbyAfterReset ? 'YES' : 'NO'}`);

  // Write verification artifact
  const record = {
    verifiedAt: new Date().toISOString(),
    hostUptimeSeconds: Math.round(process.uptime()),
    osUptimeSeconds: Math.round(require('os').uptime()),
    latchRetainedOnDisk: latchRetained,
    startedInHaltedState: isEngagedOnStartup,
    toolExecutionBlocked: toolBlocked,
    authenticatedResetSuccessful: isStandbyAfterReset,
    verdict: (latchRetained && isEngagedOnStartup && toolBlocked && isStandbyAfterReset) ? 'VERIFIED_PASSED' : 'VERIFIED_FAILED'
  };

  fs.writeFileSync(resultLog, JSON.stringify(record, null, 2), 'utf8');
  console.log(`\nSaved verification results to: ${resultLog}`);
  console.log('======================================================================');
}

verifyAfterReboot().catch(console.error);

