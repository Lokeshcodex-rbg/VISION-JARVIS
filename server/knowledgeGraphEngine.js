/**
 * VISION AI — Persistent World Model & Engineering Knowledge Graph
 * 
 * Connects Concepts, Projects, Software Modules, Hardware Components,
 * Research Sources, Engineering Constraints, Experiments, Decisions,
 * Failures, and Verified Results.
 * 
 * Supports causal relationship queries, physical consequence modeling
 * (e.g., motor torque, gear ratio, battery voltage, material changes),
 * memory inspection, correction, export, and deletion.
 * Enforces strict credentials blocking.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data/knowledge_graph');
const GRAPH_FILE = path.join(DATA_DIR, 'graph.json');

const SENSITIVE_PATTERN = /\b(password|passwd|api[_-]?key|secret|auth[_-]?token|bearer|private[_-]?key|credential|pin[_-]?code|cvv|ssn)\b/i;

const NODE_TYPES = [
  'entity',
  'concept',
  'project',
  'claim',
  'source',
  'contradiction',
  'software_module',
  'hardware_component',
  'research_source',
  'engineering_constraint',
  'experiment',
  'decision',
  'failure',
  'verified_result',
  'file',
  'code_symbol',
  'test_case',
  'defect',
  'repair',
  'user_preference'
];

const EDGE_TYPES = [
  'SUPPORTS',
  'CONTRADICTS',
  'CITES',
  'PART_OF',
  'MEASURES',
  'DEPENDS_ON',
  'CONSTRAINED_BY',
  'AFFECTS',
  'MITIGATES',
  'DERIVED_FROM',
  'IMPLEMENTS',
  'CAUSES',
  'CONNECTED_TO',
  'INDEXES',
  'TESTS',
  'REPAIRS',
  'VALIDATES'
];


class KnowledgeGraphEngine {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(GRAPH_FILE)) {
        const raw = fs.readFileSync(GRAPH_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data.nodes && Array.isArray(data.nodes)) {
          data.nodes.forEach(n => this.nodes.set(n.id, n));
        }
        if (data.edges && Array.isArray(data.edges)) {
          this.edges = data.edges;
        }
      } else {
        this.seedDefaultKnowledgeGraph();
        this.save();
      }
    } catch (err) {
      console.warn('[KNOWLEDGE_GRAPH] Error initializing graph:', err.message);
      this.seedDefaultKnowledgeGraph();
    }
  }

  save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const serialized = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        nodeCount: this.nodes.size,
        edgeCount: this.edges.length,
        nodes: Array.from(this.nodes.values()),
        edges: this.edges
      };
      fs.writeFileSync(GRAPH_FILE, JSON.stringify(serialized, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.warn('[KNOWLEDGE_GRAPH] Error saving graph:', err.message);
      return false;
    }
  }

  seedDefaultKnowledgeGraph() {
    this.nodes.clear();
    this.edges = [];

    // 1. Projects
    this.addNode('project', 'proj_robotic_arm_5dof', '5-DOF Articulated Robotic Arm', {
      payloadKg: 1.5,
      reachMm: 450,
      baseMaterial: 'aluminum_6061_t6'
    }, 'VISION Engineering Lab');

    this.addNode('project', 'proj_exoskeleton_lower_limb', 'Modular Lower-Limb Exoskeleton', {
      assistTorqueNm: 45,
      powerSource: 'li_ion_48v',
      frameMaterial: 'titanium_ti6al4v'
    }, 'VISION Biomechatronics');

    // 2. Hardware Components
    this.addNode('hardware_component', 'comp_motor_bldc_actuator', 'Quasi-Direct Drive BLDC Motor (AK80-9)', {
      ratedTorqueNm: 9.0,
      peakTorqueNm: 24.0,
      ratedVoltageV: 48.0,
      gearRatio: 9.0,
      massKg: 0.485
    }, 'Actuator Sourcing DB');

    this.addNode('hardware_component', 'comp_battery_pack_48v', '48V 10Ah LiFePO4 Battery Pack', {
      voltageNominalV: 48.0,
      capacityAh: 10.0,
      energyWh: 480.0,
      continuousDischargeC: 3.0,
      maxCurrentA: 30.0,
      massKg: 4.2
    }, 'Power Systems DB');

    this.addNode('hardware_component', 'comp_mcu_teensy41', 'Teensy 4.1 Real-Time Motion Controller', {
      clockMhz: 600,
      canBuses: 3,
      voltageV: 3.3
    }, 'Embedded Systems DB');

    // 3. Materials
    this.addNode('concept', 'mat_al6061_t6', 'Aluminum 6061-T6 Alloy', {
      yieldStrengthMpa: 276,
      densityKgM3: 2700,
      youngsModulusGpa: 68.9
    }, 'ASM Material Handbook');

    this.addNode('concept', 'mat_ti6al4v', 'Titanium Grade 5 (Ti-6Al-4V)', {
      yieldStrengthMpa: 880,
      densityKgM3: 4430,
      youngsModulusGpa: 113.8
    }, 'Aerospace Material Specification');

    // 4. Engineering Constraints
    this.addNode('engineering_constraint', 'const_max_current_draw', 'Maximum Current Limit 30A', {
      limitValue: 30.0,
      unit: 'A',
      safetyMargin: 0.20
    }, 'Battery BMS Safety Constraint');

    this.addNode('engineering_constraint', 'const_thermal_dissipation', 'Actuator Thermal Limit 85C', {
      maxTempC: 85.0
    }, 'Thermal Management Specs');

    // 5. Software Modules
    this.addNode('software_module', 'mod_pid_firmware', 'High-Frequency CAN/FOC Joint Controller', {
      loopRateHz: 1000,
      eStopTriggerTimeMs: 1
    }, 'Firmware Repository');

    // Connect with Edges
    this.addEdge('proj_robotic_arm_5dof', 'comp_motor_bldc_actuator', 'DEPENDS_ON', 1.0, { role: 'joint_actuators' });
    this.addEdge('proj_robotic_arm_5dof', 'mat_al6061_t6', 'DEPENDS_ON', 0.8, { role: 'chassis_material' });
    this.addEdge('comp_motor_bldc_actuator', 'comp_battery_pack_48v', 'CONNECTED_TO', 1.0, { bus: '48V DC' });
    this.addEdge('comp_motor_bldc_actuator', 'const_max_current_draw', 'CONSTRAINED_BY', 1.0);
    this.addEdge('comp_motor_bldc_actuator', 'const_thermal_dissipation', 'CONSTRAINED_BY', 0.9);
    this.addEdge('mod_pid_firmware', 'comp_mcu_teensy41', 'IMPLEMENTS', 1.0);
    this.addEdge('mod_pid_firmware', 'comp_motor_bldc_actuator', 'AFFECTS', 1.0, { function: 'FOC velocity/position control' });
  }

  addNode(type, id, label, properties = {}, provenance = 'user_conversation') {
    if (!id || typeof id !== 'string') throw new Error('Node ID must be a non-empty string');
    if (!label || typeof label !== 'string') throw new Error('Node label must be a non-empty string');

    // Security check for sensitive data
    const serialized = JSON.stringify({ id, label, properties, provenance });
    if (SENSITIVE_PATTERN.test(serialized)) {
      return {
        success: false,
        reason: 'SECURITY_BLOCKED',
        message: 'Credentials, API keys, or passwords cannot be stored in the knowledge graph.'
      };
    }

    const validCategory = NODE_TYPES.includes(type) ? type : 'concept';
    const now = new Date().toISOString();

    const node = {
      id,
      type: validCategory,
      label,
      properties: properties || {},
      provenance,
      createdAt: now,
      updatedAt: now
    };

    this.nodes.set(id, node);
    this.save();

    try {
      const { starkMemoryDbInstance } = require('./memory/starkMemoryDb.js');
      if (starkMemoryDbInstance && typeof starkMemoryDbInstance.saveKgNode === 'function') {
        starkMemoryDbInstance.saveKgNode({
          id,
          type: validCategory,
          label,
          properties: properties || {},
          provenance,
          confidence: properties.confidence !== undefined ? properties.confidence : 1.0,
          epistemicType: properties.epistemicType || 'CLAIM',
          projectId: properties.projectId || null
        });
      }
    } catch (_) {}

    return { success: true, node };
  }

  addEdge(fromId, toId, relationship, weight = 1.0, metadata = {}) {
    if (!this.nodes.has(fromId)) throw new Error(`Source node "${fromId}" does not exist in graph`);
    if (!this.nodes.has(toId)) throw new Error(`Target node "${toId}" does not exist in graph`);

    const rel = EDGE_TYPES.includes(relationship) ? relationship : 'AFFECTS';
    
    // Check if edge already exists
    const existingIndex = this.edges.findIndex(e => e.from === fromId && e.to === toId && e.relationship === rel);
    const edge = {
      id: `edge_${fromId}_${rel}_${toId}`,
      from: fromId,
      to: toId,
      relationship: rel,
      weight: Number(weight) || 1.0,
      metadata: metadata || {},
      timestamp: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      this.edges[existingIndex] = edge;
    } else {
      this.edges.push(edge);
    }

    this.save();

    try {
      const { starkMemoryDbInstance } = require('./memory/starkMemoryDb.js');
      if (starkMemoryDbInstance && typeof starkMemoryDbInstance.saveKgEdge === 'function') {
        starkMemoryDbInstance.saveKgEdge({
          id: edge.id,
          fromId,
          toId,
          relationship: rel,
          weight: edge.weight,
          metadata: metadata || {},
          source: metadata?.source || null
        });
      }
    } catch (_) {}

    return { success: true, edge };
  }

  getNode(id) {
    return this.nodes.get(id) || null;
  }

  deleteNode(id) {
    if (!this.nodes.has(id)) return { success: false, reason: 'NOT_FOUND' };
    this.nodes.delete(id);
    this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
    this.save();
    return { success: true, deletedId: id };
  }

  correctNode(id, updates = {}) {
    const node = this.nodes.get(id);
    if (!node) return { success: false, reason: 'NOT_FOUND' };

    // Security check
    if (SENSITIVE_PATTERN.test(JSON.stringify(updates))) {
      return { success: false, reason: 'SECURITY_BLOCKED', message: 'Credentials or secrets cannot be stored' };
    }

    if (updates.label) node.label = updates.label;
    if (updates.properties) node.properties = { ...node.properties, ...updates.properties };
    if (updates.provenance) node.provenance = updates.provenance;
    node.updatedAt = new Date().toISOString();

    this.nodes.set(id, node);
    this.save();

    try {
      const { starkMemoryDbInstance } = require('./memory/starkMemoryDb.js');
      if (starkMemoryDbInstance && typeof starkMemoryDbInstance.saveKgNode === 'function') {
        starkMemoryDbInstance.saveKgNode({
          id,
          type: validCategory,
          label,
          properties: properties || {},
          provenance,
          confidence: properties.confidence !== undefined ? properties.confidence : 1.0,
          epistemicType: properties.epistemicType || 'CLAIM',
          projectId: properties.projectId || null
        });
      }
    } catch (_) {}

    return { success: true, node };
  }

  searchNodes(query = '', typeFilter = null) {
    const q = query.toLowerCase().trim();
    const results = [];

    for (const node of this.nodes.values()) {
      if (typeFilter && node.type !== typeFilter) continue;
      if (!q) {
        results.push(node);
        continue;
      }

      const matchLabel = node.label.toLowerCase().includes(q);
      const matchId = node.id.toLowerCase().includes(q);
      const matchProps = JSON.stringify(node.properties).toLowerCase().includes(q);

      if (matchLabel || matchId || matchProps) {
        results.push(node);
      }
    }
    return results;
  }

  getNeighbors(nodeId, direction = 'both') {
    if (!this.nodes.has(nodeId)) return [];

    const neighbors = [];
    for (const edge of this.edges) {
      if ((direction === 'out' || direction === 'both') && edge.from === nodeId) {
        const target = this.nodes.get(edge.to);
        if (target) neighbors.push({ relationship: edge.relationship, direction: 'out', edge, targetNode: target });
      }
      if ((direction === 'in' || direction === 'both') && edge.to === nodeId) {
        const source = this.nodes.get(edge.from);
        if (source) neighbors.push({ relationship: edge.relationship, direction: 'in', edge, sourceNode: source });
      }
    }
    return neighbors;
  }

  /**
   * Causal Physical & Engineering Consequence Analysis
   * Answers questions such as what happens if motor torque, gear ratio, battery voltage, mass, or material changes.
   */
  analyzeConsequence(targetEntity, parameterChange, options = {}) {
    const targetQuery = (targetEntity || '').toLowerCase();
    const param = (parameterChange.parameter || '').toLowerCase();
    const changeDirection = parameterChange.direction || (parameterChange.delta > 0 ? 'increase' : 'decrease');
    const factor = Number(parameterChange.factor) || 1.25; // default 25% change

    // Search for entity in graph
    const matchingNodes = this.searchNodes(targetQuery);
    const primaryNode = matchingNodes.length > 0 ? matchingNodes[0] : null;

    const analysis = {
      target: targetEntity,
      parameter: param,
      change: changeDirection,
      factor,
      nodeFound: primaryNode ? { id: primaryNode.id, label: primaryNode.label, type: primaryNode.type } : null,
      directEffects: [],
      cascadingConsequences: [],
      constraintViolations: [],
      recommendations: []
    };

    // 1. Motor Torque change
    if (param.includes('torque') || param.includes('motor')) {
      if (changeDirection === 'increase') {
        analysis.directEffects.push({
          parameter: 'Joint Payload & Acceleration',
          effect: `Increases maximum payload capacity by ~${Math.round((factor - 1) * 100)}% and improves dynamic acceleration response.`
        });
        analysis.directEffects.push({
          parameter: 'Peak Current Draw (I_peak)',
          effect: `Current draw increases proportionally (I = tau / k_t). Estimated current rise factor: ${factor.toFixed(2)}x.`
        });
        analysis.cascadingConsequences.push({
          component: 'Gearbox / Reducer',
          impact: 'Higher tooth contact stress and root bending stress. May shorten fatigue life or require alloy steel gears.'
        });
        analysis.cascadingConsequences.push({
          component: 'Thermal Dissipation',
          impact: 'Joule heating increases with current squared (P_loss = I^2 * R). Requires enhanced heatsinking or active forced cooling.'
        });
        analysis.cascadingConsequences.push({
          component: 'Structural Arm Links',
          impact: 'Reaction moments at joint mounts increase. Arm links must withstand higher bending stress.'
        });
        analysis.constraintViolations.push({
          constraintId: 'const_max_current_draw',
          threshold: '30A',
          risk: 'High risk of tripping BMS current limit or sagging battery voltage under stall conditions.'
        });
        analysis.recommendations.push('Verify battery discharge C-rate rating and increase motor driver MOSFET cooling.');
        analysis.recommendations.push('Run FEA on gear teeth and joint mounting flanges.');
      } else {
        analysis.directEffects.push({
          parameter: 'Joint Payload Capacity',
          effect: `Reduces payload capacity by ~${Math.round((1 - 1 / factor) * 100)}%.`
        });
        analysis.directEffects.push({
          parameter: 'Energy Consumption',
          effect: 'Reduces peak electrical power and thermal losses.'
        });
        analysis.recommendations.push('Check if joint can still hold holding-torque at maximum cantilever extension.');
      }
    }

    // 2. Gear Ratio change
    else if (param.includes('gear') || param.includes('ratio')) {
      if (changeDirection === 'increase') {
        analysis.directEffects.push({
          parameter: 'Output Joint Torque',
          effect: `Increases output torque by gear ratio factor N (${factor}x).`
        });
        analysis.directEffects.push({
          parameter: 'Maximum Joint Angular Velocity',
          effect: `Decreases maximum output rotational speed by 1/N (${(1/factor).toFixed(2)}x).`
        });
        analysis.cascadingConsequences.push({
          component: 'Reflected Inertia',
          impact: `Reflected rotor inertia to the load decreases by 1/N^2 (${(1/(factor*factor)).toFixed(3)}x), improving control bandwidth against load disturbances.`
        });
        analysis.cascadingConsequences.push({
          component: 'Backdrivability',
          impact: 'Higher gear ratio severely reduces backdrivability and increases mechanical impedance during collisions.'
        });
        analysis.recommendations.push('Ensure compliant force/torque sensing is implemented if backdrivability is required for safe human-robot interaction.');
      } else {
        analysis.directEffects.push({
          parameter: 'Output Speed & Backdrivability',
          effect: `Increases maximum velocity and enhances backdrivability for quasi-direct drive (QDD) compliance.`
        });
        analysis.directEffects.push({
          parameter: 'Output Torque',
          effect: `Reduces output torque by ${(1/factor).toFixed(2)}x, requiring a larger motor diameter to maintain payload.`
        });
      }
    }

    // 3. Battery Voltage change
    else if (param.includes('voltage') || param.includes('battery')) {
      if (changeDirection === 'decrease') {
        analysis.directEffects.push({
          parameter: 'Motor Top Speed (RPM)',
          effect: `No-load motor speed drops proportionally (RPM ~ K_v * V). Maximum joint angular speed drops.`
        });
        analysis.directEffects.push({
          parameter: 'Required Current for Equal Mechanical Power',
          effect: `For equivalent mechanical power (P = V * I), current must increase by ${factor.toFixed(2)}x.`
        });
        analysis.cascadingConsequences.push({
          component: 'Wiring Harness & Inverter Losses',
          impact: `Conduction losses (I^2 * R) escalate by ${(factor * factor).toFixed(2)}x, necessitating thicker gauge wire (AWG 12 -> AWG 10).`
        });
        analysis.recommendations.push('Maintain nominal 48V or 60V architecture to minimize copper weight and thermal dissipation in mobile actuators.');
      } else {
        analysis.directEffects.push({
          parameter: 'Motor Top Speed & Power Density',
          effect: 'Higher bus voltage enables higher motor RPM without increasing motor phase currents.'
        });
        analysis.recommendations.push('Verify capacitor voltage ratings on inverter and motor controllers (must exceed 1.25x bus voltage).');
      }
    }

    // 4. Material Change
    else if (param.includes('material') || param.includes('titanium') || param.includes('aluminum') || param.includes('carbon')) {
      const isTitanium = targetQuery.includes('titanium') || param.includes('titanium');
      const isCarbon = targetQuery.includes('carbon') || param.includes('carbon');

      if (isTitanium) {
        analysis.directEffects.push({
          parameter: 'Yield Strength',
          effect: 'Yield strength surges from 276 MPa (Al 6061) to 880 MPa (Ti-6Al-4V) — a 3.18x increase in stress tolerance.'
        });
        analysis.directEffects.push({
          parameter: 'Component Mass & Density',
          effect: 'Density increases from 2.70 g/cm³ to 4.43 g/cm³ (+64% mass for identical volume).'
        });
        analysis.cascadingConsequences.push({
          component: 'Structural Deflection',
          impact: 'Young’s modulus increases from 68.9 GPa to 113.8 GPa (+65%), significantly stiffening links against bending.'
        });
        analysis.cascadingConsequences.push({
          component: 'Fabrication & Sourcing Cost',
          impact: 'Material cost is ~6-10x higher; machining requires specialized carbide tooling and flood cooling.'
        });
        analysis.recommendations.push('Use topology optimization to hollow out low-stress areas to leverage Titanium’s strength without incurring a mass penalty.');
      } else if (isCarbon) {
        analysis.directEffects.push({
          parameter: 'Specific Stiffness (E / rho)',
          effect: 'Extremely high stiffness-to-weight ratio; density ~1.55 g/cm³ with modulus up to 135 GPa.'
        });
        analysis.cascadingConsequences.push({
          component: 'Impact & Delamination',
          impact: 'Susceptible to brittle failure and hidden subsurface delamination under sharp point impacts.'
        });
        analysis.recommendations.push('Incorporate metallic insert bushings for all bolted joint bearings and pivot fasteners.');
      } else {
        analysis.directEffects.push({
          parameter: 'General Material Modification',
          effect: 'Modifies mass, stiffness, and fatigue limit across all downstream structural links.'
        });
      }
    } else {
      analysis.directEffects.push({
        parameter: parameterChange.parameter,
        effect: `Altering ${parameterChange.parameter} will propagate through connected graph dependencies.`
      });
      // Traverse graph neighbors
      if (primaryNode) {
        const neighbors = this.getNeighbors(primaryNode.id);
        neighbors.forEach(n => {
          analysis.cascadingConsequences.push({
            component: n.targetNode ? n.targetNode.label : (n.sourceNode ? n.sourceNode.label : 'Connected Node'),
            impact: `Directly affected via ${n.relationship} edge.`
          });
        });
      }
    }

    return analysis;
  }

  addDecision(projectId, decisionSummary, rationale, alternatives = []) {
    const id = `decision_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const res = this.addNode('decision', id, decisionSummary, {
      rationale,
      alternatives,
      status: 'ADOPTED'
    }, 'Project Architecture Review');

    if (res.success && this.nodes.has(projectId)) {
      this.addEdge(projectId, id, 'DERIVED_FROM', 1.0);
    }
    return res;
  }

  addFailure(componentOrTaskId, rootCause, mitigation) {
    const id = `failure_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const res = this.addNode('failure', id, `Incident: ${rootCause.slice(0, 60)}`, {
      rootCause,
      mitigation,
      status: 'RESOLVED'
    }, 'Incident Analysis');

    if (res.success && this.nodes.has(componentOrTaskId)) {
      this.addEdge(id, componentOrTaskId, 'CAUSES', 1.0);
    }
    return res;
  }

  inspectMemory() {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      nodeBreakdown: NODE_TYPES.reduce((acc, type) => {
        acc[type] = Array.from(this.nodes.values()).filter(n => n.type === type).length;
        return acc;
      }, {}),
      recentDecisions: Array.from(this.nodes.values()).filter(n => n.type === 'decision').slice(-5),
      recentFailures: Array.from(this.nodes.values()).filter(n => n.type === 'failure').slice(-5)
    };
  }

  exportGraph() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }

  /**
   * Section 15: Indexes a code artifact and its key symbols, dependencies, and SHA-256 hash
   */
  indexCodeArtifact(filePath, content = '', metadata = {}) {
    const crypto = require('crypto');
    const relPath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
    const fileId = `file_${crypto.createHash('md5').update(relPath).digest('hex').slice(0, 10)}`;
    const sha256 = crypto.createHash('sha256').update(content || '').digest('hex');

    // Index file node
    this.addNode('file', fileId, relPath, {
      absolutePath: filePath,
      sha256,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      version: metadata.version || '1.0.0',
      confidence: 1.0,
      indexedAt: new Date().toISOString()
    }, 'Project File Indexer');

    // Simple symbol extraction (classes and exported functions)
    const symbols = [];
    const classMatches = content.matchAll(/class\s+([A-Za-z0-9_]+)/g);
    for (const m of classMatches) {
      symbols.push({ name: m[1], type: 'class' });
    }
    const funcMatches = content.matchAll(/(?:function\s+([A-Za-z0-9_]+)|([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{)/g);
    for (const m of funcMatches) {
      const name = m[1] || m[2];
      if (name && !['if', 'for', 'while', 'switch', 'catch', 'function', 'constructor'].includes(name)) {
        if (!symbols.some(s => s.name === name)) {
          symbols.push({ name, type: 'method' });
        }
      }
    }

    symbols.forEach(sym => {
      const symId = `sym_${fileId}_${sym.name}`;
      this.addNode('code_symbol', symId, sym.name, {
        symbolType: sym.type,
        parentFile: relPath,
        confidence: 0.95
      }, 'AST Parser');
      this.addEdge(fileId, symId, 'INDEXES', 1.0);
    });

    return { fileId, symbolsCount: symbols.length, sha256 };
  }

  /**
   * Section 15: Indexes a defect, repair patch, and the verifying test case
   */
  indexDefectAndRepair(defectData = {}, repairData = {}, testData = {}) {
    const crypto = require('crypto');
    const defectId = `defect_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const repairId = `repair_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;

    this.addNode('defect', defectId, defectData.title || 'Reported Defect', {
      rootCause: defectData.rootCause || 'Unknown',
      severity: defectData.severity || 'MEDIUM',
      status: 'RESOLVED',
      timestamp: new Date().toISOString()
    }, 'Defect Tracker');

    this.addNode('repair', repairId, repairData.title || 'Applied Code Patch', {
      patchDiffSummary: repairData.summary || 'Targeted fix applied',
      verifiedOnDisk: true,
      timestamp: new Date().toISOString()
    }, 'Self-Coding Repair Engine');

    this.addEdge(repairId, defectId, 'REPAIRS', 1.0);

    if (testData.testSuiteId) {
      const testId = `test_${crypto.createHash('md5').update(testData.testSuiteId).digest('hex').slice(0, 8)}`;
      this.addNode('test_case', testId, testData.testSuiteId, {
        passRatePercent: testData.passRate || 100,
        status: 'PASS'
      }, 'Regression Test Suite');
      this.addEdge(testId, repairId, 'VALIDATES', 1.0);
    }

    return { defectId, repairId };
  }

  /**
   * Section 16: Evaluates memory quality: relevance, factual consistency, recency, privacy, and latency
   */
  evaluateMemoryQuality(query = '') {
    const t0 = Date.now();
    const queryLower = String(query || '').toLowerCase();
    const nodes = Array.from(this.nodes.values());

    // 1. Relevance scoring
    const relevantNodes = nodes.filter(n => 
      n.label.toLowerCase().includes(queryLower) || 
      JSON.stringify(n.properties).toLowerCase().includes(queryLower)
    );

    // 2. Factual consistency & contradiction detection
    let contradictionCount = 0;
    const contradictions = [];
    const decisions = nodes.filter(n => n.type === 'decision');
    // Check if conflicting decisions exist for same subject
    for (let i = 0; i < decisions.length; i++) {
      for (let j = i + 1; j < decisions.length; j++) {
        if (decisions[i].label === decisions[j].label && decisions[i].properties.status !== decisions[j].properties.status) {
          contradictionCount++;
          contradictions.push(`Conflicting status between ${decisions[i].id} and ${decisions[j].id}`);
        }
      }
    }

    // 3. Recency calculation
    const now = Date.now();
    const ageDays = nodes.map(n => (now - new Date(n.updatedAt || n.createdAt).getTime()) / (1000 * 3600 * 24));
    const meanAgeDays = ageDays.length > 0 ? (ageDays.reduce((a, b) => a + b, 0) / ageDays.length) : 0;

    // 4. Privacy audit (verify 0 credentials or sensitive secrets in memory)
    const leakedNodes = nodes.filter(n => SENSITIVE_PATTERN.test(JSON.stringify(n)));

    const latencyMs = Date.now() - t0;

    return {
      query,
      retrievalLatencyMs: latencyMs,
      totalNodesAudited: nodes.length,
      relevantMatches: relevantNodes.length,
      relevanceScore: nodes.length > 0 ? parseFloat((relevantNodes.length / nodes.length).toFixed(3)) : 0,
      factualConsistencyScore: parseFloat((1.0 - (contradictionCount / Math.max(1, decisions.length))).toFixed(3)),
      contradictionsFound: contradictions,
      meanMemoryAgeDays: parseFloat(meanAgeDays.toFixed(1)),
      privacyCompliance: {
        secretsLeakedCount: leakedNodes.length,
        status: leakedNodes.length === 0 ? 'COMPLIANT_ZERO_LEAKS' : 'VIOLATION_SECRETS_FOUND'
      }
    };
  }

  // =========================================================================
  // PHASE 7: EVIDENCE-LINKED RESEARCH & KNOWLEDGE GRAPH CAPABILITIES
  // =========================================================================

  addClaimWithSource(claimData = {}) {
    const claimId = claimData.id || `claim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const text = claimData.claim || claimData.text || '';
    const sourceUrl = claimData.sourceUrl || claimData.url || null;
    let sourceName = claimData.sourceName || 'Primary Source';
    if (!claimData.sourceName && sourceUrl) {
      try { sourceName = new URL(sourceUrl).hostname; } catch (_) { sourceName = 'External Source'; }
    }
    const confidence = typeof claimData.confidence === 'number' ? claimData.confidence : 0.8;
    const epistemicType = claimData.epistemicType || 'CLAIM';
    const projectId = claimData.projectId || null;

    // 1. Register Source Node if present
    let sourceNodeId = null;
    if (sourceUrl || sourceName) {
      sourceNodeId = `src_${Buffer.from(sourceUrl || sourceName).toString('hex').slice(0, 16)}`;
      this.addNode('source', sourceNodeId, sourceName, {
        url: sourceUrl,
        date: claimData.date || new Date().toISOString()
      }, 'research_evaluator');
    }

    // 2. Register Claim Node
    const claimRes = this.addNode('claim', claimId, text, {
      confidence,
      epistemicType,
      projectId,
      sourceUrl,
      sourceName,
      date: claimData.date || new Date().toISOString()
    }, sourceUrl || sourceName);

    // 3. Connect Claim to Source
    if (sourceNodeId) {
      this.addEdge(claimId, sourceNodeId, 'CITES', 1.0, { sourceUrl });
    }

    // 4. Connect Claim to Target Entity if specified
    if (claimData.entityId && this.nodes.has(claimData.entityId)) {
      this.addEdge(claimId, claimData.entityId, 'SUPPORTS', confidence);
    }

    return {
      success: true,
      claimId,
      claimText: text,
      epistemicType,
      confidence,
      sourceUrl,
      sourceNodeId
    };
  }

  addContradiction(contraData = {}) {
    const contraId = contraData.id || `contra_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const concept = contraData.concept || contraData.entityOrConcept || 'General';
    const claimA = contraData.claimA || '';
    const sourceA = contraData.sourceA || '';
    const claimB = contraData.claimB || '';
    const sourceB = contraData.sourceB || '';

    this.addNode('contradiction', contraId, `Contradiction: ${concept}`, {
      concept,
      claimA,
      sourceA,
      claimB,
      sourceB,
      contradictionType: contraData.contradictionType || 'DIRECT_CONFLICT',
      resolved: false
    }, 'source_evaluator');

    try {
      const { starkMemoryDbInstance } = require('./memory/starkMemoryDb.js');
      if (starkMemoryDbInstance && typeof starkMemoryDbInstance.saveContradiction === 'function') {
        starkMemoryDbInstance.saveContradiction({
          id: contraId,
          entityOrConcept: concept,
          claimA,
          sourceA,
          claimB,
          sourceB,
          contradictionType: contraData.contradictionType || 'DIRECT_CONFLICT',
          resolved: false,
          projectId: contraData.projectId || null
        });
      }
    } catch (_) {}

    return {
      success: true,
      contradictionId: contraId,
      concept,
      claimA,
      sourceA,
      claimB,
      sourceB
    };
  }

  getClaimsForEntity(entityId) {
    const incoming = this.edges.filter(e => (e.to === entityId || e.from === entityId) && (e.relationship === 'SUPPORTS' || e.relationship === 'CONTRADICTS'));
    const claims = [];
    for (const edge of incoming) {
      const otherId = edge.from === entityId ? edge.to : edge.from;
      const node = this.nodes.get(otherId);
      if (node && node.type === 'claim') {
        claims.push({
          claimId: node.id,
          claimText: node.label,
          relationship: edge.relationship,
          confidence: node.properties?.confidence || edge.weight,
          epistemicType: node.properties?.epistemicType || 'CLAIM',
          sourceUrl: node.properties?.sourceUrl,
          provenance: node.provenance
        });
      }
    }
    return claims;
  }

  getCrossProjectKnowledge(query = '') {
    const qLower = String(query).toLowerCase().trim();
    const matchingNodes = Array.from(this.nodes.values()).filter(n => {
      const matchesText = n.label.toLowerCase().includes(qLower) || JSON.stringify(n.properties).toLowerCase().includes(qLower);
      return matchesText;
    });

    const projectMap = new Map();
    for (const node of matchingNodes) {
      const projId = node.properties?.projectId || 'global_knowledge';
      if (!projectMap.has(projId)) projectMap.set(projId, []);
      projectMap.get(projId).push(node);
    }

    return {
      query,
      totalMatches: matchingNodes.length,
      projectsCount: projectMap.size,
      resultsByProject: Object.fromEntries(projectMap)
    };
  }

  correctClaim(claimId, updatedText, reason = 'Empirical correction') {
    const node = this.nodes.get(claimId);
    if (!node) return { success: false, reason: 'CLAIM_NOT_FOUND' };

    node.properties.priorText = node.label;
    node.properties.correctionReason = reason;
    node.properties.correctedAt = new Date().toISOString();
    node.label = updatedText;
    this.save();

    try {
      const { starkMemoryDbInstance } = require('./memory/starkMemoryDb.js');
      if (starkMemoryDbInstance && typeof starkMemoryDbInstance.saveKgNode === 'function') {
        starkMemoryDbInstance.saveKgNode({
          id: claimId,
          type: 'claim',
          label: updatedText,
          properties: node.properties,
          provenance: node.provenance,
          confidence: node.properties.confidence || 1.0,
          epistemicType: 'USER_STATEMENT'
        });
      }
    } catch (_) {}

    return {
      success: true,
      claimId,
      newText: updatedText,
      priorText: node.properties.priorText,
      reason
    };
  }
}


const knowledgeGraphEngineInstance = new KnowledgeGraphEngine();

module.exports = knowledgeGraphEngineInstance;
module.exports.KnowledgeGraphEngine = KnowledgeGraphEngine;
module.exports.knowledgeGraphEngineInstance = knowledgeGraphEngineInstance;
