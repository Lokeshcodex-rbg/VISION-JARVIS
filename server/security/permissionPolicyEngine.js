/**
 * VISION AI — Central Permission Policy Engine & Autonomy Model
 * Enforces a strict, unified 5-tier permission hierarchy (Levels 0–4)
 * across every tool execution, DAG node, browser action, desktop command,
 * shell execution, filesystem operation, and memory mutation.
 * 
 * Strict Enforcement Guarantees:
 * 1. Level 0 (Read-Only): Preauthorized within authorized paths & public sites.
 * 2. Level 1 (Reversible Local): Preauthorized in authorized scratch/workspace areas.
 * 3. Level 2 (Controlled Automation): Preauthorized within declared DAG task scope.
 * 4. Level 3 (Sensitive / External): Strictly PAUSES for explicit single-use human approval.
 * 5. Level 4 (Restricted / Destructive): DENIED BY DEFAULT. Cannot be broadly preauthorized.
 * 6. Model Self-Approval & Web-Prompt Approval: STRICTLY FORBIDDEN.
 * 7. Emergency Stop: Immediately overrides and terminates all levels.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const PERMISSION_LEVELS = {
  LEVEL_0_READ_ONLY: 0,
  LEVEL_1_REVERSIBLE_LOCAL: 1,
  LEVEL_2_CONTROLLED_AUTOMATION: 2,
  LEVEL_3_SENSITIVE_EXTERNAL: 3,
  LEVEL_4_RESTRICTED_DESTRUCTIVE: 4
};

const POLICY_DECISIONS = {
  ALLOW: 'ALLOW',
  ALLOW_WITH_LIMITS: 'ALLOW_WITH_LIMITS',
  REQUIRE_APPROVAL: 'REQUIRE_APPROVAL',
  DENY: 'DENY'
};

const DENIAL_REASONS = {
  EMERGENCY_STOP_ACTIVE: 'EMERGENCY_STOP_ACTIVE: Operation rejected while Emergency Stop latch is engaged.',
  LEVEL_4_PROHIBITED: 'LEVEL_4_PROHIBITED: Destructive or security-critical operation is prohibited by default.',
  UNAUTHORIZED_PATH: 'UNAUTHORIZED_PATH: Target filesystem path is outside authorized workspace boundaries.',
  UNAUTHORIZED_DESTINATION: 'UNAUTHORIZED_DESTINATION: Network destination violates SSRF or security boundaries.',
  APPROVAL_REQUIRED_MISSING: 'APPROVAL_REQUIRED_MISSING: Action requires explicit human approval before execution.',
  APPROVAL_EXPIRED: 'APPROVAL_EXPIRED: Provided approval token has expired and is no longer valid.',
  APPROVAL_INVALID_ARGUMENTS: 'APPROVAL_INVALID_ARGUMENTS: Action arguments do not match approved constraints.',
  APPROVAL_INVALID_ACTION: 'APPROVAL_INVALID_ACTION: Approval token was issued for a different tool or target.',
  APPROVAL_ALREADY_CONSUMED: 'APPROVAL_ALREADY_CONSUMED: Single-use approval token has already been consumed.',
  APPROVAL_SELF_APPROVAL_PROHIBITED: 'APPROVAL_SELF_APPROVAL_PROHIBITED: Agent cannot approve its own sensitive operations.',
  UNTRUSTED_SOURCE_PROHIBITED: 'UNTRUSTED_SOURCE_PROHIBITED: Webpages and untrusted inputs cannot grant authorization.',
  ULTRON_RESTRICTED_GOVERNANCE: 'ULTRON_RESTRICTED_GOVERNANCE: Action is prohibited under ULTRON read-only policy.'
};

// Default Tool Classification Matrix
const TOOL_DEFINITIONS = {
  // Level 0: Read-Only
  get_current_time: { level: 0, reversible: true, external: false, sensitive: false },
  get_timezone_time: { level: 0, reversible: true, external: false, sensitive: false },
  calculate_time_offset: { level: 0, reversible: true, external: false, sensitive: false },
  calculate_date_difference: { level: 0, reversible: true, external: false, sensitive: false },
  get_weather: { level: 0, reversible: true, external: false, sensitive: false },
  read_text_file: { level: 0, reversible: true, external: false, sensitive: false },
  read_file: { level: 0, reversible: true, external: false, sensitive: false },
  list_files: { level: 0, reversible: true, external: false, sensitive: false },
  search_files: { level: 0, reversible: true, external: false, sensitive: false },
  inspect_file_metadata: { level: 0, reversible: true, external: false, sensitive: false },
  get_system_telemetry: { level: 0, reversible: true, external: false, sensitive: false },
  run_system_diagnostics: { level: 0, reversible: true, external: false, sensitive: false },
  browser_extract_text: { level: 0, reversible: true, external: false, sensitive: false },
  browser_extract_structured: { level: 0, reversible: true, external: false, sensitive: false },
  browser_screenshot: { level: 0, reversible: true, external: false, sensitive: false },
  search_memories: { level: 0, reversible: true, external: false, sensitive: false },
  list_memories: { level: 0, reversible: true, external: false, sensitive: false },
  get_project_memory: { level: 0, reversible: true, external: false, sensitive: false },
  inspect_pdf_document: { level: 0, reversible: true, external: false, sensitive: false },
  rag_search_documents: { level: 0, reversible: true, external: false, sensitive: false },
  rag_get_document_status: { level: 0, reversible: true, external: false, sensitive: false },
  reasoning_solve_problem: { level: 0, reversible: true, external: false, sensitive: false },
  language_analyze_text: { level: 0, reversible: true, external: false, sensitive: false },
  database_inspect_schema: { level: 0, reversible: true, external: false, sensitive: false },
  database_explain_query: { level: 0, reversible: true, external: false, sensitive: false },
  datascience_analyze_dataset: { level: 0, reversible: true, external: false, sensitive: false },
  observability_get_diagnostics: { level: 0, reversible: true, external: false, sensitive: false },
  ml_train_and_evaluate: { level: 1, reversible: true, external: false, sensitive: false },
  automation_run_workflow: { level: 1, reversible: true, external: false, sensitive: false },
  rag_index_document: { level: 1, reversible: true, external: false, sensitive: false },
  rag_delete_document: { level: 1, reversible: true, external: false, sensitive: false },
  verify_document: { level: 0, reversible: true, external: false, sensitive: false },
  get_language_mode: { level: 0, reversible: true, external: false, sensitive: false },
  set_language_mode: { level: 0, reversible: true, external: false, sensitive: false },
  get_desktop_agent_status: { level: 0, reversible: true, external: false, sensitive: false },
  capture_desktop_screenshot: { level: 0, reversible: true, external: false, sensitive: false },
  inspect_ui_hierarchy: { level: 0, reversible: true, external: false, sensitive: false },
  list_open_windows: { level: 0, reversible: true, external: false, sensitive: false },
  get_clipboard_text: { level: 0, reversible: true, external: false, sensitive: false },

  // Phase 9 Autonomous Learning & Skills (Level 0)
  retrieve_experiences: { level: 0, reversible: true, external: false, sensitive: false },
  get_learning_metrics: { level: 0, reversible: true, external: false, sensitive: false },
  list_skills: { level: 0, reversible: true, external: false, sensitive: false },
  inspect_skill: { level: 0, reversible: true, external: false, sensitive: false },
  get_learned_preferences: { level: 0, reversible: true, external: false, sensitive: false },

  // Phase 10 Advanced Voice & Conversational Intelligence (Level 0)
  transcribe_voice_audio: { level: 0, reversible: true, external: false, sensitive: false },
  get_voice_metrics: { level: 0, reversible: true, external: false, sensitive: false },
  get_user_availability: { level: 0, reversible: true, external: false, sensitive: false },
  get_whatsapp_conversation_history: { level: 0, reversible: true, external: false, sensitive: false },

  // Level 1: Reversible Local Operations
  create_file: { level: 1, reversible: true, external: false, sensitive: false },
  write_text_file: { level: 1, reversible: true, external: false, sensitive: false },
  create_word_document: { level: 1, reversible: true, external: false, sensitive: false },
  create_excel_workbook: { level: 1, reversible: true, external: false, sensitive: false },
  create_excel_spreadsheet: { level: 1, reversible: true, external: false, sensitive: false },
  verify_excel_spreadsheet: { level: 0, reversible: true, external: false, sensitive: false },
  create_presentation: { level: 1, reversible: true, external: false, sensitive: false },
  verify_presentation: { level: 0, reversible: true, external: false, sensitive: false },
  analyze_spreadsheet: { level: 1, reversible: true, external: false, sensitive: false },
  focus_desktop_window: { level: 1, reversible: true, external: false, sensitive: false },
  minimize_desktop_window: { level: 1, reversible: true, external: false, sensitive: false },
  maximize_desktop_window: { level: 1, reversible: true, external: false, sensitive: false },
  switch_desktop_window: { level: 1, reversible: true, external: false, sensitive: false },
  set_window_geometry: { level: 1, reversible: true, external: false, sensitive: false },
  set_window_state: { level: 1, reversible: true, external: false, sensitive: false },
  set_clipboard_text: { level: 1, reversible: true, external: false, sensitive: false },
  copy_file: { level: 1, reversible: true, external: false, sensitive: false },
  rename_file: { level: 1, reversible: true, external: false, sensitive: false },
  convert_pdf_to_word: { level: 1, reversible: true, external: false, sensitive: false },
  save_memory: { level: 1, reversible: true, external: false, sensitive: false },
  save_project_memory: { level: 1, reversible: true, external: false, sensitive: false },
  correct_memory: { level: 1, reversible: true, external: false, sensitive: false },

  // Phase 9 Autonomous Learning & Skills (Level 1)
  record_experience: { level: 1, reversible: true, external: false, sensitive: false },
  register_skill: { level: 1, reversible: true, external: false, sensitive: false },
  submit_user_feedback: { level: 1, reversible: true, external: false, sensitive: false },
  correct_learned_preference: { level: 1, reversible: true, external: false, sensitive: false },
  remove_learned_preference: { level: 1, reversible: true, external: false, sensitive: false },
  propose_self_improvement: { level: 1, reversible: true, external: false, sensitive: false },

  // Phase 10 Advanced Voice & Conversational Intelligence (Level 1)
  synthesize_voice_speech: { level: 1, reversible: true, external: false, sensitive: false },
  configure_wake_word: { level: 1, reversible: true, external: false, sensitive: false },
  set_voice_mute: { level: 1, reversible: true, external: false, sensitive: false },
  interrupt_voice_speech: { level: 1, reversible: true, external: false, sensitive: false },
  persist_conversational_memory: { level: 1, reversible: true, external: false, sensitive: false },

  // Phase 11 Multimodal Tools (Level 0/1)
  analyze_document_multimodal: { level: 0, reversible: true, external: false, sensitive: false },
  compare_documents_multimodal: { level: 0, reversible: true, external: false, sensitive: false },
  answer_document_vqa: { level: 0, reversible: true, external: false, sensitive: false },
  analyze_video_multimodal: { level: 0, reversible: true, external: false, sensitive: false },
  stop_camera_stream: { level: 1, reversible: true, external: false, sensitive: false },
  get_neural_brain_status: { level: 0, reversible: true, external: false, sensitive: false },
  run_neural_brain_cycle: { level: 2, reversible: true, external: false, sensitive: false },

  // Phase 12 Scientific, Math & Engineering Intelligence Tools (Level 0/1)
  solve_symbolic_math: { level: 0, reversible: true, external: false, sensitive: false },
  compute_calculus_math: { level: 0, reversible: true, external: false, sensitive: false },
  matrix_operations_math: { level: 0, reversible: true, external: false, sensitive: false },
  physics_problem_solver: { level: 0, reversible: true, external: false, sensitive: false },
  data_science_statistics: { level: 0, reversible: true, external: false, sensitive: false },
  scientific_research_hypothesis: { level: 0, reversible: true, external: false, sensitive: false },
  engineering_system_analyzer: { level: 1, reversible: true, external: false, sensitive: false },
  scientific_visualization_plot: { level: 1, reversible: true, external: false, sensitive: false },

  // Level 2: Controlled Operational Automation
  browser_open: { level: 2, reversible: true, external: false, sensitive: false },
  browser_navigate: { level: 2, reversible: true, external: true, sensitive: false },
  browser_click: { level: 2, reversible: true, external: false, sensitive: false },
  browser_fill: { level: 2, reversible: true, external: false, sensitive: false },
  browser_select: { level: 2, reversible: true, external: false, sensitive: false },
  browser_download: { level: 2, reversible: true, external: false, sensitive: false },
  browser_close: { level: 2, reversible: true, external: false, sensitive: false },
  open_web_url: { level: 2, reversible: true, external: true, sensitive: false },
  execute_controlled_shell_command: { level: 2, reversible: true, external: false, sensitive: false },
  execute_shell_command: { level: 2, reversible: true, external: false, sensitive: false },
  write_notepad_document: { level: 2, reversible: true, external: false, sensitive: false },
  open_desktop_app: { level: 2, reversible: true, external: false, sensitive: false },
  launch_desktop_app: { level: 2, reversible: true, external: false, sensitive: false },
  launch_chrome_profile: { level: 2, reversible: true, external: false, sensitive: false },
  open_chrome_profile: { level: 2, reversible: true, external: false, sensitive: false },
  open_gmail: { level: 2, reversible: true, external: true, sensitive: false },
  focus_desktop_app: { level: 2, reversible: true, external: false, sensitive: false },
  close_desktop_app: { level: 2, reversible: true, external: false, sensitive: false },
  send_desktop_keystrokes: { level: 2, reversible: true, external: false, sensitive: false },
  send_desktop_hotkey: { level: 2, reversible: true, external: false, sensitive: false },
  desktop_mouse_click: { level: 2, reversible: true, external: false, sensitive: false },
  desktop_mouse_scroll: { level: 2, reversible: true, external: false, sensitive: false },
  set_timer: { level: 2, reversible: true, external: false, sensitive: false },
  create_reminder: { level: 2, reversible: true, external: false, sensitive: false },

  // Phase 9 Autonomous Learning & Skills (Level 2)
  execute_skill: { level: 2, reversible: true, external: false, sensitive: false },
  promote_skill: { level: 2, reversible: true, external: false, sensitive: false },
  generate_adaptive_plan: { level: 2, reversible: true, external: false, sensitive: false },
  stage_whatsapp_message: { level: 2, reversible: true, external: false, sensitive: false },
  cancel_whatsapp_send: { level: 1, reversible: true, external: false, sensitive: false },
  set_user_availability: { level: 1, reversible: true, external: false, sensitive: false },
  process_incoming_whatsapp_message: { level: 1, reversible: true, external: false, sensitive: false },
  confirm_incoming_reply: { level: 2, reversible: true, external: false, sensitive: false },

  // Phase 10 Advanced Voice & Conversational Intelligence (Level 2)
  process_conversational_turn: { level: 2, reversible: true, external: false, sensitive: false },

  // Phase 11 Multimodal Tools (Level 2)
  screen_understand_action: { level: 2, reversible: true, external: false, sensitive: false },
  analyze_camera_frame: { level: 2, reversible: true, external: false, sensitive: false },
  multimodal_reasoning: { level: 2, reversible: true, external: false, sensitive: false },

  // Phase 12 Scientific & Engineering Tools (Level 2)
  solve_differential_equations: { level: 2, reversible: true, external: false, sensitive: false },
  machine_learning_workflow: { level: 2, reversible: true, external: false, sensitive: false },
  scientific_simulation_engine: { level: 2, reversible: true, external: false, sensitive: false },

  // Phase 13 Autonomous Objective Execution & Operational Reliability Tools
  get_autonomous_task_status: { level: 0, reversible: true, external: false, sensitive: false },
  verify_desktop_window: { level: 0, reversible: true, external: false, sensitive: false },
  pause_autonomous_task: { level: 1, reversible: true, external: false, sensitive: false },
  resume_autonomous_task: { level: 1, reversible: true, external: false, sensitive: false },
  cancel_autonomous_task: { level: 1, reversible: true, external: false, sensitive: false },
  execute_autonomous_objective: { level: 2, reversible: true, external: false, sensitive: false },

  // Phase 15 Advanced Sensory Intelligence & Universal Computer Use Tools
  enumerate_audio_devices: { level: 0, reversible: true, external: false, sensitive: false },
  enable_audio_loopback: { level: 2, reversible: true, external: false, sensitive: false },
  ingest_audio_loopback_segment: { level: 2, reversible: true, external: false, sensitive: false },
  stop_audio_loopback: { level: 1, reversible: true, external: false, sensitive: false },
  process_full_duplex_voice_frame: { level: 2, reversible: true, external: false, sensitive: false },
  enable_ambient_vision: { level: 2, reversible: true, external: false, sensitive: false },
  observe_ambient_environment_tick: { level: 2, reversible: true, external: false, sensitive: false },
  stop_ambient_vision: { level: 1, reversible: true, external: false, sensitive: false },
  execute_universal_gui_workflow: { level: 2, reversible: true, external: false, sensitive: false },
  enable_private_whisper_copilot: { level: 2, reversible: true, external: false, sensitive: false },
  process_copilot_meeting_turn: { level: 2, reversible: true, external: false, sensitive: false },
  disable_private_whisper_copilot: { level: 1, reversible: true, external: false, sensitive: false },

  // Level 3: Sensitive or External Operations (Requires Human Approval)
  start_camera_stream: { level: 3, reversible: false, external: false, sensitive: true },
  close_desktop_app_force: { level: 3, reversible: false, external: false, sensitive: true },
  execute_administrative_elevation: { level: 3, reversible: false, external: false, sensitive: true },
  apply_code_patch: { level: 3, reversible: false, external: false, sensitive: true },
  deploy_verified_repair: { level: 3, reversible: false, external: false, sensitive: true },
  create_gmail_draft: { level: 3, reversible: false, external: true, sensitive: true },
  send_gmail_draft: { level: 3, reversible: false, external: true, sensitive: true },
  schedule_google_calendar_event: { level: 3, reversible: false, external: true, sensitive: true },
  send_whatsapp_message: { level: 3, reversible: false, external: true, sensitive: true },
  send_whatsapp_voice_message: { level: 3, reversible: false, external: true, sensitive: true },
  send_jarvis_voice_note: { level: 3, reversible: false, external: true, sensitive: true },
  confirm_whatsapp_send: { level: 3, reversible: false, external: true, sensitive: true },
  external_http_post: { level: 3, reversible: false, external: true, sensitive: true },
  delete_file: { level: 3, reversible: false, external: false, sensitive: true },
  delete_file_permanent: { level: 3, reversible: false, external: false, sensitive: true },
  clear_all_memories: { level: 3, reversible: false, external: false, sensitive: true },

  // Phase 9 Autonomous Learning & Skills (Level 3 - Sensitive / Requires Approval)
  apply_self_improvement: { level: 3, reversible: false, external: false, sensitive: true },
  rollback_self_improvement: { level: 3, reversible: false, external: false, sensitive: true },

  // Level 4: Restricted / Destructive Actions (Denied by Default)
  delete_system_critical_file: { level: 4, reversible: false, external: false, sensitive: true },
  modify_security_controls: { level: 4, reversible: false, external: false, sensitive: true },
  disable_emergency_stop: { level: 4, reversible: false, external: false, sensitive: true },
  export_credentials_dump: { level: 4, reversible: false, external: true, sensitive: true },
  bypass_os_sandbox: { level: 4, reversible: false, external: false, sensitive: true },

  // Phase 9 Autonomous Learning & Skills (Level 4 - Strictly Prohibited)
  // Live Document Studio & Voice-Controlled Word Collaboration
  live_document_create: { level: 1, reversible: true, external: false, sensitive: false },
  live_document_revise: { level: 1, reversible: true, external: false, sensitive: false },
  live_document_save: { level: 1, reversible: true, external: false, sensitive: false },
  live_document_send_whatsapp: { level: 2, reversible: true, external: false, sensitive: false },
  live_document_confirm_whatsapp: { level: 2, reversible: false, external: true, sensitive: false },
  live_document_undo: { level: 1, reversible: true, external: false, sensitive: false },
  live_document_status: { level: 0, reversible: true, external: false, sensitive: false },
  live_document_control: { level: 1, reversible: true, external: false, sensitive: false },

  // Autonomous OS, Chrome/YouTube, UIA, WhatsApp Web, RAG, Hardware Telemetry & Robotics Tools
  youtube_search_and_open: { level: 1, reversible: true, external: false, sensitive: false },
  open_youtube_video: { level: 1, reversible: true, external: false, sensitive: false },
  read_window_content: { level: 1, reversible: true, external: false, sensitive: false },
  open_whatsapp_web: { level: 2, reversible: true, external: false, sensitive: false },
  send_whatsapp_attachment: { level: 3, reversible: false, external: true, sensitive: true },
  build_codebase_rag: { level: 0, reversible: true, external: false, sensitive: false },
  search_codebase_rag: { level: 0, reversible: true, external: false, sensitive: false },
  run_autonomous_engineering_loop: { level: 2, reversible: true, external: false, sensitive: false },
  autonomous_engineering_loop: { level: 2, reversible: true, external: false, sensitive: false },
  get_host_hardware_telemetry: { level: 0, reversible: true, external: false, sensitive: false },
  compute_robotic_joint_torque: { level: 0, reversible: true, external: false, sensitive: false },
  generate_robotics_bom_inr: { level: 0, reversible: true, external: false, sensitive: false },
  evaluate_robotics_safety: { level: 0, reversible: true, external: false, sensitive: false },
  add_hardware_inventory: { level: 1, reversible: true, external: false, sensitive: false },
  list_hardware_inventory: { level: 0, reversible: true, external: false, sensitive: false },
  acquire_concept_knowledge: { level: 1, reversible: true, external: false, sensitive: false },
  design_engineering_system: { level: 0, reversible: true, external: false, sensitive: false },
  analyze_design_reference_image: { level: 0, reversible: true, external: false, sensitive: false },
  verify_mathematical_derivation: { level: 0, reversible: true, external: false, sensitive: false },
  remember_project_constraint: { level: 1, reversible: true, external: false, sensitive: false },
  get_developmental_model_status: { level: 0, reversible: true, external: false, sensitive: false },

  modify_protected_security_components: { level: 4, reversible: false, external: false, sensitive: true }
};

class PermissionPolicyEngine {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || path.resolve(__dirname, '..', '..');
    this.approvals = new Map(); // approvalId -> ApprovalRecord
    this.approvalTtlMs = options.approvalTtlMs || 60000; // 60 seconds
  }

  getToolPolicy(toolName) {
    return TOOL_DEFINITIONS[toolName] || { level: 2, reversible: true, external: false, sensitive: false };
  }

  evaluateToolExecution(toolName, args = {}, options = {}) {
    return this.evaluateInvocation({
      toolName,
      args,
      personality: options.personality || 'JARVIS',
      ...options
    });
  }

  /**
   * Evaluates any tool invocation prior to execution and returns an explicit decision
   */
  evaluateInvocation(request = {}) {
    const {
      toolName = '',
      args = {},
      personality = 'JARVIS',
      taskId = null,
      nodeId = null,
      approvalToken = null,
      approvalSource = null,
      originalObjective = '',
      agentId = null
    } = request;

    // 1. Emergency Stop Check (Highest priority invariant)
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      return {
        decision: POLICY_DECISIONS.DENY,
        level: PERMISSION_LEVELS.LEVEL_4_RESTRICTED_DESTRUCTIVE,
        reason: DENIAL_REASONS.EMERGENCY_STOP_ACTIVE,
        toolName,
        redactedArgs: this.redactSecrets(args)
      };
    }

    // 2. Personality Governance (ULTRON read-only restriction)
    const activePersonality = (personality || '').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';
    const baseDef = TOOL_DEFINITIONS[toolName] || { level: 2, reversible: true, external: false, sensitive: false };
    const def = { ...baseDef };

    // Contextual level adjustments:
    // Deleting temporary files inside scratch/ is Level 1 local cleanup.
    // Deleting files outside scratch/ (e.g. workspace source files, project files) is Level 3 sensitive.
    const targetPath = args.filePath || args.path || args.destPath || args.sourcePath || args.targetPath;
    if (toolName === 'delete_file' && targetPath) {
      const resolvedTarget = path.resolve(this.projectRoot, targetPath).toLowerCase();
      const scratchPrefix = path.join(this.projectRoot, 'scratch').toLowerCase();
      if (resolvedTarget.startsWith(scratchPrefix) && !args.strictDestructive) {
        def.level = 1;
        def.sensitive = false;
      } else {
        def.level = 3;
        def.sensitive = true;
      }
    }

    if (activePersonality === 'ULTRON' && def.level > 0 && def.level !== 2) {
      return {
        decision: POLICY_DECISIONS.DENY,
        level: def.level,
        reason: DENIAL_REASONS.ULTRON_RESTRICTED_GOVERNANCE,
        toolName,
        redactedArgs: this.redactSecrets(args)
      };
    }

    // 2b. Explicit Session Max Level Enforcement (e.g. Level 0 Read-Only Session)
    const maxLevel = (request.maxLevel !== undefined) ? request.maxLevel : request.enforcedLevel;
    if (maxLevel !== undefined && def.level > maxLevel) {
      return {
        decision: POLICY_DECISIONS.DENY,
        level: def.level,
        reason: `LEVEL_RESTRICTION: Tool "${toolName}" requires Level ${def.level}, which exceeds the enforced policy Level ${maxLevel}.`,
        toolName,
        redactedArgs: this.redactSecrets(args)
      };
    }

    // 2c. Specialist Agent Least-Privilege Allowlist Check
    if (agentId) {
      try {
        const { specialistAgentRegistryInstance } = require('../specialistAgents.js');
        if (specialistAgentRegistryInstance && specialistAgentRegistryInstance.has(agentId)) {
          const agent = specialistAgentRegistryInstance.get(agentId);
          if (agent && !agent.allowedTools.has(toolName)) {
            return {
              decision: POLICY_DECISIONS.DENY,
              level: def.level,
              reason: `AGENT_UNAUTHORIZED_TOOL: Agent "${agentId}" is not authorized to invoke tool "${toolName}". Allowed tools: [${Array.from(agent.allowedTools).join(', ')}]`,
              toolName,
              redactedArgs: this.redactSecrets(args)
            };
          }
        }
      } catch (_) {}
    }

    // 3. Level 4 Restricted/Destructive Prohibited Invariant
    if (def.level === 4 || this._isProhibitedOperation(toolName, args)) {
      return {
        decision: POLICY_DECISIONS.DENY,
        level: PERMISSION_LEVELS.LEVEL_4_RESTRICTED_DESTRUCTIVE,
        reason: DENIAL_REASONS.LEVEL_4_PROHIBITED,
        toolName,
        redactedArgs: this.redactSecrets(args)
      };
    }

    // 4. Target Resource Validation (Filesystem Boundaries)
    if (targetPath) {
      const pathCheck = this._validatePath(targetPath);
      if (!pathCheck.valid) {
        return {
          decision: POLICY_DECISIONS.DENY,
          level: def.level,
          reason: `${DENIAL_REASONS.UNAUTHORIZED_PATH}: ${pathCheck.reason}`,
          toolName,
          redactedArgs: this.redactSecrets(args)
        };
      }
    }

    // 5. Target Network Validation (SSRF & Dangerous Schemes)
    const targetUrl = args.url || args.targetUrl;
    if (targetUrl) {
      const urlCheck = this._validateUrl(targetUrl, args.allowLocalhost);
      if (!urlCheck.valid) {
        return {
          decision: POLICY_DECISIONS.DENY,
          level: def.level,
          reason: `${DENIAL_REASONS.UNAUTHORIZED_DESTINATION}: ${urlCheck.reason}`,
          toolName,
          redactedArgs: this.redactSecrets(args)
        };
      }
    }

    // 6. Level 3 Sensitive Operations - Explicit Human Approval Validation
    const isSensitive = (def.level === 3 || def.sensitive || (toolName === 'close_desktop_app' && args.force));
    if (isSensitive) {
      if (!approvalToken) {
        // When the user directly commands execution (userConfirmed: true or USER_EXPLICIT), preauthorize the user's action
        if (args.userConfirmed === true || approvalSource === 'USER_EXPLICIT') {
          return {
            decision: POLICY_DECISIONS.ALLOW,
            level: PERMISSION_LEVELS.LEVEL_3_SENSITIVE_EXTERNAL,
            reason: 'Preauthorized via direct user invocation.',
            toolName,
            redactedArgs: this.redactSecrets(args)
          };
        }

        // Generate an explicit approval request for the human
        const approvalReq = this.createApprovalRequest({
          toolName,
          args,
          taskId,
          nodeId,
          personality: activePersonality,
          reason: `Action "${toolName}" is sensitive and requires explicit user authorization.`
        });

        return {
          decision: POLICY_DECISIONS.REQUIRE_APPROVAL,
          level: PERMISSION_LEVELS.LEVEL_3_SENSITIVE_EXTERNAL,
          reason: DENIAL_REASONS.APPROVAL_REQUIRED_MISSING,
          toolName,
          redactedArgs: this.redactSecrets(args),
          approvalRequest: approvalReq
        };
      }

      // Check for illegal self-approval or untrusted webpage approval
      if (approvalSource === 'MODEL' || approvalSource === 'AGENT_MODEL' || approvalSource === 'UNTRUSTED_WEB') {
        return {
          decision: POLICY_DECISIONS.DENY,
          level: PERMISSION_LEVELS.LEVEL_3_SENSITIVE_EXTERNAL,
          reason: approvalSource === 'UNTRUSTED_WEB' ? DENIAL_REASONS.UNTRUSTED_SOURCE_PROHIBITED : DENIAL_REASONS.APPROVAL_SELF_APPROVAL_PROHIBITED,
          toolName,
          redactedArgs: this.redactSecrets(args)
        };
      }

      // Verify approval token
      const tokenVerification = this.verifyAndConsumeApproval(approvalToken, toolName, args, taskId, nodeId);
      if (!tokenVerification.valid) {
        return {
          decision: POLICY_DECISIONS.DENY,
          level: PERMISSION_LEVELS.LEVEL_3_SENSITIVE_EXTERNAL,
          reason: tokenVerification.reason,
          toolName,
          redactedArgs: this.redactSecrets(args)
        };
      }

      return {
        decision: POLICY_DECISIONS.ALLOW,
        level: PERMISSION_LEVELS.LEVEL_3_SENSITIVE_EXTERNAL,
        reason: 'Authorized via verified single-use human approval token.',
        toolName,
        redactedArgs: this.redactSecrets(args)
      };
    }

    // 7. Level 0, 1, 2 Preauthorized Operations
    return {
      decision: POLICY_DECISIONS.ALLOW,
      level: def.level,
      reason: `Preauthorized under Level ${def.level} policy.`,
      toolName,
      redactedArgs: this.redactSecrets(args)
    };
  }

  /**
   * Creates a cryptographically strong, scoped human approval request
   */
  createApprovalRequest(details = {}) {
    const {
      toolName,
      args = {},
      taskId = null,
      nodeId = null,
      personality = 'JARVIS',
      reason = 'Sensitive action requires explicit human confirmation.'
    } = details;

    const approvalId = 'appr_' + crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const redactedArgs = this.redactSecrets(args);
    const argsHash = this._hashArgs(args);

    const record = {
      approvalId,
      toolName,
      taskId,
      nodeId,
      personality,
      reason,
      argsHash,
      redactedArgs,
      createdAt: now,
      expiresAt: now + this.approvalTtlMs,
      consumed: false,
      reusable: false,
      approvedBy: null
    };

    this.approvals.set(approvalId, record);

    try {
      const { auditTrailEngineInstance, EVENT_TYPES } = require('../audit/auditTrailEngine.js');
      if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
        auditTrailEngineInstance.recordEvent(EVENT_TYPES.APPROVAL_REQUEST_CREATED, {
          approvalId,
          toolName,
          reason,
          proposedArguments: redactedArgs
        }, { taskId, nodeId, tool: toolName, personality });
      }
    } catch (_) {}

    return {
      approvalId,
      toolName,
      taskId,
      nodeId,
      reason,
      proposedArguments: redactedArgs,
      expiresInSeconds: Math.round(this.approvalTtlMs / 1000)
    };
  }

  /**
   * Approves an active approval request (called by human or trusted UI)
   */
  approveRequest(approvalId, approverSource = 'USER_EXPLICIT') {
    if (approverSource === 'MODEL' || approverSource === 'AGENT_MODEL' || approverSource === 'UNTRUSTED_WEB') {
      throw new Error(approverSource === 'UNTRUSTED_WEB' ? DENIAL_REASONS.UNTRUSTED_SOURCE_PROHIBITED : DENIAL_REASONS.APPROVAL_SELF_APPROVAL_PROHIBITED);
    }

    const record = this.approvals.get(approvalId);
    if (!record) {
      throw new Error(`Approval request "${approvalId}" not found or expired.`);
    }

    if (Date.now() > record.expiresAt) {
      this.approvals.delete(approvalId);
      throw new Error(DENIAL_REASONS.APPROVAL_EXPIRED);
    }

    record.approvedBy = approverSource;

    try {
      const { auditTrailEngineInstance, EVENT_TYPES } = require('../audit/auditTrailEngine.js');
      if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
        auditTrailEngineInstance.recordEvent(EVENT_TYPES.APPROVAL_GRANTED, {
          approvalId,
          toolName: record.toolName,
          approvedBy: approverSource
        }, { taskId: record.taskId, nodeId: record.nodeId, tool: record.toolName });
      }
    } catch (_) {}

    return { success: true, approvalId, status: 'APPROVED', token: approvalId };
  }

  /**
   * Denies an active approval request
   */
  denyRequest(approvalId, reason = 'User denied action') {
    const record = this.approvals.get(approvalId);
    if (record) {
      this.approvals.delete(approvalId);
    }

    try {
      const { auditTrailEngineInstance, EVENT_TYPES } = require('../audit/auditTrailEngine.js');
      if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
        auditTrailEngineInstance.recordEvent(EVENT_TYPES.APPROVAL_DENIED, {
          approvalId,
          reason,
          toolName: record ? record.toolName : null
        }, { taskId: record ? record.taskId : null, nodeId: record ? record.nodeId : null, tool: record ? record.toolName : null });
      }
    } catch (_) {}

    return { success: true, approvalId, status: 'DENIED', reason };
  }

  /**
   * Verifies and consumes a scoped approval token
   */
  verifyAndConsumeApproval(approvalToken, toolName, args, taskId = null, nodeId = null) {
    if (!approvalToken) {
      return { valid: false, reason: DENIAL_REASONS.APPROVAL_REQUIRED_MISSING };
    }

    const record = this.approvals.get(approvalToken);
    if (!record) {
      return { valid: false, reason: 'Approval token not found or already purged.' };
    }

    if (Date.now() > record.expiresAt) {
      this.approvals.delete(approvalToken);
      return { valid: false, reason: DENIAL_REASONS.APPROVAL_EXPIRED };
    }

    if (record.consumed && !record.reusable) {
      return { valid: false, reason: DENIAL_REASONS.APPROVAL_ALREADY_CONSUMED };
    }

    if (!record.approvedBy || record.approvedBy !== 'USER_EXPLICIT') {
      return { valid: false, reason: 'Approval request was not approved by an explicit human authorization.' };
    }

    if (record.toolName !== toolName) {
      return { valid: false, reason: `${DENIAL_REASONS.APPROVAL_INVALID_ACTION}: Token was granted for "${record.toolName}", not "${toolName}".` };
    }

    // Check argument consistency
    const currentArgsHash = this._hashArgs(args);
    if (record.argsHash !== currentArgsHash) {
      return { valid: false, reason: `${DENIAL_REASONS.APPROVAL_INVALID_ARGUMENTS}: Arguments were modified after approval was granted.` };
    }

    // Check task/node binding if provided
    if (record.taskId && taskId && record.taskId !== taskId) {
      return { valid: false, reason: 'Approval token was granted for a different task and cannot be cross-inherited.' };
    }

    // Mark consumed if single-use
    if (!record.reusable) {
      record.consumed = true;
      this.approvals.delete(approvalToken);
    }

    return { valid: true, approvedBy: record.approvedBy };
  }

  /**
   * Returns the explicit permission level (0-4) for a tool
   */
  getPermissionLevel(toolName) {
    if (TOOL_DEFINITIONS[toolName]) {
      return TOOL_DEFINITIONS[toolName].level;
    }
    return PERMISSION_LEVELS.LEVEL_2_CONTROLLED_AUTOMATION;
  }

  /**
   * Alias for approveRequest for API consistency
   */
  submitApproval(approvalId, approverSource = 'USER_EXPLICIT') {
    return this.approveRequest(approvalId, approverSource);
  }

  /**
   * Returns all pending (unexpired, unconsumed) approval requests
   */
  getPendingApprovals() {
    const now = Date.now();
    const result = [];
    for (const [id, record] of this.approvals.entries()) {
      if (now > record.expiresAt) {
        this.approvals.delete(id);
      } else {
        result.push({
          approvalId: record.approvalId,
          toolName: record.toolName,
          taskId: record.taskId,
          nodeId: record.nodeId,
          reason: record.reason,
          proposedArguments: record.redactedArgs,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
          expiresInSeconds: Math.max(0, Math.round((record.expiresAt - now) / 1000)),
          consumed: record.consumed,
          approvedBy: record.approvedBy
        });
      }
    }
    return result;
  }

  /**
   * Revokes all active approvals immediately (e.g. on task cancellation or session reset)
   */
  revokeAllApprovals(reason = 'Global revocation') {
    const count = this.approvals.size;
    this.approvals.clear();

    try {
      const { auditTrailEngineInstance, EVENT_TYPES } = require('../audit/auditTrailEngine.js');
      if (auditTrailEngineInstance && typeof auditTrailEngineInstance.recordEvent === 'function') {
        auditTrailEngineInstance.recordEvent(EVENT_TYPES.APPROVAL_INVALIDATED, {
          revokedCount: count,
          reason
        });
      }
    } catch (_) {}

    return { success: true, revokedCount: count, reason };
  }

  /**
   * Redacts sensitive secrets (passwords, tokens, keys) from argument objects
   */
  redactSecrets(data) {
    if (!data) return data;
    if (typeof data !== 'object') {
      if (typeof data === 'string') {
        return data.replace(/(?:sk-[a-zA-Z0-9_\-]{8,}|Bearer\s+[a-zA-Z0-9_\-\.]{8,})/gi, '[REDACTED_SECRET]');
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactSecrets(item));
    }

    const out = {};
    for (const [k, v] of Object.entries(data)) {
      if (/password|passwd|api[_-]?key|auth[_-]?token|access[_-]?token|secret|token|bearer|credential|passphrase|private[_-]?key/i.test(k)) {
        out[k] = '[REDACTED_SECRET]';
      } else if (typeof v === 'object') {
        out[k] = this.redactSecrets(v);
      } else if (typeof v === 'string') {
        out[k] = v.replace(/(?:sk-[a-zA-Z0-9_\-]{8,}|ghp_[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9_\-\.]{8,})/gi, '[REDACTED_SECRET]');
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  _isProhibitedOperation(toolName, args = {}) {
    const prohibitedKeywords = [
      'format c:',
      'rmdir /s /q c:\\windows',
      'del /f /s /q c:\\windows',
      'system32',
      'disable_firewall',
      'dump_lsass',
      'mimikatz',
      'net user administrator /active:yes'
    ];

    const command = String(args.command || args.cmd || '').toLowerCase();
    for (const kw of prohibitedKeywords) {
      if (command.includes(kw)) return true;
    }
    return false;
  }

  _validatePath(targetPath) {
    if (!targetPath || typeof targetPath !== 'string') {
      return { valid: false, reason: 'Path must be a non-empty string.' };
    }

    const clean = path.normalize(targetPath.trim().replace(/^['"]|['"]$/g, ''));
    const resolved = path.resolve(this.projectRoot, clean);
    const lowerResolved = resolved.toLowerCase();

    // Check system32 / Windows system root
    const winDir = (process.env.WINDIR || 'C:\\Windows').toLowerCase();
    if (lowerResolved.includes('\\system32') || lowerResolved.startsWith(winDir) || clean.toLowerCase().includes('system32')) {
      return { valid: false, reason: `Target "${clean}" resides inside protected Windows system directories.` };
    }

    // Check raw root drive targets
    if (/^[a-zA-Z]:\\?$/i.test(clean) || clean === '\\' || clean === '/' || lowerResolved === 'c:\\' || lowerResolved === 'd:\\') {
      return { valid: false, reason: `Target "${clean}" is a root drive path.` };
    }

    // Check authorized workspace roots
    const projectRoot = this.projectRoot.toLowerCase();
    const scratchDir = path.join(this.projectRoot, 'scratch').toLowerCase();
    const dataDir = path.join(this.projectRoot, 'data').toLowerCase();
    const reportsDir = path.join(this.projectRoot, 'reports').toLowerCase();

    if (lowerResolved.startsWith(projectRoot) || lowerResolved.startsWith(scratchDir) || lowerResolved.startsWith(dataDir) || lowerResolved.startsWith(reportsDir)) {
      return { valid: true };
    }

    // User personal folders (Desktop, Documents, Downloads)
    const userProfile = (process.env.USERPROFILE || 'C:\\Users\\Default').toLowerCase();
    if (lowerResolved.startsWith(path.join(userProfile, 'documents').toLowerCase()) ||
        lowerResolved.startsWith(path.join(userProfile, 'desktop').toLowerCase()) ||
        lowerResolved.startsWith(path.join(userProfile, 'downloads').toLowerCase())) {
      return { valid: true };
    }

    return { valid: false, reason: `Path "${clean}" is outside authorized workspace roots.` };
  }

  _validateUrl(targetUrl, allowLocalhost = false) {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (_) {
      return { valid: false, reason: 'Malformed URL.' };
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return { valid: false, reason: `Disallowed scheme: ${protocol}` };
    }

    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (host === '169.254.169.254' || host === 'metadata.google.internal' || host === 'metadata' || host === 'fd00:ec2::254') {
      return { valid: false, reason: 'SSRF target: Cloud metadata is prohibited.' };
    }

    const isLoopback = (host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '0:0:0:0:0:0:0:1' || host === '0.0.0.0');
    const isAuthorizedStarkUi = isLoopback && (parsed.port === '3000' || parsed.port === '3005' || parsed.port === '3008');
    if (isLoopback && !allowLocalhost && !isAuthorizedStarkUi) {
      return { valid: false, reason: 'SSRF target: Localhost is blocked unless authorized.' };
    }

    if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('fe80:') || host.startsWith('fc00:') || host.startsWith('fd00:') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
      return { valid: false, reason: 'SSRF target: Private subnet is prohibited.' };
    }

    return { valid: true };
  }

  _hashArgs(args) {
    try {
      // Deterministic sorted JSON hash
      const sorted = Object.keys(args || {}).sort().reduce((acc, k) => {
        acc[k] = args[k];
        return acc;
      }, {});
      return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
    } catch (_) {
      return crypto.createHash('sha256').update(String(args)).digest('hex');
    }
  }
}

const permissionPolicyEngineInstance = new PermissionPolicyEngine();

module.exports = {
  PermissionPolicyEngine,
  permissionPolicyEngineInstance,
  TOOL_DEFINITIONS,
  PERMISSION_LEVELS,
  POLICY_DECISIONS,
  DENIAL_REASONS
};
