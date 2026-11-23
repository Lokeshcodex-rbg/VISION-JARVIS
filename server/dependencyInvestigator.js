/**
 * VISION AI — Missing Dependency Investigator & Feasibility Proposer
 * Investigates exact technical obstacles when a tool or capability is unavailable,
 * proposes concrete, grounded alternatives, and implements the strongest feasible solution.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { capabilityRegistryInstance, CAPABILITY_STATUS } = require('./capabilityRegistry.js');

class DependencyInvestigator {
  constructor() {
    this.cachedBinaryChecks = new Map();
  }

  isBinaryAvailable(name) {
    if (this.cachedBinaryChecks.has(name)) {
      return this.cachedBinaryChecks.get(name);
    }
    try {
      const checkCmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
      execSync(checkCmd, { stdio: 'ignore' });
      this.cachedBinaryChecks.set(name, true);
      return true;
    } catch (_) {
      this.cachedBinaryChecks.set(name, false);
      return false;
    }
  }

  /**
   * Deeply investigates a requested tool, task, or capability to diagnose technical obstacles
   */
  async investigate(target) {
    const t0 = Date.now();
    const result = {
      target,
      available: true,
      obstacle: null,
      diagnostics: {},
      feasibleAlternatives: [],
      recommendedSolution: null,
      implementedFallback: null,
      latencyMs: 0
    };

    const lowerTarget = (target || '').toLowerCase();

    // 1. OpenSCAD CAD Rendering Dependency
    if (lowerTarget.includes('openscad') || lowerTarget.includes('stl_render') || lowerTarget.includes('3d_model')) {
      const hasBinary = this.isBinaryAvailable('openscad');
      result.diagnostics.openscadBinary = hasBinary;
      if (!hasBinary) {
        result.available = false;
        result.obstacle = 'OpenSCAD binary (openscad.exe) is not installed on system PATH for headless mesh compilation.';
        result.feasibleAlternatives = [
          {
            name: 'Pure CSG Code Generation',
            feasibilityScore: 0.98,
            action: 'Generate syntactically validated .scad script with parametric CSG primitives (cube, cylinder, difference, union).',
            userSteps: 'User can download the generated .scad file into OpenSCAD, FreeCAD, or Blender for interactive 3D export.'
          },
          {
            name: 'Mathematical Bounding Box & Mass Properties',
            feasibilityScore: 0.90,
            action: 'Compute center of mass, volume, and bounding geometry analytically without requiring binary 3D rasterization.',
            userSteps: 'Inspect calculated physical properties directly in the HUD output.'
          }
        ];
        result.recommendedSolution = result.feasibleAlternatives[0];
        result.implementedFallback = 'CSG_CODE_AND_PARAMETRIC_EXPORT';
      }
    }

    // 2. Physical Camera Input
    else if (lowerTarget.includes('camera') || lowerTarget.includes('webcam') || lowerTarget.includes('see me')) {
      const status = capabilityRegistryInstance.getCapability('cap_camera_hardware');
      const isLocked = status?.measuredPerformance?.isLockedEmergencyStop;

      if (isLocked) {
        result.available = false;
        result.obstacle = 'Global Emergency Stop lockout is active on camera hardware.';
        result.feasibleAlternatives = [
          {
            name: 'Authorize Emergency Stop Reset',
            feasibilityScore: 1.0,
            action: 'Call POST /api/security/emergency-stop-reset to release the safety lock with user authorization.'
          }
        ];
        result.recommendedSolution = result.feasibleAlternatives[0];
      } else {
        result.diagnostics.cameraHardware = 'Webcam discovery supported via navigator.mediaDevices';
        result.feasibleAlternatives = [
          {
            name: 'Screen / Window Analysis',
            feasibilityScore: 0.95,
            action: 'Use analyze_screen or read_screen_text to inspect digital drawings, diagrams, or errors.'
          },
          {
            name: 'Local Image File Inspection',
            feasibilityScore: 0.92,
            action: 'Use analyze_local_image_file to inspect pre-captured engineering photos or schematics.'
          }
        ];
        result.recommendedSolution = result.feasibleAlternatives[0];
        result.implementedFallback = 'SCREEN_AND_LOCAL_IMAGE_FALLBACK';
      }
    }

    // 3. Cloud LLM / Multimodal Vision Quota
    else if (lowerTarget.includes('gemini') || lowerTarget.includes('vision_api') || lowerTarget.includes('quota')) {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;
      const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
      result.diagnostics.hasGeminiKey = hasGeminiKey;
      result.diagnostics.hasOpenRouterKey = hasOpenRouterKey;

      if (!hasGeminiKey && !hasOpenRouterKey) {
        result.available = false;
        result.obstacle = 'Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is configured in system environment.';
        result.feasibleAlternatives = [
          {
            name: 'Local Deterministic Intelligence & Physics Solvers',
            feasibilityScore: 0.95,
            action: 'Execute all scientific, engineering, code inspection, and desktop automation tools using local node engines.'
          },
          {
            name: 'Zero-Key Web Research',
            feasibilityScore: 0.90,
            action: 'Utilize DuckDuckGo and ArXiv scholarly research endpoints without cloud API keys.'
          }
        ];
        result.recommendedSolution = result.feasibleAlternatives[0];
        result.implementedFallback = 'LOCAL_DETERMINISTIC_ENGINES';
      } else {
        result.feasibleAlternatives = [
          {
            name: 'Multi-Provider Failover',
            feasibilityScore: 0.98,
            action: 'Route through OpenRouter or local structural inspection if primary provider returns HTTP 429.'
          }
        ];
        result.recommendedSolution = result.feasibleAlternatives[0];
      }
    }

    // 4. Windows Administrator Elevation
    else if (lowerTarget.includes('elevation') || lowerTarget.includes('admin') || lowerTarget.includes('uac')) {
      result.diagnostics.platform = process.platform;
      result.diagnostics.isWindows = process.platform === 'win32';
      result.feasibleAlternatives = [
        {
          name: 'Safe Elevation Proposal Gate',
          feasibilityScore: 1.0,
          action: 'Formulate human-readable elevation proposal with impact analysis and wait for explicit user approval token.'
        },
        {
          name: 'Non-Elevated User Space Execution',
          feasibilityScore: 0.85,
          action: 'Perform read-only diagnostic or user-profile file modification without modifying system-level directories.'
        }
      ];
      result.recommendedSolution = result.feasibleAlternatives[0];
      result.implementedFallback = 'USER_SPACE_FALLBACK';
    }

    // 5. General Tool / Generic Capability
    else {
      result.diagnostics.generic = 'Standard system tool check';
      result.feasibleAlternatives = [
        {
          name: 'Dynamic Tool Synthesis',
          feasibilityScore: 0.90,
          action: 'Scaffold a custom, sandboxed tool dynamically using dynamicToolsManager and selfDevelopmentEngine.'
        },
        {
          name: 'Multi-Step Task Orchestration',
          feasibilityScore: 0.88,
          action: 'Decompose the complex task into a sequence of verified primitive operations.'
        }
      ];
      result.recommendedSolution = result.feasibleAlternatives[0];
      result.implementedFallback = 'TASK_DECOMPOSITION';
    }

    result.latencyMs = Date.now() - t0;
    return result;
  }

  async diagnose(target) {
    return this.investigate(target);
  }
}

const dependencyInvestigatorInstance = new DependencyInvestigator();

module.exports = {
  DependencyInvestigator,
  dependencyInvestigatorInstance
};
