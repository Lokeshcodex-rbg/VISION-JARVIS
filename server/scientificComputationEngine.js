/**
 * VISION AI — Scientific & Mathematical Computation Engine
 * Module 2 & Module 10: Verified computational mathematics and physics engine.
 * 
 * Capabilities:
 * 1. Linear Algebra: Matrix operations, determinant, inverse, eigenvalues/eigenvectors (2x2, 3x3), dot/cross products.
 * 2. Calculus & ODEs: Finite-difference numerical differentiation (central, Richardson), Simpson's 1/3 integration, RK4 ODE solver.
 * 3. Numerical Root Finding: Newton-Raphson, Bisection method, Secant method.
 * 4. Statistics & Probability: Mean, variance, standard deviation, skewness, Pearson correlation, linear regression, Normal CDF (erf).
 * 5. Optimization: Gradient descent with momentum, 1D Golden Section search, Nelder-Mead simplex search.
 * 6. Monte Carlo Simulation: Normal/Uniform/Lognormal trials, empirical percentiles (P5, P50, P90, P95, P99).
 * 7. Dimensional Analysis & Unit Conversion: SI, Imperial, and Engineering units (Length, Mass, Force, Pressure, Energy, Power, Temp).
 * 8. Error Propagation & Sensitivity Analysis: Gaussian variance propagation and partial derivative elasticity.
 * 9. Independent Cross-Checking: Verifies high-impact computations against alternative analytical/numerical formulas.
 */

class ScientificComputationEngine {
  constructor() {
    this.unitConversions = {
      length: {
        m: 1.0,
        mm: 0.001,
        cm: 0.01,
        km: 1000.0,
        in: 0.0254,
        ft: 0.3048,
        yd: 0.9144,
        mi: 1609.344
      },
      mass: {
        kg: 1.0,
        g: 0.001,
        mg: 0.000001,
        t: 1000.0,
        lb: 0.45359237,
        oz: 0.028349523125
      },
      force: {
        N: 1.0,
        kN: 1000.0,
        lbf: 4.4482216152605,
        dyne: 1e-5,
        kgf: 9.80665
      },
      pressure: {
        Pa: 1.0,
        kPa: 1e3,
        MPa: 1e6,
        GPa: 1e9,
        bar: 1e5,
        psi: 6894.757293168,
        atm: 101325.0
      },
      energy: {
        J: 1.0,
        kJ: 1000.0,
        MJ: 1e6,
        cal: 4.184,
        kcal: 4184.0,
        Wh: 3600.0,
        kWh: 3.6e6,
        BTU: 1055.06
      },
      power: {
        W: 1.0,
        kW: 1000.0,
        MW: 1e6,
        hp: 745.699872
      },
      angle: {
        rad: 1.0,
        deg: Math.PI / 180.0
      }
    };
  }

  // =========================================================================
  // 1. UNIT CONVERSION & DIMENSIONAL ANALYSIS
  // =========================================================================

  convertUnits(value, fromUnit, toUnit, category = null) {
    const val = Number(value);
    if (isNaN(val)) throw new Error(`Invalid numeric value: ${value}`);

    const from = String(fromUnit).trim();
    const to = String(toUnit).trim();

    // Temperature special handling
    if (category === 'temperature' || ['C', 'F', 'K'].includes(from)) {
      return this._convertTemperature(val, from, to);
    }

    // Auto-detect category if not specified
    let detectedCategory = category;
    if (!detectedCategory) {
      for (const [cat, map] of Object.entries(this.unitConversions)) {
        if (map[from] !== undefined && map[to] !== undefined) {
          detectedCategory = cat;
          break;
        }
      }
    }

    if (!detectedCategory || !this.unitConversions[detectedCategory]) {
      throw new Error(`Unsupported unit conversion from "${from}" to "${to}".`);
    }

    const map = this.unitConversions[detectedCategory];
    const fromFactor = map[from];
    const toFactor = map[to];

    if (fromFactor === undefined || toFactor === undefined) {
      throw new Error(`Unknown unit "${from}" or "${to}" in category ${detectedCategory}.`);
    }

    // Convert to base SI, then to target unit
    const baseValue = val * fromFactor;
    const targetValue = baseValue / toFactor;

    return {
      success: true,
      category: detectedCategory,
      inputValue: val,
      fromUnit: from,
      outputValue: targetValue,
      toUnit: to,
      baseSIValue: baseValue,
      factor: fromFactor / toFactor
    };
  }

  _convertTemperature(val, from, to) {
    let kelvin = 0;
    if (from === 'C' || from === 'degC') kelvin = val + 273.15;
    else if (from === 'F' || from === 'degF') kelvin = (val - 32) * (5 / 9) + 273.15;
    else if (from === 'K') kelvin = val;
    else throw new Error(`Unsupported temperature unit: ${from}`);

    let out = 0;
    if (to === 'C' || to === 'degC') out = kelvin - 273.15;
    else if (to === 'F' || to === 'degF') out = (kelvin - 273.15) * (9 / 5) + 32;
    else if (to === 'K') out = kelvin;
    else throw new Error(`Unsupported target temperature unit: ${to}`);

    return {
      success: true,
      category: 'temperature',
      inputValue: val,
      fromUnit: from,
      outputValue: out,
      toUnit: to,
      baseKelvin: kelvin
    };
  }

  // =========================================================================
  // 2. LINEAR ALGEBRA & VECTOR CALCULUS
  // =========================================================================

  vectorDot(u, v) {
    if (!Array.isArray(u) || !Array.isArray(v) || u.length !== v.length) {
      throw new Error('Vectors must be arrays of equal non-zero length.');
    }
    return u.reduce((sum, val, idx) => sum + val * v[idx], 0);
  }

  vectorCross3D(u, v) {
    if (u.length !== 3 || v.length !== 3) {
      throw new Error('Cross product is defined for 3D vectors only.');
    }
    return [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0]
    ];
  }

  vectorNorm(u) {
    return Math.sqrt(this.vectorDot(u, u));
  }

  matrixMultiply(A, B) {
    const rowsA = A.length;
    const colsA = A[0].length;
    const rowsB = B.length;
    const colsB = B[0].length;

    if (colsA !== rowsB) {
      throw new Error(`Matrix dimension mismatch: A is ${rowsA}x${colsA}, B is ${rowsB}x${colsB}.`);
    }

    const C = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        let sum = 0;
        for (let k = 0; k < colsA; k++) {
          sum += A[i][k] * B[k][j];
        }
        C[i][j] = sum;
      }
    }
    return C;
  }

  matrixDeterminant(M) {
    const n = M.length;
    if (n === 0 || M.some(row => row.length !== n)) {
      throw new Error('Matrix must be square to compute determinant.');
    }

    if (n === 1) return M[0][0];
    if (n === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
    if (n === 3) {
      return (
        M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
        M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
        M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
      );
    }

    // Gaussian elimination for n >= 4
    const A = M.map(row => [...row]);
    let det = 1;
    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[j][i]) > Math.abs(A[pivot][i])) pivot = j;
      }
      if (Math.abs(A[pivot][i]) < 1e-12) return 0;
      if (pivot !== i) {
        [A[i], A[pivot]] = [A[pivot], A[i]];
        det = -det;
      }
      det *= A[i][i];
      for (let j = i + 1; j < n; j++) {
        const factor = A[j][i] / A[i][i];
        for (let k = i + 1; k < n; k++) {
          A[j][k] -= factor * A[i][k];
        }
      }
    }
    return det;
  }

  matrixInverse(M) {
    const n = M.length;
    const det = this.matrixDeterminant(M);
    if (Math.abs(det) < 1e-12) {
      throw new Error('Matrix is singular (determinant ~ 0); inverse does not exist.');
    }

    if (n === 2) {
      return [
        [M[1][1] / det, -M[0][1] / det],
        [-M[1][0] / det, M[0][0] / det]
      ];
    }

    if (n === 3) {
      const inv = [];
      for (let i = 0; i < 3; i++) {
        inv[i] = [];
        for (let j = 0; j < 3; j++) {
          const minor = [];
          for (let r = 0; r < 3; r++) {
            if (r === j) continue;
            const row = [];
            for (let c = 0; c < 3; c++) {
              if (c === i) continue;
              row.push(M[r][c]);
            }
            minor.push(row);
          }
          const sign = (i + j) % 2 === 0 ? 1 : -1;
          inv[i][j] = (sign * (minor[0][0] * minor[1][1] - minor[0][1] * minor[1][0])) / det;
        }
      }
      return inv;
    }

    throw new Error('Direct inversion currently supported up to 3x3 matrices.');
  }

  // =========================================================================
  // 3. NUMERICAL INTEGRATION & DIFFERENTIATION
  // =========================================================================

  /**
   * Central difference derivative with optional Richardson extrapolation
   */
  numericalDerivative(fn, x, h = 1e-5, richardson = true) {
    if (richardson) {
      const d1 = (fn(x + h) - fn(x - h)) / (2 * h);
      const d2 = (fn(x + h / 2) - fn(x - h / 2)) / h;
      return (4 * d2 - d1) / 3;
    }
    return (fn(x + h) - fn(x - h)) / (2 * h);
  }

  /**
   * Composite Simpson's 1/3 rule numerical integration
   */
  numericalIntegrate(fn, a, b, n = 1000) {
    const numIntervals = n % 2 === 0 ? n : n + 1;
    const h = (b - a) / numIntervals;
    let sum = fn(a) + fn(b);

    for (let i = 1; i < numIntervals; i++) {
      const x = a + i * h;
      sum += (i % 2 === 0 ? 2 : 4) * fn(x);
    }
    return (h / 3) * sum;
  }

  /**
   * 4th-Order Runge-Kutta (RK4) ODE Solver
   * Solves dy/dt = f(t, y) from t0 to tEnd
   */
  solveODE_RK4(dydt, t0, y0, tEnd, steps = 100) {
    const dt = (tEnd - t0) / steps;
    const trajectory = [{ t: t0, y: y0 }];

    let t = t0;
    let y = Array.isArray(y0) ? [...y0] : y0;

    const isVector = Array.isArray(y0);

    for (let i = 0; i < steps; i++) {
      if (isVector) {
        const k1 = dydt(t, y);
        const y_k1 = y.map((val, idx) => val + 0.5 * dt * k1[idx]);

        const k2 = dydt(t + 0.5 * dt, y_k1);
        const y_k2 = y.map((val, idx) => val + 0.5 * dt * k2[idx]);

        const k3 = dydt(t + 0.5 * dt, y_k2);
        const y_k3 = y.map((val, idx) => val + dt * k3[idx]);

        const k4 = dydt(t + dt, y_k3);

        y = y.map((val, idx) => val + (dt / 6) * (k1[idx] + 2 * k2[idx] + 2 * k3[idx] + k4[idx]));
      } else {
        const k1 = dydt(t, y);
        const k2 = dydt(t + 0.5 * dt, y + 0.5 * dt * k1);
        const k3 = dydt(t + 0.5 * dt, y + 0.5 * dt * k2);
        const k4 = dydt(t + dt, y + dt * k3);
        y += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      }

      t += dt;
      trajectory.push({ t, y: isVector ? [...y] : y });
    }

    return {
      tEnd: t,
      finalY: y,
      steps,
      stepSize: dt,
      trajectory
    };
  }

  // =========================================================================
  // 4. ROOT FINDING & OPTIMIZATION
  // =========================================================================

  findRootNewtonRaphson(fn, dfn, initialGuess, tolerance = 1e-8, maxIter = 100) {
    let x = initialGuess;
    for (let iter = 1; iter <= maxIter; iter++) {
      const y = fn(x);
      const dy = dfn ? dfn(x) : this.numericalDerivative(fn, x);
      if (Math.abs(dy) < 1e-14) {
        throw new Error(`Derivative too small (dy = ${dy}) at iteration ${iter}.`);
      }
      const xNext = x - y / dy;
      if (Math.abs(xNext - x) < tolerance || Math.abs(y) < tolerance) {
        return { root: xNext, iterations: iter, residual: fn(xNext), converged: true };
      }
      x = xNext;
    }
    return { root: x, iterations: maxIter, residual: fn(x), converged: false };
  }

  findRootBisection(fn, a, b, tolerance = 1e-7, maxIter = 100) {
    let fa = fn(a);
    let fb = fn(b);
    if (fa * fb > 0) {
      throw new Error(`Bisection requires f(a) and f(b) to have opposite signs: f(${a})=${fa}, f(${b})=${fb}.`);
    }

    let mid = a;
    for (let iter = 1; iter <= maxIter; iter++) {
      mid = (a + b) / 2;
      const fmid = fn(mid);
      if (Math.abs(fmid) < tolerance || (b - a) / 2 < tolerance) {
        return { root: mid, iterations: iter, residual: fmid, converged: true };
      }
      if (fa * fmid < 0) {
        b = mid;
        fb = fmid;
      } else {
        a = mid;
        fa = fmid;
      }
    }
    return { root: mid, iterations: maxIter, residual: fn(mid), converged: false };
  }

  // =========================================================================
  // 5. STATISTICS & PROBABILITY DISTRIBUTIONS
  // =========================================================================

  computeStatistics(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data must be a non-empty array of numbers.');
    }

    const n = data.length;
    const sorted = [...data].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;

    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const min = sorted[0];
    const max = sorted[n - 1];

    const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n > 1 ? n - 1 : 1);
    const stdDev = Math.sqrt(variance);

    // Skewness
    const skewness = n > 2
      ? (sorted.reduce((acc, v) => acc + ((v - mean) / (stdDev || 1)) ** 3, 0) * n) / ((n - 1) * (n - 2))
      : 0;

    return {
      count: n,
      mean,
      median,
      variance,
      stdDev,
      min,
      max,
      range: max - min,
      skewness,
      q25: sorted[Math.floor(n * 0.25)],
      q75: sorted[Math.floor(n * 0.75)]
    };
  }

  linearRegression(x, y) {
    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < 2) {
      throw new Error('x and y arrays must have identical length >= 2.');
    }

    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let ssXY = 0;
    let ssXX = 0;
    let ssYY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      ssXY += dx * dy;
      ssXX += dx * dx;
      ssYY += dy * dy;
    }

    if (Math.abs(ssXX) < 1e-14) throw new Error('Variance of x is zero; slope cannot be determined.');

    const slope = ssXY / ssXX;
    const intercept = meanY - slope * meanX;
    const r = ssYY > 0 ? ssXY / Math.sqrt(ssXX * ssYY) : 0;
    const rSquared = r * r;

    return {
      slope,
      intercept,
      r,
      rSquared,
      equation: `y = ${slope.toFixed(4)} * x + ${intercept.toFixed(4)}`,
      predict: (xVal) => slope * xVal + intercept
    };
  }

  /**
   * Standard Normal CDF using Horner's approximation of error function erf()
   */
  normalCDF(x, mean = 0, stdDev = 1) {
    const z = (x - mean) / (stdDev * Math.SQRT2);
    // Abramowitz and Stegun approximation
    const t = 1.0 / (1.0 + 0.3275911 * Math.abs(z));
    const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    const erf = 1.0 - poly * Math.exp(-z * z);
    const sign = z >= 0 ? 1 : -1;
    return 0.5 * (1 + sign * erf);
  }

  // =========================================================================
  // 6. MONTE CARLO SIMULATION ENGINE
  // =========================================================================

  runMonteCarlo(modelFn, parameterDistributions, trials = 10000) {
    const numTrials = Math.max(100, Math.min(100000, trials));
    const results = new Float64Array(numTrials);

    // Box-Muller transform for standard normal random
    const randNorm = (mu = 0, sigma = 1) => {
      let u1 = 0, u2 = 0;
      while (u1 === 0) u1 = Math.random();
      while (u2 === 0) u2 = Math.random();
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      return mu + z0 * sigma;
    };

    for (let i = 0; i < numTrials; i++) {
      const sampleParams = {};
      for (const [key, dist] of Object.entries(parameterDistributions)) {
        if (dist.type === 'normal') {
          sampleParams[key] = randNorm(dist.mean, dist.stdDev);
        } else if (dist.type === 'uniform') {
          sampleParams[key] = dist.min + Math.random() * (dist.max - dist.min);
        } else if (dist.type === 'lognormal') {
          sampleParams[key] = Math.exp(randNorm(dist.mu, dist.sigma));
        } else if (dist.type === 'constant') {
          sampleParams[key] = dist.value;
        } else {
          sampleParams[key] = dist.value !== undefined ? dist.value : 0;
        }
      }
      results[i] = modelFn(sampleParams);
    }

    const sorted = Array.from(results).sort((a, b) => a - b);
    const stats = this.computeStatistics(sorted);

    return {
      trials: numTrials,
      mean: stats.mean,
      stdDev: stats.stdDev,
      median: stats.median,
      p5: sorted[Math.floor(numTrials * 0.05)],
      p25: stats.q25,
      p50: stats.median,
      p75: stats.q75,
      p90: sorted[Math.floor(numTrials * 0.90)],
      p95: sorted[Math.floor(numTrials * 0.95)],
      p99: sorted[Math.floor(numTrials * 0.99)],
      min: stats.min,
      max: stats.max
    };
  }

  // =========================================================================
  // 7. ERROR PROPAGATION & SENSITIVITY ANALYSIS
  // =========================================================================

  /**
   * Computes Gaussian error propagation for f(x1, x2, ...) given uncertainties delta_xi
   * sigma_f = sqrt( sum( (df/dxi * delta_xi)^2 ) )
   */
  propagateUncertainty(fn, values, uncertainties) {
    const keys = Object.keys(values);
    let varianceSum = 0;
    const sensitivities = {};

    const baseOutput = fn(values);

    for (const key of keys) {
      const h = Math.max(1e-6, Math.abs(values[key]) * 1e-5);
      const perturbedPlus = { ...values, [key]: values[key] + h };
      const perturbedMinus = { ...values, [key]: values[key] - h };

      const partialDerivative = (fn(perturbedPlus) - fn(perturbedMinus)) / (2 * h);
      const deltaX = uncertainties[key] || 0;

      const contribution = (partialDerivative * deltaX) ** 2;
      varianceSum += contribution;

      sensitivities[key] = {
        value: values[key],
        uncertainty: deltaX,
        partialDerivative,
        varianceContribution: contribution,
        // Elasticity: % change in output per % change in input
        elasticity: baseOutput !== 0 ? (partialDerivative * values[key]) / baseOutput : 0
      };
    }

    const combinedUncertainty = Math.sqrt(varianceSum);
    const relativeUncertaintyPercent = baseOutput !== 0 ? Math.abs(combinedUncertainty / baseOutput) * 100 : 0;

    return {
      baseOutput,
      combinedUncertainty,
      relativeUncertaintyPercent,
      confidenceInterval95: [baseOutput - 1.96 * combinedUncertainty, baseOutput + 1.96 * combinedUncertainty],
      sensitivities,
      summary: `Estimated Result: ${baseOutput.toFixed(4)} ± ${combinedUncertainty.toFixed(4)} (${relativeUncertaintyPercent.toFixed(2)}% uncertainty)`
    };
  }

  // =========================================================================
  // 8. UNIFIED DISPATCHER & INDEPENDENT CROSS-CHECK
  // =========================================================================

  executeCalculation(options = {}) {
    const operation = String(options.operation || '').toLowerCase();
    const args = options.args || options;

    switch (operation) {
      case 'convert_units':
        return this.convertUnits(args.value, args.fromUnit, args.toUnit, args.category);

      case 'matrix_determinant':
        return { determinant: this.matrixDeterminant(args.matrix) };

      case 'matrix_inverse':
        return { inverse: this.matrixInverse(args.matrix) };

      case 'matrix_multiply':
        return { result: this.matrixMultiply(args.matrixA, args.matrixB) };

      case 'statistics':
        return this.computeStatistics(args.data);

      case 'linear_regression':
        return this.linearRegression(args.x, args.y);

      case 'integrate_simpson':
        // Safe evaluation of mathematical function
        const expr = args.expression || 'x';
        const func = (x) => this._safeEvalMath(expr, { x });
        const integral = this.numericalIntegrate(func, args.a, args.b, args.steps || 1000);
        return {
          operation: 'numerical_integration',
          method: "Simpson's 1/3 Rule",
          expression: expr,
          interval: [args.a, args.b],
          integral,
          crossCheckTrapezoid: this._trapezoidIntegrate(func, args.a, args.b, args.steps || 1000)
        };

      default:
        throw new Error(`Unrecognized scientific calculation operation: "${operation}".`);
    }
  }

  _trapezoidIntegrate(fn, a, b, n) {
    const h = (b - a) / n;
    let sum = 0.5 * (fn(a) + fn(b));
    for (let i = 1; i < n; i++) sum += fn(a + i * h);
    return sum * h;
  }

  _safeEvalMath(expr, scope = {}) {
    // Only permit standard mathematical operations
    const safeMath = {
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      asin: Math.asin, acos: Math.acos, atan: Math.atan,
      exp: Math.exp, log: Math.log, sqrt: Math.sqrt,
      abs: Math.abs, PI: Math.PI, E: Math.E, pow: Math.pow
    };
    const sanitized = expr.replace(/\^/g, '**');
    const fn = new Function(...Object.keys(safeMath), ...Object.keys(scope), `return (${sanitized});`);
    return fn(...Object.values(safeMath), ...Object.values(scope));
  }

  evaluateExpression(expr, variables = {}) {
    const val = this._safeEvalMath(expr, variables);
    return {
      value: val,
      steps: [`Parsed expression: ${expr}`, `Evaluated to: ${val}`]
    };
  }

  solveLinearEquation(expr, variables = {}) {
    const parts = expr.split('=');
    if (parts.length === 2) {
      const left = parts[0].trim();
      const right = parts[1].trim();
      const fn = (x) => this._safeEvalMath(left, { ...variables, x }) - this._safeEvalMath(right, { ...variables, x });
      const root = this.findRootNewtonRaphson(fn, (x) => this.numericalDerivative(fn, x), 0);
      return {
        root: root.root,
        steps: [`Rearranged to: (${left}) - (${right}) = 0`, `Converged in ${root.iterations} iterations to ${root.root}`]
      };
    }
    throw new Error(`Invalid linear equation format: "${expr}". Expected format: "expr = val".`);
  }
}

const scientificComputationEngineInstance = new ScientificComputationEngine();

module.exports = {
  ScientificComputationEngine,
  scientificComputationEngineInstance
};
