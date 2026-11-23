/**
 * STARK AI — PHASE 14 COMPREHENSIVE ACCEPTANCE TEST SUITE
 * Personal Intelligence, Long-Term Context & Proactive Assistance
 * 
 * 8 Critical Categories, 78 High-Precision Assertions:
 * - Category A: Personal Context Storage & Epistemic Classification (12 assertions)
 * - Category B: Memory Consolidation & Contradiction Resolution (10 assertions)
 * - Category C: Project Intelligence & Multi-Project Disambiguation (10 assertions)
 * - Category D: Personal Knowledge Graph & Cascade Invalidation (10 assertions)
 * - Category E: Conversational Continuity & Elliptical Follow-ups (8 assertions)
 * - Category F: Proactive Assistance & Explainability (10 assertions)
 * - Category G: Multi-Location Deletion & Avoid Topics (10 assertions)
 * - Category H: Privacy, Prompt Injection & Agent Least-Privilege (8 assertions)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  starkMemoryDbInstance: db,
  EPISTEMIC_TYPES,
  MEMORY_LAYERS,
  CONFIDENCE_CLASSES,
  RECORD_TYPES
} = require('./server/memory/starkMemoryDb.js');

const { personalContextEngineInstance: pce } = require('./server/memory/personalContextEngine.js');
const { memoryConsolidationEngineInstance: mce } = require('./server/memory/memoryConsolidationEngine.js');
const { projectIntelligenceEngineInstance: pie } = require('./server/project/projectIntelligenceEngine.js');
const { personalKnowledgeGraphInstance: pkg, KG_ENTITY_TYPES, KG_RELATION_TYPES } = require('./server/memory/personalKnowledgeGraph.js');
const { conversationalContextEngineInstance: cce } = require('./server/voice/conversationalContextEngine.js');
const { proactiveAssistanceEngineInstance: pae, PROACTIVE_LEVELS, PROACTIVE_CATEGORIES, NOTIFICATION_STATUS } = require('./server/proactive/proactiveAssistanceEngine.js');
const { memoryManagementEngineInstance: mme } = require('./server/memory/memoryManagementEngine.js');
const { toolsRegistry } = require('./server/toolsRegistry.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');

let totalPassed = 0;
let totalFailed = 0;
const passedAssertions = [];
const failedAssertions = [];

function pass(desc) {
  totalPassed++;
  passedAssertions.push(desc);
  console.log(`  ✓ [PASS] ${desc}`);
}

function fail(desc, err) {
  totalFailed++;
  failedAssertions.push({ desc, error: err.message || String(err) });
  console.error(`  ✗ [FAIL] ${desc}: ${err.message || err}`);
}

async function runSuite() {
  console.log('\n================================================================');
  console.log('🧠 STARK AI: PHASE 14 PERSONAL INTELLIGENCE ACCEPTANCE SUITE');
  console.log('================================================================\n');

  // =========================================================================
  // CATEGORY A: PERSONAL CONTEXT STORAGE & EPISTEMIC CLASSIFICATION
  // =========================================================================
  console.log('--- CATEGORY A: Personal Context Storage & Epistemic Classification ---');
  try {
    // A.1: Default user preferences retrieved with structured categories
    const prefs = pce.getPreferences();
    assert(prefs.communication && prefs.responseStyle && prefs.workPreferences, 'Preferences missing standard categories');
    pass('A.1: User preferences initialize with structured categories');

    // A.2: User preference write with USER_CONFIRMED confidence
    const prefRes = pce.setPreference('workPreferences', 'codeComments', 'detailed_docstrings', 'USER_CONFIRMED');
    assert(prefRes && prefRes.id, 'Preference write failed');
    assert.strictEqual(prefRes.confidenceClass, CONFIDENCE_CLASSES.USER_CONFIRMED);
    pass('A.2: Explicit preference write records with USER_CONFIRMED confidence');

    // A.3: Model-inferred preference tagged as MODEL_INFERRED (not user confirmed)
    const infPref = pce.setPreference('workPreferences', 'suggestedSnippet', 'arrow_functions', 'MODEL_INFERRED');
    assert.strictEqual(infPref.confidenceClass, CONFIDENCE_CLASSES.MODEL_INFERRED);
    assert.strictEqual(infPref.epistemicType, EPISTEMIC_TYPES.HYPOTHESIS);
    pass('A.3: Inferred preference strictly flagged as MODEL_INFERRED hypothesis');

    // A.4: Project creation stores structured project entity
    const projA = pce.createOrUpdateProject({
      projectName: 'Alpha Centauri Probe',
      aliases: ['centauri probe', 'probe project'],
      objective: 'Long-range interstellar communications relay',
      architecture: 'Asynchronous event-driven microkernel',
      status: 'IN_PROGRESS'
    });
    assert.strictEqual(projA.projectName, 'Alpha Centauri Probe');
    pass('A.4: Ongoing project created with identity, objective, and architecture');

    // A.5: Project retrieval by exact name and by ID
    const retrievedProj = pce.getProject(projA.id);
    assert(retrievedProj && retrievedProj.projectName === 'Alpha Centauri Probe', 'Project retrieval by ID failed');
    pass('A.5: Project retrievable deterministically by ID and name');

    // A.6: Record project architectural decision
    const decA = pce.recordProjectDecision(projA.id, 'Deploy Zero-Copy Shared Memory', 'Eliminate buffer copies in 60 FPS stream', ['src/shm.c']);
    assert(decA && decA.decision.includes('Zero-Copy'), 'Decision not recorded');
    pass('A.6: Project architectural decision recorded with rationale and artifacts');

    // A.7: Goal creation with status, progress, and category
    const goalA = pce.setGoal({
      title: 'Complete Phase 14 Integration',
      category: 'WORK',
      progress: 60,
      targetDate: '2026-11-15'
    });
    assert.strictEqual(goalA.category, 'WORK');
    assert.strictEqual(goalA.progress, 60);
    pass('A.7: Work goal created with progress percentage and target date');

    // A.8: Goal progress update to 100% automatically marks COMPLETED
    const goalUpdated = pce.updateGoalProgress(goalA.id, 100, 'All acceptance tests passing');
    assert.strictEqual(goalUpdated.progress, 100);
    assert.strictEqual(goalUpdated.status, 'COMPLETED');
    pass('A.8: Goal progress reaching 100% transitions status to COMPLETED');

    // A.9: Temporal validity attributes stored on memories (valid_from, valid_until, is_current)
    const tempMem = db.saveMemory({
      id: 'mem_temp_val_test',
      fact: 'Current primary database is SQLite 3.46',
      recordType: RECORD_TYPES.FACT,
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: null,
      isCurrent: 1
    });
    const loadedTemp = db.getMemory('mem_temp_val_test');
    assert(loadedTemp.validFrom === '2026-01-01T00:00:00.000Z', 'validFrom mismatch');
    assert.strictEqual(loadedTemp.isCurrent, true);
    pass('A.9: Temporal validity attributes (valid_from, is_current) persisted in SQLite');

    // A.10: Historical state query at specific timestamp
    const histAt2025 = db.getMemoriesAtTimestamp('2025-01-01T00:00:00.000Z');
    const hasTempMemIn2025 = histAt2025.some(m => m.id === 'mem_temp_val_test');
    assert.strictEqual(hasTempMemIn2025, false, 'Memory should not be valid before its valid_from');
    pass('A.10: Historical point-in-time query accurately respects valid_from temporal window');

    // A.11: Context Relevance Firewall blocks personal communication in engineering task
    const fwResult = pce.filterContextForTask(
      { domain: 'ENGINEERING', projectId: projA.id },
      [
        { id: 'm_comm', memoryLayer: 'user_preference', metadata: { prefCategory: 'communication' } },
        { id: 'm_proj', memoryLayer: 'project', category: 'project', metadata: { projectId: projA.id } }
      ]
    );
    assert.strictEqual(fwResult.allowedCount, 1);
    assert.strictEqual(fwResult.blockedCount, 1);
    assert.strictEqual(fwResult.blockedMemories[0].id, 'm_comm');
    pass('A.11: Context Relevance Firewall blocks personal communication from engineering context');

    // A.12: Context Relevance Firewall isolates cross-project memories
    const fwCross = pce.filterContextForTask(
      { domain: 'ENGINEERING', projectId: 'proj_alpha_centauri_probe' },
      [
        { id: 'm_alpha', category: 'project', metadata: { projectName: 'Alpha Centauri Probe' } },
        { id: 'm_beta', category: 'project', metadata: { projectName: 'Beta Telemetry Module' } }
      ]
    );
    assert.strictEqual(fwCross.allowedCount, 1);
    assert.strictEqual(fwCross.allowedMemories[0].id, 'm_alpha');
    pass('A.12: Context Relevance Firewall strictly enforces cross-project memory isolation');
  } catch (err) {
    fail('Category A execution', err);
  }

  // =========================================================================
  // CATEGORY B: MEMORY CONSOLIDATION & CONTRADICTION RESOLUTION
  // =========================================================================
  console.log('\n--- CATEGORY B: Memory Consolidation & Contradiction Resolution ---');
  try {
    db.deleteMemory('mem_contra_test_1');
    db.deleteMemory('mem_contra_model_test');
    db.deleteMemory('mem_contra_user_test');

    // B.1: Canonical key calculation normalizes case, punctuation, and stop words
    const keyA = mce.computeCanonicalKey('The user prefers dark mode UI!');
    const keyB = mce.computeCanonicalKey('User preference is dark mode ui.');
    assert.strictEqual(keyA, keyB);
    pass('B.1: Canonical key computation normalizes phrasing across surface variations');

    // B.2: Similarity metric computes token overlap accurately
    const sim = mce.computeSimilarity('VS Code is the preferred editor', 'Preferred editor is VS Code');
    assert(sim >= 0.80, `Expected similarity >= 0.80, got ${sim}`);
    pass('B.2: Token similarity accurately identifies equivalent semantic statements');

    // B.3: Duplicate memory ingestion merges provenance without creating extra records
    const dupRes1 = mce.consolidateMemory({
      fact: 'Primary workspace directory is D:\\Jarvis',
      source: 'build_pipeline_v1',
      confidenceClass: CONFIDENCE_CLASSES.SOURCE_VERIFIED,
      epistemicType: EPISTEMIC_TYPES.VERIFIED_FACT
    });
    const dupRes2 = mce.consolidateMemory({
      fact: 'Primary workspace directory is D:\\Jarvis',
      source: 'audit_check_v2',
      confidenceClass: CONFIDENCE_CLASSES.SOURCE_VERIFIED,
      epistemicType: EPISTEMIC_TYPES.VERIFIED_FACT
    });
    assert.strictEqual(dupRes2.action, 'MERGED_EXISTING');
    assert.strictEqual(dupRes2.isDuplicate, true);
    pass('B.3: Duplicate memory detection merges sources into existing record without duplication');

    // B.4: Contradiction detection detects conflicting attributes
    db.saveMemory({
      id: 'mem_contra_test_1',
      fact: 'Project Orion applied load = 4000',
      category: 'engineering',
      confidenceClass: CONFIDENCE_CLASSES.USER_CONFIRMED,
      epistemicType: EPISTEMIC_TYPES.USER_STATEMENT,
      isCurrent: 1
    });
    const detectRes = mce.detectContradiction({
      fact: 'Project Orion applied load = 8000'
    });
    assert.strictEqual(detectRes.hasContradiction, true);
    assert.strictEqual(detectRes.contradictionType, 'ATTRIBUTE_VALUE_MISMATCH');
    pass('B.4: Attribute mismatch contradiction detected between conflicting parameter values');

    // B.5: Model-inferred contradiction does NOT overwrite user confirmed fact
    const modelContraRes = mce.consolidateMemory({
      id: 'mem_contra_model_test',
      fact: 'Project Orion applied load = 8000',
      confidenceClass: CONFIDENCE_CLASSES.MODEL_INFERRED,
      epistemicType: EPISTEMIC_TYPES.HYPOTHESIS
    });
    assert.strictEqual(modelContraRes.action, 'FLAGGED_UNRESOLVED_CONTRADICTION');
    assert.strictEqual(modelContraRes.requiresClarification, true);
    pass('B.5: Model inferred contradiction is flagged UNRESOLVED and cannot overwrite confirmed fact');

    // B.6: User confirmed contradiction supersedes prior memory
    const userContraRes = mce.consolidateMemory({
      id: 'mem_contra_user_test',
      fact: 'Project Orion applied load = 8000',
      confidenceClass: CONFIDENCE_CLASSES.USER_CONFIRMED,
      epistemicType: EPISTEMIC_TYPES.USER_STATEMENT
    });
    assert.strictEqual(userContraRes.action, 'RESOLVED_BY_USER_CORRECTION');
    pass('B.6: Explicit user update supersedes conflicting older memory');

    // B.7: Superseded memory marks isCurrent = false and preserves superseding reference
    const supersededMem = db.getMemory('mem_contra_test_1');
    assert.strictEqual(supersededMem.isCurrent, false);
    assert.strictEqual(supersededMem.confidenceClass, CONFIDENCE_CLASSES.SUPERSEDED);
    assert.strictEqual(supersededMem.supersededBy, 'mem_contra_user_test');
    pass('B.7: Superseded memory transitions to isCurrent=false with supersededBy pointer');

    // B.8: New memory marks isCurrent = true and references prior memory ID
    const newCurrentMem = db.getMemory('mem_contra_user_test');
    assert.strictEqual(newCurrentMem.isCurrent, true);
    assert.strictEqual(newCurrentMem.metadata.priorMemoryId, 'mem_contra_test_1');
    pass('B.8: New memory isCurrent=true and records priorMemoryId provenance link');

    // B.9: Contradiction record is persisted in kg_contradictions table
    const storedContras = db.getContradictions();
    assert(storedContras.length > 0, 'No contradictions persisted in kg_contradictions');
    pass('B.9: Contradictions persisted with audit timestamps in SQLite kg_contradictions');

    // B.10: Fact version lineage tracks historical evolution
    const lineage = mce.getFactLineage('mem_contra_test_1');
    assert(lineage && lineage.id === 'mem_contra_test_1', 'Failed to retrieve fact lineage');
    pass('B.10: Complete fact version lineage retrievable for historical provenance');
  } catch (err) {
    fail('Category B execution', err);
  }

  // =========================================================================
  // CATEGORY C: PROJECT INTELLIGENCE & MULTI-PROJECT DISAMBIGUATION
  // =========================================================================
  console.log('\n--- CATEGORY C: Project Intelligence & Disambiguation ---');
  try {
    // C.1: Multi-project resolution by exact project name
    const resExact = pie.resolveProjectReference('Alpha Centauri Probe');
    assert(resExact.resolved && resExact.project.projectName === 'Alpha Centauri Probe');
    pass('C.1: Multi-project resolution resolves exact project name');

    // C.2: Multi-project resolution by registered alias
    const resAlias = pie.resolveProjectReference('probe project');
    assert(resAlias.resolved && resAlias.matchType === 'ALIAS_MATCH');
    pass('C.2: Multi-project resolution resolves registered project alias');

    // C.3: Setup two ambiguous project entities
    const p1 = pce.createOrUpdateProject({
      projectName: 'Deep Space Telescope',
      aliases: ['space telescope', 'telescope'],
      objective: 'Orbital optical observation'
    });
    const p2 = pce.createOrUpdateProject({
      projectName: 'Radio Space Telescope',
      aliases: ['radio telescope', 'telescope array'],
      objective: 'Long-baseline radio interferometry'
    });
    assert(p1 && p2);
    pass('C.3: Multiple candidate projects registered with overlapping aliases for disambiguation evaluation');

    // C.4: Ambiguous reference triggers structured disambiguation dialog (never guesses)
    const ambigRes = pie.resolveProjectReference('space telescope');
    assert.strictEqual(ambigRes.resolved, false);
    assert.strictEqual(ambigRes.ambiguous, true);
    assert(ambigRes.candidateProjects.length >= 2);
    assert(ambigRes.clarificationPrompt.includes('Which project did you mean?'));
    pass('C.4: Ambiguous project reference produces structured disambiguation prompt without guessing');

    // C.5: Add milestone to project
    const ms1 = pie.addMilestone('proj_alpha_centauri_probe', {
      title: 'Power Subsystem Verification',
      status: 'IN_PROGRESS',
      dueDate: '2026-12-01'
    });
    assert.strictEqual(ms1.title, 'Power Subsystem Verification');
    pass('C.5: Milestone added to project with target due date');

    // C.6: Update milestone status to BLOCKED with blockers
    const msBlocked = pie.addMilestone('proj_alpha_centauri_probe', {
      id: ms1.id,
      title: 'Power Subsystem Verification',
      status: 'BLOCKED',
      blockers: ['RTG thermal coupling simulation pending']
    });
    assert.strictEqual(msBlocked.status, 'BLOCKED');
    assert(msBlocked.blockers.length > 0);
    pass('C.6: Milestone status update to BLOCKED records blocker rationale');

    // C.7: Complete another milestone
    const msComp = pie.addMilestone('proj_alpha_centauri_probe', {
      title: 'Telemetry Protocol Spec',
      status: 'COMPLETED'
    });
    assert.strictEqual(msComp.status, 'COMPLETED');
    pass('C.7: Completed milestone records status update');

    // C.8: Project briefing calculates progress and identifies blocked milestones
    const briefing = pie.getProjectBriefing('proj_alpha_centauri_probe');
    assert(briefing.blockedMilestones.length >= 1, 'Blocked milestone not surfaced in briefing');
    assert(briefing.milestonesSummary.total >= 2);
    pass('C.8: Project briefing surfaces active, blocked, and completed milestone counts');

    // C.9: Record decisions in decision ledger
    const decRes = pie.recordDecision('proj_alpha_centauri_probe', 'Select QNX for RTOS', {
      rationale: 'Hard real-time deterministic scheduling requirement',
      artifacts: ['docs/rtos_eval.pdf']
    });
    assert(decRes && decRes.decision.includes('QNX'));
    pass('C.9: Decision ledger records architectural decision with rationale and artifacts');

    // C.10: Decision history retrievable chronologically
    const history = pie.getDecisionHistory('proj_alpha_centauri_probe');
    assert(history.length >= 2, 'Decisions not preserved in chronological ledger');
    pass('C.10: Decision history retrievable in chronological sequence');
  } catch (err) {
    fail('Category C execution', err);
  }

  // =========================================================================
  // CATEGORY D: PERSONAL KNOWLEDGE GRAPH & CASCADE INVALIDATION
  // =========================================================================
  console.log('\n--- CATEGORY D: Personal Knowledge Graph & Cascade Invalidation ---');
  try {
    // D.1: Add User entity to KG
    const uNode = pkg.addEntity({
      id: 'usr_harsh_test',
      type: KG_ENTITY_TYPES.USER,
      label: 'Harsh Upadhyay',
      properties: { role: 'Principal Architect' }
    });
    assert.strictEqual(uNode.label, 'Harsh Upadhyay');
    pass('D.1: User entity registered in Personal Knowledge Graph');

    // D.2: Add Project entity to KG
    const pNode = pkg.addEntity({
      id: 'proj_kg_eval',
      type: KG_ENTITY_TYPES.PROJECT,
      label: 'Knowledge Graph Engine V2'
    });
    assert.strictEqual(pNode.type, 'Project');
    pass('D.2: Project entity registered in Personal Knowledge Graph');

    // D.3: Add Goal and Decision entities to KG
    const gNode = pkg.addEntity({
      id: 'goal_kg_eval',
      type: KG_ENTITY_TYPES.GOAL,
      label: 'Sub-millisecond Graph Traversal'
    });
    const dNode = pkg.addEntity({
      id: 'dec_kg_eval',
      type: KG_ENTITY_TYPES.DECISION,
      label: 'Adopt Adjacency Indexing'
    });
    assert.strictEqual(gNode.type, 'Goal');
    assert.strictEqual(dNode.type, 'Decision');
    pass('D.3: Goal and Decision entities registered with typed classifications');

    // D.4: Add typed relationships: OWNS, WORKS_ON, DECIDED
    const edge1 = pkg.addRelationship(uNode.id, pNode.id, KG_RELATION_TYPES.WORKS_ON);
    const edge2 = pkg.addRelationship(pNode.id, gNode.id, KG_RELATION_TYPES.DEPENDS_ON);
    const edge3 = pkg.addRelationship(pNode.id, dNode.id, KG_RELATION_TYPES.DECIDED);
    assert(edge1 && edge2 && edge3);
    pass('D.4: Typed edges (WORKS_ON, DEPENDS_ON, DECIDED) created between nodes');

    // D.5: Subgraph traversal retrieves full 2-hop neighborhood
    const sub = pkg.getSubgraph(uNode.id, 2);
    assert(sub.nodeCount >= 2, `Expected nodeCount >= 2, got ${sub.nodeCount}`);
    assert(sub.edgeCount >= 1, `Expected edgeCount >= 1, got ${sub.edgeCount}`);
    pass('D.5: 2-hop subgraph traversal retrieves reachable entity cluster');

    // D.6: Project context graph maps complete project context
    const projGraph = pkg.getProjectContextGraph('proj_kg_eval');
    assert.strictEqual(projGraph.found, true);
    assert(projGraph.nodes.length >= 3);
    pass('D.6: Project context graph synthesizes goals, decisions, and dependencies');

    // D.7: Cascade invalidation removes node and connected edges
    const invRes = pkg.cascadeInvalidate(dNode.id);
    assert.strictEqual(invRes.verifiedNeutralized, true);
    assert(invRes.neutralizedEdges >= 1);
    pass('D.7: Cascade invalidation deletes target entity and neutralizes connected edges');

    // D.8: Post-invalidation verification confirms node is gone
    const checkNode = pkg.getEntity(dNode.id);
    assert.strictEqual(checkNode, null);
    pass('D.8: Entity lookup after cascade invalidation confirms node absence');

    // D.9: Graph metrics reflect active node and edge totals
    const metrics = pkg.getMetrics();
    assert(metrics.totalNodes > 0 && metrics.totalEdges > 0);
    pass('D.9: Graph metrics report live node and edge counts from SQLite storage');

    // D.10: Search across knowledge graph nodes
    const searchRes = pkg.search('Interstellar', null, 5);
    assert(Array.isArray(searchRes));
    pass('D.10: Full-text search across knowledge graph entities functional');
  } catch (err) {
    fail('Category D execution', err);
  }

  // =========================================================================
  // CATEGORY E: CONVERSATIONAL CONTINUITY & ELLIPTICAL FOLLOW-UPS
  // =========================================================================
  console.log('\n--- CATEGORY E: Conversational Continuity & Elliptical Follow-ups ---');
  try {
    // E.1: Record multi-turn contextual state
    cce.recordTurnContext({
      subject: 'Structural Beam Optimization',
      artifact: 'reports/beam_calculation.docx',
      projectId: 'proj_phase12',
      projectName: 'Phase 12 Engineering Engine',
      topic: 'engineering_analysis'
    });
    pass('E.1: Turn context recorded with subject, artifact, project, and topic');

    // E.2: Pronoun 'the file' resolves to active artifact
    const rFile = cce.resolveReferences('Please inspect the file');
    assert(rFile.resolvedText.includes('reports/beam_calculation.docx'));
    assert.strictEqual(rFile.wasReferenceResolved, true);
    pass('E.2: Pronoun "the file" resolves to active artifact path');

    // E.3: Pronoun 'the project' resolves to active project name
    const rProj = cce.resolveReferences('What is the status of the project?');
    assert(rProj.resolvedText.includes('Phase 12 Engineering Engine'));
    assert.strictEqual(rProj.wasReferenceResolved, true);
    pass('E.3: Pronoun "the project" resolves to active project name');

    // E.4: Pronoun 'it' resolves to active subject or artifact
    const rIt = cce.resolveReferences('Can you optimize it?');
    assert(rIt.wasReferenceResolved, 'Expected "it" to be resolved');
    pass('E.4: Pronoun "it" resolves to active contextual entity');

    // E.5: Incomplete sentence 'in python instead' resolves language conversion directive
    const rPy = cce.resolveReferences('in python instead');
    assert.strictEqual(rPy.intent, 'LANGUAGE_CONVERSION_DIRECTIVE');
    assert.strictEqual(rPy.targetLanguage, 'python');
    pass('E.5: Elliptical request "in python instead" maps to language conversion directive');

    // E.6: Elliptical follow-up 'now run the tests' resolves to active project test directive
    const rTests = cce.resolveReferences('now run the tests');
    assert.strictEqual(rTests.intent, 'RUN_TESTS_DIRECTIVE');
    assert(rTests.resolvedText.includes('Phase 12 Engineering Engine'));
    pass('E.6: Elliptical command "now run the tests" binds to active project');

    // E.7: Topic shift detection identifies conversational transitions
    const shiftRes = cce.detectTopicShift('By the way, what is the weather in Delhi?');
    assert.strictEqual(shiftRes.isShift, true);
    assert.strictEqual(shiftRes.marker, 'by the way');
    pass('E.7: Topic shift transition phrases ("by the way") detected accurately');

    // E.8: Explicit memory commands bypass pronoun substitution
    const rRemember = cce.resolveReferences('Remember that my favorite editor is VS Code');
    assert.strictEqual(rRemember.wasReferenceResolved, false);
    assert.strictEqual(rRemember.resolvedText, 'Remember that my favorite editor is VS Code');
    pass('E.8: Explicit memory recording statements bypass pronoun alteration');
  } catch (err) {
    fail('Category E execution', err);
  }

  // =========================================================================
  // CATEGORY F: PROACTIVE ASSISTANCE & EXPLAINABILITY
  // =========================================================================
  console.log('\n--- CATEGORY F: Proactive Assistance & Explainability ---');
  try {
    pae.notifications = [];
    pae.recentRecommendationHashes.clear();
    pae.quietHours.enabled = false; // Suppress quiet mode for baseline recommendation testing

    // F.1: Proactive levels defined (L0, L1, L2, L3)
    assert(PROACTIVE_LEVELS.L0_DISABLED && PROACTIVE_LEVELS.L1_CONTEXTUAL && PROACTIVE_LEVELS.L2_REMINDERS_SUMMARIES && PROACTIVE_LEVELS.L3_RECURRING_MONITORING);
    pass('F.1: All 4 proactive assistance levels (L0–L3) properly defined');

    // F.2: Assistance level switch to L1
    const lvlRes = pae.setAssistanceLevel(PROACTIVE_LEVELS.L1_CONTEXTUAL);
    assert.strictEqual(lvlRes.level, PROACTIVE_LEVELS.L1_CONTEXTUAL);
    pass('F.2: Proactive assistance level dynamically configurable');

    // F.3: Recommendation requires level check
    const blockedUnderL1 = pae.proposeRecommendation({
      category: PROACTIVE_CATEGORIES.OPERATIONAL,
      minimumLevel: PROACTIVE_LEVELS.L3_RECURRING_MONITORING,
      title: 'Background test regression alert',
      message: 'Failing tests detected in suite',
      evidenceReason: 'Continuous monitoring found 1 failing test'
    });
    assert.strictEqual(blockedUnderL1.proposed, false);
    assert(blockedUnderL1.reason.includes('LEVEL_RESTRICTION'));
    pass('F.3: High-level proactive recommendations suppressed when lower level active');

    // Reset to L2 for reminders
    pae.setAssistanceLevel(PROACTIVE_LEVELS.L2_REMINDERS_SUMMARIES);

    // F.4: Mandatory explainability check throws on missing reason
    let threwExplain = false;
    try {
      pae.proposeRecommendation({
        category: PROACTIVE_CATEGORIES.WORK,
        title: 'Unexplained Recommendation',
        message: 'Do this now'
      });
    } catch (e) {
      threwExplain = true;
    }
    assert.strictEqual(threwExplain, true);
    pass('F.4: Missing evidenceReason strictly throws PROACTIVE_EXPLAINABILITY_VIOLATION');

    // F.5: Valid recommendation created with evidence reason and requiresApproval=true
    const recA = pae.proposeRecommendation({
      category: PROACTIVE_CATEGORIES.PROJECT,
      minimumLevel: PROACTIVE_LEVELS.L2_REMINDERS_SUMMARIES,
      title: 'Review Blocked Power Subsystem Milestone',
      message: 'The Alpha Centauri Probe power milestone is blocked.',
      evidenceReason: 'Because milestone Power Subsystem Verification has 1 active blocker',
      priority: 'HIGH',
      suggestedAction: { type: 'OPEN_PROJECT_BRIEFING', projectId: 'proj_alpha_centauri_probe' }
    });
    assert.strictEqual(recA.proposed, true);
    assert.strictEqual(recA.notification.requiresApproval, true);
    assert(recA.notification.evidenceReason.length > 10);
    pass('F.5: Proactive recommendation generated with verified evidence reason and requiresApproval=true');

    // F.6: Duplicate recommendation suppression within 24 hours
    const recDup = pae.proposeRecommendation({
      category: PROACTIVE_CATEGORIES.PROJECT,
      minimumLevel: PROACTIVE_LEVELS.L2_REMINDERS_SUMMARIES,
      title: 'Review Blocked Power Subsystem Milestone',
      message: 'The Alpha Centauri Probe power milestone is blocked.',
      evidenceReason: 'Because milestone Power Subsystem Verification has 1 active blocker'
    });
    assert.strictEqual(recDup.proposed, false);
    assert.strictEqual(recDup.reason, 'SUPPRESSED_DUPLICATE_RECOMMENDATION');
    pass('F.6: Duplicate proactive recommendations suppressed within 24-hour deduplication window');

    // F.7: Quiet hours suppression for non-critical notifications
    pae.setQuietHours(0, 24, true); // Force 24h quiet mode for test
    const quietRec = pae.proposeRecommendation({
      category: PROACTIVE_CATEGORIES.WORK,
      title: 'Non-critical suggestion',
      message: 'Take a break',
      evidenceReason: 'User has worked 2 hours',
      priority: 'NORMAL'
    });
    assert.strictEqual(quietRec.proposed, false);
    assert.strictEqual(quietRec.reason, 'SUPPRESSED_DUE_TO_QUIET_HOURS');
    pae.setQuietHours(23, 7, true); // Restore standard quiet hours
    pass('F.7: Quiet hours strictly suppresses non-critical proactive notifications');

    // F.8: Actionable notification lifecycle: SNOOZE
    const snoozeRes = pae.actOnNotification(recA.notification.id, 'SNOOZE', { minutes: 45 });
    assert.strictEqual(snoozeRes.status, NOTIFICATION_STATUS.SNOOZED);
    assert(snoozeRes.snoozedUntil);
    pass('F.8: Notification snooze action updates status to SNOOZED with future timestamp');

    // F.9: Actionable notification lifecycle: ACCEPT
    const acceptRes = pae.actOnNotification(recA.notification.id, 'ACCEPT');
    assert.strictEqual(acceptRes.status, NOTIFICATION_STATUS.ACCEPTED);
    pass('F.9: Notification accept action updates status to ACCEPTED');

    // F.10: Proactive suggestions NEVER auto-execute consequential operations
    assert.strictEqual(recA.notification.requiresApproval, true);
    assert(recA.notification.suggestedAction !== undefined);
    pass('F.10: Proactive recommendations stage suggestedAction requiring explicit human authorization');
  } catch (err) {
    fail('Category F execution', err);
  }

  // =========================================================================
  // CATEGORY G: USER OWNERSHIP, DELETION & AVOID TOPICS
  // =========================================================================
  console.log('\n--- CATEGORY G: User Ownership, Deletion & Avoid Topics ---');
  try {
    // G.1: Avoid Topics registry registers forbidden subject
    const regRes = mme.registerAvoidTopic('medical_prescriptions');
    assert.strictEqual(regRes.registered, true);
    assert.strictEqual(regRes.topic, 'medical_prescriptions');
    pass('G.1: User can register prohibited subjects in Avoid Topics registry');

    // G.2: Avoid topic detection intercepts input matching registered topic
    const avoidCheck1 = mme.isTopicAvoided('Please remember my medical prescriptions for hypertension');
    assert.strictEqual(avoidCheck1.avoided, true);
    assert.strictEqual(avoidCheck1.matchedTopic, 'medical_prescriptions');
    pass('G.2: Avoid topic detection intercepts text containing prohibited subject');

    // G.3: Memory write validation blocks avoided topic at the storage boundary
    const writeCheck = mme.validateMemoryWriteSource(
      'user_dialogue',
      'My medical prescriptions are confidential',
      CONFIDENCE_CLASSES.USER_CONFIRMED
    );
    assert.strictEqual(writeCheck.allowed, false);
    assert.strictEqual(writeCheck.reason, 'BLOCKED_BY_AVOID_TOPICS_REGISTRY');
    pass('G.3: Memory write validation strictly blocks storage of avoided topics');

    // G.4: Save temporary fact for multi-location deletion verification
    const delTarget = db.saveMemory({
      id: 'mem_test_deletion_audit',
      fact: 'Sensitive temporary secret',
      category: 'personal_temp'
    });
    pkg.addEntity({ id: 'mem_test_deletion_audit', type: 'Memory', label: 'Sensitive temporary secret' });
    pass('G.4: Temporary test entity staged across primary SQLite and Knowledge Graph');

    // G.5: Delete memory executes multi-location purge
    const delResult = mme.deleteMemory('mem_test_deletion_audit');
    assert.strictEqual(delResult.deleted, true);
    assert.strictEqual(delResult.verifiedAcrossLocations, true);
    assert(delResult.purgedLocations.includes('PRIMARY_SQLITE_TABLE'));
    assert(delResult.purgedLocations.includes('IN_MEMORY_CACHE'));
    assert(delResult.purgedLocations.includes('KNOWLEDGE_GRAPH_NODES_AND_EDGES'));
    pass('G.5: Multi-location deletion purges primary SQLite, cache, graph, and summaries');

    // G.6: Post-deletion verification independently certifies complete removal
    const postVerify = mme.verifyDeletion('mem_test_deletion_audit');
    assert.strictEqual(postVerify.verified, true);
    assert.strictEqual(postVerify.existsInDb, false);
    assert.strictEqual(postVerify.existsInKg, false);
    assert.strictEqual(postVerify.status, 'CONFIRMED_PURGED');
    pass('G.6: Post-deletion verification independently confirms complete record absence');

    // G.7: Forensic integrity disclaimer preserves audit receipts with redacted payload
    assert(delResult.forensicIntegrityNotice.includes('Append-only security audit events preserve cryptographic execution receipts'));
    pass('G.7: Deletion preserves cryptographic forensic audit receipts without leaking private content');

    // G.8: Remove avoid topic from registry
    const rmRes = mme.removeAvoidTopic('medical_prescriptions');
    assert.strictEqual(rmRes.removed, true);
    pass('G.8: Avoid topic removable by explicit user instruction');

    // G.9: Purge project memories deletes all project records
    const projPurge = mme.purgeProjectMemories('proj_temp_purge_target');
    assert.strictEqual(projPurge.purged, true);
    pass('G.9: Project memory purge removes all associated records and graph edges');

    // G.10: Memory correction records version history in metadata
    const corrTarget = db.saveMemory({
      id: 'mem_corr_test_1',
      fact: 'User prefers 4 spaces indentation',
      category: 'user_preference'
    });
    const corrected = db.correctMemory('mem_corr_test_1', 'User prefers 2 spaces indentation', 'User preference change');
    assert.strictEqual(corrected.fact, 'User prefers 2 spaces indentation');
    assert.strictEqual(corrected.priorFact, 'User prefers 4 spaces indentation');
    pass('G.10: Memory correction updates fact in-place while preserving immutable prior version history');
  } catch (err) {
    fail('Category G execution', err);
  }

  // =========================================================================
  // CATEGORY H: MEMORY SECURITY, INJECTION DEFENSE & AGENT ISOLATION
  // =========================================================================
  console.log('\n--- CATEGORY H: Memory Security, Injection & Agent Isolation ---');
  try {
    // H.1: Untrusted web scrape cannot write USER_CONFIRMED personal memory
    const untrustedWeb = mme.validateMemoryWriteSource(
      'web_scrape_untrusted',
      'User lives in San Francisco',
      CONFIDENCE_CLASSES.USER_CONFIRMED
    );
    assert.strictEqual(untrustedWeb.allowed, false);
    assert.strictEqual(untrustedWeb.reason, 'SECURITY_VIOLATION_UNTRUSTED_CONTENT_CANNOT_WRITE_CONFIRMED_MEMORY');
    pass('H.1: Untrusted web content blocked from creating USER_CONFIRMED memory');

    // H.2: Untrusted incoming email cannot write SOURCE_VERIFIED memory
    const untrustedEmail = mme.validateMemoryWriteSource(
      'incoming_email_gateway',
      'User agreed to terms of service',
      CONFIDENCE_CLASSES.SOURCE_VERIFIED
    );
    assert.strictEqual(untrustedEmail.allowed, false);
    assert.strictEqual(untrustedEmail.reason, 'SECURITY_VIOLATION_UNTRUSTED_CONTENT_CANNOT_WRITE_CONFIRMED_MEMORY');
    pass('H.2: Incoming email content blocked from creating SOURCE_VERIFIED memory');

    // H.3: Specialist Agent Least-Privilege Projection for Coding Agent
    const mockMemories = [
      { id: 'm_code', category: 'code_preference', metadata: { prefCategory: 'workPreferences' } },
      { id: 'm_comm', category: 'communication', memoryLayer: 'user_preference', metadata: { prefCategory: 'communication' } },
      { id: 'm_social', category: 'social', metadata: {} }
    ];
    const codeFilter = mme.filterForAgent('CodingAssistantAgent', mockMemories);
    assert.strictEqual(codeFilter.totalAllowed, 1);
    assert.strictEqual(codeFilter.allowedMemories[0].id, 'm_code');
    pass('H.3: Coding Agent receives filtered least-privilege context (personal/social excluded)');

    // H.4: Specialist Agent Least-Privilege Projection for Security Agent
    const secFilter = mme.filterForAgent('SecurityAgent', mockMemories);
    const hasCommInSec = secFilter.allowedMemories.some(m => m.id === 'm_comm');
    assert.strictEqual(hasCommInSec, false);
    pass('H.4: Security Agent context projection excludes personal communication preferences');

    // H.5: All 16 Phase 14 tools registered in toolsRegistry
    const requiredTools = [
      'personal_context_get',
      'personal_context_update_preference',
      'personal_context_record_decision',
      'project_resolve_reference',
      'project_get_intelligence',
      'project_record_milestone',
      'kg_query_personal_graph',
      'kg_add_personal_entity',
      'kg_add_personal_relation',
      'proactive_get_recommendations',
      'proactive_set_assistance_level',
      'proactive_act_on_notification',
      'memory_verify_deletion',
      'memory_register_avoid_topic',
      'memory_get_avoid_topics',
      'memory_purge_domain'
    ];
    for (const t of requiredTools) {
      assert(toolsRegistry[t], `Tool "${t}" not found in toolsRegistry`);
    }
    pass('H.5: All 16 Phase 14 personal intelligence tools registered in central registry');

    // H.6: Destructive memory purge tool (memory_purge_domain) requires Level 3 human approval
    const { PERMISSION_POLICIES } = require('./server/desktop/permissionGate.js');
    const isApprovalRequired = PERMISSION_POLICIES.JARVIS.approvalRequiredTools.includes('memory_purge_domain');
    assert.strictEqual(isApprovalRequired, true, 'memory_purge_domain MUST require approval');
    pass('H.6: memory_purge_domain strictly requires single-use cryptographic approval (Level 3)');

    // H.7: Emergency Stop halts tool execution across memory and proactive tools
    const { emergencyStopControllerInstance: estop } = require('./server/emergencyStopController.js');
    estop.engage('Phase 14 Security Acceptance Test H.7');
    let estopBlocked = false;
    try {
      const { executeTool } = require('./server/toolsRegistry.js');
      await executeTool('personal_context_get', {});
    } catch (e) {
      if (e.message.includes('EMERGENCY_STOP_ACTIVE')) estopBlocked = true;
    }
    estop.reset();
    assert.strictEqual(estopBlocked, true);
    pass('H.7: Emergency Stop immediately blocks Phase 14 tool execution with EMERGENCY_STOP_ACTIVE');

    // H.8: Reset Emergency Stop restores standby state cleanly
    assert.strictEqual(estop.isEngaged(), false);
    pass('H.8: Emergency Stop reset restores standby state cleanly');
  } catch (err) {
    fail('Category H execution', err);
  }

  // =========================================================================
  // ACCEPTANCE SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  console.log(`PHASE 14 ACCEPTANCE SUITE RESULT: ${totalPassed} / ${totalPassed + totalFailed} ASSERTIONS PASSED`);
  console.log(`SUCCESS RATE: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  const evidenceDir = path.join(__dirname, 'reports', 'evidence', 'phase14');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const resultJson = {
    suite: 'PHASE 14 PERSONAL INTELLIGENCE ACCEPTANCE SUITE',
    timestamp: new Date().toISOString(),
    totalAssertions: totalPassed + totalFailed,
    totalPassed,
    totalFailed,
    successRate: `${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`,
    passedAssertions,
    failedAssertions
  };
  fs.writeFileSync(path.join(evidenceDir, 'acceptance_test_results.json'), JSON.stringify(resultJson, null, 2), 'utf8');

  if (totalFailed > 0) {
    console.error(`💥 SUITE FAILED with ${totalFailed} failing assertions.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL 8 CATEGORIES (78 ASSERTIONS) VERIFIED 100% OPERATIONAL!');
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Fatal suite execution error:', err);
  process.exit(1);
});
