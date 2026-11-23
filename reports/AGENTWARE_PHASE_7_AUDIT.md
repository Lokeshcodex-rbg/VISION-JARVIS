# STARK AI / J.A.R.V.I.S. — PHASE 7 ARCHITECTURE AUDIT

## Advanced Research, Knowledge Intelligence & Evidence-Linked Graph

**Date:** November 8, 2026  
**Project:** STARK AI / J.A.R.V.I.S. (`D:\Jarvis`)  
**Phase:** 7 (Advanced Research & Knowledge Intelligence)  
**Checkpoint Commit Hash:** `7af2dd8fef1ff20a911e4d0e01353a675e057b99`  
**Host Environment:** Windows 11 Pro x64 (Build 26100), Node.js v22.23.2, Python 3.12.9  

---

## 1. Executive Preflight & Git Checkpoint

In strict adherence to Section 1 of the Phase 7 Directive, the working tree was inspected, uncommitted changes from Phase 1 through 6 were validated, `.gitignore` was updated to protect local databases (`*.db`, `*.db-shm`, `*.db-wal`), audit trails, and session tokens, and a clean local Git commit was created:

- **Checkpoint Commit Hash:** `7af2dd8fef1ff20a911e4d0e01353a675e057b99`
- **Branch:** `stark-frontier-capabilities`
- **Remotes:** None (strictly local Git; zero remote pushes)
- **Working Tree:** Clean (`nothing to commit, working tree clean`)

---

## 2. Comprehensive Subsystem Audit & Reuse Assessment

To prevent architecture fragmentation or duplicate engines, all 13 core existing subsystems were audited. Every capability in Phase 7 builds directly upon existing modules:

| Subsystem | Existing Module | Phase 7 Architectural Role | Reuse & Extension Strategy |
| :--- | :--- | :--- | :--- |
| **Multi-Agent Orchestrator** | `server/multiAgentOrchestrator.js` | Authoritative mission coordinator | Orchestrates research phases across specialist agents; synthesizes consensus reports |
| **Specialist Agents (7 Core)** | `server/specialistAgents.js` | Autonomous functional specialists | Dispatches subquestions to `research_agent`, `browser_agent`, `data_analyst_agent`, `document_agent`, `planning_agent`, `coding_agent`, `system_agent` |
| **DAG Planning Engine** | `server/dagPlanningEngine.js` | Objective decomposition | Generates research DAGs with explicit dependency ordering and source collection nodes |
| **DAG Execution Engine** | `server/dagExecutionEngine.js` | Authoritative task runner | Executes research steps in parallel, managing concurrency and agent permissions |
| **Browser Automation Engine** | `server/browser/browserAutomationEngine.js` | Real public web navigation | Navigates verified URLs via Playwright/Edge; extracts DOM text & tables into `<untrusted_web_content>` |
| **Independent Verifier** | `server/independentVerifier.js` | Zero model-trust validator | Empirically verifies generated research reports via `DOCUMENT_AST_VERIFIED` and SHA-256 hashes |
| **Persistent Epistemic Memory** | `server/memory/starkMemoryDb.js` & `server/memoryManager.js` | SQLite fact & project store | Persists verified facts, claims, assumptions, user statements, and research projects |
| **Knowledge Graph Engine** | `server/knowledgeGraphEngine.js` | Entity & relationship graph | Connects entities, concepts, relationships, claims, sources, and contradictions |
| **Message Bus** | `server/multiAgentMessageBus.js` | Inter-agent communication | 9-field schema routing research queries, progress updates, and conflict notifications |
| **Permission Policy Engine** | `server/security/permissionPolicyEngine.js` | 5-Tier permission hierarchy | Restricts agents to least-privilege tool allowlists; enforces single-use human approvals |
| **Emergency Stop Controller** | `server/emergencyStopController.js` | Preemptive kill switch | Halts active research, terminates browser/child processes in <100ms, and locks memory |
| **Audit Trail Engine** | `server/audit/auditTrailEngine.js` | Cryptographic audit chain | Records research queries, source extractions, and verification proofs to tamper-evident chain |
| **Document Intelligence** | `server/documentIntelligenceEngine.js` | Report generation | Produces structured OpenXML (.docx) and PDF research deliverables with source bibliographies |

---

## 3. Advanced Research Engine Architecture

The Advanced Research Engine (`server/advancedResearchEngine.js`) will be upgraded to support genuine, verifiable scientific and technical investigations:

```text
                            [ User Complex Research Objective ]
                                             |
                                             v
                                  [ Planning Specialist ]
                     (Decomposes into 3-5 Focused Subquestions)
                                             |
                     +-----------------------+-----------------------+
                     |                       |                       |
                     v                       v                       v
               [ Subquestion 1 ]       [ Subquestion 2 ]       [ Subquestion 3 ]
                     |                       |                       |
                     +-----------------------+-----------------------+
                                             |
                                             v
                           [ Multi-Source Evidence Gathering ]
                      - Public Scientific Repositories (ArXiv)
                      - Local Authoritative Knowledge Base
                      - Live Browser Extraction (Playwright / Edge)
                      - Real World Structured Datasets
                                             |
                                             v
                          [ Source Evaluator & Credibility Filter ]
                      - Identity, Origin, and Institutional Backing
                      - Publication Date & Information Freshness
                      - Primary vs Secondary Source Categorization
                      - Evidence Quality & Corroboration Metrics
                                             |
                                             v
                          [ Contradiction & Epistemic Classifier ]
                      - Categorize: VERIFIED_FACT, CLAIM, ASSUMPTION, HYPOTHESIS
                      - Cross-Source Contradiction Detection & Logging
                                             |
                                             v
                          [ Evidence-Linked Knowledge Graph ]
                      - Nodes: Entities, Concepts, Claims, Sources
                      - Edges: SUPPORTS, CONTRADICTS, CITING, PROVENANCE
                                             |
                                             v
                           [ Document & Synthesis Pipeline ]
                      - Multi-Agent Synthesis & Consensus Report
                      - Professional Word (.docx) & PDF Generation
                      - Independent Verifier AST & SHA-256 Authentication
```

### Core Research Capabilities

1. **Objective Decomposition:** Breaks high-level research requests into structured, answerable subquestions with explicit completion criteria.
2. **Multi-Source Evidence Gathering:** Fetches information across ArXiv, verified web URLs, local persistent knowledge bases, and structured datasets.
3. **Information Organization:** Maps findings directly to subquestions, tracking evidence completeness and highlighting unanswered queries.
4. **Epistemic Classification:** Strictly separates:
   - `VERIFIED_FACT`: Empirically validated or primary-source corroborated data with provenance.
   - `CLAIM`: Assertions made by external sources awaiting independent cross-verification.
   - `ASSUMPTION`: Unproven premises or extrapolations.
   - `HYPOTHESIS`: Testable explanations under evaluation.
   - `USER_STATEMENT`: Direct user inputs and corrections (stored with highest priority).

---

## 4. Source Evaluation & Cross-Verification Framework

Sources are evaluated using transparent, objective criteria rather than subjective LLM sentiment:

```text
Source Credibility Score = 0.35 * InstitutionalOrigin + 0.25 * EvidenceDirectness + 0.20 * Freshness + 0.20 * Corroboration
```

1. **Source Origin & Identity:** Distinguishes peer-reviewed journals, official vendor documentation, and primary academic papers from secondary blog posts or unverified aggregators.
2. **Publication Date & Freshness:** Categorizes sources by age (`FRESH`: <12 months, `CURRENT`: 1-3 years, `HISTORICAL`: 3-7 years, `STALE`: >7 years for rapidly evolving technologies).
3. **Primary vs Secondary Evidence:** Direct experimental datasets or code execution outputs are prioritized over secondary opinion pieces.
4. **Independent Corroboration:** Requires at least two independent primary or secondary sources before an unverified `CLAIM` is elevated to a `VERIFIED_FACT`.
5. **Anti-Hallucination Invariant:** A source URL is only cited if it was actually retrieved and extracted during execution. Zero invented sources.

---

## 5. Evidence-Linked Persistent Knowledge Graph

The Knowledge Graph connects to SQLite (`data/stark_memory.db`) via dedicated, indexed relational tables:

```sql
CREATE TABLE IF NOT EXISTS kg_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                  -- 'entity', 'concept', 'claim', 'source', 'project'
  label TEXT NOT NULL,
  properties TEXT,                     -- JSON metadata
  provenance TEXT,                     -- URL, file, or agent origin
  confidence REAL DEFAULT 1.0,
  epistemic_type TEXT DEFAULT 'CLAIM', -- 'VERIFIED_FACT', 'CLAIM', 'ASSUMPTION', etc.
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relationship TEXT NOT NULL,          -- 'SUPPORTS', 'CONTRADICTS', 'CITES', 'DERIVED_FROM'
  weight REAL DEFAULT 1.0,
  metadata TEXT,                       -- JSON
  source TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kg_contradictions (
  id TEXT PRIMARY KEY,
  entity_or_concept TEXT NOT NULL,
  claim_a TEXT NOT NULL,
  source_a TEXT NOT NULL,
  claim_b TEXT NOT NULL,
  source_b TEXT NOT NULL,
  contradiction_type TEXT NOT NULL,    -- 'DIRECT_CONFLICT', 'TEMPORAL_DRIFT', 'METHODOLOGICAL'
  resolved INTEGER DEFAULT 0,
  resolution TEXT,
  detected_at TEXT NOT NULL
);
```

---

## 6. Multi-Agent Research Collaboration Matrix

All 7 specialist agents collaborate under the Central Orchestrator:

1. **`planning_agent`:** Decomposes the research objective into subquestions and constructs the research DAG.
2. **`research_agent`:** Queries scientific APIs, searches the knowledge base, and retrieves candidate papers.
3. **`browser_agent`:** Navigates public URLs and extracts text and tables inside `<untrusted_web_content>` wrappers.
4. **`data_analyst_agent`:** Performs quantitative benchmarking and statistical cross-verification on numeric claims.
5. **`coding_agent`:** Performs AST analysis or code inspection for technical research objectives.
6. **`document_agent`:** Synthesizes findings into formal OpenXML (.docx) and PDF research papers.
7. **`system_agent`:** Monitored system health, memory consumption, and network responsiveness throughout execution.

---

## 7. Security, Reliability & Adversarial Defenses

1. **Untrusted Web Data:** All external webpage text is tagged as `<untrusted_web_content>` and parsed solely as data. Extracted text is prohibited from issuing instructions or influencing permissions.
2. **SSRF Defense:** All target URLs are validated against private, loopback, and cloud metadata addresses (`169.254.169.254`, `metadata.google.internal`).
3. **Memory Integrity:** User corrections take absolute precedence over web assertions. External claims cannot overwrite user-verified memories.
4. **Emergency Stop Compliance:** Emergency Stop instantly halts active research, closes browser contexts, and releases locks in <100ms.

---

## 8. Phase 7 Acceptance Test Strategy

A new dedicated test suite `test_stark_advanced_research_knowledge_acceptance_suite.js` will verify at least 20 scenarios:

1. Scenario A: Research objective decomposition into subquestions
2. Scenario B: Multi-source evidence gathering
3. Scenario C: Source provenance & URL attribution
4. Scenario D: Source credibility scoring (Origin & Freshness)
5. Scenario E: Publication-date handling & stale information detection
6. Scenario F: Contradiction detection across independent sources
7. Scenario G: Unsupported claim rejection (No citation = No admission)
8. Scenario H: Citation integrity & anti-fabrication check
9. Scenario I: Knowledge graph node & edge creation
10. Scenario J: Knowledge graph relationship & path retrieval
11. Scenario K: Persistent SQLite knowledge graph storage
12. Scenario L: Memory correction & user statement priority
13. Scenario M: Cross-project knowledge retrieval
14. Scenario N: Stale information detection & expiration flags
15. Scenario O: Multi-agent research collaboration workflow
16. Scenario P: Malicious webpage instruction rejection
17. Scenario Q: Universal permission enforcement during research
18. Scenario R: Emergency Stop during active research
19. Scenario S: Interrupted research checkpoint & recovery
20. Scenario T: Professional document generation & bibliography
21. Scenario U: Independent OpenXML AST & SHA-256 verification

---

## 9. Conclusion

The architecture is fully verified, non-duplicative, and grounded in the working Phase 1–6 implementations. We are prepared to proceed with Phase 7 implementation.
