/**
 * VISION AI — Central Desktop Permission Gate
 * Defines and enforces strict, runtime-evaluated permission boundaries for JARVIS and ULTRON.
 * 
 * - JARVIS: Broad personal assistant governance.
 *   Permits application launching/activation/closing, folder/file access, web browsing,
 *   system diagnostics, task orchestrations, and approved development tools.
 *   High-impact destructive operations require explicit single-use approval tokens.
 * 
 * - ULTRON: Strictly restricted analytical governance.
 *   Permits conversation, strategic reasoning, approved research, and read-only telemetry.
 *   Strictly DENIES arbitrary application launching, folder/file modifications,
 *   process termination, or unapproved development executions.
 */

const crypto = require('crypto');
const { securityPermissionsInstance } = require('../securityPermissions.js');
const { permissionManagerInstance } = require('./permissionManager.js');

// Tool Classification and Permission Matrix
const PERMISSION_POLICIES = {
  JARVIS: {
    name: 'JARVIS_BROAD_ASSISTANT',
    description: 'Broad personal assistant governance with user-approved workflows',
    allowedCategories: [
      'CONVERSATION',
      'RESEARCH',
      'TIME_WEATHER',
      'DIAGNOSTICS_READ',
      'APPLICATION_LAUNCH',
      'APPLICATION_MANAGE',
      'FILE_READ',
      'FILE_EXPLORE',
      'FILE_ORGANIZATION',
      'AUTOMATION',
      'COMMUNICATION',
      'WEB_BROWSER',
      'WINDOWS_SETTINGS',
      'MEDIA_CONTROL',
      'PRODUCTIVITY_TASKS',
      'DEVELOPMENT_READ',
      'DEVELOPMENT_EXEC',
      'VISION_HARDWARE',
      'VISION_INTELLIGENCE',
      'SCREEN_AWARENESS',
      'SENSOR_TELEMETRY',
      'SECURITY_AUDIT',
      'SECURITY_CORE'
    ],
    // Tools requiring single-use cryptographic approval tokens
    approvalRequiredTools: [
      'apply_code_patch',
      'close_desktop_app_force',
      'execute_administrative_elevation',
      'deploy_verified_repair',
      'apply_self_improvement',
      'rollback_self_improvement',
      'memory_purge_domain'
    ]
  },
  ULTRON: {
    name: 'ULTRON_RESTRICTED_ANALYST',
    description: 'Strictly restricted read-only analysis and strategic reasoning governance',
    allowedCategories: [
      'CONVERSATION',
      'RESEARCH',
      'TIME_WEATHER',
      'DIAGNOSTICS_READ',
      'SECURITY_AUDIT',
      'DEVELOPMENT_READ',
      'SENSOR_TELEMETRY'
    ],
    approvalRequiredTools: []
  }
};

// Map each registered tool to its permission category
const TOOL_CATEGORIES = {
  // Time, Weather & Conversation
  get_current_time: 'TIME_WEATHER',
  get_timezone_time: 'TIME_WEATHER',
  calculate_time_offset: 'TIME_WEATHER',
  calculate_date_difference: 'TIME_WEATHER',
  get_weather: 'TIME_WEATHER',
  web_research: 'RESEARCH',
  save_memory: 'CONVERSATION',
  list_memories: 'CONVERSATION',
  forget_memory: 'CONVERSATION',
  delete_memory: 'CONVERSATION',
  correct_memory: 'CONVERSATION',
  search_memories: 'CONVERSATION',
  clear_all_memories: 'CONVERSATION',
  export_memories: 'CONVERSATION',
  save_project_memory: 'CONVERSATION',
  get_project_memory: 'CONVERSATION',
  list_projects: 'CONVERSATION',
  toggle_auto_memory: 'CONVERSATION',
  request_action_approval: 'CONVERSATION',
  set_language_mode: 'CONVERSATION',
  get_language_mode: 'CONVERSATION',

  // Diagnostics & Telemetry (Read-only)
  get_system_telemetry: 'DIAGNOSTICS_READ',
  run_system_diagnostics: 'DIAGNOSTICS_READ',
  get_hardware_metrics: 'DIAGNOSTICS_READ',
  get_running_applications: 'DIAGNOSTICS_READ',
  inspect_code_security: 'SECURITY_AUDIT',
  inspect_project_structure: 'DIAGNOSTICS_READ',

  // Desktop Applications (JARVIS only)
  open_desktop_app: 'APPLICATION_LAUNCH',
  open_application: 'APPLICATION_LAUNCH',
  launch_application: 'APPLICATION_LAUNCH',
  launch_desktop_app: 'APPLICATION_LAUNCH',
  close_desktop_app: 'APPLICATION_MANAGE',
  desktop_mouse_move: 'PRODUCTIVITY_TASKS',
  desktop_mouse_click: 'PRODUCTIVITY_TASKS',
  desktop_mouse_drag: 'PRODUCTIVITY_TASKS',
  desktop_mouse_scroll: 'PRODUCTIVITY_TASKS',
  desktop_type_text: 'PRODUCTIVITY_TASKS',
  desktop_send_hotkey: 'PRODUCTIVITY_TASKS',
  desktop_inspect_elements: 'SCREEN_AWARENESS',
  desktop_manage_window: 'APPLICATION_MANAGE',
  desktop_file_operation: 'FILE_ORGANIZATION',
  voice_call_initiate: 'COMMUNICATION',
  voice_call_end: 'COMMUNICATION',
  voice_call_toggle_mute: 'COMMUNICATION',
  voice_call_process_turn: 'COMMUNICATION',
  video_meeting_join: 'COMMUNICATION',
  video_meeting_leave: 'COMMUNICATION',
  video_meeting_toggle_media: 'COMMUNICATION',
  video_meeting_analyze_presentation: 'VISION_INTELLIGENCE',
  video_meeting_generate_minutes: 'COMMUNICATION',

  // Folders & Files (JARVIS only)
  open_folder: 'FILE_EXPLORE',
  open_file: 'FILE_EXPLORE',
  search_user_files: 'FILE_READ',
  search_project_files: 'FILE_READ',
  read_project_file: 'FILE_READ',
  read_text_file: 'FILE_READ',
  create_file: 'FILE_ORGANIZATION',
  write_text_file: 'FILE_ORGANIZATION',
  edit_file: 'FILE_ORGANIZATION',
  rename_file: 'FILE_ORGANIZATION',
  copy_file: 'FILE_ORGANIZATION',
  delete_file: 'FILE_ORGANIZATION',
  list_workspace_files: 'FILE_EXPLORE',
  read_workspace_file: 'FILE_READ',
  write_workspace_file: 'FILE_ORGANIZATION',
  edit_workspace_file: 'FILE_ORGANIZATION',
  copy_workspace_file: 'FILE_ORGANIZATION',
  move_workspace_file: 'FILE_ORGANIZATION',
  delete_workspace_file: 'FILE_ORGANIZATION',
  organize_workspace_files: 'FILE_ORGANIZATION',
  search_workspace_files: 'FILE_READ',
  compare_workspace_files: 'FILE_READ',
  verify_workspace_file: 'FILE_READ',
  get_user_preferences: 'PRODUCTIVITY_TASKS',
  set_user_preferences: 'PRODUCTIVITY_TASKS',
  create_workspace_backup: 'FILE_ORGANIZATION',
  restore_workspace_backup: 'FILE_ORGANIZATION',
  add_authorized_root: 'FILE_ORGANIZATION',
  list_authorized_roots: 'FILE_READ',
  create_word_document: 'FILE_ORGANIZATION',
  inspect_word_document: 'FILE_READ',
  create_pdf_document: 'FILE_ORGANIZATION',
  inspect_pdf_document: 'FILE_READ',
  convert_pdf_to_word: 'FILE_ORGANIZATION',
  verify_document: 'FILE_READ',
  rag_index_document: 'FILE_READ',
  rag_search_documents: 'FILE_READ',
  rag_get_document_status: 'DIAGNOSTICS_READ',
  rag_delete_document: 'FILE_ORGANIZATION',
  reasoning_solve_problem: 'RESEARCH',
  language_analyze_text: 'CONVERSATION',
  database_inspect_schema: 'DIAGNOSTICS_READ',
  database_explain_query: 'DIAGNOSTICS_READ',
  datascience_analyze_dataset: 'RESEARCH',
  ml_train_and_evaluate: 'RESEARCH',
  automation_run_workflow: 'AUTOMATION',
  observability_get_diagnostics: 'DIAGNOSTICS_READ',
  create_excel_spreadsheet: 'FILE_ORGANIZATION',
  verify_excel_spreadsheet: 'FILE_READ',
  create_presentation: 'FILE_ORGANIZATION',
  verify_presentation: 'FILE_READ',
  live_document_create: 'FILE_ORGANIZATION',
  live_document_revise: 'FILE_ORGANIZATION',
  live_document_save: 'FILE_ORGANIZATION',
  live_document_send_whatsapp: 'COMMUNICATION',
  live_document_confirm_whatsapp: 'COMMUNICATION',
  live_document_undo: 'FILE_ORGANIZATION',
  live_document_status: 'FILE_READ',
  live_document_control: 'PRODUCTIVITY_TASKS',

  // Windows Automation & Clipboard (JARVIS only)
  read_clipboard: 'AUTOMATION',
  write_clipboard: 'AUTOMATION',
  interact_window: 'AUTOMATION',

  // Phase 15 Sensory Intelligence, Voice, Ambient Vision, Universal GUI & Private Copilot
  enumerate_audio_devices: 'DIAGNOSTICS_READ',
  enable_audio_loopback: 'AUTOMATION',
  ingest_audio_loopback_segment: 'AUTOMATION',
  stop_audio_loopback: 'AUTOMATION',
  process_full_duplex_voice_frame: 'AUTOMATION',
  enable_ambient_vision: 'AUTOMATION',
  observe_ambient_environment_tick: 'AUTOMATION',
  stop_ambient_vision: 'AUTOMATION',
  execute_universal_gui_workflow: 'AUTOMATION',
  enable_private_whisper_copilot: 'AUTOMATION',
  process_copilot_meeting_turn: 'AUTOMATION',
  disable_private_whisper_copilot: 'AUTOMATION',

  // Universal Desktop Control, Screen Observation & Interactive Visual Simulations
  word_init_blank_document: 'FILE_ORGANIZATION',
  run_visual_simulation: 'RESEARCH',
  enable_screen_observation: 'SCREEN_AWARENESS',
  pause_screen_observation: 'SCREEN_AWARENESS',
  disable_screen_observation: 'SCREEN_AWARENESS',
  inspect_screen_observation: 'SCREEN_AWARENESS',
  set_assistant_mode: 'CONVERSATION',

  // WhatsApp Messaging & Calls (JARVIS only)
  open_whatsapp: 'COMMUNICATION',
  open_whatsapp_conversation: 'COMMUNICATION',
  validate_phone_number: 'COMMUNICATION',
  draft_whatsapp_message: 'COMMUNICATION',
  cancel_whatsapp_draft: 'COMMUNICATION',
  stage_whatsapp_message: 'COMMUNICATION',
  confirm_whatsapp_send: 'COMMUNICATION',
  cancel_whatsapp_send: 'COMMUNICATION',
  send_whatsapp_message: 'COMMUNICATION',
  send_whatsapp_voice_message: 'COMMUNICATION',
  initiate_whatsapp_call: 'COMMUNICATION',
  call_whatsapp_contact: 'COMMUNICATION',
  end_whatsapp_call: 'COMMUNICATION',
  list_chrome_profiles: 'PRODUCTIVITY_TASKS',
  launch_chrome_profile: 'APPLICATION_LAUNCH',
  open_chrome_profile: 'APPLICATION_LAUNCH',
  open_gmail: 'APPLICATION_LAUNCH',
  get_whatsapp_call_state: 'COMMUNICATION',
  set_user_availability: 'COMMUNICATION',
  get_user_availability: 'COMMUNICATION',
  process_incoming_whatsapp_message: 'COMMUNICATION',
  confirm_incoming_reply: 'COMMUNICATION',
  send_jarvis_voice_note: 'COMMUNICATION',
  get_whatsapp_conversation_history: 'COMMUNICATION',
  read_whatsapp_messages: 'COMMUNICATION',
  start_voice_relay: 'COMMUNICATION',
  speak_as_user: 'COMMUNICATION',
  listen_to_caller: 'COMMUNICATION',
  end_voice_relay: 'COMMUNICATION',

  // Google Workspace Tools
  get_google_workspace_status: 'RESEARCH',
  get_google_auth_url: 'RESEARCH',
  search_google_drive: 'FILE_READ',
  list_google_drive: 'FILE_READ',
  read_google_drive_file: 'FILE_READ',
  create_google_drive_folder: 'FILE_ORGANIZATION',
  upload_to_google_drive: 'FILE_ORGANIZATION',
  download_from_google_drive: 'FILE_ORGANIZATION',
  move_google_drive_file: 'FILE_ORGANIZATION',
  delete_google_drive_file: 'FILE_ORGANIZATION',
  share_google_drive_file: 'COMMUNICATION',
  create_google_doc: 'FILE_ORGANIZATION',
  create_gmail_draft: 'COMMUNICATION',
  send_gmail_draft: 'COMMUNICATION',
  schedule_google_calendar_event: 'PRODUCTIVITY_TASKS',

  // Browser, Chrome, Maps & Settings (JARVIS only)
  open_web_url: 'WEB_BROWSER',
  open_chrome_visible: 'WEB_BROWSER',
  search_google_live: 'WEB_BROWSER',
  search_google_maps: 'WEB_BROWSER',
  get_google_maps_directions: 'WEB_BROWSER',
  compare_google_maps_places: 'WEB_BROWSER',
  geocode_location: 'WEB_BROWSER',
  reverse_geocode_coordinates: 'WEB_BROWSER',
  search_multiple_sites: 'WEB_BROWSER',
  browser_list_tabs: 'WEB_BROWSER',
  browser_switch_tab: 'WEB_BROWSER',
  browser_close_tab: 'WEB_BROWSER',
  browser_scroll: 'WEB_BROWSER',
  browser_summarize_page: 'WEB_BROWSER',
  restore_desktop_window: 'APPLICATION_MANAGE',
  find_latest_files: 'FILE_READ',
  summarize_local_document: 'FILE_READ',
  browser_open: 'WEB_BROWSER',
  browser_navigate: 'WEB_BROWSER',
  browser_extract_text: 'WEB_BROWSER',
  browser_extract_structured: 'WEB_BROWSER',
  browser_click: 'WEB_BROWSER',
  browser_fill: 'WEB_BROWSER',
  browser_select: 'WEB_BROWSER',
  browser_screenshot: 'WEB_BROWSER',
  browser_download: 'WEB_BROWSER',
  browser_close: 'WEB_BROWSER',
  open_windows_settings: 'WINDOWS_SETTINGS',
  control_media: 'MEDIA_CONTROL',
  adjust_volume: 'MEDIA_CONTROL',
  spotify_playback_control: 'MEDIA_CONTROL',
  spotify_play_liked_songs: 'MEDIA_CONTROL',
  spotify_search_and_play: 'MEDIA_CONTROL',
  spotify_get_status: 'MEDIA_CONTROL',

  // Tasks & Reminders
  set_timer: 'PRODUCTIVITY_TASKS',
  create_reminder: 'PRODUCTIVITY_TASKS',
  list_reminders: 'PRODUCTIVITY_TASKS',
  get_daily_briefing: 'PRODUCTIVITY_TASKS',
  create_task: 'PRODUCTIVITY_TASKS',
  list_tasks: 'PRODUCTIVITY_TASKS',
  complete_task: 'PRODUCTIVITY_TASKS',
  delete_task: 'PRODUCTIVITY_TASKS',
  plan_multi_step_task: 'PRODUCTIVITY_TASKS',
  execute_multi_step_plan: 'PRODUCTIVITY_TASKS',

  // Language & Voice (Both JARVIS & ULTRON)
  set_language_mode: 'CONVERSATION',
  get_language_mode: 'CONVERSATION',

  // Memory Management
  list_memories: 'PRODUCTIVITY_TASKS',
  add_user_memory: 'PRODUCTIVITY_TASKS',
  get_task_orchestration_status: 'PRODUCTIVITY_TASKS',
  cancel_task_orchestration: 'PRODUCTIVITY_TASKS',
  list_task_executions: 'PRODUCTIVITY_TASKS',

  // Development & Code
  search_code_symbols: 'DEVELOPMENT_READ',
  debug_stack_trace: 'DEVELOPMENT_READ',
  review_dependencies: 'DEVELOPMENT_READ',
  analyze_document: 'DEVELOPMENT_READ',
  analyze_dataset: 'DEVELOPMENT_READ',
  analyze_log: 'DEVELOPMENT_READ',
  propose_code_patch: 'DEVELOPMENT_READ',
  apply_code_patch: 'DEVELOPMENT_EXEC',
  run_approved_test: 'DEVELOPMENT_EXEC',
  run_project_test: 'DEVELOPMENT_EXEC',
  inspect_source_code: 'DEVELOPMENT_READ',
  search_source_code: 'DEVELOPMENT_READ',
  read_source_file: 'DEVELOPMENT_READ',
  create_source_file: 'DEVELOPMENT_EXEC',
  edit_source_file: 'DEVELOPMENT_EXEC',
  find_code_references: 'DEVELOPMENT_READ',
  apply_source_patch: 'DEVELOPMENT_EXEC',
  run_project_tests: 'DEVELOPMENT_EXEC',
  execute_self_repair: 'DEVELOPMENT_EXEC',
  repair_code_failure: 'DEVELOPMENT_EXEC',
  rollback_source_code: 'DEVELOPMENT_EXEC',
  rollback_code_change: 'DEVELOPMENT_EXEC',

  // Camera & Visual Intelligence (JARVIS only)
  capture_camera_snapshot: 'VISION_HARDWARE',
  get_camera_devices: 'VISION_HARDWARE',
  set_camera_stream_state: 'VISION_HARDWARE',
  analyze_camera_image: 'VISION_INTELLIGENCE',
  analyze_desk_workspace: 'VISION_INTELLIGENCE',
  analyze_local_image_file: 'VISION_INTELLIGENCE',
  inspect_engineering_component: 'VISION_INTELLIGENCE',
  compare_visual_frames: 'VISION_INTELLIGENCE',

  // Screen Awareness (JARVIS only)
  capture_screen: 'SCREEN_AWARENESS',
  analyze_screen: 'SCREEN_AWARENESS',
  diagnose_screen_error: 'SCREEN_AWARENESS',
  read_screen_text: 'SCREEN_AWARENESS',

  // Sensor Telemetry (JARVIS & ULTRON read-only)
  inspect_ambient_sensors: 'SENSOR_TELEMETRY',
  inspect_connected_hardware: 'SENSOR_TELEMETRY',
  get_sensor_telemetry: 'SENSOR_TELEMETRY',

  // External API Integrations (JARVIS & ULTRON)
  list_api_integrations: 'RESEARCH',
  test_api_integration: 'RESEARCH',
  get_integration_health: 'DIAGNOSTICS_READ',

  // Safe Administrative Elevation (JARVIS only)
  propose_administrative_elevation: 'DEVELOPMENT_READ',
  execute_administrative_elevation: 'DEVELOPMENT_EXEC',

  // Controlled Self-Repair & Improvement (JARVIS & ULTRON diagnostics, JARVIS deployment)
  diagnose_system_issue: 'DEVELOPMENT_READ',
  stage_code_repair: 'DEVELOPMENT_READ',
  validate_repair_candidate: 'DEVELOPMENT_READ',
  deploy_verified_repair: 'DEVELOPMENT_EXEC',
  rollback_to_known_good: 'DEVELOPMENT_EXEC',

  // Self-Healing Service Management
  get_subsystem_health: 'DIAGNOSTICS_READ',
  recover_subsystem: 'APPLICATION_MANAGE',

  // Self-Coding & Autonomous Software Development Engine (JARVIS)
  inspect_project: 'DEVELOPMENT_READ',
  search_source_code: 'DEVELOPMENT_READ',
  read_source_file: 'DEVELOPMENT_READ',
  create_source_file: 'DEVELOPMENT_EXEC',
  edit_source_file: 'DEVELOPMENT_EXEC',
  create_new_module: 'DEVELOPMENT_EXEC',
  register_new_tool: 'DEVELOPMENT_EXEC',
  generate_tests: 'DEVELOPMENT_READ',
  run_project_tests: 'DEVELOPMENT_EXEC',
  run_linter: 'DEVELOPMENT_READ',
  run_build: 'DEVELOPMENT_EXEC',
  inspect_git_diff: 'DEVELOPMENT_READ',
  diagnose_test_failure: 'DEVELOPMENT_READ',
  repair_code_failure: 'DEVELOPMENT_EXEC',
  create_development_branch: 'DEVELOPMENT_EXEC',
  rollback_code_change: 'DEVELOPMENT_EXEC',
  validate_candidate_build: 'DEVELOPMENT_READ',
  activate_validated_update: 'DEVELOPMENT_EXEC',

  // Scientific, Engineering, Research, AI Lab & Orchestration (Modules 1-5, 10, 11)
  calculate_scientific_math: 'RESEARCH',
  convert_scientific_units: 'RESEARCH',
  run_monte_carlo_simulation: 'RESEARCH',
  analyze_structural_beam: 'RESEARCH',
  calculate_robot_kinematics: 'RESEARCH',
  size_actuator_motor: 'RESEARCH',
  generate_parametric_cad: 'DEVELOPMENT_EXEC',
  get_engineering_blueprint: 'RESEARCH',
  calculate_power_budget: 'RESEARCH',
  generate_embedded_firmware: 'DEVELOPMENT_EXEC',
  generate_circuit_netlist: 'RESEARCH',
  estimate_ai_resources: 'RESEARCH',
  inspect_ai_dataset: 'RESEARCH',
  scaffold_ai_agent: 'DEVELOPMENT_EXEC',
  search_scientific_papers: 'RESEARCH',
  compare_research_sources: 'RESEARCH',
  save_knowledge_entry: 'PRODUCTIVITY_TASKS',
  search_knowledge_base: 'RESEARCH',
  generate_scenario_forecast: 'RESEARCH',
  evaluate_fmea_risk: 'RESEARCH',
  orchestrate_project_plan: 'DEVELOPMENT_EXEC',
  execute_autonomous_task: 'DEVELOPMENT_EXEC',
  execute_autonomous_project: 'DEVELOPMENT_EXEC',
  execute_software_engineering_workflow: 'DEVELOPMENT_EXEC',
  create_software_project: 'DEVELOPMENT_EXEC',
  run_project_code: 'DEVELOPMENT_EXEC',
  debug_and_repair_code: 'DEVELOPMENT_EXEC',
  get_system_telemetry: 'DIAGNOSTICS_READ',

  // Knowledge Graph, Multi-Agent & Resource Tools
  query_knowledge_graph: 'RESEARCH',
  analyze_engineering_consequence: 'RESEARCH',
  record_graph_decision: 'PRODUCTIVITY_TASKS',
  record_graph_failure: 'PRODUCTIVITY_TASKS',
  dispatch_multi_agent_mission: 'DEVELOPMENT_EXEC',
  scan_proactive_assistance: 'DIAGNOSTICS_READ',
  audit_compute_resources: 'DIAGNOSTICS_READ',

  // Live Capability Registry, Dependency Investigation & Empirical Learning
  get_live_capability_registry: 'DIAGNOSTICS_READ',
  diagnose_missing_dependency: 'DIAGNOSTICS_READ',
  record_system_experiment: 'PRODUCTIVITY_TASKS',
  get_experiment_ledger: 'RESEARCH',
  generate_technical_reproduction_guide: 'RESEARCH',
  explain_engineering_simulation: 'RESEARCH',
  create_3d_model: 'PRODUCTIVITY_TASKS',
  export_3d_model: 'PRODUCTIVITY_TASKS',
  get_3d_model: 'RESEARCH',
  generate_image: 'PRODUCTIVITY_TASKS',
  edit_image: 'PRODUCTIVITY_TASKS',
  list_generated_images: 'RESEARCH',
  get_live_news: 'RESEARCH',
  search_live_web: 'RESEARCH',
  fetch_web_article: 'RESEARCH',
  read_online_pdf: 'RESEARCH',
  get_financial_data: 'RESEARCH',
  search_github_repos: 'RESEARCH',
  get_web_connectivity_status: 'RESEARCH',

  // Owner Identity & Privacy Tools
  enroll_owner_profile: 'SECURITY_CORE',
  verify_owner_face: 'DIAGNOSTICS_READ',
  list_owner_profiles: 'RESEARCH',
  delete_owner_profile: 'SECURITY_CORE',
  toggle_privacy_mode: 'SECURITY_CORE',
  answer_visual_question: 'DIAGNOSTICS_READ',

  // Word, Notepad & Document Automation Tools
  write_notepad_document: 'PRODUCTIVITY_TASKS',
  create_word_document: 'PRODUCTIVITY_TASKS',
  auto_save_document: 'PRODUCTIVITY_TASKS',

  // Windows Local Agent & Desktop Automation Tools
  execute_controlled_shell_command: 'DEVELOPMENT_EXEC',
  execute_desktop_workflow: 'AUTOMATION',
  control_application_window: 'AUTOMATION',
  get_desktop_agent_status: 'DIAGNOSTICS_READ',

  // Advanced File & Drive Management Tools
  list_directory: 'DIAGNOSTICS_READ',
  create_folder: 'PRODUCTIVITY_TASKS',
  find_duplicate_files: 'DIAGNOSTICS_READ',
  organize_files_by_type: 'PRODUCTIVITY_TASKS',
  restore_deleted_file: 'PRODUCTIVITY_TASKS',

  // Application & Window Automation Tools
  list_open_windows: 'DIAGNOSTICS_READ',
  focus_desktop_window: 'PRODUCTIVITY_TASKS',
  minimize_desktop_window: 'PRODUCTIVITY_TASKS',
  maximize_desktop_window: 'PRODUCTIVITY_TASKS',
  switch_desktop_window: 'PRODUCTIVITY_TASKS',
  find_installed_apps: 'DIAGNOSTICS_READ',
  capture_desktop_screenshot: 'PRODUCTIVITY_TASKS',
  inspect_ui_hierarchy: 'PRODUCTIVITY_TASKS',
  send_desktop_keystrokes: 'PRODUCTIVITY_TASKS',
  send_desktop_hotkey: 'PRODUCTIVITY_TASKS',
  desktop_mouse_click: 'PRODUCTIVITY_TASKS',
  desktop_mouse_scroll: 'PRODUCTIVITY_TASKS',
  set_clipboard_text: 'PRODUCTIVITY_TASKS',
  get_clipboard_text: 'PRODUCTIVITY_TASKS',
  set_window_geometry: 'PRODUCTIVITY_TASKS',
  set_window_state: 'PRODUCTIVITY_TASKS',

  // Persistent Memory & Decision Tools
  record_project_decision: 'PRODUCTIVITY_TASKS',
  get_recent_project_context: 'RESEARCH',
  forget_user_preference: 'PRODUCTIVITY_TASKS',

  // Cross-Platform & Plugin Framework
  get_platform_compatibility: 'DIAGNOSTICS_READ',
  get_platform_system_info: 'DIAGNOSTICS_READ',
  list_active_plugins: 'DIAGNOSTICS_READ',
  execute_plugin_tool: 'PRODUCTIVITY_TASKS',

  // Frontier Capabilities
  schedule_distributed_task: 'DEVELOPMENT_EXEC',
  get_cluster_telemetry: 'DIAGNOSTICS_READ',
  discover_local_models: 'DIAGNOSTICS_READ',
  configure_model_finetuning: 'DEVELOPMENT_EXEC',
  evaluate_ai_model: 'DEVELOPMENT_EXEC',
  quantization_analysis: 'DIAGNOSTICS_READ',
  sync_digital_twin: 'SENSOR_TELEMETRY',
  get_digital_twin_status: 'SENSOR_TELEMETRY',
  run_design_optimization: 'RESEARCH',
  calculate_design_sensitivity: 'RESEARCH',
  design_closed_loop_experiment: 'RESEARCH',
  execute_closed_loop_experiment: 'RESEARCH',
  verify_system_invariants: 'SECURITY_AUDIT',
  scan_prompt_threats: 'SECURITY_AUDIT',
  get_spatial_assembly_overlay: 'PRODUCTIVITY_TASKS',
  export_spatial_scene_gltf: 'PRODUCTIVITY_TASKS',
  create_lake_dataset: 'DEVELOPMENT_EXEC',
  clean_lake_dataset: 'DEVELOPMENT_EXEC',
  detect_dataset_anomalies: 'DIAGNOSTICS_READ',
  query_lake_dataset: 'DIAGNOSTICS_READ',
  get_reliability_metrics: 'DIAGNOSTICS_READ',
  register_sync_device: 'COMMUNICATION',
  create_device_sync_packet: 'COMMUNICATION',
  inspect_system_maintenance: 'DIAGNOSTICS_READ',
  evaluate_task_feasibility: 'CONVERSATION',

  // STARK Beyond Intelligence & Self-Improvement Factory Tools
  run_experiment_campaign: 'DEVELOPMENT_EXEC',
  get_forecast_prediction: 'RESEARCH',
  inspect_system_telemetry_and_failure_risks: 'DIAGNOSTICS_READ',
  manage_goal_objective: 'PRODUCTIVITY_TASKS',
  schedule_research_job: 'DEVELOPMENT_EXEC',
  evaluate_future_capability: 'RESEARCH',

  // STARK Beyond 100 Future Technology & Experimental Engineering Tools
  query_future_capabilities: 'RESEARCH',
  execute_scientific_pipeline: 'RESEARCH',
  predict_world_model_impact: 'DIAGNOSTICS_READ',
  evaluate_exoskeleton_biomechanics: 'RESEARCH',
  evaluate_propulsion_dynamics: 'RESEARCH',
  audit_energy_conservation: 'RESEARCH',
  simulate_bci_neural_intent: 'RESEARCH',

  // Phase 9 Autonomous Learning, Skill Development & Self-Improvement
  retrieve_experiences: 'RESEARCH',
  get_learning_metrics: 'DIAGNOSTICS_READ',
  list_skills: 'RESEARCH',
  inspect_skill: 'RESEARCH',
  get_learned_preferences: 'DIAGNOSTICS_READ',
  record_experience: 'DEVELOPMENT_EXEC',
  register_skill: 'DEVELOPMENT_EXEC',
  submit_user_feedback: 'DEVELOPMENT_EXEC',
  correct_learned_preference: 'DEVELOPMENT_EXEC',
  remove_learned_preference: 'DEVELOPMENT_EXEC',
  propose_self_improvement: 'DEVELOPMENT_EXEC',
  execute_skill: 'AUTOMATION',
  promote_skill: 'DEVELOPMENT_EXEC',
  generate_adaptive_plan: 'RESEARCH',
  apply_self_improvement: 'DEVELOPMENT_EXEC',
  rollback_self_improvement: 'DEVELOPMENT_EXEC',
  modify_protected_security_components: 'SECURITY_CORE',

  // Phase 10 Advanced Voice, Conversational Intelligence & Natural Interaction
  transcribe_voice_audio: 'RESEARCH',
  get_voice_metrics: 'DIAGNOSTICS_READ',
  synthesize_voice_speech: 'COMMUNICATION',
  configure_wake_word: 'COMMUNICATION',
  set_voice_mute: 'COMMUNICATION',
  interrupt_voice_speech: 'COMMUNICATION',
  persist_conversational_memory: 'PRODUCTIVITY_TASKS',
  process_conversational_turn: 'AUTOMATION',

  // Phase 11 Multimodal Tools
  screen_understand_action: 'AUTOMATION',
  analyze_document_multimodal: 'RESEARCH',
  compare_documents_multimodal: 'RESEARCH',
  answer_document_vqa: 'RESEARCH',
  analyze_video_multimodal: 'RESEARCH',
  start_camera_stream: 'VISION_HARDWARE',
  stop_camera_stream: 'VISION_HARDWARE',
  analyze_camera_frame: 'VISION_INTELLIGENCE',
  multimodal_reasoning: 'RESEARCH',

  // Phase 12 Advanced Scientific, Mathematical & Engineering Intelligence Tools
  solve_symbolic_math: 'RESEARCH',
  compute_calculus_math: 'RESEARCH',
  matrix_operations_math: 'RESEARCH',
  solve_differential_equations: 'RESEARCH',
  physics_problem_solver: 'RESEARCH',
  engineering_system_analyzer: 'RESEARCH',
  data_science_statistics: 'RESEARCH',
  machine_learning_workflow: 'RESEARCH',
  scientific_simulation_engine: 'RESEARCH',
  scientific_visualization_plot: 'RESEARCH',
  scientific_research_hypothesis: 'RESEARCH',

  // Phase 13 Autonomous Objective Execution & Operational Reliability Tools
  execute_autonomous_objective: 'AUTOMATION',
  pause_autonomous_task: 'AUTOMATION',
  resume_autonomous_task: 'AUTOMATION',
  cancel_autonomous_task: 'AUTOMATION',
  get_autonomous_task_status: 'DIAGNOSTICS_READ',
  verify_desktop_window: 'DIAGNOSTICS_READ',

  // Autonomous OS, Chrome/YouTube, UIA, WhatsApp Web, RAG, Hardware Telemetry & Robotics Tools
  youtube_search_and_open: 'AUTOMATION',
  open_youtube_video: 'AUTOMATION',
  read_window_content: 'DIAGNOSTICS_READ',
  open_whatsapp_web: 'COMMUNICATION',
  send_whatsapp_attachment: 'COMMUNICATION',
  build_codebase_rag: 'RESEARCH',
  search_codebase_rag: 'RESEARCH',
  run_autonomous_engineering_loop: 'DEVELOPMENT_EXEC',
  autonomous_engineering_loop: 'DEVELOPMENT_EXEC',
  get_host_hardware_telemetry: 'DIAGNOSTICS_READ',
  compute_robotic_joint_torque: 'RESEARCH',
  generate_robotics_bom_inr: 'RESEARCH',
  evaluate_robotics_safety: 'RESEARCH',
  add_hardware_inventory: 'PRODUCTIVITY_TASKS',
  list_hardware_inventory: 'DIAGNOSTICS_READ',
  acquire_concept_knowledge: 'RESEARCH',
  design_engineering_system: 'RESEARCH',
  analyze_design_reference_image: 'DIAGNOSTICS_READ',
  verify_mathematical_derivation: 'RESEARCH',
  remember_project_constraint: 'PRODUCTIVITY_TASKS',
  get_developmental_model_status: 'DIAGNOSTICS_READ',

  // Personal AI Representative, Digital Twin (Face/Voice), Outlook Office Executive & Meeting Representative Tools
  enroll_personal_avatar: 'SECURITY_CORE',
  manage_personal_avatar: 'SECURITY_CORE',
  enroll_personal_voice: 'SECURITY_CORE',
  synthesize_representative_speech: 'COMMUNICATION',
  revoke_biometric_authorization: 'SECURITY_CORE',
  learn_personal_writing_style: 'PRODUCTIVITY_TASKS',
  analyze_incoming_whatsapp_intelligence: 'COMMUNICATION',
  handle_whatsapp_notification_decision: 'COMMUNICATION',
  handle_incoming_call_representative: 'COMMUNICATION',
  connect_outlook_oauth: 'COMMUNICATION',
  disconnect_outlook_oauth: 'SECURITY_CORE',
  summarize_outlook_inbox: 'COMMUNICATION',
  search_outlook_emails: 'COMMUNICATION',
  show_outlook_attention_emails: 'COMMUNICATION',
  organize_outlook_inbox: 'PRODUCTIVITY_TASKS',
  prepare_unanswered_outlook_replies: 'COMMUNICATION',
  draft_outlook_reply: 'COMMUNICATION',
  send_approved_outlook_email: 'COMMUNICATION',
  summarize_outlook_attachments: 'PRODUCTIVITY_TASKS',
  schedule_outlook_meeting: 'PRODUCTIVITY_TASKS',
  prepare_daily_office_summary: 'PRODUCTIVITY_TASKS',
  join_authorized_meeting_representative: 'COMMUNICATION',
  transcribe_meeting_segment: 'COMMUNICATION',
  respond_in_meeting_representative: 'COMMUNICATION',
  generate_meeting_minutes: 'PRODUCTIVITY_TASKS',
  execute_parallel_office_workers: 'AUTOMATION',
  get_representative_mission_control: 'DIAGNOSTICS_READ'
};

class DesktopPermissionGate {
  constructor() {
    this.policies = PERMISSION_POLICIES;
    this.categories = TOOL_CATEGORIES;
    this.emergencyStopActive = false;
    this.emergencyStopReason = null;
    this.auditLog = [];
  }

  /**
   * Immediately halts all tool execution across the entire system.
   */
  triggerEmergencyStop(reason = 'User initiated emergency stop') {
    this.emergencyStopActive = true;
    this.emergencyStopReason = reason;
    this.logAuditEvent('EMERGENCY_STOP_TRIGGERED', { reason });
    try {
      const { permissionPolicyEngineInstance } = require('../security/permissionPolicyEngine.js');
      permissionPolicyEngineInstance.revokeAllApprovals(reason);
    } catch (_) {}
    try {
      const { dagExecutionEngineInstance } = require('../dagExecutionEngine.js');
      dagExecutionEngineInstance.cancelAllPendingApprovals(reason);
    } catch (_) {}
    return {
      emergencyStopActive: true,
      reason,
      summary: `Global Emergency Stop activated. All tool execution and system actions are halted immediately.`
    };
  }

  /**
   * Clears global emergency stop and restores normal governance.
   */
  resetEmergencyStop() {
    this.emergencyStopActive = false;
    this.emergencyStopReason = null;
    this.logAuditEvent('EMERGENCY_STOP_CLEARED', {});
    return {
      emergencyStopActive: false,
      summary: `Global Emergency Stop cleared. Normal governance protocols restored.`
    };
  }

  engageEmergencyStop(reason) {
    return this.triggerEmergencyStop(reason);
  }

  releaseEmergencyStop() {
    return this.resetEmergencyStop();
  }

  isEmergencyStopActive() {
    return Boolean(this.emergencyStopActive);
  }

  logAudit(entry) {
    if (typeof entry === 'string') {
      return this.logAuditEvent(entry, {});
    }
    return this.logAuditEvent(entry.action || entry.event || 'AUDIT_RECORD', entry.details || entry);
  }

  /**
   * Secure audit logging with secret redaction
   */
  logAuditEvent(event, details = {}) {
    const record = {
      id: 'audit_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      event,
      details: this.redactSecrets(details)
    };
    this.auditLog.push(record);
    if (this.auditLog.length > 500) this.auditLog.shift();
    return record;
  }

  redactSecrets(data) {
    if (!data) return data;
    try {
      if (typeof data === 'object') {
        const redactObj = (obj) => {
          if (obj === null || typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) return obj.map(redactObj);
          const out = {};
          for (const [k, v] of Object.entries(obj)) {
            if (/password|passwd|api[_-]?key|secret|token|bearer/i.test(k)) {
              out[k] = '[REDACTED_SECRET]';
            } else if (typeof v === 'string') {
              out[k] = v.replace(/(?:sk-[a-zA-Z0-9_-]{8,}|Bearer\s+[a-zA-Z0-9_\-\.]{8,})/gi, '[REDACTED_SECRET]');
            } else if (typeof v === 'object') {
              out[k] = redactObj(v);
            } else {
              out[k] = v;
            }
          }
          return out;
        };
        return redactObj(data);
      }
      let str = String(data);
      str = str.replace(/("?(?:password|passwd|api[_-]?key|secret|token|bearer)"?\s*[:=]\s*")([^"]+)(")/gi, '$1[REDACTED_SECRET]$3');
      str = str.replace(/(?:sk-[a-zA-Z0-9_-]{8,}|Bearer\s+[a-zA-Z0-9_\-\.]{8,})/gi, '[REDACTED_SECRET]');
      return str;
    } catch (e) {
      return data;
    }
  }

  getAuditLog(limit = 50) {
    return this.auditLog.slice(-limit).reverse();
  }

  /**
   * Retrieves policy for given personality
   */
  getPolicy(personality) {
    const key = (personality || '').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';
    return this.policies[key];
  }

  /**
   * Evaluates if a tool invocation is authorized for the active personality.
   * Throws Error if unauthorized or approval is missing.
   */
  authorizeToolExecution(toolName, args = {}, personality = 'JARVIS') {
    if (this.emergencyStopActive) {
      this.logAuditEvent('TOOL_BLOCKED_EMERGENCY_STOP', { toolName, personality });
      throw new Error(`Security Violation: Global Emergency Stop is ACTIVE (${this.emergencyStopReason || 'system halted'}). Action "${toolName}" is prohibited.`);
    }

    const activePersonality = (personality || '').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';

    // 0. Central Permission Policy Engine Evaluation (Levels 0-4 & Explicit Human Approval)
    const { permissionPolicyEngineInstance, POLICY_DECISIONS } = require('../security/permissionPolicyEngine.js');
    const policyResult = permissionPolicyEngineInstance.evaluateInvocation({
      toolName,
      args,
      personality: activePersonality,
      approvalToken: args.approvalToken,
      approvalSource: args.approvalSource
    });

    if (policyResult.decision === POLICY_DECISIONS.DENY) {
      this.logAuditEvent('TOOL_POLICY_DENIED', { toolName, personality: activePersonality, reason: policyResult.reason });
      throw new Error(`Security Violation: ${policyResult.reason}`);
    }

    if (policyResult.decision === POLICY_DECISIONS.REQUIRE_APPROVAL) {
      this.logAuditEvent('TOOL_APPROVAL_TOKEN_REQUIRED', { toolName, personality: activePersonality });
      const err = new Error(`Operation Rejected: Action "${toolName}" is high-impact and requires an explicit single-use approvalToken.`);
      err.approvalRequest = policyResult.approvalRequest;
      err.code = 'APPROVAL_REQUIRED';
      throw err;
    }

    // Flag if already approved by policy engine
    let policyApproved = false;
    if (policyResult.level === 3 && args.approvalToken) {
      policyApproved = true;
    }

    const policy = this.getPolicy(activePersonality);
    let category = this.categories[toolName];
    if (!category) {
      try {
        const { dynamicToolsManagerInstance } = require('../dynamicToolsManager.js');
        const dynamicTool = dynamicToolsManagerInstance.getTool(toolName);
        if (dynamicTool) {
          category = dynamicTool.category || 'PRODUCTIVITY_TASKS';
        }
      } catch (e) {}
    }

    if (!category) {
      this.logAuditEvent('TOOL_UNRECOGNIZED', { toolName, personality });
      throw new Error(`Security Violation: Unrecognized tool "${toolName}" is not registered in the security matrix.`);
    }

    // Check if category is allowed for this personality
    if (!policy.allowedCategories.includes(category)) {
      this.logAuditEvent('TOOL_POLICY_DENIED', { toolName, personality, category });
      if (activePersonality === 'ULTRON') {
        throw new Error(`Security Violation: ULTRON is operating under restricted read-only governance. Action "${toolName}" (${category}) is prohibited by policy.`);
      } else {
        throw new Error(`Security Violation: Action "${toolName}" is not permitted under ${activePersonality} policy.`);
      }
    }

    // Check if dynamic permission profile has disabled this specific capability
    const permMap = {
      COMMUNICATION: 'whatsapp_drafting',
      AUTOMATION: 'window_interaction',
      FILE_ORGANIZATION: 'file_organization',
      VISION_HARDWARE: 'camera_access',
      VISION_INTELLIGENCE: 'user_camera_analysis',
      SCREEN_AWARENESS: 'screen_capture',
      SENSOR_TELEMETRY: 'environmental_sensors'
    };
    let requiredPerm = permMap[category];
    if (toolName === 'analyze_local_image_file') requiredPerm = 'local_image_analysis';
    if (toolName === 'read_screen_text' || toolName === 'diagnose_screen_error' || toolName === 'analyze_screen') requiredPerm = 'screen_window_analysis';
    if (toolName === 'inspect_ambient_sensors') requiredPerm = 'ambient_light_sensor';
    if (toolName === 'inspect_connected_hardware') requiredPerm = 'connected_hardware';

    if (requiredPerm && !permissionManagerInstance.isPermissionEnabled(requiredPerm, activePersonality)) {
      this.logAuditEvent('TOOL_CAPABILITY_DISABLED', { toolName, personality, capability: requiredPerm });
      throw new Error(`Permission Denied: Capability "${requiredPerm}" is currently disabled in ${activePersonality} settings.`);
    }

    // Check if tool requires explicit approval token
    const isApprovalRequired = policy.approvalRequiredTools.includes(toolName) ||
      (toolName === 'close_desktop_app' && args.force);

    if (isApprovalRequired && !policyApproved) {
      if (!args.approvalToken) {
        this.logAuditEvent('TOOL_APPROVAL_TOKEN_REQUIRED', { toolName, personality });
        throw new Error(`Operation Rejected: Action "${toolName}" is high-impact and requires an explicit single-use approvalToken.`);
      }

      // Verify and consume approval token via securityPermissionsInstance
      securityPermissionsInstance.verifyAndConsumeApproval(
        args.approvalToken,
        toolName,
        args.target || args.appName || args.filePath || '',
        args
      );
    }

    this.logAuditEvent('TOOL_AUTHORIZED', { toolName, personality, category });
    return {
      authorized: true,
      personality: activePersonality,
      toolName,
      category,
      requiresApproval: isApprovalRequired
    };
  }

  /**
   * Safe check (non-throwing) for UI query filters or capability discovery
   */
  createApprovalToken(toolName, args = {}, options = {}) {
    const taskId = options.taskId || null;
    const raw = `${toolName}:${JSON.stringify(args)}:${taskId || ''}:${Date.now()}:${Math.random()}`;
    const token = 'tok_' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
    const ttlMs = options.ttlMs !== undefined ? options.ttlMs : 300000;
    this.approvalTokens = this.approvalTokens || new Map();
    this.approvalTokens.set(token, {
      token,
      toolName,
      taskId,
      argsHash: crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex'),
      expiresAt: Date.now() + ttlMs,
      used: false
    });
    return token;
  }

  validateApprovalToken(token, toolName, args = {}, options = {}) {
    if (!token || !this.approvalTokens || !this.approvalTokens.has(token)) return false;
    const rec = this.approvalTokens.get(token);
    if (rec.used) return false;
    if (Date.now() > rec.expiresAt) {
      this.approvalTokens.delete(token);
      return false;
    }
    if (rec.toolName !== toolName) return false;
    if (rec.taskId && options.taskId && rec.taskId !== options.taskId) return false;
    const currentHash = crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex');
    if (rec.argsHash !== currentHash) return false;

    if (options.consume === true || options.singleUse === true) {
      rec.used = true;
      this.approvalTokens.delete(token);
    }
    return true;
  }

  consumeApprovalToken(token) {
    if (this.approvalTokens && this.approvalTokens.has(token)) {
      this.approvalTokens.delete(token);
      return true;
    }
    return false;
  }

  isToolPermitted(toolName, personality = 'JARVIS') {
    if (this.emergencyStopActive) return false;
    const activePersonality = (personality || '').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';
    const policy = this.getPolicy(activePersonality);
    const category = this.categories[toolName];
    if (!category) return false;
    return policy.allowedCategories.includes(category);
  }

  /**
   * Alias for isToolPermitted for consistency across test suites
   */
  isAuthorized(toolName, personality = 'JARVIS') {
    return this.isToolPermitted(toolName, personality);
  }

  /**
   * Returns complete matrix of permitted and restricted tools for inspection
   */
  getCapabilityReport(personality = 'JARVIS') {
    const activePersonality = (personality || '').toUpperCase() === 'ULTRON' ? 'ULTRON' : 'JARVIS';
    const policy = this.getPolicy(activePersonality);
    const permitted = [];
    const denied = [];

    for (const [tool, cat] of Object.entries(this.categories)) {
      if (policy.allowedCategories.includes(cat)) {
        permitted.push({ tool, category: cat });
      } else {
        denied.push({ tool, category: cat });
      }
    }

    return {
      personality: activePersonality,
      policyName: policy.name,
      description: policy.description,
      emergencyStopActive: this.emergencyStopActive,
      emergencyStopReason: this.emergencyStopReason,
      permittedCount: permitted.length,
      deniedCount: denied.length,
      permitted,
      denied
    };
  }
}

module.exports = {
  DesktopPermissionGate,
  permissionGateInstance: new DesktopPermissionGate(),
  PERMISSION_POLICIES,
  TOOL_CATEGORIES
};
