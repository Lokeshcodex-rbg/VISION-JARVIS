# STARK AI / J.A.R.V.I.S. — AGENTWARE TRACK 6

## PHASE 3 PRE-IMPLEMENTATION AUDIT: BROWSER AUTOMATION & PLAYWRIGHT/CDP INTEGRATION

**Project Location:** `D:\Jarvis`  
**Host Environment:** Windows 10/11 x64, Node.js v22.23.2, Python 3.12.10  
**Audit Date:** 2026-11-08  
**Auditor:** Principal AI Systems Architect & QA Lead  
**Target Phase:** Phase 3 (Real Browser Automation & Playwright Engine)

---

## 1. EXECUTIVE SUMMARY

Following the successful completion of Phase 2 (Generalized Autonomous DAG Planning & Verification Engine with 441/441 regression assertions verified at 100%), Phase 3 authorizes extending JARVIS with reliable, verifiable browser automation.

This audit establishes the technical baseline, inspects existing architectural boundaries, maps out browser tool registration into the DAG engine, defines security invariants for untrusted web content, and plans the implementation to ensure zero degradation of existing functionality.

---

## 2. INSPECTION OF EXISTING ARCHITECTURAL COMPONENTS

### A. DAG Planning Engine (`server/dagPlanningEngine.js`)

- **Current State:** Employs generalized objective understanding, 15-field plan schema, 12-field node schema, and an 11-step semantic/security validation pipeline with Kahn's cycle detection.
- **Phase 3 Extension:** Introduce `BROWSER_RESEARCH_WORKFLOW` and `BROWSER_INTERACTION_WORKFLOW` domain handlers in `_buildGroundedNodesForDomain()`. Objectives requiring web research or multi-step browser interactions will generate structured DAG plans chaining navigation, element interaction, structured data extraction, content verification, comparative synthesis, and OpenXML report generation.

### B. DAG Execution Engine (`server/dagExecutionEngine.js`)

- **Current State:** Implements a 12-state task machine (`CREATED` -> `RUNNING` -> `VERIFYING` -> `COMPLETED`/`STOPPED`), topological dependency execution, bounded concurrency (`maxConcurrency: 2`), `AbortController` cancellation, bounded retries, and checkpoint persistence.
- **Phase 3 Extension:** The execution engine will execute browser actions as standard DAG nodes. In-flight cancellation will link the DAG's `AbortController` directly to Playwright page operations and browser contexts, ensuring immediate termination upon user cancellation or Emergency Stop.

### C. Independent Verification Layer (`server/independentVerifier.js`)

- **Current State:** Supports 7 verification methods (`FILE_EXISTS_AND_NONEMPTY`, `FILE_CONTENT_MATCH`, `FILE_SHA256_HASH`, `DOCUMENT_AST_VERIFIED`, `PROCESS_EXIT_CODE_ZERO`, `MEMORY_RECORD_VERIFIED`, `DATASET_CALCULATION_VERIFIED`).
- **Phase 3 Extension:** Add browser-specific verification methods:
  - `BROWSER_NAVIGATION_VERIFIED`: Verifies that target URL was reached, page title matches expected criteria, and HTTP status is valid.
  - `BROWSER_EXTRACTION_VERIFIED`: Verifies that required text/fields are non-empty and match expected schema.
  - `BROWSER_INTERACTION_VERIFIED`: Verifies resulting DOM state, attribute change, or navigation following clicks/inputs (defending against false success claims).
  - `BROWSER_DOWNLOAD_VERIFIED`: Verifies downloaded file existence in authorized scratch space with SHA-256 integrity checks without executing the file.

### D. Permission Gateway (`server/desktop/permissionGate.js`)

- **Current State:** Role-based permission matrix (JARVIS vs ULTRON) with `WEB_BROWSER` category currently covering only legacy `open_web_url`.
- **Phase 3 Extension:** Register new browser tools under `WEB_BROWSER` with conservative action-specific risk controls:
  - Read-only operations (`browser_navigate`, `browser_extract_text`, `browser_screenshot`, `browser_get_title`): Permitted under standard assistant policy.
  - Controlled inputs (`browser_fill_form`, `browser_click_element`): Permitted on authorized sites, with form submissions and authentication requiring approval gating.
  - Dangerous actions (downloads of executable files, external financial transactions, irreversible account changes): Strictly blocked or requiring explicit single-use approval tokens.

### E. Emergency Stop Controller (`server/emergencyStopController.js`)

- **Current State:** Microsecond latching (<25ms), abort stream broadcasting, task cancellation, and process tree termination (`taskkill.exe /F /T`).
- **Phase 3 Extension:** Register active Playwright browser process PIDs and browser contexts with `emergencyStopControllerInstance`. When Emergency Stop triggers, all active browser contexts will be closed immediately, pending navigation/wait promises aborted, and any lingering Chromium processes forcefully terminated via `taskkill.exe /F /T`.

### F. Tools Registry (`server/toolsRegistry.js`)

- **Current State:** Contains 261 allowlisted capabilities across desktop, files, memory, and telemetry.
- **Phase 3 Extension:** Register official browser tools:
  - `browser_open`: Launch browser context/page.
  - `browser_navigate`: Navigate to validated HTTP/HTTPS URL.
  - `browser_extract_text`: Extract visible text or structured elements via semantic selectors.
  - `browser_click`: Click element with wait condition and post-click DOM verification.
  - `browser_fill`: Fill input fields with validation and secret masking.
  - `browser_screenshot`: Capture page/element screenshot to authorized scratch path.
  - `browser_close`: Cleanly tear down browser page and context.

---

## 3. DEPENDENCIES & RUNTIME ENVIRONMENT AUDIT

- **Installed Version:** `playwright` v1.58.0 and `playwright-core` v1.65.0.
- **Managed Browser:** Official Playwright Chromium (Chrome for Testing 158.0.8127.18 / v1254) downloaded to `C:\Users\upadh\AppData\Local\ms-playwright\chromium-1254`.
- **System Browsers Available:** Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) and Microsoft Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`).
- **Runtime Compatibility:** Node.js v22.23.2 on Windows 10/11 x64 verified operational with managed Chromium.

---

## 4. SECURITY & UNTRUSTED WEBPAGE CONTENT DEFENSE

All webpage content is treated as **untrusted data**:

1. **Prompt Injection Neutralization:** Webpage text, headers, and metadata are tagged with `<UNTRUSTED_EXTERNAL_WEB_CONTENT>` barriers before passing to AI adapters or memory. Under no circumstances will text found on a website be interpreted as a directive to execute shell commands, alter system files, or bypass security rules.
2. **Navigation Restrictions & SSRF Defense:**
   - Prohibit dangerous schemes (`javascript:`, `file:`, `data:`, `vbscript:`).
   - Prohibit access to loopback (`127.0.0.1`, `localhost`), internal private network ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata services (`169.254.169.254`), with an explicit exception only for authorized loopback test fixtures on port 3000 during test suite execution.
3. **No Automatic File Execution:** Downloaded files are placed in isolated scratch storage (`D:\Jarvis\scratch\downloads`) with non-executable permissions. Automatic execution is strictly prohibited.
4. **Credential & Secret Protection:** Credentials, session tokens, cookies, and CDP endpoints are excluded from audit logs, screenshots, and persistent memory.

---

## 5. PLANNED ACCEPTANCE TEST SCENARIOS (TESTS A – L)

The acceptance suite `test_stark_browser_automation_acceptance_suite.js` will verify:

- **TEST A (Lifecycle):** Launch browser, create context, open page, verify PID, and close cleanly.
- **TEST B (Navigation):** Navigate to controlled test fixture, verify URL and title.
- **TEST C (Extraction):** Extract structured text and table data using semantic selectors.
- **TEST D (Interaction):** Click interactive button and verify DOM state change.
- **TEST E (Form Handling):** Fill test form fields, select options, and inspect values.
- **TEST F (Multi-Page DAG):** Multi-node DAG navigating multiple pages in dependency order.
- **TEST G (Prompt Injection Defense):** Place malicious prompts on page; verify they cannot hijack execution.
- **TEST H (Navigation Security):** Enforce SSRF defenses and block disallowed schemes.
- **TEST I (Cancellation & E-Stop):** Interrupt browser operations and verify zero orphaned processes.
- **TEST J (False Success Defense):** Detect and reject operations that claim success without DOM effect.
- **TEST K (Download Safety):** Controlled download handling without automatic execution.
- **TEST L (End-to-End Workflow):** Objective -> Research 3 items -> Compare -> Word Report -> Verification.

---
*Audit approved by Principal AI Systems Architect & QA Lead. Proceeding to implementation.*
