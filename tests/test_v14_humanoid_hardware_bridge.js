/**
 * Test Suite: VISION v1.4 Humanoid Hardware & Embodied Intelligence Bridge
 * tests/test_v14_humanoid_hardware_bridge.js
 *
 * Verifies:
 *   1. CRC16 checksum computation and ESP32 binary packet framing
 *   2. Packet unpacking and corruption/tamper detection
 *   3. 6-DOF joint angle validation (-180 to +180 deg) and payload serialization
 *   4. Cartesian delta movement command formatting
 *   5. Hardware watchdog ping generation
 *   6. Emergency Stop (E-Stop) hardware halt triggering
 *   7. Subsystem architecture decoupling (zero permanent laptop dependency)
 */

const assert = require('assert');
const { HumanoidHardwareBridge } = require('../server/robotics/humanoidHardwareBridge.js');
const { emergencyStopControllerInstance } = require('../server/emergencyStopController.js');

async function runHumanoidBridgeTests() {
  console.log('='.repeat(65));
  console.log('TEST SUITE: VISION v1.4 HUMANOID HARDWARE BRIDGE');
  console.log('='.repeat(65));

  const bridge = new HumanoidHardwareBridge({ portName: 'COM_ROBOT', watchdogIntervalMs: 100 });

  // 1. Packet Framing & CRC16 Test
  console.log('\n--- 1. Packet Framing & CRC16 Checksum Test ---');
  const testPayload = Buffer.from('VISION_MOTOR_01', 'utf8');
  const framed = bridge.framePacket(0x05, testPayload);
  assert(framed.length === 4 + testPayload.length + 2, 'Packet length should match header + payload + CRC');
  assert(framed[0] === 0xAA && framed[1] === 0x55, 'Sync bytes must be 0xAA 0x55');
  assert(framed[2] === 0x05, 'Command type should be 0x05');
  assert(framed[3] === testPayload.length, 'Payload length byte must match');

  const unpacked = bridge.unpackPacket(framed);
  assert(unpacked.valid === true, 'Unpack should succeed for valid packet');
  assert(unpacked.cmdType === 0x05, 'Command type must match');
  assert(unpacked.payload.toString('utf8') === 'VISION_MOTOR_01', 'Payload text must match');
  console.log('Packet framing and CRC16 verification passed.');

  // 2. Corrupted Packet Detection Test
  console.log('\n--- 2. Corrupted Packet Detection Test ---');
  const corrupted = Buffer.from(framed);
  corrupted[5] ^= 0xFF; // Bit flip inside payload
  const badUnpack = bridge.unpackPacket(corrupted);
  assert(badUnpack.valid === false, 'Corrupted packet must fail CRC verification');
  assert(badUnpack.error.includes('CRC mismatch'), 'Error must report CRC mismatch');
  console.log('Corrupted packet tamper detection passed.');

  // 3. Joint Angles & 6-DOF Bounds Clamping Test
  console.log('\n--- 3. 6-DOF Joint Angles Command & Bounds Test ---');
  const moveRes = await bridge.sendJointAngles({
    joint_1_base: 45.0,
    joint_2_shoulder: -30.0,
    joint_3_elbow: 90.0,
    joint_4_wrist_pitch: 200.0, // Should clamp to +180
    joint_5_wrist_roll: -220.0, // Should clamp to -180
    joint_6_gripper: 15.0
  });

  assert(moveRes.success === true, 'Movement command should succeed');
  assert(moveRes.appliedAngles.joint_4_wrist_pitch === 180.0, 'Wrist pitch must clamp to +180.0');
  assert(moveRes.appliedAngles.joint_5_wrist_roll === -180.0, 'Wrist roll must clamp to -180.0');
  assert(bridge.jointState.joint_1_base === 45.0, 'Internal state should record base angle');
  console.log('6-DOF joint angles validation and clamping passed.');

  // 4. Cartesian Movement Delta Test
  console.log('\n--- 4. Cartesian Movement Delta Test ---');
  const cartRes = await bridge.sendCartesianDelta(12.5, -5.0, 20.0);
  assert(cartRes.success === true, 'Cartesian movement command should succeed');
  assert(cartRes.delta.dx === 12.5, 'Delta X must match');
  assert(cartRes.delta.dy === -5.0, 'Delta Y must match');
  assert(cartRes.delta.dz === 20.0, 'Delta Z must match');
  console.log('Cartesian delta command formatting passed.');

  // 5. Hardware Watchdog Heartbeat Test
  console.log('\n--- 5. Hardware Watchdog Heartbeat Test ---');
  let pingsCount = 0;
  bridge.on('watchdog_ping', () => { pingsCount++; });
  bridge.startHardwareWatchdog();
  await new Promise(resolve => setTimeout(resolve, 250));
  bridge.stopHardwareWatchdog();
  assert(pingsCount >= 2, `Watchdog should emit at least 2 pings in 250ms (got ${pingsCount})`);
  console.log(`Watchdog generated ${pingsCount} heartbeat pings successfully.`);

  // 6. Emergency Halt Trigger Test
  console.log('\n--- 6. Emergency Halt Trigger Test ---');
  let haltFired = false;
  bridge.on('emergency_halt', (data) => {
    haltFired = true;
    assert(data.reason === 'Collision risk detected');
  });
  const haltRes = bridge.triggerEmergencyHalt('Collision risk detected');
  assert(haltRes.halted === true, 'Halt result must report halted: true');
  assert(haltFired === true, 'emergency_halt event must fire');
  console.log('Emergency halt hardware trigger passed.');

  // 7. Subsystem Decoupling & Architecture Verification
  console.log('\n--- 7. Subsystem Decoupling & Onboard Readiness ---');
  const status = bridge.getArchitectureStatus();
  assert(status.brand === 'VISION — MADE BY LOKESH', 'Brand must match');
  assert(status.laptopDependency === false, 'Laptop dependency must be false for onboard deployment');
  assert(status.modularDecoupling.reasoningAndLanguage.online === true, 'Reasoning subsystem must be modular');
  assert(status.modularDecoupling.robotMovement.online === true, 'Motion planner must be decoupled');
  assert(status.modularDecoupling.esp32SerialLink !== undefined, 'ESP32 link must be present');
  console.log(`Target Runtime: ${status.targetRuntime}`);
  console.log(`Laptop Dependency: ${status.laptopDependency}`);
  console.log('Modular subsystem architecture verified successfully.');

  console.log('\n' + '='.repeat(65));
  console.log('ALL VISION v1.4 HUMANOID HARDWARE BRIDGE TESTS PASSED!');
  console.log('='.repeat(65));
}

if (require.main === module) {
  runHumanoidBridgeTests().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
}

module.exports = { runHumanoidBridgeTests };
