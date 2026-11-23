/**
 * VISION AI — Expanded 15-Category Robotics & Engineering Library + GLB / Spec Exporters
 * Owned by JARVIS — POWERED BY VISION (MADE BY LOKESH).
 *
 * Clear Engineering Provenance:
 * - "engineering_parametric": joints, pivots, link lengths, mass estimates, and actuator sizing
 *   follow standard kinematic tables & structural approximations usable for CAD prototyping.
 * - "conceptual_kinematic_approximation": kinematic visualization & multi-DOF joint rig designed
 *   for interactive lab simulation; detailed FEA / bearing tolerances require dedicated CAD sign-off.
 */

const ROBOTICS_CATALOG = [
  {
    archetype: 'robotic_arm',
    title: '6-DOF Articulated Industrial Robot Arm',
    category: 'Manipulators',
    dof: 6,
    kinematicType: 'serial_6r',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'DH kinematics + DLS IK + torque/deflection estimation',
    defaultReachMm: 680,
    defaultPayloadKg: 1.5,
    description: '6-axis industrial manipulator with crossed-roller base bearing, NEMA 23 harmonic drives, and parallel gripper.'
  },
  {
    archetype: 'seven_axis_arm',
    title: '7-DOF Redundant Collaborative Arm',
    category: 'Manipulators',
    dof: 7,
    kinematicType: 'serial_7r_redundant',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'Redundant SRS chain + DLS IK nullspace + collision margin',
    defaultReachMm: 820,
    defaultPayloadKg: 3.0,
    description: '7-DOF cobot manipulator with shoulder-elbow-wrist redundancy for obstacle avoidance.'
  },
  {
    archetype: 'cartesian_gantry',
    title: '3-Axis Cartesian CNC Gantry',
    category: 'Linear Systems',
    dof: 3,
    kinematicType: 'cartesian_xyz',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'Linear carriage motion + leadscrew deflection',
    defaultReachMm: 450,
    defaultPayloadKg: 5.0,
    description: 'V-Slot aluminum gantry with dual Y steppers, Tr8 leadscrew, and brushless ER11 spindle.'
  },
  {
    archetype: 'scara_robot',
    title: '4-Axis High-Speed SCARA Robot',
    category: 'Manipulators',
    dof: 4,
    kinematicType: 'scara_rrpr',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'Planar 2R + vertical quill stroke + theta wrist',
    defaultReachMm: 520,
    defaultPayloadKg: 2.0,
    description: 'RRPR selective compliance assembly robot arm with Z-quill ball screw and vacuum/jaw wrist.'
  },
  {
    archetype: 'delta_robot',
    title: 'Delta Parallel Pick-and-Place Robot',
    category: 'Parallel Robots',
    dof: 4,
    kinematicType: 'parallel_delta',
    geometryProvenance: 'conceptual_kinematic_approximation',
    simulationFidelity: 'Coupled shoulder kinematics + traveling end-plate approximation',
    defaultReachMm: 400,
    defaultPayloadKg: 1.0,
    description: 'Overhead 3-arm parallel delta frame with stepper shoulders, twin pushrods, and traveling vacuum plate.'
  },
  {
    archetype: 'mechanical_gripper',
    title: 'Articulated Parallel Mechanical Gripper',
    category: 'End Effectors',
    dof: 2,
    kinematicType: 'parallel_jaw',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'Rack-and-pinion jaw stroke + grip force estimation',
    defaultReachMm: 120,
    defaultPayloadKg: 1.5,
    description: 'Precision CNC servo gripper with synchronized opposing jaws and silicone friction pads.'
  },
  {
    archetype: 'humanoid_hand',
    title: 'Humanoid Anatomical 5-Finger Hand',
    category: 'Bio-Mechatronics',
    dof: 11,
    kinematicType: 'tendon_multi_finger',
    geometryProvenance: 'conceptual_kinematic_approximation',
    simulationFidelity: 'MCP/PIP flexion + thumb opposition + grip mode presets (Open/Pinch/Power/Precision)',
    defaultReachMm: 210,
    defaultPayloadKg: 0.8,
    description: 'Dexterous anthropomorphic robotic hand with opposable thumb and 4 articulated multi-phalanx fingers.'
  },
  {
    archetype: 'robotic_leg',
    title: '4-DOF Quasi-Direct-Drive Robotic Leg',
    category: 'Locomotion',
    dof: 4,
    kinematicType: 'serial_leg_4r',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'Hip pitch/roll + knee flexion + ankle pitch + impact load estimation',
    defaultReachMm: 720,
    defaultPayloadKg: 18.0,
    description: 'Bipedal/quadruped articulated leg assembly with planetary hip actuator, carbon shin, and compliant foot pad.'
  },
  {
    archetype: 'humanoid_torso',
    title: 'Dual-Arm Humanoid Upper Body',
    category: 'Bio-Mechatronics',
    dof: 8,
    kinematicType: 'dual_arm_torso',
    geometryProvenance: 'conceptual_kinematic_approximation',
    simulationFidelity: 'Waist yaw + neck pan/tilt + dual L/R shoulder/elbow rigs',
    defaultReachMm: 780,
    defaultPayloadKg: 2.5,
    description: 'Structural spine, chest reactor core, 2-DOF stereo head, and dual 3-DOF arms.'
  },
  {
    archetype: 'rover_chassis',
    title: '4WD Autonomous Rover / UGV Chassis',
    category: 'Mobile Robots',
    dof: 3,
    kinematicType: 'differential_4wd',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'Wheel drive rotation + pan-tilt LiDAR turret',
    defaultReachMm: 420,
    defaultPayloadKg: 8.0,
    description: 'Skid-steer rover deck with 4 geared traction wheels, 3S battery bay, and LiDAR mast.'
  },
  {
    archetype: 'wheeled_platform',
    title: 'Omnidirectional Industrial AMR Platform',
    category: 'Mobile Robots',
    dof: 5,
    kinematicType: 'holonomic_4_mecanum',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'Independent 4-corner wheel pod rotation + optical safety bumper',
    defaultReachMm: 650,
    defaultPayloadKg: 45.0,
    description: 'Heavy-duty Mecanum Autonomous Mobile Robot base with corner LiDARs and payload top plate.'
  },
  {
    archetype: 'lifting_mechanism',
    title: 'Scissor Hydraulic / Ball-Screw Lift Table',
    category: 'Actuation & Handling',
    dof: 2,
    kinematicType: 'scissor_lift',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'Linear actuator stroke + scissor pantograph elevation',
    defaultReachMm: 600,
    defaultPayloadKg: 60.0,
    description: 'Cross-braced scissor elevation mechanism driven by a central trapezoidal screw cylinder.'
  },
  {
    archetype: 'conveyor_system',
    title: 'Sensor-Gated Industrial Belt Conveyor',
    category: 'Factory Automation',
    dof: 3,
    kinematicType: 'continuous_belt_and_gate',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'Drive roller rotation + optical sort gate actuation',
    defaultReachMm: 1200,
    defaultPayloadKg: 25.0,
    description: 'Modular T-slot belt conveyor with brushless drum drive, optical arch sensor, and pneumatic diverter arm.'
  },
  {
    archetype: 'multi_axis_cnc',
    title: '5-Axis Trunnion CNC Machining Center',
    category: 'Manufacturing',
    dof: 5,
    kinematicType: '5axis_trunnion_xyzac',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'X/Z saddle translation + A/C rotary trunnion indexing + high-speed spindle',
    defaultReachMm: 500,
    defaultPayloadKg: 12.0,
    description: 'Rigid C-frame mill with compound saddle, dual-axis A/C rotary trunnion chuck, and 24k RPM spindle.'
  },
  {
    archetype: 'planetary_gearbox',
    title: '5:1 Compound Planetary Gearbox',
    category: 'Power Transmission',
    dof: 2,
    kinematicType: 'epicyclic_gear',
    geometryProvenance: 'engineering_parametric',
    simulationFidelity: 'Sun-planet carrier rotation + gear ratio torque multiplication',
    defaultReachMm: 180,
    defaultPayloadKg: 6.0,
    description: 'Compact inline harmonic/planetary reducer with hardened 4140 sun gear and 3 carrier satellites.'
  }
];

function computeTriangleNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/**
 * Generates a valid binary glTF 2.0 (.glb) Buffer with per-component nodes, PBR materials,
 * double-precision computed flat/smooth normals, and indexed triangle meshes.
 */
function buildGlbBuffer(modelDef, computeJointWorldOffsetsFn, tessellateComponentFn) {
  const components = modelDef?.geometrySpec?.components || [];
  const jointOffsets = computeJointWorldOffsetsFn(modelDef?.geometrySpec || {});

  const bufferChunks = [];
  let byteOffset = 0;
  const bufferViews = [];
  const accessors = [];
  const meshes = [];
  const nodes = [];
  const materials = [];
  const materialCache = new Map();

  const appendAligned = (typedArray) => {
    const raw = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const padLen = (4 - (raw.length % 4)) % 4;
    const aligned = padLen > 0 ? Buffer.concat([raw, Buffer.alloc(padLen)]) : raw;
    const start = byteOffset;
    bufferChunks.push(aligned);
    byteOffset += aligned.length;
    return { start, rawByteLength: raw.length };
  };

  const getMaterialIndex = (hexColor, category) => {
    const hex = Number.isFinite(Number(hexColor)) ? Number(hexColor) : 0x00e5ff;
    const key = `${hex}_${category || 'structure'}`;
    if (materialCache.has(key)) return materialCache.get(key);
    const r = ((hex >> 16) & 255) / 255;
    const g = ((hex >> 8) & 255) / 255;
    const b = (hex & 255) / 255;
    const isMetal = category !== 'end_effector' && category !== 'core';
    const matIdx = materials.length;
    materials.push({
      name: `mat_${key}`,
      pbrMetallicRoughness: {
        baseColorFactor: [Number(r.toFixed(4)), Number(g.toFixed(4)), Number(b.toFixed(4)), 1.0],
        metallicFactor: isMetal ? 0.72 : 0.25,
        roughnessFactor: isMetal ? 0.32 : 0.45
      },
      doubleSided: true
    });
    materialCache.set(key, matIdx);
    return matIdx;
  };

  for (const comp of components) {
    const jOff = comp.parentJoint ? (jointOffsets.get(comp.parentJoint) || [0, 0, 0]) : [0, 0, 0];
    const { vertices, faces } = tessellateComponentFn(comp, jOff);
    if (!vertices.length || !faces.length) continue;

    // Expand triangles with crisp computed normals
    const posArr = new Float32Array(faces.length * 9);
    const normArr = new Float32Array(faces.length * 9);
    const idxArr = new Uint32Array(faces.length * 3);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let fIdx = 0; fIdx < faces.length; fIdx++) {
      const f = faces[fIdx];
      const a = vertices[f[0]] || [0, 0, 0];
      const b = vertices[f[1]] || [0, 0, 0];
      const c = vertices[f[2]] || [0, 0, 0];
      const n = computeTriangleNormal(a, b, c);
      const tri = [a, b, c];
      for (let k = 0; k < 3; k++) {
        const vIdx = fIdx * 3 + k;
        const pt = tri[k];
        posArr[vIdx * 3] = pt[0];
        posArr[vIdx * 3 + 1] = pt[1];
        posArr[vIdx * 3 + 2] = pt[2];
        normArr[vIdx * 3] = n[0];
        normArr[vIdx * 3 + 1] = n[1];
        normArr[vIdx * 3 + 2] = n[2];
        idxArr[vIdx] = vIdx;
        if (pt[0] < minX) minX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[2] < minZ) minZ = pt[2];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] > maxY) maxY = pt[1];
        if (pt[2] > maxZ) maxZ = pt[2];
      }
    }

    const posSlice = appendAligned(posArr);
    const posViewIdx = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: posSlice.start, byteLength: posSlice.rawByteLength, target: 34962 });
    const posAccIdx = accessors.length;
    accessors.push({
      bufferView: posViewIdx,
      componentType: 5126, // FLOAT
      count: faces.length * 3,
      type: 'VEC3',
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    });

    const normSlice = appendAligned(normArr);
    const normViewIdx = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: normSlice.start, byteLength: normSlice.rawByteLength, target: 34962 });
    const normAccIdx = accessors.length;
    accessors.push({
      bufferView: normViewIdx,
      componentType: 5126,
      count: faces.length * 3,
      type: 'VEC3'
    });

    const idxSlice = appendAligned(idxArr);
    const idxViewIdx = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: idxSlice.start, byteLength: idxSlice.rawByteLength, target: 34963 });
    const idxAccIdx = accessors.length;
    accessors.push({
      bufferView: idxViewIdx,
      componentType: 5125, // UNSIGNED_INT
      count: faces.length * 3,
      type: 'SCALAR'
    });

    const meshIdx = meshes.length;
    meshes.push({
      name: comp.id || `mesh_${meshIdx}`,
      primitives: [{
        attributes: { POSITION: posAccIdx, NORMAL: normAccIdx },
        indices: idxAccIdx,
        material: getMaterialIndex(comp.color, comp.category)
      }]
    });
    nodes.push({
      name: comp.name || comp.id || `part_${meshIdx}`,
      mesh: meshIdx
    });
  }

  const binBuffer = Buffer.concat(bufferChunks);
  const gltfJson = {
    asset: {
      version: '2.0',
      generator: 'VISION AI Robotics CAD Exporter (JARVIS — MADE BY LOKESH)'
    },
    scene: 0,
    scenes: [{
      name: modelDef?.name || 'JARVIS_Robotics_Assembly',
      nodes: nodes.map((_, i) => i)
    }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.length }]
  };

  let jsonBuf = Buffer.from(JSON.stringify(gltfJson), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  if (jsonPad > 0) {
    jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]); // space-padded JSON chunk per glTF 2.0 spec
  }

  const totalLength = 12 + 8 + jsonBuf.length + 8 + binBuffer.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);          // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHdr = Buffer.alloc(8);
  jsonChunkHdr.writeUInt32LE(jsonBuf.length, 0);
  jsonChunkHdr.writeUInt32LE(0x4E4F534A, 4); // 'JSON'

  const binChunkHdr = Buffer.alloc(8);
  binChunkHdr.writeUInt32LE(binBuffer.length, 0);
  binChunkHdr.writeUInt32LE(0x004E4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonChunkHdr, jsonBuf, binChunkHdr, binBuffer]);
}

function buildSevenAxisArmSpec(options = {}, normalizeFn) {
  const reachScale = Math.max(0.65, Math.min(1.6, Number(options.reachMm || 820) / 820));
  const joints = [
    { id: 'j1_base_yaw', label: 'J1 Base Yaw', axis: 'y', parent: null, pivot: [0, 0.75 * reachScale, 0], minDeg: -175, maxDeg: 175, defaultDeg: 10, actuator: 'RMD-X8 Pro 9:1 Quasi-Direct Drive' },
    { id: 'j2_shoulder_pitch', label: 'J2 Shoulder Pitch', axis: 'z', parent: 'j1_base_yaw', pivot: [0, 0.85 * reachScale, 0], minDeg: -115, maxDeg: 115, defaultDeg: -22, actuator: 'RMD-X8 Pro + Harmonic 50:1' },
    { id: 'j3_upperarm_roll', label: 'J3 Redundant Arm Roll', axis: 'y', parent: 'j2_shoulder_pitch', pivot: [0, 1.35 * reachScale, 0], minDeg: -175, maxDeg: 175, defaultDeg: 18, actuator: 'RMD-L-7015 Hollow-Shaft Redundant Drive' },
    { id: 'j4_elbow_pitch', label: 'J4 Elbow Pitch', axis: 'z', parent: 'j3_upperarm_roll', pivot: [0, 1.25 * reachScale, 0], minDeg: -135, maxDeg: 135, defaultDeg: 58, actuator: 'NEMA 23 Closed-Loop + 30:1 Planetary' },
    { id: 'j5_forearm_roll', label: 'J5 Forearm Roll', axis: 'y', parent: 'j4_elbow_pitch', pivot: [0, 1.15 * reachScale, 0], minDeg: -175, maxDeg: 175, defaultDeg: -15, actuator: 'Dynamixel XH540-W270' },
    { id: 'j6_wrist_pitch', label: 'J6 Wrist Pitch', axis: 'z', parent: 'j5_forearm_roll', pivot: [0, 1.10 * reachScale, 0], minDeg: -120, maxDeg: 120, defaultDeg: 28, actuator: 'Dynamixel XH430-W350' },
    { id: 'j7_flange_roll', label: 'J7 Tool Flange Roll', axis: 'y', parent: 'j6_wrist_pitch', pivot: [0, 0.55 * reachScale, 0], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: 'Hollow-Shaft Tool Servo' },
    { id: 'j8_gripper', label: 'Parallel Servo Gripper', axis: 'grip', parent: 'j7_flange_roll', pivot: [0, 0.45 * reachScale, 0], minDeg: 0, maxDeg: 45, defaultDeg: 20, actuator: 'Parallel Servo Actuator' }
  ];
  const components = [
    { id: 'cobot_base_plate', name: 'ISO Base Pedestal Flange', category: 'structure', material: '7075-T6 Hard Anodized Aluminum', dimensionsMm: 'Ø 280 x 35 mm', massGrams: 1350, parentJoint: null, shape: 'cylinder', radiusTop: 1.35, radiusBottom: 1.5, height: 0.35, color: 0x263238, pos: [0, 0.18, 0] },
    { id: 'cobot_pedestal', name: 'Base Torque Sensor Turret', category: 'sensor', material: '17-4PH Stainless + Aluminum', dimensionsMm: 'Ø 190 x 55 mm', massGrams: 1120, parentJoint: null, shape: 'cylinder', radiusTop: 0.92, radiusBottom: 1.05, height: 0.55, color: 0x00acc1, pos: [0, 0.52, 0] },
    { id: 'j1_yaw_collar', name: 'J1 Redundant Yaw Housing', category: 'actuator', material: '6061-T6 + Strain Wave', dimensionsMm: 'Ø 180 x 72 mm', massGrams: 980, parentJoint: 'j1_base_yaw', shape: 'cylinder', radiusTop: 0.82, radiusBottom: 0.88, height: 0.72, color: 0x00e5ff, pos: [0, 0.36, 0] },
    { id: 'j2_shoulder_hub', name: 'J2 Shoulder Pitch Actuator Hub', category: 'bearing', material: '4140 Chromoly + Ti Ring', dimensionsMm: 'Ø 140 x 90 mm', massGrams: 840, parentJoint: 'j2_shoulder_pitch', shape: 'cylinder', radiusTop: 0.65, radiusBottom: 0.65, height: 0.9, color: 0x37474f, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] },
    { id: 'upper_link_lower', name: 'Lower Upperarm CF Tube', category: 'structure', material: '3K Carbon Fiber Tube', dimensionsMm: 'Ø 96 x 125 mm', massGrams: 490, parentJoint: 'j2_shoulder_pitch', shape: 'cylinder', radiusTop: 0.44, radiusBottom: 0.48, height: 1.25 * reachScale, color: 0x00bcd4, pos: [0, 0.68 * reachScale, 0] },
    { id: 'j3_roll_ring', name: 'J3 Redundant Arm-Roll Slipring', category: 'transmission', material: 'Beryllium-Copper Slip Ring', dimensionsMm: 'Ø 116 x 45 mm', massGrams: 540, parentJoint: 'j3_upperarm_roll', shape: 'torus', radius: 0.52, tube: 0.14, color: 0xffb300, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] },
    { id: 'upper_link_upper', name: 'Mid Upperarm Bridge', category: 'structure', material: '6061-T6 Aluminum', dimensionsMm: '84 x 115 mm', massGrams: 460, parentJoint: 'j3_upperarm_roll', shape: 'cylinder', radiusTop: 0.40, radiusBottom: 0.44, height: 1.15 * reachScale, color: 0x00e5ff, pos: [0, 0.62 * reachScale, 0] },
    { id: 'j4_elbow_hub', name: 'J4 Offset Elbow Drive', category: 'actuator', material: '6061-T6 + Harmonic Ring', dimensionsMm: 'Ø 112 x 76 mm', massGrams: 620, parentJoint: 'j4_elbow_pitch', shape: 'cylinder', radiusTop: 0.5, radiusBottom: 0.5, height: 0.76, color: 0x263238, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] },
    { id: 'forearm_tube', name: 'Forearm Conduit Boom', category: 'structure', material: 'CF / 6061-T6', dimensionsMm: 'Ø 76 x 110 mm', massGrams: 370, parentJoint: 'j4_elbow_pitch', shape: 'cylinder', radiusTop: 0.34, radiusBottom: 0.38, height: 1.1 * reachScale, color: 0x00acc1, pos: [0, 0.58 * reachScale, 0] },
    { id: 'j5_roll_module', name: 'J5 Forearm Roll Collar', category: 'actuator', material: 'Anodized Aluminum', dimensionsMm: 'Ø 72 x 98 mm', massGrams: 310, parentJoint: 'j5_forearm_roll', shape: 'cylinder', radiusTop: 0.32, radiusBottom: 0.34, height: 0.98 * reachScale, color: 0x455a64, pos: [0, 0.52 * reachScale, 0] },
    { id: 'j6_wrist_yoke', name: 'J6 Spherical Wrist Yoke', category: 'bearing', material: '7075-T6 Aluminum', dimensionsMm: 'Ø 64 x 55 mm', massGrams: 220, parentJoint: 'j6_wrist_pitch', shape: 'sphere', radius: 0.34, color: 0x00e5ff, pos: [0, 0.25 * reachScale, 0] },
    { id: 'j7_tool_flange', name: 'ISO 9409-1-50 Tool Flange', category: 'end_effector', material: 'Hardened Stainless Steel', dimensionsMm: 'Ø 63 x 20 mm', massGrams: 160, parentJoint: 'j7_flange_roll', shape: 'cylinder', radiusTop: 0.31, radiusBottom: 0.31, height: 0.22, color: 0xffb300, pos: [0, 0.2, 0] },
    { id: 'cobot_jaw_l', name: 'Cobot Tactile Jaw Left', category: 'end_effector', material: '7075-T6 + Force Sensor', dimensionsMm: '16 x 65 x 22 mm', massGrams: 55, parentJoint: 'j8_gripper', gripSide: 'left', shape: 'box', size: [0.2, 0.65, 0.14], color: 0x00ffee, pos: [0, 0.38, 0.22] },
    { id: 'cobot_jaw_r', name: 'Cobot Tactile Jaw Right', category: 'end_effector', material: '7075-T6 + Force Sensor', dimensionsMm: '16 x 65 x 22 mm', massGrams: 55, parentJoint: 'j8_gripper', gripSide: 'right', shape: 'box', size: [0.2, 0.65, 0.14], color: 0x00ffee, pos: [0, 0.38, -0.22] }
  ];
  return normalizeFn({
    archetype: 'seven_axis_arm',
    geometryProvenance: 'engineering_parametric',
    joints,
    components,
    engineeringSummary: { reachMm: Number(options.reachMm || 820), recommendedPayloadKg: Number(options.payloadKg || 3.0) }
  }, options);
}

function buildScaraRobotSpec(options = {}, normalizeFn) {
  const joints = [
    { id: 'j1_shoulder_yaw', label: 'J1 Arm-1 Shoulder Swing', axis: 'y', parent: null, pivot: [0, 2.25, 0], minDeg: -135, maxDeg: 135, defaultDeg: 18, actuator: '400W AC Servo + Zero-Backlash Harmonic' },
    { id: 'j2_elbow_yaw', label: 'J2 Arm-2 Elbow Swing', axis: 'y', parent: 'j1_shoulder_yaw', pivot: [2.1, 0.35, 0], minDeg: -145, maxDeg: 145, defaultDeg: -42, actuator: '200W AC Servo + Timing Drive' },
    { id: 'j3_quill_z', label: 'J3 Vertical Ball-Screw Quill (Z)', axis: 'translate_y', parent: 'j2_elbow_yaw', pivot: [1.85, -0.2, 0], minDeg: -80, maxDeg: 40, defaultDeg: 0, actuator: 'Ball-Screw Spline Shaft + 100W Servo' },
    { id: 'j4_theta_spindle', label: 'J4 Theta Rotary Tool Spindle', axis: 'y', parent: 'j3_quill_z', pivot: [0, -0.95, 0], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: 'Direct Hollow Theta Drive' }
  ];
  const components = [
    { id: 'scara_base', name: 'Heavy Cast Iron SCARA Pedestal', category: 'structure', material: 'FC250 Cast Iron', dimensionsMm: '260 x 260 x 220 mm', massGrams: 4800, parentJoint: null, shape: 'cylinder', radiusTop: 1.05, radiusBottom: 1.35, height: 2.1, color: 0x263238, pos: [0, 1.05, 0] },
    { id: 'scara_umbilical_box', name: 'Rear Controller & I/O Manifold', category: 'electronics', material: 'Powder-Coated Steel', dimensionsMm: '160 x 140 x 130 mm', massGrams: 1100, parentJoint: null, shape: 'box', size: [1.2, 1.3, 1.1], color: 0x1c2833, pos: [-1.1, 0.95, 0] },
    { id: 'scara_arm1', name: 'J1 Primary Hollow Cast Link', category: 'structure', material: 'Cast Aluminum A356', dimensionsMm: '210 x 45 x 90 mm', massGrams: 1420, parentJoint: 'j1_shoulder_yaw', shape: 'box', size: [2.25, 0.45, 0.88], color: 0x00bcd4, pos: [1.05, 0.15, 0] },
    { id: 'scara_j1_cap', name: 'J1 Harmonic Encoder Cap', category: 'actuator', material: 'Anodized Aluminum', dimensionsMm: 'Ø 100 x 50 mm', massGrams: 420, parentJoint: 'j1_shoulder_yaw', shape: 'cylinder', radiusTop: 0.48, radiusBottom: 0.48, height: 0.42, color: 0x00e5ff, pos: [0, 0.35, 0] },
    { id: 'scara_arm2', name: 'J2 Secondary Outer Forearm', category: 'structure', material: 'Cast Aluminum A356', dimensionsMm: '190 x 40 x 78 mm', massGrams: 980, parentJoint: 'j2_elbow_yaw', shape: 'box', size: [2.0, 0.40, 0.78], color: 0x0097a7, pos: [0.95, 0.05, 0] },
    { id: 'scara_j2_cap', name: 'J2 Servo Cable Arch Mount', category: 'bearing', material: '6061-T6 Aluminum', dimensionsMm: 'Ø 78 x 35 mm', massGrams: 310, parentJoint: 'j2_elbow_yaw', shape: 'cylinder', radiusTop: 0.38, radiusBottom: 0.38, height: 0.38, color: 0xffab00, pos: [0, 0.28, 0] },
    { id: 'scara_quill_shaft', name: 'Precision Ground Ball-Spline Shaft', category: 'transmission', material: 'SUJ2 Hardened Steel', dimensionsMm: 'Ø 25 x 220 mm', massGrams: 540, parentJoint: 'j3_quill_z', shape: 'cylinder', radiusTop: 0.14, radiusBottom: 0.14, height: 2.1, color: 0xcfd8dc, pos: [0, 0.05, 0] },
    { id: 'scara_bellows', name: 'Quill Dust Bellows Collar', category: 'structure', material: 'FKM Viton Boot', dimensionsMm: 'Ø 44 x 60 mm', massGrams: 95, parentJoint: 'j3_quill_z', shape: 'cylinder', radiusTop: 0.22, radiusBottom: 0.24, height: 0.55, color: 0x37474f, pos: [0, 0.55, 0] },
    { id: 'scara_vacuum_cup', name: 'Theta Vacuum / Magnetic End Tool', category: 'end_effector', material: 'Anodized Alloy + NBR Cup', dimensionsMm: 'Ø 42 x 26 mm', massGrams: 110, parentJoint: 'j4_theta_spindle', shape: 'cone', radius: 0.24, height: 0.35, color: 0x00ffee, pos: [0, -0.18, 0], rot: [Math.PI, 0, 0] }
  ];
  return normalizeFn({
    archetype: 'scara_robot',
    geometryProvenance: 'engineering_parametric',
    joints,
    components,
    engineeringSummary: { reachMm: Number(options.reachMm || 520), recommendedPayloadKg: Number(options.payloadKg || 2.0) }
  }, options);
}

function buildDeltaRobotSpec(options = {}, normalizeFn) {
  const joints = [
    { id: 'j1_delta_arm_a', label: 'Delta Shoulder Arm A (0 deg)', axis: 'z', parent: null, pivot: [1.3, 4.1, 0], minDeg: -50, maxDeg: 65, defaultDeg: 18, actuator: 'High-Torque Brushless Servo A + 10:1' },
    { id: 'j2_delta_arm_b', label: 'Delta Shoulder Arm B (120 deg)', axis: 'z', parent: null, pivot: [-0.65, 4.1, 1.126], minDeg: -50, maxDeg: 65, defaultDeg: 18, actuator: 'High-Torque Brushless Servo B + 10:1' },
    { id: 'j3_delta_arm_c', label: 'Delta Shoulder Arm C (240 deg)', axis: 'z', parent: null, pivot: [-0.65, 4.1, -1.126], minDeg: -50, maxDeg: 65, defaultDeg: 18, actuator: 'High-Torque Brushless Servo C + 10:1' },
    { id: 'j4_traveler_z', label: 'Traveling Plate Vertical Trim', axis: 'translate_y', parent: null, pivot: [0, 1.55, 0], minDeg: -60, maxDeg: 60, defaultDeg: 0, actuator: 'Coupled Parallel Kinematics End Plate' }
  ];
  const components = [
    { id: 'delta_top_ring', name: 'Overhead Hexagonal Actuator Ring', category: 'structure', material: '6061-T6 CNC Plate', dimensionsMm: 'Ø 340 x 28 mm', massGrams: 2200, parentJoint: null, shape: 'cylinder', radiusTop: 1.75, radiusBottom: 1.75, height: 0.28, color: 0x263238, pos: [0, 4.2, 0] },
    { id: 'delta_pillar_1', name: 'Support Tripod Strut #1', category: 'structure', material: '40x40 Aluminum Profile', dimensionsMm: '40 x 420 mm', massGrams: 680, parentJoint: null, shape: 'cylinder', radiusTop: 0.14, radiusBottom: 0.16, height: 4.2, color: 0x455a64, pos: [1.65, 2.1, 0] },
    { id: 'delta_pillar_2', name: 'Support Tripod Strut #2', category: 'structure', material: '40x40 Aluminum Profile', dimensionsMm: '40 x 420 mm', massGrams: 680, parentJoint: null, shape: 'cylinder', radiusTop: 0.14, radiusBottom: 0.16, height: 4.2, color: 0x455a64, pos: [-0.825, 2.1, 1.43] },
    { id: 'delta_pillar_3', name: 'Support Tripod Strut #3', category: 'structure', material: '40x40 Aluminum Profile', dimensionsMm: '40 x 420 mm', massGrams: 680, parentJoint: null, shape: 'cylinder', radiusTop: 0.14, radiusBottom: 0.16, height: 4.2, color: 0x455a64, pos: [-0.825, 2.1, -1.43] },
    { id: 'delta_base_ring', name: 'Machined Workzone Floor Ring', category: 'structure', material: '6061-T6 Base', dimensionsMm: 'Ø 380 x 16 mm', massGrams: 1850, parentJoint: null, shape: 'torus', radius: 1.65, tube: 0.12, color: 0x0088cc, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] },
    // Three parallel upper + CF forearm links
    { id: 'arm_a_upper', name: 'Bicep Arm A + Motor', category: 'actuator', material: 'Carbon Reinforced 7075', dimensionsMm: '140 x 28 mm', massGrams: 290, parentJoint: 'j1_delta_arm_a', shape: 'box', size: [1.15, 0.22, 0.22], color: 0x00e5ff, pos: [0.45, -0.35, 0], rot: [0, 0, -0.55] },
    { id: 'arm_a_rod', name: 'CF Parallelogram Rod Pair A', category: 'transmission', material: 'Pultruded CF Rod + Ball Joints', dimensionsMm: 'Ø 8 x 240 mm', massGrams: 120, parentJoint: 'j1_delta_arm_a', shape: 'cylinder', radiusTop: 0.08, radiusBottom: 0.08, height: 2.3, color: 0xcfd8dc, pos: [0.42, -1.55, 0], rot: [0, 0, 0.38] },
    { id: 'arm_b_upper', name: 'Bicep Arm B + Motor', category: 'actuator', material: 'Carbon Reinforced 7075', dimensionsMm: '140 x 28 mm', massGrams: 290, parentJoint: 'j2_delta_arm_b', shape: 'box', size: [1.15, 0.22, 0.22], color: 0x00e5ff, pos: [-0.22, -0.35, 0.38], rot: [0.4, 2.09, -0.45] },
    { id: 'arm_b_rod', name: 'CF Parallelogram Rod Pair B', category: 'transmission', material: 'Pultruded CF Rod + Ball Joints', dimensionsMm: 'Ø 8 x 240 mm', massGrams: 120, parentJoint: 'j2_delta_arm_b', shape: 'cylinder', radiusTop: 0.08, radiusBottom: 0.08, height: 2.3, color: 0xcfd8dc, pos: [-0.21, -1.55, 0.36], rot: [-0.25, 0, -0.22] },
    { id: 'arm_c_upper', name: 'Bicep Arm C + Motor', category: 'actuator', material: 'Carbon Reinforced 7075', dimensionsMm: '140 x 28 mm', massGrams: 290, parentJoint: 'j3_delta_arm_c', shape: 'box', size: [1.15, 0.22, 0.22], color: 0x00e5ff, pos: [-0.22, -0.35, -0.38], rot: [-0.4, -2.09, -0.45] },
    { id: 'arm_c_rod', name: 'CF Parallelogram Rod Pair C', category: 'transmission', material: 'Pultruded CF Rod + Ball Joints', dimensionsMm: 'Ø 8 x 240 mm', massGrams: 120, parentJoint: 'j3_delta_arm_c', shape: 'cylinder', radiusTop: 0.08, radiusBottom: 0.08, height: 2.3, color: 0xcfd8dc, pos: [-0.21, -1.55, -0.36], rot: [0.25, 0, -0.22] },
    { id: 'delta_traveler_plate', name: 'Traveling End-Effector Delta Plate', category: 'end_effector', material: 'Ultralight PEEK / Al-Li', dimensionsMm: 'Ø 96 x 18 mm', massGrams: 145, parentJoint: 'j4_traveler_z', shape: 'cylinder', radiusTop: 0.48, radiusBottom: 0.42, height: 0.2, color: 0xffb300, pos: [0, 0, 0] },
    { id: 'delta_vacuum_nozzle', name: 'High-Speed Vacuum Pick Nozzle', category: 'end_effector', material: 'Titanium + Silicone Skirt', dimensionsMm: 'Ø 22 x 42 mm', massGrams: 55, parentJoint: 'j4_traveler_z', shape: 'cone', radius: 0.14, height: 0.4, color: 0x00ffee, pos: [0, -0.28, 0], rot: [Math.PI, 0, 0] }
  ];
  return normalizeFn({
    archetype: 'delta_robot',
    geometryProvenance: 'conceptual_kinematic_approximation',
    joints,
    components,
    engineeringSummary: { reachMm: Number(options.reachMm || 400), recommendedPayloadKg: Number(options.payloadKg || 1.0) }
  }, options);
}

function buildHumanoidHandSpec(options = {}, normalizeFn) {
  const joints = [
    { id: 'j_wrist_flex', label: 'Wrist Flexion/Extension', axis: 'z', parent: null, pivot: [0, 0.75, 0], minDeg: -70, maxDeg: 70, defaultDeg: 0, actuator: 'Dual Tendon Micro-Servo Forearm Pair' },
    { id: 'j_thumb_opp', label: 'Thumb Opposition (CMC)', axis: 'y', parent: 'j_wrist_flex', pivot: [0.42, 0.45, 0.22], minDeg: -20, maxDeg: 85, defaultDeg: 35, actuator: 'Micro Brushless Tendon Servo' },
    { id: 'j_thumb_curl', label: 'Thumb Curl (MCP/IP)', axis: 'z', parent: 'j_thumb_opp', pivot: [0.25, 0.28, 0], minDeg: 0, maxDeg: 95, defaultDeg: 22, actuator: 'UHMWPE Tendon Cable' },
    { id: 'j_index_mcp', label: 'Index Finger MCP Curl', axis: 'x', parent: 'j_wrist_flex', pivot: [0.32, 1.15, 0], minDeg: 0, maxDeg: 95, defaultDeg: 18, actuator: 'Micro Linear Tendon Actuator' },
    { id: 'j_index_pip', label: 'Index Finger PIP/DIP Curl', axis: 'x', parent: 'j_index_mcp', pivot: [0, 0.48, 0], minDeg: 0, maxDeg: 105, defaultDeg: 20, actuator: 'Passive Elastic Return Tendon' },
    { id: 'j_middle_mcp', label: 'Middle Finger MCP Curl', axis: 'x', parent: 'j_wrist_flex', pivot: [0.11, 1.18, 0], minDeg: 0, maxDeg: 95, defaultDeg: 18, actuator: 'Micro Linear Tendon Actuator' },
    { id: 'j_middle_pip', label: 'Middle Finger PIP/DIP Curl', axis: 'x', parent: 'j_middle_mcp', pivot: [0, 0.52, 0], minDeg: 0, maxDeg: 105, defaultDeg: 22, actuator: 'Passive Elastic Return Tendon' },
    { id: 'j_ring_mcp', label: 'Ring Finger MCP Curl', axis: 'x', parent: 'j_wrist_flex', pivot: [-0.11, 1.15, 0], minDeg: 0, maxDeg: 95, defaultDeg: 20, actuator: 'Micro Linear Tendon Actuator' },
    { id: 'j_ring_pip', label: 'Ring Finger PIP/DIP Curl', axis: 'x', parent: 'j_ring_mcp', pivot: [0, 0.48, 0], minDeg: 0, maxDeg: 105, defaultDeg: 22, actuator: 'Passive Elastic Return Tendon' },
    { id: 'j_pinky_mcp', label: 'Pinky Finger MCP Curl', axis: 'x', parent: 'j_wrist_flex', pivot: [-0.32, 1.06, 0], minDeg: 0, maxDeg: 95, defaultDeg: 22, actuator: 'Micro Linear Tendon Actuator' },
    { id: 'j_pinky_pip', label: 'Pinky Finger PIP/DIP Curl', axis: 'x', parent: 'j_pinky_mcp', pivot: [0, 0.40, 0], minDeg: 0, maxDeg: 105, defaultDeg: 25, actuator: 'Passive Elastic Return Tendon' }
  ];
  const components = [
    { id: 'forearm_cuff', name: 'Carbon Forearm Servo Conduit', category: 'structure', material: '3K Carbon Fiber Shell', dimensionsMm: 'Ø 74 x 75 mm', massGrams: 210, parentJoint: null, shape: 'cylinder', radiusTop: 0.44, radiusBottom: 0.48, height: 0.72, color: 0x263238, pos: [0, 0.36, 0] },
    { id: 'palm_chassis', name: 'Anatomical Metacarpal Palm Shell', category: 'structure', material: '7075-T6 + SLS Nylon PA12', dimensionsMm: '88 x 112 x 26 mm', massGrams: 185, parentJoint: 'j_wrist_flex', shape: 'box', size: [0.88, 1.12, 0.26], color: 0x00acc1, pos: [0, 0.56, 0] },
    { id: 'palm_tactile_pad', name: 'Bio-Silicone Tactile Palm Pad', category: 'sensor', material: 'Shore 30A Capacitive Matrix', dimensionsMm: '76 x 85 x 8 mm', massGrams: 42, parentJoint: 'j_wrist_flex', shape: 'box', size: [0.76, 0.85, 0.08], color: 0x37474f, pos: [0, 0.58, 0.14] },
    { id: 'thumb_prox', name: 'Thumb Metacarpal Link', category: 'end_effector', material: 'PA12 Carbon', dimensionsMm: '20 x 32 x 20 mm', massGrams: 18, parentJoint: 'j_thumb_opp', shape: 'cylinder', radiusTop: 0.11, radiusBottom: 0.13, height: 0.32, color: 0x00e5ff, pos: [0.12, 0.14, 0], rot: [0, 0, -0.5] },
    { id: 'thumb_dist', name: 'Thumb Distal Tip + Force Sensor', category: 'end_effector', material: 'SLS Nylon + Tactile Tip', dimensionsMm: '18 x 30 x 18 mm', massGrams: 14, parentJoint: 'j_thumb_curl', shape: 'cylinder', radiusTop: 0.09, radiusBottom: 0.11, height: 0.30, color: 0xffb300, pos: [0.06, 0.14, 0] }
  ];
  const fingers = [
    ['index', 'Index', 0.46, 0.38],
    ['middle', 'Middle', 0.50, 0.42],
    ['ring', 'Ring', 0.46, 0.38],
    ['pinky', 'Pinky', 0.38, 0.32]
  ];
  for (const [fKey, fTitle, l1, l2] of fingers) {
    components.push(
      { id: `${fKey}_proximal`, name: `${fTitle} Proximal Phalanx`, category: 'end_effector', material: 'PA12 Nylon-CF', dimensionsMm: `15 x ${Math.round(l1 * 100)} x 15 mm`, massGrams: 14, parentJoint: `j_${fKey}_mcp`, shape: 'cylinder', radiusTop: 0.085, radiusBottom: 0.095, height: l1, color: 0x00e5ff, pos: [0, l1 / 2, 0] },
      { id: `${fKey}_distal`, name: `${fTitle} Middle/Distal Tip`, category: 'end_effector', material: 'Nylon + Silicone Grip Tip', dimensionsMm: `13 x ${Math.round(l2 * 100)} x 13 mm`, massGrams: 11, parentJoint: `j_${fKey}_pip`, shape: 'cylinder', radiusTop: 0.065, radiusBottom: 0.085, height: l2, color: 0x00ffee, pos: [0, l2 / 2, 0] }
    );
  }
  return normalizeFn({
    archetype: 'humanoid_hand',
    geometryProvenance: 'conceptual_kinematic_approximation',
    gripPresets: {
      open: { j_thumb_opp: 10, j_thumb_curl: 5, j_index_mcp: 5, j_index_pip: 5, j_middle_mcp: 5, j_middle_pip: 5, j_ring_mcp: 5, j_ring_pip: 5, j_pinky_mcp: 5, j_pinky_pip: 5 },
      pinch: { j_thumb_opp: 62, j_thumb_curl: 45, j_index_mcp: 58, j_index_pip: 48, j_middle_mcp: 12, j_middle_pip: 10, j_ring_mcp: 12, j_ring_pip: 10, j_pinky_mcp: 15, j_pinky_pip: 15 },
      power: { j_thumb_opp: 55, j_thumb_curl: 72, j_index_mcp: 82, j_index_pip: 88, j_middle_mcp: 84, j_middle_pip: 90, j_ring_mcp: 84, j_ring_pip: 90, j_pinky_mcp: 85, j_pinky_pip: 90 },
      precision: { j_thumb_opp: 48, j_thumb_curl: 36, j_index_mcp: 44, j_index_pip: 42, j_middle_mcp: 44, j_middle_pip: 42, j_ring_mcp: 20, j_ring_pip: 20, j_pinky_mcp: 22, j_pinky_pip: 22 }
    },
    joints,
    components,
    engineeringSummary: { reachMm: Number(options.reachMm || 210), recommendedPayloadKg: Number(options.payloadKg || 0.8) }
  }, options);
}

function buildRoboticLegSpec(options = {}, normalizeFn) {
  const joints = [
    { id: 'j1_hip_roll', label: 'Hip Abduction/Adduction', axis: 'z', parent: null, pivot: [0, 4.4, 0], minDeg: -35, maxDeg: 45, defaultDeg: 0, actuator: 'T-Motor AK80-9 9:1 Planetary' },
    { id: 'j2_hip_pitch', label: 'Hip Flexion/Extension', axis: 'x', parent: 'j1_hip_roll', pivot: [0, -0.35, 0], minDeg: -95, maxDeg: 95, defaultDeg: -22, actuator: 'T-Motor AK80-64 High-Torque' },
    { id: 'j3_knee_pitch', label: 'Knee Flexion Joint', axis: 'x', parent: 'j2_hip_pitch', pivot: [0, -1.85, 0], minDeg: 0, maxDeg: 135, defaultDeg: 46, actuator: 'Quasi-Direct Drive + Carbon Link' },
    { id: 'j4_ankle_pitch', label: 'Ankle Pitch', axis: 'x', parent: 'j3_knee_pitch', pivot: [0, -1.8, 0], minDeg: -55, maxDeg: 55, defaultDeg: -24, actuator: 'Parallel Pushrod Servo Actuator' }
  ];
  const components = [
    { id: 'pelvis_test_rig', name: 'Static Pelvis Mount & Load Cell', category: 'structure', material: '7075-T6 CNC Frame', dimensionsMm: '180 x 80 x 140 mm', massGrams: 1900, parentJoint: null, shape: 'box', size: [1.5, 0.5, 1.1], color: 0x37474f, pos: [0, 4.65, 0] },
    { id: 'hip_actuator_pod', name: 'Hip Roll/Pitch Coaxial Drive', category: 'actuator', material: '6061-T6 + Silicon Steel', dimensionsMm: 'Ø 110 x 90 mm', massGrams: 950, parentJoint: 'j1_hip_roll', shape: 'cylinder', radiusTop: 0.55, radiusBottom: 0.55, height: 0.72, color: 0x00acc1, pos: [0, -0.18, 0], rot: [Math.PI / 2, 0, 0] },
    { id: 'femur_beam', name: 'Hollow CNC Femur Strut', category: 'structure', material: '7075-T6 Billet', dimensionsMm: '58 x 185 x 72 mm', massGrams: 760, parentJoint: 'j2_hip_pitch', shape: 'box', size: [0.56, 1.82, 0.7], color: 0x00e5ff, pos: [0, -0.92, 0] },
    { id: 'knee_drum', name: 'Knee Planetary Drive Drum', category: 'bearing', material: '4140 Steel + 6061 Housing', dimensionsMm: 'Ø 98 x 65 mm', massGrams: 680, parentJoint: 'j3_knee_pitch', shape: 'cylinder', radiusTop: 0.46, radiusBottom: 0.46, height: 0.65, color: 0xffb300, pos: [0, 0, 0], rot: [0, 0, Math.PI / 2] },
    { id: 'tibia_tube', name: 'Tibia Twin Carbon-Composite Tube', category: 'structure', material: '3K Carbon Fiber', dimensionsMm: 'Ø 44 x 180 mm', massGrams: 410, parentJoint: 'j3_knee_pitch', shape: 'cylinder', radiusTop: 0.24, radiusBottom: 0.20, height: 1.75, color: 0x00bcd4, pos: [0, -0.9, 0] },
    { id: 'foot_blade', name: 'Bipedal Compliant Rubberized Foot', category: 'end_effector', material: '7075-T6 + Vulkolan Sole', dimensionsMm: '90 x 35 x 165 mm', massGrams: 340, parentJoint: 'j4_ankle_pitch', shape: 'box', size: [0.85, 0.26, 1.45], color: 0x263238, pos: [0, -0.18, 0.25] }
  ];
  return normalizeFn({
    archetype: 'robotic_leg',
    geometryProvenance: 'engineering_parametric',
    joints,
    components,
    engineeringSummary: { reachMm: Number(options.reachMm || 720), recommendedPayloadKg: Number(options.payloadKg || 18.0) }
  }, options);
}

function buildHumanoidTorsoSpec(options = {}, normalizeFn) {
  const joints = [
    { id: 'j1_waist_yaw', label: 'Waist Spine Yaw', axis: 'y', parent: null, pivot: [0, 1.2, 0], minDeg: -95, maxDeg: 95, defaultDeg: 0, actuator: 'High-Torque Waist Cycloidal Drive' },
    { id: 'j2_neck_pan', label: 'Neck Vision Head Pan', axis: 'y', parent: 'j1_waist_yaw', pivot: [0, 2.35, 0], minDeg: -110, maxDeg: 110, defaultDeg: 0, actuator: 'Dynamixel XL430 Pan-Tilt Gimbal' },
    { id: 'j3_l_shoulder', label: 'Left Shoulder Pitch', axis: 'x', parent: 'j1_waist_yaw', pivot: [-1.55, 1.95, 0], minDeg: -150, maxDeg: 150, defaultDeg: 15, actuator: '60W Brushless Shoulder Module' },
    { id: 'j4_l_elbow', label: 'Left Elbow Flexion', axis: 'x', parent: 'j3_l_shoulder', pivot: [-0.15, -1.25, 0], minDeg: -120, maxDeg: 15, defaultDeg: -45, actuator: '40W Elbow Planetary Drive' },
    { id: 'j5_r_shoulder', label: 'Right Shoulder Pitch', axis: 'x', parent: 'j1_waist_yaw', pivot: [1.55, 1.95, 0], minDeg: -150, maxDeg: 150, defaultDeg: -15, actuator: '60W Brushless Shoulder Module' },
    { id: 'j6_r_elbow', label: 'Right Elbow Flexion', axis: 'x', parent: 'j5_r_shoulder', pivot: [0.15, -1.25, 0], minDeg: -120, maxDeg: 15, defaultDeg: -45, actuator: '40W Elbow Planetary Drive' }
  ];
  const components = [
    { id: 'torso_pedestal', name: 'Lab Stand Pelvis Fixture', category: 'structure', material: 'Cast Steel + 6061', dimensionsMm: '280 x 120 x 280 mm', massGrams: 5400, parentJoint: null, shape: 'cylinder', radiusTop: 1.0, radiusBottom: 1.3, height: 1.15, color: 0x263238, pos: [0, 0.58, 0] },
    { id: 'chest_chassis', name: 'Bilateral Ribcage Compute Monocoque', category: 'structure', material: 'CF / 7075-T6', dimensionsMm: '280 x 205 x 145 mm', massGrams: 3200, parentJoint: 'j1_waist_yaw', shape: 'box', size: [2.5, 2.0, 1.35], color: 0x37474f, pos: [0, 1.15, 0] },
    { id: 'chest_arc_core', name: 'VISION Optical Telemetry Core', category: 'core', material: 'Sapphire Lens + Copper Ring', dimensionsMm: 'Ø 96 x 28 mm', massGrams: 260, parentJoint: 'j1_waist_yaw', shape: 'torus', radius: 0.44, tube: 0.1, color: 0x00ffee, pos: [0, 1.25, 0.7] },
    { id: 'stereo_head', name: 'Stereo Depth Sensor Cranium', category: 'sensor', material: 'CNC Aluminum + Optical Visor', dimensionsMm: '130 x 120 x 140 mm', massGrams: 640, parentJoint: 'j2_neck_pan', shape: 'box', size: [0.92, 0.72, 1.05], color: 0x00e5ff, pos: [0, 0.45, 0.05] },
    { id: 'l_upper_arm', name: 'Left Upper Arm Boom', category: 'structure', material: 'Carbon-Ti Composite', dimensionsMm: 'Ø 54 x 125 mm', massGrams: 520, parentJoint: 'j3_l_shoulder', shape: 'cylinder', radiusTop: 0.28, radiusBottom: 0.26, height: 1.25, color: 0x00acc1, pos: [-0.15, -0.62, 0] },
    { id: 'l_forearm', name: 'Left Forearm Link', category: 'end_effector', material: '6061-T6 Aluminum', dimensionsMm: 'Ø 44 x 115 mm', massGrams: 410, parentJoint: 'j4_l_elbow', shape: 'cylinder', radiusTop: 0.24, radiusBottom: 0.18, height: 1.15, color: 0xffb300, pos: [0, -0.58, 0] },
    { id: 'r_upper_arm', name: 'Right Upper Arm Boom', category: 'structure', material: 'Carbon-Ti Composite', dimensionsMm: 'Ø 54 x 125 mm', massGrams: 520, parentJoint: 'j5_r_shoulder', shape: 'cylinder', radiusTop: 0.28, radiusBottom: 0.26, height: 1.25, color: 0x00acc1, pos: [0.15, -0.62, 0] },
    { id: 'r_forearm', name: 'Right Forearm Link', category: 'end_effector', material: '6061-T6 Aluminum', dimensionsMm: 'Ø 44 x 115 mm', massGrams: 410, parentJoint: 'j6_r_elbow', shape: 'cylinder', radiusTop: 0.24, radiusBottom: 0.18, height: 1.15, color: 0xffb300, pos: [0, -0.58, 0] }
  ];
  return normalizeFn({
    archetype: 'humanoid_torso',
    geometryProvenance: 'conceptual_kinematic_approximation',
    joints,
    components,
    engineeringSummary: { reachMm: Number(options.reachMm || 780), recommendedPayloadKg: Number(options.payloadKg || 2.5) }
  }, options);
}

function buildWheeledPlatformSpec(options = {}, normalizeFn) {
  const joints = [
    { id: 'j_mecanum_fl', label: 'Front-Left Mecanum Pod', axis: 'x', parent: null, pivot: [-1.45, 0.55, 1.3], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: '250W Hub Geared Brushless Motor' },
    { id: 'j_mecanum_fr', label: 'Front-Right Mecanum Pod', axis: 'x', parent: null, pivot: [1.45, 0.55, 1.3], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: '250W Hub Geared Brushless Motor' },
    { id: 'j_mecanum_rl', label: 'Rear-Left Mecanum Pod', axis: 'x', parent: null, pivot: [-1.45, 0.55, -1.3], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: '250W Hub Geared Brushless Motor' },
    { id: 'j_mecanum_rr', label: 'Rear-Right Mecanum Pod', axis: 'x', parent: null, pivot: [1.45, 0.55, -1.3], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: '250W Hub Geared Brushless Motor' },
    { id: 'j_safety_lidar', label: '2D Safety LiDAR Scanner Rotor', axis: 'y', parent: null, pivot: [0, 1.48, 1.55], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: 'Optical Brushless Time-of-Flight Head' }
  ];
  const components = [
    { id: 'amr_welded_frame', name: 'Welded Steel AMR Chassis Deck', category: 'structure', material: 'Laser-Cut S355 Steel', dimensionsMm: '260 x 72 x 360 mm', massGrams: 7200, parentJoint: null, shape: 'box', size: [2.5, 0.72, 3.5], color: 0x263238, pos: [0, 0.78, 0] },
    { id: 'amr_top_plate', name: 'ISO Cobot Payload Mounting Deck', category: 'structure', material: '6061-T6 Anodized Plate', dimensionsMm: '240 x 14 x 330 mm', massGrams: 2600, parentJoint: null, shape: 'box', size: [2.35, 0.14, 3.2], color: 0x00acc1, pos: [0, 1.24, 0] },
    { id: 'amr_lidar_head', name: 'Safety Laser Scanner Turret', category: 'sensor', material: 'IR Acrylic + Alloy', dimensionsMm: 'Ø 60 x 45 mm', massGrams: 340, parentJoint: 'j_safety_lidar', shape: 'cylinder', radiusTop: 0.3, radiusBottom: 0.34, height: 0.42, color: 0x00ffee, pos: [0, 0.1, 0] }
  ];
  for (const [id, name] of [['fl', 'Front-Left'], ['fr', 'Front-Right'], ['rl', 'Rear-Left'], ['rr', 'Rear-Right']]) {
    components.push({
      id: `mecanum_wheel_${id}`,
      name: `${name} Mecanum Roller Wheel`,
      category: 'transmission',
      material: 'CNC Hub + PU 45° Rollers',
      dimensionsMm: 'Ø 110 x 48 mm',
      massGrams: 850,
      parentJoint: `j_mecanum_${id}`,
      shape: 'cylinder',
      radiusTop: 0.55,
      radiusBottom: 0.55,
      height: 0.42,
      color: 0xffb300,
      pos: [0, 0, 0],
      rot: [0, 0, Math.PI / 2]
    });
  }
  return normalizeFn({
    archetype: 'wheeled_platform',
    geometryProvenance: 'engineering_parametric',
    joints,
    components,
    engineeringSummary: { reachMm: Number(options.reachMm || 650), recommendedPayloadKg: Number(options.payloadKg || 45.0) }
  }, options);
}

function buildLiftingMechanismSpec(options = {}, normalizeFn) {
  const joints = [
    { id: 'j1_lift_elevation', label: 'Table Z Elevation Stroke', axis: 'translate_y', parent: null, pivot: [0, 1.25, 0], minDeg: -75, maxDeg: 110, defaultDeg: 0, actuator: '24V Trapezoidal Ball-Screw Linear Actuator' },
    { id: 'j2_scissor_tilt', label: 'Scissor Pantograph Sync Angle', axis: 'z', parent: null, pivot: [0, 0.85, 0], minDeg: -22, maxDeg: 22, defaultDeg: 0, actuator: 'Cross-Linkage Twin Steel Arms' }
  ];
  const components = [
    { id: 'lift_base_frame', name: 'Ground C-Channel Base Rails', category: 'structure', material: 'Cold-Rolled Steel', dimensionsMm: '360 x 25 x 260 mm', massGrams: 4600, parentJoint: null, shape: 'box', size: [3.6, 0.25, 2.5], color: 0x263238, pos: [0, 0.125, 0] },
    { id: 'lead_screw_actuator', name: 'Central Ball-Screw Cylinder', category: 'actuator', material: 'Chrome-Plated 45# Steel', dimensionsMm: 'Ø 48 x 180 mm', massGrams: 1850, parentJoint: null, shape: 'cylinder', radiusTop: 0.22, radiusBottom: 0.26, height: 1.8, color: 0xffb300, pos: [-0.4, 0.72, 0], rot: [0, 0, -0.58] },
    { id: 'scissor_arm_1', name: 'Primary Cross Scissor Strut A', category: 'transmission', material: 'Q235 Structural Steel', dimensionsMm: '300 x 16 x 40 mm', massGrams: 920, parentJoint: 'j2_scissor_tilt', shape: 'box', size: [3.0, 0.16, 0.22], color: 0x00acc1, pos: [0, 0.25, 0.95], rot: [0, 0, 0.52] },
    { id: 'scissor_arm_2', name: 'Primary Cross Scissor Strut B', category: 'transmission', material: 'Q235 Structural Steel', dimensionsMm: '300 x 16 x 40 mm', massGrams: 920, parentJoint: 'j2_scissor_tilt', shape: 'box', size: [3.0, 0.16, 0.22], color: 0x0088cc, pos: [0, 0.25, -0.95], rot: [0, 0, -0.52] },
    { id: 'lift_top_deck', name: 'Checkered Load Carrier Platform', category: 'end_effector', material: '5052 Tread Aluminum', dimensionsMm: '360 x 22 x 260 mm', massGrams: 3400, parentJoint: 'j1_lift_elevation', shape: 'box', size: [3.6, 0.22, 2.5], color: 0x00e5ff, pos: [0, 0.65, 0] }
  ];
  return normalizeFn({
    archetype: 'lifting_mechanism',
    geometryProvenance: 'engineering_parametric',
    joints,
    components,
    engineeringSummary: { reachMm: Number(options.reachMm || 600), recommendedPayloadKg: Number(options.payloadKg || 60.0) }
  }, options);
}

function buildConveyorSystemSpec(options = {}, normalizeFn) {
  const joints = [
    { id: 'j1_drive_roller', label: 'Motorized Drive Drum Rotation', axis: 'z', parent: null, pivot: [2.7, 1.05, 0], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: '60W Brushless Drum Gearmotor' },
    { id: 'j2_idler_roller', label: 'Tension Idler Drum Rotation', axis: 'z', parent: null, pivot: [-2.7, 1.05, 0], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: 'Dual Pillow-Block Idler Bearing' },
    { id: 'j3_diverter_gate', label: 'Sorting Diverter Paddle Arm', axis: 'y', parent: null, pivot: [0.4, 1.32, -0.82], minDeg: -55, maxDeg: 15, defaultDeg: 0, actuator: 'Rotary Pneumatic / Servo Gate' }
  ];
  const components = [
    { id: 'conv_frame_main', name: '40x80 Extruded Conveyor Bed Rail', category: 'structure', material: '6063-T5 Anodized Aluminum', dimensionsMm: '580 x 30 x 150 mm', massGrams: 6400, parentJoint: null, shape: 'box', size: [5.8, 0.30, 1.5], color: 0x263238, pos: [0, 1.02, 0] },
    { id: 'conv_belt_deck', name: 'Anti-Static PVC Conveyor Belt Loop', category: 'transmission', material: '2-Ply PVC Anti-Static Belt', dimensionsMm: '540 x 18 x 130 mm', massGrams: 1800, parentJoint: null, shape: 'box', size: [5.4, 0.18, 1.3], color: 0x0088cc, pos: [0, 1.18, 0] },
    { id: 'conv_leg_l', name: 'Left Adjustable Support Stanchion', category: 'structure', material: '40x40 T-Slot Extrusion', dimensionsMm: '120 x 95 x 140 mm', massGrams: 1900, parentJoint: null, shape: 'box', size: [0.35, 0.95, 1.4], color: 0x455a64, pos: [-2.1, 0.48, 0] },
    { id: 'conv_leg_r', name: 'Right Adjustable Support Stanchion', category: 'structure', material: '40x40 T-Slot Extrusion', dimensionsMm: '120 x 95 x 140 mm', massGrams: 1900, parentJoint: null, shape: 'box', size: [0.35, 0.95, 1.4], color: 0x455a64, pos: [2.1, 0.48, 0] },
    { id: 'conv_sensor_arch', name: 'Optical ToF Vision Inspection Arch', category: 'sensor', material: 'Anodized Frame + Laser Trigger', dimensionsMm: '40 x 95 x 165 mm', massGrams: 680, parentJoint: null, shape: 'box', size: [0.28, 0.95, 1.65], color: 0x00e5ff, pos: [-0.8, 1.65, 0] },
    { id: 'conv_drive_drum', name: 'Knurled Drive Drum Pulley', category: 'actuator', material: '304 Stainless Steel', dimensionsMm: 'Ø 52 x 145 mm', massGrams: 920, parentJoint: 'j1_drive_roller', shape: 'cylinder', radiusTop: 0.26, radiusBottom: 0.26, height: 1.45, color: 0xffb300, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] },
    { id: 'conv_idler_drum', name: 'Crowned Idler Return Drum', category: 'bearing', material: '304 Stainless Steel', dimensionsMm: 'Ø 50 x 145 mm', massGrams: 780, parentJoint: 'j2_idler_roller', shape: 'cylinder', radiusTop: 0.24, radiusBottom: 0.24, height: 1.45, color: 0x90a4ae, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] },
    { id: 'conv_divert_paddle', name: 'UHMW-PE Diverter Sweep Arm', category: 'end_effector', material: 'UHMW-PE + 6061 Hub', dimensionsMm: '140 x 22 x 10 mm', massGrams: 340, parentJoint: 'j3_diverter_gate', shape: 'box', size: [1.35, 0.22, 0.12], color: 0x00ffee, pos: [0.55, 0, 0.18], rot: [0, -0.35, 0] }
  ];
  return normalizeFn({
    archetype: 'conveyor_system',
    geometryProvenance: 'engineering_parametric',
    joints,
    components,
    engineeringSummary: { reachMm: Number(options.reachMm || 1200), recommendedPayloadKg: Number(options.payloadKg || 25.0) }
  }, options);
}

function buildMultiAxisCncSpec(options = {}, normalizeFn) {
  const joints = [
    { id: 'j1_x_table', label: 'X-Axis Table Saddle', axis: 'translate_x', parent: null, pivot: [0, 1.35, 0.3], minDeg: -75, maxDeg: 75, defaultDeg: 0, actuator: 'Ball Screw C5 + 750W AC Servo' },
    { id: 'j2_a_trunnion', label: 'A-Axis Cradle Trunnion Tilt', axis: 'x', parent: 'j1_x_table', pivot: [0, 0.55, 0], minDeg: -110, maxDeg: 110, defaultDeg: 15, actuator: 'Worm-Gear Trunnion Rotary Table' },
    { id: 'j3_c_rotary', label: 'C-Axis Workpiece Faceplate', axis: 'y', parent: 'j2_a_trunnion', pivot: [0, 0.25, 0], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: 'Zero-Backlash Cross-Roller C-Table' },
    { id: 'j4_z_headstock', label: 'Z-Axis Vertical Spindle Quill', axis: 'translate_y', parent: null, pivot: [0, 3.1, 0.25], minDeg: -85, maxDeg: 65, defaultDeg: 0, actuator: 'Counterbalanced Z Ball-Screw Drive' },
    { id: 'j5_spindle_rpm', label: '24k RPM HSK-A63 Spindle', axis: 'y', parent: 'j4_z_headstock', pivot: [0, -0.45, 0], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: 'Ceramic-Bearing Liquid-Cooled Spindle' }
  ];
  const components = [
    { id: 'cnc_cast_bed', name: 'Meehanite Cast Iron Machine Base', category: 'structure', material: 'Damped Cast Iron GG25', dimensionsMm: '420 x 110 x 440 mm', massGrams: 18500, parentJoint: null, shape: 'box', size: [4.0, 1.1, 4.2], color: 0x1c252e, pos: [0, 0.55, 0] },
    { id: 'cnc_z_column', name: 'Rigid Box-Way Vertical C-Column', category: 'structure', material: 'Meehanite Cast Iron', dimensionsMm: '160 x 340 x 160 mm', massGrams: 12400, parentJoint: null, shape: 'box', size: [1.6, 3.3, 1.4], color: 0x263238, pos: [0, 2.7, -1.25] },
    { id: 'cnc_x_saddle', name: 'Precision X/Y Compound Table', category: 'transmission', material: 'Ground Cast Steel', dimensionsMm: '260 x 30 x 190 mm', massGrams: 4200, parentJoint: 'j1_x_table', shape: 'box', size: [2.5, 0.3, 1.85], color: 0x455a64, pos: [0, 0, 0] },
    { id: 'cnc_a_cradle', name: 'A-Axis Tilting U-Trunnion', category: 'bearing', material: 'FCD500 Ductile Iron', dimensionsMm: '180 x 70 x 130 mm', massGrams: 2800, parentJoint: 'j2_a_trunnion', shape: 'box', size: [1.65, 0.45, 1.1], color: 0x0088cc, pos: [0, 0, 0] },
    { id: 'cnc_c_chuck', name: 'C-Axis 3-Jaw Precision Rotary Chuck', category: 'end_effector', material: 'Hardened Alloy Steel', dimensionsMm: 'Ø 110 x 32 mm', massGrams: 1350, parentJoint: 'j3_c_rotary', shape: 'cylinder', radiusTop: 0.55, radiusBottom: 0.62, height: 0.32, color: 0xffb300, pos: [0, 0.16, 0] },
    { id: 'cnc_headstock', name: 'Z-Axis Sliding Spindle Head', category: 'actuator', material: 'Cast Iron + Linear Guides', dimensionsMm: '110 x 95 x 140 mm', massGrams: 3800, parentJoint: 'j4_z_headstock', shape: 'box', size: [1.05, 0.9, 1.35], color: 0x00acc1, pos: [0, 0.25, -0.25] },
    { id: 'cnc_spindle_nose', name: 'HSK-A63 High-Speed Endmill', category: 'end_effector', material: 'TiAlN Solid Carbide Tool', dimensionsMm: 'Ø 48 x 110 mm', massGrams: 820, parentJoint: 'j5_spindle_rpm', shape: 'cylinder', radiusTop: 0.26, radiusBottom: 0.12, height: 0.85, color: 0x00ffee, pos: [0, -0.32, 0] }
  ];
  return normalizeFn({
    archetype: 'multi_axis_cnc',
    geometryProvenance: 'engineering_parametric',
    joints,
    components,
    engineeringSummary: { reachMm: Number(options.reachMm || 500), recommendedPayloadKg: Number(options.payloadKg || 12.0) }
  }, options);
}

module.exports = {
  ROBOTICS_CATALOG,
  buildGlbBuffer,
  buildSevenAxisArmSpec,
  buildScaraRobotSpec,
  buildDeltaRobotSpec,
  buildHumanoidHandSpec,
  buildRoboticLegSpec,
  buildHumanoidTorsoSpec,
  buildWheeledPlatformSpec,
  buildLiftingMechanismSpec,
  buildConveyorSystemSpec,
  buildMultiAxisCncSpec
};
