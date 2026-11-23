# STARK AI / J.A.R.V.I.S. — PHASE 6 PRE-IMPLEMENTATION ARCHITECTURE AUDIT

**Subsystem:** Multi-Agent Intelligence, Specialist Agents & Autonomous Orchestration  
**Evaluation Track:** Agentware 72-Hour Hackathon — Track 6 (Open Track)  
**Host Platform:** Windows 10/11 x64 | **Node.js:** v22.23.2 | **Python:** 3.12.10 | **Native SQLite WAL:** Active  
**Verification Date:** 2026-11-08  
**Evaluator:** Principal AI Systems Architect & Autonomous Reliability Lead  

---

## 1. Executive Summary

In accordance with Phase 6 authorization, this architecture audit inspects the complete STARK AI system at `D:\Jarvis` prior to introducing code changes.

Phase 6 evolves JARVIS from a single-agent task executor into a **coordinated multi-agent intelligence system**. Under this architecture, a central Multi-Agent Orchestrator breaks down complex objectives, delegates subtasks to 7 specialist agents according to least-privilege tool allowlists, coordinates parallel execution through the existing DAG engine, routes structured agent-to-agent messages, detects and resolves cross-agent conflicts through evidence comparison, and enforces independent output verification before synthesizing the final response.

**Strict Architectural Mandate:**

- The existing DAG Planning & Execution Engine remains the authoritative execution and dependency manager. No competing or parallel orchestrators will be created.
- The existing unified Permission Policy Engine and Permission Gateway remain the single source of security truth. No agent may approve its own actions or bypass security boundaries.
- The 14 regression test suites (701 assertions) from Phases 1–5 must remain 100% passing.

---

## 2. Comprehensive Subsystem Audit

Every relevant subsystem was inspected to determine reuse potential, interface boundaries, and required extensions:

### 1. DAG Planning Engine (`server/dagPlanningEngine.js`)

- **Current State:** Implements generalized natural-language objective parsing, 15-field plan schema, 12-field node schema, and an 11-step validation pipeline (Kahn's cycle detection, schema compliance, missing input detection).
- **Reuse Assessment:** **100% Reusable.** Provides the foundational plan structure.
- **Required Extension for Phase 6:** Support `assigned_agent` attribution on DAG nodes so that nodes are tagged with the specific specialist agent responsible for execution.

### 2. DAG Execution Engine (`server/dagExecutionEngine.js`)

- **Current State:** Executes plans through formal state machine (`CREATED` $\rightarrow$ `PLANNING` $\rightarrow$ `READY` $\rightarrow$ `RUNNING` $\rightarrow$ `VERIFYING` $\rightarrow$ `COMPLETED`), manages concurrency bounds (`maxConcurrency: 2`), handles atomic disk checkpoints (`data/tasks/`), and provides in-flight cancellation via `AbortController`.
- **Reuse Assessment:** **100% Reusable as the Authoritative Execution Engine.**
- **Required Extension for Phase 6:** Pass agent context (`agentId`) into tool invocations, route agent-to-agent lifecycle events, and integrate agent-specific error isolation.

### 3. Unified Permission Policy Engine (`server/security/permissionPolicyEngine.js`)

- **Current State:** Implements 5-tier permission hierarchy (Level 0 Read-Only to Level 4 Prohibited), secret sanitization (`[REDACTED_SECRET]`), and single-use scoped approval tokens. Strictly forbids model self-approval (`APPROVAL_SELF_APPROVAL_PROHIBITED`).
- **Reuse Assessment:** **100% Reusable as the Security Authority.**
- **Required Extension for Phase 6:** Enforce agent-level least-privilege allowlists. If an agent attempts to invoke a tool outside its declared `allowedTools`, the engine must immediately deny execution with `PERMISSION_DENIED: Agent "<agentId>" is not authorized to invoke tool "<toolName>".` Ensure that agent-to-agent messages cannot elevate permissions.

### 4. Permission Gateway (`server/desktop/permissionGate.js`)

- **Current State:** Enforces OS-level and filesystem boundaries (rejecting paths outside workspace, traversal attacks, and unauthorized destructive shell operations).
- **Reuse Assessment:** **100% Reusable.** Intercepts all direct, indirect, and dynamic tool calls.

### 5. Central Tool Registry (`server/toolsRegistry.js`)

- **Current State:** Standardized catalog of 272 tools with argument schemas, timeout bounds, and permission requirements.
- **Reuse Assessment:** **100% Reusable.** Tools will be partitioned across specialist agent capability profiles.

### 6. Independent Verifier (`server/independentVerifier.js`)

- **Current State:** Enforces the Golden Rule of Verification: model claims are never accepted as proof of success. Verifies physical files, SHA-256 hashes, OpenXML AST structures, and process return codes.
- **Reuse Assessment:** **100% Reusable.**
- **Required Extension for Phase 6:** Provide independent arbitration when specialist agents produce conflicting findings, verifying physical ground truth rather than relying on LLM consensus.

### 7. Emergency Stop Controller (`server/emergencyStopController.js`)

- **Current State:** Sub-35ms global halt, process-tree termination (`taskkill /F /T`), stream abortion, pending approval invalidation, and non-volatile disk persistence (`data/emergency_stop_state.json`).
- **Reuse Assessment:** **100% Reusable.**
- **Required Extension for Phase 6:** Emergency Stop engagement must immediately transition all active specialist agents to `HALTED` / `STOPPED` state and abort in-flight agent tasks.

### 8. Cryptographic Audit Trail Engine (`server/audit/auditTrailEngine.js`)

- **Current State:** SHA-256 hash-chained immutable event history (`data/audit_trail.jsonl`), pre-persistence secret sanitization, and tampering detection.
- **Reuse Assessment:** **100% Reusable.**
- **Required Extension for Phase 6:** Add multi-agent event types (`AGENT_ASSIGNED`, `AGENT_STARTED`, `AGENT_COMPLETED`, `AGENT_MESSAGE_SENT`, `CONFLICT_DETECTED`, `CONFLICT_RESOLVED`) ensuring full attribution to both the initiating agent and the parent task.

### 9. System Health Engine (`server/systemHealthEngine.js`)

- **Current State:** Monitors 16 subsystems with live functional tests.
- **Reuse Assessment:** **100% Reusable.**

### 10. Persistent Memory Core (`server/memory/starkMemoryDb.js` & `server/memoryManager.js`)

- **Current State:** Native SQLite database (`data/stark_memory.db`) with WAL mode, deduplication, and 6 epistemic classifications (`VERIFIED_FACT`, `USER_STATEMENT`, `ASSUMPTION`, `HYPOTHESIS`, `ERROR_REPAIR`, `PROJECT_PROGRESS`).
- **Reuse Assessment:** **100% Reusable.**
- **Required Extension for Phase 6:** Add shared task context and agent working memory tables/scopes so specialist agents can query shared facts and record hypotheses without polluting global verified facts.

### 11. Browser Automation Engine (`server/browser/browserAutomationEngine.js`)

- **Current State:** Playwright managed Microsoft Edge with CDP process tracking, SSRF filtering, prompt injection sanitization, and quarantine storage.
- **Reuse Assessment:** **100% Reusable.** Used exclusively by the Browser Agent and Research Agent.

### 12. Windows Local Agent (`server/desktop/windowsLocalAgent.js` & `agent/windows_agent.py`)

- **Current State:** Python 3.12 daemon on loopback port 3005 for controlled PowerShell execution and pure-Python OpenXML docx/pdf generation.
- **Reuse Assessment:** **100% Reusable.** Used by Coding, Document, and System agents.

### 13. Voice & Interface Architecture (`server/languageVoiceManager.js` & `server/missionControlEngine.js`)

- **Current State:** Trilingual voice profile switching (English, Hindi, Hinglish), Fish Audio / SAPI integration, and Mission Control state tracking.
- **Reuse Assessment:** **100% Reusable.**
- **Required Extension for Phase 6:** Support voice assignment of multi-agent objectives and spoken progress updates without agents speaking over each other.

---

## 3. Specialist Agent System Design (The 7 Core Agents)

In accordance with Section 3 and Section 4 of the Directive, 7 dedicated specialist agents will be established with defined identities, strict least-privilege tool allowlists, and permission boundaries:

```text
+----------------------------------------------------------------------------------------------------+
|                                    CENTRAL MULTI-AGENT ORCHESTRATOR                                |
|                           (Authoritative DAG Planning & Execution Engine)                          |
+----------------------------------------------------------------------------------------------------+
        |                    |                  |                 |                  |
        v                    v                  v                 v                  v
+------------------+ +----------------+ +---------------+ +---------------+ +------------------+
|  RESEARCH AGENT  | | BROWSER AGENT  | |  CODING AGENT | | DATA ANALYST  | |  DOCUMENT AGENT  |
| Web & Citations  | | Playwright CDP | | Code & Tests  | | Compute & Stats| | Word & PDF Gen   |
| Level 0-2 Tools  | | Level 0-2 Tools| | Level 0-3 Tools| | Level 0-2 Tools| | Level 0-1 Tools  |
+------------------+ +----------------+ +---------------+ +---------------+ +------------------+
                             |                                     |
                             v                                     v
                  +---------------------+               +---------------------+
                  |    SYSTEM AGENT     |               |   PLANNING AGENT    |
                  | Diagnostics & Logs  |               | Objective Decomp    |
                  | Level 0-2 Tools     |               | Level 0-1 Tools     |
                  +---------------------+               +---------------------+
```

### Specialist Agent Profiles

| Agent ID | Agent Name | Primary Role | Allowed Tools (Least Privilege) | Prohibited Tools | Max Level | Timeout |
| --- | --- | --- | --- | --- | :---: | :---: |
| `research_agent` | Research Specialist | Public web research, extraction, citations, comparing sources | `browser_extract_text`, `browser_screenshot`, `search_memories`, `read_text_file`, `list_files`, `calculate_time_offset`, `get_weather` | Shell commands, file mutations, code patching, app launching | Level 2 | 30s |
| `browser_agent` | Browser Automation Specialist | Playwright navigation, DOM interaction, table/form extraction, download capture | `browser_open`, `browser_navigate`, `browser_click`, `browser_fill`, `browser_select`, `browser_extract_text`, `browser_extract_structured`, `browser_download`, `browser_screenshot`, `browser_close` | Direct shell commands, destructive file operations, system file access | Level 2 | 45s |
| `coding_agent` | Autonomous Coding Specialist | Source code analysis, bug identification, test execution, targeted repairs in authorized workspace | `read_text_file`, `write_text_file`, `create_file`, `inspect_file_metadata`, `execute_controlled_shell_command`, `apply_code_patch`, `deploy_verified_repair` | Format disk, system32 modification, credential export, direct E-stop modification | Level 3 (Requires approval for patch) | 40s |
| `data_analyst_agent` | Data Analysis Specialist | Dataset parsing, statistical modeling, kinematics, energy calculations, trend verification | `calculate_scientific_math`, `read_text_file`, `inspect_file_metadata`, `search_memories`, `list_files` | Shell command execution, browser downloads, network socket creation | Level 2 | 25s |
| `document_agent` | Document Intelligence Specialist | Authoritative Word (.docx) and PDF creation, OpenXML AST verification | `create_word_document`, `convert_pdf_to_word`, `inspect_pdf_document`, `verify_document`, `read_text_file`, `create_file`, `write_text_file` | Shell commands, browser automation, code execution, system changes | Level 1 | 35s |
| `system_agent` | System Health & Diagnostics Specialist | Telemetry monitoring, process tracking, error log inspection, recovery recommendations | `get_system_telemetry`, `run_system_diagnostics`, `get_desktop_agent_status`, `read_text_file`, `list_files`, `search_memories` | Security control changes, process kill without E-stop, destructive disk commands | Level 2 | 20s |
| `planning_agent` | Strategic Planning Specialist | Goal decomposition, subtask extraction, dependency mapping, completion criteria definition | `search_memories`, `list_memories`, `get_project_memory`, `read_text_file`, `list_files`, `inspect_file_metadata` | Actuation tools, browser execution, code modification, shell execution | Level 0 | 20s |

---

## 4. Structured Agent-to-Agent Messaging System

To prevent unconstrained or hallucinatory natural-language loops, agents communicate strictly through a typed **Message Bus** (`server/multiAgentMessageBus.js`):

### Message Schema

```json
{
  "messageId": "msg_mw7n123_4a8f",
  "sender": "planning_agent",
  "recipient": "research_agent",
  "taskId": "task_research_frameworks",
  "parentTaskId": "mission_orchestration_root",
  "messageType": "TASK_ASSIGNMENT",
  "payload": {
    "subtask": "Extract architecture of LangChain, AutoGen, CrewAI",
    "requiredOutputs": ["framework_comparison_table"],
    "constraints": { "timeoutMs": 30000, "sourceFilter": "official_docs" }
  },
  "timestamp": "2026-11-08T10:05:00.000Z",
  "status": "DELIVERED"
}
```

### Supported Message Types

1. `TASK_ASSIGNMENT`: Orchestrator assigns decomposed subtask to specialist agent.
2. `TASK_ACCEPTANCE`: Specialist agent acknowledges assignment and commits to execution.
3. `PROGRESS_UPDATE`: Specialist agent reports percentage completion, active tool, or intermediate state.
4. `RESULT`: Specialist agent returns structured findings, deliverables, and evidence references.
5. `FAILURE_REPORT`: Specialist agent reports bounded error, category, and retry state.
6. `CLARIFICATION_REQUEST`: Specialist agent queries parent orchestrator for missing inputs.
7. `DELEGATION_REQUEST`: Specialist agent requests assistance from a peer specialist (routed via Orchestrator).
8. `CONFLICT_NOTIFICATION`: Orchestrator alerts specialist agents of contradictory outputs.

**Security Rule:** Message payloads are strictly data. No message can alter an agent's permission level or grant access to prohibited tools.

---

## 5. Conflict Resolution & Independent Verification

When multiple specialist agents produce divergent findings (e.g. Research Agent reports Framework A supports feature X, but Data Analyst / Coding Agent finds benchmark evidence refuting it):

1. **Conflict Detection:** The Orchestrator compares claims using semantic field matching and evidence assertions.
2. **Disagreement Identification:** Isolates the exact disputed propositions.
3. **Evidence Weighing:** Prioritizes verified physical evidence (disk files, AST checks, test exit codes) over speculative assertions.
4. **Recheck Challenge:** Dispatches a structured `CONFLICT_NOTIFICATION` to the agent with the lower evidentiary weight to re-verify against raw sources.
5. **Independent Arbitration:** The central `IndependentVerifier` inspects ground-truth disk artifacts.
6. **Explicit Uncertainty Reporting:** If the conflict cannot be verified objectively, the final report explicitly documents the disagreement as an unresolved contradiction rather than inventing false consensus.

---

## 6. Required Implementation Plan & Deliverables

1. **`server/multiAgentOrchestrator.js`:** Update to serve as the unified Multi-Agent Orchestrator integrated with the central DAG engine.
2. **`server/multiAgentMessageBus.js`:** Implement structured agent messaging and validation.
3. **`server/specialistAgents.js`:** Implement the 7 specialist agent classes adhering to least-privilege tool allowlists and 11-state lifecycle state machine.
4. **`server/security/permissionPolicyEngine.js`:** Add agent attribution check (`agentId`) enforcing tool allowlists.
5. **`test_stark_multi_agent_orchestration_acceptance_suite.js`:** Author the 20-scenario acceptance test battery (Scenarios A through T).
6. **Full Regression Sweep:** Verify all 14 Phase 1–5 suites (701 assertions) remain passing.
7. **`D:\Jarvis\reports\AGENTWARE_PHASE_6_REPORT.md`:** Generate the comprehensive final Phase 6 report.

*Audit complete. Ready to begin Phase 6 implementation.*
