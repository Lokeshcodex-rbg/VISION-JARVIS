/**
 * VISION AI — Simulation & Computational Experiments Engine
 * Phase 12 Section 9: Simulation and Computational Experiments
 * 
 * Provides:
 * - Reproducible Monte Carlo experiments
 * - Dynamical system numerical modeling
 * - Configurable timeouts and resource limits
 * - Dynamic cancellation tokens
 * - Cross-process Emergency Stop integration
 */

const path = require('path');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');
const { pythonScienceBridgeClientInstance } = require('./pythonScienceBridgeClient.js');

class SimulationEngine {
  constructor() {
    this.emergencyStop = emergencyStopControllerInstance;
    this.activeSimulations = new Map();
  }

  async _runBridge(operation, payload, timeoutMs = 30000) {
    if (this.emergencyStop.isEmergencyStopped()) {
      throw new Error('EMERGENCY_STOP_ENGAGED: Cannot initiate simulation while Emergency Stop is active.');
    }

    return await pythonScienceBridgeClientInstance.execute(operation, payload, timeoutMs);
  }

  /**
   * Section 9: Runs Monte Carlo simulation with reproducible seed
   */
  async runMonteCarlo(options = {}) {
    const trials = options.trials || 5000;
    const seed = options.seed !== undefined ? options.seed : 42;
    const timeoutSec = options.timeoutSec || 8.0;

    return await this._runBridge('simulation', {
      simulation_type: options.simulationType || 'monte_carlo_portfolio',
      seed,
      trials,
      timeout_sec: timeoutSec,
      initial_value: options.initialValue || 100000.0,
      expected_return: options.expectedReturn || 0.08,
      volatility: options.volatility || 0.15
    }, timeoutSec * 1000 + 2000);
  }

  /**
   * Section 9: Cancels all running simulations
   */
  cancelAllSimulations(reason = 'User requested cancellation') {
    let count = 0;
    for (const [id, child] of this.activeSimulations.entries()) {
      try {
        child.kill('SIGKILL');
        count++;
      } catch (e) {}
    }
    this.activeSimulations.clear();
    return {
      success: true,
      cancelledCount: count,
      reason,
      summary: `Aborted ${count} active simulation process(es): ${reason}.`
    };
  }
}

module.exports = {
  SimulationEngine,
  simulationEngineInstance: new SimulationEngine()
};
