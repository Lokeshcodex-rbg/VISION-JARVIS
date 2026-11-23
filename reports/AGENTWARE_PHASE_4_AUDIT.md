# STARK AI / J.A.R.V.I.S. — AGENTWARE TRACK 6

## PHASE 4 PRE-IMPLEMENTATION AUDIT: AUTONOMY, PERMISSION HIERARCHY & HOSTILE INPUT DEFENSE

**Project Location:** `D:\Jarvis`  
**Host Environment:** Windows 10/11 x64, Node.js v22.23.2, Python 3.12.10  
**Audit Date:** 2026-11-08  
**Auditor:** Principal AI Systems Architect & QA Lead  
**Target Phase:** Phase 4 (Permission Hierarchy, Autonomy Model, and Hostile Input Defense)

---

## 1. EXECUTIVE SUMMARY

Following the successful completion of Phase 1 (Architecture Stabilization), Phase 2 (Generalized Autonomous DAG Engine), and Phase 3 (Real Browser Automation & Playwright/CDP Engine) with 455/455 passing regression assertions, Phase 4 focuses on hardening JARVIS's security perimeter.

This audit evaluates the current permission architecture, designs the formal 5-tier permission hierarchy (Levels 0–4), establishes a strict code-level trust boundary, and defines comprehensive defenses against direct and indirect prompt injection across all input modalities (web, documents, tool outputs, and voice).

---

## 2. EXISTING ARCHITECTURE & GAP ANALYSIS

### A. Current Permission Management

- **Existing Files:**
  - `server/desktop/permissionGate.js`: Category-based policy (JARVIS vs ULTRON) with approval checks for a small list of destructive tools (`approvalRequiredTools`).
  - `server/securityPermissions.js`: Single-use cryptographic approval tokens with 60-second TTL, basic injection regexes, and workspace path resolution.
  - `server/desktop/permissionManager.js`: 14 user-configurable toggles in `data/permission_profiles.json`.
- **Gaps to Address:**
  - Standardize into the formal 5-tier classification (Levels 0 through 4) specified in Directive Section 6.
  - Implement dynamic, revocable, and time-bounded authorization scopes for autonomous execution.
  - Formally prevent the AI model from self-approving its own sensitive operations.
  - Ensure untrusted external data (webpages, documents, tool outputs) cannot grant permissions or trigger elevation.

### B. Current Prompt Injection & Untrusted Input Handling

- **Existing Files:**
  - `server/browser/browserAutomationEngine.js`: `sanitizeWebText` tags web content with `[UNTRUSTED_WEB_DATA_BEGIN]` and detects common adversarial patterns.
  - `server/documentIntelligenceEngine.js`: Scans incoming PDFs and Word documents for prompt injection signatures.
- **Gaps to Address:**
  - Consolidate all hostile input defenses into an authoritative `server/security/trustBoundaryManager.js`.
  - Enforce the 4-tier Trust Hierarchy in code:
    1. Application Security Policies (Immutable)
    2. Explicit User-Authorized Task Scope
    3. Trusted Application Configuration
    4. Tool Output and External Content as Untrusted Data
  - Provide comprehensive detection and neutralization across indirect prompt injections, fake system messages, credential exfiltration, and tool-output manipulation.

### C. Secret Redaction & Leak Prevention

- **Existing State:** `permissionGate.js` has `redactObj` and regex replacements for Bearer tokens and passwords.
- **Gaps to Address:** Guarantee that API keys (Gemini, Fish Audio, OpenAI, Anthropic), session tokens, passwords, and private credentials are never leaked in tool outputs, audit logs, or AI prompt contexts.

---

## 3. FORMAL 5-TIER PERMISSION HIERARCHY SPECIFICATION

| Level | Name | Scope & Capabilities | Approval Requirement | Examples |
| :---: | :--- | :--- | :---: | :--- |
| **0** | **READ_ONLY** | Read authorized files, inspect system state, research websites, observe telemetry | None (Preauthorized) | `read_text_file`, `get_current_time`, `browser_extract_text`, `get_system_telemetry` |
| **1** | **REVERSIBLE_OPERATIONS** | Create documents, write scratch files, organize approved folders, safe calculations | None (Preauthorized) | `create_file`, `create_word_document`, `copy_file`, `rename_file` |
| **2** | **CONTROLLED_AUTOMATION** | Launch allowlisted apps, execute harmless shell commands, multi-step browser flows | Preauthorized within scope | `browser_navigate`, `browser_click`, `execute_controlled_shell_command` |
| **3** | **SENSITIVE_OPERATIONS** | External messaging, account modifications, destructive writes, privilege elevation | **Explicit User Approval Required** | `close_desktop_app_force`, `execute_administrative_elevation`, `apply_code_patch`, `send_gmail_draft` |
| **4** | **PROHIBITED_OPERATIONS** | Credential theft, unauthorized network scanning, OS security bypasses, malware | **Strictly Forbidden (Never Permitted)** | Modifying system registry/system32, disabling E-Stop, dumping passwords |

---

## 4. TRUST HIERARCHY & DEFENSE IMPLEMENTATION PLAN

1. Create `server/security/trustBoundaryManager.js`:
   - Enforce 4-tier Trust Hierarchy.
   - Centralize prompt injection classification across all modalities.
   - Seal untrusted data with cryptographic integrity tags and sanitize adversarial patterns.
   - Block agent self-approval attempts.
   - Comprehensive secret redaction engine covering all sensitive keys and tokens.
2. Upgrade `server/desktop/permissionGate.js`:
   - Map all 271 registered tools to formal Levels 0–4.
   - Implement dynamic authorization scopes with TTL expiration and immediate revocation (`revokeScope()`).
   - Validate single-use approval tokens for Level 3 sensitive tools.
   - Immediately reject Level 4 prohibited operations.
3. Acceptance Test Suite:
   - Create `test_stark_security_autonomy_acceptance_suite.js` covering all security, permission, and anti-injection requirements.

---
*Audit approved by Principal AI Systems Architect & QA Lead. Proceeding to implementation.*
