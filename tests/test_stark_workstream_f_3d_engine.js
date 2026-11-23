/**
 * Acceptance Test: Workstream F — Universal 3D Model Creation & Visual Engine
 */

const assert = require('assert');
const fs = require('fs');
const { universal3dEngine } = require('../server/desktop/universal3dEngine.js');
const { executeTool } = require('../server/toolsRegistry.js');

async function runTests() {
  console.log('=== TEST SUITE: WORKSTREAM F (Universal 3D Model Creation & Visual Engine) ===');

  // Test 1: Generate Robotic Arm Model
  const armRes = await universal3dEngine.create3dModel('articulated robotic arm with gripper', {
    archetype: 'robotic_arm',
    theme: 'holographic'
  });
  assert(armRes.success, 'Model creation must succeed');
  assert(armRes.geometrySpec.components.length >= 6, 'Robotic arm must have articulated components');
  console.log(`  [PASS] Robotic arm created: ${armRes.modelName} with ${armRes.geometrySpec.components.length} components`);

  // Test 2: Verify real OBJ, STL and Blender files exist on disk
  assert(fs.existsSync(armRes.files.obj), 'Wavefront OBJ file must exist on disk');
  assert(fs.existsSync(armRes.files.stl), 'STL file must exist on disk');
  assert(fs.existsSync(armRes.files.blender), 'Blender script must exist on disk');
  console.log('  [PASS] Real 3D geometry files verified on disk:');
  console.log('         - OBJ:', armRes.files.obj);
  console.log('         - STL:', armRes.files.stl);
  console.log('         - Blender Script:', armRes.files.blender);

  // Test 3: Generate Holographic Arc Reactor Energy Ring via tool registry
  const ringRes = await executeTool('create_3d_model', {
    description: 'holographic arc reactor energy ring',
    archetype: 'energy_ring',
    theme: 'holographic'
  }, 'JARVIS');
  assert(ringRes.success, 'create_3d_model tool must succeed');
  console.log(`  [PASS] Arc Reactor created via tool: ${ringRes.modelName}`);

  // Test 4: Export 3D model
  const exportRes = await executeTool('export_3d_model', {
    modelId: ringRes.modelId,
    format: 'obj'
  }, 'JARVIS');
  assert(exportRes.success && fs.existsSync(exportRes.path), 'Exported OBJ file must exist');
  console.log('  [PASS] export_3d_model verified:', exportRes.path);

  // Test 5: Verify OBJ content has vertices and faces
  const objText = fs.readFileSync(exportRes.path, 'utf8');
  assert(objText.includes('v ') && objText.includes('f '), 'OBJ file must contain real vertices and faces');
  console.log('  [PASS] Wavefront OBJ file contains verified vertices and polygonal faces');

  console.log('=== WORKSTREAM F: ALL ACCEPTANCE TESTS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
