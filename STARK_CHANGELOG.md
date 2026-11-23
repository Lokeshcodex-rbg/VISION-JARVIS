# STARK AI — System Upgrade Changelog

All notable changes, architectural improvements, bug fixes, and capability expansions for the STARK AI platform are documented in this file.

---

## [3.0.0] — 2026-10-27 (Zero-Lag Conversation, Partner Personality & True Emergency Stop)

### Added

- **Centralized Emergency Stop System:** Created [js/modules/emergencyStopCoordinator.js](file:///d:/Jarvis/js/modules/emergencyStopCoordinator.js) on renderer and [server/emergencyStopController.js](file:///d:/Jarvis/server/emergencyStopController.js) on backend. Synchronously halts active speech audio (<1ms), purges sentence queues, stops microphone VAD/recognition, aborts AI requests, terminates active camera/screen capture, cancels in-flight task orchestrator steps, and transitions the UI to a persistent STOPPED state.
- **Sticky Latch & Controlled Resume:** Prevents auto-restart from delayed callbacks, mouse gestures, or background loops. Normal operation resumes only through an explicit user Resume action.
- **Space-Bar Global Emergency Shortcut:** Space-bar reliably activates the emergency stop while protecting text input fields (`<input>`, `<textarea>`, contenteditable) from accidental triggers while typing.
- **Progressive Smoke Captions:** Implemented `appendAssistantStream(token)` in [js/modules/smokeCaptions.js](file:///d:/Jarvis/js/modules/smokeCaptions.js) to render streaming words incrementally as tokens arrive over Server-Sent Events (<26ms).
- **Latency Telemetry & Phase Tracker:** Overhauled [server/latencyTracker.js](file:///d:/Jarvis/server/latencyTracker.js) to track 10 granular pipeline phases with median and 95th-percentile statistics without storing raw conversation audio or private text.
- **Master Engineering Documentation (12 System Documents):**
  - [`STARK_MASTER_ARCHITECTURE.md`](file:///d:/Jarvis/STARK_MASTER_ARCHITECTURE.md)
  - [`STARK_CAPABILITY_MATRIX.md`](file:///d:/Jarvis/STARK_CAPABILITY_MATRIX.md)
  - [`STARK_KNOWLEDGE_SYSTEM.md`](file:///d:/Jarvis/STARK_KNOWLEDGE_SYSTEM.md)
  - [`STARK_PHYSICS_ENGINE.md`](file:///d:/Jarvis/STARK_PHYSICS_ENGINE.md)
  - [`STARK_ENGINEERING_LAB.md`](file:///d:/Jarvis/STARK_ENGINEERING_LAB.md)
  - [`STARK_ROBOTICS_ROADMAP.md`](file:///d:/Jarvis/STARK_ROBOTICS_ROADMAP.md)
  - [`STARK_AEROSPACE_ROADMAP.md`](file:///d:/Jarvis/STARK_AEROSPACE_ROADMAP.md)
  - [`STARK_SECURITY_MODEL.md`](file:///d:/Jarvis/STARK_SECURITY_MODEL.md)
  - [`STARK_TEST_REPORT.md`](file:///d:/Jarvis/STARK_TEST_REPORT.md)
  - [`STARK_IMPLEMENTATION_ROADMAP.md`](file:///d:/Jarvis/STARK_IMPLEMENTATION_ROADMAP.md)
  - [`STARK_KNOWN_LIMITATIONS.md`](file:///d:/Jarvis/STARK_KNOWN_LIMITATIONS.md)
  - [`STARK_CHANGELOG.md`](file:///d:/Jarvis/STARK_CHANGELOG.md)
- **Dedicated Automated Verification Suite:**
  - [`test_stark_zero_lag_and_emergency_stop.js`](file:///d:/Jarvis/test_stark_zero_lag_and_emergency_stop.js) (72/72 tests passed).

### Changed

- **Partner Personality System Prompts:** Rewrote `BASE_JARVIS_PROMPT` and `STREAMLINED_JARVIS_PROMPT` in [server/personalityPrompts.js](file:///d:/Jarvis/server/personalityPrompts.js) to speak warmly, confidently, and concisely; understand task continuity; admit tool failures honestly; and maintain non-biological grounding.
- **Tool Registry Expansion:** Added `set_language_mode`, `get_language_mode`, `list_tasks`, `create_task`, `complete_task`, `list_memories`, `add_user_memory`, and `run_system_diagnostics` into [server/toolsRegistry.js](file:///d:/Jarvis/server/toolsRegistry.js) and [server/desktop/permissionGate.js](file:///d:/Jarvis/server/desktop/permissionGate.js).
- **Tool Emergency Stop Protection:** Enforced `emergencyStopControllerInstance.isEngaged()` check at the top of `executeTool()` in [server/toolsRegistry.js](file:///d:/Jarvis/server/toolsRegistry.js) to strictly block tool calls while stopped.
- **Inviolable Core Assets:** Added `emergencyStopController.js`, `emergencyStopCoordinator.js`, and `desktop/main.js` to `IMMUTABLE_CORE_ASSETS` in [server/selfDevelopmentEngine.js](file:///d:/Jarvis/server/selfDevelopmentEngine.js) and [server/selfRepairService.js](file:///d:/Jarvis/server/selfRepairService.js).
- **Prompt Context Injection:** Ensured deterministic local clock and relevant semantic memories are always injected into prompt context in [server/aiProviderAdapter.js](file:///d:/Jarvis/server/aiProviderAdapter.js).

### Fixed

- **Space-Bar Audio Leak:** Fixed bug in `js/app.js` where pressing space bar merely paused visual canvas animation while TTS audio synthesis kept speaking and mic kept recording.
- **Audio Gesture Auto-Restart Loop:** Fixed `enableVoiceGesture` in `js/app.js` so clicking or pressing keys while stopped will not re-arm voice listening.
- **Speech Synthesizer Auto-Listening Transition:** Prevented `speechSynthesizer.cancel()` from transitioning state to `LISTENING` when cancellation reason is `EMERGENCY_STOP`.
- **DAG Task Step Cancellation:** Added async yield and emergency stop check before each step in [server/taskOrchestrator.js](file:///d:/Jarvis/server/taskOrchestrator.js) so in-flight tasks halt immediately on stop engagement.

---

## [2.0.0] — 2026-10-26 (JARVIS-Level Master System Upgrade)

### Added

- **12 Explicit Voice Lifecycle States:** Implemented full event-driven lifecycle in [`js/modules/conversationSessionManager.js`](file:///d:/Jarvis/js/modules/conversationSessionManager.js).
- **Live Capability Registry ([`server/capabilityRegistry.js`](file:///d:/Jarvis/server/capabilityRegistry.js)):** Real-time capability inventory tracking 18 capabilities, execution latencies, and grounding classifications.
- **Empirical Experiment Ledger ([`server/experimentLedger.js`](file:///d:/Jarvis/server/experimentLedger.js)):** Persistent record of benchmarks and regression tracking.
- **Technical Explainer ([`server/technicalExplainer.js`](file:///d:/Jarvis/server/technicalExplainer.js)):** Automated generation of technical reproduction guides with exact closed-form LaTeX equations.

---

## [1.0.0] — Earlier Baseline

- Initial dual AI ocular interface with crimson ULTRON and cyan JARVIS themes.
- Basic Web Speech API and Gemini API integration.
- Preliminary PowerShell desktop command execution.
