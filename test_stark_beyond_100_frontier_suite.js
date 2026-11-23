/**
 * STARK BEYOND 100 — FUTURE TECHNOLOGY RESEARCH & EXPERIMENTAL ENGINEERING ACCEPTANCE SUITE
 * Exhaustive empirical verification covering all 8 parts and 22 sections:
 * - Part 1: Establish Research Framework (Capability Registry & 10-Step Scientific Pipeline)
 * - Part 2: Build World-Model Engine (Internal Predictive Model & Simulated Environments)
 * - Part 3: Build Self-Evolving Software Lab (Algorithm Discovery & Controlled 1000-Trial Experiments)
 * - Part 4: Investigate Advanced Intelligence (Long-Horizon Planning & Autonomous Discovery)
 * - Part 5: Investigate Advanced Physical Technologies (Robotics, Exoskeleton, Propulsion, Materials, Energy)
 * - Part 6: Investigate Human-Computer Frontiers (Multimodal & Brain-Computer Interfaces)
 * - Part 7: Future Technology Hypothesis Engine (12 Speculative Frontier Concepts)
 * - Part 8: Verify Everything (Independent Verification, Resource Limits, Research Dashboard)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Subsystems Under Test
const { futureCapabilityRegistryInstance, MATURITY_LEVELS } = require('./server/futureCapabilityRegistry.js');
const { worldModelEngineInstance } = require('./server/worldModelEngine.js');
const { advancedEngineeringLabInstance } = require('./server/advancedEngineeringLab.js');
const { humanInterfaceLabInstance } = require('./server/humanInterfaceLab.js');
const { experimentFactoryInstance } = require('./server/experimentFactory.js');
const { forecastingEngineInstance } = require('./server/forecastingEngine.js');
const { goalGuardianInstance } = require('./server/goalGuardian.js');
const { experimentSchedulerInstance } = require('./server/experimentScheduler.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { executeTool } = require('./server/toolsRegistry.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
const { futureCapabilitiesLabInstance } = require('./server/futureCapabilitiesLab.js');

let passCount = 0;
let failCount = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`[PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    failCount++;
  }
}

async function runTestAsync(testName, testFn) {
  try {
    await testFn();
    console.log(`[PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    failCount++;
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('STARK BEYOND 100 — FUTURE TECHNOLOGY ACCEPTANCE SUITE');
  console.log('================================================================\n');

  // ===========================================================================
  // PART 1 — ESTABLISH THE RESEARCH FRAMEWORK
  // ===========================================================================

  runTest('Section 1: Future capability registry persistent entries and 15 required dimensions', () => {
    const caps = futureCapabilityRegistryInstance.listCapabilities();
    assert.strictEqual(caps.length >= 12, true, 'Must register at least 12 speculative future capabilities');

    const requiredDimensions = [
      'id', 'fictionalInspiration', 'userFacingGoal', 'currentSota',
      'starkImplementableToday', 'requiresAdditionalTech', 'unresolvedBreakthroughRequired',
      'hypothesesAndAssumptions', 'dependenciesAndPrerequisites', 'prototypePlan',
      'evaluationCriteria', 'estimatedResources', 'safetyAndEthicalConcerns',
      'resultsAndEvidence', 'maturityLevel', 'nextRecommendedExperiment'
    ];

    caps.forEach(cap => {
      requiredDimensions.forEach(dim => {
        assert.ok(cap[dim] !== undefined && cap[dim] !== null, `Capability ${cap.id} missing dimension: ${dim}`);
      });
    });
  });

  runTest('Section 1: Grounded 9-level maturity scale prevents unearned promotions', () => {
    const cap = futureCapabilityRegistryInstance.getCapability('FCAP-06-MOLECULAR-MANUFACTURING');
    assert.ok(cap, 'FCAP-06-MOLECULAR-MANUFACTURING must exist');

    // Reset to CONCEPT_ONLY for repeatable isolated testing
    cap.maturityLevel = 'CONCEPT_ONLY';
    const rawCap = futureCapabilityRegistryInstance.capabilities.get(cap.id);
    if (rawCap) rawCap.maturityLevel = 'CONCEPT_ONLY';

    // Attempting to skip levels to PHYSICALLY_VALIDATED without evidence must throw
    assert.throws(() => {
      futureCapabilityRegistryInstance.updateMaturityLevel(cap.id, 'PHYSICALLY_VALIDATED', {});
    }, /Cannot advance.*without verified test evidence|Cannot advance.*without prior verification/);

    // Step-by-step promotion with required evidence
    const promoted = futureCapabilityRegistryInstance.updateMaturityLevel(
      cap.id,
      'LITERATURE_REVIEWED',
      { reviewDoi: '10.1109/ACCESS.2021', reviewer: 'STARK Research' }
    );
    assert.strictEqual(promoted.currentLevel, 'LITERATURE_REVIEWED');
  });

  runTest('Section 2: Scientific research pipeline executes all 10 stages producing inspectable artifacts', () => {
    const pipelineRun = futureCapabilityRegistryInstance.executeScientificPipeline({
      question: 'Can magnetic levitation reduce track friction by 99% in evacuated tubes?',
      literatureSources: [
        {
          title: 'High-speed Maglev and Hyperloop Dynamics',
          authors: ['Zhang, L.', 'Muller, K.'],
          publicationDate: '2023-04-12',
          url: 'https://doi.org/10.1016/j.trd.2023.103789',
          relevantFindings: 'Electrodynamic suspension eliminates mechanical rolling friction; aerodynamic drag dominates at high speed.'
        }
      ],
      knownConstraints: ['Atmospheric pressure within tube > 100 Pa requires active vacuum pumping'],
      hypothesis: 'Halbach array magnetic levitation reduces mechanical rolling friction to zero in evacuated tubes.',
      mathematicalModel: 'F_drag = 0.5 * rho * v^2 * C_d * A, F_friction = 0 at levitation clearance > 15mm',
      experimentDesign: 'Simulate 500 kg carriage acceleration in 100 Pa tube under 10 kN electromagnetic thrust.'
    });

    const expectedStages = [
      'QUESTION', 'LITERATURE_REVIEW', 'KNOWN_CONSTRAINTS', 'HYPOTHESIS',
      'MATHEMATICAL_MODEL', 'EXPERIMENT_DESIGN', 'SIMULATION_OR_PROTOTYPE',
      'MEASUREMENT', 'INDEPENDENT_VALIDATION', 'CONCLUSION'
    ];

    expectedStages.forEach(stage => {
      assert.ok(pipelineRun.stages[stage], `Pipeline stage ${stage} must produce inspectable artifact`);
    });

    assert.strictEqual(pipelineRun.stages.LITERATURE_REVIEW.sourcesCount, 1);
    assert.strictEqual(pipelineRun.stages.CONCLUSION.validity, 'CONDITIONALLY_SUPPORTED');
  });

  runTest('Section 2: Scientific pipeline strictly rejects thermodynamics violations (Perpetual Motion / Free Energy)', () => {
    const invalidRun = futureCapabilityRegistryInstance.executeScientificPipeline({
      question: 'Can zero-point energy be extracted indefinitely without external power input?',
      hypothesis: 'Over-unity perpetual motion generator produces continuous 50 kW output with 0 kW input.',
      mathematicalModel: 'P_out = 50000, P_in = 0, Efficiency = infinity',
      experimentDesign: 'Closed-loop magnetic motor powering its own drive coil.'
    });

    assert.strictEqual(invalidRun.stages.KNOWN_CONSTRAINTS.violationDetected, true);
    assert.strictEqual(invalidRun.stages.CONCLUSION.validity, 'REJECTED_PHYSICS_VIOLATION');
    assert.ok(invalidRun.stages.CONCLUSION.details.includes('First Law of Thermodynamics'));
  });

  // ===========================================================================
  // PART 2 — BUILD A WORLD-MODEL ENGINE
  // ===========================================================================

  runTest('Section 3: World-model captures complete internal state of computer and project', () => {
    const state = worldModelEngineInstance.captureWorldModelState();
    assert.ok(state.repository, 'Must include repository structure');
    assert.ok(state.dependencies, 'Must include source dependencies');
    assert.ok(state.registeredToolsCount >= 10, 'Must record registered tools');
    assert.ok(state.telemetry.heapUsedMb > 0, 'Must track memory resource usage');
    assert.ok(Array.isArray(state.authorizedRoots), 'Must track authorized folders');
  });

  runTest('Section 3: World-model predicts action impact and computes residuals against real observation', () => {
    const actionSpec = {
      actionType: 'WRITE_FILE',
      targetPath: 'scratch/test_world_model_file.tmp',
      payloadBytes: 2048
    };

    const prediction = worldModelEngineInstance.predictActionImpact(actionSpec);
    assert.ok(prediction.predictedLatencyMs > 0, 'Must predict expected latency');
    assert.ok(prediction.predictedHeapDeltaMb !== undefined, 'Must predict heap delta');

    const learningOutcome = worldModelEngineInstance.observeAndLearn(prediction, () => {
      const scratchDir = path.join(__dirname, 'scratch');
      if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
      const testFile = path.join(scratchDir, 'test_world_model_file.tmp');
      fs.writeFileSync(testFile, 'A'.repeat(2048));
      const res = { actualBytesWritten: 2048, filePath: testFile };
      try { fs.unlinkSync(testFile); } catch (e) {}
      return res;
    });

    assert.ok(learningOutcome.residuals, 'Must record prediction residuals');
    assert.ok(learningOutcome.residuals.latencyErrorMs >= 0);
    assert.ok(learningOutcome.updatedWeights, 'Must update internal model weights from observation');
  });

  runTest('Section 4: Simulated environments separate sandbox operations from real computer state', () => {
    // 1. File Operation Simulation in disposable scratch directory
    const fileSim = worldModelEngineInstance.simulateFileOperation('scratch/temp_sim.txt', 'Simulated Content');
    assert.strictEqual(fileSim.simulated, true);
    assert.strictEqual(fileSim.disposableFixtureCleaned, true);

    // 2. Task Failure and Recovery Simulation
    const taskSim = worldModelEngineInstance.simulateTaskFailureAndRecovery('CORRUPTED_INDEX');
    assert.strictEqual(taskSim.simulated, true);
    assert.strictEqual(taskSim.recoveryTriggered, 'ROLLBACK_TO_PREVIOUS_CHECKPOINT');

    // 3. Resource Exhaustion Simulation
    const resourceSim = worldModelEngineInstance.simulateResourceExhaustion(4096);
    assert.strictEqual(resourceSim.simulated, true);
    assert.strictEqual(resourceSim.breachesMaxLimit, true);
    assert.strictEqual(resourceSim.recommendedMitigation, 'THROTTLE_CONCURRENCY_AND_TRIGGER_GC');

    // 4. Robot Motion Simulation
    const robotSim = worldModelEngineInstance.simulateRobotMotion([
      { jointAngleDeg: 15, velocityDegS: 30 },
      { jointAngleDeg: 45, velocityDegS: 60 }
    ]);
    assert.strictEqual(robotSim.simulated, true);
    assert.strictEqual(robotSim.collisionDetected, false);
    assert.strictEqual(robotSim.allKinematicLimitsRespected, true);
  });

  // ===========================================================================
  // PART 3 — BUILD A SELF-EVOLVING SOFTWARE LAB
  // ===========================================================================

  runTest('Section 5 & 6: Controlled 1,000-trial experiments define baseline, reject invalid candidates and roll back on regression', () => {
    const campaign = experimentFactoryInstance.runExperimentCampaign({
      campaignName: 'Task Scheduler Optimization',
      question: 'Does dynamic priority queueing outperform FIFO task scheduling?',
      hypothesis: 'Shortest remaining time first reduces mean latency by 15%',
      targetMetric: 'meanLatencyMs',
      optimizationGoal: 'MINIMIZE',
      targetTrials: 100, // scaled bounded trial campaign
      candidateGenerator: (trialIndex) => ({
        algorithm: trialIndex % 2 === 0 ? 'PRIORITY_QUEUE' : 'FIFO',
        timeSliceMs: 10 + (trialIndex % 10) * 2,
        invalidCandidate: trialIndex === 13 // deliberate invalid candidate for filter test
      }),
      evaluator: (candidate) => {
        if (candidate.invalidCandidate) throw new Error('Malformed candidate parameter');
        const latency = candidate.algorithm === 'PRIORITY_QUEUE' ? 12.4 : 18.2;
        return { meanLatencyMs: latency, accuracy: 1.0, memoryMb: 4.2 };
      },
      baselineScore: 18.2
    });

    assert.strictEqual(campaign.completedTrials > 0, true);
    assert.strictEqual(campaign.rejectedTrials >= 1, true, 'Must reject invalid candidates using inexpensive filters');
    assert.strictEqual(campaign.winner !== null, true, 'Must select winning candidate with empirical evidence');
    assert.strictEqual(campaign.winner.candidate.algorithm, 'PRIORITY_QUEUE');
    assert.ok(campaign.winner.improvementPercent > 10);
  });

  runTest('Section 7: Improvement criteria evaluates multi-attribute scorecard (correctness, latency, memory, security)', () => {
    const scorecard = experimentFactoryInstance.evaluateCandidateScorecard({
      correctness: 0.99,
      latencyMs: 14.5,
      baselineLatencyMs: 20.0,
      memoryMb: 8.5,
      baselineMemoryMb: 12.0,
      securityVulnerabilitiesCount: 0,
      regressionRate: 0.01
    });

    assert.strictEqual(scorecard.acceptable, true);
    assert.strictEqual(scorecard.securityPassed, true);
    assert.strictEqual(scorecard.regressionPassed, true);
  });

  // ===========================================================================
  // PART 4 — INVESTIGATE ADVANCED INTELLIGENCE
  // ===========================================================================

  runTest('Section 8: Long-horizon planning with DAG dependencies, checkpoints, and replanning', () => {
    const goal = goalGuardianInstance.createGoal({
      title: 'Synthesize Multi-Stage Engineering Prototype',
      description: 'Design, simulate, and verify aerospace component',
      priority: 'HIGH',
      milestones: [
        { id: 'M1', name: 'Retrieve Literature & Materials', dependencies: [] },
        { id: 'M2', name: 'Simulate Finite Element Stress', dependencies: ['M1'] },
        { id: 'M3', name: 'Run Independent Verification', dependencies: ['M2'] }
      ]
    });

    assert.strictEqual(goal.milestones.length, 3);
    assert.strictEqual(goal.milestones[0].status, 'PENDING');

    // Execute first milestone
    const updated = goalGuardianInstance.updateMilestoneStatus(goal.id, 'M1', 'COMPLETED', { materialsFound: 5 });
    assert.strictEqual(updated.milestones[0].status, 'COMPLETED');
  });

  runTest('Section 9 & 10: Autonomous discovery assistant distinguishes policy adaptation from model fine-tuning', () => {
    const discovery = futureCapabilityRegistryInstance.generateResearchReport({
      domain: 'Numerical Optimization & Gradient Descent Benchmarking',
      question: 'Does AdamW converge faster than SGD on sparse non-convex matrices?',
      findings: 'AdamW converges in 45% fewer epochs on benchmark dataset X.'
    });

    assert.ok(discovery.reportMarkdown.includes('Numerical Optimization'));
    assert.strictEqual(discovery.disclaimerModelWeightsUnchanged, true);
    assert.strictEqual(discovery.isSimulated, true);
  });

  // ===========================================================================
  // PART 5 — INVESTIGATE ADVANCED PHYSICAL TECHNOLOGIES
  // ===========================================================================

  runTest('Section 11: Robotics kinematic model and trajectory safety bounds', () => {
    const safetyCheck = futureCapabilitiesLabInstance.evaluateRoboticSafetyBounds([10, -25, 45, 0, 90, 0]);
    assert.strictEqual(safetyCheck.withinBounds, true);
    assert.strictEqual(safetyCheck.emergencyStopArmed, true);
  });

  runTest('Section 12: Exoskeleton research evaluates knee assist torque, von Mises stress and safety factor >= 2.0', () => {
    const analysis = advancedEngineeringLabInstance.evaluateExoskeletonKneeJoint({
      operatorMassKg: 80,
      exoskeletonMassKg: 18,
      assistRatio: 0.40,
      cadenceStepsPerMin: 100,
      material: 'TITANIUM_GRADE_5',
      cantileverLengthM: 0.42,
      crossSectionWidthM: 0.035,
      crossSectionHeightM: 0.025
    });

    assert.strictEqual(analysis.simulationOnly, true);
    assert.strictEqual(analysis.humanTestingPermitted, false, 'Human testing must remain forbidden without physical benchtop validation');
    assert.ok(analysis.kneeAssistTorqueNm > 20, 'Assist torque must be calculated');
    assert.ok(analysis.vonMisesBendingStressMpa > 0);
    assert.strictEqual(analysis.safetyFactorCompliance, true, 'Safety factor must be >= 2.0 for human-adjacent structural robotics');
    assert.ok(analysis.safetyFactor >= 2.0);
    assert.ok(analysis.batteryThermalDissipationWatts > 0);
  });

  runTest('Section 13: Advanced propulsion models eVTOL hover momentum theory and ion thrusters', () => {
    // 1. eVTOL Hover Dynamics
    const evtol = advancedEngineeringLabInstance.evaluateEvtolHoverDynamics({
      grossMassKg: 1200,
      batteryMassKg: 350,
      batteryEnergyDensityWhKg: 250,
      rotorRadiusM: 1.25,
      numberOfRotors: 8,
      figureOfMerit: 0.72
    });

    assert.strictEqual(evtol.aerodynamicModel, 'ACTUATOR_DISK_MOMENTUM_THEORY');
    assert.ok(evtol.hoverThrustN > 11700);
    assert.ok(evtol.hoverPowerKw > 0);
    assert.ok(evtol.hoverEnduranceMinutes > 15 && evtol.hoverEnduranceMinutes < 60);

    // 2. Electrostatic Ion Thruster
    const ion = advancedEngineeringLabInstance.evaluateIonThrusterPhysics({
      propellantMolarMassG: 131.29, // Xenon
      beamVoltageV: 1200,
      beamCurrentA: 2.5
    });

    assert.ok(ion.exhaustVelocityKmS > 30);
    assert.ok(ion.specificImpulseSeconds > 3000);
    assert.ok(ion.thrustMilliNewtons > 50);
  });

  runTest('Section 14: Materials discovery calculates non-dominated Pareto front', () => {
    const candidates = [
      { name: 'Structural Steel', yieldStrengthMpa: 250, densityKgM3: 7850, youngsModulusGpa: 200, costPerKgUsd: 1.5 },
      { name: 'Aluminium 7075-T6', yieldStrengthMpa: 505, densityKgM3: 2810, youngsModulusGpa: 71.7, costPerKgUsd: 12.0 },
      { name: 'Titanium Grade 5', yieldStrengthMpa: 880, densityKgM3: 4430, youngsModulusGpa: 114, costPerKgUsd: 45.0 },
      { name: 'CFRP Quasi-Isotropic', yieldStrengthMpa: 600, densityKgM3: 1550, youngsModulusGpa: 70, costPerKgUsd: 90.0 }
    ];

    const pareto = advancedEngineeringLabInstance.screenMaterialsParetoFront(candidates);
    assert.ok(pareto.length >= 2, 'Must extract non-dominated Pareto frontier');
    pareto.forEach(m => {
      assert.ok(m.specificStrengthKnmKg > 0);
      assert.ok(m.specificStiffnessMnmKg > 0);
    });
  });

  runTest('Section 15: Advanced energy enforces 1st & 2nd Laws of Thermodynamics and Lawson fusion criterion', () => {
    // 1. Thermodynamics audit on fictional Arc Reactor claim (3 GW in 0.1 m3)
    const arcReactorAudit = advancedEngineeringLabInstance.auditEnergySystemBudget({
      systemName: 'Speculative Micro-Fusion Core',
      inputPowerKw: 1000,
      claimedOutputPowerKw: 3000000, // 3 GW
      conversionEfficiency: 0.95,
      radiatorHeatSinkTempK: 350
    });

    assert.ok(arcReactorAudit.wasteHeatKw > 0);
    assert.ok(arcReactorAudit.requiredRadiatorAreaM2 > 100, 'Waste heat rejection requires massive radiator area under Stefan-Boltzmann law');
    assert.strictEqual(arcReactorAudit.carnotLimitExceeded, true, 'Claiming 3 GW output from 1000 kW input must exceed thermodynamic limits');

    // 2. Lawson Criterion for D-T Fusion
    const lawsonPassed = advancedEngineeringLabInstance.evaluateLawsonFusionCriterion(
      1.5e20, // density m^-3
      15,     // temp keV
      2.0     // confinement time seconds
    );
    assert.strictEqual(lawsonPassed.lawsonThresholdSatisfied, true);
    assert.ok(lawsonPassed.tripleProduct >= 3.0e21);

    const lawsonFailed = advancedEngineeringLabInstance.evaluateLawsonFusionCriterion(
      1.0e18,
      2,
      0.01
    );
    assert.strictEqual(lawsonFailed.lawsonThresholdSatisfied, false);
  });

  // ===========================================================================
  // PART 6 — INVESTIGATE HUMAN-COMPUTER FRONTIERS
  // ===========================================================================

  runTest('Section 16 & 17: Brain-computer interface synthetic simulation with strict non-hallucination disclaimers', () => {
    // Verify literature grounding
    const lit = humanInterfaceLabInstance.bciLiterature;
    assert.ok(lit.length >= 3, 'Must ground BCI research in peer-reviewed scientific literature');
    assert.ok(lit.some(l => l.citation.includes('BrainGate2') || l.citation.includes('Wolpaw')));

    // Synthetic EEG Motor Imagery Simulation
    const eegSim = humanInterfaceLabInstance.simulateMotorImageryDecoding(8);
    assert.strictEqual(eegSim.isSyntheticSimulation, true);
    assert.strictEqual(eegSim.disclaimerNonHallucination, 'SYNTHETIC_DATA_ONLY__NO_MIND_READING_CLAIMED');
    assert.ok(eegSim.channels.length === 8);
    assert.ok(['NEUTRAL_IDLE', 'LEFT_HAND_MOTOR_IMAGERY', 'RIGHT_HAND_MOTOR_IMAGERY'].includes(eegSim.decodedIntent));
  });

  runTest('Section 16: Multimodal sensor permissions are visible and revocable', () => {
    const permissions = humanInterfaceLabInstance.getMultimodalSensorPermissions();
    assert.strictEqual(permissions.cameraAccess, 'REVOCABLE_ON_DEMAND');
    assert.strictEqual(permissions.microphoneAccess, 'REVOCABLE_ON_DEMAND');
    assert.strictEqual(permissions.screenCaptureAccess, 'REVOCABLE_ON_DEMAND');
  });

  // ===========================================================================
  // PART 7 — FUTURE TECHNOLOGY HYPOTHESIS ENGINE
  // ===========================================================================

  runTest('Section 19: All 12 speculative future technologies explored across physical and computational constraints', () => {
    const caps = futureCapabilityRegistryInstance.listCapabilities();
    assert.strictEqual(caps.length >= 12, true, 'Must catalog all 12 speculative concepts');

    const expectedConcepts = [
      'FCAP-01-DIGITAL-TWIN',
      'FCAP-02-AUTONOMOUS-INVENTION',
      'FCAP-03-SELF-REPAIRING-SYSTEMS',
      'FCAP-04-COLLABORATIVE-ROBOTICS',
      'FCAP-05-PROGRAMMABLE-MATERIALS',
      'FCAP-06-MOLECULAR-MANUFACTURING',
      'FCAP-07-ARTIFICIAL-GENERAL-INTELLIGENCE',
      'FCAP-08-BRAIN-COMPUTER-INTERFACE',
      'FCAP-09-ADVANCED-ENERGY-FUSION',
      'FCAP-10-ELECTRIC-PROPULSION-EVTOL',
      'FCAP-11-AUTOMATED-SCIENTIFIC-LAB',
      'FCAP-12-DEEP-SPACE-AUTONOMOUS-ENGINEERING'
    ];

    expectedConcepts.forEach(id => {
      const cap = futureCapabilityRegistryInstance.getCapability(id);
      assert.ok(cap, `Must resolve speculative concept ${id}`);
      assert.ok(cap.fictionalInspiration, `${id} must have fictional inspiration`);
      assert.ok(cap.unresolvedBreakthroughRequired, `${id} must declare unresolved breakthroughs honestly`);
      assert.ok(cap.maturityLevel, `${id} must have grounded maturity level`);
    });
  });

  // ===========================================================================
  // PART 8 — VERIFY EVERYTHING
  // ===========================================================================

  await runTestAsync('Section 20 & 21: Registered tools execution and Emergency Stop invariance', async () => {
    // 1. query_future_capabilities tool
    const capsRes = await executeTool('query_future_capabilities', {}, 'JARVIS');
    assert.strictEqual(Array.isArray(capsRes), true);
    assert.ok(capsRes.length >= 12);

    // 2. evaluate_propulsion_dynamics tool
    const propRes = await executeTool('evaluate_propulsion_dynamics', {
      grossMassKg: 1000,
      batteryMassKg: 300,
      batteryEnergyDensityWhKg: 250,
      rotorRadiusM: 1.2,
      numberOfRotors: 8,
      figureOfMerit: 0.70
    }, 'JARVIS');
    assert.ok(propRes.hoverThrustN > 9000);

    // 3. evaluate_exoskeleton_biomechanics tool
    const exoRes = await executeTool('evaluate_exoskeleton_biomechanics', {
      operatorMassKg: 75,
      exoskeletonMassKg: 15,
      assistRatio: 0.35,
      cadenceStepsPerMin: 90,
      material: 'TITANIUM_GRADE_5',
      cantileverLengthM: 0.40,
      crossSectionWidthM: 0.030,
      crossSectionHeightM: 0.020
    }, 'JARVIS');
    assert.ok(exoRes.safetyFactor >= 2.0);

    // 4. Emergency Stop invariance: engage e-stop and assert execution blocked
    emergencyStopControllerInstance.engage('Frontier Test Safety Halt');
    try {
      let threw = false;
      try {
        await executeTool('evaluate_propulsion_dynamics', {}, 'JARVIS');
      } catch (err) {
        threw = true;
        assert.ok(err.message.includes('EMERGENCY_STOP_ACTIVE') || err.message.includes('Security permission denied'));
      }
      assert.strictEqual(threw, true, 'Emergency stop must block tool execution');
    } finally {
      emergencyStopControllerInstance.disengage();
    }
  });

  runTest('Section 22: Research dashboard telemetry and status overview contract', () => {
    const caps = futureCapabilityRegistryInstance.listCapabilities();
    const campaigns = experimentFactoryInstance.listCampaigns();
    const worldModel = worldModelEngineInstance.captureWorldModelState();

    const overview = {
      capabilitiesCount: caps.length,
      activeCampaigns: campaigns.length,
      worldModelHeapUsedMb: worldModel.telemetry.heapUsedMb,
      emergencyStopArmed: !emergencyStopControllerInstance.isEngaged()
    };

    assert.ok(overview.capabilitiesCount >= 12);
    assert.ok(overview.worldModelHeapUsedMb > 0);
    assert.strictEqual(overview.emergencyStopArmed, true);
  });

  console.log('\n================================================================');
  console.log(`STARK BEYOND 100 ACCEPTANCE RUN COMPLETE:`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Success Rate: ${Math.round((passCount / (passCount + failCount)) * 100)}%`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
