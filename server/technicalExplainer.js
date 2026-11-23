/**
 * VISION AI — Technical Explainer & Reproduction Generator
 * Produces structured, step-by-step reproduction guides with exact commands,
 * mathematical equations, and verification assertions for technical work.
 */

const { GROUNDING_LEVELS } = require('./capabilityRegistry.js');

class TechnicalExplainer {
  constructor() {}

  /**
   * Generates a pedagogical reproduction guide for an engineering, coding, or perception task
   */
  generateReproductionGuide({
    topic = 'General Technical Work',
    groundingLevel = GROUNDING_LEVELS.IMPLEMENTED_SOFTWARE,
    description = '',
    equations = [],
    codeSnippet = '',
    cliCommands = [],
    assertions = [],
    safetyNotes = []
  } = {}) {
    let guide = `# TECHNICAL EXPLANATION & REPRODUCTION GUIDE: ${topic.toUpperCase()}\n\n`;

    // 1. Grounding Classification
    guide += `### 1. Grounding Classification\n`;
    guide += `- **Classification Level:** \`${groundingLevel}\`\n`;
    if (groundingLevel === GROUNDING_LEVELS.SIMULATED_RESULTS) {
      guide += `> [!NOTE]\n> **Simulated Results Notice:** This outcome is derived from mathematical, physical, or numerical models. It does not replace physical prototyping, destructive testing, or certified fabrication calibration.\n\n`;
    } else if (groundingLevel === GROUNDING_LEVELS.PHYSICALLY_TESTED) {
      guide += `> [!IMPORTANT]\n> **Physically Tested Directive:** This outcome interfaces with real physical hardware devices (cameras, microphones, OS kernel drivers). Physical environment lighting, USB topology, or OS permissions impact performance.\n\n`;
    } else if (groundingLevel === GROUNDING_LEVELS.EXTERNALLY_VERIFIED) {
      guide += `> [!TIP]\n> **Externally Grounded Source:** Data verified from live public scholarly repositories or external web indices with complete source attribution.\n\n`;
    } else {
      guide += `> [!NOTE]\n> **Implemented Software:** Locally executed and verified by deterministic automated tests in the Node.js/Windows environment.\n\n`;
    }

    // 2. Conceptual Summary
    guide += `### 2. Conceptual Overview & Principles\n`;
    guide += `${description || 'This technical workflow achieves deterministic, test-verified execution within VISION AI.'}\n\n`;

    // 3. Mathematical & Theoretical Formulations
    if (equations && equations.length > 0) {
      guide += `### 3. Governing Equations & Physical Laws\n`;
      for (const eq of equations) {
        guide += `- **${eq.name}:**\n`;
        guide += `  $$\n  ${eq.formula}\n  $$\n`;
        if (eq.variables) {
          guide += `  *Variables:* ${eq.variables}\n`;
        }
      }
      guide += `\n`;
    }

    // 4. Step-by-Step Reproduction Walkthrough
    guide += `### 4. Step-by-Step Reproduction Instructions\n`;
    guide += `Follow these explicit steps in your local environment to replicate this technical outcome:\n\n`;

    if (cliCommands && cliCommands.length > 0) {
      guide += `#### A. Execution Commands\n\`\`\`bash\n`;
      for (const cmd of cliCommands) {
        guide += `${cmd}\n`;
      }
      guide += `\`\`\`\n\n`;
    }

    if (codeSnippet) {
      guide += `#### B. Implementation / Script Snippet\n\`\`\`javascript\n${codeSnippet}\n\`\`\`\n\n`;
    }

    // 5. Verification Assertions
    if (assertions && assertions.length > 0) {
      guide += `### 5. Verification Assertions & Acceptance Criteria\n`;
      guide += `To confirm correct replication, ensure the following conditions evaluate to true:\n`;
      for (const ass of assertions) {
        guide += `- [ ] **${ass.criteria}:** \`${ass.expected}\`\n`;
      }
      guide += `\n`;
    }

    // 6. Safety & Practical Constraints
    guide += `### 6. Safety & Practical Operational Constraints\n`;
    if (safetyNotes && safetyNotes.length > 0) {
      for (const note of safetyNotes) {
        guide += `- ⚠️ **Notice:** ${note}\n`;
      }
    } else {
      guide += `- Ensure operations remain within certified mechanical, thermal, and electrical limits.\n`;
    }

    return {
      success: true,
      topic,
      groundingLevel,
      markdown: guide
    };
  }

  /**
   * Pre-packaged explainer for standard STARK engineering calculations
   */
  explainBeamDeflection({ forceN = 500, lengthM = 1.0, elasticModulusPa = 200e9, inertiaM4 = 8.33e-6 }) {
    const moment = forceN * lengthM;
    const deflection = (forceN * Math.pow(lengthM, 3)) / (3 * elasticModulusPa * inertiaM4);

    return this.generateReproductionGuide({
      topic: 'Cantilever Beam Bending Stress and Deflection Analysis',
      groundingLevel: GROUNDING_LEVELS.SIMULATED_RESULTS,
      description: 'Calculates the maximum bending moment and tip deflection of an end-loaded cantilever beam using Euler-Bernoulli beam theory.',
      equations: [
        {
          name: 'Maximum Bending Moment',
          formula: 'M_{max} = F \\cdot L',
          variables: 'F = Applied Point Load (N), L = Unsupported Beam Length (m)'
        },
        {
          name: 'Elastic Tip Deflection',
          formula: '\\delta_{max} = \\frac{F \\cdot L^3}{3 \\cdot E \\cdot I}',
          variables: 'E = Modulus of Elasticity (Pa), I = Area Moment of Inertia (m^4)'
        }
      ],
      cliCommands: [
        `node -e "const { mechanicalRoboticsEngineInstance } = require('./server/mechanicalRoboticsEngine.js'); console.log(mechanicalRoboticsEngineInstance.calculateBeamStress({ loadN: ${forceN}, lengthMm: ${lengthM * 1000} }));"`
      ],
      assertions: [
        { criteria: 'Calculated Bending Moment', expected: `${moment.toFixed(2)} N·m` },
        { criteria: 'Calculated Tip Deflection', expected: `${(deflection * 1000).toFixed(4)} mm` }
      ],
      safetyNotes: [
        'Simulation assumes small-angle elastic deflection (< 5% of beam length).',
        'Verify with physical strain gauges prior to structural commissioning.'
      ]
    });
  }

  /**
   * Pre-packaged explainer for actuator motor torque sizing
   */
  explainActuatorTorque({ massKg = 2.5, armLengthM = 0.45, accelerationRadS2 = 1.5, safetyFactor = 1.5 }) {
    const gravity = 9.81;
    const staticTorque = massKg * gravity * armLengthM;
    const inertia = (1 / 3) * massKg * Math.pow(armLengthM, 2);
    const dynamicTorque = inertia * accelerationRadS2;
    const totalTorque = (staticTorque + dynamicTorque) * safetyFactor;

    return this.generateReproductionGuide({
      topic: 'Robotic Arm Joint Actuator Torque Sizing',
      groundingLevel: GROUNDING_LEVELS.SIMULATED_RESULTS,
      description: 'Determines the continuous and peak torque required for a revolute robotic joint under combined gravitational and inertial loading.',
      equations: [
        {
          name: 'Gravitational Torque (Static)',
          formula: '\\tau_{gravity} = m \\cdot g \\cdot r_{com}',
          variables: 'm = mass (kg), g = 9.81 m/s², r_com = distance to center of mass (m)'
        },
        {
          name: 'Dynamic Acceleration Torque',
          formula: '\\tau_{dynamic} = I_{joint} \\cdot \\alpha = (\\frac{1}{3} m L^2) \\cdot \\alpha',
          variables: 'I = rotational inertia (kg·m²), alpha = angular acceleration (rad/s²)'
        },
        {
          name: 'Total Required Actuator Torque',
          formula: '\\tau_{required} = (\\tau_{gravity} + \\tau_{dynamic}) \\cdot S_f',
          variables: 'S_f = Safety factor (typically 1.5 - 2.0)'
        }
      ],
      cliCommands: [
        `node -e "const { mechanicalRoboticsEngineInstance } = require('./server/mechanicalRoboticsEngine.js'); console.log(mechanicalRoboticsEngineInstance.calculateRoboticTorque({ payloadKg: ${massKg}, linkLengthMm: ${armLengthM * 1000}, angularAcc: ${accelerationRadS2}, safetyFactor: ${safetyFactor} }));"`
      ],
      assertions: [
        { criteria: 'Static Gravity Torque', expected: `${staticTorque.toFixed(2)} N·m` },
        { criteria: 'Total Actuator Torque with Safety Factor', expected: `${totalTorque.toFixed(2)} N·m` }
      ],
      safetyNotes: [
        'Safety factor of 1.5 accounts for friction in bearings and harmonic gearhead reduction efficiency.',
        'Thermal dissipation limits of the motor winding must be checked against continuous operating torque.'
      ]
    });
  }
}

const technicalExplainerInstance = new TechnicalExplainer();

module.exports = {
  TechnicalExplainer,
  technicalExplainerInstance
};
