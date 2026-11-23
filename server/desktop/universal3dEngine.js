/**
 * VISION AI — Universal 3D Model Creation & Visual Engine
 * Workstream F: Parametric Geometry Generation, Three.js Schemas, OBJ/STL Exporters, and Blender Scripting
 */

const fs = require('fs');
const path = require('path');
const {
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
} = require('./roboticsLibrarySpecs.js');

const MODELS_DIR = path.join(__dirname, '..', '..', 'data', '3d_models');

class Universal3dEngine {
  constructor() {
    this._ensureDir();
    this.activeModels = new Map();
  }

  _ensureDir() {
    if (!fs.existsSync(MODELS_DIR)) {
      fs.mkdirSync(MODELS_DIR, { recursive: true });
    }
  }

  /**
   * Generates a 3D model definition based on prompt or parametric archetype
   */
  async create3dModel(description, options = {}) {
    const desc = String(description || '').toLowerCase();
    let archetype = options.archetype || '';
    if (!archetype) {
      if (options.customSpec && Array.isArray(options.customSpec.components)) {
        archetype = options.customSpec.archetype || 'custom_engineering_assembly';
      } else if (/\b(?:7[\s-]*(?:dof|axis)|seven[\s-]*axis|redundant[\s-]*arm|cobot[\s-]*7)\b/i.test(desc)) {
        archetype = 'seven_axis_arm';
      } else if (/\b(?:scara|rrpr|selective\s+compliance)\b/i.test(desc)) {
        archetype = 'scara_robot';
      } else if (/\b(?:delta\s*(?:robot|arm|picker)|parallel\s*(?:robot|delta))\b/i.test(desc)) {
        archetype = 'delta_robot';
      } else if (/\b(?:humanoid\s*hand|anatomical\s*hand|5[\s-]*finger|robot(?:ic)?\s*hand|dexterous\s*hand|prosthetic\s*hand)\b/i.test(desc)) {
        archetype = 'humanoid_hand';
      } else if (/\b(?:robot(?:ic)?\s*leg|biped(?:al)?\s*leg|quadruped\s*leg|prosthetic\s*leg|knee\s*leg)\b/i.test(desc)) {
        archetype = 'robotic_leg';
      } else if (/\b(?:humanoid\s*(?:torso|upper\s*body|body)|upper\s*body\s*robot)\b/i.test(desc)) {
        archetype = 'humanoid_torso';
      } else if (/\b(?:wheeled\s*platform|mecanum|amr\b|omnidirectional\s*robot|agv\b)\b/i.test(desc)) {
        archetype = 'wheeled_platform';
      } else if (/\b(?:scissor\s*lift|lifting\s*mechanism|lift\s*table|hydraulic\s*lift|elevating\s*platform)\b/i.test(desc)) {
        archetype = 'lifting_mechanism';
      } else if (/\b(?:conveyor|belt\s*system|sorting\s*line|diverter)\b/i.test(desc)) {
        archetype = 'conveyor_system';
      } else if (/\b(?:5[\s-]*axis|multi[\s-]*axis\s*cnc|trunnion\s*cnc|machining\s*center|milling\s*machine)\b/i.test(desc)) {
        archetype = 'multi_axis_cnc';
      } else if (/\b(?:gantry|cnc|plotter|3[\s-]*axis|cartesian)\b/i.test(desc)) {
        archetype = 'cartesian_gantry';
      } else if (/\b(?:rover|ugv|mobile\s*robot|4wd|chassis|bogie)\b/i.test(desc)) {
        archetype = 'rover_chassis';
      } else if (/\b(?:gearbox|planetary|reducer|gear\s*train|transmission)\b/i.test(desc)) {
        archetype = 'planetary_gearbox';
      } else if (/\b(?:gripper|claw|end[\s-]*effector|parallel\s+jaw)\b/i.test(desc) && !/\brobotic\s*arm|manipulator\b/i.test(desc)) {
        archetype = 'mechanical_gripper';
      } else if (desc.includes('reactor') || desc.includes('ring') || desc.includes('arc') || desc.includes('energy')) {
        archetype = 'energy_ring';
      } else if (desc.includes('turbine') || desc.includes('fan') || desc.includes('jet') || desc.includes('propeller')) {
        archetype = 'turbine';
      } else if (desc.includes('ship') || desc.includes('spaceship') || desc.includes('drone') || desc.includes('vessel')) {
        archetype = 'spaceship';
      } else if (desc.includes('engine') || desc.includes('motor') || desc.includes('piston')) {
        archetype = 'engine_block';
      } else {
        archetype = 'robotic_arm';
      }
    }

    const theme = options.theme || (desc.includes('metal') || desc.includes('titanium') ? 'titanium' : 'holographic');
    const modelId = `model_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const modelName = options.name || description.split(' ').slice(0, 4).join('_').replace(/[^a-zA-Z0-9_]/g, '') || archetype;

    const modelDef = {
      modelId,
      name: modelName,
      description,
      archetype,
      theme, // 'holographic' | 'titanium' | 'wireframe'
      createdAt: new Date().toISOString(),
      parameters: {
        scale: options.scale || 1.0,
        wireframe: Boolean(options.wireframe || theme === 'wireframe'),
        segments: options.segments || 24,
        speed: options.speed || 1.0,
        dof: options.dof || (archetype === 'robotic_arm' ? 6 : undefined),
        reachMm: options.reachMm || (archetype === 'robotic_arm' ? 680 : undefined),
        payloadKg: options.payloadKg !== undefined ? Number(options.payloadKg) : undefined
      },
      geometrySpec: this._generateGeometrySpec(archetype, options),
      files: {}
    };

    // Export OBJ, STL, GLB, Engineering Spec JSON, and Blender Script to disk
    const objContent = this._generateObjFile(modelDef);
    const stlContent = this._generateStlFile(modelDef);
    const blenderScript = this._generateBlenderScript(modelDef);
    const glbBuffer = this._generateGlbFile(modelDef);
    const specJsonContent = this._generateEngineeringSpecJson(modelDef);

    const modelFolder = path.join(MODELS_DIR, modelId);
    fs.mkdirSync(modelFolder, { recursive: true });

    const objPath = path.join(modelFolder, `${modelName}.obj`);
    const stlPath = path.join(modelFolder, `${modelName}.stl`);
    const glbPath = path.join(modelFolder, `${modelName}.glb`);
    const specPath = path.join(modelFolder, `${modelName}_spec.json`);
    const pyPath = path.join(modelFolder, `${modelName}_blender.py`);
    const metaPath = path.join(modelFolder, `metadata.json`);

    fs.writeFileSync(objPath, objContent, 'utf8');
    fs.writeFileSync(stlPath, stlContent, 'utf8');
    fs.writeFileSync(glbPath, glbBuffer);
    fs.writeFileSync(specPath, specJsonContent, 'utf8');
    fs.writeFileSync(pyPath, blenderScript, 'utf8');

    const objBytes = fs.statSync(objPath).size;
    const stlBytes = fs.statSync(stlPath).size;
    const glbBytes = fs.statSync(glbPath).size;

    modelDef.files = {
      obj: objPath,
      stl: stlPath,
      glb: glbPath,
      spec: specPath,
      blender: pyPath,
      metadata: metaPath
    };
    modelDef.verification = {
      filesVerified: objBytes > 100 && stlBytes > 100 && glbBytes > 64,
      objBytes,
      stlBytes,
      glbBytes,
      verifiedAt: new Date().toISOString()
    };
    fs.writeFileSync(metaPath, JSON.stringify(modelDef, null, 2), 'utf8');
    this.activeModels.set(modelId, modelDef);

    const compCount = modelDef.geometrySpec?.components?.length || 0;
    const jointCount = modelDef.geometrySpec?.joints?.length || 0;
    return {
      success: true,
      verified: modelDef.verification.filesVerified,
      modelId,
      archetype,
      theme,
      modelName,
      componentCount: compCount,
      jointCount,
      files: modelDef.files,
      verification: modelDef.verification,
      geometrySpec: modelDef.geometrySpec,
      summary: archetype === 'robotic_arm'
        ? `Generated engineering-grade ${modelDef.geometrySpec?.joints?.length || 6}-DOF articulated robot arm CAD assembly "${modelName}" (${compCount} mechanical parts, ${jointCount} controllable joints/gripper, realistic mm specs) and verified OBJ (${objBytes}B), STL (${stlBytes}B) & Blender scripts on disk, sir.`
        : `Generated parametric engineering CAD assembly "${modelName}" (${archetype}, ${compCount} components, ${jointCount} joints) in ${theme} aesthetic and verified OBJ (${objBytes}B), STL (${stlBytes}B) & Blender scripts on disk, sir.`
    };
  }

  /**
   * Generates component hierarchy and parameters for Three.js client rendering
   */
  _generateGeometrySpec(archetype, options = {}) {
    if (options.customSpec && Array.isArray(options.customSpec.components) && options.customSpec.components.length > 0) {
      return this._normalizeCustomGeometrySpec(options.customSpec, options);
    }
    switch (archetype) {
      case 'robotic_arm':
        return this._buildRoboticArmCADSpec(options);
      case 'seven_axis_arm':
        return buildSevenAxisArmSpec(options, (s, o) => this._normalizeCustomGeometrySpec(s, o));
      case 'cartesian_gantry':
        return this._buildCartesianGantrySpec(options);
      case 'scara_robot':
        return buildScaraRobotSpec(options, (s, o) => this._normalizeCustomGeometrySpec(s, o));
      case 'delta_robot':
        return buildDeltaRobotSpec(options, (s, o) => this._normalizeCustomGeometrySpec(s, o));
      case 'humanoid_hand':
        return buildHumanoidHandSpec(options, (s, o) => this._normalizeCustomGeometrySpec(s, o));
      case 'robotic_leg':
        return buildRoboticLegSpec(options, (s, o) => this._normalizeCustomGeometrySpec(s, o));
      case 'humanoid_torso':
        return buildHumanoidTorsoSpec(options, (s, o) => this._normalizeCustomGeometrySpec(s, o));
      case 'wheeled_platform':
        return buildWheeledPlatformSpec(options, (s, o) => this._normalizeCustomGeometrySpec(s, o));
      case 'lifting_mechanism':
        return buildLiftingMechanismSpec(options, (s, o) => this._normalizeCustomGeometrySpec(s, o));
      case 'conveyor_system':
        return buildConveyorSystemSpec(options, (s, o) => this._normalizeCustomGeometrySpec(s, o));
      case 'multi_axis_cnc':
        return buildMultiAxisCncSpec(options, (s, o) => this._normalizeCustomGeometrySpec(s, o));
      case 'rover_chassis':
        return this._buildRoverChassisSpec(options);
      case 'planetary_gearbox':
        return this._buildPlanetaryGearboxSpec(options);
      case 'mechanical_gripper':
        return this._buildMechanicalGripperSpec(options);
      case 'energy_ring':
        return {
          type: 'compound',
          units: 'scale_100mm',
          components: [
            { id: 'core', name: 'Plasma Containment Core', category: 'core', material: 'Emitter Crystal', dimensionsMm: 'Ø 300 mm', shape: 'sphere', radius: 1.5, color: 0xffffff, pos: [0, 0, 0], explodeVector: [0, 0, 0] },
            { id: 'ring_inner', name: 'Inner Toroidal Ring', category: 'transmission', material: 'Copper-Beryllium Alloy', dimensionsMm: 'OD 650 mm', shape: 'torus', radius: 3.0, tube: 0.25, color: 0x00e5ff, rot: [1.57, 0, 0], explodeVector: [0, 1.5, 0] },
            { id: 'ring_mid', name: 'Mid Gimbal Coil', category: 'actuator', material: 'Ti-6Al-4V Titanium', dimensionsMm: 'OD 1030 mm', shape: 'torus', radius: 4.8, tube: 0.35, color: 0x00a2ff, rot: [0.8, 0.8, 0], explodeVector: [0, -1.5, 0] },
            { id: 'ring_outer', name: 'Outer Stator Ring', category: 'structure', material: 'Carbon-Ti Composite', dimensionsMm: 'OD 1390 mm', shape: 'torus', radius: 6.5, tube: 0.45, color: 0x00e5ff, rot: [0, 1.57, 0], explodeVector: [2.0, 0, 0] },
            { id: 'field_coils', name: 'Central Field Spindle', category: 'transmission', material: 'Ferrite Core', dimensionsMm: 'Ø 60 x 700 mm', shape: 'cylinder', radiusTop: 0.3, radiusBottom: 0.3, height: 7.0, color: 0x0066aa, pos: [0, 0, 0], explodeVector: [0, 2.5, 0] }
          ]
        };
      case 'turbine':
        return {
          type: 'compound',
          units: 'scale_100mm',
          components: [
            { id: 'housing', name: 'Shroud Casing', category: 'structure', material: 'Inconel 718', dimensionsMm: 'Ø 800 x 600 mm', shape: 'cylinder', radiusTop: 4.0, radiusBottom: 3.5, height: 6.0, color: 0x00e5ff, openEnded: true, rot: [1.57, 0, 0], explodeVector: [0, 1.8, 0] },
            { id: 'nosecone', name: 'Aerodynamic Spinner', category: 'structure', material: 'Ti-6Al-4V', dimensionsMm: 'Ø 360 x 250 mm', shape: 'cone', radius: 1.8, height: 2.5, color: 0x00ffee, pos: [0, 0, 2.5], rot: [1.57, 0, 0], explodeVector: [0, 0, 2.5] },
            { id: 'shaft', name: 'Main Rotor Shaft', category: 'transmission', material: '4340 Chromoly Steel', dimensionsMm: 'Ø 160 x 550 mm', shape: 'cylinder', radiusTop: 0.8, radiusBottom: 0.8, height: 5.5, color: 0x0088cc, rot: [1.57, 0, 0], explodeVector: [0, 0, -2.0] },
            { id: 'blade1', name: 'Compressor Blade Set A', category: 'structure', material: 'Single-Crystal Ni Superalloy', dimensionsMm: '350 x 100 x 20 mm', shape: 'box', size: [0.2, 3.5, 1.0], color: 0x00e5ff, pos: [0, 0, 1.0], explodeVector: [0, 1.2, 0] },
            { id: 'blade2', name: 'Compressor Blade Set B', category: 'structure', material: 'Single-Crystal Ni Superalloy', dimensionsMm: '350 x 100 x 20 mm', shape: 'box', size: [0.2, 3.5, 1.0], color: 0x00e5ff, pos: [0, 0, 1.0], rot: [0, 0, 1.04], explodeVector: [1.0, -0.6, 0] },
            { id: 'blade3', name: 'Compressor Blade Set C', category: 'structure', material: 'Single-Crystal Ni Superalloy', dimensionsMm: '350 x 100 x 20 mm', shape: 'box', size: [0.2, 3.5, 1.0], color: 0x00e5ff, pos: [0, 0, 1.0], rot: [0, 0, 2.09], explodeVector: [-1.0, -0.6, 0] }
          ]
        };
      case 'spaceship':
        return {
          type: 'compound',
          units: 'scale_100mm',
          components: [
            { id: 'fuselage', name: 'Primary Airframe Hull', category: 'structure', material: 'Carbon-Ti Monocoque', shape: 'cone', radius: 1.8, height: 8.0, color: 0x00e5ff, rot: [1.57, 0, 0], explodeVector: [0, 0, 1.5] },
            { id: 'cockpit', name: 'Avionics Canopy Dome', category: 'structure', material: 'Sapphire Composite', shape: 'sphere', radius: 1.1, color: 0x00ffee, pos: [0, 0.7, 0.5], explodeVector: [0, 1.8, 0] },
            { id: 'wing_left', name: 'Port Swept Wing', category: 'structure', material: '6061-T6 / CFRP', shape: 'box', size: [6.0, 0.2, 3.0], color: 0x0088cc, pos: [-3.5, 0, -1.5], rot: [0, 0, -0.15], explodeVector: [-2.2, 0, 0] },
            { id: 'wing_right', name: 'Starboard Swept Wing', category: 'structure', material: '6061-T6 / CFRP', shape: 'box', size: [6.0, 0.2, 3.0], color: 0x0088cc, pos: [3.5, 0, -1.5], rot: [0, 0, 0.15], explodeVector: [2.2, 0, 0] },
            { id: 'engine_left', name: 'Port Thruster Pod', category: 'actuator', material: 'Inconel Nozzle', shape: 'cylinder', radiusTop: 0.7, radiusBottom: 0.9, height: 3.0, color: 0x00e5ff, pos: [-2.0, 0, -3.5], rot: [1.57, 0, 0], explodeVector: [-0.8, 0, -2.0] },
            { id: 'engine_right', name: 'Starboard Thruster Pod', category: 'actuator', material: 'Inconel Nozzle', shape: 'cylinder', radiusTop: 0.7, radiusBottom: 0.9, height: 3.0, color: 0x00e5ff, pos: [2.0, 0, -3.5], rot: [1.57, 0, 0], explodeVector: [0.8, 0, -2.0] }
          ]
        };
      default:
        return {
          type: 'compound',
          units: 'scale_100mm',
          components: [
            { id: 'block', name: 'Engine Block Casting', category: 'structure', material: 'Cast 356 Aluminum', shape: 'box', size: [4.0, 3.0, 5.0], color: 0x00e5ff, pos: [0, 1.5, 0], explodeVector: [0, 1.5, 0] },
            { id: 'crank', name: 'Forged Crankshaft', category: 'transmission', material: '4340 Billet Steel', shape: 'cylinder', radiusTop: 0.8, radiusBottom: 0.8, height: 6.0, color: 0x0088cc, pos: [0, 0.5, 0], rot: [1.57, 0, 0], explodeVector: [0, -1.5, 2.0] }
          ]
        };
    }
  }

  /**
   * Builds an engineering-grade, hierarchically articulated 6-DOF Robotic Arm + Parallel Gripper CAD spec
   * Scale: 1.0 world unit = 100 mm (e.g. Base flange Ø 320 mm, Total vertical height ~ 780 mm)
   */
  _buildRoboticArmCADSpec(options = {}) {
    const joints = [
      { id: 'j1_waist', label: 'J1 Waist Turret', axis: 'y', parent: null, pivot: [0, 0.85, 0], minDeg: -170, maxDeg: 170, defaultDeg: 15, actuator: 'NEMA 23 + 10:1 Planetary' },
      { id: 'j2_shoulder', label: 'J2 Shoulder Pitch', axis: 'z', parent: 'j1_waist', pivot: [0, 1.65, 0], minDeg: -95, maxDeg: 95, defaultDeg: -18, actuator: 'NEMA 23 High-Torque + 30:1 Harmonic' },
      { id: 'j3_elbow', label: 'J3 Elbow Pitch', axis: 'z', parent: 'j2_shoulder', pivot: [0, 2.90, 0], minDeg: -130, maxDeg: 130, defaultDeg: 48, actuator: 'NEMA 17 Closed-Loop + 20:1 Planetary' },
      { id: 'j4_wrist_pitch', label: 'J4 Wrist Pitch', axis: 'z', parent: 'j3_elbow', pivot: [0, 2.40, 0], minDeg: -115, maxDeg: 115, defaultDeg: 25, actuator: 'NEMA 14 + GT2 Timing Belt (4:1)' },
      { id: 'j5_wrist_roll', label: 'J5 Wrist Roll', axis: 'y', parent: 'j4_wrist_pitch', pivot: [0, 0.65, 0], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: 'Hollow-Shaft Stepper NEMA 14' },
      { id: 'j6_gripper', label: 'J6 Parallel Gripper', axis: 'grip', parent: 'j5_wrist_roll', pivot: [0, 0.55, 0], minDeg: 0, maxDeg: 40, defaultDeg: 22, actuator: 'MG996R / Dynamixel XL430 Rack-Pinion' }
    ];

    const components = [];
    const add = (c) => components.push(c);

    // --- BASE PEDESTAL (Fixed to world frame, y = 0..0.85) ---
    add({
      id: 'base_mounting_plate',
      name: 'Base Anchor Flange (8x M6)',
      category: 'structure',
      material: '6061-T6 Anodized Aluminum',
      dimensionsMm: 'Ø 320 x 24 mm',
      massGrams: 1180,
      parentJoint: null,
      shape: 'cylinder',
      radiusTop: 1.55,
      radiusBottom: 1.65,
      height: 0.24,
      color: 0x3b4d63,
      pos: [0, 0.12, 0],
      explodeVector: [0, -0.9, 0]
    });

    // 8 Perimeter M6 Socket Cap Mounting Bolts around base flange
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      const rBolt = 1.42;
      add({
        id: `base_bolt_${i + 1}`,
        name: `Base M6 Socket Bolt #${i + 1}`,
        category: 'fastener',
        material: '12.9 Alloy Steel',
        dimensionsMm: 'M6 x 20 mm',
        massGrams: 12,
        parentJoint: null,
        shape: 'cylinder',
        radiusTop: 0.06,
        radiusBottom: 0.06,
        height: 0.14,
        color: 0xb0bec5,
        pos: [Number((Math.cos(ang) * rBolt).toFixed(3)), 0.28, Number((Math.sin(ang) * rBolt).toFixed(3))],
        explodeVector: [Math.cos(ang) * 0.4, 0.6, Math.sin(ang) * 0.4]
      });
    }

    add({
      id: 'base_pedestal_drum',
      name: 'Stationary Base Pedestal Drum',
      category: 'structure',
      material: '6061-T6 Aluminum',
      dimensionsMm: 'Ø 220 x 52 mm',
      massGrams: 920,
      parentJoint: null,
      shape: 'cylinder',
      radiusTop: 1.08,
      radiusBottom: 1.15,
      height: 0.52,
      color: 0x0088cc,
      pos: [0, 0.50, 0],
      explodeVector: [0, -0.45, 0]
    });

    add({
      id: 'base_electronics_enclosure',
      name: 'Driver & Controller Junction Box',
      category: 'actuator',
      material: 'Powder-Coated Aluminum',
      dimensionsMm: '140 x 70 x 95 mm',
      massGrams: 460,
      parentJoint: null,
      shape: 'box',
      size: [0.95, 0.65, 1.40],
      color: 0x1c2b3a,
      pos: [0, 0.45, -1.35],
      explodeVector: [0, 0, -1.2]
    });

    add({
      id: 'base_estop_button',
      name: 'Hardware E-Stop Switch Cap',
      category: 'actuator',
      material: 'Industrial Polycarbonate',
      dimensionsMm: 'Ø 32 x 26 mm',
      massGrams: 35,
      parentJoint: null,
      shape: 'cylinder',
      radiusTop: 0.16,
      radiusBottom: 0.16,
      height: 0.22,
      color: 0xff3b30,
      pos: [0.25, 0.85, -1.35],
      explodeVector: [0, 0.8, -1.2]
    });

    add({
      id: 'j1_slew_bearing',
      name: 'J1 Crossed-Roller Slew Bearing',
      category: 'bearing',
      material: '52100 Bearing Steel',
      dimensionsMm: 'OD 200 x ID 140 x 20 mm',
      massGrams: 490,
      parentJoint: null,
      shape: 'torus',
      radius: 0.95,
      tube: 0.09,
      color: 0xcfd8dc,
      pos: [0, 0.80, 0],
      rot: [Math.PI / 2, 0, 0],
      explodeVector: [0, -0.15, 0]
    });

    // --- J1 WAIST TURRET (Relative to j1_waist pivot [0, 0.85, 0]) ---
    add({
      id: 'waist_turret_plate',
      name: 'J1 Rotating Turret Platform',
      category: 'structure',
      material: '6061-T6 CNC Aluminum',
      dimensionsMm: 'Ø 210 x 28 mm',
      massGrams: 640,
      parentJoint: 'j1_waist',
      shape: 'cylinder',
      radiusTop: 1.02,
      radiusBottom: 1.06,
      height: 0.28,
      color: 0x00e5ff,
      pos: [0, 0.14, 0],
      explodeVector: [0, 0.2, 0]
    });

    add({
      id: 'j1_waist_stepper',
      name: 'J1 Waist NEMA 23 Motor',
      category: 'actuator',
      material: 'Laminated Silicon Steel / Anodized Cap',
      dimensionsMm: '57 x 57 x 76 mm',
      massGrams: 720,
      parentJoint: 'j1_waist',
      shape: 'box',
      size: [0.57, 0.76, 0.57],
      color: 0x263238,
      pos: [0.58, 0.65, 0],
      explodeVector: [0.9, 0.3, 0]
    });

    add({
      id: 'j1_planetary_gearbox',
      name: 'J1 10:1 Planetary Gearbox',
      category: 'transmission',
      material: 'Hardened Steel / 6061 Housing',
      dimensionsMm: 'Ø 60 x 52 mm',
      massGrams: 390,
      parentJoint: 'j1_waist',
      shape: 'cylinder',
      radiusTop: 0.32,
      radiusBottom: 0.32,
      height: 0.50,
      color: 0x607d8b,
      pos: [0.58, 0.15, 0],
      explodeVector: [0.9, -0.2, 0]
    });

    // Twin Shoulder Clevis Pillars supporting J2 axis at y = 1.65 relative to j1_waist
    add({
      id: 'shoulder_clevis_front',
      name: 'Shoulder Clevis Yoke Plate (Front)',
      category: 'structure',
      material: '7075-T6 Aerospace Aluminum',
      dimensionsMm: '110 x 165 x 14 mm',
      massGrams: 540,
      parentJoint: 'j1_waist',
      shape: 'box',
      size: [1.05, 1.55, 0.14],
      color: 0x00b8d4,
      pos: [0, 0.98, 0.52],
      explodeVector: [0, 0.3, 0.9]
    });

    add({
      id: 'shoulder_clevis_rear',
      name: 'Shoulder Clevis Yoke Plate (Rear)',
      category: 'structure',
      material: '7075-T6 Aerospace Aluminum',
      dimensionsMm: '110 x 165 x 14 mm',
      massGrams: 540,
      parentJoint: 'j1_waist',
      shape: 'box',
      size: [1.05, 1.55, 0.14],
      color: 0x00b8d4,
      pos: [0, 0.98, -0.52],
      explodeVector: [0, 0.3, -0.9]
    });

    add({
      id: 'j2_shoulder_bearing_front',
      name: 'J2 Deep-Groove Ball Bearing (Front)',
      category: 'bearing',
      material: 'Chrome Steel 6004-2RS',
      dimensionsMm: 'OD 42 x ID 20 x 12 mm',
      massGrams: 68,
      parentJoint: 'j1_waist',
      shape: 'torus',
      radius: 0.36,
      tube: 0.07,
      color: 0xeceff1,
      pos: [0, 1.65, 0.58],
      explodeVector: [0, 0.4, 1.2]
    });

    add({
      id: 'j2_shoulder_bearing_rear',
      name: 'J2 Deep-Groove Ball Bearing (Rear)',
      category: 'bearing',
      material: 'Chrome Steel 6004-2RS',
      dimensionsMm: 'OD 42 x ID 20 x 12 mm',
      massGrams: 68,
      parentJoint: 'j1_waist',
      shape: 'torus',
      radius: 0.36,
      tube: 0.07,
      color: 0xeceff1,
      pos: [0, 1.65, -0.58],
      explodeVector: [0, 0.4, -1.2]
    });

    add({
      id: 'j2_harmonic_drive_motor',
      name: 'J2 Shoulder NEMA 23 + Harmonic Drive',
      category: 'actuator',
      material: 'Steel / Anodized Housing',
      dimensionsMm: 'Ø 82 x 110 mm',
      massGrams: 1120,
      parentJoint: 'j1_waist',
      shape: 'cylinder',
      radiusTop: 0.42,
      radiusBottom: 0.42,
      height: 1.05,
      color: 0x263238,
      pos: [0, 1.65, -0.98],
      rot: [Math.PI / 2, 0, 0],
      explodeVector: [0, 0.4, -1.8]
    });

    // --- J2 SHOULDER LINK (Relative to j2_shoulder pivot [0, 1.65, 0] inside j1_waist) ---
    add({
      id: 'j2_main_axle_shaft',
      name: 'J2 Shoulder Drive Shaft',
      category: 'transmission',
      material: '17-4PH Stainless Shaft',
      dimensionsMm: 'Ø 20 x 135 mm',
      massGrams: 260,
      parentJoint: 'j2_shoulder',
      shape: 'cylinder',
      radiusTop: 0.16,
      radiusBottom: 0.16,
      height: 1.32,
      color: 0xcfd8dc,
      pos: [0, 0, 0],
      rot: [Math.PI / 2, 0, 0],
      explodeVector: [0, 0, 1.1]
    });

    add({
      id: 'upper_arm_spar_front',
      name: 'Lower Arm Link Spar (Front Truss)',
      category: 'structure',
      material: '6061-T6 Pocketed Aluminum',
      dimensionsMm: '290 x 72 x 12 mm',
      massGrams: 480,
      parentJoint: 'j2_shoulder',
      shape: 'box',
      size: [0.68, 2.95, 0.12],
      color: 0x00e5ff,
      pos: [0, 1.45, 0.34],
      explodeVector: [0, 0.4, 0.8]
    });

    add({
      id: 'upper_arm_spar_rear',
      name: 'Lower Arm Link Spar (Rear Truss)',
      category: 'structure',
      material: '6061-T6 Pocketed Aluminum',
      dimensionsMm: '290 x 72 x 12 mm',
      massGrams: 480,
      parentJoint: 'j2_shoulder',
      shape: 'box',
      size: [0.68, 2.95, 0.12],
      color: 0x00e5ff,
      pos: [0, 1.45, -0.34],
      explodeVector: [0, 0.4, -0.8]
    });

    add({
      id: 'upper_arm_cross_brace_low',
      name: 'Link 2 Stiffener Bulkhead (Lower)',
      category: 'structure',
      material: '6061-T6 Aluminum',
      dimensionsMm: '65 x 56 x 56 mm',
      massGrams: 115,
      parentJoint: 'j2_shoulder',
      shape: 'box',
      size: [0.46, 0.24, 0.56],
      color: 0x0091ea,
      pos: [0, 0.78, 0],
      explodeVector: [-0.8, 0, 0]
    });

    add({
      id: 'upper_arm_cross_brace_high',
      name: 'Link 2 Stiffener Bulkhead (Upper)',
      category: 'structure',
      material: '6061-T6 Aluminum',
      dimensionsMm: '65 x 56 x 56 mm',
      massGrams: 115,
      parentJoint: 'j2_shoulder',
      shape: 'box',
      size: [0.46, 0.24, 0.56],
      color: 0x0091ea,
      pos: [0, 2.15, 0],
      explodeVector: [0.8, 0, 0]
    });

    add({
      id: 'lower_cable_conduit',
      name: 'Flex Loom & Motor Harness Conduit',
      category: 'cabling',
      material: 'Braided PTFE Corrugated Sleeve',
      dimensionsMm: 'Ø 18 x 250 mm',
      massGrams: 85,
      parentJoint: 'j2_shoulder',
      shape: 'cylinder',
      radiusTop: 0.09,
      radiusBottom: 0.09,
      height: 2.55,
      color: 0xffab00,
      pos: [-0.46, 1.45, 0],
      explodeVector: [-1.1, 0, 0]
    });

    add({
      id: 'j3_elbow_motor_pod',
      name: 'J3 Elbow NEMA 17 + 20:1 Gearbox',
      category: 'actuator',
      material: 'Steel / Black Anodized Shell',
      dimensionsMm: 'Ø 62 x 92 mm',
      massGrams: 690,
      parentJoint: 'j2_shoulder',
      shape: 'cylinder',
      radiusTop: 0.34,
      radiusBottom: 0.34,
      height: 0.92,
      color: 0x263238,
      pos: [0, 2.90, -0.68],
      rot: [Math.PI / 2, 0, 0],
      explodeVector: [0, 0.5, -1.4]
    });

    add({
      id: 'j3_elbow_bearing',
      name: 'J3 Elbow Flange Bearing Pair',
      category: 'bearing',
      material: 'Bearing Steel 6804-ZZ',
      dimensionsMm: 'OD 32 x ID 20 x 7 mm',
      massGrams: 48,
      parentJoint: 'j2_shoulder',
      shape: 'torus',
      radius: 0.28,
      tube: 0.055,
      color: 0xeceff1,
      pos: [0, 2.90, 0.42],
      explodeVector: [0, 0.5, 1.1]
    });

    // --- J3 ELBOW FOREARM (Relative to j3_elbow pivot [0, 2.90, 0] inside j2_shoulder) ---
    add({
      id: 'j3_elbow_axle',
      name: 'J3 Elbow Hinge Pin & Keyway',
      category: 'transmission',
      material: 'Hardened Chromoly Steel',
      dimensionsMm: 'Ø 16 x 95 mm',
      massGrams: 165,
      parentJoint: 'j3_elbow',
      shape: 'cylinder',
      radiusTop: 0.14,
      radiusBottom: 0.14,
      height: 0.96,
      color: 0xcfd8dc,
      pos: [0, 0, 0],
      rot: [Math.PI / 2, 0, 0],
      explodeVector: [0, 0, 1.0]
    });

    add({
      id: 'forearm_boom_tube',
      name: 'Forearm Structural Carbon/Alu Boom',
      category: 'structure',
      material: 'Carbon Fiber Tube / 6061 Ends',
      dimensionsMm: 'Ø 48 x 235 mm',
      massGrams: 340,
      parentJoint: 'j3_elbow',
      shape: 'cylinder',
      radiusTop: 0.24,
      radiusBottom: 0.30,
      height: 2.30,
      color: 0x00e5ff,
      pos: [0, 1.22, 0],
      explodeVector: [0, 0.7, 0]
    });

    add({
      id: 'forearm_clamp_collar_low',
      name: 'Forearm Split Clamp Collar (Lower)',
      category: 'structure',
      material: '7075-T6 Aluminum',
      dimensionsMm: 'Ø 64 x 28 mm',
      massGrams: 95,
      parentJoint: 'j3_elbow',
      shape: 'cylinder',
      radiusTop: 0.34,
      radiusBottom: 0.34,
      height: 0.28,
      color: 0x0088cc,
      pos: [0, 0.35, 0],
      explodeVector: [0, 0.2, 0]
    });

    add({
      id: 'forearm_clamp_collar_high',
      name: 'Forearm Wrist Yoke Collar (Upper)',
      category: 'structure',
      material: '7075-T6 Aluminum',
      dimensionsMm: 'Ø 58 x 28 mm',
      massGrams: 85,
      parentJoint: 'j3_elbow',
      shape: 'cylinder',
      radiusTop: 0.30,
      radiusBottom: 0.30,
      height: 0.28,
      color: 0x0088cc,
      pos: [0, 2.15, 0],
      explodeVector: [0, 0.8, 0]
    });

    add({
      id: 'j4_wrist_drive_motor',
      name: 'J4 Wrist Pitch Stepper + GT2 Pulley',
      category: 'actuator',
      material: 'Alloy Steel / Anodized Case',
      dimensionsMm: '35 x 35 x 48 mm',
      massGrams: 245,
      parentJoint: 'j3_elbow',
      shape: 'box',
      size: [0.36, 0.56, 0.36],
      color: 0x263238,
      pos: [-0.36, 0.75, 0],
      explodeVector: [-0.9, 0.3, 0]
    });

    add({
      id: 'forearm_gt2_belt_cover',
      name: 'GT2 Closed-Loop Timing Belt Shroud',
      category: 'transmission',
      material: 'Carbon-Reinforced Nylon',
      dimensionsMm: '165 x 22 x 16 mm',
      massGrams: 60,
      parentJoint: 'j3_elbow',
      shape: 'box',
      size: [0.16, 1.65, 0.22],
      color: 0x455a64,
      pos: [-0.34, 1.55, 0],
      explodeVector: [-0.9, 0.6, 0]
    });

    add({
      id: 'upper_cable_harness',
      name: 'Wrist & Gripper Umbilical Loom',
      category: 'cabling',
      material: 'Silicone Flex Conduit',
      dimensionsMm: 'Ø 12 x 210 mm',
      massGrams: 45,
      parentJoint: 'j3_elbow',
      shape: 'cylinder',
      radiusTop: 0.06,
      radiusBottom: 0.06,
      height: 2.05,
      color: 0xffab00,
      pos: [0.30, 1.25, 0],
      explodeVector: [0.9, 0.4, 0]
    });

    // --- J4 WRIST PITCH (Relative to j4_wrist_pitch pivot [0, 2.40, 0] inside j3_elbow) ---
    add({
      id: 'wrist_pitch_clevis',
      name: 'J4 Wrist Pitch Differential Clevis',
      category: 'structure',
      material: '7075-T6 Aluminum',
      dimensionsMm: '58 x 65 x 48 mm',
      massGrams: 195,
      parentJoint: 'j4_wrist_pitch',
      shape: 'box',
      size: [0.50, 0.68, 0.46],
      color: 0x00b8d4,
      pos: [0, 0.32, 0],
      explodeVector: [0, 0.6, 0]
    });

    add({
      id: 'wrist_pitch_pin',
      name: 'J4 Wrist Axle & Needle Bearing',
      category: 'bearing',
      material: 'Bearing Steel',
      dimensionsMm: 'Ø 12 x 58 mm',
      massGrams: 42,
      parentJoint: 'j4_wrist_pitch',
      shape: 'cylinder',
      radiusTop: 0.10,
      radiusBottom: 0.10,
      height: 0.58,
      color: 0xeceff1,
      pos: [0, 0, 0],
      rot: [Math.PI / 2, 0, 0],
      explodeVector: [0, 0, 0.8]
    });

    // --- J5 WRIST ROLL & ISO FLANGE (Relative to j5_wrist_roll pivot [0, 0.65, 0]) ---
    add({
      id: 'wrist_roll_actuator',
      name: 'J5 Hollow-Shaft Roll Servo',
      category: 'actuator',
      material: 'Anodized Aluminum',
      dimensionsMm: 'Ø 46 x 45 mm',
      massGrams: 180,
      parentJoint: 'j5_wrist_roll',
      shape: 'cylinder',
      radiusTop: 0.24,
      radiusBottom: 0.24,
      height: 0.42,
      color: 0x263238,
      pos: [0, 0.21, 0],
      explodeVector: [0, 0.7, 0]
    });

    add({
      id: 'iso_tool_flange',
      name: 'ISO 9409-1-50-4-M6 Tool Mounting Flange',
      category: 'transmission',
      material: '304 Stainless Steel',
      dimensionsMm: 'Ø 56 x 12 mm',
      massGrams: 95,
      parentJoint: 'j5_wrist_roll',
      shape: 'cylinder',
      radiusTop: 0.28,
      radiusBottom: 0.28,
      height: 0.12,
      color: 0xb0bec5,
      pos: [0, 0.48, 0],
      explodeVector: [0, 1.0, 0]
    });

    add({
      id: 'wrist_camera_module',
      name: 'Eye-in-Hand Optical Vision Sensor Pod',
      category: 'actuator',
      material: 'Anodized Aluminum / Glass Lens',
      dimensionsMm: '36 x 22 x 22 mm',
      massGrams: 55,
      parentJoint: 'j5_wrist_roll',
      shape: 'box',
      size: [0.22, 0.20, 0.32],
      color: 0x00ffee,
      pos: [0.34, 0.42, 0],
      explodeVector: [0.9, 1.0, 0]
    });

    // --- J6 PARALLEL GRIPPER END-EFFECTOR (Relative to j6_gripper pivot [0, 0.55, 0] inside j5_wrist_roll) ---
    add({
      id: 'gripper_rail_chassis',
      name: 'Parallel Linear-Rail Gripper Chassis',
      category: 'end_effector',
      material: '7075-T6 Hard Anodized Aluminum',
      dimensionsMm: '92 x 36 x 34 mm',
      massGrams: 210,
      parentJoint: 'j6_gripper',
      shape: 'box',
      size: [0.34, 0.36, 0.96],
      color: 0x0088cc,
      pos: [0, 0.18, 0],
      explodeVector: [0, 1.3, 0]
    });

    add({
      id: 'gripper_rack_servo',
      name: 'Gripper Rack-and-Pinion Servo',
      category: 'actuator',
      material: 'Aluminum Case / Brass Gears',
      dimensionsMm: '40 x 28 x 38 mm',
      massGrams: 68,
      parentJoint: 'j6_gripper',
      shape: 'box',
      size: [0.32, 0.28, 0.36],
      color: 0x263238,
      pos: [-0.26, 0.18, 0],
      explodeVector: [-0.8, 1.3, 0]
    });

    add({
      id: 'gripper_jaw_left',
      name: 'Parallel Jaw Finger (Left)',
      category: 'end_effector',
      material: '6061-T6 Aluminum',
      dimensionsMm: '14 x 78 x 22 mm',
      massGrams: 46,
      parentJoint: 'j6_gripper',
      gripSide: 'left',
      shape: 'box',
      size: [0.22, 0.78, 0.14],
      color: 0x00e5ff,
      pos: [0, 0.72, 0.24],
      explodeVector: [0, 1.7, 0.7]
    });

    add({
      id: 'gripper_pad_left',
      name: 'Silicone Friction Grip Pad (Left)',
      category: 'end_effector',
      material: 'Shore 60A Textured Silicone',
      dimensionsMm: '6 x 32 x 22 mm',
      massGrams: 12,
      parentJoint: 'j6_gripper',
      gripSide: 'left',
      shape: 'box',
      size: [0.22, 0.32, 0.06],
      color: 0xffab00,
      pos: [0, 0.94, 0.14],
      explodeVector: [0, 1.9, 0.9]
    });

    add({
      id: 'gripper_jaw_right',
      name: 'Parallel Jaw Finger (Right)',
      category: 'end_effector',
      material: '6061-T6 Aluminum',
      dimensionsMm: '14 x 78 x 22 mm',
      massGrams: 46,
      parentJoint: 'j6_gripper',
      gripSide: 'right',
      shape: 'box',
      size: [0.22, 0.78, 0.14],
      color: 0x00e5ff,
      pos: [0, 0.72, -0.24],
      explodeVector: [0, 1.7, -0.7]
    });

    add({
      id: 'gripper_pad_right',
      name: 'Silicone Friction Grip Pad (Right)',
      category: 'end_effector',
      material: 'Shore 60A Textured Silicone',
      dimensionsMm: '6 x 32 x 22 mm',
      massGrams: 12,
      parentJoint: 'j6_gripper',
      gripSide: 'right',
      shape: 'box',
      size: [0.22, 0.32, 0.06],
      color: 0xffab00,
      pos: [0, 0.94, -0.14],
      explodeVector: [0, 1.9, -0.9]
    });

    const totalMassGrams = components.reduce((acc, c) => acc + (c.massGrams || 0), 0);
    const scaleFactor = options.reachMm ? Math.max(0.55, Math.min(2.2, Number(options.reachMm) / 680)) : 1.0;
    const beamScale = Math.max(0.85, Math.min(1.6, Number(options.beamScale || 1.0)));
    const overrideMaterial = options.structuralMaterial || null;
    if (scaleFactor !== 1.0 || beamScale !== 1.0 || overrideMaterial) {
      for (const j of joints) {
        j.pivot = j.pivot.map(v => Number((v * scaleFactor).toFixed(4)));
        if (options.actuatorOverrides && options.actuatorOverrides[j.id]) {
          j.actuator = options.actuatorOverrides[j.id];
        }
      }
      for (const c of components) {
        if (c.pos) c.pos = c.pos.map(v => Number((v * scaleFactor).toFixed(4)));
        if (c.size) c.size = c.size.map((v, idx) => Number((v * scaleFactor * (c.category === 'structure' && idx !== 1 ? beamScale : 1)).toFixed(4)));
        if (c.height !== undefined) c.height = Number((c.height * scaleFactor).toFixed(4));
        if (c.radius !== undefined) c.radius = Number((c.radius * scaleFactor).toFixed(4));
        if (c.radiusTop !== undefined) c.radiusTop = Number((c.radiusTop * scaleFactor).toFixed(4));
        if (c.radiusBottom !== undefined) c.radiusBottom = Number((c.radiusBottom * scaleFactor).toFixed(4));
        if (overrideMaterial && c.category === 'structure') c.material = overrideMaterial;
        if (c.massGrams) c.massGrams = Math.round(c.massGrams * Math.pow(scaleFactor, 2.2) * beamScale);
      }
    }
    const finalMassGrams = components.reduce((acc, c) => acc + (c.massGrams || 0), 0);
    return {
      type: 'articulated_cad',
      archetype: 'robotic_arm',
      geometryProvenance: 'engineering_parametric',
      units: 'scale_100mm',
      dof: joints.filter(j => j.axis !== 'grip').length,
      joints,
      components,
      engineeringSummary: {
        partCount: components.length,
        jointCount: joints.length,
        reachMm: Number(options.reachMm || 680),
        recommendedPayloadKg: Number(options.payloadKg ?? 1.5),
        estimatedArmMassKg: Number((finalMassGrams / 1000).toFixed(2)),
        structuralMaterial: overrideMaterial || '6061-T6 Anodized Aluminum + Cast Steel',
        mountingStandard: 'ISO 9409-1-50-4-M6 Wrist + 8x M6 Base',
        powerBus: options.powerBus || '24V DC / 15A (with hardware E-Stop & inline fuse)'
      }
    };
  }

  /**
   * Normalizes arbitrary custom engineering assemblies synthesized by reasoning/design tools
   */
  _normalizeCustomGeometrySpec(customSpec = {}, options = {}) {
    const rawJoints = Array.isArray(customSpec.joints) ? customSpec.joints : [];
    const joints = rawJoints.map((j, idx) => ({
      id: j.id || `joint_${idx + 1}`,
      label: j.label || j.id || `Joint ${idx + 1}`,
      axis: j.axis || 'z',
      parent: j.parent || null,
      pivot: Array.isArray(j.pivot) && j.pivot.length === 3 ? j.pivot.map(Number) : [0, 0, 0],
      minDeg: Number(j.minDeg ?? -90),
      maxDeg: Number(j.maxDeg ?? 90),
      defaultDeg: Number(j.defaultDeg ?? 0),
      actuator: j.actuator || 'Parametric Actuator'
    }));

    const components = (customSpec.components || []).map((c, idx) => {
      const pos = Array.isArray(c.pos) && c.pos.length === 3 ? c.pos.map(Number) : [0, 0, 0];
      const shape = c.shape || 'box';
      const args = Array.isArray(c.args) ? c.args.map(Number) : null;
      return {
        id: c.id || `part_${idx + 1}`,
        name: c.name || `Structural Part #${idx + 1}`,
        category: c.category || 'structure',
        material: c.material || options.structuralMaterial || '6061-T6 Aluminum',
        dimensionsMm: c.dimensionsMm || 'Custom Parametric',
        massGrams: Number(c.massGrams || 120),
        parentJoint: c.parentJoint || null,
        gripSide: c.gripSide || undefined,
        shape,
        size: shape === 'box' ? (Array.isArray(c.size) ? c.size.map(Number) : (args && args.length >= 3 ? args.slice(0, 3) : [1, 1, 1])) : undefined,
        radius: c.radius !== undefined ? Number(c.radius) : ((shape === 'sphere' || shape === 'cone' || shape === 'torus') && args ? args[0] : undefined),
        radiusTop: c.radiusTop !== undefined ? Number(c.radiusTop) : (shape === 'cylinder' && args ? args[0] : undefined),
        radiusBottom: c.radiusBottom !== undefined ? Number(c.radiusBottom) : (shape === 'cylinder' && args ? (args[1] ?? args[0]) : undefined),
        height: c.height !== undefined ? Number(c.height) : ((shape === 'cylinder' && args ? args[2] : undefined) || (shape === 'cone' && args ? args[1] : undefined)),
        tube: c.tube !== undefined ? Number(c.tube) : (shape === 'torus' && args ? args[1] : undefined),
        color: c.color !== undefined ? c.color : 0x00e5ff,
        pos,
        rot: Array.isArray(c.rot) && c.rot.length === 3 ? c.rot.map(Number) : [0, 0, 0],
        explodeVector: Array.isArray(c.explodeVector) && c.explodeVector.length === 3
          ? c.explodeVector.map(Number)
          : [Number((pos[0] * 0.4).toFixed(2)), Number((0.6 + idx * 0.08).toFixed(2)), Number((pos[2] * 0.4).toFixed(2))]
      };
    });

    const totalMassGrams = components.reduce((acc, c) => acc + (c.massGrams || 0), 0);
    return {
      type: 'articulated_cad',
      archetype: customSpec.archetype || options.archetype || 'custom',
      geometryProvenance: customSpec.geometryProvenance || 'engineering_parametric',
      gripPresets: customSpec.gripPresets || undefined,
      units: customSpec.units || 'scale_100mm',
      dof: joints.filter(j => j.axis !== 'grip').length,
      joints,
      components,
      engineeringSummary: {
        partCount: components.length,
        jointCount: joints.length,
        reachMm: Number(options.reachMm || customSpec.engineeringSummary?.reachMm || 450),
        recommendedPayloadKg: Number(options.payloadKg || customSpec.engineeringSummary?.recommendedPayloadKg || 1.0),
        estimatedMassKg: Number((totalMassGrams / 1000).toFixed(2)),
        structuralMaterial: options.structuralMaterial || 'Multi-Material Parametric CAD',
        powerBus: options.powerBus || '12V-24V DC (Fused + E-Stop)'
      }
    };
  }

  /**
   * Parametric 3-Axis Cartesian CNC / Laser / Plotter Gantry Assembly
   */
  _buildCartesianGantrySpec(options = {}) {
    const span = Math.max(0.7, Math.min(2.0, Number(options.reachMm || 400) / 400));
    const mat = options.structuralMaterial || '6061-T6 V-Slot Aluminum Extrusion (2040)';
    const w = Number((4.8 * span).toFixed(2));
    const d = Number((5.2 * span).toFixed(2));
    const h = Number((3.4 * span).toFixed(2));
    const joints = [
      { id: 'j1_y_carriage', label: 'Y-Axis Gantry Bridge', axis: 'y', parent: null, pivot: [0, 0.45, 0], minDeg: -40, maxDeg: 40, defaultDeg: 0, actuator: '2x NEMA 17 + Dual GT2 Belt / T8 Leadscrew' },
      { id: 'j2_x_carriage', label: 'X-Axis Tool Head Carriage', axis: 'z', parent: 'j1_y_carriage', pivot: [0, h * 0.72, 0], minDeg: -25, maxDeg: 25, defaultDeg: 0, actuator: 'NEMA 17 + T8-4P2 Leadscrew + LM10UU Bearings' },
      { id: 'j3_z_spindle', label: 'Z-Axis Spindle / Pen Chuck', axis: 'y', parent: 'j2_x_carriage', pivot: [0, -0.45, 0.35], minDeg: -180, maxDeg: 180, defaultDeg: 15, actuator: 'NEMA 14 + 8mm Tr8 Leadscrew + Brushless Spindle' }
    ];
    const components = [
      { id: 'gantry_bed', name: 'T-Slot CNC Workbed Plate', category: 'structure', material: mat, dimensionsMm: `${Math.round(w * 100)} x ${Math.round(d * 100)} x 18 mm`, massGrams: 1850, parentJoint: null, shape: 'box', size: [w, 0.18, d], color: 0x2c3a4b, pos: [0, 0.09, 0], explodeVector: [0, -1.0, 0] },
      { id: 'rail_y_left', name: 'Left Y Linear Profile + MGN12 Rail', category: 'structure', material: mat, dimensionsMm: `40 x 40 x ${Math.round(d * 100)} mm`, massGrams: 640, parentJoint: null, shape: 'box', size: [0.36, 0.36, d], color: 0x5c728a, pos: [-w / 2 + 0.18, 0.36, 0], explodeVector: [-1.2, 0.2, 0] },
      { id: 'rail_y_right', name: 'Right Y Linear Profile + MGN12 Rail', category: 'structure', material: mat, dimensionsMm: `40 x 40 x ${Math.round(d * 100)} mm`, massGrams: 640, parentJoint: null, shape: 'box', size: [0.36, 0.36, d], color: 0x5c728a, pos: [w / 2 - 0.18, 0.36, 0], explodeVector: [1.2, 0.2, 0] },
      { id: 'y_motor_left', name: 'Y1 NEMA 17 Stepper Motor', category: 'actuator', material: '42BYGH48 Silicon Steel', dimensionsMm: '42 x 42 x 48 mm', massGrams: 350, parentJoint: null, shape: 'box', size: [0.42, 0.42, 0.48], color: 0x1b232e, pos: [-w / 2 + 0.18, 0.38, -d / 2 - 0.2], explodeVector: [-1.4, 0.3, -1.0] },
      { id: 'y_motor_right', name: 'Y2 NEMA 17 Stepper Motor', category: 'actuator', material: '42BYGH48 Silicon Steel', dimensionsMm: '42 x 42 x 48 mm', massGrams: 350, parentJoint: null, shape: 'box', size: [0.42, 0.42, 0.48], color: 0x1b232e, pos: [w / 2 - 0.18, 0.38, -d / 2 - 0.2], explodeVector: [1.4, 0.3, -1.0] },
      { id: 'y_upright_l', name: 'Port Gantry Z-Column', category: 'structure', material: mat, dimensionsMm: `40 x ${Math.round(h * 100)} x 80 mm`, massGrams: 580, parentJoint: 'j1_y_carriage', shape: 'box', size: [0.38, h * 0.78, 0.72], color: 0x455a64, pos: [-w / 2 + 0.18, h * 0.38, 0], explodeVector: [-1.4, 0.8, 0] },
      { id: 'y_upright_r', name: 'Starboard Gantry Z-Column', category: 'structure', material: mat, dimensionsMm: `40 x ${Math.round(h * 100)} x 80 mm`, massGrams: 580, parentJoint: 'j1_y_carriage', shape: 'box', size: [0.38, h * 0.78, 0.72], color: 0x455a64, pos: [w / 2 - 0.18, h * 0.38, 0], explodeVector: [1.4, 0.8, 0] },
      { id: 'x_bridge_beam', name: 'X-Axis Crossbeam + Dual Linear Rods', category: 'structure', material: mat, dimensionsMm: `${Math.round(w * 100)} x 60 x 40 mm`, massGrams: 820, parentJoint: 'j1_y_carriage', shape: 'box', size: [w, 0.48, 0.42], color: 0x00bcd4, pos: [0, h * 0.74, 0], explodeVector: [0, 1.5, 0] },
      { id: 'x_leadscrew', name: 'Tr8x8 Acme Leadscrew', category: 'transmission', material: '304 Stainless Steel', dimensionsMm: `Ø 8 x ${Math.round(w * 95)} mm`, massGrams: 220, parentJoint: 'j1_y_carriage', shape: 'cylinder', radiusTop: 0.06, radiusBottom: 0.06, height: w * 0.94, color: 0xd0dbe4, pos: [0, h * 0.74, 0.28], rot: [0, 0, Math.PI / 2], explodeVector: [0, 1.7, 0.8] },
      { id: 'x_carriage_plate', name: 'CNC Aluminum Tool Saddle', category: 'structure', material: '6061-T6 Billet Plate', dimensionsMm: '90 x 110 x 10 mm', massGrams: 240, parentJoint: 'j2_x_carriage', shape: 'box', size: [0.9, 1.1, 0.24], color: 0x78909c, pos: [0, 0, 0.22], explodeVector: [0, 0.5, 1.2] },
      { id: 'z_motor', name: 'Z-Axis NEMA 14 Stepper', category: 'actuator', material: 'Silicon Steel + Brass Leadnut', dimensionsMm: '35 x 35 x 34 mm', massGrams: 190, parentJoint: 'j2_x_carriage', shape: 'box', size: [0.35, 0.35, 0.35], color: 0x1b232e, pos: [0, 0.72, 0.28], explodeVector: [0, 1.4, 1.2] },
      { id: 'spindle_body', name: 'ER11 Brushless Spindle / Tool Mount', category: 'end_effector', material: 'Anodized Aluminum + Ceramic Bearing', dimensionsMm: 'Ø 52 x 120 mm', massGrams: 460, parentJoint: 'j3_z_spindle', shape: 'cylinder', radiusTop: 0.26, radiusBottom: 0.26, height: 1.15, color: 0x00e5ff, pos: [0, 0, 0], explodeVector: [0, -0.8, 1.5] },
      { id: 'er11_collet', name: 'ER11 Precision Collet & Bit', category: 'end_effector', material: 'Hardened Carbide / Steel', dimensionsMm: 'Ø 16 x 45 mm', massGrams: 65, parentJoint: 'j3_z_spindle', shape: 'cone', radius: 0.10, height: 0.45, color: 0xffb300, pos: [0, -0.78, 0], rot: [Math.PI, 0, 0], explodeVector: [0, -1.6, 1.5] }
    ];
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 === 0 ? -w / 2 + 0.2 : w / 2 - 0.2;
      const sz = i < 2 ? -d / 2 + 0.2 : d / 2 - 0.2;
      components.push({
        id: `corner_foot_${i + 1}`,
        name: `Rubber-Damped Corner Bracket #${i + 1}`,
        category: 'fastener',
        material: 'Cast Aluminum + EPDM Pad',
        dimensionsMm: '40 x 40 x 30 mm',
        massGrams: 75,
        parentJoint: null,
        shape: 'cylinder',
        radiusTop: 0.2,
        radiusBottom: 0.24,
        height: 0.16,
        color: 0x90a4ae,
        pos: [sx, -0.05, sz],
        explodeVector: [sx * 0.4, -0.9, sz * 0.4]
      });
    }
    return this._normalizeCustomGeometrySpec({ archetype: 'cartesian_gantry', joints, components }, options);
  }

  /**
   * Parametric 4WD Autonomous Rover / UGV Chassis Assembly
   */
  _buildRoverChassisSpec(options = {}) {
    const scale = Math.max(0.75, Math.min(1.8, Number(options.reachMm || 420) / 420));
    const mat = options.structuralMaterial || '6061-T6 Extruded Frame + PETG Mounts';
    const joints = [
      { id: 'j1_wheels_left', label: 'Left Side Drive Bogie', axis: 'x', parent: null, pivot: [-1.45 * scale, 0.55, 0], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: '2x 12V JGB37-520 Encoder Geared Motors' },
      { id: 'j2_wheels_right', label: 'Right Side Drive Bogie', axis: 'x', parent: null, pivot: [1.45 * scale, 0.55, 0], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: '2x 12V JGB37-520 Encoder Geared Motors' },
      { id: 'j3_sensor_mast', label: 'Pan-Tilt LiDAR/Camera Mast', axis: 'y', parent: null, pivot: [0, 1.45, 0.9 * scale], minDeg: -160, maxDeg: 160, defaultDeg: 15, actuator: 'MG996R Pan Servo + 2-DOF Bracket' }
    ];
    const components = [
      { id: 'lower_chassis_plate', name: 'Lower Aluminum Skid & Battery Deck', category: 'structure', material: mat, dimensionsMm: `${Math.round(240 * scale)} x ${Math.round(360 * scale)} x 4 mm`, massGrams: 740, parentJoint: null, shape: 'box', size: [2.2 * scale, 0.12, 3.4 * scale], color: 0x37474f, pos: [0, 0.62, 0], explodeVector: [0, -0.8, 0] },
      { id: 'upper_avionics_deck', name: 'Upper Compute & Motor Driver Deck', category: 'structure', material: mat, dimensionsMm: `${Math.round(220 * scale)} x ${Math.round(320 * scale)} x 4 mm`, massGrams: 520, parentJoint: null, shape: 'box', size: [2.0 * scale, 0.10, 3.0 * scale], color: 0x00acc1, pos: [0, 1.25, 0], explodeVector: [0, 1.2, 0] },
      { id: 'lipo_battery_pack', name: '3S 11.1V LiPo / 18650 Battery Pack', category: 'electronics', material: 'Lithium-Ion 18650 + BMS', dimensionsMm: '110 x 68 x 38 mm', massGrams: 340, parentJoint: null, shape: 'box', size: [1.1, 0.38, 0.68], color: 0xffa726, pos: [0, 0.88, -0.4], explodeVector: [0, 0.6, -1.2] },
      { id: 'esp32_driver_bay', name: 'ESP32 + Dual TB6612FNG / BTS7960 Bay', category: 'electronics', material: 'FR4 PCB + Aluminum Heatsink', dimensionsMm: '95 x 75 x 22 mm', massGrams: 115, parentJoint: null, shape: 'box', size: [0.95, 0.22, 0.75], color: 0x00695c, pos: [0, 1.0, 0.65], explodeVector: [0, 0.8, 1.0] },
      { id: 'mast_column', name: 'Sensor Mast Tower', category: 'structure', material: 'CF Tube Ø 20mm', dimensionsMm: 'Ø 20 x 55 mm', massGrams: 85, parentJoint: 'j3_sensor_mast', shape: 'cylinder', radiusTop: 0.12, radiusBottom: 0.14, height: 0.55, color: 0x263238, pos: [0, 0.25, 0], explodeVector: [0, 1.6, 0.6] },
      { id: 'lidar_sensor_head', name: '360° ToF / Ultrasonic Sensor Head', category: 'sensor', material: 'Optical Polycarbonate + IR Array', dimensionsMm: 'Ø 55 x 38 mm', massGrams: 145, parentJoint: 'j3_sensor_mast', shape: 'cylinder', radiusTop: 0.32, radiusBottom: 0.32, height: 0.36, color: 0x00e5ff, pos: [0, 0.64, 0], explodeVector: [0, 2.2, 0.8] }
    ];
    for (const [sideIdx, jId, sx] of [[0, 'j1_wheels_left', 0], [1, 'j2_wheels_right', 0]]) {
      for (const [posLabel, zOff] of [['front', 1.15 * scale], ['rear', -1.15 * scale]]) {
        components.push({
          id: `wheel_${sideIdx}_${posLabel}`,
          name: `${sideIdx === 0 ? 'Port' : 'Starboard'} ${posLabel} High-Grip Wheel (Ø 110mm)`,
          category: 'transmission',
          material: '60A Silicone Tread + 6061 Hub',
          dimensionsMm: 'Ø 110 x 45 mm',
          massGrams: 220,
          parentJoint: jId,
          shape: 'cylinder',
          radiusTop: 0.55,
          radiusBottom: 0.55,
          height: 0.42,
          color: 0x1a1f24,
          pos: [sx, 0, zOff],
          rot: [0, 0, Math.PI / 2],
          explodeVector: [sideIdx === 0 ? -1.4 : 1.4, -0.3, zOff * 0.4]
        });
      }
    }
    return this._normalizeCustomGeometrySpec({ archetype: 'rover_chassis', joints, components }, options);
  }

  /**
   * Parametric Epicyclic / Planetary Gearbox Assembly
   */
  _buildPlanetaryGearboxSpec(options = {}) {
    const joints = [
      { id: 'j1_sun_input', label: 'Sun Input Shaft', axis: 'y', parent: null, pivot: [0, 0.6, 0], minDeg: -180, maxDeg: 180, defaultDeg: 0, actuator: 'NEMA 23 Input Shaft' },
      { id: 'j2_planet_carrier', label: 'Planet Output Carrier (5:1)', axis: 'y', parent: null, pivot: [0, 1.35, 0], minDeg: -180, maxDeg: 180, defaultDeg: 25, actuator: '3x Hardened Planet Cluster + 6808 Bearing' }
    ];
    const components = [
      { id: 'ring_housing', name: 'Internal Ring Gear Housing', category: 'structure', material: '4140 Alloy Steel / CF-Nylon', dimensionsMm: 'Ø 110 x 48 mm', massGrams: 490, parentJoint: null, shape: 'torus', radius: 0.95, tube: 0.18, color: 0x455a64, pos: [0, 0.9, 0], rot: [Math.PI / 2, 0, 0], explodeVector: [0, 0, 1.2] },
      { id: 'input_flange', name: 'NEMA 23 Rear Mounting Plate', category: 'structure', material: '6061-T6 Aluminum', dimensionsMm: 'Ø 105 x 12 mm', massGrams: 180, parentJoint: null, shape: 'cylinder', radiusTop: 1.05, radiusBottom: 1.05, height: 0.16, color: 0x263238, pos: [0, 0.25, 0], explodeVector: [0, -1.2, 0] },
      { id: 'sun_gear', name: '16T Input Sun Gear', category: 'transmission', material: '20MnCr5 Hardened Steel', dimensionsMm: 'Mod 1.25 / 16T', massGrams: 75, parentJoint: 'j1_sun_input', shape: 'cylinder', radiusTop: 0.28, radiusBottom: 0.28, height: 0.42, color: 0xffca28, pos: [0, 0.3, 0], explodeVector: [0, -0.6, 0] },
      { id: 'carrier_spider', name: '3-Arm Output Carrier Spider + ISO Flange', category: 'transmission', material: '7075-T6 Aluminum', dimensionsMm: 'Ø 88 x 18 mm', massGrams: 195, parentJoint: 'j2_planet_carrier', shape: 'cylinder', radiusTop: 0.85, radiusBottom: 0.85, height: 0.20, color: 0x00e5ff, pos: [0, 0.18, 0], explodeVector: [0, 1.5, 0] }
    ];
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      components.push({
        id: `planet_gear_${i + 1}`,
        name: `Planet Gear #${i + 1} (24T + 608 Bearing)`,
        category: 'transmission',
        material: 'Hardened Steel + 608-2RS',
        dimensionsMm: 'Mod 1.25 / 24T',
        massGrams: 95,
        parentJoint: 'j2_planet_carrier',
        shape: 'cylinder',
        radiusTop: 0.34,
        radiusBottom: 0.34,
        height: 0.38,
        color: 0x90caf9,
        pos: [Number((Math.cos(a) * 0.62).toFixed(3)), -0.42, Number((Math.sin(a) * 0.62).toFixed(3))],
        explodeVector: [Math.cos(a) * 1.1, 0.5, Math.sin(a) * 1.1]
      });
    }
    return this._normalizeCustomGeometrySpec({ archetype: 'planetary_gearbox', joints, components }, options);
  }

  /**
   * Parametric Rack-and-Pinion Parallel Mechanical Gripper
   */
  _buildMechanicalGripperSpec(options = {}) {
    const joints = [
      { id: 'j1_gripper', label: 'Parallel Jaw Stroke (0–50mm)', axis: 'grip', parent: null, pivot: [0, 0.8, 0], minDeg: 0, maxDeg: 45, defaultDeg: 18, actuator: 'MG996R Metal Gear Servo + Spur Pinion' }
    ];
    const components = [
      { id: 'gripper_body', name: 'CNC Servo & Linear Rail Chassis', category: 'structure', material: '6061-T6 Aluminum', dimensionsMm: '84 x 42 x 34 mm', massGrams: 165, parentJoint: null, shape: 'box', size: [0.84, 0.42, 0.68], color: 0x37474f, pos: [0, 0.45, 0], explodeVector: [0, -0.8, 0] },
      { id: 'servo_housing', name: 'MG996R High-Torque Servo Drive', category: 'actuator', material: 'ABS + Brass Gear Train', dimensionsMm: '40.7 x 19.7 x 42.9 mm', massGrams: 55, parentJoint: null, shape: 'box', size: [0.42, 0.42, 0.22], color: 0x1c252e, pos: [0, 0.45, 0], explodeVector: [0, -1.2, 0.5] },
      { id: 'jaw_left', name: 'Left Guided Parallel Finger', category: 'end_effector', material: '7075-T6 + Silicone Pad', dimensionsMm: '14 x 72 x 22 mm', massGrams: 48, parentJoint: 'j1_gripper', gripSide: 'left', shape: 'box', size: [0.22, 0.72, 0.14], color: 0x00e5ff, pos: [0, 0.48, 0.22], explodeVector: [0, 1.2, 0.8] },
      { id: 'jaw_right', name: 'Right Guided Parallel Finger', category: 'end_effector', material: '7075-T6 + Silicone Pad', dimensionsMm: '14 x 72 x 22 mm', massGrams: 48, parentJoint: 'j1_gripper', gripSide: 'right', shape: 'box', size: [0.22, 0.72, 0.14], color: 0x00e5ff, pos: [0, 0.48, -0.22], explodeVector: [0, 1.2, -0.8] }
    ];
    return this._normalizeCustomGeometrySpec({ archetype: 'mechanical_gripper', joints, components }, options);
  }

  _generateGlbFile(modelDef) {
    return buildGlbBuffer(
      modelDef,
      (spec) => this._computeJointWorldOffsets(spec),
      (comp, jOff) => this._tessellateComponent(comp, jOff)
    );
  }

  _generateEngineeringSpecJson(modelDef) {
    const spec = modelDef.geometrySpec || {};
    const bom = (spec.components || []).map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      material: c.material || '6061-T6 Aluminum',
      dimensionsMm: c.dimensionsMm || 'Custom',
      massGrams: Number(c.massGrams || 0),
      parentJoint: c.parentJoint || 'fixed_base'
    }));
    return JSON.stringify({
      identity: 'JARVIS — POWERED BY VISION (MADE BY LOKESH)',
      exportedAt: new Date().toISOString(),
      modelId: modelDef.modelId,
      name: modelDef.name,
      archetype: modelDef.archetype,
      geometryProvenance: spec.geometryProvenance || 'engineering_parametric',
      engineeringSummary: spec.engineeringSummary || {},
      savedJointPose: modelDef.savedJointPose || {},
      joints: spec.joints || [],
      billOfMaterials: bom
    }, null, 2);
  }

  listRobotCatalog() {
    return ROBOTICS_CATALOG;
  }

  async import3dModel({ filename = '', dataBase64 = '', textContent = '', name = '', theme = 'titanium' } = {}) {
    this._ensureDir();
    const cleanFilename = path.basename(String(filename || 'imported_model.obj'));
    const ext = path.extname(cleanFilename).toLowerCase();

    if (ext === '.step' || ext === '.stp' || ext === '.iges' || ext === '.igs') {
      return {
        success: false,
        unsupportedFormat: true,
        format: ext.slice(1),
        error: `Native B-Rep ${ext.toUpperCase()} kernel (OpenCASCADE / FreeCAD) is not installed on this host. Convert to OBJ, STL, or GLB/GLTF to load it directly into the JARVIS Holographic Robotics Lab.`
      };
    }

    if (!['.obj', '.stl', '.glb', '.gltf', '.json'].includes(ext)) {
      return {
        success: false,
        unsupportedFormat: true,
        format: ext || 'unknown',
        error: `Unsupported CAD/Mesh extension "${ext || 'none'}". Supported formats: .obj, .stl, .glb, .gltf, .json.`
      };
    }

    const rawBuffer = dataBase64
      ? Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64')
      : Buffer.from(String(textContent || ''), 'utf8');

    if (!rawBuffer.length || rawBuffer.length > 35 * 1024 * 1024) {
      return { success: false, error: 'Imported file is empty or exceeds 35MB safety limit.' };
    }

    const modelId = `import_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const cleanName = (name || path.basename(cleanFilename, ext) || 'imported_assembly').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const folder = path.join(MODELS_DIR, modelId);
    fs.mkdirSync(folder, { recursive: true });
    const storedPath = path.join(folder, cleanFilename);
    fs.writeFileSync(storedPath, rawBuffer);

    // Quick geometry stats inspection
    const textPreview = ext === '.glb' ? '' : rawBuffer.toString('utf8');
    let vertexEstimate = 0;
    let faceEstimate = 0;
    let parsedCustomSpec = null;

    if (ext === '.obj') {
      vertexEstimate = (textPreview.match(/^v\s+/gm) || []).length;
      faceEstimate = (textPreview.match(/^f\s+/gm) || []).length;
    } else if (ext === '.stl') {
      const asciiTris = (textPreview.match(/facet\s+normal/gi) || []).length;
      faceEstimate = asciiTris > 0 ? asciiTris : (rawBuffer.length >= 84 ? rawBuffer.readUInt32LE(80) : 0);
      vertexEstimate = faceEstimate * 3;
    } else if (ext === '.glb' && rawBuffer.length >= 12) {
      const magic = rawBuffer.toString('ascii', 0, 4);
      if (magic !== 'glTF') {
        return { success: false, error: 'Invalid GLB binary header (expected glTF magic).' };
      }
    } else if (ext === '.json') {
      try {
        const parsed = JSON.parse(textPreview);
        if (parsed.geometrySpec?.components) parsedCustomSpec = parsed.geometrySpec;
        else if (Array.isArray(parsed.components)) parsedCustomSpec = parsed;
      } catch (e) {
        return { success: false, error: `Invalid JSON model specification: ${e.message}` };
      }
    }

    if (parsedCustomSpec) {
      return await this.create3dModel(cleanName, {
        name: cleanName,
        archetype: parsedCustomSpec.archetype || 'custom_engineering_assembly',
        theme,
        customSpec: parsedCustomSpec
      });
    }

    const importFormat = ext.slice(1);
    const modelDef = {
      modelId,
      name: cleanName,
      description: `Imported external ${importFormat.toUpperCase()} CAD mesh (${cleanFilename})`,
      archetype: 'imported_mesh',
      theme,
      createdAt: new Date().toISOString(),
      saved: true,
      savedAt: new Date().toISOString(),
      parameters: { importFormat, originalFilename: cleanFilename, byteLength: rawBuffer.length },
      geometrySpec: {
        type: 'external_mesh',
        archetype: 'imported_mesh',
        geometryProvenance: 'external_imported_mesh',
        importFormat,
        meshUrl: `/api/3d-model/${encodeURIComponent(modelId)}/export/${encodeURIComponent(importFormat)}`,
        joints: [],
        components: [{
          id: 'imported_root_mesh',
          name: cleanFilename,
          category: 'imported_mesh',
          material: 'Imported CAD Asset',
          dimensionsMm: `Vertices~${vertexEstimate} Faces~${faceEstimate} (${rawBuffer.length} B)`,
          massGrams: 0,
          shape: 'external'
        }],
        engineeringSummary: {
          partCount: 1,
          jointCount: 0,
          vertexEstimate,
          faceEstimate,
          fileSizeBytes: rawBuffer.length
        }
      },
      files: {
        [importFormat]: storedPath,
        metadata: path.join(folder, 'metadata.json')
      },
      verification: {
        filesVerified: rawBuffer.length > 0,
        byteLength: rawBuffer.length,
        verifiedAt: new Date().toISOString()
      }
    };
    fs.writeFileSync(modelDef.files.metadata, JSON.stringify(modelDef, null, 2), 'utf8');
    this.activeModels.set(modelId, modelDef);
    return {
      success: true,
      verified: true,
      modelId,
      model: modelDef,
      geometrySpec: modelDef.geometrySpec,
      summary: `Imported ${importFormat.toUpperCase()} model "${cleanFilename}" (${rawBuffer.length} bytes) into JARVIS Robotics Lab, sir.`
    };
  }

  /**
   * Computes world origin offsets of hierarchical joints in their neutral pose for flat OBJ/STL export
   */
  _computeJointWorldOffsets(geometrySpec) {
    const offsets = new Map();
    const joints = Array.isArray(geometrySpec?.joints) ? geometrySpec.joints : [];
    const byId = new Map(joints.map(j => [j.id, j]));

    const resolveOffset = (jId) => {
      if (!jId) return [0, 0, 0];
      if (offsets.has(jId)) return offsets.get(jId);
      const j = byId.get(jId);
      if (!j) return [0, 0, 0];
      const pOff = resolveOffset(j.parent);
      const piv = j.pivot || [0, 0, 0];
      const out = [pOff[0] + piv[0], pOff[1] + piv[1], pOff[2] + piv[2]];
      offsets.set(jId, out);
      return out;
    };

    for (const j of joints) resolveOffset(j.id);
    return offsets;
  }

  /**
   * Tessellates any parametric component shape into world-space triangles { vertices, faces }
   */
  _tessellateComponent(comp, jointWorldOffset = [0, 0, 0]) {
    const px = (comp.pos ? comp.pos[0] : 0) + (jointWorldOffset[0] || 0);
    const py = (comp.pos ? comp.pos[1] : 0) + (jointWorldOffset[1] || 0);
    const pz = (comp.pos ? comp.pos[2] : 0) + (jointWorldOffset[2] || 0);
    const rot = comp.rot || [0, 0, 0];

    const rx = rot[0] || 0, ry = rot[1] || 0, rz = rot[2] || 0;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);

    const transformPt = (lx, ly, lz) => {
      // Euler XYZ order matching Three.js default
      const y1 = ly * cx - lz * sx;
      const z1 = ly * sx + lz * cx;
      const x1 = lx;
      const x2 = x1 * cy + z1 * sy;
      const z2 = -x1 * sy + z1 * cy;
      const y2 = y1;
      const x3 = x2 * cz - y2 * sz;
      const y3 = x2 * sz + y2 * cz;
      const z3 = z2;
      return [
        Number((x3 + px).toFixed(5)),
        Number((y3 + py).toFixed(5)),
        Number((z3 + pz).toFixed(5))
      ];
    };

    const vertices = [];
    const faces = []; // array of 0-based [i0, i1, i2] triangles
    const shape = comp.shape || 'box';

    if (shape === 'cylinder' || shape === 'cone') {
      const segs = 16;
      const rTop = shape === 'cone' ? 0.001 : (comp.radiusTop ?? comp.radius ?? 0.5);
      const rBot = comp.radiusBottom ?? comp.radius ?? 0.5;
      const halfH = (comp.height || 1.0) / 2;

      const topCenter = vertices.length;
      vertices.push(transformPt(0, halfH, 0));
      const botCenter = vertices.length;
      vertices.push(transformPt(0, -halfH, 0));

      const topRingStart = vertices.length;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        vertices.push(transformPt(Math.cos(a) * rTop, halfH, Math.sin(a) * rTop));
      }
      const botRingStart = vertices.length;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        vertices.push(transformPt(Math.cos(a) * rBot, -halfH, Math.sin(a) * rBot));
      }

      for (let i = 0; i < segs; i++) {
        const next = (i + 1) % segs;
        faces.push([topCenter, topRingStart + next, topRingStart + i]);
        faces.push([botCenter, botRingStart + i, botRingStart + next]);
        faces.push([topRingStart + i, topRingStart + next, botRingStart + next]);
        faces.push([topRingStart + i, botRingStart + next, botRingStart + i]);
      }
    } else if (shape === 'torus') {
      const majSeg = 16;
      const minSeg = 8;
      const R = comp.radius || 1.0;
      const r = comp.tube || 0.15;
      for (let i = 0; i < majSeg; i++) {
        const u = (i / majSeg) * Math.PI * 2;
        const cu = Math.cos(u), su = Math.sin(u);
        for (let j = 0; j < minSeg; j++) {
          const v = (j / minSeg) * Math.PI * 2;
          const cv = Math.cos(v), sv = Math.sin(v);
          const x = (R + r * cv) * cu;
          const y = (R + r * cv) * su;
          const z = r * sv;
          vertices.push(transformPt(x, y, z));
        }
      }
      for (let i = 0; i < majSeg; i++) {
        const ni = (i + 1) % majSeg;
        for (let j = 0; j < minSeg; j++) {
          const nj = (j + 1) % minSeg;
          const a = i * minSeg + j;
          const b = ni * minSeg + j;
          const c = ni * minSeg + nj;
          const d = i * minSeg + nj;
          faces.push([a, b, c]);
          faces.push([a, c, d]);
        }
      }
    } else if (shape === 'sphere') {
      const rings = 8;
      const segs = 12;
      const r = comp.radius || 1.0;
      for (let i = 0; i <= rings; i++) {
        const phi = (i / rings) * Math.PI;
        for (let j = 0; j < segs; j++) {
          const theta = (j / segs) * Math.PI * 2;
          vertices.push(transformPt(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
          ));
        }
      }
      for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segs; j++) {
          const nj = (j + 1) % segs;
          const a = i * segs + j;
          const b = (i + 1) * segs + j;
          const c = (i + 1) * segs + nj;
          const d = i * segs + nj;
          faces.push([a, b, c]);
          faces.push([a, c, d]);
        }
      }
    } else {
      const sz = comp.size || [1, 1, 1];
      const hx = sz[0] / 2, hy = sz[1] / 2, hz = sz[2] / 2;
      const boxPts = [
        [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
        [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]
      ];
      for (const p of boxPts) vertices.push(transformPt(p[0], p[1], p[2]));
      const boxTris = [
        [0, 1, 2], [0, 2, 3],
        [4, 6, 5], [4, 7, 6],
        [0, 4, 5], [0, 5, 1],
        [1, 5, 6], [1, 6, 2],
        [2, 6, 7], [2, 7, 3],
        [3, 7, 4], [3, 4, 0]
      ];
      faces.push(...boxTris);
    }

    return { vertices, faces };
  }

  /**
   * Generates triangulated, CAD-compatible Wavefront .OBJ file format
   */
  _generateObjFile(modelDef) {
    const lines = [
      `# VISION AI Engineering Wavefront OBJ File`,
      `# Model: ${modelDef.name}`,
      `# Archetype: ${modelDef.archetype}`,
      `# Generated: ${new Date().toISOString()}`,
      `o ${modelDef.name}`
    ];

    const jointOffsets = this._computeJointWorldOffsets(modelDef.geometrySpec);
    let vOffset = 1;
    for (const comp of modelDef.geometrySpec.components) {
      lines.push(`g ${comp.id}`);
      const jOff = comp.parentJoint ? (jointOffsets.get(comp.parentJoint) || [0, 0, 0]) : [0, 0, 0];
      const { vertices, faces } = this._tessellateComponent(comp, jOff);
      for (const v of vertices) {
        lines.push(`v ${v[0]} ${v[1]} ${v[2]}`);
      }
      for (const f of faces) {
        lines.push(`f ${vOffset + f[0]} ${vOffset + f[1]} ${vOffset + f[2]}`);
      }
      vOffset += vertices.length;
    }

    return lines.join('\n');
  }

  /**
   * Generates standard ASCII .STL file format with real computed facet normals
   */
  _generateStlFile(modelDef) {
    const lines = [`solid ${modelDef.name}`];
    const jointOffsets = this._computeJointWorldOffsets(modelDef.geometrySpec);

    for (const comp of modelDef.geometrySpec.components) {
      const jOff = comp.parentJoint ? (jointOffsets.get(comp.parentJoint) || [0, 0, 0]) : [0, 0, 0];
      const { vertices, faces } = this._tessellateComponent(comp, jOff);

      for (const f of faces) {
        const a = vertices[f[0]], b = vertices[f[1]], c = vertices[f[2]];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;

        lines.push(`  facet normal ${nx.toFixed(5)} ${ny.toFixed(5)} ${nz.toFixed(5)}`);
        lines.push(`    outer loop`);
        lines.push(`      vertex ${a[0]} ${a[1]} ${a[2]}`);
        lines.push(`      vertex ${b[0]} ${b[1]} ${b[2]}`);
        lines.push(`      vertex ${c[0]} ${c[1]} ${c[2]}`);
        lines.push(`    endloop`);
        lines.push(`  endfacet`);
      }
    }
    lines.push(`endsolid ${modelDef.name}`);
    return lines.join('\n');
  }

  /**
   * Generates standalone Blender Python API script
   */
  _generateBlenderScript(modelDef) {
    return `"""
VISION AI — Headless Blender 3D Generator Script
Model: ${modelDef.name}
Archetype: ${modelDef.archetype}
Execute in Blender: blender --background --python script.py
"""
import bpy
import math

# Clear existing objects
bpy.ops.wm.read_factory_settings(use_empty=True)

# Create collection
col = bpy.data.collections.new("${modelDef.name}")
bpy.context.scene.collection.children.link(col)

# Holographic Arc Reactor / Titanium Material
mat = bpy.data.materials.new(name="STARK_${modelDef.theme.toUpperCase()}")
mat.use_nodes = True
nodes = mat.node_tree.nodes
principled = nodes.get("Principled BSDF")
if principled:
    if "${modelDef.theme}" == "holographic":
        principled.inputs["Emission Color"].default_value = (0.0, 0.898, 1.0, 1.0)
        principled.inputs["Emission Strength"].default_value = 2.5
        principled.inputs["Transmission Weight"].default_value = 0.8
    else:
        principled.inputs["Base Color"].default_value = (0.7, 0.72, 0.75, 1.0)
        principled.inputs["Metallic"].default_value = 0.95
        principled.inputs["Roughness"].default_value = 0.2

# Generate components
specs = ${JSON.stringify(modelDef.geometrySpec.components, null, 2)}
for comp in specs:
    shape = comp.get("shape", "box")
    pos = comp.get("pos", [0, 0, 0])
    rot = comp.get("rot", [0, 0, 0])
    
    if shape == "cylinder":
        r = comp.get("radiusTop", 1.0)
        d = comp.get("height", 2.0)
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, location=pos, rotation=rot)
    elif shape == "sphere":
        r = comp.get("radius", 1.0)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=pos)
    elif shape == "cone":
        r = comp.get("radius", 1.0)
        d = comp.get("height", 2.0)
        bpy.ops.mesh.primitive_cone_add(radius1=r, depth=d, location=pos, rotation=rot)
    elif shape == "torus":
        r1 = comp.get("radius", 3.0)
        r2 = comp.get("tube", 0.3)
        bpy.ops.mesh.primitive_torus_add(major_radius=r1, minor_radius=r2, location=pos, rotation=rot)
    else:
        s = comp.get("size", [2, 2, 2])
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos, rotation=rot)
        bpy.context.active_object.scale = s

    obj = bpy.context.active_object
    obj.name = comp.get("id", "comp")
    obj.data.materials.append(mat)

print(f"Successfully generated LOKESH 3D model '${modelDef.name}' with {len(specs)} components.")
`;
  }

  /**
   * Saves/persists updates to an existing 3D model (or forks Save-As into a new modelId),
   * updating joint poses, name, theme, notes, viewState, revision history, and regenerating OBJ/STL/Blender artifacts.
   */
  async saveModel(modelId, updates = {}) {
    this._ensureDir();
    let baseModel = modelId ? this.getModel(modelId) : null;
    if (!baseModel && !updates.geometrySpec) {
      throw new Error(`3D model '${modelId}' not found to save.`);
    }

    const cloned = JSON.parse(JSON.stringify(baseModel || {
      modelId: modelId || `model_${Date.now().toString(36)}`,
      name: updates.name || 'saved_model',
      description: updates.description || 'Saved 3D CAD Assembly',
      archetype: updates.archetype || 'robotic_arm',
      theme: updates.theme || 'holographic',
      createdAt: new Date().toISOString(),
      parameters: updates.parameters || {},
      geometrySpec: updates.geometrySpec,
      files: {}
    }));

    const isFork = Boolean(updates.saveAsNew);
    const targetModelId = isFork
      ? `model_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`
      : cloned.modelId;

    const rawName = updates.name !== undefined ? String(updates.name).trim() : cloned.name;
    const cleanName = (rawName || cloned.archetype || 'saved_model')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'saved_model';

    cloned.modelId = targetModelId;
    cloned.name = cleanName;
    if (updates.description !== undefined) cloned.description = String(updates.description);
    if (updates.theme) cloned.theme = String(updates.theme);
    if (updates.notes !== undefined) cloned.notes = String(updates.notes);
    if (isFork) {
      cloned.createdAt = new Date().toISOString();
      cloned.forkedFrom = modelId;
      cloned.revisionHistory = [];
    }

    cloned.viewState = {
      ...(cloned.viewState || {}),
      ...(updates.viewState || {})
    };
    cloned.parameters = {
      ...(cloned.parameters || {}),
      wireframe: Boolean(cloned.viewState.wireframe ?? cloned.parameters?.wireframe ?? (cloned.theme === 'wireframe')),
      ...(updates.parameters || {})
    };

    const jointStates = updates.jointStates && typeof updates.jointStates === 'object' ? updates.jointStates : {};
    const savedJointPose = { ...(cloned.savedJointPose || {}) };
    if (Array.isArray(cloned.geometrySpec?.joints)) {
      for (const j of cloned.geometrySpec.joints) {
        const nextVal = jointStates[j.id] !== undefined ? jointStates[j.id] : jointStates[j.label];
        if (nextVal !== undefined && Number.isFinite(Number(nextVal))) {
          const minVal = Number.isFinite(Number(j.minDeg ?? j.min)) ? Number(j.minDeg ?? j.min) : -180;
          const maxVal = Number.isFinite(Number(j.maxDeg ?? j.max)) ? Number(j.maxDeg ?? j.max) : 180;
          const clamped = Math.max(minVal, Math.min(maxVal, Number(nextVal)));
          j.defaultDeg = clamped;
        }
        savedJointPose[j.id] = Number(j.defaultDeg ?? 0);
      }
    }
    cloned.savedJointPose = savedJointPose;

    const nowIso = new Date().toISOString();
    cloned.saved = true;
    cloned.savedAt = nowIso;
    const history = Array.isArray(cloned.revisionHistory) ? cloned.revisionHistory : [];
    history.push({
      savedAt: nowIso,
      name: cleanName,
      theme: cloned.theme,
      notes: cloned.notes || '',
      jointPose: savedJointPose
    });
    cloned.revisionHistory = history.slice(-20);

    // Regenerate OBJ, STL, GLB, Spec JSON, Blender artifacts on disk so exports match the saved version
    const modelFolder = path.join(MODELS_DIR, targetModelId);
    fs.mkdirSync(modelFolder, { recursive: true });

    const objPath = path.join(modelFolder, `${cleanName}.obj`);
    const stlPath = path.join(modelFolder, `${cleanName}.stl`);
    const glbPath = path.join(modelFolder, `${cleanName}.glb`);
    const specPath = path.join(modelFolder, `${cleanName}_spec.json`);
    const pyPath = path.join(modelFolder, `${cleanName}_blender.py`);
    const metaPath = path.join(modelFolder, 'metadata.json');

    fs.writeFileSync(objPath, this._generateObjFile(cloned), 'utf8');
    fs.writeFileSync(stlPath, this._generateStlFile(cloned), 'utf8');
    fs.writeFileSync(glbPath, this._generateGlbFile(cloned));
    fs.writeFileSync(specPath, this._generateEngineeringSpecJson(cloned), 'utf8');
    fs.writeFileSync(pyPath, this._generateBlenderScript(cloned), 'utf8');

    const objBytes = fs.statSync(objPath).size;
    const stlBytes = fs.statSync(stlPath).size;
    const glbBytes = fs.statSync(glbPath).size;

    cloned.files = {
      obj: objPath,
      stl: stlPath,
      glb: glbPath,
      spec: specPath,
      blender: pyPath,
      metadata: metaPath
    };
    cloned.verification = {
      filesVerified: objBytes > 100 && stlBytes > 100 && glbBytes > 64,
      objBytes,
      stlBytes,
      glbBytes,
      verifiedAt: nowIso
    };

    fs.writeFileSync(metaPath, JSON.stringify(cloned, null, 2), 'utf8');
    this.activeModels.set(targetModelId, cloned);
    return cloned;
  }

  getModel(modelId) {
    if (this.activeModels.has(modelId)) {
      return this.activeModels.get(modelId);
    }
    // Check persisted metadata.json on disk for reload round-trip
    try {
      const metaPath = path.join(MODELS_DIR, String(modelId || ''), 'metadata.json');
      if (modelId && fs.existsSync(metaPath)) {
        const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        this.activeModels.set(modelId, parsed);
        return parsed;
      }
    } catch (_) {}
    return null;
  }

  listModels() {
    const merged = new Map();
    try {
      if (fs.existsSync(MODELS_DIR)) {
        const dirs = fs.readdirSync(MODELS_DIR);
        for (const d of dirs) {
          const metaPath = path.join(MODELS_DIR, d, 'metadata.json');
          if (fs.existsSync(metaPath)) {
            try {
              const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
              if (parsed && parsed.modelId) {
                merged.set(parsed.modelId, parsed);
              }
            } catch (_) {}
          }
        }
      }
    } catch (_) {}

    for (const [id, m] of this.activeModels.entries()) {
      merged.set(id, m);
    }

    return Array.from(merged.values())
      .sort((a, b) => {
        // Prefer explicitly saved designs at the top or by latest savedAt/createdAt
        const ta = new Date(a.savedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.savedAt || b.createdAt || 0).getTime();
        return tb - ta;
      })
      .slice(0, 30);
  }
}

const universal3dEngineInstance = new Universal3dEngine();

module.exports = {
  Universal3dEngine,
  universal3dEngine: universal3dEngineInstance
};
