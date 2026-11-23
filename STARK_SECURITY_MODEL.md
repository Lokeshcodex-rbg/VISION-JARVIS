# STARK AI — Security Model, Governance & Permission Gate

**Document Version:** 3.0.0  
**Project Workspace:** `D:\Jarvis`  
**Classification:** Defense-in-Depth Architecture, Immutable Security Core & Dual Governance  

---

## 1. Security Architecture Principles

STARK AI is designed to operate with broad, practical autonomy while enforcing strict, inviolable safety boundaries. Autonomy without architectural constraints is dangerous; security without autonomy defeats the purpose of an AI assistant. The platform balances both through an authoritative **Permission Gate** and an **Immutable Security Core**.

### Core Tenets

1. **Never Trust External Content:** All retrieved web pages, external API payloads, documents, messages, code comments, and tool outputs are treated as untrusted data. Instructions embedded in external data can never override user authorization or system policy.
2. **Inviolable Security Core:** The AI cannot rewrite its own security boundaries, hide its audit log, disable the emergency stop, or grant itself elevated privileges.
3. **Local Emergency Stop Independence:** The emergency stop controller operates locally and synchronously. It never waits for an LLM to approve or process the stop command.
4. **Single-Use Approval Tokens:** Destructive, irreversible operations (bulk deletion, killing arbitrary processes, applying code patches, administrative elevation) require a single-use cryptographic token granted explicitly by the user.
5. **Credential Privacy:** API keys, session tokens, passwords, and private user files are redacted from all UI screens, logs, telemetry payloads, and exportable reports.
6. **Owner Identity & Privacy Lock:** When privacy mode is active, sensitive memories, private project files, and personal communication tools remain locked unless the enrolled owner profile is verified.

---

## 2. Inviolable Core Assets (`IMMUTABLE_CORE_ASSETS`)

The self-coding engine ([`server/selfDevelopmentEngine.js`](file:///d:/Jarvis/server/selfDevelopmentEngine.js)) and self-repair service ([`server/selfRepairService.js`](file:///d:/Jarvis/server/selfRepairService.js)) have a hardcoded, non-overridable blacklist of protected core files:

- `server/securityPermissions.js`
- `server/desktop/permissionGate.js`
- `server/desktop/permissionManager.js`
- `server/selfRepairService.js`
- `server/selfDevelopmentEngine.js`
- `server/capabilityRegistry.js`
- `server/emergencyStopController.js`
- `js/modules/emergencyStopCoordinator.js`
- `desktop/main.js`

Any attempt by an autonomous agent, task, or prompt to create, edit, overwrite, or delete these files triggers an immediate security exception:

```text
Security Policy Rejection: File "<path>" is an immutable security core asset.
Modifications to trusted security and capability boundaries are strictly prohibited.
```

---

## 3. Dual Persona Governance & Permission Separation

The platform enforces strict behavioral and tool access separation between its two distinct personas:

### 3.1 JARVIS — Autonomous Personal Assistant

- **Governance:** Broad assistant autonomy within authorized project workspaces.
- **Permitted Domains:**
  - Spoken conversation and language switching (English, Hindi, Hinglish).
  - Application launching and desktop window focus (WhatsApp, Chrome, VS Code, Explorer, Settings).
  - Sandboxed file creation, editing, and organization in `D:\Jarvis` and allowed folders.
  - Scientific mathematical modeling, physics solvers, and OpenSCAD CAD synthesis.
  - Multi-step autonomous task planning and tool orchestration.
  - Camera device discovery, screen OCR, and multi-frame differential analysis.

### 3.2 ULTRON — Restricted Systems Analyst

- **Governance:** Strictly restricted read-only analysis governance.
- **Enforcement:**
  - Blocked from launching desktop applications (`open_desktop_app`, `launch_application`).
  - Blocked from creating, editing, renaming, or deleting files (`create_file`, `edit_file`, `delete_file`).
  - Blocked from drafting or sending WhatsApp communications.
  - Blocked from generating CAD models or modifying system settings.
  - Permitted only read-only telemetry inspection, static security vulnerability scanning, and mathematical research calculations.

---

## 4. Single-Use Cryptographic Approval Tokens

When an operation is classified as **High Risk** (e.g. `apply_code_patch`, `close_desktop_app_force`, `execute_administrative_elevation`), the permission gate generates a cryptographically random token:

```javascript
const approvalToken = crypto.randomBytes(16).toString('hex');
```

- **Validity Window (TTL):** 60 seconds from creation.
- **Action Binding:** The token is cryptographically bound to the exact target action and arguments.
- **Consumption:** The token is immediately deleted and invalidated upon first use. Replay attempts trigger an immediate exception.

---

## 5. Owner Identity & Privacy Lock

Implemented in [server/desktop/ownerIdentityService.js](file:///d:/Jarvis/server/desktop/ownerIdentityService.js):

- **Local Enrollment:** Enrolls owner visual embeddings locally with explicit user consent.
- **Privacy Lock:** When enabled, private memories, personal project files, and sensitive tools are restricted until verified.
- **Honest Epistemics:** The system explicitly distinguishes between face detection, matching confidence thresholds, and identity verification. It never guesses identities from casual appearance.

---

## 6. Secret-Redacting Audit Logging

All consequential tool executions, elevation requests, permission denials, and emergency stop triggers are logged to an append-only audit trail in [server/desktop/permissionGate.js](file:///d:/Jarvis/server/desktop/permissionGate.js):

- **Automatic Scrubbing:** Strings matching `api_key`, `sk-...`, `Bearer ...`, passwords, and private tokens are replaced with `[REDACTED_SECRET]`.
- **Structured Fields:** Audit event ID (`audit_<timestamp>_<random>`), ISO timestamp, action name, personality context, and sanitized payload details.
- **Inspectability:** Accessible via authenticated endpoint `GET /api/security/audit-log`.
