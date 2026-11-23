/**
 * VISION AI — Automated Engineering Design Exploration Engine
 * Multi-objective optimization, parameter sweeps, sensitivity analysis,
 * Pareto-front generation, and constraint-based design ranking.
 */

const fs = require('fs');
const path = require('path');

class DesignExplorationEngine {
  constructor() {}

  /**
   * Evaluates beam design candidate objectives and constraints
   * Variables: { widthMm, heightMm, wallThicknessMm, materialGrade: 'AL_6061'|'TI_6AL_4V'|'CFRP' }
   */
  evaluateBeamDesign(variables = {}, requirements = {}) {
    const {
      widthMm = 50,
      heightMm = 100,
      wallThicknessMm = 4,
      lengthM = 1.5,
      appliedLoadN = 2500,
      materialGrade = 'AL_6061'
    } = variables;

    const materials = {
      AL_6061: { densityKgM3: 2700, youngsModGpa: 68.9, yieldStrengthMpa: 276, costPerKgUSD: 6.5 },
      TI_6AL_4V: { densityKgM3: 4430, youngsModGpa: 113.8, yieldStrengthMpa: 880, costPerKgUSD: 45.0 },
      CFRP: { densityKgM3: 1550, youngsModGpa: 135.0, yieldStrengthMpa: 600, costPerKgUSD: 85.0 }
    };

    const mat = materials[materialGrade] || materials.AL_6061;

    // Cross-sectional geometry (Hollow Rectangular Tube)
    const bOuter = widthMm / 1000;
    const hOuter = heightMm / 1000;
    const t = wallThicknessMm / 1000;
    const bInner = Math.max(0.001, bOuter - 2 * t);
    const hInner = Math.max(0.001, hOuter - 2 * t);

    // Cross-sectional area and moment of inertia
    const areaM2 = (bOuter * hOuter) - (bInner * hInner);
    const volumeM3 = areaM2 * lengthM;
    const massKg = volumeM3 * mat.densityKgM3;
    const materialCostUSD = massKg * mat.costPerKgUSD;

    const iOuter = (bOuter * (hOuter ** 3)) / 12;
    const iInner = (bInner * (hInner ** 3)) / 12;
    const momentOfInertiaI = iOuter - iInner;

    // Maximum bending stress: sigma = (M * c) / I, M = F * L
    const maxMomentNm = appliedLoadN * lengthM;
    const c = hOuter / 2;
    const bendingStressMpa = ((maxMomentNm * c) / momentOfInertiaI) / 1e6;

    // Tip deflection: delta = (F * L^3) / (3 * E * I)
    const E = mat.youngsModGpa * 1e9;
    const tipDeflectionMm = ((appliedLoadN * (lengthM ** 3)) / (3 * E * momentOfInertiaI)) * 1000;

    // Factor of safety
    const factorOfSafety = Number((mat.yieldStrengthMpa / Math.max(0.001, bendingStressMpa)).toFixed(2));

    // Constraints check
    const minFos = requirements.minFos || 1.5;
    const maxDeflectionMm = requirements.maxDeflectionMm || 10.0;
    const maxMassKg = requirements.maxMassKg || 8.0;

    const constraintsPassed = (factorOfSafety >= minFos) &&
                              (tipDeflectionMm <= maxDeflectionMm) &&
                              (massKg <= maxMassKg);

    return {
      variables: { widthMm, heightMm, wallThicknessMm, materialGrade },
      objectives: {
        massKg: Number(massKg.toFixed(3)),
        materialCostUSD: Number(materialCostUSD.toFixed(2)),
        factorOfSafety,
        tipDeflectionMm: Number(tipDeflectionMm.toFixed(2)),
        maxBendingStressMpa: Number(bendingStressMpa.toFixed(1))
      },
      constraints: {
        passed: constraintsPassed,
        minFosSatisfied: factorOfSafety >= minFos,
        deflectionSatisfied: tipDeflectionMm <= maxDeflectionMm,
        massBudgetSatisfied: massKg <= maxMassKg
      }
    };
  }

  /**
   * Executes a 1D parameter sweep over a design variable
   */
  runParameterSweep(paramName, minVal, maxVal, steps = 10, baseVariables = {}, requirements = {}) {
    const sweepResults = [];
    const stepSize = (maxVal - minVal) / Math.max(1, steps - 1);

    for (let i = 0; i < steps; i++) {
      const val = Number((minVal + i * stepSize).toFixed(3));
      const currentVars = { ...baseVariables, [paramName]: val };
      const evalResult = this.evaluateBeamDesign(currentVars, requirements);
      sweepResults.push({
        parameterValue: val,
        ...evalResult
      });
    }

    return {
      paramName,
      minVal,
      maxVal,
      steps,
      results: sweepResults
    };
  }

  /**
   * Performs multi-objective optimization across design variables and extracts the Pareto Front
   */
  exploreParetoFront(options = {}) {
    const {
      sampleCount = 100,
      requirements = { minFos: 1.5, maxDeflectionMm: 12.0, maxMassKg: 10.0 },
      materials = ['AL_6061', 'TI_6AL_4V', 'CFRP']
    } = options;

    const evaluatedDesigns = [];

    // Latin Hypercube / Stochastic parameter sampling
    for (let i = 0; i < sampleCount; i++) {
      const widthMm = Math.round(30 + Math.random() * 50); // 30mm - 80mm
      const heightMm = Math.round(50 + Math.random() * 90); // 50mm - 140mm
      const wallThicknessMm = Math.round((2 + Math.random() * 6) * 10) / 10; // 2mm - 8mm
      const mat = materials[Math.floor(Math.random() * materials.length)];

      const evaluated = this.evaluateBeamDesign({
        widthMm,
        heightMm,
        wallThicknessMm,
        materialGrade: mat
      }, requirements);

      if (evaluated.constraints.passed) {
        evaluatedDesigns.push(evaluated);
      }
    }

    // Non-dominated Sorting for Pareto Front:
    // Objectives to minimize: massKg, materialCostUSD
    // Objectives to maximize: factorOfSafety
    const paretoFront = [];

    for (let i = 0; i < evaluatedDesigns.length; i++) {
      const d1 = evaluatedDesigns[i];
      let dominated = false;

      for (let j = 0; j < evaluatedDesigns.length; j++) {
        if (i === j) continue;
        const d2 = evaluatedDesigns[j];

        // Check if d2 strictly dominates d1:
        // d2 is <= d1 in mass and cost, and >= d1 in FOS, with at least one strictly better
        const noWorse = (d2.objectives.massKg <= d1.objectives.massKg) &&
                        (d2.objectives.materialCostUSD <= d1.objectives.materialCostUSD) &&
                        (d2.objectives.factorOfSafety >= d1.objectives.factorOfSafety);

        const strictlyBetter = (d2.objectives.massKg < d1.objectives.massKg) ||
                               (d2.objectives.materialCostUSD < d1.objectives.materialCostUSD) ||
                               (d2.objectives.factorOfSafety > d1.objectives.factorOfSafety);

        if (noWorse && strictlyBetter) {
          dominated = true;
          break;
        }
      }

      if (!dominated) {
        paretoFront.push(d1);
      }
    }

    return {
      totalCandidatesSampled: sampleCount,
      feasibleCount: evaluatedDesigns.length,
      paretoFrontCount: paretoFront.length,
      paretoFront: paretoFront.sort((a, b) => a.objectives.massKg - b.objectives.massKg)
    };
  }

  /**
   * Computes sensitivity derivatives dObjective / dVariable using central finite difference
   */
  calculateSensitivity(baseVariables = {}, deltaPercent = 0.05) {
    const sensitivities = {};
    const baseEval = this.evaluateBeamDesign(baseVariables);

    const testVars = ['widthMm', 'heightMm', 'wallThicknessMm'];

    for (const varName of testVars) {
      const baseVal = baseVariables[varName] || 50;
      const h = baseVal * deltaPercent;

      const evalPlus = this.evaluateBeamDesign({ ...baseVariables, [varName]: baseVal + h });
      const evalMinus = this.evaluateBeamDesign({ ...baseVariables, [varName]: baseVal - h });

      // Finite difference derivatives
      const dMass = (evalPlus.objectives.massKg - evalMinus.objectives.massKg) / (2 * h);
      const dDeflection = (evalPlus.objectives.tipDeflectionMm - evalMinus.objectives.tipDeflectionMm) / (2 * h);
      const dFos = (evalPlus.objectives.factorOfSafety - evalMinus.objectives.factorOfSafety) / (2 * h);

      sensitivities[varName] = {
        dMassDVar: Number(dMass.toFixed(4)),
        dDeflectionDVar: Number(dDeflection.toFixed(4)),
        dFosDVar: Number(dFos.toFixed(4)),
        interpretation: `Increasing ${varName} increases FOS by ${(dFos * 10).toFixed(2)} per 10mm and changes mass by ${(dMass * 10).toFixed(2)}kg`
      };
    }

    return {
      baseVariables,
      baseObjectives: baseEval.objectives,
      sensitivities
    };
  }

  /**
   * Multi-criteria decision analysis (TOPSIS scoring) to rank Pareto candidate designs
   */
  rankParetoDesigns(paretoCandidates = [], weights = { mass: 0.4, cost: 0.3, fos: 0.3 }) {
    if (!Array.isArray(paretoCandidates) || paretoCandidates.length === 0) {
      return [];
    }

    // Normalized scoring
    const minMass = Math.min(...paretoCandidates.map(c => c.objectives.massKg));
    const maxMass = Math.max(...paretoCandidates.map(c => c.objectives.massKg));
    const minCost = Math.min(...paretoCandidates.map(c => c.objectives.materialCostUSD));
    const maxCost = Math.max(...paretoCandidates.map(c => c.objectives.materialCostUSD));
    const minFos = Math.min(...paretoCandidates.map(c => c.objectives.factorOfSafety));
    const maxFos = Math.max(...paretoCandidates.map(c => c.objectives.factorOfSafety));

    const scored = paretoCandidates.map(candidate => {
      // For minimization (mass, cost): lower is better -> (max - val) / (max - min)
      const normMass = (maxMass === minMass) ? 1.0 : (maxMass - candidate.objectives.massKg) / (maxMass - minMass);
      const normCost = (maxCost === minCost) ? 1.0 : (maxCost - candidate.objectives.materialCostUSD) / (maxCost - minCost);
      // For maximization (FOS): higher is better -> (val - min) / (max - min)
      const normFos = (maxFos === minFos) ? 1.0 : (candidate.objectives.factorOfSafety - minFos) / (maxFos - minFos);

      const compositeScore = Number((
        (normMass * weights.mass) +
        (normCost * weights.cost) +
        (normFos * weights.fos)
      ).toFixed(4));

      return {
        ...candidate,
        compositeScore,
        rankingRationale: `Weighted score ${compositeScore}: Mass ${candidate.objectives.massKg}kg, Cost $${candidate.objectives.materialCostUSD}, FOS ${candidate.objectives.factorOfSafety}`
      };
    });

    return scored.sort((a, b) => b.compositeScore - a.compositeScore);
  }
}

const designExplorationEngineInstance = new DesignExplorationEngine();

module.exports = {
  DesignExplorationEngine,
  designExplorationEngineInstance
};
